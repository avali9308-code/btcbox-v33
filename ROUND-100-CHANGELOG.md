# Round 100 — Financial full-cutover readiness gate

## Change
- Hardened `manualDepositRpcEnabled()` so `FINANCIAL_POSTGRES_RPC_ENABLED=1` alone is insufficient.
- A second explicit server-side variable, `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=1`, is required before any optional normalized-ledger RPC path can be enabled. It is intentionally not configured in repository files.
- Reason: user/admin balance and history reads are not migrated and still depend on `btcbox_state`; switching only writes would split the financial source of truth and produce stale reads.
- Added regression tests to prevent accidental removal of this guard.

## Important limitation
This is a deployment safety interlock, not a completed migration. Do not set the approval variable until normalized PostgreSQL reads, legacy-to-ledger reconciliation, identity mapping, admin/user history endpoints, and staging concurrency/idempotency tests have all passed. No production deploy or live database test was performed.
