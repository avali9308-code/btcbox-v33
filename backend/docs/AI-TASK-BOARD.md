# BTCBOX 三团队任务与进度板

> 每个团队只更新自己的状态行和工作记录。协调者维护全局状态；团队不能替其他团队填写完成状态。

## 当前协作基线

- Repository：`avali9308-code/btcboxcdt`
- 协调分支：`coordination/ai-team-setup`
- 目标源代码基线：`feature/uiux-upgrade` 的既有代码，开始执行前重新确认最新 SHA。
- 本次组织文档基线：本分支调整提交。
- 生产 `main`：禁止未经授权修改。
- 当前架构：hash-routed SPA，`assets/js/`、`assets/css/` 是真实源代码；`src/` 是目标共享技术层，暂不迁移现有代码。

## 团队状态

| 团队 | 职责 | 监督对象 | 分支 | 状态 |
|---|---|---|---|---|
| 1号 Visual Team | 全站视觉牵头、Design System、tokens、布局、主题、组件外观、响应式及整体执行节奏 | 2号 | `feature/ai1-visual` | IN_PROGRESS — PROJECT LEAD; latest branch SHA `36e8e4b8e7b229b0897e9b41bd4ff25c32681a71`（integration 侧记录：READY — 等待该团队确认最新分支与 source scan） |
| 2号 Interaction Team | 用户流程、路由交互、状态机、反馈时机、动效、异常体验；独立复核1号交付、交互流程与异常状态修复；协助跨组问题定位，按文件owner修复 | 3号 | `feature/ai2-interaction` | IN_PROGRESS — REVIEW & REPAIR; latest branch SHA `8c4a052a48bbf27d81b3425d4af0f1cc7b16c7da`（integration 侧记录：IN_PROGRESS — interaction remediation and peer review; market freshness/API contract remains open） |
| 3号 Business Team | API、Store、Types、用户/钱包/交易/行情/WS 数据与业务接入，配合1号整体节奏 | 1号 | `feature/ai3-business` | IN_PROGRESS — BUSINESS DELIVERY; latest branch SHA `bc77ad3604c95ed91c24a11688d0ef4b5efee44a`（integration 侧记录：READY — 等待该团队确认最新分支与 source scan；ai3-business 侧记录：BLOCKED — 已记录 P0 金融 flag 语义冲突与 P1 Preview API 环境隔离问题；等待 owner 决策） |
| Coordinator | 统一规范、协调、进度和交接；总体监督、跨团队优先级协调、风险升级、里程碑和最终验收 | 监督全部团队，不替代专业实现 | `coordination/ai-team-setup` | IN_PROGRESS — OVERALL GOVERNANCE & ACCEPTANCE（integration 侧记录：IN_PROGRESS — 组织规则同步） |

## 每组必须填写的记录

| 字段 | 内容 |
|---|---|
| Agent | 1号 / 2号 / 3号 |
| Status | READY / IN_PROGRESS / BLOCKED / REVIEW_REQUIRED / DONE |
| Branch | 实际分支名 |
| Base SHA | 开始工作时的 SHA |
| Current SHA | 最新自己的 commit |
| Files changed | 精确文件路径 |
| Completed | 已真实完成的内容 |
| Incomplete | 未完成内容 |
| Tests | 命令、环境、结果 |
| Browser evidence | 浏览器、设备、viewport、步骤、截图 |
| Peer findings | 提交给指定监督对象的 Issue ID |
| Risks / UNKNOWN | 已知风险和未知项 |
| Next action | 一个明确下一步 |
| Handoff | 中断恢复位置 |

## 文件责任原则

- 1号主责视觉文件和 Design System；不决定交互行为或业务数据。
- 2号主责交互流程和交互行为；不决定视觉风格或业务规则。
- 3号主责业务/API/Store/数据；不决定视觉和用户流程。
- 公共契约按 `AI-INTERFACE-CONTRACT.md` 的目录/文件 owner 登记。
- 每个具体文件只指定一个 primary owner；其他团队只提问题和建议，不直接编辑。
- 不允许两个 Agent 同时修改同一文件。发现冲突先停该文件的编辑，其他独立任务继续。

## 单向监督队列

| 监督者 | 被监督者 | 本周期检查范围 | 状态 |
|---|---|---|---|
| 1号 | 2号 | 流程完整性、状态反馈、弹窗/Toast时机、移动操作阻塞 | 持续复核；2号负责修复自己owner范围内问题（integration 侧记录：IN_PROGRESS — INT-1-006 fixed in source; INT-1-002 typography feedback open） |
| 2号 | 3号 | API真实结果、数据状态、WS重连、异常/重复提交 | 持续复核；跨业务文件只登记，按1号/owner协调（integration 侧记录：IN_PROGRESS — INT-3-010/011/012; BUS-MKT-010 independently confirms freshness race） |
| 3号 | 1号 | 视觉 token、数据可读性、组件一致性、响应式 | 持续复核并提交证据，1号负责整合决策（integration 侧记录：待首轮检查；ai3-business 侧记录：K线抽屉源码审查已记录；等待1号补浏览器证据） |

监督意见只记录，不代替对方执行。被监督者独立决定和修复；监督者继续自己的工作。

## 公共层状态

- 统一规范层 `docs/`：已建立章程、任务书、接口契约、评分表和监督规则。
- 共享技术层 `src/`：目标目录契约已定义；当前不迁移现有 SPA 源码。
- 当前源码未迁移：YES。
- API/数据库/资金逻辑是否因本次组织调整改变：NO。

## 验收门槛

以 `ACCEPTANCE-SCORECARD-v1.0.md` 为准：
- Business 50分。
- Interaction 30分。
- Visual 20分。
- 总分 ≥85，且无一票否决项。
- 未执行项目标记 NOT RUN，不得默认为通过。


## Branch bootstrap — 2026-11-02

The following role branches were created from the complete coordination-document baseline `8b1ddd1d9f01f451d4116083ae90d87d5238d88d`:

| Team | Branch | Base SHA | Initial status |
|---|---|---|---|
| 1号 Visual | `feature/ai1-visual` | `8b1ddd1d9f01f451d4116083ae90d87d5238d88d` | READY — source scan not yet recorded |
| 2号 Interaction | `feature/ai2-interaction` | `8b1ddd1d9f01f451d4116083ae90d87d5238d88d` | READY — source scan not yet recorded |
| 3号 Business | `feature/ai3-business` | `8b1ddd1d9f01f451d4116083ae90d87d5238d88d` | READY — source scan not yet recorded |

These are new role branches. Existing legacy branches `feature/ai1-trading`, `feature/ai2-assets-account` and `feature/ai3-shared-ui` were not deleted, reset or modified. Their commits must be reviewed and selectively preserved; do not assume their historical ownership model remains valid.


## 2号 Interaction Team — source scan checkpoint (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IN_PROGRESS
- Branch: `feature/ai2-interaction`
- Source baseline: `feature/uiux-upgrade` SHA `f1d7b86437872a586e90973826b3086d4b5fa298` is the merge base; the interaction branch is 58 commits ahead of that baseline (not behind).
- Current SHA: documentation issue log commit `cca85896de0162eda9f15162b85be7a7c225338c`
- Files changed: `docs/AI-ISSUE-LOG.md` only.
- Completed: source-inspected withdrawal transport failure mapping; logged P1 cross-team finding INT-3-001 for 3号.
- Incomplete: implementation of UI UNKNOWN state; exact source-file owner registration; runtime/browser reproduction.
- Tests: NOT RUN.
- Browser evidence: NOT RUN.
- Peer findings: INT-3-001 (2->3, OPEN).
- Risks / UNKNOWN: server-side idempotency and request status reconciliation semantics require 3号 confirmation. Do not automatically resubmit a withdrawal after ambiguous transport failure.
- Next action: register exact interaction-owned function/file scope and confirm the business response contract before editing withdrawal UI.
- Handoff: continue at `assets/js/views-assets.js` `wdResultState()` and `VIEWS.withdraw.afterRender()`; `assets/js/app-core.js` is outside 2号's ownership.


## 2号 Interaction Team — boot session probe deduplication (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IN_PROGRESS
- Branch: `feature/ai2-interaction`
- Base SHA: `28d95ebc0dfa3f046df13674ba0b90c5334f9c4a`
- Files changed: `assets/js/boot.js`, `docs/AI-TASK-BOARD.md`, `docs/AI-CHANGELOG.md`.
- Ownership: `assets/js/boot.js` is within 2号's task-book scope; change is limited to startup interaction/session probing.
- Completed: reuse a successful initial account probe instead of issuing a duplicate account request; retain the follow-up probe when the initial request did not establish an account (including after the Supabase session exchange path).
- Not changed: API adapter, authentication contract, backend, database, styles, router registration, and protected trading layout.
- Cleanup: removed the redundant successful-path account request; no unrelated code or compatibility logic removed.
- Tests: NOT RUN in this repository runtime.
- Browser evidence: NOT RUN.
- Peer findings: INT-3-001 remains OPEN for 3号.
- Risks / UNKNOWN: runtime request count and OAuth/session recovery behavior still require browser verification.
- Next action: run project test/build checks and verify login/session startup on mobile and desktop.
- Handoff: `assets/js/boot.js` startup function `boot()`, specifically `accountProbe`.


## 2号 Interaction Team — mature-solution quality principle (2026-11-02)

- User direction: do not equate “code has no errors” with “product has no problems”; professional, suitable, mature solutions may be adopted instead of inventing everything in-house.
- Working rule: prefer proven interaction patterns and appropriately maintained libraries/components when they materially improve the product; do not add dependencies without a clear benefit.
- Adoption checks: license/attribution, maintenance, security advisories, stack/browser compatibility, mobile/accessibility behavior, performance/bundle cost, overlap with existing capability, and fit with BTCBOX contracts and team ownership.
- Quality review: evaluate complete user journeys and real feedback/recovery behavior, not just syntax, build success, or console cleanliness.
- Reference target: mature exchange usability and hierarchy (including Binance as a benchmark), adapted to BTCBOX rather than copied.
- Scope: interaction team only; no change to visual ownership, business contracts, or protected trading-page layout.


## 2号 Interaction Team — shared drawer interaction review (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IN_PROGRESS
- Branch: `feature/ai2-interaction`
- Review base SHA: `a54fd37051fe0dc9d9f6c999787ac41bfa40bb3f`
- Files changed: `docs/AI-ISSUE-LOG.md`, `docs/AI-TASK-BOARD.md`, `docs/AI-CHANGELOG.md` (documentation only).
- Source reviewed: `assets/js/ui-components.js` `BTCBox.modal()` / `BTCBox.drawer()`; `assets/js/views-assets.js` deposit network selector.
- Completed: identified missing drawer focus entry/containment/restoration and background-scroll handling; recorded cross-team finding INT-1-001 for 1号. Existing modal implementation already provides a project-native focus-trap pattern; no new dependency is justified at this stage.
- Not changed: shared component source, visual structure/CSS, deposit business flow, API contracts, trading page.
- Tests/build/browser QA: NOT RUN. Source inspection only; runtime and assistive-technology verification remain outstanding.
- Peer findings: INT-1-001 (2->1, OPEN); INT-3-001 (2->3, OPEN).
- Risks / UNKNOWN: `assets/js/ui-components.js` primary owner is not explicitly recorded in the task board; 1号 ownership confirmation is requested before implementation.
- Next action: continue independent interaction review of user journeys and record cross-team findings without editing their files.
- Handoff: `BTCBox.drawer()` in `assets/js/ui-components.js`; consumer `openNetDrawer()` in `assets/js/views-assets.js`.


