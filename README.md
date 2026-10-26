# BTCBOX 部署说明（Render + Git）

零依赖 Python 3 标准库项目，无需 pip 安装任何包。

## 一、Render 新建 Web Service
1. 连接 Git 仓库，Runtime 选 **Python 3**。
2. Build Command：留空（或 `pip install -r requirements.txt`，无依赖）。
3. Start Command：`python3 server.py`（Procfile 已配置，可留空自动识别）。
4. 端口由环境变量 `PORT` 自动注入，代码已兼容。

## 二、必须配置的环境变量（Render → Environment）
| 变量 | 说明 |
|---|---|
| `ADMIN_PASS` | 后台管理员密码（**必须修改**，默认 `feiji123456` 不安全） |
| `ADMIN_USER` | 后台管理员账号（可选，默认 `feiji`） |
| `DATA_DIR` | 持久化数据目录，见下方"持久磁盘" |
| `GOOGLE_CLIENT_ID` | （可选）Google OAuth Web Client ID，配置后登录页显示官方 Google 登录按钮 |
| `ALLOW_GOOGLE_MOCK` | （可选）设为 `1` 开启模拟谷歌登录，**仅本地演示用，生产切勿设置** |

## 三、数据持久化（重要，否则重启丢用户）
1. Render → Disks → 新建磁盘，挂载路径填 `/data`，大小 1GB 起。
2. 环境变量加 `DATA_DIR=/data`。
3. `data.json`（用户/订单/余额）与 KYC 上传图片都会存到该磁盘，重启不丢失。

## 四、Google 登录配置（可选）
1. Google Cloud Console → APIs & Services → Credentials → 创建 **OAuth 2.0 Client ID**（Web application）。
2. Authorized JavaScript origins 添加你的 Render 域名，如 `https://xxx.onrender.com`（含自定义域名）。
3. 将 Client ID 填入 Render 环境变量 `GOOGLE_CLIENT_ID`，重新部署即生效。
4. 未配置时谷歌登录按钮自动隐藏，不影响邮箱注册登录。

## 五、上线前检查清单
- [ ] `ADMIN_PASS` 已设为强密码
- [ ] 已挂载持久磁盘并设置 `DATA_DIR=/data`
- [ ] 后台 `/admin` → 充值地址已替换为真实地址（默认是 PLACEHOLDER 占位）
- [ ] 未设置 `ALLOW_GOOGLE_MOCK`（生产必须关闭，否则可伪造任意邮箱登录）
- [ ] `.gitignore` 已生效，`data.json` / `uploads/` / `actions.log` 不会被提交（含明文管理员密码与用户数据）

## 六、本地运行
```bash
python3 server.py 8080
# 浏览器打开 http://localhost:8080
# 本地演示谷歌登录：ALLOW_GOOGLE_MOCK=1 python3 server.py 8080
```

---

# Netlify 部署（推荐）

本项目已适配 Netlify：静态页面由 Netlify CDN 托管，后端 API 由 `netlify/functions/api.js`（Node.js Serverless）提供，数据持久化到 **Netlify Blobs**。

## 一、部署步骤

1. 将项目推送到 GitHub/GitLab 仓库。
2. Netlify → Add new site → Import an existing project → 选择仓库。
3. **Build command**：留空（或 `npm install`）。
4. **Publish directory**：`.`（根目录，`netlify.toml` 已配置）。
5. 点击 Deploy，等待构建完成（首次会自动安装 `@netlify/blobs`）。

## 二、环境变量（Site settings → Environment variables）

| 变量 | 说明 |
|---|---|
| `DEPOSIT_USDT_TRC20` | USDT-TRC20 真实充币地址（**必须替换**，默认是 PLACEHOLDER） |
| `DEPOSIT_USDT_ERC20` | USDT-ERC20 充币地址 |
| `DEPOSIT_USDT_BEP20` | USDT-BEP20 充币地址 |
| `DEPOSIT_BTC` | BTC 充币地址 |
| `DEPOSIT_ETH` | ETH 充币地址 |
| `DEPOSIT_SOL` | SOL 充币地址 |
| `ALLOW_GOOGLE_MOCK` | 设为 `1` 开启模拟谷歌登录，**仅演示用，生产切勿设置** |
| `ADMIN_USER` | 后台管理员账号（默认 `admin`） |
| `ADMIN_PASS` | 后台管理员密码（**必须修改**，默认 `ChangeMe@2024`） |

> 未配置充值地址时，充值页显示 PLACEHOLDER 占位地址，用户充值会丢失。也可在部署后通过后台 `/admin` → 系统配置中修改充值地址，实时生效。

## 三、数据持久化（Netlify Blobs）

- 数据（用户/余额/订单/KYC/理财/客服消息）自动存储在 Netlify Blobs 的 `btcbox` store 中。
- 无需额外配置，部署后自动可用。Blobs 免费额度足够演示与小规模使用。
- 若 Blobs 暂不可用，Function 会降级为内存缓存（冷启动后数据重置，仅用于演示）。

## 四、本地开发（Netlify Dev）

```bash
npm install -g netlify-cli
npm install
netlify dev
# 浏览器打开 http://localhost:8888
```

`netlify dev` 会同时启动静态服务 + Functions 本地模拟 + Blobs 本地存储。

## 五、与原 Python 版本的差异

| 功能 | Python (server.py) | Netlify Functions |
|---|---|---|
| 注册/登录/登出 | ✅ | ✅ |
| 账户/余额/订单 | ✅ | ✅ |
| KYC 提交 | ✅ | ✅（自动 pending，需后台审核→暂为模拟） |
| 充值确认 | ✅ | ✅（模拟到账） |
| 提现申请 | ✅ | ✅（冻结余额，审核为模拟） |
| 下单撮合 | ✅ 模拟 | ✅ 模拟 |
| 理财申购/赎回 | ✅ | ✅ |
| 客服消息 | ✅ | ✅（自动回复） |
| 设置（密码/资金密码/2FA） | ✅ | ✅ |
| 行情代理 /api/market | ✅ | ✅（代理 Binance REST） |
| 后台管理 /admin | ✅ | ✅ 已恢复（admin.html + /api/admin/*，Basic Auth） |
| Google 真实 OAuth | ✅ | ⚠️ 仅支持 mock 模式，真实 GIS 需前端配置 Client ID |

## 六、Netlify 上线前检查清单

- [ ] 已配置全部 `DEPOSIT_*` 环境变量为真实地址
- [ ] 未设置 `ALLOW_GOOGLE_MOCK`（生产必须关闭）
- [ ] 已设置 `ADMIN_PASS` 为强密码（默认 ChangeMe@2024 不安全）
- [ ] 部署后登录 `/admin` → 系统配置，确认充值地址已更新为真实地址
- [ ] 已删除仓库中的 `data.json` / `actions.log` / `uploads/kyc/`（含敏感数据）
- [ ] `.gitignore` 已包含 `data.json`、`actions.log`、`uploads/`、`node_modules/`
- [ ] Site 已启用 HTTPS（Netlify 默认自动开启）
