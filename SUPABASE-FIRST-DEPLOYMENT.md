# BTCBOX — first deployment sequence for the supplied Supabase project

This file is the single operator sequence for the first code upload. The supplied dashboard screenshot identifies project reference `zlozsutefnmgwwzrlipt` in `us-east-1`. The conventional project URL is written in `.env.example`, but verify it against Project Settings → API before configuring anything.

## Current state and safe order

The user has not uploaded/deployed BTCBOX code yet. A query showed Supabase's built-in `auth` tables and no `public` business tables. That is expected before the application's migrations are installed; it is not evidence that the Supabase project is broken. Do not run financial migrations against production before a separate staging project and acceptance plan exist.

1. Upload the final source ZIP contents to the GitHub repository. Do not upload `.env`, credentials, `data.json`, `actions.log`, `uploads/`, `node_modules/`, or Python cache files.
2. Deploy the repository to Netlify using the checked-in `netlify.toml`. Confirm build and function deployment before setting privileged credentials.
3. In Supabase, verify the project URL and create a separate staging project for database mutations. Do not use production as a test database.
4. Configure only the required server-side environment variables in Netlify. Never expose service-role/secret keys to browser code or public build variables. Public Auth keys are not a replacement for server-side authorization.
5. Apply the operational schema files one at a time in the order in `supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md` to staging only. Stop on the first SQL error. Do not run quarantine/import files as ordinary migrations.
6. Run static audit and live RPC/grant/RLS checks; execute each actual business RPC against test data; test duplicate/concurrent requests, insufficient funds, rollback and ledger reconciliation; rehearse backup/restore to a separate target.
7. Only after reviewed staging evidence and backup, plan production migrations and cutover. The four `FINANCIAL_*` flags must remain unset until every gate is accepted. Never turn flags on simply to make an API route pass.
8. After production deploy, verify auth redirect URLs, email/OAuth callbacks, market provider reachability, real deposit address per network, and end-to-end user/admin flows. Empty deposit addresses are intentionally unavailable until correctly configured.

## Netlify environment variable names

Required when enabling the relevant adapter: `SUPABASE_URL`; one server-only key (`SUPABASE_SERVICE_ROLE_KEY` or supported `SUPABASE_SECRET_KEY`); `SUPABASE_AUTH_URL`; one public auth key (`SUPABASE_AUTH_PUBLISHABLE_KEY` or `SUPABASE_AUTH_ANON_KEY`). Admin variables are required only for the relevant active admin flow. Set secrets only in Netlify's server-side environment settings, not in GitHub files.

Do not set `FINANCIAL_POSTGRES_RPC_ENABLED`, `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED`, `FINANCIAL_POSTGRES_READS_ENABLED`, or `FINANCIAL_MATCHING_ENGINE_ENABLED` before staging acceptance. A source-level test pass does not establish live PostgreSQL correctness.
