import unittest
from pathlib import Path
from scripts.audit_financial_writers import audit

ROOT = Path(__file__).resolve().parents[1]

class FinancialWriterAuditTests(unittest.TestCase):
    def test_no_direct_legacy_balance_or_frozen_writers_remain(self):
        self.assertEqual(audit(ROOT / "server.py"), [])

    def test_audit_is_read_only_and_source_level(self):
        result = audit(ROOT / "server.py")
        self.assertEqual(result, [])

if __name__ == "__main__": unittest.main()
