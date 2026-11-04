'use strict';

// Build an allowlisted public directory. Source code, SQL migrations, tests,
// environment templates, and operational documentation stay in GitHub only.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const allowedFiles = ['index.html', 'admin.html']; // admin.html is an SPA shell like index.html; Basic Auth is enforced by api-core.js on /api/admin/* endpoints, not by the HTML file itself
const allowedDirs = ['pages', 'assets', 'oauth'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of allowedFiles) {
  const src = path.join(root, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error(`Required public entry file missing: ${name}`);
  }
  fs.copyFileSync(src, path.join(out, name));
}
for (const name of allowedDirs) {
  const src = path.join(root, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`Required public directory missing: ${name}`);
  }
  fs.cpSync(src, path.join(out, name), { recursive: true });
}
// Also copy each page to the dist root so cleanUrls serves /trade, /login,
// /markets etc. natively, independent of vercel.json rewrites (which have
// proven unreliable on this project). pages/ stays for /pages/<name> and
// OAuth callback compatibility. Asset refs are absolute (/assets/...),
// relative page links resolve identically at root.
const pagesDir = path.join(root, 'pages');
for (const entry of fs.readdirSync(pagesDir)) {
  if (entry.endsWith('.html')) {
    fs.copyFileSync(path.join(pagesDir, entry), path.join(out, entry));
  }
}
console.log('BTCBOX public build created in dist/ (allowlisted HTML, pages, and assets only).');
