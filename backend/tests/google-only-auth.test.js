'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Google-only auth source files remain valid JavaScript', () => {
  for (const file of ['assets/js/views-home.js', 'assets/js/boot.js', 'assets/js/app-core.js']) {
    assert.doesNotThrow(() => new vm.Script(read(file)), file + ' must parse');
  }
});

test('public login and registration expose Google OAuth only', () => {
  const views = read('assets/js/views-home.js');
  const start = views.indexOf('VIEWS.login = function(){');
  const end = views.indexOf('VIEWS.markets = function(){', start);
  assert.ok(start >= 0 && end > start, 'login/register view block must exist');
  const authViews = views.slice(start, end);
  assert.ok(authViews.includes('google-login-btn'));
  assert.ok(authViews.includes('google-register-btn'));
  assert.ok(authViews.includes('reg-terms'), 'registration must retain Terms/Privacy consent');
  for (const forbidden of ['login-email', 'login-pwd', 'reg-email', 'reg-pwd', 'forgot-link', 'Forgot password', 'Auth.login(', 'Auth.register(']) {
    assert.ok(!authViews.includes(forbidden), 'Google-only auth view must not expose ' + forbidden);
  }
});

test('Google OAuth keeps same-origin callback, safe return target and Terms consent', () => {
  const boot = read('assets/js/boot.js');
  assert.ok(boot.includes("redirectTo:window.location.origin+window.location.pathname+'?auth_callback=1'"));
  assert.ok(boot.includes('consumeOAuthReturnTarget()'));
  assert.ok(boot.includes("const isRegister=btn.id==='google-register-btn'"));
  assert.ok(boot.includes('Please accept the Terms of Service and Privacy Policy to continue.'));
  assert.ok(!boot.includes('Please use email and password'));
  assert.ok(!boot.includes('Auth.showResetPassword'));
  assert.ok(!boot.includes('recoveryMode'));
});

test('Google OAuth session exchange preserves optional server-side 2FA challenge', () => {
  const boot = read('assets/js/boot.js');
  const core = read('assets/js/app-core.js');
  assert.ok(boot.includes('supabaseTwoFactorPending'));
  assert.ok(boot.includes('Auth.showLoginTwoFactor'));
  assert.ok(core.includes('async supabaseLogin(supabase_access_token)'));
  assert.ok(core.includes('showLoginTwoFactor(email,tempToken)'));
  assert.ok(core.includes('result.require_2fa===true && result.temp_token'));
  assert.ok(core.includes('The sign-in result could not be confirmed.'));
  assert.ok(core.includes('function clearPrivateUserState(){') && core.includes('state.accountLoaded=false;'), 'failed auth must clear private account state');
});

test('email-only client recovery handlers are not exposed by Auth helper', () => {
  const core = read('assets/js/app-core.js');
  const start = core.indexOf('const Auth = {');
  const end = core.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start, 'Auth helper must exist');
  const auth = core.slice(start, end);
  for (const forbidden of ['async login(', 'async register(', 'showRegisterSuccess(', 'showForgotPassword(', 'showResetPassword(', 'forgotPassword(']) {
    assert.ok(!auth.includes(forbidden), 'Auth helper must not expose ' + forbidden);
  }
  const adapterStart = core.indexOf('const apiAdapter = {');
  const adapterEnd = core.indexOf('\n};', adapterStart);
  assert.ok(adapterStart >= 0 && adapterEnd > adapterStart, 'API adapter must exist');
  const adapter = core.slice(adapterStart, adapterEnd);
  for (const forbidden of ['async login(', 'async register(', 'async forgotPassword(']) {
    assert.ok(!adapter.includes(forbidden), 'API adapter must not expose ' + forbidden);
  }
  assert.ok(adapter.includes('async login2fa('), 'optional Google-session 2FA endpoint must remain');
});
