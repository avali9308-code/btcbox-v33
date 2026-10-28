-- BTCBOX Round 72: database-enforced earn product and payout policy.
-- Apply after financial_ledger_v1.sql, financial_lifecycle_v2.sql, and
-- financial_earn_redemption_idempotency_v4.sql in a disposable staging project.
-- This migration deliberately fails if existing positions have unknown products or
-- an asset/product mismatch; reconcile those rows before applying it.

CREATE TABLE IF NOT EXISTS public.earn_product_catalog (
  product_id text PRIMARY KEY,
  asset text NOT NULL CHECK (asset ~ '^[A-Z0-9]{2,16}$'),
  product_type text NOT NULL CHECK (product_type IN ('demand','fixed')),
  apy_percent numeric(9,6) NOT NULL CHECK (apy_percent >= 0 AND apy_percent <= 1000),
  term_days integer NOT NULL CHECK (term_days >= 0 AND term_days <= 3650),
  early_fee_percent numeric(9,6) NOT NULL CHECK (early_fee_percent >= 0 AND early_fee_percent <= 100),
  amount_scale smallint NOT NULL CHECK (amount_scale BETWEEN 0 AND 18),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((product_type = 'demand' AND term_days = 0) OR (product_type = 'fixed' AND term_days > 0))
);

INSERT INTO public.earn_product_catalog
  (product_id, asset, product_type, apy_percent, term_days, early_fee_percent, amount_scale, active)
VALUES
  ('demand',    'USDT', 'demand',  3.000000,   0, 0.000000, 4, true),
  ('flex_USDT', 'USDT', 'demand',  5.200000,   0, 0.000000, 4, true),
  ('flex_BTC',  'BTC',  'demand',  2.800000,   0, 0.000000, 8, true),
  ('flex_ETH',  'ETH',  'demand',  3.500000,   0, 0.000000, 8, true),
  ('fixed30',   'USDT', 'fixed',   8.000000,  30, 2.000000, 4, true),
  ('fixed90',   'USDT', 'fixed',  12.000000,  90, 2.000000, 4, true),
  ('fixed180',  'USDT', 'fixed',   6.800000, 180, 2.000000, 4, true)
ON CONFLICT (product_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.earn_positions
    WHERE status = 'redeemed' AND
      (redeem_request_id IS NULL OR redeem_request_hash IS NULL OR redeem_operation_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'historical redeemed earn positions lack complete idempotency metadata; reconcile before Round 72';
  END IF;
END $$;

ALTER TABLE public.earn_positions
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS apy_percent numeric(9,6),
  ADD COLUMN IF NOT EXISTS term_days integer,
  ADD COLUMN IF NOT EXISTS early_fee_percent numeric(9,6),
  ADD COLUMN IF NOT EXISTS amount_scale smallint,
  ADD COLUMN IF NOT EXISTS subscribe_request_hash text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.earn_positions p
    LEFT JOIN public.earn_product_catalog c ON c.product_id = p.product_id
    WHERE c.product_id IS NULL OR c.asset <> p.asset
  ) THEN
    RAISE EXCEPTION 'earn product/asset mismatch or unknown product exists; reconcile positions before applying Round 72';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.earn_positions
    WHERE (product_type IS NULL OR apy_percent IS NULL OR term_days IS NULL
           OR early_fee_percent IS NULL OR amount_scale IS NULL)
      AND NOT (product_type IS NULL AND apy_percent IS NULL AND term_days IS NULL
               AND early_fee_percent IS NULL AND amount_scale IS NULL)
  ) THEN
    RAISE EXCEPTION 'partial earn policy snapshot found; reconcile before migration';
  END IF;
END $$;

UPDATE public.earn_positions p SET
  product_type = c.product_type,
  apy_percent = c.apy_percent,
  term_days = c.term_days,
  early_fee_percent = c.early_fee_percent,
  amount_scale = c.amount_scale
FROM public.earn_product_catalog c
WHERE c.product_id = p.product_id
  AND p.product_type IS NULL AND p.apy_percent IS NULL AND p.term_days IS NULL
  AND p.early_fee_percent IS NULL AND p.amount_scale IS NULL;

UPDATE public.earn_positions p SET subscribe_request_hash = o.request_hash
FROM public.financial_operations o
WHERE o.id = p.subscribe_operation_id AND p.subscribe_request_hash IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.earn_positions WHERE subscribe_request_hash IS NULL) THEN
    RAISE EXCEPTION 'cannot recover subscription request hashes for existing positions';
  END IF;
END $$;

ALTER TABLE public.earn_positions
  ALTER COLUMN subscribe_request_hash SET NOT NULL,
  ALTER COLUMN product_type SET NOT NULL,
  ALTER COLUMN apy_percent SET NOT NULL,
  ALTER COLUMN term_days SET NOT NULL,
  ALTER COLUMN early_fee_percent SET NOT NULL,
  ALTER COLUMN amount_scale SET NOT NULL;

