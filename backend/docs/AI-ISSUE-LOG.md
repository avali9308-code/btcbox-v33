# BTCBOX 跨团队问题与建议日志

本文件记录跨团队监督意见、缺陷、疑问和风险。提出意见的团队不得代替被监督团队修改。

## 记录模板

```text
ID:
Date:
Reporter:
Direction: 1->2 / 2->3 / 3->1
Target team:
Route / viewport:
File / selector / function:
Type: BUG / CONTRACT / UX / VISUAL / DATA / UNKNOWN / SUGGESTION
Severity: P0 / P1 / P2 / P3 / SUGGESTION
Standard / contract:
Evidence:
Expected:
Actual:
User impact:
Recommendation:
Target team's response: ACCEPTED / DISPUTED / NEEDS_CLARIFICATION / DEFERRED
Target team's owner:
Fix commit:
Retest evidence:
Status: OPEN / IN_REVIEW / FIXED / VERIFIED / DEFERRED
```

## 当前记录

本次组织调整建立日志格式。没有证据的历史猜测不得自动转成当前缺陷。各团队完成最新 source scan 后再创建具体 Issue。


## INT-3-001 — Withdrawal network failure is incorrectly presented as a confirmed failure

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- Route / viewport: `#/withdraw`; desktop and mobile browser (runtime reproduction pending)
- File / selector / function: `assets/js/app-core.js` `apiFetch()`; `assets/js/views-assets.js` `VIEWS.withdraw.afterRender()` / `wdResultState()`
- Type: CONTRACT
- Severity: P1
- Standard / contract: `docs/AI-2-TASK.md` §4; `docs/AI-INTERFACE-CONTRACT.md` §4; timeout/unknown result must not be represented as confirmed failure.
- Evidence: source inspection confirms `apiFetch()` catches a fetch rejection and returns `{ok:false,msg:'Network error',code:'NETWORK_ERROR',status:0}`. The withdrawal view passes this response to `showResult()`; `wdResultState()` currently maps every `!r.ok` to `Submission Failed` and states the balance was unchanged.
- Expected: a transport failure after a withdrawal POST must be represented as UNKNOWN / awaiting reconciliation, not as a confirmed rejection or unchanged balance.
- Actual: a potentially ambiguous POST result is presented as a confirmed failed withdrawal.
- User impact: user may submit a second withdrawal while the first request may already have reached the server.
- Recommendation: 3号 to confirm server-side idempotency for `request_id` and provide a status/reconciliation lookup keyed by that ID; return explicit UNKNOWN/PENDING semantics where applicable. 2号 will correct only the UI state mapping and retry affordance.
- Target team's response: NEEDS_CLARIFICATION
- Target team's owner: 3号 Business Team
- Fix commit: pending
- Retest evidence: pending
- Status: OPEN


## INT-1-001 — Drawer dialog does not contain or restore keyboard focus

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1
- Target team: 1号 Visual Team (shared component implementation owner to be confirmed)
- Route / viewport: `#/deposit`; deposit network selector bottom drawer; desktop and mobile (runtime reproduction pending)
- File / selector / function: `assets/js/ui-components.js` `BTCBox.drawer()`; consumer: `assets/js/views-assets.js` `VIEWS.deposit.afterRender()` / `openNetDrawer()`
- Type: UX / ACCESSIBILITY
- Severity: P2
- Standard / contract: `docs/AI-2-TASK.md` §4; `docs/AI-INTERFACE-CONTRACT.md` §§3, 5; `docs/TEAM-CHARTER.md` 2号交互职责（焦点与键盘交互）。
- Evidence: `BTCBox.drawer()` sets `role="dialog"` and `aria-modal="true"`, and supports Escape/mask close, but unlike `BTCBox.modal()` it does not move initial focus into the drawer, trap Tab/Shift+Tab, restore focus to the invoking control on close, or lock background body scrolling. The deposit network selector opens this drawer from `#dep-net-btn` and closes it after a network selection.
- Expected: while the drawer is open, keyboard focus remains within the modal dialog; initial focus is moved to a meaningful control (or the dialog container); closing restores focus to the trigger; background scrolling is prevented where appropriate, including mobile.
- Actual: the drawer advertises modal semantics to assistive technology but has no corresponding focus containment/restoration behavior; keyboard users can tab into background content and focus is not returned to the trigger.
- User impact: keyboard and screen-reader users can lose context while selecting a deposit network; mobile users may scroll the page behind the open sheet.
- Recommendation: 1号 to confirm the primary owner for `assets/js/ui-components.js` and implement/coordinate drawer behavior consistently with the existing modal implementation. Preserve current public API and visual structure; test keyboard, screen reader semantics, focus restoration, Escape, mask close, and mobile scroll behavior. 2号 can review the interaction contract and acceptance evidence.
- Target team's response: NEEDS_CLARIFICATION
- Target team's owner: 1号 Visual Team (file primary owner not recorded in task board; confirmation requested)
- Fix commit: pending
- Retest evidence: pending
- Status: OPEN


## INT-3-002 — Order form and adapter convert decimal input to binary floating point before API submission

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team (coordinate with the registered owner of the trade-view interaction code)
- Route / viewport: `#/trade/:symbol`; limit-order form; desktop and mobile (runtime reproduction pending)
- File / selector / function: `assets/js/views-trade.js` order submit handler (around `parseFloat()` / `apiAdapter.placeOrder()`); `assets/js/app-core.js` `apiAdapter.placeOrder()`; API `api/core.js` `POST /api/order`
- Type: CONTRACT / DATA / FINANCIAL PRECISION
- Severity: P1
- Standard / contract: `docs/AI-2-TASK.md` §§3–5; `docs/AI-INTERFACE-CONTRACT.md` §§3–4. User-entered order price/quantity must not be silently changed between input and authoritative server validation.
- Evidence: the trade form reads `#ord-amount` and `#ord-price` with `parseFloat()` before calling `apiAdapter.placeOrder()`; `apiAdapter.placeOrder()` then builds the request with `qty:Number(o.qty)` and `price:Number(o.price)`. 3号's current `BUS-MATCH-005` independently confirms that `api/core.js` converts the resulting values through `Number(body.qty)` / `Number(body.price)` before stringifying them for PostgreSQL `numeric(38,18)`.
- Expected: preserve the original decimal strings from the input through the frontend adapter and API boundary; validate syntax, range, scale and market tick/step without binary-float round trips. Numeric conversion may be used only for non-authoritative display calculations, not the submitted price/quantity.
- Actual: the value is converted to JavaScript Number at the trade form and again in the API adapter; precision can be lost before the database's exact numeric validation is reached. This extends BUS-MATCH-005 to the earlier frontend stages.
- User impact: the amount or limit price submitted may differ from what the user typed, or a valid high-precision order may be rejected. This is especially important for markets with fine tick/quantity steps.
- Recommendation: 3号 to define a string-preserving order payload contract and remove Number coercion from the authoritative submission path, coordinating with the trade-view owner for the input handoff. Keep any preview/total arithmetic separate from the raw submitted strings. Add round-trip tests for 18 fractional digits, boundary values and exact equality. Do not change the locked trading-page layout as part of this fix.
- Target team's response: PENDING
- Target team's owner: 3号 Business Team for API adapter/API contract; trade-view owner confirmation required for `assets/js/views-trade.js`.
- Fix commit: pending
- Retest evidence: pending — exact input-to-request payload assertion plus API/PostgreSQL numeric precision regression tests.
- Status: OPEN / NEEDS FIX


## INT-3-003 — Support conversation history endpoint exposes only the latest 50 messages

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- Route / viewport: `#/support`; desktop and mobile (runtime verification pending)
- File / selector / function: `api/core.js` `GET /api/support/messages`; frontend consumer `apiAdapter.supportMessages()`
- Type: CONTRACT / DATA / HISTORY RETENTION
- Severity: P2
- Standard / contract: user requirement confirmed in prior project discussion — a signed-in user should be able to close/reopen the support page and sign out/sign in again without losing access to their conversation history.
- Evidence: the business route returns `user.support_messages.slice(-50)`; the stored per-user array is separately capped at 500 messages. The frontend adapter maps the returned list into `state.supportMsgs`.
- Expected: clarify whether 50 messages is the intentional product-visible history limit. If complete conversation history is expected, provide a paginated or cursor-based read contract while preserving per-user authorization.
- Actual: only the latest 50 records are returned to the user UI; older records may remain stored (up to the 500-message cap) but are not currently retrievable through this endpoint.
- User impact: long-running conversations may appear truncated after the latest 50 messages, even though older messages remain stored.
- Recommendation: 3号 to confirm the intended retention/display policy and, if needed, define a paginated read contract. 2号 has connected the existing read method to the support view and will implement pagination only after the contract is agreed.
- Target team's response: NEEDS_CLARIFICATION
- Target team's owner: 3号 Business Team
- Fix commit: pending
- Retest evidence: pending — verify same-user history after closing/reopening and sign-out/sign-in; verify account isolation and pagination boundary.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-3-004 — Logout flow ignores Supabase sign-out errors and can leave a recoverable session

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team (coordinate with 2号 for the user-facing flow)
- Route / viewport: Account `Log Out` action; desktop and mobile (runtime reproduction pending)
- File / selector / function: `assets/js/views-account.js` `window.confirmLogout()`; `assets/js/boot.js` session recovery; `assets/js/app-core.js` `apiAdapter.logout()`
- Type: AUTH / SESSION LIFECYCLE / INTERACTION
- Severity: P1
- Standard / contract: logout must invalidate all active authentication paths and must not silently re-establish the same session on the next app startup.
- Evidence: `window.confirmLogout()` catches and ignores errors from `supabaseClient.auth.signOut()`, then proceeds to `apiAdapter.logout()`; the fallback path also ignores Supabase sign-out errors. Separately, `boot()` detects a surviving Supabase session and calls `apiAdapter.supabaseLogin(session.access_token)` when the local account probe indicates no valid local session. Therefore, if Supabase sign-out fails but local logout succeeds, startup can exchange the still-valid Supabase session back into a local session. The inverse partial-failure case (Supabase sign-out succeeds but local logout fails) can also leave the local cookie valid.
- Expected: both Supabase and local backend sessions are invalidated, or the UI reports a clearly defined partial/unknown outcome with a safe recovery path; a subsequent boot must not silently re-authenticate after an acknowledged logout.
- Actual: Supabase sign-out errors are ignored and the two session invalidations are not coordinated or reconciled.
- User impact: a user may select Log Out, see a success message, then be signed back in automatically on reload/reopen; partial failures can also leave a live session behind.
- Recommendation: 3号 to confirm the authoritative logout/session contract, including whether server-side revocation or a logout-intent/reconciliation state is required. 2号 will then implement accurate confirmation, loading, partial-failure and retry behavior without changing authentication contracts independently.
- Target team's response: NEEDS_CLARIFICATION
- Target team's owner: 3号 Business Team for session/API contract; 2号 owns the user-facing confirmation flow.
- Fix commit: pending
- Retest evidence: pending — test Supabase sign-out success/failure, local logout success/failure/timeout, reload after logout, Google and Email accounts, and fallback when the modal component is unavailable.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-3-005 — 2FA verification modal closes on rejected code and returns failure to caller

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- Route / viewport: Account Settings > Two-Factor Authentication; desktop and mobile (runtime reproduction pending)
- File / selector / function: `assets/js/app-core.js` `apiAdapter.twofaEnable()` and `apiAdapter.twofaDisable()`; backend `POST /api/2fa/confirm` and `POST /api/2fa/disable`
- Type: AUTH / INTERACTION / ERROR RECOVERY
- Severity: P2
- Standard / contract: failed verification must retain a recoverable interaction state and communicate the authoritative server rejection; users should be able to correct a code without reopening the entire flow.
- Evidence: the enable modal submit handler calls `/2fa/confirm`, updates state only when `c.ok`, but then closes the modal and resolves with the failure result regardless. The disable modal does the same after `/2fa/disable`. Thus invalid/expired codes close the modal rather than keeping the user in the verification step.
- Expected: on rejected code, show the server error within the verification modal, retain the flow for a corrected code, and resolve only on confirmed success or explicit cancellation.
- Actual: the modal closes on both success and rejection; caller receives `ok:false` after the modal has already disappeared.
- User impact: users must reopen the security setting and restart the flow after a mistyped/expired code; it can look as though the process has simply stopped.
- Recommendation: 3号 to adjust the adapter modal's submit behavior to keep the modal open on `ok:false`, show the response message, and resolve/close only on confirmed success (or explicit cancel). Keep the existing API request/response contract unchanged.
- Target team's response: NEEDS_CLARIFICATION
- Target team's owner: 3号 Business Team (`assets/js/app-core.js` owner)
- Fix commit: pending
- Retest evidence: pending — invalid code then valid code in the same modal; already-enabled/already-disabled server responses; explicit close/cancel; keyboard and mobile modal behavior.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-3-006 — Withdrawal outcome reconciliation is missing for unknown writes

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- Route / viewport: Assets > Withdraw; desktop and mobile (runtime reproduction pending)
- File / selector / function: `api/core.js` `POST /api/withdraw`; `assets/js/app-core.js` `apiAdapter.account()` / `applyAccount()`; `assets/js/views-assets.js` withdrawal submit/result flow
- Type: FINANCIAL / API CONTRACT / IDEMPOTENCY / RECONCILIATION
- Severity: P1
- Standard / contract: OWASP Business Logic Security guidance — caller-scoped idempotency keys bound to immutable request parameters, durable atomic operation state, and reconciliation of unknown outcomes before resubmission. OWASP Transaction Authorization guidance — the reviewed transaction details must remain bound to the authorized operation.
- Evidence: the withdrawal API requires `request_id` and its PostgreSQL RPC hashes user, coin, network, amount, fee, address and request ID; however the frontend currently generates a fresh `uid()` for each submit. On API/network ambiguity, the UI has no per-user request-status lookup. `GET /api/account` includes a `withdrawals` field, but `applyAccount()` does not retain it in client state, and there is no observed user-facing lookup by request ID. The API may return `FINANCIAL_RPC_FAILED` / `FINANCIAL_RPC_UNAVAILABLE` with wording that the withdrawal was not confirmed and operation history must be checked. The current UI maps every `!r.ok` to definitive failure and claims the balance was unchanged.
- Expected: the same logical submit retains one request ID bound to an immutable payload; same-key/same-payload retry is supported by server idempotency; different-payload reuse is rejected; user can query the authoritative operation by request ID/status; unknown result remains pending/unknown until reconciled.
- Actual: new submit attempts receive new IDs, there is no frontend status lookup, and unknown results are presented as definite failure with an unsupported unchanged-balance assertion.
- User impact: user may retry after an ambiguous database/network outcome and create a second withdrawal request; UI may incorrectly reassure them that the balance was unchanged.
- Recommendation: 3号 to confirm the exact PostgreSQL idempotency behavior and add an authenticated, user-scoped status/history lookup that can reconcile by request_id (including duplicate result and final operation state). Expose withdrawals in the account adapter/state or define a dedicated endpoint. Document retry window and same-key/different-payload semantics. 2号 will then connect a safe status-recovery journey.
- Target team's response: NEEDS_CLARIFICATION
- Target team's owner: 3号 Business Team
- Fix commit: pending
- Retest evidence: pending — timeout after DB commit, timeout before DB commit, same key/same payload, same key/different payload, duplicate concurrent submits, reload/re-login reconciliation, and cross-user lookup denial.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-3-007 — Earn write outcomes cannot be reconciled after an ambiguous RPC result

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- Route / viewport: Earn > Subscribe / Redeem; desktop and mobile (runtime reproduction pending)
- File / selector / function: `api/core.js` `POST /api/earn`; `GET /api/account`; `assets/js/app-core.js` `applyAccount()`; `assets/js/views-assets.js` `VIEWS.earn.afterRender()`
- Type: FINANCIAL / IDEMPOTENCY / RECONCILIATION
- Severity: P1
- Standard / contract: OWASP Business Logic Security guidance — caller-scoped idempotency key bound to immutable parameters, durable atomic operation state/result, and reconciliation of unknown outcomes before resubmission.
- Evidence: the earn route accepts a request ID, hashes the user/product/asset/amount/request ID and calls an atomic PostgreSQL RPC. RPC failures can return `FINANCIAL_RPC_FAILED` / `FINANCIAL_RPC_UNAVAILABLE` with explicit instructions to check operation history before retrying. `GET /api/account` already returns `earn_records`, but the frontend `applyAccount()` does not retain them in client state, and no user-facing lookup by request ID was found. The current Earn submit handler creates a fresh `uid()` for every click and only restores the button after a resolved promise; a rejected promise can leave it disabled, while a returned ambiguous failure permits a new click with a new request ID.
- Expected: the same logical subscription/redemption keeps one request ID bound to the exact payload; the authenticated user can query the authoritative record by request ID or refresh operation history; a second write is blocked until an unknown result is reconciled.
- Actual: the UI has no operation lookup and may allow a new request ID after an ambiguous result; the account read response already includes records but the client adapter state omits them.
- User impact: a user may submit a second subscription/redemption after the first may already have committed, potentially moving funds twice.
- Recommendation: 3号 to define and expose authenticated per-user earn operation/history reconciliation, confirm atomic idempotency and key/payload mismatch semantics, and document how duplicates return the original operation. Expose `earn_records` through the frontend account state or a dedicated read method. 2号 will connect a blocked-until-reconciled UI state.
- Target team's response: NEEDS_CLARIFICATION
- Target team's owner: 3号 Business Team
- Fix commit: pending
- Retest evidence: pending — timeout after commit, timeout before commit, duplicate same-key/same-payload, same-key/different-payload, new click after unknown, reload/re-login reconciliation, and cross-user lookup denial.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-3-008 — Earn positions and redemption journey are not connected to account records

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- Route / viewport: Assets overview and Earn; desktop and mobile (runtime reproduction pending)
- File / selector / function: `assets/js/app-core.js` account state / `applyAccount()`; `assets/js/views-assets.js` `VIEWS.assets()` and `VIEWS.earn()` / `VIEWS.earn.afterRender()`; `api/core.js` `GET /api/account` and `POST /api/earn`
- Type: FINANCIAL DATA / API CONTRACT / USER JOURNEY
- Severity: P1
- Evidence: source inspection shows `GET /api/account` returns `earn_records` (per INT-3-007), but frontend state does not retain or render those records. The Earn page's `#earn-positions` remains a static empty-state placeholder; no position list, redemption action, redemption confirmation, or redemption result flow is implemented in the current view. Assets overview also hardcodes `In Earn` to `0.00 USDT` regardless of account records. Current Earn product descriptions promise flexible redemption and fixed maturity, but the user cannot inspect or redeem an actual position from this UI.
- Expected: authenticated account positions are loaded and displayed with authoritative asset, principal, accrued interest, product term, status and maturity data; redemption eligibility and amounts come from the backend; flexible redemption and fixed maturity states are explicit; redemption has a reviewed confirmation, one in-flight action, and unknown-outcome reconciliation.
- Actual: positions remain a permanent placeholder in the inspected view; no redeem control or redeem handler exists; Assets shows a hardcoded zero for Earn.
- User impact: users may be unable to understand where subscribed funds are held, may be unable to redeem eligible funds, and may be shown a false zero Earn balance.
- Recommendation: 3号 to confirm the canonical `earn_records` schema, redemption endpoint/action, eligibility/status rules, and per-user reconciliation contract. 2号 will then implement the position and redemption interaction within its owned view file; no business rule or API schema will be invented by 2号.
- Target team's response: pending
- Target team's owner: 3号 Business Team
- Fix commit: pending
- Retest evidence: pending — empty account, active flexible position, fixed locked position, maturity, partial/full redemption if supported, duplicate redemption, unknown result, reload/re-login, cross-user isolation.
- Status: OPEN / NEEDS_CLARIFICATION

