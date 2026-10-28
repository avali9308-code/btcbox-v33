#!/usr/bin/env python3
"""Static preflight for BTCBOX financial SQL migrations; does not connect to Supabase."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "supabase" / "sql"
REQUIRED_FILES = [
    "financial_ledger_v1.sql",
    "financial_lifecycle_v2.sql",
    "financial_admin_adjustment_v1.sql",
    "financial_earn_redemption_idempotency_v4.sql",
    "financial_earn_policy_v5.sql",
    "financial_admin_manual_deposit_v1.sql",
    "financial_spot_trade_v3.sql",
    "financial_matching_engine_v1.sql",
    "financial_read_api_v1.sql",
    "financial_read_api_earn_v1.sql",
    "financial_admin_read_api_v1.sql",
    "financial_admin_account_read_api_v1.sql",
    "financial_ledger_reconciliation_v1.sql",
    "financial_migration_staging_v5.sql",
    "financial_migration_staging_reconciliation_v6.sql",
    "financial_migration_reconciliation_v4.sql",
]
REQUIRED_MARKERS = {
    "financial_ledger_v1.sql": ["create table if not exists public.financial_accounts", "create table if not exists public.financial_operations", "create table if not exists public.financial_ledger"],
    "financial_lifecycle_v2.sql": ["create_withdrawal_atomic", "review_withdrawal_atomic", "confirm_deposit_atomic"],
    "financial_admin_adjustment_v1.sql": ["admin_adjustment_atomic"],
    "financial_spot_trade_v3.sql": ["execute_spot_trade_atomic"],
    "financial_matching_engine_v1.sql": ["financial_matching_orders", "financial_matching_trades", "submit_limit_order_matching_v1", "cancel_limit_order_matching_v1", "pg_advisory_xact_lock", "remaining_quantity"],
    "financial_read_api_v1.sql": ["read_financial_account_snapshot_v1"],
    "financial_read_api_earn_v1.sql": ["read_financial_account_snapshot_v1", "from public.earn_positions", "earn_records"],
    "financial_admin_read_api_v1.sql": ["read_admin_withdrawal_snapshot_v1"],
    "financial_admin_account_read_api_v1.sql": ["read_admin_account_balances_v1"],
}

errors = []
for name in REQUIRED_FILES:
    p = SQL / name
    if not p.is_file():
        errors.append(f"MISSING FILE: {name}")
        continue
    content = re.sub(r"\s+", " ", p.read_text(encoding="utf-8").lower())
    for marker in REQUIRED_MARKERS.get(name, []):
        if marker.lower() not in content:
            errors.append(f"MISSING SQL MARKER: {name}: {marker}")

# Ensure sensitive normalized-read RPCs are not granted to browser roles.
RPC_SECURITY_SPECS = [
    ("financial_read_api_v1.sql", "read_financial_account_snapshot_v1(text)"),
    ("financial_read_api_earn_v1.sql", "read_financial_account_snapshot_v1(text)"),
    ("financial_admin_read_api_v1.sql", "read_admin_withdrawal_snapshot_v1()"),
    ("financial_admin_account_read_api_v1.sql", "read_admin_account_balances_v1(text[])")]


def audit_read_rpc_content(name, signature, raw_content):
    """Return static security findings for one normalized-read RPC SQL file."""
    content = re.sub(r"\s+", " ", raw_content.lower())
    function_name = signature.split("(")[0]
    function_start = content.find(f"create or replace function public.{function_name}")
    if function_start < 0:
        return [f"MISSING RPC DEFINITION: {name}: {signature}"]
    function_end = content.find("$$;", function_start)
    if function_end < 0:
        return [f"UNTERMINATED RPC BODY: {name}: {signature}"]
    definition = content[function_start:function_end]
    findings = []
    if not re.search(r"\bsecurity\s+invoker\b", definition):
        findings.append(f"RPC MUST USE SECURITY INVOKER: {name}: {signature}")
    if not re.search(r"set\s+search_path\s*=\s*''", definition):
        findings.append(f"RPC MUST PIN EMPTY SEARCH_PATH: {name}: {signature}")
    revoke = f"revoke all on function public.{signature} from public, anon, authenticated"
    if revoke not in content:
        findings.append(f"MISSING BROWSER ROLE REVOKE: {name}: {signature}")
    grant = f"grant execute on function public.{signature} to service_role"
    if grant not in content:
        findings.append(f"MISSING SERVICE_ROLE GRANT: {name}: {signature}")
    if re.search(rf"grant execute on function public\.{re.escape(signature)} to [^;]*(anon|authenticated|public)", content):
        findings.append(f"UNSAFE BROWSER ROLE GRANT: {name}: {signature}")
    return findings


for name, signature in RPC_SECURITY_SPECS:
    p = SQL / name
    if not p.exists():
        continue
    errors.extend(audit_read_rpc_content(name, signature, p.read_text(encoding="utf-8")))

if errors:
    print("FAIL | financial migration static preflight")
    for error in errors:
        print(f"FAIL | {error}")
    print("Note: this check is static only; it does not verify applied migrations or live data.")
    sys.exit(1)

print(f"PASS | required migration files present | {len(REQUIRED_FILES)} files")
print(f"PASS | key schema/RPC markers present | {sum(len(v) for v in REQUIRED_MARKERS.values())} markers")
print("PASS | normalized read RPCs restricted to service_role")
print("LIMITATION | static source check only; no live Supabase connection or migration-state verification")
