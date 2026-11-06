// BTCBOX shared API handler for Vercel Node Functions.
// Persistent state and financial records require Supabase; no Netlify Blobs fallback.
const crypto = require('crypto');

const SESSION_COOKIE = 'session_token';
const PBKDF2_ITER = 100000;
const PBKDF2_KEYLEN = 32;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIVE_PRICE_CACHE_MS = 15000;
let livePriceCache = { expiresAt: 0, prices: {} };

// ===== 数据层（失败时关闭；不使用陈旧缓存处理可变数据）=====
// Legacy JSON/Blobs writes cannot resolve 跨实例并发读-改-写竞争; they are retired.
// 注意：Netlify Blobs 不是事务型数据库。每次请求重新读取可以避免本实例
// 的 TTL 缓存覆盖较新的数据，但无法解决跨实例并发读-改-写竞争。生产资金
// 业务仍需迁移到支持事务/唯一约束的数据库后才能开放真实资金操作。
function supabaseStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY));
}
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
}
// Publishable/anon key 读取：trim 空白并校验格式，防止 env 值被换行/空格污染。
// 合法格式：sb_publishable_ 开头（新格式）或 eyJ 开头（JWT 旧格式），不含任何空白字符。
// 校验失败返回空串并告警，绝不把污染值返回给前端或用于 Auth 初始化。
const PUBLISHABLE_KEY_RE = /^(sb_publishable_|eyJ)[A-Za-z0-9._\-]+$/;
function getPublishableKey() {
  const raw = String(process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_AUTH_ANON_KEY || '').trim();
  if (!raw) return '';
  if (/\s/.test(raw) || !PUBLISHABLE_KEY_RE.test(raw)) {
    console.warn('[publishable-key] invalid format or whitespace detected; returning empty (fail-closed).');
    return '';
  }
  return raw;
}
// Detect whether Google OAuth is enabled in the Supabase Auth project by reading
// GoTrue's public /auth/v1/settings. Cached briefly so every auth-health /
// supabase-login call does not pay an extra round trip. Returns true / false, or
// null if the status cannot be determined (settings endpoint unreachable).
let _googleProviderCache = { value: null, expiresAt: 0 };
// Google-only identity boundary. Authorization uses server-verified app_metadata and linked identities,
// never user_metadata or a provider value supplied by the browser.
function isGoogleOnlySupabaseIdentity(identity) {
  if (!identity || typeof identity !== 'object') return false;
  const appMetadata = identity.app_metadata && typeof identity.app_metadata === 'object' ? identity.app_metadata : {};
  const providers = Array.isArray(appMetadata.providers) ? appMetadata.providers.map(p => String(p || '').toLowerCase()) : [];
  const identities = Array.isArray(identity.identities) ? identity.identities : [];
  return appMetadata.provider === 'google' && providers.length === 1 && providers[0] === 'google' &&
    identities.length === 1 && identities[0] && identities[0].provider === 'google';
}
function isValidAuthEmail(value) {
  return typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
function isSupabaseUserId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function detectGoogleProviderEnabled() {
  const now = Date.now();
  if (_googleProviderCache.value !== null && _googleProviderCache.expiresAt > now) return _googleProviderCache.value;
  const authUrl = String(process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const authKey = getPublishableKey();
  if (!authUrl || !authKey) {
    _googleProviderCache = { value: false, expiresAt: now + 60 * 1000 };
    return false;
  }
  try {
    const res = await fetch(authUrl + '/auth/v1/settings', {
      method: 'GET',
      headers: { 'apikey': authKey, 'Authorization': 'Bearer ' + authKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) throw new Error('settings http ' + res.status);
    const data = await res.json();
    const enabled = !!(data && data.external && data.external.google);
    _googleProviderCache = { value: enabled, expiresAt: now + 60 * 1000 };
    return enabled;
  } catch (e) {
    // Keep the last known value; if never known, report null (unknown) and retry soon.
    const prev = _googleProviderCache.value;
    _googleProviderCache = { value: prev, expiresAt: now + 15 * 1000 };
    return prev;
  }
}
// ===== CORS（SPA 与后端跨域必需）=====
// 带 credentials 时 Access-Control-Allow-Origin 不能用 *，必须反射具体 Origin。
// _currentEvent 在 handleRequest 入口赋值，供 json() 合并 CORS 头使用。
let _currentEvent = null;
// CORS allowlist. 默认仅生产域名；localhost 仅在 CONTEXT=dev 时加入。
// Cross-origin requests with credentials are only allowed from origins
// explicitly listed in CORS_ALLOWED_ORIGINS (comma-separated). Unlisted
// origins receive no Access-Control-Allow-Origin header, so the browser blocks
// response reading. Same-origin requests never send an Origin header and are unaffected.
const DEFAULT_CORS_ALLOWED_ORIGINS = 'https://btcboxcdt.vercel.app';
const DEV_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://127.0.0.1:8000'];
let _corsAllowedOrigins = null;
function corsAllowedOrigins() {
  if (_corsAllowedOrigins === null) {
    const raw = process.env.CORS_ALLOWED_ORIGINS || DEFAULT_CORS_ALLOWED_ORIGINS;
    _corsAllowedOrigins = new Set(String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean));
    // CONTEXT 默认 production（dev 需显式设置）；仅 dev 追加本地开发地址。
    if (process.env.CONTEXT === 'dev') DEV_CORS_ORIGINS.forEach(function (o) { _corsAllowedOrigins.add(o); });
  }
  return _corsAllowedOrigins;
}
function corsHeaders(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin || '';
  const base = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && corsAllowedOrigins().has(origin)) {
    base['Access-Control-Allow-Origin'] = origin;
    base['Access-Control-Allow-Credentials'] = 'true';
  }
  return base;
}

// Partial financial cutover is deliberately blocked: a write-RPC flag alone must never enable it.
// User/admin balance and history reads still use btcbox_state, so switching writes
// to the normalized ledger without an explicit full-cutover approval would split
// financial authority and show stale balances/history. Keep the default fail-closed.
// Financial write/matching gates are explicit opt-in. Unset, empty, malformed,
// or any value other than the exact string '1' keeps the capability disabled.
// Do not set these flags to '1' until isolated PostgreSQL migrations, ledger
// reconciliation, symbol rules, fees, and end-to-end acceptance have passed.
// supabaseStorageConfigured() remains a hard prerequisite in all write paths.
// Flags: FINANCIAL_POSTGRES_RPC_ENABLED, FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED,
// FINANCIAL_POSTGRES_READS_ENABLED, FINANCIAL_MATCHING_ENGINE_ENABLED.
function manualDepositRpcEnabled() {
  return process.env.FINANCIAL_POSTGRES_RPC_ENABLED === '1' &&
    process.env.FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED === '1';
}

function financialPostgresReadsEnabled() {
  return manualDepositRpcEnabled() && process.env.FINANCIAL_POSTGRES_READS_ENABLED === '1';
}

function financialWritesEnabled() {
  return financialPostgresReadsEnabled() && supabaseStorageConfigured();
}

function matchingEngineEnabled() {
  return process.env.FINANCIAL_MATCHING_ENGINE_ENABLED === '1' &&
    manualDepositRpcEnabled() && financialPostgresReadsEnabled() && supabaseStorageConfigured();
}

function matchingEngineRequested() {
  return process.env.FINANCIAL_MATCHING_ENGINE_ENABLED === '1';
}

function matchingPairFromSymbol(symbol) {
  const pairs = { BTCUSDT: ['BTC','USDT'], ETHUSDT: ['ETH','USDT'], SOLUSDT: ['SOL','USDT'],
    BNBUSDT: ['BNB','USDT'], XRPUSDT: ['XRP','USDT'], DOGEUSDT: ['DOGE','USDT'],
    ADAUSDT: ['ADA','USDT'], AVAXUSDT: ['AVAX','USDT'], LINKUSDT: ['LINK','USDT'],
    DOTUSDT: ['DOT','USDT'], TRXUSDT: ['TRX','USDT'], LTCUSDT: ['LTC','USDT'],
    BCHUSDT: ['BCH','USDT'], NEARUSDT: ['NEAR','USDT'], UNIUSDT: ['UNI','USDT'],
    ATOMUSDT: ['ATOM','USDT'], ETCUSDT: ['ETC','USDT'] };
  return pairs[symbol] || null;
}

async function matchingRpc(name, payload) {
  if (!matchingEngineEnabled()) throw new Error('Matching engine cutover is not approved');
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: supabaseHeaders(), body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.ok !== true) {
    const error = new Error('Matching RPC failed');
    error.status = response.status; error.result = result; throw error;
  }
  return result;
}

// Seconds-contract reference price. The server always fetches the open/settle
// price itself from the same trusted feeds as /api/market; client-supplied
// prices are never trusted for balance-affecting operations.
const SECONDS_ALLOWED_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'BNB']);
async function fetchSecondsReferencePrice(symbol) {
  if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) throw new Error('symbol unsupported');
  const fetchJson = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('price provider HTTP ' + response.status);
    return response.json();
  };
  try {
    const ticker = await fetchJson('https://api.exchange.coinbase.com/products/' + symbol + '-USDT/ticker');
    const price = Number(ticker && ticker.price);
    if (Number.isFinite(price) && price > 0) return { price: price, source: 'coinbase', ts: Math.floor(Date.now() / 1000) };
  } catch (_) { /* fall through to Bybit */ }
  try {
    const payload = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot&symbol=' + symbol + 'USDT');
    const list = payload && payload.result && payload.result.list;
    const ticker = Array.isArray(list) && list[0];
    const price = Number(ticker && ticker.lastPrice);
    if (Number.isFinite(price) && price > 0) return { price: price, source: 'bybit', ts: Math.floor(Date.now() / 1000) };
  } catch (_) { /* fall through */ }
  throw new Error('reference price unavailable');
}

async function readFinancialAccountSnapshot(userId) {
  if (!supabaseStorageConfigured()) throw new Error('Financial database unavailable');
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/read_financial_account_snapshot_v1', {
    method: 'POST', headers: supabaseHeaders(),
    body: JSON.stringify({ p_user_id: String(userId) })
  });
  if (!response.ok) throw new Error('Financial account read failed');
  const result = await response.json();
  if (!result || result.ok !== true || !result.balances || !Array.isArray(result.withdrawals) || !Array.isArray(result.earn_records)) {
    throw new Error('Financial account response invalid');
  }
  return result;
}

async function readAdminAccountBalances(userIds) {
  if (!supabaseStorageConfigured()) throw new Error('Financial database unavailable');
  if (!Array.isArray(userIds) || userIds.length > 200 || userIds.some(function (id) { return typeof id !== 'string' || !id || id.length > 128; })) {
    throw new Error('Admin account identity list invalid');
  }
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/read_admin_account_balances_v1', {
    method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_user_ids: userIds })
  });
  if (!response.ok) throw new Error('Admin account balance read failed');
  const result = await response.json();
  if (!result || result.ok !== true || !result.accounts || typeof result.accounts !== 'object' || Array.isArray(result.accounts)) {
    throw new Error('Admin account balance response invalid');
  }
  for (const uid of Object.keys(result.accounts)) {
    const assets = result.accounts[uid];
    if (!userIds.includes(uid) || !assets || typeof assets !== 'object' || Array.isArray(assets)) throw new Error('Admin account balance response invalid');
    for (const asset of Object.keys(assets)) {
      // This UI currently supports only these ledger assets. Reject unexpected
      // asset keys rather than silently passing malformed/unsupported balances
      // into valuation and admin controls.
      if (!['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC'].includes(asset)) throw new Error('Admin account balance response invalid');
      const b = assets[asset];
      if (!b || !Number.isFinite(b.free) || !Number.isFinite(b.frozen) || b.free < 0 || b.frozen < 0) throw new Error('Admin account balance response invalid');
    }
  }
  // A user with no normalized account rows is a valid zero-balance account, not
  // a reason to leak stale legacy balances into a normalized-read response.
  // Return the same predictable asset shape the frontend expects.
  const normalized = {};
  for (const uid of userIds) normalized[uid] = Object.assign(emptyBalances(), result.accounts[uid] || {});
  return normalized;
}

async function readAdminWithdrawalSnapshot() {
  if (!supabaseStorageConfigured()) throw new Error('Financial database unavailable');
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/read_admin_withdrawal_snapshot_v1', {
    method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({})
  });
  if (!response.ok) throw new Error('Admin withdrawal read failed');
  const result = await response.json();
  if (!result || result.ok !== true || !Array.isArray(result.withdrawals) ||
      !Number.isSafeInteger(result.pending_count) || result.pending_count < 0) {
    throw new Error('Admin withdrawal response invalid');
  }
  return result;
}
function attachRevision(db, revision) {
  Object.defineProperty(db, '_revision', { value: Number(revision || 0), writable: true, configurable: true, enumerable: false });
  return db;
}
async function loadDB() {
  try {
    if (supabaseStorageConfigured()) {
      const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const response = await fetch(base + '/rest/v1/btcbox_state?select=revision,data&id=eq.main', { headers: supabaseHeaders() });
      if (!response.ok) throw new Error('Supabase state read failed');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Supabase state response invalid');
      if (rows.length > 1) throw new Error('Supabase state row is not unique');
      if (rows.length === 1 && rows[0] && rows[0].data && rows[0].data.users) {
        const data = JSON.parse(JSON.stringify(rows[0].data));
        mergeDepositAddresses(data);
        return attachRevision(data, rows[0].revision);
      }
      // Fail closed: never treat an empty Supabase table as a fresh exchange database.
      // This prevents accidental balance/history loss if secrets are configured before import.
      throw new Error('Supabase state is not initialized');
    }
    // Netlify Blobs has been retired. All persistent state must use Supabase.
    throw new Error('Supabase storage is required');
  } catch (e) {
    // Do not continue with a stale in-memory snapshot if persistent storage is unavailable.
    throw new Error('Persistent storage unavailable');
  }
}

async function saveDB(db) {
  try {
    if (supabaseStorageConfigured()) {
      const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const cleanData = JSON.parse(JSON.stringify(db)); // _revision is intentionally non-enumerable
      const response = await fetch(base + '/rest/v1/rpc/btcbox_save_state', {
        method: 'POST', headers: supabaseHeaders(),
        body: JSON.stringify({ p_expected_revision: Number(db._revision || 0), p_data: cleanData })
      });
      if (!response.ok) throw new Error('Supabase state write failed');
      const saved = await response.json();
      if (saved !== true) throw new Error('Persistent storage write conflict');
      db._revision = Number(db._revision || 0) + 1;
      return;
    }
    // Netlify Blobs has been retired. All persistent state must use Supabase.
    throw new Error('Supabase storage is required');
  } catch (e) {
    if (e && e.message === 'Persistent storage write conflict') throw e;
    throw new Error('Persistent storage write failed');
  }
}

// ===== 充值地址：仅从环境变量读取，fail-closed（绝不回退硬编码地址）=====
// 环境变量缺失或格式不匹配时返回空串，前端该币种充值显示"维护中"。
// 地址格式校验：0x 开头必须是 EVM 链（ETH/ERC20/BEP20），base58 必须是 SOL/TRX/BTC。
// 注意链归属标签：DEPOSIT_BNB（用户标注为 BNA）、DEPOSIT_SOL（用户标注为 SOLO）——请运营确认链归属后再配置。
const DEPOSIT_ADDRESS_PATTERNS = {
  "USDT-TRC20": /^T[1-9A-HJ-NP-Za-km-z]{33}$/,                        // TRON base58
  "USDT-ERC20": /^0x[a-fA-F0-9]{40}$/,                                 // EVM
  "USDT-BEP20": /^0x[a-fA-F0-9]{40}$/,                                 // EVM (BSC)
  "BTC-BTC": /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/, // Bitcoin bech32/P2PKH/P2SH
  "ETH-ERC20": /^0x[a-fA-F0-9]{40}$/,                                  // EVM
  "SOL-SOL": /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,                          // Solana base58（链归属请运营确认：用户标注 SOLO）
  "BNB-BEP20": /^0x[a-fA-F0-9]{40}$/,                                  // EVM (BSC)（链归属请运营确认：用户标注 BNA）
  "USDC-ERC20": /^0x[a-fA-F0-9]{40}$/,                                 // EVM（与 ETH 同地址）
};
const DEPOSIT_ADDRESS_ENV_KEYS = {
  "USDT-TRC20": "DEPOSIT_USDT_TRC20",
  "USDT-ERC20": "DEPOSIT_USDT_ERC20",
  "USDT-BEP20": "DEPOSIT_USDT_BEP20",
  "BTC-BTC": "DEPOSIT_BTC",
  "ETH-ERC20": "DEPOSIT_ETH",
  "SOL-SOL": "DEPOSIT_SOL",
  "BNB-BEP20": "DEPOSIT_BNB",
  "USDC-ERC20": "DEPOSIT_USDC_ERC20",
};
function depositAddressFromEnv(networkKey) {
  const envKey = DEPOSIT_ADDRESS_ENV_KEYS[networkKey];
  const raw = envKey ? String(process.env[envKey] || '').trim() : '';
  if (!raw) return ''; // fail-closed：未配置 → 维护中
  const pattern = DEPOSIT_ADDRESS_PATTERNS[networkKey];
  if (pattern && !pattern.test(raw)) {
    console.warn('[deposit-address] format mismatch for ' + networkKey + ' (env ' + envKey + '); showing maintenance (fail-closed).');
    return ''; // 格式不匹配 → 维护中，绝不展示错误链地址
  }
  return raw;
}
function defaultDB() {
  return {
    users: {},
    sessions: {},
    next_uid: 16588,
    deposit_addresses: {
      "USDT-TRC20": depositAddressFromEnv("USDT-TRC20"),
      "USDT-ERC20": depositAddressFromEnv("USDT-ERC20"),
      "USDT-BEP20": depositAddressFromEnv("USDT-BEP20"),
      "BTC-BTC": depositAddressFromEnv("BTC-BTC"),
      "ETH-ERC20": depositAddressFromEnv("ETH-ERC20"),
      "SOL-SOL": depositAddressFromEnv("SOL-SOL"),
      "BNB-BEP20": depositAddressFromEnv("BNB-BEP20"),
      "USDC-ERC20": depositAddressFromEnv("USDC-ERC20"),
    },
    captcha: {},
  };
}
// Fill any missing deposit-address keys from env so the deposit page always
// shows the configured addresses even when the stored row has an empty map.
// 缺失的键以空串填充（fail-closed，前端显示维护中），绝不回退硬编码地址。
function mergeDepositAddresses(db) {
  const defaults = defaultDB().deposit_addresses;
  db.deposit_addresses = db.deposit_addresses || {};
  Object.keys(defaults).forEach(function (k) {
    if (!db.deposit_addresses[k]) db.deposit_addresses[k] = defaults[k];
  });
}