## INT-3-009 — Asset transaction history and internal transfer entry are unavailable

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- Route / viewport: Assets overview; desktop and mobile (runtime reproduction pending)
- File / selector / function: `assets/js/app-core.js` `apiAdapter` / account state; `assets/js/views-assets.js` `VIEWS.assets()` / `VIEWS.assets.afterRender()`; backend account/ledger read APIs
- Type: API CONTRACT / USER JOURNEY / FINANCIAL HISTORY
- Severity: P2
- Evidence: the Assets view exposes `Records` and `Transfer` actions, but Records only scrolls to a static message that transaction history is unavailable, and Transfer opens a modal stating internal transfer is not available. The inspected frontend adapter contract lists no user-facing deposit/withdrawal/transfer ledger-history read method. The view therefore has no way to show authoritative deposit, withdrawal, transfer or Earn ledger events in one place.
- Expected: the backend defines an authenticated, paginated, user-scoped transaction-history contract with stable event IDs, type, asset, amount, status, timestamps and relevant references; transfer is either backed by an approved internal-transfer contract or clearly marked unavailable without implying an actionable feature.
- Actual: Records is a scroll-to-placeholder action and Transfer is an informational modal only.
- User impact: users cannot independently audit account movements or use an internal transfer journey from the Assets page; they must rely on individual submission screens or support.
- Recommendation: 3号 to confirm whether a unified ledger/history endpoint and internal transfer API are in scope. If transfer is not supported, 1号/2号 should present it as a clearly unavailable capability rather than a functional action. 2号 can implement history filters, pagination and empty/error/loading states after the response contract is agreed.
- Target team's response: pending
- Target team's owner: 3号 Business Team
- Fix commit: pending
- Retest evidence: pending — empty history, mixed event types, pagination boundary, stale cursor, failed read, retry, mobile filter interaction, user isolation.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-2-001 — Withdrawal UNKNOWN guard resets on SPA route re-entry

- Date: 2026-11-02
- Reporter / owner: 2号 Interaction Team
- Direction: 2 internal
- Route / viewport: Assets > Withdraw; SPA route navigation
- File / function: `assets/js/views-assets.js` `VIEWS.withdraw.afterRender()`
- Type: FINANCIAL UX / STATE LIFECYCLE
- Severity: P1
- Evidence: `withdrawalOutcomeUnknown` is initialized as a local variable each time `afterRender()` runs. After an ambiguous POST result, the current page blocks another submit, but navigating away and returning recreates the variable as false. A new submission can then be sent with a new `request_id` while the prior operation may have committed.
- Expected: unresolved withdrawal state remains blocked across SPA route re-entry for the same authenticated user until the backend confirms the operation outcome.
- Actual: guard lifetime is limited to one render instance.
- Mitigation: retain an account-scoped UNKNOWN marker in the existing in-memory app state; do not persist secrets or transaction payload. This only protects the current SPA session.
- Remaining requirement: full reload/re-login status reconciliation and idempotency remain blocked on INT-3-006 / 3号's authenticated status lookup.
- Retest: ambiguous result -> navigate to Assets -> return to Withdraw -> verify new submit remains blocked; switch account -> verify marker does not leak across users; confirm normal user without marker can submit.
- Status: IN_REVIEW — SPA route re-entry mitigation committed; runtime/reload reconciliation verification pending.


## INT-2-002 — Support history read failure silently re-enables message sending

- Date: 2026-11-02
- Reporter / owner: 2号 Interaction Team
- Direction: 2 internal
- Route / viewport: Support chat; desktop and mobile
- File / function: `assets/js/views-account.js` `VIEWS.support.afterRender()`
- Type: UX / MESSAGE DELIVERY RECONCILIATION
- Severity: P2
- Evidence: history fetch rejection is swallowed by `.catch(function(){})`; the `.finally()` handler always clears `historyLoading` and re-enables Send. A failed history read therefore provides no warning or recovery action and allows a user to submit another message even though the previous conversation state may not have been recovered. Quick replies and input are also not disabled on history failure.
- Expected: while authenticated conversation history is unavailable, show a clear warning and retry action; keep message send and quick replies blocked until the authoritative history read succeeds.
- Actual: error is silent and sending becomes available.
- Recommendation: implement a visible history-unavailable/retry state in the support view only; keep existing API contract unchanged.
- Retest: history success; 401; network failure; 5xx; retry success; retry failure; user switch while request in flight; no cross-user message display.
- Status: IN_REVIEW — visible retry and send-blocking mitigation committed; runtime/browser verification pending.


## INT-3-010 — Support history adapter writes shared cache before account ownership is rechecked

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- File / function: `assets/js/app-core.js` `apiAdapter.supportMessages()`; consumer `assets/js/views-account.js` `VIEWS.support.afterRender()`
- Type: PRIVACY / ASYNC STATE OWNERSHIP
- Severity: P1
- Evidence: `supportMessages()` awaits `apiFetch('/support/messages')` and immediately assigns the response into shared `state.supportMsgs`. The view checks `state._supportMessagesUserKey` only after the adapter has already mutated shared state. If an old user's history request resolves after the user switches accounts, the stale response can overwrite the new user's shared message cache before the view-level guard returns.
- Expected: the adapter or caller must bind each history response to the authenticated user/session that initiated it and discard stale results before mutating shared state; the server must continue enforcing user-scoped history access.
- Actual: mutation occurs before consumer ownership validation.
- Recommendation: 3号 to change the read adapter contract so it returns normalized messages without mutating global state, or add a request/session generation guard inside the adapter before assignment. Keep backend authorization user-scoped. 2号 does not modify `app-core.js`.
- Retest: start user A history request, switch to user B before response, resolve A response late; verify B's cache and rendered chat remain B-only; reverse order; sign-out during read; verify server cross-user denial.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-2-003 — Earn UNKNOWN product marker is shared across accounts

- Date: 2026-11-02
- Reporter / owner: 2号 Interaction Team
- Direction: 2 internal
- Route / viewport: Earn; account switch within SPA
- File / function: `assets/js/views-assets.js` `VIEWS.earn.afterRender()`
- Type: USER STATE ISOLATION / FINANCIAL UX
- Severity: P2
- Evidence: `state._earnUnknownProductIds` is a single global array. After user A receives an ambiguous subscription result, user B logging into the same SPA session may see that product disabled even though the unresolved request belongs to A.
- Expected: unresolved operation guards are scoped to the authenticated account that initiated the request and survive SPA route re-entry for that account only.
- Actual: marker is global across users.
- Mitigation: store in-memory unknown product IDs in a per-user map keyed by UID/email; do not persist request payloads or credentials.
- Retest: user A unknown -> route away/back remains blocked; sign out A and sign in B -> B can subscribe; sign back into A -> A remains blocked in same app session.
- Status: IN_REVIEW — account-scoped in-memory marker committed; account-switch verification pending.


## INT-3-011 — Market-array response cannot update pre-seeded symbols

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- File / function: `assets/js/app-core.js` market initialization and `applyMarket(r)`
- Type: MARKET DATA / RESPONSE NORMALIZATION
- Severity: P1
- Evidence: `PAIRS.forEach()` pre-creates every supported `market[sym]` entry before the first request. In the `r.markets` response branch, `if(market[sym]) return;` therefore skips every already-supported symbol. `refreshMarket()` still treats any `r.markets` array as success, so a backend response using the advertised `markets` shape can leave the UI on zero/placeholder prices indefinitely.
- Expected: valid returned market rows update existing supported symbols; unknown symbols are ignored safely; malformed or empty responses do not count as a successful quote refresh.
- Actual: all pre-seeded supported symbols are skipped in the `markets[]` branch.
- Recommendation: 3号 to correct response normalization and add contract tests for both `data` and `markets[]` response shapes, including existing symbols and empty/malformed rows. 2号 does not modify `app-core.js`.
- Retest: markets[] containing BTCUSDT/ETHUSDT updates seeded entries; data{} updates; empty array remains unavailable; unsupported symbols are ignored; malformed price is rejected.
- Status: OPEN / NEEDS_FIX

## INT-3-012 — Market quote freshness is not represented; stale values remain visible

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team
- File / function: `assets/js/app-core.js` `applyMarket()`, `updateLivePriceEls()`, `refreshMarket()`, `startTicker()`
- Type: MARKET DATA / DATA FRESHNESS / USER TRUST
- Severity: P1
- Evidence: `applyMarket()` substitutes `Date.now()` when the source timestamp is missing, which makes an un-timestamped quote appear newly updated. The `markets[]` branch also stamps client time. When a refresh fails, `refreshMarket()` sets a global unavailable flag and shows a network notice but leaves the last displayed price untouched; `updateLivePriceEls()` only changes a price when it is truthy. Polling runs every 3 seconds without an in-flight/latest-response guard, so slow overlapping requests may resolve out of order and overwrite newer quotes.
- Expected: source timestamps and quote validity are preserved; each symbol has a clear freshness state; stale/delayed/unavailable quotes are visibly distinguished from live quotes; out-of-order responses cannot roll back newer data; failures do not leave an old quote looking live.
- Actual: missing timestamps are converted to current time, stale values remain rendered after failed refresh, and overlapping polls are not serialized or version-guarded.
- Recommendation: 3号 to define a per-symbol quote timestamp/source contract, reject invalid price/timestamp values, prevent out-of-order updates, and expose freshness state for the UI. 2号 will render the agreed Live / Delayed / Stale / Unavailable states after the contract is confirmed; no fake prices or client-generated freshness timestamps.
- Retest: valid source timestamp; missing timestamp; stale timestamp; future timestamp; zero/negative/NaN price; request timeout; overlapping response order; recovery after reconnect; per-symbol mixed availability.
- Status: OPEN / NEEDS_FIX
- Cross-reference: 3号 independently recorded the same out-of-order market response/freshness risk as BUS-MKT-010 in `feature/ai3-business`; 3号 rates it P2 pending runtime validation.

## INT-1-002 — Order and trade history table needs clearer responsive typography

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1
- Target team: 1号 Visual Team
- Route / viewport: Trade > Open Orders / Order History / Trade History; mobile and desktop
- File / selector: `assets/css/views-trade.css` `.orders-body`, `.orders-body table`, table cells and order detail rows
- Type: READABILITY / RESPONSIVE PRESENTATION
- Severity: P2
- Evidence: order history is rendered as a dense nine-column table (Pair, Side, Type, Price, Amount, Filled, Status, Time, Action) with a 720px minimum width and horizontal scrolling. This is functional but requires repeated sideways scanning on mobile; long IDs and date/time values in the detail drawer also need consistent wrapping/alignment. Runtime screenshots have not yet been captured.
- Expected: keep the locked trade workspace layout intact while improving only the history/records region: consistent numeric alignment and tabular numerals, legible time/status hierarchy, predictable truncation or wrapping for IDs, and mobile-friendly column prioritization/abbreviations. Use concise labels such as Qty where clear; do not hide essential order status or amounts.
- Actual: the table is wide and information-dense; mobile relies on horizontal scrolling.
- Recommendation: 1号 to inspect the history panel CSS and propose a narrow presentation-only refinement without changing the locked trade workspace layout or table data contract. 2号 has already changed the text label Amount to Qty and guarded missing numeric/time values.
- Retest: desktop 1280px; mobile 320/375/390/430px; long order ID; long date; partial fill; market order; empty history; horizontal overflow and readable tap targets.
- Status: OPEN / NEEDS_CLARIFICATION


## INT-2-004 — Asset valuations remained static and missing quotes were presented as zero

- Date: 2026-11-02
- Reporter / owner: 2号 Interaction Team
- Direction: 2 internal
- Route / viewport: Assets overview; desktop and mobile
- File / function: `assets/js/views-assets.js` `VIEWS.assets()` / `VIEWS.assets.afterRender()`
- Type: MARKET DATA PRESENTATION / DATA FRESHNESS / FINANCIAL UX
- Severity: P1
- Evidence: the Assets view calculated total/available/frozen valuations once when the route rendered, while the global market poll continued in the background. The per-asset estimated value and Hide Small filter also treated a missing quote as zero, potentially hiding an asset with a real balance or showing an understated portfolio total.
- Expected: visible valuations refresh while the Assets route is active; if any positive balance cannot be priced from a valid quote, the affected valuation displays unavailable rather than a false zero; assets with an unknown quote are not silently removed by Hide Small.
- Mitigation: added a route-scoped 3-second render refresh, per-asset quote validation, unavailable markers for incomplete aggregate valuations, and retained unknown-value assets when Hide Small is enabled.
- Implementation commit: `821f1a104210d7b43d77a04cbf2a7950e1c9777f`.
- Limitation: stale/fresh determination still depends on INT-3-012's source timestamp and freshness contract; this change does not claim a stale quote is live.
- Retest: quote updates while Assets remains open; missing quote for positive BTC balance; Hide Small with missing quote; zero-balance asset with no quote; account balance change; navigate away/back; mobile viewport.
- Status: IN_REVIEW — source mitigation committed; runtime/browser verification pending.


## INT-ORDER-001 — Cancel action previously reported success without checking authoritative state

- Date: 2026-11-02
## VIS-3TO1-KLINE-001 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: 3->1
- Target team: 1号 Visual Team
- Route / viewport: `#/trade`；Mobile 320/360/375/390/430px 与 Desktop 1024/1280/1440/1920px
- Files: `assets/css/views-trade.css`（`.kline-drawer`、`.kline-drawer-body`、`#trade-chart`）；`assets/js/views-trade.js`（`placeChart`、ECharts 初始化、`openDrawer`）
- Type: UNKNOWN（验收证据缺口，不是已确认代码缺陷）
- Severity: SUGGESTION
- Standard: `AI-CORE.md` §4/§10/§11/§15；`MOBILE-DESKTOP-SEPARATE-STANDARDS.md`；`AI-REVIEW-AND-REMEDIATION.md`
- Evidence: 1号分支 HEAD `947feeaf46a3d1120b7616dbf636231511bd7081`；实现提交 `5d275021be8e66e1591302456f48e43c1d5b6bba`。1号 handoff/task board 标记 build/tests/browser QA 为 NOT RUN；3号本轮完成源码审查，未执行浏览器。
- Expected: 抽屉首次打开图表正常绘制；开合、周期切换、窗口 resize 和设备旋转后尺寸正确；移动入口不遮挡底部导航或内容。
- Actual: 源码布局关系合理，但运行时容器非零尺寸、ECharts 首次绘制和各 viewport 表现仍 UNKNOWN。
- User impact: 若隐藏状态下初始化尺寸不正确，用户可能看到空白或尺寸错误的 K线图；当前尚未复现。
- Recommendation: 1号按审查报告 `docs/REVIEW-3-TO-1-KLINE-DRAWER-2026-11-02.md` 完成指定移动/桌面 viewport 的真实浏览器测试并记录截图/录屏、浏览器、设备和步骤。
- Target team's response: PENDING
- Target team's owner: 1号 Visual Team
- Fix commit: N/A
- Retest evidence: PENDING
- Status: OPEN


