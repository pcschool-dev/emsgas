/* EMS — ฟีเจอร์ส่วนขยาย (ต้นแบบ) : แลกคาบ กิจกรรม ตัวชี้วัด โครงสร้างรายวิชา รายงาน/ปพ.5 ข้อมูลของฉัน
   ปฏิทินวิชาการ วัดผล ตรวจรายวิชา ฝ่ายบุคคล ผู้บริหาร นักเรียน นำเข้าข้อมูล และมุมมองนักเรียน
   โหลดต่อจาก index.html — ใช้ตัวแปรร่วม S, P, ic, esc, modal, toast ฯลฯ */
(() => {
/* ---------- เติมข้อมูลตัวอย่างที่ขาด ---------- */
const names = c => cls(c).students;
const D = {
  swaps: [
    { id: 21, from: 'ครูวิไล เพชรงาม', to: 'ครูสมชาย ใจดี', fromSlot: 'พ. คาบ 3 · ม.2/1', toSlot: 'พฤ. คาบ 2 · ม.1/3', date: '2026-10-21', status: 'wait', reason: 'ติดประชุมกลุ่มสาระ' },
    { id: 22, from: 'ครูสมชาย ใจดี', to: 'ครูสุดา แสงทอง', fromSlot: 'ศ. คาบ 2 · ม.5/1', toSlot: 'ศ. คาบ 6 · ม.3/2', date: '2026-10-16', status: 'ok', reason: 'พาเด็กไปแข่งขัน' }
  ],
  activities: [
    { id: 'club', name: 'ชุมนุมวิทยาศาสตร์', cls: 'm4-2', when: 'พุธ คาบ 8' },
    { id: 'scout', name: 'ลูกเสือ-เนตรนารี', cls: 'm1-3', when: 'พฤหัสบดี คาบ 8' }
  ],
  actRes: {},
  courseSub: [
    { id: 31, label: 'ม.1/3 ว21101 วิทยาศาสตร์พื้นฐาน', by: 'ครูสมชาย ใจดี', status: 'submitted', note: '' },
    { id: 32, label: 'ม.4/2 ว30101 ฟิสิกส์ 1', by: 'ครูสมชาย ใจดี', status: 'approved', note: '' },
    { id: 33, label: 'ม.5/1 ว30201 ฟิสิกส์ 3', by: 'ครูสมชาย ใจดี', status: 'revise', note: 'สัดส่วนคะแนนรวมต้องเป็น 100 — ขาดช่องปลายภาค' },
    { id: 34, label: 'ม.2/1 ค22101 คณิตศาสตร์', by: 'ครูสุดา แสงทอง', status: 'submitted', note: '' }
  ],
  events: [
    { id: 41, date: '2026-10-13', title: 'วันคล้ายวันสวรรคต ร.9 (หยุด)', cat: 'holiday' },
    { id: 42, date: '2026-10-19', title: 'สอบกลางภาค วันแรก', cat: 'exam' },
    { id: 43, date: '2026-10-23', title: 'วันปิยมหาราช (หยุด)', cat: 'holiday' },
    { id: 44, date: '2026-10-28', title: 'ประชุมผู้ปกครอง ม.3 และ ม.6', cat: 'meeting' },
    { id: 45, date: '2026-11-24', title: 'กิจกรรมวันลอยกระทง', cat: 'activity' },
    { id: 46, date: '2026-12-07', title: 'สอบปลายภาค วันแรก', cat: 'exam' }
  ],
  published: {},
  profile: { phone: '081-000-0000', leave: { sick: [3, 30], personal: [1, 10], vacation: [4, 10] } },
  student: { classId: 'm4-2', id: '4203' }
};
const fresh = S.swaps == null;
for (const k in D) if (S[k] == null) S[k] = D[k];
if (fresh) S.pending.unshift({ id: 22, who: 'ครูสมชาย ใจดี', what: 'แลกคาบ ศ. คาบ 2 ↔ ศ. คาบ 6 (กับครูสุดา)', date: '2026-10-16', type: 'swap' });
REQ.swap = ['แลกคาบ', 'info', 'swap'];
Object.assign(IC, {
  swap: '<path d="M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
  bar: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  down: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
});

/* ---------- เมนูแบบจัดกลุ่ม ---------- */
const NAVG = {
  teacher: [
    [null, [['home', 'หน้าหลัก', 'home'], ['schedule', 'ตารางสอน', 'cal'], ['attendance', 'เช็กชื่อ', 'check']]],
    ['สมุดคะแนน', [['scores', 'กรอกคะแนน', 'score'], ['items', 'หัวข้อคะแนน', 'gear'], ['groups', 'คะแนนกลุ่ม', 'users'], ['indicators', 'ตัวชี้วัด / ผลการเรียนรู้', 'target'], ['course', 'โครงสร้างรายวิชา', 'book'], ['assess', 'คุณลักษณะ / อ่านคิดวิเคราะห์', 'check'], ['summary', 'สรุป / ส่งออก ปพ.5', 'print']]],
    ['งานของฉัน', [['leaves', 'ใบลา', 'form'], ['swap', 'แลกคาบ / สอนแทน', 'swap'], ['general', 'แจ้งซ่อม / ขอใช้สถานที่', 'gear'], ['affairs', 'บันทึกพฤติกรรมนักเรียน', 'shield'], ['activities', 'กิจกรรมนักเรียน', 'star']]],
    ['เอกสาร', [['files', 'ไฟล์บน Drive', 'folder'], ['calendar', 'ปฏิทินวิชาการ', 'cal']]],
    ['บัญชี', [['profile', 'ข้อมูลของฉัน', 'user'], ['personal', 'ประวัติส่วนตัว', 'lock']]]
  ],
  admin: [
    [null, [['a-dash', 'ภาพรวม', 'grid'], ['a-approve', 'รออนุมัติ', 'inbox']]],
    ['ฝ่ายงาน', [['a-academic', 'ฝ่ายวิชาการ', 'cal'], ['a-measure', 'ฝ่ายวัดผล', 'score'], ['a-hr', 'ฝ่ายบุคคล', 'users'], ['a-leaves', 'การลาและการอนุมัติ', 'form'], ['a-affairs', 'กิจการนักเรียน', 'shield'], ['a-general', 'บริหารทั่วไป', 'gear'], ['a-exec', 'สรุปผู้บริหาร', 'bar']]],
    ['ข้อมูลหลัก', [['a-students', 'นักเรียน', 'school'], ['a-users', 'ผู้ใช้และสิทธิ์', 'user'], ['a-courses', 'ห้องและรายวิชา', 'book'], ['a-import', 'นำเข้าข้อมูล', 'up']]],
    ['ระบบ', [['a-drive', 'Drive และสำรองข้อมูล', 'cloud'], ['a-usage', 'การใช้งานและค่าใช้จ่าย', 'bar'], ['a-settings', 'ตั้งค่าโรงเรียน', 'gear']]]
  ],
  student: [[null, [['s-home', 'หน้าหลัก', 'home'], ['s-scores', 'คะแนนของฉัน', 'score'], ['s-att', 'เวลาเรียน', 'check'], ['s-conduct', 'พฤติกรรม / ความดี', 'star'], ['s-vol', 'จิตอาสา', 'clock']]]]
};
const TABS = {
  teacher: [['home', 'หน้าหลัก', 'home'], ['schedule', 'ตารางสอน', 'cal'], ['attendance', 'เช็กชื่อ', 'check'], ['scores', 'คะแนน', 'score']],
  admin: [['a-dash', 'ภาพรวม', 'grid'], ['a-approve', 'อนุมัติ', 'inbox'], ['a-measure', 'วัดผล', 'score'], ['a-users', 'ผู้ใช้', 'users']],
  student: [['s-home', 'หน้าหลัก', 'home'], ['s-scores', 'คะแนน', 'score'], ['s-att', 'เวลาเรียน', 'check'], ['s-conduct', 'พฤติกรรม', 'star']]
};
const VIEWS = { teacher: 'ครู', admin: 'ผู้ดูแลระบบ / ฝ่ายงาน', student: 'นักเรียน' };
const view = () => S.view in NAVG ? S.view : 'teacher';
const stu = () => { const c = cls(S.student.classId); return { c, s: c.students.find(x => x.id === S.student.id) || c.students[0] }; };
const homeOf = () => ({ teacher: 'home', admin: 'a-dash', student: 's-home' })[view()];
window.homeOf = homeOf;
const dot = k => k === 'a-approve' && S.pending.length ? `<span class="dot">${S.pending.length}</span>` : '';
const switcher = () => `<div class="field" style="margin:8px 0 0"><label class="f small muted" for="vsw">มุมมอง (โหมดตัวอย่าง)</label>
  <select id="vsw" class="in" data-act="setView" style="min-height:40px">${Object.entries(VIEWS).filter(([k]) => !window.EMSAllowedViews || EMSAllowedViews().indexOf(k) >= 0).map(([k, l]) => `<option value="${k}" ${view() === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;

window.renderChrome = function () {
  const v = view(), g = NAVG[v];
  const btn = ([k, l, i]) => `<button class="nav" data-act="go" data-p="${k}" ${page === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${dot(k)}</button>`;
  const who = v === 'student' ? { n: stu().s.name, r: 'นักเรียน ' + stu().c.name } : { n: S.me.name, r: ROLES[S.me.role] + ' · ' + S.me.dept };
  $('#side').innerHTML = `
    <div class="brand"><img src="icons/school-logo.png" alt="ตราโรงเรียนปากช่อง"><div><b>EMS</b><span>Education Management System<br>โรงเรียนปากช่อง</span></div></div>
    ${g.map(([t, items]) => (t ? `<div class="navgroup">${t}</div>` : '') + items.map(btn).join('')).join('')}
    <div class="grow"></div>
    ${switcher()}
    <button class="nav" type="button" data-sysmenu>${ic('grid')}<span>ระบบอื่นของโรงเรียน</span></button><button class="nav" data-act="theme">${ic('moon')}<span>สลับโหมดมืด/สว่าง</span></button>${window.EMSType ? EMSType.html() : ''}
    <button class="nav" data-act="go" data-p="prefs" ${page === 'prefs' ? 'aria-current="page"' : ''}>${ic('gear')}<span>ปรับแต่งการแสดงผล</span></button>
    <button class="nav" data-act="logout">${ic('out')}<span>ออกจากระบบ</span></button>
    <div class="who"><div class="avatar">${esc(who.n.replace(/^(ครู|ผอ\.)/, '').charAt(0))}</div><div><div class="n">${esc(who.n)}</div><div class="r">${esc(who.r)}</div></div></div>`;
  const tb = $('#tabbar'), tabs = TABS[v].concat([['more', 'เพิ่มเติม', 'more']]);
  tb.style.gridTemplateColumns = `repeat(${tabs.length},1fr)`;
  tb.innerHTML = tabs.map(([k, l, i]) => `<button class="tab" data-act="${k === 'more' ? 'more' : 'go'}" data-p="${k}" ${page === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${dot(k)}</button>`).join('');
};
window.EMSNav = { NAVG, view, switcher, stu };
window.openMore = () => modal(`<h2 style="margin-bottom:4px">เมนูทั้งหมด</h2>` +
  NAVG[view()].map(([t, items]) => (t ? `<div class="navgroup" style="padding-top:12px">${t}</div>` : '') +
    items.map(([k, l, i]) => `<button class="nav" data-act="go" data-p="${k}">${ic(i)}<span>${l}</span>${dot(k)}</button>`).join('')).join('') +
  `<div class="navgroup" style="padding-top:12px">อื่น ๆ</div>${switcher()}<button class="nav" type="button" data-sysmenu>${ic('grid')}<span>ระบบอื่นของโรงเรียน</span></button><button class="nav" data-act="theme">${ic('moon')}<span>สลับโหมดมืด/สว่าง</span></button>${window.EMSType ? EMSType.html() : ''}<button class="nav" data-act="go" data-p="prefs">${ic('gear')}<span>ปรับแต่งการแสดงผล</span></button><button class="nav" data-act="logout">${ic('out')}<span>ออกจากระบบ</span></button>`);

/* ---------- ตัวช่วย ---------- */
const rr = () => { const y = scrollY; render(); scrollTo(0, y); };
const head = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
const pillsOf = (list, cur, act) => `<div class="pills">${list.map(([k, l]) => `<button class="pill" aria-pressed="${k === cur}" data-act="${act}" data-k="${k}">${esc(l)}</button>`).join('')}</div>`;
const rowI = (ico, tone, t, sub, right = '') => `<div class="row"><div class="ico ${tone}">${ic(ico)}</div><div class="grow"><div class="t">${t}</div><div class="muted small">${sub}</div></div>${right}</div>`;
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const fmtN = v => { const n = parseFloat(v); return isFinite(n) ? String(Math.round(n * 100) / 100) : '–'; };
const sum = v => (v || []).reduce((a, b) => a + (+b || 0), 0);
const complete = v => v && v.length >= 4 && v.slice(0, 4).every(x => x !== '' && x != null);
const monthTH = ym => new Date(ym + '-01T00:00:00').toLocaleDateString((window.EMSLang && EMSLang.locale()) || 'th-TH', { month: 'long', year: 'numeric' });
const slotLabel = key => { const [d, p] = key.split('-'); return `${DAYS[d].slice(0, 1) === 'พ' && DAYS[d] === 'พฤหัสบดี' ? 'พฤ.' : DAYS[d].slice(0, 1) + '.'} คาบ ${+p + 1} · ${cls(S.tt[key]).name}`; };
const SW = { wait: ['รอเพื่อนครูตอบรับ', 'warn'], ok: ['รอฝ่ายวิชาการอนุมัติ', 'info'], done: ['เรียบร้อย', 'ok'], no: ['ไม่สำเร็จ', 'bad'] };
const CS = { draft: ['ร่าง', ''], submitted: ['รอหัวหน้าตรวจ', 'warn'], approved: ['อนุมัติแล้ว', 'ok'], revise: ['ส่งกลับแก้ไข', 'bad'] };
const CAT = { exam: ['สอบ', 'bad'], holiday: ['วันหยุด', 'gold'], activity: ['กิจกรรม', 'info'], meeting: ['ประชุม', 'ok'] };

/* ---------- ครู: แลกคาบ ---------- */
P.swap = () => {
  const inc = S.swaps.filter(s => s.to === S.me.name && s.status === 'wait');
  const mine = S.swaps.filter(s => s.from === S.me.name);
  return head('แลกคาบ', 'ขอแลกคาบกับเพื่อนครู — เพื่อนตอบรับแล้วจึงส่งให้ฝ่ายวิชาการอนุมัติ', `<button class="btn pri" data-act="newSwap">${ic('plus')}ขอแลกคาบ</button>`) +
    (inc.length ? `<div class="card"><h2>มีคนขอแลกกับคุณ</h2><div class="list">${inc.map(s => `<div class="row" style="flex-wrap:wrap">
      <div class="ico gold">${ic('swap')}</div><div class="grow"><div class="t">${esc(s.from)}</div><div class="muted small">${esc(s.fromSlot)} ↔ ${esc(s.toSlot)} · ${thDate(s.date)}<br>เหตุผล: ${esc(s.reason)}</div></div>
      <div style="display:flex;gap:8px"><button class="btn sm" data-act="swapAns" data-id="${s.id}" data-v="no">ปฏิเสธ</button><button class="btn sm pri" data-act="swapAns" data-id="${s.id}" data-v="ok">ตอบรับ</button></div></div>`).join('')}</div></div>` : '') +
    `<div class="card"><h2>คำขอของฉัน</h2>${mine.length ? `<div class="list">${mine.map(s => rowI('swap', 'info', `${esc(s.fromSlot)} ↔ ${esc(s.toSlot)}`, `กับ ${esc(s.to)} · ${thDate(s.date)}`, chip(...SW[s.status]))).join('')}</div>` : '<div class="empty">ยังไม่มีคำขอแลกคาบ</div>'}</div>`;
};

/* ---------- ครู: กิจกรรมนักเรียน ---------- */
let actId = null;
P.activities = () => {
  actId = actId || S.activities[0].id;
  const a = S.activities.find(x => x.id === actId), st = names(a.cls), r = S.actRes[a.id] || {};
  const done = st.filter(s => r[s.id]).length, pass = st.filter(s => r[s.id] === 'p').length;
  return head('กิจกรรมนักเรียน', 'บันทึกผลผ่าน / ไม่ผ่าน ของชุมนุมและกิจกรรมพัฒนาผู้เรียน') +
    pillsOf(S.activities.map(x => [x.id, x.name]), actId, 'actPick') +
    `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><div class="t">${esc(a.name)}</div><div class="muted small">${esc(a.when)} · บันทึกแล้ว ${done}/${st.length} · ผ่าน ${pass}</div></div>
      <button class="btn sm" data-act="actAll">ผ่านทั้งหมด</button></div>
      <div class="bar" style="margin-bottom:8px"><i style="width:${st.length ? done / st.length * 100 : 0}%"></i></div>
      <div class="list">${st.map(s => `<div class="row"><div class="muted small" style="width:26px">${s.no}</div><div class="grow t">${esc(s.name)}</div>
        <div class="seg">${[['p', 'ผ่าน'], ['a', 'ไม่ผ่าน']].map(([k, l]) => `<button class="${k}" aria-pressed="${r[s.id] === k}" data-act="actMark" data-s="${s.id}" data-v="${k}">${l}</button>`).join('')}</div></div>`).join('')}</div></div>`;
};

/* ---------- ครู: โครงสร้างรายวิชา ---------- */
P.course = () => {
  const mine = S.courseSub.filter(c => c.by === S.me.name);
  return head('โครงสร้างรายวิชา', 'กำหนดสัดส่วนคะแนนแล้วส่งให้หัวหน้ากลุ่มสาระตรวจ') +
    `<div class="card"><div class="muted small" style="margin-bottom:6px">สัดส่วนคะแนนมาตรฐาน (รวม 100)</div>
      <div class="ems-segbar" style="display:flex;height:30px;border-radius:8px;overflow:hidden;font-size:.8rem;font-weight:600;color:#fff">
        <div style="flex:40;background:var(--brand);display:grid;place-items:center">งาน 40</div><div style="flex:20;background:var(--gold);display:grid;place-items:center">กลางภาค 20</div><div style="flex:40;background:var(--info);display:grid;place-items:center">ปลายภาค 40</div></div></div>
    <div class="card"><h2>รายวิชาของฉัน</h2><div class="list">${mine.map(c => { const [l, k] = CS[c.status];
      return `<div class="row" style="flex-wrap:wrap"><div class="ico">${ic('book')}</div><div class="grow"><div class="t">${esc(c.label)}</div>${c.note ? `<div class="small" style="color:var(--bad)">หัวหน้าแจ้ง: ${esc(c.note)}</div>` : ''}</div>
        ${chip(l, k)}${c.status === 'draft' || c.status === 'revise' ? `<button class="btn sm pri" data-act="crsSend" data-id="${c.id}">ส่งตรวจ</button>` : ''}</div>`; }).join('') || '<div class="empty">ไม่มีรายวิชา</div>'}</div></div>`;
};

/* ---------- ครู: รายงาน / ปพ.5 ---------- */
let prCls = null, prType = 'p5';
P.print = () => {
  prCls = prCls || S.classes[0].id;
  const c = cls(prCls), bk = EMSBook.book(prCls);
  const body = prType === 'p5'
    ? `<thead><tr><th>ที่</th><th>ชื่อ-สกุล</th><th>ก่อนกลางภาค<br><span class="muted">${fmtN(bk.weights.before)}</span></th><th>กลางภาค<br><span class="muted">${fmtN(bk.weights.mid)}</span></th><th>หลังกลางภาค<br><span class="muted">${fmtN(bk.weights.after)}</span></th><th>ปลายภาค<br><span class="muted">${fmtN(bk.weights.final)}</span></th><th>รวม 100</th><th>เกรด</th></tr></thead><tbody>${c.students.map(s => { const r = EMSBook.calcRow(bk, s);
        return `<tr><td>${s.no}</td><td>${esc(s.name)}</td>${[r.wBefore, r.wM, r.wAfter, r.wF].map(v => `<td>${r.any ? v : '–'}</td>`).join('')}<td><b>${r.any ? r.total : '–'}</b></td><td>${r.any ? r.grade : '–'}</td></tr>`; }).join('')}</tbody>`
    : `<thead><tr><th>ที่</th><th>ชื่อ-สกุล</th><th>มา</th><th>ลา</th><th>ขาด</th><th>ร้อยละ</th></tr></thead><tbody>${c.students.map((s, i) => { const a = (i * 3) % 5, l = i % 3, m = 38 - a - l;
        return `<tr><td>${s.no}</td><td>${esc(s.name)}</td><td>${m}</td><td>${l}</td><td>${a}</td><td><b>${Math.round(m / 38 * 100)}%</b></td></tr>`; }).join('')}</tbody>`;
  return head('รายงาน / ปพ.5', 'ตรวจตัวอย่างก่อนพิมพ์ หรือบันทึกเป็น PDF เก็บไว้ใน Drive',
      `<button class="btn" data-act="prPdf">${ic('cloud')}บันทึก PDF ลง Drive</button><button class="btn pri" data-act="prPrint">${ic('print')}พิมพ์</button>`) +
    pillsOf(S.classes.map(x => [x.id, x.name]), prCls, 'prCls') +
    pillsOf([['p5', 'สรุปคะแนน (ปพ.5)'], ['att', 'สรุปเวลาเรียน']], prType, 'prType') +
    `<div class="card" style="padding:24px"><div style="display:flex;gap:14px;align-items:center;margin-bottom:16px"><img src="icons/school-logo.png" alt="" style="width:52px">
      <div><b>โรงเรียนปากช่อง</b><div class="muted small">${prType === 'p5' ? 'สรุปผลการเรียน' : 'สรุปเวลาเรียน'} · ${esc(c.subject)} · ${esc(c.name)} · ภาคเรียนที่ ${S.term.sem}/${S.term.year}</div></div></div>
      <div class="scroll"><table class="tbl">${body}</table></div>
      <div class="muted small" style="margin-top:14px">ครูผู้สอน ${esc(S.me.name)}</div></div>`;
};

/* ---------- ครู/ทุกคน: ปฏิทินวิชาการ ---------- */
const cal = edit => {
  const ev = S.events.slice().sort((a, b) => a.date.localeCompare(b.date)), months = [...new Set(ev.map(e => e.date.slice(0, 7)))];
  return head('ปฏิทินวิชาการ', 'วันสอบ วันหยุด กิจกรรม และการประชุมของโรงเรียน', edit ? `<button class="btn pri" data-act="evAdd">${ic('plus')}เพิ่มกำหนดการ</button>` : '') +
    (months.map(m => `<div class="card"><h2>${monthTH(m)}</h2><div class="list">${ev.filter(e => e.date.startsWith(m)).map(e => `<div class="row">
      <div style="width:52px;text-align:center"><div style="font-size:1.4rem;font-weight:700;line-height:1.1">${+e.date.slice(8)}</div><div class="muted small">${new Date(e.date + 'T00:00:00').toLocaleDateString((window.EMSLang && EMSLang.locale()) || 'th-TH', { weekday: 'short' })}</div></div>
      <div class="grow t">${esc(e.title)}</div>${chip(...CAT[e.cat])}${edit ? `<button class="btn sm ghost" data-act="evDel" data-id="${e.id}" aria-label="ลบ ${esc(e.title)}">ลบ</button>` : ''}</div>`).join('')}</div></div>`).join('') || '<div class="card empty">ยังไม่มีกำหนดการ</div>');
};
P.calendar = () => cal(false);
P['a-calendar'] = () => cal(true);

/* ---------- ครู: ข้อมูลของฉัน ---------- */
P.profile = () => {
  const L = S.profile.leave, labels = { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'พักผ่อน' }, load = Object.keys(S.tt).length;
  return head('ข้อมูลของฉัน', '') +
    `<div class="grid split"><div class="card"><div style="display:flex;gap:14px;align-items:center;margin-bottom:16px"><div class="avatar" style="width:56px;height:56px;font-size:1.4rem">${esc(S.me.name.replace(/^ครู/, '').charAt(0))}</div>
      <div><div class="t" style="font-size:1.1rem;font-weight:700">${esc(S.me.name)}</div><div class="muted">${ROLES[S.me.role]} · ${esc(S.me.dept)}</div></div></div>
      <div class="field"><label class="f" for="pf-m">อีเมล (ล็อกอิน)</label><input id="pf-m" class="in" value="somchai@example.com" disabled></div>
      <div class="field"><label class="f" for="pf-p">เบอร์โทร</label><input id="pf-p" class="in" inputmode="tel" value="${esc(S.profile.phone)}" data-act="profPhone"></div>
      <div class="muted small">ชื่อและกลุ่มสาระแก้ได้ที่ฝ่ายบุคคล</div></div>
    <div><div class="card kpi"><div class="l">ภาระสอน</div><div class="v">${load}<span class="muted" style="font-size:1rem"> คาบ/สัปดาห์</span></div></div>
    <div class="card"><h2>วันลาสะสม ภาคเรียนนี้</h2>${Object.entries(L).map(([k, [u, t]]) => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><span>${labels[k]}</span><span class="muted">${u}/${t} วัน</span></div><div class="bar"><i style="width:${u / t * 100}%"></i></div></div>`).join('')}</div></div></div>`;
};

/* ---------- แอดมิน: วัดผล ---------- */
P['a-measure'] = () => {
  const rows = S.classes.map(c => { const bk = EMSBook.book(c.id), n = c.students.filter(s => EMSBook.calcRow(bk, s).complete).length; return { c, n, t: c.students.length, pub: !!S.published[c.id] }; });
  return head('ฝ่ายวัดผล', 'ตามความคืบหน้าการกรอกคะแนน แล้วประกาศผลให้นักเรียนเห็นเมื่อครบ') +
    `<div class="grid g3" style="margin-bottom:16px"><div class="card kpi"><div class="l">รายวิชาทั้งหมด</div><div class="v">${rows.length}</div></div>
      <div class="card kpi"><div class="l">กรอกครบ</div><div class="v" style="color:var(--ok)">${rows.filter(r => r.n === r.t).length}</div></div>
      <div class="card kpi"><div class="l">ยังค้าง</div><div class="v" style="color:var(--warn)">${rows.filter(r => r.n < r.t).length}</div></div></div>
    <div class="card"><div class="list">${rows.map(r => `<div class="row" style="flex-wrap:wrap"><div class="grow" style="min-width:200px"><div class="t">${esc(r.c.name)} · ${esc(r.c.subject)}</div>
      <div class="bar" style="margin-top:6px"><i style="width:${r.n / r.t * 100}%"></i></div><div class="muted small">กรอกครบ ${r.n}/${r.t} คน · ${esc(S.me.name)}</div></div>
      ${r.n === r.t ? chip('ครบ', 'ok') : chip('ค้าง', 'warn')}
      <button class="btn sm ${r.pub ? '' : 'pri'}" data-act="pubToggle" data-c="${r.c.id}" ${r.n < r.t ? 'disabled style="opacity:.5"' : ''}>${r.pub ? 'ยกเลิกประกาศ' : 'ประกาศผล'}</button></div>`).join('')}</div></div>`;
};

/* ---------- แอดมิน: ตรวจรายวิชา ---------- */
P['a-review'] = () => head('ตรวจรายวิชา', 'หัวหน้ากลุ่มสาระตรวจโครงสร้างรายวิชาที่ครูส่งมา') +
  `<div class="card"><div class="list">${S.courseSub.map(c => { const [l, k] = CS[c.status];
    return `<div class="row" style="flex-wrap:wrap"><div class="ico">${ic('book')}</div><div class="grow"><div class="t">${esc(c.label)}</div><div class="muted small">${esc(c.by)}</div></div>${chip(l, k)}
      ${c.status === 'submitted' ? `<button class="btn sm" data-act="crsAns" data-id="${c.id}" data-v="revise">ส่งกลับแก้ไข</button><button class="btn sm pri" data-act="crsAns" data-id="${c.id}" data-v="approved">อนุมัติ</button>` : ''}</div>`; }).join('')}</div></div>`;

/* ---------- แอดมิน: ฝ่ายบุคคล ---------- */
P['a-hr'] = () => head('ฝ่ายบุคคล', 'ภาระสอนและวันลาของบุคลากร', `<input class="in" style="width:220px" placeholder="ค้นหาชื่อ" data-act="filter" data-t="#hr-t" aria-label="ค้นหาบุคลากร">`) +
  `<div class="card"><div class="scroll"><table class="tbl" id="hr-t"><thead><tr><th>ชื่อ</th><th>ฝ่าย/กลุ่มสาระ</th><th>คาบ/สัปดาห์</th><th>วันลาสะสม</th><th>สถานะ</th></tr></thead><tbody>
  ${S.staff.map((u, i) => { const load = 12 + (i * 5) % 12, lv = (i * 3) % 11;
    return `<tr data-row><td><b>${esc(u.name)}</b></td><td>${esc(u.dept)}</td><td>${load}</td><td>${lv} วัน</td><td>${lv >= 8 ? chip('ใกล้ครบสิทธิ์', 'warn') : chip('ปกติ', 'ok')}</td></tr>`; }).join('')}
  </tbody></table></div></div>`;

/* ---------- แอดมิน: สรุปผู้บริหาร ---------- */
P['a-exec'] = () => {
  if (window.EMSExecCore) return EMSExecCore();            // ข้อมูลจริงจาก depts.js
  const pts = [91, 92, 90, 93, 94, 92, 95, 93, 91, 94, 93, 96], W = 560, H = 170;
  const xy = pts.map((v, i) => [10 + i * (W - 20) / (pts.length - 1), H - 22 - (v - 86) / 14 * (H - 44)]);
  const depts = [['วิทยาศาสตร์', 14], ['คณิตศาสตร์', 9], ['ภาษาไทย', 11], ['ภาษาต่างประเทศ', 6], ['สังคมศึกษา', 8]];
  return head('สรุปผู้บริหาร', 'ภาพรวมโรงเรียนในหน้าเดียว · อ่านอย่างเดียว') +
    `<div class="grid g4"><div class="card kpi"><div class="l">นักเรียน</div><div class="v">1,284</div><div class="s muted">ตัวเลขตัวอย่าง</div></div>
      <div class="card kpi"><div class="l">บุคลากร</div><div class="v">${S.staff.length + 80}</div></div>
      <div class="card kpi"><div class="l">มาเรียนเฉลี่ย</div><div class="v">93%</div><div class="s" style="color:var(--ok)">▲ 1.2% จากเดือนก่อน</div></div>
      <div class="card kpi"><div class="l">เกรดเฉลี่ยรวม</div><div class="v">3.12</div></div></div>
    <div class="grid split" style="margin-top:16px"><div class="card"><h2>อัตราการมาเรียนรายสัปดาห์ (%)</h2>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="กราฟเส้นอัตราการมาเรียน 12 สัปดาห์ อยู่ระหว่าง 90 ถึง 96 เปอร์เซ็นต์">
        ${[90, 95].map(g => { const y = H - 22 - (g - 86) / 14 * (H - 44); return `<line x1="10" x2="${W - 10}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${W - 10}" y="${y - 4}" text-anchor="end" font-size="11" fill="var(--muted)">${g}</text>`; }).join('')}
        <polyline fill="none" stroke="var(--brand)" stroke-width="3" stroke-linejoin="round" points="${xy.map(p => p.join(',')).join(' ')}"/>
        ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--brand)"/>${i % 3 === 0 || i === pts.length - 1 ? `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="11" fill="var(--text)">${pts[i]}</text>` : ''}`).join('')}
      </svg></div>
      <div class="card"><h2>วันลาแยกกลุ่มสาระ</h2>${depts.map(([n, v]) => `<div class="row" style="border:0;padding:6px 0"><div style="width:96px;font-size:.9rem">${n}</div><div class="bar grow"><i style="width:${v / 14 * 100}%"></i></div><div style="width:28px;text-align:right">${v}</div></div>`).join('')}</div></div>
    <div class="card"><h2>รอการตัดสินใจ</h2>${(window.EMSPendingItems ? EMSPendingItems() : []).length ? `<div class="list">${EMSPendingItems().slice(0, 5).map(p => rowI(p.icon, 'gold', esc(p.what), `${esc(p.who)} · ${thDate(p.date)}`)).join('')}</div>` : '<div class="empty">ไม่มีรายการค้าง</div>'}</div>`;
};

/* ---------- แอดมิน: นักเรียน ---------- */
P['a-students'] = () => head('นักเรียน', 'รายชื่อนักเรียนทุกห้อง', `<button class="btn" data-act="go" data-p="a-import">${ic('up')}นำเข้าจากไฟล์</button><button class="btn pri" data-act="stAdd">${ic('plus')}เพิ่มนักเรียน</button>`) +
  `<div class="field"><input class="in" placeholder="ค้นหาชื่อหรือห้อง" data-act="filter" data-t="#st-t" aria-label="ค้นหานักเรียน"></div>
  <div class="card"><div class="scroll"><table class="tbl" id="st-t"><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th><th>ห้อง</th><th>สถานะ</th></tr></thead><tbody>
  ${S.classes.flatMap(c => c.students.map(s => `<tr data-row><td>${s.no}</td><td><b>${esc(s.name)}</b></td><td>${esc(c.name)}</td><td>${chip('ปกติ', 'ok')}</td></tr>`)).join('')}
  </tbody></table></div></div>`;

/* ---------- แอดมิน: นำเข้าข้อมูล ---------- */
const imp = { type: 'student', step: 1, rows: [], file: '', issues: 0, done: 0 };
const TPL = { student: 'ชื่อ-สกุล,ห้อง\nสมหญิง ตัวอย่าง,ม.1/3\n', staff: 'ชื่อ-สกุล,อีเมล,กลุ่มสาระ\nครูตัวอย่าง ใจดี,teacher@example.com,วิทยาศาสตร์\n' };
const parseCSV = txt => txt.replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(',').map(x => x.trim()));
P['a-import'] = () => {
  const steps = ['เลือกประเภท', 'เลือกไฟล์', 'ตรวจสอบ', 'เสร็จสิ้น'];
  const stepper = `<div class="pills">${steps.map((s, i) => `<span class="chip ${imp.step === i + 1 ? 'gold' : imp.step > i + 1 ? 'ok' : ''}">${i + 1}. ${s}</span>`).join('')}</div>`;
  let body = '';
  if (imp.step === 1) body = `<div class="card"><h2>จะนำเข้าข้อมูลอะไร</h2>${pillsOf([['student', 'รายชื่อนักเรียน'], ['staff', 'รายชื่อครู/บุคลากร']], imp.type, 'impType')}
    <p class="muted small" style="margin-bottom:14px">ไฟล์ .csv (Excel → บันทึกเป็น CSV UTF-8) คอลัมน์: ${imp.type === 'student' ? 'ชื่อ-สกุล, ห้อง (เช่น ม.1/3)' : 'ชื่อ-สกุล, อีเมล, กลุ่มสาระ'}</p>
    <a class="btn" download="แม่แบบ-${imp.type}.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + TPL[imp.type])}">${ic('down')}ดาวน์โหลดแม่แบบ</a>
    <button class="btn pri" data-act="impGo" data-s="2" style="margin-left:8px">ถัดไป</button></div>`;
  if (imp.step === 2) body = `<div class="card"><h2>เลือกไฟล์ CSV</h2>
    <label class="empty" style="display:block;border:2px dashed var(--line);border-radius:var(--r);cursor:pointer" for="imp-f">${ic('up', '')}<div class="t" style="margin-top:6px">แตะเพื่อเลือกไฟล์</div><div class="small">ตรวจสอบในเครื่องนี้ ยังไม่ส่งไปที่ใด</div></label>
    <input id="imp-f" class="sr" type="file" accept=".csv,text/csv" data-act="impFile">
    <div style="margin-top:14px"><button class="btn" data-act="impGo" data-s="1">ย้อนกลับ</button></div></div>`;
  if (imp.step === 3) { const ok = imp.rows.filter(r => !r.err);
    body = `<div class="card"><h2>ตรวจสอบ · ${esc(imp.file)}</h2><div class="pills"><span class="chip ok">ใช้ได้ ${ok.length}</span><span class="chip ${imp.issues ? 'bad' : ''}">มีปัญหา ${imp.issues}</span></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>#</th><th>${imp.type === 'student' ? 'ชื่อ-สกุล</th><th>ห้อง' : 'ชื่อ-สกุล</th><th>อีเมล'}</th><th>ผลตรวจ</th></tr></thead><tbody>
    ${imp.rows.slice(0, 40).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.a)}</td><td>${esc(r.b)}</td><td>${r.err ? chip(esc(r.err), 'bad') : chip('ใช้ได้', 'ok')}</td></tr>`).join('')}</tbody></table></div>
    <div style="margin-top:14px;display:flex;gap:8px"><button class="btn" data-act="impGo" data-s="2">เลือกไฟล์ใหม่</button><button class="btn pri" data-act="impRun" ${ok.length ? '' : 'disabled style="opacity:.5"'}>นำเข้า ${ok.length} รายการ</button></div></div>`; }
  if (imp.step === 4) body = `<div class="card empty">${chip('สำเร็จ', 'ok')}<div class="t" style="margin:10px 0;color:var(--text)">นำเข้าแล้ว ${imp.done} รายการ</div>
    <button class="btn" data-act="impReset">นำเข้าไฟล์อื่น</button> <button class="btn pri" data-act="go" data-p="${imp.type === 'student' ? 'a-students' : 'a-users'}">ดูรายชื่อ</button></div>`;
  return head('นำเข้าข้อมูล', 'ตรวจไฟล์ให้ก่อนนำเข้า — แถวที่มีปัญหาจะไม่ถูกนำเข้า') + stepper + body;
};

