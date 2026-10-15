// Local dev server: serves the site AND runs the real API (MongoDB). Usage: npm run dev  ->  http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path');
try { for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
if (!process.env.MONGODB_URI) console.warn('! MONGODB_URI is not set (create .env.local) - the API will return errors');
const api = require('./api/[...slug].js');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  if (p.startsWith('/api/')) {
    let b = ''; q.on('data', c => b += c);
    q.on('end', () => {
      try { q.body = b ? JSON.parse(b) : {}; } catch { q.body = {}; }
      r.status = s => { r.statusCode = s; return r; };
      r.json = v => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(v)); };
      api(q, r);
    });
    return;
  }
  const f = path.join(__dirname, p === '/' ? 'index.html' : p);
  if (!f.startsWith(__dirname) || /(^|[\\/])(\.|node_modules)/.test(path.relative(__dirname, f)) || p.startsWith('/api')) { r.statusCode = 404; return r.end('Not found'); }
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('Not found'); } r.setHeader('content-type', T[path.extname(f)] || 'application/octet-stream'); r.end(d); });
}).listen(process.env.PORT || 3000, () => console.log('Hangout OS running at http://localhost:' + (process.env.PORT || 3000)));