## BUS-ENV-001 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: 3号自查 / Business safety escalation
- Target: 仓库负责人 / 部署负责人
- Type: DATA / SECURITY / FINANCIAL SAFETY
- Severity: P0
- Standard: `AI-CORE.md` §2/§9/§15；`AI-3-TASK.md` §4/§5；`BASELINE_REPORT.md` §Financial feature flags
- Evidence: 当前 `api/core.js` runtime predicates use `!== '0'` (unset => enabled); `scripts/deployment-preflight.js` counts only exact `'1'` as enabled (unset => not enabled). Financial write/matching paths additionally require Supabase configuration. See `docs/REVIEW-3-BUSINESS-API-ENV-2026-11-02.md`.
- Expected: runtime gate 与 preflight 对每个 flag 的启用/关闭语义一致；未经 staging approval 时所有资金写入/撮合 fail-closed。
- Actual: unset / `true` 等值在 runtime 与 preflight 中得出相反结果。
- User impact: 若 Supabase 凭据存在且 flag 未设置，Preflight 可能误报安全，而运行时允许后续金融路径；尚未证明 Production 当前配置，必须核对环境。
- Recommendation: owner 先核对 Preview/Production/Development 四个金融 flag，未获批准时显式设为关闭；再批准统一语义和测试矩阵。3号不擅自改金融 gate。
- Target owner: 仓库负责人 / 部署负责人；技术修复由3号在获批后执行。
- Fix commit: PENDING
- Retest: PENDING — unset/0/1/other matrix + isolated PostgreSQL staging.
- Status: OPEN / BLOCKER

## BUS-ENV-002 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: 3号 Business self-audit / deployment isolation escalation
- Target: 仓库负责人 / 部署负责人
- Type: CONTRACT / DATA / SECURITY
- Severity: P1
- Standard: `AI-CORE.md` §2/§9；`AI-3-TASK.md` §4/§5；`PHASE-1-BASELINE.md` §6
- Evidence: `assets/js/app-core.js` hard-codes `API_BASE = 'https://btcboxcdt.vercel.app/api'`; `apiFetch` routes all requests, including writes, through that origin with credentials. Current `vercel.json` CSP `connect-src` does not allow the canonical host as a cross-origin destination from Preview. See `docs/REVIEW-3-BUSINESS-API-ENV-2026-11-02.md`.
- Expected: Preview API requests use an explicitly isolated Preview backend or a verified same-origin API; CSP/CORS/cookie policies match that decision.
- Actual: API base is fixed to canonical host; Preview origin differs and CSP blocks the cross-origin destination. No Preview write request was attempted.
- User impact: Preview login/data QA may fail; relaxing CSP without backend isolation could route Preview writes to canonical backend.
- Recommendation: owner decides Preview API environment and approves a non-mutating routing test before any write testing.
- Target owner: 3号 Business Team for API adapter; deployment owner for Vercel/CSP settings.
- Fix commit: PENDING
- Retest: PENDING — Preview GET/POST routing and cookie/CORS checks without financial mutation.
- Status: OPEN


## BUS-MATCH-003 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: Business self-review / PostgreSQL matching readiness
- Target: 仓库负责人、数据库/部署负责人
- Type: DATA / CONTRACT
- Severity: P1
- Evidence: `supabase/sql/financial_matching_engine_v1.sql` defines `financial_matching_markets.enabled DEFAULT false`; reviewed migration creates the table but contains no market seed/upsert. `submit_limit_order_matching_v1` only accepts a pair with an explicit `enabled=true` row; otherwise it raises `market disabled or unconfigured`.
- Expected: each intended pair has an owner-approved, independently verified rule row before staging order acceptance.
- Actual: migration success alone leaves markets disabled/unconfigured.
- User impact: order submission remains unavailable, or unsafe guessed rules could be introduced if operators bypass the approval process.
- Recommendation: approve and document enabled state, price tick, quantity step, minimum quantity/notional and static price bounds per pair. Do not infer server rules from UI precision.
- Target owner: 仓库负责人 / 数据库负责人；3号提供接口契约审查。
- Fix commit: PENDING
- Retest: PENDING — isolated PostgreSQL migration plus pair configuration and RPC acceptance/rejection matrix.
- Status: OPEN / BLOCKER for staging order acceptance.

## BUS-MATCH-004 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: Business self-review / financial safety
- Target: 仓库负责人、产品/财务规则负责人、数据库负责人
- Type: FINANCIAL SAFETY / DATA
- Severity: P0
- Evidence: `financial_matching_markets.maker_fee_rate` and `taker_fee_rate` are constrained to exactly zero in `supabase/sql/financial_matching_engine_v1.sql`; the reviewed matching fill path has no fee debit/credit ledger legs.
- Expected: any approved non-zero fee schedule is calculated and settled atomically with maker/taker attribution, rounding, ledger entries and reconciliation.
- Actual: this SQL contract explicitly supports zero-fee fills only.
- User impact: enabling non-zero-fee funded trading on this implementation would produce incorrect fee accounting and financial records.
- Recommendation: keep funded matching disabled until the owner approves a fee policy and a separately reviewed migration/RPC implements and tests atomic fee accounting. Zero-fee tests, if approved, must use isolated non-production funds.
- Target owner: 仓库负责人 / 产品财务规则负责人；3号负责业务接口和账本审查。
- Fix commit: PENDING
- Retest: PENDING — fee edge cases, rounding, maker/taker, ledger reconciliation and rollback.
- Status: OPEN / BLOCKER.


## BUS-MATCH-005 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: Business self-review
- Target: 3号 Business Team / API adapter owner
- Type: DATA / FINANCIAL PRECISION / CONTRACT
- Severity: P1
- Evidence: `api/core.js` in `POST /api/order` converts `body.qty` and `body.price` to JavaScript `Number`, validates them, then forwards `String(qty)` and `String(price)` to PostgreSQL. The matching schema stores price/quantity as `numeric(38,18)` and validates tick/step there. JavaScript Number cannot preserve every decimal value supported by numeric(38,18); a high-precision decimal string can be rounded before the database validates it.
- Expected: submitted price/quantity decimal strings remain exact through request parsing, SQL validation and persistence; unsupported formats/precision are rejected without silently changing the value.
- Actual: conversion through binary floating point can change decimal digits before PostgreSQL receives the values. Source-confirmed precision-loss path; no live order or database mutation was used to reproduce it.
- User impact: an order may be rejected against tick/step rules or submitted with an altered price/quantity at high precision. Impact depends on pair precision and input values.
- Recommendation: preserve validated decimal strings at the API boundary and pass strings directly to PostgreSQL numeric parameters; use decimal-safe validation where arithmetic is required. Add regression cases with 18 fractional digits, tick/step boundaries, exponent notation rejection and round-trip equality.
- Target team's response: PENDING
- Target owner: 3号 Business Team
- Fix commit: PENDING
- Retest evidence: PENDING — API contract tests and isolated PostgreSQL numeric/tick/step tests.
- Status: OPEN / NEEDS FIX.

## BUS-LEDGER-006 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: Business self-audit / normalized account read-path consistency
- Target: 3号 Business Team / financial read API owner
- Type: DATA / FINANCIAL READ CONSISTENCY
- Severity: P1
- Evidence: `GET /api/account` uses normalized PostgreSQL snapshot data for balances, withdrawals and earn records when normalized reads are enabled, but always returns deposits from legacy `user.deposits.slice(-20)`. The normalized snapshot RPC returns no deposits, while the chain-verification flow credits `deposit_records` through the normalized ledger.
- Expected: deposit history is sourced from the same normalized authority as credited deposits, with explicit status mapping and pagination.
- Actual: the account response mixes normalized financial data with legacy deposit history; normalized credited deposits are not guaranteed to appear in the account history.
- User impact: users may see missing or stale deposit history despite a normalized deposit credit.
- Recommendation: add a reviewed normalized deposit-history read RPC and switch the account response consistently; do not reintroduce legacy financial writes.
- Fix commit: PENDING
- Retest: PENDING — isolated PostgreSQL fixture with pending/confirmed/rejected deposits and account API response reconciliation.
- Status: OPEN / NEEDS FIX

## BUS-LEDGER-007 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: Business self-audit / financial numeric precision
- Target: 3号 Business Team / financial read API owner
- Type: DATA / FINANCIAL PRECISION
- Severity: P1
- Evidence: normalized read SQL emits PostgreSQL high-precision numeric free/frozen balances as JSON numbers; `response.json()` parses them into JavaScript Number, and `GET /api/account` performs arithmetic and returns those Number values. PostgreSQL numeric(38,18) values are not all exactly representable as binary floating point.
- Expected: exact financial quantity fields retain decimal fidelity from database through API serialization; only derived valuations may be approximate and must be identified as such.
- Actual: decimal digits can be rounded in the API read path before serialization and during valuation arithmetic.
- User impact: free/frozen balance display or derived totals may differ at high decimal precision. No ledger mutation or reproduced discrepancy was observed.
- Recommendation: preserve decimal strings in balance contracts and use decimal-safe valuation; test 18 fractional digits and large values with round-trip assertions.
- Fix commit: PENDING
- Retest: PENDING — PostgreSQL-to-API decimal round-trip and valuation reconciliation.
- Status: OPEN / NEEDS FIX

## BUS-WD-008 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: 3号 peer review / 2号 Interaction Team
- Target owner: 2号 Interaction Team
- Type: WITHDRAWAL STATE / FINANCIAL SAFETY / UX
- Severity: P1
- Evidence: target branch `feature/ai2-interaction`, `assets/js/views-assets.js`: `wdResultState(r)` maps every `!r.ok` to definite “Submission Failed” and “Your balance was unchanged”; each submit generates a new `request_id: uid()`. Backend `main` `api/core.js` returns 503 `FINANCIAL_RPC_FAILED/UNAVAILABLE` when withdrawal outcome is unconfirmed and explicitly instructs the user to check history before retrying.
- Expected: definite rejection and unknown outcome are separate states. Unknown outcome retains the original idempotency key and requires history reconciliation before a new submit.
- Actual: ambiguous 503 outcomes are shown as definite failures; a new attempt gets a new idempotency key, so original RPC idempotency does not prevent a second withdrawal request.
- User impact: user may retry a withdrawal that was actually committed, potentially creating a second request/reservation. No duplicate was reproduced.
- Recommendation: 2号 adds UNKNOWN / CHECK HISTORY flow and retains the original request ID until reconciliation; coordinate API semantics with 3号.
- Report: `docs/REVIEW-3-TO-2-WITHDRAWAL-UNKNOWN-STATE-2026-11-02.md`.
- Retest: PENDING — simulated definite 4xx rejection, ambiguous 503 after commit, ambiguous 503 before commit, history reconciliation, same-key replay and no new-key retry.
- Status: OPEN / ACTION REQUIRED

## BUS-WD-009 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: Business self-audit / withdrawal lifecycle readiness
- Target owner: 3号 Business Team + database/withdrawal operations owner
- Type: FINANCIAL LIFECYCLE / LEDGER / OPERATIONS
- Severity: P1 / production withdrawal blocker
- Evidence: `financial_lifecycle_v2.sql` creates withdrawals as `pending`; `review_withdrawal_atomic` changes status to `approved` and decreases frozen balance by amount+fee. `api/core.js` explicitly says approval is not broadcast to chain. `read_admin_withdrawal_snapshot_v1` selects only `pending` and returns empty txid. No broadcaster/outbox, txid persistence, broadcast retry, chain confirmation or terminal completion path was found in the reviewed lifecycle files.
- Expected: approval retains a visible reserved state until a durable broadcaster job is claimed; txid, broadcast attempts, confirmation and terminal status are persisted; admin queue includes all nonterminal states.
- Actual: approved withdrawal leaves the pending queue after frozen amount is removed; reviewed contract has no subsequent dispatch/finalization operation.
- User/operational impact: an approved request may disappear from the admin queue without evidence of chain dispatch or completion if this contract is enabled as-is. No live operation or loss was reproduced; external broadcaster infrastructure remains UNKNOWN.
- Recommendation: block production withdrawal cutover until a durable outbox/broadcaster lifecycle and reconciliation are implemented and tested. Do not release frozen funds at approval.
- Report: `docs/REVIEW-3-WITHDRAWAL-LIFECYCLE-GAPS-2026-11-02.md`.
- Retest: PENDING — isolated PostgreSQL end-to-end create/review/broadcast retry/txid/confirmation/failure/refund and ledger reconciliation matrix.
- Status: OPEN / BLOCKER for production withdrawal enablement


## INT-KYC-001 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: 3->2 peer review; backend response contract coordination with 3号
- Target owner: 2号 Interaction Team + 3号 API contract owner
- Type: KYC STATE / DATA CONTRACT / UX
- Severity: P1
- Evidence: `main` `api/core.js` returns `kyc: user.kyc` as an object and `kyc_level=1` for pending; 2号 `assets/js/app-core.js` assigns `status:r.kyc` (the object) rather than `r.kyc.status`. KYC views compare status to string 'pending' but treat `level>=1` as approved/verified and expose Advanced Verification.
- Expected: status and level remain separate; pending must never display approved/verified or unlock next-level actions.
- Actual: pending response cannot satisfy the frontend pending string check; pending level 1 follows Approved/Verified UI branches.
- User impact: user may believe KYC passed while it remains pending and may see an incorrect next-step action. Source-derived; runtime not reproduced.
- Recommendation: agree on a minimal explicit API/state contract and test unverified/pending/approved/rejected/locked × level 0/1/2 across refresh and language changes.
- Report: `docs/REVIEW-3-TO-2-STATUS-AND-RUNTIME-2026-11-02.md`.
- Status: OPEN / ACTION REQUIRED

## INT-ORDER-001 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: 3->2 peer review
- Target owner: 2号 Interaction Team
- Type: ORDER STATE / UX / DATA CONSISTENCY
- Severity: P1
- Evidence: peer review report `docs/REVIEW-3-TO-2-STATUS-AND-RUNTIME-2026-11-02.md` confirmed that the prior handler ignored the cancel response and displayed success unconditionally.
- Fix: after the cancel request, the UI now refreshes `GET /api/orders` and the account snapshot. It shows success only when the refreshed authoritative order state is `cancelled`/`canceled`; a filled race, still-active order, or failed status refresh receives a non-success warning.
- Implementation commits: `048a4d68d71d6fa791c480c6d449e482479eede2` and `333568e6f8f5d2c1dbf3a12f605f4448bb926767`.
- API/backend/database changes: NO.
- Retest: NOT RUN — confirmed cancel, rejected cancel, filled race, partial-fill race, timeout-after-commit, timeout-before-commit, order refresh failure and balance refresh.
- Status: IN_REVIEW — source mitigation committed; runtime/API verification pending.

## INT-ORDER-002 — Partially filled orders were hidden from Open Orders and could not be canceled

- Date: 2026-11-02
- Reporter: 3号 Business Team
- Direction: 3->2 peer review
- Target owner: 2号 Interaction Team
- Type: ORDER STATE / MATCHING CONTRACT / UX
- Severity: P1
- Evidence: peer review confirmed the backend matching contract treats `partially_filled` as active while the previous UI classified every non-`open` state as history.
- Fix: active-order classification now includes both `open` and `partially_filled`; History contains terminal/non-active states; Cancel remains available for either active state. Filled and remaining quantities are shown only when source values are valid.
- Implementation commits: `e12d45ef577d19462f329cba28da36df0429c9e7` and `69ad8461c66baa8123da31f5e2167bc2842b23c8`.
- Backend status contract and matching rules: NOT changed.
- Retest: NOT RUN — open, partial fill, cancel remaining quantity, fully filled, cancelled, competing fill/cancel and reload.
- Status: IN_REVIEW — source mitigation committed; runtime/matching verification pending.

## INT-KYC-001 — Pending KYC was displayed as approved because the API status object was treated as a tier number

