const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');

test('Round 151: new state never seeds placeholder deposit addresses', () => {
  const start = api.indexOf('deposit_addresses: {');
  assert.notEqual(start, -1);
  const end = api.indexOf('\n    },', start);
  assert.notEqual(end, -1);
  const block = api.slice(start, end);
  assert.match(block, /DEPOSIT_USDT_TRC20\s*\|\|\s*""/);
  assert.match(block, /DEPOSIT_USDT_ERC20\s*\|\|\s*""/);
  assert.match(block, /DEPOSIT_USDT_BEP20\s*\|\|\s*""/);
  assert.match(block, /DEPOSIT_BTC\s*\|\|\s*""/);
  assert.match(block, /DEPOSIT_ETH\s*\|\|\s*""/);
  assert.match(block, /DEPOSIT_SOL\s*\|\|\s*""/);
  assert.doesNotMatch(block, /PLACEHOLDER/i);
});

test('Round 151: deposit address query fails closed when a network is not configured', () => {
  const start = api.indexOf("if (path === 'deposit' && method === 'POST')");
  const end = api.indexOf("if (path === 'withdraw' && method === 'POST')", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.match(route, /if\s*\(!addr\s*\|\|\s*\/PLACEHOLDER\/i\.test\(addr\)\)/);
  assert.match(route, /充值地址尚未配置/);
  assert.match(route, /statusCode|\},\s*503\s*\)/);
});

test('Round 151: persisted placeholder addresses are redacted from API responses', () => {
  assert.match(api, /function safeDepositAddresses\(addresses\)/);
  assert.match(api, /result\[key\]\s*=\s*value\s*&&\s*!\/PLACEHOLDER\/i\.test\(value\)\s*\?\s*value\s*:\s*''/);
  assert.ok((api.match(/deposit_addresses:\s*safeDepositAddresses\(db\.deposit_addresses\)/g) || []).length >= 3);
});
