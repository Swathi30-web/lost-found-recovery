// Vercel serverless wrapper that runs JSON Server (data is kept in /tmp, so it resets on cold starts - fine for a demo).
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

const tmp = '/tmp/db.json';
if (!fs.existsSync(tmp)) fs.copyFileSync(path.join(process.cwd(), 'db.seed.json'), tmp);

const server = jsonServer.create();
server.use(jsonServer.defaults({ logger: false }));
server.use(jsonServer.rewriter({ '/api/*': '/$1' }));
server.use(jsonServer.router(tmp));
module.exports = server;
