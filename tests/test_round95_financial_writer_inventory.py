import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')

class Round95FinancialWriterInventoryTests(unittest.TestCase):
    def test_admin_balance_adjustment_uses_atomic_rpc_in_cutover_mode(self):
        start = API.index("if (sub === 'user/balance' && method === 'POST')")
        end = API.index("if (sub === 'user/freeze' && method === 'POST')", start)
        route = API[start:end]
        self.assertIn('manualDepositRpcEnabled()', route)
        self.assertIn('/rpc/admin_adjustment_atomic', route)
        self.assertIn('p_request_id: requestId', route)
        self.assertIn('p_request_hash: requestHash', route)
        self.assertIn('FINANCIAL_RPC_UNAVAILABLE', route)
        self.assertIn('Never fall back to the legacy state document', route)
        self.assertNotIn('saveDB(db)', route)
        self.assertNotIn('u.balances[coin].free =', route)

    def test_inventory_does_not_claim_live_rpc_wiring(self):
        inventory = json.loads((ROOT / 'FINANCIAL-WRITER-INVENTORY.json').read_text(encoding='utf-8'))
        self.assertEqual(inventory['round'], 144)
        self.assertTrue(inventory['operations'])
        for op in inventory['operations']:
            if 'postgres_rpc_wiring_verified' in op:
                self.assertFalse(op['postgres_rpc_wiring_verified'], op['operation'])
        admin_adjustment = next(op for op in inventory['operations'] if op['operation'] == 'admin_balance_adjustment')
        self.assertFalse(admin_adjustment['postgres_rpc_wiring_verified'])
        self.assertFalse(admin_adjustment['legacy_source_code_retained'])

    def test_inventory_documents_staged_migration_and_verification_boundary(self):
        doc = (ROOT / 'FINANCIAL-WRITER-INVENTORY.md').read_text(encoding='utf-8')
        self.assertIn('disposable database', doc)
        self.assertIn('balance reads', doc)
        self.assertIn('do not dual-write', doc)
        self.assertIn('They do not validate deployed Netlify', doc)

if __name__ == '__main__':
    unittest.main()
