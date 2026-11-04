# BTCBOX UI/UX Execution Plan

## Status and authorization

Current status: implementation authorized; work proceeds in reviewable phases on `feature/uiux-upgrade`.

**The project owner has authorized the BTCBOX v2.0 frontend redesign and implementation.** The phase sequence below is an execution plan, not a request for repeated approval. The independent reviewer retains separate acceptance authority; a phase is not accepted merely because implementation work is committed. No changes to `main` or production deployment are authorized.

## Product and visual constraints (carry forward)

- Brand: BTCBOX independent identity.
- Theme: unified dark gray/black with fluorescent green accents.
- No dark gold or gold accent palette.
- Professional exchange information hierarchy; clean/premium visual language.
- Desktop and mobile must be designed as distinct responsive experiences, not a desktop layout merely scaled down.
- Preserve all existing business behavior and real API data. No mock market prices, balances, orders, positions, or account records.
- Mobile navigation product requirement: Home / Markets / Trade / Assets / My (首页 / 行情 / 交易 / 资产 / 我的), in that order. Implement the approved structure and route relationships; do not relabel Earn as Home or Account as My without correcting the destination.

## Phase 0 — Repository audit and baseline (evidence recorded; independent acceptance pending)

1. Confirm branch and source baseline; do not change `main`.
2. Inventory physical HTML shells, hash routes, view registry, navigation links and route entry points.
3. Map frontend copy to user-facing, admin-only, developer diagnostic and internal/system categories.
4. Record known product taxonomy ambiguity and missing market registry entries.
5. Record financial feature-flag mismatch and request owner decision.
6. Obtain exact-HEAD build/test evidence.
7. Update handoff and independent audit response.

Exit gate: audit findings have source evidence, exact-HEAD CI is recorded, unresolved product/financial decisions are assigned to owner.

## Phase 1 — UI foundation (implementation authorized; independent acceptance required)

- Audit design tokens, typography, spacing, radii, borders, shadows, focus/disabled/loading states.
- Define responsive breakpoints and safe-area behavior.
- Define shared navigation, page headers, cards, tables, form controls, dialogs, drawers and toasts.
- Verify accessibility basics: labels, keyboard focus, contrast, reduced motion and semantic controls.
- No business logic/API/auth/database changes.

## Phase 2 — User-facing routes (implementation authorized; independent acceptance required)

Recommended sequence:
1. Home / markets / login / registration.
2. Trade / K-line / seconds / order history.
3. Assets / deposit / withdrawal / earn.
4. My account / KYC / support / settings.
5. Secondary account routes and empty/coming-soon states.

Each route must be checked at narrow mobile, tablet and desktop widths. Preserve real API-backed states and error paths.

## Phase 3 — Admin and operational pages (implementation authorized within existing permissions and behavior)

- Separate admin information hierarchy from consumer navigation.
- Admin Chinese copy may remain Chinese if owner retains that requirement.
- Do not alter admin authorization, role checks, HTTP Basic Auth, financial approvals or audit behavior.
- Test empty, loading, error, success and permission-denied states.

## Phase 4 — Release validation (implementation authorized; production deployment remains prohibited)

- Build and automated tests on exact candidate commit.
- Browser QA on iOS Safari and Android/mobile Chrome where available.
- Desktop browser QA.
- Route smoke tests, console/network inspection, asset refresh/deep-link checks.
- API contract regression without changing request/response shape.
- Financial and matching tests remain a separate backend release gate; do not enable real orders until separately validated.
- No production deploy without explicit owner instruction.

## Change control

- Small, reviewable commits; one active editor per file.
- Never modify `main` or deploy production in this workflow.
- Never modify financial calculations, settlement, matching, database schema, auth/security flow or API contracts without explicit owner authorization.
- Do not fabricate supported products or translate away operational/legal/security meaning.
- Record exact commit SHA, changed files, commands and actual results in each execution report.


## Current implementation guardrails from independent review

- NAV-001 / NAV-002: implement the five-item mobile navigation and a distinct trade-type selection entry. Existing unsupported product types must be visibly unavailable/coming soon rather than presented as working.
- TRADE-001: preserve the bottom chart drawer; resolve desktop chart visibility and mobile order-entry/order-book arrangement against the latest approved protocol before restructuring the trade workspace.
- MARKET-001 / MARKET-002: inspect real market API/config responses and pair registry before changing Spot/Perpetual labels or New filters. Never add unsupported symbols or synthetic prices.
- DS-001: choose one authoritative token family after scanning all token usages; preserve Inter and JetBrains Mono declarations.
- MODAL-001 / SEC-UI-001: improve dialog semantics/focus behavior, drawer closability, and safe text rendering without changing business/API behavior.
- PLAN-001: this plan reflects the owner's existing implementation authorization; do not ask the owner to repeat it.
- Preview API isolation: do not perform Preview writes until the hard-coded API target is understood and confirmed safe.
