# BTCBOX Independent Final Acceptance Audit

Audit date: 2026-10-28
Audited input: `BTCBOX-v33-reaudited-english-usdt(1).zip`
Extracted project root: `BTCBOX-v33-audited-clean/`

## Executive decision

**NOT ACCEPTED for real-money production.** The submitted source builds and its bundled automated suites pass, but static evidence reveals material acceptance blockers. In particular, the seconds-contract API calls three PostgreSQL RPCs that are not defined in any SQL migration in this archive, and no preset-result feature/configuration was found. The financial cutover is explicitly fail-closed by default and the included cutover status says production cutover is not ready. Do not enable financial cutover flags merely to make routes work.

No money-moving code, permissions, 2FA, database constraints, or financial cutover flags were altered. The only addition made for this pass is this evidence-based report. Implementing missing settlement RPCs or a preset-result system without an agreed, auditable business rule and staging database would be unsafe.

## A. Audit scope and files actually read

- Archive inventory: 253 entries; 253 extracted files counted in the project tree before build output was regenerated.
- Core frontend: `index.html`, `pages/*.html`, `admin.html`, `assets/css/style.css`, `assets/js/app.js`, `assets/js/i18n.js`, `assets/js/market-api.js`.
- Backend: `netlify/functions/api.js`, `financial_db.py`, `financial_operation_contract.py`, `financial_storage_guard.py`, `server.py`.
- Deployment: `package.json`, `package-lock.json`, `.env.example`, `netlify.toml`, `scripts/build-site.js`.
- Database/migrations: all `supabase/sql/*.sql`, plus cutover and migration status documentation.
- Tests: all Node test files and Python test files were present; automated suites were executed from the extracted project.
- Existing audit reports and changelogs were treated as claims to verify, not as evidence of correctness.

## B. Confirmed issues by severity

### P0 — Do not enable real-money seconds contracts

1. `netlify/functions/api.js` calls `submit_seconds_order_v1`, `settle_seconds_position_v1`, and `read_seconds_positions_v1` (approximately lines 1170, 1195, and 1210). A full search of every `supabase/sql/*.sql` file found **none** of these RPC definitions. The client/API path therefore depends on database functions not shipped in this archive. Runtime success cannot be inferred.
2. No preset-result feature was found in the archive: no preset-result configuration, admin UI, API field/route, database column/table, or settlement branch was found. The existing `pages/seconds.html` has order/settlement UI, but that does not establish the requested preset-result feature exists.
3. `ROUND-144-FINANCIAL-CUTOVER-STATUS.json` itself records `production_cutover_ready: false` and says live database validation, staging concurrency tests, rollback tests, ledger reconciliation, and backup/restore verification have not been done. `netlify/functions/api.js` also makes money-changing routes fail closed unless the full set of cutover flags and database credentials are present. This is the safe default; it must remain so until the stated evidence exists.

### P1 — English-only runtime requirement is not fully demonstrated

4. `netlify/functions/api.js` contains numerous user-facing API `msg` strings in Chinese. A static scan found 235 lines with CJK text and user-facing fields such as `msg`, `title`, `message`, `reason`, or `label`. Examples include rate-limit, registration/login, 2FA, seconds-contract, deposit and financial errors. Some client-side translation logic may translate known DOM text, but raw API responses are not proof of an English-only interface. Runtime flows must be checked and these responses should be normalized to English or mapped to stable error codes with English client copy.
5. `assets/js/i18n.js` retains legacy Chinese/Japanese/Korean/Vietnamese dictionaries and large Chinese source-copy maps. This is not by itself proof that users see Chinese—the file contains translation source strings—but it increases the need for runtime validation of every dynamic message, accessibility attribute, confirmation and error state.

### P1 — Financial database integration is unverified

6. The API uses a legacy `btcbox_state`/Netlify Blobs state path alongside opt-in PostgreSQL financial RPCs. The code documents the risk of splitting reads and writes and uses a full-cutover gate to fail closed. This is a protective design, but the active production data authority cannot be confirmed from source alone. Do not describe the system as having completed the ledger cutover.
7. The repository has SQL migrations for ledger, deposits, withdrawals, spot trades, earn and admin reads, but the archive does not contain the three seconds-contract RPC definitions noted above. No live Supabase schema/RPC permission verification was possible in this isolated audit.

### P2 — Legacy/secondary server and deployment documentation need operational hygiene

