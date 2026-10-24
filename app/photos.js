/* EMS — รูปนักเรียน + เลขประจำตัวในหน้าเช็กชื่อ/กรอกคะแนน
   ที่เก็บรูป (ออกแบบให้เบาที่สุด):
   - ย่อรูปในเครื่องก่อนเก็บเสมอ: ครอปหน้าตรง 3:4 ขนาด 150×200 px JPEG ≈ 8–15 KB ต่อคน (นักเรียน 2,000 คน ≈ 25 MB)
   - ระบบจริง: Firebase Storage ของโปรเจกต์ dss-pc ที่ photos/{เลขประจำตัว}.jpg อ่านได้เฉพาะบัญชีโรงเรียนที่ล็อกอิน
     (ไม่เก็บใน Firestore เพราะคิดค่าอ่านทุกครั้ง และไม่เก็บใน Drive เพราะสิทธิ์ drive.file ทำให้ครูคนอื่นเปิดไม่ได้)
   - ทุกเครื่องเก็บสำเนาไว้ใน IndexedDB — โหลดรูปแต่ละคนครั้งเดียว ครั้งต่อไปเปิดจากเครื่องทันที ไม่กินเน็ตและไม่กินโควตา
   ต้นแบบนี้ยังไม่เชื่อม Firebase จึงใช้ IndexedDB อย่างเดียว (จุดต่อระบบจริงอยู่ที่ store.remote*)
   ตั้งชื่อไฟล์รูปเป็นเลขประจำตัว เช่น 12345.jpg แล้วนำเข้าหลายไฟล์พร้อมกัน ระบบจับคู่ให้เอง */
(() => {
const keyOf = s => String(s.sid || s.id || '');
const DB_NAME = 'ems-photos', ST = 'p';
let dbp = null;
const db = () => dbp || (dbp = new Promise((ok, no) => { try { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }));
const tx = (mode, fn) => db().then(d => new Promise((ok, no) => { const t = d.transaction(ST, mode), s = t.objectStore(ST), r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }));
const store = {
  keys: () => tx('readonly', s => s.getAllKeys()),
  get: k => tx('readonly', s => s.get(k)),
  put: (k, blob) => tx('readwrite', s => s.put(blob, k)),
  del: k => tx('readwrite', s => s.delete(k))
  /* ระบบจริง: remoteGet(k) → getDownloadURL(ref(storage, 'photos/' + k + '.jpg')) แล้ว fetch → put ลง IndexedDB
                remotePut(k, blob) → uploadBytes(ref(storage, 'photos/' + k + '.jpg'), blob, { contentType: 'image/jpeg' }) */
};
const HAS = new Set(), URLS = new Map();
store.keys().then(ks => { (ks || []).forEach(k => HAS.add(String(k))); if (ks && ks.length) render(); }).catch(() => {});

/** ย่อและครอปรูปเป็น 150×200 (3:4) เพื่อให้ไฟล์เล็ก โหลดไว */
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('ไฟล์นี้ไม่ใช่รูปภาพ')); i.src = url; });
    const W = 150, H = 200, r = W / H, sr = img.width / img.height;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (sr > r) { sw = img.height * r; sx = (img.width - sw) / 2; } else { sh = img.width / r; sy = Math.max(0, (img.height - sh) * 0.3); }   // รูปแนวตั้งเก็บส่วนบน (ใบหน้า) ไว้
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}
async function urlOf(k) {
  if (URLS.has(k)) return URLS.get(k);
  const b = await store.get(k); if (!b) return '';
  const u = URL.createObjectURL(b); URLS.set(k, u); return u;
}
async function save(k, blob) { await store.put(k, blob); HAS.add(k); if (URLS.has(k)) { URL.revokeObjectURL(URLS.get(k)); URLS.delete(k); } }
async function remove(k) { await store.del(k); HAS.delete(k); if (URLS.has(k)) { URL.revokeObjectURL(URLS.get(k)); URLS.delete(k); } }

