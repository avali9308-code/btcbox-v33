# BTCBOX Frontend Architecture — Code Map

> Read-only source audit. Branch `docs/dola-prep`. All claims cite `file:line`. Anything not verified in source is marked **未核实**. Dist build artifacts (`dist/`) ignored. Existing docs (`docs/PAGE_INVENTORY.md`, `docs/AI-HANDOFF.md`, `docs/DS-001-TOKEN-MAP.md`, `docs/UIUX-EXECUTION-PLAN.md`, `docs/QA-CHECKLIST.md`) are referenced, not duplicated.

## 0. Source statistics (verified)

| Category | Count | Files |
|---|---:|---|
| HTML entry shells | 3 | `index.html`, `admin.html` (byte-identical), `oauth/consent.html` |
| Source CSS files | 9 | `tokens, base, components, overlays, layouts, views, views-trade, views-assets, views-account`.css |
| Source JS files | 9 | `boot, app-core, ui-components, views-home, views-trade, views-trading, views-assets, views-account, views-missing`.js |
| SPA VIEWS registry entries | 24 | 23 real routes + `404` fallback (§2) |
| Build/test scripts | 3 | `scripts/build-site.js`, `scripts/deployment-preflight.js`, `tests/smoke.test.js` |

`pages/` contains only `.gitkeep` — all pages are client-side views rendered into `#main-content` (`index.html:75`). There are no physical per-route HTML pages.

---

## 1. HTML page inventory & SPA view routing

### 1.1 HTML shells

| File | Lines | Role | Key evidence |
|---|---:|---|---|
| `index.html` | 101 | Main SPA shell. Contains splash, desktop sidebar, topbar, `#main-content`, mobile bottom nav, toast/modal roots, all asset tags. | viewport `index.html:5`; CSS links `:15-20`; JS scripts `:91-99`; sidebar `:31-43`; topbar `:47-73`; `#main-content` `:75`; mobile nav `:80-86`; `#toast-root`/`#modal-root` `:88-89` |
| `admin.html` | 101 | **Byte-identical to `index.html`** (verified by `diff`). Admin is **not** a separate app — it is the same SPA reached via the `#/admin` route. The separate URL exists as an entry point; admin authorization is enforced by HTTP Basic Auth on `/api/admin/*` in `api/core.js`, not by the HTML file. | `diff index.html admin.html` → identical; build comment `scripts/build-site.js:9` |
| `oauth/consent.html` | 227 | Standalone OAuth consent screen. Loads only `tokens.css` (`oauth/consent.html:15`) + inline `<style>` + `@supabase/supabase-js` (`:14`). Does **not** load the SPA JS bundle. Four stages: loading / error / signin / consent. Links to `/#/login` (`:118`), `/#/settings` (`:140`), `/` (`:117,:124`). | stages `:100-141`; inline script `:143-226` |

### 1.2 Hash-router mechanism (from `app-core.js`)

- **`parseHash()`** `app-core.js:474-478`: strips leading `#/` from `location.hash`, splits on `/`, `route = parts[0]` (default `'markets'`), `params = parts.slice(1)`. Example: `#/trade/BTCUSDT` → `route='trade'`, `params=['BTCUSDT']`.
- **`router()`** `app-core.js:479-505`:
  1. Cleans up seconds timers, ECharts instances, resize listeners (`:480-485`).
  2. **Auth guard** `:490-491`: not logged in → redirect `#/login` (except `login`/`register`); logged in visiting `login`/`register` → redirect `#/markets`.
  3. **Nav hiding** `:473,492-497`: `HIDE_NAV = {login:true, register:true, kline:true}` hides sidebar, topbar and mobile bottom nav (full-screen views).
  4. `renderSidebar(route)` `:497` (desktop only).
  5. Skeleton placeholder + `await delay(180)` `:499-500`.
  6. **View resolution** `:501`: `const view = VIEWS[route] || VIEWS['404']`. No alias normalization — route key must match exactly.
  7. `view.afterRender(params)` if present `:503`; `window.scrollTo(0,0)` `:504`.
