import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import financial_rpc_route_contract as contract


class Round159RpcRouteContractCompletenessTests(unittest.TestCase):
    def test_automatic_chain_confirmation_is_out_of_scope_for_manual_review_model(self):
        report = contract.audit(ROOT)
        self.assertNotIn("admin_chain_deposit_confirmation_rpc", report["contracts"])
        self.assertNotIn("admin_chain_deposit_confirmation_rpc", report["unwired_routes"])

    def test_static_match_does_not_promote_production_readiness(self):
        report = contract.audit(ROOT)
        self.assertFalse(report["live_database_checked"])
        self.assertFalse(report["runtime_rpc_verified"])
        self.assertFalse(report["ready_for_production_cutover"])

    def test_manual_admin_credit_is_not_mislabeled_as_chain_confirmation(self):
        source = (ROOT / "netlify/functions/api.js").read_text(encoding="utf-8")
        self.assertIn("explicit administrator manual credit", source)
        self.assertIn("admin_manual_deposit_atomic", source)
        self.assertNotIn("confirm_deposit_atomic", source)


if __name__ == "__main__":
    unittest.main()
