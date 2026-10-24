/* EMS — ปรับแต่งการแสดงผล (โหมดรูปแบบที่เลือกและปรับแต่งได้)
   ธีม · สีหลัก · ขนาดตัวอักษร · ความหนาแน่น · มุมโค้ง · รูปแบบเมนู · สไตล์สำเร็จรูป
   และตัวเลือกการกรอกคะแนน (สถานะผ่าน/ไม่ผ่านรายส่วน, สีแดงเมื่อต่ำกว่าเกณฑ์, กรอกด้วยเสียง)
   โหลดก่อน book.js เพื่อให้ค่าถูกใช้ตั้งแต่เรนเดอร์แรก */
(() => {
const DEF = { theme: 'auto', density: 'comfortable', fontSize: 'md', accent: 'maroon', radius: 'md', nav: 'full',
  showUnitStatus: true, redLow: true, voice: true };
S.prefs = Object.assign({}, DEF, S.prefs || {});

const ACCENTS = {
  maroon: ['เลือดหมูสุภาพ (ตราโรงเรียน)', '#9a2f3f', '#fcf4f6', '#f4a9a9', '#3a1f23'],
  blue: ['น้ำเงิน', '#1f4f99', '#e4eefa', '#7db4f5', '#14283f'],
  green: ['เขียว', '#1f7a4d', '#e3f3ea', '#5fd09a', '#173225'],
  purple: ['ม่วง', '#6b3fa0', '#efe7fa', '#c3a4f0', '#2b1f40'],
  teal: ['เขียวน้ำทะเล', '#0f766e', '#d9f2ef', '#5ad1c6', '#12302d'],
  orange: ['ส้ม', '#b45309', '#fdecd6', '#f0a54f', '#3a2410']
};
const PRESETS = [
  ['standard', 'มาตรฐาน', 'สมดุล อ่านสบาย', { density: 'comfortable', fontSize: 'md', accent: 'maroon', radius: 'md', nav: 'full' }],
  ['compact', 'กะทัดรัด (กรอกคะแนน)', 'เห็นข้อมูลต่อหน้ามากที่สุด เมนูเป็นไอคอน', { density: 'compact', fontSize: 'sm', radius: 'sharp', nav: 'rail' }],
  ['large', 'ตัวใหญ่ อ่านง่าย', 'ตัวอักษรใหญ่ ปุ่มโต เหมาะกับจอเล็กหรือสายตา', { density: 'spacious', fontSize: 'xl', radius: 'round', nav: 'full' }],
  ['night', 'โหมดกลางคืน', 'พื้นหลังมืด ถนอมสายตา', { theme: 'dark', density: 'comfortable', fontSize: 'md', radius: 'md', nav: 'full' }],
  ['fresh', 'สดใส', 'โทนเขียวน้ำทะเล มุมโค้งมน', { accent: 'teal', radius: 'round', density: 'comfortable', fontSize: 'md', nav: 'full' }]
];
const LBL = {
  theme: [['auto', 'ตามอุปกรณ์'], ['light', 'สว่าง'], ['dark', 'มืด']],
  fontSize: [['sm', 'เล็ก'], ['md', 'ปกติ'], ['lg', 'ใหญ่'], ['xl', 'ใหญ่มาก']],
  density: [['compact', 'แน่น'], ['comfortable', 'ปกติ'], ['spacious', 'โปร่ง']],
  radius: [['sharp', 'เหลี่ยม'], ['md', 'ปกติ'], ['round', 'มน']],
  nav: [['full', 'เมนูเต็ม'], ['rail', 'เมนูไอคอน']]
};

/* ---------- CSS ---------- */
const css = document.createElement('style');
let c = `
:root[data-fs="sm"]{font-size:14.5px} :root[data-fs="lg"]{font-size:18px} :root[data-fs="xl"]{font-size:20px}
:root[data-fs] body{font-size:1rem}
:root[data-radius="sharp"]{--r:6px} :root[data-radius="round"]{--r:22px}
:root[data-radius="sharp"] .btn,:root[data-radius="sharp"] .in,:root[data-radius="sharp"] .pill,:root[data-radius="sharp"] .nav{border-radius:6px}
:root[data-radius="round"] .btn,:root[data-radius="round"] .in{border-radius:16px}
:root[data-density="compact"] .card{padding:12px}
:root[data-density="compact"] .row{padding:6px 0}
:root[data-density="compact"] .in{min-height:36px;padding:4px 10px}
:root[data-density="compact"] .btn{min-height:36px;padding:5px 12px}
:root[data-density="compact"] .btn.sm{min-height:30px}
:root[data-density="compact"] .tbl td,:root[data-density="compact"] .tbl th{padding:3px 8px}
:root[data-density="compact"] .tbl input.in,:root[data-density="compact"] .sc-tbl input.in{min-height:32px}
:root[data-density="compact"] .nav{padding:6px 12px}
:root[data-density="compact"] .att-row{padding:3px 0}
:root[data-density="compact"] .ab{min-height:32px}
:root[data-density="compact"] main{padding-top:16px}
:root[data-density="compact"] .top{margin-bottom:12px}
:root[data-density="spacious"] .card{padding:26px}
:root[data-density="spacious"] .row{padding:16px 0}
:root[data-density="spacious"] .in{min-height:50px}
:root[data-density="spacious"] .btn{min-height:50px;padding:11px 20px}
:root[data-density="spacious"] .tbl td{padding:12px 12px}
:root[data-density="spacious"] .nav{padding:13px 14px}
:root[data-nav="rail"] .app{grid-template-columns:78px 1fr}
:root[data-nav="rail"] .side{padding:14px 8px;align-items:center}
:root[data-nav="rail"] .brand{padding:4px 0 12px}
:root[data-nav="rail"] .brand > div,:root[data-nav="rail"] .navgroup,:root[data-nav="rail"] .who > div:not(.avatar),:root[data-nav="rail"] .side .field{display:none}
:root[data-nav="rail"] .nav{width:52px;height:46px;justify-content:center;padding:0;position:relative}
:root[data-nav="rail"] .nav span:not(.dot){display:none}
:root[data-nav="rail"] .nav .dot{position:absolute;top:2px;right:2px;margin:0;min-width:16px;height:16px;font-size:.62rem}
:root[data-nav="rail"] .who{padding:6px;border:0;background:none}
:root[data-accent]:not([data-accent="maroon"]) .next{background:var(--brand)}
.pf-sw{width:44px;height:44px;border-radius:50%;border:3px solid transparent;cursor:pointer;display:grid;place-items:center;color:#fff;font-weight:700}
.pf-sw[aria-pressed="true"]{border-color:var(--text);box-shadow:0 0 0 2px var(--surface) inset}
.pf-pre{text-align:left;padding:14px;border:2px solid var(--line);border-radius:var(--r);background:var(--surface);min-height:84px}
.pf-pre[aria-pressed="true"]{border-color:var(--brand);background:var(--brand-soft)}
.pf-sw:focus-visible,.pf-pre:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.pf-tog{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line);cursor:pointer}
.pf-tog:first-of-type{border-top:0}
.pf-tog input{width:22px;height:22px;accent-color:var(--brand);margin-top:3px;flex:none}
`;
Object.entries(ACCENTS).forEach(([k, a]) => {
  if (k === 'maroon') return;
  c += `:root[data-accent="${k}"][data-scheme="light"]{--brand:${a[1]};--brand-soft:${a[2]};--brand-ink:#fff}\n`;
  c += `:root[data-accent="${k}"][data-scheme="dark"]{--brand:${a[3]};--brand-soft:${a[4]};--brand-ink:#14100c}\n`;
});
css.textContent = c;
document.head.appendChild(css);

/* ---------- นำไปใช้ ---------- */
const root = document.documentElement;
const dark = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme:dark)').matches);
const scheme = () => { const s = dark() ? 'dark' : 'light'; if (root.dataset.scheme !== s) root.dataset.scheme = s; };
function apply() {
  const p = S.prefs;
  root.dataset.fs = p.fontSize; root.dataset.density = p.density; root.dataset.radius = p.radius; root.dataset.nav = p.nav; root.dataset.accent = p.accent;
  if (p.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = p.theme;
  try { if (p.theme === 'auto') localStorage.removeItem('ems-theme'); else localStorage.setItem('ems-theme', p.theme); } catch (e) {}
  scheme();
}
new MutationObserver(() => {                                 // ปุ่มสลับโหมดมืด/สว่างในเมนู
  scheme();
  const t = root.dataset.theme || 'auto';
  if (S.prefs.theme !== t) { S.prefs.theme = t; save(); }
}).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', scheme);
new MutationObserver(() => { if (root.dataset.nav === 'rail') document.querySelectorAll('#side .nav').forEach(b => { const s = b.querySelector('span:not(.dot)'); if (s) b.title = s.textContent; }); })
  .observe(document.getElementById('side'), { childList: true });
apply();

window.EMSPrefs = {
  get: k => S.prefs[k],
  set(k, v) { S.prefs[k] = v; save(); apply(); }
};

/* ---------- หน้าปรับแต่ง ---------- */
const seg = (k, label) => `<div class="field"><div class="f">${label}</div><div class="pills" role="group" aria-label="${label}">${LBL[k].map(([v, l]) => `<button class="pill" aria-pressed="${S.prefs[k] === v}" data-pf="set" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
const toggle = (k, t, d) => `<label class="pf-tog"><input type="checkbox" data-pf="tog" data-k="${k}" ${S.prefs[k] ? 'checked' : ''}><span><b>${t}</b><br><span class="muted small">${d}</span></span></label>`;
P.prefs = () => {
  const p = S.prefs;
  return `<div class="top"><div><h1>ปรับแต่งการแสดงผล</h1><p>เลือกสไตล์สำเร็จรูป หรือปรับเองทีละอย่าง · เปลี่ยนแล้วเห็นผลทันที และจำค่าไว้ในเครื่องนี้</p></div>
      <button class="btn" data-pf="reset">คืนค่ามาตรฐาน</button></div>
    <div class="card"><h2>สไตล์สำเร็จรูป</h2><div class="grid g3">${PRESETS.map(([k, n, d, v]) => {
      const on = Object.entries(v).every(([a, b]) => p[a] === b);
      return `<button class="pf-pre" aria-pressed="${on}" data-pf="preset" data-k="${k}"><b>${n}</b><div class="muted small">${d}</div></button>`; }).join('')}</div></div>
    <div class="grid g2" style="align-items:start;margin-top:16px">
      <div class="card" style="margin-top:0"><h2>ลักษณะทั่วไป</h2>${seg('theme', 'ธีม')}${window.EMSType ? EMSType.html() : ''}${seg('fontSize', 'ขนาดตัวอักษร')}${seg('density', 'ความหนาแน่นของหน้า')}${seg('radius', 'มุมของการ์ดและปุ่ม')}${seg('nav', 'รูปแบบเมนูด้านข้าง (คอม/แท็บเล็ต)')}
        <div class="field"><div class="f">สีหลัก</div><div style="display:flex;gap:10px;flex-wrap:wrap">${Object.entries(ACCENTS).map(([k, a]) =>
          `<button class="pf-sw" style="background:${a[1]}" aria-pressed="${p.accent === k}" data-pf="set" data-k="accent" data-v="${k}" title="${a[0]}" aria-label="${a[0]}">${p.accent === k ? '✓' : ''}</button>`).join('')}</div></div></div>
      <div class="card" style="margin-top:0"><h2>การกรอกคะแนน</h2>
        ${toggle('showUnitStatus', 'แสดงสถานะ ผ่าน / ไม่ผ่าน รายส่วนและรายหน่วย', 'ก่อนกลางภาค กลางภาค หลังกลางภาค ปลายภาค และหัวข้อสอบวัดผลรายหน่วย — ปิดได้ถ้าไม่ต้องการ')}
        ${toggle('redLow', 'แสดงคะแนนที่ต่ำกว่าเกณฑ์ผ่านเป็นสีแดง', 'ใช้เกณฑ์ผ่านรายส่วนของวิชา (ค่าเริ่มต้น 60%) ตั้งได้ที่หน้า “หัวข้อคะแนน”')}
        ${toggle('voice', 'แสดงปุ่มกรอกคะแนนด้วยเสียง', 'ใช้ได้กับ Chrome / Edge (ต้องอนุญาตไมโครโฟนและต่ออินเทอร์เน็ต)')}</div></div>
    <div class="card"><h2>ตัวอย่าง</h2><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn pri">ปุ่มหลัก</button><button class="btn">ปุ่มรอง</button><span class="chip ok">ผ่าน</span><span class="chip bad">ไม่ผ่าน</span><span class="chip warn">สาย</span><span class="chip info">ลา</span><span class="chip act">กิจกรรม</span>
      <input class="in" style="max-width:180px" value="ช่องกรอก 8.5"></div></div>`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-pf]'); if (!t || t.tagName === 'INPUT') return;
  const a = t.dataset.pf, d = t.dataset;
  if (a === 'set') EMSPrefs.set(d.k, d.v);
  else if (a === 'preset') { const pr = PRESETS.find(x => x[0] === d.k); Object.assign(S.prefs, pr[3]); save(); apply(); }
  else if (a === 'reset') { S.prefs = Object.assign({}, DEF, { skin: S.prefs.skin, skinChosen: S.prefs.skinChosen, lang: S.prefs.lang }); save(); apply(); toast('คืนค่ามาตรฐานแล้ว'); }
  else return;
  const y = scrollY; render(); scrollTo(0, y);
});
document.addEventListener('change', e => {
  const t = e.target.closest('input[data-pf="tog"]'); if (!t) return;
  EMSPrefs.set(t.dataset.k, t.checked);
  if (page === 'scores' || page === 'prefs') { const y = scrollY; render(); scrollTo(0, y); }
});
})();