- **Trigger**: `window.addEventListener('hashchange', router)` `app-core.js:506`; initial call from `boot()` `boot.js:39` (or `#/login` if hash empty, `boot.js:38`).
- **VIEWS stubs** `app-core.js:509-526` define 15 placeholder views + `404`; each `views-*.js` overwrites the relevant keys and adds new ones. `VIEWS['404']` is finally overridden by `views-account.js:312` (Chinese copy).
- **Sidebar NAV** `app-core.js:448-462` (13 items); `views-missing.js:12-14` pushes a 14th `{route:'me', label:'Account'}` (idempotent guard).
- **Mobile active-tab mapping** `app-core.js:468`: maps nested routes (`trade`, `trade-hub`, `seconds`, `orders`, `kline`, `earn` → `tradehub`; `deposit`,`withdraw`→`assets`; `kyc`,`settings`,`support`→`me`) to the five `data-route` tab keys.

---

## 2. View (page) hierarchy — L1 / L2 / L3

L1 = primary destination (mobile tab or standalone). L2 = sub-route reached from an L1. L3 = in-view panel/modal/drawer state (no separate URL).

```
L1  #/home            (views-home.js:213)  — Home dashboard
L1  #/markets         (views-home.js:169)  — Markets list (All/Favorites/Top Volume tabs)
L1  #/trade-hub       (views-home.js:237 as VIEWS.tradehub — see RISK R1) — Trade service picker
├─L2 #/trade/:symbol  (views-trade.js:71)  — Spot trading workspace
│  └─L3 pair list, buy/sell side, market/limit mode, orderbook/recent-trades tabs,
│       order modal, mobile K-line drawer (views-trade.css)
├─L2 #/kline[/:symbol](views-trade.js:302) — Full-screen K-line (HIDE_NAV, app-core.js:473)
├─L2 #/seconds        (views-trading.js:10)— Seconds contracts
│  └─L3 coin/duration/amount, UP/DOWN, countdown, open/history position tabs
├─L2 #/orders         (views-trading.js:74)— Order history (desktop sidebar only, §6)
│  └─L3 order detail drawer, cancel confirm
└─L2 Futures → "Coming soon" card (views-home.js:241, no route)
L1  #/assets          (views-assets.js:21) — Assets overview
├─L2 #/deposit        (views-assets.js:113)— Deposit (coin/network drawer, address/QR/memo)
├─L2 #/withdraw       (views-assets.js:196)— Withdraw 4-step stepper (amount→review→fund-pwd/2FA→result)
└─L2 #/earn           (views-assets.js:413)— Earn products (flex/fixed)
L1  #/me              (views-missing.js:45)— My Account hub (profile, badges, 10 entry rows)
├─L2 #/kyc            (views-account.js:69)— Identity verification (3 tiers)
├─L2 #/settings       (views-account.js:172)— Security: password / fund password / 2FA
├─L2 #/support        (views-account.js:129)— Support chat
├─L2 #/fiat           (views-missing.js:139)— Coming-soon placeholder
├─L2 #/cards          (views-missing.js:146)— Bank cards (empty shell, add disabled)
├─L2 #/payment        (views-missing.js:244)— Coming-soon placeholder
├─L2 #/transfer       (views-missing.js:176)— Transfer form (disabled submit)
├─L2 #/invite         (views-missing.js:237)— Coming-soon placeholder
└─L2 Logout → confirm modal (views-account.js:18) → #/login
L1  #/login           (views-home.js:60)   — HIDE_NAV; Google sign-in button (boot.js:27-44)
L1  #/register        (views-home.js:107)  — HIDE_NAV
L1  #/admin           (views-account.js:229)— Admin console (HTTP Basic Auth, app-core.js:180 promptAdminAuth)
    └─L3 users / deposits / withdrawals / KYC / config tabs (views-account.js:308 data-atab)
Fallback 404          (views-account.js:312)— Chinese "页面不存在" → #/markets / #/me
```

**VIEWS key count**: 23 real routes + `404` = 24. Files: views-home (5: login, register, markets, home, tradehub), views-trade (2: trade, kline), views-trading (2: seconds, orders), views-assets (4: assets, deposit, withdraw, earn), views-account (5: kyc, support, settings, admin, 404), views-missing (6: me, fiat, cards, transfer, invite, payment).

---

## 3. Per-view CSS & JS references (exact files, load order)

### 3.1 Static CSS load order (`index.html:15-20`, enforced by smoke test `smoke.test.js:30-35`)

