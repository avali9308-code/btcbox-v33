# BTCBOX v41 — Production Checklist

## Netlify
- [ ] Deploy this package from the intended Git branch.
- [ ] Confirm build command is `npm test && npm run build`, publish directory is `dist`, and functions directory is `netlify/functions`.
- [ ] Set `SUPABASE_AUTH_URL` to the correct Supabase project URL.
- [ ] Set `SUPABASE_AUTH_PUBLISHABLE_KEY` or `SUPABASE_AUTH_ANON_KEY`.
- [ ] Keep database/service-role secrets server-side; never place them in frontend files or the public build.
- [ ] Confirm the Supabase persistence adapter and existing account records are connected before production cutover.

## Supabase Auth
- [ ] Set production Site URL.
- [ ] Add `https://YOUR-PRODUCTION-DOMAIN/pages/login.html?auth_callback=1` to allowed redirect URLs.
- [ ] Enable Email provider and email confirmation.
- [ ] Configure production SMTP, sender identity, confirmation template, and password-reset template.
- [ ] Enable Google provider and configure its client ID and client secret.
- [ ] Copy the Supabase dashboard's callback URL (typically `https://PROJECT_REF.supabase.co/auth/v1/callback`) into the Google OAuth client's authorized redirect URIs.
- [ ] Ensure Google OAuth consent screen/client is configured for the correct production domain.

## Staging acceptance tests
- [ ] Register with email/password; reject passwords shorter than 8 characters and mismatched confirmations.
- [ ] Confirm an unverified email cannot obtain a BTCBOX server session.
- [ ] Confirm email, then sign in using the new password.
- [ ] Request password reset; verify mismatched new-password confirmation is rejected.
- [ ] Complete password reset and sign in with the new password.
- [ ] Complete Google OAuth and verify return to the intended page.
- [ ] Sign in with a legacy password account.
- [ ] Sign in with a legacy account that has 2FA enabled; confirm no session is issued before a valid code.
- [ ] Sign in with a Supabase account whose BTCBOX record has 2FA enabled; confirm a valid second-factor code is required.
- [ ] Verify invalid/replayed/expired 2FA tokens fail and attempts are rate-limited.
- [ ] Verify frozen accounts cannot sign in.
- [ ] Verify logout, session expiry, and secure cookies on HTTPS.
- [ ] Review Supabase confirmation/reset email content and all user-visible email strings in the provider dashboard.
- [ ] Manually review dynamic UI states in a real browser; static tests do not replace browser E2E testing.

Do not mark production acceptance complete until the provider settings are configured and these staging checks pass.
