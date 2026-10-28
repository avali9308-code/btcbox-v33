from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Round146PostgresDrillCoverageTests(unittest.TestCase):
    def test_staging_drill_checks_payload_mismatch(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn("idempotency_payload_mismatch_rejected", source)
        self.assertIn("mismatch_count == 1", source)

    def test_staging_drill_checks_insufficient_funds_atomicity(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn("insufficient_funds_rejected", source)
        self.assertIn("before == after", source)
        self.assertIn("failed_op_count == 0", source)

    def test_staging_drill_checks_rollback_for_operation_and_ledger(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn("rollback_ledger_count == 0", source)

    def test_expected_final_balance_accounts_for_approved_withdrawal(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn('Decimal(account[0]) == Decimal("10")', source)

    def test_cutover_gate_lists_unverified_rpc_routes_and_keeps_runtime_blocker(self):
        source = (ROOT / "scripts/financial_cutover_gate.py").read_text(encoding="utf-8")
        self.assertIn("unverified_postgres_rpc_routes", source)
        self.assertIn("postgres_rpc_runtime_verification_missing", source)
        self.assertIn("staging_database_url_configured", source)
        self.assertIn('findings.append("live_postgres_validation_required")', source)


if __name__ == "__main__":
    unittest.main()
