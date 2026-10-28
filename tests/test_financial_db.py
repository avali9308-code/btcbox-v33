import json
import os
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from financial_db import FinancialDBError, SupabaseFinancialRPC

class FinancialDBTests(unittest.TestCase):
    def test_missing_config_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(FinancialDBError):
                SupabaseFinancialRPC()

    def test_rejects_non_https_endpoint(self):
        with self.assertRaises(FinancialDBError):
            SupabaseFinancialRPC(url='http://example.test', service_key='secret')

    def test_rpc_sends_server_key_and_json_payload(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return b'{"ok":true,"duplicate":false}'
        captured = {}
        def fake_urlopen(req, timeout):
            captured['url'] = req.full_url
            captured['headers'] = dict(req.header_items())
            captured['body'] = json.loads(req.data.decode())
            captured['timeout'] = timeout
            return Response()
        client = SupabaseFinancialRPC(url='https://demo.supabase.co', service_key='server-secret')
        with patch('urllib.request.urlopen', fake_urlopen):
            result = client.review_withdrawal(withdrawal_id='wd-1', admin_id='admin-1', approve=False, reason='test')
        self.assertTrue(result['ok'])
        self.assertEqual(captured['url'], 'https://demo.supabase.co/rest/v1/rpc/review_withdrawal_atomic')
        self.assertEqual(captured['body']['p_admin_id'], 'admin-1')
        self.assertEqual(captured['body']['p_approve'], False)
        self.assertGreater(captured['timeout'], 0)

    def test_spot_trade_rpc_payload_uses_stable_idempotency_key(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return b'{"ok":true,"duplicate":false}'
        captured = {}
        def fake_urlopen(req, timeout):
            captured['url'] = req.full_url
            captured['body'] = json.loads(req.data.decode())
            return Response()
        client = SupabaseFinancialRPC(url='https://demo.supabase.co', service_key='server-secret')
        with patch('urllib.request.urlopen', fake_urlopen):
            result = client.execute_spot_trade(order_id='ord-1', user_id='u-1', base_asset='btc',
                quote_asset='usdt', side='buy', order_type='market', price='60000.10', quantity='0.01',
                idempotency_key='spot-trade-request-0001', request_hash='sha256-test')
        self.assertTrue(result['ok'])
        self.assertEqual(captured['url'], 'https://demo.supabase.co/rest/v1/rpc/execute_spot_trade_atomic')
        self.assertEqual(captured['body']['p_base_asset'], 'BTC')
        self.assertEqual(captured['body']['p_quote_asset'], 'USDT')
        self.assertEqual(captured['body']['p_idempotency_key'], 'spot-trade-request-0001')
        self.assertEqual(captured['body']['p_price'], '60000.10')


    def test_earn_redemption_rpc_does_not_accept_client_payout(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return b'{"ok":true,"duplicate":false,"payout":101.25}'
        captured = {}
        def fake_urlopen(req, timeout):
            captured['url'] = req.full_url
            captured['body'] = json.loads(req.data.decode())
            return Response()
        client = SupabaseFinancialRPC(url='https://demo.supabase.co', service_key='server-secret')
        with patch('urllib.request.urlopen', fake_urlopen):
            result = client.redeem_earn(position_id='earn-1', user_id='u-1',
                request_id='earn-redeem-request-0001', request_hash='sha256-policy')
        self.assertTrue(result['ok'])
        self.assertEqual(captured['url'], 'https://demo.supabase.co/rest/v1/rpc/redeem_earn_atomic')
        self.assertEqual(captured['body']['p_request_id'], 'earn-redeem-request-0001')
        self.assertNotIn('p_payout', captured['body'])

    def test_chain_deposit_verification_sends_canonical_hash_and_requires_finality(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return b'{"ok":true,"duplicate":false,"status":"confirmed"}'
        captured = {}
        def fake_urlopen(req, timeout):
            captured['url'] = req.full_url
            captured['body'] = json.loads(req.data.decode())
            return Response()
        client = SupabaseFinancialRPC(url='https://demo.supabase.co', service_key='server-secret')
        with patch('urllib.request.urlopen', fake_urlopen):
            result = client.verify_and_credit_deposit(deposit_id='dep-1', verifier_id='chain-verifier',
                txid='ABCDEF0123456789', asset='usdt', network='trc20', observed_amount='25.000000000000000000',
                confirmations=20, required_confirmations=19, request_id='deposit-chain-request-0001')
        self.assertTrue(result['ok'])
        self.assertEqual(captured['url'], 'https://demo.supabase.co/rest/v1/rpc/verify_and_credit_deposit_atomic')
        self.assertEqual(captured['body']['p_txid'], 'abcdef0123456789')
        self.assertEqual(captured['body']['p_observed_amount'], '25.000000000000000000')
        self.assertEqual(len(captured['body']['p_request_hash']), 64)

    def test_chain_deposit_verification_rejects_insufficient_confirmations_before_rpc(self):
        client = SupabaseFinancialRPC(url='https://demo.supabase.co', service_key='server-secret')
        with patch('urllib.request.urlopen') as mocked:
            with self.assertRaisesRegex(FinancialDBError, 'insufficient confirmations'):
                client.verify_and_credit_deposit(deposit_id='dep-1', verifier_id='chain-verifier',
                    txid='ABCDEF0123456789', asset='USDT', network='TRC20', observed_amount='25',
                    confirmations=2, required_confirmations=12, request_id='deposit-chain-request-0001')
            mocked.assert_not_called()

    def test_chain_deposit_verification_rejects_precision_loss(self):
        client = SupabaseFinancialRPC(url='https://demo.supabase.co', service_key='server-secret')
        with patch('urllib.request.urlopen') as mocked:
            with self.assertRaisesRegex(FinancialDBError, '18-decimal precision'):
                client.verify_and_credit_deposit(deposit_id='dep-1', verifier_id='chain-verifier',
                    txid='ABCDEF0123456789', asset='USDT', network='TRC20', observed_amount='1.0000000000000000001',
                    confirmations=12, required_confirmations=12, request_id='deposit-chain-request-0001')
            mocked.assert_not_called()

    def test_transport_failure_is_unknown_outcome_not_success(self):
        client = SupabaseFinancialRPC(url='https://demo.supabase.co', service_key='server-secret')
        with patch('urllib.request.urlopen', side_effect=TimeoutError()):
            with self.assertRaisesRegex(FinancialDBError, 'outcome may be unknown'):
                client.confirm_deposit(deposit_id='dep-1', admin_id='admin-1')

if __name__ == '__main__':
    unittest.main()
