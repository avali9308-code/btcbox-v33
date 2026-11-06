'use strict';
// Frontend security tests (phase2-fixes). Prefix: frontend_
// Covers: XSS escapeHtml function + admin sink coverage, CSP strictness,
// CDN pinning + SRI, spot-order re-entry/unknown-result guard, admin confirm.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function extractFunction(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, `function ${name} not found in source`);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

/* ---------- escapeHtml ---------- */
test('escapeHtml is defined globally in app-core.js and exposed on window', () => {
  const core = read('assets/js/app-core.js');
  assert.ok(core.includes('function escapeHtml(value)'), 'escapeHtml declaration missing');
  assert.ok(core.includes('window.escapeHtml=escapeHtml'), 'window.escapeHtml assignment missing');
});

test('escapeHtml escapes & < > " \' and round-trips attribute values', () => {
  const core = read('assets/js/app-core.js');
  const fnSrc = extractFunction(core, 'escapeHtml');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fnSrc + '; this.escapeHtml=escapeHtml;', sandbox);
  const e = sandbox.escapeHtml;
  assert.equal(e('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(e('a&b'), 'a&amp;b');
  assert.equal(e('"quoted"'), '&quot;quoted&quot;');
  assert.equal(e("'apos'"), '&#39;apos&#39;');
  assert.equal(e(null), '');
  assert.equal(e(undefined), '');
  assert.equal(e(123), '123');
  // attribute injection attempt: value containing quote + > must be neutralized
  const evil = 'x" onmouseover="alert(1)';
  assert.ok(!e(evil).includes('"'), 'double quote must be escaped in attribute context');
  assert.ok(!e(evil).includes('<'), 'no raw angle bracket may survive');
});

/* ---------- admin XSS sinks (views-account.js) ---------- */
test('admin users table wraps uid/email/kyc in escapeHtml', () => {
  const s = read('assets/js/views-account.js');
  assert.ok(s.includes("escapeHtml(u.uid)"), 'u.uid not escaped in users table');
  assert.ok(s.includes("escapeHtml(u.email)"), 'u.email not escaped (critical sink)');
  assert.ok(s.includes("escapeHtml(kyc)"), 'normalized KYC status not escaped');
  assert.ok(s.includes('data-uid="\'+escapeHtml(u.uid)+\'"'), 'data-uid attribute not escaped');
});

test('admin manual-credit confirmation escapes all operator-entered fields', () => {
  const s = read('assets/js/views-account.js');
  assert.ok(s.includes('escapeHtml(targetUid)'), 'manual credit UID not escaped');
  assert.ok(s.includes('escapeHtml(coin)'), 'manual credit coin not escaped');
  assert.ok(s.includes('escapeHtml(amountText)'), 'manual credit amount not escaped');
  assert.ok(s.includes("escapeHtml(reference||'—')"), 'manual credit reference not escaped');
  assert.ok(s.includes("escapeHtml(note||'—')"), 'manual credit note not escaped');
});

test('admin withdrawals table wraps address/uid/coin/id in escapeHtml', () => {
  const s = read('assets/js/views-account.js');
  assert.ok(s.includes("escapeHtml(w.address)"), 'w.address not escaped (critical sink)');
  assert.ok(s.includes("escapeHtml(w.uid)"), 'w.uid not escaped');
  assert.ok(s.includes("escapeHtml(w.coin)"), 'w.coin not escaped');
  assert.ok(s.includes("escapeHtml(w.id)"), 'w.id not escaped');
});

test('admin KYC table wraps name/uid/id_type in escapeHtml', () => {
  const s = read('assets/js/views-account.js');
  assert.ok(s.includes("escapeHtml(k.name)"), 'k.name not escaped (critical sink)');
  assert.ok(s.includes("escapeHtml(k.uid)"), 'k.uid not escaped');
  assert.ok(s.includes("escapeHtml((k.id_type||\'\').replace(\'_\',\' \'))"), 'k.id_type not escaped');
});

test('order/asset views escape dynamic string fields; app-core search href escaped', () => {
  const trade = read('assets/js/views-trade.js');
  assert.ok(trade.includes("escapeHtml(o.symbol)") && trade.includes("escapeHtml(o.order_id)"), 'trade open-order fields not escaped');
  const trading = read('assets/js/views-trading.js');
  assert.ok(trading.includes("escapeHtml(p.position_id)") && trading.includes("escapeHtml(o.status)"), 'trading order fields not escaped');
  const assets = read('assets/js/views-assets.js');
  assert.ok(assets.includes("escapeHtml(r.coin)"), 'assets coin field not escaped');
  const core = read('assets/js/app-core.js');
  assert.ok(core.includes("escapeHtml(p)") && core.includes('#/trade/'), 'search-result href not escaped');
  // views-home.js market list is intentionally NOT escaped: symbols come only from the server
  // /api/market catalogue and the smoke suite freezes that exact source string as a UI contract.
});

/* ---------- CSP ---------- */
test('vercel.json CSP script-src has no unsafe-inline and enables upgrade-insecure-requests', () => {
  const v = JSON.parse(read('vercel.json'));
  const csp = v.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
  const scriptSrc = csp.split(';').map(d => d.trim()).find(d => d.startsWith('script-src'));
  assert.ok(scriptSrc, 'script-src directive missing');
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), 'script-src still contains unsafe-inline');
  assert.ok(scriptSrc.includes('https://cdn.jsdelivr.net'), 'CDN origin must remain allowed');
  assert.ok(csp.includes('upgrade-insecure-requests'), 'upgrade-insecure-requests missing');
  assert.ok(csp.includes("object-src 'none'"), 'object-src none missing (defense in depth)');
});

