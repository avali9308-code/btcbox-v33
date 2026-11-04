# BTCBOX 单向监督与问题记录规则

## 1. 固定监督链

- 1号 Visual Team → 2号 Interaction Team。
- 2号 Interaction Team → 3号 Business Team。
- 3号 Business Team → 1号 Visual Team。

每组只承担自己被指定的监督对象，不额外扩大为全员互相审查，以免职责混乱。

## 2. 监督者权限

监督者只能：
- 指出问题和缺失项。
- 提供可复现步骤、截图、日志、源代码位置或测试结果。
- 引用用户要求、TEAM-CHARTER、AI-CORE 或接口契约。
- 说明实际影响和严重程度。
- 提出一个或多个可选建议。

监督者不能：
- 修改对方的文件、分支或提交。
- 替对方修复、重构、接管或分配任务。
- 要求对方停止自己的正常工作。
- 把个人偏好当作规范。
- 未经用户授权更改公共规范。

意见发出后，监督者继续自己的工作，不等待对方采纳或回复。

## 3. 被监督者责任

被监督团队自行：
- 判断意见是否成立。
- 标记 ACCEPTED / DISPUTED / NEEDS_CLARIFICATION / DEFERRED。
- 说明证据和理由。
- 自己制定修复计划并实施。
- 自己更新任务板、变更日志和交接。
- 在修复后请求独立复核。

监督者不负责修复后的实现，也不负责替对方更新代码。

## 4. 严重程度

- P0 Critical：资金/安全/隐私重大风险、真实数据错误、关键业务状态被伪造。立即通知协调者；相关发布禁止。
- P1 Major：关键路径不可用、关键流程阻塞、核心信息严重误导。必须在验收前修复。
- P2 Moderate：明确规范违反、支持 viewport 溢出、次要状态缺失、组件明显不一致。修复或记录获批延期。
- P3 Minor：不影响主要使用的轻微视觉/体验优化。进入待办，不阻塞无关工作。

## 5. Finding 模板

每条意见必须包括：
- Issue ID、日期、Reporter、监督方向。
- 被监督团队和负责人。
- 路由、目标端（Mobile/Desktop/Tablet/All）。
- 文件、selector、function 或组件。
- 违反的规范/契约条款。
- Evidence：复现步骤、截图、日志、commit SHA 或测试输出。
- Expected / Actual。
- 用户影响、Severity。
- 建议方案（非命令）。
- 被监督团队的处理状态和理由。
- Retest evidence（如已修复）。

没有证据的主观判断写为 SUGGESTION，不得标记为已确认缺陷。

## 6. 处理时限与并行

监督意见不构成工作阻塞。被监督者按风险和计划处理；P0/P1 需立即升级并阻止发布，其他问题不阻断监督者自己的任务。不得以等待对方回复为理由停止自己的工作。

## 7. 验证状态

- SOURCE-OBSERVED：只在代码中观察到。
- REPRODUCED：按步骤复现。
- BROWSER-VERIFIED：真实浏览器验证。
- TEST-PASSED：指定自动化测试通过。
- NOT RUN：未执行。
- UNKNOWN：证据不足。

不得将代码阅读写成浏览器测试。
# Cross-Agent Review and Remediation

## Authority

Review work against this order: (1) explicit user-approved requirements; (2) AI-CORE.md and MOBILE-DESKTOP-SEPARATE-STANDARDS.md; (3) verified source behavior, routes, API/data contracts and security constraints; (4) frozen design tokens; (5) objective usability/accessibility checks. Personal taste is not a valid reason to reject work. If the standard is silent, mark UNKNOWN rather than inventing a rule.

## Required review coverage

Review requirements, preserved features and data/API behavior, route correctness, mobile browser composition, separate desktop composition, tablet behavior, typography and financial number legibility, loading/empty/error/success/disabled/restricted states, custom centered dialogs, touch targets, keyboard access, safe areas, content offsets, console/network failures, CSS duplication/cascade conflicts and shared component compatibility.

## Severity

- P0 Critical: security/financial behavior changed, data exposure, false representation of fund action, auth/API contract broken or production risk. Stop the affected change and notify coordinator/owner. Do not merge.
- P1 Major: critical route/action unusable, primary mobile or desktop workflow broken, important data meaning obscured or existing feature removed. Must fix before acceptance.
- P2 Moderate: explicit layout/token/accessibility rule violated, supported viewport overflow/clipping, broken secondary state or measurable component inconsistency. Fix or document an approved deferral.
- P3 Minor: cosmetic polish with no material usability or requirement impact. Backlog; does not block unrelated work.

## Finding template

For every finding record: defect ID; reviewer; affected owner; route; exact file and selector/function/line; target MOBILE/DESKTOP/TABLET/ALL; violated standard; evidence (reproduction steps, screenshot, source reference, test output or SHA); expected result; actual result; user impact; severity; proposed remediation; remediation owner; dependencies/agents to notify; retest requirement; status OPEN/ACCEPTED/DISPUTED/FIXED/VERIFIED/DEFERRED.

Do not submit vague findings such as "not professional", "feels crowded", "spacing is wrong" or "make it like another exchange" without a specific violated rule and evidence.

## Repair workflow

1. Reviewer records a finding with evidence and standard reference.
2. File owner acknowledges as ACCEPTED, DISPUTED or NEEDS_CLARIFICATION.
3. If accepted, owner records the smallest safe fix, files, side effects and retest plan.
4. The owner fixes only files within their ownership. Shared-file changes go to the shared owner; never overwrite another agent's work.
5. Owner commits and updates task board, changelog, communication log and handoff with SHA.
6. A different agent or coordinator repeats the exact test and viewport.
7. Mark VERIFIED only after independent retest.

## Disputes

Both sides must cite the same core standard and evidence. Reviewer states observable failure and user impact; owner provides counter-evidence. Coordinator resolves by the authority order above, not preference. If no rule decides the matter, mark UNKNOWN and ask for the smallest required user decision. No agent may change the core standard or business behavior to justify a preferred design.

## Ownership

Reviewer identifies; file owner repairs. Shared UI defects go to 3号; assets/account defects to 2号; home/markets/trading/seconds defects to 1号. Core/router/API/backend issues are escalated and remain outside UI agents' edit authority. Cross-module effects must name affected agent and requested action in AI-COMMUNICATION.md.

A code change alone does not prove a fix. P0/P1 block acceptance. P2 must be fixed or explicitly deferred with reason and acceptance owner. P3 may be queued. Never mark browser checks PASS without actual browser evidence.
