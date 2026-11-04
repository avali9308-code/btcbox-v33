# 3号 Business Team — Matching API / PostgreSQL SQL Contract Review

Date: 2026-11-02  
Branch: `feature/ai3-business`  
Review type: read-only source inspection; no live database execution  
Reviewed files:
- `api/core.js` (blob `d69cb9f65412f6ff5a949d03b21e7d0d3bc71ba0`)
- `supabase/sql/financial_matching_engine_v1.sql` (blob `600db3c518bc89e8b1878b3bcb4639a44a492cfe`)
- `assets/js/app-core.js` (blob `325aa5334d8863c90edf23a0e0506d682d396994`)

## Scope

Reviewed the limit-order API boundary, matching RPC arguments/results, PostgreSQL pair-rule schema, order reservation, price-time matching loop, four-leg ledger writes, cancellation/refund path, and current release constraints. This is not a PostgreSQL correctness certification.

## Source-observed controls

1. `POST /api/order` requires an authenticated, non-frozen user, supported pair, buy/sell side, limit order type, positive finite price/quantity and a 16–100 character client idempotency key. Market orders are rejected.
2. API calls the service-side `submit_limit_order_matching_v1` RPC only when the matching gate is enabled. RPC failure is returned as an unconfirmed 503; the response tells the client to check order history before retrying.
3. SQL owns pair enablement, tick/step, minimum quantity/notional and absolute limit-price bounds. It serializes matching by pair using a transaction-scoped advisory lock, reserves funds before matching, excludes self-trading, applies maker-price execution, and records buyer/seller ledger rows inside the transaction.
4. Cancellation locks the market/order/account path and releases remaining reserved funds through the ledger.
5. Matching market rows default to `enabled=false`; maker/taker fee rates are constrained to exactly zero. These are deliberate safety restrictions, not evidence that fee-bearing production trading is ready.

## Findings

### BUS-MATCH-003 — P1 — Matching markets require explicit operator provisioning

**Evidence:** `financial_matching_markets.enabled` defaults to `false`. The reviewed migration creates the table and constraints but contains no seed/upsert statements for enabled trading pairs. The matching RPC selects only a row matching the pair with `enabled=true`; otherwise it raises `market disabled or unconfigured`.

**Impact:** Applying this migration alone does not make any pair tradable. Orders should fail closed until an operator-approved per-pair configuration is inserted and independently verified. This is safe by default, but deployment readiness must not mistake a successful migration for a configured market.

**Required action:** Before staging order tests, prepare an owner-approved market configuration matrix covering enabled state, price tick, quantity step, minimum quantity, minimum notional and min/max limit-price bounds for each intended pair. Validate the values against the exchange's product rules. Do not invent or seed values from frontend display precision.

**Status:** OPEN / BLOCKER for staging order acceptance. No configuration was written.

### BUS-MATCH-004 — P0 — Fee-bearing execution is not implemented in this SQL contract

**Evidence:** The market schema has maker/taker fee columns with CHECK constraints requiring both values to equal zero. The reviewed fill path transfers base/quote amounts and records four ledger rows, but no fee debit/credit legs are present in the function.

**Impact:** This implementation explicitly supports zero-fee fills only. It cannot be treated as ready for a non-zero fee schedule. Enabling fee-bearing real orders without atomic fee accounting would make settlement and ledger balances incorrect.

**Required action:** Owner/product must approve the fee schedule and accounting destination. Then implement fee calculation, rounding, debit/credit ledger legs, maker/taker attribution, idempotency and reconciliation in a separately reviewed migration/RPC. Until then, keep funded matching disabled or explicitly restrict staging to zero-fee test cases with non-production funds.

**Status:** OPEN / BLOCKER. No fee logic or database constraint was changed.

## Review limitations / not run

- No isolated PostgreSQL instance was available or used in this review.
- Migration was not executed; no schema state or seed data was queried.
- No submit/cancel RPC was called.
- No continuous fills, partial fills, concurrent orders, duplicate requests, cancellation races, rollback failures, or buyer/seller ledger reconciliation tests were run.
- No build, automated test suite, browser test, Preview write, production request, deployment, or main merge was performed.
- No application, API, SQL, database, environment, authentication or financial source was modified.

## Required next gate

1. Resolve BUS-ENV-001 and BUS-ENV-002 owner decisions from the prior report.
2. Provision a disposable isolated PostgreSQL staging database and execute migrations in documented order.
3. Owner approves the per-pair rule matrix and fee policy.
4. Run the complete matching/ledger concurrency and rollback matrix; preserve SQL logs, test data setup, assertions and reconciliation output.
5. Only after independent review and explicit owner approval may a separate financial cutover decision be considered. Unit tests or a successful migration alone are not sufficient.

**Conclusion:** The source contains meaningful fail-closed controls and a transactional matching design, but source inspection cannot establish PostgreSQL runtime correctness. The default-disabled market table and zero-fee-only schema are explicit readiness gates. Real funded trading must remain disabled.


## Additional finding — BUS-MATCH-005 (P1): API numeric conversion can lose decimal precision

**Evidence:** In `api/core.js`, `POST /api/order` uses `Number(body.qty)` and `Number(body.price)`, then sends `String(qty)` and `String(price)` to the matching RPC. The SQL schema stores these values as `numeric(38,18)` and validates price tick / quantity step against those exact decimal values.

**Impact:** JavaScript binary floating-point cannot exactly represent every decimal value supported by the database type. High-precision user input can be rounded before SQL receives it. Depending on the market tick/step, this may cause a valid order to be rejected or change the numeric value being validated.

**Recommendation:** Keep request decimals as validated strings through the API boundary and pass them unchanged to PostgreSQL numeric parameters. If arithmetic is required in the API, use a decimal-safe implementation with explicit scale/range limits. Add regression cases for 18 fractional digits, significant-digit boundaries, values immediately below/at/above tick and step, and rejection of exponent/ambiguous formats.

**Status:** OPEN / NEEDS FIX. Source-level finding only; no order was submitted and no database was mutated.
