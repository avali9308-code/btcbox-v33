const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_admin_account_read_api_v1.sql'), 'utf8');

test('admin account balances use a validated normalized RPC behind full read gate', () => {
  assert.match(api, /async function readAdminAccountBalances\(userIds\)/);
  assert.match(api, /read_admin_account_balances_v1/);
  assert.match(api, /userIds\.length > 200/);
  assert.match(api, /Number\.isFinite\(b\.free\)/);
  assert.match(api, /if \(financialPostgresReadsEnabled\(\)\) \{[\s\S]*?readAdminAccountBalances\(list\.map/);
});

test('admin user list and detail fail closed if normalized financial read fails', () => {
  assert.match(api, /normalizedBalances = await readAdminAccountBalances/);
  assert.match(api, /safeUser\.balances = normalized\[String\(u\.uid\)\] \|\| \{\}/);
  assert.match(api, /financial_balance_source = 'postgres_financial_ledger'/);
  assert.match(api, /code: 'FINANCIAL_READ_UNAVAILABLE'/);
});

test('SQL bounds batch size and restricts RPC execution to service role', () => {
  assert.match(sql, /cardinality\(p_user_ids\) > 200/i);
  assert.match(sql, /where user_id = any\(p_user_ids\)/i);
  assert.match(sql, /revoke all on function public\.read_admin_account_balances_v1\(text\[\]\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.read_admin_account_balances_v1\(text\[\]\) to service_role/i);
});

test('admin normalized reads materialize missing accounts as zero balances, never legacy fallback', () => {
  assert.match(api, /const normalized = \{\};[\s\S]*?for \(const uid of userIds\) normalized\[uid\] = Object\.assign\(emptyBalances\(\), result\.accounts\[uid\] \|\| \{\}\)/);
  assert.match(api, /safeUser\.balances = normalized\[String\(u\.uid\)\] \|\| \{\}/);
  assert.match(api, /const balances = normalizedBalances \? \(normalizedBalances\[String\(u\.uid\)\] \|\| \{\}\) : \(u\.balances \|\| \{\}\)/);
});
