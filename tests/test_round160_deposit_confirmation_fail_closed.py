import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def function_body(sql: str, function_name: str) -> str:
    match = re.search(
        rf"create\s+or\s+replace\s+function\s+public\.{re.escape(function_name)}\s*\(.*?\)\s*returns\s+jsonb.*?as\s+\$\$(.*?)\$\$;",
        sql, re.I | re.S,
    )
    if not match:
        raise AssertionError(f"function definition not found: {function_name}")
    return match.group(1)


class Round160DepositConfirmationFailClosedTests(unittest.TestCase):
    def test_lifecycle_confirm_rpc_cannot_credit_ledger(self):
        sql = (ROOT / "supabase/sql/financial_lifecycle_v2.sql").read_text(encoding="utf-8")
        body = function_body(sql, "confirm_deposit_atomic")
        self.assertIn("raise exception", body.lower())
        self.assertIn("trusted chain verification required", body.lower())
        self.assertNotIn("apply_financial_operation", body.lower())
        self.assertNotIn("update public.deposit_records", body.lower())

    def test_chain_verification_rpc_is_the_crediting_path(self):
        sql = (ROOT / "supabase/sql/financial_deposit_chain_verification_v3.sql").read_text(encoding="utf-8")
        body = function_body(sql, "verify_and_credit_deposit_atomic")
        self.assertIn("p_confirmations < p_required_confirmations", body)
        self.assertIn("v_d.amount <> p_observed_amount", body)
        self.assertIn("apply_financial_operation", body)
        self.assertIn("grant execute on function public.verify_and_credit_deposit_atomic", sql.lower())

    def test_legacy_confirm_rpc_does_not_gain_crediting_power_in_lifecycle_migration(self):
        order = (ROOT / "supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md").read_text(encoding="utf-8")
        self.assertIn("intentionally fail-closed", order)
        self.assertIn("manual credits must use the separately audited `admin_manual_deposit_atomic` RPC", order)


if __name__ == "__main__":
    unittest.main()
