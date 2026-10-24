/* EMS — ขึ้นปีการศึกษาใหม่ (เลื่อนชั้นนักเรียน)
   รายชื่อนักเรียน (rooms) มีชุดเดียวใช้ทุกภาค จึงต้องเก็บรายชื่อปีเก่าไว้ก่อนเลื่อนชั้น
   1) เก็บรายชื่อทุกห้องของปีเก่า → rosterArchive/{ปี}_{ห้อง} = { year, room, name, students, fate, who, at } (อ่านอย่างเดียว ห้ามลบ)
   2) เลื่อนชั้นรายห้อง ม.1/x → ม.2/x … (แก้ปลายทางรายห้องได้) · ม.3 และ ม.6 = จบการศึกษา (อยู่ในรายชื่อปีเก่า fate 'grad')
   3) แผนการเรียนรายคน (roomPlans) ย้ายตามห้อง · ล้างครูที่ปรึกษา (เลือกได้) · เพิ่มภาค 1/ปีใหม่ และตั้งเป็นภาคที่ใช้เสมอ
      (ถ้าคงภาค 2/ปีเก่า ภาคนั้นจะแสดงรายชื่อรุ่นใหม่ เพราะรายชื่อปัจจุบันใช้ทุกภาคของปีปัจจุบัน)
   ทำได้ครั้งเดียวต่อปี (มีประวัติ rollovers ของปีนี้ หรือมีรายชื่อปีนี้ใน rosterArchive แล้ว = ปฏิเสธ) และต้องกำลังดูภาคปัจจุบัน
   4) ห้องที่ไม่มีใครย้ายเข้า (ม.1 ม.4) ว่างรอนำเข้ารายชื่อใหม่ · ประวัติการขึ้นปีเก็บใน S.settings.rollovers
   เลขประจำตัวนักเรียนไม่เปลี่ยน — คะแนน เช็กชื่อ พฤติกรรม จิตอาสาของปีเก่ายังผูกกับคนเดิม */
