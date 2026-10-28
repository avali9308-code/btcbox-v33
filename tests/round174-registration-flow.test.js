'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const login = fs.readFileSync(path.join(root, 'pages/login.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');

test('Round 175: registration uses verified Supabase email/password signup', () => {
  assert.match(login, /authClient\.auth\.signUp\(\{email:email, password:pwd/);
  assert.match(login, /pwd\.length < 8/);
  assert.match(login, /pwd !== confirmPwd/);
  assert.match(login, /authClient\.auth\.signInWithPassword\(\{email:email,password:pwd\}\)/);
  assert.match(login, /resetPasswordForEmail\(/);
  assert.match(login, /client\.auth\.updateUser\(\{password:np\}\)/);
  assert.match(login, /signInWithOtp\(/);
  assert.match(login, /shouldCreateUser: mode === 'register'/);
  assert.match(api, /EMAIL_VERIFICATION_REQUIRED/);
  assert.match(api, /email_verified: true/); // verified Supabase identities may be provisioned after server-side confirmation
});

test('Round 174: OAuth callback uses current deployment origin', () => {
  assert.match(login, /window\.location\.origin \+ '\/pages\/login\.html\?auth_callback=1'/);
  assert.doesNotMatch(login, /var OAUTH_REDIRECT_URL = 'https:\/\/[^']+'/);
});

test('Round 174: legacy login redirect cannot navigate to an external origin', () => {
  assert.match(login, /function safeRedirectTarget\(\)/);
  assert.match(login, /target\.origin === window\.location\.origin/);
  assert.match(login, /location\.replace\(target\)/);
});
