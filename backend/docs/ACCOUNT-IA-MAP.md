# BTCBOX Account Center — Information Architecture Map

Date: 2026-11-02
Review branch: `feature/ai1-visual`
Scope: account hub and its relationship to the existing Assets destination.
Status: source-audited proposal; implementation belongs to 2号 Interaction Team and requires peer review.

## 1. Product principle

The account center is for identity, access protection, verification, support and personal preferences. The Assets destination is the wallet workspace for balances and money movement. Do not make both destinations competing wallet dashboards.

Use a progressive hierarchy:
- Level 1 — concise account overview and a small number of intent-based groups.
- Level 2 — a focused page for one category or task.
- Level 3 — records, detail, confirmation and exception handling within that task.

A category is not proof that a capability exists. Every entry must be classified as operational, read-only, preview-only, unavailable or not yet verified from its actual route and API contract.

## 2. Existing source map

| Current entry / route | Source evidence | Current state | IA disposition |
|---|---|---|---|
| Profile | `VIEWS.me()` summary card and Profile modal handler | Summary renders; handler looks for `#me-profile`, but markup has no matching ID | Keep in Identity summary; repair binding/semantics under 2号 |
| Identity Verification | `#/kyc`, `VIEWS.kyc` | Real KYC route and submit flow exist; advanced tier is limited/manual | Keep as a first-class identity action |
| Account Security | `#/settings` | Login password, fund password and 2FA controls exist in Settings | Give Security its own visual grouping; retain current route unless a route change is separately reviewed |
| Preferences | `#/settings` | Hide-small-balances preference exists; language is display-only text | Keep under Preferences; do not imply language switching works unless it is wired |
| Support | `#/support` | Message composition and support API call exist; service-status wording has open issue INT-1-005 | Keep under Help & Support; resolve authoritative availability wording separately |
| Fiat | `#/fiat` | Explicit Coming Soon; backend interface not connected | Do not present as an active payment method |
| Bank Cards | `#/cards` | Empty state; add-card form is disabled and explicitly disconnected | Group under Payment & Fiat only as unavailable/preview until real integration |
| Payment Methods | `#/payment` | Placeholder route | Do not show as a separate peer of Bank Cards and Fiat if all are unimplemented |
| Transfer | `#/transfer` | Preview-only transfer form; confirmation explicitly does not move funds | Keep out of the personal account/security group; wallet/transfer belongs to Assets when actually implemented |
| Referrals | `#/invite` | Coming Soon placeholder; no active referral data contract shown in reviewed source | Do not give equal prominence to live account/security actions; expose later under Rewards only when real |
| Assets | `#/assets` | Dedicated primary navigation destination; displays balances and Deposit/Withdraw; Records says history API is unavailable; Transfer opens an unavailable notice | This is the single owner for wallet overview and future transaction records/transfer |

## 3. Recommended Level 1 account hub

1. **Identity summary**
   - Email / UID.
   - KYC state and one direct verification action.
   - A compact Profile detail action.
   - Do not repeat the complete Assets balance dashboard.

2. **Security Center**
   - Login password.
   - Fund password.
   - 2FA.
   - Future device/session management only after a real route/data source exists.
   - Keep sensitive changes behind the existing Settings route and its confirmation flows.

3. **Verification**
   - Identity verification status, review state and next valid action.
   - Avoid duplicating all KYC tier detail in the hub.

4. **Help & Support**
   - Online support entry.
   - Help/FAQ only if a real resource exists.
   - Display service hours and online state consistently with an authoritative source.

5. **Preferences**
   - Existing display preferences.
   - Language only when a working selector exists.
   - Logout at the bottom, visually separated as a destructive action and retaining the existing custom confirmation modal.

6. **Payment & Fiat (conditional)**
   - One grouped destination only when there are real payment capabilities to manage.
   - Until then, avoid three separate peer cards for Fiat, Bank Cards and Payment Methods. If product visibility is required, present one clearly labeled unavailable/preview entry rather than implying operational service.

## 4. Assets boundary

The primary Assets navigation owns:
- Total and per-asset balances.
- Deposit and withdrawal entry points.
- Deposit/withdrawal status and transaction records when the corresponding APIs exist.
- Internal transfer when the backend supports it.

The account hub may contain one compact balance snapshot with a clear **View Assets** destination, but it must not duplicate the wallet tables, records, or transfer workflow. Current source explicitly states that general transaction history and internal transfer are not available; no new capability may be inferred from the preview forms.

## 5. Constraints for implementation

- Preserve the existing hash route identifiers unless a route migration is separately proposed and tested.
- Do not change API payloads, Supabase/auth, financial calculations, wallet state, transaction behavior or backend contracts as part of an IA refactor.
- Do not create fake records, payment methods, referral balances, device lists or transfer success states.
- Keep unavailable capabilities visibly unavailable and non-executable.
- Preserve custom BTCBox modal/toast behavior; do not use browser-native dialogs.
- Use semantic headings and links/buttons; ensure keyboard reachability and focus-visible states.
- Mobile: no horizontal page overflow at 320/375/390/430px; keep touch targets at least 44px where practical; respect the fixed bottom navigation safe area.

## 6. Acceptance checklist

- [ ] Every displayed entry resolves to a real current route or is explicitly labeled unavailable.
- [ ] Profile detail action works and is keyboard accessible.
- [ ] KYC status and next action remain accurate.
- [ ] Security actions still use existing API and confirmation flows.
- [ ] Support remains functional and does not claim unverified live-agent availability.
- [ ] Preferences do not imply unsupported controls.
- [ ] Logout retains the existing custom confirmation and sign-out result handling.
- [ ] Assets is the sole wallet workspace; no duplicate balance/records/transfer dashboard appears under My Account.
- [ ] Preview-only fiat/card/payment/transfer/referral functions cannot be mistaken for operational services.
- [ ] Desktop and mobile layouts are checked at 320/375/390/430px.
- [ ] Browser QA and tests are recorded as NOT RUN until actually executed.

## 7. Ownership and handoff

- 2号 Interaction Team: route map, hierarchy, markup, actions, accessibility and user flow.
- 1号 Visual Team: visual grouping, spacing, typography, responsive treatment after markup is available.
- 3号 Business Team: confirm capability/API availability; do not let presentation imply a backend feature that does not exist.

Implementation has not been made by this review. The current actionable handoff is `INT-1-007` in `docs/AI-ISSUE-LOG.md`.
