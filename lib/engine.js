'use strict';
// Máy trạng thái trận THINK & MATCH, chạy trên server.
// Mọi thao tác của MC và màn hình cảm ứng đều đi qua đây; trình duyệt chỉ hiển thị.
const crypto = require('crypto');

const SHOW_MS = 900;      // chờ ô lật xong trước khi xử lý kết quả
const GLOW_MS = 2000;     // giữ cặp đúng phát sáng
const VANISH_MS = 1600;   // hai ô biến mất, lộ ảnh nền
const CLOSE_MS = 800;     // úp ô lại
const CLN = ['main', 'ans', 'flip', 'hold', 'tie'];
const LIM = { main: [1, 90], answer: [5, 300], flip: [5, 120], hold: [1, 30], tie: [0.5, 15] };

class GameError extends Error {
  constructor(vi, en, status) { super(vi); this.vi = vi; this.en = en || vi; this.status = status || 400; }
}
const bad = (vi, en, status) => { throw new GameError(vi, en, status); };

const rnd = n => crypto.randomInt(n);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');

/* ================= settings ================= */
function defaultSettings() {
  return {
    pname: 'THINK & MATCH', taglineVi: 'Lật ô chuẩn • Ghép giày nhanh', taglineEn: 'Think fast • Match smart', lang: 'vi',
    logoMode: 'default', logoUrl: '', bgUrl: '', revUrl: '', shoes: Array(15).fill(''),
    teams: [{ name: 'ĐỘI 1', color: '#3fb6ff' }, { name: 'ĐỘI 2', color: '#ff5d73' }],
    times: { main: 24, answer: 30, flip: 20, hold: 5, tie: 2 },
    mainShoes: [0, 1, 2, 3, 4, 5, 6, 7], tieShoes: [8, 9, 10],
    sfx: true, sfxVol: 0.8, musicUrl: '', musicName: '', musicVol: 0.5, musicLoop: true, fanfareUrl: '', fanfareName: '',
    motion: true, pickMode: 'present', shuffleQ: false,
  };
}
const URL_RE = /^(?:https:\/\/[^\s"'()<>\\]{1,800}|\/?(?:assets|dev-uploads)\/[\w.\/-]{1,200})$/;
function str(v, max, def) { if (typeof v !== 'string') return def; return v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }
function safeUrl(v) { v = typeof v === 'string' ? v.trim() : ''; return v && URL_RE.test(v) ? v : ''; }
function num(v, lo, hi, def) { v = Number(v); if (!Number.isFinite(v)) return def; return Math.min(hi, Math.max(lo, v)); }
function color(v, def) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def; }
function mergeSettings(prev, inp) {
  const S = Object.assign(defaultSettings(), clone(prev || {}));
  const o = inp || {};
  if ('pname' in o) S.pname = str(o.pname, 40, '') || 'THINK & MATCH';
  if ('taglineVi' in o) S.taglineVi = str(o.taglineVi, 70, '');
  if ('taglineEn' in o) S.taglineEn = str(o.taglineEn, 70, '');
  if ('lang' in o) S.lang = o.lang === 'en' ? 'en' : 'vi';
  if ('logoMode' in o) S.logoMode = ['default', 'custom', 'text'].includes(o.logoMode) ? o.logoMode : 'default';
  ['logoUrl', 'bgUrl', 'revUrl', 'musicUrl', 'fanfareUrl'].forEach(k => { if (k in o) S[k] = safeUrl(o[k]); });
  ['musicName', 'fanfareName'].forEach(k => { if (k in o) S[k] = str(o[k], 120, ''); });
  if (Array.isArray(o.shoes)) S.shoes = Array.from({ length: 15 }, (_, i) => safeUrl(o.shoes[i]));
  if (!Array.isArray(S.shoes) || S.shoes.length !== 15) S.shoes = Array(15).fill('');
  if (Array.isArray(o.teams)) S.teams = [0, 1].map(i => { const t = o.teams[i] || {}; const p = (S.teams && S.teams[i]) || defaultSettings().teams[i]; return { name: str(t.name, 24, '') || ('ĐỘI ' + (i + 1)), color: color(t.color, p.color) }; });
  if (!Array.isArray(S.teams) || S.teams.length !== 2) S.teams = defaultSettings().teams;
  S.times = Object.assign(defaultSettings().times, S.times || {});
  if (o.times && typeof o.times === 'object') Object.keys(LIM).forEach(k => { if (k in o.times) S.times[k] = num(o.times[k], LIM[k][0], LIM[k][1], S.times[k]); });
  if (Array.isArray(o.mainShoes) && o.mainShoes.length === 8) S.mainShoes = o.mainShoes.map((v, i) => Math.round(num(v, 0, 14, S.mainShoes[i])));
  if (Array.isArray(o.tieShoes) && o.tieShoes.length === 3) S.tieShoes = o.tieShoes.map((v, i) => Math.round(num(v, 0, 14, S.tieShoes[i])));
  ['sfx', 'musicLoop', 'motion', 'shuffleQ'].forEach(k => { if (k in o) S[k] = !!o[k]; });
  ['sfxVol', 'musicVol'].forEach(k => { if (k in o) S[k] = num(o[k], 0, 1, S[k]); });
  if ('pickMode' in o) S.pickMode = o.pickMode === 'interactive' ? 'interactive' : 'present';
  return S;
}
const shoeUrl = (S, slot) => (S.shoes && S.shoes[slot]) || ('assets/shoes/' + pad(slot + 1) + '.jpg');

/* ================= clocks ================= */
function totals(S) { const T = S.times; return { main: Math.round(T.main * 60000), ans: Math.round(T.answer * 1000), flip: Math.round(T.flip * 1000), hold: Math.round(T.hold * 1000), tie: Math.round(T.tie * 60000) }; }
const mkClock = total => ({ total, remain: total, running: false, at: 0 });
function eff(c, now) { return c.running ? Math.max(0, c.remain - (now - c.at)) : c.remain; }
function cStart(c, now) { if (!c.running && c.remain > 0) { c.running = true; c.at = now; } }
function cStop(c, now) { if (c.running) { c.remain = eff(c, now); c.running = false; c.at = now; } }
function cReset(c, total, run, now) { c.total = total; c.remain = total; c.running = !!run && total > 0; c.at = now; }

/* ================= game objects ================= */
const emptyQs = () => ({ m: [], b: [], t: [], e: [], x: [] });
function deck8() { const d = []; for (let p = 0; p < 8; p++) d.push(p, p); return shuffle(d); }
function freshMain(first, qs) {
  return {
    deck: deck8(), matched: Array(16).fill(false), scores: [0, 0], turn: first, first, started: false,
    phase: 'question', q: null, qOpen: false, ansOpen: false, verdict: null, result: null, res: null, picks: [], last: null, endReason: null,
    used: { m: qs.m.map(() => false), b: qs.b.map(() => false), x: qs.x.map(() => false) },
  };
}
function freshTie(qs) {
  return { deck: shuffle([0, 0, 1, 2]), started: false, q: null, qOpen: false, ansOpen: false, used: qs.t.map(() => false), answering: null, tried: [], wrongTeam: null, phase: 'question', picks: [], verdict: null, result: null, res: null, last: null };
}
function newGame(S, qs, first, created, evSeq) {
  const T = totals(S);
  const clocks = {}; CLN.forEach(n => { clocks[n] = mkClock(T[n]); });
  return {
    id: crypto.randomBytes(6).toString('hex'), created: !!created, view: created ? 'game' : 'welcome', stage: 'main',
    paused: false, frozen: null, qs, m: freshMain(first, qs), t: null, e: null, r: null, prac: null,
    clocks, due: null, ev: { seq: evSeq || 0, items: [] }, music: { playing: false }, createdAt: Date.now(),
  };
}
function ensure(data) {
  const st = data && typeof data === 'object' && data.settings ? data : { settings: defaultSettings() };
  st.settings = mergeSettings(st.settings, {});
  if (!st.game || !st.game.m) st.game = newGame(st.settings, emptyQs(), 0, false, 0);
  if (!st.device) st.device = { tokenHash: null, pairedAt: 0, code: null };
  return st;
}
function cleanForSave(st) { const o = clone(st); delete o.version; delete o._record; if (o.game) delete o.game._evNew; return o; }

function emit(g, type, at) {
  if (!g._evNew) { g.ev = { seq: ((g.ev && g.ev.seq) || 0) + 1, items: [] }; g._evNew = true; }
  g.ev.items.push({ type, at });
}
function setDue(g, kind, at) { g.due = { kind, at }; }
function isPaused(g) { return g.prac ? !!g.prac.paused : !!g.paused; }
function ctx(g) {
  if (g.prac) return { st: g.prac, kind: 'prac', clocks: g.prac.clocks };
  if (g.stage === 'main') return { st: g.m, kind: 'main', clocks: g.clocks };
  if (g.stage === 'tie' && g.t) return { st: g.t, kind: 'tie', clocks: g.clocks };
  return null;
}
const found = m => m.matched.filter(Boolean).length / 2;
const allMainUsed = m => m.used.m.every(Boolean);
const allQUsed = m => allMainUsed(m) && m.used.b.every(Boolean) && m.used.x.every(Boolean);
function qList(g, s) { return s === 'm' ? g.qs.m : s === 'b' ? g.qs.b : s === 'x' ? g.qs.x : s === 't' ? g.qs.t : null; }
function qGet(g, ref) { const l = ref && qList(g, ref.s); return l ? l[ref.i] || null : null; }

/* ================= pause ================= */
function pauseAll(g, now) {
  if (g.prac) {
    const p = g.prac; if (p.paused) return; const fr = { clocks: [], due: null };
    ['ans', 'flip', 'hold'].forEach(n => { const c = p.clocks[n]; if (c.running) { cStop(c, now); fr.clocks.push(n); } });
    if (p.due && p.due.at != null) { fr.due = Math.max(0, p.due.at - now); p.due.at = null; }
    p.paused = true; p.frozen = fr; return;
  }
  if (g.paused) return; const fr = { clocks: [], due: null };
  CLN.forEach(n => { const c = g.clocks[n]; if (c.running) { cStop(c, now); fr.clocks.push(n); } });
  if (g.due && g.due.at != null) { fr.due = Math.max(0, g.due.at - now); g.due.at = null; }
  g.paused = true; g.frozen = fr;
}
function resumeAll(g, now) {
  if (g.prac) {
    const p = g.prac; if (!p.paused) return; const fr = p.frozen || { clocks: [], due: null };
    fr.clocks.forEach(n => cStart(p.clocks[n], now)); if (p.due && fr.due != null) p.due.at = now + fr.due;
    p.paused = false; p.frozen = null; return;
  }
  if (!g.paused) return; const fr = g.frozen || { clocks: [], due: null };
  fr.clocks.forEach(n => cStart(g.clocks[n], now)); if (g.due && fr.due != null) g.due.at = now + fr.due;
  g.paused = false; g.frozen = null;
}

/* ================= time-driven transitions ================= */
function nextDue(g) {
  let t = null; const c2 = v => { if (t === null || v < t) t = v; };
  if (g.prac) {
    if (!g.prac.paused) { ['ans', 'flip', 'hold'].forEach(n => { const c = g.prac.clocks[n]; if (c.running) c2(c.at + c.remain); }); if (g.prac.due && g.prac.due.at != null) c2(g.prac.due.at); }
  } else if (!g.paused) {
    CLN.forEach(n => { const c = g.clocks[n]; if (c.running) c2(c.at + c.remain); });
    if (g.due && g.due.at != null) c2(g.due.at);
  }
  return t;
}
function advance(st, now) {
  const g = st.game; let changed = false;
  for (let guard = 0; guard < 80; guard++) {
    let best = null; const cons = (t, k, n) => { if (best === null || t < best.t) best = { t, k, n }; };
    if (g.prac) {
      if (!g.prac.paused) {
        ['ans', 'flip', 'hold'].forEach(n => { const c = g.prac.clocks[n]; if (c.running) cons(c.at + c.remain, 'pc', n); });
        if (g.prac.due && g.prac.due.at != null) cons(g.prac.due.at, 'pd', g.prac.due.kind);
      }
    } else if (!g.paused) {
      CLN.forEach(n => { const c = g.clocks[n]; if (c.running) cons(c.at + c.remain, 'c', n); });
      if (g.due && g.due.at != null) cons(g.due.at, 'd', g.due.kind);
    }
    if (!best || best.t > now) break;
    const t = best.t;
    if (best.k === 'c') { const c = g.clocks[best.n]; c.remain = 0; c.running = false; c.at = t; onExpire(st, best.n, t); }
    else if (best.k === 'pc') { const c = g.prac.clocks[best.n]; c.remain = 0; c.running = false; c.at = t; onPracExpire(st, best.n, t); }
    else if (best.k === 'd') { g.due = null; onDue(st, best.n, t); }
    else { g.prac.due = null; onPracDue(st, best.n, t); }
    changed = true;
  }
  return changed;
}
function onExpire(st, n, t) {
  const g = st.game;
  if (g.stage === 'main') { if (n === 'main') mainClockEnd(st, t); else if (n === 'ans') mainJudge(st, false, true, t); else if (n === 'flip') flipTimeout(st, t); else if (n === 'hold') holdDone(st, t); }
  else if (g.stage === 'tie') { if (n === 'tie') tieClockEnd(st, t); else if (n === 'ans') tieJudge(st, false, true, t); else if (n === 'flip') flipTimeout(st, t); else if (n === 'hold') holdDone(st, t); }
}
function onDue(st, kind, t) {
  const g = st.game, T = totals(st.settings);
  switch (kind) {
    case 'startHold': cReset(g.clocks.hold, T.hold, true, t); break;
    case 'afterMatch': { const s = g.m; s.picks = []; setDue(g, 'finishTurn', t + VANISH_MS); break; }
    case 'finishTurn': mainFinishTurn(st, t); break;
    case 'endMainTime': endMain(st, 'time', t); break;
    case 'decide': decide(st, t); break;
    case 'tieWin': goResult(st, g.r || { winner: 0, via: 'tie' }, t); break;
    case 'tieAfterMiss': tieAfterMiss(st, t); break;
    case 'toEstimate': toEstimate(st, 'time', t); break;
  }
}
function onPracExpire(st, n, t) {
  const p = st.game.prac;
  if (n === 'ans') pracJudge(st, false, true, t);
  else if (n === 'flip') flipTimeout(st, t);
  else if (n === 'hold') { p.picks = []; p.due = { kind: 'endTurn', at: t + CLOSE_MS }; }
}
function onPracDue(st, kind, t) {
  const p = st.game.prac, T = totals(st.settings);
  if (kind === 'startHold') cReset(p.clocks.hold, T.hold, true, t);
  else if (kind === 'afterMatch') { p.picks = []; p.due = { kind: 'endTurn', at: t + VANISH_MS }; }
  else if (kind === 'endTurn') pracEndTurn(st, t);
}

/* ================= tiles ================= */
function pick(st, i, now) {
  const g = st.game, c = ctx(g);
  if (!c) bad('Không có bảng ô để chọn.', 'There is no board to pick from.');
  if (isPaused(g)) bad('Game đang tạm dừng.', 'The game is paused.');
  const s = c.st;
  if (s.phase !== 'flip') bad('Bảng ô đang khóa: chưa đến lượt lật ô.', 'The board is locked: it is not flip time.');
  if (!Number.isInteger(i) || i < 0 || i >= s.deck.length) bad('Ô không hợp lệ.', 'Invalid tile.');
  if (s.matched && s.matched[i]) bad('Ô này đã được ghép.', 'This tile is already matched.');
  if (s.picks.includes(i)) bad('Ô này đã được chọn trong lượt.', 'This tile is already picked.');
  if (s.picks.length >= 2) bad('Đã chọn đủ 2 ô.', 'Two tiles are already picked.');
  s.picks.push(i); emit(g, 'flip', now);
  if (s.picks.length < 2) return;
  cStop(c.clocks.flip, now); s.phase = 'resolve';
  const [a, b] = s.picks, match = s.deck[a] === s.deck[b];
  s.res = { match }; s.result = match ? 'match' : 'nomatch';
  emit(g, match ? 'match' : 'miss', now + SHOW_MS);
  if (c.kind === 'main') {
    if (match) { s.matched[a] = s.matched[b] = true; s.scores[s.turn] += 1; setDue(g, 'afterMatch', now + SHOW_MS + GLOW_MS); }
    else setDue(g, 'startHold', now + SHOW_MS);
  } else if (c.kind === 'tie') {
    if (match) { g.r = { winner: s.answering, via: 'tie' }; s.phase = 'ended'; setDue(g, 'tieWin', now + SHOW_MS + 2800); }
    else setDue(g, 'startHold', now + SHOW_MS);
  } else {
    if (match) { s.matched[a] = s.matched[b] = true; s.due = { kind: 'afterMatch', at: now + SHOW_MS + GLOW_MS }; }
    else s.due = { kind: 'startHold', at: now + SHOW_MS };
  }
}
function holdDone(st, t) {
  const g = st.game, c = ctx(g); if (!c) return; c.st.picks = [];
  setDue(g, c.kind === 'tie' ? 'tieAfterMiss' : 'finishTurn', t + CLOSE_MS);
}
function flipTimeout(st, t) {
  const g = st.game, c = ctx(g); if (!c) return; const s = c.st; if (s.phase !== 'flip') return;
  emit(g, 'timeout', t); s.picks = []; s.result = 'fliptimeout'; s.phase = 'resolve';
  if (c.kind === 'prac') s.due = { kind: 'endTurn', at: t + CLOSE_MS };
  else setDue(g, c.kind === 'tie' ? 'tieAfterMiss' : 'finishTurn', t + CLOSE_MS);
}

/* ================= main round ================= */
function snapLast(m) { if (m.q) m.last = { team: m.turn, q: m.q, verdict: m.verdict, result: m.result }; }
function startMain(st, now) {
  const g = st.game, m = g.m, T = totals(st.settings);
  if (!g.created) bad('Hãy tạo trận mới trước.', 'Create a new match first.');
  if (g.stage !== 'main' || m.started) bad('Vòng chính đã bắt đầu.', 'The main round has already started.');
  m.started = true; m.turn = m.first; cReset(g.clocks.main, T.main, true, now); cReset(g.clocks.ans, T.ans, false, now);
  emit(g, 'start', now);
}
function mainSelect(st, ref, now) {
  const g = st.game, m = g.m, T = totals(st.settings);
  if (!m.started || m.phase !== 'question') bad('Chưa thể chọn câu hỏi lúc này.', 'You cannot pick a question now.');
  if (m.qOpen) bad('Câu hỏi đã được công bố, không thể đổi câu.', 'The question is already shown and cannot be changed.');
  if (!ref || !['m', 'b', 'x'].includes(ref.s)) bad('Câu hỏi không hợp lệ.', 'Invalid question.');
  const list = qList(g, ref.s);
  if (!Number.isInteger(ref.i) || ref.i < 0 || ref.i >= list.length) bad('Câu hỏi không hợp lệ.', 'Invalid question.');
  if (m.used[ref.s][ref.i]) bad('Câu hỏi này đã dùng trong trận.', 'This question was already used.');
  if (ref.s === 'b' && !allMainUsed(m)) bad('Câu dự phòng chỉ mở khi đã dùng hết câu chính.', 'Backup questions unlock after all main questions.');
  m.q = { s: ref.s, i: ref.i }; m.ansOpen = false; m.verdict = null; m.result = null; m.last = null;
  cReset(g.clocks.ans, T.ans, false, now); emit(g, 'click', now);
}
function mainOpen(st, now) {
  const g = st.game, m = g.m, T = totals(st.settings);
  if (m.phase !== 'question' || !m.q || m.verdict) bad('Hãy chọn câu hỏi trước.', 'Pick a question first.');
  if (m.qOpen) return; // bấm nhiều lần không tạo thêm đồng hồ
  m.qOpen = true; cReset(g.clocks.ans, T.ans, true, now); emit(g, 'qopen', now);
}
function mainReveal(st, now) {
  const g = st.game, m = g.m;
  if (m.phase !== 'question' || !m.q || !m.qOpen || m.verdict) bad('Chưa thể công bố đáp án.', 'The answer cannot be shown yet.');
  if (m.ansOpen) return;
  cStop(g.clocks.ans, now); m.ansOpen = true; emit(g, 'reveal', now);
}
function mainJudge(st, ok, timeout, now) {
  const g = st.game, m = g.m, T = totals(st.settings);
  if (g.stage !== 'main' || m.phase !== 'question' || m.verdict) return; // bấm lặp: không tạo lượt trùng
  if (!m.q || !m.qOpen) { if (timeout) return; bad('Hãy bắt đầu tính giờ trước khi chấm.', 'Start the timer before judging.'); }
  m.used[m.q.s][m.q.i] = true; cStop(g.clocks.ans, now); m.ansOpen = true;
  if (ok) { m.verdict = 'correct'; m.phase = 'flip'; m.picks = []; cReset(g.clocks.flip, T.flip, true, now); emit(g, 'right', now); }
  else { m.verdict = timeout ? 'timeout' : 'wrong'; emit(g, timeout ? 'timeout' : 'wrong', now); mainNextTurn(st, now); }
}
function mainNextTurn(st, now) {
  const g = st.game, m = g.m, T = totals(st.settings);
  snapLast(m);
  m.turn = 1 - m.turn; m.q = null; m.qOpen = false; m.ansOpen = false; m.verdict = null; m.result = null; m.res = null; m.phase = 'question'; m.picks = [];
  cReset(g.clocks.ans, T.ans, false, now); cReset(g.clocks.flip, T.flip, false, now);
  if (eff(g.clocks.main, now) <= 0) endMain(st, 'time', now);
}
function mainFinishTurn(st, t) {
  const g = st.game, m = g.m; m.picks = []; m.res = null;
  if (found(m) >= 8) { snapLast(m); endMain(st, 'done', t); return; }
  if (eff(g.clocks.main, t) <= 0) { snapLast(m); endMain(st, 'time', t); return; }
  mainNextTurn(st, t);
}
function mainClockEnd(st, t) {
  const g = st.game, m = g.m; emit(g, 'timeout', t);
  if (m.phase === 'resolve' || m.phase === 'ended') return; // cặp đang xử lý chạy xong rồi mới chốt vòng
  if (m.phase === 'flip') { cStop(g.clocks.flip, t); m.picks = []; m.result = 'fliptimeout'; m.phase = 'resolve'; setDue(g, 'endMainTime', t + CLOSE_MS); return; }
  cStop(g.clocks.ans, t); endMain(st, 'time', t);
}
function endMain(st, reason, t) {
  const g = st.game, m = g.m;
  if (m.q && !m.last) snapLast(m);
  m.phase = 'ended'; m.endReason = reason; m.picks = []; m.q = null; m.qOpen = false; m.ansOpen = false; m.verdict = null; m.res = null;
  ['main', 'ans', 'flip', 'hold'].forEach(n => cStop(g.clocks[n], t));
  setDue(g, 'decide', t + (reason === 'done' ? 4200 : 3200)); emit(g, 'over', t);
}
function decide(st, t) {
  const g = st.game, s = g.m.scores;
  if (s[0] !== s[1]) { goResult(st, { winner: s[0] > s[1] ? 0 : 1, via: 'main' }, t); return; }
  startTie(st, t);
}
function goResult(st, r, t) {
  const g = st.game; g.r = r; g.stage = 'result'; g.view = 'result'; g.due = null;
  CLN.forEach(n => cStop(g.clocks[n], t)); emit(g, 'win', t); st._record = true;
}
function endMainNow(st, now) {
  const g = st.game, m = g.m;
  if (g.stage !== 'main' || !m.started || m.phase === 'ended') bad('Vòng chính chưa chạy.', 'The main round is not running.');
  if (m.phase === 'resolve') bad('Đợi lượt lật ô xử lý xong.', 'Wait for the current flip to finish.');
  const c = g.clocks.main; c.remain = 0; c.running = false; c.at = now; mainClockEnd(st, now);
}
function addExtra(st, o, now) {
  const g = st.game, m = g.m;
  if (g.stage !== 'main' || !m.started || m.phase !== 'question' || m.qOpen) bad('Chưa thể thêm câu hỏi lúc này.', 'You cannot add a question now.');
  const q = str((o || {}).q, 400, ''), a = str((o || {}).a, 200, '');
  if (!q) bad('Hãy nhập nội dung câu hỏi.', 'Enter the question text.');
  g.qs.x.push({ id: 'X' + (g.qs.x.length + 1), vi: q, en: '', avi: a, aen: '' }); m.used.x.push(false);
  mainSelect(st, { s: 'x', i: g.qs.x.length - 1 }, now);
}

/* ================= tie-breaker ================= */
function startTie(st, t) {
  const g = st.game, T = totals(st.settings);
  g.stage = 'tie'; g.t = freshTie(g.qs);
  cReset(g.clocks.tie, T.tie, false, t); cReset(g.clocks.ans, T.ans, false, t); cReset(g.clocks.flip, T.flip, false, t); cReset(g.clocks.hold, T.hold, false, t);
  emit(g, 'boom', t);
}
const tieAvail = g => g.qs.t.map((q, i) => (!g.t.used[i] ? i : -1)).filter(i => i >= 0);
function tieStart(st, now) {
  const g = st.game, T = totals(st.settings);
  if (g.stage !== 'tie' || g.t.started) bad('Vòng phụ đã bắt đầu.', 'The tie-breaker has already started.');
  g.t.started = true; cReset(g.clocks.tie, T.tie, true, now); emit(g, 'start', now);
}
function tieSelect(st, i, now) {
  const g = st.game, T_ = g.t, T = totals(st.settings);
  if (g.stage !== 'tie' || !T_.started || T_.phase !== 'question') bad('Chưa thể chọn câu hỏi lúc này.', 'You cannot pick a question now.');
  if (T_.qOpen) bad('Câu hỏi đã được công bố, không thể đổi câu.', 'The question is already shown.');
  if (!Number.isInteger(i) || i < 0 || i >= g.qs.t.length || T_.used[i]) bad('Câu hỏi không hợp lệ hoặc đã dùng.', 'Invalid or used question.');
  T_.q = { s: 't', i }; T_.ansOpen = false; T_.verdict = null; T_.result = null; T_.last = null; T_.answering = null; T_.tried = []; T_.wrongTeam = null;
  cReset(g.clocks.ans, T.ans, false, now); emit(g, 'click', now);
}
function tieOpen(st, now) {
  const g = st.game, T_ = g.t;
  if (g.stage !== 'tie' || T_.phase !== 'question' || !T_.q) bad('Hãy chọn câu hỏi trước.', 'Pick a question first.');
  if (T_.qOpen) return;
  T_.qOpen = true; emit(g, 'qopen', now);
}
function tieClaim(st, team, now) {
  const g = st.game, T_ = g.t, T = totals(st.settings);
  if (g.stage !== 'tie' || T_.phase !== 'question' || !T_.qOpen || T_.answering != null || T_.ansOpen) bad('Chưa thể giành quyền trả lời.', 'No team can buzz in now.');
  if (team !== 0 && team !== 1) bad('Đội không hợp lệ.', 'Invalid team.');
  if (T_.tried.includes(team)) bad('Đội này đã trả lời câu hỏi.', 'This team has already answered.');
  T_.answering = team; T_.verdict = null; cReset(g.clocks.ans, T.ans, true, now); emit(g, 'click', now);
}
function tieJudge(st, ok, timeout, now) {
  const g = st.game, T_ = g.t, T = totals(st.settings);
  if (g.stage !== 'tie' || !T_ || T_.phase !== 'question') return; // bấm lặp sau khi đã chấm
  if (T_.answering == null) { if (timeout) return; bad('Chưa chọn đội giành quyền trả lời.', 'Select the team that buzzed in first.'); }
  cStop(g.clocks.ans, now);
  if (ok) { T_.verdict = 'correct'; T_.ansOpen = true; T_.phase = 'flip'; T_.picks = []; cReset(g.clocks.flip, T.flip, true, now); emit(g, 'right', now); return; }
  T_.tried.push(T_.answering); const other = 1 - T_.answering;
  emit(g, timeout ? 'timeout' : 'wrong', now);
  if (!T_.tried.includes(other)) {
    // đội còn lại được trả lời cùng câu hỏi; đáp án vẫn giữ kín
    T_.verdict = timeout ? 'timeoutFirst' : 'wrongFirst'; T_.wrongTeam = T_.answering; T_.answering = other;
    cReset(g.clocks.ans, T.ans, eff(g.clocks.tie, now) > 0, now);
    return;
  }
  T_.verdict = 'bothWrong'; T_.ansOpen = true; T_.used[T_.q.i] = true; tieNextQ(st, now);
}
function tieReveal(st, confirm, now) {
  const g = st.game, T_ = g.t;
  if (g.stage !== 'tie' || T_.phase !== 'question' || !T_.q || !T_.qOpen || T_.ansOpen) bad('Chưa thể công bố đáp án.', 'The answer cannot be shown yet.');
  if (confirm !== true) bad('Cần xác nhận: công bố đáp án sẽ kết thúc quyền trả lời của cả hai đội.', 'Confirmation needed: showing the answer ends both teams’ right to answer.', 409);
  cStop(g.clocks.ans, now); T_.used[T_.q.i] = true; T_.ansOpen = true; T_.verdict = 'revealed'; emit(g, 'reveal', now); tieNextQ(st, now);
}
function tieNextQ(st, now) {
  const g = st.game, T_ = g.t, T = totals(st.settings);
  if (T_.q) T_.last = { q: T_.q, verdict: T_.verdict, team: T_.answering != null ? T_.answering : T_.wrongTeam, result: T_.result };
  T_.q = null; T_.answering = null; T_.tried = []; T_.wrongTeam = null; T_.phase = 'question'; T_.picks = []; T_.qOpen = false; T_.ansOpen = false; T_.verdict = null; T_.result = null; T_.res = null;
  cReset(g.clocks.ans, T.ans, false, now); cReset(g.clocks.flip, T.flip, false, now);
  if (eff(g.clocks.tie, now) <= 0 || !tieAvail(g).length) toEstimate(st, eff(g.clocks.tie, now) <= 0 ? 'time' : 'noq', now);
}
function tieAfterMiss(st, t) { const T_ = st.game.t; if (T_.q) T_.used[T_.q.i] = true; tieNextQ(st, t); }
function tieClockEnd(st, t) {
  const g = st.game, T_ = g.t; emit(g, 'timeout', t);
  if (T_.phase === 'resolve' || T_.phase === 'ended') return;
  if (T_.phase === 'flip') { cStop(g.clocks.flip, t); T_.picks = []; T_.phase = 'resolve'; setDue(g, 'toEstimate', t + CLOSE_MS); return; }
  cStop(g.clocks.ans, t); toEstimate(st, 'time', t);
}

/* ================= estimation ================= */
function estPrep(g, pi, round) {
  const o = g.qs.e[pi];
  return { pi: o ? pi : -1, q: o ? { vi: o.vi, en: o.en } : { vi: '', en: '' }, unit: o ? o.unit || '' : '', correct: o ? String(o.num || '') : '', a: ['', ''], shown: false, result: null, round, why: null };
}
function toEstimate(st, why, t) {
  const g = st.game; ['tie', 'ans', 'flip', 'hold'].forEach(n => cStop(g.clocks[n], t));
  g.due = null; g.stage = 'estimate'; g.e = estPrep(g, 0, 1); g.e.why = why; emit(g, 'boom', t);
}
function parseNum(s) {
  s = String(s || '').trim().replace(/\s/g, ''); if (!s) return NaN;
  if (s.indexOf('.') >= 0 && s.indexOf(',') >= 0) { if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); }
  else if (s.indexOf(',') >= 0) { s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.'); }
  else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
  return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN;
}
function estAction(st, type, d, now) {
  const g = st.game, E = g.e;
  if (g.stage !== 'estimate' || !E) bad('Chưa đến câu ước lượng.', 'Not at the estimation stage.');
  switch (type) {
    case 'estPick': { const pi = Number.isInteger(d.pi) ? d.pi : -1; g.e = estPrep(g, pi, E.round); g.e.why = E.why; break; }
    case 'estCustom': { const q = str(d.q, 400, ''); E.q = { vi: q, en: q }; E.correct = str(d.correct, 30, ''); E.unit = str(d.unit, 20, ''); E.pi = -1; E.result = null; break; }
    case 'estSet': E.a = [str(d.a0, 30, ''), str(d.a1, 30, '')]; if (d.correct != null && E.pi < 0) E.correct = str(d.correct, 30, ''); break;
    case 'estShow': if (!(E.q.vi || E.q.en)) bad('Câu ước lượng chưa có nội dung.', 'The estimation question is empty.'); E.shown = true; emit(g, 'qopen', now); break;
    case 'estCompare': {
      const c = parseNum(E.correct), a0 = parseNum(E.a[0]), a1 = parseNum(E.a[1]);
      if ([c, a0, a1].some(isNaN)) bad('Hãy nhập đủ 3 con số hợp lệ: đáp án chuẩn và đáp án của hai đội.', 'Enter three valid numbers: the correct answer and both teams’ answers.');
      const dd = [Math.abs(a0 - c), Math.abs(a1 - c)], eq = Math.abs(dd[0] - dd[1]) < 1e-9;
      E.result = { c, a: [a0, a1], d: dd, winner: eq ? null : (dd[0] < dd[1] ? 0 : 1) }; E.shown = true; emit(g, eq ? 'miss' : 'match', now); break;
    }
    case 'estNew': { const pi = E.pi >= 0 && E.pi + 1 < g.qs.e.length ? E.pi + 1 : -1; const why = E.why; g.e = estPrep(g, pi, E.round + 1); g.e.why = why; break; }
    case 'announce': if (!E.result || E.result.winner == null) bad('Chưa có đội thắng.', 'There is no winner yet.'); goResult(st, { winner: E.result.winner, via: 'tie' }, now); break;
  }
}

/* ================= practice ================= */
function pracNew(S, prevView, saved) {
  const T = totals(S);
  return { deck: shuffle([0, 0, 1, 1]), matched: [false, false, false, false], phase: 'question', picks: [], verdict: null, result: null, res: null, paused: false, frozen: null, due: null, prevView, saved, clocks: { ans: mkClock(T.ans), flip: mkClock(T.flip), hold: mkClock(T.hold) } };
}
function practiceStart(st, now) {
  const g = st.game;
  if (g.prac) bad('Đang chơi thử.', 'Practice is already running.');
  if (g.due || (g.stage === 'main' && g.m.phase === 'resolve') || (g.t && g.t.phase === 'resolve')) bad('Hãy chờ lượt đang xử lý của trận chính kết thúc.', 'Wait for the current match turn to finish.');
  const saved = []; if (!g.paused) CLN.forEach(n => { if (g.clocks[n].running) { cStop(g.clocks[n], now); saved.push(n); } });
  g.prac = pracNew(st.settings, g.view, saved); g.view = 'game';
}
function practiceEnd(st, now) {
  const g = st.game, p = g.prac; if (!p) return;
  if (!g.paused) (p.saved || []).forEach(n => cStart(g.clocks[n], now));
  g.view = p.prevView === 'result' && g.r ? 'result' : (p.prevView === 'game' && g.created ? 'game' : 'welcome'); g.prac = null;
}
function pracOpen(st, now) {
  const p = st.game.prac, T = totals(st.settings);
  if (p.phase !== 'question') bad('Chưa thể bắt đầu tính giờ.', 'The timer cannot start now.');
  if (p.clocks.ans.running) return;
  if (p.clocks.ans.remain <= 0 || p.verdict) { cReset(p.clocks.ans, T.ans, true, now); p.verdict = null; } else cStart(p.clocks.ans, now);
  p.verdict = null; emit(st.game, 'qopen', now);
}
function pracJudge(st, ok, timeout, now) {
  const g = st.game, p = g.prac, T = totals(st.settings);
  if (!p || p.phase !== 'question') { if (timeout) return; bad('Chưa thể chấm lúc này.', 'You cannot judge now.'); }
  cStop(p.clocks.ans, now);
  if (ok) { p.verdict = 'correct'; p.phase = 'flip'; p.picks = []; cReset(p.clocks.flip, T.flip, true, now); emit(g, 'right', now); }
  else { p.verdict = timeout ? 'timeout' : 'wrong'; cReset(p.clocks.ans, T.ans, false, now); emit(g, timeout ? 'timeout' : 'wrong', now); }
}
function pracEndTurn(st, t) {
  const p = st.game.prac, T = totals(st.settings);
  p.picks = []; p.phase = 'question'; p.res = null; p.verdict = null; p.result = null;
  cReset(p.clocks.ans, T.ans, false, t); cReset(p.clocks.flip, T.flip, false, t);
  if (p.matched.every(Boolean)) { p.deck = shuffle([0, 0, 1, 1]); p.matched = [false, false, false, false]; }
}
function pracShuffle(st, now) {
  const p = st.game.prac, T = totals(st.settings);
  if (p.phase === 'resolve') bad('Đợi lượt đang xử lý kết thúc.', 'Wait for the current flip to finish.');
  p.deck = shuffle([0, 0, 1, 1]); p.matched = [false, false, false, false]; p.picks = []; p.phase = 'question'; p.verdict = null; p.result = null; p.due = null;
  cReset(p.clocks.ans, T.ans, false, now); cReset(p.clocks.flip, T.flip, false, now); cReset(p.clocks.hold, T.hold, false, now);
}

/* ================= board shuffle ================= */
function shuffleBoard(st, confirm, now) {
  const g = st.game, T = totals(st.settings);
  if (g.prac) { pracShuffle(st, now); emit(g, 'shuffle', now); return; }
  if (g.stage === 'main') {
    const m = g.m;
    if (!m.started) { m.deck = deck8(); m.matched = Array(16).fill(false); emit(g, 'shuffle', now); return; }
    if (confirm !== true) bad('Đảo hình sẽ bắt đầu lại vòng hiện tại và xóa tiến độ của vòng. Bạn có muốn tiếp tục?', 'Shuffling restarts the current round and clears its progress. Continue?', 409);
    const used = m.used, first = m.first;
    g.m = freshMain(first, g.qs); g.m.used = used; g.due = null;
    ['main', 'ans', 'flip', 'hold'].forEach(n => cReset(g.clocks[n], T[n], false, now));
    if (g.paused) { g.paused = false; g.frozen = null; }
    emit(g, 'shuffle', now); return;
  }
  if (g.stage === 'tie') {
    const t = g.t;
    if (!t.started) { t.deck = shuffle([0, 0, 1, 2]); emit(g, 'shuffle', now); return; }
    if (confirm !== true) bad('Đảo hình sẽ bắt đầu lại vòng hiện tại và xóa tiến độ của vòng. Bạn có muốn tiếp tục?', 'Shuffling restarts the current round and clears its progress. Continue?', 409);
    const used = t.used; g.t = freshTie(g.qs); g.t.used = used; g.r = null; g.due = null;
    ['tie', 'ans', 'flip', 'hold'].forEach(n => cReset(g.clocks[n], T[n], false, now));
    if (g.paused) { g.paused = false; g.frozen = null; }
    emit(g, 'shuffle', now); return;
  }
  bad('Chỉ đảo hình được ở vòng chính hoặc vòng phụ.', 'The board can only be shuffled in the main round or the tie-breaker.');
}

/* ================= new match & question snapshot ================= */
function snapshot(bank, doShuffle) {
  const qs = emptyQs(); const map = { main: 'm', backup: 'b', tie: 't', est: 'e' };
  (bank || []).filter(q => q && q.enabled !== false && map[q.grp]).sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.id).localeCompare(String(b.id))).forEach(q => {
    const k = map[q.grp];
    if (k === 'e') qs.e.push({ id: q.id, vi: q.q_vi || '', en: q.q_en || '', num: q.num || '', unit: q.unit || '' });
    else qs[k].push({ id: q.id, vi: q.q_vi || '', en: q.q_en || '', avi: q.a_vi || '', aen: q.a_en || '' });
  });
  if (doShuffle) { shuffle(qs.m); shuffle(qs.b); shuffle(qs.t); }
  return qs;
}
function preflight(S, bank) {
  const warn = [], qs = snapshot(bank, false);
  const miss = l => l.filter(q => !(q.vi || q.en).trim() || !(q.avi || q.aen).trim()).length;
  if (!qs.m.length) warn.push(['Chưa có câu hỏi vòng chính nào đang bật.', 'No main-round questions are enabled.']);
  else if (miss(qs.m)) warn.push([miss(qs.m) + ' câu hỏi vòng chính thiếu nội dung hoặc đáp án.', miss(qs.m) + ' main questions are missing text or an answer.']);
  if (miss(qs.b)) warn.push([miss(qs.b) + ' câu dự phòng thiếu nội dung hoặc đáp án.', miss(qs.b) + ' backup questions are missing text or an answer.']);
  if (!qs.t.length) warn.push(['Chưa có câu hỏi vòng phụ nào đang bật.', 'No tie-breaker questions are enabled.']);
  else if (miss(qs.t)) warn.push([miss(qs.t) + ' câu hỏi vòng phụ thiếu nội dung hoặc đáp án.', miss(qs.t) + ' tie-breaker questions are missing text or an answer.']);
  if (!qs.e.length) warn.push(['Chưa có câu ước lượng nào đang bật (MC vẫn có thể tự nhập khi cần).', 'No estimation questions are enabled (the host can still type one).']);
  else if (qs.e.some(q => !(q.vi || q.en).trim() || isNaN(parseNum(q.num)))) warn.push(['Có câu ước lượng thiếu nội dung hoặc đáp án số.', 'Some estimation questions are missing text or a numeric answer.']);
  const used = S.mainShoes.concat(S.tieShoes);
  if (new Set(S.mainShoes).size < 8) warn.push(['Vòng chính đang dùng trùng ảnh cho hai cặp khác nhau.', 'Two main-round pairs use the same image.']);
  if (new Set(S.tieShoes).size < 3) warn.push(['Vòng phụ đang dùng trùng ảnh.', 'The tie-breaker uses the same image twice.']);
  void used;
  return { warnings: warn, counts: { m: qs.m.length, b: qs.b.length, t: qs.t.length, e: qs.e.length } };
}
function newMatch(st, d, bank, now) {
  const S = st.settings, g0 = st.game;
  if (Array.isArray(d.teams)) S.teams = mergeSettings(S, { teams: d.teams.map((n, i) => ({ name: n, color: S.teams[i].color })) }).teams;
  const qs = snapshot(bank, S.shuffleQ), first = d.first === 1 ? 1 : 0;
  const g = newGame(S, qs, first, true, (g0.ev && g0.ev.seq) || 0);
  g.music = g0.music || { playing: false };
  st.game = g; emit(g, 'shuffle', now);
}

