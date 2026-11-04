'use strict';

// Deployment-time configuration validator. It never prints credential values.
// Usage: npm run preflight (after setting environment variables locally or in CI).
const checks = [];
function add(name, ok, detail) { checks.push({ name, ok: Boolean(ok), detail }); }
function validHttpUrl(value) {
  try { const u = new URL(String(value || '')); return (u.protocol === 'https:' || u.hostname === 'localhost') && Boolean(u.hostname); }
  catch (_) { return false; }
}

const dbUrl = process.env.SUPABASE_URL;
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const authUrl = process.env.SUPABASE_AUTH_URL || dbUrl;
const authKey = process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_AUTH_ANON_KEY;
add('SUPABASE_URL is a valid HTTPS URL', validHttpUrl(dbUrl), 'Set the Supabase project URL.');
add('server-side Supabase credential exists', Boolean(dbKey && String(dbKey).trim()), 'Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY as a server-only environment variable.');
add('Supabase auth URL is valid', validHttpUrl(authUrl), 'Set SUPABASE_AUTH_URL, or use SUPABASE_URL when both services share a project.');
add('Supabase publishable/anon key exists', Boolean(authKey && String(authKey).trim()), 'Set SUPABASE_AUTH_PUBLISHABLE_KEY or SUPABASE_AUTH_ANON_KEY.');
add('admin credentials are configured', Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASS && String(process.env.ADMIN_PASS).length >= 16), 'Set ADMIN_USER and a strong ADMIN_PASS of at least 16 characters.');
const dangerousFlags = ['FINANCIAL_POSTGRES_RPC_ENABLED', 'FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED', 'FINANCIAL_POSTGRES_READS_ENABLED', 'FINANCIAL_MATCHING_ENGINE_ENABLED'];
const unsafeFlags = dangerousFlags.filter(name => process.env[name] !== '0');
add('all financial cutover flags are explicitly disabled', unsafeFlags.length === 0, unsafeFlags.length ? 'Set these flags explicitly to 0 before deployment: ' + unsafeFlags.join(', ') + '. Unset or malformed values are not accepted by preflight.' : 'All financial cutover flags are explicitly set to 0.');

const failed = checks.filter(c => !c.ok);
for (const check of checks) console.log((check.ok ? 'PASS' : 'FAIL') + '  ' + check.name + ' — ' + check.detail);
if (failed.length) {
  console.error('\nPreflight failed: ' + failed.length + ' check(s). No credential values were printed.');
  process.exitCode = 1;
} else {
  console.log('\nPreflight passed. This checks configuration shape only; it does not connect to Supabase or prove that schema/data are initialized.');
}
