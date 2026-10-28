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
