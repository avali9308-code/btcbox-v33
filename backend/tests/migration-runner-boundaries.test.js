'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('operational migration runner explicitly skips staging and reconciliation SQL', () => {
  const runner = read('scripts/run_migrations.sh');
  const stagingFiles = [
    '0017_financial_migration_staging_v5.sql',
    '0018_financial_migration_staging_reconciliation_v6.sql',
    '0019_financial_migration_reconciliation_v4.sql',
    '0020_financial_ledger_reconciliation_v1.sql'
  ];
  for (const file of stagingFiles) {
    assert.ok(runner.includes(file), 'runner must explicitly classify ' + file);
  }
  const skip = runner.indexOf('[skip] staging/reconciliation only:');
  const apply = runner.indexOf('psql "$DATABASE_URL"');
  assert.ok(skip >= 0 && apply > skip, 'staging files must be skipped before the SQL apply command');
  assert.match(runner, /DATABASE_URL/);
  assert.match(runner, /仅用于本地测试环境/);
});

test('staging import and reconciliation files are not operational migrations', () => {
  const staging = read('supabase/sql/0017_financial_migration_staging_v5.sql');
  const stagedAudit = read('supabase/sql/0018_financial_migration_staging_reconciliation_v6.sql');
  const operationalAudit = read('supabase/sql/0019_financial_migration_reconciliation_v4.sql');
  const ledgerAudit = read('supabase/sql/0020_financial_ledger_reconciliation_v1.sql');
  assert.match(staging, /Apply ONLY to a dedicated staging project/i);
  for (const sql of [stagedAudit, operationalAudit, ledgerAudit]) {
    assert.match(sql, /read-only|diagnostic|reconciliation/i);
    assert.doesNotMatch(sql, /\\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER TABLE|CREATE TABLE|DROP TABLE)\\b/i);
  }
});

test('migration guide records the operational runner exclusion', () => {
  const order = read('supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md');
  assert.match(order, /0017[\\s\\S]*0018[\\s\\S]*0019[\\s\\S]*0020/);
  assert.match(order, /not part of the ordered operational RPC sequence/i);
  assert.match(order, /explicitly skipped by the operational runner/i);
});
