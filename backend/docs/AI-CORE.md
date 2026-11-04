# BTCBOX AI Core Rules — Protocol v2.0

Project: BTCBOX web exchange frontend modernization  
Repository: `avali9308-code/btcboxcdt`  
Coordination baseline: `f1d7b86437872a586e90973826b3086d4b5fa298` on `feature/uiux-upgrade`  
Status: execution contract; source implementation must follow these rules.

## 1. Priority order

1. Explicitly approved user requirements.
2. Preserve existing business behavior, routes, interfaces and real data.
3. Security and financial correctness.
4. Frozen BTCBOX design system.
5. Page-level UI/UX.
6. Implementation preferences.

If two rules conflict, stop only the conflicting change, record the exact conflict and ask the coordinator. Do not silently choose.

## 2. Scope boundary

This workstream is frontend presentation modernization: layout, visual hierarchy, spacing, responsive behavior, component presentation, accessibility, loading/empty/error/success/disabled states and user-facing copy where meaning is unchanged.

Without explicit owner approval, do NOT change:
- API paths, methods, request/response shapes, parameters or authentication headers.
- Supabase schema, migrations, RLS, policies, RPCs, triggers, functions or database records.
- Login/session/OAuth/authentication behavior.
- Financial calculations, balances, ledger entries, order placement/cancellation, matching, settlement, deposits, withdrawals, transfer execution, fees, limits or risk controls.
- Feature flags, environment variables, Vercel configuration, production settings or deployment targets.
- Existing routes, links, feature availability or user permissions.
- Real data sources or replace live data with fixtures/mock data.
- Delete existing content or features merely because they are inconvenient.

If a real API/backend capability is absent, preserve the current disabled/coming-soon state and improve its presentation only. Never imply that a non-existent operation works.

## 3. Brand and visual system

- BTCBOX is an independent brand.
- Dark charcoal/black foundation; restrained fluorescent-green brand/action accent.
- Green is for primary actions, selected states, key values and semantic success—not every border, icon or card.
- No large gold decorations, gold cards/borders, excessive neon, cheap glassmorphism or gratuitous gradients.
- Use the actual official BTCBOX logo assets already in the repository; do not substitute a generic logo.
- Follow the existing centralized token system. Do not create a second global palette or duplicate `:root` blocks.

### Frozen typography — do not change without owner approval

- Main UI: Inter; Chinese fallbacks: PingFang SC, Microsoft YaHei, Noto Sans SC, Hiragino Sans GB, sans-serif.
- Financial/numeric/code: JetBrains Mono; IBM Plex Mono fallback.
- Prices, amounts, volumes, percentages, timestamps and numeric inputs use the numeric stack and should align consistently.
- Do not introduce Arial, Helvetica or Times-family fonts.
- Preserve the existing approved weights and type scale. If a token is missing, propose a token addition rather than replacing the type system.

## 4. Layout and responsive rules

- Mobile browser is a first-class target; test 320, 360, 375, 390 and 430 CSS px where browser tooling is available, plus desktop.
- No page-level horizontal overflow, clipped controls, hidden critical content or bottom navigation covering content.
- Respect iOS safe-area insets.
- Touch targets should be at least 44×44 CSS px where practical.
- Mobile bottom navigation product requirement: exactly 首页 / 行情 / 交易 / 资产 / 我的. The current repository shell differs; do not invent a route. Coordinate the 首页 route/entry with the home/markets owner before changing its destination.
- Trade page desktop: professional horizontal workspace; mobile: compact order-entry/market-depth arrangement without forcing desktop columns or horizontal page scroll; chart is a collapsible bottom drawer, not a permanent main panel.
- Standard dialogs are centered horizontally and vertically. Do not turn every dialog into a bottom sheet.
- Account locked, funds frozen, security restriction and other important status dialogs must be centered, clearly explain only verified reasons and available next steps; never invent a reason.
- Use drawers for secondary selection/filter/chart interactions; use pages for complex workflows; use centered modals for confirmations and status.

## 5. Custom feedback only

