/* EMS — ศูนย์จัดการระบบของผู้ดูแล (ย้ายจาก KruSpace: renderAdmin + adminSectionPeople / School / Calendar / Documents,
   renderAdminHolidays, startGoogleHolidayImport, parseHolidayIcs, openHolidayImport, renderAdminDayShifts, openDayShiftEditor,
   importMultiTeacherTimetableExcel, renderAdminTeacherRows, deleteTeacherFromAdmin, memoStyleCardHtml)
   รวมเป็นหน้าเดียว 5 กลุ่มงาน ให้สิ่งที่ต้องดูพร้อมกันอยู่จอเดียวกัน:
   ① บุคลากรและสิทธิ์ — ครู บทบาทหลายบทบาท ครูที่ปรึกษา (ห้องละไม่เกิน 2 คน) กลุ่มสาระและหัวหน้า นำเข้า Excel/CSV
   ② โครงสร้างโรงเรียน — ปี/ภาคเรียน ห้องเรียนและจำนวนนักเรียน ประกาศผลทางการทุกวิชา
   ③ ปฏิทินภาคเรียน — เปิด-ปิดภาค เวลาเรียนขั้นต่ำ เปิด/ปิดการกรอกคะแนน เวลาคาบ วันหยุด (เพิ่มเอง/Google/.ics) สลับวันเรียน
   ④ ตารางสอนทั้งโรงเรียน — ดูรายครู/รายห้อง ตรวจสอนซ้อน นำเข้า Excel หลายครู คาบเข้าแถวของครูที่ปรึกษา
   ⑤ เอกสารและอัตลักษณ์ — ชื่อ/ตราโรงเรียน หัวเอกสาร ผู้ลงนาม รูปแบบตัวอักษรของแบบพิมพ์
   วันหยุดเก็บใน S.events (cat:'holiday') ชุดเดียวกับปฏิทินวิชาการ · สลับวันเรียนเก็บใน S.dayShifts แล้ว exchange.js ใช้คำนวณคาบของวันนั้น */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => new Date(s + 'T00:00:00');
const shift = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoOf(d); };
const dayIdxOf = s => { const w = parse(s).getDay(); return w >= 1 && w <= 5 ? w - 1 : -1; };
const dayName = s => { const w = parse(s).getDay(); return w >= 1 && w <= 5 ? DAYS[w - 1] : w === 6 ? 'เสาร์' : 'อาทิตย์'; };
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const X = () => window.EMSExchange;
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const wide = w => { const s = $('#layer .sheet'); if (s) s.style.maxWidth = (w || 860) + 'px'; };
const kpi = (l, v, s, k) => `<div class="card kpi"><div class="l">${l}</div><div class="v" ${k ? `style="color:var(--${k})"` : ''}>${v}</div>${s ? `<div class="s muted">${s}</div>` : ''}</div>`;
const norm = s => String(s || '').replace(/\u0e4d\u0e32/g, '\u0e33').replace(/\s+/g, '').replace(/^(ว่าที่ร้อยตรี|ว่าที่ร\.ต\.|นางสาว|น\.ส\.|นาย|นาง|ครู|ดร\.)/, '');

/* ---------- บทบาท ---------- */
Object.assign(ROLES, { vacant: 'ตำแหน่งว่าง (รอครู)', support: 'บุคลากรสนับสนุนการสอน', coverer: 'จัดสอนแทนกลุ่มสาระฯ', affairs: 'กิจการนักเรียน', measure: 'ฝ่ายวัดผล', personnel: 'ฝ่ายบุคคล', general: 'บริหารทั่วไป', scanner: 'เครื่องสแกน (บัญชีแอปสแกนหน้า ส่งเวลาครู)' });
const ROLE_KEYS = ['teacher', 'support', 'head', 'coverer', 'academic', 'measure', 'affairs', 'personnel', 'general', 'exec', 'admin', 'scanner', 'vacant'];
const PRIORITY = ['admin', 'exec', 'academic', 'head', 'measure', 'personnel', 'affairs', 'general', 'coverer', 'teacher', 'support', 'scanner', 'vacant'];
const rolesOf = u => (u.roles && u.roles.length ? u.roles : [u.role || 'teacher']);
/* ผู้ดูแลระบบ (แบบเดียวกับ meetings.js) — เปลี่ยนชื่อบุคลากรต้องแก้ตารางสอน (slice tt เขียนได้เฉพาะแอดมิน/วิชาการ) */
const isAdm = () => !LIVE ? S.view === 'admin' : ([].concat(S.me.roles || [], S.me.role || []).indexOf('admin') >= 0 || ((window.EMS_CONFIG || {}).adminEmails || []).indexOf(String(S.me.email || '').toLowerCase()) >= 0);
const isVacU = u => rolesOf(u).indexOf('vacant') >= 0;   // ตำแหน่งว่าง (รอครู) — ไม่มีตัวคน ไม่นับเป็นบุคลากร/ครู
const isVacN = n => { const u = S.staff.find(x => x.name === n); return !!u && isVacU(u); };
const primary = roles => PRIORITY.find(r => roles.indexOf(r) >= 0) || roles[0] || 'teacher';
S.staff.forEach(u => { u.roles = rolesOf(u).slice(); if (u.roles.indexOf('head') >= 0 && u.roles.indexOf('teacher') < 0) u.roles.unshift('teacher'); u.role = primary(u.roles); });
const AREAS = ['ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์', 'สังคมศึกษา ศาสนาและวัฒนธรรม', 'สุขศึกษาและพลศึกษา', 'ศิลปะ', 'การงานอาชีพ', 'ภาษาต่างประเทศ', 'กิจกรรมพัฒนาผู้เรียน', 'ฝ่ายวิชาการ', 'ผู้บริหาร', 'งานพัฒนาและบริการระบบดิจิทัลโรงเรียน'];
/* รายชื่อกลุ่มสาระ/กลุ่มงาน: ชื่อที่บุคลากรใช้จริงมาก่อน (ชื่อเดียวกันหลายแบบ เช่น "กลุ่มสาระการเรียนรู้ภาษาไทย" กับ "ภาษาไทย" เหลือแบบที่ใช้มากสุด)
   ชื่อตั้งต้น (AREAS) แสดงเฉพาะที่ยังไม่มีชื่อจริงตรงกัน เช่น "วิทยาศาสตร์" ซ้ำกับ "วิทยาศาสตร์และเทคโนโลยี" จึงไม่แสดง */
const deptKey = d => norm(String(d || '').replace(/^กลุ่มสาระ(การเรียนรู้)?ฯ?\s*/, '')).replace(/^(กลุ่มงาน|กลุ่ม|ฝ่าย|งาน)/, '');
const deptLike = (a, b) => a === b || (a.length > 2 && b.length > 2 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0));
const areaList = () => {
  const cnt = {}; S.staff.forEach(u => { if (u.dept) cnt[u.dept] = (cnt[u.dept] || 0) + 1; });
  const real = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]), out = [], keys = [];
  real.forEach(a => { const k = deptKey(a); if (k && keys.indexOf(k) < 0) { keys.push(k); out.push(a); } });      // ชื่อจริง: รวมเฉพาะที่ตรงกันทุกตัวอักษรหลังตัดคำนำหน้า
  const used = new Set(), res = [];
  AREAS.forEach(a => { const r = out.find(x => !used.has(x) && deptLike(deptKey(a), deptKey(x))); if (r) used.add(r); if (res.indexOf(r || a) < 0) res.push(r || a); });      // ลำดับตามชื่อตั้งต้น แทนด้วยชื่อจริงที่ตรงกัน
  return res.concat(out.filter(x => !used.has(x)));
};
const deptCanon = d => { if (!d) return d; const L = areaList(), k = deptKey(d); return L.find(a => a === d) || L.find(a => deptKey(a) === k) || d; };      // ชื่อในรายการที่ตรงกับชื่อนี้ (ใช้รวมชื่อซ้ำ)

/* ---------- ห้องเรียนทั้งโรงเรียน ---------- */
if (!S.rooms) {
  const known = { 'ม.2/1': 'x-m21', 'ม.3/2': 'x-m32' }; S.classes.forEach(c => { known[c.name] = c.id; });
  S.rooms = [];
  for (let l = 1; l <= 6; l++) for (let r = 1; r <= 3; r++) { const name = 'ม.' + l + '/' + r; S.rooms.push({ id: known[name] || 'r' + l + '-' + r, name, count: 30 + ((l * 7 + r * 5) % 11) }); }
}
S.classes.forEach(c => { if (!S.rooms.some(r => r.id === c.id)) S.rooms.push({ id: c.id, name: c.name, count: c.students.length }); });
const roomOf = id => S.rooms.find(r => r.id === id);
const roomName = id => (roomOf(id) || {}).name || (X() ? X().cname(id) : id);
const roomCount = r => { const c = cls(r.id); return c ? c.students.length : num(r.count); };
const sortRooms = list => list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'th', { numeric: true }));
const roomByName = s => { const k = String(s || '').replace(/\s/g, '').replace(/^ม\.?/, 'ม.'); return S.rooms.find(r => r.name.replace(/\s/g, '') === k) || null; };

/* ---------- ครูที่ปรึกษา (ห้อง → รายชื่อ ไม่เกิน 2 คน) ---------- */
const hrOf = rid => [].concat(S.homeroom[rid] || []).filter(Boolean);
const hrRoomsOf = name => Object.keys(S.homeroom).filter(rid => hrOf(rid).indexOf(name) >= 0);
if (!S.admSeed) {
  S.admSeed = 1;
  const add = (rid, n) => { if (!hrOf(rid).length) S.homeroom[rid] = [n]; };
  add('m4-2', 'ครูวิไล เพชรงาม'); add('x-m21', 'ครูมานพ ศรีวิทย์'); add('x-m32', 'ครูอรุณี ใจงาม'); add('m5-1', 'ครูสุดา แสงทอง');
  Object.keys(S.homeroom).forEach(k => { S.homeroom[k] = hrOf(k); });
}

/* ---------- ปี/ภาคเรียน และปฏิทินภาคเรียน ---------- */
S.terms = S.terms || [
  { year: '2569', sem: '1', open: '2026-05-18', close: '2026-10-30', minAtt: 80, lock: 'auto' },
  { year: '2569', sem: '2', open: '2026-11-02', close: '2027-03-31', minAtt: 80, lock: 'auto' }];
const termCur = () => { let t = S.terms.find(x => x.year === S.term.year && x.sem === S.term.sem);
  if (!t) { t = { year: S.term.year, sem: S.term.sem, open: '', close: '', minAtt: 80, lock: 'auto' }; S.terms.push(t); } return t; };
const termLocked = t => !!t && (t.lock === 'locked' || (t.lock !== 'open' && !!t.close && todayISO() > t.close));
const lockedNow = () => { const v = S.viewTerm; if (v && (v.year !== S.term.year || v.sem !== S.term.sem)) return termLocked(S.terms.find(x => x.year === v.year && x.sem === v.sem)); return termLocked(termCur()); };
S.dayShifts = S.dayShifts || [];
S.adm = Object.assign({ sec: 'school', q: '', sort: 'name', dir: 1, ttView: 'teacher', ttWho: '' }, S.adm || {});

/* ---------- ข้อมูลสถานศึกษาและแบบพิมพ์ ---------- */
S.settings = Object.assign({ schoolNameEn: 'Pakchong School', address: '', phone: '', printTitle: 'แบบบันทึกเวลาเรียน และการประเมินผลการพัฒนาคุณภาพผู้เรียน', logoData: '',
  deputyGeneralName: '', deputyPersonnelName: '', deputyBudgetName: '', memoTo: 'รองผู้อำนวยการโรงเรียน กลุ่มบริหารวิชาการ', resultsAnnounced: false, maxStudents: 40 }, S.settings || {});
const printCfg = () => (S.settings.print = Object.assign({ body: 16, title: 22, margin: 16, line: 1.6 }, S.settings.print || {}));      // settings จากคลาวด์อาจไม่มี print → เติมค่าตั้งต้นทุกครั้งที่ใช้
printCfg();
window.EMSPrintCss = () => { const p = printCfg(); return `@page{size:A4;margin:${num(p.margin) || 16}mm}body{font-size:${num(p.body) || 16}pt;line-height:${num(p.line) || 1.6};padding:0}h1{font-size:${num(p.title) || 22}pt}`; };
window.EMSLogo = () => S.settings.logoData || 'icons/school-logo.png';
window.EMSTermLocked = lockedNow;

