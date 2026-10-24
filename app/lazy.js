/* EMS — โหลดโมดูลเมื่อเปิดใช้ (ไม่ให้ครูทุกคนต้องโหลดของที่ใช้นาน ๆ ครั้งตอนเปิดแอป)
   EMSLazy.page(หน้า, ไฟล์) วางหน้าชั่วคราวไว้ใน P — เปิดครั้งแรกจะโหลดไฟล์ แล้วไฟล์นั้นเขียน P[หน้า] ตัวจริงทับและ render ใหม่
   ส่วนที่ต้องเห็นก่อนโหลดโมดูล (เมนู จุดแจ้งเตือน การ์ดหน้าหลัก) อ่านข้อมูลตรงจาก S ไว้ที่นี่ ซึ่งเบามาก */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const loading = {};
  const load = src => loading[src] || (loading[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => { delete loading[src]; rej(new Error('โหลด ' + src + ' ไม่ได้')); }; document.head.appendChild(s);
  }));
  const lazyPage = (name, src) => {
    P[name] = () => { load(src).then(() => { if (page === name) render(); }).catch(e => toast(e.message + ' — ตรวจอินเทอร์เน็ตแล้วลองใหม่'));
      return `<div class="card" style="text-align:center;padding:40px 16px"><p class="muted">กำลังเปิด…</p></div>`; };
  };

  /* ตัวตนของผู้ใช้ในงานที่ผูกกับบัญชี (จองคิว ฯลฯ) = อีเมลในทะเบียนบุคลากร ถ้ายังไม่มีอีเมลใช้ชื่อแทน */
  const me = () => { const u = (S.staff || []).find(x => x.name === S.me.name); return String((u && u.email) || S.me.email || S.me.name).trim().toLowerCase(); };

  /* ---------- จองคิว DPA / วิทยฐานะ ---------- */
  lazyPage('dpa', 'dpa.js');
  lazyPage('score-sum', 'summary.js');
  const N = window.EMSNav;
  if (N) {
    const add = (v, g, item) => { const grp = (N.NAVG[v] || []).find(x => x[0] === g); if (grp && !grp[1].some(x => x[0] === item[0])) grp[1].push(item); };
    add('teacher', 'งานของฉัน', ['dpa', 'จองคิว DPA / วิทยฐานะ', 'cal']);
    add('admin', 'ฝ่ายงาน', ['dpa', 'จองคิว DPA / วิทยฐานะ', 'cal']);
    add('admin', 'ฝ่ายงาน', ['tt-studio', 'จัดตารางสอน', 'cal']);
    add('admin', 'ฝ่ายงาน', ['score-sum', 'สรุปคะแนน', 'bar']);
  }
  const dpaToday = () => todayISO();
  const dpaPending = () => { const m = me(); return Object.values((S.dpa || {}).slots || {}).filter(s => s.officer === m && s.status === 'requested' && s.date >= dpaToday()).length; };
  const dpaMine = () => { const m = me(), t = dpaToday(); return Object.values((S.dpa || {}).slots || {}).filter(s => s.teacherEmail === m && (s.status === 'requested' || s.status === 'confirmed') && s.date >= t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); };

  /* จัดตารางสอน = หน้าตารางสอนทั้งโรงเรียนในตั้งค่าโรงเรียน (มีปุ่มเปิดแอปจัดตาราง ems/timetable/ และรับตารางกลับ) */
  P['tt-studio'] = () => { S.adm = S.adm || {}; S.adm.sec = 'timetable'; return P['a-settings'] ? P['a-settings']() : ''; };

  /* จุดตัวเลขที่เมนู: เจ้าหน้าที่เห็นจำนวนคำขอที่รอรับ */
  const baseChrome = window.renderChrome;
  window.renderChrome = function () {
    baseChrome.apply(this, arguments);
    const n = dpaPending(), b = document.querySelector('#side .nav[data-p="dpa"]');
    if (b && n && !b.querySelector('.dot')) b.insertAdjacentHTML('beforeend', `<span class="dot">${n}</span>`);
  };
  /* หน้าหลักครู: คิวที่นัดไว้ / คำขอที่รอเจ้าหน้าที่รับ */
  const baseHome = P.home;
  if (baseHome) P.home = () => {
    const h = baseHome(), mine = dpaMine(), n = dpaPending();
    if (!mine.length && !n) return h;
    const rows = mine.slice(0, 2).map(s => `<div class="row"><div class="ico">${ic('cal')}</div><div class="grow"><div class="t">คิว DPA · ${thDate(s.date)} ${esc(s.start)} น.</div><div class="muted small">${esc(s.topic || '')} · ${esc(s.officerName || '')}</div></div>${chip(s.status === 'confirmed' ? 'รับแล้ว' : 'รอรับ', s.status === 'confirmed' ? 'ok' : 'warn')}</div>`).join('') +
      (n ? `<div class="row"><div class="ico gold">${ic('inbox')}</div><div class="grow"><div class="t">มีครูขอคิว DPA รอคุณรับ ${n} รายการ</div></div><button class="btn sm" data-act="go" data-p="dpa">เปิด</button></div>` : '');
    return h + `<div class="card" style="margin-top:14px"><div class="list">${rows}</div></div>`;
  };

  window.EMSLazy = { load, page: lazyPage, me };
})();
