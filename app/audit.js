/* EMS — ประวัติการแก้ไขข้อมูล + เหตุผล และหน้า "ดูแลข้อมูล" ของแอดมิน
   - EMSAudit.ask(หัวข้อ, รายละเอียด) → Promise<เหตุผล | null> กล่องให้พิมพ์เหตุผล (อย่างน้อย 3 ตัวอักษร) · ยกเลิก = null
   - EMSAudit.log(ชนิด, เป้าหมาย, ก่อน, หลัง, เหตุผล) → auditLog/{id} (เพิ่มอย่างเดียว แก้/ลบไม่ได้ · อ่านได้เฉพาะแอดมิน/ผู้บริหาร)
     ชนิด: student (ฐานนักเรียน) · staffTime (เวลาลงเวลาครู) · conduct (คะแนนพฤติกรรม/แถวเช้า) · att (เช็กชื่อ)
   - หน้า a-maint: ล้างคาบค้างเช็กชื่อช่วงทดลองใช้ (S.settings.attSince = วันเริ่มนับ ไม่ลบข้อมูลเช็กชื่อ) + ดูประวัติการแก้ไขล่าสุด
   โหมดตัวอย่าง (ไม่ LIVE): ประวัติเก็บที่ S.auditLocal ในเครื่องนี้ */
