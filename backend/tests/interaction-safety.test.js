'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const account = read('assets/js/views-account.js');
const assets = read('assets/js/views-assets.js');

test('support conversation renders untrusted message bodies as text nodes', () => {
  assert.ok(account.includes("item.textContent=String(m.text==null?'':m.text)"),
    'message bodies must be assigned through textContent');
  assert.ok(!/item\.innerHTML\s*=.*m\.text/.test(account),
    'message text must not be interpolated into HTML');
});

test('ambiguous support delivery pauses sending until conversation history is reloaded', () => {
  assert.ok(account.includes('if(!message||sendInFlight||historyLoading||historyFailed)return;'),
    'a failed or ambiguous history state must block another send');
  assert.ok(/if\(ambiguous\)\{\s*historyFailed=true;/.test(account),
    'an ambiguous send result must put the conversation into a guarded state');
  assert.ok(account.includes('historyRetry.onclick=loadHistory;'),
    'the user must have an explicit history-reload recovery path');
  assert.ok(account.includes('apiAdapter.supportMessages()'),
    'recovery must reload the authoritative conversation history');
  assert.ok(account.includes('Message delivery is unconfirmed. Reload conversation history before sending again.'),
    'the user must be told not to retry blindly');
});

test('withdrawal UNKNOWN intent and request ID survive a full page reload', () => {
  assert.ok(assets.includes('localStorage.getItem(withdrawalPendingStorageKey)'),
    'the account-scoped pending intent must be restored from browser storage');
  assert.ok(assets.includes('localStorage.setItem(withdrawalPendingStorageKey,JSON.stringify(intent))'),
    'the original request identity and immutable intent must be stored');
  assert.ok(assets.includes('withdrawalPendingIntent=readPendingWithdrawal()'),
    'route entry must restore the pending intent');
  assert.ok(assets.includes('request_id:withdrawalIntent.request_id'),
    'the exact stored request ID must be sent to the backend');
  assert.ok(assets.includes('if(!persistPendingWithdrawal(withdrawalIntent))'),
    'storage failure must stop the request before network I/O');
  assert.ok(assets.indexOf('if(!persistPendingWithdrawal(withdrawalIntent))') <
    assets.indexOf('await apiAdapter.withdraw({coin:withdrawalIntent.coin'),
    'request identity must be persisted before the withdrawal POST');
  assert.ok(assets.includes('(withdrawalPendingIntent&&withdrawalPendingIntent.request_id)'),
    'the original request ID must remain visible as a support reference');
});

test('persistent withdrawal intent contains only its documented non-secret fields', () => {
  const intent = assets.match(/const withdrawalIntent=\{([^}]+)\};/);
  assert.ok(intent, 'withdrawal intent object must be explicit and auditable');
  const keys = [...intent[1].matchAll(/(?:^|,)\s*([a-z_]+)\s*(?=:|,|$)/g)].map(match => match[1]).sort();
  assert.deepEqual(keys, ['address','amount','coin','created_at','network','request_id','version'].sort());
});

test('corrupt withdrawal state fails closed and the address preview is escaped', () => {
  assert.ok(assets.includes('return {version:1,invalid:true}'),
    'malformed stored state must not silently unlock a new withdrawal');
  assert.ok(assets.includes('withdrawalOutcomeUnknown=!!(withdrawalPendingIntent'),
    'invalid or pending persisted state must keep the account locked');
  assert.ok(assets.includes('const safeAddr=addr.replace('),
    'user-controlled destination must be escaped before HTML rendering');
});

test('withdrawal result escapes server-provided text and identifiers before HTML rendering', () => {
  const match = assets.match(/function escapeWdText\(value\)\{[\s\S]*?\n  \}/);
  assert.ok(match, 'withdrawal result must define an HTML text escaper');
  const fnSource = match[0].replace('function escapeWdText(value)', 'function(value)');
  const escapeText = vm.runInNewContext('(' + fnSource + ')');
  assert.equal(
    escapeText('<img src=x onerror="alert(1)"> & \'quoted\''),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;'
  );
  const start = assets.indexOf('function showResult(r, coin, amt)');
  const end = assets.indexOf("$('#wd-coin').onchange", start);
  const showResult = assets.slice(start, end);
  assert.ok(showResult.includes('const safeSub=escapeWdText(st.sub)'), 'server result text must be escaped');
  assert.ok(showResult.includes('safeWid=escapeWdText(wid)'), 'server/request IDs must be escaped');
  assert.ok(showResult.includes('safeCoin=escapeWdText(coin)'), 'dynamic coin label must be escaped');
  assert.ok(!showResult.includes("'+st.sub+'"), 'raw server text must not enter HTML');
  assert.ok(!showResult.includes("'+wid+'"), 'raw IDs must not enter HTML');
});

test('KYC transport and 5xx outcomes stay locked until account status is authoritative', () => {
  const match = account.match(/function isKycOutcomeUnknown\(r\)\{[\s\S]*?\n  \}/);
  assert.ok(match, 'KYC view must classify ambiguous transport/server outcomes');
  const fnSource = match[0].replace('function isKycOutcomeUnknown(r)', 'function(r)');
  const classify = vm.runInNewContext('(' + fnSource + ')');
  assert.equal(classify({status:0,code:'NETWORK_ERROR'}), true);
  assert.equal(classify({status:503,code:'INTERNAL_ERROR'}), true);
  assert.equal(classify({status:400,code:'KYC_INVALID_INPUT'}), false);
  assert.equal(classify({status:409,code:'KYC_ALREADY_PENDING'}), false);
  assert.ok(account.includes('await reconcileKycOutcome(btn)'), 'ambiguous results must reconcile through account status');
  assert.ok(account.includes("r.code==='KYC_ALREADY_PENDING'"), 'already-pending must be reflected as a pending state');
  assert.ok(account.includes("r.code==='KYC_ALREADY_APPROVED'"), 'already-approved must be reflected as an approved state');
  assert.ok(account.includes('outcomeUnknown=true;'), 'unconfirmed KYC state must block repeat submission');
  assert.ok(account.includes('state._kycUnknownUserKey=kycUserKey'), 'the UNKNOWN lock must survive SPA route changes');
  assert.ok(account.includes('state._kycUnknownUserKey===kycUserKey'), 'the lock must be scoped to the authenticated account');
  assert.ok(account.includes('if(f&&outcomeUnknown)'), 're-entering KYC must reconcile the prior UNKNOWN state before allowing submit');
});