#!/usr/bin/env python3
"""余额=账本轧差校验封装脚本。

执行 scripts/reconcile_balances.sql，输出不一致行；返回码 0=对账通过，1=存在差异，2=执行错误。
用法: DATABASE_URL=postgresql://... python3 scripts/reconcile_balances.py
"""
import os
import subprocess
import sys
from pathlib import Path

SQL_FILE = Path(__file__).resolve().parent / "reconcile_balances.sql"


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("[FAIL] 请设置 DATABASE_URL 环境变量。", file=sys.stderr)
        return 2
    if not SQL_FILE.exists():
        print(f"[FAIL] 找不到 {SQL_FILE}", file=sys.stderr)
        return 2

    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-A", "-F", "\t", "-f", str(SQL_FILE)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except FileNotFoundError:
        print("[FAIL] 未找到 psql 命令，请安装 PostgreSQL 客户端。", file=sys.stderr)
        return 2
    except subprocess.TimeoutExpired:
        print("[FAIL] 对账查询超时。", file=sys.stderr)
        return 2

    if result.returncode != 0:
        print("[FAIL] psql 执行失败:", result.stderr, file=sys.stderr)
        return 2

    out = result.stdout.strip()
    # 输出含表头行（user_id asset balance_recorded balance_from_ledger discrepancy）
    lines = [ln for ln in out.splitlines() if ln.strip() and not ln.startswith("(")]
    data_lines = [ln for ln in lines if not ln.startswith("user_id")]
    if not data_lines:
        print("[OK] 余额与账本轧差一致，无差异。")
        return 0
    print(f"[FAIL] 发现 {len(data_lines)} 条余额差异：")
    print(out)
    return 1


if __name__ == "__main__":
    sys.exit(main())
