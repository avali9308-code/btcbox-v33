import os
import unittest
from unittest.mock import patch

from scripts.financial_postgres_staging_drill import require_environment


class Round145PostgresDrillSafetyTests(unittest.TestCase):
    def test_requires_explicit_mutation_acknowledgement(self):
        with patch.dict(os.environ, {
            "BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION": "0",
            "BTCBOX_STAGING_DATABASE_URL": "postgresql://localhost/testdb",
            "BTCBOX_STAGING_EXPECTED_DATABASE": "btcbox_staging",
            "BTCBOX_STAGING_EXPECTED_HOST": "localhost",
        }, clear=False):
            with self.assertRaisesRegex(RuntimeError, "ALLOW_MUTATION"):
                require_environment()

    def test_requires_expected_staging_database_name(self):
        with patch.dict(os.environ, {
            "BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION": "1",
            "BTCBOX_STAGING_DATABASE_URL": "postgresql://localhost/testdb",
        }, clear=False):
            os.environ.pop("BTCBOX_STAGING_EXPECTED_DATABASE", None)
            with self.assertRaisesRegex(RuntimeError, "EXPECTED_DATABASE"):
                require_environment()

    def test_refuses_production_like_database_name(self):
        with patch.dict(os.environ, {
            "BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION": "1",
            "BTCBOX_STAGING_DATABASE_URL": "postgresql://localhost/prod",
            "BTCBOX_STAGING_EXPECTED_DATABASE": "btcbox-production",
            "BTCBOX_STAGING_EXPECTED_HOST": "localhost",
        }, clear=False):
            with self.assertRaisesRegex(RuntimeError, "production-like"):
                require_environment()

    def test_requires_exact_expected_staging_hostname(self):
        with patch.dict(os.environ, {
            "BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION": "1",
            "BTCBOX_STAGING_DATABASE_URL": "postgresql://localhost/btcbox_staging",
            "BTCBOX_STAGING_EXPECTED_DATABASE": "btcbox_staging",
            "BTCBOX_STAGING_EXPECTED_HOST": "staging.example.com",
        }, clear=False):
            with self.assertRaisesRegex(RuntimeError, "EXPECTED_HOST"):
                require_environment()

    def test_refuses_production_like_hostname(self):
        with patch.dict(os.environ, {
            "BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION": "1",
            "BTCBOX_STAGING_DATABASE_URL": "postgresql://db.production.example.com/btcbox_staging",
            "BTCBOX_STAGING_EXPECTED_DATABASE": "btcbox_staging",
            "BTCBOX_STAGING_EXPECTED_HOST": "db.production.example.com",
        }, clear=False):
            with self.assertRaisesRegex(RuntimeError, "production-like database host"):
                require_environment()

    def test_accepts_explicit_staging_database_target(self):
        with patch.dict(os.environ, {
            "BTCBOX_FINANCIAL_TEST_ALLOW_MUTATION": "1",
            "BTCBOX_STAGING_DATABASE_URL": "postgresql://localhost/btcbox_staging",
            "BTCBOX_STAGING_EXPECTED_DATABASE": "btcbox_staging",
            "BTCBOX_STAGING_EXPECTED_HOST": "localhost",
        }, clear=False):
            url, expected = require_environment()
            self.assertEqual(url, "postgresql://localhost/btcbox_staging")
            self.assertEqual(expected, "btcbox_staging")


if __name__ == "__main__":
    unittest.main()