const on = () => S.prefs.showPhotos !== false;
const ini = s => esc(String(s.name || '?').trim().charAt(0));
/** รูปเล็กข้างชื่อ — ยังไม่มีรูปแสดงอักษรตัวแรกแทน */
const img = (s, cls = '') => { const k = keyOf(s);
  return HAS.has(k) ? `<img class="ph ${cls}" data-ph="${esc(k)}" alt="รูป ${esc(s.name)}" loading="lazy">` : `<span class="ph ph-i ${cls}" aria-hidden="true">${ini(s)}</span>`; };
const idLine = s => `<span class="sid">${esc(keyOf(s))}</span>`;
function hydrate() {
  document.querySelectorAll('img[data-ph]:not([src])').forEach(el => urlOf(el.dataset.ph).then(u => { if (u) el.src = u; }));
}
const all = () => S.classes.flatMap(c => c.students.map(s => ({ s, c })));
const findKey = k => all().find(x => keyOf(x.s) === k || String(x.s.id) === k);

/* ---------- หน้าเช็กชื่อ: รูป + เลขประจำตัว ---------- */
const baseAtt = P.attendance;
P.attendance = () => {
  let h = baseAtt();
  const byNo = {}; S.classes.forEach(c => c.students.forEach(s => { byNo[c.id + '|' + s.id] = s; }));
  /* แถวนักเรียน: ใส่รูป (แตะเพื่อดูรูปใหญ่) และเลขประจำตัวใต้ชื่อ */
  return h.replace(/<div class="att-row" data-st="([^"]*)"><span class="muted small">(\d+)<\/span><span class="nm">([\s\S]*?)<\/span>\s*<span class="att-btns" role="group" aria-label="สถานะ ([^"]*)">([\s\S]*?)data-s="([^"]+)"/g,
    (m, st, no, nm, lab, rest, sid) => { const x = all().find(y => String(y.s.id) === sid); if (!x) return m;
      return `<div class="att-row${on() ? ' with-ph' : ''}" data-st="${st}"><span class="muted small">${no}</span>${on() ? `<button class="ph-btn" data-phv="${esc(keyOf(x.s))}" aria-label="ดูรูป ${esc(x.s.name)}">${img(x.s)}</button>` : ''}<span class="nm"><span>${nm}</span>${idLine(x.s)}</span>
        <span class="att-btns" role="group" aria-label="สถานะ ${lab}">${rest}data-s="${sid}"`; })
    .replace('<div class="att-head"><span class="muted small">ที่</span><span class="muted small">ชื่อ-สกุล</span>',
      `<div class="att-head${on() ? ' with-ph' : ''}"><span class="muted small">ที่</span>${on() ? '<span class="muted small">รูป</span>' : ''}<span class="muted small">ชื่อ-สกุล · เลขประจำตัว</span>`);
};

/* ---------- หน้ากรอกคะแนน: เลขประจำตัวใต้ชื่อ ---------- */
const baseScores = P.scores;
P.scores = () => baseScores().replace(/<tr data-sid="([^"]+)"><td class="muted k1">(\d+)<\/td><td class="k2">([^<]*)<\/td>/g, (m, sid, no, nm) => {
  const x = all().find(y => String(y.s.id) === sid); if (!x) return m;
  return `<tr data-sid="${sid}"><td class="muted k1">${no}</td><td class="k2">${nm}${idLine(x.s)}</td>`; })
  .replace(/<th class="k2" rowspan="(\d)">ชื่อ-สกุล<\/th>/, '<th class="k2" rowspan="$1">ชื่อ-สกุล · เลขประจำตัว</th>');

