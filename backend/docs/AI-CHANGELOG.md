# BTCBOX AI Implementation Changelog

Only record changes that actually exist in a committed diff. Plans belong in task files, not here.

## 2026-11-02 — Coordination setup

- Agent: Coordinator
- Branch: `coordination/ai-team-setup`
- Base source SHA: `f1d7b86437872a586e90973826b3086d4b5fa298`
- Files added:
  - `docs/AI-CORE.md`
  - `docs/AI-TEAM-START-HERE.md`
  - `docs/AI-TASK-BOARD.md`
  - `docs/AI-2-TASK.md`
  - `docs/AI-3-TASK.md`
  - `docs/AI-COMMUNICATION.md`
  - `docs/AI-CHANGELOG.md`
  - `docs/AI-INTERFACE-CONTRACT.md`
- Purpose: define non-overlapping numbered roles, file ownership, source-scan requirements, acceptance criteria, shared work records and interruption recovery.
- Application source changed: NO.
- API/database/auth/financial behavior changed: NO.
- Build/tests: NOT RUN; documentation-only setup.
- Deployment: NOT performed.


## 2026-11-02 — Mobile/desktop separation and evidence-based review rules

- Agent: Coordinator
- Branch: coordination/ai-team-setup
- Files added: `docs/MOBILE-DESKTOP-SEPARATE-STANDARDS.md`, `docs/AI-REVIEW-AND-REMEDIATION.md`.
- Files updated: `AI-CORE.md`, `AI-TEAM-START-HERE.md`, `AI-TASK-BOARD.md`, `AI-2-TASK.md`, `AI-3-TASK.md`.
- Rules added: mobile browser is primary; desktop is a separately composed experience; tablet is separately checked; each target has independent acceptance evidence; peer findings require standard references, evidence, severity, repair owner and independent retest; coordinator is bound by the same constraints.
- Synchronized policy documents to `feature/ai2-assets-account` and `feature/ai3-shared-ui` without changing application source.
- Application source changed: NO. API/database/auth/financial behavior changed: NO. Tests/browser checks: NOT RUN (documentation-only changes). Deployment: NOT performed.


## 2026-11-02 — Verified Home/trade-hub route ownership correction

- Source inspected: `feature/uiux-upgrade` SHA `f1d7b86437872a586e90973826b3086d4b5fa298`.
- Confirmed `VIEWS.home` and `VIEWS.tradehub` in `assets/js/views-home.js`; confirmed five mobile nav hrefs in `index.html`; confirmed active-state mapping in `app-core.js`.
- Corrected stale route uncertainty in `AI-CORE.md`, `AI-TEAM-START-HERE.md`, `AI-TASK-BOARD.md`, `AI-INTERFACE-CONTRACT.md` and `AI-3-TASK.md`.
- Ownership: 1号 owns Home/trade-hub JS; 3号 owns shell nav and Home/trade-hub styles in `assets/css/views.css`.
- Application source changed: NO. Tests/browser QA: NOT RUN. Deployment: NOT performed.


## 2026-11-02 — Open collaboration and balanced workload protocol

- Agent: Coordinator (following explicit user instruction)
- Updated coordination policy: primary responsibilities are not exclusive file locks; any agent may make a narrow, necessary frontend correction outside its primary area after inspecting latest state, logging the issue, notifying the primary owner and working on its own branch.
- Added mutual peer supervision, assistance, independent retesting and an explicit concern/uncertainty recording workflow.
- Added shared issue/concern log requirement and cross-agent review cadence.
- Existing protected scope remains unchanged: no unapproved API/backend/database/auth/financial/matching/settlement/security/deployment changes.
- Application source changed: NO.
- Build/tests/browser QA: NOT RUN (documentation-only policy change).
- Deployment: NOT performed.


## 2026-11-02 — Three-team role restructure and shared-layer contract

- Agent: Coordinator; branch: `coordination/ai-team-setup`.
- User-directed roles: 1号 Visual Team; 2号 Interaction Team; 3号 Business Team.
- Review direction: 1号→2号; 2号→3号; 3号→1号. Review-only: no cross-team editing or implementation.
- Shared layers: `docs/` unified standards; target `src/` technical foundation.
- Current runtime remains under `assets/js/` and `assets/css/`; no application source migration or runtime change.
- Added unified scorecard v1.0: Business 50, Interaction 30, Visual 20; minimum 85 and zero veto items.
- API/DB/Auth/financial/matching/settlement behavior changed: NO.
- Build/tests/browser QA: NOT RUN (documentation-only). Production deploy/main merge: NOT performed.


