'use strict';
// Các API của THINK & MATCH. Mọi thao tác quản trị đều kiểm tra đăng nhập và quyền ở đây.
const crypto = require('crypto');
const E = require('./engine');
const { getBackend, AuthError } = require('./backend');

const NOCHANGE = Symbol('nochange');
const bad = (vi, en, status) => { throw new E.GameError(vi, en, status); };

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8') || '{}'); } catch (e) { return {}; } }
    return req.body;
  }
  return new Promise((resolve) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 2e6) { req.destroy(); resolve({}); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function fail(res, e) {
  if (e instanceof E.GameError || e instanceof AuthError) return send(res, e.status, { error: e.vi, error_en: e.en });
  if (e && e.needsSetup) return send(res, 503, { error: 'Chưa khởi tạo cơ sở dữ liệu Supabase.', error_en: 'The Supabase database is not set up yet.', needsSetup: true });
  console.error(e);
  return send(res, (e && e.status) || 500, { error: 'Lỗi máy chủ: ' + ((e && e.message) || e), error_en: 'Server error: ' + ((e && e.message) || e) });
}
function handler(fn) {
  return async (req, res) => {
    try {
      const B = getBackend();
      if (!B.configured) return send(res, 503, { error: 'Chưa kết nối Supabase cho trang web (thiếu biến môi trường trên Vercel).', error_en: 'Supabase is not connected (missing environment variables on Vercel).', notConfigured: true });
      if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      const body = req.method === 'POST' ? await readBody(req) : {};
      await fn(req, res, body, B);
    } catch (e) { fail(res, e); }
  };
}

/* ================= state commit with optimistic locking ================= */
async function mutate(B, fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await B.loadState();
    const fresh = !row.data || !row.data.settings;
    const base = E.ensure(row.data);
    const now = Date.now();
    const adv = E.advance(base, now);
    let st = base, out, err = null;
    if (fn) {
      const work = E.clone(base); work.version = row.version;
      try { out = fn(work, now); } catch (e) { if (e instanceof E.GameError) err = e; else throw e; }
      if (!err) st = work;
    }
    const changed = fresh || adv || (fn && !err && out !== NOCHANGE);
    if (!changed) { if (err) throw err; return { st, version: row.version, now, out, pub: E.project(st, now, row.version) }; }
    const record = !!st._record;
    const pub = E.project(st, now, row.version + 1);
    const v = await B.commit(row.version, E.cleanForSave(st), pub);
    if (v < 0) { await new Promise(r => setTimeout(r, 20 + Math.random() * 60)); continue; }
    if (record) { try { await B.insertMatch(E.matchRecord(st, now)); } catch (e) { console.error('insertMatch', e); } }
    if (err) throw err;
    return { st, version: v, now, out, pub };
  }
  bad('Máy chủ đang bận, hãy thử lại.', 'The server is busy, please try again.', 503);
}

