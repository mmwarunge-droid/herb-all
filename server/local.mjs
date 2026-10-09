import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { handler } from './api.mjs';
const root = resolve('dist');
const port = Number(process.env.PORT || 4321);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      let chunks = [],
        size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 6000000) {
          res.writeHead(413);
          res.end();
          return;
        }
        chunks.push(chunk);
      }
      const r = await handler(
        new Request(url, {
          method: req.method,
          headers: req.headers,
          body: ['GET', 'HEAD'].includes(req.method)
            ? undefined
            : Buffer.concat(chunks),
        }),
        { ip: req.socket.remoteAddress },
      );
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + '/') && path !== root) {
      res.writeHead(404);
      res.end();
      return;
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const file = await readFile(path);
    const type =
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.jpg': 'image/jpeg',
        '.json': 'application/json',
        '.xml': 'application/xml',
      }[extname(path)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () =>
  console.log('Commerce preview on http://127.0.0.1:' + port),
);
