# 3号 Business Team — normalized withdrawal lifecycle review (2026-11-02)

- Scope: PostgreSQL withdrawal creation, admin review, admin queue read.
- Sources: `supabase/sql/financial_lifecycle_v2.sql`, `supabase/sql/financial_admin_read_api_v1.sql`, `api/core.js` on `main`.
- Method: read-only source inspection. No SQL executed, no withdrawal request, no admin operation, no database read/write.

## BUS-WD-009 — approved withdrawals leave the pending queue without a broadcast/finalization path in the reviewed contract (P1)

- Evidence:
  - `create_withdrawal_atomic` creates `withdrawal_requests.status='pending'` after freezing amount + fee.
  - `review_withdrawal_atomic` changes pending to `approved` or `rejected`.
  - On approval, it calls `apply_financial_operation` with available delta 0 and frozen delta `-(amount+fee)`, then persists status `approved`.
  - `api/core.js` admin approval response explicitly says: “Withdrawal approved, frozen amount deducted; not yet broadcast to the chain.”
  - `read_admin_withdrawal_snapshot_v1` returns only rows where `status='pending'`, and maps txid to an empty string.
  - The reviewed SQL lifecycle exposes create/review RPCs only; no broadcast claim, txid persistence, broadcast failure/retry, chain confirmation, or terminal completion transition was found in these reviewed files.
- Expected: approval should move a withdrawal into a durable, visible `approved_pending_broadcast` state (or equivalent), preserving the amount as reserved until a trusted broadcaster claims it; then persist txid, broadcast result, confirmations and terminal status. Admin queue must include every nonterminal state.
- Actual: approval removes the full amount from frozen balance and sets `approved`; normalized admin queue selects only `pending`. The approved item therefore disappears from the pending queue, while the reviewed contract provides no subsequent broadcast/finalization path or txid persistence.
- User/operational impact: if this reviewed normalized lifecycle is enabled as-is, an approved withdrawal can become invisible to the pending admin queue after the reserved amount is removed from frozen balance, without source-evidenced on-chain dispatch or completion. This is a lifecycle/readiness gap; no live withdrawal was approved and no loss was reproduced.
- Recommendation: keep withdrawal cutover blocked until the owner approves and implements a complete broadcaster/outbox lifecycle. Do not release frozen funds at approval; reserve them until successful broadcast is recorded, and make retries idempotent around a durable broadcast job. Add pending→approved_pending_broadcast→broadcasting→broadcasted/confirmed and failed/retry/compensated states as appropriate; reconcile every state with ledger operations and admin/user history.
- Severity: P1 / BLOCKER for production withdrawal enablement.
- Status: OPEN. Source-confirmed gap within reviewed files; broader worker/third-party broadcaster infrastructure was not exhaustively searched and remains UNKNOWN.

## Relationship to BUS-WD-008

BUS-WD-008 concerns the user-facing handling of an unconfirmed create-withdrawal RPC result. BUS-WD-009 is a separate server-side lifecycle/queue gap after an admin approves a withdrawal. Both must be resolved before enabling production withdrawals.

## Safety / test boundary

- Application/API/SQL/database/auth/financial source changed: NO.
- SQL migration/RPC executed: NO.
- Withdrawal/admin API invoked: NO.
- Build/tests/browser QA: NOT RUN.
- No production request, deployment, or main merge performed.
