'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const login = read('pages/login.html');
const api = read('netlify/functions/api.js');
const i18n = read('assets/js/i18n.js');

test('Round 177: email/password registration enforces password length and confirmation', () => {
  assert.match(login, /auth\.signUp\(\{email:email, password:pwd/);
  assert.match(login, /pwd\.length < 8/);
  assert.match(login, /pwd !== confirmPwd/);
  assert.match(login, /emailRedirectTo:OAUTH_REDIRECT_URL/);
});

test('Round 177: password login supports Supabase accounts and legacy password/2FA flow', () => {
  assert.match(login, /auth\.signInWithPassword\(\{email:email,password:pwd\}\)/);
  assert.match(login, /fetch\(url,[\s\S]*body: JSON\.stringify\(payload\)/);
  assert.match(login, /j\.require_2fa && j\.temp_token/);
  assert.ok(login.includes("fetch('/api/login/2fa'"));
  assert.match(api, /path === 'login\/2fa'/);
  assert.match(api, /user\.twofa_enabled/);
});

test('Round 177: password reset requires confirmation before updating Supabase password', () => {
  assert.match(login, /id="__recoveryPasswordConfirm"/);
  assert.match(login, /if\(np !== cp\)/);
  assert.match(login, /client\.auth\.updateUser\(\{password:np\}\)/);
});

test('Round 177: server verifies Supabase identity, requires verified email and refuses OAuth 2FA bypass', () => {
  assert.match(api, /supabaseUrl \+ '\/auth\/v1\/user'/);
  assert.match(api, /Authorization': 'Bearer ' \+ accessToken/);
  assert.match(api, /identity\.email_confirmed_at \|\| identity\.confirmed_at/);
  assert.match(api, /if \(user && user\.twofa_enabled\) \{/);
  assert.match(api, /rateCheck\('2fa:' \+ u2\.uid, 20, 15 \* 60 \* 1000\)/);
  assert.match(api, /require_2fa: true, temp_token: tempToken/);
  assert.match(login, /function completeSupabaseTwoFactor\(/);
  assert.match(login, /fetch\('\/api\/login\/2fa'/);
  assert.match(api, /if \(user && user\.frozen\) return json/);
});

test('Round 177: runtime observes in-place text mutations and keeps legacy observer coverage', () => {
  assert.match(i18n, /observer\.observe\(document\.documentElement, \{childList:true, subtree:true, attributes:true, attributeFilter:\['placeholder','title','aria-label','alt'\]\}\)/);
  assert.match(i18n, /textObserver\.observe\(document\.documentElement, \{characterData:true, subtree:true\}\)/);
  assert.match(i18n, /translateLooseText\(record\.target\.parentElement\)/);
  assert.match(i18n, /dynamicTranslation \|\| 'Text unavailable'/);
});

test('Round 177: deployment config exposes only public Supabase settings, not server secrets', () => {
  assert.match(api, /supabase_auth_url: process\.env\.SUPABASE_AUTH_URL \|\| ''/);
  assert.match(api, /supabase_auth_publishable_key: process\.env\.SUPABASE_AUTH_PUBLISHABLE_KEY \|\| process\.env\.SUPABASE_AUTH_ANON_KEY \|\| ''/);
  assert.doesNotMatch(api.slice(api.indexOf("if (path === 'config'"), api.indexOf("// ---------- POST /api/captcha")), /SERVICE_ROLE|SECRET_KEY/);
});
