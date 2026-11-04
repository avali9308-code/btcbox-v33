# BTCBOX 部署指南
> 架构：前端 SPA（`index.html` + `assets/`，构建产物 `dist/`）+ 后端 Vercel Node Functions（`api/[...path].js` → `api/core.js`）+ Supabase PostgreSQL（资金账本 RPC）。
> 生产站点：`https://btcboxcdt.vercel.app` ｜ Supabase 项目：`https://zlozsutefnmgwwzrlipt.supabase.co`
> 路由：`vercel.json` 中 `/api/*` 由 Functions 处理；`/auth/callback`、`/admin`、`/oauth/consent` 有显式 rewrite；其余路径由 SPA catch-all 落到 `dist/index.html`（hash 路由）。
---
## ⚠️ 资金写入开关（默认开启，`=0` 为紧急 kill-switch）
资金写入类接口（提现/下单/撤单/理财/秒合约/admin 资金调整）**默认启用**，前提是 Supabase 已配置（`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`）。四个 `FINANCIAL_*` 开关未设置或值非 `0` 时均为开；紧急情况下将任一开关显式设为 `0` 即可立即关停对应路径（返回 503，余额不变）。所有资金 RPC 仅 `service_role` 可调用，浏览器无法直连。
---
## 步骤①：Supabase 数据库迁移（只需执行一次）
1. 打开 https://supabase.com/dashboard → 项目 **zlozsutefnmgwwzrlipt** → **SQL Editor** → **New query**。
2. 复制本仓库 `supabase-migration-runner.sql`（已按依赖顺序合并全部迁移）全文粘贴，点 **Run**。
3. 成功即完成。若报 `relation/function already exists` 可忽略（已存在）；其他错误先 `DROP FUNCTION IF EXISTS ... CASCADE;` 再重跑。
> 原始分散迁移在 `supabase/sql/`，执行顺序见 `supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md`。
---
## 步骤②：本地构建与预检
```bash
npm install
npm run build        # = node scripts/build-site.js，产物输出到 dist/（index.html + admin.html + assets/ + oauth/）
npm run preflight    # = node scripts/deployment-preflight.js，部署前环境/配置自检；建议接入 CI buildCommand
npm test             # = node --test tests/*.test.js，必须 7/7 通过
```
构建产物 `dist/` 必须与源码一起提交（Vercel `outputDirectory=dist`）。`scripts/build-site.js` 为 allowlist 拷贝，不会夹带源码/SQL/测试。
---
## 步骤③：Vercel 部署与环境变量
1. 导入仓库到 Vercel，框架预设选 **Other**，Build Command 已由 `vercel.json` 设为 `npm run build && npm test`，Output Directory 为 `dist`。
2. 项目 **Settings → Environment Variables**（Production）添加：

| 变量名 | 值/示例 | 说明 |
|---|---|---|
| `SUPABASE_URL` | `https://zlozsutefnmgwwzrlipt.supabase.co` | 必填 |
| `SUPABASE_SERVICE_ROLE_KEY` | （service_role 密钥，Dashboard → Settings → API） | **必填/密钥**，资金写入用，绝不泄露到前端 |
| `SUPABASE_AUTH_URL` | 同 `SUPABASE_URL` | 可省略（回退 SUPABASE_URL） |
| `SUPABASE_AUTH_PUBLISHABLE_KEY` | `sb_publishable_akou5AFUEGJRFW4mcm3jKw_D-QFGvsN` | 公开 publishable/anon key |
| `SUPABASE_AUTH_ANON_KEY` | 同上 | 可省略（回退 publishable key） |
| `FINANCIAL_POSTGRES_RPC_ENABLED` | 默认开 | 设为 `0` 紧急关停资金写入 RPC（kill-switch） |
| `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED` | 默认开 | 设为 `0` 紧急关停资金写入（kill-switch） |
| `FINANCIAL_POSTGRES_READS_ENABLED` | 默认开 | 设为 `0` 回退到 legacy JSON 读（资金写入随之关停） |
| `FINANCIAL_MATCHING_ENGINE_ENABLED` | 默认开 | 设为 `0` 关停撮合引擎/下单（订单读回退 legacy） |
| `CORS_ALLOWED_ORIGINS` | `https://btcboxcdt.vercel.app,http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000` | 跨域允许来源（逗号分隔）；不在列表的 Origin 不回显 ACAO |
| `CONTEXT` | `production` | 生产设 production（session cookie 加 Secure）；本地 dev 用 dev |
| `ADMIN_USER` / `ADMIN_PASS` | （强账号/强密码） | admin HTTP Basic Auth，**必须修改默认值** |
| `DEPOSIT_*`（USDT_TRC20/ERC20/BEP20、BTC、ETH、SOL） | 真实充币地址 | 充值页显示用；留空则对应网络充值地址返回 503 |

3. 保存后 **Redeploy** 使环境变量生效。本地开发：复制 `.env.example` 为 `.env` 填入同样值。
---
## 步骤④：管理员密码（必须修改默认值）
`server.py`（本地/备用 Python 层）与 Vercel admin 端点共用 `ADMIN_USER` / `ADMIN_PASS` 环境变量，默认 `feiji` / `feiji123456` 是弱口令，**生产必须覆盖**。admin 入口：`/admin`（SPA 内 `#/admin`），首次进入走 HTTP Basic Auth 弹窗。
---
## 步骤⑤：部署后验证清单
- [ ] `GET /api/auth-health` 返回 `auth_environment_configured:true`、`google_enabled` 非 null
- [ ] `GET /api/config` 返回 `supabase_auth_url` + publishable key
- [ ] 注册 → 登录 → 行情页显示真实价格（Coinbase/Bybit，非合成数据）
- [ ] K线/深度盘口加载正常
- [ ] 资金写入接口在 Supabase 已配置时可用；将任一 `FINANCIAL_*` 设为 `0` 后返回 503（kill-switch 验证）
- [ ] `/admin` Basic Auth 弹窗，输入正确凭证可见统计
- [ ] 深链（如直接访问 `/trade`、`/withdraw`）由 SPA catch-all 落到 index.html，不再 404
---
## 本地开发
```bash
npm install
npm run build
# Python 兼容层（仅本地 UI 调试，资金写已永久停用；生产必须用 Vercel + Supabase）
python3 server.py 8090
```
---
## 仓库结构
| 路径 | 说明 |
|---|---|
| `index.html` / `admin.html` | SPA 入口（构建后进入 `dist/`） |
| `assets/` | 模块化 JS/CSS（`app-core.js` apiAdapter + 各 view） |
| `api/core.js` + `api/[...path].js` | Vercel Node Functions 后端 |
| `server.py` | Python 兼容层（本地调试，禁止公网暴露） |
| `supabase/sql/` + `supabase-migration-runner.sql` | PostgreSQL 资金 RPC 迁移 |
| `scripts/build-site.js` | 构建脚本（allowlist 拷贝到 `dist/`） |
| `scripts/deployment-preflight.js` | 部署预检（`npm run preflight`） |
| `tests/` | 冒烟测试（`npm test`） |
| `.env.example` | 环境变量模板 |
