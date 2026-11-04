# 3号 Business Team — API 与资金安全基线审查（2026-11-02）

## 结论

**状态：BLOCKED / OWNER DECISION REQUIRED**

本轮对3号职责范围内的 API 环境隔离和金融功能开关进行源码审查。发现两个必须跟踪的环境/资金安全问题，其中一项为 P0。这里只记录问题和证据，不修改 API、金融开关、部署配置、数据库或资金逻辑。

## 审查基线

- Repository：`avali9308-code/btcboxcdt`
- Branch：`feature/ai3-business`
- Source baseline：`ce91ab8e8aadd47e0981358857dd1b2a0f02e92e`（本轮文档审查前的分支 HEAD）
- `assets/js/app-core.js` blob SHA：`325aa5334d8863c90edf23a0e0506d682d396994`
- `api/core.js`：本轮从该分支读取，重点检查第97–118行的金融 gate。
- `scripts/deployment-preflight.js` blob SHA：`f3441b39af5191e5ebca2a087407266b702e3829`
- `vercel.json`：本轮读取当前分支配置。
- 已有基线文档：`docs/BASELINE_REPORT.md` §Financial feature flags；`docs/PHASE-1-BASELINE.md` §6。

## Finding BUS-ENV-001 — 金融功能开关运行时与 Preflight 语义不一致

**P0 — 资金安全阻断项**

**源码证据**

`api/core.js` 第97–118行：
- `manualDepositRpcEnabled()` 使用 `FINANCIAL_POSTGRES_RPC_ENABLED !== '0'` 与 `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED !== '0'`。
- `financialPostgresReadsEnabled()` 对 `FINANCIAL_POSTGRES_READS_ENABLED` 同样采用 `!== '0'`。
- `matchingEngineEnabled()` 对 `FINANCIAL_MATCHING_ENGINE_ENABLED` 采用 `!== '0'`。
- 运行时注释明确说明：环境变量未设置或任何非 `0` 值均视为启用；`0` 是紧急关闭值。
- 写入/撮合函数还要求 Supabase storage 配置存在。

`scripts/deployment-preflight.js`：
- 仅当 flag 值严格等于 `'1'` 时，才将其视为已启用。
- 因此 unset 或 `true` 等值会被 Preflight 当成未启用，但运行时会当成启用。

| 环境变量值 | Runtime `!== '0'` | Preflight `=== '1'` |
|---|---:|---:|
| unset | 启用 | 未启用 |
| `0` | 关闭 | 未启用 |
| `1` | 启用 | 启用 |
| `true` | 启用 | 未启用 |

**影响**

当 Supabase 服务端凭据已配置而金融 flag 未设置时，Preflight 可能报告“金融开关未启用”，但运行时 gate 实际放行到后续金融路径。这与“未完成 staging 验收前不得启用真实资金/撮合功能”的项目安全要求冲突。

**要求**

- 立即由仓库/部署负责人核对 Preview、Production、Development 三个环境中的四个金融 flag 的实际配置状态（只核对值是否为明确的 `0`，不要把 secret 值写入日志）。
- 在 owner 决定并完成独立 PostgreSQL staging 验收前，必须保持所有相关金融写入/撮合路径 fail-closed。
- 统一 runtime 与 preflight 的布尔语义前，先提交设计决策和测试矩阵；不得由3号在本轮擅自修改金融 gate 或部署配置。
- 验收必须覆盖 unset、`0`、`1`、其他字符串四种值，并验证 API 返回码与资金状态不变。

状态：OPEN / BLOCKER。没有生产环境实测，本报告不声称当前 Production 一定处于危险配置。

## Finding BUS-ENV-002 — 前端 API_BASE 固定指向 canonical host

**严重度：P1 — Preview 隔离与验收阻断**

**源码证据**

`assets/js/app-core.js` 第36–37行：
`API_BASE = 'https://btcboxcdt.vercel.app/api'`。

`apiFetch()` 第138–145行始终使用 `API_BASE + path`，所有请求均通过 `fetch(..., credentials:'include')` 发出。适配器同时承载 GET 与 POST 等真实业务请求。

当前 `vercel.json` 的 CSP `connect-src` 仅允许 `'self'`、Supabase 和 CoinGecko，没有允许 Preview 页面跨域连接 canonical host。Preview 域名与 canonical host 不同，因此 Preview API 请求会受到 CSP 跨域限制；即使以后放宽 CSP，硬编码目标仍会把 Preview 操作指向 canonical backend，而不是 Preview 同环境 API。

**影响**

- Preview 页面可能无法登录、读取行情/资产或完成 API 验收。
- 若为了让 Preview 请求成功而直接放宽 CSP，可能把 Preview 的写操作导向 canonical backend，造成环境隔离风险。
- 不能通过 Preview UI 测试推断真实生产功能状态。

**要求**

- 在任何 Preview 写操作测试前，明确 Preview 应使用同源 `/api` 还是隔离的 Preview backend。
- 由 owner 决定 API base 的环境策略；同时检查 CSP、cookie SameSite/Secure、CORS allowlist 与 Vercel Preview 域名。
- 在隔离策略未确认前，不从 Preview 页面执行下单、充值、提现、划转或任何写请求。
- 修改前必须建立只读/无资金影响的验证方案，并覆盖 GET 与 POST 的环境路由断言。

状态：OPEN。当前报告未执行 Preview 写请求，也未修改 API_BASE/CSP。

## 本轮执行边界

- 只做源码与现有文档核对。
- 未调用生产 API；未读取、输出或修改任何密钥。
- 未修改 API、数据库、认证、资金、撮合、结算或部署配置。
- 未运行 build、tests、preflight 或真实 PostgreSQL staging。
- 未部署、未合并 `main`。

## 下一步

1. 仓库负责人先确认金融 flags 的三个环境配置，确保未获批准时显式关闭；这是 P0。
2. 仓库负责人确认 Preview API 应指向的环境及 CSP/CORS/cookie 策略；在决定前禁止 Preview 写测试。
3. 获得明确决策后，3号再提交最小兼容修复方案，并在隔离环境验证；未经授权不改资金 gate。
4. 继续检查真实 API adapter 与前端数据状态契约；所有未知项进入 issue log。

审查人：3号 AI — Business Team
