# Source package cleanup record

This package was reviewed for GitHub + Netlify + Supabase source deployment.

- Removed Python bytecode and `__pycache__` directories; these are generated artifacts and are recreated locally.
- Removed accumulated round-by-round changelogs, validation snapshots, and intermediate audit reports that are not referenced by the active regression suite or deployment instructions.
- Retained application HTML/CSS/JS/SVG/PNG assets, Netlify configuration and function, package manifests, Supabase SQL migrations, current security/financial/deployment guidance, static audit scripts, and regression tests.
- Retained a small number of historical records because the regression suite explicitly checks them.
- No `.env` file or service-role secret was included; `.env.example` has blank secret placeholders.

This cleanup does not claim a live Netlify deployment, live Supabase migration, Google OAuth round trip, or real email delivery test.

- Hardened Netlify publishing: `dist/` is built from an explicit allowlist of `index.html`, `admin.html`, `pages/`, and `assets/`; repository-only SQL migrations, tests, scripts, `.env.example`, Python legacy files, and operations documents are no longer deployed as public static files.
- Build/test checks verify the allowlisted publish configuration. Live deployment and Supabase state still require separate verification.
