# BTCBOX Shared AI Coordination

This file is the shared source of truth for AI-assisted work on BTCBOX. It does not provision a new server or change production infrastructure.

## Canonical project state

- Repository: `avali9308-code/btcboxcdt`
- Integration branch: `develop`
- Production baseline recorded for the current review: `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`
- Authentication PR under review: #15
- Authentication target SHA: `968e5148d811f2869fc86e3c521999bb699396d9`
- Latest independent READY Preview reviewed: `e914ebcf20de17a47bde6ac98686812f3ded6d4e`
- Preview URL: https://btcboxcdt-7dqwu4t18-box-2753.vercel.app

A result is valid only for the exact commit SHA and environment tested. Never transfer a pass/fail result from one SHA to another.

## Responsibilities

### Implementing AI (AI 1)
- Own implementation and code changes.
- Work on a dedicated feature/fix branch; do not commit directly to `develop` or production.
- Preserve existing business logic and interfaces unless the task explicitly authorizes a change.
- Report changed files, commit SHA, tests run, test results, and known limitations in the related PR/issue.

### Independent QA AI (AI 2)
- Review the implementation independently; do not duplicate feature work.
- Reproduce and record defects with exact route, device/viewport, steps, expected/actual result, severity, and affected SHA.
- Verify fixes on the new SHA; do not approve based on screenshots or an older Preview.
- Keep P0/P1 user-facing and core-flow defects visible until verified fixed.

### Coordinator / integrator (AI 3 or project owner)
- Maintain the current task list and cross-check API/UI contracts.
- Ensure each task has one implementation owner and one independent reviewer.
- Confirm Preview SHA, deployment state, and test evidence before marking work complete.
- Prepare deployment readiness; production release remains a human-approved action.

## Test priority

1. **P0 — core access and money flows:** registration/login, market data, buy/sell, deposits, withdrawals, orders. Never claim real-money readiness without explicit backend/database/matching validation.
2. **P1 — interaction:** buttons, navigation, forms, dialogs, validation, loading/error/success feedback.
3. **P1 — data correctness:** prices, charts, balances, order history, order states, refresh behavior.
4. **P2 — responsive UX:** mobile first (including iPhone Safari safe areas), then desktop; check all primary and secondary pages.
5. **P3 — deeper hardening and polish:** schedule after launch-blocking defects. Account takeover, unauthorized registration, data exposure, and incorrect money movement remain release blockers.

## Change and release rules

- One task = one owner, one branch, one PR, one explicit acceptance record.
- No overlapping edits to the same files without coordination in the PR.
- No secrets, credentials, personal data, or production tokens in issues, commits, logs, or screenshots.
- Do not merge, deploy to Production, change financial logic, or alter database/matching/settlement behavior without explicit user authorization.
- Preview deployments are test environments, not proof of Production behavior.
- Runtime logs with no matching entries do not prove that a page or user flow works.
- If browser E2E cannot run, mark it **NOT TESTED** and state the blocker; do not convert static inspection into a pass.

## Required QA report

For every tested SHA, report:

| Field | Required value |
|---|---|
| Commit SHA | Full SHA |
| Environment | Preview / Production |
| URL and route | Exact URL and route |
| Device | Device, OS, browser, viewport |
| Flow | Exact user journey |
| Result | PASS / FAIL / NOT TESTED |
| Evidence | Reproduction steps, screenshot/log/test output |
| Defect | Severity, expected vs actual, affected file/API |
| Retest | Fix SHA and retest result |

## Current open items

- #14: Legacy local registration endpoint must not bypass Supabase email verification; auth health must not claim live OAuth E2E from configuration alone.
- #15: Email/Google auth flow requires independent end-to-end verification; keep its target SHA separate from later Preview SHAs.
- Latest Preview `e914ebcf20de17a47bde6ac98686812f3ded6d4e`: independent UX smoke review requested; browser automation was blocked by DNS failure, so real browser interaction remains NOT TESTED.

## Status update format

Post updates in the relevant PR/issue using:
`[SHA] [Environment] [PASS/FAIL/NOT TESTED] — route/flow — evidence — defect or next action`.

This document is a coordination contract, not a claim that any test has passed.


## AI 2 — Interaction Team: independent review notes (2026-11-03)

> Status: review checklist and previously observed risks only. The items below are not claims that the current branch or latest deployed SHA still contains these defects. Reproduce against the exact current SHA before assigning FAIL/PASS.

### Current review focus

| ID | Area | Finding / risk to verify | Priority | Evidence status | Suggested acceptance |
|---|---|---|---|---|---|
| UX-01 | Public market refresh | Verify the public market endpoint and the `markets[]` update path described in Issue #19 also produce a visible, fresh UI update. A successful API response alone is insufficient if existing rows remain stale. | P1 | Issue #19 scope; UI retest pending | Existing market rows update without requiring a full page reload; timestamps/prices do not silently freeze; provider errors show a recoverable state. |
| UX-02 | Loading / empty / error states | Check market, kline, depth, assets, orders, deposit and withdrawal views for distinct loading, empty, failure and retry states. | P1 | Not yet tested on current SHA | Each state is understandable; retry works; no indefinite spinner or blank panel. |
| UX-03 | Action feedback | Verify primary buttons and forms give immediate feedback and prevent accidental duplicate submissions while a request is pending. | P1 | Not yet tested on current SHA | One user action creates at most one request; pending state is visible; success is shown only after confirmed server success. |
| UX-04 | Navigation and state continuity | Verify switching markets/pages and returning from detail flows does not lose relevant selection or display stale data as current. | P1 | Not yet tested on current SHA | Navigation destination and selected market are correct; stale data is clearly distinguished from live data. |
| UX-05 | Mobile interaction | Test primary navigation, dialogs, forms, order controls and chart/depth layout on iPhone Safari, including safe areas and keyboard overlap. | P1 | Prior mobile coverage was incomplete; current SHA not tested | No clipped controls, inaccessible dialogs, horizontal overflow or keyboard-obscured submit actions. |
| UX-06 | Order interaction contract | The UI must not offer an order type that the API does not support. Previously recorded Market-vs-Limit mismatch requires revalidation against current UI and API. | P0/P1 | Historical finding; current state unverified | Every visible order type is accepted by the backend and has a tested success/error path; unsupported options are not presented. |
| UX-07 | Auth experience | Verify Email and Google login/register, verification-required state, callback return path, error feedback and route guards in a real browser. Configuration alone is not proof of a working flow. | P0 | Prior browser E2E was blocked; current SHA not tested | Complete browser journeys pass on the exact Preview SHA; unverified flows remain NOT TESTED. |

### Interaction-team recommendations

1. Treat every visible control as a user-facing contract: confirm its event handler, request, pending state, outcome and failure path.
2. Use shared Button, Input, Modal, Toast, Skeleton/Loading and status components where the codebase already provides suitable components; do not create parallel styling systems.
3. Keep financial actions conservative: no optimistic balance increase, no success toast before server confirmation, and no duplicate order/deposit/withdrawal submission. Any balance or ledger correctness issue belongs to the business/data owner and must be escalated rather than patched by Interaction Team.
4. Preserve the locked trading-page layout. Interaction improvements may address feedback, accessibility and state behavior, but must not rearrange the locked layout without explicit approval.
5. Record browser/device/viewport, exact route, steps, expected/actual behavior, full tested SHA and evidence. Static inspection must not be reported as browser PASS.
6. Do not use Figma as a source of truth yet: the Figma plugin is installed, but no BTCBOX design file or design frames have been supplied. Until a real file is linked, use the existing implementation and this coordination document as review references; do not invent or overwrite a design.

### Required retest status

All rows above are **NOT TESTED on the current SHA** unless a later update supplies exact SHA-specific evidence. Reclassify each row only after reproducing it or verifying a fix.

### AI 1 contribution slot

AI 1 should append implementation/visual findings under a separate heading (for example, `## AI 1 — Implementation / Visual Review`) with exact file paths, affected SHA, evidence, severity and recommendations. Do not overwrite the AI 2 section. Cross-team disagreements should be recorded as separate observations for the project owner to decide.


## AI 2 — Independent review of auth / account-hydration branches (2026-11-03)

> Review scope: source and branch comparison only. No browser E2E or local test execution was performed in this review. Findings are tied to the exact branch-tip commits below.

### Branch comparison

| Branch | Tip commit SHA | Commit / check evidence | Review status |
|---|---|---|---|
| `fix/google-auth-registration-guard-20261103` | `968e5148d811f2869fc86e3c521999bb699396d9` | Tip commit is CSS-only (`assets/css/components.css`, auth separator/feedback styling). Vercel status is FAILURE with target indicating build-rate-limit. No workflow test runs returned. | SOURCE OBSERVED; NOT VERIFIED |
| `fix/interaction-account-hydration-20261103` | `0989be5528c965d33b1115944c1474cfafa069a7` | One commit ahead of the auth branch; tip changes only `assets/js/app-core.js`. Vercel status is SUCCESS, but this is a deployment check, not proof of auth E2E or test-suite pass. No workflow test runs returned. | SOURCE OBSERVED; NOT VERIFIED |

Both branches share the same merge base `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f` and are two commits behind the coordination branch tip because the coordination branch contains documentation-only commits. Relative to one another, the hydration branch is one commit ahead. Their changed-file sets overlap in `assets/css/components.css`, `assets/js/app-core.js`, `assets/js/boot.js`, `assets/js/views-home.js`, and `tests/smoke.test.js`; the only difference between the two branch tips is the additional account-hydration change in `assets/js/app-core.js`. Do not combine or merge both branches as independent work without reconciling this overlap.

### Findings

| ID | Priority | Evidence status | File / location | Finding and required follow-up |
|---|---|---|---|---|
| AUTH-QA-01 | P1 | SOURCE OBSERVED | `assets/js/app-core.js`, `Auth.completeLogin()` around lines 573–595 at hydration tip `0989be5528c965d33b1115944c1474cfafa069a7` | The new flow waits for `apiAdapter.account()` and only sets `state.user` / shows “Logged in” after an `ok` response. This is safer than the previous flow, which ignored account hydration failure and still navigated to markets. Keep this direction. Verify that `/api/account` returns the expected shape after email, Google OAuth, and 2FA cookie exchange. |
| AUTH-QA-02 | P1 | SOURCE OBSERVED | `assets/js/app-core.js`, `Auth.showLoginTwoFactor()` around line 631 at hydration tip | The 2FA success handler closes the modal and calls `Auth.completeLogin(email)` without awaiting its result. The method itself still handles hydration failure with an error toast, so this is not yet a confirmed functional defect; however, the caller cannot coordinate pending/error state with the asynchronous hydration. Consider awaiting it and keeping clear pending/error feedback. |
| AUTH-QA-03 | P1 | NOT VERIFIED | `tests/smoke.test.js` | The smoke-test file is byte-identical on both branches (blob `79f3c7c8689a27a4ed7d312c648a067418f0a23e`). It contains a static assertion that Google registration checks Terms consent before OAuth, but no behavioral tests for successful/failed account hydration, login state rollback, OAuth return path, or 2FA completion. Add focused tests with mocked `apiAdapter.account()` success, rejected promise, and `ok:false` response; cover email, Google, and 2FA call paths. |
| AUTH-QA-04 | P1 | NOT VERIFIED | Browser / Preview | No real browser E2E evidence was available for email registration verification, Google OAuth callback, session-cookie exchange, account hydration failure, or retry/recovery. The Vercel SUCCESS check on the hydration tip is not a substitute for these journeys. Run browser tests against the exact Preview SHA and record device, route, steps, and output. |
| AUTH-QA-05 | P2 | SOURCE OBSERVED | `assets/js/app-core.js`, `Auth.completeLogin()` around lines 576–584 | On account hydration failure, the code clears `state.user` but does not explicitly sign out or invalidate the Supabase client session. This may be intentional to permit retry, but the retained session/retry behavior must be checked to ensure it does not create a confusing half-authenticated state or an automatic redirect loop. |

### Review conclusion

- The hydration commit is a meaningful correctness improvement in source: login success is no longer reported before the backend account endpoint responds successfully.
- The branch is **not accepted yet**: no hydration-specific automated tests and no browser E2E evidence were found.
- The Google registration Terms guard has a static source assertion, but its actual OAuth flow and backend verification requirements remain NOT VERIFIED.
- The two fix branches overlap heavily. Prefer one consolidated implementation branch/PR after the owner reconciles the one-commit hydration delta; do not merge both independently.
- No implementation branch was modified by this review. No merge or deployment action was taken.

### Required next evidence

1. Add unit/integration tests for account hydration success, rejection, and `ok:false`, including 2FA and OAuth callback paths.
2. Run the complete test command on exact commit `0989be5528c965d33b1115944c1474cfafa069a7`; attach the command and output.
3. Complete browser E2E for email verification, Google login/register, Terms consent, callback/return path, backend cookie exchange, account hydration failure, and recovery/retry on a Preview built from that exact SHA.
4. Resolve the Vercel build-rate-limit failure recorded for `968e5148d811f2869fc86e3c521999bb699396d9`; do not infer that its branch has a valid Preview from the later branch's successful check.


## AI 3 — Restarted-work coordination plan (2026-11-03)

This section is an execution plan for the restarted AI 1 / AI 2 work. It supplements the rules above and does not erase prior findings or authorize merge/deploy.

### 1. Single source of truth and work intake

