#!/usr/bin/env python3
"""Offline audit of financial RPC signatures and explicit service-role grants.

This does not claim runtime database verification. It validates the checked-in SQL
migration set and emits machine-readable evidence for CI/release review.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "public.apply_financial_operation(text,text,text,text,numeric,numeric,text,jsonb)",
    "public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text)",
    "public.review_withdrawal_atomic(text,text,boolean,text)",
    "public.confirm_deposit_atomic(text,text)",
    "public.subscribe_earn_atomic(text,text,text,text,numeric,text,text)",
    "public.redeem_earn_atomic(text,text,text,text)",
    "public.admin_manual_deposit_atomic(text,text,text,text,numeric,text,text,text,text)",
    "public.admin_adjustment_atomic(text,text,text,text,numeric,numeric,text,text)",
    "public.execute_spot_trade_atomic(text,text,text,text,text,text,numeric,numeric,text,text)",
    "public.submit_limit_order_matching_v1(text,text,text,text,text,numeric,numeric,text)",
    "public.cancel_limit_order_matching_v1(text,text,text)",
    "public.read_admin_account_balances_v1(text[])",
    "public.read_admin_withdrawal_snapshot_v1()",
    "public.read_financial_account_snapshot_v1(text)",
}


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text).lower()


def strip_sql_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    return re.sub(r"--[^\n]*", " ", text)


def function_signatures(sql: str) -> set[str]:
    """Parse declared argument types from CREATE FUNCTION headers (not function names only)."""
    source = strip_sql_comments(sql)
    found: set[str] = set()
    pattern = re.compile(r"\bcreate\s+(?:or\s+replace\s+)?function\s+(public\.[a-z_][a-z0-9_]*)\s*\(", re.I)
    supported_types = {"text", "text[]", "numeric", "boolean", "jsonb", "uuid", "integer", "bigint", "timestamptz", "date"}
    for match in pattern.finditer(source):
        i = match.end()
        depth = 1
        quote = False
        while i < len(source) and depth:
            ch = source[i]
            if ch == "'":
                quote = not quote
            elif not quote and ch == "(":
                depth += 1
            elif not quote and ch == ")":
                depth -= 1
            i += 1
        if depth:
            continue
        args_text = source[match.end():i - 1].strip()
        types: list[str] = []
        for arg in args_text.split(",") if args_text else []:
            arg = re.split(r"\bdefault\b|=", arg, maxsplit=1, flags=re.I)[0].strip()
            tokens = re.sub(r"\s+", " ", arg).split()
            if tokens and tokens[0].upper() in {"IN", "OUT", "INOUT", "VARIADIC"}:
                tokens = tokens[1:]
            if len(tokens) < 2:
                types = []
                break
            typ = " ".join(tokens[1:]).lower().strip()
            if typ not in supported_types:
                types = []
                break
            types.append(typ)
        found.add(match.group(1).lower() + "(" + ",".join(types) + ")")
    return found


def main() -> int:
    sql_files = sorted((ROOT / "supabase" / "sql").glob("*.sql"))
    if not sql_files:
        print(json.dumps({"ok": False, "error": "no Supabase SQL migrations found"}, indent=2))
        return 2
    raw_sql = "\n".join(p.read_text(encoding="utf-8") for p in sql_files)
    normalized = compact(strip_sql_comments(raw_sql))
    declared_signatures = function_signatures(raw_sql)
    results = {}
    for signature in sorted(REQUIRED):
        sig = compact(signature)
        definition = sig in declared_signatures
        revoked = ("revokeallonfunction" + sig + "frompublic,anon,authenticated") in normalized
        service_grant = ("grantexecuteonfunction" + sig + "toservice_role") in normalized
        results[signature] = {"exact_definition_present": definition, "browser_execute_revoked": revoked,
                              "service_role_execute_granted": service_grant}

    protected_tables = {
        "financial_accounts", "financial_operations", "financial_ledger", "withdrawal_requests",
        "deposit_records", "earn_positions", "financial_audit_log", "financial_spot_orders",
        "financial_matching_markets", "financial_matching_orders", "financial_matching_trades",
        "earn_product_catalog",
    }
    table_results = {}
    revoke_objects = []
    for statement in re.findall(r"revoke\s+all\s+on\s+(.+?)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;", strip_sql_comments(raw_sql), flags=re.I | re.S):
        revoke_objects.append(compact(statement))
    for table in sorted(protected_tables):
        rls = f"altertablepublic.{table}enablerowlevelsecurity" in normalized
        browser_revoked = any(("public." + table) in objects for objects in revoke_objects)
        table_results[table] = {"rls_enabled_in_sql": rls, "browser_table_privileges_revoked": browser_revoked}
    failed = {name: checks for name, checks in results.items() if not all(checks.values())}
    failed_tables = {name: checks for name, checks in table_results.items() if not all(checks.values())}
    report = {"ok": not failed and not failed_tables, "audit_type": "offline_sql_static_audit", "live_database_checked": False,
              "sql_files_checked": len(sql_files), "required_rpc_signatures": len(REQUIRED),
              "protected_financial_tables_checked": len(protected_tables), "failed": failed,
              "failed_tables": failed_tables, "results": results, "tables": table_results}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
