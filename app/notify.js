/* EMS — ศูนย์แจ้งเตือน (กระดิ่งหลายระดับ)
   รวมงานที่เกี่ยวกับผู้ใช้จากทุกโมดูล แบ่ง 3 ระดับ: ด่วน (urgent) · ต้องทำ (todo) · แจ้งให้ทราบ (info)
   ตัวเลขบนกระดิ่ง = จำนวนงานด่วน + ต้องทำ + เรื่องแจ้งให้ทราบที่ยังไม่ได้อ่าน · สีแดงถ้ามีงานด่วน
   โมดูลอื่นเพิ่มแหล่งได้ด้วย EMSNotify.register(fn) — fn คืน [{ id, level, title, sub, n, page, view, at }]
     n = จำนวนงานในรายการนั้น (ไม่ใส่ = 1) · page/view = เปิดหน้าไหน · at = เวลา (ใช้กับ info ที่อ่านแล้วหาย)
   ไม่มีข้อมูลใหม่ในฐานข้อมูล ยกเว้น “อ่านแล้ว” ของเรื่องแจ้งให้ทราบ เก็บที่ users/{ตัวเอง} คีย์ notiSeen */
(function () {
  'use strict';
  const LV = { urgent: ['ด่วน', 'bad'], todo: ['ต้องทำ', 'warn'], info: ['แจ้งให้ทราบ', 'info'] };
  const ORDER = ['urgent', 'todo', 'info'];
  /* กระดิ่งแยก 3 เรื่อง (ไม่มีแจ้งเตือน = ไม่แสดงปุ่ม): เช็กชื่อ · แลกคาบ · ประชุมและประกาศ (วิชาการ/วัดผล/ใบลา/อนุมัติ ฯลฯ) */
  const GROUPS = [['att', 'คาบที่ยังไม่ได้เช็กชื่อ', '📋'], ['swap', 'แลกคาบ / สอนแทน', '🔄'], ['news', 'ประชุมและประกาศ', '🔔']];
  const gOf = x => (x.g === 'att' || x.g === 'swap') ? x.g : 'news';
  const src = [];
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  const has = r => roles().indexOf(r) >= 0;
  const seen = () => (S.notiSeen = S.notiSeen && typeof S.notiSeen === 'object' ? S.notiSeen : {});
  const today = () => (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
  const daysAgo = iso => { const t = Date.parse(iso || ''); return isFinite(t) ? (Date.now() - t) / 864e5 : 999; };
  const myDept = () => String(((S.staff || []).find(u => u.name === S.me.name) || {}).dept || S.me.dept || '');
  const deptOf = name => String(((S.staff || []).find(u => u.name === name) || {}).dept || '');
  const view = () => (window.EMSNav && EMSNav.view ? EMSNav.view() : S.view);

  /* ---------- แหล่งแจ้งเตือนของงานที่มีอยู่แล้ว ---------- */
  src.push(() => {          // แลกคาบ / สอนแทน
    const out = [], x = S.xreqs || [];
    const inc = x.filter(r => r.target === S.me.name && r.status === 'pending');
    if (inc.length) out.push({ id: 'xreq-in', level: 'urgent', title: 'คำขอแลกคาบ / สอนแทนรอคุณตอบรับ', sub: 'ตอบรับหรือปฏิเสธที่ศูนย์แลกคาบ', n: inc.length, page: 'swap', view: 'teacher', g: 'swap' });
    x.filter(r => r.requester === S.me.name && (r.status === 'accepted' || r.status === 'rejected') && daysAgo(r.respondedAt || r.createdAt) < 14)
      .forEach(r => out.push({ id: 'xreq-' + r.id + '-' + r.status, level: 'info', title: r.status === 'accepted' ? 'คำขอแลกคาบได้รับการตอบรับ' : 'คำขอแลกคาบถูกปฏิเสธ', sub: (r.target || '') + (r.sourceDate ? ' · ' + r.sourceDate : ''), page: 'swap', view: 'teacher', g: 'swap', at: r.respondedAt || r.createdAt }));
    return out;
  });
  src.push(() => {          // ใบลา: ผลการอนุมัติของตัวเอง · หัวหน้ากลุ่มสาระ: ใบลารอความเห็น
    const out = [], L = S.leaves || [];
    L.filter(l => l.by === S.me.name && (l.status === 'approved' || l.status === 'rejected') && daysAgo(l.decidedAt || l.at) < 30)
      .forEach(l => out.push({ id: 'leave-' + l.id + '-' + l.status, level: 'info', title: l.status === 'approved' ? 'ใบลาได้รับอนุมัติ' : 'ใบลาไม่ได้รับอนุมัติ', sub: (l.from || '') + (l.to && l.to !== l.from ? ' – ' + l.to : ''), page: 'leaves', view: 'teacher', at: l.decidedAt || l.at }));
    if (has('head')) { const d = myDept(), w = L.filter(l => l.status === 'submitted' && l.head === 'waiting' && l.by !== S.me.name && d && deptOf(l.by) === d);
      if (w.length) out.push({ id: 'leave-head', level: 'todo', title: 'ใบลารอความเห็นหัวหน้ากลุ่มสาระ', sub: 'ครูในกลุ่มสาระของคุณ', n: w.length, page: 'a-leaves', view: 'admin' }); }
    return out;
  });
  src.push(() => {          // แจ้งซ่อม / ขอใช้สถานที่ของตัวเอง
    const out = [], fin = s => ['done', 'cannot', 'rejected', 'approved', 'cancelled'].indexOf(s) >= 0;
    (S.repairs || []).filter(r => r.owner === S.me.name && fin(r.status) && r.status !== 'cancelled' && daysAgo(r.updatedAt || r.doneAt || r.createdAt) < 14)
      .forEach(r => out.push({ id: 'rp-' + r.id + '-' + r.status, level: 'info', title: r.status === 'done' ? 'แจ้งซ่อมดำเนินการแล้ว' : r.status === 'cannot' ? 'แจ้งซ่อม: ดำเนินการไม่ได้' : r.status === 'rejected' ? 'แจ้งซ่อมไม่ผ่านการอนุมัติ' : 'แจ้งซ่อมได้รับอนุมัติ', sub: (r.item || '') + (r.place ? ' · ' + r.place : ''), page: 'general', view: 'teacher', at: r.updatedAt || r.createdAt }));
    (S.venues || []).filter(v => v.owner === S.me.name && fin(v.status) && v.status !== 'cancelled' && daysAgo(v.updatedAt || v.createdAt) < 14)
      .forEach(v => out.push({ id: 'vn-' + v.id + '-' + v.status, level: 'info', title: v.status === 'approved' ? 'ขอใช้สถานที่ได้รับอนุมัติ' : 'ขอใช้สถานที่ไม่ผ่านการอนุมัติ', sub: (v.place || '') + (v.date ? ' · ' + v.date : ''), page: 'general', view: 'teacher', at: v.updatedAt || v.createdAt }));
    return out;
  });
  src.push(() => {          // คาบค้างเช็กชื่อ
    if (!window.EMSAttend || !EMSAttend.missed) return [];
    let m = []; try { m = EMSAttend.missed() || []; } catch (e) { return []; }
    if (!m.length) return [];
    const old = m.filter(s => daysAgo(s.date) > 3).length;
    return [{ id: 'att-missed', level: old ? 'urgent' : 'todo', title: 'คาบที่ยังไม่ได้เช็กชื่อ', sub: old ? 'ค้างเกิน 3 วัน ' + old + ' คาบ' : 'ย้อนหลัง 30 วัน', n: m.length, page: 'attendance', view: 'teacher', g: 'att' }];
  });
  src.push(() => {          // ฝ่ายงาน/ผู้บริหาร: เรื่องรออนุมัติ
    if (!window.EMSPendingItems || !roles().some(r => ['admin', 'exec', 'academic', 'measure', 'personnel', 'general', 'affairs'].indexOf(r) >= 0)) return [];
    let n = 0; try { n = window.EMSPendingItems().length; } catch (e) { return []; }
    return n ? [{ id: 'approve', level: 'todo', title: 'เรื่องรออนุมัติ / รอพิจารณา', sub: 'ใบลา แจ้งซ่อม ขอใช้สถานที่ คาบรอจัดครูสอนแทน', n, page: 'a-approve', view: 'admin' }] : [];
  });

  src.push(() => {          // ปฏิทินจากฝ่ายวิชาการ: สลับวันเรียน/คาบเรียน · วันหยุด · วันสอบ (30 วันข้างหน้า เลยวันแล้วหายเอง)
    const out = [], t = today(), lim = (() => { const d = new Date(t + 'T00:00:00'); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
    const DAYN = typeof DAYS !== 'undefined' ? DAYS : ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
    const thd = iso => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return iso; } };
    const soon = iso => { const d = (Date.parse(iso + 'T00:00:00') - Date.parse(t + 'T00:00:00')) / 864e5; return d === 0 ? 'วันนี้ ' : d === 1 ? 'พรุ่งนี้ ' : ''; };
    (S.dayShifts || []).filter(x => x && x.date >= t && x.date <= lim).forEach(x => {
      const how = x.mode === 'day' ? 'เรียนตามตารางวัน' + (DAYN[+x.sourceDay] || '') : 'สลับคาบเรียน ' + ((x.map || []).length) + ' คาบ';
      out.push({ id: 'sh-' + x.id + '-' + x.date + '-' + x.mode + '-' + (x.sourceDay || '') + '-' + (x.map || []).length, level: 'info', title: soon(x.date) + 'สลับวันเรียน ' + thd(x.date) + ': ' + how, sub: x.name || 'ประกาศจากฝ่ายวิชาการ', page: 'schedule', view: 'teacher', at: x.date }); });
    const CAT = { holiday: 'วันหยุด', exam: 'สอบ' };
    (S.events || []).filter(e => e && CAT[e.cat] && e.date >= t && e.date <= lim).forEach(e =>
      out.push({ id: 'ev-' + e.id + '-' + e.date + '-' + e.cat + '-' + String(e.title || '').length, level: 'info', title: soon(e.date) + CAT[e.cat] + ' ' + thd(e.date) + ': ' + (e.title || ''), sub: e.cat === 'holiday' ? 'งดการเรียนการสอน (ตามปฏิทินวิชาการ)' : 'ตามปฏิทินวิชาการ', page: 'calendar', view: 'teacher', at: e.date }));
    return out;
  });

  /* ---------- รวม ---------- */
  function items() {
    const out = []; src.forEach(fn => { try { (fn() || []).forEach(x => { if (x && x.level && LV[x.level]) out.push(x); }); } catch (e) { console.warn('EMSNotify', e); } });
    const sn = seen(); out.forEach(x => { x.read = x.level === 'info' && !!sn[x.id]; x.g = gOf(x); });
    return out.sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level) || String(b.at || '').localeCompare(String(a.at || '')));
  }
  function summary(g) {
    const it = items().filter(x => !g || x.g === g), act = it.filter(x => x.level !== 'info'), unread = it.filter(x => x.level === 'info' && !x.read);
    const n = act.reduce((a, x) => a + (x.n || 1), 0) + unread.length;
    const per = {}; ORDER.forEach(l => { per[l] = it.filter(x => x.level === l && !x.read).reduce((a, x) => a + (l === 'info' ? 1 : x.n || 1), 0); });
    const gl = (GROUPS.find(x => x[0] === g) || [])[1] || 'แจ้งเตือน';
    return { n, urgent: per.urgent > 0, per, items: it, label: gl, t: n ? gl + ' ' + n + ' รายการ' : 'ไม่มีแจ้งเตือนใหม่' };
  }

  /* ---------- แผงแจ้งเตือน ---------- */
  let open = '';            // กลุ่มที่เปิดแผงอยู่ ('' = ปิด)
  const css = document.createElement('style');
  css.textContent = `#noti-panel{position:fixed;top:calc(var(--topbar-h,56px) + 4px);right:10px;width:min(380px,calc(100vw - 20px));max-height:min(70vh,560px);overflow:auto;z-index:60;background:var(--surface,var(--card,#fff));color:var(--text);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.18);padding:10px}
#noti-panel .nh{display:flex;align-items:center;gap:8px;padding:4px 6px 8px;border-bottom:1px solid var(--line)}
#noti-panel .ng{font-size:.8rem;font-weight:700;margin:10px 6px 4px;display:flex;gap:6px;align-items:center}
#noti-panel .ni{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;padding:8px;border-radius:10px;background:none;border:0;color:inherit;font:inherit;cursor:pointer}
#noti-panel .ni:hover{background:var(--surface2,var(--soft,rgba(0,0,0,.04)))}
#noti-panel .ni .nb{width:8px;height:8px;border-radius:50%;margin-top:7px;flex:none}
#noti-panel .ni.read{opacity:.6}
#noti-panel .nn{margin-left:auto;flex:none}
.tb-ic .dot.lv-todo{background:var(--warn)}`;
  document.head.appendChild(css);
  function panelHtml() {
    const s = summary(open), g = {}; s.items.forEach(x => (g[x.level] = g[x.level] || []).push(x));
    const color = l => l === 'urgent' ? 'var(--bad)' : l === 'todo' ? 'var(--warn)' : 'var(--info, #3b82f6)';
    return `<div class="nh"><b class="grow" style="flex:1">${esc(s.label)}</b>${ORDER.map(l => s.per[l] ? `<span class="chip ${LV[l][1]}">${LV[l][0]} ${s.per[l]}</span>` : '').join('')}
        ${(g.info || []).some(x => !x.read) ? '<button class="btn sm ghost" data-nt="readall">อ่านทั้งหมด</button>' : ''}</div>
      ${s.items.length ? ORDER.filter(l => g[l]).map(l => `<div class="ng" style="color:${color(l)}">${LV[l][0]}</div>${g[l].map((x, i) => `<button class="ni ${x.read ? 'read' : ''}" data-nt="go" data-i="${s.items.indexOf(x)}">
          <span class="nb" style="background:${color(l)}"></span><span style="flex:1;min-width:0"><b style="display:block">${esc(x.title)}</b>${x.sub ? `<span class="muted small">${esc(x.sub)}</span>` : ''}</span>
          ${x.level !== 'info' && (x.n || 1) > 1 ? `<span class="chip ${LV[l][1]} nn">${x.n}</span>` : ''}</button>`).join('')}`).join('')
        : '<div class="empty" style="padding:24px 8px">ไม่มีแจ้งเตือน</div>'}`;
  }
  let cache = [];
  function drawPanel() {
    let p = document.getElementById('noti-panel');
    if (!open) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.id = 'noti-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'แจ้งเตือน'); document.body.appendChild(p); }
    cache = summary(open).items; p.innerHTML = panelHtml();
  }
  function goTo(x) {
    if (x.level === 'info') { seen()[x.id] = Date.now(); save(); }
    open = ''; drawPanel();
    if (x.view && window.EMSAllowedViews && EMSAllowedViews().indexOf(x.view) < 0) return go(x.page);
    if (x.view && S.view !== x.view) { S.view = x.view; save(); }
    go(x.page);
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-nt]');
    if (t) { e.preventDefault(); e.stopPropagation();
      if (t.dataset.nt === 'toggle') { const g = t.dataset.g || 'news'; open = open === g ? '' : g; return drawPanel(); }
      if (t.dataset.nt === 'readall') { const sn = seen(); cache.filter(x => x.level === 'info').forEach(x => { sn[x.id] = Date.now(); }); save(); render(); return drawPanel(); }
      if (t.dataset.nt === 'go') { const x = cache[+t.dataset.i]; if (x) goTo(x); return; } }
    if (open && !e.target.closest('#noti-panel')) { open = ''; drawPanel(); }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { open = ''; drawPanel(); } });
  /* วาดใหม่เมื่อข้อมูลเปลี่ยน (แผงเปิดอยู่) · ล้างรายการ “อ่านแล้ว” ที่เก่าเกิน 60 วัน */
  const baseRender = window.render;
  window.render = function () { const r = baseRender.apply(this, arguments); if (open) drawPanel(); return r; };
  setTimeout(() => { const sn = seen(), cut = Date.now() - 60 * 864e5; let ch = 0; Object.keys(sn).forEach(k => { if (sn[k] < cut) { delete sn[k]; ch++; } }); if (ch) save(); }, 5000);

  window.EMSNotify = { register: fn => { if (typeof fn === 'function') src.push(fn); }, items, summary, LV, GROUPS, count: n => n > 9 ? '9+' : String(n), toggle: g => { g = g || 'news'; open = open === g ? '' : g; drawPanel(); } };
})();
