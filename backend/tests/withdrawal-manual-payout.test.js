'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'assets/js/views-account.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0023_withdrawal_manual_payout_completion_v1.sql'), 'utf8');

test('admin payout completion requires a TxID in the active UI', () => {
  assert.ok(ui.includes('TxID / 转账参考号（必填）'));
  assert.ok(ui.includes('maxlength="160" required aria-required="true"'));
  assert.ok(ui.includes("if(!value){toast('请填写实际转账的 TxID / 参考号。'"));
});

test('API rejects an empty TxID and enforces the existing length limit', () => {
  assert.ok(api.includes("if (!reference) return json({ ok: false, code: 'PAYOUT_REFERENCE_REQUIRED'"));
  assert.ok(api.includes('reference.length > 160'));
});

test('database RPC independently rejects an empty TxID', () => {
  assert.ok(sql.includes("coalesce(btrim(p_reference),'')=''"));
  assert.ok(sql.includes("length(coalesce(p_reference,''))>160"));
});

test('manual payout remains approved-only and exact retries do not duplicate completion', () => {
  assert.ok(sql.includes("IF v_w.status='completed' THEN"));
  assert.ok(sql.includes("IF coalesce(v_w.payout_reference,'')<>v_ref THEN"));
  assert.ok(sql.includes("'duplicate',true"));
  assert.ok(sql.includes("IF v_w.status<>'approved' THEN"));
  assert.ok(sql.includes('withdrawal_manual_payout_completed'));
});
