import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')
class Round93WithdrawalLifecycleTests(unittest.TestCase):
    def test_approval_uses_transactional_review_rpc_and_has_no_legacy_mutation(self):
        start = API.index("if (sub === 'withdraw/approve'")
        end = API.index("if (sub === 'withdraw/reject'", start)
        route = API[start:end]
        self.assertIn("rpc/review_withdrawal_atomic", route)
        self.assertIn("p_approve: true", route)
        self.assertIn("WITHDRAWAL_ALREADY_PROCESSED", route)
        self.assertNotRegex(route, r"balance\.(?:free|frozen)\s*[-+]?=")
        self.assertNotIn("await saveDB(db)", route)
    def test_rejection_uses_transactional_review_rpc_and_has_no_legacy_mutation(self):
        start = API.index("if (sub === 'withdraw/reject'")
        end = API.index("if (sub === 'kyc/approve'", start)
        route = API[start:end]
        self.assertIn("rpc/review_withdrawal_atomic", route)
        self.assertIn("p_approve: false", route)
        self.assertIn("WITHDRAWAL_ALREADY_PROCESSED", route)
        self.assertNotRegex(route, r"balance\.(?:free|frozen)\s*[-+]?=")
        self.assertNotIn("await saveDB(db)", route)
    def test_withdrawal_review_requires_cutover_and_valid_identifier(self):
        for action in ["withdraw/approve", "withdraw/reject"]:
            start = API.index("if (sub === '" + action + "'")
            end_marker = "if (sub === 'withdraw/reject'" if action.endswith('approve') else "if (sub === 'kyc/approve'"
            route = API[start:API.index(end_marker, start + 1)]
            self.assertIn("FINANCIAL_CUTOVER_INCOMPLETE", route)
            self.assertIn("if (!wdId || wdId.length > 100)", route)
            self.assertIn("rpc/review_withdrawal_atomic", route)
if __name__ == '__main__': unittest.main()
