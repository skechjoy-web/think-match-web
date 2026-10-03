// Chạy thử trên máy: node scripts/dev.js  (mặc định dùng bộ nhớ cục bộ, không cần Supabase)
// Biến môi trường: PORT (mặc định 3000), TM_DEV_DB (tệp lưu dữ liệu), TM_SETUP_CODE (mã khởi tạo Admin).
'use strict';
if (!process.env.TM_BACKEND && !process.env.SUPABASE_URL) process.env.TM_BACKEND = 'memory';
const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('../lib/api');

const root = path.join(__dirname, '..', 'public');
const upDir = path.join(process.env.TM_DEV_UPLOADS || path.join(require('os').tmpdir(), 'tm-dev-uploads'));
fs.mkdirSync(upDir, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.sql': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(file).pipe(res);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  const m = /^\/api\/(state|config|auth|action|admin|device)$/.exec(p);
  if (m) return api[m[1]](req, res);
  if (p.startsWith('/dev-upload/') && req.method === 'PUT') {
    const rel = p.slice('/dev-upload/'.length).replace(/\.\./g, '');
    const out = path.join(upDir, rel); fs.mkdirSync(path.dirname(out), { recursive: true });
    const ws = fs.createWriteStream(out); req.pipe(ws); ws.on('finish', () => { res.statusCode = 200; res.end('{}'); }); return;
  }
  if (p.startsWith('/dev-uploads/')) return serveFile(res, path.join(upDir, p.slice('/dev-uploads/'.length).replace(/\.\./g, '')));
  if (p === '/admin' || p === '/admin/') p = '/admin.html';
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  serveFile(res, file);
});
const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log('THINK & MATCH dev: http://localhost:' + port + '  (MC: /admin)  backend=' + (process.env.TM_BACKEND || 'supabase') + (process.env.TM_BACKEND === 'memory' ? '  setup code=' + (process.env.TM_SETUP_CODE || 'DEV12345') : '')));