- Date: 2026-11-02
- Reporter: 3号 Business Team
- Direction: 3->2 peer review
- Target owner: 2号 Interaction Team; API semantics require 3号 confirmation
- Type: KYC STATE / DATA CONTRACT / UX
- Severity: P1
- Evidence: the account API returns `kyc` as an object and derives `kyc_level` from status (`pending=1`, `approved=2`). The previous view treated any level >=1 as approved and compared the object itself to the string `pending`.
- Fix: KYC views now normalize `state.kyc.status.status` when the status is an object, prioritize Pending over approval, and mark Basic Verification approved only for explicit `status='approved'`. The status-derived `kyc_level` is no longer presented as a verified tier; Advanced Verification remains locked until a separate tier contract is confirmed. The My Account badge follows the same status-first rule.
- Implementation commits: `e58ef5987cebbc5f4fc252c0aa176c3a105e883a` and `50f1e43a69cd82b2a5facb3891deeb3345d94fde`.
- API mapper/backend/authentication/withdrawal permissions: NOT changed.
- Open contract question: 3号 must confirm whether `kyc_level` is a status code or an actual tier, and define the approved tier/withdrawal entitlement mapping. No permission is inferred by this UI mitigation.
- Retest: NOT RUN — unverified, pending, approved, rejected, locked, refresh, account switch and withdrawal permission consistency.
- Status: IN_REVIEW — false-pending-as-approved display mitigated; tier/permission contract pending.

## INT-1-006 — My Account profile card click target did not match its handler

- Date: 2026-11-02
- Reporter: 1号 Visual Team
- Direction: 1->2 peer review
- Target owner: 2号 Interaction Team
- Type: BUG / ACCESSIBILITY / UX
- Severity: P2
- Evidence: the view handler queried `#me-profile`, but the rendered profile card had no matching ID.
- Fix: added the matching ID and button semantics (`role=button`, `tabindex=0`, accessible label), and wired Enter/Space to activate the existing profile details modal.
- Implementation commit: `50f1e43a69cd82b2a5facb3891deeb3345d94fde`.
- Account data/authentication behavior: NOT changed.
- Retest: NOT RUN — pointer, Enter, Space, focus visibility, modal close and mobile.
- Status: IN_REVIEW — selector and keyboard behavior committed; runtime verification pending.


## INT-2-005 — 1号 My Account hub still presented a stale balance snapshot and status-derived KYC tier

- Date: 2026-11-02
- Reporter / repair owner: 2号 Interaction Team
- Direction: 2->1 peer review; 2号 repair commit on its own branch
- Target file: `assets/js/views-missing.js`, `VIEWS.me()`
- Type: DATA TRUTH / ACCOUNT STATE / UX
- Severity: P1
- Evidence on `feature/ai1-visual` at SHA `c38cc27e77d49d427fd76bdca9bdec4164bd9e7e`: My Account rendered `state.balances[*].usdt` and USDT free/frozen amounts as a balance snapshot with no market freshness indicator or refresh loop; the same view treated `state.kyc.level >= 1` as Verified and read `state.kyc.status` as a string although the account contract may provide a status object. This can show stale portfolio values and Pending as Verified.
- Repair: adopted the new grouped My Account information architecture; removed the duplicate numeric asset snapshot and linked to the dedicated Assets page instead; status-first KYC badge now normalizes object/string status and distinguishes Pending from explicit Approved. Profile details and logout remain semantic buttons with their existing handlers.
- Implementation commit on `feature/ai2-interaction`: `761741338eb3e3d6572e059c8c57af75f635f3a8`.
- Required 1号 follow-up: port the corrected `VIEWS.me()` interaction markup/status logic into the 1号 integration branch without reintroducing a static asset valuation; retain the matching `.va-hub-*` CSS owned by 1号.
- Retest: NOT RUN — pending/approved/unverified account states, market changes while My Account is open, route navigation, profile modal, logout confirmation, preview routes and 320/360/375/430px layouts.
- Status: FIXED ON 2号 BRANCH / NEEDS INTEGRATION — source mitigation committed; runtime/browser verification pending.


## Integration follow-up — INT-2-005 My Account hub review — 2026-11-02

- 2号's reviewed implementation commit `761741338eb3e3d6572e059c8c57af75f635f3a8` has been integrated into 1号 branch `feature/ai1-visual` in commit `36e8e4b8e7b229b0897e9b41bd4ff25c32681a71`.
- The integrated view removes the numeric balance snapshot, links to the Assets workspace, normalizes KYC object/string status and only displays Verified for explicit `approved`; it also preserves semantic profile/logout buttons and Enter/Space profile activation.
- 1号 retains the `.va-hub-*` visual system and responsive layout. No account API mapper, backend, financial operation or route contract was changed in this integration.
- 3号 follow-up remains required: confirm API status vocabulary, level semantics, KYC rejected/unsubmitted/locked states and preview-only payment/referral capability truth.
- Syntax compile of the isolated My Account block: PASS. Runtime/browser/build/automated tests: NOT RUN.
- Status: INTEGRATED INTO 1号 BRANCH / RUNTIME QA PENDING.


## 1号 handoff — Support Center visual refresh re-review — 2026-11-02

- Review 1号 branch `feature/ai1-visual` commit `76b85da92b9af76ac36c9d202a7c880da962f6b9` (`assets/js/views-account.js`) and CSS commit `f711ec49479f0cbc514922f56605509a721fd448`.
- Visual scope: replaced unverified static Online/service-hours claims with neutral message-center copy; added responsive support intro, message header, quick-topic group and accessible labels. Existing `chat-body`, `chat-input`, `chat-send`, `.chat-q` selectors remain unchanged; event/API handlers were not changed.
- Required 2号 checks: verify send button, Enter submission, quick-topic buttons, message scroll, focus and aria-live behavior. Also review `INT-1-008`: current message renderer concatenates `m.text` into `innerHTML`; trace trust boundary and escape/render as text if content is untrusted. Preserve API payload and chat behavior.
- Build/browser/device QA NOT RUN. Return source evidence and fix commit if required.



## INT-2-006 — Support messages appear delivered even when the send request fails

- Date: 2026-11-02
- Reporter / reviewer: 2号 Interaction Team
- Direction: 2->1 peer review
- Target owner: 2号 Interaction Team; API delivery semantics require 3号 confirmation
- Type: SUPPORT FLOW / DELIVERY STATE / DUPLICATE SUBMISSION
- Severity: P1
- Evidence: `assets/js/views-account.js` on `feature/ai1-visual` (reviewed blob `851338c1c598229386698dcd26c78201ecf8de70`), `VIEWS.support.afterRender()`: `send()` pushes the message into `state.supportMsgs` and renders it before `apiAdapter.supportChat()` resolves; on rejection it only shows a toast and leaves the message displayed as an ordinary user message. The input is cleared before delivery is confirmed. The returned API result is ignored.
- User impact: a user can reasonably believe a failed message was sent, lose the text they typed, and have no reliable retry/reconciliation path. A success-shaped chat transcript is shown without delivery confirmation.
- Expected: represent Sending / Sent / Failed / Unknown distinctly; preserve failed text for retry; reconcile ambiguous timeout before retrying; show success only when the API confirms acceptance. Prevent Enter, quick-topic and button paths from submitting concurrently.
- Recommendation: 2号 to define the interaction state and repair on its own branch; 3号 to confirm the supportChat response contract and idempotency/reconciliation options. Preserve existing API payload.
- Retest: NOT RUN — successful send, explicit API rejection, timeout before/after server acceptance, retry, repeated Enter, quick-topic during pending, route leave/return.
- Status: OPEN — source-confirmed interaction defect; no code changed in this review.

## INT-2-007 — Support chat renders user-controlled message text through innerHTML

- Date: 2026-11-02
- Reporter / reviewer: 2号 Interaction Team
- Direction: 2->1 peer review
- Target owner: 2号 Interaction Team; 3号 to confirm whether server-originated content can enter this collection
- Type: SECURITY / CONTENT RENDERING / SUPPORT UX
- Severity: P1
- Evidence: same file and reviewed blob as INT-2-006. In `VIEWS.support.afterRender()`, `render()` builds message markup with `state.supportMsgs.map(... + m.text + ...)` and assigns it to `body.innerHTML`. The `send()` handler places raw `text.trim()` from the user's input into `state.supportMsgs` before calling render. Thus user-controlled text is interpreted as HTML rather than displayed as text.
- User impact: typed markup can alter the conversation DOM and may execute event-handler HTML in the user's own session; it can also spoof message structure or break the layout. If server-originated messages are later added to the same collection, the impact may extend to cross-user content injection depending on the trust boundary.
- Expected: render message bodies as text nodes / `textContent` (or use a reviewed, allowlist-based sanitizer only if rich text is an explicit product requirement); keep sender labels and structural markup separate from message content.
- Recommendation: 2号 to fix the renderer on its own branch; 3号 to trace whether any API-returned content is inserted into `state.supportMsgs`. Do not change the support API payload.
- Retest: NOT RUN — plain text, angle brackets, HTML tags, event-handler payloads, long text, multiline text and server-originated content if applicable.
- Status: OPEN — source-confirmed unsafe rendering pattern; runtime exploit test NOT RUN.

## INT-2-008 — KYC form tells users document photo upload is not required

- Date: 2026-11-02
- Reporter / reviewer: 2号 Interaction Team
- Direction: 2->1 / 2->3 cross-team review
- Target owner: 2号 Interaction Team for user journey/copy; 3号 for KYC evidence and API requirements
- Type: KYC FLOW / TRUST / FORM COMPLETENESS
- Severity: P1
- Evidence: `assets/js/views-account.js` on `feature/ai1-visual` (reviewed blob `851338c1c598229386698dcd26c78201ecf8de70`), `VIEWS.kyc()` renders a Document Photo field whose text says `No photo upload is required in this version; submit your document details below.`; `VIEWS.kyc.afterRender()` binds the upload area to a toast repeating that no photo is required. The submit payload contains only `name`, `id_type` and `id_number`.
- User impact: users are asked to submit identity verification but are explicitly told no document image is needed. This can create a false expectation that verification is complete/meaningful, while the actual review evidence and acceptance criteria are unclear. The upload-shaped field also looks interactive but only produces an informational toast.
- Expected: 3号 must confirm the authoritative KYC evidence/API requirements and whether this is intentionally a limited preview. Until confirmed, clearly label the flow as a non-production/demo request and do not imply full identity verification; if document images are required, provide a real upload path with progress, type/size validation, failure recovery and secure submission. The upload affordance must not pretend to be an active control.
- Retest: NOT RUN — unverified/pending/approved/rejected states, upload success/failure, invalid type/size, retry, refresh and server-side evidence persistence.
- Status: OPEN — source-confirmed user journey gap; backend requirements NOT CONFIRMED.


## INT-2-009 — Deposit address refresh can display a stale network address and has no rejection recovery

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (UI owner and deposit API contract to confirm)
- Target team: 1号 Visual Team for view integration; 3号 Business Team for API response semantics
- Route / viewport: Assets > Deposit; coin/network switching
- File / selector / function: `assets/js/views-assets.js` `VIEWS.deposit.afterRender()` / `refresh()`, lines 151-174
- Type: BUG / FINANCIAL UX
- Severity: P1
- Evidence: every coin/network change starts `apiAdapter.deposit({coin, network})`; the promise callback writes the returned address into the current `#dep-addr` without checking whether the selected coin/network still matches the request that produced the response. There is no `.catch()` or visible error recovery. A slow earlier request can therefore overwrite a later selection; a rejected request can leave “Loading address…” displayed indefinitely.
- Expected: response must be bound to the exact current coin/network selection; stale responses ignored; loading ends on both success and failure; retry is available; no address is shown as belonging to a different network.
- Actual: response order, rather than current selection, controls the displayed address; rejected requests have no handled state.
- User impact: user could copy an address for the wrong selected network or be unable to tell whether address loading failed. This is a funds-loss risk.
- Recommendation: add request identity/selection guards and explicit loading/error/retry states; preserve the API payload. 3号 to confirm whether deposit address lookup is read-only and whether response includes canonical network metadata.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — deliberately delayed out-of-order responses, network switch during loading, rejected request, retry, coin switch and address/QR consistency.
- Status: OPEN


## INT-2-010 — Deposit copy controls report success without verifying that copying succeeded

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1
- Target team: 1号 Visual Team
- Route / viewport: Assets > Deposit; address and memo copy controls
- File / selector / function: `assets/js/views-assets.js` `VIEWS.deposit.afterRender()`, lines 192-193
- Type: BUG / UX
- Severity: P2
- Evidence: both copy handlers call `document.execCommand('copy')` inside a try/catch, ignore its boolean result, and unconditionally show “Address copied to clipboard.” / “Memo copied to clipboard.”. The address handler also has no guard against the loading/error placeholder.
- Expected: copy only a real address/memo; use the supported clipboard API with a fallback; report success only after confirmed success and show a useful failure state otherwise.
- Actual: the UI can tell the user an address or memo was copied when no copy occurred, including while the address field contains a loading/error placeholder.
- User impact: user may paste an empty, stale or wrong destination into an external wallet and mistakenly believe it was verified.
- Recommendation: implement guarded copy feedback; disable copy while loading/unavailable; do not change deposit API behavior.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — supported clipboard, permission denied, unavailable API, empty/loading/error value, address and memo.
- Status: OPEN


## INT-2-011 — Withdrawal submission rejection leaves the user without a result and may leave the submit button locked

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (view owner and transport contract to confirm)
- Target team: 1号 Visual Team for view integration; 3号 Business Team for authoritative operation lookup
- Route / viewport: Assets > Withdraw > Security > Submit Withdrawal
- File / selector / function: `assets/js/views-assets.js` `VIEWS.withdraw.afterRender()` submit handler, lines 383-404
- Type: BUG / FINANCIAL UX
- Severity: P1
- Evidence: the handler disables the submit button and awaits `apiAdapter.withdraw(...)` without try/catch/finally. If the adapter promise rejects (rather than resolving to an `{ok:false}` object), execution never reaches the button reset or `showResult()`.
- Expected: all promise outcomes restore the control safely and show a clear state; ambiguous transport outcomes must remain UNKNOWN and trigger operation reconciliation, not invite a fresh withdrawal with a new request ID.
- Actual: rejected promise can strand the button in “Submitting…” and provide no result, status, or recovery path. This compounds the existing INT-3-006 unknown-withdrawal reconciliation issue.
- User impact: user cannot tell whether a withdrawal was received and may reload or submit another withdrawal without knowing the first outcome.
- Recommendation: add guaranteed UI cleanup and a distinct unknown/reconciliation state; coordinate same-request idempotency and status lookup with 3号. Do not alter withdrawal business rules or API payload independently.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — network rejection before/after server acceptance, timeout, explicit rejection, retry with same logical request, reload/reconciliation.
- Status: OPEN


## INT-2-012 — Seconds contract price and order/settlement failures can break the interaction state

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (view owner and seconds API contract to confirm)
- Target team: 1号 Visual Team for view integration; 3号 Business Team for authoritative position state and settlement contract
- Route / viewport: Trade > Seconds Contracts
- File / selector / function: `assets/js/views-trading.js` `VIEWS.seconds.afterRender()`, lines 31-64
- Type: BUG / FINANCIAL UX
- Severity: P1
- Evidence: `updPrice()` reads `market[coin+'USDT']` and immediately accesses `.price` without checking that a quote exists or is positive; `open()` awaits `apiAdapter.secondsOrder()` without try/catch/finally, so a rejected promise can leave `busy=true`; expiry calls `apiAdapter.secondsSettle()` without a rejection handler and unconditionally clears `busy` before authoritative settlement is confirmed.
- Expected: missing/stale quotes disable order entry with a clear state; order request failures always restore controls while preserving UNKNOWN outcomes for reconciliation; expiry remains pending until authoritative settlement is confirmed; no result is fabricated from a failed settlement request.
- Actual: missing quote can throw during render/update; rejected order can permanently block new entries for the page session; rejected settlement can leave the position unresolved while the UI unlocks the next position.
- User impact: users may see a broken price area, be unable to place a valid position, or believe a new position can be opened while the prior one has not been authoritatively settled.
- Recommendation: 1号 to add quote availability/freshness guards and robust user states; 3号 to confirm authoritative position status/settlement lookup and idempotency. 2号 reviews the resulting interaction. Keep the locked spot trading-page layout untouched.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — missing/stale quote, rejected order before/after server acceptance, expiry settlement timeout, page navigation during countdown, reload and authoritative history reconciliation.
- Status: OPEN


## INT-2-013 — Order cancellation and settlement actions lack user-visible failure recovery

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3
- Target team: 1号 Visual Team for order view; 3号 Business Team for cancellation/settlement status contract
- Route / viewport: Orders > Open Orders; Trade > Seconds > Open Positions
- File / selector / function: `assets/js/views-trading.js` `VIEWS.orders.afterRender()` cancel callback, lines 111-124; seconds settlement callback, lines 57-62
- Type: BUG / FINANCIAL UX
- Severity: P1
- Evidence: order cancellation awaits `apiAdapter.cancelOrder(id)` without handling rejection or checking the returned result before showing “Order canceled.” and re-rendering. Seconds settlement similarly has no rejection handler and derives the toast from local `state.secondsPositions.history[0]` after the promise resolves without validating an authoritative response.
- Expected: success feedback only after confirmed server acceptance and refreshed authoritative order/position state; failures and unknown outcomes remain visible and recoverable without duplicate financial actions.
- Actual: a rejected cancellation produces no clear recovery message; a resolved but unsuccessful response may still be presented as cancelled. Settlement failure is unhandled.
- User impact: users may believe an open order was cancelled when it remains active, or misread the state of a seconds position.
- Recommendation: validate adapter result contracts, refresh authoritative state before success feedback, and provide pending/unknown recovery. 3号 to confirm cancellation and settlement response semantics; 1号 to integrate interaction handling.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — cancel success, server rejection, timeout before/after acceptance, already-filled race, settlement rejected/unknown, refreshed order/position state.
- Status: OPEN