## 2号 Interaction Team — order decimal input-path supervision (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IN_PROGRESS
- Branch: `feature/ai2-interaction`
- Review base SHA: `a54fd37051fe0dc9d9f6c999787ac41bfa40bb3f`
- Scope reviewed: `assets/js/views-trade.js` order submit path, `assets/js/app-core.js` `apiAdapter.placeOrder()`, 3号's `api/core.js` `POST /api/order` precision finding.
- Completed: traced user-entered price/quantity through the form and adapter; confirmed `parseFloat()` in the form and `Number()` in the adapter precede the API's already-logged Number conversion. Added INT-3-002 to extend BUS-MATCH-005 with end-to-end frontend evidence.
- Not changed: trade form, trading-page layout, API adapter, API implementation, SQL, financial rules or database.
- Tests/build/browser QA: NOT RUN; source inspection only.
- Peer findings: INT-3-002 (2->3, OPEN); related BUS-MATCH-005 (3号 self-review, OPEN).
- Risks / UNKNOWN: precise field ownership for `assets/js/views-trade.js` must be confirmed; fix should preserve raw decimal strings without changing the protected trading-page layout.
- Next action: 3号 confirms payload contract and owner coordination; 2号 continues independent interaction review.
- Handoff: order submit handler in `assets/js/views-trade.js`, then `apiAdapter.placeOrder()` in `assets/js/app-core.js`.


## 2号 Interaction Team — support chat interaction hardening (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IN_PROGRESS — implementation committed; runtime verification outstanding.
- Branch: `feature/ai2-interaction`
- Registered scope: `assets/js/views-account.js` — `VIEWS.support.afterRender()` only;
- Implementation commits: `3f48318d024ea48816149820c85ebbfc7f9664b0`, `785a8a83969f85e3d2132ced490052ac343f0caf`, `65b00c48f186b34acb421a5ceb201aff78061f9c` (latest support handler source commit). 2号 primary owner for this event/state/rendering function. The page template, CSS, API adapter, backend route, shared components, and all other functions in this file were left untouched.
- Completed: message content is rendered through DOM `textContent`; an in-flight guard serializes Send/Enter/quick-reply actions; visible messages are added only after an acknowledged `ok:true` response; drafts are retained on rejection/uncertain delivery; ambiguous outcomes are not automatically resubmitted. The view now calls the existing per-user `apiAdapter.supportMessages()` read method on entry to restore persisted conversation history and refreshes it when the support page is reopened.
- Account isolation: cached support messages are cleared when the active user's UID/email key changes, preventing a prior account's cached conversation from being intentionally reused for a different account.
- Not changed: API/request/response contract, backend, database, styles, shared components, navigation, and protected trading-page layout.
- Cleanup: removed unsafe message HTML interpolation; no dependency added and no unrelated code removed.
- Cross-team finding: INT-3-003 (2->3, OPEN / NEEDS_CLARIFICATION) — current API returns only the latest 50 messages although the stored per-user history is capped at 500; 3号 must confirm whether pagination is required.
- Tests/build/browser QA: NOT RUN. Source inspection only; desktop/mobile, account-switch and assistive-technology verification remain outstanding.
- Risks / UNKNOWN: support message persistence is present in the 3号 source route but has not been runtime-tested. A transport-ambiguous send must be checked in history before retry. The API's 50-message response window is awaiting 3号 clarification.
- Next action: browser-test success/rejection/ambiguous delivery, HTML-like content, repeated send actions, same-user reopen/login restoration, different-account isolation and the 50-message boundary.
- Handoff: `VIEWS.support.afterRender()` in `assets/js/views-account.js`; history contract finding INT-3-003.


## 2号 Interaction Team — logout session lifecycle supervision (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IN_PROGRESS — cross-team contract clarification required.
- Branch: `feature/ai2-interaction`
- Source reviewed: `assets/js/views-account.js` `window.confirmLogout()`; `assets/js/boot.js` Supabase session recovery; `assets/js/app-core.js` `apiAdapter.logout()`.
- Completed: identified that the logout UI ignores Supabase `signOut()` errors and proceeds to local logout; the startup flow can exchange a still-valid Supabase session back into a local session. Recorded INT-3-004 (2->3, P1, OPEN / NEEDS_CLARIFICATION).
- Not changed: logout handler, Supabase auth flow, local session API, backend, database, or navigation.
- Tests/build/browser QA: NOT RUN; source inspection only.
- Risk: a user may see a successful logout but be silently authenticated again on reload if either session invalidation path partially fails.
- Next action: 3号 confirms the authoritative dual-session logout/reconciliation contract; 2号 then updates only the registered user-facing flow.
- Handoff: `window.confirmLogout()` in `assets/js/views-account.js`; startup recovery in `assets/js/boot.js`; finding INT-3-004.


## 2号 Interaction Team — 2FA settings result feedback (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IMPLEMENTED — source review complete; runtime verification outstanding.
- Branch: `feature/ai2-interaction`
- Registered scope: `assets/js/views-account.js` — `VIEWS.settings.afterRender()` 2FA action handler only. The 2FA modal/API adapter in `assets/js/app-core.js`, backend routes, database, settings markup and CSS were left untouched.
- Completed: inspect the adapter result and display success only when `r.ok === true`; surface the server message or a safe fallback on rejection; keep the settings view in place on failure; rerender only after confirmed success; restore the action button in a `finally` path.
- Source evidence: the previous settings handler ignored the returned response and always displayed a success/progress toast. The adapter returns the server confirmation result, including `ok:false` on invalid code or already-enabled/not-enabled states.
- Not changed: adapter, modal internals, API contract, backend, database, visual markup, CSS, and protected trading-page layout.
- Cross-team finding: INT-3-005 (2->3, P2, OPEN / NEEDS_CLARIFICATION) records that the adapter closes its verification modal even when the server rejects the code; 3号 owns that fix.
- Implementation commit: `5d34b5887d3b4c990d8d3f3c0f63be2ffa2b988b`.
- Tests/build/browser QA: NOT RUN. Source inspection only.
- Next action: browser-test successful enable/disable, invalid/expired code, already-enabled/not-enabled responses, modal recovery and mobile behavior after 3号 addresses INT-3-005.
- Handoff: `VIEWS.settings.afterRender()` 2FA action handler; adapter issue INT-3-005 is tracked separately.


## 2号 Interaction Team — KYC submission outcome reconciliation (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IMPLEMENTED — source review complete; runtime verification outstanding.
- Branch: `feature/ai2-interaction`
- Registered scope: `assets/js/views-account.js` — `VIEWS.kyc.afterRender()` submit handler only. KYC API adapter, backend route, data contract, markup and CSS were left untouched.
- Completed: added a single-flight submit guard; when the submit promise rejects, the handler queries the authoritative account state. If KYC is pending, it reports the application as received and returns to the status view. If account lookup confirms no pending application, it reports the request was not recorded. If reconciliation also fails, it shows an explicit unknown status and keeps the submit action disabled to prevent an immediate blind retry.
- Source evidence: the previous handler reported a definitive “Submission failed” without checking the persisted account KYC status. The business route changes the account status to `pending` before returning success, and `apiAdapter.account()` refreshes that status into `state.kyc`.
- Not changed: KYC API adapter, backend, database, response contract, markup, CSS, and protected trading-page layout.
- Implementation commit: `13ad2015b100a34700e1acf8602e69b7cde70bb5`.
- Tests/build/browser QA: NOT RUN. Source inspection only.
- Next action: browser-test confirmed success, server rejection, transport rejection after save, transport rejection before save, failed reconciliation, duplicate submit and mobile behavior.
- Handoff: `VIEWS.kyc.afterRender()` submit handler.


## 2号 Interaction Team — mature pattern adoption register (2026-11-02)

- Agent: 2号 Interaction Team
- Status: ACTIVE REFERENCE
- Branch: `feature/ai2-interaction`
- Deliverable: `docs/AI-INTERACTION-PATTERN-RESEARCH.md`.
- References assessed: OWASP Transaction Authorization Cheat Sheet (CC BY-SA 4.0), OWASP Business Logic Security Cheat Sheet (CC BY-SA 4.0), and Stripe's published idempotency/error-testing patterns (documentation reference only; no Stripe code or SDK adopted).
- Decisions: use WYSIWYS review for withdrawals; explicit state transitions; one in-flight UI action; stable logical request identifiers; server-owned atomic idempotency and status reconciliation; unknown outcomes must not be called success/failure or blindly resubmitted.
- Reuse decision: no new dependency; reuse existing BTCBOX modal/drawer/API adapter and native DOM capabilities unless an evidenced gap justifies a maintained package.
- Adoption gate: license, attribution, maintenance, security advisories, compatibility, accessibility, mobile, bundle/performance and duplication review before any dependency/code adoption.
- Validation: research/source inspection complete; runtime/browser tests NOT RUN; no backend contract presumed.


## 2号 Interaction Team — withdrawal unknown-outcome UX hardening (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IMPLEMENTED — source review complete; backend reconciliation remains blocked on 3号 contract.
- Branch: `feature/ai2-interaction`
- Registered scope: `assets/js/views-assets.js` — `VIEWS.withdraw.afterRender()` local result mapping, `showResult()`, and `#wd-form` submit handler only. No CSS, markup template, API adapter, backend, database, or financial business logic changed.
- Completed: distinguish network/financial RPC ambiguity from a confirmed rejection; show a dedicated Status Unconfirmed result; remove the unsupported blanket claim that every failed response leaves the balance unchanged; guard duplicate submits while the request is in flight; catch rejected promises and always restore or deliberately lock the submit button; suppress the immediate New Withdrawal action while this view's outcome remains unknown.
- Cross-team dependency: INT-3-006 (2->3, P1, OPEN / NEEDS_CLARIFICATION) — backend must provide durable request-id status/history reconciliation and confirm idempotency semantics. The UI guard is only a same-view mitigation and cannot replace server idempotency or survive a page reload as an authoritative control.
- Mature pattern: aligns with `docs/AI-INTERACTION-PATTERN-RESEARCH.md` — OWASP transaction review, explicit unknown state, single-flight interaction, and reconciliation before resubmission.
- Implementation commits: `be9e8f42f15b6f522bc378c610ea781b0716f32a`, `2b142c2129d9e5d03ff43d44cf50b32b1608cb6e`.
- Not changed: request/response schema, request-id policy, API adapter, backend, database, balance logic, fee logic, and protected trading-page layout.
- Tests/build/browser QA: NOT RUN. Source inspection only.
- Next action: 3号 confirms and implements request status lookup/idempotency contract; then 2号 adds durable recovery and browser tests.
- Handoff: `VIEWS.withdraw.afterRender()` in `assets/js/views-assets.js`; INT-3-006 for 3号.


## 2号 Interaction Team — deposit address request race and copy feedback (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IMPLEMENTED — source review complete; runtime verification outstanding.
- Branch: `feature/ai2-interaction`
- Registered scope: `assets/js/views-assets.js` — `VIEWS.deposit.afterRender()` local request sequencing and address/memo copy event handlers only.
- Completed: monotonically increasing request sequence ensures only the latest coin/network response can update the address, QR and memo; stale responses are ignored; rejected address requests clear the loading state and show an unavailable message; address/memo copy reports success only when Clipboard API or the verified `execCommand` fallback succeeds.
- Not changed: deposit endpoint, request/response contract, address generation, network rules, backend, database, styles, markup, or protected trading-page layout.
- Mature pattern: latest-request-wins for dependent async selectors; progressive Clipboard API with verified fallback and truthful feedback. No new dependency.
- Implementation commit: `8b674862c66a014e520a3947d3d6c55248a6e4c5`.
- Tests/build/browser QA: NOT RUN. Source inspection only.
- Next action: browser-test rapid coin/network changes, slow/out-of-order responses, rejected requests, clipboard permission granted/denied and manual fallback on desktop/mobile.
- Handoff: `VIEWS.deposit.afterRender()` in `assets/js/views-assets.js`.


