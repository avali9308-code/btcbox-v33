import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "supabase/sql/financial_admin_adjustment_v1.sql").read_text(encoding="utf-8")


class Round75AdminAdjustmentTests(unittest.TestCase):
    def test_duplicate_txids_fail_migration_before_unique_index(self):
        lower = SQL.lower()
        self.assertIn("duplicate deposit txids found", lower)
        self.assertIn("deposit_records_txid_asset_network_uq", lower)
        self.assertLess(lower.index("duplicate deposit txids found"), lower.index("create unique index"))

    def test_confirmed_deposit_identity_and_amount_are_immutable(self):
        lower = SQL.lower()
        for field in ("user_id", "asset", "network", "amount", "txid", "idempotency_key"):
            self.assertIn(f"new.{field} is distinct from old.{field}", lower)
        self.assertIn("confirmed deposit status cannot be reversed", lower)
        self.assertIn("before update on public.deposit_records", lower)

    def test_admin_adjustment_requires_reason_and_idempotency(self):
        lower = SQL.lower()
        self.assertIn("admin_adjustment_atomic", lower)
        self.assertIn("length(btrim(coalesce(p_reason, ''))) < 5", lower)
        self.assertIn("admin-adjust:' || p_request_id", lower)
        self.assertIn("idempotency key payload mismatch", lower)
        self.assertIn("request hash does not match adjustment payload", lower)
        self.assertIn("if coalesce((v_result->>'duplicate')::boolean, false) then", lower)
        self.assertIn("public.apply_financial_operation", lower)

    def test_admin_adjustment_audits_and_is_service_role_only(self):
        lower = SQL.lower()
        self.assertIn("insert into public.financial_audit_log", lower)
        self.assertIn("revoke all on function public.admin_adjustment_atomic", lower)
        self.assertIn("to service_role", lower)
        self.assertNotRegex(lower, r"grant\s+execute\s+on\s+function\s+public\.admin_adjustment_atomic[^;]*\s+to\s+(public|anon|authenticated)")


if __name__ == "__main__":
    unittest.main()
