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
