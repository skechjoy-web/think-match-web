/* THINK & MATCH: màn hình trình chiếu (người chơi).
   Dùng chung giao diện với trang MC nhưng không có nút điều khiển.
   Chỉ nhận trạng thái công khai từ máy chủ; không có đáp án chưa công bố, không có vị trí hình ẩn. */
(function () {
  'use strict';
  const { $, tt } = TM;
  const TOKEN_KEY = 'tm_device_token';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
  };
  let pub = null, token = ls.get(TOKEN_KEY), picking = false;

  const sync = new TM.Sync({
    onState: (p, prev) => {
      pub = p;
      if (token && p.paired === false) forgetToken(tt('Màn hình này đã bị hủy ghép nối trên trang MC.', 'This screen was unpaired on the host page.'));
      scr.update(p, prev);
    },
    onStatus: s => scr.setStatus(s),
  });
  const canTouch = () => !!(pub && pub.s.pickMode === 'interactive' && token && sync.connected());
  const scr = new TM.Screen({
    host: false, stage: $('#stage'), sync, soundKey: 'tm_player_sound', soundDefault: true,
    onPick, canPick: () => canTouch() && !picking,
    lockedWhenOffline: p => p.s.pickMode === 'interactive' && !!token && !sync.connected(),
    connExtra: p => (token && p && p.s.pickMode === 'interactive' ? tt('Màn hình cảm ứng', 'Touch screen') : ''),
    offlineText: () => tt('Mất kết nối, đang kết nối lại… (tạm khóa chọn ô)', 'Connection lost, reconnecting… (tile picking locked)'),
    onTools: p => {
      const inter = p && p.s.pickMode === 'interactive';
      document.querySelectorAll('.js-pair').forEach(b => {
        b.style.display = inter ? '' : 'none'; b.innerHTML = TM.IC.touch; b.classList.toggle('lit', !!token);
        b.title = token ? tt('Màn hình cảm ứng đã ghép nối', 'Touch screen paired') : tt('Ghép nối màn hình cảm ứng', 'Pair this touch screen');
      });
    },
  });

  async function onPick(i, retried) {
    if (!canTouch() || picking) return;
    picking = true; scr.renderBoard(); scr.sfx.unlock();
    try {
      const r = await TM.api('/api/device', { op: 'pick', token, i, v: pub.v });
      if (r && r.pub) sync.apply(r.pub, true);
    } catch (e) {
      if (e.status === 409 && !retried) { picking = false; await sync.refresh(); const t = pub.board && pub.board.tiles[i]; if (t && t.s === 'd' && pub.board.pickable) return onPick(i, true); return; }
      if (e.status === 403 && e.data && /ghép nối|paired/i.test(e.data.error + ' ' + e.data.error_en)) forgetToken(e.message);
      else scr.toast(e.message, 'err');
    } finally { picking = false; scr.renderBoard(); }
  }

  /* ---------- ghép nối màn hình cảm ứng (chế độ tương tác) ---------- */
  $('#stage').insertAdjacentHTML('beforeend', '<div class="modal-bg" id="pairM"><div class="modal"><h2 id="pairTitle"></h2><p id="pairText"></p><div class="code tnum" id="pairCode"></div><div class="pad" id="pairPad"></div><div class="err" id="pairErr"></div><div class="r"><button class="btn btn-ghost" id="pairCancel"></button><button class="btn btn-danger" id="pairForget" style="display:none"></button><button class="btn btn-primary" id="pairGo"></button></div></div></div>');
  let code = '';
  function openPair() {
    code = ''; $('#pairErr').textContent = '';
    $('#pairTitle').textContent = tt('Ghép nối màn hình cảm ứng', 'Pair touch screen');
    $('#pairText').textContent = token ? tt('Màn hình này đang được phép chọn ô trong lượt MC cấp quyền.', 'This screen may pick tiles when the host grants a flip.') : tt('Nhập mã 6 số hiển thị trên trang MC (Cài đặt > Màn hình cảm ứng > Tạo mã ghép nối). Chỉ một màn hình được ghép nối tại một thời điểm.', 'Enter the 6-digit code from the host page (Settings > Touch screen > Create pairing code). Only one screen can be paired at a time.');
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
      scr.toast(tt('Đã ghép nối. Màn hình này có thể chọn ô khi MC cấp quyền lật.', 'Paired. This screen can pick tiles when the host grants a flip.'), 'good');
      if (r.pub) sync.apply(r.pub, true);
    } catch (e) { $('#pairErr').textContent = e.message; code = ''; renderCode(); }
  }
  function forgetToken(msg) { token = null; ls.set(TOKEN_KEY, null); if (msg) scr.toast(msg, 'err', 5000); if (pub) { scr.renderTools(); scr.renderBoard(); scr.renderConn(); } }
  $('#stage').addEventListener('click', e => { if (e.target.closest('.js-pair')) openPair(); });
  $('#pairGo').addEventListener('click', doPair);
  $('#pairCancel').addEventListener('click', () => $('#pairM').classList.remove('show'));
  $('#pairForget').addEventListener('click', () => { forgetToken(); $('#pairM').classList.remove('show'); });
  setInterval(async () => {
    if (!token) return;
    try { const r = await TM.api('/api/device', { op: 'ping', token }); if (r && r.paired === false) forgetToken(tt('Màn hình này đã bị hủy ghép nối trên trang MC.', 'This screen was unpaired on the host page.')); } catch (e) { /* mất mạng: thử lại lần sau */ }
  }, 8000);
})();