/* ---------- ตัวช่วยไฟล์ ---------- */
const loadXlsx = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
function csvRows(text) {
  text = String(text || '').replace(/^﻿/, '');
  const sep = (text.split('\n')[0] || '').indexOf('\t') >= 0 ? '\t' : ',', out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); out.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch; }
  if (cell || row.length) { row.push(cell.trim()); out.push(row); }
  return out.filter(r => r.some(Boolean));
}
async function readRows(file) {
  if (/\.xlsx?$/i.test(file.name)) { await loadXlsx(); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).map(r => r.map(v => String(v).trim())).filter(r => r.some(Boolean)); }
  return csvRows(await file.text());
}
const colIdx = (head, words) => head.findIndex(h => { const x = String(h).replace(/\s/g, '').toLowerCase(); return words.some(w => x.indexOf(w) >= 0); });
function downloadText(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- กล่องยืนยัน ---------- */
let ASK = null;
function ask(title, html, ok, fn, danger) {
  ASK = fn;
  modal(`<h2 style="margin-bottom:10px">${title}</h2><div style="line-height:1.7">${html}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" data-act="close">ยกเลิก</button>
    <button class="btn pri" data-ad="askOk" ${danger ? 'style="background:var(--bad);border-color:var(--bad)"' : ''}>${ok}</button></div>`, true);
}

/* ================= หน้าคอนโซล ================= */
const SECS = [
  ['people', 'บุคลากรและสิทธิ์', 'ครู · บทบาท · ที่ปรึกษา · กลุ่มสาระ', 'users'],
  ['school', 'โครงสร้างโรงเรียน', 'ปี/ภาค · ห้องเรียน · ประกาศผล', 'school'],
  ['calendar', 'ปฏิทินภาคเรียน', 'เปิด-ปิดภาค · เวลาคาบ · วันหยุด · สลับวัน', 'cal'],
  ['timetable', 'ตารางสอนทั้งโรงเรียน', 'รายครู/ห้อง · นำเข้า Excel · เข้าแถว', 'grid'],
  ['documents', 'เอกสารและอัตลักษณ์', 'ตรา · หัวเอกสาร · ผู้ลงนาม · แบบพิมพ์', 'print']];

function metrics(sec) {
  const all = X() ? X().allEntries() : [];
  if (sec === 'school') {
    const total = S.rooms.reduce((n, r) => n + roomCount(r), 0), over = S.rooms.filter(r => roomCount(r) > num(S.settings.maxStudents)).length;
    return kpi('ปี/ภาคเรียน', S.terms.length, `กำลังใช้ ${S.term.sem}/${S.term.year}`) + kpi('ห้องเรียน', S.rooms.length) + kpi('นักเรียนรวม', total.toLocaleString()) +
      kpi('ห้องเกินเกณฑ์', over, `เกณฑ์ ${S.settings.maxStudents} คน/ห้อง`, over ? 'warn' : 'ok');
  }
  if (sec === 'calendar') {
    const t = termCur(), hol = (S.events || []).filter(e => e.cat === 'holiday' && (!t.open || e.date >= t.open) && (!t.close || e.date <= t.close)).length;
    return kpi('เปิดภาคเรียน', t.open ? thDate(t.open) : '—', t.close ? 'ปิด ' + thDate(t.close) : 'ยังไม่กำหนดวันปิด', t.open && t.close ? '' : 'bad') +
      kpi('วันหยุดในภาค', hol) + kpi('วันที่สลับตาราง', (S.dayShifts || []).length) + kpi('การกรอกคะแนน', lockedNow() ? 'ปิดแล้ว' : 'เปิดอยู่', '', lockedNow() ? 'bad' : 'ok');
  }
  if (sec === 'timetable') {
    const teachers = S.staff.filter(u => rolesOf(u).indexOf('teacher') >= 0 && !isVacU(u)), withTT = new Set(all.map(e => e.teacher).filter(n => !isVacN(n)));
    const none = teachers.filter(u => !withTT.has(u.name)).length, cl = clashes().length;
    return kpi('คาบสอน/สัปดาห์', all.length) + kpi('ครูที่มีตาราง', withTT.size) + kpi('ครูยังไม่มีตาราง', none, '', none ? 'warn' : 'ok') + kpi('ครูชนคาบ/ห้องหลายวิชา', cl, '', cl ? 'bad' : 'ok');
  }
  if (sec === 'documents') {
    const s = S.settings, signers = ['headAssessmentName', 'deputyName', 'directorName'].filter(k => String(s[k] || '').trim()).length;
    return kpi('ชื่อสถานศึกษา', s.schoolName ? '✓' : '—', '', s.schoolName ? 'ok' : 'bad') + kpi('ตราโรงเรียน', s.logoData ? 'อัปโหลดแล้ว' : 'ตราเดิม', '', 'ok') +
      kpi('หัวเอกสาร ปพ.5', s.printTitle ? '✓' : '—', '', s.printTitle ? 'ok' : 'warn') + kpi('ผู้ลงนามหลัก', signers + '/3', '', signers === 3 ? 'ok' : 'warn');
  }
  const noHr = S.rooms.filter(r => !hrOf(r.id).length).length, real = S.staff.filter(u => !isVacU(u)), vacN = S.staff.length - real.length;
  return kpi('บุคลากร', real.length, vacN ? 'ตำแหน่งว่าง (รอครู) ' + vacN + ' ตำแหน่ง' : '') + kpi('ครูผู้สอน', real.filter(u => rolesOf(u).indexOf('teacher') >= 0).length) +
    kpi('ครูที่ปรึกษา', new Set([].concat(...Object.keys(S.homeroom).map(hrOf))).size) + kpi('ห้องยังไม่มีที่ปรึกษา', noHr, '', noHr ? 'warn' : 'ok');
}
function shell(sec, body) {
  const meta = SECS.find(x => x[0] === sec);
  return `<div class="top"><div><h1>ตั้งค่าโรงเรียน</h1><p>${meta[1]} — ${meta[2]}</p></div></div>
    <div class="ad-tabs" role="tablist">${SECS.map(([k, l, h, i]) => `<button class="ad-tab ${k === sec ? 'on' : ''}" role="tab" aria-selected="${k === sec}" data-ad="sec" data-s="${k}">${ic(i)}<span><b>${l}</b><small>${h}</small></span></button>`).join('')}</div>
    <div class="grid g4" style="margin-bottom:16px">${metrics(sec)}</div>${body}`;
}

/* ================= ① บุคลากรและสิทธิ์ ================= */
const SORTS = [['name', 'ชื่อ'], ['dept', 'กลุ่มสาระ'], ['roles', 'บทบาท'], ['homeroom', 'ห้องที่ปรึกษา']];
function staffList() {
  const q = S.adm.q.trim().toLowerCase(), key = S.adm.sort;
  const list = S.staff.map((u, i) => ({ u, i })).filter(({ u }) => !q || [u.name, u.email, u.phone, u.dept].some(v => String(v || '').toLowerCase().indexOf(q) >= 0) || norm(u.name).indexOf(norm(q)) >= 0);
  const txt = u => key === 'roles' ? String(PRIORITY.indexOf(primary(rolesOf(u)))) : key === 'homeroom' ? (hrRoomsOf(u.name)[0] ? roomName(hrRoomsOf(u.name)[0]) : 'ฮฮฮ') : String(u[key] || 'ฮฮฮ');
  return list.sort((a, b) => txt(a.u).localeCompare(txt(b.u), 'th', { numeric: true }) * S.adm.dir || a.u.name.localeCompare(b.u.name, 'th'));
}
/* ตารางบุคลากรพอดีจอคอม: ชื่อ/อีเมล/เบอร์ ซ้อนในช่องเดียว · กลุ่มสาระตัดคำนำหน้า (หัวคอลัมน์บอกแล้ว) · บทบาทเป็นตาราง 4 คอลัมน์ ชื่อย่อ (ชี้ดูชื่อเต็ม) */
const deptShort = d => String(d || '').replace(/^กลุ่มสาระ(การเรียนรู้)?ฯ?\s*/, '') || d;
const ROLE_SHORT = { support: 'สายสนับสนุน', head: 'หัวหน้าสาระ', coverer: 'จัดสอนแทน', academic: 'วิชาการ', measure: 'วัดผล', affairs: 'กิจการนักเรียน', personnel: 'บุคคล', general: 'บริหารทั่วไป', scanner: 'เครื่องสแกน', vacant: 'ตำแหน่งว่าง' };
function staffRows() {
  const list = staffList();
  if (!list.length) return `<tr><td colspan="5"><div class="empty">${S.adm.q ? 'ไม่พบบุคลากรที่ตรงกับ “' + esc(S.adm.q) + '”' : 'ยังไม่มีข้อมูลบุคลากร'}</div></td></tr>`;
  return list.map(({ u, i }) => { const rs = rolesOf(u), mine = hrRoomsOf(u.name)[0] || '';
    return `<tr>
      <td><div class="ad-id"><input class="in" value="${esc(u.name)}" data-adf="st" data-i="${i}" data-k="name" style="font-weight:600" aria-label="ชื่อ">
        <input class="in" type="email" value="${esc(u.email || '')}" data-adf="st" data-i="${i}" data-k="email" placeholder="อีเมล" aria-label="อีเมล ${esc(u.name)}">
        <input class="in" value="${esc(u.phone || '')}" data-adf="st" data-i="${i}" data-k="phone" placeholder="เบอร์โทร" aria-label="เบอร์โทร ${esc(u.name)}"></div></td>
      <td><select class="in" data-adf="st" data-i="${i}" data-k="dept" style="width:130px" title="${esc(u.dept || '')}" aria-label="กลุ่มสาระ ${esc(u.name)}">${(u.dept && areaList().indexOf(u.dept) < 0 ? [u.dept] : []).concat(areaList()).map(a => `<option value="${esc(a)}" ${a === u.dept ? 'selected' : ''}>${esc(deptShort(a))}</option>`).join('')}</select></td>
      <td><div class="ad-roles">${ROLE_KEYS.map(r => `<label class="ad-role ${rs.indexOf(r) >= 0 ? 'on' : ''}" title="${esc(ROLES[r] || r)}"><input type="checkbox" data-adf="role" data-i="${i}" value="${r}" ${rs.indexOf(r) >= 0 ? 'checked' : ''}>${esc(ROLE_SHORT[r] || ROLES[r] || r)}</label>`).join('')}</div></td>
      <td>${isVacU(u) ? '<span class="muted small">— ตำแหน่งว่าง —</span>' : `<select class="in" data-adf="hr" data-i="${i}" style="width:114px" aria-label="ห้องที่ปรึกษา ${esc(u.name)}"><option value="">— ไม่กำหนด —</option>${sortRooms(S.rooms).map(r => `<option value="${r.id}" ${mine === r.id ? 'selected' : ''}>${esc(r.name)} (${hrOf(r.id).length}/2)</option>`).join('')}</select>`}</td>
      <td><button class="btn sm" data-ad="stDel" data-i="${i}" ${u.name === S.me.name ? 'disabled title="ลบบัญชีที่กำลังใช้งานอยู่ไม่ได้"' : ''}>ลบ</button></td></tr>`; }).join('');
}
const staffCount = () => `แสดง ${staffList().length} จาก ${S.staff.length} คน${S.adm.q ? ' · คำค้น “' + esc(S.adm.q) + '”' : ''} · เรียงตาม${(SORTS.find(x => x[0] === S.adm.sort) || SORTS[0])[1]} ${S.adm.dir < 0 ? '(ฮ→ก)' : '(ก→ฮ)'}`;
function people() {
  const ep = hrEp();
  return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">ข้อมูลครูและสิทธิ์ใช้งาน</h2>
      <div class="muted small">แก้ในตารางแล้วบันทึกทันที · หนึ่งคนมีได้หลายบทบาท · ห้องหนึ่งมีครูที่ปรึกษาได้ไม่เกิน 2 คน</div></div>
      <button class="btn sm" data-ad="hrSync">${ic('cloud')}ระบบ HR</button>
      <button class="btn sm" data-ad="tplStaff">${ic('down')}แม่แบบ</button><button class="btn sm" data-ad="pick" data-f="ad-file-staff">${ic('up')}นำเข้า Excel/CSV</button>
      <input type="file" id="ad-file-staff" data-adfile="staff" accept=".xlsx,.xls,.csv,.txt" hidden><button class="btn sm pri" data-ad="stAdd">${ic('plus')}เพิ่มบุคลากร</button></div>
    <div class="muted small" style="margin-bottom:6px;display:flex;align-items:center;gap:6px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ep ? '#10b981' : '#f59e0b'}"></span>
      ${ep ? `<b>เชื่อมต่อระบบ HR แล้ว</b> · ครูแต่ละคนซิงก์ข้อมูลของตัวเอง` : `<b>ยังไม่ได้เชื่อมต่อระบบ HR ของโรงเรียน</b>`}
      · <button class="btn sm ghost" data-ad="hrSync" style="padding:0 6px;font-size:.78rem;text-decoration:underline">${ep ? 'ทดสอบ / ตรวจชื่อ' : 'วิธีตั้งค่า'}</button>
    </div>
    <div class="row" style="border:0;flex-wrap:wrap;gap:8px"><input class="in" id="ad-q" type="search" placeholder="ค้นหา ชื่อ / อีเมล / เบอร์โทร / กลุ่มสาระ" value="${esc(S.adm.q)}" data-adf="q" style="flex:1;min-width:220px">
      <div class="seg" role="group" aria-label="เรียงลำดับ">${SORTS.map(([k, l]) => `<button data-ad="sort" data-k="${k}" aria-pressed="${S.adm.sort === k}">${l}${S.adm.sort === k ? (S.adm.dir < 0 ? ' ▼' : ' ▲') : ''}</button>`).join('')}</div></div>
    <div class="muted small" id="ad-count">${staffCount()}</div>
    <div class="scroll" style="margin-top:8px"><table class="tbl ad-staff"><thead><tr><th>ชื่อ-สกุล · อีเมล (ใช้เข้าสู่ระบบ) · เบอร์โทร</th><th>กลุ่มสาระ/กลุ่มงาน</th><th>บทบาท</th><th>ห้องที่ปรึกษา</th><th></th></tr></thead><tbody id="ad-rows">${staffRows()}</tbody></table></div></div>
  <div class="grid g2" style="align-items:start">
    <div class="card"><h2>ครูที่ปรึกษาแยกรายห้อง</h2><div class="muted small" style="margin-bottom:8px">ครูที่ปรึกษาเห็นคาบ “เข้าแถว / โฮมรูม” ของห้องตัวเองในหน้าเช็กชื่ออัตโนมัติ</div>
      <div class="scroll" style="max-height:420px"><table class="tbl"><thead><tr><th>ห้อง</th><th>ครูที่ปรึกษา</th><th></th></tr></thead><tbody>${sortRooms(S.rooms).map(r => { const n = hrOf(r.id);
        return `<tr><td><b>${esc(r.name)}</b></td><td>${n.length ? n.map(x => chip(esc(x), 'info')).join(' ') : '<span class="muted small">ยังไม่มีครูที่ปรึกษา</span>'}</td><td>${chip(n.length + '/2', n.length ? 'ok' : 'warn')}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="card"><h2>กลุ่มสาระและหัวหน้ากลุ่มสาระฯ</h2><div class="muted small" style="margin-bottom:8px">ติ๊กบทบาท “หัวหน้ากลุ่มสาระ” ในตารางด้านบน · ใช้จัดสายอนุมัติใบลาและการหาครูสอนแทน</div>
      ${(() => { const n = S.staff.filter(u => u.dept && deptCanon(u.dept) !== u.dept).length; return n ? `<div class="notice">พบบุคลากร ${n} คนที่ใช้ชื่อกลุ่มสาระ/กลุ่มงานคนละแบบกับชื่อเดียวกัน <button class="btn sm pri" data-ad="deptMerge">รวมเป็นชื่อเดียว</button></div>` : ''; })()}
      <div class="scroll" style="max-height:420px"><table class="tbl"><thead><tr><th>กลุ่มสาระ/กลุ่มงาน</th><th style="text-align:right">บุคลากร</th><th>หัวหน้า</th></tr></thead><tbody>${areaList().map(a => { const inA = u => deptCanon(u.dept) === a, m = S.staff.filter(u => inA(u) && !isVacU(u)), h = m.filter(u => rolesOf(u).indexOf('head') >= 0), vn = S.staff.filter(u => inA(u) && isVacU(u)).length;
        if (!m.length && !vn) return '';      // ชื่อกลุ่มสาระตั้งต้นที่ไม่มีใครสังกัด (ข้อมูลจริงใช้ชื่ออื่น) ไม่แสดงซ้ำ — ตัวเลือกกลุ่มสาระยังมีครบ
        return `<tr><td><b>${esc(a)}</b></td><td style="text-align:right">${m.length}${vn ? `<div class="muted small">ตำแหน่งว่าง ${vn}</div>` : ''}</td><td>${h.length ? h.map(u => chip(esc(u.name), 'gold')).join(' ') : `<span class="muted small">${m.length ? 'ยังไม่กำหนด' : '—'}</span>`}</td></tr>`; }).join('')}</tbody></table></div></div>
  </div>`;
}
function renameStaff(oldN, newN, who) {      // who = บุคลากรที่ระบุตัวแล้ว (เช่น ค้นด้วยอีเมล) — กันชื่อซ้ำเปลี่ยนผิดคน
  if (!oldN || !newN || oldN === newN) return;
  let nCov = 0;   // คาบที่ครูอื่นรับไว้แทนตำแหน่งนี้ (สีส้ม) ต้องเปลี่ยนชื่อตาม ไม่งั้นนำเข้าครั้งหน้าจะสร้างตำแหน่งชื่อเก่ากลับมา
  (S.ttOthers || []).forEach(e => { if (e.teacher === oldN) e.teacher = newN; if (e.coverFor === oldN) { e.coverFor = newN; nCov++; } });
  Object.keys(S.ttCover || {}).forEach(k => { if (S.ttCover[k] === oldN) { S.ttCover[k] = newN; nCov++; } });
  Object.keys(S.homeroom).forEach(k => { S.homeroom[k] = hrOf(k).map(n => n === oldN ? newN : n); });
  (S.xreqs || []).forEach(r => { if (r.requester === oldN) r.requester = newN; if (r.target === oldN) r.target = newN; });
  (S.leaves || []).forEach(l => { if (l.by === oldN) l.by = newN; });      // เฉพาะใบลาชั้นสด (30 วัน) — ประวัติเก่าอ่านอย่างเดียว คงชื่อเดิม
  const rn = a => { if (Array.isArray(a)) a.forEach((n, i) => { if (n === oldN) a[i] = newN; }); };
  if (S.ttDuties) {
    (S.ttDuties.meetings || []).forEach(m => rn(m.teachers));
    (S.ttDuties.activities || []).forEach(a => rn(a.teachers));
    (S.ttDuties.extras || []).forEach(ex => { if (ex.teacher === oldN) ex.teacher = newN; });
  }
  /* นัดประชุมแก้ได้เฉพาะผู้นัด/แอดมิน (rules) — ไม่ใช่แอดมินไม่แตะ กันชุดบันทึกถูกปฏิเสธ */
  if (isAdm()) (S.meetings || []).forEach(m => { if (!m) return; if (m.by === oldN) m.by = newN; rn(m.invitees); rn(m.present); if (m.inv) rn(m.inv.people); });
  const ap = (S.gen || {}).approvers || {}; Object.keys(ap).forEach(k => { if (ap[k] === oldN) ap[k] = newN; });
  Object.keys(S.scanTimes || {}).forEach(dt => { const day = S.scanTimes[dt]; if (day && day[oldN] !== undefined && day[newN] === undefined) { day[newN] = day[oldN]; delete day[oldN]; } });
  if (S.me && S.me.name === oldN && (!who || !who.email || String(who.email).toLowerCase() === String(S.me.email || '').toLowerCase())) S.me.name = newN;
  const u = who || (S.staff || []).find(x => x && x.name === oldN);
  if (u) u.name = newN;
  return nCov;
}

/* ---------- เชื่อมต่อระบบข้อมูลบุคลากร (HR) — แอดมิน/ฝ่ายบุคคล ----------
   การซิงก์ข้อมูลทำในแอปของครูแต่ละคน (modules2.js · EMSHr) ที่นี่มีแค่ ดูสถานะ · ทดสอบ · ตรวจชื่อที่ไม่ตรงกับ HR แล้วยืนยันทีละคน
   URL ตัวกลางตั้งใน config.js (hr.endpoint) เท่านั้น */
const hrEp = () => (window.EMSHr && EMSHr.endpoint ? EMSHr.endpoint() : '');
function adminHrModal() {
  const ep = hrEp();
  modal(`<h2 style="margin-bottom:8px">เชื่อมต่อระบบข้อมูลบุคลากร (HR)</h2>
    <div class="notice">ครูแต่ละคนซิงก์ข้อมูลประวัติส่วนตัวของตัวเองกับระบบ HR อัตโนมัติ (แก้ที่ไหน อีกที่แก้ตาม) · ช่องที่ครูล็อก 🔒 ไม่ส่งออก
      · <b>ไม่ซิงก์</b> เงินเดือน เลขบัตรประชาชน และประวัติรับราชการ · ชื่อที่ไม่ตรงกับ HR ไม่เปลี่ยนเอง ให้ตรวจและยืนยันด้านล่าง</div>
    <div class="muted small" style="margin:10px 0">สถานะ: ${ep ? '<b style="color:var(--ok)">เชื่อมต่อแล้ว</b> (ตั้งใน config.js)' : '<b style="color:var(--warn)">ยังไม่เชื่อม</b> — ใส่ URL ตัวกลางที่ config.js (hr.endpoint) แล้วขึ้นเว็บ'}</div>
    ${ep ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-ad="hrTest">${ic('cloud')}ทดสอบการเชื่อมต่อ</button><button class="btn pri" data-ad="hrNames">${ic('users')}ตรวจชื่อที่ไม่ตรงกับ HR</button></div>` : ''}
    <details style="margin-top:14px;font-size:.85rem;line-height:1.6"><summary style="cursor:pointer;font-weight:600">ขั้นตอนตั้งค่า (ทำครั้งเดียว)</summary>
      <ol style="margin:8px 0 0 18px;padding:0">
        <li>ระบบรับหนังสือราชการ → ระบบจัดการข้อมูลบุคลากร → นำเข้า/ส่งออก → <b>เชื่อมต่อระบบอื่น</b> เพิ่มระบบ <code>ems</code> อ่านได้/แก้ได้: <b>basic, contact, history</b> (ห้ามเปิด salary และ personal) แล้วคัดลอก HR_URL, HR_SYS, HR_SECRET</li>
        <li>Apps Script → วางโค้ด <code>appsscript-hr-sync.gs</code> → Project Settings → Script Properties ใส่ 3 ค่า</li>
        <li>Deploy → Manage deployments → แก้ deployment เดิม → Version: <b>New version</b> (Execute as: Me · Access: Anyone) และลบ Trigger เก่าทั้งหมด</li>
        <li>ใส่ URL <code>/exec</code> ที่ config.js (hr.endpoint) แล้วขึ้นเว็บ</li>
      </ol></details>`, true);
}
async function adminHrTest() {
  try { toast('กำลังทดสอบการเชื่อมต่อ…'); const r = await EMSHr.call('test');
    modal(`<h2 style="margin-bottom:8px">ทดสอบการเชื่อมต่อ</h2><p>${esc(r.message || 'เชื่อมต่อสำเร็จ')}</p>`, true); }
  catch (e) { modal(`<h2 style="margin-bottom:8px;color:var(--bad)">เชื่อมต่อไม่สำเร็จ</h2><p>${esc((e && e.message) || e)}</p>
      <div class="notice small">ตรวจ Script Properties (HR_URL · HR_SYS · HR_SECRET) · สิทธิ์ของระบบ <code>ems</code> ในระบบ HR (อ่าน basic) · และ Deploy เป็น New version แล้ว</div>`, true); }
}
/** ชื่อใน HR ต่างจากชื่อในระบบ (จับคู่ด้วยอีเมลเท่านั้น) → แอดมินกดเปลี่ยนทีละคน · ไม่เพิ่มบุคลากรใหม่อัตโนมัติ */
let HR_DIFF = [], HR_LIST = [];
/* เปลี่ยนชื่อบันทึกนัดประชุม/ใบลา/คำขอแลกคาบในชุดเดียว — rules ต้องมี staff/{อีเมลผู้กด} ที่ยังใช้งาน (แอดมินตั้งต้นที่ไม่มีเอกสาร staff จะถูกปฏิเสธทั้งชุด) */
const hrRenOk = () => { const em = String(S.me.email || '').toLowerCase(); return !LIVE || (!!em && (S.staff || []).some(u => u && u.active !== false && String(u.email || '').toLowerCase() === em)); };
const HR_REN_NOSTAFF = 'บัญชีผู้ดูแลนี้ยังไม่มีในรายชื่อบุคลากร (หรือปิดใช้งานอยู่) จึงเปลี่ยนชื่อไม่ได้ เพราะระบบจะไม่ยอมบันทึกนัดประชุม ใบลา และคำขอแลกคาบ — เพิ่มอีเมลนี้เป็นบุคลากรก่อน หรือให้แอดมินที่มีรายชื่อเป็นผู้เปลี่ยน';
async function adminHrNames() {
  try { toast('กำลังดึงรายชื่อจากระบบ HR…'); const r = await EMSHr.call('list'); HR_LIST = Array.isArray(r.data) ? r.data : []; hrNamesModal(); }
  catch (e) { toast('ดึงรายชื่อจาก HR ไม่สำเร็จ: ' + ((e && e.message) || e)); }
}
function hrNamesModal() {
  { const list = HR_LIST, byMail = {};
    (S.staff || []).forEach(u => { if (u && u.email) byMail[String(u.email).toLowerCase()] = u; });
    HR_DIFF = []; const notIn = [];
    list.forEach(x => { const em = String(x.schoolEmail || '').trim().toLowerCase(), u = byMail[em], nm = EMSHr.computeFormalName(x.prefix, x.firstName, x.lastName);
      if (!em || !nm) return; if (!u) { notIn.push(nm + ' (' + em + ')'); return; }
      if ((EMSHr.nameKey || norm)(nm) !== (EMSHr.nameKey || norm)(u.name)) HR_DIFF.push({ email: em, from: u.name, to: nm }); });      // เกณฑ์เดียวกับการ์ดของครู
    const adm = isAdm() && hrRenOk();
    modal(`<h2 style="margin-bottom:8px">ชื่อที่ไม่ตรงกับระบบ HR</h2>
      <p class="small muted">จับคู่ด้วยอีเมล · กด “เปลี่ยน” แล้วชื่อในตารางสอน ห้องที่ปรึกษา ใบลา (30 วันล่าสุด) นัดประชุม และคำขอแลกคาบเปลี่ยนตามให้ · ประวัติใบลาเก่ากว่า 30 วันยังเป็นชื่อเดิม · ไม่เปลี่ยน = คงชื่อเดิม</p>
      ${HR_DIFF.length && !adm ? `<div class="notice small">${isAdm() ? HR_REN_NOSTAFF : 'เปลี่ยนชื่อได้เฉพาะผู้ดูแลระบบ (ต้องแก้ตารางสอนด้วย) — แจ้งแอดมินตามรายการนี้'}</div>` : ''}
      ${HR_DIFF.length ? `<div class="list">${HR_DIFF.map((x, i) => `<div class="row" style="flex-wrap:wrap"><div class="grow"><b>${esc(x.from)}</b> → ${esc(x.to)}<div class="muted small">${esc(x.email)}</div></div>${adm ? `<button class="btn sm pri" data-ad="hrRename" data-i="${i}">เปลี่ยน</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">ชื่อตรงกันทุกคน</div>'}
      ${notIn.length ? `<details style="margin-top:12px"><summary class="small">มีใน HR แต่ไม่มีในระบบ ${notIn.length} คน (ไม่เพิ่มให้อัตโนมัติ — เพิ่มเองที่ “เพิ่มบุคลากร” ถ้าต้องใช้)</summary><div class="small muted" style="margin-top:6px">${notIn.map(esc).join('<br>')}</div></details>` : ''}`, true);
  }
}

function staffAddForm() {
  modal(`<h2 style="margin-bottom:12px">เพิ่มบุคลากร</h2>
    <div class="field"><label class="f" for="ad-n">ชื่อ-สกุล</label><input id="ad-n" class="in" placeholder="เช่น ครูสมศรี ใจดี"></div>
    <div class="grid g2"><div class="field"><label class="f" for="ad-e">อีเมล</label><input id="ad-e" class="in" type="email" placeholder="name@pcschool.ac.th"></div>
      <div class="field"><label class="f" for="ad-p">เบอร์โทร</label><input id="ad-p" class="in" inputmode="tel"></div></div>
    <div class="field"><label class="f" for="ad-d">กลุ่มสาระ/กลุ่มงาน</label><select id="ad-d" class="in">${areaList().map(a => `<option>${esc(a)}</option>`).join('')}</select></div>
    <div class="field"><span class="f">บทบาท</span><div class="ad-roles">${ROLE_KEYS.map(r => `<label class="ad-role ${r === 'teacher' ? 'on' : ''}"><input type="checkbox" class="ad-newrole" value="${r}" ${r === 'teacher' ? 'checked' : ''}>${ROLES[r]}</label>`).join('')}</div></div>
    <button class="btn pri" style="width:100%" data-ad="stAddSave">${ic('plus')}เพิ่มบุคลากร</button>`);
}

/* ---------- นำเข้าบุคลากร ---------- */
let IMP_STAFF = null;
/* ตำแหน่ง → บทบาท + กลุ่ม (โรงเรียนปากช่อง)
   ผู้อำนวยการ = ผู้บริหาร · รองผู้อำนวยการ = ผู้บริหาร + บทบาทของกลุ่มบริหารที่ดูแล · ตำแหน่งที่มีคำว่า “ครู” = ครูผู้สอน
   ตำแหน่งอื่นทั้งหมด (เจ้าหน้าที่ ลูกจ้าง ฯลฯ) = บุคลากรสนับสนุนการสอน สังกัด “กลุ่มงานสนับสนุนการสอน” */
const SUPPORT_DEPT = 'กลุ่มงานสนับสนุนการสอน';
function rolesFromPosition(pos, group) {
  const p = String(pos || '').replace(/\s/g, ''), g = String(group || '');
  if (!p) return null;
  if (/รองผู้อำนวยการ|รองผอ/.test(p)) { const r = ['exec'];
    if (/วิชาการ/.test(g)) r.push('academic'); if (/ทั่วไป/.test(g)) r.push('general'); if (/บุคคล/.test(g)) r.push('personnel'); if (/กิจการนักเรียน/.test(g)) r.push('affairs');
    return { roles: r, dept: g }; }
  if (/ผู้อำนวยการ|^ผอ/.test(p)) return { roles: ['exec'], dept: g || 'ผู้อำนวยการโรงเรียน' };
  if (/ครู/.test(p)) return { roles: ['teacher'], dept: g };
  return { roles: ['support'], dept: SUPPORT_DEPT };
}
/* ไฟล์ไม่มีหัวคอลัมน์: เดาคอลัมน์จากเนื้อหา (อีเมล · คำนำหน้า+ชื่อ+สกุล · เบอร์ · ตำแหน่ง · กลุ่ม) */
const PREFIX_RE = /^(นาย|นาง|นางสาว|น\.ส\.|ว่าที่ร้อยตรี|ว่าที่ ร\.ต\.|ว่าที่ร\.ต\.|ดร\.|mr\.?|mrs\.?|ms\.?)$/i;
function guessStaffCols(rows) {
  const n = Math.max(...rows.map(r => r.length)), score = re => [...Array(n).keys()].map(i => rows.filter(r => re.test(String(r[i] || '').trim())).length);
  const best = arr => { const m = Math.max(...arr); return m > 0 ? arr.indexOf(m) : -1; };
  const e = best(score(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)), pre = best(score(PREFIX_RE)), ph = best(score(/^0?\d[\d\- ]{7,11}$/));
  const pos = best(score(/ครู|ผู้อำนวยการ|เจ้าหน้าที่|ลูกจ้าง|พนักงาน|นักการ|ตำแหน่ง/)), grp = best(score(/^กลุ่ม|^งาน|^ฝ่าย/));
  return { e, pre, first: pre >= 0 ? pre + 1 : 0, last: pre >= 0 ? pre + 2 : 1, p: ph, pos, d: grp >= 0 && grp !== pos ? grp : -1 };
}
function staffImportPreview(rows) {
  let hi = rows.findIndex(r => colIdx(r, ['ชื่อ', 'name']) >= 0 && !r.some(x => /@/.test(x)));
  let gc = null;
  if (hi < 0) { gc = guessStaffCols(rows); if (gc.e < 0 && gc.pre < 0) return toast('อ่านไฟล์ไม่ได้: ไม่พบหัวคอลัมน์ “ชื่อ” และไม่พบคอลัมน์อีเมล/คำนำหน้าชื่อ'); hi = -1; }
  const h = hi >= 0 ? rows[hi] : [], ci = gc ? { n: -1, e: gc.e, p: gc.p, d: gc.d, r: -1, pos: gc.pos, pre: gc.pre, first: gc.first, last: gc.last } : { n: colIdx(h, ['ชื่อ', 'name']), e: colIdx(h, ['อีเมล', 'email', 'mail']), p: colIdx(h, ['เบอร์', 'โทร', 'phone']), d: colIdx(h, ['กลุ่มสาระ', 'กลุ่มงาน', 'ฝ่าย', 'dept']), r: colIdx(h, ['บทบาท', 'role']) };
  ci.h = gc ? -1 : colIdx(h, ['ที่ปรึกษา', 'homeroom']);   /* ห้องที่ปรึกษา — เว้นว่างได้ */
  if (!gc) { const at = re => h.findIndex(x => re.test(String(x).replace(/\s/g, '')));
    ci.pos = at(/^ตำแหน่ง/); ci.pre = at(/คำนำหน้า/); const f = at(/^ชื่อ$/), l = at(/^นามสกุล$|^สกุล$/);
    if (f >= 0 && l >= 0) { ci.first = f; ci.last = l; ci.n = -1; } if (ci.d < 0) ci.d = at(/^กลุ่ม|สังกัด|ฝ่าย/); }
  const out = [], seen = new Set();
  rows.slice(hi + 1).forEach((r, k) => { const g = i => i >= 0 && i != null ? String(r[i] == null ? '' : r[i]).trim() : '';
    const name = (ci.n >= 0 ? g(ci.n) : (g(ci.pre) + g(ci.first) + (g(ci.last) ? ' ' + g(ci.last) : ''))).replace(/\s+/g, ' ').trim(); if (!name || /^ชื่อ/.test(name)) return;
    const email = ci.e >= 0 ? String(r[ci.e] || '').trim().toLowerCase() : '', key = email || norm(name);
    if (seen.has(key)) return out.push({ line: hi + k + 2, name, status: 'dup' }); seen.add(key);
    const pr = rolesFromPosition(g(ci.pos), g(ci.d));
    const roles = pr ? pr.roles : ci.r >= 0 ? ROLE_KEYS.filter(x => String(r[ci.r] || '').indexOf(ROLES[x]) >= 0 || String(r[ci.r] || '').toLowerCase().indexOf(x) >= 0) : [];
    let phone = g(ci.p).replace(/[^\d]/g, ''); if (/^[689]\d{8}$/.test(phone)) phone = '0' + phone;     /* Excel ตัดเลข 0 หน้าเบอร์ */
    const found = S.staff.find(u => (email && String(u.email || '').toLowerCase() === email) || norm(u.name) === norm(name));
    const bad = email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    const hrTxt = g(ci.h).replace(/\s/g, ''), clr = /^[-–—]$/.test(hrTxt), hrRoom = hrTxt && !clr ? roomByName(hrTxt) : null, vac = (found && isVacU(found)) || roles.indexOf('vacant') >= 0;
    const hrWarn = hrTxt && !clr && !hrRoom ? 'ไม่พบห้อง ' + hrTxt + ' · ข้าม' : vac && hrRoom ? 'ตำแหน่งว่างเป็นที่ปรึกษาไม่ได้ · ข้าม' : '';
    out.push({ line: hi + k + 2, name, email, phone, pos: g(ci.pos), dept: pr ? pr.dept : g(ci.d), roles, found, hr: hrWarn ? null : hrRoom ? hrRoom.id : '', clr, hrWarn, status: bad ? 'bad' : found ? 'upd' : 'new' }); });
  /* ห้องหนึ่งมีที่ปรึกษาได้ไม่เกิน 2 คน — นับคนเดิมที่ไม่ได้ย้าย + คนในไฟล์ตามลำดับแถว */
  { const ok = x => x.status === 'new' || x.status === 'upd', moving = new Set(out.filter(x => ok(x) && (x.hr || x.clr)).map(x => norm(x.found ? x.found.name : x.name))), cnt = {};
    Object.keys(S.homeroom).forEach(rid => { cnt[rid] = hrOf(rid).filter(n => !moving.has(norm(n))).length; });
    out.forEach(x => { if (!ok(x) || !x.hr) return; if ((cnt[x.hr] || 0) >= 2) { x.hrWarn = 'ห้อง ' + roomName(x.hr) + ' มีที่ปรึกษาครบ 2 คนแล้ว · ข้าม'; x.hr = null; } else cnt[x.hr] = (cnt[x.hr] || 0) + 1; }); }
  IMP_STAFF = out;
  const n = s => out.filter(x => x.status === s).length, lab = { new: ['เพิ่มใหม่', 'ok'], upd: ['อัปเดต', 'info'], dup: ['ซ้ำในไฟล์ · ข้าม', 'warn'], bad: ['อีเมลไม่ถูกต้อง · ข้าม', 'bad'] };
  modal(`<h2 style="margin-bottom:8px">ตรวจก่อนนำเข้าบุคลากร</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chip('เพิ่มใหม่ ' + n('new'), 'ok')}${chip('อัปเดต ' + n('upd'), 'info')}${n('dup') ? chip('ซ้ำ ' + n('dup'), 'warn') : ''}${n('bad') ? chip('ผิดรูปแบบ ' + n('bad'), 'bad') : ''}</div>
    <div class="scroll" style="max-height:50vh"><table class="tbl"><thead><tr><th>แถว</th><th>ชื่อ-สกุล</th><th>อีเมล</th><th>กลุ่มสาระ</th><th>บทบาท</th><th>ห้องที่ปรึกษา</th><th>ผล</th></tr></thead><tbody>${out.map(x => `<tr><td>${x.line}</td><td>${esc(x.name)}</td><td class="muted small">${esc(x.email || '')}</td><td>${esc(x.dept || '')}</td><td class="small">${(x.roles || []).map(r => ROLES[r]).join(', ')}</td><td class="small">${x.hrWarn ? `<span style="color:var(--warn)">${esc(x.hrWarn)}</span>` : x.hr ? esc(roomName(x.hr)) : x.clr ? 'ถอดออก' : '<span class="muted">—</span>'}</td><td>${chip(lab[x.status][0], lab[x.status][1])}</td></tr>`).join('')}</tbody></table></div>
    <div class="muted small" style="margin-top:8px">จับคู่คนเดิมด้วยอีเมลก่อน ถ้าไม่มีอีเมลจึงเทียบชื่อ (ไม่สนคำนำหน้าและช่องว่าง) · ช่องที่เว้นว่างในไฟล์จะคงค่าเดิมไว้ · ห้องที่ปรึกษาเว้นว่างได้ถ้าไม่มี (คนเดิมคงห้องเดิม) ใส่ - เพื่อถอดออก · ห้องละไม่เกิน 2 คน</div>
    <button class="btn pri" style="width:100%;margin-top:12px" data-ad="stImpOk" ${n('new') + n('upd') ? '' : 'disabled'}>นำเข้า ${n('new') + n('upd')} รายการ</button>`);
  wide(820);
}

/* ================= ② โครงสร้างโรงเรียน ================= */
function school() {
  const ann = !!S.settings.resultsAnnounced, maxN = num(S.settings.maxStudents) || 40;
  const ep = hrEp();
  const syncTxt = '';
  return `<div class="grid g2" style="align-items:start">
    <div class="card"><h2>ปี/ภาคเรียน</h2><div class="muted small" style="margin-bottom:8px">ทุกหน้าจออ้างอิงปี/ภาคเรียนที่ “กำลังใช้” · ข้อมูลภาคเก่ายังเปิดดูได้</div>
      <div class="list">${S.terms.slice().sort((a, b) => (b.year + b.sem).localeCompare(a.year + a.sem)).map(t => { const on = t.year === S.term.year && t.sem === S.term.sem, i = S.terms.indexOf(t);
        return `<div class="row"><div class="ico ${on ? 'ok' : ''}">${ic('cal')}</div><div class="grow"><div class="t">ภาคเรียนที่ ${esc(t.sem)}/${esc(t.year)}</div><div class="muted small">${t.open ? thDate(t.open) + ' – ' + (t.close ? thDate(t.close) : '?') : 'ยังไม่กำหนดวันเปิด-ปิด'}</div></div>
          ${on ? chip('กำลังใช้', 'ok') : `<button class="btn sm" data-ad="termUse" data-i="${i}">ใช้ภาคนี้</button><button class="btn sm ghost" data-ad="termDel" data-i="${i}" aria-label="ลบภาค ${esc(t.sem)}/${esc(t.year)}">ลบ</button>`}</div>`; }).join('')}</div>
      <div class="row" style="flex-wrap:wrap"><input class="in" id="ad-ty" style="width:110px" inputmode="numeric" placeholder="ปี เช่น 2570" aria-label="ปีการศึกษา">
        <select class="in" id="ad-ts" style="width:100px" aria-label="ภาคเรียน"><option>1</option><option>2</option><option>3</option></select><button class="btn" data-ad="termAdd">${ic('plus')}เพิ่มปี/ภาค</button></div></div>
    <div class="card"><h2>การประกาศผลการเรียนอย่างเป็นทางการ</h2>
      <div class="muted small">คุมการแสดงคะแนนปลายภาค คะแนนรวม และเกรดในหน้านักเรียน “ทุกวิชาพร้อมกัน”</div>
      <div class="notice ${ann ? '' : 'bad'}" style="margin-top:10px;background:${ann ? 'var(--ok-soft)' : 'var(--warn-soft)'}">${ann ? '<b>ประกาศผลทางการแล้ว</b> — นักเรียนเห็นคะแนนรวมและเกรดทุกวิชา พร้อมข้อความเตือนให้ยึดข้อมูลจาก SGS เป็นหลัก' : '<b>รอประกาศผลทางการ</b> — นักเรียนเห็นเฉพาะคะแนนเก็บและเวลาเรียน ครูแต่ละวิชายังกดเผยแพร่เองได้ที่หน้าสรุป ปพ.5'}</div>
      ${ann ? `<button class="btn" data-ad="annOff">${ic('lock')}ยกเลิกการประกาศผล</button>` : `<button class="btn pri" data-ad="annOn">${ic('bell')}ประกาศผลทุกวิชาพร้อมกัน</button>`}
      <div class="row" style="margin-top:12px"><div class="grow"><div class="t">ฐานข้อมูลนักเรียนกลาง</div><div class="muted small">รายชื่อ ย้ายห้อง เรียงเลขที่ นำเข้าจากไฟล์</div></div><button class="btn sm" data-act="go" data-p="a-students">เปิด</button></div></div>
  </div>
  <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">ห้องเรียนและจำนวนนักเรียน</h2><div class="muted small">ห้องที่มีรายชื่อในระบบนับจากรายชื่อจริง ห้องอื่นกรอกยอดได้เอง</div></div>
      <label class="small" for="ad-max">เกณฑ์ต่อห้อง</label><input class="in" id="ad-max" type="number" min="1" style="width:84px" value="${maxN}" data-adf="maxN"></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th style="text-align:right">นักเรียน</th><th>ครูที่ปรึกษา</th><th>รายวิชาในตาราง</th><th></th></tr></thead><tbody>${sortRooms(S.rooms).map(r => { const c = cls(r.id), n = roomCount(r), subj = X() ? new Set(X().allEntries().filter(e => e.classId === r.id).map(e => e.subject)).size : 0;
      return `<tr><td><b>${esc(r.name)}</b>${c ? ' ' + chip('มีรายชื่อ', 'info') : ''}</td>
        <td style="text-align:right">${c ? `<b>${n}</b>` : `<input class="in" type="number" min="0" value="${n}" data-adf="roomN" data-id="${r.id}" style="width:72px" aria-label="จำนวนนักเรียน ${esc(r.name)}">`} ${n > maxN ? chip('เกิน', 'warn') : ''}</td>
        <td class="small">${hrOf(r.id).map(esc).join(', ') || '<span class="muted">—</span>'}</td><td>${subj} วิชา</td>
        <td>${c || subj ? '' : `<button class="btn sm ghost" data-ad="roomDel" data-id="${r.id}" aria-label="ลบห้อง ${esc(r.name)}">ลบ</button>`}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="row" style="flex-wrap:wrap"><input class="in" id="ad-rn" placeholder="ชื่อห้อง เช่น ม.6/4" style="width:180px" aria-label="ชื่อห้องใหม่"><input class="in" id="ad-rc" type="number" min="0" placeholder="จำนวน" style="width:100px" aria-label="จำนวนนักเรียน">
      <button class="btn" data-ad="roomAdd">${ic('plus')}เพิ่มห้อง</button>
      <span class="grow"></span><button class="btn" data-ad="roomBulk">${ic('grid')}สร้างหลายห้อง</button>${stuImpBtn()}</div></div>
  <div class="card" style="margin-top:16px"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">เชื่อมต่อระบบข้อมูลบุคลากร (HR Google Sheet · pcsHr)</h2>
      <div class="muted small">ซิงก์ข้อมูลตำแหน่ง วิทยฐานะ และชื่อ-สกุล 2 ทางกับชีตของโรงเรียน</div></div>
      <button class="btn sm pri" data-ad="hrSync" style="background:#2563eb;color:#fff">${ic('cloud')}จัดการเชื่อมต่อ HR</button></div>
    <div class="muted small" style="margin-top:8px">สถานะ: <b>${ep ? '🟢 เชื่อมต่อกับ Web App แล้ว (' + esc(ep.slice(0, 45)) + '...)' : '🟡 ยังไม่ได้เชื่อมต่อระบบ HR'}</b>${syncTxt}</div></div>`;
}

/* ================= ③ ปฏิทินภาคเรียน ================= */
const HOLIDAY_PRESETS = ['วันหยุดราชการ', 'วันหยุดนักขัตฤกษ์', 'วันสำคัญทางศาสนา', 'กิจกรรมของโรงเรียน', 'สอบกลางภาค', 'สอบปลายภาค', 'ปิดเรียนกรณีพิเศษ', 'วันหยุดชดเชย'];
const holidays = () => (S.events || []).filter(e => e.cat === 'holiday').sort((a, b) => a.date.localeCompare(b.date));
const periodsOn = date => X() && X().entriesOn ? X().entriesOn(date).length : 0;
const checkedOn = date => Object.keys(S.attSaved || {}).filter(k => k.split('|')[1] === date).length;
const shiftText = sh => sh.mode === 'day' ? 'ใช้ตารางวัน' + DAYS[num(sh.sourceDay)] + 'ทั้งวัน'
  : (sh.map || []).map(m => `คาบ ${num(m.p) + 1} ← วัน${DAYS[num(m.fromDay)]} คาบ ${num(m.fromP) + 1}`).join(' · ');
function calendar() {
  const t = termCur(), hol = holidays(), mode = t.lock || 'auto';
  return `<div class="card"><h2>ปฏิทินภาคเรียน · ภาคเรียนที่ ${esc(S.term.sem)}/${esc(S.term.year)}</h2><div class="muted small" style="margin-bottom:10px">ใช้คำนวณคาบทั้งภาค คาบค้างเช็กชื่อ และร้อยละเวลาเรียนใน ปพ.5</div>
    <div class="grid g4"><div class="field"><label class="f" for="ad-open">วันเปิดภาคเรียน</label><input class="in" type="date" id="ad-open" value="${esc(t.open || '')}"></div>
      <div class="field"><label class="f" for="ad-close">วันปิดภาคเรียน</label><input class="in" type="date" id="ad-close" value="${esc(t.close || '')}"></div>
      <div class="field"><label class="f" for="ad-min">เวลาเรียนขั้นต่ำ (%)</label><input class="in" type="number" min="0" max="100" id="ad-min" value="${num(t.minAtt == null ? 80 : t.minAtt)}"></div>
      <div class="field"><span class="f">&nbsp;</span><button class="btn pri" style="width:100%" data-ad="termSave">บันทึกปฏิทินภาคเรียน</button></div></div>
    ${!t.open || !t.close ? '<div class="notice bad">ยังไม่ได้กำหนดวันเปิด–ปิดภาคเรียน ระบบจึงยังคำนวณคาบทั้งภาคและเวลาเรียนไม่ได้</div>' : ''}
    <div class="row" style="flex-wrap:wrap"><div class="grow"><div class="t">การกรอกคะแนนของครู</div><div class="muted small">อัตโนมัติ = เปิดถึงวันปิดภาคเรียน แล้วปิดเอง · ตอนนี้ ${lockedNow() ? '<b style="color:var(--bad)">ปิดการกรอก</b>' : '<b style="color:var(--ok)">เปิดให้กรอก</b>'}</div></div>
      <div class="seg" role="group" aria-label="การกรอกคะแนน">${[['auto', 'อัตโนมัติ'], ['open', 'เปิดเสมอ'], ['locked', 'ปิดทันที']].map(([k, l]) => `<button data-ad="lock" data-k="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div></div></div>
  <div class="card"><h2>เวลาคาบเรียน</h2><div class="grid ad-per">${PERIODS.slice(0, 8).map(([a, b], i) =>
    `<div class="row" style="border:0;padding:4px 0"><span style="width:56px">คาบ ${i + 1}</span><input class="in" type="time" value="${a}" data-m2f="per" data-i="${i}" data-j="0" aria-label="เริ่มคาบ ${i + 1}"><span>–</span><input class="in" type="time" value="${b}" data-m2f="per" data-i="${i}" data-j="1" aria-label="สิ้นสุดคาบ ${i + 1}"></div>`).join('')}</div>
    <div class="muted small">คาบ 9 ไม่แสดงเวลา (ใช้กับกิจกรรม/สอนเสริม)</div></div>
  <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">ปฏิทินวันหยุด</h2><div class="muted small">วันที่กำหนดที่นี่ ครูไม่ต้องเช็กชื่อ และไม่นับเป็นคาบเรียน · ใช้ชุดเดียวกับปฏิทินวิชาการ</div></div>${chip(hol.length + ' วัน', 'gold')}</div>
    <div class="grid g4"><div class="field"><label class="f" for="ad-hf">ตั้งแต่วันที่</label><input class="in" type="date" id="ad-hf"></div>
      <div class="field"><label class="f" for="ad-ht">ถึงวันที่ (เว้นว่างถ้าวันเดียว)</label><input class="in" type="date" id="ad-ht"></div>
      <div class="field"><label class="f" for="ad-hn">ชื่อวันหยุด / เหตุผล</label><input class="in" id="ad-hn" list="ad-hp" placeholder="เช่น วันแม่แห่งชาติ"><datalist id="ad-hp">${HOLIDAY_PRESETS.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="field"><span class="f">&nbsp;</span><button class="btn pri" style="width:100%" data-ad="holAdd">${ic('plus')}เพิ่มวันหยุด</button></div></div>
    <label class="small"><input type="checkbox" id="ad-hw" checked> ข้ามเสาร์-อาทิตย์เมื่อเพิ่มเป็นช่วงวัน</label>
    <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn sm" data-ad="holGoogle">${ic('down')}ดึงวันหยุดราชการจาก Google</button>
      <button class="btn sm" data-ad="pick" data-f="ad-file-ics">นำเข้าไฟล์ .ics</button><input type="file" id="ad-file-ics" data-adfile="ics" accept=".ics,text/calendar" hidden>
      <span class="muted small">ปฏิทิน “วันหยุดในประเทศไทย” ของ Google · แสดงให้ติ๊กยืนยันก่อนเพิ่มเสมอ</span></div>
    ${hol.length ? `<div class="scroll" style="max-height:360px"><table class="tbl"><thead><tr><th>วันที่</th><th>วัน</th><th>ชื่อวันหยุด / เหตุผล</th><th>คาบที่งดเช็กชื่อ</th><th></th></tr></thead><tbody>${hol.map(h => { const out = (t.open && h.date < t.open) || (t.close && h.date > t.close), ck = checkedOn(h.date);
      return `<tr><td><b>${thDate(h.date)}</b>${out ? '<br>' + chip('นอกภาคเรียน') : ''}</td><td>${dayName(h.date)}</td>
        <td><input class="in" value="${esc(h.title)}" data-adf="holName" data-id="${h.id}" style="width:100%;min-width:180px;text-align:left" aria-label="ชื่อวันหยุด ${thDate(h.date)}"></td>
        <td>${dayIdxOf(h.date) < 0 ? '<span class="muted small">เสาร์-อาทิตย์</span>' : periodsOn(h.date) + ' คาบ'}${ck ? '<br>' + chip('เคยเช็กชื่อ ' + ck, 'warn') : ''}</td>
        <td><button class="btn sm ghost" data-ad="holDel" data-id="${h.id}" aria-label="ลบวันหยุด ${thDate(h.date)}">ลบ</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่ได้กำหนดวันหยุด</div>'}</div>
  <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">สลับวันเรียน / สลับคาบ</h2>
      <div class="muted small">ใช้เมื่อโรงเรียนยกตารางของอีกวันมาเรียน เช่น เอาคาบวันศุกร์มาเรียนวันพุธ หรือเปลี่ยนคาบชุมนุมเป็นคาบ 1 ของวันศุกร์ — ครูทุกคนได้ตารางและคาบที่ต้องเช็กชื่อใหม่พร้อมกัน</div></div>
      ${chip((S.dayShifts || []).length + ' วัน', 'info')}<button class="btn pri" data-ad="shAdd">${ic('plus')}เพิ่มการสลับวัน</button></div>
    ${(S.dayShifts || []).length ? `<div class="scroll"><table class="tbl"><thead><tr><th>วันที่</th><th>รูปแบบ</th><th>ชื่อ/เหตุผล</th><th style="text-align:right">คาบที่ยกมา</th><th></th></tr></thead><tbody>${(S.dayShifts || []).slice().sort((a, b) => a.date.localeCompare(b.date)).map(sh => { const im = shiftImpact(sh), hl = holidays().find(h => h.date === sh.date);
      return `<tr><td><b>${thDate(sh.date)}</b><br><span class="muted small">วัน${dayName(sh.date)}</span>${hl ? '<br>' + chip('ตรงกับวันหยุด', 'bad') : ''}</td>
        <td>${chip(sh.mode === 'day' ? 'ทั้งวัน' : 'รายคาบ', 'info')}<br><span class="muted small">${esc(shiftText(sh))}</span></td><td>${esc(sh.name || '—')}</td>
        <td style="text-align:right">${im.moved}<br><span class="muted small">ครู ${im.teachers} คน</span></td>
        <td style="white-space:nowrap"><button class="btn sm" data-ad="shEdit" data-id="${sh.id}">แก้ไข</button> <button class="btn sm ghost" data-ad="shDel" data-id="${sh.id}">ลบ</button></td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="empty">ยังไม่มีการสลับวันเรียนในภาคเรียนนี้<br><span class="small">สัปดาห์ไหนที่โรงเรียนย้ายคาบ ให้เพิ่มที่นี่ ครูไม่ต้องแก้ตารางของตัวเอง</span></div>'}
    <div class="notice" style="margin-top:10px">วันหยุดมาก่อนเสมอ — ถ้าวันนั้นเป็นวันหยุดด้วย ระบบยังถือว่าไม่ต้องเช็กชื่อ · ถ้าวันต้นทางที่ยกคาบมาไม่มีการเรียนแล้ว อย่าลืมเพิ่มเป็นวันหยุดด้านบน</div></div>`;
}
function shiftImpact(sh) {
  if (!X() || !X().entriesOn) return { moved: 0, teachers: 0 };
  const di = dayIdxOf(sh.date), list = X().entriesOn(sh.date, null, sh).filter(e => e.shifted || e.day !== di);
  return { moved: list.length, teachers: new Set(list.map(e => e.teacher)).size };
}

/* ---------- วันหยุดจาก Google / ไฟล์ .ics ---------- */
const GCAL = 'th.th#holiday@group.v.calendar.google.com';
const GICS = 'https://calendar.google.com/calendar/ical/' + encodeURIComponent(GCAL) + '/public/basic.ics';
const official = t => /^\s*(วันหยุด|public holiday)/i.test(String(t || ''));
const icsISO = v => /^\d{8}$/.test(v) ? v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6) : '';
const icsText = v => String(v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
async function parseIcs(file) {          // คลี่บรรทัดที่ Google พับไว้ตั้งแต่ยังเป็นไบต์ ชื่อภาษาไทยจะได้ไม่เพี้ยน
  const bytes = new Uint8Array(await file.arrayBuffer()), flat = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && (bytes[i + 2] === 32 || bytes[i + 2] === 9)) { i += 2; continue; }
    if (bytes[i] === 10 && (bytes[i + 1] === 32 || bytes[i + 1] === 9)) { i += 1; continue; }
    flat.push(bytes[i]);
  }
  const text = new TextDecoder('utf-8').decode(new Uint8Array(flat));
  return text.split('BEGIN:VEVENT').slice(1).map(chunk => { const body = chunk.split('END:VEVENT')[0], pick = re => { const m = body.match(re); return m ? m[1] : ''; };
    return { date: icsISO(pick(/DTSTART[^:\n]*:(\d{8})/)), endDate: icsISO(pick(/DTEND[^:\n]*:(\d{8})/)), name: icsText(pick(/[\r\n]SUMMARY[^:\n]*:([^\r\n]*)/)),
      official: official(icsText(pick(/[\r\n]DESCRIPTION[^:\n]*:([^\r\n]*)/))) }; }).filter(x => x.date);
}
const expand = ev => { const out = [], last = ev.endDate && ev.endDate > ev.date ? shift(ev.endDate, -1) : ev.date; let d = ev.date;
  for (let g = 0; g < 31; g++) { out.push({ date: d, name: ev.name, official: ev.official }); if (d >= last) break; d = shift(d, 1); } return out; };
let HOLIMP = [];
function holImport(events, label) {
  const t = termCur(), have = new Set(holidays().map(h => h.date)), seen = new Set(), all = [];
  events.forEach(ev => expand(ev).forEach(x => { if (!seen.has(x.date)) { seen.add(x.date); all.push(x); } }));
  all.sort((a, b) => a.date.localeCompare(b.date));
  const list = all.filter(x => !t.open || !t.close || (x.date >= t.open && x.date <= t.close)), skipped = all.length - list.length;
  if (!list.length) return toast('ไม่พบวันหยุดในช่วงเปิด-ปิดภาคเรียนนี้ (อ่านมา ' + all.length + ' วัน)');
  HOLIMP = list;
  modal(`<h2 style="margin-bottom:8px">วันหยุดจากปฏิทิน Google · ${esc(label)}</h2>
    <div class="notice">พบ <b>${list.length}</b> วันในช่วงภาคเรียนนี้${skipped ? ` (อีก ${skipped} วันอยู่นอกช่วง จึงไม่แสดง)` : ''}<br>ระบบติ๊กให้เฉพาะ <b>วันหยุดนักขัตฤกษ์</b> ที่ยังไม่มีในปฏิทินและไม่ตรงเสาร์-อาทิตย์ — วันสำคัญอย่างวันวาเลนไทน์ โรงเรียนยังเปิดสอน จึงไม่ติ๊กให้</div>
    <div class="row" style="border:0;gap:8px"><button class="btn sm" data-ad="holPick" data-k="official">ติ๊กเฉพาะวันหยุดนักขัตฤกษ์</button><button class="btn sm" data-ad="holPick" data-k="none">ล้างการติ๊ก</button></div>
    <div class="scroll" style="max-height:48vh"><table class="tbl"><thead><tr><th></th><th>วันที่</th><th>ชื่อวันหยุด</th><th>ประเภท</th><th>ผลกับตาราง</th></tr></thead><tbody>${list.map((x, i) => { const we = dayIdxOf(x.date) < 0, ex = have.has(x.date);
      return `<tr><td><input type="checkbox" class="ad-hol" data-i="${i}" ${x.official && !we && !ex ? 'checked' : ''} aria-label="เลือก ${esc(x.name)}"></td><td><b>${thDate(x.date)}</b><br><span class="muted small">${dayName(x.date)}</span></td>
        <td>${esc(x.name || 'วันหยุด')}</td><td>${chip(x.official ? 'วันหยุดนักขัตฤกษ์' : 'วันสำคัญ · ไม่ใช่วันหยุดราชการ', x.official ? 'gold' : '')}</td>
        <td class="small">${we ? 'เสาร์-อาทิตย์' : periodsOn(x.date) + ' คาบ'}${ex ? '<br>' + chip('มีในปฏิทินแล้ว', 'ok') : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <button class="btn pri" style="width:100%;margin-top:12px" data-ad="holImpOk">เพิ่มวันที่ติ๊กไว้ลงปฏิทิน</button>`);
  wide(860);
}
function holHelp(err) {
  const project = (window.EMS_CONFIG && EMS_CONFIG.firebase || {}).projectId || '';
  modal(`<h2 style="margin-bottom:8px">ยังดึงออนไลน์ไม่ได้ · ใช้ไฟล์ .ics แทนได้เลย</h2>
    <div class="notice">${esc(err || 'ยังไม่ได้กรอก apiKey ใน config.js')} — วิธีนำเข้าไฟล์ด้านล่างได้วันหยุดชุดเดียวกัน ไม่ต้องตั้งค่าเพิ่ม</div>
    <b>วิธีที่ 1 — นำเข้าไฟล์ .ics (ใช้ได้ทันที)</b>
    <ol style="margin:6px 0 12px 20px;line-height:1.8"><li>เปิด <a href="${GICS}" target="_blank" rel="noopener">ไฟล์วันหยุดในประเทศไทยของ Google</a> เบราว์เซอร์จะดาวน์โหลด basic.ics ให้</li><li>กลับมากด <b>นำเข้าไฟล์ .ics</b> แล้วเลือกไฟล์นั้น</li><li>ทำปีละครั้งก็พอ วันหยุดทั้งปีอยู่ในไฟล์เดียว</li></ol>
    <b>วิธีที่ 2 — ให้กดดึงออนไลน์ได้ตลอด (ทำครั้งเดียว)</b>
    <ol style="margin:6px 0 12px 20px;line-height:1.8"><li>เปิด <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${esc(project)}" target="_blank" rel="noopener">หน้าเปิดใช้ Google Calendar API</a> ของโปรเจกต์ ${esc(project)} แล้วกด Enable</li>
      <li>ที่หน้า Credentials เพิ่ม Google Calendar API ให้คีย์ที่เว็บนี้ใช้ แล้วกรอก apiKey ใน config.js</li></ol>
    <div class="muted small">ปฏิทินนี้เป็นข้อมูลสาธารณะของ Google ไม่มีข้อมูลของโรงเรียนถูกส่งออกไป</div>`);
  wide(720);
}
/* ชุดสำรองในแอป: data/th-holidays.json คัดจากไฟล์ .ics ของปฏิทินเดียวกัน (2021–2031) · ใช้เมื่อดึงออนไลน์ไม่ได้ (คีย์ยังไม่เปิด Calendar API) */
async function holBundled(err) {
  try { const r = await fetch('data/th-holidays.json', { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(), ev = Array.isArray(d.events) ? d.events : []; if (!ev.length) throw new Error('ไฟล์วันหยุดว่าง');
    holImport(ev, 'ชุดวันหยุดในแอป · ข้อมูล Google ถึงปี ' + ev[ev.length - 1].date.slice(0, 4)); }
  catch (e) { holHelp(err || (e && e.message)); }
}
async function holGoogle() {
  const t = termCur(); if (!t.open || !t.close) return toast('กรุณากำหนดวันเปิด-ปิดภาคเรียนก่อน');
  const key = (window.EMS_CONFIG && EMS_CONFIG.firebase || {}).apiKey || '';
  if (!key) return holBundled('ยังไม่ได้กรอก apiKey ของ Firebase ใน config.js');
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(GCAL) + '/events?key=' + encodeURIComponent(key) +
      '&timeMin=' + t.open + 'T00:00:00Z&timeMax=' + t.close + 'T23:59:59Z&singleEvents=true&orderBy=startTime&maxResults=250');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error || {}).message || 'HTTP ' + res.status);
    const ev = (data.items || []).map(e => ({ date: (e.start || {}).date || String((e.start || {}).dateTime || '').slice(0, 10), endDate: (e.end || {}).date || '', name: String(e.summary || '').trim(), official: official(e.description) })).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
    if (!ev.length) return toast('ปฏิทิน Google ไม่มีวันหยุดในช่วงภาคเรียนนี้');
    holImport(ev, 'ดึงออนไลน์');
  } catch (e) { holBundled(e && e.message); }
}

/* ---------- ตัวแก้ไขการสลับวัน ---------- */
let SH = null;
function shiftEditor(existing) {
  SH = existing ? JSON.parse(JSON.stringify(existing)) : { id: uid('sh'), date: todayISO(), mode: 'day', sourceDay: 4, map: [], name: '', isNew: true };
  if (!SH.map || !SH.map.length) SH.map = [{ p: 0, fromDay: 4, fromP: 0 }];
  drawShift();
}
function collectShift() {
  const L = $('#layer'); if (!L || !$('#ad-sd', L)) return;
  SH.date = $('#ad-sd', L).value; SH.name = $('#ad-sn', L).value.trim(); SH.mode = $('#ad-sm', L).value; SH.sourceDay = num($('#ad-ss', L).value);
  SH.map = [...L.querySelectorAll('[data-shrow]')].map(r => ({ p: num(r.querySelector('.sr-p').value), fromDay: num(r.querySelector('.sr-d').value), fromP: num(r.querySelector('.sr-f').value) }));
}
function drawShift() {
  const pOpt = v => PERIODS.map((_, i) => `<option value="${i}" ${num(v) === i ? 'selected' : ''}>คาบ ${i + 1}</option>`).join('');
  const dOpt = v => DAYS.map((d, i) => `<option value="${i}" ${num(v) === i ? 'selected' : ''}>วัน${d}</option>`).join('');
  const im = SH.date ? shiftImpact(SH) : { moved: 0, teachers: 0 }, hl = holidays().find(h => h.date === SH.date);
  const stay = SH.date && X() && X().entriesOn ? X().entriesOn(SH.date, null, SH).length - im.moved : 0;
  modal(`<h2 style="margin-bottom:12px">${SH.isNew ? 'เพิ่ม' : 'แก้ไข'}การสลับวันเรียน / สลับคาบ</h2>
    <div class="grid g2"><div class="field"><label class="f" for="ad-sd">วันที่ที่มีการสลับ</label><input class="in" type="date" id="ad-sd" value="${esc(SH.date)}" data-adf="shUpd"></div>
      <div class="field"><label class="f" for="ad-sn">ชื่อ/เหตุผล ที่ครูจะเห็น</label><input class="in" id="ad-sn" value="${esc(SH.name || '')}" placeholder="เช่น เรียนชดเชยตารางวันศุกร์"></div></div>
    <div class="field"><label class="f" for="ad-sm">รูปแบบการสลับ</label><select class="in" id="ad-sm" data-adf="shUpd"><option value="day" ${SH.mode === 'day' ? 'selected' : ''}>สลับทั้งวัน — วันนี้ใช้ตารางของอีกวันทั้งวัน</option><option value="slots" ${SH.mode === 'slots' ? 'selected' : ''}>สลับเฉพาะบางคาบ — เช่น คาบชุมนุมใช้คาบ 1 ของวันศุกร์</option></select></div>
    <div class="field" ${SH.mode === 'day' ? '' : 'hidden'}><label class="f" for="ad-ss">วันนี้ใช้ตารางสอนของ</label><select class="in" id="ad-ss" data-adf="shUpd">${dOpt(SH.sourceDay)}</select></div>
    <div ${SH.mode === 'slots' ? '' : 'hidden'}><div class="muted small">ระบุเป็นคู่ ๆ ว่าคาบไหนของวันนี้ ใช้คาบไหนของวันอะไร · คาบที่ไม่ได้ระบุเรียนตามตารางปกติ</div>
      ${SH.map.map((m, i) => `<div class="row" data-shrow="${i}" style="border:0;padding:4px 0;flex-wrap:wrap"><select class="in sr-p" style="width:110px" data-adf="shUpd" aria-label="คาบของวันนี้">${pOpt(m.p)}</select><b>←</b>
        <select class="in sr-d" style="width:140px" data-adf="shUpd" aria-label="ใช้ตารางของวัน">${dOpt(m.fromDay)}</select><select class="in sr-f" style="width:110px" data-adf="shUpd" aria-label="คาบต้นทาง">${pOpt(m.fromP)}</select>
        <button class="btn sm ghost" data-ad="shRowDel" data-i="${i}" aria-label="ลบแถว">✕</button></div>`).join('')}
      <button class="btn sm" data-ad="shRowAdd">${ic('plus')}เพิ่มคาบที่สลับ</button></div>
    <div class="notice" style="margin-top:12px;background:var(--info-soft)"><b>${SH.date ? thDate(SH.date) + ' (วัน' + dayName(SH.date) + ')' : '—'}</b> · ${esc(shiftText(SH))}<br>คาบที่ยกมาจากวันอื่น <b>${im.moved}</b> คาบ (ครู ${im.teachers} คน) · คาบเดิมที่ยังเรียนตามปกติ <b>${Math.max(0, stay)}</b> คาบ
      ${hl ? `<br><b style="color:var(--bad)">วันนี้เป็นวันหยุด (${esc(hl.title)}) อยู่แล้ว ระบบจะยังถือว่าไม่ต้องเช็กชื่อ</b>` : ''}</div>
    <button class="btn pri" style="width:100%;margin-top:12px" data-ad="shSave">${SH.isNew ? 'เพิ่มการสลับวัน' : 'บันทึกการแก้ไข'}</button>`);
  wide(720);
}

/* ================= ④ ตารางสอนทั้งโรงเรียน ================= */
const getDuties = () => {
  const d = S.ttDuties;
  return {
    meetings: d && Array.isArray(d.meetings) ? d.meetings : [],
    activities: d && Array.isArray(d.activities) ? d.activities : [],
    extras: d && Array.isArray(d.extras) ? d.extras : []
  };
};
const mutDuties = () => {
  if (!S.ttDuties || typeof S.ttDuties !== 'object') S.ttDuties = { meetings: [], activities: [], extras: [] };
  if (!Array.isArray(S.ttDuties.meetings)) S.ttDuties.meetings = [];
  if (!Array.isArray(S.ttDuties.activities)) S.ttDuties.activities = [];
  if (!Array.isArray(S.ttDuties.extras)) S.ttDuties.extras = [];
  return S.ttDuties;
};
const sameT = (a, b) => a === b || (!!a && !!b && norm(a) === norm(b));
const expandRoomStr = s => {
  const raw = String(s || '').trim().replace(/\s+/g, '');
  const m = raw.match(/^ม\.?(\d+)\/(\d+)[-–,](\d+)$/);
  if (m) {
    const lv = m[1], a = +m[2], b = +m[3], out = [];
    for (let r = a; r <= b; r++) out.push('ม.' + lv + '/' + r);
    return out;
  }
  return raw ? [raw.replace(/^ม\.?(?=\d)/, 'ม.')] : [];
};
const dutiesAt = (teacher, day, p) => {
  if (!teacher) return [];
  const d = getDuties(), out = [];
  d.meetings.forEach((m, idx) => {
    const sp = Math.max(1, +m.span || 1);
    if (+m.day === day && p >= +m.slot && p < +m.slot + sp && (m.teachers || []).some(t => sameT(t, teacher))) {
      out.push({ kind: 'meeting', idx, id: m.id || ('m' + idx), name: m.name || 'ประชุม', room: m.room || '', day: +m.day, slot: +m.slot, span: sp });
    }
  });
  d.extras.forEach((ex, idx) => {
    if (+ex.day === day && +ex.slot === p && sameT(ex.teacher, teacher)) {
      out.push({ kind: 'extra', idx, id: ex.id || ('ex' + idx), subject: ex.subject || ex.subjectCode || 'คาบเสริม', subjectCode: ex.subjectCode || 'เสริม', className: ex.className || '', room: ex.room || '', teacher: ex.teacher });
    }
  });
  d.activities.forEach((a, idx) => {
    if (+a.day === day && +a.slot === p && (!(a.teachers && a.teachers.length) || a.teachers.some(t => sameT(t, teacher)))) {
      out.push({ kind: 'activity', idx, id: a.id || ('act' + idx), name: a.name || 'กิจกรรม', code: a.code || 'กิจกรรม', room: a.room || '' });
    }
  });
  return out;
};
const roomExtrasAt = (roomIdOrName, day, p) => {
  const rn = roomName(roomIdOrName) || String(roomIdOrName || '').trim();
  if (!rn) return [];
  return getDuties().extras.map((ex, idx) => Object.assign({ idx }, ex)).filter(ex => +ex.day === day && +ex.slot === p && expandRoomStr(ex.className).indexOf(rn) >= 0);
};
function clashes() {
  if (!X()) return [];
  const out = [], byT = {}, byR = {};
  X().allEntries().forEach(e => { const kt = e.teacher + '|' + e.day + '|' + e.p, kr = e.classId + '|' + e.day + '|' + e.p;
    (byT[kt] = byT[kt] || []).push(e); (byR[kr] = byR[kr] || []).push(e); });
  Object.values(byT).filter(l => new Set(l.map(e => e.subject)).size > 1).forEach(l => out.push({ kind: 'ครูสอนชนคาบ', text: `${l[0].teacher} · วัน${DAYS[l[0].day]} คาบ ${l[0].p + 1} · ${l.map(e => roomName(e.classId)).join(' / ')}` }));
  Object.values(byR).filter(l => l.length > 1 && new Set(l.map(e => e.subject + e.teacher)).size > 1).forEach(l => out.push({ kind: 'ห้องหลายวิชา', text: `${roomName(l[0].classId)} · วัน${DAYS[l[0].day]} คาบ ${l[0].p + 1} · ${l.map(e => e.teacher).join(' / ')}` }));
  getDuties().meetings.forEach(m => {
    const sp = Math.max(1, +m.span || 1);
    (m.teachers || []).forEach(t => {
      for (let k = 0; k < sp; k++) {
        const p = +m.slot + k, es = byT[t + '|' + m.day + '|' + p];
        if (es && es.length) out.push({ kind: 'คาบสอนชนประชุม', text: `${t} · วัน${DAYS[m.day]} คาบ ${p + 1} (${m.name}) ชนกับ ${es.map(e => roomName(e.classId)).join(' / ')}` });
      }
    });
  });
  return out;
}
function dutyManageCard(allEntries) {
  const d = getDuties(), tab = S.adm.dutyTab || 'meetings', q = String(S.adm.mtgQ || '').trim().toLowerCase();
  const byT = {};
  (allEntries || []).forEach(e => { (byT[e.teacher + '|' + e.day + '|' + e.p] = byT[e.teacher + '|' + e.day + '|' + e.p] || []).push(e); });
  const deptOf = n => ((S.staff.find(u => sameT(u.name, n)) || {}).dept || '');
  const staffDatalist = `<datalist id="ad-dl-staff">${S.staff.filter(u => !isVacU(u)).sort((a, b) => a.name.localeCompare(b.name, 'th')).map(u => `<option value="${esc(u.name)}">${esc(u.dept || '')}</option>`).join('')}</datalist>`;
  const uniqMtgTeachers = new Set();
  d.meetings.forEach(m => (m.teachers || []).forEach(t => uniqMtgTeachers.add(t)));

  let body = '';
  if (tab === 'meetings') {
    const filteredMtgs = d.meetings.map((m, idx) => ({ m, idx })).filter(({ m }) => !q || String(m.name || '').toLowerCase().indexOf(q) >= 0 || (m.teachers || []).some(t => t.toLowerCase().indexOf(q) >= 0 || deptOf(t).toLowerCase().indexOf(q) >= 0));
    const allMtgRows = [];
    d.meetings.forEach((m, idx) => {
      const sp = Math.max(1, +m.span || 1), pTxt = sp > 1 ? `คาบ ${+m.slot + 1}–${+m.slot + sp}` : `คาบ ${+m.slot + 1}`;
      (m.teachers || []).forEach(t => {
        if (q && String(m.name || '').toLowerCase().indexOf(q) < 0 && t.toLowerCase().indexOf(q) < 0 && deptOf(t).toLowerCase().indexOf(q) < 0) return;
        let clashRooms = [];
        for (let k = 0; k < sp; k++) {
          const es = byT[t + '|' + m.day + '|' + (+m.slot + k)] || [];
          es.forEach(e => clashRooms.push(`คาบ ${+m.slot + k + 1} (${roomName(e.classId)})`));
        }
        allMtgRows.push({ t, dept: deptOf(t), mName: m.name, mIdx: idx, day: +m.day, slot: +m.slot, pTxt, clash: clashRooms.join(', ') });
      });
    });
    allMtgRows.sort((a, b) => a.mIdx - b.mIdx || a.t.localeCompare(b.t, 'th'));

    body = `<div class="row" style="border:0;padding:4px 0 10px;flex-wrap:wrap;gap:8px">
        <input class="in" style="max-width:280px" data-adf="mtgQ" value="${esc(S.adm.mtgQ || '')}" placeholder="ค้นหาชื่อครู / กลุ่มสาระ / ชื่อการประชุม...">
        <div class="grow muted small">คลิกที่ชื่อครูเพื่อดูตารางสอนของครูคนนั้นทันที · กด ✕ เพื่อนำรายชื่อออก หรือพิมพ์ชื่อเพื่อเพิ่มเข้ากลุ่มประชุม</div>
        <button class="btn sm pri" data-ad="mtgAddGroup">+ เพิ่มกลุ่มคาบประชุม</button>
      </div>
      ${filteredMtgs.length ? `<div class="grid g2" style="align-items:start;margin-bottom:14px">${filteredMtgs.map(({ m, idx }) => {
        const sp = Math.max(1, +m.span || 1), ts = (m.teachers || []).slice().sort((a, b) => a.localeCompare(b, 'th'));
        const visTs = q && String(m.name || '').toLowerCase().indexOf(q) < 0 ? ts.filter(t => t.toLowerCase().indexOf(q) >= 0 || deptOf(t).toLowerCase().indexOf(q) >= 0) : ts;
        return `<div class="card" style="margin:0;border:1px solid var(--line);background:var(--surface2)">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
            <span class="chip info">📌 กลุ่มที่ ${idx + 1}</span>
            <input class="in" style="flex:1;min-width:150px;font-weight:700" data-adf="mtgField" data-i="${idx}" data-k="name" value="${esc(m.name || '')}" placeholder="ชื่อการประชุม">
            <button class="btn sm ghost" style="color:var(--bad)" data-ad="mtgDelGroup" data-i="${idx}" title="ลบกลุ่มประชุมนี้">ลบกลุ่ม</button>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px" class="small">
            <label>วัน <select class="in" style="width:auto;min-height:32px;padding:2px 8px" data-adf="mtgField" data-i="${idx}" data-k="day">${DAYS.map((dn, di) => `<option value="${di}" ${+m.day === di ? 'selected' : ''}>${dn}</option>`).join('')}</select></label>
            <label>เริ่มคาบ <select class="in" style="width:auto;min-height:32px;padding:2px 8px" data-adf="mtgField" data-i="${idx}" data-k="slot">${PERIODS.map((_, pi) => `<option value="${pi}" ${+m.slot === pi ? 'selected' : ''}>คาบ ${pi + 1}</option>`).join('')}</select></label>
            <label>จำนวนคาบ <select class="in" style="width:auto;min-height:32px;padding:2px 8px" data-adf="mtgField" data-i="${idx}" data-k="span">${[1, 2, 3, 4].map(n => `<option value="${n}" ${sp === n ? 'selected' : ''}>${n} คาบ (ถึงคาบ ${Math.min(PERIODS.length, +m.slot + n)})</option>`).join('')}</select></label>
            <input class="in" style="width:140px;min-height:32px;padding:2px 8px" data-adf="mtgField" data-i="${idx}" data-k="room" value="${esc(m.room || '')}" placeholder="สถานที่/ห้องประชุม">
          </div>
          <div class="small" style="font-weight:600;margin-bottom:6px">รายชื่อครูในกลุ่มนี้ (${ts.length} คน)${visTs.length !== ts.length ? ` · กรองแสดง ${visTs.length} คน` : ''}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;max-height:190px;overflow:auto;padding:6px;background:var(--surface);border-radius:8px;border:1px solid var(--line);margin-bottom:8px">
            ${visTs.length ? visTs.map(t => {
              let hasClash = false;
              for (let k = 0; k < sp; k++) if ((byT[t + '|' + m.day + '|' + (+m.slot + k)] || []).length) hasClash = true;
              const dp = deptOf(t);
              return `<span class="chip ${hasClash ? 'bad' : ''}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px">
                <a href="javascript:void(0)" data-ad="ttPickT" data-t="${esc(t)}" style="color:inherit;text-decoration:none" title="${esc(dp ? 'กลุ่มสาระ: ' + dp + ' · คลิกเพื่อดูตารางสอน' : 'คลิกเพื่อดูตารางสอน')}"><b>${esc(t)}</b>${dp ? ` <small style="opacity:.75">(${esc(dp)})</small>` : ''}${hasClash ? ' ⚠️' : ''}</a>
                <button type="button" style="border:0;background:none;color:inherit;cursor:pointer;padding:0 2px;font-size:.85rem;opacity:.7" data-ad="mtgRmT" data-i="${idx}" data-t="${esc(t)}" title="นำออกจากกลุ่มประชุมนี้">✕</button>
              </span>`;
            }).join('') : `<span class="muted small">ยังไม่มีรายชื่อครูในกลุ่มนี้</span>`}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <input class="in" style="flex:1;min-height:32px" id="ad-mtg-add-${idx}" list="ad-dl-staff" placeholder="+ พิมพ์หรือเลือกชื่อครูเพื่อเพิ่มเข้ากลุ่ม...">
            <button class="btn sm pri" data-ad="mtgAddT" data-i="${idx}">เพิ่มครู</button>
          </div>
        </div>`;
      }).join('')}</div>` : `<div class="notice">ยังไม่มีข้อมูลกลุ่มคาบประชุม — นำเข้าจากไฟล์ Excel ที่มีชีต “รวมทุกคาบทั้งหมด” หรือกด “+ เพิ่มกลุ่มคาบประชุม”</div>`}
      ${allMtgRows.length ? `<details open style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;padding:6px 0">📋 ตารางรวมรายชื่อครูที่มีคาบประชุมทั้งหมด (${allMtgRows.length} รายชื่อ · ครู ${uniqMtgTeachers.size} คน)</summary>
        <div class="scroll" style="max-height:360px;margin-top:6px"><table class="tbl"><thead><tr><th>#</th><th>ชื่อ-สกุลครู</th><th>กลุ่มสาระ/งาน</th><th>กลุ่มการประชุม</th><th>วัน · คาบ</th><th>สถานะตารางสอน</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>
          ${allMtgRows.map((r, i) => `<tr>
            <td class="muted small">${i + 1}</td>
            <td><a href="javascript:void(0)" data-ad="ttPickT" data-t="${esc(r.t)}" style="font-weight:600;color:var(--brand);text-decoration:none">${esc(r.t)}</a></td>
            <td class="small">${esc(r.dept || '—')}</td>
            <td><select class="in" style="width:auto;min-height:30px;padding:2px 6px" data-adf="mtgMoveT" data-from="${r.mIdx}" data-t="${esc(r.t)}">${d.meetings.map((m2, i2) => `<option value="${i2}" ${i2 === r.mIdx ? 'selected' : ''}>${esc(m2.name)}</option>`).join('')}</select></td>
            <td class="small">วัน${DAYS[r.day]} · ${r.pTxt}</td>
            <td>${r.clash ? chip('ชนคาบสอน: ' + r.clash, 'bad') : chip('ปกติ', 'ok')}</td>
            <td style="text-align:right"><button class="btn sm ghost" data-ad="ttPickT" data-t="${esc(r.t)}">ดูตาราง</button> <button class="btn sm ghost" style="color:var(--bad)" data-ad="mtgRmT" data-i="${r.mIdx}" data-t="${esc(r.t)}">เอาออก</button></td>
          </tr>`).join('')}
        </tbody></table></div></details>` : ''}`;
  } else if (tab === 'activities') {
    body = `<div class="row" style="border:0;padding:4px 0 10px;flex-wrap:wrap;gap:8px">
        <div class="grow muted small">คาบกิจกรรมร่วมทั้งโรงเรียนหรือระดับชั้น (เช่น โฮมรูม อบรมคุณธรรม, ชุมนุม/นศท., ส่งเสริมฯ คณะสี, บูรณาการ, PLC กลุ่มสาระ) — แสดงในตารางครูและปรับวัน/คาบได้</div>
        <button class="btn sm pri" data-ad="actAdd">+ เพิ่มคาบกิจกรรม</button>
      </div>
      ${d.activities.length ? `<div class="scroll" style="max-height:420px"><table class="tbl"><thead><tr><th>ชื่อกิจกรรม</th><th>รหัส/ประเภท</th><th>วัน</th><th>คาบ</th><th>สถานที่</th><th>ครูที่เข้าร่วม</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>
        ${d.activities.map((a, idx) => `<tr>
          <td><input class="in" style="min-width:190px;min-height:32px" data-adf="actField" data-i="${idx}" data-k="name" value="${esc(a.name || '')}"></td>
          <td><input class="in" style="width:95px;min-height:32px" data-adf="actField" data-i="${idx}" data-k="code" value="${esc(a.code || 'กิจกรรม')}"></td>
          <td><select class="in" style="width:auto;min-height:32px" data-adf="actField" data-i="${idx}" data-k="day">${DAYS.map((dn, di) => `<option value="${di}" ${+a.day === di ? 'selected' : ''}>${dn}</option>`).join('')}</select></td>
          <td><select class="in" style="width:auto;min-height:32px" data-adf="actField" data-i="${idx}" data-k="slot">${PERIODS.map((_, pi) => `<option value="${pi}" ${+a.slot === pi ? 'selected' : ''}>คาบ ${pi + 1}</option>`).join('')}</select></td>
          <td><input class="in" style="width:120px;min-height:32px" data-adf="actField" data-i="${idx}" data-k="room" value="${esc(a.room || '')}" placeholder="สถานที่"></td>
          <td class="small"><button class="btn sm" data-ad="actEditT" data-i="${idx}">👥 ${(a.teachers || []).length ? (a.teachers || []).length + ' คน' : 'ครูทุกคน'}</button></td>
          <td style="text-align:right"><button class="btn sm ghost" style="color:var(--bad)" data-ad="actDel" data-i="${idx}">ลบ</button></td>
        </tr>`).join('')}
      </tbody></table></div>` : `<div class="notice">ยังไม่มีคาบกิจกรรมร่วม</div>`}`;
  } else {
    body = `<div class="row" style="border:0;padding:4px 0 10px;flex-wrap:wrap;gap:8px">
        <div class="grow muted small">คาบเสริมรายห้อง (เช่น คาบ 9 เสริมวิชาคณิต วิทย์ ภาษาไทย ฯลฯ) — แสดงทั้งในตารางสอนรายครูและรายห้อง</div>
        <button class="btn sm pri" data-ad="exAdd">+ เพิ่มคาบเสริม</button>
      </div>
      ${d.extras.length ? `<div class="scroll" style="max-height:420px"><table class="tbl"><thead><tr><th>วัน</th><th>คาบ</th><th>ห้องเรียน</th><th>วิชา/รายละเอียด</th><th>ครูผู้สอน</th><th>สถานที่</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>
        ${d.extras.map((ex, idx) => `<tr>
          <td><select class="in" style="width:auto;min-height:32px" data-adf="exField" data-i="${idx}" data-k="day">${DAYS.map((dn, di) => `<option value="${di}" ${+ex.day === di ? 'selected' : ''}>${dn}</option>`).join('')}</select></td>
          <td><select class="in" style="width:auto;min-height:32px" data-adf="exField" data-i="${idx}" data-k="slot">${PERIODS.map((_, pi) => `<option value="${pi}" ${+ex.slot === pi ? 'selected' : ''}>คาบ ${pi + 1}</option>`).join('')}</select></td>
          <td><input class="in" style="width:90px;min-height:32px" data-adf="exField" data-i="${idx}" data-k="className" value="${esc(ex.className || '')}" placeholder="ม.1/1"></td>
          <td><input class="in" style="min-width:140px;min-height:32px" data-adf="exField" data-i="${idx}" data-k="subject" value="${esc(ex.subject || '')}" placeholder="ชื่อวิชา"></td>
          <td><input class="in" style="min-width:170px;min-height:32px" list="ad-dl-staff" data-adf="exField" data-i="${idx}" data-k="teacher" value="${esc(ex.teacher || '')}" placeholder="ชื่อครูผู้สอน"></td>
          <td><input class="in" style="width:95px;min-height:32px" data-adf="exField" data-i="${idx}" data-k="room" value="${esc(ex.room || '')}" placeholder="ห้อง/สถานที่"></td>
          <td style="text-align:right"><button class="btn sm ghost" data-ad="ttPickT" data-t="${esc(ex.teacher || '')}">ดูครู</button> <button class="btn sm ghost" style="color:var(--bad)" data-ad="exDel" data-i="${idx}">ลบ</button></td>
        </tr>`).join('')}
      </tbody></table></div>` : `<div class="notice">ยังไม่มีคาบเสริมรายห้อง</div>`}`;
  }

  return `${staffDatalist}<div class="card" id="ad-duty-card">
    <div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px">
      <div class="grow">
        <h2 style="margin:0">การประชุมและกิจกรรมในตารางสอน (รวมรายชื่อครูที่มีคาบประชุม)</h2>
        <div class="muted small">นำเข้าจากชีต “รวมทุกคาบทั้งหมด” หรือเพิ่ม/ปรับแก้ได้โดยตรง · แสดงในตารางสอนของครูและห้องเรียน</div>
      </div>
      <div class="seg" role="group">
        <button data-ad="dutyTab" data-k="meetings" aria-pressed="${tab === 'meetings'}">📌 กลุ่มประชุมและรายชื่อครู (${d.meetings.length} กลุ่ม · ${uniqMtgTeachers.size} คน)</button>
        <button data-ad="dutyTab" data-k="activities" aria-pressed="${tab === 'activities'}">🎯 คาบกิจกรรม (${d.activities.length})</button>
        <button data-ad="dutyTab" data-k="extras" aria-pressed="${tab === 'extras'}">⚡ คาบเสริมรายห้อง (${d.extras.length})</button>
      </div>
    </div>
    ${body}
  </div>`;
}
function timetable() {
  const all = X() ? X().allEntries() : [], v = S.adm.ttView;
  const cvOf = e => e.coverFor || (e.teacher === S.me.name ? (S.ttCover || {})[e.day + '-' + e.p] : '');
  const dAll = getDuties(), dutyT = [];
  dAll.meetings.forEach(m => (m.teachers || []).forEach(t => dutyT.push(t)));
  dAll.extras.forEach(ex => { if (ex.teacher) dutyT.push(ex.teacher); });
  const teachers = [...new Set(S.staff.filter(u => rolesOf(u).indexOf('teacher') >= 0 || isVacU(u)).map(u => u.name).concat(all.map(e => e.teacher), dutyT))].sort((a, b) => isVacN(a) - isVacN(b) || a.localeCompare(b, 'th'));   // ตำแหน่งว่างไว้ท้าย
  const rooms = sortRooms(S.rooms);
  if (v === 'teacher' && teachers.indexOf(S.adm.ttWho) < 0) S.adm.ttWho = teachers.indexOf(S.me.name) >= 0 ? S.me.name : teachers[0] || '';
  if (v === 'room' && !rooms.some(r => r.id === S.adm.ttWho)) S.adm.ttWho = (rooms.find(r => all.some(e => e.classId === r.id)) || rooms[0] || {}).id || '';
  const vacSel = v === 'teacher' && isVacN(S.adm.ttWho);   // ตำแหน่งว่าง: แสดงคาบที่ครูอื่นรับไว้แทนด้วย (สีส้ม + ชื่อครูผู้รับ)
  const mine = all.filter(e => v === 'teacher' ? e.teacher === S.adm.ttWho || vacSel && cvOf(e) === S.adm.ttWho : e.classId === S.adm.ttWho);
  const withTT = new Set(all.map(e => e.teacher)), none = S.staff.filter(u => rolesOf(u).indexOf('teacher') >= 0 && !isVacU(u) && !withTT.has(u.name)), cl = clashes();
  let mtgCount = 0, actCount = 0, exCount = 0;
  let grid = `<div class="tt" style="grid-template-columns:86px repeat(${PERIODS.length},minmax(96px,1fr));min-width:${86 + PERIODS.length * 100}px"><div></div>${PERIODS.map(([a, b], p) => `<div class="h">คาบ ${p + 1}${a ? `<br><span style="font-weight:400">${a}–${b}</span>` : ''}</div>`).join('')}`;
  DAYS.forEach((dn, d) => { grid += `<div class="p" style="justify-content:center"><b style="color:var(--text)">${dn}</b></div>`;
    PERIODS.forEach((_, p) => {
      const es = mine.filter(e => e.day === d && e.p === p);
      const du = v === 'teacher' ? dutiesAt(S.adm.ttWho, d, p) : roomExtrasAt(S.adm.ttWho, d, p).map(ex => ({ kind: 'extra', idx: ex.idx, subject: ex.subject || ex.subjectCode || 'คาบเสริม', className: ex.className, room: ex.room, teacher: ex.teacher }));
      const mtgs = du.filter(x => x.kind === 'meeting'), exs = du.filter(x => x.kind === 'extra'), acts = (!es.length && !mtgs.length && !exs.length) ? du.filter(x => x.kind === 'activity') : [];
      mtgCount += mtgs.length; actCount += acts.length; exCount += exs.length;
      const parts = [];
      es.forEach(e => parts.push(`<b>${esc(String(e.subject || '').split(' ')[0])}</b>${esc(v === 'teacher' ? roomName(e.classId) : shortName(e.teacher))}${e.room ? `<small style="display:block;font-size:.72rem;opacity:.75">${esc(roomLabel(e.room))}</small>` : ''}${cvOf(e) ? (vacSel && e.teacher !== S.adm.ttWho ? `<small>รับไว้แทนโดย ${esc(e.teacher)}</small>` : `<small>สอนแทน ${esc(cvOf(e))}</small>`) : ''}`));
      mtgs.forEach(m => parts.push(`<span style="display:block;color:var(--info);font-weight:700">📌 ${esc(m.name)}</span><small style="display:block;font-size:.72rem;color:var(--info)">ประชุม${m.room && m.room !== m.name ? ' · ' + esc(m.room) : ''}</small>`));
      exs.forEach(ex => parts.push(`<span style="display:block;color:var(--act);font-weight:700">⚡ ${esc(ex.subject)}</span><small style="display:block;font-size:.72rem;color:var(--act)">${esc(v === 'teacher' ? ex.className : shortName(ex.teacher))}${ex.room ? ' · ' + esc(roomLabel(ex.room)) : ''}</small>`));
      acts.forEach(a => parts.push(`<span style="display:block;color:var(--act);font-weight:600">🎯 ${esc(a.name)}</span>${a.room ? `<small style="display:block;font-size:.72rem;opacity:.75">${esc(a.room)}</small>` : ''}`));
      const hasConflict = es.length > 1 || (es.length > 0 && mtgs.length > 0);
      const bgStyle = !es.length && mtgs.length ? 'background:var(--info-soft);border-color:var(--info);' : !es.length && (exs.length || acts.length) ? 'background:var(--act-soft);border-color:var(--act);' : '';
      grid += `<div class="c ${parts.length ? 'on' : ''} ${es.some(cvOf) ? 'cov' : ''}" data-ad="ttCellEdit" data-d="${d}" data-p="${p}" title="คลิกเพื่อแก้ไขคาบสอน / คาบประชุม / กิจกรรมในช่องนี้" style="cursor:pointer;${bgStyle}${hasConflict ? 'box-shadow:0 0 0 2px var(--bad) inset;' : ''}">${parts.join('<hr style="border:0;border-top:1px dashed var(--line);margin:3px 0">')}</div>`;
    }); });
  grid += '</div>';
  const dutySummary = [mtgCount ? `ประชุม ${mtgCount} คาบ` : '', exCount ? `คาบเสริม ${exCount} คาบ` : '', actCount ? `กิจกรรม ${actCount} คาบ` : ''].filter(Boolean).join(' · ');
  return studioCard() + `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><h2 class="grow" style="margin:0">ตารางสอนรายครู / รายห้อง</h2>
      <div class="seg" role="group" aria-label="มุมมอง"><button data-ad="ttView" data-k="teacher" aria-pressed="${v === 'teacher'}">รายครู</button><button data-ad="ttView" data-k="room" aria-pressed="${v === 'room'}">รายห้อง</button></div>
      <select class="in" style="width:auto;min-width:200px" data-adf="ttWho" aria-label="เลือก">${v === 'teacher' ? teachers.map(n => `<option value="${esc(n)}" ${n === S.adm.ttWho ? 'selected' : ''}>${isVacN(n) ? '⏳ ' + esc(n) + ' (ตำแหน่งว่าง)' : esc(n)}</option>`).join('') : rooms.map(r => `<option value="${r.id}" ${r.id === S.adm.ttWho ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
    <div class="muted small" style="margin-bottom:8px">คาบสอนปกติ ${mine.length} คาบ/สัปดาห์${dutySummary ? ' · ' + dutySummary : ''}${v === 'room' && hrOf(S.adm.ttWho).length ? ' · ครูที่ปรึกษา ' + hrOf(S.adm.ttWho).map(esc).join(', ') : ''} · <b>คลิกที่ช่องคาบเพื่อเพิ่ม/แก้ไขคาบสอน ประชุม หรือกิจกรรม</b></div>
    <div class="scroll">${grid}</div></div>
  ${v === 'teacher' && window.EMSTTSum ? EMSTTSum.summaryHTML(mine.filter(e => e.teacher === S.adm.ttWho), S.adm.ttWho) : ''}
  ${dutyManageCard(all)}
  <div class="grid g2" style="align-items:start">
    <div class="card"><h2>ตรวจความถูกต้อง</h2>
      ${cl.length ? `<div class="list">${cl.slice(0, 20).map(c => `<div class="row">${chip(c.kind, 'bad')}<div class="grow small">${esc(c.text)}</div></div>`).join('')}</div>` : `<div class="notice" style="background:var(--ok-soft)">ไม่พบครูสอนชนคาบหรือห้องที่มีหลายวิชาในคาบเดียว</div>`}
      <div class="row"><div class="grow"><div class="t">ครูที่ยังไม่มีตารางสอน ${chip(none.length, none.length ? 'warn' : 'ok')}</div><div class="muted small">${none.length ? none.slice(0, 12).map(u => esc(u.name)).join(' · ') + (none.length > 12 ? ' และอีก ' + (none.length - 12) + ' คน' : '') : 'ครบทุกคน'}</div></div></div></div>
    <div class="card"><h2>คาบเข้าแถว / โฮมรูม</h2>
      <div class="muted small">ไม่ต้องสร้างคาบเอง — ครูที่ปรึกษาทุกคนเห็นคาบ “เข้าแถว” ของห้องตัวเองทุกวันจันทร์–ศุกร์ในหน้าเช็กชื่ออัตโนมัติ ห้องที่มีที่ปรึกษา 2 คนใช้คาบเดียวกัน ใครเช็กก่อนก็ได้ · คาบนี้ไม่นับเป็นคาบสอน</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">${chip('ห้องที่มีที่ปรึกษา ' + S.rooms.filter(r => hrOf(r.id).length).length, 'ok')}${chip('ยังไม่มี ' + S.rooms.filter(r => !hrOf(r.id).length).length, 'warn')}${chip('คาบเข้าแถว/สัปดาห์ ' + S.rooms.filter(r => hrOf(r.id).length).length * 5, 'info')}</div>
      <button class="btn sm" data-ad="sec" data-s="people">จัดครูที่ปรึกษา</button></div>
  </div>
  <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">นำเข้าตารางสอนหลายครูจาก Excel / CSV</h2><div class="muted small">รองรับไฟล์ตารางสอนที่มีชีต “ตารางสอน” และชีต “รวมทุกคาบทั้งหมด” (นำเข้าทั้งคาบสอน คาบประชุม กิจกรรม และคาบเสริมให้อัตโนมัติ)</div></div>
      <button class="btn sm" data-ad="tplTT">${ic('down')}ดาวน์โหลดแม่แบบ</button><button class="btn sm pri" data-ad="pick" data-f="ad-file-tt">${ic('up')}เลือกไฟล์ตารางสอน</button><input type="file" id="ad-file-tt" data-adfile="tt" accept=".xlsx,.xls,.csv,.txt" hidden></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${['1. เตรียมรายชื่อครูและห้อง', '2. เลือกไฟล์ตารางสอน (.xlsx/.csv)', '3. ตรวจตัวอย่างคาบสอนและคาบประชุม', '4. นำเข้า'].map((s, i) => chip(s, i === 3 ? 'ok' : '')).join('<span class="muted">›</span>')}</div>
    <div class="muted small" style="margin-top:8px">คอลัมน์: ครูผู้สอน · วัน (จันทร์–ศุกร์ หรือ 1–5) · คาบ · ห้อง · รหัสวิชา · ชื่อวิชา — หากไฟล์มีชีต “รวมทุกคาบทั้งหมด” ระบบจะดึงคาบประชุม กิจกรรม และคาบเสริมมารวมให้ด้วย</div></div>`;
}
/* ---------- แอปจัดตารางสอน (ems/timetable/ — สร้างจาก D:\KruSpace\timetable-studio ด้วย build --ems) ----------
   แอปจัดตารางหนัก (~170 KB ลากวาง/จัดอัตโนมัติ) จึงเป็นหน้าแยก โหลดเฉพาะฝ่ายวิชาการที่เปิดใช้ แต่อยู่โดเมนเดียวกัน
   ส่งตารางไป–กลับผ่าน localStorage (ems-tt-to-studio / ems-tt-from-studio) เป็นแถวรูปแบบไฟล์ “พร้อมนำเข้า”
   ขากลับเข้าผ่าน ttImportPreview ตัวเดียวกับการนำเข้า Excel จึงตรวจครูสอนซ้อน/ห้องซ้อน/ชื่อไม่รู้จักเหมือนกันทุกทาง
   ตอนต่อ Firebase (ข้อ 5) ช่องทางนี้เปลี่ยนเป็นเอกสาร timetable/{ภาค} ที่ทั้งสองแอปอ่าน–เขียน */
const TT_IN = 'ems-tt-to-studio', TT_OUT = 'ems-tt-from-studio';
const lsJson = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
/* ตำแหน่งว่าง (ครูชื่อชั่วคราว "รอครู …") — ใช้ร่วมทั้งตรวจตัวอย่างและนำเข้า */
const ttVacMap = () => { const vac = {}; ((lsJson(TT_OUT) || {}).vacant || []).forEach(v => { vac[norm(v.name)] = v; }); return vac; };
const ttIsVac = (n, vac) => !!(vac || ttVacMap())[norm(n)] || /^(รอครู|ครูรอ|รอบรรจุ|ตำแหน่งว่าง)/.test(String(n).trim());
const studioHand = () => { const h = lsJson(TT_OUT); return h && h.rows && h.rows.length > 1 && h.at !== (S.adm.ttHandAt || '') ? h : null; };
function studioCard() {
  const h = studioHand(), when = x => new Date(x).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  return `<div class="card"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:8px"><div class="ico">${ic('cal')}</div>
      <div class="grow"><div class="t">แอปจัดตารางสอน</div><div class="muted small">ลากวาง ตรวจชน จัดอัตโนมัติ พิมพ์ — เปิดในแท็บใหม่ แล้วกด “ส่งเข้า EMS” เพื่อนำกลับมาตรวจที่นี่</div></div>
      <button class="btn sm" data-ad="ttToStudio" title="ส่งตารางสอนทั้งโรงเรียนและรายชื่อครูในระบบตอนนี้ไปให้แอปจัด">${ic('up')}ส่งตาราง/รายชื่อครูให้แอปจัด</button>
      <a class="btn sm pri" href="timetable/index.html" target="ems-timetable" rel="noopener">${ic('cal')}เปิดแอปจัดตารางสอน</a></div>
    ${h ? `<div class="notice" style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="grow"><b>มีตารางใหม่จากแอปจัดตาราง ${h.rows.length - 1} คาบ</b><br><span class="small">ส่งเมื่อ ${esc(when(h.at))}${h.period && h.period.year ? ` · ปี ${esc(h.period.year)} ภาค ${esc(h.period.semester)}` : ''}${h.pool ? ` · ยังไม่ได้ลง ${h.pool} บัตร` : ''}</span></div>
      <button class="btn sm" data-ad="ttHandSkip">ไม่ใช้</button><button class="btn sm pri" data-ad="ttHandOpen">ตรวจและนำเข้า</button></div>` : ''}</div>`;
}
function ttToStudio() {
  const all = X() ? X().allEntries() : [];
  // รายชื่อครูส่งไปด้วยเสมอ (ภาคใหม่ที่ยังไม่มีตารางก็ส่งได้) — แอปจัดใช้จับคู่ชื่อครูตอนนำเข้าภาระงาน และใช้บทบาทกับเงื่อนไขจัดตาราง
  const staff = S.staff.filter(u => (u.roles || [u.role]).some(r => r !== 'support') && (u.roles || [u.role]).indexOf('vacant') < 0).map(u => ({ name: u.name, email: u.email || '', area: u.dept || '', roles: (u.roles || []).filter(r => ['teacher', 'support', 'admin'].indexOf(r) < 0).map(r => ROLES[r] || r) }));
  if (!all.length && !staff.length) return toast('ยังไม่มีตารางสอนหรือรายชื่อครูในระบบให้ส่ง');
  const em = n => ((S.staff.find(u => u.name === n) || {}).email || ''), dept = n => ((S.staff.find(u => u.name === n) || {}).dept || '');
  const rows = [['ปีการศึกษา', 'ภาคเรียน', 'อีเมลครู', 'ชื่อครู', 'เบอร์โทร', 'กลุ่มสาระ', 'วัน', 'คาบ', 'รหัสวิชา', 'ชื่อวิชา', 'ห้องเรียน', 'สถานที่', 'สอนแทน (ตำแหน่งว่าง)']];
  all.slice().sort((a, b) => a.teacher.localeCompare(b.teacher, 'th') || a.day - b.day || a.p - b.p).forEach(e => {
    const sj = String(e.subject || 'ไม่ระบุวิชา').trim(), m = sj.match(/^(\S+)\s+(.+)$/), code = m && /\d/.test(m[1]) ? m[1] : sj, name = m && /\d/.test(m[1]) ? m[2] : sj;
    rows.push([S.term.year || '', S.term.sem || '', em(e.teacher), e.teacher, '', dept(e.teacher), DAYS[e.day], String(e.p + 1), code, name, roomName(e.classId), e.room || '', e.coverFor || (e.teacher === S.me.name ? (S.ttCover || {})[e.day + '-' + e.p] || '' : '')]); });
  try { localStorage.setItem(TT_IN, JSON.stringify({ at: new Date().toISOString(), rows, staff, duties: getDuties() })); } catch (e) { return toast('ส่งไม่ได้: พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม'); }
  toast('ส่ง' + (all.length ? ' ' + all.length + ' คาบ และ' : '') + 'รายชื่อครู ' + staff.length + ' คนแล้ว — ในแอปจัดตารางกด “รับจาก EMS” / “ดึงรายชื่อครูจาก EMS”');
}
/* แอปจัดตารางกด “ส่งเข้า EMS” ระหว่างที่หน้านี้เปิดอยู่ → ขึ้นแถบแจ้งทันที */
const ttPing = () => { if ((page === 'a-settings' && S.adm.sec === 'timetable') || page === 'tt-studio') redraw(); else if (studioHand()) toast('มีตารางสอนใหม่จากแอปจัดตาราง — ไปที่ตั้งค่าโรงเรียน › ตารางสอนทั้งโรงเรียน'); };
try { new BroadcastChannel('ems').onmessage = e => { if (e.data && e.data.type === 'tt-from-studio') ttPing(); }; } catch (e) { /* ไม่มี BroadcastChannel */ }
window.addEventListener('storage', e => { if (e.key === TT_OUT) ttPing(); });

/* ---------- สร้างห้องหลายห้อง / นำเข้ารายชื่อนักเรียน (สร้างห้องให้อัตโนมัติ) ----------
   ห้องเรียนเกิดได้ 3 ทาง ไม่ต้องกรอกทีละห้อง: ① สร้างตามจำนวนห้องของแต่ละระดับ ② นำเข้ารายชื่อนักเรียน ③ นำเข้าตารางสอน
   รายชื่อนักเรียน: รองรับไฟล์ส่งออกจาก DMC/SGS (เลขประจำตัว ชั้น ห้อง เลขที่ คำนำหน้า ชื่อ นามสกุล) หรือคอลัมน์ “ห้อง” แบบ ม.1/3
   ใช้เลขประจำตัวเป็นรหัสนักเรียน → นำเข้าซ้ำ/ย้ายห้อง คะแนนและการเช็กชื่อเดิมยังผูกกับคนเดิม */
const roomNorm = (lv, rm) => { const L = String(lv || '').replace(/มัธยมศึกษาปีที่|ม\.|\s/g, '').replace(/^ม/, ''), R = String(rm || '').replace(/\s/g, '') || String(lv || '').replace(/\s/g, '');     /* ไม่มีคอลัมน์ห้อง: ชั้นอาจเป็น ม.1/3 ทั้งก้อน */
  if (/^ม?\.?\d+\/\d+$/.test(R.replace(/^ม\.?/, ''))) return 'ม.' + R.replace(/^ม\.?/, '');
  return /^\d+$/.test(L) && /^\d+$/.test(R) ? 'ม.' + num(L) + '/' + num(R) : ''; };
const stuImpBtn = () => `<button class="btn pri" data-ad="pick" data-f="ad-file-stu">${ic('up')}นำเข้ารายชื่อนักเรียน</button><input type="file" id="ad-file-stu" data-adfile="stu" accept=".xlsx,.xls,.csv,.txt" hidden>`;
function roomBulkModal() {
  const cnt = l => S.rooms.filter(r => new RegExp('^ม\\.' + l + '/').test(r.name)).length;
  modal(`<h2 style="margin-bottom:6px">สร้างห้องเรียนหลายห้อง</h2><p class="muted small">ใส่จำนวนห้องของแต่ละระดับ ระบบสร้างห้อง ม.1/1 ถึง ม.1/จำนวนนั้นให้ — ห้องที่มีอยู่แล้วไม่ถูกแตะ</p>
    <div class="grid g3">${[1, 2, 3, 4, 5, 6].map(l => `<div class="field"><label class="f" for="rb-${l}">ม.${l} <span class="muted small">(มีแล้ว ${cnt(l)})</span></label><input class="in" id="rb-${l}" type="number" min="0" max="30" value="${cnt(l) || ''}" placeholder="0"></div>`).join('')}</div>
    <button class="btn pri" style="width:100%;margin-top:10px" data-ad="roomBulkOk">สร้างห้อง</button>`, true);
}
function roomBulkApply() {
  let add = 0;
  [1, 2, 3, 4, 5, 6].forEach(l => { const n = Math.min(30, num(($('#rb-' + l) || {}).value)); for (let r = 1; r <= n; r++) { const nm = 'ม.' + l + '/' + r; if (!roomByName(nm)) { S.rooms.push({ id: 'r' + l + '-' + r, name: nm, count: 0 }); add++; } } });
  save(); closeModal(); toast(add ? 'สร้างห้องใหม่ ' + add + ' ห้อง' : 'ไม่มีห้องใหม่ — ห้องตามจำนวนนี้มีครบแล้ว'); redraw();
}
let IMP_STU = null;
/* ดูภาคของปีก่อน = ห้องในหน้าจอเป็นรายชื่อปีเก่า → ห้ามนำเข้า (ไม่ถูกบันทึกเป็นรายชื่อจริง และห้องใหม่จะไปเพิ่มใน S.rooms ปัจจุบัน) */
const impPastYear = () => { const v = S.viewTerm, c = S.term || {}; return v && v.year && c.year && +v.year < +c.year ? String(v.year) : ''; };
/* อ่านหนึ่งชีต — ไม่เก็บเลขบัตรประชาชน/ที่อยู่/เบอร์ผู้ปกครอง (ข้อมูลส่วนบุคคลที่ EMS ไม่ต้องใช้) */
function stuParseSheet(rows, sheet, ctx) {
  const hi = rows.findIndex(r => r.some(x => /ชื่อ/.test(x)) && r.some(x => /ห้อง|ชั้น/.test(x))); if (hi < 0) return false;
  const h = rows[hi].map(x => String(x).replace(/\s/g, '')), at = re => h.findIndex(x => re.test(x));
  const ci = { sid: at(/เลขประจำตัว|รหัสนักเรียน|^รหัส$|studentid|^id$/i), lv: at(/^ชั้น|ระดับชั้น/), rm: at(/^ห้อง/), no: at(/^เลขที่/), pre: at(/คำนำหน้า/),
    first: at(/^ชื่อ$|^ชื่อนักเรียน$|firstname/i), last: at(/^นามสกุล$|^สกุล$|lastname/i), full: at(/ชื่อ-?สกุล|ชื่อ-นามสกุล|ชื่อและนามสกุล/),
    sex: at(/^เพศ$|gender/i), st: at(/^สถานะ/) };
  if (ci.first < 0 && ci.full < 0) ci.full = at(/ชื่อ/);
  if (ci.sid < 0) ctx.noSidCol = true;
  const L = n => (ctx.multi ? sheet + ' ' : '') + 'แถว ' + n;
  rows.slice(hi + 1).forEach((r, k) => { const line = hi + k + 2, g = i => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '';
    const name = ci.full >= 0 ? g(ci.full) : [g(ci.pre), g(ci.first)].join('') + (g(ci.last) ? ' ' + g(ci.last) : '');
    if (!name.trim()) return;
    const st = g(ci.st); if (st && !/กำลังศึกษา|ปกติ|เรียนอยู่|active/i.test(st)) { ctx.skipped[st] = (ctx.skipped[st] || 0) + 1; return; }
    const room = roomNorm(g(ci.lv), g(ci.rm)), sid = g(ci.sid).replace(/\s/g, '').replace(/\.0$/, '');
    if (!room) return ctx.errs.push(`${L(line)}: อ่านห้องไม่ได้ (ชั้น “${g(ci.lv)}” ห้อง “${g(ci.rm)}”)`);
    if (sid && ctx.seen[sid]) return ctx.errs.push(`${L(line)}: เลขประจำตัว ${sid} ซ้ำกับ${ctx.seen[sid]}`);
    if (sid) ctx.seen[sid] = L(line);
    if (!roomByName(room)) ctx.newRooms.add(room);
    const sx = g(ci.sex);
    ctx.items.push({ line: L(line), sid, name: name.replace(/\s+/g, ' ').trim(), room, no: num(g(ci.no)), sex: /หญิง|^f/i.test(sx) ? 'F' : /ชาย|^m/i.test(sx) ? 'M' : '' }); });
  return true;
}
function stuImportPreview(sheets) {
  if (impPastYear()) return toast('กำลังดูภาคของปีการศึกษา ' + impPastYear() + ' — กลับภาคปัจจุบันก่อนนำเข้ารายชื่อ');
  const ctx = { items: [], errs: [], seen: {}, newRooms: new Set(), skipped: {}, multi: sheets.length > 1, noSidCol: false };
  const used = sheets.filter(x => stuParseSheet(x.rows, x.name, ctx));
  if (!used.length) return toast('ไม่พบหัวคอลัมน์ “ชื่อ” และ “ห้อง/ชั้น” ในไฟล์');
  const { items, errs, newRooms } = ctx, warns = [];
  const skippedN = Object.values(ctx.skipped).reduce((a, b) => a + b, 0);
  if (skippedN) warns.push(`ข้าม ${skippedN} คนที่สถานะไม่ใช่กำลังศึกษา (${Object.entries(ctx.skipped).map(([k, v]) => k + ' ' + v).join(', ')})`);
  if (ctx.multi) warns.push(`อ่าน ${used.length} ชีต: ${used.map(x => x.name).join(', ')}`);
  const noSid = items.filter(x => !x.sid).length;
  if (ctx.noSidCol && noSid === items.length) warns.push('ไม่มีคอลัมน์เลขประจำตัว — นักเรียนจะเข้าสู่ระบบด้วยบัญชีโรงเรียน และเครื่องสแกนหน้าจับคู่ไม่ได้ ควรใช้ไฟล์ที่มีเลขประจำตัว');
  else if (noSid) warns.push(`นักเรียน ${noSid} คนไม่มีเลขประจำตัว`);
  if (newRooms.size) warns.push(`จะสร้างห้องใหม่ ${newRooms.size} ห้อง: ${[...newRooms].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })).join(', ')}`);
  /* คนที่ย้ายห้อง (เทียบเลขประจำตัวกับรายชื่อเดิม) */
  const where = {}; S.classes.forEach(c => { if (window.EMSPlans && EMSPlans.isSub && EMSPlans.isSub(c.id)) return;      /* ห้องย่อยตามแผน = คนเดียวกับห้องหลัก ไม่ใช่การย้ายห้อง */
    c.students.forEach(st => { if (st.sid || st.id) where[String(st.sid || st.id)] = c.name; }); });
  const moved = items.filter(x => x.sid && where[x.sid] && where[x.sid] !== x.room);
  if (moved.length) warns.push(`ย้ายห้อง ${moved.length} คน เช่น ${moved.slice(0, 3).map(x => x.name + ' ' + where[x.sid] + ' → ' + x.room).join(', ')}`);
  /* คนที่บันทึกว่าออกแล้ว (stuleft.js) แต่ยังอยู่ในไฟล์ → จะกลับเข้าห้องโดยไม่มีบันทึกคืนสถานะ */
  const slReady = !LIVE || !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready.stuLeft), gone = {};
  (Array.isArray(S.stuLeft) ? S.stuLeft : []).forEach(r => { if (r && r.status === 'left' && r.sid) gone[String(r.sid)] = r; });
  const back = items.filter(x => x.sid && gone[x.sid]);
  if (back.length) warns.push(`มี ${back.length} คนที่บันทึกว่าออกแล้ว แต่อยู่ในไฟล์นี้ เช่น ${back.slice(0, 3).map(x => x.name + ' (' + gone[x.sid].reason + ' ' + gone[x.sid].date + ')').join(', ')} — นำเข้าแล้วจะกลับเข้าห้อง ควรลบออกจากไฟล์ หรือคืนสถานะที่หน้าฐานนักเรียน`);
  else if (!slReady) warns.push('ยังไม่ได้โหลดประวัตินักเรียนที่ออก — ตรวจไม่ได้ว่ามีคนที่ออกแล้วอยู่ในไฟล์หรือไม่ (รอสักครู่แล้วเลือกไฟล์ใหม่อีกครั้ง)');
  const roomsN = new Set(items.map(x => x.room)).size;
  IMP_STU = { items, newRooms: [...newRooms] };
  modal(`<h2 style="margin-bottom:8px">ตรวจรายชื่อนักเรียนก่อนนำเข้า</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chip(items.length + ' คน', 'info')}${chip(roomsN + ' ห้อง', 'info')}${chip('ข้อผิดพลาด ' + errs.length, errs.length ? 'bad' : 'ok')}${chip('ข้อควรระวัง ' + warns.length, warns.length ? 'warn' : 'ok')}</div>
    ${errs.length ? `<div class="notice bad"><b>ต้องแก้ในไฟล์ก่อน</b><br>${errs.slice(0, 12).map(esc).join('<br>')}${errs.length > 12 ? '<br>… และอีก ' + (errs.length - 12) + ' รายการ' : ''}</div>` : ''}
    ${warns.length ? `<div class="notice">${warns.map(esc).join('<br>')}</div>` : ''}
    <div class="scroll" style="max-height:40vh"><table class="tbl"><thead><tr><th>แถว</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>ห้อง</th><th>เลขที่</th></tr></thead><tbody>${items.slice(0, 60).map(x => `<tr><td>${x.line}</td><td>${esc(x.sid) || '<span class="muted">—</span>'}</td><td>${esc(x.name)}</td><td>${esc(x.room)}</td><td>${x.no || ''}</td></tr>`).join('')}</tbody></table></div>
    ${items.length > 60 ? `<div class="muted small">แสดง 60 จาก ${items.length} คน</div>` : ''}
    <div class="muted small" style="margin-top:8px">ห้องที่อยู่ในไฟล์จะใช้รายชื่อตามไฟล์ทั้งห้อง (แทนรายชื่อเดิมของห้องนั้น) · ห้องที่ไม่อยู่ในไฟล์ไม่ถูกแตะ</div>
    <button class="btn pri" style="width:100%;margin-top:12px" data-ad="stuImpOk" ${errs.length || !items.length ? 'disabled' : ''}>${errs.length ? 'แก้ข้อผิดพลาดในไฟล์ก่อนนำเข้า' : `นำเข้า ${items.length} คน · ${roomsN} ห้อง`}</button>`);
  wide(860);
}
async function stuSheets(f) {
  if (!/\.xlsx?$/i.test(f.name)) return [{ name: f.name, rows: await readRows(f) }];
  await loadXlsx(); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
  return wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }).map(r => r.map(v => String(v).trim())).filter(r => r.some(Boolean)) }));
}
async function stuImportApply() {
  const I = IMP_STU; if (!I) return;
  if (impPastYear()) { IMP_STU = null; closeModal(); return toast('กำลังดูภาคของปีการศึกษา ' + impPastYear() + ' — กลับภาคปัจจุบันก่อนนำเข้ารายชื่อ'); }
  const rn = new Set(I.items.map(x => x.room)), why = window.EMSAudit ? await EMSAudit.batch('นำเข้ารายชื่อนักเรียน · ' + rn.size + ' ห้อง', I.items.length + ' คน · ใช้รายชื่อตามไฟล์ทั้งห้อง: ' + [...rn].slice(0, 12).join(', ') + (rn.size > 12 ? ' …' : ''), 'นำเข้ารายชื่อนักเรียน') : () => {};
  if (!why) return; if (IMP_STU !== I) return toast('ข้อมูลนำเข้าเปลี่ยนระหว่างรอ ลองใหม่');      // ถามเหตุผลครั้งเดียวต่อการนำเข้า · หลังรอ อ่านรายชื่อจาก S ปัจจุบัน
  if (impPastYear()) { IMP_STU = null; return toast('กำลังดูภาคของปีการศึกษา ' + impPastYear() + ' — กลับภาคปัจจุบันก่อนนำเข้ารายชื่อ'); }
  const before = [...rn].map(n => { const r = roomByName(n), c = r && cls(r.id); return n + ' ' + (c ? c.students.length : 0); }).join(', ');
  I.newRooms.forEach(n => { if (!roomByName(n)) { const m = n.match(/^ม\.(\d+)\/(\d+)$/); S.rooms.push({ id: m && !S.rooms.some(r => r.id === 'r' + m[1] + '-' + m[2]) ? 'r' + m[1] + '-' + m[2] : uid('r'), name: n, count: 0 }); } });
  const old = {}; S.classes.forEach(c => c.students.forEach(st => { old[c.id + '|' + norm(st.name)] = st; }));
  const byRoom = {}; I.items.forEach(x => { (byRoom[x.room] = byRoom[x.room] || []).push(x); });
  Object.keys(byRoom).forEach(rn => { const room = roomByName(rn); let c = cls(room.id);
    if (!c) { c = { id: room.id, name: room.name, subject: '', students: [] }; S.classes.push(c); }
    const list = byRoom[rn].slice().sort((a, b) => (a.no || 999) - (b.no || 999) || a.name.localeCompare(b.name, 'th'));
    c.students = list.map((x, i) => { const prev = !x.sid && old[room.id + '|' + norm(x.name)];
      return Object.assign({}, prev || {}, { id: x.sid || (prev && prev.id) || uid('s'), sid: x.sid || (prev && prev.sid) || '', no: x.no || i + 1, name: x.name }, x.sex ? { sex: x.sex } : {}); });
    room.count = c.students.length; });
  IMP_STU = null; save(); why(before, [...rn].map(n => n + ' ' + (byRoom[n] || []).length).join(', ')); closeModal(); toast('นำเข้านักเรียน ' + I.items.length + ' คน แล้ว'); redraw();
}

/* ---------- นำเข้าตารางสอน ---------- */
let IMP_TT = null;
const dayParse = s => { const x = String(s || '').trim().replace(/\.$/, '').toLowerCase(); if (!x) return -1;
  if (/^[1-5]$/.test(x)) return num(x) - 1;
  const en = ['mon', 'tue', 'wed', 'thu', 'fri'].findIndex(k => x.indexOf(k) === 0); if (en >= 0) return en;
  if (x.indexOf('พฤ') === 0) return 3;
  const full = DAYS.findIndex(d => x.indexOf(d) >= 0 || d.indexOf(x) === 0); if (full >= 0) return full;
  return { 'จ': 0, 'อ': 1, 'พ': 2, 'ศ': 4 }[x.charAt(0)] != null ? { 'จ': 0, 'อ': 1, 'พ': 2, 'ศ': 4 }[x.charAt(0)] : -1; };
const periodParse = s => {
  const x = String(s || '').trim();
  if (/^(เสริม|คาบเสริม)$/i.test(x)) return [Math.min(8, PERIODS.length - 1)];
  const m = x.match(/(\d+)\s*(?:[-–ถึง]+\s*(\d+))?/); if (!m) return [];
  const a = num(m[1]), b = m[2] ? num(m[2]) : a, out = []; for (let p = a; p <= b && p <= PERIODS.length; p++) if (p >= 1) out.push(p - 1); return out;
};
function parseAllPeriodsRows(rows) {
  if (!rows || !rows.length) return null;
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const r = (rows[i] || []).map(x => String(x || '').trim());
    if (r.some(c => /ชื่อครู|ครูผู้สอน/.test(c)) && r.some(c => /^คาบ$/.test(c))) { hi = i; break; }
  }
  if (hi < 0) return null;
  const h = rows[hi].map(x => String(x || '').trim());
  const col = re => h.findIndex(x => re.test(x));
  const ix = {
    name: col(/ชื่อครู|ครูผู้สอน/), area: col(/กลุ่มสาระ/),
    day: col(/^วัน$/), slot: col(/^คาบ$/), scode: col(/รหัสวิชา|กิจกรรม/),
    sname: col(/ชื่อวิชา/), cls: col(/ชั้นเรียน|รายละเอียด/), room: col(/ห้องเรียน|สถานที่/),
    kind: col(/ประเภทคาบ/)
  };
  if (ix.name < 0 || ix.day < 0 || ix.slot < 0) return null;
  const byName = {}; S.staff.forEach(u => { byName[norm(u.name)] = u.name; });
  const canonT = n => { const s = String(n || '').replace(/\s+/g, ' ').trim(); return byName[norm(s)] || s; };

  const meetCells = {}, actBuckets = {}, extras = [], teachingRows = [['ชื่อครู', 'กลุ่มสาระ', 'วัน', 'คาบ', 'รหัสวิชา', 'ชื่อวิชา', 'ห้องเรียน', 'สถานที่']];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || !r.length) continue;
    const tName = canonT(r[ix.name]);
    const area = ix.area >= 0 ? String(r[ix.area] || '').trim() : '';
    const d = dayParse(r[ix.day]), ps = periodParse(r[ix.slot]);
    const scode = ix.scode >= 0 ? String(r[ix.scode] || '').trim() : '';
    const sname = ix.sname >= 0 ? String(r[ix.sname] || '').trim() : '';
    const clsRaw = ix.cls >= 0 ? String(r[ix.cls] || '').trim() : '';
    const room = ix.room >= 0 ? String(r[ix.room] || '').trim() : '';
    const kind = ix.kind >= 0 ? String(r[ix.kind] || '').trim() : '';
    if (!tName || d < 0 || !ps.length) continue;
    const p = ps[0];

    const isMeeting = scode === 'ประชุม' || /^ประชุม/.test(sname) || /^ประชุม/.test(room);
    const isExtra = /^(เสริม|คาบเสริม)$/i.test(String(r[ix.slot] || '').trim()) || /คาบเสริม/.test(kind) || scode === 'เสริม';
    const isActKind = /กิจกรรม|ประชุม/.test(kind);
    const isClassCode = /^ม\.?\d+\/\d+/.test(clsRaw.replace(/\s+/g, ''));

    if (isMeeting) {
      ps.forEach(sp => {
        const key = d + '|' + sp;
        if (!meetCells[key]) meetCells[key] = { day: d, slot: sp, names: {}, teachers: new Set() };
        const label = ('ประชุม' + [sname, clsRaw, room].filter(Boolean).join('')).replace(/^ประชุมประชุม/, 'ประชุม');
        if (label && label !== 'ประชุม') meetCells[key].names[label] = (meetCells[key].names[label] || 0) + 1;
        meetCells[key].teachers.add(tName);
      });
    } else if (isExtra && isClassCode) {
      extras.push({
        id: 'ex_' + (extras.length + 1),
        day: d, slot: p,
        teacher: tName,
        subjectCode: scode || 'เสริม',
        subject: sname || scode || 'คาบเสริม',
        className: clsRaw.replace(/\s+/g, ''),
        room: room
      });
    } else if (isActKind || (isExtra && !isClassCode)) {
      let actName = '';
      if (scode === 'โฮมรูม') actName = 'โฮมรูม อบรมคุณธรรม';
      else if (scode === 'PLC') actName = 'PLC กลุ่มสาระ';
      else if (scode === 'บูรณาการ') actName = 'บูรณาการ สวนพฤกษ์ เศรษฐกิจฯ';
      else if (/ชุมนุม/.test(clsRaw + room)) actName = 'กิจกรรม ชุมนุม/นศท.';
      else if (/คณะสี/.test(clsRaw + room)) actName = 'กิจกรรม ส่งเสริมฯ คณะสี';
      else actName = [scode, sname, clsRaw, room].filter(Boolean).join(' ').trim() || 'กิจกรรม';
      const bKey = d + '|' + p + '|' + actName;
      if (!actBuckets[bKey]) actBuckets[bKey] = { id: 'act_' + (Object.keys(actBuckets).length + 1), name: actName, code: scode || 'กิจกรรม', day: d, slot: p, room: '', teachers: [] };
      if (actBuckets[bKey].teachers.indexOf(tName) < 0) actBuckets[bKey].teachers.push(tName);
    } else if (isClassCode) {
      expandRoomStr(clsRaw).forEach(rn => {
        teachingRows.push([tName, area, DAYS[d], String(p + 1), scode, sname, rn, room]);
      });
    }
  }

  const byDay = {};
  Object.values(meetCells).forEach(mc => {
    mc.title = Object.keys(mc.names).sort((a, b) => mc.names[b] - mc.names[a])[0] || 'ประชุม';
    (byDay[mc.day] = byDay[mc.day] || []).push(mc);
  });
  const meetings = [];
  Object.keys(byDay).sort((a, b) => a - b).forEach(d => {
    const list = byDay[d].sort((a, b) => a.slot - b.slot), merged = [];
    list.forEach(mc => {
      const prev = merged[merged.length - 1];
      if (prev && (prev.slot + prev.span === mc.slot) && (prev.title === mc.title || mc.title === 'ประชุม' || prev.title === 'ประชุม')) {
        if (prev.title === 'ประชุม' && mc.title !== 'ประชุม') prev.title = mc.title;
        prev.span += 1;
        mc.teachers.forEach(t => prev.teachers.add(t));
      } else {
        merged.push({ day: +d, slot: mc.slot, span: 1, title: mc.title, teachers: new Set(mc.teachers) });
      }
    });
    merged.forEach(mg => {
      meetings.push({
        id: 'mtg_' + (meetings.length + 1),
        name: mg.title,
        day: mg.day,
        slot: mg.slot,
        span: mg.span,
        room: mg.title,
        roles: [mg.title],
        teachers: [...mg.teachers].sort((a, b) => a.localeCompare(b, 'th'))
      });
    });
  });
  const activities = Object.values(actBuckets).sort((a, b) => a.day - b.day || a.slot - b.slot || a.name.localeCompare(b.name, 'th'));
  return { meetings, activities, extras, teachingRows };
}
async function readTtFile(f) {
  if (!/\.xlsx?$/i.test(f.name)) return { rows: await readRows(f), duties: null };
  await loadXlsx();
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
  const sheetRows = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }).map(r => r.map(v => String(v).trim())).filter(r => r.some(Boolean));
  const mainName = wb.SheetNames.find(x => /ตารางสอน/.test(x) && !/ตัวอย่าง/.test(x)) || wb.SheetNames[0];
  const allPeriodsName = wb.SheetNames.find(x => /รวมทุกคาบ/.test(x));
  let rows = sheetRows(mainName), duties = null;
  if (allPeriodsName) {
    const parsed = parseAllPeriodsRows(sheetRows(allPeriodsName));
    if (parsed && (parsed.meetings.length || parsed.activities.length || parsed.extras.length)) {
      duties = { meetings: parsed.meetings, activities: parsed.activities, extras: parsed.extras };
    }
    if (mainName === allPeriodsName && parsed && parsed.teachingRows.length > 1) {
      rows = parsed.teachingRows;
    }
  }
  return { rows, duties };
}
let IMP_TT_ROWS = null, IMP_TT_DUTIES = null, IMP_TT_ADD = false, IMP_TT_FILETERM = null, IMP_TT_MAP = {};      // IMP_TT_MAP: ชื่อในไฟล์ → ชื่อบุคลากรที่ผู้ใช้จับคู่เอง      // ครูที่ไม่มีในรายชื่อบุคลากร: ค่าตั้งต้น = ข้าม (เช่น ครูเกษียณ)
function ttImportPreview(rows, duties) {
  if (rows !== IMP_TT_ROWS) { IMP_TT_ROWS = rows; IMP_TT_DUTIES = duties || null; IMP_TT_ADD = false; IMP_TT_MAP = {}; }
  else if (duties !== undefined) IMP_TT_DUTIES = duties;
  const dt = IMP_TT_DUTIES;
  const hi = rows.findIndex(r => colIdx(r, ['ครู', 'teacher']) >= 0 && colIdx(r, ['วัน', 'day']) >= 0); if (hi < 0 && !dt) return toast('ไม่พบหัวคอลัมน์ “ครูผู้สอน” และ “วัน” ในไฟล์');
  const h = hi >= 0 ? rows[hi] : [], tExact = colIdx(h, ['ชื่อครู', 'ครูผู้สอน', 'teacher']);
  const ci = { t: tExact >= 0 ? tExact : h.findIndex(x => /ครู/.test(String(x)) && !/อีเมล|mail|เบอร์|โทร/i.test(String(x))), d: colIdx(h, ['วัน', 'day']), p: colIdx(h, ['คาบ', 'period']), r: colIdx(h, ['ห้อง', 'ชั้น', 'room', 'class']), c: colIdx(h, ['รหัส', 'code']), n: colIdx(h, ['ชื่อวิชา', 'รายวิชา', 'subject']) >= 0 ? colIdx(h, ['ชื่อวิชา', 'รายวิชา', 'subject']) : colIdx(h, ['วิชา']) };
  ci.e = colIdx(h, ['อีเมล', 'email']); ci.y = colIdx(h, ['ปีการศึกษา']); ci.s = colIdx(h, ['ภาคเรียน']); ci.cv = colIdx(h, ['สอนแทน']); ci.lo = colIdx(h, ['สถานที่', 'location']);
  const byMail = {}, byName = {}; S.staff.forEach(u => { if (u.email) byMail[String(u.email).toLowerCase()] = u; byName[norm(u.name)] = u; });
  const first = hi >= 0 ? (rows.slice(hi + 1).find(r => r.some(Boolean)) || []) : [], fileTerm = ci.y >= 0 && ci.s >= 0 && first[ci.y] ? { year: String(first[ci.y]).trim(), sem: String(first[ci.s]).trim() } : null;
  const items = [], errs = [], warns = [], newRooms = new Set(), newTeachers = new Set(), skipped = {}, vac = ttVacMap(), newVac = new Set();
  if (hi >= 0) rows.slice(hi + 1).forEach((r, k) => { const line = hi + k + 2, t = String(r[ci.t] || '').trim(); if (!t && !r.some(Boolean)) return;
    if (!t) return errs.push(`แถว ${line}: ไม่มีชื่อครู`);
    const d = dayParse(r[ci.d]), ps = periodParse(r[ci.p]); if (d < 0) return errs.push(`แถว ${line}: วัน “${r[ci.d] || ''}” ไม่ถูกต้อง`);
    if (!ps.length) return errs.push(`แถว ${line}: คาบ “${r[ci.p] || ''}” ไม่ถูกต้อง`);
    const rn = String(r[ci.r] || '').trim(); if (!rn) return errs.push(`แถว ${line}: ไม่มีห้องเรียน`);
    const room = roomByName(rn); if (!room) newRooms.add(rn.replace(/\s/g, '').replace(/^ม\.?/, 'ม.'));
    const em = ci.e >= 0 ? String(r[ci.e] || '').trim().toLowerCase() : '', staff = (em && byMail[em]) || byName[norm(t)] || (IMP_TT_MAP[t] && S.staff.find(u => u.name === IMP_TT_MAP[t]));
    if (!staff) { if (ttIsVac(t, vac)) newVac.add(t); else if (!IMP_TT_ADD) { skipped[t] = (skipped[t] || 0) + periodParse(r[ci.p]).length; return; } newTeachers.add(t); }   // ตำแหน่งว่างเข้าเสมอ ไม่ต้องกดเพิ่มทุกคน
    const code = ci.c >= 0 ? String(r[ci.c] || '').trim() : '', nm = ci.n >= 0 && ci.n !== ci.c ? String(r[ci.n] || '').trim() : '';
    ps.forEach(p => items.push({ line, teacher: staff ? staff.name : t, day: d, p, room: room ? room.name : rn.replace(/\s/g, '').replace(/^ม\.?/, 'ม.'), subject: (code + ' ' + nm).trim() || 'ไม่ระบุวิชา', coverFor: ci.cv >= 0 ? String(r[ci.cv] || '').trim() : '', loc: ci.lo >= 0 ? String(r[ci.lo] || '').trim() : '' })); });
  const tk = {}, rk = {}; items.forEach(x => { const a = x.teacher + '|' + x.day + '|' + x.p, b = x.room + '|' + x.day + '|' + x.p;
    if (tk[a]) warns.push(`แถว ${x.line}: ${x.teacher} สอนซ้อน วัน${DAYS[x.day]} คาบ ${x.p + 1} (ซ้ำกับแถว ${tk[a]})`); else tk[a] = x.line;
    if (rk[b] && rk[b].t !== x.teacher) warns.push(`แถว ${x.line}: ห้อง ${x.room} วัน${DAYS[x.day]} คาบ ${x.p + 1} มีครู 2 คน (${rk[b].t} / ${x.teacher})`); else rk[b] = { t: x.teacher }; });
  const inFile = new Set(items.map(x => x.teacher));
  if (X()) X().allEntries().filter(e => !inFile.has(e.teacher)).forEach(e => { const b = roomName(e.classId) + '|' + e.day + '|' + e.p; if (rk[b] && !isVacN(e.teacher)) warns.push(`ห้อง ${roomName(e.classId)} วัน${DAYS[e.day]} คาบ ${e.p + 1} ชนกับตารางเดิมของ ${e.teacher}`); });   // คาบตำแหน่งว่างที่ไฟล์ใหม่ลงห้อง/คาบเดียวกัน = กำลังถูกแทนที่ (ttImportApply ลบให้) ไม่ต้องเตือน
  newTeachers.forEach(t => { if (!newVac.has(t)) warns.push(`ครู “${t}” ยังไม่มีในรายชื่อบุคลากร — จะเพิ่มให้เป็นครูผู้สอน`); });
  const sk = Object.keys(skipped), termOff = fileTerm && (fileTerm.year !== String(S.term.year) || fileTerm.sem !== String(S.term.sem));
  IMP_TT_FILETERM = fileTerm;
  const staffOpts = S.staff.filter(u => !isVacU(u)).sort((a, b) => a.name.localeCompare(b.name, 'th')).map(u => `<option>${esc(u.name)}</option>`).join('');
  const mapped = Object.keys(IMP_TT_MAP).filter(k => IMP_TT_MAP[k]);
  if (mapped.length) warns.unshift(...mapped.map(k => `จับคู่ “${k}” = ${IMP_TT_MAP[k]}`));
  newRooms.forEach(r => warns.push(`ห้อง “${r}” ยังไม่มีในระบบ — จะเพิ่มห้องให้`));
  IMP_TT = { items, newRooms: [...newRooms], newTeachers: [...newTeachers], duties: dt };
  const teachersN = inFile.size;
  const mtgCnt = dt && dt.meetings ? dt.meetings.length : 0, actCnt = dt && dt.activities ? dt.activities.length : 0, exCnt = dt && dt.extras ? dt.extras.length : 0;
  const hasDuties = mtgCnt + actCnt + exCnt > 0;
  modal(`<h2 style="margin-bottom:8px">ตรวจตัวอย่างก่อนนำเข้าตารางสอน</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chip(items.length + ' คาบสอน', 'info')}${chip('ครู ' + teachersN + ' คน', 'info')}${hasDuties ? chip(`ประชุม ${mtgCnt} กลุ่ม · กิจกรรม ${actCnt} · คาบเสริม ${exCnt}`, 'ok') : ''}${chip('ข้อผิดพลาด ' + errs.length, errs.length ? 'bad' : 'ok')}${chip('ข้อควรระวัง ' + warns.length, warns.length ? 'warn' : 'ok')}</div>
    ${hasDuties ? `<div class="notice" style="background:var(--info-soft)">
      <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">
        <input type="checkbox" id="ad-tt-imp-duties" checked style="margin-top:3px;width:16px;height:16px">
        <div class="grow">
          <b>นำเข้าคาบประชุม กิจกรรม และคาบเสริมจากชีต “รวมทุกคาบทั้งหมด” ด้วย (ปรับแก้ได้ภายหลัง)</b>
          <div class="small" style="margin-top:4px">
            ${mtgCnt ? `<div>📌 <b>คาบประชุม ${mtgCnt} กลุ่ม:</b> ${dt.meetings.map(m => `${esc(m.name)} (วัน${DAYS[m.day]} คาบ ${m.slot + 1}${m.span > 1 ? '–' + (m.slot + m.span) : ''} · ${(m.teachers || []).length} คน)`).join(' · ')}</div>` : ''}
            ${actCnt ? `<div>🎯 <b>คาบกิจกรรม ${actCnt} รายการ:</b> ${dt.activities.slice(0, 6).map(a => `${esc(a.name)} (${DAYS[a.day]} คาบ ${a.slot + 1})`).join(' · ')}${actCnt > 6 ? ` และอีก ${actCnt - 6} รายการ` : ''}</div>` : ''}
            ${exCnt ? `<div>⚡ <b>คาบเสริมรายห้อง ${exCnt} คาบ</b></div>` : ''}
          </div>
        </div>
      </label>
    </div>` : ''}
    ${newVac.size ? `<div class="notice"><b>ตำแหน่งว่าง ${newVac.size} ตำแหน่ง</b> (${[...newVac].map(esc).join(', ')}) — จะเพิ่มเป็นบุคลากรตำแหน่งว่าง (ไม่มีบัญชี ไม่ถูกเสนอเป็นครูสอนแทน) คาบของตำแหน่งนี้สร้างเป็นคำขอสอนแทนให้หัวหน้ากลุ่มสาระฯ จัดได้</div>` : ''}
    ${termOff ? `<div class="notice bad" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="grow">ไฟล์นี้เป็นตารางของ <b>ภาคเรียนที่ ${esc(fileTerm.sem)}/${esc(fileTerm.year)}</b> แต่ระบบกำลังใช้ภาคเรียนที่ ${esc(S.term.sem)}/${esc(S.term.year)} — ถ้านำเข้าตอนนี้จะบันทึกเป็นตารางของภาคที่กำลังใช้</div><button class="btn sm pri" data-ad="ttUseFileTerm">ใช้ภาค ${esc(fileTerm.sem)}/${esc(fileTerm.year)} แล้วตรวจใหม่</button></div>` : ''}
    ${sk.length ? `<div class="notice" style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><div class="grow"><b>ข้ามครู ${sk.length} คนที่ไม่มีในรายชื่อบุคลากร</b> (${sk.reduce((a, t) => a + skipped[t], 0)} คาบ)<br><span class="small">ถ้าเป็นคนเดียวกับบุคลากรที่สะกดชื่อต่างกัน เลือก “จับคู่กับ” ได้เลย</span>
        <div style="display:grid;gap:6px;margin-top:8px">${sk.map(t => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="small" style="min-width:220px"><b>${esc(t)}</b> · ${skipped[t]} คาบ</span>
          <select class="in" style="width:auto;min-width:220px;min-height:34px" data-adf="ttMap" data-t="${esc(t)}" aria-label="จับคู่ ${esc(t)}"><option value="">— ข้าม ไม่นำเข้า —</option>${staffOpts}</select></div>`).join('')}</div></div>
        <button class="btn sm" data-ad="ttAddUnknown">เพิ่มทุกคนเป็นบุคลากรใหม่แทน</button></div>` : IMP_TT_ADD && newTeachers.size > newVac.size ? `<div class="notice"><button class="btn sm" data-ad="ttSkipUnknown">กลับไปข้ามครูที่ไม่มีในรายชื่อ</button></div>` : ''}
    ${errs.length ? `<div class="notice bad"><b>ต้องแก้ในไฟล์ก่อน</b><br>${errs.slice(0, 12).map(esc).join('<br>')}${errs.length > 12 ? '<br>… และอีก ' + (errs.length - 12) + ' รายการ' : ''}</div>` : ''}
    ${warns.length ? `<details class="notice"><summary>ข้อควรระวัง ${warns.length} รายการ (ไม่ขวางการนำเข้า)</summary>${warns.slice(0, 40).map(esc).join('<br>')}${warns.length > 40 ? '<br>… และอีก ' + (warns.length - 40) + ' รายการ' : ''}</details>` : ''}
    <div class="scroll" style="max-height:40vh"><table class="tbl"><thead><tr><th>แถว</th><th>ครู</th><th>วัน</th><th>คาบ</th><th>ห้อง</th><th>วิชา</th>${ci.lo >= 0 ? '<th>สถานที่</th>' : ''}</tr></thead><tbody>${items.slice(0, 60).map(x => `<tr><td>${x.line}</td><td>${esc(x.teacher)}</td><td>${DAYS[x.day]}</td><td>${x.p + 1}</td><td>${esc(x.room)}</td><td class="small">${esc(x.subject)}</td>${ci.lo >= 0 ? `<td class="small">${esc(x.loc)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
    ${items.length > 60 ? `<div class="muted small">แสดง 60 จาก ${items.length} คาบ</div>` : ''}
    <button class="btn pri" style="width:100%;margin-top:12px" data-ad="ttImpOk" ${errs.length || (!items.length && !hasDuties) ? 'disabled' : ''}>${errs.length ? 'แก้ข้อผิดพลาดในไฟล์ก่อนนำเข้า' : `นำเข้า ${items.length} คาบสอน${hasDuties ? ` + คาบประชุม ${mtgCnt} กลุ่ม / กิจกรรม ${actCnt} รายการ / คาบเสริม ${exCnt} คาบ` : ` แทนที่ตารางของครู ${teachersN} คน`}`}</button>`);
  wide(860);
}
function ttImportApply() {
  const I = IMP_TT; if (!I) return;
  const impDutiesChk = $('#ad-tt-imp-duties');
  const applyDuties = I.duties && (!impDutiesChk || impDutiesChk.checked);
  if (I.handAt) S.adm.ttHandAt = I.handAt;
  I.newRooms.forEach(n => { if (!roomByName(n)) S.rooms.push({ id: uid('r'), name: n, count: 0 }); });
  /* ตำแหน่งว่าง (ครูชื่อชั่วคราว "รอครู …") จากแอปจัดตาราง → บุคลากรบทบาท vacant: ไม่มีบัญชี ไม่ถูกเสนอเป็นครูสอนแทน
     คาบของตำแหน่งนี้ส่งเข้าคิวหัวหน้ากลุ่มสาระฯ จัดครูสอนแทนรายสัปดาห์ได้ (ศูนย์แลกคาบ) */
  const vac = ttVacMap(), isVac = n => ttIsVac(n, vac);
  I.newTeachers.forEach(n => { if (!S.staff.some(u => norm(u.name) === norm(n))) S.staff.push(isVac(n) ? { name: n, email: '', phone: '', role: 'vacant', roles: ['vacant'], dept: (vac[norm(n)] || {}).area || '', note: (vac[norm(n)] || {}).note || '' } : { name: n, email: '', phone: '', role: 'teacher', roles: ['teacher'], dept: '' }); });
  [...new Set(I.items.filter(x => x.coverFor).map(x => x.coverFor))].forEach(n => { if (!S.staff.some(u => norm(u.name) === norm(n))) S.staff.push({ name: n, email: '', phone: '', role: 'vacant', roles: ['vacant'], dept: (vac[norm(n)] || {}).area || '', note: (vac[norm(n)] || {}).note || '' }); });   // ตำแหน่งว่างที่มีแต่คาบที่ครูรับไว้แทน (ไม่มีแถวของตัวเองในไฟล์)
  if (I.items.length) {
    const inFile = new Set(I.items.map(x => x.teacher));
    const vacN = new Set(S.staff.filter(u => rolesOf(u).indexOf('vacant') >= 0).map(u => u.name)), slotNew = new Set(I.items.map(x => x.room + '|' + x.day + '|' + x.p));
    S.ttOthers = (S.ttOthers || []).filter(e => !inFile.has(e.teacher) && !(vacN.has(e.teacher) && slotNew.has(roomName(e.classId) + '|' + e.day + '|' + e.p)));   // คาบตำแหน่งว่างที่ไฟล์ใหม่มีครูลงห้อง/คาบเดียวกันแล้ว (รับครูจริง) = หมดไป
    if (inFile.has(S.me.name)) { S.tt = {}; S.ttCover = {}; S.ttLoc = {}; S.ttSub = {}; }
    inFile.forEach(n => { const u = S.staff.find(x => x.name === n); if (u && rolesOf(u).indexOf('teacher') < 0 && rolesOf(u).indexOf('vacant') < 0) { u.roles = rolesOf(u).filter(r => r !== 'support').concat(['teacher']); u.role = primary(u.roles); } });
    I.items.forEach(x => { const room = roomByName(x.room), cid = room ? room.id : x.room, mineC = cls(cid);
      if (x.teacher === S.me.name && mineC) { S.tt[x.day + '-' + x.p] = cid; if (x.coverFor) (S.ttCover = S.ttCover || {})[x.day + '-' + x.p] = x.coverFor; if (x.loc) (S.ttLoc = S.ttLoc || {})[x.day + '-' + x.p] = x.loc; if (x.subject) (S.ttSub = S.ttSub || {})[x.day + '-' + x.p] = x.subject; }
      else S.ttOthers.push(Object.assign({ id: uid('e'), teacher: x.teacher, classId: cid, subject: x.subject, day: x.day, p: x.p }, x.coverFor ? { coverFor: x.coverFor } : {}, x.loc ? { room: x.loc } : {})); });   // room = สถานที่/ห้องสอน (ส่งกลับแอปจัดตารางได้ครบ)
    // รับครูตัวจริงแล้ว (ตำแหน่งว่างไม่มีคาบเหลือในตารางทั้งโรงเรียน — นำเข้าบางกลุ่มสาระไม่ลบของกลุ่มอื่น) → ลบตำแหน่งและคำขอสอนแทนที่ยังไม่ได้ตอบรับ
    const left = new Set(S.ttOthers.map(e => norm(e.teacher)).concat(Object.keys(S.tt || {}).length ? [norm(S.me.name)] : []));
    const held = new Set([...left].concat(S.ttOthers.filter(e => e.coverFor).map(e => norm(e.coverFor)), Object.values(S.ttCover || {}).map(norm)));   // ตำแหน่งที่คาบทั้งหมดถูกแบ่งให้ครูรับไว้แทน ยังไม่ได้ครูจริง = ยังอยู่
    const stillVac = (r, x) => S.ttOthers.some(e => norm(e.teacher) === norm(r.requester) && e.day === x.day && e.p === x.p && e.classId === x.classId);   // คาบในคำขอยังเป็นของตำแหน่งนี้ (ไม่ถูกแบ่งให้ครูอื่นรับไว้แล้ว)
    S.xreqs = (S.xreqs || []).filter(r => !(r.vacant && r.status !== 'accepted' && !(left.has(norm(r.requester)) && (r.src || []).every(x => stillVac(r, x)))));
    S.staff = S.staff.filter(u => !((u.roles || []).indexOf('vacant') >= 0 && !held.has(norm(u.name))));
    S.staff.forEach(u => { const rs = rolesOf(u); if (rs.indexOf('vacant') >= 0 && rs.indexOf('teacher') >= 0) { u.roles = rs.filter(r => r !== 'teacher'); u.role = primary(u.roles); } });   // ข้อมูลเก่า: ตำแหน่งว่างเคยถูกเติมบทบาทครู
  }
  if (applyDuties) {
    const byName = {}; S.staff.forEach(u => { byName[norm(u.name)] = u.name; });
    const mapT = n => IMP_TT_MAP[n] || byName[norm(n)] || n;
    S.ttDuties = {
      meetings: (I.duties.meetings || []).map(m => Object.assign({}, m, { teachers: [...new Set((m.teachers || []).map(mapT))] })),
      activities: (I.duties.activities || []).map(a => Object.assign({}, a, { teachers: [...new Set((a.teachers || []).map(mapT))] })),
      extras: (I.duties.extras || []).map(ex => Object.assign({}, ex, { teacher: mapT(ex.teacher) }))
    };
  }
  IMP_TT = null; IMP_TT_DUTIES = null; save(); closeModal();
  toast('นำเข้าตารางสอน ' + I.items.length + ' คาบ' + (applyDuties ? ' พร้อมคาบประชุมและกิจกรรมแล้ว' : ' แล้ว'));
  redraw();
}
function openDutyCellModal(mode, who, d, p) {
  const all = X() ? X().allEntries() : [];
  const es = all.filter(e => e.day === d && e.p === p && (mode === 'teacher' ? e.teacher === who : e.classId === who));
  const du = mode === 'teacher' ? dutiesAt(who, d, p) : roomExtrasAt(who, d, p).map(ex => ({ kind: 'extra', idx: ex.idx, subject: ex.subject || ex.subjectCode || 'คาบเสริม', className: ex.className, room: ex.room, teacher: ex.teacher }));
  const dAll = getDuties();
  const mtgsOnDay = dAll.meetings.map((m, idx) => ({ m, idx })).filter(({ m }) => +m.day === d && p >= +m.slot && p < +m.slot + Math.max(1, +m.span || 1));
  const rooms = sortRooms(S.rooms);
  const titleWho = mode === 'teacher' ? who : roomName(who);
  modal(`<h2 style="margin-bottom:4px">แก้ไขช่องตารางสอน · ${esc(titleWho)}</h2>
    <div class="muted small" style="margin-bottom:12px">วัน${DAYS[d]} · คาบที่ ${p + 1} (${(PERIODS[p] || []).join('–') || 'คาบเสริม'})</div>
    <div class="card" style="margin-bottom:10px;background:var(--surface2)">
      <div style="font-weight:700;margin-bottom:6px">📚 คาบสอนปกติในช่องนี้ (${es.length})</div>
      ${es.length ? `<div class="list" style="margin-bottom:8px">${es.map((e, i) => `<div class="row" style="padding:6px 0">
        <div class="grow"><b>${esc(e.subject || 'ไม่ระบุวิชา')}</b> · ห้อง ${esc(roomName(e.classId))} · ครู ${esc(e.teacher)}${e.room ? ` · สถานที่ ${esc(e.room)}` : ''}</div>
        <button class="btn sm ghost" style="color:var(--bad)" data-ad="cellDelEntry" data-t="${esc(e.teacher)}" data-c="${esc(e.classId)}" data-d="${d}" data-p="${p}">ลบคาบสอน</button>
      </div>`).join('')}</div>` : `<div class="muted small" style="margin-bottom:8px">ไม่มีคาบสอนปกติในช่องนี้</div>`}
      <details><summary class="small" style="cursor:pointer;font-weight:600;color:var(--brand)">+ เพิ่ม/แทนที่คาบสอนปกติในช่องนี้</summary>
        <div class="grid g2" style="margin-top:8px;gap:8px">
          ${mode === 'teacher'
            ? `<div class="field"><label class="f">ห้องเรียน</label><select class="in" id="ad-ce-room">${rooms.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div>`
            : `<div class="field"><label class="f">ครูผู้สอน</label><input class="in" id="ad-ce-teacher" list="ad-dl-staff" placeholder="ชื่อครูผู้สอน"></div>`}
          <div class="field"><label class="f">รหัสและชื่อวิชา</label><input class="in" id="ad-ce-subj" placeholder="เช่น ว21101 วิทยาศาสตร์"></div>
          <div class="field"><label class="f">สถานที่/ห้องสอน</label><input class="in" id="ad-ce-loc" placeholder="เช่น 423"></div>
          <div class="field" style="display:flex;align-items:flex-end"><button class="btn pri" style="width:100%" data-ad="cellAddEntry" data-m="${mode}" data-w="${esc(who)}" data-d="${d}" data-p="${p}">บันทึกคาบสอน</button></div>
        </div>
      </details>
    </div>
    ${mode === 'teacher' ? `<div class="card" style="margin-bottom:10px;background:var(--info-soft)">
      <div style="font-weight:700;margin-bottom:6px">📌 คาบประชุมในเวลานี้</div>
      ${mtgsOnDay.length ? `<div style="display:grid;gap:6px;margin-bottom:8px">${mtgsOnDay.map(({ m, idx }) => {
        const inM = (m.teachers || []).some(t => sameT(t, who));
        return `<label style="display:flex;gap:8px;align-items:center;cursor:pointer">
          <input type="checkbox" data-adf="cellToggleMtg" data-i="${idx}" data-t="${esc(who)}" data-d="${d}" data-p="${p}" ${inM ? 'checked' : ''} style="width:16px;height:16px">
          <span><b>${esc(m.name)}</b> (วัน${DAYS[m.day]} คาบ ${+m.slot + 1}${m.span > 1 ? '–' + (+m.slot + m.span) : ''} · ครู ${(m.teachers || []).length} คน)</span>
        </label>`;
      }).join('')}</div>` : `<div class="muted small" style="margin-bottom:6px">ยังไม่มีกลุ่มประชุมในวัน${DAYS[d]} คาบที่ ${p + 1}</div>`}
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <input class="in" style="flex:1;min-width:180px;min-height:32px" id="ad-ce-newmtg" placeholder="ชื่อกลุ่มประชุมใหม่ในคาบนี้ เช่น ประชุมกลุ่มสาระ...">
        <button class="btn sm pri" data-ad="cellNewMtg" data-t="${esc(who)}" data-d="${d}" data-p="${p}">+ สร้างกลุ่มประชุมและเพิ่มครูคนนี้</button>
      </div>
    </div>` : ''}
    <div class="card" style="margin-bottom:0;background:var(--act-soft)">
      <div style="font-weight:700;margin-bottom:6px">🎯 กิจกรรม / ⚡ คาบเสริมในช่องนี้</div>
      ${du.filter(x => x.kind !== 'meeting').length ? `<div class="list" style="margin-bottom:8px">${du.filter(x => x.kind !== 'meeting').map(x => `<div class="row" style="padding:6px 0">
        <div class="grow"><b>${x.kind === 'extra' ? '⚡ คาบเสริม: ' + esc(x.subject) : '🎯 กิจกรรม: ' + esc(x.name)}</b>${x.className ? ` · ห้อง ${esc(x.className)}` : ''}${x.teacher ? ` · ${esc(x.teacher)}` : ''}${x.room ? ` · ${esc(x.room)}` : ''}</div>
        <button class="btn sm ghost" style="color:var(--bad)" data-ad="${x.kind === 'extra' ? 'cellDelEx' : 'cellToggleAct'}" data-i="${x.idx}" data-t="${esc(who)}" data-m="${mode}" data-d="${d}" data-p="${p}">${x.kind === 'extra' ? 'ลบคาบเสริม' : 'นำครูออกจากกิจกรรมนี้'}</button>
      </div>`).join('')}</div>` : `<div class="muted small" style="margin-bottom:8px">ไม่มีคาบเสริมหรือกิจกรรมในช่องนี้</div>`}
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input class="in" style="flex:1;min-width:140px;min-height:32px" id="ad-ce-exsubj" placeholder="ชื่อวิชาคาบเสริม / กิจกรรม">
        <input class="in" style="width:95px;min-height:32px" id="ad-ce-excls" value="${mode === 'room' ? esc(roomName(who)) : ''}" placeholder="ห้อง ม.1/1">
        ${mode === 'room' ? `<input class="in" style="width:150px;min-height:32px" id="ad-ce-extch" list="ad-dl-staff" placeholder="ชื่อครูผู้สอน">` : ''}
        <input class="in" style="width:90px;min-height:32px" id="ad-ce-exloc" placeholder="สถานที่">
        <button class="btn sm pri" data-ad="cellAddEx" data-m="${mode}" data-w="${esc(who)}" data-d="${d}" data-p="${p}">+ เพิ่มคาบเสริม</button>
      </div>
    </div>`, true);
  wide(680);
}
function openActTeachersModal(idx) {
  const d = getDuties(), a = d.activities[idx]; if (!a) return;
  const ts = (a.teachers || []).slice().sort((x, y) => x.localeCompare(y, 'th'));
  modal(`<h2 style="margin-bottom:4px">รายชื่อครูในกิจกรรม · ${esc(a.name)}</h2>
    <div class="muted small" style="margin-bottom:10px">วัน${DAYS[a.day]} · คาบที่ ${+a.slot + 1} · ${ts.length ? `กำหนดเฉพาะครู ${ts.length} คน` : 'แสดงสำหรับครูทุกคน'}</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <input class="in" style="flex:1;min-width:200px" id="ad-act-addt" list="ad-dl-staff" placeholder="+ พิมพ์ชื่อครูเพื่อเพิ่มในกิจกรรมนี้...">
      <button class="btn sm pri" data-ad="actAddT" data-i="${idx}">เพิ่มครู</button>
      <button class="btn sm" data-ad="actAllT" data-i="${idx}">ตั้งเป็นครูทุกคน (${S.staff.filter(u => !isVacU(u)).length} คน)</button>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;max-height:320px;overflow:auto;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--surface2)">
      ${ts.length ? ts.map(t => `<span class="chip">${esc(t)} <button type="button" style="border:0;background:none;cursor:pointer;padding:0 2px" data-ad="actRmT" data-i="${idx}" data-t="${esc(t)}">✕</button></span>`).join('') : '<span class="muted small">ไม่ได้จำกัดรายชื่อ (แสดงสำหรับครูทุกคน)</span>'}
    </div>`, true);
}

/* ================= ⑤ เอกสารและอัตลักษณ์ ================= */
function documents() {
  const s = S.settings, p = printCfg(), f = (id, label, v, ph) => `<div class="field"><label class="f" for="ad-${id}">${label}</label><input class="in" id="ad-${id}" data-k="${id}" value="${esc(v || '')}" placeholder="${esc(ph || '')}"></div>`;
  const heads = S.staff.filter(u => rolesOf(u).indexOf('head') >= 0);
  return `<div class="grid g2" style="align-items:start">
    <div class="card"><h2>ข้อมูลสถานศึกษา</h2>
      <div class="row" style="border:0;padding-top:0"><img src="${esc(window.EMSLogo())}" alt="ตราโรงเรียน" style="width:72px;height:72px;object-fit:contain;border:1px solid var(--line);border-radius:12px;background:#fff;padding:4px">
        <div class="grow"><div class="t">ตราโรงเรียนบนเอกสาร</div><div class="muted small">ใช้บนปก ปพ.5 ใบลา และบันทึกข้อความ · ไฟล์ PNG/JPG ไม่เกิน 1 MB</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn sm" data-ad="pick" data-f="ad-file-logo">${ic('up')}อัปโหลดตรา</button>${s.logoData ? '<button class="btn sm ghost" data-ad="logoReset">ใช้ตราเดิม</button>' : ''}</div>
          <input type="file" id="ad-file-logo" data-adfile="logo" accept="image/png,image/jpeg,image/webp" hidden></div></div>
      ${f('schoolName', 'ชื่อสถานศึกษา', s.schoolName)}${f('schoolNameEn', 'ชื่อภาษาอังกฤษ', s.schoolNameEn)}
      <div class="grid g2">${f('schoolLocation', 'จังหวัด', s.schoolLocation)}${f('educationOffice', 'สังกัด / เขตพื้นที่', s.educationOffice, 'สพม.นครราชสีมา')}</div>
      <div class="grid g2">${f('address', 'ที่อยู่', s.address)}${f('phone', 'โทรศัพท์', s.phone)}</div></div>
    <div class="card"><h2>ผู้ลงนามในเอกสาร</h2>
      ${f('headAssessmentName', 'หัวหน้างานวัดผลและประเมินผล', s.headAssessmentName)}${f('deputyName', 'รองผู้อำนวยการกลุ่มบริหารวิชาการ', s.deputyName)}
      <div class="grid g2">${f('deputyPersonnelName', 'รองฯ กลุ่มบริหารงานบุคคล', s.deputyPersonnelName)}${f('deputyGeneralName', 'รองฯ กลุ่มบริหารทั่วไป', s.deputyGeneralName)}</div>
      ${f('deputyBudgetName', 'รองฯ กลุ่มบริหารงบประมาณ', s.deputyBudgetName)}
      <div class="grid g2">${f('directorName', 'ผู้อำนวยการสถานศึกษา', s.directorName)}${f('directorPosition', 'ตำแหน่งที่พิมพ์ใต้ชื่อ', s.directorPosition)}</div>
      <div class="muted small">หัวหน้ากลุ่มสาระฯ ดึงจากบทบาทในหน้าบุคลากร: ${heads.length ? heads.map(u => esc(u.name) + ' (' + esc(u.dept) + ')').join(', ') : 'ยังไม่กำหนด'}</div></div>
    <div class="card"><h2>หัวเอกสาร</h2>
      ${f('printTitle', 'หัวเรื่องบนปก ปพ.5', s.printTitle)}${f('memoTo', '“เรียน” ในบันทึกข้อความแลกคาบ', s.memoTo)}</div>
    <div class="card"><h2>รูปแบบตัวอักษรของแบบพิมพ์</h2><div class="muted small" style="margin-bottom:8px">ใช้กับใบลา บันทึกข้อความแลกคาบ ใบขออนุญาตพากิจกรรม · ค่ามาตรฐานตามระเบียบงานสารบรรณ: เนื้อความ 16 pt หัวเรื่อง 29 pt (EMS ตั้ง 22 ให้พอดีหน้า)</div>
      <div class="grid g2">${[['body', 'ขนาดเนื้อความ (pt)', 10, 24, 1], ['title', 'ขนาดหัวเรื่อง (pt)', 14, 36, 1], ['margin', 'ขอบกระดาษ (มม.)', 8, 30, 1], ['line', 'ระยะบรรทัด', 1, 2.4, 0.1]].map(([k, l, a, b, st]) =>
        `<div class="field"><label class="f" for="ad-pr-${k}">${l}</label><input class="in" type="number" id="ad-pr-${k}" data-pk="${k}" min="${a}" max="${b}" step="${st}" value="${p[k]}"></div>`).join('')}</div>
      <div style="border:1px solid var(--line);border-radius:10px;padding:14px;background:#fff;color:#000;font-family:${window.EMSType ? EMSType.printStack() : 'Sarabun'};font-size:${num(p.body) * 0.85}px;line-height:${p.line}">
        <div style="text-align:center"><img src="${esc(window.EMSLogo())}" alt="" style="height:40px"><div style="font-size:${num(p.title) * 0.85}px;font-weight:700">บันทึกข้อความ</div></div>
        <div><b>ส่วนราชการ</b> ${esc(s.schoolName || '')}</div><div><b>เรื่อง</b> ตัวอย่างการจัดหน้าเอกสาร</div><div><b>เรียน</b> ${esc(s.memoTo || '')}</div></div>
      <button class="btn sm" style="margin-top:8px" data-ad="printSample">${ic('print')}พิมพ์ตัวอย่าง</button></div>
  </div>
  <div style="position:sticky;bottom:12px;display:flex;justify-content:flex-end"><button class="btn pri" data-ad="docSave">${ic('check')}บันทึกข้อมูลเอกสารทั้งหมด</button></div>`;
}
function printDoc(title, body) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const font = window.EMSType ? EMSType.printStack() : '"TH Sarabun New","Sarabun",sans-serif', d = f.contentWindow.document; d.open();
  d.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:${font};color:#000}h1{text-align:center;margin:0 0 8px}p{margin:4px 0}${window.EMSPrintCss()}</style></head><body>${body}</body></html>`);
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
}

/* ================= หน้า ================= */
P['a-users'] = () => shell('people', people());
P['a-settings'] = () => { const s = S.adm.sec === 'people' || !SECS.some(x => x[0] === S.adm.sec) ? 'school' : S.adm.sec;
  return shell(s, ({ school, calendar, timetable, documents })[s]()); };
P['a-courses'] = () => { const all = X() ? X().allEntries() : [];
  return `<div class="top"><div><h1>ห้องและรายวิชา</h1><p>รายวิชาและครูผู้สอนของแต่ละห้อง จากตารางสอนทั้งโรงเรียน</p></div><button class="btn" data-ad="sec" data-s="timetable">${ic('grid')}ตารางสอนทั้งโรงเรียน</button></div>
    <div class="card"><div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th>รายวิชา · ครูผู้สอน · คาบ/สัปดาห์</th><th style="text-align:right">นักเรียน</th></tr></thead><tbody>${sortRooms(S.rooms).map(r => {
      const g = {}; all.filter(e => e.classId === r.id).forEach(e => { const k = e.subject + '|' + e.teacher; g[k] = (g[k] || 0) + 1; });
      const ks = Object.keys(g);
      return `<tr><td><b>${esc(r.name)}</b></td><td class="small">${ks.length ? ks.map(k => { const [s, t] = k.split('|'); return `<div>${esc(s)} · ${esc(t)} · ${g[k]} คาบ</div>`; }).join('') : '<span class="muted">ยังไม่มีในตาราง</span>'}</td><td style="text-align:right">${roomCount(r)}</td></tr>`; }).join('')}</tbody></table></div></div>`; };

/* ล็อกการกรอกคะแนนเมื่อปิดภาคเรียน */
const baseScores = P.scores;
if (baseScores) P.scores = () => { const h = baseScores(); if (!lockedNow()) return h;
  return `<div class="notice bad"><b>ปิดการกรอกคะแนนแล้ว</b> — ภาคเรียนที่ ${esc(S.term.sem)}/${esc(S.term.year)} ปิดเมื่อ ${termCur().close ? thDate(termCur().close) : '—'} ดูคะแนนได้แต่แก้ไม่ได้ · ติดต่อผู้ดูแลระบบถ้าต้องแก้</div><div class="ad-locked">${h}</div>`; };
['items', 'groups', 'indicators', 'assess'].forEach(k => { const base = P[k]; if (!base) return; P[k] = () => { const h = base(); return lockedNow() ? `<div class="notice bad"><b>ภาคเรียนนี้ปิดแล้ว</b> — ดูได้อย่างเดียว</div><div class="ad-locked">${h}</div>` : h; }; });
/* แจ้งในหน้าเช็กชื่อเมื่อวันนั้นมีการสลับวันเรียน */
const baseAtt = P.attendance;
if (baseAtt) P.attendance = () => { const h = baseAtt(), d = (S.aui && S.aui.date) || todayISO(), sh = (S.dayShifts || []).find(x => x.date === d);
  return sh ? `<div class="notice" style="background:var(--info-soft)"><b>${thDate(d)} สลับวันเรียน</b> · ${esc(shiftText(sh))}${sh.name ? ' · ' + esc(sh.name) : ''}</div>` + h : h; };

/* ================= เหตุการณ์ ================= */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ad]'); if (!t || t.disabled) return;
  const d = t.dataset, L = $('#layer');
  switch (d.ad) {
    case 'deptMerge': { const L = S.staff.filter(u => u.dept && deptCanon(u.dept) !== u.dept); if (!L.length) return;
      const pairs = {}; L.forEach(u => { const k = u.dept + ' → ' + deptCanon(u.dept); pairs[k] = (pairs[k] || 0) + 1; });
      return ask('รวมชื่อกลุ่มสาระ/กลุ่มงาน', 'เปลี่ยนชื่อกลุ่มสาระของบุคลากร ' + L.length + ' คน ให้เป็นชื่อเดียวกัน:<br>' + Object.keys(pairs).map(k => '• ' + esc(k) + ' (' + pairs[k] + ' คน)').join('<br>'), 'รวมชื่อ',
        () => { S.staff.forEach(u => { if (u.dept) { const c = deptCanon(u.dept); if (c !== u.dept) u.dept = c; } }); save(); toast('รวมชื่อกลุ่มสาระแล้ว'); render(); }); }
    case 'askOk': { const fn = ASK; ASK = null; closeModal(); if (fn) fn(); return; }
    case 'sec': if (d.s === 'people') return go('a-users'); S.adm.sec = d.s; save(); return go('a-settings');
    case 'pick': { const f = document.getElementById(d.f); if (f) f.click(); return; }
    /* บุคลากร */
    case 'sort': S.adm.dir = S.adm.sort === d.k ? -S.adm.dir : 1; S.adm.sort = d.k; save(); return redraw();
    case 'stAdd': return staffAddForm();
    case 'stAddSave': { const n = $('#ad-n').value.trim(), em = $('#ad-e').value.trim();
      if (!n) return toast('กรุณากรอกชื่อ-สกุล');
      if (S.staff.some(u => norm(u.name) === norm(n))) return toast('มีชื่อนี้ในระบบแล้ว');
      if (em && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) || S.staff.some(u => String(u.email || '').toLowerCase() === em.toLowerCase()))) return toast('อีเมลไม่ถูกต้องหรือซ้ำกับคนอื่น');
      const roles = [...L.querySelectorAll('.ad-newrole:checked')].map(x => x.value);
      S.staff.push({ name: n, email: em, phone: $('#ad-p').value.trim(), dept: $('#ad-d').value, roles: roles.length ? roles : ['teacher'], role: primary(roles.length ? roles : ['teacher']) });
      save(); closeModal(); toast('เพิ่ม ' + n + ' แล้ว'); return redraw(); }
    case 'stDel': { const u = S.staff[+d.i]; if (!u || u.name === S.me.name) return;
      const per = (S.ttOthers || []).filter(x => x.teacher === u.name).length, rq = (S.xreqs || []).filter(r => r.requester === u.name || r.target === u.name).length, lv = (S.leaves || []).filter(l => l.by === u.name).length;
      return ask('ลบบุคลากรออกจากระบบ', `<div class="notice bad">ลบ <b>${esc(u.name)}</b> และข้อมูลที่ผูกกับคนนี้</div>
        <table class="tbl"><tbody><tr><td>คาบสอนในตารางสอน</td><td><b>${per}</b> คาบ (ลบ)</td></tr><tr><td>คำขอแลกคาบ/สอนแทน</td><td><b>${rq}</b> รายการ (ลบ)</td></tr>
        <tr><td>ใบลา</td><td><b>${lv}</b> ใบ (ลบ)</td></tr><tr><td>ห้องที่ปรึกษา</td><td>${hrRoomsOf(u.name).map(roomName).join(', ') || '—'} (ถอดออก)</td></tr><tr><td>คะแนนและเวลาเรียนของนักเรียน</td><td>อยู่ครบ ไม่ถูกลบ</td></tr></tbody></table>`, 'ลบบุคลากร', () => {
        S.staff = S.staff.filter(x => x !== u); S.ttOthers = (S.ttOthers || []).filter(x => x.teacher !== u.name);
        if (S.ttDuties) {
          (S.ttDuties.meetings || []).forEach(m => { m.teachers = (m.teachers || []).filter(n => !sameT(n, u.name)); });
          (S.ttDuties.activities || []).forEach(a => { a.teachers = (a.teachers || []).filter(n => !sameT(n, u.name)); });
          S.ttDuties.extras = (S.ttDuties.extras || []).filter(ex => !sameT(ex.teacher, u.name));
        }
        S.xreqs = (S.xreqs || []).filter(r => r.requester !== u.name && r.target !== u.name); S.leaves = (S.leaves || []).filter(l => l.by !== u.name);
        Object.keys(S.homeroom).forEach(k => { S.homeroom[k] = hrOf(k).filter(n => n !== u.name); });
        save(); toast('ลบ ' + u.name + ' แล้ว'); redraw(); }, true); }
    case 'tplStaff': return downloadText('แม่แบบบุคลากร_EMS.csv', 'ชื่อ-สกุล,อีเมล,เบอร์โทร,กลุ่มสาระ,บทบาท,ห้องที่ปรึกษา\nครูตัวอย่าง ใจดี,teacher@example.com,081-000-0000,วิทยาศาสตร์,ครูผู้สอน,ม.1/1\nครูหัวหน้า ตัวอย่าง,head@example.com,,คณิตศาสตร์,"ครูผู้สอน, หัวหน้ากลุ่มสาระ",\n');
    case 'hrSync': return adminHrModal();
    case 'hrTest': return adminHrTest();
    case 'hrNames': return adminHrNames();
    case 'hrRename': { if (!isAdm()) return toast('เฉพาะผู้ดูแลระบบ'); if (!hrRenOk()) return toast(HR_REN_NOSTAFF);
      const x = HR_DIFF[+d.i], u = x && (S.staff || []).find(y => y && String(y.email || '').toLowerCase() === x.email); if (!u) return;
      if (S.staff.some(y => y !== u && norm(y.name) === norm(x.to))) return toast('มีชื่อ “' + x.to + '” ในระบบแล้ว');
      renameStaff(u.name, x.to, u); u.name = x.to; save(); HR_DIFF.splice(+d.i, 1); toast('เปลี่ยนชื่อเป็น ' + x.to + ' แล้ว · ประวัติใบลาเก่ากว่า 30 วันยังเป็นชื่อเดิม'); return hrNamesModal(); }
    case 'stImpOk': { let add = 0, upd = 0;
      const setHr = (nm, rid) => { Object.keys(S.homeroom).forEach(k => { S.homeroom[k] = hrOf(k).filter(n => n !== nm); if (!S.homeroom[k].length) delete S.homeroom[k]; }); if (rid) S.homeroom[rid] = hrOf(rid).concat([nm]); };
      (IMP_STAFF || []).forEach(x => { if (x.status !== 'new' && x.status !== 'upd') return; const nm = x.status === 'upd' ? x.found.name : x.name;
        if (x.hr) setHr(nm, x.hr); else if (x.clr && x.status === 'upd') setHr(nm, ''); });
      (IMP_STAFF || []).forEach(x => { if (x.status === 'new') { const roles = x.roles.length ? x.roles : ['teacher']; S.staff.push({ name: x.name, email: x.email, phone: x.phone, dept: x.dept, roles, role: primary(roles) }); add++; }
        else if (x.status === 'upd') { const u = x.found; if (x.email) u.email = x.email; if (x.phone) u.phone = x.phone; if (x.dept) u.dept = x.dept; if (x.roles.length) { u.roles = x.roles; u.role = primary(x.roles); }
          if (x.name !== u.name && norm(x.name) === norm(u.name)) { /* ชื่อเดิมต่างแค่คำนำหน้า คงชื่อเดิม */ } upd++; } });
      IMP_STAFF = null; save(); closeModal(); toast(`นำเข้าแล้ว · เพิ่ม ${add} · อัปเดต ${upd}`); return redraw(); }
    /* โครงสร้าง */
    case 'termUse': { const tm = S.terms[+d.i]; S.term = { year: tm.year, sem: tm.sem }; save(); toast('ใช้ภาคเรียนที่ ' + tm.sem + '/' + tm.year); return redraw(); }
    case 'termDel': { const tm = S.terms[+d.i]; return ask('ลบปี/ภาคเรียน', `ลบ <b>ภาคเรียนที่ ${esc(tm.sem)}/${esc(tm.year)}</b> ออกจากรายการ?`, 'ลบ', () => { S.terms.splice(S.terms.indexOf(tm), 1); save(); redraw(); }, true); }
    case 'termAdd': { const y = $('#ad-ty').value.trim(), s = $('#ad-ts').value;
      if (!/^25\d\d$/.test(y)) return toast('กรอกปีการศึกษาเป็นพุทธศักราช เช่น 2570');
      if (S.terms.some(x => x.year === y && x.sem === s)) return toast('มีภาคเรียนนี้แล้ว');
      S.terms.push({ year: y, sem: s, open: '', close: '', minAtt: 80, lock: 'auto' }); save(); toast('เพิ่มภาคเรียนที่ ' + s + '/' + y); return redraw(); }
    case 'annOn': return ask('ประกาศผลอย่างเป็นทางการ', 'ประกาศผลการเรียน <b>ทุกวิชาพร้อมกัน</b>?<br><span class="muted small">นักเรียนจะเห็นคะแนนปลายภาค คะแนนรวม และเกรดทุกวิชา พร้อมข้อความเตือนให้ตรวจสอบกับ SGS</span>', 'ประกาศผลทันที', () => {
      S.settings.resultsAnnounced = true; S.classes.forEach(c => { S.published[c.id] = true; }); save(); toast('ประกาศผลทุกวิชาแล้ว'); redraw(); });
    case 'annOff': return ask('ยกเลิกการประกาศผล', 'ซ่อนคะแนนปลายภาคและเกรดในหน้านักเรียน <b>ทุกวิชา</b> และกลับเป็น “รอประกาศผลทางการ”?', 'ยืนยันยกเลิก', () => {
      S.settings.resultsAnnounced = false; S.classes.forEach(c => { S.published[c.id] = false; }); save(); toast('ยกเลิกการประกาศผลแล้ว'); redraw(); }, true);
    case 'roomAdd': { const n = $('#ad-rn').value.trim().replace(/\s/g, '').replace(/^ม\.?(?=\d)/, 'ม.');
      if (!n) return toast('กรอกชื่อห้อง'); if (roomByName(n)) return toast('มีห้องนี้แล้ว');
      S.rooms.push({ id: uid('r'), name: n, count: num($('#ad-rc').value) }); save(); toast('เพิ่มห้อง ' + n); return redraw(); }
    case 'roomDel': { const r = roomOf(d.id); if (!r) return; S.rooms = S.rooms.filter(x => x !== r); delete S.homeroom[r.id]; save(); toast('ลบห้อง ' + r.name); return redraw(); }
    /* ปฏิทิน */
    case 'termSave': { const tm = termCur(), o = $('#ad-open').value, c = $('#ad-close').value;
      if (o && c && c < o) return toast('วันปิดภาคเรียนต้องไม่ก่อนวันเปิดภาคเรียน');
      tm.open = o; tm.close = c; tm.minAtt = Math.max(0, Math.min(100, num($('#ad-min').value))); save(); toast('บันทึกปฏิทินภาคเรียนแล้ว'); return redraw(); }
    case 'lock': termCur().lock = d.k; save(); toast(d.k === 'open' ? 'เปิดให้กรอกคะแนน (ฝืนเปิดนอกเวลา)' : d.k === 'locked' ? 'ปิดการกรอกคะแนนทันที' : 'ตั้งเป็นอัตโนมัติตามวันปิดภาคเรียน'); return redraw();
    case 'holAdd': { const from = $('#ad-hf').value, to = $('#ad-ht').value || from, name = $('#ad-hn').value.trim(), skip = $('#ad-hw').checked, tm = termCur();
      if (!from) return toast('กรุณาเลือกวันที่'); if (to < from) return toast('ช่วงวันที่ไม่ถูกต้อง'); if (!name) return toast('กรุณาระบุชื่อวันหยุดหรือเหตุผล');
      let add = 0, upd = 0, out = 0; S.events = S.events || [];
      for (let x = from, g = 0; x <= to && g < 400; x = shift(x, 1), g++) { if (skip && dayIdxOf(x) < 0) continue;
        if (tm.open && tm.close && (x < tm.open || x > tm.close)) out++;
        const h = S.events.find(ev => ev.cat === 'holiday' && ev.date === x); if (h) { upd++; } else { S.events.push({ id: Date.now() + g, date: x, title: name, cat: 'holiday' }); add++; } }
      if (!add && !upd) return toast('ไม่มีวันที่ถูกเพิ่ม (อาจเป็นเสาร์-อาทิตย์ทั้งช่วง)'); if (!add) return toast('ทุกวันในช่วงนี้เป็นวันหยุดอยู่แล้ว');
      save(); toast('เพิ่มวันหยุด ' + add + ' วัน' + (upd ? ' · ข้าม ' + upd + ' วันที่มีอยู่แล้ว (แก้ชื่อได้ในตาราง)' : '') + (out ? ' · ' + out + ' วันอยู่นอกภาคเรียน' : '')); return redraw(); }
    case 'holDel': { const h = (S.events || []).find(x => String(x.id) === d.id); if (!h) return;
      return ask('ลบวันหยุด', `ลบ <b>${thDate(h.date)} · ${esc(h.title)}</b> ออกจากปฏิทิน?<br>ครูจะต้องกลับมาเช็กชื่อในวันนี้ตามปกติ`, 'ลบวันหยุด', () => { S.events = S.events.filter(x => x !== h); save(); toast('ลบวันหยุดแล้ว'); redraw(); }, true); }
    case 'holGoogle': return holGoogle();
    case 'holPick': L.querySelectorAll('.ad-hol').forEach(x => { const it = HOLIMP[+x.dataset.i]; x.checked = d.k === 'official' && !!it && it.official && dayIdxOf(it.date) >= 0; }); return;
    case 'holImpOk': { const picked = [...L.querySelectorAll('.ad-hol:checked')].map(x => HOLIMP[+x.dataset.i]).filter(Boolean);
      if (!picked.length) return toast('ยังไม่ได้ติ๊กวันไหนเลย'); let add = 0, upd = 0; S.events = S.events || [];
      picked.forEach((x, i) => { const h = S.events.find(ev => ev.cat === 'holiday' && ev.date === x.date); if (h) { if (x.name && h.title !== x.name) { h.title = x.name; upd++; } } else { S.events.push({ id: Date.now() + i, date: x.date, title: x.name || 'วันหยุดราชการ', cat: 'holiday' }); add++; } });
      save(); closeModal(); toast('เพิ่มวันหยุด ' + add + ' วัน' + (upd ? ' · อัปเดตชื่อ ' + upd : '')); return redraw(); }
    case 'shAdd': return shiftEditor(null);
    case 'shEdit': return shiftEditor((S.dayShifts || []).find(x => x.id === d.id));
    case 'shRowAdd': collectShift(); SH.map.push({ p: 0, fromDay: 4, fromP: 0 }); return drawShift();
    case 'shRowDel': collectShift(); if (SH.map.length <= 1) return toast('ต้องมีอย่างน้อย 1 คาบ'); SH.map.splice(+d.i, 1); return drawShift();
    case 'shSave': { collectShift(); const tm = termCur();
      if (!SH.date) return toast('กรุณาเลือกวันที่');
      if (tm.open && tm.close && (SH.date < tm.open || SH.date > tm.close)) return toast('วันที่อยู่นอกช่วงเปิด–ปิดภาคเรียน');
      if ((S.dayShifts || []).some(x => x.date === SH.date && x.id !== SH.id)) return toast('วันที่นี้มีการสลับวันอยู่แล้ว กรุณาแก้ไขรายการเดิม');
      const rec = { id: SH.id, date: SH.date, mode: SH.mode, name: SH.name, sourceDay: '', map: [] };
      if (SH.mode === 'day') { if (dayIdxOf(SH.date) === num(SH.sourceDay)) return toast('วันต้นทางตรงกับวันของวันที่เลือกอยู่แล้ว ไม่ต้องสลับ'); rec.sourceDay = num(SH.sourceDay); }
      else { const tg = new Set(), sr = new Set();
        for (const m of SH.map) { if (tg.has(m.p)) return toast('มีคาบของวันนี้ซ้ำกันมากกว่า 1 แถว'); const k = m.fromDay + ':' + m.fromP; if (sr.has(k)) return toast('มีคาบต้นทางซ้ำกันมากกว่า 1 แถว'); tg.add(m.p); sr.add(k); }
        rec.map = SH.map.map(m => ({ p: m.p, fromDay: m.fromDay, fromP: m.fromP })); }
      S.dayShifts = (S.dayShifts || []).filter(x => x.id !== rec.id).concat([rec]); const isNew = SH.isNew; SH = null;
      save(); closeModal(); toast((isNew ? 'เพิ่มการสลับวันแล้ว · ' : 'บันทึกการสลับวันแล้ว · ') + thDate(rec.date)); return redraw(); }
    case 'shDel': { const sh = (S.dayShifts || []).find(x => x.id === d.id); if (!sh) return; const ck = checkedOn(sh.date);
      return ask('ลบการสลับวัน', `ลบ <b>${thDate(sh.date)}</b> ออกจากปฏิทินสลับวัน?<br>ตารางของวันนั้นจะกลับเป็นวันปกติ${ck ? `<br><b>วันนี้มีการเช็กชื่อไปแล้ว ${ck} คาบ</b> ข้อมูลยังอยู่ แต่อาจไม่ตรงกับตารางใหม่` : ''}`, 'ลบ', () => {
        S.dayShifts = (S.dayShifts || []).filter(x => x !== sh); save(); toast('ลบการสลับวันแล้ว'); redraw(); }, true); }
    /* ตารางสอน */
    case 'ttView': S.adm.ttView = d.k; S.adm.ttWho = ''; save(); return redraw();
    case 'dutyTab': S.adm.dutyTab = d.k; save(); return redraw();
    case 'ttPickT': if (!d.t) return; S.adm.ttView = 'teacher'; S.adm.ttWho = d.t; save(); redraw(); scrollTo({ top: 0, behavior: 'smooth' }); return;
    case 'mtgAddGroup': {
      const du = mutDuties();
      du.meetings.push({ id: uid('mtg'), name: 'ประชุมใหม่ ' + (du.meetings.length + 1), day: 0, slot: 5, span: 2, room: 'ห้องประชุม', roles: [], teachers: [] });
      save(); toast('เพิ่มกลุ่มคาบประชุมแล้ว'); return redraw();
    }
    case 'mtgDelGroup': {
      const du = mutDuties(), m = du.meetings[+d.i]; if (!m) return;
      return ask('ลบกลุ่มคาบประชุม', `ลบ <b>${esc(m.name)}</b> (ครู ${(m.teachers || []).length} คน) ออกจากตารางสอน?`, 'ลบกลุ่มประชุม', () => {
        du.meetings.splice(+d.i, 1); save(); toast('ลบกลุ่มประชุมแล้ว'); redraw();
      }, true);
    }
    case 'mtgAddT': {
      const du = mutDuties(), m = du.meetings[+d.i], inp = $('#ad-mtg-add-' + d.i);
      if (!m || !inp) return;
      const raw = inp.value.trim(); if (!raw) return toast('กรุณาพิมพ์หรือเลือกชื่อครู');
      const u = S.staff.find(x => sameT(x.name, raw));
      const tName = u ? u.name : raw;
      if (!Array.isArray(m.teachers)) m.teachers = [];
      if (m.teachers.some(x => sameT(x, tName))) return toast(tName + ' อยู่ในกลุ่มประชุมนี้แล้ว');
      m.teachers.push(tName); inp.value = '';
      save(); toast('เพิ่ม ' + tName + ' ใน ' + m.name + ' แล้ว'); return redraw();
    }
    case 'mtgRmT': {
      const du = mutDuties(), m = du.meetings[+d.i]; if (!m) return;
      m.teachers = (m.teachers || []).filter(x => !sameT(x, d.t));
      save(); toast('นำ ' + d.t + ' ออกจาก ' + m.name + ' แล้ว'); return redraw();
    }
    case 'actAdd': {
      const du = mutDuties();
      du.activities.push({ id: uid('act'), name: 'กิจกรรมใหม่', code: 'กิจกรรม', day: 0, slot: 7, room: '', teachers: S.staff.filter(u => rolesOf(u).indexOf('teacher') >= 0 && !isVacU(u)).map(u => u.name) });
      save(); toast('เพิ่มคาบกิจกรรมแล้ว'); return redraw();
    }
    case 'actDel': {
      const du = mutDuties(); du.activities.splice(+d.i, 1);
      save(); toast('ลบคาบกิจกรรมแล้ว'); return redraw();
    }
    case 'actEditT': return openActTeachersModal(+d.i);
    case 'actAddT': {
      const du = mutDuties(), a = du.activities[+d.i], inp = $('#ad-act-addt');
      if (!a || !inp || !inp.value.trim()) return;
      const raw = inp.value.trim(), u = S.staff.find(x => sameT(x.name, raw)), tName = u ? u.name : raw;
      if (!Array.isArray(a.teachers)) a.teachers = [];
      if (!a.teachers.some(x => sameT(x, tName))) a.teachers.push(tName);
      save(); return openActTeachersModal(+d.i);
    }
    case 'actRmT': {
      const du = mutDuties(), a = du.activities[+d.i]; if (!a) return;
      a.teachers = (a.teachers || []).filter(x => !sameT(x, d.t));
      save(); return openActTeachersModal(+d.i);
    }
    case 'actAllT': {
      const du = mutDuties(), a = du.activities[+d.i]; if (!a) return;
      a.teachers = S.staff.filter(u => rolesOf(u).indexOf('teacher') >= 0 && !isVacU(u)).map(u => u.name);
      save(); return openActTeachersModal(+d.i);
    }
    case 'exAdd': {
      const du = mutDuties();
      du.extras.push({ id: uid('ex'), day: 0, slot: Math.min(8, PERIODS.length - 1), className: (S.rooms[0] || {}).name || 'ม.1/1', subjectCode: 'เสริม', subject: 'คาบเสริม', teacher: S.adm.ttView === 'teacher' ? S.adm.ttWho : '', room: '' });
      save(); toast('เพิ่มคาบเสริมแล้ว'); return redraw();
    }
    case 'exDel': {
      const du = mutDuties(); du.extras.splice(+d.i, 1);
      save(); toast('ลบคาบเสริมแล้ว'); return redraw();
    }
    case 'ttCellEdit': return openDutyCellModal(S.adm.ttView, S.adm.ttWho, +d.d, +d.p);
    case 'cellDelEntry': {
      const day = +d.d, p = +d.p, tName = d.t, cid = d.c;
      if (tName === S.me.name && S.tt && S.tt[day + '-' + p] === cid) {
        delete S.tt[day + '-' + p];
        if (S.ttSub) delete S.ttSub[day + '-' + p];
        if (S.ttLoc) delete S.ttLoc[day + '-' + p];
        if (S.ttCover) delete S.ttCover[day + '-' + p];
      } else {
        S.ttOthers = (S.ttOthers || []).filter(e => !(e.teacher === tName && e.classId === cid && e.day === day && e.p === p));
      }
      save(); toast('ลบคาบสอนแล้ว'); redraw(); return openDutyCellModal(S.adm.ttView, S.adm.ttWho, day, p);
    }
    case 'cellAddEntry': {
      const mode = d.m, who = d.w, day = +d.d, p = +d.p;
      const cid = mode === 'teacher' ? ($('#ad-ce-room') || {}).value : who;
      const rawT = mode === 'teacher' ? who : (($('#ad-ce-teacher') || {}).value || '').trim();
      const u = S.staff.find(x => sameT(x.name, rawT)), tName = u ? u.name : rawT;
      const subj = (($('#ad-ce-subj') || {}).value || '').trim() || 'ไม่ระบุวิชา';
      const loc = (($('#ad-ce-loc') || {}).value || '').trim();
      if (!cid || !tName) return toast('กรุณาระบุครูและห้องเรียน');
      if (tName === S.me.name && cls(cid)) {
        S.tt[day + '-' + p] = cid;
        (S.ttSub = S.ttSub || {})[day + '-' + p] = subj;
        if (loc) (S.ttLoc = S.ttLoc || {})[day + '-' + p] = loc;
      } else {
        S.ttOthers = (S.ttOthers || []).filter(e => !(e.teacher === tName && e.classId === cid && e.day === day && e.p === p));
        S.ttOthers.push(Object.assign({ id: uid('e'), teacher: tName, classId: cid, subject: subj, day, p }, loc ? { room: loc } : {}));
      }
      save(); toast('บันทึกคาบสอนแล้ว'); redraw(); return openDutyCellModal(mode, who, day, p);
    }
    case 'cellNewMtg': {
      const name = (($('#ad-ce-newmtg') || {}).value || '').trim();
      if (!name) return toast('กรอกชื่อกลุ่มประชุม');
      const du = mutDuties();
      du.meetings.push({ id: uid('mtg'), name, day: +d.d, slot: +d.p, span: 1, room: name, roles: [name], teachers: [d.t] });
      save(); toast('สร้างกลุ่มประชุมและเพิ่ม ' + d.t + ' แล้ว'); redraw(); return openDutyCellModal('teacher', d.t, +d.d, +d.p);
    }
    case 'cellDelEx': {
      const du = mutDuties(); du.extras.splice(+d.i, 1);
      save(); toast('ลบคาบเสริมแล้ว'); redraw(); return openDutyCellModal(d.m, d.t, +d.d, +d.p);
    }
    case 'cellToggleAct': {
      const du = mutDuties(), a = du.activities[+d.i];
      if (a) a.teachers = (a.teachers || []).filter(x => !sameT(x, d.t));
      save(); toast('นำออกจากกิจกรรมแล้ว'); redraw(); return openDutyCellModal(d.m, d.t, +d.d, +d.p);
    }
    case 'cellAddEx': {
      const mode = d.m, who = d.w, day = +d.d, p = +d.p;
      const subj = (($('#ad-ce-exsubj') || {}).value || '').trim() || 'คาบเสริม';
      const clsN = (($('#ad-ce-excls') || {}).value || '').trim() || (mode === 'room' ? roomName(who) : '');
      const rawT = mode === 'teacher' ? who : (($('#ad-ce-extch') || {}).value || '').trim();
      const u = S.staff.find(x => sameT(x.name, rawT)), tName = u ? u.name : rawT;
      const loc = (($('#ad-ce-exloc') || {}).value || '').trim();
      const du = mutDuties();
      du.extras.push({ id: uid('ex'), day, slot: p, teacher: tName, subjectCode: 'เสริม', subject: subj, className: clsN, room: loc });
      save(); toast('เพิ่มคาบเสริมแล้ว'); redraw(); return openDutyCellModal(mode, who, day, p);
    }
    case 'tplTT': return downloadText('แม่แบบตารางสอนหลายครู_EMS.csv', 'ครูผู้สอน,วัน,คาบ,ห้อง,รหัสวิชา,ชื่อวิชา\nครูตัวอย่าง ใจดี,จันทร์,1-2,ม.1/1,ว21101,วิทยาศาสตร์\nครูตัวอย่าง ใจดี,พุธ,3,ม.1/2,ว21101,วิทยาศาสตร์\nครูสุดา แสงทอง,อังคาร,5,ม.4/2,ค31101,คณิตศาสตร์\n');
    case 'ttImpOk': return ttImportApply();
    case 'ttAddUnknown': IMP_TT_ADD = true; return ttImportPreview(IMP_TT_ROWS);
    case 'ttSkipUnknown': IMP_TT_ADD = false; return ttImportPreview(IMP_TT_ROWS);
    case 'ttUseFileTerm': { const ft = IMP_TT_FILETERM; if (!ft) return;
      if (!S.terms.some(t => String(t.year) === ft.year && String(t.sem) === ft.sem)) S.terms.push({ year: ft.year, sem: ft.sem });
      S.term = { year: ft.year, sem: ft.sem }; save(); toast('ใช้ภาคเรียนที่ ' + ft.sem + '/' + ft.year + ' แล้ว');
      return setTimeout(() => ttImportPreview(IMP_TT_ROWS), 1500); }      /* รอโหลดตารางของภาคนั้นจากระบบก่อนตรวจชน */
    case 'roomBulk': return roomBulkModal();
    case 'roomBulkOk': return roomBulkApply();
    case 'stuImpOk': return stuImportApply();
    case 'tplStu': return downloadText('แม่แบบรายชื่อนักเรียน_EMS.csv', 'เลขประจำตัว,ชั้น,ห้อง,เลขที่,คำนำหน้า,ชื่อ,นามสกุล\n12345,ม.1,1,1,เด็กชาย,ตัวอย่าง,ใจดี\n12346,ม.1,1,2,เด็กหญิง,สมมติ,รักเรียน\n');
    case 'ttToStudio': return ttToStudio();
    case 'ttHandSkip': { const h = studioHand(); if (h) { S.adm.ttHandAt = h.at; save(); } return redraw(); }
    case 'ttHandOpen': { const h = studioHand(); if (!h) return redraw(); ttImportPreview(h.rows, h.duties || null); if (IMP_TT) IMP_TT.handAt = h.at; return; }
    /* เอกสาร */
    case 'logoReset': S.settings.logoData = ''; save(); toast('กลับไปใช้ตราเดิมแล้ว'); return redraw();
    case 'docSave': { document.querySelectorAll('#view [data-k]').forEach(i => { if (i.id && i.id.indexOf('ad-') === 0) S.settings[i.dataset.k] = i.value.trim(); });
      document.querySelectorAll('#view [data-pk]').forEach(i => { const v = num(i.value); if (v > 0) printCfg()[i.dataset.pk] = Math.max(num(i.min), Math.min(num(i.max), v)); });
      save(); toast('บันทึกข้อมูลเอกสารแล้ว'); return redraw(); }
    case 'printSample': { const s = S.settings;
      return printDoc('ตัวอย่างแบบพิมพ์', `<div style="text-align:center"><img src="${esc(new URL(window.EMSLogo(), location.href).href)}" style="height:1.5cm"></div><h1>บันทึกข้อความ</h1>
        <p><b>ส่วนราชการ</b> ${esc(s.schoolName || '')} ${esc(s.educationOffice || '')}</p><p><b>ที่</b> ……………… <span style="margin-left:40px"><b>วันที่</b> ${thDate(todayISO())}</span></p>
        <p><b>เรื่อง</b> ตัวอย่างการจัดหน้าเอกสาร</p><p><b>เรียน</b> ${esc(s.memoTo || '')}</p>
        <p style="text-indent:2.5cm">เอกสารนี้ใช้ตรวจขนาดตัวอักษร ระยะบรรทัด และขอบกระดาษก่อนพิมพ์ใบลา บันทึกข้อความแลกคาบ และใบขออนุญาตพานักเรียนทำกิจกรรม</p>
        <p style="text-align:center;margin-top:24px">ลงชื่อ ........................................<br>( ${esc(s.directorName || '........................................')} )<br>${esc(s.directorPosition || '')}</p>`); }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.adf === 'mtgQ') {
    S.adm.mtgQ = t.value;
    const pos = t.selectionStart;
    const card = $('#ad-duty-card');
    if (card) {
      const tmp = document.createElement('div');
      tmp.innerHTML = dutyManageCard(X() ? X().allEntries() : []);
      const newCard = tmp.querySelector('#ad-duty-card');
      if (newCard) {
        card.replaceWith(newCard);
        const inp = $('#ad-duty-card [data-adf="mtgQ"]');
        if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (_) {} }
      }
    }
    return;
  }
  if (t.dataset.adf !== 'q') return;
  S.adm.q = t.value; const b = $('#ad-rows'), c = $('#ad-count'); if (b) b.innerHTML = staffRows(); if (c) c.innerHTML = staffCount();
});
document.addEventListener('change', async e => {
  const t = e.target, d = t.dataset;
  if (d.adfile) { const f = t.files && t.files[0]; t.value = ''; if (!f) return;
    try {
      if (d.adfile === 'staff') return staffImportPreview(await readRows(f));
      if (d.adfile === 'tt') { const r = await readTtFile(f); return ttImportPreview(r.rows, r.duties); }
      if (d.adfile === 'stu') return stuImportPreview(await stuSheets(f));
      if (d.adfile === 'ics') { if (!termCur().open || !termCur().close) return toast('กรุณากำหนดวันเปิด-ปิดภาคเรียนก่อน');
        const ev = await parseIcs(f); if (!ev.length) return toast('ไม่พบรายการวันหยุดในไฟล์นี้ · ต้องเป็นไฟล์ .ics จากปฏิทิน Google'); return holImport(ev, f.name); }
      if (d.adfile === 'logo') { if (f.size > 1024 * 1024) return toast('ไฟล์ใหญ่เกิน 1 MB');
        const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
        const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
        const k = Math.min(1, 320 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); S.settings.logoData = cv.toDataURL('image/png'); save(); toast('อัปโหลดตราโรงเรียนแล้ว'); return redraw(); }
    } catch (err) { return toast('อ่านไฟล์ไม่สำเร็จ: ' + ((err && err.message) || 'รูปแบบไฟล์ไม่ถูกต้อง')); }
    return;
  }
  if (!d.adf) return;
  switch (d.adf) {
    case 'ttMap': IMP_TT_MAP[d.t] = t.value; return ttImportPreview(IMP_TT_ROWS);
    case 'mtgField': {
      const du = mutDuties(), m = du.meetings[+d.i]; if (!m) return;
      if (d.k === 'day' || d.k === 'slot' || d.k === 'span') m[d.k] = +t.value;
      else m[d.k] = t.value.trim();
      save(); toast('บันทึกข้อมูลกลุ่มประชุมแล้ว'); return redraw();
    }
    case 'mtgMoveT': {
      const du = mutDuties(), fromM = du.meetings[+d.from], toM = du.meetings[+t.value];
      if (!fromM || !toM || fromM === toM) return;
      fromM.teachers = (fromM.teachers || []).filter(x => !sameT(x, d.t));
      if (!Array.isArray(toM.teachers)) toM.teachers = [];
      if (!toM.teachers.some(x => sameT(x, d.t))) toM.teachers.push(d.t);
      save(); toast(`ย้าย ${d.t} ไปกลุ่ม ${toM.name} แล้ว`); return redraw();
    }
    case 'actField': {
      const du = mutDuties(), a = du.activities[+d.i]; if (!a) return;
      if (d.k === 'day' || d.k === 'slot') a[d.k] = +t.value;
      else a[d.k] = t.value.trim();
      save(); toast('บันทึกคาบกิจกรรมแล้ว'); return redraw();
    }
    case 'exField': {
      const du = mutDuties(), ex = du.extras[+d.i]; if (!ex) return;
      if (d.k === 'day' || d.k === 'slot') ex[d.k] = +t.value;
      else if (d.k === 'teacher') { const raw = t.value.trim(), u = S.staff.find(x => sameT(x.name, raw)); ex.teacher = u ? u.name : raw; }
      else ex[d.k] = t.value.trim();
      save(); toast('บันทึกคาบเสริมแล้ว'); return redraw();
    }
    case 'cellToggleMtg': {
      const du = mutDuties(), m = du.meetings[+d.i]; if (!m) return;
      if (!Array.isArray(m.teachers)) m.teachers = [];
      if (t.checked) { if (!m.teachers.some(x => sameT(x, d.t))) m.teachers.push(d.t); }
      else { m.teachers = m.teachers.filter(x => !sameT(x, d.t)); }
      save(); toast(t.checked ? `เพิ่ม ${d.t} ใน ${m.name} แล้ว` : `นำ ${d.t} ออกจาก ${m.name} แล้ว`);
      redraw(); return openDutyCellModal('teacher', d.t, +d.d, +d.p);
    }
    case 'st': { const u = S.staff[+d.i]; if (!u) return; const v = t.value.trim();
      if (d.k === 'name') { if (!v) { t.value = u.name; return toast('ชื่อต้องไม่ว่าง'); } if (S.staff.some(x => x !== u && norm(x.name) === norm(v))) { t.value = u.name; return toast('มีชื่อนี้ในระบบแล้ว'); } if (renameStaff(u.name, v)) { u.name = v; save(); return toast('บันทึกแล้ว — คาบที่ครูอื่นรับไว้แทนเปลี่ยนเป็นชื่อใหม่ด้วย · ถ้าครูตัวจริงมาแล้ว ให้ย้ายคาบคืนในแอปจัดตาราง (รับครูตัวจริง)'); } }
      if (d.k === 'email' && v && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || S.staff.some(x => x !== u && String(x.email || '').toLowerCase() === v.toLowerCase()))) { t.value = u.email || ''; return toast('อีเมลไม่ถูกต้องหรือซ้ำกับคนอื่น'); }
      u[d.k] = v; save(); return toast('บันทึกแล้ว'); }
    case 'role': { const u = S.staff[+d.i]; if (!u) return; const tr = t.closest('tr');
      let rs = [...tr.querySelectorAll('[data-adf="role"]:checked')].map(x => x.value);
      if (!rs.length) { t.checked = true; return toast('ต้องมีอย่างน้อย 1 บทบาท'); }
      if (u.name === S.me.name && t.value === 'admin' && !t.checked && !S.staff.some(x => x !== u && rolesOf(x).indexOf('admin') >= 0)) { t.checked = true; return toast('ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน'); }
      u.roles = rs; u.role = primary(rs); t.closest('label').classList.toggle('on', t.checked); save(); return toast('บันทึกบทบาทแล้ว'); }
    case 'hr': { const u = S.staff[+d.i]; if (!u) return; const v = t.value;
      if (v && isVacU(u)) { toast('ตำแหน่งว่างเป็นครูที่ปรึกษาไม่ได้'); return redraw(); }
      if (v && hrOf(v).indexOf(u.name) < 0 && hrOf(v).length >= 2) { toast('ห้อง ' + roomName(v) + ' มีครูที่ปรึกษาครบ 2 คนแล้ว'); return redraw(); }
      Object.keys(S.homeroom).forEach(k => { S.homeroom[k] = hrOf(k).filter(n => n !== u.name); if (!S.homeroom[k].length) delete S.homeroom[k]; });
      if (v) S.homeroom[v] = hrOf(v).concat([u.name]);
      save(); toast(v ? u.name + ' เป็นที่ปรึกษา ' + roomName(v) : 'ถอดห้องที่ปรึกษาแล้ว'); return redraw(); }
    case 'maxN': S.settings.maxStudents = Math.max(1, num(t.value)); save(); return redraw();
    case 'roomN': { const r = roomOf(d.id); if (r) { r.count = Math.max(0, num(t.value)); save(); redraw(); } return; }
    case 'holName': { const h = (S.events || []).find(x => String(x.id) === d.id); if (h && t.value.trim()) { h.title = t.value.trim(); save(); toast('บันทึกชื่อวันหยุดแล้ว'); } return; }
    case 'shUpd': collectShift(); return drawShift();
    case 'ttWho': S.adm.ttWho = t.value; save(); return redraw();
  }
});

