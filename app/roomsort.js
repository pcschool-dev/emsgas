/* EMS — จัดห้องเรียน (กระจายนักเรียนให้แต่ละห้องได้ตามเกณฑ์ เช่น ห้องละ 40 คน)
   ใช้หลังขึ้นปีการศึกษาใหม่หรือก่อนเปิดภาค: ระหว่างจัด บางห้องขาด บางห้องเกินได้ ระบบไม่บล็อก แค่แสดงสีเทียบเกณฑ์
   - เลือกระดับชั้น → เห็นทุกห้องหลักของชั้นนั้นพร้อมจำนวน (เขียว = ตามเกณฑ์ · เหลือง = ขาด · แดง = เกิน)
   - ติ๊กนักเรียนได้หลายคนจากหลายห้อง แล้ว “ย้ายไป” ห้องเดียวกันทีเดียว · แผนการเรียนรายคน (roomPlans) ย้ายตามคน
   - เรียงเลขที่ใหม่ทั้งชั้น (ตามชื่อ / ชายก่อนหญิง / ตามเลขประจำตัว) · บันทึก “จัดห้องเสร็จแล้ว” ต่อชั้น (ใคร เมื่อไร จำนวนแต่ละห้อง)
   ห้องย่อยตามแผนไม่แสดง (คำนวณจากห้องหลัก) · ดูภาคของปีเก่าอยู่ = ทำไม่ได้ · คะแนนที่บันทึกในห้องเดิมไม่ย้ายตาม */
