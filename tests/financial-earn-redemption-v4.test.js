const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/sql/financial_earn_redemption_idempotency_v4.sql'), 'utf8');

test('redeem migration persists a unique request ID and request hash', () => {
  assert.match(sql, /add column if not exists redeem_request_id text/i);
  assert.match(sql, /add column if not exists redeem_request_hash text/i);
  assert.match(sql, /create unique index if not exists earn_positions_redeem_request_id_uq/i);
});
test('only exact request ID and hash can replay a redeemed position', () => {
  assert.match(sql, /v_position\.redeem_request_id = p_request_id/i);
  assert.match(sql, /v_position\.redeem_request_hash is distinct from p_request_hash/i);
  assert.match(sql, /earn position already redeemed with a different request/i);
});
test('redemption records status, operation and idempotency metadata together', () => {
  assert.match(sql, /status = 'redeemed',[\s\S]*redeem_operation_id = v_operation_id,[\s\S]*redeem_request_id = p_request_id,[\s\S]*redeem_request_hash = p_request_hash/i);
  assert.match(sql, /'earn-redeem:' \|\| p_request_id/i);
  assert.match(sql, /length\(p_request_id\) > 100/i);
});
test('browser roles cannot execute the money-moving RPC', () => {
  assert.match(sql, /revoke all on function public\.redeem_earn_atomic\(text,text,numeric,text,text\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.redeem_earn_atomic\(text,text,numeric,text,text\)\s+to service_role/i);
});