## 2026-11-02 — Interaction source scan and business supervision

- Agent: 2号 Interaction Team.
- Branch: `feature/ai2-interaction`.
- Source inspection: `assets/js/app-core.js` `apiFetch()` returns a structured NETWORK_ERROR on fetch rejection; withdrawal UI currently maps any `!ok` response to a definitive submission failure.
- Added cross-team finding INT-3-001 to `docs/AI-ISSUE-LOG.md` for 3号 review. Requested server-side request-id idempotency and status reconciliation semantics.
- Updated `docs/AI-TASK-BOARD.md` with evidence, scope and handoff.
- Application source changed: NO.
- Tests/browser QA: NOT RUN.
- Deployment: NOT performed.


## 2026-11-02 — Interaction startup account-probe deduplication

- Agent: 2号 Interaction Team; branch: `feature/ai2-interaction`.
- Updated `assets/js/boot.js` to reuse a successful account probe during startup rather than issuing a duplicate request.
- Retained a follow-up account probe when the initial request did not establish an authenticated account, including the Supabase session-exchange recovery path.
- Removed only the redundant successful-path request; no API, auth contract, backend, database, visual styles, or trading layout changed.
- Tests/build/browser QA: NOT RUN.
- Deployment: NOT performed.


## 2026-11-02 — User-directed mature-solution quality principle

- User clarified that clean/error-free code alone does not establish product quality and that mature, professional, suitable solutions may be adopted rather than reinvented.
- Added 2号 working criteria: prefer proven patterns/components where justified; vet license, maintenance, security, compatibility, accessibility/mobile behavior, performance and duplication; evaluate end-to-end user experience and recovery states.
- Binance and mature exchanges are quality references, not assets or workflows to copy blindly.
- Runtime source, dependencies, API contracts, authentication, business logic and trading-page layout changed: NO.
- Tests/build/browser QA: NOT RUN (documentation-only).
- Deployment: NOT performed.


## 2026-11-02 — Drawer accessibility interaction finding

- Reviewed the existing shared modal/drawer implementation and the deposit network-selector consumer.
- Found that `BTCBox.drawer()` declares modal dialog semantics but lacks initial focus placement, Tab/Shift+Tab containment, focus restoration, and background-scroll locking; recorded INT-1-001 for 1号 review.
- Confirmed the existing `BTCBox.modal()` contains a project-native focus-management pattern; no third-party dependency was added and no duplicate focus utility was created.
- Only documentation changed. Shared UI source, visual CSS, deposit flow, API/business logic, authentication, and trading-page layout were not modified.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Order decimal precision end-to-end supervision

- Reviewed the limit-order input-to-API path and confirmed decimal conversion occurs in the trade form (`parseFloat`) and again in `apiAdapter.placeOrder()` (`Number`) before the API's Number-to-string conversion identified by 3号.
- Added INT-3-002 for 3号 review, extending the evidence and remediation scope of BUS-MATCH-005 to the frontend request path.
- No trade form, trading-page layout, API adapter, API, SQL, financial rule, database or authentication source changed.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Support chat interaction hardening

- Updated only `VIEWS.support.afterRender()` in `assets/js/views-account.js`.
- Implementation commits: `3f48318d024ea48816149820c85ebbfc7f9664b0`, `785a8a83969f85e3d2132ced490052ac343f0caf`, `65b00c48f186b34acb421a5ceb201aff78061f9c`.
- Rendered user/server message content as DOM text to prevent message strings from being interpreted as HTML.
- Added a single-flight guard across Send, Enter and quick-reply actions; kept the draft when a request is rejected or delivery is uncertain.
- Added explicit handling for `ok:false` and ambiguous transport/server outcomes; no automatic resubmission and no false sent-state message.
- No API, backend, database, CSS, shared component, navigation, or trading-page changes; no dependency added.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Support chat history restoration

