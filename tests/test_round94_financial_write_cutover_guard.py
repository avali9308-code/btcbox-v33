import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')

class Round94FinancialWriteCutoverGuardTests(unittest.TestCase):
    def assert_guard_before(self, start, end, mutation_markers):
        route = API[API.index(start):API.index(end, API.index(start))]
        guard = route.index("code: 'FINANCIAL_CUTOVER_INCOMPLETE'")
        for marker in mutation_markers:
            with self.subTest(marker=marker):
                self.assertLess(guard, route.index(marker))
        self.assertIn('financialWritesEnabled()', route[:guard])
        self.assertIn('}, 503)', route[guard:])

    def test_user_withdraw_uses_atomic_rpc_and_rpc_branch_returns_before_legacy_mutation(self):
        start = API.index("if (path === 'withdraw' && method === 'POST')")
        end = API.index("// ---------- GET /api/market", start)
        route = API[start:end]
        rpc = route.index("rpc/create_withdrawal_atomic")
        self.assertIn('financialWritesEnabled()', route)
        self.assertIn('FINANCIAL_RPC_UNAVAILABLE', route)
        self.assertNotIn('user.balances[coin].free -= totalDebit', route)
        self.assertNotIn('await saveDB(db)', route)

    def test_earn_subscribe_and_redeem_use_atomic_rpc_and_require_full_cutover(self):
        start = "if (path === 'earn' && method === 'POST')"
        end = "if (path === 'support/chat' && method === 'POST')"
        route = API[API.index(start):API.index(end, API.index(start))]
        guard = route.index("code: 'FINANCIAL_CUTOVER_INCOMPLETE'")
        self.assertIn('financialWritesEnabled()', route[:guard])
        self.assertIn('financialWritesEnabled()', route[:guard])
        self.assertLess(route.index('rpc/subscribe_earn_atomic'), route.index("return json({ ok: true, duplicate: !!result.duplicate"))
        self.assertIn('rpc/redeem_earn_atomic', route)
        self.assertNotIn('await saveDB(db)', route)
        self.assertNotIn('user.balances.USDT.free -= amount', route)

    def test_admin_withdraw_transitions_use_rpc_before_legacy_mutation(self):
        approve_start = API.index("if (sub === 'withdraw/approve' && method === 'POST')")
        approve_end = API.index("if (sub === 'withdraw/reject' && method === 'POST')", approve_start)
        approve = API[approve_start:approve_end]
        self.assertIn('rpc/review_withdrawal_atomic', approve)
        self.assertNotIn('balance.frozen -= held', approve)
        self.assertNotIn('await saveDB(db)', approve)
        reject_start = approve_end
        reject_end = API.index("if (sub === 'kyc/approve' && method === 'POST')", reject_start)
        reject = API[reject_start:reject_end]
        self.assertIn('rpc/review_withdrawal_atomic', reject)
        self.assertNotIn('balance.frozen -= held', reject)
        self.assertNotIn('await saveDB(db)', reject)

    def test_spot_endpoint_remains_fail_closed_without_matching_engine(self):
        start = API.index("if (path === 'order' && method === 'POST')")
        end = API.index("// ---------- POST /api/earn", start)
        route = API[start:end]
        self.assertIn('MATCHING_ENGINE_UNAVAILABLE', route)
        self.assertIn('Never simulate fills or mutate customer balances', route)
        self.assertNotIn('await saveDB(db)', route)

if __name__ == '__main__':
    unittest.main()