// ===== 工具函数 =====
function hashPassword(pwd, salt) {
  return crypto.pbkdf2Sync(pwd, salt, PBKDF2_ITER, PBKDF2_KEYLEN, 'sha256').toString('hex');
}
function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function hashFundPassword(pwd, salt) {
  return crypto.pbkdf2Sync(String(pwd), salt, PBKDF2_ITER, PBKDF2_KEYLEN, 'sha256').toString('hex');
}
function verifyFundPassword(user, supplied) {
  if (!user || typeof supplied !== 'string') return false;
  // Financial routes must not mutate legacy state as a side effect of a balance
  // operation. Legacy plaintext records must be replaced through the authenticated
  // security-settings flow before they can authorize a withdrawal.
  if (!user.fund_password_hash || !user.fund_password_salt) return false;
  const actual = Buffer.from(hashFundPassword(supplied, user.fund_password_salt), 'hex');
  const expected = Buffer.from(String(user.fund_password_hash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }
function nowStr() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
// ===== 速率限制（内存滑动窗口；单实例内有效，降低暴力破解风险）=====
const _rateBuckets = new Map();
function clientIp(event) {
  const h = event.headers || {};
  return String(h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || h['X-Forwarded-For'] || 'unknown').split(',')[0].trim();
}
function rateCheck(key, max, windowMs) {
  const now = Date.now();
  let b = _rateBuckets.get(key);
  if (!b || b.resetAt <= now) { b = { count: 0, resetAt: now + windowMs }; _rateBuckets.set(key, b); }
  b.count += 1;
  if (b.count > max) {
    const retryAfter = Math.ceil((b.resetAt - now) / 1000);
    return { limited: true, retryAfter: retryAfter };
  }
  if (_rateBuckets.size > 5000) { const cutoff = now; for (const [k, v] of _rateBuckets) { if (v.resetAt <= cutoff) _rateBuckets.delete(k); } }
  return { limited: false };
}
function rateLimitedJson(retryAfter) {
  return json({ ok: false, code: 'RATE_LIMITED', msg: 'Too many requests. Please try again later.', retry_after: retryAfter }, 429, { 'Retry-After': String(retryAfter) });
}

// ===== 资金密码强度（≥8 位，必须同时含字母和数字）=====
function validateFundPassword(pwd) {
  if (typeof pwd !== 'string') return { ok: false, msg: 'Fund password is required.' };
  if (pwd.length < 8) return { ok: false, msg: 'Fund password must be at least 8 characters.' };
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) return { ok: false, msg: 'Fund password must contain both letters and digits.' };
  if (/\s/.test(pwd)) return { ok: false, msg: 'Fund password must not contain whitespace.' };
  return { ok: true };
}
// ===== 管理员密码强度（≥12 位，必须含大小写字母+数字+符号）；弱密码拒绝启动 =====
function validateAdminPasswordStrength(pass) {
  if (typeof pass !== 'string' || pass.length < 12) return false;
  if (!/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/\d/.test(pass) || !/[^A-Za-z0-9]/.test(pass)) return false;
  const weakList = ['admin123', 'password', 'changeme', 'admin123456', 'Admin123!', 'P@ssw0rd123'];
  if (weakList.indexOf(pass.toLowerCase()) >= 0) return false;
  return true;
}
// 启动时（冷启动模块加载）校验 ADMIN_PASS 强度；弱密码直接抛错拒绝启动。
// 未设置 ADMIN_PASS 时管理后台不可用但不阻止启动。
(function adminPassStartupCheck() {
  const p = process.env.ADMIN_PASS;
  if (p && !validateAdminPasswordStrength(p)) {
    console.error('[admin-auth] startup blocked: ADMIN_PASS is too weak (require >=12 chars with upper/lower case, digit and symbol). Refusing to start.');
    throw new Error('ADMIN_PASS_TOO_WEAK');
  }
})();

// ===== 持久化安全计数器（纯函数，操作普通 counters 对象；由调用方写入 btcbox_state 持久化）=====
// 关键路径（登录/资金密码/admin）的失败计数持久化到 btcbox_state.security_counters，
// 跨 serverless 实例共享，避免内存 Map 在冷启动后清零导致暴力破解绕过。
// counters 形如 { "fundpwd_lock:<uid>": {count, locked_until}, "admin_fail:<ip>": {count, locked_until}, "login_fail:<uid>": {count, locked_until} }
function secCounterIsLocked(counters, key, now) {
  const c = counters && counters[key];
  if (c && c.locked_until && c.locked_until > now) return { locked: true, retryAfter: Math.ceil((c.locked_until - now) / 1000) };
  return { locked: false };
}
function secCounterRecordFailure(counters, key, maxFailures, lockMs, now) {
  if (!counters[key] || (counters[key].locked_until && counters[key].locked_until <= now)) counters[key] = { count: 0, locked_until: 0 };
  const c = counters[key];
  c.count = (c.count || 0) + 1;
  if (c.count >= maxFailures) { c.locked_until = now + lockMs; c.count = maxFailures; }
  return c;
}
function secCounterReset(counters, key) { if (counters && counters[key]) delete counters[key]; }

// Normalize database settlement business errors without hiding idempotency conflicts.
function secondsSettlementError(result, rpcStatus) {
  const code = result && typeof result.code === 'string' ? result.code : 'FINANCIAL_RPC_FAILED';
  const known = {
    INVALID_ARGUMENT: { status: 400, msg: 'Settlement request is invalid.' },
    POSITION_NOT_FOUND: { status: 404, msg: 'This position was not found.' },
    SYMBOL_MISMATCH: { status: 409, msg: 'The position symbol does not match.' },
    IDEMPOTENCY_CONFLICT: { status: 409, msg: 'This settlement request ID was already used with different parameters.' },
    POSITION_ALREADY_SETTLED: { status: 409, msg: 'This position has already been settled by a different request. Refresh your positions.' },
    SETTLEMENT_PRICE_BEFORE_MATURITY: { status: 409, msg: 'The settlement price timestamp is before position maturity.' },
    FROZEN_BALANCE_INVARIANT: { status: 503, msg: 'Settlement could not be completed because the reserved balance is inconsistent.' }
  };
  const mapped = known[code];
  if (mapped) return { code: code, status: mapped.status, msg: mapped.msg };
  return {
    code: code,
    status: rpcStatus === 400 ? 400 : 503,
    msg: 'The database did not confirm settlement. Please try again later.'
  };
}

// ===== 提现白名单+冷却校验（纯函数）=====
// ①提现地址必须在用户已绑定地址列表内（未绑定→拒绝）；②新绑定地址冷却期内禁止提现。
// bound_at 取地址记录的 created_at（格式 'YYYY-MM-DD HH:MM:SS'）。
function withdrawalAddressCheck(user, addr, coin, network, now, cooldownMs) {
  const list = Array.isArray(user && user.addresses) ? user.addresses : [];
  const bound = list.find(function (a) { return a && a.type === 'crypto' && a.address === addr && a.coin === coin && a.network === network; });
  if (!bound) return { allowed: false, code: 'ADDRESS_NOT_BOUND', msg: 'Withdrawal address must be added and verified in your address book first.' };
  if (bound.blocked || bound.unbound) return { allowed: false, code: 'ADDRESS_BLOCKED', msg: 'This withdrawal address is not available.' };
  const boundAt = Date.parse(String(bound.created_at || '').replace(' ', 'T') + 'Z');
  if (Number.isFinite(boundAt) && (now - boundAt) < cooldownMs) {
    const hours = Math.ceil((cooldownMs - (now - boundAt)) / 3600000);
    return { allowed: false, code: 'ADDRESS_COOLDOWN', msg: 'Newly bound withdrawal address is in cooldown. Please try again in about ' + hours + ' hour(s).' };
  }
  return { allowed: true, bound: bound };
}
// 首次提现（历史无成功提现）或大额（USDT 等值超阈值）→ 强制人工审核 pending_admin_review。
function withdrawalRequiresAdminReview(user, coin, amount, usdtValue, thresholdUsdt) {
  const history = Array.isArray(user && user.withdrawals) ? user.withdrawals : [];
  const hasSuccess = history.some(function (w) { return w && (w.status === 'completed' || w.status === 'success' || w.status === 'approved' || w.status === 'broadcast'); });
  if (!hasSuccess) return true;
  if (Number.isFinite(usdtValue) && usdtValue > thresholdUsdt) return true;
  return false;
}
// 估算提现金额的 USDT 等值；价格不可用时返回 null（调用方应保守视为大额，强制审核）。
function estimateUsdtValue(coin, amount, prices) {
  if (coin === 'USDT' || coin === 'USDC') return amount;
  const p = prices && prices[coin + 'USDT'];
  if (p && Number.isFinite(Number(p))) return amount * Number(p);
  return null;
}
// All API status messages are natively English. User-authored content and data
// fields are intentionally left untouched. The response boundary no longer needs
// a CJK normalization pass; json() serializes the object as-is.
function normalizeApiMessages(value) {
  return value;
}
function json(obj, status, headers) {
  const normalized = normalizeApiMessages(obj);
  return {
    statusCode: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' }, corsHeaders(_currentEvent), headers || {}),
    body: JSON.stringify(normalized),
  };
}
function parseCookies(event) {
  const out = {};
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  raw.split(';').forEach(function (s) {
    const p = s.trim().split('=');
    if (p.length === 2) out[p[0]] = p[1];
  });
  return out;
}
function setCookieHeader(token, maxAge) {
  const secure = process.env.CONTEXT === 'dev' ? '' : '; Secure';
  return { 'Set-Cookie': SESSION_COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax' + secure + '; Max-Age=' + (maxAge || 86400 * 7) };
}
function clearCookieHeader() {
  const secure = process.env.CONTEXT === 'dev' ? '' : '; Secure';
  return { 'Set-Cookie': SESSION_COOKIE + '=; Path=/; HttpOnly; SameSite=Lax' + secure + '; Max-Age=0' };
}
function getSessionRecord(db, event) {
  const cookies = parseCookies(event);
  const token = cookies[SESSION_COOKIE];
  const session = token && db.sessions[token];
  if (!session) return null;
  const createdAt = Number(session.created_at);
  if (!Number.isFinite(createdAt) || createdAt <= 0 || Date.now() - createdAt > SESSION_MAX_AGE_MS) return null;
  const user = db.users[session.uid] || null;
  return user ? { token: token, session: session, user: user } : null;
}
function getUser(db, event) {
  const record = getSessionRecord(db, event);
  return record ? record.user : null;
}
function emptyBalances() {
  return {
    USDT: { free: 0, frozen: 0 },
    BTC: { free: 0, frozen: 0 },
    ETH: { free: 0, frozen: 0 },
    SOL: { free: 0, frozen: 0 },
    BNB: { free: 0, frozen: 0 },
    USDC: { free: 0, frozen: 0 },
  };
}
function safeDepositAddresses(addresses) {
  const source = addresses && typeof addresses === 'object' && !Array.isArray(addresses) ? addresses : {};
  const result = {};
  const legacyKeys = { 'BTC-BTC': 'BTC-Bitcoin', 'SOL-SOL': 'SOL-Solana' };
  for (const key of ['USDT-TRC20', 'USDT-ERC20', 'USDT-BEP20', 'BTC-BTC', 'ETH-ERC20', 'SOL-SOL', 'BNB-BEP20', 'USDC-ERC20']) {
    const legacyKey = legacyKeys[key];
    let raw = source[key];
    if ((typeof raw !== 'string' || !raw.trim()) && legacyKey) raw = source[legacyKey];
    const value = typeof raw === 'string' ? raw.trim() : '';
    result[key] = value && !/PLACEHOLDER/i.test(value) ? value : '';
  }
  return result;
}
function totalUsdt(balances, prices) {
  let total = balances.USDT ? (balances.USDT.free + balances.USDT.frozen) : 0;
  const p = prices && typeof prices === 'object' ? prices : {};
  Object.keys(balances || {}).forEach(function (coin) {
    if (coin === 'USDT') return;
    const balance = balances[coin];
    const price = Number(p[coin]);
    // Never invent a valuation from hard-coded historical prices.
    if (balance && Number.isFinite(price) && price > 0) total += (Number(balance.free || 0) + Number(balance.frozen || 0)) * price;
  });
  return total;
}

async function getLiveUsdtPrices(requestedBases) {
  const bases = Array.from(new Set((requestedBases || []).filter(x => /^[A-Z0-9]{2,12}$/.test(x) && x !== 'USDT'))).sort();
  if (!bases.length) return {};
  const now = Date.now();
  if (livePriceCache.expiresAt > now && bases.every(base => Number.isFinite(livePriceCache.prices[base]) && livePriceCache.prices[base] > 0)) {
    return Object.fromEntries(bases.map(base => [base, livePriceCache.prices[base]]));
  }
  const prices = Object.assign({}, livePriceCache.prices);
  const fetchJson = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Live price provider unavailable');
    return response.json();
  };
  let missing = bases.slice();
  try {
    const products = await fetchJson('https://api.exchange.coinbase.com/products');
    if (!Array.isArray(products)) throw new Error('Invalid Coinbase products');
    const enabled = new Set(products.filter(p => p && p.quote_currency === 'USDT' && p.status === 'online' && p.trading_disabled !== true).map(p => p.id));
    await Promise.all(bases.map(async base => {
      const product = base + '-USDT';
      if (!enabled.has(product)) return;
      try {
        const stats = await fetchJson('https://api.exchange.coinbase.com/products/' + encodeURIComponent(product) + '/stats');
        const price = Number(stats.last);
        if (Number.isFinite(price) && price > 0) prices[base] = price;
      } catch (_) {}
    }));
    missing = bases.filter(base => !(Number.isFinite(prices[base]) && prices[base] > 0));
  } catch (_) { missing = bases.filter(base => !(Number.isFinite(prices[base]) && prices[base] > 0)); }
  if (missing.length) {
    try {
      const payload = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot');
      const rows = payload && payload.result && payload.result.list;
      if (Array.isArray(rows)) {
        const map = new Map(rows.filter(row => row && /USDT$/.test(row.symbol || '')).map(row => [row.symbol.slice(0, -4), Number(row.lastPrice)]));
        missing.forEach(base => { const price = map.get(base); if (Number.isFinite(price) && price > 0) prices[base] = price; });
      }
    } catch (_) {}
  }
  livePriceCache = { expiresAt: Date.now() + LIVE_PRICE_CACHE_MS, prices: prices };
  return Object.fromEntries(bases.filter(base => Number.isFinite(prices[base]) && prices[base] > 0).map(base => [base, prices[base]]));
}

// ===== TOTP (2FA) =====
function base32Decode(s) {
  const map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  for (let i = 0; i < s.length; i++) bits += map.indexOf(s[i]).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpVerify(secret, code) {
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    for (let offset = -1; offset <= 1; offset++) {
      const buf = Buffer.alloc(8);
      buf.writeBigInt64BE(BigInt(counter + offset));
      const hmac = crypto.createHmac('sha1', key).update(buf).digest();
      const o = hmac[hmac.length - 1] & 0x0f;
      const binCode = ((hmac[o] & 0x7f) << 24) | (hmac[o + 1] << 16) | (hmac[o + 2] << 8) | hmac[o + 3];
      const expected = (binCode % 1000000).toString().padStart(6, '0');
      if (expected === code) return true;
    }
  } catch (e) { }
  return false;
}
// Parse user-supplied financial amounts strictly; parseFloat('1abc') must never become 1.
// Return a masked identity number for ordinary account responses.
// Full KYC identifiers remain server-side and are never serialized to the user API.
function validateKycSubmission(body) {
  const name = String(body && body.name || '').trim();
  const idType = String(body && body.id_type || 'id_card').trim();
  const idNumber = String(body && body.id_number || '').trim();
  if (name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) {
    return { ok: false, msg: 'Enter a valid full name (2–100 characters).' };
  }
  if (!['passport', 'id_card', 'driver_license'].includes(idType)) {
    return { ok: false, msg: 'Select a supported identity document type.' };
  }
  if (idNumber.length < 4 || idNumber.length > 64 || /[\x00-\x1f\x7f]/.test(idNumber)) {
    return { ok: false, msg: 'Enter a valid document number (4–64 characters).' };
  }
  return { ok: true, name, id_type: idType, id_number: idNumber };
}

function maskIdentityNumber(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '*'.repeat(raw.length);
  return '*'.repeat(Math.max(4, raw.length - 4)) + raw.slice(-4);
}

function parseMoneyInput(value) {
  // 仅接受 string（服务端解析为精确数值）；拒绝 number 类型，避免 JS 浮点精度污染金额。
  if (typeof value === 'number') return null;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function genTotpSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let s = '';
  const random = crypto.randomBytes(16);
  for (let i = 0; i < random.length; i++) s += chars[random[i] & 31];
  return s;
}

// ===== 路由 =====
async function handleRequest(event, context) {
  _currentEvent = event;
  // Vercel catch-all receives /api/<route>; normalize to the shared route name.
  let path = event.path || '';
  path = path.replace(/^\/api\/?/, '');
  const method = event.httpMethod || 'GET';
  // CORS 预检：直接返回 204，不解析 body、不读 DB。
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(event), body: '' };
  }
  try {
  // Public, read-only deployment preflight. Reports booleans only; never returns keys or secrets.
  // Keep this before loadDB so Auth can be diagnosed even if financial persistence is unavailable.
  if (path === 'auth-health' && method === 'GET') {
    const authUrl = String(process.env.SUPABASE_AUTH_URL || '').replace(/\/+$/, '');
    const authKey = getPublishableKey();
    const expectedAuthUrl = 'https://zlozsutefnmgwwzrlipt.supabase.co';
    const configured = Boolean(authUrl && authKey);
    const projectMatches = authUrl === expectedAuthUrl;
    const googleEnabled = configured ? await detectGoogleProviderEnabled() : false;
    return json({
      ok: configured && projectMatches,
      service: 'btcbox-auth-preflight',
      auth_environment_configured: configured,
      auth_project_matches_expected: projectMatches,
      google_enabled: googleEnabled,
      provider_enabled: googleEnabled,
      provider_enabled_note: googleEnabled === null
        ? 'Google provider status could not be determined (Supabase settings endpoint unreachable).'
        : (googleEnabled ? 'Google provider is enabled in Supabase Auth.' : 'Google provider is disabled in Supabase Auth.'),
      live_oauth_tested: googleEnabled === true
    }, configured && projectMatches ? 200 : 503);
  }
  let body = {};
  if (event.body !== undefined && event.body !== null && event.body !== '') {
    let rawBody;
    try {
      rawBody = event.isBase64Encoded
        ? Buffer.from(String(event.body), 'base64').toString('utf8')
        : String(event.body);
    } catch (e) {
      return json({ ok: false, msg: 'Invalid request format.', code: 'INVALID_REQUEST_BODY' }, 400);
    }
    // Bound parsing cost and memory use for all API endpoints.
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) {
      return json({ ok: false, msg: 'Request body too large.', code: 'REQUEST_BODY_TOO_LARGE' }, 413);
    }
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return json({ ok: false, msg: 'Request body is not valid JSON', code: 'INVALID_JSON' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ ok: false, msg: 'Request body must be a JSON object.', code: 'INVALID_JSON_OBJECT' }, 400);
    }
  }

  let db;
  try { db = await loadDB(); } catch(e) { return json({ ok: false, msg: 'Network error. Please try again.', code: 'PERSISTENCE_UNAVAILABLE' }, 503); }
  if (!db) return json({ ok: false, msg: 'Network error. Please try again.', code: 'PERSISTENCE_UNAVAILABLE' }, 503);

  // ---------- GET /api/config ----------
  if (path === 'config' && method === 'GET') {
    return json({
      ok: true,
      google_mock_enabled: process.env.ALLOW_GOOGLE_MOCK === '1',
      site: { name: 'BTCBOX', version: 'vercel-1.0' },
      announcement: db.announcement || '',
      supabase_auth_url: String(process.env.SUPABASE_AUTH_URL || '').trim(),
      supabase_auth_publishable_key: getPublishableKey(),
    });
  }

  // ---------- POST /api/captcha ----------
  if (path === 'captcha' && method === 'POST') {
    // Never disclose a challenge answer in a public API response. This legacy
    // endpoint has no configured delivery provider, so fail closed rather than
    // pretending that a client-readable code is bot protection.
    return json({ ok: false, code: 'VERIFICATION_UNAVAILABLE', msg: 'Verification is temporarily unavailable. Please try again later.' }, 503);
  }

  // ---------- POST /api/register — disabled: BTCBOX uses Google-only Supabase identity ----------
  if (path === 'register' && method === 'POST') {
    return json({ ok: false, code: 'GOOGLE_ONLY_AUTH', msg: 'Please create your BTCBOX account with Google sign-in.' }, 403);
  }

  // ---------- POST /api/login — disabled: BTCBOX uses Google-only Supabase identity ----------
  if (path === 'login' && method === 'POST') {
    return json({ ok: false, code: 'GOOGLE_ONLY_AUTH', msg: 'Please sign in with Google.' }, 403);
  }

  // ---------- POST /api/supabase-login (Supabase-verified Google OAuth only) ----------
  if ((path === 'supabase-login' || path === 'google-login') && method === 'POST') {
    // 登录路径持久化限流（按 IP，20 次/15 分钟），计数存 btcbox_state，跨实例共享。
    if (!db.security_counters) db.security_counters = {};
    const loginKey = 'login_ip:' + clientIp(event);
    const loginRl = secCounterIsLocked(db.security_counters, loginKey, Date.now());
    if (loginRl.locked) return rateLimitedJson(loginRl.retryAfter);
    secCounterRecordFailure(db.security_counters, loginKey, 20, 15 * 60 * 1000, Date.now());
    try { await saveDB(db); } catch (e) { console.warn('[login-rl] persist failed (best-effort):', e.message); }
    const accessToken = typeof body.supabase_access_token === 'string' ? body.supabase_access_token : '';
    const supabaseUrl = String(process.env.SUPABASE_AUTH_URL || '').replace(/\/$/, '');
    const supabaseKey = getPublishableKey();
    if (!supabaseUrl || !supabaseKey) {
      return json({ ok: false, msg: 'Authentication service is not configured on the server.' }, 503);
    }
    const googleEnabled = await detectGoogleProviderEnabled();
    if (googleEnabled !== true) {
      return json({ ok: false, code: 'GOOGLE_PROVIDER_UNAVAILABLE', msg: 'Google sign-in is temporarily unavailable. Please try again later.' }, 503);
    }
    if (!accessToken || accessToken.length > 16384) {
      return json({ ok: false, msg: 'Invalid session. Please sign in again.' }, 401);
    }
    let identity;
    try {
      const verifyResponse = await fetch(supabaseUrl + '/auth/v1/user', {
        method: 'GET',
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' }
      });
      if (!verifyResponse.ok) return json({ ok: false, msg: 'Session verification failed. Please try again.' }, 401);
      identity = await verifyResponse.json();
    } catch (e) {
      return json({ ok: false, msg: 'Authentication service temporarily unavailable. Please try again later.' }, 503);
    }
    const email = String(identity && identity.email || '').trim().toLowerCase();
    const confirmed = !!(identity && (identity.email_confirmed_at || identity.confirmed_at));
    const supabaseUserId = String(identity && identity.id || '').trim();
    if (!isValidAuthEmail(email) || !confirmed || !isSupabaseUserId(supabaseUserId)) {
      return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'The verified Google account could not be confirmed. Please sign in again.' }, 403);
    }
    if (!isGoogleOnlySupabaseIdentity(identity)) {
      return json({ ok: false, code: 'GOOGLE_ONLY_AUTH', msg: 'Please use a Google account to sign in to BTCBOX.' }, 403);
    }
    const authProviders = ['google'];
    let user = Object.values(db.users).find(function (u) { return String(u.email || '').trim().toLowerCase() === email; });
    if (user && String(user.supabase_user_id || '') !== supabaseUserId) {
      return json({ ok: false, code: user.supabase_user_id ? 'SUPABASE_IDENTITY_MISMATCH' : 'SUPABASE_IDENTITY_LINK_REQUIRED', msg: 'This email is already associated with another BTCBOX identity. Please contact support.' }, 409);
    }
    if (user && user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    // Preserve the existing account's second factor for Google sign-ins.
    // The temporary token can only be exchanged through /api/login/2fa and never creates a session by itself.
    if (user && user.twofa_enabled) {
      const tempToken = genToken();
      db.temp_tokens = db.temp_tokens || {};
      db.temp_tokens[tempToken] = { uid: user.uid, exp: Date.now() + 10 * 60 * 1000 };
      secCounterReset(db.security_counters, loginKey);
      await saveDB(db);
      return json({ ok: false, require_2fa: true, temp_token: tempToken }, 200);
    }
    if (!user) {
      const uid = String(db.next_uid++);
      const salt = genSalt();
      user = {
        uid: uid, email: email, email_verified: true, supabase_user_id: supabaseUserId, auth_providers: authProviders, addresses: [], address_audit: [],
        password_hash: hashPassword(genToken(), salt), salt: salt,
        fund_password: '', twofa_secret: '', twofa_enabled: false,
        kyc: { status: 'unsubmitted', name: '', id_type: 'id_card', id_number: '', submitted_at: '' },
        balances: emptyBalances(), orders: [], deposits: [], withdrawals: [], earn_records: [], support_messages: [],
        created_at: nowStr(), last_login: nowStr(),
      };
      db.users[uid] = user;
    } else {
      user.email_verified = true;
      user.auth_providers = Array.from(new Set([].concat(user.auth_providers || [], authProviders)));
    }
    user.last_login = nowStr();
    const token = genToken();
    db.sessions[token] = { uid: user.uid, email: email, created_at: Date.now() };
    secCounterReset(db.security_counters, loginKey);
    await saveDB(db);
    return json({ ok: true, uid: user.uid }, 200, setCookieHeader(token));
  }

  // ---------- POST /api/logout ----------
  if (path === 'logout' && method === 'POST') {
    const cookies = parseCookies(event);
    const token = cookies[SESSION_COOKIE];
    if (token) delete db.sessions[token];
    await saveDB(db);
    return json({ ok: true }, 200, clearCookieHeader());
  }

  // ---------- POST /api/login/2fa（两步验证第二步） ----------
  if (path === 'login/2fa' && method === 'POST') {
    const tt = body.temp_token || '';
    const code = body.code || '';
    db.temp_tokens = db.temp_tokens || {};
    const rec = db.temp_tokens[tt];
    if (!rec || rec.exp < Date.now()) return json({ ok: false, msg: 'Session expired. Please sign in again.' });
    const u2 = db.users[rec.uid];
    if (!u2) return json({ ok: false, msg: 'User not found.' });
    if (u2.frozen) { delete db.temp_tokens[tt]; await saveDB(db); return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403); }
    { const rl = rateCheck('2fa:' + u2.uid, 20, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!totpVerify(u2.twofa_secret, code)) return json({ ok: false, msg: 'Invalid 2FA code.' });
    delete db.temp_tokens[tt];
    u2.last_login = nowStr();
    const token2 = genToken();
    db.sessions[token2] = { uid: u2.uid, email: u2.email, created_at: Date.now() };
    await saveDB(db);
    return json({ ok: true }, 200, setCookieHeader(token2));
  }

  // ---------- GET /api/kline (Coinbase primary, Bybit fallback) ----------
  if (path === 'kline' && method === 'GET') {
    const symbol = ((event.queryStringParameters && event.queryStringParameters.symbol) || 'BTCUSDT').toUpperCase();
    const interval = (event.queryStringParameters && event.queryStringParameters.interval) || '1m';
    if (!/^[A-Z0-9]{5,20}$/.test(symbol) || !symbol.endsWith('USDT') || symbol.length <= 4 || !['1m','3m','5m','15m','30m','1h','2h','4h','1d'].includes(interval)) return json({ ok: false, msg: 'Invalid USDT symbol or interval' }, 400);
    const base = symbol.slice(0, -4);
    const coinbaseGranularity = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[interval];
    const timeoutFetchJson = async url => {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('market provider HTTP ' + res.status);
      return res.json();
    };
    if (coinbaseGranularity) {
      try {
        const rows = await timeoutFetchJson('https://api.exchange.coinbase.com/products/' + encodeURIComponent(base + '-USDT') + '/candles?granularity=' + coinbaseGranularity);
        if (!Array.isArray(rows)) throw new Error('invalid Coinbase candles');
        const raw = rows.filter(k => Array.isArray(k) && k.length >= 6 && k.slice(0, 6).every(v => Number.isFinite(Number(v))))
          .map(k => [Number(k[0]) * 1000, Number(k[3]), Number(k[2]), Number(k[1]), Number(k[4]), Number(k[5])])
          .sort((a, b) => a[0] - b[0]);
        if (raw.length) return json({ ok: true, source: 'coinbase', klines: raw.map(k => ({ time: k[0], open: k[1], high: k[2], low: k[3], close: k[4], volume: k[5] })), data: raw });
      } catch (_) { /* Try Bybit below; never synthesize candle values. */ }
    }
    try {
      const intervalBybit = { '1m':'1', '3m':'3', '5m':'5', '15m':'15', '30m':'30', '1h':'60', '2h':'120', '4h':'240', '1d':'D' }[interval];
      const payload = await timeoutFetchJson('https://api.bybit.com/v5/market/kline?category=spot&symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(intervalBybit) + '&limit=100');
      const rows = payload && payload.result && payload.result.list;
      if (!Array.isArray(rows)) throw new Error('invalid Bybit candles');
      const raw = rows.filter(k => Array.isArray(k) && k.length >= 6 && k.slice(0, 6).every(v => Number.isFinite(Number(v))))
        .map(k => [Number(k[0]), Number(k[1]), Number(k[2]), Number(k[3]), Number(k[4]), Number(k[5])])
        .sort((a, b) => a[0] - b[0]);
      if (!raw.length) throw new Error('empty Bybit candles');
      return json({ ok: true, source: 'bybit', klines: raw.map(k => ({ time: k[0], open: k[1], high: k[2], low: k[3], close: k[4], volume: k[5] })), data: raw });
    } catch (_) { return json({ ok: false, code: 'KLINE_DATA_UNAVAILABLE', msg: 'K-line data unavailable.', klines: [], data: [] }, 503); }
  }

  // ---------- GET /api/depth (Coinbase primary, Bybit fallback) ----------
  if (path === 'depth' && method === 'GET') {
    const symbol = ((event.queryStringParameters && event.queryStringParameters.symbol) || 'BTCUSDT').toUpperCase();
    if (!/^[A-Z0-9]{5,20}$/.test(symbol) || !symbol.endsWith('USDT') || symbol.length <= 4) return json({ ok: false, msg: 'Invalid USDT symbol' }, 400);
    const base = symbol.slice(0, -4);
    const timeoutFetchJson = async url => {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('market provider HTTP ' + res.status);
      return res.json();
    };
    try {
      const book = await timeoutFetchJson('https://api.exchange.coinbase.com/products/' + encodeURIComponent(base + '-USDT') + '/book?level=2');
      if (!Array.isArray(book.bids) || !Array.isArray(book.asks)) throw new Error('invalid Coinbase order book');
      return json({ ok: true, source: 'coinbase', bids: book.bids.slice(0, 20).map(x => [String(x[0]), String(x[1])]), asks: book.asks.slice(0, 20).map(x => [String(x[0]), String(x[1])]) });
    } catch (_) {
      try {
        const payload = await timeoutFetchJson('https://api.bybit.com/v5/market/orderbook?category=spot&symbol=' + encodeURIComponent(symbol) + '&limit=20');
        const book = payload && payload.result;
        if (!book || !Array.isArray(book.b) || !Array.isArray(book.a)) throw new Error('invalid Bybit order book');
        return json({ ok: true, source: 'bybit', bids: book.b.slice(0, 20), asks: book.a.slice(0, 20) });
      } catch (_) { return json({ ok: false, code: 'DEPTH_DATA_UNAVAILABLE', msg: 'Order book data unavailable.', bids: [], asks: [] }, 503); }
    }
  }

  // ---------- 以下接口需要登录 ----------
  const user = getUser(db, event);

  // ---------- POST /api/2fa/enable ----------
  // Never disclose an already-enabled TOTP secret to a session-only caller.
  // Local-password accounts must re-enter that password; OAuth/magic-link accounts
  // must have signed in within the last five minutes before starting enrollment.
  if (path === '2fa/enable' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.twofa_enabled) return json({ ok: false, code: 'TWOFA_ALREADY_ENABLED', msg: 'Two-factor authentication is already enabled.' }, 409);
    if (Array.isArray(user.auth_providers) && user.auth_providers.length) {
      const sessionRecord = getSessionRecord(db, event);
      const createdAt = Number(sessionRecord && sessionRecord.session && sessionRecord.session.created_at);
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > 5 * 60 * 1000) {
        return json({ ok: false, code: 'REAUTH_REQUIRED', msg: 'Please sign in again before enabling two-factor authentication.' }, 403);
      }
    } else {
      { const rl = rateCheck('2fa-setup-password:' + user.uid, 10, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
      const currentPassword = String(body.current_password || '');
      if (!currentPassword || hashPassword(currentPassword, user.salt) !== user.password_hash) return json({ ok: false, code: 'REAUTH_FAILED', msg: 'The current login password is incorrect.' }, 403);
    }
    if (!user.twofa_secret) user.twofa_secret = genTotpSecret();
    await saveDB(db);
    return json({ ok: true, secret: user.twofa_secret, enabled: false });
  }
  // ---------- POST /api/2fa/confirm ----------
  if (path === '2fa/confirm' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.twofa_enabled) return json({ ok: false, code: 'TWOFA_ALREADY_ENABLED', msg: 'Two-factor authentication is already enabled.' }, 409);
    if (!user.twofa_secret) return json({ ok: false, code: 'TWOFA_SETUP_REQUIRED', msg: 'Please start the two-factor authentication setup first.' }, 400);
    { const rl = rateCheck('2fa-setup-confirm:' + user.uid, 10, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!totpVerify(user.twofa_secret, String(body.code || ''))) return json({ ok: false, msg: 'Invalid verification code.' }, 403);
    user.twofa_enabled = true;
    await saveDB(db);
    return json({ ok: true, msg: 'Two-factor authentication enabled.' });
  }
  // ---------- POST /api/2fa/disable ----------
  if (path === '2fa/disable' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (!user.twofa_enabled || !user.twofa_secret) return json({ ok: false, code: 'TWOFA_NOT_ENABLED', msg: 'Two-factor authentication is not enabled.' }, 409);
    { const rl = rateCheck('2fa-disable:' + user.uid, 10, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!totpVerify(user.twofa_secret, String(body.code || ''))) return json({ ok: false, msg: 'Invalid verification code.' }, 403);
    user.twofa_enabled = false;
    user.twofa_secret = ''; // Rotate the secret on next enrollment; do not retain a disabled factor.
    await saveDB(db);
    return json({ ok: true, msg: 'Two-factor authentication disabled.' });
  }

  // ---------- GET /api/withdrawals — authoritative withdrawal status/history ----------
  if (path === 'withdrawals' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (!financialPostgresReadsEnabled()) return json({ ok: false, code: 'FINANCIAL_READ_UNAVAILABLE', msg: 'Withdrawal history is temporarily unavailable.' }, 503);
    try {
      const response = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/read_withdrawal_history_v1', {
        method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_user_id: String(user.uid) })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.ok !== true || !Array.isArray(result.withdrawals)) {
        return json({ ok: false, code: 'FINANCIAL_READ_UNAVAILABLE', msg: 'Withdrawal history is temporarily unavailable.' }, 503);
      }
      return json({ ok: true, withdrawals: result.withdrawals });
    } catch (e) {
      return json({ ok: false, code: 'FINANCIAL_READ_UNAVAILABLE', msg: 'Withdrawal history is temporarily unavailable.' }, 503);
    }
  }

  // ---------- GET /api/account ----------
  if (path === 'account' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    let financialSnapshot = null;
    if (financialPostgresReadsEnabled()) {
      try { financialSnapshot = await readFinancialAccountSnapshot(user.uid); }
      catch (e) { return json({ ok: false, msg: 'Financial account temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
    }
    // 兼容前端旧字段：每个币种补 amount(=free) / usdt(估值)，返回 total_usdt 别名
    const compatBalances = {};
    const accountBalances = financialSnapshot ? financialSnapshot.balances : user.balances;
    let livePrices = {};
    try { livePrices = await getLiveUsdtPrices(Object.keys(accountBalances)); } catch (_) { livePrices = {}; }
    const unpricedAssets = [];
    Object.keys(accountBalances).forEach(function (c) {
      const b = accountBalances[c];
      const price = c === 'USDT' ? 1 : (Number(livePrices[c]) || 0);
      if (c !== 'USDT' && (Number(b.free || 0) + Number(b.frozen || 0)) > 0 && price <= 0) unpricedAssets.push(c);
      compatBalances[c] = { free: b.free, frozen: b.frozen, amount: b.free, usdt: (b.free + b.frozen) * price, valuation_available: c === 'USDT' || price > 0 };
    });
    const total = totalUsdt(accountBalances, livePrices);
    return json({
      ok: true,
      uid: user.uid, email: user.email,
      // Do not serialize the full identity number to an ordinary user session.
      // Keep the existing id_number field for UI compatibility, but expose only its masked form.
      kyc: {
        status: user.kyc && user.kyc.status || 'unsubmitted',
        name: user.kyc && user.kyc.name || '',
        id_type: user.kyc && user.kyc.id_type || 'id_card',
        id_number: maskIdentityNumber(user.kyc && user.kyc.id_number),
        submitted_at: user.kyc && user.kyc.submitted_at || '',
        reviewed_at: user.kyc && user.kyc.reviewed_at || '',
        reject_reason: user.kyc && user.kyc.reject_reason || ''
      },
      kyc_level: user.kyc.status === 'approved' ? 2 : (user.kyc.status === 'pending' ? 1 : 0),
      balances: compatBalances,
      totalUsdt: total,
      total_usdt: total,
      valuation_complete: unpricedAssets.length === 0,
      unpriced_assets: unpricedAssets,
      orders: user.orders.slice(-50),
      deposits: user.deposits.slice(-20),
      withdrawals: financialSnapshot ? financialSnapshot.withdrawals : user.withdrawals.slice(-20),
      earn_records: financialSnapshot ? financialSnapshot.earn_records : user.earn_records,
      fund_password_set: !!(user.fund_password_hash || user.fund_password),
      // OAuth/magic-link accounts have no locally usable password; require an enabled
      // TOTP factor for sensitive fund-password changes instead of accepting session-only authority.
      fundpwd_reauth_mode: Array.isArray(user.auth_providers) && user.auth_providers.length ? 'twofa' : 'password',
      twofa_enabled: user.twofa_enabled,
      deposit_addresses: safeDepositAddresses(db.deposit_addresses),
      addresses: (user.addresses || []).map(function(a){ const out=Object.assign({},a); if(out.type==='crypto' && out.address) out.address=out.address.length>14?out.address.slice(0,6)+'••••••'+out.address.slice(-6):out.address; if(out.account_number) out.account_number='••••'+out.account_number.slice(-4); if(out.routing_number) out.routing_number='••••'+out.routing_number.slice(-4); return out; }),
    });
  }

  // ---------- GET /api/addresses ----------
  if (path === 'addresses' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    return json({ ok: true, addresses: (user.addresses || []).map(function(a){
      const out = Object.assign({}, a);
      if (out.type === 'bank') {
        out.account_number = out.account_number ? '••••' + out.account_number.slice(-4) : '';
        out.routing_number = out.routing_number ? '••••' + out.routing_number.slice(-4) : '';
      } else if (out.type === 'crypto') {
        out.address = out.address.length > 14 ? out.address.slice(0,6) + '••••••' + out.address.slice(-6) : out.address;
      }
      return out;
    }) });
  }

  // ---------- GET /api/addresses/select?id=... (owner-only full address for withdrawal confirmation) ----------
  if (path === 'addresses/select' && method === 'GET') {
    if (!user) return json({ok:false,msg:'Not signed in.',need_login:true},401);
    const id=(event.queryStringParameters && event.queryStringParameters.id) || '';
    const a=(user.addresses||[]).find(function(x){return x.id===id;});
    if(!a || a.type!=='crypto' || a.blocked || a.unbound) return json({ok:false,msg:'Please contact support.'},404);
    return json({ok:true,address:a.address,coin:a.coin,network:a.network});
  }

  // ---------- POST /api/addresses ----------
  if (path === 'addresses' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    const type = body.type === 'bank' ? 'bank' : 'crypto';
    const note = String(body.note || '').trim().slice(0,80);
    let record;
    if (type === 'crypto') {
      const coin = String(body.coin || '').toUpperCase();
      const network = String(body.network || '').toUpperCase();
      const address = String(body.address || '').trim();
      const allowed = { BTC:['BTC'], ETH:['ERC20'], USDT:['TRC20','ERC20','BEP20'], SOL:['SOL'], BNB:['BEP20'], USDC:['ERC20'] };
      if (!allowed[coin] || allowed[coin].indexOf(network) < 0) return json({ok:false,msg:'Operation failed: coin and network do not match.'},400);
      let valid = false;
      if (coin === 'BTC') valid = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
      else if (network === 'ERC20' || network === 'BEP20') valid = /^0x[a-fA-F0-9]{40}$/.test(address);
      else if (network === 'TRC20') valid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
      else if (coin === 'SOL') valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      if (!valid) return json({ok:false,msg:'Operation failed: invalid address format.'},400);
      record = { id:'A'+Date.now()+crypto.randomBytes(3).toString('hex'), type:type, coin:coin, network:network, address:address, note:note, created_at:nowStr(), flagged:false, blocked:false };
    } else {
      const holder=String(body.account_holder||'').trim().slice(0,120), bank=String(body.bank_name||'').trim().slice(0,120), account=String(body.account_number||'').replace(/\s/g,''), routing=String(body.routing_number||'').replace(/\s/g,''), swift=String(body.swift||'').trim().toUpperCase(), bankAddress=String(body.bank_address||'').trim().slice(0,240);
      if (!holder || !bank || !/^\d{4,34}$/.test(account) || !/^\d{9}$/.test(routing) || (swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) || !bankAddress) return json({ok:false,msg:'Operation failed: please check your bank account details.'},400);
      record={id:'A'+Date.now()+crypto.randomBytes(3).toString('hex'),type:type,account_holder:holder,bank_name:bank,account_number:account,routing_number:routing,swift:swift,bank_address:bankAddress,note:note,created_at:nowStr(),flagged:false,blocked:false};
    }
    if (!Array.isArray(user.addresses)) user.addresses=[];
    user.addresses.push(record);
    if (!Array.isArray(user.address_audit)) user.address_audit=[];
    user.address_audit.push({id:'L'+Date.now(),action:'created',address_id:record.id,by:'user',time:nowStr()});
    await saveDB(db);
    return json({ok:true,msg:'Submitted successfully.',address:{id:record.id,type:record.type,coin:record.coin,network:record.network,note:record.note,created_at:record.created_at}});
  }

  // Address book is immutable for end users; only support may change/unbind it.
  if (path.indexOf('addresses/') === 0 && method === 'DELETE' || path.indexOf('addresses/') === 0 && method === 'PATCH') {
    if (!user) return json({ok:false,msg:'Not signed in.',need_login:true},401);
    return json({ok:false,msg:'Please contact support.'},403);
  }

  // ---------- POST /api/kyc ----------
  if (path === 'kyc' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.kyc && user.kyc.status === 'approved') return json({ ok: false, code: 'KYC_ALREADY_APPROVED', msg: 'Identity verification already approved. No need to resubmit.' }, 409);
    if (user.kyc && user.kyc.status === 'pending') return json({ ok: false, code: 'KYC_ALREADY_PENDING', msg: 'Identity verification is under review. Please do not resubmit.' }, 409);
    const submission = validateKycSubmission(body);
    if (!submission.ok) return json({ ok: false, code: 'KYC_INVALID_INPUT', msg: submission.msg }, 400);
    user.kyc = {
      status: 'pending',
      name: submission.name,
      id_type: submission.id_type,
      id_number: submission.id_number,
      submitted_at: nowStr(),
    };
    await saveDB(db);
    return json({ ok: true, code: 'KYC_SUBMITTED', status: 'pending', msg: 'Identity verification submitted. Review typically completes within 1-3 business days.' });
  }

  // ---------- POST /api/deposit ----------
  if (path === 'deposit' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    const coin = body.coin || 'USDT';
    const network = body.network || 'TRC20';
    const parsedAmount = body.amount === undefined || body.amount === null || body.amount === '' ? 0 : parseMoneyInput(body.amount);
    if (parsedAmount === null) return json({ ok: false, msg: 'Invalid amount format.' }, 400);
    const amount = parsedAmount;
    // amount <= 0 时为查询地址模式，仅返回充值地址，不入账
    if (amount <= 0) {
      const key = coin + '-' + network;
      const legacyKey = key === 'BTC-BTC' ? 'BTC-Bitcoin' : (key === 'SOL-SOL' ? 'SOL-Solana' : '');
      const addr = db.deposit_addresses[key] || (legacyKey && db.deposit_addresses[legacyKey]) || '';
      if (!addr || /PLACEHOLDER/i.test(addr)) return json({ ok: false, msg: 'Deposit address not configured yet.' }, 503);
      return json({ ok: true, address: addr, msg: 'Deposit address.' });
    }
    // Fail closed: user-supplied requests must never credit balances without verified chain data.
    return json({ ok: false, msg: 'Deposits are credited after staff manually verifies receipt and confirms the credit.' }, 403);
  }

  // ---------- POST /api/withdraw ----------
  if (path === 'withdraw' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    // Enforce account freeze on every financial write, not only at login. Existing
    // sessions remain valid after an administrator freezes an account.
    if (user.frozen) return json({ ok: false, msg: 'Account frozen. Withdrawals are not available. Please contact support.', code: 'ACCOUNT_FROZEN' }, 403);
    const coin = String(body.coin || 'USDT').trim().toUpperCase();
    const amount = parseMoneyInput(body.amount);
    const addr = String(body.address || '').trim();
    const network = String(body.network || '').toUpperCase();
    // Require a client-generated idempotency key so network retries cannot create a
    // second withdrawal for the same submit action. Persistent transactional locking
    // is still required to protect against simultaneous writes across server instances.
    const requestId = String(body.request_id || '').trim();
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) return json({ ok: false, msg: 'Invalid request ID. Please refresh and try again.' }, 400);
    // PostgreSQL is the sole idempotency authority for withdrawals. Do not consult
    // the legacy state document for a replay decision; it may be stale after cutover.
    if (!addr) return json({ ok: false, msg: 'Please enter a withdrawal address.' }, 400);
    if (amount === null || amount <= 0 || amount > 1e12) return json({ ok: false, msg: 'Invalid amount.' }, 400);
    const allowedNetworks = { BTC:['BTC'], ETH:['ERC20'], USDT:['TRC20','ERC20','BEP20'], SOL:['SOL'], BNB:['BEP20'], USDC:['ERC20'] };
    if (!allowedNetworks[coin] || allowedNetworks[coin].indexOf(network) < 0) return json({ok:false,msg:'Operation failed: coin and network do not match.'},400);
    let addressValid = false;
    if (coin === 'BTC') addressValid = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(addr);
    else if (network === 'ERC20' || network === 'BEP20') addressValid = /^0x[a-fA-F0-9]{40}$/.test(addr);
    else if (network === 'TRC20') addressValid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
    else if (coin === 'SOL') addressValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
    if (!addressValid) return json({ok:false,msg:'Operation failed: invalid address format.'},400);
    // 提现白名单+冷却：地址必须已绑定（未绑定→拒绝），新绑定地址冷却期内禁止提现。
    const cooldownMs = (Number(process.env.WITHDRAWAL_ADDRESS_COOLDOWN_HOURS) || 24) * 3600 * 1000;
    const addrCheck = withdrawalAddressCheck(user, addr, coin, network, Date.now(), cooldownMs);
    if (!addrCheck.allowed) return json({ ok: false, code: addrCheck.code, msg: addrCheck.msg }, 403);
    const supportedFees = { USDT: 1.0, BTC: 0.0001, ETH: 0.001, SOL: 0.01, BNB: 0.0005, USDC: 1.0 };
    if (!Object.prototype.hasOwnProperty.call(supportedFees, coin)) return json({ ok: false, msg: 'Operation failed: withdrawals for this coin are not supported.' }, 400);
    const fee = supportedFees[coin];
    const totalDebit = amount + fee;
    if (!Number.isFinite(totalDebit) || totalDebit <= 0) return json({ ok: false, msg: 'Invalid amount.' }, 400);
    // BTCBOX uses a simple semi-manual workflow: every withdrawal waits for admin review.
    // 资金密码校验（≥8 位含字母+数字）+ 持久化错误计数锁定（5 次错误锁 15 分钟，计数存 btcbox_state）。
    const fundPassword = String(body.fund_password || '');
    const fpValid = validateFundPassword(fundPassword);
    if (!fpValid.ok) return json({ ok: false, code: 'FUND_PASSWORD_REQUIRED', msg: fpValid.msg }, 400);
    if (!db.security_counters) db.security_counters = {};
    const lockKey = 'fundpwd_lock:' + user.uid;
    const lockState = secCounterIsLocked(db.security_counters, lockKey, Date.now());
    if (lockState.locked) return json({ ok: false, code: 'FUND_PASSWORD_LOCKED', msg: 'Too many incorrect fund password attempts. Please try again later.', retry_after: lockState.retryAfter }, 429);
    if (typeof user.fund_password === 'string' && user.fund_password.length > 0 && !user.fund_password_hash) {
      return json({ ok: false, code: 'FUND_PASSWORD_UPGRADE_REQUIRED', msg: 'Legacy fund password must be reset in Security Center before withdrawal' }, 403);
    }
    if (!verifyFundPassword(user, fundPassword)) {
      secCounterRecordFailure(db.security_counters, lockKey, 5, 15 * 60 * 1000, Date.now());
      try { await saveDB(db); } catch (e) { console.warn('[fundpwd-lock] persist failed (best-effort):', e.message); }
      return json({ ok: false, code: 'FUND_PASSWORD_INVALID', msg: 'Incorrect fund password, or no fund password is set. Please set one in Security Center first.' }, 403);
    }
    secCounterReset(db.security_counters, lockKey);
    try { await saveDB(db); } catch (e) { console.warn('[fundpwd-lock] reset persist failed (best-effort):', e.message); }
    if (user.twofa_enabled && !/^\d{6}$/.test(String(body.twofa_code || ''))) return json({ ok: false, code: 'TWOFA_REQUIRED', msg: 'Two-factor authentication is enabled on this account. Please enter your 2FA code.' }, 400);
    if (user.twofa_enabled && !totpVerify(user.twofa_secret, String(body.twofa_code || ''))) return json({ ok: false, code: 'TWOFA_INVALID', msg: 'Invalid 2FA code.' }, 403);
    // 输入与安全校验全部通过后再检查资金切开关；RPC 错误 fail-closed，绝不回退 Blobs。
    if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not submitted and your balance was unchanged.' }, 503);
    const withdrawalId = 'W' + Date.now() + crypto.randomBytes(8).toString('hex');
    if (manualDepositRpcEnabled()) {
      if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Withdrawal was not submitted.' }, 503);
      const requestHash = crypto.createHash('sha256').update([String(user.uid), coin, network, String(amount), String(fee), addr, requestId].join('|')).digest('hex');
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const rpc = await fetch(base + '/rest/v1/rpc/create_withdrawal_atomic', {
          method: 'POST', headers: supabaseHeaders(),
          body: JSON.stringify({ p_withdrawal_id: withdrawalId, p_user_id: String(user.uid), p_asset: coin,
            p_network: network, p_amount: String(amount), p_fee: String(fee), p_destination: addr,
            p_request_id: requestId, p_request_hash: requestHash })
        });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.withdrawal_id) {
          const insufficient = rpc.status === 400 && /insufficient funds/i.test(JSON.stringify(result));
          return json({ ok: false, code: insufficient ? 'INSUFFICIENT_FUNDS' : 'FINANCIAL_RPC_FAILED', msg: insufficient ? 'Insufficient available balance (including fees).' : 'Withdrawal request was not confirmed by the database. Please check your operation history before retrying.' }, insufficient ? 400 : 503);
        }
        return json({ ok: true, duplicate: !!result.duplicate, withdrawal_id: result.withdrawal_id, status: result.status, require_admin_review: true, msg: result.duplicate ? 'This withdrawal request has already been received. Do not submit it again.' : 'Withdrawal request submitted for manual review. Staff will transfer funds manually after approval.' });
      } catch (e) {
        return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Withdrawal is unconfirmed. Please check your operation history before retrying.' }, 503);
      }
    }
    return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not submitted and your balance was unchanged.' }, 503);
  }

  // ---------- GET /api/market ----------
  if (path === 'market' && method === 'GET') {
    // Coinbase is the primary source. Bybit is used only for symbols whose Coinbase
    // product/statistics are unavailable. Both sources are explicitly restricted to
    // BASE-USDT spot pairs so USDT and USD quotes are never silently mixed.
    const bases = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX', 'MATIC', 'LTC', 'BCH', 'NEAR', 'UNI', 'ATOM', 'ETC'];
    const now = Math.floor(Date.now() / 1000);
    const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
    const fetchJson = async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('market provider HTTP ' + response.status);
      return response.json();
    };
    const normalize = (base, ticker, source) => {
      const price = Number(ticker.price);
      const high = Number(ticker.high);
      const low = Number(ticker.low);
      const chg = Number(ticker.chg);
      const vol = Number(ticker.vol);
      if (![price, high, low, chg, vol].every(Number.isFinite) || price <= 0 || high <= 0 || low <= 0 || vol < 0) return null;
      return { sym: base, price, chg, high, low, vol, ts: now, source };
    };
    const marketsByBase = {};
    let coinbaseAvailable = false;
    try {
      const products = await fetchJson('https://api.exchange.coinbase.com/products');
      if (!Array.isArray(products)) throw new Error('invalid Coinbase product list');
      const enabled = new Set(products.filter(p => p && p.quote_currency === 'USDT' && p.status === 'online' && p.trading_disabled !== true).map(p => p.id));
      const coinbaseRows = await Promise.all(bases.map(async base => {
        const productId = base + '-USDT';
        if (!enabled.has(productId)) return null;
        try {
          const stats = await fetchJson('https://api.exchange.coinbase.com/products/' + productId + '/stats');
          const price = Number(stats.last);
          const open = Number(stats.open);
          const baseVolume = Number(stats.volume);
          if (!finitePositive(price) || !finitePositive(open) || !finitePositive(stats.high) || !finitePositive(stats.low) || !Number.isFinite(baseVolume) || baseVolume < 0) return null;
          return normalize(base, { price, high: Number(stats.high), low: Number(stats.low), chg: (price - open) / open * 100, vol: baseVolume * price }, 'coinbase');
        } catch (_) { return null; }
      }));
      coinbaseRows.forEach(row => { if (row) marketsByBase[row.sym] = row; });
      coinbaseAvailable = coinbaseRows.some(Boolean);
    } catch (_) {
      // Provider failure is intentionally handled by the fallback below.
    }
    const missingBases = bases.filter(base => !marketsByBase[base]);
    if (missingBases.length) {
      try {
        const payload = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot');
        const list = payload && payload.result && payload.result.list;
        if (!Array.isArray(list)) throw new Error('invalid Bybit ticker payload');
        const bybit = new Map(list.filter(t => t && /USDT$/.test(t.symbol || '')).map(t => [t.symbol.slice(0, -4), t]));
        missingBases.forEach(base => {
          const t = bybit.get(base);
          if (!t) return;
          const price = Number(t.lastPrice), high = Number(t.highPrice24h), low = Number(t.lowPrice24h);
          const chg = Number(t.price24hPcnt) * 100, vol = Number(t.turnover24h);
          const row = normalize(base, { price, high, low, chg, vol }, 'bybit');
          if (row) marketsByBase[base] = row;
        });
      } catch (_) {
        // Keep valid Coinbase rows; do not invent prices for missing symbols.
      }
    }
    const out = bases.filter(base => marketsByBase[base]).map(base => {
      const row = marketsByBase[base];
      return { sym: row.sym, price: row.price, chg: row.chg, high: row.high, low: row.low, vol: (row.vol / 1e9).toFixed(2) + 'B', source: row.source };
    });
    const dataObj = {};
    out.forEach(row => { dataObj[row.sym] = { price: row.price, chg: row.chg, high: row.high, low: row.low, vol: marketsByBase[row.sym].vol, ts: now, source: row.source }; });
    if (!out.length) return json({ ok: false, code: 'MARKET_DATA_UNAVAILABLE', msg: 'Market data unavailable.', markets: [], data: {}, source: coinbaseAvailable ? 'coinbase_partial' : 'unavailable' }, 503);
    // Public market snapshots contain no user data. Allow short shared-cache reuse
    // so free serverless plans do not fetch every provider for every browser poll.
    // Authenticated/private/financial endpoints retain the default no-store policy.
    return json({ ok: true, markets: out, data: dataObj, source: missingBases.length ? 'coinbase_primary_bybit_fallback' : 'coinbase' }, 200, { 'Cache-Control': 'public, max-age=2, s-maxage=5, stale-while-revalidate=3' });
  }

  // ---------- POST /api/order ----------
  // Never simulate fills or mutate customer balances outside the PostgreSQL matching RPC.
  if (path === 'order' && method === 'POST') {
    // Never simulate fills or mutate customer balances outside the PostgreSQL matching RPC.
    // Never simulate fills: an unavailable or unapproved engine must fail closed.
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'Account frozen. Trading is not available. Please contact support.', code: 'ACCOUNT_FROZEN' }, 403);
    const symbol = String(body.symbol || 'BTCUSDT').toUpperCase();
    const side = String(body.side || 'buy').toLowerCase();
    const type = String(body.type || body.order_type || 'limit').toLowerCase();
    const qty = Number(body.qty);
    const price = Number(body.price || 0);
    const pair = matchingPairFromSymbol(symbol);
    if (!pair) return json({ ok: false, msg: 'Operation failed: this trading pair is not supported.' }, 400);
    if (!['buy','sell'].includes(side)) return json({ ok: false, msg: 'Operation failed: invalid trade direction.' }, 400);
    // Market orders are intentionally rejected until a separately bounded market-order policy exists.
    if (type !== 'limit') return json({ ok: false, code: 'ORDER_TYPE_UNSUPPORTED', msg: 'Only limit orders are currently supported.' }, 400);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1e12) return json({ ok: false, msg: 'Operation failed: invalid quantity.' }, 400);
    if (!Number.isFinite(price) || price <= 0 || price > 1e15) return json({ ok: false, msg: 'Operation failed: invalid limit price.' }, 400);
    const clientOrderId = String(body.client_order_id || body.request_id || '').trim();
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(clientOrderId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'Please provide a valid client_order_id (16-100 characters).' }, 400);
    if (!matchingEngineEnabled()) {
      return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Matching engine cutover is not approved. No order was created and your balance was unchanged.' }, 503);
    }
    const orderId = 'O' + crypto.randomUUID().replace(/-/g, '');
    try {
      const result = await matchingRpc('submit_limit_order_matching_v1', {
        p_order_id: orderId, p_user_id: String(user.uid), p_base_asset: pair[0], p_quote_asset: pair[1],
        p_side: side, p_price: String(price), p_quantity: String(qty), p_client_order_id: clientOrderId
      });
      return json({ ok: true, duplicate: !!result.duplicate, order_id: result.order_id || orderId,
        status: result.status, price: result.price, quantity: result.quantity,
        remaining_quantity: result.remaining_quantity, reserved_remaining: result.reserved_remaining });
    } catch (e) {
      const status = e.status === 400 ? 400 : 503;
      return json({ ok: false, code: e.status === 400 ? 'ORDER_REJECTED' : 'MATCHING_RPC_UNAVAILABLE',
        msg: e.status === 400 ? 'Order validation failed. Please check trading pair rules, available balance, and request parameters.' : 'Matching database temporarily unavailable. Order result is unconfirmed. Please check your orders before retrying.' }, status);
    }
  }

  // ---------- POST /api/order/cancel ----------
  if (path === 'order/cancel' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    const orderId = String(body.order_id || '').trim();
    const cancelId = String(body.client_cancel_id || body.request_id || '').trim();
    if (!orderId || orderId.length > 128) return json({ ok: false, code: 'INVALID_ORDER_ID', msg: 'Invalid order ID.' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(cancelId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'Please provide a valid client_cancel_id (16-100 characters).' }, 400);
    if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Matching engine cutover is not approved. Cancel was not executed.' }, 503);
    try {
      const result = await matchingRpc('cancel_limit_order_matching_v1', {
        p_user_id: String(user.uid), p_order_id: orderId, p_client_cancel_id: cancelId
      });
      return json({ ok: true, duplicate: !!result.duplicate, order_id: result.order_id || orderId, status: result.status });
    } catch (e) {
      return json({ ok: false, code: e.status === 400 ? 'CANCEL_REJECTED' : 'MATCHING_RPC_UNAVAILABLE',
        msg: e.status === 400 ? 'Cancel failed. Please check the order status.' : 'Matching database temporarily unavailable. Cancel result is unconfirmed. Please check your orders before retrying.' }, e.status === 400 ? 400 : 503);
    }
  }

  // ---------- POST /api/earn ----------
  if (path === 'earn' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'Account frozen. Earn operations are not available. Please contact support.', code: 'ACCOUNT_FROZEN' }, 403);
    // Financial actions become usable only through the atomic PostgreSQL ledger.
    // Never fall back to the legacy Blobs wallet if configuration/RPC fails.
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Earn service cutover is incomplete. Funds were unchanged.' }, 503);
    }
    const action = String(body.action || 'subscribe');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const requestId = String(body.request_id || '').trim();
    if (action === 'subscribe') {
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid subscription request ID is required.' }, 400);
      const amount = parseMoneyInput(body.amount);
      if (amount === null || amount <= 0 || amount > 1e12) return json({ ok: false, msg: 'Invalid amount.' }, 400);
      const productId = String(body.product_id || 'flex_USDT');
      const products = new Set(['demand','flex_USDT','flex_BTC','flex_ETH','fixed30','fixed90','fixed180']);
      if (!products.has(productId)) return json({ ok: false, msg: 'This earn product is not supported.' }, 400);
      const asset = productId.endsWith('_BTC') ? 'BTC' : productId.endsWith('_ETH') ? 'ETH' : 'USDT';
      const positionId = 'EP' + crypto.createHash('sha256').update(String(user.uid) + '|' + requestId).digest('hex').slice(0, 32);
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), product_id: productId, asset, amount: String(amount), request_id: requestId })).digest('hex');
      try {
        const rpc = await fetch(base + '/rest/v1/rpc/subscribe_earn_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_product_id: productId, p_asset: asset, p_principal: String(amount), p_request_id: requestId, p_request_hash: requestHash }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Earn subscription was not confirmed by the database. Please check your operation history before retrying.' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, record_id: result.position_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? 'This subscription request has already been processed. Do not submit it again.' : 'Subscription successful.' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Subscription result is unconfirmed. Please check your operation history.' }, 503); }
    }
    if (action === 'redeem') {
      const positionId = String(body.record_id || '').trim();
      if (!positionId || positionId.length > 128) return json({ ok: false, msg: 'Invalid record ID.' }, 400);
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid redemption request ID is required.' }, 400);
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), position_id: positionId, request_id: requestId })).digest('hex');
      try {
        const rpc = await fetch(base + '/rest/v1/rpc/redeem_earn_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_request_id: requestId, p_request_hash: requestHash }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Earn redemption was not confirmed by the database. Please check your operation history before retrying.' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, record_id: result.position_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? 'This redemption request has already been processed.' : 'Redemption successful.' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Redemption result is unconfirmed. Please check your operation history.' }, 503); }
    }
    return json({ ok: false, msg: 'Unknown operation.' }, 400);
  }

  // ---------- 秒合约 Seconds Contracts ----------
  // Balance-affecting logic lives exclusively in the atomic PostgreSQL RPC.
  // Default is fail-closed (financialWritesEnabled() === false): no order is
  // created and no balance changes until the PostgreSQL cutover is approved.
  // The client never mutates BTCBOX.account.balances directly; it refreshes
  // from /api/account after each confirmed operation.

  // ---------- GET /api/seconds/policy ----------
  if (path === 'seconds/policy' && method === 'GET') {
    try {
      const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const rpc = await fetch(base + '/rest/v1/rpc/read_seconds_policy_v1', {
        method: 'POST', headers: supabaseHeaders(), body: '{}'
      });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true) {
        return json({ ok: false, code: 'SECONDS_POLICY_UNAVAILABLE', msg: 'Contract policy is temporarily unavailable.' }, 503);
      }
      const publicPolicy = Object.assign({}, result.policy, {
        enabled: result.policy.enabled === true && financialWritesEnabled()
      });
      return json({ ok: true, policy: publicPolicy });
    } catch (_) {
      return json({ ok: false, code: 'SECONDS_POLICY_UNAVAILABLE', msg: 'Contract policy is temporarily unavailable.' }, 503);
    }
  }

  // ---------- POST /api/seconds/order ----------
  if (path === 'seconds/order' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'This account is frozen and cannot open short-term contracts.', code: 'ACCOUNT_FROZEN' }, 403);
    const rl = rateCheck('seconds:order:' + String(user.uid), 30, 5 * 60 * 1000);
    if (rl.limited) return rateLimitedJson(rl.retryAfter);
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Short-term contracts are unavailable until financial cutover is complete. No funds were frozen and no position was created.' }, 503);
    }
    const symbol = String(body.symbol || 'BTC').toUpperCase();
    const direction = String(body.direction || 'up').toLowerCase();
    const durationSec = Number(body.duration_sec || body.duration || 30);
    const amountText = typeof body.amount === 'string' ? body.amount.trim() : '';
    const amount = Number(amountText);
    const requestId = String(body.request_id || '').trim();
    if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) return json({ ok: false, msg: 'This trading pair is not supported for short-term contracts.' }, 400);
    if (!['up', 'down'].includes(direction)) return json({ ok: false, msg: 'Invalid trade direction.' }, 400);
    if (!Number.isSafeInteger(durationSec) || durationSec < 1 || durationSec > 2147483647) return json({ ok: false, msg: 'Invalid contract duration.' }, 400);
    if (!/^(?:0|[1-9][0-9]{0,19})(?:[.][0-9]{1,18})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0) return json({ ok: false, msg: 'Invalid investment amount.' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid request ID (16-100 characters) is required.' }, 400);
    let ref;
    try { ref = await fetchSecondsReferencePrice(symbol); }
    catch (_) { return json({ ok: false, code: 'REFERENCE_PRICE_UNAVAILABLE', msg: 'The reference price is currently unavailable. No order was created.' }, 503); }
    const positionId = 'SC' + crypto.createHash('sha256').update(String(user.uid) + '|' + requestId).digest('hex').slice(0, 30);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), symbol, direction, amount: amountText, duration_sec: durationSec, request_id: requestId })).digest('hex');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/submit_seconds_order_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_symbol: symbol, p_direction: direction, p_amount: amountText, p_duration_sec: durationSec, p_open_price: String(ref.price), p_request_id: requestId, p_request_hash: requestHash }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true || !result.position_id) {
        const code = result && result.code ? String(result.code) : 'FINANCIAL_RPC_FAILED';
        const known = {
          INVALID_ARGUMENT: [400, 'The contract order parameters are invalid.'],
          IDEMPOTENCY_CONFLICT: [409, 'This request ID was already used with different order parameters.'],
          SECONDS_POLICY_NOT_CONFIGURED: [503, 'Contract policy is not configured.'],
          SECONDS_TRADING_DISABLED: [403, 'Seconds contracts are currently paused by the administrator.'],
          INVALID_DURATION: [400, 'This contract duration is not currently available.'],
          AMOUNT_OUT_OF_POLICY_RANGE: [400, 'The amount is outside the current administrator limits.'],
          INSUFFICIENT_BALANCE: [409, 'Insufficient available USDT balance.']
        };
        const failure = known[code] || [rpc.status === 400 ? 400 : 503, 'The database did not confirm the contract order. Verify order status before retrying.'];
        return json({ ok: false, code: code, msg: failure[1], duplicate: !!(result && result.duplicate) }, failure[0]);
      }
      return json({ ok: true, server_now: Date.now(), duplicate: !!result.duplicate, position_id: result.position_id, symbol: symbol, direction: direction, amount: amountText, duration_sec: durationSec, open_price: ref.price, open_price_source: ref.source, settle_at: result.settle_at, policy_version: result.policy_version, payout_rate: result.payout_rate, msg: result.duplicate ? 'This order request has already been processed. Do not submit it again.' : 'Position opened successfully. Funds have been reserved.' });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'The financial database is unavailable. The order is unconfirmed and funds were not changed.' }, 503); }
  }

  // ---------- POST /api/seconds/settle ----------
  if (path === 'seconds/settle' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'This account is frozen.', code: 'ACCOUNT_FROZEN' }, 403);
    const rl = rateCheck('seconds:settle:' + String(user.uid), 60, 5 * 60 * 1000);
    if (rl.limited) return rateLimitedJson(rl.retryAfter);
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Short-term contracts are unavailable until financial cutover is complete. This position was not settled.' }, 503);
    }
    const positionId = String(body.position_id || '').trim();
    const requestId = String(body.request_id || '').trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(positionId)) return json({ ok: false, msg: 'Invalid position ID.' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid request ID (16-100 characters) is required.' }, 400);
    const symbol = String(body.symbol || '').toUpperCase();
    if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) return json({ ok: false, msg: 'Invalid trading pair.' }, 400);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), position_id: positionId, symbol, request_id: requestId })).digest('hex');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    // Sample the trusted reference feed on the server only. The client cannot
    // provide or alter the settlement price; PostgreSQL still checks maturity,
    // ownership, idempotency, and applies the ledger movement atomically.
    let settleRef;
    try { settleRef = await fetchSecondsReferencePrice(symbol); }
    catch (_) { return json({ ok: false, code: 'REFERENCE_PRICE_UNAVAILABLE', msg: 'The settlement reference price is unavailable. The position remains unsettled; please try again later.' }, 503); }
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/settle_seconds_position_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_request_id: requestId, p_request_hash: requestHash, p_symbol: symbol, p_settle_price: String(settleRef.price), p_settle_price_source: settleRef.source, p_settle_price_ts: new Date().toISOString() }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true) {
        const failure = secondsSettlementError(result, rpc.status);
        return json({ ok: false, code: failure.code, msg: failure.msg, duplicate: false, settled: false }, failure.status);
      }
      return json({ ok: true, duplicate: !!result.duplicate, position_id: positionId, settled: result.settled !== false, win: result.win, tie: result.tie, pnl: result.pnl, settle_price: result.settle_price, msg: result.duplicate ? 'This settlement request has already been processed.' : (result.settled === false ? 'This position has not reached maturity and cannot be settled yet.' : 'Settlement completed.') });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'The financial database is unavailable. Settlement remains unconfirmed.' }, 503); }
  }

  // ---------- GET /api/seconds/positions ----------
  if (path === 'seconds/positions' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (!financialWritesEnabled()) {
      return json({ ok: true, server_now: Date.now(), open: [], history: [], cutover_incomplete: true, msg: 'Short-term contract data is unavailable until financial cutover is complete.' });
    }
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/read_seconds_positions_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_user_id: String(user.uid) }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Failed to retrieve short-term contract positions.' }, 503);
      return json({ ok: true, server_now: Date.now(), open: Array.isArray(result.open) ? result.open : [], history: Array.isArray(result.history) ? result.history : [] });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'The financial database is unavailable.' }, 503); }
  }

  // ---------- POST /api/support/chat ----------
  if (path === 'support/chat' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return json({ ok: false, msg: 'Please enter a message.' }, 400);
    if (content.length > 2000) return json({ ok: false, msg: 'Messages cannot exceed 2,000 characters.' }, 400);
    user.support_messages = Array.isArray(user.support_messages) ? user.support_messages : [];
    user.support_messages.push({ id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'user', content: content, time: nowStr() });
    // Keep the conversation bounded so repeated submissions cannot grow the
    // per-user record without limit. Preserve the newest messages.
    if (user.support_messages.length > 500) user.support_messages = user.support_messages.slice(-500);
    await saveDB(db);
    return json({ ok: true, msg: 'Submitted successfully.' });
  }

  // ---------- GET /api/support/messages ----------
  if (path === 'support/messages' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    user.last_read_chat_at = nowStr(); // 拉取消息即标记已读
    await saveDB(db);
    return json({ ok: true, messages: user.support_messages.slice(-50) });
  }

  // ---------- POST /api/settings/password ----------
  if (path === 'settings/password' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    { const rl = rateCheck('password-change:' + user.uid, 10, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (Array.isArray(user.auth_providers) && user.auth_providers.length) return json({ ok: false, code: 'SUPABASE_AUTH_MANAGED', msg: 'This account is managed by Supabase Auth. Please update your sign-in credentials through the trusted Supabase Auth password recovery flow.' }, 409);
    if (!body.old_password || hashPassword(String(body.old_password), user.salt) !== user.password_hash) return json({ ok: false, code: 'REAUTH_FAILED', msg: 'The current password is incorrect.' }, 403);
    if ((body.new_password || '').length < 6) return json({ ok: false, msg: 'New password must be at least 6 characters.' }, 400);
    if (user.twofa_enabled && (!/^\d{6}$/.test(String(body.twofa_code || '')) || !totpVerify(user.twofa_secret, String(body.twofa_code || '')))) return json({ ok: false, code: 'TWOFA_REQUIRED', msg: 'Two-factor authentication is enabled on this account. Please enter your 2FA code.' }, 403);
    user.salt = genSalt();
    user.password_hash = hashPassword(body.new_password, user.salt);
    // A password change invalidates every existing session, not only the browser
    // that initiated it, so a stolen cookie cannot remain valid afterwards.
    Object.keys(db.sessions || {}).forEach(function (token) { if (db.sessions[token] && db.sessions[token].uid === user.uid) delete db.sessions[token]; });
    await saveDB(db);
    return json({ ok: true, msg: 'Password changed successfully.' }, 200, clearCookieHeader());
  }

  // ---------- POST /api/settings/fundpwd ----------
  if (path === 'settings/fundpwd' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    { const rl = rateCheck('fundpwd-change:' + user.uid, 10, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    const pwd = String(body.fund_password || '');
    const fpValid = validateFundPassword(pwd);
    if (!fpValid.ok) return json({ ok: false, code: 'FUND_PASSWORD_FORMAT', msg: fpValid.msg }, 400);
    const code = String(body.twofa_code || '');
    if (Array.isArray(user.auth_providers) && user.auth_providers.length) {
      // Supabase OAuth/magic-link users do not have a usable local password hash.
      // Require an already-enabled TOTP factor rather than silently downgrading to session-only authorization.
      if (!user.twofa_enabled || !user.twofa_secret) return json({ ok: false, code: 'FUND_PASSWORD_REAUTH_REQUIRED', msg: 'Enable two-factor authentication before setting or changing your fund password.' }, 403);
      if (!/^\d{6}$/.test(code) || !totpVerify(user.twofa_secret, code)) return json({ ok: false, code: 'TWOFA_INVALID', msg: 'Invalid 2FA code.' }, 403);
    } else {
      const currentPassword = String(body.current_password || '');
      if (!currentPassword || hashPassword(currentPassword, user.salt) !== user.password_hash) return json({ ok: false, code: 'REAUTH_FAILED', msg: 'The current login password is incorrect.' }, 403);
      if (user.twofa_enabled && (!/^\d{6}$/.test(code) || !totpVerify(user.twofa_secret, code))) return json({ ok: false, code: 'TWOFA_INVALID', msg: 'Invalid 2FA code.' }, 403);
    }
    const fundSalt = genSalt();
    user.fund_password_salt = fundSalt;
    user.fund_password_hash = hashFundPassword(pwd, fundSalt);
    delete user.fund_password; // Never persist the six-digit fund password in plaintext.
    await saveDB(db);
    return json({ ok: true, msg: 'Fund password set successfully.' });
  }

  // ---------- POST /api/settings/2fa (retired duplicate endpoint) ----------
  if (path === 'settings/2fa' && method === 'POST') {
    return json({ ok: false, code: 'ENDPOINT_DEPRECATED', msg: 'Please use the secure two-factor authentication setup flow.' }, 410);
  }

  // ---------- GET /api/orders ----------
  if (path === 'orders' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (matchingEngineRequested()) {
      if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Order query is unavailable until matching engine cutover is approved.' }, 503);
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const query = new URLSearchParams({ select: 'id,base_asset,quote_asset,side,price,quantity,remaining_quantity,status,client_order_id,created_at,updated_at', user_id: 'eq.' + String(user.uid), order: 'created_at.desc', limit: '50' });
        const response = await fetch(base + '/rest/v1/financial_matching_orders?' + query.toString(), { headers: supabaseHeaders() });
        const rows = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(rows)) return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503);
        const orders = rows.map(row => ({ order_id: row.id, symbol: row.base_asset + row.quote_asset, side: row.side,
          price: row.price, quantity: row.quantity, remaining_quantity: row.remaining_quantity, status: row.status,
          client_order_id: row.client_order_id, created_at: row.created_at, updated_at: row.updated_at }));
        return json({ ok: true, orders });
      } catch (e) { return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503); }
    }
    return json({ ok: true, orders: (Array.isArray(user.orders) ? user.orders : []).slice(-50) });
  }

  // ---------- GET /api/chat/unread（客服未读消息数）----------
  if (path === 'chat/unread' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    const lastRead = user.last_read_chat_at || '';
    const unread = (user.support_messages || []).filter(function (m) { return m.from === 'admin' && m.time > lastRead; }).length;
    return json({ ok: true, unread: unread });
  }

  // ==================== 后台管理 API（Basic Auth） ====================
  // 管理员认证：timingSafeEqual 保留；失败计数持久化到 btcbox_state（5 次/15 分钟锁）。
  async function adminAuth() {
    const authHeader = event.headers && (event.headers.authorization || event.headers.Authorization);
    if (!authHeader || !authHeader.startsWith('Basic ')) return null;
    if (!db.security_counters) db.security_counters = {};
    const lockKey = 'admin_fail:' + clientIp(event);
    const lockState = secCounterIsLocked(db.security_counters, lockKey, Date.now());
    if (lockState.locked) return { rateLimited: true, retryAfter: lockState.retryAfter };
    try {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
      const separator = decoded.indexOf(':');
      if (separator < 1) return null;
      const u = decoded.slice(0, separator);
      const p = decoded.slice(separator + 1);
      const ADMIN_USER = process.env.ADMIN_USER;
      const ADMIN_PASS = process.env.ADMIN_PASS;
      if (ADMIN_USER && ADMIN_PASS) {
        // Constant-time comparison: pad both sides to the same length so neither
        // credential length nor byte differences leak through timing.
        const supplied = Buffer.from(u + '\x00' + p);
        const expected = Buffer.from(ADMIN_USER + '\x00' + ADMIN_PASS);
        const padLen = Math.max(supplied.length, expected.length, 64);
        const padSupplied = Buffer.alloc(padLen, 0); supplied.copy(padSupplied);
        const padExpected = Buffer.alloc(padLen, 0); expected.copy(padExpected);
        const match = crypto.timingSafeEqual(padSupplied, padExpected) && supplied.length === expected.length;
        if (match) { secCounterReset(db.security_counters, lockKey); try { await saveDB(db); } catch (e) { } return true; }
      }
    } catch (e) { }
    // 认证失败：持久化记录失败计数（5 次锁 15 分钟）。
    secCounterRecordFailure(db.security_counters, lockKey, 5, 15 * 60 * 1000, Date.now());
    try { await saveDB(db); } catch (e) { console.warn('[admin-lock] persist failed (best-effort):', e.message); }
    return null;
  }
  if (path.startsWith('admin/')) {
    const adminAuthResult = await adminAuth();
    if (adminAuthResult && adminAuthResult.rateLimited) return rateLimitedJson(adminAuthResult.retryAfter);
    if (!adminAuthResult) {
      return json({ ok: false, msg: 'Administrator authentication failed.' }, 401, { 'WWW-Authenticate': 'Basic realm="BTCBOX Admin"' });
    }
    const sub = path.slice(6); // 去掉 admin/ 前缀

    // GET /api/admin/stats
    if (sub === 'stats' && method === 'GET') {
      const users = Object.values(db.users);
      let pendingWd = users.reduce(function (s, u) { return s + (Array.isArray(u.withdrawals) ? u.withdrawals.filter(function (w) { return w.status === 'pending' || w.status === 'approved_pending_broadcast'; }).length : 0); }, 0);
      if (financialPostgresReadsEnabled()) {
        try { pendingWd = (await readAdminWithdrawalSnapshot()).pending_count; }
        catch (e) { return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
      }
      const pendingKyc = users.filter(function (u) { return u.kyc && u.kyc.status === 'pending'; }).length;
      return json({ ok: true, total_users: users.length, pending_withdrawals: pendingWd, pending_kyc: pendingKyc, deposit_addresses: safeDepositAddresses(db.deposit_addresses), announcement: db.announcement || '' });
    }

    // GET /api/admin/users?search=
    if (sub === 'users' && method === 'GET') {
      const q = ((event.queryStringParameters && event.queryStringParameters.search) || '').toLowerCase();
      let list = Object.values(db.users);
      if (q) list = list.filter(function (u) { return String(u.email || '').toLowerCase().indexOf(q) > -1 || String(u.uid || '').toLowerCase().indexOf(q) > -1; });
      list = list.slice(0, 200);
      try { await getLiveUsdtPrices(list.flatMap(function (u) { return Object.keys(u.balances || {}); })); } catch (_) {}
      let normalizedBalances = null;
      if (financialPostgresReadsEnabled()) {
        try { normalizedBalances = await readAdminAccountBalances(list.map(function (u) { return String(u.uid); })); }
        catch (e) { return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
      }
      return json({ ok: true, users: list.map(function (u) {
        const balances = normalizedBalances ? (normalizedBalances[String(u.uid)] || {}) : (u.balances || {});
        return { uid: u.uid, email: u.email || '', kyc_status: (u.kyc && u.kyc.status) || 'unverified', total_usdt: totalUsdt(balances, livePriceCache.prices), created_at: u.created_at || '', frozen: !!u.frozen, twofa: !!u.twofa_enabled };
      }) });
    }

    // GET /api/admin/user?uid=
    if (sub === 'user' && method === 'GET') {
      const uid = (event.queryStringParameters && event.queryStringParameters.uid) || '';
      const u = db.users[uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      // Never expose password hashes, salts, or session tokens through admin user detail APIs.
      const safeUser = JSON.parse(JSON.stringify(u));
      delete safeUser.password_hash;
      delete safeUser.salt;
      delete safeUser.fund_password_hash;
      delete safeUser.fund_password_salt;
      safeUser.fund_password = !!(u.fund_password_hash || u.fund_password);
      delete safeUser.sessions;
      delete safeUser.twofa_secret;
      delete safeUser.totp_secret;
      delete safeUser.recovery_codes;
      if (financialPostgresReadsEnabled()) {
        try {
          const normalized = await readAdminAccountBalances([String(u.uid)]);
          safeUser.balances = normalized[String(u.uid)] || {};
          safeUser.financial_balance_source = 'postgres_financial_ledger';
        } catch (e) {
          return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503);
        }
      }
      return json({ ok: true, user: safeUser });
    }

    // All privileged account changes are auditable and validated server-side.
    // 审计日志双写：JSON blob（兼容旧读取路径）+ PostgreSQL append-only 表（fire-and-forget，失败告警回退）。
    function auditAdmin(action, uid, detail) {
      if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
      db.audit_logs.push({ id: 'AL' + Date.now() + crypto.randomBytes(3).toString('hex'), action: action, uid: String(uid || ''), by: 'admin', time: nowStr(), detail: String(detail || '').slice(0, 300) });
      if (db.audit_logs.length > 5000) db.audit_logs = db.audit_logs.slice(-5000);
      if (supabaseStorageConfigured()) {
        const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
        if (base) {
          fetch(base + '/rest/v1/rpc/append_admin_audit_log', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_action: String(action), p_uid: String(uid || ''), p_by: 'admin', p_detail: String(detail || '').slice(0, 300) })
          }).catch(function (e) { console.warn('[audit-log] PG append failed (JSON blob fallback):', e.message); });
        }
      }
    }

    // GET/POST /api/admin/seconds-policy — policy is persisted and enforced by PostgreSQL.
    if (sub === 'seconds-policy' && (method === 'GET' || method === 'POST')) {
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        let rpcName = 'read_seconds_policy_v1';
        let payload = {};
        if (method === 'POST') {
          const durations = Array.isArray(body.allowed_durations) ? body.allowed_durations.map(Number) : [];
          const minAmountText = typeof body.min_order_amount === 'string' ? body.min_order_amount.trim() : '';
          const maxAmountText = typeof body.max_order_amount === 'string' ? body.max_order_amount.trim() : '';
          const minAmount = Number(minAmountText);
          const maxAmount = Number(maxAmountText);
          const payoutRate = Number(body.payout_rate);
          const validMoneyText = /^(?:0|[1-9][0-9]{0,19})(?:[.][0-9]{1,18})?$/;
          if (typeof body.enabled !== 'boolean' || !durations.length || durations.length > 20 ||
              durations.some(function (v) { return !Number.isSafeInteger(v) || v < 1 || v > 2147483647; }) ||
              new Set(durations).size !== durations.length ||
              !validMoneyText.test(minAmountText) || !Number.isFinite(minAmount) || minAmount <= 0 ||
              !validMoneyText.test(maxAmountText) || !Number.isFinite(maxAmount) || maxAmount <= 0 ||
              !Number.isFinite(payoutRate) || payoutRate < 0.85) {
            return json({ ok: false, code: 'INVALID_SECONDS_POLICY', msg: 'Check enabled state, unique positive integer durations, amount range, and payout rate (minimum 85%).' }, 400);
          }
          rpcName = 'update_seconds_policy_v1';
          payload = {
            p_enabled: body.enabled,
            p_allowed_durations: durations,
            p_min_order_amount: minAmountText,
            p_max_order_amount: maxAmountText,
            p_payout_rate: String(payoutRate),
            p_admin_id: String(process.env.ADMIN_USER || 'admin')
          };
        }
        const rpc = await fetch(base + '/rest/v1/rpc/' + rpcName, {
          method: 'POST', headers: supabaseHeaders(), body: JSON.stringify(payload)
        });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true) {
          const code = (result && result.code) || 'SECONDS_POLICY_RPC_FAILED';
          const status = code === 'INVALID_SECONDS_POLICY' ? 400 : (rpc.status === 400 ? 400 : 503);
          return json({ ok: false, code: code,
            msg: status === 400 ? 'The seconds policy values are invalid.' : 'Seconds policy could not be confirmed by the database. No policy change is confirmed.' }, status);
        }
        if (method === 'POST') auditAdmin('seconds_policy_update', '', JSON.stringify(result.policy));
        return json({ ok: true, policy: result.policy });
      } catch (_) {
        return json({ ok: false, code: 'SECONDS_POLICY_RPC_UNAVAILABLE', msg: 'Seconds policy database is unavailable.' }, 503);
      }
    }

    // GET /api/admin/seconds-positions — paginated read-only queue of every open position.
    if (sub === 'seconds-positions' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const limit = Math.min(500, Math.max(1, Number.parseInt(params.limit || '200', 10) || 200));
      const offset = Math.max(0, Number.parseInt(params.offset || '0', 10) || 0);
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const rpc = await fetch(base + '/rest/v1/rpc/read_admin_seconds_positions_v1', {
          method: 'POST', headers: supabaseHeaders(),
          body: JSON.stringify({ p_limit: limit, p_offset: offset })
        });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !Array.isArray(result.positions)) {
          return json({ ok: false, code: 'SECONDS_POSITION_QUEUE_UNAVAILABLE', msg: 'Open contract positions could not be loaded.' }, 503);
        }
        const usersById = new Map(Object.values(db.users).map(function (u) { return [String(u.uid), u]; }));
        const positions = result.positions.map(function (p) {
          const owner = usersById.get(String(p.user_id));
          return Object.assign({}, p, { email: owner ? (owner.email || '') : '' });
        });
        return json({ ok: true, positions: positions, total: Number(result.total || 0), limit: limit, offset: offset });
      } catch (_) {
        return json({ ok: false, code: 'SECONDS_POSITION_QUEUE_UNAVAILABLE', msg: 'Open contract positions could not be loaded.' }, 503);
      }
    }

    // POST /api/admin/user/balance 调整余额
    if (sub === 'user/balance' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Balance was unchanged.' }, 503);
      if (manualDepositRpcEnabled()) {
        const u = db.users[body.uid];
        // In cutover mode this route must use the transactional ledger exclusively.
        // Never fall back to the legacy state document if configuration/RPC fails.
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Balance was unchanged.' }, 503);
        if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
        const coin = String(body.coin || 'USDT').trim().toUpperCase();
        const allowedCoins = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC'];
        const delta = Number(body.delta);
        const mode = String(body.mode || 'adjust').trim().toLowerCase();
        const requestId = String(body.request_id || '').trim();
        const reason = String(body.reason || '').trim().slice(0, 500);
        if (!allowedCoins.includes(coin)) return json({ ok: false, msg: 'Operation failed: coin not supported.' }, 400);
        if (!['adjust', 'freeze', 'unfreeze'].includes(mode)) return json({ ok: false, msg: 'Invalid fund operation type.' }, 400);
        if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1e12 || !Number.isSafeInteger(Math.round(delta * 1e8)) || (mode !== 'adjust' && delta < 0)) return json({ ok: false, msg: 'Invalid operation amount. Freeze/unfreeze amounts must be positive.' }, 400);
        if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid operation ID is required. Balance was unchanged.' }, 400);
        if (reason.length < 5) return json({ ok: false, msg: 'Please provide an adjustment reason of at least 5 characters. Balance was unchanged.' }, 400);
        const adminId = String(process.env.ADMIN_USER || '').trim();
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Balance was unchanged.' }, 503);
        // Canonical decimal text must match PostgreSQL numeric::text when hashing the RPC payload.
        const canonicalDecimal = function (n) { return (n < 0 ? '-' : '') + Math.abs(n).toFixed(8).replace(/\.?0+$/, ''); };
        let availableDelta = delta;
        let frozenDelta = 0;
        if (mode === 'freeze') { availableDelta = -delta; frozenDelta = delta; }
        else if (mode === 'unfreeze') { availableDelta = delta; frozenDelta = -delta; }
        const availableDeltaText = canonicalDecimal(availableDelta);
        const frozenDeltaText = canonicalDecimal(frozenDelta);
        const requestHash = crypto.createHash('sha256').update([adminId, String(u.uid), coin, availableDeltaText, frozenDeltaText, reason].join('|')).digest('hex');
        try {
          const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
          const rpc = await fetch(base + '/rest/v1/rpc/admin_adjustment_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_request_id: requestId, p_admin_id: adminId, p_user_id: String(u.uid), p_asset: coin,
              p_available_delta: availableDeltaText, p_frozen_delta: frozenDeltaText, p_reason: reason, p_request_hash: requestHash })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) {
            const code = rpc.status === 409 ? 'IDEMPOTENCY_CONFLICT' : 'FINANCIAL_RPC_FAILED';
            return json({ ok: false, code: code, msg: 'Balance adjustment was not confirmed by the database. Please check the financial operation log before retrying. Do not repeat the operation directly.' }, rpc.status === 400 ? 400 : 503);
          }
          return json({ ok: true, msg: result.duplicate ? 'This fund operation has already been processed. It was not executed again.' : (mode === 'freeze' ? 'Funds moved to frozen balance.' : mode === 'unfreeze' ? 'Frozen funds returned to available balance.' : 'Balance adjusted through the financial ledger.'), operation_id: result.operation_id, duplicate: !!result.duplicate, balances: { [coin]: { free: result.available, frozen: result.frozen } } });
        } catch (e) {
          return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Did not fall back to the legacy balance system. Please check the operation log.' }, 503);
        }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Balance was unchanged.' }, 503);
    }

    // POST /api/admin/user/freeze 冻结/解冻
    if (sub === 'user/freeze' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      const frozen = body.frozen === true;
      if (body.frozen !== true && body.frozen !== false) return json({ ok: false, code: 'INVALID_FREEZE_STATE', msg: 'Invalid account state parameter.' }, 400);
      const reason = String(body.reason || '').trim().slice(0, 200);
      if (!reason) return json({ ok: false, code: 'ADMIN_REASON_REQUIRED', msg: frozen ? 'A reason is required to freeze an account.' : 'A reason is required to unfreeze an account.' }, 400);
      if (!!u.frozen === frozen) return json({ ok: false, code: 'ACCOUNT_STATE_UNCHANGED', msg: frozen ? 'Account is already frozen.' : 'Account is already active.' }, 409);
      u.frozen = frozen;
      u.frozen_reason = frozen ? reason : '';
      auditAdmin(frozen ? 'user_freeze' : 'user_unfreeze', u.uid, reason);
      await saveDB(db);
      return json({ ok: true, msg: u.frozen ? 'Account frozen.' : 'Account unfrozen.' });
    }

    // POST /api/admin/user/reset-pwd
    if (sub === 'user/reset-pwd' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (Array.isArray(u.auth_providers) && u.auth_providers.length) return json({ ok: false, code: 'SUPABASE_AUTH_MANAGED', msg: 'This account is managed by Supabase Auth. Password cannot be reset through the local admin panel. Please use the trusted Supabase Auth management flow.' }, 409);
      const newPassword = String(body.new_password || '');
      if (newPassword.length < 12 || newPassword.length > 256) return json({ ok: false, msg: 'Admin password reset must be 12-256 characters.' }, 400);
      u.salt = genSalt();
      u.password_hash = hashPassword(newPassword, u.salt);
      Object.keys(db.sessions || {}).forEach(function (token) { if (db.sessions[token].uid === u.uid) delete db.sessions[token]; });
      auditAdmin('user_password_reset', u.uid, 'Admin reset login password; existing sessions invalidated.');
      await saveDB(db);
      return json({ ok: true, msg: 'Password has been reset. The user must sign in again.' });
    }

    // POST /api/admin/user/reset-email
    if (sub === 'user/reset-email' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (Array.isArray(u.auth_providers) && u.auth_providers.length) return json({ ok: false, code: 'SUPABASE_AUTH_MANAGED', msg: 'This account is managed by Supabase Auth. Email cannot be changed locally only. Please use the trusted Supabase Auth management flow.' }, 409);
      const newEmail = String(body.new_email || '').trim().toLowerCase();
      if (newEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return json({ ok: false, msg: 'Please enter a valid email address.' }, 400);
      const duplicate = Object.values(db.users).some(function (other) { return other.uid !== u.uid && String(other.email || '').toLowerCase() === newEmail; });
      if (duplicate) return json({ ok: false, msg: 'This email is already used by another account.' }, 409);
      const previousEmail = u.email;
      u.email = newEmail;
      auditAdmin('user_email_change', u.uid, JSON.stringify({ from: previousEmail, to: newEmail }));
      await saveDB(db);
      return json({ ok: true, msg: 'Email updated successfully.' });
    }

    // POST /api/admin/deposit/confirm — explicit administrator manual credit.
    // This is an audited admin action, not a user-facing deposit confirmation.
    if (sub === 'deposit/confirm' && method === 'POST') {
      // Admin manual credit is available only through the atomic ledger RPC after
      // the complete read/write cutover is explicitly enabled. No legacy fallback.
      if (!financialWritesEnabled()) {
        return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Manual credit was not executed.' }, 503);
      }
      const uid = String(body.uid || '').trim();
      const coin = String(body.coin || 'USDT').trim().toUpperCase();
      const amount = Number(body.amount);
      const reference = String(body.reference || '').trim().slice(0, 120);
      const note = String(body.note || '').trim().slice(0, 300);
      const idempotencyKey = String(body.idempotency_key || '').trim();
      const u = db.users[uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (!['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC'].includes(coin)) return json({ ok: false, msg: 'Coin not supported.' }, 400);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !/^\d+(?:\.\d{1,12})?$/.test(String(body.amount || '').trim())) {
        return json({ ok: false, msg: 'Invalid deposit amount. Must be a valid number greater than 0.' }, 400);
      }
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) return json({ ok: false, msg: 'Invalid credit request ID. Please try again.' }, 400);
      const adminId = String(process.env.ADMIN_USER || '').trim();
      if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Manual credit was not executed.' }, 503);
      const amountText = String(body.amount).trim();
      const requestHash = crypto.createHash('sha256').update([adminId, uid, coin, amountText, reference, note].join('|')).digest('hex');
      const depositId = 'MD' + crypto.randomBytes(16).toString('hex');
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const rpc = await fetch(base + '/rest/v1/rpc/admin_manual_deposit_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_deposit_id: depositId, p_admin_id: adminId, p_user_id: uid, p_asset: coin, p_amount: amountText, p_request_id: idempotencyKey, p_request_hash: requestHash, p_reference: reference, p_note: note }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.deposit_id) return json({ ok: false, code: rpc.status === 409 ? 'IDEMPOTENCY_CONFLICT' : 'FINANCIAL_RPC_FAILED', msg: 'Manual credit was not confirmed by the database. Please check the financial operation log before retrying. Do not repeat the operation directly.' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, deposit_id: result.deposit_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? 'This credit request has already been processed. It was not credited again.' : 'Manual credit processed through the financial ledger.' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Credit result is unconfirmed. Please check the operation log.' }, 503); }
    }

    // POST /api/admin/withdraw/approve
    // Manual admin review only; no chain broadcast. Refuse ambiguous IDs rather than
    // accidentally approving more than one record with the same identifier.
    if (sub === 'withdraw/approve' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not reviewed and funds were unchanged.' }, 503);
      const wdId = String(body.id || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: 'Withdrawal record ID is invalid' }, 400);
      if (manualDepositRpcEnabled()) {
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Withdrawal was not reviewed.' }, 503);
        const adminId = String(process.env.ADMIN_USER || '').trim();
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Withdrawal was not reviewed.' }, 503);
        try {
          const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/review_withdrawal_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_approve: true, p_reason: 'Admin manually approved; on-chain broadcast not executed.' })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Withdrawal review was not confirmed by the database. Please check the operation log.' }, 503);
          if (result.status !== 'approved') return json({ ok: false, code: 'WITHDRAWAL_ALREADY_PROCESSED', status: result.status, msg: 'Withdrawal has already been processed. This operation was not executed again.' }, 409);
          return json({ ok: true, duplicate: !!result.duplicate, status: 'approved', msg: result.duplicate ? 'Withdrawal already approved, no duplicate charge' : 'Withdrawal approved, frozen amount deducted; not yet broadcast to the chain' });
        } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Please check the operation log.' }, 503); }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not reviewed and funds were unchanged.' }, 503);
    }

    if (sub === 'withdraw/reject' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not rejected or refunded and funds were unchanged.' }, 503);
      const wdId = String(body.id || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: 'Withdrawal record ID is invalid' }, 400);
      if (manualDepositRpcEnabled()) {
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Withdrawal was not rejected or refunded.' }, 503);
        const adminId = String(process.env.ADMIN_USER || '').trim();
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Withdrawal was not rejected or refunded.' }, 503);
        const reason = String(body.reason || 'Admin rejected withdrawal.').trim().slice(0, 200) || 'Admin rejected withdrawal.';
        try {
          const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/review_withdrawal_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_approve: false, p_reason: reason })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Withdrawal rejection was not confirmed by the database. Please check the operation log.' }, 503);
          if (result.status !== 'rejected') return json({ ok: false, code: 'WITHDRAWAL_ALREADY_PROCESSED', status: result.status, msg: 'Withdrawal has already been processed. This refund was not executed again.' }, 409);
          return json({ ok: true, duplicate: !!result.duplicate, status: 'rejected', msg: result.duplicate ? 'Withdrawal was previously rejected. No duplicate refund was issued.' : 'Withdrawal rejected. Frozen principal and fees returned to available balance.' });
        } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Please check the operation log.' }, 503); }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not rejected or refunded and funds were unchanged.' }, 503);
    }

    if (sub === 'kyc/approve' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (!u.kyc || typeof u.kyc !== 'object') u.kyc = {};
      const status = String(u.kyc.status || 'unsubmitted');
      const override = body.admin_override === true;
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (status !== 'pending' && !override) return json({ ok: false, code: 'KYC_EXCEPTION_REQUIRED', msg: 'Only pending applications can be approved directly. Other states require the admin exception flow with a reason.' }, 409);
      if (override && !reason) return json({ ok: false, code: 'ADMIN_REASON_REQUIRED', msg: 'A reason is required for admin exception approval.' }, 400);
      if (status === 'pending' && override && !reason) return json({ ok: false, code: 'ADMIN_REASON_REQUIRED', msg: 'A reason is required for admin exception approval.' }, 400);
      u.kyc.status = 'approved';
      u.kyc.reviewed_by = 'admin';
      u.kyc.reviewed_at = nowStr();
      u.kyc.reject_reason = '';
      u.kyc.review_reason = override ? reason : 'Approved pending identity verification application.';
      auditAdmin(override ? 'kyc_approve_exception' : 'kyc_approve', u.uid, override ? reason : 'Admin approved pending identity verification application.');
      await saveDB(db);
      return json({ ok: true, msg: override ? 'KYC approved via admin exception; reason recorded.' : 'KYC approved.' });
    }

    // POST /api/admin/kyc/reject
    if (sub === 'kyc/reject' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (!u.kyc || typeof u.kyc !== 'object') u.kyc = {};
      // Business rule: the administrator may reject/set the final status without a pending submission.
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (!reason) return json({ ok: false, msg: 'Please provide a rejection reason.' }, 400);
      u.kyc.status = 'rejected';
      u.kyc.reject_reason = reason;
      u.kyc.reviewed_by = 'admin';
      u.kyc.reviewed_at = nowStr();
      auditAdmin('kyc_reject', u.uid, reason);
      await saveDB(db);
      return json({ ok: true, msg: 'KYC rejected.' });
    }

    // POST /api/admin/push 推送站内信
    if (sub === 'push' && method === 'POST') {
      const content = String(body.content || '').trim();
      if (!content || content.length > 2000) return json({ ok: false, msg: 'Message content is required and cannot exceed 2,000 characters.' }, 400);
      if (body.uid) {
        const u = db.users[body.uid];
        if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
        if (!Array.isArray(u.support_messages)) u.support_messages = [];
        u.support_messages.push({ id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'admin', content: content, time: nowStr() });
      } else {
        Object.values(db.users).forEach(function (u) {
          if (!Array.isArray(u.support_messages)) u.support_messages = [];
          u.support_messages.push({ id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'admin', content: content, time: nowStr() });
        });
      }
      auditAdmin('admin_push_message', body.uid || 'all', JSON.stringify({ target: body.uid ? 'single_user' : 'all_users', length: content.length }));
      await saveDB(db);
      return json({ ok: true, msg: 'Message sent.' });
    }

    // POST /api/admin/support/reply 回复客服
    if (sub === 'support/reply' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' });
      u.support_messages.push({ id: 'M' + Date.now(), from: 'admin', content: body.content || '', time: nowStr() });
      await saveDB(db);
      return json({ ok: true, msg: 'Reply sent.' });
    }

    // GET /api/admin/addresses — sensitive fields visible only to authenticated admin
    if (sub === 'addresses' && method === 'GET') {
      const list=[];
      Object.values(db.users).forEach(function(u){(u.addresses||[]).forEach(function(a){list.push(Object.assign({},a,{uid:u.uid,email:u.email}));});});
      list.sort(function(a,b){return a.created_at < b.created_at ? 1 : -1;});
      return json({ok:true,addresses:list.slice(0,500)});
    }
    // POST /api/admin/address/manage — immutable for users, admin actions are audited
    if (sub === 'address/manage' && method === 'POST') {
      const target=Object.values(db.users).find(function(u){return (u.addresses||[]).some(function(a){return a.id===body.id;});});
      if(!target) return json({ok:false,msg:'Address record not found.'},404);
      const addr=target.addresses.find(function(a){return a.id===body.id;});
      const action=String(body.action||'');
      if(action==='flag') addr.flagged=!!body.value;
      else if(action==='block') addr.blocked=!!body.value;
      else if(action==='delete') target.addresses=target.addresses.filter(function(a){return a.id!==body.id;});
      else if(action==='unbind') addr.unbound=true;
      else if(action==='update') {
        if(addr.type==='crypto') {
          const newAddress=String(body.address||'').trim();
          const coin=String(body.coin||addr.coin||'').toUpperCase();
          const network=String(body.network||addr.network||'').toUpperCase();
          const allowedNetworks={BTC:['BTC'],ETH:['ERC20'],USDT:['TRC20','ERC20','BEP20'],SOL:['SOL'],BNB:['BEP20'],USDC:['ERC20']};
          if(!newAddress || !allowedNetworks[coin] || !allowedNetworks[coin].includes(network)) return json({ok:false,msg:'Operation failed.'},400);
          let valid=false;
          if(coin==='BTC') valid=/^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(newAddress);
          else if(network==='ERC20'||network==='BEP20') valid=/^0x[a-fA-F0-9]{40}$/.test(newAddress);
          else if(network==='TRC20') valid=/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(newAddress);
          else if(coin==='SOL') valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(newAddress);
          if(!valid) return json({ok:false,msg:'Operation failed.'},400);
          addr.address=newAddress; addr.coin=coin; addr.network=network; addr.unbound=false;
        } else {
          const fields=['account_holder','bank_name','account_number','routing_number','swift','bank_address','note'];
          fields.forEach(function(k){if(typeof body[k]==='string') addr[k]=body[k].trim();});
          if(body.account_number!==undefined && !/^\d{4,34}$/.test(String(body.account_number).replace(/\s/g,''))) return json({ok:false,msg:'Operation failed.'},400);
          if(body.routing_number!==undefined && !/^\d{9}$/.test(String(body.routing_number).replace(/\s/g,''))) return json({ok:false,msg:'Operation failed.'},400);
          if(body.swift!==undefined && body.swift && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(body.swift).toUpperCase())) return json({ok:false,msg:'Operation failed.'},400);
          if(body.account_number!==undefined) addr.account_number=String(body.account_number).replace(/\s/g,'');
          if(body.routing_number!==undefined) addr.routing_number=String(body.routing_number).replace(/\s/g,'');
          if(body.swift!==undefined) addr.swift=String(body.swift).toUpperCase();
        }
      } else return json({ok:false,msg:'Unknown operation.'},400);
      if(!Array.isArray(target.address_audit)) target.address_audit=[];
      target.address_audit.push({id:'L'+Date.now(),action:action,address_id:body.id,by:'admin',time:nowStr(),detail:String(body.reason||'').slice(0,200)});
      if(!Array.isArray(db.audit_logs)) db.audit_logs=[];
      db.audit_logs.push({id:'AL'+Date.now(),action:'address_'+action,uid:target.uid,address_id:body.id,by:'admin',time:nowStr(),detail:String(body.reason||'').slice(0,200)});
      await saveDB(db);
      return json({ok:true,msg:'Submitted successfully.'});
    }
    if (sub === 'audit-logs' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const limitValue = Number(params.limit || 100);
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitValue) ? Math.floor(limitValue) : 100));
      const actionFilter = String(params.action || '').trim().slice(0, 100);
      const uidFilter = String(params.uid || '').trim().slice(0, 100);
      const before = String(params.before || '').trim().slice(0, 100);
      let logs = (Array.isArray(db.audit_logs) ? db.audit_logs : []).slice().reverse();
      if (actionFilter) logs = logs.filter(function (entry) { return String(entry.action || '') === actionFilter; });
      if (uidFilter) logs = logs.filter(function (entry) { return String(entry.uid || '') === uidFilter; });
      if (before) {
        const beforeIndex = logs.findIndex(function (entry) { return String(entry.id || '') === before; });
        if (beforeIndex >= 0) logs = logs.slice(beforeIndex + 1);
      }
      const page = logs.slice(0, limit);
      return json({ ok: true, logs: page, next_before: page.length === limit ? String(page[page.length - 1].id || '') : null });
    }

    // GET /api/admin/config
    if (sub === 'config' && method === 'GET') {
      return json({ ok: true, deposit_addresses: safeDepositAddresses(db.deposit_addresses), announcement: db.announcement || '' });
    }

    // POST /api/admin/config 更新充值地址和公告。只接受已知网络且格式有效的地址，
    // 避免误把占位符/错误网络地址保存为可供用户使用的充值地址。
    if (sub === 'config' && method === 'POST') {
      const allowedDepositKeys = {
        'USDT-TRC20': function (v) { return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v); },
        'USDT-ERC20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'USDT-BEP20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'BTC-BTC': function (v) { return /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v); },
        'ETH-ERC20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'SOL-SOL': function (v) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v); },
        'BNB-BEP20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'USDC-ERC20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
      };
      const updates = body.deposit_addresses;
      const changedKeys = [];
      if (updates !== undefined) {
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return json({ ok: false, msg: 'Invalid deposit address configuration format.' }, 400);
        for (const key of Object.keys(updates)) {
          if (!Object.prototype.hasOwnProperty.call(allowedDepositKeys, key)) return json({ ok: false, msg: 'Unsupported deposit network configuration found.' }, 400);
          const value = typeof updates[key] === 'string' ? updates[key].trim() : '';
          if (value && (/PLACEHOLDER|TPLACEHOLDER/i.test(value) || !allowedDepositKeys[key](value))) {
            return json({ ok: false, msg: 'Invalid deposit address format: ' + key }, 400);
          }
          changedKeys.push(key);
        }
      }
      if (updates !== undefined) db.deposit_addresses = Object.assign({}, db.deposit_addresses, Object.fromEntries(Object.keys(updates).map(function (key) { return [key, updates[key].trim()]; })));
      if (typeof body.announcement === 'string') {
        if (body.announcement.length > 2000) return json({ ok: false, msg: 'Announcement cannot exceed 2,000 characters.' }, 400);
        db.announcement = body.announcement.trim();
      }
      auditAdmin('system_config_update', 'system', JSON.stringify({ deposit_address_keys: changedKeys, announcement_updated: typeof body.announcement === 'string' }));
      await saveDB(db);
      return json({ ok: true, msg: 'Configuration updated.', deposit_addresses: safeDepositAddresses(db.deposit_addresses), announcement: db.announcement });
    }


    // POST /api/admin/withdraw/mark-paid — staff has already sent the funds manually.
    if (sub === 'withdraw/mark-paid' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Payout status was not changed.' }, 503);
      const wdId = String(body.id || '').trim();
      const reference = String(body.reference || '').trim();
      const note = String(body.note || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: 'Withdrawal record ID is invalid.' }, 400);
      if (!reference) return json({ ok: false, code: 'PAYOUT_REFERENCE_REQUIRED', msg: 'TxID / payout reference is required.' }, 400);
      if (reference.length > 160 || note.length > 300) return json({ ok: false, msg: 'Payout reference or note is too long.' }, 400);
      const adminId = String(process.env.ADMIN_USER || '').trim();
      if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Payout status was not changed.' }, 503);
      try {
        const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/mark_withdrawal_paid_atomic', {
          method: 'POST', headers: supabaseHeaders(),
          body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_reference: reference, p_note: note })
        });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || result.status !== 'completed') {
          return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Manual payout completion was not confirmed. Check the withdrawal record before retrying.' }, rpc.status === 400 ? 400 : 503);
        }
        return json({ ok: true, duplicate: !!result.duplicate, withdrawal_id: result.withdrawal_id, status: result.status,
          payout_reference: result.payout_reference || '', paid_at: result.paid_at || null,
          msg: result.duplicate ? 'This withdrawal was already marked as paid.' : 'Manual payout completion recorded.' });
      } catch (e) {
        return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Payout status is unconfirmed; check the withdrawal record before retrying.' }, 503);
      }
    }

    // GET /api/admin/withdrawals 待审核提现列表
    if (sub === 'withdrawals' && method === 'GET') {
      if (financialPostgresReadsEnabled()) {
        try {
          const snapshot = await readAdminWithdrawalSnapshot();
          const usersById = db.users || {};
          const list = snapshot.withdrawals.map(function (w) {
            const legacyUser = Object.values(usersById).find(function (u) { return String(u.uid) === String(w.uid); });
            return Object.assign({}, w, { email: legacyUser ? (legacyUser.email || '') : '' });
          });
          return json({ ok: true, withdrawals: list, source: 'postgres_financial_ledger' });
        } catch (e) {
          return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503);
        }
      }
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (Array.isArray(u.withdrawals) ? u.withdrawals : []).forEach(function (w) {
          if (w.status === 'pending' || w.status === 'approved_pending_broadcast') list.push({ id: w.id, uid: u.uid, email: u.email, coin: w.coin, amount: w.amount, fee: w.fee || 0, network: w.network, address: w.address, status: w.status, txid: w.txid || '', time: w.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, withdrawals: list });
    }
    // GET /api/admin/orders 全部订单。When the matching engine is requested,
    // never silently show legacy JSON orders: they would omit orders written to PostgreSQL.
    if (sub === 'orders' && method === 'GET') {
      if (matchingEngineRequested()) {
        if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Order query is unavailable until matching engine cutover is approved.' }, 503);
        try {
          const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
          const query = new URLSearchParams({
            select: 'id,user_id,base_asset,quote_asset,side,price,quantity,remaining_quantity,status,created_at,updated_at',
            order: 'created_at.desc', limit: '200'
          });
          const response = await fetch(base + '/rest/v1/financial_matching_orders?' + query.toString(), { headers: supabaseHeaders() });
          const rows = await response.json().catch(() => null);
          if (!response.ok || !Array.isArray(rows)) return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503);
          const usersById = new Map(Object.values(db.users).map(function (u) { return [String(u.uid), u]; }));
          const orders = rows.map(function (o) {
            const owner = usersById.get(String(o.user_id));
            return { id: o.id, uid: o.user_id, email: owner ? (owner.email || '') : '',
              symbol: o.base_asset + '/' + o.quote_asset, side: o.side, type: 'limit', price: o.price,
              amount: o.quantity, remaining_quantity: o.remaining_quantity,
              status: o.status === 'cancelled' ? 'canceled' : o.status, time: o.created_at, updated_at: o.updated_at };
          });
          return json({ ok: true, orders: orders, source: 'postgres_financial_matching' });
        } catch (e) {
          return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503);
        }
      }
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (Array.isArray(u.orders) ? u.orders : []).forEach(function (o) {
          list.push({ id: o.id, uid: u.uid, email: u.email, symbol: o.symbol, side: o.side, type: o.type, price: o.price, amount: o.amount, status: o.status, time: o.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, orders: list.slice(0, 200), source: 'legacy_state' });
    }
    // GET /api/admin/support/messages 客服消息
    if (sub === 'support/messages' && method === 'GET') {
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (Array.isArray(u.support_messages) ? u.support_messages : []).filter(function(m){return m.from==='user';}).forEach(function (m) {
          list.push({ id: m.id, uid: u.uid, email: u.email, content: m.content, time: m.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, messages: list.slice(0, 100) });
    }
    return json({ ok: false, msg: 'Unknown admin endpoint: ' + sub }, 404);
  }

  return json({ ok: false, msg: 'Endpoint not found: ' + method + ' /' + path }, 404);
  } catch (e) {
    if (e && e.message === 'Persistent storage write conflict') {
      return json({ ok: false, msg: 'Data changed recently. Please refresh and try again.', code: 'STORAGE_CONFLICT' }, 409);
    }
    // Do not expose internal storage, provider, or database error details to clients.
    return json({ ok: false, msg: 'Service temporarily unavailable. Please try again later.', code: 'INTERNAL_ERROR' }, 500);
  }
}