## INT-2-014 — Closing the 2FA setup/disable dialog leaves the Settings action permanently busy

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (view integration and modal/API flow owners to confirm)
- Target team: 1号 Visual Team for Settings view integration; 3号 Business Team for 2FA flow contract
- Route / viewport: My > Settings > Two-Factor Authentication
- File / selector / function: `assets/js/views-account.js` `VIEWS.settings.afterRender()` lines 270-278; `assets/js/app-core.js` `apiAdapter.twofaEnable()` / `twofaDisable()` lines 359-375; `assets/js/ui-components.js` `BTCBox.modal()` lines 35-56, 64-68
- Type: BUG / ERROR RECOVERY
- Severity: P2
- Evidence: Settings sets the 2FA button disabled before awaiting `twofaEnable()` or `twofaDisable()`. Both adapter methods return a Promise that is resolved only by the form submit handler. The modal defaults to `closable:true`, and its X button, Escape key and mask click call `close()`; those close paths do not resolve or reject the adapter Promise. The Settings handler therefore never reaches its button restoration or router refresh after the user cancels/closes the dialog.
- Expected: explicit cancel/close should resolve a cancellation result; the Settings control must always leave its processing state and accurately preserve the current 2FA status.
- Actual: closing the verification dialog without submitting leaves the awaiting Promise unsettled and the Settings button stuck disabled/“Processing…”.
- User impact: user may be unable to retry enabling/disabling 2FA without reloading the page, and may not understand whether the security change occurred.
- Recommendation: add a single-settlement Promise path for success, rejection and cancellation (including X/Escape/mask); use finally in the Settings handler; refresh security status only after confirmed result. Keep 2FA API semantics unchanged.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — enable and disable flows; close by X, Escape, mask, invalid code then corrected code, API rejection and confirmed success.
- Status: OPEN


## INT-2-015 — Hide Small Balances preference reports “saved” but is only held in volatile page state

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (preference persistence owner to confirm)
- Target team: 1号 Visual Team for Settings interaction; 3号 Business Team only if a server-side preference contract is intended
- Route / viewport: My > Settings > Preferences > Hide Small Balances
- File / selector / function: `assets/js/views-account.js` `VIEWS.settings.afterRender()` line 279; `assets/js/app-core.js` initial `state.settings` line 55 and `applyAccount()` lines 201-211
- Type: BUG / UX / STATE PERSISTENCE
- Severity: P2
- Evidence: the checkbox handler only assigns `state.settings.hideSmall=e.target.checked` and immediately shows “Preference saved.”. The initial state defaults `hideSmall:false`; `applyAccount()` hydrates 2FA and fund-password flags but does not hydrate this preference; no storage/API write is invoked by the checkbox handler.
- Expected: either persist the preference to a defined durable store and restore it on next visit/session, or label it as session-only and do not claim it has been saved.
- Actual: the preference is changed only in in-memory state, so it resets when the app reloads/reinitializes while the UI has already confirmed “Preference saved.”
- User impact: users expect small balances to remain hidden, but the preference can silently revert after refresh or sign-in.
- Recommendation: 1号 to correct the feedback and wire a documented persistence mechanism; 3号 to confirm whether account preferences belong in the account API. Do not invent a new API payload without contract approval.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — toggle on/off, route change, full reload, sign-out/sign-in and multiple devices if server-persisted.
- Status: OPEN



## INT-2-016 — Authentication form submissions do not guarantee recovery after rejected promises

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (auth view and adapter flow owners to coordinate)
- Target team: 1号 Visual Team for auth form interaction; 3号 Business Team for auth endpoint/result semantics
- Route / viewport: Login, Register, Login > 2FA, Forgot Password, Password Recovery
- File / selector / function: `assets/js/views-home.js` `VIEWS.login.afterRender()` / `VIEWS.register.afterRender()`; `assets/js/app-core.js` `Auth.login()` / `Auth.register()` / `Auth.showForgotPassword()` / `Auth.showResetPassword()`
- Type: BUG / ERROR RECOVERY
- Severity: P1
- Evidence: login and registration handlers disable their submit buttons, then await Auth.login/Auth.register without try/catch/finally; restoration statements are reached only when the awaited call resolves. The login 2FA submit handler similarly awaits apiAdapter.login2fa without rejection handling, and reset-password awaits Supabase updateUser without a catch/finally. Forgot-password also awaits its adapter without guaranteed cleanup. The common apiFetch catches fetch() rejection, but response.text() is awaited outside that catch and can still reject; Supabase SDK calls can reject as well.
- Expected: every async auth action must restore its control in finally, preserve entered values, and show a useful error for rejected transport/SDK promises. 2FA retry must remain available after transient errors; password recovery must distinguish invalid/expired recovery session from a failed password update.
- Actual: an exceptional rejected promise can leave a button disabled/“Signing in…”, “Creating…”, “Verifying…” or “Updating…” with no actionable explanation.
- User impact: users can become stuck in login/registration/recovery and may reload or repeat actions without knowing the previous outcome.
- Recommendation: use try/catch/finally in each form handler and normalize adapter/SDK failures into explicit result states; preserve API payloads and auth policy. Do not claim a login/registration outcome on an unknown result.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — rejected fetch body read, SDK rejection, offline/timeout, 2FA retry, recovery expired/invalid token, button and input restoration.
- Status: OPEN


## INT-2-017 — Google OAuth callback errors are not surfaced and stored return target is not validated before navigation

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (callback UI and OAuth integration owners to coordinate)
- Target team: 1号 Visual Team for callback UX; 3号 Business Team for OAuth exchange/session contract
- Route / viewport: Login or Register > Continue with Google > OAuth callback
- File / selector / function: `assets/js/boot.js` `boot()` OAuth callback block and `applyGoogleButtons()`
- Type: BUG / UX / NAVIGATION SAFETY
- Severity: P2
- Evidence: callback detection only redirects when `_isAuthCallback && state.user`; OAuth error parameters such as `error` / `error_description` are not inspected or rendered. When callback/session exchange fails, execution falls through to the normal router without explaining whether Google sign-in was cancelled, denied or failed. When a local session is present, `sessionStorage.oauth_return_to` is passed directly to `location.replace()` without validating same-origin and an allowed in-app path. Current button code writes a fixed same-origin URL, but the consuming navigation trusts the stored value.
- Expected: callback success, user cancellation, provider denial, token exchange failure and missing session each produce a clear safe state; redirect destinations must be constrained to the current origin and an allowlisted in-app route.
- Actual: callback failures can silently return users to the login view, and the return target is consumed without validation.
- User impact: users cannot tell why Google authentication failed and an unexpected stored destination could navigate away from BTCBOX after authentication.
- Recommendation: parse and display provider callback errors safely; distinguish cancellation from failure; validate the stored destination against exact origin plus approved path/hash before redirect, otherwise use `#/markets`. Preserve Supabase OAuth configuration and redirect URI contract.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — success, cancel, provider denial, malformed callback, failed supabase-login exchange, absent/invalid/cross-origin return target, refresh/re-entry.
- Status: OPEN


## INT-2-018 — Order history renders invalid dates and misleading zero values when source fields are absent

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 / 2->3 (orders view and response contract owners to coordinate)
- Target team: 1号 Visual Team for history presentation; 3号 Business Team for order response field guarantees
- Route / viewport: Orders > Open Orders / Order History / Trade History
- File / selector / function: `assets/js/views-trading.js` `VIEWS.orders.afterRender()` `render(tab)` / `openDetail(o)`; `assets/js/app-core.js` `applyAccount()` / `apiAdapter.orders()`
- Type: BUG / DATA PRESENTATION
- Severity: P2
- Evidence: history rows call `new Date(o.created_at).toLocaleString()` without checking whether created_at exists or parses to a valid date; trade rows do the same with `t.time`. Detail view has a fallback between created_at/time but also formats invalid values without validation. Missing order price/quantity fields are normalized to Number(...||0) in applyAccount and rendered as formatted zeroes, which can make unavailable data look like a real zero-price/zero-quantity order. The view renders the current in-memory arrays immediately and does not itself request a fresh order list when entering or switching to Order History.
- Expected: missing/invalid timestamps render a neutral em dash or explicit unavailable label; missing numeric fields remain unavailable rather than fabricated zeroes; history should have explicit loading/empty/error states and refresh from the authoritative orders endpoint according to the agreed contract.
- Actual: malformed/missing fields can appear as “Invalid Date” or plausible numeric zeroes, and the user can see a blank empty state if the in-memory list has not been hydrated.
- User impact: order records look unprofessional and can mislead users about when or at what price/quantity an order was placed.
- Recommendation: validate timestamp and numeric field presence before formatting; do not coerce absent authoritative fields to zero; confirm whether GET /api/orders is loaded during account hydration and define a refresh/error contract with 3号. Keep the locked trade workspace layout unchanged.
- Target team's response: PENDING
- Fix commit: pending
- Retest evidence: pending — missing/null/invalid timestamps, zero as a legitimate value, missing price/quantity, empty history, API rejection, delayed response and route re-entry.
- Status: OPEN


## INT-1-003 — K-line requests have no loading/error recovery and can apply stale timeframe responses

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 (visual integration review; coordinate with 3号 for quote/request contract)
- Target team: 1号 Visual Team for chart presentation and timeframe controls; 3号 Business Team for K-line request freshness/error contract
- Route / viewport: `#/trade/:symbol` and `#/kline/:symbol`; desktop and mobile
- File / selector / function: `assets/js/views-trade.js` `VIEWS.trade.afterRender()` lines 181-196; `VIEWS.kline.afterRender()` lines 368-382; `candleOption()`
- Type: UX / DATA / REALTIME / ERROR RECOVERY
- Severity: P1
- Evidence: source SHA `a73a0e577acd1fc837f1856e0e89542e11603e03`. Both chart views call `apiAdapter.kline(...).then(...)` without a rejection handler or explicit loading/empty/error state. The timeframe click handlers immediately update the active button and launch another request, but do not associate the response with the selected interval/request; a slower earlier response can therefore overwrite the newer selected interval. The fullscreen view renders a static `LIVE DATA` tag before any successful K-line response is confirmed. No source-level runtime proof is claimed.
- Expected: chart shows Loading until the selected symbol/interval response is confirmed; empty, stale, offline and request-error states are distinguishable; only the latest request for the currently selected symbol/interval may update the chart; the LIVE indicator reflects an actual live/connected state rather than a static label.
- Actual: a rejected request can leave an empty chart with no recovery guidance; out-of-order timeframe responses can mismatch the active interval and displayed candles; the fullscreen label can imply live data before confirmation.
- User impact: users may read stale candles as the selected timeframe, mistake an unavailable chart for a frozen market, or believe data is live when it is not.
- Recommendation: 1号 to add explicit chart loading/empty/error/stale visual states and keep timeframe control state aligned with the rendered dataset; 3号 to expose request/connection freshness semantics and confirm the returned interval/symbol. Guard responses by request identity plus current symbol/interval before calling setOption; provide retry without inventing candles. Preserve the locked trading-page layout and chart placement.
- Target team's response: PENDING
- Target team's owner: 1号 Visual Team (chart UI integration); 3号 Business Team (request/freshness contract)
- Fix commit: pending
- Retest evidence: pending — reject/timeout, empty response, offline, delayed 1m then fast 5m response, rapid 1m/5m/15m switching, pair switch during request, mobile drawer open/close and fullscreen route.
- Verification: SOURCE-OBSERVED; browser/runtime NOT RUN.
- Status: OPEN


## INT-1-004 — Mobile K-line drawer lacks modal keyboard/focus and safe close lifecycle

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1
- Target team: 1号 Visual Team
- Route / viewport: `#/trade/:symbol`; mobile K-line bottom drawer
- File / selector / function: `assets/js/views-trade.js` `openDrawer()` / `closeDrawer()`; `#kline-entry`, `#kline-drawer`, `#kline-drawer-mask`; `assets/css/views-trade.css` lines 99-108
- Type: UX / ACCESSIBILITY / NAVIGATION
- Severity: P2
- Evidence: source SHA `a73a0e577acd1fc837f1856e0e89542e11603e03`; CSS SHA `79c2a8d5ed9bcfae9eb2909c2a5b9da52447f5be`. The drawer is a custom overlay with mask and close button, but its panel has no dialog/aria-modal semantics, focus is not moved into it or trapped, Escape is not handled, and focus is not restored to the K-line entry on close. `closeDrawer()` unconditionally sets `document.body.style.overflow=''` rather than restoring the prior value; route teardown while open has no visible cleanup in this handler.
- Expected: opening the chart moves focus into the panel; Tab remains within it; Escape, close button and mask close it; focus returns to the entry button; body scroll state is restored to its prior value; route change reliably closes and cleans up the overlay.
- Actual: keyboard/screen-reader users can lose context or tab behind the open chart; closing can overwrite a pre-existing body overflow state; a route change during the open state may leave page scroll locked until another cleanup path runs.
- User impact: mobile and keyboard users can become trapped in an overlay or lose page context; scrolling can behave inconsistently after navigation.
- Recommendation: 1号 to align this drawer with the shared dialog interaction contract while retaining its existing visual placement and dimensions; coordinate with 2号 on focus, Escape, restoration and teardown behavior. Do not move the K-line entry or alter the locked trade workspace without approval.
- Target team's response: PENDING
- Target team's owner: 1号 Visual Team
- Fix commit: pending
- Retest evidence: pending — open/close by X and mask, Escape, keyboard Tab/Shift+Tab, focus restoration, route change while open, previous body overflow value, iOS Safari safe-area and 320/360/390/430 widths.
- Verification: SOURCE-OBSERVED; browser/runtime NOT RUN.
- Status: OPEN


## INT-3-013 — K-line chart is loaded as a snapshot and has no observed live candle update path

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3
- Target team: 3号 Business Team (coordinate with 1号 for chart rendering integration)
- Route / viewport: Trade > K-line; `#/trade/:symbol` and `#/kline/:symbol`; desktop and mobile
- File / selector / function: `assets/js/views-trade.js` `VIEWS.trade.afterRender()`, `VIEWS.kline.afterRender()`, `candleOption()`; chart instances `state.chart` / `state.chartKline`
- Type: DATA / REALTIME / UX
- Severity: P1
- Evidence: source SHA `a73a0e577acd1fc837f1856e0e89542e11603e03`. In the trade chart, K-line data is requested on chart initialization and again only when a timeframe button is clicked; fullscreen K-line follows the same pattern. Repository code search for `state.chart.setOption` / `setOption(candleOption` returned only the initial-load and timeframe-click writes in `assets/js/views-trade.js`; no candle update/subscription path was found in the searched source. This is a source-scan finding, not a claim that a live browser session was reproduced.
- Expected: the active candle and completed candles update from the authoritative market stream or a defined polling contract; connection loss/staleness is surfaced; users can distinguish a live chart from a historical snapshot.
- Actual: the observed view code paints the fetched K-line snapshot but contains no visible subsequent update path for the chart series. The surrounding market price can update independently, making the K-line appear frozen while the quote changes.
- User impact: users may interpret a static candle chart as live market behavior and make decisions from stale chart data.
- Recommendation: 3号 to confirm whether the K-line API response is intentionally snapshot-only and define the authoritative WebSocket/polling update contract, including symbol, interval, candle timestamp, in-progress candle semantics, reconnect and stale timeout. 1号 to coordinate chart UI state for live/paused/stale; 2号 to review the visible connection and freshness feedback. Do not synthesize candle values or alter the locked trading-page layout.
- Target team's response: PENDING
- Target team's owner: 3号 Business Team
- Fix commit: pending
- Retest evidence: pending — compare incoming market ticks with current candle, completed-candle boundary, interval switch, pair switch, WS disconnect/reconnect, stale timeout and fullscreen/mobile consistency.
- Verification: SOURCE-OBSERVED; browser/runtime NOT RUN.
- Status: OPEN


