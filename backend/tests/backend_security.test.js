'use strict';
// 后端安全修复单元测试（phase2）。纯函数，无网络/无 DB 依赖。
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { _test } = require(path.join(__dirname, '..', 'api-core.js'));

// ========== Critical#1: 充值地址 env-only，缺失/格式错 fail-closed ==========
test('depositAddressFromEnv: 未设置环境变量返回空串（fail-closed，绝不回退硬编码）', () => {
  // 确保所有充值地址 env 未设置
  const keys = Object.values(_test.DEPOSIT_ADDRESS_ENV_KEYS);
  const saved = {};
  keys.forEach(k => { saved[k] = process.env[k]; delete process.env[k]; });
  try {
    for (const network of Object.keys(_test.DEPOSIT_ADDRESS_ENV_KEYS)) {
      assert.equal(_test.depositAddressFromEnv(network), '', network + ' 缺失时必须为空');
    }
  } finally {
    keys.forEach(k => { if (saved[k] !== undefined) process.env[k] = saved[k]; else delete process.env[k]; });
  }
});

test('depositAddressFromEnv: 格式不匹配返回空串（0x 必须是 EVM，base58 必须是 SOL/TRX/BTC）', () => {
  const saved = {};
  const setEnv = (k, v) => { saved[k] = process.env[k]; process.env[k] = v; };
  try {
    // BTC 给 EVM 地址 → 格式错 → 空
    setEnv('DEPOSIT_BTC', '0xC52985De12ed0EB4dA3DDC861dE84E28213751E8');
    assert.equal(_test.depositAddressFromEnv('BTC-BTC'), '');
    // USDT-TRC20 给 0x → 空
    setEnv('DEPOSIT_USDT_TRC20', '0xC52985De12ed0EB4dA3DDC861dE84E28213751E8');
    assert.equal(_test.depositAddressFromEnv('USDT-TRC20'), '');
    // ETH 给合法 0x → 返回原值（trim）
    setEnv('DEPOSIT_ETH', '  0xC52985De12ed0EB4dA3DDC861dE84E28213751E8  ');
    assert.equal(_test.depositAddressFromEnv('ETH-ERC20'), '0xC52985De12ed0EB4dA3DDC861dE84E28213751E8');
    // SOL 给合法 base58 → 返回
    setEnv('DEPOSIT_SOL', 'EC2dRbTBaNGih5oCYyNSCXF4PK8QH7aJgdhffd2JB7nj');
    assert.equal(_test.depositAddressFromEnv('SOL-SOL'), 'EC2dRbTBaNGih5oCYyNSCXF4PK8QH7aJgdhffd2JB7nj');
  } finally {
    Object.keys(saved).forEach(k => { if (saved[k] !== undefined) process.env[k] = saved[k]; else delete process.env[k]; });
  }
});

test('源码中不存在硬编码充值地址 fallback（grep 校验）', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');
  // 旧硬编码地址不应再出现
  assert.ok(!src.includes('TQqCNQ5X29x1JvzyWaX68VP5eRHzTVoyDD'), 'USDT TRC20 硬编码地址已移除');
  assert.ok(!src.includes('bc1p0vynt34kzuh7t565dmptq3f45gjsa3xupkjsnwcdstskqynny6ns9222gx'), 'BTC 硬编码地址已移除');
  assert.ok(!src.includes('0x4273171b03e749eBA37F8DD6B8aDB5fa0Dc370Ad'), 'BNB 硬编码地址已移除');
  assert.ok(!src.includes('EC2dRbTBaNGih5oCYyNSCXF4PK8QH7aJgdhffd2JB7nj'), 'SOL 硬编码地址已移除');
});

// ========== Critical#2: publishable key trim + 格式校验 ==========
test('getPublishableKey: trim 空白并拒绝含空格/换行或格式非法的值', () => {
  const saved = { pk: process.env.SUPABASE_AUTH_PUBLISHABLE_KEY, ak: process.env.SUPABASE_AUTH_ANON_KEY };
  try {
    delete process.env.SUPABASE_AUTH_PUBLISHABLE_KEY; delete process.env.SUPABASE_AUTH_ANON_KEY;
    assert.equal(_test.getPublishableKey(), '', '未设置返回空');
    process.env.SUPABASE_AUTH_PUBLISHABLE_KEY = '  sb_publishable_abc123XYZ  \n';
    assert.equal(_test.getPublishableKey(), 'sb_publishable_abc123XYZ', 'trim 首尾空白');
    process.env.SUPABASE_AUTH_PUBLISHABLE_KEY = 'sb_publishable_abc 123'; // 含内部空格
    assert.equal(_test.getPublishableKey(), '', '含内部空格返回空');
    process.env.SUPABASE_AUTH_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature';
    assert.ok(_test.getPublishableKey().startsWith('eyJ'), 'JWT(eyJ) 格式合法');
    process.env.SUPABASE_AUTH_PUBLISHABLE_KEY = 'plain-invalid-key';
    assert.equal(_test.getPublishableKey(), '', '非法格式返回空');
  } finally {
    if (saved.pk !== undefined) process.env.SUPABASE_AUTH_PUBLISHABLE_KEY = saved.pk; else delete process.env.SUPABASE_AUTH_PUBLISHABLE_KEY;
    if (saved.ak !== undefined) process.env.SUPABASE_AUTH_ANON_KEY = saved.ak; else delete process.env.SUPABASE_AUTH_ANON_KEY;
  }
});

