const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'api.js'), 'utf8');

test('withdrawal checks frozen-account state after session authentication', () => {
  const start = api.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = api.indexOf("if (path === 'market' && method === 'GET')", start);
  const route = api.slice(start, end);
  assert.match(route, /if \(user\.frozen\).*ACCOUNT_FROZEN/);
  assert.ok(route.indexOf('ACCOUNT_FROZEN') < route.indexOf('rpc/create_withdrawal_atomic'));
  assert.doesNotMatch(route, /user\.balances\[coin\]\.(?:free|frozen)\s*[-+]?=/);
});

test('earn subscribe and redeem reject frozen accounts before RPC calls', () => {
  const start = api.indexOf("if (path === 'earn' && method === 'POST')");
  const end = api.indexOf("if (path === 'support/chat' && method === 'POST')", start);
  const route = api.slice(start, end);
  assert.match(route, /if \(user\.frozen\).*ACCOUNT_FROZEN/);
  assert.ok(route.indexOf('ACCOUNT_FROZEN') < route.indexOf('rpc/subscribe_earn_atomic'));
  assert.ok(route.indexOf('ACCOUNT_FROZEN') < route.indexOf('rpc/redeem_earn_atomic'));
});

test('financial write handlers persist before returning success', () => {
  const start = api.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = api.indexOf("if (path === 'market' && method === 'GET')", start);
  const withdraw = api.slice(start, end);
  assert.match(withdraw, /rpc\/create_withdrawal_atomic/);
  assert.doesNotMatch(withdraw, /await saveDB\(db\)/);
  const earnStart = api.indexOf("if (path === 'earn' && method === 'POST')");
  const earnEnd = api.indexOf("if (path === 'support/chat' && method === 'POST')", earnStart);
  const earn = api.slice(earnStart, earnEnd);
  assert.ok(earn.indexOf('rpc/subscribe_earn_atomic') < earn.indexOf('return json({ ok: true, duplicate: !!result.duplicate'));
  assert.ok(earn.indexOf('rpc/redeem_earn_atomic') < earn.lastIndexOf('return json({ ok: true, duplicate: !!result.duplicate'));
  assert.doesNotMatch(earn, /await saveDB\(db\)/);
});

test('withdraw UI retains the idempotency key after ambiguous server errors', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'withdraw.html'), 'utf8');
  assert.match(page, /A 5xx response is ambiguous/);
  assert.match(page, /if\(result\.status >= 400 && result\.status < 500\)\{ pendingWithdrawRequestId = ''; persistWithdrawRequestId\(\); \}/);
  assert.match(page, /WITHDRAW_REQUEST_STORAGE_KEY/);
  assert.match(page, /Keep the same key after a timeout/);
});
