const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_admin_read_api_v1.sql'), 'utf8');

test('admin withdrawal reads use normalized RPC only behind full read gate', () => {
  assert.match(api, /async function readAdminWithdrawalSnapshot\(\)/);
  assert.match(api, /if \(financialPostgresReadsEnabled\(\)\) \{[\s\S]*?readAdminWithdrawalSnapshot\(\)/);
  assert.match(api, /source: 'postgres_financial_ledger'/);
  assert.match(api, /code: 'FINANCIAL_READ_UNAVAILABLE'/);
});

test('admin stats count uses normalized pending count when enabled', () => {
  assert.match(api, /pendingWd = \(await readAdminWithdrawalSnapshot\(\)\)\.pending_count/);
});

test('admin RPC exposes only pending rows and is service-role only', () => {
  assert.match(sql, /where status = 'pending'/i);
  assert.match(sql, /limit 200/i);
  assert.match(sql, /revoke all on function public\.read_admin_withdrawal_snapshot_v1\(\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.read_admin_withdrawal_snapshot_v1\(\) to service_role/i);
});