(function () {
  'use strict';
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  const canDo = () => !LIVE || roles().some(r => r === 'admin' || r === 'academic') || ((window.EMS_CONFIG || {}).adminEmails || []).indexOf(String(S.me.email || '').toLowerCase()) >= 0;
  const isSub = id => !!(window.EMSPlans && EMSPlans.isSub && EMSPlans.isSub(id));
  const parse = name => { const m = /^ม\.(\d)\/(\d+)$/.exec(String(name || '').replace(/\s/g, '')); return m ? { g: +m[1], n: +m[2] } : null; };
  const roomByName = n => (S.rooms || []).find(r => String(r.name).replace(/\s/g, '') === n);
  const roomById = id => (S.rooms || []).find(r => r.id === id);
  const main = () => S.classes.filter(c => !isSub(c.id)).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'th', { numeric: true }));
  const yearNow = () => String((S.term || {}).year || '');
  const nextYear = () => String((+yearNow() || 2569) + 1);
  const ready = k => !LIVE || !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready[k]);
  const arch = () => (S.rosterArchive = S.rosterArchive && typeof S.rosterArchive === 'object' ? S.rosterArchive : {});
  const rolls = () => ((S.settings = S.settings || {}).rollovers = Array.isArray(S.settings.rollovers) ? S.settings.rollovers : []);
  const ui = { map: null, from: '', clearHr: true, view: '', confirm: '' };
  /* กำลังดูภาคอื่น (S.viewTerm) → ห้ามขึ้นปี: หลังเปลี่ยนภาคเป็น 1/ปีใหม่ ภาคที่ดูจะกลายเป็น “ปีเก่า” แล้วรายชื่อห้องจะไม่ถูกบันทึก */
  const otherView = () => !!(S.viewTerm && S.viewTerm.year && !(S.term && String(S.viewTerm.year) === String(S.term.year) && String(S.viewTerm.sem) === String(S.term.sem)));
  /* ขึ้นปีนี้ไปแล้ว: มีประวัติ หรือมีรายชื่อปีนี้เก็บไว้แล้ว (ทำซ้ำ = เลื่อนชั้นสองรอบ + เก็บทับรายชื่อปีเก่า) */
  const doneFrom = y => rolls().find(r => r.from === y) || (Object.keys(arch()).some(k => k.indexOf(y + '_') === 0) ? { from: y, to: String(+y + 1), at: '', who: '' } : null);

  /* ปลายทางเริ่มต้น: ชั้นถัดไปห้องเลขเดิม · ม.3/ม.6 จบ · ชื่อห้องที่ไม่ใช่รูปแบบ ม.x/y = คงไว้ */
  function defaults() {
    const m = {};
    main().forEach(c => { const p = parse(c.name); m[c.id] = !p ? 'stay' : (p.g === 3 || p.g === 6) ? 'grad' : 'to:ม.' + (p.g + 1) + '/' + p.n; });
    return m;
  }
  const label = spec => spec === 'grad' ? 'จบการศึกษา' : spec === 'stay' ? 'คงห้องเดิม' : spec.slice(3);
  function plan() {   // คำนวณผลก่อนทำจริง (ไม่แก้ข้อมูล)
    const rows = main().map(c => ({ c, spec: ui.map[c.id] || 'stay' })), into = {}, warn = [];
    rows.forEach(r => { if (r.spec.startsWith('to:')) { const t = r.spec.slice(3); (into[t] = into[t] || []).push(r.c); } });
    Object.entries(into).forEach(([t, src]) => { if (src.length > 1) warn.push(`ห้อง ${t} รับนักเรียนจากหลายห้อง (${src.map(c => c.name).join(', ')}) จะรวมกัน`); });
    rows.forEach(r => { if (!r.spec.startsWith('to:')) return; const t = roomByName(r.spec.slice(3)); if (!t) return;
      const sp = (S.roomPlans || {})[r.c.id], src = roomById(r.c.id);
      if (sp && Object.keys(sp).length && src && (src.plans || []).length && !(t.plans || []).length) warn.push(`${r.c.name} มีแผนการเรียน แต่ห้อง ${t.name} ยังไม่ได้ตั้งแผน — ตั้งแผนของห้อง ${t.name} หลังขึ้นปี`); });
    const targets = new Set(Object.keys(into)), stays = new Set(rows.filter(r => r.spec === 'stay').map(r => r.c.name));
    const empty = main().filter(c => !targets.has(String(c.name).replace(/\s/g, '')) && !stays.has(c.name)).map(c => c.name);
    const create = Object.keys(into).filter(t => !roomByName(t));
    const grad = rows.filter(r => r.spec === 'grad').reduce((a, r) => a + r.c.students.length, 0);
    const move = rows.filter(r => r.spec.startsWith('to:')).reduce((a, r) => a + r.c.students.length, 0);
    return { rows, warn, empty, create, grad, move };
  }

  /* ---------- หน้า ---------- */
  P['a-newyear'] = () => {
    const head = `<div class="top"><div><h1>ขึ้นปีการศึกษาใหม่</h1><p>เก็บรายชื่อปี ${esc(yearNow())} ไว้ แล้วเลื่อนชั้นนักเรียนขึ้นปี ${esc(nextYear())} · ทำครั้งเดียวตอนปิดภาคเรียนที่ 2</p></div></div>`;
    if (!canDo()) return head + '<div class="card"><div class="empty">เฉพาะแอดมินหรือฝ่ายวิชาการ</div></div>';
    if (otherView()) return head + `<div class="card"><div class="empty">กำลังดูภาคเรียนที่ ${esc(S.viewTerm.sem)}/${esc(S.viewTerm.year)} — กลับภาคปัจจุบันก่อนขึ้นปีการศึกษาใหม่<br><button class="btn pri" style="margin-top:10px" data-tm="back">กลับภาคปัจจุบัน</button></div></div>`;
    if (LIVE && S.view !== 'admin') return head + '<div class="card"><div class="empty">สลับมุมมองเป็น “ผู้ดูแลระบบ / ฝ่ายงาน” ก่อน เพื่อให้เห็นทุกห้อง</div></div>';
    if (!ready('rosterArchive') || !ready('roster')) return head + '<div class="card"><div class="empty">กำลังโหลดข้อมูลรายชื่อ…</div></div>';
    if (!ui.map || ui.from !== yearNow()) { ui.map = defaults(); ui.from = yearNow(); }
    const done = doneFrom(yearNow()), pl = plan(), total = main().reduce((a, c) => a + c.students.length, 0);
    const targetsFor = c => { const p = parse(c.name), names = (S.rooms || []).filter(r => !r.parent && (!p || (parse(r.name) || {}).g === p.g + 1)).map(r => r.name);
      const def = p && p.g < 6 && p.g !== 3 ? 'ม.' + (p.g + 1) + '/' + p.n : ''; if (def && names.indexOf(def) < 0) names.push(def);
      return names.sort((a, b) => a.localeCompare(b, 'th', { numeric: true })); };
    let h = head;
    const last = rolls().filter(r => r.to === yearNow()).pop(), semOk = String((S.term || {}).sem) !== '1';
    if (last) h += `<div class="notice" style="background:var(--ok-soft)"><b>ขึ้นปีการศึกษา ${esc(last.to)} แล้ว</b> เมื่อ ${esc(new Date(last.at).toLocaleString('th-TH'))} โดย ${esc(last.who)} · เลื่อนชั้น ${esc(last.moved)} คน · จบ ${esc(last.grad)} คน
      <div style="margin-top:6px">ขั้นต่อไป: นำเข้ารายชื่อ ม.1 และ ม.4 · จัดห้องเรียนให้ได้ตามเกณฑ์ · จัดครูที่ปรึกษา · ตั้งแผนการเรียนของห้อง <button class="btn sm" data-act="go" data-p="a-students">ไปหน้าฐานนักเรียน</button> <button class="btn sm" data-act="go" data-p="a-roomsort">จัดห้องเรียน</button></div></div>`;
    if (!semOk) return h + `<div class="card"><div class="empty">ขึ้นปีการศึกษาใหม่ได้เมื่อภาคเรียนที่กำลังใช้เป็นภาคที่ 2 (ตอนนี้ภาค ${esc((S.term || {}).sem)}/${esc(yearNow())})</div></div>` + archiveCard();
    if (done) return h + `<div class="notice" style="background:var(--warn-soft)"><b>ขึ้นปี ${esc(done.from)} → ${esc(done.to)} ไปแล้ว</b>${done.at ? ` เมื่อ ${esc(new Date(done.at).toLocaleString('th-TH'))} โดย ${esc(done.who)}` : ' (มีรายชื่อปี ' + esc(done.from) + ' เก็บไว้แล้ว)'} · ทำซ้ำไม่ได้ เพราะนักเรียนจะถูกเลื่อนชั้นอีกรอบ — ย้ายห้องรายคนที่หน้าฐานนักเรียน</div>` + archiveCard();
    const lb = (S.settings || {}).lastBackup, fresh = lb && lb.at && Date.now() - new Date(lb.at).getTime() < 864e5;
    h += `<div class="notice" style="background:var(--warn-soft)"><b>ก่อนเริ่ม</b>
      <div class="small" style="margin-top:4px">• ทำนอกเวลาที่ครูใช้งาน (เช่น หลังเลิกเรียน/วันหยุด) และแจ้งทุกคนให้ปิดแอป EMS ไว้ระหว่างนี้ · เสร็จแล้วให้ทุกคน<b>รีเฟรชหน้า</b>ก่อนใช้ต่อ (เครื่องที่เปิดค้างอาจบันทึกรายชื่อชุดเก่าทับ)</div>
      <div class="small">• ดาวน์โหลดไฟล์สำรองทั้งหมดที่หน้าสำรองข้อมูล (ใช้กู้คืนได้) · สำรองล่าสุด: ${lb && lb.at ? esc(new Date(lb.at).toLocaleString('th-TH')) + ' โดย ' + esc(lb.by || '') : 'ยังไม่เคยสำรอง'} ${fresh ? '<span class="chip ok">ภายใน 24 ชม.</span>' : '<span class="chip warn">ควรสำรองใหม่</span>'}
        <button class="btn sm" data-act="go" data-p="a-drive">ไปหน้าสำรองข้อมูล</button></div></div>`;
    h += `<div class="card"><h2>1. ตรวจห้องปลายทาง</h2><p class="muted small">ทั้งหมด ${main().length} ห้อง · ${total} คน · ปลายทางเริ่มต้น = ชั้นถัดไปห้องเลขเดิม เปลี่ยนรายห้องได้ · นักเรียนซ้ำชั้นหรือย้ายห้องรายคน ใช้หน้าฐานนักเรียนหลังขึ้นปี</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>ห้องปี ${esc(yearNow())}</th><th style="text-align:right">นักเรียน</th><th>ปี ${esc(nextYear())} ไปที่</th></tr></thead><tbody>
      ${pl.rows.map(({ c, spec }) => `<tr><td><b>${esc(c.name)}</b></td><td style="text-align:right">${c.students.length}</td><td>
        <select class="in" style="width:auto;min-width:170px" data-nyf="map" data-id="${esc(c.id)}" aria-label="ปลายทาง ${esc(c.name)}">
          ${targetsFor(c).map(n => `<option value="to:${esc(n)}" ${spec === 'to:' + n ? 'selected' : ''}>→ ${esc(n)}${roomByName(n) ? '' : ' (สร้างห้องใหม่)'}</option>`).join('')}
          <option value="grad" ${spec === 'grad' ? 'selected' : ''}>จบการศึกษา</option><option value="stay" ${spec === 'stay' ? 'selected' : ''}>คงห้องเดิม (ไม่เลื่อน)</option></select></td></tr>`).join('')}
      </tbody></table></div></div>`;
    h += `<div class="card"><h2>2. สรุปก่อนยืนยัน</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <span class="chip info">เลื่อนชั้น ${pl.move} คน</span><span class="chip ok">จบการศึกษา ${pl.grad} คน</span>${pl.create.length ? `<span class="chip warn">สร้างห้องใหม่ ${pl.create.length} ห้อง</span>` : ''}</div>
      ${pl.empty.length ? `<p class="small"><b>ห้องที่จะว่าง รอนำเข้ารายชื่อใหม่:</b> ${pl.empty.map(esc).join(', ')}</p>` : ''}
      ${projected(pl)}
      ${pl.create.length ? `<p class="small"><b>ห้องที่จะสร้าง:</b> ${pl.create.map(esc).join(', ')}</p>` : ''}
      ${pl.warn.map(w => `<div class="notice" style="background:var(--warn-soft);margin:6px 0">${esc(w)}</div>`).join('')}
      <label class="row" style="border:0;cursor:pointer;gap:8px"><input type="checkbox" data-nyf="clearHr" ${ui.clearHr ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--brand)"><span>ล้างครูที่ปรึกษาทุกห้อง (จัดใหม่ภายหลัง)</span></label>
      <div class="small" style="margin:6px 0">ภาคเรียนที่กำลังใช้จะเปลี่ยนเป็น <b>ภาคเรียนที่ 1/${esc(nextYear())}</b> (เพิ่มให้ถ้ายังไม่มี) · ภาคของปี ${esc(yearNow())} ยังเปิดดูย้อนหลังได้ด้วยรายชื่อตอนสิ้นปี</div>
      <div class="notice" style="margin:10px 0">ระบบจะเก็บรายชื่อปี ${esc(yearNow())} ไว้ในระบบ (ดูได้ด้านล่าง) และดาวน์โหลดไฟล์อ้างอิงรายชื่อทุกห้อง (.json) ให้อัตโนมัติ — ไฟล์นี้ใช้ตรวจ/แก้ด้วยมือ กู้คืนผ่านหน้าสำรองข้อมูลไม่ได้ ใช้ไฟล์สำรองทั้งหมดสำหรับกู้คืน</div>
      <div class="field"><label class="f" for="ny-c">พิมพ์ <b>${esc(nextYear())}</b> เพื่อยืนยัน</label><input id="ny-c" class="in" style="max-width:160px" inputmode="numeric" value="${esc(ui.confirm)}" data-nyf="confirm"></div>
      <button class="btn pri" data-ny="run">ขึ้นปีการศึกษา ${esc(nextYear())}</button></div>`;
    h += archiveCard();
    return h;
  };

  /* จำนวนนักเรียนแต่ละห้องหลังเลื่อนชั้น เทียบเกณฑ์ (ขาด/เกินได้ จัดต่อที่หน้า “จัดห้องเรียน”) */
  function projected(pl) {
    const m = +((S.settings || {}).maxStudents) || 40, cnt = {};
    pl.rows.forEach(({ c, spec }) => { const t = spec === 'stay' ? String(c.name).replace(/\s/g, '') : spec.startsWith('to:') ? spec.slice(3) : ''; if (t) cnt[t] = (cnt[t] || 0) + c.students.length; });
    const names = Object.keys(cnt).filter(n => cnt[n] > 0).sort((a, b) => a.localeCompare(b, 'th', { numeric: true })); if (!names.length) return '';
    const off = names.filter(n => cnt[n] !== m).length;
    return `<details class="small" style="margin:6px 0"><summary><b>จำนวนนักเรียนหลังเลื่อนชั้น</b> (เกณฑ์ ${m} คน/ห้อง${off ? ` · ไม่ตรงเกณฑ์ ${off} ห้อง` : ''})</summary>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${names.map(n => `<span class="chip ${cnt[n] === m ? 'ok' : cnt[n] > m ? 'bad' : 'warn'}">${esc(n)} ${cnt[n]}</span>`).join('')}</div>
      <div class="muted" style="margin-top:6px">ห้องที่ขาดหรือเกินเกณฑ์ ขึ้นปีได้ตามปกติ แล้วไปกระจายนักเรียนต่อที่หน้า “จัดห้องเรียน”</div></details>`;
  }

  /* ---------- รายชื่อปีเก่า ---------- */
  function archiveCard() {
    const A = arch(), years = [...new Set(Object.values(A).map(x => String(x.year)))].sort().reverse();
    if (!years.length) return `<div class="card"><h2>รายชื่อปีการศึกษาเก่า</h2><div class="empty">ยังไม่มี — จะมีหลังขึ้นปีครั้งแรก</div></div>`;
    const y = ui.view && years.indexOf(ui.view) >= 0 ? ui.view : years[0], rows = Object.values(A).filter(x => String(x.year) === y).sort((a, b) => String(a.name).localeCompare(String(b.name), 'th', { numeric: true }));
    return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><h2 style="margin:0" class="grow">รายชื่อปีการศึกษาเก่า</h2>
      <select class="in" style="width:auto" data-nyf="view" aria-label="ปีการศึกษา">${years.map(v => `<option ${v === y ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      <button class="btn sm" data-ny="csv" data-y="${esc(y)}">${ic('down')}ดาวน์โหลด CSV</button></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th style="text-align:right">นักเรียน</th><th>ผล</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${esc(r.name)}</b></td><td style="text-align:right">${(r.students || []).length}</td><td>${r.fate === 'grad' ? '<span class="chip ok">จบการศึกษา</span>' : esc(label(r.fate || 'stay'))}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small" style="margin-top:6px">เก็บโดย ${esc((rows[0] || {}).who || '')} · ใช้อ้างอิงคะแนนและเวลาเรียนย้อนหลัง</p></div>`;
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
  function csvYear(y) {
    const out = [['ปีการศึกษา', 'ห้อง', 'เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล', 'ผล']];
    Object.values(arch()).filter(x => String(x.year) === y).sort((a, b) => String(a.name).localeCompare(String(b.name), 'th', { numeric: true }))
      .forEach(r => (r.students || []).slice().sort((a, b) => (a.no || 0) - (b.no || 0)).forEach(s => out.push([y, r.name, s.no, s.sid || '', s.name, r.fate === 'grad' ? 'จบการศึกษา' : label(r.fate || 'stay')])));
    download('รายชื่อนักเรียน_ปี' + y + '.csv', '﻿' + out.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  /* ---------- ทำจริง ---------- */
  async function run() {
    const from = yearNow(), to = nextYear();
    if (ui.confirm !== to) return toast('พิมพ์ ' + to + ' ในช่องยืนยันก่อน');
    /* ถามเหตุผลครั้งเดียวก่อนเริ่ม (ตรวจเงื่อนไขทั้งหมดหลังรอ) · บันทึกประวัติสรุปหนึ่งรายการเมื่อเสร็จ */
    const why = window.EMSAudit ? await EMSAudit.batch('ขึ้นปีการศึกษา ' + from + ' → ' + to, 'เลื่อนชั้นนักเรียนทุกห้อง', 'ขึ้นปีการศึกษาใหม่') : () => {};
    if (!why) return;
    if (yearNow() !== from || ui.confirm !== to) return toast('ข้อมูลภาคเรียนเปลี่ยนระหว่างรอ ลองใหม่');
    if (String((S.term || {}).sem) === '1') return toast('ขึ้นปีใหม่ได้เมื่อภาคที่ใช้เป็นภาคที่ 2');
    if (!ready('rosterArchive') || !ready('roster')) return toast('ข้อมูลยังโหลดไม่ครบ ลองใหม่อีกครั้ง');
    if (otherView()) return toast('กำลังดูภาคอื่น — กลับภาคปัจจุบันก่อนขึ้นปีการศึกษาใหม่');
    S.viewTerm = null;                                     // ดูภาคปัจจุบันอยู่แล้ว (ค่าเท่ากัน) — ล้าง ไม่ให้กลายเป็น “ปีเก่า” หลังเปลี่ยนภาค
    if (doneFrom(from)) { redraw(); return toast('ขึ้นปี ' + from + ' ไปแล้ว — ทำซ้ำไม่ได้'); }
    /* ตรวจก่อนแก้อะไร: หลังเปลี่ยนเป็นภาค 1/ปีใหม่ รายชื่อห้องต้องยังถูกบันทึกได้ (ไม่ใช่ “ดูปีเก่า”) */
    if (LIVE && window.EMSCloud && EMSCloud.rosterOk) { const keep = S.term; S.term = { year: to, sem: '1' }; const ok = EMSCloud.rosterOk(); S.term = keep;
      if (!ok) return toast('บัญชีนี้/มุมมองนี้บันทึกรายชื่อห้องไม่ได้ — ยกเลิกการขึ้นปี'); }
    const rooms = main(), snap = {}, at = new Date().toISOString(), who = S.me.name;
    rooms.forEach(c => { snap[c.id] = c.students.map(s => Object.assign({}, s)); });
    download('สำรองรายชื่อก่อนขึ้นปี_' + from + '.json', JSON.stringify({ note: 'ไฟล์อ้างอิงรายชื่อก่อนขึ้นปี (กู้ด้วยมือ) — ไม่ใช่ไฟล์กู้คืนของหน้าสำรองข้อมูล', from, to, at, who, rooms: S.rooms, roster: rooms.map(c => ({ id: c.id, name: c.name, students: snap[c.id] })), roomPlans: S.roomPlans || {}, homeroom: S.homeroom || {} }, null, 1), 'application/json');
    /* 1) เก็บรายชื่อปีเก่า */
    const A = arch();
    /* cfg = แผนของห้องและห้องย่อยตอนสิ้นปี (ห้องปีใหม่อาจตั้งแผนต่างไป) — เก็บไว้อ้างอิง หน้าจอดูปีเก่ายังใช้แผนของห้องปัจจุบัน */
    const cfgOf = id => { const r = roomById(id) || {}, subs = (S.rooms || []).filter(x => x.parent === id).map(x => ({ id: x.id, name: x.name, plan: x.plan || '', planName: x.planName || '' }));
      return (r.plans || []).length || subs.length ? { plans: (r.plans || []).map(p => Object.assign({}, p)), subs } : null; };
    rooms.forEach(c => { A[from + '_' + c.id] = { year: from, room: c.id, name: c.name, students: snap[c.id], fate: ui.map[c.id] || 'stay', hr: [].concat((S.homeroom || {})[c.id] || []), plans: (S.roomPlans || {})[c.id] || null, cfg: cfgOf(c.id), who, at }; });
    /* 2) ห้องปลายทาง (สร้างถ้ายังไม่มี) */
    const idOf = name => { let r = roomByName(name); if (!r) { const p = parse(name), id = p && !roomById('r' + p.g + '-' + p.n) ? 'r' + p.g + '-' + p.n : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        r = { id, name, count: 0 }; S.rooms.push(r); S.classes.push({ id, name, subject: '', students: [] }); } return r.id; };
    const next = {}, plansOld = S.roomPlans || {}, plansNew = {};
    rooms.forEach(c => { next[c.id] = next[c.id] || []; });
    rooms.forEach(c => { const spec = ui.map[c.id] || 'stay';
      if (spec === 'stay') { next[c.id] = next[c.id].concat(snap[c.id]); if (plansOld[c.id]) plansNew[c.id] = Object.assign({}, plansNew[c.id], plansOld[c.id]); }
      else if (spec.startsWith('to:')) { const t = idOf(spec.slice(3)); next[t] = (next[t] || []).concat(snap[c.id]); if (plansOld[c.id]) plansNew[t] = Object.assign({}, plansNew[t], plansOld[c.id]); } });
    /* 3) เขียนรายชื่อใหม่ทุกห้อง (เรียงเลขที่เดิม) */
    S.classes.forEach(c => { if (isSub(c.id) || !(c.id in next)) return; c.students = next[c.id].slice().sort((a, b) => (a.no || 999) - (b.no || 999)); const r = roomById(c.id); if (r) r.count = c.students.length; });
    /* แผนรายคน: ห้องที่ไม่มีแผนแล้วตั้งเป็นว่าง (ลบเอกสารไม่ได้ตาม rules) */
    const rp = S.roomPlans = S.roomPlans || {}; Object.keys(rp).forEach(k => { rp[k] = plansNew[k] || {}; }); Object.keys(plansNew).forEach(k => { rp[k] = plansNew[k]; });
    /* แผนหลักสูตร (curriculum.js: cur = 'ปีที่เข้า/แผน') ย้ายตามนักเรียน — ห้องปลายทางได้แผนของห้องต้นทาง (แผนย่อยจับคู่ด้วยตัวย่อ)
       ห้อง ม.1/ม.4 ที่ไม่มีใครย้ายเข้า = รับนักเรียนใหม่ → แผนเดิมของห้องนั้น เปลี่ยนเป็นรุ่นปีใหม่ (ตรวจได้ที่หน้า หลักสูตร / แผนการเรียน) */
    const curOld = {}, curNew = {}, curLost = new Set(), shiftCur = c => { const m = /^(\d{4})\/(.+)$/.exec(String(c || '')); return m ? to + '/' + m[2] : ''; };
    (S.rooms || []).forEach(r => { if (!r.parent) curOld[r.id] = { cur: r.cur || '', plans: (r.plans || []).map(p => ({ key: p.key, name: p.name || '', cur: p.cur || '' })) }; });
    rooms.forEach(c => { const spec = ui.map[c.id] || 'stay', t = spec === 'stay' ? c.id : spec.startsWith('to:') ? idOf(spec.slice(3)) : '';
      if (t && !curNew[t] && curOld[c.id]) curNew[t] = curOld[c.id]; });
    (S.rooms || []).forEach(r => { if (r.parent) return; const o = curOld[r.id] || { cur: '', plans: [] }, p = parse(r.name);
      const src = curNew[r.id] || (p && (p.g === 1 || p.g === 4) ? { cur: shiftCur(o.cur), plans: o.plans.map(x => ({ key: x.key, cur: shiftCur(x.cur) })) } : null);
      if (!src && (ui.map[r.id] || 'stay') === 'stay') return;                       // ไม่มีใครย้ายเข้าและไม่ใช่ห้องรับนักเรียนใหม่ = คงเดิม · ห้องที่จบแล้วว่าง = ล้างแผน
      if (!src) { delete r.cur; (r.plans || []).forEach(pl => { delete pl.cur; }); return; }
      /* โครงแผนย่อยของห้องปลายทางเป็นของห้องนั้น (ไม่ย้ายตาม) — จับคู่แผนด้วยตัวย่อ แล้วชื่อแผน · ต้นทางแผนเดียว = ใช้กับทุกแผนย่อย
         ปลายทางไม่แบ่งแผนแต่ต้นทางแบ่ง = ใช้ได้เมื่อทุกแผนเป็นหลักสูตรเดียวกัน · จับคู่ไม่ได้ = นับไว้แจ้งให้ไปตั้งที่หน้า หลักสูตร / แผนการเรียน */
      if ((r.plans || []).length) { delete r.cur; r.plans.forEach(pl => { const s = src.plans.find(x => x.key === pl.key) || src.plans.find(x => x.name && x.name === pl.name), v = (s && s.cur) || src.cur || '';
          if (v) pl.cur = v; else { delete pl.cur; if (src.plans.some(x => x.cur)) curLost.add(r.name); } }); }
      else { const one = src.cur || (src.plans.length && src.plans.every(x => x.cur && x.cur === src.plans[0].cur) ? src.plans[0].cur : '');
        if (one) r.cur = one; else { delete r.cur; if (src.plans.some(x => x.cur)) curLost.add(r.name); } } });
    if (ui.clearHr) S.homeroom = {};
    S.terms = S.terms || []; if (!S.terms.some(x => String(x.year) === to && String(x.sem) === '1')) S.terms.push({ year: to, sem: '1', open: '', close: '', minAtt: 80, lock: 'auto' });
    S.term = { year: to, sem: '1' }; S.viewTerm = null;      // เช็กชื่อของภาคเดิมไม่ถูกเขียนลงภาคใหม่ (cloud.js tkBound) จนกว่าจะฟังภาคใหม่
    const cnt = { rooms: rooms.length, moved: rooms.filter(c => (ui.map[c.id] || '').startsWith('to:')).reduce((a, c) => a + snap[c.id].length, 0), grad: rooms.filter(c => ui.map[c.id] === 'grad').reduce((a, c) => a + snap[c.id].length, 0) };
    rolls().push(Object.assign({ from, to, who, at }, cnt));
    save(); why(cnt.rooms + ' ห้อง ปี ' + from, 'เลื่อนชั้น ' + cnt.moved + ' คน · จบ ' + cnt.grad + ' คน'); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush();
    ui.confirm = ''; ui.map = null; ui.view = from;
    toast(`ขึ้นปี ${to} แล้ว · เลื่อนชั้น ${cnt.moved} คน · จบ ${cnt.grad} คน — ต่อไปนำเข้ารายชื่อ ม.1 และ ม.4${curLost.size ? ' · ห้องที่ต้องตั้งแผนหลักสูตรใหม่ ' + curLost.size + ' ห้อง (หน้า หลักสูตร / แผนการเรียน)' : ''}`); redraw();
  }

  document.addEventListener('click', e => { const t = e.target.closest('[data-ny]'); if (!t) return;
    if (t.dataset.ny === 'run') return run(); if (t.dataset.ny === 'csv') return csvYear(t.dataset.y); });
  document.addEventListener('change', e => { const t = e.target.closest('[data-nyf]'); if (!t) return; const k = t.dataset.nyf;
    if (k === 'map') ui.map[t.dataset.id] = t.value; else if (k === 'clearHr') ui[k] = t.checked; else ui[k] = t.value.trim();
    if (k !== 'confirm') redraw(); });
  document.addEventListener('input', e => { const t = e.target.closest('[data-nyf="confirm"]'); if (t) ui.confirm = t.value.trim(); });

  /* เมนู: ข้อมูลหลัก (แอดมิน/วิชาการเท่านั้น) */
  const N = window.EMSNav;
  if (N) {
    const grp = (N.NAVG.admin || []).find(x => x[0] === 'ข้อมูลหลัก'); if (grp && !grp[1].some(x => x[0] === 'a-newyear')) grp[1].push(['a-newyear', 'ขึ้นปีการศึกษาใหม่', 'cal']);
    const hideFor = fn => function () { const g = (N.NAVG.admin || []).find(x => x[0] === 'ข้อมูลหลัก'), i = g ? g[1].findIndex(x => x[0] === 'a-newyear') : -1;
      let it = null; try { if (i >= 0 && !canDo()) it = g[1].splice(i, 1)[0]; } catch (x) {}
      try { return fn.apply(this, arguments); } finally { if (it) g[1].splice(i, 0, it); } };
    if (window.renderChrome) window.renderChrome = hideFor(window.renderChrome);
    if (window.openMore) window.openMore = hideFor(window.openMore);
    (window.EMSNavHidden = window.EMSNavHidden || {})['a-newyear'] = () => !canDo();      // ค้นหาเมนู (Ctrl K)
  }
  window.EMSNewYear = { plan: () => plan(), arch };
})();
