const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'api.js'), 'utf8');
const start = api.indexOf("if (path === 'market' && method === 'GET')");
const end = api.indexOf('// ---------- POST /api/order ----------', start);
const route = api.slice(start, end);

test('market route uses Coinbase as primary source', () => {
  assert.ok(route.includes('https://api.exchange.coinbase.com/products'));
  assert.ok(route.includes("'coinbase'"));
});

test('market route only uses Bybit as fallback for missing Coinbase symbols', () => {
  assert.ok(route.includes("const missingBases = bases.filter(base => !marketsByBase[base])"));
  assert.ok(route.includes('https://api.bybit.com/v5/market/tickers?category=spot'));
  assert.ok(route.indexOf('const missingBases') < route.indexOf('https://api.bybit.com'));
});

test('market route does not use Binance or silently mix USD and USDT quote pairs', () => {
  assert.ok(!route.includes('api.binance.com'));
  assert.ok(route.includes("p.quote_currency === 'USDT'"));
  assert.ok(route.includes("/USDT$/"));
  assert.ok(!route.includes('USD-'));
});

test('market route validates numeric data, times out provider calls, and does not invent missing prices', () => {
  assert.ok(route.includes('AbortSignal.timeout(5000)'));
  assert.ok(route.includes('Number.isFinite'));
  assert.ok(route.includes("'MARKET_DATA_UNAVAILABLE'"));
  assert.ok(route.includes('markets: [], data: {}'));
});
