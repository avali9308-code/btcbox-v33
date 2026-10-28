# BTCBOX financial writer inventory — Round 96

## Scope and status

This inventory is based on static inspection of `netlify/functions/api.js` and the SQL migration files in this repository. It is not evidence that the SQL has been applied to Supabase or that production uses these paths. No live database credentials or production writes were used.

## Money-moving API paths

| Path / operation | Current implementation in this source tree | Round 95 safety status | Required completion work |
|---|---|---|---|
| `POST /api/withdraw` | Legacy `db`/Netlify Blobs balance and withdrawal-state mutation when cutover flag is off | Returns 503 before legacy mutation when `FINANCIAL_POSTGRES_RPC_ENABLED=1` (also accepts the existing helper's configured aliases) | Route through a PostgreSQL atomic withdrawal RPC; verify reservation, fee, idempotency, and lifecycle together |
| `POST /api/earn` subscribe/redeem | Legacy balance/frozen balance and earn-record writes when flag is off | Returns 503 before legacy mutation when cutover flag is on | Route both actions through PostgreSQL atomic RPCs and test duplicate/concurrent requests |
| `POST /api/admin/withdraw/approve` | Legacy withdrawal state and frozen-balance mutation when flag is off | Returns 503 before mutation when flag is on | Use one atomic lifecycle RPC with status transition, ledger entries and audit record |
| `POST /api/admin/withdraw/reject` | Legacy withdrawal state, frozen/free balance mutation when flag is off | Returns 503 before mutation when flag is on | Use one atomic lifecycle RPC with idempotent refund and audit record |
| `POST /api/admin/deposit/confirm` | Has a guarded PostgreSQL RPC path, with legacy behavior retained when cutover flag is off | Existing guard blocks incomplete RPC cutover; must verify RPC configuration and database migration before enabling | Complete migration preflight, duplicate reconciliation, and live staging tests |
| `POST /api/admin/user/balance` | Legacy available-balance adjustment and legacy audit log when flag is off | **Round 95 adds a 503 interlock before any mutation when cutover flag is on** | Connect to `admin_adjustment_atomic`; use an authenticated admin identity, idempotency key, request hash, reason, and DB audit trail |
| `POST /api/order` | No trusted matching engine; endpoint is fail-closed | Returns unavailable; no simulated fill or balance mutation | Build/test trusted matching engine and atomic spot-trade RPC integration before enabling |
| Chain deposit ingestion/confirmation | SQL migration bundle contains chain-verification and ledger RPC components; production wiring is not proven by static source tests | Do not assume live credits are transactionally wired | Trace webhook/indexer route, signature/confirmation policy, replay protection, and DB transaction end-to-end |

## Other relevant paths

- Balance reads and user portfolio displays must be traced separately. A successful PostgreSQL write is insufficient if the UI continues reading a stale legacy balance store.
- Freeze/unfreeze is an account control, not itself a balance transfer; confirm it is enforced by every financial RPC and session-sensitive route.
- Any legacy financial writer remains a risk while the cutover flag is off. The flag is a safety interlock, not a migration mechanism.
- SQL functions in `supabase/sql/` are source artifacts only until applied and verified in a staging database.

## Safe migration sequence

1. Create a staging Supabase project or use a disposable database; never test financial mutations on production balances.
2. Run migration preflight and reconciliation scripts. Resolve duplicate deposits, missing users, invalid assets, and balance/ledger discrepancies before applying migrations.
3. Apply migrations in documented dependency order and verify function signatures, grants, constraints, and RLS/role boundaries.
4. Wire each endpoint to its atomic RPC; require idempotency keys for retryable operations and derive admin identity from the verified server session, not request-body claims.
5. Add integration tests against a real disposable PostgreSQL instance for concurrent withdrawals, duplicate requests, transaction rollback, status transitions, and ledger reconciliation.
6. Migrate balance reads to the same PostgreSQL source of truth; do not dual-write two stores as peers.
7. Enable the cutover only after staging checks pass. Keep legacy writes blocked during the transition, compare read-only reconciliation results, and prepare a rollback that does not replay already-committed money movements.
8. Remove the interlocks only after every financial read/write path is migrated and independently verified.

## Verification boundary

Round 96 adds a static gate that inspects the primary Netlify API routes separately from the legacy Python server. Local tests validate source-level fail-closed behavior and repository contracts. They do not validate deployed Netlify environment variables, live Supabase schema state, production auth, actual PostgreSQL transaction behavior, or end-to-end UI behavior.


## Round 96 gate result

Run `python scripts/financial_cutover_gate.py` before any financial cutover. The report now includes `api_financial_route_audit` and separately tracks route guard coverage versus apparent RPC wiring. A guard means the old writer is blocked when the flag is on; it does **not** mean that the route has been migrated. The gate intentionally remains blocked until the legacy writers are retired and all required evidence is independently verified.

## Current status — Round 144

The historical writer inventory above records the earlier 12 source assignments. In Round 144, those Python JSON wallet mutation paths were retired and `scripts/audit_financial_writers.py` now reports zero direct balance/frozen-balance assignments in `server.py`. The old `BTCBOX_LEGACY_FINANCIAL_WRITES_ENABLED` switch was removed. This source-level result does not certify the Netlify/PostgreSQL financial API at runtime; the current cutover status is in `ROUND-144-FINANCIAL-CUTOVER-STATUS.json` and remains blocked pending staging and reconciliation evidence.


## Round 164 primary API remediation

Legacy direct balance/frozen-balance mutation branches have been removed from the Netlify withdrawal submission, admin balance adjustment, and withdrawal review routes. Withdrawal replay decisions now rely on the PostgreSQL RPC idempotency contract rather than the legacy state document. This is source-level verification only; deployed database execution remains unverified.
