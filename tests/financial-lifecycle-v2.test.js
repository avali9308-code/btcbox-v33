const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/sql/financial_lifecycle_v2.sql'), 'utf8');

test('withdrawal request freezes funds and persists request atomically', () => {
  assert.match(sql, /create_withdrawal_atomic[\s\S]*?apply_financial_operation[\s\S]*?insert into public\.withdrawal_requests/i);
  assert.match(sql, /withdrawal_requests[\s\S]*?for update/i);
  assert.match(sql, /withdraw-freeze:/i);
});
test('withdrawal review locks pending request and records balance plus audit in same transaction', () => {
  assert.match(sql, /review_withdrawal_atomic[\s\S]*?for update[\s\S]*?v_w\.status <> 'pending'[\s\S]*?apply_financial_operation[\s\S]*?update public\.withdrawal_requests[\s\S]*?insert into public\.financial_audit_log/i);
});
test('legacy deposit confirmation fails closed until trusted chain verification is used', () => {
  const match = sql.match(/create or replace function public\.confirm_deposit_atomic\([\s\S]*?as \$\$([\s\S]*?)\$\$;/i);
  assert.ok(match, 'confirm_deposit_atomic definition exists');
  assert.match(match[1], /raise exception[\s\S]*trusted chain verification required/i);
  assert.doesNotMatch(match[1], /apply_financial_operation|update public\.deposit_records/i);
});
test('earn subscribe and redeem use locked state and idempotent balance operations', () => {
  assert.match(sql, /subscribe_earn_atomic[\s\S]*?apply_financial_operation[\s\S]*?insert into public\.earn_positions/i);
  assert.match(sql, /redeem_earn_atomic[\s\S]*?for update[\s\S]*?apply_financial_operation[\s\S]*?set status='redeemed'/i);
});
test('lifecycle RPCs are restricted to server service role', () => {
  assert.match(sql, /revoke all on function public\.review_withdrawal_atomic[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.confirm_deposit_atomic[\s\S]*to service_role/i);
});
