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

echo "[info] 将按编号顺序应用 $SQL_DIR 下的迁移到 $DATABASE_URL"
for f in $(ls "$SQL_DIR"/[0-9][0-9][0-9][0-9]_*.sql | sort); do
  echo "[apply] $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo "[OK] 全部迁移应用完成。"
