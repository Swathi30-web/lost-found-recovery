const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

const DB_PATH = '/tmp/db.json';
const SEED_PATH = path.join(process.cwd(), 'db.seed.json');

if (!fs.existsSync(DB_PATH)) {
  fs.copyFileSync(SEED_PATH, DB_PATH);
}

const server = jsonServer.create();

server.use(
  jsonServer.defaults({
    logger: false,
  })
);

server.use(
  jsonServer.rewriter({
    '/api/*': '/$1',
  })
);

server.use(jsonServer.router(DB_PATH));

module.exports = server;