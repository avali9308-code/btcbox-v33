import unittest
from pathlib import Path
from scripts.financial_read_path_audit import audit

ROOT = Path(__file__).resolve().parents[1]

class Round101FinancialReadPathAuditTests(unittest.TestCase):
    def test_known_legacy_financial_reads_are_reported(self):
        report = audit(ROOT)
        self.assertIn('authenticated_user_balances_and_history', report['read_paths'])
        self.assertIn('admin_pending_withdrawals', report['read_paths'])
        self.assertIn('admin_pending_withdrawal_count', report['read_paths'])
        self.assertTrue(all(row['marker_found'] for row in report['read_paths'].values()))

    def test_no_read_path_is_claimed_as_postgres_migrated(self):
        report = audit(ROOT)
        self.assertFalse(report['ready_for_full_cutover'])
        self.assertTrue(report['unresolved_read_paths'])
        self.assertTrue(all(not row['normalized_postgres_read_verified'] for row in report['read_paths'].values()))
        self.assertTrue(all(row['blocks_full_cutover'] for row in report['read_paths'].values()))

    def test_report_explicitly_disclaims_live_verification(self):
        report = audit(ROOT)
        self.assertFalse(report['live_database_checked'])
        self.assertFalse(report['runtime_requests_executed'])

if __name__ == '__main__':
    unittest.main()
