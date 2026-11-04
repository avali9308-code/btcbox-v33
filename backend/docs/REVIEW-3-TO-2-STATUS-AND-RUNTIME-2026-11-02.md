# 3号跨团队状态与运行时提示审查（2026-11-02）

## 范围与边界

- 审查方：3号 Business Team
- 目标：2号 Interaction Team
- 目标分支：`feature/ai2-interaction`
- 对照后端：`main` 的 `api/core.js`
- 类型：源码契约审查；不是运行时复现
- 未修改任何应用/API/数据库代码；未提交表单、KYC、订单或资金请求；未运行 build、自动化测试或浏览器 QA。

## INT-KYC-001 — KYC 状态对象被当作状态字符串，且 pending 等级被显示为 Approved

- 严重度：P1
- 证据：
  - 后端 `GET /api/account` 返回 `kyc: user.kyc`（对象），并将 `kyc_level` 映射为 approved=2、pending=1、其他=0。见 `api/core.js` L928-L932。
  - 2号分支 `assets/js/app-core.js` L209 将 `status:r.kyc` 赋值给状态字段，而不是读取 `r.kyc.status`。
  - 同分支 `assets/js/views-account.js` L70-L79 以 `state.kyc.status === 'pending'` 判断审核中，却以 `level>=1` 显示 Basic Verification Approved。
  - `assets/js/views-account.js` L82-L93 对 `level>=1` 显示 Advanced Verification 入口。
  - `assets/js/views-missing.js` 的账户徽章也以 `level>=1` 显示 Verified。
- 预期：API contract 和 state mapper 使用明确、同一的状态字段；pending 必须保持审核中，不得被映射成已认证；只有后端明确 approved 且等级满足时才能显示通过及开放下一等级入口。
- 实际源码路径：后端对 pending 返回 `kyc_level=1` 和 `kyc` 对象；前端把对象本身赋给 status。页面的 pending 字符串判断无法命中，同时 `level>=1` 分支会将 pending 等级渲染成 Approved / Verified，并提供 Advanced Verification 入口。
- 影响：用户可能在 KYC 仍待审核时看到已通过/已认证提示，错误理解提现权限或继续申请更高级别认证。该结论由源码映射关系推导，尚未通过浏览器运行时复现。
- 建议：2号与3号共同确认一个最小、明确的 account KYC response/state contract；分别表达 `status` 与 `level`，不要用 pending 作为已认证等级；对 unverified/pending/approved/rejected/locked 和 level 0/1/2 建立组合测试。拒绝原因、重新提交规则须按现有业务约定展示，不得自行改变审核规则。
- 状态：OPEN / ACTION REQUIRED；目标分支未修改。

## INT-ORDER-001 — 撤单 API 结果未检查，界面无条件提示撤单成功

- 严重度：P1
- 证据：
  - 2号分支 `assets/js/views-trade.js` L288-L292：点击 Confirm Cancel 后 await `apiAdapter.cancelOrder(id)`，没有检查返回对象的 `ok` / `status`，随后无条件 toast `Order canceled.`，并重新渲染当前本地 `state.orders`。
  - 同分支 `assets/js/app-core.js` L283-L284：`cancelOrder` 返回 API 响应对象。
- 预期：只有后端明确确认取消成功/已取消时才能显示成功；拒绝、订单已成交、撤单竞争、网络异常、结果未知必须使用各自准确状态，并重新查询权威订单状态。
- 实际：无论 API 返回 `ok:false` 还是网络层返回失败对象，当前交互代码都会显示撤单成功；重新渲染使用原有本地订单数组，未在该处理器中刷新权威订单数据。
- 影响：订单仍然有效或已部分/全部成交时，用户可能误以为撤单成功；可能继续误判冻结余额和可用余额。尚未发起撤单请求，未做运行时复现。
- 建议：2号检查 API 返回结果并区分 cancelled / already terminal / rejected / unknown；成功后重新拉取订单和余额，再更新页面。撤单竞争必须由后端最终状态决定，不能用前端点击结果推断。
- 状态：OPEN / ACTION REQUIRED；目标分支未修改。

## 验收矩阵（待目标团队执行）

