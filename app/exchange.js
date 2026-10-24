/* EMS — ศูนย์แลกคาบ สอนแทน และการลา (ย้ายจาก KruSpace: renderExchangeCenter, findCoverageCandidates,
   createCoverageRequest, respondExchangeRequest, submitLeaveRequest, exchangeMemoHtml, headCoverCandidates)
   - สลับคาบ = ครูที่สอน "ห้องเดียวกัน" เลขคาบตรงกัน คนละวัน ยกคาบมาสลับที่กันตรง ๆ
   - แลกคาบ  = ครูห้องเดียวกันที่ว่างตรงคาบเรา และเราว่างตรงคาบเขา จึงแลกกันไปสอน
   - สอนแทน  = ไม่มีใครแลก/สลับได้ จึงขอครูกลุ่มสาระเดียวกันที่ว่างมาสอนให้ ไม่ต้องสอนคืน
   - คาบคู่ (คาบติดกัน ห้อง/วิชาเดียวกัน) ย้ายพร้อมกันทั้งก้อน และนับตามจำนวนคาบจริง
   - เลือกได้ 3 ช่วง: สัปดาห์ก่อน · สัปดาห์นี้ · สัปดาห์หน้า ไม่เสนอวันเดียวกัน วันที่ผ่านแล้ว หรือวันหยุด
   - ลา/ไปราชการ ต้องบันทึกใบลาก่อน ระบบหาครูดูแลให้ทุกคาบในช่วงที่ลา (ลากิจ/ไปราชการต้องแลกเอง
     ลาประเภทอื่นเลือกให้หัวหน้ากลุ่มสาระจัดครูให้ได้)
   ตารางสอนทั้งโรงเรียนอยู่ที่ S.tt (ของฉัน) + S.ttOthers (ครูท่านอื่น) — คำขอที่ตอบรับแล้วคำนวณเป็นคาบแลก/สอนแทนใหม่ทุกครั้ง */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => new Date(s + 'T00:00:00');
const dayIdxOf = s => { const w = parse(s).getDay(); return w >= 1 && w <= 5 ? w - 1 : -1; };
const shift = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoOf(d); };
const weekDate = (dayIdx, base) => { const d = parse(base), mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7) + dayIdx); return isoOf(mon); };
const isHoliday = s => (S.events || []).some(e => e.cat === 'holiday' && e.date === s);
const today = () => todayISO();
const nextSchoolDay = s => { let d = s; for (let i = 0; i < 10; i++) { if (dayIdxOf(d) >= 0 && !isHoliday(d)) return d; d = shift(d, 1); } return s; };
const SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'];
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const redraw = () => { MV = null; const y = scrollY; render(); scrollTo(0, y); };

/* ---------- ข้อมูลตั้งต้น ---------- */
const OTHER_CLASS = { 'x-m21': 'ม.2/1', 'x-m32': 'ม.3/2' };
if (!S.staff.some(u => u.name === 'ครูมานพ ศรีวิทย์')) S.staff.push({ name: 'ครูมานพ ศรีวิทย์', email: 'manop@example.com', role: 'teacher', dept: 'วิทยาศาสตร์', phone: '081-000-0101' });
if (!S.staff.some(u => u.name === 'ครูอรุณี ใจงาม')) S.staff.push({ name: 'ครูอรุณี ใจงาม', email: 'arunee@example.com', role: 'teacher', dept: 'วิทยาศาสตร์', phone: '081-000-0102' });
S.staff.forEach((u, i) => { if (!u.phone && u.role !== 'admin') u.phone = '081-000-0' + String(200 + i); });
if (!S.ttOthers) {
  const E = (teacher, classId, subject, day, ps) => ps.map(p => ({ id: uid('e'), teacher, classId, subject, day, p }));
  S.ttOthers = [].concat(
    E('ครูสุดา แสงทอง', 'm4-2', 'ค31101 คณิตศาสตร์', 0, [2, 3]), E('ครูสุดา แสงทอง', 'm4-2', 'ค31101 คณิตศาสตร์', 2, [4]),
    E('ครูสุดา แสงทอง', 'm1-3', 'ค21101 คณิตศาสตร์', 1, [0]), E('ครูสุดา แสงทอง', 'm5-1', 'ค32101 คณิตศาสตร์', 4, [4, 5]),
    E('ครูวิไล เพชรงาม', 'm1-3', 'ท21101 ภาษาไทย', 0, [2]), E('ครูวิไล เพชรงาม', 'm1-3', 'ท21101 ภาษาไทย', 2, [2, 3]),
    E('ครูวิไล เพชรงาม', 'm4-2', 'ท31101 ภาษาไทย', 3, [0, 1]), E('ครูวิไล เพชรงาม', 'm5-1', 'ท32101 ภาษาไทย', 1, [4]),
    E('ครูมานพ ศรีวิทย์', 'm5-1', 'ว30221 เคมี', 0, [5]), E('ครูมานพ ศรีวิทย์', 'm5-1', 'ว30221 เคมี', 3, [2, 3]),
    E('ครูมานพ ศรีวิทย์', 'x-m21', 'ว22101 วิทยาศาสตร์', 1, [1, 2]), E('ครูมานพ ศรีวิทย์', 'x-m21', 'ว22101 วิทยาศาสตร์', 4, [0]),
    E('ครูอรุณี ใจงาม', 'x-m32', 'ว23101 วิทยาศาสตร์', 0, [0, 1]), E('ครูอรุณี ใจงาม', 'x-m32', 'ว23101 วิทยาศาสตร์', 2, [5]), E('ครูอรุณี ใจงาม', 'x-m32', 'ว23101 วิทยาศาสตร์', 3, [4]));
}
S.xreqs = S.xreqs || [];
S.xui = Object.assign({ mode: 'swap', kind: 'all', date: '', src: '', note: '', picks: {} }, S.xui || {});
const LT = { sick: 'ลาป่วย', personal: 'ลากิจส่วนตัว', vacation: 'ลาพักผ่อน', maternity: 'ลาคลอดบุตร', trip: 'ไปราชการ', other: 'ลาอื่น ๆ' };
const SELF = ['personal', 'trip'];                 // ลากิจและไปราชการเป็นธุระของครูเอง ต้องแลกคาบเอง

/* ---------- ตารางสอน ---------- */
const cname = id => (cls(id) || {}).name || ((S.rooms || []).find(r => r.id === id) || {}).name || OTHER_CLASS[id] || id;
const levelOf = id => { const m = String(cname(id)).match(/ม\.?\s?(\d)/); return m ? 'ม.' + m[1] : ''; };
const myEntries = () => Object.entries(S.tt).map(([k, cid]) => { const [d, p] = k.split('-').map(Number); const c = cls(cid); const lo = (S.ttLoc || {})[k]; return Object.assign({ id: 'me-' + k, teacher: S.me.name, classId: cid, subject: (S.ttSub || {})[k] || (c ? c.subject : ''), day: d, p }, lo ? { room: lo } : {}); });
const allEntries = () => myEntries().concat(S.ttOthers || []);
function blockOf(e, list) {
  if (e.shifted) return [e];                                        // คาบที่ยกมาจากการสลับวัน คิดทีละคาบ
  const same = (list || allEntries()).filter(x => x.teacher === e.teacher && x.day === e.day && x.classId === e.classId && x.subject === e.subject);
  let lo = e.p, hi = e.p;
  while (same.some(x => x.p === lo - 1)) lo--;
  while (same.some(x => x.p === hi + 1)) hi++;
  return same.filter(x => x.p >= lo && x.p <= hi).sort((a, b) => a.p - b.p);
}
const spanText = blk => blk.length > 1 ? 'คาบ ' + (blk[0].p + 1) + '-' + (blk[blk.length - 1].p + 1) : 'คาบ ' + (blk[0].p + 1);
const entryText = (e, date) => `${thDate(date)} · ${spanText([e])} · ${cname(e.classId)} · ${e.subject}`;
const blockText = (blk, date) => `${thDate(date)} · ${spanText(blk)} · ${cname(blk[0].classId)} · ${String(blk[0].subject).split(' ')[0]}`;
const staffOf = n => S.staff.find(u => u.name === n) || (n === S.me.name ? { name: n, dept: S.me.dept } : { name: n });
const areaOf = n => String(staffOf(n).dept || '').replace(/^กลุ่มสาระ(การเรียนรู้)?ฯ?\s*/, '').trim();
const phoneHtml = n => { const p = staffOf(n).phone; return p ? `<a class="x-phone" href="tel:${esc(p.replace(/[^\d+]/g, ''))}">☎ ${esc(p)}</a>` : '<span class="muted small">ยังไม่มีเบอร์โทร</span>'; };

/* ---------- คาบแลก/สอนแทนที่เกิดจากคำขอที่ตอบรับแล้ว ---------- */
let MV = null;
function moves() {
  if (MV) return MV;
  const hidden = new Set(), extra = [];
  S.xreqs.filter(r => r.status === 'accepted').forEach(r => {
    const src = r.src || [], tgt = r.tgt || [];
    src.forEach(e => hidden.add(e.id + '|' + r.sourceDate));
    if (r.type === 'exchange') tgt.forEach(e => hidden.add(e.id + '|' + r.targetDate));
    const add = (date, p, teacher, base, kind) => extra.push({ date, p, teacher, classId: base.classId, subject: base.subject, kind, reqId: r.id });
    if (r.type === 'exchange' && r.swapKind === 'trade') {            // แลกคาบ — คาบอยู่ที่เดิม เปลี่ยนแค่คนสอน
      src.forEach(e => add(r.sourceDate, e.p, r.target, e, 'แลกคาบ'));
      tgt.forEach(e => add(r.targetDate, e.p, r.requester, e, 'แลกคาบ'));
    } else if (r.type === 'exchange') {                                // สลับคาบ — ยกคาบข้ามวันมาสลับที่กัน
      src.forEach((e, i) => add(r.targetDate, (tgt[i] || tgt[0]).p, r.requester, e, 'สลับคาบ'));
      tgt.forEach((e, i) => add(r.sourceDate, (src[i] || src[0]).p, r.target, e, 'สลับคาบ'));
    } else src.forEach(e => add(r.sourceDate, e.p, r.target, e, 'สอนแทน'));
  });
  return (MV = { hidden, extra });
}
/* คาบที่เรียนจริงในวันที่หนึ่ง — คิดการสลับวันเรียน/สลับคาบที่ผู้ดูแลตั้งไว้ (S.dayShifts) */
function entriesOn(date, list, override) {
  const all = list || allEntries(), di = dayIdxOf(date), sh = override || (S.dayShifts || []).find(x => x.date === date);
  if (!sh) return di < 0 ? [] : all.filter(e => e.day === di);
  if (sh.mode === 'day') return all.filter(e => e.day === +sh.sourceDay);
  const map = sh.map || [], tg = new Set(map.map(m => +m.p));
  const out = di < 0 ? [] : all.filter(e => e.day === di && !tg.has(e.p));
  map.forEach(m => all.filter(e => e.day === +m.fromDay && e.p === +m.fromP).forEach(e => out.push(Object.assign({}, e, { p: +m.p, shifted: true }))));
  return out;
}
function busy(teacher, date, p, exceptIds) {
  const mv = moves(), ex = exceptIds || [];
  return entriesOn(date).some(e => e.teacher === teacher && e.p === p && !mv.hidden.has(e.id + '|' + date) && ex.indexOf(e.id) < 0) ||
    mv.extra.some(x => x.teacher === teacher && x.date === date && x.p === p) ||
    (window.EMSAdmin && EMSAdmin.dutiesAt ? EMSAdmin.dutiesAt(teacher, dayIdxOf(date), p).some(d => d.kind === 'meeting' || d.kind === 'extra') : false);
}
const freeFor = (teacher, date, blk, exceptIds) => blk.every(e => !busy(teacher, date, e.p, exceptIds));
/** คาบประจำของครูในวันนั้นที่ยังไม่ถูกย้ายออก (ใช้เลือกคาบที่จะจัดการ) */
const regularOn = (teacher, date) => { const mv = moves();
  return entriesOn(date).filter(e => e.teacher === teacher && !mv.hidden.has(e.id + '|' + date)).sort((a, b) => a.p - b.p); };