| Order | File | Scope |
|---:|---|---|
| 1 | `assets/css/tokens.css` | `:root` design tokens + utility classes (`.bg-crypto-*`, `.font-mono`, `.tabular`, etc.) — sole token source (`DS-001-TOKEN-MAP.md`) |
| 2 | `assets/css/base.css` | Reset, form controls, `.num`, `.scroll` scrollbar, `prefers-reduced-motion` |
| 3 | `assets/css/components.css` | `.btn*`, `.card`, `.tag`, `.nav-item`, `.tab`, `.th/.td/.trow`, `.skel`, `.badge`, `.page-title`, auth system (`.auth-*`) |
| 4 | `assets/css/overlays.css` | `#toast-root`, `.toast`, `.modal-mask/.modal-box`, `#splash`, `.drawer-*`, `body.modal-open` |
| 5 | `assets/css/layouts.css` | `#main-wrap` margin, `.sidebar-desk`/`.topbar-desk`/`.mobile-nav`, 768px breakpoint, touch targets |
| 6 | `assets/css/views.css` | Shared view: `.ob-row`, `.view-enter`, `.bot-msg/.user-msg`, `.home-*`, `.trade-hub-*` |

### 3.2 Dynamically injected view CSS (after `views.css`, guarded against double-inject)

| CSS file | Injected by | Guard mechanism | Views covered |
|---|---|---|---|
| `views-trade.css` | `views-trade.js:4` **and** `views-trading.js:4` | `id="views-trade-css"` element check (both use same id → second is no-op) | trade, kline, seconds, orders |
| `views-assets.css` | `views-assets.js:14-15` | `id="views-assets-css"` element check | assets, deposit, withdraw, earn |
| `views-account.css` | `views-account.js:5-8` **and** `views-missing.js:6-8` | `querySelector('link[href=...]')` check (both same href → second no-op) | kyc, support, settings, admin, 404, me, fiat, cards, transfer, invite, payment |

Injection order follows script load order: `views-trade.css` → `views-assets.css` → `views-account.css` (last wins on equal-specificity conflicts — see §7).

### 3.3 JS load order (`index.html:91-99`, enforced by smoke test `smoke.test.js:27-29`)

`app-core.js` → `ui-components.js` → `views-home.js` → `views-trade.js` → `views-trading.js` → `views-assets.js` → `views-account.js` → `views-missing.js` → `boot.js` (last, invokes `boot()` at `boot.js:85`).

External scripts (head, blocking): `echarts@5.5.0`, `qrcode-generator@1.4.4`, `@supabase/supabase-js@2` (`index.html:12-14`). Google Fonts (Inter + JetBrains Mono) `:11`.

`oauth/consent.html` loads **none** of the SPA JS — only supabase-js and its own inline IIFE (`oauth/consent.html:143-226`).

---

## 4. Shared components & shared styles

### 4.1 `ui-components.js` (133 lines) — `window.BTCBox` API
- `BTCBox.modal({title, content, buttons, width, closable, onClose, onMount})` `ui-components.js:27` — `role="dialog" aria-modal="true"`, focus trap (`:67-75`), focus restoration on close (`:52`), Esc close, body scroll lock, button loading states (`api.setLoading`). Width presets sm/md/lg/risk map to `--modal-w-*` tokens (`overlays.css:31-34`).
- `BTCBox.drawer({side:'bottom'|'right', ...})` `ui-components.js:90` — creates `#drawer-root` dynamically (`:88`), mask + panel, Esc close.
- `BTCBox.toast(msg, type)` `ui-components.js:121` — delegates to global `toast()` (app-core.js:62), which renders via `textContent` (safe, `app-core.js:70`; enforced by smoke test `smoke.test.js:162-164`).
- **Legacy shim** `ui-components.js:124-131`: reassigns global `modal(title, bodyHTML, onMount)` to a 480px BTCBox.modal wrapper so old call sites keep working.

### 4.2 `components.css` coverage (124 lines)
Buttons (`.btn-primary/.btn-green/.btn-red/.btn-danger/.btn-ghost/.btn-block/.btn-sm/.btn-google/.is-loading/.spinner`), cards (`.card`, `.raised`), `.tag`, `.nav-item` (active state), table cells (`.th/.td/.trow`), `.tab`, `.skel` skeleton + `@keyframes skel`, `.or-div`, auth system (`.auth-stage/.auth-brand/.auth-panel/.auth-card/.auth-input/.auth-field/.auth-title/.auth-sub/.auth-link/.auth-legal/.auth-terms/.pwd-toggle`), `.input-error`, `.field-error/.field-hint`, `.page-title/.page-sub/.section-title`, `.badge*`, focus-visible ring.

