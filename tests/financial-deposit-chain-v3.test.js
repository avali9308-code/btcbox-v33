const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/financial_deposit_chain_verification_v3.sql'), 'utf8').toLowerCase();
const gate = fs.readFileSync(path.join(root, 'scripts/financial_cutover_gate.py'), 'utf8');
const client = fs.readFileSync(path.join(root, 'financial_db.py'), 'utf8');

test('deposit credit requires sufficient chain confirmations and canonical request hash', () => {
  assert.match(sql, /p_confirmations < p_required_confirmations/);
  assert.match(sql, /chain observation request hash mismatch/);
  assert.match(sql, /v_d\.amount <> p_observed_amount/);
  assert.match(sql, /public\.apply_financial_operation/);
});

test('deposit chain verification and ledger credit happen in one SQL transaction', () => {
  assert.match(sql, /update public\.deposit_records\s+set status='confirmed'/);
  assert.match(sql, /insert into public\.financial_audit_log/);
  assert.match(sql, /deposit-chain:' \|\| p_request_id/);
  assert.match(sql, /manual deposit confirmation disabled/);
});

test('optional chain verifier RPC is service-role-only but not required for manual-review cutover', () => {
  assert.match(sql, /revoke all on function public\.verify_and_credit_deposit_atomic/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(gate, /supabase\/sql\/financial_deposit_chain_verification_v3\.sql/);
  assert.match(client, /def verify_and_credit_deposit\(/);
});