// Serialize requests within one warm function instance. 这不是跨实例锁，也不能替代事务数据库。
// It reduces same-instance overlap only and does not replace database transactions.
let requestQueue = Promise.resolve();
exports.handler = function (event, context) {
  const run = requestQueue.then(
    () => handleRequest(event, context),
    () => handleRequest(event, context)
  );
  requestQueue = run.then(() => undefined, () => undefined);
  return run;
};
// 导出纯函数供后端单元测试（无网络/无 DB 依赖）。
exports._test = {
  depositAddressFromEnv: depositAddressFromEnv,
  DEPOSIT_ADDRESS_ENV_KEYS: DEPOSIT_ADDRESS_ENV_KEYS,
  getPublishableKey: getPublishableKey,
  validateFundPassword: validateFundPassword,
  validateAdminPasswordStrength: validateAdminPasswordStrength,
  parseMoneyInput: parseMoneyInput,
  withdrawalAddressCheck: withdrawalAddressCheck,
  withdrawalRequiresAdminReview: withdrawalRequiresAdminReview,
  secondsSettlementError: secondsSettlementError,
  estimateUsdtValue: estimateUsdtValue,
  secCounterIsLocked: secCounterIsLocked,
  secCounterRecordFailure: secCounterRecordFailure,
  secCounterReset: secCounterReset,
};
