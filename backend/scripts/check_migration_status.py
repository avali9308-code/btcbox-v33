#!/usr/bin/env python3
"""对比已应用迁移与 supabase/sql/ 下预期的编号迁移清单。

用法:
  DATABASE_URL=postgresql://... python3 scripts/check_migration_status.py
  或本地 docker 测试: python3 scripts/check_migration_status.py --offline

离线模式仅列出预期迁移清单并校验编号连续性，不连接数据库。
"""
import argparse
import os
import re
import sys
from pathlib import Path

SQL_DIR = Path(__file__).resolve().parent.parent / "supabase" / "sql"
MIGRATION_RE = re.compile(r"^(\d{4})_.+\.sql$")


def expected_migrations():
    """返回按编号排序的 (num, filename) 列表。"""
    items = []
    for p in SQL_DIR.glob("*.sql"):
        m = MIGRATION_RE.match(p.name)
        if m:
            items.append((int(m.group(1)), p.name))
    return sorted(items)


def applied_migrations(conn):
    """查询已应用迁移（依赖 supabase_migrations.schema_migrations 表；不存在则返回空）。"""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version")
            return {row[0] for row in cur.fetchall()}
    except Exception as e:
        print(f"[warn] 无法读取迁移记录表（{e}），将仅做离线校验。", file=sys.stderr)
        return set()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="不连接数据库，仅校验预期清单编号连续性")
    args = ap.parse_args()

    expected = expected_migrations()
    if not expected:
        print("[FAIL] 未找到任何编号迁移文件（应为 0001_xxx.sql ...）", file=sys.stderr)
        return 2

    nums = [n for n, _ in expected]
    gaps = [n for n in range(nums[0], nums[-1] + 1) if n not in nums]
    dups = [n for n in set(nums) if nums.count(n) > 1]

    print(f"预期迁移 {len(expected)} 个，编号 {nums[0]:04d}..{nums[-1]:04d}")
    for n, name in expected:
        print(f"  {n:04d}  {name}")
    if gaps:
        print(f"[FAIL] 编号断档: {gaps}", file=sys.stderr)
        return 2
    if dups:
        print(f"[FAIL] 编号重复: {dups}", file=sys.stderr)
        return 2
    print("[OK] 预期迁移编号连续无重复。")

    if args.offline or not os.environ.get("DATABASE_URL"):
        print("[info] 离线模式或未设置 DATABASE_URL，跳过已应用对比。")
        return 0

    try:
        import psycopg2
    except ImportError:
        print("[warn] 未安装 psycopg2，跳过数据库对比。pip install psycopg2-binary", file=sys.stderr)
        return 0

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    applied = applied_migrations(conn)
    conn.close()

    missing = [f"{n:04d}" for n, _ in expected if f"{n:04d}" not in applied]
    if missing:
        print(f"[FAIL] 以下迁移未应用: {missing}", file=sys.stderr)
        return 1
    print("[OK] 全部预期迁移已应用。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
