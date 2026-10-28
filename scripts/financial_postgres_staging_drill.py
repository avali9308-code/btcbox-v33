#!/usr/bin/env python3
"""Opt-in PostgreSQL staging drill for duplicate concurrency, rollback and ledger consistency.

This script intentionally refuses to run without an explicit mutation acknowledgement and
BTCBOX_STAGING_DATABASE_URL. Use only against a dedicated disposable/staging database.
"""
from __future__ import annotations
import argparse
import concurrent.futures
from decimal import Decimal
import hashlib
import json
import os
import re
import sys
import uuid
from urllib.parse import urlparse


def require_environment(allow_mutation: bool = True) -> tuple[str, str]:
    if allow_mutation and os.environ.get("BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION") != "1":
        raise RuntimeError("set BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION=1 only after confirming this is a disposable staging database")
    url = os.environ.get("BTCBOX_STAGING_DATABASE_URL", "").strip()
    if not url.startswith(("postgres://", "postgresql://")):
        raise RuntimeError("BTCBOX_STAGING_DATABASE_URL must be a PostgreSQL connection URL")
    expected_db = os.environ.get("BTCBOX_STAGING_EXPECTED_DATABASE", "").strip()
    if expected_db and re.search(r"(prod|production|mainnet|primary)", expected_db, re.I):
        raise RuntimeError("refusing a production-like database name")
    if not expected_db or not re.search(r"(stage|staging|test|sandbox|disposable)", expected_db, re.I):
        raise RuntimeError("BTCBOX_STAGING_EXPECTED_DATABASE must explicitly name a staging/test/sandbox database")
    parsed = urlparse(url)
    actual_host = (parsed.hostname or "").strip().lower()
    expected_host = os.environ.get("BTCBOX_STAGING_EXPECTED_HOST", "").strip().lower()
    if not actual_host or not expected_host or actual_host != expected_host:
        raise RuntimeError("BTCBOX_STAGING_EXPECTED_HOST must exactly match the staging URL hostname")
    if re.search(r"(^|[.-])(prod|production|primary|mainnet)([.-]|$)", actual_host, re.I):
        raise RuntimeError("refusing a production-like database host")
    return url, expected_db


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="run mutation tests against the staging database")
    parser.add_argument("--preflight-only", action="store_true", help="check database identity, RPC grants and RLS without writing test rows")
    args = parser.parse_args(argv)
    if args.execute == args.preflight_only:
        parser.error("choose exactly one: --preflight-only (read-only) or --execute (mutating staging drill)")
    try:
        url, expected_db = require_environment(allow_mutation=args.execute)
        import psycopg  # optional dependency; not required by the normal project test suite
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2), file=sys.stderr)
        return 2

    # Verify the actual database identity before creating any test rows.
    try:
        with psycopg.connect(url) as conn:
            actual_db = conn.execute("SELECT current_database()").fetchone()[0]
            if actual_db != expected_db:
                raise RuntimeError(f"connected database {actual_db!r} does not match BTCBOX_STAGING_EXPECTED_DATABASE")
    except Exception as exc:
        print(json.dumps({"ok": False, "error": "database identity check failed: " + str(exc)[:400]}, indent=2), file=sys.stderr)
        return 2

    # Verify schema, required RPCs, grants, and RLS before any mutation. This is
    # runtime evidence from the connected staging database, not a source marker.
    # Verify exact signatures, not merely function names: an unrelated overload must not
    # satisfy the production readiness gate.
    required_rpcs = {
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
    protected_tables = {
        "financial_accounts", "financial_operations", "financial_ledger",
        "withdrawal_requests", "deposit_records", "earn_positions", "financial_audit_log",
        "financial_spot_orders", "financial_matching_markets", "financial_matching_orders",
        "financial_matching_trades", "earn_product_catalog",
    }
    with psycopg.connect(url) as conn:
        rpc_security = {}
        missing_rpcs = []
        unsafe_rpcs = []
        for signature in sorted(required_rpcs):
            row = conn.execute("SELECT to_regprocedure(%s)::oid", (signature,)).fetchone()
            if not row or row[0] is None:
                missing_rpcs.append(signature)
                continue
            grants = conn.execute("""
                SELECT has_function_privilege('service_role', %s::oid, 'EXECUTE'),
                       has_function_privilege('anon', %s::oid, 'EXECUTE'),
                       has_function_privilege('authenticated', %s::oid, 'EXECUTE')
            """, (row[0], row[0], row[0])).fetchone()
            rpc_security[signature] = {"service_can_execute": bool(grants[0]),
                                       "anon_can_execute": bool(grants[1]),
                                       "authenticated_can_execute": bool(grants[2])}
            if not rpc_security[signature]["service_can_execute"] or rpc_security[signature]["anon_can_execute"] or rpc_security[signature]["authenticated_can_execute"]:
                unsafe_rpcs.append(signature)
        table_rows = conn.execute("""
            SELECT c.relname, c.relrowsecurity,
                   (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE') OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES') OR has_table_privilege('anon', c.oid, 'TRIGGER')) AS anon_has_any,
                   (has_table_privilege('authenticated', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE') OR has_table_privilege('authenticated', c.oid, 'DELETE') OR has_table_privilege('authenticated', c.oid, 'TRUNCATE') OR has_table_privilege('authenticated', c.oid, 'REFERENCES') OR has_table_privilege('authenticated', c.oid, 'TRIGGER')) AS authenticated_has_any
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY(%s)
        """, (list(protected_tables),)).fetchall()
        table_security = {row[0]: {"rls_enabled": bool(row[1]), "anon_has_any": bool(row[2]),
                                   "authenticated_has_any": bool(row[3])} for row in table_rows}
        missing_tables = sorted(protected_tables - set(table_security))
        unsafe_tables = sorted(name for name, grants in table_security.items()
                               if not grants["rls_enabled"] or grants["anon_has_any"] or grants["authenticated_has_any"])
        conn.rollback()
    preflight = {"required_rpcs_present": not missing_rpcs, "rpc_grants_safe": not unsafe_rpcs,
                 "protected_tables_present": not missing_tables, "table_grants_and_rls_safe": not unsafe_tables,
                 "missing_rpcs": missing_rpcs, "unsafe_rpcs": unsafe_rpcs,
                 "missing_tables": missing_tables, "unsafe_tables": unsafe_tables}
    if not all((preflight["required_rpcs_present"], preflight["rpc_grants_safe"],
                preflight["protected_tables_present"], preflight["table_grants_and_rls_safe"])):
        print(json.dumps({"ok": False, "database_checked": True, "database_name": expected_db,
                          "preflight": preflight}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    if args.preflight_only:
        print(json.dumps({"ok": True, "preflight_only": True, "database_checked": True,
                          "database_name": expected_db, "preflight": preflight}, ensure_ascii=False, indent=2))
        return 0

    namespace = "btcbox-drill-" + uuid.uuid4().hex
    asset = "TST"
    seed_key = namespace + "-seed"
    duplicate_key = namespace + "-concurrent"
    rollback_key = namespace + "-rollback"
    seed_hash = hashlib.sha256((namespace + "|seed|10").encode()).hexdigest()
    duplicate_hash = hashlib.sha256((namespace + "|duplicate|1").encode()).hexdigest()
    rollback_hash = hashlib.sha256((namespace + "|rollback|7").encode()).hexdigest()

    def apply(key, amount, request_hash):
        with psycopg.connect(url) as conn:
            row = conn.execute(
                "SELECT public.apply_financial_operation(%s,%s,%s,%s,%s,%s,%s,%s::jsonb)",
                (key, namespace, asset, "deposit_credit", amount, 0, request_hash,
                 json.dumps({"staging_test": True, "test_namespace": namespace})),
            ).fetchone()
            conn.commit()
            return row[0]

    result = {"ok": False, "database_checked": True, "database_name": expected_db, "preflight": preflight, "namespace": namespace,
              "checks": {"concurrent_duplicate": False, "idempotency_payload_mismatch_rejected": False,
                         "insufficient_funds_rejected": False, "withdrawal_ledger_delta_sequence": False,
                         "earn_ledger_delta_sequence": False, "admin_adjustment_ledger_delta": False,
                         "rollback": False, "ledger_consistency": False}}
    try:
        apply(seed_key, "10", seed_hash)
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            duplicate_results = list(pool.map(lambda _: apply(duplicate_key, "1", duplicate_hash), range(12)))
        with psycopg.connect(url) as conn:
            op_count = conn.execute("SELECT count(*) FROM public.financial_operations WHERE idempotency_key=%s", (duplicate_key,)).fetchone()[0]
            ledger_count = conn.execute("SELECT count(*) FROM public.financial_ledger l JOIN public.financial_operations o ON o.id=l.operation_id WHERE o.idempotency_key=%s", (duplicate_key,)).fetchone()[0]
            result["checks"]["concurrent_duplicate"] = op_count == 1 and ledger_count == 1 and sum(1 for r in duplicate_results if not r.get("duplicate", False)) == 1
            conn.rollback()

        # Reusing a key with a different payload must fail closed and never post another ledger row.
        mismatch_rejected = False
        try:
            apply(duplicate_key, "2", hashlib.sha256((namespace + "|duplicate|2").encode()).hexdigest())
        except Exception as exc:
            mismatch_rejected = "mismatch" in str(exc).lower() or "duplicate" in str(exc).lower() or "payload" in str(exc).lower()
        with psycopg.connect(url) as conn:
            mismatch_count = conn.execute("SELECT count(*) FROM public.financial_ledger l JOIN public.financial_operations o ON o.id=l.operation_id WHERE o.idempotency_key=%s", (duplicate_key,)).fetchone()[0]
            result["checks"]["idempotency_payload_mismatch_rejected"] = mismatch_rejected and mismatch_count == 1
            conn.rollback()

        def op(suffix, kind, available_delta, frozen_delta):
            key = namespace + "-" + suffix
            request_hash = hashlib.sha256(f"{namespace}|{suffix}|{kind}|{available_delta}|{frozen_delta}".encode()).hexdigest()
            return apply_operation(key, kind, available_delta, frozen_delta, request_hash)

        def apply_operation(key, kind, available_delta, frozen_delta, request_hash):
            with psycopg.connect(url) as conn:
                row = conn.execute(
                    "SELECT public.apply_financial_operation(%s,%s,%s,%s,%s,%s,%s,%s::jsonb)",
                    (key, namespace, asset, kind, str(available_delta), str(frozen_delta), request_hash,
                     json.dumps({"staging_test": True, "test_namespace": namespace})),
                ).fetchone()
                conn.commit()
                return row[0]

        # Exercise each common movement type against the same isolated account.
        op("withdraw-freeze", "withdraw_freeze", -3, 3)
        op("withdraw-reject", "withdraw_reject", 3, -3)
        op("withdraw-freeze-approve", "withdraw_freeze", -2, 2)
        op("withdraw-approve", "withdraw_approve", 0, -2)
        with psycopg.connect(url) as conn:
            withdrawal_rows = conn.execute("""
                SELECT o.idempotency_key, l.available_delta, l.frozen_delta
                  FROM public.financial_operations o
                  JOIN public.financial_ledger l ON l.operation_id=o.id
                 WHERE o.user_id=%s AND o.idempotency_key = ANY(%s)
            """, (namespace, [namespace + "-withdraw-freeze", namespace + "-withdraw-reject",
                             namespace + "-withdraw-freeze-approve", namespace + "-withdraw-approve"])).fetchall()
            withdrawal_deltas = {row[0]: (Decimal(row[1]), Decimal(row[2])) for row in withdrawal_rows}
            result["checks"]["withdrawal_ledger_delta_sequence"] = withdrawal_deltas == {
                namespace + "-withdraw-freeze": (Decimal("-3"), Decimal("3")),
                namespace + "-withdraw-reject": (Decimal("3"), Decimal("-3")),
                namespace + "-withdraw-freeze-approve": (Decimal("-2"), Decimal("2")),
                namespace + "-withdraw-approve": (Decimal("0"), Decimal("-2")),
            }
            conn.rollback()
        # Earn principal leaves the account balance while active; it is not a
        # frozen balance. Redemption returns principal/payout to available funds.
        op("earn-subscribe", "earn_subscribe", -2, 0)
        op("earn-redeem", "earn_redeem", 2, 0)
        with psycopg.connect(url) as conn:
            earn_rows = conn.execute("""
                SELECT o.idempotency_key, l.available_delta, l.frozen_delta
                  FROM public.financial_operations o
                  JOIN public.financial_ledger l ON l.operation_id=o.id
                 WHERE o.user_id=%s AND o.idempotency_key = ANY(%s)
            """, (namespace, [namespace + "-earn-subscribe", namespace + "-earn-redeem"])).fetchall()
            earn_deltas = {row[0]: (Decimal(row[1]), Decimal(row[2])) for row in earn_rows}
            result["checks"]["earn_ledger_delta_sequence"] = (
                earn_deltas.get(namespace + "-earn-subscribe") == (Decimal("-2"), Decimal("0")) and
                earn_deltas.get(namespace + "-earn-redeem") == (Decimal("2"), Decimal("0"))
            )
            conn.rollback()
        op("admin-adjustment", "admin_adjustment", 1, 0)
        with psycopg.connect(url) as conn:
            admin_rows = conn.execute("""
                SELECT o.idempotency_key, l.available_delta, l.frozen_delta
                  FROM public.financial_operations o
                  JOIN public.financial_ledger l ON l.operation_id=o.id
                 WHERE o.user_id=%s AND o.idempotency_key=%s
            """, (namespace, namespace + "-admin-adjustment")).fetchall()
            result["checks"]["admin_adjustment_ledger_delta"] = (
                len(admin_rows) == 1 and Decimal(admin_rows[0][1]) == Decimal("1") and Decimal(admin_rows[0][2]) == Decimal("0")
            )
            conn.rollback()

        # An overdraw must fail atomically and leave both account and ledger unchanged.
        insufficient_rejected = False
        before = None
        with psycopg.connect(url) as conn:
            before = conn.execute("SELECT available, frozen FROM public.financial_accounts WHERE user_id=%s AND asset=%s", (namespace, asset)).fetchone()
            conn.rollback()
        try:
            op("insufficient-funds", "withdraw_freeze", "-999", "999")
        except Exception as exc:
            insufficient_rejected = "insufficient" in str(exc).lower() or "funds" in str(exc).lower()
        with psycopg.connect(url) as conn:
            after = conn.execute("SELECT available, frozen FROM public.financial_accounts WHERE user_id=%s AND asset=%s", (namespace, asset)).fetchone()
            failed_op_count = conn.execute("SELECT count(*) FROM public.financial_operations WHERE idempotency_key=%s", (namespace + "-insufficient-funds",)).fetchone()[0]
            result["checks"]["insufficient_funds_rejected"] = insufficient_rejected and before == after and failed_op_count == 0
            conn.rollback()

        # Deliberately roll back a successful function call and confirm no operation or ledger row survives.
        with psycopg.connect(url) as conn:
            conn.execute(
                "SELECT public.apply_financial_operation(%s,%s,%s,%s,%s,%s,%s,%s::jsonb)",
                (rollback_key, namespace, asset, "deposit_credit", "7", "0", rollback_hash,
                 json.dumps({"staging_test": True, "test_namespace": namespace})),
            )
            conn.rollback()
        with psycopg.connect(url) as conn:
            rollback_count = conn.execute("SELECT count(*) FROM public.financial_operations WHERE idempotency_key=%s", (rollback_key,)).fetchone()[0]
            rollback_ledger_count = conn.execute("SELECT count(*) FROM public.financial_ledger l JOIN public.financial_operations o ON o.id=l.operation_id WHERE o.idempotency_key=%s", (rollback_key,)).fetchone()[0]
            result["checks"]["rollback"] = rollback_count == 0 and rollback_ledger_count == 0
            account = conn.execute("SELECT available, frozen FROM public.financial_accounts WHERE user_id=%s AND asset=%s", (namespace, asset)).fetchone()
            sums = conn.execute("SELECT coalesce(sum(available_delta),0), coalesce(sum(frozen_delta),0) FROM public.financial_ledger WHERE user_id=%s AND asset=%s", (namespace, asset)).fetchone()
            result["checks"]["ledger_consistency"] = account is not None and Decimal(account[0]) == Decimal(sums[0]) and Decimal(account[1]) == Decimal(sums[1]) and Decimal(account[0]) == Decimal("10") and Decimal(account[1]) == Decimal("0")
            conn.rollback()
        result["ok"] = all(result["checks"].values())
        return_code = 0 if result["ok"] else 1
    except Exception as exc:
        result["error"] = type(exc).__name__ + ": " + str(exc)[:500]
        return_code = 1
    finally:
        # Delete only rows carrying this unguessable test namespace; do not touch any real user rows.
        try:
            with psycopg.connect(url) as conn:
                conn.execute("DELETE FROM public.financial_ledger WHERE user_id=%s", (namespace,))
                conn.execute("DELETE FROM public.financial_operations WHERE user_id=%s", (namespace,))
                conn.execute("DELETE FROM public.financial_accounts WHERE user_id=%s", (namespace,))
                conn.commit()
        except Exception as exc:
            result["cleanup_warning"] = type(exc).__name__ + ": " + str(exc)[:300]
            return_code = 1
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
