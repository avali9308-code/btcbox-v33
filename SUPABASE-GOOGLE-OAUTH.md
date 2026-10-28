# BTCBOX Supabase Auth 配置（Google + 邮箱魔法链接）

## 当前实现

- 登录页：`pages/login.html` 提供原有邮箱密码登录/注册、真实 Google OAuth，以及使用上方邮箱输入框发送免密魔法链接。
- 两种 Supabase 登录成功后都回到正式站点 `https://btcboxcdt.netlify.app/pages/login.html?auth_callback=1`，再由服务端验证 Supabase access token，建立 BTCBOX 自己的 HttpOnly 会话并进入主界面。
- 邮箱魔法链接使用 `auth_method=email` 标记回调；Google 使用同一回调处理。
- 服务端从 Supabase `/auth/v1/user` 验证令牌和已验证邮箱；provider 信息来自已验证的 Supabase identity，不信任浏览器传来的 provider。
- 新账户使用空余额初始化。已有同邮箱 BTCBOX 账户按已验证邮箱匹配；被冻结账户拒绝登录。启用了 BTCBOX 2FA 的账户不能通过 OAuth/魔法链接绕过原有二次验证流程。
- Supabase Auth 环境变量与项目原有数据存储配置分开，避免意外切换交易数据存储项目。

## Netlify 服务端环境变量

设置为 Netlify Functions 的 server-side environment variables：

- `SUPABASE_AUTH_URL=https://zlozsutefnmgwwzrlipt.supabase.co`
- `SUPABASE_AUTH_PUBLISHABLE_KEY=你的 sb_publishable_... 公钥`

也支持第二项使用 `SUPABASE_AUTH_ANON_KEY`。不要将 `service_role` / secret key 放入 HTML 或客户端变量。

## Supabase 控制台

1. Authentication → Sign In / Providers → Google：启用 Google，填写 Google Cloud OAuth Client ID 和 Client Secret。
2. Authentication → URL Configuration：Site URL 设置为 `https://btcboxcdt.netlify.app/`。
3. 在 Redirect URLs 中加入以下地址（当前应用的认证页是 `/pages/login.html`，不是根目录 `/index.html`）：
   - `https://btcboxcdt.netlify.app/pages/login.html?auth_callback=1`
   - `https://btcboxcdt.netlify.app/pages/login.html?auth_callback=1&auth_method=email`
4. Google Cloud Console 的 Authorized redirect URIs 应填写 Supabase provider callback：
   `https://zlozsutefnmgwwzrlipt.supabase.co/auth/v1/callback`
5. 邮箱 OTP/魔法链接模板应使用 Supabase 默认的 `{{ .ConfirmationURL }}`（或官方推荐的确认 URL 模板），不要把 Supabase provider callback 当成网站最终回调。

## 邮箱魔法链接专项检查（Supabase 已启用 Email 时）

1. 在 Supabase Dashboard → Authentication → Sign In / Providers → Email 确认 Email provider 已启用。该功能使用 `signInWithOtp`，不是邮箱密码登录；`shouldCreateUser: true` 表示允许新邮箱注册。
2. Authentication → URL Configuration → Redirect URLs 中加入完整回调地址：
   `https://btcboxcdt.netlify.app/pages/login.html?auth_callback=1&auth_method=email`
   同时保留 Google 回调地址。若你改用自定义域名，必须把回调常量和 Supabase allowlist 同步改成实际域名。
3. Authentication → Email Templates → Magic Link：确认模板使用 Supabase 的 `{{ .ConfirmationURL }}`（或官方默认确认 URL 逻辑），不要把邮件中的链接硬编码为 Google Cloud callback，也不要直接把 `{{ .Token }}` 拼成站点 URL。
4. 若使用自定义 SMTP，确认发件人域名已验证、SMTP 配置有效并检查发送限额/垃圾邮件；Supabase 控制台的 Email provider 开启并不等于邮件一定能送达。
5. 发起魔法链接请求后，建议在发起请求的同一浏览器中打开最新邮件里的链接。当前客户端使用 PKCE，若邮件应用把链接交给另一个浏览器/内置浏览器，可能缺少原浏览器的 verifier；此时回登录页重新发送并在原浏览器打开。过期或已使用的链接需要重新发送。
6. 登录页会显示发送状态；点击邮件链接后，客户端读取 Supabase 会话，再交由 `/api/supabase-login` 在服务端验证并建立 BTCBOX HttpOnly 会话。不会只靠前端变量伪造登录。成功后跳转首页；邮箱回调失败会给出重新发送提示并清理 URL 中的认证参数。

注意：自动化测试只能验证代码路径和配置要求，不能证明真实邮箱已送达，也不能替代实际点击邮件链接的端到端测试。

## 说明

代码和自动化测试不能替代真实部署测试。当前没有通过你的 Supabase/Google 控制台执行真实 OAuth，也没有部署 Netlify；正式上线前仍需实测 Google、邮箱魔法链接、退出登录、冻结账户和启用 2FA 的账户。

## Round 84：部署后运行时预检

部署后访问 `https://btcboxcdt.netlify.app/api/auth-health`。该只读端点只返回布尔状态，不返回任何密钥：
- `auth_environment_configured`: Netlify 服务端是否同时配置 Auth URL 和 publishable/anon key。
- `auth_project_matches_expected`: 服务端 Auth URL 是否匹配项目 `zlozsutefnmgwwzrlipt`。
- `provider_enabled: null`: Netlify 无法安全地代替你读取 Supabase Dashboard 的 Google Provider 开关，因此必须人工核对。
- `live_oauth_tested: false`: 这个端点不是 OAuth 登录测试，也不能证明 Google Client ID/Secret 有效。

若端点返回 503，先修正 Netlify 环境变量并重新部署，再测试登录。即使返回 200，也必须实际点击 Google 登录完成一次端到端验证。

## Deployment-origin note (Round 174)

The login page now derives its OAuth/email-link return URL from `window.location.origin`, so production custom domains and Netlify deploy previews do not silently redirect users to a hard-coded production hostname. Add each intended deployed origin's callback URL (`https://YOUR-DOMAIN/pages/login.html?auth_callback=1`) to Supabase Auth's redirect URL allowlist before testing that origin. Do not broadly allow arbitrary wildcard redirects. The source change does not modify Supabase dashboard settings.
