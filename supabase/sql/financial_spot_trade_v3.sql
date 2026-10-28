-- BTCBOX spot trade transaction v3.
-- Apply after financial_ledger_v1.sql and financial_lifecycle_v2.sql in staging first.
-- The function atomically records the order and both asset balance movements.
-- It is NOT a matching engine: this only records a caller-validated simulated/market fill.

alter table public.financial_operations drop constraint if exists financial_operations_operation_type_check;
alter table public.financial_operations add constraint financial_operations_operation_type_check
  check (operation_type in ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject','earn_subscribe','earn_redeem','admin_adjustment','spot_trade','migration_opening_balance'));

create table if not exists public.financial_spot_orders (
  id text primary key,
  user_id text not null,
  base_asset text not null,
  quote_asset text not null,
  side text not null check (side in ('buy','sell')),
  order_type text not null check (order_type in ('market','limit')),
  price numeric(38,18) not null check (price > 0),
  quantity numeric(38,18) not null check (quantity > 0),
  quote_amount numeric(38,18) not null check (quote_amount > 0),
  status text not null check (status = 'filled'),
  idempotency_key text not null unique,
  operation_id uuid not null unique references public.financial_operations(id),
  created_at timestamptz not null default now(),
  check (base_asset <> quote_asset)
);
create index if not exists financial_spot_orders_user_time_idx on public.financial_spot_orders(user_id, created_at desc);
alter table public.financial_spot_orders enable row level security;
revoke all on public.financial_spot_orders from public, anon, authenticated;
grant select, insert, update on public.financial_spot_orders to service_role;

create or replace function public.execute_spot_trade_atomic(
  p_order_id text,
  p_user_id text,
  p_base_asset text,
  p_quote_asset text,
  p_side text,
  p_order_type text,
  p_price numeric,
  p_quantity numeric,
  p_idempotency_key text,
  p_request_hash text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_op public.financial_operations%rowtype;
  v_order public.financial_spot_orders%rowtype;
  v_quote numeric(38,18);
  v_base_available numeric(38,18);
  v_base_frozen numeric(38,18);
  v_quote_available numeric(38,18);
  v_quote_frozen numeric(38,18);
  v_base_delta numeric(38,18);
  v_quote_delta numeric(38,18);
  v_operation_id uuid;
  v_hash text;
begin
  if coalesce(p_order_id,'') = '' or coalesce(p_user_id,'') = '' or
     coalesce(p_base_asset,'') !~ '^[A-Z0-9]{2,16}$' or coalesce(p_quote_asset,'') !~ '^[A-Z0-9]{2,16}$' or
     p_base_asset = p_quote_asset or p_side not in ('buy','sell') or p_order_type not in ('market','limit') or
     p_price is null or p_price <= 0 or p_quantity is null or p_quantity <= 0 or
     length(coalesce(p_idempotency_key,'')) < 16 or length(p_idempotency_key) > 128 or
     coalesce(p_request_hash,'') = '' then
    raise exception 'invalid spot trade request';
  end if;

  v_quote := p_price * p_quantity;
  if v_quote <= 0 then raise exception 'invalid quote amount'; end if;
  v_hash := encode(extensions.digest(
    p_user_id || ':' || p_base_asset || ':' || p_quote_asset || ':' || p_side || ':' ||
    p_order_type || ':' || p_price::text || ':' || p_quantity::text || ':' || p_request_hash,
    'sha256'), 'hex');

  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values (p_idempotency_key,p_user_id,p_quote_asset,'spot_trade',v_hash,
          jsonb_build_object('order_id',p_order_id,'base_asset',p_base_asset,'quote_asset',p_quote_asset,'side',p_side))
  on conflict (idempotency_key) do nothing;
  select * into v_op from public.financial_operations where idempotency_key=p_idempotency_key for update;
  if v_op.user_id <> p_user_id or v_op.asset <> p_quote_asset or v_op.operation_type <> 'spot_trade' or v_op.request_hash <> v_hash then
    raise exception 'idempotency key payload mismatch';
  end if;

  select * into v_order from public.financial_spot_orders where idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_order.id,'status',v_order.status,
      'price',v_order.price,'quantity',v_order.quantity,'quote_amount',v_order.quote_amount);
  end if;

  insert into public.financial_accounts(user_id,asset) values (p_user_id,p_base_asset) on conflict do nothing;
  insert into public.financial_accounts(user_id,asset) values (p_user_id,p_quote_asset) on conflict do nothing;
  -- Lock accounts in a deterministic order to reduce deadlock risk.
  perform 1 from public.financial_accounts
   where user_id=p_user_id and asset in (p_base_asset,p_quote_asset)
   order by asset for update;

  select available,frozen into v_base_available,v_base_frozen from public.financial_accounts where user_id=p_user_id and asset=p_base_asset;
  select available,frozen into v_quote_available,v_quote_frozen from public.financial_accounts where user_id=p_user_id and asset=p_quote_asset;
  if p_side='buy' then
    if v_quote_available < v_quote then raise exception 'insufficient quote funds'; end if;
    v_base_delta := p_quantity; v_quote_delta := -v_quote;
    v_quote_available := v_quote_available - v_quote;
    v_base_available := v_base_available + p_quantity;
  else
    if v_base_available < p_quantity then raise exception 'insufficient base funds'; end if;
    v_base_delta := -p_quantity; v_quote_delta := v_quote;
    v_base_available := v_base_available - p_quantity;
    v_quote_available := v_quote_available + v_quote;
  end if;

  update public.financial_accounts set available=v_base_available,version=version+1,updated_at=now()
    where user_id=p_user_id and asset=p_base_asset;
  update public.financial_accounts set available=v_quote_available,version=version+1,updated_at=now()
    where user_id=p_user_id and asset=p_quote_asset;

  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  values (v_op.id,p_user_id,p_base_asset,v_base_delta,0,v_base_available,v_base_frozen),
         (v_op.id,p_user_id,p_quote_asset,v_quote_delta,0,v_quote_available,v_quote_frozen);
  insert into public.financial_spot_orders(id,user_id,base_asset,quote_asset,side,order_type,price,quantity,quote_amount,status,idempotency_key,operation_id)
  values (p_order_id,p_user_id,p_base_asset,p_quote_asset,p_side,p_order_type,p_price,p_quantity,v_quote,'filled',p_idempotency_key,v_op.id);

  return jsonb_build_object('ok',true,'duplicate',false,'order_id',p_order_id,'status','filled',
    'price',p_price,'quantity',p_quantity,'quote_amount',v_quote,
    'base_available',v_base_available,'quote_available',v_quote_available);
end;
$$;

revoke all on function public.execute_spot_trade_atomic(text,text,text,text,text,text,numeric,numeric,text,text) from public, anon, authenticated;
grant execute on function public.execute_spot_trade_atomic(text,text,text,text,text,text,numeric,numeric,text,text) to service_role;
