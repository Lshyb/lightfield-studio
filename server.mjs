import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '1.0.0';
export const ROOT = dirname(fileURLToPath(import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.glb':'model/gltf-binary', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8' };

export function createStudioServer({ directory = resolve(ROOT, 'dist') } = {}) {
  const root = resolve(directory);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow:'GET, HEAD' }); return res.end();
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/health.json') {
        const body = JSON.stringify({ app:'lightfield-studio', version:VERSION, offline:true });
        res.writeHead(200, { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) });
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      if (pathname.includes('\0')) { res.writeHead(400); return res.end('Bad request'); }
      const target = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const rel = relative(root, target);
      if (rel.startsWith('..') || isAbsolute(rel)) { res.writeHead(403); return res.end('Forbidden'); }
      const data = await readFile(target);
      res.writeHead(200, { 'Content-Type':types[extname(target)] || 'application/octet-stream', 'Content-Length':data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      res.writeHead(error instanceof URIError ? 400 : 404); res.end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requested = process.argv[process.argv.indexOf('--port') + 1];
  const port = process.argv.includes('--port') ? Number(requested) : 4173;
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('Invalid port'); process.exit(1); }
  const server = createStudioServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`LIGHTFIELD ${VERSION}: http://127.0.0.1:${port}`));
}
