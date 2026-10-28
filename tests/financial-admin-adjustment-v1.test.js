const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_admin_adjustment_v1.sql'), 'utf8').toLowerCase();
const gate = fs.readFileSync(path.join(root, 'scripts/financial_cutover_gate.py'), 'utf8');

test('duplicate on-chain deposit txids fail closed before unique index creation', () => {
  assert.match(sql, /duplicate deposit txids found/);
  assert.match(sql, /create unique index if not exists deposit_records_txid_asset_network_uq/);
  assert.ok(sql.indexOf('duplicate deposit txids found') < sql.indexOf('create unique index if not exists'));
});

test('confirmed deposits cannot have identity or amount changed or status reversed', () => {
  for (const field of ['user_id', 'asset', 'network', 'amount', 'txid', 'idempotency_key']) {
    assert.ok(sql.includes(`new.${field} is distinct from old.${field}`));
  }
  assert.match(sql, /confirmed deposit status cannot be reversed/);
});

test('admin adjustment is idempotent, validates canonical payload hash and records audit', () => {
  assert.match(sql, /admin_adjustment_atomic/);
  assert.match(sql, /request hash does not match adjustment payload/);
  assert.match(sql, /idempotency key payload mismatch/);
  assert.match(sql, /public\.apply_financial_operation/);
  assert.match(sql, /insert into public\.financial_audit_log/);
  assert.match(sql, /if coalesce\(\(v_result->>'duplicate'\)::boolean, false\) then/);
});

test('cutover gate requires round 75 migration and service-role-only execution', () => {
  assert.match(gate, /supabase\/sql\/financial_admin_adjustment_v1\.sql/);
  assert.match(sql, /revoke all on function public\.admin_adjustment_atomic/);
  assert.match(sql, /to service_role/);
});
