import unittest
from pathlib import Path
import server
class Round123LegacyWalletRuntimeGuardTests(unittest.TestCase):
    def test_legacy_wallet_runtime_flag_and_writer_switch_are_removed(self):
        source = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")
        self.assertFalse(hasattr(server, "legacy_financial_writes_enabled"))
        self.assertNotIn("BTCBOX_LEGACY_FINANCIAL_WRITES_ENABLED", source)
    def test_demo_trade_writer_is_permanently_retired_in_all_runtime_modes(self):
        user = {"uid": "round123", "balances": {"USDT": 1000, "BTC": 0}, "orders": []}
        before = {"uid": "round123", "balances": {"USDT": 1000, "BTC": 0}, "orders": []}
        ok, message, _ = server.do_order(user, {"side": "buy", "symbol": "BTCUSDT", "order_type": "limit", "price": 50000, "qty": 0.001})
        self.assertFalse(ok); self.assertIn("永久停用", message); self.assertEqual(user, before)
if __name__ == "__main__": unittest.main()