- Connected the support view to the existing `apiAdapter.supportMessages()` read method so the authenticated user's persisted conversation is reloaded when the support page is opened.
- Clear the in-memory conversation cache when the active user key changes, so a previous account's cached messages are not intentionally shown for another account.
- Confirmed from 3号 source that messages are stored per user, while the read endpoint currently returns only the latest 50 of up to 500 stored messages.
- Added INT-3-003 for 3号 to clarify whether the 50-message read window is intentional or pagination is required.
- No API, backend, database, CSS, shared component, navigation, or trading-page source changed.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Logout session lifecycle supervision

- Reviewed the account logout handler and startup session-recovery path.
- Recorded INT-3-004 (2->3, P1) because Supabase sign-out errors are ignored while startup can exchange a surviving Supabase session back into a local session; partial local logout failure also needs a defined reconciliation contract.
- No logout/auth/API/backend/database source changed. This is a cross-team finding pending 3号 clarification.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — 2FA settings result feedback

- Updated only the 2FA action handler in `VIEWS.settings.afterRender()` within `assets/js/views-account.js`.
- The settings page now displays success only when the adapter returns `ok:true`; rejected or unconfirmed operations show an error and do not trigger a success rerender.
- Restores the action button in a `finally` path.
- Implementation commit: `5d34b5887d3b4c990d8d3f3c0f63be2ffa2b988b`.
- INT-3-005 separately records the adapter-owned issue where rejected verification codes close the modal; no adapter/backend code was changed by 2号.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — KYC submission outcome reconciliation

- Updated only `VIEWS.kyc.afterRender()` in `assets/js/views-account.js`.
- Added a duplicate-submit guard and account-status reconciliation after an ambiguous thrown submit request. A confirmed pending application is presented as received; a confirmed non-pending state is not presented as success; failed reconciliation is presented as UNKNOWN and disables immediate retry.
- Implementation commit: `13ad2015b100a34700e1acf8602e69b7cde70bb5`.
- No KYC API adapter, backend, database, response contract, markup, CSS, or trading-page code changed.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Withdrawal unknown-outcome UX hardening

- Updated only `VIEWS.withdraw.afterRender()` in `assets/js/views-assets.js`.
- Network and financial RPC ambiguity now maps to a dedicated Status Unconfirmed state rather than a definitive failure; the UI no longer claims the balance was unchanged for every failed response.
- Added a same-view single-flight guard, catch handling for rejected promises, guaranteed button state cleanup, and removed the immediate New Withdrawal action while the outcome remains unknown.
- Added INT-3-006 for 3号: the backend needs authenticated per-user status reconciliation by request ID and a confirmed durable idempotency contract before the UI can safely recover after navigation/reload.
- Pattern rationale recorded in `docs/AI-INTERACTION-PATTERN-RESEARCH.md` (OWASP transaction authorization/business logic guidance; no new package or copied code).
- Implementation commits: `be9e8f42f15b6f522bc378c610ea781b0716f32a`, `2b142c2129d9e5d03ff43d44cf50b32b1608cb6e`.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Deposit address race and copy feedback

- Updated only `VIEWS.deposit.afterRender()` in `assets/js/views-assets.js`.
- Added latest-request-wins sequencing so delayed responses for an earlier coin/network cannot overwrite the currently selected deposit address, QR or memo.
- Added explicit rejected-request cleanup and unavailable feedback instead of leaving the address in a loading state.
- Replaced unconditional copy-success toasts with Clipboard API plus verified legacy fallback; reports success only when copying succeeds.
- No API, backend, database, network rules, markup, CSS, or trading-page changes; no dependency added.
- Implementation commit: `8b674862c66a014e520a3947d3d6c55248a6e4c5`.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Earn ambiguous outcome protection

- Updated only the subscription interaction in `VIEWS.earn.afterRender()` within `assets/js/views-assets.js`.
- Retains a request ID for the same product/amount payload in the active modal; changed payload gets a new ID.
- Network/5xx outcomes become UNKNOWN; current app-session UI blocks another subscription for that product until reconciled. Rejected promises restore or deliberately lock the action button; success is shown only for `ok:true`.
- Added INT-3-007 for 3号 because account responses include `earn_records` but frontend state currently omits them and there is no operation lookup for recovery after reload/re-login.
- No product data, API schema/adapter, backend, database, balances, fees, business rules, layout, CSS or trading-page changes.
- Implementation commits: `d6427c322fb0e9c44fc24301f38997773958d5d1`, `f2ccf4b07bba731403e5c076d2ec8c1ba52f8f74`, `11c2e8569fa7ead3a7a4aa88687ce27e1855d991`.
- Tests/build/browser QA: NOT RUN (source inspection only).
- Deployment: NOT performed.


