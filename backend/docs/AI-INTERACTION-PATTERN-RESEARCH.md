# BTCBOX Interaction Pattern Research — mature systems first

Date: 2026-11-02
Owner: 2号 Interaction Team
Status: ACTIVE REFERENCE — patterns assessed; no third-party runtime dependency introduced.

## Decision summary

Use established security and interaction patterns as the default. Reuse BTCBOX's existing API adapter, modal/drawer primitives, state and page architecture where they are adequate. Do not add a library merely to reproduce a small behavior already supported by the project. Adopt external dependencies only after a documented license, maintenance, security, compatibility, accessibility, mobile, performance and overlap review.

## Primary references

### 1. OWASP Transaction Authorization Cheat Sheet
- Source: https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html
- License: OWASP Cheat Sheet Series content is published under CC BY-SA 4.0; attribute the source and preserve ShareAlike obligations when redistributing/adapting its text.
- Applicable patterns:
  - What You See Is What You Sign: show the user the material transaction details they are authorizing.
  - Transaction authorization is distinct from login authentication.
  - Sensitive transaction authorization must be server-enforced.
  - Each operation uses a unique, time-bounded authorization challenge.
  - A transaction's material data must not change between review and authorization.
- BTCBOX adaptation: withdrawal review must show asset, network, destination, recipient amount, fee and total debit; security confirmation applies to the same immutable payload; front-end success follows only an authoritative business result.
- Boundary: this is guidance, not an implementation library or a substitute for backend enforcement.

### 2. OWASP Business Logic Security Cheat Sheet
- Source: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html
- License: CC BY-SA 4.0.
- Applicable patterns:
  - Represent multi-step sensitive workflows as explicit state transitions.
  - Reject out-of-order or replayed terminal actions.
  - Use caller-scoped idempotency keys bound to the original request parameters.
  - Coordinate concurrent requests atomically and persist operation state/result.
  - Reconcile an unknown external outcome before resubmitting.
  - Log enough operation context to reconstruct financial actions without logging secrets.
- BTCBOX adaptation: the UI owns clear Loading / Pending / Unknown / Confirmed / Rejected states; 3号 owns durable idempotency, request-hash comparison, atomicity and status lookup. UI must never invent those guarantees.
- Boundary: server-side controls remain authoritative; client-side guards are usability protections only.

### 3. Stripe idempotency and payment error-recovery patterns
- Reference: https://docs.stripe.com/api/idempotent_requests
- Reference for testing error states: https://docs.stripe.com/automated-testing
- License / reuse: Stripe documentation is a product reference, not permission to copy Stripe SDK code or assets. No Stripe code or dependency is imported.
- Applicable patterns: use an opaque unique key per logical write; reuse the same key for a retry of the same immutable parameters; reject parameter mismatch; test decline, timeout, delayed and asynchronous outcomes.
- BTCBOX adaptation: follow the general idempotency design only after 3号 confirms the BTCBOX server contract and retention window. Do not assume Stripe's exact key retention or response semantics apply to BTCBOX.

## Pattern-to-module decisions

| BTCBOX module | Mature pattern to adapt | Primary owner | Adoption |
|---|---|---|---|
| Withdraw | WYSIWYS review, explicit state machine, single-flight UI, durable idempotency and status reconciliation | 2号 UI; 3号 server contract | Adopt; backend contract questions are issues |
| Deposit | Server-issued address, coin/network binding, required memo/tag, stale-response protection | 2号 UI; 3号 data | Adopt existing API; add request-race protection |
| Transfer | Immutable source/destination/amount review, single logical operation key, authoritative result | 2号 UI; 3号 business | Contract first |
| Earn subscribe/redeem | Explicit confirmation, duplicate-action guard, authoritative position/balance result | 2号 UI; 3号 business | Reuse existing modal and adapter |
| 2FA | Recoverable verification step, clear server rejection, success only on confirmed state | 2号 caller; 3号 adapter | Existing adapter needs correction |
| Support chat | Text-only rendering, single-flight send, persisted per-user history | 2号 UI; 3号 storage/API | Reuse current adapter |

## Dependency assessment

- No new npm package is required for the above interaction patterns at this stage.
- Existing BTCBOX modal/drawer primitives and DOM APIs cover the current scoped work; accessibility gaps are tracked separately.
- Avoid adding a state-machine framework for isolated page flows until a cross-page workflow or testability need justifies it.
- If a dependency is proposed later, record package/version, SPDX license, latest release/maintenance evidence, security advisories, browser/mobile support, accessibility, bundle impact, migration cost, and why existing project primitives are insufficient.

## Review checklist for every sensitive interaction

1. Does the user see and confirm the exact material transaction details?
2. Are review and authorization bound to the same immutable payload?
3. Is there one in-flight submit per logical action?
4. Is the request identifier stable for retries of the same payload?
5. Does the server atomically enforce idempotency and reject key reuse with different parameters?
6. Can the UI distinguish confirmed rejection, confirmed success, pending and unknown?
7. Is there a safe status lookup/reconciliation path before another write?
8. Are secrets excluded from browser persistence, logs and error messages?
9. Are keyboard, focus, Escape, mobile and assistive-technology paths usable?
10. Are failure, timeout, duplicate and race cases covered by tests?

## Current validation status

- Research and source inspection: completed for the listed patterns.
- External package/license scan: NOT APPLICABLE — no package adopted.
- Runtime/browser validation: NOT RUN.
- Backend idempotency/status contract: pending 3号 confirmation where noted in AI-ISSUE-LOG.md.
