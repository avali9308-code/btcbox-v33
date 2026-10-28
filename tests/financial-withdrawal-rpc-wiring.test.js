const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/api.js'), 'utf8');

test('withdrawal creation uses atomic PostgreSQL RPC behind the opt-in cutover flag', () => {
  const start = source.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = source.indexOf('// ---------- GET /api/market ----------', start);
  const route = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /manualDepositRpcEnabled\(\)/);
  assert.match(route, /rpc\/create_withdrawal_atomic/);
  assert.match(route, /p_request_id:\s*requestId/);
  assert.match(route, /FINANCIAL_RPC_UNAVAILABLE/);
  assert.doesNotMatch(route, /user\.balances\[coin\]\.(?:free|frozen)\s*[-+]?=/);
  assert.doesNotMatch(route, /await saveDB\(db\)/);
});

test('admin approve and reject use one atomic review RPC in cutover mode', () => {
  const approveStart = source.indexOf("if (sub === 'withdraw/approve' && method === 'POST')");
  const rejectStart = source.indexOf("if (sub === 'withdraw/reject' && method === 'POST')");
  const end = source.indexOf("if (sub === 'kyc/approve'", rejectStart);
  const routes = source.slice(approveStart, end);
  assert.ok(approveStart >= 0 && rejectStart > approveStart && end > rejectStart);
  assert.equal((routes.match(/rpc\/review_withdrawal_atomic/g) || []).length, 2);
  assert.match(routes, /p_approve:\s*true/);
  assert.match(routes, /p_approve:\s*false/);
  assert.match(routes, /WITHDRAWAL_ALREADY_PROCESSED/);
  assert.match(routes, /FINANCIAL_RPC_NOT_CONFIGURED/);
});

test('round 99 explicitly prevents premature production cutover while reads remain legacy', () => {
  const changelog = fs.readFileSync(path.join(__dirname, '..', 'ROUND-99-CHANGELOG.md'), 'utf8');
  assert.match(changelog, /Do not enable `FINANCIAL_POSTGRES_RPC_ENABLED` in production yet/i);
  assert.match(changelog, /profile\/balance reads and the admin pending-withdrawal list still read the legacy/i);
});
