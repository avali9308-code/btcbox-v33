'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../api-core');

test('settlement API preserves POSITION_ALREADY_SETTLED as HTTP 409', () => {
  assert.deepEqual(_test.secondsSettlementError({ code: 'POSITION_ALREADY_SETTLED' }, 200), {
    code: 'POSITION_ALREADY_SETTLED',
    status: 409,
    msg: 'This position has already been settled by a different request. Refresh your positions.'
  });
});

test('settlement API preserves same-key/different-hash IDEMPOTENCY_CONFLICT as HTTP 409', () => {
  assert.deepEqual(_test.secondsSettlementError({ code: 'IDEMPOTENCY_CONFLICT' }, 200), {
    code: 'IDEMPOTENCY_CONFLICT',
    status: 409,
    msg: 'This settlement request ID was already used with different parameters.'
  });
});

test('settlement API maps known validation and missing-position errors', () => {
  assert.equal(_test.secondsSettlementError({ code: 'INVALID_ARGUMENT' }, 200).status, 400);
  assert.equal(_test.secondsSettlementError({ code: 'POSITION_NOT_FOUND' }, 200).status, 404);
  assert.equal(_test.secondsSettlementError({ code: 'SYMBOL_MISMATCH' }, 200).status, 409);
});

test('settlement API fails closed for unknown RPC errors', () => {
  const failure = _test.secondsSettlementError({ code: 'UNEXPECTED_DATABASE_ERROR' }, 500);
  assert.equal(failure.code, 'UNEXPECTED_DATABASE_ERROR');
  assert.equal(failure.status, 503);
  assert.equal(failure.msg, 'The database did not confirm settlement. Please try again later.');
});

test('Seconds API and trading view preserve every open position in the returned array', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
  const api = read('api-core.js');
  const start = api.indexOf("if (path === 'seconds/positions' && method === 'GET')");
  const end = api.indexOf('// ---------- POST /api/support/chat ----------', start);
  assert.ok(start >= 0 && end > start, 'Seconds positions API handler missing');
  assert.match(api.slice(start, end), /open: Array\.isArray\(result\.open\) \? result\.open : \[\]/);
  const sql = read('supabase/sql/0014_financial_seconds_contracts_v1.sql');
  assert.match(sql, /jsonb_agg\(jsonb_build_object\([\s\S]*?into v_open from public\.seconds_contract_positions where user_id=p_user_id and status='open'/i);
  const view = read('assets/js/views-trading.js');
  assert.match(view, /const openPositions=Array\.isArray\(state\.secondsPositions\?\.open\)\?state\.secondsPositions\.open:\[\]/);
  assert.match(view, /const list=tab==='open'\?openPositions:historyPositions/);
  assert.match(view, /list\.map\(p=>/);
});