## 2号 Interaction Team — Earn ambiguous outcome protection (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IMPLEMENTED — source review complete; durable recovery remains blocked on 3号 contract.
- Branch: `feature/ai2-interaction`
- Registered scope: `assets/js/views-assets.js` — `VIEWS.earn.afterRender()` subscription event/state handling and Subscribe button state only; no product data, API adapter, backend, database, business rules, markup layout or CSS changed.
- Completed: one request ID is retained for a modal's logical product/amount payload; a changed amount receives a new key; network/5xx outcomes map to UNKNOWN; the current app session blocks further subscription attempts for the affected product until reconciled; rejected promises no longer leave the confirmation button spinning; only confirmed `ok:true` closes the modal and displays success.
- Cross-team dependency: INT-3-007 (2->3, P1, OPEN / NEEDS_CLARIFICATION) — authenticated earn operation/history lookup and frontend account state exposure are required to recover after reload/re-login.
- Mature pattern: caller-scoped idempotency + immutable logical request, explicit UNKNOWN state, reconciliation before resubmission; see `docs/AI-INTERACTION-PATTERN-RESEARCH.md`.
- Implementation commits: `d6427c322fb0e9c44fc24301f38997773958d5d1`, `f2ccf4b07bba731403e5c076d2ec8c1ba52f8f74`, `11c2e8569fa7ead3a7a4aa88687ce27e1855d991`.
- Not changed: product configuration, API schema, API adapter, backend, database, balances, fees, business rules, markup layout, CSS, and protected trading-page layout.
- Tests/build/browser QA: NOT RUN. Source inspection only.
- Next action: 3号 confirms and implements per-user earn history/status lookup; then 2号 adds durable recovery and browser tests.
- Handoff: `VIEWS.earn.afterRender()` in `assets/js/views-assets.js`; INT-3-007 for 3号.


## 2号 Interaction Team — Earn position / redemption and asset history audit (2026-11-02)

- Agent: 2号 Interaction Team
- Status: IN_PROGRESS — source audit completed; cross-team contracts pending.
- Branch: `feature/ai2-interaction`
- Base SHA: `0c97a72b18d305773207d6059d4580499f822e5d`
- Current SHA: pending documentation commit
- Files changed: `docs/AI-ISSUE-LOG.md`, `docs/AI-TASK-BOARD.md`, `docs/AI-CHANGELOG.md` (audit-only; no application code changed in this checkpoint)
- Completed: verified the Earn view has no live position rendering or redemption handler; `#earn-positions` is static empty-state content. Verified Assets overview hardcodes In Earn to 0.00 USDT. Verified Records scrolls to an unavailable-history placeholder and Transfer opens an unavailable-feature modal. Confirmed the frontend account state does not retain `earn_records` as recorded in INT-3-007.
- Incomplete: no redemption UX can safely be implemented until 3号 confirms the authoritative position schema, redemption action/eligibility rules and status reconciliation. No transaction-history UI can be wired until the authenticated ledger endpoint and pagination contract are confirmed.
- Tests: NOT RUN — source inspection only; no runtime, build or browser test executed.
- Browser evidence: NOT RUN.
- Peer findings: INT-3-008 (2->3, P1, OPEN / NEEDS_CLARIFICATION); INT-3-009 (2->3, P2, OPEN / NEEDS_CLARIFICATION); INT-3-007 remains OPEN.
- Risks / UNKNOWN: do not fabricate Earn positions, balances, redemption eligibility, ledger history or transfer success in the frontend. The hardcoded Earn zero is not authoritative.
- Next action: obtain 3号 API/data contract decisions; then implement Earn positions/redeem and asset history interaction in the registered 2号-owned view scope.
- Handoff: `assets/js/views-assets.js` `VIEWS.earn()`, `VIEWS.earn.afterRender()`, `VIEWS.assets()`, `VIEWS.assets.afterRender()`; cross-team blockers INT-3-007/008/009.


### Registered implementation scope — truthful unavailable-state copy

- Owner: 2号 Interaction Team
- File: `assets/js/views-assets.js`
- Exact scope: `VIEWS.assets()` Earn valuation placeholder and `VIEWS.earn()` static positions empty-state copy only.
- Allowed change: replace unsupported hardcoded zero / misleading promise that positions will appear with an explicit unavailable/not-synced state. No data calculations, API adapter, backend, CSS/layout, product terms, balances, or business rules may be changed.
- Acceptance: missing Earn data must not be represented as a confirmed zero; empty positions must not imply a completed live position feed; preserve all existing IDs, structure and locked trade page.
- Tests: NOT RUN until executed.


### Implementation result — truthful Earn unavailable states (2026-11-02)

- Completed within registered scope in `assets/js/views-assets.js` only: replaced the unsupported hardcoded Earn value `0.00 USDT` with `—`; changed the Earn positions placeholder so it no longer promises positions will appear; changed subscription success copy to disclose that position records are not displayed; changed ambiguous-result guidance so it no longer tells users to check an operation-history screen that does not exist.
- Application commits: `ca1a6348d7553c69e16fc9b03f156ed7ed9d273d`, `32434f13d011ac3e37b376c1d1f323416a58a9f4`, `3e7eef6dccbc3af51cab9249afb3bd11ea39173d`.
- Validation: PARSE OK (compile only; not executed); source string checks {"earnValueUnavailable":true,"positionEmptyStateHonest":true,"subscriptionToastNoHistoryClaim":true,"modalNoPromise":true}.
- Tests / browser / build: NOT RUN. This is a copy/state-honesty mitigation only; it does not implement Earn records, redemption, or reconciliation.
- Remaining blockers: INT-3-007 and INT-3-008 (3号 API/data contract).


### Registered scope — withdrawal UNKNOWN guard across SPA navigation

- Owner: 2号 Interaction Team
- File/function: `assets/js/views-assets.js` — `VIEWS.withdraw.afterRender()`, local submit guard and UNKNOWN result transition only.
- Finding: the current `withdrawalOutcomeUnknown` variable is local to `afterRender()`; leaving and re-entering the route resets it, allowing another request despite an unresolved outcome.
- Allowed change: retain an account-scoped UNKNOWN marker in the existing in-memory app state and consult it before accepting a new withdrawal; keep the form disabled/blocked with truthful guidance. Do not persist addresses, passwords, 2FA codes or transaction payloads. Do not change API request schema, request IDs, backend, CSS or withdrawal business rules.
- Limitation: in-memory guard protects SPA navigation only; full reload/re-login reconciliation still requires the server contract tracked in INT-3-006.
- Tests: NOT RUN until executed.


### Implementation result — withdrawal UNKNOWN guard across SPA navigation (2026-11-02)

- Fixed `VIEWS.withdraw.afterRender()` so an ambiguous withdrawal outcome is retained as an account-scoped marker in existing in-memory app state. Re-entering the Withdraw route in the same SPA session restores the disabled `Status Unconfirmed` submit state and warns against another request.
- No secret, address, fund password, 2FA code or transaction payload is persisted. No API/backend/DB/CSS/trading-page change.
- Commit: `35267a30e8162760ebff67d8e5eaf213fb249da3`.
- Validation: PARSE OK (compile only; not executed); source checks {"userScopedMarker":true,"markerSetOnUnknown":true,"blockedOnRouteReentry":true,"guardWarnsBeforeNewSubmit":true,"tradePageUntouched":true}.
- Limitation: marker is in-memory only; reload/re-login recovery still depends on INT-3-006 server-side status lookup and idempotency contract.
- Runtime, browser, build and automated tests: NOT RUN.


### Registered scope — support history load failure must block sending until retry

- Owner: 2号 Interaction Team
- File/function: `assets/js/views-account.js` — `VIEWS.support.afterRender()` only; no API adapter or backend changes.
- Finding: history read failure is silently swallowed and the send button is re-enabled. A user may resend a message whose prior delivery status is unclear without first recovering the conversation history.
- Allowed change: expose a visible history-unavailable state with a Retry action; keep send, input and quick replies disabled until history loads successfully. Keep the existing support API contract and user-scoped cache behavior unchanged.
- Acceptance: successful history restores controls; failed/ambiguous history read blocks send and shows retry; retry success restores send; user switch does not display previous user's messages.
- Tests: NOT RUN until executed.


### Implementation result — support history recovery gate (2026-11-02)

- Updated `VIEWS.support.afterRender()` to show a visible history-unavailable notice with a Retry action. When authenticated history cannot be loaded, Send, the input and quick replies remain disabled until a retry successfully retrieves the user's conversation.
- Existing support API contract and adapter were not changed.
- Commits: `ede0380dd9326d7cf4ec02328767eed95216ca83`, `97be85c24982c92fce51da6d1b0f4f0224428022`.
- Validation: PARSE OK (compile only; not executed); source checks {"retryActionPresent":true,"historyFailureBlocksControls":true,"historyFailureDisablesInput":true,"quickRepliesBlocked":false,"sendGuardIncludesHistoryFailure":true,"failedHistoryVisible":true}.
- Runtime/browser/build/automated tests: NOT RUN.
- Peer concern to 3号: support history adapter mutates shared `state.supportMsgs` before caller-side user-key validation; a stale request resolving after account switch may overwrite the new user's cache. Logged as INT-3-010.


### Follow-up verification — support history recovery selector (2026-11-02)

- Corrected the quick-reply control query to use `$$()` (all matching buttons); the single-element `$()` helper does not provide `.forEach()`.
- Final support-view blob: `f2833f30a124f6a6351a914c34a1572c148db03c`.
- Validation: PARSE OK (compile only; not executed); source checks {"retryButton":true,"sendAndInputDisabled":true,"allQuickRepliesDisabled":true,"sendGuard":true,"visibleError":true,"historySuccessRequired":true}.
- Tests/build/browser QA: NOT RUN.


### Registered scope — Earn UNKNOWN marker account isolation

- Owner: 2号 Interaction Team
- File/function: `assets/js/views-assets.js` — `VIEWS.earn.afterRender()` local UNKNOWN product guard only.
- Finding: `state._earnUnknownProductIds` is global across accounts in the SPA; an ambiguous result for user A can block the same product for user B after account switch.
- Allowed change: scope the in-memory unknown-product list by authenticated user key. Do not persist secrets or alter backend, product rules, API, CSS or trade page.
- Acceptance: unknown state remains blocked for the same user across SPA route re-entry; a different user does not inherit the previous user's marker.
- Tests: NOT RUN until executed.


### Implementation result — Earn UNKNOWN marker account isolation (2026-11-02)

- Scoped the Earn unknown-product marker by authenticated UID/email in in-memory state. The same user remains blocked across SPA route re-entry; a different account no longer inherits that marker.
- Commit: `4ca1b050ecb3e2f54ef128305d2ff7cd31fccf98`.
- Validation: PARSE OK (compile only; not executed); source checks {"perUserMap":false,"localAccountAlias":false,"renderGuard":true,"markerSet":true,"oldGlobalArrayRemoved":true}.
- Limitation: in-memory only; full reload/re-login reconciliation still requires INT-3-007 backend contract.
- Runtime/browser/build/automated tests: NOT RUN.


### Follow-up verification — Earn account map reference (2026-11-02)

- Corrected the per-user map initializer to consistently reference `state._earnUnknownProductIdsByUser`; this avoids an undeclared variable under strict mode.
- Final Earn source blob: `a9b701d778b2d4cbf089f2284efb09c4659edc90`.
- Validation: PARSE OK (compile only; not executed); source checks {"mapUsesState":true,"aliasFromState":true,"renderGuard":true,"markerSet":true,"noUndeclaredMap":true}.
- Runtime/browser/build/automated tests: NOT RUN.


## 2号 Interaction Team — market and order-history quality pass (2026-11-02)

