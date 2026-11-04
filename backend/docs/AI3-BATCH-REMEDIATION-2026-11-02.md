# BTCBOX Batch Remediation Queue — 2026-11-02

Base: `main` at the time of audit. This is an evidence-based queue, not a claim that runtime acceptance has passed.
Scope: business/API integration, financial-state correctness, cross-team contracts, deployment/build safety.

## Confirmed findings

### P0 — CI does not protect main
- Evidence: `.github/workflows/baseline.yml` push trigger only names `feature/uiux-upgrade`; pull_request target only names that branch; job explicitly checks out `feature/uiux-upgrade`.
- Impact: changes to main and PRs targeting main are not guaranteed to run the repository's build and smoke tests.
- Batch action: change workflow to test the actual pushed ref / PR merge ref; include main in push and PR coverage; do not hard-code checkout of the UI branch.
- Acceptance: a push to main and a PR targeting main both run Node 22, build, smoke tests, and public-artifact allowlist assertions.

### P1 — KYC document upload is a non-functional control
- Evidence: `assets/js/views-account.js`, `VIEWS.kyc.afterRender`: `#kyc-upload` click handler only displays “No photo upload is required in this version.”
- Impact: the visible upload affordance can mislead users about what evidence is collected and what the KYC submission actually contains.
- Batch action: confirm the approved KYC policy and storage/API contract with product/security; either implement validated upload + persistence + review linkage, or remove/disable the upload affordance and clearly explain the supported submission path. Do not accept a cosmetic upload control.
- Acceptance: selected file, upload progress, upload failure, retry, submission, pending/rejected/approved states all have explicit tested transitions; no false success.

### P1 — Deposit is not yet a complete user-facing workflow
- Evidence: repository README states user-facing deposit currently returns deposit-address details but does not create a pending user deposit order; manual approval requires a separate pending-order workflow and approval RPC contract.
- Impact: users may see a deposit address without a trackable deposit request/status lifecycle.
- Batch action: define deposit intent/order creation, transaction reference capture, chain confirmation policy, manual review, idempotency, ledger credit, and user-visible states as one end-to-end contract.
- Acceptance: duplicate notifications/requests do not double-credit; no balance credit before the configured confirmation/review gate; status and ledger reconcile.

### P1 — Order numeric precision requires database-backed verification
- Evidence: `assets/js/app-core.js` serializes `qty` and `price` through JavaScript `Number`; `api/core.js` parses with `Number()` and passes `String(price)` / `String(qty)` to the matching RPC.
- Impact: JavaScript floating-point conversion may alter decimal values before database precision and symbol rules are applied.
- Batch action: define per-symbol tick size, quantity step, minimum quantity/notional, maximum precision and price protection; validate using decimal-safe parsing at the server/RPC boundary and preserve exact request strings where appropriate.
- Acceptance: tests cover smallest valid increment, one increment below/above boundaries, long decimal input, scientific notation rejection/handling, maximum limits, fees/reservations, and idempotent duplicate requests against isolated PostgreSQL.

## Verified safeguards — do not regress

- Support message renderer in `assets/js/views-account.js` uses DOM `textContent` for untrusted message text; no XSS defect confirmed in the inspected renderer.
- Withdrawal flow already distinguishes unknown transport/RPC outcomes, blocks another submission for the account, and tells users to reconcile before retrying. Preserve and regression-test this behavior.
- Order and withdrawal backend paths fail closed when matching/financial cutover is not approved. Do not enable real-money trading as part of UI remediation.

## Batch verification required before merge/deploy

1. Fix CI coverage first; prove main and PR checks run.
2. Run build + complete smoke tests on the exact candidate commit.
3. Run isolated PostgreSQL migrations and transaction tests: continuous fills, partial fills, cancel, concurrent matching, duplicate requests, rollback/failure paths, and buyer/seller ledger reconciliation.
4. Complete symbol precision/minimums/fees/price protection and verify order reserve/release accounting.
5. Test deposit lifecycle and KYC upload/state lifecycle end-to-end.
6. Browser acceptance on desktop and mobile: route refresh/deep links, static assets, forms, file upload, order states, withdrawal ambiguous outcomes, language/status consistency.
7. Run deployment preflight; verify secrets are server-only; keep all financial cutover flags disabled until all gates pass.

