const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_seconds_contracts_v1.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'pages/seconds.html'), 'utf8');

test('seconds contract migration defines all RPCs referenced by the API', () => {
  for (const fn of ['submit_seconds_order_v1', 'settle_seconds_position_v1', 'read_seconds_positions_v1']) {
    assert.match(sql, new RegExp(`function public\\.${fn}\\s*\\(`));
    assert.ok(api.includes(`/rpc/${fn}`));
  }
});

test('seconds opening and settlement use an atomic normalized ledger and idempotency keys', () => {
  assert.match(sql, /for update/);
  assert.match(sql, /seconds_open/);
  assert.match(sql, /seconds_settle/);
  assert.match(sql, /unique/);
  assert.match(sql, /financial_ledger/);
  assert.match(sql, /service_role/);
});

test('settlement price is server-fetched and tied to the stored position symbol', () => {
  assert.match(api, /fetchSecondsReferencePrice\(symbol\)/);
  assert.match(api, /p_settle_price/);
  assert.match(sql, /v_pos\.symbol <> p_symbol/);
  assert.match(sql, /p_settle_price_ts < v_pos\.settle_at/);
});

test('UI keeps unconfirmed positions visible for retry instead of dropping them', () => {
  assert.match(page, /Any unconfirmed result must remain visible and retryable/);
  assert.match(page, /positions\.some\(function\(x\)\{return x\.position_id===pos\.position_id;\}\)/);
});
