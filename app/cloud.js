/* EMS — เชื่อม Firebase (dss-pc): เข้าสู่ระบบ Google + ซิงก์ข้อมูลกับ Firestore
   ทำงานเฉพาะเมื่อ LIVE (config.js live: true) — โหมดตัวอย่างไม่โหลดอะไรเลย
   หลักการ: โมดูลเดิมแก้ S แล้วเรียก save() เหมือนเดิม → ไฟล์นี้เทียบกับสิ่งที่ได้จาก Firestore ล่าสุด แล้วเขียนเฉพาะส่วนที่เปลี่ยน
   กติกาความปลอดภัยของข้อมูล:
   1) Firestore เป็นตัวจริง — ข้อมูลตั้งต้น/ตัวอย่างที่โมดูลเติมตอนโหลดถูกทับทั้งหมดเมื่อได้ข้อมูลรอบแรก
   2) ไม่เขียนส่วนใดจนกว่าส่วนนั้นจะได้ข้อมูลรอบแรกแล้ว (กันค่าว่าง/ค่าเริ่มต้นทับข้อมูลจริง)
   3) เขียนเฉพาะส่วนที่บทบาทของผู้ใช้มีสิทธิ์ (ตรงกับ firestore.rules) ส่วนอื่นอ่านอย่างเดียว
   ค่าในเอกสารเก็บเป็น JSON ในฟิลด์ j (Firestore ไม่รับ undefined / อาร์เรย์ซ้อนอาร์เรย์) และมีฟิลด์ประกอบไว้ให้ rules/การค้นหาใช้ */
