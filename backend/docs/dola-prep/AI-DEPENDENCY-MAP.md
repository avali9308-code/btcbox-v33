# BTCBOX 三位前端 AI 协作依赖图（AI-DEPENDENCY-MAP）

> 只读技术分析产出。分支 `docs/dola-prep`。所有归属与依赖均来自实际源码或三份前置文档（`DATABASE-MAP.md` / `FRONTEND-ARCHITECTURE.md` / `FRONTEND-DATA-MAP.md`），附 `文件:行号` 依据。无法核实处标注「未核实」。
>
> **预设分工（按实际代码细化）**
> - **AI 1（交易域）**：现货 trade/kline、秒合约 seconds、订单 orders、行情 markets/home/tradehub 中交易相关部分。
> - **AI 2（资产账户域）**：assets/deposit/withdraw/earn、me/kyc/support/settings、fiat/cards/transfer/invite/payment 占位页、登录/注册视图、admin 控制台视图。
> - **AI 3（全局与基础设施域）**：tokens/base/components/layouts/overlays/views.css、app-core.js 路由/状态/API 封装、ui-components.js、boot.js、index.html/admin.html shell、底部导航。
>
> 后端文件 `api/core.js`、`api/[...path].js`、`api/healthz.js`、`server.py`、`supabase/`、`scripts/`、`tests/` **不在三位前端 AI 改造范围内**（只读引用）；`dist/` 为构建产物不得手改。

---

## 1. 文件归属总表（9 CSS + 9 JS + 3 HTML = 21 个前端源文件）