## INT-1-005 — K-line entry point is visually detached from the chart context (review suggestion)

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1
- Target team: 1号 Visual Team
- Route / viewport: Trade workspace; desktop and mobile
- File / selector / function: `assets/js/views-trade.js` trade markup around `#kline-entry` and `#kline-drawer`; `assets/css/views-trade.css` chart-body and `.kline-entry` rules
- Type: SUGGESTION / VISUAL / NAVIGATION
- Severity: P3
- Evidence: source SHA `a73a0e577acd1fc837f1856e0e89542e11603e03`; CSS SHA `79c2a8d5ed9bcfae9eb2909c2a5b9da52447f5be`. The chart canvas is hidden in the normal workspace (`.chart-card .chart-body { display:none }`) and the K-line entry button is rendered after the entire orders/history card, rather than adjacent to the pair/price/chart context. The button opens a bottom drawer. This is a source-observed placement, not a viewport screenshot finding.
- Expected: the chart entry point should be discoverable in the market/trading context and its position should be consistent with the user's mental model of pair → price → chart → order entry, without disturbing the locked trading layout.
- Actual: the only obvious K-line entry is separated from the pair/price area by the order-entry workspace and order-history section; users may not immediately associate it with the current pair's market chart.
- User impact: reduced discoverability and extra navigation/scroll effort, particularly on mobile.
- Recommendation: 1号 to evaluate whether the existing K-line entry can be made more contextually discoverable using only visual hierarchy/placement that preserves the locked trade layout. Do not move major trading modules or change the approved layout without explicit approval.
- Target team's response: PENDING
- Fix commit: not applicable
- Retest evidence: pending — same-task comparison on 320/360/375/390/430 mobile and 1024/1280/1440/1920 desktop widths.
- Verification: SOURCE-OBSERVED; screenshot/browser NOT RUN.
- Status: SUGGESTION


## INT-2-019 — Admin action buttons report success without checking API results or recovering failures

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 peer review (admin API result contract); 2->1 UI handling
- Target team: 3号 Business Team for authoritative API result/error contract; 1号 Visual Team for button state presentation; 2号 Interaction Team for interaction recovery review
- Route / viewport: Admin Console; desktop and mobile
- File / selector / function: `assets/js/views-account.js`, `VIEWS.admin.afterRender()`, lines 399, 412, 422-423, 431-432
- Type: ADMIN ACTION / STATE CONSISTENCY / UX
- Severity: P1
- Evidence: main source SHA `8f4773661e8b0c33d66b8b38af8828e682abbc98` is the issue-log SHA; the inspected `views-account.js` source SHA is `eae9eaf8282d47ffba71ee7fe604724cd9a2ade5`. Freeze, manual deposit confirmation, withdrawal approval/rejection and KYC approval/rejection handlers await their adapter calls but do not inspect `r.ok` / authoritative returned status and do not wrap the call in try/catch/finally. They then display a success toast and re-render. A rejected promise can leave the button disabled; a resolved `{ok:false}` can still be reported as success.
- Expected: each privileged action remains pending only while in flight; success is shown only after an explicit successful API result/authoritative state; failure and ambiguous outcomes show a clear non-success state; controls are restored safely; refresh/reconciliation occurs before retry where the outcome may be unknown.
- Actual: handlers can show success after a failed business result and can remain disabled after a thrown request. Deposit confirmation and withdrawal approval are especially sensitive because the toast implies a financial state transition.
- User impact: administrators may believe a deposit, withdrawal, freeze or KYC decision was completed when the server did not confirm it; repeated attempts may create confusion or duplicate operations.
- Recommendation: 3号 to document response and idempotency/unknown-outcome semantics for every admin endpoint; 2号 to add result checks, guarded catch/finally and reconcile-before-retry behavior; 1号 to ensure pending/disabled/error states remain visible and consistent without changing page structure.
- Retest: NOT RUN — each endpoint returns ok true/false; network rejection; timeout after commit; timeout before commit; repeated click; refresh and verify authoritative state; mobile narrow viewport.
- Verification: SOURCE-OBSERVED; browser/API/runtime NOT RUN.
- Status: OPEN — no code changed in this review.

## Cross-review update — INT-2-015 Hide Small Balances preference — 2026-11-02

- Rechecked main `assets/js/views-account.js` source SHA `eae9eaf8282d47ffba71ee7fe604724cd9a2ade5`, lines 353: the handler still assigns only `state.settings.hideSmall` and immediately displays “Preference saved.” No persistence call is made in this handler.
- Status remains OPEN on main until a persisted settings API/local durable preference contract is implemented and verified. Do not describe this as account-synced preference.
- Verification: SOURCE-OBSERVED; reload/account-switch/browser persistence test NOT RUN.

## Cross-review update — PR #8 CI baseline correction — 2026-11-02

- PR #8 changes `.github/workflows/baseline.yml` to include `main` and pull requests targeting `main`, and removes the hard-coded checkout of `feature/uiux-upgrade`.
- The PR is still DRAFT and unmerged. Main currently retains the old workflow configuration (push/PR only target `feature/uiux-upgrade`, and the job explicitly checks out that branch), so the P0 CI protection gap is NOT fixed on main yet.
- PR candidate workflow run `41469468341` passed build, smoke tests and public artifact checks; this is evidence for that PR candidate only, not main branch protection. Vercel later reported its free deployment API daily limit was exceeded, so Preview deployment availability is constrained.
- Recommendation: keep PR #8 open for cross-review; before merge verify a PR-targeting-main run and a main push run on the corrected workflow. No merge/deploy action taken by 2号.


## INT-2-020 — Withdrawal unknown-outcome guard is memory-only and can be bypassed by reload

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 peer review (withdrawal idempotency/status contract)
- Target team: 3号 Business Team for durable idempotency and status lookup; 2号 Interaction Team for recovery flow; 1号 Visual Team for status/reconciliation UI
- Route / viewport: Withdraw; desktop and mobile
- File / selector / function: `assets/js/views-assets.js`, `VIEWS.withdraw.afterRender()`, lines 315, 472-475
- Type: FINANCIAL SAFETY / DUPLICATE SUBMISSION / RECOVERY
- Severity: P1
- Evidence: main source SHA `f47f9f79c5a596ff7e993bedd14ac03ca617aa9b`. When a withdrawal outcome is ambiguous, the code stores only `state._withdrawUnknownUserKey` in the in-memory SPA state. The guard checks this value when the view is re-entered, so it blocks another submission in the same page session. A full page reload recreates `state` in `app-core.js` and loses this marker; the user can then submit a new withdrawal with a new `request_id`. The UI provides no authoritative status lookup/reconciliation action for the unknown request.
- Expected: an ambiguous financial operation must remain protected across reload, tab/session changes and device changes until the original request is reconciled. Use a server-issued durable idempotency key and an authenticated status lookup; do not rely on browser memory as the safety boundary.
- Actual: the current protection is session-memory-only; reload bypasses it, while remaining on the same SPA session can leave the user blocked indefinitely without a self-service reconciliation path.
- User impact: an earlier request may have been recorded despite a timeout; after reload a second distinct request can be submitted, risking duplicate withdrawal processing. In the same session the user may also be unable to proceed even after the original status becomes known.
- Recommendation: 3号 to guarantee durable idempotency keyed to the original request and expose status lookup by request/operation ID; 2号 to retain and display the original reference and provide a safe “Check status” action; 1号 to design clear Pending / Unknown / Reconciled states without altering the locked trading layout.
- Retest: NOT RUN — simulate timeout before commit and after commit; reload; sign out/in; open a second tab/device; query status; ensure retry reuses the same idempotency key and cannot create a second debit.
- Verification: SOURCE-OBSERVED; API/database/browser/runtime NOT RUN.
- Status: OPEN — no code changed in this review.

## INT-2-021 — Withdrawal review screen interpolates the pasted address into HTML without escaping

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 peer review; 2->3 to confirm address validation contract
- Target team: 2号 Interaction Team for safe text rendering; 3号 Business Team for canonical address validation
- Route / viewport: Withdraw, step 2 confirmation
- File / selector / function: `assets/js/views-assets.js`, `VIEWS.withdraw.afterRender()`, `fillReview()`, line 356 (also address interpolation in the risk-confirm modal around lines 438-440)
- Type: INPUT HANDLING / DOM INJECTION / SECURITY
- Severity: P2
- Evidence: main source SHA `f47f9f79c5a596ff7e993bedd14ac03ca617aa9b`. The user-pasted `addr` is concatenated into an HTML string passed to `innerHTML` in the review list and again into modal content. It is not escaped or rendered as a text node. A crafted pasted string containing HTML markup can be parsed as elements/attributes in the current page.
- Expected: destination addresses are rendered strictly as text; address validation is performed against the selected coin/network by the authoritative backend (with safe client-side validation as an additional guard).
- Actual: raw user input is interpreted as HTML in two confirmation surfaces. This is at minimum an unsafe DOM sink and can execute markup/event-handler payloads depending on browser/CSP context.
- User impact: malicious or malformed clipboard content can alter the confirmation UI or trigger script-capable HTML in the user's session; it also undermines trust in the displayed withdrawal destination.
- Recommendation: render the address via `textContent` / DOM text nodes, or apply a well-tested HTML escaping helper before interpolation; verify the exact address shown in the confirmation matches the submitted payload. Do not weaken backend validation.
- Retest: NOT RUN — test markup-like pasted input, quotes, ampersands, and long addresses; confirm literal display and no DOM element creation/script execution.
- Verification: SOURCE-OBSERVED; exploit/browser/CSP verification NOT RUN.
- Status: OPEN — no code changed in this review.

## INT-2-022 — Earn unknown-subscription protection is stored only in in-memory state

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 peer review (earn idempotency/status contract)
- Target team: 3号 Business Team for durable idempotency and position/status lookup; 2号 Interaction Team for recovery flow; 1号 Visual Team for state presentation
- Route / viewport: Earn subscriptions
- File / selector / function: `assets/js/views-assets.js`, `VIEWS.earn.afterRender()`, lines 521-522, 554-556, 570-572
- Type: FINANCIAL SAFETY / DUPLICATE SUBMISSION / RECOVERY
- Severity: P1
- Evidence: main source SHA `f47f9f79c5a596ff7e993bedd14ac03ca617aa9b`. Unknown product IDs are kept only in `state._earnUnknownProductIdsByUser`; the request ID is generated in the modal's local `onMount` closure. A page reload clears both the unknown marker and request ID, so a subsequent subscription can generate a new request ID for the same product/amount. No authoritative status lookup is wired into this view; the position panel explicitly says position records are not connected.
- Expected: ambiguous subscription outcomes remain protected across reload and the original operation can be queried before any retry; idempotency is durable and enforced server-side.
- Actual: the UI blocks only within the current in-memory session and cannot reconcile the prior operation.
- User impact: a subscription may have been recorded despite a timeout; after reload a second request with a new ID can create a duplicate subscription/debit.
- Recommendation: 3号 to provide durable idempotency and authenticated status/position lookup; 2号 to persist/restore the operation reference and make retry reconcile the original request rather than generating a new one; 1号 to present the unresolved state clearly.
- Retest: NOT RUN — simulate timeout before/after commit, reload and sign-in, submit same product/amount; verify only one authoritative subscription/debit exists.
- Verification: SOURCE-OBSERVED; API/database/browser/runtime NOT RUN.
- Status: OPEN — no code changed in this review.


## INT-2-023 — Seconds-position settlement rejection has no user-visible recovery or reconciliation

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 peer review (settlement result/status contract); 2->1 status-state presentation
- Target team: 3号 Business Team for authoritative settlement response and position lookup; 2号 Interaction Team for failure/unknown recovery; 1号 Visual Team for settlement pending/error states
- Route / viewport: Seconds contract position settlement
- File / selector / function: `assets/js/views-trading.js`, seconds position countdown callback, source SHA `4ba38d741c99f7e6aa8f51a9e169d5dce9fa48ca`, lines 59-64
- Type: FINANCIAL OPERATION / ERROR RECOVERY / STATE CONSISTENCY
- Severity: P1
- Evidence: when the countdown reaches zero, the view calls `apiAdapter.secondsSettle(...).then(...)` without a rejection handler. The resolved value is not checked for `ok` or an authoritative settlement status; instead, the UI reads `state.secondsPositions.history[0]` and displays WIN/LOSS. A rejected request produces no settlement failure or unknown-outcome message and no status lookup/reconciliation path in this callback.
- Expected: distinguish confirmed settlement from rejected and ambiguous outcomes; show a persistent pending/unknown state until the server confirms the position result; retrieve authoritative position status before allowing any retry or claiming WIN/LOSS.
- Actual: the UI can remain without a result after rejection, and a resolved non-success response can still lead to a WIN/LOSS toast based on potentially stale history state.
- User impact: users may be shown an incorrect settlement result or be left unsure whether the position settled; this is a financial result and must not be inferred from stale client state.
- Recommendation: 3号 to define settlement response/idempotency/status-query semantics; 2号 to inspect the response, catch transport failures, and reconcile by position_id; 1号 to present Pending / Status Unconfirmed / Settled states without changing the locked trading layout.
- Retest: NOT RUN — success; resolved `ok:false`; rejection before commit; timeout after commit; stale history; route change during settlement; verify no unconfirmed result is labeled WIN/LOSS.
- Verification: SOURCE-OBSERVED; browser/API/database/runtime NOT RUN.
- Status: OPEN — review finding only; no business code changed.

## INT-2-024 — Orders-page cancellation reports success without checking or reconciling the result

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 peer review (cancel endpoint response/status contract)
- Target team: 3号 Business Team for authoritative cancel response and order-state refresh contract; 2号 Interaction Team for guarded pending/error/unknown handling; 1号 Visual Team for consistent button/modal states
- Route / viewport: Orders > Open Orders
- File / selector / function: `assets/js/views-trading.js`, `VIEWS.orders.afterRender()`, source SHA `4ba38d741c99f7e6aa8f51a9e169d5dce9fa48ca`, lines 115-122
- Type: ORDER ACTION / FALSE SUCCESS / ERROR RECOVERY
- Severity: P1
- Evidence: the Confirm Cancel callback awaits `apiAdapter.cancelOrder(id)` but does not inspect the returned result, catch a rejected promise, or reconcile the latest authoritative order status. It immediately shows `Order canceled.` and closes/re-renders.
- Expected: show success only after an explicit confirmed cancellation or authoritative refreshed status; handle `ok:false`, rejection, and ambiguous timeout distinctly; keep the user informed and prevent blind repeat actions until status is known.
- Actual: a resolved failure-shaped response can still be reported as canceled; a rejected promise escapes the callback without a user-facing recovery path.
- User impact: users may believe an open order was canceled when it remains active, potentially changing their exposure and risk.
- Recommendation: 3号 to confirm cancel response semantics and provide authoritative order status; 2号 to implement response validation, catch/finally and reconcile-before-retry; 1号 to align modal pending/error states with existing order interactions.
- Retest: NOT RUN — confirmed cancellation; `ok:false`; rejected request; timeout after server commit; already-filled order; repeated click; refresh and verify authoritative status.
- Verification: SOURCE-OBSERVED; browser/API/runtime NOT RUN.
- Status: OPEN — review finding only; no business code changed.

## INT-2-025 — Orders history directly formats unvalidated timestamps and can display “Invalid Date”

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 peer review (timestamp field contract)
- Target team: 3号 Business Team for canonical timestamp/nullability contract; 2号 Interaction Team for safe formatting and empty-value presentation
- Route / viewport: Orders > Order History / Trade History
- File / selector / function: `assets/js/views-trading.js`, `VIEWS.orders.afterRender()`, source SHA `4ba38d741c99f7e6aa8f51a9e169d5dce9fa48ca`, lines 94, 111
- Type: DATA PRESENTATION / HISTORY READABILITY
- Severity: P2
- Evidence: trade history calls `new Date(t.time).toLocaleString(...)`; order history calls `new Date(o.created_at).toLocaleString(...)` without checking that the source field exists or parses to a finite date. Missing or malformed values can render as the literal `Invalid Date` instead of a neutral placeholder.
- Expected: validate the canonical timestamp field and parse result; render `—` (or a clearly labeled unavailable value) when missing or invalid; avoid silently substituting an unrelated time.
- Actual: raw invalid date formatting is used in both history tables; the detail drawer has a similar direct date formatting path.
- User impact: financial history appears broken or unreliable, and users may misread when an order or trade occurred.
- Recommendation: 3号 to document timestamp type/units and nullability; 2号 to use one safe date formatter consistently in tables and detail views.
- Retest: NOT RUN — valid ISO timestamp, epoch seconds/milliseconds per API contract, null, empty string, malformed string, and out-of-range values at desktop/mobile widths.
- Verification: SOURCE-OBSERVED; browser/API/runtime NOT RUN.
- Status: OPEN — review finding only; no business code changed.


## Cross-review update — K-line loading, timeframe races, and live-data labeling — 2026-11-02

- Rechecked main `assets/js/views-trade.js` source SHA `a73a0e577acd1fc837f1856e0e89542e11603e03`.
- Confirmed the previously logged K-line interaction risk remains present in both chart surfaces:
  - `VIEWS.trade.afterRender()` lines 181-196 and `VIEWS.kline.afterRender()` lines 368-382 call `apiAdapter.kline(...).then(...)` without rejection handling or an explicit loading/empty/error result state.
  - Timeframe handlers update `state.currentInterval` and the active button immediately, then apply whichever promise resolves. No request sequence token or captured symbol/interval comparison prevents an older, slower response from overwriting the currently selected timeframe.
  - The fullscreen K-line header renders a static `LIVE DATA` label before the initial K-line request has succeeded. The inspected chart code applies a fetched K-line array but contains no subsequent candle subscription/update loop in these view handlers. This is source evidence only; another upstream chart updater, if any, must be confirmed by 3号 before concluding there is no live update anywhere in the app.
