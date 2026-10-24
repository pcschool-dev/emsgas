/* EMS — รูปแบบหน้าจอ (skin) ให้เลือก 3 แบบ + โครงหน้าจอใหม่ที่ใช้ร่วมกันทุกแบบ
   โครงใหม่: แถบด้านบน (ตำแหน่งหน้า › ค้นหาเมนู Ctrl K › แจ้งเตือน › โหมดมืด › เมนูบัญชี)
            เมนูซ้ายเหลือเฉพาะการนำทาง — มุมมอง ภาษา ฟอนต์ ปรับแต่ง ออกจากระบบ ย้ายไปอยู่ในเมนูบัญชี
   รูปแบบ:  clean  = เรียบ สะอาดตา แบบแอปสากล (เทาเย็น เส้นบาง ไม่มีเงา ข้อมูลแน่น)
            campus = สถาบัน เมนูซ้ายสีประจำโรงเรียน เส้นทองตามตรา เป็นทางการ
            soft   = เป็นมิตร การ์ดลอยมุมมน ปุ่มแคปซูล สีพาสเทล เหมาะกับจอสัมผัส
            classic = หน้าตาเดิม (เก็บไว้ให้เลือกกลับ)
   ใช้ร่วมกับปรับแต่งเดิมได้ทั้งหมด (สีหลัก ขนาดตัวอักษร ความหนาแน่น เมนูไอคอน โหมดมืด) */
(() => {
const root = document.documentElement;
IC.expand = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
IC.shrink = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
/* ---------- เต็มจอ (ซ่อนแถบเบราว์เซอร์ เหมาะกับเช็กชื่อ/กรอกคะแนนบนแท็บเล็ต) ---------- */
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsOk = !!(root.requestFullscreen || root.webkitRequestFullscreen);
function toggleFull() {
  if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else { const r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (r && r.catch) r.catch(() => toast('เบราว์เซอร์นี้ไม่อนุญาตให้ขยายเต็มจอ')); }
}
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { if (typeof renderTop === 'function') renderTop(); }));
IC.menu = '<path d="M4 6h16M4 12h16M4 18h16"/>';
IC.chev = '<path d="M6 9l6 6 6-6"/>';
IC.search = '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>';
IC.swap = IC.swap || '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>';
IC.bell = IC.bell || '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 20a2 2 0 0 1-3.4 0"/>';
const SKINS = [
  ['pro', 'โปร (Pro UI)', 'สุภาพ อ่านสบาย เป็นทางการ โทนเลือดหมูสุภาพ การ์ดลอยเงานุ่ม (มาตรฐานใหม่)'],
  ['clean', 'เรียบ สะอาดตา', 'แบบแอปสากล โทนเทาเย็น เส้นบาง ข้อมูลแน่น อ่านตารางง่าย — เหมาะกับงานกรอกคะแนนบนคอม'],
  ['campus', 'สถาบัน', 'เมนูซ้ายสีประจำโรงเรียน เส้นทองตามตรา ดูเป็นทางการ — เหมาะกับผู้บริหารและฝ่ายงาน'],
  ['soft', 'เป็นมิตร', 'การ์ดลอยมุมมน ปุ่มแคปซูล สีพาสเทล — เหมาะกับแท็บเล็ตและจอสัมผัส'],
  ['classic', 'แบบเดิม', 'หน้าตาต้นแบบเดิมของ EMS']];
const skin = () => SKINS.some(s => s[0] === S.prefs.skin) ? S.prefs.skin : 'pro';
const applySkin = () => { root.dataset.skin = skin(); };
applySkin();

