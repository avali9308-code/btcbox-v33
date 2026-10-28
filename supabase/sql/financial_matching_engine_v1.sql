-- BTCBOX durable limit-order matching engine v1.
-- Apply only in an isolated Supabase staging project after financial_ledger_v1.sql,
-- financial_lifecycle_v2.sql and financial_spot_trade_v3.sql. Do not enable the API
-- adapter until this migration has been exercised against real PostgreSQL transactions.

alter table public.financial_operations drop constraint if exists financial_operations_operation_type_check;
alter table public.financial_operations add constraint financial_operations_operation_type_check
  check (operation_type in ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject',
    'earn_subscribe','earn_redeem','admin_adjustment','spot_trade','spot_order_reserve',
    'spot_order_cancel','migration_opening_balance'));

-- Server-owned pair rules. A pair must be explicitly enabled before orders are accepted.
-- min_limit_price/max_limit_price are static absolute bounds; dynamic reference-price
-- bands require a trusted price feed and must not be implied by these columns.
create table if not exists public.financial_matching_markets (
  base_asset text not null check (base_asset ~ '^[A-Z0-9]{2,16}$'),
  quote_asset text not null check (quote_asset ~ '^[A-Z0-9]{2,16}$'),
  enabled boolean not null default false,
  price_tick numeric(38,18) not null check (price_tick > 0),
  quantity_step numeric(38,18) not null check (quantity_step > 0),
  min_quantity numeric(38,18) not null check (min_quantity > 0),
  min_notional numeric(38,18) not null default 0 check (min_notional >= 0),
  -- Fees are deliberately required to be zero until fee debiting/crediting is implemented atomically.
  maker_fee_rate numeric(12,10) not null default 0 check (maker_fee_rate = 0),
  taker_fee_rate numeric(12,10) not null default 0 check (taker_fee_rate = 0),
  max_limit_price numeric(38,18),
  min_limit_price numeric(38,18),
  updated_at timestamptz not null default now(),
  primary key (base_asset, quote_asset),
  check (base_asset <> quote_asset),
  check (max_limit_price is null or max_limit_price > 0),
  check (min_limit_price is null or min_limit_price > 0),
  check (min_limit_price is null or max_limit_price is null or min_limit_price <= max_limit_price)
);
alter table public.financial_matching_markets enable row level security;
revoke all on public.financial_matching_markets from public, anon, authenticated;
grant select on public.financial_matching_markets to service_role;

create table if not exists public.financial_matching_orders (
  id text primary key,
  user_id text not null,
  base_asset text not null check (base_asset ~ '^[A-Z0-9]{2,16}$'),
  quote_asset text not null check (quote_asset ~ '^[A-Z0-9]{2,16}$'),
  side text not null check (side in ('buy','sell')),
  price numeric(38,18) not null check (price > 0),
  quantity numeric(38,18) not null check (quantity > 0),
  remaining_quantity numeric(38,18) not null check (remaining_quantity >= 0 and remaining_quantity <= quantity),
  status text not null check (status in ('open','partially_filled','filled','cancelled')),
  client_order_id text not null check (length(client_order_id) between 16 and 100),
  reserve_asset text not null,
  reserved_remaining numeric(38,18) not null check (reserved_remaining >= 0),
  reserve_operation_id uuid not null unique references public.financial_operations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_order_id),
  check (base_asset <> quote_asset),
  check ((side = 'buy' and reserve_asset = quote_asset) or (side = 'sell' and reserve_asset = base_asset)),
  check ((status in ('filled','cancelled') and remaining_quantity = 0 and reserved_remaining = 0)
      or (status in ('open','partially_filled') and remaining_quantity > 0))
);
create index if not exists financial_matching_book_asks_idx
  on public.financial_matching_orders(base_asset, quote_asset, price asc, created_at asc, id)
  where side='sell' and status in ('open','partially_filled');