- User impact: chart can show stale candles after rapid timeframe switching; request failure can leave a blank/old chart without explaining why; the LIVE DATA label may overstate freshness before data is confirmed.
- Recommendation: 3号 to confirm the authoritative live candle stream/polling contract, update cadence, reconnect and stale thresholds; 2号 to add request identity guards and explicit loading/error/empty/stale states; 1号 to style these states while preserving the locked trade layout.
- Retest: NOT RUN — rapid 1m/5m/15m switching with reversed response order; rejected request; empty candles; stale stream; symbol switch; route leave/re-enter; mobile drawer open/close.
- Verification: SOURCE-OBSERVED; runtime/network/browser NOT RUN. This is a cross-review confirmation of existing K-line issue records, not a claim that no other updater exists.

## Cross-review update — order history date formatting differs by view — 2026-11-02

- Compared main `assets/js/views-trade.js` SHA `a73a0e577acd1fc837f1856e0e89542e11603e03` with `assets/js/views-trading.js` SHA `4ba38d741c99f7e6aa8f51a9e169d5dce9fa48ca`.
- Trade-page order/trade rows use `orderTimeText()`, which checks missing and invalid dates and returns `—`.
- The separate Orders page still directly calls `new Date(...).toLocaleString()` for order history and trade history without validating the input. This confirms INT-2-025 is a separate route-specific gap; the safer helper on the trade page does not cover the Orders page.
- Recommendation: 2号 to reuse one shared safe date formatter across both order views once shared-code ownership/approval is agreed; 3号 to confirm canonical timestamp field and units. Do not change locked trade-page layout.
- Verification: SOURCE-OBSERVED; browser/runtime NOT RUN.


## INT-2-026 — KYC form keeps two columns on narrow mobile screens

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 visual/mobile review
- Target team: 1号 Visual Team; 2号 to retest form interaction after adjustment
- Route / viewport: Identity Verification (KYC), mobile widths 320–390px
- File / selector / function: `assets/js/views-account.js`, `VIEWS.kyc()` inline grid; `assets/css/views-account.css` SHA `b2803aa6e0b252bd11c239328df1466927ed5850`
- Type: RESPONSIVE LAYOUT / FORM USABILITY
- Severity: P2
- Evidence: the Full Name and Document Type wrapper uses inline `display:grid;grid-template-columns:1fr 1fr`; the stylesheet's <=768px rules do not override this inline grid.
- Expected: stack the fields on narrow phones, preserving labels, input width, focus and submit behavior.
- User impact: fields can become cramped and harder to edit on small screens.
- Recommendation: 1号 move the inline grid to a responsive class and stack at <=480px; 2号 retest keyboard, validation, loading and error recovery.
- Retest: NOT RUN — 320px, 360px, 390px, 768px and desktop; iOS keyboard and submission.
- Verification: SOURCE-OBSERVED; browser/device runtime NOT RUN.
- Status: OPEN — review finding only; no code changed.

## INT-2-027 — Account dashboard statistic cards remain three columns on mobile

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 visual/mobile review
- Target team: 1号 Visual Team; 2号 to retest metric readability
- Route / viewport: Account / profile dashboard, mobile widths
- File / selector / function: `assets/css/views-account.css`, `.va-stat-grid`, SHA `b2803aa6e0b252bd11c239328df1466927ed5850`, mobile rule around line 139
- Type: RESPONSIVE LAYOUT / DATA READABILITY
- Severity: P2
- Evidence: the <=768px rule retains `grid-template-columns:repeat(3,1fr)` and uses 10px 12px card padding, leaving limited width for long values and labels at 320–390px.
- Expected: use a deliberate 1- or 2-column mobile arrangement and prevent clipping.
- Recommendation: 1号 evaluate 2 columns below 480px; 2号 verify long balances, labels and touch targets.
- Retest: NOT RUN — 320px, 360px, 390px, 480px and 768px with long values.
- Verification: SOURCE-OBSERVED; browser/device runtime NOT RUN.
- Status: OPEN — review finding only; no code changed.

## INT-2-028 — Support chat minimum height can exceed short mobile viewport space

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->1 visual/mobile review
- Target team: 1号 Visual Team; 2号 to retest composer and scrolling
- Route / viewport: Support chat, mobile landscape / short-height devices
- File / selector / function: `assets/css/views-account.css`, `.va-chat-wrap`, SHA `b2803aa6e0b252bd11c239328df1466927ed5850`, lines 119 and 143
- Type: RESPONSIVE LAYOUT / VIEWPORT / SCROLL
- Severity: P2
- Evidence: mobile rule sets `height:calc(100vh - 220px)` but also enforces `min-height:380px`; this minimum can exceed available height on short landscape viewports.
- Expected: size against the dynamic viewport and app shell; keep composer visible and message list independently scrollable.
- Recommendation: 1号 evaluate dynamic viewport sizing and a short-height media query; 2号 test keyboard-open and route-leave behavior.
- Retest: NOT RUN — portrait, landscape, short viewport, keyboard open and route transitions.
- Verification: SOURCE-OBSERVED; browser/device runtime NOT RUN.
- Status: OPEN — review finding only; no code changed.


## INT-2-029 — Spot order submission can leave the submit button locked after a rejected request

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2号 interaction review; coordinate with the registered trade-view owner
- Target team: 2号 Interaction Team for pending/error/finally behavior; 3号 for ambiguous POST outcome and idempotency/status contract
- Route / viewport: Spot Trade, Buy/Sell order form
- File / selector / function: `assets/js/views-trade.js`, `VIEWS.trade.afterRender()`, main SHA `a73a0e577acd1fc837f1856e0e89542e11603e03`, order submit handler around lines 248–260
- Type: ORDER SUBMISSION / ERROR RECOVERY
- Severity: P1
- Evidence: the handler disables the submit button and changes its label to `Submitting…`, then awaits `apiAdapter.placeOrder()` without try/catch/finally. The button is restored only after the await resolves. A rejected promise skips the restoration and user-facing result branch.
- Expected: always restore the button in finally; distinguish confirmed rejection from transport-unknown outcome; do not blindly resubmit an order whose server outcome is unknown; reconcile by the same client/request id where supported.
- Actual: a rejected request can leave the submit button disabled with the pending label and no clear recovery message.
- User impact: user may be unable to continue trading or may reload/retry without knowing whether the first order reached the server.
- Recommendation: 3号 confirm idempotency and order-status lookup semantics; 2号 add guarded try/catch/finally and explicit Pending / Rejected / Status Unconfirmed states; preserve the locked trading-page layout.
- Retest: NOT RUN — confirmed success, HTTP/API rejection, fetch rejection, timeout after server commit, duplicate click, route leave while pending, and reload reconciliation.
- Verification: SOURCE-OBSERVED; browser/API/runtime NOT RUN.
- Status: OPEN — review finding only; no trading code changed.

## INT-2-030 — K-line view ignores failure-shaped adapter results and renders an empty chart without a recovery state

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2号 interaction review; 3号 to confirm data contract and 1号 to style states
- Target team: 3号 for authoritative K-line response/freshness contract; 2号 for result-state handling; 1号 for visual loading/error/empty/stale presentation
- Route / viewport: Spot Trade chart and fullscreen K-Line
- File / selector / function: `assets/js/app-core.js` `apiAdapter.kline()` SHA `325aa5334d8863c90edf23a0e0506d682d396994`; `assets/js/views-trade.js` SHA `a73a0e577acd1fc837f1856e0e89542e11603e03`
- Type: MARKET DATA / LOADING / ERROR RECOVERY
- Severity: P1
- Evidence: `apiAdapter.kline()` converts non-ok API responses into `{ok:false, klines:[]}`; both chart consumers call `candleOption(r.klines,...)` without checking `r.ok` or whether candles are present, and neither request chain has a catch handler or explicit loading/error/empty state.
- Expected: distinguish loading, confirmed data, empty response, API failure, transport failure and stale data; do not silently apply an empty candle series or imply the chart is live before a successful fresh response.
- Actual: failure-shaped results are treated like chart data; request rejection is unhandled by these view handlers. Fullscreen view also renders a static LIVE DATA label before its first successful fetch.
- User impact: chart may appear blank or stale without explanation, while the LIVE DATA label can overstate data availability.
- Recommendation: 3号 define source/timestamp/freshness and live-update contract; 2号 guard result shape, request identity and failure paths; 1号 style states without changing locked trade-page geometry.
- Retest: NOT RUN — API ok:false, network rejection, empty/malformed candles, stale timestamp, rapid timeframe changes with reversed response order, symbol change and route re-entry.
- Verification: SOURCE-OBSERVED; browser/network/runtime NOT RUN.
- Status: OPEN — review finding only; no trading code changed.

## INT-2-031 — Market list responses do not refresh symbols that already exist in the client cache

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 data-contract review; 2号 to coordinate visible freshness behavior
- Route / viewport: Markets / Spot Trade ticker
- File / selector / function: `assets/js/app-core.js`, `applyMarket()`, main SHA `325aa5334d8863c90edf23a0e0506d682d396994`, lines 216-229
- Type: LIVE MARKET DATA / STALE PRICE
- Severity: P1
- Evidence: the `r.data` path overwrites market entries, but the `r.markets` path immediately returns when `market[sym]` already exists. Existing symbols therefore do not receive updated price/change/high/low/volume/timestamp values from that response path.
- Expected: every valid market-list response must refresh the canonical cached record for each returned symbol; preserve only fields intentionally omitted by the API contract and validate timestamps/source.
- Actual: symbols already present in `market` are skipped in the `r.markets` branch, so their displayed values can remain unchanged even when later market-list responses contain newer values.
- User impact: users may see a frozen or outdated ticker and make decisions using stale prices.
- Recommendation: 3号 confirm the active market response shape and source/timestamp contract; owner of shared market mapper to update existing entries consistently; UI must expose stale/unavailable state rather than imply freshness.
- Retest: NOT RUN — pre-seeded symbol followed by changed market-list payload; new symbol; missing/zero price; stale timestamp; source switch; repeated refresh.
- Verification: SOURCE-OBSERVED; browser/network/API runtime NOT RUN.
- Status: OPEN — review finding only; no market code changed.

## INT-2-032 — Market and order-book failures can leave old values visible without per-symbol freshness indication

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 market-data contract review; 2->1 stale-state presentation review
- Route / viewport: Markets / Spot Trade ticker and order book
- File / selector / function: `assets/js/app-core.js`, `refreshMarket()` and `refreshDepth()`, main SHA `325aa5334d8863c90edf23a0e0506d682d396994`, lines 238-246
- Type: MARKET DATA FRESHNESS / ORDER-BOOK RECOVERY
- Severity: P1
- Evidence: failed `refreshMarket()` sets a global unavailable flag and displays a network banner, but does not invalidate or timestamp-mark the previously rendered market records. `refreshDepth()` only replaces `state.depthCache` on success; a failed request leaves the previous depth cache in place and has no local stale/error state. The depth request also captures the symbol before awaiting and does not verify that it is still the selected symbol before updating/rendering.
- Expected: retain old data only when explicitly labeled stale with its last-update time; prevent an old-symbol response from replacing the currently selected pair's book; expose loading, unavailable, stale and recovered states independently for ticker and depth.
- Actual: previously rendered values/cache can remain visible after a failed refresh, and a delayed depth response can be applied after the selected pair changes.
- User impact: users may mistake old ticker/depth values for current market liquidity and price.
- Recommendation: 3号 define freshness timestamps, source and polling/reconnect semantics; shared market-data owner add symbol/request identity checks; 1号 provide compact stale/unavailable states without changing locked trade-page geometry.
- Retest: NOT RUN — market/depth 503, rejected fetch, delayed BTC response after switching to ETH, recovery after failure, stale timeout and route leave/re-enter.
- Verification: SOURCE-OBSERVED; browser/network/API runtime NOT RUN.
- Status: OPEN — review finding only; no market code changed.

## INT-2-033 — Orders page classifies partially filled orders as history and does not offer cancellation

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 order-status contract review; 2->1 order-state consistency review
- Route / viewport: Orders > Open Orders / Order History
- File / selector / function: `assets/js/views-trading.js`, `VIEWS.orders` render filter and row actions, main SHA `4ba38d741c99f7e6aa8f51a9e169d5dce9fa48ca`, lines 99-119
- Type: ORDER STATUS / USER ACTION AVAILABILITY
- Severity: P1
- Evidence: Open Orders filters only `status==='open'`; History filters every status other than `open`; the Cancel button is also rendered only for `open`. The trade-page implementation separately treats both `open` and `partially_filled` as active.
- Expected: use one canonical active-order predicate across all order surfaces, including `partially_filled` when the backend permits cancellation; display partial fill and remaining quantity accurately.
- Actual: a partially filled but still active order is placed in History and receives no Cancel action on the standalone Orders page.
- User impact: users may fail to notice remaining exposure or may be unable to cancel the unfilled remainder from the Orders page.
- Recommendation: 3号 confirm all backend statuses and cancelability; shared order-state owner centralize the active-status predicate; 2号 align tabs, labels and actions across both order views.
- Retest: NOT RUN — open, partially_filled, filled, canceled/cancelled, rejected and unknown statuses; cancel a partially filled order and verify remaining quantity.
- Verification: SOURCE-OBSERVED; browser/API/runtime NOT RUN.
- Status: OPEN — review finding only; no order/business code changed.

## INT-2-034 — Seconds-position settlement releases the interaction lock before authoritative settlement completes

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 settlement contract review; 2号 interaction recovery review
- Route / viewport: Seconds Contract, position countdown and settlement
- File / selector / function: `assets/js/views-trading.js`, seconds order handler; main SHA `4ba38d741c99f7e6aa8f51a9e169d5dce9fa48ca`, lines 48-64
- Type: FINANCIAL ACTION / PENDING STATE / SETTLEMENT RECONCILIATION
- Severity: P1
- Evidence: when the countdown reaches zero, the handler hides the countdown and sets `busy=false` before `apiAdapter.secondsSettle()` completes. The promise chain has no catch and does not inspect the returned `ok` value; it reads `state.secondsPositions.history[0]` and displays WIN/LOSS regardless of whether the settlement call confirmed success.
- Expected: keep the position in a pending/settling state until authoritative settlement is confirmed or reconciled; handle `ok:false`, rejected requests and unknown outcomes distinctly; do not infer a financial result from an unverified local history entry.
- Actual: another position can be submitted while the prior settlement is unresolved, and a failed/ambiguous settlement can produce a misleading result toast or an unhandled rejection.
- User impact: users may believe a position has settled when its financial result is not confirmed, or create another position while the prior one is unresolved.
- Recommendation: 3号 provide idempotent settlement and authoritative position-status lookup; 2号 retain pending lock and implement result validation/catch/reconciliation; 1号 distinguish Settling, Status Unconfirmed and Settled states.
- Retest: NOT RUN — confirmed settlement, `ok:false`, network rejection, timeout after server commit, delayed settlement, repeated countdown callback, route leave/re-entry and status reconciliation.
- Verification: SOURCE-OBSERVED; browser/API/runtime NOT RUN.
- Status: OPEN — review finding only; no seconds-contract code changed.

## INT-2-035 — Account hydration and order-list refresh can read different order stores during matching-engine mode

- Date: 2026-11-02
- Reporter: 2号 Interaction Team
- Direction: 2->3 financial/order data consistency review
- Route / viewport: Authenticated app hydration, Account and Orders / Spot Trade
- File / selector / function: `api/core.js` GET `/api/account` and GET `/api/orders`, main SHA `a2041ed2ff1adb66c27a0870d9ca6b7e6a0bb325`; `assets/js/app-core.js` `applyAccount()`, SHA `325aa5334d8863c90edf23a0e0506d682d396994`, lines 200-229 and 267-286
- Type: ORDER DATA SOURCE / CROSS-VIEW CONSISTENCY
- Severity: P1
- Evidence: `GET /api/account` serializes `user.orders.slice(-50)`; when `matchingEngineRequested()` is true and the engine is enabled, `GET /api/orders` instead reads `financial_matching_orders` from Supabase/Postgres. Both responses are accepted by `applyAccount()` and replace `state.orders`.
- Expected: define one authoritative order source for all hydration and refresh paths under each cutover mode; return a consistent schema and ensure account snapshots do not overwrite newer matching-engine order state with legacy records.
- Actual: account hydration and order-list refresh can populate the same client state from different stores, potentially producing different order histories depending on which request ran last.
- User impact: orders may appear, disappear or change status between pages/refreshes; users may see an outdated view of open exposure.
- Recommendation: 3号 confirm cutover flags and canonical order store; use the same authoritative read model for account hydration and order-list queries, or explicitly exclude legacy orders from the matching-engine snapshot; 2号 verify state replacement and loading order.
- Retest: NOT RUN — matching engine disabled/enabled, account-first/orders-first, stale legacy records, new/partially-filled/canceled/filled orders and repeated hydration.
- Verification: SOURCE-OBSERVED conditional on matching-engine mode; database/runtime NOT RUN.
- Status: OPEN — cross-team review finding; no backend or business code changed.

