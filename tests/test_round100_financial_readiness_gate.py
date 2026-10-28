import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')

class Round100FinancialReadinessGateTests(unittest.TestCase):
    def test_write_rpc_requires_separate_full_cutover_approval(self):
        start = API.index('function manualDepositRpcEnabled()')
        end = API.index('function attachRevision', start)
        gate = API[start:end]
        self.assertIn("process.env.FINANCIAL_POSTGRES_RPC_ENABLED === '1'", gate)
        self.assertIn("process.env.FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED === '1'", gate)
        self.assertIn('btcbox_state', API)
        self.assertIn('fail-closed', API.lower())

    def test_approval_flag_is_not_set_in_repository_configuration(self):
        for rel in ['netlify.toml', '.env', '.env.production']:
            p = ROOT / rel
            if p.exists():
                self.assertNotIn('FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=1', p.read_text(encoding='utf-8'))

    def test_read_paths_are_still_documented_as_cutover_blocker(self):
        doc = (ROOT / 'ROUND-100-CHANGELOG.md').read_text(encoding='utf-8')
        self.assertIn('balance', doc.lower())
        self.assertIn('history', doc.lower())
        self.assertIn('still depend on `btcbox_state`', doc.lower())
        self.assertIn('not a completed migration', doc.lower())

if __name__ == '__main__':
    unittest.main()
