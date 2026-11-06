'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const migration = read('supabase/migrations/20261106042714_seconds_policy_snapshot_and_admin_queue_v1.sql');
const api = read('api-core.js');
const trading = read('assets/js/views-trading.js');
const admin = read('assets/js/views-account.js');
const app = read('assets/js/app-core.js');

test('Seconds policy has safe defaults and keeps 85 percent as a minimum', () => {
  assert.match(migration, /enabled boolean NOT NULL DEFAULT true/i);
  assert.match(migration, /allowed_durations integer\[\] NOT NULL DEFAULT ARRAY\[30,60,300,900\]/i);
  assert.ok(migration.includes('min_order_amount numeric(38,18) NOT NULL DEFAULT 1'));
  assert.ok(migration.includes('max_order_amount numeric(38,18) NOT NULL DEFAULT 1000000000000'));
  assert.ok(migration.includes('payout_rate numeric(12,6) NOT NULL DEFAULT 0.85 CHECK (payout_rate >= 0.85)'));
  assert.match(migration, /p_payout_rate < 0\.85/i);
});

test('new orders lock and enforce one policy version and snapshot it into each position', () => {
  assert.match(migration, /FROM public\.seconds_contract_policy\s+WHERE singleton = true\s+FOR SHARE/i);
  assert.match(migration, /p_duration_sec = ANY\(v_policy\.allowed_durations\)/i);
  assert.match(migration, /p_amount < v_policy\.min_order_amount OR p_amount > v_policy\.max_order_amount/i);
  assert.match(migration, /policy_version,payout_rate/i);
  assert.match(migration, /v_policy\.policy_version,v_policy\.payout_rate/i);
  assert.match(migration, /WHERE user_id=p_user_id AND asset='USDT'\s+FOR UPDATE/i);
});

test('settlement uses the position payout snapshot, not the latest policy', () => {
  assert.match(migration, /round\(v_pos\.amount \* v_pos\.payout_rate, 18\)/i);
  assert.doesNotMatch(migration, /round\(v_pos\.amount \* 0\.85, 18\)/i);
  assert.match(migration, /policy_version.*payout_rate/i);
});

test('seconds order preserves exact decimal strings and delegates min/max to the database policy', () => {
  assert.ok(api.includes("const amountText = typeof body.amount === 'string' ? body.amount.trim() : '';"));
  assert.ok(api.includes('p_amount: amountText'));
  assert.ok(app.includes('amount:String(o.amount)'));
  assert.ok(trading.includes('amount:amountText'));
  const start = api.indexOf('// ---------- POST /api/seconds/order ----------');
  const end = api.indexOf('// ---------- POST /api/seconds/settle ----------', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(api.slice(start, end), /amount > 1e12/);
});

test('policy and admin open-position RPCs are server-only', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.read_seconds_policy_v1\(\) FROM PUBLIC,anon,authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.read_seconds_policy_v1\(\) TO service_role/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.read_admin_seconds_positions_v1\(integer,integer\) FROM PUBLIC,anon,authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.read_admin_seconds_positions_v1\(integer,integer\) TO service_role/i);
  assert.ok(migration.includes("WHERE status='open'"));
  assert.ok(migration.includes('ORDER BY created_at DESC,position_id DESC'));
  assert.ok(migration.includes('LIMIT p_limit OFFSET p_offset'));
});

test('API exposes policy to clients but requires admin authentication for updates and admin queue', () => {
  assert.match(api, /GET \/api\/seconds\/policy/);
  assert.match(api, /enabled: result\.policy\.enabled === true && financialWritesEnabled\(\)/);
  assert.match(api, /sub === 'seconds-policy' && \(method === 'GET' \|\| method === 'POST'\)/);
  assert.match(api, /sub === 'seconds-positions' && method === 'GET'/);
  assert.match(api, /update_seconds_policy_v1/);
  assert.match(api, /read_admin_seconds_positions_v1/);
  assert.doesNotMatch(api, /SECONDS_ALLOWED_DURATIONS/);
});

test('user trading screen does not block new positions merely because another is open', () => {
  assert.match(trading, /busy=!!secondsPendingIntent\|\|!!\(secondsUserKey&&state\._secondsOrderUnknownUserKey===secondsUserKey\)/);
  assert.doesNotMatch(trading, /busy=state\.secondsPositions\.open\.length/);
  assert.doesNotMatch(trading, /busy=!!\(state\.secondsPositions\.open&&state\.secondsPositions\.open\.length\)/);
  assert.match(trading, /applySecondsPolicy/);
  assert.ok(trading.includes('policy.allowed_durations'));
  assert.ok(trading.includes('policyReady'));
  assert.match(trading, /state\.user&&!policyReady/);
  assert.ok(trading.includes('data-sec-countdown'));
  assert.ok(trading.includes('settlingPositionIds'));
  assert.doesNotMatch(trading, /Only one open position/);
});

test('admin screen includes policy editor, open positions, and API adapter methods', () => {
  assert.match(admin, /data-atab="seconds"/);
  assert.match(admin, /admin-sec-durations/);
  assert.match(admin, /admin-sec-payout/);
  assert.match(admin, /全部未完成仓位/);
  assert.match(app, /adminSecondsPolicyUpdate/);
  assert.match(app, /adminSecondsPositions/);
  assert.match(app, /secondsPolicyGet/);
});

test('numbered SQL runner and timestamped CLI migration match', () => {
  assert.equal(migration, read('supabase/sql/0025_seconds_policy_snapshot_and_admin_queue_v1.sql'));
});
