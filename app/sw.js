/* EMS service worker — "ดึงจากเว็บก่อนเสมอ" (network-first)
   - ออนไลน์: โหลดไฟล์ใหม่จากเว็บทุกครั้ง ครูได้เวอร์ชันล่าสุดทันที ไม่ต้องเลื่อนเลขเวอร์ชันเวลาอัปเดต
   - ออฟไลน์/เน็ตหลุด: ใช้สำเนาล่าสุดที่เคยโหลดไว้ ให้เปิดแอปได้
   - ไม่เก็บข้อมูลจาก Firebase/Google API (ข้อมูลสดต้องมาจากฐานข้อมูลเท่านั้น) */
const CACHE = 'ems-shell';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/school-logo.png', './icons/favicon-64.png'];
const NEVER = /(googleapis\.com|firebaseio\.com|firestore\.|identitytoolkit|securetoken|accounts\.google\.com|gstatic\.com\/firebasejs)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || NEVER.test(req.url)) return;            // ปล่อยให้เบราว์เซอร์จัดการตามปกติ
  const url = new URL(req.url), same = url.origin === self.location.origin;
  if (!same && !/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.host)) return;
  e.respondWith((async () => {
    try {
      /* ถามเว็บก่อนเสมอ (ไฟล์ไม่เปลี่ยนได้ 304 เร็ว) — คำขอเปิดหน้า (navigate) ใส่ตัวเลือกเพิ่มไม่ได้ จึงสร้างคำขอใหม่จาก URL */
      const res = await (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : same ? fetch(req, { cache: 'no-cache' }) : fetch(req));
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') { const home = await caches.match('./index.html'); if (home) return home; }
      throw err;
    }
  })());
});
