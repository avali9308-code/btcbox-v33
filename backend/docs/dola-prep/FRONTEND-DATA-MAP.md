# BTCBOX 前端页面 ↔ 数据库/API 对应关系文档

> 只读技术分析产出。所有结论均来自实际代码，附文件路径+行号依据。无法核实处明确标注「未核实/来自代码推断」。
> 生成时间：2026-11-02。分支：docs/dola-prep。

---

## 0. 架构总览（改造前必须理解）

```
浏览器 (index.html / admin.html) ──fetch──▶ /api/* (Vercel serverless)
                                              │ api/[...path].js:34 转发
                                              ▼
                                        api/core.js handler (line 515)
                                              │ service-role fetch
                                              ▼
                              Supabase PostgREST: /rest/v1/rpc/<name> 或 /rest/v1/<table>
```

**关键事实（全部已核实）：**

1. **浏览器端从不直接访问 Supabase 数据层**。前端唯一 Supabase 用法是 `supabaseClient.auth.*`（匿名 key，仅 OAuth/会话，`assets/js/boot.js:11-32`、`app-core.js:556`），数据读写全部走 `/api/*` REST。grep 全前端无 `supabase.from(` / `supabase.rpc(` 调用。
2. **`admin.html` 与 `index.html` 字节完全相同**（`diff -q` 确认）。Admin 后台即 `VIEWS.admin`（`views-account.js:229`），使用独立 HTTP Basic Auth（`app-core.js:190` 附近 `adminFetch`），与用户 cookie 无关。
3. **所有资金/交易写操作均 fail-closed**：未完成 cutover（环境变量开关）时返回 503，绝不回退到本地模拟余额。幂等键（`request_id`/`client_order_id`/`client_cancel_id`/`idempotency_key`）由前端 `uid()` 生成，**必须 16–100 字符**（提现 16–80），服务端正则强校验。
4. **秒合约开仓价/结算价由服务端从 Coinbase/Bybit 采样**（`api/core.js:145` 附近 `fetchSecondsReferencePrice`），客户端提交的价格**永远不被信任**。前端不得自行计算盈亏。
5. 用户身份（邮箱、密码哈希、2FA secret、资金密码哈希、KYC、地址簿、客服消息）存储在单行 JSON 文档表 `btcbox_state`（RPC `btcbox_save_state`）；资金/订单/理财/秒合约数据在 Postgres 关系表中，仅通过原子 RPC 访问。
6. `pages/` 为空，所有视图为 `index.html` 内 hash 路由（`#/login`、`#/trade/BTCUSDT` 等），路由表见 `app-core.js:509-526`，实际渲染函数由各 `views-*.js` 覆盖占位。

---

## 1. 视图 ↔ 数据映射（逐个视图）

### 1.1 登录 / 注册

- **视图标识**：`VIEWS.login`（`assets/js/views-home.js:60`）、`VIEWS.register`（`views-home.js:107`）；逻辑封装在 `Auth.login`/`Auth.register`（`app-core.js:598`、`626`）。
- **调用的 API**：
  - `POST /api/register {email, password}` — `app-core.js:252`
  - `POST /api/login {email, password, twofa_code?}` — `app-core.js:254`
  - `POST /api/login/2fa {temp_token, code, twofa_code}` — `app-core.js:256`（2FA 二次校验）
  - `POST /api/supabase-login {supabase_access_token}` — `app-core.js:259`（Google OAuth 令牌换本地 cookie）
  - `POST /api/forgot-password {email}` — `app-core.js:261`
  - `POST /api/logout` — `app-core.js:257`（服务端清 cookie）
  - `GET /api/auth-health` — `boot.js:81`（探测 Google OAuth 是否启用）
  - `GET /api/config` — `app-core.js:553`（返回 `supabase_auth_url` / `supabase_auth_publishable_key`，前端据此初始化 Supabase Auth 客户端）
- **Supabase 表/RPC**：`btcbox_state`（用户文档，含 `users[].email/password_hash/twofa_secret/fund_password_hash/kyc/addresses`）；`btcbox_save_state` RPC（持久化）。注册/登录本身不触达资金表。
- **读取关键字段**：响应 `r.ok`、`r.require_2fa`/`r.twofa_required`、`r.temp_token`、`r.email`、`r.uid`、`r.kyc`、`r.twofa_enabled`、`r.fund_password_set`（`app-core.js:907-950` `/api/account` 响应结构）。
- **提交参数**：`email(string,必填)`、`password(string,注册≥8位/登录≥6位,必填)`、`twofa_code(6位数字,条件必填)`、`temp_token(string,2fa流程必填)`、`supabase_access_token(string,OAuth流程必填)`。
- **状态枚举**：`kyc.status` ∈ `unverified` / `pending` / `approved` / `rejected`；`kyc_level` 0/1/2（`core.js:930`）。`twofa_enabled` bool。`fund_password_set` bool。账户 `frozen` bool（冻结后所有写操作 403）。
- **前端发起 vs 服务端完成**：前端仅采集凭据 + 处理 2FA 弹窗；服务端完成 PBKDF2 校验、TOTP 校验、Set-Cookie 会话签发、限速。密码哈希永不下发。Google OAuth 跳转由前端 `supabaseClient.auth.signInWithOAuth` 发起（`boot.js:71`），回调后令牌交换由服务端完成。
- **不可变契约**：`/api/login`、`/api/login/2fa`、`/api/register`、`/api/supabase-login`、`/api/logout` 的参数名与 `temp_token` 二次交换流程；`/api/account` 响应中 `kyc`/`kyc_level`/`twofa_enabled`/`fund_password_set` 字段名。

