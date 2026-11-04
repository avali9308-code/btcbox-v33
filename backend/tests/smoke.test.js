'use strict';
// Smoke test: public build pipeline + modular asset bundle integrity.
// No network, no secrets.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('build-site.js produces dist/index.html and dist/admin.html', () => {
  execFileSync('node', [path.join(root, 'scripts', 'build-site.js')], { cwd: root, stdio: 'ignore' });
  assert.ok(fs.existsSync(path.join(root, 'dist', 'index.html')));
  assert.ok(fs.existsSync(path.join(root, 'dist', 'admin.html')));
  assert.ok(fs.existsSync(path.join(root, 'dist', 'assets', 'js', 'app-core.js')));
  assert.ok(fs.existsSync(path.join(root, 'dist', 'assets', 'css', 'tokens.css')));
});

test('thin shells reference every asset in load order and keep mount points', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="main-content"'));
  assert.ok(html.includes('id="toast-root"') && html.includes('id="modal-root"'));
  assert.ok(html.includes('@supabase/supabase-js'));
  assert.ok(!html.includes('cdn.tailwindcss.com'), 'production Tailwind CDN must not be loaded');
  const jsOrder = ['app-core', 'ui-components', 'views-home', 'views-trade', 'views-trading', 'views-assets', 'views-account', 'views-missing', 'boot']
    .map(n => html.indexOf(`/assets/js/${n}.js`));
  assert.ok(jsOrder.every(i => i >= 0), 'missing a js asset reference');
  assert.deepEqual(jsOrder, [...jsOrder].sort((a, b) => a - b), 'js load order wrong');
  const cssOrder = ['tokens', 'base', 'components', 'overlays', 'layouts', 'views'].map(n => html.indexOf(`/assets/css/${n}.css`));
  assert.ok(cssOrder.every(i => i >= 0), 'missing a css asset reference');
  assert.deepEqual(cssOrder, [...cssOrder].sort((a, b) => a - b), 'css load order wrong');
});

test('asset bundle contains router + VIEWS registry + all view batches', () => {
  const core = read('assets/js/app-core.js');
  assert.ok(core.includes('function router') || /router\s*=\s*async/.test(core), 'router missing from app-core');
  assert.ok(core.includes('const VIEWS') || core.includes('VIEWS ='), 'VIEWS stub missing from app-core');
  assert.ok(core.includes('const apiAdapter'), 'apiAdapter missing from app-core');
  const batches = {
    'ui-components.js': ['BTCBox.modal', 'BTCBox.drawer', 'BTCBox.toast', 'drawer-root'],
    'views-home.js': ['VIEWS.login', 'VIEWS.register', 'VIEWS.markets'],
    'views-trade.js': ['VIEWS.trade', 'VIEWS.kline'],
    'views-trading.js': ['VIEWS.seconds', 'VIEWS.orders'],
    'views-assets.js': ['VIEWS.assets', 'VIEWS.deposit', 'VIEWS.withdraw', 'VIEWS.earn'],
    'views-account.js': ['VIEWS.kyc', 'VIEWS.support', 'VIEWS.settings', 'VIEWS.admin'],
    'views-missing.js': ['VIEWS.me', 'VIEWS.fiat', 'VIEWS.cards', 'VIEWS.transfer', 'VIEWS.invite', 'VIEWS.payment'],
    'boot.js': ['function boot', 'boot()'],
  };
  for (const [file, needles] of Object.entries(batches)) {
    const content = read(`assets/js/${file}`);
    for (const n of needles) assert.ok(content.includes(n), `${n} missing from ${file}`);
  }
});

test('admin.html stays byte-identical to index.html', () => {
  assert.equal(read('admin.html'), read('index.html'), 'index.html and admin.html have diverged');
});

test('no plaintext secrets in tracked public files or assets', () => {
  const files = ['index.html', 'admin.html', ...fs.readdirSync(path.join(root, 'assets', 'js')).map(f => 'assets/js/' + f)];
  for (const name of files) {
    const content = read(name);
    assert.ok(!/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/.test(content), `service-role JWT leaked into ${name}`);
    assert.ok(!/ghp_/.test(content), `GitHub token leaked into ${name}`);
    assert.ok(!/vcp_/.test(content), `Vercel token leaked into ${name}`);
  }
});

