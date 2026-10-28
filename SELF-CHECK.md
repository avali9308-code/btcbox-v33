# BTCBOX Progress 41 — Self-check

## 本轮变更
- 新资金密码以独立随机盐和 PBKDF2-SHA256 哈希保存，不再持久化明文。
- 旧数据兼容：成功验证旧版明文资金密码时升级为哈希，并删除旧明文字段。
- 后台用户详情接口隐藏资金密码哈希和盐值，仅向旧版管理 UI 返回布尔状态。
- 会话服务端有效期限制为 7 天；非 Netlify 本地开发环境的会话 Cookie 使用 `Secure`、`HttpOnly`、`SameSite=Lax`。
- 2FA 完成步骤重新检查账户冻结状态。
- API 响应增加 `Cache-Control: no-store`、`X-Content-Type-Options`、`Referrer-Policy` 和 `X-Frame-Options`。
- 新增 `SECURITY-AUDIT.md` 记录剩余风险和上线门槛。

## 检查结果
- `node --check netlify/functions/api.js`：通过。
- `npm test`：29/29 通过。

## 未完成且不能误报为已完成的事项
- 注册验证码尚未与真实邮件/短信或挑战提供方集成，且注册流程尚未强制验证挑战。
- 尚无跨实例共享的登录/2FA 限流与锁定机制。
- Netlify Blobs 的整体 JSON 读改写仍无法保证跨实例事务；尚未迁移到事务数据库。
- 尚未执行生产数据备份、恢复演练、真实部署验收或渗透测试。
- 本轮未部署，未访问生产密钥、日志或真实用户数据。
## 第 42 轮前端回归补充
- 新增 `FRONTEND-REGRESSION.md`，记录静态页面与资源引用检查范围及生产验收限制。
- 前端回归测试覆盖本地资源引用、移动端缩放可访问性、地址绑定语言元数据、客服输入/消息区域可访问性。
- 自动化检查不代表真机或生产环境端到端测试。

## 第 43 轮业务回归补充
- 理财前端只展示后端产品目录实际支持的 USDT 产品，移除会发送不受支持产品 ID 的 BTC/ETH 活期卡片，并将 180 天产品名称统一为 USDT。
- 理财申购在同一浏览器会话内按产品和金额保存请求标识；网络失败或 5xx 时保留标识，避免用户重试时生成新请求 ID。
- 新增两项前端回归测试；`npm test`：35/35 通过。
- 理财页内联 JavaScript `node --check`：通过。
- 仍未进行真实浏览器、生产环境或跨 Netlify 实例资金并发测试。


## 第 44 轮：Supabase 事务写入桥接准备
- 已发现账户内存在名为 `btcbox` 的 Supabase 项目，但项目状态为 INACTIVE；未恢复项目、未读取/写入数据库、未执行任何 SQL。
- 新增可选 Supabase 后端存储适配器：仅在服务端配置 `SUPABASE_URL` 与后端密钥后启用；无密钥时保持 Netlify Blobs 路径。
- Supabase 状态表为空时 fail-closed，避免误把现有交易平台初始化为空数据。
- 新增 `supabase/sql/btcbox_state_cas.sql`，使用 revision compare-and-swap 拒绝陈旧写入；此脚本尚未执行，且不包含 Blobs 数据导入。
- 写入冲突返回 HTTP 409，通用服务端错误不再向客户端暴露底层错误详情。
- `node --check netlify/functions/api.js`：通过；`npm test`：40/40 通过。
- 仍需先授权恢复/启用 Supabase 项目，备份并导出原始 Blobs 数据，导入并核对后才能切换；当前 CAS 桥接不能替代规范化账本和单笔资金操作事务。

## Progress 45 — Supabase Google OAuth integration

- Replaced the login page's mock Google-account prompt with Supabase JS v2 Google OAuth and a callback on the current site's `/pages/login.html?auth_callback=1` route.
- Added a server-side `/api/google-login` exchange that validates Supabase access tokens through Supabase Auth `/auth/v1/user` before creating BTCBOX's HttpOnly session.
- Auth Supabase environment variables are deliberately separate from the optional Supabase state-storage adapter variables.
- Verified email is required; frozen users are denied; accounts with 2FA cannot bypass the existing second-factor flow; external redirect targets are rejected.
- Added `SUPABASE-GOOGLE-OAUTH.md` with deployment env vars, Supabase URL allowlisting, Google Cloud callback URI, and manual verification steps.
- Not verified against a live Supabase/Google provider or production deployment; dashboard settings and domain allowlisting remain operator tasks.
