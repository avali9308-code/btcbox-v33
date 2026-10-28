-- BTCBOX legacy financial migration quarantine v5.
-- Apply ONLY to a dedicated staging project. This table is not an operational source of truth.
create table if not exists public.financial_legacy_migration_records (
  id bigint generated always as identity primary key,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_collection text not null check (source_collection in ('account_snapshot','withdrawal','deposit','order','earn_record')),
  migration_id text not null check (migration_id ~ '^[0-9a-f]{64}$'),
  user_id text not null,
  legacy_id text,
  legacy_index integer not null check (legacy_index >= 0),
  legacy_status text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz not null default now(),
  unique (source_sha256, source_collection, migration_id)
);
create index if not exists financial_legacy_migration_collection_idx
  on public.financial_legacy_migration_records(source_sha256, source_collection, legacy_status);
alter table public.financial_legacy_migration_records enable row level security;
revoke all on public.financial_legacy_migration_records from public, anon, authenticated;
-- Import SQL is intended to be executed by the trusted staging operator/database owner.
-- Do not grant this table to browser roles or read it from production request handlers.
