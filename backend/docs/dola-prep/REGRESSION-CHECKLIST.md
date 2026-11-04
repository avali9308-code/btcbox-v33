# BTCBOX UI 改造回归测试清单（REGRESSION-CHECKLIST）

> 只读技术分析产出。分支 `docs/dola-prep`。所有检查项基于实际源码与三份前置文档（`DATABASE-MAP.md` / `FRONTEND-ARCHITECTURE.md` / `FRONTEND-DATA-MAP.md`）。
>
> **使用说明**
> - 每项含：检查步骤 / 预期结果 / 对应不可变接口（引用 `FRONTEND-DATA-MAP.md §2.1` 契约编号 #1–#26，未编号的 GET 端点按 §1 名称引用）/ 失败影响等级。
> - **影响等级**：`Critical`=资金安全/认证/路由阻断/构建失败；`High`=核心功能异常；`Medium`=单页面/展示问题；`Low`=视觉/体验。
> - 浏览器点击类项与 `docs/QA-CHECKLIST.md`（B/C 节）互补：本清单侧重 UI 改造后的功能契约回归，QA 清单侧重执行态记录。品牌/阶段约束见 `docs/UIUX-EXECUTION-PLAN.md`（暗黑灰+荧光绿、无金色、桌面/移动端分立设计、禁 mock 真实数据）。
> - **执行前提**：R1（`#/trade-hub` 404）修复前，凡经 Trade tab 进入的用例须先确认路由解析已修复；财务 cutover 未完成时资金写操作返回 503 属预期（fail-closed），UI 须有友好提示。

---

## A. 认证（登录 / 注册 / 登出 / token 持久化）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-A01 | 未登录直接访问 `#/markets`/`#/trade/BTCUSDT`/`#/assets` | 路由守卫重定向至 `#/login`（`app-core.js:490-491`） | 守卫语义（§1.1） | Critical |
| RC-A02 | 已登录访问 `#/login` 或 `#/register` | 自动重定向至 `#/markets` | 守卫语义 | High |
| RC-A03 | `#/login` 输入邮箱+密码提交；若账户启用 2FA，弹二次输入框 | 调 `POST /api/login`；返回 `require_2fa/temp_token` 时进入 2FA 流程，调 `POST /api/login/2fa`；成功后 `applyAccount` 并跳 `#/markets` | #2、#3 | Critical |
| RC-A04 | 注册：邮箱+密码（≥8 位）提交，含条款勾选 | 调 `POST /api/register`；成功态展示注册成功；密码哈希永不下发 | #1 | Critical |
| RC-A05 | 点 Google 登录按钮 → OAuth 回调 → 回跳原页面 | `boot.js` `signInWithOAuth` → 回调后 `POST /api/supabase-login` 换本地 cookie；`sessionStorage.oauth_return_to` 存在则回跳，否则 `#/markets` | #4、`/api/config`、`/api/auth-health`（§1.1） | High |
| RC-A06 | 登录后刷新页面（F5） | 会话 cookie 持久化，`boot()` 后保持登录态，不丢 `state`；`GET /api/account` 恢复余额 | cookie 会话（§1.1）、#6 | High |
| RC-A07 | 顶栏头像菜单 → Logout → 确认框 → 确认 | 调 `POST /api/logout` 清服务端 cookie；前端清 `state`；跳 `#/login`；确认框用 `BTCBox.modal`（`views-account.js:18-30`） | #5 | High |
| RC-A08 | 会话过期（401）后任意资金操作 | `handleSessionExpired`（`app-core.js:131`）提示并跳登录，不残留旧余额 | 会话语义 | High |