8. `server.py` is included but is not part of the Netlify build allowlist. It contains legacy/local service code and must not be deployed as a parallel public financial API. Deployment should remain the documented Netlify Functions path unless that separate service is explicitly reviewed and hardened.
9. `netlify.toml` and multiple docs still contain Chinese comments. Comments are not user-visible UI, but release documentation and operator-facing runbooks should be kept consistent with the English-only product requirement where applicable.
10. No real browser/device interaction test was run, so dead controls, responsive rendering, console errors, keyboard/screen-reader labels and all modal paths are not certified by the passing unit tests.

## C. Fixes made and corresponding files

- Added `INDEPENDENT_FINAL_ACCEPTANCE_AUDIT.md` (this file) to preserve independently observed evidence and block unsafe overclaiming.
- No application source or financial SQL was changed. This is intentional: the absent seconds-contract database functions and unspecified preset-result behavior cannot be safely reconstructed from the client/API references alone. Inventing settlement logic or adding a preset-result control without a reviewed policy could manipulate real-money outcomes or corrupt balances.
- No financial cutover environment flags were enabled. 2FA, permissions and financial validation were not weakened.

## D. Automated tests, build and regression results

Executed from the extracted source directory:

- `node --version` → `v22.16.0`.
- `npm test` → **190 passed, 0 failed**.
- `npm run build` → exit code 0; generated `dist/` using `scripts/build-site.js`.
- `python -m pytest -q` → **230 passed, 61 subtests passed**. The Python process emitted a non-test spreadsheet-runtime warmup traceback during startup; pytest still completed successfully with all tests passing.
- `node --check` on 55 JavaScript source files outside `dist/` → **0 syntax errors**.
- Static search across all SQL migrations for `submit_seconds_order_v1`, `settle_seconds_position_v1`, and `read_seconds_positions_v1` → **0 definitions found**.
- Static search for preset-result terms and configuration (`preset_result`, `preset result`, `seconds_result`, and Chinese “预设结果”) → **0 matches** in the source files searched.
- Static scan of `netlify/functions/api.js` → **235 lines** containing CJK text in user-facing fields.

These are reproducible source/test/build checks only. They do not certify live transactions, browser UI behavior, deployed configuration, or real-money safety.

## E. Unresolved items and reasons

1. Implement and review the three seconds-contract RPCs, including atomic reservation/unfreeze, idempotency, expiry, trusted reference-price handling, server-side timestamps, history, and rollback. Requires a reviewed SQL design and staging database.
2. Determine the original intended preset-result business behavior from a trusted product specification or known-good prior source. No such implementation or specification is present in this archive. Any test-control behavior must be isolated from real users and real funds.
3. Convert all API user-facing messages to English/stable error codes and add end-to-end assertions for dynamic errors, empty/loading states, confirmations and accessibility attributes.
4. Perform browser-driven visual and interaction testing at mobile widths (including 390px and 430px) and desktop widths; check every public/admin page, modal, keyboard path and console/network failure.
5. Complete real PostgreSQL staging concurrency, duplicate request, rollback, reconciliation and backup/restore drills before approving financial cutover.
6. Verify production OAuth redirect allowlists, email templates, Netlify environment variables and Supabase RLS/RPC grants in the actual accounts.

## F. Items requiring real Netlify/Supabase environment

- Verify that the deployed Netlify site is building this exact commit/archive and publishing `dist/`.
- Verify all Supabase RPCs and migrations exist in the intended project and have correct grants/RLS, including the missing seconds-contract RPCs.
- Confirm Google OAuth client configuration, Supabase auth callback allowlist, email verification templates and session behavior.
- Run staging financial concurrency/idempotency tests against PostgreSQL; validate actual ledger rows and balance snapshots.
- Reconcile legacy state and ledger by user and asset, then perform a restore drill and operator-approved rollback.
- Validate live Coinbase-first / Bybit-fallback availability, provider rate limiting and outage/recovery behavior from the deployed function runtime.
- Confirm no production financial cutover flags are enabled until all the above are accepted.

## G. ZIP and deployment instructions

The accompanying ZIP is an **audit package**, not a declaration of production readiness. It contains the submitted source plus this report; the app source was not changed in ways that would imply the missing seconds-contract feature is repaired.

1. Review this report and resolve P0/P1 items first.
2. Push the reviewed source to GitHub.
3. In Netlify, configure the repository and keep the build command `npm test && npm run build`, publish directory `dist`, and Functions directory `netlify/functions`.
4. Configure only the required server-side Supabase secrets in Netlify environment variables; never commit secrets or expose service-role keys to the browser.
5. Keep all financial cutover flags unset until a dedicated staging database has passed RPC, concurrency, reconciliation, backup/restore and rollback acceptance.
6. Deploy a preview first, inspect function logs and browser behavior, then separately approve production deployment after the blockers are closed.
