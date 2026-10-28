# Round 174 — Registration flow and deployment-origin repair

## Changes

- Registration mode now uses the existing Supabase email-link flow (`signInWithOtp` with `shouldCreateUser`) rather than posting to the deliberately disabled legacy `/api/register` endpoint. Password fields are hidden for email-link registration; terms consent is checked before sending the link.
- The login page now derives the callback URL from the active origin, supporting custom domains and Netlify previews when that exact callback is allowlisted in Supabase.
- Legacy login redirect parameters are constrained to the same origin to prevent open redirects.
- Replaced several mixed Chinese/English registration prompts with reviewed English copy.
- Updated static auth preflight and regression tests for the new behavior.

## Verification

- `npm test`: 204 tests passed.
- Python test suite: 230 tests passed.
- `npm run build`: passed.
- Supabase auth static preflight: 9/9 checks passed.
- API and new test JavaScript syntax checks: passed.

## Remaining external acceptance requirements

- Supabase dashboard redirect allowlists and email templates must be configured and tested for each real domain; this repository change cannot modify dashboard settings.
- Email delivery and Google OAuth must be tested in a deployed preview using real provider configuration.
- QRCode still loads from a version-pinned jsDelivr URL because the package is not present in the local npm cache and this environment could not vendor it offline. For production supply-chain hardening, vendor the verified library locally or use a reviewed local QR implementation.
- Supabase staging database migrations, financial concurrency/idempotency drills, reconciliation and restore testing remain required. No production deployment or database changes were performed.
