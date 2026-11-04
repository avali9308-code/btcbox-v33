# DS-001 — Design token inventory and usage map

## Scan scope

Baseline `79015236453072332e9a840188ad73d76a223334`; source files scanned: `index.html`, `admin.html`, `oauth/consent.html`, and eight `assets/css/*.css` files. Generated `dist/` copies excluded. The scan found **82 distinct custom-property names**. The exact baseline `:root` declaration snapshot is retained in `tests/fixtures/ds001-token-baseline.json`; the executable smoke test resolves all 82 names through the revised alias chains and compares them to their original literal values. Reference counts are literal `var(--name)` occurrences, not computed-style counts; duplicate references in the byte-identical SPA shells are counted twice.

## Ownership and mapping policy

- `assets/css/tokens.css` is the sole shared `:root` token source for the SPA and OAuth consent screen.
- Canonical namespaces: `--color-*`, `--font-*`, `--type-*`, `--space-*`, `--radius-*`, `--elevation-*`, `--motion-*`, `--layout-*`, `--layer-*`, `--auth-*`.
- Existing `--bg-*`, `--text-*`, `--brand*`, `--crypto-*`, `--fs-*`, `--s*`, `--z-*` names are compatibility aliases; do not remove until consumer migration is separately reviewed.
- Auth surfaces keep their previous distinct colors. OAuth keeps its prior muted text value through `--color-text-muted-subtle`.
- Existing CSS cascade order is unchanged. Auth component rules now consume canonical `--auth-*` values.

## Existing-variable reference map