## B. 行情与首页（home / markets / tradehub / 价格刷新 / 18 交易对）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-B01 | `#/markets` 加载，All/Favorites/Top Volume 三 tab 切换 | 列表展示 18 个 USDT 交易对（`PAIRS`，`app-core.js:40`）；价格/涨跌/高低/量字段齐全 | `/api/market` 响应结构（§1.2，`data` 键为裸基础币） | High |
| RC-B02 | 停留 markets 页 ≥6s 观察价格变动 | `startTicker` 3s 轮询 `GET /api/market`；价格元素实时更新（`updateLivePriceEls`）；首包成功后 `marketUnavailable=false` | `/api/market`、503=行情不可用语义 | High |
| RC-B03 | 行情服务返回 503 | 展示行情不可用提示，**绝不本地合成/缓存价格**（代码注释禁止，`app-core.js:39,436`） | 503 语义 | Critical |
| RC-B04 | `#/home` 仪表盘：快捷入口卡片点击 | 分别跳转 `#/trade-hub`/`#/assets`/`#/deposit`/`#/me`（`views-home.js:232`）；Explore trading → `#/trade-hub` | 路由（§5.2） | High |
| RC-B05 | **R1 回归**：点移动端底部 Trade tab 或 home 快捷入口 | 必须渲染 TradeHub 选择页（现货/秒合约/理财/Futures coming soon），**不得 404**；修复后 `router()` 对 `trade-hub` 解析到 `VIEWS.tradehub` | R1（`FRONTEND-ARCHITECTURE.md §8.2`） | Critical |
| RC-B06 | TradeHub 页：Spot 卡片 → `#/trade/BTCUSDT`；Seconds → `#/seconds`；Earn → `#/earn`；Futures 为非链接 div 展示 Coming soon | 跳转正确；Futures 不可点（`views-home.js:240-243`） | 路由 | Medium |

## C. 现货交易（trade / kline：买卖 / 限价市价 / 提交 / 取消 / 状态）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-C01 | `#/trade/BTCUSDT` 加载：交易对切换、买卖侧、限价/市价模式切换 | 订单簿（`renderOrderbook`）、最新成交（`renderRecentTrades`）随 `refreshDepth` 2.5s 刷新；K 线图 ECharts 渲染 | `/api/depth`（bids/asks 二维数组）、`/api/kline`（§1.3） | High |
| RC-C02 | 限价买单：输入价格+数量，点买入 | 前端预校验可用余额（`state.balances[quote].free`，`views-trade.js:117,215`）；调 `POST /api/order`，参数含 `client_order_id`(16–100)、`request_id`(16–100)、`type=limit`、`side=BUY`；**市价单服务端拒绝**（`core.js:1215`），UI 不得提交 type=market | #7 | Critical |
| RC-C03 | 下单成功后 | 不直接改本地余额；依赖 `GET /api/account` 刷新 `balances.free/frozen`；订单进入 open 列表 | #6、#7 | Critical |
| RC-C04 | 开放订单 tab 点撤单 → 确认框 | 调 `POST /api/order/cancel`，含 `order_id`、`client_cancel_id`(16–100)、`request_id`；成功后订单移出 open，冻结余额解冻（经 /api/account 刷新） | #8、#6 | Critical |
| RC-C05 | 订单 tab 三态：open（`status==='open'`）/ history（`!=='open'`）/ trades | open/history 正确过滤；`partial_fill` 若出现须归 open（前端仅二分，`views-trade.js:254-255`；`trades` 数据源**未核实**，当前可能为空占位） | #9、状态枚举 open/partially_filled/filled/cancelled（`DATABASE-MAP.md §7.2`） | Medium |
| RC-C06 | 幂等：同一 `client_order_id` 重复提交（网络重试场景） | 服务端幂等去重，不产生重复订单；前端 `uid()` 生成 32 位 hex，长度合规 | #7 幂等键 | Critical |
| RC-C07 | `#/kline/BTCUSDT` 全屏 K 线：隐藏导航（HIDE_NAV）、返回按钮、图表 resize | 全屏无侧栏/顶栏/底部导航；返回回到 trade；切路由时 ECharts 实例与 resize 监听被 `router()` 清理（`app-core.js:480-485`），无内存泄漏 | `/api/kline`（前端重排 [t,o,h,l,c,v]→[t,o,c,l,h,v]） | Medium |
| RC-C08 | 交易对白名单：URL 手输非白名单 symbol（如 `#/trade/XXXUSDT`） | 不产生非法下单；交易对限于 18 PAIRS，`NOT_TRADEABLE{MATICUSDT}` 标记不可交易 | #7 PAIRS 白名单 | High |

