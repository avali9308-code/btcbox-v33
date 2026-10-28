import unittest
from pathlib import Path
from scripts.financial_rpc_route_contract import audit

ROOT = Path(__file__).resolve().parents[1]

class Round158RpcRouteContractTests(unittest.TestCase):
    def test_all_route_rpc_pairs_have_matching_sql_definitions(self):
        report = audit(ROOT)
        self.assertEqual(report['static_failures'], [])
        for name, row in report['contracts'].items():
            with self.subTest(contract=name):
                self.assertTrue(row['sql_artifact_exists'])
                self.assertTrue(row['sql_function_definition_found'])

    def test_admin_manual_credit_is_not_misreported_as_chain_confirmation(self):
        report = audit(ROOT)
        manual = report['contracts']['admin_manual_deposit_credit']
        self.assertEqual(manual['rpc'], 'admin_manual_deposit_atomic')
        self.assertNotIn('admin_chain_deposit_confirmation_rpc', report['contracts'])

    def test_static_report_never_claims_live_verification(self):
        report = audit(ROOT)
        self.assertFalse(report['live_database_checked'])
        self.assertFalse(report['runtime_rpc_verified'])

if __name__ == '__main__':
    unittest.main()
