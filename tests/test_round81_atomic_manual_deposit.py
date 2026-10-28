import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / 'supabase/sql/financial_admin_manual_deposit_v1.sql').read_text(encoding='utf-8').lower()

class Round81AtomicManualDepositTests(unittest.TestCase):
    def test_uses_single_atomic_financial_operation(self):
        self.assertIn('public.apply_financial_operation(', SQL)
        self.assertIn("'admin-manual-deposit:' || p_request_id", SQL)
        self.assertIn("update public.deposit_records set status = 'confirmed'", SQL)

    def test_idempotency_and_payload_mismatch_are_enforced(self):
        self.assertIn('on conflict (idempotency_key) do nothing', SQL)
        self.assertIn('for update', SQL)
        self.assertIn('idempotency key payload mismatch', SQL)
        self.assertIn("if v_d.status = 'confirmed'", SQL)

    def test_manual_reference_is_unique_and_audited(self):
        self.assertIn('deposit_records_manual_reference_uq', SQL)
        self.assertIn('admin_manual_deposit_confirmed', SQL)
        self.assertIn('public.financial_audit_log', SQL)

    def test_rpc_is_service_role_only(self):
        self.assertIn('revoke all on function public.admin_manual_deposit_atomic', SQL)
        self.assertRegex(SQL, r'grant execute on function public\.admin_manual_deposit_atomic[\s\S]*?to service_role')
        self.assertNotRegex(SQL, r'grant execute on function public\.admin_manual_deposit_atomic[^;]*\bto\s+(public|anon|authenticated)')

if __name__ == '__main__':
    unittest.main()
