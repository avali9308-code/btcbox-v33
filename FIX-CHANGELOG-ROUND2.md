# BTCBOX v33 — Round 2 修复清单 (Fix Changelog)

修复基准：BTCBOX-v33-audited-clean。所有修复均不删除业务功能，仅修复可安全修复的阻断/高风险项。

## 修复内容

### 阻断上线 B1 — 秒合约客户端余额篡改（已修复，Round 2 二次修订）
- 文件：`pages/seconds.html`、`dist/pages/seconds.html`、`netlify/functions/api.js`、`assets/js/i18n.js`
- 问题（原始）：`placeOrder()` / `settle()` 直接修改 `BTCBOX.account.balances.USDT.free` 并调用 `BTCBOX.saveAccount()` 写入 localStorage，纯客户端赌博模拟，无服务端记录，余额可被任意篡改。
- Round 2 初次修复的偏差：将秒合约整体降级为 `simBal=10000` 模拟体验金并加"模拟演示"标识条，阉割了真实秒合约功能。
- 本次修复（恢复原本需要的功能 + 移除篡改）：
  - **变量初始化**：移除 `var simBal = 10000`，恢复 `var bal = 0`（从真实账户快照只读读取）。
  - **移除客户端篡改**：前端不再出现 `balances.USDT.free =` 直接赋值；唯一的 `saveAccount()` 调用仅用于从 `/api/account` 同步服务端余额快照（`refreshAccount()`），属于合法缓存同步，非篡改。
  - **恢复真实功能**：余额显示真实账户 USDT 可用余额（监听 `accountChange`）；开仓/结算/持仓查询全部走服务端 API：
    - `POST /api/seconds/order`：服务端自行从 Coinbase/Bybit 获取开仓价（不信任客户端价格），调用 PostgreSQL RPC `submit_seconds_order_v1` 原子冻结资金并创建持仓，返回 `position_id` + `open_price`。
    - `POST /api/seconds/settle`：服务端 RPC 自行获取结算价并原子划转盈亏（客户端仅传 `position_id`），返回 `win/tie/pnl/settle_price`。
    - `GET /api/seconds/positions`：恢复进行中持仓与历史，刷新页面不丢单。
  - **幂等与限流**：开仓/结算均要求 16–100 位 `request_id` 幂等键；开仓 30 次/5 分钟/UID，结算 60 次/5 分钟/UID。
  - **Fail-closed（与 B2 一致，不擅自开启）**：三个端点均受 `financialWritesEnabled()` 闸门控制，未完成 PostgreSQL 切换审批时返回 503 `FINANCIAL_CUTOVER_INCOMPLETE`，不冻结、不划转、不创建持仓。前端收到该 code 时提示"秒合约暂未开放，需完成资金切换审批"。
  - 移除"模拟演示 · 不涉及真实资金"标识条与"模拟体验金"文案。
- 验证：
  - `grep -c "simBal\|模拟演示\|balances.USDT.free =" pages/seconds.html` → 0。
  - `grep -c "api/seconds" pages/seconds.html` → 3（order/settle/positions）。
  - `node --check netlify/functions/api.js` → 通过。
  - `npm test` → 186 passed / 0 failed（新增 16 条中文 API 消息已在 `ROUND132_API_MESSAGE_COPY` 注册英文翻译，通过 Round 133 本地化测试）。
  - `npm run build` → 成功，`dist/` 已同步。

### 高风险 H1 — 全 API 无速率限制（已修复）
- 文件：`netlify/functions/api.js`
- 问题：登录、注册、资金密码（6位数字）、2FA、管理员 Basic Auth 均可无限暴力尝试。
- 修复：添加内存滑动窗口限流器 `rateCheck()` + `clientIp()`：
  - 注册：30 次 / 10 分钟 / IP
  - 登录：60 次 / 5 分钟 / IP+邮箱
  - 资金密码验证：20 次 / 15 分钟 / UID
  - 2FA 验证：20 次 / 15 分钟 / UID
  - 管理员：60 次 / 5 分钟 / IP，超限返回 429 + Retry-After
- 注意：Serverless 内存状态仅单实例有效，是缓解措施而非彻底防护；生产建议接外部限流/Redis。