test('KYC endpoint validates identity input server-side and reports stable states', () => {
  const backend = read('api-core.js');
  assert.ok(backend.includes('function validateKycSubmission(body)'));
  assert.ok(backend.includes(String.raw`/[\x00-\x1f\x7f]/.test(name)`), 'name control characters must be rejected');
  assert.ok(backend.includes(String.raw`/[\x00-\x1f\x7f]/.test(idNumber)`), 'document number control characters must be rejected');
  assert.ok(backend.includes("['passport', 'id_card', 'driver_license'].includes(idType)"));
  assert.ok(backend.includes("code: 'KYC_INVALID_INPUT'"));
  assert.ok(backend.includes("code: 'KYC_ALREADY_PENDING'"));
  assert.ok(backend.includes("code: 'KYC_ALREADY_APPROVED'"));
  assert.ok(backend.includes("status: 'pending',\n      name: submission.name"));
});

test('ordinary account KYC response masks identity numbers', () => {
  const backend = read('api-core.js');
  assert.ok(backend.includes('function maskIdentityNumber(value)'));
  assert.ok(backend.includes('id_number: maskIdentityNumber(user.kyc && user.kyc.id_number)'));
  assert.ok(!backend.includes('      kyc: user.kyc,'), 'full KYC object must not be returned to ordinary users');
  assert.ok(backend.includes("return '*'.repeat(Math.max(4, raw.length - 4)) + raw.slice(-4)"));
});

test('withdrawal and earn options use the backend financial contract', () => {
  const frontend = read('assets/js/views-assets.js');
  const backend = read('api-core.js');
  assert.ok(frontend.includes("const DW_COINS=['USDT','BTC','ETH','SOL','BNB','USDC']"));
  assert.ok(frontend.includes("BTC:['BTC']") && frontend.includes("SOL:['SOL']") && frontend.includes("BNB:['BEP20']"));
  assert.ok(frontend.includes('const WITHDRAW_FEES={USDT:1,BTC:0.0001,ETH:0.001,SOL:0.01,BNB:0.0005,USDC:1}'));
  assert.ok(backend.includes("BTC:['BTC']") && backend.includes("SOL:['SOL']") && backend.includes("BNB:['BEP20']"));
  assert.ok(backend.includes('const supportedFees = { USDT: 1.0, BTC: 0.0001, ETH: 0.001, SOL: 0.01, BNB: 0.0005, USDC: 1.0 }'));
  for (const id of ['flex_USDT', 'flex_BTC', 'flex_ETH', 'fixed30', 'fixed90', 'fixed180']) {
    assert.ok(frontend.includes(`id:'${id}'`), `frontend product ${id} missing`);
    assert.ok(backend.includes(`'${id}'`), `backend product ${id} missing`);
  }
  assert.ok(frontend.includes('amt+currentFee()>avail'), 'fee-inclusive balance validation missing');
  assert.ok(frontend.includes('avail-currentFee()'), 'MAX must reserve the withdrawal fee');
});

test('route navigation and registration guards remain enforceable', () => {
  const layouts = read('assets/css/layouts.css');
  const assetStyles = read('assets/css/views-assets.css');
  const auth = read('assets/js/views-home.js');
  const boot = read('assets/js/boot.js');
  assert.ok(layouts.includes('.topbar-desk{display:flex}'));
  assert.ok(assetStyles.includes('.va-hero .va-stat-grid{grid-template-columns:1fr;gap:8px}'), 'asset statistics must outrank the account stylesheet on mobile');
  assert.ok(!layouts.includes('.mobile-nav{display:flex!important}'));
  assert.ok(layouts.includes('body.hide-nav .mobile-nav{display:none!important}'));
  assert.ok(auth.includes('id="reg-terms"'), 'registration Terms checkbox must be rendered');
  assert.ok(boot.includes("if(isRegister){ const terms=document.getElementById('reg-terms'); if(!terms || !terms.checked)"), 'Terms acceptance must block Google registration');
  assert.ok(auth.includes("data-err-for=\"reg-terms\""), 'terms error must be rendered inline');
});

