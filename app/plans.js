/* EMS — ห้องเรียนหลายแผนการเรียน (เช่น ม.4/9 แผนภาษาจีน “จ” + แผนภาษาเกาหลี “ก”)
   - ห้องหลัก (ม.4/9) = วิชาเรียนรวม เห็นนักเรียนทุกคน
   - ห้องย่อย (ม.4/9จ, ม.4/9ก) = วิชาเรียนแยก เห็นเฉพาะนักเรียนที่เลือกแผนนั้น (เช็กชื่อ/กรอกคะแนน/สรุป)
   ข้อมูล: แผนของห้องเก็บที่ S.rooms[i].plans = [{ key:'จ', name:'ภาษาจีน' }] (ตั้งค่าโดยแอดมิน/วิชาการ)
           ห้องย่อย = ห้องใน S.rooms ที่มี parent + plan (ใช้ห้องเดิมถ้าชื่อตรง เช่น ห้องที่ตารางสอนสร้างไว้แล้ว)
           แผนของนักเรียนรายคน S.roomPlans[ห้องหลัก] = { เลขประจำตัว: 'จ' } — แยกจากรายชื่อห้อง ครูทุกคนติ๊กได้ (Firestore roomPlans)
   รายชื่อห้องย่อยไม่ได้เก็บแยก คำนวณจากห้องหลัก + แผนทุกครั้ง (apply) จึงไม่มีทางไม่ตรงกัน */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  S.roomPlans = S.roomPlans || {};
  const roomOf = id => (S.rooms || []).find(r => r.id === id);
  const sk = s => String(s.sid || s.id);
  const parentOf = id => { const r = roomOf(id); return r && r.parent ? r.parent : (r && (r.plans || []).length ? id : ''); };
  const isSub = id => { const r = roomOf(id); return !!(r && r.parent); };
  const plansOf = pid => (roomOf(pid) || {}).plans || [];
  const subOf = (pid, key) => (S.rooms || []).find(r => r.parent === pid && r.plan === key);
  /* รายชื่อของห้องหลัก: ระบบจริงอ่านจาก roster กลาง (ครูทุกคนมี) · โหมดตัวอย่างอ่านจาก S.classes */
  const baseStudents = pid => { const r = (S.__rosterView || S.__roster || {})[pid]; if (r && r.students) return r.students; const c = (S.classes || []).find(x => x.id === pid); return c ? c.students : []; };
  const planOfStu = (pid, st) => ((S.__plansView || S.roomPlans || {})[pid] || {})[sk(st)] || '';

  /* ห้องย่อยใน S.classes → นักเรียนตามแผน (เรียกหลังทุกครั้งที่คำนวณห้องเรียนใหม่) */
  function apply() {
    (S.classes || []).forEach(c => { const r = roomOf(c.id); if (!r || !r.parent) return;
      c.students = baseStudents(r.parent).filter(st => planOfStu(r.parent, st) === r.plan); });
  }

  /* ---------- ตั้งค่าแผนของห้อง (แอดมิน/วิชาการ) ---------- */
  let draft = null;
  function cfgModal(pid) {
    const r = roomOf(pid); if (!r) return;
    draft = { pid, plans: plansOf(pid).map(p => Object.assign({}, p)) };
    if (!draft.plans.length) draft.plans = [{ key: '', name: '' }, { key: '', name: '' }];
    drawCfg();
  }
  function drawCfg() {
    const r = roomOf(draft.pid);
    modal(`<h2 style="margin-bottom:4px">แผนการเรียน · ${esc(r.name)}</h2>
      <p class="muted small">ใส่แผนตั้งแต่ 2 แผน · <b>ตัวย่อ</b> ต่อท้ายชื่อห้องเป็นห้องย่อย เช่น ${esc(r.name)}จ — ถ้าตารางสอนมีห้องชื่อนี้อยู่แล้วจะใช้ห้องนั้น · วิชาเรียนรวมยังใช้ห้อง ${esc(r.name)} ตามเดิม</p>
      <div style="display:grid;gap:8px;margin:10px 0">${draft.plans.map((p, i) => `<div style="display:flex;gap:8px;align-items:center">
        <input class="in" style="width:90px" maxlength="6" placeholder="ตัวย่อ" value="${esc(p.key)}" data-plf="key" data-i="${i}" aria-label="ตัวย่อแผน ${i + 1}">
        <input class="in" placeholder="ชื่อแผน เช่น ภาษาจีน" value="${esc(p.name)}" data-plf="name" data-i="${i}" aria-label="ชื่อแผน ${i + 1}">
        <button class="btn sm ghost" data-pl="cfgDel" data-i="${i}" aria-label="ลบแผน ${i + 1}">ลบ</button></div>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-pl="cfgAdd">${ic('plus')}เพิ่มแผน</button><span class="grow"></span>
        ${plansOf(draft.pid).length ? `<button class="btn" data-pl="cfgOff">เลิกแบ่งแผน</button>` : ''}<button class="btn pri" data-pl="cfgSave">บันทึก</button></div>`, true);
  }
  function cfgSave() {
    /* cur = แผนหลักสูตร (curriculum.js) ของแผนย่อย — แถวเดิมใน draft มีติดมา คงไว้ตอนแก้ชื่อ/ตัวย่อ */
    const r = roomOf(draft.pid), list = draft.plans.map(p => Object.assign({ key: String(p.key || '').trim(), name: String(p.name || '').trim() }, p.cur ? { cur: p.cur } : {})).filter(p => p.key || p.name);
    if (list.length < 2) return toast('ใส่อย่างน้อย 2 แผน');
    if (list.some(p => !p.key || !p.name)) return toast('ใส่ทั้งตัวย่อและชื่อแผนให้ครบทุกแผน');
    if (new Set(list.map(p => p.key)).size !== list.length) return toast('ตัวย่อแผนซ้ำกัน');
    /* แบ่งแผนครั้งแรก: แผนย่อยที่ยังไม่ได้เลือกหลักสูตรใช้หลักสูตรเดิมของห้องไปก่อน (เปลี่ยนได้ที่หน้า หลักสูตร / แผนการเรียน) แล้วเลิกใช้ค่าของทั้งห้อง */
    if (!(r.plans || []).length && r.cur) list.forEach(p => { if (!p.cur) p.cur = r.cur; });
    delete r.cur;
    r.plans = list;
    list.forEach(p => { const nm = r.name + p.key; let s = subOf(r.id, p.key) || (S.rooms || []).find(x => x.name.replace(/\s/g, '') === nm);
      if (!s) { s = { id: r.id + '-' + p.key, name: nm, count: 0 }; S.rooms.push(s); }
      s.parent = r.id; s.plan = p.key; s.planName = p.name; s.name = nm; });
    /* แผนที่ถูกลบ: ห้องย่อยเลิกผูก (คงห้องไว้ เผื่อมีคะแนน/ตารางสอนอยู่) */
    S.rooms.forEach(x => { if (x.parent === r.id && !list.some(p => p.key === x.plan)) { delete x.parent; delete x.plan; delete x.planName; } });
    save(); closeModal(); toast('บันทึกแผนการเรียนของ ' + r.name + ' แล้ว'); assignModal(r.id);
  }
  function cfgOff() {
    /* เลิกแบ่งแผน: ถ้าทุกแผนใช้หลักสูตรเดียวกัน คืนเป็นหลักสูตรของทั้งห้อง ไม่งั้นแจ้งให้ไปเลือกใหม่ */
    const r = roomOf(draft.pid), cs = (r.plans || []).map(p => p.cur || ''), one = cs.length && cs[0] && cs.every(c => c === cs[0]) ? cs[0] : '', lost = !one && cs.some(Boolean);
    if (one) r.cur = one; delete r.plans;
    S.rooms.forEach(x => { if (x.parent === r.id) { delete x.parent; delete x.plan; delete x.planName; } });
    save(); closeModal(); toast('เลิกแบ่งแผนของ ' + r.name + ' แล้ว' + (lost ? ' — เลือกแผนหลักสูตรของห้องใหม่ที่หน้า หลักสูตร / แผนการเรียน' : '')); render();
  }

  /* ---------- ติ๊กแผนรายคน (ครูทุกคน) ---------- */
  function assignModal(id) {
    const pid = parentOf(id); if (!pid) return toast('ห้องนี้ยังไม่ได้แบ่งแผนการเรียน');
    const r = roomOf(pid), ps = plansOf(pid), list = baseStudents(pid).slice().sort((a, b) => (a.no || 0) - (b.no || 0));
    const cnt = k => list.filter(st => planOfStu(pid, st) === k).length, none = list.filter(st => !planOfStu(pid, st)).length;
    modal(`<h2 style="margin-bottom:4px">แผนการเรียนรายคน · ${esc(r.name)}</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px">${ps.map(p => chip(esc(p.name) + ' (' + esc(r.name + p.key) + ') ' + cnt(p.key) + ' คน', 'info')).join('')}${none ? chip('ยังไม่เลือก ' + none + ' คน', 'warn') : chip('เลือกครบแล้ว', 'ok')}</div>
      ${list.length ? `<div class="scroll" style="max-height:55vh"><table class="tbl"><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th>${ps.map(p => `<th style="text-align:center">${esc(p.name)}<br><button class="btn sm ghost" data-pl="all" data-p="${esc(pid)}" data-k="${esc(p.key)}" title="เลือกแผนนี้ให้ทุกคนที่ยังไม่เลือก">ที่เหลือทั้งหมด</button></th>`).join('')}</tr></thead><tbody>
        ${list.map(st => { const cur = planOfStu(pid, st); return `<tr><td>${st.no || ''}</td><td>${esc(st.name)}<div class="muted small">${esc(sk(st))}</div></td>${ps.map(p => `<td style="text-align:center"><input type="radio" name="pl-${esc(sk(st))}" data-pl="pick" data-p="${esc(pid)}" data-s="${esc(sk(st))}" data-k="${esc(p.key)}" ${cur === p.key ? 'checked' : ''} aria-label="${esc(st.name)} แผน${esc(p.name)}" style="width:20px;height:20px"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`
        : '<div class="empty">ห้องนี้ยังไม่มีรายชื่อนักเรียน</div>'}
      <div class="muted small" style="margin-top:8px">บันทึกทันทีที่ติ๊ก · รายชื่อเช็กชื่อ/กรอกคะแนนของห้องย่อยเปลี่ยนตามทันที</div>
      <button class="btn" style="width:100%;margin-top:10px" data-act="close">เสร็จ</button>`, true);
    const sh = document.querySelector('#layer .sheet'); if (sh) sh.style.maxWidth = '720px';
  }
  /* ดูปีเก่า: แผนในหน้าจอเป็นของปีนั้น (S.__plansView) — ติ๊กแล้วจะไปเขียนทับแผนของห้องปีปัจจุบัน จึงปฏิเสธ */
  const pastLock = () => { if (!S.__plansView) return false; toast('กำลังดูปีการศึกษาก่อน — แก้แผนการเรียนรายคนไม่ได้ กลับภาคปัจจุบันก่อน'); return true; };
  function pick(pid, sid, key) { if (pastLock()) return; const m = (S.roomPlans = S.roomPlans || {}); m[pid] = Object.assign({}, m[pid] || {}, { [sid]: key }); apply(); save(); }

  /* ---------- ปุ่มในหน้าต่าง ๆ ---------- */
  function decorate() {
    /* ตั้งค่าโรงเรียน › ห้องเรียน: ปุ่ม “แผน” ทุกแถว (ห้องย่อยแสดงว่าเป็นของห้องไหน) */
    document.querySelectorAll('#view .tbl tbody tr').forEach(tr => { const del = tr.querySelector('[data-ad="roomDel"],[data-adf="roomN"]'), b = tr.querySelector('td b');
      if (!b || tr.dataset.pl) return; const r = (S.rooms || []).find(x => x.name === b.textContent.trim()); if (!r) return;
      if (!tr.closest('table') || !/ครูที่ปรึกษา/.test(tr.closest('table').querySelector('thead').textContent)) return;
      tr.dataset.pl = '1'; const td = tr.lastElementChild;
      if (r.parent) b.insertAdjacentHTML('afterend', ' ' + chip('แผน' + esc(r.planName || r.plan) + ' ของ ' + esc((roomOf(r.parent) || {}).name || ''), 'info'));
      else td.insertAdjacentHTML('afterbegin', `<button class="btn sm ${plansOf(r.id).length ? '' : 'ghost'}" data-pl="cfg" data-id="${esc(r.id)}">${plansOf(r.id).length ? plansOf(r.id).map(p => esc(p.key)).join('/') : 'แผน'}</button>`); });
    /* หน้าเช็กชื่อ: ห้องที่มีแผน → ปุ่มเลือกแผนรายคน + เตือนคนที่ยังไม่เลือก */
    const panel = document.getElementById('att-panel'); if (panel && !panel.dataset.pl) { const cid = String((S.aui || {}).sess || '').split('|')[0], pid = parentOf(cid);
      if (pid) { panel.dataset.pl = '1'; const none = baseStudents(pid).filter(st => !planOfStu(pid, st)).length, r = roomOf(cid);
        const head = panel.querySelector('.att-head') || panel.firstElementChild;
        head.insertAdjacentHTML('beforebegin', `<div class="notice" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0"><div class="grow">${r && r.parent ? `ห้องย่อย <b>แผน${esc(r.planName || r.plan)}</b> — แสดงเฉพาะนักเรียนที่เลือกแผนนี้` : `ห้องนี้มี ${plansOf(pid).length} แผนการเรียน (${plansOf(pid).map(p => esc(p.name)).join(' / ')}) — วิชานี้เรียนรวมทุกคน`}${none ? ` · <b style="color:var(--bad)">ยังไม่เลือกแผน ${none} คน</b>` : ''}</div><button class="btn sm" data-pl="assign" data-id="${esc(cid)}">แผนการเรียนรายคน</button></div>`); } }
    /* ฐานนักเรียน: ปุ่มต่อการ์ดห้องที่มีแผน */
    if (page === 'a-students') document.querySelectorAll('#view .card h2').forEach(h => { const nm = (h.firstChild && h.firstChild.textContent || '').trim(), r = (S.rooms || []).find(x => x.name === nm);
      if (!r || !plansOf(r.id).length || h.dataset.pl) return; h.dataset.pl = '1'; h.insertAdjacentHTML('beforeend', ` <button class="btn sm" data-pl="assign" data-id="${esc(r.id)}">แผนการเรียน ${plansOf(r.id).map(p => esc(p.key)).join('/')}</button>`); });
  }
  const baseRender = window.render;
  window.render = function () { if (!LIVE) apply(); const x = baseRender.apply(this, arguments); decorate(); return x; };
  document.addEventListener('click', e => { const t = e.target.closest('[data-pl]'); if (!t || t.dataset.pl === 'pick') return; const d = t.dataset;
    switch (d.pl) {
      case 'cfg': return cfgModal(d.id);
      case 'cfgAdd': draft.plans.push({ key: '', name: '' }); return drawCfg();
      case 'cfgDel': draft.plans.splice(+d.i, 1); return drawCfg();
      case 'cfgSave': return cfgSave();
      case 'cfgOff': return cfgOff();
      case 'assign': return assignModal(d.id);
      case 'all': { if (pastLock()) return; const m = (S.roomPlans = S.roomPlans || {}), cur = Object.assign({}, m[d.p] || {}); baseStudents(d.p).forEach(st => { if (!cur[sk(st)]) cur[sk(st)] = d.k; }); m[d.p] = cur; apply(); save(); return assignModal(d.p); }
    } });
  document.addEventListener('change', e => { const t = e.target;
    if (t.dataset && t.dataset.pl === 'pick') { pick(t.dataset.p, t.dataset.s, t.dataset.k); const pid = t.dataset.p; setTimeout(() => { const y = (document.querySelector('#layer .scroll') || {}).scrollTop; assignModal(pid); const sc = document.querySelector('#layer .scroll'); if (sc && y) sc.scrollTop = y; }, 0); }
    if (t.dataset && t.dataset.plf && draft) draft.plans[+t.dataset.i][t.dataset.plf] = t.value; });
  document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.plf && draft) draft.plans[+t.dataset.i][t.dataset.plf] = t.value; });
  window.EMSPlans = { apply, isSub, parentOf, plansOf, assignModal };
})();
