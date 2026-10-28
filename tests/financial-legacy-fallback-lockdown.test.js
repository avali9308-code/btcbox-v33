const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/api.js'), 'utf8');
function routeBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `route markers missing: ${startMarker}`);
  return source.slice(start, end);
}
test('withdrawal route has no direct legacy balance writes and requires the cutover gate', () => {
  const route = routeBetween("if (path === 'withdraw' && method === 'POST')", '// ---------- GET /api/market ----------');
  assert.match(route, /if \(!financialWritesEnabled\(\)\).*FINANCIAL_CUTOVER_INCOMPLETE/);
  assert.match(route, /rpc\/create_withdrawal_atomic/);
  assert.doesNotMatch(route, /user\.balances\[coin\]\.(?:free|frozen)\s*[-+]?=/);
  assert.doesNotMatch(route, /await saveDB\(db\)/);
});
test('admin balance adjustment has no direct legacy balance writes', () => {
  const route = routeBetween("if (sub === 'user/balance' && method === 'POST')", '// POST /api/admin/user/freeze');
  assert.match(route, /FINANCIAL_CUTOVER_INCOMPLETE/);
  assert.match(route, /rpc\/admin_adjustment_atomic/);
  assert.doesNotMatch(route, /u\.balances\[coin\]\.free\s*=/);
  assert.doesNotMatch(route, /auditAdmin\('user_balance_adjust'/);
  assert.doesNotMatch(route, /await saveDB\(db\)/);
});
test('withdrawal approve and reject are RPC-only with no legacy frozen-balance mutations', () => {
  const route = routeBetween("if (sub === 'withdraw/approve' && method === 'POST')", "if (sub === 'kyc/approve'");
  assert.equal((route.match(/FINANCIAL_CUTOVER_INCOMPLETE/g) || []).length, 4);
  assert.equal((route.match(/rpc\/review_withdrawal_atomic/g) || []).length, 2);
  assert.doesNotMatch(route, /balance\.(?:free|frozen)\s*[-+]?=/);
  assert.doesNotMatch(route, /await saveDB\(db\)/);
});
test('account profile and access-management routes remain independent of financial cutover', () => {
  const freezeRoute = routeBetween("if (sub === 'user/freeze' && method === 'POST')", '// POST /api/admin/user/reset-pwd');
  const passwordRoute = routeBetween("if (sub === 'user/reset-pwd' && method === 'POST')", '// POST /api/admin/user/reset-email');
  assert.match(freezeRoute, /u\.frozen = frozen/);
  assert.match(passwordRoute, /user_password_reset/);
  assert.doesNotMatch(freezeRoute, /FINANCIAL_CUTOVER_INCOMPLETE/);
  assert.doesNotMatch(passwordRoute, /FINANCIAL_CUTOVER_INCOMPLETE/);
});