## 2026-11-02 — Earn position, redemption and asset history audit

- Re-audited `assets/js/views-assets.js` and the frontend account state on `feature/ai2-interaction`.
- Confirmed Earn positions are not rendered, no redemption interaction exists, and the Assets overview hardcodes the Earn valuation to 0.00 USDT.
- Confirmed Assets Records and Transfer are informational placeholders, not completed transaction journeys.
- Added INT-3-008 (P1, Earn positions/redemption/account data contract) and INT-3-009 (P2, unified transaction history/internal transfer contract) for 3号 review.
- No application code, API adapter, backend, database, visual styles or business rules were changed. Runtime/build/browser tests remain NOT RUN.


## 2026-11-02 — Earn unavailable-state truthfulness mitigation

- In `assets/js/views-assets.js` only, replaced the unsupported hardcoded `In Earn: 0.00 USDT` with an unavailable marker (`—`).
- Reworded the Earn positions empty state and subscription result copy so they do not promise that a live position feed exists.
- Reworded ambiguous subscription guidance to avoid directing users to a non-existent operation-history screen; users are told not to resubmit until support/account operations confirms status.
- Commits: `ca1a6348d7553c69e16fc9b03f156ed7ed9d273d`, `32434f13d011ac3e37b376c1d1f323416a58a9f4`, `3e7eef6dccbc3af51cab9249afb3bd11ea39173d`.
- Validation: PARSE OK (compile only; not executed); source string checks {"earnValueUnavailable":true,"positionEmptyStateHonest":true,"subscriptionToastNoHistoryClaim":true,"modalNoPromise":true}. No application code was executed; tests, build and browser QA remain NOT RUN.
- This is not a substitute for 3号's account-record/reconciliation contract; INT-3-007 and INT-3-008 remain OPEN.


## 2026-11-02 — Withdrawal UNKNOWN guard across SPA navigation

- Fixed a lifecycle gap where the local UNKNOWN flag reset after leaving and re-entering the Withdraw route.
- The account-scoped in-memory marker now restores the blocked `Status Unconfirmed` button on SPA re-entry and prevents another withdrawal submit for that user during the current app session.
- No credentials, addresses, 2FA codes or transaction payloads are persisted. No backend/API/database/CSS/trade-page changes.
- Commit: `35267a30e8162760ebff67d8e5eaf213fb249da3`.
- Validation: PARSE OK (compile only; not executed); source checks {"userScopedMarker":true,"markerSetOnUnknown":true,"blockedOnRouteReentry":true,"guardWarnsBeforeNewSubmit":true,"tradePageUntouched":true}. Runtime/build/browser/automated tests NOT RUN.
- Full reload/re-login reconciliation remains blocked on INT-3-006.


## 2026-11-02 — Support history recovery gate

- Added a visible history-unavailable notice and Retry action to `VIEWS.support.afterRender()`.
- While authenticated conversation history is loading or unavailable, Send, message input and quick replies are disabled. Sending is re-enabled only after history successfully loads.
- Kept API adapter/backend contracts unchanged.
- Commits: `ede0380dd9326d7cf4ec02328767eed95216ca83`, `97be85c24982c92fce51da6d1b0f4f0224428022`.
- Validation: PARSE OK (compile only; not executed); source checks {"retryActionPresent":true,"historyFailureBlocksControls":true,"historyFailureDisablesInput":true,"quickRepliesBlocked":false,"sendGuardIncludesHistoryFailure":true,"failedHistoryVisible":true}. Runtime/build/browser/automated tests NOT RUN.
- Logged INT-3-010 for possible stale support-history response overwriting shared state after account switch.


## 2026-11-02 — Support quick-reply selector correction

- Corrected the support history recovery control update to use `$$('.chat-q')`, ensuring every quick-reply button is disabled while history is unavailable. The single-element `$()` helper is not iterable.
- Final support-view blob: `f2833f30a124f6a6351a914c34a1572c148db03c`.
- Validation: PARSE OK (compile only; not executed); source checks {"retryButton":true,"sendAndInputDisabled":true,"allQuickRepliesDisabled":true,"sendGuard":true,"visibleError":true,"historySuccessRequired":true}. Runtime/build/browser tests NOT RUN.