const isVacantU = u => (u.roles && u.roles.length ? u.roles : [u.role]).indexOf('vacant') >= 0;
const teachesRole = u => !isVacantU(u) && (u.roles && u.roles.length ? u.roles : [u.role]).some(r => ['teacher', 'head', 'academic'].indexOf(r) >= 0);   // ตำแหน่งว่างไม่ใช่ครูสอนแทน (ข้อมูลเก่าอาจมีบทบาท teacher ติดมา)
const dutiesOn = (teacher, date) => moves().extra.filter(x => x.teacher === teacher && x.date === date).sort((a, b) => a.p - b.p);
const coverLoad = n => S.xreqs.filter(r => r.target === n && (r.status === 'pending' || r.status === 'accepted')).length;
const teachesLevel = (n, lv) => !!lv && allEntries().some(e => e.teacher === n && levelOf(e.classId) === lv);

/* ---------- หาครูที่เหมาะสม ---------- */
const KINDS = { swap: { label: 'สลับคาบ', tag: '⇄ สลับคาบ — ห้องเดียวกัน เลขคาบตรงกัน คนละวัน', send: 'ส่งคำขอสลับคาบ', base: 0 },
                trade: { label: 'แลกคาบ', tag: '⇆ แลกคาบ — เขาว่างคาบเรา เราไปสอนคืนคาบเขา', send: 'ส่งคำขอแลกคาบ', base: 500 } };
const kindOf = c => c.mode === 'exchange' ? c.swapKind : 'sub';
const kindLabel = r => r.type === 'exchange' ? KINDS[r.swapKind === 'trade' ? 'trade' : 'swap'].label : 'สอนแทน';
const weekLabel = w => w < 0 ? 'สัปดาห์ก่อน' : w === 0 ? 'สัปดาห์นี้' : 'สัปดาห์หน้า';
const periodRank = (e, all) => { const blk = blockOf(e, all); if (blk.length > 1) return 0; return (e.p + 1) % 2 === 0 ? 1 : 2; };
function candidates(source, date) {
  const all = allEntries(), srcBlk = blockOf(source, all), srcIds = srcBlk.map(e => e.id), srcKey = srcBlk.map(e => e.p).join('-');
  const myArea = areaOf(source.teacher), lv = levelOf(source.classId), out = [], seen = new Set();
  const addBlock = (kind, teacher, tgtBlk, tierText) => {
    if (tgtBlk.length !== srcBlk.length || tgtBlk.some(e => srcIds.indexOf(e.id) >= 0)) return;   // คาบคู่ต้องแลกกับคาบคู่ที่ยาวเท่ากัน
    const key = kind + '|' + teacher + '|' + tgtBlk[0].day + '|' + tgtBlk.map(e => e.p).join('-'); if (seen.has(key)) return; seen.add(key);
    const tgtIds = tgtBlk.map(e => e.id);
    [-1, 0, 1].forEach(w => {
      const td = shift(weekDate(tgtBlk[0].day, date), w * 7);
      if (td === date || td < today() || isHoliday(td)) return;                      // ห้ามวันเดียวกัน วันที่ผ่านแล้ว และวันหยุด
      if (!freeFor(teacher, date, srcBlk, tgtIds)) return;                            // เขาต้องว่างทุกคาบที่จะมาสอนแทนเรา
      if (!freeFor(source.teacher, td, tgtBlk, srcIds)) return;                       // เราต้องว่างทุกคาบที่ต้องไปสอนคืน
      out.push({ mode: 'exchange', swapKind: kind, teacher, src: srcBlk, tgt: tgtBlk, targetDate: td, week: w,
        rank: KINDS[kind].base + Math.abs(w) * 10 + (w < 0 ? 5 : 0) + periodRank(tgtBlk[0], all),
        tier: KINDS[kind].label + ' · ' + tierText + ' · ' + weekLabel(w) + (srcBlk.length > 1 ? ' · คาบคู่ ' + srcBlk.length + ' คาบ' : '') });
    });
  };
  all.filter(e => e.teacher !== source.teacher && e.classId === source.classId && e.subject !== source.subject && srcIds.indexOf(e.id) < 0 && !isVacantU(staffOf(e.teacher))).forEach(t => {   // ตำแหน่งว่างแลก/สลับคาบไม่ได้
    const tb = blockOf(t, all), aligned = tb.map(e => e.p).join('-') === srcKey;
    addBlock(aligned ? 'swap' : 'trade', t.teacher, tb, aligned ? 'ห้องเดียวกัน · เลขคาบตรงกัน' : 'ห้องเดียวกัน · เขาว่างตรงคาบที่เราลา');
  });
  out.sort((a, b) => a.rank - b.rank || a.tgt[0].p - b.tgt[0].p);
  if (out.length) return out;
  /* ไม่มีใครแลก/สลับได้ → ขอสอนแทน (กลุ่มสาระเดียวกัน เรียงคนที่สอนระดับชั้นเดียวกันและรับงานน้อยก่อน) */
  return S.staff.filter(u => u.name !== source.teacher && teachesRole(u) && (!myArea || areaOf(u.name) === myArea) && freeFor(u.name, date, srcBlk))
    .map(u => { const same = teachesLevel(u.name, lv);
      return { mode: 'substitute', swapKind: '', teacher: u.name, src: srcBlk, tgt: [], targetDate: date, week: 0, rank: (same ? 100 : 150) + Math.min(40, coverLoad(u.name)),
        tier: 'ขอสอนแทน · กลุ่มสาระเดียวกัน' + (lv ? (same ? ' · สอนระดับ ' + lv + ' อยู่แล้ว' : ' · ไม่ได้สอนระดับ ' + lv) : '') + (srcBlk.length > 1 ? ' · คาบคู่ ' + srcBlk.length + ' คาบ' : '') }; })
    .sort((a, b) => a.rank - b.rank || a.teacher.localeCompare(b.teacher, 'th'));
}
/** ครูที่ว่างตรงคาบนั้น จัดลำดับให้หัวหน้ากลุ่มสาระเลือก */
const TIERS = [['sameAreaSameLevel', 'กลุ่มสาระเดียวกัน · สอนระดับชั้นเดียวกัน'], ['sameAreaOtherLevel', 'กลุ่มสาระเดียวกัน · คนละระดับชั้น'], ['otherAreaSameLevel', 'ต่างกลุ่มสาระ · สอนระดับชั้นเดียวกัน'], ['anyFree', 'ครูอื่นที่ว่างตรงคาบ']];
function headCandidates(r) {
  const blk = r.src, area = areaOf(r.requester), lv = levelOf(blk[0].classId);
  return S.staff.filter(u => u.name !== r.requester && teachesRole(u) && freeFor(u.name, r.sourceDate, blk))
    .map(u => { const sa = !!area && areaOf(u.name) === area, sl = teachesLevel(u.name, lv), t = sa && sl ? 0 : sa ? 1 : sl ? 2 : 3;
      return { teacher: u.name, tier: t, label: TIERS[t][1], load: coverLoad(u.name) }; })
    .sort((a, b) => a.tier - b.tier || a.load - b.load || a.teacher.localeCompare(b.teacher, 'th'));
}