/* ---------- โครงหน้าจอ: แถบด้านบน ---------- */
const view$ = $('#view'), wrap = document.createElement('div'), top = document.createElement('header');
wrap.className = 'mainwrap'; top.id = 'topbar'; view$.parentNode.insertBefore(wrap, view$); wrap.append(top, view$);
let acct = false;
const N = () => window.EMSNav || {};
const curView = () => (N().view ? N().view() : 'teacher');
function crumb() {
  for (const [g, items] of ((N().NAVG || {})[curView()] || [])) for (const it of items) if (it[0] === page) return [g, it[1]];
  return page === 'prefs' ? ['บัญชี', 'ปรับแต่งการแสดงผล'] : ['', ''];
}
function bell() {
  const v = curView();
  if (window.EMSNotify && v !== 'student') return { list: EMSNotify.GROUPS.map(([g, , icon]) => { const s = EMSNotify.summary(g); return { g, icon, n: s.n, t: s.t, lv: s.per.urgent ? 'urgent' : s.per.todo ? 'todo' : 'info' }; }).filter(x => x.n > 0) };
  if (v === 'admin') return { n: (S.pending || []).length, p: 'a-approve', t: 'รายการรออนุมัติ' };
  if (v === 'student') return { n: 0, p: 's-home', t: 'ประกาศ' };
  const n = (S.xreqs || []).filter(r => r.target === S.me.name && r.status === 'pending').length;
  return { n, p: 'swap', t: n ? 'คำขอแลกคาบ/สอนแทนรอคุณตอบรับ ' + n + ' รายการ' : 'ไม่มีคำขอรอตอบรับ' };
}
function who() {
  if (curView() === 'student' && N().stu) { const x = N().stu(); return { n: x.s.name, r: 'นักเรียน ' + x.c.name }; }
  return { n: S.me.name, r: (ROLES[S.me.role] || '') + ' · ' + S.me.dept };
}
function renderTop() {
  const [g, l] = crumb(), b = bell(), w = who(), ini = esc(w.n.replace(/^(ครู|ผอ\.)/, '').charAt(0));
  const rail = S.prefs.nav === 'rail';
  top.innerHTML = `<div class="tb-l"><button class="tb-ic tb-side" data-sk="side" title="${rail ? 'ขยายเมนูด้านซ้าย' : 'ย่อเมนูด้านซ้าย'}" aria-label="${rail ? 'ขยายเมนูด้านซ้าย' : 'ย่อเมนูด้านซ้าย'}" aria-pressed="${rail}">${ic('menu')}</button><button class="tb-brand" data-act="go" data-p="${window.homeOf ? homeOf() : 'home'}" aria-label="หน้าหลัก"><img src="icons/school-logo.png" alt=""><b>EMS</b></button>
      <div class="tb-crumb">${g ? esc(g) + ' <span aria-hidden="true">›</span> ' : ''}<b>${esc(l || 'EMS')}</b></div></div>
    <button class="tb-search" data-sk="palette" aria-label="ค้นหาเมนู">${ic('search')}<span>ค้นหาเมนูหรือหน้า…</span><kbd>Ctrl K</kbd></button>
    <div class="tb-r">${b.list ? (b.list.length ? `<span class="tb-bells">${b.list.map(x => `<button class="tb-bell lv-${x.lv}" data-nt="toggle" data-g="${x.g}" aria-haspopup="dialog" title="${esc(x.t)}" aria-label="${esc(x.t)}"><span class="bi" aria-hidden="true">${x.icon}</span><span class="bn">${EMSNotify.count(x.n)}</span></button>`).join('')}</span>` : '')
      : b.n ? `<button class="tb-ic" data-act="go" data-p="${b.p}" title="${esc(b.t)}" aria-label="${esc(b.t)}">${ic('bell')}<span class="dot">${b.n > 9 ? '9+' : b.n}</span></button>` : ''}
      ${fsOk ? `<button class="tb-ic" data-sk="full" title="${fsEl() ? 'ออกจากเต็มจอ (Esc)' : 'ขยายเต็มจอ (F11)'}" aria-label="${fsEl() ? 'ออกจากเต็มจอ' : 'ขยายเต็มจอ'}" aria-pressed="${!!fsEl()}">${ic(fsEl() ? 'shrink' : 'expand')}</button>` : ''}
      <button class="tb-ic" type="button" data-sysmenu title="ระบบอื่นของโรงเรียน" aria-label="ระบบอื่นของโรงเรียน">${ic('grid')}</button>
      <button class="tb-ic" data-act="theme" title="สลับโหมดมืด/สว่าง" aria-label="สลับโหมดมืด/สว่าง">${ic('moon')}</button>
      <div class="tb-wrap"><button class="tb-av" data-sk="acct" aria-expanded="${acct}" aria-haspopup="true"><span class="avatar">${ini}</span><span class="tb-nm">${esc(w.n)}</span></button>
        ${acct ? `<div class="acct-menu" role="menu"><div class="who"><div class="avatar">${ini}</div><div><div class="n">${esc(w.n)}</div><div class="r">${esc(w.r)}</div></div></div>
          ${N().switcher ? N().switcher() : ''}
          <div class="field" style="margin:10px 0 0"><span class="f small muted">รูปแบบหน้าจอ</span><div class="sk-mini">${SKINS.map(([k, n]) => `<button class="pill" aria-pressed="${skin() === k}" data-sk="set" data-k="${k}">${n}</button>`).join('')}</div></div>
          ${window.EMSType ? EMSType.html() : ''}
          <div class="acct-links"><button class="nav" data-ct="open" data-k="bug">${ic('inbox')}<span>ติดต่อแอดมิน / แจ้งปัญหา</span></button>${window.EMSInstall && EMSInstall.can() ? `<button class="nav" data-pwa="install">${ic('down')}<span>ติดตั้งแอป EMS บนเครื่องนี้</span></button>` : ''}<button class="nav" data-act="go" data-p="prefs">${ic('gear')}<span>ปรับแต่งการแสดงผลทั้งหมด</span></button>
          <button class="nav" data-act="logout">${ic('out')}<span>ออกจากระบบ</span></button></div></div>` : ''}</div></div>`;
}
/* เมนูซ้ายเหลือเฉพาะการนำทาง */
function groupSide(side) {
  const closed = S.prefs.navClosed || {}; let body = null;
  [...side.children].forEach(el => {
    if (el.classList.contains('navgroup')) {
      const name = el.textContent.trim(), b = document.createElement('div');
      b.className = 'ng-body'; const btn = document.createElement('button');
      btn.className = 'navgroup ng-btn'; btn.dataset.sk = 'grp'; btn.dataset.g = name;
      btn.innerHTML = `<span>${esc(name)}</span><span class="ng-pm" aria-hidden="true"></span>`;      // วงกลม + (ย่ออยู่) / − (กางอยู่)
      el.replaceWith(btn); btn.after(b); body = b; b.dataset.g = name; return;
    }
    if (el.classList.contains('grow')) { body = null; return; }
    if (body && el.classList.contains('nav')) body.appendChild(el);
  });
  /* กลุ่มที่ย่อ: ซ่อนเมนูทั้งกลุ่ม ยกเว้นหน้าที่เปิดอยู่ (ยังเห็นว่าอยู่ตรงไหน) */
  side.querySelectorAll('.ng-body').forEach(b => { const shut = !!closed[b.dataset.g];
    b.classList.toggle('ng-shut', shut); b.previousElementSibling.setAttribute('aria-expanded', String(!shut)); });
}
function trimSide() {
  const side = $('#side'), sp = side && side.querySelector('.grow'); if (!sp) return;
  groupSide(side);
  while (sp.nextSibling) sp.nextSibling.remove();
  sp.insertAdjacentHTML('afterend', `<button class="side-k" data-sk="palette">${ic('search')}<span>ค้นหาเมนู</span><kbd>Ctrl K</kbd></button>`);
}
const baseChrome = window.renderChrome;
window.renderChrome = function () { baseChrome.apply(this, arguments); root.dataset.page = page; trimSide(); renderTop(); root.style.setProperty('--topbar-h', top.offsetHeight + 'px'); };
window.addEventListener('resize', () => root.style.setProperty('--topbar-h', top.offsetHeight + 'px'));

