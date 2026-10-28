"""Static contracts for the primary PostgreSQL financial API paths.

These checks prevent accidental removal of RPC routing or reintroduction of a
legacy fallback. They are not substitutes for disposable-Postgres integration tests.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / "netlify/functions/api.js").read_text(encoding="utf-8")
LIFECYCLE = (ROOT / "supabase/sql/financial_lifecycle_v2.sql").read_text(encoding="utf-8")
LEDGER = (ROOT / "supabase/sql/financial_ledger_v1.sql").read_text(encoding="utf-8")


class Round116FinancialRouteContractTests(unittest.TestCase):
    def test_withdrawal_rpc_route_and_idempotency_contract(self):
        route = API[API.index("// ---------- POST /api/withdraw ----------"):API.index("// ---------- GET /api/market ----------")]
        self.assertIn("/rest/v1/rpc/create_withdrawal_atomic", route)
        self.assertIn("p_request_id: requestId", route)
        self.assertIn("p_request_hash: requestHash", route)
        self.assertIn("FINANCIAL_RPC_NOT_CONFIGURED", route)
        self.assertIn("FINANCIAL_RPC_UNAVAILABLE", route)
        self.assertIn("数据库未确认提现申请", route)

    def test_withdrawal_review_uses_single_atomic_lifecycle_rpc(self):
        self.assertGreaterEqual(API.count("/rest/v1/rpc/review_withdrawal_atomic"), 2)
        self.assertIn("p_approve: true", API)
        self.assertIn("p_approve: false", API)
        self.assertIn("for update", LIFECYCLE.lower())
        self.assertIn("withdraw_freeze", LIFECYCLE)
        self.assertIn("withdraw_approve", LIFECYCLE)
        self.assertIn("withdraw_reject", LIFECYCLE)

    def test_database_enforces_withdrawal_idempotency_and_nonnegative_balances(self):
        self.assertIn("request_id text not null unique", LEDGER.lower())
        self.assertIn("check (available >= 0)", LEDGER.lower())
        self.assertIn("check (frozen >= 0)", LEDGER.lower())
        self.assertIn("unique (operation_id, user_id, asset)", LEDGER.lower())

    def test_earn_and_admin_adjustment_routes_call_atomic_rpcs(self):
        self.assertIn("/rest/v1/rpc/subscribe_earn_atomic", API)
        self.assertIn("/rest/v1/rpc/redeem_earn_atomic", API)
        self.assertIn("/rest/v1/rpc/admin_adjustment_atomic", API)
        self.assertIn("/rest/v1/rpc/admin_manual_deposit_atomic", API)

    def test_rpc_errors_do_not_trigger_legacy_fallback_in_rpc_branch(self):
        route = API[API.index("// ---------- POST /api/withdraw ----------"):API.index("// ---------- GET /api/market ----------")]
        rpc_branch = route[route.index("if (manualDepositRpcEnabled()) {"):]
        self.assertIn("code: insufficient ? 'INSUFFICIENT_FUNDS' : 'FINANCIAL_RPC_FAILED'", rpc_branch)
        self.assertIn("return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE'", rpc_branch)
        self.assertNotIn("user.balances[coin].free -= totalDebit", rpc_branch)
        self.assertNotIn("await saveDB(db)", rpc_branch)


if __name__ == "__main__":
    unittest.main()
