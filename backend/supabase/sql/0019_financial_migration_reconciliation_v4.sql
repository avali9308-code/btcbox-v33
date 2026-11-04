-- BTCBOX Round 51: read-only post-import reconciliation queries.
-- Run only after importing into a dedicated staging project. These queries do not mutate data.

-- 1) Per-asset available/frozen totals from the authoritative account table.
select asset,
       sum(available)::numeric(38,18) as available_total,
       sum(frozen)::numeric(38,18) as frozen_total,
       count(*) as account_rows
from public.financial_accounts
group by asset
order by asset;

-- 2) Record counts and pending workload to compare with the preflight manifest.
select 'withdrawals' as record_type, status, count(*) as record_count
from public.withdrawal_requests group by status
union all
select 'deposits' as record_type, status, count(*) as record_count
from public.deposit_records group by status
union all
select 'spot_orders' as record_type, status, count(*) as record_count
from public.financial_spot_orders group by status
order by record_type, status;

-- 3) Ledger operation coverage. Any returned rows require investigation.
select o.id, o.idempotency_key, o.operation_type, o.user_id, o.asset
from public.financial_operations o
left join public.financial_ledger l on l.operation_id = o.id
where l.id is null
order by o.created_at;

-- 4) Current balances must agree with the latest ledger snapshot per user/asset.
-- This is a diagnostic only; imported opening balances may need explicit opening entries.
with latest as (
  select distinct on (user_id, asset) user_id, asset, available_after, frozen_after, created_at
  from public.financial_ledger
  order by user_id, asset, created_at desc, id desc
)
select a.user_id, a.asset, a.available, a.frozen,
       l.available_after, l.frozen_after
from public.financial_accounts a
join latest l using (user_id, asset)
where a.available <> l.available_after or a.frozen <> l.frozen_after
order by a.user_id, a.asset;