ALTER TABLE public.earn_positions
  DROP CONSTRAINT IF EXISTS earn_positions_policy_type_check;
ALTER TABLE public.earn_positions
  ADD CONSTRAINT earn_positions_policy_type_check
  CHECK ((product_type = 'demand' AND term_days = 0) OR (product_type = 'fixed' AND term_days > 0));

ALTER TABLE public.earn_product_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.earn_product_catalog FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.earn_product_catalog TO service_role;

-- Position identity and policy snapshots must not be rewritten after subscription.
CREATE OR REPLACE FUNCTION public.guard_earn_position_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR
     NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.asset IS DISTINCT FROM OLD.asset OR
     NEW.principal IS DISTINCT FROM OLD.principal OR NEW.created_at IS DISTINCT FROM OLD.created_at OR
     NEW.subscribe_operation_id IS DISTINCT FROM OLD.subscribe_operation_id OR
     NEW.request_idempotency_key IS DISTINCT FROM OLD.request_idempotency_key OR
     NEW.subscribe_request_hash IS DISTINCT FROM OLD.subscribe_request_hash OR
     NEW.product_type IS DISTINCT FROM OLD.product_type OR
     NEW.apy_percent IS DISTINCT FROM OLD.apy_percent OR NEW.term_days IS DISTINCT FROM OLD.term_days OR
     NEW.early_fee_percent IS DISTINCT FROM OLD.early_fee_percent OR
     NEW.amount_scale IS DISTINCT FROM OLD.amount_scale THEN
    RAISE EXCEPTION 'earn position identity and policy snapshot are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS earn_position_snapshot_immutable ON public.earn_positions;
CREATE TRIGGER earn_position_snapshot_immutable
BEFORE UPDATE ON public.earn_positions
FOR EACH ROW EXECUTE FUNCTION public.guard_earn_position_snapshot();
REVOKE ALL ON FUNCTION public.guard_earn_position_snapshot() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.subscribe_earn_atomic(
  p_position_id text,
  p_user_id text,
  p_product_id text,
  p_asset text,
  p_principal numeric,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_existing public.earn_positions%ROWTYPE;
  v_product public.earn_product_catalog%ROWTYPE;
  v_result jsonb;
  v_operation_id uuid;
BEGIN
  IF coalesce(p_position_id,'') = '' OR coalesce(p_user_id,'') = '' OR
     coalesce(p_product_id,'') = '' OR coalesce(p_asset,'') !~ '^[A-Z0-9]{2,16}$' OR
     p_principal IS NULL OR p_principal <= 0 OR
     length(coalesce(p_request_id,'')) < 16 OR length(p_request_id) > 100 OR
     coalesce(p_request_hash,'') = '' THEN
    RAISE EXCEPTION 'invalid earn subscription';
  END IF;

  SELECT * INTO v_product FROM public.earn_product_catalog
   WHERE product_id = p_product_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'earn product is not available'; END IF;
  IF v_product.asset <> p_asset THEN RAISE EXCEPTION 'earn product asset mismatch'; END IF;
  IF p_principal <> round(p_principal, v_product.amount_scale) THEN
    RAISE EXCEPTION 'principal precision exceeds product asset scale';
  END IF;

  SELECT * INTO v_existing FROM public.earn_positions
   WHERE request_idempotency_key = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.id <> p_position_id OR v_existing.user_id <> p_user_id OR
       v_existing.product_id <> p_product_id OR v_existing.asset <> p_asset OR
       v_existing.principal <> p_principal OR
       v_existing.subscribe_request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'idempotency key payload mismatch';
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'position_id',v_existing.id,'status',v_existing.status,
      'operation_id',v_existing.subscribe_operation_id);
  END IF;

  v_result := public.apply_financial_operation(
    'earn-subscribe:' || p_request_id, p_user_id, p_asset, 'earn_subscribe',
    -p_principal, 0, p_request_hash,
    jsonb_build_object('position_id',p_position_id,'product_id',p_product_id,'asset',p_asset)
  );
  v_operation_id := (v_result->>'operation_id')::uuid;
  INSERT INTO public.earn_positions
    (id,user_id,product_id,asset,principal,status,subscribe_operation_id,request_idempotency_key,
     product_type,apy_percent,term_days,early_fee_percent,amount_scale,subscribe_request_hash)
  VALUES
    (p_position_id,p_user_id,p_product_id,p_asset,p_principal,'active',v_operation_id,p_request_id,
     v_product.product_type,v_product.apy_percent,v_product.term_days,v_product.early_fee_percent,v_product.amount_scale,p_request_hash);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'position_id',p_position_id,'status','active',
    'operation_id',v_operation_id,'asset',p_asset);
END;
$$;

