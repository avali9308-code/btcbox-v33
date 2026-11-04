# BTCBOX AI3 Integration & Release Remediation Queue

**Audit date:** 2026-11-02  
**Scope:** business-team source archive, current `feature/ai1-visual` source/deployment, connected Supabase schema and security metadata.  
**Release status:** BLOCKED. This queue records verified findings; it is not a production-readiness approval.

## P0 — KYC document upload reports success but discards the documents

**Evidence**
- `pages/kyc.html` requires front/back images, converts them to Data URLs, and sends them as `docs` to `POST /api/kyc`.
- `api/core.js` KYC handler stores only status/name/type/ID number/submission time; it never reads or persists `body.docs`.
- The shared request parser rejects bodies larger than 1 MiB, so two ordinary phone photos encoded as Data URLs may fail before reaching the KYC handler.
- The UI displays a success toast and reloads when the API returns `ok`, despite the files not being stored.

**User impact:** customers can believe their documents were submitted while the review team has no images. This is a false-success state.

**Required fix**
1. Use private Supabase Storage; never public buckets or public document URLs.
2. Upload with authenticated, narrowly scoped authorization; store object paths/metadata, not Data URLs in the shared user-state JSON.
3. Validate actual file signature, MIME allowlist, per-file size, image dimensions, and total upload size server-side.
4. Persist both document references and the application using an atomic or recoverable upload/submit state machine.
5. Add idempotent retries, duplicate-submit protection, abandoned-upload cleanup, short-lived admin review access, and access audit records.
6. Show success only after both files and the application are durably stored.

**Acceptance tests:** valid uploads survive refresh/re-login; unsupported/oversized/corrupt/missing files fail with localized field errors; partial network failure cannot create a false pending application; repeated submit creates no duplicate; pending/approved/rejected/resubmit states work in every locale.

## P1 — Full identity number is returned by the account API

**Evidence:** `POST /api/kyc` stores the full `id_number`; `GET /api/account` returns `kyc: user.kyc` unchanged. The page masks the number visually, but the API payload contains the unmasked value.

**Required fix:** return only minimum client fields and a masked suffix if needed; keep full identity data in a dedicated protected KYC record; exclude identity data from logs/analytics/errors; add response-contract tests proving the full number and document paths are not returned to ordinary user endpoints.

## P1 — User deposit flow does not create a pending deposit request

**Evidence:** `POST /api/deposit` returns an address for a zero/omitted amount. A positive amount is explicitly rejected with HTTP 403. The README also states that the pending user-deposit order and approval RPC workflow are incomplete.

**Required fix:** implement a durable pending request (asset/network/amount/destination/request ID/status/immutable tx reference), chain/manual-review confirmation rules, atomic idempotent credit RPC, and tests for pending → confirming → credited/rejected/failed, duplicate txids, wrong network, amount mismatch, and replay.

## P1 — Matching markets and fee rules are not live-ready

**Live database evidence:** `financial_matching_markets` has **0 rows**, **0 enabled markets**. Schema constraints require `maker_fee_rate = 0` and `taker_fee_rate = 0`, rejecting non-zero fees.

**Required fix:** approve symbol whitelist, price tick, quantity step, min quantity/notional, price protection, fee policy and rounding; replace zero-only constraints through a reviewed migration; seed/test only in isolated staging. Do not enable funded matching before precision, partial-fill, cancel, concurrency, idempotency, rollback, and ledger reconciliation tests pass.

## P1 — Migration provenance is incomplete

**Live database evidence:** 14 business/financial tables and all 14 expected financial RPC signatures exist. The migration history currently contains only `20261102133555 / revoke_public_execute_rls_auto_enable`; the existing schema/RPC evolution is therefore not fully represented in recorded migrations.

**Required fix:** reconcile live schema against checked-in SQL in dependency order; create a reviewed baseline/adoption plan; restore a backup to isolated staging and replay from clean state. Do not blindly re-run schema, data, or opening-balance scripts on the live project.

## Security posture verified

- RLS is enabled on all 14 public tables. `anon` and `authenticated` have no direct table privileges; `service_role` has server-side access.
- All 14 required financial RPC signatures exist; only `service_role` can execute them.
- The 14 “RLS enabled without policy” advisor findings are informational under this server-only access model. Do not add broad client policies merely to silence the linter.
- `public.rls_auto_enable()` was SECURITY DEFINER and callable by anon/authenticated. A migration has revoked those roles' EXECUTE; verification confirms they are denied while service_role retains it. The DDL event trigger remains installed.
- Supabase Auth leaked-password protection is disabled; enable it in Auth security settings.
- Vercel marks `SUPABASE_SECRET_KEY` as `readable-secret` (config visibility). Change its visibility to Secret in Vercel, or remove it only after confirming the legacy fallback is unused. The separate `SUPABASE_SERVICE_ROLE_KEY` entries are marked sensitive. No secret values were read.

## Build and branch integration

- Vercel deployment for `feature/ai1-visual` commit `97148288daad493d4bc1fc642283fce16e6ebcd4` failed `npm run build && npm test`: the CSS/HTML scan found `--font-ui` referenced but undefined.
- AI3 added `--font-ui:var(--font-sans)` on an isolated branch. Its first preview reached READY and Vercel status passed. A follow-up PR against the moving AI1 branch encountered Vercel build-rate limiting; this is not a reported code assertion.
- The uploaded business-team ZIP is not identical to the deployed Git branch. ZIP-local checks: 293 tests pass, build passes, 42 inline JS blocks parse. These results do not certify the deployed commit.
- ZIP-local `npm run preflight` failed because no local environment variables were supplied; this does not prove Vercel variables are absent.

## Performance follow-up

Supabase reports five unindexed foreign keys: `deposit_records.credit_operation_id`, `financial_matching_trades.maker_order_id`, `financial_matching_trades.taker_order_id`, `withdrawal_requests.freeze_operation_id`, and `withdrawal_requests.review_operation_id`. Add indexes in a reviewed migration after checking query plans. Do not remove unused indexes without workload evidence.

## Cross-team ownership

- **AI1 / Product:** implement secure KYC upload/storage and pending-deposit workflow; complete symbol/fee policy and publish API contracts/test fixtures.
- **AI2 / Quality:** independently test registration/login, KYC upload and status changes, deposit/withdrawal forms, order lifecycle, locale changes, network failures, and mobile layouts using synthetic data only.
- **AI3 / Integration:** reconcile branch/source versions, verify cross-module state/API contracts, review security/migration evidence, run integrated tests, and prepare deployment gates.

## Financial release gate

Keep real-money deposits, withdrawals, spot orders, matching, and contract settlement disabled until clean staging migration replay, RPC grants/RLS, symbol precision/minimums/fees/price protection, duplicate/retry/partial-fill/cancel/concurrency/rollback tests, buyer/seller ledger reconciliation, end-to-end user journeys, backup/rollback/monitoring, and explicit release acceptance are complete.

**No real identity documents, real deposits, real withdrawals, or funded trading during acceptance testing.**