| # | 文件 | 归属 | 依据 / 说明 |
|---:|---|---|---|
| 1 | `assets/css/tokens.css` | **共享/需协调**（AI3 主责） | 唯一设计令牌源（82 token + 别名，`DS-001-TOKEN-MAP.md`）；被全部 9 CSS + 3 HTML 的 `var()` 引用；smoke test #10/#11 强制解析 |
| 2 | `assets/css/base.css` | AI3 单负责人 | reset、表单控件、`.num`、`.scroll`、`prefers-reduced-motion`（`base.css:17-19`） |
| 3 | `assets/css/components.css` | **共享/需协调**（AI3 主责） | `.btn*/.card/.tag/.nav-item/.tab/.th/.td/.trow/.skel/.badge/.auth-*` 被全部视图使用；删改类名须全员同步 |
| 4 | `assets/css/overlays.css` | AI3 单负责人（改前通知全员） | `#toast-root/.toast/.modal-mask/.modal-box/.drawer-*/#splash/body.modal-open`；与 `ui-components.js` DOM 结构强耦合 |
| 5 | `assets/css/layouts.css` | AI3 单负责人（改前通知全员） | `#main-wrap`、侧栏/顶栏/底部导航、768px 主断点、安全区、触控目标（`layouts.css:9-30`） |
| 6 | `assets/css/views.css` | **共享/需协调**（AI3 主责） | 含 AI1 的 `.ob-row/.home-*/.trade-hub-*` 与 AI2 的 `.bot-msg/.user-msg`（客服）及全局 `.view-enter` |
| 7 | `assets/css/views-trade.css` | **AI1 单负责人** | trade/kline/seconds/orders 视图样式；由 `views-trade.js:4` 与 `views-trading.js:4` 共同注入（同 id 守卫，第二份 no-op） |
| 8 | `assets/css/views-assets.css` | **AI2 单负责人** | assets/deposit/withdraw/earn 样式；`views-assets.js:14-15` 注入；含 `.va-*` 选择器（与 views-account.css 重复，见 §8/C1） |
| 9 | `assets/css/views-account.css` | **AI2 单负责人** | kyc/support/settings/admin/404/me/fiat/cards/transfer/invite/payment 样式；`views-account.js:5-8` 与 `views-missing.js:6-8` 共同注入（同 href 守卫）；注入最晚，同等特异性下覆盖 views-assets.css 的 `.va-*` |
| 10 | `assets/js/boot.js` | AI3 单负责人（改前通知 AI2） | `boot()` 入口、Google OAuth 按钮 `applyGoogleButtons`（`boot.js:27`）、`probeAuthHealth`（`boot.js:62`）、OAuth 回跳 `sessionStorage.oauth_return_to`（`boot.js:31-36`）；登录后默认 `#/markets`（`boot.js:38`） |
| 11 | `assets/js/app-core.js` | **共享/需协调**（AI3 主责） | 路由/状态/`apiAdapter` 全部端点封装/`Auth`/`state`/`VIEWS` 占位/`NAV`/`HIDE_NAV`/行情轮询；被全员调用，是最大冲突源 |
| 12 | `assets/js/ui-components.js` | AI3 单负责人（签名冻结，改前通知全员） | `BTCBox.modal/drawer/toast` + legacy `modal()` 兼容层；133 行，见 §3 |
| 13 | `assets/js/views-home.js` | **共享/需协调**（AI1 + AI2 分段） | 5 视图：`login`(60)/`register`(107) 归 **AI2**（账户安全域，Auth 实现在 app-core.js）；`markets`(169)/`home`(213)/`tradehub`(237) 归 **AI1** |
| 14 | `assets/js/views-trade.js` | **AI1 单负责人** | `VIEWS.trade`(71)、`VIEWS.kline`(302)；`renderOrderbook`(41)、`renderRecentTrades`(65)；注入 views-trade.css |
| 15 | `assets/js/views-trading.js` | **AI1 单负责人** | `VIEWS.seconds`(10)、`VIEWS.orders`(74)；注入 views-trade.css |
| 16 | `assets/js/views-assets.js` | **AI2 单负责人** | `VIEWS.assets`(21)/`deposit`(113)/`withdraw`(196)/`earn`(413)；`renderQR`(99)；`EARN_PRODUCTS` 硬编码(405-412)；注入 views-assets.css |
| 17 | `assets/js/views-account.js` | **AI2 单负责人** | `confirmLogout`(18)、`VIEWS.kyc`(69)/`support`(129)/`settings`(172)/`admin`(229)/`404`(312)；动态注入 views-missing.js(9-12，致双重加载，见 §8/D1)；死代码 `data-route=account` 重定向(14) |
| 18 | `assets/js/views-missing.js` | **AI2 单负责人** | 向 `NAV` 追加 Account 项(12-14)、`vmHeader` 返回头(18-26)、`VIEWS.me`(45)/`fiat`(139)/`cards`(146)/`transfer`(176，占位未接线)/`invite`(237)/`payment`(244)；注入 views-account.css(6-8) |
| 19 | `index.html` | **共享/需协调**（AI3 主责） | SPA shell：CSS 链接(15-20)、JS 脚本(91-99)、侧栏(31-43)、顶栏(47-73)、`#main-content`(75)、移动端底部导航(80-86)、`#toast-root/#modal-root`(88-89)；资源加载顺序被 smoke test #2 锁定 |
| 20 | `admin.html` | **共享/需协调**（AI3 主责，必须与 index.html 字节一致） | 与 `index.html` 字节完全相同（`diff` 核实，smoke test #4 强制）；Admin 即 `#/admin` 路由（`views-account.js:229`），HTTP Basic Auth 由 `api/core.js` 强制，非 HTML 隔离 |
| 21 | `oauth/consent.html` | **共享/需协调**（AI3 shell + AI2 认证内容） | 独立 OAuth 授权页，仅加载 `tokens.css`(15) + 内联样式 + `@supabase/supabase-js`(14)，**不加载 SPA JS 包**；四阶段 loading/error/signin/consent；链接 `/#/login`(118)、`/#/settings`(140)、`/`(117,124) |

**归属统计**：AI1 单负责人 3 个；AI2 单负责人 5 个；AI3 单负责人 5 个；共享/需协调 8 个（tokens.css、components.css、views.css、app-core.js、views-home.js、index.html、admin.html、oauth/consent.html）。合计 21。

---

## 2. 单负责人文件清单（只能由一人修改，他人只读）

> 规则：以下文件的修改权专属对应 AI；其他 AI 若确需改动，必须提 issue 由负责人执行，禁止直接提交。