create index if not exists financial_matching_book_bids_idx
  on public.financial_matching_orders(base_asset, quote_asset, price desc, created_at asc, id)
  where side='buy' and status in ('open','partially_filled');
create index if not exists financial_matching_orders_user_idx
  on public.financial_matching_orders(user_id, created_at desc);

create table if not exists public.financial_matching_trades (
  id uuid primary key default gen_random_uuid(),
  pair_key text not null,
  base_asset text not null,
  quote_asset text not null,
  maker_order_id text not null references public.financial_matching_orders(id),
  taker_order_id text not null references public.financial_matching_orders(id),
  buyer_user_id text not null,
  seller_user_id text not null,
  price numeric(38,18) not null check (price > 0),
  quantity numeric(38,18) not null check (quantity > 0),
  quote_amount numeric(38,18) not null check (quote_amount > 0),
  operation_id uuid not null unique references public.financial_operations(id),
  created_at timestamptz not null default now(),
  check (buyer_user_id <> seller_user_id)
);
create index if not exists financial_matching_trades_pair_time_idx
  on public.financial_matching_trades(pair_key, created_at desc);

alter table public.financial_matching_orders enable row level security;
alter table public.financial_matching_trades enable row level security;
revoke all on public.financial_matching_orders, public.financial_matching_trades from public, anon, authenticated;
grant select, insert, update on public.financial_matching_orders to service_role;
grant select, insert on public.financial_matching_trades to service_role;