/* ---------- คำขอ ---------- */
const snap = e => ({ id: e.id, teacher: e.teacher, classId: e.classId, subject: e.subject, day: e.day, p: e.p });
function createReq(srcBlk, date, c, reason, note, leaveId) {
  const r = { id: uid('xr'), type: c ? c.mode : 'substitute', swapKind: c ? c.swapKind : '', sourceDate: date, targetDate: c ? c.targetDate : date,
    src: srcBlk.map(snap), tgt: c ? c.tgt.map(snap) : [], requester: srcBlk[0].teacher, target: c ? c.teacher : '', reason: reason || 'swap', note: note || '',
    tier: c ? c.tier : 'ยังไม่พบครูว่าง', leaveId: leaveId || '', status: c ? 'pending' : 'unassigned', createdAt: new Date().toISOString() };
  S.xreqs.push(r); MV = null; return r;
}
const reasonText = r => r.reason === 'swap' ? 'แลกคาบปกติ (ไม่ใช่การลา)' : r.reason === 'vacant' ? 'ตำแหน่งว่าง (รอครูตัวจริง)' : (LT[r.reason] || r.reason);
const leaveOf = id => (S.leaves || []).find(l => l.id === id);
/** คาบที่รอหัวหน้ากลุ่มสาระฯ (หรือผู้ได้รับมอบหมาย) จัดครูสอนแทน — มาจากใบลาที่เลือกให้หัวหน้าจัด หรือครูกด “แจ้งหัวหน้ากลุ่มสาระฯ” เมื่อแลกคาบไม่ได้ */
const headQueued = r => (r.status === 'unassigned' || r.status === 'rejected') && (!!r.toHead || (!!r.leaveId && (leaveOf(r.leaveId) || {}).cover === 'head'));
S.coverDelegates = S.coverDelegates || {};                       // กลุ่มสาระ → ชื่อครูที่หัวหน้ามอบหมายให้จัดสอนแทน
const headsOf = area => S.staff.filter(u => areaOf(u.name) === area && !isVacantU(u) && (u.roles || [u.role]).indexOf('head') >= 0).map(u => u.name);
const coverDelegateOf = area => { const n = S.coverDelegates[area]; return n && !isVacantU(staffOf(n)) ? n : ''; };   // ผู้จัดที่ตั้งไว้เป็นตำแหน่งว่าง (ไม่มีตัวคน/บัญชี) ไม่นับ
const canCover = (name, area) => headsOf(area).indexOf(name) >= 0 || (!!name && coverDelegateOf(area) === name);
const myCoverAreas = () => [...new Set(S.xreqs.map(r => areaOf(r.requester)).concat(Object.keys(S.coverDelegates), [areaOf(S.me.name)]))].filter(a => a && canCover(S.me.name, a));
const HEADTXT = 'รอหัวหน้ากลุ่มสาระฯ จัดสอนแทน';
function syncLeaveCoverage(leaveId) {
  const l = leaveOf(leaveId); if (!l) return;
  const linked = S.xreqs.filter(r => r.leaveId === leaveId);
  l.coverage = !linked.length ? 'none' : linked.every(r => r.status === 'accepted') ? 'covered' : linked.some(r => r.status === 'rejected' || r.status === 'unassigned') ? 'attention' : 'pending';
}
const slotCount = r => Math.max(1, (r.src || []).length);
const totalSlots = list => list.reduce((n, r) => n + slotCount(r), 0);
const activeLeave = date => (S.leaves || []).filter(l => l.by === S.me.name && l.status !== 'rejected' && l.from <= date && date <= (l.to || l.from)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;

/* ---------- CSS ---------- */
const css = document.createElement('style');
css.textContent = `
.x-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:16px;align-items:start}
.x-layout > div > .card:first-child{margin-top:0}
@media(max-width:1000px){.x-layout{grid-template-columns:minmax(0,1fr)}}
.x-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.x-mode{text-align:left;padding:14px;border:2px solid var(--line);border-radius:var(--r);background:var(--surface);font-weight:700;font-size:1rem}
.x-mode small{display:block;font-weight:400;color:var(--muted);font-size:.84rem;margin-top:2px}
.x-mode[aria-pressed="true"]{border-color:var(--brand);background:var(--brand-soft);color:var(--brand)}
.x-strip{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:6px 0}
.x-box{width:30px;height:30px;border-radius:7px;display:grid;place-items:center;font-size:.8rem;font-weight:700;border:1px solid var(--line)}
.x-box.free{background:var(--ok-soft);color:var(--ok);border-color:transparent}
.x-box.busy{background:var(--bad-soft);color:var(--bad);border-color:transparent}
.x-box.mk{color:#fff;border:0}
.x-box.mk.swap{background:#b45309}.x-box.mk.trade{background:#6b3fa0}.x-box.mk.sub{background:#0f766e}.x-box.mk.pick{background:var(--brand)}
.x-box.mk.take{background:transparent;border:2px dashed;color:var(--text)}
.x-box.mk.take.swap{border-color:#b45309}.x-box.mk.take.trade{border-color:#6b3fa0}
.x-count{font-size:.78rem;color:var(--muted);margin-left:6px}
.x-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:.78rem;color:var(--muted);margin:6px 0}
.x-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:4px}
.x-cand{border:1px solid var(--line);border-left:5px solid var(--line);border-radius:12px;padding:12px 14px;margin-top:10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start}
.x-cand.swap{border-left-color:#b45309}.x-cand.trade{border-left-color:#6b3fa0}.x-cand.sub{border-left-color:#0f766e}
.x-cand.top{box-shadow:0 0 0 2px var(--gold) inset}
.x-tag{font-size:.78rem;font-weight:700;margin-bottom:2px}
.x-tag.swap{color:#b45309}.x-tag.trade{color:#6b3fa0}.x-tag.sub{color:#0f766e}
.x-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.x-pick{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:4px 8px;font-size:.8rem;cursor:pointer}
.x-pick[aria-pressed="true"]{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}
.x-phone{font-size:.84rem;font-weight:600;color:var(--brand)}
.x-req{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 0;border-top:1px solid var(--line)}
.x-req:first-child{border-top:0}
.x-acc{background:var(--ok-soft);border-radius:10px;padding:10px 12px;margin:8px 0;font-size:.9rem}
.x-accrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0}.x-accrow .btn{padding:2px 10px}
.x-prog{height:8px;border-radius:99px;background:var(--surface2);overflow:hidden;margin:8px 0}
.x-prog i{display:block;height:100%;background:var(--ok)}
.x-note{padding:10px 12px;border-radius:10px;background:var(--info-soft);font-size:.9rem;margin-top:10px}
.x-note.locked{background:var(--warn-soft)}
`;
document.head.appendChild(css);

const strip = (teacher, date, mark, tone, role) => {
  let html = '', n = 0;
  for (let p = 0; p < PERIODS.length; p++) {
    if (mark.indexOf(p) >= 0) { html += `<span class="x-box mk ${tone} ${role || ''}" title="${esc('คาบ ' + (p + 1))}">${p + 1}</span>`; continue; }
    const b = busy(teacher, date, p); if (b) n++;
    html += `<span class="x-box ${b ? 'busy' : 'free'}" title="${esc('คาบ ' + (p + 1) + ' · ' + (b ? 'ไม่ว่าง' : 'ว่าง'))}">${p + 1}</span>`;
  }
  return `<div class="x-strip">${html}<span class="x-count">ติดสอน ${n}/${PERIODS.length} คาบ</span></div>`;
};
const legend = () => `<div class="x-legend"><span><i style="background:var(--ok-soft)"></i>ว่าง</span><span><i style="background:var(--bad-soft)"></i>ไม่ว่าง</span><span><i style="background:#b45309"></i>สลับคาบ</span><span><i style="background:#6b3fa0"></i>แลกคาบ</span><span><i style="background:#0f766e"></i>สอนแทน</span><span><i style="border:2px dashed var(--muted)"></i>คาบที่ต้องไปสอนคืน</span></div>`;

/* ---------- สรุปการจัดคาบของวัน ---------- */
function dayStatus(date) {
  const own = regularOn(S.me.name, date), done = new Set(), rows = [];
  S.xreqs.filter(r => r.status === 'accepted' && r.sourceDate === date && r.requester === S.me.name).forEach(r => r.src.forEach(e => {
    rows.push({ p: e.p, e, state: 'done', who: r.target, mode: kindLabel(r) }); done.add(e.id); }));
  own.forEach(e => { if (done.has(e.id)) return;
    const r = S.xreqs.find(x => x.sourceDate === date && x.requester === S.me.name && x.src.some(s => s.id === e.id) && x.status !== 'accepted');
    rows.push({ p: e.p, e, state: !r ? 'none' : r.status === 'pending' ? 'waiting' : 'todo', who: r ? r.target : '', mode: r ? kindLabel(r) : '' }); });
  return rows.sort((a, b) => a.p - b.p);
}
function summaryCard(date) {
  const rows = dayStatus(date), need = rows.filter(r => r.state !== 'none'), ok = rows.filter(r => r.state === 'done').length;
  if (!rows.length) return `<div class="card"><h2>สรุปการจัดคาบ · ${thDate(date)}</h2><div class="empty">วันนี้ไม่มีคาบสอนที่ต้องจัด</div></div>`;
  const st = r => r.state === 'done' ? chip(r.mode + 'แล้ว', 'ok') : r.state === 'waiting' ? chip('รอตอบรับ · ' + r.mode, 'warn') : r.state === 'todo' ? chip('ยังไม่ได้จัด', 'bad') : '<span class="muted small">สอนตามปกติ</span>';
  return `<div class="card"><div class="row" style="border:0;padding-top:0"><div class="grow"><h2 style="margin:0">สรุปการจัดคาบ · ${thDate(date)}</h2>
      <div class="muted small">คาบของฉัน ${rows.length} คาบ${need.length ? ' · กำลังจัด ' + need.length + ' คาบ' : ''}</div></div>${need.length ? chip(need.length - ok ? 'ยังเหลือ ' + (need.length - ok) + ' คาบ' : 'จัดครบแล้ว', need.length - ok ? 'bad' : 'ok') : ''}</div>
    ${need.length ? `<div class="x-prog"><i style="width:${Math.round(ok * 100 / need.length)}%"></i></div>` : ''}
    <div class="scroll"><table class="tbl"><thead><tr><th>คาบ</th><th>วิชา / ห้อง</th><th>สถานะ</th><th>ผู้รับ</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><b>${r.p + 1}</b></td><td>${esc(String(r.e.subject).split(' ')[0])}<br><span class="muted small">${esc(cname(r.e.classId))}</span></td><td>${st(r)}</td><td>${esc(r.who || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- การ์ดคำขอ ---------- */
function requestsCard() {
  const me = S.me.name, all = S.xreqs.filter(r => r.requester === me || r.target === me).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!all.length) return '';
  const active = all.filter(r => r.status !== 'accepted'), done = all.filter(r => r.status === 'accepted');
  const waitMe = active.filter(r => r.status === 'pending' && r.target === me).length;
  return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><h2 style="margin:0">คำขอแลกคาบและสอนแทน</h2><span class="grow"></span>
      ${waitMe ? chip(waitMe + ' รอฉันตอบรับ', 'warn') : ''}<button class="btn sm" data-x="pickAll">เลือกทั้งหมด</button><button class="btn sm" data-x="memoPicked">พิมพ์บันทึกข้อความรวมที่เลือก</button></div>
    ${done.length ? `<div class="x-acc"><b>ตอบรับแล้ว ${totalSlots(done)} คาบ</b><div class="muted small">${done.map(r => `<div class="x-accrow"><span>${esc((r.requester === me ? r.target : r.requester) + ' · ' + thDate(r.sourceDate) + ' · ' + kindLabel(r) + (slotCount(r) > 1 ? ' · คาบคู่ ' + slotCount(r) + ' คาบ' : ''))}</span>${r.requester === me ? `<button class="btn sm ghost" style="color:var(--bad)" data-x="delAcc" data-id="${r.id}">ลบ</button>` : ''}</div>`).join('')}</div>
      <button class="btn sm" style="margin-top:6px" data-x="memoDone">พิมพ์บันทึกข้อความรวมที่ตอบรับแล้ว</button></div>` : ''}
    ${active.length ? active.map(r => { const incoming = r.target === me, other = incoming ? r.requester : r.target;
      const stx = r.status === 'pending' ? (incoming ? '' : chip('รอตอบรับ', 'warn')) : headQueued(r) ? chip('ส่งหัวหน้ากลุ่มสาระฯ แล้ว', 'info') : r.status === 'unassigned' ? chip('ยังไม่พบครู', 'bad') : chip('ถูกปฏิเสธ', 'bad');
      return `<div class="x-req"><input type="checkbox" class="x-sel" value="${r.id}" style="width:18px;height:18px;margin-top:4px;accent-color:var(--brand)" aria-label="เลือกคำขอนี้">
        <div><b>${esc(kindLabel(r))} · ${incoming ? 'คำขอจาก ' + esc(other) : other && !headQueued(r) ? 'ส่งถึง ' + esc(other) : (headQueued(r) ? HEADTXT : 'ยังไม่มีผู้รับ')}</b> ${other ? phoneHtml(other) : ''}
          <div class="muted small">${esc(blockText(r.src, r.sourceDate))}${r.type === 'exchange' && r.tgt.length ? '<br>⇄ ' + esc(blockText(r.tgt, r.targetDate)) : ''}
          ${slotCount(r) > 1 ? '<br>' + chip('คาบคู่ ' + slotCount(r) + ' คาบ ย้ายพร้อมกัน', 'info') : ''}<br><b>เหตุผล:</b> ${esc(reasonText(r))}${r.note ? ' · ' + esc(r.note) : ''}<br>${esc(r.tier)}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${stx}
          ${incoming && r.status === 'pending' ? `<button class="btn sm" data-x="reject" data-id="${r.id}">ปฏิเสธ</button><button class="btn sm pri" data-x="accept" data-id="${r.id}">ยอมรับ</button>` : ''}
          ${!incoming && (r.status === 'unassigned' || r.status === 'rejected') && !headQueued(r) ? `<button class="btn sm pri" data-x="findFor" data-id="${r.id}">หาครูให้คาบนี้</button><button class="btn sm" data-x="toHead" data-id="${r.id}">แจ้งหัวหน้ากลุ่มสาระฯ จัดสอนแทน</button>` : ''}
          <button class="btn sm" data-x="memo" data-id="${r.id}">พิมพ์เอกสาร</button>${r.requester === me ? `<button class="btn sm ghost" style="color:var(--bad)" data-x="del" data-id="${r.id}">ลบ</button>` : ''}</div></div>`; }).join('')
      : '<div class="empty">ไม่มีคำขอที่ต้องจัดการแล้ว</div>'}</div>`;
}

/* ---------- หน้า ศูนย์แลกคาบและการลา ---------- */
P.swap = () => {
  const me = S.me.name, X = S.xui;
  const date = X.date = X.date && dayIdxOf(X.date) >= 0 ? X.date : nextSchoolDay(today());
  const own = regularOn(me, date), source = own.find(e => e.id === X.src) || own[0] || null; if (source) X.src = source.id;
  const mode = X.mode === 'leave' ? 'leave' : 'swap', lv = mode === 'leave' ? activeLeave(date) : null;
  const all = source ? candidates(source, date) : [], kind = X.kind;
  const count = k => k === 'all' ? all.length : all.filter(c => kindOf(c) === k).length;
  const shown = kind === 'all' ? all : all.filter(c => kindOf(c) === kind);
  const groups = [], byKey = {};
  shown.forEach(c => { const key = kindOf(c) + ':' + c.teacher; if (!byKey[key]) groups.push(byKey[key] = { key, opts: [] }); byKey[key].opts.push(c); });
  groups.forEach(g => { const want = num((X.picks || {})[g.key]); g.pick = want >= 0 && want < g.opts.length ? want : 0; });
  const canSend = mode === 'swap' || !!lv;
    return `<div class="top"><div><h1>ศูนย์แลกคาบและการลา</h1><p>ครูห้องเดียวกันก่อนเสมอ — เลขคาบตรงกันคือสลับคาบ ไม่ตรงกันคือแลกคาบ · หากไม่พบจึงหาครูในกลุ่มสาระที่ว่างมาสอนแทน</p></div></div>
    <div class="card"><h2>เริ่มจากเลือกก่อนว่าจะทำอะไร</h2><div class="x-modes">
      <button class="x-mode" aria-pressed="${mode === 'swap'}" data-x="mode" data-k="swap">แลกคาบปกติ<small>สลับคาบกับเพื่อนครู ไม่ได้ลา — ไม่ต้องทำใบลา</small></button>
      <button class="x-mode" aria-pressed="${mode === 'leave'}" data-x="mode" data-k="leave">ลา / ไปราชการ<small>ทุกประเภทต้องบันทึกใบลาก่อน แล้วจึงแลกคาบ</small></button></div></div>
    <div class="x-layout"><div>
      <div class="card"><h2>1. เลือกคาบที่ต้องการจัดการ</h2>
        <div class="field"><label class="f" for="x-date">วันที่</label><input id="x-date" class="in" type="date" value="${date}" data-xf="date"></div>
        <div class="field"><label class="f" for="x-src">คาบของฉัน</label><select id="x-src" class="in" data-xf="src">${own.length ? own.map(e => `<option value="${e.id}" ${source && source.id === e.id ? 'selected' : ''}>${esc(entryText(e, date))}</option>`).join('') : '<option value="">— ไม่มีคาบสอนในวันนี้ —</option>'}</select></div>
        <div class="x-note ${mode === 'leave' && !lv ? 'locked' : ''}">${mode === 'swap' ? '<b>แลกคาบปกติ</b> ไม่ต้องทำใบลา ระบบจะบันทึกเหตุผลว่า “แลกคาบปกติ (ไม่ใช่การลา)”'
          : lv ? `<b>ใช้ใบลาที่บันทึกไว้</b> ${esc(LT[lv.type] || '')} · ${thDate(lv.from)}${lv.to && lv.to !== lv.from ? ' ถึง ' + thDate(lv.to) : ''}` : '<b>ยังไม่มีใบลาที่คลุมวันที่นี้</b> แจ้งการลาที่หน้า “ใบลา” ก่อน แล้วจึงส่งคำขอแลกคาบได้'}</div>
        <div class="field" style="margin-top:10px"><label class="f" for="x-note">รายละเอียดเพิ่มเติม</label><input id="x-note" class="in" value="${esc(X.note || '')}" placeholder="เช่น มีนัดหมายช่วงเช้า" data-xf="note"></div>
        ${source ? `<div class="muted small">คาบของฉันวันนี้</div>${strip(me, date, blockOf(source).map(e => e.p), 'pick')}` : ''}</div>
      ${mode === 'leave' ? `<div class="card"><h2>การลา / ไปราชการ</h2><p class="muted small" style="margin-bottom:10px">แจ้งลาและดูประวัติการลาย้ายไปอยู่ที่หน้า “ใบลา” แล้ว — ใบลาที่บันทึกไว้เชื่อมกับคาบที่ต้องจัดในหน้านี้อัตโนมัติ</p>
        <button class="btn ${lv ? '' : 'pri'}" style="width:100%" data-act="go" data-p="leaves">${ic('form')}${lv ? 'ดูใบลาและสถานะการจัดคาบ' : 'ไปแจ้งการลา / ไปราชการ'}</button></div>` : ''}
    </div><div>
      ${summaryCard(date)}
      <div class="card"><div class="row" style="border:0;padding-top:0"><div class="grow"><h2 style="margin:0">2. ครูที่ระบบแนะนำ</h2>
          <div class="muted small">เรียงจากเหมาะสมที่สุด · แลก/สลับคาบเสนอเฉพาะครูที่สอนห้องเดียวกัน · สอนแทนเสนอเฉพาะครูกลุ่มสาระเดียวกัน</div></div>${chip(groups.length + ' ครู', 'info')}</div>
        <div class="pills" style="margin-top:10px">${[['all', 'ทั้งหมด'], ['swap', 'สลับคาบ'], ['trade', 'แลกคาบ'], ['sub', 'สอนแทน']].map(([k, l]) => `<button class="pill" aria-pressed="${kind === k}" data-x="kind" data-k="${k}" ${count(k) ? '' : 'disabled style="opacity:.45"'}>${l} <b>${count(k)}</b></button>`).join('')}</div>
        ${legend()}
        ${!source ? '<div class="empty">วันที่เลือกไม่มีคาบสอนของคุณ</div>' : !shown.length ? `<div class="empty">${kind !== 'all' && all.length ? 'ไม่มีครูที่จัดแบบนี้ได้ในคาบนี้ — กด “ทั้งหมด” เพื่อดูแบบอื่น' : 'ยังไม่พบครูห้องเดียวกันที่แลกหรือสลับคาบได้ และไม่พบครูกลุ่มสาระเดียวกันที่ว่าง<br>แจ้งหัวหน้ากลุ่มสาระฯ (หรือผู้ที่หัวหน้ามอบหมาย) ให้จัดครูสอนแทนได้เลย'}</div>
          ${all.length ? '' : `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn pri" data-x="sendHead" ${canSend ? '' : 'disabled'}>แจ้งหัวหน้ากลุ่มสาระฯ จัดสอนแทน</button><button class="btn" data-x="sendNone" ${canSend ? '' : 'disabled'}>บันทึกไว้หาครูเองภายหลัง</button></div>`}`
          : groups.map((g, gi) => { const c = g.opts[g.pick] || g.opts[0], k = kindOf(c);
            const tgtText = c.tgt.length ? blockText(c.tgt, c.targetDate) : 'ว่างตรง ' + blockText(c.src, date);
            const weeks = g.opts.length > 1 ? [-1, 0, 1].map(w => { const os = g.opts.map((o, oi) => ({ o, oi })).filter(x => x.o.week === w); if (!os.length) return '';
              return `<div class="muted small" style="margin-top:6px">${weekLabel(w)}</div><div class="x-chips">${os.map(x => `<button class="x-pick" aria-pressed="${x.oi === g.pick}" data-x="pick" data-k="${esc(g.key)}" data-i="${x.oi}"><b>${parse(x.o.targetDate).getDate()}/${parse(x.o.targetDate).getMonth() + 1}</b> ${SHORT[dayIdxOf(x.o.targetDate)] || ''} ${spanText(x.o.tgt)}</button>`).join('')}</div>`; }).join('') : '';
            return `<div class="x-cand ${k}${gi === 0 ? ' top' : ''}"><div>
              <div class="x-tag ${k}">${k === 'sub' ? '↷ สอนแทน — ไม่ต้องสอนคืน' : KINDS[k].tag}</div>
              <div class="muted small">${gi === 0 ? '<b style="color:var(--gold)">แนะนำอันดับ 1</b> · ' : ''}${esc(c.tier)}</div>
              <b>${esc(c.teacher)}</b> ${phoneHtml(c.teacher)}<div class="muted small">${esc(k === 'sub' ? tgtText : KINDS[k].label + ' · ' + tgtText)}</div>
              ${weeks}
              <div class="muted small" style="margin-top:8px">คาบของครูท่านนี้ · ${thDate(date)}</div>${strip(c.teacher, date, c.src.map(e => e.p), k === 'sub' ? 'sub' : k)}
              ${k !== 'sub' && c.targetDate !== date ? `<div class="muted small" style="margin-top:6px">คาบของฉันที่ต้องไปสอนคืน · ${thDate(c.targetDate)}</div>${strip(me, c.targetDate, c.tgt.map(e => e.p), k, 'take')}` : ''}</div>
              <button class="btn sm pri" data-x="send" data-k="${esc(g.key)}" ${canSend ? '' : 'disabled title="บันทึกใบลาก่อนจึงจะส่งคำขอได้"'}>${k === 'sub' ? 'ขอให้มาสอนแทน' : KINDS[k].send}</button></div>`; }).join('')}
        ${source && shown.length ? `<div class="row" style="flex-wrap:wrap"><div class="grow muted small">ติดต่อใครไม่ได้เลย หรือไม่มีใครรับ?</div><button class="btn sm" data-x="sendHead" ${canSend ? '' : 'disabled'}>แจ้งหัวหน้ากลุ่มสาระฯ จัดสอนแทน</button></div>` : ''}
      </div></div></div>
    ${requestsCard()}${myCoverAreas().length ? headQueueCard(myCoverAreas(), 'คาบรอจัดสอนแทน · กลุ่มสาระฯ ' + myCoverAreas().join(', ')) : ''}`;
};

/* ---------- บันทึกข้อความแลกคาบ (พิมพ์) ---------- */
function memoHtml(list, leave) {
  const s = S.settings || {}, first = list[0] || {}, requester = leave ? leave.by : first.requester;
  const dates = list.map(r => r.sourceDate).sort(), from = leave ? leave.from : dates[0], to = leave ? (leave.to || leave.from) : dates[dates.length - 1];
  const reason = leave ? leave.type : first.reason, official = reason === 'trip', personal = reason === 'personal';
  const d = x => { const t = parse(x); return t.getDate() + '/' + (t.getMonth() + 1) + '/' + (t.getFullYear() + 543); };
  const rows = list.map(r => `<tr><td>${d(r.sourceDate)}</td><td>${spanText(r.src)}</td><td class="lt">${esc(String(r.src[0].subject).split(' ')[0])}</td><td>${esc(cname(r.src[0].classId))}</td>
    <td class="lt">${esc(r.target || '')}<div class="sm">${esc(kindLabel(r))}</div></td><td>${r.tgt.length ? d(r.targetDate) : ''}</td><td>${r.tgt.length ? esc(cname(r.tgt[0].classId)) : ''}</td><td class="lt">${r.tgt.length ? esc(String(r.tgt[0].subject).split(' ')[0]) : ''}</td><td>${r.tgt.length ? spanText(r.tgt) : ''}</td><td></td></tr>`).join('') +
    Array.from({ length: Math.max(0, 5 - list.length) }, () => '<tr>' + '<td>&nbsp;</td>'.repeat(10) + '</tr>').join('');
  const tick = (on, t) => (on ? '☑' : '☐') + ' ' + t;
  const days = leave ? (() => { let n = 0, x = from; while (x <= to) { if (dayIdxOf(x) >= 0) n++; x = shift(x, 1); } return n; })() : new Set(dates).size;
  return `<style>.memo td,.memo th{border:1px solid #444;padding:3px 5px;font-size:13pt;text-align:center}.memo{border-collapse:collapse;width:100%;margin-top:8px}.memo .lt{text-align:left}.memo .sm{font-size:11pt;color:#444}.op{width:100%;border-collapse:collapse;margin-top:16px}.op td{border:1px solid #444;padding:8px;vertical-align:top;width:50%}</style>
    <h1>บันทึกข้อความ</h1>
    <p><b>ส่วนราชการ</b> กลุ่มสาระการเรียนรู้${esc(areaOf(requester) || '……………')} ${esc(s.schoolName || 'โรงเรียนปากช่อง')}</p>
    <p><b>ที่</b> ……………… <span style="margin-left:40px"><b>วันที่</b> ${thDate((leave ? leave.at : first.createdAt || '').slice(0, 10) || from)}</span></p>
    <p><b>เรื่อง</b> การสับเปลี่ยนคาบสอน / มอบหมายการสอนในระหว่างการลาหรือไปราชการ</p>
    <p><b>เรียน</b> ${esc(s.memoTo || 'รองผู้อำนวยการโรงเรียน กลุ่มบริหารวิชาการ')}</p>
    <p style="text-indent:48px">ด้วยข้าพเจ้า ${esc(requester)} ตำแหน่ง ครู ขออนุญาตมอบหมายการสอน / แลกคาบสอน รวมเป็นเวลา ${days} วัน รวม ${totalSlots(list)} คาบ</p>
    <p>เนื่องจาก ${tick(official, 'ไปปฏิบัติราชการ')} &nbsp; ${tick(personal, 'ลากิจส่วนตัว')} &nbsp; ${tick(!official && !personal && reason !== 'swap', 'ลาประเภทอื่น')} &nbsp; ${tick(reason === 'swap', 'แลกคาบปกติ')}</p>
    <p>ตั้งแต่วันที่ ${thDate(from)} ถึงวันที่ ${thDate(to)} ${leave && leave.reason ? '· ' + esc(leave.reason) : first.note ? '· ' + esc(first.note) : ''} รายละเอียดดังนี้</p>
    <table class="memo"><thead><tr><th rowspan="2">ว/ด/ป</th><th rowspan="2">คาบที่</th><th rowspan="2">รายวิชา</th><th rowspan="2">ชั้น/ห้อง</th><th>ครูผู้สอนแทน</th><th colspan="4">การแลกคาบ/สอนแทน</th><th rowspan="2">ลงชื่อ<br>รับทราบ</th></tr>
      <tr><th>ชื่อ-สกุล</th><th>ว/ด/ป</th><th>ห้องชั้น</th><th>รายวิชา</th><th>คาบที่</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="text-indent:48px;margin-top:10px">จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุญาต</p>
    <p style="text-align:center;margin-top:18px">ลงชื่อ ........................................<br>( ${esc(requester)} )</p>
    <table class="op"><tr><td><b>ความเห็นหัวหน้ากลุ่มสาระการเรียนรู้</b><br>........................................................<br>........................................................<br><br>ลงชื่อ ......................................</td>
      <td><b>ความเห็นรองผู้อำนวยการ</b><br>........................................................<br>........................................................<br><br>ลงชื่อ ......................................<br>${esc(s.deputyName || '')}</td></tr></table>`;
}
function printDoc(title, body) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const font = window.EMSType ? EMSType.printStack() : '"TH Sarabun New","Sarabun",sans-serif';
  const d = f.contentWindow.document; d.open();
  d.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:16mm}body{font-family:${font};font-size:15pt;line-height:1.6;color:#000}h1{text-align:center;font-size:22pt;margin:0 0 8px}p{margin:4px 0}${window.EMSPrintCss ? EMSPrintCss() : ''}</style></head><body>${body}</body></html>`);
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
}
function memoPreview(list, leave) {
  if (!list.length) return toast('ยังไม่มีคำขอให้พิมพ์');
  modal(`<h2 style="margin-bottom:8px">บันทึกข้อความแลกคาบ · ${totalSlots(list)} คาบ</h2>
    <div style="max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:14px;background:#fff;color:#000;font-size:.88rem">${memoHtml(list, leave)}</div>
    <button class="btn pri" style="width:100%;margin-top:12px" data-x="memoPrint">${ic('print')}พิมพ์เอกสาร</button>`);
  wideSheet(); memoPreview.last = [list, leave];
}
const wideSheet = () => { const s = $('#layer .sheet'); if (s) s.style.maxWidth = '860px'; };

