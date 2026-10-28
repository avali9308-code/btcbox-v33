'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Round 137: finance and verification dynamic states use locale keys', () => {
  const pages = ['pages/trade.html','pages/deposit.html','pages/withdraw.html','pages/earn.html','pages/kyc.html','pages/orders.html'].map(read).join('\n');
  for (const key of ['loginViewDepositHistory','depositConfirmed','depositConfirming','noDepositHistory','loginViewWithdrawHistory','noWithdrawHistory','withdrawConfirmDetails','withdrawIrreversible','confirmWithdrawTitle','confirmSubmit','checkAgain','earnHistoricalApy','earnRisk','loginViewEarnHoldings','noEarnHoldingsEmpty','earnLoadFailed','loginViewKyc','kycGuestSub','kycReviewPending','kycSubmit','loginViewOrders','orderFilled','noTradeHistory']) {
    assert.ok(pages.includes(`I18N.t('${key}')`), `missing usage: ${key}`);
  }
});

test('Round 137: new runtime keys are explicitly translated in all six supported locales', () => {
  const i18n = read('assets/js/i18n.js');
  const keys = ['loginViewDepositHistory','withdrawConfirmDetails','withdrawIrreversible','earnRisk','kycGuestSub','noTradeHistory','twofaRequiredPlaceholder'];
  for (const lang of ['zh-CN','zh-TW','en','ja','ko','vi']) {
    const start = i18n.indexOf(`'${lang}': {`, i18n.indexOf('var ROUND137_COPY'));
    assert.notEqual(start, -1, `missing locale ${lang}`);
    const end = i18n.indexOf('\n    ', start + 10);
    const section = i18n.slice(start, end === -1 ? start + 20000 : end);
    for (const key of keys.filter(k => k !== 'twofaRequiredPlaceholder')) assert.ok(section.includes(`${key}:`), `${lang} missing ${key}`);
    const securityStart = i18n.indexOf(`'${lang}': {`, i18n.indexOf('var ROUND137_SECURITY_PLACEHOLDERS'));
    assert.notEqual(securityStart, -1, `missing security locale ${lang}`);
    const securityEnd = i18n.indexOf('},', securityStart);
    const securitySection = i18n.slice(securityStart, securityEnd === -1 ? securityStart + 2000 : securityEnd);
    for (const key of ['twofaRequiredPlaceholder']) assert.ok(securitySection.includes(`${key}:`), `${lang} missing ${key}`);
  }
  const round140 = i18n.slice(i18n.indexOf('var ROUND140_COPY'));
  for (const lang of ['zh-CN','zh-TW','en','ja','ko','vi']) {
    const start = round140.indexOf(`'${lang}': {`);
    assert.notEqual(start, -1, `ROUND140 missing locale ${lang}`);
    const end = round140.indexOf('},', start);
    assert.ok(round140.slice(start, end).includes('withdrawTwofaMustEnable:'), `${lang} missing withdrawal 2FA prompt`);
  }
});

test('Round 137: withdrawal confirmation no longer uses hardcoded Chinese security instructions', () => {
  const withdraw = read('pages/withdraw.html');
  assert.match(withdraw, /I18N\.t\('withdrawIrreversible'\)/);
  assert.match(withdraw, /I18N\.t\('fundPasswordPlaceholder'\)/);
  assert.match(withdraw, /__fundPwd/);
  assert.match(withdraw, /fund_password:fundPassword/);
  assert.match(withdraw, /I18N\.t\('twofaRequiredPlaceholder'\)/);
});