**AI 1（3 个）**
- `assets/js/views-trade.js` — 现货交易与 K 线视图逻辑。
- `assets/js/views-trading.js` — 秒合约与订单历史视图逻辑。
- `assets/css/views-trade.css` — 交易域样式（含移动端 K 线抽屉、订单簿、秒合约方向按钮）。

**AI 2（5 个）**
- `assets/js/views-assets.js` — 资产/充值/提现/理财视图逻辑与 `renderQR`。
- `assets/js/views-account.js` — KYC/客服/设置/Admin/404 与登出确认。
- `assets/js/views-missing.js` — 我的中心与 5 个占位页（fiat/cards/transfer/invite/payment）。
- `assets/css/views-assets.css` — 资产域样式。
- `assets/css/views-account.css` — 账户/占位页样式。

**AI 3（5 个）**
- `assets/js/boot.js` — 启动与 OAuth 初始化。
- `assets/js/ui-components.js` — 公共组件库（签名冻结，见 §3）。
- `assets/css/base.css` — 基础重置与表单。
- `assets/css/overlays.css` — 弹层/抽屉/Toast/启动屏样式。
- `assets/css/layouts.css` — 壳布局与断点。

> 注：`ui-components.js`/`overlays.css`/`layouts.css`/`boot.js` 虽为单负责人，但被全员依赖，**修改前必须在协作群通知**（见 §7 矩阵），通知不等于共享修改权。

---

## 3. 需统一接口的公共组件清单（签名必须保持稳定）

### 3.1 `ui-components.js`（`window.BTCBox` API，133 行）

| 函数 | 参数签名 | 返回 | 必须稳定的原因 |
|---|---|---|---|
| `BTCBox.modal(opts)` | `opts={title:string, content:string\|HTMLElement, buttons?:[{text, variant?:'primary'\|'danger'\|'ghost', disabled?, loading?, onClick?(close,el)}], width?:'sm'\|'md'\|'lg'\|'risk'\|number(px), closable?:bool=true, onClose?, onMount?(close,api)}`（`ui-components.js:27`） | `api={close(), setLoading(i,on), el}` | 三位 AI 全部视图用于确认框（下单/撤单/提现/登出/理财/划转占位/KYC）；smoke test #8 强制 `role="dialog" aria-modal="true"`、focus trap、焦点恢复、Esc 关闭、body 滚动锁；`width` 预设映射 `--modal-w-*` 令牌（`overlays.css:31-34`） |
| `BTCBox.drawer(opts)` | `opts={side?:'bottom'\|'right'='bottom', title, content, height?(仅 bottom, number\|css), closable?:bool=true, onClose?, onMount?(close,api)}`（`ui-components.js:90`） | `api={close(), el}` | AI1 交易对选择/订单详情/移动端 K 线抽屉；AI2 充值币种网络选择；动态创建 `#drawer-root`(88)，重复调用安全 |
| `BTCBox.toast(msg, type)` | `msg:string, type?`（`ui-components.js:121`） | 委托全局 `toast(msg,type)` | 全员使用；smoke test #8 强制 `textContent` 渲染（防 XSS，`app-core.js:70`），**不得改为 innerHTML** |
| legacy 全局 `modal(title, bodyHTML, onMount)` | 3 参，固定 480px、可关闭（`ui-components.js:124-131`） | `close` 函数 | 旧调用点在运行期解析；重赋值后所有旧调用自动走 BTCBox.modal；**不得删除该兼容层** |

### 3.2 `app-core.js` 全局工具与状态（被全员调用，签名/语义冻结）