/* ---------- ฐานนักเรียน: คอลัมน์รูป + นำเข้ารูปหลายไฟล์ ---------- */
const baseStu = P['a-students'];
P['a-students'] = () => {
  const n = all().length, have = all().filter(x => HAS.has(keyOf(x.s))).length;
  return baseStu()
    .replace('<button class="btn pri" data-act="stAdd">', `<button class="btn" data-phb="bulk">${ic('up')}นำเข้ารูปนักเรียน</button>$&`)
    .replace(/<div class="row"[^>]*>(?=\s*<select[^>]*data-st-cls)/, m => `<div class="notice" style="background:var(--info-soft)">รูปนักเรียน <b>${have}/${n}</b> คน · ตั้งชื่อไฟล์เป็นเลขประจำตัว เช่น <b>12345.jpg</b> แล้วกด “นำเข้ารูปนักเรียน” เลือกได้ทีละหลายไฟล์ ระบบย่อรูปและจับคู่ให้เอง · แตะรูปในตารางเพื่อเปลี่ยนรายคน</div>` + m)
    .replace(/<th>เลขที่<\/th>/g, '<th>รูป</th><th>เลขที่</th>')
    .replace(/<tr data-row data-c="([^"]+)" data-sid="([^"]+)">/g, (m, c, sid) => { const k = cls(c), s = k && k.students.find(x => x.id === sid); if (!s) return m;
      return `${m}<td><button class="ph-btn" data-phe="${esc(keyOf(s))}" aria-label="รูป ${esc(s.name)}">${img(s, 'ph-md')}</button></td>`; });
};

/* ---------- ตัวเลือก ---------- */
const basePrefs = P.prefs;
P.prefs = () => basePrefs().replace('<div class="card"><h2>ตัวอย่าง</h2>', `<div class="card"><h2>นักเรียน</h2><label class="pf-tog"><input type="checkbox" data-pf="tog" data-k="showPhotos" ${on() ? 'checked' : ''}><span><b>แสดงรูปนักเรียนตอนเช็กชื่อ</b><br><span class="muted small">แตะรูปเพื่อดูภาพใหญ่ · ปิดได้ถ้าต้องการรายการที่สั้นลง</span></span></label></div><div class="card"><h2>ตัวอย่าง</h2>`);

/* ---------- นำเข้า / แก้รูป ---------- */
let BULK = [], ONE = '';
const picker = (multi, cb) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = multi; i.onchange = () => cb([...i.files]); i.click(); };
function bulkPreview(files) {
  BULK = files.map(f => { const k = f.name.replace(/\.[^.]+$/, '').match(/\d{3,}/), x = k ? findKey(k[0]) : null; return { f, k: k ? k[0] : '', x }; });
  const ok = BULK.filter(b => b.x), bad = BULK.filter(b => !b.x);
  modal(`<h2 style="margin-bottom:6px">นำเข้ารูปนักเรียน</h2><p class="muted small" style="margin-bottom:10px">จับคู่จากเลขในชื่อไฟล์กับเลขประจำตัว · รูปจะถูกย่อเหลือ 150×200 px ก่อนเก็บ (ประมาณ 10 KB ต่อคน)</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><span class="chip ok">จับคู่ได้ ${ok.length}</span>${bad.length ? `<span class="chip bad">ไม่พบนักเรียน ${bad.length}</span>` : ''}${ok.filter(b => HAS.has(keyOf(b.x.s))).length ? `<span class="chip warn">แทนรูปเดิม ${ok.filter(b => HAS.has(keyOf(b.x.s))).length}</span>` : ''}</div>
    <div class="scroll" style="max-height:46vh"><table class="tbl"><thead><tr><th>ไฟล์</th><th>นักเรียน</th></tr></thead><tbody>${BULK.map(b => `<tr><td class="small">${esc(b.f.name)}</td><td>${b.x ? `${esc(b.x.s.name)} <span class="muted small">${esc(b.x.c.name)} · ${esc(keyOf(b.x.s))}</span>` : '<span class="chip bad">ไม่พบเลขประจำตัวนี้</span>'}</td></tr>`).join('')}</tbody></table></div>
    <button class="btn pri" style="width:100%;margin-top:12px" data-phb="bulkOk" ${ok.length ? '' : 'disabled'}>บันทึกรูป ${ok.length} คน</button>`);
}
function viewer(k, edit) {
  const x = findKey(k); if (!x) return;
  modal(`<div style="text-align:center"><div class="ph-big">${HAS.has(k) ? `<img class="ph" data-ph="${esc(k)}" alt="รูป ${esc(x.s.name)}">` : `<span class="ph ph-i">${ini(x.s)}</span>`}</div>
    <h2 style="margin-top:10px">${esc(x.s.name)}</h2><div class="muted">${esc(x.c.name)} · เลขที่ ${x.s.no} · เลขประจำตัว ${esc(keyOf(x.s))}</div>
    ${edit ? `<div style="display:flex;gap:8px;justify-content:center;margin-top:14px"><button class="btn pri" data-phb="one" data-k="${esc(k)}">${ic('up')}${HAS.has(k) ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}</button>${HAS.has(k) ? `<button class="btn" style="color:var(--bad)" data-phb="del" data-k="${esc(k)}">ลบรูป</button>` : ''}</div>` : ''}</div>`, true);
  const s = $('#layer .sheet'); if (s) s.style.maxWidth = '340px';
  hydrate();
}
document.addEventListener('click', async e => {
  const v = e.target.closest('[data-phv]'); if (v) return viewer(v.dataset.phv, false);
  const ed = e.target.closest('[data-phe]'); if (ed) return viewer(ed.dataset.phe, true);
  const t = e.target.closest('[data-phb]'); if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.phb === 'bulk') return picker(true, fs => fs.length && bulkPreview(fs));
  if (d.phb === 'bulkOk') { t.disabled = true; t.textContent = 'กำลังย่อและบันทึกรูป…'; let n = 0, fail = 0;
    for (const b of BULK.filter(b => b.x)) { try { await save(keyOf(b.x.s), await shrink(b.f)); n++; } catch (er) { fail++; } }
    BULK = []; closeModal(); toast('บันทึกรูปนักเรียน ' + n + ' คนแล้ว' + (fail ? ' · อ่านไฟล์ไม่ได้ ' + fail + ' ไฟล์' : '')); return render(); }
  if (d.phb === 'one') { ONE = d.k; return picker(false, async fs => { if (!fs[0]) return; try { await save(ONE, await shrink(fs[0])); closeModal(); toast('บันทึกรูปแล้ว'); render(); } catch (er) { toast(er.message || 'บันทึกรูปไม่สำเร็จ'); } }); }
  if (d.phb === 'del') { await remove(d.k); closeModal(); toast('ลบรูปแล้ว'); return render(); }
});