## 2026-11-02 — Earn UNKNOWN marker account isolation

- Replaced the global Earn unknown-product list with a per-user in-memory map keyed by UID/email. Unknown subscription state remains blocked for the originating account across SPA route re-entry but does not leak to another account.
- Commit: `4ca1b050ecb3e2f54ef128305d2ff7cd31fccf98`.
- Validation: PARSE OK (compile only; not executed); source checks {"perUserMap":false,"localAccountAlias":false,"renderGuard":true,"markerSet":true,"oldGlobalArrayRemoved":true}. Runtime/build/browser/automated tests NOT RUN.
- Full reload/re-login operation reconciliation remains blocked on INT-3-007.


## 2026-11-02 — Earn account map reference correction

- Corrected the Earn per-user UNKNOWN map initializer to reference the existing app `state` object throughout; no undeclared global variable remains.
- Final Earn source blob: `a9b701d778b2d4cbf089f2284efb09c4659edc90`.
- Validation: PARSE OK (compile only; not executed); source checks {"mapUsesState":true,"aliasFromState":true,"renderGuard":true,"markerSet":true,"noUndeclaredMap":true}. Runtime/build/browser tests NOT RUN.


## 2026-11-02 — Market quote truthfulness and order-history readability

- Agent: 2号 Interaction Team; branch: `feature/ai2-interaction`.
- Updated only `assets/js/views-trade.js` (commits `975ab715712f8fde625337f300ed59e23dbbdf7f`, `147262f6ec20cf96880195851996bf0102f734e5`).
- Missing/non-positive market quotes now render as unavailable instead of a false zero in key trade quote positions. Market orders cannot submit without a positive quote; limit orders require a valid positive price; percentage sizing cannot divide by zero.
- Order history/trade history now use `Qty`, show `Market` for market orders, and avoid false zero or invalid date displays for missing fields. Detail timestamps use a consistent readable format.
- The locked trading workspace layout, CSS, API contract and business logic were not changed.
- Registered INT-3-011 and INT-3-012 for 3号 (market array normalization and quote freshness), and INT-1-002 for 1号 (history-only responsive typography/readability).
- Validation: targeted source assertions only. Build, automated tests, browser/device QA and screenshots: NOT RUN. No deployment.


## 2026-11-02 — Assets valuation refresh and missing-quote truthfulness

- Agent: 2号 Interaction Team; branch: `feature/ai2-interaction`.
- Updated only `assets/js/views-assets.js` (commit `821f1a104210d7b43d77a04cbf2a7950e1c9777f`).
- Assets summary and per-asset valuations refresh every 3 seconds while the Assets route is active.
- Missing quotes for positive balances display as unavailable rather than zero; aggregate totals are not presented as complete when a required quote is missing; Hide Small does not silently hide unknown-value assets.
- No CSS, API contract, backend, database, financial logic or trading-page layout changed.
- INT-2-004 recorded for independent runtime verification; INT-3-012 remains open for authoritative quote freshness.
- Validation: PARSE OK (compile only; not executed); targeted source assertions passed. Build/tests/browser/device QA: NOT RUN. No deployment.


## 2026-11-02 — Peer-review remediation: orders, KYC state and profile interaction

- Agent: 2号 Interaction Team; branch: `feature/ai2-interaction`.
- `assets/js/views-trade.js`:
  - Added `partially_filled` to active orders and retained Cancel for remaining quantity.
  - Cancel feedback now depends on refreshed authoritative order status; refreshed orders and account data before showing a final result. Unknown/active/filled outcomes are not reported as cancelled.
  - Improved order status labels and unavailable numeric values.
- `assets/js/views-account.js`:
  - Normalized the KYC status object returned by the account API.
  - Pending is never rendered as Approved; only explicit approved status marks Basic Verification approved. The status-derived `kyc_level` is not treated as a separate tier. Advanced Verification remains locked until 3号 confirms the tier contract.
- `assets/js/views-missing.js`:
  - Fixed the missing `#me-profile` target and added keyboard activation semantics for the existing profile modal.