(function () {
  'use strict';
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  const canDo = () => !LIVE || roles().some(r => r === 'admin' || r === 'academic') || ((window.EMS_CONFIG || {}).adminEmails || []).indexOf(String(S.me.email || '').toLowerCase()) >= 0;
  const isSub = id => !!(window.EMSPlans && EMSPlans.isSub && EMSPlans.isSub(id));
  const parse = name => { const m = /^ม\.(\d)\/(\d+)$/.exec(String(name || '').replace(/\s/g, '')); return m ? { g: +m[1], n: +m[2] } : null; };
  const maxN = () => +((S.settings || {}).maxStudents) || 40;
  const yearNow = () => String((S.term || {}).year || '');
  const otherView = () => !!(S.viewTerm && S.term && (String(S.viewTerm.year) !== String(S.term.year) || String(S.viewTerm.sem) !== String(S.term.sem)));
  const roomsOf = g => S.classes.filter(c => !isSub(c.id) && (parse(c.name) || {}).g === g).sort((a, b) => parse(a.name).n - parse(b.name).n);
  const grades = () => [1, 2, 3, 4, 5, 6].filter(g => roomsOf(g).length);
  const sk = s => String(s.sid || s.id);
  const MALE = /^(เด็กชาย|ด\.ช\.|นาย|ช$)/;
  const isMale = s => s.sex ? /^(ช|ชาย|m|male|1)$/i.test(String(s.sex)) : MALE.test(String(s.prefix || s.name || ''));
  const store = () => { const st = (S.settings = S.settings || {}); st.roomSort = st.roomSort && typeof st.roomSort === 'object' ? st.roomSort : {}; return (st.roomSort[yearNow()] = st.roomSort[yearNow()] || {}); };
  const ui = { g: 0, sel: {}, to: '', order: 'name', q: '', why: {} };
  /* ถามเหตุผลครั้งเดียวต่อการจัดห้องของชั้นนั้น (ในครั้งที่เปิดแอปนี้) · แต่ละการย้าย/เรียงเลขที่บันทึกประวัติสรุปหนึ่งรายการ */
  async function why(g) {
    if (!window.EMSAudit) return () => {};
    if (!ui.why[g]) { const c = await EMSAudit.batch('จัดห้องเรียน ม.' + g, 'ถามครั้งเดียว ใช้กับทุกการย้าย/เรียงเลขที่ของชั้นนี้', 'จัดห้องเรียน'); if (!c) return null; ui.why[g] = c; }
    return ui.why[g];
  }

  function tone(n) { const m = maxN(); return n === m ? 'ok' : n > m ? 'bad' : 'warn'; }
  async function moveTo(toId) {
    let to = S.classes.find(c => c.id === toId); if (!to) return toast('เลือกห้องปลายทาง');
    const picked = Object.keys(ui.sel).filter(k => ui.sel[k]); if (!picked.length) return toast('ติ๊กเลือกนักเรียนก่อน');
    const ok = await why(ui.g); if (!ok) return;
    to = S.classes.find(c => c.id === toId); if (!to) return toast('เลือกห้องปลายทาง');      // หลังรอเหตุผล = ห้อง/รายชื่อจาก S ปัจจุบัน
    const rp = S.roomPlans = S.roomPlans || {}; let n = 0, planMoved = 0; const names = [];
    picked.forEach(key => { const [fromId, sid] = key.split('|'); if (fromId === toId) return;
      const from = S.classes.find(c => c.id === fromId), s = from && from.students.find(x => x.id === sid); if (!s) return;
      from.students = from.students.filter(x => x.id !== s.id);
      s.no = to.students.reduce((m, x) => Math.max(m, x.no || 0), 0) + 1; to.students = to.students.concat([s]);
      const pk = sk(s), fp = rp[fromId]; if (fp && fp[pk]) { const nf = Object.assign({}, fp); const v = nf[pk]; delete nf[pk]; rp[fromId] = nf; rp[toId] = Object.assign({}, rp[toId], { [pk]: v }); planMoved++; }
      names.push(s.name + ' (' + from.name + ')'); n++; });
    [...new Set(picked.map(k => k.split('|')[0]).concat([toId]))].forEach(id => { const r = (S.rooms || []).find(x => x.id === id), c = S.classes.find(x => x.id === id); if (r && c) r.count = c.students.length; });
    ui.sel = {}; save(); if (n) ok(names.join(', '), 'ย้าย ' + n + ' คนไป ' + to.name); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); if (window.EMSPlans && EMSPlans.apply) EMSPlans.apply();
    const toRoom = (S.rooms || []).find(r => r.id === toId);
    toast(`ย้าย ${n} คนไป ${to.name} แล้ว` + (planMoved && toRoom && !(toRoom.plans || []).length ? ` · ${to.name} ยังไม่ได้ตั้งแผนการเรียน` : '')); redraw();
  }
  async function renumber(g) {
    const ok = await why(g); if (!ok) return;
    const ord = ui.order, cmp = (a, b) => ord === 'sid' ? String(a.sid || '').localeCompare(String(b.sid || ''), 'th', { numeric: true })
      : ord === 'sex' ? (isMale(b) - isMale(a)) || String(a.name).localeCompare(String(b.name), 'th') : String(a.name).localeCompare(String(b.name), 'th');
    roomsOf(g).forEach(c => { c.students = c.students.slice().sort(cmp).map((s, i) => Object.assign(s, { no: i + 1 })); });
    save(); ok('เลขที่เดิม', 'เรียงเลขที่ใหม่ทั้งชั้น ม.' + g + ' (' + ({ name: 'ตามชื่อ', sex: 'ชายก่อนหญิง', sid: 'ตามเลขประจำตัว' }[ord] || ord) + ')'); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); toast('เรียงเลขที่ใหม่ทั้งชั้น ม.' + g + ' แล้ว'); redraw();
  }

  /* ติ๊กเลือก: อัปเดตเฉพาะตัวนับ ไม่วาดใหม่ (รายชื่อในการ์ดไม่เด้งกลับขึ้นบน) */
  function syncSel() { const n = Object.keys(ui.sel).filter(k => ui.sel[k]).length, l = document.getElementById('rs-n'), b = document.getElementById('rs-mv');
    if (l) l.textContent = n ? 'เลือก ' + n + ' คน' : 'ติ๊กนักเรียนเพื่อย้าย'; if (b) b.disabled = !n; }
  P['a-roomsort'] = () => {
    const head = `<div class="top"><div><h1>จัดห้องเรียน</h1><p>กระจายนักเรียนให้แต่ละห้องได้ตามเกณฑ์ ${maxN()} คน · ระหว่างจัดห้องขาดหรือเกินได้ ระบบไม่บล็อก</p></div></div>`;
    if (!canDo()) return head + '<div class="card"><div class="empty">เฉพาะแอดมินหรือฝ่ายวิชาการ</div></div>';
    if (otherView()) return head + '<div class="card"><div class="empty">กำลังดูภาคเรียนอื่น — กลับภาคปัจจุบันก่อนจัดห้อง <button class="btn sm pri" data-tm="back">กลับภาคปัจจุบัน</button></div></div>';
    if (LIVE && S.view !== 'admin') return head + '<div class="card"><div class="empty">สลับมุมมองเป็น “ผู้ดูแลระบบ / ฝ่ายงาน” ก่อน เพื่อให้เห็นทุกห้อง</div></div>';
    const gs = grades(); if (!gs.length) return head + '<div class="card"><div class="empty">ยังไม่มีห้องรูปแบบ ม.x/y</div></div>';
    if (gs.indexOf(ui.g) < 0) ui.g = gs[0];
    const rooms = roomsOf(ui.g), m = maxN(), total = rooms.reduce((a, c) => a + c.students.length, 0), cap = rooms.length * m;
    const over = rooms.filter(c => c.students.length > m), under = rooms.filter(c => c.students.length < m);
    const done = store()[ui.g], sel = Object.keys(ui.sel).filter(k => ui.sel[k] && k.split('|')[0] && rooms.some(c => c.id === k.split('|')[0])).length;
    const q = ui.q, hit = s => !q || (s.name + ' ' + (s.sid || '')).indexOf(q) >= 0;
    let h = head + `<div class="card" style="position:sticky;top:var(--topbar-h,0);z-index:5">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <div class="pills" style="margin:0">${gs.map(g => `<button class="pill" aria-pressed="${g === ui.g}" data-rs="g" data-g="${g}">ม.${g}${store()[g] ? ' ✓' : ''}</button>`).join('')}</div>
        <label class="small muted" style="display:flex;gap:6px;align-items:center">เกณฑ์ <input class="in" style="width:70px" inputmode="numeric" value="${m}" data-rsf="max" aria-label="เกณฑ์นักเรียนต่อห้อง"> คน/ห้อง</label>
        <input class="in" style="width:200px" placeholder="ค้นหาชื่อ / เลขประจำตัว" value="${esc(q)}" data-rsf="q" aria-label="ค้นหานักเรียน"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        <span class="chip">ม.${ui.g} · ${rooms.length} ห้อง · ${total} คน · เฉลี่ย ${rooms.length ? (total / rooms.length).toFixed(1) : 0} คน/ห้อง</span>
        ${over.length ? `<span class="chip bad">เกินเกณฑ์ ${over.length} ห้อง (${over.reduce((a, c) => a + c.students.length - m, 0)} คน)</span>` : ''}
        ${under.length ? `<span class="chip warn">ขาด ${under.length} ห้อง (${under.reduce((a, c) => a + m - c.students.length, 0)} ที่)</span>` : ''}
        ${!over.length && !under.length ? '<span class="chip ok">ทุกห้องตามเกณฑ์</span>' : ''}
        ${total > cap ? `<span class="chip bad">นักเรียนเกินที่นั่งรวม ${total - cap} คน — ต้องเพิ่มห้องหรือปรับเกณฑ์</span>` : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
        <b id="rs-n">${sel ? `เลือก ${sel} คน` : 'ติ๊กนักเรียนเพื่อย้าย'}</b>
        <select class="in" style="width:auto" data-rsf="to" aria-label="ย้ายไปห้อง"><option value="">ย้ายไปห้อง…</option>${rooms.map(c => `<option value="${esc(c.id)}" ${ui.to === c.id ? 'selected' : ''}>${esc(c.name)} (${c.students.length})</option>`).join('')}</select>
        <button class="btn pri" id="rs-mv" data-rs="move" ${sel ? '' : 'disabled'}>ย้าย</button>${sel ? '<button class="btn" data-rs="clear">ล้างที่เลือก</button>' : ''}
        <span class="grow"></span>
        <select class="in" style="width:auto" data-rsf="order" aria-label="วิธีเรียงเลขที่"><option value="name" ${ui.order === 'name' ? 'selected' : ''}>เรียงตามชื่อ</option><option value="sex" ${ui.order === 'sex' ? 'selected' : ''}>ชายก่อนหญิง แล้วตามชื่อ</option><option value="sid" ${ui.order === 'sid' ? 'selected' : ''}>ตามเลขประจำตัว</option></select>
        <button class="btn" data-rs="renum">เรียงเลขที่ใหม่ทั้งชั้น</button></div></div>`;
    h += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;margin-top:12px">${rooms.map(c => { const n = c.students.length, plan = (S.roomPlans || {})[c.id] || {};
      const all = c.students.length && c.students.every(s => ui.sel[c.id + '|' + s.id]);
      return `<div class="card" style="margin:0;border-top:4px solid var(--${tone(n) === 'ok' ? 'ok' : tone(n) === 'bad' ? 'bad' : 'warn'})">
        <div class="row" style="border:0;padding:0 0 6px;gap:6px"><h2 style="margin:0" class="grow">${esc(c.name)}</h2><span class="chip ${tone(n)}" style="white-space:nowrap">${n}/${m}${n > m ? ' เกิน ' + (n - m) : n < m ? ' ขาด ' + (m - n) : ''}</span></div>
        <label class="small muted" style="display:flex;gap:6px;align-items:center;cursor:pointer;margin-bottom:4px"><input type="checkbox" data-rs="all" data-c="${esc(c.id)}" ${all ? 'checked' : ''}> เลือกทั้งห้อง</label>
        <div style="max-height:360px;overflow:auto">${c.students.slice().sort((a, b) => (a.no || 0) - (b.no || 0)).filter(hit).map(s => `<label style="display:flex;gap:8px;align-items:center;padding:3px 0;cursor:pointer;border-bottom:1px solid var(--line)">
          <input type="checkbox" data-rs="pick" data-k="${esc(c.id + '|' + s.id)}" ${ui.sel[c.id + '|' + s.id] ? 'checked' : ''}>
          <span class="muted small" style="width:24px;text-align:right">${esc(s.no)}</span><span class="grow">${esc(s.name)}</span>${plan[sk(s)] ? `<span class="chip" title="แผนการเรียน">${esc(plan[sk(s)])}</span>` : ''}<span class="muted small">${esc(s.sid || '')}</span></label>`).join('') || '<div class="muted small">ไม่มีนักเรียน</div>'}</div></div>`; }).join('')}</div>`;
    h += `<div class="card" style="margin-top:12px"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:8px"><div class="grow">${done
        ? `<b>จัดห้อง ม.${ui.g} เสร็จแล้ว</b> โดย ${esc(done.who)} เมื่อ ${esc(new Date(done.at).toLocaleString('th-TH'))} <span class="muted small">(${esc((done.counts || []).join(' · '))})</span>`
        : `<b>ยังไม่ได้บันทึกว่าจัดห้อง ม.${ui.g} เสร็จ</b><div class="muted small">ย้ายจนครบแล้ว กดบันทึกเพื่อเก็บว่าจัดเสร็จเมื่อไร โดยใคร · แก้ต่อได้ภายหลัง</div>`}</div>
      ${done ? `<button class="btn" data-rs="undone">ยกเลิกสถานะเสร็จ</button>` : `<button class="btn pri" data-rs="done">บันทึกว่าจัดห้อง ม.${ui.g} เสร็จแล้ว</button>`}</div>
      <p class="muted small" style="margin:8px 0 0">ย้ายห้องแล้วคะแนนที่บันทึกไว้ในห้องเดิมไม่ย้ายตาม — จัดห้องให้เสร็จก่อนครูเริ่มกรอกคะแนน · แผนการเรียนรายคนย้ายตามคน</p></div>`;
    return h;
  };

  document.addEventListener('click', e => { const t = e.target.closest('[data-rs]'); if (!t) return; const a = t.dataset.rs;
    if (a === 'pick') { ui.sel[t.dataset.k] = t.checked; return syncSel(); }
    if (a === 'all') { const c = S.classes.find(x => x.id === t.dataset.c); if (c) c.students.forEach(s => { ui.sel[c.id + '|' + s.id] = t.checked; });
      document.querySelectorAll('[data-rs="pick"]').forEach(x => { if (x.dataset.k.split('|')[0] === t.dataset.c) x.checked = t.checked; }); return syncSel(); }
    if (a === 'g') { ui.g = +t.dataset.g; ui.sel = {}; ui.to = ''; return redraw(); }
    if (a === 'clear') { ui.sel = {}; return redraw(); }
    if (a === 'move') return moveTo(ui.to);
    if (a === 'renum') { if (!confirm('เรียงเลขที่ใหม่ทุกห้องของ ม.' + ui.g + ' ?')) return; return renumber(ui.g); }
    if (a === 'done') { const rooms = roomsOf(ui.g), m = maxN(), bad = rooms.filter(c => c.students.length !== m);
      if (bad.length && !confirm('ยังมี ' + bad.length + ' ห้องที่ไม่ตรงเกณฑ์ ' + m + ' คน (' + bad.map(c => c.name + ' ' + c.students.length).join(', ') + ')\nบันทึกว่าเสร็จแล้วหรือไม่?')) return;
      store()[ui.g] = { who: S.me.name, at: new Date().toISOString(), counts: rooms.map(c => c.name + ' ' + c.students.length) }; save(); toast('บันทึกว่าจัดห้อง ม.' + ui.g + ' เสร็จแล้ว'); return redraw(); }
    if (a === 'undone') { delete store()[ui.g]; save(); return redraw(); }
  });
  document.addEventListener('change', e => { const t = e.target.closest('[data-rsf]'); if (!t) return; const k = t.dataset.rsf;
    if (k === 'max') { const v = Math.max(1, Math.round(+t.value) || 40); S.settings.maxStudents = v; save(); return redraw(); }
    ui[k] = t.value.trim(); if (k !== 'to') redraw(); });

  /* เมนู: ข้อมูลหลัก (แอดมิน/วิชาการเท่านั้น) */
  const N = window.EMSNav;
  if (N) {
    const grp = (N.NAVG.admin || []).find(x => x[0] === 'ข้อมูลหลัก'); if (grp && !grp[1].some(x => x[0] === 'a-roomsort')) grp[1].push(['a-roomsort', 'จัดห้องเรียน', 'users']);
    const hideFor = fn => function () { const g = (N.NAVG.admin || []).find(x => x[0] === 'ข้อมูลหลัก'), i = g ? g[1].findIndex(x => x[0] === 'a-roomsort') : -1;
      let it = null; try { if (i >= 0 && !canDo()) it = g[1].splice(i, 1)[0]; } catch (x) {}
      try { return fn.apply(this, arguments); } finally { if (it) g[1].splice(i, 0, it); } };
    if (window.renderChrome) window.renderChrome = hideFor(window.renderChrome);
    if (window.openMore) window.openMore = hideFor(window.openMore);
    (window.EMSNavHidden = window.EMSNavHidden || {})['a-roomsort'] = () => !canDo();      // ค้นหาเมนู (Ctrl K)
  }
  window.EMSRoomSort = { roomsOf, moveTo: id => moveTo(id), ui };
})();