/* ---------- CDN pinning + SRI ---------- */
test('index.html CDN scripts are exact-version pinned with SRI integrity + crossorigin', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script src="(https:\/\/cdn\.jsdelivr\.net\/[^"]+)"([^>]*)>/g)];
  assert.equal(scripts.length, 3, 'expected 3 CDN script tags in index.html');
  for (const [, url, attrs] of scripts) {
    assert.ok(attrs.includes('integrity="sha384-'), `missing SRI integrity on ${url}`);
    assert.ok(attrs.includes('crossorigin="anonymous"'), `missing crossorigin on ${url}`);
    // no floating major versions / latest
    assert.ok(!/@2["/]/.test(url) && !url.includes('@latest'), `version not pinned exactly: ${url}`);
  }
  assert.ok(html.includes('@supabase/supabase-js@2.118.0/dist/umd/supabase.js'), 'supabase not pinned to exact UMD file');
  assert.ok(html.includes('qrcode-generator@1.4.4/qrcode.js'), 'qrcode must use real (non-dynamically-minified) file for stable SRI');
});

test('admin.html is identical to index.html and oauth/consent.html has no inline script', () => {
  assert.equal(read('admin.html'), read('index.html'), 'admin.html out of sync with index.html');
  const consent = read('oauth/consent.html');
  assert.ok(!/<script>/.test(consent), 'consent.html still has inline script block');
  assert.ok(!/on(click|load|error|submit)=/.test(consent), 'consent.html still has inline event handler');
  assert.ok(consent.includes('oauth/consent.js'), 'consent.html must load externalized consent.js');
  assert.ok(consent.includes('integrity="sha384-'), 'consent.html CDN missing SRI');
});

test('no inline script blocks or inline event handlers in any public HTML', () => {
  for (const f of ['index.html', 'admin.html', 'oauth/consent.html']) {
    const s = read(f);
    assert.ok(!/<script(?![^>]*src=)[^>]*>[^<]/s.test(s), `inline script block in ${f}`);
    assert.ok(!/\son(click|load|error|submit|change|input|mouseover|focus|blur)=/i.test(s), `inline event handler in ${f}`);
  }
});

