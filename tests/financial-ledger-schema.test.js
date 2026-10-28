const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_ledger_v1.sql'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'FINANCIAL-REMEDIATION-PLAN.md'), 'utf8');

test('normalized financial schema uses exact decimal values and non-negative balance constraints', () => {
  assert.match(sql, /available numeric\(38,18\) not null default 0 check \(available >= 0\)/i);
  assert.match(sql, /frozen numeric\(38,18\) not null default 0 check \(frozen >= 0\)/i);
  assert.match(sql, /available_after numeric\(38,18\) not null check \(available_after >= 0\)/i);
});
test('financial operations enforce globally unique idempotency keys and request-payload binding', () => {
  assert.match(sql, /idempotency_key text not null unique/i);
  assert.match(sql, /v_op\.request_hash <> p_request_hash/i);
  assert.match(sql, /return jsonb_build_object\('ok',true,'duplicate',true/i);
});
test('balance update and ledger insert occur in one PostgreSQL function transaction', () => {
  assert.match(sql, /for update/i);
  assert.match(sql, /update public\.financial_accounts[\s\S]*?returning available, frozen into v_available, v_frozen/i);
  assert.match(sql, /insert into public\.financial_ledger[\s\S]*?values \(v_op\.id/i);
  assert.match(sql, /raise exception 'insufficient funds'/i);
});
test('browser roles cannot directly access financial tables or execute the RPC', () => {
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.apply_financial_operation[\s\S]*to service_role/i);
});
test('plan explicitly prevents premature cutover and documents migration gates', () => {
  assert.match(plan, /does not import legacy JSON data or switch the live API/i);
  assert.match(plan, /No live financial operations should be enabled/i);
  assert.match(plan, /restore a backup into a clean staging project/i);
});
