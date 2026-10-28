const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'pages/withdraw.html'), 'utf8');

test('withdrawal always verifies fund password; 2FA is required only when enabled', () => {
  const start = api.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = api.indexOf('// ---------- GET /api/market ----------', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.match(route, /verifyFundPassword\(user, fundPassword\)/);
  assert.match(route, /FUND_PASSWORD_REQUIRED/);
  assert.match(route, /if \(user\.twofa_enabled && !totpVerify\(user\.twofa_secret, String\(body\.twofa_code \|\| ''\)\)\)/);
  assert.doesNotMatch(route, /if \(!user\.twofa_enabled\).*TWOFA_REQUIRED/s);
});

test('withdrawal form sends fund password and conditionally asks for 2FA', () => {
  assert.match(page, /id="__fundPwd"/);
  assert.match(page, /fund_password:fundPassword/);
  assert.match(page, /twofaEnabled \? .*__twofa/s);
  assert.match(page, /submitWithdraw\(addr, amt, fundPassword, tf\)/);
  assert.doesNotMatch(page, /if\(!twofaEnabled\).*withdrawTwofaMustEnable/s);
});
