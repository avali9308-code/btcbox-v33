from pathlib import Path
import subprocess
import sys
import os
import unittest

ROOT = Path(__file__).resolve().parents[1]

class Round149FinancialRpcSignatureAuditTests(unittest.TestCase):
    def test_runtime_drill_checks_exact_function_signatures_not_only_names(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn("to_regprocedure(%s)::oid", source)
        self.assertIn("public.admin_adjustment_atomic(text,text,text,text,numeric,numeric,text,text)", source)
        self.assertIn("public.execute_spot_trade_atomic(text,text,text,text,text,text,numeric,numeric,text,text)", source)

    def test_direct_table_privilege_check_includes_destructive_and_metadata_privileges(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        for privilege in ("TRUNCATE", "REFERENCES", "TRIGGER"):
            self.assertIn(privilege, source)
        for table in ("financial_spot_orders", "financial_matching_markets", "financial_matching_orders",
                      "financial_matching_trades", "earn_product_catalog"):
            self.assertIn('"' + table + '"', source)

    def test_offline_audit_parses_exact_argument_types(self):
        sys.path.insert(0, str(ROOT / "scripts"))
        import financial_sql_static_audit as audit
        fixture = """
          create function public.example_rpc(p_id text, p_count numeric) returns jsonb language sql as $$ select '{}'::jsonb $$;
          create function public.example_rpc(p_id text, p_count text) returns jsonb language sql as $$ select '{}'::jsonb $$;
        """
        signatures = audit.function_signatures(fixture)
        self.assertIn("public.example_rpc(text,numeric)", signatures)
        self.assertIn("public.example_rpc(text,text)", signatures)
        self.assertNotIn("public.example_rpc(text,boolean)", signatures)

    def test_staging_drill_validates_real_ledger_deltas_for_business_sequences(self):
        source = (ROOT / "scripts/financial_postgres_staging_drill.py").read_text(encoding="utf-8")
        self.assertIn('Decimal("-2"), Decimal("0")', source)
        self.assertIn('result["checks"]["withdrawal_ledger_delta_sequence"] = withdrawal_deltas ==', source)
        self.assertIn('result["checks"]["admin_adjustment_ledger_delta"] = (', source)

    def test_migration_order_guide_references_real_files_and_separates_read_only_reports(self):
        guide = (ROOT / "supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md").read_text(encoding="utf-8")
        for name in ("financial_ledger_v1.sql", "financial_lifecycle_v2.sql", "financial_earn_policy_v5.sql",
                     "financial_matching_engine_v1.sql", "financial_read_api_earn_v1.sql"):
            self.assertTrue((ROOT / "supabase/sql" / name).is_file(), name)
            self.assertIn(name, guide)
        self.assertIn("not migrations", guide)
        self.assertIn("before production cutover", guide.lower())

    def test_offline_migration_audit_passes_and_does_not_claim_live_database(self):
        result = subprocess.run([sys.executable, "scripts/financial_sql_static_audit.py"], cwd=ROOT,
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('"live_database_checked": false', result.stdout)
        self.assertIn('"required_rpc_signatures": 14', result.stdout)
        self.assertIn('"protected_financial_tables_checked": 12', result.stdout)
        self.assertIn('"failed_tables": {}', result.stdout)

    def test_runtime_preflight_fails_closed_when_database_configuration_is_absent(self):
        env = dict(os.environ)
        for key in ("BTCBOX_STAGING_DATABASE_URL", "BTCBOX_STAGING_EXPECTED_DATABASE", "BTCBOX_STAGING_EXPECTED_HOST"):
            env.pop(key, None)
        result = subprocess.run([sys.executable, "scripts/financial_postgres_staging_drill.py", "--preflight-only"],
                                cwd=ROOT, env=env, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("BTCBOX_STAGING_DATABASE_URL must be a PostgreSQL connection URL", result.stderr)
        self.assertNotIn("postgres://", result.stderr)

if __name__ == "__main__":
    unittest.main()
