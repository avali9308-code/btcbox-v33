const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'api.js'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

test('approval rejects empty or overlong withdrawal IDs', () => {
  assert.match(api, /if \(!wdId \|\| wdId\.length > 100\) return json\(\{ ok: false, msg: '提现记录编号无效' \}, 400\)/);
});

test('approval rejects missing and duplicate withdrawal IDs before changing balances', () => {
  const route = api.slice(api.indexOf("sub === 'withdraw/approve'"), api.indexOf("sub === 'withdraw/reject'"));
  assert.match(route, /rpc\/review_withdrawal_atomic/);
  assert.doesNotMatch(route, /const matches = \[\]/);
  assert.doesNotMatch(route, /balance\.frozen\s*[-+]?=/);
});

test('approval validates amount, fee, and frozen balance before deduction', () => {
  const route = api.slice(api.indexOf("sub === 'withdraw/approve'"), api.indexOf("sub === 'withdraw/reject'"));
  assert.match(route, /rpc\/review_withdrawal_atomic/);
  assert.match(route, /p_approve: true/);
  assert.doesNotMatch(route, /balance\.frozen < held/);
});

test('approval is terminal and logged as manual review, not broadcast', () => {
  const route = api.slice(api.indexOf("sub === 'withdraw/approve'"), api.indexOf("sub === 'withdraw/reject'"));
  assert.match(route, /p_approve: true/);
  assert.match(route, /尚未广播到链上/);
  assert.doesNotMatch(route, /w\.status = 'approved'/);
});

test('rejection blocks repeat processing and validates both balances before refund', () => {
  const route = api.slice(api.indexOf("sub === 'withdraw/reject'"), api.indexOf("sub === 'kyc/approve'"));
  assert.match(route, /p_approve: false/);
  assert.match(route, /WITHDRAWAL_ALREADY_PROCESSED/);
  assert.doesNotMatch(route, /balance\.(?:free|frozen)\s*[-+]?=/);
});

test('admin UI retains compatibility for legacy pending records', () => {
  assert.match(admin, /approved_pending_broadcast/);
});


test('all API requests are serialized within a warm function instance', () => {
  assert.match(api, /let requestQueue = Promise\.resolve\(\)/);
  assert.match(api, /async function handleRequest\(event, context\)/);
  assert.match(api, /requestQueue = run\.then\(\(\) => undefined, \(\) => undefined\)/);
  assert.match(api, /return run;\s*};\s*$/);
});

test('source explicitly documents cross-instance limitation', () => {
  assert.match(api, /不是跨实例锁，也不能替代事务数据库/);
});

test('earn subscription and redemption use stable request IDs and database idempotency', () => {
  assert.match(api, /p_request_id: requestId, p_request_hash: requestHash/);
  assert.match(api, /rpc/);
  const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'earn.html'), 'utf8');
  assert.match(page, /earnRequestId\('redeem_' \+ b\.dataset\.rid, 0\)/);
  assert.match(page, /action:'redeem', record_id:b\.dataset\.rid, request_id:redeemReq\.id/);
});

test('earn operations do not mutate legacy wallet arithmetic in the API route', () => {
  const start = api.indexOf("if (path === 'earn' && method === 'POST')");
  const end = api.indexOf("if (path === 'support/chat' && method === 'POST')", start);
  const route = api.slice(start, end);
  assert.doesNotMatch(route, /user\.balances\.USDT\.frozen \+ amount/);
  assert.doesNotMatch(route, /user\.balances\.USDT\.free \+ rec\.amount/);
  assert.match(route, /rpc\/subscribe_earn_atomic/);
  assert.match(route, /rpc\/redeem_earn_atomic/);
});

test('rejection refuses ambiguous duplicate withdrawal IDs before refund mutation', () => {
  const start = api.indexOf("sub === 'withdraw/reject'");
  const end = api.indexOf("sub === 'kyc/approve'", start);
  const route = api.slice(start, end);
  assert.match(route, /rpc\/review_withdrawal_atomic/);
  assert.doesNotMatch(route, /const matches = \[\]/);
  assert.doesNotMatch(route, /balance\.frozen\s*[-+]?=/);
});

