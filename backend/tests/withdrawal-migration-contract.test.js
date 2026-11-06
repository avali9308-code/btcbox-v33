'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const base = read('supabase/sql/0002_financial_ledger_v1.sql');
const lifecycle = read('supabase/sql/0003_financial_lifecycle_v2.sql');
const review = read('supabase/sql/0022_withdrawal_admin_review_status_v1.sql');
const payout = read('supabase/sql/0023_withdrawal_manual_payout_completion_v1.sql');
const api = read('api-core.js');
const runner = read('scripts/run_migrations.sh');

test('canonical withdrawal schema is established by 0002 and extended by 0003', () => {
  assert.match(base, /CREATE TABLE IF NOT EXISTS public\.withdrawal_requests/i);
  assert.doesNotMatch(base, /CREATE TABLE IF NOT EXISTS public\.withdrawals\b/i);
  assert.match(lifecycle, /ALTER TABLE public\.withdrawal_requests/i);
  assert.match(lifecycle, /CREATE OR REPLACE FUNCTION public\.create_withdrawal_atomic\(/i);
  assert.match(lifecycle, /CREATE OR REPLACE FUNCTION public\.review_withdrawal_atomic\(/i);
});

test('0022 is a compatibility guard and cannot create a competing withdrawal RPC or table', () => {
  assert.match(review, /to_regclass\('public\.withdrawal_requests'\)/i);
  assert.match(review, /information_schema\.columns/i);
  assert.doesNotMatch(review, /public\.withdrawals\b/i);
  assert.doesNotMatch(review, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_withdrawal_atomic/i);
  assert.doesNotMatch(review, /pending_admin_review/i);
});

test('API and canonical lifecycle keep one pending state for the manual admin-review workflow', () => {
  assert.match(lifecycle, /'pending',p_request_id,v_op_id/i);
  assert.match(lifecycle, /IF v_w\.status <> 'pending' THEN/i);
  assert.match(lifecycle, /case when p_approve then 'approved' else 'rejected' end/i);
  const start = api.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = api.indexOf('// ---------- GET /api/market ----------', start);
  assert.ok(start >= 0 && end > start);
  const handler = api.slice(start, end);
  assert.match(handler, /rpc\/create_withdrawal_atomic/);
  assert.match(handler, /p_request_hash: requestHash/);
  assert.doesNotMatch(handler, /p_require_admin_review/);
  assert.match(handler, /Withdrawal request submitted for manual review/);
});

test('0023 payout completion uses the same canonical table and requires prior approval', () => {
  assert.match(payout, /ALTER TABLE public\.withdrawal_requests/i);
  assert.match(payout, /v_w public\.withdrawal_requests%rowtype/i);
  assert.match(payout, /IF v_w\.status<>'approved' THEN/i);
  assert.match(payout, /status='completed'/i);
  assert.match(payout, /payout_reference/);
});

test('numbered migration runner preserves ordered 0022 then 0023 execution', () => {
  assert.match(runner, /\[0-9\]\[0-9\]\[0-9\]\[0-9\]_\*\.sql/);
  assert.ok(review.indexOf('to_regclass') >= 0);
  assert.ok(payout.indexOf('ALTER TABLE public.withdrawal_requests') >= 0);
});
