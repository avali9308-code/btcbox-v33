-- BTCBOX Round 55: read-only reconciliation of the staging quarantine table.
-- Run ONLY in the dedicated staging project after Round 54 staging import.
-- This file does not promote rows into operational financial tables.

-- 1) Overall counts per source snapshot and collection. Compare to the verified manifest.
select source_sha256, source_collection, count(*) as record_count,
       count(distinct migration_id) as distinct_migration_ids,
       count(*) filter (where legacy_status in ('pending','processing','review','awaiting_confirmation')) as pending_like_count
from public.financial_legacy_migration_records
group by source_sha256, source_collection
order by source_sha256, source_collection;

-- 2) Status distributions, still treated as untrusted legacy labels.
select source_sha256, source_collection, legacy_status, count(*) as record_count
from public.financial_legacy_migration_records
group by source_sha256, source_collection, legacy_status
order by source_sha256, source_collection, legacy_status;

-- 3) Account snapshot totals from staged payload. Numeric casts will fail closed on malformed values.
select payload->>'asset' as asset,
       sum((payload->>'available')::numeric) as available_total,
       sum((payload->>'frozen')::numeric) as frozen_total,
       count(*) as account_asset_rows
from public.financial_legacy_migration_records
where source_collection = 'account_snapshot'
group by payload->>'asset'
order by payload->>'asset';

-- 4) Amount totals by asset and collection; these are historical totals, not payable balances.
select source_collection, payload->>'asset' as asset,
       sum((payload->>'amount')::numeric) as historical_amount_total,
       count(*) as record_count
from public.financial_legacy_migration_records
where source_collection in ('withdrawal','deposit')
group by source_collection, payload->>'asset'
order by source_collection, payload->>'asset';

-- 5) Conflicting payload hashes for the same source/collection/migration key should be impossible
-- under the table unique constraint. Any result means schema/data integrity needs investigation.
select source_sha256, source_collection, migration_id, count(distinct payload_sha256) as hash_variants
from public.financial_legacy_migration_records
group by source_sha256, source_collection, migration_id
having count(distinct payload_sha256) > 1;

-- 6) Duplicate user/asset snapshots are a blocking migration issue.
select payload->>'user_id' as user_id, payload->>'asset' as asset, count(*) as row_count
from public.financial_legacy_migration_records
where source_collection = 'account_snapshot'
group by payload->>'user_id', payload->>'asset'
having count(*) > 1;