test('shared overlays expose dialog semantics, honor drawer closability, and render toast text safely', () => {
  const components = read('assets/js/ui-components.js');
  const core = read('assets/js/app-core.js');
  assert.ok(components.includes('role="dialog" aria-modal="true" aria-labelledby="modal-title"'), 'modal dialog semantics missing');
  assert.ok(components.includes('var drawerX = closable ?'), 'drawer close control must follow closable option');
  assert.ok(components.includes('document.addEventListener(\'keydown\', _focusHandler)'), 'modal focus trap missing');
  assert.ok(components.includes('previousFocus.focus()'), 'modal focus restoration missing');
  assert.ok(core.includes('message.textContent=String(msg==null?\'\':msg)'), 'toast message must be inserted as text, not HTML');
  assert.ok(!/el\\.innerHTML=.*\\+msg/.test(core), 'dynamic toast message must not be interpolated into innerHTML');
});

test('mobile primary navigation matches the approved five routes and market taxonomy is spot-only', () => {
  const html = read('index.html');
  const core = read('assets/js/app-core.js');
  const home = read('assets/js/views-home.js');
  const navStart = html.indexOf('<nav class="mobile-nav" id="mobile-nav"');
  const navEnd = html.indexOf('</nav>', navStart);
  const nav = navStart >= 0 && navEnd >= navStart ? html.slice(navStart, navEnd + 6) : '';
  assert.ok(nav, 'mobile primary navigation missing');
  const routes = [...nav.matchAll(/data-route="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(routes, ['home','markets','tradehub','assets','me']);
  for (const href of ['#/home','#/markets','#/trade-hub','#/assets','#/me']) assert.ok(nav.includes(href), href + ' route missing');
  assert.ok(core.includes("trade:'tradehub'") && core.includes("settings:'me'"), 'nested routes must activate the correct primary tab');
  assert.ok(home.includes("const tabs=['All','Favorites','Top Volume']"));
  assert.ok(home.includes("'+base+' Spot</div>"));
  assert.ok(!home.includes('Perpetual') && !home.includes('SUIUSDT') && !home.includes('SEIUSDT') && !home.includes('ORDIUSDT'));
  assert.ok(home.includes('VIEWS.home = function()') && home.includes('VIEWS.tradehub = function()'));
});



// Immutable value snapshot captured from baseline 79015236453072332e9a840188ad73d76a223334 (82 root tokens).
test('design token aliases resolve to exact baseline values', () => {
  const tokens = read('assets/css/tokens.css');
  const baseline = JSON.parse(read('tests/fixtures/ds001-token-baseline.json'));
  const rootBlocks = [...tokens.matchAll(/:root\s*\{([\s\S]*?)\}/g)];
  assert.equal(rootBlocks.length, 1, 'tokens.css must own exactly one :root block');
  const declarations = [...rootBlocks[0][1].matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)\s*;/g)];
  const values = new Map();
  const counts = new Map();
  for (const [, name, value] of declarations) {
    counts.set(name, (counts.get(name) || 0) + 1);
    values.set(name, value.trim());
  }
  assert.deepEqual([...counts].filter(([, count]) => count > 1), [], 'duplicate custom-property definitions in canonical :root');
  const resolve = (name, trail = []) => {
    assert.ok(!trail.includes(name), 'cyclic token reference: ' + [...trail, name].join(' -> '));
    assert.ok(values.has(name), 'token missing from canonical root: ' + name);
    const value = values.get(name);
    const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    return ref ? resolve(ref[1], [...trail, name]) : value;
  };
  assert.equal(Object.keys(baseline).length, 82, 'baseline fixture must cover every original root token');
  for (const [name, expected] of Object.entries(baseline)) {
    assert.equal(resolve(name), expected, name + ' must resolve to its exact pre-DS-001 value');
  }
});

test('all source CSS and HTML var() references resolve across the complete stylesheet scope', () => {
  const cssDir = path.join(root, 'assets', 'css');
  const cssFiles = fs.readdirSync(cssDir).filter(name => name.endsWith('.css')).map(name => 'assets/css/' + name);
  assert.ok(cssFiles.includes('assets/css/tokens.css'));
  assert.equal(cssFiles.length, 9, 'scan every source stylesheet, not only selected global files');
  const files = [...cssFiles, 'index.html', 'admin.html', 'oauth/consent.html'];
  const definitions = new Set();
  const references = new Set();
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/(--[\w-]+)\s*:\s*[^;{}]+;/g)) definitions.add(match[1]);
    for (const match of source.matchAll(/var\(\s*(--[\w-]+)/g)) references.add(match[1]);
  }
  const unresolved = [...references].filter(name => !definitions.has(name)).sort();
  assert.deepEqual(unresolved, [], 'undefined CSS custom properties: ' + unresolved.join(', '));
});

