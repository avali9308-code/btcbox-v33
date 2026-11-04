-- BTCBOX Seconds: enforce at most one open position per user.
-- Apply only after the documented staging drill. Do not enable financial cutover
-- or run live money-moving operations as part of this migration.
--
-- The preflight deliberately fails instead of silently closing or deleting any
-- existing position if duplicate open positions are found.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.seconds_contract_positions
    WHERE status = 'open'
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'cannot enforce one-open-position rule: duplicate open positions exist; reconcile them explicitly first';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS seconds_contract_positions_one_open_per_user_idx
  ON public.seconds_contract_positions (user_id)
  WHERE status = 'open';

-- Replace the submit RPC so the database-level concurrent uniqueness guard
-- returns a stable business code instead of a misleading idempotency error.
CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1(
  p_position_id text, p_user_id text, p_symbol text, p_direction text,
  p_amount numeric, p_duration_sec integer, p_open_price numeric,
  p_request_id text, p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing public.seconds_contract_positions%rowtype;
  v_op public.financial_operations%rowtype;
  v_available numeric;
  v_frozen numeric;
  v_operation_id uuid;
  v_now timestamptz := clock_timestamp();
  v_constraint_name text;
BEGIN
  IF coalesce(p_user_id,'') = ''
     OR p_symbol NOT IN ('BTC','ETH','SOL','BNB')
     OR p_direction NOT IN ('up','down')
     OR p_amount IS NULL OR p_amount <= 0
     OR p_duration_sec NOT IN (30,60,300,900)
     OR p_open_price IS NULL OR p_open_price <= 0
     OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR length(coalesce(p_request_hash,'')) <> 64
     OR p_position_id !~ '^SC[A-Fa-f0-9]{30}$' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  END IF;

  SELECT * INTO v_existing
  FROM public.seconds_contract_positions
  WHERE open_request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.open_request_hash <> p_request_hash
       OR v_existing.user_id <> p_user_id THEN
      RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object(
      'ok',true,'duplicate',true,'position_id',v_existing.position_id,
      'status',v_existing.status,
      'settle_at',extract(epoch from v_existing.settle_at)::bigint
    );
  END IF;

  INSERT INTO public.financial_accounts(user_id,asset)
  VALUES (p_user_id,'USDT')
  ON CONFLICT DO NOTHING;

  SELECT available,frozen INTO v_available,v_frozen
  FROM public.financial_accounts
  WHERE user_id=p_user_id AND asset='USDT'
  FOR UPDATE;

  IF v_available < p_amount THEN
    RETURN jsonb_build_object('ok',false,'code','INSUFFICIENT_BALANCE');
  END IF;

  INSERT INTO public.financial_operations(
    idempotency_key,user_id,asset,operation_type,request_hash,metadata
  ) VALUES (
    p_request_id,p_user_id,'USDT','seconds_open',p_request_hash,
    jsonb_build_object(
      'position_id',p_position_id,'symbol',p_symbol,'direction',p_direction,
      'amount',p_amount,'duration_sec',p_duration_sec,'open_price',p_open_price
    )
  ) RETURNING id INTO v_operation_id;

  UPDATE public.financial_accounts
  SET available=available-p_amount,
      frozen=frozen+p_amount,
      version=version+1,
      updated_at=v_now
  WHERE user_id=p_user_id AND asset='USDT'
  RETURNING available,frozen INTO v_available,v_frozen;

  INSERT INTO public.financial_ledger(
    operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after
  ) VALUES (
    v_operation_id,p_user_id,'USDT',-p_amount,p_amount,v_available,v_frozen
  );

  INSERT INTO public.seconds_contract_positions(
    position_id,user_id,symbol,direction,amount,duration_sec,
    open_price,open_price_source,open_price_ts,open_request_id,
    open_request_hash,open_operation_id,settle_at
  ) VALUES (
    p_position_id,p_user_id,p_symbol,p_direction,p_amount,p_duration_sec,p_open_price,
    'server_reference_feed',v_now,p_request_id,p_request_hash,v_operation_id,
    v_now+make_interval(secs=>p_duration_sec)
  );

  RETURN jsonb_build_object(
    'ok',true,'duplicate',false,'position_id',p_position_id,
    'settle_at',extract(epoch from (v_now+make_interval(secs=>p_duration_sec)))::bigint
  );
EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
  IF v_constraint_name = 'seconds_contract_positions_one_open_per_user_idx' THEN
    RETURN jsonb_build_object('ok',false,'code','OPEN_POSITION_EXISTS');
  END IF;
  RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
END;
$$;
