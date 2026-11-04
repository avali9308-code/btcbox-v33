'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');
function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, name + ' must have a complete body');
  return vm.runInNewContext('(' + source.slice(start, end + 2) + ')');
}

const isGoogleOnlySupabaseIdentity = extractFunction('isGoogleOnlySupabaseIdentity');
const isValidAuthEmail = extractFunction('isValidAuthEmail');
const isSupabaseUserId = extractFunction('isSupabaseUserId');

test('only a server-verified Google-only Supabase identity is accepted', () => {
  const google = {
    app_metadata: { provider: 'google', providers: ['google'] },
    identities: [{ provider: 'google' }],
    user_metadata: { provider: 'google' }
  };
  assert.equal(isGoogleOnlySupabaseIdentity(google), true);
  assert.equal(isGoogleOnlySupabaseIdentity({
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [{ provider: 'email' }],
    user_metadata: { provider: 'google' }
  }), false, 'user-editable metadata must never authorize Google sign-in');
  assert.equal(isGoogleOnlySupabaseIdentity({
    app_metadata: { provider: 'google', providers: ['google', 'email'] },
    identities: [{ provider: 'google' }, { provider: 'email' }]
  }), false, 'linked email identity must not bypass Google-only policy');
  assert.equal(isGoogleOnlySupabaseIdentity({
    app_metadata: { provider: 'google', providers: ['google'] },
    identities: [{ provider: 'email' }]
  }), false, 'provider metadata and identity list must agree');
  assert.equal(isGoogleOnlySupabaseIdentity(null), false);
});

test('Google identity exchange validates a normal email address without accepting whitespace', () => {
  assert.equal(isValidAuthEmail('user@example.com'), true);
  assert.equal(isValidAuthEmail('first.last+btc@example.co'), true);
  assert.equal(isValidAuthEmail('not-an-email'), false);
  assert.equal(isValidAuthEmail('name with space@example.com'), false);
});

test('Supabase identity must include a canonical UUID user id', () => {
  assert.equal(isSupabaseUserId('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isSupabaseUserId('not-a-user-id'), false);
  assert.equal(isSupabaseUserId(''), false);
  assert.equal(isSupabaseUserId(null), false);
});

test('legacy local registration and password login endpoints are explicitly disabled', () => {
  const registerStart = source.indexOf("if (path === 'register' && method === 'POST')");
  const loginStart = source.indexOf("if (path === 'login' && method === 'POST')");
  const supabaseStart = source.indexOf("if ((path === 'supabase-login' || path === 'google-login') && method === 'POST')");
  assert.ok(registerStart >= 0 && loginStart > registerStart && supabaseStart > loginStart);
  const register = source.slice(registerStart, loginStart);
  const login = source.slice(loginStart, supabaseStart);
  assert.match(register, /GOOGLE_ONLY_AUTH/);
  assert.match(login, /GOOGLE_ONLY_AUTH/);
  assert.match(register, /403/);
  assert.match(login, /403/);
  assert.doesNotMatch(register, /hashPassword\(/);
  assert.doesNotMatch(login, /hashPassword\(/);
});

test('local account cannot be silently linked by matching email alone', () => {
  assert.ok(source.includes("user.supabase_user_id || '') !== supabaseUserId"));
  assert.ok(source.includes("'SUPABASE_IDENTITY_LINK_REQUIRED'"));
  assert.ok(source.includes("'SUPABASE_IDENTITY_MISMATCH'"));
  assert.ok(source.includes('supabase_user_id: supabaseUserId'));
});