## Explicitly not accepted as proof

- Static source inspection alone is not runtime/browser acceptance.
- Unit/smoke tests alone are not PostgreSQL financial acceptance.
- A successful feature-branch workflow is not proof that main is protected.
- A visible button or toast is not proof that the underlying business operation exists.

## Execution status

- Main-branch source inspection: partial, static.
- Local build/tests: NOT RUN in this environment (GitHub clone previously failed due network/DNS).
- Main-branch CI: NOT VERIFIED.
- PostgreSQL financial acceptance: NOT RUN.
- Production deployment: NOT PERFORMED.
- Financial cutover: MUST REMAIN DISABLED.


## Additional main-branch findings confirmed during second-pass review

### P1 — Deposit page and API expose an address, not a trackable deposit workflow
- Evidence: `api/core.js` POST `/api/deposit` treats an empty/zero amount as address lookup and returns only `{ok,address}`; positive user-supplied amount is explicitly rejected with 403 until chain confirmation. `assets/js/views-assets.js` shows a static “Deposit history is not available via the current API yet” panel.
- Impact: the interface provides no user-visible deposit intent/order ID or deposit status timeline. A user can send funds but cannot follow the lifecycle in this page.
- Batch action: do not add client-side balance credit or trust a user-entered transaction hash. Implement a deposit ledger/order model with server-side address/network binding, transaction hash submission or chain indexer ingestion, confirmation count, review state, idempotency, and atomic credit only after the defined gate.
- Acceptance: address/network mismatch, unsupported network, under-minimum deposit, pending confirmations, manual review, rejected transaction, duplicate tx hash, reorg/reversal policy, and final credited state all tested; account balance reconciles to ledger.

### P1 — KYC collects identity text only; no document upload or document reference is persisted
- Evidence: `assets/js/views-account.js` form says no photo upload is required and sends only `name`, `id_type`, `id_number`; `api/core.js` validates those fields and stores status/name/type/number/timestamp only. No upload token/object reference is part of the inspected contract.
- Impact: the interface labels the section “Document Photo” but the backend receives no document image or file reference. This is not a functional document-verification flow.
- Batch action: product/compliance must decide whether text-only KYC is an explicitly accepted policy. If document evidence is required, implement private storage, signed upload, MIME/size validation, malware scanning, access controls, retention/deletion policy, upload-to-submission binding, and admin review. If not required, remove the misleading photo field and explain the text-only process.
- Acceptance: verify the file is privately stored, linked to the correct user/submission, inaccessible publicly, and all upload/submit/review states reconcile; test unsupported/oversized/corrupt files and retry.

### P2 — Asset transaction records and internal transfer are explicitly unavailable
- Evidence: `assets/js/views-assets.js` renders “Transaction record history is not available via the current API yet”; Transfer modal states internal transfer is not available.
- Impact: users cannot inspect a consolidated transaction ledger from the Assets page, and a visible Transfer action opens a non-functional explanation.
- Batch action: either implement transaction history and transfer through authoritative APIs with ledger references, or remove the action/label and keep unavailable capability clearly out of the primary workflow.
- Acceptance: deposit/withdraw/order/earn/transfer rows use backend-authoritative statuses and IDs; pagination and empty/error/loading states are distinct; no client-invented records.

## CI execution update
- PR #8 head commit `4d9dc1fee0c7ee448876d422584d94e17f343b93` triggered workflow run `41469468341`.
- GitHub Actions result: SUCCESS. Node setup, public build, smoke tests, and public-artifact exclusion assertions all completed successfully.
- This validates the candidate branch's configured build/smoke workflow only; it does not validate production browser behavior, PostgreSQL migrations, financial ledger correctness, KYC file handling, or deposit chain processing.
