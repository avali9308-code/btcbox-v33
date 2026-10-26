// BTCBOX 统一 API Handler (Netlify Function)
// 替代原 Python server.py，数据持久化到 Netlify Blobs
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const STORE_KEY = 'btcbox_data_v1';
const SESSION_COOKIE = 'session_token';
const PBKDF2_ITER = 100000;
const PBKDF2_KEYLEN = 32;

// ===== 数据层（Blobs 持久化 + 内存热缓存兜底 + 重试机制 + 缓存TTL）=====
let _memDB = null;
let _memDB_ts = 0;
const CACHE_TTL = 15000; // 内存缓存15秒，避免长时间用旧数据
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function loadDB() {
  // 内存缓存有效且未过期，直接用
  if (_memDB && (Date.now() - _memDB_ts) < CACHE_TTL) return _memDB;
  
  // 从 Blobs 读取，最多重试3次，间隔递增
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const store = getStore('btcbox');
      const raw = await store.get(STORE_KEY, { type: 'json' });
      if (raw && raw.users) {
        _memDB = raw;
        _memDB_ts = Date.now();
        return raw;
      }
      if (attempt < 2) await sleep(200 * (attempt + 1));
    } catch (e) {
      if (attempt < 2) await sleep(300 * (attempt + 1));
    }
  }
  
  // 三次都失败：内存有旧数据就用内存兜底（至少不丢数据）
  if (_memDB) return _memDB;
  
  // 完全没有数据，初始化默认库
  _memDB = defaultDB();
  _memDB_ts = Date.now();
  return _memDB;
}

async function saveDB(db) {
  _memDB = db;
  _memDB_ts = Date.now();
  
  // 写入 Blobs，最多重试3次，间隔递增
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const store = getStore('btcbox');
      await store.setJSON(STORE_KEY, db);
      return; // 写入成功
    } catch (e) {
      if (attempt < 2) await sleep(300 * (attempt + 1));
    }
  }
  // 三次都失败，内存仍保留，下次请求会继续尝试
}
function defaultDB() {
  return {
    users: {},        // uid -> user object
    sessions: {},     // token -> {uid, email, created_at}
    next_uid: 16588,
    deposit_addresses: {
      "USDT-TRC20": process.env.DEPOSIT_USDT_TRC20 || "TPLACEHOLDER00000000000000000000000",
      "USDT-ERC20": process.env.DEPOSIT_USDT_ERC20 || "0xPLACEHOLDER0000000000000000000000000000",
      "USDT-BEP20": process.env.DEPOSIT_USDT_BEP20 || "0xPLACEHOLDER0000000000000000000000000000",
      "BTC-Bitcoin": process.env.DEPOSIT_BTC || "bc1PLACEHOLDER0000000000000000000000000",
      "ETH-ERC20": process.env.DEPOSIT_ETH || "0xPLACEHOLDER0000000000000000000000000000",
      "SOL-Solana": process.env.DEPOSIT_SOL || "PLACEHOLDER_SOL_ADDRESS_00000000000000000",
    },
    captcha: {},      // token -> {code, exp}
  };
}

// ===== 工具函数 =====
function hashPassword(pwd, salt) {
  return crypto.pbkdf2Sync(pwd, salt, PBKDF2_ITER, PBKDF2_KEYLEN, 'sha256').toString('hex');
}
function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }
function nowStr() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
function json(obj, status, headers) {
  return {
    statusCode: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, headers || {}),
    body: JSON.stringify(obj),
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
  return { 'Set-Cookie': SESSION_COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (maxAge || 86400 * 7) };
}
function clearCookieHeader() {
  return { 'Set-Cookie': SESSION_COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' };
}
function getUser(db, event) {
  const cookies = parseCookies(event);
  const token = cookies[SESSION_COOKIE];
  if (!token || !db.sessions[token]) return null;
  return db.users[db.sessions[token].uid] || null;
}
function emptyBalances() {
  return {
    USDT: { free: 0, frozen: 0 },
    BTC: { free: 0, frozen: 0 },
    ETH: { free: 0, frozen: 0 },
    SOL: { free: 0, frozen: 0 },
  };
}
function totalUsdt(balances, prices) {
  let t = (balances.USDT ? (balances.USDT.free + balances.USDT.frozen) : 0);
  const p = prices || { BTC: 65000, ETH: 3500, SOL: 150 };
  ['BTC', 'ETH', 'SOL'].forEach(function (c) {
    if (balances[c]) t += (balances[c].free + balances[c].frozen) * (p[c] || 0);
  });
  return t;
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
function genTotpSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * 32)];
  return s;
}

