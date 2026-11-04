# BTCBOX Phase 1 — Repository Audit & Engineering Baseline

Audit date: 2026-11-02  
Repository: `avali9308-code/btcboxcdt`  
Branch: `feature/uiux-upgrade`  
Source SHA at audit start: `df0ee0bff88748413b6fff1ecc2500c80018a697`  
Production / main changes: none

## 1. Repository identity and source structure

- Repository metadata confirms the public repository and branch `feature/uiux-upgrade`; the branch HEAD resolved to the full SHA above.
- Recursive Git tree: 113 entries, 86 tracked blobs, no truncation. 63 blobs are outside `dist/`; 23 are under `dist/`.
- The application is a hash-routed SPA, not a set of independent page HTML files. `index.html` is the consumer shell; `admin.html` is byte-identical to `index.html`; `oauth/consent.html` is a separate OAuth page. `pages/` currently contains only `.gitkeep`.
- The 21 implemented view functions are: login, register, markets, trade, kline, seconds, orders, assets, deposit, withdraw, earn, kyc, support, settings, admin, me, fiat, cards, transfer, invite, payment. A 404 fallback is registered in `app-core.js`.
- Frontend modules: 9 JS files under `assets/js/`; 9 CSS files under `assets/css/`. Trade CSS is injected by the trade view rather than linked in the initial shell.
- Backend boundary: `api/[...path].js` adapts requests to `api/core.js`; `api/healthz.js` is a separate health probe. Financial Python modules and Supabase SQL/migrations are present but were not modified or functionally tested in this frontend audit.

## 2. Existing design-system baseline

- Base page background: `--bg-page: #0B0E11`; card/surface colors: `#161A1E` and `#1E2329`.
- Brand greens: `--brand: #2BA36C`, `--brand-bright: #0ECB81`; semantic up/down colors are already defined.
- Typography tokens include Inter with CJK/system fallbacks and JetBrains Mono for numeric data. Existing font choices are recorded and must not be casually replaced.
- The stylesheet contains both the original token family and an additional `--crypto-*` token family. Phase 2 should consolidate usage carefully rather than layering another independent palette.
- Responsive CSS currently includes breakpoints at 768px, 480px and 340px. The 320px requirement is not proven by source inspection; it needs browser measurement.
- Reduced-motion CSS exists in `base.css`; mobile bottom navigation and safe-area padding exist in `layouts.css`.

## 3. Navigation, route and page findings

- Current mobile tabs are Markets, Trade, Assets, Earn, Account. The Account tab is rewritten at runtime to `#/me`.
- The previously approved product navigation is Home, Markets, Trade, Assets, My. The current registry has no `home` view or `#/home` route. This is a confirmed product-structure discrepancy to resolve in implementation; do not silently relabel Earn as Home.
- The app defaults unauthenticated users to `#/login`; the router redirects logged-out users from protected routes to login and logged-in users away from login/register to markets.
- The route inventory in `docs/PAGE_INVENTORY.md` is source-derived, not browser verification. Nested interactions (modals, drawers, tabs, order states and admin panels) remain unexercised.

## 4. Trade and seconds baseline

- Desktop trade source lays out pair list, chart, order book/recent trades and order form as a four-column workspace.
- Mobile hides the pair list and chart from the main grid, puts the order form before the order book, and exposes a K-line bottom drawer. The chart is moved into that drawer at mobile widths. The separate `#/kline` view is a fullscreen chart route.
- The trade view includes Open Orders, Order History, Trade History and Positions tabs.
- Seconds contract source currently offers 30s, 60s, 5m and 15m. Earlier product notes specified 30s, 60s, 120s and 300s. This mismatch must be reconciled against the approved product spec before changing durations or API payloads.
- None of these structures has been visually checked in a real browser during this phase.

## 5. Product and copy findings requiring attention

1. **Market taxonomy mismatch:** Markets heading says “18 spot pairs”; each rendered symbol row is labelled “Perpetual”.
2. **New-market filter mismatch:** the filter names NEAR, SUI, SEI and ORDI, but the registered `PAIRS` list includes only NEAR among those four. Do not invent symbols or market data.
3. **MATICUSDT:** source marks it `NOT_TRADEABLE`; preserve that state unless the product owner explicitly changes it.
4. **Localization:** the frontend JS scan found no `I18N`/translation-system references. Consumer copy in the inspected views is predominantly English; Chinese visible strings are concentrated in the admin console. Chinese comments in the missing/placeholder view module are not visible UI. Do not claim a global i18n implementation exists.
5. **Native browser dialogs:** targeted matches for `promptAdminAuth` and `confirmLogout` are custom modal flows, not native `window.prompt()` or `window.confirm()` calls. No native alert/confirm/prompt invocation was confirmed in the targeted frontend scan.

