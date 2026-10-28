import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')


class Round92FinancialStateConsistencyTests(unittest.TestCase):
    def test_manual_credit_requires_full_cutover_and_uses_atomic_rpc(self):
        route_start = API.index("if (sub === 'deposit/confirm'")
        route_end = API.index("// POST /api/admin/withdraw/approve", route_start)
        route = API[route_start:route_end]
        self.assertIn("code: 'FINANCIAL_CUTOVER_INCOMPLETE'", route)
        self.assertIn('financialWritesEnabled()', route)
        self.assertIn('rpc/admin_manual_deposit_atomic', route)
        self.assertIn('FINANCIAL_RPC_UNAVAILABLE', route)
        self.assertNotIn('await saveDB(db)', route)
        self.assertNotIn('u.balances[coin].free = after', route)

    def test_cutover_guard_explains_dual_authority_risk(self):
        self.assertIn('stale balances/history', API)
        self.assertIn('financialWritesEnabled()', API)

    def test_legacy_manual_credit_writer_has_been_removed(self):
        route_start = API.index("if (sub === 'deposit/confirm'")
        route_end = API.index("// POST /api/admin/withdraw/approve", route_start)
        route = API[route_start:route_end]
        self.assertNotIn('previous.idempotency_hash !== requestHash', route)
        self.assertNotIn('await saveDB(db)', route)
        self.assertIn('rpc/admin_manual_deposit_atomic', route)


if __name__ == '__main__':
    unittest.main()
