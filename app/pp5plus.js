/* EMS — สรุป ปพ.5 เพิ่มเติม
   1) “รวมทุกห้อง” — ครูสอนหลายห้องเห็นผลรวมทุกห้องในหน้าเดียว: เกรดรวม เฉลี่ย ผ่าน/ไม่ผ่าน 0 ร มส. แยกรายวิชา (รหัสเดียวกันรวมกัน) และรายห้อง
      ส่งออก Excel รวม (แผ่นสรุป + แผ่นละห้อง)
   2) กำหนดการสอบกลางภาค/ปลายภาค — ครูเลือกเวลาสอบ (นาที) และประเภท “ในตาราง” (สอบในคาบตัวเอง) หรือ “นอกตาราง” (ให้วิชาการจัด)
      ส่งให้ฝ่ายวิชาการจัดตารางสอบ (S.examReqs) ผลการจัดวัน/เวลา/สถานที่กลับมาแสดงที่การ์ดนี้ */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmt = (x, d = 1) => { if (!isFinite(x)) return '–'; const s = Number(x).toFixed(d); return s.replace(/\.0+$/, '') || '0'; };
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const M = () => window.EMSModules;
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const code = s => String(s || '').split(' ')[0];
const G = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส'];
const termKey = () => S.term.year + '/' + S.term.sem;
const KINDS = [['mid', 'สอบกลางภาค'], ['final', 'สอบปลายภาค']];
const MODES = { out: ['นอกตาราง', 'ให้ฝ่ายวิชาการจัดตารางสอบ', 'warn'], in: ['ในตาราง', 'สอบในคาบเรียนของตัวเอง', 'info'], none: ['ไม่มีสอบ', 'วิชานี้ไม่มีการสอบครั้งนี้', ''] };
const MINUTES = [30, 45, 50, 60, 90, 120, 150, 180];
const endOf = (start, min) => { if (!start) return ''; const [h, m] = start.split(':').map(Number), t = h * 60 + m + num(min); return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const kindName = k => (KINDS.find(x => x[0] === k) || ['', ''])[1];

/* ---------- ข้อมูล ----------
   กำหนดการสอบเก็บ “รายวิชา” (รหัสวิชา × กลางภาค/ปลายภาค) ไม่ใช่รายห้อง — วิชาที่สอนหลายคน คนกำหนดมีคนเดียว ส่งครั้งเดียวครอบคลุมทุกห้องทุกครู
   ครูคนอื่นที่สอนรหัสวิชาเดียวกันจะเห็นว่า “ส่งแล้ว โดย …” ปุ่มส่งปิดไว้ ไม่ต้องส่งซ้ำ (แก้ได้เฉพาะผู้ส่ง) */
S.examReqs = S.examReqs || [];
/** ห้องทั้งหมดที่เรียนรหัสวิชานี้ (ทุกครูในตารางสอน + ห้องของฉัน) */
function roomsOf(cd) {
  const X = window.EMSExchange, m = new Map(), cnt = id => { const c = cls(id); return c ? c.students.length : num(((S.rooms || []).find(r => r.id === id) || {}).count); };
  (X ? X.allEntries() : []).filter(e => code(e.subject) === cd).forEach(e => { if (!m.has(e.classId)) m.set(e.classId, { classId: e.classId, className: X.cname(e.classId), teacher: e.teacher, students: cnt(e.classId) }); });
  S.classes.filter(c => code(c.subject) === cd).forEach(c => { if (!m.has(c.id)) m.set(c.id, { classId: c.id, className: c.name, teacher: S.me.name, students: c.students.length }); });
  return [...m.values()].sort((x, y) => String(x.className).localeCompare(String(y.className), 'th', { numeric: true }));
}
/* ข้อมูลรูปแบบเดิม (รายห้อง) → รวมเป็นรายวิชา */
if (S.examReqs.some(x => !x.code)) {
  const keep = [], by = {};
  S.examReqs.forEach(x => { if (x.code) return keep.push(x); const k = x.term + '|' + x.kind + '|' + code(x.subject);
    if (!by[k] || (by[k].status === 'draft' && x.status !== 'draft')) by[k] = Object.assign({}, x, { code: code(x.subject) }); });
  S.examReqs = keep.concat(Object.values(by).map(x => { delete x.classId; delete x.className; delete x.together; x.rooms = roomsOf(x.code); return x; }));
}
if ((S.examSeeded || 0) < 2) {                // ตัวอย่างให้ลองใช้: วิชาของครูท่านอื่น + ฟิสิกส์ 3 ที่ครูอีกท่านเป็นผู้กำหนดและส่งไปแล้ว
  S.examSeeded = 2;
  const X = window.EMSExchange, seen = new Set();
  const add = (cd, subject, teacher, kind, mode, minutes) => { if (S.examReqs.some(x => x.term === termKey() && x.kind === kind && x.code === cd && x.status !== 'draft')) return;
    S.examReqs.push({ id: uid('ex'), term: termKey(), code: cd, subject, teacher, kind, mode, minutes, rooms: roomsOf(cd), date: '', start: '', place: '', note: '', status: 'submitted', sentAt: new Date().toISOString() }); };
  (X ? X.allEntries() : []).filter(e => e.teacher !== S.me.name).forEach(e => { const cd = code(e.subject); if (seen.has(cd) || seen.size >= 5) return; seen.add(cd);
    KINDS.forEach(([k]) => add(cd, e.subject, e.teacher, k, seen.size === 3 && k === 'mid' ? 'in' : 'out', k === 'final' ? 90 : 60)); });
  const phy = S.classes.find(c => /^ว30201/.test(c.subject));
  if (phy) {                                    // ฟิสิกส์ 3 สอนสองคน (ฉัน ม.5/1 + ครูมานพ ม.5/2) ครูมานพเป็นผู้กำหนดสอบกลางภาค
    const r52 = (S.rooms || []).find(r => r.name === 'ม.5/2');
    if (r52 && S.ttOthers && !S.ttOthers.some(e => e.teacher === 'ครูมานพ ศรีวิทย์' && e.subject === phy.subject)) S.ttOthers.push({ id: uid('e'), teacher: 'ครูมานพ ศรีวิทย์', classId: r52.id, subject: phy.subject, day: 3, p: 6 }, { id: uid('e'), teacher: 'ครูมานพ ศรีวิทย์', classId: r52.id, subject: phy.subject, day: 3, p: 7 });
    add(code(phy.subject), phy.subject, 'ครูมานพ ศรีวิทย์', 'mid', 'out', 60);
  }
}
const cur = () => S.examReqs.filter(x => x.term === termKey());
/** รายการที่ส่งแล้วของรหัสวิชานี้ (ใครส่งก็ได้) */
const sentOf = (cd, kind) => cur().find(x => x.kind === kind && x.code === cd && x.status !== 'draft');
const reqOf = (cd, kind) => sentOf(cd, kind) || cur().find(x => x.kind === kind && x.code === cd && x.status === 'draft' && x.teacher === S.me.name);
function ensureReq(c, kind) {
  const cd = code(c.subject); let r = reqOf(cd, kind); if (r) return r;
  const w = (EMSBook.book(c.id).weights || {})[kind];
  r = { id: uid('ex'), term: termKey(), code: cd, subject: c.subject, teacher: S.me.name, kind, mode: num(w) > 0 ? 'out' : 'none', minutes: kind === 'final' ? 90 : 60,
    rooms: [], date: '', start: '', place: '', note: '', status: 'draft' };
  S.examReqs.push(r); return r;
}
const mine = r => r.teacher === S.me.name;
const whenText = r => r.date ? `${thDate(r.date)}${r.start ? ' · ' + r.start + '–' + endOf(r.start, r.minutes) : ''}${r.place ? ' · ' + esc(r.place) : ''}` : '';
const stChip = r => r.status === 'draft' ? chip('ยังไม่ส่ง', 'warn') : r.status === 'changed' ? chip('แก้ไขแล้ว · ยังไม่ส่งใหม่', 'warn')
  : r.mode === 'none' ? chip('ส่งแล้ว · ไม่มีสอบ', 'ok') : r.mode === 'out' && r.date && r.start ? chip('วิชาการจัดแล้ว', 'ok') : chip(r.mode === 'out' ? 'ส่งแล้ว · รอวิชาการจัด' : 'ส่งแล้ว', 'ok');
function sendBtn(r) {
  if (r.status === 'draft') return `<button class="btn sm pri" data-pq="sendOne" data-id="${r.id}">${ic('up')}ส่งให้วิชาการ</button>`;
  if (r.status === 'changed' && mine(r)) return `<button class="btn sm pri" data-pq="sendOne" data-id="${r.id}">${ic('up')}ส่งการแก้ไข</button>`;
  return `<button class="btn sm" disabled title="${mine(r) ? 'คุณส่งรายวิชานี้แล้ว' : 'ครูในรายวิชานี้ส่งแล้ว ไม่ต้องส่งซ้ำ'}">✓ ส่งแล้ว</button>`;
}

/* ---------- การ์ดกำหนดการสอบ (รายวิชา) ---------- */
function examCard(classes) {
  const codes = [...new Set(classes.map(c => code(c.subject)))], rows = [];
  codes.forEach(cd => { const c = classes.find(x => code(x.subject) === cd); KINDS.forEach(([k]) => rows.push({ c, cd, r: ensureReq(c, k), rooms: roomsOf(cd) })); });
  const todo = rows.filter(x => x.r.status === 'draft' || (x.r.status === 'changed' && mine(x.r))), byOther = rows.filter(x => x.r.status !== 'draft' && !mine(x.r)).length;
  return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">กำหนดการสอบกลางภาค / ปลายภาค</h2>
      <div class="muted small">กำหนดเป็น<b>รายวิชา</b> ครอบคลุมทุกห้องทุกครูที่สอนรหัสวิชาเดียวกัน — ส่งครั้งเดียวพอ ถ้าครูในรายวิชาส่งแล้ว ปุ่มจะขึ้น “ส่งแล้ว” · <b>ในตาราง</b> = สอบในคาบเรียนของแต่ละห้อง · <b>นอกตาราง</b> = ให้ฝ่ายวิชาการจัดตารางสอบกลาง</div></div>
      ${todo.length ? chip('ยังไม่ส่ง ' + todo.length + ' รายการ', 'warn') : chip('ส่งครบแล้ว', 'ok')}${byOther ? chip('ครูท่านอื่นส่งให้แล้ว ' + byOther, 'info') : ''}
      <button class="btn pri" data-pq="send" data-ids="${todo.map(x => x.r.id).join(',')}" ${todo.length ? '' : 'disabled'}>${todo.length ? ic('up') + 'ส่งทุกรายการที่ยังไม่ส่ง' : '✓ ส่งครบแล้ว'}</button></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>รายวิชา / ห้องที่สอบ</th><th>การสอบ</th><th>ประเภท</th><th>เวลาสอบ</th><th>วันที่ (ในตาราง)</th><th>หมายเหตุถึงวิชาการ</th><th>สถานะ</th></tr></thead><tbody>
    ${rows.map(({ c, cd, r, rooms }) => { const lock = r.status !== 'draft' && !mine(r), off = lock || r.mode === 'none', dis = lock ? 'disabled' : '';
      return `<tr ${lock ? 'style="background:var(--surface2)"' : ''}><td><b>${esc(cd)}</b> <span class="small">${esc(c.subject.replace(cd, '').trim())}</span>
          <div class="muted small" style="margin-top:2px">${rooms.length} ห้อง: ${rooms.map(x => esc(x.className) + (x.teacher !== S.me.name ? ' (' + esc(x.teacher.replace(/^ครู/, '')) + ')' : '')).join(', ')}</div></td>
        <td>${kindName(r.kind)}</td>
        <td><select class="in" style="width:130px" data-pq="mode" data-id="${r.id}" ${dis} aria-label="ประเภทการสอบ ${esc(cd)} ${kindName(r.kind)}">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></td>
        <td><select class="in" style="width:110px" data-pq="minutes" data-id="${r.id}" ${off ? 'disabled' : ''} aria-label="เวลาสอบ">${MINUTES.map(m => `<option value="${m}" ${num(r.minutes) === m ? 'selected' : ''}>${m} นาที</option>`).join('')}</select></td>
        <td>${r.mode === 'in' ? `<input class="in" type="date" style="width:150px" value="${esc(r.date || '')}" data-pq="date" data-id="${r.id}" ${dis} aria-label="วันที่สอบ">` : r.mode === 'out' ? '<span class="muted small">วิชาการกำหนด</span>' : '–'}</td>
        <td><input class="in" style="width:170px;text-align:left" value="${esc(r.note || '')}" placeholder="เช่น ใช้กระดาษคำตอบ" data-pq="note" data-id="${r.id}" ${off ? 'disabled' : ''} aria-label="หมายเหตุ"></td>
        <td style="min-width:170px">${stChip(r)}<div style="margin-top:4px">${sendBtn(r)}</div>
          ${r.status !== 'draft' ? `<div class="muted small" style="margin-top:4px">${mine(r) ? 'ส่งโดยคุณ' : 'ส่งโดย ' + esc(r.teacher)}${r.sentAt ? ' · ' + thDate(String(r.sentAt).slice(0, 10)) : ''}</div>` : ''}
          ${r.mode === 'out' && r.date ? `<div class="small" style="margin-top:2px">${whenText(r)}</div>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}
function sendList(list) {
  if (list.some(r => r.mode === 'in' && !r.date)) return toast('สอบในตาราง กรุณาระบุวันที่สอบก่อน');
  const dup = list.filter(r => r.status === 'draft' && sentOf(r.code, r.kind));
  if (dup.length) { S.examReqs = S.examReqs.filter(x => dup.indexOf(x) < 0); save(); toast('มีครูในรายวิชาเดียวกันส่งไปแล้ว ' + dup.length + ' รายการ — ไม่ส่งซ้ำ'); return redraw(); }
  list.forEach(r => { r.status = 'submitted'; r.teacher = S.me.name; r.sentAt = new Date().toISOString(); r.rooms = roomsOf(r.code); });
  save(); toast('ส่งกำหนดการสอบ ' + list.length + ' รายวิชาให้ฝ่ายวิชาการแล้ว'); redraw();
}

/* ---------- ปพ.5 รวมทุกห้อง ---------- */
function roomStat(c) {
  const b = EMSBook.book(c.id), rows = M().summaryRows(c, b), any = rows.filter(x => x.r.any), totals = any.map(x => x.r.total), gc = M().gradeCounts(rows);
  return { c, b, rows, n: rows.length, avg: totals.length ? totals.reduce((a, v) => a + v, 0) / totals.length : NaN, max: totals.length ? Math.max(...totals) : NaN, min: totals.length ? Math.min(...totals) : NaN,
    gc, pass: rows.filter(x => x.r.complete && x.passed && !x.isMS).length, complete: rows.filter(x => x.r.complete).length, sum: totals.reduce((a, v) => a + v, 0), cnt: totals.length, pub: !!S.published[c.id] };
}
const addGc = (a, b) => { G.forEach(g => { a[g] = (a[g] || 0) + (b[g] || 0); }); return a; };
const gcCells = gc => G.map(g => `<td>${gc[g] || '–'}</td>`).join('');
function allPage() {
  const st = S.classes.map(roomStat), tot = st.reduce((a, x) => ({ n: a.n + x.n, sum: a.sum + x.sum, cnt: a.cnt + x.cnt, pass: a.pass + x.pass, complete: a.complete + x.complete }), { n: 0, sum: 0, cnt: 0, pass: 0, complete: 0 });
  const gc = st.reduce((a, x) => addGc(a, x.gc), {}), subj = {};
  st.forEach(x => { const k = code(x.c.subject), s = subj[k] = subj[k] || { name: x.c.subject, rooms: [], n: 0, sum: 0, cnt: 0, gc: {} }; s.rooms.push(x.c.name); s.n += x.n; s.sum += x.sum; s.cnt += x.cnt; addGc(s.gc, x.gc); });
  const pills = `<div class="pills" role="group" aria-label="เลือกห้อง"><button class="pill" aria-pressed="true" data-pq="all">รวมทุกห้อง</button>${S.classes.map(c => `<button class="pill" aria-pressed="false" data-md="cls" data-k="${c.id}">${esc(c.name)}</button>`).join('')}</div>
    <div class="muted small" style="margin:-6px 0 14px">${S.classes.length} ห้อง · ${Object.keys(subj).length} รายวิชา · ${tot.n} คน</div>`;
  const bad = gc['0'] + gc['ร'] + gc['มส'];
  return `<div class="top"><div><h1>สรุป / ส่งออก ปพ.5</h1><p>รวมทุกห้องที่สอน — เทียบผลแต่ละห้องและภาพรวมของรายวิชา</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-pq="printAll">${ic('print')}พิมพ์สรุปรวม</button><button class="btn pri" data-pq="xlsxAll">${ic('down')}Excel รวมทุกห้อง</button></div></div>${pills}
    <div class="grid g4">${[['นักเรียนรวม', tot.n, `${S.classes.length} ห้อง`], ['คะแนนเฉลี่ยรวม (เต็ม 100)', fmt(tot.cnt ? tot.sum / tot.cnt : NaN), `จาก ${tot.cnt} คนที่มีคะแนน`],
      ['ผ่านเกณฑ์', tot.complete ? fmt(tot.pass * 100 / tot.complete) + '%' : '–', `${tot.pass}/${tot.complete} คนที่คะแนนครบ`], ['0 / ร / มส.', `${gc['0'] || 0} / ${gc['ร'] || 0} / ${gc['มส'] || 0}`, '']]
      .map(([l, v, s], i) => `<div class="card kpi"><div class="l">${l}</div><div class="v" ${i === 3 && bad ? 'style="color:var(--bad)"' : ''}>${v}</div>${s ? `<div class="s muted">${s}</div>` : ''}</div>`).join('')}</div>
    <div class="card" style="margin-top:16px"><h2>การกระจายเกรดรวมทุกห้อง</h2>${G.map(g => { const n = gc[g] || 0; return `<div class="row" style="border:0;padding:5px 0"><div style="width:44px;text-align:right;font-weight:600">${g}</div><div class="bar grow"><i style="width:${tot.n ? n * 100 / tot.n : 0}%${['0', 'ร', 'มส'].includes(g) ? ';background:var(--bad)' : ''}"></i></div><div class="muted small" style="width:80px">${n} คน${tot.n ? ' · ' + fmt(n * 100 / tot.n) + '%' : ''}</div></div>`; }).join('')}</div>
    <div class="card"><h2>สรุปรวมรายวิชา <span class="muted small">รหัสวิชาเดียวกันหลายห้องรวมเป็นแถวเดียว</span></h2><div class="scroll"><table class="cv-tbl"><thead><tr><th>รายวิชา</th><th>ห้อง</th><th>นักเรียน</th><th>เฉลี่ย</th>${G.map(g => `<th>${g}</th>`).join('')}</tr></thead><tbody>
      ${Object.values(subj).map(s => `<tr><td style="text-align:left"><b>${esc(s.name)}</b></td><td>${s.rooms.map(esc).join(', ')}</td><td>${s.n}</td><td>${fmt(s.cnt ? s.sum / s.cnt : NaN)}</td>${gcCells(s.gc)}</tr>`).join('')}
      <tr style="font-weight:700"><td style="text-align:left">รวมทั้งหมด</td><td>${S.classes.length} ห้อง</td><td>${tot.n}</td><td>${fmt(tot.cnt ? tot.sum / tot.cnt : NaN)}</td>${gcCells(gc)}</tr></tbody></table></div></div>
    <div class="card"><h2>เทียบรายห้อง</h2><div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th>รายวิชา</th><th>นักเรียน</th><th>เฉลี่ย</th><th>สูงสุด</th><th>ต่ำสุด</th><th>คะแนนครบ</th><th>ผ่าน</th><th>0/ร/มส.</th><th>เผยแพร่</th><th></th></tr></thead><tbody>
      ${st.map(x => { const b0 = (x.gc['0'] || 0) + (x.gc['ร'] || 0) + (x.gc['มส'] || 0);
        return `<tr><td><b>${esc(x.c.name)}</b></td><td class="small">${esc(x.c.subject)}</td><td>${x.n}</td><td><b>${fmt(x.avg)}</b></td><td>${fmt(x.max, 0)}</td><td>${fmt(x.min, 0)}</td>
          <td>${x.complete}/${x.n}</td><td>${x.complete ? fmt(x.pass * 100 / x.complete) + '%' : '–'}</td><td style="color:${b0 ? 'var(--bad)' : 'inherit'}">${x.gc['0'] || 0}/${x.gc['ร'] || 0}/${x.gc['มส'] || 0}</td>
          <td>${chip(x.pub ? 'แล้ว' : 'ยัง', x.pub ? 'ok' : '')}</td><td><button class="btn sm" data-md="cls" data-k="${x.c.id}">เปิดห้องนี้</button></td></tr>`; }).join('')}</tbody></table></div></div>
    ${examCard(S.classes)}`;
}
function combinedData() {
  const st = S.classes.map(roomStat), data = [['สรุป ปพ.5 รวมทุกห้อง'], ['สถานศึกษา', (S.settings || {}).schoolName || ''], ['ภาคเรียน', S.term.sem], ['ปีการศึกษา', S.term.year], ['ครูผู้สอน', S.me.name], [],
    ['ห้อง', 'รายวิชา', 'นักเรียน', 'เฉลี่ย', 'สูงสุด', 'ต่ำสุด', 'คะแนนครบ', 'ผ่าน', ...G]];
  st.forEach(x => data.push([x.c.name, x.c.subject, x.n, isFinite(x.avg) ? Math.round(x.avg * 10) / 10 : '', isFinite(x.max) ? x.max : '', isFinite(x.min) ? x.min : '', x.complete, x.pass, ...G.map(g => x.gc[g] || 0)]));
  const gc = st.reduce((a, x) => addGc(a, x.gc), {});
  data.push(['รวม', '', st.reduce((a, x) => a + x.n, 0), '', '', '', st.reduce((a, x) => a + x.complete, 0), st.reduce((a, x) => a + x.pass, 0), ...G.map(g => gc[g] || 0)]);
  return data;
}
async function xlsxAll() {
  const name = 'ปพ5_รวมทุกห้อง_' + S.term.sem + '-' + S.term.year, sum = combinedData();
  try {
    if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'สรุปรวม');
    S.classes.forEach(c => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(EMSExport.build(c).data), String(c.name).replace(/[\\/:*?"<>|[\]]/g, '-').slice(0, 31)));
    XLSX.writeFile(wb, name + '.xlsx'); toast('ส่งออก Excel รวม ' + S.classes.length + ' ห้องแล้ว');
  } catch (e) {
    const csv = '﻿' + sum.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; a.click(); toast('ส่งออกสรุปรวมเป็น CSV แทน');
  }
}
function printAll() {
  const data = combinedData(), head = data[6], body = data.slice(7), s = S.settings || {};
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const font = window.EMSType ? EMSType.printStack() : '"TH Sarabun New","Sarabun",sans-serif', d = f.contentWindow.document; d.open();
  d.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>สรุป ปพ.5 รวมทุกห้อง</title><style>body{font-family:${font};color:#000}h1{text-align:center;margin:4px 0}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #444;padding:3px 5px;text-align:center;font-size:13pt}${window.EMSPrintCss ? EMSPrintCss() : ''}@page{size:A4 landscape}</style></head><body>
    <div style="text-align:center"><img src="${esc(new URL(window.EMSLogo ? EMSLogo() : 'icons/school-logo.png', location.href).href)}" style="height:1.5cm"><h1>สรุปผลการเรียนรวมทุกห้อง</h1><div>${esc(s.schoolName || '')} · ภาคเรียนที่ ${S.term.sem}/${S.term.year} · ครูผู้สอน ${esc(S.me.name)}</div></div>
    <table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p style="margin-top:30px;text-align:right">ลงชื่อ ........................................ ครูผู้สอน<br>( ${esc(S.me.name)} )</p></body></html>`);
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
}

/* ---------- ต่อเข้าหน้าเดิม ---------- */
const base = P.summary;
P.summary = () => {
  if (S.ppAll && S.classes.length > 1) return allPage();
  const html = base(), c = cls(window.EMSCurSummaryClass ? EMSCurSummaryClass() : '') || S.classes[0];
  const withPill = html.replace('<div class="pills" role="group" aria-label="เลือกห้อง">', `<div class="pills" role="group" aria-label="เลือกห้อง">${S.classes.length > 1 ? '<button class="pill" aria-pressed="false" data-pq="all">รวมทุกห้อง</button>' : ''}`);
  return withPill + (c ? examCard([c]) : '');
};
document.addEventListener('click', e => { if (e.target.closest('[data-md="cls"]')) S.ppAll = false; }, true);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-pq]'); if (!t || t.disabled || t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
  const d = t.dataset;
  if (d.pq === 'all') { S.ppAll = true; save(); return redraw(); }
  if (d.pq === 'xlsxAll') return xlsxAll();
  if (d.pq === 'printAll') return printAll();
  if (d.pq === 'send') { const ids = d.ids.split(','); return sendList(S.examReqs.filter(r => ids.indexOf(r.id) >= 0 && (r.status === 'draft' || (r.status === 'changed' && mine(r))))); }
  if (d.pq === 'sendOne') { const r = S.examReqs.find(x => x.id === d.id); if (r) sendList([r]); }
});
document.addEventListener('change', e => {
  const t = e.target, k = t.dataset.pq; if (!k || t.tagName === 'BUTTON') return;
  const r = S.examReqs.find(x => x.id === t.dataset.id); if (!r) return;
  if (r.status !== 'draft' && !mine(r)) { toast('รายวิชานี้ ' + r.teacher + ' เป็นผู้ส่ง — แก้ได้เฉพาะผู้ส่ง'); return redraw(); }
  const v = t.value;
  if (k === 'minutes') r.minutes = num(v); else r[k] = v;
  if (k === 'mode' && v === 'out') { r.date = ''; r.start = ''; r.place = ''; }
  if (r.status !== 'draft') r.status = 'changed';           // แก้หลังส่ง → ต้องส่งใหม่ วิชาการจะได้รู้
  save(); redraw();
});
window.EMSExams = { reqOf, sentOf, roomsOf, endOf, kindName, MODES, KINDS, whenText, termKey };
})();
