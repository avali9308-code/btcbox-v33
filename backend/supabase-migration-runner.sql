-- ============================================================================
-- BTCBOX Supabase 迁移一键执行文件 (supabase-migration-runner.sql)
-- 生成时间: 2026-11-01
-- 适用项目: https://zlozsutefnmgwwzrlipt.supabase.co
--
-- 【傻瓜操作步骤】
-- 1. 打开 Supabase Dashboard → 选中 zlozsutefnmgwwzrlipt 项目 → SQL Editor
-- 2. 点击 "New query"，把本文件全部内容 (从本行往下所有内容) 复制粘贴进去
-- 3. 点击右下角 "Run" (或按 Ctrl+Enter)，等待执行完成
-- 4. 看到 "Success. No rows returned" 即表示全部迁移成功
-- 5. 若报错，把错误信息截图，通常是某张表已存在(可忽略)或某RPC签名冲突(需先DROP)
--
-- 【包含的迁移(按依赖顺序)】
--   0. btcbox_state_cas.sql                    (基础状态表)
--   1. financial_ledger_v1.sql                 (交易账本)
--   2. financial_lifecycle_v2.sql              (资金生命周期RPC)
--   3. financial_admin_adjustment_v1.sql       (管理员调账+充值txid去重)
--   4. financial_earn_redemption_idempotency_v4.sql (理财赎回幂等)
--   5. financial_earn_policy_v5.sql            (理财产品策略)
--   6. financial_admin_manual_deposit_v1.sql   (管理员手动充值入账RPC)
--   7. financial_spot_trade_v3.sql             (现货交易原子RPC)
--   8. financial_matching_engine_v1.sql        (限价单撮合引擎)
--   9. financial_read_api_v1.sql               (账户快照读RPC)
--  10. financial_read_api_earn_v1.sql          (含理财持仓的读RPC)
--  11. financial_admin_read_api_v1.sql         (管理员提现读RPC)
--  12. financial_admin_account_read_api_v1.sql (管理员账户读RPC)
--  13. financial_seconds_contracts_v1.sql      (秒合约生命周期)
--  14. financial_deposit_chain_verification_v3.sql (链上自动核验,可选,已包含)
--
-- 【注意】所有资金RPC均为 service_role  ONLY，浏览器端无法直接调用。
--         执行完本SQL后，资金写入开关已在代码默认开启，若表未建好会返回明确错误(503)，
--         不会静默丢钱；执行完本SQL即具备真实资金写入能力。
-- ============================================================================


-- ============================================================================
-- >>> 迁移文件: btcbox_state_cas.sql
-- ============================================================================
-- BTCBOX single-state CAS storage adapter.
-- Apply only after a verified export/backup and only to the intended btcbox project.
-- This schema does NOT import existing Netlify Blobs data.

