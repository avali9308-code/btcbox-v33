-- BTCBOX Round 76: only a trusted chain-verification service may credit deposits.
-- Apply after financial_ledger_v1.sql, financial_lifecycle_v2.sql and
-- financial_admin_adjustment_v1.sql in a disposable staging database first.
-- The verifier must independently prove tx inclusion, destination, asset/network,
-- finality and observed amount before calling this RPC.

ALTER TABLE public.deposit_records
  ADD COLUMN IF NOT EXISTS chain_observed_amount numeric(38,18),
  ADD COLUMN IF NOT EXISTS chain_confirmations integer,
  ADD COLUMN IF NOT EXISTS chain_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS chain_verifier_id text;

CREATE OR REPLACE FUNCTION public.verify_and_credit_deposit_atomic(
  p_deposit_id text,
  p_verifier_id text,
  p_txid text,
  p_asset text,
  p_network text,
  p_observed_amount numeric(38,18),
  p_confirmations integer,
  p_required_confirmations integer,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_d public.deposit_records%rowtype;
  v_result jsonb;
  v_hash text;
  v_op_id uuid;
BEGIN
  IF coalesce(p_deposit_id,'') = '' OR coalesce(p_verifier_id,'') = ''
     OR length(btrim(coalesce(p_txid,''))) < 16
     OR coalesce(p_asset,'') !~ '^[A-Z0-9]{2,16}$'
     OR coalesce(p_network,'') = ''
     OR p_observed_amount IS NULL OR p_observed_amount <= 0
     OR p_confirmations IS NULL OR p_confirmations < 0
     OR p_required_confirmations IS NULL OR p_required_confirmations < 1
     OR p_confirmations < p_required_confirmations
     OR length(coalesce(p_request_id,'')) < 16 OR length(coalesce(p_request_id,'')) > 100
     OR length(coalesce(p_request_hash,'')) < 16 THEN
    RAISE EXCEPTION 'invalid or insufficiently confirmed chain observation';
  END IF;

  v_hash := encode(extensions.digest(
    concat_ws('|', p_deposit_id, lower(btrim(p_txid)), upper(p_asset), lower(p_network),
      p_observed_amount::text, p_confirmations::text, p_required_confirmations::text),
    'sha256'), 'hex');
  IF p_request_hash <> v_hash THEN
    RAISE EXCEPTION 'chain observation request hash mismatch';
  END IF;

  SELECT * INTO v_d FROM public.deposit_records WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not found'; END IF;

  IF v_d.status = 'confirmed' THEN
    IF lower(coalesce(v_d.txid,'')) = lower(btrim(p_txid))
       AND upper(v_d.asset) = upper(p_asset)
       AND lower(v_d.network) = lower(p_network)
       AND v_d.chain_observed_amount = p_observed_amount THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'deposit_id',v_d.id,'status',v_d.status,
        'operation_id',v_d.credit_operation_id);
    END IF;
    RAISE EXCEPTION 'confirmed deposit does not match chain observation';
  END IF;
  IF v_d.status <> 'pending' THEN RAISE EXCEPTION 'deposit is not pending'; END IF;
  IF upper(v_d.asset) <> upper(p_asset) OR lower(v_d.network) <> lower(p_network) THEN
    RAISE EXCEPTION 'chain asset or network mismatch';
  END IF;
  -- Do not silently under/over-credit. Partial payments require a separate explicit policy.
  IF v_d.amount <> p_observed_amount THEN RAISE EXCEPTION 'observed amount does not match deposit intent'; END IF;

  UPDATE public.deposit_records
     SET txid = lower(btrim(p_txid)), chain_observed_amount = p_observed_amount,
         chain_confirmations = p_confirmations, chain_verified_at = now(),
         chain_verifier_id = p_verifier_id
   WHERE id = v_d.id;

  v_result := public.apply_financial_operation(
    'deposit-chain:' || p_request_id, v_d.user_id, upper(v_d.asset), 'deposit_credit',
    p_observed_amount, 0, v_hash,
    jsonb_build_object('deposit_id',v_d.id,'txid',lower(btrim(p_txid)),
      'network',v_d.network,'confirmations',p_confirmations,'required_confirmations',p_required_confirmations,
      'verifier_id',p_verifier_id)
  );
  v_op_id := (v_result->>'operation_id')::uuid;
  UPDATE public.deposit_records
     SET status='confirmed', confirmed_by=p_verifier_id, confirmed_at=now(), credit_operation_id=v_op_id
   WHERE id=v_d.id;

  INSERT INTO public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,metadata)
  VALUES(p_verifier_id,v_d.user_id,'deposit_chain_verified_and_credited','deposit',v_d.id,
    jsonb_build_object('asset',v_d.asset,'network',v_d.network,'amount',p_observed_amount,
      'txid',lower(btrim(p_txid)),'confirmations',p_confirmations,'required_confirmations',p_required_confirmations,
      'operation_id',v_op_id));

  RETURN jsonb_build_object('ok',true,'duplicate',false,'deposit_id',v_d.id,'status','confirmed',
    'operation_id',v_op_id,'available',v_result->'available');
END;
$$;

-- Legacy admin confirmation must not bypass chain verification.
CREATE OR REPLACE FUNCTION public.confirm_deposit_atomic(p_deposit_id text, p_admin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_d public.deposit_records%rowtype;
BEGIN
  SELECT * INTO v_d FROM public.deposit_records WHERE id=p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not found'; END IF;
  IF v_d.status='confirmed' AND v_d.chain_verified_at IS NOT NULL AND v_d.credit_operation_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'deposit_id',v_d.id,'status',v_d.status,
      'operation_id',v_d.credit_operation_id);
  END IF;
  RAISE EXCEPTION 'manual deposit confirmation disabled; verified chain observation required';
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_credit_deposit_atomic(text,text,text,text,text,numeric,integer,integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_deposit_atomic(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_credit_deposit_atomic(text,text,text,text,text,numeric,integer,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_deposit_atomic(text,text) TO service_role;
