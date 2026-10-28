import unittest
from pathlib import Path
from unittest.mock import patch

import server


class Round77DepositSafetyTests(unittest.TestCase):
    def test_legacy_admin_confirmation_never_credits_unverified_pending_deposit(self):
        user = {
            "uid": 770001,
            "balances": {"USDT": 12.5},
            "deposits": [{"id": 77001, "coin": "USDT", "network": "TRC20",
                          "amount": 900.0, "status": "pending"}],
        }
        before = {"balances": dict(user["balances"]), "deposits": [dict(user["deposits"][0])]}
        with patch.object(server, "users", {str(user["uid"]): user}):
            ok, msg = server.admin_confirm_deposit(77001, "admin")
        self.assertFalse(ok)
        self.assertIn("链上交易验证", msg)
        self.assertEqual(user["balances"], before["balances"])
        self.assertEqual(user["deposits"], before["deposits"])

    def test_legacy_admin_confirmation_does_not_trust_forged_chain_flag_alone(self):
        user = {
            "uid": 770002,
            "balances": {"USDT": 0.0},
            "deposits": [{"id": 77002, "coin": "USDT", "network": "TRC20",
                          "amount": 10.0, "status": "pending", "chain_verified": True}],
        }
        with patch.object(server, "users", {str(user["uid"]): user}):
            ok, _ = server.admin_confirm_deposit(77002, "admin")
        self.assertFalse(ok)
        self.assertEqual(user["balances"]["USDT"], 0.0)
        self.assertEqual(user["deposits"][0]["status"], "pending")

    def test_admin_page_does_not_offer_manual_credit_button_for_pending_deposits(self):
        source = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")
        self.assertIn("待链上验证", source)
        self.assertIn("等待链上验证", source)
        self.assertIn("禁止人工入账", source)
        self.assertNotIn("<button>确认到账</button>", source)


if __name__ == "__main__":
    unittest.main()
