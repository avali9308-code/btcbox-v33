'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');

test('Round 172: API status messages are normalized to the English-only UI locale', () => {
  assert.match(api, /function normalizeApiMessages\(value\)/);
  assert.match(api, /API_ENGLISH_MESSAGES\.get\(item\)/);
  assert.match(api, /const normalized = normalizeApiMessages\(obj\)/);
  assert.match(api, /The request could not be completed\. Please try again\./);
  assert.match(api, /Short-term contracts are unavailable until financial cutover is complete\./);
});

test('Round 172: API normalization only rewrites fixed msg fields, not user content', () => {
  assert.match(api, /if \(key === 'msg' && typeof item === 'string'/);
  assert.match(api, /out\[key\] = normalizeApiMessages\(item\)/);
});
