# BTCBOX Source Audit — Page & File Inventory (Preliminary)

Repository: `avali9308-code/btcboxcdt`
Branch: `feature/uiux-upgrade`
Original baseline: `4e7687441c33eef0f7361401558260db090ef780`
Latest source snapshot audited: `df0ee0bff88748413b6fff1ecc2500c80018a697` (2026-11-02)

This is a source-tree inventory and targeted source review, not a claim that every page or business flow has been functionally tested.

## Source tree summary
- Repository tree reports 86 tracked blobs total; 63 are outside `dist/`, and 23 are under `dist/`.
- Top-level HTML shells: `index.html`, `admin.html`; OAuth consent: `oauth/consent.html`.
- Route/view implementation is primarily a hash-routed SPA composed from `assets/js/*.js`.
- Shared CSS: `assets/css/tokens.css`, `base.css`, `components.css`, `overlays.css`, `layouts.css`, `views.css`, plus account/assets/trade view styles.
- Serverless API adapter: `api/[...path].js`; API implementation: `api/core.js`; health probe: `api/healthz.js`.
- Build and preflight: `scripts/build-site.js`, `scripts/deployment-preflight.js`.
- Existing automated test file: `tests/smoke.test.js`.
- Supabase SQL and financial-operation Python modules are present; this UI audit will not change their behavior.
- No `.github/workflows/*` files were present in the inspected baseline tree; `.github/workflows/baseline.yml` was added in this audit batch.

## Frontend view registry found by source scan
- `assets/js/views-home.js`: `login`, `register`, `markets`
- `assets/js/views-trade.js`: `trade`, `kline`
- `assets/js/views-trading.js`: `seconds`, `orders`
- `assets/js/views-assets.js`: `assets`, `deposit`, `withdraw`, `earn`
- `assets/js/views-account.js`: `kyc`, `support`, `settings`, `admin`
- `assets/js/views-missing.js`: `me`, `fiat`, `cards`, `transfer`, `invite`, `payment`
- `assets/js/app-core.js` and `assets/js/boot.js`: app state, API adapter, router, initialization and shared behavior.
- These are view functions discovered from source text, not independent physical HTML pages.

## Audited source files in this batch
- `package.json`, `README.md`, `vercel.json`, `DEPLOYMENT.md`
- `scripts/build-site.js`, `scripts/deployment-preflight.js`, `tests/smoke.test.js`
- `index.html`, `admin.html`
- `assets/css/tokens.css`, `base.css`, `components.css`
- `assets/js/app-core.js`, `boot.js`, `ui-components.js`, `views-home.js`, `views-trade.js`, `views-trading.js`, `views-assets.js`, `views-account.js`, `views-missing.js`
- `api/[...path].js`, `api/healthz.js`
- Recursive Git tree inventory, including `supabase/`, Python financial modules and tracked `dist/`.

## Targeted findings
1. **Native dialogs:** An initial broad text scan produced false positives because `promptAdminAuth` and `confirmLogout` are function names. Targeted contexts show custom modal-based admin authentication and logout confirmation, not native `window.prompt()` or `window.confirm()` calls. A broader AST/text scan of all source should still be completed before implementation changes.
2. **Chinese UI strings:** Chinese strings occur in `assets/js/views-account.js` and `assets/js/views-missing.js`; classify admin-only text separately from user-facing copy before changing.
3. **Markets label mismatch:** `assets/js/views-home.js` describes “18 spot pairs” and renders `Perpetual` under each symbol. Verify intended product taxonomy before correcting copy.
4. **“New” market tab:** `assets/js/app-core.js` initializes `market` placeholders from `PAIRS`, which does not include SUIUSDT, SEIUSDT or ORDIUSDT. `views-home.js` filters the literal list NEAR/SUI/SEI/ORDI by `market[s]`; based on current initialization, only NEARUSDT is expected to pass. Confirm intended product/data support before changing.
5. **Financial flag mismatch:** `DEPLOYMENT.md` describes financial write paths as enabled by default when Supabase is configured, with explicit `0` as the kill switch. `api/core.js` uses `!== '0'` checks, while `scripts/deployment-preflight.js` only considers a flag enabled for its acceptance check if its value is exactly `'1'`. Unset flags can therefore be runtime-enabled while passing the preflight flag check. Escalate for owner review; do not alter financial behavior in the UI phase.
6. **Build behavior:** `scripts/build-site.js` removes and recreates `dist/`; review generated diffs carefully before committing build output.
7. **Test scope:** Existing smoke tests are primarily source-structure/build checks; they do not constitute browser/device QA, live API contract tests, or financial staging tests.

## Validation status
- GitHub Actions run 41389336083 completed successfully on `057395916120f127c7d9aea6cc5e623ca7c2c87b`: https://github.com/avali9308-code/btcboxcdt/actions/runs/41389336083
- Build, smoke tests, and public build exclusion checks passed in that workflow.
- No local shell command execution is claimed.
- `npm run preflight` not run; it requires deployment environment variables and does not prove database schema/data initialization.
- Responsive viewport/browser QA and real backend staging checks have not been run.
- `docs/AI-CORE.md` is absent. `docs/UIUX-EXECUTION-PLAN.md` is present on the current branch; the earlier 404 note is stale.


## Route, entry-point and navigation map (source-derived)

