'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const i18n = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'pages/settings.html'), 'utf8');

test('Round 129: locale switching never falls back to Simplified Chinese for missing keys', () => {
  assert.match(i18n, /Never leak Simplified Chinese fallback into another selected locale/);
  assert.match(i18n, /return Object\.prototype\.hasOwnProperty\.call\(dict, key\) \? dict\[key\] : dict\.translationUnavailable/);
  const patch = i18n.split('var ROUND129_LOCALE_PATCH = {')[1].split('};')[0];
  for (const lang of ['zh-CN','zh-TW','en','ja','ko','vi']) {
    assert.match(patch, new RegExp("['\"]" + lang + "['\"]\\s*:\\s*\\{[^}]*translationUnavailable", 's'), `${lang} needs localized missing-translation text`);
  }
});

test('Round 129: public settings do not expose a locale switch because the frontend is English-only', () => {
  assert.doesNotMatch(settings, /class="lang-btn"|data-lang="zh-CN"|data-lang="zh-TW"/);
  assert.match(i18n, /Public frontend is intentionally English-only/);
  assert.match(i18n, /if\(lang !== 'en'\) return false/);
});

test('Round 129: dynamically inserted nodes and accessibility attributes are translated centrally', () => {
  assert.match(i18n, /data-i18n-aria-label/);
  assert.match(i18n, /observer\.observe\(document\.documentElement, \{childList:true, subtree:true, attributes:true, attributeFilter:\['placeholder','title','aria-label','alt'\]\}\)/);
});


test('public frontend defaults to English and fails closed on unknown CJK text', () => {
  assert.match(i18n, /currentLang = 'en';/);
  assert.match(i18n, /dynamicTranslation \|\| 'Text unavailable'/);
  assert.match(i18n, /setAttribute\(attr, 'Unavailable'\)/);
});
