#!/usr/bin/env python3
"""Offline, deterministic export of legacy financial records for staging migration.

Reads a verified BACKUP copy only; never connects to a database or mutates the source.
Output includes sensitive financial records (including withdrawal destinations). Store it
only in a restricted directory on encrypted storage. This is NOT an import script.
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

COLLECTIONS = ("withdrawals", "deposits", "orders", "earn_records")
MAX_NUMERIC = Decimal("1e30")

def decimal_text(value, label):
    try: n = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError): raise ValueError(f"invalid numeric field: {label}") from None
    if not n.is_finite() or abs(n) > MAX_NUMERIC: raise ValueError(f"out-of-range numeric field: {label}")
    return format(n.normalize(), "f") if n else "0"

def stable_id(kind, user_id, legacy_id, index):
    seed = f"btcbox-migration-v1:{kind}:{user_id}:{legacy_id if legacy_id is not None else 'missing'}:{index}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()

def write_jsonl(path, rows):
    with path.open("x", encoding="utf-8") as f:
        for row in rows: f.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")

def build_bundle(source, output_dir, expected_sha256):
    src, out = Path(source), Path(output_dir)
    if not src.is_file(): raise ValueError("input must be a regular backup file")
    raw = src.read_bytes(); digest = hashlib.sha256(raw).hexdigest()
    if not re.fullmatch(r"[0-9a-fA-F]{64}", expected_sha256 or ""): raise ValueError("--expected-sha256 must be a 64-character SHA-256 digest")
    if digest.lower() != expected_sha256.lower(): raise ValueError("source SHA-256 does not match --expected-sha256")
    try: data = json.loads(raw.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError): raise ValueError("input is not valid UTF-8 JSON") from None
    users = data.get("users") if isinstance(data, dict) else None
    if not isinstance(users, dict): raise ValueError("legacy state must be an object containing a users object")
    if out.exists():
        if not out.is_dir() or any(out.iterdir()): raise ValueError("output directory must not exist or must be empty")
    else: out.mkdir(parents=True, mode=0o700)
    try: os.chmod(out, 0o700)
    except OSError: pass

    accounts, withdrawals, deposits, orders, earn = [], [], [], [], []
    issues, counts, seen_users = [], {"users": 0}, set()
    for key, user in users.items():
        if not isinstance(user, dict): issues.append("invalid_user_record"); continue
        uid = str(user.get("uid", key))
        if not uid or uid != str(key): issues.append("user_key_uid_mismatch"); continue
        if uid in seen_users: issues.append("duplicate_user_id"); continue
        seen_users.add(uid); counts["users"] += 1
        balances, frozen = user.get("balances", {}), user.get("frozen", {})
        if not isinstance(balances, dict) or not isinstance(frozen, dict): issues.append("invalid_balance_map"); continue
        assets = sorted({str(a).upper() for a in balances} | {str(a).upper() for a in frozen})
        for asset in assets:
            if not re.fullmatch(r"[A-Z0-9]{2,16}", asset): issues.append("invalid_asset_code"); continue
            available = Decimal(decimal_text(balances.get(asset, balances.get(asset.lower(), 0)), f"{uid}.available.{asset}"))
            frozen_amount = Decimal(decimal_text(frozen.get(asset, frozen.get(asset.lower(), 0)), f"{uid}.frozen.{asset}"))
            if available < 0 or frozen_amount < 0: issues.append("negative_balance")
            accounts.append({"user_id": uid, "asset": asset, "available": decimal_text(available, "available"), "frozen": decimal_text(frozen_amount, "frozen"), "source": "legacy_json_snapshot"})
        for kind in COLLECTIONS:
            rows = user.get(kind, [])
            if rows is None: rows = []
            if not isinstance(rows, list): issues.append(f"invalid_{kind}_list"); continue
            counts[kind] = counts.get(kind, 0) + len(rows)
            target = {"withdrawals": withdrawals, "deposits": deposits, "orders": orders, "earn_records": earn}[kind]
            for index, row in enumerate(rows):
                if not isinstance(row, dict): issues.append(f"invalid_{kind}_record"); continue
                legacy_id = row.get("id")
                rec = {"migration_id": stable_id(kind, uid, legacy_id, index), "user_id": uid,
                       "legacy_id": str(legacy_id) if legacy_id is not None else None, "legacy_index": index,
                       "legacy_status": str(row.get("status", "unknown")).lower(), "source_collection": kind}
                if kind == "withdrawals":
                    rec.update({"asset": str(row.get("coin", row.get("asset", "USDT"))).upper(),
                        "amount": decimal_text(row.get("amount", 0), "withdrawal.amount"), "fee": decimal_text(row.get("fee", 0), "withdrawal.fee"),
                        "network": str(row.get("network", "")), "destination": str(row.get("address", row.get("destination", ""))),
                        "created_at_legacy": str(row.get("time", "")), "reviewed_at_legacy": str(row.get("reviewed_at", ""))})
                    if Decimal(rec["amount"]) <= 0 or Decimal(rec["fee"]) < 0: issues.append("invalid_withdrawal_amount_or_fee")
                elif kind == "deposits":
                    rec.update({"asset": str(row.get("coin", row.get("asset", "USDT"))).upper(), "amount": decimal_text(row.get("amount", 0), "deposit.amount"),
                        "network": str(row.get("network", "")), "txid": str(row.get("txid", "")),
                        "created_at_legacy": str(row.get("time", "")), "confirmed_at_legacy": str(row.get("confirmed_at", ""))})
                    if Decimal(rec["amount"]) <= 0: issues.append("invalid_deposit_amount")
                elif kind == "orders":
                    rec.update({"symbol": str(row.get("symbol", "")), "side": str(row.get("side", "")).lower(), "order_type": str(row.get("type", "")),
                        "price": decimal_text(row.get("price", 0), "order.price"), "quantity": decimal_text(row.get("qty", row.get("quantity", 0)), "order.quantity"),
                        "total": decimal_text(row.get("total", 0), "order.total"), "source": str(row.get("source", "")), "created_at_legacy": str(row.get("time", ""))})
                else:
                    for field in ("product_id", "product", "coin", "asset", "status", "time", "created_at", "redeemed_at"):
                        if field in row: rec[field] = str(row[field])
                    for field in ("amount", "principal", "rate", "payout"):
                        if field in row: rec[field] = decimal_text(row[field], f"earn.{field}")
                target.append(rec)
    if issues: raise ValueError("bundle validation failed: " + ", ".join(sorted(set(issues))))

    files = {"account_snapshots.jsonl": accounts, "withdrawals.jsonl": withdrawals, "deposits.jsonl": deposits, "orders.jsonl": orders, "earn_records.jsonl": earn}
    for name, rows in files.items(): write_jsonl(out / name, rows)
    output_sha256 = {name: hashlib.sha256((out / name).read_bytes()).hexdigest() for name in files}
    manifest = {"manifest_version": 1, "source": {"basename": src.name, "sha256": digest, "size_bytes": len(raw)},
        "bundle_created": True, "database_import_performed": False, "credentials_or_user_profile_fields_exported": False,
        "contains_sensitive_financial_data": True, "output_files": {name: len(rows) for name, rows in files.items()}, "output_sha256": output_sha256, "counts": counts,
        "id_strategy": "SHA-256 namespaced deterministic IDs; legacy IDs and array indexes retained",
        "warnings": ["This is a staging export bundle, not an import script.",
          "Legacy statuses and timestamps require explicit mapping; do not infer completed means on-chain settled.",
          "Account snapshots are not opening ledger entries; opening ledger operations must be generated and reconciled separately.",
          "Orders may be simulated; do not assume they represent exchange-verified executions.",
          "Review withdrawal destinations and financial records under the applicable data-retention policy."]}
    with (out / "manifest.json").open("x", encoding="utf-8") as f: json.dump(manifest, f, ensure_ascii=False, indent=2, sort_keys=True); f.write("\n")
    for p in out.iterdir():
        try: os.chmod(p, 0o600)
        except OSError: pass
    return manifest

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="path to a verified BACKUP copy of data.json")
    parser.add_argument("--output-dir", required=True, help="new/empty restricted directory for sensitive export files")
    parser.add_argument("--expected-sha256", required=True, help="independently recorded SHA-256 of the backup")
    parser.add_argument("--confirm-export", action="store_true", help="confirm authorized export and secure output storage")
    args = parser.parse_args(argv)
    if not args.confirm_export: parser.error("pass --confirm-export after verifying authorization and output storage security")
    try:
        manifest = build_bundle(args.input, args.output_dir, args.expected_sha256)
        print(json.dumps({"ok": True, "manifest": str(Path(args.output_dir) / "manifest.json"), "counts": manifest["output_files"], "database_import_performed": False}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError) as exc:
        print(f"export failed: {exc}", file=sys.stderr); return 1

if __name__ == "__main__": raise SystemExit(main())
