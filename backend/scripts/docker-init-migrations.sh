#!/usr/bin/env bash
# docker-entrypoint-initdb.d 钩子：首次初始化时按编号顺序应用迁移。
set -euo pipefail
MIG_DIR="/docker-entrypoint-initdb.d/migrations"
if [ -d "$MIG_DIR" ]; then
  for f in $(ls "$MIG_DIR"/[0-9][0-9][0-9][0-9]_*.sql 2>/dev/null | sort); do
    echo "[docker-init] applying $(basename "$f")"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
  done
fi
