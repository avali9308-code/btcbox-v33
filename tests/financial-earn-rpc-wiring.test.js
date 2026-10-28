const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const readSql = fs.readFileSync(path.join(root, 'supabase/sql/financial_read_api_earn_v1.sql'), 'utf8');
const page = fs.readFileSync(path.join(root, 'pages/earn.html'), 'utf8');

test('earn API uses atomic subscribe/redeem RPCs only behind complete ledger read/write cutover', () => {
  const start = api.indexOf("if (path === 'earn' && method === 'POST')");
  const end = api.indexOf("if (path === 'support/chat' && method === 'POST')", start);
  const route = api.slice(start, end);
  assert.match(route, /financialWritesEnabled\(\)/);
  assert.match(route, /rpc\/subscribe_earn_atomic/);
  assert.match(route, /rpc\/redeem_earn_atomic/);
  assert.doesNotMatch(route, /await saveDB\(db\)/);
  assert.doesNotMatch(route, /user\.balances\.USDT\.free\s*[-+]=/);
});

test('normalized account snapshot returns earn positions from PostgreSQL for the existing holdings UI', () => {
  assert.match(readSql, /from public\.earn_positions/);
  assert.match(readSql, /'earn_records', v_earn_records/);
  assert.match(api, /Array\.isArray\(result\.earn_records\)/);
  assert.match(api, /earn_records: financialSnapshot \? financialSnapshot\.earn_records : user\.earn_records/);
});

test('earn redemption UI sends a stable idempotency request ID', () => {
  assert.match(page, /earnRequestId\('redeem_' \+ b\.dataset\.rid, 0\)/);
  assert.match(page, /action:'redeem', record_id:b\.dataset\.rid, request_id:redeemReq\.id/);
});
