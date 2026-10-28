# BTCBOX Financial Funds-Path Audit — Round 56

## Scope and safety decision

This is a source-level audit of the current `server.py`, not a claim that a PostgreSQL migration has run. The current application still uses `users` in process memory and persists state through `save_data()` to `data.json`. The Supabase RPC client and SQL files are not the active balance authority in this server build.

**Decision: production database mode remains blocked.** `financial_storage_guard.py` is now called at the beginning of `main()`. The only supported mode is `FINANCIAL_STORAGE_MODE=legacy_json`. Setting `postgres`, `supabase`, or any other value stops startup before `load_data()` and before market-fetch threads start. This is a safety barrier, not the final migration.

## Critical funds paths observed in source

| Path | Current behavior | Risk / required target |
|---|---|---|
| `do_order()` | Mutates quote/base balances, creates `status=filled` order with `source=simulated`, then `save_data()` | Keep explicitly simulated; future DB transaction must atomically update both assets, order and ledger; validate side/symbol/price/quantity server-side. |
| `do_withdraw()` | Debits available balance and increases frozen balance; creates pending withdrawal; `save_data()` | DB transaction must atomically freeze funds and create request; add request idempotency and robust amount precision. |
| `admin_review_withdraw()` | On approval releases frozen amount; on rejection releases frozen and restores available balance; `save_data()` | Must enforce state transition once, use stable withdrawal identity, prevent duplicate approval/rejection and reconcile fee treatment. |
| `do_deposit()` | Creates a pending record; amount <= 0 is address-display behavior; `save_data()` | Address generation is not proof of payment. Confirmed credit must require verified deposit evidence or a controlled/manual audited process. |
| `admin_confirm_deposit()` | Changes pending to completed and increases balance in same JSON state save | Needs unique external transaction/event identity, idempotency, confirmation policy, and atomic ledger posting. |
| `/api/earn` subscribe | Debits USDT, creates active position, `save_data()` | DB transaction must atomically debit and create position; validate product and precision. |
| `/api/earn` redeem | Marks active position redeemed and credits principal/payout, `save_data()` | DB transaction must atomically mark redeemed and credit once; interest/payout policy requires explicit approval and audit. |
| Other admin balance/config paths | Several handler paths mutate users/config and call `save_data()` | Complete audit must include every balance adjustment, bonus/referral, administrative action, and any future path that changes balances. |

## Cross-cutting findings

1. `save_data()` writes a temporary file and replaces `data.json`, but this is not a database transaction and does not provide safe multi-process concurrency.
2. A process-level `data_lock` does not coordinate separate application instances.
3. Financial amounts are predominantly Python `float`; production ledger work should use fixed-precision database numeric values and validated decimal strings.
4. There is no consistent idempotency key on all balance-changing operations.
5. `do_deposit()` itself does not verify chain events; the current “admin confirm” is a balance-changing action, not a blockchain verification mechanism.
6. Historical order rows with `source=simulated` must never be treated as externally verified exchange executions.
7. A partial DB rollout is unsafe while any balance read/write continues to use JSON. Do not turn on the new RPC client for only selected routes.

## Required sequence before cutover

- Inventory every balance writer and reader, including less-visible admin/referral/bonus endpoints.
- Finalize DB schema, permissions, immutable ledger invariants, and per-operation idempotency.
- Import a verified backup into a separate staging project; preserve pending states and source identifiers.
- Reconcile opening balances against the new ledger, and separately reconcile pending withdrawals, deposits, earn positions and simulated orders.
- Run concurrency, duplicate-request, timeout/unknown-outcome, rollback, and restore drills on staging.
- Freeze writes during final snapshot; independently verify checksums and totals; obtain explicit release approval.
- Deploy one authoritative storage mode only. Keep rollback procedures that do not merge divergent JSON and DB balances.

## Tests

`tests/test_financial_storage_guard.py` verifies the fail-closed mode policy and that startup validates the mode before loading JSON or starting market-fetch threads. These are unit/source-structure tests; they do not substitute for staging database tests.
