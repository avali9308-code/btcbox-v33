-- BTCBOX Supabase read-only preflight. Safe to run before migrations.
-- This file performs SELECTs only; it does not create, alter, or delete objects.
-- Run after the BTCBOX project has been uploaded/deployed, before applying migrations.

-- 1) Visible schemas (public may exist even when it has no business tables).
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;

-- 2) Tables, views, and materialized views outside system schemas.
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;

-- 3) Functions in public schema (includes overload signatures).
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, arguments;

-- 4) RLS status for public tables.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

-- 5) Explicit table grants to browser roles. Review any rows returned.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 6) Installed migration history, if Supabase migration tracking exists.
-- This dynamic check avoids referencing a missing supabase_migrations schema.
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'supabase_migrations'
    AND table_name = 'schema_migrations'
) AS supabase_migration_history_table_exists;
