# Round 118 — Spot matching-engine rebuild contract

## Clarification: settlement is not matching

`supabase/sql/financial_spot_trade_v3.sql` implements `execute_spot_trade_atomic`. It records one already-determined fill and applies the two asset balance movements atomically. It does not maintain an open order book, find counterparties, enforce price-time priority, handle partial fills, reserve funds for resting orders, or produce maker/taker trade records. The function must not be used as if it were a matching engine.

## Rebuild target

Build the matching engine as a durable PostgreSQL-backed service (not process memory in a serverless function). A later implementation must include:

1. `open`/`partially_filled`/`filled`/`cancelled` order states and immutable trade rows.
2. Pair validation and decimal/tick/lot rules from server-owned market configuration.
3. Price-time priority: best price first, then oldest accepted order; market orders must have an explicit slippage/price-protection policy.
4. Atomic reservation when a limit order is accepted. Buy orders reserve quote funds; sell orders reserve base funds. Cancellation releases only the remaining reservation.
5. A database transaction that locks the pair/order book deterministically, matches opposing orders, writes each trade once, updates both users' accounts and ledger entries, updates remaining quantities, and commits as one unit.
6. Idempotency keyed to user + client order id; reusing a key with a different payload must return a conflict.
7. Authenticated API calls only. The browser must never choose a fill price or tell the settlement function that a trade occurred.
8. Audit events, bounded matching work per transaction, concurrency/deadlock tests, and reconciliation queries.

## Cutover rule

The current `POST /api/order` intentionally returns `503 MATCHING_ENGINE_UNAVAILABLE`. Keep this behavior until the complete engine and its adapter exist and pass staging tests. Do not restore the old simulated order path and do not call `execute_spot_trade_atomic` directly from an ordinary order request. That would turn user-supplied values into purported fills.

## Staging acceptance tests required before enabling

- two crossing limit orders match at the defined maker price;
- non-crossing orders remain open and reserve the correct amount;
- partial fill leaves correct remaining quantity and reservation;
- cancellation releases only the unfilled reservation;
- two concurrent takers cannot consume the same resting quantity;
- duplicate client order id returns the same order and creates no second ledger movement;
- invalid price/quantity precision and unsupported symbols are rejected;
- insufficient funds creates no order/trade/ledger side effects;
- a forced exception rolls back every account, order, trade and ledger change;
- every trade reconciles to equal-and-opposite asset movements, including configured fees.

## Current round status

This round documents the rebuild boundary and adds regression checks only. No matching engine is implemented or enabled by this document. The existing unit/static test suite does not substitute for a live PostgreSQL staging run.
