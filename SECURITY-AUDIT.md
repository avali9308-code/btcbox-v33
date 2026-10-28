# BTCBOX — Phase 3 Authentication, Authorization & API Security Audit

## Changes implemented in this source package

- **Fund password storage:** new fund passwords are stored as salted PBKDF2-SHA256 hashes using the existing 100,000-iteration / 32-byte configuration, not plaintext. Comparison uses `crypto.timingSafeEqual`.
- **Legacy migration:** when a legacy plaintext fund password is successfully used for a withdrawal, it is upgraded in-memory to a salted hash and the plaintext field is deleted before the normal request persistence. Failed attempts do not upgrade or mutate it.
- **Admin API data minimization:** admin user-detail responses omit fund-password hash and salt; the UI receives a boolean `fund_password` value for its existing “set/not set” indicator.
- **Session expiry:** the server now rejects sessions older than seven days even if a copied token is presented after the browser cookie expires.
- **Cookie hardening:** session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` outside Netlify local development.
- **2FA freeze recheck:** completing a 2FA challenge rechecks account freeze state and invalidates the temporary token if the account is frozen.
- **Response headers:** API JSON responses set `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, and `X-Frame-Options: DENY`.

## Findings still requiring deployment/integration work

1. **Registration/captcha is not production-grade.** The current captcha endpoint returns the code in its JSON response and registration does not enforce a delivered/verified challenge. This is not a real anti-bot control. Before public launch, integrate email/SMS or a real challenge provider, validate a one-time token server-side, and add per-IP/account rate limits. Do not treat the existing captcha as protection.
2. **No distributed rate limiting / login lockout.** Password and 2FA attempts are not protected by a shared, durable rate-limit mechanism. Add one at the edge or with a shared store before public production use.
3. **Persistent storage is still a whole-document read/modify/write on Netlify Blobs.** Same-instance request serialization is not a cross-instance transaction. This remains a blocker for real-money operations until migrated to a transactional database with atomic balance updates, unique idempotency keys, and an auditable ledger.
4. **Admin authentication depends on `ADMIN_USER` and `ADMIN_PASS`.** Ensure both are strong, unique deployment secrets, never committed, and rotate them if they have ever been shared. Prefer a stronger managed identity / MFA gate for production administration.
5. **Legacy plaintext exposure history:** users with legacy plaintext fund passwords remain in that form until a successful withdrawal attempt migrates them. A controlled migration that hashes all existing fund passwords in a verified backup copy is preferable before production.
6. **No live environment validation performed.** This audit did not access production environment variables, Netlify Blobs data, logs, or deployed routes. It did not execute live login, withdrawal, or administrator actions.

## Validation performed

- `node --check netlify/functions/api.js`
- `npm test` — 29/29 tests passed at the time this report was written.

These are source-level and regression checks, not penetration testing or production end-to-end acceptance.

## Release gate

Do not enable real deposits, withdrawals, yield subscriptions/redemptions, or other real-value operations until the transactional storage gap, backup/restore rehearsal, captcha/rate-limit controls, and production smoke tests are completed.