## 6. High-priority environment and safety finding

`assets/js/app-core.js` currently hard-codes `API_BASE = 'https://btcboxcdt.vercel.app/api'` rather than using a same-origin relative API base. A Preview build therefore still sends frontend API requests to that fixed canonical hostname unless runtime behavior overrides it elsewhere (none was found in the inspected frontend modules).

- This is a cross-environment isolation risk for Preview QA, especially for any mutating route.
- Before testing any write action from Preview, the owner must verify what the canonical hostname targets and how Preview API requests are isolated.
- This audit did not change API routing, environment variables, financial flags, authentication, database schema, or any backend behavior.

Separate known backend gate: repository docs warn not to enable real financial/matching operations until PostgreSQL migrations, reconciliation, fees/precision and end-to-end staging tests are complete. That remains outside this frontend phase.

## 7. Build and test baseline — exact SHA

Vercel Preview deployment:
- Deployment ID: `dpl_8f5QXaRsjfjVDuW819iRoTLr8SXT`
- URL: https://btcboxcdt-98b6sjv7v-box-2753.vercel.app
- Branch: `feature/uiux-upgrade`
- Full source SHA: `df0ee0bff88748413b6fff1ecc2500c80018a697`
- State: `READY`; target is `null` (Preview / non-production).

Build log evidence on that exact SHA:
- `node scripts/build-site.js` completed and created `dist/`.
- `node --test tests/*.test.js` completed: 7 tests, 7 pass, 0 fail, 0 skipped.
- Deployment completed successfully.
- GitHub commit status contains a successful Vercel status. GitHub Actions workflow-run lookup for this exact SHA returned zero runs; do not describe it as an exact-SHA GitHub Actions run.
- The only discovered GitHub Actions run in the prior audit was run 41389336083 on older SHA `057395916120f127c7d9aea6cc5e623ca7c2c87b`; it is not current-SHA evidence.
- The tests are source/build smoke tests, not full route interaction or financial integration tests.

Earlier HTTP checks on this Preview returned 200 for the SPA shell routes and `/api/healthz`; hash-fragment checks do not execute client-side routing. No browser DOM, screenshots, console/network interaction, touch target or viewport measurements were obtained.

## 8. Verification matrix

| Area | Result | Evidence / limit |
|---|---|---|
| Branch and exact source SHA | PASS | Git ref resolved to the full SHA above |
| Recursive repository inventory | PASS | 113 tree entries; 86 blobs; not truncated |
| View registry and shell navigation | PASS — source inspection only | 21 views and current tabs identified |
| Build on exact SHA | PASS | Vercel build log |
| Automated smoke tests on exact SHA | PASS | 7/7 in Vercel build |
| GitHub Actions run on exact SHA | NOT FOUND | Workflow-run lookup returned zero |
| Browser interaction QA | NOT RUN | No browser engine/BrowserAct session available |
| Mobile/tablet/desktop viewport QA | NOT RUN | No measurements or screenshots |
| API / Supabase integration | NOT RUN | No DB/Auth/write drill |
| Financial/matching safety | OUT OF SCOPE | No financial or database changes/tests |

## 9. Phase 1 disposition and resume point

Phase 1 source inventory and baseline evidence are assembled. This is **not** a visual acceptance, not a production-readiness certification, and not approval to enable real orders.

Next executor phase after independent review:
1. Establish the shared design-token/component plan while preserving the current font and business behavior.
2. Prepare the navigation and route mapping against the approved five-item mobile product navigation.
3. Resolve the Preview API base isolation before any mutating Preview QA.
4. Reconcile Spot/Perpetual labels, New-market symbols and seconds durations with product requirements.
5. Then implement the design system and shared components in a separate, reviewable source-change batch.

All changes in this phase are documentation-only. No frontend, API, auth, financial, database, `main`, or production deployment changes were made.
