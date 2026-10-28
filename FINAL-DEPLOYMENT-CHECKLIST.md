# BTCBOX — consolidated deployment and Supabase acceptance checklist

This checklist is intentionally consolidated so deployment steps do not need to be repeated piecemeal. Do not enable financial cutover flags until the staging acceptance evidence below is complete.

## A. Netlify configuration

Set these in Netlify Site configuration → Environment variables, server-side scope only:

- `SUPABASE_URL` — the intended Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` **or** supported server-only `SUPABASE_SECRET_KEY` — never expose in browser assets or public build variables.
- `SUPABASE_AUTH_URL` — Auth project URL used to verify bearer tokens.
- `SUPABASE_AUTH_PUBLISHABLE_KEY` or `SUPABASE_AUTH_ANON_KEY` — public auth key only; never use as a replacement for server-side authorization.
- `ADMIN_USER` — stable admin audit actor ID mapped to an authorized admin.
- `ADMIN_PASS` — only if required by the active legacy admin login; set a unique strong value and rotate if previously exposed.

Keep the following flags unset while staging is unverified:

- `FINANCIAL_POSTGRES_RPC_ENABLED`
- `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED`
- `FINANCIAL_POSTGRES_READS_ENABLED`
- `FINANCIAL_MATCHING_ENGINE_ENABLED`

## B. Staging database first

Use a disposable Supabase staging project, positively verify its project URL/database identity, and do not run migration or drill scripts against production. Apply one SQL file at a time in the order in `supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md`. Stop on any SQL error.

After schema migrations, run `financial_ledger_reconciliation_v1.sql` and resolve every finding. Read-only reconciliation scripts are not migrations. Quarantine/import scripts are separate and must not be applied as ordinary schema migrations.

## C. Runtime acceptance that must pass before cutover

- Verify all required RPC signatures and service-role-only execution grants in the live staging database.
- Verify RLS and direct table access denial for `anon` and `authenticated` roles.
- Exercise each actual business RPC: deposit confirmation, withdrawal creation/review, earn subscribe/redeem, admin balance adjustment/manual deposit, spot settlement, and order matching.
- Test concurrent duplicate requests, idempotency key reuse with changed payload, insufficient funds, forced rollback, negative balances, and duplicate chain transaction IDs.
- Reconcile free/frozen balances per asset and rehearse backup/restore to a separate target.
- Record logs/results and rerun `scripts/financial_cutover_gate.py`; a source-only/static pass is not sufficient.

## D. Production cutover

Only after all C checks pass and a reviewed backup exists, set the financial flags deliberately in a maintenance window. Enable and validate in this order: authoritative financial RPC writes, normalized financial reads, then matching engine. Test each route end-to-end after each change. If any balance/read/write mismatch or RPC error occurs, stop cutover and revert the flags; do not switch back to legacy balance writes as a silent fallback.

## E. Known external dependencies

- Coinbase is the primary USDT spot data source; Bybit fills missing data only. A symbol without a valid USDT pair must show unavailable rather than silently switching to USD or fabricating a price.
- Deposit addresses must be real addresses configured for the correct network. Empty or placeholder values intentionally fail closed; do not paste one network's address into another network.
- Verify Netlify production domain and Supabase Auth redirect allowlist/email templates for the actual domain before testing sign-in/OAuth.

## Current evidence boundary

Automated Node/Python tests and SQL static audits only validate repository behavior. They do not prove that a live Supabase project has the expected schema, that network providers are available from the production region, or that backup/restore and concurrency drills passed. Until those results are recorded, production financial cutover must remain blocked.
