const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const login = fs.readFileSync(path.join(root, 'pages/login.html'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'SUPABASE-GOOGLE-OAUTH.md'), 'utf8');

test('email magic link sends OTP to the entered email with email-specific callback', () => {
  assert.match(login, /client\.auth\.signInWithOtp\(/);
  assert.match(login, /email: email/);
  assert.match(login, /shouldCreateUser: mode === 'register'/);
  assert.match(login, /mode === 'register' \? 'If registration is available for this email/);
  assert.match(login, /auth_method=email/);
  assert.match(login, /emailRedirectTo:/);
});

test('email callback uses the verified Supabase session and server-side BTCBOX session flow', () => {
  assert.match(login, /callbackMethod === 'email'/);
  assert.match(login, /client\.auth\.getSession\(\)/);
  assert.match(login, /completeSupabaseLogin\(client, result\.data\.session, callbackMethod\)/);
  assert.match(login, /fetch\('\/api\/supabase-login'/);
  assert.match(login, /auth\.signOut\(\{scope:'local'\}\)/);
});

test('email callback handles expired links and clears auth query/fragment values', () => {
  assert.match(login, /I18N\.t\('emailLinkExpired'\)/);
  assert.match(fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8'), /emailLinkExpired:'This email link could not be verified or has expired/);
  assert.match(login, /clean\.hash = ''/);
  assert.match(login, /error_description/);
  assert.match(fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8'), /emailLinkExpired:'This email link could not be verified or has expired\. Open the latest email link in the same browser/);
});

test('Supabase setup guide explicitly covers email provider, redirect allowlist and email template', () => {
  assert.match(docs, /Email/);
  assert.match(docs, /auth_method=email/);
  assert.match(docs, /ConfirmationURL/);
  assert.match(docs, /同一浏览器/);
});
