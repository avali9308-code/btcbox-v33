'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets/js/app-core.js'), 'utf8');
const pairsMatch = source.match(/const PAIRS = (\[[^\]]+\]);/);
assert.ok(pairsMatch, 'supported PAIRS allowlist must exist');
const PAIRS = vm.runInNewContext('(' + pairsMatch[1] + ')');

function createMarket() {
  const market = {};
  PAIRS.forEach(sym => {
    const base = sym.slice(0, -4);
    market[sym] = { sym, base, price: 0, chg: 0, high: 0, low: 0, vol: 0, ts: 0, source: 'loading' };
  });
  const start = source.indexOf('function applyMarket(r){');
  const end = source.indexOf('\nfunction updateLivePriceEls()', start);
  assert.ok(start >= 0 && end > start, 'applyMarket function must be extractable for direct regression tests');
  const fnSource = source.slice(start, end);
  const context = { market, PAIRS, Date };
  const applyMarket = vm.runInNewContext(fnSource + '\napplyMarket;', context);
  return { market, applyMarket };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

test('data payload refreshes initialized symbols and preserves fields on malformed values', () => {
  const { market, applyMarket } = createMarket();
  const priorTs = nowSeconds() - 10;
  Object.assign(market.BTCUSDT, { price: 100, chg: 1, high: 110, low: 90, vol: 500, ts: priorTs, source: 'old-feed' });

  applyMarket({ source: 'new-feed', data: { BTC: {
    price: '101.25', chg: '-2.5', high: 'Infinity', low: -1, vol: '', ts: 'not-a-timestamp'
  } } });

  assert.equal(market.BTCUSDT.price, 101.25);
  assert.equal(market.BTCUSDT.chg, -2.5);
  assert.equal(market.BTCUSDT.high, 110);
  assert.equal(market.BTCUSDT.low, 90);
  assert.equal(market.BTCUSDT.vol, 500);
  assert.equal(market.BTCUSDT.ts, priorTs);
  assert.equal(market.BTCUSDT.source, 'new-feed');
});

test('markets[] payload refreshes an already initialized symbol', () => {
  const { market, applyMarket } = createMarket();
  const ts = nowSeconds();
  applyMarket({ markets: [{ sym: 'BTC', price: 65000, chg: -1.2, high: 67000, low: 64000, vol: 1234, ts, source: 'provider' }] });
  assert.equal(market.BTCUSDT.price, 65000);
  assert.equal(market.BTCUSDT.chg, -1.2);
  assert.equal(market.BTCUSDT.high, 67000);
  assert.equal(market.BTCUSDT.low, 64000);
  assert.equal(market.BTCUSDT.vol, 1234);
  assert.equal(market.BTCUSDT.ts, ts);
});

test('new supported symbol is initialized only after a valid positive price', () => {
  const { market, applyMarket } = createMarket();
  delete market.ETHUSDT;
  applyMarket({ markets: [{ sym: 'ETH', price: 3000, chg: 1, high: 3100, low: 2900, vol: 20, ts: nowSeconds() }] });
  assert.equal(market.ETHUSDT.price, 3000);

  delete market.SOLUSDT;
  applyMarket({ markets: [{ sym: 'SOL', price: 'NaN', chg: 0, ts: nowSeconds() }] });
  assert.equal(Object.hasOwn(market, 'SOLUSDT'), false);
});

test('malformed and unsupported symbols are rejected before market mutation', () => {
  const { market, applyMarket } = createMarket();
  applyMarket({ data: {
    'BTC/': { price: 1 },
    'BTCUSDTUSDT': { price: 1 },
    'FAKE': { price: 1 },
    '': { price: 1 }
  }, markets: [
    { sym: 'BTC/USDT', price: 1 },
    { sym: 'UNKNOWNUSDT', price: 1 },
    { sym: 'BTCUSDT.extra', price: 1 }
  ] });
  assert.equal(Object.hasOwn(market, 'BTC/USDT'), false);
  assert.equal(Object.hasOwn(market, 'FAKEUSDT'), false);
  assert.equal(Object.hasOwn(market, 'UNKNOWNUSDT'), false);
  assert.equal(market.BTCUSDT.price, 0);
});

test('NaN, infinity, empty and invalid negative numeric fields never overwrite valid values', () => {
  const { market, applyMarket } = createMarket();
  Object.assign(market.BTCUSDT, { price: 10, chg: 2, high: 12, low: 8, vol: 50, ts: nowSeconds() });
  applyMarket({ data: { BTC: {
    price: NaN, chg: Infinity, high: -1, low: 0, vol: '-Infinity'
  } } });
  assert.deepEqual(
    [market.BTCUSDT.price, market.BTCUSDT.chg, market.BTCUSDT.high, market.BTCUSDT.low, market.BTCUSDT.vol],
    [10, 2, 12, 8, 50]
  );
});

test('timestamps accept plausible Unix seconds, use response fallback and preserve prior valid time', () => {
  const { market, applyMarket } = createMarket();
  const oldTs = nowSeconds() - 20;
  const responseTs = nowSeconds() - 5;
  market.BTCUSDT.ts = oldTs;
  applyMarket({ ts: responseTs, data: { BTC: { price: 11 } } });
  assert.equal(market.BTCUSDT.ts, responseTs);

  applyMarket({ data: { BTC: { price: 12, ts: Date.now() } } });
  assert.equal(market.BTCUSDT.ts, responseTs);

  delete market.ETHUSDT;
  applyMarket({ data: { ETH: { price: 3000, ts: 'invalid' } } });
  assert.equal(market.ETHUSDT.ts, 0);
});
