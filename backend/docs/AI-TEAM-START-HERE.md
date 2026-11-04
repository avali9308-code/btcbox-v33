# BTCBOX 三团队协作入口

所有参与 BTCBOX 的 AI Agent 必须从本文件开始。当前采用三组并行工作模式：视觉、交互、功能。

## 当前仓库事实

- Repository: `avali9308-code/btcboxcdt`
- 当前协调分支：`coordination/ai-team-setup`
- 本次组织调整基于该分支当前提交；开始工作时必须重新读取最新 HEAD。
- 生产主分支 `main` 不得擅自修改。
- 当前真实应用仍为 hash-routed SPA，主要文件位于 `index.html`、`assets/js/`、`assets/css/`。
- 当前仓库尚无实际运行的 `src/` 模块；`src/` 是目标公共技术层，先记录契约，不得直接搬迁现有代码。
- 构建和测试脚本以当前 `package.json` 为准；源代码检查不等于浏览器验收。

## 必须先读的公共规范

1. `TEAM-CHARTER.md` — 三组边界、两公共层、监督方向。
2. `AI-CORE.md` — 项目硬性约束。
3. 本文件。
4. 自己的任务书：`AI-1-TASK.md`、`AI-2-TASK.md` 或 `AI-3-TASK.md`。
5. `AI-INTERFACE-CONTRACT.md`。
6. `AI-TASK-BOARD.md`、`AI-ISSUE-LOG.md`、`AI-COMMUNICATION.md`。
7. 最新 `AI-HANDOFF.md`。
8. `ACCEPTANCE-SCORECARD-v1.0.md` 和 `MOBILE-DESKTOP-SEPARATE-STANDARDS.md`。

## 三组定义

### 1号 — Visual Team（视觉组）
只负责长什么样：品牌、颜色、字体、图标、布局、Design System、主题、响应式、组件外观。任务书：`AI-1-TASK.md`。

### 2号 — Interaction Team（交互组）
只负责怎么操作：用户流程、路由跳转、表单交互、状态机、反馈时机、动效、Loading、Toast、Modal、Drawer、实时数据的用户体验。任务书：`AI-2-TASK.md`。

### 3号 — Business Team（功能组）
只负责能不能用：API、用户系统、钱包、资产、充值提现、行情、交易、订单、持仓、WebSocket、Store、权限和真实数据。任务书：`AI-3-TASK.md`。

## 单向监督（严格执行）

- 1号只审查2号，并向2号提出问题和建议。
- 2号只审查3号，并向3号提出问题和建议。
- 3号只审查1号，并向1号提出问题和建议。

监督者只能提交证据、复现步骤、违反的规范、影响和建议。监督者不能修改被监督者的文件/分支、不能代替修复、不能接管任务、不能命令对方改变优先级。提出意见后继续自己的工作。

被监督团队自行评估、修复或说明不采纳理由，并更新自己的记录。对已批准的硬性要求、P0/P1 或一票否决问题不得随意忽略。

## 两个公共层

- 统一规范层：`docs/`。所有团队共同读取；团队不能私自改变共同规则。
- 共享技术基础层：`src/`。按 `AI-INTERFACE-CONTRACT.md` 中的目录责任共同维护。当前只是目标结构，未经迁移批准不得把现有 `assets/` 代码移动进去。

## 分支与并行规则

- 1号视觉组：`feature/ai1-visual`
- 2号交互组：`feature/ai2-interaction`
- 3号功能组：`feature/ai3-business`
- 当前历史分支 `feature/ai1-trading`、`feature/ai2-assets-account`、`feature/ai3-shared-ui` 是旧职责命名；不得继续按旧分工理解或重置它们。迁移到新分支前先核对各自已有提交，保留有效工作。
- 每个团队只在自己的分支提交。不得推送到其他团队分支，不得 force-push/reset 覆盖工作，不得直接合并 main。
- 同一文件必须在任务板指定唯一主责；跨组意见只能通过问题记录和沟通记录提出。
- 三组可同时推进互不冲突的工作，不需要互相等待。

## 每次开始工作的强制步骤