- This file on `chore/shared-ai-coordination` remains the only shared coordination entry point. Before starting or changing a task, AI 1 and AI 2 must read its latest version and the linked Issue/PR.
- No parallel task lists in chat are authoritative unless recorded here or in the relevant GitHub Issue/PR.
- Every task must identify: task ID, priority, one implementation owner, one independent reviewer, base SHA, allowed files/scope, acceptance criteria, test evidence, current status, and next handoff.
- Preserve existing issue history. Append status updates; do not overwrite another team's findings or mark a task closed without evidence.

### 2. Strict role boundaries

- **AI 1 — Implementation:** code changes only on a dedicated task branch; one task per branch/PR. Report full SHA, changed files, tests actually run and output, preview URL/SHA, known limitations. Do not merge or deploy.
- **AI 2 — Independent QA:** review AI 1's exact PR head SHA independently. Do not implement the fix in parallel or alter AI 1's branch. Record each check as SOURCE OBSERVED, REPRODUCED, TEST PASSED, or NOT VERIFIED; browser tests not run must be NOT TESTED/NOT VERIFIED, never PASS.
- **AI 3 — Business integration/coordinator:** sequence dependencies, clarify API/UI contracts, prevent overlapping edits, maintain the issue queue, verify evidence completeness and prepare a release-readiness recommendation. Do not take over AI 1 implementation or AI 2's independent verdict.
- The project owner retains approval authority for merges, production deployment, production environment changes, financial cutover, and any change to the locked trading layout.

### 3. Branch and PR rules

- Use the latest agreed integration base after checking the actual branch head; do not assume historical SHA values are current.
- Naming convention: `fix/<issue-number>-<short-scope>-20261103` or `feat/<scope>-20261103`.
- One issue = one implementation branch = one PR = one acceptance record. Do not bundle unrelated fixes.
- Do not commit directly to `develop`, `main`, or production branches. Do not merge overlapping branches independently. If two branches touch the same files, stop and coordinate the owner and merge sequence in the relevant PR before further edits.
- Shared files, especially `api/core.js`, require explicit scope coordination. Do not concurrently edit the same shared file for separate issues.

### 4. Ordered execution queue

**Gate 0 — Restart alignment (AI 3 coordinates; AI 1 and AI 2 acknowledge through GitHub):**
- Confirm current integration base SHA, current open PR heads, and actual branch tips.
- Each AI states its assigned task and files in the relevant issue/PR. No new implementation begins until scope and ownership are clear.
- Old branches/PRs are evidence only until their exact head SHA is revalidated; do not assume old work is accepted or discard it without comparison.

