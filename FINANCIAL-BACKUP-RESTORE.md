# BTCBOX financial backup and restore gate

This is an operational checklist, not an automated production backup. Do not run it against live data without an approved maintenance window and an operator-controlled destination.

## Before migration
1. Stop writes or use a storage-provider-supported consistent snapshot. A normal file copy while the application writes may not represent one consistent state.
2. Copy the state file and any referenced uploads to a restricted backup location. Encrypt at rest and in transit; do not commit exports or secrets to Git or send them in project ZIPs.
3. Calculate SHA-256 for the source backup and store the checksum separately from the backup.
4. Run the read-only preflight:
   ```sh
   python scripts/financial_migration_preflight.py --input /secure/backup/data.json --output /secure/backup/preflight-manifest.json
   ```
5. Treat any non-zero exit as a stop condition. Even a successful preflight is not migration approval; reconcile the manifest with an independent operator report.

## Restore drill
1. Restore the backup into a clean isolated directory or staging environment, never over the only source copy.
2. Verify the restored file's SHA-256 against the recorded checksum.
3. Run the preflight on the restored copy and compare source hash, account counts, per-asset available/frozen totals, pending withdrawals/deposits, and record status counts.
4. For a PostgreSQL staging import, run `supabase/sql/financial_migration_reconciliation_v4.sql`; investigate every mismatch and every operation missing a ledger row.
5. Preserve the source backup and the last known-good deployment until rollback is explicitly approved.

## Cutover stop conditions
- Any balance mismatch, unexplained pending request, duplicate/missing record ID, unknown asset, negative amount, missing ledger operation, or checksum mismatch.
- A handler still writes financial balances to JSON while another reads/writes PostgreSQL.
- No tested idempotent retry path for network timeout/unknown commit outcomes.
- No tested restore to a clean environment or no named operator approval.

The preflight script intentionally does not import data, contact Supabase, or decide whether a financial record is legitimate.

## Offline staging export bundle (round 52)

`scripts/financial_migration_bundle.py` exports a minimized, deterministic set of JSONL files from a **verified backup copy** of `data.json`. It never contacts Supabase and never imports or changes balances. The output includes sensitive financial data (notably withdrawal destinations), so use encrypted storage and a restricted directory; output files are created with owner-only permissions where supported. Do not include the generated bundle in a source-code ZIP or commit it to version control.

1. Create a consistent backup while writes are paused, store its SHA-256 separately, and verify the backup can be read.
2. Run the export against that backup, not the live file. Example:

   `python scripts/financial_migration_bundle.py --input /secure/backup/data.json --output-dir /secure/financial-bundle --expected-sha256 <independently-recorded-sha256> --confirm-export`

3. Keep the `manifest.json` with the migration evidence. Verify record counts and account totals independently before any staging import.
4. This bundle is **not an import script**. Legacy statuses/timestamps need reviewed mapping, account snapshots need balanced opening-ledger operations, and every import must be idempotent and reconciled. Simulated legacy orders are not proof of real executions.
5. Never import directly into production from this bundle. Test duplicate/retry behavior, rollback, balance reconciliation, and restore in a dedicated staging database first.

## Offline opening-ledger SQL generation (round 53)

`scripts/generate_financial_opening_sql.py` reads a round-52+ bundle and creates a reviewable SQL transaction for **account opening snapshots only**. It verifies the account JSONL SHA-256 and row count against the manifest, rejects duplicate user/asset pairs, rejects negative/out-of-range amounts and amounts with more than 18 meaningful decimal places, escapes SQL text literals, and refuses to overwrite an existing output SQL file. The SQL uses deterministic idempotency keys, creates one `migration_opening_balance` operation and one opening ledger row per account/asset, and raises an error if a pre-existing account or ledger row conflicts with the snapshot.

Example (first create a new private output path):

```sh
python scripts/generate_financial_opening_sql.py \
  --bundle-dir /secure/financial-bundle \
  --output-sql /secure/financial-opening-staging.sql \
  --confirm-staging-only
```

Review the generated SQL and target project carefully. Execute only in a dedicated staging database after applying the schema in order: `financial_ledger_v1.sql` → `financial_lifecycle_v2.sql` → `financial_spot_trade_v3.sql`. For `psql`, use `-v ON_ERROR_STOP=1`. The SQL is one transaction, so a raised exception should abort the transaction; verify the transaction result explicitly.

This is **not a full migration**: it does not import withdrawals, deposits, orders, earn positions, users/authentication, or audit history. Do not cut over after running it. Pending requests and all historical records need a separately reviewed mapping/import path, followed by independent totals and ledger reconciliation. No PostgreSQL parser or live database was available for this round, so generated SQL has not been executed against PostgreSQL.

## Round 54: stage legacy records without activating them

After creating a restricted export bundle with `scripts/financial_migration_bundle.py`, create a SQL script locally:

```sh
python scripts/generate_financial_staging_sql.py \
  --bundle-dir /secure/migration/bundle \
  --output-sql /secure/migration/staging-import.sql \
  --confirm-staging-only
```

First apply `supabase/sql/financial_migration_staging_v5.sql` to a dedicated staging database, then review the generated SQL and execute it only there. The import writes to `financial_legacy_migration_records`, a quarantine table, and does not update `financial_accounts`, operational deposits/withdrawals, orders, earn positions, or ledger entries. It preserves legacy status as a source label, not a verified operational state. The JSONL bundle and generated SQL may contain sensitive financial data; store them encrypted with restricted permissions and never add them to a release ZIP or source control.

## Round 55: pre-import and staging reconciliation

Generate a PII-minimized report from a checksum-verified offline bundle before producing or executing staging SQL:

```sh
python scripts/financial_migration_reconciliation.py \
  --bundle-dir /secure/migration/bundle \
  --output /secure/migration/pre-import-reconciliation.json \
  --confirm-offline
```

A nonzero exit status or any `blocking_findings` means stop; do not generate an import approval from the report. The report omits user IDs, destinations, transaction IDs and credentials, but the input bundle and SQL remain sensitive. After a staging-only import, run `supabase/sql/financial_migration_staging_reconciliation_v6.sql` and compare collection counts, status distributions, per-asset account totals and amount totals against the offline report and manifest. Historical totals are not account balances and are not proof of settlement. Investigate every mismatch; do not auto-adjust balances or promote legacy statuses.
