const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', 'financial_spot_trade_v3.sql'), 'utf8');

test('spot trade RPC stores order and two asset ledger entries in one transaction function', () => {
  assert.match(sql, /create or replace function public\.execute_spot_trade_atomic/i);
  assert.match(sql, /insert into public\.financial_ledger[\s\S]*?v_base_delta[\s\S]*?v_quote_delta/i);
  assert.match(sql, /insert into public\.financial_spot_orders/i);
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/i);
  assert.match(sql, /idempotency key payload mismatch/i);
});

test('spot trade RPC checks insufficient funds and is service-role only', () => {
  assert.match(sql, /insufficient quote funds/i);
  assert.match(sql, /insufficient base funds/i);
  assert.match(sql, /revoke all on function public\.execute_spot_trade_atomic[\s\S]*?from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.execute_spot_trade_atomic[\s\S]*?to service_role/i);
});
