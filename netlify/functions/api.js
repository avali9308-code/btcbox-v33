// BTCBOX 统一 API Handler (Netlify Function)
// 替代原 Python server.py，数据持久化到 Netlify Blobs
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const STORE_KEY = 'btcbox_data_v1';
const SESSION_COOKIE = 'session_token';
const PBKDF2_ITER = 100000;
const PBKDF2_KEYLEN = 32;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIVE_PRICE_CACHE_MS = 15000;
let livePriceCache = { expiresAt: 0, prices: {} };

// ===== 数据层（失败时关闭；不使用陈旧缓存处理可变数据）=====
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

// Partial financial cutover is deliberately blocked: a write-RPC flag alone must never enable it.
// User/admin balance and history reads still use btcbox_state, so switching writes
// to the normalized ledger without an explicit full-cutover approval would split
// financial authority and show stale balances/history. Keep the default fail-closed.
function manualDepositRpcEnabled() {
  return process.env.FINANCIAL_POSTGRES_RPC_ENABLED === '1' &&
    process.env.FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED === '1';
}

function financialPostgresReadsEnabled() {
  return manualDepositRpcEnabled() && process.env.FINANCIAL_POSTGRES_READS_ENABLED === '1';
}

// Every balance-changing route requires the same complete cutover contract:
// explicit full-cutover approval, normalized PostgreSQL reads, and DB credentials.
// This prevents a partial environment configuration from enabling writes while
// account balances or admin queues are still served from the legacy state store.
function financialWritesEnabled() {
  return financialPostgresReadsEnabled() && supabaseStorageConfigured();
}

// Matching remains opt-in and requires the same approved, authoritative PostgreSQL cutover.
// A flag alone is not sufficient to bypass the global financial read/write guards.
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
const SECONDS_ALLOWED_DURATIONS = new Set([30, 60, 300, 900]);
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
      if (!['USDT', 'BTC', 'ETH', 'SOL'].includes(asset)) throw new Error('Admin account balance response invalid');
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
        return attachRevision(JSON.parse(JSON.stringify(rows[0].data)), rows[0].revision);
      }
      // Fail closed: never treat an empty Supabase table as a fresh exchange database.
      // This prevents accidental balance/history loss if secrets are configured before import.
      throw new Error('Supabase state is not initialized');
    }
    const store = getStore('btcbox');
    const raw = await store.get(STORE_KEY, { type: 'json' });
    if (raw && raw.users) return JSON.parse(JSON.stringify(raw));
    return defaultDB();
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
    const store = getStore('btcbox');
    await store.setJSON(STORE_KEY, db);
  } catch (e) {
    if (e && e.message === 'Persistent storage write conflict') throw e;
    throw new Error('Persistent storage write failed');
  }
}

