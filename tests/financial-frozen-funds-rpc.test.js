const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_admin_adjustment_v1.sql'), 'utf8').toLowerCase();

test('admin financial RPC supports available-balance adjustment and paired freeze/unfreeze deltas', () => {
  const start = api.indexOf("if (sub === 'user/balance' && method === 'POST')");
  const end = api.indexOf("if (sub === 'user/freeze' && method === 'POST')", start);
  const route = api.slice(start, end);
  assert.match(route, /\['adjust', 'freeze', 'unfreeze'\]/);
  assert.match(route, /mode === 'freeze'\) \{ availableDelta = -delta; frozenDelta = delta; \}/);
  assert.match(route, /mode === 'unfreeze'\) \{ availableDelta = delta; frozenDelta = -delta; \}/);
  assert.match(route, /p_available_delta: availableDeltaText, p_frozen_delta: frozenDeltaText/);
  assert.match(route, /requestHash/);
  assert.match(admin, /freeze=冻结资金，unfreeze=解冻资金/);
  assert.match(admin, /mode:mode/);
});

test('PostgreSQL admin adjustment validates both buckets and applies both deltas through the same ledger transaction', () => {
  assert.match(sql, /p_available_delta numeric/);
  assert.match(sql, /p_frozen_delta numeric/);
  assert.match(sql, /public\.apply_financial_operation\(/);
  assert.match(sql, /p_available_delta,/);
  assert.match(sql, /p_frozen_delta,/);
  assert.match(sql, /insert into public\.financial_audit_log/);
});
