# 3号 Business Team — account read-path audit (2026-11-02)

- Branch: `feature/ai3-business`
- Scope: authenticated account snapshot, normalized deposit history, and balance serialization.
- Method: read-only source inspection; no API request, database query, write, build, or deployment.

## BUS-LEDGER-006 — normalized deposits are omitted from the account snapshot (P1)

- Evidence:
  - `api/core.js` `GET /api/account` (around lines 909–940) switches to `readFinancialAccountSnapshot(user.uid)` when normalized PostgreSQL reads are enabled.
  - In that response, `withdrawals` and `earn_records` come from the normalized snapshot, but `deposits` always comes from `user.deposits.slice(-20)` (legacy `btcbox_state` JSON).
  - `supabase/sql/financial_read_api_earn_v1.sql` defines `read_financial_account_snapshot_v1` returning only `balances`, `withdrawals`, and `earn_records`; it does not return deposits.
  - `supabase/sql/financial_deposit_chain_verification_v3.sql` credits confirmed deposits through `deposit_records` and the normalized financial operation/ledger path.
- Expected: once normalized financial reads are selected, deposit history must be read from the same normalized source of truth, with stable status/amount/network/txid fields and bounded pagination.
- Actual: the account response mixes normalized balances/withdrawals/earn holdings with legacy JSON deposit history. A deposit credited through the normalized chain-verification flow is not guaranteed to appear in `user.deposits`, so the account UI can omit confirmed deposits or show stale legacy entries.
- User impact: deposit history can disagree with the normalized ledger and users may not see a deposit that was credited. This is a read-path consistency finding; no user record was queried.
- Recommendation: add an owner-reviewed normalized deposit-history read RPC and switch the account response atomically with the full read cutover; define pagination and status mapping. Do not restore legacy writes or infer deposit rows from balances.
- Status: OPEN / NEEDS FIX. Source-confirmed path mismatch; runtime reproduction not performed.

## BUS-LEDGER-007 — normalized balance decimals pass through JavaScript Number (P1)

- Evidence:
  - `supabase/sql/financial_read_api_earn_v1.sql` builds `balances.free` and `balances.frozen` from PostgreSQL numeric account columns as JSON numeric values.
  - `api/core.js` parses the RPC body with `response.json()`, then `GET /api/account` performs JavaScript arithmetic on `b.free` and `b.frozen` for valuation and returns those values in the JSON response.
  - The matching/financial schema uses high-precision PostgreSQL `numeric(38,18)` values; JavaScript binary `Number` cannot exactly represent all such decimal values.
- Expected: financial quantities remain exact decimal strings (or are handled by a decimal-safe representation) from PostgreSQL response through API serialization; valuation is separate and explicitly approximate.
- Actual: JSON numeric values are parsed into JavaScript `Number`; high-precision fractional digits can be rounded before the API response and during total/valuation arithmetic.
- User impact: displayed free/frozen balances or derived totals can differ in the last decimal places from the ledger. This is a source-level precision risk, not evidence of a ledger mutation or a reproduced balance discrepancy.
- Recommendation: define a decimal-string API contract for free/frozen/amount fields and use a decimal-safe library or exact decimal-string operations for valuation. Add round-trip tests for 18 fractional digits, large values, and values around display precision boundaries.
- Status: OPEN / NEEDS FIX. No account API call or database mutation was performed.

## Scope and safety

- Application/API/SQL/database/auth/financial source changed: NO.
- Database migrations/RPCs executed: NO.
- Live account/deposit/withdrawal data accessed: NO.
- Build/tests/browser QA/deployment/main merge: NOT RUN / NOT PERFORMED.
- Existing financial cutover gates remain in force; these findings do not authorize enabling deposits, withdrawals, or trading.
