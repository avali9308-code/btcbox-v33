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
