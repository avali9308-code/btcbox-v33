import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')
SQL = (ROOT / 'supabase/sql/financial_admin_manual_deposit_v1.sql').read_text(encoding='utf-8')

class Round82ManualDepositRpcCutoverTests(unittest.TestCase):
    def test_rpc_is_explicit_opt_in(self):
        self.assertIn("process.env.FINANCIAL_POSTGRES_RPC_ENABLED === '1'", API)
        self.assertIn('FINANCIAL_CUTOVER_INCOMPLETE', API)
        self.assertIn('Partial financial cutover is deliberately blocked', API)
        self.assertIn('FINANCIAL_CUTOVER_INCOMPLETE', API)

    def test_rpc_requires_full_cutover_and_fails_closed_without_legacy_fallback(self):
        deposit_start = API.index("if (sub === 'deposit/confirm' && method === 'POST')")
        route_end = API.index("// POST /api/admin/withdraw/approve", deposit_start)
        route = API[deposit_start:route_end]
        self.assertIn('FINANCIAL_CUTOVER_INCOMPLETE', route)
        self.assertIn('financialWritesEnabled()', route)
        self.assertIn('rpc/admin_manual_deposit_atomic', route)
        self.assertIn('FINANCIAL_RPC_UNAVAILABLE', route)
        self.assertNotIn('await saveDB(db)', route)
        self.assertNotIn('u.balances[coin].free = after', route)

    def test_rpc_uses_server_side_credentials_and_audit_identity(self):
        self.assertIn('SUPABASE_SERVICE_ROLE_KEY', API)
        self.assertIn("process.env.ADMIN_USER", API)
        self.assertIn('rpc/admin_manual_deposit_atomic', API)
        self.assertIn('financialWritesEnabled()', API)

    def test_duplicate_rpc_result_returns_current_available_balance(self):
        self.assertIn("'available', coalesce(v_available, 0)", SQL)

if __name__ == '__main__':
    unittest.main()
