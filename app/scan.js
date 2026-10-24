/* EMS — เชื่อมแอปสแกนหน้าที่ประตู (D:\2.ระบบเช็คชื่อผ่านกล้อง · Python/Flask รันในเครื่องฝ่ายกิจการฯ ไม่ย้ายเข้าเว็บ)
   แอปสแกนส่งข้อมูลเข้ามา 2 แบบ (รูปแบบเดียวกับที่ส่งให้ KruSpace อยู่แล้ว — core/kruspace_sync.py):
   - gateEvents/{วันที่_เลขประจำตัว} = { sid, date, at, deviceId, method:'face' } หนึ่งคนหนึ่งรายการต่อวัน เก็บเวลาที่ถึงก่อน
   - scanDevices/{เครื่อง} = { name, url, updatedAt } ที่อยู่หน้าสแกนของแต่ละเครื่อง (ลิงก์ tunnel เปลี่ยนทุกครั้งที่เปิดเครื่อง)
   ฝั่ง EMS: S.gateEvents (คีย์เดียวกับเอกสาร) และ S.scanDevices — ตอนต่อ Firebase (ข้อ 5) แค่ฟังสองคอลเลกชันนี้มาใส่ที่เดิม
   และเปลี่ยนโปรเจกต์ในแอปสแกนจาก pakchongallinone เป็น dss-pc
   ใช้ที่: ① เช็กชื่อแถวเช้า — เวลาเข้าประตูใต้ชื่อ + ปุ่มใส่ “มา/สาย” จากเครื่องสแกน (ครูตรวจแล้วกดบันทึกเอง ไม่บันทึกแทน)
          ② เช็กชื่อรายคาบ — ปุ่มเปิดเครื่องสแกน ③ กิจการนักเรียน — สถานะเครื่องและสรุปเข้าประตูวันนี้ */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const pad = n => String(n).padStart(2, '0');
  const demo = () => !(window.EMS_CONFIG || {}).live;
  const canGate = () => { const C = window.EMS_CONFIG || {}, m = S.me || {}, em = String(m.email || '').toLowerCase();      // การ์ดเข้าประตูทั้งโรงเรียน = กิจการฯ/แอดมิน (cloud.js ฟังเฉพาะบทบาทนี้)
    return demo() || [].concat(m.roles || []).some(r => r === 'admin' || r === 'affairs') || (C.adminEmails || []).some(x => String(x).toLowerCase() === em); };
  S.gateEvents = S.gateEvents || {};
  S.scanDevices = S.scanDevices || [];
  const sk = s => String(s.sid || s.id);
  const hm = at => { const d = new Date(at); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const lateTime = () => ((S.affairs || {}).cfg || {}).lateTime || '08:00';
  const eventsOn = date => Object.values(S.gateEvents).filter(e => e.date === date);
  const eventOf = (sid, date) => S.gateEvents[date + '_' + sid];
  const isLate = e => hm(e.at) > lateTime();
  /* ลบรายการเก่ากว่า 45 วัน (ข้อมูลเข้าประตูใช้แค่ในวันนั้น ส่วนมาสายถูกแปลงเป็นบันทึกกิจการฯ ไปแล้ว) */
  { const lim = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10); Object.keys(S.gateEvents).forEach(k => { if (S.gateEvents[k].date < lim) delete S.gateEvents[k]; }); }

  /* ---------- ① เช็กชื่อแถวเช้า ---------- */
  const hrSession = () => { const k = (S.aui || {}).sess || ''; const p = k.split('|'); return p[2] === 'hr' ? { key: k, classId: p[0], date: p[1] } : null; };
  function decorate() {
    const panel = document.getElementById('att-panel'); if (!panel || panel.dataset.scan) return;
    panel.dataset.scan = '1';
    const s = hrSession(), dev = scanner(), head = panel.querySelector('.row');
    /* ปุ่มเปิดกล้องสแกนหน้า — โชว์เมื่อมีเครื่องประกาศตัวภายใน 25 นาที */
    if (head && !demo()) head.insertAdjacentHTML('beforeend', scanBtn(dev));
    if (!s) { photoTools(panel); return; }   /* รายคาบ: เช็กจากรูปถ่ายทั้งห้อง */
    const c = cls(s.classId); if (!c) return;
    const rec = S.att[s.key] || {}, evs = c.students.map(st => ({ st, e: eventOf(sk(st), s.date) }));
    const got = evs.filter(x => x.e), late = got.filter(x => isLate(x.e)).length;
    const fillable = got.filter(x => !rec[x.st.id]).length;
    panel.querySelector('.att-head').insertAdjacentHTML('beforebegin', `<div class="notice sc-gate"><div class="grow"><b>เครื่องสแกนที่ประตู</b> · เข้าแล้ว ${got.length}/${c.students.length} คน${got.length ? ` · หลัง ${esc(lateTime())} น. ${late} คน` : ''}
      <div class="small muted">${got.length ? 'เวลาเข้าประตูแสดงใต้ชื่อ · คนที่ไม่มีบันทึกอาจลืมสแกน/ใส่หน้ากาก — ครูตรวจซ้ำก่อนบันทึก' : 'ยังไม่มีนักเรียนห้องนี้สแกนเข้าวันนี้'}</div></div>
      ${fillable ? `<button class="btn sm pri" data-scan="fill">ใส่ มา/สาย จากเครื่องสแกน (${fillable} คน)</button>` : ''}</div>`);
    evs.forEach(({ st, e }) => { if (!e) return;
      const b = panel.querySelector(`.ab[data-s="${CSS.escape(String(st.id))}"]`), nm = b && b.closest('.att-row').querySelector('.nm');
      if (nm) nm.insertAdjacentHTML('beforeend', ` <span class="chip ${isLate(e) ? 'warn' : 'ok'} sc-t" title="สแกนเข้าประตู ${esc(e.deviceId || '')}">${hm(e.at)}</span>`); });
  }
  function fill() {
    const s = hrSession(); if (!s) return; const c = cls(s.classId); if (!c) return;
    const r = S.att[s.key] = Object.assign({}, S.att[s.key] || {}); let n = 0;
    c.students.forEach(st => { const e = eventOf(sk(st), s.date); if (!e || r[st.id]) return; r[st.id] = isLate(e) ? 's' : 'p'; n++; });
    r._draft = true; delete S.attSaved[s.key]; save(); render(); toast(`ใส่สถานะจากเครื่องสแกน ${n} คน — ตรวจแล้วกด “บันทึกการเช็กชื่อ”`);
  }

  /* ---------- ② เปิดกล้องสแกน + เช็กชื่อรายคาบจากรูปถ่าย (ย้ายจาก KruSpace: faceScannerUrl/openFaceScanner/scanClassPhotos) ----------
     เครื่องสแกนออกเน็ตผ่าน tunnel ลิงก์เปลี่ยนทุกครั้งที่เปิดเครื่อง จึงประกาศตัวใน scanDevices ทุก 10 นาที — เกิน 25 นาที = ปิดไปแล้ว
     ส่งโทเค็น Firebase ของครูไปให้เครื่องสแกนตรวจกับ Google เอง (/sso#t= และ /api/class_photo) ครูไม่ต้องล็อกอินเครื่องสแกนซ้ำ
     รูปถ่ายทั้งห้อง: เครื่องสแกนเทียบเฉพาะเลขประจำตัวของห้องนี้ ไม่บันทึกอะไร ไม่ส่ง gateEvents ผลแค่ติ๊กในหน้าเช็กชื่อ ครูตรวจแล้วกดบันทึกเอง */
  const FRESH_MS = 25 * 60 * 1000, MAX_SIDE = 2400;
  function scanner() {
    const now = Date.now();
    return S.scanDevices.filter(v => /^https:\/\//.test(String(v.url || '')) && !v.offline && now - new Date(v.updatedAt).getTime() < FRESH_MS)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null;
  }
  const base = () => { const d = scanner(); if (!d) throw new Error('เครื่องสแกนใบหน้าของโรงเรียนยังไม่ได้เปิด (หรือปิดไปแล้ว) — แจ้งฝ่ายกิจการนักเรียนให้เปิดโปรแกรมพร้อมลิงก์มือถือ'); return d.url.replace(/\/+$/, ''); };
  const token = () => { if (demo() || !window.EMSCloud || !EMSCloud.idToken) return Promise.reject(new Error('ใช้ได้เมื่อเข้าสู่ระบบ EMS ด้วยบัญชี Google (ไม่ใช่โหมดตัวอย่าง)')); return EMSCloud.idToken(); };
  /* ปุ่มสแกนหน้าแสดงเสมอ (โหมดจริง) — เครื่องยังไม่เปิดก็บอกสถานะ ไม่ซ่อน ครูจะได้รู้ว่าต้องแจ้งใคร */
  const scanBtn = dev => dev
    ? `<button class="btn sm" data-scan="open" title="เปิดหน้าสแกนของเครื่อง ${esc(dev.name || dev.id || '')} — เข้าสู่ระบบให้อัตโนมัติ">📷 สแกนหน้า</button>`
    : `<button class="btn sm" data-scan="open" style="opacity:.65" title="ยังไม่มีเครื่องสแกนรายงานตัวใน 25 นาทีที่ผ่านมา">📷 สแกนหน้า · เครื่องยังไม่เปิด</button>`;
  function topButton() {
    const top = document.querySelector('#view .top'); if (!top || demo() || top.querySelector('[data-scan="open"]')) return;
    const box = top.lastElementChild && top.lastElementChild !== top.firstElementChild ? top.lastElementChild : top;
    box.insertAdjacentHTML('beforeend', scanBtn(scanner()));
  }
  async function openScanner() {
    if (!scanner()) return toast(demo() ? 'โหมดตัวอย่างไม่มีเครื่องสแกน' : 'เครื่องสแกนใบหน้ายังไม่ได้เปิด (หรือยังไม่ได้เชื่อม EMS) — แจ้งฝ่ายกิจการนักเรียนให้เปิดโปรแกรมสแกนและเข้าสู่ระบบ Google ในหน้าตั้งค่าของเครื่องสแกน');
    /* เปิดแท็บทันทีในจังหวะที่ครูกด (ก่อน await) ไม่งั้นเบราว์เซอร์มือถือถือเป็นป๊อปอัปแล้วบล็อก */
    let win = null;
    try { win = window.open('', '_blank'); if (win) win.document.write('<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">กำลังเปิดกล้องสแกนหน้า...</p>'); } catch (x) { win = null; }
    try {
      const url = base() + '/sso#t=' + encodeURIComponent(await token());
      if (win && !win.closed) { win.location.replace(url); return; }
      modal(`<h2 style="margin-bottom:12px">เปิดกล้องสแกนหน้า</h2><p>กดปุ่มด้านล่างเพื่อเปิดหน้าสแกนในแท็บใหม่</p>
        <a class="btn pri" style="display:inline-block;margin-top:10px" target="_blank" rel="noopener" href="${esc(url)}">เปิดหน้าสแกน</a>`, true);
    } catch (e) { if (win && !win.closed) win.close(); toast(e.message || 'เปิดหน้าสแกนไม่สำเร็จ'); }
  }
  function photoDataUrl(file) {
    return new Promise((ok, bad) => {
      const u = URL.createObjectURL(file), img = new Image();
      img.onload = () => { const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); ok(cv.toDataURL('image/jpeg', 0.88)); };
      img.onerror = () => { URL.revokeObjectURL(u); bad(new Error('เปิดรูป ' + (file.name || '') + ' ไม่ได้ — ลองถ่ายใหม่เป็น JPG')); };
      img.src = u;
    });
  }
  /* ผลรูปถ่ายของคาบที่เปิดอยู่ — ถ่ายเพิ่มได้ ผลรวมกับรูปก่อน ๆ (ไม่บันทึกลงเครื่อง) */
  const PH = { key: '', results: [], busy: '', err: '' };
  const rd = () => { const y = scrollY; render(); scrollTo(0, y); };
  const AT = () => window.EMSAttend || {};
  const curSession = () => { const A = S.aui || {}; return AT().sessionsOn ? AT().sessionsOn(A.date).find(x => x.key === A.sess) || null : null; };
  const viewRec = s => AT().view ? AT().view(s, S.aui.date) : Object.assign({}, S.att[s.key] || {});
  function photoTools(panel) {
    const s = curSession(), c = s && cls(s.classId), head = panel.querySelector('.row'); if (!c || !head) return;
    if (PH.key !== s.key) Object.assign(PH, { key: s.key, results: [], busy: '', err: '' });
    if (!demo()) head.insertAdjacentHTML('beforeend', `<button class="btn sm" data-scan="photo" ${PH.busy ? 'disabled' : ''} title="ถ่ายรูปนักเรียนทั้งห้อง ให้เครื่องสแกนจำหน้าแล้วติ๊ก “มา” ให้">📸 เช็กจากรูปถ่าย</button>`);
    const box = PH.busy ? `<div class="notice">${esc(PH.busy)}</div>` : photoBox(c);
    const err = PH.err ? `<div class="notice" style="color:var(--bad)">${esc(PH.err)}</div>` : '';
    if (box || err) panel.querySelector('.att-head').insertAdjacentHTML('beforebegin', `<div id="scPhoto">${err}${box}</div>`);
  }
  function photoSets(c) {
    const found = new Set(), enrolled = new Set(); let faces = 0, unknown = 0;
    PH.results.forEach(r => { (r.present || []).forEach(x => found.add(String(x))); (r.enrolled || []).forEach(x => enrolled.add(String(x)));
      (r.faces || []).forEach(f => { faces++; if (!f.code) unknown++; }); });
    const rec = (S.att[PH.key] || {});
    return { found, enrolled, faces, unknown, rec,
      missing: c.students.filter(st => enrolled.has(sk(st)) && !found.has(sk(st))),
      noFace: c.students.filter(st => !enrolled.has(sk(st))),
      kept: c.students.filter(st => found.has(sk(st)) && (rec[st.id] === 'l' || rec[st.id] === 'c')) };
  }
  function photoBox(c) {
    if (!PH.results.length) return '';
    const x = photoSets(c), noOf = {}; c.students.forEach(st => { noOf[sk(st)] = st.no; });
    const names = list => `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${list.map(st => chip(st.no + '. ' + esc(st.name))).join('')}</div>`;
    const pct = v => (v * 100).toFixed(2) + '%';
    const shots = PH.results.map(r => `<div class="sc-shot"><img alt="รูปที่ตรวจ" src="${r.image}">${(r.faces || []).map(f =>
      `<span class="sc-face${f.code ? '' : ' unk'}" style="left:${pct(f.x)};top:${pct(f.y)};width:${pct(f.w)};height:${pct(f.h)}">${f.code ? '<b>' + esc(noOf[String(f.code)] || f.code) + '</b>' : ''}</span>`).join('')}</div>`).join('');
    const absentable = x.missing.filter(st => !x.rec[st.id] || x.rec[st.id] === 'p').length;
    return (x.enrolled.size
        ? `<div class="notice" style="background:var(--ok-soft)"><b>จำหน้าได้ ${c.students.filter(st => x.found.has(sk(st))).length} จาก ${c.students.length} คน — ติ๊ก “มา” ให้แล้ว</b> <span class="small muted">พบใบหน้าในรูป ${x.faces} หน้า${x.unknown ? ` · ไม่รู้จัก ${x.unknown} หน้า (กรอบแดง)` : ''}</span></div>`
        : '<div class="notice" style="color:var(--bad)"><b>นักเรียนห้องนี้ยังไม่มีใครลงทะเบียนใบหน้าในเครื่องสแกน</b> — แจ้งผู้ดูแลเครื่องสแกนให้นำเข้ารูปนักเรียนก่อน</div>')
      + (x.missing.length ? `<div class="notice" style="background:var(--warn-soft)"><b>ไม่พบในรูป ${x.missing.length} คน</b> <span class="small muted">— อาจโดนบังหรือก้มหน้า ถ่ายเพิ่มได้อีก หรือตั้งเป็นขาด</span>
          ${absentable ? `<button class="btn sm" data-scan="photoAbsent">ตั้ง ${absentable} คนนี้เป็น “ขาด”</button>` : ''}${names(x.missing)}</div>` : '')
      + (x.kept.length ? `<div class="notice" style="background:var(--warn-soft)"><b>เจอในรูปแต่ตั้ง “ลา”/“กิจกรรม” ไว้ ${x.kept.length} คน</b> <span class="small muted">— ไม่ได้เปลี่ยนให้ ถ้ามาเรียนจริงให้กด “มา” เอง</span>${names(x.kept)}</div>` : '')
      + (x.enrolled.size && x.noFace.length ? `<div class="notice" style="background:var(--warn-soft)"><b>ยังไม่มีรูปหน้าในเครื่องสแกน ${x.noFace.length} คน</b> <span class="small muted">— เครื่องจำไม่ได้ ต้องตรวจด้วยตา</span>${names(x.noFace)}</div>` : '')
      + `<details style="margin:8px 0 10px"><summary class="small muted">ดูรูปที่ตรวจ ${PH.results.length} รูป (กรอบเขียว = เลขที่ที่จำได้)</summary><div class="sc-shots">${shots}</div></details>`;
  }
  /* ติ๊ก “มา” ให้คนที่เจอ — ไม่ทับ ลา/กิจกรรม/สาย (มีเหตุผลอื่นที่รูปบอกไม่ได้) */
  function applyPhoto() {
    const s = curSession(), c = s && cls(s.classId); if (!c || s.key !== PH.key) return;
    const r = S.att[s.key] = viewRec(s), x = photoSets(c);
    c.students.forEach(st => { if (x.found.has(sk(st)) && !['l', 'c', 's'].includes(r[st.id])) r[st.id] = 'p'; });
    r._draft = true; delete S.attSaved[s.key]; save();
  }
  async function photoFiles(files) {
    const s = curSession(), c = s && cls(s.classId); if (!c || !files.length) return;
    PH.err = ''; PH.busy = 'กำลังส่งรูปให้เครื่องสแกนใบหน้า...'; rd();
    try {
      const url = base() + '/api/class_photo', tk = await token(), codes = c.students.map(sk);
      for (let i = 0; i < files.length; i++) {
        PH.busy = `กำลังจำหน้า รูปที่ ${i + 1}/${files.length}...`; rd();
        const image = await photoDataUrl(files[i]); let res, d = null;
        try { res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: tk, image, codes }) }); }
        catch (e) { throw new Error('ติดต่อเครื่องสแกนใบหน้าไม่ได้ — ตรวจว่าเครื่องสแกนเปิดอยู่และอัปเดตโปรแกรมแล้ว (ต้องเป็นรุ่นที่รับ EMS)'); }
        try { d = await res.json(); } catch (e) { d = null; }
        if (!res.ok || !d || !d.success) throw new Error((d && d.error) || `เครื่องสแกนตอบกลับผิดพลาด (${res.status})`);
        PH.results.push(Object.assign(d, { image }));
      }
      applyPhoto();
    } catch (e) { PH.err = e.message || 'จำหน้าไม่สำเร็จ'; }
    PH.busy = ''; rd();
  }
  function photoAbsent() {
    const s = curSession(), c = s && cls(s.classId); if (!c || s.key !== PH.key) return;
    const r = S.att[s.key] = viewRec(s);
    photoSets(c).missing.forEach(st => { if (!r[st.id] || r[st.id] === 'p') r[st.id] = 'a'; });
    r._draft = true; delete S.attSaved[s.key]; save(); rd();
  }

  /* ---------- ③ กิจการนักเรียน: สถานะเครื่อง + เข้าประตูวันนี้ ---------- */
  function gateCard() {
    const d = todayISO(), evs = eventsOn(d), late = evs.filter(isLate);
    const bySid = {}; S.classes.forEach(c => c.students.forEach(st => { bySid[sk(st)] = { st, c }; }));
    const unknown = evs.filter(e => !bySid[e.sid]);
    const rows = S.classes.map(c => { const n = c.students.filter(st => eventOf(sk(st), d)).length, l = c.students.filter(st => { const e = eventOf(sk(st), d); return e && isLate(e); }).length;
      return `<tr><td>${esc(c.name)}</td><td style="text-align:right">${n}/${c.students.length}</td><td style="text-align:right">${l ? chip(l, 'warn') : '–'}</td></tr>`; }).join('');
    const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'เมื่อสักครู่' : m < 60 ? m + ' นาทีก่อน' : Math.round(m / 60) + ' ชม.ก่อน'; };
    return `<div class="card" id="scanCard" style="margin-top:14px"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><h2 class="grow" style="margin:0">สแกนหน้าเข้าประตู · วันนี้</h2>
        ${demo() ? `<button class="btn sm" data-scan="sim" title="สร้างรายการเข้าประตูสมมติ เฉพาะโหมดตัวอย่าง">จำลองการสแกน (ตัวอย่าง)</button>` : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chip('เข้าแล้ว ' + evs.length + ' คน', 'info')}${chip('หลัง ' + esc(lateTime()) + ' น. ' + late.length + ' คน', late.length ? 'warn' : 'ok')}${unknown.length ? chip('เลขประจำตัวไม่ตรงทะเบียน ' + unknown.length, 'bad') : ''}</div>
      <div class="grid g2" style="align-items:start"><div><div class="muted small" style="margin-bottom:6px">เครื่องสแกน</div><div class="list">${S.scanDevices.length ? S.scanDevices.map(v => `<div class="row"><div class="grow"><div class="t">${esc(v.name || v.id)}</div><div class="muted small">อัปเดต ${esc(ago(v.updatedAt))}</div></div>${v.url ? `<a class="btn sm" href="${esc(v.url)}/" target="_blank" rel="noopener">เปิดหน้าสแกน</a>` : chip('ออฟไลน์')}</div>`).join('') : '<p class="muted small">ยังไม่มีเครื่องรายงานเข้ามา — ที่เครื่องสแกน: ตั้งค่า › เชื่อม EMS แล้วกด “เผยแพร่ที่อยู่เครื่อง”</p>'}</div>
        ${unknown.length ? `<p class="small" style="color:var(--bad)">ไม่พบในทะเบียน: ${unknown.slice(0, 8).map(e => esc(e.sid)).join(', ')} — ตรวจเลขประจำตัวในเครื่องสแกนให้ตรงกับ EMS ทุกตัวอักษร</p>` : ''}</div>
        <div class="scroll"><table class="tbl"><thead><tr><th>ห้อง</th><th style="text-align:right">เข้าแล้ว</th><th style="text-align:right">สาย</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="muted small" style="margin-top:8px">ครูที่ปรึกษาเห็นเวลาเข้าประตูในหน้าเช็กชื่อแถวเช้า และกดใส่ “มา/สาย” ได้ทันที · หักคะแนนมาสายเมื่อครูกดบันทึกแถวเช้าเท่านั้น (ไม่หักซ้ำ)</div></div>`;
  }
  /* โหมดตัวอย่าง: ใส่เวลาเข้าประตูสมมติให้ทุกห้อง (07:05–08:20) และเครื่องสแกน 1 เครื่อง */
  function simulate() {
    const d = todayISO();
    S.classes.forEach(c => c.students.forEach((st, i) => { if ((i * 7 + c.name.length) % 11 === 0) return;
      const m = 7 * 60 + 5 + ((i * 37 + c.name.length * 13) % 75), at = new Date(d + 'T' + pad(Math.floor(m / 60)) + ':' + pad(m % 60) + ':00');
      const k = d + '_' + sk(st); if (!S.gateEvents[k]) S.gateEvents[k] = { sid: sk(st), date: d, at: at.toISOString(), deviceId: 'gate-1', method: 'face' }; }));
    if (!S.scanDevices.length) S.scanDevices.push({ id: 'gate-1', name: 'ประตูหน้า (ตัวอย่าง)', url: '', updatedAt: new Date().toISOString() });
    save(); render(); toast('ใส่ข้อมูลเข้าประตูสมมติแล้ว');
  }

  const baseRender = window.render;
  window.render = function () {
    const r = baseRender.apply(this, arguments);
    if (page === 'attendance') { topButton(); decorate(); }
    if ((page === 'affairs' || page === 'a-affairs') && canGate()) { const v = document.getElementById('view'); if (v && !document.getElementById('scanCard')) v.insertAdjacentHTML('beforeend', gateCard()); }
    return r;
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-scan]'); if (!t) return;
    if (t.dataset.scan === 'fill') return fill();
    if (t.dataset.scan === 'sim') return simulate();
    if (t.dataset.scan === 'open') return openScanner();
    if (t.dataset.scan === 'photo') {   /* ช่องเลือกไฟล์อยู่นอกหน้าเช็กชื่อ — หน้าวาดใหม่ระหว่างเลือกรูปก็ไม่หาย */
      let f = document.getElementById('scPhotoFile');
      if (!f) { f = document.createElement('input'); Object.assign(f, { type: 'file', id: 'scPhotoFile', accept: 'image/*', multiple: true, hidden: true }); document.body.appendChild(f); }
      return f.click(); }
    if (t.dataset.scan === 'photoAbsent') return photoAbsent();
  });
  document.addEventListener('change', e => {
    if (e.target.id !== 'scPhotoFile') return;
    const files = Array.from(e.target.files || []).slice(0, 5); e.target.value = ''; photoFiles(files);
  });
  const css = document.createElement('style');
  css.textContent = `.sc-gate{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}.sc-t{font-size:.7rem;padding:0 6px;width:fit-content;align-self:flex-start;display:inline-block}
#scPhoto .notice{margin:8px 0}.sc-shots{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-top:8px}
.sc-shot{position:relative;line-height:0}.sc-shot img{width:100%;border-radius:8px}
.sc-face{position:absolute;border:2px solid #22c55e;border-radius:4px}.sc-face.unk{border-color:#ef4444}
.sc-face b{position:absolute;left:-2px;top:-18px;background:#22c55e;color:#fff;font-size:11px;line-height:16px;padding:0 4px;border-radius:3px}`;
  document.head.appendChild(css);
  window.EMSScan = { eventOf, eventsOn, isLate, lateTime };
})();