/* ---------- สไตล์ ---------- */
const st = document.createElement('style');
st.textContent = `
.ad-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:16px}
.ad-tab{display:flex;gap:10px;align-items:flex-start;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:10px 12px;color:inherit;font:inherit;cursor:pointer;min-height:64px}
.ad-tab svg{width:20px;height:20px;flex:none;margin-top:2px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.ad-tab b{display:block;font-size:.92rem}.ad-tab small{display:block;color:var(--muted);font-size:.75rem;line-height:1.35;margin-top:2px}
.ad-tab:hover{background:var(--surface2)}.ad-tab.on{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset;background:var(--surface2)}
.ad-tab.on svg{color:var(--brand)}
.ad-roles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;min-width:390px}
.ad-staff td{vertical-align:top}.ad-staff .ad-id{display:grid;gap:4px;width:190px}.ad-staff .ad-id .in{width:100%;text-align:left;padding-top:5px;padding-bottom:5px}
.ad-role{display:flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:8px;padding:3px 7px 3px 5px;font-size:.78rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ad-role input{margin:0;width:14px;height:14px}.ad-role.on{background:var(--info-soft);border-color:transparent;color:var(--info);font-weight:600}
.ad-per{grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 16px}.ad-per .in{min-width:0;flex:1;width:auto}
.ad-locked input,.ad-locked select,.ad-locked textarea{pointer-events:none;opacity:.65}
.ad-locked [data-bk="paste"],.ad-locked [data-bk="voice"]{pointer-events:none;opacity:.5}
@media (max-width:1100px){.ad-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:640px){.ad-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.ad-tab small{display:none}.ad-tab{min-height:48px}}
`;
document.head.appendChild(st);
const baseStuPage = P['a-students'];
if (baseStuPage) P['a-students'] = () => baseStuPage().replace(`<button class="btn" data-act="go" data-p="a-import">${ic('up')}นำเข้าจากไฟล์</button>`, `<button class="btn" data-ad="tplStu">${ic('down')}แม่แบบ</button>` + stuImpBtn());
window.EMSAdmin = { termCur, lockedNow, termLocked, roomName, hrOf, rolesOf, clashes, renameStaff, openHrModal: adminHrModal, test: adminHrTest, names: adminHrNames, dutiesAt, roomExtrasAt, getDuties, mutDuties, openDutyCellModal, parseAllPeriodsRows };
})();
