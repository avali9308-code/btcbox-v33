#!/usr/bin/env python3
"""Build a PII-minimized, offline reconciliation report from a verified migration bundle."""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

FILES = {
    "account_snapshots.jsonl": "account_snapshot",
    "withdrawals.jsonl": "withdrawal",
    "deposits.jsonl": "deposit",
    "orders.jsonl": "order",
    "earn_records.jsonl": "earn_record",
}


def read_bundle(root: Path):
    try:
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise ValueError("cannot read valid manifest.json") from None
    if manifest.get("manifest_version") != 1 or manifest.get("database_import_performed") is not False:
        raise ValueError("unsupported or unsafe migration manifest")
    source_hash = manifest.get("source", {}).get("sha256", "")
    if not isinstance(source_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", source_hash):
        raise ValueError("manifest source SHA-256 is invalid")
    data = {}
    for name in FILES:
        try:
            raw = (root / name).read_bytes()
            lines = raw.decode("utf-8").splitlines()
        except (OSError, UnicodeError):
            raise ValueError(f"cannot read valid {name}") from None
        if hashlib.sha256(raw).hexdigest() != manifest.get("output_sha256", {}).get(name):
            raise ValueError(f"SHA-256 mismatch for {name}")
        rows = []
        for n, line in enumerate(lines, 1):
            if not line.strip():
                continue
            try: row = json.loads(line)
            except json.JSONDecodeError: raise ValueError(f"invalid JSON in {name} line {n}") from None
            if not isinstance(row, dict) or not isinstance(row.get("user_id"), str) or not row["user_id"]:
                raise ValueError(f"invalid record identity in {name} line {n}")
            rows.append(row)
        if manifest.get("output_files", {}).get(name) != len(rows):
            raise ValueError(f"record count mismatch for {name}")
        data[name] = rows
    return manifest, data


def dec(value, label):
    try: d = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError): raise ValueError(f"invalid numeric field: {label}") from None
    if not d.is_finite(): raise ValueError(f"non-finite numeric field: {label}")
    return d


def fmt(d):
    return format(d.normalize(), "f") if d else "0"


def build_report(bundle_dir: str):
    manifest, data = read_bundle(Path(bundle_dir))
    report = {
        "report_version": 1,
        "source_sha256": manifest["source"]["sha256"],
        "source_file_size_bytes": manifest["source"].get("size_bytes"),
        "database_connection_used": False,
        "pii_or_user_ids_included": False,
        "bundle_integrity": "passed",
        "collections": {},
        "account_totals_by_asset": {},
        "amount_totals_by_asset": {"withdrawal": {}, "deposit": {}},
        "blocking_findings": [],
        "review_warnings": [
            "This report verifies the offline bundle only; it does not prove database import correctness.",
            "Legacy status labels are source labels, not independently verified settlement facts.",
            "Historical order rows may include simulated activity and are not proof of matching-engine execution.",
            "Frozen balance totals must be reconciled against pending withdrawals and other holds; do not auto-adjust.",
        ],
    }
    for name, rows in data.items():
        statuses = Counter(str(r.get("legacy_status", "snapshot")).lower() for r in rows)
        report["collections"][name] = {"record_count": len(rows), "status_counts": dict(sorted(statuses.items()))}
    accounts = defaultdict(lambda: {"available": Decimal(0), "frozen": Decimal(0), "rows": 0})
    seen = set()
    for row in data["account_snapshots.jsonl"]:
        asset = row.get("asset")
        if not isinstance(asset, str) or not re.fullmatch(r"[A-Z0-9]{2,16}", asset):
            report["blocking_findings"].append("invalid_account_asset_code"); continue
        key = (row["user_id"], asset)
        if key in seen: report["blocking_findings"].append("duplicate_user_asset_snapshot"); continue
        seen.add(key)
        available, frozen = dec(row.get("available", 0), "available"), dec(row.get("frozen", 0), "frozen")
        if available < 0 or frozen < 0: report["blocking_findings"].append("negative_account_balance")
        accounts[asset]["available"] += available; accounts[asset]["frozen"] += frozen; accounts[asset]["rows"] += 1
    report["account_totals_by_asset"] = {asset: {"available_total": fmt(v["available"]), "frozen_total": fmt(v["frozen"]), "account_asset_rows": v["rows"]} for asset, v in sorted(accounts.items())}
    for kind, filename in (("withdrawal", "withdrawals.jsonl"), ("deposit", "deposits.jsonl")):
        totals = defaultdict(lambda: {"amount_total": Decimal(0), "rows": 0})
        for row in data[filename]:
            asset = row.get("asset")
            if not isinstance(asset, str) or not re.fullmatch(r"[A-Z0-9]{2,16}", asset):
                report["blocking_findings"].append(f"invalid_{kind}_asset_code"); continue
            amount = dec(row.get("amount", 0), f"{kind}.amount")
            if amount <= 0: report["blocking_findings"].append(f"nonpositive_{kind}_amount")
            totals[asset]["amount_total"] += amount; totals[asset]["rows"] += 1
        report["amount_totals_by_asset"][kind] = {a: {"amount_total": fmt(v["amount_total"]), "record_count": v["rows"]} for a, v in sorted(totals.items())}
    report["blocking_findings"] = sorted(set(report["blocking_findings"]))
    report["pre_import_reconciliation_passed"] = not report["blocking_findings"]
    return report


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--bundle-dir", required=True)
    p.add_argument("--output", required=True, help="new report JSON path; must not already exist")
    p.add_argument("--confirm-offline", action="store_true")
    args = p.parse_args(argv)
    if not args.confirm_offline: p.error("pass --confirm-offline after confirming this is an offline bundle")
    out = Path(args.output)
    if out.exists(): print("report output already exists", file=sys.stderr); return 1
    try:
        report = build_report(args.bundle_dir)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("x", encoding="utf-8") as f: json.dump(report, f, indent=2, sort_keys=True); f.write("\n")
        try: out.chmod(0o600)
        except OSError: pass
        print(json.dumps({"ok": True, "report": str(out), "pre_import_reconciliation_passed": report["pre_import_reconciliation_passed"], "blocking_findings": report["blocking_findings"], "database_connection_used": False}, indent=2))
        return 0 if report["pre_import_reconciliation_passed"] else 2
    except (OSError, ValueError) as exc:
        print(f"reconciliation report failed: {exc}", file=sys.stderr); return 1

if __name__ == "__main__": raise SystemExit(main())
