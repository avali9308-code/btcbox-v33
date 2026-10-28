const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('financial account snapshot read is opt-in behind both cutover approvals and a read flag', () => {
  const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
  assert.match(api, /function financialPostgresReadsEnabled\(\)[\s\S]*?return manualDepositRpcEnabled\(\) && process\.env\.FINANCIAL_POSTGRES_READS_ENABLED === '1'/);
  assert.match(api, /readFinancialAccountSnapshot\(user\.uid\)/);
  assert.match(api, /FINANCIAL_READ_UNAVAILABLE/);
});

test('normalized read SQL returns only the requested user account and latest 20 withdrawals', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_read_api_v1.sql'), 'utf8');
  assert.match(sql, /where user_id = p_user_id/);
  assert.match(sql, /order by created_at desc\s+limit 20/);
  assert.match(sql, /revoke all on function public\.read_financial_account_snapshot_v1\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.read_financial_account_snapshot_v1\(text\) to service_role/);
});

test('account response uses the normalized snapshot only when explicitly enabled', () => {
  const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
  assert.match(api, /const accountBalances = financialSnapshot \? financialSnapshot\.balances : user\.balances/);
  assert.match(api, /withdrawals: financialSnapshot \? financialSnapshot\.withdrawals : user\.withdrawals\.slice\(-20\)/);
});