---

### 1.2 首页与行情（Markets / Home / TradeHub）

- **视图标识**：`VIEWS.markets`（`views-home.js:169`）、`VIEWS.home`（`views-home.js:213`）、`VIEWS.tradehub`（`views-home.js:237`）。
- **调用的 API**：
  - `GET /api/market` — 轮询 3s（`app-core.js:443` `startTicker`→`refreshMarket`）
  - `GET /api/depth?symbol=BTCUSDT` — 轮询 2.5s（`app-core.js:444`）
  - `GET /api/config` — 启动时一次（`app-core.js:553`）
- **Supabase 表/RPC**：行情数据**不读 Supabase**，服务端实时转发 Coinbase/Bybit（`core.js:1123`），失败返回 503，**绝不本地合成**。`/api/config` 的 `announcement`/站点信息来自 `btcbox_state`。
- **读取关键字段**：`/api/market` → `data[BASE].{price,chg,high,low,vol,ts}` 或 `markets[]`（`app-core.js:218-235` `applyMarket`）；`/api/depth` → `bids[[price,size]]`、`asks[[price,size]]`（`app-core.js:302-307`）。
- **提交参数**：无写操作。`symbol`（如 `BTCUSDT`）、`interval`（K线，默认 `15m`）。
- **状态枚举**：`state.marketUnavailable` bool（首包成功后置 false，`app-core.js:240`）。
- **前端发起 vs 服务端完成**：前端仅展示 + 轮询；服务端聚合外部行情。前端不得缓存/合成价格（代码注释明确禁止，`app-core.js:39`、`436`）。
- **不可变契约**：`/api/market` 响应结构（`data` 键为裸基础币 `BTC`/`ETH`…，非交易对）、`/api/depth` 的 `bids/asks` 二维数组格式、`503=行情不可用`语义。

---

### 1.3 现货交易（Trade / K-Line）

- **视图标识**：`VIEWS.trade(params)`（`views-trade.js:71`）、`VIEWS.kline(params)`（`views-trade.js:302`）。路由 `#/trade/<SYMBOL>`、`#/kline/<SYMBOL>`。
- **调用的 API**：
  - `POST /api/order` — `app-core.js:278` `placeOrder`
  - `POST /api/order/cancel` — `app-core.js:283` `cancelOrder`
  - `GET /api/orders` — `app-core.js:285`
  - `GET /api/kline?symbol=&interval=` — `app-core.js:293`（前端重排 `[t,o,h,l,c,v]`→`[t,o,c,l,h,v]` 供 ECharts candleOption）
  - `GET /api/depth`、`GET /api/market`、`GET /api/account`（余额）
- **Supabase 表/RPC**：
  - 下单 → `submit_limit_order_matching_v1`（`core.js:1225`，经 `matchingRpc` 封装 `core.js:131`）
  - 撤单 → `cancel_limit_order_matching_v1`（`core.js:1248`）
  - 查单 → 表 `financial_matching_orders`（PostgREST 直读，`core.js:1466`，`select=id,base_asset,quote_asset,side,price,quantity,remaining_quantity,status,client_order_id,created_at,updated_at`，`user_id=eq.<uid>`，`limit=50`）
  - `execute_spot_trade_atomic`（元数据中存在）**未在前端-facing 端点发现直接调用**，推断由匹配引擎内部触发 —— **未核实/来自代码推断**。
- **读取关键字段**：`state.balances[COIN].{free,frozen}`（下单前可用余额校验，`views-trade.js:117,215`）；`state.orders[]`（`order_id,symbol,side,price,qty,remaining,status,created_at`）；`state.depthCache.{bids,asks}`。
- **提交参数**（`POST /api/order`，全部必填）：`symbol(string,如BTCUSDT)`、`side(BUY/SELL,大写)`、`type(仅 limit，market 被服务端拒绝,core.js:1215)`、`qty(number>0)`、`price(number>0)`、`client_order_id(16-100字符,幂等)`、`request_id(16-100字符)`。撤单：`order_id`、`client_cancel_id(16-100)`、`request_id`。
- **状态枚举**：订单 `status` ∈ `open` / `filled` / `cancelled`（SQL `financial_matching_engine_v1.sql` 核实）；`partial_fill` **未核实**（前端仅按 `==='open'` 与 `!=='open'` 分 tab，`views-trade.js:254-255`）。
- **前端发起 vs 服务端完成**：前端构造参数+幂等键+本地可用余额预检查；服务端强校验、冻结资金、撮合、记账全部在 Postgres RPC 内原子完成。前端**永不直接改余额**，下单成功后依赖 `/api/account` 刷新。
- **不可变契约**：`/api/order` 与 `/api/order/cancel` 的全部参数名（含 `client_order_id`/`client_cancel_id` 幂等键长度）；`submit_limit_order_matching_v1` / `cancel_limit_order_matching_v1` 的 `p_*` 参数名；`financial_matching_orders` 读字段集；交易对白名单（`PAIRS` 常量 `app-core.js:40`，18 个 USDT 交易对）。

