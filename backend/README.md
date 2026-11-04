# BTCBOX

BTCBOX frontend and shared Node API handler. The current migration target is Vercel with Supabase-backed persistence. See `VERCEL-DEPLOYMENT.md` and `SUPABASE-FIRST-DEPLOYMENT.md` before deploying.

## Financial safety status

All financial write, normalized-read, and matching capabilities require explicit opt-in: every relevant `FINANCIAL_*` variable must be set to the exact string `1`. Unset, empty, or malformed values remain disabled. The sample environment sets all financial flags to `0`, and deployment preflight requires all four to be explicitly `0`.

The existing administrative manual-deposit path calls `admin_manual_deposit_atomic` only behind the complete financial cutover gate. It fails closed without crediting funds when the gate is not approved. The current SQL and API contract has not yet been applied to a live staging database as part of this source archive review; do not enable production financial flags until the RPC signatures, migration order, data reconciliation, and end-to-end tests are verified.

The current user-facing deposit route returns deposit address details but does not create a pending user deposit order. A separate pending-order workflow and its approval RPC contract must be completed and tested before claiming that user-requested manual deposit approval is implemented.

## Local checks

- `npm test`
- `npm run build`

A passing source-level test suite is not a substitute for a live Supabase staging drill or Vercel Preview end-to-end validation.
