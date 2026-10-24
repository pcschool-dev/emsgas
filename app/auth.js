/* EMS — เข้าสู่ระบบด้วย Google: แยกครู/นักเรียนจากอีเมล
   - ครู/บุคลากร/แอดมิน: อีเมลตรงกับรายชื่อบุคลากร ใช้โดเมนใดก็ได้ (Gmail ส่วนตัวหรือบัญชีโรงเรียน) — ตรวจก่อนกฎนักเรียนเสมอ
     ระบบจริง: ปุ่ม Google ของครูต้องไม่ใส่ hd= และ firestore.rules ต้องอนุญาตบุคลากรจากรายชื่อ staff ไม่ใช่จากโดเมน
   - นักเรียน: ต้องเป็นบัญชี Google Workspace for Education ของโรงเรียน (โดเมนที่ตั้งไว้) เท่านั้น
     จับคู่กับนักเรียนจาก “รูปแบบอีเมล” เช่น {id}@โดเมน → เลขประจำตัว 12345 = 12345@โดเมน ไม่ต้องกรอกอีเมลนักเรียนทีละคน
   - ไม่พบในระบบ: ครูกด “ขอเพิ่มชื่อเข้าระบบ” ได้ทันที (กรอกอีเมลให้แล้ว) · นักเรียนแจ้งแอดมินพร้อมเลขประจำตัว
   ระบบจริง: Firebase Auth signInWithPopup(GoogleAuthProvider) แล้วส่ง user.email เข้า resolve() ตัวเดียวกันนี้
             ฝั่งนักเรียนใส่ hd=โดเมนโรงเรียนให้หน้าเลือกบัญชีเสนอเฉพาะบัญชีโรงเรียน และ firestore.rules ต้องตรวจโดเมน+เลขประจำตัวซ้ำอีกชั้น
             (นักเรียนอ่านได้เฉพาะเอกสารของเลขประจำตัวตัวเอง) */
