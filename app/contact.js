/* EMS — ติดต่อแอดมิน
   ใช้ได้ทั้งก่อนเข้าสู่ระบบ (หน้าแรก) และหลังเข้าสู่ระบบ (หน้าหลัก/เมนูบัญชี/ค้นหาเมนู)
   - ขอเพิ่มชื่อเข้าระบบ: ครูใหม่ที่ยังไม่มีอีเมลในระบบ กรอกชื่อ อีเมล กลุ่มสาระ → แอดมินกด “เพิ่มเป็นบุคลากร” ทีเดียว
   - เข้าสู่ระบบไม่ได้ / แจ้งปัญหาการใช้งาน / เรื่องอื่น ๆ: แนบภาพหน้าจอได้ 1 รูป (ย่อเหลือไม่เกิน 1000 px)
     ระบบแนบหน้าที่กำลังเปิดและชนิดอุปกรณ์ไปให้เอง แอดมินไม่ต้องถามซ้ำ
   ระบบจริง: เขียนลงคอลเลกชัน contactRequests ใน Firestore (สร้างได้โดยไม่ต้องล็อกอิน แต่แก้/อ่านได้เฉพาะแอดมิน)
              รูปแนบเก็บ Firebase Storage — ต้นแบบนี้เก็บใน S.contactReqs ของเครื่องนี้ */