- Implementation commits: `e12d45ef577d19462f329cba28da36df0429c9e7`, `048a4d68d71d6fa791c480c6d449e482479eede2`, `69ad8461c66baa8123da31f5e2167bc2842b23c8`, `333568e6f8f5d2c1dbf3a12f605f4448bb926767`, `e58ef5987cebbc5f4fc252c0aa176c3a105e883a`, `b929384d6b85a5c8a775a6d16679abffc060cd49`, `50f1e43a69cd82b2a5facb3891deeb3345d94fde`.
- No API adapter, backend, database, SQL, matching rules, account mapper, CSS or trading workspace layout changed.
- Validation: PARSE OK for changed JS sources (compile only; not executed). Build/tests/browser QA: NOT RUN. No deployment.


## 2026-11-02 — 2号 review/repair of 1号 My Account hub

- Reviewed 1号 `feature/ai1-visual` SHA `c38cc27e77d49d427fd76bdca9bdec4164bd9e7e`.
- Reworked 2号-owned `assets/js/views-missing.js` My Account markup to group Identity & Security, Help & Support and Additional Services; wallet/asset valuation now lives only behind the Assets link, removing a non-refreshing duplicate balance snapshot.
- KYC state now distinguishes Pending from explicit Approved and normalizes object/string status.
- Profile details and logout remain native buttons with their existing action handlers; preview-only routes are explicitly marked Preview.
- Commit: `761741338eb3e3d6572e059c8c57af75f635f3a8`.
- Uses `.va-hub-*` visual classes already designed on 1号 branch; integrate the 1号 CSS with this 2号 markup.
- PARSE OK (compile only; not executed). Runtime/browser/build/automated tests: NOT RUN.
## 2026-11-02 — 3号独立审查1号 K线抽屉

- Agent: 3号 Business Team
- Branch: `feature/ai3-business`
- Review baseline: `60cf6ac8cdc2d5c9af4f439024ad7c0dda77e2db`
- Target branch/SHA: `feature/ai1-visual` / `947feeaf46a3d1120b7616dbf636231511bd7081`
- Reviewed implementation: `5d275021be8e66e1591302456f48e43c1d5b6bba`
- Added: `docs/REVIEW-3-TO-1-KLINE-DRAWER-2026-11-02.md`.
- Updated: `docs/AI-ISSUE-LOG.md`, `docs/AI-TASK-BOARD.md`, `docs/AI-CHANGELOG.md`, `docs/AI-COMMUNICATION.md`, `docs/AI-HANDOFF.md`.
- Result: source review only. No confirmed defect in the reviewed diff; browser verification remains outstanding as `VIS-3TO1-KLINE-001` (UNKNOWN / SUGGESTION, OPEN).
- Application source changed: NO. API/database/auth/financial behavior changed: NO.
- Build/tests/browser QA: NOT RUN by 3号. No deployment or main merge.
- Next: 1号 records real browser QA evidence on its own branch; 3号 independently reviews the resulting commit.


## 2026-11-02 — 3号 Business Team: API environment and financial safety audit

- Agent: 3号 Business Team; branch: `feature/ai3-business`.
- Source baseline: `ce91ab8e8aadd47e0981358857dd1b2a0f02e92e`.
- Added: `docs/REVIEW-3-BUSINESS-API-ENV-2026-11-02.md`.
- Updated: `docs/AI-ISSUE-LOG.md`, `docs/AI-TASK-BOARD.md`, `docs/AI-CHANGELOG.md`, `docs/AI-COMMUNICATION.md`, `docs/AI-HANDOFF.md`.
- Tracked BUS-ENV-001 (P0): runtime financial flags use `!== '0'`, while deployment preflight checks only `=== '1'`; unset values therefore disagree. Owner must verify all environment flags and preserve fail-closed behavior until staging approval.
- Tracked BUS-ENV-002 (P1): frontend `API_BASE` hard-codes canonical backend; Preview origin/CSP/backend isolation unresolved.
- Both findings were already described in baseline docs; this batch makes them actionable in the shared issue log.
- Application/API/DB/Auth/financial/deployment source changed: NO.
- Tests/build/preflight/PostgreSQL/browser: NOT RUN. No Preview writes, no production deployment, no main merge.
- Next: obtain owner decisions on P0 financial gate semantics and P1 Preview API routing before implementation.


## 2026-11-02 — 3号 Business Team matching API / SQL contract review