/* ---------- ค้นหาเมนู (Ctrl K) ---------- */
let PAL = [], palI = 0;
function palItems() {
  const out = [];
  const hid = window.EMSNavHidden || {}, off = k => { try { return !!(hid[k] && hid[k]()); } catch (e) { return false; } };      // เมนูที่โมดูลซ่อนตามสิทธิ์/สถานะ (เหมือนแถบเมนู)
  ((N().NAVG || {})[curView()] || []).forEach(([g, items]) => items.forEach(([k, l, i]) => { if (!off(k)) out.push({ k, l, g: g || 'หลัก', i }); }));
  out.push({ k: 'prefs', l: 'ปรับแต่งการแสดงผล', g: 'บัญชี', i: 'gear' });
  out.push({ ct: 1, k: '__ct', l: 'ติดต่อแอดมิน / แจ้งปัญหา', g: 'ช่วยเหลือ', i: 'inbox' });
  if (window.EMSInstall && EMSInstall.can()) out.push({ inst: 1, k: '__inst', l: 'ติดตั้งแอป EMS', g: 'ช่วยเหลือ', i: 'down' });
  if (fsOk) out.push({ full: 1, k: '__full', l: 'ขยายเต็มจอ / ออกจากเต็มจอ', g: 'หน้าจอ', i: 'expand' });
  SKINS.forEach(([k, n]) => out.push({ sk: k, l: 'เปลี่ยนรูปแบบหน้าจอ: ' + n, g: 'รูปแบบ', i: 'grid' }));
  return out;
}
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
const ALIAS = { summary: 'ปพ5 สอบ กำหนดการสอบ กลางภาค ปลายภาค เกรด ส่งออก excel', swap: 'สอนแทน ลา แลกคาบ สลับคาบ', attendance: 'เช็คชื่อ มาสาย ขาด เข้าแถว',
  leaves: 'ลา ไปราชการ ลาป่วย ลากิจ', schedule: 'ตารางเรียน คาบ', scores: 'คะแนน กรอกคะแนน เสียง', items: 'หน่วย คะแนนย่อย', 'a-academic': 'ตารางสอบ สอบ ปฏิทิน งานวิชาการ',
  'a-measure': 'คะแนน ภาระงาน ชนคาบ 0 ร มส', 'a-settings': 'วันหยุด ภาคเรียน ตรา โรงเรียน สลับวัน ตารางสอนทั้งโรงเรียน', 'a-users': 'ครู สิทธิ์ ที่ปรึกษา บุคลากร หัวหน้า',
  'a-leaves': 'ลา อนุมัติ สอนแทน', 'a-affairs': 'พฤติกรรม มาสาย', affairs: 'พฤติกรรม หักคะแนน', prefs: 'ธีม สี ฟอนต์ ภาษา มืด รูปแบบ', __full: 'เต็มจอ fullscreen ขยาย', __ct: 'แอดมิน แจ้งปัญหา ติดต่อ ช่วยเหลือ ขอสิทธิ์', __inst: 'ติดตั้ง แอป install หน้าจอโฮม' };
