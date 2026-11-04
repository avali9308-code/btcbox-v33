# BTCBOX AI #1 — Guest-first experience acceptance plan

Baseline: shared project branch `develop` at `e7c8d9136fd6bf79b2e11ea240eaac0c70eeda0f`.
Implementation branch: `feature/ai1-sitewide-refinement-20261103`.
This document adds the guest-first acceptance baseline requested on 2026-11-03. It does not replace completed Home and Markets refinement.

## Priority 1 — First-visit / logged-out journey

### Required journey A
1. Open the site with no hash: show the public Home page, not the Markets page or Login page.
2. Verify first-load shell, top navigation, login and registration entry points.
3. Browse public Markets, search/filter pairs, and open a pair.
4. Open the Spot Trade page without authentication. Show genuine public market price, public K-line and public order-book data where providers return them.
5. Keep order inputs previewable, but never expose balances or private order data. Any Buy/Sell/order-submit action must clearly request sign-in.
6. Preserve the internal return route including the trading pair and the intended Buy/Sell side through login or registration, then return to that route after successful authentication.
7. Assets and personal account pages must show a clear sign-in state, not empty/zero balances or fabricated profile data.
8. Provide discoverable public entry points for announcements/help/support. A private support conversation remains authenticated.
9. Every private route (orders, deposit, withdraw, earn, KYC, settings, support conversation, admin) must enforce authentication in the client router and continue to enforce it at the API boundary.

### Public/private data boundary
- Public: home, market list, market ticker/snapshot, public depth, public K-line, and read-only trade preview.
- Private: account snapshot, balances, deposits/withdrawals, orders, profile/KYC, settings, support conversations, admin.
- Never create placeholder balances, orders, fills, or invented market values to make a screen look populated.
- Authentication UX must not weaken server-side authorization or financial write gates.

## Priority 2 — Registration and authentication

Audit email/password registration and login, Google OAuth, 2FA, session restoration, logout and password recovery against the actual backend contract. Email verification is not required for the current local-account registration flow.

**Product decision confirmed (2026-11-03):** Email verification is not required. `POST /api/register` creates a local account immediately and the user can sign in with the email/password. Keep the UI clear and do not introduce an email verification step.

**Known current architecture:** email/password registration/login use the local backend account/session flow; Google sign-in uses Supabase OAuth token verification and a server-side account mapping flow. Keep these paths distinct until their identity/session lifecycle is proven consistent. Password recovery for local accounts must be checked separately; do not imply Supabase recovery can reset a local PBKDF2 password.

## Priority 3 — Authenticated business journeys

After the guest journey is sound, verify account snapshot loading, asset valuation availability, deposit address availability, withdrawal safety gates, order query/cancel semantics, KYC, profile/security, support, and logout. No UI success state may contradict the API response.

## Priority 4 — Site-wide visual and responsive finish

Continue the existing Home and Markets refinement. Then refine Trade, Assets, Account, authentication, and remaining business pages. Desktop Trade may be restructured. Mobile Trade must comply with the user-supplied §9.4 specification: order book on the left and order form on the right, approx. 38/62, tested at 320/360/375/390/430px; chart in a bottom drawer; fixed five-item bottom navigation; no unsupported order types or fabricated controls.

## Required acceptance paths

### A — New visitor
Open site → Home → Markets → open pair → Trade preview → K-line/depth → click Buy/Sell → Login/Register → successful authentication → return to same pair and intended side.

### B — Authenticated user
Open site → Home → Markets → Trade → Assets → Deposit/Withdraw entry → Orders → Personal Center → Support → Logout → guest state.

## Initial source audit (2026-11-03)

- Public router allowlist currently includes Home, Markets, Trade, Trade Hub, K-line, Seconds and 404. Assets and My Account are rendered as guest sign-in panels. Other private routes redirect to Login and retain an internal return route.
- Guest trade form already suppresses balance shortcuts, labels the order action as sign-in, and stores Buy/Sell intent for the post-login return.
- The API places public market, depth and K-line reads before the authenticated-user boundary. Account and financial endpoints are behind that boundary; order creation independently rejects missing sessions and fails closed if matching cutover is not approved.
- The root hash fallback previously resolved to Markets. This was changed in this branch to Home so a first visit with no hash opens the public Home page.
- A public Help & Announcements route was added. It reads the existing public `announcement` field from `GET /api/config` and presents a sign-in-gated link to the existing private support conversation. The support conversation itself remains authenticated.
- Email verification is intentionally not required for the current local email/password registration flow.

## Test status

- JavaScript syntax parsing passed for all nine browser scripts loaded by `index.html` (`app-core`, `ui-components`, `views-home`, `views-trade`, `views-trading`, `views-assets`, `views-account`, `views-missing`, `boot`) after the guest-route and public Help additions.
- No end-to-end browser journey or real-device test has yet been claimed. Continue source/API checks and browser smoke tests before handing to AI #2.
- Do not merge this feature branch, enable funded trading, or represent the platform as production-ready based only on UI checks.

## Follow-up source audit and mobile refinement (2026-11-03)

- Email/password login calls the local backend. When 2FA is required, the flow completes through `POST /api/login/2fa` before the account snapshot is loaded and the saved internal return route is restored.
- Registration creates the local account and presents a clear success state with a manual sign-in action; it does not claim that a verification email is sent.
- Google OAuth stores the internal return route before redirect. On callback, boot checks the Supabase session, exchanges the access token for the backend cookie when the local account probe is unauthorized, then retries the account probe before routing. This is a source-level review only; provider configuration and a real Google round trip still require runtime verification.
- The trade page stores BUY/SELL intent separately from the return route. After successful authentication, the trade view consumes that intent. Orderbook row selection updates the price field only; it does not submit an order.
- Seconds contract UP/DOWN submission checks for a signed-in user before calling the API; guest users are redirected to login. The API remains the independent authorization boundary.
- Mobile trade now shows 24h change, high and low beside the selected pair/current price. Values are sourced from the existing market response and render as unavailable until real data arrives; no sample prices are introduced.
- The mobile trade layout stylesheet retains the requested orderbook-left 38% / order-entry-right 62% split, including a compact rule for screens at or below 360px.

### Follow-up static validation

- Re-parsed all nine browser JavaScript files loaded by `index.html` after the mobile pair-summary change; all nine passed JavaScript syntax parsing.
- The feature branch remains 61 commits ahead of `develop` and 0 behind at this checkpoint. No merge or deployment was performed.
- Browser/device interaction tests remain outstanding. In particular, validate the guest-to-login-to-trade return path (including BUY and SELL), Google OAuth callback, 2FA, and the 320/360/375/390/430px trade layouts on real browsers before marking the acceptance journeys complete.
