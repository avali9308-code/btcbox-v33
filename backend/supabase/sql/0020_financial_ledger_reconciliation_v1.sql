-- BTCBOX read-only financial ledger integrity diagnostics v1.
-- Run AFTER migrations in a restricted staging/operations session.
-- This script makes no schema or data changes. Any returned row is a finding
-- that must be investigated; an empty result is necessary but not sufficient
-- evidence for production cutover.

with
ledger_totals as (
  select user_id, asset,
         sum(available_delta) as available_delta_total,
         sum(frozen_delta) as frozen_delta_total,
         count(*) as ledger_rows
    from public.financial_ledger
   group by user_id, asset
),
latest_ledger as (
  select distinct on (user_id, asset)
         user_id, asset, available_after, frozen_after, id
    from public.financial_ledger
   order by user_id, asset, id desc
),
ledger_chain as (
  select id, user_id, asset, available_delta, frozen_delta,
         available_after, frozen_after,
         lag(available_after) over (partition by user_id, asset order by id) as prior_available_after,
         lag(frozen_after) over (partition by user_id, asset order by id) as prior_frozen_after
    from public.financial_ledger
),
pending_withdrawals as (
  select user_id, asset, sum(amount + fee) as pending_hold_total, count(*) as pending_count
    from public.withdrawal_requests
   where status = 'pending'
   group by user_id, asset
),
findings as (
  select 'account_delta_total_mismatch'::text as finding,
         a.user_id::text as user_id, a.asset::text as asset,
         null::text as object_id,
         coalesce(t.available_delta_total, 0)::text || '/' || coalesce(t.frozen_delta_total, 0)::text as expected,
         a.available::text || '/' || a.frozen::text as actual
    from public.financial_accounts a
    left join ledger_totals t using (user_id, asset)
   where a.available <> coalesce(t.available_delta_total, 0)
      or a.frozen <> coalesce(t.frozen_delta_total, 0)

  union all
  select 'account_latest_snapshot_mismatch', a.user_id, a.asset, null,
         coalesce(l.available_after, 0)::text || '/' || coalesce(l.frozen_after, 0)::text,
         a.available::text || '/' || a.frozen::text
    from public.financial_accounts a
    left join latest_ledger l using (user_id, asset)
   where a.available <> coalesce(l.available_after, 0)
      or a.frozen <> coalesce(l.frozen_after, 0)

  union all
  select 'ledger_chain_discontinuity', c.user_id, c.asset, c.id::text,
         c.prior_available_after::text || '/' || c.prior_frozen_after::text,
         (c.available_after - c.available_delta)::text || '/' || (c.frozen_after - c.frozen_delta)::text
    from ledger_chain c
   where c.prior_available_after is not null
     and (c.prior_available_after <> c.available_after - c.available_delta
       or c.prior_frozen_after <> c.frozen_after - c.frozen_delta)

  union all
  select 'operation_without_ledger', o.user_id, o.asset, o.id::text, 'exactly one ledger row',
         coalesce(count(l.id), 0)::text
    from public.financial_operations o
    left join public.financial_ledger l on l.operation_id = o.id
   group by o.id, o.user_id, o.asset
  having count(l.id) <> 1

  union all
  select 'ledger_operation_identity_mismatch', l.user_id, l.asset, l.id::text,
         l.user_id || '/' || l.asset,
         coalesce(o.user_id, '<missing>') || '/' || coalesce(o.asset, '<missing>')
    from public.financial_ledger l
    left join public.financial_operations o on o.id = l.operation_id
   where o.id is null or o.user_id <> l.user_id or o.asset <> l.asset

  union all
  select 'pending_withdrawal_hold_shortfall', p.user_id, p.asset, null,
         p.pending_hold_total::text, coalesce(a.frozen, 0)::text
    from pending_withdrawals p
    left join public.financial_accounts a using (user_id, asset)
   where coalesce(a.frozen, 0) < p.pending_hold_total

  union all
  select 'withdrawal_missing_freeze_operation', w.user_id, w.asset, w.id,
         'freeze operation linked', coalesce(w.freeze_operation_id::text, '<null>')
    from public.withdrawal_requests w
   where w.freeze_operation_id is null

  union all
  select 'reviewed_withdrawal_missing_review_operation', w.user_id, w.asset, w.id,
         'review operation linked', coalesce(w.review_operation_id::text, '<null>')
    from public.withdrawal_requests w
   where w.status in ('approved', 'rejected', 'broadcast', 'failed')
     and w.review_operation_id is null

  union all
  select 'confirmed_deposit_missing_credit_operation', d.user_id, d.asset, d.id,
         'credit operation linked', coalesce(d.credit_operation_id::text, '<null>')
    from public.deposit_records d
   where d.status = 'confirmed' and d.credit_operation_id is null

  union all
  select 'redeemed_position_missing_redeem_operation', e.user_id, e.asset, e.id,
         'redeem operation linked', coalesce(e.redeem_operation_id::text, '<null>')
    from public.earn_positions e
   where e.status = 'redeemed' and e.redeem_operation_id is null
)
select finding, user_id, asset, object_id, expected, actual
  from findings
 order by finding, user_id, asset, object_id;