- KYC：unverified、pending、approved、rejected、locked；每个状态分别验证等级、徽章、提示、表单/按钮权限、拒绝原因、刷新后恢复和语言切换。
- 撤单：明确成功、订单已成交、部分成交后撤单、撤单已被处理、权限/参数拒绝、超时但服务端已执行、超时且服务端未执行；验证订单列表、详情、余额与提示一致。
- 每个状态至少验证中文/英文、刷新、重复点击、离开再进入；记录真实 API response、UI 截图和设备/viewport。
- 任何未确认的网络结果必须保留 UNKNOWN / CHECK STATUS，不得转换为成功或失败。

## 执行记录

- Source review：完成。
- Runtime reproduction：NOT RUN。
- Build / automated tests / browser QA：NOT RUN。
- API / DB / financial operations：NOT RUN。
- 目标团队代码修改：NO。


## INT-ORDER-002 — 部分成交订单被归入历史订单，剩余数量无法从当前页面撤销

- 严重度：P1
- 证据：
  - 2号分支 `assets/js/views-trade.js` L254-L255：Open Orders 仅筛选 `status==='open'`；History 则筛选所有非 `open` 状态。
  - 同文件 L289-L292：撤单按钮仅对 `o.status==='open'` 的订单生成。
  - 后端 `main` `api/core.js` L1469-L1471 将 matching DB 的原始状态直接返回前端，不做状态归一化。
  - `supabase/sql/financial_matching_engine_v1.sql` L58-L66 明确 `partially_filled` 与 `open` 一样属于剩余数量大于0的活动订单，并进入撮合盘口；撤单 RPC L283-L284 只拒绝已 filled 订单，对 partially_filled 允许继续撤销剩余预留量。
- 预期：`open` 和 `partially_filled` 都应归入活动订单；部分成交订单显示已成交数量、剩余数量，并允许用户撤销剩余部分。
- 实际：`partially_filled` 被当前 UI 过滤到 History，且没有撤单按钮；用户看不到正确的活动订单入口，也无法从该视图撤销剩余数量。
- 影响：部分成交订单仍在撮合队列中，但用户界面把它显示为历史记录；用户可能误以为订单已经结束，无法及时撤销未成交部分。源码契约确认；未运行撮合或实际撤单。
- 建议：按后端 canonical status 显式定义 active/terminal 状态集合；至少将 `open`、`partially_filled` 归为 active，`filled`、`cancelled` 归为 terminal。撤单后按服务端返回状态刷新订单与余额。
- 状态：OPEN / ACTION REQUIRED；目标分支未修改。


## BUS-MKT-010 — 市场数据 REST polling 重叠请求可能造成旧响应覆盖新行情（待运行时验证）

- 分类：DATA FRESHNESS / RUNTIME RACE；暂列 P2 风险，不作为已复现缺陷。
- 证据：
  - 2号分支 `assets/js/app-core.js` L238-L241：`refreshMarket()` 每次直接发起 `apiFetch('/market')`，成功后无条件调用 `applyMarket(r)`。
  - 同文件 L216-L232：`applyMarket` 对已有交易对直接覆盖价格和 `ts`，没有比较新旧时间戳或请求序号。
  - 同文件 L439-L445：市场请求每 3 秒启动一次，未见 in-flight guard。
  - `main` `api/core.js` L1123-L1143：行情接口的 `ts` 是请求开始时生成的服务器时间；上游 Coinbase/Bybit 请求可等待最多 5 秒。
- 观察：前端当前这条行情更新链路是 REST polling（3秒），本次检查的文件中未发现 WebSocket 订阅实现；这本身不等于缺陷，也不能据此断言仓库其他模块没有 WebSocket。
- 风险推导：若较早发出的请求比后续请求更晚返回，较旧响应仍会无条件覆盖较新行情；UI 没有使用返回的 `ts` 拒绝过期数据。请求时长可超过 3 秒，因此重叠具备发生条件。
- 建议：确认是否有意采用 REST polling；无论采用何种传输方式，都应按交易对使用源时间戳/序列号拒绝旧数据，并处理请求重叠、断线/失败、数据过期和恢复提示。若未来接入 WebSocket，REST 快照不能覆盖更新的 WS tick。
- 运行时复现：NOT RUN。需要用可控延迟的 mock responses 验证先发慢响应、后发快响应的乱序场景。