## D. 秒合约（seconds：开仓 / 倒计时 / 结算 / 历史）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-D01 | `#/seconds` 选择币种（BTC/ETH/SOL/BNB 裸币，非交易对）、时长（30/60/300/900 四档）、金额、UP/DOWN 开仓 | 调 `POST /api/seconds/order`，参数 `symbol`(裸币)、`direction`(up/down)、`duration_sec`(四档)、`amount`、`request_id`(16–100)；**客户端不传价格**（安全边界） | #10 | Critical |
| RC-D02 | 开仓后倒计时 | 本地倒计时仅展示；到期自动/手动调 `POST /api/seconds/settle`，含 `position_id`(10–40)、`request_id`、`symbol`；开仓价/结算价 100% 服务端采样（Coinbase/Bybit），前端不得自行计算盈亏 | #11 | Critical |
| RC-D03 | 结算成功后 | 仓位从 open 移到 history（`app-core.js:322-326`）；权威状态以 `GET /api/seconds/positions` 为准；`win/tie/pnl` 展示正确 | #12、状态 open→settled | High |
| RC-D04 | open / history tab 切换 | 持仓与历史列表字段齐全（position_id,symbol,direction,amount,duration_sec,open_price,settle_at,status,win,tie,pnl,settle_price） | #12 | Medium |
| RC-D05 | 限速：开仓 30 次/5min、结算 60 次/5min 触发 | 服务端 429，UI 友好提示，不崩溃 | #10/#11 限速（`core.js:1316,1349`） | Medium |
| RC-D06 | 切离 seconds 页再切回 | 倒计时定时器被 `router()` 清理，无残留定时器叠加；`GET /api/seconds/positions` 刷新 | 路由清理语义 | Medium |

## E. 订单与交易记录（orders）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-E01 | `#/orders`（桌面侧栏入口）加载 | 调 `GET /api/orders`，返回最近 50 条，字段 `order_id,symbol,side,price,quantity,remaining_quantity,status,client_order_id,created_at,updated_at`；服务端强制 `user_id` 行级过滤，前端不得传他人 uid | #9 | High |
| RC-E02 | 订单详情抽屉（drawer）+ 撤单确认 | `BTCBox.drawer` 展示详情；撤单同 RC-C04 | #8 | High |
| RC-E03 | 移动端到达 orders（经 trade 页底部 orders tab，`#/orders` 无移动端独立入口） | 移动端可正常查看/撤单，不误删 trade 页内 orders tab | N1（`FRONTEND-ARCHITECTURE.md §5.3`） | Medium |
| RC-E04 | trades（成交记录）tab | 当前数据源**未核实**（`/api/account` 无 `trades` 字段，`financial_matching_trades` 无前端读端点）；UI 改造须保持空态不报错，不得伪造成交数据 | 未核实项（`FRONTEND-DATA-MAP.md §3.1`） | Medium |

## F. 资产总览（assets：余额 / 可用 / 冻结 / 展示精度）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-F01 | `#/assets` 加载 | 调 `GET /api/account`；`balances[COIN].{free,frozen}` 展示；`total_usdt`/`totalUsdt` 估值；`valuation_available` 标志 | #6、`read_financial_account_snapshot_v1`（§2.2 #12） | High |
| RC-F02 | 精度与格式 | `fmt`/`fmtPrice`：BTC/ETH 2 位、其余 4 位；大额千分位；`-` 占位空值；`tabular`/`font-mono` 对齐 | 展示工具（`app-core.js:32-34`） | Medium |
| RC-F03 | 隐藏小额开关（`state.settings.hideSmall`，纯前端偏好不持久化） | 切换即时生效，刷新后不保留（不写后端） | 前端偏好语义（§1.5） | Low |
| RC-F04 | 有挂单/提现审核中/理财持仓时 frozen>0 | 冻结金额正确累加展示（挂单冻结+提现冻结+理财冻结），可用=free | #6、余额字段（`DATABASE-MAP.md §7.1`） | High |
| RC-F05 | 资产行点击跳转 deposit/withdraw/交易 | 跳转正确；最近订单/充值/提现/理财记录切片来自 `/api/account` | #6 | Medium |

