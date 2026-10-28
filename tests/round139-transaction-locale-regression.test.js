'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('Round 139: transaction-critical locale keys exist in all six locales', () => {
 const s=read('assets/js/i18n.js');
 for(const lang of ["'zh-CN'","'zh-TW'","'en'","'ja'","'ko'","'vi'"]) assert.ok(s.includes(`${lang}: {feeLabel:`), `missing ${lang}`);
 for(const key of ['recordsLoadFailed','networkError','rejectReasonLabel','withdrawProcessing','kycTypePassport','floatingPnl']) assert.ok(s.includes(`${key}:`), `missing ${key}`);
});
test('Round 139: withdrawal history labels and failure state use locale keys', () => {
 const s=read('pages/withdraw.html');
 for(const key of ['withdrawProcessing','rejectReasonLabel','feeLabel','addressLabel','recordsLoadFailed']) assert.ok(s.includes(`I18N.t('${key}')`), `missing ${key}`);
 assert.doesNotMatch(s, /加载失败，请刷新重试|拒绝原因：|<span>手续费 /);
});
test('Round 139: order history translates known statuses and guards unknown backend messages', () => {
 const s=read('pages/orders.html');
 assert.match(s,/function statusLabel\(value\)/);
 assert.match(s,/I18N\.t\('orderStatusUnknown'\)/);
 assert.match(s,/I18N\.t\('networkError'\)/);
 assert.doesNotMatch(s,/empty\('网络异常'\)/);
});
test('Round 139: KYC runtime text no longer contains literal translation calls', () => {
 const s=read('pages/kyc.html');
 assert.doesNotMatch(s,/data-i18n="[^"]+">I18N\.t\(/);
 assert.match(s,/typeLabels = \{id_card:I18N\.t\('kycTypeIdCard'\)/);
 assert.match(s,/I18N\.t\('loginAction'\)/);
});
test('Round 139: dynamic order labels refresh after language changes', () => {
 assert.match(read('pages/trade.html'),/document\.addEventListener\('langChange', function\(\).*renderOrders\(\)/s);
 assert.match(read('pages/orders.html'),/document\.addEventListener\('langChange',function\(\){renderOrders\(\);\}\)/);
 assert.match(read('pages/deposit.html'),/document\.addEventListener\('langChange', function\(\){ loadRecords\(\); loadAddr\(\); \}\)/);
});