/* ---------- นักเรียน ---------- */
const SUBJ = [['ว30101 ฟิสิกส์ 1', 'm4-2'], ['ค31101 คณิตศาสตร์', null, [18, 16, 14, 31]], ['ท31101 ภาษาไทย', null, [19, 18, 17, 33]], ['อ31101 ภาษาอังกฤษ', null, [17, 15, 13, 28]]];
P['s-home'] = () => { const { c, s } = stu();
  return head('สวัสดี ' + esc(s.name.split(' ')[0]), `นักเรียน ${esc(c.name)} · เลขที่ ${s.no}`) +
    `<div class="grid g3"><div class="card kpi"><div class="l">เวลาเรียนภาคนี้</div><div class="v">95%</div><div class="s" style="color:var(--ok)">ผ่านเกณฑ์ 80%</div></div>
      <div class="card kpi"><div class="l">วิชาที่ประกาศผลแล้ว</div><div class="v">${SUBJ.filter((x, i) => i > 0 || S.published[c.id]).length}/${SUBJ.length}</div></div>
      <div class="card kpi"><div class="l">คาบถัดไป</div><div class="v" style="font-size:1.25rem;padding:6px 0">ฟิสิกส์ 1</div><div class="s muted">${PERIODS[0][0]} น.</div></div></div>
    <div class="card" style="margin-top:16px"><h2>ประกาศ</h2>${S.events.slice(0, 3).map(e => rowI('cal', 'gold', esc(e.title), thDate(e.date))).join('')}</div>`; };
