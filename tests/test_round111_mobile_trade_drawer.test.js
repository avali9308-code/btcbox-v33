const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'pages', 'trade.html'), 'utf8');

test('mobile K-line drawer spans the mobile viewport instead of half the screen', () => {
  assert.match(html, /@media\s*\(max-width:\s*767px\)\s*\{\s*\.kline-drawer\s*\{[^}]*width:\s*100%/s);
  const baseDrawer = html.split('@media(min-width:768px)')[0];
  assert.doesNotMatch(baseDrawer, /\.kline-drawer\s*\{[^}]*width:\s*50vw/s);
});

test('K-line drawer uses dynamic viewport height and respects bottom safe area', () => {
  assert.match(html, /height:\s*92dvh/);
  assert.match(html, /max-height:\s*100dvh/);
  assert.match(html, /padding-bottom:\s*env\(safe-area-inset-bottom\)/);
});

test('desktop K-line drawer remains a side panel', () => {
  assert.match(html, /@media\s*\(min-width:\s*768px\)\s*\{[^}]*\.kline-drawer\s*\{[^}]*width:\s*50vw/s);
  assert.match(html, /\.kline-drawer\.open\s*\{\s*transform:\s*translateX\(0\)/);
});
