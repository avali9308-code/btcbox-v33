import os
import unittest
from pathlib import Path
from unittest.mock import patch

import server


class Round113LegacyWalletInterlockTests(unittest.TestCase):
    def test_legacy_wallet_writer_feature_flag_has_been_removed(self):
        source = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")
        self.assertNotIn("BTCBOX_LEGACY_FINANCIAL_WRITES_ENABLED", source)
        self.assertFalse(hasattr(server, "legacy_financial_writes_enabled"))

    def test_order_and_withdraw_fail_closed_before_mutation(self):
        order_user = {"uid": "round113-order", "balances": {"USDT": 1000.0, "BTC": 0.0},
                      "orders": [], "withdrawals": [], "frozen": {}}
        before_order = {k: (v.copy() if isinstance(v, dict) else list(v) if isinstance(v, list) else v)
                        for k, v in order_user.items()}
        with patch.dict(os.environ, {}, clear=False):
            ok, msg, _ = server.do_order(order_user, {
                "side": "buy", "symbol": "BTCUSDT", "order_type": "limit",
                "price": "50000", "qty": "0.001"
            })
        self.assertFalse(ok)
        self.assertIn("永久停用", msg)
        self.assertEqual(order_user, before_order)

        withdraw_user = {"uid": "round113-withdraw", "balances": {"USDT": 100.0},
                         "frozen": {"USDT": 0.0}, "withdrawals": [],
                         "fund_pwd_hash": "hash", "fund_pwd_salt": "salt", "twofa_enabled": False}
        before_withdraw = {k: (v.copy() if isinstance(v, dict) else list(v) if isinstance(v, list) else v)
                           for k, v in withdraw_user.items()}
        with patch.object(server, "rate_limit", return_value=True), patch.object(server, "verify_password", return_value=True):
            ok, msg, _ = server.do_withdraw(withdraw_user, {
                "fund_password": "test", "coin": "USDT", "address": "T123456789012345",
                "network": "TRC20", "amount": "20"
            })
        self.assertFalse(ok)
        self.assertIn("永久停用", msg)
        self.assertEqual(withdraw_user, before_withdraw)

    def test_admin_withdrawal_review_fails_closed(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BTCBOX_LEGACY_FINANCIAL_WRITES_ENABLED", None)
            ok, msg = server.admin_review_withdraw(1, True, "admin")
        self.assertFalse(ok)
        self.assertIn("永久停用", msg)

    def test_interlock_is_documented_in_runtime_source(self):
        source = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")
        self.assertIn("旧版模拟交易钱包已永久停用", source)
        self.assertNotIn("BTCBOX_LEGACY_FINANCIAL_WRITES_ENABLED", source)


if __name__ == "__main__":
    unittest.main()
