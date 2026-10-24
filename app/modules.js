/* EMS — โมดูลที่ย้ายต่อจาก KruSpace (ชุดที่ 1)
   ประเมินคุณภาพผู้เรียน (คุณลักษณะฯ / อ่านคิดวิเคราะห์ฯ) · สรุป/ส่งออก ปพ.5 · ฐานนักเรียน
   อ้างอิงต้นฉบับ: app/index.html renderAssessments, renderSummary, renderStudents
   โหลดหลัง book.js (ใช้ EMSBook.book / EMSBook.calcRow) */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmt = (x, d) => { if (!isFinite(x)) return '–'; const s = Number(x).toFixed(d === undefined ? 2 : d); return (s.indexOf('.') < 0 ? s : s.replace(/\.?0+$/, '')) || '0'; };      // ไม่มีทศนิยม (d = 0) ห้ามตัดศูนย์ท้าย — 100 ต้องไม่กลายเป็น 1
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const B = () => window.EMSBook;
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;

/* ---------- ค่าตั้งต้น ---------- */
S.settings = Object.assign({
  schoolName: 'โรงเรียนปากช่อง', schoolLocation: 'นครราชสีมา', educationOffice: '',
  headLearningName: '', headAssessmentName: '', deputyName: '', directorName: '', directorPosition: 'ผู้อำนวยการสถานศึกษา'
}, S.settings || {});
S.bookMeta = S.bookMeta || {};     // classId -> {teacherName, credits, hoursPerWeek, totalHours, learningArea}

const book = cid => {
  const b = B().book(cid);
  b.assessments = b.assessments || { traits: {}, reading: {} };
  b.assessments.traits = b.assessments.traits || {}; b.assessments.reading = b.assessments.reading || {};
  b.notes = b.notes || {}; b.resultRemedy = b.resultRemedy || {};
  return b;
};
const metaOf = cid => S.bookMeta[cid] = Object.assign({ teacherName: '', credits: '', hoursPerWeek: '', totalHours: '', learningArea: '' }, S.bookMeta[cid] || {});

/* ---------- เวลาเรียน (จากข้อมูลเช็กชื่อของ EMS) ---------- */
// ใส่ประวัติเช็กชื่อตัวอย่างย้อนหลังให้ ถ้ายังไม่มี เพื่อให้หน้าสรุปมีตัวเลขให้ดู
S.classes.forEach((c, ci) => {
  if (Object.keys(S.att).some(k => k.indexOf(c.id + '|') === 0)) return;
  for (let d = 1; d <= 8; d++) {
    const rec = {}; c.students.forEach((s, i) => { const x = (i * 7 + d * 3 + ci) % 19; rec[s.id] = x === 0 ? 'a' : x === 1 ? 'l' : 'p'; });
    S.att[c.id + '|2026-09-' + String(d + 7).padStart(2, '0')] = rec; S.attSaved[c.id + '|2026-09-' + String(d + 7).padStart(2, '0')] = true;
  }
});
function attOf(cid, sid) {
  let p = 0, s2 = 0, l = 0, c2 = 0, a = 0;
  Object.keys(S.att).forEach(k => { if (k.indexOf(cid + '|') !== 0 || /\|hr$/.test(k)) return; const v = (S.att[k] || {})[sid];
    if (v === 'p') p++; else if (v === 's') s2++; else if (v === 'l') l++; else if (v === 'c') c2++; else if (v === 'a') a++; });
  const checked = p + s2 + l + c2 + a, attended = p + s2 + c2;     // มา+สาย+กิจกรรม นับเป็นเข้าเรียน
  return { p, s: s2, l, c: c2, a, checked, pct: checked ? attended * 100 / checked : null };
}
const attBadge = pct => pct === null ? '<span class="muted small">ยังไม่มีข้อมูล</span>' : `<span class="chip ${pct >= 80 ? 'ok' : pct >= 60 ? 'warn' : 'bad'}">${fmt(pct, 1)}%</span>`;

/* ---------- ประเมินคุณภาพผู้เรียน ---------- */
const TRAITS = ['รักชาติ ศาสน์ กษัตริย์', 'ซื่อสัตย์สุจริต', 'มีวินัย', 'ใฝ่เรียนรู้', 'อยู่อย่างพอเพียง', 'มุ่งมั่นในการทำงาน', 'รักความเป็นไทย', 'มีจิตสาธารณะ'];
const READING = ['คัดสรรสื่อและอ่านเพื่อหาข้อมูลตามวัตถุประสงค์', 'จับประเด็นสำคัญ ประเด็นสนับสนุน และประเด็นโต้แย้ง', 'วิเคราะห์วิจารณ์ความสมเหตุสมผลและความน่าเชื่อถือ', 'สรุปคุณค่า แนวคิด และแง่คิดจากเรื่องที่อ่าน', 'สรุป อภิปราย แสดงความคิดเห็น และถ่ายทอดด้วยการเขียน'];
const LEVELS = [{ label: 'ไม่ผ่าน', cls: 'bad' }, { label: 'ผ่าน', cls: 'warn' }, { label: 'ดี', cls: 'ok' }, { label: 'ดีเยี่ยม', cls: 'ok' }];
const cfgOf = t => t === 'traits' ? { type: 'traits', title: 'คุณลักษณะอันพึงประสงค์', items: TRAITS, excellent: 5, good: 5 } : { type: 'reading', title: 'การอ่าน คิดวิเคราะห์ และเขียน', items: READING, excellent: 4, good: 4 };
function resultOf(values, cfg) {                // นับจำนวนระดับ ไม่ใช้ค่าเฉลี่ย (ตรงกับ KruSpace)
  const counts = [0, 0, 0, 0]; let filled = 0;
  for (let i = 0; i < cfg.items.length; i++) { const v = values && values[i]; if (v === 0 || v === 1 || v === 2 || v === 3) { counts[v]++; filled++; } }
  if (filled < cfg.items.length) return { counts, filled, level: null };
  let level;
  if (counts[0] > 0) level = 0;
  else if (counts[1] === 0 && counts[3] >= cfg.excellent) level = 3;
  else if (counts[1] === 0 || counts[2] + counts[3] >= cfg.good) level = 2;
  else level = 1;
  return { counts, filled, level };
}
const levelBadge = r => r.level === null ? `<span class="chip">ยังไม่ครบ (${r.filled})</span>` : `<span class="chip ${LEVELS[r.level].cls}">${r.level} ${LEVELS[r.level].label}</span>`;
function distOf(b, sts, type) {
  const d = { 0: 0, 1: 0, 2: 0, 3: 0, blank: 0 };
  sts.forEach(s => { const r = resultOf(b.assessments[type][s.id] || [], cfgOf(type)); if (r.level === null) d.blank++; else d[r.level]++; });
  return d;
}
const readingFromGrade = g => { g = String(g); if (['4', '3.5', '3'].includes(g)) return 3; if (['2.5', '2', '1.5'].includes(g)) return 2; return 1; };
function autoReading(b, c) { c.students.forEach(s => { const r = B().calcRow(b, s), lv = readingFromGrade(r.grade); b.assessments.reading[s.id] = [lv, lv, lv, lv, lv]; }); return c.students.length; }
function autoTraits(b, c) {                     // กติกาเดียวกับ KruSpace: เวลาเรียน + สัดส่วนการส่งงาน
  c.students.forEach(s => {
    const att = attOf(c.id, s.id), pct = att.pct === null ? 100 : att.pct;
    const total = b.items.length, done = total ? b.items.filter(it => { const v = (b.scores[s.id] || {})[it.id]; return v !== undefined && v !== '' && v !== null; }).length / total : 1;
    const t3 = pct < 60 ? 1 : pct < 80 ? 2 : 3, t4 = pct >= 80 && done >= 0.8 ? 3 : pct >= 60 && done >= 0.5 ? 2 : 1, t6 = done >= 0.8 ? 3 : done >= 0.6 ? 2 : 1;
    b.assessments.traits[s.id] = [pct < 60 ? 2 : 3, 3, t3, t4, 3, t6, 3, pct < 50 ? 2 : 3];
  });
  return c.students.length;
}

