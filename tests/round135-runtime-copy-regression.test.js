'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Round 135: security modal runtime strings use locale keys', () => {
  const settings = read('pages/settings.html');
  assert.match(settings, /I18N\.t\('enable2faTitle'\)/);
  assert.match(settings, /I18N\.t\('twofaInstruction'\)/);
  assert.match(settings, /I18N\.t\('qrLoading'\)/);
  assert.match(settings, /secretCopied/);
  assert.match(settings, /I18N\.t\('copySecret'\)/);
  assert.match(settings, /I18N\.t\('twofaEnabled'\)/);
  assert.match(settings, /I18N\.t\('passwordChanged'\)/);
  assert.match(settings, /I18N\.t\('fundPasswordCreated'\)/);
  assert.match(settings, /I18N\.t\('twofaDisabled'\)/);
  assert.match(settings, /I18N\.t\('disable2faWarning'\)/);
  assert.doesNotMatch(settings, /BTCBOX\.toast\('密钥已复制'/);
});

test('Round 135: support empty, logged-out and avatar states use locale keys', () => {
  const support = read('pages/support.html');
  assert.match(support, /I18N\.t\('supportAgentAvatar'\)/);
  assert.match(support, /I18N\.t\('supportUserAvatar'\)/);
  assert.match(support, /I18N\.t\('noChatYet'\)/);
  assert.match(support, /I18N\.t\('loginToContactSupport'\)/);
  assert.match(support, /I18N\.t\('goLogin'\)/);
});

test('Round 135: address form labels and request failures are localized', () => {
  const addresses = read('pages/addresses.html');
  for (const key of ['accountHolder','bankName','accountNumber','routingNumber','swiftBic','bankAddress']) {
    assert.match(addresses, new RegExp(`data-i18n="${key}"`));
  }
  assert.match(addresses, /I18N\.t\('addressNetworkError'\)/);
  assert.match(addresses, /I18N\.t\('contactSupportForChanges'\)/);
});

test('Round 136: runtime copy has locale-specific translations and unknown Chinese literals preserve source text (no error placeholder)', () => {
  const i18n = read('assets/js/i18n.js');
  assert.match(i18n, /var ROUND135_COPY =/);
  assert.match(i18n, /var ROUND136_SECURITY_LOCALES =/);
  assert.match(i18n, /var ROUND136_DYNAMIC_LOCALES =/);
  assert.doesNotMatch(i18n, /This content is not available in English\./);
  assert.match(i18n, /currentLang === 'en' && \/\[\\u3400-\\u9fff\]\/.test\(source\)/);
});