(() => {
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
S.settings.studentLogin = S.settings.studentLogin !== false;
/* โรงเรียนปากช่อง: บัญชีนักเรียน = เลขประจำตัว (ตัวเลขล้วน) @pcschool.ac.th — ค่าตั้งต้นมาจาก config.js แก้ได้ที่หน้าตั้งค่าโรงเรียน */
const AUTH_CFG = (window.EMS_CONFIG && EMS_CONFIG.auth) || {};
S.settings.studentDomain = S.settings.studentDomain || AUTH_CFG.studentDomain || '';
S.settings.studentPattern = S.settings.studentPattern || AUTH_CFG.studentPattern || '{id}';            // ส่วนหน้า @ เช่น {id} หรือ s{id} หรือ std{id}
const low = v => String(v || '').trim().toLowerCase();
const keyOf = s => String(s.sid || s.id || '');
const ADMIN_ROLES = ['admin', 'exec', 'academic', 'measure', 'personnel', 'general', 'affairs'];
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const domain = () => low(S.settings.studentDomain).replace(/^@/, '');
const sample = id => S.settings.studentPattern.replace('{id}', id) + '@' + (domain() || 'โดเมนโรงเรียน');

/** อีเมล → ใครในระบบ */
function resolve(email) {
  const e = low(email); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { kind: 'bad' };
  const [local, dom] = e.split('@');
  const staff = (S.staff || []).find(u => low(u.email) === e);
  if (staff) return { kind: 'staff', u: staff };
  const all = S.classes.flatMap(c => c.students.map(s => ({ c, s })));
  if (domain() && dom === domain()) {
    if (!S.settings.studentLogin) return { kind: 'closed' };
    const byMail = all.find(x => low(x.s.email) === e); if (byMail) return { kind: 'student', ...byMail };
    const m = local.match(new RegExp('^' + reEsc(low(S.settings.studentPattern)).replace('\\{id\\}', '(\\d+)') + '$'));
    if (m) { const hit = all.find(x => keyOf(x.s) === m[1]); return hit ? { kind: 'student', ...hit } : { kind: 'student-missing', id: m[1] }; }
    return { kind: 'school-unknown' };                                          // บัญชีโรงเรียนที่ไม่ใช่รูปแบบนักเรียน (อาจเป็นครูที่ยังไม่ได้ผูกอีเมล)
  }
  return { kind: 'unknown', personal: /^(gmail|googlemail|hotmail|outlook|yahoo)\./.test(dom) };
}

/* ---------- หน้าต่างเข้าสู่ระบบ (ต้นแบบจำลองหน้าเลือกบัญชี Google) ---------- */
function signInBox(prefill, msg) {
  modal(`<h2 style="margin-bottom:4px">เข้าสู่ระบบด้วย Google</h2>
    <p class="muted small" style="margin-bottom:12px">${LIVE ? '' : '<b>โหมดตัวอย่าง:</b> ระบบจริงจะเปิดหน้าต่างเลือกบัญชี Google — ตอนนี้พิมพ์อีเมลเพื่อลองดูว่าระบบจะพาไปหน้าไหน<br>'}
      ครูใช้อีเมลที่ลงทะเบียนไว้ · นักเรียนใช้บัญชีโรงเรียน${domain() ? ' <b>@' + esc(domain()) + '</b>' : ''}</p>
    ${msg || ''}
    <div class="field"><label class="f" for="au-e">อีเมล Google</label><input id="au-e" class="in" type="email" inputmode="email" autocomplete="email" value="${esc(prefill || '')}" placeholder="${domain() ? esc(sample('12345')) : 'name@gmail.com'}"></div>
    <button class="btn pri" style="width:100%" data-au="go">เข้าสู่ระบบ</button>
    ${LIVE ? '' : `<div class="muted small" style="margin-top:10px">ลองได้: ${(S.staff || []).filter(u => u.email).slice(0, 2).map(u => `<button class="btn sm ghost" data-au="try" data-v="${esc(u.email)}">${esc(u.email)}</button>`).join('')}${domain() && S.classes[0] ? `<button class="btn sm ghost" data-au="try" data-v="${esc(sample(keyOf(S.classes[0].students[0])))}">${esc(sample(keyOf(S.classes[0].students[0])))}</button>` : ''}</div>`}`, true);
  const s = $('#layer .sheet'); if (s) s.style.maxWidth = '460px';
  setTimeout(() => { const i = $('#au-e'); if (i) i.focus(); }, 30);
}
function enter(view, extra) {
  try { sessionStorage.setItem('ems-auth', '1'); } catch (x) {}
  S.view = view; Object.assign(S, extra || {}); save();
  const g = document.getElementById('gate'); if (g) { g.hidden = true; document.body.style.overflow = ''; }
  closeModal(); page = homeOf(); render(); scrollTo(0, 0);
}
function go(email) {
  const r = resolve(email), e = low(email);
  const warn = h => `<div class="notice bad" style="margin-bottom:12px">${h}</div>`;
  switch (r.kind) {
    case 'bad': return signInBox(email, warn('รูปแบบอีเมลไม่ถูกต้อง'));
    case 'staff': { const roles = r.u.roles && r.u.roles.length ? r.u.roles : [r.u.role || 'teacher'];
      enter(roles.some(x => ADMIN_ROLES.indexOf(x) >= 0) && roles.indexOf('teacher') < 0 ? 'admin' : 'teacher');
      return toast('ยินดีต้อนรับ ' + r.u.name + (LIVE || r.u.name === S.me.name ? '' : ' · ต้นแบบแสดงข้อมูลตัวอย่าง')); }
    case 'student': enter('student', { student: { classId: r.c.id, id: r.s.id } }); return toast('ยินดีต้อนรับ ' + r.s.name + ' · ' + r.c.name);
    case 'closed': return signInBox(email, warn('ขณะนี้ยังไม่เปิดให้นักเรียนเข้าสู่ระบบ'));
    case 'student-missing': return signInBox(email, warn(`ไม่พบนักเรียนเลขประจำตัว <b>${esc(r.id)}</b> ในระบบ — อาจยังไม่ได้นำเข้ารายชื่อ หรือย้ายห้อง<div style="margin-top:8px"><button class="btn sm" data-au="contact" data-t="login" data-v="${esc(e)}">แจ้งแอดมิน</button></div>`));
    case 'school-unknown': return signInBox(email, warn(`บัญชีโรงเรียนนี้ยังไม่มีในรายชื่อ — ถ้าเป็นครู ขอเพิ่มชื่อเข้าระบบได้เลย · ถ้าเป็นนักเรียน บัญชีควรอยู่ในรูป <b>${esc(sample('เลขประจำตัว'))}</b>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm pri" data-au="contact" data-t="join" data-v="${esc(e)}">ขอเพิ่มชื่อเข้าระบบ (ครู)</button><button class="btn sm" data-au="contact" data-t="login" data-v="${esc(e)}">แจ้งแอดมิน (นักเรียน)</button></div>`));
    default: return signInBox(email, warn(`อีเมล <b>${esc(e)}</b> ยังไม่มีในระบบ${r.personal && domain() ? `<br>ถ้าเป็น<b>นักเรียน</b> ใช้บัญชีโรงเรียน <b>@${esc(domain())}</b> แทนบัญชีส่วนตัว` : ''}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm pri" data-au="contact" data-t="join" data-v="${esc(e)}">ขอเพิ่มชื่อเข้าระบบ (ครู)</button><button class="btn sm" data-au="again">ลองบัญชีอื่น</button></div>`));
  }
}
document.addEventListener('click', e => {
  const g = e.target.closest('#gate .g-gbtn');
  if (g && !LIVE) { e.stopImmediatePropagation(); e.preventDefault(); return signInBox(''); }     // โหมดจริง: cloud.js เปิดหน้าต่าง Google       // แทนปุ่ม Google เดิม (เดิมเข้าเป็นครูตัวอย่างทันที)
  const t = e.target.closest('[data-au]'); if (!t) return;
  const d = t.dataset;
  if (d.au === 'go') return go(($('#au-e') || {}).value);
  if (d.au === 'try') { const i = $('#au-e'); if (i) i.value = d.v; return; }
  if (d.au === 'again') return signInBox('');
  if (d.au === 'contact') { closeModal(); if (window.EMSContact) { EMSContact.open(d.t); setTimeout(() => { const i = $('#ct-e'); if (i) i.value = d.v; const m = $('#ct-m'); if (m && d.t === 'login' && !m.value) m.value = 'เข้าสู่ระบบด้วย ' + d.v + ' ไม่ได้'; }, 0); } }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'au-e') { e.preventDefault(); go(e.target.value); } });

/* ---------- ตั้งค่า (แอดมิน › ตั้งค่าโรงเรียน › โครงสร้างโรงเรียน) ---------- */
function testLine(v) {
  if (!v) return '<span class="muted small">พิมพ์อีเมลเพื่อทดสอบว่าระบบจะจับคู่กับใคร</span>';
  const r = resolve(v);
  return r.kind === 'student' ? chip('นักเรียน: ' + esc(r.s.name) + ' · ' + esc(r.c.name) + ' · ' + esc(keyOf(r.s)), 'ok')
    : r.kind === 'staff' ? chip('บุคลากร: ' + esc(r.u.name), 'info')
    : r.kind === 'student-missing' ? chip('รูปแบบถูก แต่ไม่พบเลขประจำตัว ' + esc(r.id), 'warn')
    : r.kind === 'closed' ? chip('ปิดการเข้าสู่ระบบของนักเรียนอยู่', 'warn')
    : r.kind === 'school-unknown' ? chip('บัญชีโรงเรียน แต่ไม่ตรงรูปแบบนักเรียนและไม่อยู่ในรายชื่อบุคลากร', 'warn')
    : r.kind === 'bad' ? chip('รูปแบบอีเมลไม่ถูกต้อง', 'bad') : chip('ไม่อยู่ในระบบ' + (r.personal ? ' · บัญชีส่วนตัว' : ''), 'bad');
}
const card = () => { const st = S.settings, n = S.classes.reduce((a, c) => a + c.students.length, 0), ex = S.classes[0] && S.classes[0].students[0];
  return `<div class="card" id="au-card"><h2>การเข้าสู่ระบบของนักเรียน</h2>
    <p class="muted small" style="margin:-6px 0 12px">นักเรียนใช้บัญชี Google Workspace for Education ของโรงเรียน · ระบบจับคู่กับนักเรียนจากเลขประจำตัวในอีเมล ไม่ต้องกรอกอีเมลนักเรียนทีละคน · นักเรียนใช้บัญชีส่วนตัว (Gmail) ไม่ได้</p>
    <div class="notice" style="background:var(--info-soft)"><b>ครูและแอดมินไม่ถูกจำกัดโดเมน</b> — ใช้อีเมลใดก็ได้ที่ลงทะเบียนไว้ในหน้า ผู้ใช้และสิทธิ์ (เช่น Gmail ส่วนตัว หรือ @pcschool.ac.th) ระบบตรวจรายชื่อบุคลากรก่อนเสมอ แล้วจึงตรวจรูปแบบบัญชีนักเรียน</div>
    ${!domain() ? '<div class="notice bad">ยังไม่ได้ตั้งโดเมนของโรงเรียน — นักเรียนจะยังเข้าสู่ระบบไม่ได้</div>' : ''}
    <label class="pf-tog" style="border:0;padding-top:0"><input type="checkbox" data-auf="studentLogin" ${st.studentLogin ? 'checked' : ''}><span><b>เปิดให้นักเรียนเข้าสู่ระบบ</b><br><span class="muted small">ปิดชั่วคราวได้ เช่น ช่วงกำลังกรอกคะแนนก่อนประกาศผล</span></span></label>
    <div class="grid g2"><div class="field"><label class="f" for="au-d">โดเมนบัญชีนักเรียน</label><div style="display:flex;align-items:center;gap:6px"><span class="muted">@</span><input id="au-d" class="in" value="${esc(domain())}" placeholder="เช่น pcschool.ac.th" data-auf="studentDomain"></div></div>
      <div class="field"><label class="f" for="au-p">รูปแบบชื่อบัญชี (ส่วนหน้า @)</label><input id="au-p" class="in" value="${esc(st.studentPattern)}" placeholder="{id}" data-auf="studentPattern"><div class="muted small">{id} = เลขประจำตัว เช่น {id} · s{id} · std{id}</div></div></div>
    <div class="muted small">ตัวอย่าง: ${ex ? `${esc(ex.name)} เลขประจำตัว ${esc(keyOf(ex))} → <b>${esc(sample(keyOf(ex)))}</b>` : esc(sample('12345'))} · นักเรียนในระบบ ${n} คน</div>
    <div class="field" style="margin-top:10px"><label class="f" for="au-t">ทดสอบอีเมล</label><input id="au-t" class="in" type="email" placeholder="${esc(sample(ex ? keyOf(ex) : '12345'))}" data-auf="test"><div id="au-tr" style="margin-top:6px">${testLine('')}</div></div></div>`; };
const baseSet = P['a-settings'];
P['a-settings'] = () => { const h = baseSet(); return (S.adm && (S.adm.sec === 'school' || !S.adm.sec)) || /โครงสร้างโรงเรียน —/.test(h) ? h + card() : h; };
document.addEventListener('change', e => { const t = e.target, k = t.dataset.auf; if (!k || k === 'test') return;
  S.settings[k] = t.type === 'checkbox' ? t.checked : k === 'studentDomain' ? low(t.value).replace(/^@/, '') : (t.value.trim().indexOf('{id}') >= 0 ? t.value.trim() : '{id}');
  save(); toast('บันทึกการตั้งค่าการเข้าสู่ระบบแล้ว'); const y = scrollY; render(); scrollTo(0, y); });
document.addEventListener('input', e => { if (e.target.dataset.auf === 'test') { const o = $('#au-tr'); if (o) o.innerHTML = testLine(e.target.value); } });

window.EMSAuth = { resolve, signIn: signInBox };
})();