function defaultDB() {
  return {
    users: {},        // uid -> user object
    sessions: {},     // token -> {uid, email, created_at}
    next_uid: 16588,
    // Never seed fake deposit addresses into a new state document. Missing
    // addresses remain empty and the deposit route fails closed until an
    // administrator configures a validated address for that exact network.
    deposit_addresses: {
      "USDT-TRC20": process.env.DEPOSIT_USDT_TRC20 || "",
      "USDT-ERC20": process.env.DEPOSIT_USDT_ERC20 || "",
      "USDT-BEP20": process.env.DEPOSIT_USDT_BEP20 || "",
      "BTC-Bitcoin": process.env.DEPOSIT_BTC || "",
      "ETH-ERC20": process.env.DEPOSIT_ETH || "",
      "SOL-Solana": process.env.DEPOSIT_SOL || "",
    },
    captcha: {},      // token -> {code, exp}
  };
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
  // New records store only a salted PBKDF2 hash. Upgrade legacy plaintext records
  // after a successful comparison; caller persists the changed user with its transaction.
  if (user.fund_password_hash && user.fund_password_salt) {
    const actual = Buffer.from(hashFundPassword(supplied, user.fund_password_salt), 'hex');
    const expected = Buffer.from(String(user.fund_password_hash), 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }
  if (typeof user.fund_password === 'string' && user.fund_password.length > 0) {
    const a = Buffer.from(supplied, 'utf8');
    const b = Buffer.from(user.fund_password, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const salt = genSalt();
    user.fund_password_salt = salt;
    user.fund_password_hash = hashFundPassword(supplied, salt);
    delete user.fund_password;
    return true;
  }
  return false;
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
  return json({ ok: false, code: 'RATE_LIMITED', msg: '请求过于频繁，请稍后再试', retry_after: retryAfter }, 429, { 'Retry-After': String(retryAfter) });
}
// The public product locale is English-only. Normalize fixed API status copy at
// the response boundary so legacy route messages cannot leak CJK text into UI.
// User-authored content and data fields are intentionally left untouched.
const API_ENGLISH_MESSAGES = new Map([
  ['未登录','Please log in to continue.'], ['管理员认证失败','Administrator authentication failed.'],
  ['账户已被冻结','This account is frozen.'], ['账户已被冻结，暂不能交易秒合约','This account is frozen and cannot open short-term contracts.'],
  ['秒合约尚未完成资金安全切换，本次未冻结资金、未创建持仓。','Short-term contracts are unavailable until financial cutover is complete. No funds were frozen and no position was created.'],
  ['秒合约尚未完成资金安全切换，本次未结算。','Short-term contracts are unavailable until financial cutover is complete. This position was not settled.'],
  ['秒合约尚未完成资金安全切换，暂无持仓数据。','Short-term contract data is unavailable until financial cutover is complete.'],
  ['交易对暂不支持秒合约','This trading pair is not supported for short-term contracts.'], ['交易方向无效','Invalid trade direction.'],
  ['合约时长无效','Invalid contract duration.'], ['投入金额无效','Invalid investment amount.'],
  ['缺少有效的请求编号（16-100位）。','A valid request ID (16–100 characters) is required.'],
  ['当前参考价格暂不可用，未创建订单。','The reference price is currently unavailable. No order was created.'],
  ['结算参考价格暂不可用；订单保持未结算，请稍后重试。','The settlement reference price is unavailable. The position remains unsettled; please try again later.'],
  ['数据库未确认秒合约开仓；资金未变更，请检查后重试。','The database did not confirm the contract order. Funds were not changed; verify the order status before retrying.'],
  ['财务数据库暂不可用；开仓结果未确认，资金未变更。','The financial database is unavailable. The order is unconfirmed and funds were not changed.'],
  ['数据库未确认秒合约结算；请稍后重试。','The database did not confirm settlement. Please try again later.'],
  ['财务数据库暂不可用；结算结果未确认。','The financial database is unavailable. Settlement remains unconfirmed.'],
  ['秒合约持仓查询失败。','Failed to retrieve short-term contract positions.'], ['财务数据库暂不可用。','The financial database is unavailable.'],
  ['交易对无效','Invalid trading pair.'], ['持仓编号无效','Invalid position ID.'], ['结算完成','Settlement completed.'],
  ['该结算请求已处理','This settlement request has already been processed.'], ['持仓未到期，暂不能结算','This position has not reached maturity and cannot be settled yet.'],
  ['开仓成功，资金已冻结','Position opened successfully. Funds have been reserved.'], ['该开仓请求已处理，请勿重复提交','This order request has already been processed. Do not submit it again.'],
  ['请求过于频繁，请稍后再试','Too many requests. Please try again later.'], ['请输入消息内容','Please enter a message.'],
  ['消息内容不能超过2000个字符','Messages cannot exceed 2,000 characters.'], ['请求内容格式无效','Invalid request format.'],
  ['网络异常，请稍后重试','Network error. Please try again later.'], ['操作失败','The operation failed.'], ['提交成功','Submitted successfully.'],
  ['加载失败，请刷新重试','Could not load data. Refresh and try again.'], ['数据库未确认秒合约结算；请稍后重试。','The database did not confirm settlement. Please try again later.']
]);
function normalizeApiMessages(value) {
  if (Array.isArray(value)) return value.map(normalizeApiMessages);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'msg' && typeof item === 'string' && /[\u3400-\u9fff]/.test(item)) {
      out[key] = API_ENGLISH_MESSAGES.get(item) || (item.includes('成功') || item.includes('已提交') || item.includes('已处理') ? 'Operation completed successfully.' : 'The request could not be completed. Please try again.');
    } else {
      out[key] = normalizeApiMessages(item);
    }
  }
  return out;
}
function json(obj, status, headers) {
  const normalized = normalizeApiMessages(obj);
  return {
    statusCode: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' }, headers || {}),
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
function getUser(db, event) {
  const cookies = parseCookies(event);
  const token = cookies[SESSION_COOKIE];
  const session = token && db.sessions[token];
  if (!session) return null;
  const createdAt = Number(session.created_at);
  if (!Number.isFinite(createdAt) || createdAt <= 0 || Date.now() - createdAt > SESSION_MAX_AGE_MS) return null;
  return db.users[session.uid] || null;
}
function emptyBalances() {
  return {
    USDT: { free: 0, frozen: 0 },
    BTC: { free: 0, frozen: 0 },
    ETH: { free: 0, frozen: 0 },
    SOL: { free: 0, frozen: 0 },
  };
}
function safeDepositAddresses(addresses) {
  const source = addresses && typeof addresses === 'object' && !Array.isArray(addresses) ? addresses : {};
  const result = {};
  for (const key of ['USDT-TRC20', 'USDT-ERC20', 'USDT-BEP20', 'BTC-Bitcoin', 'ETH-ERC20', 'SOL-Solana']) {
    const value = typeof source[key] === 'string' ? source[key].trim() : '';
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
function parseMoneyInput(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function genTotpSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * 32)];
  return s;
}

// ===== 路由 =====
async function handleRequest(event, context) {
  // 解析路径：去掉 /.netlify/functions/api 前缀，得到如 /account, /support/messages
  let path = event.path || '';
  path = path.replace(/^\/\.netlify\/functions\/api\/?/, '').replace(/^\/api\/?/, '');
  const method = event.httpMethod || 'GET';
  try {
  // Public, read-only deployment preflight. Reports booleans only; never returns keys or secrets.
  // Keep this before loadDB so Auth can be diagnosed even if financial persistence is unavailable.
  if (path === 'auth-health' && method === 'GET') {
    const authUrl = String(process.env.SUPABASE_AUTH_URL || '').replace(/\/+$/, '');
    const authKey = process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_AUTH_ANON_KEY || '';
    const expectedAuthUrl = 'https://zlozsutefnmgwwzrlipt.supabase.co';
    const configured = Boolean(authUrl && authKey);
    const projectMatches = authUrl === expectedAuthUrl;
    return json({
      ok: configured && projectMatches,
      service: 'btcbox-auth-preflight',
      auth_environment_configured: configured,
      auth_project_matches_expected: projectMatches,
      provider_enabled: null,
      provider_enabled_note: 'Must be verified in Supabase Dashboard > Authentication > Providers > Google',
      live_oauth_tested: false
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
      return json({ ok: false, msg: '请求内容格式无效', code: 'INVALID_REQUEST_BODY' }, 400);
    }
    // Bound parsing cost and memory use for all API endpoints.
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) {
      return json({ ok: false, msg: '请求内容过大', code: 'REQUEST_BODY_TOO_LARGE' }, 413);
    }
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return json({ ok: false, msg: '请求内容不是有效的 JSON', code: 'INVALID_JSON' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ ok: false, msg: '请求内容必须是 JSON 对象', code: 'INVALID_JSON_OBJECT' }, 400);
    }
  }

  let db;
  try { db = await loadDB(); } catch(e) { return json({ ok: false, msg: '网络异常', code: 'PERSISTENCE_UNAVAILABLE' }, 503); }
  if (!db) return json({ ok: false, msg: '网络异常', code: 'PERSISTENCE_UNAVAILABLE' }, 503);

  // ---------- GET /api/config ----------
  if (path === 'config' && method === 'GET') {
    return json({
      ok: true,
      google_mock_enabled: process.env.ALLOW_GOOGLE_MOCK === '1',
      site: { name: 'BTCBOX', version: 'netlify-1.0' },
      announcement: db.announcement || '',
      supabase_auth_url: process.env.SUPABASE_AUTH_URL || '',
      supabase_auth_publishable_key: process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_AUTH_ANON_KEY || '',
    });
  }

  // ---------- POST /api/captcha ----------
  if (path === 'captcha' && method === 'POST') {
    // Never disclose a challenge answer in a public API response. This legacy
    // endpoint has no configured delivery provider, so fail closed rather than
    // pretending that a client-readable code is bot protection.
    return json({ ok: false, code: 'VERIFICATION_UNAVAILABLE', msg: 'Verification is temporarily unavailable. Please try again later.' }, 503);
  }

  // ---------- POST /api/register ----------
  if (path === 'register' && method === 'POST') {
    // Legacy local registration marks email as verified without proving mailbox
    // ownership. Disable it by default until a real email-verification flow is
    // configured. The opt-in is intended only for isolated development systems.
    if (process.env.ALLOW_UNVERIFIED_LEGACY_REGISTRATION !== '1') {
      return json({ ok: false, code: 'EMAIL_VERIFICATION_REQUIRED', msg: 'Registration is temporarily unavailable while secure email verification is configured. Please try again later.' }, 503);
    }
    const email = (body.email || '').trim().toLowerCase();
    const pwd = body.password || '';
    { const rl = rateCheck('register:' + clientIp(event), 30, 10 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, msg: '邮箱格式不正确' });
    if (pwd.length < 6) return json({ ok: false, msg: '密码至少6位' });
    const exists = Object.values(db.users).find(function (u) { return u.email === email; });
    if (exists) return json({ ok: false, msg: '该邮箱已注册' });
    const uid = String(db.next_uid++);
    const salt = genSalt();
    db.users[uid] = {
      uid: uid, email: email, email_verified: true, addresses: [], address_audit: [],
      password_hash: hashPassword(pwd, salt), salt: salt,
      fund_password: '', twofa_secret: '', twofa_enabled: false,
      kyc: { status: 'unsubmitted', name: '', id_type: 'id_card', id_number: '', submitted_at: '' },
      addresses: [], address_audit: [],
      balances: emptyBalances(),
      orders: [], deposits: [], withdrawals: [], earn_records: [], support_messages: [],
      created_at: nowStr(), last_login: nowStr(),
    };
    // 新用户初始余额为 0，需充值后交易
    const token = genToken();
    db.sessions[token] = { uid: uid, email: email, created_at: Date.now() };
    await saveDB(db);
    return json({ ok: true, uid: uid }, 200, setCookieHeader(token));
  }

  // ---------- POST /api/login ----------
  if (path === 'login' && method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const pwd = body.password || '';
    { const rl = rateCheck('login:' + clientIp(event) + ':' + email, 60, 5 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    const user = Object.values(db.users).find(function (u) { return u.email === email; });
    if (!user) return json({ ok: false, msg: '账号或密码错误' });
    if (hashPassword(pwd, user.salt) !== user.password_hash) return json({ ok: false, msg: '账号或密码错误' });
    if (user.twofa_enabled && !body.twofa_code) {
      const tempToken = genToken();
      db.temp_tokens = db.temp_tokens || {};
      db.temp_tokens[tempToken] = { uid: user.uid, exp: Date.now() + 10 * 60 * 1000 };
      await saveDB(db);
      return json({ ok: true, require_2fa: true, temp_token: tempToken });
    }
    if (user.twofa_enabled && body.twofa_code) {
      { const rl = rateCheck('2fa:' + user.uid, 20, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
      if (!totpVerify(user.twofa_secret, body.twofa_code)) return json({ ok: false, msg: '2FA验证码错误' });
    }
    if (user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: '账户已被冻结，请联系客服' });
    user.last_login = nowStr();
    const token = genToken();
    db.sessions[token] = { uid: user.uid, email: email, created_at: Date.now() };
    await saveDB(db);
    return json({ ok: true }, 200, setCookieHeader(token));
  }

  // ---------- POST /api/supabase-login (Supabase-verified Google OAuth / email magic link) ----------
  if ((path === 'supabase-login' || path === 'google-login') && method === 'POST') {
    const accessToken = typeof body.supabase_access_token === 'string' ? body.supabase_access_token : '';
    const supabaseUrl = String(process.env.SUPABASE_AUTH_URL || '').replace(/\/$/, '');
    const supabaseKey = process.env.SUPABASE_AUTH_ANON_KEY || process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || '';
    if (!supabaseUrl || !supabaseKey) {
      return json({ ok: false, msg: 'Supabase 登录服务尚未完成服务器配置' }, 503);
    }
    if (!accessToken || accessToken.length > 16384) {
      return json({ ok: false, msg: '登录令牌无效，请重新登录' }, 401);
    }
    let identity;
    try {
      const verifyResponse = await fetch(supabaseUrl + '/auth/v1/user', {
        method: 'GET',
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' }
      });
      if (!verifyResponse.ok) return json({ ok: false, msg: '登录令牌验证失败，请重试' }, 401);
      identity = await verifyResponse.json();
    } catch (e) {
      return json({ ok: false, msg: '登录验证服务暂不可用' }, 503);
    }
    const email = String(identity && identity.email || '').trim().toLowerCase();
    const confirmed = !!(identity && (identity.email_confirmed_at || identity.confirmed_at));
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !confirmed) {
      return json({ ok: false, msg: '邮箱尚未验证，无法登录' }, 403);
    }
    // Provider is read from the verified Supabase user response, never trusted from browser input.
    const identityProviders = Array.isArray(identity && identity.identities) ? identity.identities.map(function (i) { return String(i && i.provider || ''); }) : [];
    const authProviders = Array.from(new Set(identityProviders.filter(function (p) { return p === 'google' || p === 'email' || p === 'apple' || p === 'github'; })));
    if (!authProviders.length) authProviders.push('email');
    let user = Object.values(db.users).find(function (u) { return String(u.email || '').trim().toLowerCase() === email; });
    if (user && user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: '账户已被冻结，请联系客服' }, 403);
    // Preserve the legacy account's second factor for Supabase email/OAuth sign-ins.
    // The temporary token can only be exchanged through /api/login/2fa and never creates a session by itself.
    if (user && user.twofa_enabled) {
      const tempToken = genToken();
      db.temp_tokens = db.temp_tokens || {};
      db.temp_tokens[tempToken] = { uid: user.uid, exp: Date.now() + 10 * 60 * 1000 };
      await saveDB(db);
      return json({ ok: false, require_2fa: true, temp_token: tempToken }, 200);
    }
    if (!user) {
      const uid = String(db.next_uid++);
      const salt = genSalt();
      user = {
        uid: uid, email: email, email_verified: true, auth_providers: authProviders, addresses: [], address_audit: [],
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
    if (!rec || rec.exp < Date.now()) return json({ ok: false, msg: '会话已过期，请重新登录' });
    const u2 = db.users[rec.uid];
    if (!u2) return json({ ok: false, msg: '用户不存在' });
    if (u2.frozen) { delete db.temp_tokens[tt]; await saveDB(db); return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: '账户已被冻结，请联系客服' }, 403); }
    { const rl = rateCheck('2fa:' + u2.uid, 20, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!totpVerify(u2.twofa_secret, code)) return json({ ok: false, msg: '2FA验证码错误' });
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
    } catch (_) { return json({ ok: false, code: 'KLINE_DATA_UNAVAILABLE', msg: 'K线数据不可用', klines: [], data: [] }, 503); }
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
      } catch (_) { return json({ ok: false, code: 'DEPTH_DATA_UNAVAILABLE', msg: '盘口数据不可用', bids: [], asks: [] }, 503); }
    }
  }

  // ---------- 以下接口需要登录 ----------
  const user = getUser(db, event);

  // ---------- POST /api/2fa/enable ----------
  if (path === '2fa/enable' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    if (!user.twofa_secret) user.twofa_secret = genTotpSecret();
    await saveDB(db);
    return json({ ok: true, secret: user.twofa_secret, enabled: user.twofa_enabled });
  }
  // ---------- POST /api/2fa/confirm ----------
  if (path === '2fa/confirm' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    if (!totpVerify(user.twofa_secret, body.code || '')) return json({ ok: false, msg: '验证码错误' });
    user.twofa_enabled = true;
    await saveDB(db);
    return json({ ok: true, msg: '2FA已启用' });
  }
  // ---------- POST /api/2fa/disable ----------
  if (path === '2fa/disable' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    if (!totpVerify(user.twofa_secret, body.code || '')) return json({ ok: false, msg: '验证码错误' });
    user.twofa_enabled = false;
    await saveDB(db);
    return json({ ok: true, msg: '2FA已关闭' });
  }

  // ---------- GET /api/account ----------
  if (path === 'account' && method === 'GET') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    let financialSnapshot = null;
    if (financialPostgresReadsEnabled()) {
      try { financialSnapshot = await readFinancialAccountSnapshot(user.uid); }
      catch (e) { return json({ ok: false, msg: '财务账户暂时不可用，请稍后重试', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
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
      kyc: user.kyc,
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
      twofa_enabled: user.twofa_enabled,
      deposit_addresses: safeDepositAddresses(db.deposit_addresses),
      addresses: (user.addresses || []).map(function(a){ const out=Object.assign({},a); if(out.type==='crypto' && out.address) out.address=out.address.length>14?out.address.slice(0,6)+'••••••'+out.address.slice(-6):out.address; if(out.account_number) out.account_number='••••'+out.account_number.slice(-4); if(out.routing_number) out.routing_number='••••'+out.routing_number.slice(-4); return out; }),
    });
  }

  // ---------- GET /api/addresses ----------
  if (path === 'addresses' && method === 'GET') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
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
    if (!user) return json({ok:false,msg:'未登录',need_login:true},401);
    const id=(event.queryStringParameters && event.queryStringParameters.id) || '';
    const a=(user.addresses||[]).find(function(x){return x.id===id;});
    if(!a || a.type!=='crypto' || a.blocked || a.unbound) return json({ok:false,msg:'请联系客服处理'},404);
    return json({ok:true,address:a.address,coin:a.coin,network:a.network});
  }

  // ---------- POST /api/addresses ----------
  if (path === 'addresses' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    const type = body.type === 'bank' ? 'bank' : 'crypto';
    const note = String(body.note || '').trim().slice(0,80);
    let record;
    if (type === 'crypto') {
      const coin = String(body.coin || '').toUpperCase();
      const network = String(body.network || '').toUpperCase();
      const address = String(body.address || '').trim();
      const allowed = { BTC:['BTC'], ETH:['ERC20'], USDT:['TRC20','ERC20','BEP20'], SOL:['SOL'] };
      if (!allowed[coin] || allowed[coin].indexOf(network) < 0) return json({ok:false,msg:'操作失败：币种与网络不匹配'},400);
      let valid = false;
      if (coin === 'BTC') valid = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
      else if (network === 'ERC20' || network === 'BEP20') valid = /^0x[a-fA-F0-9]{40}$/.test(address);
      else if (network === 'TRC20') valid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
      else if (coin === 'SOL') valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      if (!valid) return json({ok:false,msg:'操作失败：地址格式无效'},400);
      record = { id:'A'+Date.now()+crypto.randomBytes(3).toString('hex'), type:type, coin:coin, network:network, address:address, note:note, created_at:nowStr(), flagged:false, blocked:false };
    } else {
      const holder=String(body.account_holder||'').trim().slice(0,120), bank=String(body.bank_name||'').trim().slice(0,120), account=String(body.account_number||'').replace(/\s/g,''), routing=String(body.routing_number||'').replace(/\s/g,''), swift=String(body.swift||'').trim().toUpperCase(), bankAddress=String(body.bank_address||'').trim().slice(0,240);
      if (!holder || !bank || !/^\d{4,34}$/.test(account) || !/^\d{9}$/.test(routing) || (swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) || !bankAddress) return json({ok:false,msg:'操作失败：请检查银行账户资料'},400);
      record={id:'A'+Date.now()+crypto.randomBytes(3).toString('hex'),type:type,account_holder:holder,bank_name:bank,account_number:account,routing_number:routing,swift:swift,bank_address:bankAddress,note:note,created_at:nowStr(),flagged:false,blocked:false};
    }
    if (!Array.isArray(user.addresses)) user.addresses=[];
    user.addresses.push(record);
    if (!Array.isArray(user.address_audit)) user.address_audit=[];
    user.address_audit.push({id:'L'+Date.now(),action:'created',address_id:record.id,by:'user',time:nowStr()});
    await saveDB(db);
    return json({ok:true,msg:'提交成功',address:{id:record.id,type:record.type,coin:record.coin,network:record.network,note:record.note,created_at:record.created_at}});
  }

  // Address book is immutable for end users; only support may change/unbind it.
  if (path.indexOf('addresses/') === 0 && method === 'DELETE' || path.indexOf('addresses/') === 0 && method === 'PATCH') {
    if (!user) return json({ok:false,msg:'未登录',need_login:true},401);
    return json({ok:false,msg:'请联系客服处理'},403);
  }

  // ---------- POST /api/kyc ----------
  if (path === 'kyc' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    if (user.kyc.status === 'approved') return json({ ok: false, msg: '已通过认证，无需重复提交' });
    if (user.kyc.status === 'pending') return json({ ok: false, msg: '认证审核中，请勿重复提交' });
    user.kyc = {
      status: 'pending',
      name: body.name || '',
      id_type: body.id_type || 'id_card',
      id_number: body.id_number || '',
      submitted_at: nowStr(),
    };
    await saveDB(db);
    return json({ ok: true, msg: '认证资料已提交，预计1-3个工作日完成审核' });
  }

  // ---------- POST /api/deposit ----------
  if (path === 'deposit' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    const coin = body.coin || 'USDT';
    const network = body.network || 'TRC20';
    const parsedAmount = body.amount === undefined || body.amount === null || body.amount === '' ? 0 : parseMoneyInput(body.amount);
    if (parsedAmount === null) return json({ ok: false, msg: '金额格式无效' }, 400);
    const amount = parsedAmount;
    // amount <= 0 时为查询地址模式，仅返回充值地址，不入账
    if (amount <= 0) {
      const key = coin + '-' + network;
      const addr = db.deposit_addresses[key] || '';
      if (!addr || /PLACEHOLDER/i.test(addr)) return json({ ok: false, msg: '网络异常：充值地址尚未配置' }, 503);
      return json({ ok: true, address: addr, msg: '充值地址' });
    }
    // Fail closed: user-supplied requests must never credit balances without verified chain data.
    return json({ ok: false, msg: '操作失败：充值到账须由链上确认流程完成' }, 403);
  }

  // ---------- POST /api/withdraw ----------
  if (path === 'withdraw' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；提现未提交，余额未变更。' }, 503);
    // When the financial RPC cutover is enabled, this route must use the normalized
    // PostgreSQL ledger exclusively. RPC errors fail closed; never fall back to Blobs.
    // Enforce account freeze on every financial write, not only at login. Existing
    // sessions remain valid after an administrator freezes an account.
    if (user.frozen) return json({ ok: false, msg: '账户已被冻结，暂不能申请提现', code: 'ACCOUNT_FROZEN' }, 403);
    const coin = String(body.coin || 'USDT').trim().toUpperCase();
    const amount = parseMoneyInput(body.amount);
    const addr = String(body.address || '').trim();
    const network = String(body.network || '').toUpperCase();
    // Require a client-generated idempotency key so network retries cannot create a
    // second withdrawal for the same submit action. Persistent transactional locking
    // is still required to protect against simultaneous writes across server instances.
    const requestId = String(body.request_id || '').trim();
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) return json({ ok: false, msg: '请求标识无效，请刷新后重试' }, 400);
    // PostgreSQL is the sole idempotency authority for withdrawals. Do not consult
    // the legacy state document for a replay decision; it may be stale after cutover.
    if (!addr) return json({ ok: false, msg: '请输入提币地址' }, 400);
    if (amount === null || amount <= 0 || amount > 1e12) return json({ ok: false, msg: '金额无效' }, 400);
    const allowedNetworks = { BTC:['BTC'], ETH:['ERC20'], USDT:['TRC20','ERC20','BEP20'], SOL:['SOL'] };
    if (!allowedNetworks[coin] || allowedNetworks[coin].indexOf(network) < 0) return json({ok:false,msg:'操作失败：币种与网络不匹配'},400);
    let addressValid = false;
    if (coin === 'BTC') addressValid = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(addr);
    else if (network === 'ERC20' || network === 'BEP20') addressValid = /^0x[a-fA-F0-9]{40}$/.test(addr);
    else if (network === 'TRC20') addressValid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
    else if (coin === 'SOL') addressValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
    if (!addressValid) return json({ok:false,msg:'操作失败：地址格式无效'},400);
    const bound = (user.addresses || []).find(function(a){return a.type==='crypto' && a.address===addr && a.coin===coin && a.network===network;});
    if (bound && (bound.blocked || bound.unbound)) return json({ok:false,msg:'操作失败：该地址不可用'},403);
    const supportedFees = { USDT: 1.0, BTC: 0.0001, ETH: 0.001, SOL: 0.01 };
    if (!Object.prototype.hasOwnProperty.call(supportedFees, coin)) return json({ ok: false, msg: '操作失败：币种暂不支持提现' }, 400);
    const fee = supportedFees[coin];
    const totalDebit = amount + fee;
    if (!Number.isFinite(totalDebit) || totalDebit <= 0) return json({ ok: false, msg: '金额无效' }, 400);
    // Require the user's configured fund password for every withdrawal. 2FA is
    // optional at account level, but when enabled its TOTP code is mandatory.
    const fundPassword = String(body.fund_password || '');
    if (!/^\d{6}$/.test(fundPassword)) return json({ ok: false, code: 'FUND_PASSWORD_REQUIRED', msg: '请输入6位资金密码' }, 400);
    { const rl = rateCheck('fundpwd:' + user.uid, 20, 15 * 60 * 1000); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!verifyFundPassword(user, fundPassword)) return json({ ok: false, code: 'FUND_PASSWORD_INVALID', msg: '资金密码错误或尚未设置，请先在安全中心设置资金密码' }, 403);
    if (user.twofa_enabled && !/^\d{6}$/.test(String(body.twofa_code || ''))) return json({ ok: false, code: 'TWOFA_REQUIRED', msg: '此账号已启用双重验证，请输入验证码' }, 400);
    if (user.twofa_enabled && !totpVerify(user.twofa_secret, String(body.twofa_code || ''))) return json({ ok: false, code: 'TWOFA_INVALID', msg: '2FA验证码错误' }, 403);
    const withdrawalId = 'W' + Date.now() + crypto.randomBytes(8).toString('hex');
    if (manualDepositRpcEnabled()) {
      if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: '财务数据库未配置；提现未提交。' }, 503);
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
          return json({ ok: false, code: insufficient ? 'INSUFFICIENT_FUNDS' : 'FINANCIAL_RPC_FAILED', msg: insufficient ? '可用余额不足（含手续费）' : '数据库未确认提现申请；请检查操作记录后再重试。' }, insufficient ? 400 : 503);
        }
        return json({ ok: true, duplicate: !!result.duplicate, withdrawal_id: result.withdrawal_id, status: result.status, msg: result.duplicate ? '该提现申请已接收，请勿重复提交' : '提现申请已提交，审核通过后到账' });
      } catch (e) {
        return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；提现未确认，请检查操作记录后再重试。' }, 503);
      }
    }
    return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；提现未提交，余额未变更。' }, 503);
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
    if (!out.length) return json({ ok: false, code: 'MARKET_DATA_UNAVAILABLE', msg: '行情源不可用', markets: [], data: {}, source: coinbaseAvailable ? 'coinbase_partial' : 'unavailable' }, 503);
    return json({ ok: true, markets: out, data: dataObj, source: missingBases.length ? 'coinbase_primary_bybit_fallback' : 'coinbase' });
  }

  // ---------- POST /api/order ----------
  // Never simulate fills or mutate customer balances outside the PostgreSQL matching RPC.
  if (path === 'order' && method === 'POST') {
    // Never simulate fills or mutate customer balances outside the PostgreSQL matching RPC.
    // Never simulate fills: an unavailable or unapproved engine must fail closed.
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: '账户已被冻结，暂不能交易', code: 'ACCOUNT_FROZEN' }, 403);
    const symbol = String(body.symbol || 'BTCUSDT').toUpperCase();
    const side = String(body.side || 'buy').toLowerCase();
    const type = String(body.type || body.order_type || 'limit').toLowerCase();
    const qty = Number(body.qty);
    const price = Number(body.price || 0);
    const pair = matchingPairFromSymbol(symbol);
    if (!pair) return json({ ok: false, msg: '操作失败：交易对暂不支持' }, 400);
    if (!['buy','sell'].includes(side)) return json({ ok: false, msg: '操作失败：交易方向无效' }, 400);
    // Market orders are intentionally rejected until a separately bounded market-order policy exists.
    if (type !== 'limit') return json({ ok: false, code: 'ORDER_TYPE_UNSUPPORTED', msg: '当前仅支持限价单' }, 400);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1e12) return json({ ok: false, msg: '操作失败：数量无效' }, 400);
    if (!Number.isFinite(price) || price <= 0 || price > 1e15) return json({ ok: false, msg: '操作失败：限价无效' }, 400);
    const clientOrderId = String(body.client_order_id || body.request_id || '').trim();
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(clientOrderId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: '请提供有效的 client_order_id（16-100位）' }, 400);
    if (!matchingEngineEnabled()) {
      return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: '撮合引擎尚未完成数据库切换审批，本次未创建订单且未变更余额。' }, 503);
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
        msg: e.status === 400 ? '订单校验失败，请检查交易对规则、余额及请求参数。' : '撮合数据库暂不可用；订单结果未确认，请查询订单后再重试。' }, status);
    }
  }

  // ---------- POST /api/order/cancel ----------
  if (path === 'order/cancel' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    const orderId = String(body.order_id || '').trim();
    const cancelId = String(body.client_cancel_id || body.request_id || '').trim();
    if (!orderId || orderId.length > 128) return json({ ok: false, code: 'INVALID_ORDER_ID', msg: '订单编号无效' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(cancelId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: '请提供有效的 client_cancel_id（16-100位）' }, 400);
    if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: '撮合引擎尚未完成数据库切换审批，未执行撤单。' }, 503);
    try {
      const result = await matchingRpc('cancel_limit_order_matching_v1', {
        p_user_id: String(user.uid), p_order_id: orderId, p_client_cancel_id: cancelId
      });
      return json({ ok: true, duplicate: !!result.duplicate, order_id: result.order_id || orderId, status: result.status });
    } catch (e) {
      return json({ ok: false, code: e.status === 400 ? 'CANCEL_REJECTED' : 'MATCHING_RPC_UNAVAILABLE',
        msg: e.status === 400 ? '撤单失败，请检查订单状态。' : '撮合数据库暂不可用；撤单结果未确认，请查询订单后再重试。' }, e.status === 400 ? 400 : 503);
    }
  }

  // ---------- POST /api/earn ----------
  if (path === 'earn' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: '账户已被冻结，暂不能操作理财资金', code: 'ACCOUNT_FROZEN' }, 403);
    // Financial actions become usable only through the atomic PostgreSQL ledger.
    // Never fall back to the legacy Blobs wallet if configuration/RPC fails.
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '理财服务尚未完成安全切换，资金未变更。' }, 503);
    }
    const action = String(body.action || 'subscribe');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const requestId = String(body.request_id || '').trim();
    if (action === 'subscribe') {
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: '缺少有效的申购请求编号。' }, 400);
      const amount = parseMoneyInput(body.amount);
      if (amount === null || amount <= 0 || amount > 1e12) return json({ ok: false, msg: '金额无效' }, 400);
      const productId = String(body.product_id || 'flex_USDT');
      const products = new Set(['demand','flex_USDT','flex_BTC','flex_ETH','fixed30','fixed90','fixed180']);
      if (!products.has(productId)) return json({ ok: false, msg: '理财产品暂不支持' }, 400);
      const asset = productId.endsWith('_BTC') ? 'BTC' : productId.endsWith('_ETH') ? 'ETH' : 'USDT';
      const positionId = 'EP' + crypto.createHash('sha256').update(String(user.uid) + '|' + requestId).digest('hex').slice(0, 32);
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), product_id: productId, asset, amount: String(amount), request_id: requestId })).digest('hex');
      try {
        const rpc = await fetch(base + '/rest/v1/rpc/subscribe_earn_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_product_id: productId, p_asset: asset, p_principal: String(amount), p_request_id: requestId, p_request_hash: requestHash }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: '数据库未确认理财申购；请检查操作记录后再重试。' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, record_id: result.position_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? '该申购请求已处理，请勿重复提交' : '申购成功' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；申购结果未确认，请检查操作记录。' }, 503); }
    }
    if (action === 'redeem') {
      const positionId = String(body.record_id || '').trim();
      if (!positionId || positionId.length > 128) return json({ ok: false, msg: '记录编号无效' }, 400);
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: '缺少有效的赎回请求编号。' }, 400);
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), position_id: positionId, request_id: requestId })).digest('hex');
      try {
        const rpc = await fetch(base + '/rest/v1/rpc/redeem_earn_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_request_id: requestId, p_request_hash: requestHash }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: '数据库未确认理财赎回；请检查操作记录后再重试。' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, record_id: result.position_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? '该赎回请求已处理' : '赎回成功' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；赎回结果未确认，请检查操作记录。' }, 503); }
    }
    return json({ ok: false, msg: '未知操作' }, 400);
  }

  // ---------- 秒合约 Seconds Contracts ----------
  // Balance-affecting logic lives exclusively in the atomic PostgreSQL RPC.
  // Default is fail-closed (financialWritesEnabled() === false): no order is
  // created and no balance changes until the PostgreSQL cutover is approved.
  // The client never mutates BTCBOX.account.balances directly; it refreshes
  // from /api/account after each confirmed operation.

  // ---------- POST /api/seconds/order ----------
  if (path === 'seconds/order' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: '账户已被冻结，暂不能交易秒合约', code: 'ACCOUNT_FROZEN' }, 403);
    const rl = rateCheck('seconds:order:' + String(user.uid), 30, 5 * 60 * 1000);
    if (rl.limited) return rateLimitedJson(rl.retryAfter);
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '秒合约尚未完成资金安全切换，本次未冻结资金、未创建持仓。' }, 503);
    }
    const symbol = String(body.symbol || 'BTC').toUpperCase();
    const direction = String(body.direction || 'up').toLowerCase();
    const durationSec = Number(body.duration_sec || body.duration || 30);
    const amount = parseMoneyInput(body.amount);
    const requestId = String(body.request_id || '').trim();
    if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) return json({ ok: false, msg: '交易对暂不支持秒合约' }, 400);
    if (!['up', 'down'].includes(direction)) return json({ ok: false, msg: '交易方向无效' }, 400);
    if (!SECONDS_ALLOWED_DURATIONS.has(durationSec)) return json({ ok: false, msg: '合约时长无效' }, 400);
    if (amount === null || amount <= 0 || amount > 1e12) return json({ ok: false, msg: '投入金额无效' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: '缺少有效的请求编号（16-100位）。' }, 400);
    let ref;
    try { ref = await fetchSecondsReferencePrice(symbol); }
    catch (_) { return json({ ok: false, code: 'REFERENCE_PRICE_UNAVAILABLE', msg: '当前参考价格暂不可用，未创建订单。' }, 503); }
    const positionId = 'SC' + crypto.createHash('sha256').update(String(user.uid) + '|' + requestId).digest('hex').slice(0, 30);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), symbol, direction, amount: String(amount), duration_sec: durationSec, request_id: requestId })).digest('hex');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/submit_seconds_order_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_symbol: symbol, p_direction: direction, p_amount: String(amount), p_duration_sec: durationSec, p_open_price: String(ref.price), p_request_id: requestId, p_request_hash: requestHash }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: '数据库未确认秒合约开仓；资金未变更，请检查后重试。', duplicate: !!(result && result.duplicate) }, rpc.status === 400 ? 400 : 503);
      return json({ ok: true, duplicate: !!result.duplicate, position_id: result.position_id, symbol: symbol, direction: direction, amount: amount, duration_sec: durationSec, open_price: ref.price, open_price_source: ref.source, settle_at: Math.floor(Date.now() / 1000) + durationSec, msg: result.duplicate ? '该开仓请求已处理，请勿重复提交' : '开仓成功，资金已冻结' });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；开仓结果未确认，资金未变更。' }, 503); }
  }

  // ---------- POST /api/seconds/settle ----------
  if (path === 'seconds/settle' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: '账户已被冻结', code: 'ACCOUNT_FROZEN' }, 403);
    const rl = rateCheck('seconds:settle:' + String(user.uid), 60, 5 * 60 * 1000);
    if (rl.limited) return rateLimitedJson(rl.retryAfter);
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '秒合约尚未完成资金安全切换，本次未结算。' }, 503);
    }
    const positionId = String(body.position_id || '').trim();
    const requestId = String(body.request_id || '').trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(positionId)) return json({ ok: false, msg: '持仓编号无效' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: '缺少有效的请求编号（16-100位）。' }, 400);
    const symbol = String(body.symbol || '').toUpperCase();
    if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) return json({ ok: false, msg: '交易对无效' }, 400);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), position_id: positionId, symbol, request_id: requestId })).digest('hex');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    // Sample the trusted reference feed on the server only. The client cannot
    // provide or alter the settlement price; PostgreSQL still checks maturity,
    // ownership, idempotency, and applies the ledger movement atomically.
    let settleRef;
    try { settleRef = await fetchSecondsReferencePrice(symbol); }
    catch (_) { return json({ ok: false, code: 'REFERENCE_PRICE_UNAVAILABLE', msg: '结算参考价格暂不可用；订单保持未结算，请稍后重试。' }, 503); }
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/settle_seconds_position_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_request_id: requestId, p_request_hash: requestHash, p_symbol: symbol, p_settle_price: String(settleRef.price), p_settle_price_source: settleRef.source, p_settle_price_ts: new Date().toISOString() }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: result && result.msg ? result.msg : '数据库未确认秒合约结算；请稍后重试。', duplicate: !!(result && result.duplicate), settled: !!(result && result.settled) }, rpc.status === 400 ? 400 : 503);
      return json({ ok: true, duplicate: !!result.duplicate, position_id: positionId, settled: result.settled !== false, win: result.win, tie: result.tie, pnl: result.pnl, settle_price: result.settle_price, msg: result.duplicate ? '该结算请求已处理' : (result.settled === false ? '持仓未到期，暂不能结算' : '结算完成') });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；结算结果未确认。' }, 503); }
  }

  // ---------- GET /api/seconds/positions ----------
  if (path === 'seconds/positions' && method === 'GET') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    if (!financialWritesEnabled()) {
      return json({ ok: true, open: [], history: [], cutover_incomplete: true, msg: '秒合约尚未完成资金安全切换，暂无持仓数据。' });
    }
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/read_seconds_positions_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_user_id: String(user.uid) }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: '秒合约持仓查询失败。' }, 503);
      return json({ ok: true, open: Array.isArray(result.open) ? result.open : [], history: Array.isArray(result.history) ? result.history : [] });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用。' }, 503); }
  }

  // ---------- POST /api/support/chat ----------
  if (path === 'support/chat' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return json({ ok: false, msg: '请输入消息内容' }, 400);
    if (content.length > 2000) return json({ ok: false, msg: '消息内容不能超过2000个字符' }, 400);
    user.support_messages = Array.isArray(user.support_messages) ? user.support_messages : [];
    user.support_messages.push({ id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'user', content: content, time: nowStr() });
    // Keep the conversation bounded so repeated submissions cannot grow the
    // per-user record without limit. Preserve the newest messages.
    if (user.support_messages.length > 500) user.support_messages = user.support_messages.slice(-500);
    await saveDB(db);
    return json({ ok: true, msg: '提交成功' });
  }

  // ---------- GET /api/support/messages ----------
  if (path === 'support/messages' && method === 'GET') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    user.last_read_chat_at = nowStr(); // 拉取消息即标记已读
    await saveDB(db);
    return json({ ok: true, messages: user.support_messages.slice(-50) });
  }

  // ---------- POST /api/settings/password ----------
  if (path === 'settings/password' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    if (hashPassword(body.old_password || '', user.salt) !== user.password_hash) return json({ ok: false, msg: '原密码错误' });
    if ((body.new_password || '').length < 6) return json({ ok: false, msg: '新密码至少6位' });
    user.salt = genSalt();
    user.password_hash = hashPassword(body.new_password, user.salt);
    await saveDB(db);
    return json({ ok: true, msg: '密码修改成功' });
  }

  // ---------- POST /api/settings/fundpwd ----------
  if (path === 'settings/fundpwd' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    const pwd = body.fund_password || '';
    if (!/^\d{6}$/.test(pwd)) return json({ ok: false, msg: '资金密码为6位数字' });
    const fundSalt = genSalt();
    user.fund_password_salt = fundSalt;
    user.fund_password_hash = hashFundPassword(pwd, fundSalt);
    delete user.fund_password; // Never persist the six-digit fund password in plaintext.
    await saveDB(db);
    return json({ ok: true, msg: '资金密码设置成功' });
  }

  // ---------- POST /api/settings/2fa ----------
  if (path === 'settings/2fa' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    const action = body.action || 'enable';
    if (action === 'enable') {
      if (!user.twofa_secret) user.twofa_secret = genTotpSecret();
      return json({ ok: true, secret: user.twofa_secret, enabled: user.twofa_enabled });
    }
    if (action === 'confirm') {
      if (!totpVerify(user.twofa_secret, body.code || '')) return json({ ok: false, msg: '验证码错误' });
      user.twofa_enabled = true;
      await saveDB(db);
      return json({ ok: true, msg: '2FA已启用' });
    }
    if (action === 'disable') {
      if (!totpVerify(user.twofa_secret, body.code || '')) return json({ ok: false, msg: '验证码错误' });
      user.twofa_enabled = false;
      await saveDB(db);
      return json({ ok: true, msg: '2FA已关闭' });
    }
    return json({ ok: false, msg: '未知操作' });
  }

  // ---------- GET /api/orders ----------
  if (path === 'orders' && method === 'GET') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true }, 401);
    if (matchingEngineRequested()) {
      if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: '撮合订单查询尚未完成数据库切换审批。' }, 503);
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const query = new URLSearchParams({ select: 'id,base_asset,quote_asset,side,price,quantity,remaining_quantity,status,client_order_id,created_at,updated_at', user_id: 'eq.' + String(user.uid), order: 'created_at.desc', limit: '50' });
        const response = await fetch(base + '/rest/v1/financial_matching_orders?' + query.toString(), { headers: supabaseHeaders() });
        const rows = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(rows)) return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: '订单数据暂不可用，请稍后重试。' }, 503);
        const orders = rows.map(row => ({ order_id: row.id, symbol: row.base_asset + row.quote_asset, side: row.side,
          price: row.price, quantity: row.quantity, remaining_quantity: row.remaining_quantity, status: row.status,
          client_order_id: row.client_order_id, created_at: row.created_at, updated_at: row.updated_at }));
        return json({ ok: true, orders });
      } catch (e) { return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: '订单数据暂不可用，请稍后重试。' }, 503); }
    }
    return json({ ok: true, orders: (Array.isArray(user.orders) ? user.orders : []).slice(-50) });
  }

  // ---------- GET /api/chat/unread（客服未读消息数）----------
  if (path === 'chat/unread' && method === 'GET') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    const lastRead = user.last_read_chat_at || '';
    const unread = (user.support_messages || []).filter(function (m) { return m.from === 'admin' && m.time > lastRead; }).length;
    return json({ ok: true, unread: unread });
  }

  // ==================== 后台管理 API（Basic Auth） ====================
  function adminAuth() {
    const authHeader = event.headers && (event.headers.authorization || event.headers.Authorization);
    if (!authHeader || !authHeader.startsWith('Basic ')) return null;
    { const rl = rateCheck('admin:' + clientIp(event), 60, 5 * 60 * 1000); if (rl.limited) return 'RATE_LIMITED'; }
    try {
      const [u, p] = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
      const ADMIN_USER = process.env.ADMIN_USER;
      const ADMIN_PASS = process.env.ADMIN_PASS;
      if (ADMIN_USER && ADMIN_PASS && u === ADMIN_USER && p === ADMIN_PASS) return true;
    } catch (e) { }
    return null;
  }
  if (path.startsWith('admin/')) {
    const adminAuthResult = adminAuth();
    if (adminAuthResult === 'RATE_LIMITED') return rateLimitedJson(60);
    if (!adminAuthResult) {
      return json({ ok: false, msg: '管理员认证失败' }, 401, { 'WWW-Authenticate': 'Basic realm="BTCBOX Admin"' });
    }
    const sub = path.slice(6); // 去掉 admin/ 前缀

    // GET /api/admin/stats
    if (sub === 'stats' && method === 'GET') {
      const users = Object.values(db.users);
      let pendingWd = users.reduce(function (s, u) { return s + (Array.isArray(u.withdrawals) ? u.withdrawals.filter(function (w) { return w.status === 'pending' || w.status === 'approved_pending_broadcast'; }).length : 0); }, 0);
      if (financialPostgresReadsEnabled()) {
        try { pendingWd = (await readAdminWithdrawalSnapshot()).pending_count; }
        catch (e) { return json({ ok: false, msg: '财务数据暂时不可用，请稍后重试', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
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
        catch (e) { return json({ ok: false, msg: '财务数据暂时不可用，请稍后重试', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
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
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
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
          return json({ ok: false, msg: '财务数据暂时不可用，请稍后重试', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503);
        }
      }
      return json({ ok: true, user: safeUser });
    }

    // All privileged account changes are auditable and validated server-side.
    function auditAdmin(action, uid, detail) {
      if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
      db.audit_logs.push({ id: 'AL' + Date.now() + crypto.randomBytes(3).toString('hex'), action: action, uid: String(uid || ''), by: 'admin', time: nowStr(), detail: String(detail || '').slice(0, 300) });
      if (db.audit_logs.length > 5000) db.audit_logs = db.audit_logs.slice(-5000);
    }

    // POST /api/admin/user/balance 调整余额
    if (sub === 'user/balance' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；余额未变更。' }, 503);
      if (manualDepositRpcEnabled()) {
        const u = db.users[body.uid];
        // In cutover mode this route must use the transactional ledger exclusively.
        // Never fall back to the legacy state document if configuration/RPC fails.
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: '财务数据库未配置；余额未变更。' }, 503);
        if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
        const coin = String(body.coin || 'USDT').trim().toUpperCase();
        const allowedCoins = ['USDT', 'BTC', 'ETH', 'SOL'];
        const delta = Number(body.delta);
        const mode = String(body.mode || 'adjust').trim().toLowerCase();
        const requestId = String(body.request_id || '').trim();
        const reason = String(body.reason || '').trim().slice(0, 500);
        if (!allowedCoins.includes(coin)) return json({ ok: false, msg: '操作失败：币种不支持' }, 400);
        if (!['adjust', 'freeze', 'unfreeze'].includes(mode)) return json({ ok: false, msg: '资金操作类型无效' }, 400);
        if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1e12 || !Number.isSafeInteger(Math.round(delta * 1e8)) || (mode !== 'adjust' && delta < 0)) return json({ ok: false, msg: '操作数量无效；冻结或解冻数量必须为正数' }, 400);
        if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: '缺少有效的操作编号；余额未变更。' }, 400);
        if (reason.length < 5) return json({ ok: false, msg: '请填写至少 5 个字符的调整原因；余额未变更。' }, 400);
        const adminId = String(process.env.ADMIN_USER || '').trim();
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: '管理员审计身份未配置；余额未变更。' }, 503);
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
            return json({ ok: false, code: code, msg: '数据库余额调整未确认；请检查财务操作记录后再重试，禁止直接重复操作。' }, rpc.status === 400 ? 400 : 503);
          }
          return json({ ok: true, msg: result.duplicate ? '该资金操作已处理过，未重复执行' : (mode === 'freeze' ? '资金已转入冻结余额' : mode === 'unfreeze' ? '冻结资金已转回可用余额' : '余额已通过财务账本调整'), operation_id: result.operation_id, duplicate: !!result.duplicate, balances: { [coin]: { free: result.available, frozen: result.frozen } } });
        } catch (e) {
          return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；未回退到旧余额系统，请检查操作记录。' }, 503);
        }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；余额未变更。' }, 503);
    }

    // POST /api/admin/user/freeze 冻结/解冻
    if (sub === 'user/freeze' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
      const frozen = !!body.frozen;
      const reason = String(body.reason || '').trim().slice(0, 200);
      u.frozen = frozen;
      u.frozen_reason = frozen ? reason : '';
      auditAdmin(frozen ? 'user_freeze' : 'user_unfreeze', u.uid, reason || (frozen ? '管理员冻结账户' : '管理员解冻账户'));
      await saveDB(db);
      return json({ ok: true, msg: u.frozen ? '账户已冻结' : '账户已解冻' });
    }

    // POST /api/admin/user/reset-pwd
    if (sub === 'user/reset-pwd' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
      const newPassword = String(body.new_password || '');
      if (newPassword.length < 6 || newPassword.length > 256) return json({ ok: false, msg: '密码长度需为6至256位' }, 400);
      u.salt = genSalt();
      u.password_hash = hashPassword(newPassword, u.salt);
      Object.keys(db.sessions || {}).forEach(function (token) { if (db.sessions[token].uid === u.uid) delete db.sessions[token]; });
      auditAdmin('user_password_reset', u.uid, '管理员重置登录密码；现有会话已失效');
      await saveDB(db);
      return json({ ok: true, msg: '密码已重置，用户需要重新登录' });
    }

    // POST /api/admin/user/reset-email
    if (sub === 'user/reset-email' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
      const newEmail = String(body.new_email || '').trim().toLowerCase();
      if (newEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return json({ ok: false, msg: '邮箱格式无效' }, 400);
      const duplicate = Object.values(db.users).some(function (other) { return other.uid !== u.uid && String(other.email || '').toLowerCase() === newEmail; });
      if (duplicate) return json({ ok: false, msg: '该邮箱已被其他账户使用' }, 409);
      const previousEmail = u.email;
      u.email = newEmail;
      auditAdmin('user_email_change', u.uid, JSON.stringify({ from: previousEmail, to: newEmail }));
      await saveDB(db);
      return json({ ok: true, msg: '邮箱已修改' });
    }

    // POST /api/admin/deposit/confirm — explicit administrator manual credit.
    // This is an audited admin action, not a user-facing deposit confirmation.
    if (sub === 'deposit/confirm' && method === 'POST') {
      // Admin manual credit is available only through the atomic ledger RPC after
      // the complete read/write cutover is explicitly enabled. No legacy fallback.
      if (!financialWritesEnabled()) {
        return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；未执行人工入账。' }, 503);
      }
      const uid = String(body.uid || '').trim();
      const coin = String(body.coin || 'USDT').trim().toUpperCase();
      const amount = Number(body.amount);
      const reference = String(body.reference || '').trim().slice(0, 120);
      const note = String(body.note || '').trim().slice(0, 300);
      const idempotencyKey = String(body.idempotency_key || '').trim();
      const u = db.users[uid];
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
      if (!['USDT', 'BTC', 'ETH', 'SOL'].includes(coin)) return json({ ok: false, msg: '币种不支持' }, 400);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !/^\d+(?:\.\d{1,12})?$/.test(String(body.amount || '').trim())) {
        return json({ ok: false, msg: '充值金额无效，必须为大于 0 的有效数字' }, 400);
      }
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) return json({ ok: false, msg: '入账请求编号无效，请重新操作' }, 400);
      const adminId = String(process.env.ADMIN_USER || '').trim();
      if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: '管理员审计身份未配置；未执行人工入账。' }, 503);
      const amountText = String(body.amount).trim();
      const requestHash = crypto.createHash('sha256').update([adminId, uid, coin, amountText, reference, note].join('|')).digest('hex');
      const depositId = 'MD' + crypto.randomBytes(16).toString('hex');
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const rpc = await fetch(base + '/rest/v1/rpc/admin_manual_deposit_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_deposit_id: depositId, p_admin_id: adminId, p_user_id: uid, p_asset: coin, p_amount: amountText, p_request_id: idempotencyKey, p_request_hash: requestHash, p_reference: reference, p_note: note }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.deposit_id) return json({ ok: false, code: rpc.status === 409 ? 'IDEMPOTENCY_CONFLICT' : 'FINANCIAL_RPC_FAILED', msg: '数据库未确认人工入账；请检查财务操作记录后再重试，禁止直接重复操作。' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, deposit_id: result.deposit_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? '该入账请求已处理，未重复入账' : '人工入账已通过财务账本处理' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；入账结果未确认，请检查操作记录。' }, 503); }
    }

    // POST /api/admin/withdraw/approve
    // Manual admin review only; no chain broadcast. Refuse ambiguous IDs rather than
    // accidentally approving more than one record with the same identifier.
    if (sub === 'withdraw/approve' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；提现未审核，资金未变更。' }, 503);
      const wdId = String(body.id || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: '提现记录编号无效' }, 400);
      if (manualDepositRpcEnabled()) {
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: '财务数据库未配置；提现未审核。' }, 503);
        const adminId = String(process.env.ADMIN_USER || '').trim();
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: '管理员审计身份未配置；提现未审核。' }, 503);
        try {
          const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/review_withdrawal_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_approve: true, p_reason: '管理员手动审核通过；未执行链上广播' })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: '数据库未确认提现审核；请检查操作记录。' }, 503);
          if (result.status !== 'approved') return json({ ok: false, code: 'WITHDRAWAL_ALREADY_PROCESSED', status: result.status, msg: '提现已被处理，当前操作未重复执行。' }, 409);
          return json({ ok: true, duplicate: !!result.duplicate, status: 'approved', msg: result.duplicate ? '提现此前已审核通过，未重复扣款' : '提现已审核通过，冻结金额已扣除；尚未广播到链上' });
        } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；请检查操作记录。' }, 503); }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；提现未审核，资金未变更。' }, 503);
    }

    if (sub === 'withdraw/reject' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；提现未拒绝或退款，资金未变更。' }, 503);
      const wdId = String(body.id || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: '提现记录编号无效' }, 400);
      if (manualDepositRpcEnabled()) {
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: '财务数据库未配置；提现未拒绝或退款。' }, 503);
        const adminId = String(process.env.ADMIN_USER || '').trim();
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: '管理员审计身份未配置；提现未拒绝或退款。' }, 503);
        const reason = String(body.reason || '管理员拒绝提现').trim().slice(0, 200) || '管理员拒绝提现';
        try {
          const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/review_withdrawal_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_approve: false, p_reason: reason })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: '数据库未确认提现拒绝；请检查操作记录。' }, 503);
          if (result.status !== 'rejected') return json({ ok: false, code: 'WITHDRAWAL_ALREADY_PROCESSED', status: result.status, msg: '提现已被处理，当前操作未重复退款。' }, 409);
          return json({ ok: true, duplicate: !!result.duplicate, status: 'rejected', msg: result.duplicate ? '提现此前已拒绝，未重复退款' : '提现已拒绝，冻结本金及手续费已退回可用余额' });
        } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: '财务数据库暂不可用；请检查操作记录。' }, 503); }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: '财务账本尚未完成安全切换；提现未拒绝或退款，资金未变更。' }, 503);
    }

    if (sub === 'kyc/approve' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
      if (!u.kyc || typeof u.kyc !== 'object') u.kyc = {};
      // Business rule: the administrator is the source of truth and may approve unsubmitted accounts.
      u.kyc.status = 'approved';
      u.kyc.reviewed_by = 'admin';
      u.kyc.reviewed_at = nowStr();
      u.kyc.reject_reason = '';
      auditAdmin('kyc_approve', u.uid, '管理员通过实名认证');
      await saveDB(db);
      return json({ ok: true, msg: 'KYC已通过' });
    }

    // POST /api/admin/kyc/reject
    if (sub === 'kyc/reject' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
      if (!u.kyc || typeof u.kyc !== 'object') u.kyc = {};
      // Business rule: the administrator may reject/set the final status without a pending submission.
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (!reason) return json({ ok: false, msg: '请填写拒绝原因' }, 400);
      u.kyc.status = 'rejected';
      u.kyc.reject_reason = reason;
      u.kyc.reviewed_by = 'admin';
      u.kyc.reviewed_at = nowStr();
      auditAdmin('kyc_reject', u.uid, reason);
      await saveDB(db);
      return json({ ok: true, msg: 'KYC已拒绝' });
    }

    // POST /api/admin/push 推送站内信
    if (sub === 'push' && method === 'POST') {
      const content = String(body.content || '').trim();
      if (!content || content.length > 2000) return json({ ok: false, msg: '消息内容不能为空且不能超过2000字' }, 400);
      if (body.uid) {
        const u = db.users[body.uid];
        if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
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
      return json({ ok: true, msg: '消息已推送' });
    }

    // POST /api/admin/support/reply 回复客服
    if (sub === 'support/reply' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      u.support_messages.push({ id: 'M' + Date.now(), from: 'admin', content: body.content || '', time: nowStr() });
      await saveDB(db);
      return json({ ok: true, msg: '回复已发送' });
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
      if(!target) return json({ok:false,msg:'地址记录不存在'},404);
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
          const allowedNetworks={BTC:['BTC'],ETH:['ERC20'],USDT:['TRC20','ERC20','BEP20'],SOL:['SOL']};
          if(!newAddress || !allowedNetworks[coin] || !allowedNetworks[coin].includes(network)) return json({ok:false,msg:'操作失败'},400);
          let valid=false;
          if(coin==='BTC') valid=/^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(newAddress);
          else if(network==='ERC20'||network==='BEP20') valid=/^0x[a-fA-F0-9]{40}$/.test(newAddress);
          else if(network==='TRC20') valid=/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(newAddress);
          else if(coin==='SOL') valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(newAddress);
          if(!valid) return json({ok:false,msg:'操作失败'},400);
          addr.address=newAddress; addr.coin=coin; addr.network=network; addr.unbound=false;
        } else {
          const fields=['account_holder','bank_name','account_number','routing_number','swift','bank_address','note'];
          fields.forEach(function(k){if(typeof body[k]==='string') addr[k]=body[k].trim();});
          if(body.account_number!==undefined && !/^\d{4,34}$/.test(String(body.account_number).replace(/\s/g,''))) return json({ok:false,msg:'操作失败'},400);
          if(body.routing_number!==undefined && !/^\d{9}$/.test(String(body.routing_number).replace(/\s/g,''))) return json({ok:false,msg:'操作失败'},400);
          if(body.swift!==undefined && body.swift && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(body.swift).toUpperCase())) return json({ok:false,msg:'操作失败'},400);
          if(body.account_number!==undefined) addr.account_number=String(body.account_number).replace(/\s/g,'');
          if(body.routing_number!==undefined) addr.routing_number=String(body.routing_number).replace(/\s/g,'');
          if(body.swift!==undefined) addr.swift=String(body.swift).toUpperCase();
        }
      } else return json({ok:false,msg:'未知操作'},400);
      if(!Array.isArray(target.address_audit)) target.address_audit=[];
      target.address_audit.push({id:'L'+Date.now(),action:action,address_id:body.id,by:'admin',time:nowStr(),detail:String(body.reason||'').slice(0,200)});
      if(!Array.isArray(db.audit_logs)) db.audit_logs=[];
      db.audit_logs.push({id:'AL'+Date.now(),action:'address_'+action,uid:target.uid,address_id:body.id,by:'admin',time:nowStr(),detail:String(body.reason||'').slice(0,200)});
      await saveDB(db);
      return json({ok:true,msg:'提交成功'});
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
        'BTC-Bitcoin': function (v) { return /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v); },
        'ETH-ERC20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'SOL-Solana': function (v) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v); },
      };
      const updates = body.deposit_addresses;
      const changedKeys = [];
      if (updates !== undefined) {
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return json({ ok: false, msg: '充值地址配置格式无效' }, 400);
        for (const key of Object.keys(updates)) {
          if (!Object.prototype.hasOwnProperty.call(allowedDepositKeys, key)) return json({ ok: false, msg: '存在不支持的充值网络配置' }, 400);
          const value = typeof updates[key] === 'string' ? updates[key].trim() : '';
          if (!value || /PLACEHOLDER|TPLACEHOLDER/i.test(value) || !allowedDepositKeys[key](value)) {
            return json({ ok: false, msg: '充值地址格式无效：' + key }, 400);
          }
          changedKeys.push(key);
        }
      }
      if (updates !== undefined) db.deposit_addresses = Object.assign({}, db.deposit_addresses, Object.fromEntries(Object.keys(updates).map(function (key) { return [key, updates[key].trim()]; })));
      if (typeof body.announcement === 'string') {
        if (body.announcement.length > 2000) return json({ ok: false, msg: '公告不能超过2000个字符' }, 400);
        db.announcement = body.announcement.trim();
      }
      auditAdmin('system_config_update', 'system', JSON.stringify({ deposit_address_keys: changedKeys, announcement_updated: typeof body.announcement === 'string' }));
      await saveDB(db);
      return json({ ok: true, msg: '配置已更新', deposit_addresses: safeDepositAddresses(db.deposit_addresses), announcement: db.announcement });
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
          return json({ ok: false, msg: '财务数据暂时不可用，请稍后重试', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503);
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
    // GET /api/admin/orders 全部订单
    if (sub === 'orders' && method === 'GET') {
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (Array.isArray(u.orders) ? u.orders : []).forEach(function (o) {
          list.push({ id: o.id, uid: u.uid, email: u.email, symbol: o.symbol, side: o.side, type: o.type, price: o.price, amount: o.amount, status: o.status, time: o.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, orders: list.slice(0, 200) });
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
    return json({ ok: false, msg: '未知管理接口: ' + sub }, 404);
  }

  return json({ ok: false, msg: '接口不存在: ' + method + ' /' + path }, 404);
  } catch (e) {
    if (e && e.message === 'Persistent storage write conflict') {
      return json({ ok: false, msg: '数据刚刚发生变化，请刷新后重试', code: 'STORAGE_CONFLICT' }, 409);
    }
    // Do not expose internal storage, provider, or database error details to clients.
    return json({ ok: false, msg: '服务器暂时不可用，请稍后重试', code: 'INTERNAL_ERROR' }, 500);
  }
}

// 同一 Netlify Function warm instance 内串行执行请求，降低并发读-改-写互相覆盖的概率。
// 这不是跨实例锁，也不能替代事务数据库；多实例部署仍可能发生竞争。
let requestQueue = Promise.resolve();
exports.handler = function (event, context) {
  const run = requestQueue.then(
    () => handleRequest(event, context),
    () => handleRequest(event, context)
  );
  requestQueue = run.then(() => undefined, () => undefined);
  return run;
};
