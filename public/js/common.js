/* THINK & MATCH: phần dùng chung cho trang MC và màn hình người chơi */
(function () {
  'use strict';
  const TM = window.TM = {};
  TM.$ = s => document.querySelector(s);
  TM.$$ = s => Array.from(document.querySelectorAll(s));
  TM.pad = n => String(n).padStart(2, '0');
  TM.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TM.fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  TM.lang = 'vi';
  TM.tt = (vi, en) => (TM.lang === 'en' ? en : vi);
  TM.pick = o => (o ? (TM.lang === 'en' ? (o.en || o.vi || '') : (o.vi || o.en || '')) : '');
  TM.fmtMS = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return TM.pad(Math.floor(s / 60)) + ':' + TM.pad(s % 60); };
  TM.cssUrl = u => (u ? 'url("' + String(u).replace(/["\\\n]/g, '') + '")' : 'none');
  TM.DEFAULT = { logo: 'assets/logo.png', bg: 'assets/bg.jpg' };
  TM.logoHTML = s => {
    if (s.logoMode === 'custom' && s.logoUrl) return '<img src="' + TM.esc(s.logoUrl) + '" alt="logo">';
    if (s.logoMode === 'default') return '<img src="' + TM.DEFAULT.logo + '" alt="SKECHERS">';
    return '<span class="wordmark">SKECHERS</span>';
  };
  TM.bgOf = s => s.bgUrl || TM.DEFAULT.bg;
  TM.revOf = s => s.revUrl || TM.DEFAULT.bg;
  TM.qLabel = ref => {
    if (!ref) return '';
    const n = ref.i + 1;
    return { m: TM.tt('CÂU ', 'QUESTION ') + TM.pad(n), b: TM.tt('DỰ PHÒNG ', 'BACKUP ') + n, x: TM.tt('BỔ SUNG ', 'EXTRA ') + n, t: TM.tt('CÂU PHỤ ', 'TIE Q') + n }[ref.s] || '';
  };

  /* ================= API ================= */
  TM.api = async function (path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    let r;
    try { r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); }
    catch (e) { const err = new Error(TM.tt('Mất kết nối tới máy chủ.', 'Lost connection to the server.')); err.network = true; throw err; }
    let data = null; try { data = await r.json(); } catch (e) { data = null; }
    if (!r.ok) {
      const err = new Error((data && (TM.lang === 'en' ? data.error_en || data.error : data.error)) || ('HTTP ' + r.status));
      err.status = r.status; err.data = data; throw err;
    }
    return data;
  };

  /* ================= đồng bộ trạng thái ================= */
  // Nhận trạng thái công khai qua Supabase Realtime; luôn có vòng hỏi lại định kỳ làm dự phòng.
  TM.Sync = function (opts) {
    const self = this;
    this.pub = null; this.offset = 0; this.rt = false; this.lastOk = 0; this.onState = opts.onState; this.onStatus = opts.onStatus || (() => {});
    let tickKey = '', polling = false, client = null, lastStatus = '';
    this.serverNow = () => Date.now() + self.offset;
    this.remain = c => (!c ? 0 : c.running ? Math.max(0, c.remain - (self.serverNow() - c.at)) : c.remain);
    this.connected = () => (Date.now() - self.lastOk) < (self.rt ? 12000 : 4000);
    this.apply = function (pub, fresh) {
      if (!pub || pub.v == null) return;
      if (fresh && typeof pub.now === 'number') self.offset = pub.now - Date.now();
      self.lastOk = Date.now();
      if (self.pub && pub.v < self.pub.v) return;
      const prev = self.pub; self.pub = pub;
      if (!prev || prev.v !== pub.v || fresh) self.onState(pub, prev);
      status();
    };
    function status() { const s = self.connected() ? (self.rt ? 'live' : 'poll') : 'off'; if (s !== lastStatus) { lastStatus = s; self.onStatus(s); } }
    this.refresh = async function () {
      if (polling) return; polling = true;
      try { self.apply(await TM.api('/api/state'), true); } catch (e) { /* thử lại ở vòng sau */ } finally { polling = false; status(); }
    };
    async function tick() {
      const p = self.pub; if (!p || p.nextDue == null) return;
      if (self.serverNow() < p.nextDue + 40) return;
      const key = p.v + ':' + p.nextDue; if (tickKey === key) return; tickKey = key;
      try { self.apply(await TM.api('/api/state', { op: 'tick' }), true); } catch (e) { tickKey = ''; }
    }
    let lastPoll = 0;
    setInterval(() => {
      status(); tick();
      const gap = self.rt ? 5000 : 1000;
      if (Date.now() - lastPoll >= gap) { lastPoll = Date.now(); self.refresh(); }
    }, 250);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) self.refresh(); });
    window.addEventListener('online', () => self.refresh());
    (async function () {
      self.refresh();
      let cfg = null; try { cfg = await TM.api('/api/config'); } catch (e) { return; }
      if (!cfg || !cfg.realtime) return;
      try {
        await TM.loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
        client = window.supabase.createClient(cfg.realtime.url, cfg.realtime.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        client.channel('tm-public').on('postgres_changes', { event: '*', schema: 'public', table: 'tm_public' }, payload => {
          if (payload && payload.new && payload.new.data) self.apply(payload.new.data, false);
        }).subscribe(st => { self.rt = st === 'SUBSCRIBED'; if (self.rt) { self.lastOk = Date.now(); self.refresh(); } status(); });
        setInterval(() => { if (self.rt) self.lastOk = Math.max(self.lastOk, Date.now() - 6000); }, 3000);
      } catch (e) { self.rt = false; }
    })();
  };
  TM.loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

  /* ================= âm thanh ================= */
  TM.Sfx = function () {
    let ac = null, master = null, fanUntil = 0;
    const self = this; this.on = true; this.vol = 0.8;
    this.unlock = () => { try { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.connect(ac.destination); } if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } };
    this.ready = () => !!ac && ac.state === 'running';
    function tone(f, t0, d, type, vol, f2) { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; const t = ac.currentTime + t0; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05); }
    function noise(t0, d, vol, hp) { if (!ac) return; const b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d | 0), ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length); const s = ac.createBufferSource(); s.buffer = b; const g = ac.createGain(); g.gain.value = vol; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 1800; s.connect(f).connect(g).connect(master); s.start(ac.currentTime + t0); }
    this.play = function (n) {
      if (!self.on || !ac) return; master.gain.value = self.vol;
      switch (n) {
        case 'click': tone(880, 0, 0.06, 'triangle', 0.07); break;
        case 'flip': noise(0, 0.12, 0.12); tone(520, 0, 0.12, 'triangle', 0.08, 780); break;
        case 'tick': tone(1320, 0, 0.09, 'sine', 0.16); break;
        case 'right': case 'start': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.18)); break;
        case 'qopen': [660, 880].forEach((f, i) => tone(f, i * 0.08, 0.18, 'triangle', 0.12)); break;
        case 'reveal': [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.22, 'triangle', 0.12)); break;
        case 'wrong': tone(196, 0, 0.28, 'sawtooth', 0.12, 150); tone(147, 0.25, 0.4, 'sawtooth', 0.12, 110); break;
        case 'timeout': case 'over': tone(440, 0, 0.22, 'square', 0.1); tone(330, 0.24, 0.22, 'square', 0.1); tone(220, 0.48, 0.5, 'sawtooth', 0.12, 180); break;
        case 'match': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.3, 'square', 0.07)); [1047, 1319, 1568].forEach(f => tone(f, 0.45, 0.7, 'triangle', 0.12)); noise(0.4, 0.35, 0.06); break;
        case 'miss': tone(330, 0, 0.18, 'square', 0.07); tone(247, 0.18, 0.32, 'square', 0.07); break;
        case 'boom': noise(0, 0.6, 0.25, 200); tone(90, 0, 0.5, 'sine', 0.25, 40); break;
        case 'shuffle': for (let i = 0; i < 6; i++) noise(i * 0.07, 0.06, 0.08); break;
      }
    };
    this.fanfare = function () {
      if (!self.on || !ac) return; const now = performance.now(); if (now < fanUntil) return; fanUntil = now + 3600; master.gain.value = self.vol;
      [[523, 0, 0.18], [523, 0.2, 0.18], [523, 0.4, 0.18], [659, 0.6, 0.5], [587, 1.15, 0.2], [659, 1.35, 0.2], [784, 1.55, 1.2]].forEach(([f, s, d]) => { tone(f, s, d + 0.1, 'sawtooth', 0.09); tone(f * 2, s, d + 0.1, 'triangle', 0.07); });
      [523, 659, 784, 1047].forEach(f => tone(f, 1.55, 1.6, 'triangle', 0.08)); noise(1.5, 0.8, 0.07);
    };
  };

  /* ================= pháo hoa ================= */
  TM.makeFx = function (cv, isPaused, onBoom) {
    const cx = cv.getContext('2d'); let parts = [], rockets = [], raf = 0, rainUntil = 0, rainRate = 0, fwUntil = 0, nextRocket = 0;
    const W = cv.width, H = cv.height;
    const COLS = ['#ffc83d', '#ffe48a', '#ffffff', '#5fd4ff', '#3fb6ff', '#ff5d73', '#2ee59d', '#ff9f1a'];
    function add(x, y, vx, vy, kind, c) { parts.push({ x, y, vx, vy, kind, w: 8 + Math.random() * 10, h: 5 + Math.random() * 7, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35, c: c || COLS[(Math.random() * COLS.length) | 0], life: 0, max: kind === 'spark' ? 60 + Math.random() * 40 : 160 + Math.random() * 120, wob: Math.random() * 6.28 }); }
    function burst(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 6 + Math.random() * 12; add(x, y, Math.cos(a) * s, Math.sin(a) * s - 8, 'conf'); } start(); }
    function rain(ms, rate) { rainUntil = performance.now() + ms; rainRate = rate; start(); }
    function fireworks(ms) { fwUntil = performance.now() + ms; nextRocket = 0; start(); }
    function explode(x, y) { const c = COLS[(Math.random() * COLS.length) | 0], c2 = COLS[(Math.random() * COLS.length) | 0]; for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283, s = 4 + Math.random() * 5; add(x, y, Math.cos(a) * s, Math.sin(a) * s, 'spark', i % 3 ? c : c2); } if (onBoom) onBoom(); }
    function start() { if (!raf) raf = requestAnimationFrame(step); }
    function stop() { parts = []; rockets = []; rainUntil = 0; fwUntil = 0; }
    function step(t) {
      cx.clearRect(0, 0, W, H);
      if (isPaused && isPaused()) { raf = requestAnimationFrame(step); return; }
      if (t < rainUntil) for (let i = 0; i < rainRate; i++) add(Math.random() * W, -20, (Math.random() - 0.5) * 3, 2 + Math.random() * 4, 'conf');
      if (t < fwUntil && t > nextRocket) { rockets.push({ x: 260 + Math.random() * (W - 520), y: H + 10, vy: -(15 + Math.random() * 5), vx: (Math.random() - 0.5) * 3, ty: 160 + Math.random() * 320 }); nextRocket = t + 380 + Math.random() * 420; }
      rockets = rockets.filter(r => { r.x += r.vx; r.y += r.vy; r.vy += 0.16; cx.fillStyle = '#fff6d0'; cx.beginPath(); cx.arc(r.x, r.y, 3.2, 0, 6.28); cx.fill(); cx.fillStyle = 'rgba(255,200,61,.35)'; cx.fillRect(r.x - 1, r.y, 2, 26); if (r.y <= r.ty || r.vy >= -1) { explode(r.x, r.y); return false; } return true; });
      parts = parts.filter(p => p.life < p.max && p.y < H + 40);
      for (const p of parts) {
        p.life++; const fade = Math.min(1, (p.max - p.life) / 30);
        if (p.kind === 'spark') { p.vy += 0.07; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; cx.globalAlpha = fade; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, 2.6, 0, 6.28); cx.fill(); continue; }
        p.vy += 0.28; p.vx *= 0.985; p.vy = Math.min(p.vy, 7); p.wob += 0.1; p.x += p.vx + Math.sin(p.wob) * 1.2; p.y += p.vy; p.r += p.vr; cx.globalAlpha = fade; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.scale(1, Math.cos(p.wob)); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      }
      cx.globalAlpha = 1;
      if (parts.length || rockets.length || t < rainUntil || t < fwUntil) raf = requestAnimationFrame(step); else { raf = 0; cx.clearRect(0, 0, W, H); }
    }
    return { burst, rain, fireworks, stop };
  };

  /* ================= bảng ô (dùng chung cho màn hình người chơi và trang MC) ================= */
  // Chỉ nhận dữ liệu công khai: ô úp không có ảnh, ô đang mở mới có đường dẫn ảnh.
  TM.Board = function (el, onPick) {
    let cells = [], prev = [], kind = '', gameKey = '', cur = [];
    const self = this;
    function tileHTML(n) { return '<div class="cover"></div><div class="tile"><div class="inner"><div class="face front"><div class="num">' + TM.pad(n) + '</div></div><div class="face back"><div class="img"><img alt="" draggable="false"></div><div class="badge">' + TM.pad(n) + '</div><div class="xmark">' + TM.IC.x + '</div></div></div></div>'; }
    function build(n) {
      el.innerHTML = ''; cells = []; prev = [];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div'); c.className = 'cell'; c.innerHTML = tileHTML(i + 1); c.dataset.i = i;
        c.querySelector('.tile').addEventListener('click', () => {
          const t = cur[i]; if (!t || t.s !== 'd' || !el.classList.contains('pickable')) return;
          if (onPick) onPick(i);
        });
        el.appendChild(c); cells.push(c);
      }
    }
    this.cellRect = i => cells[i] || null;
    this.update = function (board, key, bgUrl) {
      if (!board) { el.style.display = 'none'; return; }
      el.style.display = 'grid';
      const k = board.kind + ':' + board.tiles.length;
      if (k !== kind || key !== gameKey || cells.length !== board.tiles.length) { kind = k; gameKey = key; build(board.tiles.length); }
      el.className = 'board ' + board.kind + (board.pickable ? ' pickable' : '');
      if (board.kind === 'main') el.style.backgroundImage = TM.cssUrl(bgUrl); else el.style.backgroundImage = 'none';
      cur = board.tiles;
      board.tiles.forEach((t, i) => {
        const cell = cells[i], tl = cell.querySelector('.tile'), img = cell.querySelector('.back img'), p = prev[i] || { s: 'd' };
        if (t.s === 'o') {
          cell.classList.remove('gone'); tl.classList.remove('vanish');
          if (img.getAttribute('src') !== t.img) img.src = t.img;
          tl.classList.add('open'); tl.classList.toggle('win', !!t.w); tl.classList.toggle('wrong', !!t.x);
        } else if (t.s === 'g') {
          if (p.s === 'o' && !cell.classList.contains('gone')) {
            tl.classList.add('vanish');
            setTimeout(() => { if (cur[i] && cur[i].s === 'g') { cell.classList.add('gone'); tl.className = 'tile'; img.removeAttribute('src'); } }, 650);
          } else if (!tl.classList.contains('vanish')) { cell.classList.add('gone'); tl.className = 'tile'; img.removeAttribute('src'); }
        } else {
          cell.classList.remove('gone');
          if (tl.classList.contains('open') || tl.classList.contains('vanish')) {
            tl.className = 'tile';
            setTimeout(() => { if (cur[i] && cur[i].s === 'd') img.removeAttribute('src'); }, 850);
          }
        }
      });
      prev = board.tiles;
    };
    void self;
  };

  TM.IC = {
    sOn: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    sOff: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    fsIn: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    note: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    pause: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    play: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
    touch: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 11V5a2 2 0 1 1 4 0v6"/><path d="M13 10a2 2 0 1 1 4 0v2a2 2 0 1 1 4 0v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L5 15a2 2 0 0 1 3-2.6l1 1.1"/></svg>',
    x: '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="rgba(255,255,255,.9)"/><path d="M30 30L70 70M70 30L30 70" stroke="#e2283b" stroke-width="12" stroke-linecap="round"/></svg>',
  };
  TM.toggleFS = function () {
    const d = document, el = d.documentElement;
    try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(() => {}); } } catch (e) { /* trình duyệt chặn: dùng F11 */ }
  };
})();