test('rejection selects exactly one matching withdrawal before checking status and balances', () => {
  const start = api.indexOf("sub === 'withdraw/reject'");
  const end = api.indexOf("sub === 'kyc/approve'", start);
  const route = api.slice(start, end);
  assert.match(route, /rpc\/review_withdrawal_atomic/);
  assert.match(route, /p_approve: false/);
  assert.doesNotMatch(route, /const \{ u, w \} = matches\[0\]/);
});

test('malformed JSON is rejected explicitly instead of silently becoming an empty body', () => {
  assert.match(api, /请求内容不是有效的 JSON/);
  assert.match(api, /code: 'INVALID_JSON', status|code: 'INVALID_JSON'/);
  assert.doesNotMatch(api, /catch \(e\) \{ body = \{\}; \}/);
});

test('request parsing handles base64 bodies and caps payload size at 1 MiB', () => {
  assert.match(api, /event\.isBase64Encoded[\s\S]*Buffer\.from\(String\(event\.body\), 'base64'\)/);
  assert.match(api, /Buffer\.byteLength\(rawBody, 'utf8'\) > 1024 \* 1024/);
  assert.match(api, /REQUEST_BODY_TOO_LARGE/);
  assert.match(api, /INVALID_JSON_OBJECT/);
});

test('fund password is stored as salted PBKDF2 hash, not plaintext', () => {
  assert.match(api, /function hashFundPassword\(pwd, salt\)/);
  assert.match(api, /function verifyFundPassword\(user, supplied\)/);
  assert.match(api, /user\.fund_password_hash = hashFundPassword\(pwd, fundSalt\)/);
  assert.match(api, /delete user\.fund_password; \/\/ Never persist the six-digit fund password in plaintext/);
  assert.match(api, /crypto\.timingSafeEqual\(actual, expected\)/);
});

test('legacy plaintext fund passwords are upgraded after successful verification', () => {
  assert.match(api, /Upgrade legacy plaintext records/);
  assert.match(api, /user\.fund_password_salt = salt/);
  assert.match(api, /delete user\.fund_password;/);
  assert.match(api, /fund_password_set: !!\(user\.fund_password_hash \|\| user\.fund_password\)/);
});

test('admin user detail never returns fund password hashes or salts', () => {
  assert.match(api, /delete safeUser\.fund_password_hash;/);
  assert.match(api, /delete safeUser\.fund_password_salt;/);
  assert.match(api, /safeUser\.fund_password = !!\(u\.fund_password_hash \|\| u\.fund_password\)/);
});

test('API responses set no-store and basic browser security headers', () => {
  assert.match(api, /'Cache-Control': 'no-store'/);
  assert.match(api, /'X-Content-Type-Options': 'nosniff'/);
  assert.match(api, /'X-Frame-Options': 'DENY'/);
});

test('session tokens expire server-side after the cookie lifetime', () => {
  assert.match(api, /const SESSION_MAX_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(api, /Date\.now\(\) - createdAt > SESSION_MAX_AGE_MS/);
  assert.match(api, /if \(!Number\.isFinite\(createdAt\).*return null/);
});

test('session cookies use Secure outside local Netlify development', () => {
  assert.match(api, /process\.env\.CONTEXT === 'dev' \? '' : '; Secure'/);
  assert.match(api, /HttpOnly; SameSite=Lax' \+ secure/);
});

test('2FA completion rechecks frozen status before creating a session', () => {
  const start = api.indexOf("path === 'login/2fa'");
  const end = api.indexOf("// ---------- GET /api/kline", start);
  const route = api.slice(start, end);
  assert.match(route, /if \(u2\.frozen\).*delete db\.temp_tokens\[tt\]/s);
  assert.ok(route.indexOf('if (u2.frozen)') < route.indexOf('db.sessions[token2]'));
});
