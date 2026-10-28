import os
import sys
import unittest
ROOT = os.path.dirname(os.path.dirname(__file__)); sys.path.insert(0, ROOT)
class Round72EarnAssetGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = __import__('pathlib').Path(os.path.join(ROOT, 'server.py')).read_text(encoding='utf-8')
        cls.db = __import__('pathlib').Path(os.path.join(ROOT, 'financial_db.py')).read_text(encoding='utf-8')
        cls.sql = __import__('pathlib').Path(os.path.join(ROOT, 'supabase/sql/financial_earn_policy_v5.sql')).read_text(encoding='utf-8')
    def test_legacy_endpoint_is_disabled_for_all_assets(self):
        start = self.server.index('        if p == "/api/earn":'); end = self.server.index('        if p == "/api/kyc":', start)
        block = self.server[start:end]
        self.assertIn('FINANCIAL_RPC_UNAVAILABLE', block); self.assertIn('}, 503)', block)
        self.assertNotIn('product_asset', block)
    def test_database_catalog_defines_product_asset_and_precision(self):
        self.assertIn("('flex_BTC',  'BTC',  'demand'", self.sql); self.assertIn("('flex_ETH',  'ETH',  'demand'", self.sql)
        self.assertIn('amount_scale smallint', self.sql); self.assertIn('earn product asset mismatch', self.sql)
        self.assertIn('historical redeemed earn positions lack complete idempotency metadata', self.sql)
    def test_database_computes_redemption_without_client_payout(self):
        self.assertIn('CREATE OR REPLACE FUNCTION public.redeem_earn_atomic(', self.sql)
        self.assertIn('DROP FUNCTION IF EXISTS public.redeem_earn_atomic(text,text,numeric,text,text)', self.sql)
        self.assertIn('v_payout := v_position.principal + v_interest', self.sql)
        self.assertNotIn('"p_payout"', self.db); self.assertIn('def redeem_earn(self, *, position_id, user_id, request_id, request_hash):', self.db)
    def test_position_snapshots_product_policy_and_subscription_hash(self):
        self.assertIn('subscribe_request_hash text', self.sql); self.assertIn('v_existing.subscribe_request_hash <> p_request_hash', self.sql)
        self.assertIn('earn position identity and policy snapshot are immutable', self.sql)
        self.assertIn('v_product.apy_percent,v_product.term_days,v_product.early_fee_percent,v_product.amount_scale,p_request_hash', self.sql)
if __name__ == '__main__': unittest.main()