- Branch: `feature/ai2-interaction`
- Source reviewed: `assets/js/app-core.js`, `assets/js/views-trade.js`, `assets/js/views-assets.js`.
- Implemented in `assets/js/views-trade.js` only:
  - Missing/non-positive market quotes render as an em dash instead of a misleading zero price in the trade pair list, mobile pair bar, and order-book midpoint.
  - Market orders are blocked when no positive live quote is available; limit orders require an explicitly valid positive limit price.
  - Percentage allocation refuses to divide by a missing/zero quote; switching back from Market restores a valid quote or leaves the limit-price field blank.
  - Order history uses the concise `Qty` label; market orders display `Market` rather than a fabricated zero price; missing quantities, fill values, and invalid timestamps display as unavailable rather than misleading zero/invalid date text.
  - Order detail timestamps use a consistent readable date/time format.
- Implementation commits: `975ab715712f8fde625337f300ed59e23dbbdf7f`, `147262f6ec20cf96880195851996bf0102f734e5`.
- Trading workspace layout, API payload shape, order business rules, stylesheets, and backend were not changed.
- Cross-team findings: INT-3-011 (market[] response branch skips pre-seeded symbols), INT-3-012 (quote freshness/stale display/out-of-order polling), INT-1-002 (history table typography/responsive presentation).
- Validation: source inspection and exact-string checks only; JavaScript compile check, build, automated tests, browser QA and mobile screenshots remain NOT RUN.
- Next: 3号 fixes quote response/freshness contract; 1号 reviews history-only typography; 2号 independently retests the agreed states without changing the locked trade layout.


### Implementation result — Assets valuation refresh and missing-quote handling (2026-11-02)

- Updated only `assets/js/views-assets.js`.
- Total, Available, Frozen and per-asset estimated values now refresh every 3 seconds while the Assets route is active, using the existing market poll's latest state.
- A positive asset balance without a valid positive quote displays `—`; incomplete aggregate valuations display `—` rather than silently counting missing prices as zero.
- Hide Small no longer hides an asset solely because its quote is unavailable.
- Commit: `821f1a104210d7b43d77a04cbf2a7950e1c9777f`.
- Validation: PARSE OK (compile only; not executed); targeted source checks passed. Runtime/browser/build/automated tests remain NOT RUN.
- INT-3-012 remains open: the backend market layer still needs authoritative quote timestamps, freshness states and out-of-order response protection.


## 2号 Interaction Team — peer-review remediation batch (2026-11-02)

- 3号 findings INT-ORDER-001 and INT-ORDER-002:
  - Cancel action now refreshes authoritative orders/account state and reports success only after a confirmed cancelled status.
  - `open` and `partially_filled` both remain in Open Orders and expose Cancel for remaining quantity.
  - Implementation commits: `048a4d68d71d6fa791c480c6d449e482479eede2`, `e12d45ef577d19462f329cba28da36df0429c9e7`, `69ad8461c66baa8123da31f5e2167bc2842b23c8`, `333568e6f8f5d2c1dbf3a12f605f4448bb926767`.
- 3号 finding INT-KYC-001:
  - KYC views now normalize object/string status, show Pending before any approval state, and do not interpret status-derived `kyc_level` as a tier. Advanced verification remains locked pending explicit business contract.
  - Implementation commits: `e58ef5987cebbc5f4fc252c0aa176c3a105e883a`, `b929384d6b85a5c8a775a6d16679abffc060cd49`.
- 1号 finding INT-1-006:
  - My Account profile card now matches its handler and is keyboard accessible.
  - Implementation commit: `50f1e43a69cd82b2a5facb3891deeb3345d94fde`.
- Cross-team boundary: no API adapter, account mapper, backend, SQL, permissions, visual CSS or matching rules changed.
- Validation: changed JS files compile successfully via `new Function(source)` (compile only; not executed). Runtime/browser/build/automated tests remain NOT RUN.
- Pending: 3号 KYC tier/permission semantics; independent runtime checks for order cancel races, partial fills and profile keyboard interaction.


### 2号 current checkpoint — 2026-11-02

- Status: IN_PROGRESS; branch: `feature/ai2-interaction`.
- Completed source mitigations: quote/asset display truthfulness, market/limit price entry guards, order history readability, partial-fill active-order handling, cancellation result reconciliation, KYC pending/approved display correction, profile modal target and keyboard activation.
- Cross-team open items: INT-3-011 / INT-3-012 (market payload/freshness contract; BUS-MKT-010 is an independent matching finding); INT-3-010 (support stale response ownership); KYC tier/permission semantics; INT-1-002 (history-only typography refinement).
- Runtime/browser/build/automated tests remain NOT RUN. Vercel status remains failure due build-rate-limit; it is not evidence of a successful build.


### 2号 independent review & repair — My Account hub (2026-11-02)

- Reviewed 1号 branch `feature/ai1-visual` at SHA `c38cc27e77d49d427fd76bdca9bdec4164bd9e7e`.
- Found the redesigned My Account hub duplicated numeric asset balances without a freshness indicator and used status-derived KYC level as a verified tier. Logged `INT-2-005`.
- Implemented the grouped account information architecture in 2号-owned `assets/js/views-missing.js`: identity/security, support, preview-only additional services, and a clear Assets deep link. Removed numeric balance snapshot from My Account so all valuation lives in the Assets page. KYC badge is status-first; profile/logout remain semantic buttons.
- Commit: `761741338eb3e3d6572e059c8c57af75f635f3a8`.
- Integration dependency: matching `.va-hub-*` styles are currently on 1号 branch; preserve and integrate them with this markup.
- Validation: PARSE OK (compile only; not executed); targeted source checks passed. Runtime/browser/build/automated tests: NOT RUN.


### Integration status — My Account hub — 2026-11-02

- 2号 commit `761741338eb3e3d6572e059c8c57af75f635f3a8` is integrated into 1号 `feature/ai1-visual` at `36e8e4b8e7b229b0897e9b41bd4ff25c32681a71`.
- 1号 kept the visual CSS and grouped information hierarchy; 2号's corrected KYC state normalization, removal of stale numeric snapshot, and profile keyboard behavior are included.
- 3号 remains responsible for confirming API state vocabulary and capability availability. Browser/runtime tests remain NOT RUN.


### 2号 re-review request — Support Center visual refresh — 2026-11-02

- Review 1号 markup commit `76b85da92b9af76ac36c9d202a7c880da962f6b9` and CSS commit `f711ec49479f0cbc514922f56605509a721fd448` on `feature/ai1-visual`.
- Verify existing chat events and selectors still work, Enter and quick-topic behavior, scrolling/focus and aria-live. Inspect `INT-1-008` raw `innerHTML` message rendering; fix only if the source trust boundary confirms untrusted content can reach it.
- Keep service availability neutral pending 3号 evidence. Runtime/browser QA NOT RUN.


### KYC detail view integration — 2026-11-02

- 2号's status-first KYC detail view and ambiguous-submit reconciliation from `assets/js/views-account.js` were integrated into 1号 `feature/ai1-visual` commit `eb19dc8f28575ae26d603a52abab79fb80d4bc36`.
- 1号 preserved the account CSS root scope. Pending no longer displays as Approved; only explicit approved status does.
- 3号 still must confirm rejected resubmission policy, canonical status vocabulary, actual tier semantics and permission gates. Runtime/browser/build/tests NOT RUN.


### 2号 re-review request — Settings UI refresh — 2026-11-02

- Review 1号 commits `55bb3870619bb214175a5f1a828d652c7ac37cba`, `7e9a46ded56fb16e9cfe4c554d97115013368a14`, `5cf155f556ed5686ee3ca77d5e0fa84e26ea9ee5` on `feature/ai1-visual`.
- Verify preserved selectors `set-pwd`, `set-fundpwd`, `set-2fa`, `pref-hide`; password modal submit and error recovery; fund-password validation; 2FA enable/disable confirmation/loading; preference toggle and keyboard/focus behavior.
- No interaction code was changed by 1号. Fix only evidence-backed defects on interaction-owned source and return commit/evidence. Browser QA NOT RUN.


### Re-review queue from 1号 — UI batch 2026-11-02



## 1号 Visual Team — My Account information architecture review — 2026-11-02

- Review source: `assets/js/views-missing.js` on `feature/ai1-visual`; verified current `VIEWS.me()`, Assets entry points, account child views, and shared modal implementation.
- Completed: compared the current flat account-feature grid with mature exchange account-center patterns; mapped existing live routes versus preview-only capabilities; identified overlap with the dedicated Assets destination; recorded actionable cross-team recommendation `INT-1-007` for 2号 in `docs/AI-ISSUE-LOG.md`.
- Recommendation scope: group identity, security, verification, support and preferences by intent; keep wallet/transfer/records under Assets; group fiat/payment only when backed by actual route/capability; do not elevate preview-only functions to the same status as live features.
- Files changed in this review: `docs/AI-ISSUE-LOG.md` only. No peer-owned interaction or business source was edited.
- Implementation status: NOT STARTED — awaiting 2号 response/implementation under file ownership rules.
- Build/tests/browser QA: NOT RUN.
- Next action: inspect the peer response and route map, then perform a visual review of the grouped account hub once 2号's source change is available.
- Handoff: start with `INT-1-007`; re-fetch `feature/ai2-interaction` `assets/js/views-missing.js` and `docs/AI-ISSUE-LOG.md` before reviewing or proposing further changes.

## 1号-led execution — My Account grouped UI delivered for peer review — 2026-11-02

- Workflow direction confirmed by user: 1号 leads the interface and visual implementation first; 2号 performs interaction/route/accessibility re-review and fixes verified defects; 3号 continues business/data-contract review and follows through.
- UI commits on `feature/ai1-visual`:
  - `37b37b96fcc7665db6353ec89abcbf6b0863ac6c` — replace the flat feature grid with grouped account-center hierarchy and a semantic profile action target.
  - `4d9f49d9cd67584b884ee0a79e3c9724dc6a6c6c` — remove duplicate Settings destinations; combine security and preferences under the existing Settings route.
  - `1fe884a28718080639b6eea0e9cc4178b23fde81` — add dedicated responsive styles for identity summary, compact Assets link, grouped panels, status labels and separated logout.
- Resulting structure: identity summary; compact Assets overview link; Account & Security (KYC + one Security & Preferences route); Help & Support; Additional Services with Fiat/Payment and Rewards/Referrals explicitly marked Preview; separated Logout. Wallet transfer/records are not presented as personal-account settings.
- Existing route identifiers and API/business handlers were retained. Existing profile modal handler is now matched by a semantic `button#me-profile`; logout is now a native button using the existing handler. No auth, wallet, transfer, KYC API, financial or backend behavior was changed.
- 2号 review completed: commit `761741338eb3e3d6572e059c8c57af75f635f3a8` was ported into 1号 source at `36e8e4b8e7b229b0897e9b41bd4ff25c32681a71`; KYC status normalization, no stale numeric balance snapshot, profile keyboard activation and logout semantics are integrated. Runtime retest remains pending.
- 3号: continue checking the underlying account/KYC/security truth and availability of preview-only payment/referral capabilities; confirm that this presentation does not imply unavailable services. Report evidence and any backend/data-contract issue.
- 1号: after review, address verified visual findings and continue the same UI-led approach on the next account-related areas.
- Validation: whole `views-missing.js` syntax compile PASS; mock-render checks PASS for pending/approved/unsubmitted status labels, profile/logout buttons, Assets link and preview markers. Build, automated tests, real browser, keyboard and device QA are NOT RUN.
- Next handoff: 3号 completes `BUS-ACC-001` business/data-contract review; 1号 addresses only evidence-backed visual findings and proceeds to the next account UI area.


## 1号 Visual Team — Support Center UI refresh — 2026-11-02

