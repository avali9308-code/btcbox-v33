import pathlib
import unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
SQL = (ROOT / 'supabase/sql/financial_earn_redemption_idempotency_v4.sql').read_text()

class Round70EarnRedemptionTests(unittest.TestCase):
    def test_request_replay_requires_same_key_and_hash(self):
        self.assertIn('v_position.redeem_request_id = p_request_id', SQL)
        self.assertIn('v_position.redeem_request_hash IS DISTINCT FROM p_request_hash', SQL)

    def test_one_request_key_cannot_be_used_for_two_positions(self):
        self.assertIn('earn_positions_redeem_request_id_uq', SQL)
        self.assertIn('WHERE redeem_request_id = p_request_id', SQL)

    def test_status_operation_and_fingerprint_are_updated_in_one_rpc(self):
        self.assertIn('redeem_operation_id = v_operation_id', SQL)
        self.assertIn('redeem_request_id = p_request_id', SQL)
        self.assertIn('redeem_request_hash = p_request_hash', SQL)
        self.assertIn("status = 'redeemed'", SQL)

    def test_money_moving_rpc_is_service_role_only(self):
        self.assertIn('FROM PUBLIC, anon, authenticated', SQL)
        self.assertIn('TO service_role', SQL)

if __name__ == '__main__': unittest.main()
