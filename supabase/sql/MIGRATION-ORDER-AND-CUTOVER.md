# BTCBOX Supabase SQL migration order and cutover rules

This is a human-reviewed execution plan for the checked-in SQL files. It is **not** an instruction to run every `.sql` file alphabetically. Several files are read-only reconciliation queries, and some files are quarantined-import tools rather than production schema migrations.

## Operational financial schema order (staging project only)

Apply one file at a time to a dedicated disposable Supabase staging project, inspect the result, and stop on any SQL error:

1. `financial_ledger_v1.sql` — base accounts, operations, ledger, withdrawal/deposit/earn tables and shared atomic movement RPC.
2. `financial_lifecycle_v2.sql` — withdrawal lifecycle, deposit confirmation, earn subscription/redemption baseline.
3. `financial_admin_adjustment_v1.sql` — audited adjustments and legacy deposit-reference constraints; review its preflight checks first.
4. `financial_earn_redemption_idempotency_v4.sql` — durable redemption request identity; requires lifecycle v2.
5. `financial_earn_policy_v5.sql` — server-calculated earn payout policy; intentionally replaces the older caller-payout redemption overload.
6. `financial_admin_manual_deposit_v1.sql` — audited manual deposit RPC; requires ledger and lifecycle. This is the intended deposit-credit path for the current manual-review business model.
7. `financial_spot_trade_v3.sql` — atomic spot settlement; requires ledger and lifecycle.
8. `financial_matching_engine_v1.sql` — durable matching tables and RPCs; requires ledger, lifecycle, and spot-trade schema.
9. `financial_read_api_v1.sql` — normalized user financial read RPC.
10. `financial_read_api_earn_v1.sql` — replacement read RPC including earn positions; apply after earn policy v5.
11. `financial_admin_read_api_v1.sql` — admin withdrawal snapshot read RPC.
12. `financial_admin_account_read_api_v1.sql` — admin account-balance read RPC.

`financial_deposit_chain_verification_v3.sql` is optional and out of the current manual-review migration path. Do not apply it unless the product later adopts a trusted automated chain-verification service. The `confirm_deposit_atomic` guard in lifecycle v2 is intentionally fail-closed; manual credits must use the separately audited `admin_manual_deposit_atomic` RPC.

After the schema sequence, run `financial_ledger_reconciliation_v1.sql` and review every returned finding. Do not enable any cutover flags merely because migrations execute without errors.

## Separate, conditional tracks

- `btcbox_state_cas.sql` is the compare-and-swap adapter for the legacy `btcbox_state` document. It is separate from the normalized financial ledger. It does not import existing Netlify Blobs data and must only be applied after a verified backup/export and project identity check.
- `financial_migration_staging_v5.sql` creates a quarantine area for legacy import evidence. It is not the operational ledger and must only be used in a dedicated staging project.
- `financial_migration_staging_reconciliation_v6.sql` and `financial_migration_reconciliation_v4.sql` are read-only reports. They are not migrations and should be run only after the corresponding staging import.

## Netlify server-side environment

Configure variables in Netlify Site configuration → Environment variables (server-side scope). Never place a service key in HTML, `assets/`, client-side JavaScript, or a `VITE_`/`NEXT_PUBLIC_` variable.

- `SUPABASE_URL`: project URL, used by the server-side REST/RPC adapter.
- `SUPABASE_SERVICE_ROLE_KEY` **or** the supported server-only `SUPABASE_SECRET_KEY`: privileged key for server-side RPC calls only. Prefer the current key type supported by the project; do not expose either to browsers.
- `SUPABASE_AUTH_URL`: Supabase Auth project URL used to verify bearer access tokens.
- `SUPABASE_AUTH_PUBLISHABLE_KEY` **or** `SUPABASE_AUTH_ANON_KEY`: public Auth key, safe for client auth; this is not an authorization substitute.
- `ADMIN_USER`: stable audit actor identifier required for administrator financial RPCs. It must be mapped to an actually authenticated/authorized administrator by the application layer; it is not a secret or a substitute for admin-session checks.
- `ADMIN_PASS`: legacy admin credential configuration, if the active admin login flow uses it; use a strong unique value and rotate it if exposed.

Keep all of these unset unless the corresponding environment is intentionally configured:

- `FINANCIAL_POSTGRES_RPC_ENABLED=1`
- `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=1`
- `FINANCIAL_POSTGRES_READS_ENABLED=1`
- `FINANCIAL_MATCHING_ENGINE_ENABLED=1`

These are feature gates, not proof that a migration, data import, identity mapping, reconciliation, or runtime test has passed. Do not enable them in production before all staging acceptance criteria are evidenced.

## Required acceptance evidence before production cutover

1. A disposable staging Supabase project is positively identified by expected database name and exact host.
2. All required RPC signatures exist exactly once in the intended schema and are executable by `service_role` only; `anon` and `authenticated` cannot execute them.
3. Every protected financial table exists, has RLS enabled, and grants no direct table privileges to browser roles.
4. Concurrent duplicate submissions create one operation and one ledger movement; reusing a key with a changed payload is rejected.
5. Insufficient funds and deliberate transaction rollback leave account, operation, and ledger state unchanged.
6. Withdrawal freeze/reject/approve, earn subscribe/redeem, admin adjustment, and spot settlement are tested against their actual business RPCs, not only the shared ledger primitive.
7. Historical balances and frozen balances reconcile per asset; unresolved differences block cutover.
8. Backup and restore has been rehearsed against a separate target.

The repository's offline static audit does not establish any live Supabase state. The staging drill requires a separately provisioned test database and explicit mutation acknowledgement.


## Seconds contracts (added in the current repair package)

Apply `financial_seconds_contracts_v1.sql` only after the base ledger, lifecycle, spot-trade, matching-engine, and other financial migrations have been applied and reviewed in an isolated staging project. Apply it last because it extends the shared `financial_operations.operation_type` constraint. This migration defines the three seconds-contract RPCs referenced by `netlify/functions/api.js`, stores positions in PostgreSQL, freezes stake atomically, and writes settlement deltas to the ledger. It does not include a real-money preset-outcome mechanism. Do not enable production financial writes until the migration is applied, reconciliation is clean, and concurrent/idempotency tests pass in staging.
