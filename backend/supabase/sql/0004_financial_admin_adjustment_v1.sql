-- BTCBOX Round 75: idempotent admin adjustments and deposit txid uniqueness.
-- Apply to a disposable/staging Supabase project only after running the preflight query below.
-- This migration deliberately refuses to proceed if legacy deposit records contain duplicate non-empty txids.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.deposit_records
    WHERE txid IS NOT NULL AND btrim(txid) <> ''
    GROUP BY lower(btrim(txid)), lower(asset), lower(network)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate deposit txids found; reconcile duplicates before Round 75 migration';
  END IF;
END;
$$;

-- Prevent one on-chain transaction from being credited twice for the same asset/network.
CREATE UNIQUE INDEX IF NOT EXISTS deposit_records_txid_asset_network_uq
  ON public.deposit_records (lower(btrim(txid)), lower(asset), lower(network))
  WHERE txid IS NOT NULL AND btrim(txid) <> '';

-- Once confirmed, immutable identifying and amount fields cannot be edited to disguise a credit.
CREATE OR REPLACE FUNCTION public.guard_confirmed_deposit_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'confirmed' AND (
       NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.asset IS DISTINCT FROM OLD.asset
    OR NEW.network IS DISTINCT FROM OLD.network
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.txid IS DISTINCT FROM OLD.txid
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
  ) THEN
    RAISE EXCEPTION 'confirmed deposit financial fields are immutable';
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
    RAISE EXCEPTION 'confirmed deposit status cannot be reversed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deposit_confirmed_immutable_guard ON public.deposit_records;
CREATE TRIGGER deposit_confirmed_immutable_guard
BEFORE UPDATE ON public.deposit_records
FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_deposit_immutable();

CREATE OR REPLACE FUNCTION public.admin_adjustment_atomic(
  p_request_id text,
  p_admin_id text,
  p_user_id text,
  p_asset text,
  p_available_delta numeric,
  p_frozen_delta numeric,
  p_reason text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_existing public.financial_operations%rowtype;
  v_hash text;
BEGIN
  IF length(coalesce(p_request_id, '')) < 16 OR length(coalesce(p_request_id, '')) > 100
     OR length(coalesce(p_admin_id, '')) = 0
     OR length(coalesce(p_user_id, '')) = 0
     OR coalesce(p_asset, '') !~ '^[A-Z0-9]{2,16}$'
     OR p_available_delta IS NULL OR p_frozen_delta IS NULL
     OR (p_available_delta = 0 AND p_frozen_delta = 0)
     OR length(btrim(coalesce(p_reason, ''))) < 5
     OR length(coalesce(p_request_hash, '')) < 16 THEN
    RAISE EXCEPTION 'invalid admin adjustment request';
  END IF;

  v_hash := encode(extensions.digest(
    concat_ws('|', p_admin_id, p_user_id, p_asset, p_available_delta::text, p_frozen_delta::text, left(btrim(p_reason), 500)),
    'sha256'
  ), 'hex');
  IF p_request_hash <> v_hash THEN
    RAISE EXCEPTION 'request hash does not match adjustment payload';
  END IF;

  SELECT * INTO v_existing
    FROM public.financial_operations
    WHERE idempotency_key = 'admin-adjust:' || p_request_id
    FOR UPDATE;
  IF FOUND THEN
    IF v_existing.user_id <> p_user_id OR v_existing.asset <> p_asset
       OR v_existing.operation_type <> 'admin_adjustment' OR v_existing.request_hash <> v_hash THEN
      RAISE EXCEPTION 'idempotency key payload mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE operation_id = v_existing.id) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'operation_id', v_existing.id);
    END IF;
  END IF;

  v_result := public.apply_financial_operation(
    'admin-adjust:' || p_request_id,
    p_user_id,
    p_asset,
    'admin_adjustment',
    p_available_delta,
    p_frozen_delta,
    v_hash,
    jsonb_build_object('admin_id', p_admin_id, 'reason', left(btrim(p_reason), 500))
  );

  IF coalesce((v_result->>'duplicate')::boolean, false) THEN
    RETURN v_result;
  END IF;

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    p_admin_id, p_user_id, 'admin_balance_adjustment', 'financial_operation',
    v_result->>'operation_id', left(btrim(p_reason), 500),
    jsonb_build_object('asset', p_asset, 'available_delta', p_available_delta, 'frozen_delta', p_frozen_delta,
                       'operation_id', v_result->>'operation_id')
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_confirmed_deposit_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_adjustment_atomic(text,text,text,text,numeric,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjustment_atomic(text,text,text,text,numeric,numeric,text,text) TO service_role;

-- Preflight helper (run separately before applying migration):
-- SELECT lower(btrim(txid)) AS txid, lower(asset) AS asset, lower(network) AS network, count(*)
-- FROM public.deposit_records WHERE txid IS NOT NULL AND btrim(txid) <> ''
-- GROUP BY 1,2,3 HAVING count(*) > 1;
