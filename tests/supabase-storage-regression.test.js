const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify', 'functions', 'api.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase', 'sql', 'btcbox_state_cas.sql'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'SUPABASE-MIGRATION.md'), 'utf8');

test('Supabase adapter is opt-in and uses only server-side secrets', () => {
  assert.match(api, /SUPABASE_URL/);
  assert.match(api, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(api, /SUPABASE_SECRET_KEY/);
  assert.match(api, /btcbox_save_state/);
  assert.doesNotMatch(api, /NEXT_PUBLIC_SUPABASE/);
});

test('empty Supabase state fails closed rather than initializing a blank exchange database', () => {
  assert.match(api, /Supabase state is not initialized/);
  assert.match(api, /Persistent storage unavailable/);
});

test('Supabase schema enables RLS and denies direct public role access', () => {
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.btcbox_state from anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.btcbox_save_state\(bigint, jsonb\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.btcbox_save_state\(bigint, jsonb\) to service_role/i);
});

test('state write uses compare-and-swap revision checks', () => {
  assert.match(sql, /where id = 'main'\s+and revision = p_expected_revision/i);
  assert.match(sql, /return inserted_count = 1/i);
  assert.match(api, /Persistent storage write conflict/);
});

test('migration docs disclose inactive project and require backup/import before cutover', () => {
  assert.match(doc, /INACTIVE/);
  assert.match(doc, /No restore\/unpause/);
  assert.match(doc, /Export the complete Netlify Blobs/);
  assert.match(doc, /does not import the Blobs data/i);
});
