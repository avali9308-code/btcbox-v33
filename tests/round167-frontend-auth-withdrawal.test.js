const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const login = fs.readFileSync(path.join(root, 'pages/login.html'), 'utf8');
const withdraw = fs.readFileSync(path.join(root, 'pages/withdraw.html'), 'utf8');

test('registration view has password confirmation, distinct heading and explicit terms consent', () => {
  assert.match(login, /id="authHeading"/);
  assert.match(login, /id="authSubheading"/);
  assert.match(login, /id="registerPasswordHint"/);
  assert.match(login, /id="registerConsent"/);
  assert.match(login, /id="termsConsent"/);
  assert.match(login, /legal\.html\?type=terms/);
  assert.match(login, /legal\.html\?type=privacy/);
  assert.match(login, /Create an account with your email and password, then verify your email/);
  assert.match(login, /id="pwdConfirm"/);
  assert.match(login, /authClient\.auth\.signUp/);
  assert.match(login, /!document\.getElementById\('termsConsent'\)\.checked/);
  assert.match(login, /authClient\.auth\.signUp/);
  assert.doesNotMatch(login, /url = '\/api\/register'/);
});

test('registration mode exposes real Google OAuth and email-link registration options', () => {
  assert.match(login, /magicLinkBtn'\)\.style\.display = 'block'/);
  assert.match(login, /googleBtn'\)\.style\.display = 'flex'/);
  assert.match(login, /authDivider'\)\.style\.display = 'flex'/);
  assert.match(login, /Sign up with Google/);
  assert.match(login, /Register with email link/);
  assert.match(login, /mode === 'register' && !document.getElementById\('termsConsent'\)\.checked/);
});

test('withdraw confirmation has a single well-formed optional 2FA field and fund password', () => {
  assert.match(withdraw, /id="__fundPwd"/);
  assert.match(withdraw, /twofaEnabled \? '<input class="form-input" id="__twofa"/);
  assert.equal((withdraw.match(/id="__twofa"/g) || []).length, 1, 'optional 2FA field must be defined exactly once in the modal template');
  assert.doesNotMatch(withdraw, /display:flex;flex-direction:column;gap:8px;">;display:flex/);
  assert.match(withdraw, /fund_password:fundPassword/);
  assert.match(withdraw, /twofa_code:twofaCode/);
});
