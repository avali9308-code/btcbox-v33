# BTCBOX Financial Safety Remediation — Round 47

## Current baseline
- Source archive: `btcbox-v33-progress-46.zip` (preserved separately by the operator).
- Baseline tests: 43/43 pass in the local Node test runner.
- The existing API still uses whole-document JSON state. Netlify Blobs and the existing single-row CAS adapter are not the final transactional ledger.
- No live user data was supplied in this archive. No production storage, Supabase project, secrets, or live balances were accessed or changed.

## What this round adds
- `supabase/sql/financial_ledger_v1.sql`: normalized financial tables, unique idempotency keys, immutable-style ledger rows, balance non-negative constraints, RLS with no client-role table access, and a transaction-scoped RPC for single-user/single-asset balance deltas.
- `tests/financial-ledger-schema.test.js`: source-level checks for core schema safety invariants.
- The schema is additive and intentionally does not import legacy JSON data or switch the live API. The old adapter must not be treated as transaction-safe.

## Mandatory next integration work
1. Apply this SQL only to a new/staging Supabase project; review the target project ref first.
2. Replace each financial API handler with RPC-backed operations. Use deterministic request hashes and a stable idempotency key per user action. Never return success before the RPC commits.
3. Implement multi-step business transitions (withdrawal status + balance movement + audit row) in one database RPC/transaction; do not split these across HTTP calls.
4. Add authorization checks in the trusted server layer and verify admin actor identity. Do not grant browser clients access to service-role functions.
5. Add migration/import scripts only after source data export and checksum. Reconcile users, each asset's available/frozen totals, open withdrawals, deposits, earn positions, and audit counts before cutover.
6. Run real PostgreSQL concurrency tests (parallel duplicate idempotency key, different concurrent withdrawals, repeat approval/rejection, rollback injection), then restore a backup into a clean staging project and compare checksums/totals.

## Operational safety
- No live financial operations should be enabled while the JSON/Blobs handler remains authoritative.
- Keep original source archive and a separately exported data backup. No user records does not remove the need to preserve admin/configuration state and a known-good rollback artifact.
- The SQL primitive handles one user's one asset per call. Multi-asset or multi-account transfers must be implemented as a dedicated atomic RPC, not two separate calls.
- The RPC returns the current balance on duplicate requests; clients must not interpret that response as a fresh balance mutation.


## Round 48 — atomic lifecycle RPCs added (not yet connected to HTTP API)
- Added `supabase/sql/financial_lifecycle_v2.sql` with atomic withdrawal creation/review, deposit confirmation, earn subscription and redemption RPCs. Each function combines balance ledger mutation and business-state update in one PostgreSQL transaction.
- RPC execution is restricted to `service_role`; browser roles are revoked. Admin identity must be verified by the trusted server before calling review/confirmation RPCs.
- These functions are migration artifacts only until applied and integration-tested in a dedicated staging Supabase project. The existing Python HTTP API still uses JSON storage; do not enable real funds.

## Round 49 — server-side Supabase RPC transport
- Added `financial_db.py`, a standard-library HTTPS RPC client for the five lifecycle functions. It never falls back to JSON when configuration or transport fails and treats timeouts as unknown outcomes requiring the same idempotency key on retry.
- Added unit tests for configuration failure, HTTPS enforcement, request shape and unknown timeout outcome.
- Important: the existing `server.py` still performs trading and balances through `data.json`. Do **not** set this RPC client as the balance authority yet. Full integration requires migrating spot order debits/credits, account snapshots, deposit creation, all admin actions and earn history together; mixing PostgreSQL with local JSON would create two competing ledgers.
- No live Supabase project was contacted and no production data was modified in this round.

## Round 50 — atomic spot-trade ledger RPC (not yet connected to HTTP API)
- Added `supabase/sql/financial_spot_trade_v3.sql`. It creates `financial_spot_orders` and `execute_spot_trade_atomic(...)`, which records a filled spot order and both base/quote asset ledger deltas in one PostgreSQL transaction. It checks available funds, locks the two asset rows in deterministic order, binds the idempotency key to the full request, and limits execution to `service_role`.
- Added `SupabaseFinancialRPC.execute_spot_trade(...)` and tests for its HTTPS RPC payload; Node source tests check the migration's key safety properties.
- This RPC persists a caller-validated fill; it is **not** a matching engine or price oracle. The caller must validate the market price/limit rules and use a stable idempotency key generated before the first attempt.
- Migration order for a fresh staging database: `financial_ledger_v1.sql` → `financial_lifecycle_v2.sql` → `financial_spot_trade_v3.sql`. Review the exact project target before applying any SQL.
- Verification: Python compile passed; Python RPC unit tests 5/5 passed; Node tests 55/55 passed. These are local unit/source tests only; no live PostgreSQL parser, concurrency test, or Supabase RPC was available in this environment.
- `server.py` remains on legacy JSON state for spot trading, balances and financial lifecycle endpoints. Do not turn on only this RPC path. Full cutover still requires all balance readers/writers, deposits, admin actions, earn history, open-order handling, data import/reconciliation, backup/restore and real staging concurrency tests to move together.