---

### 1.4 合约与秒合约（Seconds）

- **视图标识**：`VIEWS.seconds`（`views-trading.js:10`）。路由 `#/seconds`。
- **调用的 API**：
  - `POST /api/seconds/order` — `app-core.js:309`
  - `POST /api/seconds/settle` — `app-core.js:318`
  - `GET /api/seconds/positions` — `app-core.js:329`
- **Supabase 表/RPC**：
  - 开仓 → `submit_seconds_order_v1`（`core.js:1335`）
  - 结算 → `settle_seconds_position_v1`（`core.js:1366`）
  - 持仓查询 → `read_seconds_positions_v1`（`core.js:1381`，参数 `p_user_id`）
  - 表：`seconds_contract_positions`
- **读取关键字段**：`state.secondsPositions.{open[],history[]}`；单仓字段 `position_id,symbol,direction,amount,duration_sec,open_price,settle_at,status,win,tie,pnl,settle_price`（`app-core.js:312-326`）。
- **提交参数**：
  - 开仓（必填）：`symbol(裸基础币∈{BTC,ETH,SOL,BNB}，非交易对)`、`direction(up/down)`、`duration_sec(∈{30,60,300,900})`、`amount(number>0)`、`request_id(16-100)`。
  - 结算（必填）：`position_id(10-40字符)`、`request_id(16-100)`、`symbol(裸基础币)`。**注意：客户端不传价格**。
- **状态枚举**：`status` ∈ `open` → `settled`；结算结果 `win` bool / `tie` bool（非 win 非 tie 即亏损，`core.js:1370` 响应含 `win,tie,pnl`）。
- **前端发起 vs 服务端完成**：前端仅提交方向/时长/金额；**开仓价与结算价 100% 由服务端从 Coinbase/Bybit 采样**（`core.js:145` `fetchSecondsReferencePrice`，两个独立 fallback），并在 RPC 内校验到期时间、归属、幂等、原子记账。前端在 `secondsSettle` 成功后本地把仓位从 open 移到 history（`app-core.js:322-326`），但权威状态以 `GET /api/seconds/positions` 为准。限速：开仓 30 次/5min，结算 60 次/5min（`core.js:1316,1349`）。
- **不可变契约**：三个端点全部参数名与枚举值（`symbol` 裸币、`duration_sec` 四档）；`submit_seconds_order_v1`/`settle_seconds_position_v1`/`read_seconds_positions_v1` 的 `p_*` 签名；**「客户端永不传价格」是安全边界，UI 改造不得引入价格输入**。

---

### 1.5 资产总览（Assets / 我的 Me）

- **视图标识**：`VIEWS.assets`（`views-assets.js:21`）、`VIEWS.me`（`views-missing.js:45`，路由 `#/me`）。
- **调用的 API**：`GET /api/account`（`app-core.js:262`，登录后/每次进入资金页刷新）。`views-missing.js:199` 划转页也调它刷新余额。
- **Supabase 表/RPC**：`read_financial_account_snapshot_v1`（`core.js:174`，参数 `p_user_id`）→ 返回 `balances{COIN:{free,frozen}}`、`withdrawals[]`、`earn_records[]`；用户档案字段（KYC/2FA/地址簿/最近订单/充值记录）来自 `btcbox_state`。
- **读取关键字段**（`core.js:907-950` 响应）：`balances[COIN].{free,frozen,amount(=free),usdt(估值),valuation_available}`、`totalUsdt`/`total_usdt`、`orders[](最近50)`、`deposits[](最近20)`、`withdrawals[]`、`earn_records[]`、`kyc`、`kyc_level`、`twofa_enabled`、`fund_password_set`、`deposit_addresses`、`addresses[](脱敏)`、`unpriced_assets[]`。
- **提交参数**：无写操作。
- **状态枚举**：余额分 `free`（可用）/`frozen`（冻结，含挂单冻结、提现审核冻结、理财冻结）。`valuation_available` bool。
- **前端发起 vs 服务端完成**：服务端聚合快照 + 实时 USDT 估值（`getLiveUsdtPrices`，`core.js:920`）；前端仅展示与本地排序/隐藏小额（`state.settings.hideSmall`，纯前端偏好，不持久化，`views-assets.js:87`）。
- **不可变契约**：`GET /api/account` 响应字段全集（`balances` 结构、`total_usdt` 别名、`orders/deposits/withdrawals/earn_records` 切片）；`read_financial_account_snapshot_v1` 的 `p_user_id` 参数与返回 `ok/balances/withdrawals/earn_records` 结构。

