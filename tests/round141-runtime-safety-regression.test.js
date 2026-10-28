'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Round 141: order history escapes API-controlled text before inserting HTML', () => {
  const page = read('pages/trade.html');
  assert.match(page, /function escapeOrderText\(value\)/);
  assert.match(page, /escapeOrderText\(o\.symbol\|\|coin\.sym\+'\/USDT'\)/);
  assert.match(page, /escapeOrderText\(o\.qty\|\|o\.quantity\|\|0\)/);
  assert.match(page, /escapeOrderText\(o\.time\|\|o\.created_at\|\|''\)/);
});

test('Round 141: order ID uniqueness is scoped to the authenticated user in the SQL contract', () => {
  const sql = read('supabase/sql/financial_matching_engine_v1.sql');
  assert.match(sql, /unique\s*\(user_id,\s*client_order_id\)/i);
  assert.match(sql, /where user_id\s*=\s*p_user_id and client_order_id\s*=\s*p_client_order_id/i);
});

test('Round 141: KYC locale changes trigger a fresh localized status render', () => {
  const page = read('pages/kyc.html');
  assert.match(page, /document\.addEventListener\('langChange'/);
  assert.match(page, /location\.reload\(\)/);
  assert.match(page, /I18N\.t\('kycLoadFailed'\)/);
});
