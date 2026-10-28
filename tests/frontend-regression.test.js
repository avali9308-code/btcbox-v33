const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlFiles = [
  'index.html', 'admin.html',
  ...fs.readdirSync(path.join(root, 'pages')).filter(name => name.endsWith('.html')).map(name => `pages/${name}`)
];

test('all customer pages retain mobile viewport and do not disable pinch zoom', () => {
  for (const relative of htmlFiles.filter(file => file !== 'admin.html')) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(html, /name=["']viewport["']/i, `${relative} must define a viewport`);
    assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0+)?/i, `${relative} must allow user zoom`);
  }
});

test('all relative local href and src references resolve to existing project files', () => {
  for (const relative of htmlFiles) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const url = match[1];
      if (/^(?:https?:|\/\/|data:|javascript:|#|mailto:|tel:)/i.test(url)) continue;
      const clean = url.split('#')[0].split('?')[0];
      if (!clean) continue;
      const target = path.resolve(root, clean.startsWith('/') ? clean.slice(1) : path.join(path.dirname(relative), clean));
      assert.ok(target.startsWith(root + path.sep) || target === root, `${relative}: reference escapes project root: ${url}`);
      assert.ok(fs.existsSync(target), `${relative}: missing local reference ${url}`);
    }
  }
});

test('address binding declares English as the public frontend language', () => {
  const html = fs.readFileSync(path.join(root, 'pages/addresses.html'), 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title[^>]*data-i18n="r131_0">/);
});

test('support chat input and message area expose accessible labels', () => {
  const html = fs.readFileSync(path.join(root, 'pages/support.html'), 'utf8');
  assert.match(html, /id="chatInput"[^>]*aria-label=|aria-label=[^>]*id="chatInput"/);
  assert.match(html, /id="chatBody"[^>]*role="log"|role="log"[^>]*id="chatBody"/);
});

test('earn page exposes only products supported by the backend catalog', () => {
  const html = fs.readFileSync(path.join(root, 'pages/earn.html'), 'utf8');
  assert.match(html, /data-pid="flex_USDT"/);
  assert.match(html, /data-pid="fixed30"/);
  assert.match(html, /data-pid="fixed90"/);
  assert.match(html, /data-pid="fixed180"/);
  assert.doesNotMatch(html, /BTC 活期|ETH 活期|BTC 180天定期/);
  assert.match(html, /USDT 180天定期/);
});

test('earn retries reuse a session-scoped idempotency key after ambiguous failures', () => {
  const html = fs.readFileSync(path.join(root, 'pages/earn.html'), 'utf8');
  assert.match(html, /sessionStorage\.getItem\(key\)/);
  assert.match(html, /sessionStorage\.setItem\(key,id\)/);
  assert.match(html, /request_id:req\.id/);
  assert.match(html, /_network_error/);
  assert.match(html, /j\._status >= 500/);
});


test('frontend API endpoints are wired to explicit backend routes', () => {
  const backend = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');
  const sources = [...htmlFiles, ...fs.readdirSync(path.join(root, 'assets/js'))
    .filter(name => name.endsWith('.js')).map(name => `assets/js/${name}`)];
  const endpoints = new Set();
  for (const relative of sources) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    for (const match of source.matchAll(/fetch\s*\(\s*(['"`])((?:\.\.\/|\/)?api\/[^'"`?#]*)/g)) {
      let endpoint = match[2].replace(/^\.\.\//, '/').replace(/^\//, '');
      endpoint = endpoint.replace(/^api\//, '').replace(/\/$/, '');
      if (endpoint) endpoints.add(endpoint);
    }
  }
  const missing = [...endpoints].filter(endpoint => {
    // The admin page deliberately posts to the API root for its generic action dispatcher.
    const escaped = endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`path\\s*===?\\s*['"]${escaped}['"]`).test(backend)
      && !new RegExp(`['"]${escaped}['"]\\s*\\|\\|\\s*path`).test(backend);
  });
  assert.deepEqual(missing, [], `frontend API endpoint(s) without an explicit backend route: ${missing.join(', ')}`);
});

test('Netlify routes /api/* to the shared function and keeps sensitive JSON files blocked', () => {
  const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(config, /from\s*=\s*"\/api\/\*"[\s\S]*?to\s*=\s*"\/\.netlify\/functions\/api\/:splat"[\s\S]*?status\s*=\s*200/);
  assert.match(config, /from\s*=\s*"\/data\.json"[\s\S]*?status\s*=\s*404/);
  assert.match(config, /from\s*=\s*"\/actions\.log"[\s\S]*?status\s*=\s*404/);
});
