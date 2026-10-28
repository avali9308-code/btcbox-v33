import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RPC_FILES = {
    "financial_read_api_v1.sql": ("read_financial_account_snapshot_v1", "text"),
    "financial_admin_read_api_v1.sql": ("read_admin_withdrawal_snapshot_v1", ""),
    "financial_admin_account_read_api_v1.sql": ("read_admin_account_balances_v1", "text[]"),
}


class Round109FinancialRpcSecurityPreflightTests(unittest.TestCase):
    def test_all_normalized_read_rpcs_are_invoker_and_pin_search_path(self):
        for filename, (function_name, sql_types) in RPC_FILES.items():
            with self.subTest(filename=filename):
                content = re.sub(r"\s+", " ", (ROOT / "supabase/sql" / filename).read_text().lower())
                signature = f"{function_name}({sql_types})"
                start = content.index(f"create or replace function public.{function_name}")
                end = content.index("$$;", start)
                definition = content[start:end]
                self.assertIn("security invoker", definition)
                self.assertRegex(definition, r"set\s+search_path\s*=\s*''")

    def test_all_normalized_read_rpcs_revoke_browser_roles_and_grant_service_role(self):
        for filename, (function_name, sql_types) in RPC_FILES.items():
            with self.subTest(filename=filename):
                content = re.sub(r"\s+", " ", (ROOT / "supabase/sql" / filename).read_text().lower())
                signature = f"{function_name}({sql_types})"
                self.assertIn(f"revoke all on function public.{signature} from public, anon, authenticated", content)
                self.assertIn(f"grant execute on function public.{signature} to service_role", content)
                self.assertNotRegex(content, rf"grant execute on function public\.{re.escape(signature)} to [^;]*(anon|authenticated|public)")

    def test_preflight_checks_rpc_definition_and_privilege_hardening(self):
        script = (ROOT / "scripts/check_financial_migration_preflight.py").read_text()
        for marker in ("RPC MUST USE SECURITY INVOKER", "RPC MUST PIN EMPTY SEARCH_PATH", "MISSING BROWSER ROLE REVOKE", "UNSAFE BROWSER ROLE GRANT"):
            with self.subTest(marker=marker):
                self.assertIn(marker, script)


if __name__ == "__main__":
    unittest.main()