---

### 1.6 充值（Deposit）

- **视图标识**：`VIEWS.deposit`（`views-assets.js:113`）。路由 `#/deposit`。
- **调用的 API**：`POST /api/deposit {coin, network, amount:0}`（`app-core.js:270`）。**amount 必须为 0（查询地址模式），amount>0 服务端返回 403**（`core.js:1048`，用户不得自行入账）。
- **Supabase 表/RPC**：充值地址来自 `btcbox_state.deposit_addresses`（`core.js:1040`）。链上入账由服务端链监控/管理员触发，前端不接触：`verify_and_credit_deposit_atomic`、`confirm_deposit_atomic`（元数据存在，`core.js` 无直接调用点 —— **未核实调用方，推断为链验证脚本/server.py**）；管理员手动入账 `admin_manual_deposit_atomic`（见 1.12）。表：`deposit_records`。
- **读取关键字段**：响应 `address(string)`。前端用 `qrcode-generator` 本地生成 QR（`renderQR`，`views-assets.js:99`）。充值记录从 `GET /api/account` 的 `deposits[]` 读取。
- **提交参数**：`coin(默认USDT)`、`network(默认TRC20)`、`amount(固定0)`。
- **状态枚举**：`deposit_records.status` ∈ `pending` → `confirmed`（`financial_deposit_chain_verification_v3.sql` 核实）。
- **前端发起 vs 服务端完成**：前端仅查询地址 + 展示 QR + 展示历史；入账完全在服务端/链上/管理员侧。前端无任何「确认充值」写接口。
- **不可变契约**：`POST /api/deposit` 的 `amount:0` 查询语义与 403 边界；`deposit_addresses` 键格式 `COIN-NETWORK`（如 `USDT-TRC20`，`BTC-BTC` 兼容 legacy `BTC-Bitcoin`，`core.js:1038`）。

---

### 1.7 提现（Withdraw）

- **视图标识**：`VIEWS.withdraw`（`views-assets.js:196`）。路由 `#/withdraw`。
- **调用的 API**：`POST /api/withdraw`（`app-core.js:272`）。
- **Supabase 表/RPC**：`create_withdrawal_atomic`（`core.js:1103`）。表：`withdrawal_requests`。管理员审批见 1.12（`review_withdrawal_atomic`）。
- **读取关键字段**：`state.balances[coin].free`（可用余额，`views-assets.js:271,341,354,386`）；`state.settings.twofa`（决定 2FA 输入框是否必填，`views-assets.js:234,389`）；提现记录从 `GET /api/account` 的 `withdrawals[]`。
- **提交参数**（`app-core.js:274-277`，`core.js:1050-1101` 强校验）：
  - `coin(string,必填)` ∈ `{USDT,BTC,ETH,SOL}`
  - `amount(number>0,必填)`
  - `address(string,必填，格式按网络正则校验)`
  - `network(string,必填)` ∈ `USDT:{TRC20,ERC20,BEP20}, BTC:{BTC}, ETH:{ERC20}, SOL:{SOL}`
  - `request_id(16-80字符,必填,幂等)`
  - `fund_password(6位数字,必填，服务端PBKDF2校验)`
  - `twofa_code(6位数字，账户启用2FA时必填，服务端TOTP校验)`
- **状态枚举**：`withdrawal_requests.status` ∈ `pending`（创建后）→ `approved` / `rejected`（管理员审批，`core.js:1721-1760`）。**审批仅扣冻结款，不广播链上**（注释明确，`core.js:1737`）。
- **费率（服务端硬编码，前端仅展示）**：USDT 1.0、BTC 0.0001、ETH 0.001、SOL 0.01（`core.js:1083`）。总扣款 = amount + fee。
- **前端发起 vs 服务端完成**：前端采集 + 幂等键 + 本地余额预校验；服务端校验资金密码/2FA/地址格式/白名单/余额，在 RPC 内原子冻结资金并创建记录。审批由管理员独立端点完成。
- **不可变契约**：`/api/withdraw` 全部参数名（尤其 `fund_password`、`request_id` 长度）；`create_withdrawal_atomic` 的 `p_*` 签名（含 `p_fee`、`p_request_hash`）；费率表与网络白名单；`fund_password` 6 位数字约束。

---

### 1.8 划转（Transfer）— ⚠️ 未连接

- **视图标识**：`VIEWS.transfer`（`views-missing.js:176`）。路由 `#/transfer`。
- **调用的 API**：仅 `GET /api/account`（刷新余额，`views-missing.js:199`）。**无任何写端点**。
- **Supabase 表/RPC**：无。`apply_financial_operation` RPC 在元数据中存在，但 `core.js` 无调用点 —— **未核实/预留，前端未接入**。
- **状态**：页面明确横幅「The transfer interface is not connected... confirmation will not execute a real transfer」（`views-missing.js:182`），确认按钮仅弹提示框（`views-missing.js:213-230`）。
- **不可变契约**：当前无。若未来接入，必须新增幂等端点，不得复用其他写接口。

---

### 1.9 订单与交易记录（Orders）

