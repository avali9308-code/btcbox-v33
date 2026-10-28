'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8');
const audit = fs.readFileSync(path.join(root, 'LANGUAGE-CONSISTENCY-AUDIT.md'), 'utf8');

test('Round 171: shared runtime fallback controls use English', () => {
  for (const copy of ['Confirm Action', 'Cancel', 'Confirm', 'Trading menu', 'Spot', 'Contracts', 'Short-Term Contracts', 'Log Out']) {
    assert.ok(app.includes(copy), `missing English runtime copy: ${copy}`);
  }
  assert.doesNotMatch(app, /opts\.title\s*\|\|\s*'提示'/);
  assert.doesNotMatch(app, /opts\.cancelText\s*\|\|\s*'取消'/);
});

test('Round 171: English-only locale and fail-closed fallback remain enabled', () => {
  assert.match(i18n, /currentLang = 'en';/);
  assert.match(i18n, /dynamicTranslation \|\| 'Text unavailable'/);
  assert.match(i18n, /setAttribute\(attr, 'Unavailable'\)/);
  assert.match(audit, /public UI is intended to remain English-only/i);
});