## G. 充值（deposit：地址 / 二维码 / 网络选择 / 状态）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-G01 | `#/deposit` 选币种（默认 USDT）+ 网络（默认 TRC20） | 调 `POST /api/deposit {coin, network, amount:0}`；**amount 必须为 0**（查询地址模式），amount>0 服务端 403 | #14 | Critical |
| RC-G02 | 返回地址展示 + QR | `renderQR`（`views-assets.js:99`，qrcode-generator 本地生成）与地址文本一致；地址键格式 `COIN-NETWORK`（如 `USDT-TRC20`，`BTC-BTC` 兼容 legacy `BTC-Bitcoin`） | #14、`deposit_addresses` 键格式（§1.6） | High |
| RC-G03 | 网络与币种组合合法性 | USDT∈{TRC20,ERC20,BEP20}、BTC∈{BTC}、ETH∈{ERC20}、SOL∈{SOL}；非法组合不提交 | 网络白名单（§1.7） | High |
| RC-G04 | 充值记录列表（来自 `/api/account` 的 `deposits[]`） | 状态 pending→confirmed 展示；**前端无任何「确认充值」写接口**，入账在服务端/链/管理员侧 | #6、`deposit_records.status` 枚举（`DATABASE-MAP.md §7.2`） | High |
| RC-G05 | 充值页无金额输入框（或金额固定 0 不可改） | UI 改造不得引入 amount>0 提交入口 | #14 的 403 边界 | Critical |

## H. 提现（withdraw：地址校验 / 金额 / 手续费 / 二次确认 / 资金密码）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-H01 | `#/withdraw` 四步 stepper：金额→复核→资金密码/2FA→结果 | 步骤状态正确；币种∈{USDT,BTC,ETH,SOL}；网络白名单同 RC-G03 | #15 | High |
| RC-H02 | 地址格式按网络正则校验；金额>0；可用余额预校验 | 非法地址/超额/零额前端拦截，不发起请求 | #15、`state.balances[coin].free` | Critical |
| RC-H03 | 手续费展示（服务端硬编码，前端仅展示） | USDT 1.0、BTC 0.0001、ETH 0.001、SOL 0.01；总扣款=amount+fee；前端不得自行改费率 | 费率表（`core.js:1083`，§1.7） | High |
| RC-H04 | 资金密码（6 位数字）必填；账户启用 2FA 时 twofa_code 必填 | 表单按 `state.settings.twofa` 动态显示 2FA 输入框（`views-assets.js:234,389`）；服务端 PBKDF2/TOTP 校验 | #15、fund_password 6 位约束 | Critical |
| RC-H05 | 提交提现 | 调 `POST /api/withdraw`，`request_id`(16–80) 幂等；成功后状态 pending，余额 free→frozen（经 /api/account 刷新）；**审批仅扣冻结款，不广播链上** | #15、`create_withdrawal_atomic`（§2.2 #8） | Critical |
| RC-H06 | 幂等：同一 request_id 重复提交 | 不产生重复提现记录 | #15 幂等键 | Critical |
| RC-H07 | 提现记录列表（`/api/account` 的 `withdrawals[]`） | 状态 pending/approved/rejected（broadcast/failed 枚举存在但前端-facing 可能未见）展示正确 | #6、`withdrawal_requests.status` 枚举 | Medium |
| RC-H08 | 资金密码未设置时提现 | 引导先设置资金密码（`#/settings`），不可绕过 | #17、`fund_password_set` 字段 | High |

## I. 划转（transfer：占位提示）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-I01 | `#/transfer` 加载 | 横幅「The transfer interface is not connected... confirmation will not execute a real transfer」必须展示（`views-missing.js:182`）；仅调 `GET /api/account` 刷新余额 | T1（§1.8） | High |
| RC-I02 | 点确认按钮 | 仅弹提示框（`views-missing.js:213-230`），**不发起任何写请求**；UI 改造不得接入写接口 | 无写端点（§1.8） | Critical |

## J. 理财（earn：产品列表 / 申购 / 赎回）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-J01 | `#/earn` 产品列表 | 前端硬编码 `EARN_PRODUCTS`（`views-assets.js:405-412`）：flex_USDT/flex_BTC/flex_ETH/fixed30/fixed90/fixed180；APY/起投额/期限为展示常量；`earn_product_catalog` 表未被前端读取（未核实） | product_id 白名单（§1.10） | Medium |
| RC-J02 | 申购：选产品+金额 → 确认 | 调 `POST /api/earn {action:subscribe, amount, product_id, request_id(16–100)}`；服务端校验 product_id∈{demand,flex_USDT,flex_BTC,flex_ETH,fixed30,fixed90,fixed180}（含前端未展示的 demand）；本金 free→理财冻结 | #13、`subscribe_earn_atomic`（§2.2 #6） | Critical |
| RC-J03 | 申购成功后 | `earn_records[]` 新增持仓（active）；余额 free 减少、frozen 增加（经 /api/account 刷新）；前端不计算收益 | #13、#6、`earn_positions.status` active→redeemed/matured | High |
| RC-J04 | 赎回：持仓列表点赎回 → 确认 | 调 `POST /api/earn {action:redeem, record_id(=position_id), request_id}`；本金+收益回 free；利息由服务端/DB 策略计算 | #13、`redeem_earn_atomic`（§2.2 #7，最终 4 参自算收益） | Critical |
| RC-J05 | 申购金额预校验、幂等 | 可用余额不足前端拦截；同一 request_id 不重复申购；APY 若未来改服务端下发须新增端点，不得改现有响应结构 | #13 幂等、APY 扩展约束 | High |

