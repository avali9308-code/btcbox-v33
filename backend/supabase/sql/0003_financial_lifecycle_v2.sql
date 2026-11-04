-- BTCBOX financial lifecycle RPCs v2.
-- Apply to a dedicated staging Supabase project only. All transitions run in one DB transaction.
-- These SECURITY INVOKER RPCs are callable only by service_role; never expose service_role to browsers.

alter table public.withdrawal_requests
  add column if not exists freeze_operation_id uuid references public.financial_operations(id),
  add column if not exists review_operation_id uuid references public.financial_operations(id);

alter table public.deposit_records
  add column if not exists credit_operation_id uuid references public.financial_operations(id);

alter table public.earn_positions
  add column if not exists request_idempotency_key text unique;

create or replace function public.create_withdrawal_atomic(
  p_withdrawal_id text,
  p_user_id text,
  p_asset text,
  p_network text,
  p_amount numeric,
  p_fee numeric,
  p_destination text,
  p_request_id text,
  p_request_hash text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_existing public.withdrawal_requests%rowtype; v_result jsonb; v_op_id uuid;
begin
  if coalesce(p_withdrawal_id,'')='' or coalesce(p_user_id,'')='' or
     coalesce(p_asset,'') !~ '^[A-Z0-9]{2,16}$' or coalesce(p_network,'')='' or
     p_amount is null or p_amount <= 0 or p_fee is null or p_fee < 0 or
     length(coalesce(p_destination,'')) < 8 or length(coalesce(p_request_id,'')) < 16 or
     coalesce(p_request_hash,'')='' then raise exception 'invalid withdrawal request'; end if;

  select * into v_existing from public.withdrawal_requests where request_id=p_request_id for update;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.asset <> p_asset or
       v_existing.amount <> p_amount or v_existing.fee <> p_fee or
       v_existing.destination <> p_destination or v_existing.network <> p_network then
      raise exception 'idempotency key payload mismatch';
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'withdrawal_id',v_existing.id,'status',v_existing.status);
  end if;

  v_result := public.apply_financial_operation(
    'withdraw-freeze:' || p_request_id, p_user_id, p_asset, 'withdraw_freeze',
    -(p_amount+p_fee), p_amount+p_fee, p_request_hash,
    jsonb_build_object('withdrawal_id',p_withdrawal_id,'network',p_network)
  );
  v_op_id := (v_result->>'operation_id')::uuid;
  insert into public.withdrawal_requests(id,user_id,asset,network,amount,fee,destination,status,request_id,freeze_operation_id)
  values(p_withdrawal_id,p_user_id,p_asset,p_network,p_amount,p_fee,p_destination,'pending',p_request_id,v_op_id);
  return jsonb_build_object('ok',true,'duplicate',false,'withdrawal_id',p_withdrawal_id,'status','pending');
end;
$$;

create or replace function public.review_withdrawal_atomic(
  p_withdrawal_id text,
  p_admin_id text,
  p_approve boolean,
  p_reason text default ''
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_w public.withdrawal_requests%rowtype; v_result jsonb; v_op_id uuid; v_status text; v_hash text;
begin
  if coalesce(p_admin_id,'')='' then raise exception 'admin identity required'; end if;
  select * into v_w from public.withdrawal_requests where id=p_withdrawal_id for update;
  if not found then raise exception 'withdrawal not found'; end if;
  if v_w.status <> 'pending' then
    return jsonb_build_object('ok',true,'duplicate',true,'withdrawal_id',v_w.id,'status',v_w.status);
  end if;
  v_status := case when p_approve then 'approved' else 'rejected' end;
  v_hash := encode(extensions.digest(v_w.id || ':' || v_status || ':' || coalesce(p_reason,''),'sha256'),'hex');
  v_result := public.apply_financial_operation(
    'withdraw-review:' || v_w.id, v_w.user_id, v_w.asset,
    case when p_approve then 'withdraw_approve' else 'withdraw_reject' end,
    case when p_approve then 0 else v_w.amount+v_w.fee end,
    -(v_w.amount+v_w.fee), v_hash,
    jsonb_build_object('withdrawal_id',v_w.id,'admin_id',p_admin_id,'reason',left(coalesce(p_reason,''),200))
  );
  v_op_id := (v_result->>'operation_id')::uuid;
  update public.withdrawal_requests
    set status=v_status, reviewed_by=p_admin_id, reviewed_at=now(), review_operation_id=v_op_id
    where id=v_w.id;
  insert into public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,reason,metadata)
  values(p_admin_id,v_w.user_id,'withdrawal_'||v_status,'withdrawal',v_w.id,left(coalesce(p_reason,''),200),
         jsonb_build_object('asset',v_w.asset,'amount',v_w.amount,'fee',v_w.fee));
  return jsonb_build_object('ok',true,'duplicate',false,'withdrawal_id',v_w.id,'status',v_status);
