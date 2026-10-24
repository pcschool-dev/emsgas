/* EMS — การใช้งานและค่าใช้จ่าย (หน้าแอดมิน · ระบบ)
   แผน Spark ดึงตัวเลขจาก Google Cloud Monitoring ไม่ได้ (Google ต้องการบัญชีชำระเงิน) จึงให้ EMS "นับเอง":
   - ทุกเครื่องที่เปิด EMS ครอบเมธอด Firestore (get / onSnapshot / set / update / delete / batch) นับ อ่าน · เขียน · ลบ ของตัวเอง
     ตามหลักคิดเงินของ Firestore: ฟังสด = นับเอกสารที่ส่งมาแต่ละรอบ (รอบแรกทั้งหมด รอบต่อไปเฉพาะที่เปลี่ยน) · ผลว่าง = 1 · ข้อมูลจากแคชไม่นับ
   - Hosting: รวมขนาดไฟล์ที่ดาวน์โหลดจากโดเมน EMS จริง (Resource Timing · transferSize — ไฟล์ที่ได้จากแคชเป็น 0)
   - รวมยอดลงเอกสาร usage/{วันตามเวลาแปซิฟิก} (ตรงกับรอบโควตาฟรีรายวัน) อย่างมาก 1 ครั้งต่อ 30 นาทีต่อเครื่อง ด้วย FieldValue.increment
     ระหว่างนั้นเก็บยอดไว้ใน localStorage (ไม่เสียโควตา) — ปิดแอปก่อนครบ 30 นาที ยอดค้างไว้ส่งตอนเปิดครั้งถัดไป
     แยกตามผู้ใช้และหน้า → หน้าแอดมินอ่านเอกสารละวัน (30 วัน ≈ 30 การอ่าน)
   ไม่นับ: แอปสแกนหน้า, คนที่เปิดคอนโซล Firebase, เครื่องที่ปิดก่อนส่งยอด — ตัวเลขจริงดูที่ Firebase Console › Usage and billing */
