'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Round 140: trade submission matches the server limit-order and idempotency contract', () => {
  const page = read('pages/trade.html');
  const api = read('netlify/functions/api.js');
  assert.match(page, /order_type:'limit'/);
  assert.match(page, /payload\.client_order_id = pendingOrderSubmission\.clientOrderId/);
  assert.match(page, /pendingOrderSubmission\.payloadKey !== payloadKey/);
  assert.match(page, /marketOrdersUnavailable/);
  assert.match(api, /type !== 'limit'/);
  assert.match(api, /body\.client_order_id \|\| body\.request_id/);
});

test('Round 140: order history reads the canonical orders endpoint and distinguishes API failure', () => {
  const page = read('pages/trade.html');
  assert.match(page, /fetch\('\.\.\/api\/orders', \{credentials:'include', cache:'no-store'\}\)/);
  assert.match(page, /I18N\.t\('networkError'\)/);
  assert.match(page, /partially_filled:I18N\.t\('orderPartiallyFilled'\)/);
  assert.match(page, /cancelled/);
  assert.match(page, /setInterval\(function\(\)\{ loadOrders\(true\); \}, 10000\)/);
  assert.match(page, /ordersLoadError=true/);
});

test('Round 140: deposit history distinguishes credited, failed, pending, and unknown statuses', () => {
  const page = read('pages/deposit.html');
  for (const key of ['depositConfirmed','depositFailed','depositConfirming','depositStatusUnknown','recordsLoadFailed']) assert.ok(page.includes(`I18N.t('${key}')`), `missing ${key}`);
  assert.match(page, /function escapeHtml\(/);
  assert.match(page, /status==='rejected' \|\| status==='failed'/);
});

test('Round 140: rejected KYC and terminal withdrawal failures are not shown as pending', () => {
  const kyc = read('pages/kyc.html');
  const wd = read('pages/withdraw.html');
  assert.match(kyc, /st === 'rejected' \? I18N\.t\('kycRejected'\)/);
  assert.match(kyc, /I18N\.t\('kycLoadFailed'\)/);
  assert.match(wd, /approved_pending_broadcast/);
  assert.match(wd, /failed:\[I18N\.t\('orderRejected'\)/);
  assert.match(wd, /withdrawOutcomeUnknown/);
  assert.match(wd, /withdrawAlreadySubmitted/);
  assert.match(wd, /WITHDRAW_REQUEST_STORAGE_KEY/);
  assert.match(wd, /persistWithdrawRequestId/);
});

test('Round 140: new business-state keys exist in all six locales', () => {
  const i18n = read('assets/js/i18n.js');
  for (const locale of ["'zh-CN'", "'zh-TW'", "'en'", "'ja'", "'ko'", "'vi'"]) {
    const start = i18n.indexOf(locale+': {', i18n.indexOf('var ROUND140_COPY'));
    assert.notEqual(start, -1, `missing ${locale}`);
    const end = i18n.indexOf('}', start);
    const block = i18n.slice(start, end);
    for (const key of ['orderPartiallyFilled','depositFailed','depositStatusUnknown','kycRejected','kycLoadFailed','withdrawOutcomeUnknown','withdrawAlreadySubmitted']) assert.ok(block.includes(key+':'), `${locale} missing ${key}`);
  }
});
