# Financial SQL migration order and cutover gates

> **编号约定（phase2）**: 本目录下编号 SQL 由 `scripts/run_migrations.sh` 按升序执行。`0001` 为基础，`0002–0021` 建立账本、业务 RPC 与审计结构；`0022` 是提现生命周期兼容检查点，不再创建第二套表或 RPC；`0023` 增加人工转账完成记录；`0024–0025` 是秒合约后续迁移。此顺序必须先在隔离 PostgreSQL 环境完整验证，不能据此重放到已存在的托管数据库。
>
> **迁移入口说明**：`backend/supabase-migration-runner.sql` 是已废弃的历史聚合文件，禁止执行；当前唯一编号 SQL 来源为本目录，隔离测试入口为 `backend/scripts/run_migrations.sh`。Supabase CLI timestamped migrations 属于独立历史/部署通道，不能与编号 runner 混用或假定两者执行历史等价。


Apply these migrations to a dedicated staging project in dependency order. These files are migrations, not read-only reports; audit scripts and staging drill outputs are not migrations. Complete the checks before production cutover.

1. `financial_ledger_v1.sql`
2. `financial_lifecycle_v2.sql`
3. `financial_admin_adjustment_v1.sql`
4. `financial_earn_redemption_idempotency_v4.sql`
5. `financial_earn_policy_v5.sql`
6. `financial_admin_manual_deposit_v1.sql`
7. `financial_spot_trade_v3.sql`
8. `financial_matching_engine_v1.sql`
9. `financial_read_api_v1.sql` (base normalized account snapshot RPC)
10. `financial_read_api_earn_v1.sql` (extends the account snapshot with earn positions)
11. `financial_admin_read_api_v1.sql`
12. `financial_admin_account_read_api_v1.sql`
13. `financial_seconds_contracts_v1.sql` — creates the Seconds lifecycle RPCs and extends the financial operation type constraint.
14. `financial_seconds_one_open_position_v1.sql` — apply after #13; adds a partial unique index for one open position per user and maps concurrent conflicts to `OPEN_POSITION_EXISTS`. It fails closed if duplicate open positions already exist.
15. 0024_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql — forward migration; removes only the one-open-position partial unique index and fixes settlement request-ID/hash handling. The timestamped copy under supabase/migrations/ is the Supabase CLI migration; the numbered SQL copy keeps the existing local/docker runner in sync.

The lifecycle `confirm_deposit_atomic` RPC is intentionally fail-closed and cannot credit a deposit without trusted verification. The intended deposit-credit path for the current manual-review business model is the separately audited `admin_manual_deposit_atomic` RPC; manual credits must use the separately audited `admin_manual_deposit_atomic` RPC. The `financial_deposit_chain_verification_v3.sql` is optional when the deployment does not enable automated chain verification, but it is required before enabling that automated verification path.

The `financial_migration_staging_v5.sql` quarantine table and the `financial_migration_staging_reconciliation_v6.sql`, `financial_migration_reconciliation_v4.sql`, and `financial_ledger_reconciliation_v1.sql` files are staging/import or read-only reconciliation steps, not part of the ordered operational RPC sequence above. Run them only in the documented staging workflow.

Before cutover:

- Confirm exact function signatures using the static audit and PostgreSQL staging drill.
- Confirm service-role-only execution for all money-moving RPCs and deny direct browser-role table access.
- Import/restore historical state into staging, reconcile balances and histories, and verify rollback.
- Test idempotent retries and concurrent requests for deposits, withdrawals, earn, spot trade, and seconds contracts.
- Keep financial writes disabled until all relevant reads and writes use the same authoritative ledger and the full-cutover approval is explicit.

16. `0023_withdrawal_manual_payout_completion_v1.sql` — records the external manual payout reference after an approved withdrawal; it does not send funds.
17. `0024_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql` — forward migration: removes only the one-open-position partial unique index and fixes settlement request-ID/hash handling. Timestamped CLI copy is under `supabase/migrations/`.
18. `0025_seconds_policy_snapshot_and_admin_queue_v1.sql` — policy table and RPCs; policy-driven order validation; per-position policy version/payout snapshot; admin open-position read queue; settlement uses the stored payout rate. Timestamped CLI migration is under `supabase/migrations/`.


### 0021 audit-log schema and permission reconciliation

- `0002_financial_ledger_v1.sql` is the canonical creator of `public.financial_audit_log` with columns `actor_id, subject_user_id, action, object_type, object_id, reason, metadata, created_at`.
- `0021_admin_audit_log_append_only_v1.sql` extends that table; it must not create a different `uid/by/detail/meta` shape or index a nonexistent `uid` column.
- The existing Node `auditAdmin()` request shape (`p_action, p_uid, p_by, p_detail`) is mapped to the canonical audit columns.
- The append RPC uses `SECURITY INVOKER`, an empty fixed `search_path`, explicit revocation from `PUBLIC, anon, authenticated`, and EXECUTE grant only to `service_role`. The table remains RLS-enabled and service_role is restricted to SELECT/INSERT; UPDATE/DELETE/TRUNCATE are revoked and guarded by append-only triggers.
- This is source-level reconciliation. Full PostgreSQL runtime validation remains required before cutover.