## INT-2-005 — 1号 My Account hub: stale balance snapshot and KYC status misclassification

- Date: 2026-11-02
- Reporter: Coordinator review with 2号 Interaction Team repair
- Direction: 2->1
- Severity: P1 (KYC truthfulness); P2 (duplicate stale valuation)
- Evidence: feature/ai1-visual assets/js/views-missing.js at blob 9a657337d9da9a48ed1a9b0135700783129c56cd rendered state.balances[*].usdt and USDT free/frozen values directly on My Account without a market freshness indicator; it treated kyc.level >= 1 as Verified and expected string status although the account contract may provide a status object.
- Repair: 2号 commit 761741338eb3e3d6572e059c8c57af75f635f3a8 on feature/ai2-interaction removes the numeric duplicate balance snapshot, links to Assets, normalizes object/string KYC status and displays Pending separately from explicit Approved.
- Required integration: 1号 retains its responsive .va-hub-* CSS but takes the corrected 2号-owned view logic when the branches are integrated. Do not reintroduce stale balance numbers or status-derived tier claims.
- Retest: NOT RUN. Browser/keyboard/account state and route tests pending.
- Integration: 1号 has ported the corrected view into feature/ai1-visual HEAD 36e8e4b8e7b229b0897e9b41bd4ff25c32681a71. Verified source no longer renders numeric balance snapshots and normalizes KYC status; .va-hub-* CSS remains present.
- Status: INTEGRATED AT SOURCE LEVEL / RUNTIME VERIFICATION PENDING.

## Initial known items

### BTC-001 — trade-hub route registry mismatch
- Date: 2026-11-02
- Reporter: 1号 / Dola report
- Type: ROUTE
- Status: OPEN — requires runtime verification and authorized source investigation
- Severity: P1 (provisional; confirm actual impact)
- Evidence class: INFERENCE from static source analysis; NOT browser-verified
- Route / file / function: `#/trade-hub`; route parser/registry in `assets/js/app-core.js`; `VIEWS.tradehub` in `assets/js/views-home.js`
- Expected: selecting Trade opens the existing trade-service selection view.
- Actual / observation: Dola reported a possible normalization mismatch between `trade-hub` and `tradehub`; this has not been runtime reproduced.
- Evidence: Dola dependency report; inspect latest source before action.
- User impact: if confirmed, Trade entry may fall through to not-found.
- Known facts: view function exists in source; exact router behavior must be rechecked at current HEAD.
- Unknowns / concerns: whether current parser normalizes hyphens or registry lookup aliases the key.
- Recommended minimal action: reproduce on a preview/browser; if confirmed, propose a narrow route mapping fix and obtain user authorization if core/router behavior is implicated.
- Primary owner: Coordinator / core-router owner not yet assigned
- Helper: 1号 (route consumer), 3号 (shell/nav)
- Independent reviewer: 2号 or coordinator
- Can safe work continue meanwhile: YES
- Retest required: direct navigation, mobile Trade nav, refresh/deep-link, unknown-route regression.

### BTC-002 — browser viewport acceptance evidence missing
- Date: 2026-11-02
- Reporter: Coordinator
- Type: RESPONSIVE
- Status: OPEN
- Severity: P1 for final acceptance; does not block unrelated coding
- Evidence class: SOURCE-OBSERVED (test records say browser QA NOT RUN)
- Route / file / selector / function: all key routes; shell, views, dialogs, trade/order and account flows
- Expected: separately verified iOS Safari mobile, tablet and desktop compositions.
- Actual / observation: CI/build checks exist, but no real browser viewport evidence is recorded for the current workstreams.
- Evidence: current task/handoff records explicitly mark browser/mobile/tablet/desktop QA NOT RUN.
- User impact: overflow, covered controls, keyboard/dialog clipping and interaction defects may remain undetected.
- Known facts: automated build/smoke tests are not visual browser tests.
- Unknowns / concerns: browser automation availability and exact runtime behavior.
- Recommended minimal action: obtain browser-capable QA, capture route/viewport evidence and record pass/fail/not-run per viewport.
- Primary owner: All agents for their routes; 3号 for shell; coordinator for final matrix
- Helper: Any available agent
- Independent reviewer: Different agent from the implementer
- Can safe work continue meanwhile: YES
- Retest required: 320/360/375/390/430px; tablet separately; 1024/1280/1440/1920px desktop where available.

## New entries
Append below. Do not delete history; update status and resolution in the existing entry.
- Evidence: 2号 `assets/js/views-trade.js` awaits `apiAdapter.cancelOrder(id)` but ignores the response, then unconditionally displays 'Order canceled.' and re-renders the existing local order array. `apiAdapter.cancelOrder` returns the API response object.
- Expected: success appears only after explicit backend confirmation; rejected, already-filled, partially-filled race, timeout/unknown and already-terminal results remain distinct; refresh authoritative order/balance state after confirmed outcome.
- Actual: all returned response outcomes flow to a success toast; local state is not refreshed in this handler.
- User impact: user may believe a still-open or already-filled order was canceled and misread reserved funds. Source-derived; no cancel request was sent.
- Recommendation: inspect response `ok` and canonical status; reconcile with `GET /api/orders` and account balances before displaying final result.
- Report: `docs/REVIEW-3-TO-2-STATUS-AND-RUNTIME-2026-11-02.md`.
- Status: OPEN / ACTION REQUIRED


## INT-ORDER-002 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: 3->2 peer review; matching status contract cross-check
- Target owner: 2号 Interaction Team
- Type: ORDER STATE / MATCHING CONTRACT / UX
- Severity: P1
- Evidence: 2号 `assets/js/views-trade.js` filters Open Orders to `status==='open'` and only renders Cancel for that status. `main` `api/core.js` returns raw matching status. `financial_matching_engine_v1.sql` defines `partially_filled` as active with remaining quantity >0; cancel RPC permits cancellation unless status is filled/cancelled.
- Expected: open and partially_filled remain in active orders; partial fills show filled/remaining quantities and allow cancellation of remaining quantity.
- Actual: partially_filled is classified into History and receives no cancel action.
- User impact: a live partially-filled order can remain in the matching book while UI presents it as history; user cannot cancel remaining quantity from the active order UI. Source-confirmed; no matching operation was run.
- Recommendation: define canonical active/terminal status sets from backend contract and refresh order/balance state after cancellation.
- Report: `docs/REVIEW-3-TO-2-STATUS-AND-RUNTIME-2026-11-02.md`.
- Status: OPEN / ACTION REQUIRED


## BUS-MKT-010 — 2026-11-02

- Reporter: 3号 Business Team
- Direction: Business self-review / market data freshness
- Target owner: 3号 market API owner + frontend market data adapter owner
- Type: MARKET DATA / RUNTIME RACE / FRESHNESS
- Severity: P2 (source-confirmed race condition possibility; runtime reproduction pending)
- Evidence: `assets/js/app-core.js` starts REST `/market` polling every 3 seconds; `refreshMarket` applies every successful response without request sequencing; `applyMarket` overwrites existing symbol data without checking the incoming `ts`. `api/core.js` creates `ts` at request start and external provider calls can wait up to 5 seconds.
- Expected: stale responses never overwrite newer market data; every displayed quote has a freshness state and stale-data behavior.
- Actual: overlapping requests can complete out of order and older response can overwrite newer state; no timestamp gate is present in the reviewed adapter.
- User impact: market ticker/orderbook context may display stale values during slow provider responses. Not reproduced in runtime.
- Recommendation: add per-symbol source timestamp/sequence gating and test delayed out-of-order responses; decide and document REST polling vs WebSocket contract. A REST snapshot must not overwrite a newer WS tick.
- Report: `docs/REVIEW-3-TO-2-STATUS-AND-RUNTIME-2026-11-02.md`.
- Status: OPEN / NEEDS RUNTIME VALIDATION


## BUS-ACC-001 — My Account grouped UI requires business-state contract confirmation — 2026-11-02

- Reporter: 1号 Visual Team; follow-up owner: 3号 Business Team
- Direction: 1->3; ongoing business review after 2号 interaction correction
- Target source: `feature/ai1-visual` `assets/js/views-missing.js`, integrated block commit `36e8e4b8e7b229b0897e9b41bd4ff25c32681a71`; compare with `main` `api/core.js` and the actual account adapter contract.
- Type: ACCOUNT STATE / KYC CONTRACT / CAPABILITY TRUTH
- Severity: P1 for KYC truth; P2 for capability labels
- Evidence: 2号 found that the account endpoint returns `kyc` as an object and derives `kyc_level` from status (pending=1, approved=2); the client state mapper currently stores the object in `state.kyc.status`. The integrated My Account view normalizes object/string values and only shows Verified for explicit `approved`. The existing KYC detail page also now uses a status-first helper on 2号's branch, but broader KYC tier/permission semantics still require authoritative confirmation.
- Required 3号 review:
  1. Confirm exact status vocabulary from account creation, KYC submission, approval, rejection, admin lock/freeze and legacy records: `unsubmitted`, `pending`, `approved`, `rejected`, `locked` or any other real values.
  2. Confirm whether `kyc_level` is a true product tier or only a derived status code; do not infer Advanced Verification / Lv.2 entitlements from `approved=2` unless backend policy explicitly defines it.
  3. Confirm which KYC states allow resubmission and which withdrawal/trading/fiat permissions they actually gate. Do not change those permissions as part of this presentation review.
  4. Confirm Fiat/Payment and Rewards/Referrals are not currently operational through any existing route/API. The UI labels them Preview; report if a real supported capability exists before asking 1号 to expose it.
  5. Confirm Assets remains the only wallet workspace; transfer/records remain unavailable where the current API says so.
- Expected: provide source-backed canonical state/capability matrix and identify any mismatch in 1号/2号 display logic. No speculative business changes.
- Runtime/API mutation: NOT RUN; no KYC, payment, transfer or financial operation performed.
- Status: OPEN — 3号 FOLLOW-UP REQUIRED.


## BUS-SUPPORT-001 — Confirm authoritative support hours and live-agent status — 2026-11-02

- Reporter: 1号 Visual Team; owner: 3号 Business Team
- Target: support configuration/API/backend operational source and `#/support` copy.
- Evidence: the old page simultaneously stated “Available weekdays 9:00–24:00” and rendered a permanently green “Online” indicator. No authoritative dynamic availability source was identified in the view. 1号 has removed both unverified claims from the UI in commits `76b85da92b9af76ac36c9d202a7c880da962f6b9` and `f711ec49479f0cbc514922f56605509a721fd448`.
- Required: confirm supported service hours, timezone, weekday/weekend/holiday behavior, and whether live-agent presence is actually exposed by any API/config. If no authoritative source exists, keep neutral message-center copy and do not reintroduce a live badge or fixed schedule.
- No support send/API behavior changed. Runtime checks NOT RUN.
- Status: OPEN — 3号 FOLLOW-UP REQUIRED.


## INT-KYC-001 integration update — 2026-11-02

- 2号's status-first KYC detail view and submission-outcome reconciliation were integrated into 1号 `feature/ai1-visual` commit `eb19dc8f28575ae26d603a52abab79fb80d4bc36`.
- The integrated view normalizes object/string status, keeps pending in review, and treats only explicit `approved` as approved. This is a view-level correction; it does not change the API response or account-state mapper.
- 3号 review remains required for canonical state vocabulary, rejected resubmission policy, whether `kyc_level` is a true tier or status-derived value, Advanced Verification entitlements and permission gates. No runtime/API mutation performed.
- Status: VIEW MITIGATION INTEGRATED / BUSINESS CONTRACT REVIEW STILL OPEN.

## INT-AUTH-001 — Async authentication and recovery controls can remain stuck after rejected promises

- Date: 2026-11-03
- Reporter: 1号 source audit, cross-checked against existing P1 review evidence
- Files: `assets/js/views-home.js` login/register handlers; `assets/js/app-core.js` 2FA, forgot-password and password-recovery handlers
- Severity: P1 (user can be stranded in authentication/recovery)
- Evidence: async actions disabled submit controls before awaiting API/SDK work; exceptional rejected promises could bypass control restoration and leave buttons stuck in loading state.
- Repair: commit `2b394672c9494188b84b7c9599a2cf29427f4bce` adds try/catch/finally recovery to login/register views and commit `0f5ee3383e9fd375c13f58a0115bb57b1006a534` adds catch/finally handling to 2FA, forgot-password and password-update actions. The existing API request shapes and authentication boundaries are unchanged.
- Related copy correction: registration view now explicitly says email verification is not required, consistent with the current local registration endpoint.
- Validation: JavaScript syntax parse PASS for both changed files. Promise rejection, browser interaction, real recovery-email delivery and expired recovery-session tests NOT RUN.
- Status: SOURCE-LEVEL MITIGATION APPLIED / RUNTIME RETEST REQUIRED.

## INT-ORDER-002 — Standalone Orders route omitted partially-filled active orders

- Date: 2026-11-03
- Reporter: 1号 integration follow-up to 3号 business contract finding
- File: `assets/js/views-trading.js`, `VIEWS.orders.afterRender()`
- Severity: P1
- Evidence: standalone Orders route previously classified only `status === 'open'` as active, while the shared matching contract records `partially_filled` as active with remaining quantity and permits cancellation of the remainder. The main Trade page already uses the canonical `open` / `partially_filled` active set.
- Repair: commit `bfab7707bd802428a394e21c167fc2ea49232efb` adds a local status predicate so partially-filled orders remain in Open Orders and retain the Cancel action; other statuses remain in History. Existing cancel confirmation/result reconciliation and API contracts are unchanged.
- Validation: source assertion and JavaScript syntax parse PASS. Matching-engine runtime, cancel race, balance release and browser interaction NOT RUN.
- Status: SOURCE-LEVEL FIX APPLIED / 3号 CONTRACT CROSS-CHECK AND 2号 INTERACTION RETEST REQUIRED.

## INT-SECONDS-001 — Immature settlement response could move a still-open position into history

- Date: 2026-11-03
- Reporter: 1号 API/UI adapter contract review
- File: `assets/js/app-core.js`, `apiAdapter.secondsSettle()`
- Severity: P1 (position lifecycle / settlement truth)
- Evidence: `api/core.js` explicitly returns `ok:true, settled:false` when the matching RPC reports the position has not matured. The adapter previously moved the position from `state.secondsPositions.open` to history on any `r.ok`, causing the UI to classify an immature position as settled.
- Repair: commit `e2ec958a1b65e44dac4e8eef07822f904aeaafe9` now moves a position to history only when the API response is successful and `settled !== false`. The existing seconds order/settlement API request shape and server financial logic are unchanged.
- Validation: source contract comparison and JavaScript syntax parse PASS. Real PostgreSQL/RPC, immature position, duplicate settlement, timeout-after-commit and ledger reconciliation tests NOT RUN.
- Status: SOURCE-LEVEL FIX APPLIED / 3号 BUSINESS REVIEW AND RUNTIME RETEST REQUIRED.


## INT-EARN-001 — Earn page displayed unverified hardcoded APYs and actionable subscription controls

- Date: 2026-11-03
- Reporter: 1号 source audit; owner: 1号 UI mitigation / 3号 product-contract confirmation
- Severity: P1 (financial product terms could be mistaken for approved live offers)
- Evidence: `assets/js/views-assets.js` contained a static catalogue advertising 4.8% USDT flexible, 1.2% BTC flexible, 2.1% ETH flexible, and 8.5%/12.0%/14.0% fixed-term APYs, with active Subscribe controls. No authoritative product/APY configuration feed is read by this view. The API handler `api/core.js` accepts those product IDs but returns `FINANCIAL_CUTOVER_INCOMPLETE` while `financialWritesEnabled()` is false (source evidence only; no runtime request performed).
- Risk: a static “indicative” disclaimer does not establish that rates, availability, terms, or redemption rules are approved/current. The UI could imply a product is offered even though financial writes are gated.
- Repair: commit `c1cc2e67b6b5cb947f47c793cafe0634addb0ef2` removes the hardcoded product/APY catalogue and disables subscription controls by rendering a clear unavailable state. No API, SQL, financial logic, or balances changed.
- Required 3号 follow-up: provide the authoritative product catalogue, APY source, term/minimum/redemption rules, and enablement gate before any Earn offer is reintroduced.
- Validation: source inspection confirms no hardcoded catalogue remains and empty-state messaging is explicit. Browser interaction, live configuration, PostgreSQL/RPC and financial tests NOT RUN.
- Status: SOURCE-LEVEL UI MITIGATION APPLIED / PRODUCT CONTRACT REVIEW REQUIRED.