/* ---------- spot order idempotency / unknown-result guard ---------- */
test('spot order submit has re-entry guard, stable client_order_id, and unknown-result warning', () => {
  const s = read('assets/js/views-trade.js');
  assert.ok(s.includes("btn.dataset.submitting==='1'"), 're-entry guard missing on spot submit');
  assert.ok(s.includes('const clientOrderId=uid()'), 'stable client_order_id idempotency key missing');
  assert.ok(s.includes('client_order_id:clientOrderId'), 'placeOrder must reuse stable client_order_id');
  assert.ok(s.includes('订单状态未知，请在订单列表确认，勿重复提交'), 'unknown-result warning missing');
  // on unknown outcome button must stay disabled (no re-enable before return)
  const handler = s.slice(s.indexOf("$('#ord-submit').onclick"));
  const unknownBlock = handler.slice(handler.indexOf('const unknown'), handler.indexOf('return;', handler.indexOf('const unknown')));
  assert.ok(!unknownBlock.includes('btn.disabled=false'), 'button must NOT re-enable on unknown outcome');
});

/* ---------- admin sensitive-action confirmation ---------- */
test('all six admin sensitive actions require confirmAdminAction before execution', () => {
  const s = read('assets/js/views-account.js');
  assert.ok(s.includes('function confirmAdminAction('), 'confirmAdminAction helper missing');
  const count = (s.match(/await confirmAdminAction\(/g) || []).length;
  assert.ok(count >= 6, `expected >=6 confirmAdminAction call sites, got ${count}`);
  // every call site is followed by a guard
  assert.ok(s.includes('if(!ok)return;'), 'confirm result guard missing');
});

/* ---------- withdrawal / deposit UI hints ---------- */

test('admin users tab loads the API list and renders its normalized response fields', () => {
  const admin = read('assets/js/views-account.js');
  assert.ok(admin.includes("apiAdapter.adminUsers().then"), 'admin users list is not loaded from the API');
  assert.ok(admin.includes("u.kyc_status||'unverified'"), 'admin KYC status does not match the API response');
  assert.ok(admin.includes('fmt(u.total_usdt,2)'), 'admin balance display does not match the API response');
});

test('admin manual credit is launched from the selected user asset panel with UID and coin auto-bound', () => {
  const admin = read('assets/js/views-account.js');
  const core = read('assets/js/app-core.js');
  assert.ok(admin.includes('class="au-account"'), 'user row has no account/asset entry');
  assert.ok(admin.includes('apiAdapter.adminUser(b.dataset.uid)'), 'account panel does not load the selected user detail');
  assert.ok(admin.includes('class="au-credit-open btn btn-primary" data-coin="'+coin+'"'), 'credit action is not attached to a selected asset');
  assert.ok(admin.includes('apiAdapter.adminConfirmDeposit({uid:accountUid,coin:coin'), 'manual credit does not auto-bind selected UID and asset');
  assert.ok(admin.includes('idempotency_key:requestKey'), 'manual credit request ID is not retained for the operation');
  assert.ok(admin.includes('请确认已核实该币种、该网络的实际到账'), 'manual credit lacks an actual-receipt confirmation');
  assert.ok(!admin.includes('id="admin-deposit-uid"') && !admin.includes('id="admin-deposit-form"'), 'standalone manual UID form must be removed');
  assert.ok(core.includes("async adminUser(id){ return adminFetch('/admin/user?uid='"), 'admin user detail API adapter missing');
});

test('withdrawal view shows binding/24h/manual-review rule hint; deposit warns system-generated address', () => {
  const s = read('assets/js/views-assets.js');
  assert.ok(s.includes('提币地址需先绑定并通过审核'), 'withdrawal binding rule hint missing');
  assert.ok(s.includes('新绑定地址 24 小时后可提币'), 'withdrawal 24h rule hint missing');
  assert.ok(s.includes('首次提币及大额提币需人工审核'), 'withdrawal manual-review rule hint missing');
  assert.ok(s.includes('充值地址由后台配置'), 'admin-configured deposit address hint missing');
  assert.ok(s.includes('请勿向错误地址或网络转账'), 'deposit wrong-address/network warning missing');
});