(() => {
  const PROJECT = ((window.EMS_CONFIG || {}).firebase || {}).projectId || 'dss-pc';
  const FREE = { r: 50000, w: 20000, d: 20000, hbMonth: 10e9 };
  const RATE0 = { r: 0.06, w: 0.18, d: 0.02, hostGB: 0.15, thb: 36 };          // USD ต่อ 100K ครั้ง / ต่อ GB — แก้ได้ในหน้า
  const NAME = { r: 'อ่าน (Reads)', w: 'เขียน (Writes)', d: 'ลบ (Deletes)' };
  const FLUSH_MS = 30 * 60 * 1000, AKEY = 'ems-usage-acc', LKEY = 'ems-usage-last';
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const nf = n => Math.round(n).toLocaleString('th-TH');
  const baht = v => v > 0 && v < 10 ? v.toFixed(2) : nf(v);
  const mb = b => b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(1) + ' MB';
  const rates = () => Object.assign({}, RATE0, (S.settings || {}).usageRates || {});

  /* ---------- วันตามเวลาแปซิฟิก (โควตาฟรีรายวันของ Firestore ตัดรอบตามนี้) ---------- */
  const laDay = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  const shiftDay = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  function laReset() {       // เวลาไทยที่โควตาเริ่มรอบใหม่ (เที่ยงคืนแปซิฟิก)
    for (let h = 0; h < 24; h++) { const t = new Date(); t.setMinutes(0, 0, 0); t.setHours(h); if (laDay(t) !== laDay(t - 3600e3)) return t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
    return '14:00';
  }

  /* ================= ตัวนับ ================= */
  const blank = () => ({ day: laDay(Date.now()), r: 0, w: 0, d: 0, hb: 0, pages: {} });
  const isEmpty = a => !(a.r || a.w || a.d || a.hb > 2048);
  let acc = blank(), old = [], getDb = null, getEmail = null, flushing = false;
  /* ยอดที่ค้างจากการเปิดครั้งก่อน (ยังไม่ได้ส่ง) — ส่งพร้อมรอบถัดไป แยกตามวันของมันเอง */
  try { const sv = JSON.parse(localStorage.getItem(AKEY) || 'null'); if (sv && sv.day && !isEmpty(sv)) old.push(sv); } catch (e) {}
  const lastAt = () => { try { return +localStorage.getItem(LKEY) || 0; } catch (e) { return 0; } };
  const keep = () => { try { const all = merge(old.concat([acc])); localStorage.setItem(AKEY, JSON.stringify(all.length ? all[all.length - 1] : blank())); if (all.length > 1) localStorage.setItem(AKEY + '-old', JSON.stringify(all.slice(0, -1))); else localStorage.removeItem(AKEY + '-old'); } catch (e) {} };
  try { (JSON.parse(localStorage.getItem(AKEY + '-old') || '[]') || []).forEach(x => { if (x && x.day && !isEmpty(x)) old.push(x); }); } catch (e) {}
  try { localStorage.removeItem(AKEY); localStorage.removeItem(AKEY + '-old'); } catch (e) {}      // รับยอดค้างมาแล้ว — กันอีกแท็บรับซ้ำ (เก็บกลับตอนออกจากหน้า)
  /* รวมยอดของวันเดียวกัน */
  function merge(list) {
    const by = {}; list.forEach(a => { if (!a || isEmpty(a)) return; const o = by[a.day] || (by[a.day] = { day: a.day, r: 0, w: 0, d: 0, hb: 0, pages: {} });
      ['r', 'w', 'd', 'hb'].forEach(k => { o[k] += num(a[k]); }); Object.keys(a.pages || {}).forEach(p => { const x = o.pages[p] || (o.pages[p] = { r: 0, w: 0, d: 0 }); ['r', 'w', 'd'].forEach(k => { x[k] += num(a.pages[p][k]); }); }); });
    return Object.values(by).sort((a, b) => a.day.localeCompare(b.day));
  }
  const pageKey = () => String((typeof page !== 'undefined' && page) || 'gate').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
  function add(k, n) { if (!(n > 0)) return; const day = laDay(Date.now()); if (acc.day !== day) { old.push(acc); acc = blank(); }      // ข้ามรอบวัน → แยกยอดเก่าไว้
    acc[k] += n; if (k !== 'hb') { const p = acc.pages[pageKey()] || (acc.pages[pageKey()] = { r: 0, w: 0, d: 0 }); p[k] += n; } }
  const wrapNext = (fn, isQuery) => function (snap) {
    try { if (!(snap && snap.metadata && snap.metadata.fromCache)) add('r', isQuery ? Math.max(1, snap.docChanges ? snap.docChanges().length : (snap.size || (snap.docs || []).length)) : 1); } catch (e) {}
    return fn.apply(this, arguments);
  };
  function patchSnap(P, isQuery) {
    const orig = P.onSnapshot; if (!orig || orig.__m) return;
    P.onSnapshot = function (...a) {
      const i = a.findIndex(x => typeof x === 'function');
      if (i >= 0) a[i] = wrapNext(a[i], isQuery);
      else { const j = a.findIndex(x => x && typeof x.next === 'function'); if (j >= 0) { const ob = a[j]; a[j] = Object.assign({}, ob, { next: wrapNext(ob.next.bind(ob), isQuery) }); } }
      return orig.apply(this, a);
    };
    P.onSnapshot.__m = 1;
  }
  function patchGet(P, isQuery) {
    const orig = P.get; if (!orig || orig.__m) return;
    P.get = function (...a) { return orig.apply(this, a).then(r => { try { if (!(r && r.metadata && r.metadata.fromCache)) add('r', isQuery ? Math.max(1, r.size || (r.docs || []).length) : 1); } catch (e) {} return r; }); };
    P.get.__m = 1;
  }
  const patchCount = (P, m, k) => { const orig = P && P[m]; if (!orig || orig.__m) return; P[m] = function (...a) { add(k, 1); return orig.apply(this, a); }; P[m].__m = 1; };
  /* เรียกจาก cloud.js init() หลังสร้าง Firestore — ครอบที่ prototype จึงนับได้ทุกหน้าโดยไม่ต้องแก้ทีละจุด */
  function install(fb, dbFn, emailFn) {
    getDb = dbFn; getEmail = emailFn;
    const F = fb && fb.firestore; if (!F || F.__metered) return; F.__metered = 1;
    const Q = F.Query && F.Query.prototype, Dc = F.DocumentReference && F.DocumentReference.prototype, B = F.WriteBatch && F.WriteBatch.prototype;
    if (Q) { patchSnap(Q, true); patchGet(Q, true); }
    if (Dc) { patchSnap(Dc, false); patchGet(Dc, false); patchCount(Dc, 'set', 'w'); patchCount(Dc, 'update', 'w'); patchCount(Dc, 'delete', 'd'); }
    if (B) { patchCount(B, 'set', 'w'); patchCount(B, 'update', 'w'); patchCount(B, 'delete', 'd'); }
  }
  /* Hosting: ไฟล์จากโดเมน EMS ที่โหลดผ่านเน็ตจริง */
  const seen = new Set();
  function takeEntries(list) { list.forEach(e => { try { if (!e.name || e.name.indexOf(location.origin) !== 0 || seen.has(e.name + '|' + e.startTime)) return; seen.add(e.name + '|' + e.startTime); add('hb', num(e.transferSize)); } catch (x) {} }); }
  try { takeEntries(performance.getEntriesByType('navigation')); takeEntries(performance.getEntriesByType('resource'));
    new PerformanceObserver(l => takeEntries(l.getEntries())).observe({ type: 'resource', buffered: false }); } catch (e) {}

  /* ส่งยอด — ปกติไม่เกิน 1 ครั้งต่อ 30 นาที (force = หน้าแอดมินกดโหลด) · ส่งยอดค้างหลายวันได้ในครั้งเดียว (วันละ 1 การเขียน) */
  async function flush(force) {
    const db = getDb && getDb(), email = getEmail && getEmail();
    if (!db || !email || flushing) return;
    const list = merge(old.concat([acc])); if (!list.length) return;
    if (!force && Date.now() - lastAt() < FLUSH_MS) return keep();
    flushing = true; old = []; acc = blank();
    const inc = n => firebase.firestore.FieldValue.increment(Math.round(n)), failed = [];
    for (const a of list) {
      a.w += 1;       // การส่งยอดครั้งนี้เองก็เป็น 1 การเขียน
      const pages = {}; Object.keys(a.pages).forEach(p => { const x = a.pages[p], o = {}; ['r', 'w', 'd'].forEach(k => { if (x[k]) o[k] = inc(x[k]); }); pages[p] = o; });
      const me = { r: inc(a.r), w: inc(a.w), d: inc(a.d), hb: inc(a.hb), role: S.view === 'student' ? 'student' : 'staff', name: String((S.me || {}).name || '').slice(0, 80) };
      const pk = pageKey();
      try {
        const done = db.collection('usage').doc(a.day).set({ day: a.day, r: inc(a.r), w: inc(a.w), d: inc(a.d), hb: inc(a.hb), users: { [email]: me }, pages, by: email, at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        /* ตัวครอบนับการเขียนครั้งนี้เข้ายอดรอบถัดไปแล้ว แต่เรารวมไว้ในยอดนี้ (a.w += 1) → หักออก ไม่ให้มียอดค้างเปล่า ๆ */
        acc.w = Math.max(0, acc.w - 1); if (acc.pages[pk] && acc.pages[pk].w) acc.pages[pk].w--;
        await done;
      } catch (e) { a.w -= 1; failed.push(a); console.warn('EMS usage', e && (e.code || e.message)); }
    }
    old = failed;            // ส่งไม่ได้ (ออฟไลน์/ยังไม่วาง rules) → เก็บไว้ส่งรอบหน้า
    try { localStorage.setItem(LKEY, String(Date.now())); } catch (e) {}
    flushing = false; keep();
  }
  setInterval(() => flush(), 60 * 1000);                     // ตรวจทุกนาที แต่ส่งจริงเมื่อครบ 30 นาทีจากครั้งก่อน (นับข้ามการเปิด/ปิดแอป)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') keep(); });
  window.addEventListener('pagehide', keep);
  window.EMSMeter = { install, flush, add, peek: () => JSON.parse(JSON.stringify(acc)), pending: () => merge(old.concat([acc])) };
  /* cloud.js อาจสร้าง Firestore ก่อนไฟล์นี้โหลด (มี firebase อยู่แล้ว) → ติดตั้งย้อนหลังที่นี่ */
  if (window.EMSCloud && EMSCloud.db && window.firebase && firebase.firestore) install(firebase, EMSCloud.db, EMSCloud.email);

  /* ================= หน้าแอดมิน ================= */
  let D = null, busy = false, err = '';
  async function load() {
    const db = getDb && getDb(); if (!db) { err = 'ยังไม่ได้เชื่อมฐานข้อมูล (โหมดตัวอย่าง)'; return render(); }
    busy = true; err = ''; render();
    try {
      await flush(true);
      const from = shiftDay(laDay(Date.now()), -29), q = await db.collection('usage').where('day', '>=', from).get();
      D = { at: Date.now(), days: q.docs.map(d => d.data()).sort((a, b) => String(a.day).localeCompare(b.day)) };
    } catch (e) { err = e.code === 'permission-denied' ? 'ยังอ่านข้อมูลการใช้งานไม่ได้ — ต้องเป็นผู้ดูแลระบบ และวาง firestore.rules รุ่นล่าสุดแล้ว' : (e.message || String(e)); }
    finally { busy = false; render(); }
  }
  /* กราฟแท่งรายวัน (หนึ่งเมตริกต่อกราฟ + เส้นประโควตาฟรี) */
  function bars(pts, free, unit) {
    const W = 640, H = 150, L = 44, B = 22, T = 10, n = Math.max(pts.length, 1), max = Math.max(free * 1.15, ...pts.map(p => p.v), 1);
    const y = v => T + (H - T - B) * (1 - v / max), bw = Math.max(3, (W - L) / n - 3), lbl = d => new Date(d + 'T12:00:00Z').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const tick = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? Math.round(v / 1000) + 'K' : Math.round(v);
    return `<svg viewBox="0 0 ${W} ${H}" class="us-ch" role="img" aria-label="${unit} รายวัน">
      <line x1="${L}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(0) + 4}" text-anchor="end" class="us-ax">0</text>
      <line x1="${L}" x2="${W}" y1="${y(free)}" y2="${y(free)}" stroke="var(--muted)" stroke-dasharray="4 4"/><text x="${L - 6}" y="${y(free) + 4}" text-anchor="end" class="us-ax">${tick(free)}</text>
      <text x="${W - 2}" y="${y(free) - 4}" text-anchor="end" class="us-ax">โควตาฟรี ${tick(free)}/วัน</text>
      ${pts.map((p, i) => { const x = L + i * (W - L) / n + 1.5, h = Math.max(p.v ? 1 : 0, H - B - y(p.v)), over = p.v > free;
        return `<g class="us-b"><rect x="${x}" y="${T}" width="${bw}" height="${H - B - T}" fill="transparent"><title>${lbl(p.day)} · ${nf(p.v)} ${unit}${over ? ' · เกินโควตาฟรี' : ''}</title></rect><rect x="${x}" y="${H - B - h}" width="${bw}" height="${h}" rx="2" fill="${over ? 'var(--bad)' : 'var(--brand)'}" opacity=".85" pointer-events="none"/></g>`; }).join('')}
      ${pts.length ? [0, Math.floor(pts.length / 2), pts.length - 1].map((i, j) => `<text x="${j === 2 ? W - 2 : L + (i + .5) * (W - L) / n}" y="${H - 6}" text-anchor="${j === 2 ? 'end' : 'middle'}" class="us-ax">${lbl(pts[i].day)}</text>`).join('') : ''}</svg>`;
  }
  const meter = (v, cap) => { const p = Math.min(100, v * 100 / cap); return `<div class="us-m"><span style="width:${p}%;background:${v > cap ? 'var(--bad)' : p > 80 ? 'var(--warn)' : 'var(--brand)'}"></span></div>`; };
  const PAGE_NAME = k => { const N = window.EMSNav && EMSNav.NAVG; const all = N ? Object.values(N).flat().flatMap(g => g[1] || []) : []; const f = all.find(x => x[0] === k); return f ? f[1] : k === 'gate' ? 'หน้าเข้าสู่ระบบ' : k; };

  P['a-usage'] = () => {
    const hd = `<div class="top"><div><h1>การใช้งานและค่าใช้จ่าย</h1><p>Firestore (อ่าน · เขียน · ลบ) และ Hosting ที่ EMS นับเองจากทุกเครื่องที่เปิดใช้ · วันนับตามรอบโควตาฟรี (เริ่มรอบใหม่ ${laReset()} น. เวลาไทย)</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-us="load" ${busy ? 'disabled' : ''}>${busy ? 'กำลังโหลด…' : 'โหลดข้อมูลล่าสุด'}</button><a class="btn" href="https://console.firebase.google.com/project/${esc(PROJECT)}/usage" target="_blank" rel="noopener">ตัวเลขจริงใน Firebase Console</a></div></div>`;
    const note = (err ? `<div class="notice bad">${esc(err)}</div>` : '') + `<p class="muted small" style="margin:-6px 0 12px">ตัวเลขประมาณ — ไม่รวมแอปสแกนหน้า การเปิดคอนโซล และยอดที่แต่ละเครื่องยังไม่ส่ง (ส่งรวมไม่เกินครั้งละ 30 นาที) จึงมักต่ำกว่าคอนโซลเล็กน้อย</p>`;
    if (!D) { if (!busy && !err) setTimeout(load, 0); return hd + note + `<div class="card"><div class="empty">${err ? 'ยังไม่มีข้อมูล' : 'กำลังโหลด…'}</div></div>`; }
    const today = laDay(Date.now()), byDay = {}; D.days.forEach(x => { byDay[x.day] = x; });
    const days = Array.from({ length: 30 }, (_, i) => shiftDay(today, i - 29)), T = byDay[today] || {};
    const pts = k => days.map(d => ({ day: d, v: num((byDay[d] || {})[k]) }));
    const sum = k => D.days.reduce((a, x) => a + num(x[k]), 0), over = k => D.days.reduce((a, x) => a + Math.max(0, num(x[k]) - FREE[k]), 0);
    const month = today.slice(0, 7), hbMonth = D.days.filter(x => String(x.day).startsWith(month)).reduce((a, x) => a + num(x.hb), 0), hb30 = sum('hb');
    const R = rates(), usd = { r: over('r') / 1e5 * R.r, w: over('w') / 1e5 * R.w, d: over('d') / 1e5 * R.d, h: Math.max(0, hbMonth - FREE.hbMonth) / 1e9 * R.hostGB };
    const tot = usd.r + usd.w + usd.d + usd.h;
    const tile = k => `<div class="card kpi"><div class="l">${NAME[k]} วันนี้</div><div class="v">${nf(num(T[k]))}</div>${meter(num(T[k]), FREE[k])}<div class="s muted">${Math.round(num(T[k]) * 1000 / FREE[k]) / 10}% ของโควตาฟรี ${nf(FREE[k])}/วัน</div></div>`;
    /* ใครใช้มาก / หน้าไหนใช้มาก (30 วัน) */
    const U = {}, PG = {};
    D.days.forEach(x => { Object.entries(x.users || {}).forEach(([e, u]) => { const o = U[e] || (U[e] = { r: 0, w: 0, d: 0, hb: 0, name: '', role: '' }); ['r', 'w', 'd', 'hb'].forEach(k => { o[k] += num(u[k]); }); o.name = u.name || o.name; o.role = u.role || o.role; });
      Object.entries(x.pages || {}).forEach(([p, v]) => { const o = PG[p] || (PG[p] = { r: 0, w: 0, d: 0 }); ['r', 'w', 'd'].forEach(k => { o[k] += num(v[k]); }); }); });
    const topU = Object.entries(U).sort((a, b) => b[1].r - a[1].r).slice(0, 15), topP = Object.entries(PG).sort((a, b) => b[1].r - a[1].r).slice(0, 12);
    const stu = Object.values(U).filter(u => u.role === 'student'), staff = Object.values(U).filter(u => u.role !== 'student');
    const share = (L, k) => sum(k) ? Math.round(L.reduce((a, u) => a + u[k], 0) * 100 / sum(k)) : 0;
    return hd + note + `<p class="muted small" style="margin:-8px 0 12px">ข้อมูลเมื่อ ${new Date(D.at).toLocaleString('th-TH')} · ${Object.keys(U).length} บัญชีใช้งานใน 30 วัน (บุคลากร ${staff.length} · นักเรียน ${stu.length})</p>
      <div class="grid g3 us-g">${tile('r')}${tile('w')}${tile('d')}</div>
      <div class="grid g3 us-g" style="margin-top:14px"><div class="card kpi"><div class="l">Hosting ดาวน์โหลดเดือนนี้</div><div class="v">${mb(hbMonth)}</div>${meter(hbMonth, FREE.hbMonth)}<div class="s muted">ฟรี 10 GB/เดือน · วันนี้ ${mb(num(T.hb))}</div></div>
        <div class="card kpi"><div class="l">สัดส่วนการอ่าน 30 วัน</div><div class="v" style="font-size:1.4rem;padding:4px 0">บุคลากร ${share(staff, 'r')}%</div><div class="s muted">นักเรียน ${share(stu, 'r')}%</div></div>
        <div class="card kpi"><div class="l">ค่าใช้จ่ายโดยประมาณ 30 วัน</div><div class="v" style="color:${tot > 0 ? 'var(--bad)' : 'var(--ok)'}">฿${baht(tot * R.thb)}</div><div class="s muted">${tot > 0 ? '$' + tot.toFixed(2) + ' ถ้าเป็นแผน Blaze' : 'อยู่ในโควตาฟรีทุกวัน'} · แผน Spark ปัจจุบันไม่มีค่าใช้จ่าย</div></div></div>
      ${['r', 'w', 'd'].map(k => `<div class="card" style="margin-top:14px"><div class="row" style="border:0;padding:0 0 4px;flex-wrap:wrap"><h2 class="grow" style="margin:0">${NAME[k]} รายวัน · 30 วัน</h2><span class="muted small">รวม ${nf(sum(k))} · เกินโควตา ${D.days.filter(x => num(x[k]) > FREE[k]).length} วัน</span></div>${bars(pts(k), FREE[k], NAME[k])}</div>`).join('')}
      <div class="card" style="margin-top:14px"><div class="row" style="border:0;padding:0 0 4px;flex-wrap:wrap"><h2 class="grow" style="margin:0">Hosting ดาวน์โหลดรายวัน · 30 วัน (MB)</h2><span class="muted small">รวม ${mb(hb30)}</span></div>${bars(pts('hb').map(p => ({ day: p.day, v: p.v / 1e6 })), FREE.hbMonth / 1e6 / 30, 'MB')}</div>
      <div class="grid g2 us-g" style="margin-top:14px;align-items:start">
        <div class="card"><h2>ใช้มากที่สุด · 30 วัน</h2>${topU.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>ผู้ใช้</th><th style="text-align:right">อ่าน</th><th style="text-align:right">เขียน</th><th style="text-align:right">ไฟล์</th></tr></thead><tbody>
          ${topU.map(([e, u]) => `<tr><td><b>${esc(u.name || e)}</b><div class="muted small">${esc(e)}${u.role === 'student' ? ' · นักเรียน' : ''}</div></td><td style="text-align:right">${nf(u.r)}</td><td style="text-align:right">${nf(u.w)}</td><td style="text-align:right">${mb(u.hb)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีข้อมูล</div>'}</div>
        <div class="card"><h2>หน้าที่อ่านมากที่สุด · 30 วัน</h2>${topP.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>หน้า</th><th style="text-align:right">อ่าน</th><th style="text-align:right">เขียน</th><th style="text-align:right">ลบ</th></tr></thead><tbody>
          ${topP.map(([p, v]) => `<tr><td>${esc(PAGE_NAME(p))}</td><td style="text-align:right">${nf(v.r)}</td><td style="text-align:right">${nf(v.w)}</td><td style="text-align:right">${nf(v.d)}</td></tr>`).join('')}</tbody></table></div><p class="muted small" style="margin-top:6px">การอ่านตอนเปิดแอป (โหลดข้อมูลตั้งต้น) นับที่หน้าแรกที่เปิด</p>` : '<div class="empty">ยังไม่มีข้อมูล</div>'}</div></div>
      <div class="card" style="margin-top:14px"><h2>ประมาณค่าใช้จ่าย 30 วัน (ถ้าเป็นแผน Blaze)</h2><div class="scroll"><table class="tbl"><thead><tr><th>รายการ</th><th style="text-align:right">รวม 30 วัน</th><th style="text-align:right">เกินโควตาฟรี</th><th style="text-align:right">อัตรา (USD)</th><th style="text-align:right">ประมาณการ</th></tr></thead><tbody>
        ${['r', 'w', 'd'].map(k => `<tr><td>${NAME[k]}</td><td style="text-align:right">${nf(sum(k))}</td><td style="text-align:right">${nf(over(k))}</td><td style="text-align:right"><input class="in" style="width:80px;text-align:right" data-usr="${k}" value="${R[k]}" aria-label="อัตราต่อ 100,000 ครั้ง"> /100K</td><td style="text-align:right">฿${baht(usd[k] * R.thb)}</td></tr>`).join('')}
        <tr><td>Hosting ดาวน์โหลด (เดือนนี้)</td><td style="text-align:right">${mb(hbMonth)}</td><td style="text-align:right">${hbMonth > FREE.hbMonth ? mb(hbMonth - FREE.hbMonth) : '–'}</td><td style="text-align:right"><input class="in" style="width:80px;text-align:right" data-usr="hostGB" value="${R.hostGB}" aria-label="อัตราต่อ GB"> /GB</td><td style="text-align:right">฿${baht(usd.h * R.thb)}</td></tr>
        <tr><td colspan="3" class="muted small">อัตราแลกเปลี่ยน <input class="in" style="width:70px;text-align:right" data-usr="thb" value="${R.thb}" aria-label="บาทต่อดอลลาร์"> บาท/USD · ราคาจริงขึ้นกับภูมิภาคของฐานข้อมูล ดูที่ firebase.google.com/pricing</td><td></td><td style="text-align:right"><b>฿${baht(tot * R.thb)}</b></td></tr></tbody></table></div></div>`;
  };

  document.addEventListener('click', e => { if (e.target.closest('[data-us="load"]')) load(); });
  document.addEventListener('change', e => {
    const t = e.target.closest('[data-usr]'); if (!t) return;
    const r = S.settings.usageRates = Object.assign({}, S.settings.usageRates || {}); r[t.dataset.usr] = Math.max(0, num(t.value)); save(); render();
  });
  const st = document.createElement('style');
  st.textContent = `.us-ch{width:100%;height:auto;display:block}.us-ax{font-size:10px;fill:var(--muted)}.us-b:hover rect+rect{opacity:1}.us-g>.card{margin-top:0}
    .us-m{height:6px;border-radius:3px;background:var(--line);overflow:hidden;margin:6px 0 4px}.us-m span{display:block;height:100%;border-radius:3px}`;
  document.head.appendChild(st);
})();