- **视图标识**：`VIEWS.orders`（`views-trading.js:74`）；现货交易页内嵌订单 tab（`views-trade.js:254`）。路由 `#/orders`。
- **调用的 API**：`GET /api/orders`（`app-core.js:285`）、`POST /api/order/cancel`（撤单，同 1.3）。
- **Supabase 表/RPC**：`financial_matching_orders` 表直读（`core.js:1459-1477`）。成交记录 `state.trades` —— **未核实数据源**：`applyAccount`（`app-core.js:203-216`）仅映射 `orders`，`trades` 字段在 `/api/account` 响应中未出现，推断当前为空/占位。表 `financial_matching_trades` 元数据存在但无前端-facing 读端点。
- **读取关键字段**：`order_id, symbol, side, price, quantity, remaining_quantity, status, client_order_id, created_at, updated_at`（`core.js:1470-1474` 映射）。
- **提交参数**：仅撤单（见 1.3）。
- **状态枚举**：同 1.3（`open`/`filled`/`cancelled`）。前端 tab：`open`（`status==='open'`）/ `history`（`!=='open'`）/ `trades`（`state.trades`，未核实）。
- **不可变契约**：`GET /api/orders` 响应 `orders[]` 字段名；`financial_matching_orders` 的 `user_id` 行级过滤（服务端强制，前端不得传他人 uid）。

---

### 1.10 理财（Earn）

- **视图标识**：`VIEWS.earn`（`views-assets.js:413`）。路由 `#/earn`。
- **调用的 API**：`POST /api/earn`（`app-core.js:331`，`action=subscribe|redeem`）。持仓列表从 `GET /api/account` 的 `earn_records[]` 读取。
- **Supabase 表/RPC**：
  - 申购 → `subscribe_earn_atomic`（`core.js:1281`，SQL 签名 `financial_earn_policy_v5.sql` 核实）
  - 赎回 → `redeem_earn_atomic`（`core.js:1293`，SQL 签名核实）
  - 表：`earn_positions`、`earn_product_catalog`（目录表存在，但**前端产品列表硬编码**，见下）
- **读取关键字段**：`state.balances[coin].free`（可用余额，`views-assets.js:437,446`）；`earn_records[]`（持仓）。
- **产品列表**：`EARN_PRODUCTS` 前端硬编码（`views-assets.js:405-412`）：`flex_USDT/flex_BTC/flex_ETH/fixed30/fixed90/fixed180`，APY/起投额/期限为展示常量。服务端校验 `product_id` ∈ `{demand,flex_USDT,flex_BTC,flex_ETH,fixed30,fixed90,fixed180}`（`core.js:1270`，含一个前端未展示的 `demand`）。**`earn_product_catalog` 表未被前端-facing 端点读取 —— 未核实**。
- **提交参数**：
  - 申购：`action=subscribe`、`request_id(16-100,必填)`、`amount(number>0,必填)`、`product_id(必填)`
  - 赎回：`action=redeem`、`request_id(16-100,必填)`、`record_id(=position_id,必填)`
- **状态枚举**：`earn_positions.status` ∈ `active` → `redeemed`（SQL 核实）。
- **前端发起 vs 服务端完成**：前端选产品+金额；服务端校验 product_id、余额、在 RPC 内原子划转本金到理财账户并记账。利息计算在服务端/DB 策略（`earn_policy.py`、`financial_earn_policy_v5.sql`），前端不计算收益。
- **不可变契约**：`/api/earn` 的 `action` 二值与参数名；`subscribe_earn_atomic`/`redeem_earn_atomic` 的 `p_*` 签名（含 `p_request_hash`）；product_id 白名单。**APY 若改为服务端下发，必须新增端点，不得改现有响应结构**。

---

### 1.11 我的 / 账户 / 安全（Settings / KYC / Support）

- **视图标识**：`VIEWS.settings`（`views-account.js:172`）、`VIEWS.kyc`（`views-account.js:69`）、`VIEWS.support`（`views-account.js:129`）。路由 `#/settings`、`#/kyc`、`#/support`。
- **调用的 API**：
  - KYC：`POST /api/kyc {name, id_type, id_number}`（`app-core.js:339`，无图片上传）→ `core.js:1014`，存 `btcbox_state`
  - 改登录密码：`POST /api/settings/password {old_password, new_password, twofa_code?}`（`app-core.js:341`）→ `core.js:1412`，**成功后清全部会话，强制重新登录**
  - 设置资金密码：`POST /api/settings/fundpwd {fund_password, current_password?, twofa_code?}`（`app-core.js:349`）→ `core.js:1429`
  - 2FA：`POST /api/2fa/enable {}`（返回 `secret`/`otpauth_url`）→ `POST /api/2fa/confirm {code}`；`POST /api/2fa/disable {code}`（`app-core.js:355-377`，`core.js:865-905`）
  - 客服：`POST /api/support/chat {content}`、`GET /api/support/messages`（最近50条，前端映射 `content→text`、`admin→bot`，`app-core.js:379-381`）、`GET /api/chat/unread`
