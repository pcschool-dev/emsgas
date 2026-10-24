/* EMS — เช็กชื่อประจำวันตามตารางสอน + กิจกรรมนักเรียน (ย้ายจาก KruSpace: renderAttendancePage, missedCardHtml,
   syncHomeroomConduct, renderActivities, activityImpact)
   - เช็กชื่อรายคาบตามตารางสอนของวันที่เลือก (ย้อนหลังได้) รวมคาบแลก/สอนแทนที่ตอบรับแล้ว และคาบพิเศษ (สอนแทน/ชดเชย)
   - คาบเข้าแถว/โฮมรูม ของครูที่ปรึกษา: บันทึกแล้วหักคะแนนมาสาย (แถวเช้า) ให้ฝ่ายกิจการนักเรียน และส่งสรุปแถวเช้ารายห้อง
   - วันหยุดไม่ต้องเช็ก (เปิดตารางได้ถ้ามีการเรียนจริง) · การ์ดคาบค้างเช็กชื่อ กรองตามเดือน/ห้อง/วิชา และจัดกลุ่มได้
   - กิจกรรมนักเรียน: เลือกนักเรียนด้วยเลขประจำตัว + คาบที่ไปทำกิจกรรม → ครูเจ้าของคาบเห็นสถานะ “กิจกรรม” ให้อัตโนมัติ
   คีย์การเช็กชื่อ: ห้อง|วันที่|คาบ (เลขคาบเริ่ม 0) และ ห้อง|วันที่|hr สำหรับแถวเช้า */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => new Date(s + 'T00:00:00');
const shift = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoOf(d); };
const dayIdxOf = s => { const w = parse(s).getDay(); return w >= 1 && w <= 5 ? w - 1 : -1; };
const holidayOf = s => (S.events || []).find(e => e.cat === 'holiday' && e.date === s) || null;
/* ภาคเรียนที่กำลังดู (รวมโหมดดูภาคเก่า S.viewTerm) และเช็กว่าวันที่อยู่ในช่วงเปิด–ปิดภาคเรียนหรือไม่ */
const curTerm = () => { const v = (S.viewTerm && S.viewTerm.year ? S.viewTerm : S.term) || {};
  return (S.terms || []).find(x => String(x.year) === String(v.year) && String(x.sem) === String(v.sem)) || {}; };
const inTerm = d => { const tm = curTerm(); return (!tm.open || d >= tm.open) && (!tm.close || d <= tm.close); };
const termOffWhy = d => { const tm = curTerm(); if (tm.open && d < tm.open) return 'ยังไม่ถึงวันเปิดภาคเรียน (' + thDate(tm.open) + ')';
  if (tm.close && d > tm.close) return 'ปิดภาคเรียนแล้ว (' + thDate(tm.close) + ')'; return ''; };
const examOf = s => (S.events || []).find(e => e.cat === 'exam' && e.date === s) || null;     // วันสอบ (ปฏิทินวิชาการ) → คาบเรียนตั้งต้น “มา” ทุกคน
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const sk = s => String(s.sid || s.id);
const X = () => window.EMSExchange;
const OTHER = { 'x-m21': 'ม.2/1', 'x-m32': 'ม.3/2' };
const cname = id => X() ? X().cname(id) : (cls(id) || {}).name || OTHER[id] || id;
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const ATT = [['p', 'มา', 'ok'], ['s', 'สาย', 'warn'], ['l', 'ลา', 'info'], ['c', 'กิจกรรม', 'act'], ['a', 'ขาด', 'bad']];

/* ---------- ข้อมูลตั้งต้น ---------- */
S.homeroom = S.homeroom || { 'm1-3': S.me.name };            // ห้องที่ครูเป็นครูที่ปรึกษา (classId → ชื่อครู)
S.specials = S.specials || [];                               // คาบพิเศษ { id, date, p, classId, subject, kind, teacher }
S.acts = S.acts || [];                                       // กิจกรรม { id, name, date, place, slots:[p], students:[{key,name,classId}], note, by, createdAt }
S.aui = Object.assign({ date: '', sess: '', showHoliday: '', missMonth: '', missClass: '', missSubject: '', missGroup: 'date', draft: null }, S.aui || {});

/* ---------- คาบของฉันในวันหนึ่ง ---------- */
function sessionsOn(date) {
  const me = S.me.name, out = [];
  Object.entries(S.homeroom).forEach(([cid, t]) => { if ([].concat(t || []).indexOf(me) >= 0 && dayIdxOf(date) >= 0) out.push({ key: cid + '|' + date + '|hr', p: -1, classId: cid, subject: 'เข้าแถว / โฮมรูม', kind: 'hr', label: 'เข้าแถว' }); });
  if (X()) {
    X().regularOn(me, date).forEach(e => out.push({ key: e.classId + '|' + date + '|' + e.p, p: e.p, classId: e.classId, subject: e.subject, kind: 'regular' }));
    X().moves().extra.filter(x => x.teacher === me && x.date === date).forEach(x => out.push({ key: x.classId + '|' + date + '|' + x.p, p: x.p, classId: x.classId, subject: x.subject, kind: x.kind }));
  }
  S.specials.filter(s => s.date === date && s.teacher === me).forEach(s => out.push({ key: s.classId + '|' + date + '|' + s.p, p: s.p, classId: s.classId, subject: s.subject, kind: s.kind, special: s.id }));
  /* คาบคู่: คาบติดกันของห้องเดียวกัน วิชาเดียวกัน → เช็กครั้งเดียว บันทึกลงทุกคาบ (lead = คาบแรกของกลุ่ม) */
  out.filter(s => s.p >= 0).sort((a, b) => a.p - b.p).forEach(s => { if (s.block) return;
    const run = [s]; let q = s.p + 1, nx;
    while ((nx = out.find(x => x.p === q && !x.block && x.classId === s.classId && subjOf(x) === subjOf(s)))) { run.push(nx); q++; }
    if (run.length > 1) { const keys = run.map(x => x.key), ps = run.map(x => x.p); run.forEach(x => { x.block = keys; x.blockP = ps; x.lead = s.key; }); } });
  return out;
}
const pRange = s => s.blockP ? 'คาบ ' + (s.blockP[0] + 1) + '–' + (s.blockP[s.blockP.length - 1] + 1) : 'คาบ ' + (s.p + 1);
const done = key => !!S.attSaved[key];