| 标识符 | 签名 / 结构 | 稳定原因（依据） |
|---|---|---|
| `toast(msg,type='ok')` | `app-core.js:73` | 同上；`textContent` 安全渲染 |
| `modal(title,bodyHTML,onMount)` | `app-core.js:91`（被 ui-components 重赋值） | 旧调用点 |
| `skeleton(rows=6,cols=4)` / `emptyState(title,sub)` | `app-core.js:103,108` | 全部列表页加载/空态 |
| `fmt(n,d=2)` / `fmtPrice(n,base)` / `pct(n)` | `app-core.js:32-34` | 金额/价格/涨跌幅展示精度；BTC/ETH 2 位、其余 4 位 |
| `uid()` | 32 位 hex（`app-core.js:35`） | 幂等键生成；服务端强制 16–100 字符（提现 16–80），**不得缩短** |
| `delay(ms)` / `$(s)` / `$$(s)` | `app-core.js:30`；`$/$$` 见 §8.4 已核实定义 | 通用工具 |
| `state` 全局 | `{balances, orders, trades?, secondsPositions, kyc, settings{twofa,fundPwdSet,hideSmall}, supportMsgs, admin, marketUnavailable, depthCache, ...}`（`app-core.js:47`） | 全部视图读；`applyAccount`(201) 映射 `/api/account` 响应；字段名不可变（契约 #6） |
| `market` 全局 / `PAIRS`（18 交易对）/ `NOT_TRADEABLE{MATICUSDT}` | `app-core.js:40-44` | 行情与交易对白名单（契约 #7） |
| `apiAdapter` | `{register,login,login2fa,supabaseLogin,logout,account,order,orderCancel,orders,secondsOrder,secondsSettle,secondsPositions,earn,deposit,withdraw,kyc,settingsPassword,settingsFundpwd,2faEnable/Confirm/Disable,supportChat/supportMessages,admin*,...}`（`app-core.js:250`） | 全部 26 个不可变 REST 契约（FRONTEND-DATA-MAP §2.1 #1–#26）；**只许新增方法，不许改既有方法名/参数/返回结构** |
| `Auth.{init,login,register,friendlyError,showResetPassword,showForgotPassword,showRegisterSuccess,supabaseLogin}` | `app-core.js:550+` | 登录/注册/2FA/找回密码流程；登录成功后 `applyAccount` + 跳 `#/markets` |
| `startTicker()` / `refreshMarket()` / `refreshDepth()` | `app-core.js:439,238,243` | 行情 3s / 深度 2.5s 轮询；`router()` 切换时清理定时器（`app-core.js:480-485`） |
| `VIEWS` 注册表 / `NAV` / `HIDE_NAV{login,register,kline}` / `parseHash()` / `router()` / `renderSidebar(active)` | `app-core.js:509,448,473,474,479,463` | 路由机制；`views-*.js` 覆盖占位键；**不得删除占位键或改 `HIDE_NAV` 语义** |
| `promptAdminAuth()` / `adminFetch` | `app-core.js:180` 附近 | Admin HTTP Basic Auth，独立于用户 cookie |

### 3.3 `components.css` 稳定类名（表单/按钮组件选择器不可改名）
`.btn-primary/.btn-green/.btn-red/.btn-danger/.btn-ghost/.btn-block/.btn-sm/.btn-google/.is-loading/.spinner`、`.card/.raised`、`.tag`、`.nav-item`、`.tab`、`.th/.td/.trow`、`.skel`、`.badge*`、`.auth-stage/.auth-brand/.auth-panel/.auth-card/.auth-input/.auth-field/.auth-title/.auth-sub/.auth-link/.auth-legal/.auth-terms/.pwd-toggle`、`.input-error/.field-error/.field-hint`、`.page-title/.page-sub/.section-title`（`components.css` 全文，`FRONTEND-ARCHITECTURE.md §4.2`）。

---

## 4. 存在共享依赖的 CSS 文件（修改影响面）

