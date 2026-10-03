'use strict';
// Kiểm tra máy trạng thái trận: node tests/engine.test.js
const assert = require('assert');
const E = require('../lib/engine');

function bank() {
  const out = [];
  for (let i = 0; i < 24; i++) out.push({ id: 'M' + i, grp: 'main', q_vi: 'Câu ' + i, q_en: 'Q' + i, a_vi: 'Đáp ' + i, a_en: 'A' + i, enabled: true, sort: i });
  for (let i = 0; i < 6; i++) out.push({ id: 'B' + i, grp: 'backup', q_vi: 'DP ' + i, a_vi: 'ĐDP ' + i, enabled: true, sort: i });
  for (let i = 0; i < 4; i++) out.push({ id: 'T' + i, grp: 'tie', q_vi: 'Phụ ' + i, a_vi: 'ĐP ' + i, enabled: true, sort: i });
  for (let i = 0; i < 2; i++) out.push({ id: 'E' + i, grp: 'est', q_vi: 'Ước ' + i, num: String(100 + i), unit: 'kg', enabled: true, sort: i });
  out.push({ id: 'OFF', grp: 'main', q_vi: 'tắt', a_vi: 'x', enabled: false, sort: 99 });
  return out;
}
let now = 1_000_000;
const st = E.ensure(null);
const act = (a) => { E.advance(st, now); E.apply(st, a, now, { bank: bank() }); };
const tick = (ms) => { now += ms; E.advance(st, now); };
const pub = () => E.project(st, now, 1);
const json = () => JSON.stringify(pub());

// trận mới: bản chụp câu hỏi, câu tắt bị bỏ qua
act({ type: 'newMatch', teams: ['ĐỎ', 'XANH'], first: 0 });
assert.strictEqual(st.game.qs.m.length, 24);
assert.ok(!st.game.qs.m.some(q => q.id === 'OFF'));
assert.strictEqual(st.settings.teams[0].name, 'ĐỎ');
// trang người chơi không bao giờ thấy vị trí hình hoặc đáp án chưa công bố
assert.ok(!/Đáp /.test(json()) && !/"deck"/.test(json()));

// đảo hình trước khi bắt đầu: tự do
const d0 = st.game.m.deck.join();
let changedDeck = false; for (let k = 0; k < 5 && !changedDeck; k++) { act({ type: 'shuffle' }); changedDeck = st.game.m.deck.join() !== d0; }
assert.ok(changedDeck, 'shuffle đổi vị trí hình');

act({ type: 'startMain' });
act({ type: 'select', s: 'm', i: 0 });
let p = pub();
assert.strictEqual(p.msg.cur.q, null, 'chọn câu: chưa hiện nội dung');
assert.strictEqual(p.msg.cur.a, null);
// câu dự phòng khóa
assert.throws(() => act({ type: 'select', s: 'b', i: 0 }));
// bắt đầu tính giờ: công bố câu hỏi, bấm lại không tạo đồng hồ mới
act({ type: 'open' });
const at1 = st.game.clocks.ans.at; tick(1000); act({ type: 'open' });
assert.strictEqual(st.game.clocks.ans.at, at1);
p = pub(); assert.deepStrictEqual(p.msg.cur.q, { vi: 'Câu 0', en: 'Q0' }); assert.strictEqual(p.msg.cur.a, null);
assert.ok(!/Đáp 0/.test(json()));
// xem đáp án: dừng đồng hồ, công bố đáp án, chưa chấm
act({ type: 'reveal' });
p = pub(); assert.deepStrictEqual(p.msg.cur.a, { vi: 'Đáp 0', en: 'A0' }); assert.strictEqual(st.game.clocks.ans.running, false);
assert.strictEqual(st.game.m.phase, 'question'); assert.deepStrictEqual(st.game.m.scores, [0, 0]);
// bảng ô khóa khi chưa đúng
assert.throws(() => act({ type: 'pick', i: 0 }));
// đúng: cấp quyền 2 ô
act({ type: 'judge', ok: true });
act({ type: 'judge', ok: true }); // bấm lần hai không làm gì thêm
assert.strictEqual(st.game.m.phase, 'flip');
const deck = st.game.m.deck;
const a = 0, b = deck.findIndex((v, i) => i > 0 && v === deck[0]);
act({ type: 'pick', i: a });
assert.throws(() => act({ type: 'pick', i: a }), 'không chọn lại cùng ô');
act({ type: 'pick', i: b });
assert.throws(() => act({ type: 'pick', i: 3 }), 'tối đa 2 ô');
assert.deepStrictEqual(st.game.m.scores, [1, 0]);
tick(10000); // cặp đúng biến mất, chuyển lượt
assert.deepStrictEqual(st.game.m.scores, [1, 0], 'cộng điểm đúng một lần');
assert.strictEqual(st.game.m.turn, 1);
p = pub(); assert.strictEqual(p.board.tiles[a].s, 'g'); assert.strictEqual(p.msg.last.result, 'match');

