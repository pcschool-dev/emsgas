/* EMS — ฝ่ายวัดผล · ฝ่ายวิชาการ · ภาพรวมผู้บริหารเชิงลึก (ย้ายจาก KruSpace: renderMeasureDept, renderMeasureLoad, ttClashes,
   renderAcademic + renderAcademicScores / renderAcademicPending / renderAcademicTasks, renderExecutive, renderTeachingLoad, teachingLoadStats)
   - ตารางสอนทั้งโรงเรียนมาจาก EMSExchange.allEntries() (S.tt ของฉัน + S.ttOthers)
   - คะแนน/เวลาเรียนรายวิชาคำนวณจากสมุดคะแนนในเครื่อง (EMSBook) — รายวิชาของครูคนอื่นจะขึ้นเมื่อเชื่อม Firebase (bookProgress)
   - ครูสอนชนคาบ = ครูคนเดียวมี "ต่างวิชา" ในคาบเดียวกัน (วิชาเดียวกันหลายห้อง = รวมห้อง ไม่นับ)
     ห้องมีหลายวิชาในคาบเดียว = อาจเป็นการแยกกลุ่มเรียน ให้ตรวจ ไม่ฟันธงว่าผิด
   - ภาระงานสอนนับเฉพาะคาบประจำ ไม่รวมคาบเข้าแถว/สอนแทน/สอนชดเชย */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmt = (x, d) => { if (!isFinite(x)) return '–'; const s = Number(x).toFixed(d === undefined ? 1 : d); return s.replace(/\.0+$/, '') || '0'; };
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const X = () => window.EMSExchange, A = () => window.EMSAdmin, M = () => window.EMSModules;
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const hd = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
const kpi = (l, v, s, k) => `<div class="card kpi"><div class="l">${l}</div><div class="v" ${k ? `style="color:var(--${k})"` : ''}>${v}</div>${s ? `<div class="s muted">${s}</div>` : ''}</div>`;
const tabs = (list, cur, key) => `<div class="pills" role="tablist" style="margin-bottom:14px">${list.map(([k, l]) => `<button class="pill" role="tab" aria-pressed="${k === cur}" data-dp="view" data-key="${key}" data-k="${k}">${l}</button>`).join('')}</div>`;
const sel = (key, list, cur, label, all) => `<select class="in" style="width:auto;min-width:150px" data-dpf="${key}" aria-label="${label}">${all ? `<option value="">${all}</option>` : ''}${list.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
const roomName = id => A() ? A().roomName(id) : ((cls(id) || {}).name || id);
const staffOf = n => S.staff.find(u => u.name === n) || (n === S.me.name ? { name: n, dept: S.me.dept } : { name: n });
const areaOf = n => String(staffOf(n).dept || '').replace(/^กลุ่มสาระ(การเรียนรู้)?ฯ?\s*/, '').trim() || 'ยังไม่ระบุกลุ่มสาระ';
const isVac = u => (u.roles && u.roles.length ? u.roles : [u.role]).indexOf('vacant') >= 0;   // ตำแหน่งว่าง (รอครู) ไม่นับเป็นครู/บุคลากร
const isVacN = n => isVac(staffOf(n));
const isTeacher = u => !isVac(u) && (u.roles && u.roles.length ? u.roles : [u.role]).indexOf('teacher') >= 0;
const levelOf = name => { const m = String(name || '').match(/ม\.?\s?(\d)/); return m ? 'ม.' + m[1] : 'ไม่ระบุระดับชั้น'; };
const termText = () => `ภาคเรียนที่ ${S.term.sem}/${S.term.year}`;
const code = s => String(s || '').split(' ')[0];
const sortTh = (a, b) => String(a).localeCompare(String(b), 'th', { numeric: true });

S.dui = Object.assign({ exKind: 'mid', ms: 'scores', msT: '', msC: '', area: '', status: '', prReason: '', prLevel: '', ac: 'tasks', taskGroup: '', loadArea: '', loadSort: 'periods', loadDir: -1, execArea: '' }, S.dui || {});
S.acadTasks = S.acadTasks || {};

/* ---------- พิมพ์เอกสารพร้อมหัวโรงเรียน ---------- */
function docHead(title, sub) {
  const s = S.settings || {}, logo = new URL(window.EMSLogo ? EMSLogo() : 'icons/school-logo.png', location.href).href;
  return `<div style="text-align:center"><img src="${esc(logo)}" style="height:1.6cm"><h1 style="margin:4px 0 0">${esc(title)}</h1><div>${esc(s.schoolName || 'โรงเรียนปากช่อง')} · ${esc(sub || termText())}</div></div>`;
}
const signHtml = () => { const s = S.settings || {};
  return `<table style="width:100%;margin-top:28px;border:0"><tr><td style="border:0;text-align:center;width:50%">ลงชื่อ ....................................<br>( ${esc(s.headAssessmentName || '....................................')} )<br>หัวหน้างานวัดผลและประเมินผล</td>
    <td style="border:0;text-align:center">ลงชื่อ ....................................<br>( ${esc(s.deputyName || '....................................')} )<br>รองผู้อำนวยการกลุ่มบริหารวิชาการ</td></tr></table>`; };
function printDoc(title, body) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const font = window.EMSType ? EMSType.printStack() : '"TH Sarabun New","Sarabun",sans-serif', d = f.contentWindow.document; d.open();
  d.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:${font};color:#000}h1{text-align:center}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #444;padding:3px 6px;font-size:13pt;vertical-align:top}th{background:#eee}.c{text-align:center}${window.EMSPrintCss ? EMSPrintCss() : ''}@page{size:A4 landscape}</style></head><body>${body}</body></html>`);
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
}

/* ================= ข้อมูลรวม ================= */
const entries = () => X() ? X().allEntries() : [];
/** รายวิชา-ห้อง ที่ควรมีผลการเรียน = ครู × ห้อง × วิชา ในตารางสอน จับคู่กับความคืบหน้าในสมุดคะแนน */
function courses() {
  const seen = new Map();
  entries().forEach(e => { const k = e.classId + '::' + e.subject; if (seen.has(k)) return;
    seen.set(k, { classId: e.classId, subject: e.subject, teacher: e.teacher, area: areaOf(e.teacher), className: roomName(e.classId), mine: e.teacher === S.me.name && !!cls(e.classId) }); });
  S.classes.forEach(c => { const k = c.id + '::' + c.subject; if (!seen.has(k)) seen.set(k, { classId: c.id, subject: c.subject, teacher: S.me.name, area: areaOf(S.me.name), className: c.name, mine: true }); });
  return [...seen.values()].map(r => {
    if (!r.mine || !M() || !M().summaryRows) return Object.assign(r, { status: 'none', p: null });
    const c = cls(r.classId), rows = M().summaryRows(c, EMSBook.book(c.id)), done = rows.filter(x => x.r.complete).length, any = rows.filter(x => x.r.any).length;
    const p = { students: rows.length, complete: done, filledPct: rows.length ? any * 100 / rows.length : 0, zero: rows.filter(x => x.r.complete && x.grade === '0').length,
      ms: rows.filter(x => x.isMS).length, published: !!S.published[c.id] };
    return Object.assign(r, { p, status: p.students && done >= p.students ? 'done' : any ? 'doing' : 'none' });
  }).sort((a, b) => sortTh(a.area, b.area) || sortTh(a.teacher, b.teacher) || sortTh(a.subject, b.subject) || sortTh(a.className, b.className));
}
const SCORE_ST = { none: ['ยังไม่เริ่ม / ยังไม่ซิงก์', 'bad'], doing: ['กำลังกรอก', 'warn'], done: ['คะแนนครบ', 'ok'] };

/** นักเรียนที่ติด 0 ร มส. — 0 = คะแนนครบแต่ได้ 0 · ร = เริ่มกรอกแล้วแต่ยังไม่ครบ · มส = เวลาเรียนต่ำกว่าเกณฑ์ */
function pendingItems() {
  const out = [], minAtt = A() ? num(A().termCur().minAtt) || 80 : 80;
  S.classes.forEach(c => { if (!M() || !M().summaryRows) return; const b = EMSBook.book(c.id);
    M().summaryRows(c, b).forEach(x => {
      const ms = x.att.pct !== null && x.att.pct < minAtt, reason = ms ? 'มส' : x.r.complete && x.grade === '0' ? '0' : x.r.any && !x.r.complete ? 'ร' : '';
      const fixed = x.r.complete && x.r.grade === '0' && (b.resultRemedy || {})[x.s.id] === 'passed';
      if (reason || fixed) out.push({ s: x.s, c, subject: c.subject, teacher: S.me.name, reason: fixed ? 'แก้ผ่าน' : reason, fixed, att: x.att.pct });
    }); });
  return out;
}

