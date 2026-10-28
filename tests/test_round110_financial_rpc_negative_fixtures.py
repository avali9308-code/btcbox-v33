import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/check_financial_migration_preflight.py"
spec = importlib.util.spec_from_file_location("financial_preflight", SCRIPT)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

NAME = "fixture.sql"
SIGNATURE = "read_fixture(text)"
SECURE_SQL = """
create or replace function public.read_fixture(text)
returns text language sql security invoker set search_path = '' as $$ select 'ok' $$;
revoke all on function public.read_fixture(text) from public, anon, authenticated;
grant execute on function public.read_fixture(text) to service_role;
"""


class Round110FinancialRpcNegativeFixtureTests(unittest.TestCase):
    def test_secure_definition_passes(self):
        self.assertEqual([], preflight.audit_read_rpc_content(NAME, SIGNATURE, SECURE_SQL))

    def test_security_definer_is_rejected(self):
        sql = SECURE_SQL.replace("security invoker", "security definer")
        findings = preflight.audit_read_rpc_content(NAME, SIGNATURE, sql)
        self.assertTrue(any("SECURITY INVOKER" in item for item in findings), findings)

    def test_missing_empty_search_path_is_rejected(self):
        sql = SECURE_SQL.replace("set search_path = ''", "set search_path = public")
        findings = preflight.audit_read_rpc_content(NAME, SIGNATURE, sql)
        self.assertTrue(any("EMPTY SEARCH_PATH" in item for item in findings), findings)

    def test_missing_browser_revoke_is_rejected(self):
        sql = SECURE_SQL.replace("revoke all on function public.read_fixture(text) from public, anon, authenticated;", "")
        findings = preflight.audit_read_rpc_content(NAME, SIGNATURE, sql)
        self.assertTrue(any("BROWSER ROLE REVOKE" in item for item in findings), findings)

    def test_browser_role_grant_is_rejected(self):
        sql = SECURE_SQL + "grant execute on function public.read_fixture(text) to authenticated;"
        findings = preflight.audit_read_rpc_content(NAME, SIGNATURE, sql)
        self.assertTrue(any("UNSAFE BROWSER ROLE GRANT" in item for item in findings), findings)

    def test_missing_service_role_grant_is_rejected(self):
        sql = SECURE_SQL.replace("grant execute on function public.read_fixture(text) to service_role;", "")
        findings = preflight.audit_read_rpc_content(NAME, SIGNATURE, sql)
        self.assertTrue(any("SERVICE_ROLE GRANT" in item for item in findings), findings)

    def test_missing_definition_and_unterminated_body_fail_closed(self):
        self.assertTrue(any("MISSING RPC DEFINITION" in item for item in preflight.audit_read_rpc_content(NAME, SIGNATURE, "select 1;")))
        sql = "create or replace function public.read_fixture(text) security invoker as $$ select 1;"
        self.assertTrue(any("UNTERMINATED RPC BODY" in item for item in preflight.audit_read_rpc_content(NAME, SIGNATURE, sql)))


if __name__ == "__main__":
    unittest.main()
