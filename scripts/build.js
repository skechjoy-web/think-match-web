// Sao chép public/ sang dist/ và kiểm tra các tệp mà service worker cần lưu offline.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

const errors = [];
const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
const m = sw.match(/const FILES=(\[[^\]]*\])/);
if (!m) errors.push('Không tìm thấy danh sách FILES trong sw.js');
else for (const f of JSON.parse(m[1])) {
  if (f !== './' && !fs.existsSync(path.join(out, f))) errors.push('Thiếu tệp: ' + f);
}
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
if (/<(script|link)[^>]+(src|href)="https?:/i.test(html)) errors.push('index.html đang tải tài nguyên từ bên ngoài');

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log('Build OK: ' + count(out) + ' tệp trong dist/');
