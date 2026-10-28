#!/usr/bin/env python3
"""Generate an idempotent SQL transaction for opening-balance ledger entries.

Offline only: reads a verified migration bundle and writes SQL; it never connects to a DB.
Run the generated SQL against a dedicated staging database only, after reviewing it.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

ASSET_RE = re.compile(r"^[A-Z0-9]{2,16}$")
USER_ID_MAX = 256


def sql_literal(value: str) -> str:
    if "\x00" in value:
        raise ValueError("NUL byte is not allowed in SQL text fields")
    return "'" + value.replace("'", "''") + "'"


def numeric(value, label):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"invalid numeric value in {label}") from None
    if not number.is_finite() or number < 0 or number >= Decimal("1e20"):
        raise ValueError(f"out-of-range numeric value in {label}")
    try:
        if number != number.quantize(Decimal("0.000000000000000001")):
            raise ValueError(f"numeric scale exceeds PostgreSQL numeric(38,18) in {label}")
    except InvalidOperation:
        raise ValueError(f"out-of-range numeric value in {label}") from None
    # SQL numeric literal, never quoted and never float-converted.
    return format(number, "f")


def load_accounts(bundle_dir: str):
    root = Path(bundle_dir)
    try:
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise ValueError("cannot read valid manifest.json") from None
    if manifest.get("manifest_version") != 1 or manifest.get("database_import_performed") is not False:
        raise ValueError("unsupported or unsafe migration manifest")
    digest = manifest.get("source", {}).get("sha256", "")
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("manifest source SHA-256 is missing or invalid")
    path = root / "account_snapshots.jsonl"
    expected_hash = manifest.get("output_sha256", {}).get("account_snapshots.jsonl")
    if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
        raise ValueError("account snapshot SHA-256 is missing from manifest")
    try:
        actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        raise ValueError("cannot read account_snapshots.jsonl") from None
    if actual_hash != expected_hash:
        raise ValueError("account snapshot SHA-256 does not match manifest")
    rows = []
    try:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                raise ValueError(f"invalid account snapshot JSON at line {line_no}") from None
            user_id, asset = row.get("user_id"), row.get("asset")
            if not isinstance(user_id, str) or not user_id or len(user_id) > USER_ID_MAX:
                raise ValueError(f"invalid user_id at account snapshot line {line_no}")
            if not isinstance(asset, str) or not ASSET_RE.fullmatch(asset):
                raise ValueError(f"invalid asset at account snapshot line {line_no}")
            rows.append({"user_id": user_id, "asset": asset,
                         "available": numeric(row.get("available"), f"line {line_no} available"),
                         "frozen": numeric(row.get("frozen"), f"line {line_no} frozen")})
    except OSError:
        raise ValueError("cannot read account_snapshots.jsonl") from None
    expected = manifest.get("output_files", {}).get("account_snapshots.jsonl")
    if not isinstance(expected, int) or expected != len(rows):
        raise ValueError("account snapshot count does not match manifest")
    keys = [(r["user_id"], r["asset"]) for r in rows]
    if len(keys) != len(set(keys)):
        raise ValueError("duplicate user/asset account snapshot")
    return digest, sorted(rows, key=lambda r: (r["user_id"], r["asset"]))


def generate_sql(bundle_dir: str, output_path: str):
    source_hash, rows = load_accounts(bundle_dir)
    out = Path(output_path)
    if out.exists():
        raise ValueError("output SQL file already exists; choose a new path")
    parts = [
        "-- Generated offline from a checksum-verified BTCBOX migration bundle.",
        "-- REVIEW before use. Run only on a dedicated staging database.",
        "-- This imports account opening snapshots only; it does not import requests/orders/earn positions.",
        "-- Execute with psql -v ON_ERROR_STOP=1 -f <this-file> or a transaction-capable SQL editor.",
        "BEGIN;",
        "SELECT pg_advisory_xact_lock(hashtext('btcbox-financial-migration-opening-v1'));",
    ]
    for row in rows:
        uid, asset = row["user_id"], row["asset"]
        available, frozen = row["available"], row["frozen"]
        key_seed = f"btcbox-opening-v1:{source_hash}:{uid}:{asset}"
        idem = "migration-opening-v1:" + hashlib.sha256(key_seed.encode()).hexdigest()
        request_hash = hashlib.sha256(f"{key_seed}:{available}:{frozen}".encode()).hexdigest()
        metadata = json.dumps({"migration_source_sha256": source_hash, "migration_kind": "opening_balance", "source": "legacy_json_snapshot"}, separators=(",", ":"))
        parts.extend([
            "",
            f"-- Opening balance for user={json.dumps(uid, ensure_ascii=False)} asset={asset}",
            "INSERT INTO public.financial_operations (idempotency_key,user_id,asset,operation_type,request_hash,metadata)",
            f"VALUES ({sql_literal(idem)},{sql_literal(uid)},{sql_literal(asset)},'migration_opening_balance',{sql_literal(request_hash)},{sql_literal(metadata)}::jsonb)",
            "ON CONFLICT (idempotency_key) DO NOTHING;",
            "DO $btcbox_migration$",
            "DECLARE v_op public.financial_operations%rowtype; v_available numeric(38,18); v_frozen numeric(38,18); v_ledger public.financial_ledger%rowtype;",
            "BEGIN",
            f"  SELECT * INTO v_op FROM public.financial_operations WHERE idempotency_key={sql_literal(idem)} FOR UPDATE;",
            f"  IF v_op.user_id <> {sql_literal(uid)} OR v_op.asset <> {sql_literal(asset)} OR v_op.operation_type <> 'migration_opening_balance' OR v_op.request_hash <> {sql_literal(request_hash)} THEN RAISE EXCEPTION 'migration idempotency payload mismatch'; END IF;",
            f"  INSERT INTO public.financial_accounts(user_id,asset,available,frozen) VALUES ({sql_literal(uid)},{sql_literal(asset)},{available}::numeric,{frozen}::numeric) ON CONFLICT (user_id,asset) DO NOTHING;",
            f"  SELECT available,frozen INTO v_available,v_frozen FROM public.financial_accounts WHERE user_id={sql_literal(uid)} AND asset={sql_literal(asset)} FOR UPDATE;",
            f"  IF v_available <> {available}::numeric OR v_frozen <> {frozen}::numeric THEN RAISE EXCEPTION 'existing account balance conflicts with migration snapshot'; END IF;",
            f"  SELECT * INTO v_ledger FROM public.financial_ledger WHERE operation_id=v_op.id AND user_id={sql_literal(uid)} AND asset={sql_literal(asset)};",
            "  IF NOT FOUND THEN",
            f"    INSERT INTO public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after) VALUES (v_op.id,{sql_literal(uid)},{sql_literal(asset)},{available}::numeric,{frozen}::numeric,{available}::numeric,{frozen}::numeric);",
            "  ELSE",
            f"    IF v_ledger.available_delta <> {available}::numeric OR v_ledger.frozen_delta <> {frozen}::numeric OR v_ledger.available_after <> {available}::numeric OR v_ledger.frozen_after <> {frozen}::numeric THEN RAISE EXCEPTION 'existing opening ledger entry conflicts with migration snapshot'; END IF;",
            "  END IF;",
            "END;",
            "$btcbox_migration$;",
        ])
    parts.extend(["", "COMMIT;", "-- End of generated transaction. Verify financial_migration_reconciliation_v4.sql before any cutover.", ""])
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("x", encoding="utf-8") as f:
        f.write("\n".join(parts))
    try:
        out.chmod(0o600)
    except OSError:
        pass
    return {"output": str(out), "accounts": len(rows), "source_sha256": source_hash, "database_connection_used": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle-dir", required=True, help="verified migration bundle directory")
    parser.add_argument("--output-sql", required=True, help="new SQL output path; will not overwrite")
    parser.add_argument("--confirm-staging-only", action="store_true", help="confirm the SQL will only be reviewed/run in staging")
    args = parser.parse_args(argv)
    if not args.confirm_staging_only:
        parser.error("pass --confirm-staging-only after confirming the target is a dedicated staging database")
    try:
        print(json.dumps(generate_sql(args.bundle_dir, args.output_sql), indent=2))
        return 0
    except (OSError, ValueError) as exc:
        print(f"SQL generation failed: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
