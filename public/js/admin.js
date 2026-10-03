/* THINK & MATCH: trang MC / Admin.
   Giao diện chỉ hiện sau khi đăng nhập. Mọi thao tác gửi kèm phiên đăng nhập và được máy chủ kiểm tra quyền. */
(function () {
  'use strict';
  const { $, $$, esc, fmt, tt } = TM;
  const SKEY = 'tm_admin_session';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
  };
  let sess = null, role = null, user = null, pub = null, priv = null, privV = -1, sync = null, syncStatus = 'off';
  let bank = null, canEdit = false, bankFilter = { grp: '', q: '' }, draft = null, setDirty = false;
  const inflight = new Set();
  try { sess = JSON.parse(ls.get(SKEY) || 'null'); } catch (e) { sess = null; }
  TM.lang = ls.get('tm_admin_lang') === 'en' ? 'en' : 'vi';

  /* ---------- tiện ích giao diện ---------- */
  function applyStatic() {
    document.documentElement.lang = TM.lang;
    $$('[data-t]').forEach(e => { const p = e.dataset.t.split('|'); e.textContent = TM.lang === 'en' ? (p[1] || p[0]) : p[0]; });
    $$('.lang-mini button').forEach(b => b.classList.toggle('on', b.dataset.l === TM.lang));
  }
  let toastT = 0;
  function toast(msg, kind, ms) { const el = $('#atoast'); el.textContent = msg; el.className = 'atoast show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'atoast'; }, ms || 3200); }
  // Cập nhật HTML khi thay đổi; không ghi đè khi MC đang gõ trong ô nhập của khối đó.
  function put(el, html) {
    if (!el || el.dataset.h === html) return;
    const a = document.activeElement;
    if (a && el.contains(a) && a.matches('input,textarea,select')) { el.dataset.pending = '1'; return; }
    el.dataset.h = html; el.innerHTML = html; delete el.dataset.pending;
  }
  document.addEventListener('focusout', () => setTimeout(() => { if ($$('[data-pending]').length && priv) render(); }, 0));
  function dialog(title, body, buttons, onOpen) {
    return new Promise(res => {
      const bg = $('#dlg'); $('#dlgT').textContent = title; $('#dlgB').innerHTML = body;
      $('#dlgR').innerHTML = buttons.map((b, i) => '<button class="btn ' + (b.cls || 'btn-ghost') + '" data-i="' + i + '">' + esc(b.label) + '</button>').join('');
      const done = v => { bg.classList.remove('show'); $('#dlgR').onclick = null; res(v); };
      $('#dlgR').onclick = e => { const b = e.target.closest('button'); if (!b) return; const bt = buttons[+b.dataset.i]; if (bt.check && !bt.check()) return; done(bt.value); };
      bg.classList.add('show');
      if (onOpen) onOpen($('#dlgB'), done);
    });
  }
  const confirmBox = (title, msg, ok, danger) => dialog(title, '<p>' + esc(msg) + '</p>', [{ label: tt('Hủy', 'Cancel'), value: false }, { label: ok || tt('Đồng ý', 'OK'), cls: danger ? 'btn-no' : 'btn-primary', value: true }]);

  /* ---------- phiên đăng nhập ---------- */
  function saveSess(s, r) { sess = s; if (r) role = r; ls.set(SKEY, s ? JSON.stringify(Object.assign({}, s, { role })) : null); }
  async function refreshSess() {
    const r = await TM.api('/api/auth', { op: 'refresh', refresh_token: sess.refresh_token });
    saveSess(r.session, r.role);
  }
  async function api(path, body) {
    if (!sess) throw Object.assign(new Error(tt('Cần đăng nhập.', 'Please sign in.')), { status: 401 });
    try { return await TM.api(path, body, sess.access_token); }
    catch (e) {
      if (e.status !== 401) throw e;
      try { await refreshSess(); } catch (e2) { kick(tt('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'Your session has expired. Please sign in again.')); throw e; }
      try { return await TM.api(path, body, sess.access_token); } catch (e3) { if (e3.status === 401) kick(e3.message); throw e3; }
    }
  }
  setInterval(() => { if (sess && sess.expires_at && sess.expires_at * 1000 - Date.now() < 5 * 60000) refreshSess().catch(() => {}); }, 30000);
  function kick(msg) { saveSess(null); ls.set('tm_admin_kick', msg || ''); location.replace(location.pathname); }

  /* ---------- màn hình đăng nhập ---------- */
  async function showLogin() {
    $('#appV').hidden = true; $('#loginV').hidden = false; applyStatic();
    const kickMsg = ls.get('tm_admin_kick'); if (kickMsg) { $('#lMsg').textContent = kickMsg; ls.set('tm_admin_kick', null); }
    let st = null;
    try { st = await TM.api('/api/auth', { op: 'status' }); }
    catch (e) {
      if (e.data && e.data.notConfigured) { $('#notConf').hidden = false; return; }
      if (e.data && e.data.needsSetup) { $('#needSetup').hidden = false; return; }
      $('#lMsg').textContent = e.message; $('#loginF').hidden = false; return;
    }
    if (st.needsSetup) $('#needSetup').hidden = false;
    else if (!st.hasAdmin) $('#setupF').hidden = false;
    else $('#loginF').hidden = false;
  }
  $('#loginF').addEventListener('submit', async e => {
    e.preventDefault(); $('#lMsg').textContent = '';
    try { const r = await TM.api('/api/auth', { op: 'login', email: $('#lEmail').value.trim(), password: $('#lPass').value }); $('#lPass').value = ''; saveSess(r.session, r.role); await enterApp(); }
    catch (err) { $('#lMsg').textContent = err.message; }
  });
  $('#setupF').addEventListener('submit', async e => {
    e.preventDefault(); $('#lMsg').textContent = '';
    try { const r = await TM.api('/api/auth', { op: 'setup', code: $('#sCode').value.trim(), email: $('#sEmail').value.trim(), password: $('#sPass').value }); $('#sPass').value = ''; saveSess(r.session, r.role); await enterApp(); }
    catch (err) { $('#lMsg').textContent = err.message; }
  });
  $('#copySql').addEventListener('click', async () => {
    try { const t = await (await fetch('setup.sql', { cache: 'no-store' })).text(); await navigator.clipboard.writeText(t); toast(tt('Đã sao chép SQL.', 'SQL copied.'), 'good'); }
    catch (e) { window.open('setup.sql', '_blank'); }
  });
  $$('.lang-mini button').forEach(b => b.addEventListener('click', () => {
    if (priv) return act('lang', { lang: b.dataset.l });
    TM.lang = b.dataset.l; ls.set('tm_admin_lang', TM.lang); applyStatic();
  }));

  /* ---------- vào trang MC ---------- */
  let scr = null, adjusting = false;
  async function enterApp() {
    const r = await api('/api/admin', { op: 'state' });
    role = r.role; user = r.user; saveSess(sess, role);
    $('#loginV').hidden = true; $('#appV').hidden = false; document.documentElement.classList.add('inapp');
    $$('[data-admin]').forEach(e => { e.hidden = role !== 'admin'; });
    $('#tbRole').textContent = role === 'admin' ? 'ADMIN' : 'MC';
    $('#tbUser').textContent = user && user.email || '';
    if (!sync) {
      sync = new TM.Sync({ onState: (p, prev) => { pub = p; if (p.v > privV) loadPriv(); scr.update(p, prev); }, onStatus: s => { syncStatus = s; scr.setStatus(s); render(); } });
      scr = new TM.Screen({
        host: true, stage: $('#stage'), sync, soundKey: 'tm_host_sound', soundDefault: false,
        onPick: i => act('pick', { i }), canPick: () => syncStatus !== 'off',
        onRender: () => render(), onTools: () => renderHostTools(), onClock: () => tickPanel(),
      });
      setInterval(() => { if (!document.hidden) loadPriv(); }, 4000);
    }
    setState(r);
  }
  let privBusy = false, privAgain = false;
  async function loadPriv() {
    if (privBusy) { privAgain = true; return; }
    privBusy = true;
    try { setState(await api('/api/admin', { op: 'state' })); } catch (e) { /* hiện ở trạng thái kết nối */ }
    finally { privBusy = false; if (privAgain) { privAgain = false; loadPriv(); } }
  }
  function setState(r) {
    if (!r || !r.priv) return;
    if (r.pub && r.pub.v < privV) return;
    priv = r.priv; privV = r.pub.v;
    const lang = priv.settings.lang === 'en' ? 'en' : 'vi';
    if (lang !== TM.lang) { TM.lang = lang; ls.set('tm_admin_lang', lang); applyStatic(); if (spOpen) renderSp(); }
    sync.apply(r.pub, true);
    pub = sync.pub;
    render();
  }
  async function act(type, data, quiet) {
    const key = type + JSON.stringify(data || {});
    if (inflight.has(key)) return null;
    inflight.add(key);
    try { const r = await api('/api/action', Object.assign({ type }, data || {})); setState(r); return r; }
    catch (e) { if (!quiet) toast(e.message, 'err', 4500); return null; }
    finally { inflight.delete(key); }
  }
  function openPlayer() {
    const w = window.open('/', 'tm_player', 'popup=yes,width=1280,height=720');
    if (!w) toast(tt('Trình duyệt chặn cửa sổ mới. Hãy cho phép cửa sổ bật lên, hoặc mở địa chỉ trang chủ trên máy chiếu.', 'The browser blocked the new window. Allow pop-ups, or open the home page on the projector.'), 'err', 6000);
    else try { w.focus(); } catch (e) { /* bỏ qua */ }
  }
  async function logout() {
    try { await TM.api('/api/auth', { op: 'logout' }, sess && sess.access_token); } catch (e) { /* vẫn đăng xuất trên máy này */ }
    saveSess(null); location.replace(location.pathname);
  }

  /* ---------- trợ giúp hiển thị ---------- */
  const G = () => priv.game, ST = () => priv.settings;
  const teamName = i => (ST().teams[i] || {}).name || ('ĐỘI ' + (i + 1));
  const teamColor = i => (ST().teams[i] || {}).color || '#fff';
  const tn = i => '<b style="color:' + esc(teamColor(i)) + '">' + esc(teamName(i)) + '</b>';
  const btn = (a, label, cls, opt) => { opt = opt || {}; let x = ''; Object.keys(opt.data || {}).forEach(k => { x += ' data-' + k + '="' + esc(opt.data[k]) + '"'; }); return '<button class="btn ' + (cls || 'btn-ghost') + '" data-act="' + a + '"' + x + (opt.dis ? ' disabled' : '') + (opt.title ? ' title="' + esc(opt.title) + '"' : '') + '>' + label + '</button>'; };
  const row = (cls, inner) => '<div class="row' + (cls ? ' ' + cls : '') + '">' + inner + '</div>';
  function qObj(ref) { const g = G(); if (!ref) return null; const l = g.qs[ref.s]; return l ? l[ref.i] : null; }
  function qText(o) { if (!o) return ''; return TM.lang === 'en' ? (o.en || o.vi || '') : (o.vi || o.en || ''); }
  function aText(o) { if (!o) return ''; return TM.lang === 'en' ? (o.aen || o.avi || '') : (o.avi || o.aen || ''); }
  const matchActive = () => { const g = G(); return g.created && g.stage !== 'result'; };

  /* ---------- vẽ phần riêng của trang MC ---------- */
  function render() {
    if (!priv || !pub || !scr) return;
    renderWelcome(); renderHostTools(); renderPanel(); renderResultBtns();
    $('#col').classList.toggle('adjusting', adjusting && G().created && !G().prac && G().stage === 'main');
    if (spOpen) renderSpLive();
  }
  function renderWelcome() {
    const g = G(), on = matchActive();
    $('#btnStart').textContent = on ? tt('TIẾP TỤC', 'CONTINUE') : tt('BẮT ĐẦU', 'START');
    $('#btnPractice').textContent = tt('Chơi thử', 'Practice');
    $('#btnSettings').textContent = tt('Cài đặt', 'Settings');
    const rn = { main: tt('Vòng chính', 'Main round'), tie: tt('Vòng phụ', 'Tie-breaker'), estimate: tt('Câu ước lượng', 'Estimation') }[g.stage] || '';
    put($('#wNote'), on ? '<span>' + esc(fmt(tt('Trận đang diễn ra: {r} · {a} – {b}', 'Match in progress: {r} · {a} – {b}'), { r: rn, a: teamName(0) + ' ' + g.m.scores[0], b: g.m.scores[1] + ' ' + teamName(1) })) + '</span>' + btn('newMatchDlg', tt('Trận mới', 'New match')) : '');
  }
  function renderHostTools() {
    if (!priv) return;
    const g = G(), mus = !!(g.music && g.music.playing);
    $$('.js-lang button').forEach(b => b.classList.toggle('on', b.dataset.l === TM.lang));
    $$('.js-music').forEach(b => { b.innerHTML = TM.IC.note; b.classList.toggle('lit', mus); b.classList.toggle('off', !ST().musicUrl); b.title = ST().musicUrl ? (mus ? tt('Tắt nhạc nền', 'Stop music') : tt('Bật nhạc nền', 'Play music')) : tt('Chưa có nhạc nền: tải trong Cài đặt', 'No music yet: upload in Settings'); });
    $$('.js-open').forEach(b => { b.innerHTML = TM.IC.screen; b.title = tt('Mở màn hình trình chiếu', 'Open projection screen'); });
    $$('.js-settings').forEach(b => { if (b.classList.contains('iconbtn')) b.innerHTML = TM.IC.gear; b.title = tt('Cài đặt', 'Settings'); });
    const pb = $('#btnPause'); pb.innerHTML = g.paused ? TM.IC.play : TM.IC.pause; pb.classList.toggle('lit', !!g.paused); pb.title = g.paused ? tt('Tiếp tục', 'Resume') : tt('Tạm dừng', 'Pause'); pb.disabled = !g.created && !g.prac;
    const hb = $('#btnHome'); hb.innerHTML = TM.IC.home; hb.title = tt('Về màn hình chào', 'Back to the welcome screen');
    $('#btnResume').textContent = tt('▶ Tiếp tục', '▶ Resume');
  }
  function renderResultBtns() {
    $('#btnReplayFx').textContent = tt('Phát lại hiệu ứng', 'Replay effects');
    $('#btnPlayAgain').textContent = tt('Chơi lại', 'Play again');
    $('#btnResHome').textContent = tt('Về màn hình chào', 'Back to welcome');
  }

  /* ---------- bảng điều khiển MC (bên phải bảng ô) ---------- */
  function stageLabel() {
    const g = G();
    if (g.prac) return tt('CHƠI THỬ', 'PRACTICE');
    return { main: tt('VÒNG CHÍNH', 'MAIN ROUND'), tie: tt('VÒNG PHỤ', 'TIE-BREAKER'), estimate: tt('ƯỚC LƯỢNG', 'ESTIMATION'), result: tt('KẾT QUẢ', 'RESULT') }[g.stage] || '';
  }
  function hint() {
    const g = G();
    if (g.prac) { const p = g.prac; return p.phase === 'question' ? tt('Chơi thử: bấm Bắt đầu tính giờ, rồi chấm Đúng hoặc Sai. Không tính điểm.', 'Practice: start the timer, then mark Correct or Incorrect. No points.') : p.phase === 'flip' ? fmt(tt('Bấm 2 ô trên bảng: đã lật {n}/2.', 'Click 2 tiles on the board: {n}/2.'), { n: p.picks.length }) : tt('Đang xử lý kết quả…', 'Processing…'); }
    if (g.stage === 'main') {
      const m = g.m;
      if (!m.started) return tt('Chọn đội đi trước rồi bấm BẮT ĐẦU VÒNG CHÍNH.', 'Choose the first team, then press START MAIN ROUND.');
      if (m.phase === 'ended') return tt('Vòng chính đã kết thúc. Đang chốt kết quả…', 'The main round is over. Finalizing…');
      if (m.phase === 'flip') return fmt(tt('{t} đọc số ô, MC bấm ô trên bảng: đã lật {n}/2.', '{t} calls tile numbers, the host clicks them: {n}/2.'), { t: teamName(m.turn), n: m.picks.length });
      if (m.phase === 'resolve') return tt('Đang xử lý kết quả…', 'Processing…');
      if (!m.q) return fmt(tt('Lượt của {t}: chọn một câu hỏi.', "{t}'s turn: pick a question."), { t: teamName(m.turn) });
      if (!m.qOpen) return tt('Bấm BẮT ĐẦU TÍNH GIỜ để hiện câu hỏi và chạy đồng hồ.', 'Press START TIMER to show the question and start the clock.');
      return tt('Chấm ĐÚNG hoặc SAI. “Xem đáp án” chỉ hiện đáp án, không chấm điểm.', 'Mark CORRECT or INCORRECT. “Show answer” only reveals the answer.');
    }
    if (g.stage === 'tie') {
      const t = g.t;
      if (!t.started) return tt('Hai đội hòa điểm. Bấm BẮT ĐẦU VÒNG PHỤ.', 'The teams are tied. Press START TIE-BREAKER.');
      if (t.phase === 'flip') return fmt(tt('{t} lật 2 ô: đã lật {n}/2.', '{t} flips 2 tiles: {n}/2.'), { t: teamName(t.answering), n: t.picks.length });
      if (t.phase !== 'question') return tt('Đang xử lý…', 'Processing…');
      if (!t.q) return tt('Chọn câu hỏi vòng phụ.', 'Pick a tie-breaker question.');
      if (!t.qOpen) return tt('Bấm CÔNG BỐ CÂU HỎI, rồi chọn đội giành quyền trả lời.', 'Press SHOW QUESTION, then select the team that buzzes in.');
      if (t.answering == null) return tt('Chọn đội giành quyền trả lời trước.', 'Select the team that buzzed in first.');
      return fmt(tt('{t} đang trả lời. Chấm ĐÚNG hoặc SAI.', '{t} is answering. Mark CORRECT or INCORRECT.'), { t: teamName(t.answering) });
    }
    if (g.stage === 'estimate') return tt('Công bố câu ước lượng, nhập đáp án hai đội rồi bấm SO SÁNH.', 'Show the estimation question, enter both answers, then press COMPARE.');
    return '';
  }
  function warnLine() {
    const g = G();
    if (syncStatus === 'off') return tt('Mất kết nối máy chủ. Kiểm tra mạng.', 'Server connection lost. Check the network.');
    if (ST().pickMode === 'interactive' && !priv.device.paired && (g.created || g.prac)) return tt('Chế độ cảm ứng: chưa ghép nối màn hình. MC vẫn bấm ô được.', 'Touch mode: no screen paired. The host can still click tiles.');
    return '';
  }
  function renderPanel() {
    const el = $('#panel'); if (!el) return;
    const g = G();
    let h = '<div class="p-head"><b>' + tt('ĐIỀU KHIỂN MC', 'HOST CONTROLS') + '</b><span>' + esc(stageLabel()) + '</span></div><div class="hint">' + esc(hint()) + '</div>';
    const w = warnLine(); if (w) h += '<div class="warn">' + esc(w) + '</div>';
    if (g.prac) h += pracPanel(g);
    else if (g.stage === 'main') h += mainPanel(g);
    else if (g.stage === 'tie') h += tiePanel(g);
    else if (g.stage === 'estimate') h += estPanel(g);
    put(el, h);
    tickPanel();
  }
  // đồng hồ trong bảng điều khiển (cập nhật liên tục, không vẽ lại cả bảng)
  function tickPanel() {
    if (!pub || !sync) return;
    $$('#panel [data-clk]').forEach(e => { const c = pub.clocks[e.dataset.clk]; if (c) e.textContent = TM.fmtMS(sync.remain(c)); });
  }
  function qbtn(ref, label, used, enabled, cur, cls, o) {
    const sel = cur && cur.s === ref.s && cur.i === ref.i;
    return '<button class="' + (used && !sel ? 'used ' : '') + (sel ? 'sel ' : '') + (cls || '') + '" data-act="select" data-s="' + ref.s + '" data-i="' + ref.i + '"' + (enabled && !used || sel ? '' : ' disabled') + ' title="' + esc(qText(o)) + '">' + label + '</button>';
  }
  function preview(ref, qOpen, ansOpen) {
    const o = qObj(ref);
    if (!o) return '<div class="qprev"><div class="ph">' + tt('Chọn câu hỏi để xem nội dung (chỉ MC thấy).', 'Select a question to preview it (host only).') + '</div></div>';
    return '<div class="qprev"><div class="k">' + esc(TM.qLabel(ref)) + '<i class="' + (qOpen ? 'on' : '') + '">' + (qOpen ? tt('ĐANG HIỆN', 'ON SCREEN') : tt('CHƯA HIỆN', 'HIDDEN')) + '</i></div><div class="q">' + esc(qText(o)) + '</div><div class="a">' + tt('Đáp án: ', 'Answer: ') + esc(aText(o) || '—') + '<small>' + (ansOpen ? tt('đã công bố', 'revealed') : tt('chỉ MC thấy', 'host only')) + '</small></div></div>';
  }
  function timerRow(canRun, canReset) {
    const c = pub.clocks.ans;
    return row('', btn(c.running ? 'ansPause' : 'ansResume', c.running ? tt('⏸ Tạm dừng giờ', '⏸ Pause timer') : tt('▶ Chạy tiếp giờ', '▶ Resume timer'), 'btn-ghost', { dis: c.running ? false : !canRun || c.remain <= 0 }) + btn('ansReset', tt('Đặt lại', 'Reset'), 'btn-ghost half', { dis: !canReset }));
  }
  function judgeRow(en, revealDis, revealTitle) {
    return row('l', btn('reveal', tt('XEM ĐÁP ÁN', 'SHOW ANSWER'), 'btn-gold', { dis: revealDis, title: revealTitle }) + btn('judge', tt('ĐÚNG', 'CORRECT'), 'btn-ok' + (en ? ' cta' : ''), { data: { ok: 1 }, dis: !en }) + btn('judge', tt('SAI', 'INCORRECT'), 'btn-no', { data: { ok: 0 }, dis: !en }));
  }
  function flipBlock(st, team) {
    const c = pub.clocks.flip;
    return '<div class="ok-box">' + (team != null ? fmt(tt('Mời {t} lật 2 ô!', '{t}, flip 2 tiles!'), { t: tn(team) }) : tt('Lật 2 ô!', 'Flip 2 tiles!')) + '<small>' + fmt(tt('Bấm vào ô trên bảng bên trái · đã lật {n}/2', 'Click the tiles on the board · {n}/2 flipped'), { n: st.picks.length }) + '</small></div>' +
      row('', btn(c.running ? 'flipPause' : 'flipResume', c.running ? tt('⏸ Tạm dừng giờ lật', '⏸ Pause flip timer') : tt('▶ Chạy tiếp giờ lật', '▶ Resume flip timer'), 'btn-ghost') + btn('flipReset', tt('Đặt lại', 'Reset'), 'btn-ghost half'));
  }
  function mainPanel(g) {
    const m = g.m, S = ST();
    if (!m.started) {
      return '<div><div class="flabel">' + tt('Đội đi trước', 'Team going first') + '</div><div class="seg">' + [0, 1].map(i => '<button data-act="first" data-v="' + i + '" style="--tc:' + esc(teamColor(i)) + '" class="' + (m.first === i ? 'on' : '') + '">' + esc(teamName(i)) + '</button>').join('') + '</div></div>' +
        row('xl', btn('startMain', tt('BẮT ĐẦU VÒNG CHÍNH', 'START MAIN ROUND'), 'btn-primary cta')) +
        '<div class="small">' + fmt(tt('Vòng chính {m} phút · trả lời {a} giây · lật ô {f} giây · ghi nhớ {h} giây. Đổi trong Cài đặt.', 'Main round {m} min · answer {a}s · flip {f}s · memorize {h}s. Change in Settings.'), { m: S.times.main, a: S.times.answer, f: S.times.flip, h: S.times.hold }) + '<br>' +
        fmt(tt('Bộ câu hỏi: {m} câu chính, {b} dự phòng, {t} câu phụ, {e} ước lượng.', 'Questions: {m} main, {b} backup, {t} tie, {e} estimation.'), { m: g.qs.m.length, b: g.qs.b.length, t: g.qs.t.length, e: g.qs.e.length }) + '</div>' +
        '<div class="p-foot">' + row('', btn('shuffle', tt('🔀 Đảo vị trí hình', '🔀 Shuffle Board'))) + '</div>';
    }
    let h = '';
    if (m.phase === 'ended') h += '<div class="ok-box">' + (m.endReason === 'done' ? tt('Đã tìm đủ 8 cặp.', 'All 8 pairs found.') : tt('Hết giờ vòng chính.', 'Main round time is up.')) + '</div>';
    else {
      const pickable = m.phase === 'question' && !m.qOpen, allMain = m.used.m.every(Boolean);
      const uM = m.used.m.filter(Boolean).length, uB = m.used.b.filter(Boolean).length;
      h += '<div class="sec">' + tt('CÂU HỎI', 'QUESTIONS') + '<span>' + fmt(tt('Chính {a}/{n} · Dự phòng {b}/{k}', 'Main {a}/{n} · Backup {b}/{k}'), { a: uM, n: g.qs.m.length, b: uB, k: g.qs.b.length }) + '</span></div>';
      h += '<div class="qg">' + g.qs.m.map((o, i) => qbtn({ s: 'm', i }, TM.pad(i + 1), m.used.m[i], pickable, m.q, '', o)).join('') +
        g.qs.b.map((o, i) => qbtn({ s: 'b', i }, 'B' + (i + 1), m.used.b[i], pickable && allMain, m.q, 'bk', o)).join('') +
        g.qs.x.map((o, i) => qbtn({ s: 'x', i }, '+' + (i + 1), m.used.x[i], pickable, m.q, '', o)).join('') + '</div>';
      if (g.qs.b.length && !allMain) h += '<div class="small">' + tt('Câu dự phòng (B) mở khi dùng hết câu chính.', 'Backup questions (B) unlock after all main questions.') + '</div>';
      h += preview(m.q, m.qOpen, m.ansOpen);
      if (m.phase === 'question') {
        const en = m.qOpen && !m.verdict;
        h += row('xl', btn('open', m.qOpen ? tt('ĐANG TÍNH GIỜ…', 'TIMER RUNNING…') : tt('▶ BẮT ĐẦU TÍNH GIỜ', '▶ START TIMER'), 'btn-primary' + (m.q && !m.qOpen ? ' cta' : ''), { dis: !m.q || m.qOpen }));
        h += timerRow(en, !m.verdict);
        h += judgeRow(en, !en || m.ansOpen);
      } else if (m.phase === 'flip') h += flipBlock(m, m.turn);
      else h += '<div class="ok-box">' + tt('Đang xử lý kết quả…', 'Processing…') + '</div>';
    }
    const mc = g.clocks.main;
    h += '<div class="p-foot"><div class="clk">' + tt('ĐỒNG HỒ VÒNG CHÍNH', 'MAIN ROUND CLOCK') + '<b class="tnum" data-clk="main"></b></div>' +
      row('', btn('mainToggle', mc.running ? tt('Tạm dừng đồng hồ', 'Pause clock') : tt('Tiếp tục đồng hồ', 'Resume clock'), 'btn-ghost', { dis: m.phase === 'ended' || mc.remain <= 0 }) + btn('mainReset', tt('Đặt lại', 'Reset'), 'btn-ghost', { dis: m.phase === 'ended' }) + btn('addExtraDlg', tt('+ Câu bổ sung', '+ Extra question'), 'btn-ghost', { dis: !(m.phase === 'question' && !m.qOpen) })) +
      row('', btn('adjustToggle', adjusting ? tt('Xong chỉnh điểm', 'Done') : tt('Chỉnh điểm', 'Adjust scores'), adjusting ? 'btn-ghost on' : 'btn-ghost') + btn('shuffle', tt('🔀 Đảo hình', '🔀 Shuffle'), 'btn-ghost') + btn('endMain', tt('Kết thúc vòng', 'End round'), 'btn-danger', { dis: m.phase === 'ended' || m.phase === 'resolve' })) + '</div>';
    return h;
  }
  function tiePanel(g) {
    const t = g.t;
    if (!t.started) return '<div class="note-box">' + fmt(tt('Hai đội hòa {a}–{b}. Vòng phụ: bảng 4 ô có đúng 1 cặp. Đội bấm chuông trước được trả lời; đúng thì được lật 2 ô, lật trúng cặp là thắng.', 'Tied at {a}–{b}. Tie-breaker: 4 tiles, exactly one pair. The first team to buzz answers; a correct answer earns 2 flips; finding the pair wins.'), { a: g.m.scores[0], b: g.m.scores[1] }) + '</div>' + row('xl', btn('startTie', tt('BẮT ĐẦU VÒNG PHỤ', 'START TIE-BREAKER'), 'btn-primary cta'));
    let h = '';
    if (t.phase === 'question') {
      const pickable = !t.qOpen, lock = t.wrongTeam != null;
      h += '<div class="sec">' + tt('CÂU HỎI PHỤ', 'TIE-BREAKER QUESTIONS') + '<span>' + fmt(tt('Còn {n} câu', '{n} left'), { n: t.used.filter(u => !u).length }) + '</span></div>';
      h += '<div class="qg" style="grid-template-columns:repeat(6,1fr)">' + g.qs.t.map((o, i) => qbtn({ s: 't', i }, 'P' + (i + 1), t.used[i], pickable, t.q, '', o)).join('') + '</div>';
      h += preview(t.q, t.qOpen, t.ansOpen);
      h += row('xl', btn('open', t.qOpen ? tt('ĐÃ CÔNG BỐ CÂU HỎI', 'QUESTION SHOWN') : tt('▶ CÔNG BỐ CÂU HỎI', '▶ SHOW QUESTION'), 'btn-primary' + (t.q && !t.qOpen ? ' cta' : ''), { dis: !t.q || t.qOpen }));
      h += '<div><div class="flabel">' + tt('Đội giành quyền trả lời', 'Team that buzzed in') + '</div><div class="seg">' + [0, 1].map(i => '<button data-act="claim" data-team="' + i + '" style="--tc:' + esc(teamColor(i)) + '" class="' + (t.answering === i ? 'on' : '') + '"' + (!t.qOpen || t.answering != null || t.tried.includes(i) ? ' disabled' : '') + '>' + esc(teamName(i)) + (t.tried.includes(i) ? ' ✕' : '') + '</button>').join('') + '</div></div>';
      if (lock) h += '<div class="note-box">' + fmt(tt('{a} trả lời sai. {b} được trả lời cùng câu; đáp án vẫn giữ kín.', '{a} was wrong. {b} may answer the same question; the answer stays hidden.'), { a: tn(t.wrongTeam), b: tn(t.answering) }) + '</div>';
      h += timerRow(t.answering != null, true);
      h += judgeRow(t.answering != null, !t.qOpen || t.ansOpen || lock, lock ? tt('Đội còn lại vẫn đang có quyền trả lời', 'The other team still has the right to answer') : '');
      if (lock) h += '<button class="lnk" data-act="reveal">' + tt('Bỏ qua quyền trả lời của đội còn lại và công bố đáp án…', 'Skip the other team’s right and reveal the answer…') + '</button>';
    } else if (t.phase === 'flip') h += flipBlock(t, t.answering);
    else h += '<div class="ok-box">' + (t.phase === 'ended' && g.r ? fmt(tt('{t} thắng vòng phụ!', '{t} wins the tie-breaker!'), { t: tn(g.r.winner) }) : tt('Đang xử lý…', 'Processing…')) + '</div>';
    const tc = g.clocks.tie;
    h += '<div class="p-foot"><div class="clk">' + tt('ĐỒNG HỒ VÒNG PHỤ', 'TIE-BREAKER CLOCK') + '<b class="tnum" data-clk="tie"></b></div>' +
      row('', btn('tieToggle', tc.running ? tt('Tạm dừng đồng hồ', 'Pause clock') : tt('Tiếp tục đồng hồ', 'Resume clock'), 'btn-ghost', { dis: tc.remain <= 0 }) + btn('tieReset', tt('Đặt lại', 'Reset'), 'btn-ghost') + btn('shuffle', tt('🔀 Đảo hình', '🔀 Shuffle'), 'btn-ghost')) +
      row('', btn('toEst', tt('Chuyển sang câu ước lượng', 'Go to estimation'), 'btn-danger', { dis: t.phase === 'resolve' || t.phase === 'ended' })) + '</div>';
    return h;
  }
  function estPanel(g) {
    const E = g.e; let h = '';
    h += '<div class="sec">' + tt('CÂU ƯỚC LƯỢNG', 'ESTIMATION') + '<span>' + fmt(tt('Lần {n}', 'Round {n}'), { n: E.round }) + '</span></div>';
    h += '<div class="seg">' + g.qs.e.map((q, i) => '<button data-act="estPick" data-pi="' + i + '" class="' + (E.pi === i ? 'on' : '') + '" title="' + esc(qText(q)) + '">E' + (i + 1) + '</button>').join('') + '<button data-act="estCustomDlg" class="' + (E.pi < 0 ? 'on' : '') + '">' + tt('Tự nhập', 'Custom') + '</button></div>';
    const qq = TM.lang === 'en' ? (E.q.en || E.q.vi) : (E.q.vi || E.q.en);
    h += '<div class="qprev"><div class="k">' + tt('CÂU ƯỚC LƯỢNG', 'ESTIMATION') + '<i class="' + (E.shown ? 'on' : '') + '">' + (E.shown ? tt('ĐANG HIỆN', 'ON SCREEN') : tt('CHƯA HIỆN', 'HIDDEN')) + '</i></div><div class="q">' + esc(qq || tt('(chưa có nội dung)', '(empty)')) + '</div><div class="a">' + tt('Đáp án chuẩn: ', 'Correct answer: ') + esc(E.correct || '—') + ' ' + esc(E.unit || '') + '<small>' + tt('chỉ MC thấy', 'host only') + '</small></div></div>';
    h += row('l', btn('estShow', E.shown ? tt('ĐÃ CÔNG BỐ CÂU HỎI', 'QUESTION SHOWN') : tt('▶ CÔNG BỐ CÂU HỎI', '▶ SHOW QUESTION'), 'btn-primary' + (E.shown ? '' : ' cta'), { dis: E.shown || !qq }));
    h += [0, 1].map(i => '<div><div class="flabel" style="color:' + esc(teamColor(i)) + '">' + fmt(tt('Đáp án {t}', '{t} answer'), { t: esc(teamName(i)) }) + '</div><input class="mini-in" id="estA' + i + '" inputmode="decimal" value="' + esc(E.a[i]) + '"></div>').join('');
    h += row('l', btn('estCompare', tt('SO SÁNH', 'COMPARE'), 'btn-gold' + (E.shown && !E.result ? ' cta' : '')));
    if (E.result && E.result.winner == null) h += '<div class="note-box">' + tt('Sai lệch bằng nhau: dùng câu ước lượng mới.', 'Equal difference: use a new question.') + '</div>' + row('l', btn('estNew', tt('Câu ước lượng mới', 'New estimation question'), 'btn-gold cta'));
    if (E.result && E.result.winner != null) h += row('xl', btn('announce', tt('🏆 CÔNG BỐ ĐỘI THẮNG', '🏆 ANNOUNCE WINNER'), 'btn-gold cta'));
    return h;
  }
  function pracPanel(g) {
    const p = g.prac; let h = '';
    if (p.phase === 'question') {
      const c = p.clocks.ans;
      h += row('xl', btn(c.running ? 'ansPause' : 'open', c.running ? tt('⏸ Tạm dừng giờ', '⏸ Pause timer') : tt('▶ BẮT ĐẦU TÍNH GIỜ', '▶ START TIMER'), c.running ? 'btn-ghost' : 'btn-primary cta'));
      h += row('', btn('ansReset', tt('Đặt lại giờ', 'Reset timer'), 'btn-ghost'));
      h += row('l', btn('judge', tt('ĐÚNG', 'CORRECT'), 'btn-ok', { data: { ok: 1 } }) + btn('judge', tt('SAI', 'INCORRECT'), 'btn-no', { data: { ok: 0 } }));
    } else if (p.phase === 'flip') h += flipBlock(p, null);
    else h += '<div class="ok-box">' + tt('Đang xử lý…', 'Processing…') + '</div>';
    h += '<div class="p-foot">' + row('', btn('shuffle', tt('Xáo lại bảng thử', 'Reshuffle practice board'), 'btn-ghost')) + row('l', btn('practiceEnd', tt('KẾT THÚC CHƠI THỬ', 'END PRACTICE'), 'btn-gold')) + '</div>';
    return h;
  }

  /* ---------- xử lý nút bấm trên màn hình chơi ---------- */
  document.addEventListener('click', async e => {
    if (!priv || !e.target.closest('#stage')) return;
    const t = e.target, g = G();
    if (t.closest('.js-lang button')) return act('lang', { lang: t.closest('button').dataset.l });
    if (t.closest('.js-music')) { if (!ST().musicUrl) return toast(tt('Chưa có nhạc nền: tải trong Cài đặt.', 'No music yet: upload it in Settings.'), 'err'); return act('music', { playing: !(g.music && g.music.playing) }); }
    if (t.closest('.js-open')) return openPlayer();
    if (t.closest('.js-settings')) return openSp();
    if (t.closest('#btnPause')) return act(g.paused ? 'resume' : 'pause');
    if (t.closest('#btnResume')) return act('resume');
    if (t.closest('#btnHome') || t.closest('#btnResHome')) return act('view', { v: 'welcome' });
    if (t.closest('#btnStart')) { if (matchActive()) return act('view', { v: 'game' }); return newMatchDlg(); }
    if (t.closest('#btnPractice')) return act('practiceStart');
    if (t.closest('#btnPlayAgain')) return newMatchDlg();
    if (t.closest('#btnReplayFx')) return act('replayFx');
    const adj = t.closest('.tcard .adj button');
    if (adj) return act('adjust', { team: +adj.closest('.tcard').dataset.team, d: +adj.dataset.d });
    const b = t.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act, d = b.dataset;
    switch (a) {
      case 'newMatchDlg': return newMatchDlg();
      case 'first': return act('first', { v: +d.v });
      case 'select': return act('select', { s: d.s, i: +d.i });
      case 'judge': return act('judge', { ok: d.ok === '1' });
      case 'claim': return act('claim', { team: +d.team });
      case 'adjustToggle': adjusting = !adjusting; return render();
      case 'estPick': return act('estPick', { pi: +d.pi });
      case 'estCustomDlg': return estCustomDlg();
      case 'estCompare': { const r = await act('estSet', { a0: $('#estA0').value, a1: $('#estA1').value }); if (r) act('estCompare'); return; }
      case 'addExtraDlg': return addExtraDlg();
      case 'shuffle': {
        const started = !g.prac && ((g.stage === 'main' && g.m.started) || (g.stage === 'tie' && g.t && g.t.started));
        if (started) {
          if (!await confirmBox(tt('Đảo vị trí hình', 'Shuffle Board'), tt('Đảo hình sẽ bắt đầu lại vòng hiện tại và xóa tiến độ của vòng. Bạn có muốn tiếp tục?', 'Shuffling restarts the current round and clears its progress. Do you want to continue?'), tt('Đảo hình', 'Shuffle'), true)) return;
          const r = await act('shuffle', { confirm: true }); if (r) toast(tt('Đã đảo hình và bắt đầu lại vòng.', 'Board shuffled and round restarted.'), 'good'); return;
        }
        const r = await act('shuffle'); if (r) toast(tt('Đã đảo vị trí hình.', 'Board shuffled.'), 'good'); return;
      }
      case 'reveal': {
        if (g.stage === 'tie') {
          if (!await confirmBox(tt('Công bố đáp án sớm?', 'Reveal the answer early?'), tt('Công bố đáp án sẽ KẾT THÚC quyền trả lời câu hỏi này của CẢ HAI đội. Tiếp tục?', 'Revealing the answer ENDS the right to answer this question for BOTH teams. Continue?'), tt('Công bố đáp án', 'Reveal answer'), true)) return;
          return act('reveal', { confirm: true });
        }
        return act('reveal');
      }
      case 'endMain': if (await confirmBox(tt('Kết thúc vòng chính?', 'End the main round?'), tt('Đồng hồ vòng chính về 0 và hệ thống xác định kết quả theo điểm hiện tại.', 'The main clock goes to 0 and the result is decided by the current scores.'), tt('Kết thúc', 'End'), true)) act('endMain'); return;
      case 'mainReset': if (await confirmBox(tt('Đặt lại đồng hồ vòng chính?', 'Reset the main clock?'), tt('Đồng hồ vòng chính trở về thời gian ban đầu và dừng lại.', 'The main clock returns to its full time and stops.'), tt('Đặt lại', 'Reset'))) act('mainReset'); return;
      case 'tieReset': if (await confirmBox(tt('Đặt lại đồng hồ vòng phụ?', 'Reset the tie clock?'), tt('Đồng hồ vòng phụ trở về thời gian ban đầu và dừng lại.', 'The tie clock returns to its full time and stops.'), tt('Đặt lại', 'Reset'))) act('tieReset'); return;
      case 'toEst': if (await confirmBox(tt('Chuyển sang câu ước lượng?', 'Go to the estimation question?'), tt('Vòng phụ dừng lại; đội có đáp án ước lượng gần đúng hơn sẽ thắng.', 'The tie-breaker stops; the closer estimate wins.'), tt('Chuyển', 'Go'), true)) act('toEst'); return;
      case 'practiceEnd': case 'startMain': case 'open': case 'ansPause': case 'ansResume': case 'ansReset':
      case 'flipPause': case 'flipResume': case 'flipReset': case 'mainToggle': case 'startTie': case 'tieToggle': case 'estShow': case 'estNew': case 'announce':
        return act(a);
    }
  });

  async function newMatchDlg() {
    const g = G(), S = ST();
    let pf = null; try { pf = await api('/api/admin', { op: 'preflight' }); } catch (e) { pf = null; }
    const running = g.created && g.stage !== 'result' && (g.m.started || g.stage !== 'main');
    let body = '';
    if (running) body += '<div class="warnbox">' + tt('Trận đang chơi sẽ được thay bằng trận mới (điểm và tiến độ hiện tại bị xóa).', 'The current match will be replaced (scores and progress are cleared).') + '</div>';
    if (pf && pf.warnings.length) body += '<div class="warnbox"><b>' + tt('Cần kiểm tra trước khi bắt đầu:', 'Check before starting:') + '</b><ul>' + pf.warnings.map(w => '<li>' + esc(TM.lang === 'en' ? w[1] : w[0]) + '</li>').join('') + '</ul></div>';
    body += '<div class="row g2"><label class="fld"><span>' + tt('Tên đội 1', 'Team 1 name') + '</span><input class="inp" id="nmT0" maxlength="24" value="' + esc(S.teams[0].name) + '"></label><label class="fld"><span>' + tt('Tên đội 2', 'Team 2 name') + '</span><input class="inp" id="nmT1" maxlength="24" value="' + esc(S.teams[1].name) + '"></label></div>';
    body += '<div class="fld"><span>' + tt('Đội đi trước', 'First team') + '</span><select class="inp" id="nmFirst"><option value="0">' + tt('Đội 1', 'Team 1') + '</option><option value="1">' + tt('Đội 2', 'Team 2') + '</option></select></div>';
    if (pf) body += '<p class="note">' + fmt(tt('Bộ câu hỏi: {m} câu chính, {b} dự phòng, {t} câu phụ, {e} ước lượng (các câu đang Bật). Vị trí hình được đảo tự động.', 'Questions: {m} main, {b} backup, {t} tie, {e} estimation (enabled ones). Tile images are shuffled automatically.'), pf.counts) + '</p>';
    let vals = null;
    const ok = await dialog(tt('Trận mới', 'New match'), body, [{ label: tt('Hủy', 'Cancel'), value: false }, { label: tt('Vào trận', 'Enter match'), cls: 'btn-primary', value: true, check: () => { vals = { teams: [$('#nmT0').value.trim() || 'ĐỘI 1', $('#nmT1').value.trim() || 'ĐỘI 2'], first: +$('#nmFirst').value }; return true; } }]);
    if (ok && vals) await act('newMatch', vals);
  }
  async function estCustomDlg() {
    let v = null;
    const ok = await dialog(tt('Tự nhập câu ước lượng', 'Custom estimation question'), '<div class="fld"><span>' + tt('Câu hỏi', 'Question') + '</span><textarea class="inp" id="ecQ"></textarea></div><div class="row g2"><label class="fld"><span>' + tt('Đáp án chuẩn (số)', 'Correct answer (number)') + '</span><input class="inp" id="ecA" inputmode="decimal"></label><label class="fld"><span>' + tt('Đơn vị', 'Unit') + '</span><input class="inp" id="ecU"></label></div>',
      [{ label: tt('Hủy', 'Cancel'), value: false }, { label: tt('Dùng câu này', 'Use it'), cls: 'btn-primary', value: true, check: () => { v = { q: $('#ecQ').value, correct: $('#ecA').value, unit: $('#ecU').value }; if (!v.q.trim()) { toast(tt('Hãy nhập câu hỏi.', 'Enter a question.'), 'err'); return false; } return true; } }]);
    if (ok && v) act('estCustom', v);
  }
  async function addExtraDlg() {
    let v = null;
    const ok = await dialog(tt('Thêm câu hỏi bổ sung', 'Add an extra question'), '<p class="note">' + tt('Dùng khi cần thêm câu ngoài bộ câu của trận. Câu này chỉ dùng cho trận đang chơi.', 'For a question outside this match’s set. It is only used in the current match.') + '</p><div class="fld"><span>' + tt('Câu hỏi', 'Question') + '</span><textarea class="inp" id="xq"></textarea></div><div class="fld"><span>' + tt('Đáp án', 'Answer') + '</span><input class="inp" id="xa"></div>',
      [{ label: tt('Hủy', 'Cancel'), value: false }, { label: tt('Thêm & chọn câu này', 'Add & select'), cls: 'btn-primary', value: true, check: () => { v = { q: $('#xq').value, a: $('#xa').value }; if (!v.q.trim()) { toast(tt('Hãy nhập nội dung câu hỏi.', 'Enter the question text.'), 'err'); return false; } return true; } }]);
    if (ok && v) act('addExtra', v);
  }

  /* ---------- trang cài đặt ---------- */
  let spOpen = false, spTab = 'set';
  function openSp(t) {
    spOpen = true; $('#setPage').hidden = false; document.body.classList.add('sp-on');
    showSp(t || spTab);
  }
  async function closeSp() {
    if (setDirty && !await confirmBox(tt('Bỏ thay đổi chưa lưu?', 'Discard unsaved changes?'), tt('Bạn chưa bấm “Lưu cài đặt”. Quay lại màn hình chính sẽ bỏ các thay đổi này.', 'You have not pressed “Save settings”. Going back discards these changes.'), tt('Bỏ thay đổi', 'Discard'), true)) return;
    if (setDirty) { draft = null; setDirty = false; }
    spOpen = false; $('#setPage').hidden = true; document.body.classList.remove('sp-on');
  }
  function showSp(t) {
    spTab = t;
    $$('#spNav button').forEach(b => b.classList.toggle('on', b.dataset.sp === t));
    $$('.sp-sec').forEach(s => s.classList.toggle('on', s.id === 'sp-' + t));
    renderSp();
  }
  function renderSp() {
    applyStatic();
    if (spTab === 'set') { if (!setDirty) draft = null; renderSet(); }
    if (spTab === 'bank') loadBank();
    if (spTab === 'pick') renderPick();
    if (spTab === 'acc') { renderMe(); if (role === 'admin') loadAcc(); }
    if (spTab === 'his') loadHis();
  }
  // phần cập nhật theo trạng thái trận khi trang cài đặt đang mở
  function renderSpLive() { if (spTab === 'pick') renderPick(); }
  $('#spNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showSp(b.dataset.sp); });
  $('#spClose').addEventListener('click', closeSp);
  $('#btnOpenPlayer2').addEventListener('click', openPlayer);
  addEventListener('keydown', e => { if (e.key === 'Escape' && spOpen && !$('#dlg').classList.contains('show')) closeSp(); });

  /* ---------- màn hình cảm ứng (chế độ chọn ô) ---------- */
  function renderPick() {
    const S = ST(), d = priv.device, inter = S.pickMode === 'interactive';
    const online = d.paired && priv.deviceSeen && (Date.now() - priv.deviceSeen < 20000);
    let h = '<div class="ch"><b>' + tt('Ai bấm chọn ô?', 'Who picks the tiles?') + '</b></div><div class="row">';
    h += '<button class="btn ' + (!inter ? 'btn-primary' : 'btn-ghost') + '" data-pk="present">' + tt('MC bấm ô trên trang MC', 'The host clicks tiles') + '</button>';
    h += '<button class="btn ' + (inter ? 'btn-primary' : 'btn-ghost') + '" data-pk="interactive">' + tt('Người chơi chạm màn hình cảm ứng', 'Players touch a touch screen') + '</button></div>';
    if (inter) {
      h += '<div class="row"><span class="pill ' + (online ? '' : d.paired ? 'poll' : 'off') + '"><i></i>' + (d.paired ? (online ? tt('Màn hình cảm ứng đang kết nối', 'Touch screen connected') : tt('Đã ghép nối, chưa thấy tín hiệu', 'Paired, no signal yet')) : tt('Chưa ghép nối màn hình cảm ứng', 'No touch screen paired')) + '</span></div>';
      h += '<div class="row"><button class="btn btn-primary" data-pk="code">' + (d.paired ? tt('Ghép màn hình khác', 'Pair another screen') : tt('Tạo mã ghép nối', 'Create pairing code')) + '</button><button class="btn btn-danger" data-pk="unpair"' + (d.paired ? '' : ' disabled') + '>' + tt('Hủy ghép nối', 'Unpair') + '</button></div>';
      h += '<p class="note">' + tt('Trên màn hình cảm ứng: mở trang chủ, bấm biểu tượng bàn tay ở góc trên, nhập mã 6 số. Chỉ màn hình đã ghép nối mới chọn được ô, và chỉ khi MC đã chấm Đúng. Các màn hình khác chỉ xem. MC vẫn bấm ô trên trang MC được.', 'On the touch screen: open the home page, press the hand icon at the top, enter the 6-digit code. Only the paired screen can pick, and only after the host marks Correct. Other screens are view-only. The host can still click tiles.') + '</p>';
    } else h += '<p class="note">' + tt('Người chơi đọc số ô, MC bấm ô đó trên bảng của trang MC. Màn hình trình chiếu lật ô ngay.', 'Players call a tile number and the host clicks it on the host page board. The projection screen flips it instantly.') + '</p>';
    put($('#pickV'), h);
  }
  $('#pickV').addEventListener('click', async e => {
    const b = e.target.closest('[data-pk]'); if (!b || b.disabled) return;
    const k = b.dataset.pk;
    if (k === 'present' || k === 'interactive') { await saveSettings({ pickMode: k }, true); renderPick(); return; }
    if (k === 'code') return pairDlg();
    if (k === 'unpair' && await confirmBox(tt('Hủy ghép nối?', 'Unpair?'), tt('Màn hình cảm ứng hiện tại sẽ không chọn ô được nữa.', 'The current touch screen will no longer be able to pick tiles.'), tt('Hủy ghép nối', 'Unpair'), true)) act('unpair');
  });
  async function pairDlg() {
    const r = await act('pairCode'); if (!r || !r.code) return;
    await dialog(tt('Mã ghép nối màn hình cảm ứng', 'Touch screen pairing code'), '<div class="code6">' + esc(r.code) + '</div><p class="note">' + tt('Nhập mã này trên màn hình cảm ứng (biểu tượng bàn tay ở góc trên). Mã dùng được 10 phút. Ghép màn hình mới sẽ thay thế màn hình cũ.', 'Enter this code on the touch screen (hand icon at the top). Valid for 10 minutes. Pairing a new screen replaces the old one.') + '</p>', [{ label: tt('Xong', 'Done'), cls: 'btn-primary', value: true }]);
  }

  /* ---------- tài khoản của tôi ---------- */
  function renderMe() {
    $('#meV').innerHTML = '<div class="ch"><b>' + tt('Tài khoản đang dùng', 'Signed in as') + '</b></div><div class="row"><span style="font-size:17px;font-weight:800">' + esc(user && user.email || '') + '</span><span class="role">' + (role === 'admin' ? 'ADMIN' : 'MC') + '</span><span style="flex:1"></span><button class="btn btn-ghost" data-me="logout">' + tt('Đăng xuất', 'Sign out') + '</button></div>';
  }
  $('#meV').addEventListener('click', e => { if (e.target.closest('[data-me="logout"]')) logout(); });

  /* ---------- cài đặt ---------- */
  async function saveSettings(obj, quiet) {
    try { const r = await api('/api/admin', { op: 'settings', settings: obj }); setState(r); if (!quiet) toast(tt('Đã lưu cài đặt.', 'Settings saved.'), 'good'); return true; }
    catch (e) { toast(e.message, 'err', 5000); return false; }
  }
  function renderSet() {
    if (!priv) return;
    if (!draft) { draft = JSON.parse(JSON.stringify(ST())); setDirty = false; }
    const D = draft, f = (k, label, extra) => '<label><span>' + label + '</span><input class="inp" data-k="' + k + '" value="' + esc(D[k] == null ? '' : D[k]) + '"' + (extra || '') + '></label>';
    const num = (k, label, lo, hi, step) => '<label><span>' + label + '</span><input class="inp" type="number" data-t2="' + k + '" min="' + lo + '" max="' + hi + '" step="' + (step || 1) + '" value="' + esc(D.times[k]) + '"></label>';
    const shoe = i => D.shoes[i] || ('assets/shoes/' + String(i + 1).padStart(2, '0') + '.jpg');
    const slotSel = (arr, idx) => '<select class="inp" data-slot="' + arr + ':' + idx + '">' + Array.from({ length: 15 }, (_, i) => '<option value="' + i + '"' + (D[arr][idx] === i ? ' selected' : '') + '>' + tt('Hình ', 'Image ') + (i + 1) + '</option>').join('') + '</select>';
    let h = '<div class="sec">' + tt('Chương trình', 'Program') + '</div><div class="sgrid">' + f('pname', tt('Tên chương trình', 'Program name'), ' maxlength="40"') + f('taglineVi', tt('Khẩu hiệu (Tiếng Việt)', 'Tagline (Vietnamese)'), ' maxlength="70"') + f('taglineEn', tt('Khẩu hiệu (English)', 'Tagline (English)'), ' maxlength="70"') +
      '<label><span>' + tt('Ngôn ngữ hiển thị', 'Display language') + '</span><select class="inp" data-k="lang"><option value="vi"' + (D.lang === 'vi' ? ' selected' : '') + '>Tiếng Việt</option><option value="en"' + (D.lang === 'en' ? ' selected' : '') + '>English</option></select></label></div>';
    h += '<div class="sec">' + tt('Đội chơi', 'Teams') + '</div><div class="sgrid">' + [0, 1].map(i => '<label><span>' + tt('Tên đội ', 'Team ') + (i + 1) + '</span><input class="inp" data-team="' + i + '" maxlength="24" value="' + esc(D.teams[i].name) + '"></label><label><span>' + tt('Màu đội ', 'Team color ') + (i + 1) + '</span><input class="inp" type="color" data-tcolor="' + i + '" value="' + esc(D.teams[i].color) + '"></label>').join('') + '</div>';
    h += '<div class="sec">' + tt('Thời gian', 'Timing') + '</div><div class="sgrid">' + num('main', tt('Vòng chính (phút)', 'Main round (minutes)'), 1, 90) + num('answer', tt('Trả lời (giây)', 'Answer (seconds)'), 5, 300) + num('flip', tt('Lật ô (giây)', 'Flip (seconds)'), 5, 120) + num('hold', tt('Giữ hai ô sai để ghi nhớ (giây)', 'Hold mismatched tiles (seconds)'), 1, 30) + num('tie', tt('Vòng phụ (phút)', 'Tie-breaker (minutes)'), 0.5, 15, 0.5) + '</div><p class="note">' + tt('Thời gian mới áp dụng cho đồng hồ chưa chạy.', 'New times apply to clocks that are not running.') + '</p>';
    h += '<div class="sec">' + tt('Logo & ảnh nền', 'Logo & backgrounds') + '</div><div class="sgrid">';
    h += '<label><span>' + tt('Logo', 'Logo') + '</span><select class="inp" data-k="logoMode"><option value="default"' + (D.logoMode === 'default' ? ' selected' : '') + '>' + tt('Logo SKECHERS mặc định', 'Default SKECHERS logo') + '</option><option value="custom"' + (D.logoMode === 'custom' ? ' selected' : '') + '>' + tt('Logo tải lên', 'Uploaded logo') + '</option><option value="text"' + (D.logoMode === 'text' ? ' selected' : '') + '>' + tt('Chữ SKECHERS', 'SKECHERS text') + '</option></select><div class="row">' + (D.logoUrl ? '<img src="' + esc(D.logoUrl) + '" style="height:32px;background:#fff;border-radius:6px;padding:3px">' : '') + '<button class="btn btn-ghost sm" data-up="logoUrl" data-kind="image">' + tt('Tải logo', 'Upload logo') + '</button></div></label>';
    h += '<div class="fld"><span>' + tt('Ảnh nền chương trình', 'Program background') + '</span><div class="wide-img" style="background-image:' + esc(TM.cssUrl(D.bgUrl || TM.DEFAULT.bg)) + '"></div><button class="btn btn-ghost sm" data-up="bgUrl" data-kind="image">' + tt('Tải ảnh', 'Upload') + '</button> <button class="btn btn-ghost sm" data-clear="bgUrl">' + tt('Mặc định', 'Default') + '</button></div>';
    h += '<div class="fld"><span>' + tt('Ảnh lộ ra sau các ô đã ghép', 'Image revealed behind matched tiles') + '</span><div class="wide-img" style="background-image:' + esc(TM.cssUrl(D.revUrl || TM.DEFAULT.bg)) + '"></div><button class="btn btn-ghost sm" data-up="revUrl" data-kind="image">' + tt('Tải ảnh', 'Upload') + '</button> <button class="btn btn-ghost sm" data-clear="revUrl">' + tt('Mặc định', 'Default') + '</button></div></div>';
    h += '<div class="sec">' + tt('Hình giày (15 hình)', 'Shoe images (15)') + '</div><div class="imgs">' + Array.from({ length: 15 }, (_, i) => '<div class="imgc"><img src="' + esc(shoe(i)) + '" alt=""><span class="no">' + (i + 1) + '</span><span class="bt"><button data-up="shoe:' + i + '" data-kind="image">' + tt('Đổi', 'Change') + '</button>' + (D.shoes[i] ? '<button data-clear="shoe:' + i + '">↺</button>' : '') + '</span></div>').join('') + '</div>';
    h += '<div class="sec">' + tt('Hình dùng cho từng vòng', 'Images per round') + '</div><div class="sgrid">' + D.mainShoes.map((_, i) => '<label><span>' + tt('Vòng chính – cặp ', 'Main – pair ') + (i + 1) + '</span>' + slotSel('mainShoes', i) + '</label>').join('') + D.tieShoes.map((_, i) => '<label><span>' + (i === 0 ? tt('Vòng phụ – cặp quyết định', 'Tie – decisive pair') : tt('Vòng phụ – hình lẻ ', 'Tie – single image ') + i) + '</span>' + slotSel('tieShoes', i) + '</label>').join('') + '</div>';
    h += '<div class="sec">' + tt('Âm thanh', 'Audio') + '</div><div class="sgrid">';
    h += '<label class="chk"><input type="checkbox" data-b="sfx"' + (D.sfx ? ' checked' : '') + '>' + tt('Hiệu ứng âm thanh', 'Sound effects') + '</label>';
    h += '<label><span>' + tt('Âm lượng hiệu ứng', 'Effects volume') + '</span><input type="range" min="0" max="1" step="0.05" data-r="sfxVol" value="' + D.sfxVol + '"></label>';
    h += '<div class="fld"><span>' + tt('Nhạc nền', 'Background music') + '</span><div class="muted">' + esc(D.musicName || (D.musicUrl ? tt('Đã có nhạc', 'Music set') : tt('Chưa có', 'None'))) + '</div><button class="btn btn-ghost sm" data-up="musicUrl" data-kind="audio">' + tt('Tải nhạc', 'Upload') + '</button> <button class="btn btn-ghost sm" data-clear="musicUrl">' + tt('Xóa', 'Remove') + '</button></div>';
    h += '<label><span>' + tt('Âm lượng nhạc nền', 'Music volume') + '</span><input type="range" min="0" max="1" step="0.05" data-r="musicVol" value="' + D.musicVol + '"></label>';
    h += '<label class="chk"><input type="checkbox" data-b="musicLoop"' + (D.musicLoop ? ' checked' : '') + '>' + tt('Lặp lại nhạc nền', 'Loop music') + '</label>';
    h += '<div class="fld"><span>' + tt('Nhạc chiến thắng', 'Victory music') + '</span><div class="muted">' + esc(D.fanfareName || (D.fanfareUrl ? tt('Đã có nhạc', 'Music set') : tt('Dùng nhạc có sẵn', 'Built-in fanfare'))) + '</div><button class="btn btn-ghost sm" data-up="fanfareUrl" data-kind="audio">' + tt('Tải nhạc', 'Upload') + '</button> <button class="btn btn-ghost sm" data-clear="fanfareUrl">' + tt('Xóa', 'Remove') + '</button></div></div>';
    const SD = D.sounds || {};
    h += '<div class="sec">' + tt('Âm thanh hiệu ứng', 'Sound effects') + '</div><p class="note">' + tt('Chọn tiếng cho từng lúc trong trận. Bấm ▶ để nghe thử trên máy này. Nếu đã tải “Nhạc chiến thắng” ở trên thì nhạc đó được dùng khi chúc mừng.', 'Pick a sound for each moment. Press ▶ to preview on this device. An uploaded victory music replaces the celebration sound.') + '</p><div class="sgrid">';
    h += TM.SOUNDS.map(([k, vi, en, opts]) => { const cur = SD[k] || opts[0][0]; return '<label><span>' + (TM.lang === 'en' ? en : vi) + '</span><div class="row" style="margin:0;flex-wrap:nowrap"><select class="inp" data-snd="' + k + '">' + opts.map(o => '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + esc(TM.lang === 'en' ? o[2] : o[1]) + '</option>').join('') + '<option value="off"' + (cur === 'off' ? ' selected' : '') + '>' + tt('Tắt tiếng', 'Silent') + '</option></select><button class="btn btn-ghost" type="button" data-try="' + k + '" title="' + tt('Nghe thử', 'Preview') + '">▶</button></div></label>'; }).join('') + '</div>';
    h += '<div class="sec">' + tt('Khác', 'Other') + '</div><div class="sgrid">';
    h += '<label class="chk"><input type="checkbox" data-b="motion"' + (D.motion ? ' checked' : '') + '>' + tt('Hiệu ứng chuyển động & pháo hoa', 'Motion & fireworks') + '</label>';
    h += '<label class="chk"><input type="checkbox" data-b="shuffleQ"' + (D.shuffleQ ? ' checked' : '') + '>' + tt('Xáo trộn thứ tự câu hỏi khi tạo trận mới', 'Shuffle question order for new matches') + '</label>';
    h += '</div>';
    h += '<div class="sticky-save"><span class="muted" id="setMsg">' + (setDirty ? tt('Có thay đổi chưa lưu', 'Unsaved changes') : '') + '</span><button class="btn btn-ghost" id="setReset">' + tt('Hoàn tác', 'Discard') + '</button><button class="btn btn-primary" id="setSave">' + tt('Lưu cài đặt', 'Save settings') + '</button></div>';
    $('#setForm').innerHTML = h;
  }
  const tryPlayer = new TM.Sfx();
  function markDirty() { setDirty = true; const m = $('#setMsg'); if (m) m.textContent = tt('Có thay đổi chưa lưu', 'Unsaved changes'); }
  $('#setForm').addEventListener('input', e => {
    const t = e.target, D = draft; if (!D) return;
    if (t.dataset.k) D[t.dataset.k] = t.value;
    else if (t.dataset.t2) D.times[t.dataset.t2] = Number(t.value);
    else if (t.dataset.team) D.teams[+t.dataset.team].name = t.value;
    else if (t.dataset.tcolor) D.teams[+t.dataset.tcolor].color = t.value;
    else if (t.dataset.b) D[t.dataset.b] = t.checked;
    else if (t.dataset.r) D[t.dataset.r] = Number(t.value);
    else if (t.dataset.slot) { const [arr, i] = t.dataset.slot.split(':'); D[arr][+i] = +t.value; }
    else if (t.dataset.snd) { D.sounds = Object.assign({}, D.sounds || {}); D.sounds[t.dataset.snd] = t.value; }
    else return;
    markDirty();
  });
  $('#setForm').addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t || !draft) return;
    if (t.dataset.try) { const id = (draft.sounds || {})[t.dataset.try] || ($('[data-snd="' + t.dataset.try + '"]') || {}).value; tryPlayer.unlock(); tryPlayer.vol = draft.sfxVol == null ? 0.8 : draft.sfxVol; if (id && id !== 'off') setTimeout(() => tryPlayer.play(id), 60); return; }
    if (t.id === 'setSave') { const ok = await saveSettings(draft); if (ok) { draft = null; setDirty = false; renderSet(); } return; }
    if (t.id === 'setReset') { draft = null; setDirty = false; renderSet(); return; }
    if (t.dataset.clear) { const k = t.dataset.clear; if (k.startsWith('shoe:')) draft.shoes[+k.slice(5)] = ''; else { draft[k] = ''; if (k === 'musicUrl') draft.musicName = ''; if (k === 'fanfareUrl') draft.fanfareName = ''; } markDirty(); renderSet(); return; }
    if (t.dataset.up) {
      const k = t.dataset.up, kind = t.dataset.kind;
      const file = await pickFile(kind === 'audio' ? 'audio/*,.mp3,.wav,.ogg,.m4a' : 'image/*');
      if (!file) return;
      try {
        t.disabled = true; t.textContent = tt('Đang tải…', 'Uploading…');
        const url = await upload(file, kind);
        if (k.startsWith('shoe:')) draft.shoes[+k.slice(5)] = url; else draft[k] = url;
        if (k === 'logoUrl') draft.logoMode = 'custom';
        if (k === 'musicUrl') draft.musicName = file.name; if (k === 'fanfareUrl') draft.fanfareName = file.name;
        markDirty(); renderSet(); toast(tt('Đã tải lên. Bấm “Lưu cài đặt” để áp dụng.', 'Uploaded. Press “Save settings” to apply.'), 'good');
      } catch (err) { toast(err.message, 'err', 6000); renderSet(); }
    }
  });
  function pickFile(accept) {
    return new Promise(res => { const inp = $('#fileIn'); inp.value = ''; inp.accept = accept; inp.onchange = () => res(inp.files && inp.files[0] || null); inp.click(); });
  }
  async function upload(file, kind) {
    const max = kind === 'audio' ? 25e6 : 8e6;
    if (file.size > max) throw new Error(tt('Tệp quá lớn (tối đa ', 'File too large (max ') + Math.round(max / 1e6) + 'MB).');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const r = await api('/api/admin', { op: 'uploadUrl', kind, ext, contentType: file.type });
    let resp;
    if (r.form) { const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', file); resp = await fetch(r.uploadUrl, { method: r.method || 'PUT', body: fd }); }
    else resp = await fetch(r.uploadUrl, { method: r.method || 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    if (!resp.ok) throw new Error(tt('Tải tệp thất bại (', 'Upload failed (') + resp.status + ').');
    return r.publicUrl;
  }

  /* ---------- ngân hàng câu hỏi ---------- */
  const GRP = () => ({ main: tt('Vòng chính', 'Main'), backup: tt('Dự phòng', 'Backup'), tie: tt('Vòng phụ', 'Tie-breaker'), est: tt('Ước lượng', 'Estimation') });
  async function loadBank() {
    try { const r = await api('/api/admin', { op: 'q.list' }); bank = r.questions || []; canEdit = !!r.canEdit; } catch (e) { toast(e.message, 'err'); bank = bank || []; }
    renderBank();
  }
  function renderBank() {
    if (!bank) { $('#bankV').innerHTML = '<p class="muted">' + tt('Đang tải…', 'Loading…') + '</p>'; return; }
    const G2 = GRP(), f = bankFilter, s = f.q.trim().toLowerCase();
    const list = bank.filter(q => (!f.grp || q.grp === f.grp) && (!s || [q.id, q.q_vi, q.q_en, q.a_vi, q.a_en, q.num].join(' ').toLowerCase().includes(s)));
    let h = '<div class="ch"><b>' + tt('Ngân hàng câu hỏi', 'Question Bank') + '</b><span class="sp"></span>' + (canEdit ? '' : '<span class="muted">' + tt('Chỉ Admin được thêm/sửa/xóa. MC chọn câu hỏi ngay trên màn hình chơi.', 'Only an admin can edit. Hosts pick questions on the game screen.') + '</span>') + '</div>';
    h += '<div class="bankbar"><input class="inp" id="bkQ" placeholder="' + tt('Tìm theo mã, nội dung, đáp án…', 'Search id, text, answer…') + '" value="' + esc(f.q) + '" style="min-width:260px"><select class="inp" id="bkG"><option value="">' + tt('Tất cả nhóm', 'All groups') + '</option>' + Object.keys(G2).map(k => '<option value="' + k + '"' + (f.grp === k ? ' selected' : '') + '>' + G2[k] + '</option>').join('') + '</select><span class="sp" style="flex:1"></span>';
    if (canEdit) h += '<button class="btn btn-primary" data-bk="add">+ ' + tt('Thêm câu hỏi', 'Add question') + '</button><button class="btn btn-ghost" data-bk="import">' + tt('Nhập JSON', 'Import JSON') + '</button>';
    h += '<button class="btn btn-ghost" data-bk="export">' + tt('Xuất JSON', 'Export JSON') + '</button></div>';
    h += '<div class="counts">' + Object.keys(G2).map(k => { const all = bank.filter(q => q.grp === k), on = all.filter(q => q.enabled !== false); return '<span>' + G2[k] + ': <b>' + on.length + '</b> ' + tt('bật', 'on') + ' / ' + all.length + '</span>'; }).join('') + '</div>';
    h += '<p class="note">' + tt('Trận mới sẽ chụp lại các câu đang Bật (theo thứ tự). Sửa ngân hàng không ảnh hưởng trận đang chơi. Số lượng câu không cố định: thêm hoặc tắt câu để thay đổi.', 'A new match snapshots the enabled questions (in order). Editing the bank does not affect the running match. Counts are not fixed: add or disable questions to change them.') + '</p>';
    h += '<label class="chk" style="margin:6px 0 12px"><input type="checkbox" id="bkShuf"' + (ST().shuffleQ ? ' checked' : '') + '>' + tt('Xáo trộn thứ tự câu hỏi khi tạo trận mới (độc lập với đảo vị trí hình)', 'Shuffle question order for new matches (separate from Shuffle Board)') + '</label>';
    h += '<table class="qt"><thead><tr><th>' + tt('Mã', 'ID') + '</th><th>' + tt('Nhóm', 'Group') + '</th><th>' + tt('Câu hỏi', 'Question') + '</th><th>' + tt('Đáp án', 'Answer') + '</th><th>' + tt('Bật', 'On') + '</th><th></th></tr></thead><tbody>';
    h += list.map(q => '<tr class="' + (q.enabled === false ? 'off' : '') + '"><td class="id">' + esc(q.id) + '</td><td><span class="grp g-' + q.grp + '">' + esc(G2[q.grp] || q.grp) + '</span></td><td>' + esc(q.q_vi) + (q.q_en && q.q_en !== q.q_vi ? '<div class="muted">' + esc(q.q_en) + '</div>' : '') + '</td><td>' + (q.grp === 'est' ? esc(q.num) + ' ' + esc(q.unit || '') : esc(q.a_vi) + (q.a_en && q.a_en !== q.a_vi ? '<div class="muted">' + esc(q.a_en) + '</div>' : '')) + '</td><td><button class="sw' + (q.enabled !== false ? ' on' : '') + '" data-bk="toggle" data-id="' + esc(q.id) + '"' + (canEdit ? '' : ' disabled') + ' title="' + tt('Bật/Tắt', 'On/Off') + '"></button></td><td class="act">' + (canEdit ? '<button class="btn btn-ghost sm" data-bk="edit" data-id="' + esc(q.id) + '">' + tt('Sửa', 'Edit') + '</button> <button class="btn btn-danger sm" data-bk="del" data-id="' + esc(q.id) + '">' + tt('Xóa', 'Delete') + '</button>' : '') + '</td></tr>').join('');
    h += '</tbody></table>' + (list.length ? '' : '<p class="muted" style="margin-top:10px">' + tt('Không có câu hỏi phù hợp.', 'No matching questions.') + '</p>');
    $('#bankV').innerHTML = h;
    const qi = $('#bkQ'); if (qi && bankFilter._focus) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }
  $('#bankV').addEventListener('input', e => {
    if (e.target.id === 'bkQ') { bankFilter.q = e.target.value; bankFilter._focus = true; renderBank(); bankFilter._focus = false; }
    if (e.target.id === 'bkG') { bankFilter.grp = e.target.value; renderBank(); }
    if (e.target.id === 'bkShuf') saveSettings({ shuffleQ: e.target.checked });
  });
  $('#bankV').addEventListener('click', async e => {
    const b = e.target.closest('[data-bk]'); if (!b || b.disabled) return;
    const k = b.dataset.bk, q = bank.find(x => x.id === b.dataset.id);
    try {
      if (k === 'add') return editQ(null);
      if (k === 'edit') return editQ(q);
      if (k === 'toggle') { const r = await api('/api/admin', { op: 'q.toggle', id: q.id, enabled: q.enabled === false }); bank = r.questions; renderBank(); return; }
      if (k === 'del') {
        if (!await confirmBox(tt('Xóa câu hỏi?', 'Delete question?'), fmt(tt('Xóa vĩnh viễn câu {id}: “{q}”? Lịch sử các trận đã chơi vẫn được giữ.', 'Permanently delete {id}: “{q}”? Past match history is kept.'), { id: q.id, q: q.q_vi || q.q_en }), tt('Xóa', 'Delete'), true)) return;
        const r = await api('/api/admin', { op: 'q.delete', id: q.id }); bank = r.questions; renderBank(); toast(tt('Đã xóa câu hỏi.', 'Question deleted.'), 'good'); return;
      }
      if (k === 'export') {
        const data = { app: 'think-match', version: 1, exported_at: new Date().toISOString(), questions: bank.map(x => ({ id: x.id, grp: x.grp, q_vi: x.q_vi, q_en: x.q_en, a_vi: x.a_vi, a_en: x.a_en, num: x.num, unit: x.unit, enabled: x.enabled !== false, sort: x.sort })) };
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        a.download = 'think-match-questions-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return;
      }
      if (k === 'import') return importQ();
    } catch (err) { toast(err.message, 'err', 5000); }
  });
  async function editQ(q) {
    const G2 = GRP(), o = q || { grp: bankFilter.grp || 'main', enabled: true };
    const body = '<div class="row g2"><label class="fld"><span>' + tt('Nhóm', 'Group') + '</span><select class="inp" id="eqG">' + Object.keys(G2).map(k => '<option value="' + k + '"' + (o.grp === k ? ' selected' : '') + '>' + G2[k] + '</option>').join('') + '</select></label><label class="fld"><span>' + tt('Thứ tự', 'Order') + '</span><input class="inp" type="number" id="eqS" value="' + esc(o.sort || '') + '" placeholder="' + tt('tự động', 'auto') + '"></label></div>' +
      (q ? '<p class="note">' + tt('Mã câu hỏi: ', 'Question ID: ') + '<b>' + esc(q.id) + '</b> ' + tt('(không đổi)', '(stable)') + '</p>' : '') +
      '<div class="fld"><span>' + tt('Câu hỏi (Tiếng Việt)', 'Question (Vietnamese)') + '</span><textarea class="inp" id="eqQv">' + esc(o.q_vi || '') + '</textarea></div><div class="fld"><span>' + tt('Câu hỏi (English)', 'Question (English)') + '</span><textarea class="inp" id="eqQe">' + esc(o.q_en || '') + '</textarea></div>' +
      '<div id="eqAns" class="row g2"><label class="fld"><span>' + tt('Đáp án (Tiếng Việt)', 'Answer (Vietnamese)') + '</span><input class="inp" id="eqAv" value="' + esc(o.a_vi || '') + '"></label><label class="fld"><span>' + tt('Đáp án (English)', 'Answer (English)') + '</span><input class="inp" id="eqAe" value="' + esc(o.a_en || '') + '"></label></div>' +
      '<div id="eqNum" class="row g2"><label class="fld"><span>' + tt('Đáp án chuẩn (số)', 'Correct answer (number)') + '</span><input class="inp" id="eqN" value="' + esc(o.num || '') + '" inputmode="decimal"></label><label class="fld"><span>' + tt('Đơn vị', 'Unit') + '</span><input class="inp" id="eqU" value="' + esc(o.unit || '') + '"></label></div>' +
      '<label class="chk"><input type="checkbox" id="eqE"' + (o.enabled !== false ? ' checked' : '') + '>' + tt('Bật (dùng cho trận tiếp theo)', 'Enabled (used in the next match)') + '</label><div class="lmsg" id="eqErr"></div>';
    let payload = null;
    const ok = await dialog(q ? tt('Sửa câu hỏi', 'Edit question') : tt('Thêm câu hỏi', 'Add question'), body, [{ label: tt('Hủy', 'Cancel'), value: false }, { label: tt('Lưu', 'Save'), cls: 'btn-primary', value: true, check: () => {
      const grp = $('#eqG').value;
      payload = { id: q ? q.id : '', grp, sort: Number($('#eqS').value) || 0, q_vi: $('#eqQv').value, q_en: $('#eqQe').value, a_vi: $('#eqAv').value, a_en: $('#eqAe').value, num: $('#eqN').value, unit: $('#eqU').value, enabled: $('#eqE').checked };
      if (!payload.q_vi.trim() && !payload.q_en.trim()) { $('#eqErr').textContent = tt('Hãy nhập nội dung câu hỏi.', 'Enter the question text.'); return false; }
      if (grp === 'est' && !payload.num.trim()) { $('#eqErr').textContent = tt('Câu ước lượng cần đáp án chuẩn dạng số.', 'An estimation question needs a numeric answer.'); return false; }
      return true;
    } }], (el) => {
      const sync2 = () => { const est = $('#eqG').value === 'est'; $('#eqAns').style.display = est ? 'none' : ''; $('#eqNum').style.display = est ? '' : 'none'; };
      el.querySelector('#eqG').addEventListener('change', sync2); sync2();
    });
    if (!ok || !payload) return;
    try { const r = await api('/api/admin', { op: 'q.save', q: payload }); bank = r.questions; renderBank(); toast(tt('Đã lưu câu hỏi ', 'Saved question ') + r.question.id + '.', 'good'); }
    catch (err) { toast(err.message, 'err', 5000); editQ(Object.assign({}, q || {}, payload, { id: q ? q.id : undefined })); }
  }
  async function importQ() {
    const file = await pickFile('application/json,.json'); if (!file) return;
    let items;
    try { const data = JSON.parse(await file.text()); items = Array.isArray(data) ? data : data && Array.isArray(data.questions) ? data.questions : null; } catch (e) { items = null; }
    if (!items || !items.length) return toast(tt('Tệp JSON không hợp lệ hoặc không có câu hỏi.', 'The JSON file is invalid or has no questions.'), 'err', 5000);
    const bad = items.findIndex(q => !q || typeof q !== 'object' || !['main', 'backup', 'tie', 'est'].includes(q.grp) || !(String(q.q_vi || '').trim() || String(q.q_en || '').trim()));
    if (bad >= 0) return toast(fmt(tt('Câu số {n} trong tệp thiếu nhóm hợp lệ hoặc nội dung.', 'Item {n} has no valid group or text.'), { n: bad + 1 }), 'err', 6000);
    const G2 = GRP(), cnt = Object.keys(G2).map(k => G2[k] + ': ' + items.filter(q => q.grp === k).length).join(', ');
    const mode = await dialog(tt('Nhập ngân hàng câu hỏi', 'Import question bank'), '<p>' + fmt(tt('Tệp có {n} câu hỏi ({c}).', 'The file has {n} questions ({c}).'), { n: items.length, c: esc(cnt) }) + '</p><p><b>' + tt('Gộp', 'Merge') + '</b>: ' + tt('thêm mới và cập nhật câu trùng mã, giữ các câu khác.', 'add new ones and update matching IDs, keep the rest.') + '</p><p><b>' + tt('Thay thế toàn bộ', 'Replace all') + '</b>: ' + tt('xóa ngân hàng hiện tại và dùng nội dung tệp. Lịch sử trận đã chơi vẫn được giữ.', 'delete the current bank and use the file. Match history is kept.') + '</p>',
      [{ label: tt('Hủy', 'Cancel'), value: null }, { label: tt('Gộp', 'Merge'), cls: 'btn-primary', value: 'merge' }, { label: tt('Thay thế toàn bộ', 'Replace all'), cls: 'btn-no', value: 'replace' }]);
    if (!mode) return;
    if (mode === 'replace' && !await confirmBox(tt('Ghi đè ngân hàng câu hỏi?', 'Overwrite the question bank?'), fmt(tt('Toàn bộ {n} câu hiện có sẽ bị thay bằng {m} câu trong tệp. Tiếp tục?', 'All {n} current questions will be replaced by the {m} in the file. Continue?'), { n: bank.length, m: items.length }), tt('Ghi đè', 'Overwrite'), true)) return;
    try { const r = await api('/api/admin', { op: 'q.import', items, mode }); bank = r.questions; renderBank(); toast(fmt(tt('Đã nhập {n} câu hỏi.', 'Imported {n} questions.'), { n: r.imported }), 'good'); }
    catch (err) { toast(err.message, 'err', 6000); }
  }

  /* ---------- tài khoản ---------- */
  let staff = null, meId = null;
  async function loadAcc() { try { const r = await api('/api/admin', { op: 'staff.list' }); staff = r.staff; meId = r.me; } catch (e) { toast(e.message, 'err'); } renderAcc(); }
  function renderAcc() {
    if (!staff) { $('#accV').innerHTML = '<p class="muted">' + tt('Đang tải…', 'Loading…') + '</p>'; return; }
    let h = '<div class="ch"><b>' + tt('Tài khoản MC / Admin', 'Host / admin accounts') + '</b></div><p class="note">' + tt('Admin: toàn quyền, quản lý câu hỏi và tài khoản. MC: điều khiển trận, cài đặt chương trình, chọn câu hỏi. Mật khẩu được Supabase lưu dạng mã hóa, không nằm trong mã trang web.', 'Admin: full access, manages questions and accounts. Host: runs the match, edits program settings, picks questions. Passwords are stored hashed by Supabase, never in the website code.') + '</p>';
    h += '<table class="qt"><thead><tr><th>Email</th><th>' + tt('Vai trò', 'Role') + '</th><th></th></tr></thead><tbody>' + staff.map(s => '<tr><td>' + esc(s.email) + (s.user_id === meId ? ' <span class="muted">(' + tt('bạn', 'you') + ')</span>' : '') + '</td><td>' + (s.role === 'admin' ? 'Admin' : 'MC') + '</td><td class="act">' + (s.user_id !== meId ? '<button class="btn btn-danger sm" data-acc="rm" data-id="' + esc(s.user_id) + '" data-email="' + esc(s.email) + '">' + tt('Gỡ quyền', 'Remove') + '</button>' : '') + '</td></tr>').join('') + '</tbody></table>';
    h += '<div class="sec">' + tt('Thêm tài khoản', 'Add account') + '</div><div class="sgrid"><label><span>Email</span><input class="inp" id="acE" type="email" autocomplete="off"></label><label><span>' + tt('Mật khẩu (ít nhất 8 ký tự)', 'Password (at least 8 characters)') + '</span><input class="inp" id="acP" type="password" autocomplete="new-password"></label><label><span>' + tt('Vai trò', 'Role') + '</span><select class="inp" id="acR"><option value="mc">MC</option><option value="admin">Admin</option></select></label></div><div class="row"><button class="btn btn-primary" data-acc="add">' + tt('Thêm tài khoản', 'Add account') + '</button></div><p class="note">' + tt('Nếu email đã có tài khoản Supabase, mật khẩu sẽ được đặt lại theo mật khẩu mới.', 'If the email already has a Supabase account, its password is set to the new one.') + '</p>';
    $('#accV').innerHTML = h;
  }
  $('#accV').addEventListener('click', async e => {
    const b = e.target.closest('[data-acc]'); if (!b) return;
    try {
      if (b.dataset.acc === 'add') { const r = await api('/api/admin', { op: 'staff.add', email: $('#acE').value, password: $('#acP').value, role: $('#acR').value }); staff = r.staff; renderAcc(); toast(tt('Đã thêm tài khoản.', 'Account added.'), 'good'); }
      if (b.dataset.acc === 'rm') { if (!await confirmBox(tt('Gỡ quyền truy cập?', 'Remove access?'), fmt(tt('{e} sẽ không vào được trang MC nữa.', '{e} will no longer be able to use the host page.'), { e: b.dataset.email }), tt('Gỡ quyền', 'Remove'), true)) return; const r = await api('/api/admin', { op: 'staff.remove', user_id: b.dataset.id }); staff = r.staff; renderAcc(); }
    } catch (err) { toast(err.message, 'err', 5000); }
  });

  /* ---------- lịch sử ---------- */
  let matches = null;
  async function loadHis() { try { matches = (await api('/api/admin', { op: 'matches' })).matches || []; } catch (e) { toast(e.message, 'err'); matches = matches || []; } renderHis(); }
  function renderHis() {
    if (!matches) { $('#hisV').innerHTML = '<p class="muted">' + tt('Đang tải…', 'Loading…') + '</p>'; return; }
    let h = '<div class="ch"><b>' + tt('Lịch sử trận đấu', 'Match history') + '</b></div>';
    if (!matches.length) h += '<p class="muted">' + tt('Chưa có trận nào hoàn thành.', 'No finished matches yet.') + '</p>';
    h += matches.map(m => { const d = m.data || {}; return '<details class="his-item"><summary>' + esc(new Date(m.finished_at || d.finishedAt).toLocaleString(TM.lang === 'en' ? 'en-GB' : 'vi-VN')) + ' · ' + esc((d.teams || []).join(' – ')) + ' · ' + esc((d.scores || []).join(' : ')) + ' · ' + tt('Thắng: ', 'Winner: ') + '<b>' + esc(d.winner || '—') + '</b>' + (d.via === 'tie' ? ' (' + tt('vòng phụ', 'tie-breaker') + ')' : '') + '</summary><ol>' + (d.questions || []).map(q => '<li>' + esc(q.q) + ' → <b>' + esc(q.a) + '</b> <span class="muted">' + esc(q.id) + '</span></li>').join('') + '</ol>' + (d.est ? '<p class="note">' + tt('Ước lượng: ', 'Estimation: ') + esc(d.est.q) + ' = ' + esc(d.est.correct) + ' (' + esc((d.est.answers || []).join(' / ')) + ')</p>' : '') + '</details>'; }).join('');
    $('#hisV').innerHTML = h;
  }

  /* ---------- khởi động ---------- */
  applyStatic();
  if (sess && sess.access_token) { role = sess.role || null; enterApp().catch(() => showLogin()); }
  else showLogin();
})();