(() => {
  if (!LIVE) return;
  const C = window.EMS_CONFIG || {};
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const low = v => String(v || '').trim().toLowerCase();
  const J = v => JSON.stringify(v === undefined ? null : v);
  const P_ = v => { try { return JSON.parse(v); } catch (e) { return null; } };
  const ADMIN_ROLES = ['admin', 'exec', 'academic', 'measure', 'personnel', 'general', 'affairs'];
  const viewT = () => (S.viewTerm && S.viewTerm.year ? S.viewTerm : S.term) || {};
  const termKey = () => (viewT().year ? viewT().year + '-' + (viewT().sem || '1') : 'na');
  /* กำลังดูภาคของปีการศึกษาก่อนหน้า (หลังขึ้นปีใหม่) → รายชื่อมาจาก rosterArchive ของปีนั้น ไม่ใช่ rooms ปัจจุบัน */
  const pastYear = () => { const v = viewT(), c = S.term || {}; return v.year && c.year && +v.year < +c.year ? String(v.year) : ''; };
  const viewLocked = () => !!(window.EMSAdmin && EMSAdmin.lockedNow && EMSAdmin.lockedNow());
  const roles = () => (S.me && S.me.roles) || [];
  const has = (...r) => roles().some(x => r.indexOf(x) >= 0);
  const isBoot = () => (C.adminEmails || []).map(low).indexOf(low(S.me && S.me.email)) >= 0;
  const admin = () => isBoot() || has('admin');
  const office = () => admin() || has(...ADMIN_ROLES, 'head');
  const me = () => low(S.me && S.me.email);
  const get = path => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S);
  const put = (path, v) => { const ks = path.split('.'), last = ks.pop(); let o = S; ks.forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[last] = v; };

  let fb = null, db = null, user = null, flushT = null, started = false, wfail = false;      // wfail = เขียนล่าสุดไม่สำเร็จ (ไม่ใช่เพราะไม่มีสิทธิ์) รอลองใหม่
  const status = { state: 'idle', err: '', pending: 0, at: '' };

  /* ================= ส่วนที่ซิงก์ ================= */
  /* doc   = เอกสารเดียวเก็บหลายคีย์ของ S
     items = อาร์เรย์ของวัตถุที่มี id → หนึ่งเอกสารต่อรายการ (หลายคนเขียนพร้อมกันได้ไม่ทับกัน)
     keys  = วัตถุ { คีย์: ค่า } → หนึ่งเอกสารต่อคีย์ (ฟังทั้งคอลเลกชันหรือเฉพาะที่ค้นหา)
     group = วัตถุ { คีย์: ค่า } รวมหลายคีย์ไว้ในเอกสารเดียวตามกลุ่ม เขียนแบบ merge ทีละฟิลด์ (เช็กชื่อ) */
  /* ---------- ขอบเขตการอ่าน: ข้อมูลที่ใช้เฉพาะบางหน้า ฟังเมื่อเปิดหน้านั้น และฟังเท่าที่หน้านั้นใช้ ----------
     (โควต้าฟรี Firestore นับต่อเอกสารที่ส่งมา — ฟังทั้งคอลเลกชันตอนเปิดแอป × ครูทั้งโรงเรียน = เกินโควต้าได้) */
  const affPage = () => page === 'affairs' || page === 'a-affairs';
  const attSess = () => { if (page !== 'attendance') return null; const p = String((S.aui || {}).sess || '').split('|'); if (!p[0] || !p[1]) return null;
    const c = (S.classes || []).find(x => x.id === p[0]); return c ? { c, date: p[1], hr: p[2] === 'hr' } : null; };
  /* พฤติกรรม: หน้ากิจการ = ทั้งหมด (คิดคะแนนสะสม) · หน้าเช็กชื่อ = เฉพาะห้อง+วันของคาบที่เปิด (หักคะแนนมาสาย/กันหักซ้ำ)
     ออกจากหน้าแล้วฟังขอบเขตเดิมต่อ (ไม่เลิกฟัง → รายการที่ยังไม่ได้ส่งขึ้นไม่หาย) · เคยฟังทั้งหมดแล้ว = ทั้งหมดต่อทั้ง session (ครอบขอบเขตแคบอยู่แล้ว ไม่อ่านซ้ำ) */
  let condQ = '';
  /* ครูทั่วไปในหน้ากิจการเห็นเฉพาะนักเรียนห้องของตัวเอง (conduct() คิดจาก S.classes) → 'c:' + ชื่อห้อง (≤ 30 · เกิน เช่น ฝ่ายบริหารดูทุกห้อง = ทั้งหมด) · ฟังห้องตัวเองอยู่แล้วและคาบที่เปิดอยู่ในชุดนั้น = ใช้ต่อ ไม่อ่านซ้ำ */
  const myCls = () => { const n = [...new Set((S.classes || []).map(c => c.name).filter(Boolean))].sort(); return n.length > 30 ? 'all' : 'c:' + J(n.length ? n : ['-']); };
  const condQk = () => { if (condQ === 'all') return condQ; if (affPage()) condQ = admin() || has('affairs') ? 'all' : myCls();
    else { const x = attSess(); if (x && !(condQ.indexOf('c:') === 0 && (P_(condQ.slice(2)) || []).indexOf(x.c.name) >= 0)) condQ = x.date + '|' + x.c.name; } return condQ; };
  const isHr = () => Object.values(S.homeroom || {}).some(t => [].concat(t || []).indexOf(S.me && S.me.name) >= 0);
  /* เข้าประตู: ครูที่ปรึกษาเปิดคาบเข้าแถว = เฉพาะนักเรียนห้องนั้นวันนั้น (เอกสาร {วันที่}_{เลขประจำตัว} ชุดละ ≤ 30) */
  const gateIds = () => { const x = attSess(); return x && x.hr ? [...new Set(x.c.students.map(st => x.date + '_' + String(st.sid || st.id)))] : []; };
  /* ฟังทั้งโรงเรียนของวันนี้อยู่แล้ว (gateDay ฟังต่อหลังออกจากหน้ากิจการ) + คาบเข้าแถวเป็นวันนี้ → ไม่ต้องฟังรายห้องซ้ำ */
  const gateDayOn = () => { const g = SL.find(x => x.id === 'gateDay'), x = attSess(); return !!(g && g.__u && ready.gateDay && g.__qk === todayISO() && x && x.date === todayISO()); };
  const mergeGate = () => { S.gateEvents = Object.assign({}, get('gateEv.h0') || {}, get('gateEv.h1') || {}, get('gateEv.h2') || {}, get('gateEv.day') || {}); };      // วันนี้ทั้งโรงเรียนทับท้าย (รายห้องที่เลิกฟังแล้วอาจค้างค่าเก่า)
  const SL = [
    { id: 'school', mode: 'doc', ref: () => db.collection('school').doc('config'), boot: true,
      keys: ['settings', 'term', 'terms', 'periods', 'events', 'dayShifts', 'homeroom', 'coverDelegates', 'rooms', 'gen', 'hrCfg', 'acadTasks', 'loadTerm'], drop: ['examEntry'],
      can: office },
    /* สถานะปลดล็อกกรอกกำหนดการสอบ (examplan.js) แยกจาก config — config เขียนทั้งก้อน ใครแก้ค่าอื่นจะทับสถานะนี้ · เขียนได้เฉพาะแอดมิน/วัดผล */
    { id: 'exam', mode: 'doc', ref: () => db.collection('school').doc('exam'), boot: true, keys: ['examEntry'], can: () => admin() || has('measure') },
    { id: 'pub', mode: 'doc', ref: () => db.collection('school').doc('public'), boot: true, keys: ['settings.studentLogin', 'settings.resultsAnnounced', 'term'], can: office },
    { id: 'published', mode: 'keys', coll: 'published', path: 'published', lockable: true, perKey: () => S.classes.filter(c => c.subject).map(c => c.id),
      docId: k => termKey() + '_' + k + '_' + codeOf(k), fields: k => ({ room: k, code: codeOf(k), term: termKey() }), can: () => true },
    { id: 'affairsCfg', mode: 'doc', ref: () => db.collection('school').doc('affairs'), boot: true, keys: ['affairs.cfg'], can: () => admin() || has('affairs') },
    { id: 'tt', mode: 'doc', ref: () => db.collection('school').doc('timetable_' + termKey()), boot: true, keys: ['__ttAll', 'ttDuties'], can: () => admin() || has('academic'),
      after: () => deriveTT(), before: () => encodeTT() },
    { id: 'staff', mode: 'items', coll: 'staff', path: 'staff', boot: true, plain: true, idOf: u => low(u.email) || 'noemail_' + hash(u.name), can: () => admin() || has('personnel') },
    /* รายชื่อนักเรียนรายห้อง: ฝ่ายงาน/หัวหน้า (office) = ทุกห้อง · ครู = เฉพาะห้องที่สอน/ปรึกษา + ห้องหลักของห้องย่อย (ประหยัดการอ่าน)
       ครูเปิดหน้าบันทึกพฤติกรรม (เลือกนักเรียนได้ทั้งโรงเรียน) = ทุกห้องชั่วคราว · ผู้เขียน (admin/academic) อยู่ในกลุ่ม office จึงได้ครบเสมอ */
    /* รอ school + ตารางสอนของภาคที่ใช้ก่อน (ข้อมูลตัวอย่างตอนบูต = ห้องผิด ฟังซ้ำหลายรอบ) · changed() เรียก lazyCheck ให้เมื่อพร้อม */
    { id: 'roster', mode: 'keys', coll: 'rooms', path: '__roster', boot: true, lazy: () => !!(ready.school && ready.tt && SL.find(x => x.id === 'tt').__tk === termKey()), qk: () => J(rosterScope()),
      query: c => { const x = rosterScope(); return x === 'all' ? c : x.length ? c.where(firebase.firestore.FieldPath.documentId(), 'in', x.map(fkeyId)) : null; },
      can: () => admin() || has('academic') },
    { id: 'me', mode: 'doc', ref: () => db.collection('users').doc(me()), boot: true, keys: ['prefs', 'personal', 'profile', 'userSheets', 'bookMeta', 'notiSeen'], can: () => true },
    /* นักเรียนลาออก/จำหน่าย (stuleft.js): ฟังเฉพาะตอนเปิดหน้าฐานนักเรียน · แอดมิน/วิชาการเขียน ห้ามลบ */
    /* noDelete = rules ห้ามลบ → ไม่สั่งลบเอกสารที่หายจากในเครื่อง (คำสั่งลบที่ถูกปฏิเสธทำให้ทั้งชุดบันทึกล้มและวนลองใหม่) */
    { id: 'stuLeft', mode: 'items', coll: 'stuLeft', path: 'stuLeft', noDelete: true, lazy: () => (page === 'a-students' || page === 'a-settings') && (admin() || has('academic')), can: () => admin() || has('academic') },
    /* รายชื่อปีการศึกษาเก่า (newyear.js): {ปี}_{ห้อง} เก็บตอนขึ้นปีใหม่ · ฟังเฉพาะหน้าขึ้นปีใหม่ · ห้ามลบ */
    { id: 'rosterArchive', mode: 'keys', coll: 'rosterArchive', path: 'rosterArchive', noDelete: true, lazy: () => (page === 'a-newyear' && (admin() || has('academic'))) || !!pastYear(),
      qk: () => page === 'a-newyear' ? 'all' : (pastYear() || 'all'), query: c => page !== 'a-newyear' && pastYear() ? c.where('year', '==', pastYear()) : c,
      fields: (k, v) => ({ year: String((v && v.year) || '') }), can: () => admin() || has('academic') },
    /* กำหนดการสอบ (examplan.js): หนึ่งเอกสารต่อ ภาค_รอบ_รหัสวิชา · ฟังเฉพาะตอนอยู่หน้ากรอก/ตรวจ (unlazy = ออกจากหน้าแล้วเลิกฟัง) · แก้ทับได้ ไม่ลบผ่านการซิงก์
       ขอบเขต (EMSExamPlan.scope): ครู = เอกสารของวิชาตัวเองตาม id (≤ 30) · หัวหน้าในหน้าตรวจ = กลุ่มสาระที่เลือก · วัดผล/แอดมิน = ทั้งภาค (และเติมฟิลด์ code/area ให้เอกสารเก่า)
       ลบรายการ: แอดมิน/วัดผลลบตรงที่หน้าตรวจ (examplan.js) */
    { id: 'examPlans', mode: 'items', coll: 'examPlans', path: 'examPlans', noDelete: true, keepLocal: true, unlazy: true, lazy: () => page === 'exam-plan' || page === 'exam-check',
      qk: () => J(epScope()), query: c => { const x = epScope(); if (x.none) return null; if (x.ids) return x.ids.length ? c.where(firebase.firestore.FieldPath.documentId(), 'in', x.ids) : null;
        c = c.where('term', '==', x.term); return x.area ? c.where('area', '==', x.area) : c; },
      fields: v => ({ term: String(v.term || ''), round: String(v.round || ''), code: String(v.code || ''), area: String(v.area || '') }), backfill: () => admin() || has('measure'), can: () => true },
    /* นัดประชุม (meetings.js): นัดย้อนหลัง 60 วันขึ้นไป (ทุกคนต้องรู้ว่าตัวเองถูกเชิญ → แจ้งเตือน) · ผู้นัดเขียน · ไม่ลบ ยกเลิก = status */
    { id: 'meetings', mode: 'items', coll: 'meetings', path: 'meetings', noDelete: true, keepLocal: true, query: c => c.where('date', '>=', shift(todayISO(), -60)),
      fields: v => ({ date: String(v.date || ''), status: String(v.status || '') }), can: () => true },
    /* คำตอบรับของฉัน (เข้าร่วม/ขอลา) · คำตอบทั้งหมดของนัดที่ผู้นัดเปิดดู (อ่านอย่างเดียว ฟังเฉพาะตอนเปิด) */
    { id: 'mtRsvpMine', mode: 'items', coll: 'meetingRsvp', path: 'mtRsvpMine', noDelete: true, keepLocal: true, query: c => c.where('who', '==', me()),
      fields: v => ({ mid: String(v.mid || ''), date: String(v.date || ''), who: String(v.who || '') }), can: () => true },
    { id: 'mtRsvpOf', mode: 'items', coll: 'meetingRsvp', path: 'mtRsvpOf', noDelete: true, unlazy: true, lazy: () => page === 'meetings' && !!(window.EMSMeetings && EMSMeetings.ui.open && EMSMeetings.canSeeOpen()),
      qk: () => (window.EMSMeetings && EMSMeetings.ui.open) || '', query: c => c.where('mid', '==', (window.EMSMeetings && EMSMeetings.ui.open) || '-'), can: () => false },
    { id: 'roomPlans', mode: 'keys', coll: 'roomPlans', path: 'roomPlans', noDelete: true, boot: true, can: () => true },      /* แผนการเรียนรายคน: ห้องหลัก → { เลขประจำตัว: แผน } */
    /* หลักสูตร (curriculum.js): subjects + แผนรายรุ่นปีที่เข้า · ฟังเฉพาะหน้าที่ใช้ (หน้าหลักสูตร = ทุกเอกสาร, หน้าเสนอภาระงาน = รายวิชา + 3 รุ่นของปีนี้) · ไม่ลบเอกสาร */
    { id: 'cur', mode: 'keys', coll: 'curriculum', path: 'curDocs', noDelete: true, unlazy: true, lazy: () => !!(window.EMSCur && EMSCur.need()),
      qk: () => J(window.EMSCur ? EMSCur.ids() : ''), query: c => { const x = window.EMSCur ? EMSCur.ids() : []; return x === 'all' ? c : x.length ? c.where(firebase.firestore.FieldPath.documentId(), 'in', x) : null; },
      can: () => admin() || has('academic') },
    /* ข้อมูลบุคลากร (staffinfo.js): ฝ่ายบุคคล/แอดมินอ่าน staffInfo ของทุกคน เฉพาะตอนเปิดหน้าข้อมูลบุคลากร (อ่านอย่างเดียว)
       ส่วนสำเนาของตัวเองเขียนแยกจากชุดบันทึกใหญ่ด้วย siSync() — ถ้าถูกปฏิเสธจะไม่พาการบันทึกอื่นล้มไปด้วย */
    /* แจ้งวิชาการเมื่อรหัส/ชื่อวิชาในตารางสอนไม่ตรง (ttsummary.js) — ฟังเฉพาะภาคปัจจุบัน · ไม่ลบ (ปิดเรื่อง = status done) */
    { id: 'ttFlags', mode: 'items', coll: 'ttFlags', path: 'ttFlags', noDelete: true, keepLocal: true, lazy: () => !!me() && !has('student'), qk: () => termKey(),
      query: c => c.where('term', '==', termKey()), fields: v => ({ term: String(v.term || '') }), can: () => true },
    { id: 'siAll', mode: 'keys', coll: 'staffInfo', path: 'siAll', noDelete: true, unlazy: true, quietErr: true, lazy: () => page === 'a-staffinfo' && (admin() || has('personnel')), can: () => false },
    { id: 'leaves', mode: 'items', coll: 'leaves', path: 'leaves', can: () => true },
    { id: 'xreqs', mode: 'items', coll: 'xreqs', path: 'xreqs', can: () => true },
    { id: 'specials', mode: 'items', coll: 'specials', path: 'specials', can: () => true },
    { id: 'acts', mode: 'items', coll: 'acts', path: 'acts', can: () => true },
    { id: 'examReqs', mode: 'items', coll: 'examReqs', path: 'examReqs', can: () => true },
    { id: 'repairs', mode: 'items', coll: 'repairs', path: 'repairs', can: () => true },
    { id: 'venues', mode: 'items', coll: 'venueReqs', path: 'venues', can: () => true },
    { id: 'courseSub', mode: 'items', coll: 'courseSubs', path: 'courseSub', can: () => true },
    /* เสนอภาระงานสอน (loadprop.js): ค้นเฉพาะภาคที่เปิดเสนอ (+ กลุ่มสาระของตัวเองถ้าไม่ใช่ฝ่ายรับเรื่อง) · lazy = เริ่มฟังเมื่อเปิดหน้าครั้งแรก
       qk เปลี่ยน (แอดมินเปลี่ยนภาค) → ฟังใหม่ · keepLocal = snapshot ของคนอื่นไม่ทับรายการที่ยังไม่ได้ส่งขึ้นจากเครื่องนี้ */
    { id: 'loadProps', mode: 'items', coll: 'loadProps', path: 'loadProps', keepLocal: true, lazy: () => page === 'loadprop' || page === 'a-loadprop',
      qk: () => J(lpScope()), query: c => { const x = lpScope(); c = c.where('term', '==', x.term); return x.area ? c.where('area', '==', x.area) : c; },
      fields: v => ({ term: String(v.term || ''), area: String(v.area || ''), kind: String(v.kind || '') }), can: () => true },
    /* fields = ฟิลด์ธรรมดาเพิ่มข้าง j ให้นักเรียนค้นเฉพาะของตัวเองได้ (rules: resource.data.sid) · backfill = เติมให้เอกสารเก่า (ฝ่ายกิจการฯ/แอดมินทำ) */
    /* date/cls = ฟิลด์ค้นเฉพาะห้อง+วัน (เอกสารเก่าเติมให้ตอนกิจการฯ/แอดมินเปิดหน้ากิจการ — backfill) · keepAcross = ฟังขอบเขตใหม่แล้วรายการที่ยังไม่ได้ส่งขึ้นไม่หาย */
    { id: 'conduct', mode: 'items', coll: 'conduct', path: 'affairs.records', noDelete: true, keepLocal: true, keepAcross: true, lazy: () => !!condQk(), qk: condQk,
      query: c => { const q = condQk(); if (q === 'all') return c; if (q.indexOf('c:') === 0) return c.where('cls', 'in', P_(q.slice(2)) || ['-']); const i = q.indexOf('|'); return c.where('date', '==', q.slice(0, i)).where('cls', '==', q.slice(i + 1)); },
      fields: v => ({ sid: String(v.sid || ''), date: String(v.date || ''), cls: String(v.className || '') }), backfill: () => condQk() === 'all' && (admin() || has('affairs')), can: () => true },
    { id: 'vol', mode: 'items', coll: 'volunteer', path: 'affairs.vol', lazy: affPage, fields: v => ({ sid: String(v.sid || ''), st: String(v.st || 'ok') }), can: () => true },
    { id: 'examImports', mode: 'items', coll: 'examImports', path: 'examImports', can: () => admin() || has('measure') },
    { id: 'contact', mode: 'items', coll: 'contactReqs', path: 'contactReqs', can: () => admin(), when: () => admin() },
    { id: 'scanDevices', mode: 'items', coll: 'scanDevices', path: 'scanDevices', idOf: v => v.id, can: () => false },
    { id: 'dpaSlots', mode: 'keys', coll: 'dpaSlots', path: 'dpa.slots', query: c => c.where('date', '>=', todayISO()), fields: (k, v) => ({ date: v.date || '' }), can: () => true },
    { id: 'dpaCfg', mode: 'doc', ref: () => db.collection('school').doc('dpa'), keys: ['dpa.cfg'], can: admin },
    /* เข้าประตู (scan.js): หน้ากิจการ (กิจการฯ/แอดมิน) = วันนี้ทั้งโรงเรียน ฟังแล้วฟังต่อ (เข้าหน้าซ้ำไม่อ่านทั้งวันใหม่ · ข้ามวัน qk เปลี่ยน → ฟังใหม่) · คาบเข้าแถว = นักเรียนห้องนั้น ออกจากหน้าแล้วเลิกฟัง */
    { id: 'gateDay', mode: 'keys', coll: 'gateEvents', path: 'gateEv.day', plain: true, keepAt: true, lazy: () => affPage() && (admin() || has('affairs')),
      qk: () => todayISO(), query: c => c.where('date', '==', todayISO()), after: mergeGate, can: () => false },
    ...[0, 1, 2].map(i => ({ id: 'gateHr' + i, mode: 'keys', coll: 'gateEvents', path: 'gateEv.h' + i, plain: true, keepAt: true, unlazy: true, lazy: () => gateIds().length > i * 30 && !gateDayOn(),
      qk: () => J(gateIds().slice(i * 30, i * 30 + 30)), query: c => { const x = gateIds().slice(i * 30, i * 30 + 30); return x.length ? c.where(firebase.firestore.FieldPath.documentId(), 'in', x) : null; },
      after: mergeGate, can: () => false })),
    /* ลงเวลาทำงาน (stafftime.js): เขียนตรงด้วย EMSStaffTime (ไม่ผ่าน dirty/flush) · ที่นี่แค่ฟัง
       quietErr = ฟังไม่ได้ (เช่น ยังไม่วางกฎ) แค่เตือนในคอนโซล ไม่ขึ้นสถานะแดง
       ของฉัน = เดือนที่ดูอยู่ (email + mon เท่ากับทั้งคู่ ไม่ต้องสร้างดัชนีผสม) · รายวัน = ฝ่ายบุคคล/ผู้บริหาร/แอดมิน ฟังวันเดียว (วันนี้ หรือวันที่เลือกในหน้าฝ่ายบุคคล) */
    { id: 'staffMine', mode: 'keys', coll: 'staffEvents', path: 'staffEv.mine', plain: true, keepAt: true, quietErr: true, lazy: () => !!me() && !has('student'),
      qk: () => me() + '|' + stMon(), query: c => c.where('email', '==', me()).where('mon', '==', stMon()), can: () => false },
    { id: 'staffDay', mode: 'keys', coll: 'staffEvents', path: 'staffEv.day', plain: true, keepAt: true, quietErr: true, lazy: () => admin() || has('personnel', 'exec'),
      qk: () => stDay(), query: c => c.where('date', '==', stDay()), can: () => false },
    { id: 'books', mode: 'keys', coll: 'books', path: 'books', lockable: true, perKey: () => S.classes.filter(c => c.subject).map(c => c.id),      /* เฉพาะห้องที่สอนจริง (มีวิชาจากตารางสอน) */ docId: k => termKey() + '_' + k + '_' + codeOf(k),
      fields: k => ({ room: k, code: codeOf(k), term: termKey() }), can: () => true },
    /* เช็กชื่อ: ค้นตามห้อง (ได้ทุกภาค) → tkBound = รับเฉพาะเอกสาร {ภาคที่ฟัง}_… และไม่เขียนถ้าภาคที่ดูเปลี่ยนแล้วแต่ยังไม่ได้ฟังใหม่ (กันคัดลอกข้ามภาค) */
    { id: 'att', mode: 'group', coll: 'att', path: 'att', lockable: true, tkBound: true, groupOf: k => { const [c, d] = k.split('|'); return termKey() + '_' + c + '_' + String(d).slice(0, 7); },
      query: c => { const ids = attRooms(); return ids.length ? c.where('room', 'in', ids) : null; },
      fields: k => { const [c, d] = k.split('|'); return { room: c, month: String(d).slice(0, 7), term: termKey() }; }, after: () => { S.attSaved = {}; Object.keys(S.att || {}).forEach(k => { if (!(S.att[k] || {})._draft) S.attSaved[k] = true; }); }, can: () => true },      // _draft = ติ๊กแล้ว (ส่งขึ้นกันหาย) แต่ยังไม่ได้กดบันทึก
    /* ยอดแถวเช้า: ใช้ที่หน้ากิจการ และครูที่ปรึกษาตอนบันทึกคาบเข้าแถว (ครูที่ไม่ได้เป็นที่ปรึกษาไม่ต้องอ่าน) · ฟังแล้วฟังต่อ */
    { id: 'hrDaily', mode: 'group', coll: 'hrDaily', path: 'affairs.daily', two: true, groupOf: k => k.split('|')[0], lazy: () => affPage() || (page === 'attendance' && isHr()),
      query: c => c.where('date', '>=', shift(todayISO(), -60)), fields: k => ({ date: k.split('|')[0] }), can: () => true }
  ];
  let rosterAll = false;      // เคยต้องใช้ทุกห้องแล้ว = ฟังทุกห้องต่อทั้ง session (เข้า/ออกหน้า affairs ไม่ฟังใหม่ = ไม่อ่านรายชื่อทั้งโรงเรียนซ้ำ)
  function rosterScope() {
    if (office() || page === 'affairs') rosterAll = true;
    if (rosterAll) return 'all';
    const ids = new Set(), hr = S.homeroom || {};
    (Array.isArray(S.__ttAll) ? S.__ttAll : []).forEach(e => { if (e && e.teacher === S.me.name && e.classId) ids.add(e.classId); });
    Object.keys(hr).forEach(k => { if ([].concat(hr[k] || []).indexOf(S.me.name) >= 0) ids.add(k); });
    [...ids].forEach(id => { const r = (S.rooms || []).find(x => x.id === id); if (r && r.parent) ids.add(r.parent); });      // ห้องย่อยตามแผน = รายชื่อมาจากห้องหลัก
    const arr = [...ids].sort(); return arr.length > 30 ? 'all' : arr;      // where in รับได้ 30 ค่า
  }
  const stMon = () => (window.EMSStaffTime ? EMSStaffTime.mon() : todayISO().slice(0, 7));
  const stDay = () => (window.EMSStaffTime ? EMSStaffTime.day() : todayISO());
  const lpScope = () => (window.EMSLoadProp && EMSLoadProp.scope ? EMSLoadProp.scope() : { term: '2569-2', area: '' });
  const epScope = () => (window.EMSExamPlan && EMSExamPlan.scope ? EMSExamPlan.scope() : { term: S.term ? S.term.year + '-' + S.term.sem : 'na' });
  const shift = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h.toString(36); }
  const codeOf = cid => { const c = cls(cid); return String((c && c.subject) || 'x').split(/\s+/)[0].replace(/[\/.#\[\]]/g, '_') || 'x'; };

  /* ---------- ตารางสอนทั้งโรงเรียน: เก็บรายการดิบ แล้วแตกเป็น S.tt (ของฉัน) + S.ttOthers ---------- */
  let ttDerived = '';
  function deriveTT() {
    const all = Array.isArray(S.__ttAll) ? S.__ttAll : [];
    S.tt = {}; S.ttOthers = []; S.ttCover = {}; S.ttLoc = {}; S.ttSub = {};   // ttCover: คาบของฉันที่รับไว้แทนตำแหน่งว่าง (สีส้ม) · ttLoc: สถานที่/ห้องสอนของคาบฉัน (จากแอปจัดตาราง) · ttSub: รหัส+ชื่อวิชาของคาบฉัน (ห้องเดียวกันสอนได้หลายวิชา)
    all.forEach(e => { if (e.teacher === S.me.name && !S.tt[e.day + '-' + e.p]) { S.tt[e.day + '-' + e.p] = e.classId; if (e.coverFor) S.ttCover[e.day + '-' + e.p] = e.coverFor; if (e.room) S.ttLoc[e.day + '-' + e.p] = e.room; if (e.subject) S.ttSub[e.day + '-' + e.p] = e.subject; } else S.ttOthers.push(e); });
    ttDerived = J([S.tt, S.ttOthers, S.ttCover, S.ttLoc, S.ttSub]);
  }
  function encodeTT() {
    if (J([S.tt, S.ttOthers, S.ttCover || {}, S.ttLoc || {}, S.ttSub || {}]) === ttDerived) return;                 // ไม่มีใครแก้ตารางในเครื่องนี้
    const raw = Array.isArray(S.__ttAll) ? S.__ttAll : [], mineRaw = raw.filter(e => e.teacher === S.me.name);
    const mine = Object.entries(S.tt || {}).map(([k, cid]) => { const [d, p] = k.split('-').map(Number);
      const o = mineRaw.find(e => e.day === d && e.p === p && e.classId === cid) || { id: 'e' + hash(S.me.name + k + cid), teacher: S.me.name, classId: cid, subject: (cls(cid) || {}).subject || '', day: d, p };
      const cv = (S.ttCover || {})[k], lo = (S.ttLoc || {})[k], b = Object.assign({}, o); delete b.coverFor; delete b.room; if (cv) b.coverFor = cv; if (lo) b.room = lo; b.subject = (S.ttSub || {})[k] || b.subject || (cls(cid) || {}).subject || ''; return b; });      // วิชาของคาบ: S.ttSub ก่อน (ไม่ใช้วิชาของห้องแทนทั้งหมด)   // coverFor/room มาจาก S.ttCover/S.ttLoc เท่านั้น
    S.__ttAll = (S.ttOthers || []).concat(mine);
  }
  /* สถานะปลดล็อกกำหนดการสอบรุ่นแรกเก็บใน school/config → ถ้ายังไม่มี school/exam ใช้ค่านั้นเป็นค่าเริ่ม
     แอดมิน/วัดผล = ย้ายเขียนลง school/exam ให้ · คนอื่น = ถือเป็นค่าจากระบบ (ไม่นับเป็นการแก้ ไม่คืนค่า/ไม่เตือนสิทธิ์) */
  let exLegacy = '';
  function examLegacy() {
    const ex = SL.find(s => s.id === 'exam'), sc = SL.find(s => s.id === 'school'); if (!ready.exam || !ready.school) return;
    if ((P_(L(ex).doc) || {}).examEntry != null) return;
    const old = (sc.__drop || {}).examEntry; if (!old || typeof old !== 'object' || J(old) === exLegacy) return;      // ใช้ครั้งเดียวต่อค่า (ไม่ทับที่วัดผลเพิ่งกดในเครื่อง)
    exLegacy = J(old); S.examEntry = old; if (ex.can()) dirty(); else L(ex).doc = J(snapshotDoc(ex));
  }
  /* ---------- ห้องเรียนของฉัน: จากตารางสอน + ห้องที่ปรึกษา (ฝ่ายบริหาร/วิชาการเห็นทุกห้อง) ---------- */
  function deriveClasses() {
    const py = pastYear(); let roster = S.__roster || {}, hrMap = S.homeroom || {}, plansV = null;
    if (py) {            // ปีเก่า: ใช้รายชื่อ ครูที่ปรึกษา และแผนการเรียนตอนสิ้นปีนั้น · ยังโหลดไม่เสร็จ = ว่างไว้ก่อน (ไม่แสดงชื่อรุ่นใหม่ปน)
      const A = Object.values(S.rosterArchive || {}).filter(x => x && String(x.year) === py);
      roster = {}; hrMap = {}; plansV = {};      // ไม่มีรายชื่อปีนั้น (ยังไม่เคยเก็บ/โหลดไม่ได้) = ว่าง ห้ามใช้รายชื่อปัจจุบันแทน
      if (ready.rosterArchive && A.length) A.forEach(x => { roster[x.room] = { name: x.name, students: (x.students || []).map(s => Object.assign({}, s)) };     /* สำเนา: แก้ในหน้าจอไม่กระทบรายชื่อที่เก็บไว้ */ if (x.hr) hrMap[x.room] = x.hr; if (x.plans) plansV[x.room] = x.plans; });
    }
    S.__rosterView = py ? roster : null; S.__plansView = py ? plansV : null;
    S.__rosterMissing = py && ready.rosterArchive && !Object.keys(roster).length ? py : '';      // term.js / stuleft.js แจ้ง “ไม่มีรายชื่อปีนี้ในระบบ”
    const rooms = S.rooms || [], name = id => ((py && roster[id]) || rooms.find(r => r.id === id) || roster[id] || {}).name || id;
    const subj = {}; (S.__ttAll || []).forEach(e => { if (e.teacher === S.me.name && !subj[e.classId]) subj[e.classId] = e.subject; });
    const hr = Object.keys(hrMap).filter(k => [].concat(hrMap[k] || []).indexOf(S.me.name) >= 0);
    const ids = office() && S.view === 'admin' ? (py ? Object.keys(roster) : rooms.map(r => r.id).concat(Object.keys(roster))) : Object.keys(subj).concat(hr);
    const seen = new Set();
    S.classes = ids.filter(id => !seen.has(id) && seen.add(id)).map(id => ({ id, name: name(id), subject: subj[id] || (hr.indexOf(id) >= 0 ? 'ห้องที่ปรึกษา' : ''), students: ((roster[id] || {}).students || []) }));
    S.classes.sort((a, b) => String(a.name).localeCompare(String(b.name), 'th', { numeric: true }));
    if (window.EMSPlans) EMSPlans.apply();                        // ห้องย่อยตามแผนการเรียน: รายชื่อ = ห้องหลักที่เลือกแผนนั้น
    if (S.student && !S.classes.some(c => c.id === S.student.classId)) S.student = S.classes[0] ? { classId: S.classes[0].id, id: (S.classes[0].students[0] || {}).id } : S.student;
  }
  /* roster (ห้อง → รายชื่อ) ฝั่งเขียน: ห้องในหน้าจอ = S.classes */
  /* ดูปีเก่า = รายชื่อในหน้าจอเป็นของปีเก่า ห้ามเขียนทับรายชื่อปัจจุบัน */
  const rosterOk = () => (admin() || has('academic')) && !pastYear();      // newyear.js ตรวจก่อนขึ้นปีว่ารายชื่อจะถูกเขียนจริง
  function encodeRoster() { if (!rosterOk()) return; const r = S.__roster || (S.__roster = {}); S.classes.forEach(c => { if (window.EMSPlans && EMSPlans.isSub(c.id)) return; r[c.id] = { name: c.name, students: c.students }; }); }

  /* ================= เครื่องซิงก์ ================= */
  const last = {};        // slice.id → { docId: json ที่ได้จาก/เขียนขึ้น Firestore ล่าสุด }
  const ready = {};       // slice.id → true เมื่อได้ข้อมูลรอบแรก · keys/group: slice.id+':'+docId
  const unsub = [];
  const track = (s, u) => { s.__u = u; unsub.push(u); };
  function relisten(s) { if (s.__u) { s.__u(); const i = unsub.indexOf(s.__u); if (i >= 0) unsub.splice(i, 1); s.__u = null; } delete ready[s.id]; listen(s); }
  const L = s => last[s.id] || (last[s.id] = {});
  /* lazy: ยังไม่ถึงหน้าที่ใช้ = ไม่ฟัง (ready ยังไม่ตั้ง → ไม่เขียน) · ฟังอยู่แล้วแต่ qk เปลี่ยน → ฟังใหม่
     unlazy: ออกจากหน้าแล้ว (lazy() เป็น false) → เลิกฟัง (relisten ล้าง ready แล้ว listen ไม่ฟังต่อ) */
  function lazyCheck() { SL.forEach(s => { if (!s.lazy) return; if (s.__u ? ((s.unlazy && !s.lazy()) || (s.qk && s.__qk !== s.qk())) : s.lazy()) relisten(s); }); }

  function applyDoc(s, data) {
    const v = data && data.j != null ? P_(data.j) : null;
    s.keys.forEach(k => { const val = v ? v[k] : undefined; if (val !== undefined) put(k, val); else put(k, emptyLike(get(k), k)); });
    let raw = data && data.j != null ? data.j : null;
    /* drop = คีย์เก่าที่ย้ายไปเอกสารอื่นแล้ว: เก็บค่าไว้ที่ s.__drop และไม่นับในค่าล่าสุด (ไม่งั้นทุกคนเห็นว่า “แก้แล้ว” → คืนค่า/เตือนสิทธิ์) */
    if (s.drop) { s.__drop = {}; if (v && s.drop.some(k => k in v)) { const o = Object.assign({}, v); s.drop.forEach(k => { s.__drop[k] = o[k]; delete o[k]; }); raw = J(o); } }
    L(s).doc = raw != null ? raw : J(snapshotDoc(s));
  }
  /* ค่าตั้งต้นของระบบ (ไม่ใช่ข้อมูลสมมติ) คงไว้ตอนยังไม่มีในระบบ · ส่วนที่มีข้อมูลสมมติปนให้ตั้งเป็นค่าว่างที่หน้าจอยังใช้ได้ */
  const KEEP = ['settings', 'affairs.cfg', 'prefs', 'personal', 'term', 'terms', 'hrCfg', 'profile', 'settings.studentLogin', 'settings.resultsAnnounced'];
  const emptyLike = (cur, k) => KEEP.indexOf(k) >= 0 ? cur
    : k === 'gen' ? { approvers: { head: '', assistant: '', deputy: '' }, workers: [], places: (cur && cur.places) || [], view: (cur && cur.view) || 'queue' }
    : Array.isArray(cur) ? [] : cur && typeof cur === 'object' ? {} : cur === undefined ? undefined : null;
  const snapshotDoc = s => { const o = {}; s.keys.forEach(k => { o[k] = get(k); }); return o; };

  function listen(s) {
    if (s.when && !s.when()) { ready[s.id] = true; return; }
    if (s.lazy && !s.lazy()) return;
    if (s.qk) s.__qk = s.qk();
    const done = () => { if (!ready[s.id]) { ready[s.id] = true; bootCheck(); } };
    const err = e => { if (s.quietErr) { ready[s.id] = 'err'; console.warn('EMS cloud', s.id, e); bootCheck(); paint(); return; }      // quietErr = ส่วนเสริม (เช่น กฎยังไม่วาง) ไม่ทำให้จุดสถานะแดง · 'err' = ไม่รอบูต แต่ไม่นับว่ามีข้อมูล
      ready[s.id] = true; status.err = (e && e.code) || String(e); status.state = 'error'; console.warn('EMS cloud', s.id, e); bootCheck(); paint(); };
    s.__tk = termKey();
    if (s.mode === 'doc') { track(s, s.ref().onSnapshot(d => { applyDoc(s, d.exists ? d.data() : null); if (s.after) s.after(); done(); changed();
      if (s.id === 'me' && !meSrv && !(d.metadata && d.metadata.fromCache)) { meSrv = true; setTimeout(siSync, 3000); } }, err)); return; }      // meSrv: siSync (staffinfo)
    let q = db.collection(s.coll); if (s.query) { q = s.query(q); if (!q) { put(s.path, s.mode === 'items' ? [] : {}); if (s.lazy) track(s, () => {}); /* lazy: ถือว่าฟังอยู่ ไม่ฟังใหม่ทุกครั้งที่วาด */ done(); return; } }
    track(s, q.onSnapshot(snap => {
      const lm = L(s);
      if (s.mode === 'items') {
        const arr = []; const seen = {};
        let bf = 0; const canBf = s.fields && s.backfill && s.backfill();
        const kp = s.keepLocal && (ready[s.id] || (s.keepAcross && s.__had)) ? pendingLocal(s, lm) : null;      // __had = เคยได้ข้อมูลจากระบบแล้ว (ตอนบูตในเครื่องยังเป็นข้อมูลตัวอย่าง ห้ามส่งขึ้น)
        snap.docs.forEach(d => { const x = d.data(), v = s.plain ? stripMeta(x, s) : P_(x.j); if (v == null) return; seen[d.id] = 1; lm[d.id] = J(v);
          if (kp && kp.gone[d.id]) return;                                   // ลบในเครื่องแล้ว รอส่งขึ้น
          arr.push({ o: x.o == null ? 0 : x.o, v: kp && kp.mine[d.id] ? kp.mine[d.id] : v });
          if (canBf) { const f = s.fields(v); if (Object.keys(f).some(k => x[k] !== f[k])) { lm[d.id] = ''; bf++; } } });
        if (bf) setTimeout(dirty, 1500);
        Object.keys(lm).forEach(k => { if (!seen[k]) delete lm[k]; });
        if (kp) { Object.keys(kp.mine).forEach((id, i) => { if (!seen[id]) arr.push({ o: 1e9 + i, v: kp.mine[id] }); }); if (kp.n) dirty(); }
        arr.sort((a, b) => a.o - b.o); put(s.path, arr.map(x => x.v)); s.__had = true;
      } else if (s.mode === 'keys') {
        const obj = {}; Object.keys(lm).forEach(k => delete lm[k]);
        snap.docs.forEach(d => { const x = d.data(), v = s.plain ? stripMeta(x, s) : P_(x.j), k = s.plain ? d.id : (x.k || d.id); if (v == null) return; obj[k] = v; lm[d.id] = J(v); ready[s.id + ':' + d.id] = true; });
        put(s.path, obj);
      } else {           // group
        const obj = {}; Object.keys(lm).forEach(k => delete lm[k]);
        snap.docs.forEach(d => { if (s.tkBound && d.id.indexOf(s.__tk + '_') !== 0) return; const f = d.data().f || {}; ready[s.id + ':' + d.id] = true; Object.keys(f).forEach(fk => { const k = unkey(fk); lm[d.id + '/' + fk] = f[fk]; const v = P_(f[fk]); if (v == null) return;
          if (s.two) { const [g, c] = k.split('|'); (obj[g] = obj[g] || {})[c] = v; } else obj[k] = v; }); });
        put(s.path, obj); if (s.id === 'att') uOverlay('att');      // ค่าเช็กชื่อที่ยังไม่ได้ส่ง ใส่ทับกลับ
      }
      if (s.after) s.after(); done(); changed();
    }, err));
  }
  /* keepLocal: รายการในเครื่องที่ยังไม่ได้เขียนขึ้น (ต่างจากค่าล่าสุดของระบบ/ยังไม่มีในระบบ) และรายการที่ลบในเครื่องแล้วรอลบ */
  function pendingLocal(s, lm) {
    const mine = {}, gone = {}, have = {}; let n = 0;
    (get(s.path) || []).forEach(v => { if (!v) return; const id = String(s.idOf ? s.idOf(v) : v.id); if (!id || id === 'undefined') return; have[id] = 1; if (J(v) !== lm[id]) { mine[id] = v; n++; } });
    Object.keys(lm).forEach(id => { if (!have[id]) { gone[id] = 1; n++; } });
    return { mine, gone, n };
  }
  /* keys แบบรายคีย์ (สมุดคะแนน): ฟังเอกสารของห้องที่สอนทีละเอกสาร */
  const perKeyUnsubs = {};
  function listenPerKey(s) {
    const perKeyUnsub = perKeyUnsubs[s.id] || (perKeyUnsubs[s.id] = {});
    if (!get(s.path)) put(s.path, {});
    const want = {}; s.perKey().forEach(k => { want[s.docId(k)] = k; });
    Object.keys(perKeyUnsub).forEach(id => { if (!want[id]) { perKeyUnsub[id](); delete perKeyUnsub[id]; } });
    Object.keys(want).forEach(id => { if (perKeyUnsub[id]) return; const k = want[id];
      perKeyUnsub[id] = db.collection(s.coll).doc(id).onSnapshot(d => { const x = d.exists ? d.data() : null, v = x ? P_(x.j) : null;
        const obj = get(s.path) || {}; if (v != null) obj[k] = v; else if (!ready[s.id + ':' + id]) delete obj[k];
        put(s.path, obj); L(s)[id] = v != null ? J(v) : null; ready[s.id + ':' + id] = true; if (s.id === 'books') uOverlay('books', k); changed(); }, e => { ready[s.id + ':' + id] = true; console.warn('EMS cloud ' + s.id, e); }); });
  }
  const stripMeta = (x, s) => { const o = Object.assign({}, x); if (!(s && s.keepAt)) delete o.at; delete o.by; delete o.o; return o; };   // keepAt = at เป็นเวลาของเหตุการณ์ (เวลาสแกน) ไม่ใช่เวลาเขียน
  const fkey = k => String(k).replace(/[.~*\/\[\]`]/g, c => '~' + c.charCodeAt(0).toString(16) + '~');
  const unkey = k => String(k).replace(/~([0-9a-f]+)~/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  /* ---------- สำรองในเครื่อง: เช็กชื่อ (att) + สมุดคะแนน (books) ที่ยังส่งขึ้นระบบไม่สำเร็จ ----------
     ก่อนส่งทุกครั้งเก็บค่าที่จะส่งไว้ใน localStorage (ems-unsent) · ส่งสำเร็จ = ลบออก
     เน็ตหลุด/ปิดหน้าก่อนส่งเสร็จ → เปิดแอปครั้งถัดไป (บัญชีเดิม ภาคเดิม) ใส่ค่ากลับแล้วส่งใหม่เอง
     ระหว่างรอส่ง ถ้ามีข้อมูลจากระบบเข้ามา (ครูอื่นเช็กห้องเดียวกัน ฯลฯ) ใส่ค่าที่ยังไม่ได้ส่งทับกลับ ไม่ให้หาย · เก็บไม่เกิน 14 วัน */
  const UKEY = 'ems-unsent', bootAt = Date.now();
  let uToast = 0;
  const uLoad = () => { try { const o = JSON.parse(localStorage.getItem(UKEY) || 'null'); return o && o.items && typeof o.items === 'object' ? o : { items: {} }; } catch (e) { return { items: {} }; } };
  const uSave = o => { try { if (Object.keys(o.items).length) localStorage.setItem(UKEY, JSON.stringify(o)); else localStorage.removeItem(UKEY); } catch (e) {} };
  const uId = (sec, tk, k) => sec + '|' + tk + '|' + k;
  function uAdd(w) {
    const o = uLoad(), tk = termKey(), em = me(), t = Date.now(); let n = 0;
    w.forEach(x => (x.bk || []).forEach(b => { b.tk = tk; o.items[uId(b.s, tk, b.k)] = { s: b.s, tk, k: b.k, j: b.j, em, t }; n++; }));
    if (n) uSave(o);
  }
  function uDone(ws) {
    const o = uLoad(); let ch = 0;
    ws.forEach(x => (x.bk || []).forEach(b => { const id = uId(b.s, b.tk, b.k), e = o.items[id]; if (e && e.j === b.j) { delete o.items[id]; ch++; } }));
    if (ch) uSave(o);
  }
  /* ใส่ค่าที่ยังไม่ได้ส่งทับข้อมูลจากระบบ — เรียกหลังได้ snapshot ของ att (ทั้งชุด) หรือ books (ทีละห้อง) */
  function uOverlay(sec, onlyKey) {
    const o = uLoad(), tk = termKey(), em = me(), cut = Date.now() - 14 * 864e5, s = SL.find(x => x.id === sec);
    if (!s || !Object.keys(o.items).length) return;
    let n = 0, old = 0, ch = 0;
    Object.keys(o.items).forEach(id => { const e = o.items[id];
      if (!e || !(e.t > cut)) { delete o.items[id]; ch++; return; }
      if (e.s !== sec || e.em !== em || e.tk !== tk || (onlyKey != null && e.k !== onlyKey)) return;
      if (s.lockable && viewLocked()) { delete o.items[id]; ch++; return; }         // ภาคปิดแล้ว แก้ไม่ได้อยู่ดี
      let cur;
      if (sec === 'att') { if (s.__tk !== tk) return; cur = L(s)[s.groupOf(e.k) + '/' + fkey(e.k)]; }
      else { const did = s.docId(e.k); if (!ready[s.id + ':' + did]) return; cur = L(s)[did]; }
      if (cur === e.j) { delete o.items[id]; ch++; return; }                         // ระบบมีค่านี้แล้ว
      const obj = get(s.path) || {}; obj[e.k] = P_(e.j); put(s.path, obj); n++; if (e.t < bootAt) old++;
    });
    if (ch) uSave(o);
    if (n) { if (old && !uToast) { uToast = 1; setTimeout(() => toast('กู้ข้อมูลที่ยังไม่ได้ส่งขึ้นระบบ ' + old + ' รายการ — กำลังบันทึก'), 300); } dirty(); }
  }

  /* ---------- เขียนขึ้น: เทียบกับค่าล่าสุดของแต่ละเอกสาร ---------- */
  function collectWrites() {
    const w = [], stamp = { at: firebase.firestore.FieldValue.serverTimestamp(), by: me() };
    SL.forEach(s => {
      if (!ready[s.id]) return;
      if (s.tkBound && s.__tk !== termKey()) return;          // ข้อมูลในเครื่องยังเป็นของภาคเดิม รอฟังภาคใหม่ก่อน
      if (!s.can()) { revert(s); return; }
      if (s.before) s.before();
      const lm = L(s);
      if (s.mode === 'doc') { const j = J(snapshotDoc(s)); if (s.id === 'tt' && j !== lm.doc) ttSizeWarn(j); if (j !== lm.doc) { w.push({ ref: s.ref(), data: Object.assign({ j }, stamp), done: () => { lm.doc = j; } }); } return; }
      if (s.mode === 'items') {
        const arr = get(s.path) || [], seen = {};
        arr.forEach((v, i) => { if (!v) return; const id = String(s.idOf ? s.idOf(v) : v.id); if (!id || id === 'undefined') return; seen[id] = 1; const j = J(v);
          if (j !== lm[id]) w.push({ ref: db.collection(s.coll).doc(id), data: Object.assign(s.plain ? P_(j) : { j }, { o: i }, s.fields ? s.fields(v) : {}, stamp), done: () => { lm[id] = j; } }); });
        if (!s.noDelete) Object.keys(lm).forEach(id => { if (!seen[id]) w.push({ ref: db.collection(s.coll).doc(id), del: true, done: () => { delete lm[id]; } }); });
        return;
      }
      if (s.mode === 'keys') {
        const obj = get(s.path) || {};
        if (s.lockable && viewLocked()) lockGuard(s, obj);
        Object.keys(obj).forEach(k => { const id = s.docId ? s.docId(k) : fkeyId(k); if (s.perKey && !ready[s.id + ':' + id]) return; const j = J(obj[k]);
          if (j !== lm[id]) w.push({ ref: db.collection(s.coll).doc(id), data: Object.assign(s.plain ? P_(j) : { j, k }, s.fields ? s.fields(k, obj[k]) : {}, stamp), bk: s.id === 'books' ? [{ s: 'books', k, j }] : null, done: () => { lm[id] = j; } }); });
        if (!s.perKey && !s.noDelete) Object.keys(lm).forEach(id => { if (!Object.keys(obj).some(k => fkeyId(k) === id)) w.push({ ref: db.collection(s.coll).doc(id), del: true, done: () => { delete lm[id]; } }); });
        return;
      }
      /* group: เขียนเฉพาะฟิลด์ที่เปลี่ยน (merge) — ครูหลายคนเช็กชื่อห้องเดียวกันต่างคาบไม่ทับกัน */
      if (s.lockable && viewLocked()) { attGuard(s); return; }
      const obj = get(s.path) || {}, flat = {};
      if (s.two) Object.keys(obj).forEach(g => Object.keys(obj[g] || {}).forEach(c => { flat[g + '|' + c] = obj[g][c]; })); else Object.assign(flat, obj);
      const by = {};
      Object.keys(flat).forEach(k => { const g = s.groupOf(k), fk = fkey(k), j = J(flat[k]); if (j !== lm[g + '/' + fk]) { const b = (by[g] = by[g] || { k, f: {}, ks: [] }); b.f[fk] = j; b.ks.push([k, j]); } });
      Object.keys(by).forEach(g => { w.push({ ref: db.collection(s.coll).doc(g), data: Object.assign({ f: by[g].f }, s.fields(by[g].k), stamp), merge: true, bk: s.id === 'att' ? by[g].ks.map(([k, j]) => ({ s: 'att', k, j })) : null, done: () => { Object.keys(by[g].f).forEach(fk => { lm[g + '/' + fk] = by[g].f[fk]; }); } }); });
    });
    return w;
  }
  /* แก้ส่วนที่บทบาทนี้ไม่มีสิทธิ์ → แจ้งครั้งเดียว แล้วคืนค่าจากระบบ (ไม่ให้หน้าจอแสดงสิ่งที่ไม่ได้บันทึกจริง) */
  const warned = {};
  function revert(s) {
    const lm = L(s);
    if (s.mode === 'doc') { if (s.before) s.before(); const j = J(snapshotDoc(s)); if (j === lm.doc || lm.doc == null) return; const v = P_(lm.doc) || {}; const loc = snapshotDoc(s) || {}; if (s.keys.every(k => v[k] === undefined || J(loc[k]) === J(v[k]))) return;   /* ต่างเฉพาะคีย์ที่ระบบยังไม่มี (ค่าตั้งต้นในเครื่อง) = ไม่ใช่การแก้ของผู้ใช้ ไม่ต้องคืนค่า/เตือน */ s.keys.forEach(k => put(k, v[k] !== undefined ? v[k] : emptyLike(get(k), k))); if (s.after) s.after(); }
    else if (s.mode === 'items') { const arr = get(s.path) || []; const now = {}; arr.forEach(v => { if (v) now[String(s.idOf ? s.idOf(v) : v.id)] = J(v); });
      const same = Object.keys(now).length === Object.keys(lm).length && Object.keys(now).every(k => now[k] === lm[k]); if (same) return; put(s.path, Object.keys(lm).map(k => P_(lm[k]))); }
    else return;
    if (!warned[s.id]) { warned[s.id] = 1; toast('บัญชีนี้ไม่มีสิทธิ์แก้ส่วนนี้ — คืนค่าเดิมจากระบบแล้ว'); }
    changed();
  }
  /* ภาคเรียนปิดแล้ว: สมุดคะแนนเปลี่ยนได้เฉพาะคะแนนซ่อม (itemRetakes / exam.retake) ส่วนอื่นคืนค่าเดิม */
  const noRetake = v => { const x = JSON.parse(JSON.stringify(v || {})); delete x.itemRetakes; delete x.__vh; Object.values(x.exam || {}).forEach(e => { if (e) delete e.retake; }); return J(x); };
  function lockGuard(s, obj) {
    const lm = L(s); let bad = 0;
    Object.keys(obj).forEach(k => { const id = s.docId ? s.docId(k) : fkeyId(k); if (lm[id] == null) return; const prev = P_(lm[id]);
      if (s.id === 'books' ? noRetake(obj[k]) !== noRetake(prev) : J(obj[k]) !== lm[id]) { obj[k] = s.id === 'books' ? Object.assign(prev, { itemRetakes: obj[k].itemRetakes, exam: mergeRetake(prev.exam, obj[k].exam), __vh: obj[k].__vh }) : prev; bad++; } });
    if (bad && !warned['lock:' + s.id]) { warned['lock:' + s.id] = 1; toast('ภาคเรียนนี้ปิดแล้ว — บันทึกได้เฉพาะคะแนนซ่อม'); }
  }
  const mergeRetake = (prevExam, nowExam) => { const out = JSON.parse(JSON.stringify(prevExam || {})); Object.keys(nowExam || {}).forEach(sid => { const r = (nowExam[sid] || {}).retake; if (r === undefined) { if (out[sid]) delete out[sid].retake; return; } (out[sid] = out[sid] || {}).retake = r; }); return out; };
  function attGuard(s) {
    const lm = L(s), obj = get(s.path) || {}; let bad = 0;
    Object.keys(obj).forEach(k => { const g = s.groupOf(k), j = J(obj[k]), prev = lm[g + '/' + fkey(k)]; if (prev !== undefined && j !== prev) { obj[k] = P_(prev); bad++; } else if (prev === undefined) { delete obj[k]; bad++; } });
    if (bad && !warned['lock:att']) { warned['lock:att'] = 1; toast('ภาคเรียนนี้ปิดแล้ว — แก้การเช็กชื่อไม่ได้'); }
  }
  const fkeyId = k => String(k).replace(/\//g, '_');
  async function flush() {
    flushT = null; if (!db || !user) return;
    encodeRoster();
    let w; try { w = collectWrites(); } catch (e) { console.warn(e); return; }
    if (!w.length) return;
    status.state = 'saving'; status.pending = w.length; paint();
    uAdd(w);          // สำรองก่อนส่ง (ทำทันที ไม่รอเน็ต — ปิดหน้าตอนนี้ก็ยังกู้ได้)
    try {
      for (let i = 0; i < w.length; i += 400) { const b = db.batch(), part = w.slice(i, i + 400); part.forEach(x => { if (x.del) b.delete(x.ref); else b.set(x.ref, x.data, x.merge ? { merge: true } : undefined); }); await b.commit(); part.forEach(x => x.done()); uDone(part); }
      status.state = 'ok'; status.err = ''; wfail = false; status.at = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      scheduleViews();
    } catch (e) { status.state = 'error'; status.err = (e && e.code) || String(e); wfail = !(e && e.code === 'permission-denied'); toast(e && e.code === 'permission-denied' ? 'บันทึกขึ้นระบบไม่ได้: บัญชีนี้ไม่มีสิทธิ์แก้ข้อมูลส่วนนี้' : 'บันทึกขึ้นระบบไม่สำเร็จ — จะลองใหม่อัตโนมัติ'); setTimeout(dirty, 8000); }
    status.pending = 0; paint();
  }
  /* ตารางสอนทั้งโรงเรียนอยู่ในเอกสารเดียว (เพดาน 1 MiB) — เกิน ~900 KB เตือนครั้งเดียวต่อการเปิดแอป (ไม่บล็อก) */
  let ttWarned = false;
  function ttSizeWarn(j) { if (ttWarned || j.length < 300000) return; const n = new Blob([j]).size; if (n > 900000) { ttWarned = true; toast('ตารางสอนทั้งโรงเรียนใหญ่ ' + Math.round(n / 1024) + ' KB ใกล้เพดาน 1 MB ของฐานข้อมูล — ย่อชื่อสถานที่/วิชาให้สั้นลง'); } }
  function dirty() { if (!started) return; clearTimeout(flushT); try { uAdd(collectWrites()); } catch (e) {} flushT = setTimeout(flush, 700); siSync(); }
  /* สำเนาประวัติส่วนตัวที่เปิดเผยให้ฝ่ายบุคคล → staffInfo/{อีเมลตัวเอง} (staffinfo.js build: เฉพาะช่องที่ไม่ล็อก ไม่มีเงินเดือน)
     เขียนแยกจาก batch (ล้มก็ไม่กระทบงานอื่น) · ต้องได้ users/ ของตัวเองก่อน (ready.me) ไม่งั้นจะส่งค่าว่าง · ส่งซ้ำเฉพาะเมื่อเนื้อหาเปลี่ยน · ล้มแล้วไม่วนลองจนเปิดแอปครั้งหน้า */
  let siLast = '', siT = null, meSrv = false;      // meSrv = ได้ users/ ของตัวเองจากเซิร์ฟเวอร์จริงแล้ว (ไม่ใช่แคชตอนเน็ตหลุด/ฟังล้ม) จึงส่งสำเนาได้
  function siSync() {
    if (siT || !db || !user || !started || !meSrv || has('student') || !me() || !window.EMSStaffInfo) return;
    siT = setTimeout(() => { siT = null; const v = EMSStaffInfo.build(), j = J({ siMineDoc: v }); if (j === siLast) return;
      if (!siLast && !Object.keys(v.f || {}).length && !v.edu && !v.train && !(v.hidden || []).length) return;      // ยังไม่มีข้อมูลเลย ไม่ส่งค่าว่าง (กันทับของเดิม)
      siLast = j;
      db.collection('staffInfo').doc(me()).set({ j, at: firebase.firestore.FieldValue.serverTimestamp(), by: me() }).catch(e => { console.warn('EMS staffInfo', e && (e.code || e)); if (!e || e.code !== 'permission-denied') siLast = ''; }); }, 3000);
  }

  /* ข้อมูลเปลี่ยนจาก Firestore → คำนวณส่วนที่แตกมาใหม่ แล้ววาดหน้าจอ (ไม่วาดทับระหว่างพิมพ์) */
  let paintT = null;
  function changed() {
    deriveTT(); deriveClasses();
    const tt = SL.find(s => s.id === 'tt'); if (started && tt.__tk && tt.__tk !== termKey()) relisten(tt);
    if (started) lastTK = termKey();
    if (started) lazyCheck();
    if (started) SL.filter(s => s.perKey).forEach(listenPerKey);
    if (started) examLegacy();
    const att = SL.find(s => s.id === 'att'); if (started && att) reAtt(att);
    if (!started) return;
    clearTimeout(paintT); paintT = setTimeout(() => { const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('#view')) { paintT = setTimeout(changed, 1500); return; } const y = scrollY; render(); scrollTo(0, y); }, 120);
  }
  let attIds = '';
  /* ห้องที่ต้องโหลดเช็กชื่อ = ห้องที่สอน + ห้องหลักของห้องย่อย (ส่งต่อผลเช็กชื่อจากคาบวิชาเรียนรวม) */
  function attRooms() { return [...new Set(S.classes.flatMap(x => [x.id, window.EMSPlans ? EMSPlans.parentOf(x.id) : '']).filter(Boolean))].slice(0, 30); }
  function reAtt(s) { const ids = termKey() + ':' + attRooms().join(','); if (ids === attIds) return; attIds = ids; relisten(s); }

  /* ================= เข้าสู่ระบบ ================= */
  const scriptLoad = src => new Promise((res, rej) => { const x = document.createElement('script'); x.src = src; x.onload = res; x.onerror = () => rej(new Error('โหลด ' + src + ' ไม่ได้')); document.head.appendChild(x); });
  async function init() {
    if (fb) return fb;
    if (window.__EMS_FAKE_FB) { window.firebase = window.__EMS_FAKE_FB; }
    else if (!window.firebase) for (const f of ['app', 'auth', 'firestore']) await scriptLoad('vendor/firebase-' + f + '-compat.js');
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(C.firebase);
    fb = { auth: firebase.auth(app) }; db = firebase.firestore(app);
    if (window.EMSMeter) EMSMeter.install(firebase, () => db, () => low((fb.auth.currentUser || {}).email));      // นับอ่าน/เขียน/ลบ (usage.js)
    return fb;
  }
  function gateMsg(html) { const n = document.querySelector('#gate .g-note'); if (n) n.innerHTML = html;
    /* ข้อความ "กำลัง…" = ยังโหลดอยู่ แสดงบนหน้าโหลด · อย่างอื่น (ให้กดเข้าสู่ระบบ/ข้อผิดพลาด) ปิดหน้าโหลดให้เห็นหน้าเข้าสู่ระบบ */
    if (window.EMSPreload) { if (/^กำลัง/.test(html)) EMSPreload.show(html); else EMSPreload.hide(); } }
  async function signIn() {
    await init(); const p = new firebase.auth.GoogleAuthProvider(), last = lastLogin();
    p.setCustomParameters(last && last.email ? { prompt: 'select_account', login_hint: last.email } : { prompt: 'select_account' });      // หลุดแล้วเข้าใหม่ = เลือกบัญชีเดิมแตะเดียว
    try { await fb.auth.signInWithPopup(p); }
    catch (e) { const m = ({ 'auth/unauthorized-domain': 'โดเมนนี้ยังไม่ได้เพิ่มใน Firebase → Authentication → Settings → Authorized domains', 'auth/popup-blocked': 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ — อนุญาตป๊อปอัปแล้วลองใหม่', 'auth/popup-closed-by-user': 'ปิดหน้าต่างก่อนเข้าสู่ระบบเสร็จ', 'auth/operation-not-allowed': 'ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google ใน Firebase Console' })[e.code] || e.message;
      toast(m); gateMsg('<span style="color:var(--bad)">' + esc(m) + '</span>'); }
  }
  async function onUser(u) {
    user = u;
    if (!u) { started = false; const last = lastLogin();
      gateMsg('เข้าสู่ระบบด้วยบัญชี Google ที่ลงทะเบียนไว้ · ติดปัญหา? กด “ติดต่อแอดมิน”' + (last && last.email ? `<div class="muted small" style="margin-top:6px">ครั้งก่อนเข้าด้วย ${esc(last.email)} · หลุดหลังเข้าสู่ระบบ ${esc(ago(last.at))} โดยไม่ได้กดออก — แจ้งผู้ดูแลได้ถ้าเกิดบ่อย</div>` : ''));
      return showGate(true); }
    keepLogin(u);
    const email = low(u.email); gateMsg('กำลังตรวจสอบบัญชี ' + esc(email) + '…');
    let staff = null;
    try { const d = await db.collection('staff').doc(email).get(); staff = d.exists ? d.data() : null; }
    catch (e) { gateMsg('<span style="color:var(--bad)">อ่านรายชื่อบุคลากรไม่ได้ (' + esc(e.code || e.message) + ') — ตรวจว่าเปิด Firestore และวาง firestore.rules แล้ว</span>'); return; }
    if (!staff && (C.adminEmails || []).map(low).indexOf(email) >= 0) {          // แอดมินตั้งต้น: สร้างรายชื่อของตัวเองครั้งแรก
      staff = { name: u.displayName || email, email, phone: '', dept: '', role: 'admin', roles: ['admin'] };
      await db.collection('staff').doc(email).set(Object.assign({}, staff, { at: firebase.firestore.FieldValue.serverTimestamp(), by: email }));
    }
    if (!staff && studentId(email)) return enterStudent(email, studentId(email));
    if (!staff || staff.active === false) return notRegistered(email);
    const rs = staff.roles && staff.roles.length ? staff.roles : [staff.role || 'teacher'];
    S.me = { name: staff.name, email, role: staff.role || rs[0], roles: rs, dept: staff.dept || '', phone: staff.phone || '' };
    gateMsg('กำลังโหลดข้อมูลของโรงเรียน…');
    start();
  }
  function notRegistered(email) {
    const dom = (S.settings.studentDomain || '').replace(/^@/, '');
    const student = dom && email.endsWith('@' + low(dom));
    gateMsg(`<div class="notice bad" style="text-align:left">${student ? 'บัญชีนักเรียน — ระบบสำหรับนักเรียนจะเปิดใช้ภายหลัง' : 'อีเมล <b>' + esc(email) + '</b> ยังไม่อยู่ในรายชื่อบุคลากรของ EMS'}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${student ? '' : `<button class="btn sm pri" data-cl="join" data-v="${esc(email)}">ขอเพิ่มชื่อเข้าระบบ</button>`}<button class="btn sm" data-cl="out">ใช้บัญชีอื่น</button></div></div>`);
  }
  function start() {
    if (started) return; started = true;
    Object.keys(ready).forEach(k => delete ready[k]);
    S.swaps = []; S.pending = []; S.requests = []; S.reviews = []; S.activities = []; S.actRes = {};     // ส่วนสาธิตของต้นแบบที่ยังไม่มีในระบบจริง
    S.profile = { phone: S.me.phone, leave: { sick: [0, 30], personal: [0, 10], vacation: [0, 10] } };
    S.books = {}; S.att = {}; S.attSaved = {};
    SL.forEach(s => { if (s.perKey) ready[s.id] = true; else listen(s); });
    bootCheck();
  }
  let entered = false;
  function bootCheck() {
    if (entered || !started) return;
    if (SL.some(s => s.boot && !ready[s.id])) return;
    entered = true; changed(); setTimeout(siSync, 5000);
    const view = roles().some(r => ADMIN_ROLES.indexOf(r) >= 0) && roles().indexOf('teacher') < 0 ? 'admin' : 'teacher';
    try { sessionStorage.setItem('ems-auth', '1'); } catch (x) {}
    S.view = view; showGate(false); closeModal(); page = homeOf(); render(); scrollTo(0, 0); if (window.EMSPreload) EMSPreload.hide();
    toast('ยินดีต้อนรับ ' + S.me.name);
  }
  function showGate(on) { const g = document.getElementById('gate'); if (g) { g.hidden = !on; document.body.style.overflow = on ? 'hidden' : ''; } }
  /* ---------- อยู่ในระบบต่อเนื่อง ----------
     Firebase จำการเข้าสู่ระบบในเครื่องแบบถาวร (LOCAL / IndexedDB) ไม่มีวันหมดอายุจนกว่าจะกดออก
     แต่ Android/iOS อาจล้างข้อมูลเว็บเมื่อพื้นที่ใกล้เต็ม → ขอเก็บแบบถาวร (storage.persist) ทุกครั้งที่เข้าสู่ระบบ
     และจำอีเมล+เวลาที่เข้าไว้ ถ้าหลุดเองจะบอกบนหน้าเข้าสู่ระบบว่าหลุดหลังกี่ชั่วโมง และเลือกบัญชีเดิมให้ */
  const LKEY = 'ems-last-login';
  const lastLogin = () => { try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch (e) { return null; } };
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' นาที' : m < 2880 ? Math.round(m / 60) + ' ชั่วโมง' : Math.round(m / 1440) + ' วัน'; };
  function keepLogin(u) {
    const em = low(u.email), cur = lastLogin();
    try { if (!cur || cur.email !== em) localStorage.setItem(LKEY, JSON.stringify({ email: em, at: Date.now() })); } catch (e) {}
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(ok => ok || navigator.storage.persist()).catch(() => {}); } catch (e) {}
  }
  async function signOut() { clearTimeout(flushT); try { localStorage.removeItem(LKEY); } catch (x) {} await flush(); unsub.splice(0).forEach(f => { try { f(); } catch (e) {} }); Object.values(perKeyUnsubs).forEach(m => Object.keys(m).forEach(k => { m[k](); delete m[k]; }));
    started = false; entered = false; attIds = ''; await writeViews(true).catch(() => {}); if (fb) await fb.auth.signOut(); try { sessionStorage.removeItem('ems-auth'); } catch (x) {} location.reload(); }

  /* ส่งคำขอติดต่อแอดมินได้แม้ยังไม่อยู่ในรายชื่อ (rules: สร้างได้อย่างเดียว อ่านไม่ได้) */
  async function submitContact(r) { await init(); const x = Object.assign({}, r); await db.collection('contactReqs').doc(String(r.id)).set({ j: J(x), o: 0, at: firebase.firestore.FieldValue.serverTimestamp(), by: low((fb.auth.currentUser || {}).email) || '' }); }

  /* ---------- สถานะการบันทึกบนแถบด้านบน ---------- */
  function paint() {
    let el = document.getElementById('cloudDot');
    const top = document.querySelector('#topbar .tb-r'); if (!top) return;
    if (!el) { el = document.createElement('span'); el.id = 'cloudDot'; el.className = 'cl-dot'; top.prepend(el); }
    const t = { saving: ['กำลังบันทึก…', 'warn'], error: ['บันทึกไม่สำเร็จ: ' + status.err, 'bad'], ok: ['บันทึกแล้ว ' + status.at, 'ok'], idle: ['เชื่อมระบบแล้ว', 'ok'] }[status.state];
    el.dataset.s = t[1]; el.title = t[0]; el.setAttribute('aria-label', t[0]);
  }
  const css = document.createElement('style');
  css.textContent = `.cl-dot{width:10px;height:10px;border-radius:50%;background:var(--ok);display:inline-block;margin:0 6px}.cl-dot[data-s="warn"]{background:var(--warn)}.cl-dot[data-s="bad"]{background:var(--bad)}`;
  document.head.appendChild(css);
  const baseRender = window.render;
  let lastView = '', lastTK = '';
  window.render = function () {
    if (started && (S.view !== lastView || termKey() !== lastTK)) { const tkChanged = lastTK && termKey() !== lastTK; lastView = S.view; lastTK = termKey(); deriveClasses();
      if (tkChanged) { const tt = SL.find(s => s.id === 'tt'); relisten(tt); reAtt(SL.find(s => s.id === 'att')); } }
    if (started) lazyCheck();
    const r = baseRender.apply(this, arguments); if (started) paint(); return r; };

  /* ---------- เหตุการณ์ ---------- */
  document.addEventListener('click', e => {
    const g = e.target.closest('#gate .g-gbtn'); if (g) { e.stopImmediatePropagation(); e.preventDefault(); signIn(); return; }
    const lo = e.target.closest('[data-act="logout"]'); if (lo) { e.stopImmediatePropagation(); e.preventDefault(); signOut(); return; }
    const cl = e.target.closest('[data-cl]'); if (!cl) return;
    if (cl.dataset.cl === 'out') { try { localStorage.removeItem(LKEY); } catch (x) {} return fb && fb.auth.signOut(); }
    if (cl.dataset.cl === 'join' && window.EMSContact) { EMSContact.open('join'); setTimeout(() => { const i = document.getElementById('ct-e'); if (i) i.value = cl.dataset.v; }, 0); }
  }, true);
  /* ปิด/รีเฟรชหน้าขณะยังส่งข้อมูลไม่เสร็จ (รอส่ง · กำลังส่ง · ส่งไม่สำเร็จรอลองใหม่) → ส่งทันที + ให้เบราว์เซอร์ถามยืนยันก่อนออก
     ไม่นับ permission-denied (ลองใหม่ก็ไม่ผ่าน เตือนทุกครั้งจะรำคาญ) · มือถือมักไม่ยิง beforeunload → ส่งทันทีเมื่อสลับแอป/ซ่อนหน้า */
  const unsaved = () => !!flushT || status.state === 'saving' || wfail;
  window.addEventListener('beforeunload', e => { if (flushT) flush(); if (unsaved()) { e.preventDefault(); e.returnValue = 'ข้อมูลยังบันทึกขึ้นระบบไม่เสร็จ'; return e.returnValue; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && flushT) { clearTimeout(flushT); flush(); } });
  window.addEventListener('online', () => { if (wfail || Object.keys(uLoad().items).length) dirty(); });

  /* หน้าที่ต้องมีห้องเรียนอย่างน้อย 1 ห้อง: ครูใหม่/ระบบเพิ่งเริ่ม ยังไม่มีตารางสอนหรือรายชื่อนักเรียน */
  ['scores', 'items', 'groups', 'indicators', 'assess', 'summary'].forEach(k => { const base = P[k]; if (!base) return;
    P[k] = () => S.classes.length ? base() : `<div class="top"><div><h1>${esc((((window.EMSNav && EMSNav.NAVG.teacher) || []).flatMap(g => g[1]).find(x => x[0] === k) || [0, 'สมุดคะแนน'])[1])}</h1></div></div>
      <div class="card empty">ยังไม่มีห้องเรียนที่คุณสอนในภาคเรียนนี้<br><span class="muted small">ห้องจะขึ้นเองเมื่อฝ่ายวิชาการนำเข้าตารางสอนและรายชื่อนักเรียน (ตั้งค่าโรงเรียน › ตารางสอนทั้งโรงเรียน / นักเรียน)</span></div>`; });

  /* ================= สำรอง / กู้คืนข้อมูล (แอดมิน) =================
     ดาวน์โหลด: อ่านทุกเอกสารจาก Firestore ตรง ๆ (ไม่ใช่จากหน้าจอ) เป็นไฟล์ .json ไฟล์เดียว
     กู้คืน: เขียนทับ/เพิ่มเอกสารตามไฟล์ — ไม่ลบเอกสารที่ไม่มีในไฟล์ ประทับผู้กู้คืนเป็นผู้เขียน (rules ต้องการ by = ผู้เขียน)
     ไม่รวม users/* (ค่าส่วนตัวของแต่ละคน แอดมินอ่านไม่ได้ตามสิทธิ์) */
  const BACKUP_COLLS = ['staff', 'school', 'rooms', 'curriculum', 'staffInfo', 'stuLeft', 'rosterArchive', 'examPlans', 'meetings', 'meetingRsvp', 'roomPlans', 'books', 'att', 'hrDaily', 'leaves', 'xreqs', 'specials', 'acts', 'examReqs', 'repairs', 'venueReqs',
    'courseSubs', 'loadProps', 'conduct', 'examImports', 'dpaSlots', 'contactReqs', 'gateEvents', 'staffEvents', 'scanDevices', 'volunteer', 'courseDesc'];
  const plainVal = v => v && typeof v.toDate === 'function' ? { __ts: v.toDate().toISOString() } : Array.isArray(v) ? v.map(plainVal)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainVal(x)])) : v;
  const fromPlain = v => v && v.__ts ? firebase.firestore.FieldValue.serverTimestamp() : Array.isArray(v) ? v.map(fromPlain)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fromPlain(x)])) : v;
  const bk = { busy: false, msg: '', plan: null };
  async function exportAll() {
    if (!admin()) return toast('เฉพาะแอดมิน');
    bk.busy = true; bk.msg = 'กำลังอ่านข้อมูล…'; render();
    const out = { app: 'EMS', project: (C.firebase || {}).projectId, exportedAt: new Date().toISOString(), by: me(), term: termKey(), collections: {} };
    let n = 0;
    try {
      for (const c of BACKUP_COLLS) { const q = await db.collection(c).get(); out.collections[c] = {}; q.docs.forEach(d => { out.collections[c][d.id] = plainVal(d.data()); n++; }); bk.msg = 'อ่านแล้ว ' + n + ' เอกสาร…'; render(); }
    } catch (e) { bk.busy = false; bk.msg = ''; render(); return toast('สำรองไม่สำเร็จ: ' + (e.code || e.message)); }
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'EMS-backup-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    S.settings.lastBackup = { at: out.exportedAt, by: S.me.name, docs: n, kb: Math.round(blob.size / 1024) }; save();
    bk.busy = false; bk.msg = ''; render(); toast('ดาวน์โหลดไฟล์สำรองแล้ว · ' + n + ' เอกสาร');
    return out;
  }
  async function restorePick(file) {
    let x; try { x = JSON.parse(await file.text()); } catch (e) { return toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ EMS'); }
    if (!x || x.app !== 'EMS' || !x.collections) return toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ EMS');
    bk.plan = { file: file.name, data: x, counts: Object.fromEntries(Object.entries(x.collections).map(([c, docs]) => [c, Object.keys(docs).length])) }; render();
  }
  async function restoreRun() {
    const pl = bk.plan; if (!pl || !admin()) return;
    const typed = (document.getElementById('bk-confirm') || {}).value || '';
    if (typed.trim() !== 'กู้คืน') return toast('พิมพ์คำว่า “กู้คืน” เพื่อยืนยัน');
    /* rosterArchive สร้างได้อย่างเดียว (rules ห้ามแก้) → ข้ามเอกสารที่มีอยู่แล้ว ไม่งั้นทั้งชุดถูกปฏิเสธ */
    const have = {}; if (pl.data.collections.rosterArchive) { try { (await db.collection('rosterArchive').get()).docs.forEach(d => { have[d.id] = 1; }); } catch (e) { return toast('อ่านรายชื่อปีเก่าในระบบไม่ได้: ' + (e.code || e.message)); } }
    const ops = []; Object.entries(pl.data.collections).forEach(([c, docs]) => { if (BACKUP_COLLS.indexOf(c) < 0 || c === 'staffInfo') return;      // staffInfo: ครูแต่ละคนส่งใหม่เอง (rules ให้เขียนเฉพาะของตัวเอง)
      Object.entries(docs).forEach(([id, d]) => { if (c === 'rosterArchive' && have[id]) return; const v = fromPlain(d); if ('by' in v) v.by = me(); ops.push([c, id, v]); }); });
    bk.busy = true; let done = 0;
    try { for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(([c, id, v]) => b.set(db.collection(c).doc(id), v)); await b.commit(); done += Math.min(400, ops.length - i); bk.msg = 'กู้คืนแล้ว ' + done + '/' + ops.length; render(); } }
    catch (e) { bk.busy = false; bk.msg = ''; render(); return toast('กู้คืนไม่ครบ (' + done + '/' + ops.length + '): ' + (e.code || e.message)); }
    bk.busy = false; bk.msg = ''; bk.plan = null; toast('กู้คืนแล้ว ' + done + ' เอกสาร — กำลังโหลดหน้าใหม่'); setTimeout(() => location.reload(), 1200);
  }
  P['a-drive'] = () => { const lb = S.settings.lastBackup, pl = bk.plan, when = t => new Date(t).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    return `<div class="top"><div><h1>สำรองข้อมูล</h1><p>ข้อมูลทั้งหมดอยู่ใน Firestore โปรเจกต์ ${esc((C.firebase || {}).projectId)} · ดาวน์โหลดเก็บไว้เป็นระยะ โดยเฉพาะก่อนนำเข้าข้อมูลชุดใหญ่และก่อนประกาศผล</p></div></div>
    <div class="grid g2" style="align-items:start">
      <div class="card"><h2>ดาวน์โหลดไฟล์สำรอง</h2>
        <div class="muted small" style="margin-bottom:10px">รวมบุคลากร ห้องและนักเรียน ตารางสอน สมุดคะแนน การเช็กชื่อ ใบลา คำขอ ฯลฯ เป็นไฟล์ .json ไฟล์เดียว · ไม่รวมค่าส่วนตัวของแต่ละคน</div>
        <div class="row" style="border:0;padding:0 0 10px"><div class="grow"><div class="t">สำรองล่าสุด</div><div class="muted small">${lb ? esc(when(lb.at)) + ' · ' + esc(lb.by) + ' · ' + lb.docs + ' เอกสาร · ' + lb.kb + ' KB' : 'ยังไม่เคยสำรอง'}</div></div>${lb ? chip('มีไฟล์', 'ok') : chip('ยังไม่มี', 'warn')}</div>
        <button class="btn pri" data-bk="export" ${bk.busy || !admin() ? 'disabled' : ''}>${ic('down')}ดาวน์โหลดไฟล์สำรองทั้งหมด</button>${bk.msg ? `<div class="muted small" style="margin-top:8px">${esc(bk.msg)}</div>` : ''}
        <div class="notice" style="margin-top:12px">ไฟล์สำรองมีชื่อ เลขประจำตัว คะแนนนักเรียน และอีเมลบุคลากร — เก็บในไดรฟ์ของโรงเรียนหรือเครื่องที่ปลอดภัย อย่าส่งต่อในกลุ่มแชต</div></div>
      <div class="card"><h2>กู้คืนจากไฟล์สำรอง</h2>
        <div class="muted small" style="margin-bottom:10px">เขียนข้อมูลจากไฟล์กลับเข้าระบบ (เอกสารที่มีอยู่จะถูกแทนด้วยของในไฟล์ · เอกสารที่ไม่มีในไฟล์ไม่ถูกลบ) — ใช้เมื่อข้อมูลเสียหายเท่านั้น</div>
        ${pl ? `<div class="notice"><b>${esc(pl.file)}</b><br><span class="small">สำรองเมื่อ ${esc(when(pl.data.exportedAt))} โดย ${esc(pl.data.by || '')} · โปรเจกต์ ${esc(pl.data.project || '')}</span>
            <div class="small" style="margin-top:6px">${Object.entries(pl.counts).filter(([, n]) => n).map(([c, n]) => esc(c) + ' ' + n).join(' · ')}</div></div>
          ${pl.data.project && pl.data.project !== (C.firebase || {}).projectId ? `<div class="notice bad">ไฟล์นี้มาจากโปรเจกต์อื่น (${esc(pl.data.project)})</div>` : ''}
          <div class="field" style="margin-top:10px"><label class="f" for="bk-confirm">พิมพ์คำว่า <b>กู้คืน</b> เพื่อยืนยัน</label><input id="bk-confirm" class="in" autocomplete="off"></div>
          <div style="display:flex;gap:8px"><button class="btn" data-bk="cancel">ยกเลิก</button><button class="btn pri" style="background:var(--bad);border-color:var(--bad)" data-bk="restore" ${bk.busy ? 'disabled' : ''}>กู้คืนเข้าระบบ</button></div>`
        : `<label class="btn" for="bk-file">${ic('up')}เลือกไฟล์สำรอง (.json)</label><input type="file" id="bk-file" accept=".json,application/json" hidden ${admin() ? '' : 'disabled'}>`}</div>
    </div>
    <div class="card" style="margin-top:14px"><h2>สำรองอัตโนมัติรายวัน</h2><div class="muted small">ทำได้เมื่อเปลี่ยนโปรเจกต์เป็นแผน Blaze (จ่ายตามใช้) แล้วเปิด Scheduled backups ของ Firestore — ระหว่างนี้ใช้การดาวน์โหลดด้วยมือ</div></div>`; };
  document.addEventListener('click', e => { const t = e.target.closest('[data-bk]'); if (!t) return;
    if (t.dataset.bk === 'export') return exportAll(); if (t.dataset.bk === 'restore') return restoreRun(); if (t.dataset.bk === 'cancel') { bk.plan = null; return render(); } });
  document.addEventListener('change', e => { if (e.target.id === 'bk-file' && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ''; restorePick(f); } });
  /* สรุปคะแนนทั้งโรงเรียน: อ่านสมุดคะแนนทุกวิชาของภาคนี้ครั้งเดียว (ไม่ฟังสด) */
  async function fetchBooks() { const q = await db.collection('books').where('term', '==', termKey()).get(); return q.docs.map(d => { const x = d.data(); return { id: d.id, room: x.room, code: x.code, by: x.by, data: P_(x.j) }; }).filter(x => x.data); }
  window.EMSBackup = { exportAll, restorePick };
  { const it = ((window.EMSNav && EMSNav.NAVG.admin) || []).flatMap(g => g[1]).find(x => x[0] === 'a-drive'); if (it) it[1] = 'สำรองข้อมูล'; }

  /* ================= นักเรียน =================
     ครูเขียน stu/{เลขประจำตัว} ให้ (ผลเฉพาะวิชาที่เผยแพร่แล้ว + สรุปการมาเรียน) → นักเรียนอ่านได้เฉพาะเอกสารของตัวเอง (rules)
     ไม่ให้นักเรียนอ่านสมุดคะแนนตรง ๆ เพราะเอกสารสมุดมีคะแนนทั้งห้อง
     เขียนเฉพาะคนที่ผลเปลี่ยน (เทียบรหัสสรุปที่เก็บไว้ในสมุด b.__vh) และไม่ถี่กว่าทุก 5 นาที/เมื่อปิดหน้า */
  const studentId = email => { const dom = low(S.settings.studentDomain || (C.auth || {}).studentDomain || '').replace(/^@/, ''); if (!dom || !email.endsWith('@' + dom)) return '';
    const pat = low(S.settings.studentPattern || (C.auth || {}).studentPattern || '{id}'), local = email.split('@')[0];
    const m = local.match(new RegExp('^' + pat.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('\\{id\\}', '(\\d+)').replace('{id}', '(\\d+)') + '$')); return m ? m[1] : ''; };
  let viewsT = null;
  function scheduleViews() { if (viewsT || !started) return; viewsT = setTimeout(() => { viewsT = null; writeViews().catch(e => console.warn('EMS views', e)); }, 5 * 60 * 1000); }
  /* hr = true → เฉพาะเช็กชื่อแถวเช้า (ห้อง|วันที่|hr) · x = รายการ สาย/ลา/ขาด ล่าสุด 15 รายการ [วันที่, คาบ, สถานะ] ให้นักเรียนเห็นว่าวันไหน */
  function attSummary(cid, hr) {
    const out = {}; Object.keys(S.att || {}).forEach(k => { const [c, dt, p] = k.split('|'); if (c !== cid || (p === 'hr') !== !!hr) return; const rec = S.att[k] || {};
      Object.keys(rec).forEach(id => { if (id === '_by' || id === '_draft') return; const o = out[id] || (out[id] = { p: 0, s: 0, l: 0, c: 0, a: 0, n: 0, x: [] }); const v = rec[id]; if (o[v] === undefined) return; o[v]++; o.n++;
        if (v === 's' || v === 'l' || v === 'a') o.x.push([dt, p === 'hr' ? 'hr' : p, v]); }); });
    Object.values(out).forEach(o => { o.x.sort((a, b) => String(b[0]).localeCompare(a[0]) || String(b[1]).localeCompare(a[1])); o.x = o.x.slice(0, 15); });
    return out;
  }
  async function writeViews(now) {
    if (now) { clearTimeout(viewsT); viewsT = null; }
    if (!db || !user || !started || !window.EMSBook) return;
    const ann = !!S.settings.resultsAnnounced, tk = termKey(), w = [], rm = c => pastYear() ? {} : { room: c.name };      // ดูปีเก่า: ไม่เขียนชื่อห้องปีเก่าทับห้องปัจจุบันของนักเรียน
    S.classes.filter(c => c.subject && S.books[c.id] && ready['books:' + termKey() + '_' + c.id + '_' + codeOf(c.id)]).forEach(c => {
      const pub = ann || !!(S.published || {})[c.id];      // ยังไม่เผยแพร่ → ส่งเฉพาะเวลาเรียน (hidden) ให้นักเรียนเห็นการมาเรียนทันที
      const b = EMSBook.book(c.id), code = codeOf(c.id), att = attSummary(c.id), vh = b.__vh || (b.__vh = {});
      const subj = String(c.subject).replace(/^\S+\s*/, '') || c.subject;
      c.students.forEach(st => { const sid = String(st.sid || st.id || ''); if (!/^\d+$/.test(sid)) return;
        const r = EMSBook.calcRow(b, st), a = att[st.id] || null;
        const e = pub ? { code, name: subj, teacher: S.me.name, any: !!r.any, b: r.wBefore, m: r.wM, af: r.wAfter, f: ann ? r.wF : null, t: ann ? r.total : null, g: ann ? r.grade : null, ann, att: a } : { code, name: subj, teacher: S.me.name, hidden: true, att: a };
        const h = hash(J(e)); if (vh[sid] === h) return; vh[sid] = h;
        w.push(db.collection('stu').doc(sid).set(Object.assign({ sid, name: st.name }, rm(c), { terms: { [tk]: { [code]: e } }, by: me(), at: firebase.firestore.FieldValue.serverTimestamp() }), { merge: true }).catch(x => console.warn('stu', sid, x)));
      }); });
    /* แถวเช้า: ครูที่ปรึกษาส่งสรุปของห้องตัวเอง · จำรหัสสรุปไว้ในเครื่อง (ไม่มีสมุดให้เก็บ) */
    let hv = {}; try { hv = JSON.parse(localStorage.getItem('ems-hrvh') || '{}'); } catch (x) {}
    Object.entries(S.homeroom || {}).forEach(([cid, t]) => { if ([].concat(t || []).indexOf(S.me.name) < 0) return; const c = S.classes.find(x => x.id === cid); if (!c) return;
      const sum = attSummary(cid, true);
      c.students.forEach(st => { const sid = String(st.sid || st.id || ''), e = sum[st.id]; if (!/^\d+$/.test(sid) || !e) return;
        const k = tk + '|' + sid, h = hash(J(e)); if (hv[k] === h) return; hv[k] = h;
        w.push(db.collection('stu').doc(sid).set(Object.assign({ sid, name: st.name }, rm(c), { hr: { [tk]: e }, by: me(), at: firebase.firestore.FieldValue.serverTimestamp() }), { merge: true }).catch(x => { delete hv[k]; console.warn('stu hr', sid, x); }));
      }); });
    if (!w.length) return;
    await Promise.all(w); try { localStorage.setItem('ems-hrvh', JSON.stringify(hv)); } catch (x) {} dirty();            // บันทึกรหัสสรุป (b.__vh) ลงสมุด
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && viewsT) writeViews(true); });
  /* เผยแพร่/ประกาศผลแล้ว ส่งให้นักเรียนทันที ไม่ต้องรอ 5 นาที */
  document.addEventListener('click', e => { if (e.target.closest('[data-md="publish"],[data-act="pubToggle"],[data-ad="annOn"],[data-ad="annOff"]')) setTimeout(() => writeViews(true), 1500); });

  async function enterStudent(email, sid) {
    let pubDoc = null, d = null;
    try { const p = await db.collection('school').doc('public').get(); pubDoc = p.exists ? P_(p.data().j) || {} : {}; } catch (e) { pubDoc = {}; }
    if (pubDoc['settings.studentLogin'] === false) return gateMsg('<div class="notice bad">ขณะนี้ยังไม่เปิดให้นักเรียนเข้าสู่ระบบ</div><button class="btn sm" data-cl="out">ใช้บัญชีอื่น</button>');
    try { const x = await db.collection('stu').doc(sid).get(); d = x.exists ? x.data() : null; }
    catch (e) { return gateMsg('<span style="color:var(--bad)">อ่านข้อมูลนักเรียนไม่ได้ (' + esc(e.code || e.message) + ')</span>'); }
    if (!d) d = { sid, name: '', room: '', terms: {}, __none: true };      // ยังไม่มีครูส่งข้อมูล — ยังเข้าดูพฤติกรรม/จิตอาสาได้
    if (pubDoc.term) S.term = pubDoc.term;
    STU = d; await stuExtras(sid);
    if (!d.name) { const r = (STX.conduct[0] || STX.vol[0] || {}); d.name = r.name || 'นักเรียน ' + sid; d.room = d.room || r.className || ''; }
    S.me = { name: d.name, email, role: 'student', roles: ['student'], dept: d.room || '' };
    S.classes = [{ id: 'room', name: d.room || '', subject: '', students: [{ id: sid, sid, no: 1, name: d.name }] }]; S.student = { classId: 'room', id: sid };
    started = false; entered = true;
    try { sessionStorage.setItem('ems-auth', '1'); } catch (x) {}
    S.view = 'student'; showGate(false); closeModal(); page = 's-home'; render(); scrollTo(0, 0); if (window.EMSPreload) EMSPreload.hide();
    toast('ยินดีต้อนรับ ' + d.name);
  }
  let STU = null, STX = { cfg: null, conduct: [], vol: [], err: '' };
  /* ข้อมูลที่นักเรียนอ่านเองได้ตาม rules: เกณฑ์คะแนนพฤติกรรม (school/affairs) · รายการพฤติกรรม/จิตอาสาของตัวเอง (where sid ==) */
  async function stuExtras(sid) {
    const X = { cfg: null, conduct: [], vol: [], err: '' }, bad = e => { X.err = (e && (e.code || e.message)) || 'error'; console.warn('EMS stu', e); };
    await Promise.all([
      db.collection('school').doc('affairs').get().then(d => { const v = d.exists ? P_(d.data().j) : null; X.cfg = (v && v['affairs.cfg']) || null; }).catch(bad),
      db.collection('conduct').where('sid', '==', sid).get().then(q => { X.conduct = q.docs.map(d => P_(d.data().j)).filter(Boolean); }).catch(bad),
      db.collection('volunteer').where('sid', '==', sid).get().then(q => { X.vol = q.docs.map(d => Object.assign(P_(d.data().j) || {}, { _doc: d.id })).filter(v => v.id); }).catch(bad)]);
    STX = X;
  }
  /* ส่งคำขอชั่วโมงจิตอาสา (st=pending) — ครู/ฝ่ายกิจการฯ อนุมัติที่หน้ากิจการนักเรียน › จิตอาสา */
  async function submitVol(r) {
    const em = me() || low((fb.auth.currentUser || {}).email), id = 'vo_' + STU.sid + '_' + Date.now().toString(36);
    const rec = Object.assign({ id, sid: STU.sid, name: STU.name, className: STU.room || '', st: 'pending', src: 'student', by: STU.name, at: new Date().toISOString() }, r);
    await db.collection('volunteer').doc(id).set({ j: J(rec), o: 0, sid: STU.sid, st: 'pending', by: em, at: firebase.firestore.FieldValue.serverTimestamp() });
    await stuExtras(STU.sid);
  }
  async function cancelVol(docId) { await db.collection('volunteer').doc(docId).delete(); await stuExtras(STU.sid); }
  window.EMSStu = { on: () => !!STU, stu: () => STU, x: () => STX, term: () => termKey(), refresh: async () => { if (STU) { await stuExtras(STU.sid); render(); } }, submitVol, cancelVol };
  const stuSubj = () => { const t = (STU && STU.terms && STU.terms[termKey()]) || {}; return Object.values(t).sort((a, b) => String(a.code).localeCompare(String(b.code), 'th')); };
  const pct = a => a && a.n ? Math.round((a.p + a.s + a.c) * 100 / a.n) : null;
  const fmt = v => v == null || v === '' ? '–' : (Math.round(v * 10) / 10);
  const termTxt = () => 'ภาคเรียนที่ ' + esc(S.term.sem || '') + '/' + esc(S.term.year || '');
  const baseS = { home: P['s-home'], scores: P['s-scores'], att: P['s-att'] };
  P['s-home'] = () => { if (!STU) return baseS.home(); const L = stuSubj(), shown = L.filter(x => !x.hidden), ps = L.map(x => pct(x.att)).filter(x => x != null);
    return `<div class="top"><div><h1>สวัสดี ${esc(String(STU.name).replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง)/, '').split(' ')[0])}</h1><p>นักเรียน ${esc(STU.room || '')} · เลขประจำตัว ${esc(STU.sid)} · ${termTxt()}</p></div></div>
      <div class="grid g3"><div class="card kpi"><div class="l">วิชาที่เผยแพร่ผลแล้ว</div><div class="v">${shown.length}/${L.length}</div></div>
        <div class="card kpi"><div class="l">มาเรียนเฉลี่ย</div><div class="v">${ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) + '%' : '–'}</div><div class="s muted">ทุกวิชาที่ครูเช็กชื่อ</div></div>
        <div class="card kpi"><div class="l">ประกาศผลทางการ</div><div class="v" style="font-size:1.2rem;padding:6px 0">${L.some(x => x.ann) ? 'ประกาศแล้ว' : 'ยังไม่ประกาศ'}</div></div></div>
      <div class="card" style="margin-top:14px"><button class="btn pri" data-act="go" data-p="s-scores">ดูคะแนน</button> <button class="btn" data-act="go" data-p="s-att">ดูเวลาเรียน</button></div>`; };
  P['s-scores'] = () => { if (!STU) return baseS.scores(); const L = stuSubj();
    return `<div class="top"><div><h1>คะแนนของฉัน</h1><p>${termTxt()} · คะแนนปลายภาค คะแนนรวม และเกรด แสดงเมื่อโรงเรียนประกาศผล</p></div></div>
      <div class="card">${L.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>วิชา</th><th>ก่อนกลางภาค</th><th>กลางภาค</th><th>หลังกลางภาค</th><th>ปลายภาค</th><th>รวม</th><th>เกรด</th></tr></thead><tbody>${L.map(x => `<tr><td><b>${esc(x.code)}</b> ${esc(x.name)}<div class="muted small">${esc(x.teacher || '')}</div></td>${x.hidden ? '<td colspan="6" class="muted">ครูยังไม่เผยแพร่ผล</td>'
        : `<td>${fmt(x.b)}</td><td>${fmt(x.m)}</td><td>${fmt(x.af)}</td><td>${fmt(x.f)}</td><td><b>${fmt(x.t)}</b></td><td>${x.g != null ? chip(esc(x.g), String(x.g) === '0' || /ร|มส/.test(x.g) ? 'bad' : 'ok') : '–'}</td>`}</tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">ยังไม่มีวิชาที่ครูเผยแพร่ผล</div>'}</div>`; };
  P['s-att'] = () => { if (!STU) return baseS.att(); const L = stuSubj().filter(x => x.att);
    return `<div class="top"><div><h1>เวลาเรียน</h1><p>${termTxt()} · นับจากคาบที่ครูเช็กชื่อแล้ว · เกณฑ์ผ่าน 80%</p></div></div>
      <div class="card">${L.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>วิชา</th><th style="text-align:right">มา</th><th style="text-align:right">สาย</th><th style="text-align:right">ลา</th><th style="text-align:right">ขาด</th><th style="text-align:right">มาเรียน</th></tr></thead><tbody>${L.map(x => { const p = pct(x.att);
        return `<tr><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td style="text-align:right">${x.att.p + x.att.c}</td><td style="text-align:right">${x.att.s}</td><td style="text-align:right">${x.att.l}</td><td style="text-align:right">${x.att.a}</td><td style="text-align:right">${p == null ? '–' : chip(p + '%', p >= 80 ? 'ok' : 'bad')}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="empty">ยังไม่มีข้อมูลเวลาเรียน</div>'}</div>`; };

  /* มุมมองที่บัญชีนี้เปิดได้ (โหมดจริงไม่มีการสลับเป็นนักเรียน/แอดมินเองถ้าไม่มีบทบาท) */
  window.EMSAllowedViews = () => S.view === 'student' ? ['student'] : (roles().some(r => ADMIN_ROLES.indexOf(r) >= 0) || isBoot() ? ['teacher', 'admin'] : ['teacher']);

  window.EMSCloud = { dirty, flush, writeViews, fetchBooks, status, submitContact, signOut, ready, rosterOk, _last: last,
    condReady: hr => !!ready.conduct && (!hr || !!ready.hrDaily || !SL.find(s => s.id === 'hrDaily').lazy()),      // กิจการนักเรียนได้ข้อมูลรอบแรกแล้ว (บันทึกก่อนนี้ = รายการถูก snapshot ทับหาย) · hr = รวมยอดแถวเช้าถ้าฟังอยู่
    bookReady: cid => !!ready['books:' + SL.find(s => s.id === 'books').docId(cid)],      // สมุดของห้องโหลดจากระบบแล้ว (course.js)
    db: () => db, ttKey: () => (ready.tt ? (SL.find(s => s.id === 'tt') || {}).__tk || '' : ''), idToken: () => fb && fb.auth.currentUser ? fb.auth.currentUser.getIdToken() : Promise.reject(new Error('ต้องเข้าสู่ระบบ EMS ด้วยบัญชี Google ก่อน')), email: () => low(((fb && fb.auth.currentUser) || {}).email) };
  showGate(true); gateMsg('กำลังตรวจสอบการเข้าสู่ระบบ…');
  init().then(() => fb.auth.onAuthStateChanged(onUser)).catch(e => gateMsg('<span style="color:var(--bad)">เชื่อม Firebase ไม่ได้: ' + esc(e.message) + '</span>'));
})();
