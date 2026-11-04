'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/views-trading.js'), 'utf8');
const start = source.indexOf('VIEWS.seconds.afterRender = function(){');
const end = source.indexOf('/* ================= ORDERS view', start);
assert.ok(start >= 0 && end > start, 'Seconds view source must be present');
const view = source.slice(start, end);
assert.doesNotThrow(() => new vm.Script(source), 'views-trading.js must remain syntactically valid');

function helper(name, nextName) {
  const from = view.indexOf('function ' + name + '(');
  const to = view.indexOf('  function ' + nextName + '(', from);
  assert.ok(from >= 0 && to > from, name + ' helper must be present');
  return view.slice(from, to).trim();
}

test('seconds order intent is persisted before the network request and the exact key is reused', () => {
  const persistAt = view.indexOf('if(!persistPendingSecondsOrder(orderIntent))');
  const requestAt = view.indexOf('await apiAdapter.secondsOrder({symbol:orderIntent.symbol');
  assert.ok(persistAt >= 0 && requestAt > persistAt, 'persist immutable request intent before network I/O');
  assert.ok(view.includes('request_id:orderIntent.request_id'), 'send the exact persisted idempotency key');
  assert.ok(view.includes('secondsPendingIntent=readPendingSecondsOrder()'), 'restore pending intent on full reload');
  assert.ok(view.includes('if(secondsPendingIntent){toast('), 'block another submission while an intent is unresolved');
  assert.ok(view.includes('const unknown=isSecondsOrderOutcomeUnknown(r);'), 'classify uncertain outcomes explicitly');
  assert.ok(view.includes("setSecondsEntryEnabled(false,'Checking the latest contract position status.')"), 'order controls stay disabled while the initial status snapshot loads');
  assert.ok(view.includes("setSecondsEntryEnabled(false,positionsUnavailableMessage)"), 'order controls stay disabled when the backend is unavailable or cutover is incomplete');
});

test('non-JSON platform responses remain UNKNOWN while explicit pre-write rejections are definitive', () => {
  const classifySource = helper('isSecondsOrderOutcomeUnknown', 'findSecondsPositionSnapshot');
  const classify = vm.runInNewContext('(' + classifySource + ')');
  assert.equal(classify({status:404,raw:'<!doctype html><title>404</title>'}), true,
    'a Vercel platform HTML 404 is not a structured business rejection');
  assert.equal(classify({status:0,code:'NETWORK_ERROR'}), true);
  assert.equal(classify({status:503,code:'FINANCIAL_RPC_UNAVAILABLE'}), true);
  assert.equal(classify({status:503,code:'FINANCIAL_CUTOVER_INCOMPLETE'}), false);
  assert.equal(classify({status:503,code:'REFERENCE_PRICE_UNAVAILABLE'}), false);
  assert.equal(classify({status:400,code:'INVALID_AMOUNT'}), false);
});

test('pending intent reader validates schema and fails closed on corrupt or unavailable storage', () => {
  const readSource = helper('readPendingSecondsOrder', 'persistPendingSecondsOrder');
  const key = 'btcbox.seconds.pending.v1.user-1';
  const valid = {version:1,request_id:'request_123456789012',symbol:'BTC',direction:'UP',duration_sec:30,amount:'10',created_at:1700000000000};
  let stored = JSON.stringify(valid);
  const context = {
    secondsPendingStorageKey:key,
    localStorage:{getItem(){return stored;}}
  };
  const read = vm.runInNewContext('(' + readSource + ')', context);
  assert.deepEqual(JSON.parse(JSON.stringify(read())), valid);
  stored = '{broken';
  assert.equal(read().invalid, true, 'malformed JSON must lock the action');
  stored = JSON.stringify({...valid, direction:'SIDEWAYS'});
  assert.equal(read().invalid, true, 'invalid direction must lock the action');
  context.localStorage.getItem = () => { throw new Error('storage blocked'); };
  assert.equal(read().invalid, true, 'storage read failure must fail closed');
});

test('pending intent cleanup only clears the in-memory guard after storage removal succeeds', () => {
  const persistSource = helper('persistPendingSecondsOrder', 'clearPendingSecondsOrder');
  const clearStart = view.indexOf('function clearPendingSecondsOrder(){');
  const clearEnd = view.indexOf('  let secondsPendingIntent=', clearStart);
  assert.ok(clearStart >= 0 && clearEnd > clearStart, 'clear helper must be present');
  const clearSource = view.slice(clearStart, clearEnd).trim();
  const values = new Map();
  const context = {
    secondsPendingStorageKey:'btcbox.seconds.pending.v1.user-1',
    secondsUserKey:'user-1',
    state:{_secondsOrderUnknownUserKey:'user-1'},
    secondsPendingIntent:{request_id:'request_123456789012'},
    localStorage:{
      setItem(k,v){values.set(k,v);},
      removeItem(k){values.delete(k);}
    }
  };
  const persist = vm.runInNewContext('(' + persistSource + ')', context);
  const clear = vm.runInNewContext('(' + clearSource + ')', context);
  assert.equal(persist({request_id:'request_123456789012'}), true);
  assert.equal(clear(), true);
  assert.equal(values.size, 0);
  assert.equal(context.secondsPendingIntent, null);
  assert.equal(context.state._secondsOrderUnknownUserKey, undefined);
  context.secondsPendingIntent = {request_id:'request_123456789012'};
  context.localStorage.removeItem = () => { throw new Error('quota/storage failure'); };
  assert.equal(clear(), false);
  assert.ok(context.secondsPendingIntent, 'failed removal must retain the in-memory lock');
});

test('Orders cancellation success is based on the refreshed canonical status, not the POST response alone', () => {
  const orderStart = source.indexOf('VIEWS.orders.afterRender = function(){');
  const orderView = source.slice(orderStart);
  assert.ok(orderStart >= 0, 'Orders view must be present');
  assert.ok(orderView.includes('const latestStatus=String(latest&&latest.status||\'\').toLowerCase();'),
    'read the canonical order status after cancellation');
  assert.ok(orderView.includes("if(latestStatus==='cancelled'||latestStatus==='canceled')"),
    'only canonical cancelled status may show success');
  assert.ok(orderView.includes("else if(latestStatus==='filled')"),
    'a fill race must be reported as filled, not canceled');
  assert.ok(orderView.includes('else if(isActiveOrderStatus(latestStatus))'),
    'open and partially filled orders must remain active');
  assert.ok(orderView.includes('Cancellation status is unconfirmed. Refresh your orders before taking further action.'),
    'a failed status read must not claim cancellation success');
});

test('only definitive rejection and server-confirmed position reconciliation clear the durable order intent', () => {
  assert.ok(view.includes('if(positionMatch.status===\'history\'){\n        const cleared=clearPendingSecondsOrder();'),
    'a canonical history match is a definitive reconciliation');
  assert.ok(view.includes('if(clearPendingSecondsOrder()){\n          busy=false;'),
    'a definitive API rejection may release the guard only after storage cleanup');
  assert.ok(view.includes('const clearedPending=clearPendingSecondsOrder();'),
    'a server-confirmed open position clears the pending intent');
  assert.ok(view.includes('if(unknown){\n        if(secondsUserKey)state._secondsOrderUnknownUserKey=secondsUserKey;'),
    'unknown outcomes retain the account-scoped guard');
});
