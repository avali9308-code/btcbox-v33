# 备份与回滚手册

## 1. 数据库备份（pg_dump）
```bash
# 全量备份（含 schema + 数据），生产执行前先确认连接为只读副本或低峰期
pg_dump "$DATABASE_URL" --format=custom --file=btcbox-backup-$(date +%Y%m%d-%H%M).dump \
  --no-owner --no-privileges

# 仅 schema（迁移回滚参考）
pg_dump "$DATABASE_URL" --schema-only --file=btcbox-schema-$(date +%Y%m%d).sql

# 关键表单独备份（资金相关）
pg_dump "$DATABASE_URL" -t financial_ledger_entries -t user_balances -t withdrawals \
  -t btcbox_state --data-only --file=btcbox-financial-$(date +%Y%m%d).sql
```
备份文件加密存储（GPG），保留至少 30 天；每次发布前必须执行一次。

## 2. Vercel 回滚步骤
1. 登录 Vercel Dashboard → 项目 → Deployments。
2. 找到上一个稳定部署（绿色 Ready），点击右上角 `⋯` → **Redeploy**。
3. 勾选 "Use existing Build Cache" 可加速；确认回滚目标环境（Production）。
4. 回滚后立即验证：`/api/healthz`、`/api/auth-health`、登录、充值页地址展示。
5. 若回滚涉及环境变量变更，需在 Settings → Environment Variables 同步回退并再次 Redeploy。

## 3. Git tag 流程
```bash
# 发布前打 tag（在主分支，合并后）
git tag -a v1.0.0-rc1 -m "Release candidate 1: phase2 security fixes"
git push origin v1.0.0-rc1

# 回滚到指定 tag
git checkout v1.0.0-rc1
# 或基于 tag 创建 hotfix 分支
git checkout -b hotfix/rollback-v1.0.0-rc1 v1.0.0-rc1
```
约定：`v<major>.<minor>.<patch>[-rcN]`；每个生产部署对应一个 tag，tag message 记录迁移版本与备份文件名。

## 4. 数据库迁移回滚
- 所有迁移为前向（up-only），回滚需从备份恢复：`pg_restore -d "$DATABASE_URL" btcbox-backup-xxx.dump`。
- 回滚前先 `scripts/check_migration_status.py` 记录已应用版本。
- 资金表回滚后必须执行 `scripts/reconcile_balances.py` 确认余额=账本轧差一致。

## 5. 紧急熔断
- 将 `FINANCIAL_POSTGRES_RPC_ENABLED`、`FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED` 置 0 并 Redeploy，可立即停止所有资金写入（提现/充值上账返回 503，余额不变）。
- 管理员可在后台冻结涉事账户（`user.frozen=true`）。