## K. 我的 / 账户 / 安全（me / KYC / 改密 / 2FA / 资金密码 / 客服）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-K01 | `#/me` 中心：资料、徽章、10 个入口行；`vmHeader` 返回箭头默认回 `#/me` | 入口跳转 kyc/settings/support/fiat/cards/transfer/invite/payment 正确；占位页展示 Coming soon/空壳 | 路由（§2） | Medium |
| RC-K02 | `#/kyc` 三级认证提交（姓名+证件类型+证件号，无图片上传） | 调 `POST /api/kyc {name, id_type, id_number}`；`id_type` 默认 id_card；状态 unverified/pending/approved/rejected 展示 | #21、KYC 状态枚举（§1.1） | High |
| RC-K03 | `#/settings` 改登录密码：旧密码+新密码（+2FA 条件） | 调 `POST /api/settings/password`；**成功后清全部会话，强制重新登录** | #16、清会话语义 | Critical |
| RC-K04 | 设置资金密码：6 位数字（+当前密码/2FA 条件） | 调 `POST /api/settings/fundpwd`；成功后 `fund_password_set=true`；OAuth 账户无本地密码时强制 2FA（`fundpwd_reauth_mode`） | #17、fund_password 6 位约束 | High |
| RC-K05 | 2FA 启用：`POST /api/2fa/enable` 返回 `secret`/`otpauth_url` → 扫码 → `POST /api/2fa/confirm {code}`；禁用 `POST /api/2fa/disable {code}` | 流程完整；`twofa_enabled` 状态正确；secret 字段名不可变 | #18/#19/#20 | High |
| RC-K06 | `#/support` 客服：发消息 + 拉取最近 50 条 | `POST /api/support/chat {content}`、`GET /api/support/messages`；前端映射 `content→text`、`admin→bot`；未读数 `GET /api/chat/unread`；聊天气泡样式 `.bot-msg/.user-msg`（views.css） | 客服端点（§1.11） | Medium |
| RC-K07 | 占位页 fiat/cards/invite/payment | Coming soon 提示；cards 空壳 add 按钮禁用；不误接写接口 | 占位语义（§2） | Low |
| RC-K08 | 登出确认（同 RC-A07）+ 404 页（未知路由） | 404 展示中文「页面不存在」，提供 `#/markets`/`#/me` 链接（`views-account.js:312-320`） | 404 回退语义 | Low |

## L. Admin 后台

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-L01 | 访问 `#/admin`（或 admin.html 入口） | 未认证时 401 弹浏览器原生 HTTP Basic Auth 框（`promptAdminAuth`/`adminFetch`，独立于用户 cookie）；`admin.html` 与 `index.html` 字节一致 | Admin 认证语义（§1.12）、smoke #4 | Critical |
| RC-L02 | 四个 tab：users/deposits/withdrawals/kyc 切换 | `GET /api/admin/stats`、`/users?search=`、`/user?uid=`、`/withdrawals` 等加载；数据字段齐全 | Admin GET 端点（§1.12） | High |
| RC-L03 | 用户冻结/解冻：`POST /api/admin/user/freeze {uid,frozen,reason}` | 冻结后该用户所有写操作 403；状态正确 | #26、账户 frozen 标志 | Critical |
| RC-L04 | 管理员手动入账 `POST /api/admin/deposit/confirm`（uid,coin,amount,idempotency_key≥16）；余额调账 `POST /api/admin/user/balance`（uid,coin,delta,mode∈adjust/freeze/unfreeze,request_id≥16,reason≥5字符） | 幂等；审计日志 append-only；前端不直接写资金表 | #23、#22、`admin_manual_deposit_atomic`/`admin_adjustment_atomic`（§2.2 #10/#11） | Critical |
| RC-L05 | 提现审批：approve `POST /api/admin/withdraw/approve {id}` / reject `POST /api/admin/withdraw/reject {id,reason}` | 状态 pending→approved/rejected；重复审批返回 409 `WITHDRAWAL_ALREADY_PROCESSED`；**审批仅扣冻结款不广播链上** | #24/#25、`review_withdrawal_atomic` 幂等（§2.2 #9） | Critical |