test('OAuth keeps its pre-DS-001 error colors and core surface geometry', () => {
  const tokens = read('assets/css/tokens.css');
  const oauth = read('oauth/consent.html');
  const root = (tokens.match(/:root\s*\{([\s\S]*?)\}/) || [])[1] || '';
  const values = new Map([...root.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)\s*;/g)].map(m => [m[1], m[2].trim()]));
  const resolveToken = name => {
    let value = values.get(name);
    const seen = new Set();
    while (value && /^var\(/.test(value)) {
      const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
      assert.ok(ref && !seen.has(ref[1]), 'invalid/cyclic OAuth token ' + name);
      seen.add(ref[1]);
      value = values.get(ref[1]);
    }
    return value;
  };
  const resolveValue = value => {
    const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    return ref ? resolveToken(ref[1]) : value;
  };
  const rule = selector => {
    const escaped = selector.replace(/\./g, '\\.');
    const match = oauth.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
    assert.ok(match, 'OAuth rule missing: ' + selector);
    return match[1];
  };
  const declaration = (body, property) => {
    const match = body.match(new RegExp('(?:^|;)\\s*' + property + '\\s*:\\s*([^;]+)'));
    assert.ok(match, 'OAuth declaration missing: ' + property);
    return match[1].trim();
  };
  const err = rule('.alert-err');
  assert.equal(resolveValue(declaration(err, 'background')), 'rgba(246,70,93,.10)');
  assert.equal(declaration(err, 'background'), 'var(--oauth-alert-negative-soft)');
  assert.equal(declaration(err, 'border'), '1px solid var(--oauth-alert-negative-border)');
  assert.equal(declaration(err, 'color'), 'var(--oauth-alert-negative-text)');
  assert.equal(resolveToken('--oauth-alert-negative-border'), 'rgba(246,70,93,.35)');
  assert.equal(resolveToken('--oauth-alert-negative-text'), '#ff8a96');
  const card = rule('.card');
  assert.equal(resolveValue(declaration(card, 'background')), '#161A1E');
  assert.equal(declaration(card, 'padding'), '32px 28px');
  assert.equal(resolveValue(declaration(card, 'border-radius')), '12px');
  assert.equal(resolveValue(declaration(card, 'box-shadow')), '0 24px 64px rgba(0,0,0,.5)');
  const wrap = rule('.wrap');
  assert.equal(declaration(wrap, 'padding'), '24px 16px');
  const appBox = rule('.app-box');
  assert.equal(declaration(appBox, 'padding'), '16px');
  assert.equal(resolveValue(declaration(appBox, 'background')), '#1E2329');
  assert.ok(oauth.includes('/assets/css/tokens.css'), 'OAuth must load the shared token source');
  assert.ok(!/:root\s*\{/.test(oauth), 'OAuth must not introduce a duplicate root palette');
  assert.ok(oauth.includes('JetBrains+Mono'), 'OAuth must retain the frozen mono font');
  assert.ok(oauth.includes('family=Inter'), 'OAuth must retain the frozen sans font');
});


test('financial write and matching gates require explicit opt-in and examples default off', () => {
  const backend = read('api-core.js');
  const env = read('.env.example');
  const preflight = read('scripts/deployment-preflight.js');
  assert.ok(backend.includes("process.env.FINANCIAL_POSTGRES_RPC_ENABLED === '1'"));
  assert.ok(backend.includes("process.env.FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED === '1'"));
  assert.ok(backend.includes("process.env.FINANCIAL_POSTGRES_READS_ENABLED === '1'"));
  assert.ok(backend.includes("process.env.FINANCIAL_MATCHING_ENGINE_ENABLED === '1'"));
  for (const name of ['FINANCIAL_POSTGRES_RPC_ENABLED', 'FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED', 'FINANCIAL_POSTGRES_READS_ENABLED', 'FINANCIAL_MATCHING_ENGINE_ENABLED']) {
    assert.ok(env.includes(name + '=0'), name + ' must default to disabled in .env.example');
  }
  assert.ok(preflight.includes("process.env[name] !== '0'"), 'preflight must reject unset or malformed financial flags');
  assert.ok(env.includes('ADMIN_USER=') && env.includes('ADMIN_PASS='));
  assert.ok(!env.includes('ADMIN_PASS=feiji123456'), 'example must not ship a default admin password');
});

