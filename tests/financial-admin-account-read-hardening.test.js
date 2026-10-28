const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_admin_account_read_api_v1.sql'), 'utf8');

test('admin normalized balance reader rejects unsupported assets and malformed amounts', () => {
  assert.match(api, /if \(!\['USDT', 'BTC', 'ETH', 'SOL'\]\.includes\(asset\)\) throw new Error\('Admin account balance response invalid'\)/);
  assert.match(api, /!Number\.isFinite\(b\.free\).*?!Number\.isFinite\(b\.frozen\).*?b\.free < 0 \|\| b\.frozen < 0/);
});

test('admin normalized balance reader remains bounded and rejects unrequested account identities', () => {
  assert.match(api, /userIds\.length > 200/);
  assert.match(api, /!userIds\.includes\(uid\)/);
  assert.match(sql, /cardinality\(p_user_ids\) > 200/);
  assert.match(sql, /grant execute on function public\.read_admin_account_balances_v1\(text\[\]\) to service_role/i);
});

test('admin user list and detail keep normalized reads fail-closed', () => {
  assert.match(api, /if \(financialPostgresReadsEnabled\(\)\) \{[\s\S]*?readAdminAccountBalances\(list\.map/);
  assert.match(api, /financial_balance_source = 'postgres_financial_ledger'/);
  assert.match(api, /code: 'FINANCIAL_READ_UNAVAILABLE'/);
});
