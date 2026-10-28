#!/usr/bin/env python3
"""Fail-closed static gate for BTCBOX financial cutover readiness.

This is a source audit, not proof of database correctness. It deliberately blocks
cutover while server.py still directly mutates legacy balance/frozen buckets.
It emits only function names and source locations, never account/user data.
"""
from __future__ import annotations
import argparse
import json
import os
import re
from pathlib import Path

try:
    from .audit_financial_writers import audit
except ImportError:  # support direct execution as a script
    from audit_financial_writers import audit

REQUIRED_ARTIFACTS = (
    "supabase/sql/financial_ledger_v1.sql",
    "supabase/sql/financial_lifecycle_v2.sql",
    "supabase/sql/financial_spot_trade_v3.sql",
    "supabase/sql/financial_matching_engine_v1.sql",
    "supabase/sql/financial_earn_redemption_idempotency_v4.sql",
    "supabase/sql/financial_earn_policy_v5.sql",
    "supabase/sql/financial_read_api_earn_v1.sql",
    "supabase/sql/financial_ledger_reconciliation_v1.sql",
    "supabase/sql/financial_admin_adjustment_v1.sql",
)


API_FINANCIAL_ROUTES = {
    "user_withdrawal": "if (path === 'withdraw' && method === 'POST')",
    "earn_subscribe_redeem": "if (path === 'earn' && method === 'POST')",
    "spot_order": "if (path === 'order' && method === 'POST')",
    "admin_balance_adjustment": "if (sub === 'user/balance' && method === 'POST')",
    "admin_deposit_confirm": "if (sub === 'deposit/confirm' && method === 'POST')",
    "admin_withdraw_approve": "if (sub === 'withdraw/approve' && method === 'POST')",
    "admin_withdraw_reject": "if (sub === 'withdraw/reject' && method === 'POST')",
}


def audit_api_routes(root: Path) -> dict:
    """Conservative source contract audit of known money-moving API routes."""
    api_path = root / "netlify/functions/api.js"
    if not api_path.is_file():
        return {"source_exists": False, "routes": {}, "uncovered_routes": list(API_FINANCIAL_ROUTES)}
    source = api_path.read_text(encoding="utf-8")
    routes = {}
    for name, marker in API_FINANCIAL_ROUTES.items():
        start = source.find(marker)
        if start < 0:
            routes[name] = {"route_marker_found": False, "cutover_guard_found": False,
                            "postgres_rpc_wiring_verified": False}
            continue
        # Bound each route to a conservative source window so a guard in another route
        # cannot accidentally satisfy this route's contract.
        next_positions = [source.find(m, start + len(marker)) for m in API_FINANCIAL_ROUTES.values()]
        next_positions = [pos for pos in next_positions if pos >= 0]
        end = min(next_positions) if next_positions else len(source)
        block = source[start:end]
        rpc_route = "fetch(" in block and "/rpc/" in block and ("FINANCIAL_RPC_UNAVAILABLE" in block or "FINANCIAL_RPC_FAILED" in block)
        guard_found = (("FINANCIAL_CUTOVER_INCOMPLETE" in block and ("manualDepositRpcEnabled()" in block or "financialWritesEnabled()" in block))
                       or (name == "admin_balance_adjustment" and "admin_adjustment_atomic" in block and "FINANCIAL_RPC_UNAVAILABLE" in block)
                       or (name in {"user_withdrawal", "admin_withdraw_approve", "admin_withdraw_reject"} and rpc_route))
        if name == "spot_order":
            # Require a real RPC adapter plus explicit full-cutover gates; never accept a flag alone.
            guard_found = ("MATCHING_ENGINE_UNAVAILABLE" in block and "matchingEngineEnabled()" in block
                           and "submit_limit_order_matching_v1" in block and "MATCHING_RPC_UNAVAILABLE" in block)
            rpc_route = ("submit_limit_order_matching_v1" in block and "matchingEngineEnabled()" in block)
        rpc_wired = bool("fetch(" in block and "/rpc/" in block)
        if name == "spot_order":
            # The reusable adapter performs fetch() outside this route block.
            rpc_wired = "matchingRpc('submit_limit_order_matching_v1'" in block and "matchingEngineEnabled()" in block

        # Detect dormant legacy writers inside a route even when a preceding
        # fail-closed guard currently makes them unreachable. Do not confuse this
        # source inventory with proof of runtime reachability.
        legacy_patterns = (
            r"\b(?:balance|balances\[[^\]]+\])\.(?:free|frozen)\s*[-+]\=",
            r"\b(?:balance|balances\[[^\]]+\])\.(?:free|frozen)\s*=\s*[^=]",
            r"\b(?:u|user)\.balances\[[^\]]+\]\s*=",
        )
        legacy_lines = []
        for offset, line in enumerate(block.splitlines(), start=source[:start].count("\n") + 1):
            if any(re.search(pattern, line) for pattern in legacy_patterns):
                legacy_lines.append(offset)
        routes[name] = {
            "route_marker_found": True,
            "cutover_guard_found": guard_found,
            # Static source markers only prove code is present. They cannot prove a
            # deployed route, credentials, SQL migration, or live transaction works.
            "postgres_rpc_wiring_present": rpc_wired,
            "postgres_rpc_wiring_verified": False,
            "legacy_mutation_lines_present": legacy_lines,
        }
    uncovered = [name for name, row in routes.items()
                 if not row["route_marker_found"] or not row["cutover_guard_found"]]
    return {"source_exists": True, "routes": routes, "uncovered_routes": uncovered}


