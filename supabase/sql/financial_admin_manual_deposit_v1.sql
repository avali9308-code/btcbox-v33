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
