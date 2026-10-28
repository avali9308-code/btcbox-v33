# Round 172 — API English status copy

- Added a response-boundary normalizer for fixed API `msg` fields that contain CJK characters.
- Added reviewed English translations for common authentication, seconds-contract, financial cutover, and request validation messages.
- Unknown CJK status messages now fall back to a neutral English message; user-authored content and other fields are preserved.
- Added regression tests for API response normalization.
- Verification: 198 Node.js tests passed; production build passed.
- No deployment was performed and no production database was changed.


## Round 175 — Email/password auth repair
- Added verified Supabase email/password registration, Supabase password-login fallback, and Supabase password-reset/recovery UI.
- Validation: 204 JavaScript tests, 230 Python tests (61 subtests), build passed.
- See `ROUND-175-EMAIL-PASSWORD-AUTH-REPAIR.md` for deployment requirements and limitations.