let curId = S.classes[0].id;
const cur = () => { const c = S.classes.find(c => c.id === curId) || S.classes[0]; if (c) curId = c.id; return c; };      // ถอยไปห้องแรก → ซิงก์ curId ด้วย (ห้องจริงมาถึงหลังโหลดสคริปต์)
window.EMSCurSummaryClass = () => cur().id;
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const hd = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
const pills = () => `<div class="pills" role="group" aria-label="เลือกห้อง">${S.classes.map(c => `<button class="pill" aria-pressed="${c.id === cur().id}" data-md="cls" data-k="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="muted small" style="margin:-6px 0 14px">${esc(cur().subject)}</div>`;
const asked = (title, msg, ok) => new Promise(res => {
  modal(`<h2 style="margin-bottom:8px">${title}</h2><p style="margin-bottom:16px">${msg}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-mdc="0">ยกเลิก</button><button class="btn pri" data-mdc="1">${ok}</button></div>`, true);
  const L = $('#layer'), h = e => { const t = e.target.closest('[data-mdc]'); if (!t) return; L.removeEventListener('click', h, true); closeModal(); res(t.dataset.mdc === '1'); };
  L.addEventListener('click', h, true);
});

const css = document.createElement('style');
css.textContent = `
.as-tbl th,.as-tbl td{white-space:nowrap;text-align:center}
.as-tbl th:nth-child(-n+2),.as-tbl td:nth-child(-n+2){text-align:left;position:sticky;background:var(--surface);z-index:1}
.as-tbl th:nth-child(1),.as-tbl td:nth-child(1){left:0;min-width:64px}
.as-tbl th:nth-child(2),.as-tbl td:nth-child(2){left:64px;min-width:150px;box-shadow:2px 0 0 var(--line)}
.as-tbl select.in{width:62px;padding:2px 4px;min-height:38px}
.legend{display:grid;gap:4px;font-size:.88rem;margin:6px 0 12px;color:var(--muted)}
.cover{padding:24px}
.cover .ct{text-align:center;margin-bottom:14px}
.cover .ct img{width:60px;margin-bottom:6px}
.cover .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 20px;margin:14px 0;font-size:.92rem}
.cv-tbl{width:100%;border-collapse:collapse;margin-top:10px;font-size:.88rem}
.cv-tbl th,.cv-tbl td{border:1px solid var(--line);padding:6px 8px;text-align:center}
.cv-tbl th{background:var(--surface2);font-weight:600}
.cv-sign{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:20px;font-size:.88rem;line-height:1.9}
@media(max-width:700px){.cover .meta,.cv-sign,.cover .grid.g2{grid-template-columns:minmax(0,1fr)}}
`;
document.head.appendChild(css);

