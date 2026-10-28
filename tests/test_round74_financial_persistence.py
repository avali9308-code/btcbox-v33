import contextlib
import io
import json
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import server


class Round74FinancialPersistenceTests(unittest.TestCase):
    def test_save_data_atomically_writes_valid_json_and_returns_true(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.json"
            with patch.multiple(server, DATA_FILE=str(path), users={"u1": {"uid": 1}},
                                seq={"user": 2}, ADMIN_PASS="test-pass", chat_messages=[],
                                CONFIG={"deposit_addresses": {}, "notice": "", "maintenance": False,
                                        "maintenanceMsg": ""}):
                self.assertTrue(server.save_data())
                saved = json.loads(path.read_text(encoding="utf-8"))
                self.assertIn("u1", saved["users"])
                self.assertEqual(saved["seq"]["user"], 2)
                self.assertFalse(Path(str(path) + ".tmp").exists())

    def test_save_data_rejects_nan_without_replacing_previous_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.json"
            path.write_text('{"previous": true}', encoding="utf-8")
            with patch.multiple(server, DATA_FILE=str(path), users={"u1": {"balance": math.nan}},
                                seq={"user": 2}, ADMIN_PASS="test-pass", chat_messages=[],
                                CONFIG={"deposit_addresses": {}, "notice": "", "maintenance": False,
                                        "maintenanceMsg": ""}):
                # This failure is intentional: NaN must never be persisted as JSON.
                # Capture the expected diagnostic so a passing test run stays clean.
                diagnostic = io.StringIO()
                with contextlib.redirect_stderr(diagnostic):
                    self.assertFalse(server.save_data())
                self.assertIn("Out of range float values are not JSON compliant", diagnostic.getvalue())
            self.assertEqual(path.read_text(encoding="utf-8"), '{"previous": true}')
            self.assertFalse(Path(str(path) + ".tmp").exists())

    def test_persistence_failure_restores_user_and_sequence_snapshot(self):
        user = {"uid": 1, "balances": {"USDT": 100.0}, "orders": [{"id": 1}]}
        before_user = {"uid": 1, "balances": {"USDT": 100.0}, "orders": [{"id": 1}]}
        seq_before = dict(server.seq)
        seq_after = dict(seq_before)
        seq_after["order"] = seq_after.get("order", 0) + 1
        with patch.object(server, "save_data", return_value=False):
            self.assertFalse(server.persist_financial_change(user, before_user, seq_before))
        self.assertEqual(user, before_user)
        self.assertEqual(server.seq, seq_before)

    def test_legacy_spot_order_is_retired_without_mutating_wallet(self):
        user = {"uid": 990001, "balances": {"USDT": 1000.0, "BTC": 0.0}, "orders": [], "withdrawals": [], "deposits": [], "earn_records": []}
        before = json.loads(json.dumps(user)); original_seq = dict(server.seq)
        ok, msg, _ = server.do_order(user, {"side": "buy", "symbol": "BTCUSDT", "order_type": "limit", "price": "50000", "qty": "0.001"})
        self.assertFalse(ok); self.assertIn("永久停用", msg); self.assertEqual(user, before); self.assertEqual(server.seq, original_seq)

    def test_legacy_order_and_withdrawal_writers_are_absent(self):
        source = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")
        for name in ("do_order", "do_withdraw", "admin_review_withdraw"):
            start = source.index(f"def {name}(")
            end = source.find("\ndef ", start + 5)
            body = source[start:end if end >= 0 else len(source)]
            self.assertIn("永久停用", body, name)
            self.assertNotIn('user["balances"]', body, name)
            self.assertNotIn('u["balances"]', body, name)

    def test_spot_order_rejects_all_requests_until_postgres_matcher_is_enabled(self):
        user = {"uid": 990002, "balances": {"USDT": 1000.0, "BTC": 0.0}, "orders": [], "withdrawals": [], "frozen": {}}
        ok, msg, _ = server.do_order(user, {"side": "buy", "symbol": "MADEUPUSDT", "order_type": "limit", "price": "50000", "qty": "NaN"})
        self.assertFalse(ok); self.assertIn("永久停用", msg); self.assertEqual(user["balances"], {"USDT": 1000.0, "BTC": 0.0})

    def test_withdrawal_writer_is_retired_before_any_balance_mutation(self):
        user = {"uid": 990004, "balances": {"USDT": 100.0}, "frozen": {"USDT": 0.0}, "withdrawals": [], "fund_pwd_hash": "hash", "fund_pwd_salt": "salt", "twofa_enabled": False}
        before = json.loads(json.dumps(user))
        ok, msg, _ = server.do_withdraw(user, {"fund_password": "test", "coin": "USDT", "address": "T123456789012345", "network": "TRC20", "amount": "20"})
        self.assertFalse(ok); self.assertIn("永久停用", msg); self.assertEqual(user, before)

    def test_legacy_deposit_request_is_retired_without_creating_json_records(self):
        user = {"uid": 990005, "balances": {"USDT": 0.0}, "frozen": {"USDT": 0.0},
                "orders": [], "withdrawals": [], "deposits": [], "deposit_address": {}}
        before = json.loads(json.dumps(user)); original_seq = dict(server.seq)
        ok, msg, _ = server.do_deposit(user, {"coin": "USDT", "network": "TRC20", "amount": "20"})
        self.assertFalse(ok); self.assertIn("永久停用", msg)
        self.assertEqual(user, before); self.assertEqual(server.seq, original_seq)

    def test_legacy_deposit_endpoint_does_not_generate_placeholder_addresses(self):
        user = {"uid": 990003, "balances": {"USDT": 0.0}, "frozen": {},
                "orders": [], "withdrawals": [], "deposits": [], "deposit_address": {}}
        before = json.loads(json.dumps(user))
        ok, msg, _ = server.do_deposit(user, {"coin": "USDT", "network": "TRC20", "amount": "0"})
        self.assertFalse(ok); self.assertIn("永久停用", msg); self.assertEqual(user, before)


if __name__ == "__main__":
    unittest.main()