create or replace function public.submit_limit_order_matching_v1(
  p_order_id text, p_user_id text, p_base_asset text, p_quote_asset text,
  p_side text, p_price numeric, p_quantity numeric, p_client_order_id text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_existing public.financial_matching_orders%rowtype;
  v_order public.financial_matching_orders%rowtype;
  v_maker public.financial_matching_orders%rowtype;
  v_op public.financial_operations%rowtype;
  v_fill_op public.financial_operations%rowtype;
  v_operation_id uuid;
  v_fill_id uuid;
  v_fill numeric(38,18);
  v_exec_price numeric(38,18);
  v_quote numeric(38,18);
  v_buyer text;
  v_seller text;
  v_buyer_limit numeric(38,18);
  v_buyer_frozen_delta numeric(38,18);
  v_buyer_quote_after numeric(38,18);
  v_buyer_quote_frozen_after numeric(38,18);
  v_buyer_base_after numeric(38,18);
  v_buyer_base_frozen_after numeric(38,18);
  v_seller_quote_after numeric(38,18);
  v_seller_quote_frozen_after numeric(38,18);
  v_seller_base_after numeric(38,18);
  v_seller_base_frozen_after numeric(38,18);
  v_reserve numeric(38,18);
  v_reserve_asset text;
  v_request_hash text;
  v_pair text;
  v_market public.financial_matching_markets%rowtype;
begin
  if coalesce(p_order_id,'') = '' or coalesce(p_user_id,'') = '' or
     coalesce(p_base_asset,'') !~ '^[A-Z0-9]{2,16}$' or coalesce(p_quote_asset,'') !~ '^[A-Z0-9]{2,16}$' or
     p_base_asset = p_quote_asset or coalesce(p_side,'') not in ('buy','sell') or
     p_price is null or p_price <= 0 or p_quantity is null or p_quantity <= 0 or
     coalesce(p_client_order_id,'') !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'invalid limit order';
  end if;
  v_pair := p_base_asset || '/' || p_quote_asset;
  -- Pair rules are controlled by operators in PostgreSQL, never by browser input.
  select * into v_market from public.financial_matching_markets
    where base_asset=p_base_asset and quote_asset=p_quote_asset and enabled=true;
  if not found then raise exception 'market disabled or unconfigured'; end if;
  if mod(p_price, v_market.price_tick) <> 0 then raise exception 'price precision invalid'; end if;
  if mod(p_quantity, v_market.quantity_step) <> 0 then raise exception 'quantity precision invalid'; end if;
  if p_quantity < v_market.min_quantity then raise exception 'quantity below minimum'; end if;
  if p_price*p_quantity < v_market.min_notional then raise exception 'notional below minimum'; end if;
  if v_market.min_limit_price is not null and p_price < v_market.min_limit_price then raise exception 'price below protection bound'; end if;
  if v_market.max_limit_price is not null and p_price > v_market.max_limit_price then raise exception 'price above protection bound'; end if;
  v_request_hash := encode(extensions.digest(concat_ws(':',p_user_id,v_pair,p_side,p_price::text,p_quantity::text),'sha256'),'hex');
  -- Serialize matching per market. This is deliberately durable DB locking, not process memory.
  perform pg_advisory_xact_lock(hashtextextended(v_pair, 0));

  select * into v_existing from public.financial_matching_orders
    where user_id=p_user_id and client_order_id=p_client_order_id;
  if found then
    if v_existing.base_asset <> p_base_asset or v_existing.quote_asset <> p_quote_asset or
       v_existing.side <> p_side or v_existing.price <> p_price or v_existing.quantity <> p_quantity then
      raise exception 'client order id payload mismatch';
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_existing.id,
      'status',v_existing.status,'remaining_quantity',v_existing.remaining_quantity);
  end if;

  v_reserve := case when p_side='buy' then p_price*p_quantity else p_quantity end;
  v_reserve_asset := case when p_side='buy' then p_quote_asset else p_base_asset end;
  if v_reserve <= 0 then raise exception 'invalid reserve'; end if;
  insert into public.financial_accounts(user_id,asset) values (p_user_id,v_reserve_asset) on conflict do nothing;
  perform 1 from public.financial_accounts where user_id=p_user_id and asset=v_reserve_asset for update;

  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values ('spot-reserve-'||encode(extensions.digest(p_user_id||':'||p_client_order_id,'sha256'),'hex'),p_user_id,v_reserve_asset,'spot_order_reserve',v_request_hash,
    jsonb_build_object('order_id',p_order_id,'pair',v_pair,'side',p_side,'price',p_price,'quantity',p_quantity))
  returning id into v_operation_id;

  update public.financial_accounts
     set available=available-v_reserve, frozen=frozen+v_reserve, version=version+1, updated_at=now()
   where user_id=p_user_id and asset=v_reserve_asset and available >= v_reserve;
  if not found then raise exception 'insufficient funds'; end if;
  select available,frozen into v_buyer_quote_after,v_buyer_quote_frozen_after
    from public.financial_accounts where user_id=p_user_id and asset=v_reserve_asset;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  values (v_operation_id,p_user_id,v_reserve_asset,-v_reserve,v_reserve,v_buyer_quote_after,v_buyer_quote_frozen_after);

  insert into public.financial_matching_orders(id,user_id,base_asset,quote_asset,side,price,quantity,
      remaining_quantity,status,client_order_id,reserve_asset,reserved_remaining,reserve_operation_id)
  values (p_order_id,p_user_id,p_base_asset,p_quote_asset,p_side,p_price,p_quantity,p_quantity,'open',
      p_client_order_id,v_reserve_asset,v_reserve,v_operation_id);

  loop
    select * into v_order from public.financial_matching_orders where id=p_order_id for update;
    exit when v_order.remaining_quantity <= 0;
    select * into v_maker from public.financial_matching_orders
      where base_asset=p_base_asset and quote_asset=p_quote_asset and side <> p_side
        and status in ('open','partially_filled') and user_id <> p_user_id
        and ((p_side='buy' and price <= p_price) or (p_side='sell' and price >= p_price))
      order by case when p_side='buy' then price end asc,
               case when p_side='sell' then price end desc, created_at asc, id asc
      limit 1 for update;
    exit when not found;

    v_fill := least(v_order.remaining_quantity,v_maker.remaining_quantity);
    v_exec_price := v_maker.price; -- maker price; price-time priority is defined by the locked market queue.
    v_quote := v_fill * v_exec_price;
    v_buyer := case when p_side='buy' then p_user_id else v_maker.user_id end;
    v_seller := case when p_side='sell' then p_user_id else v_maker.user_id end;
    v_buyer_limit := case when p_side='buy' then p_price else v_maker.price end;
    v_buyer_frozen_delta := v_fill * v_buyer_limit;

    insert into public.financial_accounts(user_id,asset)
      values (v_buyer,p_base_asset),(v_buyer,p_quote_asset),(v_seller,p_base_asset),(v_seller,p_quote_asset)
      on conflict do nothing;
    -- Lock all four accounts in a stable key order before applying the fill.
    perform 1 from public.financial_accounts
      where (user_id=v_buyer and asset in (p_base_asset,p_quote_asset))
         or (user_id=v_seller and asset in (p_base_asset,p_quote_asset))
      order by user_id,asset for update;

    -- Buyer pays execution price from reserved quote; any limit-price improvement is released.
    update public.financial_accounts set frozen=frozen-v_buyer_frozen_delta,
      available=available+(v_buyer_frozen_delta-v_quote),version=version+1,updated_at=now()
      where user_id=v_buyer and asset=p_quote_asset and frozen >= v_buyer_frozen_delta;
    if not found then raise exception 'buyer reservation invariant failed'; end if;
    update public.financial_accounts set available=available+v_fill,version=version+1,updated_at=now()
      where user_id=v_buyer and asset=p_base_asset;
    update public.financial_accounts set frozen=frozen-v_fill,version=version+1,updated_at=now()
      where user_id=v_seller and asset=p_base_asset and frozen >= v_fill;
    if not found then raise exception 'seller reservation invariant failed'; end if;
    update public.financial_accounts set available=available+v_quote,version=version+1,updated_at=now()
      where user_id=v_seller and asset=p_quote_asset;

    insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
    values ('spot-fill-'||gen_random_uuid()::text,v_buyer,p_quote_asset,'spot_trade',
      encode(extensions.digest(concat_ws(':',p_order_id,v_maker.id,v_fill::text,v_exec_price::text),'sha256'),'hex'),
      jsonb_build_object('pair',v_pair,'maker_order_id',v_maker.id,'taker_order_id',p_order_id,'quantity',v_fill,'price',v_exec_price))
    returning id into v_fill_id;

    select available,frozen into v_buyer_base_after,v_buyer_base_frozen_after from public.financial_accounts where user_id=v_buyer and asset=p_base_asset;
    select available,frozen into v_buyer_quote_after,v_buyer_quote_frozen_after from public.financial_accounts where user_id=v_buyer and asset=p_quote_asset;
    select available,frozen into v_seller_base_after,v_seller_base_frozen_after from public.financial_accounts where user_id=v_seller and asset=p_base_asset;
    select available,frozen into v_seller_quote_after,v_seller_quote_frozen_after from public.financial_accounts where user_id=v_seller and asset=p_quote_asset;
    insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after) values
      (v_fill_id,v_buyer,p_base_asset,v_fill,0,v_buyer_base_after,v_buyer_base_frozen_after),
      (v_fill_id,v_buyer,p_quote_asset,v_buyer_frozen_delta-v_quote,-v_buyer_frozen_delta,v_buyer_quote_after,v_buyer_quote_frozen_after),
      (v_fill_id,v_seller,p_base_asset,0,-v_fill,v_seller_base_after,v_seller_base_frozen_after),
      (v_fill_id,v_seller,p_quote_asset,v_quote,0,v_seller_quote_after,v_seller_quote_frozen_after);

    insert into public.financial_matching_trades(pair_key,base_asset,quote_asset,maker_order_id,taker_order_id,
      buyer_user_id,seller_user_id,price,quantity,quote_amount,operation_id)
    values (v_pair,p_base_asset,p_quote_asset,v_maker.id,p_order_id,v_buyer,v_seller,v_exec_price,v_fill,v_quote,v_fill_id);

    update public.financial_matching_orders set remaining_quantity=remaining_quantity-v_fill,
      reserved_remaining=reserved_remaining-(case when side='buy' then v_fill*price else v_fill end),
      status=case when remaining_quantity-v_fill=0 then 'filled' else 'partially_filled' end,updated_at=now()
      where id in (p_order_id,v_maker.id);
  end loop;

  select * into v_order from public.financial_matching_orders where id=p_order_id;
  return jsonb_build_object('ok',true,'duplicate',false,'order_id',v_order.id,'status',v_order.status,
    'price',v_order.price,'quantity',v_order.quantity,'remaining_quantity',v_order.remaining_quantity,
    'reserved_remaining',v_order.reserved_remaining);