/* ================= auth ================= */
const authCache = new Map();
async function authorize(req, B, roles) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(h) ? /^Bearer\s+(.+)$/i.exec(h)[1].trim() : '';
  if (!token) throw new AuthError('Cần đăng nhập để dùng trang quản trị.', 'Please sign in to use the host page.');
  let hit = authCache.get(token);
  if (!hit || hit.exp < Date.now()) {
    const user = await B.getUser(token);
    if (!user) { authCache.delete(token); throw new AuthError('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'Your session has expired. Please sign in again.'); }
    const staff = await B.getStaff(user.id);
    hit = { user, role: staff ? staff.role : null, exp: Date.now() + 30000 };
    authCache.set(token, hit);
    if (authCache.size > 500) authCache.clear();
  }
  if (!hit.role) throw new AuthError('Tài khoản này chưa được cấp quyền MC hoặc Admin.', 'This account has no host or admin role.', 403);
  if (roles && !roles.includes(hit.role)) throw new AuthError('Chỉ Admin được làm thao tác này.', 'Only an admin can do this.', 403);
  return { ...hit, token };
}

/* ================= demo question bank ================= */
function demoBank() {
  const out = [], now = new Date().toISOString();
  const add = (grp, i, q_vi, q_en, a, num, unit) => out.push({ id: { main: 'M', backup: 'B', tie: 'T', est: 'E' }[grp] + String(i + 1).padStart(2, '0'), grp, q_vi, q_en, a_vi: a || '', a_en: a || '', num: num || '', unit: unit || '', enabled: true, sort: i + 1, updated_at: now });
  for (let i = 0; i < 24; i++) { const a = (i * 7 + 12) % 40 + 6, b = (i * 5 + 9) % 25 + 4; add('main', i, '[Demo] ' + a + ' + ' + b + ' = ?', '[Demo] ' + a + ' + ' + b + ' = ?', String(a + b)); }
  for (let i = 0; i < 6; i++) { const a = i + 6, b = i + 3; add('backup', i, '[Demo] ' + a + ' × ' + b + ' = ?', '[Demo] ' + a + ' × ' + b + ' = ?', String(a * b)); }
  for (let i = 0; i < 5; i++) { const a = 50 + i * 13, b = 17 + i * 4; add('tie', i, '[Demo] ' + a + ' − ' + b + ' = ?', '[Demo] ' + a + ' − ' + b + ' = ?', String(a - b)); }
  [['[Demo] 37 × 23 ≈ ?', '851'], ['[Demo] 1234 + 5678 ≈ ?', '6912'], ['[Demo] 999 ÷ 7 ≈ ?', '142.7']].forEach(([q, n], i) => add('est', i, q, q, '', n, ''));
  return out;
}
const GRPS = ['main', 'backup', 'tie', 'est'];
const PREFIX = { main: 'M', backup: 'B', tie: 'T', est: 'E' };
function s(v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : (typeof v === 'number' ? String(v).slice(0, max) : ''); }
function cleanQ(q, existingIds) {
  if (!q || typeof q !== 'object') bad('Dữ liệu câu hỏi không hợp lệ.', 'Invalid question data.');
  const grp = GRPS.includes(q.grp) ? q.grp : null;
  if (!grp) bad('Nhóm câu hỏi không hợp lệ.', 'Invalid question group.');
  let id = typeof q.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(q.id) ? q.id : '';
  if (!id) { do { id = PREFIX[grp] + crypto.randomBytes(3).toString('hex').toUpperCase(); } while (existingIds && existingIds.has(id)); }
  const o = { id, grp, q_vi: s(q.q_vi, 600), q_en: s(q.q_en, 600), a_vi: grp === 'est' ? '' : s(q.a_vi, 300), a_en: grp === 'est' ? '' : s(q.a_en, 300), num: grp === 'est' ? s(q.num, 30) : '', unit: grp === 'est' ? s(q.unit, 20) : '', enabled: q.enabled !== false, sort: Math.max(0, Math.min(100000, Math.round(Number(q.sort) || 0))), updated_at: new Date().toISOString() };
  if (!o.q_vi && !o.q_en) bad('Câu hỏi cần có nội dung (Tiếng Việt hoặc English).', 'A question needs text (Vietnamese or English).');
  if (grp === 'est' && isNaN(E.parseNum(o.num))) bad('Câu ước lượng cần đáp án chuẩn dạng số.', 'An estimation question needs a numeric answer.');
  return o;
}

/* ================= endpoints ================= */
const state = handler(async (req, res, body, B) => {
  if (req.method === 'GET') {
    let row = await B.loadPublic();
    if (!row.data || row.data.v == null) { const r = await mutate(B, null); return send(res, 200, Object.assign({}, r.pub, { now: Date.now() })); }
    return send(res, 200, Object.assign({}, row.data, { now: Date.now() }));
  }
  // tick: chỉ xử lý các mốc thời gian đã tới hạn, không cần đăng nhập
  const r = await mutate(B, null);
  send(res, 200, Object.assign({}, r.pub, { now: Date.now() }));
});

const config = handler(async (req, res, body, B) => {
  send(res, 200, { realtime: B.realtime, backend: B.kind });
});

const auth = handler(async (req, res, body, B) => {
  const op = body.op;
  if (op === 'status') {
    let needsSetup = false, hasAdmin = false;
    try { await B.loadState(); const staff = await B.listStaff(); hasAdmin = staff.some(x => x.role === 'admin'); }
    catch (e) { if (e.needsSetup) needsSetup = true; else throw e; }
    return send(res, 200, { needsSetup, hasAdmin, backend: B.kind });
  }
  if (op === 'login') {
    const email = s(body.email, 200).toLowerCase(), password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) bad('Hãy nhập email và mật khẩu.', 'Enter your email and password.');
    const sess = await B.login(email, password);
    const staff = await B.getStaff(sess.user.id);
    if (!staff) throw new AuthError('Tài khoản này chưa được cấp quyền MC hoặc Admin.', 'This account has no host or admin role.', 403);
    return send(res, 200, { session: sess, role: staff.role });
  }
  if (op === 'refresh') {
    const sess = await B.refresh(s(body.refresh_token, 500));
    const staff = await B.getStaff(sess.user.id);
    if (!staff) throw new AuthError('Tài khoản này không còn quyền truy cập.', 'This account no longer has access.', 403);
    return send(res, 200, { session: sess, role: staff.role });
  }
  if (op === 'logout') {
    const h = req.headers.authorization || ''; const m = /^Bearer\s+(.+)$/i.exec(h);
    if (m) { authCache.delete(m[1]); await B.logout(m[1]); }
    return send(res, 200, { ok: true });
  }
  if (op === 'setup') {
    const staff = await B.listStaff();
    if (staff.some(x => x.role === 'admin')) bad('Đã có tài khoản Admin. Hãy đăng nhập.', 'An admin account already exists. Please sign in.', 403);
    const meta = await B.getMeta('setup');
    const code = s(body.code, 40).toUpperCase(), want = meta && String(meta.code || '').toUpperCase();
    const ok = want && code.length === want.length && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(want));
    if (!ok) bad('Mã khởi tạo không đúng.', 'Wrong setup code.', 403);
    const email = s(body.email, 200).toLowerCase(), password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad('Email không hợp lệ.', 'Invalid email.');
    if (password.length < 8) bad('Mật khẩu cần ít nhất 8 ký tự.', 'The password needs at least 8 characters.');
    const u = await B.createUser(email, password);
    await B.addStaff({ user_id: u.id, email, role: 'admin' });
    await B.delMeta('setup');
    const qs = await B.listQuestions(); if (!qs.length) await B.upsertQuestions(demoBank());
    await mutate(B, null);
    const sess = await B.login(email, password);
    return send(res, 200, { session: sess, role: 'admin' });
  }
  bad('Thao tác không hợp lệ.', 'Invalid operation.');
});