## Round 51 — read-only migration preflight and reconciliation
- Added `scripts/financial_migration_preflight.py`. It reads a copied legacy JSON file only, computes a SHA-256 fingerprint, aggregate available/frozen balances per asset, record/status counts, and pending withdrawal/deposit counts. It does not import records and does not emit user emails, passwords, tokens, or individual account IDs.
- Added Python tests for aggregation, PII omission, invalid/negative amounts and malformed state shape.
- Added `supabase/sql/financial_migration_reconciliation_v4.sql` with read-only staging queries for account totals, pending lifecycle counts, operations missing ledger rows, and account-vs-latest-ledger mismatches.
- The manifest field `preflight_passed` means only that basic input checks passed. It is not an approval to cut over. Migration still requires explicit record mapping, opening-balance entries, status/history preservation, independent backup verification, staging import and human reconciliation.
- Suggested safe usage against a copied backup: `python scripts/financial_migration_preflight.py --input /secure/backup/data.json --output /secure/backup/preflight-manifest.json`. Store the source and manifest in restricted encrypted storage; never commit production exports to source control or include them in a project ZIP.
- Backup/restore gate: make a consistent copy of the source, record SHA-256 separately, encrypt and restrict access, test restore into a clean isolated environment, run the preflight on the restored copy, and compare its checksum/aggregate counts with the original manifest. Preserve a rollback copy until cutover reconciliation and sign-off complete.
- No production data was supplied or read, no database was contacted, and no import/cutover was performed in this round.


## Round 52 — deterministic offline staging export

Added `scripts/financial_migration_bundle.py` and unit tests. The exporter requires an independently recorded source SHA-256 and explicit `--confirm-export`, emits owner-restricted JSONL files for account snapshots and financial records, excludes credentials/profile/KYC fields, preserves legacy identifiers/status fields, and generates deterministic migration IDs. It does not connect to a database or mutate source data. The output contains sensitive financial records and must not be committed or included in release ZIPs. The export is not a database importer and does not resolve legacy status semantics or opening-ledger reconciliation.

## Round 53 — offline opening-ledger SQL generator (not executed)

- Added `scripts/generate_financial_opening_sql.py`. It validates the manifest and account snapshot checksum/count, checks exact decimal precision against PostgreSQL `numeric(38,18)`, rejects duplicate account/asset pairs and negative balances, SQL-escapes identifiers/values, and writes a new SQL file without overwriting an existing file.
- Generated SQL is a single transaction with deterministic idempotency keys, `migration_opening_balance` operation records and matching opening ledger entries. Existing conflicting account/ledger values cause an exception rather than silent overwrite. Added the operation type to the schema constraints in the fresh-install ledger schema and spot-trade migration.
- Added tests for generated transaction shape, idempotent conflict handling, tampered bundle checksum, manifest count mismatch, invalid numeric values and SQL literal safety.
- Scope is deliberately limited to account opening snapshots. It does not import withdrawals, deposits, order history, earn positions, authentication data or audit history; it is not cutover-ready. Pending records require explicit status mapping and business review.
- Local verification: Node tests 55/55; Python financial/migration tests 16/16; Python compile checks passed; ZIP integrity check required before release. No live database connection, PostgreSQL execution, concurrency test, import or production change occurred.

## Round 54 — legacy financial records staged in quarantine (SQL generated, not executed)
- Added `supabase/sql/financial_migration_staging_v5.sql`, a restricted staging-only quarantine table for checksum-tagged legacy account snapshots, withdrawals, deposits, orders and earn records. It is deliberately separate from operational tables.
- Added `scripts/generate_financial_staging_sql.py`. It verifies each JSONL SHA-256 and row count against the bundle manifest, validates record identity fields, canonicalizes payload JSON, hashes each payload, generates deterministic snapshot IDs, uses transaction/advisory locking and rejects same-key/different-payload replays.
- Generated SQL inserts into the quarantine table only. It does not map legacy statuses into live lifecycle statuses, does not touch operational balances or ledger rows, and does not call a database. This avoids treating historical labels such as `confirmed`, `filled`, or `active` as independently verified financial outcomes.
- Added unit tests for all record categories, checksum tampering, manifest count mismatches, idempotency guards and SQL literal escaping.
- Next gates: apply schema to an isolated staging project; generate/import using a verified export; compare collection/status counts and payload hashes; manually map states only after reviewing legacy server behavior; then implement audited promotion RPCs with explicit business-state and ledger invariants. No production change or database execution occurred.

## Round 55 — offline and staging reconciliation gates
- Added `scripts/financial_migration_reconciliation.py`, which verifies bundle checksums/counts and creates a PII-minimized offline report with account available/frozen totals, withdrawal/deposit amount totals, and status distributions. It never connects to a database and blocks negative balances, duplicate user/asset snapshots, and invalid amounts.
- Added `supabase/sql/financial_migration_staging_reconciliation_v6.sql`, read-only queries for staged row counts, legacy status distributions, asset totals, payload hash conflicts and duplicate account snapshots.
- The report deliberately excludes user IDs, withdrawal destinations, txids, and credentials. Historical amount totals are diagnostic totals only and must not be treated as payable amounts or ledger balances.
- These are offline/unit-tested tools and SQL source artifacts. The SQL has not been run against PostgreSQL/Supabase in this environment. No operational table was promoted and no production data was changed.
- Next gate: execute staging schema/import/reconciliation in a dedicated Supabase project, preserve the query outputs as migration evidence, manually resolve all differences, then test explicit promotion rules and full backup restore before any production cutover.
