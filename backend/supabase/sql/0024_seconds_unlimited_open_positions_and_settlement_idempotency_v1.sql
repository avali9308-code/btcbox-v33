-- BTCBOX Seconds: allow multiple open positions per user and correct settlement idempotency.
-- Forward-only migration. Preserve account-row locking, per-position locking,
-- ledger atomicity, and all independent idempotency/primary-key constraints.
-- Do not apply to the hosted project until migration-history drift is reconciled
-- and isolated PostgreSQL concurrency tests have passed.

DROP INDEX IF EXISTS public.seconds_contract_positions_one_open_per_user_idx;

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
    WHEN v_win THEN round(v_pos.amount * 0.85, 18)
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
      'pnl',v_pnl,'win',v_win,'tie',v_tie
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
