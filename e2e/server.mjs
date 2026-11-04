// Serves the static build the way Apache on the shared host does, so the
// end-to-end tests see the same behaviour as production:
// - "/impressum" redirects with 301 to "/impressum/" (mod_dir DirectorySlash)
// - "/impressum/" serves "impressum/index.html"
// - unknown paths get status 404 with the prerendered "404/index.html"
// - text responses are gzip-compressed when the client accepts it (mod_deflate)
// No dependencies on purpose: node:http is enough for a test server.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createGzip } from 'node:zlib';

const root = resolve(process.argv[2] ?? 'dist/philippklinger/browser');
const port = Number(process.env.PORT ?? 4300);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No build found in ${root}. Run "npm run build" first.`);
  process.exit(1);
}

const compressible = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg']);

function send(req, res, status, file) {
  const headers = { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' };
  const compress = compressible.has(extname(file));
  const gzip = compress && /gzip/.test(req.headers['accept-encoding'] ?? '');
  if (compress) headers['Vary'] = 'Accept-Encoding';
  if (gzip) headers['Content-Encoding'] = 'gzip';
  res.writeHead(status, headers);
  const stream = createReadStream(file);
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = '/';
  }
  const file = normalize(join(root, pathname));

  // Never serve anything outside the build folder.
  if (file !== root && !file.startsWith(root + sep)) {
    return send(req, res, 404, join(root, '404', 'index.html'));
  }

  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` });
      return res.end();
    }
    const index = join(file, 'index.html');
    if (existsSync(index)) return send(req, res, 200, index);
  } else if (existsSync(file)) {
    return send(req, res, 200, file);
  }

  return send(req, res, 404, join(root, '404', 'index.html'));
}).listen(port, () => {
  console.log(`Static build on http://localhost:${port} (${root})`);
});
