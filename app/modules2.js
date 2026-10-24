/* EMS — โมดูลที่ย้ายต่อจาก KruSpace (ชุดที่ 2)
   ใบลา + สายอนุมัติ · ฝ่ายบุคคล · กิจการนักเรียน · แจ้งซ่อม/ขอใช้สถานที่ · ประวัติส่วนตัว
   · แก้ตารางสอน/เวลาคาบ · แผงผู้บริหาร (ขาดเรียนติดต่อกัน/ความครบของห้อง)
   อ้างอิงต้นฉบับ: renderLeaveApprovals, renderPersonnelDept, renderAffairs, renderGeneralDept, renderPersonal */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmt = (x, d) => { if (!isFinite(x)) return '–'; const s = Number(x).toFixed(d === undefined ? 2 : d); return (s.indexOf('.') < 0 ? s : s.replace(/\.?0+$/, '')) || '0'; };      // ไม่มีทศนิยม (d = 0) ห้ามตัดศูนย์ท้าย — 100 ต้องไม่กลายเป็น 1
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const sk = s => String(s.sid || s.id);
const hd = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
const kpi = (l, v, color) => `<div class="card kpi"><div class="l">${l}</div><div class="v"${color ? ` style="color:${color}"` : ''}>${v}</div></div>`;
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const fld = (id, l, v, extra = '') => `<div class="field"><label class="f" for="${id}">${l}</label><input id="${id}" class="in" value="${esc(v ?? '')}" ${extra}></div>`;
const sel = (id, l, opts, v) => `<div class="field"><label class="f" for="${id}">${l}</label><select id="${id}" class="in">${opts.map(o => { const [k, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></div>`;
const seg = (list, cur, act) => `<div class="pills">${list.map(([k, l]) => `<button class="pill" aria-pressed="${k === cur}" data-m2="${act}" data-k="${k}">${esc(l)}</button>`).join('')}</div>`;
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const ask = (title, msg, ok) => new Promise(res => {
  modal(`<h2 style="margin-bottom:8px">${title}</h2><p style="margin-bottom:16px">${msg}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-m2c="0">ยกเลิก</button><button class="btn pri" data-m2c="1">${ok}</button></div>`, true);
  const L = $('#layer'), h = e => { const t = e.target.closest('[data-m2c]'); if (!t) return; L.removeEventListener('click', h, true); closeModal(); res(t.dataset.m2c === '1'); };
  L.addEventListener('click', h, true);
});
function printHtml(title, body) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const d = f.contentWindow.document; d.open();
  d.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:${window.EMSType ? EMSType.printStack() : '"TH Sarabun New","Sarabun",system-ui,sans-serif'};font-size:16pt;line-height:1.7;padding:28px 36px;color:#000}h1{font-size:20pt;text-align:center;margin:0 0 4px}.c{text-align:center}.sig{margin-top:28px;text-align:right}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:4px 8px;font-size:14pt}.box{border:1px solid #444;padding:10px 14px;margin-top:14px}${window.EMSPrintCss ? EMSPrintCss() : ''}</style></head><body>${body}</body></html>`);
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
}
const school = () => (S.settings && S.settings.schoolName) || 'โรงเรียนปากช่อง';
const dayOf = iso => { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? null : d; };

/* ================= ข้อมูลตั้งต้น ================= */
const LTYPES = { sick: 'ลาป่วย', personal: 'ลากิจส่วนตัว', vacation: 'ลาพักผ่อน', maternity: 'ลาคลอดบุตร', trip: 'ไปราชการ', other: 'ลาอื่น ๆ' };
const COVERS = { none: 'ไม่มีคาบสอนในช่วงที่ลา', sub: 'จัดครูสอนแทนเอง', swap: 'ขอแลกคาบกับเพื่อนครู', head: 'ให้หัวหน้ากลุ่มสาระจัดครูสอนแทน' };
const LST = { draft: ['ยังไม่ส่ง', ''], submitted: ['รอผู้บริหารอนุมัติ', 'warn'], approved: ['อนุมัติแล้ว', 'ok'], rejected: ['ไม่อนุมัติ', 'bad'] };
const fresh = S.leaves == null;
S.leaves = S.leaves || [
  { id: 'lv1', by: 'ครูสมชาย ใจดี', type: 'personal', from: '2026-10-14', to: '2026-10-14', reason: 'ธุระส่วนตัว', cover: 'sub', head: 'none', status: 'submitted', at: '2026-10-06T08:00:00Z' },
  { id: 'lv2', by: 'ครูสุดา แสงทอง', type: 'sick', from: '2026-10-12', to: '2026-10-13', reason: 'ป่วยเป็นไข้หวัดใหญ่', cover: 'head', head: 'waiting', status: 'submitted', at: '2026-10-09T08:00:00Z' },
  { id: 'lv3', by: 'ครูวิไล เพชรงาม', type: 'trip', from: '2026-10-08', to: '2026-10-08', reason: 'อบรมหลักสูตรครูผู้สอน', cover: 'swap', head: 'none', status: 'approved', at: '2026-10-01T08:00:00Z' },
  { id: 'lv4', by: 'ครูสมชาย ใจดี', type: 'sick', from: '2026-09-22', to: '2026-09-23', reason: 'ไข้หวัด', cover: 'sub', head: 'none', status: 'approved', at: '2026-09-21T08:00:00Z' }
];
S.pending = (S.pending || []).filter(p => p.type === 'swap');     // ใบลา/แจ้งซ่อม/ขอสถานที่ ย้ายไปใช้ระบบจริงของโมดูลใหม่แล้ว
S.scanTimes = S.scanTimes || {};           // date -> {ชื่อครู: 'HH:MM'}
S.hrCfg = Object.assign({ lateTime: '08:00' }, S.hrCfg || {});
S.affairs = S.affairs || {
  cfg: { startScore: 100, threshold: 60, lateTime: '08:00', lateDeduct: 2, assemblyAbsentDeduct: 0, capAtStart: true, rules: [
    { id: 'r1', kind: 'bad', name: 'แต่งกายผิดระเบียบ', points: 5 }, { id: 'r2', kind: 'bad', name: 'ทรงผมผิดระเบียบ', points: 5 },
    { id: 'r3', kind: 'bad', name: 'ใช้โทรศัพท์ในเวลาเรียน', points: 5 }, { id: 'r4', kind: 'bad', name: 'ทะเลาะวิวาท', points: 20 },
    { id: 'r5', kind: 'good', name: 'ช่วยเหลือกิจกรรมโรงเรียน', points: 5 }, { id: 'r6', kind: 'good', name: 'ทำความดีเป็นที่ประจักษ์', points: 10 }] },
  records: [], daily: {}, view: 'today', date: ''
};
if (!S.affairs.records.length) {
  const a = S.classes[1] ? S.classes[1].students : [], b = S.classes[0] ? S.classes[0].students : [];
  const mk = (s, c, kind, title, pts, date) => ({ id: uid('rc'), sid: sk(s), name: s.name, className: c.name, type: 'conduct', kind, title, points: pts, date, by: S.me.name });
  if (a[2]) S.affairs.records.push(mk(a[2], S.classes[1], 'bad', 'ใช้โทรศัพท์ในเวลาเรียน', 5, '2026-09-18'), mk(a[2], S.classes[1], 'bad', 'แต่งกายผิดระเบียบ', 5, '2026-10-01'));
  if (a[5]) S.affairs.records.push(mk(a[5], S.classes[1], 'good', 'ช่วยเหลือกิจกรรมโรงเรียน', 5, '2026-09-25'));
  if (b[3]) S.affairs.records.push(mk(b[3], S.classes[0], 'bad', 'ทะเลาะวิวาท', 20, '2026-09-30'), mk(b[3], S.classes[0], 'bad', 'ทรงผมผิดระเบียบ', 5, '2026-10-02'));
}
S.affairs.cfg = Object.assign({ classLateEnabled: true, classLateDeduct: 1 }, S.affairs.cfg);
/* ชั่วโมงจิตอาสา { id, sid, name, className, title, date, hours, note, st: 'pending'|'ok'|'no', src: 'staff'|'student', by, at, okBy }
   ครูบันทึกเอง (st=ok ทันที) หรือนักเรียนส่งคำขอจากหน้าของตัวเอง (st=pending) แล้วครู/ฝ่ายกิจการฯ อนุมัติ · โหมดจริงเก็บที่คอลเลกชัน volunteer */
S.affairs.vol = S.affairs.vol || [];
S.gen = S.gen || { approvers: { head: '', assistant: '', deputy: '' }, workers: [{ id: 'w1', name: 'นายช่างประเสริฐ', phone: '081-000-0001', skill: 'ไฟฟ้า' }, { id: 'w2', name: 'นายสมศักดิ์', phone: '081-000-0002', skill: 'ประปา/อาคาร' }],
  places: ['หอประชุม', 'ห้องประชุม', 'ห้องโสตทัศนศึกษา', 'โรงอาหาร', 'สนามกีฬา', 'ลานกิจกรรม'], view: 'queue' };
S.repairs = S.repairs || [
  { id: 'rp1', place: 'ม.4/2 อาคาร 3 ชั้น 2', category: 'คอมพิวเตอร์ / โปรเจกเตอร์ / เครื่องเสียง', item: 'โปรเจกเตอร์', detail: 'ภาพเบลอ ปรับโฟกัสไม่ได้', urgent: false, owner: 'ครูสมชาย ใจดี', status: 'new', stage: 'head', approvals: {}, createdAt: '2026-10-06T08:00:00Z' },
  { id: 'rp2', place: 'ห้องน้ำอาคาร 2', category: 'ประปา / ห้องน้ำ', item: 'ก๊อกน้ำรั่ว', detail: '', urgent: true, owner: 'ครูวิไล เพชรงาม', status: 'doing', stage: 'approved', approvals: { head: { by: 'หัวหน้างานอาคาร', at: '2026-10-03T08:00:00Z' }, assistant: { by: 'ผู้ช่วยรองฯ', at: '2026-10-03T09:00:00Z' }, deputy: { by: 'รอง ผอ.', at: '2026-10-03T10:00:00Z' } }, workerId: 'w2', handlerNote: 'นัดช่างเข้าซ่อมวันนี้', createdAt: '2026-10-03T07:30:00Z' }
];
S.venues = S.venues || [
  { id: 'vn1', place: 'ห้องประชุม', date: '2026-10-20', from: '13:00', to: '16:00', purpose: 'ประชุมผู้ปกครองห้องเรียน', people: 60, setup: ['โต๊ะ', 'เก้าอี้', 'เครื่องเสียง / ไมโครโฟน'], owner: 'ครูวิไล เพชรงาม', status: 'pending', stage: 'assistant', approvals: { head: { by: 'หัวหน้างานอาคาร', at: '2026-10-08T08:00:00Z' } }, createdAt: '2026-10-08T07:00:00Z' }
];
S.personal = S.personal || { fields: {}, locks: { phone: true, altEmail: true, personalEmail: true, address: true, nationalId: true, salary: true, salaryAsOf: true, appointSalary: true, currentSalary: true, lastRaiseRound: true, lastRaisePercent: true, raises: true }, edu: [{ level: 'มัธยมศึกษาตอนปลาย' }, { level: 'ปริญญาตรี' }], career: [], license: [{}], decor: [], training: [], education: [{ level: 'มัธยมศึกษาตอนปลาย' }, { level: 'ปริญญาตรี' }], raises: [], history: [], decorations: [], requests: [] };
S.periods = S.periods || null;
/* เวลาคาบที่ตั้งไว้มาจากคลาวด์หลังโหลดสคริปต์ → ใส่ลง PERIODS ทุกครั้งก่อนวาด (ไม่งั้นหน้าจอโชว์ค่าตั้งต้น แล้วแก้ช่องเดียวจะบันทึกค่าตั้งต้นทับทั้งชุด) */
const syncPeriods = () => { if (Array.isArray(S.periods)) S.periods.forEach((p, i) => { if (PERIODS[i] && Array.isArray(p)) { PERIODS[i][0] = p[0] || ''; PERIODS[i][1] = p[1] || ''; } }); };
syncPeriods();
{ const baseRenderPer = window.render; window.render = function () { syncPeriods(); return baseRenderPer.apply(this, arguments); }; }
Object.assign(IC, {
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 20a2 2 0 0 1-3.4 0"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
});

/* ================= ใบลา ================= */
const leaveDays = l => { let n = 0, d = dayOf(l.from), e = dayOf(l.to || l.from); if (!d || !e || e < d) return 0;
  for (let g = 0; d <= e && g < 400; g++) { const w = d.getDay(); if (w >= 1 && w <= 5) n++; d.setDate(d.getDate() + 1); } return n; };
const rangeText = l => l.from === l.to || !l.to ? thDate(l.from) : thDate(l.from) + ' – ' + thDate(l.to);
const lsBadge = l => { const [t, k] = LST[l.status] || LST.draft; return chip(l.status === 'submitted' && l.head === 'waiting' ? 'รอหัวหน้ากลุ่มสาระ' : t, l.status === 'submitted' && l.head === 'waiting' ? 'info' : k); };
const isTrip = l => l.type === 'trip';
function leaveDocBody(l) {
  const days = leaveDays(l), who = l.by, dept = (S.staff.find(u => u.name === who) || {}).dept || S.me.dept;
  return `<h1>แบบใบลา${l.type === 'trip' ? 'ไปราชการ' : ''}</h1><div class="c">${esc(school())}</div><p style="text-align:right;margin-top:14px">วันที่ ${thDate((l.at || now()).slice(0, 10))}</p>
    <p>เรื่อง ขออนุญาต${esc(LTYPES[l.type] || 'ลา')}</p><p>เรียน ผู้อำนวยการ${esc(school())}</p>
    <p style="text-indent:48px">ข้าพเจ้า ${esc(who)} ตำแหน่ง ครู สังกัดกลุ่มสาระ/ฝ่าย ${esc(dept)} มีความประสงค์ขออนุญาต${esc(LTYPES[l.type] || 'ลา')} เนื่องจาก ${esc(l.reason || '-')}
    ตั้งแต่วันที่ ${esc(rangeText(l))}${isTrip(l) ? '' : ' รวม ' + days + ' วันทำการ'}</p>
    <p style="text-indent:48px">การมอบหมายงานสอนในช่วงที่${isTrip(l) ? 'ไปราชการ' : 'ลา'}: ${esc(COVERS[l.cover] || '-')}</p>
    <div class="sig">ลงชื่อ ........................................ ผู้ขออนุญาต<br>( ${esc(who)} )</div>
    <div class="box">ความเห็นหัวหน้ากลุ่มสาระฯ: ${l.head === 'endorsed' ? '☑ เห็นควรอนุญาต' : l.head === 'rejected' ? '☑ ไม่เห็นชอบ' : '☐ เห็นควรอนุญาต ☐ ไม่เห็นชอบ'}<br>ลงชื่อ ........................................</div>
    <div class="box">คำสั่ง: ${l.status === 'approved' ? '☑ อนุญาต ☐ ไม่อนุญาต' : l.status === 'rejected' ? '☐ อนุญาต ☑ ไม่อนุญาต' : '☐ อนุญาต ☐ ไม่อนุญาต'}${l.note ? '<br>บันทึก: ' + esc(l.note) : ''}<br><br>ลงชื่อ ........................................ ผู้อำนวยการ${esc(school())}</div>`;
}
const leaveRow = (l, mode) => `<div class="row" style="flex-wrap:wrap"><div class="ico ${isTrip(l) ? 'ok' : 'info'}">${ic('form')}</div>
  <div class="grow" style="min-width:200px"><div class="t">${mode === 'all' ? esc(l.by) + ' · ' : ''}${esc(LTYPES[l.type])}</div>
    <div class="muted small">${esc(rangeText(l))}${isTrip(l) ? '' : ' · ' + leaveDays(l) + ' วัน'} · ${esc(COVERS[l.cover])}${l.head === 'endorsed' ? '<br>หัวหน้ากลุ่มสาระเห็นควรอนุญาต' : l.head === 'waiting' ? '<br>รอความเห็นหัวหน้ากลุ่มสาระ' : l.head === 'rejected' ? '<br>หัวหน้ากลุ่มสาระไม่เห็นชอบ' : ''}${l.note ? '<br>บันทึก: ' + esc(l.note) : ''}</div></div>
  ${lsBadge(l)}<button class="btn sm" data-m2="leaveDoc" data-id="${l.id}">ใบลา</button>
  ${mode === 'mine' && l.status === 'draft' ? `<button class="btn sm pri" data-m2="leaveSend" data-id="${l.id}">ส่งใบลา</button>` : ''}
  ${mode === 'mine' && (l.status === 'draft' || l.status === 'submitted') ? `<button class="btn sm ghost" style="color:var(--bad)" data-m2="leaveCancel" data-id="${l.id}">ยกเลิก</button>` : ''}
  ${mode === 'exec' && l.status === 'submitted' && l.head !== 'waiting' ? `<button class="btn sm" data-m2="leaveNo" data-id="${l.id}">ไม่อนุมัติ</button><button class="btn sm pri" data-m2="leaveOk" data-id="${l.id}">อนุมัติ</button>` : ''}
  ${mode === 'exec' && l.status === 'submitted' && l.head === 'waiting' ? `<button class="btn sm" data-m2="headNo" data-id="${l.id}">ไม่เห็นชอบ</button><button class="btn sm pri" data-m2="headOk" data-id="${l.id}">เห็นควรอนุญาต</button>` : ''}</div>`;