## M. 移动端适配（断点 / 底部导航 / 安全区 / 触控目标）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-M01 | 视口 ≤768px：侧栏/顶栏隐藏，底部 5 tab 导航显示（Home/Markets/Trade/Assets/My，顺序固定） | `layouts.css:9-18` 生效；底部导航 data-route=home/markets/tradehub/assets/me；激活态高亮由 `renderSidebar`/`mobileActive` 映射 | 导航结构（`UIUX-EXECUTION-PLAN.md` 产品约束）、smoke #9 | High |
| RC-M02 | 嵌套路由（trade/seconds/orders/kline/earn→tradehub；deposit/withdraw→assets；kyc/settings/support→me）底部 tab 高亮正确 | `app-core.js:468` mobileActive 映射；高亮不错位 | 路由映射 | Medium |
| RC-M03 | 安全区：`env(safe-area-inset-bottom)` 应用于 main-content 底部 padding、mobile-nav、底部抽屉、kline-entry | iPhone 刘海/底部横条不遮挡内容；`viewport-fit=cover`（三 HTML 均含） | `layouts.css:16,28`、`overlays.css:48`、`views-trade.css` | High |
| RC-M04 | 触控目标：`.btn`/`.mob-tab` min-height 44px；输入框 font-size 16px（防 iOS 缩放） | 点击无歧义；聚焦输入不触发页面缩放 | `layouts.css:24-26` | Medium |
| RC-M05 | login/register/kline 全屏（HIDE_NAV）：无底部导航、无侧栏 | `body.hide-nav` 零边距；返回路径存在（kline 有返回按钮，login/register 为入口） | `HIDE_NAV`（`app-core.js:473`） | Medium |
| RC-M06 | 次断点：900/600/360/480/1024/340px 下 home 网格、认证卡片、订单簿字号、快捷操作网格不溢出 | 无横向滚动、无元素重叠 | `views.css:56-58`、`components.css:106-108`、`views-assets.css:154,162`、`views-trade.css:165` | Medium |

## N. 公共组件（toast / modal / drawer 不阻塞 / focus trap）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-N01 | 任意 `BTCBox.modal` 打开：Tab 键循环聚焦、Esc 关闭、点遮罩关闭、关闭后焦点恢复触发元素、body 滚动锁 | `ui-components.js:27-87` 行为完整；`role="dialog" aria-modal="true"` | smoke #8 | High |
| RC-N02 | modal 按钮 loading 态（`api.setLoading`）：异步 onClick 期间按钮禁用+spinner，防重复提交 | 资金操作确认按钮不重复触发；`is-loading` 样式 | 组件签名（§3.1） | High |
| RC-N03 | `BTCBox.drawer` 底部/右侧：Esc 关闭、遮罩点击关闭、不阻塞页面其他操作（单例 `#drawer-root`） | 抽屉打开时底层不卡死；关闭无残留 | 组件签名 | Medium |
| RC-N04 | `BTCBox.toast`/全局 `toast`：含 HTML 特殊字符的消息 | `textContent` 渲染，不解析 HTML（防 XSS）；toast 不阻塞交互 | smoke #8、`app-core.js:70` | Critical |
| RC-N05 | 资金操作结果用 modal 而非 toast（约定，`ui-components.js` 头部注释） | 下单/提现/理财/撤单结果以 modal 展示，不被 toast 短暂提示掩盖 | 组件约定 | Medium |
| RC-N06 | legacy `modal(title,bodyHTML,onMount)` 旧调用点（如登出确认） | 兼容层生效，480px 固定宽、可关闭、返回 close 函数；无「modal is not a function」 | 兼容层（`ui-components.js:124-131`） | High |

