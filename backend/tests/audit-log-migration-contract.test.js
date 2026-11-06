'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const base = read('supabase/sql/0002_financial_ledger_v1.sql');
const lifecycle = read('supabase/sql/0003_financial_lifecycle_v2.sql');
const audit = read('supabase/sql/0021_admin_audit_log_append_only_v1.sql');
const manualDeposit = read('supabase/sql/0007_financial_admin_manual_deposit_v1.sql');
const api = read('api-core.js');
const runner = read('scripts/run_migrations.sh');

test('0021 extends the canonical audit table created by 0002 instead of defining a parallel shape', () => {
  assert.match(base, /CREATE TABLE IF NOT EXISTS public\.financial_audit_log/i);
  for (const column of ['actor_id', 'subject_user_id', 'action', 'object_type', 'object_id', 'reason', 'metadata', 'created_at']) {
    assert.match(base, new RegExp('\\b' + column + '\\b'));
  }
  assert.match(audit, /to_regclass\('public\.financial_audit_log'\)/i);
  assert.match(audit, /column_name = 'actor_id'/i);
  assert.match(audit, /column_name = 'subject_user_id'/i);
  assert.match(audit, /column_name = 'metadata'/i);
  assert.doesNotMatch(audit, /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.financial_audit_log/i);
  assert.doesNotMatch(audit, /financial_audit_log_uid_idx|ON public\.financial_audit_log\s*\(uid\)/i);
});

test('0021 makes the audit table append-only for the service role and table API', () => {
  assert.match(audit, /ALTER TABLE public\.financial_audit_log ENABLE ROW LEVEL SECURITY/i);
  assert.match(audit, /REVOKE ALL ON TABLE public\.financial_audit_log FROM PUBLIC, anon, authenticated/i);
  assert.match(audit, /REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public\.financial_audit_log FROM service_role/i);
  assert.match(audit, /GRANT SELECT, INSERT ON TABLE public\.financial_audit_log TO service_role/i);
  assert.match(audit, /BEFORE UPDATE OR DELETE ON public\.financial_audit_log/i);
  assert.match(audit, /BEFORE TRUNCATE ON public\.financial_audit_log/i);
});

test('append RPC uses invoker privileges and maps the existing API payload to canonical columns', () => {
  assert.match(audit, /FUNCTION public\.append_admin_audit_log\([\s\S]*?SECURITY INVOKER[\s\S]*?SET search_path = ''/i);
  assert.match(audit, /actor_id, subject_user_id, action, object_type, object_id, reason, metadata/i);
  assert.match(audit, /v_actor, v_uid, left\(btrim\(p_action\), 100\), 'admin_action', v_uid/i);
  assert.match(api, /rpc\/append_admin_audit_log/);
  assert.match(api, /p_action: String\(action\), p_uid: String\(uid \|\| ''\), p_by: 'admin', p_detail:/);
});

test('append RPC is explicitly unavailable to PUBLIC and browser roles', () => {
  assert.match(audit, /REVOKE ALL ON FUNCTION public\.append_admin_audit_log\(TEXT, TEXT, TEXT, TEXT, JSONB\)\s+FROM PUBLIC, anon, authenticated/i);
  assert.match(audit, /GRANT EXECUTE ON FUNCTION public\.append_admin_audit_log\(TEXT, TEXT, TEXT, TEXT, JSONB\)\s+TO service_role/i);
  assert.doesNotMatch(audit, /SECURITY DEFINER/i);
});

test('other financial RPCs continue to write the same canonical audit columns', () => {
  assert.match(lifecycle, /public\.financial_audit_log/i);
  assert.match(manualDeposit, /INSERT INTO public\.financial_audit_log\(actor_id, subject_user_id, action, object_type, object_id, reason, metadata\)/i);
});

test('numbered runner keeps 0021 in the ordered chain after the canonical 0002 table', () => {
  assert.match(runner, /\[0-9\]\[0-9\]\[0-9\]\[0-9\]_\*\.sql/);
  assert.ok(base.indexOf('CREATE TABLE IF NOT EXISTS public.financial_audit_log') >= 0);
  assert.ok(audit.indexOf('canonical 0002 schema') >= 0);
});