create table if not exists public.btcbox_state (
  id text primary key check (id = 'main'),
  revision bigint not null check (revision >= 1),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.btcbox_state enable row level security;
revoke all on table public.btcbox_state from anon, authenticated;
grant select, insert, update on table public.btcbox_state to service_role;

create or replace function public.btcbox_save_state(p_expected_revision bigint, p_data jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or not (p_data ? 'users') then
    raise exception 'invalid BTCBOX state payload';
  end if;

  if p_expected_revision = 0 then
    insert into public.btcbox_state (id, revision, data, updated_at)
    values ('main', 1, p_data, now())
    on conflict (id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count = 1 then
      return true;
    end if;
    return false;
  end if;

  update public.btcbox_state
     set revision = revision + 1,
         data = p_data,
         updated_at = now()
   where id = 'main'
     and revision = p_expected_revision;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.btcbox_save_state(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.btcbox_save_state(bigint, jsonb) to service_role;


-- ============================================================================
-- >>> 迁移文件: financial_ledger_v1.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 迁移文件: financial_lifecycle_v2.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 迁移文件: financial_admin_adjustment_v1.sql
-- ============================================================================
-- BTCBOX Round 75: idempotent admin adjustments and deposit txid uniqueness.
-- Apply to a disposable/staging Supabase project only after running the preflight query below.
-- This migration deliberately refuses to proceed if legacy deposit records contain duplicate non-empty txids.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.deposit_records
    WHERE txid IS NOT NULL AND btrim(txid) <> ''
    GROUP BY lower(btrim(txid)), lower(asset), lower(network)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate deposit txids found; reconcile duplicates before Round 75 migration';
  END IF;
END;
$$;

-- Prevent one on-chain transaction from being credited twice for the same asset/network.
CREATE UNIQUE INDEX IF NOT EXISTS deposit_records_txid_asset_network_uq
  ON public.deposit_records (lower(btrim(txid)), lower(asset), lower(network))
  WHERE txid IS NOT NULL AND btrim(txid) <> '';

-- Once confirmed, immutable identifying and amount fields cannot be edited to disguise a credit.
CREATE OR REPLACE FUNCTION public.guard_confirmed_deposit_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'confirmed' AND (
       NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.asset IS DISTINCT FROM OLD.asset
    OR NEW.network IS DISTINCT FROM OLD.network
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.txid IS DISTINCT FROM OLD.txid
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
  ) THEN
    RAISE EXCEPTION 'confirmed deposit financial fields are immutable';
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
    RAISE EXCEPTION 'confirmed deposit status cannot be reversed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deposit_confirmed_immutable_guard ON public.deposit_records;
CREATE TRIGGER deposit_confirmed_immutable_guard
BEFORE UPDATE ON public.deposit_records
FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_deposit_immutable();

CREATE OR REPLACE FUNCTION public.admin_adjustment_atomic(
  p_request_id text,
  p_admin_id text,
  p_user_id text,
  p_asset text,
  p_available_delta numeric,
  p_frozen_delta numeric,
  p_reason text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_existing public.financial_operations%rowtype;
  v_hash text;
BEGIN
  IF length(coalesce(p_request_id, '')) < 16 OR length(coalesce(p_request_id, '')) > 100
     OR length(coalesce(p_admin_id, '')) = 0
     OR length(coalesce(p_user_id, '')) = 0
     OR coalesce(p_asset, '') !~ '^[A-Z0-9]{2,16}$'
     OR p_available_delta IS NULL OR p_frozen_delta IS NULL
     OR (p_available_delta = 0 AND p_frozen_delta = 0)
     OR length(btrim(coalesce(p_reason, ''))) < 5
     OR length(coalesce(p_request_hash, '')) < 16 THEN
    RAISE EXCEPTION 'invalid admin adjustment request';
  END IF;

  v_hash := encode(extensions.digest(
    concat_ws('|', p_admin_id, p_user_id, p_asset, p_available_delta::text, p_frozen_delta::text, left(btrim(p_reason), 500)),
    'sha256'
  ), 'hex');
  IF p_request_hash <> v_hash THEN
    RAISE EXCEPTION 'request hash does not match adjustment payload';
  END IF;

  SELECT * INTO v_existing
    FROM public.financial_operations
    WHERE idempotency_key = 'admin-adjust:' || p_request_id
    FOR UPDATE;
  IF FOUND THEN
    IF v_existing.user_id <> p_user_id OR v_existing.asset <> p_asset
       OR v_existing.operation_type <> 'admin_adjustment' OR v_existing.request_hash <> v_hash THEN
      RAISE EXCEPTION 'idempotency key payload mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE operation_id = v_existing.id) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'operation_id', v_existing.id);
    END IF;
  END IF;

  v_result := public.apply_financial_operation(
    'admin-adjust:' || p_request_id,
    p_user_id,
    p_asset,
    'admin_adjustment',
    p_available_delta,
    p_frozen_delta,
    v_hash,
    jsonb_build_object('admin_id', p_admin_id, 'reason', left(btrim(p_reason), 500))
  );

  IF coalesce((v_result->>'duplicate')::boolean, false) THEN
    RETURN v_result;
  END IF;

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    p_admin_id, p_user_id, 'admin_balance_adjustment', 'financial_operation',
    v_result->>'operation_id', left(btrim(p_reason), 500),
    jsonb_build_object('asset', p_asset, 'available_delta', p_available_delta, 'frozen_delta', p_frozen_delta,
                       'operation_id', v_result->>'operation_id')
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_confirmed_deposit_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_adjustment_atomic(text,text,text,text,numeric,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjustment_atomic(text,text,text,text,numeric,numeric,text,text) TO service_role;

-- Preflight helper (run separately before applying migration):
-- SELECT lower(btrim(txid)) AS txid, lower(asset) AS asset, lower(network) AS network, count(*)
-- FROM public.deposit_records WHERE txid IS NOT NULL AND btrim(txid) <> ''
-- GROUP BY 1,2,3 HAVING count(*) > 1;


-- ============================================================================
-- >>> 迁移文件: financial_earn_redemption_idempotency_v4.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 迁移文件: financial_earn_policy_v5.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 迁移文件: financial_admin_manual_deposit_v1.sql
-- ============================================================================
-- BTCBOX Round 81: atomic administrator manual deposit credit.
-- STAGING ONLY until legacy JSON-backed balance writers are migrated and reconciled.
-- Run after financial_ledger_v1.sql and financial_lifecycle_v2.sql.

alter table public.deposit_records
  add column if not exists request_hash text,
  add column if not exists source text not null default 'chain',
  add column if not exists reference text,
  add column if not exists note text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.deposit_records
    WHERE source = 'admin_manual' AND reference IS NOT NULL AND btrim(reference) <> ''
    GROUP BY lower(btrim(reference)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate manual deposit references found; reconcile before Round 81 migration';
  END IF;
END;
$$;

create unique index if not exists deposit_records_manual_reference_uq
  on public.deposit_records (lower(btrim(reference)))
  where source = 'admin_manual' and reference is not null and btrim(reference) <> '';

create or replace function public.admin_manual_deposit_atomic(
  p_deposit_id text,
  p_admin_id text,
  p_user_id text,
  p_asset text,
  p_amount numeric,
  p_request_id text,
  p_request_hash text,
  p_reference text default '',
  p_note text default ''
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_d public.deposit_records%rowtype;
  v_result jsonb;
  v_hash text;
  v_op_id uuid;
  v_available numeric;
  v_reference text := left(btrim(coalesce(p_reference, '')), 120);
  v_note text := left(btrim(coalesce(p_note, '')), 300);
begin
  if coalesce(p_deposit_id, '') = '' or coalesce(p_admin_id, '') = '' or
     coalesce(p_user_id, '') = '' or coalesce(p_asset, '') !~ '^[A-Z0-9]{2,16}$' or
     p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') or
     length(coalesce(p_request_id, '')) < 16 or length(coalesce(p_request_id, '')) > 100 or
     coalesce(p_request_hash, '') = '' then
    raise exception 'invalid manual deposit request';
  end if;

  v_hash := encode(extensions.digest(
    concat_ws('|', p_admin_id, p_user_id, p_asset, p_amount::text, v_reference, v_note), 'sha256'
  ), 'hex');
  if p_request_hash <> v_hash then raise exception 'request hash does not match manual deposit payload'; end if;

  -- A deterministic operation key plus row locks makes retries safe across instances.
  insert into public.deposit_records(id, user_id, asset, network, amount, txid, status,
                                     idempotency_key, request_hash, source, reference, note)
  values (p_deposit_id, p_user_id, p_asset, 'MANUAL', p_amount, null, 'pending',
          'admin-manual:' || p_request_id, v_hash, 'admin_manual', nullif(v_reference, ''), v_note)
  on conflict (idempotency_key) do nothing;

  select * into v_d from public.deposit_records
   where idempotency_key = 'admin-manual:' || p_request_id for update;
  if not found then raise exception 'manual deposit request could not be loaded'; end if;
  if v_d.user_id <> p_user_id or v_d.asset <> p_asset or v_d.amount <> p_amount or
     v_d.request_hash is distinct from v_hash or v_d.source <> 'admin_manual' then
    raise exception 'idempotency key payload mismatch';
  end if;
  if v_d.status = 'confirmed' then
    select available into v_available from public.financial_accounts
     where user_id = p_user_id and asset = p_asset;
    return jsonb_build_object('ok', true, 'duplicate', true, 'deposit_id', v_d.id,
                              'status', v_d.status, 'available', coalesce(v_available, 0));
  end if;
  if v_d.status <> 'pending' then raise exception 'manual deposit is not pending'; end if;

  if v_reference <> '' and exists (
    select 1 from public.deposit_records
     where source = 'admin_manual' and lower(btrim(reference)) = lower(v_reference) and id <> v_d.id
  ) then raise exception 'manual deposit reference already used'; end if;

  v_result := public.apply_financial_operation(
    'admin-manual-deposit:' || p_request_id, p_user_id, p_asset, 'deposit_credit',
    p_amount, 0, v_hash,
    jsonb_build_object('deposit_id', v_d.id, 'admin_id', p_admin_id, 'source', 'admin_manual',
                       'reference', v_reference, 'note', v_note)
  );
  v_op_id := (v_result->>'operation_id')::uuid;
  update public.deposit_records set status = 'confirmed', confirmed_by = p_admin_id,
    confirmed_at = now(), credit_operation_id = v_op_id where id = v_d.id;

  insert into public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  values (p_admin_id, p_user_id, 'admin_manual_deposit_confirmed', 'deposit', v_d.id, v_note,
          jsonb_build_object('asset', p_asset, 'amount', p_amount, 'reference', v_reference,
                             'operation_id', v_op_id, 'idempotency_key', 'admin-manual:' || p_request_id));
  return jsonb_build_object('ok', true, 'duplicate', false, 'deposit_id', v_d.id,
                            'status', 'confirmed', 'operation_id', v_op_id,
                            'available', v_result->'available');
end;
$$;

revoke all on function public.admin_manual_deposit_atomic(text,text,text,text,numeric,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_manual_deposit_atomic(text,text,text,text,numeric,text,text,text,text)
  to service_role;


-- ============================================================================
-- >>> 迁移文件: financial_spot_trade_v3.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 迁移文件: financial_matching_engine_v1.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 迁移文件: financial_read_api_v1.sql
-- ============================================================================
-- BTCBOX normalized financial read API v1.
-- Apply to a dedicated staging/test Supabase project first.
-- Read path only; it does not migrate data or enable cutover by itself.
create or replace function public.read_financial_account_snapshot_v1(p_user_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_balances jsonb;
  v_withdrawals jsonb;
begin
  if coalesce(p_user_id, '') = '' or length(p_user_id) > 128 then
    raise exception 'invalid user identity';
  end if;

  select coalesce(jsonb_object_agg(asset, jsonb_build_object(
    'free', available, 'frozen', frozen
  )), '{}'::jsonb)
  into v_balances
  from public.financial_accounts
  where user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'coin', asset,
    'amount', amount,
    'fee', fee,
    'network', network,
    'address', destination,
    'status', status,
    'time', created_at,
    'txid', ''
  ) order by created_at desc), '[]'::jsonb)
  into v_withdrawals
  from (
    select id, asset, amount, fee, network, destination, status, created_at
    from public.withdrawal_requests
    where user_id = p_user_id
    order by created_at desc
    limit 20
  ) recent;

  return jsonb_build_object(
    'ok', true,
    'balances', v_balances,
    'withdrawals', v_withdrawals
  );
end;
$$;

revoke all on function public.read_financial_account_snapshot_v1(text) from public, anon, authenticated;
grant execute on function public.read_financial_account_snapshot_v1(text) to service_role;


-- ============================================================================
-- >>> 迁移文件: financial_read_api_earn_v1.sql
-- ============================================================================
-- BTCBOX normalized financial read API v1 with earn positions.
-- Apply AFTER financial_earn_policy_v5.sql in a disposable/staging Supabase project.
-- Replaces the same read RPC to include normalized earn holdings; read-only, no cutover by itself.
create or replace function public.read_financial_account_snapshot_v1(p_user_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_balances jsonb;
  v_withdrawals jsonb;
  v_earn_records jsonb;
begin
  if coalesce(p_user_id, '') = '' or length(p_user_id) > 128 then
    raise exception 'invalid user identity';
  end if;

  select coalesce(jsonb_object_agg(asset, jsonb_build_object(
    'free', available, 'frozen', frozen
  )), '{}'::jsonb)
  into v_balances
  from public.financial_accounts
  where user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'coin', asset,
    'amount', amount,
    'fee', fee,
    'network', network,
    'address', destination,
    'status', status,
    'time', created_at,
    'txid', ''
  ) order by created_at desc), '[]'::jsonb)
  into v_withdrawals
  from (
    select id, asset, amount, fee, network, destination, status, created_at
    from public.withdrawal_requests
    where user_id = p_user_id
    order by created_at desc
    limit 20
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'product_id', product_id,
    'product', case product_id
      when 'demand' then asset || ' 活期'
      when 'flex_USDT' then 'USDT 活期'
      when 'flex_BTC' then 'BTC 活期'
      when 'flex_ETH' then 'ETH 活期'
      when 'fixed30' then 'USDT 定期 30 天'
      when 'fixed90' then 'USDT 定期 90 天'
      when 'fixed180' then 'USDT 定期 180 天'
      else product_id end,
    'amount', principal,
    'apy', apy_percent,
    'expected_interest', round(principal * apy_percent / 100 / 365 * greatest(term_days, 30), amount_scale),
    'type', case product_type when 'demand' then 'flexible' else 'fixed' end,
    'status', case status when 'active' then '持有中' when 'redeemed' then '已赎回' else status end,
    'start', created_at,
    'end', case when product_type = 'demand' then '随存随取' else to_char(created_at + make_interval(days => term_days), 'YYYY-MM-DD') end
  ) order by created_at desc), '[]'::jsonb)
  into v_earn_records
  from (
    select id, product_id, asset, principal, apy_percent, product_type, term_days, amount_scale, status, created_at
    from public.earn_positions
    where user_id = p_user_id
    order by created_at desc
    limit 50
  ) earn;

  return jsonb_build_object(
    'ok', true,
    'balances', v_balances,
    'withdrawals', v_withdrawals,
    'earn_records', v_earn_records
  );
end;
$$;

revoke all on function public.read_financial_account_snapshot_v1(text) from public, anon, authenticated;
grant execute on function public.read_financial_account_snapshot_v1(text) to service_role;


-- ============================================================================
-- >>> 迁移文件: financial_admin_read_api_v1.sql
-- ============================================================================
-- BTCBOX normalized admin withdrawal reads v1.
-- Apply to staging first; service-role-only and read-only. Does not migrate legacy records.
create or replace function public.read_admin_withdrawal_snapshot_v1()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_withdrawals jsonb;
begin
  select count(*)::integer into v_count
  from public.withdrawal_requests
  where status = 'pending';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'uid', user_id,
    'coin', asset,
    'amount', amount,
    'fee', fee,
    'network', network,
    'address', destination,
    'status', status,
    'txid', '',
    'time', created_at
  ) order by created_at desc), '[]'::jsonb)
  into v_withdrawals
  from (
    select id, user_id, asset, amount, fee, network, destination, status, created_at
    from public.withdrawal_requests
    where status = 'pending'
    order by created_at desc
    limit 200
  ) recent;

  return jsonb_build_object(
    'ok', true,
    'pending_count', v_count,
    'withdrawals', v_withdrawals
  );
