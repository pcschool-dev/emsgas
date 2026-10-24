/* EMS — หลักสูตรสถานศึกษา (โครงสร้างรายวิชา / แผนการเรียน) เชื่อมห้องเรียน งานเสนอภาระงานสอน และตารางสอน
   ข้อมูล (Firestore คอลเลกชัน curriculum · cloud.js ฟังเฉพาะตอนเปิดหน้าที่ใช้):
     curriculum/subjects = { ver, at, subjects: { รหัสวิชา: { n ชื่อ, cr หน่วยกิต, t B|A|G (พื้นฐาน/เพิ่มเติม/กิจกรรม), a กลุ่มสาระ, slot? } }, areaMap: { TH: 'ชื่อกลุ่มสาระใน EMS' } }
     curriculum/<ปีที่เข้า> = { cohort, ver, plans: { M4-SMTE: { name, lv, src, terms: { 'ปีที่-ภาค': [รหัสวิชา] } } } }
       รหัสขึ้นต้น * = ช่องวิชาเลือกที่ยังไม่กำหนดรหัส (เช่น *ง202) ให้ผู้เสนอภาระงานเลือกรหัสจริงเอง
   ห้องผูกแผน: S.rooms[i].cur = 'ปีที่เข้า/รหัสแผน' · ห้องหลายแผน: S.rooms[i].plans[j].cur (ห้องย่อยตาม plans.js)
     วิชาที่ทุกแผนของห้องมีร่วมกัน = เรียนรวมที่ห้องหลัก · วิชาเฉพาะแผน = ห้องย่อย (คำนวณทุกครั้ง ไม่เก็บซ้ำ)
   ไฟล์ JSON นำเข้าสร้างจาก D:\ตารางสอน\scripts\export_cur_json.py */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const top = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${right}</div></div>`;
  const rr = () => { const y = scrollY; render(); scrollTo(0, y); };
  const sortTh = (a, b) => String(a).localeCompare(String(b), 'th', { numeric: true });
  const isLive = () => typeof LIVE !== 'undefined' && !!LIVE;
  const roles = () => [].concat((S.me && S.me.roles) || [], (S.me && S.me.role) || []);
  const bootAdm = () => ((window.EMS_CONFIG || {}).adminEmails || []).map(x => String(x).toLowerCase()).indexOf(String((S.me && S.me.email) || '').toLowerCase()) >= 0;
  /* ตรงกับ rules: แก้หลักสูตร/ผูกห้อง = แอดมินหรือวิชาการ · โหมดตัวอย่าง = ทำได้ */
  const canEdit = () => !isLive() || bootAdm() || roles().some(r => r === 'admin' || r === 'academic');

  /* ---------- ข้อมูล ---------- */
  const docs = () => (S.curDocs && typeof S.curDocs === 'object' ? S.curDocs : (S.curDocs = {}));
  const subjects = () => (docs().subjects || {}).subjects || {};
  const subj = code => subjects()[code] || null;
  const cohort = y => docs()[String(y)] || null;
  const cohortYears = () => Object.keys(docs()).filter(k => /^\d{4}$/.test(k)).map(Number).sort();
  const loaded = () => !isLive() || !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready.cur);
  const yearNow = () => +((S.term || {}).year) || 0;
  const parseCur = c => { const m = /^(\d{4})\/(.+)$/.exec(String(c || '')); return m ? { y: +m[1], pid: m[2] } : null; };
  const planOf = c => { const p = parseCur(c), co = p && cohort(p.y); return (co && (co.plans || {})[p.pid]) || null; };
  const firstGrade = pid => (/^M1/.test(pid) ? 1 : 4);
  const gradeOf = name => { const m = /ม\.?\s*(\d)/.exec(String(name || '')); return m ? +m[1] : 0; };
  /** ชั้นที่แผนนี้ควรอยู่ในปีการศึกษา year (ม.4 ของรุ่น 2569 = ม.5 ในปี 2570) */
  /* แผนหนึ่งใช้ 3 ปี (ม.1–3 หรือ ม.4–6) — นอกช่วงคืน 0 */
  const gradeFor = (c, year) => { const p = parseCur(c); if (!p) return 0; const d = year - p.y; return d >= 0 && d <= 2 ? firstGrade(p.pid) + d : 0; };
  /** รหัสวิชาของแผนในภาค (ปีการศึกษา, ภาค) · null = ยังไม่มีข้อมูลรุ่นนี้ */
  const codesOf = (c, year, sem) => { const p = parseCur(c), pl = planOf(c); if (!pl) return null; return ((pl.terms || {})[(year - p.y + 1) + '-' + sem] || []).slice(); };
  /** คาบ/สัปดาห์ = หน่วยกิต × 2 (กิจกรรม 0.5 = 1 คาบ) */
  const per = code => { const s = subj(code); return s ? Math.round((+s.cr || 0) * 20) / 10 : 0; };
  const label = code => { const s = subj(code); return s ? s.n : ''; };
  const mainRooms = () => (S.rooms || []).filter(r => !r.parent).slice().sort((a, b) => sortTh(a.name, b.name));
  const sameName = (a, b) => String(a || '').replace(/\s/g, '') === String(b || '').replace(/\s/g, '');
  const subRoom = (r, key) => (S.rooms || []).find(x => x.parent === r.id && x.plan === key);

  /* ---------- กลุ่มสาระ: รหัส (TH, MA …) → ชื่อกลุ่มสาระของบุคลากรใน EMS ---------- */
  const AREAS = [['TH', 'ภาษาไทย', /ไทย/], ['MA', 'คณิตศาสตร์', /คณิต/], ['SC', 'วิทยาศาสตร์และเทคโนโลยี', /วิทย/], ['SO', 'สังคมศึกษา ศาสนาและวัฒนธรรม', /สังคม/],
    ['HP', 'สุขศึกษาและพลศึกษา', /สุขศึกษา|พลศึกษา/], ['AR', 'ศิลปะ', /ศิลป/], ['OT', 'การงานอาชีพ', /การงาน/], ['FL', 'ภาษาต่างประเทศ', /ต่างประเทศ/], ['IS', 'IS (การศึกษาค้นคว้าอิสระ)', null]];
  const depts = () => Array.from(new Set((S.staff || []).map(u => String((u && u.dept) || '').trim()).filter(Boolean))).sort(sortTh);
  const areaMap = () => (docs().subjects || {}).areaMap || {};
  const deptOfArea = a => { const m = areaMap()[a]; if (m) return m; const d = AREAS.find(x => x[0] === a); return d && d[2] ? (depts().find(n => d[2].test(n)) || '') : ''; };
  const deptOf = code => { const s = subj(code); return s ? deptOfArea(s.a) : ''; };
  const areaName = a => (AREAS.find(x => x[0] === a) || [])[1] || '';      // รหัสกลุ่มสาระ → ชื่อไทย (course.js)

  /* ---------- รายการที่ต้องเปิดสอน ---------- */
  /** { items: [{ room ชื่อห้อง (ห้องย่อยถ้าเรียนแยก), main ห้องหลัก, code, per, level }], issues: [{ room, msg }] } */
  const shiftCur = (c, y) => { const p = parseCur(c); return p ? y + '/' + p.pid : ''; };
  /** ห้องของปีการศึกษา year: ปีปัจจุบัน = ห้องจริง · ปีหน้า = เลื่อนชั้นห้องเลขเดิม (แบบเดียวกับค่าตั้งต้นของ newyear.js)
      + ห้อง ม.1/ม.4 รับนักเรียนใหม่ใช้แผนเดิมของห้องรุ่นปีหน้า · ปีอื่น = null (ตรวจไม่ได้) */
  function roomsFor(year) {
    const y0 = yearNow(), subName = r => key => { const s = subRoom(r, key); return s ? s.name : r.name + key; };
    if (!y0 || year === y0) return mainRooms().map(r => ({ name: r.name, cur: r.cur, plans: r.plans || [], sub: subName(r) }));
    if (year !== y0 + 1) return null;
    const out = [];
    mainRooms().forEach(r => { const lv = gradeOf(r.name), m = /\/\s*(\d+)\s*$/.exec(r.name); if (!lv) return;
      if (!m) { out.push({ name: r.name, bad: 'ชื่อห้องไม่มีเลขห้อง คาดการณ์ห้องปีหน้าไม่ได้' }); return; }
      if (lv !== 3 && lv !== 6) { const t = mainRooms().find(x => sameName(x.name, 'ม.' + (lv + 1) + '/' + m[1])), nm = t ? t.name : 'ม.' + (lv + 1) + '/' + m[1];
        /* ห้องย่อยปีหน้า = โครงแผนของห้องปลายทาง (จับคู่ตัวย่อ แล้วชื่อแผน แบบ newyear.js) · จับคู่ไม่ได้ = ห้องหลัก */
        const sub = key => { const sp = (r.plans || []).find(p => p.key === key), tps = (t && t.plans) || [], tp = tps.find(p => p.key === key) || (sp && tps.find(p => p.name && p.name === sp.name)), s = tp && subRoom(t, tp.key);
          return s ? s.name : tp ? nm + tp.key : nm; };
        out.push({ name: nm, cur: r.cur, plans: r.plans || [], sub }); }
      if (lv === 1 || lv === 4) out.push({ name: r.name, cur: shiftCur(r.cur, year), plans: (r.plans || []).map(p => Object.assign({}, p, { cur: shiftCur(p.cur, year) })), sub: subName(r) }); });
    return out.sort((a, b) => sortTh(a.name, b.name));
  }
  function required(year, sem) {
    const items = [], issues = [], rooms = roomsFor(year) || [];
    rooms.forEach(r => {
      if (r.bad) { issues.push({ room: r.name, msg: r.bad }); return; }
      const lv = gradeOf(r.name), ps = r.plans || [];
      const push = (room, codes) => codes.forEach(code => items.push({ room, main: r.name, code, per: per(code), level: lv }));
      const check = c => { if (!c) return 'ยังไม่ผูกแผนหลักสูตร'; const p = parseCur(c);
        if (!cohort(p.y)) return 'ยังไม่มีข้อมูลหลักสูตรรุ่น ' + p.y; if (!planOf(c)) return 'ไม่พบแผน ' + p.pid + ' ในรุ่น ' + p.y;
        const g = gradeFor(c, year); if (!g) return 'แผนรุ่น ' + p.y + ' ใช้ได้ถึงปีการศึกษา ' + (p.y + 2) + ' (ม.' + (firstGrade(p.pid) + 2) + ') เท่านั้น';
        if (g !== lv) return 'แผนรุ่น ' + p.y + ' ควรอยู่ ม.' + g + ' ในปี ' + year; return ''; };
      if (ps.length) {
        const bad = ps.map(p => check(p.cur)).filter(Boolean);
        if (bad.length) { issues.push({ room: r.name, msg: Array.from(new Set(bad)).join(' · ') }); return; }
        const L = ps.map(p => codesOf(p.cur, year, sem)), shared = L.reduce((a, b) => a.filter(x => b.indexOf(x) >= 0));
        push(r.name, shared);
        ps.forEach((p, i) => { push(r.sub(p.key), L[i].filter(x => shared.indexOf(x) < 0)); });
      } else { const m = check(r.cur); if (m) { issues.push({ room: r.name, msg: m }); return; } push(r.name, codesOf(r.cur, year, sem)); }
    });
    return { items, issues };
  }
  const parseTerm = t => { const m = /^(\d{4})-([12])$/.exec(String(t || '')); return m ? { year: +m[1], sem: +m[2] } : null; };

  /** ตรวจภาระงานที่เสนอ (loadProps) ของกลุ่มสาระกับหลักสูตร · กิจกรรม (รหัส ก) ไม่นับ — งานจัดตารางลงเอง */
  function coverage(t, dept, rows) {
    const tt = parseTerm(t);
    if (!tt) return { off: 'ภาคเรียนไม่ถูกรูปแบบ' };
    if (!Object.keys(subjects()).length) return { off: loaded() ? 'ยังไม่ได้นำเข้าข้อมูลหลักสูตร (หน้า หลักสูตร / แผนการเรียน)' : 'กำลังโหลดหลักสูตร…' };
    if (!roomsFor(tt.year)) return { off: 'ตรวจได้เฉพาะภาคของปีการศึกษา ' + yearNow() + ' และปีหน้า (' + (yearNow() + 1) + ')' };
    const next = yearNow() && tt.year === yearNow() + 1;
    const R = required(tt.year, tt.sem), all = R.items.filter(i => (subj(i.code) || {}).a !== 'ACT');
    const mine = all.filter(i => deptOf(i.code) === dept);
    const parentOfName = n => { const s = (S.rooms || []).find(x => sameName(x.name, n));
      if (s) { if (!s.parent) return ''; const p = (S.rooms || []).find(x => x.id === s.parent); return p ? p.name : ''; }
      const m = /^(ม\.\d\/\d+)(\D\S*)$/.exec(String(n || '').replace(/\s/g, ''));        // ห้องย่อยที่ยังไม่มีในระบบ (เช่น ปีหน้า): ตัวย่อต้องไม่ใช่ตัวเลข
      const p = m && mainRooms().find(x => sameName(x.name, m[1])); return p ? p.name : ''; };
    const have = new Set(), haveLoose = new Set();
    (rows || []).forEach(r => (r.rooms || []).forEach(n => { const k = r.slot || r.code; have.add(n + '|' + k); have.add(n + '|' + r.code);
      haveLoose.add((parentOfName(n) || n) + '|' + r.code); }));
    const missing = [], loose = [];
    mine.forEach(i => { const k = i.room + '|' + i.code; if (have.has(k)) return;
      if (haveLoose.has(i.main + '|' + i.code)) loose.push(i); else missing.push(i); });
    const req = new Set(all.map(i => i.room + '|' + i.code)), reqMain = new Set(all.map(i => i.main + '|' + i.code));
    const bad = new Set(R.issues.map(i => i.room));          // ห้องที่ยังตรวจไม่ได้ (ไม่ผูกแผน/ไม่มีข้อมูลรุ่น) ไม่เตือนว่า "ไม่อยู่ในแผน"
    const extra = [], perBad = [];
    (rows || []).forEach(r => {
      if (/^ก/.test(String(r.code || '')) || (subj(r.code) || {}).a === 'ACT') return;       // กิจกรรม: งานจัดตารางลงเอง ไม่ตรวจ
      const out = (r.rooms || []).filter(n => !bad.has(parentOfName(n) || n) && !req.has(n + '|' + (r.slot || r.code)) && !reqMain.has((parentOfName(n) || n) + '|' + (r.slot || r.code)));
      if (out.length) extra.push({ r, rooms: out });
      const p = r.slot ? per(r.slot) : per(r.code); if (p && +r.per !== p) perBad.push({ r, want: p });
    });
    /* รวมรายการขาดตามรหัสวิชา → หนึ่งปุ่มมอบหมายต่อวิชาต่อชั้น */
    const g = {}; missing.forEach(i => { const k = i.code + '|' + i.level; (g[k] = g[k] || { code: i.code, level: i.level, per: i.per, rooms: [] }).rooms.push(i.room); });
    return { total: mine.length, done: mine.length - missing.length, groups: Object.values(g).sort((a, b) => a.level - b.level || sortTh(a.code, b.code)), loose, extra, perBad, issues: R.issues,
      note: next ? 'ภาคของปีหน้า: ม.2–3 และ ม.5–6 คิดจากการเลื่อนชั้นห้องเลขเดิม (ม.4/1 → ม.5/1) · ห้อง ม.1/ม.4 รับนักเรียนใหม่ ใช้แผนเดิมของห้องในหลักสูตรรุ่น ' + tt.year + ' (ต้องนำเข้าหลักสูตรรุ่นนี้ก่อนจึงตรวจได้)' : '' };
  }
  /** การ์ดตรวจความครบในหน้าเสนอภาระงาน */
  function coverageCard(t, dept, rows, ed) {
    const c = coverage(t, dept, rows);
    if (c.off) return `<div class="card"><h2>ตรวจกับหลักสูตร</h2><div class="muted small">${esc(c.off)}</div></div>`;
    if (!c.total) return `<div class="card"><h2>ตรวจกับหลักสูตร</h2><div class="muted small">ไม่มีรายวิชาของ ${esc(dept)} ในหลักสูตรภาคนี้ — ถ้าไม่ถูกต้อง ให้วิชาการตั้ง “กลุ่มสาระ” ที่หน้า หลักสูตร / แผนการเรียน</div></div>`;
    const ok = c.done === c.total, li = s => `<li style="margin:2px 0">${s}</li>`;
    let h = `<div class="card"><div class="row" style="border:0;padding:0;gap:8px;flex-wrap:wrap"><h2 class="grow" style="margin:0">ตรวจกับหลักสูตร ${chip('ครบ ' + c.done + '/' + c.total + ' ห้อง×วิชา', ok ? 'ok' : 'warn')}</h2></div>
      <div class="muted small" style="margin:4px 0 8px">รายวิชาตามแผนการเรียนของแต่ละห้อง (ไม่รวมกิจกรรมพัฒนาผู้เรียน — งานจัดตารางลงเอง)${c.note ? ' · ' + esc(c.note) : ''}</div>`;
    /* รายการขาด: การ์ดต่อวิชา (ปุ่มอยู่บนสุด เห็นได้บนจอมือถือโดยไม่ต้องเลื่อนตารางแนวนอน) */
    if (c.groups.length) h += `<div class="list" style="max-height:440px;overflow:auto">${c.groups.map(g => { const s = subj(g.code) || {};
      return `<div class="row" style="flex-wrap:wrap;gap:6px 10px;align-items:flex-start"><div style="flex:1 1 220px;min-width:0">${s.slot ? chip('ช่องวิชาเลือก', 'warn') + ' ' : ''}<b>${esc(s.slot ? '' : g.code)}</b> ${esc(s.n || '')}
          <div class="muted small">ม.${g.level} · ${g.per} คาบ/สัปดาห์ · ${g.rooms.length} ห้อง: ${g.rooms.map(esc).join(', ')}</div></div>
        ${ed ? `<button class="btn sm pri" style="flex:0 0 auto" data-lp="fromCur" data-code="${esc(g.code)}" data-level="${g.level}" data-rooms="${esc(JSON.stringify(g.rooms))}">มอบหมายครู</button>` : ''}</div>`; }).join('')}</div>`;
    else h += `<div class="notice">ทุกวิชาของกลุ่มสาระในหลักสูตรภาคนี้มีครูสอนครบแล้ว</div>`;
    const warn = [], toSub = c.loose.filter(i => i.room !== i.main), toMain = c.loose.filter(i => i.room === i.main);
    if (toSub.length) warn.push(`วิชาที่เรียนแยกตามแผน แต่เสนอที่ห้องหลักหรือห้องย่อยอื่น (ควรเลือกห้องย่อย): ${toSub.map(i => esc(i.code + ' → ' + i.room)).join(', ')}`);
    if (toMain.length) warn.push(`วิชาที่ทุกแผนเรียนรวม แต่เสนอที่ห้องย่อย (ควรเลือกห้องหลัก): ${toMain.map(i => esc(i.code + ' → ' + i.room)).join(', ')}`);
    c.extra.forEach(x => warn.push(`${esc(x.r.code + ' ' + (x.r.name || ''))} (${esc(x.r.teacher)}) ไม่อยู่ในแผนการเรียนของห้อง ${x.rooms.map(esc).join(', ')}`));
    c.perBad.forEach(x => warn.push(`${esc(x.r.code + ' ' + (x.r.name || ''))} (${esc(x.r.teacher)}) เสนอ ${esc(x.r.per)} คาบ/สัปดาห์ แต่หลักสูตรกำหนด ${x.want} คาบ`));
    if (warn.length) h += `<div style="margin-top:10px"><b class="small" style="color:var(--warn,#b7791f)">ตรวจอีกครั้ง ${warn.length} รายการ</b><ul class="small" style="margin:4px 0 0 18px;padding:0">${warn.map(li).join('')}</ul></div>`;
    const iss = c.issues.filter(i => gradeOf(i.room));
    if (iss.length) h += `<div class="muted small" style="margin-top:8px">ห้องที่ยังตรวจไม่ได้ (${iss.length}): ${iss.slice(0, 12).map(i => esc(i.room + ' — ' + i.msg)).join(' · ')}${iss.length > 12 ? ' …' : ''}</div>`;
    return h + '</div>';
  }

  /* ---------- หน้า หลักสูตร / แผนการเรียน ---------- */
  const ui = { co: '', pid: '' };
  const planOptions = (lv, year) => cohortYears().flatMap(y => Object.keys((cohort(y) || {}).plans || {}).filter(pid => year - y >= 0 && year - y <= 2 && firstGrade(pid) + (year - y) === lv)
    .map(pid => [y + '/' + pid, cohort(y).plans[pid].name + ' (รุ่น ' + y + ')'])).sort((a, b) => sortTh(a[1], b[1]));
  const curSel = (r, key, cur, lv, year) => { const ops = planOptions(lv, year), known = !cur || ops.some(o => o[0] === cur);
    return `<select class="in" style="min-height:34px;width:auto;max-width:100%" data-cur="${esc(r.id)}" data-key="${esc(key)}" ${canEdit() ? '' : 'disabled'} aria-label="แผนหลักสูตรของ ${esc(r.name + key)}">
      <option value="">— เลือกแผน —</option>${known ? '' : `<option value="${esc(cur)}" selected>${esc(cur)} (ชั้นไม่ตรง)</option>`}${ops.map(o => `<option value="${esc(o[0])}" ${o[0] === cur ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`; };

  P['a-cur'] = () => {
    const title = 'หลักสูตร / แผนการเรียน', year = yearNow(), sem = +((S.term || {}).sem) || 1, ed = canEdit();
    if (!loaded()) return top(title, '') + '<div class="card"><div class="empty">กำลังโหลดหลักสูตร…</div></div>';
    const sd = docs().subjects, ys = cohortYears(), nS = Object.keys(subjects()).length;
    let h = top(title, `ปีการศึกษา ${year || '-'} ภาค ${sem} · รายวิชาของแต่ละห้องคำนวณจากแผนการเรียนที่ผูกไว้ ใช้ตรวจการเสนอภาระงานสอนและตารางสอน`);
    h += `<div class="card"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:8px"><div style="flex:1 1 240px;min-width:0">รายวิชา ${chip(nS ? nS + ' วิชา' : 'ยังไม่มี', nS ? 'ok' : 'warn')}
        รุ่นที่มีแผน ${ys.length ? ys.map(y => chip(y + ' (' + Object.keys(cohort(y).plans || {}).length + ' แผน)', 'info')).join(' ') : chip('ยังไม่มี', 'warn')}
        ${sd && sd.at ? `<div class="muted small">ปรับปรุงรายวิชาล่าสุด ${esc(String(sd.at).slice(0, 10))}</div>` : ''}</div>
      ${ed ? `<label class="btn pri" style="cursor:pointer">${ic('up')}นำเข้าไฟล์หลักสูตร (.json)<input type="file" accept=".json,application/json" multiple data-curfile hidden></label>` : ''}</div>
      <div class="muted small" style="margin-top:6px">เลือกได้หลายไฟล์พร้อมกัน: cur_subjects.json, cur_25xx.json (แผนรายรุ่น), room_cur_25xx.json (ผูกห้องกับแผน) — แสดงรายการให้ตรวจก่อนบันทึกทุกครั้ง</div></div>`;
    if (!nS) return h;

    /* กลุ่มสาระ */
    const ds = depts(), used = {}; Object.values(subjects()).forEach(s => { used[s.a || ''] = (used[s.a || ''] || 0) + 1; });
    h += `<div class="card"><h2>กลุ่มสาระของรายวิชา</h2><div class="muted small" style="margin-bottom:8px">ใช้แบ่งรายวิชาให้แต่ละกลุ่มสาระเสนอภาระงานสอน (ชื่อกลุ่มสาระตามที่ตั้งให้บุคลากร) · ห้อง EP ใช้กลุ่มสาระตามรหัสวิชาเช่นกัน · กิจกรรม (รหัส ก) งานจัดตารางลงเอง</div>
      <div class="scroll"><table class="tbl"><thead><tr><th>รหัสวิชาขึ้นต้น</th><th style="text-align:right">วิชา</th><th>กลุ่มสาระใน EMS</th></tr></thead><tbody>${AREAS.concat([['', 'ยังไม่ทราบกลุ่มสาระ (เช่น ช่อง มก.)', null]]).filter(a => used[a[0]]).map(a => { const cur = deptOfArea(a[0]);
        return `<tr><td><b>${esc(a[0] || '-')}</b> ${esc(a[1])}</td><td style="text-align:right">${used[a[0]]}</td><td>${a[0] ? `<select class="in" style="min-height:34px;width:auto" data-curarea="${esc(a[0])}" ${ed ? '' : 'disabled'}><option value="">— ไม่ระบุ —</option>${ds.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>${cur && !areaMap()[a[0]] ? ' <span class="muted small">(เดาจากชื่อ)</span>' : ''}` : '<span class="muted small">ระบุรหัสจริงตอนเสนอภาระงาน</span>'}</td></tr>`; }).join('')}</tbody></table></div></div>`;

    /* ห้องเรียน ↔ แผน */
    const R = required(year, sem), cnt = {}; R.items.forEach(i => { const c = cnt[i.main] = cnt[i.main] || { n: 0, p: 0 }; c.n++; c.p += i.per; });
    const issue = {}; R.issues.forEach(i => { issue[i.room] = i.msg; });
    const rooms = mainRooms().filter(r => gradeOf(r.name)), unset = rooms.filter(r => issue[r.name]).length;
    h += `<div class="card"><h2>ห้องเรียนกับแผนการเรียน ${chip(rooms.length - unset + '/' + rooms.length + ' ห้องพร้อม', unset ? 'warn' : 'ok')}</h2>
      <div class="muted small" style="margin-bottom:8px">ตัวเลือกแสดงเฉพาะแผนของรุ่นที่ตรงกับชั้นในปี ${year} · ห้องที่มีหลายแผน (ห้องย่อย) ตั้งแผนแยกได้ที่ ตั้งค่าโรงเรียน › ห้องเรียน › ปุ่ม “แผน” ก่อน แล้วเลือกหลักสูตรของแต่ละแผนที่นี่ · ขึ้นปีการศึกษาใหม่ แผนย้ายตามนักเรียนให้เอง</div>
      <div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th>แผนหลักสูตร</th><th>ภาค ${sem}</th></tr></thead><tbody>${rooms.map(r => { const lv = gradeOf(r.name), ps = r.plans || [];
        const sels = ps.length ? ps.map(p => `<div style="margin:2px 0">${chip(esc(r.name + p.key) + ' ' + esc(p.name))} ${curSel(r, p.key, p.cur, lv, year)}</div>`).join('') : curSel(r, '', r.cur, lv, year);
        return `<tr><td><b>${esc(r.name)}</b></td><td>${sels}</td><td class="small">${issue[r.name] ? `<span style="color:var(--bad)">${esc(issue[r.name])}</span>` : cnt[r.name] ? `${cnt[r.name].n} วิชา · ${cnt[r.name].p} คาบ/สัปดาห์` : '-'}</td></tr>`; }).join('')}</tbody></table></div></div>`;

    /* ดูแผน */
    const co = ui.co && cohort(ui.co) ? ui.co : String(ys[ys.length - 1] || ''), plans = (cohort(co) || {}).plans || {}, pid = plans[ui.pid] ? ui.pid : Object.keys(plans).sort(sortTh)[0], pl = plans[pid];
    h += `<div class="card"><div class="row" style="border:0;padding:0;gap:8px;flex-wrap:wrap"><h2 class="grow" style="margin:0">ดูแผนการเรียน</h2>
        <select class="in" style="width:auto;min-height:34px" data-curview="co" aria-label="รุ่น">${ys.map(y => `<option ${String(y) === co ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <select class="in" style="width:auto;max-width:100%;min-height:34px" data-curview="pid" aria-label="แผน">${Object.keys(plans).sort(sortTh).map(k => `<option value="${esc(k)}" ${k === pid ? 'selected' : ''}>${esc(plans[k].name)} (${esc(k)})</option>`).join('')}</select></div>`;
    if (pl) h += `<div class="muted small" style="margin:6px 0">ที่มา: ชีท ${esc(pl.src || '-')}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:4px 16px">${Object.keys(pl.terms || {}).sort().map(k => { const [yy, ss] = k.split('-'), codes = pl.terms[k], lv = firstGrade(pid) + +yy - 1;
      const tot = t => codes.filter(c => (subj(c) || {}).t === t).reduce((s, c) => s + (+(subj(c) || {}).cr || 0), 0);
      return `<div style="min-width:0"><h3 style="margin:8px 0 4px">ม.${lv} ภาค ${ss} <span class="muted small">(ปีการศึกษา ${+co + +yy - 1}) · พื้นฐาน ${tot('B')} · เพิ่มเติม ${tot('A')} นก.</span></h3><div class="scroll"><table class="tbl small"><tbody>${codes.map(c => { const s = subj(c) || {};
        return `<tr><td>${s.slot ? chip('เลือก', 'warn') : esc(c)}</td><td>${esc(s.n || '?')}</td><td>${{ B: 'พื้นฐาน', A: 'เพิ่มเติม', G: 'กิจกรรม' }[s.t] || ''}</td><td style="text-align:right">${esc(s.cr)}</td></tr>`; }).join('')}</tbody></table></div></div>`; }).join('')}</div>`;
    return h + '</div>';
  };

  /* ---------- นำเข้าไฟล์ ---------- */
  let pending = null;
  /* ส่งขึ้นระบบทันที — ถ้าออกจากหน้านี้ก่อนรอบบันทึก (0.7 วิ) ส่วนหลักสูตรเลิกฟัง แล้วเอกสารหลักสูตรไม่ถูกเขียน */
  const flushNow = () => { if (isLive() && window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); };
  async function readFiles(files) {
    const out = { subjects: null, cohorts: [], rooms: null, bad: [] };
    for (const f of files) {
      let j; try { j = JSON.parse(await f.text()); } catch (e) { out.bad.push(f.name + ' (อ่าน JSON ไม่ได้)'); continue; }
      if (j && j.subjects && typeof j.subjects === 'object') out.subjects = j;
      else if (j && /^\d{4}$/.test(String(j.cohort)) && j.plans) out.cohorts.push(j);
      else if (j && j.rooms && typeof j.rooms === 'object' && /^\d{4}$/.test(String(j.year))) { j.year = +j.year; out.rooms = j; }
      else out.bad.push(f.name + ' (ไม่ใช่ไฟล์หลักสูตร)');
    }
    return out;
  }
  /** แผนห้องจากไฟล์ → รายการเปลี่ยนแปลง (ไม่แก้ตัวย่อห้องย่อยที่ตั้งไว้แล้ว จับคู่แผนเดิมด้วยชื่อ/ตัวย่อ) */
  function roomChanges(R) {
    const ch = [], skip = [];
    Object.keys(R.rooms || {}).forEach(name => {
      const e = R.rooms[name], r = mainRooms().find(x => sameName(x.name, name));
      if (!r) { skip.push(name + ' (ไม่มีห้องนี้ใน EMS)'); return; }
      if (e.cur) { if ((r.plans || []).length) { skip.push(name + ' (ใน EMS แบ่งแผนไว้ แต่ไฟล์มีแผนเดียว)'); return; } if (r.cur !== e.cur) ch.push({ r, cur: e.cur, from: r.cur || '' }); return; }
      const ps = e.plans || [], have = r.plans || [];
      if (!have.length) { ch.push({ r, plans: ps.map(p => ({ key: p.key, name: p.name, cur: p.cur })), from: r.cur || '' }); return; }
      const map = ps.map(p => { const h = have.find(x => x.key === p.key) || have.find(x => sameName(x.name, p.name) || String(x.name).indexOf(String(p.name).replace(/^ภาษา/, '')) >= 0); return h ? { key: h.key, cur: p.cur } : null; });
      if (map.some(x => !x)) { skip.push(name + ' (แผนใน EMS: ' + have.map(x => x.key + ' ' + x.name).join(', ') + ' จับคู่กับไฟล์ไม่ได้)'); return; }
      if (map.some(m => (have.find(x => x.key === m.key) || {}).cur !== m.cur)) ch.push({ r, planCur: map });
    });
    return { ch, skip };
  }
  function previewImport(x) {
    const rc = x.rooms ? roomChanges(x.rooms) : { ch: [], skip: [] };
    pending = { x, rc };
    const old = y => cohort(y), li = s => `<li>${s}</li>`;
    modal(`<h2>นำเข้าหลักสูตร — ตรวจก่อนบันทึก</h2><ul class="small" style="margin:8px 0 0 18px;padding:0">
      ${x.subjects ? li(`รายวิชา ${Object.keys(x.subjects.subjects).length} วิชา ${docs().subjects ? '(แทนของเดิม ' + Object.keys(subjects()).length + ' วิชา · คงการตั้งกลุ่มสาระไว้)' : ''}`) : ''}
      ${x.cohorts.map(c => li(`แผนการเรียนรุ่น ${c.cohort}: ${Object.keys(c.plans).length} แผน ${old(c.cohort) ? '(แทนของเดิม)' : '(ใหม่)'}`)).join('')}
      ${x.rooms ? li(`ผูกห้องกับแผน ปี ${esc(x.rooms.year)}: เปลี่ยน ${rc.ch.length} ห้อง${rc.skip.length ? ' · ข้าม ' + rc.skip.length + ' ห้อง' : ''}`) : ''}
      ${x.bad.map(b => li(`<span style="color:var(--bad)">ข้ามไฟล์ ${esc(b)}</span>`)).join('')}</ul>
      ${x.rooms && x.rooms.year !== yearNow() ? `<div class="notice" style="margin-top:8px">ไฟล์ผูกห้องเป็นของปี ${esc(x.rooms.year)} แต่ปีการศึกษาปัจจุบันคือ ${yearNow()} — ตรวจชั้นของแต่ละห้องอีกครั้ง</div>` : ''}
      ${rc.ch.length ? `<details style="margin-top:8px"><summary class="small">ห้องที่จะเปลี่ยน (${rc.ch.length})</summary><div class="small scroll" style="max-height:30vh">${rc.ch.map(c => esc(c.r.name) + ' → ' + esc(c.cur || (c.plans || c.planCur).map(p => p.key + ':' + p.cur).join(', '))).join('<br>')}</div></details>` : ''}
      ${rc.skip.length ? `<details style="margin-top:6px" open><summary class="small">ห้องที่ข้าม (${rc.skip.length}) — ตั้งเองในตารางห้องเรียน</summary><div class="small">${rc.skip.map(esc).join('<br>')}</div></details>` : ''}
      <div class="row" style="border:0;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" data-curdo="import">บันทึก</button></div>`, true);
  }
  function doImport() {
    if (!pending || !canEdit()) return closeModal();
    const x = pending.x, rc = x.rooms ? roomChanges(x.rooms) : { ch: [], skip: [] }, d = docs(), at = new Date().toISOString();      // คำนวณใหม่จากห้องปัจจุบัน (school/config อาจถูกแก้ระหว่างเปิดหน้าต่าง)
    if (x.subjects) d.subjects = { ver: x.subjects.ver || 1, at, subjects: x.subjects.subjects, areaMap: (d.subjects || {}).areaMap || x.subjects.areaMap || {} };
    x.cohorts.forEach(c => { d[String(c.cohort)] = { cohort: +c.cohort, ver: c.ver || 1, at, plans: c.plans }; });
    let made = 0;
    rc.ch.forEach(c => {
      if (c.cur) { c.r.cur = c.cur; return; }
      if (c.planCur) { c.planCur.forEach(m => { const p = c.r.plans.find(x => x.key === m.key); if (p) p.cur = m.cur; }); return; }
      /* ห้องยังไม่แบ่งแผน → ตั้งแผน + ห้องย่อยแบบเดียวกับ plans.js (ใช้ห้องเดิมถ้าชื่อตรง) */
      delete c.r.cur; c.r.plans = c.plans;
      c.plans.forEach(p => { const nm = c.r.name + p.key; let s = (S.rooms || []).find(x => x.parent === c.r.id && x.plan === p.key) || (S.rooms || []).find(x => sameName(x.name, nm));
        if (!s) { s = { id: c.r.id + '-' + p.key, name: nm, count: 0 }; S.rooms.push(s); made++; }
        s.parent = c.r.id; s.plan = p.key; s.planName = p.name; s.name = nm; });
    });
    pending = null; save(); flushNow(); closeModal(); rr();
    toast('บันทึกหลักสูตรแล้ว' + (rc.ch.length ? ' · ผูก ' + rc.ch.length + ' ห้อง' : '') + (made ? ' · สร้างห้องย่อย ' + made + ' ห้อง' : ''));
  }

  /* ---------- เหตุการณ์ ---------- */
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.matches && t.matches('[data-curfile]')) { if (!canEdit()) return; const files = Array.from(t.files || []); t.value = ''; if (files.length) previewImport(await readFiles(files)); return; }
    if (t.dataset && t.dataset.cur !== undefined) { if (!canEdit()) return rr(); const r = (S.rooms || []).find(x => x.id === t.dataset.cur); if (!r) return;
      if (t.dataset.key) { const p = (r.plans || []).find(x => x.key === t.dataset.key); if (p) { if (t.value) p.cur = t.value; else delete p.cur; } }
      else if (t.value) r.cur = t.value; else delete r.cur;
      save(); flushNow(); return rr(); }
    if (t.dataset && t.dataset.curarea !== undefined) { if (!canEdit() || !docs().subjects) return rr(); const m = docs().subjects.areaMap = Object.assign({}, docs().subjects.areaMap || {});
      if (t.value) m[t.dataset.curarea] = t.value; else delete m[t.dataset.curarea]; save(); flushNow(); return rr(); }
    if (t.dataset && t.dataset.curview) { ui[t.dataset.curview] = t.value; return rr(); }
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-curdo]'); if (!b) return; if (b.dataset.curdo === 'import') doImport(); });

  /* ---------- เมนู ---------- */
  const N = window.EMSNav;
  if (N) { const grp = (N.NAVG.admin || []).find(x => x[0] === 'ฝ่ายงาน'); if (grp && !grp[1].some(x => x[0] === 'a-cur')) grp[1].push(['a-cur', 'หลักสูตร / แผนการเรียน', 'book']); }

  /** ห้องที่ cloud.js ต้องโหลด: หน้าหลักสูตร = ทุกรุ่น · หน้าอื่น = รายวิชา + 3 รุ่นที่เรียนอยู่ปีนี้ */
  const need = () => ['a-cur', 'loadprop', 'a-loadprop', 'schedule', 'tt-studio', 'a-settings', 'course'].indexOf(page) >= 0;      // ตารางสอน: ตรวจชื่อวิชากับหลักสูตร (ttsummary.js)
  const ids = () => { if (page === 'a-cur') return 'all'; const y = yearNow(); return y ? ['subjects', String(y + 1), String(y), String(y - 1), String(y - 2)] : ['subjects']; };
  window.EMSCur = { subj, label, per, planOf, codesOf, gradeFor, required, coverage, coverageCard, deptOf, areaName, need, ids, parseCur };
})();