// ===== 路由 =====
exports.handler = async function (event, context) {
  // 解析路径：去掉 /.netlify/functions/api 前缀，得到如 /account, /support/messages
  let path = event.path || '';
  path = path.replace(/^\/\.netlify\/functions\/api\/?/, '').replace(/^\/api\/?/, '');
  const method = event.httpMethod || 'GET';
  let body = {};
  if (event.body) { try { body = JSON.parse(event.body); } catch (e) { body = {}; } }

  const db = await loadDB();

  // ---------- GET /api/config ----------
  if (path === 'config' && method === 'GET') {
    return json({
      ok: true,
      google_mock_enabled: process.env.ALLOW_GOOGLE_MOCK === '1',
      site: { name: 'BTCBOX', version: 'netlify-1.0' },
    });
  }

  // ---------- POST /api/captcha ----------
  if (path === 'captcha' && method === 'POST') {
    const token = genToken();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.captcha[token] = { code: code, exp: Date.now() + 5 * 60 * 1000 };
    await saveDB(db);
    // 简化：返回验证码明文（生产应发邮件/短信）
    return json({ ok: true, captcha_token: token, captcha_code: code });
  }

  // ---------- POST /api/register ----------
  if (path === 'register' && method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const pwd = body.password || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, msg: '邮箱格式不正确' });
    if (pwd.length < 6) return json({ ok: false, msg: '密码至少6位' });
    const exists = Object.values(db.users).find(function (u) { return u.email === email; });
    if (exists) return json({ ok: false, msg: '该邮箱已注册' });
    const uid = String(db.next_uid++);
    const salt = genSalt();
    db.users[uid] = {
      uid: uid, email: email,
      password_hash: hashPassword(pwd, salt), salt: salt,
      fund_password: '', twofa_secret: '', twofa_enabled: false,
      kyc: { status: 'unsubmitted', name: '', id_type: 'id_card', id_number: '', submitted_at: '' },
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
      if (!totpVerify(user.twofa_secret, body.twofa_code)) return json({ ok: false, msg: '2FA验证码错误' });
    }
    if (user.frozen) return json({ ok: false, msg: '账户已被冻结，请联系客服' });
    user.last_login = nowStr();
    const token = genToken();
    db.sessions[token] = { uid: user.uid, email: email, created_at: Date.now() };
    await saveDB(db);
    return json({ ok: true }, 200, setCookieHeader(token));
  }

  // ---------- POST /api/google-login ----------
  if (path === 'google-login' && method === 'POST') {
    const idToken = body.id_token || '';
    if (idToken.startsWith('mock_google:')) {
      if (process.env.ALLOW_GOOGLE_MOCK !== '1') return json({ ok: false, msg: '模拟登录未开启' });
      const email = idToken.slice('mock_google:'.length).trim().toLowerCase();
      if (!email) return json({ ok: false, msg: '邮箱无效' });
      let user = Object.values(db.users).find(function (u) { return u.email === email; });
      if (!user) {
        const uid = String(db.next_uid++);
        const salt = genSalt();
        user = {
          uid: uid, email: email,
          password_hash: hashPassword(genToken(), salt), salt: salt,
          fund_password: '', twofa_secret: '', twofa_enabled: false,
          kyc: { status: 'unsubmitted', name: '', id_type: 'id_card', id_number: '', submitted_at: '' },
          balances: emptyBalances(), orders: [], deposits: [], withdrawals: [], earn_records: [], support_messages: [],
          created_at: nowStr(), last_login: nowStr(),
        };
        db.users[uid] = user;
      }
      user.last_login = nowStr();
      const token = genToken();
      db.sessions[token] = { uid: user.uid, email: email, created_at: Date.now() };
      await saveDB(db);
      return json({ ok: true }, 200, setCookieHeader(token));
    }
    return json({ ok: false, msg: '暂不支持真实Google登录，请配置GOOGLE_CLIENT_ID' });
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
    if (!totpVerify(u2.twofa_secret, code)) return json({ ok: false, msg: '2FA验证码错误' });
    delete db.temp_tokens[tt];
    u2.last_login = nowStr();
    const token2 = genToken();
    db.sessions[token2] = { uid: u2.uid, email: u2.email, created_at: Date.now() };
    await saveDB(db);
    return json({ ok: true }, 200, setCookieHeader(token2));
  }

  // ---------- GET /api/kline（代理 Binance K线） ----------
  if (path === 'kline' && method === 'GET') {
    const symbol = (event.queryStringParameters && event.queryStringParameters.symbol) || 'BTCUSDT';
    try {
      const res = await fetch('https://api.binance.com/api/v3/klines?symbol=' + symbol + '&interval=1m&limit=100');
      const data = await res.json();
      const out = data.map(function (k) { return { time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]) }; });
      // 兼容前端 market-api.js getKline 期望的 j.data（Binance 原始数组格式）
      return json({ ok: true, klines: out, data: data });
    } catch (e) { return json({ ok: false, msg: 'K线数据不可用' }); }
  }

  // ---------- GET /api/depth（代理 Binance 盘口） ----------
  if (path === 'depth' && method === 'GET') {
    const symbol = (event.queryStringParameters && event.queryStringParameters.symbol) || 'BTCUSDT';
    try {
      const res = await fetch('https://api.binance.com/api/v3/depth?symbol=' + symbol + '&limit=20');
      const data = await res.json();
      return json({ ok: true, bids: data.bids, asks: data.asks });
    } catch (e) { return json({ ok: false, msg: '盘口数据不可用' }); }
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
    // 兼容前端旧字段：每个币种补 amount(=free) / usdt(估值)，返回 total_usdt 别名
    const PRICE_MAP = { BTC: 67000, ETH: 3500, SOL: 168, BNB: 600, XRP: 0.52, DOGE: 0.13, ADA: 0.45, AVAX: 34, LINK: 14, DOT: 6.8, TRX: 0.13, MATIC: 0.72, LTC: 84, BCH: 478, NEAR: 5.7, UNI: 8.9, ATOM: 7.2, ETC: 26, XLM: 0.11, ALGO: 0.19 };
    const compatBalances = {};
    Object.keys(user.balances).forEach(function (c) {
      const b = user.balances[c];
      const price = c === 'USDT' ? 1 : (PRICE_MAP[c] || 0);
      compatBalances[c] = { free: b.free, frozen: b.frozen, amount: b.free, usdt: (b.free + b.frozen) * price };
    });
    const total = totalUsdt(user.balances);
    return json({
      ok: true,
      uid: user.uid, email: user.email,
      kyc: user.kyc,
      kyc_level: user.kyc.status === 'approved' ? 2 : (user.kyc.status === 'pending' ? 1 : 0),
      balances: compatBalances,
      totalUsdt: total,
      total_usdt: total,
      orders: user.orders.slice(-50),
      deposits: user.deposits.slice(-20),
      withdrawals: user.withdrawals.slice(-20),
      earn_records: user.earn_records,
      fund_password_set: !!user.fund_password,
      twofa_enabled: user.twofa_enabled,
      deposit_addresses: db.deposit_addresses,
    });
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
    const amount = parseFloat(body.amount) || 0;
    // amount <= 0 时为查询地址模式，仅返回充值地址，不入账
    if (amount <= 0) {
      const key = coin + '-' + network;
      const addr = db.deposit_addresses[key] || '';
      return json({ ok: true, address: addr, msg: '充值地址' });
    }
    if (!user.balances[coin]) user.balances[coin] = { free: 0, frozen: 0 };
    user.balances[coin].free += amount;
    user.deposits.push({
      id: 'D' + Date.now(), coin: coin, network: body.network || 'TRC20',
      amount: amount, address: body.address || '', txid: body.txid || 'simulated_' + Date.now(),
      status: 'confirmed', time: nowStr(),
    });
    await saveDB(db);
    return json({ ok: true, msg: '充值已到账' });
  }

  // ---------- POST /api/withdraw ----------
  if (path === 'withdraw' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    const coin = body.coin || 'USDT';
    const amount = parseFloat(body.amount) || 0;
    const addr = body.address || '';
    if (!addr) return json({ ok: false, msg: '请输入提币地址' });
    if (amount <= 0) return json({ ok: false, msg: '金额无效' });
    if (!user.balances[coin]) user.balances[coin] = { free: 0, frozen: 0 };
    const fee = { USDT: 1.0, BTC: 0.0001, ETH: 0.001, SOL: 0.01 }[coin] || 1.0;
    if (user.balances[coin].free < amount + fee) return json({ ok: false, msg: '可用余额不足（含手续费）' });
    if (user.fund_password && body.fund_password !== user.fund_password) return json({ ok: false, msg: '资金密码错误' });
    if (user.twofa_enabled && !totpVerify(user.twofa_secret, body.twofa_code || '')) return json({ ok: false, msg: '2FA验证码错误' });
    user.balances[coin].free -= (amount + fee);
    user.balances[coin].frozen += amount;
    user.withdrawals.push({
      id: 'W' + Date.now(), coin: coin, network: body.network || 'TRC20',
      amount: amount, fee: fee, address: addr, status: 'pending', time: nowStr(),
    });
    await saveDB(db);
    return json({ ok: true, msg: '提现申请已提交，审核通过后到账' });
  }

  // ---------- GET /api/market ----------
  if (path === 'market' && method === 'GET') {
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'NEARUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT'];
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=' + encodeURIComponent(JSON.stringify(symbols)));
      const data = await res.json();
      const out = data.map(function (t) {
        return {
          sym: t.symbol.replace('USDT', ''),
          price: parseFloat(t.lastPrice),
          chg: parseFloat(t.priceChangePercent),
          high: parseFloat(t.highPrice),
          low: parseFloat(t.lowPrice),
          vol: (parseFloat(t.quoteVolume) / 1e9).toFixed(2) + 'B',
        };
      });
      // 兼容前端 market-api.js pollOnce 期望的 j.data 对象格式 {BASE: {price,chg,high,low,vol,ts}}
      const dataObj = {};
      data.forEach(function (t) {
        const base = t.symbol.replace('USDT', '');
        dataObj[base] = { price: parseFloat(t.lastPrice), chg: parseFloat(t.priceChangePercent), high: parseFloat(t.highPrice), low: parseFloat(t.lowPrice), vol: parseFloat(t.quoteVolume), ts: Math.floor(Date.now() / 1000) };
      });
      return json({ ok: true, markets: out, data: dataObj });
    } catch (e) {
      return json({ ok: false, msg: '行情源不可用' });
    }
  }

  // ---------- POST /api/order ----------
  if (path === 'order' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    const symbol = body.symbol || 'BTCUSDT';
    const side = body.side || 'buy';
    const type = body.type || body.order_type || 'limit'; // 兼容前端 order_type 旧字段
    const qty = parseFloat(body.qty) || 0;
    const price = parseFloat(body.price) || 0;
    if (qty <= 0) return json({ ok: false, msg: '数量无效' });
    const base = symbol.replace('USDT', '');
    const total = type === 'market' ? qty : qty * price;
    if (side === 'buy') {
      if (user.balances.USDT.free < total) return json({ ok: false, msg: 'USDT余额不足' });
      user.balances.USDT.free -= total;
      if (!user.balances[base]) user.balances[base] = { free: 0, frozen: 0 };
      user.balances[base].free += qty;
    } else {
      if (!user.balances[base]) user.balances[base] = { free: 0, frozen: 0 };
      if (user.balances[base].free < qty) return json({ ok: false, msg: base + '余额不足' });
      user.balances[base].free -= qty;
      user.balances.USDT.free += total;
    }
    const order = {
      id: 'O' + Date.now(), symbol: symbol, side: side, type: type,
      qty: qty, price: price || 0, total: total, status: 'filled',
      time: nowStr(), source: 'simulated',
    };
    user.orders.push(order);
    await saveDB(db);
    return json({ ok: true, order: order, msg: '下单成功' });
  }

  // ---------- POST /api/earn ----------
  if (path === 'earn' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    const action = body.action || 'subscribe';
    if (action === 'subscribe') {
      const amount = parseFloat(body.amount) || 0;
      if (amount <= 0) return json({ ok: false, msg: '金额无效' });
      if (user.balances.USDT.free < amount) return json({ ok: false, msg: 'USDT余额不足' });
      user.balances.USDT.free -= amount;
      user.balances.USDT.frozen += amount;
      const pid = body.product_id || 'flex_USDT';
      const apy = pid.indexOf('fixed90') > -1 ? 12 : (pid.indexOf('fixed30') > -1 ? 8.5 : (pid.indexOf('fixed180') > -1 ? 6.8 : 5.2));
      user.earn_records.push({
        id: 'E' + Date.now(), product_id: pid, product: pid, type: pid.startsWith('fixed') ? 'fixed' : 'flexible',
        amount: amount, apy: apy, expected_interest: (amount * apy / 100 / 365 * 30).toFixed(4),
        start: nowStr(), end: pid.startsWith('fixed') ? '锁仓到期自动赎回' : '随存随取',
        status: '持有中',
      });
      await saveDB(db);
      return json({ ok: true, msg: '申购成功' });
    }
    if (action === 'redeem') {
      const rid = body.record_id;
      const rec = user.earn_records.find(function (r) { return r.id === rid; });
      if (!rec) return json({ ok: false, msg: '记录不存在' });
      user.balances.USDT.frozen -= rec.amount;
      user.balances.USDT.free += rec.amount;
      rec.status = '已赎回';
      await saveDB(db);
      return json({ ok: true, msg: '赎回成功' });
    }
    return json({ ok: false, msg: '未知操作' });
  }

  // ---------- POST /api/support/chat ----------
  if (path === 'support/chat' && method === 'POST') {
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    user.support_messages.push({ id: 'M' + Date.now(), from: 'user', content: body.content || '', time: nowStr() });
    // 自动回复
    setTimeout(function () { }, 0);
    user.support_messages.push({ id: 'M' + (Date.now() + 1), from: 'admin', content: '您的消息已收到，客服将在工作时间内尽快回复。常见问题可查看帮助中心。', time: nowStr() });
    await saveDB(db);
    return json({ ok: true });
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
    user.fund_password = pwd;
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
    if (!user) return json({ ok: false, msg: '未登录', need_login: true });
    return json({ ok: true, orders: user.orders.slice(-50) });
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
    try {
      const [u, p] = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
      const ADMIN_USER = process.env.ADMIN_USER || 'feiji';
      const ADMIN_PASS = process.env.ADMIN_PASS || 'feiji123456';
      if (u === ADMIN_USER && p === ADMIN_PASS) return true;
    } catch (e) { }
    return null;
  }
  if (path.startsWith('admin/')) {
    if (!adminAuth()) {
      return json({ ok: false, msg: '管理员认证失败' }, 401, { 'WWW-Authenticate': 'Basic realm="BTCBOX Admin"' });
    }
    const sub = path.slice(6); // 去掉 admin/ 前缀

    // GET /api/admin/stats
    if (sub === 'stats' && method === 'GET') {
      const users = Object.values(db.users);
      const pendingWd = users.reduce(function (s, u) { return s + u.withdrawals.filter(function (w) { return w.status === 'pending'; }).length; }, 0);
      const pendingKyc = users.filter(function (u) { return u.kyc.status === 'pending'; }).length;
      return json({ ok: true, total_users: users.length, pending_withdrawals: pendingWd, pending_kyc: pendingKyc, deposit_addresses: db.deposit_addresses, announcement: db.announcement || '' });
    }

    // GET /api/admin/users?search=
    if (sub === 'users' && method === 'GET') {
      const q = ((event.queryStringParameters && event.queryStringParameters.search) || '').toLowerCase();
      let list = Object.values(db.users);
      if (q) list = list.filter(function (u) { return u.email.toLowerCase().indexOf(q) > -1 || u.uid.indexOf(q) > -1; });
      return json({ ok: true, users: list.map(function (u) { return { uid: u.uid, email: u.email, kyc_status: u.kyc.status, total_usdt: totalUsdt(u.balances), created_at: u.created_at, frozen: !!u.frozen, twofa: u.twofa_enabled }; }).slice(0, 200) });
    }

    // GET /api/admin/user?uid=
    if (sub === 'user' && method === 'GET') {
      const uid = (event.queryStringParameters && event.queryStringParameters.uid) || '';
      const u = db.users[uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      return json({ ok: true, user: u });
    }

    // POST /api/admin/user/balance 调整余额
    if (sub === 'user/balance' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      const coin = body.coin || 'USDT';
      const delta = parseFloat(body.delta) || 0;
      if (!u.balances[coin]) u.balances[coin] = { free: 0, frozen: 0 };
      u.balances[coin].free = Math.max(0, u.balances[coin].free + delta);
      await saveDB(db);
      return json({ ok: true, msg: '余额已调整', balances: u.balances });
    }

    // POST /api/admin/user/freeze 冻结/解冻
    if (sub === 'user/freeze' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      u.frozen = !!body.frozen;
      u.frozen_reason = body.reason || '';
      await saveDB(db);
      return json({ ok: true, msg: u.frozen ? '账户已冻结' : '账户已解冻' });
    }

    // POST /api/admin/user/reset-pwd
    if (sub === 'user/reset-pwd' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      if ((body.new_password || '').length < 6) return json({ ok: false, msg: '密码至少6位' });
      u.salt = genSalt();
      u.password_hash = hashPassword(body.new_password, u.salt);
      await saveDB(db);
      return json({ ok: true, msg: '密码已重置' });
    }

    // POST /api/admin/user/reset-email
    if (sub === 'user/reset-email' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      u.email = (body.new_email || '').trim().toLowerCase();
      await saveDB(db);
      return json({ ok: true, msg: '邮箱已修改' });
    }

    // POST /api/admin/deposit/confirm 人工确认充值到账
    if (sub === 'deposit/confirm' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      const coin = body.coin || 'USDT';
      const amount = parseFloat(body.amount) || 0;
      if (amount <= 0) return json({ ok: false, msg: '金额无效' });
      if (!u.balances[coin]) u.balances[coin] = { free: 0, frozen: 0 };
      u.balances[coin].free += amount;
      u.deposits.push({ id: 'D' + Date.now(), coin: coin, network: body.network || 'TRC20', amount: amount, address: '', txid: body.txid || 'admin_' + Date.now(), status: 'confirmed', time: nowStr(), confirmed_by: 'admin' });
      await saveDB(db);
      return json({ ok: true, msg: '充值已到账' });
    }

    // POST /api/admin/withdraw/approve
    if (sub === 'withdraw/approve' && method === 'POST') {
      const wdId = body.id;
      let found = null;
      Object.values(db.users).forEach(function (u) {
        const w = u.withdrawals.find(function (x) { return x.id === wdId; });
        if (w && w.status === 'pending') {
          w.status = 'approved';
          w.confirmed_by = 'admin';
          u.balances[w.coin].frozen = Math.max(0, u.balances[w.coin].frozen - w.amount);
          found = w;
        }
      });
      if (!found) return json({ ok: false, msg: '提现记录不存在或已处理' });
      await saveDB(db);
      return json({ ok: true, msg: '提现已通过并汇出' });
    }

    // POST /api/admin/withdraw/reject
    if (sub === 'withdraw/reject' && method === 'POST') {
      const wdId = body.id;
      let found = null;
      Object.values(db.users).forEach(function (u) {
        const w = u.withdrawals.find(function (x) { return x.id === wdId; });
        if (w && w.status === 'pending') {
          w.status = 'rejected';
          w.reject_reason = body.reason || '';
          u.balances[w.coin].frozen = Math.max(0, u.balances[w.coin].frozen - w.amount);
          u.balances[w.coin].free += w.amount + w.fee;
          found = w;
        }
      });
      if (!found) return json({ ok: false, msg: '提现记录不存在或已处理' });
      await saveDB(db);
      return json({ ok: true, msg: '提现已拒绝，资金已退回' });
    }

    // POST /api/admin/kyc/approve
    if (sub === 'kyc/approve' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      u.kyc.status = 'approved';
      u.kyc.reviewed_by = 'admin';
      u.kyc.reviewed_at = nowStr();
      await saveDB(db);
      return json({ ok: true, msg: 'KYC已通过' });
    }

    // POST /api/admin/kyc/reject
    if (sub === 'kyc/reject' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: '用户不存在' });
      u.kyc.status = 'rejected';
      u.kyc.reject_reason = body.reason || '';
      await saveDB(db);
      return json({ ok: true, msg: 'KYC已拒绝' });
    }

    // POST /api/admin/push 推送站内信
    if (sub === 'push' && method === 'POST') {
      const content = body.content || '';
      if (body.uid) {
        const u = db.users[body.uid];
        if (u) u.support_messages.push({ id: 'M' + Date.now(), from: 'admin', content: content, time: nowStr() });
      } else {
        Object.values(db.users).forEach(function (u) { u.support_messages.push({ id: 'M' + Date.now(), from: 'admin', content: content, time: nowStr() }); });
      }
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

    // GET /api/admin/config
    if (sub === 'config' && method === 'GET') {
      return json({ ok: true, deposit_addresses: db.deposit_addresses, announcement: db.announcement || '' });
    }

    // POST /api/admin/config 更新充值地址和公告
    if (sub === 'config' && method === 'POST') {
      if (body.deposit_addresses) db.deposit_addresses = Object.assign(db.deposit_addresses, body.deposit_addresses);
      if (typeof body.announcement === 'string') db.announcement = body.announcement;
      await saveDB(db);
      return json({ ok: true, msg: '配置已更新', deposit_addresses: db.deposit_addresses, announcement: db.announcement });
    }


    // GET /api/admin/withdrawals 待审核提现列表
    if (sub === 'withdrawals' && method === 'GET') {
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (u.withdrawals || []).forEach(function (w) {
          if (w.status === 'pending') list.push({ id: w.id, uid: u.uid, email: u.email, coin: w.coin, amount: w.amount, network: w.network, address: w.address, time: w.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, withdrawals: list });
    }
    // GET /api/admin/orders 全部订单
    if (sub === 'orders' && method === 'GET') {
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (u.orders || []).forEach(function (o) {
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
        (u.support_messages || []).filter(function(m){return m.from==='user';}).forEach(function (m) {
          list.push({ id: m.id, uid: u.uid, email: u.email, content: m.content, time: m.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, messages: list.slice(0, 100) });
    }
    return json({ ok: false, msg: '未知管理接口: ' + sub }, 404);
  }

  return json({ ok: false, msg: '接口不存在: ' + method + ' /' + path }, 404);
};