### 4.3 `layouts.css` layout system (28 lines)
- Desktop: `#main-wrap{margin-left:224px}` (`:2`), fixed sidebar 224px (`index.html:31`), sticky topbar 56px (`index.html:47`).
- `body.hide-nav` (login/register/kline) zeroes margin and hides mobile nav (`:3,12`).
- `@media (max-width:768px)` (`:9-18,23-27`): sidebar/topbar `display:none`, `#app{display:block}`, `#main-content` bottom padding `calc(76px + env(safe-area-inset-bottom))`, inputs `font-size:16px !important` (prevents iOS zoom), `.btn`/`.mob-tab` `min-height:44px` (touch targets).
- `.mobile-nav` fixed bottom 64px + safe-area, z-index 90 (`:28-30`); `.mob-tab` flex column, `.active` → brand color (`:31-32`).

---

## 5. Navigation relationships between views

### 5.1 Entry points
- **Mobile bottom nav** (`index.html:80-86`, 5 tabs): Home `#/home`, Markets `#/markets`, Trade `#/trade-hub`, Assets `#/assets`, My `#/me`. Active state set by `renderSidebar` `app-core.js:468-469`.
- **Desktop sidebar** (`app-core.js:448-462` + `views-missing.js:12` push): Markets, Trade(Spot)→`#/trade/:currentPair`, K-Line Full→`#/kline/:currentPair`, Seconds, Orders, Assets, Deposit, Withdraw, Earn, Identity(KYC), Support, Settings, Admin Console, Account(#/me).
- **Topbar** (`index.html:47-73`): global search → `#/trade/:sym` (`app-core.js:537-538`); Assets button `#/assets` (`:58`); avatar menu → Settings `#/settings`, KYC `#/kyc`, Admin `#/admin`, Logout button (`:66-70`); notif button → toast only (`app-core.js:543`).
- **Auth**: logout → `#/login` (`app-core.js:544`, `views-account.js:18-30` confirm modal); post-auth default `#/markets` (`boot.js:38`); OAuth/Google callback → `sessionStorage.oauth_return_to` or `#/markets` (`boot.js:31-36`).

### 5.2 Return / back paths
- `views-missing.js:18-26` `vmHeader()` renders a back arrow defaulting to `#/me` (used by me/fiat/cards/transfer/invite/payment sub-views).
- K-line full view has back-to-trade button (`views-trade.css` `.kline-back`; trade view mobile K-line drawer close `#kline-drawer-close`).
- 404 view → `#/markets` / `#/me` (`views-account.js:319-320`).
- Trade-hub cards → `#/trade/BTCUSDT` (Spot), `#/seconds`, `#/earn`; Futures is a non-link `div` (`views-home.js:240-243`).
- Home quick-access → `#/trade-hub`, `#/assets`, `#/deposit`, `#/me` (`views-home.js:232`).
- OAuth consent → `/#/login` (signin stage), `/#/settings` (footer), `/` (return links) (`oauth/consent.html:117,118,124,140`).

### 5.3 Orphan / limited-reach views
- `#/orders` — only in desktop sidebar (`app-core.js:453`); **no mobile nav entry** (mobile users reach orders only via the trade view bottom orders tab, not a dedicated route).
- `#/kline` — desktop sidebar + trade view; hidden nav (fullscreen).

---

## 6. Mobile adaptation rules

- **Viewport meta**: `width=device-width, initial-scale=1, viewport-fit=cover` on all three HTML pages (`index.html:5`, `admin.html:5`, `oauth/consent.html:5`).
- **Primary breakpoint 768px** (used in `layouts.css:9,23`, `overlays.css:62`, `views-trade.css` (mobile trade workspace + kline drawer), `views-assets.css:154`, `views-account.css:187`). Below 768: desktop sidebar/topbar hidden; mobile bottom nav shown; single-column layouts; inputs forced 16px (iOS zoom prevention, `layouts.css:24`); `.btn`/`.mob-tab` min-height 44px (`layouts.css:25-26`).
- **Secondary breakpoints**: 900px (`views.css:56` home grids → 2 col), 600px (`views.css:57` home/trade-hub single col), 360px (`views.css:58` very narrow hero), 480px (`components.css:108` auth card mobile; `views-assets.css:162` quick-action grid), 340px (`views-trade.css:165` orderbook font shrink), 1024px (`components.css:106` auth desktop split), 420px (oauth inline `.btn-row` horizontal).
- **Safe area**: `env(safe-area-inset-bottom)` in `layouts.css:16` (main-content), `:28` (mobile-nav), `overlays.css:48` (bottom drawer), `views-trade.css` kline-entry `bottom:calc(64px + env(safe-area-inset-bottom))`.
- **Dynamic viewport units**: `88dvh` / `100dvh` in `views-trade.css` (kline drawer + fullscreen chart) — mobile browser chrome aware.
- **Reduced motion**: `@media (prefers-reduced-motion:reduce)` `base.css:17-19` neutralizes animations/transitions.
- **Touch**: `active:scale-press` utility (`tokens.css`), `.btn:active{transform:translateY(1px)}` (`components.css:9`), `.sec-dir-btn:active{transform:scale(.98)}` (`views-trade.css`).
- **Scroll**: `.no-scrollbar` (`views.css:5-6`) for horizontal tab strips; `.scroll` styled scrollbar (`base.css:13-15`).

---

## 7. Duplicate CSS & selector conflict risk (cross-file)

| # | Selector | Defined in | Conflict | Severity |
|---|---|---|---|---|
| C1 | `.va-page` | `views-assets.css:4` (`padding:4px 2px 40px`) vs `views-account.css:6` (`max-width:880px;margin:0 auto;padding:4px 0 40px`) | Equal specificity; **views-account.css injects later → wins**. Assets pages get `max-width:880px` (narrower than assets' intended full width) unless overridden by a more specific selector. Smoke test `smoke.test.js:155` specifically asserts `.va-hero .va-stat-grid` must outrank account styles — known fragile boundary. | **High** |
| C2 | `.va-stat-grid` | `views-assets.css:9` vs `views-account.css:55` (adds `margin-bottom:20px`) | Account wins; assets stat grid picks up extra bottom margin. | Medium |
| C3 | `.va-stat` | `views-assets.css:10` vs `views-account.css:56` (`padding:14px 16px`) | Account wins; assets stat cards get account padding. | Medium |
| C4 | `.va-field` | `views-assets.css:55` (`margin-bottom:16px`) vs `views-account.css` (~L140, `margin-bottom:14px`) | Account wins; minor spacing drift on assets forms. | Low |
| C5 | `.ob-row` | `views.css:4` (`position:relative`) vs `views-trade.css` (~L50, full flex layout) | views-trade.css loads later and extends; both set `position:relative` — no functional conflict. | None |
| C6 | `.skel` | `components.css:44` vs `oauth/consent.html` inline | Different pages (SPA vs OAuth) — no cascade overlap. | None |
| C7 | `.card`, `.btn-primary`, `.btn-ghost`, `.btn-danger` | `components.css` vs `oauth/consent.html` inline | Different pages — no overlap. | None |
| C8 | Inline `display:flex` on `#sidebar` (`index.html:31`) and `#topbar` (`index.html:47`) vs `layouts.css:10-11` media `display:none` (≤768px) | Inline style would override media query, but `router()` sets `style.display=''` (`app-core.js:493-494`) removing inline for normal routes → CSS applies. Pre-boot flash covered by splash (`#splash` z-index 300, `overlays.css:22`). | Low (latent) |
| C9 | `#toast-root` | `overlays.css:2` (top-right desktop) vs `layouts.css:25` mobile media (full-width top) | Media query, intended. | None |
| C10 | z-index layers | inline: sidebar 40, topbar 30; CSS: mobile-nav 90, kline-entry 80, kline-drawer 95, modal 150, drawer 160, toast 200, splash 300. Tokens `--layer-*` (`tokens.css`) match overlays.css hardcoded values. | Consistent. `#search-results` z-index 60 (`index.html:51`) sits above topbar 30 — intended. | None |

**Token-level**: `DS-001-TOKEN-MAP.md` records 82 canonical root tokens + compatibility aliases; smoke test `smoke.test.js` (token alias test + var() resolution test across all 9 CSS + 3 HTML) enforces no undefined `var()` and no duplicate `:root` declarations. Passing.

---

## 8. Dead links / resource refs / JS error risk

### 8.1 Resource references (verified present on disk)
- All `/assets/css/*.css` (6 static + 3 injected) and `/assets/js/*.js` (9) referenced exist. `pages/` is empty but `build-site.js:33-37` iterates it harmlessly.
- External CDN deps (echarts, qrcode-generator, supabase-js, Google Fonts) — reachability **未核实** (no network test in this audit; static only).
- `API_BASE = 'https://btcboxcdt.vercel.app/api'` hardcoded (`app-core.js:23`) — preview deployments call production backend. Recorded in `AI-HANDOFF.md` (Preview API isolation).

### 8.2 Route resolution risk — **HIGH (R1)**
- `#/trade-hub` is linked from mobile nav Trade tab (`index.html:83`), Home "Explore trading" (`views-home.js:220`), and Home quick-access Trade (`views-home.js:232`).
- `parseHash()` yields `route='trade-hub'`. VIEWS key registered is `VIEWS.tradehub` (`views-home.js:237`) — **no `VIEWS['trade-hub']` alias exists anywhere** (grep-verified).
- `router()` `app-core.js:501` does exact-key lookup → `VIEWS['trade-hub']` undefined → falls to `VIEWS['404']` (`views-account.js:312`, Chinese "404 — 页面不存在").
- `app-core.js:468` `mobileActive` map includes `'trade-hub':'tradehub'` but that only controls **tab highlight**, not view resolution.
- Smoke test `smoke.test.js:119-125` asserts the href exists and `VIEWS.tradehub` exists, but **does not assert resolution** — this bug is not caught by CI. Browser/QA was blocked (`AI-HANDOFF.md` BROWSER-01), so runtime confirmation is **未核实**. Static analysis indicates the Trade tab and all `#/trade-hub` links render 404.

### 8.3 Redundant / dead code
- `views-account.js:9-12` dynamically injects `views-missing.js`, but `index.html:98` already loads it synchronously. The guard `querySelector('script[src=...]')` returns null at `views-account.js` execution time (line 98 not yet parsed) → **views-missing.js is fetched and executed twice**. Idempotent (CSS/NAV/VIEWS all guarded), but redundant network fetch + parse.
- `views-account.js:14` repoints `.mob-tab[data-route=account]` → `#/me`, but current mobile nav uses `data-route="me"` (`index.html:85`) — selector matches nothing; dead code (leftover from earlier nav structure).
- `#/orders` reachable only via desktop sidebar (`app-core.js:453`); no mobile entry (not a dead link, but a mobile reachability gap).

### 8.4 Undefined-function check (verified defined)
All cross-file globals called by views are defined: `toast/modal/skeleton/emptyState/$/$$/fmt/fmtPrice/pct/uid/delay` (app-core.js), `BTCBox.*` (ui-components.js), `apiAdapter` (app-core.js:250), `Auth.{init,login,register,friendlyError,showResetPassword,showForgotPassword,showRegisterSuccess,supabaseLogin}` (app-core.js:550+), `startTicker/refreshMarket/refreshDepth` (app-core.js:439,238,243), `renderOrderbook/renderRecentTrades` (views-trade.js:41,65), `renderQR` (views-assets.js:99), `confirmLogout` (views-account.js:18), `promptAdminAuth` (app-core.js:180), `applyGoogleButtons/probeAuthHealth` (boot.js:27,62), `NAV` (app-core.js:448). No undefined call sites found in static scan.

---

## 9. Build & test commands

### 9.1 `package.json` (14 lines)
- `engines.node = "22.x"`.
- `npm test` → `node --test tests/*.test.js`
- `npm run build` → `node scripts/build-site.js`
- `npm run preflight` → `node scripts/deployment-preflight.js`

### 9.2 `scripts/build-site.js` (40 lines)
- Deletes and recreates `dist/` (`:16-17`).
- Allowlist copies: `index.html`, `admin.html` (required, throws if missing) + dirs `pages/`, `assets/`, `oauth/` (`:18-31`).
- Copies any `pages/*.html` to `dist/` root for clean URLs (`:33-37`) — currently none (pages/ empty).
- Source code, SQL, tests, `.env.example`, docs are **excluded** from public build.

### 9.3 `tests/smoke.test.js` (226 lines) — 12 tests, no network, no secrets
1. Build produces dist/index.html, dist/admin.html, dist assets.
2. Thin shell: mount points present, no Tailwind CDN, JS load order, CSS load order.
3. Asset bundle: router + VIEWS registry + every view batch's key views present.
4. `admin.html` byte-identical to `index.html`.
5. No plaintext secrets (JWT / GitHub-token / Vercel-token prefix patterns) in public files.
6. Withdrawal/earn frontend constants match backend financial contract (`DW_COINS`, `NETWORKS`, `WITHDRAW_FEES`, earn product ids, fee validation).
7. Route/navigation guards: layouts CSS specifics, asset stat grid outranks account stylesheet, registration terms block.
8. Overlays: dialog semantics (role/aria-modal), drawer closability, focus trap + restoration, toast text-safe rendering.
9. Mobile nav: five routes `home/markets/tradehub/assets/me`, hrefs include `#/trade-hub`, spot-only taxonomy (no Perpetual/SUI/SEI/ORDI), `VIEWS.home`+`VIEWS.tradehub` exist.
10. Token aliases resolve to exact 82-token baseline fixture (`tests/fixtures/ds001-token-baseline.json`); no duplicate `:root` declarations; no cycles.
11. All `var()` references across all 9 CSS + 3 HTML resolve to a defined custom property.
12. OAuth preserves pre-DS-001 error colors, card geometry, shared token source, no duplicate `:root`, fonts retained.

### 9.4 `scripts/deployment-preflight.js` (32 lines)
- Validates env var **shape only** (never prints values): `SUPABASE_URL` HTTPS, server-side key exists, auth URL + publishable key, `ADMIN_USER` + `ADMIN_PASS` ≥16 chars, financial cutover flags (`FINANCIAL_POSTGRES_*`) must **not** be exactly `'1'`.
- Known mismatch (escalated, `AI-HANDOFF.md` finding 5): `api/core.js` treats flags as enabled unless `=== '0'`, while preflight only flags `=== '1'` as enabled — unset/non-'0' values can be runtime-enabled while passing preflight. **Not modified in this audit.**

---

## 10. High-risk findings summary (for owner review)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| **R1** | **Critical (static analysis, runtime 未核实)** | `#/trade-hub` resolves to 404 — VIEWS key is `tradehub` (no hyphen), no alias. Mobile Trade tab + Home links all hit 404. | `index.html:83`, `views-home.js:220,232,237`, `app-core.js:474-478,501`; smoke test gap `smoke.test.js:119-125` |
| C1 | High | `.va-page`/`.va-stat-grid`/`.va-stat`/`.va-field` duplicated across `views-assets.css` and `views-account.css`; account (later inject) wins, may narrow asset pages. | `views-assets.css:4,9,10,55` vs `views-account.css:6,55,56`; `smoke.test.js:155` |
| D1 | Medium | `views-missing.js` double-loaded (dynamic inject by views-account.js + static script tag). Idempotent but redundant. | `views-account.js:9-12`, `index.html:98` |
| D2 | Low | `views-account.js:14` dead repoint code (selector `data-route=account` no longer exists). | `views-account.js:14`, `index.html:85` |
| N1 | Low | `#/orders` no mobile entry (desktop sidebar only). | `app-core.js:453` |
| F1 | Escalated (existing) | Financial flag semantics mismatch preflight vs runtime. | `AI-HANDOFF.md` finding 5; `scripts/deployment-preflight.js:20-22` |
| A1 | Info | `API_BASE` hardcoded to production host; preview writes hit production backend. | `app-core.js:23`; `AI-HANDOFF.md` |

---

## 11. Verification performed & limits

- **Performed**: full read of all 9 CSS, 9 JS, 3 HTML, 3 scripts, `package.json`, `tests/fixtures/`; `diff` index/admin; grep cross-checks for VIEWS keys, href routes, function definitions, CSS selectors, media queries, secret patterns.
- **Not performed (marked 未核实 where relevant)**: browser runtime rendering, route click-through, console-error capture, network reachability of CDNs/API, responsive viewport measurement. These remain blocked per `AI-HANDOFF.md` (BROWSER-01/MOBILE-01 NOT RUN).
- **Secret self-check**: see final reply grep result.