// ========== High#3: 提现白名单拒绝 + 冷却 ==========
test('withdrawalAddressCheck: 未绑定地址拒绝（ADDRESS_NOT_BOUND）', () => {
  const user = { addresses: [{ type: 'crypto', coin: 'USDT', network: 'TRC20', address: 'TOTHER11111111111111111111111111111', created_at: '2020-01-01 00:00:00' }] };
  const r = _test.withdrawalAddressCheck(user, 'TQqCNQ5X29x1JvzyWaX68VP5eRHzTVoyDD', 'USDT', 'TRC20', Date.now(), 24 * 3600 * 1000);
  assert.equal(r.allowed, false);
  assert.equal(r.code, 'ADDRESS_NOT_BOUND');
});

test('withdrawalAddressCheck: 已绑定且过冷却期允许；新绑定 24h 内拒绝（ADDRESS_COOLDOWN）', () => {
  const now = Date.now();
  const oldAddr = { type: 'crypto', coin: 'USDT', network: 'TRC20', address: 'TQqCNQ5X29x1JvzyWaX68VP5eRHzTVoyDD', created_at: '2020-01-01 00:00:00' };
  const userOld = { addresses: [oldAddr] };
  assert.equal(_test.withdrawalAddressCheck(userOld, 'TQqCNQ5X29x1JvzyWaX68VP5eRHzTVoyDD', 'USDT', 'TRC20', now, 24 * 3600 * 1000).allowed, true);
  // 1 小时前绑定 → 冷却中
  const recent = new Date(now - 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const userNew = { addresses: [{ type: 'crypto', coin: 'USDT', network: 'TRC20', address: 'TQqCNQ5X29x1JvzyWaX68VP5eRHzTVoyDD', created_at: recent }] };
  const r = _test.withdrawalAddressCheck(userNew, 'TQqCNQ5X29x1JvzyWaX68VP5eRHzTVoyDD', 'USDT', 'TRC20', now, 24 * 3600 * 1000);
  assert.equal(r.allowed, false);
  assert.equal(r.code, 'ADDRESS_COOLDOWN');
});

test('withdrawalRequiresAdminReview: 首次提现/大额强制人工审核', () => {
  const noHistory = { withdrawals: [] };
  assert.equal(_test.withdrawalRequiresAdminReview(noHistory, 'USDT', 10, 10, 1000), true, '首次提现必须审核');
  const hasSuccess = { withdrawals: [{ status: 'completed' }] };
  assert.equal(_test.withdrawalRequiresAdminReview(hasSuccess, 'USDT', 10, 10, 1000), false, '小额非首次不审核');
  assert.equal(_test.withdrawalRequiresAdminReview(hasSuccess, 'USDT', 5000, 5000, 1000), true, '超阈值大额审核');
});

// ========== High#4: 资金密码强度 + 持久化锁定 ==========
test('validateFundPassword: 最小 8 位且必须含字母+数字', () => {
  assert.equal(_test.validateFundPassword('123456').ok, false, '6 位纯数字不再允许');
  assert.equal(_test.validateFundPassword('abcdefgh').ok, false, '纯字母不允许');
  assert.equal(_test.validateFundPassword('12345678').ok, false, '纯数字不允许');
  assert.equal(_test.validateFundPassword('abc12345').ok, true, '8 位字母+数字合法');
  assert.equal(_test.validateFundPassword('ab 12345').ok, false, '含空格不允许');
});

test('validateAdminPasswordStrength: ≥12 位含大小写+数字+符号', () => {
  assert.equal(_test.validateAdminPasswordStrength('short1!'), false);
  assert.equal(_test.validateAdminPasswordStrength('alllowercase123!'), false, '缺大写');
  assert.equal(_test.validateAdminPasswordStrength('ALLUPPERCASE123!'), false, '缺小写');
  assert.equal(_test.validateAdminPasswordStrength('NoDigitsHere!!'), false, '缺数字');
  assert.equal(_test.validateAdminPasswordStrength('NoSymbol123Abc'), false, '缺符号');
  assert.equal(_test.validateAdminPasswordStrength('Str0ng!Passw0rdX9'), true, '合法强密码');
});

test('secCounter: 5 次失败后锁定 15 分钟，成功后重置', () => {
  const counters = {};
  const now = 1000000;
  const key = 'fundpwd_lock:u1';
  for (let i = 1; i <= 4; i++) {
    _test.secCounterRecordFailure(counters, key, 5, 15 * 60 * 1000, now);
    assert.equal(_test.secCounterIsLocked(counters, key, now).locked, false, '第' + i + '次未锁定');
  }
  _test.secCounterRecordFailure(counters, key, 5, 15 * 60 * 1000, now);
  const locked = _test.secCounterIsLocked(counters, key, now);
  assert.equal(locked.locked, true, '第 5 次失败后锁定');
  assert.ok(locked.retryAfter > 0, '返回 retryAfter');
  // 15 分钟后解锁
  assert.equal(_test.secCounterIsLocked(counters, key, now + 16 * 60 * 1000).locked, false, '锁过期后解锁');
  // 重置
  _test.secCounterReset(counters, key);
  assert.equal(counters[key], undefined, '重置后计数器清除');
});

// ========== Medium#7: parseMoneyInput 仅接受 string ==========
test('parseMoneyInput: 拒绝 number 类型，仅接受 string', () => {
  assert.equal(_test.parseMoneyInput(123.45), null, 'number 类型拒绝');
  assert.equal(_test.parseMoneyInput(0), null, 'number 0 拒绝');
  assert.equal(_test.parseMoneyInput('123.45'), 123.45, 'string 合法');
  assert.equal(_test.parseMoneyInput('0'), 0, 'string 0 合法');
  assert.equal(_test.parseMoneyInput('abc'), null, '非法 string 拒绝');
  assert.equal(_test.parseMoneyInput('-5'), null, '负数拒绝');
});