/* ---------- กิจกรรม → สถานะ "กิจกรรม" ---------- */
function actFor(date, p, studentKey) {
  return S.acts.find(a => a.date === date && a.slots.indexOf(p) >= 0 && a.students.some(s => s.key === studentKey)) || null;
}
function impact(a) {                                         // คาบเรียนที่จะได้รับผล (ทุกครูในโรงเรียน)
  if (!a.date || !a.slots.length || !a.students.length || !X()) return [];
  const di = dayIdxOf(a.date); if (di < 0) return [];
  const byClass = {}; a.students.forEach(s => { byClass[s.classId] = (byClass[s.classId] || 0) + 1; });
  const mv = X().moves(), rows = [];
  X().entriesOn(a.date).filter(e => a.slots.indexOf(e.p) >= 0 && byClass[e.classId] && !mv.hidden.has(e.id + '|' + a.date))
    .forEach(e => rows.push({ p: e.p, subject: e.subject, classId: e.classId, teacher: e.teacher, count: byClass[e.classId] }));
  mv.extra.filter(x => x.date === a.date && a.slots.indexOf(x.p) >= 0 && byClass[x.classId]).forEach(x => rows.push({ p: x.p, subject: x.subject, classId: x.classId, teacher: x.teacher, count: byClass[x.classId] }));
  return rows.sort((x, y) => x.p - y.p);
}

