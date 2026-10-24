/* EMS — หน้าแรก: เข้าสู่ระบบ
   โหมดตัวอย่าง: ปุ่ม Google และปุ่มบทบาทเข้าแอปด้วยข้อมูลสมมติ
   ของจริง: ปุ่ม Google จะเรียก Firebase Auth (signInWithPopup) แล้วอ่านบทบาทจากคอลเลกชัน staff ใน dss-pc */
(() => {
const css = document.createElement('style');
css.textContent = `
#gate{position:fixed;inset:0;z-index:100;background:var(--bg);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);overflow:auto}
#gate[hidden]{display:none}
.g-hero{background:radial-gradient(120% 90% at 20% 10%,#a02b3a 0%,#7a1f2b 45%,#4a0f19 100%);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:clamp(24px,5vw,56px);position:relative;overflow:hidden}
.g-hero::after{content:"";position:absolute;right:-140px;bottom:-140px;width:420px;height:420px;border-radius:50%;border:56px solid rgba(255,255,255,.05)}
.g-hero img{width:clamp(96px,14vw,150px);height:auto;filter:drop-shadow(0 8px 20px rgba(0,0,0,.35))}
.g-hero h1{font-size:clamp(2.6rem,6vw,4.2rem);font-weight:700;line-height:1.05;margin:20px 0 8px}
.g-hero .full{font-size:1.1rem;opacity:.9;font-weight:500}
.g-hero .school{margin-top:4px;color:#e8c777;font-weight:600}
.g-points{display:grid;gap:12px;margin-top:32px;position:relative;z-index:1}
.g-points div{display:flex;gap:12px;align-items:flex-start;font-size:.95rem;opacity:.92;line-height:1.5}
.g-points svg{width:22px;height:22px;flex:none;stroke:#e8c777;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-top:2px}
.g-form{display:flex;align-items:center;justify-content:center;padding:clamp(24px,5vw,56px)}
.g-card{width:100%;max-width:400px}
.g-card h2{font-size:1.6rem;font-weight:700;margin-bottom:6px}
.g-gbtn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:52px;border-radius:12px;border:1px solid var(--line);background:var(--surface);font-weight:600;font-size:1rem;margin-top:22px;box-shadow:var(--shadow)}
.g-gbtn:hover{border-color:var(--brand)}
.g-gbtn svg{width:22px;height:22px}
.g-or{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:.85rem;margin:22px 0 14px}
.g-or::before,.g-or::after{content:"";height:1px;background:var(--line);flex:1}
.g-roles{display:grid;gap:10px}
.g-role{display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface);min-height:60px;width:100%}
.g-role:hover{border-color:var(--brand);background:var(--brand-soft)}
.g-role b{display:block;line-height:1.3}
.g-role .s{display:block;font-size:.82rem;color:var(--muted);line-height:1.35}
.g-note{margin-top:22px;font-size:.82rem;color:var(--muted);line-height:1.6}
@media (max-width:860px){
  #gate{display:block}
  .g-hero{padding:28px 24px 26px}.g-hero h1{margin-top:0}.g-points,.g-hero .copy{display:none}.g-hero::after{display:none}
  .g-hero .top-row{display:flex;gap:16px;align-items:center}
  .g-hero img{width:72px}
  .g-form{padding:24px 20px 40px}
}
@media (min-width:861px){ .g-hero .top-row{display:block} }
`;
document.head.appendChild(css);

const gate = document.createElement('div');
gate.id = 'gate';
gate.hidden = true;
gate.innerHTML = `
  <section class="g-hero" aria-label="เกี่ยวกับระบบ">
    <div class="top-row">
      <img src="icons/school-logo.png" alt="ตราโรงเรียนปากช่อง">
      <div><h1>EMS</h1><div class="full">Education Management System</div><div class="school">โรงเรียนปากช่อง · นครราชสีมา</div></div>
    </div>
    <div class="g-points">
      <div>${ic('check')}<span>เช็กชื่อและกรอกคะแนนได้ในไม่กี่แตะ ใช้ได้ทั้งมือถือและคอม</span></div>
      <div>${ic('folder')}<span>เอกสารและไฟล์สำรองทั้งหมดเก็บไว้ที่ Google Drive ของโรงเรียน</span></div>
      <div>${ic('shield')}<span>เห็นเฉพาะเมนูตามบทบาทของตนเอง ข้อมูลนักเรียนปลอดภัย</span></div>
    </div>
    <div class="copy" style="color:rgba(255,255,255,.65);position:relative;z-index:1;margin-top:28px;font-size:.85rem">© โรงเรียนปากช่อง · งานพัฒนาและบริการระบบดิจิทัลโรงเรียน<div style="font-size:.78rem;margin-top:2px" translate="no">Digital System Development and Services in School (DSDS)</div></div>
  </section>
  <section class="g-form"><div class="g-card">
    <h2>เข้าสู่ระบบ</h2>
    <p class="muted">ใช้บัญชี Google ของโรงเรียนเพื่อเข้าใช้งาน</p>
    <button class="g-gbtn" data-act="login" data-v="teacher">
      <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.2 7-10.3 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
      เข้าสู่ระบบด้วย Google</button>
    ${LIVE ? '' : `<div class="g-or">หรือทดลองดูระบบ (ข้อมูลสมมติ)</div>
    <div class="g-roles">
      <button class="g-role" data-act="login" data-v="teacher"><span class="ico">${ic('user')}</span><span><b>ครูผู้สอน</b><span class="s">เช็กชื่อ คะแนน คำร้อง แลกคาบ</span></span></button>
      <button class="g-role" data-act="login" data-v="admin"><span class="ico gold">${ic('gear')}</span><span><b>ฝ่ายงาน / ผู้ดูแลระบบ</b><span class="s">อนุมัติ วัดผล บุคคล ผู้ใช้และสิทธิ์</span></span></button>
      <button class="g-role" data-act="login" data-v="student"><span class="ico info">${ic('school')}</span><span><b>นักเรียน</b><span class="s">ดูคะแนนและเวลาเรียนของตนเอง</span></span></button>
    </div>`}
    <p class="g-note">${LIVE ? '' : 'ขณะนี้เป็นโหมดตัวอย่าง ยังไม่เชื่อมฐานข้อมูลจริง — ปุ่ม Google จะใช้งานได้เมื่อตั้งค่า Firebase เรียบร้อย<br>'}ติดปัญหาเข้าสู่ระบบ? แจ้งงานพัฒนาและบริการระบบดิจิทัลโรงเรียน</p>
  </div></section>`;
document.body.appendChild(gate);

const authed = () => { try { return sessionStorage.getItem('ems-auth') === '1'; } catch (e) { return false; } };
const showGate = on => { gate.hidden = !on; document.body.style.overflow = on ? 'hidden' : ''; if (on) gate.scrollTop = 0; };

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act="login"],[data-act="logout"]');
  if (!t) return;
  if (t.dataset.act === 'login') {
    try { sessionStorage.setItem('ems-auth', '1'); } catch (x) {}
    S.view = t.dataset.v; save(); showGate(false); closeModal();
    page = homeOf(); render(); scrollTo(0, 0);
  } else {
    try { sessionStorage.removeItem('ems-auth'); } catch (x) {}
    closeModal(); showGate(true);
  }
});
if (!LIVE) { showGate(!authed()); if (window.EMSPreload) EMSPreload.hide(); }     // โหมดจริง: cloud.js ตัดสินจากบัญชี Google ที่เข้าสู่ระบบอยู่
})();
