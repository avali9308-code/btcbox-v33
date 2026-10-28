# BTCBOX v33 — Final Re-audit and Repair Report

Date: 2026-10-28

## Changes made in this pass

- Set all public-facing HTML pages to English locale (`lang="en"`) and made the public i18n runtime default to English regardless of stale browser/local-storage language preferences.
- Removed the public language selector so the interface cannot be switched back into a mixed-language state. The Chinese-language admin page remains `lang="zh-CN"`.
- Added a fail-closed English fallback for unknown Chinese text/attributes and translations for common dynamic text prefixes.
- Removed the display-currency selector and all CNY/RMB conversion requests/labels from the public trade and settings UI. Asset totals and P&L on the account page display USDT.
- Removed unsupported homepage claims about operating history, cold-storage percentage, and a specific fee rate; replaced the promotional card with neutral product labels.
- Fixed settings actions to use stable action identifiers instead of matching translated visible labels, so password and fund-password actions do not break when text is translated.
- Replaced static Chinese login-page copy with English.
- Added regression tests for English-only public copy, USDT-only valuation, and removal of unsupported homepage trust claims.

## Verification run

- Node.js tests: **190 passed, 0 failed**.
- Python tests: **230 passed**.
- Inline JavaScript syntax: **42 blocks checked, no syntax errors**.
- Netlify public build: **successful**.
- Public HTML static scan: no unmarked Chinese text nodes found outside scripts/styles/inputs; the runtime has a fallback for unknown dynamically inserted Chinese text.
- Public UI currency scan: no CNY/RMB/USD/EUR/JPY/HKD display or conversion references found in the public HTML/JS pages.
- ZIP integrity: verified after packaging.

## Important items not marked as complete

1. **Seconds-contract preset-result feature:** no corresponding implementation was found in the supplied source archive (including the admin UI, API handlers, and seconds-contract page). It therefore cannot truthfully be described as preserved or verified. This release does not add a hidden mechanism that predetermines real-money contract outcomes. If a preset-result feature is required for QA, it should be explicitly labeled and isolated to a sandbox/simulation environment, never used to rig real-money settlement.
2. **Live Supabase/Netlify validation:** no production credentials or live database access were used. This report does not claim that OAuth, email magic links, real deposits/withdrawals, financial RPC migrations, or live market-source fallback have passed production tests.
3. **Visual browser testing:** this pass includes source/static checks and automated tests, not a complete real-device visual walkthrough.
4. **KYC document image persistence/review:** the current code still needs a private object-storage flow and an admin review view for uploaded document images; this is not claimed complete.

## Deployment guidance

The ZIP contains source, tests, Netlify configuration, Supabase SQL/migration files, and documentation. The generated `dist/` directory is intentionally excluded; Netlify rebuilds it from the allowlisted source during deployment. Keep production financial cutover flags disabled until the database migrations and real financial workflows have been tested and reconciled.