### 中风险 M2 — 缺少 CSP 头（已修复）
- 文件：`netlify.toml`
- 修复：添加 `Content-Security-Policy`（允许内联脚本/jsdelivr/Google Fonts/Supabase/CoinGecko connect）、`Permissions-Policy`。

### 中风险 M1 — login.html 硬编码 Supabase 项目（已修复）
- 文件：`netlify/functions/api.js`（`/api/config` 新增 `supabase_auth_url` / `supabase_auth_publishable_key`）、`pages/login.html`
- 修复：login.html 启动时 fetch `/api/config`，优先使用环境变量配置的 Supabase 项目；硬编码值仅作回退。换项目不再需要改代码。

### 中风险 i18n — 新增限流消息本地化
- 文件：`assets/js/i18n.js`
- 修复：`ROUND132_API_MESSAGE_COPY` 新增 `请求过于频繁，请稍后再试` → 英文映射，通过 Round 133 本地化测试。

## 未修复（需线上/业务决策，不擅自改）
- B2：默认部署资金功能全 fail-closed。需完成 PostgreSQL 迁移+全量切换审批后开放，或明确告知用户只读。**秒合约三个新端点（order/settle/positions）同样受 `financialWritesEnabled()` 闸门控制，默认返回 503，不冻结、不划转、不创建持仓。** 开启需设置 `FINANCIAL_POSTGRES_READS_ENABLED=1` 并配置 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`，且数据库需已部署 `submit_seconds_order_v1` / `settle_seconds_position_v1` / `read_seconds_positions_v1` 三个 RPC 函数（本次未创建 SQL 迁移，需 DBA 审批后部署）。
- H2：注册无邮箱验证。需启用 Supabase Auth 邮件/魔法链接。
- H3：验证码明文返回。需接邮件/短信服务。
- H4：管理员仅 Basic 单凭据。建议增加管理员账号体系+2FA+操作人审计。
- H5：单文档状态模型。生产资金必须迁移到事务型 PostgreSQL（项目已预留 RPC 路径）。
- H6：无用户自助密码重置。需接 Supabase Auth 邮件重置。
- M3：trade.html 直接调 CoinGecko。建议新增 `/api/cny-rate` 同源代理。
- M6：密码最小 6 位。建议提升至 8 位（需同步更新 i18n 文案与测试）。
- M5：KYC 明文存储。建议加密或迁移至 PostgreSQL 独立表。

## 修复后测试结果
- `npm test`：186 passed / 0 failed（含 Round 133 本地化测试，新增秒合约 16 条中文消息已注册英文翻译）
- `node --check netlify/functions/api.js`：通过
- `npm run build`：成功，`dist/` 仅白名单文件，无敏感文件泄露
- 秒合约篡改检查：`grep -c "simBal\|模拟演示\|balances.USDT.free =" pages/seconds.html dist/pages/seconds.html` → 0
- 秒合约服务端对接：`pages/seconds.html` 含 3 处 `/api/seconds/*` 调用（order/settle/positions）

## 部署需在控制台配置的项
1. Netlify 环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_AUTH_URL`、`SUPABASE_AUTH_PUBLISHABLE_KEY`（或 `ANON_KEY`）、`ADMIN_USER`、`ADMIN_PASS`、`DEPOSIT_*`（充值地址）。
2. Supabase Dashboard：启用 Google OAuth、配置回调 URL（站点 URL + `/pages/login.html?auth_callback=1`）、启用邮件发送。
3. 按 `supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md` 顺序应用 SQL 迁移到目标项目。
4. 资金功能开放前：设置 `FINANCIAL_POSTGRES_RPC_ENABLED=1`、`FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=1`、`FINANCIAL_POSTGRES_READS_ENABLED=1`（需 staging 验收通过）。

## 尚未通过的验收项（需线上环境）
- 真实 Google OAuth 注册/登录/回调、邮件魔法链接、密码重置邮件。
- Supabase 迁移已应用 + RLS 生效验证。
- Netlify 实际部署 + 函数冷启动 + Blobs/Supabase 连接。
- 浏览器端视觉/响应式/加载态/空态/溢出（需真实截图）。
- 真实链上充值确认、提现广播（项目明确未实现链上广播）。
- 数据库并发/事务一致性压测。
