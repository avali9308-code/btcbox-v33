-- BTCBOX seconds-contract ledger lifecycle v1.
-- Apply only after financial_ledger_v1.sql and the approved financial cutover
-- migrations, to an isolated staging Supabase project first.
-- This migration deliberately has no outcome-rigging/preset-result control.
-- Settlement is based on a server-sampled external reference price and is
-- recorded atomically in the normalized ledger.
-- Apply this migration LAST after all other financial migrations because it
-- extends the financial_operations operation_type constraint.

alter table public.financial_operations drop constraint if exists financial_operations_operation_type_check;
alter table public.financial_operations add constraint financial_operations_operation_type_check
  check (operation_type in ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject',
    'earn_subscribe','earn_redeem','admin_adjustment','spot_trade','spot_order_reserve',
    'spot_order_cancel','seconds_open','seconds_settle','migration_opening_balance'));

create table if not exists public.seconds_contract_positions (
  position_id text primary key,
  user_id text not null,
  symbol text not null check (symbol in ('BTC','ETH','SOL','BNB')),
  direction text not null check (direction in ('up','down')),
  amount numeric(38,18) not null check (amount > 0),
  duration_sec integer not null check (duration_sec in (30,60,300,900)),
  open_price numeric(38,18) not null check (open_price > 0),
  open_price_source text not null,
  open_price_ts timestamptz not null default now(),
  open_request_id text not null unique,
  open_request_hash text not null,
  open_operation_id uuid not null unique references public.financial_operations(id),
  status text not null default 'open' check (status in ('open','settled')),
  settle_price numeric(38,18),
  settle_price_source text,
  settle_price_ts timestamptz,
  pnl numeric(38,18),
  win boolean,
  tie boolean,
  settle_request_id text unique,
  settle_request_hash text,
  settle_operation_id uuid unique references public.financial_operations(id),
  created_at timestamptz not null default now(),
  settle_at timestamptz not null,
  settled_at timestamptz,
  check ((status = 'open' and settled_at is null and settle_operation_id is null)
      or (status = 'settled' and settled_at is not null and settle_operation_id is not null))
);
create index if not exists seconds_positions_user_status_due_idx
  on public.seconds_contract_positions(user_id,status,settle_at desc);

alter table public.seconds_contract_positions enable row level security;
revoke all on public.seconds_contract_positions from anon, authenticated;
grant select, insert, update on public.seconds_contract_positions to service_role;

create or replace function public.submit_seconds_order_v1(
  p_position_id text, p_user_id text, p_symbol text, p_direction text,
  p_amount numeric, p_duration_sec integer, p_open_price numeric,
  p_request_id text, p_request_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_existing public.seconds_contract_positions%rowtype; v_op public.financial_operations%rowtype;
        v_available numeric; v_frozen numeric; v_operation_id uuid; v_now timestamptz := clock_timestamp();
begin
  if coalesce(p_user_id,'') = '' or p_symbol not in ('BTC','ETH','SOL','BNB')
     or p_direction not in ('up','down') or p_amount is null or p_amount <= 0
     or p_duration_sec not in (30,60,300,900) or p_open_price is null or p_open_price <= 0
     or p_request_id !~ '^[A-Za-z0-9_-]{16,100}$' or length(coalesce(p_request_hash,'')) <> 64
     or p_position_id !~ '^SC[A-Fa-f0-9]{30}$' then
    return jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  end if;
  select * into v_existing from public.seconds_contract_positions where open_request_id=p_request_id for update;
  if found then
    if v_existing.open_request_hash <> p_request_hash or v_existing.user_id <> p_user_id then
      return jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'position_id',v_existing.position_id,
      'status',v_existing.status,'settle_at',extract(epoch from v_existing.settle_at)::bigint);
  end if;
  insert into public.financial_accounts(user_id,asset) values (p_user_id,'USDT') on conflict do nothing;
  select available,frozen into v_available,v_frozen from public.financial_accounts
    where user_id=p_user_id and asset='USDT' for update;
  if v_available < p_amount then return jsonb_build_object('ok',false,'code','INSUFFICIENT_BALANCE'); end if;
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
    values (p_request_id,p_user_id,'USDT','seconds_open',p_request_hash,
      jsonb_build_object('position_id',p_position_id,'symbol',p_symbol,'direction',p_direction,
        'amount',p_amount,'duration_sec',p_duration_sec,'open_price',p_open_price))
    returning id into v_operation_id;
  update public.financial_accounts set available=available-p_amount,frozen=frozen+p_amount,
    version=version+1,updated_at=v_now where user_id=p_user_id and asset='USDT'
    returning available,frozen into v_available,v_frozen;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
    values(v_operation_id,p_user_id,'USDT',-p_amount,p_amount,v_available,v_frozen);
  insert into public.seconds_contract_positions(position_id,user_id,symbol,direction,amount,duration_sec,
    open_price,open_price_source,open_price_ts,open_request_id,open_request_hash,open_operation_id,settle_at)
    values(p_position_id,p_user_id,p_symbol,p_direction,p_amount,p_duration_sec,p_open_price,
      'server_reference_feed',v_now,p_request_id,p_request_hash,v_operation_id,v_now+make_interval(secs=>p_duration_sec));
  return jsonb_build_object('ok',true,'duplicate',false,'position_id',p_position_id,
    'settle_at',extract(epoch from (v_now+make_interval(secs=>p_duration_sec)))::bigint);
