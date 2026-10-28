from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Round148PostgresRuntimePreflightTests(unittest.TestCase):
    def test_drill_requires_exact_staging_hostname_and_blocks_production_like_host(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn("BTCBOX_STAGING_EXPECTED_HOST", source)
        self.assertIn("actual_host != expected_host", source)
        self.assertIn("refusing a production-like database host", source)

    def test_drill_runtime_checks_required_rpc_grants_before_mutation(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        for name in ("apply_financial_operation", "create_withdrawal_atomic", "review_withdrawal_atomic",
                     "confirm_deposit_atomic", "subscribe_earn_atomic", "redeem_earn_atomic",
                     "admin_manual_deposit_atomic", "admin_adjustment_atomic", "execute_spot_trade_atomic",
                     "submit_limit_order_matching_v1", "cancel_limit_order_matching_v1",
                     "read_admin_account_balances_v1", "read_admin_withdrawal_snapshot_v1",
                     "read_financial_account_snapshot_v1"):
            self.assertIn(name, source)
        self.assertIn("service_role", source)
        self.assertIn("authenticated_can_execute", source)
        self.assertIn("if not all((preflight[", source)

    def test_read_only_preflight_mode_is_distinct_from_mutating_drill(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn('"--preflight-only"', source)
        self.assertIn("require_environment(allow_mutation=args.execute)", source)
        self.assertIn('"preflight_only": True', source)

    def test_drill_checks_rls_and_direct_browser_table_privileges_before_mutation(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn("relrowsecurity", source)
        self.assertIn("anon_has_any", source)
        self.assertIn("authenticated_has_any", source)
        self.assertIn("table_grants_and_rls_safe", source)


if __name__ == "__main__":
    unittest.main()
