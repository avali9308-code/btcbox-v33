# Round 177 — Auth and English UI hardening

- Added confirmation to the password-reset dialog.
- Preserved legacy password/2FA login while requiring a verified Supabase identity for bridged auth.
- Supabase-authenticated users with BTCBOX 2FA now receive a short-lived second-factor challenge; challenge attempts are rate-limited and successful tokens are one-use.
- Added in-place character-data translation observation for dynamic English UI.
- Added `tests/round177-auth-localization-audit.test.js`.
- See `ROUND-177-AUTH-ENGLISH-UI-AUDIT.md` for validation results and production setup requirements.
