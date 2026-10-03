/* THINK & MATCH: màn hình người chơi / trình chiếu.
   Chỉ nhận trạng thái công khai từ máy chủ; không có đáp án chưa công bố, không có vị trí hình ẩn. */
(function () {
  'use strict';
  const { $, $$, esc, fmt, tt, pad } = TM;
  const stage = $('#stage');
  const TOKEN_KEY = 'tm_device_token';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
  };
  let pub = null, status = 'off', token = ls.get(TOKEN_KEY), lastSeq = null, lastGame = null, picking = false, localSound = ls.get('tm_player_sound') !== '0';
  const sfx = new TM.Sfx();
  const fx = TM.makeFx($('#fx'), () => !!(pub && pub.paused), () => sfx.play('boom'));
  const board = new TM.Board($('#board'), onPick);
  const bgm = $('#bgm'), fan = $('#fan');

  /* ---------- khung hình 16:9 ---------- */
  function fit() { const w = innerWidth, h = innerHeight, s = Math.min(w / 1920, h / 1080); stage.style.transform = 'translate(' + ((w - 1920 * s) / 2) + 'px,' + ((h - 1080 * s) / 2) + 'px) scale(' + s + ')'; }
  addEventListener('resize', fit); fit();
  let toastT = 0;
  function toast(msg, kind, ms) { const el = $('#toast'); el.textContent = msg; el.className = 'toast show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'toast'; }, ms || 3200); }

  /* ---------- tên đội và câu chữ ---------- */
  const S = () => (pub && pub.s) || { teams: [{ name: 'ĐỘI 1', color: '#3fb6ff' }, { name: 'ĐỘI 2', color: '#ff5d73' }], times: { answer: 30 } };
  const teamName = i => (S().teams[i] || {}).name || ('ĐỘI ' + (i + 1));
  const teamColor = i => (S().teams[i] || {}).color || '#fff';
  const hasPrefix = n => /^(đội|doi|team)\b/i.test(String(n).trim());
  const tnHTML = i => '<span class="tn" style="--tc:' + esc(teamColor(i)) + '">' + esc(teamName(i)) + '</span>';
  // "Mời đội [Tên đội]" — nếu tên đã bắt đầu bằng "Đội"/"Team" thì không lặp lại chữ đó
  const teamRef = i => (hasPrefix(teamName(i)) ? tnHTML(i) : tt('đội ', 'Team ') + tnHTML(i));
  const q = s => '“' + esc(s || '—') + '”';
  const P = o => TM.pick(o);
  function fmtNum(n) { return (Math.round(n * 1000) / 1000).toLocaleString(TM.lang === 'en' ? 'en-US' : 'vi-VN'); }

  /* ---------- nhận trạng thái ---------- */
  const sync = new TM.Sync({ onState, onStatus: s => { status = s; renderConn(); if (pub) renderBoard(); } });

  function onState(p, prev) {
    pub = p;
    TM.lang = p.s.lang === 'en' ? 'en' : 'vi';
    document.documentElement.lang = TM.lang;
    stage.classList.toggle('no-motion', p.s.motion === false);
    stage.classList.toggle('paused', !!p.paused);
    sfx.on = p.s.sfx !== false && localSound; sfx.vol = p.s.sfxVol == null ? 0.8 : p.s.sfxVol;
    if (p.gameId !== lastGame) { lastGame = p.gameId; lastSeq = null; }
    if (token && p.paired === false) forgetToken(tt('Màn hình này đã bị hủy ghép nối trên trang MC.', 'This screen was unpaired on the host page.'));
    applyBranding();
    show(p.view === 'result' && p.r ? 'result' : p.view === 'game' ? 'game' : 'welcome');
    renderTeams(prev); renderBoard(); renderMsg(); renderEst(); renderResult(); renderClocks(); renderTools(); renderConn();
    effects(p, prev); syncMusic();
  }

  function applyBranding() {
    const s = S();
    $$('.js-logo').forEach(e => { const h = TM.logoHTML(s); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; } });
    $$('.js-pname').forEach(e => { e.textContent = s.pname || 'THINK & MATCH'; });
    $$('.js-tagline').forEach(e => { e.textContent = TM.lang === 'en' ? (s.taglineEn || s.taglineVi || '') : (s.taglineVi || s.taglineEn || ''); });
    const bg = TM.cssUrl(TM.bgOf(s)), rv = TM.cssUrl(TM.revOf(s));
    $$('.js-bg').forEach(e => { if (e.style.backgroundImage !== bg) e.style.backgroundImage = bg; });
    $$('.js-reveal').forEach(e => { if (e.style.backgroundImage !== rv) e.style.backgroundImage = rv; });
    $$('.js-shoe').forEach(e => { const u = (s.shoes || [])[+e.dataset.slot]; if (u && e.getAttribute('src') !== u) e.src = u; });
    const w = $('#welcome .w-title'), n = (s.pname || '').length; w.style.fontSize = (n > 14 ? Math.max(80, Math.round(176 * 14 / n)) : 176) + 'px';
    $('#pausedBig').textContent = tt('TẠM DỪNG', 'PAUSED');
    $('#pausedSub').textContent = tt('Chờ MC tiếp tục trận đấu', 'Waiting for the host to resume');
  }
  let screen = '';
  function show(id) { if (screen === id) return; screen = id; $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }

  /* ---------- đội & điểm ---------- */
  function curTeam() {
    const m = pub && pub.msg; if (!m) return null;
    if (m.k === 'main' && m.phase !== 'ended') return m.team;
    if (m.k === 'tie') return m.answering;
    return null;
  }
  function renderTeams(prev) {
    const cur = curTeam(), prac = pub.mode === 'practice';
    $$('.tcard').forEach(el => {
      const i = +el.dataset.t;
      el.style.setProperty('--tc', teamColor(i));
      el.querySelector('.nm b').textContent = teamName(i);
      el.querySelector('.nm span').textContent = pub.stage === 'tie' ? tt('ĐANG TRẢ LỜI', 'ANSWERING') : tt('ĐANG CHƠI', 'NOW PLAYING');
      el.classList.toggle('cur', !prac && cur === i);
      el.querySelector('.sc').textContent = prac ? '–' : pub.scores[i];
      if (prev && prev.gameId === pub.gameId && !prac && prev.scores && pub.scores[i] > prev.scores[i]) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
  }

  /* ---------- bảng ô ---------- */
  function canTouch() { return !!(pub && pub.s.pickMode === 'interactive' && token && sync.connected()); }
  function renderBoard() {
    const b = pub.board;
    stage.classList.toggle('locked', !!(b && b.pickable && pub.s.pickMode === 'interactive' && token && !sync.connected()));
    board.update(b ? Object.assign({}, b, { pickable: b.pickable && canTouch() && !picking }) : null, pub.gameId + ':' + pub.mode + ':' + pub.stage, TM.revOf(pub.s));
    const main = b && b.kind === 'main';
    $('#pairs').style.display = main ? 'flex' : 'none';
    if (main) $('#pairs').innerHTML = '<span>' + fmt(tt('Đã tìm thấy {n}/8 cặp', 'Pairs found: {n}/8'), { n: pub.found }) + '</span>' + Array.from({ length: 8 }, (_, i) => '<i class="' + (i < pub.found ? 'f' : '') + '"></i>').join('');
    const cap = $('#smallCap'); cap.style.display = b && b.kind === 'small' ? 'block' : 'none';
    cap.textContent = pub.mode === 'practice' ? tt('Bảng chơi thử: không tính điểm', 'Practice board: no points') : tt('Cặp hình quyết định: 4 ô, đúng 1 cặp', 'Decisive Pair: 4 tiles, exactly one pair');
  }
  async function onPick(i, retried) {
    if (!canTouch() || picking) return;
    picking = true; renderBoard(); sfx.unlock();
    try {
      const r = await TM.api('/api/device', { op: 'pick', token, i, v: pub.v });
      if (r && r.pub) sync.apply(r.pub, true);
    } catch (e) {
      if (e.status === 409 && !retried) { picking = false; await sync.refresh(); const t = pub.board && pub.board.tiles[i]; if (t && t.s === 'd' && pub.board.pickable) return onPick(i, true); return; }
      if (e.status === 403 && e.data && /ghép nối|paired/i.test(e.data.error + ' ' + e.data.error_en)) forgetToken(e.message);
      else toast(e.message, 'err');
    } finally { picking = false; if (pub) renderBoard(); }
  }

  /* ---------- khung thông báo (bên phải, không che bảng ô) ---------- */
  function tag(text, gold) { return '<div class="tag' + (gold ? ' gold' : '') + '">' + esc(text) + '</div>'; }
  function verdictBlock(x, team, tie) {
    // x: câu hỏi đã chốt hoặc đang lật ô (có verdict). Đáp án chỉ có khi đã công bố.
    let h = '';
    if (x.q) h += '<div class="qt sm">' + esc(P(x.q)) + '</div>';
    const a = P(x.a);
    if (x.verdict === 'correct') {
      h += '<div class="ans ok"><span class="h">' + tt('Chính xác: ', 'Correct: ') + q(a) + '</span></div>';
      h += resultBlock(x.result, team, tie);
    } else if (x.verdict === 'wrong') {
      h += '<div class="ans no"><span class="h">' + tt('Chưa chính xác!', 'Incorrect!') + '</span>' + tt('Đáp án đúng: ', 'The correct answer is: ') + q(a) + '</div>';
    } else if (x.verdict === 'timeout') {
      h += '<div class="ans no"><span class="h">' + tt('Hết giờ trả lời!', 'Time’s up!') + '</span>' + tt('Đáp án đúng: ', 'The correct answer is: ') + q(a) + '</div>';
    } else if (x.verdict === 'bothWrong') {
      h += '<div class="ans no"><span class="h">' + tt('Cả hai đội chưa chính xác!', 'Both teams are incorrect!') + '</span>' + tt('Đáp án đúng: ', 'The correct answer is: ') + q(a) + '</div>';
    } else if (x.verdict === 'revealed') {
      h += '<div class="ans">' + tt('Đáp án: ', 'Answer: ') + q(a) + '</div>';
    }
    return h;
  }
  function resultBlock(result, team, tie) {
    if (result === 'match') return '<div class="res ok">' + tt('GHÉP ĐÚNG!', 'IT’S A MATCH!') + '<small>' + (tie ? fmt(tt('{t} thắng vòng phụ!', '{t} wins the tie-breaker!'), { t: esc(teamName(team)) }) : team == null ? tt('Hai ô trùng khớp', 'The tiles match') : fmt(tt('+1 điểm cho {t}', '+1 point for {t}'), { t: esc(teamName(team)) })) + '</small></div>';
    if (result === 'nomatch') return '<div class="res no">' + tt('KHÔNG TRÙNG KHỚP', 'NOT A MATCH') + '<small>' + tt('Hãy ghi nhớ vị trí hai ô', 'Remember where these tiles are') + '</small></div>';
    if (result === 'fliptimeout') return '<div class="res no">' + tt('HẾT GIỜ LẬT Ô', 'FLIP TIME IS UP') + '<small>' + tt('Không cộng điểm', 'No points') + '</small></div>';
    return '';
  }
  function flipCall(team, picks) {
    const who = team == null ? '' : teamRef(team);
    const line = team == null ? tt('Lật 2 ô!', 'Flip 2 tiles!') : TM.lang === 'en' ? who + ', flip 2 tiles!' : 'Mời ' + who + ' lật 2 ô!';
    return '<div class="call">' + line + '<small>' + fmt(tt('Đã lật {n}/2 ô', '{n}/2 tiles flipped'), { n: picks }) + '</small></div>';
  }
  function getReady(team) { return '<div class="big">' + (TM.lang === 'en' ? 'Get ready, ' + teamRef(team) + '.' : 'Mời ' + teamRef(team) + ' chuẩn bị') + '</div>'; }

  function renderMsg() {
    const el = $('#msgp'), m = pub.msg;
    let h = '';
    if (pub.stage === 'estimate' && pub.est) {
      const E = pub.est;
      h = tag(tt('PHÂN ĐỊNH THẮNG THUA', 'DECIDER'), true) + '<div class="big">' + tt('Câu hỏi ước lượng', 'Estimation question') + '</div>';
      h += '<div class="sub">' + esc({ time: tt('Vòng phụ đã hết giờ.', 'The tie-breaker time is up.'), noq: tt('Đã dùng hết câu hỏi vòng phụ.', 'All tie-breaker questions are used.'), manual: tt('MC chuyển sang câu ước lượng.', 'The host moved to the estimation question.') }[E.why] || '') + '</div>';
      h += '<div class="sub">' + tt('Đội có đáp án gần với đáp án chuẩn hơn sẽ thắng.', 'The team closest to the correct answer wins.') + '</div>';
      if (E.result) h += '<div class="grow"></div><div class="res ok">' + (E.result.winner == null ? tt('Sai lệch bằng nhau', 'Equal difference') : fmt(tt('{t} gần đáp án hơn!', '{t} is closer!'), { t: esc(teamName(E.result.winner)) })) + '</div>';
    } else if (!m) {
      h = tag(S().pname || 'THINK & MATCH') + '<div class="big">' + tt('Chào mừng!', 'Welcome!') + '</div>';
    } else if (m.k === 'prac') {
      h = tag(tt('CHƠI THỬ', 'PRACTICE'), true);
      if (m.phase === 'flip') h += '<div class="ans ok"><span class="h">' + tt('Chính xác!', 'Correct!') + '</span></div>' + flipCall(null, m.picks);
      else if (m.phase === 'resolve') h += '<div class="ans ok"><span class="h">' + tt('Chính xác!', 'Correct!') + '</span></div>' + resultBlock(m.result, null, false);
      else if (m.verdict === 'wrong') h += '<div class="ans no"><span class="h">' + tt('Chưa chính xác!', 'Incorrect!') + '</span></div>';
      else if (m.verdict === 'timeout') h += '<div class="ans no"><span class="h">' + tt('Hết giờ trả lời!', 'Time’s up!') + '</span></div>';
      else h += '<div class="big">' + tt('Lượt chơi thử', 'Practice turn') + '</div><div class="sub">' + tt('Không tính điểm, không ảnh hưởng trận chính.', 'No points; the match is not affected.') + '</div>';
    } else if (m.k === 'ready') {
      h = tag(tt('VÒNG CHÍNH', 'MAIN ROUND')) + getReady(m.first) + '<div class="sub">' + tt('Đội này đi trước. Chờ MC bắt đầu vòng chính.', 'This team goes first. Waiting for the host to start.') + '</div>';
    } else if (m.k === 'main') {
      h = mainMsg(m);
    } else if (m.k === 'over') {
      h = tag(tt('VÒNG CHÍNH', 'MAIN ROUND')) + '<div class="big">' + tt('Kết thúc vòng chính!', 'Main round over!') + '</div>';
      h += '<div class="sub">' + (m.reason === 'done' ? tt('Đã tìm đủ 8 cặp hình.', 'All 8 pairs are found.') : tt('Hết thời gian vòng chính.', 'The main round time is up.')) + '</div>';
      h += '<div class="res ok">' + esc(teamName(0)) + ' ' + pub.scores[0] + ' – ' + pub.scores[1] + ' ' + esc(teamName(1)) + '<small>' + (pub.scores[0] === pub.scores[1] ? tt('Hòa điểm: vào vòng phụ', 'Tied: tie-breaker next') : tt('Đang công bố kết quả…', 'Announcing the result…')) + '</small></div>';
    } else if (m.k === 'tie') {
      h = tieMsg(m);
    }
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }
  function mainMsg(m) {
    let h = '';
    const c = m.cur;
    if (m.phase === 'question') {
      if (c && c.q) {
        h += tag(TM.qLabel(c.ref)) + '<div class="qt">' + esc(P(c.q)) + '</div><div class="grow"></div>';
        if (c.a) h += '<div class="ans">' + tt('Đáp án: ', 'Answer: ') + q(P(c.a)) + '</div>';
        else h += '<div class="next">' + fmt(tt('{t} đang trả lời', '{t} is answering'), { t: tnHTML(m.team) }) + '</div>';
      } else if (!c && m.last) {
        h += tag(TM.qLabel(m.last.ref)) + verdictBlock(m.last, m.last.team, false) + '<div class="grow"></div><div class="next">' + fmt(tt('Lượt tiếp theo: {t}', 'Next turn: {t}'), { t: tnHTML(m.team) }) + '</div>';
      } else {
        h += tag(tt('VÒNG CHÍNH', 'MAIN ROUND')) + getReady(m.team);
      }
    } else if (c) {
      h += tag(TM.qLabel(c.ref)) + (c.q ? '<div class="qt sm">' + esc(P(c.q)) + '</div>' : '');
      h += '<div class="ans ok"><span class="h">' + tt('Chính xác: ', 'Correct: ') + q(P(c.a)) + '</span></div>';
      h += m.phase === 'flip' ? flipCall(m.team, m.picks) : resultBlock(c.result, m.team, false);
    }
    return h;
  }
  function tieMsg(m) {
    let h = tag(tt('VÒNG PHỤ', 'TIE-BREAKER'), true);
    const c = m.cur;
    if (!m.started) return h + '<div class="big">' + tt('Cặp hình quyết định', 'Decisive Pair') + '</div><div class="sub">' + tt('Hai đội hòa điểm. Đội trả lời đúng và lật trúng cặp hình sẽ thắng.', 'The teams are tied. Answer correctly and find the pair to win.') + '</div>';
    if (m.phase === 'question') {
      if (c && c.q) {
        h = tag(TM.qLabel(c.ref), true) + '<div class="qt">' + esc(P(c.q)) + '</div><div class="grow"></div>';
        if (m.answering == null) h += '<div class="call">' + tt('Đội nào giành quyền trả lời?', 'Which team will buzz in?') + '</div>';
        else if (m.wrongTeam != null) h += '<div class="ans no"><span class="h">' + fmt(tt('{t} chưa chính xác!', '{t} is incorrect!'), { t: esc(teamName(m.wrongTeam)) }) + '</span></div><div class="call">' + (TM.lang === 'en' ? teamRef(m.answering) + ', your turn to answer!' : 'Mời ' + teamRef(m.answering) + ' trả lời!') + '</div>';
        else h += '<div class="call">' + fmt(tt('{t} đang trả lời', '{t} is answering'), { t: tnHTML(m.answering) }) + '</div>';
      } else if (!c && m.last) {
        h = tag(TM.qLabel(m.last.ref), true) + verdictBlock(m.last, m.last.team, true) + '<div class="grow"></div><div class="next">' + tt('Chuẩn bị câu hỏi tiếp theo', 'Next question coming up') + '</div>';
      } else {
        h += '<div class="big">' + tt('Chuẩn bị câu hỏi vòng phụ', 'Get ready for the tie-breaker question') + '</div>';
      }
    } else if (c) {
      h = tag(TM.qLabel(c.ref), true) + (c.q ? '<div class="qt sm">' + esc(P(c.q)) + '</div>' : '');
      h += '<div class="ans ok"><span class="h">' + tt('Chính xác: ', 'Correct: ') + q(P(c.a)) + '</span></div>';
      h += m.phase === 'flip' ? flipCall(m.answering, m.picks) : resultBlock(c.result, m.answering, true);
    }
    return h;
  }

  /* ---------- câu ước lượng ---------- */
  function renderEst() {
    const el = $('#est'), on = pub.stage === 'estimate' && !!pub.est && pub.mode !== 'practice';
    el.style.display = on ? 'flex' : 'none'; if (!on) return;
    const E = pub.est, R = E.result;
    const qtxt = E.shown && E.q ? P(E.q) : tt('MC đang chuẩn bị câu hỏi ước lượng…', 'The host is preparing the estimation question…');
    let cols = '';
    if (R) {
      const unit = E.unit ? ' <small>' + esc(E.unit) + '</small>' : '';
      const col = i => '<div class="c' + (R.winner === i ? ' win' : '') + '"><div class="t" style="color:' + esc(teamColor(i)) + '">' + esc(teamName(i)) + '</div><div class="n">' + fmtNum(R.a[i]) + unit + '</div><div class="d">' + fmt(tt('Sai lệch: {d}', 'Difference: {d}'), { d: fmtNum(R.d[i]) }) + '</div></div>';
      cols = '<div class="cols">' + col(0) + '<div class="c std"><div class="t">' + tt('ĐÁP ÁN CHUẨN', 'CORRECT ANSWER') + '</div><div class="n">' + fmtNum(R.c) + unit + '</div><div class="d">&nbsp;</div></div>' + col(1) + '</div>';
    }
    const msg = R ? (R.winner == null ? tt('Sai lệch bằng nhau: dùng câu ước lượng mới', 'Equal difference: a new estimation question is needed') : fmt(tt('{t} gần đáp án chuẩn hơn!', '{t} is closer!'), { t: teamName(R.winner) })) : '';
    const h = '<div class="ql">' + tt('CÂU HỎI ƯỚC LƯỢNG', 'ESTIMATION QUESTION') + (E.round > 1 ? ' · ' + E.round : '') + '</div><div class="qt">' + esc(qtxt) + (E.shown && E.unit && !R ? ' <small>(' + esc(E.unit) + ')</small>' : '') + '</div>' + cols + '<div class="msg">' + esc(msg) + '</div>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ---------- kết quả ---------- */
  function renderResult() {
    if (!pub.r) return;
    const w = pub.r.winner, nm = $('#rTeam');
    nm.textContent = teamName(w); nm.style.color = teamColor(w);
    const len = teamName(w).length; nm.style.fontSize = (len > 10 ? Math.max(90, Math.round(200 * 10 / len)) : 200) + 'px';
    $('#rCong').textContent = tt('CHÚC MỪNG ĐỘI CHIẾN THẮNG', 'CONGRATULATIONS TO THE WINNER');
    $('#rTag').innerHTML = pub.r.via === 'tie' ? '<span>' + tt('Thắng vòng phụ', 'Tie-breaker Winner') + '</span>' : '';
    $('#rCap').textContent = tt('ĐIỂM VÒNG CHÍNH', 'MAIN ROUND SCORES');
    $('#rScores').innerHTML = [0, 1].map(i => '<div class="r-sc' + (i === w ? ' w' : '') + '" style="--tc:' + esc(teamColor(i)) + '"><div class="n">' + esc(teamName(i)) + '</div><div class="s tnum">' + pub.scores[i] + '</div><div class="u">' + tt('điểm', 'pts') + '</div></div>').join('');
    $('#rMsg').textContent = fmt(tt('Cảm ơn bạn đã cùng {n} tạo nên những khoảnh khắc đáng nhớ!', 'Thank you for making {n} unforgettable!'), { n: S().pname || 'THINK & MATCH' });
  }

  /* ---------- đồng hồ ---------- */
  function renderClocks() {
    if (!pub) return;
    const C = pub.clocks, r = c => sync.remain(c);
    const h = $('#hClock'); let lab = '', sub = '', val = '--:--', warn = false, idle = true;
    if (pub.mode === 'practice') { lab = tt('CHƠI THỬ', 'PRACTICE'); sub = tt('Không tính điểm', 'No points'); }
    else if (pub.stage === 'main') { const m = C.main, v = r(m); lab = tt('VÒNG CHÍNH', 'MAIN ROUND'); val = TM.fmtMS(v); idle = !m.running || pub.paused; warn = m.running && v <= 60000; sub = !pub.started ? tt('Chưa bắt đầu', 'Not started') : v <= 0 ? tt('Hết giờ', 'Time up') : pub.paused || !m.running ? tt('Tạm dừng', 'Paused') : tt('Đang chạy', 'Running'); }
    else if (pub.stage === 'tie') { const m = C.tie, v = r(m); lab = tt('VÒNG PHỤ', 'TIE-BREAKER'); val = TM.fmtMS(v); idle = !m.running || pub.paused; warn = m.running && v <= 30000; sub = !(pub.tie && pub.tie.started) ? tt('Chưa bắt đầu', 'Not started') : v <= 0 ? tt('Hết giờ', 'Time up') : pub.paused || !m.running ? tt('Tạm dừng', 'Paused') : tt('Cặp hình quyết định', 'Decisive Pair'); }
    else if (pub.stage === 'estimate') { lab = tt('ƯỚC LƯỢNG', 'ESTIMATION'); sub = tt('Phân định thắng thua', 'Deciding the winner'); }
    $('#hRound').innerHTML = esc(lab) + '<small>' + esc(sub) + '</small>'; $('#hTime').textContent = val;
    h.classList.toggle('warn', warn); h.classList.toggle('idle', idle);
    // ô đồng hồ nhỏ: trả lời / lật ô / ghi nhớ
    const box = $('#tbox'), m = pub.msg; let l = '', v = '—', s = '', cls = 'idle', pct = 0;
    const phase = m && (m.k === 'main' || m.k === 'tie' || m.k === 'prac') ? m.phase : null;
    if (phase === 'flip') { const c = C.flip, x = r(c); l = tt('THỜI GIAN LẬT Ô', 'FLIP TIME'); v = Math.ceil(x / 1000); pct = x / c.total; cls = 'flip' + (x <= 5000 ? ' warn' : ''); s = c.running && !pub.paused ? fmt(tt('Đã lật {n}/2 ô', '{n}/2 tiles flipped'), { n: m.picks }) : tt('Tạm dừng', 'Paused'); }
    else if (phase === 'resolve' && C.hold.running) { const c = C.hold, x = r(c); l = tt('GHI NHỚ', 'MEMORIZE'); v = Math.ceil(x / 1000); pct = x / c.total; cls = ''; s = tt('Hai hình không khớp', 'Tiles do not match'); }
    else if (phase === 'question') {
      const c = C.ans, x = r(c); l = tt('THỜI GIAN TRẢ LỜI', 'ANSWER TIME'); v = Math.ceil(x / 1000); pct = x / c.total;
      if (m.k === 'tie' && m.answering == null) { s = m.cur && m.cur.q ? tt('Chờ đội giành quyền', 'Waiting for a team to buzz in') : ''; cls = 'idle'; }
      else { s = c.running && !pub.paused ? tt('Đang tính giờ', 'Timing') : x <= 0 ? tt('Hết giờ', 'Time up') : x < c.total ? tt('Tạm dừng', 'Paused') : tt('Sẵn sàng', 'Ready'); cls = !c.running && x === c.total ? 'idle' : c.running && x <= 5000 ? 'warn' : ''; }
    } else if (m && m.k === 'ready') { l = tt('THỜI GIAN TRẢ LỜI', 'ANSWER TIME'); v = (S().times || {}).answer || ''; }
    box.className = 'tbox ' + cls; box.querySelector('.l').textContent = l; box.querySelector('.v').textContent = v; box.querySelector('.s').textContent = s;
    box.querySelector('.bar').style.width = Math.max(0, Math.min(1, pct || 0)) * 100 + '%';
  }
  setInterval(renderClocks, 200);

  /* ---------- hiệu ứng & âm thanh theo sự kiện từ máy chủ ---------- */
  function effects(p) {
    const ev = p.ev || { seq: 0, items: [] };
    if (lastSeq === null) { lastSeq = ev.seq; return; } // mở lại màn hình: không phát lại hiệu ứng cũ
    if (ev.seq === lastSeq) return; lastSeq = ev.seq;
    (ev.items || []).forEach(it => {
      const delay = it.at - sync.serverNow();
      if (delay < -4000) return;
      setTimeout(() => playEv(it.type), Math.max(0, delay));
    });
  }
  function stagePoint(el) {
    const sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect(), k = sr.width / 1920;
    return { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + r.height / 2 - sr.top) / k };
  }
  function playEv(type) {
    if (!pub) return;
    if (type === 'win') return celebrate();
    sfx.play(type === 'click' ? 'click' : type);
    if (type === 'match' && pub.s.motion !== false && pub.board) {
      pub.board.tiles.forEach((t, i) => { if (t.s === 'o' && t.w) { const c = board.cellRect(i); if (c) { const pt = stagePoint(c); fx.burst(pt.x, pt.y, 60); } } });
    }
  }
  function celebrate() {
    duckMusic();
    if (pub.s.fanfareUrl) { try { if (fan.getAttribute('src') !== pub.s.fanfareUrl) fan.src = pub.s.fanfareUrl; fan.currentTime = 0; fan.volume = Math.min(1, (pub.s.sfxVol || 0.8) + 0.1); const pr = fan.play(); if (pr && pr.catch) pr.catch(() => sfx.fanfare()); } catch (e) { sfx.fanfare(); } }
    else sfx.fanfare();
    if (pub.s.motion !== false) { fx.fireworks(6500); fx.rain(4000, 5); }
  }
  let ducking = false;
  function duckMusic() { if (bgm.paused) return; ducking = true; let v = bgm.volume; const iv = setInterval(() => { v -= 0.06; if (v <= 0.02) { clearInterval(iv); bgm.pause(); ducking = false; } else bgm.volume = v; }, 60); }
  function syncMusic() {
    const want = !!(pub && pub.music && pub.music.playing && pub.s.musicUrl && localSound && pub.view !== 'result');
    if (!want) { if (!bgm.paused && !ducking) bgm.pause(); return; }
    if (bgm.getAttribute('src') !== pub.s.musicUrl) bgm.src = pub.s.musicUrl;
    bgm.loop = pub.s.musicLoop !== false; if (!ducking) bgm.volume = pub.s.musicVol == null ? 0.5 : pub.s.musicVol;
    if (bgm.paused && !ducking) { const pr = bgm.play(); if (pr && pr.catch) pr.catch(() => showAudioHint(true)); }
  }

  /* ---------- mở khóa âm thanh (trình duyệt yêu cầu một lần chạm) ---------- */
  function showAudioHint(v) { const el = $('#audioHint'); el.textContent = tt('Bấm vào màn hình một lần để bật âm thanh', 'Click the screen once to enable sound'); el.classList.toggle('show', !!v); }
  function unlock() { sfx.unlock(); setTimeout(() => { if (sfx.ready()) showAudioHint(false); syncMusic(); }, 50); }
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  setTimeout(() => { sfx.unlock(); if (!sfx.ready() && localSound) showAudioHint(true); }, 800);

  /* ---------- nút góc trên: âm thanh, toàn màn hình, ghép nối ---------- */
  function renderTools() {
    const snd = $('#btnSound'); snd.innerHTML = localSound ? TM.IC.sOn : TM.IC.sOff; snd.classList.toggle('off', !localSound); snd.title = tt('Âm thanh trên màn hình này', 'Sound on this screen');
    const fs = $$('.js-fs'); fs.forEach(b => { b.innerHTML = TM.IC.fsIn; b.title = tt('Toàn màn hình', 'Fullscreen'); });
    const pb = $('#btnPair'), inter = pub && pub.s.pickMode === 'interactive';
    pb.style.display = inter ? '' : 'none'; pb.innerHTML = TM.IC.touch; pb.classList.toggle('lit', !!token);
    pb.title = token ? tt('Màn hình cảm ứng đã ghép nối', 'Touch screen paired') : tt('Ghép nối màn hình cảm ứng', 'Pair this touch screen');
  }
  $('#btnSound').addEventListener('click', () => { localSound = !localSound; ls.set('tm_player_sound', localSound ? '1' : '0'); if (pub) { sfx.on = pub.s.sfx !== false && localSound; renderTools(); syncMusic(); } });
  $$('.js-fs').forEach(b => b.addEventListener('click', () => TM.toggleFS()));
  addEventListener('dblclick', e => { if (!e.target.closest('button,.modal')) TM.toggleFS(); });

  function renderConn() {
    const el = $('#conn'), dev = !!(token && pub && pub.s.pickMode === 'interactive');
    el.className = 'conn ' + status + (dev ? ' dev' : '');
    $('#connT').textContent = status === 'off' ? tt('Mất kết nối, đang kết nối lại… (tạm khóa chọn ô)', 'Connection lost, reconnecting… (tile picking locked)') : dev ? tt('Màn hình cảm ứng', 'Touch screen') : '';
  }

  /* ---------- ghép nối màn hình cảm ứng (chế độ tương tác) ---------- */
  let code = '';
  function openPair() {
    code = ''; $('#pairErr').textContent = '';
    $('#pairTitle').textContent = tt('Ghép nối màn hình cảm ứng', 'Pair touch screen');
    $('#pairText').textContent = token ? tt('Màn hình này đang được phép chọn ô trong lượt MC cấp quyền.', 'This screen may pick tiles when the host grants a flip.') : tt('Nhập mã 6 số hiển thị trên trang MC (Điều khiển > Chế độ chọn ô > Tạo mã ghép nối). Chỉ một màn hình được ghép nối tại một thời điểm.', 'Enter the 6-digit code from the host page (Controls > Pick mode > Create pairing code). Only one screen can be paired at a time.');
    $('#pairCode').style.display = token ? 'none' : ''; $('#pairPad').style.display = token ? 'none' : '';
    $('#pairGo').style.display = token ? 'none' : ''; $('#pairForget').style.display = token ? '' : 'none';
    $('#pairGo').textContent = tt('Ghép nối', 'Pair'); $('#pairCancel').textContent = tt('Đóng', 'Close'); $('#pairForget').textContent = tt('Hủy ghép nối trên máy này', 'Unpair this screen');
    renderCode(); $('#pairM').classList.add('show');
  }
  function renderCode() { $('#pairCode').textContent = (code + '______').slice(0, 6); }
  $('#pairPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map(k => '<button data-k="' + k + '">' + k + '</button>').join('');
  $('#pairPad').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k; if (k === '⌫') code = code.slice(0, -1); else if (k === '✓') return doPair(); else if (code.length < 6) code += k; renderCode(); });
  addEventListener('keydown', e => { if (!$('#pairM').classList.contains('show') || token) return; if (/^\d$/.test(e.key) && code.length < 6) code += e.key; else if (e.key === 'Backspace') code = code.slice(0, -1); else if (e.key === 'Enter') return doPair(); else if (e.key === 'Escape') return $('#pairM').classList.remove('show'); renderCode(); });
  async function doPair() {
    if (code.length !== 6) { $('#pairErr').textContent = tt('Mã gồm 6 chữ số.', 'The code has 6 digits.'); return; }
    try {
      const r = await TM.api('/api/device', { op: 'pair', code });
      token = r.token; ls.set(TOKEN_KEY, token); $('#pairM').classList.remove('show');
      toast(tt('Đã ghép nối. Màn hình này có thể chọn ô khi MC cấp quyền lật.', 'Paired. This screen can pick tiles when the host grants a flip.'), 'good');
      if (r.pub) sync.apply(r.pub, true);
    } catch (e) { $('#pairErr').textContent = e.message; code = ''; renderCode(); }
  }
  function forgetToken(msg) { token = null; ls.set(TOKEN_KEY, null); if (msg) toast(msg, 'err', 5000); if (pub) { renderTools(); renderBoard(); renderConn(); } }
  $('#btnPair').addEventListener('click', openPair);
  $('#pairGo').addEventListener('click', doPair);
  $('#pairCancel').addEventListener('click', () => $('#pairM').classList.remove('show'));
  $('#pairForget').addEventListener('click', () => { forgetToken(); $('#pairM').classList.remove('show'); });
  setInterval(async () => {
    if (!token) return;
    try { const r = await TM.api('/api/device', { op: 'ping', token }); if (r && r.paired === false) forgetToken(tt('Màn hình này đã bị hủy ghép nối trên trang MC.', 'This screen was unpaired on the host page.')); } catch (e) { /* mất mạng: thử lại lần sau */ }
  }, 8000);
  void pad;
})();
