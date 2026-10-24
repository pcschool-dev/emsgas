/* EMS — ติดตั้งเป็นแอป (PWA) + แจ้งเวอร์ชันใหม่
   - sw.js ดึงจากเว็บก่อนเสมอ จึงไม่ต้องเลื่อนเลขเวอร์ชันเวลาอัปเดต
   - เครื่องที่เปิดแอปค้างไว้ทั้งวัน (แท็บเล็ตห้องเรียน) ตรวจทุก 10 นาที และทุกครั้งที่กลับมาที่แอป
     ว่าไฟล์บนเว็บเปลี่ยนหรือยัง (ดูแค่ส่วนหัว ETag/Last-Modified ของไฟล์ ไม่โหลดทั้งไฟล์) ถ้าเปลี่ยนขึ้นแถบ “มีเวอร์ชันใหม่”
   - ปุ่มติดตั้ง: Android/คอม ใช้หน้าต่างติดตั้งของเบราว์เซอร์ · iPhone/iPad บอกวิธี “เพิ่มไปยังหน้าจอโฮม” */
(() => {
const web = /^https?:$/.test(location.protocol);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (web && 'serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* ---------- ติดตั้ง ---------- */
let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; document.dispatchEvent(new Event('ems-install')); if (window.render) render(); });
window.addEventListener('appinstalled', () => { deferred = null; toast('ติดตั้ง EMS แล้ว — เปิดได้จากไอคอนบนหน้าจอ'); });
const iosHelp = () => modal(`<h2 style="margin-bottom:8px">ติดตั้ง EMS บน iPhone / iPad</h2>
  <ol style="margin:0 0 12px 20px;line-height:2">
    <li>เปิดหน้านี้ด้วย <b>Safari</b> (ถ้าเปิดจาก LINE ให้แตะ ⋯ แล้วเลือก “เปิดใน Safari”)</li>
    <li>แตะปุ่ม <b>แชร์</b> <span style="display:inline-block;border:1px solid var(--line);border-radius:6px;padding:0 6px">⬆︎</span> ที่แถบด้านล่าง</li>
    <li>เลื่อนลงแล้วเลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b> แล้วแตะ <b>เพิ่ม</b></li></ol>
  <p class="muted small">เปิดจากไอคอน EMS บนหน้าจอโฮม จะได้หน้าจอเต็มแบบแอป ไม่มีแถบเบราว์เซอร์ และอัปเดตเองทุกครั้งที่ออนไลน์</p>
  <button class="btn pri" style="width:100%;margin-top:8px" data-act="close">เข้าใจแล้ว</button>`, true);
window.EMSInstall = {
  can: () => web && !standalone() && (!!deferred || ios),
  installed: standalone,
  async prompt() {
    if (deferred) { deferred.prompt(); const r = await deferred.userChoice.catch(() => ({})); if (r.outcome === 'accepted') deferred = null; return; }
    if (ios) return iosHelp();
    toast('ใช้เมนูของเบราว์เซอร์ › “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”');
  }
};
document.addEventListener('click', e => { if (e.target.closest('[data-pwa="install"]')) { e.preventDefault(); EMSInstall.prompt(); } });

/* ---------- แจ้งเวอร์ชันใหม่ ---------- */
const files = () => [location.pathname].concat([...document.scripts].map(s => s.src).filter(u => u && u.indexOf(location.origin) === 0).map(u => new URL(u).pathname));
const stamp = async u => { try { const r = await fetch(u, { method: 'HEAD', cache: 'no-store' }); return r.ok ? (r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || '') : ''; } catch (e) { return ''; } };
let base = null, shown = false, busy = false;
async function check() {
  if (!web || shown || busy || !navigator.onLine) return; busy = true;
  try {
    const list = files(), now = {}; await Promise.all(list.map(async u => { now[u] = await stamp(u); }));
    if (!base) { base = now; return; }
    if (list.some(u => now[u] && base[u] && now[u] !== base[u])) { shown = true; banner(); }
  } finally { busy = false; }
}
function banner() {
  const b = document.createElement('div'); b.className = 'upd-bar'; b.setAttribute('role', 'status');
  b.innerHTML = `<span>มี EMS เวอร์ชันใหม่</span><button class="btn sm pri" data-upd="go">โหลดใหม่</button><button class="btn sm ghost" data-upd="x" aria-label="ปิด">ภายหลัง</button>`;
  document.body.appendChild(b);
  b.addEventListener('click', e => { const t = e.target.closest('[data-upd]'); if (!t) return; if (t.dataset.upd === 'go') location.reload(); else b.remove(); });
}
if (web) {
  setTimeout(check, 1500);                                   // จดสภาพไฟล์ตอนเปิดแอป
  setInterval(check, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', check);
}

const st = document.createElement('style');
st.textContent = `
.upd-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:140;display:flex;gap:10px;align-items:center;background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:14px;padding:8px 8px 8px 16px;box-shadow:0 12px 32px rgba(0,0,0,.2);font-weight:600;max-width:calc(100vw - 24px)}
@media (max-width:860px){.upd-bar{bottom:86px}}
.sheet-bg{z-index:110}.toast{z-index:150}
`;
document.head.appendChild(st);
window.EMSUpdate = { check };
})();