/* ---------- คาบค้างเช็กชื่อ (30 วันย้อนหลัง เฉพาะช่วงเปิด–ปิดภาคเรียน และไม่ใช่ช่วงปิดเทอม) ---------- */
function missed() {
  const out = [], t = todayISO(), since = (S.settings || {}).attSince || '', tm = curTerm();      // attSince = แอดมินล้างคาบค้างช่วงทดลองใช้ (audit.js)
  if ((tm.open && t < tm.open) || (tm.close && t > tm.close) || (window.EMSTermLocked && EMSTermLocked())) return out;
  for (let i = 30; i >= 1; i--) {
    const d = shift(t, -i); if (d < since || !inTerm(d) || dayIdxOf(d) < 0 || holidayOf(d)) continue;
    sessionsOn(d).forEach(s => { if (!done(s.key)) out.push(Object.assign({ date: d }, s)); });
  }
  return out.reverse();
}
const monthOf = d => d.slice(0, 7);
const monthLabel = d => parse(d).toLocaleDateString((window.EMSLang && EMSLang.locale()) || 'th-TH', { month: 'long', year: 'numeric' });
const subjOf = s => String(s.subject || '').split(' ')[0] || s.subject;
function missedCard(list) {
  const A = S.aui, f = list.filter(x => (!A.missMonth || monthOf(x.date) === A.missMonth) && (!A.missClass || x.classId === A.missClass) && (!A.missSubject || x.subject === A.missSubject));
  const opts = (keyOf, labelOf, sel, all) => { const c = {}, l = {}; list.forEach(x => { const k = keyOf(x); c[k] = (c[k] || 0) + 1; l[k] = labelOf(x); });
    return `<option value="">${all} (${list.length})</option>` + Object.keys(c).sort().map(k => `<option value="${esc(k)}" ${sel === k ? 'selected' : ''}>${esc(l[k])} (${c[k]})</option>`).join(''); };
  const item = x => `<div class="row"><div class="grow"><div class="t">${thDate(x.date)}</div><div class="muted small">${x.p < 0 ? 'เข้าแถว' : 'คาบ ' + (x.p + 1)} · ${esc(subjOf(x))} · ${esc(cname(x.classId))}</div></div><button class="btn sm pri" data-at="openMissed" data-d="${x.date}" data-k="${esc(x.key)}">เช็กชื่อ</button></div>`;
  let body = '';
  if (!f.length) body = '<div class="empty">ไม่มีคาบค้างเช็กที่ตรงกับตัวกรองนี้</div>';
  else if (A.missGroup === 'date') body = `<div class="list">${f.slice(0, 200).map(item).join('')}</div>`;
  else { const kf = x => A.missGroup === 'month' ? monthOf(x.date) : A.missGroup === 'class' ? x.classId : x.subject;
    const lf = x => A.missGroup === 'month' ? monthLabel(x.date) : A.missGroup === 'class' ? cname(x.classId) : subjOf(x);
    const b = {}, lb = {}; f.forEach(x => { const k = kf(x); (b[k] = b[k] || []).push(x); lb[k] = lf(x); });
    body = Object.keys(b).sort((p, q) => b[q].length - b[p].length).map(k => `<div style="margin-top:10px"><div class="row" style="border:0;padding:4px 0"><b class="grow">${esc(lb[k])}</b>${chip(b[k].length + ' คาบ')}</div><div class="list">${b[k].slice(0, 50).map(item).join('')}</div></div>`).join(''); }
  return `<div class="card"><div class="row" style="border:0;padding-top:0"><h2 style="margin:0">คาบค้างเช็กชื่อ</h2>${chip(list.length, list.length ? 'bad' : 'ok')}<span class="grow"></span>${A.missMonth || A.missClass || A.missSubject ? '<button class="btn sm" data-at="missClear">ล้างตัวกรอง</button>' : ''}</div>
    ${list.length ? `<div class="grid g3" style="margin:10px 0">
      <div><label class="f" for="mm-m">เดือน</label><select id="mm-m" class="in" data-atf="missMonth">${opts(x => monthOf(x.date), x => monthLabel(x.date), A.missMonth, 'ทุกเดือน')}</select></div>
      <div><label class="f" for="mm-c">ห้อง</label><select id="mm-c" class="in" data-atf="missClass">${opts(x => x.classId, x => cname(x.classId), A.missClass, 'ทุกห้อง')}</select></div>
      <div><label class="f" for="mm-s">วิชา</label><select id="mm-s" class="in" data-atf="missSubject">${opts(x => x.subject, x => subjOf(x), A.missSubject, 'ทุกวิชา')}</select></div></div>
      <div class="pills"><span class="muted small" style="align-self:center">จัดกลุ่มตาม</span>${[['date', 'วันที่'], ['month', 'เดือน'], ['class', 'ห้อง'], ['subject', 'วิชา']].map(([k, l]) => `<button class="pill" aria-pressed="${A.missGroup === k}" data-at="missGroup" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="muted small">ย้อนหลัง 30 วัน · แสดง ${f.length} จาก ${list.length} คาบ</div>${body}` : '<div class="empty">ไม่มีคาบค้างเช็ก</div>'}</div>`;
}

/* ---------- หน้าเช็กชื่อ ---------- */
P.attendance = () => {
  const A = S.aui, date = A.date = A.date || todayISO(), di = dayIdxOf(date), hol = holidayOf(date), tOff = !hol ? termOffWhy(date) : '', showAnyway = A.showHoliday === date;
  const ss = sessionsOn(date), cur = ss.find(s => s.key === A.sess) || null;
  const byP = {}; ss.forEach(s => { (byP[s.p] = byP[s.p] || []).push(s); });
  const cell = s => { if (s.block && s.lead !== s.key) return `<button class="tt-sess ${A.sess === s.lead ? 'on' : ''}" data-at="open" data-k="${esc(s.lead)}" title="คาบคู่ เช็กรวมกับ${esc(pRange(s))}"><b>${esc(cname(s.classId))}</b><span>${esc(subjOf(s))}</span>${chip('คาบคู่ ↤', 'info')}</button>`;
    const c = done(s.key), acts = S.acts.filter(a => a.date === date && (s.p < 0 ? false : a.slots.indexOf(s.p) >= 0) && a.students.some(x => x.classId === s.classId)).length;
    return `<button class="tt-sess ${A.sess === s.key ? 'on' : ''} ${s.kind !== 'regular' && s.kind !== 'hr' ? 'ex' : ''}" data-at="open" data-k="${esc(s.key)}">
      <b>${esc(cname(s.classId))}</b><span>${esc(subjOf(s))}</span>${s.kind !== 'regular' && s.kind !== 'hr' ? `<span class="small" style="color:var(--info)">↷ ${esc(s.kind)}</span>` : ''}
      ${chip(c ? 'เช็กแล้ว' : (S.att[s.key] || {})._draft ? 'ยังไม่กดบันทึก' : 'ยังไม่เช็ก', c ? 'ok' : (S.att[s.key] || {})._draft ? 'warn' : '')}${acts ? chip('กิจกรรม', 'act') : ''}${s.special ? `<span class="x-del" data-at="delSpecial" data-id="${s.special}" title="ลบคาบพิเศษ">×</span>` : ''}</button>`; };
  const grid = `<div class="card"><div class="scroll"><div class="att-grid" style="grid-template-columns:${byP[-1] ? '120px ' : ''}repeat(${PERIODS.length},minmax(110px,1fr))">
      ${byP[-1] ? `<div class="h">เข้าแถว</div>` : ''}${PERIODS.map((pp, i) => `<div class="h">คาบ ${i + 1}${pp[0] ? `<br><span>${pp[0]}–${pp[1]}</span>` : ''}</div>`).join('')}
      ${byP[-1] ? `<div>${byP[-1].map(cell).join('')}</div>` : ''}
      ${PERIODS.map((_, i) => `<div>${(byP[i] || []).map(cell).join('') || `<button class="tt-sess empty" data-at="special" data-p="${i}">+ คาบพิเศษ<span class="small">สอนแทน · ชดเชย</span></button>`}</div>`).join('')}
    </div></div><div class="muted small" style="margin-top:6px">แตะคาบเพื่อเช็กชื่อ · คาบแลก/สอนแทนที่ตอบรับแล้วขึ้นให้เอง · ช่องว่างกด “+ คาบพิเศษ” เพิ่มคาบสอนแทนหรือสอนชดเชยได้</div></div>`;
  return `<div class="top"><div><h1>เช็กชื่อประจำวัน</h1><p>${thDate(date)} · เลือกวันย้อนหลังได้ · คาบประจำกดเช็กได้ทันที</p></div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><div><label class="f" for="at-d">วันที่</label><input id="at-d" type="date" class="in" value="${date}" data-atf="date"></div><button class="btn" data-at="today">วันนี้</button></div></div>
    ${examOf(date) && !hol && !tOff ? `<div class="notice" style="background:var(--info-soft)"><b>วันสอบ</b> — คาบเรียนตั้งต้น “มา” ทุกคน ครูเช็กเองเฉพาะคนขาดสอบ (คาบที่ไม่ได้แก้ ระบบบันทึก “มา” ให้หลังผ่านวันสอบ · แถวเช้าเช็กตามปกติ)</div>` : ''}
    ${di < 0 ? '<div class="notice">วันที่เลือกเป็นวันหยุดสุดสัปดาห์ เพิ่มคาบพิเศษ (สอนแทน/ชดเชย) ได้</div>' : ''}
    ${hol || tOff ? `<div class="card" style="border-left:4px solid var(--gold)"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:10px"><div class="grow" style="flex:1 1 240px;min-width:0"><div class="muted small">${hol ? 'วันหยุด' : 'นอกช่วงภาคเรียน'}</div><h2 style="margin:2px 0">${esc(hol ? hol.title : tOff)}</h2><div class="muted small"><b>วันนี้ไม่ต้องเช็กชื่อ</b> ไม่นับเป็นคาบค้างเช็ก และไม่นำไปคิดเวลาเรียน</div></div>
      <button class="btn" data-at="holidayToggle">${showAnyway ? 'ซ่อนตารางคาบ' : 'มีการเรียนการสอนจริง · เปิดตาราง'}</button></div></div>` : ''}
    ${(hol || tOff) && !showAnyway ? '' : grid}
    ${cur ? sessionPanel(cur, date) : ''}
    ${missedCard(missed())}`;
};
function sessionPanel(s, date) {
  const c = cls(s.classId);
  if (!c || !c.students.length) return `<div class="card"><h2>${esc(cname(s.classId))} · ${esc(subjOf(s))}</h2><div class="empty">ห้องนี้ยังไม่มีรายชื่อนักเรียนในระบบ</div></div>`;
  const rec = view(s, date), cnt = { p: 0, s: 0, l: 0, c: 0, a: 0 };
  c.students.forEach(st => { if (cnt[rec[st.id]] !== undefined) cnt[rec[st.id]]++; });
  const own = S.att[s.key] || blockRec(s), marked = cnt.p + cnt.s + cnt.l + cnt.c + cnt.a, pre = own ? 0 : c.students.filter(st => rec[st.id] === 'c').length;
  const cf = !own && s.p >= 0 ? carryFrom(s.classId, date, s.p) : null;
  const named = ATT.filter(x => x[0] !== 'p').map(([k, l, cl]) => ({ k, l, cl, list: c.students.filter(st => rec[st.id] === k) }));
  return `<div class="card" id="att-panel"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">${s.p < 0 ? 'เข้าแถว / โฮมรูม' : pRange(s)} · ${esc(c.name)} · ${esc(subjOf(s))}${s.block ? ' ' + chip('คาบคู่ · เช็กครั้งเดียว', 'info') : ''}</h2>
      <div class="muted small">${thDate(date)} · เช็กแล้ว ${marked}/${c.students.length} คน${s.kind === 'hr' ? ' · บันทึกแล้วหักคะแนน “มาสาย (แถวเช้า)” ให้ฝ่ายกิจการนักเรียนอัตโนมัติ' : ''}</div></div>${done(s.key) ? chip('บันทึกแล้ว', 'ok') : (S.att[s.key] || {})._draft ? chip('ยังไม่ได้กดบันทึก', 'warn') : ''}</div>
    ${cf ? `<div class="notice" style="background:var(--info-soft)"><b>ดึงผลจาก${esc(cf.label)}</b>${cf.subject ? ' · ' + esc(cf.subject) : ''}${cf.teacher ? ' · ' + esc(cf.teacher) : ''}${cf.room !== s.classId ? ' (ห้อง ' + esc(cname(cf.room)) + ')' : ''} — ขาด ${Object.values(cf.rec).filter(v => v === 'a').length} · ลา ${Object.values(cf.rec).filter(v => v === 'l').length} คน · <b>ตรวจซ้ำว่าถูกต้อง แล้วกดบันทึก</b> (สาย → มา)</div>` : ''}
    ${examOf(date) && s.kind !== 'hr' ? `<div class="notice" style="background:var(--info-soft)"><b>วันสอบ${esc(examOf(date).title ? ' · ' + examOf(date).title : '')}</b> — ระบบใส่ “มา” ให้ทุกคนแล้ว <b>แก้เฉพาะคนขาดสอบ</b> แล้วกดบันทึก${done(s.key) ? '' : ' (ถ้าไม่ได้กดบันทึก ระบบบันทึก “มา” ให้เองหลังผ่านวันสอบ)'}</div>` : ''}
    ${pre ? `<div class="notice" style="background:var(--act-soft)">มีนักเรียน ${pre} คนไปทำกิจกรรมในคาบนี้ ระบบใส่สถานะ “กิจกรรม” ให้แล้ว</div>` : ''}
    <div class="att-head"><span class="muted small">ที่</span><span class="muted small">ชื่อ-สกุล</span>
      <span class="att-btns">${ATT.map(([k, l]) => `<button class="ah ${k}" data-at="all" data-v="${k}" title="เลือก${l}ทั้งห้อง">${l}<small>${cnt[k]}</small></button>`).join('')}</span></div>
    ${c.students.map(st => { const a = actFor(date, s.p, sk(st));
      return `<div class="att-row" data-st="${rec[st.id] || ''}"><span class="muted small">${st.no}</span><span class="nm">${esc(st.name)}${a ? ` <span class="chip act" style="font-size:.7rem" title="${esc(a.name)}">กิจกรรม</span>` : ''}</span>
        <span class="att-btns" role="group" aria-label="สถานะ ${esc(st.name)}">${ATT.map(([k, l]) => `<button class="ab ${k}" aria-pressed="${rec[st.id] === k}" data-at="mark" data-s="${st.id}" data-v="${k}">${l}</button>`).join('')}</span></div>`; }).join('')}
    <div class="att-names" style="margin-top:12px">${named.map(g => `<div class="g"><span class="chip ${g.cl}">${g.l} ${g.list.length} คน</span>${g.list.map(st => `<span class="chip ${g.cl}" style="font-weight:600">${st.no}. ${esc(st.name)}</span>`).join('')}</div>`).join('')}</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;position:sticky;bottom:76px;background:var(--surface);padding:8px 0">
      ${ATT.map(([k, l, cl]) => chip(l + ' ' + cnt[k], cl)).join('')}<span class="grow"></span>
      <button class="btn pri" data-at="save" ${marked ? '' : 'disabled style="opacity:.5"'}>บันทึกการเช็กชื่อ</button></div></div>`;
}
/** สถานะที่แสดง = ที่บันทึกไว้ + "กิจกรรม" จากกิจกรรมที่ลงไว้ (เฉพาะคนที่ยังไม่มีสถานะ) */
function view(s, date) {
  const c = cls(s.classId), own = S.att[s.key] || blockRec(s), rec = Object.assign({}, own || {});
  if (!own && c && s.p >= 0) { const cf = carryFrom(s.classId, date, s.p);
    c.students.forEach(st => { if (actFor(date, s.p, sk(st))) { rec[st.id] = 'c'; return; } const v = cf && cf.rec[st.id]; if (v && CARRY[v]) rec[st.id] = CARRY[v]; });
    if (examOf(date)) c.students.forEach(st => { if (!rec[st.id]) rec[st.id] = 'p'; }); }
  return rec;
}
/* วันสอบ: คาบเรียน (ไม่รวมแถวเช้า) ที่ครูไม่ได้บันทึกเอง → บันทึก “มา” ให้อัตโนมัติเมื่อผ่านวันสอบไปแล้ว
   (ขาด/ลาจากคาบก่อนหน้า และกิจกรรม ยังคิดตามปกติ) · ครูแก้เฉพาะคนขาดสอบ แล้วกดบันทึกเอง
   เขียนเฉพาะเมื่อโหลดผลเช็กชื่อจากระบบครบแล้ว ห้องที่อยู่ในรายชื่อของครู และภาคปัจจุบัน — กันเขียนทับผลที่บันทึกไว้แล้ว */
let autoBusy = false;
async function examAutoFill() {
  const C = window.EMSCloud, t = todayISO();
  if (autoBusy || !S.me || !S.me.name || (C && (!C.ready.att || (C.status && C.status.state === 'error')))) return;
  if (S.viewTerm && (S.viewTerm.year !== S.term.year || S.viewTerm.sem !== S.term.sem)) return;
  const tm = (S.terms || []).find(x => x.year === S.term.year && x.sem === S.term.sem) || {}, from = shift(t, -30);
  const days = [...new Set((S.events || []).filter(e => e.cat === 'exam' && e.date < t && e.date >= from && (!tm.open || e.date >= tm.open) && (!tm.close || e.date <= tm.close)
    && dayIdxOf(e.date) >= 0 && !holidayOf(e.date)).map(e => e.date))];
  const todo = [];
  days.forEach(d => sessionsOn(d).forEach(s => { if (s.kind === 'hr' || s.p < 0 || done(s.key) || S.att[s.key]) return;
    const c = cls(s.classId); if (c && c.students.length) todo.push([s, d]); }));
  if (!todo.length) return;
  autoBusy = true; let n = 0;
  try { for (const [s, d] of todo) { if (done(s.key) || S.att[s.key]) continue; const rec = view(s, d);
      for (const k of (s.block || [s.key])) { if (done(k)) continue; S.att[k] = Object.assign({}, rec); await ems.data.saveAttendance(k, S.att[k]); n++; } } }
  finally { autoBusy = false; }
  if (!n) return;
  toast('วันสอบ: บันทึกเช็กชื่อ “มา” ให้อัตโนมัติ ' + n + ' คาบ — ถ้ามีคนขาดสอบ แก้ที่หน้าเช็กชื่อ');
  if (document.getElementById('at-d')) redraw();
}
/* คาบคู่: คาบอื่นในกลุ่มบันทึกไว้แล้ว ใช้ผลนั้น */
const blockRec = s => { const k = (s.block || []).find(x => x !== s.key && S.att[x]); return k ? S.att[k] : null; };
/* ส่งต่อ: ขาด/ลา/มา ตามเดิม · สาย → มา (มาถึงแล้ว) · กิจกรรม คิดใหม่ตามคาบนี้ */
const CARRY = { a: 'a', l: 'l', p: 'p', s: 'p' };
/** ผลเช็กชื่อล่าสุดก่อนคาบนี้ของห้องเดียวกันในวันเดียวกัน (รวมห้องหลัก/ห้องย่อยตามแผนการเรียน และแถวเช้า) */
function carryFrom(cid, date, p) {
  const pid = window.EMSPlans ? EMSPlans.parentOf(cid) : '', rooms = [cid].concat(pid && pid !== cid ? [pid] : []);
  let best = null;
  Object.keys(S.att || {}).forEach(k => { const [c, d, q] = k.split('|'); if (d !== date || rooms.indexOf(c) < 0) return;
    const qn = q === 'hr' ? -1 : +q; if (!(qn < p)) return;
    if (!best || qn > best.q || (qn === best.q && c === cid)) best = { q: qn, key: k, room: c, rec: S.att[k] }; });
  if (!best) return null;
  const e = best.q >= 0 && X() ? X().entriesOn(date).find(x => x.classId === best.room && x.p === best.q) : null;
  return Object.assign(best, { label: best.q < 0 ? 'แถวเช้า' : 'คาบ ' + (best.q + 1), teacher: e ? e.teacher : '', subject: e ? subjOf(e) : '' });
}

/* ---------- แถวเช้า → ฝ่ายกิจการนักเรียน ---------- */
function syncHomeroom(cid, date, rec) {
  const A = S.affairs; if (!A) return 0;
  const cfg = A.cfg, c = cls(cid); if (!c) return 0;
  const plan = [['s', 'late', 'มาสาย (แถวเช้า)', num(cfg.lateDeduct)], ['a', 'absent', 'ขาดเข้าแถว', num(cfg.assemblyAbsentDeduct)]];
  let n = 0;
  plan.forEach(([st, typ, title, pts]) => {
    const want = new Set(pts > 0 ? c.students.filter(x => rec[x.id] === st).map(sk) : []);
    want.forEach(sid => {
      const id = typ + '_' + date + '_' + sid + '_hr', old = A.records.find(r => r.id === id);
      if (old && !old.voided) return;
      const s0 = c.students.find(x => sk(x) === sid);
      if (old) delete old.voided;
      else A.records.push({ id, sid, name: s0.name, className: c.name, type: typ === 'late' ? 'late' : 'conduct', kind: 'bad', title, points: pts, date, time: '', source: 'homeroom', by: S.me.name, createdAt: new Date().toISOString() });
      n++;
    });
    A.records.filter(r => r.source === 'homeroom' && r.date === date && r.className === c.name && r.id.indexOf(typ + '_') === 0 && !r.voided && !want.has(r.sid))
      .forEach(r => { r.voided = { by: S.me.name, at: new Date().toISOString(), reason: 'ครูที่ปรึกษาแก้สถานะการเช็กชื่อแถวเช้า' }; });
  });
  const cnt = k => c.students.filter(x => rec[x.id] === k).length;
  (A.daily[date] = A.daily[date] || {})[cid] = { present: cnt('p'), late: cnt('s'), absent: cnt('a'), leave: cnt('l'), activity: cnt('c'), teacher: S.me.name, checkedAt: new Date().toISOString() };
  return n;
}

/* ---------- กิจกรรมนักเรียน ---------- */
const findStudent = key => { for (const c of S.classes) { const s = c.students.find(x => sk(x) === key); if (s) return { key: sk(s), name: s.name, classId: c.id }; } return null; };
P.activities = () => {
  const A = S.aui, d = A.draft = A.draft || { name: '', date: todayISO(), place: '', slots: [], students: [], note: '' };
  const imp = impact(d), list = S.acts.slice().sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="top"><div><h1>ขออนุญาตนำนักเรียนทำกิจกรรม</h1><p>พิมพ์เลขประจำตัวเพื่อเลือกนักเรียน · ระบบขึ้นสถานะ “กิจกรรม” ให้ครูที่สอนคาบนั้นอัตโนมัติ</p></div></div>
    <div class="x-layout"><div>
      <div class="card" style="margin-top:0"><h2>1. รายละเอียดกิจกรรม${d.id ? ' <span class="chip warn">กำลังแก้ไข</span>' : ''}</h2>
        <div class="field"><label class="f" for="ac-n">ชื่อกิจกรรม</label><input id="ac-n" class="in" value="${esc(d.name)}" placeholder="เช่น แข่งขันตอบปัญหาวิทยาศาสตร์" data-atf="dName"></div>
        <div class="grid g2"><div class="field"><label class="f" for="ac-d">วันที่ทำกิจกรรม</label><input id="ac-d" class="in" type="date" value="${esc(d.date)}" data-atf="dDate"></div>
          <div class="field"><label class="f" for="ac-p">สถานที่</label><input id="ac-p" class="in" value="${esc(d.place)}" placeholder="เช่น หอประชุมโรงเรียน" data-atf="dPlace"></div></div>
        <div class="field"><div class="f">คาบที่ทำกิจกรรม (เลือกได้หลายคาบ)</div><div class="pills">${PERIODS.map((_, i) => `<button class="pill" aria-pressed="${d.slots.indexOf(i) >= 0}" data-at="slot" data-p="${i}">คาบ ${i + 1}</button>`).join('')}</div></div>
        <div class="field"><label class="f" for="ac-x">รายละเอียดเพิ่มเติม</label><input id="ac-x" class="in" value="${esc(d.note)}" data-atf="dNote"></div></div>
      <div class="card"><h2>2. เลือกนักเรียนด้วยเลขประจำตัว</h2>
        <div style="display:flex;gap:8px"><input id="ac-sid" class="in" placeholder="พิมพ์เลขประจำตัว แล้วกด Enter (วางหลายคนพร้อมกันได้)" inputmode="numeric" data-atk="sid"><button class="btn pri" data-at="addSid">เพิ่ม</button></div>
        <div class="muted small" style="margin:6px 0 10px">วางเลขประจำตัวหลายคนคั่นด้วยเว้นวรรค จุลภาค หรือขึ้นบรรทัดใหม่ได้</div>
        ${d.students.length ? `<div class="scroll" style="max-height:300px"><table class="tbl"><thead><tr><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>ชั้น</th><th></th></tr></thead><tbody>
          ${d.students.map(s => `<tr><td>${esc(s.key)}</td><td><b>${esc(s.name)}</b></td><td>${esc(cname(s.classId))}</td><td><button class="btn sm ghost" style="color:var(--bad)" data-at="delSid" data-k="${esc(s.key)}">ลบ</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่ได้เลือกนักเรียน</div>'}
        <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">${chip(d.students.length + ' คน')}<span class="grow"></span><button class="btn" data-at="clearSid">ล้างรายชื่อ</button>${d.id ? '<button class="btn" data-at="cancelEdit">ยกเลิกการแก้ไข</button>' : ''}<button class="btn pri" data-at="saveAct">บันทึกและลงในการเช็กชื่อ</button></div></div>
    </div><div>
      <div class="card" style="margin-top:0"><h2>คาบเรียนที่จะได้รับผล</h2>
        ${imp.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>คาบ</th><th>วิชา</th><th>ครู</th><th>นักเรียน</th></tr></thead><tbody>${imp.map(r => `<tr><td>${r.p + 1}</td><td>${esc(subjOf(r))}<br><span class="muted small">${esc(cname(r.classId))}</span></td><td>${esc(r.teacher)}</td><td>${r.count} คน</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">เลือกวันที่ คาบ และนักเรียนก่อน</div>'}
        <div class="muted small" style="margin-top:8px">ครูเจ้าของคาบจะเห็นนักเรียนเหล่านี้ขึ้นสถานะ “กิจกรรม” ให้อัตโนมัติเมื่อเปิดเช็กชื่อ</div></div>
      <div class="card"><h2>กิจกรรมที่บันทึกไว้</h2>${list.length ? `<div class="list">${list.slice(0, 30).map(a => `<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="t">${esc(a.name)}</div><div class="muted small">${thDate(a.date)} · ${a.slots.length} คาบ · ${a.students.length} คน · ${esc(a.by)}</div></div>
          <button class="btn sm" data-at="printAct" data-id="${a.id}">พิมพ์ใบขออนุญาต</button><button class="btn sm" data-at="editAct" data-id="${a.id}">แก้ไข</button><button class="btn sm ghost" style="color:var(--bad)" data-at="delAct" data-id="${a.id}">ลบ</button></div>`).join('')}</div>` : '<div class="empty">ยังไม่มีกิจกรรม</div>'}</div>
    </div></div>`;
};
function actDoc(a) {
  const s = S.settings || {}, slots = a.slots.slice().sort((x, y) => x - y).map(p => p + 1);
  const rows = a.students.map((st, i) => `<tr><td>${i + 1}</td><td>${esc(st.key)}</td><td style="text-align:left">${esc(st.name)}</td><td>${esc(cname(st.classId))}</td></tr>`).join('');
  return `<style>table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #444;padding:3px 6px;text-align:center;font-size:14pt}</style>
    <h1>บันทึกข้อความ</h1><p><b>ส่วนราชการ</b> ${esc(s.schoolName || 'โรงเรียนปากช่อง')}</p><p><b>วันที่</b> ${thDate(todayISO())}</p>
    <p><b>เรื่อง</b> ขออนุญาตนำนักเรียนเข้าร่วมกิจกรรม</p><p><b>เรียน</b> ผู้อำนวยการ${esc(s.schoolName || 'โรงเรียนปากช่อง')}</p>
    <p style="text-indent:48px">ด้วยข้าพเจ้า ${esc(a.by)} มีความประสงค์ขออนุญาตนำนักเรียนจำนวน ${a.students.length} คน เข้าร่วมกิจกรรม “${esc(a.name)}” ณ ${esc(a.place || '................')}
      ในวันที่ ${thDate(a.date)} ระหว่างคาบเรียนที่ ${slots.join(', ')}${a.note ? ' (' + esc(a.note) + ')' : ''} จึงขอให้ครูประจำวิชาในคาบดังกล่าวบันทึกสถานะ “กิจกรรม” ให้นักเรียน รายชื่อดังนี้</p>
    <table><thead><tr><th>ที่</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>ชั้น</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="text-indent:48px;margin-top:10px">จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต</p>
    <p style="text-align:right;margin-top:18px">ลงชื่อ ........................................ ผู้ขออนุญาต<br>( ${esc(a.by)} )</p>
    <p style="margin-top:18px">ความเห็นผู้บริหาร ☐ อนุญาต ☐ ไม่อนุญาต<br><br>ลงชื่อ ........................................</p>`;
}
function printDoc(title, body) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const font = window.EMSType ? EMSType.printStack() : '"TH Sarabun New","Sarabun",sans-serif', d = f.contentWindow.document; d.open();
  d.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:16mm}body{font-family:${font};font-size:15pt;line-height:1.6;color:#000}h1{text-align:center;font-size:22pt;margin:0 0 8px}p{margin:4px 0}${window.EMSPrintCss ? EMSPrintCss() : ''}</style></head><body>${body}</body></html>`);
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
}
function addSids(text) {
  const d = S.aui.draft, parts = String(text || '').split(/[\s,]+/).filter(Boolean); let added = 0; const miss = [], dup = [];
  parts.forEach(k => { if (d.students.some(s => s.key === k)) { dup.push(k); return; } const f = findStudent(k); if (!f) { miss.push(k); return; } d.students.push(f); added++; });
  save(); toast('เพิ่ม ' + added + ' คน' + (dup.length ? ' · ซ้ำ ' + dup.length : '') + (miss.length ? ' · ไม่พบเลขประจำตัว ' + miss.join(', ') : ''));
  redraw(); const b = $('#ac-sid'); if (b) b.focus();
}

/* ---------- CSS ---------- */
const css = document.createElement('style');
css.textContent = `
.att-grid{display:grid;gap:6px;min-width:720px}
.att-grid .h{font-size:.8rem;color:var(--muted);font-weight:600;text-align:center;line-height:1.3}
.att-grid .h span{font-weight:400;font-size:.74rem}
.att-grid > div{display:flex;flex-direction:column;gap:6px}
.tt-sess{position:relative;text-align:left;border:1px solid var(--line);border-left:4px solid var(--brand);background:var(--surface2);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:3px;font:inherit;color:inherit;cursor:pointer;min-height:84px}
.tt-sess span{font-size:.8rem;color:var(--muted);line-height:1.3}
.tt-sess.on{box-shadow:0 0 0 2px var(--gold);background:var(--brand-soft)}
.tt-sess.ex{border-left-color:var(--info)}
.tt-sess.empty{border:1px dashed var(--line);background:none;color:var(--muted);align-items:center;justify-content:center;text-align:center}
.tt-sess .chip{align-self:flex-start;font-size:.72rem}
.x-del{position:absolute;top:2px;right:6px;font-size:1rem;color:var(--bad)!important;cursor:pointer}
`;
document.head.appendChild(css);

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click', e => {        // ปุ่ม “เช็กชื่อ” จากหน้าแรก/ตารางสอน → เปิดคาบของห้องนั้นวันนี้
  const t = e.target.closest('[data-act="startAtt"]'); if (!t) return;
  e.stopImmediatePropagation();
  const d = todayISO(), s = sessionsOn(d).find(x => x.classId === t.dataset.c && x.kind !== 'hr');
  S.aui.date = d; S.aui.sess = s ? s.key : ''; save(); go('attendance');
  setTimeout(() => { const p = $('#att-panel'); if (p) p.scrollIntoView({ block: 'start' }); }, 50);
}, true);
const attReasoned = new Set();       // คาบของครูคนอื่นที่แอดมินให้เหตุผลแล้วในครั้งนี้
const LAB_AT = { p: 'มา', a: 'ขาด', l: 'ลา', s: 'สาย', c: 'กิจกรรม' };
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-at]'); if (!t) return;
  const a = t.dataset.at, d = t.dataset, A = S.aui;
  const curS = () => sessionsOn(A.date).find(s => s.key === A.sess);
  switch (a) {
    case 'today': A.date = todayISO(); A.sess = ''; save(); return redraw();
    case 'holidayToggle': A.showHoliday = A.showHoliday === A.date ? '' : A.date; save(); return redraw();
    case 'open': if (e.target.closest('[data-at="delSpecial"]')) return; A.sess = d.k; save(); redraw(); setTimeout(() => { const p = $('#att-panel'); if (p) p.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30); return;
    case 'openMissed': A.date = d.d; A.sess = d.k; save(); redraw(); setTimeout(() => { const p = $('#att-panel'); if (p) p.scrollIntoView({ block: 'start' }); }, 30); return;
    case 'mark': case 'all': { const s = curS(); if (!s) return;
      const by0 = (S.att[s.key] || {})._by; let ok = null;      // _by = ผู้กดบันทึกล่าสุด (สอนเข้าคู่ = คาบเดียวกัน key เดียวกัน)
      if (S.attSaved[s.key] && by0 && by0 !== S.me.name && !attReasoned.has(s.key) && window.EMSAudit) {      // แก้การเช็กชื่อที่ครูคนอื่นบันทึกไว้แล้ว = ต้องมีเหตุผล (ถามครั้งเดียวต่อคาบ)
        const c0 = cls(s.classId), who = a === 'mark' ? (((c0 && c0.students.find(x => String(x.id) === String(d.s))) || {}).name || d.s) : 'ทั้งห้อง';
        ok = await EMSAudit.guard('att', (c0 ? c0.name : s.classId) + ' · ' + A.date + ' · ' + (s.p < 0 ? 'แถวเช้า' : pRange(s)) + ' · ' + who, 'บันทึกโดย ' + by0, 'แก้เป็น ' + (LAB_AT[d.v] || d.v), 'แก้การเช็กชื่อของ ' + by0); if (!ok) return;
        attReasoned.add(s.key); }
      const c = cls(s.classId), r = S.att[s.key] = view(s, A.date);
      if (a === 'mark') { if (r[d.s] === d.v) delete r[d.s]; else r[d.s] = d.v; }
      else {                                       // เลือกทั้งห้อง แต่ไม่ทับคนที่ไปทำกิจกรรม (ยกเว้นกดหัวคอลัมน์ “กิจกรรม” เอง)
        const keep = x => d.v !== 'c' && r[x.id] === 'c' && actFor(A.date, s.p, sk(x));
        const allOn = c.students.every(x => r[x.id] === d.v || keep(x));
        c.students.forEach(x => { if (keep(x)) return; if (allOn) { if (r[x.id] === d.v) delete r[x.id]; } else r[x.id] = d.v; }); }
      r._draft = true; delete S.attSaved[s.key]; save(); if (ok) ok(); return redraw(); }      // _draft = ยังไม่ได้กดบันทึก (ผลที่ติ๊กส่งขึ้นกันหาย แต่ไม่นับว่าเช็กแล้ว/ยังไม่หักคะแนนมาสาย)
    case 'save': { const s = curS(); if (!s) return;
      if (window.EMSCloud && EMSCloud.condReady && !EMSCloud.condReady(s.kind === 'hr')) return toast('กำลังโหลดข้อมูลกิจการนักเรียน รอสักครู่');      // ยังไม่ได้ข้อมูลรอบแรก = รายการมาสาย/ยอดแถวเช้าที่บันทึกถูกทับหาย
      const rec = S.att[s.key] = view(s, A.date); delete rec._draft;
      if (!(rec._by && rec._by !== S.me.name && !attReasoned.has(s.key))) rec._by = S.me.name;      // กดบันทึกซ้ำโดยไม่ได้แก้ผลของคนอื่น = คงชื่อผู้บันทึกเดิม
      for (const k of (s.block || [s.key])) { S.att[k] = Object.assign({}, rec); await ems.data.saveAttendance(k, S.att[k]); }
      let msg = s.block ? 'บันทึกการเช็กชื่อ ' + pRange(s) + ' แล้ว' : 'บันทึกการเช็กชื่อแล้ว';
      if (s.kind === 'hr') { const n = syncHomeroom(s.classId, A.date, rec); save(); if (n) msg += ' · ส่งฝ่ายกิจการนักเรียน ' + n + ' รายการ'; }
      toast(msg); return redraw(); }
    case 'special': { const p = +d.p;
      return modal(`<h2 style="margin-bottom:12px">เพิ่มคาบพิเศษ · คาบ ${p + 1} · ${thDate(A.date)}</h2>
        <div class="field"><label class="f" for="sp-k">ประเภท</label><select id="sp-k" class="in"><option>สอนแทน</option><option>สอนชดเชย</option><option>กิจกรรมพิเศษ</option></select></div>
        <div class="field"><label class="f" for="sp-c">ห้อง</label><select id="sp-c" class="in">${S.classes.map(c => `<option value="${c.id}">${esc(c.name)} · ${esc(c.subject)}</option>`).join('')}</select></div>
        <div class="field"><label class="f" for="sp-s">วิชา (ถ้าต่างจากวิชาของห้อง)</label><input id="sp-s" class="in" placeholder="เว้นว่าง = วิชาของห้อง"></div>
        <button class="btn pri" style="width:100%" data-at="specialSave" data-p="${p}">เพิ่มคาบ</button>`, true); }
    case 'specialSave': { const c = cls($('#sp-c').value); const sp = { id: uid('sp'), date: A.date, p: +d.p, classId: c.id, subject: $('#sp-s').value.trim() || c.subject, kind: $('#sp-k').value, teacher: S.me.name };
      S.specials.push(sp); A.sess = c.id + '|' + A.date + '|' + sp.p; save(); closeModal(); toast('เพิ่มคาบพิเศษแล้ว'); return redraw(); }
    case 'delSpecial': { e.stopPropagation(); const sp = S.specials.find(x => x.id === d.id); if (!sp) return;
      S.specials = S.specials.filter(x => x.id !== d.id); const k = sp.classId + '|' + sp.date + '|' + sp.p; delete S.att[k]; delete S.attSaved[k]; if (A.sess === k) A.sess = ''; save(); toast('ลบคาบพิเศษแล้ว'); return redraw(); }
    case 'missClear': A.missMonth = A.missClass = A.missSubject = ''; save(); return redraw();
    case 'missGroup': A.missGroup = d.k; save(); return redraw();
    /* กิจกรรม */
    case 'slot': { const s = A.draft.slots, i = s.indexOf(+d.p); if (i >= 0) s.splice(i, 1); else s.push(+d.p); s.sort((x, y) => x - y); save(); return redraw(); }
    case 'addSid': return addSids($('#ac-sid').value);
    case 'delSid': A.draft.students = A.draft.students.filter(s => s.key !== d.k); save(); return redraw();
    case 'clearSid': A.draft.students = []; save(); return redraw();
    case 'cancelEdit': A.draft = null; save(); return redraw();
    case 'saveAct': { const dr = A.draft;
      if (!dr.name.trim()) return toast('กรุณากรอกชื่อกิจกรรม'); if (!dr.slots.length) return toast('กรุณาเลือกคาบที่ทำกิจกรรม'); if (!dr.students.length) return toast('กรุณาเลือกนักเรียนอย่างน้อย 1 คน');
      const act = { id: dr.id || uid('act'), name: dr.name.trim(), date: dr.date, place: dr.place.trim(), slots: dr.slots.slice(), students: dr.students.slice(), note: dr.note.trim(), by: S.me.name, createdAt: dr.createdAt || new Date().toISOString() };
      S.acts = S.acts.filter(x => x.id !== act.id).concat([act]); const n = impact(act).length;
      A.draft = { name: '', date: act.date, place: '', slots: [], students: [], note: '' }; save(); toast('บันทึกกิจกรรมแล้ว · มีผลกับ ' + n + ' คาบเรียน'); return redraw(); }
    case 'editAct': { const x = S.acts.find(y => y.id === d.id); if (!x) return; A.draft = JSON.parse(JSON.stringify(x)); save(); toast('นำกิจกรรมมาแก้ไข กด “บันทึก” เพื่อยืนยัน'); redraw(); return scrollTo(0, 0); }
    case 'delAct': { const x = S.acts.find(y => y.id === d.id); if (!x) return;
      if (!confirm('ลบกิจกรรม “' + x.name + '”? สถานะ “กิจกรรม” ที่ยังไม่ได้บันทึกการเช็กชื่อจะหายไปด้วย')) return;
      S.acts = S.acts.filter(y => y.id !== d.id); save(); toast('ลบกิจกรรมแล้ว'); return redraw(); }
    case 'printAct': { const x = S.acts.find(y => y.id === d.id); if (x) printDoc('ขออนุญาตนำนักเรียนทำกิจกรรม', actDoc(x)); return; }
  }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-atf]'); if (!t) return;
  const A = S.aui, k = t.dataset.atf;
  if (k === 'date') { A.date = t.value || todayISO(); A.sess = ''; save(); return redraw(); }
  if (['missMonth', 'missClass', 'missSubject'].indexOf(k) >= 0) { A[k] = t.value; save(); return redraw(); }
  if (k === 'dDate') { A.draft.date = t.value || todayISO(); save(); return redraw(); }
  if (k === 'dName') A.draft.name = t.value; if (k === 'dPlace') A.draft.place = t.value; if (k === 'dNote') A.draft.note = t.value;
  save();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-atk="sid"]')) { e.preventDefault(); addSids(e.target.value); } });

setTimeout(examAutoFill, 4000); setInterval(examAutoFill, 60000);
window.EMSAttend = { sessionsOn, missed, impact, view, examAutoFill };   // view = สถานะที่แสดง (scan.js ใช้ตอนติ๊กจากรูปถ่าย)
save(); render();
})();
