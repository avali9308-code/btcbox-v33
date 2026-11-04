-- scripts/reconcile_balances.sql
-- 余额=账本轧差校验：每个用户每个资产的期末余额（ledger 轧差）必须与 balances 表一致。
-- 用法: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/reconcile_balances.sql
-- 返回所有不一致的行；无行返回即对账通过。

WITH ledger_rollup AS (
  SELECT
    user_id,
    asset,
    SUM(CASE WHEN direction = 'debit' THEN -amount ELSE amount END) AS net_amount
  FROM public.financial_ledger_entries
  WHERE status = 'posted'
  GROUP BY user_id, asset
)
SELECT
  b.user_id,
  b.asset,
  b.free + b.frozen AS balance_recorded,
  COALESCE(l.net_amount, 0) AS balance_from_ledger,
  (b.free + b.frozen) - COALESCE(l.net_amount, 0) AS discrepancy
FROM public.user_balances b
LEFT JOIN ledger_rollup l ON l.user_id = b.user_id AND l.asset = b.asset
WHERE ABS((b.free + b.frozen) - COALESCE(l.net_amount, 0)) > 0.00000001
ORDER BY ABS((b.free + b.frozen) - COALESCE(l.net_amount, 0)) DESC;