-- Remove the old overload that accepted a caller-supplied payout. The database now
-- calculates the payout from the immutable position policy snapshot.
DROP FUNCTION IF EXISTS public.redeem_earn_atomic(text,text,numeric,text,text);

CREATE OR REPLACE FUNCTION public.redeem_earn_atomic(
  p_position_id text,
  p_user_id text,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_position public.earn_positions%ROWTYPE;
  v_existing public.earn_positions%ROWTYPE;
  v_now timestamptz := now();
  v_elapsed numeric;
  v_matured boolean;
  v_interest numeric;
  v_penalty numeric;
  v_payout numeric;
  v_result jsonb;
  v_operation_id uuid;
BEGIN
  IF coalesce(p_position_id,'') = '' OR coalesce(p_user_id,'') = '' OR
     length(coalesce(p_request_id,'')) < 16 OR length(p_request_id) > 100 OR
     coalesce(p_request_hash,'') = '' THEN
    RAISE EXCEPTION 'invalid earn redemption';
  END IF;

  SELECT * INTO v_position FROM public.earn_positions
   WHERE id = p_position_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'earn position not found'; END IF;

  IF v_position.status = 'redeemed' THEN
    IF v_position.redeem_request_id = p_request_id THEN
      IF v_position.redeem_request_hash IS DISTINCT FROM p_request_hash THEN
        RAISE EXCEPTION 'idempotency key payload mismatch';
      END IF;
      RETURN jsonb_build_object('ok',true,'duplicate',true,'position_id',v_position.id,
        'status',v_position.status,'operation_id',v_position.redeem_operation_id);
    END IF;
    RAISE EXCEPTION 'earn position already redeemed with a different request';
  END IF;
  IF v_position.status <> 'active' THEN RAISE EXCEPTION 'earn position is not active'; END IF;

  SELECT * INTO v_existing FROM public.earn_positions WHERE redeem_request_id = p_request_id;
  IF FOUND AND v_existing.id <> v_position.id THEN RAISE EXCEPTION 'idempotency key payload mismatch'; END IF;

  v_elapsed := greatest(0, extract(epoch FROM (v_now - v_position.created_at)));
  v_matured := v_position.product_type = 'demand' OR
    v_now >= v_position.created_at + make_interval(days => v_position.term_days);
  IF v_position.product_type = 'fixed' AND NOT v_matured THEN
    v_penalty := round(v_position.principal * v_position.early_fee_percent / 100, v_position.amount_scale);
    v_payout := v_position.principal - v_penalty;
  ELSE
    IF v_position.product_type = 'fixed' THEN
      v_interest := round(v_position.principal * v_position.apy_percent / 100 * v_position.term_days / 365,
                          v_position.amount_scale);
    ELSE
      v_interest := round(v_position.principal * v_position.apy_percent / 100 * v_elapsed / 31536000,
                          v_position.amount_scale);
    END IF;
    v_payout := v_position.principal + v_interest;
    v_penalty := 0;
  END IF;
  IF v_payout IS NULL OR v_payout <= 0 THEN RAISE EXCEPTION 'calculated earn payout is invalid'; END IF;

  v_result := public.apply_financial_operation(
    'earn-redeem:' || p_request_id, p_user_id, v_position.asset, 'earn_redeem',
    v_payout, 0, p_request_hash,
    jsonb_build_object('position_id',v_position.id,'principal',v_position.principal,
      'interest',coalesce(v_interest,0),'penalty',v_penalty,'asset',v_position.asset)
  );
  v_operation_id := (v_result->>'operation_id')::uuid;
  UPDATE public.earn_positions SET status='redeemed',redeem_operation_id=v_operation_id,
    redeemed_at=v_now,redeem_request_id=p_request_id,redeem_request_hash=p_request_hash
  WHERE id=v_position.id;
  INSERT INTO public.financial_audit_log
    (actor_id,subject_user_id,action,object_type,object_id,metadata)
  VALUES ('system',p_user_id,'earn_redeemed','earn_position',v_position.id,
    jsonb_build_object('payout',v_payout,'principal',v_position.principal,
      'interest',coalesce(v_interest,0),'penalty',v_penalty,'asset',v_position.asset,
      'request_id',p_request_id,'operation_id',v_operation_id));
  RETURN jsonb_build_object('ok',true,'duplicate',false,'position_id',v_position.id,
    'status','redeemed','operation_id',v_operation_id,'asset',v_position.asset,
    'principal',v_position.principal,'interest',coalesce(v_interest,0),'penalty',v_penalty,'payout',v_payout);
END;
$$;

REVOKE ALL ON FUNCTION public.subscribe_earn_atomic(text,text,text,text,numeric,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_earn_atomic(text,text,text,text,numeric,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.redeem_earn_atomic(text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_earn_atomic(text,text,text,text) TO service_role;
