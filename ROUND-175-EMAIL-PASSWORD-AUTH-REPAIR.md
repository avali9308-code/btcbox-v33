# Round 175 — Email/password account-flow repair

## Changes
- Registration now presents password and password-confirmation fields and uses Supabase `signUp` with email verification; it no longer routes registration through the legacy disabled `/api/register` endpoint or silently switches to magic-link-only registration.
- Passwords must be at least 8 characters and match; registration requires explicit Terms and Privacy consent.
- Password sign-in tries the existing server-side legacy login first, then falls back to Supabase `signInWithPassword` for Supabase identities. The server-side `/api/supabase-login` endpoint remains the authority that verifies the Supabase access token and creates the BTCBOX HttpOnly session.
- “Forgot password” now requests a Supabase reset email. The recovery callback accepts a new password through Supabase `updateUser`, then signs out the local Supabase SDK session.
- Updated the built `dist/pages/login.html` output and regression tests.

## Validation
- `npm test`: 204/204 JavaScript tests passed.
- `python -m pytest -q tests`: 230 passed (61 subtests); one optional artifact-tool warm-up emitted a warning, but pytest returned exit code 0.
- `npm run build`: passed.

## Deployment/configuration requirements (not performed here)
- This is a source/build artifact patch. It does not deploy to a live site or change the Supabase project settings.
- In Supabase Auth, configure the production site's exact redirect URL `/pages/login.html?auth_callback=1&auth_method=email` (and the recovery redirect `/pages/login.html?auth_callback=1&auth_method=recovery`) plus the relevant site URL/custom domains.
- Ensure email confirmation and password recovery email delivery are enabled and SMTP/rate limits are configured for production.
- Legacy accounts stored only in BTCBOX's local database cannot receive Supabase password-reset emails unless they also have a Supabase Auth identity. A secure reset flow for those legacy-only accounts requires a server-side email delivery provider and a one-time reset-token endpoint; do not enable the insecure legacy registration switch.
- Live OAuth/email delivery and deployed-domain behavior were not integration-tested because no live project credentials or deployment access were provided.