P.assess = () => {
  const c = cur(), b = book(c.id), st = c.students.slice().sort((a, z) => a.no - z.no);
  const section = type => {
    const cfg = cfgOf(type), d = distOf(b, st, type);
    const opt = v => '<option value="">–</option>' + [0, 1, 2, 3].map(n => `<option value="${n}" ${v === n ? 'selected' : ''}>${n}</option>`).join('');
    return `<div class="card" data-sec="${type}"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><h2 style="margin:0">${cfg.title}</h2><span class="grow"></span>
      <button class="btn sm pri" data-md="${type === 'traits' ? 'autoT' : 'autoR'}">⚡ ${type === 'traits' ? 'คำนวณจากเวลาเรียน/ส่งงาน' : 'คำนวณจากเกรด'}</button>
      <button class="btn sm" data-md="fill" data-t="${type}" data-v="3">เติม 3 ในช่องว่าง</button><button class="btn sm" data-md="fill" data-t="${type}" data-v="2">เติม 2 ในช่องว่าง</button>
      <button class="btn sm ghost" style="color:var(--bad)" data-md="clear" data-t="${type}">ล้างส่วนนี้</button></div>
      <div class="legend">${cfg.items.map((t, i) => `<div><b>${i + 1}.</b> ${esc(t)}</div>`).join('')}</div>
      <div class="notice">สรุปด้วยการนับจำนวนระดับ 0–3 ไม่ใช้ค่าเฉลี่ย · ดีเยี่ยมต้องได้ระดับ 3 อย่างน้อย ${cfg.excellent} ข้อ และไม่มีข้อใดต่ำกว่าระดับ 2</div>
      <div class="stat-row" id="as-${type}"><span>ดีเยี่ยม <b>${d[3]}</b></span><span>ดี <b>${d[2]}</b></span><span>ผ่าน <b>${d[1]}</b></span><span>ไม่ผ่าน <b>${d[0]}</b></span><span>ยังไม่ครบ <b>${d.blank}</b></span></div>
      <div class="row" style="flex-wrap:wrap;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px">
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-md="all" data-t="${type}" style="width:20px;height:20px;accent-color:var(--brand)"> เลือกทั้งห้อง</label>
        <select class="in" style="max-width:260px" data-bulk-i aria-label="หัวข้อ">${cfg.items.map((t, i) => `<option value="${i}">${i + 1}. ${esc(t)}</option>`).join('')}</select>
        <select class="in" style="max-width:150px" data-bulk-v aria-label="ระดับ"><option value="3">3 ดีเยี่ยม</option><option value="2">2 ดี</option><option value="1">1 ผ่าน</option><option value="0">0 ไม่ผ่าน</option></select>
        <button class="btn sm pri" data-md="bulk" data-t="${type}">ให้ระดับคนที่ติ๊ก</button></div>
      <div class="scroll"><table class="tbl as-tbl"><thead><tr><th>ที่</th><th>ชื่อ-สกุล</th>${cfg.items.map((t, i) => `<th title="${esc(t)}">ข้อ ${i + 1}</th>`).join('')}<th>3</th><th>2</th><th>1</th><th>0</th><th>ผล</th></tr></thead><tbody>
      ${st.map(s => { const v = b.assessments[type][s.id] || [], r = resultOf(v, cfg);
        return `<tr data-sid="${s.id}" data-t="${type}"><td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="as-pick" style="width:18px;height:18px;accent-color:var(--brand)">${s.no}</label></td><td>${esc(s.name)}</td>
          ${cfg.items.map((t, i) => `<td><select class="in" data-md="cell" data-i="${i}" aria-label="ข้อ ${i + 1} ${esc(s.name)}">${opt(v[i])}</select></td>`).join('')}
          <td class="c3">${r.counts[3]}</td><td class="c2">${r.counts[2]}</td><td class="c1">${r.counts[1]}</td><td class="c0">${r.counts[0]}</td><td class="res">${levelBadge(r)}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  };
  return hd('ประเมินคุณภาพผู้เรียน', 'คุณลักษณะอันพึงประสงค์ และการอ่าน คิดวิเคราะห์ และเขียน · ระดับ 3 ดีเยี่ยม · 2 ดี · 1 ผ่าน · 0 ไม่ผ่าน', '<button class="btn" onclick="window.print()">พิมพ์</button>') +
    pills() + (st.length ? section('traits') + section('reading') : '<div class="card empty">ยังไม่มีรายชื่อนักเรียน</div>');
};

/* ---------- สรุป / ส่งออก ปพ.5 ---------- */
const COVER_G = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส'];
function effGrade(b, s, r) {
  if (r.grade === '0' && r.complete && b.resultRemedy[s.id] === 'passed') return '1';
  return r.grade;
}
function summaryRows(c, b) {
  return c.students.slice().sort((a, z) => a.no - z.no).map(s => {
    const r = B().calcRow(b, s), att = attOf(c.id, s.id), grade = effGrade(b, s, r);
    return { s, r, att, grade, passed: grade !== '0' && grade !== '–', isMS: att.pct !== null && att.pct < 80 };
  });
}
const gradeCounts = rows => { const o = {}; COVER_G.forEach(g => o[g] = 0); rows.forEach(x => { const g = x.isMS ? 'มส' : (x.r.complete ? String(x.grade) : 'ร'); o[g] = (o[g] || 0) + 1; }); return o; };
const termLabel = () => `ภาคเรียนที่ ${S.term.sem} ปีการศึกษา ${S.term.year}`;

