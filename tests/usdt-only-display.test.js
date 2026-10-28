'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('USDT-only display removes fiat currency switching and CNY conversion calls', () => {
  const settings = read('pages/settings.html');
  const trade = read('pages/trade.html');
  const me = read('pages/me.html');
  assert.doesNotMatch(settings, /data-lang=|CNY|RMB|USD \(USDT\)|EUR|JPY|HKD/);
  assert.doesNotMatch(trade, /vs_currencies=cny|_cnyRate|midCny|mid-cny|CNY|RMB/);
  assert.match(me, /Total Assets \(USDT\)/);
  assert.match(me, /' USDT'/);
  assert.doesNotMatch(me, /currency:'USD'|\$--|USD Value/);
});
