# BTCBOX v41 — Authentication & English UI Audit

Date: 2026-10-29

## Scope
This package was based on the uploaded `BTCBOX-v40-auth-localization-audit.zip`. It includes the full source tree, public build output, tests, and deployment documentation.

## Changes in this pass
- Email/password registration: retained Supabase `signUp`, enforces a minimum of 8 characters, checks password confirmation, and instructs users to verify email before sign-in.
- Password login: retains the legacy `/api/login` path for legacy users and uses Supabase `signInWithPassword` plus server-side token verification for Supabase identities.
- Password reset: requires a second entry of the new password and refuses the update if the values differ.
- Google OAuth / email auth bridge: server verifies the Supabase access token against `/auth/v1/user`, requires a confirmed email, checks frozen-account status, and creates the BTCBOX server session only after validation.
- 2FA: Supabase-based login for a BTCBOX account with 2FA now receives a short-lived, server-generated second-factor token rather than being blocked or being allowed to skip 2FA. The only completion path is `/api/login/2fa`; tokens expire after 10 minutes and are consumed after successful verification. Second-factor attempts are rate-limited.
- English UI: added a dedicated `characterData` MutationObserver so in-place text changes from timers/SDKs/UI updates are passed through the existing English-safe text translator. Kept the existing child/attribute observer intact.
- Added six regression tests in `tests/round177-auth-localization-audit.test.js`.
- Rebuilt `dist/` using the project's allowlisted build script.

## Verification performed
- Baseline before this pass: `npm test` — 204 passed, 0 failed.
- Final: `npm run build` — passed.
- Final: `npm test` — 210 passed, 0 failed.
- The test suite is static/unit regression coverage. It is not a live browser E2E test and does not authenticate against the production Supabase project.

## Production settings still required
1. **Netlify environment variables:** configure `SUPABASE_AUTH_URL` and `SUPABASE_AUTH_PUBLISHABLE_KEY` (or `SUPABASE_AUTH_ANON_KEY`) for the authentication bridge. Keep any service-role/database secrets server-side only; never add them to public HTML or `dist/`.
2. **Supabase URL Configuration:** set the production Site URL and allow the exact callback `https://YOUR-PRODUCTION-DOMAIN/pages/login.html?auth_callback=1`. Add the matching local/preview URLs only if they are intentionally used.
3. **Google provider:** enable Google in Supabase Auth, enter the Google OAuth client ID and secret in the Supabase dashboard, and configure the Google OAuth authorized redirect URI to the Supabase project's callback URL shown by the dashboard (usually `/auth/v1/callback`).
4. **Email confirmation and SMTP:** enable email confirmation in Supabase Auth; configure production SMTP/sender/domain and ensure the confirmation and password-reset templates use the production site URL and allowed callback. The provider-managed email templates are not controlled by this repository and must be reviewed in the Supabase dashboard.
5. **Legacy account/data compatibility:** take a database backup before deploy, verify the persistence adapter and existing `db.users` records are available, and test a legacy password account, a legacy 2FA account, a Supabase email account, an unconfirmed email, and Google OAuth on a staging deployment.
6. **Production smoke tests:** after deploy, test register → confirmation email → sign in; forgot password → reset link → matching new password; Google sign-in; valid/invalid 2FA; frozen account rejection; logout and expired session. Confirm cookies are secure on HTTPS.

## Explicit limitations
- No Netlify or Supabase private dashboard access was available in this session, so provider configuration, SMTP delivery, real Google OAuth callbacks, and production session cookies were not live-tested.
- Static tests cannot prove that every third-party/provider-generated email or every possible dynamic string is English. The public UI translator maps known strings and fails closed for unknown CJK text, but a browser-based visual audit and provider-template review remain necessary.
- Do not deploy until the production settings above are completed and the staging smoke tests pass.
