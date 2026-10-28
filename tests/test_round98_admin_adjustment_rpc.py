import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')
ADMIN = (ROOT / 'admin.html').read_text(encoding='utf-8')

class Round98AdminAdjustmentRpcTests(unittest.TestCase):
    def test_rpc_mode_is_atomic_and_never_falls_back(self):
        start = API.index("if (sub === 'user/balance' && method === 'POST')")
        end = API.index("if (sub === 'user/freeze' && method === 'POST')", start)
        route = API[start:end]
        rpc = route
        self.assertIn("/rpc/admin_adjustment_atomic", rpc)
        self.assertIn("p_request_id: requestId", rpc)
        self.assertIn("p_request_hash: requestHash", rpc)
        self.assertIn("FINANCIAL_RPC_NOT_CONFIGURED", rpc)
        self.assertIn("FINANCIAL_RPC_UNAVAILABLE", rpc)
        self.assertNotIn("saveDB(db)", rpc)
        self.assertNotIn("u.balances[coin].free =", rpc)

    def test_admin_ui_supplies_reason_and_unique_request_id(self):
        self.assertIn("request_id:requestId", ADMIN)
        self.assertIn("reason:reason.trim()", ADMIN)
        self.assertIn("crypto.randomUUID", ADMIN)

if __name__ == '__main__':
    unittest.main()