1. 读取当前协调分支最新 HEAD 和自己的分支最新 HEAD。
2. 阅读上述公共规范和自己的任务书。
3. 检查自己的任务板记录、最近一次交接和 Issue。
4. 扫描实际源文件、消费者、接口和构建加载顺序。
5. 写入 source-scan 记录，说明事实、未知、边界。
6. 只做自己职责内的工作；有跨组问题只提意见，不越权修复。

## 每次实质工作必须记录

- Agent 编号、日期、分支、开始 SHA、当前 SHA。
- 修改文件和实际改动。
- 已完成、未完成、下一步。
- 实际执行的命令、测试结果、浏览器和 viewport 证据。
- 未知项、风险、Issue ID。
- 向指定监督对象提出的问题和建议。
- 中断时精确恢复位置。

只写计划不能标记 DONE。没有运行的测试必须写 NOT RUN。没有浏览器证据不能标记视觉或交互浏览器验收通过。

## 当前状态

本次工作只更新协作组织、文档契约和目标目录说明，不重构现有 SPA，不修改 API、数据库、认证、资金、撮合、结算或生产部署设置。
1. Source scan complete — record actual file list, consumers, existing work, risks and confirmed boundary.
2. First implementation batch — record files, behavior preserved, screenshots/test evidence if available.
3. Integration checkpoint — record cross-agent impacts and required merges.
4. Final handoff — record tests, known gaps, latest SHA and exact next step.

The user will use the short labels “2号” and “3号” to tell the other AI windows which task to read. Those agents must identify themselves by their number in every shared record.

## Stop conditions

Stop only the affected change when:
- a requirement conflicts with existing financial/security behavior;
- a needed route/API/data field is not verified;
- another agent owns the file or has uncommitted changes;
- a shared interface change would break another module;
- the only way to complete the visual request is to alter backend/API/auth/financial behavior.

Record the blocker and continue unrelated safe work. Do not stop the entire project for a cosmetic question.


## Mandatory standards added to the entry point

Before implementation and review, every agent must read:
- `MOBILE-DESKTOP-SEPARATE-STANDARDS.md`: mobile browser is primary; desktop is a separately composed experience; independent viewport/browser acceptance.
- `AI-REVIEW-AND-REMEDIATION.md`: peer review must cite objective standards and evidence, assign the correct repair owner and require independent retesting.

Do not use one page composition for both mobile and desktop. Shared tokens and primitives are permitted; the composition and acceptance are separate.


## Branch baseline clarification

The shared source-code baseline is f1d7b86437872a586e90973826b3086d4b5fa298. The initial task-document baseline is 64c84962dd0d94adca895015144c728aac8f5dd2. The 2号 and 3号 branches subsequently received synchronized policy-document commits, so their current branch heads intentionally differ. Each agent must work from the current head of its own assigned branch. Do not reset it or merge/cherry-pick the entire coordination branch. Compare source changes against the common source-code baseline; preserve the synchronized policy documents.


## Verified route ownership correction — supersedes earlier Home uncertainty

Source inspection of `feature/uiux-upgrade` at `f1d7b86437872a586e90973826b3086d4b5fa298` confirms `VIEWS.home` and `VIEWS.tradehub` in `assets/js/views-home.js`, and the five mobile nav links in `index.html`: `#/home`, `#/markets`, `#/trade-hub`, `#/assets`, `#/me`. 1号 owns Home/trade-hub view logic in `views-home.js`. 3号 owns shell navigation and the existing Home/trade-hub CSS in `assets/css/views.css`. The previous instruction to wait for Home-route confirmation is obsolete. 3号 must inspect current routes and improve existing navigation; do not create a duplicate route. 1号 sends Home/trade-hub CSS needs to 3号 and must not edit `views.css`.


## Source-verified Home route correction

The source branch at SHA f1d7b86437872a586e90973826b3086d4b5fa298 already defines VIEWS.home and VIEWS.tradehub in assets/js/views-home.js. index.html already has mobile destinations #/home, #/markets, #/trade-hub, #/assets and #/me. 1号 owns Home/trade-hub view logic. 3号 owns shell navigation and the existing Home/trade-hub CSS in assets/css/views.css. Earlier notes saying the Home route is unconfirmed are superseded. Do not create duplicate routes; 1号 sends Home styling requests to 3号.