**Gate 1 — P0 routing recovery (Issue #18; AI 1 implements, AI 2 independently tests):**
- Fix only the 23 documented nested API routes and method routing.
- Do not mix in auth, market refresh, ledger, matching, deposit, withdrawal, or UI redesign.
- AI 2 tests each documented path and appropriate HTTP method on a newly generated Preview, recording full SHA, URL, status and response type. No financial mutation is required to prove routing.

**Gate 2 — P0 identity boundary (Issue #14; after Gate 1 handoff because `api/core.js` overlaps):**
- Block unauthenticated legacy `POST /api/register` account creation; preserve existing users and records.
- Keep verified Supabase identity as the server-side account creation/linking boundary.
- Correct auth-health semantics; provider configuration is not proof of live OAuth E2E.
- AI 2 tests direct registration rejection and verified Email/Google account linking without exposing secrets.

**Gate 3 — P1 market data continuity (Issue #19; after shared-file handoff):**
- Keep public read-only market/kline/depth routes independent of persistence availability, without weakening authenticated/financial DB gates.
- Fix existing-symbol updates for `markets[]` and `data` response forms; validate symbols and numeric values.
- AI 2 tests API behavior and visible UI refresh on the exact new SHA.

**Gate 4 — Interaction and mobile trading specification:**
- AI 1 first inventories the existing trading UI, supported order types, order/market/depth APIs, balance source and record fields before changing layout.
- The user's §9.4 Mobile Pro Trading Specification is a separate implementation requirement: mobile-first two-column order book/order-entry, order/position workspace, chart bottom drawer and fixed five-item navigation.
- This does **not** unlock or authorize changes to the currently locked trading-page layout. AI 3 must clarify scope as mobile-specific before implementation; desktop locked layout stays unchanged.
- Only show backend-supported order types. No fake balances/orders/market data and no success feedback before server confirmation.
- AI 2 performs the 320/360/375/390/430px viewport matrix and iOS Safari/mobile Chrome browser tests. If browser access is unavailable, report NOT TESTED.

**Gate 5 — Financial readiness (Issue #17; separate gated workstream):**
- Do not turn on financial cutover flags just to make buttons work.
- Require schema/RPC review, migration and legacy-balance reconciliation plan, account/ledger/operation/deposit/withdrawal consistency, matching-market rules and non-production lifecycle tests.
- Real-money enablement, secrets/environment changes and production financial changes require explicit project-owner approval.

**Gate 6 — Final cross-system acceptance:**
- AI 2 supplies independent exact-SHA QA for routing, auth, market refresh, UI interactions, mobile responsiveness and relevant business flows.
- AI 3 checks cross-layer consistency and that every P0/P1 has a verified disposition, then posts a release-readiness summary with blockers and evidence.
- No merge/deployment recommendation while any release-blocking issue is unverified. No production deployment without explicit owner approval.

### 5. Evidence vocabulary and status rules

Use these statuses precisely:
- **SOURCE OBSERVED** — seen in code/config or a repository artifact; runtime behavior not established.
- **REPRODUCED** — the stated failure or behavior was observed using recorded steps on a named SHA/environment.
- **TEST PASSED** — a named test/flow passed on the exact full SHA and environment, with command/output or reproducible evidence.
- **NOT VERIFIED** — insufficient evidence, unavailable browser, missing environment, or a result that cannot be tied to the exact SHA.

Do not use “fixed”, “complete”, “accepted”, “ready” or “working” as a conclusion without stating the exact SHA and supporting evidence. A successful build/deployment is not a substitute for flow-level acceptance.

### 6. Required task handoff template

Every implementation or QA handoff must include:

```text
Task / Issue:
Owner / Reviewer:
Base SHA:
Branch / PR:
Scope and changed files:
Exact tested SHA:
Environment / Preview URL:
Commands or browser steps:
Result: SOURCE OBSERVED / REPRODUCED / TEST PASSED / NOT VERIFIED
Evidence:
Known limitations / blockers:
Next owner and next action:
```

### 7. Current queue snapshot (must be refreshed against live GitHub before acting)

| Order | Item | Implementation owner | Independent reviewer | Gate |
|---|---|---|---|---|
| 1 | Issue #18 nested API route recovery | AI 1 | AI 2 | P0, first |
| 2 | Issue #14 registration/auth-health boundary | AI 1, after #18 shared-file handoff | AI 2 | P0, second |
| 3 | Issue #19 market route and market[] refresh | AI 1, after shared-file handoff | AI 2 | P1, third |
| 4 | §9.4 mobile trading UI | AI 1, only after inventory/scope confirmation | AI 2 | Separate UI workstream; locked desktop layout protected |
| 5 | Issue #17 financial readiness | AI 3 coordinates owner approvals; implementation owner to be explicitly named | AI 2 | P0 release blocker; no flags/real-money enablement without approval |

This queue is a sequencing plan, not evidence that any item has started, passed, merged, or deployed.


## AI 3 — Full-surface Pro Trading redesign direction (2026-11-03)

The project owner has explicitly **released the previous desktop trading-page layout lock**. Desktop trading UI may now be redesigned. The mobile experience must follow the owner's §9.4 Mobile Pro Trading Specification. This supersedes earlier coordination text that said the desktop layout must remain locked.

### Design mandate

Build one coherent BTCBOX Pro Trading workspace system for desktop and mobile. Use mature Binance Pro / OKX interaction patterns as functional references, not brand styling. All trading modules (Spot, Futures, Seconds, Earn) should share a consistent information hierarchy and interaction language, while displaying only fields and actions supported by each module's real business/API contract.

### AI 1 — implementation recommendations and required sequence

1. **Inventory before redesign:** inspect existing desktop and mobile trading pages, shared styles/components, supported order types, order-book/depth payloads, market ticker/K-line data, balance source, order create/cancel/history APIs, position fields and module-specific differences. Produce a short current-state map and identify unsupported UI controls before changing layout.
2. **Define shared trading shell:** establish consistent module navigation, symbol selector/market summary, chart entry, settings entry, workspace spacing, typography, numeric alignment, status colors, button/input sizes and responsive breakpoints. Reuse suitable existing components; avoid parallel design systems.
3. **Desktop composition:** design a professional wide-screen workspace with market/symbol summary at top; order book and order-entry as the primary adjacent work areas; chart as a deliberate workspace region or switchable panel; order/position/history workspace below or in a clearly managed adjacent panel. Preserve efficient keyboard/mouse use and avoid excessive empty space. Desktop layout is no longer locked, but do not remove existing capabilities without an explicit replacement and regression check.
4. **Mobile composition — follow §9.4:** do not shrink desktop. Keep order book left and order-entry right, targeting the specified approximate 38:62 ratio; compact top market summary; bottom-sheet order-type selector; lower order/position/history tabs; chart hidden by default and opened as a bottom drawer above the fixed five-item navigation; respect iOS safe areas and keyboard behavior.
5. **Module-specific adaptation:** Spot, Futures, Seconds and Earn may have different forms, risk fields and records. Keep the same design grammar but do not force identical controls. Show only backend-supported order types/actions and relevant fields. In particular, do not expose Market order if the current API rejects it; do not invent TP/SL, iceberg, leverage, margin or settlement features where no real support exists.
6. **Real data and feedback:** no mock balances, prices, positions or orders. No optimistic balance/position mutation. Pending state must prevent duplicate submission; success only after server confirmation; errors must be actionable and preserve safe user input where appropriate.
7. **Implementation isolation:** create a dedicated trading UI feature branch and PR, separate from routing/auth/market API fixes. Coordinate any API contract change before implementation; do not edit backend business/ledger/matching logic as part of visual redesign.
8. **Regression and responsive verification:** test desktop at representative widths and mobile at 320, 360, 375, 390 and 430px. Verify iOS Safari and mobile Chrome when browser access is available. Check no body horizontal overflow, independent order-table scrolling, drawer/navigation geometry, safe areas, keyboard overlap, and all primary interaction states.

### AI 2 — independent review recommendations

- Review AI 1's inventory and compare every visible control against a real API/data contract.
- Independently test module switching, symbol selection, order book price-fill behavior, buy/sell switching, supported order-type changes, precision/percentage calculations, available balance, submit pending/success/error states, cancel confirmation, order tabs, chart drawer and navigation.
- Check desktop and mobile separately. Mobile viewport matrix: 320 / 360 / 375 / 390 / 430px; browsers: iOS Safari and mobile Chrome where available.
- Verify order-book updates do not flash or shift numeric columns; verify order table horizontal movement stays inside its own container.
- Record exact SHA, Preview URL, device/browser/viewport, steps, expected/actual, evidence and PASS/FAIL/NOT TESTED. Do not implement fixes on AI 1's branch.

### AI 3 — integration gates

- Coordinate API contracts and resolve ownership conflicts before implementation.
- Keep the Pro Trading UI branch separate from Issues #18, #14 and #19 backend remediation.
- After UI implementation, reconcile visible module actions with backend capability and Issue #17 financial readiness. UI completion does not mean real-money trading is enabled.
- The previous desktop layout lock is released by the project owner; no further approval is required merely to redesign desktop layout. Production deployment and financial cutover remain separately approval-gated.

### Acceptance standard

The design is accepted only when desktop and mobile both deliver a coherent professional trading workflow, each module exposes only real supported capabilities, all visible interactions have verified outcomes, and the exact tested SHA has independent QA evidence. Visual similarity alone is not acceptance.


## AI 3 — Guest-first, full-site experience refinement (2026-11-03)

The project owner has clarified that the full-site refinement must begin with the experience of a **first-time visitor who opens BTCBOX while not logged in**. The work is not limited to polishing individual pages after authentication. Treat guest access, authentication transitions, and authenticated use as three connected states of one product journey.

This section supplements the existing coordination and release rules. It does not change the agreed integration base (`develop`), authorize direct commits to `develop`, authorize merge/deployment, or supersede P0 backend remediation and financial approval gates.

### Product-wide experience principle

- Public information should be browsable without requiring login wherever the existing API and product rules support public access.
- Private account information and account-specific actions must remain behind the appropriate authenticated session and server-side authorization.
- A guest may preview supported public market/trading information, but must not submit a real order or perform a financial/account mutation while unauthenticated.
- Do not fabricate prices, balances, orders, positions, deposits, withdrawals, or capabilities to make a guest screen look populated.
- Every guest-to-authenticated transition should preserve the user's intended destination and relevant context (for example, the selected market/symbol) where safe and technically supported.

### Stage A — First visit / guest experience (first UX acceptance path)

AI 1 must inspect and refine the site from the perspective of a brand-new visitor, starting at the first page load:

1. **Home:** first-load performance and visual hierarchy, brand/navigation clarity, public market highlights and working quick links.
2. **Global navigation:** clear Login and Register entry points; correct active states and responsive behavior.
3. **Public Markets:** browse/search/filter and view live market data without forced login if the underlying endpoint is public; distinguish loading, empty, stale and error states.
4. **Trading preview:** allow guest access to the supported public parts of the trading workspace (symbol, ticker, chart, order book/depth where public); do not expose private account data or enable unauthenticated order submission.
5. **Trade intent:** when a guest selects Buy/Sell or another protected action, show a clear, context-aware login/register prompt. After successful authentication, return to the intended route and selected symbol when feasible.
6. **Assets:** show a deliberate guest-state explanation and login CTA; never show another user's or fabricated account balances.
7. **Personal Center:** show a useful guest state with Login/Register entry points rather than a broken, blank, or misleading account page.
8. **Announcements/help/support:** verify which content and support entry points are public and which legitimately require identity; do not gate public informational content unnecessarily.
9. **All protected routes:** verify direct URL entry, refresh, browser back/forward, and expired-session behavior. Protected data/actions must remain protected server-side, not merely hidden in the UI.

### Stage B — Authentication and state transition

Verify the complete supported Email and Google journeys, including:

- Registration and Terms acceptance where required.
- Email verification-required state and callback handling.
- Google OAuth callback and session establishment.
- Clear pending, success and actionable error feedback.
- Correct account hydration before showing the user as logged in.
- Preservation/restoration of the original destination and market context.
- Session refresh/expiry and logout; after logout, private views must return to the correct guest state.

Configuration alone is not proof of a working provider flow. Browser E2E that has not been run must remain NOT TESTED / NOT VERIFIED.

### Stage C — Authenticated product journey

After guest and auth states are mapped, refine and verify the authenticated pages in page order:

- Trading modules (Spot, Futures, Seconds, Earn), using only real supported capabilities.
- Assets overview and coin list.
- Deposit and withdrawal entry and lifecycle states.
- Current orders, positions, order history and fills.
- Personal Center, profile, security, KYC and settings.
- Announcements, help/support and other existing functional pages.
- Admin pages as a separately authorized role/state, never as ordinary guest or user content.

Desktop trading layout is open for redesign as previously approved. Mobile trading must follow the owner's §9.4 Mobile Pro Trading Specification. Module-specific fields and controls must reflect actual API/business support.

### Required end-to-end acceptance journeys

**A. New visitor → authenticated action**

Open site as a clean guest session → inspect home → browse public markets → open a trading pair → inspect supported public chart/order-book information → attempt Buy/Sell → receive login/register prompt → complete a supported authentication flow → return to the original trading route/symbol → verify account hydration → verify only backend-supported actions are available.

**B. Existing authenticated user → account journey**

Open site with a valid session → browse markets → open trading workspace → inspect assets → enter deposit/withdrawal flows without falsely claiming completion → inspect orders/history → visit Personal Center/security/KYC as applicable → logout → verify guest state and protected data are no longer accessible.

**C. Guest route and session edge cases**

Directly open a protected URL as guest → verify safe redirect/prompt → authenticate → verify return destination; repeat with refresh, browser back/forward, expired session and logout. Record unsupported or intentionally restricted routes explicitly.

### Ownership and sequencing

- **AI 1 — implementation owner:** continue the current sitewide refinement branch for page/UI work, but first produce a concise route/state inventory covering guest, authentication and authenticated states. Do not discard the already completed Home and Markets refinements. Add guest-state handling page by page and keep each task isolated in a dedicated branch/PR as required by the existing branch rules.
- **AI 2 — independent QA:** do not begin acceptance merely because AI 1 reports a page polished. Independently test the guest-first journeys, auth transitions, authenticated journeys, protected-route behavior and responsive layouts on the exact PR head SHA. Record route, session state, device/browser/viewport, steps, expected/actual result and evidence.
- **AI 3 — coordinator:** maintain the route/state matrix, ensure UI behavior matches public/private API contracts, sequence dependencies, and keep the sitewide UI work separate from P0 routing/auth and financial backend remediation. Escalate any UI that depends on an unavailable or unverified backend capability.

The guest-first UX work may proceed as an isolated UI workstream, but it must not delay or conceal P0 routing/auth defects. Engineering dependency order and financial release gates remain governed by the existing task queue and Issues #14, #17, #18 and #19.

### Minimum route/state matrix

For every existing primary page, AI 1 must record whether it is:
- Public and usable as guest;
- Public preview with protected actions;
- Authentication-required;
- Role-restricted (for example, admin);
- Not currently supported / intentionally unavailable.

For each state, record the actual route, data source/API, visible controls, protected actions, guest behavior, authenticated behavior, loading/empty/error behavior and known limitation. Do not invent routes or product features.

### Acceptance and evidence

- Test a clean guest session and a separately authenticated session; do not infer guest behavior from an already logged-in browser.
- Verify both UI gating and server-side authorization for protected actions.
- Check desktop and mobile responsive behavior; mobile trading viewports remain 320 / 360 / 375 / 390 / 430px, with iOS Safari and mobile Chrome where available.
- For each journey, report full commit SHA, Preview URL, browser/device/viewport, exact steps, result (PASS / FAIL / NOT TESTED), and reproducible evidence.
- A page is not accepted solely because it renders. Navigation, data freshness, action feedback, access boundaries and return-path continuity must also be tested.
- No merge, Production deployment, production environment changes or financial cutover is authorized by this UX direction.

This is the product experience baseline for the current sitewide refinement: **Guest → Authentication → Trading → Account**, beginning at the first visit and continuing through the user's complete supported journey.


## AI 3 — Practical launch constraints and completed test-account cleanup (2026-11-03)

The project owner confirmed that BTCBOX has no custom SMTP service and uses Supabase Free. Google OAuth is the primary practical sign-in path for now. Do not let email delivery limitations block guest browsing or sitewide UI refinement.

### Practical auth/UI direction

- Prioritize and test Google OAuth as the primary sign-in/sign-up route, subject to a real browser test of the current Preview.
- Supabase's built-in email sender is restricted to addresses belonging to the project's organization/team and has a low shared rate limit. Do not assume public visitors can receive confirmation or password-reset emails without custom SMTP. Reference: https://supabase.com/docs/guides/auth/auth-smtp
- Keep Email auth only with honest delivery/verification messaging. Mark it LIMITED / NOT VERIFIED until tested with a permitted address and the exact Preview.
- Do not disable confirmation or mark arbitrary emails verified to bypass delivery restrictions. Do not create local accounts as a substitute for verified Supabase identities.
- Guest browsing and public market preview must progress independently of SMTP configuration.

### Supabase database inventory and owner-authorized cleanup

The initial read-only inventory on 2026-11-03 found three Google Auth test users, four legacy user records and 17 legacy session entries in `public.btcbox_state`. The owner explicitly confirmed these were old test records and authorized clearing all users while preserving the database and configuration.

**Cleanup was subsequently executed and independently re-queried through the connected Supabase project `zlozsutefnmgwwzrlipt`. It is complete.**

Post-cleanup verification:
- `auth.users`: 0
- `auth.identities`: 0
- `auth.sessions`: 0
- Legacy `users`: 0
- Legacy `sessions`: 0
- `public.btcbox_state`: the existing state row remains (1 row)
- Private pre-cleanup backups: 3 Auth user metadata records and 1 prior `btcbox_state` snapshot
- `earn_product_catalog`: 7 configuration/catalog rows retained
- Existing `announcement`, `deposit_addresses`, `next_uid`, and `audit_logs` values retained

The cleanup did **not** delete or recreate the Supabase project, database, schemas, business tables, Google OAuth provider configuration, callback settings, or Vercel environment variables. No passwords, password hashes, salts, fund-password values, 2FA secrets, access tokens, or refresh tokens were copied into the backup records.

**Operational note:** deleting Auth users and clearing Auth sessions does not guarantee that already-issued JWTs become invalid immediately; JWTs may remain usable until expiry unless the application performs an online session/user-state check or an explicit revocation strategy.

### Coordination actions

- AI 1: continue sitewide Guest → Authentication → Trading → Account refinement. Use Google-first UX; document Email auth as constrained until real delivery is available.
- AI 2: independently verify Google OAuth on the exact Preview SHA. Email delivery remains LIMITED / NOT VERIFIED unless actually tested.
- AI 3: keep the cleanup record accurate, coordinate the P0 routing/auth queue, and ensure no UI work is mistaken for financial readiness.
- No further user cleanup is authorized or needed. Do not delete configuration/catalog data or alter project settings as part of routine development.

## AI 3 — Live coordination checkpoint (2026-11-03)

Live GitHub inventory checked after the owner requested continuation of coordinator duties. This is a branch snapshot, not a QA verdict:

| Ref | Observed head SHA | Coordinator interpretation |
|---|---|---|
| `develop` | `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f` | Integration baseline unchanged at time of check |
| `feature/ai1-sitewide-refinement-20261103` | `7f092cf0843e382c7eee50815b348b4e1d959814` | Sitewide implementation branch; not accepted by this snapshot |
| `feature/ai1-mobile-pro-trade-20261103` | `604b76cdaa8fb05e1d7de2490455efba78e7e147` | Mobile trading implementation branch; not accepted by this snapshot |
| `fix/interaction-account-hydration-20261103` | `451aa21745174550bb363262882c388e6b34f61b` | Account hydration / interaction branch; requires exact-SHA QA |
| `fix/google-auth-registration-guard-20261103` | branch exists | Tip must be refreshed before any review decision |

Open P0/P1 issue order remains:
1. **#18 — nested API routing recovery (P0):** first implementation/QA gate. AI 3 posted a coordination comment requiring an isolated routing fix and a new exact-SHA Preview covering all 23 routes and methods.
2. **#14 — registration identity boundary (P0):** follows the #18 shared-file handoff. AI 3 posted an addendum reflecting the owner's completed test-user cleanup; positive-path acceptance must now prove fresh verified Google identity creation/linking.
3. **#19 — public market route independence and market refresh (P1):** after shared `api/core.js` ownership handoff.
4. **Sitewide guest-first UI and Pro Trading UI:** proceed as isolated UI workstreams, but do not mask or claim resolution of the P0 routing/auth gates.
5. **#17 — financial readiness (P0 release blocker):** remain disabled/unready until schema, RPC, ledger, matching and lifecycle evidence is complete and the owner separately approves any production financial cutover.

The open PR search currently returned #15 (auth UI) and #16 (coordination protocol); branch existence or deployment status is not acceptance. Re-check current PR heads and workflow/Preview state before any merge recommendation. No branch was merged, no deployment was triggered, and `develop` was not modified by this checkpoint.

### CI / Preview constraint observed at this checkpoint

GitHub combined commit status was checked for these exact branch heads:
- `7f092cf0843e382c7eee50815b348b4e1d959814` — Vercel status FAILURE
- `604b76cdaa8fb05e1d7de2490455efba78e7e147` — Vercel status FAILURE
- `451aa21745174550bb363262882c388e6b34f61b` — Vercel status FAILURE
- `968e5148d811f2869fc86e3c521999bb699396d9` — Vercel status FAILURE

Each returned the Vercel target `upgradeToPro=build-rate-limit`. This indicates a build-rate-limit status, not a source-code test failure. It also means these status checks do not provide a READY Preview for browser QA. Do not mark UI/auth work as browser-tested from these statuses. Coordinate a single prioritized Preview build after the owner/team resolves the Vercel build quota/rate limit; avoid repeatedly triggering builds for every branch. Until a usable Preview exists, source review and automated tests may proceed, while browser E2E remains NOT TESTED.

### Cross-team proposal and unblock protocol (owner-approved collaboration style, 2026-11-03)

The owner asked teams to share their reasoning, proposed steps and blockers rather than working in isolation or waiting for repeated prompts. Apply this lightweight loop to active issues:

1. **Implementation proposal:** AI 1 posts the smallest safe approach, files to change, dependencies, local checks, and expected handoff SHA before or alongside implementation.
2. **Independent test proposal:** AI 2 posts the acceptance matrix, negative cases, expected response/status behavior, and evidence needed. AI 2 remains independent and does not implement the same fix.
3. **Coordinator resolution:** AI 3 identifies shared-file ownership, sequencing, parallelizable work, and cross-issue conflicts; records decisions in the relevant issue and this document.
4. **Early handoff:** AI 1 shares incremental commits/branch head when a coherent unit is ready; AI 2 can review that exact SHA while AI 1 proceeds on a separate unit, provided files/branches do not conflict.
5. **No silent blockers:** if Preview is unavailable, continue local/static/unit checks and document browser E2E as NOT TESTED. If a dependency blocks implementation, propose a safe alternative rather than waiting without progress.
6. **Acceptance:** AI 2 records PASS/FAIL/NOT TESTED against exact SHA and evidence. AI 3 only recommends integration after scope, ownership, tests and evidence align. No merge/deploy is implied by this protocol.

On 2026-11-03 AI 3 requested implementation plans and independent test matrices in Issues #18, #14, #19 and #17. These requests do not authorize changes to production, credentials, financial configuration, or user data.


## AI 3 — resumed coordination checkpoint (2026-11-03, latest live inventory)

This checkpoint supersedes earlier branch snapshots where the observed refs have moved. It records repository identity and actual handoff status; it is not an implementation or QA pass.

### Repository identity correction

- The active shared coordination repository is `avali9308-code/btcboxcdt`; its `develop` branch remains at `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`.
- A separate repository, `avali9308-code/btcbox-v33`, was checked to avoid cross-repository confusion. Its branch inventory contains only `main` at `37f04993fe6e60775eecb6f0b4ca726c9627e8ce` and `trae/agent-ZgGi7J` at `ebfb1dd5a17d061a6b773d66890d61b86212ac5f`; it does not contain the active BTCBOX coordination branches or the current `develop` baseline. Its latest listed commits are dated 2026-10-28. Do not treat `btcbox-v33` as the active integration target unless the owner explicitly changes the canonical repository.
- The active working branches and observed tips in `btcboxcdt` are:
  - `feature/ai1-sitewide-refinement-20261103`: `306def9b250c63deb8b0710df70220f1f612c52b` (latest commit is a documentation handoff about mobile trade CSS; this is not proof of a new UI code batch).
  - `feature/ai1-mobile-pro-trade-20261103`: `604b76cdaa8fb05e1d7de2490455efba78e7e147` (latest commit fixes order-type option binding; not independently accepted).
  - `feature/ai1-visual-20261103`: `d5b3e4eff449d85c14923df7fce0ba059447b06a` (latest commit records a chart-layout supervision handoff; not a visual acceptance).
  - `fix/interaction-account-hydration-20261103`: `771602d30f6b610240b646c35ead316db82d20f8` (latest commit records an interaction acceptance matrix; browser/device/runtime tests are explicitly NOT RUN).
  - `fix/google-auth-registration-guard-20261103`: `968e5148d811f2869fc86e3c521999bb699396d9`.
- No branch above is merged into `develop` by this checkpoint. Do not infer code progress from documentation-only tip commits.

### Live coordination and blocking status

- Issues #14, #17, #18 and #19 remain open. The latest comment inventory contains coordinator requests but no implementation proposal or independent QA response from a separate AI identity. The requests remain outstanding; do not claim that AI 1 or AI 2 has acknowledged or completed them.
- Issue #18 remains the first shared-API implementation gate. Its 23 nested routes (14 user + 9 admin) still require a narrowly scoped routing fix, route/method regression coverage, and exact-SHA Preview retest. The latest branch inventory contains no dedicated routing-fix branch.
- Issue #14 follows the #18 handoff because both touch `api/core.js`. Direct unauthenticated local registration and the inaccurate `live_oauth_tested` health flag remain unresolved on the reviewed target.
- Issue #19 follows the same shared-file handoff; do not concurrently modify `api/core.js`.
- Issue #17 remains a financial release blocker. Keep UI actions honestly limited/disabled; do not toggle financial flags or claim live trading/deposit/withdrawal readiness.
- The latest interaction/visual notes identify two actionable UI work items that can proceed without `api/core.js`: consolidate contradictory mobile trade CSS into one authoritative section while preserving the agreed 38/62 orderbook-left/form-right layout, chart drawer above the five-item nav and safe-area behavior; and agree/verify desktop chart drawer interaction before AI 1 changes chart layout. AI 2's acceptance matrix is source documentation only until browser/device tests are actually run.
- Existing Vercel build-rate-limit evidence still prevents assuming a new READY Preview. Until a Preview matching the exact fix SHA exists, browser E2E remains NOT TESTED. Prefer local/unit/source checks and one prioritized Preview build after quota availability.

### Coordinator execution rules reaffirmed

- AI 1 owns code implementation and must provide a dedicated branch, changed files, full SHA, actual test output and handoff.
- AI 2 owns independent verification and must report evidence against that exact SHA; do not ask AI 2 to implement fixes.
- AI 3 coordinates file ownership, API/UI contracts, issue order and evidence completeness; do not impersonate the other teams or mark their work complete.
- Continue non-overlapping UI work in parallel with the P0 API queue. Shared `api/core.js` remains single-owner at any given time.
- No merge, Production deployment, Production environment change, financial cutover, or destructive database action is authorized by this checkpoint.


## AI 3 — source-level handoff review (2026-11-03)

### Market adapter review against current AI 1 source

Reviewed `feature/ai1-sitewide-refinement-20261103` at `306def9b250c63deb8b0710df70220f1f612c52b` and the Interaction Team acceptance matrix at `fix/interaction-account-hydration-20261103` at `771602d30f6b610240b646c35ead316db82d20f8`.

- Confirmed `assets/js/app-core.js` `applyMarket()` still skips every already initialized symbol in its `r.markets` branch via `if(market[sym]) return;`. Since `PAIRS` pre-initializes supported symbols, this response shape cannot refresh existing market pairs. AI 3 recorded the exact finding and a narrow validation/merge contract in Issue #19 (comment 6597703543).
- Required fix: normalize and validate symbol; update existing and new symbols; accept only finite valid numeric values; preserve valid prior optional fields when an incoming field is absent/invalid; use valid source timestamps; test both `data` and `markets[]` payloads including malformed/unknown symbols.
- Separate freshness finding: current AI 1 `views-trade.js` fetches K-line candles on chart mount and timeframe changes, but ticker polling does not update the candle series. Track a bounded current-candle refresh separately, with single-flight behavior and timer/listener cleanup on route unmount.
- This adapter-only work can proceed without editing shared `api/core.js`; #19 server dispatch work remains sequenced after #18 routing handoff.

### Mobile trade CSS and chart lifecycle cross-review

- Current AI 1 sitewide branch contains an earlier mobile stacked form/orderbook layout and later 38/62 orderbook-left/form-right overrides. The later rule currently expresses the approved layout, but multiple media blocks continue to override drawer, safe-area, and small-width behavior. AI 1 has already been asked in MSG-035 to consolidate into one authoritative mobile section and test 320/360/375/390/430px; until that happens, source cascade review is not a device acceptance.
- Current chart view registers a window resize listener and an orderbook interval. The interval self-cleans when the panel disappears, but the chart resize listener has no visible route-unmount cleanup in the reviewed excerpt. Verify the router lifecycle and add explicit cleanup if not handled centrally; do not accumulate listeners across pair/route changes.
- AI 2's interaction matrix remains a plan: browser/device/auth runtime tests are NOT RUN. No UI branch is accepted solely because source or build checks pass.

### Current verification boundary

- #18 remains P0 and the first owner of shared `api/core.js`; #14 and #19 must not concurrently edit it.
- #19 now has a concrete source finding comment (6597703543); adapter-side work is separable from the backend dispatch change.
- Vercel build-rate-limit statuses still do not produce a matching Preview. Browser E2E remains NOT TESTED until an exact-SHA READY Preview is available.


### Additional #18 routing investigation (AI 3)

- Read current `develop` `vercel.json` (blob `48fa8a997e2bb91088f05de80cfc6015728851b4`): the only API function pattern is `api/[...path].js`; no explicit API splat rewrite is defined. The SPA rewrite excludes `api/`.
- Read current `api/[...path].js` (blob `a1dc53a1a52b782a9c3165dca3cfdcc354797140`): it delegates all received requests to the shared `api/core.js` handler.
- Vercel's published Gatsby routing examples document splat API files as `api/products/[...].js` with an explicit `/api/products/:path*` -> `/api/products/[...]` rewrite. This is a concrete hypothesis to validate, not a confirmed solution for this non-Gatsby project.
- AI 3 posted routing investigation comment 6597711537 in #18. AI 1 should prove a minimal nested GET + POST route locally/Preview using either a supported splat file/rewrite or explicit thin route files before expanding to all 23 routes. Preserve path/query/method/body/cookies, ensure API never falls through to SPA HTML, and retain all auth/admin/financial gates. Do not overlap #14/#19 business logic.
- AI 2's 23-route exact-SHA matrix remains the independent acceptance requirement. No fix or deployment is claimed.


## AI 3 — latest Vercel deployment and build-failure checkpoint (2026-11-03)

### Build quota status changed

A fresh Vercel deployment inventory was read for project `btcboxcdt` under team `BOX`. This shows the earlier build-rate-limit state is no longer universal: recent deployments are being built and several older branch SHAs reached READY. Do not continue telling the owner that every branch is blocked by the old rate limit.

Recent examples:
- Sitewide branch READY: `e2ec958a1b65e44dac4e8eef07822f904aeaafe9` — deployment `dpl_8Eb17Zm6ChpsX3hUWbA9yHWuy35p`.
- Mobile trade branch READY: `cc5fb66045c8dcb3ce48ae74e272d035eee27ec2` — deployment `dpl_39X2orE6QD5GGbSn38RPebgoj1su`.
- Interaction branch READY: `9296737bf6b9495a036ea17480c07dc9f7f6fb59` — deployment `dpl_B1y7aXmyX6271LW8t778QkqxJFab`.
- Auth branch READY: `e914ebcf20de17a47bde6ac98686812f3ded6d4e` — deployment `dpl_3bWZfgbgTKwsd1RSanWiiU5FPtCc`.

These are not automatically current branch heads and do not constitute acceptance of the branch's latest source.

### Latest visual branch build is failing automated tests

- Latest listed visual deployment: `dpl_BjAJemqJq4i4BmDUxRRsvAkFH5xb`, source SHA `449e4b1a680397ebfa1deede855ce27eb079c25e`, branch `feature/ai1-visual-20261103`.
- Vercel build ran `npm run build && npm test`; site build completed, but test process exited 1.
- Test summary: 17 tests, 14 pass, 3 fail.
- Captured assertion detail in `tests/smoke.test.js` at the OAuth card geometry test: expected resolved `border-radius` `12px`, actual `14px`. Current `oauth/consent.html` uses `var(--radius-lg)`, and `assets/css/tokens.css` resolves `--radius-lg` to `--radius-large:14px`. The test expectation is inconsistent with the current shared token contract unless the frozen OAuth geometry is intentionally meant to stay at 12px. AI 1 must decide the intended design contract and update either the token mapping or test/explicit OAuth value consistently; do not simply loosen the test to green.
- Deployment error code is `BUILD_UTILS_SPAWN_1`, caused by the build command exiting 1, not a Vercel quota failure.

### Preview targeting rule

- Use the exact latest branch SHA for new visual/interaction acceptance. A READY deployment of an earlier SHA is useful only for checks explicitly tied to that earlier SHA.
- AI 1 should fix the visual branch test failure before relying on its Preview; AI 2 should retest the resulting exact SHA.
- The routing P0 remains unresolved: no dedicated routing-fix branch or exact-SHA 23-route Preview has been observed. Older READY previews do not satisfy #18.


### Fresh READY Preview route retest by AI 3

A new READY sitewide Preview was available, so AI 3 performed read-only GET checks against it:
- SHA `e2ec958a1b65e44dac4e8eef07822f904aeaafe9`, deployment `dpl_8Eb17Zm6ChpsX3hUWbA9yHWuy35p`, URL `https://btcboxcdt-pnlnsiv4x-box-2753.vercel.app`.
- `GET /api/market` returned HTTP 200 JSON.
- `GET /api/order/cancel`, `GET /api/seconds/positions`, and `GET /api/admin/stats` each returned HTTP 404 `text/plain` with Vercel `x-vercel-error: NOT_FOUND`.
- This is a fresh reproduction on a READY Preview, not a fix candidate or a full 23-route/method retest. AI 3 recorded the evidence in #18 comment 6597738707. No authenticated request or mutation was sent.

### Immediate owner actions

- AI 1 visual owner: resolve the OAuth card radius contract/test mismatch on visual deployment SHA `449e4b1a680397ebfa1deede855ce27eb079c25e`; the current build is ERROR because `npm run build && npm test` exits 1. Confirm whether OAuth geometry must remain 12px or the shared radius token is intentionally 14px, then make implementation and test agree.
- AI 1 API owner: create the isolated #18 routing fix branch and prove a nested route first. The quota appears available for some builds now, so prioritize a single routing Preview once the local fix is ready rather than waiting on the old rate-limit state.
- AI 2: use the fresh READY Preview only as a regression baseline. Do not report route PASS until all 23 paths and required methods are exercised against the exact routing-fix SHA.


## AI 3 — mobile-trade Preview regression checkpoint (2026-11-03)

Latest listed mobile-trade READY Preview was checked read-only:
- Branch `feature/ai1-mobile-pro-trade-20261103`
- SHA `cc5fb66045c8dcb3ce48ae74e272d035eee27ec2`
- Deployment `dpl_39X2orE6QD5GGbSn38RPebgoj1su`
- URL `https://btcboxcdt-hr37na95t-box-2753.vercel.app`

Observed:
- `GET /`: 200 HTML.
- `GET /api/market`: 200 JSON.
- `GET /api/kline?symbol=BTCUSDT&interval=1m`: 200 JSON.
- `GET /api/depth?symbol=BTCUSDT`: 200 JSON.
- `GET /api/order/cancel`: 404 plain text, Vercel `NOT_FOUND`.
- `GET /api/seconds/positions`: 404 plain text, Vercel `NOT_FOUND`.

This confirms public read-only market/kline/depth routing works on this Preview, but nested user endpoints still fail at the Vercel routing layer. The check was read-only; it did not send authenticated requests or financial mutations. AI 3 recorded this in #18 comment 6597770299.

### Latest implementation inventory

A fresh branch search still finds no dedicated `fix/api-routing-*` or equivalent routing-fix branch. AI 1's routing implementation handoff is therefore still outstanding. The visual branch's latest listed deployment remains ERROR on SHA `449e4b1a680397ebfa1deede855ce27eb079c25e`; the 12px-vs-14px OAuth geometry test contract remains unresolved in the available evidence. Do not mark either item complete based on other branch READY previews.


## AI 3 — implementation handoff escalation (2026-11-03)

A fresh branch and issue-comment inventory still shows no dedicated #18 routing-fix branch, no implementation handoff SHA, and no technical plan response from the implementation/QA roles in #18. The mobile-trade Preview's nested-route platform 404 regression remains reproduced (see #18 comment 6597770299).

AI 3 posted a focused handoff escalation in #18 (comment 6597785190): AI 1 must publish the isolated branch + exact HEAD SHA, chosen Vercel routing mechanism, changed-file list, minimal nested GET+POST regression result, and READY Preview URL. AI 2 must then test all 23 routes/methods on that exact SHA. #18 remains P0 / NOT ACCEPTED; #14/#19 shared `api/core.js` work remains sequenced behind the routing handoff. No merge or Production deployment is authorized.


## AI 3 — fresh #19 frontend adapter source recheck (2026-11-03)

Fetched `assets/js/app-core.js` again from `feature/ai1-sitewide-refinement-20261103`; current file blob SHA is `41f3e3ed6eeae69c4fa39d45f8518c9434bf0cda`. The `applyMarket()` `r.markets` loop still contains `if(market[sym]) return;`, so pre-initialized symbols remain skipped. AI 3 recorded this fresh source-level confirmation in #19 comment 6597806192. This is not a runtime test and does not establish the branch HEAD SHA.

This frontend-only adapter fix can proceed in parallel with #18 because it does not require editing `api/core.js`. AI 1 should implement symbol normalization, safe finite-value updates, preservation of valid existing optional fields, timestamp validation, and regression tests for both `data` and `markets[]` shapes. AI 2 must independently review the exact resulting SHA. #18 remains the first shared-backend-file task.


## AI 3 — fresh #14 registration source recheck (2026-11-03)

Fetched `api/core.js` from `fix/google-auth-registration-guard-20261103` again. The returned file blob SHA is `7c47df0ab23d4972c638375acf4ede08582d6e9a`. The `POST /api/register` implementation still creates local password accounts without calling Supabase Auth, explicitly says email confirmation is not required, and sets `email_verified: true`. The same blob was returned from `feature/ai1-sitewide-refinement-20261103`, so both branches currently expose the same unsafe handler content. This is source-level evidence, not a full branch HEAD or runtime claim.

AI 3 recorded the fresh evidence in Issue #14 comment 6597877697. AI 1 must fail-close unauthenticated direct registration and require server-side verification of Supabase access tokens / trusted OAuth identity before local account creation or linking. AI 2 must independently test direct-register rejection, invalid/expired tokens, valid fresh Google identity creation/linking, retry/idempotency, and guest-route preservation on the exact implementation SHA. No API mutation, merge, or deployment was performed.


## AI 3 — fresh cross-branch and Vercel inventory (2026-11-03)

### #19 market adapter candidate located, not yet accepted

A fresh source comparison found two different implementations:

- AI 1 branch `feature/ai1-sitewide-refinement-20261103`, `assets/js/app-core.js` blob `41f3e3ed6eeae69c4fa39d45f8518c9434bf0cda`: the `markets[]` loop still skips existing symbols via `if(market[sym]) return;`.
- Interaction branch `fix/interaction-account-hydration-20261103`, `assets/js/app-core.js` blob `4aaea9dd691310999a3ca91366c53b813fc0b14e`: contains a candidate merge/update implementation for existing and new symbols, finite numeric checks, and preservation of prior values when optional fields are absent/invalid.

The Interaction branch smoke tests include spot/seconds transport-UNKNOWN guards, but no explicit `applyMarket()` regression test was found for initialized symbols, both response shapes, malformed/unknown symbols, or timestamps. This candidate therefore does not satisfy #19 acceptance yet. AI 3 recorded the cross-branch evidence in #19 comment 6597963277. AI 1 should reconcile the candidate into the #19-owned implementation branch or explicitly coordinate a file-owner handoff; AI 2 must independently test the exact SHA.

### Current deployment snapshot

Vercel team context resolved the correct owning team as `BOX` / `box-2753`, team ID `team_tnwJkMYPnWK2BjBGf3Q2n3FB`. Deployment history is now readable with this team ID.

Relevant records in the current deployment inventory:
- Interaction branch latest listed deployment is ERROR on documentation commit `aad6f9a4ccb1b0b7076a31e9a5a61505ce9bee0a` (`Request spot order reconciliation contract`). The preceding code deployment `58cde7542fe8fe4c4eef0669939a41a8d148e7b1` is READY, but its smoke suite still lacks #19 adapter coverage.
- Sitewide branch latest listed READY Preview remains `e2ec958a1b65e44dac4e8eef07822f904aeaafe9`; previous read-only tests on it reproduced nested-route platform 404s.
- Mobile-trade branch latest listed READY Preview remains `cc5fb66045c8dcb3ce48ae74e272d035eee27ec2`; previous read-only tests reproduced nested-route platform 404s.
- Visual branch latest listed deployment remains ERROR on `449e4b1a680397ebfa1deede855ce27eb079c25e`.

No dedicated #18 routing-fix branch appears in the current branch inventory. #18 remains P0 / NOT ACCEPTED. #14 remains P0 unresolved: `api/core.js` blob `7c47df0ab23d4972c638375acf4ede08582d6e9a` still allows direct local registration and marks the email verified. Do not merge or deploy based on unrelated READY Preview records.

No merge, Production deployment, environment-variable change, financial mutation, or database mutation was performed in this checkpoint.


## AI 3 — deployment quota and candidate-build policy (owner instruction, 2026-11-03)

The project owner has directed all teams to avoid deploying active development branches unless deployment is necessary. This is now the default coordination policy:

1. **No deployment for routine commits.** Documentation, refactors, isolated UI changes, and ordinary branch updates must not trigger Preview or Production deployments merely to show progress.
2. **Local validation first.** Run focused unit/smoke tests, static checks, and a production build locally where available. Record exact commit SHA, commands, and outcomes.
3. **Batch Preview use.** Request one Preview only when a coherent candidate has passed local checks and a live deployment is required to validate routing, OAuth callback, browser behavior, or integrated runtime behavior.
4. **Exact-SHA QA.** AI 2 tests the same candidate SHA selected for Preview; do not test a moving branch head or infer acceptance from a different deployment.
5. **No Production deploy without owner approval.** Production deployment, environment-variable changes, and financial cutover remain separately gated.
6. **Do not disable required checks to save quota.** The goal is fewer unnecessary deployments, not bypassing build/test gates.

AI 3 will coordinate a candidate-build queue so related fixes are grouped where ownership and dependencies allow. Keep #18 as the first shared `api/core.js` routing task; do not overlap #14/#19 backend edits. The #19 frontend adapter may proceed independently because it touches `assets/js/app-core.js`, but it still needs focused regression coverage before being selected for a Preview.

Current branch inventory still contains no dedicated #18 routing-fix branch. Latest source evidence remains: #14 direct registration bypass in `api/core.js` blob `7c47df0ab23d4972c638375acf4ede08582d6e9a`; #19 AI 1 adapter defect in `assets/js/app-core.js` blob `41f3e3ed6eeae69c4fa39d45f8518c9434bf0cda`; Interaction candidate adapter blob `4aaea9dd691310999a3ca91366c53b813fc0b14e` lacks issue-specific tests. No merge or deployment was performed.


### AI 3 — #19 candidate adapter validation gaps (2026-11-03)

A full read of Interaction branch `assets/js/app-core.js` blob `4aaea9dd691310999a3ca91366c53b813fc0b14e` found remaining gaps despite its improvement over AI 1's current `markets[]` branch:

- Symbol normalization appends `USDT` and uses `replace('USDT','')` without strict supported-symbol validation.
- `d.ts`, `m.ts`, and `r.ts` are assigned directly when non-null; malformed timestamps can overwrite prior valid timestamps.
- New symbols are initialized with zero-valued fields before validation; malformed records could create misleading market entries.
- No direct `applyMarket()` tests were found for both payload shapes, existing/new symbols, malformed symbols, numeric edge cases, and timestamps.

AI 3 recorded these concrete acceptance gaps in #19 comment 6598017592. This remains a candidate only; no runtime PASS is claimed. Implementation owner should close the gaps with focused tests before selecting a batched Preview candidate.


## AI 3 — current develop base recheck (2026-11-03)

A fresh source inspection was performed against `develop` SHA `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`:

- `vercel.json` blob `48fa8a997e2bb91088f05de80cfc6015728851b4` declares `api/[...path].js` as the function and contains no explicit API rewrite; the SPA rewrite excludes `api/`.
- `api/[...path].js` blob `a1dc53a1a52b782a9c3165dca3cfdcc354797140` reads the body and forwards URL pathname, HTTP method, query parameters and headers into the shared handler.
- `package.json` defines `npm test` (`node --test tests/*.test.js`), `npm run build` (`node scripts/build-site.js`), and `npm run preflight`.

This is consistent with the observed Vercel platform `NOT_FOUND` occurring before application route dispatch, but does not establish the correct Vercel routing syntax. AI 3 recorded this fresh evidence in #18 comment 6598093893. Required minimal proof remains one nested GET and one nested POST reaching the adapter with request data intact, followed by local tests/build and exact-SHA QA.

A fresh `develop` read also confirms #14 is present on the integration base: `api/core.js` blob `7c47df0ab23d4972c638375acf4ede08582d6e9a` still creates local password accounts directly, skips Supabase Auth signup, sets `email_verified: true`, and returns `email_confirmation_required: false`. This source-level confirmation was recorded in #14 comment 6598091774.

No branch implementation, merge, Preview/Production deployment, environment-variable update, or financial/database mutation was performed in this checkpoint.


## AI 3 — latest coordination checkpoint (2026-11-03)

A fresh GitHub inventory was checked before continuing work:

- The shared coordination file is still the canonical entry point on `chore/shared-ai-coordination`; the pre-checkpoint file blob was `f1da7e4597bbdf70428d9981e5eb678f877be3e4`.
- The repository branch inventory still contains no dedicated `fix/*routing*` or equivalent #18 implementation branch.
- The current open PR search returned only PR #15 (auth UI) and PR #16 (coordination documentation); there is no #18 routing-fix PR and no new implementation PR for #14 or #19.
- The latest issue timelines contain no AI 1 implementation handoff or AI 2 exact-SHA acceptance report after the coordinator's previous requests. Existing findings therefore remain open; silence is not acceptance.
- #18 remains the first shared `api/core.js` task. #14 must not start overlapping edits until #18 hands off that file. #19's frontend adapter may proceed independently, but its candidate still needs the strict symbol/timestamp/initialization checks and direct regression tests already recorded above.
- #17 remains a financial-readiness blocker. Do not enable financial flags or represent deposits, withdrawals, spot orders, seconds contracts, or earn as operational without the documented schema/RPC/ledger/matching and non-production lifecycle evidence.
- No merge, deployment, production configuration change, financial cutover, or database mutation was performed in this checkpoint.

### Immediate owner handoff

- **AI 1:** publish the isolated #18 branch + full HEAD SHA, chosen routing mechanism, changed-file list, minimal nested GET/POST evidence, and local `npm test` / `npm run build` output. Keep #14 and #19 backend changes out of this patch.
- **AI 2:** once AI 1 supplies that exact SHA, independently execute the 23-route/method matrix and report exact response status/content type. Do not mark a source-only inspection as runtime PASS.
- **AI 3:** keep the queue ordered, verify the handoff and test evidence, and prevent overlapping ownership. No Preview should be requested until local gates pass and a live routing check is necessary.


## AI 3 — follow-up live inventory and #19 candidate recheck (2026-11-03)

Fresh branch/PR inventory after the previous checkpoint:

- Branches still include no dedicated #18 routing-fix branch.
- Open PR search still returns only #15 (auth UI) and #16 (coordination documentation); no routing implementation PR and no new #14/#19 implementation PR.
- `develop` remains at `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`.
- AI 1 sitewide branch remains 77 commits ahead of develop in the compare result; Interaction branch remains 138 commits ahead; these are branch-relative counts, not acceptance evidence or permission to merge.
- The Interaction #19 candidate remains `assets/js/app-core.js` blob `4aaea9dd691310999a3ca91366c53b813fc0b14e`; its current `tests/smoke.test.js` blob is `6f840830663891580f5a8f2e48db13c85bd8316c`.
- Direct re-read confirms the candidate fixes the initialized-symbol early-return defect, but strict symbol validation, timestamp validation, pre-validation new-symbol initialization, and direct applyMarket regression coverage remain incomplete. Details and owner handoff were recorded in #19 comment 6598216707.
- #18 still has no implementation branch or exact-SHA handoff. #14 remains sequenced after #18 because both touch `api/core.js`.

No code branch was changed, no tests were claimed as run, and no merge, Preview/Production deployment, production setting, financial cutover, or database mutation occurred.


## AI 3 — #17 seconds UI hydration and cutover-state review (2026-11-03)

Fresh source-level review of the Interaction candidate identified a concrete seconds-contract UI gap:

- `assets/js/views-trading.js` blob `48621e97506f3fceec9c1598d5f3c7a2323ad814`: `VIEWS.seconds.afterRender` derives its local `busy` guard from cached `state.secondsPositions.open`, renders the list, and does not fetch authoritative positions on route entry.
- `assets/js/app-core.js` blob `4e7f6b2f11a33c1c93dd0ebeb3c47bdebfe536b3`: `apiAdapter.secondsPositionsGet()` exists and updates the cache; it is called after successful placement, but the view-entry path does not call it.
- `api/core.js` on develop blob `7c47df0ab23d4972c638375acf4ede08582d6e9a`: when financial cutover is disabled, authenticated `GET /api/seconds/positions` returns HTTP 200 with empty arrays, `cutover_incomplete: true`, and an unavailable message.
- The current seconds view does not inspect `cutover_incomplete` or display that backend message. This can present an ordinary empty state and active order controls while the feature is not ready; stale cache can also fail to represent a server-side open position.

Finding and required owner handoff recorded in #17 comment 6598239435. Required remediation: fetch authoritative positions on entry; keep order controls disabled while loading or on unknown/error; render explicit unavailable state and disable controls when `cutover_incomplete`; add targeted tests for fresh open-position hydration, fetch failure, cutover-incomplete, and enabled state only after a successful authoritative response.

This is static source evidence, not runtime validation. No financial flags were changed and no financial mutation was performed.


## AI 3 — whole-site first-impression / visual-quality gate (2026-11-03)

The project owner explicitly emphasized that overall page presentation is a top priority: hierarchy, typography/copy, buttons, spacing, alignment, and the first impression must be strong before functional depth is considered complete.

Created **Issue #20 — P1 Whole-site visual quality gate**:
https://github.com/avali9308-code/btcboxcdt/issues/20

This is a release-level acceptance requirement, starting from the unauthenticated guest landing page and following the full site journey. Scope includes visual hierarchy, typography and wording consistency, button/control hierarchy and tap targets, page gutters/card/form/table alignment, responsive behavior at 320/360/375/390/430px, guest/authenticated and loading/empty/error/unavailable states, and cross-page consistency.

Required evidence:
- AI 1: page-by-page audit, exact branch HEAD SHA, changed-file list, desktop/mobile before-after screenshots, and concrete corrections.
- AI 2: independent same-SHA review with page/viewport/state-specific PASS/FAIL evidence.
- AI 3: coordinate coverage and owner boundaries; no cosmetic “looks good” claims without evidence.
- Static CSS inspection alone is not visual acceptance. Avoid routine deployments; use local/browser evidence first and batch Preview only if necessary after local gates pass.
- A page fails if its first viewport has unclear hierarchy, inconsistent typography, crowded/misaligned controls, poor spacing, awkward copy, broken responsive layout, or obvious inconsistency, even when the functions work.

No production deployment or merge is authorized by this visual-quality task.


### Initial guest-home source review notes

Initial static inspection of AI 1's sitewide branch identified review targets recorded in #20 comment 6598286671:

- Guest hero currently exposes four links/actions (Explore trading, View markets, Log in, Create account). Verify the rendered hierarchy and mobile wrapping; avoid four competing actions and keep the guest's primary next step unmistakable.
- Home metrics hard-code “Trading services 2 / Spot and seconds access” while the current backend reports seconds financial cutover incomplete. Do not market a gated feature as currently available; reflect its actual preview/unavailable status.
- Validate hero/metrics spacing against shared page gutters and adjacent sections at mobile widths using screenshots/browser evidence.

Source refs: `views-home.js` blob `f19333cc62c3e2076f70efcc0c5a6a437c0944e7`; `views.css` blob `3a4a865dfb12c73988ec4bd7fdd3658fb786b767`; `tokens.css` blob `8e31b58af7a583d02aba9c21db3b3c00353db147`. This is static inspection, not a rendered visual pass.


## User-directed engineering rule — benchmark repeatedly and reuse proven code (2026-11-03)

The project owner has explicitly directed all AI teams and the coordinator to:
- Compare BTCBOX repeatedly against the previous BTCBOX candidate and mature market references, especially Binance's task flows and page composition. Do not use a single comparison or internal-only standards; repeat the comparison after implementation and require independent same-SHA review.
- Prefer adopting mature, proven, legally usable open-source code/components when they materially improve quality, rather than reinventing everything. Inspect the current implementation first and avoid duplicate libraries.
- Verify upstream maintainer, release activity, security posture, compatibility, dependency footprint, license and attribution before copying/adopting. Prefer clear permissive licenses such as Apache-2.0/MIT/BSD subject to their exact terms; preserve notices. Never copy proprietary Binance source/assets or proprietary TradingView Advanced Charts/Trading Platform code.
- Pin versions and record upstream URL, version/commit, license/notice, files adopted, integration reason, test plan, and adopt/adapt/keep/reject decision.
- Use actual rendered BTCBOX screenshots and real route/state behavior for visual comparison. No screenshots, runtime tests or builds may be claimed unless actually performed.

Verified existing chart baseline at the time of this update: `develop` `index.html` blob `fde3e06380aa837fb586e5ef9bf8d528af9b80d7` already loads Apache ECharts 5.5.0; `assets/js/views-trade.js` blob `c19337bce6555225c66b555d07787974c1092d48` already implements candlestick + volume via ECharts. First assess and improve this integration before considering a replacement. TradingView Lightweight Charts is a legitimate Apache-2.0 candidate but requires the TradingView attribution notice/link and must be justified by measured benefit.

Official reference pages currently recorded in Issue #20: Binance Spot workspace guide; Apache ECharts license/upstream; TradingView Lightweight Charts license/upstream. This is a product/engineering benchmark, not permission to claim BTCBOX has Binance's liquidity or unsupported order types.

Applies to AI 1 implementation, AI 2 independent review, AI 3 business/coordination and all future task handoffs. This rule does not relax financial/security gates, file ownership, exact-SHA acceptance, or deployment approval requirements.

---

## AI 1 — mandatory shared-coordination acknowledgement and active task checkpoint (2026-11-03 17:21 +08:00)

### Read-before-work acknowledgement
- Canonical entry point read first on `chore/shared-ai-coordination`.
- Exact coordination file blob SHA read: `9dd0e96cf3bf756bfe18e5da366b1de5837b155f`.
- This checkpoint supersedes reliance on prior chat summaries. All subsequent work must repeat this read and record the new blob SHA before task intake or edits.
- Identity: **AI 1 — implementation and code repair**. AI 2 retains independent QA and interaction acceptance; AI 3 retains business integration, task sequencing and cross-team handoff.

### AI 1 current assignment
- **Primary active task:** Issue #18 / PR #23 — P0 nested Vercel API route recovery.
- **Implementation owner:** AI 1.
- **Independent reviewer:** AI 2.
- **Coordinator / API contract:** AI 3.
- **Integration base:** `develop` at `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`.
- **Implementation branch:** `fix/ai1-vercel-api-routing-20261103`.
- **Exact current candidate HEAD:** `64486e7da39bf1195416a150331520671aabb2c8`.
- **Compare:** 5 commits ahead, 0 behind; 27 changed paths (23 explicit nested route wrappers, shared `api-adapter.js`, catch-all route, `vercel.json`, and `tests/api-routing.test.js`).
- **Allowed files for this task:** only the 23 route entrypoint files, `api-adapter.js`, `api/[...path].js`, `vercel.json`, and `tests/api-routing.test.js`. Do not edit `api/core.js`, auth UI, market adapter, trading views, financial logic, or AI 2-owned interaction files under this task.
- **Current status:** source review PASS on earlier SHA `664723ad9098e83f79fbd5474013ea0fe27bc909`; AI 2 re-review of the additional Readable-stream tests on `64486e7...` is pending. Runtime acceptance remains NOT TESTED.

### Exact evidence and blockers
- Added explicit wrappers for all 23 documented nested user/admin endpoints; each delegates to the shared adapter. Catch-all remains.
- Added real `node:stream.Readable` request-body consumption coverage and an over-1-MiB body rejection assertion in `tests/api-routing.test.js`.
- **Local focused routing test:** NOT RUN.
- **Local `npm test`:** NOT RUN.
- **Local `npm run build`:** NOT RUN.
- **GitHub Actions on exact routing SHA `64486e7...`:** NOT RUN / no run returned. PR #22's trigger correction is AI 2 approved and passed its own exact-SHA run, but remains draft/unmerged and is not on `develop`; its result does not transfer to PR #23.
- **Vercel Preview / live nested route matrix:** NOT TESTED; Vercel reported the free daily deployment quota limit.
- No merge, deployment, production configuration change, database mutation or financial action performed.

### Cross-team task boundaries and current queue
1. **#18 / PR #23 (AI 1):** finish exact-SHA source handoff; AI 2 re-reviews the new stream tests; wait for AI 3 / project owner sequencing of PR #22 before relying on the baseline CI trigger. Do not merge.
2. **#15 / PR #26 (AI 2):** account hydration and safe OAuth return-path repair is owned by AI 2 on branch `fix/ai2-google-auth-hydration-20261103`, exact HEAD `aed53db4d2857e1f6d66fdc1facb6e7e26e49a11`. AI 1 will not edit its files or branch. PR #15 Google-only source correction at `f061e2de438f531f1b75d48c00bcae87e0518cfc` had source-level PASS, but complete auth acceptance remains BLOCKED by #14 and browser E2E NOT TESTED.
3. **#14 (backend identity boundary):** remains P0 unresolved. Do not edit shared `api/core.js` until #18 has a documented handoff and AI 3 explicitly sequences the #14 owner. Direct unauthenticated registration and non-Google provider boundary remain blockers.
4. **#19 (market data):** separate follow-up after #18 sequencing. AI 2 has reproduced stale market-response overwrite on AI 1's prior adapter candidate; correction needs timestamp-monotonic merge and focused regression tests. Do not fold into PR #23 or modify overlapping files without a new task assignment and branch.
5. **#17 / PR #25 (Seconds interaction):** AI 2 owns the view-level loading/unavailable/UNKNOWN entry states. AI 1's adapter contract questions are recorded in PR #25; no AI 2-owned view file will be edited by AI 1. Any adapter change requires a separate coordinated task and AI 3 confirmation of the server response/idempotency contract.
6. **#20 visual gate:** retain as P1 release requirement. Defer broad visual changes until P0 routing and identity blockers are sequenced; do not claim visual acceptance without rendered same-SHA evidence.

### Immediate handoffs
- **AI 2:** re-review PR #23 exact HEAD `64486e7da39bf1195416a150331520671aabb2c8`, specifically the real Readable-stream and 1 MiB rejection tests; retain runtime route matrix as NOT TESTED until a matching Preview exists.
- **AI 3:** confirm sequencing for PR #22's approved but unmerged CI trigger fix and the #18 → #14 shared `api/core.js` handoff. Clarify the #19 market freshness owner after #18.
- **AI 1:** keep PR #23 isolated, do not edit overlapping AI 2 files, and provide only exact-SHA evidence. If local checkout or Preview quota remains unavailable, keep the affected tests explicitly NOT TESTED.

This entry records AI 1's acknowledgement and task state; it is not a merge, approval, runtime acceptance, or deployment authorization.


---

## AI 1 — continuation checkpoint: Issue #18 / PR #23 (2026-11-03)

### Read-before-work and live-state recheck
- Re-read canonical file on `chore/shared-ai-coordination` before continuing; blob SHA: `a948c83bdda1791170afd06e83170de36cdbd97c`.
- Identity / role: **AI 1 — implementation and code repair**. AI 2 remains independent QA; AI 3 remains integration coordinator.
- Live `develop` HEAD remains `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`.
- Live routing branch `fix/ai1-vercel-api-routing-20261103` HEAD remains `64486e7da39bf1195416a150331520671aabb2c8`.
- PR #23 remains OPEN + DRAFT, base `develop`, 5 commits, 27 changed files; not merged.
- PR #22 remains OPEN + DRAFT and unmerged. Its CI-trigger correction is therefore not present on `develop`.

### New exact-SHA review / CI status
- AI 2 re-review of PR #23 exact HEAD `64486e7da39bf1195416a150331520671aabb2c8` is recorded in PR #23 comment `6599923130`: **SOURCE REVIEW PASS** for the added real Node Readable body test and 1 MiB rejection test.
- GitHub Actions for exact SHA `64486e7da39bf1195416a150331520671aabb2c8`: **NOT RUN**; fetch returned no PR-triggered workflow runs.
- Exact-SHA Vercel status: **FAILURE / rate limited**, message says retry in 24 hours; no READY Preview exists. This is a deployment quota failure, not an application test failure.
- Local focused test, `npm test`, `npm run build`: **NOT RUN**. The current execution environment still has no checked-out repository shell; earlier clone attempt failed due GitHub DNS resolution.
- Live nested route matrix (23 routes, methods, status/content-type, safe GET/OPTIONS/POST behavior): **NOT TESTED**.
- No new code files changed in this continuation checkpoint.

### Decision and handoff
- The source-test gap raised by AI 2 has been addressed and re-reviewed at the exact current HEAD.
- PR #23 remains **NOT ACCEPTED / runtime validation pending** until exact-SHA automated test/build evidence and a matching Preview route check are available.
- AI 1 must not merge PR #22 merely to enable CI: PR #22 is still draft/unmerged and owner approval remains required. No workflow bypass, Production deployment, or quota-consuming manual deployment was attempted.
- Next action: preserve PR #23 unchanged; request the project owner's approved sequencing for PR #22 / CI trigger, and run exact-SHA tests in an available checkout/CI environment. After CI passes and Preview quota allows one targeted Preview, AI 2 performs the route matrix.
- #14 remains sequenced after #18 because of shared `api/core.js`; #19 and #17 remain separate owner scopes. No changes to `api/core.js`, auth, market, views, database, financial logic or production settings.

This checkpoint updates evidence only. It does not grant merge/deployment approval or claim runtime acceptance.


---

## AI 1 — continuation checkpoint: Issue #18 exact-SHA evidence refresh (2026-11-03)

### Read-before-work
- Re-read canonical `docs/AI_COORDINATION.md` on `chore/shared-ai-coordination` before continuing.
- Coordination file blob SHA read for this checkpoint: `8ead3985e98ab15db47db2db47fa1cef2980ea1f`.
- Active assignment remains Issue #18 / PR #23, P0 nested Vercel API route recovery. No new task was started.

### Fresh exact-SHA status
- Routing branch: `fix/ai1-vercel-api-routing-20261103`.
- Candidate HEAD: `64486e7da39bf1195416a150331520671aabb2c8` (unchanged).
- AI 2's latest exact-SHA re-review comment `6599923130` confirms **SOURCE REVIEW PASS** for the Node `Readable` stream body-forwarding and 1 MiB oversize-body rejection tests.
- GitHub Actions queried for the exact candidate SHA: **NOT RUN**; no PR-triggered workflow runs returned.
- Vercel Preview remains blocked by the free daily deployment quota (latest observed Vercel bot message: retry in 24 hours). No READY Preview is available.
- Local focused test, `npm test`, and `npm run build`: **NOT RUN**.
- Live nested route/method/status/content-type matrix: **NOT TESTED**.
- PR #23 remains OPEN + DRAFT and unmerged. PR #22's workflow-trigger correction remains unmerged; its own successful run does not count as evidence for this candidate SHA.

### Disposition and next handoff
- Source review of the added test coverage is complete; overall routing acceptance remains **NOT ACCEPTED** until exact-SHA build/test evidence and matching Preview runtime verification are available.
- Keep PR #23 isolated and unchanged. Do not merge PR #22 to activate CI, bypass workflow checks, or attempt another quota-consuming deployment without project-owner sequencing/approval.
- After CI is available, run the full suite/build on the exact routing SHA; when Preview quota permits, AI 2 should verify at minimum `GET /api/healthz`, a safe nested GET, and OPTIONS preflight before the full 23-route matrix.
- No production deployment/configuration changes, database mutations, financial cutover, or real trading actions were performed.

This is a status/evidence update only, not runtime acceptance or release approval.


---

## AI 3 — live coordination checkpoint (2026-11-03, latest Git recheck)

### Canonical read and live refs
- Re-read this file from `chore/shared-ai-coordination`; current file blob SHA at checkpoint start: `7479bdef181beb96cc9ba96e76a0dec7522bc4fb`.
- Live branch heads:
  - `develop`: `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`
  - `chore/shared-ai-coordination`: `b56f3cc3a7cf66bc7bff01e21af13556b048df98`
  - AI 1 routing: `fix/ai1-vercel-api-routing-20261103` @ `64486e7da39bf1195416a150331520671aabb2c8`
  - AI 1 market adapter: `fix/ai1-market-adapter-20261103` @ `99e7033fa3fd720ee34cec57d8d791c22ec589e2`
  - AI 2 auth hydration: `fix/ai2-google-auth-hydration-20261103` @ `8015fe3aa3385eb957580c3cdd857367d1a4a9cd`
  - AI 2 Seconds gate: `fix/ai2-seconds-entry-gate-20261103` @ `f3381d1b3e18c945ee35a162c117dda269aaeb71`
  - AI 2 support/withdrawal interaction: `fix/ai2-assets-account-interaction-20261103` @ `f73a7c131810f5f13c7c27219c371f8bc43406e0`
  - CI trigger isolated: `fix/ci-develop-pr-trigger-isolated-20261103` @ `a90b165325799bf24cdea6fd38dedf39ca927533`
- Open implementation PRs include #22, #23, #25, #26 and #27. None is authorized to merge by this checkpoint.

### Alignment evidence
- AI 1's last explicit shared-file SHA acknowledgement found in the GitHub record cites blob `9dd0e96cf3bf756bfe18e5da366b1de5837b155f`, which is older than the current blob above. AI 1's latest task checkpoint records later work, but does not explicitly acknowledge this current blob SHA.
- AI 2 has posted current branch/PR work and exact-SHA QA findings, but no explicit acknowledgement of the current canonical blob SHA was found in the latest #16 thread review.
- Therefore current work is visible in GitHub, but **latest-file read acknowledgement is still outstanding for both AI 1 and AI 2**. A branch update is not proof of reading the current coordination file.

### Coordinator sequencing and actions required
1. **#18 / PR #23 remains P0, source review only / runtime NOT ACCEPTED.** AI 2's source re-review of the Node Readable stream and 1 MiB rejection tests is recorded. Exact candidate `64486e7...` still has no matching Actions run, local focused/full tests or build output, and no matching Preview route matrix. AI 1 should use the existing `workflow_dispatch` path to run the baseline workflow against the exact routing branch/SHA if the repository workflow supports it; attach run URL, exact checked-out SHA, `npm test`, and `npm run build` output. Do not consume another Vercel deployment while quota is blocked.
2. **#22 CI trigger correction:** AI 2 approved the one-line change at exact SHA `a90b165325799bf24cdea6fd38dedf39ca927533`; Actions run `41606129955` passed (17/17 tests and build). PR #22 remains draft/open/unmerged. It is not part of `develop`; do not merge without project-owner approval.
3. **#14 identity boundary:** remains P0 and must follow #18's `api/core.js` handoff. The integration base still contains public local `POST /api/register` account creation and falsely marks email verified; no separate backend fix PR is present. Do not start concurrent `api/core.js` edits.
4. **#19 market freshness:** AI 1 candidate `99e7033...` has six focused isolated assertions, but AI 2 reproduced an older valid quote overwriting a newer quote. Reject stale per-symbol timestamps and add old-after-new, equal-time and partial multi-symbol tests before AI 2 retest. API persistence-independence remains a separate `api/core.js` concern, sequenced after #14.
5. **#25 / #26 / #27 Interaction PRs:** record their exact-SHA Actions results and remaining browser/runtime gaps in their PRs. PR #25 reports 20/20 tests/build on its implementation SHA but browser/mobile E2E remains NOT TESTED; PR #26 reports syntax/targeted source assertions only, full suite and browser OAuth E2E NOT TESTED; PR #27 reports 22/22 tests/build on source SHA `10bbebd...`, but browser/device QA NOT RUN and durable withdrawal status lookup still needs coordinator/API contract.
6. **#17 financial cutover and #20 whole-site visual quality remain release blockers/gates.** No production environment change, financial cutover, merge, Production deploy, or financial mutation is authorized.

This checkpoint is a coordination record, not implementation acceptance, merge approval, or runtime verification.


---

## AI 1 — continuation checkpoint: workflow trigger capability and exact-SHA recheck (2026-11-03)

### Mandatory read-before-work
- Re-read canonical `docs/AI_COORDINATION.md` on `chore/shared-ai-coordination` before continuing.
- Coordination file blob SHA read: `721383b555c84a93ed691dd9516e5d10be9fde3f`.
- Active task remains Issue #18 / PR #23; candidate SHA remains `64486e7da39bf1195416a150331520671aabb2c8`.

### Fresh verification
- Re-queried GitHub Actions runs for exact candidate SHA `64486e7da39bf1195416a150331520671aabb2c8`: no PR-triggered workflow runs returned (**NOT RUN**).
- Rechecked PR #23 discussion: AI 2's comment `6599923130` confirms **SOURCE REVIEW PASS** for the added Node Readable stream-forwarding and 1 MiB rejection tests. No newer exact-SHA runtime/test evidence was found.
- Vercel Preview remains quota-blocked according to the latest recorded Vercel deployment failure; no matching READY Preview or route matrix evidence exists.
- The available GitHub integration actions expose workflow-run lookup and rerun operations, but no workflow-dispatch action. Therefore AI 1 could not invoke the coordinator-suggested `workflow_dispatch` from this execution environment. No dispatch was simulated or claimed.
- Local focused test, `npm test`, `npm run build`: **NOT RUN**. Live 23-route matrix: **NOT TESTED**.

### Next action / disposition
- Keep PR #23 isolated and unchanged. Overall status remains **NOT ACCEPTED — runtime/build evidence pending**.
- AI 3 / project owner: provide an approved CI trigger path (e.g. activate the existing workflow dispatch through GitHub UI or approved workflow trigger sequencing) for exact SHA `64486e7...`; do not infer success from PR #22's separate run.
- Once exact-SHA CI is available, record the workflow URL, checked-out SHA, complete `npm test` and `npm run build` output. After Vercel quota permits, AI 2 must verify a matching Preview and route behavior.
- No merge, deployment, production configuration change, database mutation, financial cutover, or real trading action was performed.

This checkpoint records a capability blocker and evidence state only; it is not runtime acceptance or release approval.


---

## AI 3 — continuation checkpoint: Seconds invariant repair opened (2026-11-03)

### Live state and ownership
- Role: **AI 3 — business integration and coordination**. Re-read this canonical file before acting; blob SHA at checkpoint start: `b2dae39d7887b7d31ba85fb0e63baf69cb5a8b9f`.
- Base `develop` remains `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f` at the time of this check.
- AI 3 created draft PR #29: `fix/ai3-seconds-one-open-position-20261103`, current head `33bb6126275943791d519d016bb0a9ea9f7e41a6`, base `develop`.
- PR #29 changes only the SQL runner, standalone Seconds SQL patch, and migration-order documentation; it does not edit `api/core.js`, AI 1's routing files, or AI 2's view files.

### Finding and repair proposal
- On `develop`, `supabase/sql/financial_seconds_contracts_v1.sql` blob `df0a5173a09778eb7da978b5359a5cba6d940adf`, `submit_seconds_order_v1` had no database-level one-open-position invariant.
- Read-only query on Supabase project `zlozsutefnmgwwzrlipt`: `seconds_contract_positions` exists, currently has 0 rows, 0 users with multiple open positions, and 0 partial indexes enforcing the rule.
- PR #29 adds a partial unique index on `user_id WHERE status='open'`, fails closed if existing duplicate open positions are found, and maps that exact conflict to `OPEN_POSITION_EXISTS`.
- No SQL was applied to production; no flags, balances, positions, or financial operations were changed.

### Required validation / coordination
- PR #29 is **DRAFT / NOT ACCEPTED**. PostgreSQL migration execution, SQL runner validation, and concurrency tests are **NOT RUN**.
- AI 2 has been asked to independently test in staging: concurrent distinct request IDs, same-request replay, conflicting replay, and reopen-after-settlement. No production writes for tests.
- AI 1 has been notified to review API error mapping when sequencing permits. Current `api/core.js` appears to map unsuccessful Seconds RPC results to generic `FINANCIAL_RPC_FAILED`; exposing `OPEN_POSITION_EXISTS` clearly needs a separately coordinated API follow-up and must not overlap PR #23 / #14 ownership.
- Keep financial cutover disabled. Do not merge or deploy until exact-SHA QA evidence exists.

This checkpoint records an isolated draft repair and read-only evidence; it is not database application, runtime acceptance, or release approval.


---

## AI 3 — workload handoff and validation checkpoint (2026-11-03)

- Role remains **AI 3 — business integration and coordination**. Canonical file read before work; source blob at this checkpoint: `d492014c58bcea6c81ae4547bc62147401ec12b5`.
- AI 2 has not completed the requested handoff inventory for PRs #25–#28 and has continued pushing to PR #28. AI 3 preserves all existing AI 2 commits and will not overwrite their active branch.
- PR #29 current AI 3 branch head: `c2ccb3c7554a55d211d6582f4b07598b54d0c0e9`. Added `tests/seconds-one-open-position-migration.test.js` (source-level assertions only). No Actions run is returned for this exact SHA.
- CI trigger blocker confirmed in `.github/workflows/baseline.yml` on `develop`: `pull_request.branches` includes only `main` and `feature/uiux-upgrade`; push filters omit the AI 3 branch. PR #29 targets `develop`, so its exact-SHA baseline is not automatically triggered. Do not claim test pass. Owner/operator must use the existing workflow_dispatch for the exact SHA or approve a scoped CI trigger correction.
- PR #28 newest observed Actions: run `41616627774` on `de329ffb9588d5ff79e9d79e632adbfb76fedf7c` was in progress at checkpoint; run `41616665392` on `dc8b25029d3aea13a3f85dbc0819a32b1444a9b6` queued. Prior tested SHA `abffdd5631c18290ce22b1b0acfd62cb7aab41e9` failed 4/28 smoke tests. Do not treat later runs as passed until completed and checked.
- PR #29 staging PostgreSQL migration, concurrent distinct-request test, same-request replay, conflicting replay, reopen-after-settlement, and API error mapping: **NOT RUN / NOT VERIFIED**.
- PR #27 still lacks authenticated read-only withdrawal lookup by original request ID; keep UNKNOWN locked and do not generate a new retry key. No API edit made because `api/core.js` remains in the active P0 routing / registration sequence.
- No merge, deployment, production SQL, production config change, or financial operation performed.
- Acceptance remains pending exact-SHA CI, independent review, staging validation, and API contract alignment.

This checkpoint records current evidence and blockers only; it is not acceptance or release approval.


---

## AI 3 — latest CI recheck (2026-11-03 10:09 UTC)

- PR #28 active branch head: `70f4a7152311ae13c086aa4d4dd3f6108b42f9eb`; AI 2 continues to push, so AI 3 preserves the branch and does not overwrite it before handoff.
- Latest completed Actions run #41616665392 tested prior SHA `dc8b25029d3aea13a3f85dbc0819a32b1444a9b6`: build PASS, smoke tests FAIL. The previous syntax and terms-consent failures are no longer in the latest failure list. Remaining failures: optional server-side Google OAuth 2FA challenge assertion; missing Earn product `flex_USDT`.
- Latest head `70f4a715...` has no completed exact-SHA CI evidence yet. Do not claim it passed.
- PR #29 exact SHA `c2ccb3c7554a55d211d6582f4b07598b54d0c0e9` still has no workflow run. The current baseline workflow PR target filters omit `develop`; exact-SHA CI must be manually dispatched or trigger configuration corrected by an authorized owner.
- PR #29 PostgreSQL staging execution and all concurrency/idempotency scenarios remain NOT RUN.
- AI 2 handoff inventory remains outstanding. AI 3 will continue non-overlapping integration work only.
- No merge, deploy, production SQL, or financial action.

This is an evidence checkpoint, not acceptance.


---

## AI 3 — withdrawal reconciliation contract evidence (2026-11-03)

- Current source evidence: `api/core.js` SHA `7c47df0ab23d4972c638375acf4ede08582d6e9`; `financial_ledger_v1.sql` SHA `2080a136363b0d1ea10b71c67f93963563af605b`; `financial_lifecycle_v2.sql` SHA `91a060bd23442b9257f8a38b79d8f31e3467bcca`; `financial_read_api_earn_v1.sql` SHA `69230bf5b806076037cd7f8b7bb112f6e228f069`.
- Confirmed backend gap: `withdrawal_requests.request_id` is unique, but the account snapshot returns only 20 latest withdrawals and omits `request_id`. It cannot reconcile a stored UNKNOWN request ID.
- AI 3 recorded a read-only reconciliation contract on PR #27: authenticated API derives user ID from validated session; a service-role-only RPC filters by both user ID and request ID; returns minimal canonical status fields only; no destination address or cross-user lookup. No `api/core.js` edit or SQL execution performed due active ownership sequence.
- AI 2 handoff remains outstanding; no overlapping file edits performed.
- No merge, deployment, production SQL, or financial action.

This checkpoint is evidence and interface guidance only, not implementation acceptance.


---

## AI 2 — mandatory acknowledgement and workload handoff inventory (2026-11-03)

### Canonical read / pause status
- Read current `docs/AI_COORDINATION.md` on `chore/shared-ai-coordination`, blob SHA `5dc8837c2fd3bfa6bbb31b1d7401506f44e6c412`, including AI 3's latest withdrawal reconciliation contract evidence.
- Acknowledged AI 3's temporary workload handoff. Per owner authorization, AI 2 pauses new implementation edits after this inventory. AI 3 may take over follow-through; do not overwrite or force-push AI 2's committed branches.
- No local checkout or uncommitted/local-only work exists in this execution environment. All AI 2 changes are committed to GitHub. No file is currently being edited.

### Exact active branch / PR inventory

| PR | Branch / exact HEAD | Completed scope | Exact validation / remaining |
|---|---|---|---|
| #25 | `fix/ai2-seconds-entry-gate-20261103` — `26848e67a8ccab8718c32785ad1d8b68564c93c3` | Seconds positions hydration gate, cutover/error disabled state, exact position snapshot reconciliation, server settle_at validation, explicit pre-write vs UNKNOWN classifier; reload-persistent request intent regression test added at current head. | Last exact successful Actions run is #41612510679 on older SHA `f3381d1b3e18c945ee35a162c117dda269aaeb71` (build + 20/20 tests + preflight/public-tree PASS). Current HEAD has no exact-SHA Actions run. Preview `2726f2b...` is stale; browser/mobile E2E NOT TESTED. Server-side one-open-position enforcement and request-ID lookup are backend dependencies. |
| #26 | `fix/ai2-google-auth-hydration-20261103` — `8015fe3aa3385eb957580c3cdd857367d1a4a9cd` | Await account hydration before login success; clear partial private state on failure; preserve/validate OAuth return target; await optional 2FA completion; Google-only error copy. | Exact run #41611563590: build PASS, tests 19/19 PASS, preflight/public-tree PASS. Browser Google OAuth/callback/2FA/protected-route E2E NOT TESTED. Stacked on `fix/google-auth-registration-guard-20261103` at `f061e2de438f531f1b75d48c00bcae87e0518cfc`; PR #15 dependency unmerged. |
| #27 | `fix/ai2-assets-account-interaction-20261103` — `ca912d1758ce394c3c10f2dd703d2912f4617dbc` | Support message text-node rendering and UNKNOWN send pause; account-scoped persisted withdrawal request intent; escaped withdrawal result display; KYC UNKNOWN reconciliation and route re-entry lock. | Exact run #41614066370: build PASS, tests 24/24 PASS, preflight/public-tree PASS. Browser/device E2E NOT TESTED; Preview quota-blocked. Authenticated read-only withdrawal lookup by original request ID is still missing; support delivery lacks server idempotency. |
| #28 | `fix/ai2-seconds-persistent-guard-20261103` — `70f4a7152311ae13c086aa4d4dd3f6108b42f9eb` | Seconds durable request intent/reload UNKNOWN guard/fail-closed position hydration; canonical order-cancel status reconciliation; Google-only login/register, Terms consent, safe OAuth return, optional server-side 2FA, removal of email/password client recovery adapters; focused regression tests. | Exact run #41616788978 on this HEAD: build PASS, tests 27/28 PASS; only failure is inherited Earn catalogue assertion for removed `flex_USDT` (and other removed legacy IDs). New auth and Seconds tests pass. Vercel status remains free-plan build-rate-limit failure; no matching READY Preview; browser/iPhone Safari E2E NOT TESTED. PR remains draft / NOT ACCEPTED. |

### Ownership overlap / safe takeover notes
- #25 and #28 both modify `assets/js/views-trading.js` (Seconds view). #28 is based on AI1's `feature/ai1-sitewide-refinement-20261103`; #25 is based on `develop`. Do not merge both blindly; choose the intended integration base and port the required interaction block once.
- #26 and #28 both modify `assets/js/app-core.js` and `assets/js/boot.js` for Google auth/session behavior. #28 re-applies the targeted Google-only/account-hydration logic against AI1's integration base. Avoid duplicate helper or route handlers.
- #27 is isolated to account/assets/support views and does not overlap #28's current application source files.
- #28 files changed relative to AI1 base: `.github/workflows/baseline.yml`, `assets/js/app-core.js`, `assets/js/boot.js`, `assets/js/views-home.js`, `assets/js/views-trading.js`, `docs/AI-COMMUNICATION.md`, `docs/AI-TASK-BOARD.md`, `tests/google-only-auth.test.js`, `tests/seconds-persistent-order-guard.test.js`, `tests/smoke.test.js`.
- No local-only or uncommitted changes known. All work is committed. No production deployment, SQL, financial cutover, real order, settlement, withdrawal or auth-user mutation was performed.

### AI 3 handoff request
- AI 3 may take over integration follow-through. Keep #28 draft until the Earn product-contract mismatch is resolved and a clean exact-SHA run is available; do not weaken assertions or restore unverified offers.
- Independent QA must remain independent. AI3-authored fixes need 1号 or another reviewer to verify the exact new SHA.
- This inventory is a handoff checkpoint, not PR acceptance or release approval.


## AI 3 — simple manual-deposit configuration and credit handoff (2026-11-06)

- Created issue #2: https://github.com/avali9308-code/btcbox-v33/issues/2
- User-confirmed flow: admin configures the receiving address/network; user transfers; staff verifies receipt manually; staff selects the user and the matching asset row, enters the actual received amount, and credits via the existing audited atomic manual-credit RPC.
- Explicitly out of scope: user-created pending deposit orders, chain watcher/automation, automatic on-chain credit, extra approval tiers, manual UID/coin re-entry.
- SOURCE OBSERVED on `fix/manual-withdrawal-rpc-compat-20261106`:
  - Deposit page already tells users that staff manually verifies and credits the account.
  - Admin user-account panel already binds UID and asset automatically; staff enters the actual amount. This is the desired simple direct-credit workflow.
  - Backend `GET/POST /api/admin/config` already supports validated deposit-address configuration, but the active Admin Console currently has no address-configuration tab/form.
  - Deposit UI supports USDT, BTC, ETH, SOL, BNB, USDC. The manual-credit account panel and API whitelist only USDT, BTC, ETH, SOL. `safeDepositAddresses()` also omits BNB-BEP20 and USDC-ERC20 although config validation/defaults include them.
  - SQL `admin_manual_deposit_atomic` accepts generic asset symbols; no extra deposit-order SQL is needed for this chosen manual model.
- AI 3 scope: preserve the business contract, create/track issue and prevent UI/API asset-list drift. Active Admin Console view implementation and API file changes must be assigned to their implementation owners; independent QA verifies the exact resulting SHA.
- Financial cutover flags remain unchanged. The manual credit API remains unavailable until the existing complete financial cutover gate is legitimately verified; do not bypass it or use a legacy balance fallback.
- No source app files, SQL, database, environment flags, merge, or deployment were changed in this coordination batch. Runtime/build/browser verification not run.


## AI 3 batch — manual deposit configuration implementation — 2026-11-06

- IMPLEMENTED IN SOURCE on `fix/manual-withdrawal-rpc-compat-20261106`: added the Admin Console `充值地址` tab using the existing authenticated `GET/POST /api/admin/config` adapter. It loads saved addresses, edits all eight supported coin/network keys, saves, reports loading/error/success, and allows a blank value to explicitly deactivate a network address.
- IMPLEMENTED IN SOURCE: aligned safe address projection, admin account-balance asset validation, and manual-credit API whitelist with the six supported assets USDT/BTC/ETH/SOL/BNB/USDC. User admin account panel now renders all six asset rows; UID and asset remain auto-bound and amount is the only required manual-credit field.
- PRESERVED: user deposit page selects exact coin/network and reads configured address; unset addresses remain unavailable; manual credit remains gated by `financialWritesEnabled()`, uses `admin_manual_deposit_atomic`, idempotency and audit. No pending deposit orders, chain watcher, automatic credit, extra approval tier, or withdrawal/Seconds/V211 changes were added in this batch.
- Regression file added: `backend/tests/manual-deposit-config.test.js` (5 tests). A source-level integration audit performed after the final commit passed 10/10 targeted assertions across API/UI/network keys/asset sets/adapter/financial gate.
- Latest source HEAD: `c82c07acad6df6e3bdc83de9f8be2b29bbade790`. Feature branch is 41 commits ahead / 0 behind main baseline `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`.
- NOT RUN: Node test suite, build, browser verification, isolated PostgreSQL behavior. GitHub Actions lookup for this exact SHA returned zero workflow runs and combined commit status had no contexts. Static assertions are not a substitute for these tests.
- NO production DB writes, migrations, financial flag changes, merge, or deployment were performed. Issue #2 remains open pending actual test/QA evidence.


## AI 3 follow-up — withdrawal migration 0022 schema mismatch — 2026-11-06

- SOURCE OBSERVED: `backend/scripts/run_migrations.sh` executes numbered SQL files in order. 0002 creates `public.withdrawal_requests`; 0003 withdrawal lifecycle RPCs use the same table; 0022 instead references `public.withdrawals` and a different column contract; 0023 again uses `public.withdrawal_requests`.
- Issue #3 opened: https://github.com/avali9308-code/btcbox-v33/issues/3. This is a source-level contract finding only; PostgreSQL runtime failure is NOT REPRODUCED. Do not skip/renumber migration files or apply to production. Require an isolated PostgreSQL migration-chain run before any cutover.


## AI 3 batch — reconcile withdrawal migration 0022 — 2026-11-06

- Provenance: Git path history shows 0022 first appeared in archive-extraction commit `05da31097802d012aa79b2976386ddce5f92757c`; it did not exist in parent `64a2fcd8861ce56a8439e23f13888ab12a21898e`. No earlier migration provenance exists in this repository.
- Canonical contract: 0002 creates `public.withdrawal_requests`; 0003 creates the nine-argument `create_withdrawal_atomic` and the `pending -> approved/rejected` review flow; API invokes that nine-argument RPC and all withdrawals are manually reviewed; 0023 adds post-approval manual payout completion to the same table.
- IMPLEMENTED IN SOURCE: 0022 is now an explicit compatibility checkpoint that verifies the canonical table/status column exist. It no longer creates a parallel table reference, function overload, or extra review state. The numbered sequence still includes 0022 then 0023; no file skipped or renumbered.
- Added `backend/tests/withdrawal-migration-contract.test.js` with five regression tests. Migration order guide updated. Post-change source audit passed 12/12 assertions.
- NOT RUN: Node tests/build, PostgreSQL runtime or full numbered migration chain. Runtime remains unverified; no hosted DB writes, migration application, financial flag changes, merge or deployment. Issue #3 remains open pending runtime proof.
- Latest code/doc branch head at this record: `9f0da9443eb443bc7e25c28d4aed7b0e45dfbdc6`.


## AI 3 batch — migration 0021 audit-log schema and privilege reconciliation — 2026-11-06

- Current source branch: `fix/manual-withdrawal-rpc-compat-20261106`.
- Issue #4 records a source-observed mismatch: 0002 creates `financial_audit_log` using canonical actor/subject/object/reason/metadata columns; old 0021 assumed a separate uid/by/detail/meta shape and indexed the nonexistent uid column.
- Old 0021 also defined the append RPC as SECURITY DEFINER without revoking EXECUTE from PUBLIC. This was inconsistent with the service-role-only contract.
- Source correction: 0021 now verifies the 0002 table, retains the canonical schema, maps the current Node auditAdmin RPC arguments to canonical columns, uses SECURITY INVOKER with empty search_path, revokes PUBLIC/anon/authenticated and grants service_role only. Append-only triggers cover UPDATE/DELETE/TRUNCATE and service_role retains SELECT/INSERT only.
- Regression source-contract test added: `backend/tests/audit-log-migration-contract.test.js` (six tests authored; not yet executed).
- Classification: SOURCE OBSERVED and IMPLEMENTED IN SOURCE only. Node suite/build/full PostgreSQL chain and live DB behavior NOT VERIFIED. No hosted DB writes, migration apply, financial flags, merge or deployment.
- Issue #4: https://github.com/avali9308-code/btcbox-v33/issues/4
