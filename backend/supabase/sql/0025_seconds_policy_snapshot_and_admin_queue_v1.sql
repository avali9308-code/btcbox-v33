-- BTCBOX Seconds: backend-authoritative configurable policy, immutable position snapshots,
-- and a paginated admin queue. Forward-only; hosted apply remains blocked by migration-history drift.
CREATE TABLE IF NOT EXISTS public.seconds_contract_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT true,
  allowed_durations integer[] NOT NULL DEFAULT ARRAY[30,60,300,900]::integer[],
  min_order_amount numeric(38,18) NOT NULL DEFAULT 1 CHECK (min_order_amount > 0),
  max_order_amount numeric(38,18) NOT NULL DEFAULT 1000000000000 CHECK (max_order_amount >= min_order_amount),
  payout_rate numeric(12,6) NOT NULL DEFAULT 0.85 CHECK (payout_rate >= 0.85),
  policy_version bigint NOT NULL DEFAULT 1 CHECK (policy_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system'
);
INSERT INTO public.seconds_contract_policy(singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.seconds_contract_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seconds_contract_policy FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.seconds_contract_policy TO service_role;

ALTER TABLE public.seconds_contract_positions
  DROP CONSTRAINT IF EXISTS seconds_contract_positions_duration_sec_check;
ALTER TABLE public.seconds_contract_positions
  ADD CONSTRAINT seconds_contract_positions_duration_sec_check
  CHECK (duration_sec >= 1);
ALTER TABLE public.seconds_contract_positions
  ADD COLUMN IF NOT EXISTS policy_version bigint NOT NULL DEFAULT 1 CHECK (policy_version > 0);
ALTER TABLE public.seconds_contract_positions
  ADD COLUMN IF NOT EXISTS payout_rate numeric(12,6) NOT NULL DEFAULT 0.85 CHECK (payout_rate >= 0.85);

CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1(
  p_position_id text, p_user_id text, p_symbol text, p_direction text,
  p_amount numeric, p_duration_sec integer, p_open_price numeric,
  p_request_id text, p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_existing public.seconds_contract_positions%rowtype;
  v_policy public.seconds_contract_policy%rowtype;
  v_available numeric;
  v_frozen numeric;
  v_operation_id uuid;
  v_now timestamptz := clock_timestamp();
  v_settle_at timestamptz;
BEGIN
  IF coalesce(p_user_id,'') = ''
     OR p_symbol NOT IN ('BTC','ETH','SOL','BNB')
     OR p_direction NOT IN ('up','down')
     OR p_amount IS NULL OR p_amount <= 0
     OR p_duration_sec IS NULL OR p_duration_sec < 1
     OR p_open_price IS NULL OR p_open_price <= 0
     OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR length(coalesce(p_request_hash,'')) <> 64
     OR p_position_id !~ '^SC[A-Fa-f0-9]{30}$' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  END IF;
  SELECT * INTO v_existing FROM public.seconds_contract_positions
  WHERE open_request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.open_request_hash <> p_request_hash OR v_existing.user_id <> p_user_id THEN
      RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'position_id',v_existing.position_id,
      'status',v_existing.status,'settle_at',extract(epoch FROM v_existing.settle_at)::bigint,
      'policy_version',v_existing.policy_version,'payout_rate',v_existing.payout_rate);
  END IF;

  SELECT * INTO v_policy FROM public.seconds_contract_policy
  WHERE singleton = true
  FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','SECONDS_POLICY_NOT_CONFIGURED'); END IF;
  IF NOT v_policy.enabled THEN RETURN jsonb_build_object('ok',false,'code','SECONDS_TRADING_DISABLED'); END IF;
  IF NOT (p_duration_sec = ANY(v_policy.allowed_durations)) THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_DURATION');
  END IF;
  IF p_amount < v_policy.min_order_amount OR p_amount > v_policy.max_order_amount THEN
    RETURN jsonb_build_object('ok',false,'code','AMOUNT_OUT_OF_POLICY_RANGE',
      'min_order_amount',v_policy.min_order_amount,'max_order_amount',v_policy.max_order_amount);
  END IF;

  INSERT INTO public.financial_accounts(user_id,asset) VALUES (p_user_id,'USDT') ON CONFLICT DO NOTHING;
  SELECT available,frozen INTO v_available,v_frozen FROM public.financial_accounts
  WHERE user_id=p_user_id AND asset='USDT' FOR UPDATE;
  IF v_available < p_amount THEN RETURN jsonb_build_object('ok',false,'code','INSUFFICIENT_BALANCE'); END IF;

  v_settle_at := v_now + make_interval(secs => p_duration_sec);
  INSERT INTO public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  VALUES (p_request_id,p_user_id,'USDT','seconds_open',p_request_hash,
    jsonb_build_object('position_id',p_position_id,'symbol',p_symbol,'direction',p_direction,
      'amount',p_amount,'duration_sec',p_duration_sec,'open_price',p_open_price,
      'policy_version',v_policy.policy_version,'payout_rate',v_policy.payout_rate,
      'min_order_amount',v_policy.min_order_amount,'max_order_amount',v_policy.max_order_amount))
  RETURNING id INTO v_operation_id;

  UPDATE public.financial_accounts
  SET available=available-p_amount,frozen=frozen+p_amount,version=version+1,updated_at=v_now
  WHERE user_id=p_user_id AND asset='USDT'
  RETURNING available,frozen INTO v_available,v_frozen;

  INSERT INTO public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  VALUES (v_operation_id,p_user_id,'USDT',-p_amount,p_amount,v_available,v_frozen);

  INSERT INTO public.seconds_contract_positions(
    position_id,user_id,symbol,direction,amount,duration_sec,open_price,
    open_price_source,open_price_ts,open_request_id,open_request_hash,
    open_operation_id,settle_at,policy_version,payout_rate
  ) VALUES (
    p_position_id,p_user_id,p_symbol,p_direction,p_amount,p_duration_sec,p_open_price,
    'server_reference_feed',v_now,p_request_id,p_request_hash,v_operation_id,
    v_settle_at,v_policy.policy_version,v_policy.payout_rate
  );
  RETURN jsonb_build_object('ok',true,'duplicate',false,'position_id',p_position_id,
    'settle_at',extract(epoch FROM v_settle_at)::bigint,
    'policy_version',v_policy.policy_version,'payout_rate',v_policy.payout_rate);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
END;
$$;

CREATE OR REPLACE FUNCTION public.read_seconds_policy_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_policy public.seconds_contract_policy%rowtype;
BEGIN
  SELECT * INTO v_policy FROM public.seconds_contract_policy WHERE singleton=true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','SECONDS_POLICY_NOT_CONFIGURED'); END IF;
  RETURN jsonb_build_object('ok',true,'policy',jsonb_build_object(
    'enabled',v_policy.enabled,'allowed_durations',v_policy.allowed_durations,
    'min_order_amount',v_policy.min_order_amount,'max_order_amount',v_policy.max_order_amount,
    'payout_rate',v_policy.payout_rate,'policy_version',v_policy.policy_version));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_seconds_policy_v1(
  p_enabled boolean,p_allowed_durations integer[],p_min_order_amount numeric,
  p_max_order_amount numeric,p_payout_rate numeric,p_admin_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_distinct_count integer;
BEGIN
  IF p_enabled IS NULL OR p_allowed_durations IS NULL
     OR cardinality(p_allowed_durations)<1 OR cardinality(p_allowed_durations)>20
     OR p_min_order_amount IS NULL OR p_min_order_amount<=0
     OR p_max_order_amount IS NULL OR p_max_order_amount<p_min_order_amount
     OR p_payout_rate IS NULL OR p_payout_rate < 0.85
     OR coalesce(trim(p_admin_id),'')='' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_SECONDS_POLICY');
  END IF;
  SELECT count(DISTINCT duration_value) INTO v_distinct_count
  FROM unnest(p_allowed_durations) AS d(duration_value);
  IF v_distinct_count<>cardinality(p_allowed_durations)
     OR EXISTS(SELECT 1 FROM unnest(p_allowed_durations) AS d(duration_value) WHERE duration_value<1) THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_SECONDS_POLICY');
  END IF;
  UPDATE public.seconds_contract_policy
  SET enabled=p_enabled,allowed_durations=p_allowed_durations,
      min_order_amount=p_min_order_amount,max_order_amount=p_max_order_amount,
      payout_rate=p_payout_rate,policy_version=policy_version+1,
      updated_at=clock_timestamp(),updated_by=left(trim(p_admin_id),128)
  WHERE singleton=true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','SECONDS_POLICY_NOT_CONFIGURED'); END IF;
  RETURN public.read_seconds_policy_v1();
END;
$$;

CREATE OR REPLACE FUNCTION public.read_admin_seconds_positions_v1(p_limit integer DEFAULT 200,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_positions jsonb; v_total bigint;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>500 OR p_offset IS NULL OR p_offset<0 THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  END IF;
  SELECT count(*) INTO v_total FROM public.seconds_contract_positions WHERE status='open';
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.position_id DESC),'[]'::jsonb)
  INTO v_positions FROM (
    SELECT position_id,user_id,symbol,direction,amount,duration_sec,open_price,
      extract(epoch FROM settle_at)::bigint AS settle_at,
      extract(epoch FROM created_at)::bigint AS created_at,policy_version,payout_rate
    FROM public.seconds_contract_positions WHERE status='open'
    ORDER BY created_at DESC,position_id DESC LIMIT p_limit OFFSET p_offset
  ) q;
  RETURN jsonb_build_object('ok',true,'positions',v_positions,'total',v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_seconds_positions_v1(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_open jsonb; v_history jsonb;
BEGIN
  IF coalesce(p_user_id,'')='' THEN RETURN jsonb_build_object('ok',false,'code','INVALID_ARGUMENT'); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'position_id',position_id,'symbol',symbol,'direction',direction,'amount',amount,
    'duration_sec',duration_sec,'open_price',open_price,'settle_at',extract(epoch FROM settle_at)::bigint,
    'policy_version',policy_version,'payout_rate',payout_rate
  ) ORDER BY created_at DESC),'[]'::jsonb)
  INTO v_open FROM public.seconds_contract_positions WHERE user_id=p_user_id AND status='open';
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'position_id',position_id,'symbol',symbol,'direction',direction,'amount',amount,
    'duration_sec',duration_sec,'open_price',open_price,'settle_price',settle_price,
    'pnl',pnl,'win',win,'tie',tie,'settled_at',extract(epoch FROM settled_at)::bigint,
    'policy_version',policy_version,'payout_rate',payout_rate
  ) ORDER BY settled_at DESC),'[]'::jsonb)
  INTO v_history FROM (
    SELECT * FROM public.seconds_contract_positions WHERE user_id=p_user_id AND status='settled'
    ORDER BY settled_at DESC LIMIT 100
  ) h;
  RETURN jsonb_build_object('ok',true,'open',v_open,'history',v_history);
