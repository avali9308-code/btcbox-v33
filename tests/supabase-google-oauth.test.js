const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const login = fs.readFileSync(path.join(root, 'pages/login.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'SUPABASE-GOOGLE-OAUTH.md'), 'utf8');

test('Google button launches Supabase OAuth with configured production callback', () => {
  assert.match(login, /id="googleBtn"/);
  assert.match(login, /https:\/\/zlozsutefnmgwwzrlipt\.supabase\.co/);
  assert.match(login, /window\.location\.origin \+ '\/pages\/login\.html\?auth_callback=1'/);
  assert.match(login, /signInWithOAuth\(\{[\s\S]*provider:'google'/);
  assert.doesNotMatch(login, /gEmailConfirm|googleMockLogin/);
});

test('server verifies Supabase access token before creating BTCBOX session', () => {
  assert.match(api, /path === 'supabase-login' \|\| path === 'google-login'/);
  assert.match(api, /SUPABASE_AUTH_URL/);
  assert.match(api, /SUPABASE_AUTH_PUBLISHABLE_KEY/);
  assert.match(api, /supabaseUrl \+ '\/auth\/v1\/user'/);
  assert.match(api, /Authorization': 'Bearer ' \+ accessToken/);
  assert.match(api, /email_confirmed_at/);
  assert.match(api, /user\.twofa_enabled/);
  assert.match(api, /user\.frozen/);
});

test('OAuth setup docs include exact Supabase callback and do not claim live verification', () => {
  assert.match(docs, /\/auth\/v1\/callback/);
  assert.match(docs, /pages\/login\.html\?auth_callback=1/);
  assert.match(login, /signInWithOtp\(/);
  assert.match(login, /emailRedirectTo: OAUTH_REDIRECT_URL/);
  assert.match(docs, /没有通过你的 Supabase\/Google 控制台执行真实 OAuth/);
});
