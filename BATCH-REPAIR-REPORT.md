# BTCBOX Batch Repair Report

## Changes in this package

- Added `supabase/sql/financial_seconds_contracts_v1.sql`, defining the three missing seconds-contract RPCs, position storage, atomic USDT stake freezing, idempotent settlement, history reads, and service-role-only RPC grants.
- Updated the seconds settlement API to fetch the reference price on the server and send the selected symbol and feed metadata to the database RPC. The SQL checks ownership, maturity, symbol, price timestamp, and ledger invariants.
- Fixed the seconds UI so an unconfirmed settlement remains visible and retryable instead of silently disappearing from the active list.
- Added English translations for new seconds-contract API errors.
- Stabilized open-request hashing so a retry of the same request is not treated as a different request merely because the server sampled a slightly different market price.
- Added regression tests for the missing RPC contract and settlement retry behavior.

## Verification run

- `npm test`: 194/194 passed.
- `npm run build`: passed.
- `python -m pytest -q`: 230 passed, 61 subtests passed.

## Not claimed as complete

- The SQL migration has not been applied to the user's Supabase project and was not executed against a live PostgreSQL instance in this environment. Apply it last in isolated staging, then test SQL compilation, concurrent duplicate requests, balance freeze/release, win/loss/tie outcomes, and ledger reconciliation before considering production.
- No real browser or mobile-device end-to-end session was available here; visual and click-through acceptance is still pending.
- This package intentionally does not add a hidden preset-result mechanism for real-money contracts. Allowing an operator to predetermine customer outcomes would undermine fair settlement. Any deterministic outcome control must be isolated from real accounts and real funds, with separate sandbox data and explicit auditability.
- Production financial cutover remains fail-closed until the normalized PostgreSQL read/write migration is reviewed and approved. Do not bypass the gate just to make trading buttons submit.