function palDraw() {
  const q = norm(($('#pal-q') || {}).value), all = palItems();
  PAL = q ? all.filter(x => norm(x.l + x.g + (ALIAS[x.k] || '')).indexOf(q) >= 0).sort((a, b) => (norm(b.l).indexOf(q) >= 0) - (norm(a.l).indexOf(q) >= 0)) : all;
  palI = Math.min(palI, Math.max(0, PAL.length - 1));
  const box = $('#pal-list'); if (!box) return;
  box.innerHTML = PAL.length ? PAL.map((x, i) => `<button class="pal-it ${i === palI ? 'on' : ''}" data-sk="palGo" data-i="${i}" role="option" aria-selected="${i === palI}">${ic(x.i)}<span>${esc(x.l)}</span><small>${esc(x.g)}</small></button>`).join('')
    : '<div class="empty">ไม่พบเมนูที่ตรงกับคำค้น</div>';
  const on = box.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function palette() {
  acct = false; palI = 0;
  modal(`<div class="pal"><div class="pal-in">${ic('search')}<input id="pal-q" class="in" placeholder="พิมพ์ชื่อเมนู เช่น เช็กชื่อ ใบลา ตารางสอบ" autocomplete="off" aria-label="ค้นหาเมนู" role="combobox" aria-controls="pal-list"></div>
    <div id="pal-list" class="pal-list" role="listbox"></div><div class="muted small" style="margin-top:8px">↑ ↓ เลือก · Enter เปิด · Esc ปิด</div></div>`, true);
  const s = $('#layer .sheet'); if (s) { s.style.maxWidth = '560px'; s.style.alignSelf = 'flex-start'; s.style.marginTop = '10vh'; }
  palDraw(); setTimeout(() => { const i = $('#pal-q'); if (i) i.focus(); }, 30);
}
function palPick(x) {
  if (!x) return; closeModal();
  if (x.full) return toggleFull();
  if (x.ct) return window.EMSContact && EMSContact.open('bug');
  if (x.inst) return EMSInstall.prompt();
  if (x.sk) { setSkin(x.sk); return; }
  go(x.k);
}

/* ---------- เลือกรูปแบบ ---------- */
function setSkin(k) { S.prefs.skin = k; S.prefs.skinChosen = true; save(); applySkin(); const y = scrollY; render(); scrollTo(0, y); toast('ใช้รูปแบบ “' + SKINS.find(s => s[0] === k)[1] + '” แล้ว'); }
const TH = {   // สีย่อสำหรับภาพตัวอย่าง [พื้น, เมนู, การ์ด, เส้น, เน้น, มุม]
  pro: ['#f5f7fa', '#ffffff', '#ffffff', '#e6e9ee', '#9a2f3f', '16px'],      // รูปแบบตั้งต้น — เดิมไม่มี ทำให้หน้าต่างเลือกรูปแบบตอนเข้าครั้งแรกพัง
  clean: ['#f6f7f9', '#ffffff', '#ffffff', '#e6e8ec', '#7a1f2b', '6px'],
  campus: ['#f3f0eb', 'linear-gradient(180deg,#4e121b,#7a1f2b)', '#ffffff', '#e4ddd2', '#b8892b', '4px'],
  soft: ['linear-gradient(135deg,#f4f2fa,#fbeef0)', '#ffffff', '#ffffff', 'transparent', '#7a1f2b', '12px'],
  classic: ['#f6f4f1', '#ffffff', '#ffffff', '#e7e2db', '#7a1f2b', '8px'] };
function thumb(k) {
  const [bg, side, card, line, acc, r] = TH[k], sh = k === 'soft' ? 'box-shadow:0 3px 8px rgba(60,40,100,.12);' : '', cardS = `background:${card};border:1px solid ${line};border-radius:${r};${sh}`;
  const ln = (w, c) => `<i style="display:block;height:5px;width:${w};border-radius:3px;background:${c};margin:5px 0"></i>`;
  const sideInk = k === 'campus' ? 'rgba(255,255,255,.55)' : '#d6d3d1', act = k === 'campus' ? '#e8c77a' : acc;
  return `<div class="sk-th" style="background:${bg}" aria-hidden="true">
    <div style="background:${side};${k === 'soft' ? 'margin:6px;border-radius:12px;' + sh : 'border-right:1px solid ' + line + ';'}padding:8px 6px">
      <i style="display:block;width:16px;height:16px;border-radius:50%;background:${k === 'campus' ? '#fff' : acc};margin-bottom:8px"></i>${ln('80%', act)}${ln('70%', sideInk)}${ln('85%', sideInk)}${ln('60%', sideInk)}${ln('75%', sideInk)}</div>
    <div style="padding:6px 8px;display:flex;flex-direction:column;gap:6px">
      <div style="height:12px;border-bottom:1px solid ${line};${k === 'campus' ? 'box-shadow:inset 0 2px 0 #b8892b;' : ''}display:flex;justify-content:flex-end;gap:4px"><i style="width:30px;height:7px;border-radius:9px;background:${k === 'soft' ? '#fff' : line}"></i></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px">${[0, 1, 2].map(i => `<div style="${cardS}height:24px;${k === 'campus' ? 'border-left:3px solid ' + (i ? acc : '#7a1f2b') + ';' : ''}${k === 'soft' ? 'background:' + ['#e4eefa', '#e3f3ea', '#faf1dc'][i] + ';' : ''}"></div>`).join('')}</div>
      <div style="${cardS}flex:1;padding:5px">${ln('40%', k === 'campus' ? '#7a1f2b' : '#9ca3af')}${ln('90%', line === 'transparent' ? '#eee' : line)}${ln('80%', line === 'transparent' ? '#eee' : line)}<i style="display:inline-block;width:34px;height:9px;border-radius:${k === 'soft' ? '9px' : '3px'};background:${acc === '#b8892b' ? '#7a1f2b' : acc}"></i></div></div></div>`;
}
const skinCards = (attr) => `<div class="sk-grid">${SKINS.map(([k, n, d]) => `<button class="sk-card" aria-pressed="${skin() === k}" data-sk="${attr}" data-k="${k}">${thumb(k)}<b>${n}</b>${k === 'clean' ? ' <span class="chip ok">แนะนำ</span>' : ''}<div class="muted small">${d}</div></button>`).join('')}</div>`;
function picker() {
  modal(`<h2 style="margin-bottom:4px">เลือกรูปแบบหน้าจอ EMS</h2><p class="muted small" style="margin-bottom:12px">แตะเพื่อลองดูได้ทันที — เปลี่ยนภายหลังได้ที่รูปบัญชีมุมขวาบน หรือหน้าปรับแต่งการแสดงผล</p>
    ${skinCards('try')}<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn pri" data-sk="done">ใช้รูปแบบนี้</button></div>`, true);
  const s = $('#layer .sheet'); if (s) s.style.maxWidth = '900px';
}
/* หน้าปรับแต่ง: ใส่ตัวเลือกรูปแบบไว้บนสุด */
const basePrefs = P.prefs;
P.prefs = () => basePrefs().replace('<div class="card"><h2>สไตล์สำเร็จรูป</h2>', `<div class="card"><h2>รูปแบบหน้าจอ</h2><p class="muted small" style="margin:-6px 0 12px">เปลี่ยนโครงสีและลักษณะทั้งแอป ใช้ร่วมกับการปรับด้านล่างได้</p>${skinCards('set')}</div>
  <div class="card"><h2>สไตล์สำเร็จรูป</h2>`);

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-sk]');
  if (!t) { if (acct && !e.target.closest('.acct-menu')) { acct = false; renderTop(); } return; }
  const d = t.dataset;
  switch (d.sk) {
    case 'acct': acct = !acct; return renderTop();
    case 'side': EMSPrefs.set('nav', S.prefs.nav === 'rail' ? 'full' : 'rail'); return render();
    case 'grp': { const c = S.prefs.navClosed = S.prefs.navClosed || {}; c[d.g] = !c[d.g]; if (!c[d.g]) delete c[d.g]; save();
      const b = t.nextElementSibling; if (b) { b.classList.toggle('ng-shut', !!c[d.g]); t.setAttribute('aria-expanded', String(!c[d.g])); } return; }
    case 'palette': return palette();
    case 'full': return toggleFull();
    case 'palGo': return palPick(PAL[+d.i]);
    case 'set': acct = false; return setSkin(d.k);
    case 'try': S.prefs.skin = d.k; applySkin(); document.querySelectorAll('.sk-card').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === d.k))); return;
    case 'done': S.prefs.skinChosen = true; save(); closeModal(); render(); return toast('ใช้รูปแบบ “' + SKINS.find(s => s[0] === skin())[1] + '” แล้ว');
  }
});
document.addEventListener('click', e => { if (acct && e.target.closest('.acct-menu [data-act]')) { acct = false; } }, true);
document.addEventListener('input', e => { if (e.target.id === 'pal-q') { palI = 0; palDraw(); } });
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '');
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); return palette(); }
  if (e.key === '/' && !typing && !$('#layer .sheet')) { e.preventDefault(); return palette(); }
  if (e.target.id === 'pal-q') {
    if (e.key === 'ArrowDown') { e.preventDefault(); palI = Math.min(PAL.length - 1, palI + 1); palDraw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palI = Math.max(0, palI - 1); palDraw(); }
    else if (e.key === 'Enter') { e.preventDefault(); palPick(PAL[palI]); }
  }
  if (e.key === 'Escape') { if (acct) { acct = false; renderTop(); } else if ($('#layer .sheet')) closeModal(); }
});
/* ครั้งแรกหลังเข้าสู่ระบบ ให้เลือกรูปแบบ */
if (!S.prefs.skinChosen) {
  const timer = setInterval(() => { const g = document.getElementById('gate'); if (g && !g.hidden) return; if ($('#layer .sheet')) return; clearInterval(timer); if (!S.prefs.skinChosen) { if (!S.prefs.skin) { S.prefs.skin = 'clean'; applySkin(); render(); } picker(); } }, 700);
}