// lượt đội 2: sai -> chuyển lượt, không cấp quyền lật
act({ type: 'select', s: 'm', i: 1 }); act({ type: 'open' }); act({ type: 'judge', ok: false });
assert.strictEqual(st.game.m.turn, 0); assert.strictEqual(st.game.m.phase, 'question');
p = pub(); assert.strictEqual(p.msg.last.verdict, 'wrong'); assert.deepStrictEqual(p.msg.last.a, { vi: 'Đáp 1', en: 'A1' });
// chọn câu mới xóa thông báo cũ
act({ type: 'select', s: 'm', i: 2 }); p = pub(); assert.strictEqual(p.msg.last, null);
// hết giờ trả lời
act({ type: 'open' }); tick(31000);
assert.strictEqual(st.game.m.turn, 1); assert.strictEqual(pub().msg.last.verdict, 'timeout');
// đúng rồi chọn 2 ô khác nhau -> giữ mở rồi úp lại
act({ type: 'select', s: 'm', i: 3 }); act({ type: 'open' }); act({ type: 'judge', ok: true });
const free = st.game.m.deck.map((v, i) => i).filter(i => !st.game.m.matched[i]);
const x = free[0], y = free.find(i => st.game.m.deck[i] !== st.game.m.deck[x]);
act({ type: 'pick', i: x }); act({ type: 'pick', i: y });
tick(1000); p = pub(); assert.strictEqual(p.board.tiles[x].x, 1, 'hiện dấu X');
tick(6000); tick(1000);
assert.strictEqual(st.game.m.turn, 0); assert.strictEqual(pub().board.tiles[x].s, 'd');
// hết giờ lật khi mới mở 1 ô
act({ type: 'select', s: 'm', i: 4 }); act({ type: 'open' }); act({ type: 'judge', ok: true });
act({ type: 'pick', i: free[1] }); tick(21000); tick(1000);
assert.strictEqual(st.game.m.turn, 1); assert.strictEqual(pub().board.tiles[free[1]].s, 'd');
assert.deepStrictEqual(st.game.m.scores, [1, 0]);

// tạm dừng toàn trận
const rem = E.eff(st.game.clocks.main, now); act({ type: 'pause' }); tick(60000);
assert.strictEqual(E.eff(st.game.clocks.main, now), rem); assert.throws(() => act({ type: 'select', s: 'm', i: 5 }));
act({ type: 'resume' });

// đảo hình giữa vòng cần xác nhận, xóa điểm vòng chính
assert.throws(() => act({ type: 'shuffle' }), e => e.status === 409);
act({ type: 'shuffle', confirm: true });
assert.deepStrictEqual(st.game.m.scores, [0, 0]); assert.strictEqual(st.game.m.started, false);
assert.ok(st.game.m.used.m[0], 'câu đã dùng vẫn được ghi nhận');

// hết giờ vòng chính khi hòa -> vòng phụ
act({ type: 'startMain' }); act({ type: 'endMain' }); tick(4000);
assert.strictEqual(st.game.stage, 'tie');
act({ type: 'startTie' }); act({ type: 'select', i: 0 });
assert.ok(!/ĐP 0/.test(json()) && !/Phụ 0/.test(json()));
act({ type: 'open' }); assert.ok(/Phụ 0/.test(json()) && !/ĐP 0/.test(json()));
act({ type: 'claim', team: 0 }); act({ type: 'judge', ok: false });
// đội còn lại vẫn được trả lời; đáp án vẫn kín
assert.strictEqual(st.game.t.answering, 1); assert.ok(!/ĐP 0/.test(json()));
assert.throws(() => act({ type: 'reveal' }), e => e.status === 409, 'công bố sớm cần xác nhận');
act({ type: 'judge', ok: false });
assert.ok(/ĐP 0/.test(json()), 'cả hai sai: công bố đáp án'); assert.strictEqual(pub().msg.last.verdict, 'bothWrong');
// câu 2: công bố sớm có xác nhận
act({ type: 'select', i: 1 }); act({ type: 'open' }); act({ type: 'claim', team: 1 });
act({ type: 'reveal', confirm: true }); assert.ok(/ĐP 1/.test(json())); assert.strictEqual(st.game.t.q, null);
// câu 3: đúng -> lật đúng cặp -> thắng
act({ type: 'select', i: 2 }); act({ type: 'open' }); act({ type: 'claim', team: 1 }); act({ type: 'judge', ok: true });
const td = st.game.t.deck, ta = td.indexOf(0), tb = td.lastIndexOf(0);
act({ type: 'pick', i: ta }); act({ type: 'pick', i: tb }); tick(5000);
assert.strictEqual(st.game.stage, 'result'); assert.strictEqual(st.game.r.winner, 1); assert.ok(st._record);
const rec = E.matchRecord(st, now); assert.strictEqual(rec.winner, 'XANH');