end;
$$;

revoke all on function public.read_admin_withdrawal_snapshot_v1() from public, anon, authenticated;
grant execute on function public.read_admin_withdrawal_snapshot_v1() to service_role;


-- ============================================================================
-- >>> 迁移文件: financial_admin_account_read_api_v1.sql
-- ============================================================================
-- BTCBOX normalized admin account balance reads v1.
-- Apply to a dedicated staging/test Supabase project first. Read-only and service-role-only.
-- This RPC does not migrate legacy balances or enable financial cutover.
create or replace function public.read_admin_account_balances_v1(p_user_ids text[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_accounts jsonb;
begin
  if p_user_ids is null or cardinality(p_user_ids) > 200 then
    raise exception 'invalid user identity list';
  end if;
  if exists (
    select 1 from unnest(p_user_ids) as ids(user_id)
    where coalesce(user_id, '') = '' or length(user_id) > 128
  ) then
    raise exception 'invalid user identity';
  end if;

  select coalesce(jsonb_object_agg(user_id, balances), '{}'::jsonb)
  into v_accounts
  from (
    select user_id,
      jsonb_object_agg(asset, jsonb_build_object('free', available, 'frozen', frozen)) as balances
    from public.financial_accounts
    where user_id = any(p_user_ids)
    group by user_id
  ) account_rows;

  return jsonb_build_object('ok', true, 'accounts', v_accounts);
end;
$$;

revoke all on function public.read_admin_account_balances_v1(text[]) from public, anon, authenticated;
grant execute on function public.read_admin_account_balances_v1(text[]) to service_role;


-- ============================================================================
-- >>> 迁移文件: financial_seconds_contracts_v1.sql
-- ============================================================================
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
revoke all on public.seconds_contract_positions from public, anon, authenticated;
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


-- ============================================================================
-- >>> 迁移文件: financial_deposit_chain_verification_v3.sql
-- ============================================================================
-- BTCBOX Round 76: only a trusted chain-verification service may credit deposits.
-- Apply after financial_ledger_v1.sql, financial_lifecycle_v2.sql and
-- financial_admin_adjustment_v1.sql in a disposable staging database first.
-- The verifier must independently prove tx inclusion, destination, asset/network,
-- finality and observed amount before calling this RPC.

ALTER TABLE public.deposit_records
  ADD COLUMN IF NOT EXISTS chain_observed_amount numeric(38,18),
  ADD COLUMN IF NOT EXISTS chain_confirmations integer,
  ADD COLUMN IF NOT EXISTS chain_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS chain_verifier_id text;

CREATE OR REPLACE FUNCTION public.verify_and_credit_deposit_atomic(
  p_deposit_id text,
  p_verifier_id text,
  p_txid text,
  p_asset text,
  p_network text,
  p_observed_amount numeric(38,18),
  p_confirmations integer,
  p_required_confirmations integer,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_d public.deposit_records%rowtype;
  v_result jsonb;
  v_hash text;
  v_op_id uuid;
BEGIN
  IF coalesce(p_deposit_id,'') = '' OR coalesce(p_verifier_id,'') = ''
     OR length(btrim(coalesce(p_txid,''))) < 16
     OR coalesce(p_asset,'') !~ '^[A-Z0-9]{2,16}$'
     OR coalesce(p_network,'') = ''
     OR p_observed_amount IS NULL OR p_observed_amount <= 0
     OR p_confirmations IS NULL OR p_confirmations < 0
     OR p_required_confirmations IS NULL OR p_required_confirmations < 1
     OR p_confirmations < p_required_confirmations
     OR length(coalesce(p_request_id,'')) < 16 OR length(coalesce(p_request_id,'')) > 100
     OR length(coalesce(p_request_hash,'')) < 16 THEN
    RAISE EXCEPTION 'invalid or insufficiently confirmed chain observation';
  END IF;

  v_hash := encode(extensions.digest(
    concat_ws('|', p_deposit_id, lower(btrim(p_txid)), upper(p_asset), lower(p_network),
      p_observed_amount::text, p_confirmations::text, p_required_confirmations::text),
    'sha256'), 'hex');
  IF p_request_hash <> v_hash THEN
    RAISE EXCEPTION 'chain observation request hash mismatch';
  END IF;

  SELECT * INTO v_d FROM public.deposit_records WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not found'; END IF;

  IF v_d.status = 'confirmed' THEN
    IF lower(coalesce(v_d.txid,'')) = lower(btrim(p_txid))
       AND upper(v_d.asset) = upper(p_asset)
       AND lower(v_d.network) = lower(p_network)
       AND v_d.chain_observed_amount = p_observed_amount THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'deposit_id',v_d.id,'status',v_d.status,
        'operation_id',v_d.credit_operation_id);
    END IF;
    RAISE EXCEPTION 'confirmed deposit does not match chain observation';
  END IF;
  IF v_d.status <> 'pending' THEN RAISE EXCEPTION 'deposit is not pending'; END IF;
  IF upper(v_d.asset) <> upper(p_asset) OR lower(v_d.network) <> lower(p_network) THEN
    RAISE EXCEPTION 'chain asset or network mismatch';
  END IF;
  -- Do not silently under/over-credit. Partial payments require a separate explicit policy.
  IF v_d.amount <> p_observed_amount THEN RAISE EXCEPTION 'observed amount does not match deposit intent'; END IF;

  UPDATE public.deposit_records
     SET txid = lower(btrim(p_txid)), chain_observed_amount = p_observed_amount,
         chain_confirmations = p_confirmations, chain_verified_at = now(),
         chain_verifier_id = p_verifier_id
   WHERE id = v_d.id;

  v_result := public.apply_financial_operation(
    'deposit-chain:' || p_request_id, v_d.user_id, upper(v_d.asset), 'deposit_credit',
    p_observed_amount, 0, v_hash,
    jsonb_build_object('deposit_id',v_d.id,'txid',lower(btrim(p_txid)),
      'network',v_d.network,'confirmations',p_confirmations,'required_confirmations',p_required_confirmations,
      'verifier_id',p_verifier_id)
  );
  v_op_id := (v_result->>'operation_id')::uuid;
  UPDATE public.deposit_records
     SET status='confirmed', confirmed_by=p_verifier_id, confirmed_at=now(), credit_operation_id=v_op_id
   WHERE id=v_d.id;

  INSERT INTO public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,metadata)
  VALUES(p_verifier_id,v_d.user_id,'deposit_chain_verified_and_credited','deposit',v_d.id,
    jsonb_build_object('asset',v_d.asset,'network',v_d.network,'amount',p_observed_amount,
      'txid',lower(btrim(p_txid)),'confirmations',p_confirmations,'required_confirmations',p_required_confirmations,
      'operation_id',v_op_id));

  RETURN jsonb_build_object('ok',true,'duplicate',false,'deposit_id',v_d.id,'status','confirmed',
    'operation_id',v_op_id,'available',v_result->'available');
END;
$$;

-- Legacy admin confirmation must not bypass chain verification.
CREATE OR REPLACE FUNCTION public.confirm_deposit_atomic(p_deposit_id text, p_admin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_d public.deposit_records%rowtype;
BEGIN
  SELECT * INTO v_d FROM public.deposit_records WHERE id=p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not found'; END IF;
  IF v_d.status='confirmed' AND v_d.chain_verified_at IS NOT NULL AND v_d.credit_operation_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'deposit_id',v_d.id,'status',v_d.status,
      'operation_id',v_d.credit_operation_id);
  END IF;
  RAISE EXCEPTION 'manual deposit confirmation disabled; verified chain observation required';
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_credit_deposit_atomic(text,text,text,text,text,numeric,integer,integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_deposit_atomic(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_credit_deposit_atomic(text,text,text,text,text,numeric,integer,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_deposit_atomic(text,text) TO service_role;


-- ============================================================================
-- >>> Migration 15: enforce one open Seconds position per user
-- ============================================================================
-- Source of truth: supabase/sql/financial_seconds_one_open_position_v1.sql
-- Apply only after the documented staging drill. This does not enable financial
-- cutover. It fails closed if pre-existing duplicate open positions are found.
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