- Updated `VIEWS.support()` in `assets/js/views-account.js` and added a dedicated responsive module in `assets/css/views-account.css`.
- Removed unverified static “Online” and weekday service-hour claims; replaced them with neutral Support Center / Message Center copy pending 3号 confirmation of authoritative availability.
- Added a support intro panel, clearer message header, accessible input label, polite live region and grouped quick topics. Preserved `chat-body`, `chat-input`, `chat-send`, `.chat-q` hooks; no message-send, API, account or backend logic changed.
- Commits: `76b85da92b9af76ac36c9d202a7c880da962f6b9` (markup), `f711ec49479f0cbc514922f56605509a721fd448` (responsive CSS).
- 2号 re-review requested in `INT-1-008` and the support handoff: verify send/Enter/quick-topic/scroll/focus/aria-live and assess raw message insertion into `innerHTML`.
- 3号 follow-up: `BUS-SUPPORT-001` confirms hours/timezone/holiday and actual live-agent source before any availability claim returns.
- Whole `views-account.js` syntax compile PASS; runtime/browser/mobile QA NOT RUN.


## 1号 Visual Team — KYC detail state correction integrated — 2026-11-02

- Integrated 2号's status-first KYC detail page and submission-outcome handling from `feature/ai2-interaction` into `assets/js/views-account.js` on 1号 branch.
- Commit: `eb19dc8f28575ae26d603a52abab79fb80d4bc36`.
- Preserved the `va-account-page` root scope and existing visual CSS. Pending no longer follows the `level>=1` Approved branch; only explicit `approved` displays approval. Status object/string forms are normalized. Ambiguous submit transport outcomes are reconciled through account refresh before allowing resubmission.
- Static validation: whole file syntax compile PASS; mock-render checks PASS for pending, approved, unsubmitted and rejected states. Business policy for rejected resubmission and advanced tier still requires 3号 confirmation. Runtime/browser/build/tests NOT RUN.
- 3号: continue `INT-KYC-001` / `BUS-ACC-001` canonical status, tier and permission review. 2号: re-review the integrated KYC form/modal/event flow if needed; no visual CSS changes required.


## 1号 Visual Team — Settings security-first UI refresh — 2026-11-02

- Reworked `VIEWS.settings()` into a security-first layout: compact security overview, separate Account Security and Preferences groups, consistent line-icon tiles, readable row hierarchy and explicit enabled/not-enabled states.
- Preserved existing interaction IDs and handler ownership: `set-pwd`, `set-fundpwd`, `set-2fa`, `pref-hide`. No password, 2FA, fund-password, preference persistence, API or auth logic changed.
- Commits: `55bb3870619bb214175a5f1a828d652c7ac37cba` (layout), `7e9a46ded56fb16e9cfe4c554d97115013368a14` (line icons), `5cf155f556ed5686ee3ca77d5e0fa84e26ea9ee5` (responsive CSS).
- Static validation: whole `views-account.js` syntax compile PASS; all four markup IDs still match existing handlers; responsive rules for <=600px and <=360px present. Runtime/browser/mobile QA NOT RUN.
- 2号: re-review button binding, modal flows, 2FA enable/disable loading/confirmation, hide-small-balances toggle and keyboard focus. Do not duplicate handlers.
- 3号: confirm `state.settings.twofa` and `fundPwdSet` remain authoritative and synchronized with account API; confirm copy does not overstate protection scope.


## 1号 Visual Team — Assets + Markets UI batch — 2026-11-02

- Assets: simplified page title, added structured heading/wallet context, tightened spot-asset hierarchy, and replaced the hard-coded `In Earn 0.00 USDT` presentation with an unavailable marker so the UI does not imply an API-backed Earn balance. No asset calculation or wallet behavior changed.
- Markets: rebuilt the page header/search/filter/table structure with semantic filter buttons, accessible search label, explicit quote context, clearer pair/favorite hierarchy, and compact mobile table columns. Preserved `mkt-search`, `mkt-tabs`, `mkt-body`, `data-tab`, `data-sym`, favorite state, and `#/trade/<symbol>` navigation.
- Commits: Assets `7669cf45d6025c919da31fe558a30fc5e1d5b91e`, `f813e0957b1141ef11f5a7e9221c9756b25035f2`, `f4eda644cc875e72d798e7727bff8d56ec9e6299`, `6a6f9bd5d91c02ebe7b0fc6709e6231aec814314`; Markets `9348e837d132a9486c4cad12f1cd977b0fe37cc1`, `e59b4f2aa4a1c624df6ee175c544ee008d483499`, `b83973b7078368f42a92c9ef60105ca4bcfb3d8a`.
- Static validation: whole `views-home.js`, `views-assets.js`, `views-account.js` syntax compile PASS; market search/tabs/favorites/trade route selectors retained. CSS breakpoint/column rules present. Browser/device/build/API QA NOT RUN.
- 2号: re-review market tab/search/favorite event behavior, row click vs favorite click propagation, mobile hidden-column readability, keyboard focus; re-review Assets search/hide-small/transfer/records interactions for regressions.
- 3号: confirm the Earn balance endpoint/source before any real value is displayed; confirm the market quote universe, live update source, 24h field definitions and favorite persistence scope. Flag any data labels that exceed current API guarantees.


## 1号 Visual Team — Deposit / Withdrawal presentation batch — 2026-11-02

- Added a consistent page-heading hierarchy to Deposit and Withdraw, including compact context labels, consistent page width, card spacing and responsive stepper treatment.
- Existing form fields, network selector, QR/address IDs, copy controls, withdrawal steps, review/security/result panels and API handlers remain unchanged.
- Commits: Deposit `30eaac2e77596b10c32f0acfa7e2064640cb8abe`; Withdraw `22877cd5a9fec3549ef28a7eab2b2f187a4fbfb0`; shared CSS `1bf92cb106b358330d0d1f6ae8a72e4b45a40805`.
- Static syntax compile and browser/device QA pending for this batch. Do not infer runtime success from source inspection.
- 2号: re-review address/network selector, QR render, copy buttons, memo behavior, withdraw stepper/back/confirm/security/result states and focus behavior.
- 3号: verify deposit minimum, network availability, manual-review wording, withdrawal fee/available-balance presentation and any restrictions that the page copy must reflect.


---

## 用户批准的三方长期协作指令 — 2026-11-02

用户已明确批准 1号主导视觉整合、2号持续审查修复交互、3号持续核验业务/数据合同；常规职责范围内不再逐项向用户请示。完整长期指令已分别写入：
- 2号 `feature/ai2-interaction`：`9cc1c04bc2d07661ca40c331be3e15de4a8f9b1`
- 3号 `feature/ai3-business`：`aa04714cff1f5e9939706ac764ddb1a046b441e1`

当前协作优先批次：交易终端、秒合约、订单页。2号聚焦交互状态/事件/移动端/异步结果；3号聚焦报价与精度、订单生命周期、部分成交/撤单、余额冻结/结算和接口状态真实性。每批必须留下证据、提交 SHA、实际验证结果和可恢复的中断交接。用户未批准 main 合并、生产部署、SQL/资金操作或业务规则变更。

 
## 1号 Visual Team — Trade / Seconds / Orders presentation batch — 2026-11-02

- Updated `assets/js/views-trading.js` commit `56ec4501df0447f39dd6df55cfa2359eb5d69e2d`: added compact hierarchy to Seconds Contracts and Orders headings; removed redundant explanatory subtitle from Seconds without changing order/settlement handlers or existing selectors.
- Updated `assets/css/views-trade.css` commit `3a369a6e27b2153697037048835ceb8b7c1ab1c3`: consolidated Seconds/Orders route-specific styles; improved price/duration/amount grid, action button proportions, risk/rules density, orders tab hierarchy, sticky table headers, row spacing and responsive behavior down to 360px.
- JS syntax compilation via `new Function(source)`: PASS before CSS consolidation; source markup changes only. CSS source consolidated and manually inspected for section structure. Browser/device/build/tests NOT RUN.
- 2号 review requested in `feature/ai2-interaction` task board commit `5de463a46dbcb76587ea354281499bb7bbbaad1d`.
- 3号 business contract review requested in `feature/ai3-business` task board commit `f6283542ad0a54336e2a630989551d8b20b8e3a1`.
- Pending: independently verify desktop trade workspace and K-line drawer; integrate 2号 interaction fixes after review; reconcile 3号 seconds-contract durations, payout/settlement copy, price-source and order-state contract. No business logic/API/SQL changed.
 
### 2号 trade interaction fixes integrated into 1号 — 2026-11-02

- Integrated 2号's reviewed `assets/js/views-trade.js` from `feature/ai2-interaction` blob `a73a0e577acd1fc837f1856e0e89542e11603e03` into 1号 branch commit `33185dce5a4513ee3bde2befa59d5c27afbf30f1`.
- Kept the existing visual workspace structure: pair list, chart summary, order book, order form, orders tabs and K-line drawer selectors all remain present.
- Integrated interaction safeguards include missing/invalid quote handling, market/limit price guards, percentage sizing guard, partially-filled orders remaining active/cancellable, cancellation result reconciliation, and safer history labels/values.
- Syntax compilation: PASS. Browser/runtime/build/automated tests NOT RUN.
- 2号: verify integrated source and run interaction regression when browser runtime is available. 3号: confirm API response/status/freshness and precision contract.
 
### Cross-route interaction risks identified for peer remediation — 2026-11-02

- Separate `VIEWS.orders.afterRender()` in `assets/js/views-trading.js` still filters Open Orders by `status==='open'` only; partial fills may be hidden. Its Cancel handler currently ignores the returned API result and displays success unconditionally. 2号 has been assigned to verify/fix; 3号 must confirm canonical status and unknown-outcome semantics.
- Seconds route `updPrice()` needs explicit missing-quote handling; countdown interval/settlement cleanup and unknown/error outcomes need 2号 review.
- These are source-inspection findings, not runtime reproductions. Do not mark as fixed until peer commit and regression evidence are recorded.
Please review the latest Assets, Markets, Deposit and Withdraw presentation changes on `feature/ai1-visual`. Prioritize event binding integrity, mobile behavior, keyboard/focus, modal and multi-step flow regression. Return evidence and a commit for any confirmed interaction defect. No browser QA has yet been claimed by 1号.
## 3号 Business Team — peer review checkpoint (2026-11-02)

- Branch: `feature/ai3-business`
- Review base SHA: `60cf6ac8cdc2d5c9af4f439024ad7c0dda77e2db`
- Reviewed target: `feature/ai1-visual` HEAD `947feeaf46a3d1120b7616dbf636231511bd7081`
- Scope: shared desktop/mobile K-line drawer; `assets/css/views-trade.css` and `assets/js/views-trade.js`.
- Result: SOURCE-OBSERVED review completed; no confirmed code defect or business-contract regression identified in the reviewed diff.
- Open item: `VIS-3TO1-KLINE-001` — browser QA evidence missing; status SUGGESTION / OPEN, not a confirmed bug.
- Report: `docs/REVIEW-3-TO-1-KLINE-DRAWER-2026-11-02.md`.
- Build/tests/browser: NOT RUN by 3号.
- Next: 1号 supplies browser evidence; 3号 independently rechecks the resulting commit.


## 3号 Business Team — API environment and financial safety audit (2026-11-02)

- Branch: `feature/ai3-business`
- Source baseline: `ce91ab8e8aadd47e0981358857dd1b2a0f02e92e`
- Added report: `docs/REVIEW-3-BUSINESS-API-ENV-2026-11-02.md`.
- Logged: `BUS-ENV-001` P0 — runtime financial flags treat unset as enabled while deployment preflight treats unset as disabled; requires owner confirmation of all environments and explicit fail-closed settings before staging approval.
- Logged: `BUS-ENV-002` P1 — frontend API_BASE is hard-coded to canonical backend; Preview API/CSP isolation is unresolved. No Preview write request was attempted.
- Existing baseline docs already identified both risks; this batch converts them into tracked actionable issues, not duplicate discoveries.
- Application/API/DB/Auth/financial/deployment source changed: NO.
- Build/tests/preflight/PostgreSQL/browser: NOT RUN.
- Next: owner confirms flag configuration and Preview API environment policy; only then prepare an approved, non-mutating validation plan.


## 3号 Business Team — matching API / PostgreSQL contract review (2026-11-02)

