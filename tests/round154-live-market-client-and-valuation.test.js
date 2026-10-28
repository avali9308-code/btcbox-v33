const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const client = fs.readFileSync(path.join(__dirname, '..', 'assets/js/market-api.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/api.js'), 'utf8');

test('browser market client uses same-origin API only and no direct Binance WebSocket', () => {
  assert.ok(client.includes("fetch('/api/market'"));
  assert.ok(client.includes("fetch('/api/kline?"));
  assert.ok(client.includes("fetch('/api/depth?"));
  assert.ok(!/stream\.binance\.com|api\.binance\.com|new WebSocket/.test(client));
});

test('browser market client rejects invalid/non-finite prices and clears stale data after prolonged failures', () => {
  assert.ok(client.includes('Number.isFinite(price)'));
  assert.ok(client.includes("state.markets={};state.mode='unavailable';emit();"));
  assert.ok(client.includes("j.ok!==true"));
});

test('account valuation uses live Coinbase-first USDT prices and marks missing valuations explicitly', () => {
  assert.ok(api.includes('async function getLiveUsdtPrices(requestedBases)'));
  assert.ok(api.includes("p.quote_currency === 'USDT'"));
  assert.ok(api.includes("https://api.bybit.com/v5/market/tickers?category=spot"));
  assert.ok(api.includes('valuation_complete: unpricedAssets.length === 0'));
  assert.ok(api.includes('valuation_available: c === \'USDT\' || price > 0'));
  assert.ok(!api.includes('const PRICE_MAP = { BTC: 67000'));
  assert.ok(!api.includes('const p = prices || { BTC: 65000'));
});