function syncClockTotals(st, now) {
  // giá trị mới áp dụng cho đồng hồ chưa chạy (giống bản offline)
  const T = E.totals(st.settings), g = st.game;
  ['main', 'ans', 'flip', 'hold', 'tie'].forEach(n => { const c = g.clocks[n]; if (c && !c.running && c.remain === c.total) { c.total = c.remain = T[n]; c.at = now; } });
  if (g.prac) ['ans', 'flip', 'hold'].forEach(n => { const c = g.prac.clocks[n]; if (c && !c.running && c.remain === c.total) { c.total = c.remain = T[n]; c.at = now; } });
}
async function deviceSeen(B) { try { const m = await B.getMeta('device_seen'); return m && m.at || 0; } catch (e) { return 0; } }
async function adminOut(B, r) { return { pub: Object.assign({}, r.pub, { now: Date.now() }), priv: Object.assign(E.privView(r.st), { deviceSeen: await deviceSeen(B) }), now: Date.now() }; }

const action = handler(async (req, res, body, B) => {
  await authorize(req, B, ['admin', 'mc']);
  const a = body && typeof body === 'object' ? body : {};
  if (a.type === 'pairCode') {
    const r = await mutate(B, (st, now) => E.pairCode(st, now));
    return send(res, 200, Object.assign(await adminOut(B, r), { code: r.out }));
  }
  if (a.type === 'unpair') {
    const r = await mutate(B, st => { st.device.tokenHash = null; st.device.code = null; });
    await B.delMeta('device_seen').catch(() => {});
    return send(res, 200, await adminOut(B, r));
  }
  const bank = a.type === 'newMatch' ? await B.listQuestions() : null;
  const r = await mutate(B, (st, now) => { E.apply(st, a, now, { bank }); });
  send(res, 200, await adminOut(B, r));
});