| CSS 文件 | 注入/加载方式 | 被哪些视图引用 | 修改影响的 AI | 风险等级 |
|---|---|---|---|---|
| `tokens.css` | 静态第 1（`index.html:15`） | 全部 9 CSS + 3 HTML 的 `var(--*)` | AI1/AI2/AI3 全员 | **Critical**（smoke #10/#11 强制无未定义 var、无重复 `:root`） |
| `components.css` | 静态第 3（`index.html:17`） | 全部视图的按钮/卡片/标签/表格/Tab/骨架屏/认证表单 | AI1/AI2/AI3 全员 | High |
| `overlays.css` | 静态第 4（`index.html:18`） | 全部 modal/toast/drawer/splash；`--modal-w-*` 宽预设 | AI1/AI2/AI3 全员 | High |
| `layouts.css` | 静态第 5（`index.html:19`） | 全部页面壳；768px 断点、安全区、触控目标 | AI1/AI2/AI3 全员 | High |
| `base.css` | 静态第 2（`index.html:16`） | 全部页面 reset/表单/滚动条/减动效 | 全员 | Medium |
| `views.css` | 静态第 6（`index.html:20`） | `.ob-row`(AI1 订单簿)、`.home-*/.trade-hub-*`(AI1)、`.bot-msg/.user-msg`(AI2 客服)、`.view-enter`(全员) | AI1 为主 + AI2 | Medium（AI3 主责，改前通知） |
| `views-trade.css` | 动态注入（`views-trade.js:4` + `views-trading.js:4`，同 id 守卫） | trade/kline/seconds/orders（均 AI1） | 仅 AI1（内部共享） | Low |
| `views-assets.css` | 动态注入（`views-assets.js:14-15`） | assets/deposit/withdraw/earn（均 AI2） | 仅 AI2 | Low，但 `.va-*` 与 views-account.css 冲突（见 §8/C1） |
| `views-account.css` | 动态注入（`views-account.js:5-8` + `views-missing.js:6-8`，同 href 守卫） | kyc/support/settings/admin/404/me/fiat/cards/transfer/invite/payment（均 AI2） | 仅 AI2 | Low，但注入最晚，覆盖同特异性 `.va-*` |

**注入顺序**（`FRONTEND-ARCHITECTURE.md §3.2/3.3`）：静态 6 份 → 按脚本加载顺序动态注入 `views-trade.css` → `views-assets.css` → `views-account.css`。**同等特异性下后注入者胜**，故 `.va-*` 冲突中 views-account.css 覆盖 views-assets.css。

---

## 5. 易产生合并冲突的文件清单与协作规则

| 文件 | 冲突原因 | 协作规则 |
|---|---|---|
| `index.html` + `admin.html` | 资源标签顺序被 smoke test #2 锁定；导航 href 关联全员入口；两文件必须字节一致（smoke #4） | **AI3 串行修改**；只改 `index.html`，改后立即 `cp index.html admin.html`（或由 `scripts/build-site.js` 同步）；任何 `<head>` 资源增删、导航结构变更须全员评审；禁止单独改 admin.html |
| `app-core.js` | `apiAdapter` 含全部 26 端点；`state`/`Auth`/`VIEWS`/`NAV`/`router` 被全员依赖 | **AI3 唯一可提交**；AI1/AI2 如需新增 API 封装方法，提 PR 由 AI3 合入；**严禁修改既有方法签名/返回结构**（不可变契约）；`VIEWS` 占位键只许增不许删（views-*.js 依赖覆盖） |
| `tokens.css` | 82 令牌唯一源；smoke #10 基线 fixture 精确匹配 | **AI3 唯一可提交**；新增令牌须同步 `tests/fixtures/ds001-token-baseline.json`；禁止删除/重命名既有令牌 |
| `components.css` | `.btn/.card/.tab/.auth-*` 全员使用 | **AI3 唯一可提交**；类名只许增不许删/改名；删改前 `grep` 全部 9 JS + 3 HTML 确认无引用 |
| `views-home.js` | AI1（markets/home/tradehub）与 AI2（login/register）同文件 | **按函数块串行**：AI2 工作区 `login`(60-106)/`register`(107-168)，AI1 工作区 `markets`(169-212)/`home`(213-236)/`tradehub`(237+)；禁止改动文件级 IIFE 包裹结构与跨段代码；建议各自独立提交、避免同文件并行 |
| `views.css` | AI3 主责但含 AI1/AI2 样式 | AI3 修改，改前通知 AI1（`.ob-row/.home-*/.trade-hub-*`）与 AI2（`.bot-msg/.user-msg`） |
| `ui-components.js` | 全员调用 | AI3 唯一可提交；签名冻结（§3）；任何变更须全员评审 + 回归 §N 公共组件项 |
| `overlays.css` | 与 ui-components DOM 结构耦合 | AI3 唯一可提交；与 ui-components.js 变更绑定提交 |

