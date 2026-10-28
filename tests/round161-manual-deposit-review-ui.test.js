const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const i18n = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8');
const depositPage = fs.readFileSync(path.join(root, 'pages/deposit.html'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md'), 'utf8');

test('deposit pending status uses manual-review language in all supported locales', () => {
  const expected = [
    ["'zh-CN':", "depositConfirming:'审核中'"],
    ["'zh-TW':", "depositConfirming:'審核中'"],
    ["'en':", "depositConfirming:'Under review'"],
    ["'ja':", "depositConfirming:'審査中'"],
    ["'ko':", "depositConfirming:'검토 중'"],
    ["'vi':", "depositConfirming:'Đang xét duyệt'"]
  ];
  for (const [locale, value] of expected) {
    const line = i18n.split('\n').find((entry) => entry.includes(locale) && entry.includes('depositConfirming:'));
    assert.ok(line, `missing deposit status locale ${locale}`);
    assert.ok(line.includes(value), `incorrect manual-review label for ${locale}`);
  }
});

test('deposit history renders localized status labels rather than backend status tokens', () => {
  assert.ok(depositPage.includes("I18N.t('depositConfirming')"));
  assert.ok(depositPage.includes("I18N.t('depositConfirmed')"));
  assert.ok(depositPage.includes("I18N.t('depositFailed')"));
  assert.ok(!depositPage.includes("+' '+String(d.status"));
});

test('manual-review migration path does not require automated chain verification SQL', () => {
  assert.ok(migration.includes('intended deposit-credit path for the current manual-review business model'));
  assert.ok(migration.includes('financial_deposit_chain_verification_v3.sql` is optional'));
  assert.ok(migration.includes('admin_manual_deposit_atomic'));
});

test('release docs describe the current manual deposit RPC route without stale JSON-only claims', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.ok(readme.includes('calls `admin_manual_deposit_atomic`'));
  assert.ok(readme.includes('fails closed without crediting funds'));
  assert.ok(!readme.includes('is **not wired to this RPC**'));
  assert.ok(readme.includes('has not yet been applied to a live staging database'));
});

test('financial migration preflight follows the documented dependency order', () => {
  const preflight = fs.readFileSync(path.join(root, 'scripts/check_financial_migration_preflight.py'), 'utf8');
  const ordered = [
    '"financial_ledger_v1.sql"',
    '"financial_lifecycle_v2.sql"',
    '"financial_admin_adjustment_v1.sql"',
    '"financial_earn_redemption_idempotency_v4.sql"',
    '"financial_earn_policy_v5.sql"',
    '"financial_admin_manual_deposit_v1.sql"',
    '"financial_spot_trade_v3.sql"',
    '"financial_matching_engine_v1.sql"'
  ];
  let previous = -1;
  for (const token of ordered) {
    const position = preflight.indexOf(token);
    assert.ok(position > previous, `migration order mismatch at ${token}`);
    previous = position;
  }
});
