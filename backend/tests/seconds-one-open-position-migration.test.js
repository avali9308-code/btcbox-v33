'use strict';
// Source-level migration guards only; isolated PostgreSQL concurrency tests are still required.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const migrationPath = 'supabase/migrations/20261106041624_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql';

test('forward migration removes only the per-user open-position cap', () => {
  const sql = read(migrationPath);
  assert.match(sql, /DROP INDEX IF EXISTS public\.seconds_contract_positions_one_open_per_user_idx/i);
  assert.equal((sql.match(/DROP INDEX/gi) || []).length, 1);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE\s+FROM\s+public\.seconds_contract_positions|DROP CONSTRAINT/i);
  assert.doesNotMatch(sql, /DROP INDEX[^;]*(position_id|open_request_id|open_operation_id|settle_request_id|settle_operation_id)/i);
});

test('settled-position idempotency accepts only the same request ID and same hash', () => {
  const sql = read(migrationPath);
  const sameRequest = sql.indexOf('IF v_pos.settle_request_id = p_request_id THEN');
  const hashConflict = sql.indexOf("'code','IDEMPOTENCY_CONFLICT'", sameRequest);
  const duplicateSuccess = sql.indexOf("'duplicate',true", hashConflict);
  const differentRequest = sql.indexOf("'code','POSITION_ALREADY_SETTLED'", duplicateSuccess);
  assert.ok(sameRequest >= 0 && hashConflict > sameRequest, 'same request ID must compare hashes');
  assert.ok(duplicateSuccess > hashConflict, 'same request ID + same hash must be duplicate success');
  assert.ok(differentRequest > duplicateSuccess, 'different request ID must return POSITION_ALREADY_SETTLED');
  assert.match(sql, /settle_request_hash IS DISTINCT FROM p_request_hash/i);
});

test('multi-position migration retains account and position row locks and independent idempotency keys', () => {
  const base = read('supabase/sql/0014_financial_seconds_contracts_v1.sql');
  const sql = read(migrationPath);
  assert.match(base, /WHERE user_id=p_user_id AND asset='USDT'\s+FOR UPDATE/i);
  assert.match(sql, /WHERE position_id = p_position_id AND user_id = p_user_id\s+FOR UPDATE/i);
  assert.match(sql, /WHERE user_id = p_user_id AND asset = 'USDT'\s+FOR UPDATE/i);
  assert.match(base, /position_id text primary key/i);
  assert.match(base, /open_request_id text not null unique/i);
  assert.match(base, /open_operation_id uuid not null unique/i);
  assert.match(base, /settle_request_id text unique/i);
  assert.match(base, /settle_operation_id uuid unique/i);
  assert.match(base, /financial_operations\(idempotency_key/i);
  assert.match(base, /financial_ledger\(/i);
});

test('timestamped Supabase migration and legacy numbered runner mirror are identical', () => {
  assert.equal(
    read(migrationPath),
    read('supabase/sql/0024_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql')
  );
});


test('migration guide documents the canonical numbered path and correct final migration order', () => {
  const order = read('supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md');
  assert.match(order, /backend\/supabase\/migrations\/ is[^\\n]*not a complete CLI bootstrap path/i);
  assert.match(order, /do not mix the numbered runner and Supabase CLI timestamped path/i);
  const payout = order.indexOf('15. `0023_withdrawal_manual_payout_completion_v1.sql`');
  const seconds = order.indexOf('16. `0024_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql`');
  const policy = order.indexOf('17. `0025_seconds_policy_snapshot_and_admin_queue_v1.sql`');
  assert.ok(payout >= 0 && seconds > payout && policy > seconds, 'final migrations must be listed in dependency order');
  assert.equal((order.match(/0024_seconds_unlimited_open_positions_and_settlement_idempotency_v1\.sql/g) || []).length, 1);
});