exception when unique_violation then
  return jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
end; $$;

create or replace function public.settle_seconds_position_v1(
  p_position_id text, p_user_id text, p_request_id text, p_request_hash text,
  p_symbol text, p_settle_price numeric, p_settle_price_source text, p_settle_price_ts timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_pos public.seconds_contract_positions%rowtype; v_available numeric; v_frozen numeric;
        v_op_id uuid; v_pnl numeric; v_credit numeric; v_win boolean; v_tie boolean;
        v_now timestamptz := clock_timestamp();
begin
  if coalesce(p_user_id,'')='' or p_position_id !~ '^SC[A-Fa-f0-9]{30}$'
     or p_request_id !~ '^[A-Za-z0-9_-]{16,100}$' or length(coalesce(p_request_hash,''))<>64
     or p_symbol not in ('BTC','ETH','SOL','BNB') or p_settle_price is null or p_settle_price<=0
     or coalesce(p_settle_price_source,'') not in ('coinbase','bybit') or p_settle_price_ts is null
     or p_settle_price_ts > v_now + interval '5 seconds' or p_settle_price_ts < v_now - interval '2 minutes' then
    return jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  end if;
  select * into v_pos from public.seconds_contract_positions where position_id=p_position_id and user_id=p_user_id for update;
  if not found then return jsonb_build_object('ok',false,'code','POSITION_NOT_FOUND'); end if;
  if v_pos.symbol <> p_symbol then return jsonb_build_object('ok',false,'code','SYMBOL_MISMATCH'); end if;
  if v_pos.status='settled' then
    if v_pos.settle_request_id=p_request_id and v_pos.settle_request_hash<>p_request_hash then
      return jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'settled',true,'position_id',v_pos.position_id,
      'win',v_pos.win,'tie',v_pos.tie,'pnl',v_pos.pnl,'settle_price',v_pos.settle_price);
  end if;
  if v_now < v_pos.settle_at then
    return jsonb_build_object('ok',true,'duplicate',false,'settled',false,'settle_at',extract(epoch from v_pos.settle_at)::bigint);
  end if;
  if p_settle_price_ts < v_pos.settle_at then
    return jsonb_build_object('ok',false,'code','SETTLEMENT_PRICE_BEFORE_MATURITY');
  end if;
  v_tie := p_settle_price = v_pos.open_price;
  v_win := (not v_tie) and ((v_pos.direction='up' and p_settle_price>v_pos.open_price)
    or (v_pos.direction='down' and p_settle_price<v_pos.open_price));
  v_pnl := case when v_tie then 0 when v_win then round(v_pos.amount*0.85,18) else -v_pos.amount end;
  v_credit := case when v_tie then v_pos.amount when v_win then v_pos.amount+v_pnl else 0 end;
  insert into public.financial_accounts(user_id,asset) values(p_user_id,'USDT') on conflict do nothing;
  select available,frozen into v_available,v_frozen from public.financial_accounts
    where user_id=p_user_id and asset='USDT' for update;
  if v_frozen < v_pos.amount then return jsonb_build_object('ok',false,'code','FROZEN_BALANCE_INVARIANT'); end if;
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
    values(p_request_id,p_user_id,'USDT','seconds_settle',p_request_hash,
      jsonb_build_object('position_id',p_position_id,'symbol',p_symbol,'direction',v_pos.direction,
        'amount',v_pos.amount,'open_price',v_pos.open_price,'settle_price',p_settle_price,
        'settle_price_source',p_settle_price_source,'settle_price_ts',p_settle_price_ts,
        'pnl',v_pnl,'win',v_win,'tie',v_tie)) returning id into v_op_id;
  update public.financial_accounts set available=available+v_credit,frozen=frozen-v_pos.amount,
    version=version+1,updated_at=v_now where user_id=p_user_id and asset='USDT'
    returning available,frozen into v_available,v_frozen;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
    values(v_op_id,p_user_id,'USDT',v_credit,-v_pos.amount,v_available,v_frozen);
  update public.seconds_contract_positions set status='settled',settle_price=p_settle_price,
    settle_price_source=p_settle_price_source,settle_price_ts=p_settle_price_ts,pnl=v_pnl,
    win=v_win,tie=v_tie,settle_request_id=p_request_id,settle_request_hash=p_request_hash,
    settle_operation_id=v_op_id,settled_at=v_now where position_id=p_position_id;
  return jsonb_build_object('ok',true,'duplicate',false,'settled',true,'position_id',p_position_id,
    'win',v_win,'tie',v_tie,'pnl',v_pnl,'settle_price',p_settle_price);