/* ================= device pairing ================= */
function pairCode(st, now) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  st.device.code = { hash: sha256(code), exp: now + 10 * 60000, tries: 0 };
  return code;
}
function pairDevice(st, code, now) {
  const dv = st.device, c = dv.code;
  if (!c || c.exp < now || c.tries >= 5) { dv.code = null; return { ok: false, err: ['Mã ghép nối đã hết hạn. Hãy tạo mã mới trên trang MC.', 'The pairing code has expired. Create a new one on the host page.'] }; }
  const a = Buffer.from(sha256(String(code || '').trim())), b = Buffer.from(c.hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { c.tries += 1; return { ok: false, err: ['Mã ghép nối không đúng.', 'Wrong pairing code.'] }; }
  const token = crypto.randomBytes(32).toString('hex');
  dv.tokenHash = sha256(token); dv.pairedAt = now; dv.code = null;
  return { ok: true, token };
}
function deviceOk(st, token) {
  const h = st.device && st.device.tokenHash; if (!h || typeof token !== 'string' || token.length < 32) return false;
  const a = Buffer.from(sha256(token)), b = Buffer.from(h); return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ================= MC actions ================= */
const PAUSE_OK = new Set(['pause', 'resume', 'view', 'music', 'lang', 'replayFx', 'newMatch', 'practiceEnd', 'adjust', 'mainReset', 'tieReset', 'first']);
function apply(st, a, now, ctxInfo) {
  const g = st.game, d = a || {}, type = d.type;
  if (isPaused(g) && !PAUSE_OK.has(type)) bad('Game đang tạm dừng. Bấm Tiếp tục trước.', 'The game is paused. Press Resume first.');
  const T = totals(st.settings);
  const inPrac = !!g.prac;
  switch (type) {
    case 'newMatch': if (g.prac) practiceEnd(st, now); newMatch(st, d, (ctxInfo && ctxInfo.bank) || [], now); return;
    case 'view': {
      const v = d.v;
      if (v === 'welcome') { if (g.prac) practiceEnd(st, now); if (CLN.some(n => g.clocks[n].running)) pauseAll(g, now); g.view = 'welcome'; return; }
      if (v === 'game') { if (!g.created && !g.prac) bad('Hãy tạo trận mới trước.', 'Create a new match first.'); g.view = g.stage === 'result' && !g.prac ? 'result' : 'game'; return; }
      bad('Màn hình không hợp lệ.', 'Invalid screen.');
    }
    case 'pause': pauseAll(g, now); return;
    case 'resume': resumeAll(g, now); return;
    case 'music': g.music = { playing: !!d.playing }; return;
    case 'lang': st.settings.lang = d.lang === 'en' ? 'en' : 'vi'; return;
    case 'replayFx': if (g.stage !== 'result') bad('Chưa có kết quả.', 'There is no result yet.'); emit(g, 'win', now); return;
    case 'practiceStart': practiceStart(st, now); return;
    case 'practiceEnd': practiceEnd(st, now); return;
    case 'shuffle': shuffleBoard(st, d.confirm, now); return;
    case 'pick': pick(st, d.i, now); return;
  }
  if (inPrac) {
    switch (type) {
      case 'open': pracOpen(st, now); return;
      case 'ansPause': cStop(g.prac.clocks.ans, now); return;
      case 'ansResume': if (g.prac.phase === 'question') cStart(g.prac.clocks.ans, now); return;
      case 'ansReset': cReset(g.prac.clocks.ans, T.ans, false, now); return;
      case 'judge': pracJudge(st, !!d.ok, false, now); return;
      case 'flipPause': if (g.prac.phase === 'flip') cStop(g.prac.clocks.flip, now); return;
      case 'flipResume': if (g.prac.phase === 'flip') cStart(g.prac.clocks.flip, now); return;
      case 'flipReset': if (g.prac.phase === 'flip') cReset(g.prac.clocks.flip, T.flip, g.prac.clocks.flip.running, now); return;
    }
    bad('Thao tác không dùng được khi đang chơi thử.', 'This action is not available during practice.');
  }
  const m = g.m, tie = g.t;
  switch (type) {
    case 'first': if (g.stage !== 'main' || m.started) bad('Vòng chính đã bắt đầu.', 'The main round has started.'); m.first = m.turn = d.v === 1 ? 1 : 0; return;
    case 'startMain': startMain(st, now); return;
    case 'select': if (g.stage === 'tie') tieSelect(st, d.i, now); else if (g.stage === 'main') mainSelect(st, { s: d.s, i: d.i }, now); else bad('Không có câu hỏi ở bước này.', 'No question at this stage.'); return;
    case 'open': if (g.stage === 'tie') tieOpen(st, now); else if (g.stage === 'main') mainOpen(st, now); else bad('Không có câu hỏi ở bước này.', 'No question at this stage.'); return;
    case 'ansPause': cStop(g.clocks.ans, now); return;
    case 'ansResume': {
      const ok = g.stage === 'main' ? (m.phase === 'question' && m.qOpen && !m.verdict) : (g.stage === 'tie' && tie.phase === 'question' && tie.answering != null);
      if (!ok) bad('Chưa thể chạy đồng hồ trả lời.', 'The answer timer cannot run now.'); cStart(g.clocks.ans, now); return;
    }
    case 'ansReset': {
      const ok = g.stage === 'main' ? (m.phase === 'question' && !m.verdict) : (g.stage === 'tie' && tie.phase === 'question');
      if (!ok) bad('Chưa thể đặt lại đồng hồ.', 'The timer cannot be reset now.'); cReset(g.clocks.ans, T.ans, false, now); return;
    }
    case 'reveal': if (g.stage === 'tie') tieReveal(st, d.confirm, now); else if (g.stage === 'main') mainReveal(st, now); else bad('Không có đáp án ở bước này.', 'No answer at this stage.'); return;
    case 'judge': if (g.stage === 'tie') tieJudge(st, !!d.ok, false, now); else if (g.stage === 'main') mainJudge(st, !!d.ok, false, now); else bad('Không có câu hỏi ở bước này.', 'No question at this stage.'); return;
    case 'flipPause': { const c = ctx(g); if (c && c.st.phase === 'flip') cStop(g.clocks.flip, now); return; }
    case 'flipResume': { const c = ctx(g); if (c && c.st.phase === 'flip') cStart(g.clocks.flip, now); return; }
    case 'flipReset': { const c = ctx(g); if (c && c.st.phase === 'flip') cReset(g.clocks.flip, T.flip, g.clocks.flip.running, now); return; }
    case 'mainToggle': if (g.stage !== 'main' || !m.started || m.phase === 'ended') bad('Vòng chính chưa chạy.', 'The main round is not running.'); if (g.clocks.main.running) cStop(g.clocks.main, now); else cStart(g.clocks.main, now); return;
    case 'mainReset': if (g.stage !== 'main' || m.phase === 'ended') bad('Không thể đặt lại lúc này.', 'Cannot reset now.'); cReset(g.clocks.main, T.main, false, now); return;
    case 'adjust': if (g.stage !== 'main' || ![0, 1].includes(d.team)) bad('Chỉ chỉnh điểm ở vòng chính.', 'Scores can only be adjusted in the main round.'); m.scores[d.team] = Math.max(0, m.scores[d.team] + (d.d > 0 ? 1 : -1)); return;
    case 'endMain': endMainNow(st, now); return;
    case 'addExtra': addExtra(st, d, now); return;
    case 'startTie': tieStart(st, now); return;
    case 'claim': tieClaim(st, d.team, now); return;
    case 'tieToggle': if (g.stage !== 'tie' || !tie.started) bad('Vòng phụ chưa chạy.', 'The tie-breaker is not running.'); if (g.clocks.tie.running) cStop(g.clocks.tie, now); else cStart(g.clocks.tie, now); return;
    case 'tieReset': if (g.stage !== 'tie') bad('Không ở vòng phụ.', 'Not in the tie-breaker.'); cReset(g.clocks.tie, T.tie, false, now); return;
    case 'toEst': if (g.stage !== 'tie' || tie.phase === 'resolve' || tie.phase === 'ended') bad('Chưa thể chuyển lúc này.', 'Cannot switch now.'); toEstimate(st, 'manual', now); return;
    case 'estPick': case 'estCustom': case 'estSet': case 'estShow': case 'estCompare': case 'estNew': case 'announce': estAction(st, type, d, now); return;
  }
  bad('Thao tác không hợp lệ.', 'Invalid action.');
}

/* ================= projections ================= */
function txt(o) { return o ? { vi: o.vi || '', en: o.en || '' } : null; }
function ans(o) { return o ? { vi: o.avi || '', en: o.aen || '' } : null; }
function tilesOf(st, kind, s) {
  const S = st.settings, show = i => {
    const slot = kind === 'main' ? S.mainShoes[s.deck[i]] : kind === 'tie' ? S.tieShoes[s.deck[i]] : [11, 12][s.deck[i]];
    return shoeUrl(S, slot);
  };
  const resolving = s.phase === 'resolve' || s.phase === 'ended';
  return s.deck.map((_, i) => {
    if (s.picks.includes(i)) return { s: 'o', img: show(i), w: resolving && s.res && s.res.match ? 1 : 0, x: resolving && s.res && !s.res.match ? 1 : 0 };
    if (s.matched && s.matched[i]) return { s: 'g' };
    return { s: 'd' };
  });
}
// Đáp án chỉ rời server khi đã được công bố (ansOpen) hoặc lượt đã chốt với kết quả công khai.
const REVEALED = new Set(['correct', 'wrong', 'timeout', 'bothWrong', 'revealed']);
function present(g, x, team, isLast) {
  if (!x || !x.q) return null; const o = qGet(g, x.q);
  const showA = x.ansOpen || (isLast && REVEALED.has(x.verdict));
  return { ref: x.q, team, q: (x.qOpen || isLast) ? txt(o) : null, a: showA ? ans(o) : null, verdict: x.verdict || null, result: x.result || null, last: !!isLast };
}
function project(st, now, version) {
  const S = st.settings, g = st.game, c = ctx(g);
  const clocks = {}; CLN.forEach(n => { clocks[n] = g.clocks[n]; });
  if (g.prac) ['ans', 'flip', 'hold'].forEach(n => { clocks[n] = g.prac.clocks[n]; });
  const pub = {
    v: version, now,
    s: { pname: S.pname, taglineVi: S.taglineVi, taglineEn: S.taglineEn, lang: S.lang, logoMode: S.logoMode, logoUrl: S.logoUrl, bgUrl: S.bgUrl, revUrl: S.revUrl,
      shoes: Array.from({ length: 15 }, (_, i) => shoeUrl(S, i)), teams: S.teams, sfx: S.sfx, sfxVol: S.sfxVol, motion: S.motion,
      musicUrl: S.musicUrl, musicVol: S.musicVol, musicLoop: S.musicLoop, fanfareUrl: S.fanfareUrl, pickMode: S.pickMode, times: S.times },
    gameId: g.id, view: g.view, created: g.created, stage: g.stage, mode: g.prac ? 'practice' : g.stage, paused: isPaused(g),
    clocks, scores: g.m.scores, started: g.m.started, found: found(g.m), ev: g.ev, music: g.music, r: g.r, nextDue: nextDue(g),
    board: null, msg: null, tie: null, est: null, paired: !!(st.device && st.device.tokenHash),
  };
  if (c && (c.kind === 'prac' || g.stage === 'main' || g.stage === 'tie')) {
    const s = c.st;
    pub.board = { kind: c.kind === 'main' ? 'main' : 'small', tiles: tilesOf(st, c.kind, s), pickable: s.phase === 'flip' && !isPaused(g), picks: s.picks.length };
  }
  if (g.prac) pub.msg = { k: 'prac', phase: g.prac.phase, verdict: g.prac.verdict, result: g.prac.result, picks: g.prac.picks.length };
  else if (g.stage === 'main') {
    const m = g.m;
    if (!m.started) pub.msg = { k: 'ready', first: m.first };
    else if (m.phase === 'ended') pub.msg = { k: 'over', reason: m.endReason, last: present(g, m.last, m.last && m.last.team, true) };
    else pub.msg = { k: 'main', team: m.turn, phase: m.phase, picks: m.picks.length, cur: m.q ? present(g, m, m.turn, false) : null, last: !m.q ? present(g, m.last, m.last && m.last.team, true) : null };
  } else if (g.stage === 'tie') {
    const t = g.t;
    pub.tie = { started: t.started, answering: t.answering, tried: t.tried, wrongTeam: t.wrongTeam };
    pub.msg = { k: 'tie', started: t.started, phase: t.phase, answering: t.answering, wrongTeam: t.wrongTeam, picks: t.picks.length,
      cur: t.q ? present(g, t, t.answering, false) : null, last: !t.q ? present(g, t.last, t.last && t.last.team, true) : null };
  } else if (g.stage === 'estimate') {
    const E = g.e;
    pub.est = { round: E.round, shown: E.shown, why: E.why, q: E.shown ? E.q : null, unit: E.unit, result: E.result };
  }
  return pub;
}
function privView(st) {
  const g = clone(st.game);
  delete g._evNew; if (g.m) delete g.m.deck; if (g.t) delete g.t.deck; if (g.prac) delete g.prac.deck;
  const dv = st.device || {};
  return { settings: st.settings, game: g, device: { paired: !!dv.tokenHash, pairedAt: dv.pairedAt || 0, codeExp: dv.code ? dv.code.exp : 0 } };
}
function matchRecord(st, now) {
  const g = st.game, S = st.settings; const used = [];
  ['m', 'b', 'x'].forEach(k => (g.m.used[k] || []).forEach((u, i) => { if (u) { const q = g.qs[k][i]; used.push({ id: q.id, q: q.vi || q.en, a: q.avi || q.aen }); } }));
  if (g.t) (g.t.used || []).forEach((u, i) => { if (u) { const q = g.qs.t[i]; used.push({ id: q.id, q: q.vi || q.en, a: q.avi || q.aen }); } });
  return { gameId: g.id, finishedAt: new Date(now).toISOString(), pname: S.pname, teams: S.teams.map(t => t.name), scores: g.m.scores.slice(), winner: g.r ? S.teams[g.r.winner].name : null, winnerIdx: g.r ? g.r.winner : null, via: g.r ? g.r.via : null, est: g.e && g.e.result ? { q: g.e.q.vi || g.e.q.en, correct: g.e.result.c, answers: g.e.result.a } : null, questions: used };
}

module.exports = {
  GameError, defaultSettings, mergeSettings, ensure, cleanForSave, advance, apply, project, privView, nextDue, eff, totals,
  newGame, emptyQs, snapshot, preflight, pairCode, pairDevice, deviceOk, pick, matchRecord, parseNum, clone, shuffle, sha256,
  _internal: { found, ctx },
};