test('legacy python admin ships no default credentials and does not persist admin password', () => {
  const server = read('server.py');
  assert.ok(!server.includes('os.environ.get("ADMIN_USER", "feiji")'), 'server.py must not default ADMIN_USER to feiji');
  assert.ok(!server.includes('os.environ.get("ADMIN_PASS", "feiji123456")'), 'server.py must not default ADMIN_PASS to feiji123456');
  assert.ok(server.includes('os.environ.get("ADMIN_USER", "")'), 'server.py must read ADMIN_USER with no default');
  assert.ok(server.includes('os.environ.get("ADMIN_PASS", "")'), 'server.py must read ADMIN_PASS with no default');
  assert.ok(server.includes('validate_admin_credentials()'), 'server.py must validate admin credentials at startup (fail-closed)');
  assert.ok(!server.includes('"admin_pass": ADMIN_PASS'), 'server.py must not persist admin password into the data file');
  assert.ok(!server.includes('ADMIN_PASS = d["admin_pass"]'), 'server.py must not restore admin password from the data file');
});

test('admin basic-auth comparison is constant-time', () => {
  const backend = read('api-core.js');
  assert.ok(backend.includes('timingSafeEqual'), 'api-core.js admin auth must use crypto.timingSafeEqual');
});

test('seconds entry requires a confirmed positions snapshot and guards unknown outcomes', () => {
  const frontend = read('assets/js/views-trading.js');
  const start = frontend.indexOf('VIEWS.seconds.afterRender');
  const end = frontend.indexOf('/* ================= ORDERS view', start);
  const view = frontend.slice(start, end);
  assert.ok(view.includes('apiAdapter.secondsPositionsGet().then'), 'positions must load on route entry');
  assert.ok(view.includes('positionsReady=true;positionsLoadFailed=false;'), 'entry unlocks only after a successful positions read');
  assert.ok(view.includes('!result.cutover_incomplete'), 'cutover-incomplete data must not unlock order entry');
  assert.ok(view.includes('if(!positionsReady)'), 'unverified positions must block order entry');
  assert.ok(view.includes("if(!state.user){location.hash='#/login';return;}") || view.includes('window.BTCBoxRequireLogin(location.hash)'), 'guest entry must route to login');
  assert.ok(view.includes("state._secondsOrderUnknownUserKey=secondsUserKey"), 'ambiguous order outcomes must retain the SPA guard');
  assert.ok(view.includes('const unknown=isSecondsOrderOutcomeUnknown(r);'), 'order outcome classification must use the explicit response contract');
  assert.ok(view.includes('const positionMatch=findSecondsPositionSnapshot(r.position,state.secondsPositions);'), 'a successful POST must be reconciled against the refreshed server position snapshot');
  assert.ok(view.includes('r.position=positionMatch.position;'), 'the countdown must use the canonical server snapshot, not a POST timestamp');
  assert.ok(view.includes("code:'POSITION_STATUS_UNCONFIRMED'"), 'an unlisted position must remain UNKNOWN rather than display success');
  assert.ok(view.includes('state.secondsPositions.open.unshift(r.position)'), 'a server-confirmed position remains visible even if the follow-up list read failed');
});