/* ---------- ลา → ส่งหาครูดูแลทุกคาบ ---------- */
function saveLeave() {
  const f = $('#xl-f').value, t = $('#xl-t').value || f, type = $('#xl-r').value, note = $('#xl-n').value.trim();
  if (!f || t < f) return toast('กรุณากำหนดช่วงวันที่ลาให้ถูกต้อง');
  const cover = SELF.indexOf(type) >= 0 ? 'self' : ($('#xl-c').value === 'head' ? 'head' : 'self');
  const l = { id: uid('lv'), by: S.me.name, type, from: f, to: t, reason: note, cover: cover === 'head' ? 'head' : 'swap', head: cover === 'head' ? 'waiting' : 'none', status: 'submitted', at: new Date().toISOString() };
  (S.leaves = S.leaves || []).unshift(l);
  let affected = 0, d = f, guard = 0;
  while (d <= t && guard++ < 370) {
    if (dayIdxOf(d) >= 0 && !isHoliday(d)) {
      const done = new Set();
      regularOn(S.me.name, d).forEach(e => { if (done.has(e.id)) return; const blk = blockOf(e); blk.forEach(x => done.add(x.id));
        const c = cover === 'head' ? null : (candidates(e, d)[0] || null);
        const r = createReq(blk, d, c, type, note, l.id); if (cover === 'head') r.tier = 'รอหัวหน้ากลุ่มสาระจัดครู' + (blk.length > 1 ? ' · คาบคู่ ' + blk.length + ' คาบ' : '');
        affected += blk.length; });
    }
    d = shift(d, 1);
  }
  syncLeaveCoverage(l.id); save();
  toast(cover === 'head' ? 'บันทึกการลาแล้ว · ส่งให้หัวหน้ากลุ่มสาระจัดครู ' + affected + ' คาบ' : 'บันทึกการลาแล้ว · ส่งเข้าระบบจัดคาบ ' + affected + ' คาบ' + (SELF.indexOf(type) >= 0 ? ' (ประเภทนี้ต้องแลกคาบเอง)' : ''));
  S.xui.date = f; S.xui.openLeave = l.id; redraw();
}

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click', e => {
  const cap = e.target.closest('[data-m2="leaveNew"]');
  if (cap) { e.stopImmediatePropagation(); const f = document.getElementById('xl-f'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus(); } }
}, true);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-x]'); if (!t || t.tagName === 'INPUT') return;
  const a = t.dataset.x, d = t.dataset, X = S.xui;
  const req = id => S.xreqs.find(r => r.id === id);
  switch (a) {
    case 'mode': X.mode = d.k; save(); return redraw();
    case 'kind': X.kind = d.k; save(); return redraw();
    case 'pick': (X.picks = X.picks || {})[d.k] = +d.i; save(); return redraw();
    case 'send': case 'sendNone': {
      const date = X.date, src = regularOn(S.me.name, date).find(x => x.id === X.src); if (!src) return;
      const lv = X.mode === 'leave' ? activeLeave(date) : null;
      if (X.mode === 'leave' && !lv) return toast('บันทึกใบลาที่คลุมวันที่นี้ก่อน แล้วจึงส่งคำขอแลกคาบ');
      let c = null;
      if (a === 'send') { const all = candidates(src, date), k = d.k.split(':')[0], who = d.k.slice(k.length + 1);
        const opts = all.filter(x => kindOf(x) === k && x.teacher === who); c = opts[num((X.picks || {})[d.k])] || opts[0]; if (!c) return; }
      const blk = blockOf(src);
      /* คาบที่ค้างจากใบลา (ยังไม่พบครู/ถูกปฏิเสธ) → ใช้คำขอเดิม ไม่สร้างซ้อน */
      const old = S.xreqs.find(r => r.requester === S.me.name && r.sourceDate === date && r.src.some(s => s.id === src.id) && (r.status === 'unassigned' || r.status === 'rejected'));
      if (old && c) Object.assign(old, { type: c.mode, swapKind: c.swapKind, targetDate: c.targetDate, tgt: c.tgt.map(snap), target: c.teacher, tier: c.tier, status: 'pending', note: X.note || old.note });
      else createReq(blk, date, c, lv ? lv.type : 'swap', X.note || '', lv ? lv.id : '');
      if (lv) syncLeaveCoverage(lv.id);
      MV = null; save(); toast(c ? 'ส่งคำขอถึง ' + c.teacher + ' แล้ว' : 'บันทึกเป็นคาบรอจัดครูแล้ว'); return redraw(); }
    case 'accept': case 'reject': { const r = req(d.id); if (!r || r.status !== 'pending') return;
      if (a === 'accept') { const clash = r.type === 'exchange' ? !freeFor(r.requester, r.targetDate, r.tgt, r.src.map(x => x.id)) || !freeFor(r.target, r.sourceDate, r.src, r.tgt.map(x => x.id)) : !freeFor(r.target, r.sourceDate, r.src);
        if (clash) return toast('ตารางเปลี่ยนไปแล้ว มีคาบชนกัน — ตอบรับไม่ได้'); }
      r.status = a === 'accept' ? 'accepted' : 'rejected'; r.respondedAt = new Date().toISOString(); MV = null;
      if (r.leaveId) syncLeaveCoverage(r.leaveId); save();
      toast(a === 'accept' ? (r.type === 'exchange' ? 'ยอมรับคำขอและปรับตารางแล้ว' : 'รับสอนแทนและเพิ่มคาบแล้ว') : 'ปฏิเสธคำขอแล้ว'); return redraw(); }
    case 'findFor': { const r = req(d.id); if (!r) return; X.date = r.sourceDate; X.src = r.src[0].id; X.mode = r.leaveId ? 'leave' : 'swap'; save(); redraw(); scrollTo(0, 0); return; }
    case 'delAcc': { const r = req(d.id); if (!r) return;
      return modal(`<h2 style="margin-bottom:8px">ลบคำขอที่ตอบรับแล้ว</h2><p><b>${esc(kindLabel(r))} · ${esc(r.target || '')}</b><br><span class="small">${esc(blockText(r.src, r.sourceDate))}</span></p>
        <div class="notice">คาบที่แลก/สอนแทนจะกลับเป็นตารางเดิมของทั้งสองคน — แจ้ง ${esc(r.target || 'ครูที่รับ')} ด้วย · การเช็กชื่อที่บันทึกไปแล้วยังอยู่</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" data-act="close">ไม่ลบ</button><button class="btn pri" style="background:var(--bad);border-color:var(--bad)" data-x="del" data-id="${r.id}">ลบคำขอ</button></div>`, true); }
    case 'del': { closeModal(); const r = req(d.id); if (!r) return; S.xreqs = S.xreqs.filter(x => x.id !== r.id); MV = null; if (r.leaveId) syncLeaveCoverage(r.leaveId); save(); toast('ลบคำขอแล้ว'); return redraw(); }
    case 'memo': { const r = req(d.id); if (r) memoPreview([r], leaveOf(r.leaveId)); return; }
    case 'memoLeave': { const l = leaveOf(d.id); memoPreview(S.xreqs.filter(r => r.leaveId === d.id), l); return; }
    case 'memoDone': return memoPreview(S.xreqs.filter(r => r.status === 'accepted' && (r.requester === S.me.name || r.target === S.me.name)));
    case 'memoPicked': { const ids = [...document.querySelectorAll('.x-sel')].filter(x => x.checked).map(x => x.value); if (!ids.length) return toast('ติ๊กเลือกคำขอที่จะพิมพ์รวมก่อน'); return memoPreview(S.xreqs.filter(r => ids.indexOf(r.id) >= 0)); }
    case 'pickAll': { const box = [...document.querySelectorAll('.x-sel')], on = !box.every(x => x.checked); box.forEach(x => { x.checked = on; }); return; }
    case 'memoPrint': { const [l, lv] = memoPreview.last || [[]]; closeModal(); return printDoc('บันทึกข้อความแลกคาบ', memoHtml(l, lv)); }
    case 'leaveSave': return saveLeave();
    case 'sendHead': {                                   // แลกคาบไม่ได้ → ส่งให้หัวหน้ากลุ่มสาระฯ จัดสอนแทน
      const date = X.date, src = regularOn(S.me.name, date).find(x => x.id === X.src); if (!src) return;
      const lv = X.mode === 'leave' ? activeLeave(date) : null;
      if (X.mode === 'leave' && !lv) return toast('แจ้งการลาที่หน้า “ใบลา” ก่อน');
      const old = S.xreqs.find(r => r.requester === S.me.name && r.sourceDate === date && r.src.some(s => s.id === src.id) && r.status !== 'accepted');
      const r = old || createReq(blockOf(src), date, null, lv ? lv.type : 'swap', X.note || '', lv ? lv.id : '');
      Object.assign(r, { type: 'substitute', swapKind: '', target: '', tgt: [], targetDate: r.sourceDate, status: 'unassigned', toHead: true, tier: HEADTXT + ' · ' + (areaOf(S.me.name) || '') });
      if (r.leaveId) syncLeaveCoverage(r.leaveId); MV = null; save(); toast('แจ้งหัวหน้ากลุ่มสาระฯ ให้จัดครูสอนแทนแล้ว'); return redraw(); }
    case 'vacWeek': { const mon = (() => { let x = shift(vacBase(), +d.w || 0); for (let i = 0; i < 7 && dayIdxOf(x) !== 0; i++) x = shift(x, -1); return x; })(), n = vacantWeek(mon);
      save(); toast(n ? 'สร้างคาบรอครู ' + n + ' คาบ เข้าคิวหัวหน้ากลุ่มสาระฯ แล้ว' : 'ไม่มีคาบรอครูใหม่ในสัปดาห์นั้น (สร้างไว้แล้ว หรือเป็นวันหยุด/วันที่ผ่านแล้ว)'); return redraw(); }
    case 'toHead': { const r = req(d.id); if (!r) return;
      Object.assign(r, { type: 'substitute', swapKind: '', target: '', tgt: [], targetDate: r.sourceDate, status: 'unassigned', toHead: true, tier: HEADTXT + ' · ' + (areaOf(r.requester) || '') });
      if (r.leaveId) syncLeaveCoverage(r.leaveId); MV = null; save(); toast('แจ้งหัวหน้ากลุ่มสาระฯ ให้จัดครูสอนแทนแล้ว'); return redraw(); }
    case 'leaveToHead': { const list = S.xreqs.filter(r => r.leaveId === d.id && (r.status === 'unassigned' || r.status === 'rejected') && !headQueued(r));
      list.forEach(r => Object.assign(r, { type: 'substitute', swapKind: '', target: '', tgt: [], targetDate: r.sourceDate, status: 'unassigned', toHead: true, tier: HEADTXT + ' · ' + (areaOf(r.requester) || '') }));
      syncLeaveCoverage(d.id); MV = null; save(); toast('แจ้งหัวหน้ากลุ่มสาระฯ จัดสอนแทน ' + totalSlots(list) + ' คาบแล้ว'); return redraw(); }
    case 'goSwap': X.date = d.d; X.src = d.s || ''; X.mode = 'leave'; save(); return go('swap');
    case 'leaveOpen': X.openLeave = X.openLeave === d.id ? '' : d.id; save(); return redraw();
    case 'leaveCancel': { const l = leaveOf(d.id); if (!l) return; const acc = S.xreqs.filter(r => r.leaveId === l.id && r.status === 'accepted').length;
      const del = l.status === 'approved' || l.status === 'rejected';      // อนุมัติ/ไม่อนุมัติแล้ว = ลบ · ยังไม่อนุมัติ = ยกเลิก
      return modal(`<h2 style="margin-bottom:8px">${del ? 'ลบใบลา' : 'ยกเลิกใบลา'}</h2><p>${del ? 'ลบ' : 'ยกเลิก'} <b>${esc(LT[l.type] || 'ใบลา')} · ${thDate(l.from)}${l.to && l.to !== l.from ? ' – ' + thDate(l.to) : ''}</b> และคำขอแลกคาบ/สอนแทนที่ยังไม่มีคนรับ?</p>
        ${l.status === 'approved' ? '<div class="notice">ใบลานี้อนุมัติแล้ว — ลบแล้วจะหายจากสรุปการลาและเวลาทำงานด้วย</div>' : ''}
        ${acc ? `<label class="row small" style="border:0;gap:8px;align-items:flex-start"><input type="checkbox" id="lv-acc" style="width:18px;height:18px"><span>ลบคำขอที่ครูตอบรับแล้ว ${acc} รายการด้วย (คาบกลับเป็นตารางเดิม — แจ้งครูท่านนั้นด้วย) · ไม่ติ๊ก = เก็บไว้</span></label>` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" data-act="close">${del ? 'ไม่ลบ' : 'ไม่ยกเลิก'}</button><button class="btn pri" style="background:var(--bad);border-color:var(--bad)" data-x="leaveCancelOk" data-id="${l.id}">${del ? 'ลบใบลา' : 'ยกเลิกใบลา'}</button></div>`, true); }
    case 'leaveCancelOk': { const allAcc = !!($('#lv-acc') || {}).checked; S.leaves = S.leaves.filter(l => l.id !== d.id); S.xreqs = S.xreqs.filter(r => r.leaveId !== d.id || (r.status === 'accepted' && !allAcc)); } MV = null; save(); closeModal(); toast('ยกเลิกใบลาแล้ว'); return redraw();
    case 'assign': { const r = req(d.id); if (!r) return; Object.assign(r, { type: 'substitute', swapKind: '', target: d.t, tgt: [], targetDate: r.sourceDate, status: 'pending', tier: (canCover(S.me.name, areaOf(r.requester)) && headsOf(areaOf(r.requester)).indexOf(S.me.name) < 0 ? 'ผู้จัดสอนแทนกลุ่มสาระฯ มอบหมาย · ' : 'หัวหน้ากลุ่มสาระฯ มอบหมาย · ') + (d.l || '') });
      r.assignedBy = S.me.name; MV = null; if (r.leaveId) syncLeaveCoverage(r.leaveId); save(); toast('มอบหมายให้ ' + d.t + ' แล้ว — รอครูตอบรับ'); return redraw(); }
  }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-xf]'); if (!t) return;
  const X = S.xui;
  if (t.dataset.xf === 'date') { X.date = t.value || today(); X.src = ''; if (dayIdxOf(X.date) < 0) toast('วันที่เลือกเป็นวันหยุดสุดสัปดาห์'); save(); return redraw(); }
  if (t.dataset.xf === 'src') { X.src = t.value; save(); return redraw(); }
  if (t.dataset.xf === 'note') { X.note = t.value; return save(); }
  if (t.dataset.xf === 'delegate') { const area = t.dataset.area, prev = S.coverDelegates[area];
    if (t.value && isVacantU(staffOf(t.value))) { toast('ตำแหน่งว่างยังไม่มีตัวคน มอบหมายให้จัดสอนแทนไม่ได้'); return redraw(); }
    if (t.value) S.coverDelegates[area] = t.value; else delete S.coverDelegates[area];
    const setRole = (n, on) => { const u = S.staff.find(x => x.name === n); if (!u) return; u.roles = (u.roles || [u.role]).filter(r => r !== 'coverer'); if (on) u.roles.push('coverer'); };
    if (prev && !Object.values(S.coverDelegates).includes(prev)) setRole(prev, false); if (t.value) setRole(t.value, true);
    save(); toast(t.value ? 'มอบหมาย ' + t.value + ' ทำหน้าที่จัดสอนแทนกลุ่มสาระฯ ' + area : 'ยกเลิกผู้จัดสอนแทนแล้ว'); return redraw(); }
  if (t.dataset.xf === 'lreason') { X.lreason = t.value; X.lcover = ($('#xl-c') || {}).value; save(); return redraw(); }
});

