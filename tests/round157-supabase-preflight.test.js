const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Supabase preflight SQL is read-only and checks core deployment metadata', () => {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'diagnostics', '00-read-only-preflight.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert.match(sql, /read-only preflight/i);
  assert.match(sql, /information_schema\.schemata/i);
  assert.match(sql, /information_schema\.tables/i);
  assert.match(sql, /pg_proc/i);
  assert.match(sql, /relrowsecurity/i);
  assert.match(sql, /role_table_grants/i);
  assert.doesNotMatch(sql, /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\s+(TABLE|SCHEMA|FUNCTION|POLICY|INDEX|ROLE|INTO|SET|FROM|ON|TRIGGER|VIEW|MATERIALIZED)\b/i);
});
