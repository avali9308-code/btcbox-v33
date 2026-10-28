'use strict';

// Build an allowlisted public directory. Source code, SQL migrations, tests,
// environment templates, and operational documentation stay in GitHub only.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const allowedFiles = ['index.html', 'admin.html']; // admin.html 有内置 Basic Auth 登录页，密码在服务端验证，可安全公开部署
const allowedDirs = ['pages', 'assets'];

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
console.log('BTCBOX public build created in dist/ (allowlisted HTML, pages, and assets only).');
