'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const deposit = fs.readFileSync(path.join(root, 'pages/deposit.html'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'pages/settings.html'), 'utf8');

test('Round 173: public captcha endpoint never returns the challenge answer', () => {
  assert.match(api, /VERIFICATION_UNAVAILABLE/);
  assert.doesNotMatch(api, /captcha_code:\s*code/);
});

test('Round 173: unverified legacy registration is disabled by default', () => {
  assert.match(api, /ALLOW_UNVERIFIED_LEGACY_REGISTRATION !== '1'/);
  assert.match(api, /EMAIL_VERIFICATION_REQUIRED/);
});

test('Round 173: deposit and 2FA secrets are not sent to third-party QR image services', () => {
  assert.doesNotMatch(deposit + settings, /api\.qrserver\.com/);
  assert.match(deposit, /QRCode\.toCanvas/);
  assert.match(deposit, /qrFallback/);
});