P.leaves = () => {
  const mine = S.leaves.filter(l => l.by === S.me.name).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const used = t => mine.filter(l => l.type === t && l.status !== 'rejected').reduce((a, l) => a + leaveDays(l), 0);
  return hd('ใบลา', 'ยื่นใบลาออนไลน์ ติดตามสถานะ และพิมพ์ใบลาได้', `<button class="btn pri" data-m2="leaveNew">${ic('plus')}ขอลา</button>`) +
    `<div class="grid g4" style="margin-bottom:16px">${kpi('ลาป่วย (วัน)', used('sick'))}${kpi('ลากิจ (วัน)', used('personal'))}${kpi('พักผ่อน (วัน)', used('vacation'))}${kpi('รออนุมัติ', mine.filter(l => l.status === 'submitted').length, 'var(--warn)')}</div>
    <div class="card"><h2>ใบลาของฉัน</h2>${mine.length ? `<div class="list">${mine.map(l => leaveRow(l, 'mine')).join('')}</div>` : '<div class="empty">ยังไม่เคยยื่นใบลา</div>'}</div>`;
};
function leaveForm() {
  modal(`<h2 style="margin-bottom:12px">ขอลา / ไปราชการ</h2>
    ${sel('lf-t', 'ประเภท', Object.entries(LTYPES), 'sick')}
    <div class="grid g2">${fld('lf-f', 'ตั้งแต่วันที่', todayISO(), 'type="date"')}${fld('lf-e', 'ถึงวันที่', todayISO(), 'type="date"')}</div>
    <div class="field"><label class="f" for="lf-r">เหตุผล</label><textarea id="lf-r" class="in" placeholder="เช่น ป่วยเป็นไข้ ต้องพบแพทย์"></textarea></div>
    ${sel('lf-c', 'การจัดคาบสอนในช่วงที่ลา', Object.entries(COVERS), 'sub')}
    <p class="muted small" style="margin-bottom:12px">ถ้าเลือกให้หัวหน้ากลุ่มสาระจัดครูสอนแทน ใบลาจะผ่านความเห็นหัวหน้าก่อนถึงผู้บริหาร</p>
    <div style="display:flex;gap:8px"><button class="btn" style="flex:1" data-m2="leaveSave" data-send="0">บันทึกร่าง</button><button class="btn pri" style="flex:1" data-m2="leaveSave" data-send="1">ส่งใบลา</button></div>`);
}
P['a-leaves'] = () => {
  const all = S.leaves.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))), waiting = all.filter(l => l.status === 'submitted');
  const by = {}; all.filter(l => l.status === 'approved' || l.status === 'submitted').forEach(l => { const r = by[l.by] = by[l.by] || { times: 0, days: 0, t: {} }; r.times++; r.days += isTrip(l) ? 0 : leaveDays(l); r.t[l.type] = (r.t[l.type] || 0) + 1; });
  const swaps = {}; (S.xreqs || []).filter(s => s.status === 'accepted' && s.target).forEach(s => { swaps[s.target] = (swaps[s.target] || 0) + (s.src || []).length; });
  return hd('การลาและการอนุมัติ', 'สรุปการลารายครู ใบลาที่รออนุมัติ และภาระการสอนแทนทั้งโรงเรียน') +
    `<div class="grid g4">${kpi('ใบลารออนุมัติ', waiting.length, 'var(--warn)')}${kpi('การลาทั้งหมด (ครั้ง)', Object.values(by).reduce((a, r) => a + r.times, 0))}${kpi('วันลารวม', Object.values(by).reduce((a, r) => a + r.days, 0), 'var(--bad)')}${kpi('แลกคาบ/สอนแทนสำเร็จ (คาบ)', (S.xreqs || []).filter(s => s.status === 'accepted').reduce((n, s) => n + (s.src || []).length, 0), 'var(--ok)')}</div>
    <div class="card" style="margin-top:16px"><div class="row" style="border:0;padding-top:0"><h2 style="margin:0">ใบลารออนุมัติ</h2><span class="grow"></span>${chip(waiting.length + ' รายการ', 'warn')}</div>
      ${waiting.length ? `<div class="list">${waiting.map(l => leaveRow(l, 'exec')).join('')}</div>` : '<div class="empty">ไม่มีใบลารออนุมัติ</div>'}</div>
    <div class="card"><h2>สรุปการลารายครู <span class="muted small">นับเฉพาะวันจันทร์–ศุกร์</span></h2>
      ${Object.keys(by).length ? `<div class="scroll"><table class="tbl"><thead><tr><th>ครู</th><th>ครั้ง</th><th>วัน</th><th>ป่วย</th><th>กิจ</th><th>พักผ่อน</th><th>ราชการ</th><th>รับแลก/สอนแทน (คาบ)</th></tr></thead><tbody>
      ${Object.entries(by).sort((a, b) => b[1].days - a[1].days).map(([n, r]) => `<tr><td><b>${esc(n)}</b></td><td>${r.times}</td><td><b>${r.days}</b></td><td>${r.t.sick || '–'}</td><td>${r.t.personal || '–'}</td><td>${r.t.vacation || '–'}</td><td>${r.t.trip || '–'}</td><td>${swaps[n] || '–'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีข้อมูลการลา</div>'}</div>
    <div class="card"><h2>ประวัติใบลาทั้งหมด</h2><div class="list">${all.map(l => leaveRow(l, 'all')).join('')}</div></div>`;
};

/* ================= ฝ่ายบุคคล ================= */
let hrView = 'leave', hrDate = todayISO();
const staffList = () => S.staff.filter(u => u.role !== 'exec' && (u.roles || [u.role]).indexOf('vacant') < 0 && (u.roles || [u.role]).indexOf('scanner') < 0);   // ตำแหน่งว่าง/บัญชีเครื่องสแกนไม่มีตัวตน ไม่ต้องสแกน
function dayStatus(name, date) {
  if (window.EMSStaffTime) return EMSStaffTime.status(name, date);      // stafftime.js รวมเวลาจากสแกนหน้า/สแกนนิ้ว/มือถือ
  const lv = S.leaves.find(l => l.by === name && l.status === 'approved' && l.from <= date && (l.to || l.from) >= date);
  if (lv) return { code: isTrip(lv) ? 'trip' : 'leave', label: isTrip(lv) ? 'ไปราชการ' : 'ลา', time: '', lv };
  const t = (S.scanTimes[date] || {})[name];
  if (!S.scanTimes[date]) return { code: 'nodata', label: 'ยังไม่มีข้อมูล', time: '' };
  if (!t) return { code: 'absent', label: 'ไม่พบการสแกน', time: '' };
  return t > S.hrCfg.lateTime ? { code: 'late', label: 'มาสาย', time: t } : { code: 'ok', label: 'ทันเวลา', time: t };
}
window.EMSHR = { date: () => hrDate, view: () => hrView };
window.EMSStaffList = staffList;
P['a-hr'] = () => {
  const tabs = seg([['leave', 'การลา'], ['time', 'เวลามาทำงาน'], ['days', 'วันลงเวลา'], ['setup', 'ตั้งค่า']], hrView, 'hrView');
  const ep = hrEndpoint();
  const head = hd('ฝ่ายบุคคล', 'การลา · มาสาย · ขาดงานของครูและบุคลากร' + (ep ? ' · เชื่อมต่อชีต HR แล้ว' : ''),
    `<button class="btn pri" data-ad="hrSync" style="background:#2563eb;color:#fff">${ic('cloud')}ซิงก์ระบบ HR (Google Sheet)</button>`) + tabs;
  if (hrView === 'days' && window.EMSStaffTime && EMSStaffTime.hrDays) return head + EMSStaffTime.hrDays();
  if (hrView === 'setup' && window.EMSStaffTime) return head + EMSStaffTime.hrSetup(staffList());
  if (hrView === 'time' && window.EMSStaffTime) return head + EMSStaffTime.hrTime(hrDate, staffList());
  if (hrView === 'setup') return head + `<div class="card"><h2>เกณฑ์เวลา</h2><div class="grid g2">${fld('hr-late', 'มาสายเมื่อสแกนหลังเวลา', S.hrCfg.lateTime, 'type="time"')}</div>
    <p class="muted small" style="margin:6px 0 12px">ไฟล์นำเข้าจากเครื่องสแกนนิ้ว (.csv) รูปแบบ: <b>ชื่อ-สกุล, วันที่ (YYYY-MM-DD), เวลา (HH:MM)</b> เก็บเฉพาะเวลาสแกนแรกของแต่ละวัน</p>
    <button class="btn pri" data-m2="hrCfg">บันทึก</button></div>`;
  if (hrView === 'time') {
    const rows = staffList().map(u => ({ u, s: dayStatus(u.name, hrDate) })), ord = { absent: 0, late: 1, leave: 2, trip: 3, ok: 4, nodata: 5 }, n = c => rows.filter(r => r.s.code === c).length;
    rows.sort((a, b) => ord[a.s.code] - ord[b.s.code]);
    return head + `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap">${fld('hr-d', 'วันที่', hrDate, 'type="date"')}<span class="grow"></span>
        <label class="btn" for="hr-f">${ic('up')}นำเข้าไฟล์สแกนนิ้ว (.csv)</label><input id="hr-f" class="sr" type="file" accept=".csv,.txt" data-m2f="scan"></div></div>
      <div class="grid g4">${kpi('มาทันเวลา', n('ok'), 'var(--ok)')}${kpi('มาสาย', n('late'), 'var(--warn)')}${kpi('ลา / ไปราชการ', n('leave') + n('trip'))}${kpi('ไม่พบการสแกน', n('absent'), 'var(--bad)')}</div>
      <div class="card" style="margin-top:16px"><h2>รายวัน · ${thDate(hrDate)}</h2><div class="scroll"><table class="tbl"><thead><tr><th>ครู</th><th>กลุ่มสาระ</th><th>เวลาเข้า</th><th>สถานะ</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${esc(r.u.name)}</b></td><td>${esc(r.u.dept)}</td><td>${esc(r.s.time)}</td><td>${r.s.code === 'nodata' ? '<span class="muted small">ยังไม่มีข้อมูล</span>' : chip(r.s.label, { ok: 'ok', late: 'warn', leave: 'info', trip: 'info', absent: 'bad' }[r.s.code])}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small" style="margin-top:8px">“ไม่พบการสแกน” คือไม่มีเวลาในเครื่องและไม่มีใบลา — ตรวจสอบกับครูก่อนบันทึกเป็นขาดราชการ</p></div>`;
  }
  const today = todayISO(), onLeave = S.leaves.filter(l => l.status === 'approved' && l.from <= today && (l.to || l.from) >= today);
  return head + `<div class="grid g4">${kpi('ลา / ไปราชการวันนี้', onLeave.length, 'var(--warn)')}${kpi('ใบลาทั้งหมด', S.leaves.length)}${kpi('วันลารวม', S.leaves.filter(l => l.status === 'approved' && !isTrip(l)).reduce((a, l) => a + leaveDays(l), 0), 'var(--bad)')}${kpi('รอผู้บริหาร', S.leaves.filter(l => l.status === 'submitted').length, 'var(--info)')}</div>
    <div class="card" style="margin-top:16px"><h2>วันนี้ใครลา / ไปราชการ</h2>${onLeave.length ? `<div class="list">${onLeave.map(l => leaveRow(l, 'all')).join('')}</div>` : '<div class="empty">วันนี้ไม่มีครูลาหรือไปราชการ</div>'}</div>
    <div class="card"><h2>ใบลาทั้งหมด</h2><div class="list">${S.leaves.slice().sort((a, b) => b.from.localeCompare(a.from)).map(l => leaveRow(l, 'all')).join('')}</div></div>`;
};

/* ================= กิจการนักเรียน ================= */
const AFV = [['today', 'วันนี้'], ['gate', 'บันทึกมาสายที่ประตู'], ['scores', 'คะแนนพฤติกรรม'], ['vol', 'จิตอาสา'], ['config', 'ตั้งค่าเกณฑ์']];
const allStudents = () => S.classes.flatMap(c => c.students.map(s => ({ s, c })));
function conduct() {
  const cfg = S.affairs.cfg, out = {};
  allStudents().forEach(({ s, c }) => { out[sk(s)] = { s, c, good: 0, bad: 0, late: 0, lateTotal: 0, goodPts: 0, badPts: 0, recs: [] }; });
  const lateSeen = {};
  S.affairs.records.filter(r => !r.voided).forEach(r => { const o = out[r.sid]; if (!o) return;
    if (r.type === 'late' && r.source !== 'class') { const lk = r.sid + '|' + r.date; if (lateSeen[lk]) return; lateSeen[lk] = 1; }
    o.recs.push(r);
    if (r.type === 'late') { const pts = (r.points !== undefined && r.points !== '') ? num(r.points) : num(cfg.lateDeduct); o.late++; o.lateTotal += pts; o.badPts += pts; } else if (r.kind === 'good') { o.good++; o.goodPts += num(r.points); } else { o.bad++; o.badPts += num(r.points); } });
  Object.values(out).forEach(o => { let sc = num(cfg.startScore) - o.badPts + o.goodPts; if (cfg.capAtStart) sc = Math.min(sc, num(cfg.startScore)); o.score = sc; });
  return out;
}
const scoreChip = (v, cfg) => chip(fmt(v, 0), v < num(cfg.threshold) ? 'bad' : v < num(cfg.threshold) + 10 ? 'warn' : 'ok');
let afCls = '', afQ = '', afLow = false;
function affairsPage() {
  const A = S.affairs, cfg = A.cfg, view = A.view, date = A.date || todayISO(), sums = conduct();
  const nPend = (A.vol || []).filter(v => v.st === 'pending').length;
  const head = hd('ฝ่ายกิจการนักเรียน', 'คะแนนพฤติกรรม · แถวเช้า · มาสาย · จิตอาสา', `<button class="btn pri" data-m2="afRec">${ic('plus')}บันทึกพฤติกรรม</button>`) + seg(AFV.map(x => x[0] === 'vol' && nPend ? [x[0], x[1] + ' (' + nPend + ')'] : x), view, 'afView');
  if (view === 'vol') return head + volView();
  if (view === 'gate') {
    const today = todayISO(), recent = A.records.filter(r => r.type === 'late' && r.date === today && !r.voided).slice(-30).reverse();
    return head + `<div class="grid g2"><div class="card"><h2>บันทึกนักเรียนมาสาย</h2><p class="muted small" style="margin-bottom:10px">กรอกหรือยิงบาร์โค้ดเลขประจำตัวแล้วกด Enter · เข้าหลัง <b>${esc(cfg.lateTime)}</b> น. นับเป็นมาสาย หักครั้งละ <b>${fmt(cfg.lateDeduct)}</b> คะแนน วันเดียวกันไม่หักซ้ำ</p>
        <input id="af-sid" class="in" style="font-size:1.3rem;min-height:56px" inputmode="numeric" autocomplete="off" placeholder="เลขประจำตัว" data-m2k="gate">
        <div class="grid g2" style="margin-top:10px">${fld('af-gd', 'วันที่', today, 'type="date"')}${fld('af-gt', 'เวลาเข้า (เว้นว่าง = ตอนนี้)', '', 'type="time"')}</div><div id="af-res" style="margin-top:10px"></div></div>
      <div class="card"><h2>บันทึกที่ประตูวันนี้ ${recent.length} คน</h2>${recent.length ? `<div class="list">${recent.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.name)}</div><div class="muted small">${esc(r.className)} · ${esc(r.time)}</div></div></div>`).join('')}</div>` : '<div class="empty">ยังไม่มี</div>'}</div></div>`;
  }
  if (view === 'scores') {
    const rows = Object.values(sums).filter(o => (!afCls || o.c.id === afCls) && (!afLow || o.score < num(cfg.threshold)) && (!afQ || o.s.name.includes(afQ) || sk(o.s).includes(afQ)))
      .sort((a, b) => afLow ? a.score - b.score : a.c.name.localeCompare(b.c.name, 'th', { numeric: true }) || a.s.no - b.s.no);
    return head + `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="margin:0">${`<label class="f" for="af-c">ห้อง</label><select id="af-c" class="in" data-m2f="afCls"><option value="">ทุกห้อง</option>${S.classes.map(c => `<option value="${c.id}" ${c.id === afCls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`}</div>
      <div class="field" style="margin:0"><label class="f" for="af-q">ค้นหา</label><input id="af-q" class="in" value="${esc(afQ)}" placeholder="ชื่อหรือเลขประจำตัว" data-m2f="afQ"></div>
      <label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" data-m2f="afLow" ${afLow ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--brand)"> เฉพาะต่ำกว่าเกณฑ์ (${fmt(cfg.threshold)})</label>
      <span class="grow"></span><button class="btn" data-m2="afCsv">${ic('down')}ส่งออก</button><button class="btn ${cfg.stuShow === false ? 'pri' : ''}" data-m2="afPub" title="นักเรียนเห็นคะแนนพฤติกรรมและรายการของตัวเองเมื่อเข้าสู่ระบบ">${cfg.stuShow === false ? 'เปิดให้นักเรียนดู' : 'ซ่อนจากนักเรียน'}</button></div>
      <p class="muted small" style="margin:8px 0">${rows.length} คน · คะแนนเริ่มต้น ${fmt(cfg.startScore)} · แตะที่ชื่อเพื่อดูประวัติและยกเลิกรายการ</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th>เลขที่</th><th>นักเรียน</th><th>คะแนน</th><th>ความดี</th><th>ผิดระเบียบ</th><th>มาสาย</th></tr></thead><tbody>
      ${rows.slice(0, 300).map(o => `<tr data-row style="cursor:pointer" data-m2="afHist" data-sid="${esc(sk(o.s))}"><td>${esc(o.c.name)}</td><td>${o.s.no}</td><td><b>${esc(o.s.name)}</b></td><td>${scoreChip(o.score, cfg)}</td>
        <td style="color:var(--ok)">${o.good ? o.good + ' (+' + fmt(o.goodPts) + ')' : '–'}</td><td style="color:var(--bad)">${o.bad ? o.bad + ' (−' + fmt(o.badPts - o.lateTotal) + ')' : '–'}</td><td>${o.late || '–'}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  if (view === 'config') return head + `<div class="grid g2" style="align-items:start"><div class="card" style="margin-top:0"><h2>เกณฑ์คะแนน</h2><div class="grid g2">
      ${fld('af-s', 'คะแนนเริ่มต้นต่อปี', cfg.startScore, 'inputmode="numeric"')}${fld('af-t', 'เกณฑ์ต้องติดตาม (ต่ำกว่า)', cfg.threshold, 'inputmode="numeric"')}
      ${fld('af-lt', 'เวลาเข้าแถว (หลังจากนี้ = สาย)', cfg.lateTime, 'type="time"')}${fld('af-ld', 'หักเมื่อมาสายที่ประตู/เข้าแถว (ต่อครั้ง)', cfg.lateDeduct, 'inputmode="numeric"')}</div>
      <div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin:6px 0 10px"><label class="row" style="border:0;padding:0 0 8px;cursor:pointer"><input type="checkbox" id="af-clon" style="width:20px;height:20px;accent-color:var(--brand)" ${cfg.classLateEnabled ? 'checked' : ''}><span><b>หักคะแนนอัตโนมัติเมื่อเช็กชื่อ “สาย” ในคาบเรียน</b><br><span class="muted small">เมื่อครูกดบันทึกการเช็กชื่อ ระบบหักคะแนนพฤติกรรมนักเรียนที่มาสายให้เอง (บันทึกซ้ำวันเดิมไม่หักซ้ำ)</span></span></label>
        <div style="max-width:220px">${fld('af-cl', 'หักเมื่อมาสายในคาบเรียน (ต่อครั้ง)', cfg.classLateDeduct, 'inputmode="decimal"')}</div></div>
      <label class="row" style="border:0;cursor:pointer"><input type="checkbox" id="af-cap" style="width:20px;height:20px;accent-color:var(--brand)" ${cfg.capAtStart ? 'checked' : ''}><span>คะแนนความดีบวกคืนได้ไม่เกินคะแนนเริ่มต้น</span></label>
      <button class="btn pri" data-m2="afCfg" style="margin-top:8px">บันทึก</button></div>
    <div class="card" style="margin-top:0"><div class="row" style="border:0;padding-top:0"><h2 style="margin:0">รายการพฤติกรรม</h2><span class="grow"></span><button class="btn sm" data-m2="ruleAdd">+ เพิ่ม</button></div>
      <table class="tbl"><thead><tr><th>ประเภท</th><th>รายการ</th><th>คะแนน</th><th></th></tr></thead><tbody>${cfg.rules.map((r, i) => `<tr><td>${chip(r.kind === 'good' ? 'ความดี +' : 'ผิดระเบียบ −', r.kind === 'good' ? 'ok' : 'bad')}</td>
        <td><input class="in" style="min-width:160px;text-align:left" data-m2f="ruleName" data-i="${i}" value="${esc(r.name)}"></td><td><input class="in" style="width:70px" inputmode="numeric" data-m2f="rulePts" data-i="${i}" value="${esc(r.points)}"></td>
        <td><button class="btn sm ghost" style="color:var(--bad)" data-m2="ruleDel" data-i="${i}">ลบ</button></td></tr>`).join('')}</tbody></table></div></div>`;
  const daily = A.daily[date] || {}, lates = A.records.filter(r => r.type === 'late' && r.date === date && !r.voided), sum = k => Object.values(daily).reduce((a, d) => a + num(d[k]), 0);
  return head + `<div class="card"><div class="row" style="border:0;padding-top:0">${fld('af-date', 'วันที่', date, 'type="date"')}<span class="muted small" style="align-self:center">ข้อมูลแถวเช้ามาจากครูที่ปรึกษากดบันทึกเช็กชื่อคาบเข้าแถว</span></div></div>
    <div class="grid g4">${kpi('ห้องที่เช็กแถวแล้ว', Object.keys(daily).length + '/' + S.classes.length)}${kpi('มาสาย', lates.length, 'var(--warn)')}${kpi('ขาดแถว', sum('absent'), 'var(--bad)')}${kpi('ต่ำกว่าเกณฑ์ทั้งปี', Object.values(sums).filter(o => o.score < num(cfg.threshold)).length, 'var(--bad)')}</div>
    <div class="grid g2" style="margin-top:16px;align-items:start"><div class="card" style="margin-top:0"><h2>แถวเช้ารายห้อง</h2><div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th>สถานะ</th><th>มา</th><th>สาย</th><th>ขาด</th><th>ลา</th><th></th></tr></thead><tbody>
      ${S.classes.map(c => { const d = daily[c.id];
        return `<tr><td><b>${esc(c.name)}</b></td><td>${d ? chip('เช็กแล้ว', 'ok') : chip('ยังไม่เช็ก', 'warn')}</td>${['present', 'late', 'absent', 'leave'].map(k => `<td>${d ? d[k] : '–'}</td>`).join('')}
          <td><button class="btn sm" data-m2="afRoom" data-c="${c.id}">${d ? 'แก้' : 'บันทึก'}</button></td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="card" style="margin-top:0"><h2>นักเรียนมาสาย · ${thDate(date)}</h2>${lates.length ? `<div class="list">${lates.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.name)}</div><div class="muted small">${esc(r.className)} · ${esc(r.time || '')}</div></div></div>`).join('')}</div>` : '<div class="empty">ยังไม่มีนักเรียนมาสาย</div>'}</div></div>`;
}
P.affairs = affairsPage; P['a-affairs'] = affairsPage;

/* ---------- จิตอาสา (ฐานข้อมูลอยู่ที่กิจการนักเรียน) ---------- */
let voCls = '', voQ = '';
const volTotals = () => { const t = {}; (S.affairs.vol || []).filter(v => v.st === 'ok').forEach(v => { const o = t[v.sid] || (t[v.sid] = { h: 0, n: 0 }); o.h += num(v.hours); o.n++; }); return t; };
const volSt = v => v.st === 'ok' ? chip('อนุมัติแล้ว', 'ok') : v.st === 'no' ? chip('ไม่อนุมัติ', 'bad') : chip('รอตรวจ', 'warn');
function volView() {
  const all = S.affairs.vol || [], pend = all.filter(v => v.st === 'pending').sort((a, b) => String(a.at || a.date).localeCompare(b.at || b.date)), tot = volTotals();
  const sum = Object.values(tot).reduce((a, o) => a + o.h, 0);
  const rows = allStudents().filter(({ s, c }) => (!voCls || c.id === voCls) && (!voQ || s.name.includes(voQ) || sk(s).includes(voQ)) && (voCls || voQ || tot[sk(s)]))
    .map(({ s, c }) => ({ s, c, t: tot[sk(s)] || { h: 0, n: 0 } }))
    .sort((a, b) => voCls || voQ ? a.c.name.localeCompare(b.c.name, 'th', { numeric: true }) || a.s.no - b.s.no : b.t.h - a.t.h);
  return `<div class="grid g3">${kpi('ชั่วโมงรวมทั้งโรงเรียน', fmt(sum))}${kpi('นักเรียนที่มีชั่วโมง', Object.keys(tot).length)}${kpi('คำขอรอตรวจ', pend.length, pend.length ? 'var(--warn)' : '')}</div>
    <div class="card" style="margin-top:16px"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><h2 class="grow" style="margin:0">คำขอจากนักเรียน รอตรวจ ${pend.length}</h2><button class="btn pri" data-m2="volAdd">${ic('plus')}บันทึกชั่วโมงจิตอาสา</button></div>
      ${pend.length ? `<div class="list">${pend.map(v => `<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="t">${esc(v.name)} <span class="muted small">${esc(v.className)} · ${esc(v.sid)}</span></div>
        <div class="muted small">${esc(v.title)} · ${thDate(v.date)} · <b>${fmt(v.hours)} ชม.</b>${v.note ? ' · ' + esc(v.note) : ''}</div></div>
        <button class="btn sm pri" data-m2="volOk" data-id="${v.id}">อนุมัติ</button><button class="btn sm" data-m2="volNo" data-id="${v.id}">ไม่อนุมัติ</button></div>`).join('')}</div>`
      : '<p class="muted small">ไม่มีคำขอค้าง — นักเรียนส่งคำขอได้จากเมนู “จิตอาสา” หลังเข้าสู่ระบบ</p>'}</div>
    <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="margin:0"><label class="f" for="vo-fc">ห้อง</label><select id="vo-fc" class="in" data-m2f="voCls"><option value="">ทุกห้อง (เฉพาะคนที่มีชั่วโมง)</option>${S.classes.map(c => `<option value="${c.id}" ${c.id === voCls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label class="f" for="vo-fq">ค้นหา</label><input id="vo-fq" class="in" value="${esc(voQ)}" placeholder="ชื่อหรือเลขประจำตัว" data-m2f="voQ"></div>
      <span class="grow"></span><button class="btn" data-m2="volCsv">${ic('down')}ส่งออกทั้งโรงเรียน</button></div>
      <p class="muted small" style="margin:8px 0">นับเฉพาะรายการที่อนุมัติแล้ว · แตะที่ชื่อเพื่อดูรายการและลบ</p>
      ${rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th>เลขที่</th><th>นักเรียน</th><th>ชั่วโมง</th><th>ครั้ง</th></tr></thead><tbody>
      ${rows.slice(0, 300).map(o => `<tr data-row style="cursor:pointer" data-m2="volHist" data-sid="${esc(sk(o.s))}"><td>${esc(o.c.name)}</td><td>${o.s.no}</td><td><b>${esc(o.s.name)}</b></td><td>${o.t.h ? chip(fmt(o.t.h) + ' ชม.', 'ok') : '–'}</td><td>${o.t.n || '–'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีชั่วโมงจิตอาสา</div>'}</div>`;
}
function volHist(sid) {
  const x = allStudents().find(o => sk(o.s) === sid), list = (S.affairs.vol || []).filter(v => v.sid === sid).sort((a, b) => String(b.date).localeCompare(a.date)), t = volTotals()[sid] || { h: 0 };
  modal(`<h2>${esc(x ? x.s.name : sid)}</h2><div class="muted" style="margin-bottom:10px">${esc(x ? x.c.name : '')} · จิตอาสาอนุมัติแล้ว <b>${fmt(t.h)} ชม.</b></div>
    ${list.length ? `<div class="list">${list.map(v => `<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="t">${esc(v.title)} · ${fmt(v.hours)} ชม.</div><div class="muted small">${thDate(v.date)} · ${v.src === 'student' ? 'นักเรียนส่งคำขอ' : 'บันทึกโดย ' + esc(v.by || '')}${v.okBy ? ' · ตรวจโดย ' + esc(v.okBy) : ''}${v.note ? ' · ' + esc(v.note) : ''}</div></div>
      ${volSt(v)}${v.st === 'pending' ? `<button class="btn sm pri" data-m2="volOk" data-id="${v.id}">อนุมัติ</button>` : ''}<button class="btn sm ghost" style="color:var(--bad)" data-m2="volDel" data-id="${v.id}">ลบ</button></div>`).join('')}</div>` : '<div class="empty">ยังไม่มีรายการ</div>'}`, true);
}
function volModal() {
  const cid = voCls || afCls || (S.classes[0] || {}).id;
  modal(`<h2 style="margin-bottom:12px">บันทึกชั่วโมงจิตอาสา</h2>
    ${fld('vo-t', 'กิจกรรม', '', 'placeholder="เช่น ทำความสะอาดวัด"')}<div class="grid g2">${fld('vo-d', 'วันที่', todayISO(), 'type="date"')}${fld('vo-h', 'จำนวนชั่วโมง (ต่อคน)', '', 'inputmode="decimal"')}</div>
    <div class="field"><label class="f" for="vo-c">ห้อง</label><select id="vo-c" class="in">${S.classes.map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="row" style="border:0;padding:0 0 6px"><span class="muted small grow">เลือกนักเรียน</span><button class="btn sm" data-m2="volAll" data-on="1">เลือกทั้งห้อง</button><button class="btn sm" data-m2="volAll" data-on="0">ไม่เลือก</button></div>
    <div id="vo-list" style="max-height:34vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px 10px"></div>
    ${fld('vo-n', 'หมายเหตุ', '')}<button class="btn pri" style="width:100%" data-m2="volSave">บันทึก</button>`, true);
  const fill = () => { const c = S.classes.find(x => x.id === $('#vo-c').value);
    $('#vo-list').innerHTML = c.students.map(s => `<label class="row" style="border:0;padding:4px 0;cursor:pointer"><input type="checkbox" class="vo-s" value="${esc(sk(s))}" style="width:20px;height:20px;accent-color:var(--brand)"> ${s.no}. ${esc(s.name)}</label>`).join('') || '<div class="muted small">ห้องนี้ยังไม่มีนักเรียน</div>'; };
  fill(); $('#vo-c').onchange = fill;
}
/* บันทึกพฤติกรรมหลายคนพร้อมกัน — เลือกจากห้องใดก็ได้ทั้งโรงเรียน (ต่างห้อง/ต่างระดับรวมในครั้งเดียวได้)
   หรือพิมพ์เลขประจำตัวต่อกัน เว้นวรรค/ขึ้นบรรทัด/จุลภาค = เพิ่มคนถัดไป (วางรายการจากชีตได้) */
const schoolRooms = () => {                       // ทุกห้องของโรงเรียน (รายชื่อจาก rooms) + ห้องของฉัน
  const roster = S.__rosterView || S.__roster || {}, out = {}, add = (id, name, students) => { if (!out[id] || !out[id].students.length) out[id] = { id, name: name || id, students: students || [] }; };
  Object.entries(roster).forEach(([id, r]) => add(id, (r || {}).name, (r || {}).students));
  S.classes.forEach(c => add(c.id, c.name, c.students));
  return Object.values(out).filter(c => c.students.length && !(window.EMSPlans && EMSPlans.isSub && EMSPlans.isSub(c.id)))
    .sort((x, y) => String(x.name).localeCompare(String(y.name), 'th', { numeric: true }));
};
const RC = { sel: [], miss: [] };                  // sel = [{sid,name,className}] ตามลำดับที่เพิ่ม
function recModal(sid) {
  const cfg = S.affairs.cfg, rooms = schoolRooms(), bySid = {};
  rooms.forEach(c => c.students.forEach(s => { if (!bySid[sk(s)]) bySid[sk(s)] = { sid: sk(s), name: s.name, no: s.no, className: c.name, cid: c.id }; }));
  RC.sel = sid && bySid[sid] ? [bySid[sid]] : []; RC.miss = [];
  const cid0 = (sid && bySid[sid] && bySid[sid].cid) || afCls || (S.classes[0] || rooms[0] || {}).id;
  modal(`<h2 style="margin-bottom:12px">บันทึกพฤติกรรม</h2>
    <div class="field"><label class="f" for="rc-ids">พิมพ์เลขประจำตัว <span class="muted small">— เว้นวรรคแล้วพิมพ์คนถัดไปได้เลย (วางหลายเลขพร้อมกันได้)</span></label>
      <input id="rc-ids" class="in" inputmode="numeric" autocomplete="off" placeholder="เช่น 12345 12346 12401"></div>
    <div id="rc-miss"></div>
    <details id="rc-pick" style="margin:4px 0 10px" ${sid ? '' : 'open'}><summary class="small" style="cursor:pointer;padding:4px 0">หรือเลือกจากรายชื่อห้อง (สลับห้องได้ คนที่เลือกไว้ไม่หาย)</summary>
      <div class="field" style="margin-top:6px"><label class="f" for="rc-c">ห้อง</label><select id="rc-c" class="in">${rooms.map(c => `<option value="${esc(c.id)}" ${c.id === cid0 ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="row" style="border:0;padding:0 0 6px"><span class="muted small grow">ติ๊กนักเรียน</span><button class="btn sm" data-rc="all" data-on="1">เลือกทั้งห้อง</button><button class="btn sm" data-rc="all" data-on="0">ไม่เลือกห้องนี้</button></div>
      <div id="rc-list" style="max-height:28vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px 10px"></div></details>
    <div class="muted small" id="rc-cnt" style="margin-bottom:4px"></div><div id="rc-sel" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;max-height:22vh;overflow:auto"></div>
    <div class="field"><label class="f" for="rc-r">รายการ</label><select id="rc-r" class="in">${cfg.rules.map(r => `<option value="${r.id}">${r.kind === 'good' ? '＋' : '－'} ${esc(r.name)} (${r.points})</option>`).join('')}</select></div>
    ${fld('rc-d', 'วันที่', todayISO(), 'type="date"')}${fld('rc-n', 'หมายเหตุ', '')}
    <button class="btn pri" style="width:100%" data-m2="afRecSave" id="rc-save">บันทึก</button>`, true);
  const has = x => RC.sel.some(y => y.sid === x);
  const paint = () => {
    $('#rc-sel').innerHTML = RC.sel.map(x => `<span class="chip info" style="font-weight:600">${esc(x.sid)} ${esc(x.name)} <span class="muted">· ${esc(x.className)}</span>
      <button type="button" data-rc="rm" data-sid="${esc(x.sid)}" aria-label="เอาออก ${esc(x.name)}" style="border:0;background:none;cursor:pointer;font-size:1rem;line-height:1;color:inherit;padding:0 2px">×</button></span>`).join('');
    const nRoom = new Set(RC.sel.map(x => x.className)).size;
    $('#rc-cnt').innerHTML = RC.sel.length ? `<b>เลือกแล้ว ${RC.sel.length} คน</b>${nRoom > 1 ? ' จาก ' + nRoom + ' ห้อง' : ''}` : 'ยังไม่ได้เลือกนักเรียน';
    $('#rc-save').textContent = RC.sel.length > 1 ? `บันทึกให้ ${RC.sel.length} คน` : 'บันทึก';
    $('#rc-miss').innerHTML = RC.miss.length ? `<div class="notice" style="background:var(--bad-soft);color:var(--bad);margin:0 0 8px">ไม่พบเลขประจำตัว: ${RC.miss.map(esc).join(', ')}</div>` : '';
    document.querySelectorAll('#rc-list .rc-s').forEach(b => { b.checked = has(b.value); });
  };
  const fill = () => { const c = rooms.find(x => x.id === $('#rc-c').value);
    $('#rc-list').innerHTML = c ? c.students.map(s => `<label class="row" style="border:0;padding:4px 0;cursor:pointer"><input type="checkbox" class="rc-s" value="${esc(sk(s))}" style="width:20px;height:20px;accent-color:var(--brand)"> ${s.no}. ${esc(s.name)} <span class="muted small">${esc(sk(s))}</span></label>`).join('') : '<div class="muted small">ไม่มีรายชื่อ</div>';
    paint(); };
  const addIds = txt => { String(txt).split(/[\s,;]+/).map(t => t.trim()).filter(Boolean).forEach(t => { const x = bySid[t];
      if (!x) { if (RC.miss.indexOf(t) < 0) RC.miss.push(t); return; }
      RC.miss = RC.miss.filter(m => m !== t); if (!has(t)) RC.sel.push(x); }); paint(); };
  RC.flush = () => { const box = $('#rc-ids'); if (box && box.value.trim()) { addIds(box.value); box.value = ''; } };
  const box = $('#rc-ids');
  /* เว้นวรรค/Enter = ยืนยันเลขที่พิมพ์ · วางหลายเลขพร้อมกันก็แยกให้ เหลือเลขที่ยังพิมพ์ไม่จบไว้ในช่อง */
  box.addEventListener('input', () => { const v = box.value; if (!/[\s,;]/.test(v)) return;
    const parts = v.split(/[\s,;]+/), rest = /[\s,;]$/.test(v) ? '' : parts.pop(); box.value = rest; addIds(parts.join(' ')); });
  box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); RC.flush(); }
    else if (e.key === 'Backspace' && !box.value && RC.sel.length) { RC.sel.pop(); paint(); } });
  box.addEventListener('blur', RC.flush);
  $('#rc-list').addEventListener('change', e => { const b = e.target.closest('.rc-s'); if (!b) return;
    if (b.checked) { if (!has(b.value) && bySid[b.value]) RC.sel.push(bySid[b.value]); } else RC.sel = RC.sel.filter(x => x.sid !== b.value); paint(); });
  $('#layer .sheet').addEventListener('click', e => { const t = e.target.closest('[data-rc]'); if (!t) return; e.preventDefault();
    if (t.dataset.rc === 'rm') { RC.sel = RC.sel.filter(x => x.sid !== t.dataset.sid); return paint(); }
    const c = rooms.find(x => x.id === $('#rc-c').value); if (!c) return; const ids = c.students.map(sk);
    if (t.dataset.on === '1') ids.forEach(i => { if (!has(i) && bySid[i]) RC.sel.push(bySid[i]); }); else RC.sel = RC.sel.filter(x => ids.indexOf(x.sid) < 0);
    paint(); });
  fill(); $('#rc-c').onchange = fill;
  if (!sid) setTimeout(() => box.focus(), 50);
}

/* ================= แจ้งซ่อม / ขอใช้สถานที่ ================= */
const STG = [['head', 'หัวหน้างานอาคารฯ'], ['assistant', 'ผู้ช่วยรองฯ'], ['deputy', 'รอง ผอ.']];
const RST = { new: ['แจ้งใหม่', 'warn'], accepted: ['รับเรื่องแล้ว', 'info'], doing: ['กำลังซ่อม', 'info'], waiting: ['รออะไหล่/งบประมาณ', 'warn'], done: ['เสร็จแล้ว', 'ok'], cannot: ['ซ่อมไม่ได้/ส่งต่อ', 'bad'], rejected: ['ไม่อนุมัติ', 'bad'], cancelled: ['ผู้แจ้งยกเลิก', ''] };
const VST = { pending: ['รออนุมัติ', 'warn'], approved: ['อนุมัติแล้ว', 'ok'], rejected: ['ไม่อนุมัติ', 'bad'], cancelled: ['ผู้ขอยกเลิก', ''] };
const RCAT = ['อาคาร / ห้องเรียน / ประตู หน้าต่าง', 'ไฟฟ้า / หลอดไฟ / ปลั๊ก', 'ประปา / ห้องน้ำ', 'โต๊ะ เก้าอี้ / ครุภัณฑ์', 'คอมพิวเตอร์ / โปรเจกเตอร์ / เครื่องเสียง', 'เครื่องปรับอากาศ / พัดลม', 'บริเวณโรงเรียน / สนาม / ต้นไม้', 'อื่น ๆ'];
const VSETUP = ['โต๊ะ', 'เก้าอี้', 'เครื่องเสียง / ไมโครโฟน', 'โปรเจกเตอร์ / จอ', 'ป้าย / ฉากเวที', 'ผ้าปูโต๊ะ', 'น้ำดื่ม', 'ปลั๊กไฟ / สายพ่วง', 'ทำความสะอาดก่อน-หลังใช้'];
const stageBar = r => `<div class="muted small" style="margin-top:4px">${STG.map(([k, l]) => { const a = (r.approvals || {})[k], cur = r.stage === k && r.status !== 'rejected';
  return `<span style="${a ? 'color:var(--ok);font-weight:600' : cur ? 'color:var(--warn);font-weight:600' : ''}">${a ? '✓' : cur ? '●' : '○'} ${l}</span>`; }).join(' → ')}</div>`;
const pendingStage = r => r.stage && r.stage !== 'approved' && r.status !== 'rejected' && r.status !== 'cancelled';
const nextStage = s => { const i = STG.findIndex(x => x[0] === s); return i < 0 || i === STG.length - 1 ? 'approved' : STG[i + 1][0]; };
const worker = id => S.gen.workers.find(w => w.id === id);
function repairRow(r, adm) {
  const [t, k] = r.status === 'rejected' || !pendingStage(r) ? (RST[r.status] || RST.new) : ['รอ' + STG.find(x => x[0] === r.stage)[1], 'warn'];
  const w = worker(r.workerId), mine = r.owner === S.me.name;
  return `<div class="row" style="flex-wrap:wrap;align-items:flex-start"><div class="ico gold">${ic('tool')}</div><div class="grow" style="min-width:220px">
    <div class="t">${r.urgent ? chip('ด่วน', 'bad') + ' ' : ''}${esc(r.item)} · ${esc(r.place)}</div>
    <div class="muted small">${esc(r.category)} · แจ้งโดย ${esc(r.owner)} · ${thDate(r.createdAt.slice(0, 10))}</div>${r.detail ? `<div class="small">${esc(r.detail)}</div>` : ''}${stageBar(r)}
    ${w || r.handlerNote ? `<div class="muted small">ผู้ปฏิบัติงาน: ${w ? esc(w.name + ' (' + w.skill + ')') : '—'}${r.handlerNote ? ' · ' + esc(r.handlerNote) : ''}</div>` : ''}</div>
    ${chip(t, k)}
    ${adm && pendingStage(r) ? `<button class="btn sm" data-m2="gNo" data-t="r" data-id="${r.id}">ไม่อนุมัติ</button><button class="btn sm pri" data-m2="gOk" data-t="r" data-id="${r.id}">อนุมัติ</button>` : ''}
    ${adm && r.stage === 'approved' && !['done', 'cannot', 'rejected', 'cancelled'].includes(r.status) ? `<button class="btn sm pri" data-m2="rpUpd" data-id="${r.id}">มอบงาน / อัปเดต</button>` : ''}
    ${mine && r.status === 'new' ? `<button class="btn sm ghost" style="color:var(--bad)" data-m2="rpCancel" data-id="${r.id}">ยกเลิก</button>` : ''}</div>`;
}
function venueRow(v, adm) {
  const [t, k] = pendingStage(v) ? ['รอ' + STG.find(x => x[0] === v.stage)[1], 'warn'] : (VST[v.status] || VST.pending), mine = v.owner === S.me.name;
  return `<div class="row" style="flex-wrap:wrap;align-items:flex-start"><div class="ico ok">${ic('grid')}</div><div class="grow" style="min-width:220px">
    <div class="t">${esc(v.place)} · ${thDate(v.date)} ${esc(v.from)}–${esc(v.to)}</div><div class="muted small">${esc(v.purpose)} · ${esc(v.people || '-')} คน · ขอโดย ${esc(v.owner)}</div>
    ${(v.setup || []).length ? `<div class="muted small">จัดเตรียม: ${v.setup.map(esc).join(', ')}</div>` : ''}${stageBar(v)}</div>${chip(t, k)}
    ${adm && pendingStage(v) ? `<button class="btn sm" data-m2="gNo" data-t="v" data-id="${v.id}">ไม่อนุมัติ</button><button class="btn sm pri" data-m2="gOk" data-t="v" data-id="${v.id}">อนุมัติ</button>` : ''}
    ${mine && v.status === 'pending' ? `<button class="btn sm ghost" style="color:var(--bad)" data-m2="vnCancel" data-id="${v.id}">ยกเลิก</button>` : ''}</div>`;
}
P.general = () => {
  const mr = S.repairs.filter(r => r.owner === S.me.name), mv = S.venues.filter(v => v.owner === S.me.name);
  return hd('แจ้งซ่อม / ขอใช้สถานที่', 'ผ่านหัวหน้างานอาคารฯ → ผู้ช่วยรองฯ → รอง ผอ. → ฝ่ายบริหารทั่วไปมอบงาน',
      `<button class="btn" data-m2="rpNew">${ic('tool')}แจ้งซ่อม</button><button class="btn pri" data-m2="vnNew">${ic('plus')}ขอใช้สถานที่</button>`) +
    `<div class="card"><h2>รายการแจ้งซ่อมของฉัน</h2>${mr.length ? `<div class="list">${mr.map(r => repairRow(r, false)).join('')}</div>` : '<div class="empty">ยังไม่เคยแจ้งซ่อม — กด “แจ้งซ่อม” เมื่อพบของชำรุด</div>'}</div>
     <div class="card"><h2>การขอใช้สถานที่ของฉัน</h2>${mv.length ? `<div class="list">${mv.map(v => venueRow(v, false)).join('')}</div>` : '<div class="empty">ยังไม่เคยขอใช้สถานที่</div>'}</div>`;
};
let genFilter = 'open';
P['a-general'] = () => {
  const G = S.gen, v = G.view, q = [...S.repairs.filter(pendingStage).map(r => ({ k: 'r', r })), ...S.venues.filter(pendingStage).map(x => ({ k: 'v', r: x }))];
  const head = hd('ฝ่ายบริหารทั่วไป', 'แจ้งซ่อม · ขอใช้และจัดสถานที่ · สายอนุมัติ') + seg([['queue', `คิวพิจารณา (${q.length})`], ['repair', 'แจ้งซ่อม'], ['venue', 'ขอใช้สถานที่'], ['sched', 'ตารางใช้สถานที่'], ['setup', 'ตั้งค่าฝ่าย']], v, 'genView');
  if (v === 'queue') return head + `<div class="card"><h2>รอการพิจารณา</h2>${q.length ? `<div class="list">${q.map(x => x.k === 'r' ? repairRow(x.r, true) : venueRow(x.r, true)).join('')}</div>` : '<div class="empty">ไม่มีรายการรอพิจารณา</div>'}</div>
    <div class="card"><h2>อนุมัติแล้ว รอมอบงาน</h2>${S.repairs.filter(r => r.stage === 'approved' && ['new', 'accepted'].includes(r.status)).map(r => repairRow(r, true)).join('') || '<div class="empty">ไม่มีงานรอมอบหมาย</div>'}</div>`;
  if (v === 'repair') { const all = S.repairs, open = all.filter(r => ['new', 'accepted', 'doing', 'waiting'].includes(r.status));
    const shown = all.filter(r => genFilter === 'all' || (genFilter === 'open' ? open.includes(r) : ['done', 'cannot', 'rejected', 'cancelled'].includes(r.status)));
    return head + `<div class="grid g3">${kpi('ค้างดำเนินการ', open.length, 'var(--brand)')}${kpi('เร่งด่วนที่ยังค้าง', open.filter(r => r.urgent).length, 'var(--bad)')}${kpi('ซ่อมเสร็จ', all.filter(r => r.status === 'done').length, 'var(--ok)')}</div>
      <div class="card" style="margin-top:16px">${seg([['open', 'ค้างดำเนินการ'], ['done', 'ปิดงานแล้ว'], ['all', 'ทั้งหมด']], genFilter, 'genFilter')}${shown.length ? `<div class="list">${shown.map(r => repairRow(r, true)).join('')}</div>` : '<div class="empty">ไม่มีรายการ</div>'}</div>`; }
  if (v === 'venue') return head + `<div class="card">${S.venues.length ? `<div class="list">${S.venues.map(x => venueRow(x, true)).join('')}</div>` : '<div class="empty">ยังไม่มีการขอใช้สถานที่</div>'}</div>`;
  if (v === 'sched') { const ap = S.venues.filter(x => x.status === 'approved' || pendingStage(x)).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));
    return head + `<div class="card"><h2>ตารางการใช้สถานที่</h2>${ap.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>วันที่</th><th>เวลา</th><th>สถานที่</th><th>เรื่อง</th><th>ผู้ขอ</th><th>สถานะ</th></tr></thead><tbody>${ap.map(x => `<tr><td>${thDate(x.date)}</td><td>${esc(x.from)}–${esc(x.to)}</td><td><b>${esc(x.place)}</b></td><td>${esc(x.purpose)}</td><td>${esc(x.owner)}</td><td>${chip(...(pendingStage(x) ? ['รออนุมัติ', 'warn'] : ['อนุมัติแล้ว', 'ok']))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีรายการ</div>'}</div>`; }
  return head + `<div class="grid g2" style="align-items:start"><div class="card" style="margin-top:0"><h2>ผู้พิจารณาในสายอนุมัติ</h2>${STG.map(([k, l]) => fld('gs-' + k, l, G.approvers[k], 'placeholder="ชื่อ / อีเมล"')).join('')}<button class="btn pri" data-m2="genCfg">บันทึก</button></div>
    <div class="card" style="margin-top:0"><div class="row" style="border:0;padding-top:0"><h2 style="margin:0">ผู้ปฏิบัติงาน / ช่าง</h2><span class="grow"></span><button class="btn sm" data-m2="wkAdd">+ เพิ่ม</button></div>
      ${G.workers.map((w, i) => `<div class="row"><div class="grow"><div class="t">${esc(w.name)}</div><div class="muted small">${esc(w.skill)} · ${esc(w.phone)}</div></div><button class="btn sm ghost" style="color:var(--bad)" data-m2="wkDel" data-i="${i}">ลบ</button></div>`).join('') || '<div class="empty">ยังไม่มีรายชื่อ</div>'}
      <h2 style="margin:16px 0 8px">สถานที่ที่ขอใช้ได้</h2><div class="pills">${G.places.map((p, i) => `<span class="chip">${esc(p)} <a href="#" data-m2="plDel" data-i="${i}" aria-label="ลบ ${esc(p)}">×</a></span>`).join('')}</div>
      <div style="display:flex;gap:8px"><input id="pl-n" class="in" placeholder="เพิ่มสถานที่"><button class="btn" data-m2="plAdd">เพิ่ม</button></div></div></div>`;
};
function repairForm() {
  const places = [...S.gen.places, ...S.classes.map(c => c.name), 'ห้องพักครู', 'ห้องน้ำ', 'ห้องสมุด', 'ห้องปฏิบัติการ'];
  modal(`<h2 style="margin-bottom:12px">แจ้งซ่อม</h2>
    <div class="field"><label class="f" for="rp-p">สถานที่ / ห้อง *</label><input id="rp-p" class="in" list="rp-pl" placeholder="เช่น ม.4/2 อาคาร 3 ชั้น 2"><datalist id="rp-pl">${[...new Set(places)].map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    ${sel('rp-c', 'ประเภท', RCAT, RCAT[0])}${fld('rp-i', 'ของที่ชำรุด *', '', 'placeholder="เช่น พัดลมเพดานตัวที่ 2, ก๊อกน้ำ"')}
    <div class="field"><label class="f" for="rp-d">อาการ / รายละเอียด</label><textarea id="rp-d" class="in"></textarea></div>
    <label class="row" style="border:0;cursor:pointer"><input type="checkbox" id="rp-u" style="width:20px;height:20px;accent-color:var(--brand)"><span>เร่งด่วน — กระทบการเรียนการสอนหรือไม่ปลอดภัย</span></label>
    <p class="muted small" style="margin:8px 0 12px">เส้นทาง: ${STG.map(x => x[1]).join(' → ')} → ฝ่ายบริหารทั่วไปมอบงาน</p>
    <button class="btn pri" style="width:100%" data-m2="rpSave">ส่งแจ้งซ่อม</button>`);
}
function venueForm() {
  modal(`<h2 style="margin-bottom:12px">ขอใช้สถานที่</h2>
    ${sel('vn-p', 'สถานที่', S.gen.places, S.gen.places[0])}<div class="grid g3">${fld('vn-d', 'วันที่', todayISO(), 'type="date"')}${fld('vn-f', 'เริ่ม', '08:30', 'type="time"')}${fld('vn-t', 'สิ้นสุด', '12:00', 'type="time"')}</div>
    ${fld('vn-u', 'วัตถุประสงค์ *', '', 'placeholder="เช่น ประชุมผู้ปกครอง"')}${fld('vn-n', 'จำนวนผู้ใช้ (คน)', '', 'inputmode="numeric"')}
    <div class="muted small" style="margin-bottom:6px;font-weight:600">ต้องการให้จัดเตรียม</div>
    <div class="pills">${VSETUP.map((s, i) => `<label class="pill" style="cursor:pointer"><input type="checkbox" class="vn-s" value="${esc(s)}" style="accent-color:var(--brand)"> ${esc(s)}</label>`).join('')}</div>
    <button class="btn pri" style="width:100%" data-m2="vnSave">ส่งคำขอ</button>`);
}

/* ================= ประวัติส่วนตัว (โครงร่างตาม HR_API.md: basic, contact, personal, salary, history) ================= */
const RANKS = ['', 'ไม่มีวิทยฐานะ', 'ครูชำนาญการ', 'ครูชำนาญการพิเศษ', 'ครูเชี่ยวชาญ', 'ครูเชี่ยวชาญพิเศษ'];
const LEVELS = ['', 'ครูผู้ช่วย', 'คศ.1', 'คศ.2', 'คศ.3', 'คศ.4', 'คศ.5'];
const LIC_TYPES = ['', 'ใบอนุญาตประกอบวิชาชีพครู', 'ใบอนุญาตประกอบวิชาชีพผู้บริหารสถานศึกษา', 'หนังสืออนุญาตปฏิบัติการสอน (ชั่วคราว)', 'อื่น ๆ'];
const PF = [
  /* กลุ่ม basic */
  ['basic', 'prefix', 'คำนำหน้า', 'select', ['', 'นาย', 'นาง', 'นางสาว', 'ว่าที่ร้อยตรี', 'ดร.']],
  ['basic', 'firstName', 'ชื่อ'],
  ['basic', 'lastName', 'นามสกุล'],
  ['basic', 'schoolEmail', 'อีเมลโรงเรียน', 'email'],
  ['basic', 'position', 'ตำแหน่ง', 'select', ['', 'ครูผู้ช่วย', 'ครู', 'รองผู้อำนวยการสถานศึกษา', 'ผู้อำนวยการสถานศึกษา', 'พนักงานราชการ', 'ครูอัตราจ้าง', 'อื่น ๆ']],
  ['basic', 'standing', 'วิทยฐานะ (standing)', 'select', RANKS],
  ['basic', 'rank', 'อันดับ (rank)', 'select', LEVELS],
  ['basic', 'standingDate', 'วันที่ได้รับวิทยฐานะปัจจุบัน (standingDate)', 'date'],
  ['basic', 'positionNo', 'เลขที่ตำแหน่ง (positionNo)'],
  ['basic', 'appointDate', 'วันบรรจุ (appointDate)', 'date'],
  ['basic', 'teacherDate', 'วันที่ได้ดำรงตำแหน่งครู / พ้นครูผู้ช่วย (teacherDate)', 'date'],
  /* กลุ่ม contact */
  ['contact', 'phone', 'เบอร์โทร (phone)'],
  ['contact', 'altEmail', 'อีเมลสำรอง / ส่วนตัว (altEmail)', 'email'],
  ['contact', 'address', 'ที่อยู่ปัจจุบัน (address)'],
  /* กลุ่ม personal */
  ['personal', 'birthDate', 'วันเดือนปีเกิด (birthDate)', 'date'],
  ['personal', 'nationalId', 'เลขประจำตัวประชาชน 13 หลัก (nationalId)'],
  /* กลุ่ม salary */
  ['salary', 'salary', 'เงินเดือนปัจจุบัน (บาท) (salary)', 'number'],
  ['salary', 'salaryAsOf', 'ข้อมูลเงินเดือน ณ วันที่ / รอบ (salaryAsOf)'],
  /* หมวดการสอนใน EMS */
  ['teach', 'teachLevels', 'ชั้นปีที่สอน', 'multi', ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']],
  ['teach', 'teachMajor', 'สาขาวิชาที่สอน', 'list', ['ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์ทั่วไป', 'ฟิสิกส์', 'เคมี', 'ชีววิทยา', 'โลก ดาราศาสตร์ และอวกาศ', 'วิทยาการคำนวณ / คอมพิวเตอร์', 'สังคมศึกษา', 'ประวัติศาสตร์', 'พระพุทธศาสนา', 'สุขศึกษาและพลศึกษา', 'ทัศนศิลป์', 'ดนตรี', 'นาฏศิลป์', 'การงานอาชีพ', 'เทคโนโลยี (การออกแบบและเทคโนโลยี)', 'ภาษาอังกฤษ', 'ภาษาจีน', 'ภาษาญี่ปุ่น', 'ภาษาเกาหลี', 'ภาษาฝรั่งเศส', 'แนะแนว', 'ห้องสมุด / บรรณารักษ์']]
];
const PLOCK = new Set(['phone', 'altEmail', 'personalEmail', 'address', 'nationalId', 'salary', 'salaryAsOf', 'currentSalary', 'lastRaiseRound', 'lastRaisePercent']);
const PT = [
  ['edu', 'ประวัติการศึกษา (history.edu)', [['level', 'ระดับ', 'select', ['', 'มัธยมศึกษาตอนปลาย', 'ประกาศนียบัตรวิชาชีพ (ปวช.)', 'ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)', 'ปริญญาตรี', 'ประกาศนียบัตรบัณฑิต', 'ปริญญาโท', 'ปริญญาเอก']], ['degree', 'ชื่อวุฒิ'], ['major', 'วิชาเอก'], ['school', 'สถานศึกษา'], ['year', 'ปีที่จบ (พ.ศ.)', 'number']]],
  ['career', 'ประวัติการรับราชการ / เลื่อนเงินเดือน (history.career)', [['date', 'วันที่มีผล / รอบ'], ['position', 'ตำแหน่ง / รายการ'], ['rank', 'อันดับ / วิทยฐานะ'], ['salary', 'อัตราเงินเดือน', 'number'], ['place', 'หน่วยงาน / อ้างอิง']]],
  ['license', 'ใบอนุญาตประกอบวิชาชีพ (history.license)', [['type', 'ประเภทใบอนุญาต', 'select', LIC_TYPES], ['no', 'เลขที่ใบอนุญาต'], ['issueDate', 'วันออกใบอนุญาต', 'date'], ['expireDate', 'วันหมดอายุ', 'date']]],
  ['decor', 'เครื่องราชอิสริยาภรณ์ (history.decor)', [['cls', 'ชั้นเครื่องราชฯ'], ['year', 'ปี พ.ศ.', 'number'], ['date', 'วันที่ได้รับ', 'date'], ['gazette', 'ราชกิจจานุเบกษา เล่ม/ตอน/หน้า']]],
  ['training', 'ประวัติการอบรม (ใช้ใน EMS)', [['date', 'วันที่', 'date'], ['course', 'หลักสูตร/หัวข้อ'], ['organizer', 'หน่วยงานที่จัด'], ['hours', 'ชั่วโมง', 'number'], ['kind', 'รูปแบบ', 'select', ['', 'อบรม', 'สัมมนา', 'ศึกษาดูงาน', 'อบรมออนไลน์', 'อื่น ๆ']]]]
];
const SECT = { basic: 'ข้อมูลพื้นฐานและการรับราชการ (basic)', contact: 'ข้อมูลติดต่อ (contact)', personal: 'ข้อมูลส่วนบุคคล (personal)', salary: 'เงินเดือน (salary)', teach: 'การสอนภาคเรียนนี้' };
const yearsBetween = iso => { const d = dayOf(iso || ''); if (!d) return null; const n = new Date(); let y = n.getFullYear() - d.getFullYear(), m = n.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && n.getDate() < d.getDate())) { y--; m += 12; } return { y, m }; };
const addYears = (iso, n) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? (+m[1] + n) + '-' + m[2] + '-' + m[3] : ''; };

/** จัดรูปข้อมูลใน S.personal ให้ตรงตามโครงร่าง HR_API.md และคงคีย์เดิมไว้ให้โค้ดส่วนอื่นใน EMS ใช้งานได้ต่อเนื่อง */
function normPersonal(p) {
  if (!p || typeof p !== 'object') return p;
  const f = p.fields = p.fields || {}, lk = p.locks = p.locks || {};
  /* 1) ชื่อ-สกุล: fullName ↔ firstName + lastName */
  if (!f.firstName && !f.lastName && f.fullName) {
    const pts = String(f.fullName).trim().split(/\s+/);
    f.firstName = pts[0] || '';
    f.lastName = pts.slice(1).join(' ');
  }
  if (f.firstName || f.lastName) f.fullName = [f.firstName, f.lastName].map(x => String(x || '').trim()).filter(Boolean).join(' ');
  /* 2) วิทยฐานะ (standing) และ อันดับ (rank): แปลงจากคีย์รุ่นเก่าที่เก็บวิทยฐานะใน rank และอันดับใน level */
  if (!f.standing && f.rank && RANKS.indexOf(f.rank) > 0) {
    f.standing = f.rank;
    f.rank = f.level || '';
  } else if (!f.rank && f.level) {
    f.rank = f.level;
  }
  f.level = f.rank || '';
  if (!f.standingDate && f.rankDate) f.standingDate = f.rankDate;
  f.rankDate = f.standingDate || '';
  /* 3) อีเมลสำรองและเงินเดือน */
  if (!f.altEmail && f.personalEmail) f.altEmail = f.personalEmail;
  f.personalEmail = f.altEmail || '';
  if (lk.altEmail === undefined) lk.altEmail = lk.personalEmail !== false;
  lk.personalEmail = lk.altEmail;
  if (!f.salary && f.currentSalary) f.salary = f.currentSalary;
  f.currentSalary = f.salary || '';
  if (!f.salaryAsOf && f.lastRaiseRound) f.salaryAsOf = f.lastRaiseRound;
  f.lastRaiseRound = f.salaryAsOf || '';
  ['phone', 'altEmail', 'address', 'nationalId', 'salary', 'salaryAsOf'].forEach(k => { if (lk[k] === undefined) lk[k] = true; });
  /* 4) ตารางประวัติ history: edu, career, license, decor */
  if (!Array.isArray(p.edu) || (!p.edu.length && Array.isArray(p.education) && p.education.length)) {
    p.edu = Array.isArray(p.education) && p.education.length ? p.education : [{ level: 'มัธยมศึกษาตอนปลาย' }, { level: 'ปริญญาตรี' }];
  }
  p.education = p.edu;
  if (!Array.isArray(p.career) || (!p.career.length && Array.isArray(p.raises) && p.raises.length)) {
    p.career = Array.isArray(p.raises) && p.raises.length ? p.raises.map(r => ({
      date: [r && r.round, r && r.year].filter(Boolean).join(' '),
      position: r && r.percent ? 'เลื่อน ' + r.percent + '%' : '',
      rank: '',
      salary: (r && r.salary) || '',
      place: (r && r.note) || ''
    })) : [];
  }
  if (!Array.isArray(p.license) || !p.license.length) {
    p.license = (f.licenseType || f.licenseNo || f.licenseIssue || f.licenseExpire)
      ? [{ type: f.licenseType || '', no: f.licenseNo || '', issueDate: f.licenseIssue || '', expireDate: f.licenseExpire || '' }]
      : [{}];
  }
  const activeLic = p.license.find(r => r && (r.no || r.expireDate || r.issueDate || r.type)) || p.license[0] || {};
  f.licenseType = activeLic.type || '';
  f.licenseNo = activeLic.no || '';
  f.licenseIssue = activeLic.issueDate || '';
  f.licenseExpire = activeLic.expireDate || '';
  if (!Array.isArray(p.decor) || (!p.decor.length && Array.isArray(p.decorations) && p.decorations.length)) {
    p.decor = Array.isArray(p.decorations) ? p.decorations : [];
  }
  p.decorations = p.decor;
  if (!Array.isArray(p.training)) p.training = [];
  return p;
}
/** ตั้งค่าช่อง/ตารางพร้อมคีย์คู่รุ่นเก่า — normPersonal เติมจากคีย์เก่าเมื่อค่าใหม่ว่าง ถ้าไม่ล้างคู่ด้วย ค่าเก่าจะกลับมา (ใช้ทั้งตอนครูแก้และตอนรับค่าจาก HR) */
const P_PAIR = { altEmail: 'personalEmail', rank: 'level', standingDate: 'rankDate', salary: 'currentSalary', salaryAsOf: 'lastRaiseRound' };
function pSet(p, k, v) {
  const f = p.fields = p.fields || {};
  if (k === 'edu' || k === 'decor') { p[k] = p[k === 'edu' ? 'education' : 'decorations'] = v; return; }
  if (k === 'license') { p.license = v.length ? v : [{}]; if (!v.length) f.licenseType = f.licenseNo = f.licenseIssue = f.licenseExpire = ''; return; }
  f[k] = v; if (P_PAIR[k]) f[P_PAIR[k]] = v;
  if ((k === 'firstName' || k === 'lastName') && !String(f.firstName || '').trim() && !String(f.lastName || '').trim()) f.fullName = '';
}

/* ================= เชื่อมระบบข้อมูลบุคลากร (HR) แบบ 2 ทาง — รุ่น 2 (2026-10-22) =================
   ทำในแอปของครูแต่ละคน กับข้อมูลของตัวเองเท่านั้น · ตัวกลาง appsscript-hr-sync.gs แค่ตรวจตัวตนแล้วส่งต่อด้วยลายเซ็น (ไม่เขียน Firestore)
   รวม 2 ทางด้วยค่าที่ซิงก์ครั้งก่อน (p.hrBase): EMS เปลี่ยนฝั่งเดียว → ส่งเข้า HR · HR เปลี่ยนฝั่งเดียว → ดึงเข้า EMS
   เปลี่ยนทั้งสองฝั่ง → ใช้ค่าใน EMS (ครูเพิ่งแก้เอง) · ครั้งแรก → ใช้ค่าใน HR (ข้อมูลทางการ) เว้นแต่ HR ว่าง
   ไม่ซิงก์: เงินเดือน เลขบัตรประชาชน ประวัติรับราชการ (มีเงินเดือนในแถว) อีเมลโรงเรียน · ช่องที่ล็อก 🔒 ไม่ส่งออก (รับค่าจาก HR ได้)
   ชื่อ-สกุล: ซิงก์ในประวัติส่วนตัว แต่ไม่เปลี่ยนชื่อในระบบ — ชื่อต่างกันให้แอดมินยืนยันทีละคน (EMSAdmin · ตรวจชื่อกับ HR) */
const HR_SCALAR = ['prefix', 'firstName', 'lastName', 'position', 'standing', 'rank', 'standingDate', 'positionNo', 'appointDate', 'teacherDate',
  'phone', 'altEmail', 'address', 'birthDate'];
const HR_ROWS = { edu: ['level', 'degree', 'major', 'school', 'year'], license: ['type', 'no', 'issueDate', 'expireDate'], decor: ['cls', 'year', 'date', 'gazette'] };
const HR_SIG = { edu: ['degree', 'major', 'school', 'year'], license: ['type', 'no', 'issueDate', 'expireDate'], decor: ['cls', 'year', 'date', 'gazette'] };      // แถวที่มีข้อมูลจริง (แถวตั้งต้นที่มีแค่ระดับการศึกษาไม่นับ)
const HR_KEYS = HR_SCALAR.concat(Object.keys(HR_ROWS));
const HR_EP_OK = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
/* URL ตัวกลางอ่านจาก config.js เท่านั้น (ไม่รับจากตั้งค่าโรงเรียน — กันส่งตัวยืนยันตัวตนของครูไปเซิร์ฟเวอร์อื่น) · โหมดทดสอบไม่เชื่อม */
const hrEndpoint = () => { if (FAKE_FB) return window.__hrMock ? 'mock' : '';      // โหมดทดสอบ ?live=fake: ใช้ตัวกลางจำลอง (window.__hrMock) เท่านั้น
  const u = String((((window.EMS_CONFIG || {}).hr || {}).endpoint) || '').trim(); return LIVE && HR_EP_OK.test(u) ? u : ''; };
const hrRows = (arr, k) => (Array.isArray(arr) ? arr : []).filter(r => r && HR_SIG[k].some(c => String(r[c] == null ? '' : r[c]).trim()))
  .map(r => { const o = {}; HR_ROWS[k].forEach(c => { o[c] = String(r[c] == null ? '' : r[c]).trim(); }); return o; });
const hrVal = (k, v) => HR_ROWS[k] ? hrRows(v, k) : String(v == null ? '' : v).trim();
const hrJ = v => JSON.stringify(v);
/* คีย์เทียบชื่อ (ใช้ร่วมกับหน้าแอดมิน EMSHr.nameKey) — ตัดช่องว่าง/ํา และคำนำหน้า เพราะ staff บางคนเก็บชื่อไม่มีคำนำหน้า */
const hrNameKey = s => String(s || '').replace(/ํา/g, 'ำ').replace(/\s+/g, '').replace(/^(ว่าที่ร้อยตรี|ว่าที่ร\.ต\.|นางสาว|น\.ส\.|นาย|นาง|ครู|ดร\.)/, '');
const hrLbl = k => { const f = PF.find(x => x[1] === k), t = PT.find(x => x[0] === k); return String(f ? f[2] : t ? t[1] : k).replace(/\s*\([^)]*\)$/, ''); };
/** ค่าที่ซิงก์ได้จาก S.personal ในรูปเดียวกับที่ตัวกลางส่งมา */
function hrLocal(p) { normPersonal(p); const o = {}; HR_SCALAR.forEach(k => { o[k] = hrVal(k, p.fields[k]); }); Object.keys(HR_ROWS).forEach(k => { o[k] = hrVal(k, p[k]); }); return o; }
const hrLocked = (p, k) => PLOCK.has(k) && (p.locks || {})[k] !== false;
function hrSetLocal(p, k, v) { pSet(p, k, HR_ROWS[k] ? v.map(r => Object.assign({}, r)) : v); }

/** รวมคำนำหน้า + ชื่อ + สกุล เป็นชื่อทางการ (นายสมชาย ใจดี / ดร.สมชาย ใจดี) — ใช้เทียบกับชื่อในระบบเท่านั้น */
function computeFormalName(prefix, firstName, lastName, fallback) {
  const p = String(prefix || '').trim(), l = String(lastName || '').trim();
  let f = String(firstName || '').trim();
  if (p && f.startsWith(p + ' ')) f = f.slice(p.length).trim();      // ตัดคำนำหน้าซ้ำเฉพาะเมื่อพิมพ์แยกด้วยเว้นวรรค (ชื่อที่ขึ้นต้นด้วย “นาง…” ไม่ถูกตัด)
  if (!f && !l) return String(fallback || '').trim();
  return (p + [f, l].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
}

let hrBusy = false, hrAgain = false, hrLastTry = 0, hrAutoT = null;
async function hrCall(action, extra) {
  const url = hrEndpoint(); if (!url) throw new Error('ยังไม่ได้เชื่อมระบบข้อมูลบุคลากร (HR)');
  let idToken = '';
  try { if (window.firebase && firebase.auth && firebase.auth().currentUser) idToken = await firebase.auth().currentUser.getIdToken(); } catch (e) {}
  if (url === 'mock') { const jm = await window.__hrMock(action, extra || {}); if (!jm || !jm.ok) throw new Error((jm && jm.message) || 'เรียกระบบ HR ไม่สำเร็จ'); return jm; }      // ตรวจ ok เหมือนเส้นทางจริง
  if (!idToken) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ idToken, action }, extra || {})) });
  const json = await res.json().catch(() => ({ ok: false, message: 'ตัวกลาง HR ไม่ได้ตอบกลับเป็น JSON (HTTP ' + res.status + ')' }));
  if (!json || !json.ok) throw new Error((json && json.message) || 'เรียกระบบ HR ไม่สำเร็จ');
  return json;
}
/** ซิงก์ 2 ทางของตัวเอง · manual = กดเอง (แจ้งผลทุกครั้ง) */
async function hrSync(manual) {
  if (!hrEndpoint() || !S.personal) { if (manual) toast('ยังไม่ได้เชื่อมระบบข้อมูลบุคลากร (HR)'); return; }
  if (hrBusy) { if (manual) { hrAgain = 'manual'; toast('กำลังซิงก์อยู่ — จะซิงก์อีกรอบให้'); } else hrAgain = hrAgain || true; return; }      // กำลังซิงก์อยู่ = จำไว้ ส่งรอบใหม่หลังรอบนี้จบ (กดเอง = ซิงก์ต่อทันทีและแจ้งผล)
  hrBusy = true; hrLastTry = Date.now();
  try {
    if (manual) toast('กำลังซิงก์กับระบบข้อมูลบุคลากร…');
    const remote = (await hrCall('person')).data || {}, p = S.personal, local = hrLocal(p), base = p.hrBase || null, nb = Object.assign({}, base || {}), push = {}, pulls = {};
    const rej = p.hrRej = p.hrRej || {};      // ช่องที่ HR ไม่รับ: { ช่อง: ค่าที่ส่งไป } — ไม่ส่งซ้ำจนกว่าครูจะแก้ค่าใหม่
    let pulled = 0;
    HR_KEYS.forEach(k => {
      if (remote[k] === undefined) return;                              // HR ไม่ส่งช่องนี้มา (ไม่มีสิทธิ์อ่าน) — ไม่แตะ
      const L = local[k], R = hrVal(k, remote[k]), B = base && base[k] !== undefined ? base[k] : undefined, E = hrJ(HR_ROWS[k] ? [] : '');
      if (rej[k] !== undefined && rej[k] !== hrJ(L)) delete rej[k];
      if (hrJ(L) === hrJ(R)) { nb[k] = R; delete rej[k]; return; }
      if (B === undefined && hrLocked(p, k) && hrJ(L) !== E) { nb[k] = R; return; }      // ครั้งแรก + ช่องล็อกที่ครูกรอกไว้: คงค่าของครู ไม่ดึงจาก HR
      const lc = B === undefined || hrJ(L) !== hrJ(B), rc = B === undefined || hrJ(R) !== hrJ(B);
      const pushIt = B === undefined ? hrJ(R) === E : (lc && !rc) || (lc && rc);      // ครั้งแรก: ใช้ค่า HR เว้นแต่ HR ว่าง · เปลี่ยนทั้งคู่: ใช้ค่าใน EMS
      if (pushIt && rej[k] !== undefined && B !== undefined && rc) { delete rej[k]; hrSetLocal(p, k, R); nb[k] = pulls[k] = R; pulled++; return; }  // HR เคยไม่รับ แล้วฝ่ายบุคคลแก้/จัดรูปแบบค่าใน HR → ใช้ค่าทางการจาก HR
      if (pushIt) { if (hrLocked(p, k) || rej[k] !== undefined) return; push[k] = L; return; }  // ช่องล็อก/HR เคยไม่รับ: ไม่ส่งออก และไม่ทับค่าที่ครูแก้ (ค่าที่ซิงก์ครั้งก่อนคงเดิม)
      if (!(B === undefined || !lc)) return;
      delete rej[k]; hrSetLocal(p, k, R); nb[k] = pulls[k] = R; pulled++;
    });
    const keys = Object.keys(push), bad = []; let upErr = '';
    if (keys.length) {
      try { const ru = await hrCall('update', { fields: push }), back = ru && ru.data && typeof ru.data === 'object' ? ru.data : null;
        /* ตัวกลางรุ่นใหม่คืนข้อมูลหลังบันทึก: ช่องที่ HR ข้ามหรือบันทึกเป็นค่าอื่น → คงค่าใน EMS ไม่ขยับค่าครั้งก่อน · ตัวกลางรุ่นเก่า (ไม่คืน data) = ถือว่ารับทุกช่อง */
        keys.forEach(k => { if (!back || back[k] === undefined || hrJ(hrVal(k, back[k])) === hrJ(push[k])) nb[k] = push[k]; else { rej[k] = hrJ(push[k]); bad.push(k); } });
      } catch (e) { upErr = (e && e.message) || 'เรียกระบบ HR ไม่สำเร็จ'; }      // ส่งไม่สำเร็จ = ค่าครั้งก่อนคงเดิม รอบหน้าส่งใหม่ · ค่าที่รับมาแล้วยังบันทึก
    }
    /* ระหว่างรอ HR สำเนาในเครื่องอาจถูกแทนด้วยตัวใหม่ (บันทึก/โหลดจากคลาวด์) → เขียนผลลงตัวปัจจุบัน · ค่าที่รับมาใส่ซ้ำเฉพาะช่องที่ครูไม่ได้แก้ระหว่างนั้น */
    const q = S.personal || p;
    if (q !== p) { const ql = hrLocal(q); Object.keys(pulls).forEach(k => { if (hrJ(ql[k]) === hrJ(local[k])) hrSetLocal(q, k, pulls[k]); }); q.hrRej = rej; }
    normPersonal(q);
    const formal = computeFormalName(q.fields.prefix, q.fields.firstName, q.fields.lastName);
    q.hrNameDiff = formal && S.me && hrNameKey(formal) !== hrNameKey(S.me.name) ? formal : '';
    if (Array.isArray(remote.teach)) q.teachHist = remote.teach;      // ประวัติการสอนที่ HR เก็บไว้ (แสดงในแท็บประวัติการสอน)
    q.hrBase = nb; q.hrSyncedAt = new Date().toISOString(); save();
    /* ประวัติการสอนภาคเรียนนี้ (จากตารางสอน) → HR · ส่งเมื่อเปลี่ยนจากครั้งก่อนเท่านั้น · HR รุ่นเก่า/ตัวกลางรุ่นเก่าไม่รับ = ลองใหม่รอบหน้า ไม่แจ้งครู */
    const tr = psTeachRow(), tsig = tr && hrJ(tr);
    if (tr && q.hrTeachSent !== tsig) { try { const ru = await hrCall('update', { fields: { teach: [tr] } }); q.hrTeachSent = tsig;
      if (ru && ru.data && Array.isArray(ru.data.teach)) q.teachHist = ru.data.teach; save(); hrRedraw(); } catch (e) {} }
    if (pulled || manual || bad.length) hrRedraw();
    const sent = upErr ? 0 : keys.length - bad.length;
    if (bad.length) toast('ระบบ HR ไม่รับช่อง ' + bad.map(hrLbl).join(', ') + ' — ค่าใน EMS คงเดิม (แจ้งฝ่ายบุคคลแก้ในระบบ HR)');
    else if (upErr && (manual || pulled)) toast('ส่งค่าที่แก้ไม่สำเร็จ: ' + upErr + (pulled ? ' · รับค่าใหม่ ' + pulled + ' ช่องแล้ว' : ''));
    else if (manual || pulled) toast('ซิงก์กับระบบ HR แล้ว' + (pulled ? ' · รับค่าใหม่ ' + pulled + ' ช่อง' : '') + (sent ? ' · ส่งค่าที่แก้ ' + sent + ' ช่อง' : '') + (!pulled && !keys.length ? ' · ข้อมูลตรงกันแล้ว' : ''));
  } catch (e) { if (manual && e && e.message) toast('ซิงก์ไม่สำเร็จ: ' + e.message); }
  finally { hrBusy = false; if (hrAgain) { const m = hrAgain === 'manual'; hrAgain = false; if (m) setTimeout(() => hrSync(true), 0); else hrSchedulePush(); } }
}
/* รับค่าใหม่ขณะครูกำลังพิมพ์ในฟอร์มประวัติ → วาดหน้าใหม่หลังออกจากช่อง (ไม่ให้ข้อความที่พิมพ์หาย) */
function hrRedraw() { const a = document.activeElement; if (!(a && a.matches && a.matches('[data-m2f]'))) return redraw(); a.addEventListener('blur', () => setTimeout(hrRedraw, 0), { once: true }); }
/* แก้ช่องในประวัติส่วนตัว → ซิงก์หลังหยุดพิมพ์ 4 วินาที · เปิดหน้าประวัติส่วนตัว → ซิงก์ถ้าครั้งล่าสุดเกิน 10 นาที */
function hrSchedulePush() { if (!hrEndpoint()) return; clearTimeout(hrAutoT); hrAutoT = setTimeout(() => hrSync(false), 4000); }
function hrAuto() { if (hrEndpoint() && !hrBusy && Date.now() - hrLastTry > 6e5) setTimeout(() => hrSync(false), 0); }
const hrCard = p => { if (!hrEndpoint()) return '';
  const t = p.hrSyncedAt ? new Date(p.hrSyncedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : 'ยังไม่เคย';
  return `<div class="notice" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px"><div class="grow"><b>เชื่อมกับระบบข้อมูลบุคลากรของโรงเรียน</b> · ซิงก์ล่าสุด ${esc(t)}
    <div class="small">แก้ที่ไหน อีกที่แก้ตามให้ · ช่อง 🔒 ไม่ส่งออก · ไม่ซิงก์เงินเดือน เลขบัตรประชาชน และประวัติรับราชการ</div>
    ${p.hrNameDiff ? `<div class="small" style="color:var(--bad)">ชื่อในประวัติ “${esc(p.hrNameDiff)}” ต่างจากชื่อในระบบ “${esc(S.me.name)}” — แจ้งแอดมินเปลี่ยนให้ (ระบบไม่เปลี่ยนชื่อเอง เพื่อไม่ให้ตารางสอนและใบลาหลุด)</div>` : ''}
    ${Object.keys(p.hrRej || {}).length ? `<div class="small" style="color:var(--warn)">ระบบ HR ไม่รับช่อง ${esc(Object.keys(p.hrRej).map(hrLbl).join(', '))} — ค่าใน EMS คงเดิม ไม่ส่งซ้ำจนกว่าจะแก้ค่าใหม่ (แจ้งฝ่ายบุคคลแก้ในระบบ HR)</div>` : ''}</div>
    <button class="btn sm" data-m2="hrSyncNow">${ic('cloud')}ซิงก์ตอนนี้</button></div>`; };
window.EMSHr = { norm: normPersonal, computeFormalName, call: hrCall, endpoint: hrEndpoint, sync: hrSync, nameKey: hrNameKey };

const pin = (k, f, v, locked) => { const [sec, key, label, type, opts] = f;
  const attr = `data-m2f="pf" data-k="${key}"`;
  if (type === 'multi') { const on = String(v || '').split(',').filter(Boolean);
    return `<div class="pills" id="pf-${key}" role="group" aria-label="${esc(label)}">${opts.map(o => `<label class="pill" style="cursor:pointer"><input type="checkbox" data-m2f="pfm" data-k="${key}" value="${esc(o)}" ${on.includes(o) ? 'checked' : ''} style="accent-color:var(--brand)"> ${esc(o)}</label>`).join('')}</div>`; }
  if (type === 'list') return `<input class="in" id="pf-${key}" list="pf-${key}-l" ${attr} value="${esc(v || '')}" placeholder="เลือกหรือพิมพ์เอง เช่น ฟิสิกส์"><datalist id="pf-${key}-l">${opts.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
  if (type === 'select') return `<select class="in" id="pf-${key}" ${attr}>${psOpts(opts, v)}</select>`;
  const x = PFX[key] || {}, ex = (x.ph ? ` placeholder="${esc(x.ph)}"` : '') + (x.im ? ` inputmode="${x.im}"` : '') + (x.ac ? ` autocomplete="${x.ac}"` : '') + (x.max ? ` maxlength="${x.max}"` : '');
  if (x.area) return `<textarea class="in" id="pf-${key}" rows="2" ${attr}${ex}>${esc(v || '')}</textarea>`;
  const el = `<input class="in" id="pf-${key}" type="${x.type || (type === 'number' ? 'number' : type || 'text')}" ${attr}${ex} value="${esc(v || '')}">`;
  return x.suf ? `<div class="ps-affix">${el}<span>${x.suf}</span></div>` : el; };
/* หน้าตาช่องกรอกประวัติส่วนตัว (แสดงผลอย่างเดียว ไม่แตะชื่อช่อง/โครงข้อมูลที่ซิงก์กับ HR): ตัวอย่างในช่อง คำอธิบายใต้ช่อง ชนิดแป้นพิมพ์มือถือ ช่องเต็มแถว */
const PFX = {
  prefix: { span: 2 }, firstName: { ph: 'ชื่อจริง', ac: 'given-name', span: 5 }, lastName: { ph: 'นามสกุล', ac: 'family-name', span: 5 },
  schoolEmail: { ph: 'ชื่อ@pcschool.ac.th', ac: 'email', span: 6 }, positionNo: { ph: 'ตามคำสั่งแต่งตั้ง', im: 'numeric', span: 4 },
  position: { span: 3 }, standing: { span: 3 }, rank: { span: 3 },
  standingDate: { lbl: 'วันที่ได้รับวิทยฐานะ', hint: 'วันที่มีผลตามคำสั่งล่าสุด', span: 3 }, appointDate: { hint: 'ใช้คำนวณอายุราชการ', span: 4 },
  teacherDate: { lbl: 'วันที่ดำรงตำแหน่งครู', hint: 'วันที่พ้นครูผู้ช่วย / ได้รับแต่งตั้งเป็นครู', span: 4 },
  phone: { ph: '08x-xxx-xxxx', type: 'tel', im: 'tel', ac: 'tel' }, altEmail: { ph: 'name@gmail.com', ac: 'email' },
  address: { ph: 'บ้านเลขที่ หมู่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์', area: 1, wide: 1, ac: 'street-address' },
  birthDate: { hint: 'ใช้คำนวณอายุและปีเกษียณ' }, nationalId: { ph: 'ตัวเลข 13 หลัก', im: 'numeric', max: 17, ac: 'off' },
  salary: { ph: '0', im: 'decimal', suf: 'บาท' }, salaryAsOf: { ph: 'เช่น 1 ต.ค. 2569 หรือ รอบเมษายน 2569' },
  teachLevels: { wide: 1, hint: 'เลือกได้หลายชั้น' }, teachMajor: { wide: 1 }
};
/* ความกว้างคอลัมน์ตารางประวัติ: ช่องตัวเลข (ปี ชั่วโมง) แคบ ให้ช่องข้อความยาวอย่างชื่อวุฒิกว้างขึ้น */
const PSW = { 'edu.level': '18%', 'edu.degree': '34%', 'edu.year': '96px' };
/* การ์ดใบอนุญาต: เวลาที่เหลือเป็น ปี เดือน วัน (นับตามปฏิทิน) + วันหมดอายุ + จำนวนวัน · สีตามความเร่งด่วน (เกิน 1 ปี เขียว · ไม่ถึง 1 ปี ส้ม · ไม่ถึง 6 เดือน/หมดแล้ว แดง) */
const ymdDiff = (a, b) => { let mm = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(), at;
  const step = n => new Date(a.getFullYear(), a.getMonth() + n, Math.min(a.getDate(), new Date(a.getFullYear(), a.getMonth() + n + 1, 0).getDate()));
  if ((at = step(mm)) > b) at = step(--mm);
  const y = Math.floor(mm / 12), m = mm % 12, d = Math.round((b - at) / 864e5);
  return [y && y + ' ปี', m && m + ' เดือน', d && d + ' วัน'].filter(Boolean).join(' ') || '0 วัน'; };
const licKpi = (exp, left) => { const e = exp && dayOf(exp);
  if (!e) return `<div class="card kpi"><div class="l">ใบอนุญาตประกอบวิชาชีพ</div><div class="v">–</div><div class="s muted">ยังไม่ได้กรอกวันหมดอายุ (แท็บใบอนุญาต)</div></div>`;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const c = left < 0 || left < 183 ? 'bad' : left < 365 ? 'warn' : 'ok', dt = e.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  return `<div class="card kpi ps-lic ${c}"><div class="l">${left < 0 ? 'ใบอนุญาตหมดอายุแล้ว' : 'ใบอนุญาตหมดอายุในอีก'}</div>
    <div class="v">${left < 0 ? 'เกินมา ' + ymdDiff(e, t) : left === 0 ? 'วันนี้' : ymdDiff(t, e)}</div>
    <div class="s"><span class="ps-lic-b">${left < 0 ? 'หมดอายุแล้ว' : c === 'bad' ? 'ควรยื่นต่ออายุ' : c === 'warn' ? 'ใกล้หมดอายุ' : 'ใช้งานได้'}</span> หมดอายุ ${dt}${left >= 0 ? ` · อีก ${left.toLocaleString('th-TH')} วัน` : ''}</div></div>`; };
/* แท็บหน้าประวัติ: ไอคอน + ความคืบหน้าการกรอก (ช่องที่มีค่า + ตารางที่มีอย่างน้อย 1 แถวที่มีข้อมูล) */
const psSvg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const PS_IC = { basic: psSvg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'), contact: psSvg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  money: psSvg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9.5v5M17 9.5v5"/>'), edu: psSvg('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>'),
  lic: psSvg('<circle cx="12" cy="9" r="5"/><path d="M9 13.5L8 21l4-2 4 2-1-7.5"/>'), teach: psSvg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20l4-4 4 4M7 8h6M7 11h4"/>') };
const PS_OK = psSvg('<path d="M5 12.5l4.5 4.5L19 7.5"/>');
const psRowHas = r => r && Object.keys(r).some(c => c !== 'level' && String(r[c] == null ? '' : r[c]).trim());
const psFill = (p, keys) => keys.reduce(([a, b], k) => { if (SECT[k]) { const fs = PF.filter(x => x[0] === k); return [a + fs.filter(x => String(p.fields[x[1]] || '').trim()).length, b + fs.length]; }
  return [a + ((p[k] || []).some(psRowHas) ? 1 : 0), b + 1]; }, [0, 0]);
/* การสอนใน EMS ← ตารางสอนภาคเรียนปัจจุบัน: ชั้นปีจากชื่อห้อง (ม.x) · สาขาจากชื่อรายวิชาที่ตรงกับรายการสาขา (นับตามคาบ) ไม่เจอใช้กลุ่มสาระจากอักษรนำรหัสวิชา */
const PS_CODE = { 'ท': 'ภาษาไทย', 'ค': 'คณิตศาสตร์', 'ว': 'วิทยาศาสตร์ทั่วไป', 'ส': 'สังคมศึกษา', 'พ': 'สุขศึกษาและพลศึกษา', 'ศ': 'ทัศนศิลป์', 'ง': 'การงานอาชีพ', 'อ': 'ภาษาอังกฤษ', 'จ': 'ภาษาจีน', 'ญ': 'ภาษาญี่ปุ่น', 'ก': 'ภาษาเกาหลี', 'ฝ': 'ภาษาฝรั่งเศส' };
function psFromTT() {
  const majors = (PF.find(x => x[1] === 'teachMajor') || [])[4] || [], lv = new Set(), rooms = new Set(), subj = {}, hit = {};
  let n = 0;
  Object.entries(S.tt || {}).forEach(([k, cid]) => { const c = cid && S.classes.find(x => x.id === cid); if (!c) return; n++;
    const m = String(c.name).match(/ม\.\s?([1-6])/); if (m) lv.add('ม.' + m[1]); rooms.add(String(c.name));
    const sj = String((S.ttSub || {})[k] || c.subject || '').trim(); if (!sj) return; subj[sj] = (subj[sj] || 0) + 1;
    const mj = majors.find(o => o && sj.includes(o.split(' ')[0])) || PS_CODE[(sj.match(/^([ก-ฮ])\d/) || [])[1]]; if (mj) hit[mj] = (hit[mj] || 0) + 1; });
  return { levels: [...lv].sort(), rooms: [...rooms].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })), subjects: Object.keys(subj), periods: n, major: Object.keys(hit).sort((a, b) => hit[b] - hit[a])[0] || '' };
}
/** แถวประวัติการสอนของภาคเรียนปัจจุบัน (ส่งเข้า HR ชุด teach · HR เก็บ 1 แถว/ภาคเรียน) */
const psTeachRow = () => { const t = psFromTT(); if (!t.periods || !S.term || !S.term.year) return null;
  return { year: String(S.term.year), sem: String(S.term.sem), levels: t.levels.join(','), subjects: t.subjects.join('|'), rooms: t.rooms.join(','), periods: String(t.periods), major: t.major }; };
function psApplyTT(p, force) { const t = psFromTT(), f = p.fields;
  if (t.levels.length && (force || !f.teachLevels)) f.teachLevels = t.levels.join(',');
  if (t.major && (force || !f.teachMajor)) f.teachMajor = t.major; }
const psTTBox = f => { const t = psFromTT(); if (!t.periods) return '<div class="ps-tt muted small">ยังไม่มีตารางสอนในภาคเรียนนี้ · กรอกเองได้ หรือจัดตารางสอนก่อนแล้วกลับมากดดึงข้อมูล</div>';
  const same = t.levels.join(',') === String(f.teachLevels || '') && (!t.major || t.major === f.teachMajor);
  return `<div class="ps-tt"><div class="grow"><b>จากตารางสอน ภาคเรียนที่ ${esc(S.term.sem)}/${esc(S.term.year)}</b>
    <div class="muted small">${t.levels.join(' · ') || '–'} · ${t.subjects.length} รายวิชา · ${t.periods} คาบ/สัปดาห์${t.subjects.length ? `<br>${t.subjects.slice(0, 4).map(esc).join(', ')}${t.subjects.length > 4 ? ' …' : ''}` : ''}</div></div>
    ${same ? '<span class="ps-tt-ok">✓ ตรงกับตารางสอน</span>' : '<button type="button" class="btn sm" data-m2="psFromTT">ดึงข้อมูลจากตารางสอน</button>'}</div>`; };
/* ประวัติการสอนรายภาคเรียนที่เก็บใน HR (ได้มาตอนซิงก์ · p.teachHist) — แสดงอย่างเดียว */
const psTeachHist = p => { const rows = (Array.isArray(p.teachHist) ? p.teachHist : []).slice().sort((a, b) => (+b.year - +a.year) || (+b.sem - +a.sem));
  return `<div class="card ps-card"><h2>ประวัติการสอนรายภาคเรียน</h2><p class="muted small" style="margin:-6px 0 12px">บันทึกในระบบข้อมูลบุคลากร (HR) เองทุกภาคเรียน จากตารางสอนใน EMS · แก้ไม่ได้ที่นี่</p>
    ${rows.length ? `<div class="scroll"><table class="tbl ps-tbl"><thead><tr><th>ภาคเรียน</th><th>ชั้นปี</th><th>รายวิชา</th><th>ห้อง</th><th style="text-align:right">คาบ/สัปดาห์</th></tr></thead><tbody>${rows.map(r =>
      `<tr><td data-label="ภาคเรียน" style="white-space:nowrap"><b>${esc(r.sem)}/${esc(r.year)}</b>${r.major ? `<div class="muted small">${esc(r.major)}</div>` : ''}</td><td data-label="ชั้นปี">${esc(String(r.levels || '').split(',').join(', '))}</td>
       <td data-label="รายวิชา" class="small">${esc(String(r.subjects || '').split('|').join(', '))}</td><td data-label="ห้อง" class="small">${esc(String(r.rooms || '').split(',').join(', '))}</td><td data-label="คาบ/สัปดาห์" style="text-align:right">${esc(r.periods)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty">ยังไม่มีประวัติ · จะขึ้นหลังซิงก์กับระบบ HR ครั้งถัดไป</div>'}</div>`; };
/* หมวดข้อมูลพื้นฐาน แบ่งเป็นหัวข้อย่อย วางบนตาราง 12 ช่อง (span ใน PFX) */
const PSG = { basic: [['ชื่อ-สกุล', ['prefix', 'firstName', 'lastName', 'schoolEmail']], ['ตำแหน่งและวิทยฐานะ', ['position', 'standing', 'rank', 'standingDate']], ['การรับราชการ', ['positionNo', 'appointDate', 'teacherDate']]] };
const psLbl = t => String(t).replace(/\s*\((?:[a-zA-Z]+\.)?[a-zA-Z]+\)\s*$/, '');   // ตัดชื่อคีย์ HR ท้ายป้าย เช่น (standing) (history.edu)
const psOpts = (opts, v) => opts.map(o => o ? `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>` : `<option value="" ${v ? '' : 'selected'}>— เลือก —</option>`).join('');
(() => { const st = document.createElement('style'); st.id = 'ems-ps-form'; st.textContent = `
.ps-pane .ps-card h2{padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--line)}
.ps-pane .ps-card .row h2{padding:0;border:0}
.ps-pane .grid.g2{column-gap:20px;row-gap:4px}
.ps-pane .ps-wide{grid-column:1/-1}
.ps-lic .v{font-size:1.6rem}
.ps-lic .s{display:flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--muted)}
.ps-lic-b{display:inline-flex;align-items:center;gap:5px;padding:1px 9px;border-radius:99px;font-size:.74rem;font-weight:700;background:var(--ok-soft,#e8f5ee);color:var(--ok)}
.ps-lic-b::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.ps-lic.warn .ps-lic-b{background:var(--warn-soft,#fdf3e1);color:var(--warn)}
.ps-lic.bad .ps-lic-b{background:var(--bad-soft);color:var(--bad)}.ps-lic.bad .v{color:var(--bad)}
.ps-tt{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;margin:0 0 16px;border-radius:12px;background:var(--surface2);border:1px dashed var(--line-2);line-height:1.5}
.ps-tt .grow{flex:1 1 220px;min-width:0}
.ps-tt-ok{font-size:.8rem;font-weight:700;color:var(--ok)}
.ps-sub{display:flex;align-items:center;gap:10px;margin:6px 0 12px;font-size:.8rem;font-weight:700;color:var(--brand);letter-spacing:0}
.ps-sub::after{content:"";flex:1;height:1px;background:var(--line)}
.ps-g + .ps-sub{margin-top:14px}
.ps-g{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:20px;row-gap:4px;align-items:start}
.ps-g > .field{grid-column:span 6}.ps-g > .ps-s2{grid-column:span 2}.ps-g > .ps-s4{grid-column:span 4}.ps-g > .ps-s5{grid-column:span 5}.ps-g > .ps-s6{grid-column:span 6}
.ps-g > .ps-s3{grid-column:span 3}
.ps-card{container-type:inline-size}
@container (max-width:860px){.ps-g > .field{grid-column:span 6!important}.ps-g > .ps-s2{grid-column:span 4!important}.ps-g > .ps-s2 + .ps-s5{grid-column:span 8!important}}
@container (max-width:520px){.ps-g > .field,.ps-g > .ps-s2 + .ps-s5{grid-column:1/-1!important}}
.ps-lbl{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px;margin-bottom:6px}
.ps-lbl label.f{margin:0;color:var(--text)}
.ps-lock{flex:none;display:inline-flex;align-items:center;gap:3px;border:1px solid var(--line);background:var(--surface2);color:var(--muted);border-radius:99px;padding:1px 10px;font:600 .74rem/1.7 inherit;cursor:pointer;transition:background .15s,color .15s,border-color .15s}
.ps-lock:hover{border-color:var(--line-2);color:var(--text)}
.ps-lock.on{background:var(--brand-soft);border-color:color-mix(in srgb,var(--brand) 25%,transparent);color:var(--brand)}
.ps-lock:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(var(--brand-rgb),.25)}
.ps-hint{margin-top:5px;font-size:.8rem;color:var(--muted);line-height:1.45}
.ps-pane .in{border-width:1px;border-color:var(--line-2);border-radius:10px}
.ps-pane .in:hover:not(:focus){border-color:color-mix(in srgb,var(--text) 30%,transparent)}
.ps-pane .in:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.16)}
.ps-pane .in::placeholder{color:var(--muted);opacity:.65;font-weight:400}
.ps-pane textarea.in{min-height:72px;line-height:1.55}
.ps-pane select.in{appearance:none;-webkit-appearance:none;padding-right:38px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%2394a0b2' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
.ps-pane select.in:has(option[value=""]:checked){color:var(--muted)}
.ps-pane select.in option{color:var(--text)}
.ps-affix{position:relative}.ps-affix .in{padding-right:54px}
.ps-affix span{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:.88rem;pointer-events:none}
.ps-pane input[type=number]{-moz-appearance:textfield}.ps-pane input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
.ps-pane .pills{display:flex;flex-wrap:wrap;gap:8px}
.ps-pane .pill:has(input:checked){background:var(--brand-soft);border-color:color-mix(in srgb,var(--brand) 35%,transparent);color:var(--brand);font-weight:600}
.ps-tbl th{padding:8px 6px}.ps-tbl td{padding:6px 4px}
.tbl.ps-tbl .in{width:100%;min-height:40px;padding:6px 10px;text-align:left}
.ps-tbl td.ps-del{width:1%;white-space:nowrap}
@media (max-width:640px){
  .ps-tbl,.ps-tbl tbody,.ps-tbl tr,.ps-tbl td{display:block;width:100%}
  .ps-tbl thead{display:none}
  .ps-tbl tr{border:1px solid var(--line);border-radius:12px;padding:6px 12px 10px;margin-bottom:12px;background:var(--surface2)}
  .ps-tbl td{border:0;padding:6px 0}
  .ps-tbl td[data-label]::before{content:attr(data-label);display:block;font-size:.78rem;font-weight:600;color:var(--muted);margin-bottom:4px}
  .tbl.ps-tbl .in{min-width:0!important;min-height:46px}
  .ps-tbl td.ps-del{width:auto;text-align:right;padding-bottom:0}
}`; document.head.appendChild(st); })();
/* แท็บหน้าประวัติส่วนตัว: [id, ชื่อแท็บ, หมวด (SECT) / ตาราง (PT) ตามลำดับที่แสดง] · สลับแท็บแค่ซ่อน/แสดง ไม่วาดใหม่ */
/* ตารางประวัติรับราชการไม่แสดงคอลัมน์อัตราเงินเดือนแล้ว (ค่าเดิมในแถวยังเก็บไว้ ไม่ลบ) */
const PS_TABS = [['basic', 'ข้อมูลพื้นฐาน', ['basic']], ['contact', 'ติดต่อ · ส่วนบุคคล', ['contact', 'personal']], ['money', 'เงินเดือน · รับราชการ', ['salary', 'career']],
  ['edu', 'การศึกษา · อบรม', ['edu', 'training']], ['lic', 'ใบอนุญาต · เครื่องราชฯ', ['license', 'decor']], ['teach', 'ประวัติการสอน', ['teach']]];
let psTab = (() => { try { return sessionStorage.getItem('ems-ps-tab') || 'basic'; } catch (e) { return 'basic'; } })();
/* จอแคบแถบแท็บเลื่อนได้ → เลื่อนให้แท็บที่เลือกอยู่ในจอเสมอ */
const psTabShow = () => { const b = document.querySelector('.ps-tab[aria-selected="true"]'), bar = b && b.parentElement; if (bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: Math.max(0, b.offsetLeft - bar.offsetLeft - 16), behavior: 'smooth' }); };
P.personal = () => {
  const p = normPersonal(S.personal), f = p.fields, svc = yearsBetween(f.appointDate), age = yearsBetween(f.birthDate);
  const exp = f.licenseExpire, left = exp ? Math.round((dayOf(exp) - new Date()) / 86400000) : null;
  hrAuto();
  const fld = x => { const lk = PLOCK.has(x[1]), on = lk ? p.locks[x[1]] !== false : false, fx = PFX[x[1]] || {};
        return `<div class="field${fx.wide ? ' ps-wide' : ''}${fx.span ? ' ps-s' + fx.span : ''}"><div class="ps-lbl"><label class="f" for="pf-${x[1]}">${esc(fx.lbl || psLbl(x[2]))}</label>${lk ? `<button type="button" class="ps-lock${on ? ' on' : ''}" data-m2="psLock" data-k="${x[1]}" aria-pressed="${on}" title="${on ? 'ล็อกอยู่: ไม่แสดงในหน้าข้อมูลบุคลากรของฝ่ายบุคคล · แตะเพื่อเปิดเผย' : 'เปิดเผยต่อฝ่ายบุคคล · แตะเพื่อล็อก'}">${on ? '🔒 ส่วนตัว' : '🔓 เปิดเผย'}</button>` : ''}</div>${pin(x[1], x, f[x[1]], on)}${fx.hint ? `<div class="ps-hint">${fx.hint}</div>` : ''}</div>`; };
  const secCard = (sec, title) => `<div class="card ps-card"><h2>${esc(psLbl(title))}</h2>${sec === 'teach' ? psTTBox(f) : ''}${PSG[sec]
    ? PSG[sec].map(([t, ks]) => `<div class="ps-sub">${t}</div><div class="ps-g">${ks.map(k => fld(PF.find(x => x[1] === k))).join('')}</div>`).join('')
    : `<div class="grid g2">${PF.filter(x => x[0] === sec).map(fld).join('')}</div>`}</div>${sec === 'teach' ? psTeachHist(p) : ''}`;
  const tblCard = (k, title, cols) => `<div class="card ps-card"><div class="row" style="border:0;padding-top:0"><h2 style="margin:0">${esc(psLbl(title))}</h2><span class="grow"></span><button class="btn sm" data-m2="rowAdd" data-t="${k}">+ เพิ่มแถว</button></div>
      ${k === 'license' ? '<p class="muted small" style="margin:0 0 8px">ใบอนุญาตมีอายุ 5 ปี กรอกวันออกใบอนุญาตแล้วระบบเติมวันหมดอายุให้อัตโนมัติ · แก้ = แทนทั้งชุดใน HR</p>' : ''}
      ${(p[k] || []).length ? `<div class="scroll"><table class="tbl ps-tbl"><thead><tr>${cols.map(c => `<th${PSW[k + '.' + c[0]] || c[2] === 'number' ? ` style="width:${PSW[k + '.' + c[0]] || '96px'}"` : ''}>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${p[k].map((row, i) => `<tr>${cols.map(c => `<td data-label="${esc(c[1])}">${c[2] === 'select' ? `<select class="in" style="min-width:180px" data-m2f="pc" data-t="${k}" data-i="${i}" data-k="${c[0]}" aria-label="${esc(c[1])}">${psOpts(c[3], row[c[0]])}</select>` : `<input class="in" style="min-width:${c[2] === 'date' ? 140 : c[2] === 'number' ? 76 : 120}px" type="${c[2] === 'number' ? 'number' : c[2] || 'text'}"${c[2] === 'number' ? ' inputmode="decimal"' : ''} data-m2f="pc" data-t="${k}" data-i="${i}" data-k="${c[0]}" aria-label="${esc(c[1])}" value="${esc(row[c[0]] || '')}">`}</td>`).join('')}<td class="ps-del"><button class="btn sm ghost" style="color:var(--bad)" data-m2="rowDel" data-t="${k}" data-i="${i}" aria-label="ลบแถวที่ ${i + 1}">ลบ</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีข้อมูล</div>'}</div>`;
  if (!f.teachLevels && !f.teachMajor && psFromTT().levels.length) psApplyTT(p);   // ยังไม่เคยกรอก → เติมจากตารางสอนให้เลย
  const tab = PS_TABS.some(t => t[0] === psTab) ? psTab : 'basic';
  setTimeout(psTabShow, 0);
  return hd('ประวัติส่วนตัว', 'โครงร่างมาตรฐาน HR API (basic · contact · personal · salary · history) · ช่องที่ล็อก 🔒 จะไม่แสดงต่อผู้อื่นในหน้าสรุปข้อมูลบุคลากร',
      `<button class="btn" data-m2="psBackup">${ic('cloud')}สำรองลง Drive</button>`) + hrCard(p) +
    `<div class="grid g3">${kpi('อายุ', age ? age.y + ' ปี' : '–')}${kpi('อายุราชการ', svc ? svc.y + ' ปี ' + svc.m + ' เดือน' : '–')}${licKpi(exp, left)}</div>` +
    `<div class="ps-tabhead"><b>หมวดข้อมูลประวัติ</b><span>${PS_TABS.length} หมวด · แตะการ์ดเพื่อสลับหมวด กรอกให้ครบทุกหมวด</span></div>` +
    `<div class="ps-tabs" role="tablist" aria-label="หมวดประวัติ">${PS_TABS.map(([id, label, keys], i) => { const [a, b] = psFill(p, keys), warn = id === 'lic' && left !== null && left < 183, done = a >= b;
      return `<button class="ps-tab${done ? ' done' : ''}" role="tab" aria-selected="${id === tab}" data-m2="psTab" data-k="${id}">
        <span class="ps-ti">${done ? PS_OK : PS_IC[id]}</span><span class="ps-tl"><b>${label}</b><small>${done ? 'กรอกครบแล้ว' : `กรอกแล้ว ${a}/${b}`}</small></span>
        ${warn ? '<span class="ps-warn" title="ใบอนุญาตใกล้หมดอายุ"></span>' : ''}<i class="ps-bar" style="--p:${Math.round(a * 100 / (b || 1))}%"></i></button>`; }).join('')}</div>` +
    PS_TABS.map(([id, , keys], i) => { const pv = PS_TABS[i - 1], nx = PS_TABS[i + 1];
      return `<div class="ps-pane" role="tabpanel" data-pane="${id}" ${id === tab ? '' : 'hidden'}>${keys.map(k => SECT[k] ? secCard(k, SECT[k]) : (t => tblCard(t[0], t[1], t[0] === 'career' ? t[2].filter(c => c[0] !== 'salary') : t[2]))(PT.find(x => x[0] === k))).join('')}
        <div class="ps-next">${pv ? `<button class="btn" data-m2="psTab" data-k="${pv[0]}" data-go="1">‹ ${pv[1]}</button>` : '<span></span>'}${nx ? `<button class="btn pri" data-m2="psTab" data-k="${nx[0]}" data-go="1">หมวดถัดไป: ${nx[1]} ›</button>` : ''}</div></div>`; }).join('');
};

/* ================= แก้ตารางสอน + เวลาคาบ ================= */
let ttEdit = false;
P.schedule = () => {
  const di = dayIdx(), np = nowPeriod(), nCov = Object.keys(S.ttCover || {}).filter(k => S.tt[k]).length;   // คาบที่รับไว้แทนตำแหน่งว่าง (สีส้ม)
  const duAt = (d, p) => (window.EMSAdmin && EMSAdmin.dutiesAt) ? EMSAdmin.dutiesAt(S.me.name, d, p) : [];
  let mtgN = 0, exN = 0, actN = 0;
  DAYS.forEach((_, d) => PERIODS.forEach((__, p) => {
    const cid = S.tt[d + '-' + p], c = cid && cls(cid), du = duAt(d, p);
    const mtgs = du.filter(x => x.kind === 'meeting'), exs = du.filter(x => x.kind === 'extra'), acts = (!c && !mtgs.length && !exs.length) ? du.filter(x => x.kind === 'activity') : [];
    mtgN += mtgs.length; exN += exs.length; actN += acts.length;
  }));
  const dutyTxt = [mtgN ? `ประชุม ${mtgN} คาบ` : '', exN ? `คาบเสริม ${exN} คาบ` : '', actN ? `กิจกรรม ${actN} คาบ` : ''].filter(Boolean).join(' · ');
  let h = hd('ตารางสอน', `ภาคเรียนที่ ${S.term.sem}/${S.term.year} · คาบสอน ${Object.keys(S.tt).length} คาบ/สัปดาห์${dutyTxt ? ' · ' + dutyTxt : ''}${nCov ? ` · <b style="color:#ea580c">รับสอนแทนไว้ ${nCov} คาบ</b>` : ''}`,
    `<button class="btn ${ttEdit ? 'pri' : ''}" data-m2="ttEdit">${ic('gear')}${ttEdit ? 'เสร็จสิ้นการแก้' : 'แก้ตารางสอน'}</button><button class="btn" onclick="window.print()">พิมพ์ตาราง</button>`) +
    (ttEdit ? '<div class="notice">โหมดแก้ตาราง: แตะช่องเพื่อเลือกห้อง/วิชา หรือปรับแก้คาบประชุม/กิจกรรม · เช็กชนคาบให้อัตโนมัติ</div>' : '') +
    `<div class="card"><div class="scroll"><div class="tt" style="grid-template-columns:96px repeat(${PERIODS.length},minmax(104px,1fr));min-width:${96 + PERIODS.length * 110}px"><div></div>${PERIODS.map(([a, b], p) => `<div class="h">คาบ ${p + 1}${a ? `<br><span style="font-weight:400">${a}–${b}</span>` : ''}</div>`).join('')}`;
  DAYS.forEach((dayName, d) => {
    h += `<div class="p" style="justify-content:center"><b style="font-size:.95rem;color:var(--text)">${dayName}</b></div>`;
    PERIODS.forEach((_, p) => {
      const cid = S.tt[d + '-' + p], c = cid && cls(cid), du = duAt(d, p);
      const mtgs = du.filter(x => x.kind === 'meeting'), exs = du.filter(x => x.kind === 'extra'), acts = (!c && !mtgs.length && !exs.length) ? du.filter(x => x.kind === 'activity') : [];
      const dutyHtml = mtgs.map(m => `<span style="display:block;color:var(--info);font-weight:700">📌 ${esc(m.name)}</span><small style="display:block;font-size:.72rem;color:var(--info)">ประชุม${m.room && m.room !== m.name ? ' · ' + esc(m.room) : ''}</small>`).join('') +
        exs.map(ex => `<span style="display:block;color:var(--act);font-weight:700">⚡ ${esc(ex.subject)}</span><small style="display:block;font-size:.72rem;color:var(--act)">${esc(ex.className)}${ex.room ? ' · ' + esc(roomLabel(ex.room)) : ''}</small>`).join('') +
        acts.map(a => `<span style="display:block;color:var(--act);font-weight:600">🎯 ${esc(a.name)}</span>${a.room ? `<small style="display:block;font-size:.72rem;opacity:.75">${esc(a.room)}</small>` : ''}`).join('');
      const bgStyle = !c && mtgs.length ? 'background:var(--info-soft);border-color:var(--info);' : !c && (exs.length || acts.length) ? 'background:var(--act-soft);border-color:var(--act);' : '';
      if (ttEdit) {
        h += `<button class="c ${c || dutyHtml ? 'on' : ''}" data-m2="ttCell" data-k="${d}-${p}" style="text-align:left;font:inherit;color:inherit;cursor:pointer;${bgStyle}">${c ? `<b>${esc(String((S.ttSub || {})[d + '-' + p] || c.subject || '').split(' ')[0])}</b>${esc(c.name)}` : ''}${c && dutyHtml ? '<hr style="border:0;border-top:1px dashed var(--line);margin:3px 0">' : ''}${dutyHtml || (!c ? '<span class="muted">+ เพิ่ม</span>' : '')}</button>`;
      } else if (c) {
        h += `<button class="c on ${(S.ttCover || {})[d + '-' + p] ? 'cov' : ''} ${d === di && p === np ? 'now' : ''}" data-act="startAtt" data-c="${c.id}" style="text-align:left;font:inherit;color:inherit;cursor:pointer"><b>${esc(String((S.ttSub || {})[d + '-' + p] || c.subject || '').split(' ')[0])}</b>${esc(c.name)}${(S.ttLoc || {})[d + '-' + p] ? `<small style="display:block;font-size:.72rem;opacity:.75">${esc(roomLabel(S.ttLoc[d + '-' + p]))}</small>` : ''}${(S.ttCover || {})[d + '-' + p] ? `<small>สอนแทน ${esc(S.ttCover[d + '-' + p])}</small>` : ''}${dutyHtml ? '<hr style="border:0;border-top:1px dashed var(--line);margin:3px 0">' + dutyHtml : ''}</button>`;
      } else if (dutyHtml) {
        h += `<div class="c on ${d === di && p === np ? 'now' : ''}" style="${bgStyle}">${dutyHtml}</div>`;
      } else {
        h += '<div class="c"></div>';
      }
    });
  });
  return h + `</div></div></div>${ttEdit ? '' : '<p class="muted small" style="margin-top:10px">แตะที่คาบสอนเพื่อเช็กชื่อ · กรอบทองคือคาบปัจจุบัน' + (nCov ? ' · <b style="color:#ea580c">สีส้ม</b> = คาบที่รับไว้แทนครูที่ยังไม่มา' : '') + '</p>'}` + (window.EMSTTSum && window.EMSExchange ? EMSTTSum.summaryHTML(EMSExchange.allEntries().filter(e => e.teacher === S.me.name), S.me.name) : '');
};
const baseSettings = P['a-settings'];
P['a-settings'] = () => baseSettings() + `<div class="card" style="margin-top:16px"><h2>ปรับเวลาคาบเรียน</h2><div class="grid g2">${PERIODS.slice(0, 8).map(([a, b], i) =>
  `<div class="row" style="border:0"><span style="width:56px">คาบ ${i + 1}</span><input class="in" type="time" value="${a}" data-m2f="per" data-i="${i}" data-j="0" aria-label="เริ่มคาบ ${i + 1}"><span>–</span><input class="in" type="time" value="${b}" data-m2f="per" data-i="${i}" data-j="1" aria-label="สิ้นสุดคาบ ${i + 1}"></div>`).join('')}</div></div>`;

/* ================= แผงผู้บริหารเพิ่มเติม ================= */
const baseExec = P['a-exec'];
let streakDays = 3;
P['a-exec'] = () => {
  const maxN = num((S.settings || {}).maxStudents) || 40, streaks = [];
  S.classes.forEach(c => { const keys = Object.keys(S.att).filter(k => k.indexOf(c.id + '|') === 0 && !/\|hr$/.test(k)), dates = [...new Set(keys.map(k => k.split('|')[1]))].sort();
    const dayAbs = (d, sid) => { const vs = keys.filter(k => k.split('|')[1] === d).map(k => (S.att[k] || {})[sid]).filter(Boolean); return vs.length > 0 && vs.every(v => v === 'a'); };
    c.students.forEach(s => { let run = 0, best = 0, end = ''; dates.forEach(d => { if (dayAbs(d, s.id)) { run++; if (run > best) { best = run; end = d; } } else run = 0; });
      if (best >= streakDays) streaks.push({ s, c, days: best, end }); }); });
  streaks.sort((a, b) => b.days - a.days);
  const levels = {}; S.classes.forEach(c => { const m = String(c.name).match(/ม\.\s?([1-6])/), k = m ? 'ม.' + m[1] : 'อื่น ๆ'; const L = levels[k] = levels[k] || { n: 0, rooms: 0 }; L.n += c.students.length; L.rooms++; });
  return baseExec() + `<div class="card"><div class="row" style="border:0;padding-top:0"><h2 style="margin:0">นักเรียนขาดเรียนติดต่อกัน</h2><span class="grow"></span>
      <select class="in" style="width:auto" data-m2f="streak" aria-label="เกณฑ์">${[2, 3, 5, 7].map(n => `<option value="${n}" ${n === streakDays ? 'selected' : ''}>เกินกว่า ${n} วัน</option>`).join('')}</select>${chip(streaks.length + ' คน', streaks.length ? 'bad' : 'ok')}</div>
      ${streaks.length ? `<div class="list">${streaks.slice(0, 30).map(x => `<div class="row"><div class="ico" style="background:var(--bad-soft);color:var(--bad);font-weight:700">${x.days}</div><div class="grow"><div class="t">${esc(x.s.name)}</div><div class="muted small">${esc(x.c.name)} · เลขที่ ${x.s.no} · ถึง ${thDate(x.end)}</div></div></div>`).join('')}</div>` : '<div class="empty">ไม่มีนักเรียนที่ขาดเรียนติดต่อกันตามเกณฑ์</div>'}</div>
    <div class="grid g2" style="align-items:start"><div class="card" style="margin-top:0"><h2>จำนวนนักเรียนแต่ละห้อง <span class="muted small">เกณฑ์ ${maxN} คน/ห้อง</span></h2>
      ${S.classes.map(c => { const d = c.students.length - maxN; return `<div class="row" style="border:0;padding:6px 0"><div style="width:70px;font-weight:600">${esc(c.name)}</div><div class="bar grow"><i style="width:${Math.min(100, c.students.length * 100 / maxN)}%"></i></div><div style="width:92px;text-align:right;color:${d < 0 ? 'var(--warn)' : d > 0 ? 'var(--info)' : 'var(--ok)'}">${c.students.length} ${d < 0 ? '(ขาด ' + -d + ')' : d > 0 ? '(เกิน ' + d + ')' : '(ครบ)'}</div></div>`; }).join('')}</div>
    <div class="card" style="margin-top:0"><h2>นักเรียนแยกตามระดับชั้น</h2>${Object.entries(levels).sort().map(([k, L]) => `<div class="row"><div class="grow t">${k}</div><div class="muted small">${L.rooms} ห้อง · เฉลี่ย ${fmt(L.n / L.rooms, 1)}</div><b>${L.n}</b> คน</div>`).join('')}</div></div>`;
};

/* ================= เหตุการณ์ ================= */
const findLeave = id => S.leaves.find(l => l.id === id);
document.addEventListener('click', async e => {
  const cap = e.target.closest('[data-act="newReq"][data-t="leave"]');
  if (cap) { e.stopImmediatePropagation(); go('leaves'); return; }
}, true);
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-m2]'); if (!t) return;
  if (t.tagName === 'A') e.preventDefault();
  const a = t.dataset.m2, d = t.dataset;
  switch (a) {
    case 'leaveNew': return leaveForm();
    case 'leaveSave': { const f = $('#lf-f').value, to = $('#lf-e').value || f; if (!f) return toast('กรุณาเลือกวันที่');
      if (to < f) return toast('วันที่สิ้นสุดต้องไม่ก่อนวันเริ่มลา');
      const cover = $('#lf-c').value, l = { id: uid('lv'), by: S.me.name, type: $('#lf-t').value, from: f, to, reason: $('#lf-r').value.trim(), cover, head: 'none', status: 'draft', at: now() };
      if (d.send === '1') { l.status = 'submitted'; l.head = cover === 'head' ? 'waiting' : 'none'; }
      S.leaves.unshift(l); save(); closeModal(); toast(d.send === '1' ? 'ส่งใบลาแล้ว' : 'บันทึกร่างแล้ว'); return redraw(); }
    case 'leaveSend': { const l = findLeave(d.id); l.status = 'submitted'; l.head = l.cover === 'head' ? 'waiting' : 'none'; save(); toast('ส่งใบลาแล้ว'); return redraw(); }
    case 'leaveCancel': if (await ask('ยกเลิกใบลา', 'ยกเลิกใบลานี้ใช่ไหม', 'ยกเลิกใบลา')) { S.leaves = S.leaves.filter(l => l.id !== d.id); save(); redraw(); } return;
    case 'leaveDoc': { const l = findLeave(d.id); return modal(`<div style="max-height:62vh;overflow:auto;font-size:.95rem;line-height:1.8">${leaveDocBody(l).replace(/<h1>/, '<h2 style="text-align:center">').replace(/<\/h1>/, '</h2>')}</div>
      <button class="btn pri" style="width:100%;margin-top:12px" data-m2="leavePrint" data-id="${l.id}">${ic('print')}พิมพ์ใบลา</button>`); }
    case 'leavePrint': return printHtml('ใบลา', leaveDocBody(findLeave(d.id)));
    case 'leaveOk': case 'leaveNo': { const l = findLeave(d.id); l.status = a === 'leaveOk' ? 'approved' : 'rejected'; l.decidedAt = now(); save(); toast(a === 'leaveOk' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'); return redraw(); }
    case 'headOk': case 'headNo': { const l = findLeave(d.id); l.head = a === 'headOk' ? 'endorsed' : 'rejected'; if (a === 'headNo') { l.status = 'rejected'; l.note = 'หัวหน้ากลุ่มสาระไม่เห็นชอบ'; } save(); toast(a === 'headOk' ? 'เห็นควรอนุญาต ส่งผู้บริหารต่อ' : 'ไม่เห็นชอบ'); return redraw(); }
    case 'hrView': hrView = d.k; return redraw();
    case 'hrCfg': S.hrCfg.lateTime = $('#hr-late').value || '08:00'; save(); return toast('บันทึกแล้ว');
    /* กิจการนักเรียน */
    case 'afView': S.affairs.view = d.k; save(); return redraw();
    case 'afRec': return recModal('');
    case 'afRecSave': { const cfg = S.affairs.cfg, r = cfg.rules.find(x => x.id === $('#rc-r').value);
      if (RC.flush) RC.flush();                    // เลขที่พิมพ์ค้างไว้โดยยังไม่เว้นวรรค
      if (!r || !RC.sel.length) return toast('กรุณาเลือกนักเรียนอย่างน้อย 1 คน และเลือกรายการ');
      if (RC.miss.length && !confirm('ไม่พบเลขประจำตัว ' + RC.miss.join(', ') + '\nบันทึกเฉพาะ ' + RC.sel.length + ' คนที่พบ?')) return;
      const date = $('#rc-d').value || todayISO(), note = $('#rc-n').value.trim(), n = RC.sel.length;
      RC.sel.forEach(x => S.affairs.records.push({ id: uid('rc'), sid: x.sid, name: x.name, className: x.className, type: 'conduct', kind: r.kind, title: r.name, points: r.points, date, note, by: S.me.name }));
      RC.sel = []; RC.miss = [];
      save(); closeModal(); toast(n > 1 ? `บันทึกพฤติกรรม ${n} คนแล้ว` : 'บันทึกพฤติกรรมแล้ว'); return redraw(); }
    case 'afHist': { const o = conduct()[d.sid]; if (!o) return;
      return modal(`<h2>${esc(o.s.name)}</h2><div class="muted" style="margin-bottom:10px">${esc(o.c.name)} · คะแนน ${scoreChip(o.score, S.affairs.cfg)}</div>
        ${o.recs.length ? `<div class="list">${o.recs.slice().sort((x, y) => y.date.localeCompare(x.date)).map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.type === 'late' ? 'มาสาย ' + (r.time || '') : r.title)}</div><div class="muted small">${thDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
          ${chip(r.type === 'late' ? '−' + fmt(r.points !== undefined ? r.points : S.affairs.cfg.lateDeduct) : (r.kind === 'good' ? '+' : '−') + fmt(r.points), r.kind === 'good' && r.type !== 'late' ? 'ok' : 'bad')}<button class="btn sm ghost" data-m2="afVoid" data-id="${r.id}">ยกเลิก</button></div>`).join('')}</div>` : '<div class="empty">ยังไม่มีบันทึก</div>'}
        <button class="btn pri" style="width:100%;margin-top:10px" data-m2="afRecFor" data-sid="${esc(d.sid)}">บันทึกพฤติกรรมให้คนนี้</button>`); }
    case 'afRecFor': return recModal(d.sid);
    case 'afVoid': { const r = S.affairs.records.find(x => x.id === d.id); if (!r) return;
      if (r.by !== S.me.name && window.EMSAudit) {       // ยกเลิกรายการที่คนอื่น/เครื่องสแกนบันทึก = ต้องมีเหตุผล
        closeModal(); const what = (r.type === 'late' ? 'มาสาย ' + (r.time || '') : r.title) + ' · ' + r.date;
        const ok = await EMSAudit.guard('conduct', (r.name || r.sid) + ' · ' + what, 'บันทึกโดย ' + (r.by || '—'), 'ยกเลิกรายการ', 'ยกเลิกรายการพฤติกรรม'); if (!ok) return;
        const r2 = S.affairs.records.find(x => x.id === d.id); if (!r2) { toast('รายการเปลี่ยนระหว่างแก้ ลองใหม่'); return redraw(); }      // snapshot ระหว่างรอ = รายการชุดใหม่
        r2.voided = true; save(); ok(); toast('ยกเลิกรายการแล้ว'); return redraw(); }
      r.voided = true; save(); closeModal(); toast('ยกเลิกรายการแล้ว'); return redraw(); }
    case 'afRoom': { const c = S.classes.find(x => x.id === d.c), date = S.affairs.date || todayISO(), cur = (S.affairs.daily[date] || {})[c.id] || {};
      return modal(`<h2 style="margin-bottom:12px">แถวเช้า ${esc(c.name)} · ${thDate(date)}</h2><div class="grid g2">${['present:มา', 'late:สาย', 'absent:ขาด', 'leave:ลา'].map(x => { const [k, l] = x.split(':'); return fld('rm-' + k, l, cur[k] ?? (k === 'present' ? c.students.length : 0), 'inputmode="numeric"'); }).join('')}</div>
        <button class="btn pri" style="width:100%" data-m2="afRoomSave" data-c="${c.id}">บันทึก</button>`, true); }
    case 'afRoomSave': { const date = S.affairs.date || todayISO(), old = (S.affairs.daily[date] || {})[d.c];
      const nv = { present: num($('#rm-present').value), late: num($('#rm-late').value), absent: num($('#rm-absent').value), leave: num($('#rm-leave').value), checkedAt: now() };
      const fmtD = x => `มา ${x.present} สาย ${x.late} ขาด ${x.absent} ลา ${x.leave}`;
      let ok = null;
      if (old && window.EMSAudit && fmtD(old) !== fmtD(nv)) {      // แก้แถวเช้าที่บันทึกไว้แล้ว = ต้องมีเหตุผล
        closeModal(); ok = await EMSAudit.guard('conduct', 'แถวเช้า ' + ((S.classes.find(x => x.id === d.c) || {}).name || d.c) + ' · ' + date, fmtD(old), fmtD(nv), 'แก้ยอดแถวเช้า'); if (!ok) return; }
      (S.affairs.daily[date] = S.affairs.daily[date] || {})[d.c] = nv;      // อ่าน S.affairs หลังรอเหตุผล = ข้อมูลปัจจุบัน
      save(); if (ok) ok(); closeModal(); return redraw(); }
    case 'afCfg': { const c = S.affairs.cfg; Object.assign(c, { startScore: num($('#af-s').value) || 100, threshold: num($('#af-t').value), lateTime: $('#af-lt').value || '08:00', lateDeduct: Math.abs(num($('#af-ld').value)), classLateEnabled: $('#af-clon').checked, classLateDeduct: Math.abs(num($('#af-cl').value)), capAtStart: $('#af-cap').checked }); save(); return toast('บันทึกเกณฑ์แล้ว'); }
    case 'ruleAdd': S.affairs.cfg.rules.push({ id: uid('r'), kind: 'bad', name: 'รายการใหม่', points: 5 }); save(); return redraw();
    case 'ruleDel': S.affairs.cfg.rules.splice(+d.i, 1); save(); return redraw();
    case 'afPub': { const c = S.affairs.cfg; c.stuShow = c.stuShow === false; save(); toast(c.stuShow ? 'นักเรียนเห็นคะแนนพฤติกรรมของตัวเองแล้ว' : 'ซ่อนคะแนนพฤติกรรมจากนักเรียนแล้ว'); return redraw(); }
    /* จิตอาสา */
    case 'volAdd': return volModal();
    case 'volAll': document.querySelectorAll('.vo-s').forEach(x => { x.checked = t.dataset.on === '1'; }); return;
    case 'volSave': { const c = S.classes.find(x => x.id === $('#vo-c').value), ids = [...document.querySelectorAll('.vo-s')].filter(x => x.checked).map(x => x.value);
      const title = $('#vo-t').value.trim(), hours = num($('#vo-h').value), date = $('#vo-d').value || todayISO();
      if (!c || !ids.length) return toast('เลือกนักเรียนอย่างน้อย 1 คน'); if (!title) return toast('กรุณาใส่ชื่อกิจกรรม'); if (!(hours > 0)) return toast('กรุณาใส่จำนวนชั่วโมง');
      ids.forEach(id => { const s = c.students.find(x => sk(x) === id); if (s) S.affairs.vol.push({ id: uid('vo'), sid: sk(s), name: s.name, className: c.name, title, date, hours, note: $('#vo-n').value.trim(), st: 'ok', src: 'staff', by: S.me.name, at: now() }); });
      save(); closeModal(); toast(`บันทึกจิตอาสา ${ids.length} คน · คนละ ${fmt(hours)} ชม.`); return redraw(); }
    case 'volOk': case 'volNo': { const v = S.affairs.vol.find(x => x.id === d.id); if (!v) return;
      v.st = a === 'volOk' ? 'ok' : 'no'; v.okBy = S.me.name; v.okAt = now(); save(); closeModal(); toast(a === 'volOk' ? 'อนุมัติ ' + fmt(v.hours) + ' ชม. ให้ ' + v.name : 'ไม่อนุมัติคำขอของ ' + v.name); return redraw(); }
    case 'volDel': { const v = S.affairs.vol.find(x => x.id === d.id); if (!v || !await ask('ลบรายการจิตอาสา', `ลบ “${esc(v.title)}” ${fmt(v.hours)} ชม. ของ ${esc(v.name)}?`, 'ลบ')) return;
      S.affairs.vol = S.affairs.vol.filter(x => x.id !== v.id); save(); closeModal(); return redraw(); }
    case 'volHist': return volHist(d.sid);
    case 'volCsv': { const tot = volTotals(), rows = allStudents().map(({ s, c }) => [c.name, s.no, sk(s), s.name, fmt((tot[sk(s)] || {}).h || 0), (tot[sk(s)] || {}).n || 0]);
      const csv = '\ufeff' + [['ห้อง', 'เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล', 'ชั่วโมงจิตอาสา (อนุมัติแล้ว)', 'จำนวนครั้ง']].concat(rows).map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); l.download = 'ชั่วโมงจิตอาสา.csv'; l.click(); return; }
    case 'afCsv': { const cfg = S.affairs.cfg, rows = Object.values(conduct()), csv = '﻿' + [['ห้อง', 'เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล', 'คะแนน', 'ความดี', 'ผิดระเบียบ', 'มาสาย']].concat(rows.map(o => [o.c.name, o.s.no, sk(o.s), o.s.name, o.score, o.good, o.bad, o.late])).map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); l.download = 'คะแนนพฤติกรรม.csv'; l.click(); return; }
    /* แจ้งซ่อม / สถานที่ */
    case 'genView': S.gen.view = d.k; save(); return redraw();
    case 'genFilter': genFilter = d.k; return redraw();
    case 'rpNew': return repairForm();
    case 'vnNew': return venueForm();
    case 'rpSave': { const place = $('#rp-p').value.trim(), item = $('#rp-i').value.trim(); if (!place || !item) return toast('กรุณากรอกสถานที่และของที่ชำรุด');
      S.repairs.unshift({ id: uid('rp'), place, category: $('#rp-c').value, item, detail: $('#rp-d').value.trim(), urgent: $('#rp-u').checked, owner: S.me.name, status: 'new', stage: 'head', approvals: {}, createdAt: now() });
      save(); closeModal(); toast('ส่งแจ้งซ่อมแล้ว'); return redraw(); }
    case 'vnSave': { const u = $('#vn-u').value.trim(); if (!u) return toast('กรุณากรอกวัตถุประสงค์');
      S.venues.unshift({ id: uid('vn'), place: $('#vn-p').value, date: $('#vn-d').value, from: $('#vn-f').value, to: $('#vn-t').value, purpose: u, people: $('#vn-n').value, setup: [...document.querySelectorAll('.vn-s')].filter(x => x.checked).map(x => x.value), owner: S.me.name, status: 'pending', stage: 'head', approvals: {}, createdAt: now() });
      save(); closeModal(); toast('ส่งคำขอแล้ว'); return redraw(); }
    case 'gOk': case 'gNo': { const r = (d.t === 'r' ? S.repairs : S.venues).find(x => x.id === d.id); if (!r) return;
      if (a === 'gNo') { r.status = 'rejected'; r.stage = 'rejected'; } else { r.approvals = r.approvals || {}; r.approvals[r.stage] = { by: S.gen.approvers[r.stage] || STG.find(x => x[0] === r.stage)[1], at: now() }; r.stage = nextStage(r.stage); if (r.stage === 'approved' && d.t === 'v') r.status = 'approved'; }
      save(); toast(a === 'gOk' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'); return redraw(); }
    case 'rpUpd': { const r = S.repairs.find(x => x.id === d.id);
      return modal(`<h2 style="margin-bottom:12px">มอบงาน / อัปเดต · ${esc(r.item)}</h2>${sel('ru-s', 'สถานะ', Object.entries(RST).filter(([k]) => !['cancelled', 'rejected'].includes(k)).map(([k, v]) => [k, v[0]]), r.status)}
        <div class="field"><label class="f" for="ru-w">ผู้ปฏิบัติงาน</label><select id="ru-w" class="in"><option value="">— ยังไม่มอบหมาย —</option>${S.gen.workers.map(w => `<option value="${w.id}" ${w.id === r.workerId ? 'selected' : ''}>${esc(w.name)} (${esc(w.skill)})</option>`).join('')}</select></div>
        ${fld('ru-n', 'บันทึกถึงผู้แจ้ง', r.handlerNote)}<button class="btn pri" style="width:100%" data-m2="rpUpdSave" data-id="${r.id}">บันทึก</button>`, true); }
    case 'rpUpdSave': { const r = S.repairs.find(x => x.id === d.id); r.status = $('#ru-s').value; r.workerId = $('#ru-w').value; r.handlerNote = $('#ru-n').value.trim(); save(); closeModal(); return redraw(); }
    case 'rpCancel': { const r = S.repairs.find(x => x.id === d.id); r.status = 'cancelled'; r.stage = 'cancelled'; save(); return redraw(); }
    case 'vnCancel': { const v = S.venues.find(x => x.id === d.id); v.status = 'cancelled'; v.stage = 'cancelled'; save(); return redraw(); }
    case 'genCfg': STG.forEach(([k]) => { S.gen.approvers[k] = $('#gs-' + k).value.trim(); }); save(); return toast('บันทึกแล้ว');
    case 'wkAdd': return modal(`<h2 style="margin-bottom:12px">เพิ่มผู้ปฏิบัติงาน</h2>${fld('wk-n', 'ชื่อ', '')}${fld('wk-s', 'ความถนัด', '', 'placeholder="เช่น ไฟฟ้า"')}${fld('wk-p', 'เบอร์โทร', '')}<button class="btn pri" style="width:100%" data-m2="wkSave">เพิ่ม</button>`, true);
    case 'wkSave': { const n = $('#wk-n').value.trim(); if (!n) return toast('กรุณากรอกชื่อ'); S.gen.workers.push({ id: uid('w'), name: n, skill: $('#wk-s').value.trim() || '-', phone: $('#wk-p').value.trim() }); save(); closeModal(); return redraw(); }
    case 'wkDel': S.gen.workers.splice(+d.i, 1); save(); return redraw();
    case 'plAdd': { const v = $('#pl-n').value.trim(); if (v) { S.gen.places.push(v); save(); redraw(); } return; }
    case 'plDel': S.gen.places.splice(+d.i, 1); save(); return redraw();
    /* ประวัติส่วนตัว */
    case 'psLock': { normPersonal(S.personal); const k = d.k, cur = S.personal.locks[k] !== false; S.personal.locks[k] = !cur; normPersonal(S.personal); save(); if (cur) hrSchedulePush(); toast(!cur ? '🔒 ล็อกแล้ว — ไม่แสดงในหน้าฝ่ายบุคคลของ EMS' : (/salary|nationalId/i.test(k) ? '🔓 ปลดล็อก — ส่งเฉพาะชีต HR ตามสิทธิ์ (ไม่ส่งหน้าฝ่ายบุคคลของ EMS)' : '🔓 ปลดล็อก — ฝ่ายบุคคลและผู้ดูแลระบบเห็นได้')); return redraw(); }
    case 'psFromTT': psApplyTT(S.personal, true); save(); toast('เติมชั้นปีและสาขาวิชาจากตารางสอนแล้ว'); return redraw();
    case 'psTab': { psTab = d.k; try { sessionStorage.setItem('ems-ps-tab', psTab); } catch (e) {}
      document.querySelectorAll('.ps-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === psTab)));
      document.querySelectorAll('.ps-pane').forEach(x => { x.hidden = x.dataset.pane !== psTab; }); psTabShow();
      if (d.go) { const h = document.querySelector('.ps-tabhead'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    case 'rowAdd': normPersonal(S.personal); (S.personal[d.t] = S.personal[d.t] || []).push({}); save(); return redraw();
    case 'rowDel': normPersonal(S.personal); (S.personal[d.t] = S.personal[d.t] || []).splice(+d.i, 1);
      if (d.t === 'license' && !S.personal.license.length) pSet(S.personal, 'license', []);      // ลบใบอนุญาตใบสุดท้าย: ล้างช่องคู่ด้วย ไม่ให้สร้างแถวเดิมคืน
      normPersonal(S.personal); save(); hrSchedulePush(); return redraw();
    case 'hrSyncNow': return hrSync(true);
    case 'psBackup': return ems.drive.exportCopy('EMS/ประวัติส่วนตัว', S.me.name + '.json').then(() => toast('สำรองประวัติส่วนตัวลง Drive แล้ว (ตัวอย่าง)'));
    case 'ttEdit': ttEdit = !ttEdit; return redraw();
    case 'ttCell': {
      const [dd, pp] = d.k.split('-').map(Number);
      const canDuty = window.EMSAdmin && EMSAdmin.openDutyCellModal && (!LIVE || S.view === 'admin' || [].concat(S.me.roles || [], S.me.role || []).some(r => r === 'admin' || r === 'academic'));
      return modal(`<h2 style="margin-bottom:12px">คาบ ${pp + 1} · ${DAYS[dd]}</h2>
        ${S.classes.map(c => `<button class="nav" data-m2="ttSet" data-k="${d.k}" data-c="${c.id}"><span>${esc(c.name)} · ${esc(c.subject)}</span></button>`).join('')}
        ${canDuty ? `<button class="nav" style="color:var(--info)" data-m2="ttDutyOpen" data-d="${dd}" data-p="${pp}"><span>📌 จัดการคาบประชุม / 🎯 กิจกรรม / ⚡ คาบเสริมในช่องนี้</span></button>` : ''}
        <button class="nav" style="color:var(--bad)" data-m2="ttSet" data-k="${d.k}" data-c="">${ic('out')}<span>ล้างคาบสอนในช่องนี้</span></button>`, true);
    }
    case 'ttDutyOpen': if (window.EMSAdmin && EMSAdmin.openDutyCellModal) return EMSAdmin.openDutyCellModal('teacher', S.me.name, +d.d, +d.p); return;
    case 'ttSet': { if (S.ttCover && S.tt[d.k] !== d.c) delete S.ttCover[d.k];   // เปลี่ยนห้อง/ล้างช่อง = ไม่ใช่คาบที่รับไว้แทนแล้ว
      if (S.ttLoc && S.tt[d.k] !== d.c) delete S.ttLoc[d.k];   // สถานที่เดิมเป็นของคาบเดิม
      if (S.ttSub && S.tt[d.k] !== d.c) delete S.ttSub[d.k];   // วิชาเดิมเป็นของคาบเดิม (คาบใหม่ใช้วิชาของห้อง)
      if (d.c) S.tt[d.k] = d.c; else delete S.tt[d.k]; save(); closeModal(); return redraw(); }
  }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-m2f]'); if (!t) return;
  const a = t.dataset.m2f, d = t.dataset;
  switch (a) {
    case 'pfm': { const k = d.k, box = t.closest('.pills'); S.personal.fields[k] = [...box.querySelectorAll('input[data-m2f="pfm"]:checked')].map(x => x.value).join(','); normPersonal(S.personal); save(); return; }
    case 'pf': { const k = d.k, p = S.personal; pSet(p, k, t.value); normPersonal(p);
      save(); hrSchedulePush(); if (['birthDate', 'appointDate', 'standingDate', 'prefix', 'firstName', 'lastName'].includes(k)) redraw(); return; }
    case 'pc': { normPersonal(S.personal); const row = S.personal[d.t][+d.i]; row[d.k] = t.value;
      if (d.t === 'license' && d.k === 'issueDate' && t.value && !row.expireDate) row.expireDate = addYears(t.value, 5);
      normPersonal(S.personal); save(); hrSchedulePush(); if (d.t === 'license' && (d.k === 'issueDate' || d.k === 'expireDate')) redraw(); return; }
    case 'afCls': afCls = t.value; return redraw();
    case 'afLow': afLow = t.checked; return redraw();
    case 'afQ': afQ = t.value.trim(); return redraw();
    case 'voCls': voCls = t.value; return redraw();
    case 'voQ': voQ = t.value.trim(); return redraw();
    case 'ruleName': S.affairs.cfg.rules[+d.i].name = t.value.trim() || 'รายการ'; return save();
    case 'rulePts': S.affairs.cfg.rules[+d.i].points = Math.abs(num(t.value)); return save();
    case 'per': { syncPeriods(); PERIODS[+d.i][+d.j] = t.value; S.periods = PERIODS.slice(0, 8).map(p => [p[0], p[1]]); return save(); }
    case 'streak': streakDays = +t.value; return redraw();
    case 'scan': { const f = t.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { let n = 0; String(rd.result).replace(/^﻿/, '').split(/\r?\n/).forEach(line => { const p = line.split(',').map(x => x.trim()); if (p.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(p[1]) || !/^\d{1,2}:\d{2}/.test(p[2])) return;
          const day = S.scanTimes[p[1]] = S.scanTimes[p[1]] || {}, tm = p[2].slice(0, 5).padStart(5, '0'); if (!day[p[0]] || tm < day[p[0]]) day[p[0]] = tm; n++; });
        save(); toast('นำเข้าเวลาสแกน ' + n + ' รายการ'); redraw(); };
      rd.readAsText(f, 'utf-8'); return; }
    case 'rcCls': return;
  }
});
document.addEventListener('input', e => {
  const t = e.target; if (t.id === 'hr-d' || t.id === 'af-date') return;
});
document.addEventListener('change', e => {
  if (e.target.id === 'hr-d') { hrDate = e.target.value || todayISO(); redraw(); }
  if (e.target.id === 'af-date') { S.affairs.date = e.target.value || todayISO(); save(); redraw(); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.matches('[data-m2k="gate"]')) return;
  e.preventDefault();
  const cfg = S.affairs.cfg, box = e.target, ids = box.value.split(/[\s,]+/).filter(Boolean); box.value = '';
  const date = $('#af-gd').value || todayISO(), tm = $('#af-gt').value || new Date().toTimeString().slice(0, 5), out = [];
  ids.forEach(id => { const hit = allStudents().find(x => sk(x.s) === id || x.s.sid === id);
    if (!hit) return out.push(`<div>${chip('ไม่พบ', 'bad')} เลขประจำตัว ${esc(id)}</div>`);
    const who = `<b>${esc(hit.s.name)}</b> · ${esc(hit.c.name)}`;
    if (tm <= cfg.lateTime) return out.push(`<div>${chip('ทันเวลา ' + tm, 'ok')} ${who}</div>`);
    if (S.affairs.records.some(r => r.type === 'late' && r.sid === sk(hit.s) && r.date === date && !r.voided)) return out.push(`<div>${chip('บันทึกแล้ว', 'warn')} ${who} วันนี้มีรายการมาสายแล้ว ไม่หักซ้ำ</div>`);
    S.affairs.records.push({ id: uid('rc'), sid: sk(hit.s), name: hit.s.name, className: hit.c.name, type: 'late', kind: 'bad', title: 'มาสาย', points: cfg.lateDeduct, date, time: tm, source: 'gate', by: S.me.name });
    out.push(`<div>${chip('มาสาย ' + tm, 'bad')} ${who} หัก ${fmt(cfg.lateDeduct)} คะแนน</div>`); });
  save(); $('#af-res').innerHTML = out.join(''); box.focus();
});

/* เช็กชื่อ "สาย" → หักคะแนนพฤติกรรมอัตโนมัติ (ปรับจำนวนที่หักได้ที่ ฝ่ายกิจการนักเรียน → ตั้งค่าเกณฑ์) */
const baseSaveAtt = ems.data.saveAttendance;
ems.data.saveAttendance = async function (key, rec) {
  await baseSaveAtt.call(this, key, rec);
  if (/\|hr$/.test(key)) return;
  const [cid, date] = key.split('|'), cfg = S.affairs.cfg, c = S.classes.find(x => x.id === cid); if (!c) return;
  /* บันทึกซ้ำ = คิดใหม่ ไม่หักซ้อน · id คงที่ต่อคาบ+คน และยกเลิก (voided) แทนการลบ — ครูทั่วไปลบเอกสาร conduct ไม่ได้ (rules) คำสั่งลบทำให้ทั้งชุดบันทึกล้ม */
  const want = new Set(cfg.classLateEnabled && num(cfg.classLateDeduct) > 0 ? c.students.filter(s => (rec || {})[s.id] === 's').map(sk) : []);
  if (window.EMSCloud && !EMSCloud.ready.conduct) { if (want.size) toast('กำลังโหลดข้อมูลกิจการนักเรียน ยังไม่ได้หักคะแนนมาสาย — กดบันทึกอีกครั้งในอีกสักครู่'); return; }      // ยังไม่ได้ข้อมูลรอบแรก = รายการที่เพิ่มจะถูกทับหาย
  const mine = S.affairs.records.filter(r => r.source === 'class' && r.attKey === key);
  mine.forEach(r => { if (!r.voided && !want.has(r.sid)) r.voided = { by: S.me.name, at: new Date().toISOString(), reason: 'ครูแก้สถานะการเช็กชื่อคาบเรียน' }; });
  let n = 0;
  want.forEach(sid => {
    if (mine.some(r => r.sid === sid && (!r.voided || r.voided === true))) return;              // หักแล้ว (รวมรายการแบบเก่าที่ id สุ่ม) หรือฝ่ายกิจการฯ ยกเลิกเอง (afVoid) ไม่คืน
    const id = ('classlate_' + key + '_' + sid).replace(/\//g, '_'), old = mine.find(r => r.id === id), s = c.students.find(x => sk(x) === sid);
    if (old) delete old.voided;
    else S.affairs.records.push({ id, sid, name: s.name, className: c.name, type: 'late', kind: 'bad', title: 'มาสาย (เข้าเรียน)', points: num(cfg.classLateDeduct), date, time: '', source: 'class', attKey: key, by: S.me.name });
    n++;
  });
  save();
  if (n) toast('หักคะแนนพฤติกรรมนักเรียนมาสาย ' + n + ' คน คนละ ' + fmt(cfg.classLateDeduct) + ' คะแนน');
};

save(); render();
})();
