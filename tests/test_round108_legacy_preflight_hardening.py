import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "financial_migration_preflight.py"
SPEC = importlib.util.spec_from_file_location("financial_migration_preflight", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LegacyPreflightHardeningTests(unittest.TestCase):
    def write_json(self, folder, value):
        path = Path(folder) / "data.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def test_missing_users_object_is_rejected_instead_of_treated_as_empty(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.write_json(folder, {"version": 1})
            with self.assertRaisesRegex(ValueError, "explicit users object"):
                MODULE.build_manifest(str(path))

    def test_duplicate_user_uid_fails_preflight(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.write_json(folder, {"users": {
                "a": {"uid": "same", "balances": {"USDT": "10"}},
                "b": {"uid": "same", "balances": {"USDT": "20"}},
            }})
            manifest = MODULE.build_manifest(str(path))
            self.assertFalse(manifest["preflight_passed"])
            self.assertIn("duplicate_user_uid", manifest["issues"])

    def test_clean_explicit_users_object_passes_and_does_not_import(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.write_json(folder, {"users": {"u1": {"uid": "u1", "balances": {"USDT": "12.50"}}}})
            manifest = MODULE.build_manifest(str(path))
            self.assertTrue(manifest["preflight_passed"])
            self.assertFalse(manifest["import_performed"])
            self.assertEqual(manifest["asset_totals"]["USDT"]["available"], "12.5")

    def test_duplicate_uid_issue_is_aggregate_only(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.write_json(folder, {"users": {
                "a": {"uid": "same"}, "b": {"uid": "same"}
            }})
            manifest = MODULE.build_manifest(str(path))
            rendered = json.dumps(manifest)
            self.assertNotIn('"same"', rendered)
            self.assertIn("duplicate_user_uid", rendered)


if __name__ == "__main__":
    unittest.main()
