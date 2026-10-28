import os
import unittest
from unittest.mock import patch
from pathlib import Path

from financial_storage_guard import (
    FinancialStorageModeError,
    validate_financial_storage_mode,
)


class FinancialStorageGuardTests(unittest.TestCase):
    def test_default_mode_is_legacy_json(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(validate_financial_storage_mode(), "legacy_json")

    def test_explicit_legacy_json_is_allowed(self):
        self.assertEqual(validate_financial_storage_mode("legacy_json"), "legacy_json")

    def test_database_modes_fail_closed(self):
        for mode in ("postgres", "supabase", "database", "", "unknown"):
            with self.subTest(mode=mode):
                with self.assertRaises(FinancialStorageModeError):
                    validate_financial_storage_mode(mode)

    def test_env_database_mode_fails_closed(self):
        with patch.dict(os.environ, {"FINANCIAL_STORAGE_MODE": "supabase"}, clear=True):
            with self.assertRaises(FinancialStorageModeError):
                validate_financial_storage_mode()

    def test_server_checks_guard_before_loading_json_or_starting_network(self):
        source = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")
        main = source[source.index("def main():"):source.index('if __name__ == "__main__":')]
        self.assertLess(main.index("validate_financial_storage_mode()"), main.index("load_data()"))
        self.assertLess(main.index("validate_financial_storage_mode()"), main.index("fetch_prices"))


if __name__ == "__main__":
    unittest.main()