// trận mới dùng lại bộ câu hỏi, reset câu đã dùng
delete st._record;
act({ type: 'newMatch', teams: ['A', 'B'], first: 1 });
assert.ok(st.game.m.used.m.every(u => !u)); assert.strictEqual(st.game.m.turn, 1);

// vòng phụ hết câu -> ước lượng
act({ type: 'startMain' }); act({ type: 'endMain' }); tick(4000); act({ type: 'startTie' }); act({ type: 'toEst' });
assert.strictEqual(st.game.stage, 'estimate'); assert.ok(!/"correct"/.test(JSON.stringify(pub().est)));
act({ type: 'estShow' }); act({ type: 'estSet', a0: '90', a1: '120' }); act({ type: 'estCompare' });
assert.strictEqual(st.game.e.result.winner, 0); act({ type: 'announce' }); assert.strictEqual(st.game.stage, 'result');

// chơi thử không ảnh hưởng trận chính
act({ type: 'newMatch', teams: ['A', 'B'], first: 0 }); act({ type: 'startMain' });
const mainRem = E.eff(st.game.clocks.main, now);
act({ type: 'practiceStart' }); tick(5000);
assert.strictEqual(E.eff(st.game.clocks.main, now), mainRem, 'đồng hồ trận chính đứng yên khi chơi thử');
act({ type: 'open' }); act({ type: 'judge', ok: true });
const pd = st.game.prac.deck; act({ type: 'pick', i: pd.indexOf(0) }); act({ type: 'pick', i: pd.lastIndexOf(0) }); tick(6000);
assert.deepStrictEqual(st.game.m.scores, [0, 0]);
act({ type: 'practiceEnd' }); assert.strictEqual(st.game.prac, null); assert.ok(st.game.clocks.main.running);

// ghép nối màn hình cảm ứng
const code = E.pairCode(st, now);
assert.strictEqual(E.pairDevice(st, '000000' === code ? '111111' : '000000', now).ok, false);
const pr = E.pairDevice(st, code, now); assert.ok(pr.ok && E.deviceOk(st, pr.token)); assert.ok(!E.deviceOk(st, 'x'.repeat(64)));
const code2 = E.pairCode(st, now); const pr2 = E.pairDevice(st, code2, now); assert.ok(!E.deviceOk(st, pr.token) && E.deviceOk(st, pr2.token), 'thiết bị mới thay thiết bị cũ');

// cài đặt được kiểm tra và giới hạn
const S2 = E.mergeSettings(st.settings, { times: { main: 999, answer: 1 }, logoUrl: 'javascript:alert(1)', teams: [{ name: '<b>x</b>', color: 'red' }, { name: '' }] });
assert.strictEqual(S2.times.main, 90); assert.strictEqual(S2.times.answer, 5); assert.strictEqual(S2.logoUrl, ''); assert.strictEqual(S2.teams[1].name, 'ĐỘI 2'); assert.strictEqual(S2.teams[0].color, '#3fb6ff');