/* วาดหน้าเสร็จแล้วค่อยเติมรูป (อ่านจาก IndexedDB เฉพาะรูปที่อยู่บนจอ) */
const baseRender = window.render;
window.render = function () { const r = baseRender.apply(this, arguments); hydrate(); return r; };

const st = document.createElement('style');
st.textContent = `
.ph{width:36px;height:48px;border-radius:8px;object-fit:cover;display:block;background:var(--surface2);flex:none}
.ph-i{display:grid;place-items:center;font-weight:700;color:var(--brand);background:var(--brand-soft);font-size:1rem}
.ph-md{width:42px;height:56px}
.ph-btn{border:0;background:none;padding:0;cursor:zoom-in;border-radius:8px}
.ph-btn:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.ph-big .ph{width:180px;height:240px;margin:0 auto;border-radius:14px;font-size:3rem}
.sid{display:block;font-size:.76rem;color:var(--muted);font-weight:500;font-variant-numeric:tabular-nums;line-height:1.2}
.att-row .nm{display:flex;flex-direction:column;justify-content:center;min-width:0}
.att-head.with-ph,.att-row.with-ph{grid-template-columns:30px 40px minmax(0,1fr) auto}
.sc-tbl .k2 .sid{margin-top:1px}
@media(max-width:600px){
  .att-head.with-ph,.att-row.with-ph{grid-template-columns:26px 40px minmax(0,1fr)}
  .att-row.with-ph .att-btns,.att-head.with-ph .att-btns{grid-column:1/-1}
}
:root[data-density="compact"] .att-row .ph{width:30px;height:40px}
@media(min-width:861px){#att-panel > div[style*="sticky"]{bottom:0!important;border-top:1px solid var(--line);margin-bottom:-18px;padding:10px 0 12px!important}}
`;
document.head.appendChild(st);
window.EMSPhotos = { img, keyOf, shrink, save, remove, has: k => HAS.has(k), hydrate, importFiles: bulkPreview };
})();