## O. 构建与测试（npm run build / npm test / dist 排除源码 / admin 字节一致）

| 编号 | 检查步骤 | 预期结果 | 不可变契约 | 等级 |
|---|---|---|---|---|
| RC-O01 | `npm run build`（`node scripts/build-site.js`） | 成功生成 `dist/`，含 `index.html`、`admin.html`、`assets/`、`oauth/`；`pages/` 空目录无害遍历；构建不报错 | 构建脚本（`FRONTEND-ARCHITECTURE.md §9.2`） | Critical |
| RC-O02 | `npm test`（`node --test tests/*.test.js`）全部通过 | **源码核实为 12 项 smoke 测试**（`tests/smoke.test.js:13-174`，非任务书所称 9 项，以实际为准）：构建产物、资源加载顺序、VIEWS 注册、admin 字节一致、无明文密钥、财务常量匹配、路由守卫、弹层语义、移动端五导航+现货白名单、令牌基线、var() 解析、OAuth 样式保留 | smoke 12 项 | Critical |
| RC-O03 | `dist/` 排除源码 | `dist/` 不含 server.py、api/core.js 源码、SQL、tests、.env.example、docs；公开文件无明文密钥（JWT/GitHub/Vercel token 前缀模式，smoke #5） | smoke #5、构建 allowlist（`build-site.js:18-31`） | Critical |
| RC-O04 | `diff dist/index.html dist/admin.html`（或源文件）字节一致 | 完全相同；任何 shell 修改必须两文件同步 | smoke #4 | Critical |
| RC-O05 | `npm run preflight`（`scripts/deployment-preflight.js`） | 环境变量形状校验通过（不打印值）；已知 F1 标志语义 mismatch 仍存在——若财务 cutover 未完成，前端资金写操作预期 503，UI 须覆盖 503 提示 | preflight（§9.4）、F1 | High |

---

## P. 高风险点专项回归（与 AI-DEPENDENCY-MAP §8 对应，必测）

| 编号 | 检查项 | 预期 | 等级 |
|---|---|---|---|
| RC-P01 | R1：`#/trade-hub` 解析（同 RC-B05，单列必测） | 不 404；修复后补 smoke 解析断言 | Critical |
| RC-P02 | C1–C4：`.va-*` 冲突——资产页 `.va-page` 不被 views-account.css 收窄为 880px；`.va-stat-grid/.va-stat/.va-field` 间距正确 | smoke #7 通过（`.va-hero .va-stat-grid` 特异性压过 account）；资产页全宽 | High |
| RC-P03 | D1：`views-missing.js` 不双重加载（Network 面板仅一次请求） | 修复后无重复抓取；NAV 不重复追加（幂等守卫仍在） | Medium |
| RC-P04 | A1：预览环境 API 指向 | 若改造期启用预览隔离，`API_BASE` 不硬编码生产；否则确认所有请求走 `https://btcboxcdt.vercel.app/api`（`app-core.js:37`），AI1/AI2 未私改后端地址 | High |
| RC-P05 | T1：划转占位横幅保留（同 RC-I01，单列必测） | 无写接口接入 | Critical |

---

## 统计与自检

- **回归检查项总数**：A(8)+B(6)+C(8)+D(6)+E(4)+F(5)+G(5)+H(8)+I(2)+J(5)+K(8)+L(5)+M(6)+N(6)+O(5)+P(5) = **92 项**（已用 `grep -cE '^\| RC-'` 逐行核实）。
- **Critical 等级项**：RC-A01/A03/A04、B03/B05、C02/C03/C04/C06/C08、D01/D02、G01/G05、H02/H04/H05/H06、I02、J02/J04、K03、L01/L03/L04/L05、N04、O01/O02/O03/O04、P01/P05（资金/认证/路由/构建类，改造后须 100% 通过方可合并）。
- **未核实项标注**：trades 数据源（RC-E04）、earn_product_catalog 接入（RC-J01）、R1 运行期确认、CDN/API 网络可达性——均按 `FRONTEND-DATA-MAP.md §3` / `FRONTEND-ARCHITECTURE.md §11` 标注，UI 改造不得伪造数据填补。
- **只读约束**：仅新建本文件与 `AI-DEPENDENCY-MAP.md`，未修改任何源码/已有文档/前三份文档。
