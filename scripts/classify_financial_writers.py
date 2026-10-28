#!/usr/bin/env python3
"""Classify direct legacy balance writes by code path and operational meaning.

Static source analysis only. It does not prove deployment reachability or database state.
"""
from __future__ import annotations
import json
from pathlib import Path
from audit_financial_writers import audit

ROOT = Path(__file__).resolve().parents[1]
CLASSIFICATIONS = {
    "load_data": ("normalization", "Legacy JSON load-time compatibility normalization; not a customer funds movement.", "Retain only while legacy JSON mode exists; remove with the legacy store."),
    "do_order": ("legacy_simulated_trade_writer", "Directly changes two in-memory balances and records simulated fills.", "Do not expose as real trading. Replace with trusted matcher plus atomic PostgreSQL trade settlement."),
    "do_withdraw": ("legacy_withdrawal_writer", "Moves available balance to frozen balance and creates a pending withdrawal in legacy state.", "Retire after the atomic withdrawal RPC is deployed and reconciled."),
    "admin_review_withdraw": ("legacy_withdrawal_lifecycle_writer", "Approves/rejects withdrawal by changing frozen/available balances in legacy state.", "Replace with one atomic lifecycle RPC and audited state transition."),
    "do_GET": ("legacy_admin_balance_adjustment", "Admin GET/action handler mutates a user's balance in legacy state.", "Remove legacy branch; use authenticated admin adjustment RPC only."),
    "do_POST": ("legacy_earn_balance_writer", "Legacy earn subscribe/redeem paths adjust USDT directly in legacy state.", "Replace with subscribe/redeem RPCs and ledger-backed reads; no fallback."),
}

def main() -> int:
    writers = audit(ROOT / "server.py")
    rows = []
    for item in writers:
        classification, meaning, action = CLASSIFICATIONS.get(
            item["function"], ("unclassified", "No rule matched this writer.", "Manual review required.")
        )
        rows.append({**item, "classification": classification, "runtime_boundary": "server.py legacy JSON path; distinct from Netlify Functions API", "meaning": meaning, "required_action": action})
    report = {
        "report_version": 1,
        "source": "server.py",
        "analysis": "AST static classification; does not prove deployment reachability",
        "live_database_checked": False,
        "legacy_json_mode_only": True,
        "writer_count": len(rows),
        "classification_counts": {k: sum(1 for r in rows if r["classification"] == k) for k in sorted({r["classification"] for r in rows})},
        "writers": rows,
        "decision": "BLOCK_PRODUCTION_CUTOVER_UNTIL_STAGING_EVIDENCE_AND_HISTORICAL_RECONCILIATION_ARE_APPROVED",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if all(r["classification"] != "unclassified" for r in rows) else 2

if __name__ == "__main__":
    raise SystemExit(main())
