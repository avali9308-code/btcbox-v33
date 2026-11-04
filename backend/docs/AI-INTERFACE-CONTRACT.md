# BTCBOX 三团队公共接口契约

本文件定义视觉、交互、功能三组之间的交界，不取代各自任务书。每个接口变化必须记录消费者、兼容性、迁移计划和验证结果。

## 1. 当前真实工程结构

当前项目是 hash-routed SPA：
- Shell：`index.html`、`admin.html`。
- Core/router/API adapter/state：`assets/js/app-core.js`、`assets/js/boot.js`。
- Shared UI JS：`assets/js/ui-components.js`。
- View modules：`assets/js/views-home.js`、`views-trade.js`、`views-trading.js`、`views-assets.js`、`views-account.js`、`views-missing.js`。
- CSS：`assets/css/*.css`。
- Backend/API：`api/**`、`server.py` 和受保护的数据库/财务模块。

不要把目标目录误认为当前已存在的代码结构。

## 2. 两个公共层

### A. 统一规范层
位置：`docs/`。三组共同读取；修改共同标准须由用户明确指示或协调者按用户指示同步。

### B. 共享技术基础层
位置：目标 `src/`，目录与主责：

| 目录 | 主责 | 契约 |
|---|---|---|
| api | 3号 | 请求/响应、鉴权上下文、错误语义 |
| store | 3号 | 真实数据状态、更新来源、缓存与失效 |
| router | 2号 | 路由流程、守卫交互、返回与跳转；3号提供权限状态 |
| layouts | 1号 | 页面框架视觉和响应式布局 |
| components | 1号 | 外观与 Design System；2号定义行为契约，3号接入数据 |
| hooks/interaction | 2号 | 用户操作与交互状态 |
| hooks/data | 3号 | 数据订阅、查询和业务状态 |
| utils/visual | 1号 | 视觉格式辅助，不改变业务值 |
| utils/interaction | 2号 | 交互辅助 |
| utils/data、utils/business | 3号 | 数据/业务辅助 |
| types | 3号 | API 与领域类型；其他组提出需求，不私改 |
| constants | 3号 | 业务状态/领域常量；设计 token 不放入业务常量 |

每个具体文件必须在任务板指定一个 primary owner。共享目录不是无主目录。

## 3. 三类契约

### Visual Contract（1号）
- Token 名称和值、组件外观、尺寸、层级、布局、响应式断点、视觉状态映射。
- 不决定业务状态是否成立，也不触发用户流程。

### Interaction Contract（2号）
- 用户事件、操作顺序、状态机、触发时机、反馈方式、关闭/返回规则、超时和重试体验。
- 不决定业务数据真实性，不改变 API schema。

### Business Contract（3号）
- API method/path/payload/response、数据字段、精度、单位、权限状态、错误码、WS event 和领域状态。
- 不决定视觉呈现和用户反馈时机。

## 4. 例：下单流程

| 阶段 | 3号 Business | 2号 Interaction | 1号 Visual |
|---|---|---|---|
| 输入 | 提供交易对精度、余额和规则 | 定义输入顺序和提示 | 设计输入框和信息布局 |
| 校验 | 返回真实校验结果/错误码 | 决定如何提示与阻止下一步 | 呈现错误和禁用状态 |
| 确认 | 提供订单预览所需真实数据 | 定义确认流程 | 设计确认弹窗 |
| 提交 | 调用真实 API，返回结果/未知状态 | 控制 Loading、防重复、结果反馈 | 呈现 Loading/成功/失败 |
| 成交 | 提供订单/成交/持仓更新 | 定义更新提醒与刷新行为 | 呈现订单和资产变化 |

超时且结果未知时，不能伪造成功或失败；应由3号提供 UNKNOWN/PENDING 语义，2号设计安全确认路径，1号准确呈现状态。

## 5. 公共组件交界

每个共享组件至少登记：
- Component name / file / primary owner。
- Visual props 和视觉状态（1号）。
- Events、callbacks、focus/close behavior（2号）。
- Data props、domain types、loading/error source（3号）。
- 所有消费者及兼容性。

公共组件签名不得静默破坏。任何签名变化必须先提出契约变更并列出消费者。

## 6. 路由与状态

- 2号负责用户路径、页面流转、返回行为和导航交互。
- 3号负责会话、权限、数据状态及真实业务状态。
- 1号负责导航和页面布局的视觉呈现。
- 路由目标必须在当前 view registry 中真实存在；不得创建死链或假页面。

## 7. 变更流程

1. 提议者记录现状、问题、证据和提议。
2. 标出受影响的团队和所有消费者。
3. 主责团队评估兼容性并决定实施方式。
4. 实施团队在自己的分支修改。
5. 更新本契约、任务板、变更日志。
6. 由非实施者进行独立验证。
7. 记录 commit SHA、测试命令和结果。

监督者只提意见，不实施被监督团队的修复。任何涉及受保护后端/资金行为的变化另需用户授权。
