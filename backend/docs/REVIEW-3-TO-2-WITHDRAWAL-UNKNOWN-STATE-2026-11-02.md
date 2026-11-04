# 3号 Business Team — 2号 withdrawal interaction peer finding (2026-11-02)

- Reviewer: 3号 Business Team
- Target: 2号 Interaction Team
- Target branch: `feature/ai2-interaction`
- Reviewed source: `assets/js/views-assets.js` in target branch; backend contract cross-checked against `main` `api/core.js`.
- Method: source-only peer review. No withdrawal API request, account lookup, database operation, or browser interaction.

## BUS-WD-008 — ambiguous withdrawal RPC result is presented as definite failure (P1)

- Evidence in target branch `assets/js/views-assets.js`:
  - `wdResultState(r)` immediately maps every `!r.ok` to `Submission Failed` and appends “Your balance was unchanged.”
  - The submit handler generates a fresh `request_id: uid()` for each submit attempt.
  - A failed result is shown with a “New Withdrawal” action that resets the form; a later submit generates a new idempotency key.
- Backend contract evidence in `main` `api/core.js`:
  - `POST /api/withdraw` returns HTTP 503 `FINANCIAL_RPC_FAILED` or `FINANCIAL_RPC_UNAVAILABLE` when the database outcome is unconfirmed, with explicit instruction to check operation history before retrying.
  - Only explicit pre-RPC/validation/cutover paths state that no withdrawal was submitted and balance was unchanged.
- Expected: distinguish definite rejection (e.g. validation/insufficient balance) from unknown/ambiguous transport or RPC outcome. For unknown outcomes, preserve the original request ID and provide an operation-history reconciliation path; do not claim the balance is unchanged.
- Actual: the UI collapses all non-ok responses into a definite failed state. A 503 after an uncertain RPC outcome can be shown as failed/unchanged; if the user starts a new withdrawal, a new request ID is generated, so backend idempotency for the original request does not prevent a second withdrawal.
- User impact: a user may retry an operation that was actually committed, potentially creating a second withdrawal request and additional reserved funds. This is a correctness/safety issue, not a claim that a duplicate withdrawal has been reproduced.
- Recommendation to 2号: add a distinct UNKNOWN / CHECK HISTORY state for unconfirmed outcomes; retain the original request ID and submitted payload until reconciled; only allow a new request after the original is confirmed absent or terminal. Keep 3号 backend response semantics authoritative and coordinate any contract clarification with 3号.
- Target owner: 2号 Interaction Team; 3号 confirms API error semantics.
- Status: OPEN / ACTION REQUIRED. Source-confirmed mismatch; runtime reproduction not performed.

## Peer-team execution observations

- 1号 Visual Team task-board records repeatedly mark build/tests/browser QA as NOT RUN and state that rendered acceptance remains pending. This is correctly disclosed, not a confirmed code defect; visual completion must not be declared until browser evidence is recorded.
- 2号 Interaction Team task-board detailed records mark work IN_PROGRESS and runtime/browser verification NOT RUN, while the top team-status row still says READY / awaiting source scan. This is a stale status contradiction and should be reconciled by the coordinator/2号.
- Reviewed 2号 withdrawal flow is within its assigned interaction responsibility; this finding concerns an unsafe result-state mapping, not an ownership violation.
- No evidence in this sample that 1号 or 2号 edited protected financial backend/database code.

## Reconfirmed cross-project blocker

- `main` `api/core.js` still treats unset financial flags as enabled via `!== '0'`, while `main` `scripts/deployment-preflight.js` only reports exact `'1'` as enabled.
- This is the already-open `BUS-ENV-001` P0, not a duplicate issue. The current source still does not satisfy a consistent fail-closed gate. Do not enable or test funded financial operations until the owner resolves it.

## Safety / test boundary

- Target-team files or branches modified: NO.
- Application/API/SQL/database/auth/financial source changed: NO.
- Withdrawal API or database operation performed: NO.
- Build/tests/browser QA: NOT RUN.
- No production request, deployment, or main merge performed.
