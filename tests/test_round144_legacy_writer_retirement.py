import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import server
from scripts.audit_financial_writers import audit

ROOT = Path(__file__).resolve().parents[1]

class Round144LegacyWriterRetirementTests(unittest.TestCase):
    def test_static_balance_and_frozen_writer_inventory_is_empty(self):
        self.assertEqual(audit(ROOT / "server.py"), [])

    def test_legacy_financial_routes_never_mutate_wallet(self):
        user = {"uid": "round144", "balances": {"USDT": 100, "BTC": 0}, "frozen": {"USDT": 2},
                "orders": [], "withdrawals": [], "earn_records": []}
        before = json.loads(json.dumps(user))
        for fn, args in (
            (server.do_order, (user, {"side": "buy", "symbol": "BTCUSDT", "price": 1, "qty": 1})),
            (server.do_withdraw, (user, {"coin": "USDT", "amount": 10})),
        ):
            ok, message, _ = fn(*args)
            self.assertFalse(ok)
            self.assertIn("永久停用", message)
            self.assertEqual(user, before)
        ok, message = server.admin_review_withdraw(1, True, "admin")
        self.assertFalse(ok)
        self.assertIn("永久停用", message)
        self.assertEqual(user, before)

    def test_load_data_preserves_existing_frozen_balances(self):
        payload = {"users": {"u1": {"uid": 1, "frozen": {"USDT": 17.25, "BTC": 0.02}, "balances": {"USDT": 40}}},
                   "seq": {}, "config": {}}
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "data.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with patch.multiple(server, DATA_FILE=str(path), users={}, seq={"user": 1, "order": 1, "withdraw": 1, "deposit": 1},
                                chat_messages=[], chat_seq={"msg": 1}, ADMIN_PASS="test"):
                server.load_data()
                self.assertEqual(server.users["u1"]["frozen"], {"USDT": 17.25, "BTC": 0.02})

    def test_old_boolean_frozen_field_migrates_to_account_flag_without_balance_write(self):
        payload = {"users": {"u1": {"uid": 1, "frozen": True, "balances": {"USDT": 40}}}, "seq": {}, "config": {}}
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "data.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with patch.multiple(server, DATA_FILE=str(path), users={}, seq={"user": 1, "order": 1, "withdraw": 1, "deposit": 1},
                                chat_messages=[], chat_seq={"msg": 1}, ADMIN_PASS="test"):
                server.load_data()
                self.assertTrue(server.users["u1"]["frozen_account"])
                self.assertIsInstance(server.users["u1"]["frozen"], dict)
                self.assertEqual(server.users["u1"]["balances"]["USDT"], 40)

if __name__ == "__main__":
    unittest.main()
