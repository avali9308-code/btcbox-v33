'use strict';
const { handler } = require('./api-core.js');
const MAX_BODY_BYTES = 1024 * 1024;
// CORS 默认仅生产域名；localhost 仅在 CONTEXT=dev 时加入（CONTEXT 默认 production）。
const DEFAULT_CORS_ALLOWED_ORIGINS = 'https://btcboxcdt.vercel.app';
const DEV_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://127.0.0.1:8000'];
let _corsAllowedOrigins = null;
function corsErrorHeaders(req) {
  if (_corsAllowedOrigins === null) {
    const raw = process.env.CORS_ALLOWED_ORIGINS || DEFAULT_CORS_ALLOWED_ORIGINS;
    _corsAllowedOrigins = new Set(String(raw).split(',').map(s => s.trim()).filter(Boolean));
    if (process.env.CONTEXT === 'dev') DEV_CORS_ORIGINS.forEach(o => _corsAllowedOrigins.add(o));
  }
  const origin = req.headers && (req.headers.origin || req.headers.Origin) || '';
  return origin && _corsAllowedOrigins.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Vary': 'Origin' } : {};
}
function applyCorsErrorHeaders(res, req) {
  for (const [name, value] of Object.entries(corsErrorHeaders(req))) res.setHeader(name, value);
}
async function readBody(req) {
  const chunks = []; let total = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += data.length;
    if (total > MAX_BODY_BYTES) { const e = new Error('Request body too large'); e.statusCode = 413; throw e; }
    chunks.push(data);
  }
  return Buffer.concat(chunks).toString('utf8');
}
function createApiEvent(req, body) {
  const url = new URL(req.url || '/', 'https://vercel.invalid');
  return { path:url.pathname, httpMethod:req.method || 'GET', headers:req.headers || {},
    queryStringParameters:Object.fromEntries(url.searchParams.entries()), body:body || null, isBase64Encoded:false };
}
async function vercelApi(req, res) {
  res.setHeader('Cache-Control','no-store');
  let body='';
  try { body=await readBody(req); }
  catch(error) {
    res.statusCode=error.statusCode || 400; res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store'); applyCorsErrorHeaders(res,req);
    res.end(JSON.stringify({ok:false,msg:error.statusCode===413?'Request body too large.':'Invalid request body.',code:error.statusCode===413?'REQUEST_BODY_TOO_LARGE':'INVALID_REQUEST_BODY'})); return;
  }
  try {
    const result=await handler(createApiEvent(req,body),{});
    res.statusCode=Number(result.statusCode)||200;
    for(const [name,value] of Object.entries(result.headers||{})) if(value!==undefined&&value!==null) res.setHeader(name,value);
    res.end(result.body||'');
  } catch (_) {
    res.statusCode=500; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store');
    applyCorsErrorHeaders(res,req); res.end(JSON.stringify({ok:false,msg:'The service is temporarily unavailable.',code:'INTERNAL_ERROR'}));
  }
}
vercelApi.createApiEvent=createApiEvent;
vercelApi.readBody=readBody;
module.exports=vercelApi;
