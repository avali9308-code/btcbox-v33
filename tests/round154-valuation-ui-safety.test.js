const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'assets/js/app.js'), 'utf8');
test('asset total does not present a partial live valuation as complete', () => {
  assert.ok(app.includes('account.valuationComplete = j.valuation_complete === true'));
  assert.ok(app.includes("(account.valuationComplete ? fmtNum(account.totalUsdt) : '--')"));
  assert.ok(app.includes("Some asset prices are unavailable; total valuation is incomplete."));
});
