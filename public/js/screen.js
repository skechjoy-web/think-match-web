/* THINK & MATCH: màn hình trò chơi dùng chung cho trang MC và màn hình trình chiếu.
   Hai trang dựng cùng một giao diện (màn hình chào, màn hình chơi, kết quả) từ trạng thái công khai của máy chủ.
   Trang MC chỉ thêm các nút điều khiển và bảng điều khiển MC bên phải; màn hình trình chiếu không có nút nào. */
(function () {
  'use strict';
  const { $, $$, esc, fmt, tt } = TM;

  const IC = Object.assign({}, TM.IC, {
    help: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5"/><circle cx="12" cy="18" r=".6" fill="currentColor"/></svg>',
    gear: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    home: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    screen: '<svg class="ic" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  });
  TM.IC = IC;

  // Khung giao diện 1920×1080. host = true: trang MC (có nút điều khiển).
  function markup(host) {
    const H = s => (host ? s : '');
    const P = s => (host ? '' : s);
    return '' +
      '<section id="welcome" class="screen active">' +
        '<div class="bg-photo js-bg"></div><div class="bg-ov"></div>' +
        '<div class="stripes" style="left:-260px;top:-240px"></div><div class="stripes" style="right:-300px;bottom:-320px"></div>' +
        '<div class="speed"><i></i><i></i><i></i></div>' +
        '<div class="w-shoe l2"><img class="js-shoe" data-slot="0" alt=""></div><div class="w-shoe r2"><img class="js-shoe" data-slot="6" alt=""></div>' +
        '<div class="w-shoe l"><img class="js-shoe" data-slot="1" alt=""></div><div class="w-shoe r"><img class="js-shoe" data-slot="13" alt=""></div>' +
        '<div class="w-corner">' +
          H('<div class="lang js-lang"><button data-l="vi">VI</button><button data-l="en">EN</button></div><button class="iconbtn js-music"></button>') +
          P('<button class="iconbtn js-pair" style="display:none"></button>') +
          '<button class="iconbtn js-sound"></button>' +
          H('<button class="iconbtn js-open"></button>') +
          '<button class="iconbtn js-fs"></button>' +
        '</div>' +
        '<div class="center">' +
          '<div class="w-logo brand-logo js-logo"></div><div class="w-title js-pname">THINK &amp; MATCH</div><div class="w-bar"></div><div class="w-tag js-tagline"></div>' +
          H('<div class="w-btns"><button class="btn btn-primary big" id="btnStart"></button><button class="btn btn-ghost mid" id="btnPractice"></button><button class="btn btn-ghost mid js-settings" id="btnSettings"></button></div><div class="w-note" id="wNote"></div>') +
        '</div>' +
      '</section>' +
      '<section id="game" class="screen">' +
        '<div class="bg-photo js-bg"></div><div class="bg-ov"></div><div class="speed"><i></i><i></i><i></i></div>' +
        '<header class="hdr">' +
          '<div class="h-brand"><div class="h-logo brand-logo js-logo"></div><div class="h-sep"></div><div class="h-title js-pname"></div></div>' +
          '<div class="h-clock idle" id="hClock"><div class="rb" id="hRound"></div><div class="ct tnum" id="hTime">--:--</div></div>' +
          '<div class="h-tools">' +
            H('<div class="lang js-lang"><button data-l="vi">VI</button><button data-l="en">EN</button></div><button class="iconbtn js-music"></button>') +
            P('<button class="iconbtn js-pair" style="display:none"></button>') +
            '<button class="iconbtn js-sound"></button>' +
            H('<button class="iconbtn" id="btnPause"></button>') +
            '<button class="iconbtn js-fs"></button>' +
            H('<button class="iconbtn js-open"></button><button class="iconbtn js-settings"></button><button class="iconbtn" id="btnHome"></button>') +
          '</div>' +
        '</header>' +
        '<div class="col" id="col">' +
          '<div class="teambar">' +
            [0, 1].map(i => (i === 1 ? '<div class="tbox idle" id="tbox"><div class="l"></div><div class="v tnum"></div><div class="s"></div><div class="bar"></div></div>' : '') +
              '<div class="tcard" data-team="' + i + '"><div class="nm"><b></b><span></span></div>' + H('<div class="adj"><button data-d="1">+</button><button data-d="-1">−</button></div>') + '<div class="sc tnum">0</div></div>').join('') +
          '</div>' +
          '<div class="barea" id="barea"><div class="board main" id="board"></div><div class="pairs" id="pairs"></div><div class="small-cap" id="smallCap"></div><div class="est" id="est" style="display:none"></div></div>' +
        '</div>' +
        (host ? '<aside class="side panel" id="panel"></aside>' : '<aside class="side msgp" id="msgp"></aside>') +
        '<div class="pauseov"><b class="js-pausedBig"></b><div class="sub js-pausedSub"></div>' + H('<button class="btn btn-primary" id="btnResume"></button>') + '</div>' +
      '</section>' +
      '<section id="result" class="screen">' +
        '<div class="bg-photo js-reveal"></div><div class="bg-ov"></div><div class="rays"></div>' +
        '<div class="r-top"><div class="brand-logo js-logo"></div><div class="pn js-pname"></div></div>' +
        '<div class="r-cong" id="rCong"></div><div class="r-team" id="rTeam"></div><div class="r-tag" id="rTag"></div>' +
        '<div class="r-sc-cap" id="rCap"></div><div class="r-scores" id="rScores"></div><div class="r-msg" id="rMsg"></div>' +
        H('<div class="r-btns"><button class="btn btn-ghost" id="btnReplayFx"></button><button class="btn btn-ghost" id="btnPlayAgain"></button><button class="btn btn-ghost" id="btnResHome"></button></div>') +
      '</section>' +
      '<div class="fxo" id="fxo"></div><canvas id="fx" width="1920" height="1080"></canvas>' +
      '<div class="conn" id="conn"><i></i><span class="t" id="connT"></span></div>' +
      '<div class="audiohint" id="audioHint"></div>' +
      '<div class="toast" id="toast"></div>' +
      '<audio id="bgm" preload="auto"></audio><audio id="fan" preload="auto"></audio>';
  }

  // o: { host, stage, onPick(i), canPick(), soundKey, soundDefault, onRender(pub, prev) }
  TM.Screen = function (o) {
    const host = !!o.host, stage = o.stage;
    stage.innerHTML = markup(host);
    document.body.classList.toggle('host', host);
    const ls = {
      get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
    };
    const self = this;
    let pub = null, status = 'off', lastSeq = null, lastGame = null, screen = '';
    let localSound = (ls.get(o.soundKey) || (o.soundDefault ? '1' : '0')) === '1';
    const sync = o.sync;
    const sfx = new TM.Sfx();
    const fx = TM.makeFx($('#fx'), () => !!(pub && pub.paused), () => sfx.play('boom'));
    const board = new TM.Board($('#board'), i => { if (o.onPick) o.onPick(i); });
    const bgm = $('#bgm'), fan = $('#fan');
    this.sfx = sfx; this.board = board;

    /* ---------- khung hình 16:9 ---------- */
    function fit() { const w = innerWidth, h = innerHeight, s = Math.min(w / 1920, h / 1080); stage.style.transform = 'translate(' + ((w - 1920 * s) / 2) + 'px,' + ((h - 1080 * s) / 2) + 'px) scale(' + s + ')'; }
    addEventListener('resize', fit); fit();
    let toastT = 0;
    this.toast = function (msg, kind, ms) { const el = $('#toast'); el.textContent = msg; el.className = 'toast show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'toast'; }, ms || 3200); };

    /* ---------- tên đội và câu chữ ---------- */
    const S = () => (pub && pub.s) || { teams: [{ name: 'ĐỘI 1', color: '#3fb6ff' }, { name: 'ĐỘI 2', color: '#ff5d73' }], times: { answer: 30 } };
    const teamName = i => (S().teams[i] || {}).name || ('ĐỘI ' + (i + 1));
    const teamColor = i => (S().teams[i] || {}).color || '#fff';
    const hasPrefix = n => /^(đội|doi|team)\b/i.test(String(n).trim());
    const tnHTML = i => '<span class="tn" style="--tc:' + esc(teamColor(i)) + '">' + esc(teamName(i)) + '</span>';
    // "Mời đội [Tên đội]": nếu tên đã bắt đầu bằng "Đội"/"Team" thì không lặp lại chữ đó
    const teamRef = i => (hasPrefix(teamName(i)) ? tnHTML(i) : tt('đội ', 'Team ') + tnHTML(i));
    const q = s => '“' + esc(s || '—') + '”';
    const P = x => TM.pick(x);
    function fmtNum(n) { return (Math.round(n * 1000) / 1000).toLocaleString(TM.lang === 'en' ? 'en-US' : 'vi-VN'); }
    this.teamName = teamName; this.teamColor = teamColor;

    /* ---------- nhận trạng thái ---------- */
    this.update = function (p, prev) {
      pub = p;
      TM.lang = p.s.lang === 'en' ? 'en' : 'vi';
      document.documentElement.lang = TM.lang;
      stage.classList.toggle('no-motion', p.s.motion === false);
      stage.classList.toggle('paused', !!p.paused);
      sfx.on = p.s.sfx !== false && localSound; sfx.vol = p.s.sfxVol == null ? 0.8 : p.s.sfxVol; sfx.map = p.s.sounds || {};
      if (p.gameId !== lastGame) { lastGame = p.gameId; lastSeq = null; }
      applyBranding();
      show(p.view === 'result' && p.r ? 'result' : p.view === 'game' ? 'game' : 'welcome');
      renderTeams(prev); self.renderBoard(); if (!host) renderMsg(); renderEst(); renderResult(); renderClocks(); renderTools(); renderConn();
      effects(p); syncMusic();
      if (o.onRender) o.onRender(p, prev);
    };
    this.setStatus = function (s) { status = s; renderConn(); if (pub) self.renderBoard(); };
    this.screen = () => screen;

    function applyBranding() {
      const s = S();
      $$('.js-logo').forEach(e => { const h = TM.logoHTML(s); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; } });
      $$('.js-pname').forEach(e => { e.textContent = s.pname || 'THINK & MATCH'; });
      $$('.js-tagline').forEach(e => { e.textContent = TM.lang === 'en' ? (s.taglineEn || s.taglineVi || '') : (s.taglineVi || s.taglineEn || ''); });
      const bg = TM.cssUrl(TM.bgOf(s)), rv = TM.cssUrl(TM.revOf(s));
      $$('.js-bg').forEach(e => { if (e.style.backgroundImage !== bg) e.style.backgroundImage = bg; });
      $$('.js-reveal').forEach(e => { if (e.style.backgroundImage !== rv) e.style.backgroundImage = rv; });
      $$('.js-shoe').forEach(e => { const u = (s.shoes || [])[+e.dataset.slot] || ('assets/shoes/' + String(+e.dataset.slot + 1).padStart(2, '0') + '.jpg'); if (e.getAttribute('src') !== u) e.src = u; });
      const w = $('#welcome .w-title'), n = (s.pname || '').length; w.style.fontSize = (n > 14 ? Math.max(80, Math.round(176 * 14 / n)) : 176) + 'px';
      $$('.js-pausedBig').forEach(e => { e.textContent = tt('TẠM DỪNG', 'PAUSED'); });
      $$('.js-pausedSub').forEach(e => { e.textContent = host ? '' : tt('Chờ MC tiếp tục trận đấu', 'Waiting for the host to resume'); });
      document.title = (s.pname || 'THINK & MATCH') + (host ? ' – MC' : ' – SKECHERS');
    }
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
        const i = +el.dataset.team;
        el.style.setProperty('--tc', teamColor(i));
        el.querySelector('.nm b').textContent = teamName(i);
        el.querySelector('.nm span').textContent = pub.stage === 'tie' ? tt('ĐANG TRẢ LỜI', 'ANSWERING') : tt('ĐANG CHƠI', 'NOW PLAYING');
        el.classList.toggle('cur', !prac && cur === i);
        el.querySelector('.sc').textContent = prac ? '–' : pub.scores[i];
        if (prev && prev.gameId === pub.gameId && !prac && prev.scores && pub.scores[i] > prev.scores[i]) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      });
    }

    /* ---------- bảng ô ---------- */
    this.renderBoard = function () {
      if (!pub) return;
      const b = pub.board, can = !!(o.canPick && o.canPick(pub));
      stage.classList.toggle('locked', !!(b && b.pickable && o.lockedWhenOffline && o.lockedWhenOffline(pub)));
      board.update(b ? Object.assign({}, b, { pickable: b.pickable && can }) : null, pub.gameId + ':' + pub.mode + ':' + pub.stage, TM.revOf(pub.s));
      const main = b && b.kind === 'main';
      $('#pairs').style.display = main ? 'flex' : 'none';
      if (main) $('#pairs').innerHTML = '<span>' + fmt(tt('Đã tìm thấy {n}/8 cặp', 'Pairs found: {n}/8'), { n: pub.found }) + '</span>' + Array.from({ length: 8 }, (_, i) => '<i class="' + (i < pub.found ? 'f' : '') + '"></i>').join('');
      const cap = $('#smallCap'); cap.style.display = b && b.kind === 'small' ? 'block' : 'none';
      cap.textContent = pub.mode === 'practice' ? tt('Bảng chơi thử: không tính điểm', 'Practice board: no points') : tt('Cặp hình quyết định: 4 ô, đúng 1 cặp', 'Decisive Pair: 4 tiles, exactly one pair');
    };

    /* ---------- khung thông báo (màn hình trình chiếu, bên phải bảng ô) ---------- */
    function tag(text, gold) { return '<div class="tag' + (gold ? ' gold' : '') + '">' + esc(text) + '</div>'; }
    function verdictBlock(x, team, tie) {
      // Đáp án chỉ có trong dữ liệu khi đã được công bố.
      let h = '';
      if (x.q) h += '<div class="qt sm">' + esc(P(x.q)) + '</div>';
      const a = P(x.a);
      if (x.verdict === 'correct') h += '<div class="ans ok"><span class="h">' + tt('Chính xác: ', 'Correct: ') + q(a) + '</span></div>' + resultBlock(x.result, team, tie);
      else if (x.verdict === 'wrong') h += '<div class="ans no"><span class="h">' + tt('Chưa chính xác!', 'Incorrect!') + '</span>' + tt('Đáp án đúng: ', 'The correct answer is: ') + q(a) + '</div>';
      else if (x.verdict === 'timeout') h += '<div class="ans no"><span class="h">' + tt('Hết giờ trả lời!', 'Time’s up!') + '</span>' + tt('Đáp án đúng: ', 'The correct answer is: ') + q(a) + '</div>';
      else if (x.verdict === 'bothWrong') h += '<div class="ans no"><span class="h">' + tt('Cả hai đội chưa chính xác!', 'Both teams are incorrect!') + '</span>' + tt('Đáp án đúng: ', 'The correct answer is: ') + q(a) + '</div>';
      else if (x.verdict === 'revealed') h += '<div class="ans">' + tt('Đáp án: ', 'Answer: ') + q(a) + '</div>';
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
      if (pub.stage === 'estimate' && pub.est && pub.mode !== 'practice') {
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
      const grid = gridHTML();
      if (grid) { const k = h.indexOf('</div>') + 6; h = h.slice(0, k) + grid + '<div class="mbody">' + h.slice(k) + '</div>'; }
      el.classList.toggle('hasgrid', !!grid);
      if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
    }
    // Bảng số câu hỏi để các đội chọn (chỉ số câu và trạng thái đã dùng, không có nội dung)
    function gridHTML() {
      const G = pub.qgrid; if (!G || pub.mode === 'practice') return '';
      const cur = G.cur, cell = (s, i, label, used, lock, cls) => {
        const sel = cur && cur.s === s && cur.i === i;
        return '<i class="' + (sel ? 'sel ' : used ? 'used ' : lock ? 'lock ' : '') + (cls || '') + '" data-s="' + s + '" data-i="' + i + '">' + label + '</i>';
      };
      let h = '';
      if (G.t) h = G.t.map((u, i) => cell('t', i, 'P' + (i + 1), u)).join('');
      else h = (G.m || []).map((u, i) => cell('m', i, TM.pad(i + 1), u)).join('') + (G.b || []).map((u, i) => cell('b', i, 'B' + (i + 1), u, !G.bOpen, 'bk')).join('') + (G.x || []).map((u, i) => cell('x', i, '+' + (i + 1), u)).join('');
      return '<div class="pgrid' + (G.t ? ' tie' : '') + '">' + h + '</div>';
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
        } else if (c) {
          h += tag(TM.qLabel(c.ref)) + getReady(m.team) + '<div class="sub">' + tt('Câu hỏi sẽ hiện khi MC bắt đầu tính giờ.', 'The question appears when the host starts the timer.') + '</div>';
        } else {
          h += tag(tt('VÒNG CHÍNH', 'MAIN ROUND')) + getReady(m.team) + (pub.qgrid ? '<div class="sub">' + tt('Mời đội chọn một câu hỏi.', 'Please choose a question.') + '</div>' : '');
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
      if (o.onClock) o.onClock(pub);
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
      const motion = pub.s.motion !== false;
      if (type === 'match' && motion && pub.board) {
        pub.board.tiles.forEach((t, i) => { if (t.s === 'o' && t.w) { const c = board.cellRect(i); if (c) { const pt = stagePoint(c); fx.burst(pt.x, pt.y, 60); } } });
        stamp(tt('GHÉP ĐÚNG!', 'IT’S A MATCH!'), 'gold', false);
      }
      if (!motion) return;
      if (type === 'qpick') pickCard();
      else if (type === 'qopen') openCard();
      else if (type === 'right') { stamp(tt('CHÍNH XÁC!', 'CORRECT!'), 'ok', false); fx.burst(760, 470, 90); fx.burst(1160, 470, 90); setTimeout(() => fx.burst(960, 380, 120), 250); fx.rain(2600, 4); }
      else if (type === 'wrong') { stamp(tt('CHƯA CHÍNH XÁC!', 'INCORRECT!'), 'no', true); flash('no'); }
      else if (type === 'timeout') { stamp(tt('HẾT GIỜ!', 'TIME’S UP!'), 'to', true); flash('to'); }
    }
    /* ---------- hiệu ứng lớp phủ (không chặn thao tác bấm) ---------- */
    const fxo = $('#fxo');
    const C0 = { x: 960, y: 560 }, SIDE = { x: 1592, y: 586 };
    const hold = host ? 0.55 : 1;
    function addFx(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; fxo.appendChild(d); return d; }
    function anim(el, frames, ms, done) {
      if (!el.animate) { setTimeout(() => { el.remove(); if (done) done(); }, ms); return; }
      const a = el.animate(frames, { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      a.onfinish = () => { el.remove(); if (done) done(); };
    }
    const at = (p, sc, op, rot) => ({ transform: 'translate(-50%,-50%) translate(' + (p.x - 960) + 'px,' + (p.y - 540) + 'px) scale(' + sc + ') rotate(' + (rot || 0) + 'deg)', opacity: op });
    function srcPoint() {
      const G = pub.qgrid, cur = G && G.cur; if (!cur) return C0;
      const el = host ? $('#panel [data-act=select][data-s="' + cur.s + '"][data-i="' + cur.i + '"]') : $('#msgp .pgrid [data-s="' + cur.s + '"][data-i="' + cur.i + '"]');
      return el ? stagePoint(el) : SIDE;
    }
    function pickCard() {
      const G = pub.qgrid, m = pub.msg; if (!G || !G.cur) return;
      const team = m && (m.k === 'main' ? m.team : null);
      const who = team != null ? (TM.lang === 'en' ? 'Get ready, ' + teamRef(team) + '!' : 'Mời ' + teamRef(team) + ' chuẩn bị') : tt('Chuẩn bị trả lời', 'Get ready to answer');
      const el = addFx('fxcard pick', '<small>' + esc(TM.qLabel(G.cur)) + '</small><b>' + who + '</b>');
      const sp = srcPoint(), T = 2600 * hold + 900;
      anim(el, [at(sp, 0.06, 0.2, -20), Object.assign(at(C0, 1.08, 1, 3), { offset: 0.22 }), Object.assign(at(C0, 1, 1, 0), { offset: 0.3 }), Object.assign(at(C0, 1, 1, 0), { offset: 0.78 }), at(SIDE, 0.25, 0, 0)], T);
    }
    function openCard() {
      let label = '', text = '';
      const m = pub.msg;
      if (pub.stage === 'estimate' && pub.est && pub.est.q) { label = tt('CÂU HỎI ƯỚC LƯỢNG', 'ESTIMATION QUESTION'); text = P(pub.est.q); }
      else if (m && m.cur && m.cur.q) { label = TM.qLabel(m.cur.ref); text = P(m.cur.q); }
      if (!text) return;
      const el = addFx('fxcard q', '<small>' + esc(label) + '</small><b style="font-size:' + (text.length > 140 ? 44 : text.length > 80 ? 52 : 62) + 'px">' + esc(text) + '</b>');
      const T = 3600 * hold + 700;
      anim(el, [Object.assign(at(C0, 0.3, 0, 0), { transform: 'translate(-50%,-50%) translateY(20px) scale(.3) rotateX(70deg)' }), Object.assign(at(C0, 1.05, 1), { offset: 0.14 }), Object.assign(at(C0, 1, 1), { offset: 0.2 }), Object.assign(at(C0, 1, 1), { offset: 0.8 }), at(SIDE, 0.3, 0)], T);
    }
    function stamp(text, kind, shake) {
      const el = addFx('fxstamp ' + kind, esc(text) + (kind === 'no' ? '<span class="xm">' + IC.x + '</span>' : ''));
      const T = 1900 * hold + 500;
      const f = [{ transform: 'translate(-50%,-50%) scale(2.6) rotate(-8deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.92) rotate(-4deg)', opacity: 1, offset: 0.12 }, { transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.18 }];
      if (shake) [-26, 22, -16, 10, 0].forEach((dx, k) => f.push({ transform: 'translate(calc(-50% + ' + dx + 'px),-50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.22 + k * 0.04 }));
      f.push({ transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%) scale(1.15) rotate(-4deg)', opacity: 0 });
      anim(el, f, T);
    }
    function flash(kind) { const el = addFx('fxflash ' + kind, ''); anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0.6, offset: 0.4 }, { opacity: 0 }], 1400); }
    function celebrate() {
      duckMusic();
      if (localSound && pub.s.sfx !== false) {
        if (pub.s.fanfareUrl) { try { if (fan.getAttribute('src') !== pub.s.fanfareUrl) fan.src = pub.s.fanfareUrl; fan.currentTime = 0; fan.volume = Math.min(1, (pub.s.sfxVol || 0.8) + 0.1); const pr = fan.play(); if (pr && pr.catch) pr.catch(() => sfx.fanfare()); } catch (e) { sfx.fanfare(); } }
        else sfx.fanfare();
      }
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
    function showAudioHint(v) { const el = $('#audioHint'); el.textContent = tt('Bấm vào màn hình một lần để bật âm thanh', 'Click the screen once to enable sound'); el.classList.toggle('show', !!v && localSound); }
    function unlock() { sfx.unlock(); setTimeout(() => { if (sfx.ready()) showAudioHint(false); syncMusic(); }, 50); }
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    setTimeout(() => { sfx.unlock(); if (!sfx.ready() && localSound) showAudioHint(true); }, 800);

    /* ---------- nút góc trên: âm thanh, toàn màn hình ---------- */
    function renderTools() {
      $$('.js-sound').forEach(b => { b.innerHTML = localSound ? IC.sOn : IC.sOff; b.classList.toggle('off', !localSound); b.title = tt('Âm thanh trên máy này', 'Sound on this device'); });
      $$('.js-fs').forEach(b => { if (!b.innerHTML) b.innerHTML = IC.fsIn; b.title = tt('Toàn màn hình', 'Fullscreen'); });
      if (o.onTools) o.onTools(pub);
    }
    this.renderTools = renderTools;
    stage.addEventListener('click', e => {
      if (e.target.closest('.js-sound')) {
        localSound = !localSound; ls.set(o.soundKey, localSound ? '1' : '0');
        if (pub) { sfx.on = pub.s.sfx !== false && localSound; renderTools(); syncMusic(); }
        if (localSound) unlock(); else showAudioHint(false);
      } else if (e.target.closest('.js-fs')) TM.toggleFS();
    });
    addEventListener('dblclick', e => { if (!e.target.closest('button,input,textarea,select,.modal,.panel,.board')) TM.toggleFS(); });

    function renderConn() {
      const el = $('#conn'), extra = o.connExtra ? o.connExtra(pub) : '';
      el.className = 'conn ' + status + (extra ? ' dev' : '');
      $('#connT').textContent = status === 'off' ? (o.offlineText ? o.offlineText() : tt('Mất kết nối, đang kết nối lại…', 'Connection lost, reconnecting…')) : extra;
    }
    this.renderConn = renderConn;
  };
})();
