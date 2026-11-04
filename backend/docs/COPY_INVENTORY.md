# BTCBOX Visible Copy Inventory

## Scope

Source scan of `assets/js/views-account.js` and `assets/js/views-missing.js`. This is a classification list, not a translation patch. No user-visible text was changed.

## User-facing consumer views — English strings observed

- KYC: verification tiers, pending/approved/unverified states, withdrawal-limit explanations, document form labels, upload/advanced-review availability messages, submit/network errors.
- Support: service availability, assistant greeting, message composer, suggested questions, send failure.
- Settings: login/fund password, 2FA, preferences, language, success/error toasts.
- My Account: profile, UID, balances, available/frozen amounts, KYC/2FA/fund-password badges, account feature labels, logout confirmation.
- Secondary views: Fiat, Bank Cards, Transfer, Referrals, Payment Methods. Most are explicitly described as coming soon or not connected; transfer/card screens explicitly warn that they do not execute real transactions.

These strings are consumer-facing and should remain English or be routed through the existing localization system in a future approved copy pass. Do not remove warnings or alter their meaning.

## Admin-only visible Chinese strings — observed in `views-account.js`

- Page title: `管理后台 Admin Console`
- Tabs: `用户管理`, `充值审核`, `提币审批`, `KYC 审核`
- Admin error/empty states: `统计数据加载失败`, `请确认管理员权限与网络连接`, `网络错误，统计数据加载失败`, `暂无用户数据`, `用户列表为空`, `暂无待审核充值`, `所有充值均已处理`, `暂无待审批提币`, `所有提币均已处理`, `暂无待审核 KYC`, `所有 KYC 申请均已审核`
- Table headings include `邮箱`, `状态`, `余额 (USDT)`, and other admin data labels.
- Admin stats labels include `总用户数`, `待审批提币`, `待审核 KYC`, `充值地址数`.
- Admin confirmation/action copy and result messages also include Chinese in the same admin view.

Classification: administrator-only interface copy, not consumer-facing localization debt under the current owner requirement that admin/backend pages may remain Chinese. Preserve it unless owner requests an admin-language pass.

## Developer comments and internal text

- Chinese comments in source explain implementation, fallback behavior, financial safety, and internal labels. Comments are not rendered UI and should not be translated as part of frontend copy work.
- Function names, route comments and code identifiers are internal.
- API/backend error strings may be passed through to users (for example `r.error || r.message`); each call site needs a separate audit to determine whether the backend can return Chinese. Do not rewrite backend errors or API behavior in a copy-only task.

## Audit caveats

- This is a targeted source review, not an exhaustive automated scan of every tracked file or every possible dynamic backend response.
- No language toggle/i18n implementation completeness claim is made.
- Preserve legal, financial, KYC, security, and withdrawal warning semantics in any future translation.
