const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/sql/financial_earn_policy_v5.sql'), 'utf8');

test('earn catalog binds products to assets, rates, terms and precision', () => {
  assert.match(sql, /create table if not exists public\.earn_product_catalog/i);
  assert.match(sql, /\('flex_BTC',\s*'BTC',\s*'demand'/i);
  assert.match(sql, /\('flex_ETH',\s*'ETH',\s*'demand'/i);
  assert.match(sql, /amount_scale smallint/i);
});

test('subscription rejects unknown/inactive products, asset mismatches and excessive precision', () => {
  assert.match(sql, /where product_id = p_product_id and active = true/i);
  assert.match(sql, /v_product\.asset <> p_asset/i);
  assert.match(sql, /p_principal <> round\(p_principal, v_product\.amount_scale\)/i);
  assert.match(sql, /subscribe_request_hash <> p_request_hash/i);
});

test('redemption no longer accepts payout from the caller', () => {
  assert.match(sql, /drop function if exists public\.redeem_earn_atomic\(text,text,numeric,text,text\)/i);
  assert.match(sql, /create or replace function public\.redeem_earn_atomic\(\s*p_position_id text,\s*p_user_id text,\s*p_request_id text,\s*p_request_hash text/i);
  assert.match(sql, /v_payout := v_position\.principal \+ v_interest/i);
  assert.match(sql, /v_position\.early_fee_percent/i);
  assert.match(sql, /guard_earn_position_snapshot[\s\S]*?before update on public\.earn_positions/i);
});

test('policy migration fails closed on historical product/asset mismatch and restricts RPC access', () => {
  assert.match(sql, /reconcile positions before applying Round 72/i);
  assert.match(sql, /historical redeemed earn positions lack complete idempotency metadata/i);
  assert.match(sql, /revoke all on function public\.redeem_earn_atomic\(text,text,text,text\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.redeem_earn_atomic\(text,text,text,text\) to service_role/i);
});
