# BTCBOX 数据库结构盘点（DATABASE-MAP）

> 只读技术分析产出。生成日期：2026-11-02。Supabase 项目 ref：zlozsutefnmgwwzrlipt。
> 数据来源：(A) `work/sb_openapi.json`（服务端高权限角色 拉取的 PostgREST OpenAPI 快照，含 14 张 REST 暴露表 + 20 个 RPC）；(B) `repo/supabase-migration-runner.sql`（2133 行全量迁移，权威）；(C) `repo/supabase/sql/*.sql`（19 个分模块迁移 + 1 个顺序说明）。
> 凡 OpenAPI 与 SQL 不一致处，以 SQL 为准并标注。凡无法核实处标注「未核实」。

---

## 0. 统计总览

| 类别 | 数量 | 说明 |
|---|---|---|
| REST 暴露业务表（OpenAPI definitions） | 14 | 见 §1 |
| SQL 中存在但未通过 REST 暴露的表 | 1 | `financial_legacy_migration_records`（staging-only 隔离区） |
| 视图（CREATE VIEW） | 0 | 全部 SQL 迁移中未发现 CREATE VIEW |
| 自定义 TYPE（CREATE TYPE） | 0 | 枚举均以 `text + CHECK` 约束实现 |
| RPC（PostgREST /rpc/* 暴露） | 20 | 见 §5 |
| 触发器（TRIGGER） | 2 | `deposit_confirmed_immutable_guard`、`earn_position_snapshot_immutable` |
| 触发器函数 | 2 | `guard_confirmed_deposit_immutable()`、`guard_earn_position_snapshot()` |
| 启用 RLS 的表 | 15 | 全部 14 张业务表 + 1 张 staging 隔离区表 |
| 显式 CREATE POLICY 语句 | 0 | 仅 `ENABLE ROW LEVEL SECURITY` + `REVOKE/GRANT` 角色控制，未发现细粒度行策略 |

---

## 1. 业务表清单（字段级）

> 字段类型/默认值/可空性以 SQL `CREATE TABLE` + `ALTER TABLE ... ADD COLUMN` 为准；OpenAPI 仅作交叉核对。来源列中 `runner:Lxxx` 指 `supabase-migration-runner.sql` 行号；`module:文件名:Lxxx` 指分模块文件行号。

### 1.1 btcbox_state（KV 状态表，单例）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | text | — | NOT NULL | PRIMARY KEY，CHECK (id = 'main') |
| revision | bigint | — | NOT NULL | CHECK (revision >= 1) |
| data | jsonb | — | NOT NULL | CHECK (jsonb_typeof(data) = 'object') |
| updated_at | timestamptz | now() | NOT NULL | — |

- 来源：runner:L43-48；module:`btcbox_state_cas.sql:L3-8`。
- 权限：REVOKE FROM anon/authenticated；GRANT select/insert/update TO 服务端高权限角色（runner:L50-53）。
- OpenAPI 核对：`data` 类型 OpenAPI 未给出 type（仅 format=jsonb），SQL 确认为 jsonb NOT NULL。一致。

### 1.2 financial_accounts（账户余额表，核心资产表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| user_id | text | — | NOT NULL | PK 组成部分 |
| asset | text | — | NOT NULL | PK 组成部分，CHECK (asset ~ '^[A-Z0-9]{2,16}$') |
| available | numeric(38,18) | 0 | NOT NULL | CHECK (available >= 0) — **可用余额** |
| frozen | numeric(38,18) | 0 | NOT NULL | CHECK (frozen >= 0) — **冻结余额** |
| version | bigint | 0 | NOT NULL | CHECK (version >= 0) — 乐观锁版本号 |
| updated_at | timestamptz | now() | NOT NULL | — |

- PK：(user_id, asset)。来源：runner:L101-109；module:`financial_ledger_v1.sql`。
- 无单独索引（PK 即索引）。
- 专项：`available`=可用金额，`frozen`=冻结金额，无单独"总余额"字段（总额=available+frozen，来自代码推断）。

### 1.3 financial_operations（资金操作表，幂等中枢）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NOT NULL | PRIMARY KEY |
| idempotency_key | text | — | NOT NULL | UNIQUE，CHECK (length BETWEEN 16 AND 128) |
| user_id | text | — | NOT NULL | — |
| asset | text | — | NOT NULL | — |
| operation_type | text | — | NOT NULL | CHECK 枚举（见 §7.2） |
| request_hash | text | — | NOT NULL | — |
| status | text | 'applied' | NOT NULL | CHECK (status IN ('applied')) — **资金状态**，仅一种取值 |
| metadata | jsonb | '{}'::jsonb | NOT NULL | CHECK (jsonb_typeof = 'object') |
| created_at | timestamptz | now() | NOT NULL | — |

- 来源：runner:L111-121。operation_type CHECK 约束经 4 次扩展（runner:L116 → L1138-1139 → L1270-1272 → L1828-1830），最终枚举见 §7.2。
- 被几乎所有业务表外键引用（见 §3）。

### 1.4 financial_ledger（资金流水表，不可变账本）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | bigint | generated always as identity | NOT NULL | PRIMARY KEY |
| operation_id | uuid | — | NOT NULL | FK → financial_operations(id) |
| user_id | text | — | NOT NULL | — |
| asset | text | — | NOT NULL | — |
| available_delta | numeric(38,18) | — | NOT NULL | 有符号可用余额变动 |
| frozen_delta | numeric(38,18) | — | NOT NULL | 有符号冻结余额变动 |
| available_after | numeric(38,18) | — | NOT NULL | CHECK (>=0) — 变动后可用 |
| frozen_after | numeric(38,18) | — | NOT NULL | CHECK (>=0) — 变动后冻结 |
| created_at | timestamptz | now() | NOT NULL | — |

- UNIQUE：(operation_id, user_id, asset)。来源：runner:L123-134。
- 索引：`financial_ledger_user_asset_time_idx` (user_id, asset, created_at desc)（runner:L190）。
- 完整性诊断见 module:`financial_ledger_reconciliation_v1.sql`（只读）。

### 1.5 withdrawal_requests（提现申请表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | text | — | NOT NULL | PRIMARY KEY |
| user_id | text | — | NOT NULL | — |
| asset | text | — | NOT NULL | — |
| network | text | — | NOT NULL | — |
| amount | numeric(38,18) | — | NOT NULL | CHECK (amount > 0) |
| fee | numeric(38,18) | — | NOT NULL | CHECK (fee >= 0) |
| destination | text | — | NOT NULL | — |
| status | text | — | NOT NULL | CHECK 枚举：pending/approved/rejected/broadcast/failed — **提现状态** |
| request_id | text | — | NOT NULL | UNIQUE |
| reviewed_by | text | — | NULL | — |
| reviewed_at | timestamptz | — | NULL | — |
| created_at | timestamptz | now() | NOT NULL | — |
| freeze_operation_id | uuid | — | NULL | FK → financial_operations(id)（ALTER ADD，runner:L290） |
| review_operation_id | uuid | — | NULL | FK → financial_operations(id)（ALTER ADD，runner:L291） |

- 来源：runner:L136-149；ALTER ADD 列 runner:L289-291；module:`financial_lifecycle_v2.sql`。
- 索引：`withdrawal_requests_user_time_idx` (user_id, created_at desc)；`withdrawal_requests_status_time_idx` (status, created_at)（runner:L191-192）。

### 1.6 deposit_records（充值记录表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | text | — | NOT NULL | PRIMARY KEY |
| user_id | text | — | NOT NULL | — |
| asset | text | — | NOT NULL | — |
| network | text | — | NOT NULL | — |
| amount | numeric(38,18) | — | NOT NULL | CHECK (amount > 0) |
| txid | text | — | NULL | — |
| status | text | — | NOT NULL | CHECK 枚举：pending/confirmed/rejected — **充值状态** |
| idempotency_key | text | — | NOT NULL | UNIQUE |
| confirmed_by | text | — | NULL | — |
| confirmed_at | timestamptz | — | NULL | — |
| created_at | timestamptz | now() | NOT NULL | — |
| credit_operation_id | uuid | — | NULL | FK → financial_operations(id)（runner:L294） |
| request_hash | text | — | NULL | ALTER ADD（module:`financial_admin_manual_deposit_v1.sql:L10`） |
| source | text | 'chain' | NOT NULL | ALTER ADD，默认 'chain'（同上:L11） |
| reference | text | — | NULL | ALTER ADD（同上:L12） |
| note | text | — | NULL | ALTER ADD（同上:L13） |
| chain_observed_amount | numeric(38,18) | — | NULL | ALTER ADD（module:`financial_deposit_chain_verification_v3.sql:L7`） |
| chain_confirmations | integer | — | NULL | ALTER ADD（同上:L8） |
| chain_verified_at | timestamptz | — | NULL | ALTER ADD（同上:L9） |
| chain_verifier_id | text | — | NULL | ALTER ADD（同上:L10） |

- 来源：runner:L151-163；后续 ALTER ADD 见上。
- 唯一索引（部分）：`deposit_records_txid_asset_network_uq` (lower(btrim(txid)), lower(asset), lower(network)) WHERE txid 非空（runner:L491-493；module:`financial_admin_adjustment_v1.sql:L20-22`）。
- 唯一索引（部分）：`deposit_records_manual_reference_uq` (lower(btrim(reference))) WHERE source='admin_manual' AND reference 非空（runner:L1035-1037；module:`financial_admin_manual_deposit_v1.sql:L25-27`）。
- 索引：`deposit_records_user_time_idx` (user_id, created_at desc)（runner:L193）。
- 触发器：`deposit_confirmed_immutable_guard` BEFORE UPDATE — 已确认充值的财务字段不可变（runner:L496-523）。
- OpenAPI 核对：OpenAPI 显示 source 默认 'chain'，与 SQL 一致。

### 1.7 earn_positions（理财持仓表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | text | — | NOT NULL | PRIMARY KEY |
| user_id | text | — | NOT NULL | — |
| product_id | text | — | NOT NULL | — |
| asset | text | — | NOT NULL | — |
| principal | numeric(38,18) | — | NOT NULL | CHECK (principal > 0) — 申购本金 |
| status | text | — | NOT NULL | CHECK 枚举：active/redeemed/matured — **持仓状态** |
| subscribe_operation_id | uuid | — | NOT NULL | UNIQUE，FK → financial_operations(id) |
| redeem_operation_id | uuid | — | NULL | UNIQUE，FK → financial_operations(id) |
| created_at | timestamptz | now() | NOT NULL | — |
| redeemed_at | timestamptz | — | NULL | — |
| request_idempotency_key | text | — | NULL | UNIQUE（ALTER ADD，runner:L297） |
| redeem_request_id | text | — | NULL | ALTER ADD（module:`financial_earn_redemption_idempotency_v4.sql:L7-8`） |
| redeem_request_hash | text | — | NULL | ALTER ADD（同上:L9） |
| product_type | text | — | NOT NULL | ALTER ADD + SET NOT NULL（module:`financial_earn_policy_v5.sql:L51-52, L80-86`），CHECK demand/fixed |
| apy_percent | numeric(9,6) | — | NOT NULL | ALTER ADD + SET NOT NULL（同上）— 策略快照 |
| term_days | integer | — | NOT NULL | ALTER ADD + SET NOT NULL（同上） |
| early_fee_percent | numeric(9,6) | — | NOT NULL | ALTER ADD + SET NOT NULL（同上） |
| amount_scale | smallint | — | NOT NULL | ALTER ADD + SET NOT NULL（同上） |
| subscribe_request_hash | text | — | NOT NULL | ALTER ADD + SET NOT NULL（同上:L56, L86） |

- 来源：runner:L165-176；后续 ALTER ADD 见上。
- 唯一索引（部分）：`earn_positions_redeem_request_id_uq` (redeem_request_id) WHERE NOT NULL（runner:L622；module:`financial_earn_redemption_idempotency_v4.sql:L7`）。
- CHECK 约束：`earn_positions_policy_type_check` — (product_type='demand' AND term_days=0) OR (product_type='fixed' AND term_days>0)（runner:L813-816）。
- 触发器：`earn_position_snapshot_immutable` BEFORE UPDATE — 持仓身份与策略快照不可变（runner:L823-846）。
- OpenAPI 核对：OpenAPI 中 `amount_scale` 类型为 integer(int32)，SQL 为 smallint — **不一致，以 SQL smallint 为准**。

### 1.8 earn_product_catalog（理财产品目录表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| product_id | text | — | NOT NULL | PRIMARY KEY |
| asset | text | — | NOT NULL | CHECK (asset ~ '^[A-Z0-9]{2,16}$') |
| product_type | text | — | NOT NULL | CHECK IN ('demand','fixed') |
| apy_percent | numeric(9,6) | — | NOT NULL | CHECK (0 <= x <= 1000) |
| term_days | integer | — | NOT NULL | CHECK (0 <= x <= 3650) |
| early_fee_percent | numeric(9,6) | — | NOT NULL | CHECK (0 <= x <= 100) |
| amount_scale | smallint | — | NOT NULL | CHECK (0 <= x <= 18) |
| active | boolean | true | NOT NULL | — |
| updated_at | timestamptz | now() | NOT NULL | — |

- CHECK：(product_type='demand' AND term_days=0) OR (product_type='fixed' AND term_days>0)。
- 来源：runner:L714-725；module:`financial_earn_policy_v5.sql:L7-18`。
- 种子数据 7 条（demand/flex_USDT/flex_BTC/flex_ETH/fixed30/fixed90/fixed180），ON CONFLICT DO NOTHING（runner:L727-737）。
- 权限：REVOKE ALL 包括 服务端高权限角色；GRANT SELECT TO 服务端高权限角色（只读，runner:L819-820）。
- OpenAPI 核对：OpenAPI `amount_scale` 为 integer(int32)，SQL 为 smallint — **不一致，以 SQL 为准**。OpenAPI `active` 默认 True，一致。

### 1.9 financial_spot_orders（现货成交订单表，非撮合）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | text | — | NOT NULL | PRIMARY KEY |
| user_id | text | — | NOT NULL | — |
| base_asset | text | — | NOT NULL | — |
| quote_asset | text | — | NOT NULL | — |
| side | text | — | NOT NULL | CHECK IN ('buy','sell') |
| order_type | text | — | NOT NULL | CHECK IN ('market','limit') |
| price | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| quantity | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| quote_amount | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| status | text | — | NOT NULL | CHECK (status = 'filled') — **订单状态**，仅 filled |
| idempotency_key | text | — | NOT NULL | UNIQUE |
| operation_id | uuid | — | NOT NULL | UNIQUE，FK → financial_operations(id) |
| created_at | timestamptz | now() | NOT NULL | — |

- CHECK (base_asset <> quote_asset)。
- 来源：runner:L1141-1155；module:`financial_spot_trade_v3.sql:L11-25`。
- 索引：`financial_spot_orders_user_time_idx` (user_id, created_at desc)（runner:L1157）。
- 说明：此表仅记录调用方已验证的模拟/市价成交，非撮合引擎（注释明确，module:`financial_spot_trade_v3.sql:L5`）。

### 1.10 financial_matching_markets（撮合交易对配置表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| base_asset | text | — | NOT NULL | PK，CHECK 资产格式 |
| quote_asset | text | — | NOT NULL | PK，CHECK 资产格式 |
| enabled | boolean | false | NOT NULL | — |
| price_tick | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| quantity_step | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| min_quantity | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| min_notional | numeric(38,18) | 0 | NOT NULL | CHECK (>=0) |
| maker_fee_rate | numeric(12,10) | 0 | NOT NULL | CHECK (=0) — 费率强制为 0 |
| taker_fee_rate | numeric(12,10) | 0 | NOT NULL | CHECK (=0) |
| max_limit_price | numeric(38,18) | — | NULL | CHECK (IS NULL OR >0) |
| min_limit_price | numeric(38,18) | — | NULL | CHECK (IS NULL OR >0) |
| updated_at | timestamptz | now() | NOT NULL | — |

- PK：(base_asset, quote_asset)。CHECK：base<>quote；min<=max（若均非空）。
- 来源：runner:L1279-1297；module:`financial_matching_engine_v1.sql:L14-35`。
- 权限：GRANT SELECT TO 服务端高权限角色（只读，runner:L1300-1301）。

### 1.11 financial_matching_orders（撮合限价订单表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | text | — | NOT NULL | PRIMARY KEY |
| user_id | text | — | NOT NULL | — |
| base_asset | text | — | NOT NULL | CHECK 资产格式 |
| quote_asset | text | — | NOT NULL | CHECK 资产格式 |
| side | text | — | NOT NULL | CHECK IN ('buy','sell') |
| price | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| quantity | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| remaining_quantity | numeric(38,18) | — | NOT NULL | CHECK (0 <= x <= quantity) |
| status | text | — | NOT NULL | CHECK 枚举：open/partially_filled/filled/cancelled — **订单状态** |
| client_order_id | text | — | NOT NULL | CHECK (length 16-100) |
| reserve_asset | text | — | NOT NULL | — |
| reserved_remaining | numeric(38,18) | — | NOT NULL | CHECK (>=0) — **冻结剩余** |
| reserve_operation_id | uuid | — | NOT NULL | UNIQUE，FK → financial_operations(id) |
| created_at | timestamptz | now() | NOT NULL | — |
| updated_at | timestamptz | now() | NOT NULL | — |

- UNIQUE：(user_id, client_order_id)。
- CHECK：base<>quote；(side='buy' AND reserve_asset=quote_asset) OR (side='sell' AND reserve_asset=base_asset)；状态与剩余量一致性约束。
- 来源：runner:L1303-1323；module:`financial_matching_engine_v1.sql:L40-63`。
- 部分索引（订单簿）：`financial_matching_book_asks_idx` (base,quote,price asc,created_at asc,id) WHERE side='sell' AND status IN (open,partially_filled)；`financial_matching_book_bids_idx` 同构 price desc WHERE side='buy'（runner:L1325-1330）。
- 索引：`financial_matching_orders_user_idx` (user_id, created_at desc)（runner:L1331）。

### 1.12 financial_matching_trades（撮合成交记录表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NOT NULL | PRIMARY KEY |
| pair_key | text | — | NOT NULL | — |
| base_asset | text | — | NOT NULL | — |
| quote_asset | text | — | NOT NULL | — |
| maker_order_id | text | — | NOT NULL | FK → financial_matching_orders(id) |
| taker_order_id | text | — | NOT NULL | FK → financial_matching_orders(id) |
| buyer_user_id | text | — | NOT NULL | — |
| seller_user_id | text | — | NOT NULL | — |
| price | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| quantity | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| quote_amount | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| operation_id | uuid | — | NOT NULL | UNIQUE，FK → financial_operations(id) |
| created_at | timestamptz | now() | NOT NULL | — |

- CHECK (buyer_user_id <> seller_user_id)。
- 来源：runner:L1334-1348；module:`financial_matching_engine_v1.sql:L66-81`。
- 索引：`financial_matching_trades_pair_time_idx` (pair_key, created_at desc)（runner:L1350）。
- 权限：GRANT select/insert（无 update）TO 服务端高权限角色（runner:L1357-1358）。

### 1.13 seconds_contract_positions（秒合约持仓表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| position_id | text | — | NOT NULL | PRIMARY KEY，CHECK 格式 ^SC[0-9a-fA-F]{30}$（函数内校验） |
| user_id | text | — | NOT NULL | — |
| symbol | text | — | NOT NULL | CHECK IN ('BTC','ETH','SOL','BNB') |
| direction | text | — | NOT NULL | CHECK IN ('up','down') |
| amount | numeric(38,18) | — | NOT NULL | CHECK (>0) — 投注金额（冻结） |
| duration_sec | integer | — | NOT NULL | CHECK IN (30,60,300,900) |
| open_price | numeric(38,18) | — | NOT NULL | CHECK (>0) |
| open_price_source | text | — | NOT NULL | — |
| open_price_ts | timestamptz | now() | NOT NULL | — |
| open_request_id | text | — | NOT NULL | UNIQUE |
| open_request_hash | text | — | NOT NULL | — |
| open_operation_id | uuid | — | NOT NULL | UNIQUE，FK → financial_operations(id) |
| status | text | 'open' | NOT NULL | CHECK IN ('open','settled') — **持仓状态** |
| settle_price | numeric(38,18) | — | NULL | — |
| settle_price_source | text | — | NULL | 函数内 CHECK IN ('coinbase','bybit') |
| settle_price_ts | timestamptz | — | NULL | — |
| pnl | numeric(38,18) | — | NULL | 盈亏（胜=+85%金额，负=-金额，平=0，来自代码推断/函数内计算） |
| win | boolean | — | NULL | — |
| tie | boolean | — | NULL | — |
| settle_request_id | text | — | NULL | UNIQUE |
| settle_request_hash | text | — | NULL | — |
| settle_operation_id | uuid | — | NULL | UNIQUE，FK → financial_operations(id) |
| created_at | timestamptz | now() | NOT NULL | — |
| settle_at | timestamptz | — | NOT NULL | 到期结算时间 |
| settled_at | timestamptz | — | NULL | — |

- CHECK：(status='open' AND settled_at IS NULL AND settle_operation_id IS NULL) OR (status='settled' AND settled_at NOT NULL AND settle_operation_id NOT NULL)。
- 来源：runner:L1834-1861；module:`financial_seconds_contracts_v1.sql:L16-44`。
- 索引：`seconds_positions_user_status_due_idx` (user_id, status, settle_at desc)（runner:L1863）。
- OpenAPI 核对：OpenAPI `open_price_ts` 默认 now()，与 SQL 一致。`status` 默认 'open'，一致。

### 1.14 financial_audit_log（审计日志表）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | bigint | generated always as identity | NOT NULL | PRIMARY KEY |
| actor_id | text | — | NOT NULL | 操作者 |
| subject_user_id | text | — | NULL | 被操作用户 |
| action | text | — | NOT NULL | 动作类型（文本，无 CHECK 枚举） |
| object_type | text | — | NULL | — |
| object_id | text | — | NULL | — |
| reason | text | — | NULL | — |
| metadata | jsonb | '{}'::jsonb | NOT NULL | CHECK (jsonb_typeof='object') |
| created_at | timestamptz | now() | NOT NULL | — |

- 来源：runner:L178-188。
- 索引：`financial_audit_subject_time_idx` (subject_user_id, created_at desc)（runner:L194）。
- 归类：审计域，append-only（无 update 权限授予，来自代码推断）。

### 1.15 financial_legacy_migration_records（staging-only 迁移隔离区表，未 REST 暴露）

| 字段 | 类型 | 默认 | NULL | 约束 |
|---|---|---|---|---|
| id | bigint | generated always as identity | NOT NULL | PRIMARY KEY |
| source_sha256 | text | — | NOT NULL | CHECK ^[0-9a-f]{64}$ |
| source_collection | text | — | NOT NULL | CHECK IN (account_snapshot/withdrawal/deposit/order/earn_record) |
| migration_id | text | — | NOT NULL | CHECK ^[0-9a-f]{64}$ |
| user_id | text | — | NOT NULL | — |
| legacy_id | text | — | NULL | — |
| legacy_index | integer | — | NOT NULL | CHECK (>=0) |
| legacy_status | text | — | NOT NULL | 不可信旧标签 |
| payload | jsonb | — | NOT NULL | CHECK (jsonb_typeof='object') |
| payload_sha256 | text | — | NOT NULL | CHECK ^[0-9a-f]{64}$ |
| imported_at | timestamptz | now() | NOT NULL | — |

- UNIQUE：(source_sha256, source_collection, migration_id)。
- 索引：`financial_legacy_migration_collection_idx` (source_sha256, source_collection, legacy_status)。
- 来源：module:`financial_migration_staging_v5.sql:L4-18`。**仅 staging 项目使用，不进入生产，不通过 REST 暴露**（文件头注释明确）。
- RLS：已启用；REVOKE ALL FROM public/anon/authenticated，仅 staging 操作者/database owner 导入（同上:L21-23）。

---

## 2. 主键 / 外键 / 唯一约束 / 索引汇总

### 2.1 主键

| 表 | 主键 |
|---|---|
| btcbox_state | id（单例，值固定 'main'） |
| financial_accounts | (user_id, asset) 复合 |
| financial_operations | id (uuid) |
| financial_ledger | id (bigint identity) |
| withdrawal_requests | id (text) |
| deposit_records | id (text) |
| earn_positions | id (text) |
| earn_product_catalog | product_id (text) |
| financial_spot_orders | id (text) |
| financial_matching_markets | (base_asset, quote_asset) 复合 |
| financial_matching_orders | id (text) |
| financial_matching_trades | id (uuid) |
| seconds_contract_positions | position_id (text) |
| financial_audit_log | id (bigint identity) |
| financial_legacy_migration_records | id (bigint identity) |

### 2.2 外键（全部指向 financial_operations.id，除撮合成交外）

| 子表.字段 | 父表.字段 | 来源 |
|---|---|---|
| financial_ledger.operation_id | financial_operations.id | runner:L125 |
| withdrawal_requests.freeze_operation_id | financial_operations.id | runner:L290 |
| withdrawal_requests.review_operation_id | financial_operations.id | runner:L291 |
| deposit_records.credit_operation_id | financial_operations.id | runner:L294 |
| earn_positions.subscribe_operation_id | financial_operations.id | runner:L172 |
| earn_positions.redeem_operation_id | financial_operations.id | runner:L173 |
| financial_spot_orders.operation_id | financial_operations.id | runner:L1153 |
| financial_matching_orders.reserve_operation_id | financial_operations.id | runner:L1316 |
| financial_matching_trades.operation_id | financial_operations.id | runner:L1346 |
| financial_matching_trades.maker_order_id | financial_matching_orders.id | runner:L1339 |
| financial_matching_trades.taker_order_id | financial_matching_orders.id | runner:L1340 |
| seconds_contract_positions.open_operation_id | financial_operations.id | runner:L1846 |
| seconds_contract_positions.settle_operation_id | financial_operations.id | runner:L1856 |

### 2.3 唯一约束（含部分唯一索引）

| 约束/索引名 | 表 | 字段 | 条件 |
|---|---|---|---|
| financial_operations_idempotency_key_key | financial_operations | idempotency_key | — |
| financial_ledger_op_user_asset_uq | financial_ledger | (operation_id, user_id, asset) | — |
| withdrawal_requests_request_id_key | withdrawal_requests | request_id | — |
| deposit_records_idempotency_key_key | deposit_records | idempotency_key | — |
| deposit_records_txid_asset_network_uq | deposit_records | (lower(txid), lower(asset), lower(network)) | txid 非空 |
| deposit_records_manual_reference_uq | deposit_records | lower(btrim(reference)) | source='admin_manual' AND reference 非空 |
| earn_positions_subscribe_op_id_key | earn_positions | subscribe_operation_id | — |
| earn_positions_redeem_op_id_key | earn_positions | redeem_operation_id | — |
| earn_positions_request_idempotency_key_key | earn_positions | request_idempotency_key | — |
| earn_positions_redeem_request_id_uq | earn_positions | redeem_request_id | redeem_request_id 非空 |
| financial_spot_orders_idempotency_key_key | financial_spot_orders | idempotency_key | — |
| financial_spot_orders_operation_id_key | financial_spot_orders | operation_id | — |
| financial_matching_orders_user_client_uq | financial_matching_orders | (user_id, client_order_id) | — |
| financial_matching_orders_reserve_op_id_key | financial_matching_orders | reserve_operation_id | — |
| financial_matching_trades_operation_id_key | financial_matching_trades | operation_id | — |
| seconds_open_request_id_key | seconds_contract_positions | open_request_id | — |
| seconds_settle_request_id_key | seconds_contract_positions | settle_request_id | — |
| seconds_open_operation_id_key | seconds_contract_positions | open_operation_id | — |
| seconds_settle_operation_id_key | seconds_contract_positions | settle_operation_id | — |
| legacy_migration_uq | financial_legacy_migration_records | (source_sha256, source_collection, migration_id) | — |

### 2.4 普通索引（非唯一）

| 索引名 | 表 | 字段 |
|---|---|---|
| financial_ledger_user_asset_time_idx | financial_ledger | (user_id, asset, created_at desc) |
| withdrawal_requests_user_time_idx | withdrawal_requests | (user_id, created_at desc) |
| withdrawal_requests_status_time_idx | withdrawal_requests | (status, created_at) |
| deposit_records_user_time_idx | deposit_records | (user_id, created_at desc) |
| financial_audit_subject_time_idx | financial_audit_log | (subject_user_id, created_at desc) |
| financial_spot_orders_user_time_idx | financial_spot_orders | (user_id, created_at desc) |
| financial_matching_book_asks_idx | financial_matching_orders | (base,quote,price asc,created_at,id) WHERE sell+活跃 |
| financial_matching_book_bids_idx | financial_matching_orders | (base,quote,price desc,created_at,id) WHERE buy+活跃 |
| financial_matching_orders_user_idx | financial_matching_orders | (user_id, created_at desc) |
| financial_matching_trades_pair_time_idx | financial_matching_trades | (pair_key, created_at desc) |
| seconds_positions_user_status_due_idx | seconds_contract_positions | (user_id, status, settle_at desc) |
| financial_legacy_migration_collection_idx | financial_legacy_migration_records | (source_sha256, source_collection, legacy_status) |

---

## 3. 表间关系图（文字描述 + 外键指向）

```
                          ┌──────────────────────────┐
                          │   financial_operations   │  (id uuid PK, 幂等中枢)
                          │  operation_type 枚举(13)  │
                          └────────────┬─────────────┘
                                       │ 1
        ┌──────────┬───────────┬───────┼────────┬────────────┬────────────┐
        │          │           │       │        │            │            │
   1..* │     1..* │      1..* │  1..* │   1..* │       1..* │       1..* │
        ▼          ▼           ▼       ▼        ▼            ▼            ▼
┌────────────┐ ┌────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌───────────────┐
│financial_  │ │with-   │ │deposit_  │ │earn_positions│ │spot_orders│ │matching_orders│
│ledger      │ │drawal_ │ │records   │ │(subscribe_op│ │(operation_│ │(reserve_op_id)│
│(operation_ │ │requests│ │(credit_op│ │ +redeem_op) │ │ id)       │ └──────┬────────┘
│ id)        │ │(freeze+│ │ _id)     │ └──────┬──────┘ └──────────┘        │ 1
└────────────┘ │review_ │ └──────────┘        │ product_id (逻辑引用,无FK)  │
               │ op_id)  │                    ▼                            │ 1..*
               └─────────┘            ┌──────────────────┐                 ▼
                                      │earn_product_     │        ┌──────────────────┐
                                      │catalog (product_ │        │matching_trades   │
                                      │ id PK)           │        │(maker/taker_order│
                                      └──────────────────┘        │ _id → orders.id; │
                                                                  │ operation_id)    │
┌─────────────────────────────┐      ┌──────────────────┐        └──────────────────┘
│seconds_contract_positions   │      │financial_accounts│
│(open_operation_id +          │◄────►│(user_id, asset)  │  所有资金变动最终更新此表
│ settle_operation_id)         │      │ available/frozen │
└─────────────────────────────┘      └──────────────────┘
┌──────────────────┐  逻辑引用 user_id（无FK，所有表均含 user_id 但无外键约束）
│financial_audit_log│  append-only 审计
└──────────────────┘
┌──────────────────┐  KV 单例，独立
│  btcbox_state    │
└──────────────────┘
┌──────────────────────────────┐  staging-only，独立，不接入生产关系
│financial_legacy_migration_   │
│records (未 REST 暴露)         │
└──────────────────────────────┘
```

关系要点：
1. **financial_operations 是唯一被多方外键引用的父表**；所有资金类业务行均通过 `*_operation_id` 关联到一条操作记录，再由 financial_ledger 记录实际余额变动。
2. **user_id 无外键约束**：所有业务表均含 user_id 文本字段，但不存在 users 表的外键（用户体系在 Supabase auth.users 或外部，未核实）。
3. **earn_positions.product_id 逻辑引用 earn_product_catalog.product_id**，但 SQL 中未声明外键（仅通过迁移时的一致性校验 DO 块强制，runner:L742-749）。
4. **financial_matching_trades 双外键**指向 financial_matching_orders（maker+taker），是唯一表间自引用关系。
5. **financial_accounts 无被外键引用**，是余额终点，由 RPC 内部更新。

---

## 4. RLS 启用情况与策略作用范围

### 4.1 启用 RLS 的表（全部 15 张）

| 表 | 启用语句来源 |
|---|---|
| btcbox_state | runner:L50 |
| financial_accounts / financial_operations / financial_ledger / withdrawal_requests / deposit_records / earn_positions / financial_audit_log | runner:L264-270 |
| earn_product_catalog | runner:L818 |
| financial_spot_orders | runner:L1158 |
| financial_matching_markets | runner:L1299 |
| financial_matching_orders / financial_matching_trades | runner:L1353-1354 |
| seconds_contract_positions | runner:L1866 |
| financial_legacy_migration_records | module:`financial_migration_staging_v5.sql:L20` |

### 4.2 策略作用范围

- **未发现任何 `CREATE POLICY` 语句**（已对全部 SQL 全文 grep）。RLS 启用后默认拒绝所有非超级用户/表所有者访问，实际访问通过 `REVOKE ... FROM public, anon, authenticated` + `GRANT ... TO 服务端高权限角色` 实现角色级控制。
- 即：**浏览器角色（anon/authenticated）对所有业务表零权限**；所有读写必须通过 服务端高权限角色 调用 RPC（SECURITY INVOKER，以调用者角色执行）。
- 部分表权限更窄：
  - `earn_product_catalog`、`financial_matching_markets`：服务端高权限角色 仅 SELECT。
  - `financial_matching_trades`：服务端高权限角色 仅 SELECT/INSERT（无 UPDATE）。
  - `btcbox_state`：服务端高权限角色 SELECT/INSERT/UPDATE（无 DELETE）。
- **未核实**：是否存在 Supabase Dashboard 中手动创建但未写入迁移文件的 POLICY（无法通过只读 SQL 文件核实，标注未核实）。

---

## 5. 数据库函数 / 触发器 / 视图 / RPC 清单

### 5.1 RPC（PostgREST /rpc/* 暴露，共 20 个，全部 服务端高权限角色 ONLY）

> 入参/返回以 SQL `CREATE OR REPLACE FUNCTION` 签名为准。OpenAPI 中所有 RPC 均显示为单 `args` object 入参，无细粒度字段（PostgREST 惯例），故以下签名来自 SQL。

| # | RPC 名称 | 入参签名 | 返回 | 作用 | 来源 |
|---|---|---|---|---|---|
| 1 | apply_financial_operation | (p_idempotency_key text, p_user_id text, p_asset text, p_operation_type text, p_available_delta numeric, p_frozen_delta numeric, p_request_hash text, p_metadata jsonb default '{}') | jsonb | 底层原子余额变动原语，所有资金 RPC 内部调用；幂等 | runner:L200-262 |
| 2 | btcbox_save_state | (p_expected_revision bigint, p_data jsonb) | boolean | KV 状态 CAS 写 | runner:L54；module:btcbox_state_cas.sql:L11 |
| 3 | create_withdrawal_atomic | (p_withdrawal_id, p_user_id, p_asset, p_network, p_amount numeric, p_fee numeric, p_destination, p_request_id, p_request_hash) 9参 | jsonb | 创建提现+冻结资金 | runner:L299 |
| 4 | review_withdrawal_atomic | (p_withdrawal_id text, p_admin_id text, p_approve boolean, p_reason text default '') | jsonb | 审核提现（通过/拒绝）+解冻或扣减 | runner:L342 |
| 5 | confirm_deposit_atomic | (p_deposit_id text, p_admin_id text) | jsonb | **fail-closed**：链上核验启用后手动确认被禁用，仅允许重复查询 | runner:L2111（最终版）；module:financial_deposit_chain_verification_v3.sql:L106 |
| 6 | subscribe_earn_atomic | (p_position_id, p_user_id, p_product_id, p_asset, p_principal numeric, p_request_id, p_request_hash) 7参 | jsonb | 理财申购+扣可用 | runner:L849（最终版）；module:financial_earn_policy_v5.sql:L142 |
| 7 | redeem_earn_atomic | (p_position_id text, p_user_id text, p_request_id text, p_request_hash text) 4参（最终版，数据库自算收益） | jsonb | 理财赎回+返还本息 | runner:L916（最终版）；module:financial_earn_policy_v5.sql:L209 |
| 8 | admin_adjustment_atomic | (p_request_id, p_admin_id, p_user_id, p_asset, p_available_delta numeric, p_frozen_delta numeric, p_reason, p_request_hash) 8参 | jsonb | 管理员余额调账 | runner:L525；module:financial_admin_adjustment_v1.sql:L54 |
| 9 | admin_manual_deposit_atomic | (p_deposit_id, p_admin_id, p_user_id, p_asset, p_amount numeric, p_request_id, p_request_hash, p_reference default '', p_note default '') 9参 | jsonb | 管理员手动充值入账（当前业务模型主路径） | runner:L1039；module:financial_admin_manual_deposit_v1.sql:L30 |
| 10 | execute_spot_trade_atomic | (p_order_id, p_user_id, p_base_asset, p_quote_asset, p_side, p_order_type, p_price numeric, p_quantity numeric, p_idempotency_key, p_request_hash) 10参 | jsonb | 现货成交（非撮合，调用方已验证价格） | runner:L1162；module:financial_spot_trade_v3.sql:L31 |
| 11 | submit_limit_order_matching_v1 | (p_order_id, p_user_id, p_base_asset, p_quote_asset, p_side, p_price numeric, p_quantity numeric, p_client_order_id) 8参 | jsonb | 提交限价单+冻结+循环撮合 | runner:L1359；module:financial_matching_engine_v1.sql:L84 |
| 12 | cancel_limit_order_matching_v1 | (p_user_id text, p_order_id text, p_client_cancel_id text) 3参 | jsonb | 撤销限价单+解冻剩余 | runner:L1527；module:financial_matching_engine_v1.sql:L263 |
| 13 | read_financial_account_snapshot_v1 | (p_user_id text) | jsonb | 用户账户快照（余额+提现+理财持仓，earn 扩展版覆盖基础版） | runner:L1637（最终版）；module:financial_read_api_earn_v1.sql:L6 |
| 14 | read_admin_withdrawal_snapshot_v1 | () 无参 | jsonb | 管理员待审核提现列表 | runner:L1726；module:financial_admin_read_api_v1.sql:L5 |
| 15 | read_admin_account_balances_v1 | (p_user_ids text[]) | jsonb | 管理员批量查用户余额 | runner:L1779；module:financial_admin_account_read_api_v1.sql:L5 |
| 16 | submit_seconds_order_v1 | (p_position_id, p_user_id, p_symbol, p_direction, p_amount numeric, p_duration_sec integer, p_open_price numeric, p_request_id, p_request_hash) 9参 | jsonb | 秒合约开仓+冻结 | runner:L1870；module:financial_seconds_contracts_v1.sql:L48 |
| 17 | settle_seconds_position_v1 | (p_position_id, p_user_id, p_request_id, p_request_hash, p_symbol, p_settle_price numeric, p_settle_price_source, p_settle_price_ts timestamptz) 8参 | jsonb | 秒合约结算（按外部参考价） | runner:L1917；module:financial_seconds_contracts_v1.sql:L95 |
| 18 | read_seconds_positions_v1 | (p_user_id text) | jsonb | 用户秒合约持仓+历史 | runner:L1978；module:financial_seconds_contracts_v1.sql:L145 |
| 19 | verify_and_credit_deposit_atomic | (p_deposit_id, p_verifier_id, p_txid, p_asset, p_network, p_observed_amount numeric, p_confirmations integer, p_required_confirmations integer, p_request_id, p_request_hash) 10参 | jsonb | 链上核验通过后自动入账（可选启用） | runner:L2018；module:financial_deposit_chain_verification_v3.sql:L13 |
| 20 | rls_auto_enable | —（OpenAPI 暴露） | — | **未核实**：全部 SQL 迁移文件中未找到该函数定义；可能为 Supabase 内部/历史遗留/外部创建 | OpenAPI /rpc/rls_auto_enable；SQL 中无匹配 |

> 注：`redeem_earn_atomic` 存在两个历史签名（5 参含 p_payout → 4 参自算收益），最终版为 4 参（runner:L914-916 DROP 旧重载）。`confirm_deposit_atomic` 同样被链上核验版覆盖为 fail-closed。`read_financial_account_snapshot_v1` 被 earn 扩展版覆盖。

### 5.2 触发器（2 个，均 BEFORE UPDATE）

| 触发器名 | 表 | 触发函数 | 作用 | 来源 |
|---|---|---|---|---|
| deposit_confirmed_immutable_guard | deposit_records | guard_confirmed_deposit_immutable() | 已确认充值的用户/资产/网络/金额/txid/幂等键/状态不可变 | runner:L496-523 |
| earn_position_snapshot_immutable | earn_positions | guard_earn_position_snapshot() | 持仓身份与策略快照（product_id/apy/期限等 14 字段）申购后不可改写 | runner:L823-846 |

### 5.3 视图 / 自定义类型

- **视图**：0 个（全部 SQL 无 CREATE VIEW）。
- **自定义 TYPE**：0 个（无 CREATE TYPE；枚举全部 text + CHECK）。
- **扩展**：`pgcrypto`（runner:L99，用于 digest/sha256）。

---

## 6. 按业务域归类

| 业务域 | 表 | 关键 RPC |
|---|---|---|
| 用户/账户 | financial_accounts（user_id+asset 余额） | read_financial_account_snapshot_v1, read_admin_account_balances_v1 |
| 资产（余额核心） | financial_accounts.available / .frozen / .version | apply_financial_operation（底层原语） |
| 充值 | deposit_records | admin_manual_deposit_atomic（主路径）, verify_and_credit_deposit_atomic（可选链上）, confirm_deposit_atomic（fail-closed） |
| 提现 | withdrawal_requests | create_withdrawal_atomic, review_withdrawal_atomic, read_admin_withdrawal_snapshot_v1 |
| 划转 | （无独立划转表；admin_adjustment_atomic 承担单边调账，双边划转未发现专用 RPC — 未核实） | admin_adjustment_atomic |
| 订单（现货非撮合） | financial_spot_orders | execute_spot_trade_atomic |
| 交易（撮合限价单） | financial_matching_markets, financial_matching_orders, financial_matching_trades | submit_limit_order_matching_v1, cancel_limit_order_matching_v1 |
| 秒合约 | seconds_contract_positions | submit_seconds_order_v1, settle_seconds_position_v1, read_seconds_positions_v1 |
| 理财 | earn_product_catalog, earn_positions | subscribe_earn_atomic, redeem_earn_atomic |
| 资金流水 | financial_ledger, financial_operations | （无直接 RPC，由各资金 RPC 内部写入） |
| 审计 | financial_audit_log | （append-only，由 RPC 内部写入） |
| KV 状态 | btcbox_state | btcbox_save_state |
| 迁移 staging（非生产） | financial_legacy_migration_records | （无 RPC，仅 staging 导入） |

---

## 7. 专项标注：余额 / 冻结 / 可用 / 订单状态 / 资金状态字段

### 7.1 余额类字段

| 表.字段 | 含义 | 类型 | 约束 |
|---|---|---|---|
| financial_accounts.available | **可用余额** | numeric(38,18) | NOT NULL DEFAULT 0, CHECK >=0 |
| financial_accounts.frozen | **冻结余额** | numeric(38,18) | NOT NULL DEFAULT 0, CHECK >=0 |
| financial_accounts.version | 乐观锁版本号 | bigint | NOT NULL DEFAULT 0 |
| financial_ledger.available_delta | 可用余额变动（有符号） | numeric(38,18) | NOT NULL |
| financial_ledger.frozen_delta | 冻结余额变动（有符号） | numeric(38,18) | NOT NULL |
| financial_ledger.available_after | 变动后可用 | numeric(38,18) | NOT NULL, CHECK >=0 |
| financial_ledger.frozen_after | 变动后冻结 | numeric(38,18) | NOT NULL, CHECK >=0 |
| financial_matching_orders.reserved_remaining | 订单冻结剩余 | numeric(38,18) | NOT NULL, CHECK >=0 |
| earn_positions.principal | 理财冻结本金 | numeric(38,18) | NOT NULL, CHECK >0 |
| seconds_contract_positions.amount | 秒合约冻结投注额 | numeric(38,18) | NOT NULL, CHECK >0 |
| seconds_contract_positions.pnl | 秒合约盈亏 | numeric(38,18) | NULL（结算后填） |

### 7.2 状态字段枚举（来自 SQL CHECK 约束，权威）

| 表.字段 | 枚举取值 | 来源 |
|---|---|---|
| financial_operations.operation_type | deposit_credit, withdraw_freeze, withdraw_approve, withdraw_reject, earn_subscribe, earn_redeem, admin_adjustment, spot_trade, spot_order_reserve, spot_order_cancel, seconds_open, seconds_settle, migration_opening_balance（共 13 个，最终版） | runner:L1828-1830 |
| financial_operations.status | applied（仅 1 个取值，CHECK 约束限定） | runner:L117 |
| withdrawal_requests.status | pending, approved, rejected, broadcast, failed | runner:L144 |
| deposit_records.status | pending, confirmed, rejected | runner:L158 |
| deposit_records.source | chain（默认）, admin_manual（函数内写入；无 CHECK 约束，来自代码推断） | module:financial_admin_manual_deposit_v1.sql:L11 |
| earn_positions.status | active, redeemed, matured | runner:L171 |
| earn_product_catalog.product_type | demand, fixed | runner:L717 |
| financial_spot_orders.side | buy, sell | runner:L1146 |
| financial_spot_orders.order_type | market, limit | runner:L1147 |
| financial_spot_orders.status | filled（仅 1 个取值） | runner:L1151 |
| financial_matching_orders.side | buy, sell | runner:L1308 |
| financial_matching_orders.status | open, partially_filled, filled, cancelled | runner:L1312 |
| seconds_contract_positions.symbol | BTC, ETH, SOL, BNB | runner:L1837 |
| seconds_contract_positions.direction | up, down | runner:L1838 |
| seconds_contract_positions.duration_sec | 30, 60, 300, 900 | runner:L1840 |
| seconds_contract_positions.status | open（默认）, settled | runner:L1848 |
| seconds_contract_positions.settle_price_source | coinbase, bybit（函数内 CHECK，非表级约束） | module:financial_seconds_contracts_v1.sql:L108 |
| financial_legacy_migration_records.source_collection | account_snapshot, withdrawal, deposit, order, earn_record | module:financial_migration_staging_v5.sql:L7 |

---

## 8. 未核实 / 来自代码推断 项清单

1. **`rpc/rls_auto_enable`**：OpenAPI 暴露但全部 SQL 迁移中无函数定义。来源、入参、返回、作用均未核实。
2. **是否存在迁移文件外的 POLICY**：SQL 中无 CREATE POLICY，但不排除 Supabase Dashboard 手动创建。未核实。
3. **user_id 关联的用户表**：所有业务表含 user_id 但无外键，用户体系（auth.users 或外部）未核实。
4. **deposit_records.source 枚举**：表级无 CHECK，仅见默认 'chain' 与函数写入 'admin_manual'。完整取值来自代码推断。
5. **seconds_contract_positions.pnl 计算规则**：胜=+85%×amount、负=-amount、平=0，来自函数内计算代码（module:financial_seconds_contracts_v1.sql:L115-116），非表约束。
6. **划转（双边）专用 RPC/表**：未发现；仅 admin_adjustment_atomic 单边调账。是否存在应用层组合划转未核实。
7. **financial_audit_log.action 枚举**：表级无 CHECK，取值来自各 RPC 插入语句（admin_balance_adjustment / admin_manual_deposit_confirmed / deposit_chain_verified_and_credited / earn_redeemed 等），不完整。
8. **OpenAPI 与 SQL 类型不一致**：earn_positions.amount_scale 与 earn_product_catalog.amount_scale，OpenAPI 报 integer(int32)，SQL 为 smallint。以 SQL 为准，已标注。
9. **btcbox_state.data 内部结构**：仅 CHECK 为 jsonb object 且必须含 'users' 键（函数内校验 runner:L63）。内部 schema 未核实。
10. **financial_matching_markets 种子数据**：表定义存在，但迁移文件中未见 INSERT 种子（与 earn_product_catalog 不同）。交易对初始配置来源未核实。

---

## 9. 依据来源索引

- OpenAPI 快照：`work/sb_openapi.json`（14 definitions + 20 /rpc/ paths）。
- 全量迁移：`repo/supabase-migration-runner.sql`（行号引用见各节）。
- 分模块迁移：`repo/supabase/sql/` 下 19 个 .sql + `MIGRATION-ORDER-AND-CUTOVER.md`（顺序与 cutover 说明）。
- 只读诊断脚本（非迁移）：`financial_ledger_reconciliation_v1.sql`、`financial_migration_reconciliation_v4.sql`、`financial_migration_staging_reconciliation_v6.sql`。
- Supabase 项目 ref：zlozsutefnmgwwzrlipt（仅元数据查询，未写入）。