/* ---------- ตำแหน่งว่าง (รอครู) → คิวหัวหน้ากลุ่มสาระฯ จัดครูสอนแทนรายวัน ----------
   แอปจัดตารางวางคาบไว้ให้ตำแหน่งว่าง (บุคลากรบทบาท vacant) — ถึงวันจริงยังไม่มีครู จึงสร้างคำขอสอนแทนรายวันเข้าคิวหัวหน้า
   ทีละสัปดาห์ (ไม่สร้างล่วงหน้าทั้งภาค ผู้จัดจะได้ไม่ผูกครูสอนแทนยาว ๆ) ข้ามวันหยุด ไม่สร้างซ้ำ */
const vacantStaff = () => S.staff.filter(u => (u.roles || [u.role]).indexOf('vacant') >= 0);
/* เสาร์/อาทิตย์: สัปดาห์นี้จบแล้ว → "สัปดาห์นี้" = สัปดาห์ที่กำลังจะถึง */
const vacBase = () => { const t = today(), w = parse(t).getDay(); return w === 6 ? shift(t, 2) : w === 0 ? shift(t, 1) : t; };
function vacantWeek(from) {
  let n = 0, d = from;
  for (let i = 0; i < 7; i++, d = shift(d, 1)) {
    if (d < today() || dayIdxOf(d) < 0 || isHoliday(d)) continue;
    vacantStaff().forEach(u => { const done = new Set();
      regularOn(u.name, d).forEach(e => { if (done.has(e.id)) return; const blk = blockOf(e); blk.forEach(x => done.add(x.id));
        if (S.xreqs.some(r => r.vacant && r.requester === u.name && r.sourceDate === d && r.src.some(x => x.id === e.id || (x.p === e.p && x.classId === e.classId)))) return;   // นำเข้าตารางใหม่ id คาบเปลี่ยน — เทียบวัน/คาบ/ห้องด้วย
        const r = createReq(blk, d, null, 'vacant', 'ตำแหน่งว่าง รอครูตัวจริง' + (u.note ? ' (' + u.note + ')' : ''));
        Object.assign(r, { vacant: true, toHead: true, tier: HEADTXT + ' · ตำแหน่งว่าง' }); n += blk.length; }); });
  }
  return n;
}
const vacantBtns = () => vacantStaff().length ? `<div class="row" style="border:0;padding:0 0 6px;gap:6px;flex-wrap:wrap"><span class="muted small grow">ตำแหน่งว่าง ${vacantStaff().length} ตำแหน่ง (${vacantStaff().map(u => esc(u.name)).join(', ')}) — สร้างคาบรอครูเป็นคำขอสอนแทนให้หัวหน้าจัด</span>
    <button class="btn sm" data-x="vacWeek" data-w="0">${vacBase() !== today() ? 'สัปดาห์ที่จะถึง' : 'สัปดาห์นี้'}</button><button class="btn sm" data-x="vacWeek" data-w="7">${vacBase() !== today() ? 'สัปดาห์ถัดไป' : 'สัปดาห์หน้า'}</button></div>` : '';