P.summary = () => {
  const c = cur(), b = book(c.id), meta = metaOf(c.id), st = S.settings, rows = summaryRows(c, b);
  const head = hd('สรุป / ส่งออก ปพ.5', 'ตรวจผลทั้งห้อง พิมพ์ปก ปพ.5 ส่งออก Excel และเผยแพร่ผลให้นักเรียน',
    `<button class="btn" data-md="coverInfo">${ic('gear')}ข้อมูลหน้าปก</button><button class="btn" onclick="window.print()">${ic('print')}พิมพ์ปก</button><button class="btn" data-md="xlsx">${ic('down')}ดาวน์โหลด Excel</button><button class="btn pri" data-md="sheet">${ic('up')}ส่งไปชีตของฉัน</button>`) + pills();
  if (!rows.length) return head + '<div class="card empty">ยังไม่มีรายชื่อนักเรียน</div>';
  const totals = rows.filter(x => x.r.any).map(x => x.r.total), avg = totals.reduce((a, v) => a + v, 0) / (totals.length || 1);
  const dist = {}; rows.forEach(x => { dist[x.grade] = (dist[x.grade] || 0) + 1; });
  const gc = gradeCounts(rows), T = distOf(b, c.students, 'traits'), R = distOf(b, c.students, 'reading');
  const asTbl = (t, d) => `<table class="cv-tbl"><thead><tr><th colspan="5">จำนวนนักเรียน จำแนกตาม${t}</th></tr><tr><th>3 ดีเยี่ยม</th><th>2 ดี</th><th>1 ผ่าน</th><th>0 ไม่ผ่าน</th><th>ยังไม่ครบ</th></tr></thead><tbody><tr><td>${d[3]}</td><td>${d[2]}</td><td>${d[1]}</td><td>${d[0]}</td><td>${d.blank}</td></tr></tbody></table>`;
  const roomRows = S.classes.map(k => { const kb = book(k.id), rr = summaryRows(k, kb); return { k, n: k.students.length, g: gradeCounts(rr) }; });
  const pub = !!S.published[c.id];
  const showSt = EMSPrefs.get('showUnitStatus'), lowC = ok => ok === false && EMSPrefs.get('redLow') ? 'low-t' : '';
  return head + (window.EMSSgs ? EMSSgs.card(c.id) : '') +
    `<div class="card cover"><div class="ct"><div class="muted small" style="text-align:right">ปพ.5</div><img src="${window.EMSLogo ? EMSLogo() : 'icons/school-logo.png'}" alt="">
      <h2>${esc(st.printTitle || 'แบบบันทึกเวลาเรียน และการประเมินผลการพัฒนาคุณภาพผู้เรียน')}</h2><div><b>${esc(st.schoolName)}</b>${st.schoolLocation ? ' · ' + esc(st.schoolLocation) : ''}</div>${st.educationOffice ? `<div>${esc(st.educationOffice)}</div>` : ''}</div>
      <div class="meta"><div>ชั้น/ห้อง <b>${esc(c.name)}</b></div><div>${termLabel()}</div><div>รายวิชา <b>${esc(c.subject)}</b></div>
        <div>กลุ่มสาระฯ <b>${esc(meta.learningArea || S.me.dept || '—')}</b></div><div>ครูผู้สอน <b>${esc(meta.teacherName || S.me.name)}</b></div>
        <div>หน่วยกิต <b>${esc(meta.credits || '—')}</b> · <b>${esc(meta.hoursPerWeek || '—')}</b> คาบ/สัปดาห์ · รวม <b>${esc(meta.totalHours || '—')}</b> ชม.</div></div>
      <div class="scroll"><table class="cv-tbl"><thead><tr><th>จำนวนนักเรียน</th>${COVER_G.map(g => `<th>${g}</th>`).join('')}</tr></thead><tbody><tr><td><b>${rows.length}</b></td>${COVER_G.map(g => `<td>${gc[g] || '–'}</td>`).join('')}</tr></tbody></table></div>
      <div class="grid g2">${asTbl('การอ่าน คิดวิเคราะห์ และเขียน', R)}${asTbl('คุณลักษณะอันพึงประสงค์', T)}</div>
      <div class="cv-sign"><div>☐ เห็นควรอนุมัติ ☐ ไม่เห็นควรอนุมัติ<br>ลงชื่อ ........................................ ครูผู้สอน<br><span class="muted">${esc(meta.teacherName || S.me.name)}</span></div>
        <div>☐ เห็นควรอนุมัติ ☐ ไม่เห็นควรอนุมัติ<br>ลงชื่อ ........................................ หัวหน้ากลุ่มสาระฯ<br><span class="muted">${esc(st.headLearningName)}</span></div>
        <div>☐ เห็นควรอนุมัติ ☐ ไม่เห็นควรอนุมัติ<br>ลงชื่อ ........................................ หัวหน้างานวัดผลฯ<br><span class="muted">${esc(st.headAssessmentName)}</span></div>
        <div>เรียนเสนอเพื่อโปรดพิจารณา<br>ลงชื่อ ........................................ รองผู้อำนวยการฝ่ายวิชาการ<br><span class="muted">${esc(st.deputyName)}</span></div>
        <div style="grid-column:1/-1;text-align:center">☐ อนุมัติ ☐ ไม่อนุมัติ<br>ลงชื่อ ........................................<br><b>${st.directorName ? '(' + esc(st.directorName) + ')' : ''}</b><br>${esc(st.directorPosition)}</div></div></div>
    <div class="grid g4" style="margin-top:16px"><div class="card kpi"><div class="l">คะแนนเฉลี่ย (เต็ม 100)</div><div class="v">${fmt(avg, 1)}</div></div>
      <div class="card kpi"><div class="l">สูงสุด</div><div class="v">${totals.length ? Math.max(...totals) : '–'}</div></div>
      <div class="card kpi"><div class="l">ต่ำสุด</div><div class="v">${totals.length ? Math.min(...totals) : '–'}</div></div>
      <div class="card kpi"><div class="l">ได้เกรด 0 / ยังแก้ไม่ผ่าน</div><div class="v" style="color:var(--bad)">${rows.filter(x => !x.passed && x.r.any).length}</div></div></div>
    <div class="card"><h2>การกระจายเกรด</h2>${b.gradeScale.map(g => { const n = dist[g[1]] || 0; return `<div class="row" style="border:0;padding:5px 0"><div style="width:44px;text-align:right;font-weight:600">${esc(g[1])}</div><div class="bar grow"><i style="width:${n * 100 / rows.length}%"></i></div><div class="muted small" style="width:56px">${n} คน</div></div>`; }).join('')}</div>
    <div class="card"><h2>สรุปเกรดแต่ละห้อง <span class="muted small">${esc(c.subject)}</span></h2><div class="scroll"><table class="cv-tbl"><thead><tr><th>ห้อง</th><th>ทั้งหมด</th>${COVER_G.map(g => `<th>${g}</th>`).join('')}</tr></thead><tbody>
      ${roomRows.map(x => `<tr><td><b>${esc(x.k.name)}</b></td><td>${x.n}</td>${COVER_G.map(g => `<td>${x.g[g] || '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>ตารางสรุปรายคน</h2><div class="scroll"><table class="tbl"><thead><tr><th>ที่</th><th>ชื่อ-สกุล</th><th>ก่อนกลาง<br><span class="muted small">/${fmt(b.weights.before)}</span></th><th>กลางภาค<br><span class="muted small">/${fmt(b.weights.mid)}</span></th><th>หลังกลาง<br><span class="muted small">/${fmt(b.weights.after)}</span></th><th>ปลายภาค<br><span class="muted small">/${fmt(b.weights.final)}</span></th><th>รวม</th><th>เกรด</th><th>เวลาเรียน</th><th>คุณลักษณะ</th><th>อ่านฯ</th><th>แก้ผล 0</th><th>หมายเหตุ</th></tr></thead><tbody>
      ${rows.map(x => `<tr data-sid="${x.s.id}"><td>${x.s.no}</td><td>${esc(x.s.name)}</td>${x.r.any ? [[x.r.wBefore, x.r.passBefore], [x.r.wM, x.r.passM], [x.r.wAfter, x.r.passAfter], [x.r.wF, x.r.passF]].map(([v, ok]) => `<td class="${lowC(ok)}">${fmt(v, 1)}${showSt && ok !== null ? '<div>' + chip(ok ? 'ผ่าน' : 'ไม่ผ่าน', ok ? 'ok' : 'bad') + '</div>' : ''}</td>`).join('') : '<td>–</td><td>–</td><td>–</td><td>–</td>'}
        <td class="${x.r.any && EMSPrefs.get('redLow') && x.r.total < num(b.passPercent) ? 'low-t' : ''}"><b>${x.r.any ? x.r.total : '–'}</b></td><td><span class="chip ${x.r.any ? (x.passed ? 'ok' : 'bad') : ''}">${x.r.any ? esc(x.grade) : '–'}</span>${x.isMS ? ' <span class="chip bad">มส</span>' : ''}</td><td>${attBadge(x.att.pct)}</td>
        <td>${levelBadge(resultOf(b.assessments.traits[x.s.id] || [], cfgOf('traits')))}</td><td>${levelBadge(resultOf(b.assessments.reading[x.s.id] || [], cfgOf('reading')))}</td>
        <td>${x.r.grade === '0' && x.r.complete ? `<select class="in" style="min-width:140px;min-height:38px" data-md="remedy"><option value="" ${!b.resultRemedy[x.s.id] ? 'selected' : ''}>ยังไม่แก้</option><option value="passed" ${b.resultRemedy[x.s.id] === 'passed' ? 'selected' : ''}>ผ่าน (เกรด 1)</option><option value="failed" ${b.resultRemedy[x.s.id] === 'failed' ? 'selected' : ''}>แก้แล้วไม่ผ่าน</option></select>` : '<span class="muted">—</span>'}</td>
        <td><input class="in" style="width:150px;min-height:38px;text-align:left" data-md="note" value="${esc(b.notes[x.s.id] || '')}" aria-label="หมายเหตุ ${esc(x.s.name)}"></td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin-bottom:4px">ให้นักเรียนดูผลจากมือถือตัวเอง</h2>
      <div class="muted small">เผยแพร่แล้วนักเรียนเห็นเฉพาะผลของตัวเอง — คะแนน 4 ส่วน รวม เกรด และเวลาเรียน ไม่เห็นคะแนนรายข้อและของเพื่อน</div></div>
      <span class="chip ${pub ? 'ok' : ''}">${pub ? 'เผยแพร่แล้ว' : 'ยังไม่เผยแพร่'}</span>
      <button class="btn ${pub ? '' : 'pri'}" data-md="publish">${pub ? 'ยกเลิกการเผยแพร่' : 'เผยแพร่ผลวิชานี้'}</button></div></div>`;
};

function coverInfoModal() {
  const c = cur(), m = metaOf(c.id), st = S.settings;
  const f = (id, l, v, ph) => `<div class="field"><label class="f" for="${id}">${l}</label><input id="${id}" class="in" value="${esc(v || '')}" placeholder="${ph || ''}"></div>`;
  modal(`<h2 style="margin-bottom:12px">ข้อมูลหน้าปก ปพ.5</h2>
    <h3 class="muted small" style="margin-bottom:8px">ของรายวิชา ${esc(c.name)}</h3>
    ${f('cv-t', 'ครูผู้สอน', m.teacherName, S.me.name)}${f('cv-a', 'กลุ่มสาระการเรียนรู้', m.learningArea, S.me.dept)}
    <div class="grid g3">${f('cv-c', 'หน่วยกิต', m.credits)}${f('cv-h', 'คาบ/สัปดาห์', m.hoursPerWeek)}${f('cv-th', 'เวลารวม (ชม.)', m.totalHours)}</div>
    <h3 class="muted small" style="margin:8px 0">ของโรงเรียน (ใช้กับทุกวิชา)</h3>
    ${f('cv-sn', 'ชื่อสถานศึกษา', st.schoolName)}${f('cv-sl', 'ที่ตั้ง', st.schoolLocation)}${f('cv-eo', 'สำนักงานเขตพื้นที่การศึกษา', st.educationOffice)}
    ${f('cv-hl', 'หัวหน้ากลุ่มสาระฯ', st.headLearningName)}${f('cv-ha', 'หัวหน้างานวัดผลฯ', st.headAssessmentName)}${f('cv-dp', 'รองผู้อำนวยการฝ่ายวิชาการ', st.deputyName)}${f('cv-dn', 'ผู้อำนวยการ', st.directorName)}
    <button class="btn pri" style="width:100%" data-md="coverSave">บันทึก</button>`);
}

function buildExport(c) {
  const b = book(c.id), m = metaOf(c.id), rows = summaryRows(c, b);
  /* หัวข้อสอบ: คอลัมน์ซ่อมทุกครั้งต่อท้าย จำนวน = ครั้งซ่อมสูงสุดในห้อง (ไม่มีใครซ่อม = ไม่มีคอลัมน์) */
  const rtOf = (sid, it) => { const a = window.EMSBook.rtList(((b.itemRetakes || {})[sid] || {})[it.id]).slice(); while (a.length && (a[a.length - 1] === '' || a[a.length - 1] == null)) a.pop(); return a; };
  const EB = window.EMSBook, rtN = {}; b.items.forEach(it => { rtN[it.id] = it.kind === 'unit' && !EB.examComps(it).length ? Math.max(0, ...rows.map(x => rtOf(x.s.id, it).length)) : 0; });      // มีช่องสอบ = ซ่อมรายช่องแทนซ่อมทั้งหน่วย
  const nRt = it => Array.from({ length: rtN[it.id] }, (_, k) => k);
  /* ช่องสอบในหน่วย: คอลัมน์ซ่อมรายช่อง (หัวบอกเต็มดิบของช่อง) จำนวน = ครั้งซ่อมสูงสุดในห้องของช่องนั้น */
  const cRtOf = (sid, it, c) => { const a = EB.rtList(((b.itemRetakes || {})[sid] || {})[EB.compRtKey(it, c)]).slice(); while (a.length && (a[a.length - 1] === '' || a[a.length - 1] == null)) a.pop(); return a; };
  const cRt = it => EB.examComps(it).flatMap(c => Array.from({ length: Math.max(0, ...rows.map(x => cRtOf(x.s.id, it, c).length)) }, (_, k) => ({ c, k })));
  const uVal = (sid, i) => { const v = EB.comps(i).length ? EB.itemValue(b, sid, i) : (b.scores[sid] || {})[i.id]; return v === undefined || v === '' ? '' : v; };      // หน่วยที่มีช่องย่อย = คิดใหม่ตามระบบ (รวมซ่อมรายช่อง)
  const hd = i => { const em = window.EMSBook.entryMax(i); return i.name + (em !== num(i.max) ? ' (ดิบเต็ม ' + em + ' · คิด ' + i.max + ')' : ' (เต็ม ' + i.max + ')'); };      // ค่าที่ส่งออกคือคะแนนที่ครูกรอก (ดิบ) → หัวบอกเต็มดิบ
  const data = [['ข้อมูล ปพ.5'], ['สถานศึกษา', S.settings.schoolName], ['ภาคเรียน', S.term.sem], ['ปีการศึกษา', S.term.year], ['ชั้น/ห้อง', c.name], ['รายวิชา', c.subject], ['ครูผู้สอน', m.teacherName || S.me.name], [],
    ['เลขที่', 'ชื่อ-สกุล', ...b.items.flatMap(i => [hd(i)].concat(nRt(i).map(k => i.name + ' ซ่อม ' + (k + 1) + ' (เต็ม ' + window.EMSBook.retakeMax(i) + ')'), cRt(i).map(({ c, k }) => i.name + ' · ' + EB.subName(c, b) + ' ซ่อม ' + (k + 1) + ' (เต็ม ' + c.rawMax + ')'))), 'กลางภาค', 'ซ่อมกลางภาค', 'ปลายภาค', 'ก่อนกลาง', 'กลาง', 'หลังกลาง', 'ปลาย', 'รวม 100', 'เกรด', 'เวลาเรียน %', 'คุณลักษณะ', 'อ่านคิดวิเคราะห์', 'หมายเหตุ', 'ผลก่อนกลาง', 'ผลกลางภาค', 'ผลหลังกลาง', 'ผลปลายภาค']];
  rows.forEach(x => { const ex = b.exam[x.s.id] || {};
    data.push([x.s.no, x.s.name, ...b.items.flatMap(i => [uVal(x.s.id, i)].concat(nRt(i).map(k => rtOf(x.s.id, i)[k] ?? ''), cRt(i).map(({ c, k }) => cRtOf(x.s.id, i, c)[k] ?? ''))), ex.mid ?? '', window.EMSBook.rtList(ex.retake).filter(v => v !== '').join(' / '), ex.final ?? '',
      x.r.wBefore, x.r.wM, x.r.wAfter, x.r.wF, x.r.total, x.grade, x.att.pct === null ? '' : Math.round(x.att.pct * 10) / 10,
      (resultOf(b.assessments.traits[x.s.id] || [], cfgOf('traits')).level ?? ''), (resultOf(b.assessments.reading[x.s.id] || [], cfgOf('reading')).level ?? ''), b.notes[x.s.id] || '',
      ...[x.r.passBefore, x.r.passM, x.r.passAfter, x.r.passF].map(v => v === null ? '' : v ? 'ผ่าน' : 'ไม่ผ่าน')]); });
  const name = 'ปพ5_' + c.name.replace(/[\\/]/g, '-') + '_' + S.term.sem + '-' + S.term.year;
  return { name, data };
}

async function exportXlsx(c) {
  const { name, data } = buildExport(c || cur());
  try {
    if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'ปพ.5'); XLSX.writeFile(wb, name + '.xlsx');
    toast('ส่งออก Excel แล้ว');
  } catch (e) {                                  // ออฟไลน์/ถูกบล็อก → ส่งออกเป็น CSV แทน
    const csv = '﻿' + data.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; a.click();
    toast('ส่งออกเป็นไฟล์ CSV แทน (ใช้ออฟไลน์ได้)');
  }
}

/* ---------- ฐานนักเรียน ---------- */
let stCls = 'all';
/* ห้องจัดกลุ่มตามระดับชั้น (ม.1, ม.2 …) สำหรับตัวเลือกห้อง */
const stGroups = () => { const g = {}; S.classes.forEach(c => { const k = (String(c.name).match(/^[^/]+/) || ['อื่น ๆ'])[0]; (g[k] = g[k] || []).push(c); }); return Object.entries(g); };
document.addEventListener('change', e => { if (!e.target.matches('[data-st-cls]')) return; stCls = e.target.value; redraw(); });
P['a-students'] = () => {
  const list = S.classes.filter(c => stCls === 'all' || c.id === stCls);
  const total = S.classes.reduce((a, c) => a + c.students.length, 0);
  return hd('ฐานนักเรียน', `ทั้งหมด ${total} คน · ${S.classes.length} ห้อง · แก้ไขได้ในตาราง บันทึกอัตโนมัติ`,
      `<button class="btn" data-act="go" data-p="a-import">${ic('up')}นำเข้าจากไฟล์</button><button class="btn pri" data-act="stAdd">${ic('plus')}เพิ่มนักเรียน</button>`) +
    `<div class="row" style="border:0;padding-top:0;gap:8px;flex-wrap:wrap;align-items:center">
      <select class="in" style="max-width:220px" data-st-cls aria-label="เลือกห้อง"><option value="all" ${stCls === 'all' ? 'selected' : ''}>ทุกห้อง (${S.classes.length} ห้อง)</option>${stGroups().map(([g, cs]) => `<optgroup label="${esc(g)}">${cs.map(c => `<option value="${c.id}" ${stCls === c.id ? 'selected' : ''}>${esc(c.name)} · ${c.students.length} คน</option>`).join('')}</optgroup>`).join('')}</select>
      <input class="in grow" style="min-width:200px" placeholder="ค้นหาชื่อหรือเลขประจำตัว" data-act="filter" data-t="#view" aria-label="ค้นหานักเรียน"></div>
    ${list.map(c => `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><h2 style="margin:0">${esc(c.name)} <span class="muted small">${c.students.length} คน</span></h2><span class="grow"></span>
      <button class="btn sm" data-md="sort" data-c="${c.id}">เรียงตามชื่อและเลขที่ใหม่</button></div>
      <div class="scroll"><table class="tbl" id="st-t-${c.id}"><thead><tr><th>เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th></th></tr></thead><tbody>
      ${c.students.slice().sort((a, z) => a.no - z.no).map(s => `<tr data-row data-c="${c.id}" data-sid="${s.id}"><td><input class="in" style="width:64px" inputmode="numeric" data-md="stNo" value="${s.no}" aria-label="เลขที่"></td>
        <td><input class="in" style="width:110px" data-md="stId" value="${esc(s.sid || '')}" placeholder="เลขประจำตัว" aria-label="เลขประจำตัว"></td>
        <td><input class="in" style="min-width:220px;text-align:left" data-md="stName" value="${esc(s.name)}" aria-label="ชื่อ"></td>
        <td><button class="btn sm ghost" style="color:var(--bad)" data-md="stDel">ลบ</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">ยังไม่มีนักเรียน</td></tr>'}
      </tbody></table></div></div>`).join('')}`;
};
const findSt = el => { const tr = el.closest('tr'), c = S.classes.find(x => x.id === tr.dataset.c); return { c, s: c.students.find(x => x.id === tr.dataset.sid) }; };
/* ดูภาคของปีก่อน (หลังขึ้นปีใหม่) = รายชื่อปีเก่าอ่านอย่างเดียว · ย้าย/ลบจะลบคะแนนในสมุดภาคเก่าจริง จึงปฏิเสธทุกการแก้รายชื่อ */
const ST_EDIT = ['stDel', 'sort', 'stName', 'stId', 'stNo', 'stMove'];
/* แก้ฐานนักเรียน = ถามเหตุผลและเก็บประวัติ (audit.js) · ไม่มีโมดูล = ผ่านเลย */
/* คืน commit() เมื่อยืนยัน → เรียกหลังแก้สำเร็จเพื่อบันทึกประวัติ · ยกเลิก = null */
const reasoned = (kind, target, before, after, title) => window.EMSAudit ? EMSAudit.guard(kind, target, before, after, title) : Promise.resolve(() => {});
/* หลังรอเหตุผล snapshot อาจสร้างรายชื่อชุดใหม่แล้ว → หาห้อง/นักเรียนจาก S ปัจจุบันด้วย id (แก้ object เก่า = การแก้หายเงียบ) */
const reFind = (cid, sid) => { const k = S.classes.find(x => x.id === cid), s = k && k.students.find(x => x.id === sid); if (!s) toast('รายชื่อเปลี่ยนระหว่างแก้ ลองใหม่'); return s ? { k, s } : null; };
const pastView = () => { const v = S.viewTerm, c = S.term || {}; return !!(v && v.year && c.year && +v.year < +c.year); };
const stLocked = a => { if (ST_EDIT.indexOf(a) < 0 || !pastView()) return false; toast('กำลังดูรายชื่อปีการศึกษา ' + S.viewTerm.year + ' — แก้ไม่ได้ กลับภาคปัจจุบันก่อน'); redraw(); return true; };

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button[data-md],input[type=checkbox][data-md]'); if (!t) return;
  const a = t.dataset.md, d = t.dataset, c = cur();
  if (t.tagName === 'INPUT' && a !== 'all') return;
  if (stLocked(a)) return;
  const b = book(c.id), sec = el => el.closest('[data-sec]');
  switch (a) {
    case 'cls': curId = d.k; return redraw();
    case 'stCls': stCls = d.k; return redraw();
    case 'autoR': toast('คำนวณการอ่านฯ จากเกรด ' + autoReading(b, c) + ' คนแล้ว'); save(); return redraw();
    case 'autoT': toast('คำนวณคุณลักษณะฯ จากเวลาเรียนและส่งงาน ' + autoTraits(b, c) + ' คนแล้ว'); save(); return redraw();
    case 'fill': { const cfg = cfgOf(d.t); c.students.forEach(s => { const arr = b.assessments[d.t][s.id] = (b.assessments[d.t][s.id] || []).slice();
        for (let i = 0; i < cfg.items.length; i++) if (![0, 1, 2, 3].includes(arr[i])) arr[i] = +d.v; }); save(); toast('เติมระดับ ' + d.v + ' ในช่องว่างแล้ว'); return redraw(); }
    case 'clear': if (await asked('ล้างผลประเมิน', 'ล้างข้อมูล <b>' + cfgOf(d.t).title + '</b> ของนักเรียนทั้งห้อง?', 'ล้าง')) { b.assessments[d.t] = {}; save(); redraw(); } return;
    case 'all': document.querySelectorAll('[data-sec="' + d.t + '"] .as-pick').forEach(x => { x.checked = t.checked; }); return;
    case 'bulk': { const s = sec(t), i = +s.querySelector('[data-bulk-i]').value, v = +s.querySelector('[data-bulk-v]').value;
      const picked = [...s.querySelectorAll('tr[data-sid]')].filter(tr => tr.querySelector('.as-pick').checked);
      if (!picked.length) return toast('กรุณาติ๊กเลือกนักเรียนก่อน');
      picked.forEach(tr => { const arr = b.assessments[d.t][tr.dataset.sid] = (b.assessments[d.t][tr.dataset.sid] || []).slice(); arr[i] = v; });
      save(); toast('ให้ระดับ ' + v + ' จำนวน ' + picked.length + ' คนแล้ว'); return redraw(); }
    case 'coverInfo': return coverInfoModal();
    case 'coverSave': { const m = metaOf(c.id), st = S.settings, v = id => $('#' + id).value.trim();
      Object.assign(m, { teacherName: v('cv-t'), learningArea: v('cv-a'), credits: v('cv-c'), hoursPerWeek: v('cv-h'), totalHours: v('cv-th') });
      Object.assign(st, { schoolName: v('cv-sn'), schoolLocation: v('cv-sl'), educationOffice: v('cv-eo'), headLearningName: v('cv-hl'), headAssessmentName: v('cv-ha'), deputyName: v('cv-dp'), directorName: v('cv-dn') });
      save(); closeModal(); toast('บันทึกข้อมูลหน้าปกแล้ว'); return redraw(); }
    case 'xlsx': return exportXlsx(c);
    case 'sheet': return window.EMSExport.sheet(c.id);
    case 'publish': S.published[c.id] = !S.published[c.id]; save(); toast(S.published[c.id] ? 'เผยแพร่ผลให้นักเรียนแล้ว' : 'ยกเลิกการเผยแพร่แล้ว'); return redraw();
    case 'stDel': { const { c: k, s } = findSt(t); if (!await asked('ลบนักเรียน', 'ลบ <b>' + esc(s.name) + '</b> ออกจาก ' + esc(k.name) + ' พร้อมคะแนนของนักเรียนคนนี้?', 'ลบ')) return;
      k.students = k.students.filter(x => x.id !== s.id); const kb = book(k.id);
      delete kb.scores[s.id]; delete kb.exam[s.id]; delete kb.itemRetakes[s.id]; delete kb.componentScores[s.id];
      kb.groupSets.forEach(gs => gs.groups.forEach(g => { g.members = g.members.filter(n => n !== s.no); }));
      save(); return redraw(); }
    case 'sort': { const ok = await reasoned('student', 'เรียงเลขที่ใหม่ · ' + ((S.classes.find(x => x.id === d.c) || {}).name || d.c), 'เลขที่เดิม', 'เรียงตามชื่อ', 'เรียงเลขที่ใหม่'); if (!ok) return;
      const k = S.classes.find(x => x.id === d.c); if (!k) return toast('รายชื่อเปลี่ยนระหว่างแก้ ลองใหม่');
      const old = k.students.slice().sort((x, z) => x.name.localeCompare(z.name, 'th'));
      const kb = book(k.id), map = {}; old.forEach((s, i) => { map[s.no] = null; });
      const byOld = {}; k.students.forEach(s => { byOld[s.no] = s.id; });
      old.forEach((s, i) => { s.newNo = i + 1; });
      kb.groupSets.forEach(gs => gs.groups.forEach(g => { g.members = g.members.map(n => (old.find(s => byOld[n] === s.id) || {}).newNo).filter(Boolean).sort((x, z) => x - z); }));
      old.forEach(s => { s.no = s.newNo; delete s.newNo; }); k.students = old; save(); ok(); toast('เรียงเลขที่ใหม่แล้ว'); return redraw(); }
  }
});
document.addEventListener('change', e => {
  const t = e.target.closest('input[data-md],select[data-md]'); if (!t) return;
  if (stLocked(t.dataset.md)) return;
  const a = t.dataset.md, c = cur(), b = book(c.id);
  switch (a) {
    case 'cell': { const tr = t.closest('tr'), type = tr.dataset.t, sid = tr.dataset.sid, cfg = cfgOf(type);
      const arr = b.assessments[type][sid] = (b.assessments[type][sid] || []).slice(); arr[+t.dataset.i] = t.value === '' ? null : +t.value;
      const r = resultOf(arr, cfg); tr.querySelector('.c3').textContent = r.counts[3]; tr.querySelector('.c2').textContent = r.counts[2];
      tr.querySelector('.c1').textContent = r.counts[1]; tr.querySelector('.c0').textContent = r.counts[0]; tr.querySelector('.res').innerHTML = levelBadge(r);
      const d = distOf(b, c.students, type); document.getElementById('as-' + type).innerHTML = `<span>ดีเยี่ยม <b>${d[3]}</b></span><span>ดี <b>${d[2]}</b></span><span>ผ่าน <b>${d[1]}</b></span><span>ไม่ผ่าน <b>${d[0]}</b></span><span>ยังไม่ครบ <b>${d.blank}</b></span>`;
      return save(); }
    case 'remedy': { const sid = t.closest('tr').dataset.sid; if (t.value) b.resultRemedy[sid] = t.value; else delete b.resultRemedy[sid]; save(); return redraw(); }
    case 'note': { const sid = t.closest('tr').dataset.sid, v = t.value.trim(); if (v) b.notes[sid] = v; else delete b.notes[sid]; return save(); }
    case 'stName': { const { c: k, s } = findSt(t), v = t.value.trim(); if (!v || v === s.name) { t.value = s.name; return; }
      t.value = s.name; return void reasoned('student', k.name + ' · ' + (s.sid || '') + ' ชื่อ-สกุล', s.name, v, 'แก้ชื่อนักเรียน').then(ok => { if (!ok) return; const f = reFind(k.id, s.id); if (!f) return redraw(); f.s.name = v; save(); ok(); redraw(); }); }
    case 'stId': { const { c: k, s } = findSt(t), v = t.value.trim(), old = s.sid || ''; if (v === old) return;
      t.value = old; return void reasoned('student', k.name + ' · ' + s.name + ' เลขประจำตัว', old, v, 'แก้เลขประจำตัว').then(ok => { if (!ok) return; const f = reFind(k.id, s.id); if (!f) return redraw(); f.s.sid = v; save(); ok(); redraw(); }); }
    case 'stNo': { const { c: k, s } = findSt(t), n = Math.max(1, Math.round(num(t.value)));
      if (n === s.no) { t.value = s.no; return; }
      if (k.students.some(x => x.id !== s.id && x.no === n)) { toast('เลขที่ ' + n + ' มีอยู่แล้วในห้องนี้'); return redraw(); }
      t.value = s.no; return void reasoned('student', k.name + ' · ' + s.name + ' เลขที่', s.no, n, 'แก้เลขที่').then(ok => { if (!ok) return; const f = reFind(k.id, s.id); if (!f) return redraw();
      if (f.k.students.some(x => x.id !== f.s.id && x.no === n)) { toast('เลขที่ ' + n + ' มีอยู่แล้วในห้องนี้'); return redraw(); }
      const kb = book(f.k.id); kb.groupSets.forEach(gs => gs.groups.forEach(g => { g.members = g.members.map(m => m === f.s.no ? n : m); }));
      f.s.no = n; save(); ok(); redraw(); }); }
    case 'stMove': { if (!t.value) return; let { c: from, s } = findSt(t); const to = S.classes.find(x => x.id === t.value);
      const subOf = id => window.EMSPlans && EMSPlans.isSub && EMSPlans.isSub(id);
      if (subOf(from.id)) { const pid = EMSPlans.parentOf(from.id), pc = S.classes.find(x => x.id === pid); if (!pc) return; from = pc; s = pc.students.find(x => x.id === s.id) || s; }   /* การ์ดห้องย่อย → ย้ายจากห้องหลัก */
      if (!to || subOf(to.id) || to.id === from.id) return redraw();
      const rp = S.roomPlans = S.roomPlans || {}, pk = String(s.sid || s.id);
      if (rp[from.id] && rp[from.id][pk]) { const nf = Object.assign({}, rp[from.id]), v = nf[pk]; delete nf[pk]; rp[from.id] = nf; rp[to.id] = Object.assign({}, rp[to.id], { [pk]: v }); }   /* แผนรายคนย้ายตามคน */
      const fb = book(from.id), tb = book(to.id);
      ['scores', 'exam', 'itemRetakes', 'componentScores'].forEach(k => { /* คะแนนผูกกับโครงสร้างของห้องเดิม จึงไม่ย้ายไปด้วย */ delete fb[k][s.id]; });
      fb.groupSets.forEach(gs => gs.groups.forEach(g => { g.members = g.members.filter(n => n !== s.no); }));
      from.students = from.students.filter(x => x.id !== s.id); s.no = to.students.reduce((m, x) => Math.max(m, x.no), 0) + 1; to.students.push(s);
      [from, to].forEach(k => { const r = (S.rooms || []).find(x => x.id === k.id); if (r) r.count = k.students.length; }); if (window.EMSPlans && EMSPlans.apply) EMSPlans.apply();
      save(); toast('ย้าย ' + s.name + ' ไป ' + to.name + ' แล้ว (คะแนนเดิมไม่ย้ายตาม)'); return redraw(); }
  }
});

window.EMSModules = { attOf, resultOf, cfgOf, summaryRows, gradeCounts };
window.EMSExport = {
  build: buildExport,
  xlsx: exportXlsx,
  /** ส่งตารางสรุปของห้องไปชีตของเจ้าของอีเมลที่ล็อกอิน (ไม่ได้ตั้งค่า Google → ดาวน์โหลด Excel แทน) */
  sheet(cid) {
    const c = S.classes.find(x => x.id === cid) || cur(), { data } = buildExport(c);
    return window.EMSSheets.send({ tabs: [{ title: c.name + ' ภาค' + S.term.sem + '-' + S.term.year, rows: data }], fallback: () => exportXlsx(c) });
  }
};
save(); render();
})();
