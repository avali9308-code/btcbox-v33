# BTCBOX Round 99 — Withdrawal lifecycle RPC wiring (staging-only)

## Implemented
- `POST /api/withdraw` now has an opt-in `create_withdrawal_atomic` branch when `FINANCIAL_POSTGRES_RPC_ENABLED=1`.
- In that branch, the normalized PostgreSQL ledger is authoritative for available funds; the request is created and principal + fee are frozen within one database transaction.
- Admin approve/reject routes call `review_withdrawal_atomic`; status transitions, ledger movement, and audit logging occur in the database transaction.
- RPC/configuration failures fail closed and do not fall back to the legacy state document.
- Review endpoints reject attempts that conflict with an already-terminal status instead of reporting the wrong action as successful.
- Added source-level regression tests for all three RPC branches.

## Critical cutover limits
- **Do not enable `FINANCIAL_POSTGRES_RPC_ENABLED` in production yet.** Customer profile/balance reads and the admin pending-withdrawal list still read the legacy `btcbox_state` snapshot. Enabling only these write paths would split the source of truth and could show stale balances or hide new withdrawal records.
- Before any production cutover, migrate those reads and all other financial writes, verify that `uid` exactly matches the financial ledger `user_id`, import/reconcile opening balances and pending withdrawals, apply the SQL migrations in staging, and run real PostgreSQL concurrency/idempotency tests.
- The SQL migration is not applied to any live project by this change. No deployment or live DB test was performed.
