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
