'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html', ...fs.readdirSync(path.join(root, 'pages')).filter(x => x.endsWith('.html')).map(x => `pages/${x}`)];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const attrs = raw => Object.fromEntries([...raw.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '']));
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))].map(m => attrs(m[1]));
const localPath = (from, href) => {
  const clean = href.split(/[?#]/, 1)[0];
  if (!clean) return null;
  if (clean.startsWith('/')) return path.resolve(root, `.${clean}`);
  return path.resolve(root, path.dirname(from), clean);
};

test('Round 128: all public pages have document title and English locale declaration', () => {
  for (const rel of pages) {
    const html = read(rel);
    assert.match(html, /<html\b[^>]*\blang\s*=\s*["']en["']/i, `${rel}: lang must be en`);
    assert.match(html, /<title\b[^>]*>\s*[^<]+\s*<\/title>/i, `${rel}: missing title`);
  }
  assert.match(read('admin.html'), /<html\b[^>]*\blang\s*=\s*["']zh-CN["']/i, 'admin backend keeps Chinese locale');
});

test('Round 128: every local page, script, stylesheet and image reference resolves', () => {
  const refTags = [['a', 'href'], ['script', 'src'], ['link', 'href'], ['img', 'src'], ['form', 'action']];
  for (const rel of pages) {
    const html = read(rel);
    for (const [tag, key] of refTags) for (const a of tags(html, tag)) {
      const value = a[key];
      if (!value || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(value)) continue;
      const target = localPath(rel, value);
      if (target && !fs.existsSync(target)) assert.fail(`${rel}: broken ${tag} ${key}=${value}`);
    }
  }
});

test('Round 128: no duplicate static DOM IDs on any first-visit page', () => {
  for (const rel of pages) {
    const markup = read(rel).replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const all = [...markup.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/g)].map(m => m[1] || m[2]);
    const duplicates = [...new Set(all.filter((id, i) => all.indexOf(id) !== i))];
    assert.deepEqual(duplicates, [], `${rel}: duplicate IDs: ${duplicates.join(', ')}`);
  }
});

test('Round 128: Netlify API routing and fail-closed financial cutover stay present', () => {
  const netlify = read('netlify.toml');
  const api = read('netlify/functions/api.js');
  assert.match(netlify, /from\s*=\s*"\/api\/\*"[\s\S]*?to\s*=\s*"\/.netlify\/functions\/api\/:splat"/);
  assert.match(api, /function manualDepositRpcEnabled\(\)[\s\S]*?FINANCIAL_POSTGRES_RPC_ENABLED[\s\S]*?FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED/);
  assert.match(api, /function matchingEngineEnabled\(\)[\s\S]*?financialPostgresReadsEnabled\(\)/);
});