end;
$$;

-- Fail closed by default: this legacy/admin-shaped RPC must never credit funds.
-- The chain-verification migration may replace this function with a duplicate-safe
-- verification-only status check, but actual crediting is exclusively performed by
-- verify_and_credit_deposit_atomic after a trusted verifier proves chain evidence.
create or replace function public.confirm_deposit_atomic(
  p_deposit_id text,
  p_admin_id text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception 'manual deposit confirmation disabled; trusted chain verification required';
end;
$$;

create or replace function public.subscribe_earn_atomic(
  p_position_id text,
  p_user_id text,
  p_product_id text,
  p_asset text,
  p_principal numeric,
  p_request_id text,
  p_request_hash text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_existing public.earn_positions%rowtype; v_result jsonb; v_op_id uuid;
begin
  if coalesce(p_position_id,'')='' or coalesce(p_user_id,'')='' or coalesce(p_product_id,'')='' or
     coalesce(p_asset,'') !~ '^[A-Z0-9]{2,16}$' or p_principal is null or p_principal <= 0 or
     length(coalesce(p_request_id,'')) < 16 or coalesce(p_request_hash,'')='' then
    raise exception 'invalid earn subscription';
  end if;
  select * into v_existing from public.earn_positions where request_idempotency_key=p_request_id for update;
  if found then
    if v_existing.user_id<>p_user_id or v_existing.product_id<>p_product_id or
       v_existing.asset<>p_asset or v_existing.principal<>p_principal then raise exception 'idempotency key payload mismatch'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'position_id',v_existing.id,'status',v_existing.status);
  end if;
  v_result := public.apply_financial_operation(
    'earn-subscribe:'||p_request_id,p_user_id,p_asset,'earn_subscribe',
    -p_principal,0,p_request_hash,jsonb_build_object('position_id',p_position_id,'product_id',p_product_id)
  );
  v_op_id := (v_result->>'operation_id')::uuid;
  insert into public.earn_positions(id,user_id,product_id,asset,principal,status,subscribe_operation_id,request_idempotency_key)
  values(p_position_id,p_user_id,p_product_id,p_asset,p_principal,'active',v_op_id,p_request_id);
  return jsonb_build_object('ok',true,'duplicate',false,'position_id',p_position_id,'status','active');
end;
$$;

create or replace function public.redeem_earn_atomic(
  p_position_id text,
  p_user_id text,
  p_payout numeric,
  p_request_id text,
  p_request_hash text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_p public.earn_positions%rowtype; v_result jsonb; v_op_id uuid;
begin
  if coalesce(p_user_id,'')='' or p_payout is null or p_payout <= 0 or
     length(coalesce(p_request_id,'')) < 16 or coalesce(p_request_hash,'')='' then raise exception 'invalid earn redemption'; end if;
  select * into v_p from public.earn_positions where id=p_position_id and user_id=p_user_id for update;
  if not found then raise exception 'earn position not found'; end if;
  if v_p.status='redeemed' then return jsonb_build_object('ok',true,'duplicate',true,'position_id',v_p.id,'status',v_p.status); end if;
  if v_p.status<>'active' then raise exception 'earn position is not active'; end if;
  v_result := public.apply_financial_operation(
    'earn-redeem:'||p_request_id,p_user_id,v_p.asset,'earn_redeem',
    p_payout,0,p_request_hash,jsonb_build_object('position_id',v_p.id,'principal',v_p.principal)
  );
  v_op_id := (v_result->>'operation_id')::uuid;
  update public.earn_positions set status='redeemed',redeem_operation_id=v_op_id,redeemed_at=now() where id=v_p.id;
  insert into public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,metadata)
  values('system',p_user_id,'earn_redeemed','earn_position',v_p.id,jsonb_build_object('payout',p_payout,'principal',v_p.principal));
  return jsonb_build_object('ok',true,'duplicate',false,'position_id',v_p.id,'status','redeemed');
end;
$$;

revoke all on function public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.review_withdrawal_atomic(text,text,boolean,text) from public, anon, authenticated;
revoke all on function public.confirm_deposit_atomic(text,text) from public, anon, authenticated;
revoke all on function public.subscribe_earn_atomic(text,text,text,text,numeric,text,text) from public, anon, authenticated;
revoke all on function public.redeem_earn_atomic(text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text) to service_role;
grant execute on function public.review_withdrawal_atomic(text,text,boolean,text) to service_role;
grant execute on function public.confirm_deposit_atomic(text,text) to service_role;
grant execute on function public.subscribe_earn_atomic(text,text,text,text,numeric,text,text) to service_role;
grant execute on function public.redeem_earn_atomic(text,text,numeric,text,text) to service_role;
