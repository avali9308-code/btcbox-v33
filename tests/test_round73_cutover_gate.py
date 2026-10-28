import tempfile
import unittest
from pathlib import Path
from scripts.financial_cutover_gate import evaluate
ROOT = Path(__file__).resolve().parents[1]
class FinancialCutoverGateTests(unittest.TestCase):
    def test_legacy_writers_retired_but_live_cutover_still_blocked(self):
        report = evaluate(ROOT)
        self.assertFalse(report["ready_for_production_cutover"])
        self.assertFalse(report["live_database_checked"])
        self.assertEqual(report["legacy_writer_count"], 0)
        self.assertNotIn("legacy_balance_or_frozen_mutations_remain", report["blocking_findings"])
    def test_missing_sql_artifact_is_blocking(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); (root / "server.py").write_text("balances = {}\n", encoding="utf-8")
            report = evaluate(root)
            self.assertIn("required_financial_sql_artifacts_missing", report["blocking_findings"])
            self.assertFalse(report["ready_for_production_cutover"])
    def test_round75_migration_is_a_required_cutover_artifact(self):
        report = evaluate(ROOT)
        self.assertNotIn("supabase/sql/financial_admin_adjustment_v1.sql", report["missing_required_artifacts"])
    def test_reconciliation_sql_is_read_only_and_reports_both_balance_buckets(self):
        sql = (ROOT / "supabase/sql/financial_ledger_reconciliation_v1.sql").read_text(encoding="utf-8").lower()
        self.assertTrue(sql.lstrip().startswith("--"))
        self.assertIn("account_delta_total_mismatch", sql); self.assertIn("ledger_chain_discontinuity", sql)
        self.assertIn("pending_withdrawal_hold_shortfall", sql)
        self.assertIn("coalesce(t.available_delta_total, 0)::text || '/' || coalesce(t.frozen_delta_total, 0)::text", sql)
        import re; self.assertNotRegex(sql, r"\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table)\b")
    def test_cutover_gate_never_claims_live_database_or_restore_test(self):
        report = evaluate(ROOT)
        self.assertFalse(report["live_database_checked"]); self.assertFalse(report["concurrency_tested"]); self.assertFalse(report["backup_restore_drill_verified"])
        self.assertGreaterEqual(len(report["required_evidence_before_cutover"]), 5)
if __name__ == "__main__": unittest.main()
