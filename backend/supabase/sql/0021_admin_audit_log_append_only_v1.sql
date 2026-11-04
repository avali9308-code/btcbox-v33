-- 0021_admin_audit_log_append_only_v1.sql
-- 管理员审计日志：从 btcbox_state 内可变 JSON blob 迁移到 PostgreSQL append-only 表。
-- 禁止 UPDATE/DELETE（通过 REVOKE + 触发器强制），仅允许 INSERT。
-- 若 financial_audit_log 已存在则复用（CREATE TABLE IF NOT EXISTS）。

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  action       TEXT NOT NULL,
  uid          TEXT NOT NULL DEFAULT '',
  by           TEXT NOT NULL DEFAULT 'admin',
  detail       TEXT NOT NULL DEFAULT '',
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 仅追加：禁止 UPDATE / DELETE（即使表所有者也通过触发器阻止）。
CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'financial_audit_log is append-only; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_append_only ON public.financial_audit_log;
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.financial_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

-- 权限：service_role 可 INSERT/SELECT；anon/认证角色仅禁止写入。
REVOKE ALL ON public.financial_audit_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.financial_audit_log TO service_role;
GRANT USAGE ON SEQUENCE public.financial_audit_log_id_seq TO service_role;

CREATE INDEX IF NOT EXISTS idx_financial_audit_log_action ON public.financial_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_uid ON public.financial_audit_log (uid);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_created_at ON public.financial_audit_log (created_at DESC);

-- 追加写入 RPC（service_role only）。Node 后端 auditAdmin() 调用此函数，失败时回退 JSON blob 并告警。
CREATE OR REPLACE FUNCTION public.append_admin_audit_log(
  p_action TEXT, p_uid TEXT DEFAULT '', p_by TEXT DEFAULT 'admin',
  p_detail TEXT DEFAULT '', p_meta JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.financial_audit_log (action, uid, by, detail, meta)
  VALUES (p_action, p_uid, p_by, p_detail, p_meta);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.append_admin_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_admin_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
