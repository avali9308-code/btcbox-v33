import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "check_financial_migration_preflight.py"


class FinancialMigrationPreflightTests(unittest.TestCase):
    def test_static_preflight_passes_for_repository_migrations(self):
        result = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("required migration files present", result.stdout)
        self.assertIn("no live Supabase connection or migration-state verification", result.stdout)

    def test_preflight_explicitly_disclaims_live_database_verification(self):
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("does not connect to Supabase", source)
        self.assertIn("live data", source)


if __name__ == "__main__":
    unittest.main()