| Existing variable | Canonical token | Baseline references | Main consumers / purpose |
|---|---|---:|---|
| `--bg-page` | `--color-canvas` | 5 | base, overlays, trade, OAuth |
| `--bg-card` | `--color-surface-card` | 23 | components, layouts, overlays, views |
| `--bg-raised` | `--color-surface-raised` | 45 | base, components, overlays, views |
| `--bg-hover` | `--color-surface-hover` | 14 | components, trade, assets, account, OAuth |
| `--border` | `--color-border` | 73 | shared components and all view styles |
| `--border-strong` | `--color-border-strong` | 18 | base, components, overlays and views |
| `--text-primary` | `--color-text-primary` | 33 | all main view styles |
| `--text-secondary` | `--color-text-secondary` | 62 | components, layouts and all views |
| `--text-muted` | `--color-text-muted` | 58 | base, components, overlays and all views |
| `--brand` | `--color-brand` | 17 | base, components and views |
| `--brand-bright` | `--color-brand-accent` | 56 | components, layouts, overlays and views |
| `--brand-hover` | `--color-brand-hover` | 2 | shared components |
| `--on-brand` | `--color-text-on-brand` | 3 | shared components |
| `--brand-soft` | `--color-brand-soft` | 14 | components, trade, assets and account |
| `--brand-ring` | `--color-brand-ring` | 0 | defined, no direct consumer found |
| `--up` | `--color-positive` | 3 | views, trade and account |
| `--down` | `--color-negative` | 20 | components, overlays and views |
| `--down-soft` | `--color-negative-soft` | 5 | OAuth, components and assets |
| `--dark-grey` | `--color-neutral` | 0 | defined, no direct consumer found |
| `--warning` | `--color-warning` | 9 | overlays and view styles |
| `--radius-sm` | `--radius-small` | 12 | base, components, overlays, assets, OAuth |
| `--radius-md` | `--radius-medium` | 12 | components, assets and OAuth |
| `--radius-lg` | `--radius-large` | 3 | overlays, assets and OAuth |
| `--shadow-card` | `--elevation-card` | 0 | defined, no direct consumer found |
| `--shadow-hover` | `--elevation-hover` | 0 | defined, no direct consumer found |
| `--shadow-modal` | `--elevation-modal` | 7 | SPA shell and overlays |
| `--ease` | `--motion-standard` | 19 | base, components, overlays, assets |
| `--ease-out` | `--motion-emphasized` | 8 | components, overlays and views |
| `--focus-ring` | same canonical token | 6 | OAuth, base and components |
| `--s1`–`--s8` | `--space-1`–`--space-8` | 0 | eight retained spacing steps; no direct consumer found |
| `--fs-xs`, `--fs-sm`, `--fs-md`, `--fs-h3`, `--fs-h2`, `--fs-h1` | `--type-xs`, `--type-sm`, `--type-md`, `--type-h3`, `--type-h2`, `--type-h1` | 8 for `--fs-sm`; 0 for others | legacy type scale |
| `--font-sans`, `--font-mono` | same canonical tokens | 1, 15 | frozen Inter and JetBrains Mono stacks |
| `--fs-page`, `--fs-module`, `--fs-body`, `--fs-aux`, `--fs-minor` | `--type-page`, `--type-module`, `--type-body`, `--type-aux`, `--type-minor` | 2, 3, 1, 6, 1 | frozen type hierarchy |
| `--danger`, `--danger-soft`, `--danger-ring` | `--color-negative`, `--color-negative-soft`, `--color-negative-ring` | 1, 0, 1 | compatibility aliases |
| `--info`, `--info-soft` | `--color-info`, `--color-info-soft` | 2, 3 | assets information states |
| `--topbar-h`, `--content-max`, `--content-max-wide`, `--page-gutter` | `--layout-topbar-height`, `--layout-content-max`, `--layout-content-max-wide`, `--layout-page-gutter` | 0 | layout scale retained |
| `--modal-w-sm`, `--modal-w-md`, `--modal-w-lg`, `--modal-w-risk` | `--layout-modal-small`, `--layout-modal-medium`, `--layout-modal-large`, `--layout-modal-risk` | 1 each | modal presets |
| `--z-overlay`, `--z-drawer`, `--z-toast`, `--z-splash` | `--layer-overlay`, `--layer-drawer`, `--layer-toast`, `--layer-splash` | 0, 2, 0, 0 | stacking order |
| `--crypto-canvas`, `--crypto-surface`, `--crypto-surface-2`, `--crypto-cavity` | `--auth-canvas`, `--auth-surface`, `--auth-surface-raised`, `--auth-field` | 2, 2, 0, 2 | auth surfaces |
| `--crypto-border`, `--crypto-border-shimmer`, `--crypto-border-strong` | `--auth-border`, `--auth-border-shimmer`, `--auth-border-strong` | 4, 2, 0 | auth borders |
| `--crypto-text-high` | `--auth-text-high` | 4 | auth high-contrast text |
| `--crypto-radius`, `--crypto-radius-input` | `--auth-radius-card`, `--auth-radius-field` | 1, 4 | auth radii |
| `--crypto-input-h`, `--crypto-btn-h`, `--crypto-field-gap` | `--auth-input-height`, `--auth-button-height`, `--auth-field-gap` | 1 each | auth dimensions |
| `--crypto-shadow-card`, `--crypto-glow` | `--auth-card-shadow`, `--auth-brand-glow` | 1 each | auth elevation and accent |
| `--content-max`, `--content-max-wide`, `--page-gutter`, `--topbar-h` | `--layout-*` | 0 | retained layout tokens |
| `--crypto-border-strong`, `--crypto-surface-2` | `--auth-border-strong`, `--auth-surface-raised` | 0 | retained compatibility values |

## New canonical tokens

OAuth-specific preserved values now centrally defined: `--color-text-muted-subtle`, `--color-negative-border`, `--color-negative-text`, `--color-warning-soft`, `--color-warning-border`, `--color-warning-text`, `--color-brand-border`, `--color-brand-text`, and `--elevation-oauth-card`.

## Follow-up (not part of this batch)

- Remove unused tokens only after a second source scan and independent review.
- Consider extracting the existing utility selectors from `tokens.css) only after cascade/load-order validation.
- Migrate other legacy CSS consumers incrementally; remove compatibility aliases only in a separately reviewed change.
- Browser computed-style comparison and screenshot QA remain pending; this task does not claim visual verification.