- Branch: `feature/ai3-business`.
- Reviewed `api/core.js`, `assets/js/app-core.js`, and `supabase/sql/financial_matching_engine_v1.sql` by source inspection.
- Added `docs/REVIEW-3-MATCHING-API-SQL-2026-11-02.md`.
- Updated `docs/AI-ISSUE-LOG.md`, `docs/AI-TASK-BOARD.md`, `docs/AI-COMMUNICATION.md`, and `docs/AI-HANDOFF.md`.
- Logged BUS-MATCH-003 (P1): matching market table defaults to disabled and migration has no per-pair seed/upsert; operator-approved pair rules are required.
- Logged BUS-MATCH-004 (P0): maker/taker fee rates are constrained to zero and the reviewed fill function has no fee ledger legs.
- Application/API/SQL/DB/Auth/financial source changed: NO.
- PostgreSQL migration/RPC tests, build/tests/browser QA: NOT RUN. No deployment or production financial operation.


## 2026-11-02 — 3号 Business Team decimal precision issue

- Added BUS-MATCH-005 to `docs/AI-ISSUE-LOG.md`.
- Evidence: API order handler converts price/quantity strings to JavaScript Number before passing them to PostgreSQL; matching schema supports `numeric(38,18)`.
- Classified P1 because high-precision order values can be rounded before server-side tick/step validation.
- No application/API/SQL source modified; no live order or database operation performed.

## 2026-11-02 — 3号 Business Team account read-path audit

- Added `docs/REVIEW-3-BUSINESS-ACCOUNT-READ-PATHS-2026-11-02.md`.
- Logged BUS-LEDGER-006 (P1): normalized account response still reads deposit history from legacy `btcbox_state`, while normalized chain verification credits `deposit_records`.
- Logged BUS-LEDGER-007 (P1): PostgreSQL high-precision numeric balances are parsed into JavaScript Number in the account API read path, risking decimal rounding.
- No application/API/SQL/database/auth/financial source changed; no live financial data queried; no migration, test, or deployment performed.

## 2026-11-02 — 3号 peer review of withdrawal interaction

- Added `docs/REVIEW-3-TO-2-WITHDRAWAL-UNKNOWN-STATE-2026-11-02.md`.
- Logged BUS-WD-008 (P1): 2号 withdrawal UI maps ambiguous backend 503 outcomes to definite failure / unchanged balance and generates a new request ID on each retry.
- Reconfirmed existing BUS-ENV-001 P0 in `main`: runtime unset flags remain enabled while preflight only recognizes exact `1`.
- Noted 2号 task-board top-level READY status conflicts with detailed IN_PROGRESS entries; 1号 correctly records browser QA as NOT RUN. No evidence of protected backend edits by either team in this review sample.
- No target-team or application source changed; no withdrawal API/DB operation, build, test, browser QA, deployment or merge performed.

## 2026-11-02 — 3号 Business Team withdrawal lifecycle review

- Added `docs/REVIEW-3-WITHDRAWAL-LIFECYCLE-GAPS-2026-11-02.md`.
- Logged BUS-WD-009 (P1 production-withdrawal blocker): SQL admin approval moves pending→approved and decreases frozen balance, but admin normalized queue reads only pending; reviewed lifecycle contains no broadcast/txid/confirmation/finalization path.
- External broadcaster infrastructure remains UNKNOWN; finding is limited to reviewed SQL/API/admin read contract.
- No source or database changes; no SQL/API operation, build/test/browser QA, deployment or merge.


## 2026-11-02 — 3号 peer review of KYC and order status handling

- Added `docs/REVIEW-3-TO-2-STATUS-AND-RUNTIME-2026-11-02.md`.
- Logged INT-KYC-001 (P1): KYC object/status contract mismatch plus pending level 1 displayed through Approved/Verified branches.
- Logged INT-ORDER-001 (P1): cancel response ignored; UI unconditionally reports cancellation and re-renders stale local orders.
- No application/API/database source changed. No API requests, build, tests, browser QA, DB operation, deployment or merge performed.


- Added INT-ORDER-002 (P1): partially-filled matching orders are treated as history and lose the cancel action despite remaining active/cancellable in SQL.


- Added BUS-MKT-010 (P2): source-level market freshness race risk from overlapping 3-second REST polling and unconditional response application; runtime reproduction pending.
