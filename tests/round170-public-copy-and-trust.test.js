'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('homepage removes unsupported operational, cold-storage and fee claims', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /1,825\+|98%|0\.1%|cold98|safeDays/);
  assert.match(html, /Spot Markets/);
});
test('login page static copy is English and public pages declare English', () => {
  const login = fs.readFileSync(path.join(root, 'pages/login.html'), 'utf8');
  assert.match(login, /Welcome back/);
  assert.match(login, /Never share your password/);
  assert.match(login, /<html lang="en">/);
});
