# BTCBOX — GitHub + Netlify + Supabase

BTCBOX static frontend and Netlify Functions API. This repository is intended to be deployed from GitHub through Netlify; Supabase provides Auth and the PostgreSQL/RPC path where explicitly enabled.

## Project entry points

- `index.html`, `pages/`, `assets/` — website pages, styles, localization, and market client.
- `netlify/functions/api.js` — the `/api/*` serverless API handler.
- `netlify.toml` — Netlify build, public `dist/` publish directory, redirects, and security headers.
- `scripts/build-site.js` — copies only the allowlisted public HTML, pages, and assets into `dist/`; source, SQL migrations, tests, and operational documents are not published as website files.
- `supabase/sql/` — versioned database migrations and RPC definitions. These SQL files are **not applied automatically** by deployment.
- `tests/` — Node and Python regression tests.
- `scripts/` — static security, migration, and financial cutover checks.
- `SUPABASE-GOOGLE-OAUTH.md`, `SUPABASE-EMAIL-MAGIC-LINK-SETUP.md` — Auth setup and callback guidance.
- `FINAL-DEPLOYMENT-CHECKLIST.md`, `SECURITY-AUDIT.md`, `FINANCIAL-OPERATION-CONTRACT.md`, `supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md` — deployment and operational constraints.

## Deploy

1. Commit the repository to GitHub and connect that repository to Netlify.
2. Keep the Netlify build settings from `netlify.toml`: build command `npm test && npm run build`, publish directory `dist`, functions directory `netlify/functions`.
3. Configure required secrets only in Netlify environment variables. Never commit `.env`, service-role keys, SMTP credentials, admin passwords, or other private credentials. `.env.example` contains placeholders only.
4. Confirm the configured Supabase project URL and Auth callback allowlist in the Supabase dashboard. See the two Auth setup guides.
5. Apply database migrations to the intended Supabase project in the documented order, after backup and staging verification. Netlify does not apply these migrations for you.
6. After deploy, verify registration/login callbacks, email delivery, API health, and the expected database writes in the live environment.

## Local checks

```bash
npm ci
npm test
node --check netlify/functions/api.js
python scripts/check_supabase_auth_config.py
python scripts/check_inline_scripts.py
python -m unittest discover -s tests -p 'test_*.py'
```

## Important safety status

Automated tests and source-level audits do not prove live OAuth/email delivery, that SQL migrations are applied, or that PostgreSQL transaction/concurrency and backup/restore behavior have passed. Financial PostgreSQL cutover flags must remain unset until the staging acceptance, identity mapping, historical reconciliation, concurrency testing, and rollback/restore checks are complete. The API deliberately fails closed when the full financial cutover prerequisites are not met.

The current admin manual-deposit route calls `admin_manual_deposit_atomic` only behind the complete financial cutover gate and fails closed without crediting funds when prerequisites are missing. The migration has not yet been applied to a live staging database as part of this source-package review.

The legacy `server.py` and Python financial modules are retained for regression/audit compatibility only; Netlify's `netlify/functions/api.js` is the deployment API entry point. Do not deploy a second backend from `server.py`.
