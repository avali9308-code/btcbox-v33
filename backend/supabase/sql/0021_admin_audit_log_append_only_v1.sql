-- 0021_admin_audit_log_append_only_v1.sql
-- Enforce append-only behavior on the canonical audit table created by 0002.
-- Do not create a parallel audit schema: all financial RPCs write the 0002 column contract.

DO $$
BEGIN
  IF to_regclass('public.financial_audit_log') IS NULL THEN
    RAISE EXCEPTION 'canonical public.financial_audit_log from migration 0002 is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_audit_log'
      AND column_name = 'actor_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_audit_log'
      AND column_name = 'subject_user_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_audit_log'
      AND column_name = 'metadata'
  ) THEN
    RAISE EXCEPTION 'financial_audit_log does not match the canonical 0002 schema';
  END IF;
END;
$$;

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

-- Prevent mutation through the table API and keep the backend service role append-only.
REVOKE ALL ON TABLE public.financial_audit_log FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.financial_audit_log FROM service_role;
GRANT SELECT, INSERT ON TABLE public.financial_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.financial_audit_log_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'financial_audit_log is append-only; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_append_only ON public.financial_audit_log;
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.financial_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_append_only_truncate ON public.financial_audit_log;
CREATE TRIGGER audit_log_append_only_truncate
  BEFORE TRUNCATE ON public.financial_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_audit_log_mutation();

REVOKE ALL ON FUNCTION public.block_audit_log_mutation() FROM PUBLIC, anon, authenticated;

-- Preserve the existing Node API arguments while mapping them into the canonical 0002 columns.
-- SECURITY INVOKER is intentional: service_role has INSERT privilege; no privilege escalation is needed.
CREATE OR REPLACE FUNCTION public.append_admin_audit_log(
  p_action TEXT, p_uid TEXT DEFAULT '', p_by TEXT DEFAULT 'admin',
  p_detail TEXT DEFAULT '', p_meta JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid text := nullif(left(btrim(coalesce(p_uid, '')), 128), '');
  v_actor text := left(coalesce(nullif(btrim(p_by), ''), 'admin'), 128);
BEGIN
  IF coalesce(btrim(p_action), '') = ''
     OR (p_meta IS NOT NULL AND jsonb_typeof(p_meta) <> 'object') THEN
    RAISE EXCEPTION 'invalid admin audit log payload';
  END IF;

  INSERT INTO public.financial_audit_log (
    actor_id, subject_user_id, action, object_type, object_id, reason, metadata
  ) VALUES (
    v_actor, v_uid, left(btrim(p_action), 100), 'admin_action', v_uid,
    nullif(left(btrim(coalesce(p_detail, '')), 300), ''),
    coalesce(p_meta, '{}'::jsonb)
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.append_admin_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_admin_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB)
  TO service_role;
