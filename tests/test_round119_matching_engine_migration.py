from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = ROOT / 'supabase/sql/financial_matching_engine_v1.sql'

class MatchingEngineMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = SQL_PATH.read_text().lower()

    def test_durable_order_and_trade_tables_exist(self):
        self.assertIn('create table if not exists public.financial_matching_orders', self.sql)
        self.assertIn('create table if not exists public.financial_matching_trades', self.sql)
        self.assertIn("('open','partially_filled','filled','cancelled')", self.sql)

    def test_price_time_priority_and_market_lock_are_present(self):
        self.assertIn('pg_advisory_xact_lock', self.sql)
        self.assertIn('created_at asc, id asc', self.sql)
        self.assertIn('v_exec_price := v_maker.price', self.sql)

    def test_reserve_fill_ledger_and_cancel_are_transactional_sql_paths(self):
        for marker in ('spot_order_reserve', 'spot_order_cancel', 'financial_ledger',
                       'submit_limit_order_matching_v1', 'cancel_limit_order_matching_v1',
                       'buyer reservation invariant failed', 'seller reservation invariant failed'):
            self.assertIn(marker, self.sql)

    def test_server_owned_market_rules_enforce_precision_minimum_and_price_bounds(self):
        self.assertIn('create table if not exists public.financial_matching_markets', self.sql)
        self.assertIn('mod(p_price, v_market.price_tick) <> 0', self.sql)
        self.assertIn('mod(p_quantity, v_market.quantity_step) <> 0', self.sql)
        self.assertIn('p_quantity < v_market.min_quantity', self.sql)
        self.assertIn('p_price*p_quantity < v_market.min_notional', self.sql)
        self.assertIn('price above protection bound', self.sql)
        self.assertIn('where base_asset=p_base_asset and quote_asset=p_quote_asset and enabled=true', self.sql)

    def test_fees_are_fail_closed_until_atomic_fee_ledger_is_implemented(self):
        self.assertIn('maker_fee_rate numeric(12,10) not null default 0 check (maker_fee_rate = 0)', self.sql)
        self.assertIn('taker_fee_rate numeric(12,10) not null default 0 check (taker_fee_rate = 0)', self.sql)

    def test_reserve_and_cancel_idempotency_keys_are_scoped_to_user(self):
        self.assertIn("spot-reserve-'||encode(extensions.digest(p_user_id||':'||p_client_order_id,'sha256'),'hex')", self.sql)
        self.assertIn("spot-cancel-'||encode(extensions.digest(p_user_id||':'||p_client_cancel_id,'sha256'),'hex')", self.sql)

    def test_functions_are_not_exposed_to_browser_roles(self):
        self.assertIn('from public, anon, authenticated', self.sql)
        self.assertIn('to service_role', self.sql)

    def test_api_adapter_is_gated_and_calls_verified_rpc_names(self):
        source = (ROOT / 'netlify/functions/api.js').read_text()
        start = source.index("if (path === 'order' && method === 'POST')")
        end = source.index('// ---------- POST /api/earn ----------', start)
        block = source[start:end]
        self.assertIn('MATCHING_ENGINE_UNAVAILABLE', block)
        self.assertIn('submit_limit_order_matching_v1', block)
        self.assertIn('matchingEngineEnabled()', block)
        self.assertIn('IDEMPOTENCY_KEY_REQUIRED', block)
        cancel_start = source.index("if (path === 'order/cancel' && method === 'POST')")
        cancel_end = source.index('// ---------- POST /api/earn ----------', cancel_start)
        cancel_block = source[cancel_start:cancel_end]
        self.assertIn('cancel_limit_order_matching_v1', cancel_block)

    def test_order_history_uses_authoritative_database_when_matching_flag_requested(self):
        source = (ROOT / 'netlify/functions/api.js').read_text()
        start = source.index("if (path === 'orders' && method === 'GET')")
        end = source.index('// ---------- GET /api/chat/unread', start)
        block = source[start:end]
        self.assertIn('financial_matching_orders', block)
        self.assertIn("user_id: 'eq.' + String(user.uid)", block)
        self.assertIn('ORDER_READ_UNAVAILABLE', block)

if __name__ == '__main__':
    unittest.main()
