'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const i18n = read('assets/js/i18n.js');
const pages = ['addresses','assets','deposit','earn','kyc','legal','login','markets','me','orders','seconds','settings','support','trade','withdraw'];

test('Round 131: static page copy has an English-first translation inventory', () => {
  assert.match(i18n, /var ROUND131_PAGE_COPY =/);
  assert.match(i18n, /DICT\["en"\]\[key\] = ROUND131_PAGE_COPY\[source\]/);
  assert.match(i18n, /data-i18n-alt/);
  for (const page of pages) {
    const html = read(`pages/${page}.html`);
    assert.match(html, /assets\/js\/i18n\.js/, `${page} must load central i18n`);
    assert.match(html, /data-i18n=/, `${page} should mark static copy for translation`);
  }
});

test('Round 131: dynamic states use locale keys instead of hardcoded Chinese strings', () => {
  const expected = [
    ['deposit','loginToGetDepositAddress'], ['deposit','depositChannelMaintenance'],
    ['deposit','networkTryAgain'], ['withdraw','submitting'],
    ['kyc','kycReviewing'], ['assets','assetHidden'],
    ['support','loginToSendMessage'], ['kyc','kycReviewing'],
    ['kyc','kycReviewing'], ['deposit','loginToGetDepositAddress']
  ];
  for (const [page,key] of expected) assert.match(read(`pages/${page}.html`), new RegExp(`I18N\\.t\\(['"]${key}['"]\\)`), `${page} should use ${key}`);
});

test('Round 131: new page-copy keys avoid Chinese fallback in non-Chinese locales', () => {
  assert.match(i18n, /\["zh-TW", "ja", "ko", "vi"\]\.forEach\(function\(lang\)\{ DICT\[lang\]\[key\] = ROUND131_PAGE_COPY\[source\]; \}\)/);
  assert.match(i18n, /var ROUND136_DYNAMIC_LOCALES =/);
  assert.match(i18n, /currentLang === 'en' && \/\[\\u3400-\\u9fff\]\/.test\(source\)/);
});