(() => {
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const TYPES = { join: ['ขอเพิ่มชื่อเข้าระบบ', 'ยังไม่มีชื่อ/อีเมลในระบบ ต้องการเริ่มใช้งาน', 'user', 'info'], login: ['เข้าสู่ระบบไม่ได้', 'มีชื่อแล้วแต่เข้าไม่ได้ หรือเข้าแล้วเมนูไม่ตรงหน้าที่', 'lock', 'warn'],
  bug: ['แจ้งปัญหาการใช้งาน', 'ปุ่มกดไม่ได้ ข้อมูลไม่ตรง หน้าจอผิดปกติ', 'gear', 'bad'], other: ['เรื่องอื่น ๆ / ข้อเสนอแนะ', 'ขอเพิ่มเมนู ขอสิทธิ์ ข้อเสนอแนะ', 'form', ''] };
const ST = { new: ['ใหม่', 'warn'], doing: ['กำลังดำเนินการ', 'info'], done: ['เสร็จแล้ว', 'ok'] };
const AREAS = ['ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์', 'สังคมศึกษา ศาสนาและวัฒนธรรม', 'สุขศึกษาและพลศึกษา', 'ศิลปะ', 'การงานอาชีพ', 'ภาษาต่างประเทศ', 'กิจกรรมพัฒนาผู้เรียน', 'ฝ่ายวิชาการ', 'ผู้บริหาร', 'เจ้าหน้าที่ / ลูกจ้าง'];
S.contactReqs = S.contactReqs || [];
const authed = () => { try { return sessionStorage.getItem('ems-auth') === '1'; } catch (e) { return false; } };
const when = iso => { const d = new Date(iso); return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'; };
const okMail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const device = () => { const u = navigator.userAgent; return (/iphone|ipad/i.test(u) ? 'iOS' : /android/i.test(u) ? 'Android' : /windows/i.test(u) ? 'Windows' : /mac/i.test(u) ? 'Mac' : 'อื่น ๆ') + ' · ' +
  (/edg\//i.test(u) ? 'Edge' : /line\//i.test(u) ? 'LINE' : /chrome|crios/i.test(u) ? 'Chrome' : /safari/i.test(u) ? 'Safari' : /firefox/i.test(u) ? 'Firefox' : 'เบราว์เซอร์อื่น') + ' · จอ ' + screen.width + '×' + screen.height; };
const pageName = () => { const N = window.EMSNav; if (!N || !authed()) return 'หน้าเข้าสู่ระบบ';
  for (const [g, items] of (N.NAVG[N.view()] || [])) for (const it of items) if (it[0] === page) return (g ? g + ' › ' : '') + it[1]; return page; };

/* ---------- แบบฟอร์ม ---------- */
let IMG = '', TYPE = 'join';
function form(type) {
  TYPE = type || (authed() ? 'bug' : 'join'); IMG = '';
  const me = authed() && S.me ? S.me : null, staff = me && (S.staff || []).find(u => u.name === me.name);
  modal(`<h2 style="margin-bottom:4px">ติดต่อแอดมิน</h2><p class="muted small" style="margin-bottom:12px">งานพัฒนาและบริการระบบดิจิทัลโรงเรียน (DSDS) · ตอบกลับทางอีเมลหรือเบอร์โทรที่ให้ไว้</p>
    <div class="ct-types" role="radiogroup" aria-label="เรื่องที่ติดต่อ">${Object.entries(TYPES).map(([k, [l, d, i]]) => `<button class="ct-type" role="radio" aria-checked="${k === TYPE}" data-ct="type" data-k="${k}">${ic(i)}<span><b>${l}</b><small>${d}</small></span></button>`).join('')}</div>
    <div class="grid g2" style="margin-top:12px"><div class="field"><label class="f" for="ct-n">ชื่อ-สกุล *</label><input id="ct-n" class="in" autocomplete="name" value="${esc(me ? me.name : '')}" placeholder="เช่น ครูสมศรี ใจดี"></div>
      <div class="field"><label class="f" for="ct-e">อีเมลที่ใช้เข้าสู่ระบบ ${TYPE === 'join' || TYPE === 'login' ? '*' : ''}</label><input id="ct-e" class="in" type="email" autocomplete="email" inputmode="email" value="${esc(staff ? staff.email || '' : '')}" placeholder="name@gmail.com หรืออีเมลโรงเรียน"></div></div>
    <div class="grid g2"><div class="field"><label class="f" for="ct-p">เบอร์โทร / LINE</label><input id="ct-p" class="in" autocomplete="tel" inputmode="tel" value="${esc(staff ? staff.phone || '' : '')}"></div>
      <div class="field" ${TYPE === 'join' ? '' : 'hidden'}><label class="f" for="ct-d">กลุ่มสาระ / กลุ่มงาน *</label><select id="ct-d" class="in"><option value="">— เลือก —</option>${AREAS.map(a => `<option>${a}</option>`).join('')}</select></div></div>
    <div class="field" ${TYPE === 'join' ? '' : 'hidden'}><label class="f" for="ct-r">ตำแหน่ง</label><select id="ct-r" class="in"><option>ครู</option><option>ครูผู้ช่วย</option><option>พนักงานราชการ / ครูอัตราจ้าง</option><option>เจ้าหน้าที่</option><option>ผู้บริหาร</option></select></div>
    <div class="field"><label class="f" for="ct-m">${TYPE === 'join' ? 'หมายเหตุ (ถ้ามี)' : 'รายละเอียด *'}</label><textarea id="ct-m" class="in" rows="3" placeholder="${TYPE === 'bug' ? 'ทำอะไรอยู่ กดปุ่มไหน แล้วเกิดอะไรขึ้น' : TYPE === 'login' ? 'เช่น กดเข้าสู่ระบบแล้วขึ้นว่าไม่พบอีเมล' : TYPE === 'join' ? 'เช่น ย้ายมาใหม่ภาคเรียนนี้ สอนวิชา...' : ''}"></textarea></div>
    ${TYPE === 'join' ? '' : `<div class="field"><span class="f">ภาพหน้าจอ (ถ้ามี)</span><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn sm" data-ct="img">${ic('up')}แนบรูป</button><span id="ct-img" class="muted small">ยังไม่ได้แนบ</span></div></div>`}
    <input id="ct-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px" placeholder="อย่ากรอกช่องนี้">
    <div class="muted small" style="margin-bottom:10px">ระบบแนบหน้าที่เปิดอยู่ (${esc(pageName())}) และชนิดอุปกรณ์ (${esc(device())}) ไปให้แอดมินด้วย</div>
    <button class="btn pri" style="width:100%" data-ct="send">${ic('up')}ส่งถึงแอดมิน</button>`);
  const s = $('#layer .sheet'); if (s) s.style.maxWidth = '640px';
}
async function attach() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => { const f = i.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    try { const im = await new Promise((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = url; });
      const k = Math.min(1, 1000 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); IMG = cv.toDataURL('image/jpeg', 0.75);
      const el = $('#ct-img'); if (el) el.innerHTML = `<img src="${IMG}" alt="ภาพที่แนบ" style="height:48px;border-radius:6px;vertical-align:middle"> ${Math.round(IMG.length * 0.75 / 1024)} KB`;
    } catch (e) { toast('อ่านรูปไม่ได้'); } finally { URL.revokeObjectURL(url); } };
  i.click();
}
function send() {
  const v = id => (($('#' + id) || {}).value || '').trim();
  if (v('ct-hp')) return closeModal();                                     // บอทกรอกช่องที่ซ่อนไว้
  const r = { id: uid('ct'), ref: 'EMS-' + String(Date.now()).slice(-5), type: TYPE, name: v('ct-n'), email: v('ct-e').toLowerCase(), phone: v('ct-p'), dept: v('ct-d'), position: v('ct-r'),
    msg: v('ct-m'), img: IMG, page: pageName(), device: device(), by: authed() && S.me ? S.me.name : '', at: new Date().toISOString(), status: 'new', note: '' };
  if (TYPE !== 'join') { r.dept = ''; r.position = ''; }
  if (!r.name) return toast('กรุณากรอกชื่อ-สกุล');
  if ((TYPE === 'join' || TYPE === 'login') && !okMail(r.email)) return toast('กรุณากรอกอีเมลให้ถูกต้อง');
  if (r.email && !okMail(r.email)) return toast('รูปแบบอีเมลไม่ถูกต้อง');
  if (TYPE === 'join' && !r.dept) return toast('กรุณาเลือกกลุ่มสาระ / กลุ่มงาน');
  if (TYPE !== 'join' && !r.msg) return toast('กรุณาเล่ารายละเอียดสั้น ๆ');
  try { const last = +localStorage.getItem('ems-ct-last') || 0; if (Date.now() - last < 30000) return toast('เพิ่งส่งไป รอสักครู่แล้วค่อยส่งอีกครั้ง'); localStorage.setItem('ems-ct-last', String(Date.now())); } catch (e) {}
  if (TYPE === 'join' && (S.staff || []).some(u => String(u.email || '').toLowerCase() === r.email)) { r.note = 'อีเมลนี้มีในระบบอยู่แล้ว'; }
  if (LIVE && window.EMSCloud) EMSCloud.submitContact(r).catch(e => toast('ส่งไม่สำเร็จ: ' + (e.code || e.message)));      // ส่งตรงเข้าระบบ แม้ยังไม่ได้เข้าสู่ระบบ
  else { S.contactReqs.unshift(r); save(); }
  modal(`<div style="text-align:center"><div class="ico ok" style="margin:0 auto 10px;width:56px;height:56px">${ic('check')}</div><h2>ส่งถึงแอดมินแล้ว</h2>
    <p class="muted" style="margin:6px 0 12px">เลขที่เรื่อง <b>${r.ref}</b><br>${TYPE === 'join' ? 'เมื่อแอดมินเพิ่มชื่อแล้ว เข้าสู่ระบบด้วย Google ด้วยอีเมล <b>' + esc(r.email) + '</b> ได้เลย' : 'แอดมินจะติดต่อกลับทาง' + (r.email ? 'อีเมล' : '') + (r.email && r.phone ? 'หรือ' : '') + (r.phone ? 'โทรศัพท์' : 'ช่องทางที่ให้ไว้')}</p>
    <button class="btn pri" data-act="close" style="min-width:140px">ปิด</button></div>`, true);
  if (authed()) render();
}

/* ---------- หน้าแรก (ก่อนเข้าสู่ระบบ) ---------- */
function gateButtons() {
  const note = document.querySelector('#gate .g-note'); if (!note) return;
  let box = document.getElementById('g-help');
  if (!box) { box = document.createElement('div'); box.id = 'g-help'; note.parentNode.insertBefore(box, note); }
  box.innerHTML = `<div class="g-or">ยังเข้าใช้งานไม่ได้?</div><div class="g-roles">
      <button class="g-role" data-ct="open" data-k="join"><span class="ico">${ic('user')}</span><span><b>ขอเพิ่มชื่อเข้าระบบ</b><span class="s">ครูใหม่ / ยังไม่มีอีเมลในระบบ</span></span></button>
      <button class="g-role" data-ct="open" data-k="login"><span class="ico gold">${ic('inbox')}</span><span><b>ติดต่อแอดมิน / แจ้งปัญหา</b><span class="s">เข้าไม่ได้ ใช้งานติดขัด ข้อเสนอแนะ</span></span></button>
      ${window.EMSInstall && EMSInstall.can() ? `<button class="g-role" data-pwa="install"><span class="ico ok">${ic('down')}</span><span><b>ติดตั้งแอป EMS</b><span class="s">มีไอคอนบนหน้าจอ เปิดเต็มจอเหมือนแอป</span></span></button>` : ''}
      <button class="g-role" type="button" data-sysmenu><span class="ico">${ic('grid')}</span><span><b>ระบบอื่นของโรงเรียน</b><span class="s">รับหนังสือ บุคลากร บัญชีผู้ใช้ และระบบอื่น ๆ</span></span></button></div>`;
  note.innerHTML = note.innerHTML.replace('ติดปัญหาเข้าสู่ระบบ? แจ้งงานพัฒนาและบริการระบบดิจิทัลโรงเรียน', 'ดูแลระบบโดย งานพัฒนาและบริการระบบดิจิทัลโรงเรียน');
}
gateButtons(); document.addEventListener('ems-install', gateButtons);

/* ---------- หน้าหลักของครู/นักเรียน: ปุ่มติดต่อแอดมิน ---------- */
const help = () => `<div class="card ct-help"><div class="row" style="border:0;padding:0;flex-wrap:wrap"><div class="ico gold">${ic('inbox')}</div><div class="grow"><div class="t">ติดต่อแอดมิน</div><div class="muted small">แจ้งปัญหาการใช้งาน ขอสิทธิ์/เมนูเพิ่ม หรือแนะนำครูใหม่ให้ขอเพิ่มชื่อเข้าระบบ</div></div>
  <button class="btn sm" data-ct="open" data-k="bug">แจ้งปัญหา</button><button class="btn sm" data-ct="open" data-k="other">ข้อเสนอแนะ</button>${window.EMSInstall && EMSInstall.can() ? `<button class="btn sm pri" data-pwa="install">${ic('down')}ติดตั้งแอป</button>` : ''}</div></div>`;
['home', 's-home'].forEach(k => { const base = P[k]; if (base) P[k] = () => base() + help(); });

/* ---------- แอดมิน: กล่องติดต่อ ---------- */
let F = 'open';
const staffByMail = e => (S.staff || []).find(u => String(u.email || '').toLowerCase() === e);
const staffByName = n => (S.staff || []).find(u => String(u.name || '').replace(/\s+/g, '') === String(n || '').replace(/\s+/g, ''));
P['a-inbox'] = () => {
  const all = S.contactReqs, list = all.filter(r => F === 'all' || (F === 'open' ? r.status !== 'done' : r.type === F)), n = k => all.filter(r => r.status !== 'done' && r.type === k).length;
  return `<div class="top"><div><h1>กล่องติดต่อแอดมิน</h1><p>คำขอเพิ่มชื่อเข้าระบบ ปัญหาเข้าสู่ระบบ และแจ้งปัญหาการใช้งานจากครูและนักเรียน</p></div></div>
    <div class="grid g4" style="margin-bottom:16px">${Object.entries(TYPES).map(([k, [l, , , c]]) => `<div class="card kpi"><div class="l">${l}</div><div class="v" ${n(k) ? `style="color:var(--${c || 'text'})"` : ''}>${n(k)}</div><div class="s muted">ยังไม่เสร็จ</div></div>`).join('')}</div>
    <div class="pills">${[['open', 'ยังไม่เสร็จ'], ['all', 'ทั้งหมด']].concat(Object.entries(TYPES).map(([k, v]) => [k, v[0]])).map(([k, l]) => `<button class="pill" aria-pressed="${F === k}" data-ct="f" data-k="${k}">${l}</button>`).join('')}</div>
    ${list.length ? list.map(r => { const [l, , i, c] = TYPES[r.type] || TYPES.other, [sl, sk] = ST[r.status] || ST.new, have = r.email && staffByMail(r.email), same = !have && staffByName(r.name);
      return `<div class="card"><div class="row" style="border:0;padding:0;align-items:flex-start;flex-wrap:wrap"><div class="ico ${c === 'bad' ? 'gold' : c === 'info' ? 'info' : ''}">${ic(i)}</div>
        <div class="grow" style="min-width:220px"><div class="t">${esc(r.name)} ${chip(l, c)} ${chip(sl, sk)}</div>
          <div class="muted small">${r.ref} · ${when(r.at)}${r.email ? ' · ' + esc(r.email) : ''}${r.phone ? ' · ☎ ' + esc(r.phone) : ''}${r.dept ? ' · ' + esc(r.dept) : ''}${r.position ? ' · ' + esc(r.position) : ''}</div>
          ${r.msg ? `<p style="margin:6px 0;white-space:pre-wrap">${esc(r.msg)}</p>` : ''}
          ${r.img ? `<a href="${r.img}" target="_blank" rel="noopener"><img src="${r.img}" alt="ภาพหน้าจอที่แนบ" style="max-height:120px;border-radius:8px;border:1px solid var(--line);margin:4px 0"></a>` : ''}
          <div class="muted small">หน้าที่เปิด: ${esc(r.page || '-')} · ${esc(r.device || '')}${r.by ? ' · ส่งขณะล็อกอินเป็น ' + esc(r.by) : ''}</div>
          ${r.type === 'join' || r.type === 'login' ? `<div class="small" style="margin-top:6px">${have ? chip('อีเมลนี้มีในระบบแล้ว: ' + esc(have.name), 'ok') : same ? chip('พบชื่อนี้ในระบบ แต่ยังไม่ได้ผูกอีเมลนี้', 'warn') : chip('ยังไม่มีในระบบ', 'info')}</div>` : ''}
          <input class="in" style="margin-top:8px;max-width:520px;text-align:left" placeholder="บันทึกของแอดมิน (เห็นเฉพาะแอดมิน)" value="${esc(r.note || '')}" data-ctf="note" data-id="${r.id}" aria-label="บันทึกของแอดมิน"></div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:180px">
          ${(r.type === 'join' || r.type === 'login') && !have && r.email ? (same ? `<button class="btn sm pri" data-ct="link" data-id="${r.id}">ผูกอีเมลกับ ${esc(same.name)}</button>` : `<button class="btn sm pri" data-ct="add" data-id="${r.id}">${ic('plus')}เพิ่มเป็นบุคลากร</button>`) : ''}
          ${r.email ? `<a class="btn sm" href="mailto:${esc(r.email)}?subject=${encodeURIComponent('EMS เรื่อง ' + r.ref + ' · ' + l)}">ตอบกลับทางอีเมล</a>` : ''}
          ${r.status === 'new' ? `<button class="btn sm" data-ct="st" data-id="${r.id}" data-v="doing">รับเรื่อง</button>` : ''}
          ${r.status !== 'done' ? `<button class="btn sm" data-ct="st" data-id="${r.id}" data-v="done">${ic('check')}เสร็จแล้ว</button>` : `<button class="btn sm" data-ct="st" data-id="${r.id}" data-v="doing">เปิดเรื่องอีกครั้ง</button>`}
          <button class="btn sm ghost" style="color:var(--bad)" data-ct="del" data-id="${r.id}">ลบ</button></div></div></div>`; }).join('')
      : `<div class="card"><div class="empty">${all.length ? 'ไม่มีเรื่องในหมวดนี้' : 'ยังไม่มีใครติดต่อเข้ามา'}</div></div>`}`;
};
/* เมนู + จุดแดง + รายการรอดำเนินการ */
const N = window.EMSNav; if (N && N.NAVG.admin && !N.NAVG.admin[0][1].some(x => x[0] === 'a-inbox')) N.NAVG.admin[0][1].push(['a-inbox', 'กล่องติดต่อแอดมิน', 'inbox']);
const basePend = window.EMSPendingItems;
if (basePend) window.EMSPendingItems = () => basePend().concat(S.contactReqs.filter(r => r.status === 'new').map(r => ({ who: r.name, what: (TYPES[r.type] || TYPES.other)[0] + (r.email ? ' · ' + r.email : ''), date: new Date(r.at).toLocaleDateString('sv-SE'), icon: 'inbox' })));
const baseApprove = P['a-approve'];
if (baseApprove) P['a-approve'] = () => { const n = S.contactReqs.filter(r => r.status !== 'done').length;
  return baseApprove().replace(/(<div class="card"><div class="list">)/, `$1<div class="row"><div class="ico gold">${ic('inbox')}</div><div class="grow"><div class="t">กล่องติดต่อแอดมิน</div><div class="muted small">ขอเพิ่มชื่อเข้าระบบ · เข้าสู่ระบบไม่ได้ · แจ้งปัญหา</div></div>${chip(n, n ? 'warn' : 'ok')}<button class="btn sm" data-act="go" data-p="a-inbox">เปิด</button></div>`); };

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ct]'); if (!t) return;
  const d = t.dataset, r = d.id && S.contactReqs.find(x => x.id === d.id);
  switch (d.ct) {
    case 'open': return form(d.k);
    case 'type': { const keep = { n: ($('#ct-n') || {}).value, e: ($('#ct-e') || {}).value, p: ($('#ct-p') || {}).value, m: ($('#ct-m') || {}).value };
      form(d.k); [['ct-n', keep.n], ['ct-e', keep.e], ['ct-p', keep.p], ['ct-m', keep.m]].forEach(([id, v]) => { const el = $('#' + id); if (el && v) el.value = v; }); return; }
    case 'img': return attach();
    case 'send': return send();
    case 'f': F = d.k; return redraw();
    case 'st': if (r) { r.status = d.v; r.doneBy = S.me.name; save(); toast(d.v === 'done' ? 'ปิดเรื่องแล้ว' : 'รับเรื่องแล้ว'); } return redraw();
    case 'del': S.contactReqs = S.contactReqs.filter(x => x !== r); save(); return redraw();
    case 'add': { if (!r) return; if (staffByMail(r.email)) return toast('อีเมลนี้มีในระบบแล้ว');
      S.staff.push({ name: r.name, email: r.email, phone: r.phone, dept: r.dept || '', role: r.position === 'ผู้บริหาร' ? 'exec' : 'teacher', roles: [r.position === 'ผู้บริหาร' ? 'exec' : 'teacher'] });
      r.status = 'done'; r.note = (r.note ? r.note + ' · ' : '') + 'เพิ่มเป็นบุคลากรแล้ว'; save(); toast('เพิ่ม ' + r.name + ' แล้ว — ตั้งบทบาท/ห้องที่ปรึกษาเพิ่มได้ที่ ผู้ใช้และสิทธิ์'); return redraw(); }
    case 'link': { if (!r) return; const u = staffByName(r.name); if (!u) return; u.email = r.email; if (r.phone && !u.phone) u.phone = r.phone;
      r.status = 'done'; r.note = (r.note ? r.note + ' · ' : '') + 'ผูกอีเมลกับบุคลากรเดิมแล้ว'; save(); toast('ผูกอีเมล ' + r.email + ' กับ ' + u.name + ' แล้ว'); return redraw(); }
  }
});
document.addEventListener('change', e => { const t = e.target; if (t.dataset.ctf !== 'note') return; const r = S.contactReqs.find(x => x.id === t.dataset.id); if (r) { r.note = t.value.trim(); save(); } });

const st = document.createElement('style');
st.textContent = `
.ct-types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.ct-type{display:flex;gap:10px;align-items:flex-start;text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:10px;color:var(--text)}
.ct-type svg{width:20px;height:20px;flex:none;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-top:2px;color:var(--muted)}
.ct-type b{display:block;font-size:.92rem}.ct-type small{display:block;color:var(--muted);font-size:.76rem;line-height:1.35}
.ct-type[aria-checked="true"]{border-color:var(--brand);background:var(--brand-soft)}.ct-type[aria-checked="true"] svg{color:var(--brand)}
.ct-help{margin-top:16px}
@media(max-width:520px){.ct-types{grid-template-columns:minmax(0,1fr)}}
`;
document.head.appendChild(st);
window.EMSContact = { open: form };
})();
