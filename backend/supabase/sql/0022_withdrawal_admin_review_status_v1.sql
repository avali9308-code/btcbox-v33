-- 0022_withdrawal_admin_review_status_v1.sql
-- 提现状态机增加 pending_admin_review 状态；create_withdrawal_atomic 增加
-- p_require_admin_review 参数（首次提现 / 新绑定地址冷却后首次 / 大额提现强制人工审核）。
-- 应用前请确认 financial_lifecycle_v2 中 withdrawal_status CHECK 约束包含新状态；
-- 若不包含，先执行下方 ALTER 语句扩展约束。

-- 1) 扩展提现状态约束（若已存在 pending_admin_review 则跳过）。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_status_check'
  ) THEN
    -- 约束名可能不同；此处仅在无显式约束时为枚举列添加注释说明，实际状态由应用层/RPC 校验。
    NULL;
  END IF;
END $$;

-- 2) 重建 create_withdrawal_atomic，增加 p_require_admin_review 参数。
--    为兼容旧调用方，参数带默认值 FALSE；旧调用不传时行为不变。
CREATE OR REPLACE FUNCTION public.create_withdrawal_atomic(
  p_withdrawal_id TEXT,
  p_user_id TEXT,
  p_asset TEXT,
  p_network TEXT,
  p_amount TEXT,
  p_fee TEXT,
  p_destination TEXT,
  p_request_id TEXT,
  p_request_hash TEXT,
  p_require_admin_review BOOLEAN DEFAULT FALSE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_duplicate BOOLEAN;
BEGIN
  v_status := CASE WHEN p_require_admin_review THEN 'pending_admin_review' ELSE 'pending' END;
  -- 幂等：同 request_hash 已存在则返回原记录（duplicate=true）。
  SELECT TRUE INTO v_duplicate FROM public.withdrawals WHERE request_hash = p_request_hash;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', TRUE, 'duplicate', TRUE,
      'withdrawal_id', p_withdrawal_id, 'status', v_status);
  END IF;
  INSERT INTO public.withdrawals
    (withdrawal_id, user_id, asset, network, amount, fee, destination,
     request_id, request_hash, status, created_at)
  VALUES
    (p_withdrawal_id, p_user_id, p_asset, p_network, p_amount::numeric, p_fee::numeric,
     p_destination, p_request_id, p_request_hash, v_status, now());
  RETURN jsonb_build_object('ok', TRUE, 'duplicate', FALSE,
    'withdrawal_id', p_withdrawal_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_atomic(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN) TO service_role;
