/* EMS — ข้อมูลบุคลากร (ฝ่ายบุคคล): ภาพรวมข้อมูลที่ครูกรอกใน "ประวัติส่วนตัว" แยกฝ่าย / กลุ่มสาระ / รายบุคคล
   ข้อมูลส่วนตัวตัวจริงอยู่ที่ users/{อีเมล}.personal อ่านได้เฉพาะเจ้าของ → แอปของครูแต่ละคนส่งสำเนาไปที่ staffInfo/{อีเมลตัวเอง}
   เฉพาะช่องที่จำเป็นและไม่ได้ล็อก 🔒 (เบอร์โทร/อีเมลส่วนตัว ส่งเมื่อครูปลดล็อก) · ไม่ส่งเงินเดือนเลย
   ฝ่ายบุคคล/แอดมินอ่าน staffInfo ทุกคน (cloud.js slice siAll ฟังเฉพาะตอนเปิดหน้านี้) · rules: เขียนได้เฉพาะเอกสารของตัวเอง */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const top = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${right}</div></div>`;
  const rr = () => { const y = scrollY; render(); scrollTo(0, y); };
  const sortTh = (a, b) => String(a).localeCompare(String(b), 'th', { numeric: true });
  const isLive = () => typeof LIVE !== 'undefined' && !!LIVE;
  const low = v => String(v || '').trim().toLowerCase();
  const roles = () => [].concat((S.me && S.me.roles) || [], (S.me && S.me.role) || []);
  const bootAdm = () => ((window.EMS_CONFIG || {}).adminEmails || []).map(low).indexOf(low(S.me && S.me.email)) >= 0;
  /* ตรงกับ rules: อ่าน staffInfo ทุกคน = แอดมิน หรือฝ่ายบุคคล · โหมดตัวอย่าง = เห็น */
  const canSee = () => !isLive() || bootAdm() || roles().some(r => r === 'admin' || r === 'personnel');

  /* ---------- สำเนาที่ครูส่ง (สร้างจาก S.personal ของตัวเอง ตามโครงร่าง HR_API.md) ---------- */
  const PUB = ['prefix', 'firstName', 'lastName', 'fullName', 'birthDate', 'schoolEmail', 'teachLevels', 'teachMajor',
    'position', 'standing', 'rank', 'level', 'standingDate', 'rankDate', 'positionNo', 'appointDate', 'teacherDate',
    'licenseType', 'licenseNo', 'licenseIssue', 'licenseExpire'];
  const LOCKABLE = ['phone', 'altEmail', 'personalEmail', 'address'];          // ส่งเมื่อครูปลดล็อกเท่านั้น (ค่าเริ่มต้นล็อก · ไม่ส่ง nationalId / salary)
  const EDU = ['มัธยมศึกษาตอนปลาย', 'ประกาศนียบัตรวิชาชีพ (ปวช.)', 'ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)', 'ปริญญาตรี', 'ประกาศนียบัตรบัณฑิต', 'ปริญญาโท', 'ปริญญาเอก'];
  const isStandingVal = v => /^(ไม่มีวิทยฐานะ|ครูชำนาญ|ครูเชี่ยวชาญ)/.test(String(v || '').trim());
  function build() {
    const p = (window.EMSHr && EMSHr.norm) ? EMSHr.norm(S.personal || {}) : (S.personal || {});
    const f = p.fields || {}, locks = p.locks || {}, o = { v: 2, f: {}, hidden: [] };
    PUB.forEach(k => { const v = String(f[k] == null ? '' : f[k]).trim(); if (v) o.f[k] = v.slice(0, 200); });
    LOCKABLE.forEach(k => { const v = String(f[k] == null ? '' : f[k]).trim(); if (!v) return; if (locks[k] === false) o.f[k] = v.slice(0, 200); else o.hidden.push(k); });
    /* วุฒิ: นับเฉพาะแถวที่ครูกรอกจริง (รองรับทั้ง p.edu ตาม HR_API และ p.education เดิม) */
    const eduArr = Array.isArray(p.edu) && p.edu.length ? p.edu : (p.education || []);
    const rows = eduArr.filter(r => r && r.level && ['school', 'degree', 'major', 'year'].some(k => String(r[k] || '').trim()));
    const top_ = rows.map(r => String(r.level)).sort((a, b) => EDU.indexOf(b) - EDU.indexOf(a))[0];
    if (top_) { const row = rows.find(r => r.level === top_) || {}; o.edu = { level: top_, major: String(row.major || '').slice(0, 120) }; }
    const tr = (p.training || []).filter(r => r && (r.course || r.hours)); if (tr.length) o.train = { n: tr.length, hours: tr.reduce((s, r) => s + (+r.hours || 0), 0) };
    return o;
  }

  /* ---------- คำนวณ ---------- */
  const dayOfIso = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); if (!m) return null; let y = +m[1]; if (y > 2400) y -= 543; return new Date(y, +m[2] - 1, +m[3]); };
  const span = iso => { const d = dayOfIso(iso); if (!d) return null; const n = new Date(); let y = n.getFullYear() - d.getFullYear(), m = n.getMonth() - d.getMonth();
    if (n.getDate() < d.getDate()) m--; if (m < 0) { y--; m += 12; } return y < 0 ? null : { y, m }; };
  /** เกษียณ 30 ก.ย. ของปีงบประมาณที่อายุครบ 60 — เกิดตั้งแต่ 2 ต.ค. เลื่อนไปปีถัดไป · คืนปี พ.ศ. */
  const retireBE = iso => { const d = dayOfIso(iso); if (!d) return 0; const late = d.getMonth() > 9 || (d.getMonth() === 9 && d.getDate() >= 2); return d.getFullYear() + (late ? 61 : 60) + 543; };
  const fyBE = () => { const n = new Date(); return n.getFullYear() + (n.getMonth() >= 9 ? 1 : 0) + 543; };      // ปีงบประมาณปัจจุบัน (เริ่ม 1 ต.ค.)
  const daysTo = iso => { const d = dayOfIso(iso); return d ? Math.round((d - new Date()) / 86400000) : null; };
  const th = iso => { const d = dayOfIso(iso); return d ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  const licState = f => { if (!f.licenseNo && !f.licenseExpire) return ['none', 'ยังไม่กรอก', 'warn'];
    const n = daysTo(f.licenseExpire); if (n === null) return ['nodate', 'ไม่มีวันหมดอายุ', 'warn']; if (n < 0) return ['expired', 'หมดอายุแล้ว', 'bad'];
    if (n <= 180) return ['soon', 'เหลือ ' + n + ' วัน', 'bad']; return ['ok', 'ถึง ' + th(f.licenseExpire), 'ok']; };
  const NEED = [['birthDate', 'วันเกิด'], ['position', 'ตำแหน่ง'], ['appointDate', 'วันบรรจุ'], ['licenseNo', 'เลขที่ใบอนุญาต'], ['licenseExpire', 'วันหมดอายุใบอนุญาต']];
  const teaching = u => (u.roles && u.roles.length ? u.roles : [u.role || 'teacher']).some(r => r !== 'support');
  const needOf = (u, f) => NEED.filter(([k]) => !f[k] && (teaching(u) || !/^license/.test(k))).concat(/^ครู$|ครูผู้ช่วย/.test(f.position || '') || !f.position ? (f.rank ? [] : [['rank', 'วิทยฐานะ']]) : []);

  const ROLE_TH = { exec: 'ผู้บริหาร', academic: 'วิชาการ', measure: 'วัดผล', personnel: 'บุคคล', general: 'บริหารทั่วไป', affairs: 'กิจการนักเรียน', head: 'หัวหน้ากลุ่มสาระ',
    teacher: 'ครูผู้สอน', support: 'สายสนับสนุน', admin: 'ผู้ดูแลระบบ', coverer: 'จัดสอนแทน' };
  const rolesOf = u => (u.roles && u.roles.length ? u.roles : [u.role || 'teacher']).filter(r => r !== 'vacant' && r !== 'scanner');
  /** ข้อมูลใน staffInfo มาจากแอปของครูแต่ละคน (rules ไม่ตรวจเนื้อหา) — เหลือเฉพาะรูปที่คาดไว้ ก่อนนำไปแสดง */
  const clean = raw => { if (!raw || typeof raw !== 'object') return null; const d = raw.siMineDoc && typeof raw.siMineDoc === 'object' ? raw.siMineDoc : raw, f = {};
    PUB.concat(LOCKABLE).forEach(k => { const v = d.f && d.f[k]; if (v != null && typeof v !== 'object') f[k] = String(v).slice(0, 200); });
    /* ประสานคีย์รุ่น v1 (rank=วิทยฐานะ, level=อันดับ) กับรุ่น v2 ตาม HR_API.md (standing=วิทยฐานะ, rank=อันดับ) */
    const standing = f.standing || (isStandingVal(f.rank) ? f.rank : '');
    const rankLvl = isStandingVal(f.rank) ? (f.level || '') : (f.rank || f.level || '');
    f.standing = standing;
    f.rank = standing;     // คง f.rank = วิทยฐานะ และ f.level = อันดับ สำหรับตาราง/ตัวกรองในหน้านี้ พร้อมเก็บ f.hrRank = อันดับ
    f.level = rankLvl;
    f.hrRank = rankLvl;
    f.standingDate = f.standingDate || f.rankDate || '';
    f.rankDate = f.standingDate;
    f.altEmail = f.altEmail || f.personalEmail || '';
    f.personalEmail = f.altEmail;
    if (!f.fullName && (f.firstName || f.lastName)) f.fullName = [f.firstName, f.lastName].filter(Boolean).join(' ');
    const out = { f, hidden: Array.isArray(d.hidden) ? d.hidden.filter(x => typeof x === 'string') : [] };
    if (d.edu && typeof d.edu === 'object') out.edu = { level: String(d.edu.level || '').slice(0, 80), major: String(d.edu.major || '').slice(0, 120) };
    if (d.train && typeof d.train === 'object') out.train = { n: Math.max(0, +d.train.n || 0), hours: Math.max(0, +d.train.hours || 0) };
    return out; };
  const people = () => {
    const all = isLive() ? (S.siAll || {}) : { [low(S.me && S.me.email)]: { siMineDoc: build() } };
    return (S.staff || []).filter(u => rolesOf(u).length && (u.roles || [u.role]).indexOf('vacant') < 0).map(u => {
      const d = clean(all[low(u.email)]), f = (d && d.f) || {};
      const age = span(f.birthDate), svc = span(f.appointDate), ret = retireBE(f.birthDate), lic = licState(f);
      const name = f.fullName ? ((f.prefix || '') + f.fullName).trim() : u.name;
      return { u, d, f, name, dept: String(u.dept || '').trim() || '(ไม่ระบุกลุ่มสาระ)', roles: rolesOf(u), age, svc, ret, lic, need: d ? needOf(u, f) : null,
        phone: f.phone || u.phone || '', phoneHidden: !!(d && d.hidden.indexOf('phone') >= 0 && !u.phone), email: f.schoolEmail || u.email || '' };
    });
  };

  /* ---------- ตัวกรอง ---------- */
  const ui = { q: '', role: '', dept: '', pos: '', rank: '', lic: '', ret: '', data: '', group: 'dept', view: 'brief' };
  const pass = x => {
    const q = low(ui.q); if (q && !low([x.name, x.u.name, x.email, x.phone, x.dept, x.f.position, x.f.rank, x.f.licenseNo].join(' ')).includes(q)) return false;
    if (ui.role && x.roles.indexOf(ui.role) < 0) return false;
    if (ui.dept && x.dept !== ui.dept) return false;
    if (ui.pos && (x.f.position || '(ยังไม่กรอก)') !== ui.pos) return false;
    if (ui.rank && (x.f.rank || '(ยังไม่กรอก)') !== ui.rank) return false;
    if (ui.lic === 'bad' && !(x.lic[0] === 'expired' || x.lic[0] === 'soon')) return false;
    if (ui.lic === 'none' && !(x.lic[0] === 'none' || x.lic[0] === 'nodate')) return false;
    if (ui.ret) { if (!x.ret) return false; const d = x.ret - fyBE(); if (ui.ret === '0' ? d !== 0 : !(d >= 0 && d <= +ui.ret)) return false; }
    if (ui.data === 'none' && x.d) return false;
    if (ui.data === 'need' && !(x.d && x.need.length)) return false;
    if (ui.data === 'ok' && !(x.d && !x.need.length)) return false;
    return true;
  };
  const opts = (arr, cur, all) => `<option value="">${all}</option>` + arr.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const sel = (k, arr, all, label) => `<label class="muted small" style="display:flex;flex-direction:column;gap:2px;min-width:0">${label}<select class="in" data-si="${k}" style="min-height:36px">${opts(arr, ui[k], all)}</select></label>`;
  const ys = s => s ? s.y + ' ปี' + (s.m ? ' ' + s.m + ' ด.' : '') : '–';

  /* ---------- ตาราง ---------- */
  const COLS = {
    brief: [['ชื่อ-สกุล', x => `<a href="#" style="color:inherit;text-decoration:underline;text-underline-offset:3px" data-si-open="${esc(low(x.u.email) || x.u.name)}"><b>${esc(x.name)}</b></a>${x.d ? '' : ' ' + chip('ยังไม่ส่งข้อมูล', 'warn')}`],
      ['กลุ่มสาระ', x => esc(x.dept)], ['ตำแหน่ง · วิทยฐานะ', x => esc([x.f.position, x.f.rank && x.f.rank !== 'ไม่มีวิทยฐานะ' ? x.f.rank : ''].filter(Boolean).join(' · ') || '–')],
      ['เบอร์โทร', x => x.phone ? esc(x.phone) : x.phoneHidden ? '<span class="muted small">🔒 ไม่เปิดเผย</span>' : '–'],
      ['ใบอนุญาต', x => chip(esc(x.lic[1]), x.lic[2])], ['ข้อมูล', x => !x.d ? '–' : x.need.length ? chip('ขาด ' + x.need.length, 'warn') : chip('ครบ', 'ok')]],
    full: [['ชื่อ-สกุล', x => `<a href="#" style="color:inherit;text-decoration:underline;text-underline-offset:3px" data-si-open="${esc(low(x.u.email) || x.u.name)}"><b>${esc(x.name)}</b></a>${x.d ? '' : ' ' + chip('ยังไม่ส่งข้อมูล', 'warn')}`],
      ['กลุ่มสาระ · ฝ่าย', x => esc(x.dept) + `<div class="muted small">${x.roles.map(r => esc(ROLE_TH[r] || r)).join(', ')}</div>`],
      ['วันเกิด (อายุ)', x => x.f.birthDate ? esc(th(x.f.birthDate)) + `<div class="muted small">${x.age ? x.age.y + ' ปี' : ''}</div>` : '–'],
      ['อีเมล · เบอร์โทร', x => esc(x.email) + `<div class="small">${x.phone ? esc(x.phone) : x.phoneHidden ? '🔒 ไม่เปิดเผย' : ''}</div>`],
      ['ตำแหน่ง · วิทยฐานะ · อันดับ', x => esc([x.f.position, x.f.rank, x.f.level].filter(Boolean).join(' · ') || '–') + (x.f.rankDate ? `<div class="muted small">วิทยฐานะเมื่อ ${esc(th(x.f.rankDate))}</div>` : '')],
      ['บรรจุ (อายุราชการ)', x => x.f.appointDate ? esc(th(x.f.appointDate)) + `<div class="muted small">${ys(x.svc)}</div>` : '–'],
      ['เกษียณ', x => { if (!x.ret) return '–'; const d = x.ret - fyBE(); return `พ.ศ. ${x.ret}` + (d < 0 ? ' ' + chip('เกษียณแล้ว') : d <= 1 ? ' ' + chip(d ? 'ปีงบหน้า' : 'ปีงบนี้', 'bad') : ''); }],
      ['ใบอนุญาตประกอบวิชาชีพ', x => (x.f.licenseNo ? esc(x.f.licenseNo) + '<br>' : '') + chip(esc(x.lic[1]), x.lic[2])],
      ['วุฒิ · สาขาที่สอน', x => esc([x.d && x.d.edu ? x.d.edu.level + (x.d.edu.major ? ' ' + x.d.edu.major : '') : '', x.f.teachMajor].filter(Boolean).join(' · ') || '–')],
      ['ข้อมูลที่ยังขาด', x => !x.d ? '<span class="muted small">ครูยังไม่เปิดแอปหลังอัปเดต</span>' : x.need.length ? `<span class="small" style="color:var(--warn,#b7791f)">${x.need.map(n => esc(n[1])).join(', ')}</span>` : chip('ครบ', 'ok')]]
  };
  const CSV = [['ชื่อ-สกุล', x => x.name], ['กลุ่มสาระ', x => x.dept], ['ฝ่าย/บทบาท', x => x.roles.map(r => ROLE_TH[r] || r).join(', ')], ['อีเมล', x => x.email], ['เบอร์โทร', x => x.phone || (x.phoneHidden ? 'ไม่เปิดเผย' : '')],
    ['วันเกิด', x => x.f.birthDate || ''], ['อายุ (ปี)', x => x.age ? x.age.y : ''], ['ตำแหน่ง', x => x.f.position || ''], ['วิทยฐานะ', x => x.f.rank || ''], ['อันดับ', x => x.f.level || ''],
    ['วันบรรจุ', x => x.f.appointDate || ''], ['อายุราชการ', x => x.svc ? x.svc.y + ' ปี ' + x.svc.m + ' เดือน' : ''], ['ปีเกษียณ (พ.ศ.)', x => x.ret || ''],
    ['ประเภทใบอนุญาต', x => x.f.licenseType || ''], ['เลขที่ใบอนุญาต', x => x.f.licenseNo || ''], ['ใบอนุญาตหมดอายุ', x => x.f.licenseExpire || ''], ['สถานะใบอนุญาต', x => x.lic[1]],
    ['วุฒิสูงสุด', x => x.d && x.d.edu ? x.d.edu.level : ''], ['สาขาที่สอน', x => x.f.teachMajor || ''], ['ข้อมูลที่ยังขาด', x => !x.d ? 'ยังไม่ส่งข้อมูล' : x.need.map(n => n[1]).join(', ')]];

  P['a-staffinfo'] = () => {
    const title = 'ข้อมูลบุคลากร (ฝ่ายบุคคล)';
    if (!canSee()) return top(title, '') + '<div class="card"><div class="empty">หน้านี้สำหรับฝ่ายบุคคลและผู้ดูแลระบบ</div></div>';
    if (isLive() && window.EMSCloud && EMSCloud.ready && EMSCloud.ready.siAll === 'err') return top(title, '') + '<div class="card"><div class="empty">โหลดข้อมูลบุคลากรไม่ได้ — บัญชีนี้ไม่มีสิทธิ์ หรือระบบยังไม่ได้เปิดใช้ (firestore.rules)</div></div>';
    if (isLive() && !(window.EMSCloud && EMSCloud.ready && EMSCloud.ready.siAll)) return top(title, '') + '<div class="card"><div class="empty">กำลังโหลดข้อมูลบุคลากร…</div></div>';
    const all = people(), list = all.filter(pass), fy = fyBE();
    const sent = all.filter(x => x.d).length, lb = all.filter(x => x.lic[0] === 'expired' || x.lic[0] === 'soon').length, r0 = all.filter(x => x.ret === fy).length, r1 = all.filter(x => x.ret === fy + 1).length;
    const vals = fn => Array.from(new Set(all.map(fn))).sort(sortTh);
    const roleOpts = Array.from(new Set([].concat(...all.map(x => x.roles)))).sort((a, b) => sortTh(ROLE_TH[a] || a, ROLE_TH[b] || b));
    let h = top(title, 'สรุปข้อมูลจาก “ประวัติส่วนตัว” ของครูแต่ละคน (โครงร่าง HR API) · แสดงเฉพาะช่องที่ครูไม่ได้ล็อก 🔒 และไม่มีเงินเดือน · ใช้ตรวจว่าใครกรอกครบหรือยัง',
      `<button class="btn pri" data-si-do="hrSync" style="background:#2563eb;color:#fff">${ic('cloud')}ซิงก์ระบบ HR (Google Sheet)</button><button class="btn" data-si-do="sheet">${ic('cloud')}ส่งออกชีตสรุป</button><button class="btn" data-si-do="csv">${ic('down')}ดาวน์โหลด (.csv)</button><button class="btn" data-si-do="print">${ic('print')}พิมพ์</button>`);
    const k = (n, l, c) => `<div class="card" style="margin:0;padding:12px 14px"><div class="muted small">${l}</div><div style="font-size:1.6rem;font-weight:700;${c ? 'color:' + c : ''}">${n}</div></div>`;
    h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px">${k(all.length, 'บุคลากร')}${k(sent + '/' + all.length, 'ส่งข้อมูลแล้ว', sent < all.length ? 'var(--warn,#b7791f)' : '')}
      ${k(lb, 'ใบอนุญาตหมดอายุ/ใกล้หมด (≤ 6 เดือน)', lb ? 'var(--bad)' : '')}${k(r0 + ' · ' + r1, 'เกษียณปีงบ ' + fy + ' · ' + (fy + 1))}</div>`;
    /* สรุปวิทยฐานะ/ตำแหน่ง */
    const cnt = fn => { const o = {}; all.forEach(x => { const v = fn(x); o[v] = (o[v] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
    h += `<div class="card"><div class="small" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><b>วิทยฐานะ</b> ${cnt(x => x.f.rank || '(ยังไม่กรอก)').map(([v, n]) => chip(esc(v) + ' ' + n, v[0] === '(' ? 'warn' : 'info')).join(' ')}</div>
      <div class="small" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px"><b>ตำแหน่ง</b> ${cnt(x => x.f.position || '(ยังไม่กรอก)').map(([v, n]) => chip(esc(v) + ' ' + n, v[0] === '(' ? 'warn' : 'info')).join(' ')}</div></div>`;
    /* ตัวกรอง */
    h += `<div class="card"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;align-items:end">
        <label class="muted small" style="display:flex;flex-direction:column;gap:2px">ค้นหา<input class="in" type="search" data-si="q" value="${esc(ui.q)}" placeholder="ชื่อ อีเมล เบอร์ เลขใบอนุญาต" style="min-height:36px"></label>
        <label class="muted small" style="display:flex;flex-direction:column;gap:2px">ฝ่าย / บทบาท<select class="in" data-si="role" style="min-height:36px"><option value="">ทุกฝ่าย</option>${roleOpts.map(r => `<option value="${esc(r)}" ${r === ui.role ? 'selected' : ''}>${esc(ROLE_TH[r] || r)}</option>`).join('')}</select></label>
        ${sel('dept', vals(x => x.dept), 'ทุกกลุ่มสาระ', 'กลุ่มสาระ')}${sel('pos', vals(x => x.f.position || '(ยังไม่กรอก)'), 'ทุกตำแหน่ง', 'ตำแหน่ง')}${sel('rank', vals(x => x.f.rank || '(ยังไม่กรอก)'), 'ทุกวิทยฐานะ', 'วิทยฐานะ')}
        <label class="muted small" style="display:flex;flex-direction:column;gap:2px">ใบอนุญาต<select class="in" data-si="lic" style="min-height:36px">${[['', 'ทั้งหมด'], ['bad', 'หมดอายุ/ใกล้หมด'], ['none', 'ยังไม่กรอก']].map(o => `<option value="${o[0]}" ${o[0] === ui.lic ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
        <label class="muted small" style="display:flex;flex-direction:column;gap:2px">เกษียณ<select class="in" data-si="ret" style="min-height:36px">${[['', 'ทั้งหมด'], ['0', 'ปีงบนี้ (' + fy + ')'], ['1', 'ภายในปีงบหน้า'], ['5', 'ภายใน 5 ปี']].map(o => `<option value="${o[0]}" ${o[0] === ui.ret ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
        <label class="muted small" style="display:flex;flex-direction:column;gap:2px">ความครบของข้อมูล<select class="in" data-si="data" style="min-height:36px">${[['', 'ทั้งหมด'], ['none', 'ยังไม่ส่งข้อมูล'], ['need', 'กรอกไม่ครบ'], ['ok', 'ครบแล้ว']].map(o => `<option value="${o[0]}" ${o[0] === ui.data ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label></div>
      <div class="row" style="border:0;padding:8px 0 0;gap:8px;flex-wrap:wrap"><div class="seg" role="group" aria-label="รูปแบบ"><button data-si-do="view" data-v="brief" aria-pressed="${ui.view === 'brief'}">แบบย่อ</button><button data-si-do="view" data-v="full" aria-pressed="${ui.view === 'full'}">แบบเต็ม</button></div>
        <div class="seg" role="group" aria-label="จัดกลุ่ม"><button data-si-do="group" data-v="dept" aria-pressed="${ui.group === 'dept'}">ตามกลุ่มสาระ</button><button data-si-do="group" data-v="role" aria-pressed="${ui.group === 'role'}">ตามฝ่าย</button><button data-si-do="group" data-v="" aria-pressed="${!ui.group}">รายบุคคล</button></div>
        <span class="grow"></span><span class="muted small">แสดง ${list.length} จาก ${all.length} คน</span>${Object.keys(ui).some(k => !['group', 'view'].includes(k) && ui[k]) ? `<button class="btn sm ghost" data-si-do="clear">ล้างตัวกรอง</button>` : ''}</div></div>`;
    /* ตาราง (จัดกลุ่ม) */
    const cols = COLS[ui.view], groups = {};
    list.forEach(x => { const keys = ui.group === 'role' ? x.roles.map(r => ROLE_TH[r] || r) : [ui.group === 'dept' ? x.dept : '']; keys.forEach(g => { (groups[g] = groups[g] || []).push(x); }); });
    const gk = Object.keys(groups).sort(sortTh);
    h += gk.length ? gk.map(g => `<div class="card">${g ? `<h2>${esc(g)} ${chip(groups[g].length + ' คน')}</h2>` : ''}<div class="scroll"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>
        ${groups[g].sort((a, b) => sortTh(a.name, b.name)).map(x => `<tr>${cols.map((c, i) => `<td${i ? '' : ' style="min-width:150px"'}>${c[1](x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')
      : '<div class="card"><div class="empty">ไม่พบบุคลากรตามตัวกรอง</div></div>';
    return h;
  };

  /* ---------- รายบุคคล ---------- */
  function openPerson(key) {
    const x = people().find(p => (low(p.u.email) || p.u.name) === key); if (!x) return;
    const f = x.f, row = (l, v) => `<div class="row" style="padding:6px 0"><div class="muted small" style="width:150px;flex:0 0 150px">${l}</div><div class="grow">${v || '<span class="muted">–</span>'}</div></div>`;
    modal(`<h2 style="margin-bottom:4px">${esc(x.name)}</h2><div class="muted small" style="margin-bottom:8px">${esc(x.dept)} · ${x.roles.map(r => esc(ROLE_TH[r] || r)).join(', ')}</div>
      ${!x.d ? '<div class="notice">ครูคนนี้ยังไม่ได้เปิดแอปหลังอัปเดตระบบ จึงยังไม่มีข้อมูลส่วนตัวส่งมา (ข้อมูลจะขึ้นเองเมื่อครูเปิดแอปและมีการบันทึกใด ๆ)</div>' : x.need.length ? `<div class="notice" style="margin-bottom:8px">ยังขาด: ${x.need.map(n => esc(n[1])).join(', ')}</div>` : ''}
      <div class="list">${row('อีเมลโรงเรียน', esc(x.email))}${row('อีเมลสำรอง (altEmail)', f.altEmail ? esc(f.altEmail) : x.d && (x.d.hidden.indexOf('altEmail') >= 0 || x.d.hidden.indexOf('personalEmail') >= 0) ? '🔒 ไม่เปิดเผย' : '')}
        ${row('เบอร์โทร', x.phone ? esc(x.phone) : x.phoneHidden ? '🔒 ไม่เปิดเผย' : '')}${row('ที่อยู่ (address)', f.address ? esc(f.address) : x.d && x.d.hidden.indexOf('address') >= 0 ? '🔒 ไม่เปิดเผย' : '')}${row('วันเกิด', f.birthDate ? esc(th(f.birthDate)) + (x.age ? ' · อายุ ' + x.age.y + ' ปี' : '') : '')}
        ${row('ตำแหน่ง', esc(f.position || ''))}${row('วิทยฐานะ · อันดับ', esc([f.rank, f.level].filter(Boolean).join(' · ')) + (f.rankDate ? ' (ตั้งแต่ ' + esc(th(f.rankDate)) + ')' : ''))}
        ${row('เลขที่ตำแหน่ง', esc(f.positionNo || ''))}${row('วันบรรจุ', f.appointDate ? esc(th(f.appointDate)) + ' · อายุราชการ ' + ys(x.svc) : '')}
        ${row('ปีเกษียณ', x.ret ? 'พ.ศ. ' + x.ret + ' (30 ก.ย. ' + x.ret + ')' : '')}
        ${row('ใบอนุญาต', [f.licenseType, f.licenseNo].filter(Boolean).map(esc).join(' · ') + ' ' + chip(esc(x.lic[1]), x.lic[2]) + (f.licenseIssue ? `<div class="muted small">ออก ${esc(th(f.licenseIssue))}${f.licenseExpire ? ' · หมดอายุ ' + esc(th(f.licenseExpire)) : ''}</div>` : ''))}
        ${row('ชั้นที่สอน · สาขา', esc([f.teachLevels, f.teachMajor].filter(Boolean).join(' · ')))}${row('วุฒิสูงสุด', x.d && x.d.edu ? esc(x.d.edu.level + (x.d.edu.major ? ' · ' + x.d.edu.major : '')) : '')}
        ${row('การอบรม', x.d && x.d.train ? esc(x.d.train.n + ' รายการ · ' + x.d.train.hours + ' ชั่วโมง') : '')}</div>
      <button class="btn" style="width:100%;margin-top:10px" data-act="close">ปิด</button>`, true);
  }

  /* ---------- ส่งออก ---------- */
  function csvOut() {
    const rows = [CSV.map(c => c[0])].concat(people().filter(pass).sort((a, b) => sortTh(a.dept, b.dept) || sortTh(a.name, b.name)).map(x => CSV.map(c => c[1](x))));
    const asText = new Set(['เบอร์โทร', 'เลขที่ใบอนุญาต']);
    const cell = (v, h) => { let s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                                       // กัน Excel ตีความเป็นสูตร
      else if (h && asText.has(h) && /^\d{5,}$/.test(s)) return '="' + s + '"';       // คงเลข 0 นำหน้า / เลขยาวไม่กลายเป็น 1.2E+15
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const text = '\ufeff' + rows.map((r, i) => r.map((v, j) => cell(v, i ? rows[0][j] : '')).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = 'ข้อมูลบุคลากร-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  document.addEventListener('click', e => {
    const o = e.target.closest('[data-si-open]'); if (o) { e.preventDefault(); return openPerson(o.dataset.siOpen); }
    const b = e.target.closest('[data-si-do]'); if (!b) return; const d = b.dataset;
    if (d.siDo === 'view') { ui.view = d.v; return rr(); }
    if (d.siDo === 'group') { ui.group = d.v; return rr(); }
    if (d.siDo === 'clear') { Object.keys(ui).forEach(k => { if (!['group', 'view'].includes(k)) ui[k] = ''; }); return rr(); }
    if (d.siDo === 'sheet') {
      const rows = [CSV.map(c => c[0])].concat(people().filter(pass).sort((a, b) => sortTh(a.dept, b.dept) || sortTh(a.name, b.name)).map(x => CSV.map(c => c[1](x))));
      return window.EMSSheets ? EMSSheets.send({ tabs: [{ title: 'ข้อมูลบุคลากร', rows }], fallback: csvOut, fallbackName: 'CSV' }) : csvOut();
    }
    if (d.siDo === 'hrSync') return window.EMSAdmin && EMSAdmin.openHrModal ? EMSAdmin.openHrModal() : (window.EMSHr && EMSHr.openSetup ? EMSHr.openSetup() : toast('เปิดตั้งค่า HR ไม่ได้'));
    if (d.siDo === 'csv') return csvOut();
    if (d.siDo === 'print') return window.print();
  });
  document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.si && t.tagName === 'SELECT') { ui[t.dataset.si] = t.value; rr(); } });
  document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.si === 'q') { ui.q = t.value; clearTimeout(openPerson.t); openPerson.t = setTimeout(() => { const pos = t.selectionStart; rr(); const n = document.querySelector('[data-si="q"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }, 250); } });

  /* ---------- เมนู: ฝ่ายงาน (แสดงเฉพาะฝ่ายบุคคล/แอดมิน) ---------- */
  const N = window.EMSNav;
  if (N) {
    const grp = (N.NAVG.admin || []).find(x => x[0] === 'ฝ่ายงาน'); if (grp && !grp[1].some(x => x[0] === 'a-staffinfo')) grp[1].push(['a-staffinfo', 'ข้อมูลบุคลากร (ฝ่ายบุคคล)', 'users']);
    const hideFor = fn => function () { const g = (N.NAVG.admin || []).find(x => x[0] === 'ฝ่ายงาน'), i = g ? g[1].findIndex(x => x[0] === 'a-staffinfo') : -1;
      let it = null; try { if (i >= 0 && !canSee()) it = g[1].splice(i, 1)[0]; } catch (x) {}
      try { return fn.apply(this, arguments); } finally { if (it) g[1].splice(i, 0, it); } };
    if (window.renderChrome) window.renderChrome = hideFor(window.renderChrome);
    if (window.openMore) window.openMore = hideFor(window.openMore);
    (window.EMSNavHidden = window.EMSNavHidden || {})['a-staffinfo'] = () => !canSee();
  }
  window.EMSStaffInfo = { build, retireBE, canSee };
})();
