const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const api = fs.readFileSync(path.join(root, 'netlify/functions/api.js'), 'utf8');

test('Netlify build must not delete runtime or user data', () => {
  const buildBlock = (config.match(/\[build\][\s\S]*?(?=\n\[\[|\n\[headers\]|$)/) || [''])[0];
  assert.doesNotMatch(buildBlock, /\brm\s+-rf\b|\brm\s+-f\s+(?:data\.json|actions\.log|uploads)/i);
  assert.match(buildBlock, /command\s*=\s*"npm test(?:\s*&&\s*npm run build)?"/);
});

test('Netlify API must keep service secrets server-side', () => {
  assert.match(api, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(api, /process\.env\.SUPABASE_SECRET_KEY/);
  for (const html of ['index.html', 'trade.html', 'assets.html']) {
    const file = path.join(root, html);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
  }
});

test('Netlify API routes remain mapped to the serverless handler', () => {
  assert.match(config, /from\s*=\s*"\/api\/\*"[\s\S]*?to\s*=\s*"\/\.netlify\/functions\/api\/:splat"/);
});

test('Netlify publishes only the allowlisted public build, not repository source', () => {
  assert.match(config, /publish\s*=\s*"dist"/);
  const buildScript = fs.readFileSync(path.join(root, 'scripts/build-site.js'), 'utf8');
  // admin.html 有内置 Basic Auth 登录页，密码在服务端验证，可安全公开部署
  assert.match(buildScript, /allowedFiles\s*=\s*\['index\.html', 'admin\.html'\]/);
  assert.match(buildScript, /allowedDirs\s*=\s*\['pages', 'assets'\]/);
});