const admin = handler(async (req, res, body, B) => {
  const op = body.op;
  const who = await authorize(req, B, ['admin', 'mc']);
  const isAdmin = who.role === 'admin';
  const needAdmin = () => { if (!isAdmin) throw new AuthError('Chỉ Admin được làm thao tác này.', 'Only an admin can do this.', 403); };
  switch (op) {
    case 'me': return send(res, 200, { user: who.user, role: who.role });
    case 'state': { const r = await mutate(B, null); return send(res, 200, Object.assign(await adminOut(B, r), { role: who.role, user: who.user })); }
    case 'settings': {
      const r = await mutate(B, (st, now) => { st.settings = E.mergeSettings(st.settings, body.settings || {}); syncClockTotals(st, now); });
      return send(res, 200, await adminOut(B, r));
    }
    case 'uploadUrl': {
      const kind = body.kind === 'audio' ? 'audio' : 'image';
      const ext = String(body.ext || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const okExt = kind === 'audio' ? ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm'] : ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      if (!okExt.includes(ext)) bad('Định dạng tệp không được hỗ trợ.', 'This file type is not supported.');
      const p = kind + '/' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + '.' + ext;
      return send(res, 200, await B.signUpload(p, body.contentType));
    }
    case 'preflight': { const r = await mutate(B, null); return send(res, 200, E.preflight(r.st.settings, await B.listQuestions())); }
    case 'q.list': return send(res, 200, { questions: await B.listQuestions(), canEdit: isAdmin });
    case 'q.save': {
      needAdmin();
      const all = await B.listQuestions(); const ids = new Set(all.map(q => q.id));
      const q = body.q || {}; const isNew = !q.id || !ids.has(q.id);
      const row = cleanQ(isNew ? Object.assign({}, q, { id: '' }) : q, ids);
      if (isNew && !Number(q.sort)) row.sort = all.filter(x => x.grp === row.grp).reduce((m, x) => Math.max(m, x.sort || 0), 0) + 1;
      await B.upsertQuestions([row]);
      return send(res, 200, { question: row, questions: await B.listQuestions() });
    }
    case 'q.toggle': {
      needAdmin();
      const all = await B.listQuestions(); const q = all.find(x => x.id === body.id); if (!q) bad('Không tìm thấy câu hỏi.', 'Question not found.', 404);
      q.enabled = !!body.enabled; q.updated_at = new Date().toISOString(); await B.upsertQuestions([q]);
      return send(res, 200, { questions: await B.listQuestions() });
    }
    case 'q.delete': {
      needAdmin();
      if (typeof body.id !== 'string') bad('Thiếu mã câu hỏi.', 'Missing question id.');
      await B.deleteQuestion(body.id);
      return send(res, 200, { questions: await B.listQuestions() });
    }
    case 'q.import': {
      needAdmin();
      const items = Array.isArray(body.items) ? body.items : null;
      if (!items || !items.length) bad('Tệp không có câu hỏi nào.', 'The file has no questions.');
      if (items.length > 1000) bad('Tệp có quá nhiều câu hỏi (tối đa 1000).', 'Too many questions (max 1000).');
      const seen = new Set(); const rows = items.map((q, i) => {
        try { const r = cleanQ(q, null); if (seen.has(r.id)) bad('trùng mã ' + r.id, 'duplicate id ' + r.id); seen.add(r.id); return r; }
        catch (e) { if (e instanceof E.GameError) bad('Câu số ' + (i + 1) + ' không hợp lệ: ' + e.vi, 'Item ' + (i + 1) + ' is invalid: ' + e.en); throw e; }
      });
      if (body.mode === 'replace') await B.replaceQuestions(rows); else await B.upsertQuestions(rows);
      return send(res, 200, { imported: rows.length, questions: await B.listQuestions() });
    }
    case 'staff.list': needAdmin(); return send(res, 200, { staff: await B.listStaff(), me: who.user.id });
    case 'staff.add': {
      needAdmin();
      const email = s(body.email, 200).toLowerCase(), password = typeof body.password === 'string' ? body.password : '';
      const role = body.role === 'admin' ? 'admin' : 'mc';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad('Email không hợp lệ.', 'Invalid email.');
      if (password.length < 8) bad('Mật khẩu cần ít nhất 8 ký tự.', 'The password needs at least 8 characters.');
      const u = await B.createUser(email, password);
      await B.addStaff({ user_id: u.id, email, role }); authCache.clear();
      return send(res, 200, { staff: await B.listStaff(), me: who.user.id });
    }
    case 'staff.remove': {
      needAdmin();
      if (body.user_id === who.user.id) bad('Không thể tự xóa quyền của chính mình.', 'You cannot remove your own access.');
      await B.removeStaff(String(body.user_id || '')); authCache.clear();
      return send(res, 200, { staff: await B.listStaff(), me: who.user.id });
    }
    case 'matches': return send(res, 200, { matches: await B.listMatches(30) });
  }
  bad('Thao tác không hợp lệ.', 'Invalid operation.');
});

const device = handler(async (req, res, body, B) => {
  const op = body.op;
  if (op === 'pair') {
    const r = await mutate(B, (st, now) => E.pairDevice(st, body.code, now));
    if (!r.out || !r.out.ok) bad(r.out.err[0], r.out.err[1], 403);
    await B.setMeta('device_seen', { at: Date.now() }).catch(() => {});
    return send(res, 200, { token: r.out.token, pub: Object.assign({}, r.pub, { now: Date.now() }) });
  }
  if (op === 'pick') {
    const r = await mutate(B, (st, now) => {
      if (!E.deviceOk(st, body.token)) bad('Màn hình này chưa được ghép nối hoặc đã bị thay bằng màn hình khác.', 'This screen is not paired or was replaced by another screen.', 403);
      if (st.settings.pickMode !== 'interactive') bad('Đang ở chế độ trình chiếu: MC chọn ô trên trang quản trị.', 'Presentation mode: the host picks tiles.', 403);
      if (body.v !== st.version) bad('Màn hình chưa đồng bộ trạng thái mới nhất. Hãy thử lại.', 'This screen is out of sync. Try again.', 409);
      E.pick(st, body.i, now);
    });
    return send(res, 200, { pub: Object.assign({}, r.pub, { now: Date.now() }) });
  }
  if (op === 'ping') {
    const row = await B.loadState(); const st = E.ensure(row.data);
    const ok = E.deviceOk(st, body.token);
    if (ok) await B.setMeta('device_seen', { at: Date.now() }).catch(() => {});
    return send(res, 200, { paired: ok });
  }
  bad('Thao tác không hợp lệ.', 'Invalid operation.');
});

module.exports = { state, config, auth, action, admin, device, _mutate: mutate, demoBank };