- Branch: `feature/ai3-business`
- Reviewed source blobs:
  - `api/core.js`: `d69cb9f65412f6ff5a949d03b21e7d0d3bc71ba0`
  - `supabase/sql/financial_matching_engine_v1.sql`: `600db3c518bc89e8b1878b3bcb4639a44a492cfe`
  - `assets/js/app-core.js`: `325aa5334d8863c90edf23a0e0506d682d396994`
- Added report: `docs/REVIEW-3-MATCHING-API-SQL-2026-11-02.md`.
- Source-observed controls: limit-only API, client idempotency key, server-side matching RPC, per-market transaction advisory lock, reservation-before-match, self-trade exclusion, maker-price fills and transactional buyer/seller ledger rows.
- Logged BUS-MATCH-003 P1: migration leaves all markets disabled by default and contains no per-pair seed/upsert; operator-approved market rules are required before staging acceptance.
- Logged BUS-MATCH-004 P0: maker/taker fee rates are constrained to zero and fill RPC has no fee ledger legs; fee-bearing funded trading is not ready.
- No application/API/SQL/DB/Auth/financial source changed.
- PostgreSQL migration/RPC tests, build/tests, browser QA: NOT RUN.
- Current financial gate remains BLOCKED; no production enablement.
- Next: owner approves per-pair rules and fee policy; run the full matching matrix only in isolated PostgreSQL staging after environment gates are resolved.


## 3号 Business Team — decimal precision follow-up (2026-11-02)

- New issue: BUS-MATCH-005 P1 — `POST /api/order` converts submitted price/quantity through JavaScript `Number` before stringifying for PostgreSQL, while SQL matching columns support `numeric(38,18)`; this can round high-precision decimal input before tick/step validation.
- Evidence: `api/core.js` order handler and `supabase/sql/financial_matching_engine_v1.sql` market/order numeric columns.
- Status: OPEN. No code change made.
- Next: preserve decimal strings at the API boundary and define decimal-safe validation; implement after authorization and add isolated PostgreSQL regression tests.

## 3号 Business Team — account read-path consistency

- [ ] BUS-LEDGER-006 (P1): add normalized deposit-history read path; reconcile pending/confirmed/rejected states against `deposit_records` and the ledger.
- [ ] BUS-LEDGER-007 (P1): preserve exact decimal balance strings through PostgreSQL JSON/API serialization; separate approximate valuation from exact balances.
- Evidence report: `docs/REVIEW-3-BUSINESS-ACCOUNT-READ-PATHS-2026-11-02.md`.
- Guardrail: source review only; no financial source changes or database operations until explicitly authorized and isolated staging is available.

## 3号 peer review — 2号 withdrawal outcome handling

- BUS-WD-008 (P1) reported to 2号: withdrawal UI treats all `!ok` responses as definite failure and claims balance unchanged, but backend 503 explicitly means outcome unconfirmed; a new submit generates a new idempotency key.
- Requested owner action: add UNKNOWN / CHECK HISTORY state, retain original request ID, and reconcile before permitting a new withdrawal.
- Report: `docs/REVIEW-3-TO-2-WITHDRAWAL-UNKNOWN-STATE-2026-11-02.md`.
- Target branch/source untouched by 3号. Source-only review; no runtime/API/database test performed.

## 3号 Business Team — withdrawal lifecycle readiness

- [ ] BUS-WD-009 (P1 blocker): define durable approved-pending-broadcast/outbox lifecycle; keep funds reserved until broadcast is durably recorded; include all nonterminal states in admin queue and reconcile txid/confirmations.
- Report: `docs/REVIEW-3-WITHDRAWAL-LIFECYCLE-GAPS-2026-11-02.md`.
- External broadcaster/worker infrastructure was not exhaustively searched; confirm whether it exists before implementation. No SQL or financial source changes authorized.


## 3号 peer review — KYC and order runtime-state contracts

- [ ] INT-KYC-001 (P1, 3->2): account API returns KYC object + pending level 1, while 2号 mapper treats the object as status and views treat level>=1 as Approved/Verified. Agree on status/level contract; verify all KYC states and permissions.
- [ ] INT-ORDER-001 (P1, 3->2): cancel interaction ignores API result, always displays success, and re-renders stale local orders. Check canonical response and reconcile order/balance state.
- Report: `docs/REVIEW-3-TO-2-STATUS-AND-RUNTIME-2026-11-02.md`.
- Source-only findings; no target code changed. Runtime, build, tests and browser QA NOT RUN.


- [ ] INT-ORDER-002 (P1, 3->2): matching SQL treats `partially_filled` as active/cancellable, but trade UI puts every non-`open` status in history and only shows Cancel for `open`. Include partial fills in active orders and allow cancellation of remaining quantity.


- [ ] BUS-MKT-010 (P2): market REST polling every 3s has no in-flight/request sequence or timestamp guard; out-of-order older response can overwrite newer quote. Add freshness gate and delayed-response regression test. Current reviewed path uses REST polling; WebSocket absence is not certified repo-wide.


## 3号 follow-up — My Account UI business truth review — 2026-11-02

- New item: `BUS-ACC-001` in `docs/AI-ISSUE-LOG.md`.
- Review the integrated 1号 UI source `feature/ai1-visual` commit `36e8e4b8e7b229b0897e9b41bd4ff25c32681a71` and latest presentation copy follow-up `97148288daad493d4bc1fc642283fce16e6ebcd4`.
- Confirm the canonical KYC state vocabulary and whether `kyc_level` is a true tier or a status-derived number; verify `unsubmitted/pending/approved/rejected/locked` handling and the actual permission rules. Do not infer advanced verification from approved=2.
- Confirm Fiat/Payment and Rewards/Referrals are truly preview-only and that transfer/records remain unavailable through current contracts.
- Return source evidence and a state/capability matrix. No financial or API behavior change is authorized by this UI task. Runtime QA remains NOT RUN.


## 3号 follow-up — Support availability truth — 2026-11-02

- New item `BUS-SUPPORT-001` in `docs/AI-ISSUE-LOG.md`.
- Confirm service hours, timezone, weekends/holidays and whether live-agent status is exposed by a real authoritative API/config.
- 1号 has removed the unsupported static Online badge and weekday schedule from the Support Center pending this confirmation. Do not ask for a status badge or hours to be reintroduced without evidence.
- No message-send/API behavior changed. Runtime checks NOT RUN.


### 3号 follow-up — Settings state truth — 2026-11-02

- Review Settings UI commits `55bb3870619bb214175a5f1a828d652c7ac37cba`, `7e9a46ded56fb16e9cfe4c554d97115013368a14`, `5cf155f556ed5686ee3ca77d5e0fa84e26ea9ee5` on `feature/ai1-visual`.
- Confirm `state.settings.twofa` and `fundPwdSet` are authoritative and refreshed after changes; confirm the UI's enabled/configured copy does not imply unsupported protections. Also check whether the displayed language is a fixed supported locale or merely current static copy.
- Do not change API/auth/security behavior as part of this presentation task. Return source evidence; runtime QA NOT RUN.


### UI consistency review — 2026-11-02

Review the newest presentation work on `feature/ai1-visual` for Assets, Markets, Deposit and Withdraw. Check that every label and displayed state is supported by existing source contracts; report mismatches with file/line evidence. No business behavior changes are part of this review.


---

## BTCBOX 长期三方协作指令（用户已批准，2026-11-02）

本指令适用于 BTCBOX 全站升级后续所有阶段，不限于当前页面批次。用户已明确批准 1号、2号、3号持续协作；不得把常规审查、修复、交接反复升级为用户确认事项。

### 共同执行规则
1. 主动推进：收到任务后先检查目标分支最新状态和相关源码，直接开展职责范围内的审查与修复；只有涉及业务规则不明确、资金风险、破坏性操作或需要用户作产品决策时才暂停并明确列出阻塞点。
2. 以源码和证据为准：每个问题提供文件路径、函数/选择器/字段、相关代码位置或提交 SHA、复现条件及影响。区分已证实问题、风险推测和待业务确认事项。
3. 先审查再修改：避免重复造轮子、无证据重写、只改截图不检查交互。修改前拉取最新分支并获取最新文件 SHA；不覆盖其他团队的新提交。
4. 小步、可追踪：按职责在各自分支提交，提交信息清楚；同步更新 issue log、task board 和 handoff。跨团队改动先提出证据与建议，由对应负责人整合。
5. 验证诚实：明确区分源码检查、语法编译、单元/集成测试、构建、浏览器测试和真实设备测试。未执行不得标记通过；记录环境限制和未覆盖范围。
6. 不回归：保留现有路由、DOM ID、事件绑定、API 参数/响应约定、认证、资金账本、撮合结算及其他既有业务行为；未经明确授权不改后端、SQL、资金规则或安全策略。
7. 持续交接：每次阶段结束或可能中断时，更新检查点：已完成、未完成、当前分支与 SHA、具体文件、验证结果、已知风险、下一步从哪里继续。不得只写“继续优化”。
8. 统一产品目标：BTCBOX 独立品牌；深色专业交易所界面，荧光绿克制使用；遵守已冻结字体规范；桌面端与移动浏览器分别优化；自定义居中弹窗/提示，不使用浏览器原生 alert/confirm/prompt。所有页面包括二级、三级页面都需纳入质量检查。

### 当前优先批次
配合 1号推进交易终端、秒合约和订单页面。重点核对桌面左右分栏、移动端下单优先、K线底部抽屉、订单状态/部分成交/撤单结果、资金与数量显示真实性。不要为了视觉效果改变交易规则。

### 每次反馈的固定格式
- 状态：完成 / 进行中 / 阻塞
- 审查范围：分支、提交 SHA、文件
- 已确认问题：严重级别、证据、影响
- 已实施修复：提交 SHA、修改边界
- 验证：逐项列出实际执行结果；未执行明确写 NOT RUN
- 交接：需要 1号或另一团队处理的事项、下一步和继续位置

用户批准的是三方在既定职责内主动协作，不代表批准合并 main、生产部署、资金/数据库操作或未经确认的业务规则变更。未经用户单独批准，不得合并 main 或部署生产。


### 2号职责补充 — 交互审查与修复
- 对 1号每批页面主动做独立交互审查：按钮/链接、表单校验、提交与错误恢复、加载/禁用态、弹窗关闭与焦点管理、键盘可达性、ARIA、滚动、事件冒泡、移动端触控和安全提示。
- 优先验证真实事件绑定与状态流，不以“元素存在”代替交互验证。重点检查重复提交、异步竞态、旧状态覆盖、撤单/部分成交、未知结果状态和重复请求。
- 仅在证据确认后修复交互层缺陷；先判断是否涉及业务合同。若涉及 API 语义、订单状态、资金影响或权限，先把证据交给 3号核实，不自行猜测。
- 不擅自改动 1号负责的整体视觉方向；如交互缺陷需要结构调整，先与 1号同步，并在自己的分支提交可审查修复。
- 对当前交易终端、秒合约、订单页以及后续每批页面持续复审，不因完成一次检查而关闭长期协作。



### 1号复审请求 — 交易终端、秒合约、订单页面（2026-11-02）

请在 1号分支 `feature/ai1-visual` 检查以下提交：
- `assets/js/views-trading.js`: `56ec4501df0447f39dd6df55cfa2359eb5d69e2d`
- `assets/css/views-trade.css`: `3a369a6e27b2153697037048835ceb8b7c1ab1c3`

审查范围：
1. 秒合约币种/期限/金额选择、UP/DOWN 点击、重复提交保护、倒计时、结算后列表刷新、路由切换清理与焦点/键盘操作。
2. 订单页 Open/History/Trades tab 切换、行详情抽屉、撤单确认、事件冒泡、横向滚动和键盘可达性。
3. 交易终端：K线抽屉开关、时间周期、盘口点击填价、买卖切换、Market/Limit、百分比快捷量、下单状态、订单列表与部分成交。
4. 特别复核当前 1号 trade view 与 2号此前修复是否一致：部分成交是否仍在 Open Orders；撤单是否只有在权威状态确认后才报成功；无效/过期报价是否会误显示为实时值。

