import unittest
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import financial_cutover_gate as gate
class Round127FinancialCutoverTests(unittest.TestCase):
    def test_legacy_python_balance_writers_are_zero_but_live_cutover_stays_blocked(self):
        report = gate.evaluate(ROOT)
        self.assertEqual(report["legacy_writer_count"], 0)
        self.assertNotIn("legacy_balance_or_frozen_mutations_remain", report["blocking_findings"])
        self.assertIn("live_postgres_validation_required", report["blocking_findings"])
        self.assertFalse(report["ready_for_production_cutover"])
        self.assertFalse(report["live_database_checked"])
    def test_matching_schema_does_not_claim_nonzero_fee_support(self):
        sql = (ROOT / "supabase/sql/financial_matching_engine_v1.sql").read_text()
        self.assertIn("check (maker_fee_rate = 0)", sql)
        self.assertIn("check (taker_fee_rate = 0)", sql)
        self.assertIn("static absolute bounds", sql)
    def test_writer_inventory_confirms_no_direct_legacy_balance_writes(self):
        report = gate.evaluate(ROOT)
        self.assertEqual(report["legacy_writer_count"], 0)
        source = (ROOT / "server.py").read_text(encoding="utf-8")
        self.assertIn("def do_order", source)
        self.assertIn("def admin_review_withdraw", source)
        self.assertIn("旧版提现审核已永久停用", source)
if __name__ == "__main__": unittest.main()
