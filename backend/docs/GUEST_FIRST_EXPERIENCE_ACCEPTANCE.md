# BTCBOX Guest-First Experience — Implementation & Acceptance Plan

## Experience baseline

The first-run experience starts as a signed-out visitor. Public market discovery must not depend on an account. Private account information and all financial actions remain protected by the existing session cookie and server-side checks.

## Confirmed source/API behavior

- Public GET endpoints: `/api/market`, `/api/kline`, and `/api/depth`; they use external market providers and return unavailable states rather than locally fabricated market data.
- Private GET endpoints: `/api/account`, `/api/orders`, and support-message reads require an authenticated user.
- Financial writes are fail-closed. `POST /api/order` requires authentication, accepts limit orders only, and returns `MATCHING_ENGINE_UNAVAILABLE` until matching-engine cutover is approved.
- `POST /api/seconds/order` requires authentication and returns a fail-closed financial-cutover response while financial writes are disabled.
- Deposit address retrieval requires authentication; deposit credit is not performed from a client-submitted amount. Withdrawals require authentication and remain disabled until financial cutover is complete.
- The current local `/api/register` flow creates a local account and sets `email_verified: true`; no actual email-verification delivery/confirmation endpoint was found in this API. Do not present email verification as implemented until a real provider flow exists.
- Google availability is determined at runtime through `/api/auth-health`; the UI must only enable Google OAuth when the provider is confirmed enabled.
- The current source exposes an authenticated support-chat route, but no separate public announcements feed, FAQ/help-center route, or corresponding public API was found. Keep the existing customer-support entry visible, but do not fabricate announcement/help content or claim those services exist.

## Visitor route policy

### Public browsing
- `#/home`, `#/markets`, `#/trade-hub` (router alias to `tradehub`), `#/trade/:symbol`, `#/kline/:symbol`, and `#/seconds`.
- Market prices, depth and candles must be sourced from the public API. If unavailable, show a clear unavailable/loading state; never fabricate prices or orderbook levels.
- Spot order entry is previewable while signed out. Buy/sell, percentage shortcuts and order submission must lead to login, preserving the pair and intended side.

### Private previews and protected routes
- `#/assets` and `#/me` show a guest explanation and login/register actions; no balances, orders, identity details or profile data are rendered.
- `#/orders`, `#/deposit`, `#/withdraw`, `#/earn`, `#/kyc`, `#/settings`, `#/support`, and `#/admin` remain protected. A guest is sent to login with the requested internal hash stored for return after authentication.
- Return targets must be internal hash routes only. Never accept external redirect URLs.
- The server remains authoritative. Client route guards and disabled controls are UX, not a replacement for API authentication.

## Acceptance path A — first-time visitor

1. Open the root URL in a clean browser profile; land on public Home, not Login.
2. Verify visible Home hierarchy, live-data loading/unavailable state, and guest Log in / Create account entry points.
3. Open Markets; search/filter and open a supported pair.
4. Open Spot Trade; verify pair, price, depth and K-line load only from real public endpoints.
5. Verify no account balance, order history or position data is disclosed; order panel shows a sign-in prompt instead of a fabricated available balance.
6. Tap Buy and Sell separately; each opens Login and preserves the pair plus selected side.
7. Complete email/password login; return to the same pair and intended side.
8. Repeat via Create account; after registration and subsequent login, return to the stored internal destination.
9. Open Assets and My while signed out; verify private-data guest states and working login/register actions.
10. Open each protected route directly; verify login gate and destination restoration.
11. Verify no unauthenticated API request can create an order, seconds position, deposit, withdrawal, or read private account/order/support data.

## Acceptance path B — authenticated user

1. Open the site with a valid session; verify authenticated header/navigation state.
2. Browse Markets and Spot Trade; confirm public data remains live and account controls are enabled only for authenticated sessions.
3. Open Assets; verify balances and valuations come from authenticated account data plus valid live prices; missing price coverage must remain visibly unavailable.
4. Open Deposit and Withdraw; verify real server status and restrictions are communicated accurately. No success state may be shown for a blocked financial operation.
5. Open Orders and My Account; verify only the signed-in user's server data appears.
6. Open KYC, Settings and Support; verify each page uses authenticated endpoints.
7. Log out; clear private client state and return to a signed-out public route. Confirm private routes are gated again.

## Mobile trade terminal acceptance

The mobile Spot Trade work area must follow the supplied §9.4 specification: orderbook on the left, order form on the right (approximately 38% / 62%), tested at 320 / 360 / 375 / 390 / 430 px. Desktop layout may be redesigned independently. Do not expose unsupported order types or tabs without real backend data.

## Current implementation status

- [x] Public guest routes permitted by the client router.
- [x] First-run default changed from Login to Home.
- [x] Assets and My have signed-out guest states without private data.
- [x] Protected routes preserve the original internal destination for post-login return.
- [x] Google OAuth return target now prefers the stored original destination.
- [x] Public trade pair route alias `trade-hub` resolves to the existing Trade Hub view.
- [x] Spot trade guest view does not show a fabricated available balance or order rows.
- [x] Buy/sell and order-entry actions route guests to login; intended side is restored.
- [x] Market/K-line/depth public endpoints confirmed in API source and live-probed: `/api/market`, `/api/kline`, and `/api/depth` returned HTTP 200 with Coinbase-sourced data at the time of the probe.
- [x] Unauthenticated live `/api/account` probe returned `need_login: true`; private account data was not returned.
- [x] Market order option removed from the form because the server accepts limit orders only.
- [x] Seconds order action now requires a signed-in user.
- [x] Live `/api/auth-health` reports Google provider enabled and `live_oauth_tested: true`.
- [ ] Run browser smoke tests for both acceptance paths, including the full Google OAuth callback.
- [x] Registration success copy now discloses that email verification is not enabled in the current local registration service.
- [ ] Implement a real email-verification flow only after selecting/configuring an actual email-auth provider and server endpoint.
- [ ] Complete full mobile width and interaction acceptance; real iOS Safari/Chrome operation may be performed by the independent QA role.
- [ ] Confirm latest Vercel build for this branch after rate limits permit. The previous run exposed the `admin.html` / `index.html` equality test; the source files have since been synchronized, but the next build is currently blocked by the Vercel build-rate limit.

## Safety / release gates

Do not enable funded trading, deposits, withdrawals, or matching-engine writes as part of visual/guest-experience work. The current server-side fail-closed checks must remain intact until isolated PostgreSQL matching, ledger, fee, precision and concurrency validation is approved.
