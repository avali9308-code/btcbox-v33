'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const i18n = read('assets/js/i18n.js');
const pages = Object.fromEntries(['login','trade','deposit','withdraw','earn','assets','settings','kyc','support','seconds'].map(p => [p, read(`pages/${p}.html`)]));

test('Round 130: every added business-feedback key exists in all six locales', () => {
  const block = i18n.split('var ROUND130_LOCALE_PATCH = {')[1].split('\n  };')[0];
  const locales = ['zh-CN','zh-TW','en','ja','ko','vi'];
  const keysByLocale = {};
  for (const locale of locales) {
    const start = block.indexOf("'" + locale + "': {");
    assert.notEqual(start, -1, `missing locale ${locale}`);
    const afterStart = start + ("'" + locale + "': {").length;
    const nextLocale = block.indexOf("\n    '", afterStart);
    const objectText = block.slice(afterStart, nextLocale === -1 ? block.length : nextLocale);
    keysByLocale[locale] = [...objectText.matchAll(/(?:^|,\s*)([A-Za-z][A-Za-z0-9]*):/g)].map(m => m[1]).sort();
    assert.ok(keysByLocale[locale].length >= 40, `${locale} should have complete feedback coverage`);
  }
  for (const locale of locales.slice(1)) assert.deepEqual(keysByLocale[locale], keysByLocale['zh-CN'], `key mismatch for ${locale}`);
});

test('Round 130: auth and trading UI no longer displays raw backend messages in selected paths', () => {
  assert.match(pages.login, /BTCBOX\.toast\(mode==='register' \? I18N\.t\('registerSuccess'\) : I18N\.t\('loginSuccessMessage'\)/);
  assert.match(pages.login, /I18N\.t\('twofaUnavailable'\)/);
  assert.match(pages.login, /I18N\.t\('emailLinkExpired'\)/);
  assert.doesNotMatch(pages.trade, /BTCBOX\.toast\(res\.msg/);
  assert.match(pages.trade, /I18N\.t\('orderPlaced'\)/);
  assert.match(pages.trade, /I18N\.t\('orderFailedMessage'\)/);
  assert.doesNotMatch(pages.kyc, /BTCBOX\.toast\(j\.msg/);
  assert.doesNotMatch(pages.support, /BTCBOX\.toast\(j\.msg/);
});

test('Round 130: account freeze is exposed as a stable API code and localized in the UI', () => {
  const api = read('netlify/functions/api.js');
  assert.match(api, /code: 'ACCOUNT_FROZEN'/);
  assert.match(pages.login, /j\.code === 'ACCOUNT_FROZEN'/);
  assert.match(pages.login, /I18N\.t\('frozenAccountBody'\)/);
  assert.doesNotMatch(pages.login, /\+ j\.msg \+/);
});

test('Round 130: selected transaction/service feedback uses locale keys', () => {
  for (const [page, key] of [['deposit','addressFetchFailed'],['withdraw','submitFailed'],['earn','redeemConfirmTitle'],['assets','assetHidden'],['settings','operationFailedRetry'],['support','supportHistoryRefreshFailed'],['seconds','positionOpened']]) {
    assert.match(pages[page], new RegExp(`I18N\\.t\\(['"]${key}['"]\\)`), `${page} should use ${key}`);
  }
});
