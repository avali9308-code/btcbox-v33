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