P['s-scores'] = () => { const { c, s } = stu(), pub = !!S.published[c.id];
  const rows = SUBJ.map(([n, cid, fix]) => {
    let p = null, show = true;
    if (cid) { const r = EMSBook.calcRow(EMSBook.book(cid), s); p = r.any ? { v: [r.wBefore, r.wM, r.wAfter, r.wF], t: r.total, g: r.grade } : null; show = pub; }
    else { const t = sum(fix); p = { v: [fix[0] + fix[1], fix[2], 0, fix[3]], t, g: grade(t) }; }
    return `<tr><td>${esc(n)}</td>${show && p ? p.v.map(x => `<td>${x}</td>`).join('') + `<td><b>${p.t}</b></td><td>${chip(esc(p.g), p.t >= 50 ? 'ok' : 'bad')}</td>` : `<td colspan="6" class="muted">ครูยังไม่ประกาศผล</td>`}</tr>`; }).join('');
  return head('คะแนนของฉัน', `ภาคเรียนที่ ${S.term.sem}/${S.term.year}`) +
    `<div class="card"><div class="scroll"><table class="tbl"><thead><tr><th>วิชา</th><th>ก่อนกลางภาค</th><th>กลางภาค</th><th>หลังกลางภาค</th><th>ปลายภาค</th><th>รวม</th><th>เกรด</th></tr></thead><tbody>${rows}</tbody></table></div></div>`; };
