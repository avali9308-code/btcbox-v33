const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const login = fs.readFileSync(path.join(root, 'pages/login.html'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8');

test('Round 134: requested homepage footer copy is removed', () => {
  assert.doesNotMatch(home, /BTCBOX\s*©\s*2026/);
  assert.doesNotMatch(home, /数字资产交易涉及风险，请谨慎投资/);
  assert.doesNotMatch(home, /pages\/legal\.html\?type=(?:terms|privacy|risk)/);
  assert.match(home, /Round 134: removed the requested homepage legal\/risk footer copy/);
});

test('Round 134: login no longer repeats the copyright risk footer but keeps sign-in consent links', () => {
  assert.doesNotMatch(login, /BTCBOX\s*©\s*2026/);
  assert.doesNotMatch(login, /data-i18n="copyright"/);
  assert.match(login, /登录即表示同意/);
  assert.match(login, /href="legal\.html\?type=terms"/);
  assert.match(login, /href="legal\.html\?type=privacy"/);
});

test('Round 134: shared translator still has safe fallback for unrecognized Chinese server messages', () => {
  assert.match(i18n, /function translateMessage\(message\)/);
  assert.match(i18n, /ROUND132_UNKNOWN_SERVER_MESSAGE/);
});