END;
$$;

REVOKE ALL ON FUNCTION public.read_seconds_policy_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_seconds_policy_v1(boolean,integer[],numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.read_admin_seconds_positions_v1(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_seconds_policy_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_seconds_policy_v1(boolean,integer[],numeric,numeric,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_admin_seconds_positions_v1(integer,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.settle_seconds_position_v1(
  p_position_id text, p_user_id text, p_request_id text, p_request_hash text,
  p_symbol text, p_settle_price numeric, p_settle_price_source text, p_settle_price_ts timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_pos public.seconds_contract_positions%rowtype;
  v_available numeric;
  v_frozen numeric;
  v_op_id uuid;
  v_pnl numeric;
  v_credit numeric;
  v_win boolean;
  v_tie boolean;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF coalesce(p_user_id,'') = ''
     OR p_position_id !~ '^SC[A-Fa-f0-9]{30}$'
     OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR length(coalesce(p_request_hash,'')) <> 64
     OR p_symbol NOT IN ('BTC','ETH','SOL','BNB')
     OR p_settle_price IS NULL OR p_settle_price <= 0
     OR coalesce(p_settle_price_source,'') NOT IN ('coinbase','bybit')
     OR p_settle_price_ts IS NULL
     OR p_settle_price_ts > v_now + interval '5 seconds'
     OR p_settle_price_ts < v_now - interval '2 minutes' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  END IF;

  SELECT * INTO v_pos
  FROM public.seconds_contract_positions
  WHERE position_id = p_position_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'code','POSITION_NOT_FOUND');
  END IF;
  IF v_pos.symbol <> p_symbol THEN
    RETURN jsonb_build_object('ok',false,'code','SYMBOL_MISMATCH');
  END IF;

  IF v_pos.status = 'settled' THEN
    IF v_pos.settle_request_id = p_request_id THEN
      IF v_pos.settle_request_hash IS DISTINCT FROM p_request_hash THEN
        RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
      END IF;
      RETURN jsonb_build_object(
        'ok',true,'duplicate',true,'settled',true,'position_id',v_pos.position_id,
        'win',v_pos.win,'tie',v_pos.tie,'pnl',v_pos.pnl,'settle_price',v_pos.settle_price
      );
    END IF;
    RETURN jsonb_build_object('ok',false,'code','POSITION_ALREADY_SETTLED');
  END IF;

  IF v_now < v_pos.settle_at THEN
    RETURN jsonb_build_object(
      'ok',true,'duplicate',false,'settled',false,
      'settle_at',extract(epoch FROM v_pos.settle_at)::bigint
    );
  END IF;
  IF p_settle_price_ts < v_pos.settle_at THEN
    RETURN jsonb_build_object('ok',false,'code','SETTLEMENT_PRICE_BEFORE_MATURITY');
  END IF;

  v_tie := p_settle_price = v_pos.open_price;
  v_win := (NOT v_tie) AND (
    (v_pos.direction = 'up' AND p_settle_price > v_pos.open_price)
    OR (v_pos.direction = 'down' AND p_settle_price < v_pos.open_price)
  );
  v_pnl := CASE
    WHEN v_tie THEN 0
    WHEN v_win THEN round(v_pos.amount * v_pos.payout_rate, 18)
    ELSE -v_pos.amount
  END;
  v_credit := CASE
    WHEN v_tie THEN v_pos.amount
    WHEN v_win THEN v_pos.amount + v_pnl
    ELSE 0
  END;

  INSERT INTO public.financial_accounts(user_id,asset)
  VALUES (p_user_id,'USDT')
  ON CONFLICT DO NOTHING;

  SELECT available,frozen INTO v_available,v_frozen
  FROM public.financial_accounts
  WHERE user_id = p_user_id AND asset = 'USDT'
  FOR UPDATE;

  IF v_frozen < v_pos.amount THEN
    RETURN jsonb_build_object('ok',false,'code','FROZEN_BALANCE_INVARIANT');
  END IF;

  INSERT INTO public.financial_operations(
    idempotency_key,user_id,asset,operation_type,request_hash,metadata
  ) VALUES (
    p_request_id,p_user_id,'USDT','seconds_settle',p_request_hash,
    jsonb_build_object(
      'position_id',p_position_id,'symbol',p_symbol,'direction',v_pos.direction,
      'amount',v_pos.amount,'open_price',v_pos.open_price,'settle_price',p_settle_price,
      'settle_price_source',p_settle_price_source,'settle_price_ts',p_settle_price_ts,
      'pnl',v_pnl,'win',v_win,'tie',v_tie,'policy_version',v_pos.policy_version,'payout_rate',v_pos.payout_rate
    )
  ) RETURNING id INTO v_op_id;

  UPDATE public.financial_accounts
  SET available = available + v_credit,
      frozen = frozen - v_pos.amount,
      version = version + 1,
      updated_at = v_now
  WHERE user_id = p_user_id AND asset = 'USDT'
  RETURNING available,frozen INTO v_available,v_frozen;

  INSERT INTO public.financial_ledger(
    operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after
  ) VALUES (
    v_op_id,p_user_id,'USDT',v_credit,-v_pos.amount,v_available,v_frozen
  );

  UPDATE public.seconds_contract_positions
  SET status = 'settled',
      settle_price = p_settle_price,
      settle_price_source = p_settle_price_source,
      settle_price_ts = p_settle_price_ts,
      pnl = v_pnl,
      win = v_win,
      tie = v_tie,
      settle_request_id = p_request_id,
      settle_request_hash = p_request_hash,
      settle_operation_id = v_op_id,
      settled_at = v_now
  WHERE position_id = p_position_id;

  RETURN jsonb_build_object(
    'ok',true,'duplicate',false,'settled',true,'position_id',p_position_id,
    'win',v_win,'tie',v_tie,'pnl',v_pnl,'settle_price',p_settle_price
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
END;
$$;
