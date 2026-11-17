const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Cargar archivo .env local automáticamente si existe
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  });
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  });
  res.end(body);
}

function serveStaticFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      return fs.readFile(indexFile, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        res.end(content);
      });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Evitar que el navegador o el Service Worker sirvan CSS/JS antiguos en caché
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, must-revalidate'
    };

    const acceptEncoding = req.headers['accept-encoding'] || '';
    const rawStream = fs.createReadStream(filePath);

    if (acceptEncoding.includes('gzip') && ['.html', '.css', '.js', '.json', '.svg'].includes(ext)) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      rawStream.pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200, headers);
      rawStream.pipe(res);
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/healthz') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'LoVo Cierre Nocturno PWA',
      timestamp: new Date().toISOString()
    });
  }

  if (pathname === '/api/config') {
    return sendJson(res, 200, {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      WHATSAPP_PHONE: process.env.WHATSAPP_PHONE || '34678146956'
    });
  }

  const safeSuffix = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const targetPath = path.join(PUBLIC_DIR, safeSuffix === path.sep || safeSuffix === '.' ? 'index.html' : safeSuffix);

  serveStaticFile(req, res, targetPath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🍸 LoVo Cierre Nocturno PWA ejecutándose en puerto ${PORT}`);
  console.log(`🔗 URL Local: http://localhost:${PORT}`);
  console.log(
    `⚡ Supabase configurado: ${
      process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
        ? 'SÍ (Tiempo Real Activo)'
        : 'PENDIENTE (Modo Demo / Config UI)'
    }`
  );
  console.log(`====================================================`);
});
