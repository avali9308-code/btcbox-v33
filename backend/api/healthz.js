'use strict';
// Minimal static-named probe: distinguishes "functions not deployed at all"
// from "dynamic [...path] route filename issue". No dependencies.
module.exports = async function healthz(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, probe: 'healthz', ts: Date.now() }));
};
