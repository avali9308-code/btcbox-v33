# Round 173 — Batch repair report

## Changes applied

- Disabled the legacy public CAPTCHA endpoint that returned the challenge answer in its JSON response. It now fails closed with an English `VERIFICATION_UNAVAILABLE` response because no secure email/SMS delivery provider is configured in this source package.
- Disabled legacy local registration by default because it marked email addresses as verified without proving mailbox ownership. The explicit `ALLOW_UNVERIFIED_LEGACY_REGISTRATION=1` switch is for isolated development only and must not be set in production.
- Removed third-party QR image URLs from deposit and 2FA pages. Deposit QR rendering now attempts local canvas generation through the QRCode library loaded from jsDelivr; if the library is unavailable, the page displays a copy-address fallback. The 2FA setup displays the secret for manual authenticator setup rather than sending the TOTP secret to a third-party image service.
- Kept the Content Security Policy restrictive rather than allowing an external QR image service.
- Updated the language audit regression test/report wording to match the current public UI statement.
- Added security regression tests for the above source-level invariants.

## Verification boundary

- `node --check netlify/functions/api.js` and `node --check tests/round171-language-audit.test.js` passed.
- Full `npm ci` could not finish within the available execution window, so the full Node test suite and production build have not been verified after these edits.
- A real deployed browser test, email verification provider integration, Supabase staging concurrency/idempotency/reconciliation/restore drills, and legal review for target US/EU markets cannot be completed from this ZIP alone. Production financial flags must remain disabled until those checks are performed.

## Deployment note

This is a security-first patch: registration now intentionally returns a service-unavailable response until a real mailbox-verification flow is integrated. Do not enable `ALLOW_UNVERIFIED_LEGACY_REGISTRATION` on production to bypass this safeguard. The local QR library is referenced from jsDelivr and should be vendored locally with a verified integrity hash before a strict supply-chain production release.
