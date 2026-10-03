'use strict';
// Lớp lưu trữ: Supabase (khi chạy trên Vercel) hoặc bộ nhớ cục bộ (khi chạy thử trên máy).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class NeedsSetup extends Error { constructor(msg) { super(msg || 'needs_setup'); this.needsSetup = true; } }
class AuthError extends Error { constructor(vi, en, status) { super(vi); this.vi = vi; this.en = en || vi; this.status = status || 401; } }

// Tên biến môi trường do Vercel tạo có thể có tiền tố (ví dụ STORAGE_SUPABASE_URL).
function env(...names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  const keys = Object.keys(process.env);
  for (const n of names) { const k = keys.find(k => k.endsWith('_' + n) && process.env[k]); if (k) return process.env[k]; }
  return '';
}

/* ================= Supabase ================= */
function supabaseBackend() {
  const URL = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
  const ANON = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const BUCKET = 'tm-assets';
  const isJwt = k => /^eyJ/.test(k || '');
  const svcHeaders = (extra) => Object.assign({ apikey: SERVICE }, isJwt(SERVICE) ? { Authorization: 'Bearer ' + SERVICE } : {}, extra || {});

  async function call(method, url, { headers, body, raw } = {}) {
    const r = await fetch(url, { method, headers: Object.assign({}, headers, body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    return { ok: r.ok, status: r.status, data };
  }
  function missingTable(res) {
    const code = res.data && (res.data.code || res.data.error_code);
    return res.status === 404 || code === 'PGRST205' || code === '42P01' || code === 'PGRST202' || (typeof res.data === 'object' && res.data && /does not exist|schema cache/i.test(res.data.message || ''));
  }
  async function rest(method, p, body, prefer) {
    const res = await call(method, URL + '/rest/v1/' + p, { headers: svcHeaders(prefer ? { Prefer: prefer } : {}), body });
    if (!res.ok) {
      if (missingTable(res)) throw new NeedsSetup();
      const e = new Error('Supabase ' + method + ' ' + p.split('?')[0] + ' ' + res.status + ': ' + JSON.stringify(res.data)); e.status = 502; throw e;
    }
    return res.data;
  }
  const enc = encodeURIComponent;

  return {
    kind: 'supabase',
    configured: !!(URL && SERVICE),
    realtime: URL && ANON ? { url: URL, anonKey: ANON } : null,
    async loadState() { const rows = await rest('GET', 'tm_state?id=eq.1&select=version,data'); if (!rows || !rows.length) throw new NeedsSetup(); return rows[0]; },
    async commit(version, data, pub) { const v = await rest('POST', 'rpc/tm_commit', { p_version: version, p_data: data, p_pub: pub }); return Number(v); },
    async loadPublic() { const rows = await rest('GET', 'tm_public?id=eq.1&select=version,data'); if (!rows || !rows.length) throw new NeedsSetup(); return rows[0]; },
    async listQuestions() { return rest('GET', 'tm_questions?select=*&order=grp.asc,sort.asc,id.asc'); },
    async upsertQuestions(list) { if (!list.length) return []; return rest('POST', 'tm_questions?on_conflict=id', list, 'resolution=merge-duplicates,return=representation'); },
    async deleteQuestion(id) { await rest('DELETE', 'tm_questions?id=eq.' + enc(id)); },
    async replaceQuestions(list) { await rest('DELETE', 'tm_questions?id=not.is.null'); if (list.length) await rest('POST', 'tm_questions', list, 'return=minimal'); },
    async listStaff() { return rest('GET', 'tm_staff?select=*&order=created_at.asc'); },
    async getStaff(userId) { const r = await rest('GET', 'tm_staff?select=*&user_id=eq.' + enc(userId)); return r && r[0] || null; },
    async addStaff(row) { await rest('POST', 'tm_staff?on_conflict=user_id', row, 'resolution=merge-duplicates,return=minimal'); },
    async removeStaff(userId) { await rest('DELETE', 'tm_staff?user_id=eq.' + enc(userId)); },
    async insertMatch(data) { await rest('POST', 'tm_matches', { data }, 'return=minimal'); },
    async listMatches(limit) { return rest('GET', 'tm_matches?select=id,finished_at,data&order=id.desc&limit=' + (limit || 30)); },
    async getMeta(key) { const r = await rest('GET', 'tm_meta?select=data,updated_at&key=eq.' + enc(key)); return r && r[0] ? r[0].data : null; },
    async setMeta(key, data) { await rest('POST', 'tm_meta?on_conflict=key', { key, data, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal'); },
    async delMeta(key) { await rest('DELETE', 'tm_meta?key=eq.' + enc(key)); },

    async login(email, password) {
      const r = await call('POST', URL + '/auth/v1/token?grant_type=password', { headers: { apikey: ANON || SERVICE }, body: { email, password } });
      if (!r.ok) throw new AuthError('Email hoặc mật khẩu không đúng.', 'Wrong email or password.');
      return { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_at: r.data.expires_at || Math.floor(Date.now() / 1000) + (r.data.expires_in || 3600), user: { id: r.data.user.id, email: r.data.user.email } };
    },
    async refresh(token) {
      const r = await call('POST', URL + '/auth/v1/token?grant_type=refresh_token', { headers: { apikey: ANON || SERVICE }, body: { refresh_token: token } });
      if (!r.ok) throw new AuthError('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'Your session has expired. Please sign in again.');
      return { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_at: r.data.expires_at || Math.floor(Date.now() / 1000) + (r.data.expires_in || 3600), user: { id: r.data.user.id, email: r.data.user.email } };
    },
    async getUser(accessToken) {
      const r = await call('GET', URL + '/auth/v1/user', { headers: { apikey: ANON || SERVICE, Authorization: 'Bearer ' + accessToken } });
      if (!r.ok || !r.data || !r.data.id) return null; return { id: r.data.id, email: r.data.email };
    },
    async logout(accessToken) { await call('POST', URL + '/auth/v1/logout', { headers: { apikey: ANON || SERVICE, Authorization: 'Bearer ' + accessToken } }).catch(() => {}); },
    async createUser(email, password) {
      const r = await call('POST', URL + '/auth/v1/admin/users', { headers: svcHeaders(), body: { email, password, email_confirm: true } });
      if (r.ok) return { id: r.data.id, email: r.data.email, created: true };
      // tài khoản đã có: tìm theo email rồi đặt mật khẩu mới
      const list = await call('GET', URL + '/auth/v1/admin/users?page=1&per_page=1000', { headers: svcHeaders() });
      const users = (list.data && (list.data.users || list.data)) || [];
      const u = Array.isArray(users) ? users.find(x => (x.email || '').toLowerCase() === email.toLowerCase()) : null;
      if (!u) throw new AuthError('Không tạo được tài khoản: ' + ((r.data && (r.data.msg || r.data.message)) || r.status), 'Could not create the account: ' + ((r.data && (r.data.msg || r.data.message)) || r.status), 400);
      const up = await call('PUT', URL + '/auth/v1/admin/users/' + u.id, { headers: svcHeaders(), body: { password, email_confirm: true } });
      if (!up.ok) throw new AuthError('Không đặt được mật khẩu cho tài khoản đã có.', 'Could not set the password for the existing account.', 400);
      return { id: u.id, email: u.email, created: false };
    },
    async signUpload(objPath) {
      const r = await call('POST', URL + '/storage/v1/object/upload/sign/' + BUCKET + '/' + objPath, { headers: svcHeaders(), body: {} });
      if (!r.ok || !r.data || !r.data.url) { const e = new Error('Không tạo được đường dẫn tải lên: ' + r.status + ' ' + JSON.stringify(r.data)); e.status = 502; throw e; }
      return { uploadUrl: URL + '/storage/v1' + r.data.url, method: 'PUT', form: true, publicUrl: URL + '/storage/v1/object/public/' + BUCKET + '/' + objPath };
    },
  };
}

/* ================= bộ nhớ cục bộ (chạy thử) ================= */
function memoryBackend() {
  const file = process.env.TM_DEV_DB || '';
  let db = { state: { version: 0, data: {} }, pub: { version: 0, data: {} }, questions: [], staff: [], matches: [], meta: {}, users: [] };
  if (file && fs.existsSync(file)) { try { db = Object.assign(db, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { /* tệp hỏng: bắt đầu lại */ } }
  if (!db.meta.setup && !db.staff.some(s => s.role === 'admin')) db.meta.setup = { code: process.env.TM_SETUP_CODE || 'DEV12345' };
  const tokens = new Map(), refresh = new Map();
  const save = () => { if (file) fs.writeFileSync(file, JSON.stringify(db)); };
  const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
  const c = o => JSON.parse(JSON.stringify(o));
  function issue(u) {
    const at = crypto.randomBytes(24).toString('hex'), rt = crypto.randomBytes(24).toString('hex');
    const ttl = Number(process.env.TM_DEV_TOKEN_TTL || 3600);
    tokens.set(at, { id: u.id, exp: Date.now() + ttl * 1000 }); refresh.set(rt, u.id);
    return { access_token: at, refresh_token: rt, expires_at: Math.floor(Date.now() / 1000) + ttl, user: { id: u.id, email: u.email } };
  }
  return {
    kind: 'memory', configured: true, realtime: null,
    async loadState() { return c(db.state); },
    async commit(version, data, pub) { if (db.state.version !== version) return -1; db.state = { version: version + 1, data: c(data) }; db.pub = { version: version + 1, data: c(pub) }; save(); return version + 1; },
    async loadPublic() { return c(db.pub); },
    async listQuestions() { return c(db.questions).sort((a, b) => a.grp.localeCompare(b.grp) || a.sort - b.sort || a.id.localeCompare(b.id)); },
    async upsertQuestions(list) { list.forEach(q => { const i = db.questions.findIndex(x => x.id === q.id); if (i >= 0) db.questions[i] = Object.assign(db.questions[i], q); else db.questions.push(c(q)); }); save(); return c(list); },
    async deleteQuestion(id) { db.questions = db.questions.filter(q => q.id !== id); save(); },
    async replaceQuestions(list) { db.questions = c(list); save(); },
    async listStaff() { return c(db.staff); },
    async getStaff(userId) { return c(db.staff.find(s => s.user_id === userId) || null); },
    async addStaff(row) { db.staff = db.staff.filter(s => s.user_id !== row.user_id); db.staff.push(Object.assign({ created_at: new Date().toISOString() }, row)); save(); },
    async removeStaff(userId) { db.staff = db.staff.filter(s => s.user_id !== userId); save(); },
    async insertMatch(data) { db.matches.unshift({ id: db.matches.length + 1, finished_at: new Date().toISOString(), data }); save(); },
    async listMatches(limit) { return c(db.matches.slice(0, limit || 30)); },
    async getMeta(key) { return db.meta[key] ? c(db.meta[key]) : null; },
    async setMeta(key, data) { db.meta[key] = c(data); save(); },
    async delMeta(key) { delete db.meta[key]; save(); },
    async login(email, password) {
      const u = db.users.find(x => x.email === String(email).toLowerCase());
      if (!u || hash(String(password), u.salt) !== u.hash) throw new AuthError('Email hoặc mật khẩu không đúng.', 'Wrong email or password.');
      return issue(u);
    },
    async refresh(token) { const id = refresh.get(token); const u = id && db.users.find(x => x.id === id); if (!u) throw new AuthError('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'Your session has expired. Please sign in again.'); refresh.delete(token); return issue(u); },
    async getUser(at) { const t = tokens.get(at); if (!t || t.exp < Date.now()) return null; const u = db.users.find(x => x.id === t.id); return u ? { id: u.id, email: u.email } : null; },
    async logout(at) { tokens.delete(at); },
    async createUser(email, password) {
      email = String(email).toLowerCase(); let u = db.users.find(x => x.email === email); const created = !u;
      if (!u) { u = { id: crypto.randomUUID(), email }; db.users.push(u); }
      u.salt = crypto.randomBytes(16).toString('hex'); u.hash = hash(String(password), u.salt); save();
      return { id: u.id, email, created };
    },
    async signUpload(objPath) { return { uploadUrl: '/dev-upload/' + objPath, method: 'PUT', form: false, publicUrl: '/dev-uploads/' + objPath }; },
  };
}

let cached = null;
function getBackend() {
  if (cached) return cached;
  if (process.env.TM_BACKEND === 'memory') cached = memoryBackend();
  else cached = supabaseBackend();
  return cached;
}
module.exports = { getBackend, NeedsSetup, AuthError, env, _reset: () => { cached = null; } };
void path;
