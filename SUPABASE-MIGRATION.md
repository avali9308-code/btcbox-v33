# BTCBOX Supabase migration plan (Progress 44)

## Current status

- Supabase project `btcbox` was found in the connected account, but its status is **INACTIVE**.
- No restore/unpause, schema change, data read, data write, or production migration was executed in this round.
- The app now has an opt-in server-side Supabase state adapter. It activates only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) are set in the Netlify function environment. The key must never be placed in frontend HTML/JS or a `NEXT_PUBLIC_*` variable.
- If the Supabase table is empty or missing, the adapter fails closed rather than silently initializing an empty exchange state.
- The SQL migration creates a single state row and an optimistic compare-and-swap (CAS) write function. CAS prevents stale writes from overwriting a newer revision, but conflicts are rejected rather than transparently retried. It is an interim bridge for the current JSON-state architecture, not the final normalized ledger architecture.

## Required safe migration order

1. Confirm the exact Supabase project and authorize restoring it if it remains paused/inactive; restoration may resume billable resources.
2. Export the complete Netlify Blobs `btcbox_data_v1` state from the correct production site using an authorized environment. Preserve a read-only original and record export timestamp, byte count, and SHA-256.
3. Create an independent backup and verify it can be parsed. Do not print secrets, password hashes, session tokens, or customer data in logs.
4. Apply `supabase/sql/btcbox_state_cas.sql` to the intended project only after reviewing the target project ref. The SQL file does not import the Blobs data.
5. Import the exact JSON state into `public.btcbox_state` as `id='main', revision=1`. Verify user count, aggregate balance fields, deposit/withdrawal counts, earn records, sessions policy, and audit history against the source export. Never paste customer data into chat.
6. Run the CAS smoke test in a non-production branch or test project: revision 1 write succeeds and increments to 2; a stale expected revision 1 then returns false and leaves revision/data unchanged.
7. Configure the two Netlify environment variables only after import and validation. Deploy to a staging/preview URL first and test read-only routes before money-mutating routes.
8. Run double-submit and concurrent-request tests for withdraw, earn subscribe/redeem, admin approve/reject, freeze/unfreeze. Any CAS conflict must return a failure and must not show success or mutate the source row.
9. Reconcile balances and records after tests, then obtain explicit release approval. Keep the original Blobs data read-only until rollback is proven.

## Important architectural limitation

The current backend reads a full JSON object, mutates it in JavaScript, and attempts a revision-checked write. CAS prevents lost updates, but a conflicting request may fail and the current handlers do not have a generic transaction retry loop. For real-money production, the recommended end state is normalized Postgres tables for users, balances, ledger entries, deposits, withdrawals, earn positions, idempotency keys, and audit records, with each financial operation performed in a single Postgres transaction or carefully reviewed RPC. Do not enable real deposits/withdrawals on the basis of this adapter alone.

## Netlify environment variables

- `SUPABASE_URL`: project API URL.
- `SUPABASE_SERVICE_ROLE_KEY` (preferred name here for compatibility): backend-only service role key. Never expose it in client assets, logs, commits, or screenshots.

The `SUPABASE_SECRET_KEY` fallback is supported for server-side deployments where the project uses the newer secret key format. Do not set both unless there is a deliberate reason.

## Normalized financial ledger staging migrations (Rounds 47–72)

For a **new, isolated staging project only**, apply the base migrations in this order:

1. `supabase/sql/financial_ledger_v1.sql`
2. `supabase/sql/financial_lifecycle_v2.sql`
3. `supabase/sql/financial_spot_trade_v3.sql`
4. `supabase/sql/financial_earn_redemption_idempotency_v4.sql`
5. `supabase/sql/financial_earn_policy_v5.sql`

Round 72 migration intentionally fails if existing earn positions have unknown products, product/asset mismatches, or subscription request hashes that cannot be recovered. Resolve and document those records before migration; do not remove the checks. It replaces the old payout-accepting earn redemption RPC with a four-argument RPC whose payout is calculated in PostgreSQL from the saved product policy snapshot.

Do not apply these to a production project until its project reference, backup, restore test, import plan and explicit release approval have been verified. The current HTTP handlers are still backed by JSON state; these normalized financial tables and RPCs are not yet the live balance authority. The spot RPC records a caller-validated fill and does not implement matching or establish a trusted market price. Local source tests are not a substitute for executing the migrations against PostgreSQL and testing concurrency/rollback in staging.
