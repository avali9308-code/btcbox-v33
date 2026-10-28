-- BTCBOX transactional financial ledger v1.
-- Apply ONLY to a dedicated staging/test Supabase project first.
-- This schema is additive and does not import or mutate legacy Blobs data.
create extension if not exists pgcrypto;

create table if not exists public.financial_accounts (
  user_id text not null,
  asset text not null check (asset ~ '^[A-Z0-9]{2,16}$'),
  available numeric(38,18) not null default 0 check (available >= 0),
  frozen numeric(38,18) not null default 0 check (frozen >= 0),
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, asset)
);

create table if not exists public.financial_operations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (length(idempotency_key) between 16 and 128),
  user_id text not null,
  asset text not null,
  operation_type text not null check (operation_type in ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject','earn_subscribe','earn_redeem','admin_adjustment','migration_opening_balance')),
  request_hash text not null,
  status text not null default 'applied' check (status in ('applied')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_ledger (
  id bigint generated always as identity primary key,
  operation_id uuid not null references public.financial_operations(id),
  user_id text not null,
  asset text not null,
  available_delta numeric(38,18) not null,
  frozen_delta numeric(38,18) not null,
  available_after numeric(38,18) not null check (available_after >= 0),
  frozen_after numeric(38,18) not null check (frozen_after >= 0),
  created_at timestamptz not null default now(),
  unique (operation_id, user_id, asset)
);

create table if not exists public.withdrawal_requests (
  id text primary key,
  user_id text not null,
  asset text not null,
  network text not null,
  amount numeric(38,18) not null check (amount > 0),
  fee numeric(38,18) not null check (fee >= 0),
  destination text not null,
  status text not null check (status in ('pending','approved','rejected','broadcast','failed')),
  request_id text not null unique,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.deposit_records (
  id text primary key,
  user_id text not null,
  asset text not null,
  network text not null,
  amount numeric(38,18) not null check (amount > 0),
  txid text,
  status text not null check (status in ('pending','confirmed','rejected')),
  idempotency_key text not null unique,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.earn_positions (
  id text primary key,
  user_id text not null,
  product_id text not null,
  asset text not null,
  principal numeric(38,18) not null check (principal > 0),
  status text not null check (status in ('active','redeemed','matured')),
  subscribe_operation_id uuid not null unique references public.financial_operations(id),
  redeem_operation_id uuid unique references public.financial_operations(id),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create table if not exists public.financial_audit_log (
  id bigint generated always as identity primary key,
  actor_id text not null,
  subject_user_id text,
  action text not null,
  object_type text,
  object_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_user_asset_time_idx on public.financial_ledger(user_id, asset, created_at desc);
create index if not exists withdrawal_requests_user_time_idx on public.withdrawal_requests(user_id, created_at desc);
create index if not exists withdrawal_requests_status_time_idx on public.withdrawal_requests(status, created_at);
create index if not exists deposit_records_user_time_idx on public.deposit_records(user_id, created_at desc);
create index if not exists financial_audit_subject_time_idx on public.financial_audit_log(subject_user_id, created_at desc);

-- One atomic primitive for all single-user/single-asset balance movements.
-- Deltas are signed; database checks reject any result below zero.
-- Same key + same payload returns duplicate=true without applying twice.
-- Same key + different payload raises an error (HTTP layer should map to 409).
create or replace function public.apply_financial_operation(
  p_idempotency_key text,
  p_user_id text,
  p_asset text,
  p_operation_type text,
  p_available_delta numeric,
  p_frozen_delta numeric,
  p_request_hash text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_op public.financial_operations%rowtype;
  v_available numeric(38,18);
  v_frozen numeric(38,18);
  v_operation_id uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 128
     or p_user_id is null or p_user_id = '' or p_asset is null or p_asset !~ '^[A-Z0-9]{2,16}$'
     or p_operation_type not in ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject','earn_subscribe','earn_redeem','admin_adjustment')
     or p_request_hash is null or p_request_hash = ''
     or p_metadata is null or jsonb_typeof(p_metadata) <> 'object'
     or p_available_delta is null or p_frozen_delta is null
     or (p_available_delta = 0 and p_frozen_delta = 0) then
    raise exception 'invalid financial operation';
  end if;

  -- Serialize duplicate idempotency keys before touching balances.
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values (p_idempotency_key,p_user_id,p_asset,p_operation_type,p_request_hash,p_metadata)
  on conflict (idempotency_key) do nothing;

  select * into v_op from public.financial_operations where idempotency_key = p_idempotency_key for update;
  if v_op.user_id <> p_user_id or v_op.asset <> p_asset or v_op.operation_type <> p_operation_type or v_op.request_hash <> p_request_hash then
    raise exception 'idempotency key payload mismatch';
  end if;
  if exists (select 1 from public.financial_ledger where operation_id = v_op.id) then
    select available, frozen into v_available, v_frozen from public.financial_accounts where user_id=p_user_id and asset=p_asset;
    return jsonb_build_object('ok',true,'duplicate',true,'operation_id',v_op.id,'available',v_available,'frozen',v_frozen);
  end if;

  insert into public.financial_accounts(user_id,asset) values (p_user_id,p_asset) on conflict do nothing;
  select available, frozen into v_available, v_frozen
    from public.financial_accounts where user_id=p_user_id and asset=p_asset for update;
  if v_available + p_available_delta < 0 or v_frozen + p_frozen_delta < 0 then
    raise exception 'insufficient funds';
  end if;
  update public.financial_accounts
     set available = available + p_available_delta,
         frozen = frozen + p_frozen_delta,
         version = version + 1,
         updated_at = now()
   where user_id=p_user_id and asset=p_asset
   returning available, frozen into v_available, v_frozen;

  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  values (v_op.id,p_user_id,p_asset,p_available_delta,p_frozen_delta,v_available,v_frozen);
  return jsonb_build_object('ok',true,'duplicate',false,'operation_id',v_op.id,'available',v_available,'frozen',v_frozen);
end;
$$;

alter table public.financial_accounts enable row level security;
alter table public.financial_operations enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.deposit_records enable row level security;
alter table public.earn_positions enable row level security;
alter table public.financial_audit_log enable row level security;

revoke all on public.financial_accounts, public.financial_operations, public.financial_ledger,
  public.withdrawal_requests, public.deposit_records, public.earn_positions, public.financial_audit_log
  from public, anon, authenticated;
revoke all on function public.apply_financial_operation(text,text,text,text,numeric,numeric,text,jsonb) from public, anon, authenticated;
grant select, insert, update on public.financial_accounts, public.financial_operations, public.financial_ledger,
  public.withdrawal_requests, public.deposit_records, public.earn_positions, public.financial_audit_log to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.apply_financial_operation(text,text,text,text,numeric,numeric,text,jsonb) to service_role;
