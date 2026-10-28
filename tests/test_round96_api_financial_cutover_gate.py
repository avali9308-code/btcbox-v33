import unittest
from pathlib import Path
from scripts.financial_cutover_gate import API_FINANCIAL_ROUTES, audit_api_routes, evaluate
ROOT = Path(__file__).resolve().parents[1]
class Round96ApiFinancialCutoverGateTests(unittest.TestCase):
    def test_primary_netlify_api_is_audited_separately_from_legacy_python_server(self):
        report = evaluate(ROOT); self.assertTrue(report['api_financial_route_audit']['source_exists'])
        self.assertEqual(set(report['api_financial_route_audit']['routes']), set(API_FINANCIAL_ROUTES))
        self.assertEqual(report['legacy_writer_count'], 0); self.assertFalse(report['ready_for_production_cutover'])
    def test_known_money_routes_have_local_guards_or_matching_engine_fail_closed(self):
        result = audit_api_routes(ROOT); self.assertEqual(result['uncovered_routes'], [])
        for name, route in result['routes'].items():
            with self.subTest(route=name): self.assertTrue(route['route_marker_found']); self.assertTrue(route['cutover_guard_found'])
    def test_gate_confirms_legacy_mutation_code_removed_from_primary_api(self):
        report = evaluate(ROOT)
        self.assertNotIn('legacy_financial_mutation_code_remains_in_primary_api', report['blocking_findings'])
        self.assertEqual(report['primary_api_legacy_mutation_locations'], [])
        # Legacy Python writer count is a separate inventory and must not hide
        # mutations in the actual Netlify production entrypoint.
        self.assertEqual(report['legacy_writer_count'], 0)
    def test_gate_does_not_mistake_guards_for_completed_rpc_wiring(self):
        report = evaluate(ROOT); self.assertIn('live_postgres_validation_required', report['blocking_findings'])
        self.assertNotIn('postgres_rpc_route_wiring_incomplete', report['blocking_findings'])
        for name, route in report['api_financial_route_audit']['routes'].items():
            if name not in {'admin_deposit_confirm', 'admin_balance_adjustment', 'user_withdrawal', 'admin_withdraw_approve', 'admin_withdraw_reject', 'earn_subscribe_redeem'}:
                self.assertFalse(route['postgres_rpc_wiring_verified'], name)
                if name == 'spot_order': self.assertTrue(route['postgres_rpc_wiring_present'], name)
        self.assertFalse(report['live_database_checked']); self.assertFalse(report['concurrency_tested'])
    def test_missing_primary_api_handler_is_a_blocker(self):
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); (root / 'server.py').write_text('balances = {}\n', encoding='utf-8')
            report = evaluate(root); self.assertIn('primary_api_handler_missing', report['blocking_findings'])
            self.assertFalse(report['ready_for_production_cutover'])
if __name__ == '__main__': unittest.main()
