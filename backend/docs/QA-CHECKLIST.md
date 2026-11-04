# BTCBOX QA Checklist

This checklist distinguishes source inspection from executed tests. An unchecked item is not complete.

## A. Repository and build

- [x] Target branch recorded: `feature/uiux-upgrade`.
- [x] Original baseline recorded: `4e7687441c33eef0f7361401558260db090ef780`.
- [x] Build/test commands identified from `package.json`.
- [x] One GitHub Actions run verified successful on `057395916120f127c7d9aea6cc5e623ca7c2c87b`.
- [ ] Build and test re-run against exact current HEAD.
- [ ] Verify latest Actions logs and retain run URL.
- [ ] Verify clean generated `dist/` diff before any build artifact commit.

## B. Route and navigation coverage

- [x] SPA view registry enumerated from source.
- [x] Top-level shell and mobile navigation markup inspected.
- [ ] Every route directly loaded and rendered in a browser.
- [ ] Every internal entry/exit link clicked and verified.
- [ ] Unknown route and missing-view fallback tested.
- [ ] Login-required and logged-out route behavior tested.
- [ ] Mobile nav active-state and safe-area behavior tested.

## C. Responsive and visual QA

- [ ] iPhone narrow viewport / iOS Safari.
- [ ] Android narrow viewport / Chrome.
- [ ] Tablet viewport.
- [ ] Desktop wide viewport.
- [ ] No horizontal overflow on every user route.
- [ ] Tables, forms, drawers, dialogs and toasts fit and remain operable.
- [ ] Keyboard focus, touch target size, contrast and reduced-motion behavior reviewed.
- [ ] Loading, empty, error, success and disabled states visually checked.

## D. Localization and copy

- [ ] All visible consumer copy classified and English/i18n requirements checked.
- [ ] Admin-only Chinese strings classified separately.
- [ ] Developer diagnostics and internal/system text excluded from user-facing translation scope.
- [ ] Backend error fallback reviewed without changing API semantics.
- [ ] Dynamic DOM updates checked for localization refresh.
- [ ] No legal, financial, KYC or security meaning lost during copy changes.

## E. Functional/API regression

- [ ] Login/register/logout and session expiry.
- [ ] Markets search, favorites, filters and live-data unavailable state.
- [ ] Trade order entry, cancel, order list and order detail.
- [ ] K-line drawer and chart loading/error state.
- [ ] Seconds order and settlement status display.
- [ ] Asset balances and history.
- [ ] Deposit address/network/memo rendering.
- [ ] Withdrawal validation, fee preview, confirmation and status.
- [ ] KYC submit/status, support messages and settings.
- [ ] Admin permission denial and authorized workflows.
- [ ] No request/response contract changes.
- [ ] No mock data substituted for real API data.

## F. Financial/backend release gate (not covered by frontend CI)

- [ ] PostgreSQL migrations applied in isolated staging.
- [ ] Matching continuous fills, partial fills, cancel, concurrency, duplicate requests and rollback.
- [ ] Buyer/seller ledger reconciliation.
- [ ] Trading pair precision, minimum quantity and fee rules verified.
- [ ] Deposit/withdrawal ledger and approval flows tested.
- [ ] Financial feature flag defaults and preflight semantics resolved by owner.
- [ ] Explicit staging acceptance before any financial cutover flag is enabled.
- [ ] Real orders remain disabled until backend release gate is signed off.

## G. Deployment

- [ ] Vercel preview build and clean-route rewrites verified.
- [ ] Refresh/deep-link 404 checks for all routes.
- [ ] Absolute asset path and cache behavior verified.
- [ ] Environment variables checked without exposing secret values.
- [ ] Production deploy only after explicit owner authorization.

## Evidence rule

For each checked item, record test date, commit SHA, environment, exact command or manual steps, and result. Do not check an item merely because source code appears to implement it.
