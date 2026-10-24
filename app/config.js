/* EMS — Education Management System · โรงเรียนปากช่อง
   ค่าในไฟล์นี้เป็นค่าสาธารณะของเว็บ ไม่ใช่ความลับ (ความปลอดภัยจริงอยู่ที่ Firestore Rules)
   ตอนนี้ยังเป็น "โหมดตัวอย่าง" — ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ไม่เชื่อม Firebase/Drive จริง
   เปิดโหมดจริงแล้ว (2026-10-11) — ข้อมูลอยู่ใน Firestore dss-pc · ปิดกลับเป็นโหมดตัวอย่างได้ด้วย live: false */
window.EMS_CONFIG = {
  firebase: {
    projectId: 'dss-pc',
    authDomain: 'dss-pc.firebaseapp.com',
    storageBucket: 'dss-pc.firebasestorage.app',
    // ⬇ คัดลอกจาก Firebase Console → ⚙ ตั้งค่าโปรเจกต์ → ทั่วไป → แอปของคุณ (เว็บ)
    apiKey: 'AIzaSyBysiUHX0Kl-FsDjhz_R9Ce29l9eSFmaZ4',
    messagingSenderId: '147136938367',
    appId: '1:147136938367:web:520dc47476b09c96f7da4a',
    measurementId: 'G-GM5GWZ4Q81'
  },
  // เปิดเป็น true เมื่อต่อชั้นข้อมูล Firestore เสร็จและทดสอบแล้ว — ระหว่างนี้แอปยังเป็นโหมดตัวอย่าง (ข้อมูลในเครื่อง)
  live: true,
  // แอดมินตั้งต้น: เข้าสู่ระบบครั้งแรกแล้วระบบสร้างรายชื่อให้เอง (ต้องตรงกับ bootAdmin() ใน firestore.rules)
  adminEmails: ['theboydz@gmail.com', 'digital@pcschool.ac.th'],
  // OAuth Web client ID ของโปรเจกต์ (สร้างโดย Firebase สำหรับเข้าสู่ระบบด้วย Google) — เผื่อใช้กับ Google API ภายหลัง
  gcpClientId: '147136938367-8nasocds97a2qmkb9d1m3nrkjpjt9clh.apps.googleusercontent.com',
  drive: {
    // โฟลเดอร์หลักของงานทั้งหมดบน Google Drive
    rootFolderId: '1PsElgtgX6qRkJQzYr9exGhekSCAayM16',
    // OAuth Web client ID (Google Cloud → APIs & Services → Credentials) เปิด Drive API
    googleClientId: '',
    // ขอสิทธิ์เฉพาะไฟล์ที่แอปสร้าง/เปิดเอง (ไม่เห็น Drive ส่วนอื่นของผู้ใช้)
    scope: 'https://www.googleapis.com/auth/drive.file'
  },
  auth: {
    // นักเรียนเข้าสู่ระบบด้วยบัญชี Google Workspace for Education ของโรงเรียนเท่านั้น
    // ชื่อบัญชี = เลขประจำตัวนักเรียน (ตัวเลขล้วน) เช่น 12345@pcschool.ac.th
    studentDomain: 'pcschool.ac.th',
    studentPattern: '{id}'
  },
  hr: {
    // Web App URL ของสคริปต์ตัวกลางเชื่อมระบบบุคลากร (appsscript-hr-sync.gs → pcsHr)
    // ตั้งได้ที่นี่เท่านั้น (รูปแบบ https://script.google.com/macros/s/…/exec) — ไม่รับจากหน้าเว็บ
    // เปิดใช้ 2026-10-23 (ตัวกลางรุ่น 2 — relay อย่างเดียว) · ปิดฉุกเฉิน = ใส่ '' แล้วขึ้นเว็บ
    endpoint: 'https://script.google.com/macros/s/AKfycbwyR7nnsD3HOw6KZzCArcV2HMny18dStXWWzGkEI1Oyl9z24s8Sl-4uxrJIHcXRHdGEKg/exec'
  }
};