只修复证据明确的交互缺陷；涉及接口状态/金额/规则先交给3号核实。返回文件位置、复现路径、提交 SHA、实际验证结果。未跑浏览器测试请明确 NOT RUN。


 
### 2号 trade interaction remediation integrated into 1号 — 2026-11-02

- 1号 integrated the current 2号 `assets/js/views-trade.js` blob `a73a0e577acd1fc837f1856e0e89542e11603e03` into `feature/ai1-visual` commit `33185dce5a4513ee3bde2befa59d5c27afbf30f1`.
- The trade layout structure was checked and retained. Integrated safeguards: unavailable quote display, market/limit price validation, percentage sizing guard, partial-fill active-order handling, and cancel outcome reconciliation.
- Please independently verify the integrated branch and keep remaining runtime/browser QA open; do not mark the task fully tested from syntax compilation alone.

### Additional interaction findings from 1号 source inspection — 2026-11-02

Please include the standalone `VIEWS.orders` route and Seconds route lifecycle in your review of 1号 `feature/ai1-visual`:
- `assets/js/views-trading.js`, `VIEWS.orders.afterRender()`: current standalone Orders route filters Open Orders with `status==='open'` only, so `partially_filled` may be omitted; Cancel handler awaits `apiAdapter.cancelOrder(id)` but ignores the response and unconditionally toasts “Order canceled.” then re-renders local state. Verify against the already-fixed trade-page pattern and API contract; fix on interaction branch if confirmed.
- `VIEWS.seconds.afterRender()`: verify missing market quote handling in `updPrice()`; verify `state._secCd` cleanup on route unmount and settlement unknown/error outcomes; ensure busy state cannot be stranded or cleared too early.
- Existing visual selectors and route contracts must remain intact. Coordinate with 3号 for canonical order/settlement status and unknown-outcome semantics before assuming success.
## Operating model update — 2026-11-02 (user-directed)

- 1号 Visual Team is the primary project execution lead for the current front-end improvement cycle: owns the overall visual direction, page-by-page sequence, integration cadence and coordination of cross-team deliverables.
- 2号 Interaction Team is the independent review and repair partner: proactively reviews 1号 deliverables and end-to-end user flows; fixes issues within 2号-owned interaction scope; for 1号/3号-owned files, records reproducible evidence and coordinates the owner before any edit.
- 3号 Business Team continues to own real API/data/business implementation and must align delivery with 1号's sequence; 1号 cannot override business semantics or protected financial/security boundaries.
- Coordinator (ChatGPT) maintains the overall picture: cross-team dependencies, priorities, risk register, branch/CI/test evidence, milestone gates and final acceptance. Coordinator does not replace specialist implementation or sign off untested work.
- This is an execution leadership arrangement, not permission to change API contracts, financial rules, database/auth/security, production settings, or locked trade-page layout.
- 1号 lead does not mean 1号 may unilaterally change business behavior; user-approved hard constraints and security/data truth remain highest priority.
- Working method: 1号 proposes the next integrated batch; 2号 independently reviews and repairs own-scope findings; 3号 implements business/data dependencies; coordinator reconciles blockers and verifies evidence. No agent waits for unnecessary per-step approval.
- Branch snapshots at adoption: 1号 `c38cc27e77d49d427fd76bdca9bdec4164bd9e7e`; 2号 `b7a11124f4055dda7abda8f3c7f4be2cbd49cc8e`; 3号 `bc77ad3604c95ed91c24a11688d0ef4b5efee44a`. These are recorded snapshots; each team must re-read latest HEAD before editing.


## Coordinator checkpoint — 2026-11-02

- 1号 branch advanced to d72a99232390dca0905f7f4da831d425a48e22f5 and delivered the grouped My Account visual hierarchy with responsive .va-hub-* styles.
- 2号 independently reviewed 1号's My Account source and committed interaction/data-truth corrections on feature/ai2-interaction at 8c4a052a48bbf27d81b3425d4af0f1cc7b16c7da.
- Review repair removes the non-refreshing numeric asset snapshot from My Account, links to the Assets workspace, normalizes KYC status and distinguishes Pending from explicit Approved. See INT-2-005.
- Integration dependency: 1号's visual CSS is on feature/ai1-visual; 2号's corrected markup is on feature/ai2-interaction. Integrate these deliberately; do not copy the old 1号 JS view over the 2号 correction.
- 3号 branch snapshot remains bc77ad3604c95ed91c24a11688d0ef4b5efee44a; business/market data blockers remain open.
- All branch Vercel statuses still show failure: build-rate-limit; no branch currently has verified build evidence from this status check.
- Browser/mobile/keyboard tests remain NOT RUN. No merge to main or deployment.


### Account hub integration update — 2026-11-02

- 1号 has now integrated the 2号 corrections into feature/ai1-visual; latest HEAD 36e8e4b8e7b229b0897e9b41bd4ff25c32681a71.
- Verified source: account page no longer renders numeric balance snapshots; it links to Assets. KYC status object is normalized and Pending is distinguished from explicit Approved. Profile action remains a native button with keyboard activation.
- 1号's matching .va-hub-* CSS remains present. JS source PARSE OK (compile only; not executed); targeted source assertions passed.
- INT-2-005 status: integrated at source level; browser/account-state/mobile verification remains NOT RUN.
1. 1号 must confirm whether there is a genuine 首页 view/route or whether an existing route is intended as the home destination. Do not assume `#/markets` is 首页.
2. 3号 must inspect current shared modal/toast APIs and shell navigation before changing them. Keep component signatures backward-compatible.
3. 2号 must map every existing `apiAdapter` call and state field used by assigned views; do not change those contracts.
4. 2号 must not turn placeholder features (fiat/cards/payment/transfer/invite) into fake or executable flows.
5. All agents must notify others before changing a shared selector, route, load order, CSS token or shared component API.


## Binding acceptance and peer review addendum

- Mobile browser is the primary implementation/acceptance target; desktop is separately composed and independently accepted. See `MOBILE-DESKTOP-SEPARATE-STANDARDS.md`.
- Every route must have independent mobile/desktop/tablet status; never infer one from another.
- Cross-agent findings must use `AI-REVIEW-AND-REMEDIATION.md`, cite an explicit standard and evidence, name the repair owner, and require independent retest.
- No personal-taste-only rejection. P0/P1 block acceptance; P2 fix or documented deferral; P3 backlog.


## Verified source correction — Home and trade-hub are already present

The earlier open item saying 1号 must confirm a Home route is superseded by source evidence at `feature/uiux-upgrade` SHA `f1d7b86437872a586e90973826b3086d4b5fa298`: `assets/js/views-home.js` defines `VIEWS.home` and `VIEWS.tradehub`; `index.html` contains `#/home`, `#/markets`, `#/trade-hub`, `#/assets`, `#/me`. 1号 owns Home/trade-hub view logic. 3号 owns shell nav and Home/trade-hub CSS in `assets/css/views.css`. Required action: verify current implementation and improve it in place; do not recreate routes or duplicate nav. 1号 must send styling changes to 3号.
### 3号职责补充 — 业务、数据与接口合同审查
- 对 1号每批页面主动核对真实数据来源、字段含义、精度、单位、币种、时间戳、状态枚举、权限条件、接口失败/超时/未知结果语义，以及前端展示是否准确。
- 对交易终端、秒合约和订单页重点检查：报价有效性与新鲜度、交易对映射、数量/价格精度、订单生命周期、部分成交、撤单剩余量、手续费/冻结/可用余额、结算和历史记录。只报告源码能够证明的事实；未验证的能力不得写成已支持。
- 对存款/提现/资产页持续核对金额精度、网络/币种约束、费用、确认状态、幂等键、未知结果与账本一致性。资金安全问题优先标记严重级别并给出证据。
- 不因用户批准 UI 三方协作而自行执行 SQL、迁移、真实资金操作、生产 API 写请求或修改金融规则。需要代码修复时，先区分纯展示问题与业务层问题，给出风险、测试矩阵和所需授权，再与 1号/2号协作。
- 对每批 UI 变更持续给出业务真实性审查结论，更新 issue log 和 handoff；不得只审查首页或一级页面。



### 1号业务核验请求 — 交易终端、秒合约、订单页面（2026-11-02）

请检查 1号分支 `feature/ai1-visual`：
- `assets/js/views-trading.js`: `56ec4501df0447f39dd6df55cfa2359eb5d69e2d`
- `assets/css/views-trade.css`: `3a369a6e27b2153697037048835ceb8b7c1ab1c3`

重点核对真实业务合同，不改动资金/API/SQL：
1. 秒合约当前可选期限为 30s、60s、5m、15m；早期产品记录曾出现 30s、60s、120s、300s。请核实批准的期限、API允许值和服务端校验，不要自行替换。
2. 页面文案声称正确方向 payout=amount×85%、错误方向全额损失、平局退本金、同一账户只能有一个未结算仓位。逐条追溯服务端结算/配置/账户并发限制，区分已证实、未证实和错误陈述。
3. 参考价来源 Coinbase/Bybit、币种白名单 BTC/ETH/SOL/BNB、价格时间戳/有效期/缺价行为。
4. 秒合约提交/结算响应状态、未知结果、幂等性、余额冻结/扣款/返还和历史记录一致性。
5. Orders 页 open/partially_filled/cancelled 等状态与 API/SQL 状态枚举；撤单后剩余量、冻结余额释放和历史归档。
6. Trade 价格/数量精度与金额展示。不要把 Number/parseFloat 的精度损失、缺失报价或近似估值当作准确金额。

请给出字段/函数/SQL 证据、状态矩阵和风险级别；任何业务文案未经证据不要确认。未经单独授权不得执行数据库、资金或生产写操作。

## 1号 auth reliability follow-up — 2026-11-03

- [x] INT-AUTH-001 source mitigation: login/register, 2FA, forgot-password and password-update controls now recover through finally blocks after rejected async calls; registration copy matches local no-email-verification behavior.
- Commits: `2b394672c9494188b84b7c9599a2cf29427f4bce`, `0f5ee3383e9fd375c13f58a0115bb57b1006a534`.
- [ ] Independent interaction retest and browser/network failure injection remain outstanding. Real recovery mail delivery and expired recovery-session behavior NOT RUN.

## Orders route follow-up — 2026-11-03

- [x] INT-ORDER-002 1号 source mitigation: standalone Orders now classifies `open` and `partially_filled` as active, and exposes Cancel for both; matching API/SQL untouched.
- Commit: `bfab7707bd802428a394e21c167fc2ea49232efb`.
- [ ] 2号 independent interaction retest; 3号 verify matching status/cancel contract and ledger release; browser/database tests NOT RUN.

## Seconds settlement lifecycle follow-up — 2026-11-03

- [x] INT-SECONDS-001 1号 source mitigation: adapter no longer moves a position into history for an explicit `ok:true, settled:false` API result.
- Commit: `e2ec958a1b65e44dac4e8eef07822f904aeaafe9`.
- [ ] 3号 verify RPC result semantics and ledger lifecycle; 2号 retest pending/settling UI and retry paths. PostgreSQL, financial and browser tests NOT RUN.


## Earn catalogue safety follow-up — 2026-11-03

- [x] INT-EARN-001 source mitigation: removed unverified hardcoded APYs/product offers and disabled Earn subscriptions in the UI until an authoritative product catalogue and rates are approved.
- Commit: `c1cc2e67b6b5cb947f47c793cafe0634addb0ef2`.
- [ ] 3号 confirm canonical Earn product IDs, APY source, minimums, terms, redemption rules and financial enablement gate.
- [ ] 2号 independently retest Earn unavailable state and verify no subscription action is exposed.
- No API/SQL/financial code changed; no financial operation or database test performed.

 
## 2号 — Seconds order reload-persistent UNKNOWN guard — 2026-11-03