P['s-att'] = () => head('เวลาเรียน', 'สรุปรายเดือน') +
  `<div class="card">${[['กรกฎาคม', 96], ['สิงหาคม', 94], ['กันยายน', 92], ['ตุลาคม', 100]].map(([m, v]) => `<div class="row" style="border:0;padding:8px 0"><div style="width:90px">${m}</div><div class="bar grow"><i style="width:${v}%"></i></div><div style="width:48px;text-align:right">${v}%</div></div>`).join('')}</div>`;

/* ---------- เหตุการณ์ ---------- */
const ask = (id, label, type = 'text') => `<div class="field"><label class="f" for="${id}">${label}</label><input id="${id}" class="in" type="${type}"></div>`;
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, d = t.dataset;
  switch (a) {
    case 'newSwap': {
      const opts = Object.keys(S.tt).sort().map(k => `<option value="${k}">${slotLabel(k)}</option>`).join('');
      return modal(`<h2 style="margin-bottom:12px">ขอแลกคาบ</h2>
        <div class="field"><label class="f" for="sw-a">คาบของฉัน</label><select id="sw-a" class="in">${opts}</select></div>
        <div class="field"><label class="f" for="sw-t">แลกกับ</label><select id="sw-t" class="in">${S.staff.filter(u => u.name !== S.me.name && u.role !== 'admin' && u.role !== 'exec' && (u.roles || [u.role]).indexOf('vacant') < 0).map(u => `<option>${esc(u.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="f" for="sw-b">คาบของเพื่อนครู</label><input id="sw-b" class="in" placeholder="เช่น พฤ. คาบ 2 · ม.2/1"></div>
        <div class="field"><label class="f" for="sw-d">วันที่</label><input id="sw-d" class="in" type="date" value="${todayISO()}"></div>
        <div class="field"><label class="f" for="sw-r">เหตุผล</label><input id="sw-r" class="in"></div>
        <button class="btn pri" style="width:100%" data-act="saveSwap">ส่งคำขอ</button>`, matchMedia('(min-width:861px)').matches);
    }
    case 'saveSwap': {
      const b = $('#sw-b').value.trim(); if (!b) { $('#sw-b').focus(); return toast('กรุณากรอกคาบของเพื่อนครู'); }
      S.swaps.unshift({ id: Date.now(), from: S.me.name, to: $('#sw-t').value, fromSlot: slotLabel($('#sw-a').value), toSlot: b, date: $('#sw-d').value || todayISO(), status: 'wait', reason: $('#sw-r').value.trim() || '-' });
      save(); closeModal(); toast('ส่งคำขอแล้ว'); return rr();
    }
    case 'swapAns': { const s = S.swaps.find(x => x.id == d.id); if (!s) return; s.status = d.v;
      if (d.v === 'ok') S.pending.unshift({ id: s.id, who: s.from, what: `แลกคาบ ${s.fromSlot} ↔ ${s.toSlot} (กับ${s.to.replace(/^ครู/, 'ครู')})`, date: s.date, type: 'swap' });
      save(); toast(d.v === 'ok' ? 'ตอบรับแล้ว ส่งฝ่ายวิชาการต่อ' : 'ปฏิเสธแล้ว'); return rr(); }
    case 'decide': { const s = S.swaps.find(x => x.id == d.id); if (s) { s.status = d.v === 'approved' ? 'done' : 'no'; save(); } return; }
    case 'actPick': actId = d.k; return rr();
    case 'actMark': { const r = S.actRes[actId] = S.actRes[actId] || {}; if (r[d.s] === d.v) delete r[d.s]; else r[d.s] = d.v; save(); return rr(); }
    case 'actAll': { const r = S.actRes[actId] = {}; names(S.activities.find(x => x.id === actId).cls).forEach(s => r[s.id] = 'p'); save(); return rr(); }
    case 'crsSend': { const c = S.courseSub.find(x => x.id == d.id); c.status = 'submitted'; c.note = ''; save(); toast('ส่งให้หัวหน้ากลุ่มสาระแล้ว'); return rr(); }
    case 'crsAns': { const c = S.courseSub.find(x => x.id == d.id); c.status = d.v; if (d.v === 'revise') c.note = 'กรุณาตรวจสัดส่วนคะแนนและตัวชี้วัดอีกครั้ง'; save(); toast(d.v === 'approved' ? 'อนุมัติแล้ว' : 'ส่งกลับแก้ไขแล้ว'); return rr(); }
    case 'prCls': prCls = d.k; return rr();
    case 'prType': prType = d.k; return rr();
    case 'prPrint': return window.print();
    case 'prPdf': return ems.drive.exportCopy('EMS/2569-ภาคเรียน 1/คะแนน', prCls + '.pdf').then(() => toast('บันทึก PDF ลง Drive แล้ว (ตัวอย่าง)'));
    case 'evAdd': return modal(`<h2 style="margin-bottom:12px">เพิ่มกำหนดการ</h2>${ask('ev-t', 'ชื่อกิจกรรม')}${ask('ev-d', 'วันที่', 'date')}
      <div class="field"><label class="f" for="ev-c">ประเภท</label><select id="ev-c" class="in">${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      <button class="btn pri" style="width:100%" data-act="evSave">เพิ่ม</button>`, true);
    case 'evSave': { const ti = $('#ev-t').value.trim(), da = $('#ev-d').value; if (!ti || !da) return toast('กรุณากรอกชื่อและวันที่');
      S.events.push({ id: Date.now(), date: da, title: ti, cat: $('#ev-c').value }); save(); closeModal(); toast('เพิ่มแล้ว'); return rr(); }
    case 'evDel': S.events = S.events.filter(x => x.id != d.id); save(); return rr();
    case 'pubToggle': S.published[d.c] = !S.published[d.c]; save(); toast(S.published[d.c] ? 'ประกาศผลให้นักเรียนแล้ว' : 'ยกเลิกประกาศแล้ว'); return rr();
    case 'stAdd': return modal(`<h2 style="margin-bottom:12px">เพิ่มนักเรียน</h2>${ask('st-n', 'ชื่อ-สกุล')}
      <div class="field"><label class="f" for="st-c">ห้อง</label><select id="st-c" class="in">${S.classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <button class="btn pri" style="width:100%" data-act="stSave">เพิ่ม</button>`, true);
    case 'stSave': { const n = $('#st-n').value.trim(), cid = $('#st-c').value; if (!n) return toast('กรุณากรอกชื่อ');
      return void (window.EMSAudit ? EMSAudit.batch('เพิ่มนักเรียน · ' + ((cls(cid) || {}).name || cid), n, 'เพิ่มนักเรียน') : Promise.resolve(() => {})).then(ok => { if (!ok) return;
        const c = cls(cid); if (!c) return toast('ไม่พบห้อง ลองใหม่'); c.students.push({ id: 'n' + Date.now(), no: c.students.length + 1, name: n }); save(); ok('—', n); closeModal(); toast('เพิ่มแล้ว'); rr(); }); }
    case 'impType': imp.type = d.k; return rr();
    case 'impGo': imp.step = +d.s; return rr();
    case 'impReset': Object.assign(imp, { step: 1, rows: [], file: '', issues: 0, done: 0 }); return rr();
    case 'impRun': {
      if (imp.type === 'student' && window.EMSAudit && !imp.why) { const okN = imp.rows.filter(r => !r.err).length;      // ถามเหตุผลครั้งเดียว แล้วกดนำเข้าซ้ำให้เอง
        return void EMSAudit.batch('นำเข้ารายชื่อนักเรียน · ' + imp.file, okN + ' คน', 'นำเข้ารายชื่อนักเรียน').then(c => { if (!c) return; imp.why = c; const b = document.querySelector('[data-act="impRun"]'); if (b) b.click(); }); }
      const why = imp.why; imp.why = null;
      const ok = imp.rows.filter(r => !r.err); let n = 0;
      if (imp.type === 'student') ok.forEach(r => { let c = S.classes.find(x => x.name === r.b);
        if (!c) { c = { id: 'i' + r.b, name: r.b, subject: '-', students: [] }; S.classes.push(c); }
        c.students.push({ id: 'i' + Date.now() + n, no: c.students.length + 1, name: r.a }); n++; });
      else ok.forEach(r => { S.staff.push({ name: r.a, email: r.b, role: 'teacher', dept: r.c || '-' }); n++; });
      imp.done = n; imp.step = 4; save(); if (why) why('—', 'เพิ่ม ' + n + ' คน'); return rr();
    }
  }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.dataset.act === 'setView') { if (window.EMSAllowedViews && EMSAllowedViews().indexOf(t.value) < 0) { toast('บัญชีนี้ไม่มีสิทธิ์เปิดมุมมองนี้'); return render(); } S.view = t.value; save(); closeModal(); page = homeOf(); render(); scrollTo(0, 0); }
  if (t.dataset.act === 'profPhone') { S.profile.phone = t.value; save(); toast('บันทึกเบอร์โทรแล้ว'); }
  if (t.dataset.act === 'impFile' && t.files[0]) {
    const f = t.files[0], rd = new FileReader();
    rd.onload = () => {
      const lines = parseCSV(String(rd.result)); if (lines.length && /ชื่อ/.test(lines[0][0])) lines.shift();
      const seen = new Set(), emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      imp.rows = lines.map(c => { const r = { a: c[0] || '', b: c[1] || '', c: c[2] || '' }, k = r.a + '|' + r.b;
        r.err = !r.a ? 'ชื่อว่าง' : seen.has(k) ? 'ซ้ำในไฟล์' : imp.type === 'student' ? (/^ม\.[1-6]\/\d+$/.test(r.b) ? '' : 'ห้องต้องเป็นรูปแบบ ม.1/3') : (emailRe.test(r.b) ? '' : 'อีเมลไม่ถูกต้อง');
        seen.add(k); return r; });
      imp.issues = imp.rows.filter(r => r.err).length; imp.file = f.name; imp.step = 3; rr();
    };
    rd.readAsText(f, 'utf-8');
  }
});
document.addEventListener('input', e => {
  const t = e.target.closest('[data-act="filter"]'); if (!t) return;
  const q = t.value.trim().toLowerCase();
  document.querySelectorAll(t.dataset.t + ' [data-row]').forEach(r => { r.hidden = q && !r.textContent.toLowerCase().includes(q); });
});

/* ---------- เริ่ม ---------- */
save(); page = homeOf(); render();
})();
