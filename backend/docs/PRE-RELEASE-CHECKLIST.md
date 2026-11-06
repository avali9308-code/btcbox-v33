# 发布前检查清单（Pre-Release Checklist）

每次生产部署前逐项确认，全部通过方可发布。

## A. 凭证与密钥
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 已轮换，旧密钥在 Supabase 端已停用
- [ ] `SUPABASE_AUTH_PUBLISHABLE_KEY` / `ANON_KEY` 格式正确（`sb_publishable_` 或 `eyJ` 开头，无空格换行）
- [ ] `ADMIN_PASS` ≥12 位含大小写+数字+符号，非弱口令；`ADMIN_USER` 非默认
- [ ] Google OAuth Web Client ID 已配置且回调地址正确
- [ ] 代码与 `.env.example` 中无任何真实密钥/地址（均为占位符）

## B. 充值地址确认（运营签字）
- [ ] 6 个充值地址（BTC Taproot / ETH / USDC-ERC20 同地址 / USDT-TRC20 / DEPOSIT_BNB[标注BNA] / DEPOSIT_SOL[标注SOLO]）已由运营逐笔确认链归属与有效性
- [ ] `DEPOSIT_BNB`（用户标注 BNA）链归属已确认
- [ ] `DEPOSIT_SOL`（用户标注 SOLO）链归属已确认
- [ ] 缺失地址的币种在充值页正确显示"维护中"（fail-closed 验证）

## C. 测试通过
- [ ] `npm install && npm test` 全部通过（原有 60 + 新增后端测试）
- [ ] `scripts/check_migration_status.py --offline` 迁移编号连续无断档
- [ ] 本地 `docker-compose up` + `scripts/run_migrations.sh` operational migrations 全部应用成功；0017–0020 暂存/诊断 SQL 已由 runner 跳过并单独按 staging 流程执行
- [ ] `scripts/reconcile_balances.py` 对账通过（ staging 环境）
- [ ] 提现白名单拒绝、新地址冷却、首次/大额人工审核、资金密码锁定、管理员登录锁定均在 staging 验证

## D. 备份完成
- [ ] `pg_dump` 全量备份已执行并加密存储（文件名记录于 git tag message）
- [ ] 上一稳定版本 Vercel Deployment 可一键 Redeploy 回滚
- [ ] 本次部署对应 git tag 已创建并推送

## E. 开关与限流
- [ ] 资金开关（`FINANCIAL_*`）状态符合发布计划（默认全 0）
- [ ] `ALLOW_GOOGLE_MOCK=0` 且 `CONTEXT=production`
- [ ] `CORS_ALLOWED_ORIGINS` 仅含生产域名
- [ ] 管理员审计日志已写入 PG append-only 表（`financial_audit_log`），无 UPDATE/DELETE 权限

## F. 发布后冒烟
- [ ] `/api/healthz`、`/api/auth-health`、`/api/config` 正常
- [ ] 登录（Google OAuth）→ 充值页 → 提现页（白名单提示）流程正常
- [ ] 管理后台可登录，连续 5 次错误密码触发 15 分钟锁定