The application is a hash-routed SPA. These are route patterns found in view declarations and explicit hrefs; the inventory is not browser verification. Shared shell is in `index.html` (the inspected `admin.html` contains the same SPA shell/navigation structure).

| Tier | Route | View | Primary source | Known entry / relationship | Mobile nav |
|---|---|---|---|---|---|
| L1 | `#/login` | login | `views-home.js` | Initial route when hash is empty; logout returns here | None |
| L1 | `#/register` | register | `views-home.js` | Login sign-up link | None |
| L1 | `#/markets` | markets | `views-home.js` | Auth callback fallback; mobile tab; default post-auth destination | Markets |
| L1 | `#/trade/:symbol` | trade | `views-trade.js` | Market row click; mobile tab defaults BTCUSDT; pair selector | Trade |
| L2 | `#/kline` (view reads current pair) | kline | `views-trade.js` | Trade chart/K-line entry and back-to-trade link | Trade context |
| L1 | `#/seconds` | seconds | `views-trading.js` | Route/view exists; exact global navigation entry not confirmed in inspected shell | None |
| L1 | `#/orders` | orders | `views-trading.js` | Route/view exists; exact global navigation entry not confirmed | None |
| L1 | `#/assets` | assets | `views-assets.js` | Mobile tab; deposit/withdraw links | Assets |
| L2 | `#/deposit` | deposit | `views-assets.js` | Assets page Deposit action | Assets context |
| L2 | `#/withdraw` | withdraw | `views-assets.js` | Assets page Withdraw action | Assets context |
| L2 | `#/earn` | earn | `views-assets.js` | Mobile tab; Assets view may link to Earn | Earn (dedicated current tab) |
| L1 | `#/me` | me | `views-missing.js` | Account/profile entry; account view adjusts mobile Account tab to `#/me` | Account tab currently |
| L2 | `#/kyc` | kyc | `views-account.js` | My Account menu and shell profile menu | Account context |
| L2 | `#/support` | support | `views-account.js` | My Account menu | Account context |
| L2 | `#/settings` | settings | `views-account.js` | Shell profile menu; My Account menu; mobile Account tab href currently defaults to Settings | Account context |
| L2 | `#/fiat` | fiat | `views-missing.js` | My Account menu; placeholder/coming-soon | Account context |
| L2 | `#/cards` | cards | `views-missing.js` | My Account menu; empty shell/disabled add flow | Account context |
| L2 | `#/payment` | payment | `views-missing.js` | My Account menu; placeholder | Account context |
| L2 | `#/transfer` | transfer | `views-missing.js` | My Account menu; transfer UI is marked no transfer interface | Account context |
| L2 | `#/invite` | invite | `views-missing.js` | My Account menu; placeholder | Account context |
| L1/admin | `#/admin` | admin | `views-account.js` | Shell profile menu Admin Console; admin auth/role gating in source | Not in bottom nav |

### L3 panels and nested states (not separate URL routes)

- Trade: pair selection, buy/sell side, market/limit order mode, order book/recent trades tabs, order detail modal, K-line drawer.
- Seconds: coin selection, duration/amount controls, UP/DOWN confirmation and countdown, open/history position tabs.
- Assets/deposit: coin/network selector drawer, address/QR/memo state, copy actions.
- Assets/withdraw: coin/network selection, amount/fee/receive preview, review/confirmation/fund-password/2FA/result states.
- Account/settings: password change, fund-password change, 2FA enrollment/confirmation dialogs.
- Support: chat composer and message history.
- Admin: users/deposits/withdrawals/KYC panels and their detail/approval interactions (subviews within `#/admin`, not separate routes).
- These are source-observed interaction areas; they have not all been manually exercised.

### Current mobile navigation discrepancy

The shell in `index.html` and `admin.html` renders five bottom tabs in this order: Markets, Trade, Assets, Earn, Account. Account initially links to `#/settings`; `views-account.js` changes that link to `#/me` at runtime. This differs from the previously recorded owner product requirement (Home, Markets, Trade, Assets, My). The current repository behavior is recorded as-is; changing the nav requires explicit approval and route/product alignment. The actual home view is not in the discovered view registry; `index.html` is the shell, not evidence of a `#/home` page.

### Coverage status

- Source-level view registry and explicit shell navigation: inspected.
- Route-to-view mapping above: source-derived; some entry points are not confirmed.
- Direct URL load, redirect, active tab state, all link targets and third-level interactions: not browser-tested.
- No claim that every route has passed functional or responsive QA.


## Navigation and product-entry update — executor implementation batch

- Approved mobile primary navigation is now implemented in source as Home / Markets / Trade / Assets / My, mapped to `#/home`, `#/markets`, `#/trade-hub`, `#/assets`, and `#/me`.
- Added a Home dashboard view using only the existing market state populated by the real market API; it does not display seeded balances or simulated prices.
- Added a trade-service selection view: Spot and Seconds route to existing interfaces; Futures is explicitly marked Coming soon because no supported futures view/backend contract is registered; Earn links to the existing earn view.
- Markets taxonomy now reflects the backend market handler, which explicitly queries Coinbase and Bybit `category=spot` sources. Rows display Spot, not Perpetual.
- Replaced the unsupported hard-coded New symbols with a Top Volume view sorted from existing live market values. No SUI/SEI/ORDI pairs were added.
