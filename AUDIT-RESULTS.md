# BTCBOX source-package audit — 2026-10-28

## Completed source-level checks

- Node regression tests: 186 passed.
- Python regression tests: 230 passed.
- Supabase auth configuration static checks: 9/9 passed.
- Inline JavaScript syntax checks: 44 blocks passed.
- `node --check netlify/functions/api.js`: passed.
- Public build local-reference scan: 17 HTML pages, zero missing local references.
- Public build contains only the allowlisted website entry pages, `pages/`, and `assets/`; repository SQL, tests, scripts, environment template, Python legacy backend, and operations documents are excluded from `dist/`.

## Important limits / production acceptance still required

- These are source/static tests, not a live browser visual QA session across mobile and desktop.
- Google OAuth redirect round-trip and actual email delivery were not exercised against the live Supabase project.
- Supabase migrations, RLS/grants, financial RPCs, transaction concurrency, reconciliation, and backup/restore were not run against a live staging database as part of this package audit.
- Do not enable financial cutover flags until the documented staging acceptance and rollback evidence are complete.
- Confirm real deposit addresses and network mapping before enabling deposits; empty/placeholder addresses should remain unavailable.
- Confirm live Netlify environment variables and production domain allowlists after deployment.
