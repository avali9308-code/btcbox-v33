#!/usr/bin/env python3
"""Static inventory of financial read paths still backed by legacy btcbox_state.

This is intentionally conservative: source markers identify known response shapes,
not runtime behavior or proof of production data consistency. Any missing marker is
reported as unresolved rather than assumed migrated.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path

READ_PATHS = {
    "authenticated_user_balances_and_history": {
        "marker": "const accountBalances = financialSnapshot ? financialSnapshot.balances : user.balances;",
        "description": "Authenticated account still has a legacy balance fallback; normalized read is opt-in and not live-verified",
        "source": "netlify/functions/api.js",
        "authoritative_source": "btcbox_state",
    },
    "admin_pending_withdrawals": {
        "marker": "if (sub === 'withdrawals' && method === 'GET')",
        "description": "Admin pending-withdrawal list is assembled from per-user legacy withdrawal arrays",
        "source": "netlify/functions/api.js",
        "authoritative_source": "btcbox_state",
    },
    "admin_pending_withdrawal_count": {
        "marker": "pending_withdrawals: pendingWd",
        "description": "Admin overview pending count is calculated from legacy user records",
        "source": "netlify/functions/api.js",
        "authoritative_source": "btcbox_state",
    },
    "legacy_user_balance_model": {
        "marker": "balances: emptyBalances()",
        "description": "Legacy application user model initializes and stores balances outside normalized ledger reads",
        "source": "netlify/functions/api.js",
        "authoritative_source": "btcbox_state",
    },
}


def audit(root: Path) -> dict:
    rows = {}
    for key, spec in READ_PATHS.items():
        path = root / spec["source"]
        content = path.read_text(encoding="utf-8") if path.is_file() else ""
        found = spec["marker"] in content
        rows[key] = {
            "source_exists": path.is_file(),
            "marker_found": found,
            "description": spec["description"],
            "source": spec["source"],
            "authoritative_source": spec["authoritative_source"] if found else "unverified",
            "normalized_postgres_read_verified": False,
            "blocks_full_cutover": True,
        }
    unresolved = [key for key, row in rows.items() if not row["marker_found"] or not row["normalized_postgres_read_verified"]]
    return {
        "report_version": 1,
        "audit_type": "financial_read_path_inventory",
        "live_database_checked": False,
        "runtime_requests_executed": False,
        "read_paths": rows,
        "unresolved_read_paths": unresolved,
        "ready_for_full_cutover": not unresolved,
        "note": "Static source inventory only; no live database, identity mapping, or production data was inspected.",
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--output", help="write a new JSON file; refuses to overwrite")
    args = parser.parse_args(argv)
    report = audit(Path(args.root).resolve())
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("x", encoding="utf-8") as f:
            f.write(rendered)
        try: out.chmod(0o600)
        except OSError: pass
    print(rendered, end="")
    return 0 if report["ready_for_full_cutover"] else 2

if __name__ == "__main__":
    raise SystemExit(main())
