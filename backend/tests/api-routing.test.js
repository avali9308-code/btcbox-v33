'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const adapter = require('../api-adapter.js');
const catchAll = require('../api/[...path].js');
const routes = ['login/2fa','addresses/select','order/cancel','seconds/order','seconds/settle','seconds/positions','settings/password','settings/fundpwd','2fa/enable','2fa/confirm','2fa/disable','support/chat','support/messages','chat/unread','admin/stats','admin/users','admin/user','admin/addresses','admin/withdrawals','admin/orders','admin/support/messages','admin/config','admin/audit-logs'];
function listJavaScriptFiles(dir, prefix='') {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const relative=path.posix.join(prefix,entry.name);
    return entry.isDirectory()?listJavaScriptFiles(path.join(dir,entry.name),relative):(entry.isFile()&&entry.name.endsWith('.js')?[relative]:[]);
  });
}
test('all nested API paths are served by one catch-all function within Vercel Hobby limits', () => {
  assert.strictEqual(catchAll,adapter,'the catch-all must reuse the tested shared adapter');
  const apiFiles=listJavaScriptFiles(path.join(__dirname,'..','api')).sort();
  assert.deepEqual(apiFiles,['[...path].js','healthz.js']);
  assert.ok(apiFiles.length<=12,'Vercel Hobby allows at most 12 serverless functions per deployment');
});
test('all 23 nested API routes preserve their canonical request path through the catch-all', () => {
  assert.equal(routes.length,23);
  for(const route of routes){
    const event=adapter.createApiEvent({url:'/api/'+route+'?probe=1',method:'GET',headers:{cookie:'session_token=session-value'}},'');
    assert.equal(event.path,'/api/'+route,route+' path must be preserved');
    assert.deepEqual(event.queryStringParameters,{probe:'1'});
    assert.equal(event.headers.cookie,'session_token=session-value');
  }
});
test('readBody consumes a real Node Readable request stream', async () => {
  const req=Readable.from([Buffer.from('{"symbol":'),Buffer.from('"BTCUSDT"}')]);
  assert.equal(await adapter.readBody(req),'{"symbol":"BTCUSDT"}');
});
test('readBody rejects a real Node Readable stream above the 1 MiB limit', async () => {
  const req=Readable.from([Buffer.alloc(1024*1024+1)]);
  await assert.rejects(adapter.readBody(req),error=>error&&error.statusCode===413);
});
test('nested POST preserves method, body, cookie and authorization', () => {
  const body=JSON.stringify({symbol:'BTCUSDT',side:'buy',amount:'0.01'});
  const req={url:'/api/seconds/order?source=mobile',method:'POST',headers:{cookie:'session_token=session-value',authorization:'Bearer test-token','content-type':'application/json'}};
  const event=adapter.createApiEvent(req,body);
  assert.equal(event.path,'/api/seconds/order'); assert.equal(event.httpMethod,'POST');
  assert.deepEqual(event.queryStringParameters,{source:'mobile'}); assert.equal(event.body,body);
  assert.equal(event.headers.cookie,'session_token=session-value'); assert.equal(event.headers.authorization,'Bearer test-token');
});
