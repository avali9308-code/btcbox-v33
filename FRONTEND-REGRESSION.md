# BTCBOX 前端与业务回归检查（第 42 轮）

## 本轮已完成
- 静态检查首页、所有 `pages/*.html` 与管理后台的本地 `href` / `src` 引用，未发现失效的相对文件引用。
- 检查各客户页面的移动端 viewport 声明；移除阻止用户缩放的 `maximum-scale=1` / `user-scalable=no`，改善 iOS/Android 的放大可访问性。此修改不改变交易页的布局结构或交易组件。
- 修正地址绑定页语言元数据与中文页面不一致的问题。
- 为客服消息区域添加实时日志语义，为输入框添加可访问名称。
- 新增 `tests/frontend-regression.test.js`，覆盖本地资源路径、移动端缩放、语言元数据及客服可访问性。

## 代码检查范围
- 页面文件：主页、登录、行情、交易、秒合约、资产、充值、提现、地址绑定、理财、订单、KYC、设置、个人中心、客服、法律页面及后台。
- 后端接口引用：确认地址管理与客服页面使用的 `/api/addresses`、`/api/support/messages`、`/api/support/chat` 在 Netlify API 源码中存在对应处理逻辑。
- 自动化测试只能验证静态约束与现有回归逻辑，不等同于真实浏览器、真实账户、生产 API 或资金链路端到端验收。

## 仍需真实环境验收
- iPhone Safari 与 Android Chrome 真机布局、软键盘遮挡、底部安全区和横屏行为。
- 登录后全页面导航、未登录跳转、客服退出重登后的历史记录。
- 现货下单、秒合约下单、理财申购/赎回、充值与提现审核的端到端业务结果。
- 桌面端管理后台操作权限、响应式布局及数据加载状态。
- 资金并发与存储跨实例一致性仍受 `STORAGE-RELIABILITY.md` 中记录的限制；上线前须完成事务化存储与恢复演练。

## Follow-up: business interaction correctness
- The earn page now displays only products supported by the backend catalog. Unsupported BTC/ETH flexible products were removed from the actionable UI, and the 180-day product label was corrected to USDT to match backend accounting.
- Earn subscription retries reuse a session-scoped request ID for the same product and amount after network or 5xx ambiguity; the key is cleared on success or a definitive client-side/server validation response.
- This reduces duplicate submissions from browser retries but does not fix cross-instance storage races. Production funds flows still require transactional persistence and concurrency testing.