**通用冲突规避规则**：(a) 共享文件「一人一时」串行，用 PR 标签 `lock:<file>` 声明占用；(b) 静态资源加载顺序（CSS 6 份 + JS 9 份）被 smoke test 锁定，新增文件必须同步改 `tests/smoke.test.js` 期望；(c) `dist/` 不入库，构建产物冲突由 `npm run build` 重新生成解决。

---

## 6. 页面间功能依赖

| 依赖方（视图） | 依赖对象 | 依赖内容 | 依据 |
|---|---|---|---|
| trade / kline | `app-core.js` `state.market`、`startTicker`、`refreshDepth`、`PAIRS`、`state.balances` | 行情 3s 轮询、深度 2.5s、18 交易对白名单、下单前可用余额预校验 | `app-core.js:40,439,238,243`；`views-trade.js:117,215` |
| trade | `apiAdapter.order` / `orderCancel` / `orders` / `kline` | 下单/撤单/查单/K 线；下单成功后依赖 `/api/account` 刷新余额（前端永不直接改余额） | 契约 #7/#8/#9；`app-core.js:278,283,285,293` |
| seconds | `state.secondsPositions`、`apiAdapter.secondsOrder/secondsSettle/secondsPositions`、`router()` 定时器清理 | 开仓/结算/持仓；**客户端永不传价格**（安全边界）；切路由时清理倒计时 | 契约 #10/#11/#12；`app-core.js:309,318,329,480-485` |
| orders（含 trade 内嵌 tab） | `state.orders`、`apiAdapter.orders`、`orderCancel` | 订单列表与撤单；`#/orders` 仅桌面侧栏入口（移动端无独立入口） | `app-core.js:453`；`views-trading.js:74`；`views-trade.js:254` |
| markets / home / tradehub | `/api/market`、`updateLivePriceEls`、首页快捷入口链接 | 行情展示与跳转 `#/trade-hub`/`#/assets`/`#/deposit`/`#/me` | `app-core.js:218-235,443`；`views-home.js:220,232,237` |
| assets / deposit / withdraw / earn | `state.balances{free,frozen}`、`/api/account` 刷新 | 余额可用/冻结展示；充值查地址（amount=0）；提现本地预校验；理财申购/赎回后余额联动 | 契约 #6/#13/#14/#15；`views-assets.js:271,341,354,386,437,446` |
| earn ↔ assets 余额 | `subscribe_earn_atomic` / `redeem_earn_atomic` 原子划转 | 申购：本金 free→frozen（理财持仓）；赎回：本金+收益回 free；均依赖 `/api/account` 刷新 `earn_records[]` 与 `balances` | 契约 #13；`FRONTEND-DATA-MAP.md §1.10` |
| me / kyc / settings / support | `state.kyc`、`state.settings{twofa,fundPwdSet}`、`/api/account` | KYC 等级、2FA/资金密码开关决定提现/改密表单必填项 | 契约 #16/#17/#18/#19/#20/#21；`views-assets.js:234,389` |
| transfer（占位） | 仅 `GET /api/account` 刷新余额 | **无写端点**；确认按钮仅弹提示；横幅须保留 | `views-missing.js:182,199,213-230` |
| login / register | `Auth.*`（app-core.js, AI3）、`boot.js` Google OAuth、`router()` 守卫 | 未登录访问受保护路由→`#/login`；已登录访问 login/register→`#/markets`；OAuth 回跳 `sessionStorage.oauth_return_to` | `app-core.js:490-491,550+`；`boot.js:31-38,71` |
| admin | `adminFetch` HTTP Basic Auth（独立于用户 cookie） | 401 弹浏览器原生认证框；与用户登录态完全隔离 | `app-core.js:180`；`FRONTEND-DATA-MAP.md §1.12` |
| 全部视图 | `router()` 清理逻辑 + `HIDE_NAV` + `mobileActive` 映射 | 切路由清理秒合约定时器/ECharts 实例/resize 监听；login/register/kline 全屏隐藏导航；嵌套路由映射到底部 5 tab 高亮 | `app-core.js:468,473,480-485,492-497` |

