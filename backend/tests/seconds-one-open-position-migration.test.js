'use strict';
// Source-level guard for the Seconds one-open-position migration.
// This does NOT replace PostgreSQL execution or concurrency tests in isolated staging.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('one-open-position migration fails closed on pre-existing duplicate open rows', () => {
  const sql = read('supabase/sql/financial_seconds_one_open_position_v1.sql');
  assert.match(sql, /FROM public\.seconds_contract_positions\s+WHERE status = 'open'\s+GROUP BY user_id\s+HAVING count\(\*\) > 1/i);
  assert.match(sql, /RAISE EXCEPTION 'cannot enforce one-open-position rule/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.seconds_contract_positions/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.seconds_contract_positions[\s\S]{0,180}SET status\s*=\s*'settled'/i);
});

test('database enforces one open position per user with a partial unique index', () => {
  const sql = read('supabase/sql/financial_seconds_one_open_position_v1.sql');
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS seconds_contract_positions_one_open_per_user_idx\s+ON public\.seconds_contract_positions \(user_id\)\s+WHERE status = 'open'/i);
});

test('submit RPC maps only the one-open-position index conflict to its stable business code', () => {
  const sql = read('supabase/sql/financial_seconds_one_open_position_v1.sql');
  assert.match(sql, /EXCEPTION WHEN unique_violation THEN[\s\S]*GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME/i);
  assert.match(sql, /IF v_constraint_name = 'seconds_contract_positions_one_open_per_user_idx' THEN\s+RETURN jsonb_build_object\('ok',false,'code','OPEN_POSITION_EXISTS'\)/i);
  assert.match(sql, /RETURN jsonb_build_object\('ok',false,'code','IDEMPOTENCY_CONFLICT'\)/i);
});

test('migration is included in the documented runner and migration order', () => {
  const runner = read('supabase-migration-runner.sql');
  const order = read('supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md');
  assert.ok(runner.includes('financial_seconds_one_open_position_v1.sql'));
  assert.ok(order.includes('financial_seconds_one_open_position_v1.sql'));
});

test('migration source explicitly requires staging validation before application', () => {
  const sql = read('supabase/sql/financial_seconds_one_open_position_v1.sql');
  assert.match(sql, /Apply only after the documented staging drill/i);
  assert.match(sql, /Do not enable financial cutover/i);
});
