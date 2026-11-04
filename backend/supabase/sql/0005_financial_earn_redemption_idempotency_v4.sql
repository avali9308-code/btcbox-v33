-- Round 70: strict, durable idempotency for earn redemption.
-- Apply after financial_lifecycle_v2.sql on a disposable staging database first.
ALTER TABLE public.earn_positions
  ADD COLUMN IF NOT EXISTS redeem_request_id text,
  ADD COLUMN IF NOT EXISTS redeem_request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS earn_positions_redeem_request_id_uq
  ON public.earn_positions (redeem_request_id)
  WHERE redeem_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.redeem_earn_atomic(
  p_position_id text,
  p_user_id text,
  p_payout numeric,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_position public.earn_positions%ROWTYPE;
  v_other public.earn_positions%ROWTYPE;
  v_operation jsonb;
  v_operation_id uuid;
BEGIN
  IF coalesce(p_position_id, '') = '' OR coalesce(p_user_id, '') = '' OR
     p_payout IS NULL OR p_payout <= 0 OR
     length(coalesce(p_request_id, '')) < 16 OR length(p_request_id) > 100 OR
     coalesce(p_request_hash, '') = '' THEN
    RAISE EXCEPTION 'invalid earn redemption';
  END IF;

  SELECT * INTO v_position
    FROM public.earn_positions
   WHERE id = p_position_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'earn position not found'; END IF;

  IF v_position.status = 'redeemed' THEN
    IF v_position.redeem_request_id = p_request_id THEN
      IF v_position.redeem_request_hash IS DISTINCT FROM p_request_hash THEN
        RAISE EXCEPTION 'idempotency key payload mismatch';
      END IF;
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'position_id', v_position.id, 'status', v_position.status,
        'operation_id', v_position.redeem_operation_id);
    END IF;
    RAISE EXCEPTION 'earn position already redeemed with a different request';
  END IF;
  IF v_position.status <> 'active' THEN
    RAISE EXCEPTION 'earn position is not active';
  END IF;

  SELECT * INTO v_other FROM public.earn_positions
   WHERE redeem_request_id = p_request_id;
  IF FOUND AND v_other.id <> v_position.id THEN
    RAISE EXCEPTION 'idempotency key payload mismatch';
  END IF;

  v_operation := public.apply_financial_operation(
    'earn-redeem:' || p_request_id, p_user_id, v_position.asset, 'earn_redeem',
    p_payout, 0, p_request_hash,
    jsonb_build_object('position_id', v_position.id, 'principal', v_position.principal)
  );
  v_operation_id := (v_operation->>'operation_id')::uuid;

  UPDATE public.earn_positions
     SET status = 'redeemed', redeem_operation_id = v_operation_id,
         redeemed_at = now(), redeem_request_id = p_request_id,
         redeem_request_hash = p_request_hash
   WHERE id = v_position.id;

  INSERT INTO public.financial_audit_log
    (actor_id, subject_user_id, action, object_type, object_id, metadata)
  VALUES ('system', p_user_id, 'earn_redeemed', 'earn_position', v_position.id,
    jsonb_build_object('payout', p_payout, 'principal', v_position.principal,
                       'request_id', p_request_id, 'operation_id', v_operation_id));

  RETURN jsonb_build_object('ok', true, 'duplicate', false,
    'position_id', v_position.id, 'status', 'redeemed', 'operation_id', v_operation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_earn_atomic(text,text,numeric,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_earn_atomic(text,text,numeric,text,text)
  TO service_role;