- Use the project's custom modal/toast/notification components.
- Do not call native browser `alert()`, `confirm()`, `prompt()` or browser notification APIs.
- Preserve existing modal/toast APIs and call signatures unless all consumers are migrated in one coordinated, reviewed change.
- Provide clear loading, success, failure, empty, disabled and restricted states; do not show false success.

## 6. Source and CSS discipline

- The application is a hash-routed SPA with a small number of HTML shells and view modules; do not assume one HTML file per route.
- Inspect the actual source tree and existing documentation before changing code.
- Keep shared files under one named owner. Page owners must not edit shared files independently.
- Do not append endless CSS override patches. Edit the canonical rule in its owning stylesheet, remove obsolete conflicting declarations and preserve cascade/load order.
- Do not reformat or rewrite unrelated modules.
- Keep diffs focused and explain any file outside your assigned scope before touching it.

## 7. Required collaboration record

Every agent must update the shared Git records at meaningful milestones and before stopping:
- `docs/AI-TASK-BOARD.md`: status, owner, branch, baseline/current SHA, next action.
- `docs/AI-CHANGELOG.md`: what actually changed, files and implementation notes.
- `docs/AI-COMMUNICATION.md`: reminders, dependencies, affected agents and requested action.
- `docs/AI-HANDOFF.md`: exact interruption/resume point, uncommitted work, tests and next command/action.
- `docs/AI-INTERFACE-CONTRACT.md`: public selectors, routes, component APIs and cross-module dependencies.

A plan is not completed work. Never report a task DONE without actual code, test evidence and an updated record.

## 8. Interruption and recovery

Before any planned or unexpected stop, record:
- Agent number and task.
- Branch and exact latest commit SHA.
- Modified files and uncommitted changes.
- Completed and incomplete work.
- Tests/commands actually run and their results.
- Known failures and blockers.
- Which other agents are affected and what they must not overwrite.
- Exact file/section/next action to resume.
- Explicit prohibited changes.

On resume, read the latest task board, communication log, interface contract and handoff; verify Git state before editing.

## 9. Safety and release

- Work only on the assigned feature branch.
- Never force-push, reset another agent's branch, overwrite another agent's uncommitted work or merge into main.
- No production deployment, promotion or financial feature-flag change.
- Keep financial/backend release gates separate from frontend UI acceptance.
- Record evidence with commit SHA, exact command or manual steps, environment and result. Source inspection is not a test.


## 10. Separate mobile-browser and desktop product requirements — mandatory

- Mobile browser is the primary design, implementation and acceptance target. Build and validate the mobile composition first.
- Desktop is a separate, deliberately composed professional experience. Do not treat desktop as an enlarged mobile layout or mobile as a compressed desktop layout.
- Shared tokens, typography, data contracts and low-level components are allowed; page composition, navigation, hierarchy, density and interaction patterns must be intentionally specified and validated separately.
- Required mobile widths: 320/360/375/390/430 CSS px. Required desktop widths: 1024/1280/1440/1920 CSS px where tooling is available. Tablet is a separately recorded intermediate target.
- Mobile browser testing must include iOS Safari where available; Android browser coverage should be recorded when available. A source inspection or screenshot mock is not a browser test.
- Each route must have separate mobile, desktop and tablet status. A PASS on one target never substitutes for another.
- See `MOBILE-DESKTOP-SEPARATE-STANDARDS.md` for binding details and evidence requirements.

## 11. Evidence-based peer review and repair — mandatory

- Agents must review each other's deliverables against user-approved requirements, this core contract, the separate mobile/desktop standards, verified source behavior and objective test evidence—not personal taste.
- Every finding must identify the exact route, file/selector/function, violated standard, evidence, expected/actual result, user impact, severity, repair owner and retest requirement.
- The assigned file owner repairs; reviewers do not overwrite another owner's files. Shared UI findings go to 3号; assets/account to 2号; trading/home to 1号; core/API/backend findings are escalated and not self-modified.
- P0/P1 findings block acceptance. P2 findings require repair or documented deferral; P3 may be queued.
- A different agent or coordinator must independently retest fixes before marking VERIFIED.
- Disagreements must cite the same core standard and evidence. If the standard is silent, mark UNKNOWN and request a decision; no agent may invent a rule to win a disagreement.
- See `AI-REVIEW-AND-REMEDIATION.md` for the required review workflow and report template.


