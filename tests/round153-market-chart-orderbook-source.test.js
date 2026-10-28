const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/api.js'), 'utf8');

function routeBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `route markers must exist: ${startMarker}`);
  return source.slice(start, end);
}

test('kline route uses Coinbase first and Bybit only as fallback', () => {
  const route = routeBetween("if (path === 'kline' && method === 'GET')", "if (path === 'depth' && method === 'GET')");
  assert.ok(route.includes('api.exchange.coinbase.com/products/'));
  assert.ok(route.includes('/candles?granularity='));
  assert.ok(route.includes('api.bybit.com/v5/market/kline'));
  assert.ok(route.indexOf('api.exchange.coinbase.com') < route.indexOf('api.bybit.com'));
  assert.ok(!route.includes('api.binance.com'));
});

test('order book route uses Coinbase first and Bybit fallback with timeout and bounded rows', () => {
  const route = routeBetween("if (path === 'depth' && method === 'GET')", '// ---------- 以下接口需要登录 ----------');
  assert.ok(route.includes('/book?level=2'));
  assert.ok(route.includes('api.bybit.com/v5/market/orderbook'));
  assert.ok(route.indexOf('api.exchange.coinbase.com') < route.indexOf('api.bybit.com'));
  assert.ok(route.includes('AbortSignal.timeout(5000)'));
  assert.ok(route.includes('.slice(0, 20)'));
  assert.ok(!route.includes('api.binance.com'));
});

test('kline and order book reject non-USDT quote symbols instead of silently mixing quotes', () => {
  const kline = routeBetween("if (path === 'kline' && method === 'GET')", "if (path === 'depth' && method === 'GET')");
  const depth = routeBetween("if (path === 'depth' && method === 'GET')", '// ---------- 以下接口需要登录 ----------');
  assert.ok(kline.includes("!symbol.endsWith('USDT')"));
  assert.ok(depth.includes("!symbol.endsWith('USDT')"));
});

test('provider failure returns an explicit unavailable response, not fabricated market data', () => {
  const kline = routeBetween("if (path === 'kline' && method === 'GET')", "if (path === 'depth' && method === 'GET')");
  const depth = routeBetween("if (path === 'depth' && method === 'GET')", '// ---------- 以下接口需要登录 ----------');
  assert.ok(kline.includes("'KLINE_DATA_UNAVAILABLE'"));
  assert.ok(depth.includes("'DEPTH_DATA_UNAVAILABLE'"));
  assert.ok(kline.includes('klines: [], data: []'));
  assert.ok(depth.includes('bids: [], asks: []'));
});