- Status: SOURCE + REGRESSION TEST COMMITTED / CI PENDING.
- Working branch: `fix/ai2-seconds-persistent-guard-20261103`, created directly from 1号's current `feature/ai1-sitewide-refinement-20261103` HEAD `48f255901ac1c3f88b5d2c60138b75a99211056a` to avoid bringing unrelated branch history into integration.
- Source commit: `1249f26b5dcc8514b6111dc74e33a21654b6a28d` (`assets/js/views-trading.js`).
- Test commit: `43fc4c0b13b1208ac158ce5533f542316479a8ac` (`tests/seconds-persistent-order-guard.test.js`).
- CI branch filter commit: `8cbd3ff52cc461b94621a8c0155789c1afbfa3ae` (`.github/workflows/baseline.yml`).
- Scope: interaction lifecycle only; visual view markup and API/backend/SQL/financial contracts are unchanged. The current 1号 guest-login button/return handler was preserved.
- Completed: account-scoped local pending intent is written before POST; the exact request_id is sent; malformed stored records fail closed; reload restores the unresolved lock; UNKNOWN transport/RPC outcomes retain the record; only a definitive rejection or a canonical server position match can clear it. Storage write failure prevents the POST. Storage cleanup failure retains the lock.
- Limit: the current account positions API does not expose an authenticated lookup by request_id. This mitigation deliberately does not auto-unlock after reload; cross-device/server reconciliation still needs 3号's contract.
- Regression tests cover persist-before-network ordering, schema validation, corrupt/storage-failure fail-closed behavior, cleanup semantics and reconciliation conditions.
- Validation: GitHub Actions not yet observed. Local shell unavailable in this environment (public GitHub clone DNS resolution failed); do not report tests/build as passed until CI evidence appears.
- No real seconds order, settlement, SQL, production write, merge or deployment performed.
- Next: wait for branch baseline CI result; fix any failures; request 1号 source review and 3号 authenticated request status contract; then rebase/port only this narrow interaction block if 1号's branch advances.

 
### 2号 follow-up — Seconds unavailable-state control gating — 2026-11-03

- Updated `assets/js/views-trading.js` in commit `daf0d49a1d821dc144db053cfdce193671df5312` and `11dfc91c95ff0f603e57455664f02ae851e0c882`.
- UP/DOWN order buttons are now disabled while the initial positions snapshot is loading, when the positions endpoint fails or reports `cutover_incomplete:true`, while an open position is active, during submission, and after UNKNOWN outcomes.
- Guest login affordance remains enabled and uses 1号's existing `BTCBoxRequireLogin` return-routing handler.
- Regression test extended in `fa1141a31c6cdd4c2e088a67b43a54e44cf542e5` to parse the full JS source and assert disabled unavailable-state controls.
- Exact latest source SHA: `ad57d46ac27a14fb0b6e42d7d00ab0529064ff44`; latest test file should be re-read from branch HEAD.
- CI/build/test/browser verification still pending; no pass claimed.

 
### 2号 follow-up — standalone Orders cancellation reconciliation — 2026-11-03

- Source commit: `79573bf87844de70695da79c4b4bda00b4a5e317`; cleanup commit: `ce6af97cc024fda767247ececbdcfd51a7a9f211`; regression test: `59339f14f5a348a63714e645185a03b111cd2383`.
- `VIEWS.orders.afterRender` no longer treats an `ok:true` cancel POST plus a successful GET as proof of cancellation. It now checks the exact order in the refreshed canonical `orders` response.
- Only `cancelled/canceled` reports success; `filled` reports the fill race; `open/partially_filled` remain active and are not reported canceled; missing/unknown status or failed read is explicitly UNKNOWN.
- Existing `isActiveOrderStatus` continues to classify `open` and `partially_filled` as active. API adapter, backend, SQL and ledger behavior unchanged.
- Focused test now asserts the canonical status branches. Test/build/browser verification NOT RUN; latest GitHub status only shows Vercel `build-rate-limit` failure and no retrievable Actions run evidence.
- No order cancellation was executed; no merge or deployment.

 
### AI 3 CI review — PR #28 baseline run #41614204254

- Exact tested commit: `fa1141a31c6cdd4c2e088a67b43a54e44cf542e5`.
- Build public site: PASS.
- Smoke tests: 20/21 PASS. The four Seconds persistent-guard tests present at that SHA passed; the single failure was the existing Earn product catalogue assertion at `tests/smoke.test.js:100` (`frontend product flex_USDT missing`, with five other legacy IDs in the same required list).
- Root context: PR base `feature/ai1-sitewide-refinement-20261103` intentionally removed hardcoded/unverified Earn products and disabled Earn subscriptions pending authoritative catalogue (1号 task-board entry: commit `c1cc2e67b6b5cb947f47c793cafe0634addb0ef2`). This is a product-contract/test mismatch requiring 1号 owner confirmation; do not weaken assertions or reintroduce fake products just to obtain green CI.
- AI 3 requested 1号 confirmation and 2号 to keep the Seconds fix separate, rerun against a corrected exact SHA, and acknowledge the shared coordination record. 2号 reviewed the current shared coordination guidance on `chore/shared-ai-coordination` and the AI 3 PR notice; acknowledged in PR #28.
- Changes after tested commit `fa1141a` include standalone Orders canonical cancellation reconciliation and its fifth focused test. Those latest changes have NOT been run by CI yet.
- Latest source at current checkpoint: `6c330be0fb9c5f16a0bc55d3256c4f2169e890a4`; latest focused test: `d60ff24985c12ecb17e95110ae9f4322cecad712`. No latest-HEAD pass claim.
- Vercel status on branch continues to fail with `api-deployments-free-per-day` / build-rate-limit. This is deployment quota failure, not a source build result. No Production deployment.

 
### 2号 follow-up — non-JSON platform response remains UNKNOWN — 2026-11-03

- Source commit: `aa3f8c51a7ab835091c9fd866759427d9f335443`.
- Regression test commit: `6fc5c0b0e1d73542363f582e360821802bfa723d`.
- Finding: `apiFetch` represents a platform HTML 404 (for example, a missing Vercel nested route) as an invalid-JSON object with a `raw` response body and HTTP 404. The previous Seconds classifier treated any 4xx as definitive and could clear the saved request guard even though the response was not a structured business rejection.
- Fix: any non-JSON response carrying `raw` remains UNKNOWN; explicit structured pre-write rejections `FINANCIAL_CUTOVER_INCOMPLETE` and `REFERENCE_PRICE_UNAVAILABLE` remain definitive.
- Focused test now checks platform HTML 404, network failure, RPC 503, explicit pre-write 503 and structured 400 behavior.
- Latest source SHA: `5ae6188c8c7ed2665c48449351e61f19c43507ee`; latest focused test SHA: `a73a4fcf0a1801564574a3b3ff0fd89399c975e6`.
- No API routing/backend/SQL/financial changes. CI/build/browser test on this exact latest SHA NOT RUN.

 
### 2号 — Google-only authentication alignment — 2026-11-03

- User's binding product decision is Google OAuth only (shared coordination MSG-022). The AI1 base still exposed email/password login, email/password registration and forgot-password; 2号 ported only the targeted auth view/callback/session changes from its existing `fix/interaction-account-hydration-20261103` reference branch into this narrow PR branch.
- Commits: Google-only login/register view `a021ce68ec2d37591a752cd165c304cbc03d7b9e`; OAuth button callback + Terms consent `dd6db41d9e1a66b090cd57a15467ec3e41606f4f`; remove boot recovery mode `86e23bde78e74eab16231131597f66b83b31c40a`; replace Auth helper with Google session exchange + optional 2FA `012dc14a3e0890e16b7edb91e3fdcd421726ca29`; OAuth boot 2FA challenge + safe return `d736814f2d9d9954ac1baaa41ad94b5a70892453`; remove unused email auth adapters `cd30c7afa8a9e37f3050b0cfc51f54979e4f6011`; clear stale private account state `b03beb4fc43f07eddbe14e409a51fdd8e8644810`.
- New regression suite: `tests/google-only-auth.test.js`, latest commit `04405a3bcc535dee43e51bc7b5c722e8b1921d6a`, covering source syntax, Google-only login/register UI, Terms consent, same-origin OAuth callback/safe return target, optional server-side 2FA, and absence of email-only Auth/API adapter methods.
- Source-level review confirms login/register UI has no email/password fields, Terms consent remains on Google registration, email forgot/reset flow is no longer booted or exposed in Auth, Google session exchange retains the optional server-side 2FA challenge, and failed auth clears private account state.
- Backend/API/SQL/Supabase configuration unchanged. No auth credentials, production sessions or user records changed.
- Latest GitHub Actions run `41616369031` was queued against commit `9115577cc24c33598f81c9f8837e73c501ec2a3f`; it predates the last test correction commit and must be rerun/rechecked against latest HEAD. Current Vercel status is the existing free-plan build-rate-limit failure, not source CI.
- Browser Google OAuth, redirect, and 2FA live tests NOT RUN. Do not claim runtime acceptance.

 
### 2号 follow-up — Google-only auth CI feedback and corrections — 2026-11-03

- GitHub Actions run `41616484682` (run #81) tested branch HEAD `abffdd5631c18290ce22b1b0acfd62cb7aab41e9`: public build PASS; smoke suite FAILED with 4 assertions.
- Failure analysis from job log:
  1. `assets/js/boot.js` syntax error caused by a missing opening brace around the Google session exchange `if`; corrected in `de329ffb9588d5ff79e9d79e632adbfb76fedf7c`.
  2. Google auth test expected wrong adapter parameter name; corrected in `c8bdce2003bc34e3218f2401846a6df6c3020646`.
  3. Existing smoke test expected Terms validation inside email-registration view; updated in `dc8b25029d3aea13a3f85dbc0819a32b1444a9b6` to assert the new Google OAuth registration boundary blocks without consent.
  4. Earn catalogue smoke failure remains: legacy expected `flex_USDT` (and five other removed unverified IDs), requiring 1号's product-scope decision; no fake products restored and no assertion weakened.
- Latest source commit after these corrections: `c8bdce2003bc34e3218f2401846a6df6c3020646`. Latest test file blob: `a8e54d8adaa6efb293eb6e038bfa943fb02de067`.
- CI for latest corrected SHA has not yet been observed. The Vercel status remains a free-plan build-rate-limit failure, separate from GitHub Actions.
- No auth backend, API, SQL, Supabase config or production user/session data changed. Browser OAuth and live 2FA NOT RUN.


## AI 3 — Issue #2: simple manual deposit configuration and credit flow

- Status: COORDINATION CONTRACT RECORDED / IMPLEMENTATION NOT STARTED.
- User's approved workflow: configure address/network in admin; user transfers; staff verifies receipt manually; select user + asset row and enter actual received amount for audited atomic credit.
- Keep UID and coin auto-bound. Do not ask staff to re-enter either.
- Do not add pending deposit orders, automated chain verification, auto-credit, or extra approval stages.
- Source gaps confirmed: active Admin Console has no deposit-address configuration UI although GET/POST /admin/config exist; deposit UI supports 6 assets while admin credit UI/API and safeDepositAddresses cover only 4/6.
- Issue: https://github.com/avali9308-code/btcbox-v33/issues/2
- Required implementation: compact address-config tab using existing API; align supported asset set (USDT/BTC/ETH/SOL/BNB/USDC) across deposit addresses, admin account asset rows, and manual-credit API. Keep format validation, fail-closed missing addresses, atomic RPC/idempotency/audit, and financial cutover gate.
- Owner handoff: AI 1 implementation owner for active Admin Console view and API source changes; AI 2 independent QA on exact SHA; AI 3 maintains contract and integration gate.
- No code, SQL, database, environment, merge or deployment changes in this coordination batch. Tests/runtime/browser: NOT RUN.


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
