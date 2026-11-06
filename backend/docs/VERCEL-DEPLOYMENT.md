# Vercel 部署指南（BTCBOX 后端 + 前端）

## 构建与输出
- **构建命令**: `npm run build && npm test`
- **输出目录**: `dist`（由 `scripts/build-site.js` 生成）
- **API 函数**: `api/[...path].js`（catch-all，共享 `api-adapter.js` → `api-core.js`）+ `api/healthz.js`
- **Node 版本**: 22.x（见 `package.json` engines）

## 环境变量清单（Vercel Project Settings → Environment Variables）
### 必填
| 变量 | 说明 |
| --- | --- |
| `CONTEXT` | 必须设为 `production`（默认即 production，dev 需显式设置） |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key（服务端专用，绝不暴露前端） |
| `SUPABASE_AUTH_URL` | 同 SUPABASE_URL（Auth endpoint） |
| `SUPABASE_AUTH_PUBLISHABLE_KEY` | 前端用 publishable/anon key（格式 `sb_publishable_` 或 `eyJ` 开头，无空格换行） |
| `SUPABASE_AUTH_ANON_KEY` | 同上（兼容旧变量名） |
| `ADMIN_USER` / `ADMIN_PASS` | 管理后台 Basic Auth；`ADMIN_PASS` ≥12 位含大小写+数字+符号，弱密码拒绝启动 |

### 充值地址（fail-closed：缺失则该币种显示"维护中"，绝不回退硬编码）
| 变量 | 格式 | 备注 |
| --- | --- | --- |
| `DEPOSIT_BTC` | `bc1p...`（Taproot）或 Legacy/P2SH | |
| `DEPOSIT_ETH` | `0x` 40 hex | 与 USDT-ERC20/USDC 同地址 |
| `DEPOSIT_USDC_ERC20` | `0x` 40 hex | 与 ETH 同地址 |
| `DEPOSIT_USDT_TRC20` | `T` 开头 TRON base58 | |
| `DEPOSIT_USDT_ERC20` | `0x` 40 hex | 可选 |
| `DEPOSIT_USDT_BEP20` | `0x` 40 hex | 可选 |
| `DEPOSIT_SOL` | Solana base58 | ⚠️ 链归属请运营确认（用户标注 SOLO） |
| `DEPOSIT_BNB` | `0x` 40 hex | ⚠️ 链归属请运营确认（用户标注 BNA） |

### 提现安全（可选，有默认值）
- `WITHDRAWAL_LARGE_THRESHOLD_USDT`（默认 1000）：超过此 USDT 等值强制人工审核
- `WITHDRAWAL_ADDRESS_COOLDOWN_HOURS`（默认 24）：新绑定地址冷却期

### 资金开关（生产切流前必须保持 0，验收后显式置 1）
- `FINANCIAL_POSTGRES_RPC_ENABLED=0`
- `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=0`
- `FINANCIAL_POSTGRES_READS_ENABLED=0`
- `FINANCIAL_MATCHING_ENGINE_ENABLED=0`

### CORS
- `CORS_ALLOWED_ORIGINS` 默认仅 `https://btcboxcdt.vercel.app`；localhost 仅在 `CONTEXT=dev` 时自动追加。

### 禁止开启
- `ALLOW_GOOGLE_MOCK`：生产必须为 0（且硬限制仅 `CONTEXT=dev` 时可用）。

## Supabase 集成步骤
1. 创建 Supabase 项目，记录 URL / service_role / publishable key。
2. 数据库迁移尚未完成隔离 PostgreSQL 全链验证前，不得应用到托管项目。当前完整业务 SQL 在 `supabase/sql/`；`scripts/run_migrations.sh` 仅用于本地/隔离测试，且会跳过 0017–0020 暂存/诊断文件。旧 `supabase-migration-runner.sql` 已废弃，禁止执行。
3. `supabase/migrations/` 目前只有 0024/0025 的时间戳镜像，不是空数据库初始化路径；不要把它们单独通过 Supabase CLI 推送。先解决 hosted migration history drift 并取得明确审批。
4. 用 `scripts/reconcile_balances.py` 做余额=账本轧差校验。
5. 在 Supabase Auth 启用 Google Provider（`/api/auth-health` 会探测）。
6. 轮换旧 service_role key（旧密钥在 Supabase 端停用）。
7. 确认 `btcbox_state` 表已初始化（含 `revision`、`data` 列与 `btcbox_save_state` RPC）。

## 部署后验证
- `GET /api/healthz` → `{"ok":true,"probe":"healthz"}`
- `GET /api/auth-health` → `ok:true` 且 `google_enabled:true`
- `GET /api/config` → `supabase_auth_publishable_key` 非空且无空白字符
- 充值页：未配置地址的币种显示"维护中"
