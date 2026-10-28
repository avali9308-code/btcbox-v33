const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'netlify', 'functions', 'api.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'STORAGE-RELIABILITY.md'), 'utf8');

test('storage layer fails closed on read and write errors', () => {
  assert.match(api, /throw new Error\('Persistent storage unavailable'\)/);
  assert.match(api, /throw new Error\('Persistent storage write failed'\)/);
  assert.match(api, /code: 'PERSISTENCE_UNAVAILABLE'/);
});

test('storage audit explicitly records cross-instance transaction gap', () => {
  assert.match(api, /无法解决跨实例并发读-改-写竞争/);
  assert.match(report, /风险级别：资金账本不适合/);
  assert.match(report, /没有跨实例事务/);
});

test('backup and migration are documented as unverified, not falsely marked complete', () => {
  assert.match(report, /没有在本轮执行生产 Blobs 数据导出/);
  assert.match(report, /没有经过演练的恢复脚本/);
  assert.match(report, /差异为零或经批准解释后才可切换/);
});

test('Netlify build never deletes local data paths', () => {
  const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.doesNotMatch(config, /\brm\s+-rf\b|\brm\s+-f\s+(?:data\.json|actions\.log|uploads)/i);
  assert.match(config, /command\s*=\s*"npm test(?:\s*&&\s*npm run build)?"/);
  assert.match(report, /netlify\.toml.*build command/);
});
