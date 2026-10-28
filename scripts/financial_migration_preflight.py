#!/usr/bin/env python3
"""Read-only preflight for legacy BTCBOX JSON before any financial migration.

This tool never imports data, writes to the source, or emits credentials/user PII.
It creates an aggregate manifest suitable for reconciliation planning only.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path


def dec(value, label, issues):
    try:
        out = Decimal(str(value if value is not None else 0))
        if not out.is_finite():
            raise InvalidOperation
        return out
    except (InvalidOperation, ValueError, TypeError):
        issues.append(f"invalid_numeric:{label}")
        return Decimal(0)


def canonical_decimal(value):
    return format(value.normalize(), "f") if value else "0"


def build_manifest(path: str) -> dict:
    src = Path(path)
    raw = src.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict) or "users" not in data or not isinstance(data.get("users"), dict):
        raise ValueError("legacy state must be a JSON object with an explicit users object")

    users = data["users"]
    totals = defaultdict(lambda: {"available": Decimal(0), "frozen": Decimal(0)})
    counts = Counter()
    statuses = {"withdrawals": Counter(), "deposits": Counter(), "earn_records": Counter(), "orders": Counter()}
    issues = []
    seen_ids = {"withdrawals": set(), "deposits": set(), "orders": set()}
    pending = {"withdrawals": 0, "deposits": 0}
    seen_uids = set()

    for key, user in users.items():
        if not isinstance(user, dict):
            issues.append("invalid_user_record")
            continue
        counts["users"] += 1
        uid = str(user.get("uid", key))
        if uid != str(key):
            issues.append("user_key_uid_mismatch")
        if uid in seen_uids:
            issues.append("duplicate_user_uid")
        seen_uids.add(uid)
        for field, bucket in (("balances", "available"), ("frozen", "frozen")):
            values = user.get(field, {})
            if not isinstance(values, dict):
                issues.append(f"invalid_{field}_map")
                continue
            for asset, amount in values.items():
                asset = str(asset).upper()
                if not asset or len(asset) > 16:
                    issues.append("invalid_asset_code")
                    continue
                val = dec(amount, field, issues)
                if val < 0:
                    issues.append(f"negative_{field}")
                totals[asset][bucket] += val

        for collection in ("withdrawals", "deposits", "orders", "earn_records"):
            rows = user.get(collection, [])
            if rows is None:
                rows = []
            if not isinstance(rows, list):
                issues.append(f"invalid_{collection}_list")
                continue
            counts[collection] += len(rows)
            for row in rows:
                if not isinstance(row, dict):
                    issues.append(f"invalid_{collection}_record")
                    continue
                status = str(row.get("status", "unknown")).lower()
                statuses[collection][status] += 1
                if collection == "withdrawals" and status == "pending":
                    pending["withdrawals"] += 1
                if collection == "deposits" and status == "pending":
                    pending["deposits"] += 1
                if collection in seen_ids:
                    rid = row.get("id")
                    if rid is not None:
                        composite = f"{uid}:{rid}"
                        if composite in seen_ids[collection]:
                            issues.append(f"duplicate_{collection}_id_within_user")
                        seen_ids[collection].add(composite)
                if collection in ("withdrawals", "deposits") and status == "pending":
                    amt = dec(row.get("amount", 0), f"{collection}.amount", issues)
                    fee = dec(row.get("fee", 0), f"{collection}.fee", issues)
                    if amt <= 0 or fee < 0:
                        issues.append(f"invalid_pending_{collection}_amount")

    manifest = {
        "manifest_version": 1,
        "source": {"basename": src.name, "sha256": digest, "size_bytes": len(raw)},
        "read_only_preflight": True,
        "import_performed": False,
        "counts": dict(sorted(counts.items())),
        "pending": pending,
        "status_counts": {name: dict(sorted(counter.items())) for name, counter in statuses.items()},
        "asset_totals": {asset: {kind: canonical_decimal(value) for kind, value in sums.items()}
                         for asset, sums in sorted(totals.items())},
        "issues": sorted(set(issues)),
        "preflight_passed": len(set(issues)) == 0,
        "required_manual_reconciliation": [
            "Verify source SHA-256 against an independently stored backup checksum.",
            "Map every legacy record to a stable database ID and preserve status history.",
            "Reconcile available/frozen totals and all pending withdrawals/deposits before cutover.",
            "Import into a clean staging database and rerun aggregate checks before production cutover."
        ]
    }
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="path to a copied legacy data.json backup")
    parser.add_argument("--output", help="manifest output path (default stdout)")
    args = parser.parse_args(argv)
    try:
        manifest = build_manifest(args.input)
        rendered = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            out = Path(args.output)
            if out.resolve() == Path(args.input).resolve():
                raise ValueError("output must not overwrite the source backup")
            out.write_text(rendered, encoding="utf-8")
        else:
            sys.stdout.write(rendered)
        return 0 if manifest["preflight_passed"] else 2
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"preflight failed: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
