# BTCBOX Round 176 — Authentication and English-localization audit

## Scope
Reviewed the v39 ZIP's login page in both source and distribution paths, focusing on email/password registration, password login/reset callbacks, Supabase configuration timing, and English-language UI fallback behavior.

## Findings
1. **Supabase config race fixed:** previously `/api/config` loaded asynchronously while the SDK/client could initialize first, so the client could use the hard-coded fallback URL/key. The client now waits for both SDK and config request completion before initialization.
2. **English network fallback fixed:** one fallback path could display Chinese if the translation module was unavailable. It now uses English.
3. **SDK loader errors are English:** replaced Chinese-only internal error strings with English.
4. **Login-page English fallback improved:** user-facing static labels/placeholders/title in the login page now default to English before i18n runs, reducing the risk of a Chinese flash for English users. The i18n module still supplies the selected locale after load.
5. **Whole-product localization is not certified:** other pages, shared modals/toasts, backend responses, and emails were not exhaustively audited in this round. Do not claim that no Chinese can appear anywhere until those paths are checked.
6. **Live authentication is not certified:** this archive-level check cannot verify production Supabase URL configuration, email delivery, allowed redirect URLs, backend `/api/supabase-login`, legacy account migration, or actual browser callback behavior.

## Files changed
- `pages/login.html`
- `dist/pages/login.html`

## Validation performed
- Confirmed both login files contain the same config-wait and English fallback changes.
- Confirmed registration/password reset/auth callback code remains present.
- This is a source/static audit, not an end-to-end browser test or a production deployment.

## Deployment checks still required
- Verify `/api/config` returns the intended production Supabase URL and publishable key.
- Add the deployed login callback URL to Supabase Auth URL allow-list.
- Verify email confirmation and recovery templates/SMTP delivery.
- Run browser tests for new signup, unverified login rejection, confirmed login, forgot password, update password, Google OAuth, 2FA, and legacy accounts.