- **Supabase 表/RPC**：全部存 `btcbox_state`（用户文档），无资金表写操作。
- **读取关键字段**：`state.settings.{twofa, fundPwdSet, hideSmall}`、`state.kyc.{level,status}`、`state.supportMsgs[]`。
- **提交参数**：见上。`id_type` 默认 `id_card`。`fund_password` 6 位数字。
- **状态枚举**：KYC `status` 同 1.1。2FA `twofa_enabled` bool。`fundpwd_reauth_mode` ∈ `password`/`twofa`（OAuth 账户无本地密码时强制 2FA，`core.js:944`）。
- **不可变契约**：`/api/settings/password` 成功后清会话语义；`/api/2fa/enable` 返回 `secret` 字段名；资金密码 6 位数字约束（与提现共用）。

---

### 1.12 Admin 后台（含 admin.html）

- **视图标识**：`VIEWS.admin`（`views-account.js:229`）。`admin.html` 与 `index.html` 完全相同。四个 tab：`users`/`deposits`/`withdrawals`/`kyc`（`views-account.js:242`）。
- **认证**：全部 admin 端点 HTTP Basic Auth（`adminFetch`，`app-core.js:190` 附近），独立于用户 cookie，401 时弹浏览器原生认证框。
- **调用的 API 与 RPC**（均已核实调用点）：
  | 端点 | 方法 | 底层 RPC/表 | 行号 |
  |---|---|---|---|
  | `/api/admin/stats` | GET | btcbox_state 聚合 | app-core.js:385 |
  | `/api/admin/users?search=` | GET | btcbox_state + `read_admin_account_balances_v1` | core.js:193 |
  | `/api/admin/user?uid=` | GET | 同上 | app-core.js:389 |
  | `/api/admin/user/freeze` | POST `{uid,frozen,reason}` | btcbox_state（账户冻结标记） | app-core.js:393 |
  | `/api/admin/user/balance` | POST `{uid,coin,delta,mode,request_id,reason}` | `admin_adjustment_atomic` | core.js:1609 |
  | `/api/admin/deposit/confirm` | POST `{uid,coin,amount,reference?,note?,idempotency_key}` | `admin_manual_deposit_atomic` | core.js:1702 |
  | `/api/admin/withdraw/approve` | POST `{id}` | `review_withdrawal_atomic(p_approve=true)` | core.js:1721 |
  | `/api/admin/withdraw/reject` | POST `{id,reason?}` | `review_withdrawal_atomic(p_approve=false)` | core.js:1744 |
  | `/api/admin/kyc/approve` | POST `{uid,admin_override?,reason?}` | btcbox_state | app-core.js:405 |
  | `/api/admin/kyc/reject` | POST `{uid,reason}` | btcbox_state | app-core.js:407 |
  | `/api/admin/withdrawals` | GET | `read_admin_withdrawal_snapshot_v1` | core.js:224 |
  | `/api/admin/addresses` `/orders` `/support/messages` `/config` | GET | btcbox_state / financial_matching_orders | app-core.js:413-421 |
  | `/api/admin/user/reset-pwd` `/user/reset-email` `/push` `/support/reply` `/config`(POST) | POST | btcbox_state | app-core.js:395-421（**前端 tab 未全部接线，部分仅声明 —— 未核实 UI 入口**） |
- **读取关键字段**：`state.admin.{users,deposits,withdrawals,kyc_list}`（`views-account.js:249` 起填充）。
- **状态枚举**：提现审批后 `status` = `approved`/`rejected`；重复审批返回 409 `WITHDRAWAL_ALREADY_PROCESSED`（`core.js:1735,1757`）。余额调整 `mode` ∈ `adjust`/`freeze`/`unfreeze`（`core.js:1602-1603`）。
- **不可变契约**：`admin_adjustment_atomic`/`admin_manual_deposit_atomic`/`review_withdrawal_atomic` 的 `p_*` 签名（含 `p_admin_id`、`p_request_hash`）；`idempotency_key`/`request_id` 长度；`review_withdrawal_atomic` 同一 `p_withdrawal_id` 幂等语义。

---

## 2. 不可变接口契约表（资金/交易/认证相关，供其他 AI 遵守）

> 以下端点与 RPC 的**路径、方法、参数名、参数类型、必填性、幂等键长度、枚举值**均不得在 UI 改造中变更。如需扩展，新增字段/端点，勿改既有签名。

### 2.1 REST 端点（前端 → /api/*）