## 12. Coordinator obligations — binding on this assistant

- The coordinator is subject to the same evidence, scope, safety and handoff rules as every numbered agent; it has no exemption to guess, silently change requirements or report unverified work as complete.
- The coordinator must check the actual branch, latest SHA, file ownership and communication log before assigning, integrating or modifying project files.
- The coordinator must enforce mobile-browser-first implementation and separate desktop composition/acceptance. It must reject a single scaled layout when it violates the separate target standards.
- The coordinator must review peer findings against the documented authority order, not personal preference, and require an exact remediation owner and independent retest.
- The coordinator must not directly overwrite agent-owned source files. It may update coordination documents and must request owner changes for owned source files.
- The coordinator must distinguish VERIFIED, SOURCE-INSPECTED, NOT RUN and UNKNOWN. It must never describe source inspection as a browser test or claim a branch/file/test/deployment state without checking it.
- Before integration, the coordinator must compare branch diffs, detect conflicts and cross-module contract changes, confirm all P0/P1 findings are closed, and record unresolved P2/P3 items. No production/main merge or deployment without the user's explicit authorization.
- The coordinator must maintain the shared task board, communication log, changelog, interface contract and handoff records, including its own actions and any interruption recovery point.


## 13. Verified navigation correction — supersedes earlier route uncertainty

The latest inspected `feature/uiux-upgrade` source at `f1d7b86437872a586e90973826b3086d4b5fa298` contains `VIEWS.home` and `VIEWS.tradehub` in `assets/js/views-home.js`. `index.html` contains the five mobile destinations `#/home`, `#/markets`, `#/trade-hub`, `#/assets` and `#/me`; `app-core.js` maps active navigation states. Therefore the earlier statements that no Home route was confirmed are superseded. 1号 owns the Home and trade-hub view behavior in `views-home.js`; 3号 owns shell navigation and the existing Home/trade-hub presentation rules in `assets/css/views.css`. 3号 must verify and refine existing behavior rather than invent a new Home route. 1号 must not edit `views.css`; styling requests go to 3号 through the communication log.


## 14. User-directed open collaboration model — latest user instruction, 2026-11-02

This section supersedes any earlier wording that treated file ownership as an absolute edit prohibition or required an agent to wait for another agent before making safe progress.

### 14.1 Primary responsibility is not exclusive permission
- 1号, 2号 and 3号 retain primary responsibility areas so work stays organized and workload remains balanced.
- Primary responsibility identifies who normally drives, integrates and reports a workstream. It does NOT mean only that agent may inspect, review, improve or repair the files.
- Any project agent may modify any frontend source file when doing so is necessary to remove a verified defect, unblock progress, improve consistency or help another agent.
- User instructions always take precedence over this collaboration permission. No agent may use this clause to contradict an explicit user command.
- Existing scope protections remain: no API/backend/database/auth/financial/matching/settlement/security/deployment behavior changes unless the user explicitly authorizes them. Cross-file permission is not permission to change business behavior.

### 14.2 Safe cross-agent editing protocol
Before editing a file outside the agent's primary area:
1. Read the latest file and branch/commit state; never rely on an old copy.
2. Check the issue log, communication log and latest handoff for active work or conflicts.
3. Add a short ACTION_REQUIRED notice naming the file, exact defect, proposed minimal change, primary owner and affected consumers. If the fix is urgent and unambiguous, the agent may proceed in the same work session after recording the notice.
4. Make a narrow, reviewable diff. Do not replace an entire file to change a small section.
5. Commit on the agent's own working branch; never push into another agent's branch, force-push, reset or overwrite another agent's uncommitted work.
6. Notify the primary owner and request an independent review/retest. The primary owner should help, not defend ownership.
7. If simultaneous edits or a merge conflict are detected, stop only the conflicting hunk, compare both changes and reconcile; do not discard either agent's work.