/* ---------- หัวหน้ากลุ่มสาระฯ / ผู้จัดสอนแทนกลุ่มสาระฯ: คาบรอจัดครู ---------- */
function headQueueCard(areas, title) {
  const all = S.xreqs.filter(headQueued).sort((a, b) => (a.sourceDate + a.src[0].p).localeCompare(b.sourceDate + b.src[0].p));
  const groups = (areas || [...new Set(all.map(r => areaOf(r.requester)))]).sort((a, b) => a.localeCompare(b, 'th'));
  const q = all.filter(r => groups.indexOf(areaOf(r.requester)) >= 0);
  return `<div class="card"><div class="row" style="border:0;padding-top:0"><h2 style="margin:0">${title || 'คาบรอหัวหน้ากลุ่มสาระฯ จัดครูสอนแทน'}</h2><span class="grow"></span>${chip(totalSlots(q) + ' คาบ', q.length ? 'warn' : 'ok')}</div>
    <p class="muted small" style="margin:4px 0 10px">มาจากใบลาที่เลือกให้หัวหน้าจัดครู หรือครูกด “แจ้งหัวหน้ากลุ่มสาระฯ” เมื่อแลกคาบไม่ได้ · หัวหน้ามอบหมายผู้ทำหน้าที่ <b>จัดสอนแทนกลุ่มสาระฯ</b> แทนตัวเองได้ · เรียงครูที่เหมาะสม: กลุ่มสาระเดียวกันและสอนระดับชั้นเดียวกันก่อน แล้วรับงานน้อยก่อน</p>
    ${groups.length ? groups.map(area => { const heads = headsOf(area), dg = coverDelegateOf(area), list = q.filter(r => areaOf(r.requester) === area), isHead = heads.indexOf(S.me.name) >= 0 || !areas;
      const members = S.staff.filter(u => areaOf(u.name) === area && heads.indexOf(u.name) < 0 && !isVacantU(u));
      return `<div style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:10px"><div class="row" style="border:0;padding:0 0 6px;flex-wrap:wrap"><div class="grow"><b>กลุ่มสาระฯ ${esc(area)}</b>
          <div class="muted small">หัวหน้า: ${heads.length ? heads.map(esc).join(', ') : 'ยังไม่กำหนด'}${dg ? ' · จัดสอนแทนกลุ่มสาระฯ: <b>' + esc(dg) + '</b>' : ''}</div></div>
          ${isHead ? `<label class="small" style="display:flex;gap:6px;align-items:center">ผู้จัดสอนแทนกลุ่มสาระฯ <select class="in" style="width:auto;min-height:36px" data-xf="delegate" data-area="${esc(area)}" aria-label="ผู้จัดสอนแทนกลุ่มสาระ ${esc(area)}"><option value="">— หัวหน้าจัดเอง —</option>${members.map(u => `<option ${u.name === dg ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>` : ''}${chip(totalSlots(list) + ' คาบ', list.length ? 'warn' : 'ok')}</div>
        ${list.length ? list.map(r => { const cs = headCandidates(r).slice(0, 6), lv = leaveOf(r.leaveId);
          return `<div class="x-req" style="grid-template-columns:minmax(0,1fr)"><div><b>${esc(r.requester)}</b> · ${esc(blockText(r.src, r.sourceDate))} ${slotCount(r) > 1 ? chip('คาบคู่ ' + slotCount(r), 'info') : ''} ${r.status === 'rejected' ? chip('ครูที่มอบหมายปฏิเสธ', 'bad') : ''}
            <div class="muted small">${lv ? esc(LT[lv.type] || 'ลา') : 'แลกคาบไม่ได้'}${r.note ? ' · ' + esc(r.note) : ''}</div>
            <div class="x-chips" style="margin-top:6px">${cs.length ? cs.map(c => `<button class="x-pick" data-x="assign" data-id="${r.id}" data-t="${esc(c.teacher)}" data-l="${esc(c.label)}" title="${esc(c.label)}">${esc(c.teacher)} <span class="muted">· ${esc(c.label.split(' · ')[0])}${c.load ? ' · รับแล้ว ' + c.load : ''}</span></button>`).join('') : '<span class="muted small">ไม่มีครูว่างตรงคาบนี้</span>'}</div></div></div>`; }).join('')
          : '<div class="muted small">ไม่มีคาบรอจัด</div>'}</div>`; }).join('') : '<div class="empty">ไม่มีคาบรอจัดครู</div>'}</div>`;
}
/* ---------- หัวหน้ากลุ่มสาระ: คาบรอจัดครู (ในหน้าการลาและการอนุมัติ) ---------- */
const baseLeaves = P['a-leaves'];
P['a-leaves'] = () => {
  const rank = {}; S.xreqs.filter(r => r.status === 'accepted' && r.target).forEach(r => { const x = rank[r.target] = rank[r.target] || { sub: 0, ex: 0 }; if (r.type === 'exchange') x.ex += slotCount(r); else x.sub += slotCount(r); });
  const top = Object.entries(rank).map(([n, x]) => ({ n, ...x, t: x.sub + x.ex })).sort((a, b) => b.t - a.t);
  return baseLeaves() + headQueueCard() + `
    <div class="card"><h2>ครูที่รับสอนแทนและแลกคาบมากที่สุด</h2>${top.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>อันดับ</th><th>ครู</th><th>สอนแทน</th><th>แลกคาบ</th><th>รวม</th></tr></thead><tbody>${top.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.n)}</b></td><td>${x.sub}</td><td>${x.ex}</td><td><b>${x.t}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีการรับสอนแทนหรือแลกคาบ</div>'}</div>`;
};

