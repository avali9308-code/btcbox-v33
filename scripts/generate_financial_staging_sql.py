#!/usr/bin/env python3
"""Generate offline SQL to stage legacy financial records for review only.

No DB connection is made. Records land in financial_legacy_migration_records, not
operational withdrawal/deposit/order/earn tables. Use only a dedicated staging DB.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path

FILES = {
    "account_snapshots.jsonl": "account_snapshot",
    "withdrawals.jsonl": "withdrawal",
    "deposits.jsonl": "deposit",
    "orders.jsonl": "order",
    "earn_records.jsonl": "earn_record",
}
MAX_USER_ID = 256


def sql_literal(value: str) -> str:
    if "\x00" in value:
        raise ValueError("NUL byte is not allowed in SQL text fields")
    return "'" + value.replace("'", "''") + "'"


def load_bundle(bundle_dir: str):
    root = Path(bundle_dir)
    try:
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise ValueError("cannot read valid manifest.json") from None
    if manifest.get("manifest_version") != 1 or manifest.get("database_import_performed") is not False:
        raise ValueError("unsupported or unsafe migration manifest")
    source_hash = manifest.get("source", {}).get("sha256", "")
    if not re.fullmatch(r"[0-9a-f]{64}", source_hash):
        raise ValueError("manifest source SHA-256 is missing or invalid")
    records = []
    expected_counts = manifest.get("output_files", {})
    expected_hashes = manifest.get("output_sha256", {})
    for filename, collection in FILES.items():
        path = root / filename
        try:
            raw = path.read_bytes()
            actual_hash = hashlib.sha256(raw).hexdigest()
            lines = raw.decode("utf-8").splitlines()
        except (OSError, UnicodeError):
            raise ValueError(f"cannot read valid {filename}") from None
        if expected_hashes.get(filename) != actual_hash:
            raise ValueError(f"SHA-256 does not match manifest for {filename}")
        rows = []
        for line_no, line in enumerate(lines, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                raise ValueError(f"invalid JSON in {filename} line {line_no}") from None
            if not isinstance(row, dict):
                raise ValueError(f"record must be an object in {filename} line {line_no}")
            uid = row.get("user_id")
            if not isinstance(uid, str) or not uid or len(uid) > MAX_USER_ID:
                raise ValueError(f"invalid user_id in {filename} line {line_no}")
            if collection != "account_snapshot":
                mid = row.get("migration_id")
                if not isinstance(mid, str) or not re.fullmatch(r"[0-9a-f]{64}", mid):
                    raise ValueError(f"invalid migration_id in {filename} line {line_no}")
            else:
                asset = row.get("asset")
                if not isinstance(asset, str) or not re.fullmatch(r"[A-Z0-9]{2,16}", asset):
                    raise ValueError(f"invalid asset in {filename} line {line_no}")
                row = dict(row)
                row["migration_id"] = hashlib.sha256(f"btcbox-staging-v1:{source_hash}:account_snapshot:{uid}:{asset}".encode()).hexdigest()
            canonical = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            payload_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            records.append({
                "collection": collection, "migration_id": row["migration_id"], "user_id": uid,
                "legacy_id": str(row.get("legacy_id")) if row.get("legacy_id") is not None else None,
                "legacy_index": int(row.get("legacy_index", 0)),
                "legacy_status": str(row.get("legacy_status", "snapshot")),
                "payload": canonical, "payload_hash": payload_hash,
                "source_hash": source_hash,
            })
            rows.append(row)
        expected = expected_counts.get(filename)
        if not isinstance(expected, int) or expected != len(rows):
            raise ValueError(f"record count does not match manifest for {filename}")
    keys = [(r["collection"], r["migration_id"]) for r in records]
    if len(keys) != len(set(keys)):
        raise ValueError("duplicate migration ID within collection")
    return source_hash, records


def generate_sql(bundle_dir: str, output_path: str):
    source_hash, records = load_bundle(bundle_dir)
    out = Path(output_path)
    if out.exists():
        raise ValueError("output SQL file already exists; choose a new path")
    parts = [
        "-- Generated offline from a checksum-verified migration bundle.",
        "-- STAGING QUARANTINE ONLY: does not update operational financial tables.",
        "-- Apply financial_migration_staging_v5.sql first in a dedicated staging DB.",
        "BEGIN;",
        "SELECT pg_advisory_xact_lock(hashtext('btcbox-financial-staging-import-v1'));",
    ]
    for r in records:
        parts.extend([
            "",
            f"INSERT INTO public.financial_legacy_migration_records (source_sha256,source_collection,migration_id,user_id,legacy_id,legacy_index,legacy_status,payload,payload_sha256)",
            f"VALUES ({sql_literal(r['source_hash'])},{sql_literal(r['collection'])},{sql_literal(r['migration_id'])},{sql_literal(r['user_id'])},{'NULL' if r['legacy_id'] is None else sql_literal(r['legacy_id'])},{r['legacy_index']},{sql_literal(r['legacy_status'])},{sql_literal(r['payload'])}::jsonb,{sql_literal(r['payload_hash'])})",
            "ON CONFLICT (source_sha256,source_collection,migration_id) DO NOTHING;",
            "DO $btcbox_staging_check$",
            "DECLARE v_hash text;",
            f"BEGIN SELECT payload_sha256 INTO v_hash FROM public.financial_legacy_migration_records WHERE source_sha256={sql_literal(r['source_hash'])} AND source_collection={sql_literal(r['collection'])} AND migration_id={sql_literal(r['migration_id'])} FOR UPDATE;",
            f"IF v_hash IS DISTINCT FROM {sql_literal(r['payload_hash'])} THEN RAISE EXCEPTION 'staging migration payload mismatch'; END IF;",
            "END;",
            "$btcbox_staging_check$;",
        ])
    parts.extend(["", "COMMIT;", "-- Review counts/statuses and reconcile before any operational-table mapping.", ""])
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("x", encoding="utf-8") as f:
        f.write("\n".join(parts))
    try: out.chmod(0o600)
    except OSError: pass
    return {"output": str(out), "records": len(records), "source_sha256": source_hash, "database_connection_used": False, "operational_tables_modified": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle-dir", required=True)
    parser.add_argument("--output-sql", required=True)
    parser.add_argument("--confirm-staging-only", action="store_true")
    args = parser.parse_args(argv)
    if not args.confirm_staging_only:
        parser.error("pass --confirm-staging-only after confirming the target is a dedicated staging database")
    try:
        print(json.dumps(generate_sql(args.bundle_dir, args.output_sql), indent=2))
        return 0
    except (OSError, ValueError) as exc:
        print(f"staging SQL generation failed: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