| # | 端点 | 方法 | 必填参数（类型） | 可选参数 | 幂等键 | 行号依据 |
|---|---|---|---|---|---|---|
| 1 | `/api/register` | POST | email(str), password(str≥8) | — | — | app-core.js:252 |
| 2 | `/api/login` | POST | email(str), password(str) | twofa_code(6位) | — | app-core.js:254 |
| 3 | `/api/login/2fa` | POST | temp_token(str), code(6位) | — | — | app-core.js:256 |
| 4 | `/api/supabase-login` | POST | supabase_access_token(str) | — | — | app-core.js:259 |
| 5 | `/api/logout` | POST | — | — | — | app-core.js:257 |
| 6 | `/api/account` | GET | —（cookie） | — | — | app-core.js:262, core.js:907 |
| 7 | `/api/order` | POST | symbol, side(BUY/SELL), type(limit), qty(num), price(num), client_order_id(16-100), request_id(16-100) | — | client_order_id | app-core.js:278, core.js:1201 |
| 8 | `/api/order/cancel` | POST | order_id, client_cancel_id(16-100), request_id | — | client_cancel_id | app-core.js:283, core.js:1240 |
| 9 | `/api/orders` | GET | —（cookie） | — | — | app-core.js:285, core.js:1459 |
| 10 | `/api/seconds/order` | POST | symbol(裸币), direction(up/down), duration_sec(30/60/300/900), amount(num), request_id(16-100) | — | request_id | app-core.js:309, core.js:1310 |
| 11 | `/api/seconds/settle` | POST | position_id(10-40), request_id(16-100), symbol(裸币) | — | request_id | app-core.js:318, core.js:1343 |
| 12 | `/api/seconds/positions` | GET | —（cookie） | — | — | app-core.js:329, core.js:1374 |
| 13 | `/api/earn` | POST | action(subscribe/redeem), request_id(16-100) | subscribe: amount,product_id; redeem: record_id | request_id | app-core.js:331, core.js:1259 |
| 14 | `/api/deposit` | POST | coin, network, amount(=0) | — | — | app-core.js:270, core.js:1030 |
| 15 | `/api/withdraw` | POST | coin, amount, address, network, request_id(16-80), fund_password(6位) | twofa_code(6位,条件) | request_id | app-core.js:272, core.js:1050 |
| 16 | `/api/settings/password` | POST | old_password, new_password | twofa_code | — | app-core.js:341, core.js:1412 |
| 17 | `/api/settings/fundpwd` | POST | fund_password(6位) | current_password, twofa_code | — | app-core.js:349, core.js:1429 |
| 18 | `/api/2fa/enable` | POST | — | — | — | core.js:865 |
| 19 | `/api/2fa/confirm` | POST | code(6位) | — | — | core.js:884 |
| 20 | `/api/2fa/disable` | POST | code(6位) | — | — | core.js:895 |
| 21 | `/api/kyc` | POST | name, id_type, id_number | — | — | app-core.js:339, core.js:1014 |
| 22 | `/api/admin/user/balance` | POST | uid, coin, delta, mode, request_id(16+), reason(≥5字符) | — | request_id | app-core.js:391, core.js:1609 |
| 23 | `/api/admin/deposit/confirm` | POST | uid, coin, amount, idempotency_key(16+) | reference, note | idempotency_key | app-core.js:399, core.js:1702 |
| 24 | `/api/admin/withdraw/approve` | POST | id | — | —（DB幂等） | app-core.js:401, core.js:1721 |
| 25 | `/api/admin/withdraw/reject` | POST | id | reason | —（DB幂等） | app-core.js:403, core.js:1744 |
| 26 | `/api/admin/user/freeze` | POST | uid, frozen(bool), reason | — | — | app-core.js:393 |

### 2.2 Supabase RPC（服务端 → Postgres，参数名 `p_*` 不可变）

| # | RPC | 关键参数（全部必填除非注明） | 调用方端点 | 行号依据 |
|---|---|---|---|---|
| 1 | `submit_limit_order_matching_v1` | p_order_id, p_user_id, p_base_asset, p_quote_asset, p_side, p_price(text), p_quantity(text), p_client_order_id | /api/order | core.js:1225 |
| 2 | `cancel_limit_order_matching_v1` | p_user_id, p_order_id, p_client_cancel_id | /api/order/cancel | core.js:1248 |
| 3 | `submit_seconds_order_v1` | p_position_id, p_user_id, p_symbol, p_direction, p_amount(text), p_duration_sec, p_open_price(text), p_request_id, p_request_hash | /api/seconds/order | core.js:1335 |
| 4 | `settle_seconds_position_v1` | p_position_id, p_user_id, p_request_id, p_request_hash, p_symbol, p_settle_price(text), p_settle_price_source, p_settle_price_ts | /api/seconds/settle | core.js:1366 |
| 5 | `read_seconds_positions_v1` | p_user_id | /api/seconds/positions | core.js:1381 |
| 6 | `subscribe_earn_atomic` | p_position_id, p_user_id, p_product_id, p_asset, p_principal(text), p_request_id, p_request_hash | /api/earn?action=subscribe | core.js:1281, SQL核实 |
| 7 | `redeem_earn_atomic` | p_position_id, p_user_id, p_request_id, p_request_hash | /api/earn?action=redeem | core.js:1293, SQL核实 |
| 8 | `create_withdrawal_atomic` | p_withdrawal_id, p_user_id, p_asset, p_network, p_amount(text), p_fee(text), p_destination, p_request_id, p_request_hash | /api/withdraw | core.js:1103 |
| 9 | `review_withdrawal_atomic` | p_withdrawal_id, p_admin_id, p_approve(bool), p_reason | /api/admin/withdraw/approve\|reject | core.js:1721,1744 |
| 10 | `admin_manual_deposit_atomic` | p_deposit_id, p_admin_id, p_user_id, p_asset, p_amount(text), p_request_id, p_request_hash, p_reference, p_note | /api/admin/deposit/confirm | core.js:1702 |
| 11 | `admin_adjustment_atomic` | p_request_id, p_admin_id, p_user_id, p_asset, p_available_delta(text), p_frozen_delta(text), p_reason, p_request_hash | /api/admin/user/balance | core.js:1609, SQL核实 |
| 12 | `read_financial_account_snapshot_v1` | p_user_id | /api/account | core.js:174 |
| 13 | `read_admin_account_balances_v1` | p_user_ids(array≤200) | /api/admin/users | core.js:193 |
| 14 | `read_admin_withdrawal_snapshot_v1` | （未核实参数，推断含分页/过滤） | /api/admin/withdrawals | core.js:224 |
| 15 | `btcbox_save_state` | p_expected_revision, p_data | 所有 btcbox_state 写入 | core.js:268 |
| 16 | `verify_and_credit_deposit_atomic` | （元数据存在，core.js 无调用点 —— 链监控侧） | 无前端端点 | sb_openapi.json |
| 17 | `confirm_deposit_atomic` | p_deposit_id, p_admin_id（SQL核实） | 无前端端点（管理员/链） | financial_deposit_chain_verification_v3.sql |
| 18 | `execute_spot_trade_atomic` | （元数据存在，推断匹配引擎内部调用） | 无前端端点 | sb_openapi.json |
| 19 | `apply_financial_operation` | （元数据存在，无调用点 —— 预留/划转） | 无前端端点 | sb_openapi.json |