/* ---------- CSS ---------- */
const st = document.createElement('style');
st.textContent = `
.mainwrap{min-width:0;display:flex;flex-direction:column}
main{max-width:none}
#topbar{position:sticky;top:0;z-index:25;display:flex;align-items:center;gap:10px;padding:9px clamp(16px,4vw,44px);background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
#topbar svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}
.tb-l{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.tb-brand{display:none;align-items:center;gap:8px;border:0;background:none;padding:0;font-weight:700;color:var(--text)}
.tb-brand img{width:30px;height:auto}
.tb-crumb{font-size:.88rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb-crumb b{color:var(--text);font-weight:600}
.tb-search{display:flex;align-items:center;gap:8px;width:300px;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 10px;color:var(--muted);font-size:.9rem;text-align:left;min-height:38px}
.tb-search:hover{border-color:var(--muted)}
.tb-search kbd,.side-k kbd{margin-left:auto;font:inherit;font-size:.7rem;border:1px solid var(--line);border-radius:6px;padding:0 6px;background:var(--surface2);color:var(--muted)}
.tb-r{display:flex;align-items:center;gap:4px}
.tb-ic{position:relative;width:40px;height:40px;border-radius:10px;border:0;background:none;display:grid;place-items:center;color:var(--text)}
.tb-ic:hover{background:var(--surface2)}
/* กระดิ่งแบบ KruSpace: เม็ดยา ไอคอน+ตัวเลข · สีตามระดับ เงิน = แจ้งให้ทราบ · ทอง = ต้องทำ · แดง = ด่วน · สั่นเป็นจังหวะ */
.tb-bells{display:inline-flex;gap:6px;margin-right:6px}
.tb-bell{--c:#8a94a3;display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 9px 0 8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 55%,var(--line));background:color-mix(in srgb,var(--c) 13%,var(--surface));color:var(--c);font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
.tb-bell:hover{background:color-mix(in srgb,var(--c) 22%,var(--surface))}
.tb-bell.lv-todo{--c:#c9971c}.tb-bell.lv-urgent{--c:var(--bad)}
.tb-bell .bn{min-width:21px;height:21px;padding:0 6px;border-radius:999px;background:var(--c);color:#fff;font-size:12.5px;line-height:21px;text-align:center}
.tb-bell .bi{display:inline-block;transform-origin:50% 10%;animation:tbRing 2.6s ease-in-out infinite}
.tb-bell.lv-urgent .bi{animation-duration:1.6s}.tb-bell.lv-info .bi{animation-duration:4.5s}
@keyframes tbRing{0%,78%,100%{transform:rotate(0)}82%{transform:rotate(14deg)}86%{transform:rotate(-12deg)}90%{transform:rotate(8deg)}94%{transform:rotate(-4deg)}}
@media (prefers-reduced-motion:reduce){.tb-bell .bi{animation:none!important}}
@media (min-width:861px){.tb-r{flex:1 1 0;justify-content:flex-end}.tb-l{flex:1 1 0}.tb-search{flex:0 1 340px;width:auto}}
@media (min-width:861px) and (max-width:1400px){.tb-nm{display:none}}
@media (max-width:480px){.tb-bells{gap:3px;margin-right:2px}.tb-bell{height:30px;padding:0 6px;gap:3px;font-size:13px}.tb-bell .bn{min-width:18px;height:18px;line-height:18px;font-size:11px;padding:0 4px}}
.tb-ic .dot{position:absolute;top:1px;right:0;background:var(--bad);color:#fff;border-radius:99px;font-size:.68rem;line-height:1;min-width:18px;height:18px;display:grid;place-items:center;padding:0 4px;font-weight:700;white-space:nowrap;box-shadow:0 0 0 2px var(--surface)}
.tb-wrap{position:relative}
.tb-av{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:3px 12px 3px 3px;margin-left:4px}
.tb-av .avatar{width:32px;height:32px;font-size:.85rem}
.tb-nm{font-size:.86rem;font-weight:600;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acct-menu{position:absolute;right:0;top:calc(100% + 8px);width:310px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);box-shadow:0 14px 40px rgba(0,0,0,.18);padding:12px;z-index:30;max-height:calc(100vh - 90px);overflow:auto}
.acct-menu .who{margin-bottom:4px}
.acct-links{border-top:1px solid var(--line);margin-top:10px;padding-top:6px}
.sk-mini{display:flex;gap:6px;flex-wrap:wrap}.sk-mini .pill{min-height:32px;padding:3px 10px;font-size:.82rem}
.ng-btn{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;background:none;text-align:left;cursor:pointer;border-radius:6px}
.ng-pm{position:relative;flex:none;width:18px;height:18px;border-radius:50%;border:1.5px solid currentColor;opacity:.75;transition:background .15s,opacity .15s}
.ng-pm::before,.ng-pm::after{content:"";position:absolute;left:50%;top:50%;background:currentColor;border-radius:1px;transform:translate(-50%,-50%)}
.ng-pm::before{width:8px;height:1.5px}
.ng-pm::after{width:1.5px;height:8px;transition:transform .15s}
.ng-btn[aria-expanded="true"] .ng-pm::after{transform:translate(-50%,-50%) scaleY(0)}
.ng-btn:hover .ng-pm{opacity:1;background:var(--surface-2,rgba(127,127,127,.12))}
.ng-btn:hover{color:var(--text)}
.ng-body.ng-shut > .nav:not([aria-current="page"]){display:none}
:root[data-nav="rail"] .ng-body.ng-shut > .nav{display:flex!important}
.ng-body{display:flex;flex-direction:column;gap:inherit}
:root[data-nav="rail"] .ng-body{display:flex!important}
:root[data-nav="rail"] .ng-btn{display:none}
.tb-side{margin-left:-6px}
@media (max-width:860px){.tb-side{display:none}}
:root[data-nav="rail"] .side-k span,:root[data-nav="rail"] .side-k kbd{display:none}
:root[data-nav="rail"] .side-k{justify-content:center;padding:9px 0}
.side-k{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:1px dashed var(--line);border-radius:10px;background:none;color:var(--muted);font-size:.88rem;margin-top:8px}
.side-k svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round}
.pal-in{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);padding-bottom:10px}
.pal-in svg{width:20px;height:20px;stroke:var(--muted);fill:none;stroke-width:2;flex:none}
.pal-in .in{border:0;min-height:40px;padding:4px 0;font-size:1.05rem;background:none}
.pal-in .in:focus{outline:0}
.pal-list{max-height:52vh;overflow:auto;margin-top:6px;display:flex;flex-direction:column;gap:2px}
.pal-it{display:flex;gap:10px;align-items:center;width:100%;padding:9px 10px;border:0;background:none;border-radius:10px;text-align:left;color:var(--text)}
.pal-it svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;flex:none;color:var(--muted)}
.pal-it small{margin-left:auto;color:var(--muted);font-size:.78rem}
.pal-it.on,.pal-it:hover{background:var(--brand-soft);color:var(--brand)}.pal-it.on svg{color:var(--brand)}
.sk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.sk-card{border:2px solid var(--line);border-radius:14px;padding:10px;background:var(--surface);text-align:left;color:var(--text)}
.sk-card:hover{border-color:var(--muted)}
.sk-card[aria-pressed="true"]{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.sk-card b{font-size:1rem}
.sk-th{height:112px;border-radius:10px;overflow:hidden;display:grid;grid-template-columns:30% 1fr;margin-bottom:8px;border:1px solid rgba(0,0,0,.08)}
@media (max-width:860px){
  #topbar{padding:8px 12px;gap:6px}
  .tb-brand{display:flex}.tb-crumb{display:none}
  .tb-search{width:40px;padding:0;justify-content:center;border:0;background:none}
  .tb-search span,.tb-search kbd,.tb-nm{display:none}
  .tb-av{padding:2px;border:0;background:none;margin:0}
  main{padding-top:14px}
}
@media (max-width:480px){
  #topbar{padding:8px 8px;gap:2px}.tb-r{gap:0}.tb-ic,.tb-search{width:34px}.tb-ic[data-sk="full"]{display:none}.tb-brand b{display:none}
}
@media print{#topbar{display:none!important}}
/* ปุ่มแบ่งส่วน (.seg) ที่เลือกอยู่ต้องเห็นชัด — ปุ่มสถานะเช็กชื่อ (.p/.l/.a) มีสีของตัวเองอยู่แล้ว */
.seg button[aria-pressed="true"]{background:var(--brand-soft);color:var(--brand);font-weight:700}
/* ความต่างสีที่ต้องอ่านออกทุกธีม */
:root[data-scheme="light"] .chip.gold{color:#7d5a12}
:root[data-scheme="dark"] .dot{color:#2a0d0b}
:root[data-accent]:not([data-accent="maroon"]) .next,:root[data-accent]:not([data-accent="maroon"]) .next .muted{color:var(--brand-ink)}
:root[data-accent]:not([data-accent="maroon"]) .next .muted{opacity:.8}
.x-box.mk.pick{color:var(--brand-ink)}
a.btn{color:var(--text);text-decoration:none}a.btn.pri{color:var(--brand-ink)}
:root[data-scheme="dark"] .ems-segbar{color:#14100c!important}
:root[data-scheme="dark"] .x-tag.trade{color:#c3a4f0}:root[data-scheme="dark"] .x-tag.swap{color:#f0b54f}:root[data-scheme="dark"] .x-tag.sub{color:#5ad1c6}

/* ===== pro: โปร (Pro UI) ตามมาตรฐาน ThemeKit & DecorKit ===== */
:root[data-skin="pro"]{
  --r:16px;
  --brand:#9a2f3f; --brand-rgb:154,47,63; --brand-dark:#7b2230; --brand-darker:#5c1823; --brand-light:#c4566a;
  --brand-ink:#fff; --brand-soft:#fcf4f6; --brand-100:#f5e3e7;
  --gold:#c9a35a; --gold-light:#efe0bf; --gold-soft:#fcf8ee;
  --shadow-sm:0 1px 2px rgba(38,50,63,.05),0 2px 6px rgba(38,50,63,.05);
  --shadow:0 1px 2px rgba(38,50,63,.04),0 4px 12px rgba(38,50,63,.06),0 12px 28px rgba(38,50,63,.04);
  --shadow-lg:0 2px 4px rgba(38,50,63,.05),0 10px 24px rgba(38,50,63,.09),0 28px 56px rgba(38,50,63,.08);
  --grad:linear-gradient(135deg,var(--brand-dark) 0%,var(--brand) 55%,var(--brand-light) 100%);
  --grad-soft:linear-gradient(135deg,var(--brand-100) 0%,var(--brand-soft) 45%,#ffffff 100%);
}
:root[data-skin="pro"][data-scheme="light"]{
  --bg:#f5f7fa; --surface:#ffffff; --surface2:#f9fafc; --line:#e6e9ee; --line-2:#d2d8df; --text:#26323f; --muted:#67737f;
}
:root[data-skin="pro"][data-scheme="dark"]{
  --bg:#14171c; --surface:#1b1f26; --surface2:#232832; --line:#2c333f; --line-2:#3d4654; --text:#f1f4f8; --muted:#94a0b2;
  --brand:#f4a9a9; --brand-rgb:244,169,169; --brand-ink:#2a0a10; --brand-soft:rgba(154,47,63,.22);
}
:root[data-skin="pro"] body{background:linear-gradient(180deg,var(--brand-soft) 0,#ffffff 180px,var(--bg) 520px) no-repeat,var(--bg)}
:root[data-skin="pro"] .card{border:1px solid var(--line);box-shadow:var(--shadow);border-radius:16px}
:root[data-skin="pro"] .btn.pri{background:var(--grad);border-color:transparent;box-shadow:0 4px 14px rgba(var(--brand-rgb),.24)}
:root[data-skin="pro"] #topbar{background:rgba(255,255,255,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--line);box-shadow:0 2px 8px rgba(38,50,63,.04)}
:root[data-skin="pro"][data-scheme="dark"] #topbar{background:rgba(27,31,38,.94);border-bottom-color:var(--line)}
:root[data-skin="pro"] .side{background:var(--surface);border-right:1px solid var(--line)}
:root[data-skin="pro"] .side .nav{border-radius:12px;color:var(--muted);font-weight:500}
:root[data-skin="pro"] .side .nav:hover{background:var(--surface2);color:var(--text)}
:root[data-skin="pro"] .side .nav[aria-current="page"]{background:var(--brand-soft);color:var(--brand);font-weight:600}

/* ===== clean: เรียบ สะอาดตา ===== */
:root[data-skin="clean"]{--r:10px}
:root[data-skin="clean"][data-scheme="light"]{--bg:#f6f7f9;--surface:#fff;--surface2:#f3f4f6;--line:#e6e8ec;--text:#14171c;--muted:#667085;--shadow:none}
:root[data-skin="clean"][data-scheme="dark"]{--bg:#0e1013;--surface:#15181d;--surface2:#1b1f25;--line:#272c34;--text:#e7e9ec;--muted:#98a1ad;--shadow:none}
:root[data-skin="clean"] .side{padding:14px 10px;gap:1px}
:root[data-skin="clean"] .brand{padding:4px 8px 14px}
:root[data-skin="clean"] .nav{padding:7px 10px;border-radius:8px;font-size:.93rem;color:var(--muted)}
:root[data-skin="clean"] .nav svg{width:18px;height:18px}
:root[data-skin="clean"] .nav:hover{color:var(--text);background:var(--surface2)}
:root[data-skin="clean"] .nav[aria-current="page"]{background:var(--surface2);color:var(--text);font-weight:600;box-shadow:inset 3px 0 0 var(--brand)}
:root[data-skin="clean"] .nav[aria-current="page"] svg{color:var(--brand)}
:root[data-skin="clean"] .navgroup{font-size:.7rem;letter-spacing:.03em;padding:16px 10px 4px}
:root[data-skin="clean"] h1{font-size:1.4rem;letter-spacing:-.01em}
:root[data-skin="clean"] .card{box-shadow:none}
:root[data-skin="clean"] .card > h2,:root[data-skin="clean"] .card h2{font-size:1rem}
:root[data-skin="clean"] .btn{border-radius:8px;min-height:38px;padding:7px 14px;font-weight:500}
:root[data-skin="clean"] .btn.pri{font-weight:600}
:root[data-skin="clean"] .btn.sm{min-height:32px}
:root[data-skin="clean"] .in{border-radius:8px;min-height:40px}
:root[data-skin="clean"] .pill{border-radius:8px;min-height:34px;padding:5px 12px}
:root[data-skin="clean"] .chip{border-radius:6px}
:root[data-skin="clean"] .ico{width:36px;height:36px;border-radius:9px}
:root[data-skin="clean"] .kpi .v{font-size:1.7rem;font-variant-numeric:tabular-nums}
:root[data-skin="clean"] .kpi .l{font-size:.8rem;font-weight:500}
:root[data-skin="clean"] .tbl th{background:var(--surface2)}
:root[data-skin="clean"] .tbl tbody tr:hover > td{background:var(--surface2)}
:root[data-skin="clean"] .top{margin-bottom:18px}
:root[data-skin="clean"] #topbar{background:var(--surface)}

/* ===== campus: สถาบัน ===== */
:root[data-skin="campus"]{--r:8px;--side-bg:linear-gradient(180deg,#4e121b 0%,#6e1b27 55%,#7a1f2b 100%);--side-gold:#e8c77a}
:root[data-skin="campus"][data-scheme="light"]{--bg:#f3f0eb;--surface:#fff;--surface2:#f8f5f0;--line:#e4ddd2;--text:#221a16;--muted:#6d6158}
:root[data-skin="campus"][data-scheme="dark"]{--side-bg:linear-gradient(180deg,#1b0c10,#2a1219)}
:root[data-skin="campus"][data-scheme="light"]:not([data-accent="maroon"]){--side-bg:linear-gradient(180deg,color-mix(in srgb,var(--brand) 65%,#000),var(--brand))}
:root[data-skin="campus"] .side{background:var(--side-bg);border-right:0;color:#fff}
:root[data-skin="campus"] .brand{border-bottom:1px solid rgba(255,255,255,.14);margin-bottom:6px}
:root[data-skin="campus"] .brand img{width:42px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
:root[data-skin="campus"] .brand span{color:rgba(255,255,255,.72)}
:root[data-skin="campus"] .navgroup{color:var(--side-gold);opacity:.9}
:root[data-skin="campus"] .side .nav{color:rgba(255,255,255,.86)}
:root[data-skin="campus"] .side .nav:hover{background:rgba(255,255,255,.09)}
:root[data-skin="campus"] .side .nav[aria-current="page"]{background:rgba(255,255,255,.15);color:#fff;box-shadow:inset 3px 0 0 var(--side-gold)}
:root[data-skin="campus"] .side-k{color:rgba(255,255,255,.75);border-color:rgba(255,255,255,.25)}
:root[data-skin="campus"] .side-k kbd{background:transparent;color:rgba(255,255,255,.75);border-color:rgba(255,255,255,.3)}
:root[data-skin="campus"] #topbar{background:var(--surface);box-shadow:inset 0 3px 0 var(--gold)}
:root[data-skin="campus"] h1{color:var(--brand)}
:root[data-skin="campus"] .top{padding-bottom:14px;border-bottom:2px solid var(--line)}
:root[data-skin="campus"] .card{box-shadow:0 1px 0 rgba(0,0,0,.04)}
:root[data-skin="campus"] .card > h2{padding-bottom:8px;border-bottom:1px solid var(--line)}
:root[data-skin="campus"] .kpi{border-left:4px solid var(--gold)}
:root[data-skin="campus"] .grid > .kpi:nth-child(4n+2){border-left-color:var(--brand)}
:root[data-skin="campus"] .grid > .kpi:nth-child(4n+3){border-left-color:var(--ok)}
:root[data-skin="campus"] .grid > .kpi:nth-child(4n){border-left-color:var(--info)}
:root[data-skin="campus"] .btn,:root[data-skin="campus"] .pill,:root[data-skin="campus"] .in{border-radius:6px}
:root[data-skin="campus"] .tbl th{background:var(--surface2);color:var(--text);border-bottom:2px solid var(--brand)}
:root[data-skin="campus"] .ico{border-radius:8px}

/* ===== soft: เป็นมิตร ===== */
:root[data-skin="soft"]{--r:20px}
:root[data-skin="soft"][data-scheme="light"]{--bg:#f4f2fa;--surface:#fff;--surface2:#f7f5fc;--line:#ebe7f3;--text:#231f2e;--muted:#6e6880;--shadow:0 6px 24px rgba(60,40,100,.07)}
:root[data-skin="soft"][data-scheme="dark"]{--bg:#141220;--surface:#1d1a2a;--surface2:#252136;--line:#312c45;--text:#ece9f5;--muted:#a39dba;--shadow:0 6px 24px rgba(0,0,0,.35)}
:root[data-skin="soft"] body{background:radial-gradient(1100px 560px at 100% -10%,var(--brand-soft),transparent 60%),var(--bg);background-attachment:fixed}
:root[data-skin="soft"]:not([data-nav="rail"]) .app{grid-template-columns:262px 1fr}
:root[data-skin="soft"] .side{margin:12px 0 12px 12px;height:calc(100vh - 24px);top:12px;border:0;border-radius:22px;box-shadow:var(--shadow)}
:root[data-skin="soft"] .nav{border-radius:12px}
:root[data-skin="soft"] .side .nav[aria-current="page"]{background:var(--brand);color:var(--brand-ink);box-shadow:0 6px 16px color-mix(in srgb,var(--brand) 32%,transparent)}
:root[data-skin="soft"] .card{border:0;box-shadow:var(--shadow)}
:root[data-skin="soft"] .btn{border-radius:999px}
:root[data-skin="soft"] .btn.pri{box-shadow:0 6px 14px color-mix(in srgb,var(--brand) 28%,transparent)}
:root[data-skin="soft"] .in{border-radius:12px;background:var(--surface2)}
:root[data-skin="soft"] .pill{border-color:transparent;box-shadow:var(--shadow)}
:root[data-skin="soft"] .pill:not([aria-pressed="true"]){background:var(--surface)}
:root[data-skin="soft"] .chip{border-color:transparent}
:root[data-skin="soft"] .ico{border-radius:50%}
:root[data-skin="soft"] .grid > .kpi:nth-child(4n+1){background:var(--info-soft)}
:root[data-skin="soft"] .grid > .kpi:nth-child(4n+2){background:var(--ok-soft)}
:root[data-skin="soft"] .grid > .kpi:nth-child(4n+3){background:var(--gold-soft)}
:root[data-skin="soft"] .grid > .kpi:nth-child(4n){background:var(--act-soft)}
:root[data-skin="soft"] .kpi .l{color:var(--text);opacity:.75}
:root[data-skin="soft"] .tbl th{border-bottom:0;background:var(--surface2)}
:root[data-skin="soft"] .tbl th:first-child{border-radius:12px 0 0 12px}:root[data-skin="soft"] .tbl th:last-child{border-radius:0 12px 12px 0}
:root[data-skin="soft"] #topbar{background:transparent;border-bottom:0}
:root[data-skin="soft"] .tb-search,:root[data-skin="soft"] .tb-av{border-color:transparent;box-shadow:var(--shadow);border-radius:999px}
:root[data-skin="soft"] .action{border:0}
:root[data-skin="soft"] .next{border-radius:24px}
:root[data-skin="soft"] .modal-bg .sheet{border-radius:24px}
:root[data-skin="soft"] .sheet{border-radius:24px 24px 0 0}
@media (max-width:860px){:root[data-skin="soft"] .tb-search{box-shadow:none}}
`;
document.head.appendChild(st);
window.EMSSkin = { set: setSkin, get: skin, picker, palette };
render();                                     // วาดใหม่ให้มีแถบด้านบนตั้งแต่หน้าแรก
})();