/* ---------- หน้าใบลา: แจ้งลา/ไปราชการ + ติดตามการจัดคาบ ---------- */
const LSTX = { draft: ['ยังไม่ส่ง', ''], submitted: ['รอผู้บริหารอนุมัติ', 'warn'], approved: ['อนุมัติแล้ว', 'ok'], rejected: ['ไม่อนุมัติ', 'bad'] };
const wd = l => { let n = 0, x = l.from; const e = l.to || l.from; for (let g = 0; x <= e && g < 400; g++, x = shift(x, 1)) if (dayIdxOf(x) >= 0) n++; return n; };
function leaveFormCard() {
  const X = S.xui, d0 = X.lfrom || nextSchoolDay(today()), self = SELF.indexOf(X.lreason || 'sick') >= 0;
  return `<div class="card"><h2>แจ้งการลา / ขออนุญาตไปราชการ</h2>
    <p class="muted small" style="margin-bottom:10px">เลือกช่วงวันที่แล้วกดบันทึก ระบบจะหาครูดูแลให้ทุกคาบในช่วงนั้นโดยอัตโนมัติ · “ไปราชการ” ไม่นับเป็นวันลา</p>
    <div class="grid g2"><div class="field"><label class="f" for="xl-f">ตั้งแต่วันที่</label><input id="xl-f" class="in" type="date" value="${d0}"></div><div class="field"><label class="f" for="xl-t">ถึงวันที่</label><input id="xl-t" class="in" type="date" value="${d0}"></div></div>
    <div class="field"><label class="f" for="xl-r">ประเภทการลา</label><select id="xl-r" class="in" data-xf="lreason">${Object.entries(LT).map(([k, v]) => `<option value="${k}" ${X.lreason === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label class="f" for="xl-c">ใครหาครูดูแลคาบให้</label><select id="xl-c" class="in" ${self ? 'disabled' : ''}><option value="self">แลกคาบ/หาครูสอนแทนเอง</option><option value="head" ${X.lcover === 'head' && !self ? 'selected' : ''}>ให้หัวหน้ากลุ่มสาระฯ จัดครูสอนแทน</option></select></div>
    <div class="x-note ${self ? 'locked' : ''}">${self ? `<b>${esc(LT[X.lreason])}ต้องแลกคาบเอง</b> ระบบเสนอครูที่เหมาะสมให้ทุกคาบ — ถ้าแลกไม่ได้ กด “แจ้งหัวหน้ากลุ่มสาระฯ จัดสอนแทน” ที่ใบลาด้านล่าง` : '<b>ลาประเภทนี้เลือกได้</b> แลกเอง หรือให้หัวหน้ากลุ่มสาระฯ (หรือผู้ที่หัวหน้ามอบหมาย) จัดครูให้'}</div>
    <div class="field" style="margin-top:10px"><label class="f" for="xl-n">รายละเอียด</label><input id="xl-n" class="in" placeholder="เช่น ป่วยเป็นไข้ ต้องพบแพทย์"></div>
    <button class="btn pri" style="width:100%" data-x="leaveSave">บันทึกการลาและส่งหาครูดูแลทุกคาบ</button></div>`;
}
function myLeaveRow(l) {
  const reqs = S.xreqs.filter(r => r.leaveId === l.id).sort((a, b) => (a.sourceDate + a.src[0].p).localeCompare(b.sourceDate + b.src[0].p));
  const n = totalSlots(reqs), ok = totalSlots(reqs.filter(r => r.status === 'accepted')), hq = reqs.filter(headQueued), stuck = reqs.filter(r => (r.status === 'unassigned' || r.status === 'rejected') && !headQueued(r));
  const [st, sk] = LSTX[l.status] || LSTX.draft, open = S.xui.openLeave === l.id;
  const rs = r => r.status === 'accepted' ? chip(kindLabel(r) + ' · ' + r.target, 'ok') : r.status === 'pending' ? chip('รอ ' + r.target + ' ตอบรับ', 'warn') : headQueued(r) ? chip('รอหัวหน้ากลุ่มสาระฯ จัด', 'info') : chip(r.status === 'rejected' ? 'ถูกปฏิเสธ' : 'ยังไม่มีคนดูแล', 'bad');
  return `<div class="row" style="flex-wrap:wrap;align-items:flex-start"><div class="ico ${l.type === 'trip' ? 'ok' : 'info'}">${ic('form')}</div>
    <div class="grow" style="min-width:220px"><div class="t">${esc(LT[l.type] || 'ลา')} · ${thDate(l.from)}${l.to && l.to !== l.from ? ' – ' + thDate(l.to) : ''}${l.type === 'trip' ? '' : ' · ' + wd(l) + ' วัน'}</div>
      <div class="muted small">${l.reason ? esc(l.reason) + ' · ' : ''}${l.cover === 'head' ? 'ให้หัวหน้ากลุ่มสาระฯ จัดครู' : 'แลกคาบ/หาครูเอง'}</div>
      ${n ? `<div class="x-prog" style="max-width:320px"><i style="width:${Math.round(ok * 100 / n)}%"></i></div><div class="small">จัดคาบแล้ว <b>${ok}/${n}</b> คาบ${hq.length ? ' · รอหัวหน้าจัด ' + totalSlots(hq) : ''}${stuck.length ? ` · <b style="color:var(--bad)">ยังไม่มีคนดูแล ${totalSlots(stuck)}</b>` : ''}</div>` : '<div class="muted small">ไม่มีคาบสอนที่ต้องจัด</div>'}
      ${open && reqs.length ? `<div class="list" style="margin-top:6px">${reqs.map(r => `<div class="row" style="padding:6px 0;flex-wrap:wrap"><div class="grow small">${esc(blockText(r.src, r.sourceDate))}</div>${rs(r)}
        ${(r.status === 'unassigned' || r.status === 'rejected') && !headQueued(r) ? `<button class="btn sm" data-x="goSwap" data-d="${r.sourceDate}" data-s="${r.src[0].id}">หาครู</button>` : ''}</div>`).join('')}</div>` : ''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${chip(st, sk)}
      ${reqs.length ? `<button class="btn sm" data-x="leaveOpen" data-id="${l.id}">${open ? 'ซ่อนรายคาบ' : 'ดูรายคาบ'}</button>` : ''}
      ${stuck.length ? `<button class="btn sm pri" data-x="goSwap" data-d="${stuck[0].sourceDate}" data-s="${stuck[0].src[0].id}">หาครูแลกคาบ</button><button class="btn sm" data-x="leaveToHead" data-id="${l.id}">แจ้งหัวหน้ากลุ่มสาระฯ จัดสอนแทน</button>` : ''}
      <button class="btn sm" data-m2="leaveDoc" data-id="${l.id}">ใบลา</button>${n ? `<button class="btn sm" data-x="memoLeave" data-id="${l.id}">บันทึกแลกคาบ</button>` : ''}
      ${l.by === S.me.name ? `<button class="btn sm ghost" style="color:var(--bad)" data-x="leaveCancel" data-id="${l.id}">${l.status === 'submitted' || l.status === 'draft' ? 'ยกเลิก' : 'ลบ'}</button>` : ''}</div></div>`;
}
P.leaves = () => {
  const mine = (S.leaves || []).filter(l => l.by === S.me.name).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const used = t => mine.filter(l => l.type === t && l.status !== 'rejected').reduce((a, l) => a + wd(l), 0);
  const stuck = S.xreqs.filter(r => r.requester === S.me.name && r.leaveId && (r.status === 'unassigned' || r.status === 'rejected') && !headQueued(r));
  const k = (l, v, c) => `<div class="card kpi"><div class="l">${l}</div><div class="v" ${c ? `style="color:${c}"` : ''}>${v}</div></div>`;
  return `<div class="top"><div><h1>ใบลา / ไปราชการ</h1><p>แจ้งลาครั้งเดียว ระบบจัดคาบที่ต้องสอนให้ต่อในศูนย์แลกคาบ · ติดตามอนุมัติ และพิมพ์ใบลาได้</p></div><button class="btn" data-act="go" data-p="swap">${ic('swap')}ศูนย์แลกคาบ</button></div>
    <div class="grid g4" style="margin-bottom:16px">${k('ลาป่วย (วัน)', used('sick'))}${k('ลากิจ (วัน)', used('personal'))}${k('รออนุมัติ', mine.filter(l => l.status === 'submitted').length, 'var(--warn)')}${k('คาบยังไม่มีคนดูแล', totalSlots(stuck), stuck.length ? 'var(--bad)' : 'var(--ok)')}</div>
    <div class="x-layout"><div>${leaveFormCard()}</div>
      <div><div class="card"><h2>ใบลาของฉัน</h2>${mine.length ? `<div class="list">${mine.map(myLeaveRow).join('')}</div>` : '<div class="empty">ยังไม่เคยแจ้งลา</div>'}</div></div></div>`;
};

/* ---------- หน้าแรกครู: เตือนคาบที่ยังไม่มีคนดูแล + หน้าที่สอนแทนวันนี้ ---------- */
const baseHome = P.home;
P.home = () => {
  const mine = S.xreqs.filter(r => r.requester === S.me.name && (r.status === 'unassigned' || r.status === 'rejected') && !headQueued(r));
  const waitMe = S.xreqs.filter(r => r.target === S.me.name && r.status === 'pending');
  const duties = dutiesOn(S.me.name, today());
  const html = baseHome();
  const extra = (mine.length || waitMe.length || duties.length) ? `<div class="card" style="border-left:4px solid var(--warn)"><h2>แลกคาบ / สอนแทน</h2><div class="list">
      ${waitMe.length ? `<div class="row"><div class="grow"><div class="t">มีคำขอรอคุณตอบรับ ${waitMe.length} รายการ</div></div><button class="btn sm pri" data-act="go" data-p="swap">ดู</button></div>` : ''}
      ${mine.length ? `<div class="row"><div class="grow"><div class="t" style="color:var(--bad)">คาบของคุณที่ยังไม่มีคนดูแล ${totalSlots(mine)} คาบ</div><div class="muted small">หาครูแลกคาบ/สอนแทนเอง หรือแจ้งหัวหน้ากลุ่มสาระฯ จัดสอนแทน</div></div><button class="btn sm" data-act="go" data-p="leaves">จัดการ</button></div>` : ''}
      ${duties.map(x => `<div class="row"><div class="grow"><div class="t">วันนี้ ${x.kind} · คาบ ${x.p + 1} · ${esc(cname(x.classId))}</div><div class="muted small">${esc(x.subject)}</div></div></div>`).join('')}</div></div>` : '';
  return html.replace('<div class="grid split">', extra + '<div class="grid split">');
};

/* ---------- รออนุมัติ (ผู้ดูแลระบบ) — รวมทุกเรื่องที่ค้างพิจารณา ---------- */
P['a-approve'] = () => {
  const lv = (S.leaves || []).filter(l => l.status === 'submitted'), rp = (S.repairs || []).filter(r => r.stage && ['head', 'assistant', 'deputy'].indexOf(r.stage) >= 0 && r.status !== 'rejected' && r.status !== 'cancelled'),
    vn = (S.venues || []).filter(v => v.stage && ['head', 'assistant', 'deputy'].indexOf(v.stage) >= 0 && v.status === 'pending'),
    hq = S.xreqs.filter(r => headQueued(r));
  const row = (n, t, sub, p) => `<div class="row"><div class="ico gold">${ic('inbox')}</div><div class="grow"><div class="t">${t}</div><div class="muted small">${sub}</div></div>${chip(n, n ? 'warn' : 'ok')}<button class="btn sm" data-act="go" data-p="${p}">เปิด</button></div>`;
  return `<div class="top"><div><h1>รออนุมัติ</h1><p>รวมทุกเรื่องที่ค้างพิจารณา แตะ “เปิด” เพื่อไปจัดการที่หน้านั้น</p></div></div>
    <div class="card"><div class="list">
      ${row(lv.length, 'ใบลา', lv.filter(l => l.head === 'waiting').length + ' ใบรอหัวหน้ากลุ่มสาระ · ' + lv.filter(l => l.head !== 'waiting').length + ' ใบรอผู้บริหาร', 'a-leaves')}
      ${row(totalSlots(hq), 'คาบรอหัวหน้ากลุ่มสาระจัดครูสอนแทน', 'จากใบลาที่เลือกให้หัวหน้าจัดให้', 'a-leaves')}
      ${row(rp.length + vn.length, 'แจ้งซ่อม / ขอใช้สถานที่', rp.length + ' แจ้งซ่อม · ' + vn.length + ' ขอใช้สถานที่ ในสายอนุมัติ', 'a-general')}
    </div></div>`;
};
/* รายการที่ค้างพิจารณาทั้งหมด (ใช้ในภาพรวม สรุปผู้บริหาร และจุดแดงของเมนู) */
const inChain = r => r.stage && ['head', 'assistant', 'deputy'].indexOf(r.stage) >= 0;
window.EMSPendingItems = () => [].concat(
  (S.leaves || []).filter(l => l.status === 'submitted').map(l => ({ who: l.by, what: (LT[l.type] || 'ใบลา') + (l.head === 'waiting' ? ' · รอหัวหน้ากลุ่มสาระ' : ' · รอผู้บริหาร'), date: l.from, icon: 'form' })),
  S.xreqs.filter(r => headQueued(r)).map(r => ({ who: r.requester, what: 'รอหัวหน้าจัดครูสอนแทน · ' + blockText(r.src, r.sourceDate), date: r.sourceDate, icon: 'swap' })),
  (S.repairs || []).filter(r => inChain(r) && r.status !== 'rejected' && r.status !== 'cancelled').map(r => ({ who: r.owner, what: 'แจ้งซ่อม · ' + r.item + ' · ' + r.place, date: String(r.createdAt || '').slice(0, 10), icon: 'gear' })),
  (S.venues || []).filter(v => inChain(v) && v.status === 'pending').map(v => ({ who: v.owner, what: 'ขอใช้' + v.place + ' · ' + v.purpose, date: v.date, icon: 'grid' })));
/* จุดแดงที่เมนู "รออนุมัติ" นับจากของจริง */
const baseRender = window.render;
window.render = function () {
  S.pending = window.EMSPendingItems().map((o, i) => i);
  MV = null;
  return baseRender.apply(this, arguments);
};
window.EMSExchange = { candidates, busy, moves: () => moves(), regularOn, dayStatus, allEntries, entriesOn, cname, headQueued };
save(); render();
})();