exception when unique_violation then
  return jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
end; $$;

create or replace function public.read_seconds_positions_v1(p_user_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_open jsonb; v_history jsonb;
begin
  if coalesce(p_user_id,'')='' then return jsonb_build_object('ok',false,'code','INVALID_ARGUMENT'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('position_id',position_id,'symbol',symbol,'direction',direction,
    'amount',amount,'duration_sec',duration_sec,'open_price',open_price,
    'settle_at',extract(epoch from settle_at)::bigint) order by created_at desc),'[]'::jsonb)
    into v_open from public.seconds_contract_positions where user_id=p_user_id and status='open';
  select coalesce(jsonb_agg(jsonb_build_object('position_id',position_id,'symbol',symbol,'direction',direction,
    'amount',amount,'duration_sec',duration_sec,'open_price',open_price,'settle_price',settle_price,
    'pnl',pnl,'win',win,'tie',tie,'settled_at',extract(epoch from settled_at)::bigint) order by settled_at desc),'[]'::jsonb)
    into v_history from (select * from public.seconds_contract_positions where user_id=p_user_id and status='settled'
      order by settled_at desc limit 100) h;
  return jsonb_build_object('ok',true,'open',v_open,'history',v_history);
end; $$;

revoke all on function public.submit_seconds_order_v1(text,text,text,text,numeric,integer,numeric,text,text) from public, anon, authenticated;
revoke all on function public.settle_seconds_position_v1(text,text,text,text,text,numeric,text,timestamptz) from public, anon, authenticated;
revoke all on function public.read_seconds_positions_v1(text) from public, anon, authenticated;
grant execute on function public.submit_seconds_order_v1(text,text,text,text,numeric,integer,numeric,text,text) to service_role;
grant execute on function public.settle_seconds_position_v1(text,text,text,text,text,numeric,text,timestamptz) to service_role;
grant execute on function public.read_seconds_positions_v1(text) to service_role;