### 14.3 Mutual supervision and assistance
- Every agent must review at least one relevant deliverable from another agent during each major implementation cycle, not only at final acceptance.
- Reviewers should proactively look for defects, missing states, route inconsistencies, accessibility issues, mobile/desktop composition problems, data-contract assumptions and visual inconsistencies.
- When a peer is blocked, another agent should help investigate, produce a minimal patch proposal or implement a safe fix if the owner is unavailable.
- The original owner remains responsible for confirming the intended behavior; a second agent independently retests the fix.
- Do not create review-only delays: safe independent tasks continue while a question is pending.

### 14.4 Concerns and uncertainty must be written down
- Any agent who is unsure whether a design, implementation, route, API field, component contract or product behavior is correct must record the concern in `docs/AI-ISSUE-LOG.md` or `docs/AI-COMMUNICATION.md`.
- Record what is known, what is unknown, evidence/source, possible impact, safe options, recommended next step, decision owner and whether work can continue.
- Mark assumptions as UNKNOWN / INFERENCE / SOURCE-OBSERVED / BROWSER-VERIFIED. Never present an inference as a fact.
- Do not silently guess, hide uncertainty, or stop the whole project for a non-blocking question.

### 14.5 Lightweight execution rhythm
- Work in small, coherent batches grouped by user-visible outcome, not one-file-at-a-time ceremonies.
- At each meaningful milestone, update the task board, changelog and issue log; update communication when another agent is affected; update handoff before stopping.
- Do not wait for user approval on routine visual decisions already covered by the approved design rules.
- Escalate only conflicts involving user requirements, financial/security behavior, unverified product semantics or irreversible/release actions.


## 15. User-directed three-team model — supersedes prior numbered-role assignments and open cross-edit permissions (2026-11-02)

The current team model is defined by `docs/TEAM-CHARTER.md` and the three task files. Any earlier role description that assigned 1号 to trading, 2号 to assets, or 3号 to shared UI is obsolete for new work.

- 1号 = Visual Team: appearance, design system, layout, theme, tokens, icons, responsive visual composition and component appearance.
- 2号 = Interaction Team: user flows, route transitions, form behavior, state machines, feedback timing, loading/error/success behavior, motion and interaction states.
- 3号 = Business Team: API integration, user/account data, wallet/assets, trading/market data, WebSocket, stores, types, permissions and real business states.
- Two common layers: `docs/` for shared rules and `src/` as the target shared technical foundation. The current application still runs from `assets/js/` and `assets/css/`; do not migrate it merely to match the target tree.
- Strict one-way peer supervision: 1号 reviews 2号; 2号 reviews 3号; 3号 reviews 1号. A reviewer may identify, evidence, cite standards and recommend only. The reviewer must not edit the target team's files/branch, implement the fix, take over the task or stop their own work. The target team independently evaluates, decides and executes.
- Each concrete file has one primary owner. No simultaneous edits to the same file. Cross-team concerns go to `AI-ISSUE-LOG.md` and `AI-COMMUNICATION.md`.
- This strict review-only boundary supersedes section 14.2/14.3 and all earlier permission allowing agents to edit another team's files. No cross-team implementation by reviewers.
- Shared standards are not privately editable by numbered agents. Proposed changes are suggestions to the coordinator/user; update only after an explicit decision.
- Acceptance is `ACCEPTANCE-SCORECARD-v1.0.md`: Business 50, Interaction 30, Visual 20; minimum 85 and zero veto items. No score can override a veto.
- The Business Team role does not by itself authorize changes to protected production financial, database, authentication-security, matching, settlement, secret or deployment behavior. Existing user-approval gates remain binding.
## Verified route correction

The earlier Home-route uncertainty is superseded. At source SHA f1d7b86437872a586e90973826b3086d4b5fa298, views-home.js defines VIEWS.home and VIEWS.tradehub; index.html has mobile links #/home, #/markets, #/trade-hub, #/assets and #/me. 1号 owns the view logic; 3号 owns shell nav and Home/trade-hub styles in views.css. Do not create duplicate routes.