const pf = E.preflight(st.settings, [{ id: 'q', grp: 'main', q_vi: 'x', a_vi: '', enabled: true }]);
assert.ok(pf.warnings.length >= 3);
// ===== 3–4 đội =====
{
  let t3 = 2_000_000;
  const s3 = E.ensure(null);
  const a3 = (a) => { E.advance(s3, t3); E.apply(s3, a, t3, { bank: bank() }); };
  const k3 = (ms) => { t3 += ms; E.advance(s3, t3); };
  a3({ type: 'newMatch', teams: ['A', 'B', 'C', 'D'], first: 2 });
  assert.strictEqual(s3.settings.teams.length, 4);
  assert.strictEqual(s3.settings.teams[3].color, '#3ddc84');
  assert.deepStrictEqual(s3.game.m.scores, [0, 0, 0, 0]);
  assert.strictEqual(E.project(s3, t3, 1).s.teams.length, 4);
  a3({ type: 'startMain' });
  assert.strictEqual(s3.game.m.turn, 2);
  // lượt xoay vòng 2 → 3 → 0
  a3({ type: 'select', s: 'm', i: 0 }); a3({ type: 'open' }); a3({ type: 'judge', ok: false });
  assert.strictEqual(s3.game.m.turn, 3);
  a3({ type: 'select', s: 'm', i: 1 }); a3({ type: 'open' }); a3({ type: 'judge', ok: false });
  assert.strictEqual(s3.game.m.turn, 0);
  assert.throws(() => a3({ type: 'adjust', team: 4, d: 1 }));
  // B và D đồng điểm cao nhất: chỉ hai đội này vào vòng phụ
  a3({ type: 'adjust', team: 1, d: 1 }); a3({ type: 'adjust', team: 3, d: 1 });
  a3({ type: 'endMain' }); k3(5000);
  assert.strictEqual(s3.game.stage, 'tie');
  assert.deepStrictEqual(s3.game.t.teams, [1, 3]);
  a3({ type: 'startTie' }); a3({ type: 'select', i: 0 }); a3({ type: 'open' });
  assert.throws(() => a3({ type: 'claim', team: 0 }), 'đội không đồng điểm không được giành quyền');
  a3({ type: 'claim', team: 3 }); a3({ type: 'judge', ok: false });
  assert.strictEqual(s3.game.t.answering, 1, 'còn một đội thì đội đó trả lời luôn');
  a3({ type: 'toEst' });
  assert.deepStrictEqual(s3.game.e.teams, [1, 3]);
  a3({ type: 'estShow' }); a3({ type: 'estSet', a: ['95', '105'] }); a3({ type: 'estCompare' });
  assert.strictEqual(s3.game.e.result.winner, null, 'sai lệch bằng nhau');
  a3({ type: 'estNew' }); a3({ type: 'estShow' }); a3({ type: 'estSet', a: ['99', '120'] }); a3({ type: 'estCompare' });
  assert.strictEqual(s3.game.e.result.winner, 1);
  a3({ type: 'announce' });
  assert.strictEqual(s3.game.r.winner, 1);
  assert.strictEqual(E.matchRecord(s3, t3).winner, 'B');
}
{
  // 3 đội cùng hòa: sai một đội thì MC chọn đội giành quyền tiếp theo
  let t4 = 3_000_000;
  const s4 = E.ensure(null);
  const a4 = (a) => { E.advance(s4, t4); E.apply(s4, a, t4, { bank: bank() }); };
  a4({ type: 'newMatch', teams: ['X', 'Y', 'Z'], first: 0 });
  a4({ type: 'startMain' }); a4({ type: 'endMain' }); t4 += 5000; E.advance(s4, t4);
  assert.deepStrictEqual(s4.game.t.teams, [0, 1, 2]);
  a4({ type: 'startTie' }); a4({ type: 'select', i: 0 }); a4({ type: 'open' });
  a4({ type: 'claim', team: 1 }); a4({ type: 'judge', ok: false });
  assert.strictEqual(s4.game.t.answering, null);
  assert.strictEqual(s4.game.t.wrongTeam, 1);
  assert.throws(() => a4({ type: 'claim', team: 1 }), 'đội đã sai không được giành lại');
  a4({ type: 'claim', team: 2 }); a4({ type: 'judge', ok: false });
  assert.strictEqual(s4.game.t.answering, 0);
  a4({ type: 'judge', ok: false });
  assert.strictEqual(s4.game.t.last.verdict, 'bothWrong');
  // số đội giới hạn 2–4
  assert.strictEqual(E.mergeSettings(s4.settings, { teams: [1, 2, 3, 4, 5, 6].map(i => ({ name: 'T' + i })) }).teams.length, 4);
  assert.strictEqual(E.mergeSettings(s4.settings, { teams: [{ name: 'only' }] }).teams.length, 2);
}
console.log('engine tests OK');
