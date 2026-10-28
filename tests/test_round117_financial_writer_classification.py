import json
import subprocess
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
class Round117FinancialWriterClassificationTests(unittest.TestCase):
    def test_no_detected_legacy_balance_writers_remain(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts" / "classify_financial_writers.py")], cwd=ROOT, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["writer_count"], 0)
        self.assertEqual(report["writers"], [])
        self.assertFalse(report["live_database_checked"])
    def test_spot_order_stays_fail_closed_without_trusted_matching_engine(self):
        source = (ROOT / "netlify" / "functions" / "api.js").read_text(encoding="utf-8")
        start = source.index("if (path === 'order' && method === 'POST')")
        end = source.index("if (path === 'earn' && method === 'POST')", start)
        block = source[start:end]
        self.assertIn("MATCHING_ENGINE_UNAVAILABLE", block)
        self.assertIn("Never simulate fills", block)
        self.assertNotIn("execute_spot_trade_atomic", block)
if __name__ == "__main__": unittest.main()