end;
$$;

create or replace function public.cancel_limit_order_matching_v1(
  p_user_id text, p_order_id text, p_client_cancel_id text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_order public.financial_matching_orders%rowtype;
  v_op uuid;
  v_available numeric(38,18);
  v_frozen numeric(38,18);
  v_hash text;
begin
  if coalesce(p_user_id,'')='' or coalesce(p_order_id,'')='' or
     coalesce(p_client_cancel_id,'') !~ '^[A-Za-z0-9_-]{16,100}$' then raise exception 'invalid cancel request'; end if;
  -- Acquire market lock before row lock, matching submit's lock order to avoid deadlocks.
  select * into v_order from public.financial_matching_orders where id=p_order_id and user_id=p_user_id;
  if not found then raise exception 'order not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order.base_asset||'/'||v_order.quote_asset,0));
  select * into v_order from public.financial_matching_orders where id=p_order_id and user_id=p_user_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status='cancelled' then return jsonb_build_object('ok',true,'duplicate',true,'order_id',p_order_id,'status','cancelled'); end if;
  if v_order.status='filled' then raise exception 'filled order cannot be cancelled'; end if;
  perform 1 from public.financial_accounts where user_id=p_user_id and asset=v_order.reserve_asset for update;
  v_hash := encode(extensions.digest(concat_ws(':',p_user_id,p_order_id,v_order.reserved_remaining::text),'sha256'),'hex');
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values ('spot-cancel-'||encode(extensions.digest(p_user_id||':'||p_client_cancel_id,'sha256'),'hex'),p_user_id,v_order.reserve_asset,'spot_order_cancel',v_hash,
    jsonb_build_object('order_id',p_order_id,'released',v_order.reserved_remaining)) returning id into v_op;
  update public.financial_accounts set available=available+v_order.reserved_remaining,
    frozen=frozen-v_order.reserved_remaining,version=version+1,updated_at=now()
    where user_id=p_user_id and asset=v_order.reserve_asset and frozen>=v_order.reserved_remaining;
  if not found then raise exception 'order reservation invariant failed'; end if;
  select available,frozen into v_available,v_frozen from public.financial_accounts where user_id=p_user_id and asset=v_order.reserve_asset;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  values (v_op,p_user_id,v_order.reserve_asset,v_order.reserved_remaining,-v_order.reserved_remaining,v_available,v_frozen);
  update public.financial_matching_orders set status='cancelled',remaining_quantity=0,reserved_remaining=0,updated_at=now() where id=p_order_id;
  return jsonb_build_object('ok',true,'duplicate',false,'order_id',p_order_id,'status','cancelled');
end;
$$;

revoke all on function public.submit_limit_order_matching_v1(text,text,text,text,text,numeric,numeric,text) from public, anon, authenticated;
revoke all on function public.cancel_limit_order_matching_v1(text,text,text) from public, anon, authenticated;
grant execute on function public.submit_limit_order_matching_v1(text,text,text,text,text,numeric,numeric,text) to service_role;
grant execute on function public.cancel_limit_order_matching_v1(text,text,text) to service_role;
