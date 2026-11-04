'use strict';
// One catch-all Vercel Function serves every /api/* route through the shared adapter.
// Keeping individual route entrypoints would exceed the Vercel Hobby 12-function limit.
module.exports = require('../api-adapter.js');
