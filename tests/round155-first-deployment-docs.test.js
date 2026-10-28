const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('first-deployment guide explains empty business schema before code upload', () => {
  const guide = fs.readFileSync(path.join(root, 'SUPABASE-FIRST-DEPLOYMENT.md'), 'utf8');
  assert.match(guide, /has not uploaded\/deployed BTCBOX code yet/i);
  assert.match(guide, /no `public` business tables/i);
  assert.match(guide, /staging project/i);
  assert.match(guide, /must remain unset/i);
});

test('environment template contains no actual privileged credentials', () => {
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  assert.match(env, /SUPABASE_URL=https:\/\/zlozsutefnmgwwzrlipt\.supabase\.co/);
  assert.match(env, /SUPABASE_SERVICE_ROLE_KEY=$/m);
  assert.match(env, /SUPABASE_SECRET_KEY=$/m);
  assert.match(env, /FINANCIAL_POSTGRES_RPC_ENABLED=/);
  assert.doesNotMatch(env, /sb_secret_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{30,}/);
});
