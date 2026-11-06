#!/usr/bin/env bash
# 按编号顺序应用 supabase/sql/*.sql 迁移到本地/测试 PostgreSQL。
# 用法: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/btcbox ./scripts/run_migrations.sh
# 仅用于本地测试环境（docker-compose），切勿指向生产数据库。
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$DIR/../supabase/sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[FAIL] 请设置 DATABASE_URL（仅本地测试环境，禁止指向生产）。" >&2
  exit 2
fi

echo "[info] 将按编号顺序应用 operational migrations 到 $DATABASE_URL"
for f in $(ls "$SQL_DIR"/[0-9][0-9][0-9][0-9]_*.sql | sort); do
  case "$(basename "$f")" in
    0017_financial_migration_staging_v5.sql|\\
    0018_financial_migration_staging_reconciliation_v6.sql|\\
    0019_financial_migration_reconciliation_v4.sql|\\
    0020_financial_ledger_reconciliation_v1.sql)
      echo "[skip] staging/reconciliation only: $(basename "$f")"
      continue
      ;;
  esac
  echo "[apply] $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo "[OK] operational migrations applied; staging/reconciliation scripts were skipped."
