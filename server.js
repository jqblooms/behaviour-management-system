const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = 4173;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function version() {
  return ['index.html', 'styles.css', 'classes.js', 'analytics.js', 'homework.js', 'rooms.js', 'detentions.js', 'script.js']
    .map((file) => fs.statSync(path.join(root, file)).mtimeMs)
    .join('-');
}

http.createServer((request, response) => {
  if (request.url === '/__version') {
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' });
    response.end(version());
    return;
  }

  const pathname = request.url === '/' ? '/index.html' : decodeURIComponent(request.url.split('?')[0]);
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Mockup running at http://localhost:${port}`));
