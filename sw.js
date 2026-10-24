/*
 * service worker ของหน้าครอบ — มีไว้ให้ "ติดตั้งเป็นแอป" ได้ ไม่ได้แคชระบบ (คู่กับ /dsds/pwa.js)
 * หน้าครอบดึงจากเน็ตทุกครั้ง ของใหม่หลัง deploy ขึ้นทันทีเหมือนเดิม
 * เน็ตหลุดตอนเปิดแอป -> ขึ้นหน้า "ไม่มีอินเทอร์เน็ต" แทนหน้าไดโนเสาร์
 * ตัวระบบจริงอยู่ในกรอบ Apps Script (คนละโดเมน) service worker นี้ไม่แตะ
 */
var ICON = '/dsds/pwa/icon-192.png';
var OFFLINE = '<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>ไม่มีอินเทอร์เน็ต</title><body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
  'font-family:Sarabun,sans-serif;color:#333;text-align:center;padding:0 24px;box-sizing:border-box">' +
  '<img src="' + ICON + '" width="96" height="96" alt=""><h3 style="margin:16px 0 6px">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h3>' +
  '<p style="margin:0 0 18px;color:#666">ระบบนี้ต้องใช้อินเทอร์เน็ต ตรวจสอบสัญญาณแล้วลองใหม่</p>' +
  '<button onclick="location.reload()" style="font:inherit;padding:10px 22px;border-radius:999px;border:1px solid #ccc;background:#fff">ลองใหม่</button></body></html>';
var CACHE = 'dsds-pwa-v1';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(ICON); }).catch(function () { }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(function () {
      return new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }));
  } else if (new URL(e.request.url).pathname === ICON) {
    e.respondWith(fetch(e.request).catch(function () { return caches.match(ICON); }));
  }
});
