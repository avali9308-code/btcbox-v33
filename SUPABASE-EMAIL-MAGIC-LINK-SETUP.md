# BTCBOX Email Magic Link Setup

This guide describes the Supabase Dashboard settings required for email magic-link sign-in. User-facing sign-in status and error messages in the login page are in English.

## 1. Authentication URL Configuration

Open Supabase Dashboard → select the BTCBOX project → Authentication → URL Configuration.

Set **Site URL** to:

`https://btcboxcdt.netlify.app`

Under **Redirect URLs**, add both exact URLs:

`https://btcboxcdt.netlify.app/pages/login.html?auth_callback=1&auth_method=email`

`https://btcboxcdt.netlify.app/pages/login.html?auth_callback=1`

Save changes. The first URL is for email magic links; the second preserves the Google OAuth callback.

## 2. Enable email authentication

Open Authentication → Sign In / Providers (the exact menu label may vary) → Email. Ensure the Email provider is enabled and save.

The frontend currently calls `signInWithOtp` with `shouldCreateUser: true`, so a new email can create an account if Supabase project policies permit it. If you want email sign-in only for existing users, the code policy must be changed to `shouldCreateUser: false`.

## 3. Review the Magic Link template

Open Authentication → Email Templates → Magic Link. Keep Supabase's supported confirmation URL flow, normally using `{{ .ConfirmationURL }}`. Do not replace it with a hard-coded token or an untrusted redirect. You may customize the subject/body, but keep the confirmation link variable intact.

## 4. Configure email delivery

For production, configure a working SMTP provider under the project's email/SMTP settings and verify sender identity/domain as required by that provider. Supabase's default mail service may have restrictive delivery/rate limits; do not assume production delivery is reliable until a real inbox test succeeds.

## 5. Netlify environment variables

In Netlify → Site configuration → Environment variables, verify these server-side variables exist:

- `SUPABASE_AUTH_URL` = `https://zlozsutefnmgwwzrlipt.supabase.co`
- `SUPABASE_AUTH_PUBLISHABLE_KEY` = the project's publishable key, or use `SUPABASE_AUTH_ANON_KEY` if that is the configured name.

These are for server-side Supabase Auth token validation. Do not put a service-role/secret key in the browser and never share it in chat. Keep financial storage variables separate.

## 6. Test after deploy

1. Open `https://btcboxcdt.netlify.app/pages/login.html`.
2. Enter an email address you control and click **Send Email Sign-in Link**.
3. Check Inbox and Spam/Junk.
4. Open the newest link in the same browser where you requested it (PKCE uses browser-local verification state).
5. Confirm the page reports successful sign-in and redirects to BTCBOX.
6. Test Google sign-in separately to confirm it still works.

The code tests do not prove email delivery or live OAuth provider configuration. If the link fails, check the Supabase Auth logs and the browser console. The Supabase Dashboard's Google provider toggle and Google Cloud client credentials must be verified in their respective dashboards.
