const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/api.js'), 'utf8');

function between(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing route boundary: ${startMarker}`);
  return source.slice(start, end);
}

test('financial writes require full approval, normalized reads, and configured PostgreSQL', () => {
  assert.match(source, /function financialWritesEnabled\(\)\s*\{\s*return financialPostgresReadsEnabled\(\)\s*&&\s*supabaseStorageConfigured\(\);/);
  for (const [start, end] of [
    ["if (path === 'withdraw' && method === 'POST')", '// ---------- GET /api/market ----------'],
    ["if (path === 'earn' && method === 'POST')", "if (path === 'support/chat' && method === 'POST')"],
    ["if (sub === 'user/balance' && method === 'POST')", '// POST /api/admin/user/freeze'],
    ["if (sub === 'deposit/confirm' && method === 'POST')", '// POST /api/admin/withdraw/approve'],
    ["if (sub === 'withdraw/approve' && method === 'POST')", "if (sub === 'kyc/approve'"]
  ]) {
    const route = between(start, end);
    assert.match(route, /financialWritesEnabled\(\)/, `write gate missing from ${start}`);
  }
  const reject = between("if (sub === 'withdraw/reject' && method === 'POST')", "if (sub === 'kyc/approve'");
  assert.match(reject, /financialWritesEnabled\(\)/);
});

test('financial writes do not become enabled by RPC flag alone', () => {
  const reads = source.match(/function financialPostgresReadsEnabled\(\)\s*\{([^}]*)\}/);
  assert.ok(reads);
  assert.match(reads[1], /manualDepositRpcEnabled\(\)/);
  assert.match(reads[1], /FINANCIAL_POSTGRES_READS_ENABLED/);
  const base = source.match(/function manualDepositRpcEnabled\(\)\s*\{([^}]*)\}/);
  assert.ok(base);
  assert.match(base[1], /FINANCIAL_POSTGRES_RPC_ENABLED/);
  assert.match(base[1], /FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED/);
});