---

## 7. 修改公共组件时需通知的开发者矩阵（组件 → 受影响 AI）

| 被修改组件 / 文件 | AI1 | AI2 | AI3 | 通知与回归要求 |
|---|:---:|:---:|:---:|---|
| `BTCBox.modal` / legacy `modal` | ✅ | ✅ | ✅ | 全员；回归全部确认框（下单/撤单/提现/登出/理财/划转/KYC）+ smoke #8 |
| `BTCBox.drawer` | ✅ | ✅ | — | AI1（交易对/订单详情/K线抽屉）、AI2（充值币种网络） |
| `BTCBox.toast` / 全局 `toast` | ✅ | ✅ | ✅ | 全员；必须保持 `textContent` 安全渲染 |
| `components.css`（.btn/.card/.tab/.auth-*/.skel/.badge） | ✅ | ✅ | ✅ | 全员；类名改名须 grep 全源码 |
| `tokens.css` | ✅ | ✅ | ✅ | 全员；同步基线 fixture；smoke #10/#11 |
| `overlays.css` | ✅ | ✅ | ✅ | 全员；与 ui-components.js 绑定 |
| `layouts.css`（断点/导航/安全区） | ✅ | ✅ | ✅ | 全员；移动端适配回归 |
| `views.css` | ✅（.ob-row/.home/.trade-hub） | ✅（chat 消息） | ✅ | 改前通知 AI1/AI2 |
| `app-core.js` `apiAdapter` 既有方法 | ✅ | ✅ | ✅ | **禁止改签名**；新增方法全员知会 |
| `app-core.js` `state` 字段 / `applyAccount` 映射 | ✅ | ✅ | ✅ | 字段名不可变（契约 #6） |
| `app-core.js` `router`/`VIEWS`/`NAV`/`HIDE_NAV` | ✅ | ✅ | ✅ | 路由变更全员回归；R1 trade-hub 修复须 AI1+AI3 协同 |
| `boot.js` OAuth / 登录后跳转 | — | ✅（login 视图） | ✅ | AI2 登录/注册回归 |
| `fmt/fmtPrice/pct/uid/skeleton/emptyState/delay` | ✅ | ✅ | ✅ | 全员；`uid` 长度不可缩短 |
| `index.html` 导航/资源标签 | ✅ | ✅ | ✅ | 全员；smoke #2/#4/#9 |
| `views-trade.css`（AI1 内部） | ✅ | — | — | 仅 AI1 |
| `views-assets.css` / `views-account.css`（AI2 内部，含 `.va-*` 冲突） | — | ✅ | — | 仅 AI2，但 `.va-*` 去重须 AI2 内部统一命名空间 |

---

## 8. 已知高风险点（必须纳入协作与回归）

