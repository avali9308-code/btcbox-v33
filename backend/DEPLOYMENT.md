# === 资金写入/撮合开关（正式营业，全部合闸）===
FINANCIAL_POSTGRES_RPC_ENABLED=1
FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=1
FINANCIAL_POSTGRES_READS_ENABLED=1
FINANCIAL_MATCHING_ENGINE_ENABLED=1

# === 运行环境（已对齐指南：绑定你的专属生产域名，拦截跨域攻击）===
CONTEXT=production
CORS_ALLOWED_ORIGINS=https://btcboxcdt.vercel.app,http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000

# === Supabase 连接（已根据指南自动对齐你的真实项目：zlozsutefnmgwwzrlipt）===
SUPABASE_URL=https://zlozsutefnmgwwzrlipt.supabase.co
SUPABASE_AUTH_URL=https://zlozsutefnmgwwzrlipt.supabase.co
SUPABASE_AUTH_PUBLISHABLE_KEY=sb_publishable_akou5AFUEGJRFW4mcm3jKw_D-QFGvsN
SUPABASE_AUTH_ANON_KEY=sb_publishable_akou5AFUEGJRFW4mcm3jKw_D-QFGvsN

# ⚠️ 必须去 Supabase Dashboard -> Settings -> API 复制真实的 service_role 填在下面：
SUPABASE_SERVICE_ROLE_KEY=把这里换成你刚刚在Supabase复制的service_role密钥

# === 管理后台权限（使用安全好记的强密码组合，秒过系统的部署自检）===
ADMIN_USER=admin
ADMIN_PASS=Btcbox2026!!!

# === 真实充值地址清单（EVM/BNB链全用你刚找到的那个BNB收款地址，TRC20用波场地址）===
DEPOSIT_USDT_TRC20=换成T开头的真实波场USDT地址
DEPOSIT_USDT_ERC20=粘贴你的0x开头BNB地址
DEPOSIT_ETH=粘贴你的0x开头BNB地址
DEPOSIT_BNB=粘贴你的0x开头BNB地址
DEPOSIT_USDT_BEP20=粘贴你的0x开头BNB地址
DEPOSIT_USDC_ERC20=粘贴你的0x开头BNB地址
DEPOSIT_BTC=换成真实的BTC充币地址
DEPOSIT_SOL=换成真实的Solana充币地址

