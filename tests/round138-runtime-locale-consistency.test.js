'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('Round 138: runtime subscription modal uses localized labels, body, and amount placeholder', () => {
 const s=read('pages/earn.html');
 for(const key of ['earnSubscribeTitle','earnSubscribeBody','earnAmountPlaceholder','confirmSubscribeAction','cancelAction','subscribeNow']) assert.ok(s.includes(`I18N.t('${key}')`), `missing ${key}`);
 assert.doesNotMatch(s, /title:'申购确认'/);
 assert.doesNotMatch(s, /placeholder="申购金额（USDT）"/);
});
test('Round 138: withdrawal coin selector cancel action is localized', () => assert.match(read('pages/withdraw.html'), /confirmText:I18N\.t\('cancelAction'\)/));
test('Round 138: six locale dictionaries define every new runtime key', () => {
 const s=read('assets/js/i18n.js');
 for(const lang of ["'zh-CN'","'zh-TW'","'en'","'ja'","'ko'","'vi'"]) assert.ok(s.includes(`${lang}: {cancelAction:`), `missing locale ${lang}`);
 for(const key of ['earnSubscribeTitle','earnSubscribeBody','earnAmountPlaceholder','confirmSubscribeAction','subscribeNow']) assert.ok(s.includes(`${key}:`), `missing ${key}`);
});
