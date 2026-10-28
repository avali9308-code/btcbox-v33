import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')


def route_block(start_marker, end_marker):
    start = API.index(start_marker)
    end = API.index(end_marker, start + len(start_marker))
    return API[start:end]


class UnconditionalFinancialInterlockTests(unittest.TestCase):
    def test_earn_route_uses_atomic_rpc_and_requires_full_cutover(self):
        route = route_block("if (path === 'earn' && method === 'POST')", "if (path === 'support/chat' && method === 'POST')")
        self.assertIn("code: 'FINANCIAL_CUTOVER_INCOMPLETE'", route)
        self.assertIn("rpc/subscribe_earn_atomic", route)
        self.assertIn("rpc/redeem_earn_atomic", route)
        self.assertIn('financialWritesEnabled()', route)
        self.assertNotIn('await saveDB(db)', route)
        self.assertNotIn('user.balances.USDT.free -= amount', route)

    def test_manual_deposit_uses_atomic_rpc_and_has_no_legacy_balance_fallback(self):
        route = route_block("if (sub === 'deposit/confirm' && method === 'POST')", "// POST /api/admin/withdraw/approve")
        self.assertIn("code: 'FINANCIAL_CUTOVER_INCOMPLETE'", route)
        self.assertIn('rpc/admin_manual_deposit_atomic', route)
        self.assertIn('financialWritesEnabled()', route)
        self.assertNotIn('u.balances[coin].free = after', route)
        self.assertNotIn('await saveDB(db)', route)

    def test_spot_order_remains_disabled_without_matching_engine(self):
        route = route_block("if (path === 'order' && method === 'POST')", "// ---------- POST /api/earn")
        self.assertIn("code: 'MATCHING_ENGINE_UNAVAILABLE'", route)
        self.assertIn('Never simulate fills', route)


if __name__ == '__main__':
    unittest.main()
