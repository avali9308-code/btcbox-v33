from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class MatchingEngineBoundaryTests(unittest.TestCase):
    def test_order_endpoint_does_not_claim_to_match_without_engine(self):
        source = (ROOT / 'netlify/functions/api.js').read_text()
        start = source.index("if (path === 'order' && method === 'POST')")
        end = source.index("// ---------- POST /api/earn ----------", start)
        block = source[start:end]
        self.assertIn('MATCHING_ENGINE_UNAVAILABLE', block)
        self.assertIn('MATCHING_ENGINE_UNAVAILABLE', block)
        self.assertIn('matchingEngineEnabled()', block)
        self.assertIn('submit_limit_order_matching_v1', block)
        self.assertNotIn('execute_spot_trade_atomic', block)

    def test_settlement_rpc_is_explicitly_not_a_matching_engine(self):
        sql = (ROOT / 'supabase/sql/financial_spot_trade_v3.sql').read_text()
        self.assertIn('It is NOT a matching engine', sql)
        self.assertIn("status text not null check (status = 'filled')", sql)

    def test_rebuild_contract_requires_durable_order_book_and_priority(self):
        doc = (ROOT / 'ROUND-118-MATCHING-ENGINE-REBUILD.md').read_text()
        for required in ('price-time priority', 'partially_filled', 'reservation', 'concurrent', 'rolls back'):
            self.assertIn(required, doc.lower())

if __name__ == '__main__':
    unittest.main()