test('seconds pre-write 503 responses are definitive while RPC and transport outcomes remain UNKNOWN', () => {
  const frontend = read('assets/js/views-trading.js');
  const start = frontend.indexOf('function isSecondsOrderOutcomeUnknown(r){');
  assert.ok(start >= 0, 'the Seconds view must define an explicit outcome classifier');
  const end = frontend.indexOf('\n  }', start);
  assert.ok(end > start, 'the Seconds outcome classifier must be a complete function');
  const classify = vm.runInNewContext('(' + frontend.slice(start, end + 4) + ')');
  assert.equal(classify({status:503,code:'FINANCIAL_CUTOVER_INCOMPLETE'}), false,
    'cutover-incomplete is a guaranteed pre-write rejection');
  assert.equal(classify({status:503,code:'REFERENCE_PRICE_UNAVAILABLE'}), false,
    'reference-price failure is a guaranteed pre-write rejection');
  assert.equal(classify({status:503,code:'FINANCIAL_RPC_FAILED'}), true,
    'an RPC failure remains ambiguous');
  assert.equal(classify({status:503,code:'FINANCIAL_RPC_UNAVAILABLE'}), true,
    'an RPC transport failure remains ambiguous');
  assert.equal(classify({status:0,code:'NETWORK_ERROR'}), true,
    'a lost HTTP response remains ambiguous');
  assert.equal(classify(null), true, 'a missing response remains ambiguous');
});


test('seconds successful POST uses the exact canonical position snapshot and never trusts a POST countdown timestamp', () => {
  const frontend = read('assets/js/views-trading.js');
  const start = frontend.indexOf('function findSecondsPositionSnapshot(position,snapshot){');
  assert.ok(start >= 0, 'the Seconds view must define a position snapshot reconciler');
  const end = frontend.indexOf('\n  }', start);
  assert.ok(end > start, 'the position snapshot reconciler must be a complete function');
  const find = vm.runInNewContext('(' + frontend.slice(start, end + 4) + ')');
  const serverPosition = {position_id:'SC-1',settle_at:1700000000};
  const openMatch = find({position_id:'SC-1',settle_at:1700000300},{open:[serverPosition],history:[]});
  assert.equal(openMatch.status, 'open');
  assert.strictEqual(openMatch.position, serverPosition,
    'the view must use the canonical object returned by GET positions');
  assert.equal(openMatch.position.settle_at, 1700000000,
    'a duplicate POST must not restart the countdown using a newly calculated timestamp');
  const historyPosition = {position_id:'SC-1',settled_at:1700000010};
  const historyMatch = find({position_id:'SC-1'},{open:[],history:[historyPosition]});
  assert.equal(historyMatch.status, 'history');
  assert.strictEqual(historyMatch.position, historyPosition);
  assert.equal(find({position_id:'SC-1'},{open:[{position_id:'SC-1'}],history:[]}).status, 'unknown',
    'an open position without a valid server settlement time must not start a broken countdown');
  assert.equal(find({position_id:'SC-2',settle_at:1700000000},{open:[],history:[]}).status, 'unknown',
    'a successful POST without its position in the refreshed snapshot must remain UNKNOWN');
  assert.equal(find(null,{open:[],history:[]}).status, 'unknown');
});


test('Google OAuth completion waits for account hydration and preserves a safe return route', () => {
  const core = read('assets/js/app-core.js');
  const boot = read('assets/js/boot.js');
  const start = core.indexOf('async completeLogin(email)');
  const end = core.indexOf('friendlyError(err)', start);
  const complete = core.slice(start, end);
  assert.ok(complete.includes('account=await apiAdapter.account()'), 'account hydration must finish before login success');
  assert.ok(complete.includes('if(!account || !account.ok)'), 'failed account hydration must not be accepted as login');
  assert.ok(complete.indexOf('apiAdapter.account()') < complete.indexOf("toast('Logged in.'"), 'success feedback must follow the account read');
  assert.ok(complete.includes('returnTarget=consumeOAuthReturnTarget()'), 'safe return target must be consumed after hydration');
  assert.ok(complete.includes('clearPrivateUserState()'), 'failed hydration must clear partial private state');
  assert.ok(core.includes('return await this.completeLogin(email)'), 'Google session exchange must await account hydration');
  assert.ok(core.includes('await Auth.completeLogin(email)'), '2FA completion must await account hydration');
  assert.ok(core.includes('target.origin!==window.location.origin'), 'OAuth return target must be same-origin');
  assert.ok(core.includes("sessionStorage.setItem('btcbox_login_return_to',location.hash||'#/markets')") || core.includes('rememberLoginReturn('), 'protected route must be retained before login redirect');
  assert.ok(boot.includes("sessionStorage.getItem('btcbox_login_return_to')"), 'Google OAuth must preserve the protected route');
  assert.ok(!boot.includes("window.location.origin+window.location.pathname+'#/markets'"), 'Google OAuth must not overwrite every return target with Markets');
});