### 2.3 Supabase 表（14 张，元数据核实）

`btcbox_state`、`deposit_records`、`earn_positions`、`earn_product_catalog`、`financial_accounts`、`financial_audit_log`、`financial_ledger`、`financial_matching_markets`、`financial_matching_orders`、`financial_matching_trades`、`financial_operations`、`financial_spot_orders`、`seconds_contract_positions`、`withdrawal_requests`。

**前端-facing 直读表仅 `financial_matching_orders`（GET /api/orders）**；其余均通过 RPC 封装。

---

## 3. 未核实 / 来自代码推断 清单

1. **成交记录（trades）数据源**：`state.trades` 在 `views-trade.js:256`、`views-trading.js:101` 被读取，但 `applyAccount` 仅映射 `orders`，`/api/account` 响应无 `trades` 字段。推断当前为空占位，`financial_matching_trades` 表无前端读端点。
2. **`execute_spot_trade_atomic`、`apply_financial_operation`、`verify_and_credit_deposit_atomic`、`confirm_deposit_atomic`**：元数据/SQL 中存在，但 `api/core.js` 无直接调用点。推断分别由匹配引擎内部、划转（未实现）、链监控脚本、管理员工具调用 —— 未核实调用方。
3. **`earn_product_catalog` 表**：存在但前端产品列表硬编码（`views-assets.js:405`），服务端也未读该表做校验（仅 product_id 白名单）。未核实是否计划接入。
4. **订单 `partial_fill` 状态**：SQL 中仅核实 `open`/`filled`/`cancelled`，部分成交状态未核实。前端仅二分过滤。
5. **`read_admin_withdrawal_snapshot_v1` 参数签名**：仅核实调用点（`core.js:224`），未核实完整参数列表。
6. **Admin 部分端点 UI 入口**：`/api/admin/user/reset-pwd`、`/user/reset-email`、`/push`、`/support/reply`、`/config`(POST)、`/addresses`、`/orders`、`/support/messages` 在 `app-core.js:395-421` 声明，但 `VIEWS.admin` 四个 tab 仅接线了 freeze/balance/deposit confirm/withdraw approve+reject/kyc approve+reject。其余端点前端 UI 入口未核实。
7. **`server.py`（81KB Python 后端）**：本次以 Vercel serverless（`api/core.js`）为权威前端-facing 接口来源。`server.py` 与 `financial_db.py`/`financial_operation_contract.py`/`earn_policy.py`/`financial_storage_guard.py` 的接口与 `api/core.js` 的一致性未逐行核实；若部署形态为 Python 后端，需另行比对。**`financial_operation_contract.py` 应为参数契约权威源之一，建议改造前交叉核对。**
8. **划转（transfer）**：明确未连接，无后端契约。

---

## 4. 自检

- **密钥自检**：本文档撰写后对本文件执行密钥模式 grep（JWT 前缀 / Vercel token 前缀 / GitHub token 前缀 / 服务端高权限密钥实际值），结果见最终回复：无真实密钥。文档中提及服务端高权限角色仅作为架构描述（服务端以高权限角色调用 PostgREST），Supabase 服务端密钥环境变量名仅作为代码引用出现，未含值。
- **只读约束**：仅新建 `repo/docs/dola-prep/FRONTEND-DATA-MAP.md` 一个文件，未修改任何源码或已有文档。