| ID | 风险 | 涉及 AI | 证据 | 协作/修复建议 |
|---|---|---|---|---|
| **R1** | `#/trade-hub` 路由 404：`parseHash()` 得 `route='trade-hub'`，但 `VIEWS` 注册键是 `tradehub`（无连字符），无别名；`router()` 精确匹配 → 落 404。移动端 Trade tab（`index.html:83`）、Home 链接（`views-home.js:220,232`）全部命中 404。`mobileActive` 映射（`app-core.js:468`）只控制 tab 高亮不控制解析。smoke test #9 只断言 href 与 `VIEWS.tradehub` 存在，**不断言解析**，CI 抓不到。 | **AI3（router 加别名）+ AI1（视图键/链接）协同** | `app-core.js:474-478,501`；`views-home.js:237`；`index.html:83`；`smoke.test.js:119-125` | 发布前必修。方案二选一：AI3 在 `router()` 加 `route==='trade-hub'`→`'tradehub'` 别名，或 AI1 把 `VIEWS.tradehub` 改名并同步全部 href。修复后须加 smoke 断言解析。运行期确认**未核实**（BROWSER-01 阻塞） |
| **C1–C4** | `.va-*` 选择器在 `views-assets.css`(4,9,10,55) 与 `views-account.css`(6,55,56,~140) 重复定义；views-account.css 注入更晚 → 同等特异性下覆盖，资产页可能被收窄为 `max-width:880px`。smoke #7 专门断言 `.va-hero .va-stat-grid` 特异性须压过 account 样式——已知脆弱边界 | **AI2 内部**（两文件均 AI2） | `FRONTEND-ARCHITECTURE.md §7`；`smoke.test.js:155` | AI2 统一 `.va-` 命名空间或提升资产页选择器特异性；保持 smoke #7 通过 |
| **D1** | `views-missing.js` 双重加载：`views-account.js:9-12` 动态注入 + `index.html:98` 静态加载（执行时静态脚本尚未解析，守卫失效）。幂等（CSS/NAV/VIEWS 均有守卫）但冗余网络抓取与解析 | **AI2（views-account.js）+ AI3（index.html）协同** | `views-account.js:9-12`；`index.html:98` | 移除其一（建议删 views-account.js 动态注入行，保留静态标签）；须双方协调，避免删后另一处依赖 |
| **D2** | `views-account.js:14` 死代码：`.mob-tab[data-route=account]` 重定向，但当前导航用 `data-route="me"`（`index.html:85`），选择器匹配空 | AI2 | `views-account.js:14`；`index.html:85` | AI2 清理；低风险 |
| **N1** | `#/orders` 仅桌面侧栏入口（`app-core.js:453`），移动端无独立导航入口（移动端用户经 trade 页底部 orders tab 到达） | AI1（确认移动端可达） | `FRONTEND-ARCHITECTURE.md §5.3` | UI 改造时确认移动端订单可达性，勿误删 trade 页内 orders tab |
| **A1** | `API_BASE = 'https://btcboxcdt.vercel.app/api'` 硬编码生产域名（`app-core.js:37`）；预览部署调用生产后端 | AI3 | `app-core.js:37`；`AI-HANDOFF.md` Preview API isolation | 改造期如需预览隔离，由 AI3 统一改为环境/域名推断；AI1/AI2 不得自行硬编码其他后端地址 |
| **T1** | 划转 transfer 占位未接线：仅 `GET /api/account`，无写端点；确认按钮仅弹提示；横幅「The transfer interface is not connected...」须保留 | AI2 | `views-missing.js:176,182,199,213-230` | UI 改造不得接入任何写接口；若未来接入须新增幂等端点，不得复用其他写接口（契约预留） |
| **F1**（既有，已上报） | 财务 cutover 标志语义：`api/core.js` 视为启用除非 `==='0'`，而 `deployment-preflight.js` 仅把 `==='1'` 判为启用——未设/非 '0' 值可能运行时启用却通过预检 | 后端（前端 AI 只读） | `scripts/deployment-preflight.js:20-22`；`AI-HANDOFF.md` finding 5 | 前端不修改；改造期所有资金写操作可能返回 503（fail-closed），回归须覆盖 503 提示 |

---

## 9. 依据与限制

- **权威输入**：`docs/dola-prep/DATABASE-MAP.md`（15 表/20 RPC/RLS/状态枚举）、`FRONTEND-ARCHITECTURE.md`（24 视图/9 CSS/9 JS/路由/CSS 冲突/高风险）、`FRONTEND-DATA-MAP.md`（11 视图数据映射/26 项 REST 不可变契约）。
- **源码核实**：全部 9 CSS、9 JS、3 HTML、`ui-components.js` 全文、`app-core.js` 顶层全局清单、`tests/smoke.test.js` 12 项测试、`package.json`。
- **参考不重复**：`docs/QA-CHECKLIST.md`（浏览器执行项）、`docs/UIUX-EXECUTION-PLAN.md`（阶段与品牌约束）。
- **未核实**：浏览器运行期渲染、路由点击、控制台错误、CDN/API 网络可达性（BROWSER-01/MOBILE-01 阻塞，见 `FRONTEND-ARCHITECTURE.md §11`）；R1 运行期确认基于静态分析。
- **只读约束**：仅新建本文件与 `REGRESSION-CHECKLIST.md`，未修改任何源码/已有文档/前三份文档。
