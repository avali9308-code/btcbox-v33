import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Round78ManualDepositTests(unittest.TestCase):
    def test_admin_manual_deposit_uses_atomic_rpc_not_legacy_balance_mutation(self):
        source = (ROOT / "netlify/functions/api.js").read_text(encoding="utf-8")
        start = source.index("// POST /api/admin/deposit/confirm — explicit administrator manual credit.")
        end = source.index("// POST /api/admin/withdraw/approve", start)
        handler = source[start:end]
        self.assertIn("rpc/admin_manual_deposit_atomic", handler)
        self.assertIn("financialWritesEnabled()", handler)
        self.assertIn("amount <= 0", handler)
        self.assertIn("idempotency_key", handler)
        self.assertIn("requestHash", handler)
        self.assertNotIn("u.balances[coin].free = after", handler)
        self.assertNotIn("await saveDB(db)", handler)

    def test_admin_ui_offers_manual_deposit_with_confirmation(self):
        source = (ROOT / "admin.html").read_text(encoding="utf-8")
        self.assertIn("function manualDeposit(uid)", source)
        self.assertIn("admin/deposit/confirm", source)
        self.assertIn("此操作会立即增加可用余额", source)
        self.assertIn("idempotency_key:requestKey", source)


if __name__ == "__main__":
    unittest.main()