def evaluate(root: Path) -> dict:
    missing = [name for name in REQUIRED_ARTIFACTS if not (root / name).is_file()]
    server_path = root / "server.py"
    writers = audit(server_path) if server_path.is_file() else []
    api_audit = audit_api_routes(root)
    findings = []
    if writers:
        findings.append("legacy_balance_or_frozen_mutations_remain")
    # The primary Netlify handler is a separate production entrypoint; its legacy
    # mutation paths must be audited independently from server.py.
    if not api_audit["source_exists"]:
        findings.append("primary_api_handler_missing")
    if api_audit["uncovered_routes"]:
        findings.append("financial_api_routes_missing_cutover_guard")
    api_legacy_locations = [
        {"route": name, "lines": row["legacy_mutation_lines_present"]}
        for name, row in api_audit.get("routes", {}).items()
        if row.get("legacy_mutation_lines_present")
    ]
    if api_legacy_locations:
        findings.append("legacy_financial_mutation_code_remains_in_primary_api")
    # This tool has no database credentials and never claims runtime verification.
    if any(not row.get("postgres_rpc_wiring_present", False) for row in api_audit["routes"].values()):
        findings.append("postgres_rpc_route_wiring_incomplete")
    unverified_rpc_routes = [
        name for name, row in api_audit["routes"].items()
        if row.get("postgres_rpc_wiring_present") and not row.get("postgres_rpc_wiring_verified")
    ]
    # Presence of an adapter in source is not evidence that deployed RPCs, grants,
    # migrations, or transactions work. Keep this a hard blocker until a live drill
    # produces independently reviewable evidence.
    if unverified_rpc_routes:
        findings.append("postgres_rpc_runtime_verification_missing")
    findings.append("live_postgres_validation_required")
    if missing:
        findings.append("required_financial_sql_artifacts_missing")
    return {
        "report_version": 2,
        "audit_type": "static_cutover_gate",
        "source_audit_performed": True,
        "live_database_checked": False,
        "staging_database_url_configured": bool(os.environ.get("BTCBOX_STAGING_DATABASE_URL")),
        "unverified_postgres_rpc_routes": unverified_rpc_routes,
        "concurrency_tested": False,
        "backup_restore_drill_verified": False,
        "legacy_writer_count": len(writers),
        "legacy_writer_locations": [
            {"line": row["line"], "function": row["function"], "target": row["target"]}
            for row in writers
        ],
        "primary_api_legacy_mutation_locations": api_legacy_locations,
        "api_financial_route_audit": api_audit,
        "missing_required_artifacts": missing,
        "blocking_findings": sorted(set(findings)),
        "ready_for_production_cutover": not findings,
        "required_evidence_before_cutover": [
            "all balance-changing paths use one authoritative database ledger",
            "read-only ledger reconciliation SQL returns zero findings in staging",
            "concurrent duplicate deposit, withdrawal, spot trade and earn tests pass against PostgreSQL",
            "backup restore drill and independent source checksum verification pass",
            "legacy balances and frozen amounts reconcile exactly by asset",
            "operator-approved rollback plan and historical exception report exist",
        ],
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--output", help="optional new JSON output file; existing files are not overwritten")
    args = parser.parse_args(argv)
    try:
        report = evaluate(Path(args.root).resolve())
        rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            out = Path(args.output)
            if out.exists():
                raise ValueError("output already exists; refusing to overwrite")
            out.parent.mkdir(parents=True, exist_ok=True)
            with out.open("x", encoding="utf-8") as stream:
                stream.write(rendered)
            try:
                out.chmod(0o600)
            except OSError:
                pass
        print(rendered, end="")
        return 0 if report["ready_for_production_cutover"] else 2
    except (OSError, ValueError) as exc:
        parser.exit(1, f"cutover gate failed: {exc}\n")

if __name__ == "__main__":
    raise SystemExit(main())