/* ---------- ตารางชน + ภาระงานสอน ---------- */
function clashes(list) {
  const group = fn => { const m = new Map(); list.forEach(e => { const k = fn(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }); return [...m.values()]; };
  return { teacher: group(e => e.teacher + '|' + e.day + '|' + e.p).filter(l => new Set(l.map(e => e.subject)).size > 1),
           klass: group(e => e.classId + '|' + e.day + '|' + e.p).filter(l => l.length > 1 && new Set(l.map(e => e.subject + e.teacher)).size > 1) };
}
const slotText = e => `วัน${DAYS[e.day]} คาบ ${e.p + 1}`;
function loadStats(area) {
  const all = entries(), names = [...new Set(S.staff.filter(isTeacher).map(u => u.name).concat(all.map(e => e.teacher)))];
  const row = n => { const own = all.filter(e => e.teacher === n);
    return { name: n, area: areaOf(n), periods: own.length, subjects: new Set(own.map(e => e.subject)).size, classes: new Set(own.map(e => e.classId)).size, days: new Set(own.map(e => e.day)).size }; };
  const rows = names.filter(n => !isVacN(n)).map(row), vac = names.filter(isVacN).map(row).filter(r => !area || r.area === area);   // ตำแหน่งว่างแยกแสดง ไม่นำไปคิดค่าเฉลี่ย
  const scoped = area ? rows.filter(r => r.area === area) : rows, teaching = scoped.filter(r => r.periods), total = scoped.reduce((a, r) => a + r.periods, 0);
  const groups = {}; rows.forEach(r => { const g = groups[r.area] = groups[r.area] || { area: r.area, teachers: 0, teaching: 0, total: 0 }; g.teachers++; g.total += r.periods; if (r.periods) g.teaching++; });
  return { rows: scoped, vac, sum: { teachers: scoped.length, teaching: teaching.length, total, avg: teaching.length ? total / teaching.length : 0,
    max: teaching.length ? Math.max(...teaching.map(r => r.periods)) : 0, min: teaching.length ? Math.min(...teaching.map(r => r.periods)) : 0 },
    byArea: Object.values(groups).map(g => Object.assign(g, { avg: g.teaching ? g.total / g.teaching : 0 })).sort((a, b) => b.avg - a.avg || b.total - a.total), areas: [...new Set(rows.map(r => r.area))].sort(sortTh) };
}
const LOAD_COLS = [['name', 'ครู'], ['area', 'กลุ่มสาระ'], ['periods', 'คาบ/สัปดาห์'], ['subjects', 'วิชา'], ['classes', 'ห้องที่สอน'], ['days', 'วันที่มีสอน']];
function loadCard() {
  const U = S.dui, d = loadStats(U.loadArea), s = d.sum, key = LOAD_COLS.some(c => c[0] === U.loadSort) ? U.loadSort : 'periods';
  const rows = d.rows.slice().sort((a, b) => (typeof a[key] === 'number' ? (a[key] - b[key]) * U.loadDir : sortTh(a[key], b[key]) * U.loadDir) || sortTh(a.name, b.name));
  const cols = LOAD_COLS.filter(c => !(U.loadArea && c[0] === 'area'));
  return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">ภาระงานสอนรายครู</h2><div class="muted small">นับเฉพาะคาบประจำในตารางสอน ${termText()} · ไม่รวมคาบเข้าแถว สอนแทน และสอนชดเชย</div></div>
      ${sel('loadArea', d.areas, U.loadArea, 'กลุ่มสาระ', '— ทุกกลุ่มสาระ —')}</div>
    <div class="grid g4" style="margin:8px 0 12px">${kpi('ครูที่มีคาบสอน', s.teaching, [s.teachers - s.teaching ? `ไม่มีคาบ ${s.teachers - s.teaching} คน` : '', d.vac.length ? `ตำแหน่งว่าง ${d.vac.length}` : ''].filter(Boolean).join(' · '))}${kpi('คาบรวม/สัปดาห์', s.total)}${kpi('เฉลี่ยต่อครู', fmt(s.avg), `หาร ${s.teaching} คน`)}${kpi('สูงสุด–ต่ำสุด', s.max + '–' + s.min)}</div>
    <div class="scroll"><table class="tbl"><thead><tr>${cols.map(([k, l]) => `<th><button class="btn ghost sm" style="padding:0;min-height:0;font:inherit;color:inherit" data-dp="loadSort" data-k="${k}">${l}${key === k ? (U.loadDir < 0 ? ' ▼' : ' ▲') : ''}</button></th>`).join('')}<th>เทียบค่าเฉลี่ย</th></tr></thead><tbody>
    ${rows.length ? rows.map(r => { const diff = r.periods - s.avg, w = s.max ? Math.round(r.periods * 100 / s.max) : 0;
      return `<tr><td><b>${esc(r.name)}</b></td>${U.loadArea ? '' : `<td>${esc(r.area)}</td>`}<td><b>${r.periods}</b></td><td>${r.subjects}</td><td>${r.classes}</td><td>${r.days}</td>
        <td style="min-width:150px">${r.periods ? `<span style="color:var(--${diff >= 0 ? 'ok' : 'warn'})">${diff >= 0 ? '+' : ''}${fmt(diff)}</span><div class="bar" style="margin-top:4px"><i style="width:${w}%${diff < 0 ? ';background:var(--warn)' : ''}"></i></div>` : chip('ยังไม่มีคาบสอน', 'warn')}</td></tr>`; }).join('')
      : `<tr><td colspan="${cols.length + 1}"><div class="empty">ไม่มีครูในกลุ่มสาระนี้</div></td></tr>`}
    ${d.vac.map(r => `<tr class="muted"><td>⏳ ${esc(r.name)}</td>${U.loadArea ? '' : `<td>${esc(r.area)}</td>`}<td>${r.periods}</td><td>${r.subjects}</td><td>${r.classes}</td><td>${r.days}</td><td>${chip('ตำแหน่งว่าง (รอครู) · ไม่นำไปคิดค่าเฉลี่ย', 'info')}</td></tr>`).join('')}</tbody></table></div>
    <div class="muted small" style="margin-top:6px">ครูช่วยสอนเข้าคู่อาจไม่มีคาบของตัวเอง ไม่ใช่ข้อมูลผิด</div>
    ${U.loadArea ? '' : `<h2 style="margin-top:16px">เปรียบเทียบระหว่างกลุ่มสาระ</h2><div class="scroll"><table class="tbl"><thead><tr><th>กลุ่มสาระ/กลุ่มงาน</th><th>ครูทั้งหมด</th><th>มีคาบสอน</th><th>คาบรวม</th><th>เฉลี่ยต่อคน</th><th></th></tr></thead><tbody>
      ${d.byArea.map(g => `<tr><td><b>${esc(g.area)}</b></td><td>${g.teachers}</td><td>${g.teaching}</td><td>${g.total}</td><td><b>${fmt(g.avg)}</b></td><td style="min-width:140px"><div class="bar"><i style="width:${Math.round(g.avg * 100 / (d.byArea[0].avg || 1))}%"></i></div></td></tr>`).join('')}</tbody></table></div>`}</div>`;
}

/* ---------- ตารางสัปดาห์แบบอ่านอย่างเดียว ---------- */
function weekGrid(list, sub, printable) {
  if (printable) return `<table><thead><tr><th>วัน / คาบ</th>${PERIODS.map((t, p) => `<th>คาบ ${p + 1}${t[0] ? '<br>' + t[0] + '–' + t[1] : ''}</th>`).join('')}</tr></thead><tbody>${DAYS.map((dn, d) => `<tr><td><b>${dn}</b></td>${PERIODS.map((_, p) =>
    `<td class="c">${list.filter(e => e.day === d && e.p === p).map(e => `<b>${esc(code(e.subject))}</b><br><small>${esc(sub(e))}</small>`).join('<hr>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  let g = `<div class="tt" style="grid-template-columns:86px repeat(${PERIODS.length},minmax(96px,1fr));min-width:${86 + PERIODS.length * 100}px"><div></div>${PERIODS.map(([a, b], p) => `<div class="h">คาบ ${p + 1}${a ? `<br><span style="font-weight:400">${a}–${b}</span>` : ''}</div>`).join('')}`;
  DAYS.forEach((dn, d) => { g += `<div class="p" style="justify-content:center"><b style="color:var(--text)">${dn}</b></div>`;
    PERIODS.forEach((_, p) => { const es = list.filter(e => e.day === d && e.p === p), bad = new Set(es.map(e => e.subject)).size > 1;
      g += es.length ? `<div class="c on" ${bad ? 'style="box-shadow:0 0 0 2px var(--bad) inset"' : ''}>${es.map(e => `<b>${esc(code(e.subject))}</b>${esc(sub(e))}`).join('<br>')}</div>` : '<div class="c"></div>'; }); });
  return g + '</div>';
}

/* ================= ฝ่ายวัดผลและประเมินผล ================= */
const MS = [['scores', 'คะแนนและประกาศผล'], ['pending', 'นักเรียน 0 ร มส.'], ['teacher', 'ตารางสอนรายครู'], ['class', 'ตารางเรียนรายห้อง'], ['load', 'ภาระงานสอนและตารางชน']];
function msScores() {
  const U = S.dui, rows = courses(), areas = [...new Set(rows.map(r => r.area))].sort(sortTh), list = rows.filter(r => (!U.area || r.area === U.area) && (!U.status || r.status === U.status));
  const n = s => rows.filter(r => r.status === s).length, pub = rows.filter(r => r.p && r.p.published).length;
  return `<div class="grid g4" style="margin-bottom:16px">${kpi('รายวิชา-ห้อง ทั้งหมด', rows.length)}${kpi('คะแนนครบ', n('done'), '', 'ok')}${kpi('กำลังกรอก', n('doing'), '', 'warn')}${kpi('ยังไม่เริ่ม / ยังไม่ซิงก์', n('none'), `เผยแพร่แล้ว ${pub} วิชา`, 'bad')}</div>
    <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><div class="grow"><h2 style="margin:0">ติดตามการส่งคะแนน</h2>
      <div class="muted small">นับจากรายวิชาในตารางสอน เทียบกับสมุดคะแนน · รายวิชาของครูท่านอื่นจะขึ้นตัวเลขเมื่อเชื่อมฐานข้อมูลกลาง</div></div>
      ${sel('area', areas, U.area, 'กลุ่มสาระ', 'ทุกกลุ่มสาระ')}${sel('status', Object.keys(SCORE_ST).map(k => [k, SCORE_ST[k][0]]), U.status, 'สถานะ', 'ทุกสถานะ')}
      <button class="btn sm" data-dp="printLeft">${ic('print')}พิมพ์รายวิชาที่ยังไม่ครบ</button></div>
    <div class="muted small" style="margin-bottom:6px">แสดง ${list.length} รายการ</div>
    ${list.length ? `<div class="scroll" style="max-height:62vh"><table class="tbl"><thead><tr><th>กลุ่มสาระ</th><th>ครูผู้สอน</th><th>รายวิชา</th><th>ห้อง</th><th>เริ่มกรอก</th><th>ครบรายคน</th><th>0 / มส.</th><th>สถานะ</th><th>ประกาศผล</th></tr></thead><tbody>
      ${list.map(r => { const p = r.p, st = SCORE_ST[r.status];
        return `<tr><td>${esc(r.area)}</td><td>${esc(r.teacher)}</td><td>${esc(r.subject)}</td><td>${esc(r.className)}</td>
          <td style="min-width:110px">${p ? `<div class="bar"><i style="width:${Math.min(100, p.filledPct)}%"></i></div><span class="muted small">${fmt(p.filledPct)}%</span>` : '–'}</td>
          <td>${p ? p.complete + '/' + p.students : '–'}</td><td>${p ? `<span style="color:${p.zero + p.ms ? 'var(--bad)' : 'inherit'}">${p.zero} / ${p.ms}</span>` : '–'}</td><td>${chip(st[0], st[1])}</td>
          <td>${r.mine ? `<button class="btn sm ${p.published ? '' : 'pri'}" data-act="pubToggle" data-c="${r.classId}" ${r.status !== 'done' && !p.published ? 'disabled title="คะแนนยังไม่ครบ"' : ''}>${p.published ? 'ยกเลิกประกาศ' : 'ประกาศผล'}</button>` : '<span class="muted small">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty">${rows.length ? 'ไม่มีรายการตามตัวกรอง' : 'ยังไม่มีรายวิชาในตารางสอน'}</div>`}</div>`;
}
function msPending() {
  const U = S.dui, all = pendingItems(), open = all.filter(x => !x.fixed), levels = [...new Set(open.map(x => levelOf(x.c.name)))].sort(sortTh);
  const list = all.filter(x => (!U.prReason || x.reason === U.prReason) && (!U.prLevel || levelOf(x.c.name) === U.prLevel)).sort((a, b) => sortTh(a.c.name, b.c.name) || a.s.no - b.s.no);
  const by = r => open.filter(x => x.reason === r).length, sids = new Set(open.map(x => x.c.id + x.s.id)), perStu = {};
  open.forEach(x => { const k = x.s.id; perStu[k] = (perStu[k] || 0) + 1; });
  const total = S.classes.reduce((n, c) => n + c.students.length, 0);
  const badge = r => chip(r, r === 'แก้ผ่าน' ? 'ok' : r === 'ร' ? 'warn' : 'bad');
  return `<div class="grid g4" style="margin-bottom:16px">${kpi('นักเรียนที่ยังติด', sids.size, total ? fmt(sids.size * 100 / total) + '% ของนักเรียนในรายวิชา' : '', 'bad')}${kpi('ติด 0', by('0'), '', 'bad')}${kpi('ติด ร / มส.', by('ร') + ' / ' + by('มส'), '', 'warn')}${kpi('แก้ผ่านแล้ว', all.filter(x => x.fixed).length, `ติดตั้งแต่ 3 วิชา ${Object.values(perStu).filter(v => v >= 3).length} คน`, 'ok')}</div>
    <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><div class="grow"><h2 style="margin:0">นักเรียนที่มีผลการเรียน 0 ร มส. ทั้งโรงเรียน</h2>
      <div class="muted small">0 = คะแนนครบแต่ไม่ผ่าน · ร = เริ่มกรอกแล้วแต่คะแนนยังไม่ครบ · มส. = เวลาเรียนต่ำกว่า ${A() ? num(A().termCur().minAtt) || 80 : 80}% · ใช้ติดตามการสอบแก้ตัว</div></div>
      ${sel('prReason', ['0', 'ร', 'มส', 'แก้ผ่าน'], U.prReason, 'ผลที่ติด', 'ทุกผล')}${sel('prLevel', levels, U.prLevel, 'ระดับชั้น', 'ทุกระดับชั้น')}<button class="btn sm" data-dp="printPending">${ic('print')}พิมพ์บัญชีรายชื่อ</button></div>
    ${levels.length ? `<div class="scroll" style="margin-bottom:10px"><table class="tbl"><thead><tr><th>ระดับชั้น</th><th>นักเรียน</th><th>รายวิชาที่ติด</th></tr></thead><tbody>${levels.map(lv => { const l = open.filter(x => levelOf(x.c.name) === lv); return `<tr><td>${lv}</td><td>${new Set(l.map(x => x.s.id)).size}</td><td>${l.length}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
    ${list.length ? `<div class="scroll" style="max-height:56vh"><table class="tbl"><thead><tr><th>นักเรียน</th><th>ห้อง</th><th>รายวิชา</th><th>ผล</th><th>เวลาเรียน</th><th>ครูผู้สอน</th></tr></thead><tbody>
      ${list.map(x => `<tr><td><b>${esc(x.s.name)}</b><div class="muted small">เลขที่ ${x.s.no} · ${esc(x.s.id)}</div></td><td>${esc(x.c.name)}</td><td>${esc(x.subject)}</td><td>${badge(x.reason)}</td><td>${x.att === null ? '–' : fmt(x.att) + '%'}</td><td>${esc(x.teacher)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty">ไม่มีนักเรียนที่ค้างผลการเรียน${U.prReason || U.prLevel ? 'ตามตัวกรอง' : ''}</div>`}</div>`;
}
function msGrid(byTeacher) {
  const U = S.dui, all = entries();
  const opts = byTeacher ? [...new Set(S.staff.filter(isTeacher).map(u => u.name).concat(all.map(e => e.teacher)))].sort((a, b) => isVacN(a) - isVacN(b) || sortTh(a, b)).map(n => [n, `${isVacN(n) ? '⏳ ' : ''}${n}${isVacN(n) ? ' (ตำแหน่งว่าง)' : ''} (${all.filter(e => e.teacher === n).length} คาบ)`])
    : (A() ? S.rooms : S.classes).slice().sort((a, b) => sortTh(a.name, b.name)).map(r => [r.id, `${r.name} (${all.filter(e => e.classId === r.id).length} คาบ)`]);
  const key = byTeacher ? 'msT' : 'msC';
  if (!opts.some(o => o[0] === U[key])) U[key] = byTeacher ? (all.some(e => e.teacher === S.me.name) ? S.me.name : (opts[0] || [''])[0]) : ((opts.find(o => all.some(e => e.classId === o[0])) || opts[0] || [''])[0]);
  const mine = all.filter(e => (byTeacher ? e.teacher : e.classId) === U[key]), sub = byTeacher ? e => roomName(e.classId) : e => e.teacher.replace(/^ครู/, '');
  const title = byTeacher ? 'ตารางสอน ' + U[key] : 'ตารางเรียน ' + roomName(U[key]);
  return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><h2 class="grow" style="margin:0">${esc(title)}</h2>${sel(key, opts, U[key], byTeacher ? 'ครู' : 'ห้องเรียน')}
      <span class="muted small">${mine.length} คาบ/สัปดาห์</span><button class="btn sm" data-dp="printGrid" data-k="${byTeacher ? 't' : 'c'}">${ic('print')}พิมพ์</button></div>
    ${mine.length ? `<div class="scroll">${weekGrid(mine, sub)}</div>` : '<div class="empty">ยังไม่มีคาบในตาราง</div>'}
    <div class="muted small" style="margin-top:8px">แสดงตารางที่ใช้อยู่จริงของ ${termText()} · แก้ตารางได้ที่ ตั้งค่าโรงเรียน › ตารางสอนทั้งโรงเรียน · กรอบแดง = ต่างวิชาในคาบเดียวกัน</div></div>`;
}
function msLoad() {
  const c = clashes(entries()), item = l => `<div class="row"><div class="grow"><div class="t">${slotText(l[0])}</div><div class="muted small">${l.map(e => `${esc(e.subject)} — ${esc(roomName(e.classId))} · ${esc(e.teacher)}`).join('<br>')}</div></div></div>`;
  return `<div class="grid g2" style="align-items:start"><div class="card"><h2>ครูสอนชนคาบ ${chip(c.teacher.length, c.teacher.length ? 'bad' : 'ok')}</h2><div class="muted small">ครูคนเดียวมีต่างวิชาในคาบเดียวกัน (สอนวิชาเดียวกันหลายห้องพร้อมกันถือเป็นการรวมห้อง ไม่นับ)</div>
      ${c.teacher.length ? `<div class="list">${c.teacher.map(item).join('')}</div>` : '<div class="empty">ไม่พบครูสอนชนคาบ</div>'}</div>
    <div class="card"><h2>ห้องที่มีหลายวิชาในคาบเดียว ${chip(c.klass.length, c.klass.length ? 'warn' : 'ok')}</h2><div class="muted small">อาจเป็นการแยกกลุ่มเรียน/วิชาเลือก ตรวจว่าตั้งใจหรือไม่</div>
      ${c.klass.length ? `<div class="list">${c.klass.map(item).join('')}</div>` : '<div class="empty">ไม่พบ</div>'}</div></div>` + loadCard();
}
P['a-measure'] = () => { const v = MS.some(x => x[0] === S.dui.ms) ? S.dui.ms : 'scores';
  return hd('ฝ่ายวัดผลและประเมินผล', `คะแนน · ผลการเรียนที่ต้องติดตาม · ตารางสอน · ภาระงานสอน · ${termText()}`) + tabs(MS, v, 'ms') +
    ({ scores: msScores, pending: msPending, teacher: () => msGrid(true), class: () => msGrid(false), load: msLoad })[v](); };

/* ================= ฝ่ายวิชาการ ================= */
const AC = [['tasks', 'งานตามรอบปี'], ['exams', 'ตารางสอบ'], ['calendar', 'ปฏิทินวิชาการ'], ['review', 'ตรวจโครงสร้างรายวิชา'], ['scores', 'ภาพรวมการส่งผลการเรียน']];
const TASK_GROUPS = ['หลักสูตร', 'การเรียนการสอน', 'วัดผลประเมินผล', 'ทะเบียน', 'ทดสอบระดับชาติ', 'นิเทศ/ประกันคุณภาพ', 'แนะแนว/รับนักเรียน', 'ทั่วไป'];
const MONTHS = [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4];
const monthName = m => new Date(2026, m - 1, 1).toLocaleDateString((window.EMSLang && EMSLang.locale()) || 'th-TH', { month: 'long' });
const DEFAULT_TASKS = [
  [5, 'ทั่วไป', 'ประชุมวางแผนและจัดทำแผนปฏิบัติการงานวิชาการประจำปี'], [5, 'หลักสูตร', 'ทบทวนหลักสูตรสถานศึกษา โครงสร้างรายวิชา และคำอธิบายรายวิชา'],
  [5, 'การเรียนการสอน', 'จัดครูเข้าสอนและจัดตารางสอน ภาคเรียนที่ 1'], [5, 'ทั่วไป', 'เปิดภาคเรียนที่ 1 / ปฐมนิเทศนักเรียน ม.1'],
  [5, 'การเรียนการสอน', 'ครูส่งแผนการจัดการเรียนรู้และโครงการสอน ภาคเรียนที่ 1'], [6, 'ทะเบียน', 'รายงานข้อมูลจำนวนนักเรียน ณ 10 มิถุนายน'],
  [6, 'หลักสูตร', 'นักเรียนเลือกชุมนุม / จัดกิจกรรมพัฒนาผู้เรียน'], [6, 'วัดผลประเมินผล', 'คัดกรองการอ่านการเขียน ม.1 และนักเรียนที่ต้องช่วยเหลือ'],
  [7, 'วัดผลประเมินผล', 'สอบกลางภาคเรียนที่ 1'], [7, 'นิเทศ/ประกันคุณภาพ', 'นิเทศการจัดการเรียนการสอน ภาคเรียนที่ 1'],
  [8, 'วัดผลประเมินผล', 'ติดตามนักเรียนที่ไม่ผ่านกลางภาคและการสอนซ่อมเสริม'], [8, 'การเรียนการสอน', 'กิจกรรมสัปดาห์วิทยาศาสตร์ / กิจกรรมวิชาการ'],
  [9, 'วัดผลประเมินผล', 'สอบปลายภาคเรียนที่ 1'], [9, 'วัดผลประเมินผล', 'ประเมินคุณลักษณะอันพึงประสงค์ และการอ่าน คิดวิเคราะห์ และเขียน ภาคเรียนที่ 1'],
  [10, 'วัดผลประเมินผล', 'ครูส่ง ปพ.5 และอนุมัติผลการเรียน ภาคเรียนที่ 1'], [10, 'ทะเบียน', 'บันทึกผลการเรียนในระบบ SGS ภาคเรียนที่ 1'],
  [10, 'วัดผลประเมินผล', 'สอบแก้ตัวนักเรียนที่ได้ 0 ร มส. ภาคเรียนที่ 1'], [10, 'การเรียนการสอน', 'จัดครูเข้าสอนและจัดตารางสอน ภาคเรียนที่ 2'],
  [11, 'ทั่วไป', 'เปิดภาคเรียนที่ 2'], [11, 'ทะเบียน', 'รายงานข้อมูลจำนวนนักเรียน ณ 10 พฤศจิกายน'],
  [11, 'การเรียนการสอน', 'ครูส่งแผนการจัดการเรียนรู้และโครงการสอน ภาคเรียนที่ 2'], [12, 'วัดผลประเมินผล', 'สอบกลางภาคเรียนที่ 2'],
  [12, 'นิเทศ/ประกันคุณภาพ', 'นิเทศการจัดการเรียนการสอน ภาคเรียนที่ 2'], [12, 'ทดสอบระดับชาติ', 'เตรียมความพร้อมนักเรียน ม.3 ก่อนสอบ O-NET'],
  [1, 'แนะแนว/รับนักเรียน', 'แนะแนวการศึกษาต่อนักเรียน ม.3'], [1, 'แนะแนว/รับนักเรียน', 'วางแผนรับนักเรียน ม.1 ปีการศึกษาถัดไป'],
  [2, 'ทดสอบระดับชาติ', 'สอบ O-NET ชั้น ม.3'], [2, 'วัดผลประเมินผล', 'สอบปลายภาคเรียนที่ 2'],
  [3, 'วัดผลประเมินผล', 'ครูส่ง ปพ.5 และอนุมัติผลการเรียน ภาคเรียนที่ 2'], [3, 'ทะเบียน', 'จัดทำ ปพ.1 ปพ.2 ปพ.3 ผู้จบการศึกษาชั้น ม.3'],
  [3, 'วัดผลประเมินผล', 'สอบแก้ตัวนักเรียนที่ได้ 0 ร มส. ภาคเรียนที่ 2'], [3, 'แนะแนว/รับนักเรียน', 'รับสมัครและสอบคัดเลือกนักเรียน ม.1'],
  [3, 'การเรียนการสอน', 'ครูส่งรายงานวิจัยในชั้นเรียน / บันทึกหลังการสอน'], [4, 'นิเทศ/ประกันคุณภาพ', 'จัดทำรายงานการประเมินตนเองของสถานศึกษา (SAR)'],
  [4, 'วัดผลประเมินผล', 'สรุปผลสัมฤทธิ์ทางการเรียนประจำปี'], [4, 'หลักสูตร', 'ทบทวนหลักสูตรและวางแผนจัดครูเข้าสอนปีการศึกษาถัดไป']];
const tasksOf = y => S.acadTasks[y] = S.acadTasks[y] || [];
const ceDate = (y, m) => (num(y) - 543 + (m <= 4 ? 1 : 0)) + '-' + String(m).padStart(2, '0') + '-01';
/* แยกส่วนหัวของหน้าเดิมออก เหลือปุ่มด้านขวาไว้ใช้ในแท็บ */
const stripHead = html => { const m = html.match(/^\s*<div class="top"><div><h1>[\s\S]*?<\/h1>(?:<p>[\s\S]*?<\/p>)?<\/div><div style="display:flex;gap:8px;flex-wrap:wrap">([\s\S]*?)<\/div><\/div>/);
  return m ? (m[1] ? `<div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:12px">${m[1]}</div>` : '') + html.slice(m[0].length) : html; };
function acTasks() {
  const y = S.term.year, list = tasksOf(y), g = S.dui.taskGroup, shown = list.filter(t => !g || t.group === g), done = list.filter(t => t.done).length, nowM = new Date().getMonth() + 1;
  if (!list.length) return `<div class="card"><div class="empty">ยังไม่มีรายการงานของปีการศึกษา ${esc(y)}<div style="margin-top:12px"><button class="btn pri" data-dp="taskSeed">เริ่มจากแม่แบบงานวิชาการ ม.ต้น (${DEFAULT_TASKS.length} งาน)</button></div>
    <div class="small" style="margin-top:8px">แม่แบบแก้ไข/ลบ/เพิ่มได้ทั้งหมดตามบริบทของโรงเรียน</div></div></div>`;
  return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><div class="grow"><h2 style="margin:0">งานวิชาการตามรอบปี · ปีการศึกษา ${esc(y)}</h2><div class="muted small">ติ๊กเมื่อเสร็จ · กด “ลงปฏิทิน” ให้ครูทุกคนเห็นกำหนดการ</div></div>
      ${sel('taskGroup', TASK_GROUPS, g, 'หมวดงาน', 'ทุกหมวดงาน')}<button class="btn sm pri" data-dp="taskAdd">${ic('plus')}เพิ่มงาน</button></div>
    <div class="row" style="border:0"><div class="bar grow"><i style="width:${done * 100 / list.length}%"></i></div><b>${done}/${list.length}</b><span class="muted small">งานเสร็จแล้ว</span></div>
    ${MONTHS.map(m => { const l = shown.filter(t => num(t.month) === m); if (!l.length) return '';
      return `<h3 style="margin:14px 0 4px;${m === nowM ? 'color:var(--brand)' : ''}">${monthName(m)} ${m === nowM ? chip('เดือนนี้', 'ok') : ''}</h3><div class="list">${l.map(t => { const onCal = t.eventId && (S.events || []).some(e => e.id === t.eventId);
        return `<div class="row" style="flex-wrap:wrap;${t.done ? 'opacity:.6' : ''}"><label style="display:flex;gap:8px;align-items:center;flex:1;min-width:220px;cursor:pointer"><input type="checkbox" data-dpf="taskDone" data-id="${t.id}" ${t.done ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--brand)">
          <span style="${t.done ? 'text-decoration:line-through' : ''}">${esc(t.title)}</span></label>${chip(esc(t.group || 'ทั่วไป'))}${onCal ? chip('ลงปฏิทินแล้ว', 'ok') : `<button class="btn sm" data-dp="taskCal" data-id="${t.id}">ลงปฏิทิน</button>`}
          <button class="btn sm ghost" data-dp="taskEdit" data-id="${t.id}">แก้</button>${t.done && t.doneBy ? `<div class="muted small" style="width:100%">เสร็จ ${thDate(String(t.doneAt).slice(0, 10))} · ${esc(t.doneBy)}</div>` : ''}${t.note ? `<div class="muted small" style="width:100%">${esc(t.note)}</div>` : ''}</div>`; }).join('')}</div>`; }).join('')}</div>`;
}
function taskEditor(t) {
  const x = t || { month: new Date().getMonth() + 1, group: 'ทั่วไป', title: '', note: '' };
  modal(`<h2 style="margin-bottom:12px">${t ? 'แก้ไขงาน' : 'เพิ่มงาน'} · ปีการศึกษา ${esc(S.term.year)}</h2>
    <div class="field"><label class="f" for="dp-tt">งาน</label><input id="dp-tt" class="in" value="${esc(x.title)}"></div>
    <div class="grid g2"><div class="field"><label class="f" for="dp-tm">เดือน</label><select id="dp-tm" class="in">${MONTHS.map(m => `<option value="${m}" ${m === num(x.month) ? 'selected' : ''}>${monthName(m)}</option>`).join('')}</select></div>
      <div class="field"><label class="f" for="dp-tg">หมวดงาน</label><select id="dp-tg" class="in">${TASK_GROUPS.map(g => `<option ${g === x.group ? 'selected' : ''}>${g}</option>`).join('')}</select></div></div>
    <div class="field"><label class="f" for="dp-tn">หมายเหตุ / ผู้รับผิดชอบ</label><textarea id="dp-tn" class="in" rows="2">${esc(x.note || '')}</textarea></div>
    <div style="display:flex;gap:8px">${t ? `<button class="btn" style="color:var(--bad)" data-dp="taskDel" data-id="${t.id}">ลบงานนี้</button>` : ''}<button class="btn pri" style="flex:1" data-dp="taskSave" data-id="${t ? t.id : ''}">บันทึก</button></div>`);
}
function acScores() {
  const rows = courses(), areas = [...new Set(rows.map(r => r.area))].sort(sortTh), p = pendingItems().filter(x => !x.fixed);
  return `<div class="grid g4" style="margin-bottom:16px">${kpi('รายวิชา-ห้อง', rows.length)}${kpi('คะแนนครบ', rows.filter(r => r.status === 'done').length, '', 'ok')}${kpi('ประกาศผลแล้ว', rows.filter(r => r.p && r.p.published).length)}${kpi('นักเรียนติด 0 ร มส.', new Set(p.map(x => x.s.id)).size, '', p.length ? 'bad' : 'ok')}</div>
    <div class="card"><h2>ความคืบหน้ารายกลุ่มสาระ</h2><div class="scroll"><table class="tbl"><thead><tr><th>กลุ่มสาระ</th><th>รายวิชา-ห้อง</th><th>ครบ</th><th>กำลังกรอก</th><th>ยังไม่เริ่ม/ยังไม่ซิงก์</th><th></th></tr></thead><tbody>
      ${areas.map(a => { const l = rows.filter(r => r.area === a), d = l.filter(r => r.status === 'done').length;
        return `<tr><td><b>${esc(a)}</b></td><td>${l.length}</td><td>${d}</td><td>${l.filter(r => r.status === 'doing').length}</td><td>${l.filter(r => r.status === 'none').length}</td><td style="min-width:140px"><div class="bar"><i style="width:${l.length ? d * 100 / l.length : 0}%"></i></div></td></tr>`; }).join('')}</tbody></table></div>
      <div class="row"><div class="grow muted small">รายละเอียดรายวิชา การประกาศผล และบัญชีนักเรียน 0 ร มส. อยู่ที่ฝ่ายวัดผล</div><button class="btn sm" data-act="go" data-p="a-measure">เปิดฝ่ายวัดผล</button></div></div>`;
}
/* ---------- ตารางสอบ: รับกำหนดการสอบจากครู แล้วจัดวัน/เวลา/สถานที่ให้รายการ “นอกตาราง” ---------- */
const EX = () => window.EMSExams;
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
function examRows() { const k = S.dui.exKind; return (S.examReqs || []).filter(r => r.term === EX().termKey() && r.kind === k && r.status !== 'draft'); }
const exRooms = r => (r.rooms && r.rooms.length ? r.rooms : EX().roomsOf(r.code));
const exStudents = r => exRooms(r).reduce((n, x) => n + num(x.students), 0);
function examClash(r, all) {             // ห้องเดียวกันมีสอบสองวิชาทับเวลากัน
  if (!r.date || !r.start) return false; const mine = new Set(exRooms(r).map(x => x.classId));
  return all.some(x => x !== r && x.mode === 'out' && x.date === r.date && x.start && exRooms(x).some(y => mine.has(y.classId)) && toMin(x.start) < toMin(r.start) + num(r.minutes) && toMin(r.start) < toMin(x.start) + num(x.minutes));
}
function acExams() {
  const k = S.dui.exKind, rows = examRows(), out = rows.filter(r => r.mode === 'out'), inn = rows.filter(r => r.mode === 'in'), none = rows.filter(r => r.mode === 'none');
  const sent = new Set(rows.map(r => r.code)), miss = {};
  courses().forEach(c => { const cd = code(c.subject); if (sent.has(cd)) return; const m = miss[cd] = miss[cd] || { cd, subject: c.subject, teachers: new Set(), rooms: [] }; m.teachers.add(c.teacher); m.rooms.push(c.className); });
  const missing = Object.values(miss).sort((a, b) => sortTh(a.cd, b.cd));
  const done = out.filter(r => r.date && r.start).length, clashN = out.filter(r => examClash(r, rows)).length;
  out.sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || (a.start || '').localeCompare(b.start || '') || sortTh(a.code, b.code));
  const roomsTxt = r => exRooms(r).map(x => esc(x.className)).join(', ');
  return `<div class="pills" style="margin-bottom:12px">${EX().KINDS.map(([v, l]) => `<button class="pill" aria-pressed="${k === v}" data-dp="view" data-key="exKind" data-k="${v}">${l}</button>`).join('')}</div>
    <div class="grid g4" style="margin-bottom:16px">${kpi('รายวิชาที่ส่งแล้ว', rows.length, `นอกตาราง ${out.length} · ในตาราง ${inn.length} · ไม่มีสอบ ${none.length}`)}${kpi('นอกตาราง รอจัด', out.length - done, '', out.length - done ? 'warn' : 'ok')}${kpi('จัดลงตารางแล้ว', done, clashN ? `ห้องสอบทับเวลา ${clashN} รายวิชา` : '', clashN ? 'bad' : 'ok')}${kpi('รายวิชายังไม่ส่ง', missing.length, 'นับรหัสวิชาในตารางสอน', missing.length ? 'bad' : 'ok')}</div>
    <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><div class="grow"><h2 style="margin:0">จัดตาราง${EX().kindName(k)} · นอกตาราง</h2>
      <div class="muted small">หนึ่งแถวต่อหนึ่งรายวิชา ครอบคลุมทุกห้องที่เรียนวิชานั้น (สอบพร้อมกัน) · กรอกวันที่ เวลาเริ่ม และสถานที่ — เวลาเลิกคิดจากเวลาสอบที่ครูขอ</div></div>
      <button class="btn sm" data-dp="printExam">${ic('print')}พิมพ์ตารางสอบ</button></div>
    ${out.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>รายวิชา</th><th>ห้องที่สอบ</th><th>ผู้ส่ง</th><th>นักเรียน</th><th>เวลาสอบ</th><th>วันที่</th><th>เริ่ม</th><th>สถานที่</th><th>สถานะ</th></tr></thead><tbody>
      ${out.map(r => { const cl = examClash(r, rows);
        return `<tr><td><b>${esc(r.code)}</b><div class="muted small">${esc(String(r.subject).replace(r.code, '').trim())}</div>${r.note ? `<div class="muted small">📝 ${esc(r.note)}</div>` : ''}</td>
          <td class="small">${roomsTxt(r)}<div class="muted">${exRooms(r).length} ห้อง</div></td><td class="small">${esc(r.teacher)}</td><td>${exStudents(r) || '–'}</td><td>${r.minutes} นาที</td>
          <td><input class="in" type="date" style="width:150px" value="${esc(r.date || '')}" data-dpf="exDate" data-id="${r.id}" aria-label="วันที่สอบ ${esc(r.code)}"></td>
          <td><input class="in" type="time" style="width:110px" value="${esc(r.start || '')}" data-dpf="exStart" data-id="${r.id}" aria-label="เวลาเริ่ม"><div class="muted small">${r.start ? 'ถึง ' + EX().endOf(r.start, r.minutes) : ''}</div></td>
          <td><input class="in" style="width:130px;text-align:left" value="${esc(r.place || '')}" placeholder="ห้องสอบ" data-dpf="exPlace" data-id="${r.id}" aria-label="สถานที่สอบ"></td>
          <td>${cl ? chip('ห้องสอบทับเวลา', 'bad') : r.status === 'changed' ? chip('ครูแก้ไข · รอส่งใหม่', 'warn') : r.date && r.start ? chip('จัดแล้ว', 'ok') : chip('รอจัด', 'warn')}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีรายวิชาที่ขอสอบนอกตาราง</div>'}</div>
    <div class="grid g2" style="align-items:start"><div class="card"><h2>สอบในตาราง ${chip(inn.length, 'info')}</h2><div class="muted small" style="margin-bottom:6px">สอบในคาบเรียนของแต่ละห้อง — วิชาการรับทราบ ไม่ต้องจัด</div>
      ${inn.length ? `<div class="list">${inn.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.code)} · ${roomsTxt(r)}</div><div class="muted small">ส่งโดย ${esc(r.teacher)} · ${r.minutes} นาที${r.date ? ' · ' + thDate(r.date) : ''}${r.note ? ' · ' + esc(r.note) : ''}</div></div></div>`).join('')}</div>` : '<div class="empty">ไม่มี</div>'}
      ${none.length ? `<h3 style="font-size:.95rem;margin:12px 0 4px">แจ้งว่าไม่มีสอบ</h3><div class="muted small">${none.map(r => esc(r.code) + ' (' + esc(r.teacher) + ')').join(' · ')}</div>` : ''}</div>
    <div class="card"><h2>รายวิชายังไม่ส่งกำหนดการสอบ ${chip(missing.length, missing.length ? 'bad' : 'ok')}</h2><div class="muted small" style="margin-bottom:6px">ครูคนใดคนหนึ่งในรายวิชาส่งครั้งเดียวก็ครบ · ส่งได้ที่หน้า สรุป / ส่งออก ปพ.5</div>
      ${missing.length ? `<div class="list">${missing.slice(0, 40).map(m => `<div class="row"><div class="grow"><div class="t">${esc(m.cd)} · ${m.rooms.map(esc).join(', ')}</div><div class="muted small">ครูผู้สอน: ${[...m.teachers].map(esc).join(', ')}</div></div></div>`).join('')}</div>` : '<div class="empty">ส่งครบทุกรายวิชา</div>'}</div></div>`;
}
P['a-academic'] = () => { const v = AC.some(x => x[0] === S.dui.ac) ? S.dui.ac : 'tasks';
  return hd('ฝ่ายวิชาการ', `ปฏิทินวิชาการ · งานตามรอบปี · โครงสร้างรายวิชา · ปีการศึกษา ${esc(S.term.year)}`) + tabs(AC, v, 'ac') +
    ({ tasks: acTasks, exams: acExams, calendar: () => stripHead(P['a-calendar']()), review: () => stripHead(P['a-review']()), scores: acScores })[v](); };

/* ================= ภาพรวมผู้บริหาร (ข้อมูลจริง) ================= */
const ST = [['p', 'มา', '#22c55e'], ['s', 'สาย', '#f59e0b'], ['l', 'ลา', '#38bdf8'], ['c', 'กิจกรรม', '#8b5cf6'], ['a', 'ขาด', '#ef4444']];
function attData() {
  const statuses = { p: 0, s: 0, l: 0, c: 0, a: 0 }, areas = {}; let records = 0;
  Object.keys(S.att).forEach(k => { if (/\|hr$/.test(k)) return; const cid = k.split('|')[0], c = cls(cid); if (!c) return;
    const rec = S.att[k] || {}, vals = Object.values(rec).filter(v => statuses[v] !== undefined); if (!vals.length) return; records++;
    const ar = areaOf(S.me.name), A1 = areas[ar] = areas[ar] || { checked: 0, a: 0, subjects: {} }, sb = A1.subjects[c.subject] = A1.subjects[c.subject] || { checked: 0, a: 0, l: 0 };
    vals.forEach(v => { statuses[v]++; A1.checked++; sb.checked++; if (v === 'a') { A1.a++; sb.a++; } if (v === 'l') sb.l++; }); });
  const risks = []; S.classes.forEach(c => c.students.forEach(s => { const a = M().attOf(c.id, s.id); if (a.pct !== null && a.pct < 80) risks.push({ s, c, pct: a.pct }); }));
  risks.sort((a, b) => a.pct - b.pct);
  return { statuses, areas, records, risks };
}
const weekdays = (f, t) => { let n = 0, d = new Date(f + 'T00:00:00'); const e = new Date((t || f) + 'T00:00:00'); for (let g = 0; d <= e && g < 400; g++, d.setDate(d.getDate() + 1)) if (d.getDay() > 0 && d.getDay() < 6) n++; return n; };
window.EMSExecCore = () => {
  const d = attData(), total = Object.values(d.statuses).reduce((a, b) => a + b, 0), attended = total - d.statuses.a;   // เหมือน KruSpace: มา/สาย/ลา/กิจกรรม ไม่นับเป็นขาด
  const rate = total ? attended * 100 / total : 0, students = A() ? S.rooms.reduce((n, r) => n + (cls(r.id) ? cls(r.id).students.length : num(r.count)), 0) : S.classes.reduce((n, c) => n + c.students.length, 0);
  let at = 0; const parts = ST.map(([k, , col]) => { const deg = total ? d.statuses[k] * 360 / total : 0, s = `${col} ${at}deg ${at + deg}deg`; at += deg; return s; });
  const areaNames = Object.keys(d.areas).sort(sortTh), selA = areaNames.indexOf(S.dui.execArea) >= 0 ? S.dui.execArea : areaNames[0] || '', area = d.areas[selA];
  const grades = []; S.classes.forEach(c => { if (!M().summaryRows) return; M().summaryRows(c, EMSBook.book(c.id)).forEach(x => { if (x.r.complete && !isNaN(parseFloat(x.grade))) grades.push(parseFloat(x.grade)); }); });
  const lv = {}; (S.leaves || []).filter(l => l.status === 'approved' || l.status === 'submitted').forEach(l => { const r = lv[l.by] = lv[l.by] || { name: l.by, times: 0, days: 0 }; r.times++; r.days += weekdays(l.from, l.to); });
  const lvRows = Object.values(lv).sort((a, b) => b.days - a.days || b.times - a.times);
  const cv = {}; (S.xreqs || []).filter(r => r.status === 'accepted').forEach(r => { const x = cv[r.target] = cv[r.target] || { name: r.target, sub: 0, total: 0 }; x.total += (r.src || []).length || 1; if (r.type !== 'exchange') x.sub += (r.src || []).length || 1; });
  const cvRows = Object.values(cv).sort((a, b) => b.total - a.total), waiting = (S.leaves || []).filter(l => l.status === 'submitted').length;
  const cs = S.courseSub || [], csN = k => cs.filter(c => c.status === k).length, pend = window.EMSPendingItems ? EMSPendingItems() : [];
  const row5 = (list, cols) => list.length ? `<div class="scroll"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${list.slice(0, 5).map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีข้อมูล</div>';
  return hd('ภาพรวมผู้บริหาร', `${termText()} · อ่านอย่างเดียว · คลิกกลุ่มสาระเพื่อเจาะดู`) +
    `<div class="grid g4">${kpi('นักเรียน', students.toLocaleString(), `${A() ? S.rooms.length : S.classes.length} ห้อง`)}${kpi('บุคลากร', S.staff.filter(u => !isVac(u)).length, `ครูผู้สอน ${S.staff.filter(isTeacher).length}${S.staff.some(isVac) ? ' · ตำแหน่งว่าง ' + S.staff.filter(isVac).length : ''}`)}
      ${kpi('อัตราเข้าเรียนรวม', total ? fmt(rate) + '%' : '–', `${d.records} คาบที่บันทึก · ขาด ${d.statuses.a} รายการ`, rate >= 80 ? 'ok' : 'warn')}${kpi('เกรดเฉลี่ย', grades.length ? fmt(grades.reduce((a, b) => a + b, 0) / grades.length, 2) : '–', `${grades.length} คนที่คะแนนครบ`)}</div>
    <div class="grid g2" style="align-items:start;margin-top:16px"><div class="card"><h2>สัดส่วนสถานะการเข้าเรียน</h2>
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap"><div style="width:150px;height:150px;border-radius:50%;background:conic-gradient(${total ? parts.join(',') : 'var(--line) 0 360deg'});display:grid;place-items:center" role="img" aria-label="สัดส่วนสถานะการเข้าเรียน">
        <div style="width:92px;height:92px;border-radius:50%;background:var(--surface);display:grid;place-items:center;text-align:center"><b style="font-size:1.3rem">${total}</b><span class="muted small" style="margin-top:-18px">รายการ</span></div></div>
        <div style="display:grid;gap:6px;flex:1;min-width:140px">${ST.map(([k, l, col]) => `<div style="display:flex;gap:8px;align-items:center"><i style="width:12px;height:12px;border-radius:3px;background:${col}"></i><span class="grow">${l}</span><b>${d.statuses[k]}</b><span class="muted small" style="width:48px;text-align:right">${total ? fmt(d.statuses[k] * 100 / total) + '%' : ''}</span></div>`).join('')}</div></div></div>
      <div class="card"><h2>กลุ่มสาระการเรียนรู้</h2>${areaNames.length ? `<div class="list">${areaNames.map(n => { const a = d.areas[n], r = a.checked ? (a.checked - a.a) * 100 / a.checked : 0;
        return `<button class="row" style="width:100%;text-align:left;font:inherit;color:inherit;background:${n === selA ? 'var(--surface2)' : 'none'};border-left:0;border-right:0;border-bottom:0;cursor:pointer;padding-left:8px" data-dp="execArea" data-k="${esc(n)}"><div class="grow"><div class="t">${esc(n)}</div><div class="muted small">${Object.keys(a.subjects).length} วิชา · ${a.checked} รายการ</div></div><b>${fmt(r)}%</b></button>`; }).join('')}</div>` : '<div class="empty">ยังไม่มีข้อมูลเช็กชื่อ</div>'}
        <div class="muted small" style="margin-top:6px">ข้อมูลของครูท่านอื่นจะรวมเข้ามาเมื่อเชื่อมฐานข้อมูลกลาง</div></div></div>
    <div class="card"><h2>รายละเอียดรายวิชา · ${esc(selA || 'ยังไม่มีข้อมูล')}</h2><div class="scroll"><table class="tbl"><thead><tr><th>รายวิชา</th><th>รายการทั้งหมด</th><th>มา/สาย/ลา/กิจกรรม</th><th>ขาด</th><th>อัตราเข้าเรียน</th></tr></thead><tbody>
      ${area ? Object.entries(area.subjects).map(([n, x]) => `<tr><td><b>${esc(n)}</b></td><td>${x.checked}</td><td>${x.checked - x.a}</td><td style="color:${x.a ? 'var(--bad)' : 'inherit'}">${x.a}</td><td>${fmt(x.checked ? (x.checked - x.a) * 100 / x.checked : 0)}%</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty">ยังไม่มีข้อมูล</div></td></tr>'}</tbody></table></div></div>
    <div class="card"><h2>นักเรียนที่ควรติดตาม ${chip(d.risks.length + ' รายการ', d.risks.length ? 'bad' : 'ok')}</h2><div class="muted small" style="margin-bottom:6px">เวลาเรียนรายวิชาต่ำกว่า 80% — มีสิทธิ์ได้ มส.</div>
      ${d.risks.length ? `<div class="scroll" style="max-height:340px"><table class="tbl"><thead><tr><th>นักเรียน</th><th>ห้อง</th><th>วิชา</th><th>เข้าเรียน</th><th>ผลคาดการณ์</th></tr></thead><tbody>${d.risks.slice(0, 100).map(x => `<tr><td><b>${esc(x.s.name)}</b></td><td>${esc(x.c.name)}</td><td>${esc(x.c.subject)}</td><td>${fmt(x.pct)}%</td><td>${chip(x.pct < 60 ? 'เสี่ยง มส. สูง' : 'เฝ้าระวัง', x.pct < 60 ? 'bad' : 'warn')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ไม่มีนักเรียนต่ำกว่าเกณฑ์ 80%</div>'}</div>
    <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">การลาและการสอนแทน</h2><div class="muted small">รวม ${lvRows.reduce((a, r) => a + r.times, 0)} ครั้ง · ${lvRows.reduce((a, r) => a + r.days, 0)} วัน · ใบลารออนุมัติ ${waiting} รายการ</div></div><button class="btn sm pri" data-act="go" data-p="a-leaves">เปิดหน้าการลาและการอนุมัติ</button></div>
      <div class="grid g2" style="align-items:start"><div><h3 style="font-size:.95rem;margin:8px 0">ลามากที่สุด 5 อันดับ</h3>${row5(lvRows, [['ครู', r => `<b>${esc(r.name)}</b>`], ['กลุ่มสาระ', r => esc(areaOf(r.name))], ['ครั้ง', r => r.times], ['วัน', r => r.days]])}</div>
        <div><h3 style="font-size:.95rem;margin:8px 0">สอนแทน/แลกคาบมากที่สุด 5 อันดับ</h3>${row5(cvRows, [['ครู', r => `<b>${esc(r.name)}</b>`], ['กลุ่มสาระ', r => esc(areaOf(r.name))], ['สอนแทน', r => r.sub], ['รวม (คาบ)', r => `<b>${r.total}</b>`]])}</div></div></div>
    <div class="grid g2" style="align-items:start"><div class="card"><h2>โครงสร้างรายวิชา</h2><div class="grid g2">${kpi('อนุมัติแล้ว', csN('approved'), '', 'ok')}${kpi('รอหัวหน้าตรวจ', csN('submitted'), '', 'warn')}${kpi('ส่งกลับแก้ไข', csN('revise'), '', 'bad')}${kpi('ร่าง', csN('draft'))}</div></div>
      <div class="card"><h2>รอการตัดสินใจ ${chip(pend.length, pend.length ? 'warn' : 'ok')}</h2>${pend.length ? `<div class="list">${pend.slice(0, 5).map(p => `<div class="row"><div class="ico gold">${ic(p.icon)}</div><div class="grow"><div class="t">${esc(p.what)}</div><div class="muted small">${esc(p.who)} · ${thDate(p.date)}</div></div></div>`).join('')}</div>` : '<div class="empty">ไม่มีรายการค้าง</div>'}</div></div>` + loadCard();
};

/* ================= เหตุการณ์ ================= */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-dp]'); if (!t || t.disabled) return;
  const d = t.dataset, y = S.term.year;
  switch (d.dp) {
    case 'view': S.dui[d.key] = d.k; save(); return redraw();
    case 'execArea': S.dui.execArea = d.k; save(); return redraw();
    case 'loadSort': S.dui.loadDir = S.dui.loadSort === d.k ? -S.dui.loadDir : (['name', 'area'].indexOf(d.k) >= 0 ? 1 : -1); S.dui.loadSort = d.k; save(); return redraw();
    case 'printLeft': { const left = courses().filter(r => r.status !== 'done');
      return printDoc('รายวิชาที่ยังส่งผลการเรียนไม่ครบ', docHead('รายวิชาที่ยังส่งผลการเรียนไม่ครบ', termText() + ' · ข้อมูล ณ ' + thDate(todayISO())) +
        (left.length ? `<table><thead><tr><th>ที่</th><th>กลุ่มสาระ</th><th>ครูผู้สอน</th><th>รายวิชา</th><th>ห้อง</th><th>ครบรายคน</th><th>สถานะ</th></tr></thead><tbody>${left.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${esc(r.area)}</td><td>${esc(r.teacher)}</td><td>${esc(r.subject)}</td><td class="c">${esc(r.className)}</td><td class="c">${r.p ? r.p.complete + '/' + r.p.students : '–'}</td><td>${SCORE_ST[r.status][0]}</td></tr>`).join('')}</tbody></table>`
          : '<p class="c" style="margin:30px 0">ทุกรายวิชาส่งคะแนนครบแล้ว</p>') + signHtml()); }
    case 'printPending': { const U = S.dui, list = pendingItems().filter(x => (!U.prReason || x.reason === U.prReason) && (!U.prLevel || levelOf(x.c.name) === U.prLevel)), byC = {};
      list.forEach(x => { (byC[x.c.name] = byC[x.c.name] || []).push(x); });
      return printDoc('บัญชีนักเรียน 0 ร มส.', docHead('บัญชีรายชื่อนักเรียนที่มีผลการเรียน 0 ร มส.', `${termText()} · ข้อมูล ณ ${thDate(todayISO())} · ${new Set(list.map(x => x.s.id)).size} คน ${list.length} รายวิชา`) +
        (list.length ? Object.keys(byC).sort(sortTh).map(c => `<p style="margin-top:10px"><b>ห้อง ${esc(c)}</b></p><table><thead><tr><th style="width:8%">เลขที่</th><th style="width:14%">เลขประจำตัว</th><th>ชื่อ - สกุล</th><th>รายวิชา</th><th style="width:9%">ผล</th></tr></thead><tbody>${byC[c].sort((a, b) => a.s.no - b.s.no).map(x => `<tr><td class="c">${x.s.no}</td><td class="c">${esc(x.s.id)}</td><td>${esc(x.s.name)}</td><td>${esc(x.subject)}</td><td class="c">${esc(x.reason)}</td></tr>`).join('')}</tbody></table>`).join('')
          : '<p class="c" style="margin:30px 0">ไม่มีรายการ</p>') + signHtml()); }
    case 'printGrid': { const byT = d.k === 't', who = byT ? S.dui.msT : S.dui.msC, list = entries().filter(e => (byT ? e.teacher : e.classId) === who);
      const title = byT ? 'ตารางสอน ' + who : 'ตารางเรียน ' + roomName(who);
      return printDoc(title, docHead(title) + weekGrid(list, byT ? e => roomName(e.classId) : e => e.teacher, true)); }
    case 'printExam': { const rows = examRows().filter(r => r.mode === 'out' && r.date && r.start).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start) || sortTh(a.code, b.code));
      const byDay = {}; rows.forEach(r => { (byDay[r.date] = byDay[r.date] || []).push(r); });
      return printDoc('ตารางสอบ', docHead('ตาราง' + EX().kindName(S.dui.exKind), termText()) + (rows.length ? Object.keys(byDay).sort().map(dt => `<p style="margin-top:10px"><b>${thDate(dt)}</b></p><table><thead><tr><th>เวลา</th><th>รหัสวิชา</th><th>รายวิชา</th><th>ห้อง</th><th>นักเรียน</th><th>สถานที่สอบ</th><th>ครูผู้สอน</th></tr></thead><tbody>${byDay[dt].map(r =>
        `<tr><td class="c">${r.start}–${EX().endOf(r.start, r.minutes)}</td><td class="c">${esc(r.code)}</td><td>${esc(String(r.subject).replace(r.code, '').trim())}</td><td class="c">${exRooms(r).map(x => esc(x.className)).join(', ')}</td><td class="c">${exStudents(r) || ''}</td><td class="c">${esc(r.place || '')}</td><td>${[...new Set(exRooms(r).map(x => x.teacher))].map(esc).join(', ')}</td></tr>`).join('')}</tbody></table>`).join('')
        : '<p class="c" style="margin:30px 0">ยังไม่มีรายการที่จัดวัน/เวลาแล้ว</p>') + signHtml()); }
    case 'taskSeed': { const l = tasksOf(y); DEFAULT_TASKS.forEach(([m, g, ti]) => l.push({ id: uid('at'), month: m, group: g, title: ti, done: false, note: '' }));
      save(); toast('สร้างรายการงาน ' + l.length + ' งานแล้ว แก้ไขได้ตามบริบทของโรงเรียน'); return redraw(); }
    case 'taskAdd': return taskEditor(null);
    case 'taskEdit': return taskEditor(tasksOf(y).find(x => x.id === d.id));
    case 'taskSave': { const ti = $('#dp-tt').value.trim(); if (!ti) return toast('กรุณาใส่ชื่องาน');
      const l = tasksOf(y), old = l.find(x => x.id === d.id), nx = Object.assign({}, old || { id: uid('at'), done: false }, { title: ti, month: num($('#dp-tm').value), group: $('#dp-tg').value, note: $('#dp-tn').value.trim() });
      if (old) l[l.indexOf(old)] = nx; else l.push(nx); save(); closeModal(); toast('บันทึกงานแล้ว'); return redraw(); }
    case 'taskDel': S.acadTasks[y] = tasksOf(y).filter(x => x.id !== d.id); save(); closeModal(); toast('ลบงานแล้ว'); return redraw();
    case 'taskCal': { const tk = tasksOf(y).find(x => x.id === d.id); if (!tk) return; S.events = S.events || [];
      const ev = { id: Date.now(), date: ceDate(y, num(tk.month)), title: tk.title, cat: /สอบ/.test(tk.title) ? 'exam' : /ประชุม/.test(tk.title) ? 'meeting' : 'activity' };
      S.events.push(ev); tk.eventId = ev.id; save(); toast('ลงปฏิทินวิชาการแล้ว · ' + thDate(ev.date) + ' (แก้วันที่ได้ที่แท็บปฏิทิน)'); return redraw(); }
  }
});
document.addEventListener('change', e => {
  const t = e.target, k = t.dataset.dpf; if (!k) return;
  if (k === 'exDate' || k === 'exStart' || k === 'exPlace') { const r = (S.examReqs || []).find(x => x.id === t.dataset.id); if (!r) return;
    const f = { exDate: 'date', exStart: 'start', exPlace: 'place' }[k], v = t.value.trim();
    r[f] = v; r.scheduledBy = S.me.name; save(); return redraw(); }
  if (k === 'taskDone') { const tk = tasksOf(S.term.year).find(x => x.id === t.dataset.id); if (!tk) return;
    tk.done = t.checked; tk.doneAt = t.checked ? new Date().toISOString() : ''; tk.doneBy = t.checked ? S.me.name : ''; save(); return redraw(); }
  S.dui[k] = t.value; save(); redraw();
});
window.EMSDepts = { courses, pendingItems, clashes, loadStats };
})();
