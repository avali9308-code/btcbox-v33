import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Round142GetReadOnlyTests(unittest.TestCase):
    def test_admin_get_does_not_mutate_financial_balances(self):
        source = (ROOT / "server.py").read_text(encoding="utf-8")
        start = source.index('            # GET requests must remain read-only.')
        end = source.index('            user_detail_html = ""', start)
        block = source[start:end]
        self.assertIn("GET requests must remain read-only", block)
        self.assertIn("PostgreSQL 原子调整服务", block)
        self.assertNotIn('target_user["balances"][coin_adj] =', block)
        self.assertNotIn("persist_financial_change(", block)
        self.assertNotIn('log_action(adjust_uid, "admin_balance_adjust"', block)

    def test_admin_get_adjustment_query_is_non_mutating(self):
        source = (ROOT / "server.py").read_text(encoding="utf-8")
        self.assertIn('adjust_uid = qs.get("adjust_uid", [""])[0]', source)
        self.assertIn('if adjust_uid:\n                adjust_msg = "余额调整已停用', source)


if __name__ == "__main__":
    unittest.main()
