#!/usr/bin/env python3
"""Static cross-check of BTCBOX money-moving API routes against SQL RPC definitions.

This is deliberately static evidence only. It does not claim deployed PostgreSQL runtime verification.
"""
from __future__ import annotations
import json
from pathlib import Path
import re
import sys

CONTRACTS = {
    "user_withdrawal": {"route": "if (path === 'withdraw' && method === 'POST')", "rpc": "create_withdrawal_atomic", "sql": "supabase/sql/financial_lifecycle_v2.sql"},
    "earn_subscribe": {"route": "if (path === 'earn' && method === 'POST')", "rpc": "subscribe_earn_atomic", "sql": "supabase/sql/financial_earn_policy_v5.sql"},
    "earn_redeem": {"route": "if (path === 'earn' && method === 'POST')", "rpc": "redeem_earn_atomic", "sql": "supabase/sql/financial_earn_redemption_idempotency_v4.sql"},
    "spot_order": {"route": "if (path === 'order' && method === 'POST')", "rpc": "submit_limit_order_matching_v1", "sql": "supabase/sql/financial_matching_engine_v1.sql"},
    "admin_balance_adjustment": {"route": "if (sub === 'user/balance' && method === 'POST')", "rpc": "admin_adjustment_atomic", "sql": "supabase/sql/financial_admin_adjustment_v1.sql"},
    # This endpoint is explicitly a manual administrator credit, not on-chain deposit confirmation.
    "admin_manual_deposit_credit": {"route": "if (sub === 'deposit/confirm' && method === 'POST')", "rpc": "admin_manual_deposit_atomic", "sql": "supabase/sql/financial_admin_manual_deposit_v1.sql"},
    "admin_withdraw_approve": {"route": "if (sub === 'withdraw/approve' && method === 'POST')", "rpc": "review_withdrawal_atomic", "sql": "supabase/sql/financial_lifecycle_v2.sql"},
    "admin_withdraw_reject": {"route": "if (sub === 'withdraw/reject' && method === 'POST')", "rpc": "review_withdrawal_atomic", "sql": "supabase/sql/financial_lifecycle_v2.sql"},
}


def audit(root: Path) -> dict:
    api_path = root / "netlify/functions/api.js"
    api = api_path.read_text(encoding="utf-8") if api_path.is_file() else ""
    rows = {}
    for name, contract in CONTRACTS.items():
        sql_path = root / contract["sql"]
        sql = sql_path.read_text(encoding="utf-8") if sql_path.is_file() else ""
        rpc = contract["rpc"]
        route_marker = contract["route"]
        if route_marker:
            start = api.find(route_marker)
            positions = [api.find(c["route"], start + len(route_marker)) for c in CONTRACTS.values() if c["route"] and start >= 0]
            positions = [p for p in positions if p >= 0]
            block = api[start:min(positions) if positions else len(api)] if start >= 0 else ""
            route_found = start >= 0
            rpc_reference_found = bool(re.search(r"/rpc/" + re.escape(rpc) + r"\b|matchingRpc\(['\"]" + re.escape(rpc) + r"['\"]", block))
        else:
            route_found = None
            rpc_reference_found = None
        definition_found = bool(re.search(r"create\s+or\s+replace\s+function\s+public\." + re.escape(rpc) + r"\s*\(", sql, re.I))
        rows[name] = {"route_marker_found": route_found, "route_calls_expected_rpc": rpc_reference_found,
                      "sql_artifact_exists": sql_path.is_file(), "sql_function_definition_found": definition_found,
                      "rpc": rpc, "sql_artifact": contract["sql"]}
    failures = [name for name, r in rows.items() if not r["sql_artifact_exists"] or not r["sql_function_definition_found"] or r["route_marker_found"] is False or r["route_calls_expected_rpc"] is False]
    # A SQL function alone is not an application route. Keep this separate from source/SQL
    # static failures so the report does not imply the on-chain confirmation flow is wired.
    unwired_routes = [name for name, r in rows.items() if r["route_marker_found"] is None or r["route_calls_expected_rpc"] is None]
    return {"audit_type": "static_rpc_route_contract", "live_database_checked": False,
            "runtime_rpc_verified": False, "contracts": rows, "static_failures": failures,
            "unwired_routes": unwired_routes,
            "ready_for_production_cutover": False,
            "blocking_note": "Static source/SQL matching is not proof that migrations are applied, grants are safe, or RPC transactions pass in PostgreSQL. SQL-only contracts are not wired application routes."}


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args()
    report = audit(Path(args.root).resolve())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report["static_failures"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