(() => {
  'use strict';
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const low = s => String(s || '').trim().toLowerCase();
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const cut = (v, n) => { const s = typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const KIND = { student: 'ฐานนักเรียน', staffTime: 'เวลาลงเวลาครู', conduct: 'คะแนนพฤติกรรม/แถวเช้า', att: 'เช็กชื่อ' };
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  const isAdmin = () => roles().indexOf('admin') >= 0 || ((window.EMS_CONFIG || {}).adminEmails || []).map(low).indexOf(low(S.me.email)) >= 0;
  const canRead = () => isAdmin() || roles().indexOf('exec') >= 0;
  const by = () => low((LIVE && window.EMSCloud && EMSCloud.email && EMSCloud.email()) || S.me.email);

  /* ---------- กล่องถามเหตุผล ---------- */
  /* กล่องที่ยังเปิดอยู่: ปิดด้วยทางอื่น (Escape / เปลี่ยนหน้า / เปิดกล่องอื่นทับ) = ยกเลิก ไม่ให้ตัวฟังค้างไปรับคำตอบของกล่องถัดไป */
  let pendingAsk = null;
  function ask(title, detail) {
    if (pendingAsk) pendingAsk(null);
    return new Promise(res => {
      modal(`<h2 style="margin-bottom:6px">${esc(title)}</h2>${detail ? `<p class="muted small" style="margin-bottom:10px;white-space:pre-line">${esc(detail)}</p>` : ''}
        <div class="field"><label class="f" for="au-r">เหตุผลในการแก้ไข (บันทึกไว้ในประวัติ)</label><textarea id="au-r" class="in" rows="3" maxlength="500" placeholder="เช่น สะกดชื่อผิดตามทะเบียน, ครูลืมสแกน มีหลักฐานลงชื่อในสมุด"></textarea></div>
        <div id="au-e" class="small" style="color:var(--bad);min-height:1.2em"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button class="btn" data-au="0">ยกเลิก</button><button class="btn pri" data-au="1">ยืนยันการแก้ไข</button></div>`, true);
      const L = $('#layer'), ta = $('#au-r'); if (ta) setTimeout(() => ta.focus(), 30);
      let fin = false;
      const done = (v, gone) => { if (fin) return; fin = true; pendingAsk = null; mo.disconnect(); L.removeEventListener('click', h, true); document.removeEventListener('keydown', kd, true); if (!gone) closeModal(); res(v); };
      const kd = e => { if (e.key === 'Escape') done(null); };
      const mo = new MutationObserver(() => { if (!ta || !ta.isConnected) done(null, true); });      // กล่องถูกปิด/ถูกแทน = ยกเลิก (ไม่ปิดกล่องใหม่ที่มาแทน)
      const h = e => {
        const t = e.target.closest('[data-au]');
        if (!t) { if (e.target.dataset && e.target.dataset.act === 'close') done(null); return; }      // แตะพื้นหลัง = ยกเลิก
        e.stopPropagation();
        if (t.dataset.au !== '1') return done(null);
        if (!$('#au-r')) return done(null, true);
        const r = ($('#au-r').value || '').trim();
        if (r.length < 3) { $('#au-e').textContent = 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร'; return; }
        done(r);
      };
      L.addEventListener('click', h, true); document.addEventListener('keydown', kd, true);
      mo.observe(L, { childList: true, subtree: true }); pendingAsk = v => done(v);
    });
  }

  /* ---------- บันทึกประวัติ ---------- */
  async function log(kind, target, before, after, reason) {
    const now = new Date(), d = { at: now.toISOString(), ms: now.getTime(), by: by(), byName: String(S.me.name || ''), kind, target: cut(target, 200), before: cut(before, 1000), after: cut(after, 1000), reason: cut(reason, 500) };
    const id = now.getTime() + '_' + Math.random().toString(36).slice(2, 8);
    if (!LIVE) { (S.auditLocal = S.auditLocal || []).unshift(Object.assign({ id }, d)); S.auditLocal.length = Math.min(S.auditLocal.length, 300); save(); return; }
    const db = window.EMSCloud && EMSCloud.db && EMSCloud.db(); if (!db) return;
    try { await db.collection('auditLog').doc(id).set(d); if (ui.list) ui.list.unshift(Object.assign({ id }, d)); }
    catch (e) { console.warn('EMS audit', e); toast('บันทึกประวัติการแก้ไขไม่สำเร็จ: ' + (e.code || e.message)); }
  }
  /* ถามเหตุผลก่อนแก้: ยกเลิก = null · ยืนยัน = ฟังก์ชัน commit() ให้ผู้เรียกเรียกหลังแก้สำเร็จ (บันทึกประวัติตอนนั้น ไม่ใช่ก่อนแก้) */
  async function guard(kind, target, before, after, title) {
    const r = await ask(title || 'แก้ไขข้อมูล', `${target}\n${cut(before, 200) || '—'} → ${cut(after, 200) || '—'}`);
    if (!r) return null;
    return () => log(kind, target, before, after, r);
  }
  /* แก้ฐานนักเรียนหลายคนในครั้งเดียว (นำเข้า/จัดห้อง/ขึ้นปี/เพิ่มนักเรียน): ถามเหตุผลครั้งเดียว เฉพาะมุมมองแอดมิน/ฝ่ายงาน (มุมมองอื่น = ผ่านเลย ไม่บันทึก)
     ยกเลิก = null · ยืนยัน = commit(ก่อน, หลัง) บันทึกสรุปหนึ่งรายการหลังทำเสร็จ */
  async function batch(target, detail, title) {
    if (S.view !== 'admin') return () => {};
    const r = await ask(title || 'แก้ฐานนักเรียน', target + (detail ? '\n' + detail : ''));
    if (!r) return null;
    return (before, after) => log('student', target, before, after, r);
  }

  /* ---------- หน้า "ดูแลข้อมูล" ---------- */
  const ui = { list: null, loading: false, kind: '', err: '' };
  async function load() {
    if (ui.loading) return; ui.loading = true; ui.err = '';
    try {
      if (!LIVE) ui.list = (S.auditLocal || []).slice();
      else {
        const db = EMSCloud.db(), q = await db.collection('auditLog').orderBy('ms', 'desc').limit(100).get();
        ui.list = q.docs.map(x => Object.assign({ id: x.id }, x.data()));
      }
    } catch (e) { ui.err = e.code === 'permission-denied' ? 'ยังอ่านประวัติไม่ได้ — ตรวจว่าวาง firestore.rules รุ่นใหม่แล้ว' : (e.code || e.message); ui.list = []; }
    ui.loading = false; if (page === 'a-maint') redraw();
  }
  const fmtAt = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  P['a-maint'] = () => {
    if (!canRead()) return `<div class="card"><div class="empty">หน้านี้สำหรับแอดมิน/ผู้บริหารเท่านั้น</div></div>`;
    const st = S.settings || {}, since = st.attSince || '';
    if (ui.list === null && !ui.loading) setTimeout(load, 0);
    const rows = (ui.list || []).filter(x => !ui.kind || x.kind === ui.kind);
    return `<div class="top"><div><h1>ดูแลข้อมูล</h1><p>${isAdmin() ? 'ล้างรายการค้างช่วงทดลองใช้ · ' : ''}ประวัติการแก้ไขข้อมูลพร้อมเหตุผล</p></div></div>
      ${!isAdmin() ? '' : `<div class="card"><h2>คาบค้างเช็กชื่อ (ช่วงทดลองใช้)</h2>
        <p class="muted small" style="margin-bottom:10px">ระบบแจ้งครูเรื่องคาบที่ยังไม่ได้เช็กชื่อย้อนหลัง 30 วัน ช่วงทดลองใช้จึงมีคาบค้างที่ไม่ได้เช็กจริงเยอะ ตั้ง “เริ่มนับตั้งแต่วันที่” แล้วคาบก่อนวันนั้นจะไม่ขึ้นเป็นค้างอีก — <b>ไม่ลบข้อมูลเช็กชื่อที่บันทึกไว้แล้ว</b></p>
        <div class="row" style="border:0;padding:0;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div class="field" style="margin:0"><label class="f" for="mt-since">เริ่มนับคาบค้างตั้งแต่วันที่</label><input id="mt-since" class="in" type="date" value="${esc(since)}"></div>
          <button class="btn" data-mt="since">บันทึกวันที่</button>
          <button class="btn pri" data-mt="clear">ล้างคาบค้างทั้งหมด (เริ่มนับวันนี้)</button></div>
        <p class="muted small" style="margin-top:8px">${since ? `ตอนนี้นับคาบค้างตั้งแต่ ${esc(thDate(since))}` : 'ตอนนี้นับย้อนหลัง 30 วันตามปกติ'}</p></div>`}
      <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><h2 style="margin:0">ประวัติการแก้ไขข้อมูล</h2><span class="grow"></span>
          <select class="in" style="width:auto" data-mt="kind" aria-label="ชนิดข้อมูล"><option value="">ทุกชนิด</option>${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${ui.kind === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <button class="btn sm" data-mt="reload">โหลดใหม่</button></div>
        ${!canRead() ? '<div class="empty">ดูได้เฉพาะแอดมิน/ผู้บริหาร</div>' : ui.err ? `<div class="empty">${esc(ui.err)}</div>` : ui.list === null || ui.loading ? '<div class="empty">กำลังโหลด…</div>' : rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้แก้</th><th>ชนิด</th><th>รายการ</th><th>ก่อน → หลัง</th><th>เหตุผล</th></tr></thead><tbody>
          ${rows.map(x => `<tr><td style="white-space:nowrap">${esc(fmtAt(x.ms || x.at))}</td><td>${esc(x.byName || '')}<div class="muted small">${esc(x.by || '')}</div></td><td style="white-space:nowrap">${chip(esc(KIND[x.kind] || x.kind))}</td><td>${esc(x.target)}</td><td class="small">${esc(x.before || '—')} → ${esc(x.after || '—')}</td><td>${esc(x.reason)}</td></tr>`).join('')}</tbody></table></div>
          <p class="muted small" style="margin-top:8px">แสดง 100 รายการล่าสุด · ประวัติแก้หรือลบไม่ได้</p>` : '<div class="empty">ยังไม่มีการแก้ไขที่บันทึกไว้</div>'}</div>`;
  };
  if (window.EMSNav) { const g = (EMSNav.NAVG.admin || []).find(x => x[0] === 'ระบบ'); if (g && !g[1].some(x => x[0] === 'a-maint')) g[1].push(['a-maint', 'ดูแลข้อมูล', 'gear']); }
  (window.EMSNavHidden = window.EMSNavHidden || {})['a-maint'] = () => !canRead();      // ค้นหาเมนู (Ctrl K)

  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-mt]'); if (!b) return;
    const k = b.dataset.mt, st = S.settings = S.settings || {};
    if (k === 'reload') { ui.list = null; return void load(); }
    if ((k === 'since' || k === 'clear') && !isAdmin()) return;
    if (k === 'since') { const v = ($('#mt-since') || {}).value || ''; st.attSince = v; save(); toast(v ? 'นับคาบค้างตั้งแต่ ' + thDate(v) : 'กลับไปนับย้อนหลัง 30 วัน'); return redraw(); }
    if (k === 'clear') { st.attSince = todayISO(); save(); toast('ล้างคาบค้างแล้ว — นับใหม่ตั้งแต่วันนี้'); return redraw(); }
  });
  document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.mt === 'kind') { ui.kind = t.value; redraw(); } });

  window.EMSAudit = { ask, log, guard, batch, KIND };
})();
