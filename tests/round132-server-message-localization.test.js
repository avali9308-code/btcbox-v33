const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const i18n = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8');
const addresses = fs.readFileSync(path.join(root, 'pages/addresses.html'), 'utf8');

test('Round 132: server-message normalization is exported through I18N', () => {
  assert.match(i18n, /function translateMessage\(message\)/);
  assert.match(i18n, /translateMessage:translateMessage/);
  assert.match(i18n, /currentLang === 'zh-CN' \|\| !\/\[\\u3400-\\u9fff\]\/\.test\(source\)/);
});

test('Round 132: critical authentication and financial messages have English-safe mappings', () => {
  for (const source of [
    '账号或密码错误', '账户已被冻结，请联系客服', '会话已过期，请重新登录',
    '可用余额不足（含手续费）', '提现申请已提交，审核通过后到账',
    '财务数据库暂不可用；提现未确认，请检查操作记录后再重试。',
    '请求标识已用于其他提现内容，请刷新后重试'
  ]) assert.ok(i18n.includes(source), `missing message mapping: ${source}`);
  assert.match(i18n, /ROUND132_UNKNOWN_SERVER_MESSAGE = 'The request could not be completed/);
});

test('Round 132: address management normalizes API errors before display', () => {
  assert.match(addresses, /I18N\.translateMessage\(j\.msg\|\|I18N\.t\('addressOperationFailed'\)\)/);
  assert.match(addresses, /I18N\.t\('addressNetworkError'\)/);
  assert.match(addresses, /I18N\.t\('noSavedAddresses'\)/);
  assert.doesNotMatch(addresses, /textContent\s*=\s*j\.msg\s*\|\|/);
});

test('Round 133: every Chinese API msg literal has a reviewed translation or safe prefix rule', () => {
  const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
  const matches = [...api.matchAll(/msg\s*:\s*'([^']*[\u3400-\u9fff][^']*)'/g)].map(m => m[1]);
  const unique = [...new Set(matches)];
  const prefixRules = ['充值地址格式无效：', '接口不存在:', '未知管理接口:'];
  const missing = unique.filter(message => !i18n.includes(message) && !prefixRules.some(prefix => message.startsWith(prefix)));
  assert.deepEqual(missing, [], `Chinese API messages missing localization: ${missing.join(' | ')}`);
});

test('Round 133: address cards do not directly render Chinese support copy', () => {
  assert.match(addresses, /I18N\.t\('contactSupportForChanges'\)/);
  assert.doesNotMatch(addresses, /<div[^>]*>请联系客服处理<\/div>/);
});
