-- 0023_withdrawal_manual_payout_completion_v1.sql
-- Staff manually sends the approved withdrawal, then records completion here.
-- Approval already debits the frozen ledger amount; completion is status/audit only.
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS payout_note text,
  ADD COLUMN IF NOT EXISTS paid_by text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status = ANY (ARRAY['pending','approved','rejected','broadcast','failed','completed']::text[]));

CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid_atomic(
  p_withdrawal_id text, p_admin_id text, p_reference text DEFAULT '', p_note text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_w public.withdrawal_requests%rowtype;
  v_ref text := left(btrim(coalesce(p_reference,'')),160);
  v_note text := left(btrim(coalesce(p_note,'')),300);
BEGIN
  IF coalesce(p_withdrawal_id,'')='' OR length(p_withdrawal_id)>100 OR
     coalesce(p_admin_id,'')='' OR length(p_admin_id)>128 OR
     length(coalesce(p_reference,''))>160 OR length(coalesce(p_note,''))>300 THEN
    RAISE EXCEPTION 'invalid manual payout completion request';
  END IF;
  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id=p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;
  IF v_w.status='completed' THEN
    IF coalesce(v_w.payout_reference,'')<>v_ref THEN
      RAISE EXCEPTION 'withdrawal already completed with a different payout reference';
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'withdrawal_id',v_w.id,
      'status',v_w.status,'payout_reference',coalesce(v_w.payout_reference,''),'paid_at',v_w.paid_at);
  END IF;
  IF v_w.status<>'approved' THEN
    RAISE EXCEPTION 'withdrawal must be approved before manual payout completion';
  END IF;
  UPDATE public.withdrawal_requests SET status='completed',
    payout_reference=nullif(v_ref,''), payout_note=v_note, paid_by=p_admin_id, paid_at=now()
  WHERE id=v_w.id;
  INSERT INTO public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,reason,metadata)
  VALUES(p_admin_id,v_w.user_id,'withdrawal_manual_payout_completed','withdrawal',v_w.id,v_note,
    jsonb_build_object('asset',v_w.asset,'amount',v_w.amount,'fee',v_w.fee,
      'network',v_w.network,'destination',v_w.destination,'payout_reference',v_ref));
  RETURN jsonb_build_object('ok',true,'duplicate',false,'withdrawal_id',v_w.id,
    'status','completed','payout_reference',v_ref,'paid_at',now());
END;
$$;
REVOKE ALL ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.read_admin_withdrawal_snapshot_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_count integer; v_rows jsonb;
BEGIN
  SELECT count(*)::integer INTO v_count FROM public.withdrawal_requests WHERE status IN ('pending','approved');
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'uid',user_id,'coin',asset,'amount',amount,'fee',fee,'network',network,
    'address',destination,'status',status,'txid',coalesce(payout_reference,''),
    'payout_reference',coalesce(payout_reference,''),'paid_at',paid_at,'time',created_at
  ) ORDER BY created_at DESC),'[]'::jsonb) INTO v_rows
  FROM (SELECT id,user_id,asset,amount,fee,network,destination,status,payout_reference,paid_at,created_at
    FROM public.withdrawal_requests WHERE status IN ('pending','approved')
    ORDER BY created_at DESC LIMIT 200) recent;
  RETURN jsonb_build_object('ok',true,'pending_count',v_count,'withdrawals',v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_withdrawal_history_v1(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF coalesce(p_user_id,'')='' OR length(p_user_id)>128 THEN RAISE EXCEPTION 'invalid user identity'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'coin',asset,'amount',amount,'fee',fee,'network',network,'address',destination,
    'status',status,'time',created_at,'txid',coalesce(payout_reference,''),
    'payout_reference',coalesce(payout_reference,''),'paid_at',paid_at
  ) ORDER BY created_at DESC),'[]'::jsonb)
  INTO v_rows FROM (
    SELECT id,asset,amount,fee,network,destination,status,created_at,payout_reference,paid_at
    FROM public.withdrawal_requests WHERE user_id=p_user_id ORDER BY created_at DESC LIMIT 20
  ) recent;
  RETURN jsonb_build_object('ok',true,'withdrawals',v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.read_withdrawal_history_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_withdrawal_history_v1(text) TO service_role;
