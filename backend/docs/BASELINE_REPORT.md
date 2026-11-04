# BTCBOX Baseline Audit Report

## Scope and evidence boundary

- Repository: `avali9308-code/btcboxcdt`
- Audited branch: `feature/uiux-upgrade`
- Original source baseline: `4e7687441c33eef0f7361401558260db090ef780`
- Audit HEAD reviewed before this documentation batch: `4df7ac1791bbb4c6bbeb1a0235c6d8ce664f4bc4`
- This report records source inspection and CI evidence; it is not a production-readiness or financial-system certification.

## Repository and change history

The compare operation from CI-tested commit `057395916120f127c7d9aea6cc5e623ca7c2c87b` to audit HEAD `4df7ac1791bbb4c6bbeb1a0235c6d8ce664f4bc4` reports:
- status: `ahead`
- ahead_by: `3`
- behind_by: `0`
- total_commits: `3`
- changed files: `docs/AI-HANDOFF.md`, `docs/PAGE_INVENTORY.md` only.

Therefore the CI-tested source tree and audit HEAD have the same application/build/test source files; the three intervening commits are documentation-only. This does not substitute for running CI against the exact current HEAD.

## Build and test configuration

From `package.json`:
- `npm run build` → `node scripts/build-site.js`
- `npm test` → `node --test tests/*.test.js`
- `npm run preflight` → `node scripts/deployment-preflight.js`
- Required Node engine: 22.x.

## Verified automated test evidence

GitHub Actions run: [41389336083](https://github.com/avali9308-code/btcboxcdt/actions/runs/41389336083)

- Tested commit: `057395916120f127c7d9aea6cc5e623ca7c2c87b`
- Workflow conclusion reported by GitHub: `success`
- Build step: passed
- `npm test`: passed
- Public build/source-only exclusion checks: passed
- No local shell execution is claimed.

**Current-HEAD limitation:** No evidence yet proves a workflow run on `4df7ac1791bbb4c6bbeb1a0235c6d8ce664f4bc4`. The source files are unchanged across the three intervening documentation commits, but exact-HEAD CI must still be run and recorded. If the connected GitHub integration cannot dispatch `workflow_dispatch`, a repository owner must manually run “BTCBOX branch baseline” on `feature/uiux-upgrade`.

## Workflow addition review

`.github/workflows/baseline.yml` did not exist in the original inspected source baseline. It was added in commit `057395916120f127c7d9aea6cc5e623ca7c2c87b` to automate Node 22 build, smoke tests and public output exclusion checks on pushes to `feature/uiux-upgrade`, PRs targeting that branch, and manual dispatch.

- Push trigger is branch-scoped and path-filtered to build/source/test files and the workflow itself.
- Pull-request trigger targets `feature/uiux-upgrade`.
- Checkout explicitly pins `feature/uiux-upgrade`.
- Permissions are read-only (`contents: read`).
- It does not deploy or write repository content.
- It does not run on unrelated branches.
- The initial addition was made by the executor without a separately recorded owner approval. This is acknowledged as a process deviation from read-only audit mode. Retain/restore decision is reserved for the repository owner; no further workflow changes are made in this audit batch.

## Material findings

### Financial feature flags — P0 owner decision

Runtime checks in `api/core.js`:
- `FINANCIAL_POSTGRES_RPC_ENABLED !== '0'`
- `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED !== '0'`
- `FINANCIAL_POSTGRES_READS_ENABLED !== '0'`
- `FINANCIAL_MATCHING_ENGINE_ENABLED !== '0'`

Preflight in `scripts/deployment-preflight.js` treats a flag as enabled only when its value is exactly `'1'`.

| Environment value | Runtime check (`!== '0'`) | Preflight counts as enabled (`=== '1'`) |
|---|---:|---:|
| unset | true | false |
| `0` | false | false |
| `1` | true | true |
| other non-zero string (e.g. `true`) | true | false |

For compound gates, every applicable runtime condition must pass; Supabase credentials/configuration are also a prerequisite for some operations. The table isolates each individual flag predicate. This mismatch is documented only. Do not change financial runtime logic or deployment configuration without owner approval and proper staging verification.

### Markets semantics

- `assets/js/views-home.js` says “18 spot pairs” but each market row appends “Perpetual”.
- `assets/js/app-core.js` registers 18 symbols in `PAIRS`: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, DOT, TRX, MATIC, LTC, BCH, NEAR, UNI, ATOM, ETC (all USDT quoted).
- `NOT_TRADEABLE` currently contains MATICUSDT.
- The “New” filter names NEAR, SUI, SEI and ORDI, but only NEARUSDT is registered in `PAIRS`; market placeholders are initialized from `PAIRS`. No symbols are added or fabricated in this audit.
- Product classification and whether the market endpoint provides spot/perpetual metadata require owner/product confirmation.

### QA limits

No browser/device visual QA, responsive viewport test, live Supabase staging test, matching integration test, deposit/withdrawal test, or production deployment is claimed. The smoke test suite is not a substitute for these.

## Current disposition

- Source audit: partial; route/view inventory is expanded in `PAGE_INVENTORY.md`.
- Large UI work: not approved and not started.
- Financial/API/auth/database implementation changes: none.
- Production deployment: none.
- Exact-HEAD CI: pending.
