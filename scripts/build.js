// Sao chép public/ sang dist/ và kiểm tra các tệp bắt buộc. Thư mục api/ được Vercel triển khai thành hàm máy chủ.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

const errors = [];
const need = ['index.html', 'admin.html', 'setup.sql', 'js/common.js', 'js/player.js', 'js/admin.js', 'css/tm.css', 'css/player.css', 'css/admin.css', 'assets/logo.png', 'assets/bg.jpg'];
for (let i = 1; i <= 15; i++) need.push('assets/shoes/' + String(i).padStart(2, '0') + '.jpg');
need.forEach(f => { if (!fs.existsSync(path.join(out, f))) errors.push('Thiếu tệp: ' + f); });
['state', 'config', 'auth', 'action', 'admin', 'device'].forEach(n => { if (!fs.existsSync(path.join(root, 'api', n + '.js'))) errors.push('Thiếu API: api/' + n + '.js'); });
// Trang người chơi không được chứa đáp án hay khóa bí mật
const player = fs.readFileSync(path.join(out, 'js/player.js'), 'utf8') + fs.readFileSync(path.join(out, 'index.html'), 'utf8');
if (/service_role|SUPABASE_SERVICE|SECRET_KEY/i.test(player)) errors.push('Trang người chơi chứa từ khóa bí mật');
const sqlA = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8'), sqlB = fs.readFileSync(path.join(out, 'setup.sql'), 'utf8');
if (sqlA !== sqlB) errors.push('public/setup.sql khác supabase/schema.sql: hãy sao chép lại');
// Kiểm tra cú pháp các tệp JavaScript
const { execFileSync } = require('child_process');
['lib/engine.js', 'lib/backend.js', 'lib/api.js'].map(f => path.join(root, f)).concat(['js/common.js', 'js/player.js', 'js/admin.js'].map(f => path.join(out, f))).forEach(f => {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { errors.push('Lỗi cú pháp: ' + f + '\n' + e.stderr); }
});

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log('Build OK: ' + count(out) + ' tệp trong dist/');
