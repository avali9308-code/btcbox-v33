import pathlib
import unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVER = (ROOT / 'server.py').read_text(encoding='utf-8')
class Round71EarnEndpointContractTests(unittest.TestCase):
    def test_legacy_earn_endpoint_fails_closed_without_balance_mutation(self):
        start = SERVER.index('        if p == "/api/earn":'); end = SERVER.index('        if p == "/api/kyc":', start)
        block = SERVER[start:end]
        self.assertIn('FINANCIAL_RPC_UNAVAILABLE', block); self.assertIn('}, 503)', block)
        self.assertNotIn('user["balances"]', block); self.assertNotIn('earn_records', block)
    def test_postgres_earn_policy_and_atomic_rpc_remain_available(self):
        sql = (ROOT / 'supabase/sql/financial_earn_policy_v5.sql').read_text(encoding='utf-8')
        self.assertIn('redeem_earn_atomic', sql); self.assertIn('subscribe_earn_atomic', sql)
        db = (ROOT / 'financial_db.py').read_text(encoding='utf-8')
        self.assertIn('def redeem_earn(self, *, position_id, user_id, request_id, request_hash):', db)
    def test_legacy_route_contains_no_interest_or_balance_writer_logic(self):
        start = SERVER.index('        if p == "/api/earn":'); end = SERVER.index('        if p == "/api/kyc":', start)
        block = SERVER[start:end]
        for marker in ('calculate_fixed_interest', 'calculate_demand_interest', 'early_redemption_penalty', 'user[\"balances\"]'):
            self.assertNotIn(marker, block)
if __name__ == '__main__': unittest.main()
