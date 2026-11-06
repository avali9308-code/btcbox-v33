'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'assets/js/views-account.js'), 'utf8');
const deposit = fs.readFileSync(path.join(root, 'assets/js/views-assets.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/app-core.js'), 'utf8');

const networks = ['USDT-TRC20','USDT-ERC20','USDT-BEP20','BTC-BTC','ETH-ERC20','SOL-SOL','BNB-BEP20','USDC-ERC20'];
const assets = ['USDT','BTC','ETH','SOL','BNB','USDC'];

test('admin console exposes editable deposit-address configuration through existing API adapter', () => {
  assert.match(admin, /data-atab="deposits">充值地址/);
  assert.match(admin, /apiAdapter\.adminConfig\(\)/);
  assert.match(admin, /apiAdapter\.adminConfig\(\{deposit_addresses:updates\}\)/);
  assert.match(admin, /留空并保存可停用该网络地址/);
  assert.match(app, /async adminConfig\(p\)/);
  for (const key of networks) assert.ok(admin.includes("'" + key + "'"), 'missing admin field ' + key);
});

test('deposit address API returns every supported network and allows explicit clearing only for known keys', () => {
  assert.match(api, /function safeDepositAddresses\(addresses\)/);
  for (const key of networks) assert.ok(api.includes("'" + key + "'"), 'missing API network ' + key);
  assert.match(api, /if \(value && \(\/PLACEHOLDER\|TPLACEHOLDER\/i\.test\(value\) \|\| !allowedDepositKeys\[key\]\(value\)\)\)/);
  assert.match(api, /Unsupported deposit network configuration found/);
});

test('admin account balance validation and manual credit accept the same six assets as deposit UI', () => {
  for (const asset of assets) {
    assert.ok(api.includes("'" + asset + "'"), 'API does not include ' + asset);
    assert.ok(admin.includes("'" + asset + "'"), 'admin account UI does not include ' + asset);
    assert.ok(deposit.includes("'" + asset + "'"), 'deposit UI does not include ' + asset);
  }
  assert.match(api, /Coin not supported/);
  assert.match(api, /admin_manual_deposit_atomic/);
});

test('manual credit remains fail-closed behind the financial cutover and uses the atomic RPC', () => {
  const start = api.indexOf("// POST /api/admin/deposit/confirm");
  const end = api.indexOf("// POST /api/admin/withdraw/approve", start);
  assert.ok(start >= 0 && end > start);
  const handler = api.slice(start, end);
  assert.match(handler, /financialWritesEnabled\(\)/);
  assert.match(handler, /admin_manual_deposit_atomic/);
  assert.doesNotMatch(handler, /legacy balance fallback|user\.balances\[/i);
});

test('user deposit page continues to request the configured address for the selected coin and network', () => {
  assert.match(deposit, /apiAdapter\.deposit\(\{coin:coin, network:net\}\)/);
  assert.match(deposit, /Address unavailable/);
  assert.match(deposit, /Manual review applies/);
});
