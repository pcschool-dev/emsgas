/* EMS — เก็บงานหน้าตาให้เรียบร้อยทุกรูปแบบ (pro/clean/campus/soft/classic) โดยไม่เปลี่ยนสีหรือโครงเดิม
   - เมนูซ้ายกว้างขึ้นนิด ชื่อเมนูยาวไม่ตกบรรทัด · ถ้ายังตก ไอคอนอยู่ระดับบรรทัดแรก
   - ชื่อระบบใต้ตราอยู่ 2 บรรทัดพอดี
   - มือถือ: ทางลัดเรียง 2 ช่องแบบกะทัดรัด · การ์ดติดต่อแอดมินปุ่มลงบรรทัดใหม่ ข้อความไม่ถูกบีบ
   - ตัวเลขในตาราง/สถิติกว้างเท่ากัน อ่านเทียบหลักง่าย
   ถอดออก: ลบ <script src="polish.js"> ใน index.html */
(() => {
const css = document.createElement('style');
css.id = 'ems-polish';
css.textContent = `
@media (min-width:861px){
  :root:not([data-nav="rail"]) .app{grid-template-columns:280px 1fr}
  :root[data-skin="soft"]:not([data-nav="rail"]) .app{grid-template-columns:292px 1fr}
  :root:not([data-nav="rail"]) .side .nav{align-items:flex-start;gap:11px;padding-left:11px;padding-right:9px;font-size:.95rem;line-height:1.4}
  :root:not([data-nav="rail"]) .side .nav svg{margin-top:1px}
  :root:not([data-nav="rail"]) .side .nav .dot{align-self:center}
}
.brand span{white-space:nowrap}
/* แถบเลื่อนเมนูซ้ายบาง ๆ ไม่กินที่ชื่อเมนู (Windows แถบเลื่อนกว้าง 16px) */
.side{scrollbar-width:thin;scrollbar-color:rgba(127,127,127,.35) transparent}
.side::-webkit-scrollbar{width:6px}
.side::-webkit-scrollbar-thumb{background:rgba(127,127,127,.35);border-radius:99px}
.side::-webkit-scrollbar-track{background:transparent}
/* แถบเลื่อนทุกจุด (ทั้งหน้า ตารางคะแนน กล่องรายการ) สีตามโหมด — โหมดมืดเดิมเป็นแถบขาว */
:root[data-scheme="light"]{color-scheme:light}
:root[data-scheme="dark"]{color-scheme:dark}
.sc-scroll,.tbl-wrap,.sheet,.acct-menu,.pal-list{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--text) 28%,transparent) transparent}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--text) 24%,transparent);border-radius:99px;border:2px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb,var(--text) 40%,transparent)}
::-webkit-scrollbar-corner{background:transparent}
.brand b{letter-spacing:.01em}
.navgroup{font-size:.76rem;letter-spacing:0}

/* ===== โหมดมืด ===== */
/* พื้นหลังหัวหน้าเดิมไล่เป็น #fff ทำให้คำทักทาย/วันที่จมหายในโหมดมืด */
:root[data-scheme="dark"]:not([data-skin="soft"]) body{background:linear-gradient(180deg,var(--brand-soft) 0,var(--bg) 360px) no-repeat,var(--bg)}
/* การ์ด "วันนี้": สีหลักโหมดมืดเป็นสีอ่อน ตัวขาวอ่านไม่ออก → ใช้สีหลักแบบเข้ม */
:root[data-scheme="dark"] .next,:root[data-scheme="dark"][data-accent] .next{background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 38%,#000) 0%,color-mix(in srgb,var(--brand) 58%,#000) 100%);color:#fff;box-shadow:0 0 0 1px color-mix(in srgb,var(--brand) 30%,transparent) inset}
@supports (color:oklch(from red l c h)){:root[data-scheme="dark"] .next,:root[data-scheme="dark"][data-accent] .next{background:linear-gradient(135deg,oklch(from var(--brand) .33 calc(c * 1.7) h) 0%,oklch(from var(--brand) .45 calc(c * 1.9) h) 100%)}}
:root[data-scheme="dark"] .next .muted,:root[data-scheme="dark"][data-accent] .next .muted{color:rgba(255,255,255,.78)}

/* สกินโปรตั้งสีทอง/พื้นอ่อนแบบสว่างไว้ทุกโหมด → กล่องหมายเหตุ/แถบเตือนในโหมดมืดเป็นพื้นครีม ตัวอ่อน อ่านไม่ออก */
:root[data-skin="pro"][data-scheme="dark"]{--gold:#e0b45a;--gold-soft:#3a2f17;--gold-light:#5a4a26;--brand-100:rgba(154,47,63,.32);--grad-soft:linear-gradient(135deg,rgba(154,47,63,.32) 0%,rgba(154,47,63,.14) 45%,var(--surface) 100%)}
/* ===== สีหลักที่ไม่ใช่เลือดหมู (ปรับแต่ง > สีหลัก) =====
   เดิมเปลี่ยนแค่ --brand ส่วนปลายสีไล่ปุ่ม (--brand-dark/-light) ยังเป็นเลือดหมู → ปุ่มไล่ เลือดหมู→เขียว→ชมพู
   ให้ทุกเฉดคิดจากสีหลักที่เลือก (--brand-rgb สำหรับเงา/กรอบโฟกัสตั้งด้วยสคริปต์ด้านล่าง) */
:root[data-accent]:not([data-accent="maroon"]){
  --brand-dark:color-mix(in srgb,var(--brand) 80%,#000);--brand-darker:color-mix(in srgb,var(--brand) 62%,#000);
  --brand-light:color-mix(in srgb,var(--brand) 82%,#fff);--brand-100:color-mix(in srgb,var(--brand) 14%,#fff)}
:root[data-accent]:not([data-accent="maroon"])[data-scheme="dark"]{--brand-100:var(--brand-soft)}
/* สกินโปรโหมดมืดตั้งสีหลักเป็นเลือดหมูทับสีที่เลือก */
:root[data-skin="pro"][data-scheme="dark"][data-accent="blue"]{--brand:#7db4f5;--brand-soft:#14283f;--brand-ink:#14100c}
:root[data-skin="pro"][data-scheme="dark"][data-accent="green"]{--brand:#5fd09a;--brand-soft:#173225;--brand-ink:#14100c}
:root[data-skin="pro"][data-scheme="dark"][data-accent="purple"]{--brand:#c3a4f0;--brand-soft:#2b1f40;--brand-ink:#14100c}
:root[data-skin="pro"][data-scheme="dark"][data-accent="teal"]{--brand:#5ad1c6;--brand-soft:#12302d;--brand-ink:#14100c}
:root[data-skin="pro"][data-scheme="dark"][data-accent="orange"]{--brand:#f0a54f;--brand-soft:#3a2410;--brand-ink:#14100c}

/* ป้ายตัวเลขบนกระดิ่ง: ตัวขาวบนแดงอ่อนอ่านไม่ออก */
:root[data-scheme="dark"] .tb-bell .bn{color:#2a0d0b}
/* แถบสัดส่วนคะแนน (โครงสร้างรายวิชา/สมุดคะแนน): สีช่วงในโหมดมืดเป็นสีอ่อน → ตัวหนังสือเข้ม */
:root[data-scheme="dark"] .ems-wbar{color:#14100c!important}
/* ปุ่มหลักโหมดมืด: สีไล่จากเข้มไปอ่อนทำให้ตัวหนังสือเข้มจมในช่วงต้น → สีเดียว */
:root[data-scheme="dark"] .btn.pri{background:var(--brand)!important;color:var(--brand-ink);box-shadow:none}
:root[data-scheme="dark"] .btn.pri:hover{filter:brightness(1.08)}
/* ปุ่มในการ์ด "วันนี้": พื้นขาว ตัวสีหลักเข้ม อ่านได้ทุกโหมด */
.next .btn{background:#fff;border-color:transparent;color:color-mix(in srgb,var(--brand) 75%,#000)!important;box-shadow:0 2px 8px rgba(0,0,0,.12)}
:root[data-scheme="dark"] .next .btn{color:color-mix(in srgb,var(--brand) 45%,#000)!important}
.next .btn:hover{background:#fff;filter:brightness(.97)}

/* ===== หน้าหลัก ===== */
/* วันที่ไม่มีคาบ: การ์ด "วันนี้" อยู่เดี่ยว ให้สูงเท่าการ์ดต้องทำ */
.split > div:has(> .next:only-child){display:flex}
.split > div > .next:only-child{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:150px}
.next .big{letter-spacing:0}
.action{transition:border-color .15s,box-shadow .15s,transform .15s}
.action:hover{box-shadow:var(--shadow-lg);transform:translateY(-2px)}
.action:focus-visible,.tt-sess:focus-visible,.sc-c:focus-visible,.sc-view:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(var(--brand-rgb),.28)}
.banner{align-items:center}

/* ===== หัวหน้า / การ์ด / ปุ่ม ทุกหน้า ===== */
.top h1{letter-spacing:0}
.top p{margin-top:2px;font-size:.95rem}
.card > h2{font-size:1.05rem;font-weight:700}
.btn:hover{transform:none}
.btn:active{transform:scale(.98)}
.empty{padding:28px 12px;font-size:.95rem}
.row .btn.sm{flex:none}

/* การ์ดที่วางเรียงข้างกันใน .grid (เช่นการ์ดสถิติ) ไม่ต้องเว้นบนแบบการ์ดที่เรียงลง — เดิมใบที่ 2 เป็นต้นไปต่ำกว่าใบแรก */
.grid > .card + .card{margin-top:0}

/* ===== แท็บหน้าประวัติส่วนตัว — การ์ดแท็บมีไอคอน + ความคืบหน้าการกรอก (เดิมเป็นตัวอักษรเรียบ ผู้ใช้มองข้าม) ===== */
.ps-tabhead{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:22px 0 10px;scroll-margin-top:84px}
.ps-tabhead b{font-size:1.02rem}.ps-tabhead span{font-size:.84rem;color:var(--muted)}
.ps-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:0 0 18px}
.ps-tab{position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;min-height:66px;padding:10px 12px 14px;text-align:left;
  border:1.5px solid var(--line);background:var(--surface);border-radius:14px;color:var(--text);cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.04);
  transition:border-color .15s,box-shadow .15s,transform .15s,background .15s}
.ps-tab:hover{border-color:color-mix(in srgb,var(--brand) 45%,var(--line));box-shadow:0 6px 16px rgba(0,0,0,.07);transform:translateY(-1px)}
.ps-tab:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(var(--brand-rgb),.3)}
.ps-ti{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand)}
.ps-ti svg{width:19px;height:19px}
.ps-tl{min-width:0;display:flex;flex-direction:column;line-height:1.3}
.ps-tl b{font-size:.9rem;font-weight:700}
.ps-tl small{font-size:.74rem;color:var(--muted);margin-top:2px}
.ps-bar{position:absolute;left:12px;right:12px;bottom:6px;height:3px;border-radius:3px;background:color-mix(in srgb,var(--text) 9%,transparent)}
.ps-bar::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--p);border-radius:3px;background:var(--brand)}
.ps-tab.done .ps-ti{background:var(--ok-soft);color:var(--ok)}.ps-tab.done .ps-tl small{color:var(--ok);font-weight:600}.ps-tab.done .ps-bar::after{background:var(--ok)}
.ps-tab[aria-selected="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink);box-shadow:0 8px 20px rgba(var(--brand-rgb),.28)}
.ps-tab[aria-selected="true"] .ps-ti{background:rgba(255,255,255,.18);color:var(--brand-ink)}
.ps-tab[aria-selected="true"] .ps-tl small{color:var(--brand-ink);opacity:.85;font-weight:500}
.ps-tab[aria-selected="true"] .ps-bar{background:rgba(255,255,255,.25)}.ps-tab[aria-selected="true"] .ps-bar::after{background:var(--brand-ink)}
.ps-warn{position:absolute;top:8px;right:8px;width:9px;height:9px;border-radius:50%;background:var(--bad);box-shadow:0 0 0 3px var(--bad-soft)}
.ps-pane > .card + .card{margin-top:16px}
.ps-next{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px}
.ps-tabs > .ps-tab{container-type:inline-size}
.ps-tl b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@container (max-width:215px){.ps-tab .ps-ti{display:none}}
@media (max-width:860px){
  .ps-tabs{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -14px 16px;padding:2px 14px 6px;scrollbar-width:none;
    -webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
  .ps-tabs::-webkit-scrollbar{display:none}
  .ps-tabs > .ps-tab{flex:0 0 auto;width:auto;container-type:normal;scroll-snap-align:start}
  .ps-tl b{overflow:visible}
  .ps-next .btn{flex:1 1 auto}
}

/* ===== หน้าเช็กชื่อ ===== */
/* รายการคาบค้าง: ปุ่มเช็กชื่อเป็นปุ่มรอง ไม่ให้แดงทั้งคอลัมน์ · แถวมีพื้นเมื่อชี้ */
:root[data-page="attendance"] .list .row{padding:10px 10px;margin:0 -10px;border-radius:10px;border-top-color:transparent;box-shadow:inset 0 1px 0 var(--line)}
:root[data-page="attendance"] .list .row:first-child{box-shadow:none;padding-top:10px}
:root[data-page="attendance"] .list .row:hover{background:var(--surface2)}
:root[data-page="attendance"] .list .row .btn.pri{background:var(--brand-soft)!important;color:var(--brand);border:1px solid color-mix(in srgb,var(--brand) 30%,transparent);box-shadow:none}
:root[data-page="attendance"] .list .row:hover .btn.pri,:root[data-page="attendance"] .list .row .btn.pri:focus-visible{background:var(--brand)!important;color:var(--brand-ink)}
/* แถบคาบประจำวัน: ช่องว่าง "+ คาบพิเศษ" ให้เบาลง เด่นเมื่อชี้ */
.tt-sess{transition:border-color .15s,background .15s,box-shadow .15s}
.tt-sess:not(.empty):hover{box-shadow:var(--shadow-sm);border-color:color-mix(in srgb,var(--brand) 40%,var(--line))}
.tt-sess.empty{opacity:.7;font-size:.88rem}
.tt-sess.empty .small{white-space:nowrap;font-size:.72rem}
.tt-sess.empty:hover{opacity:1;border-color:var(--brand);color:var(--brand);background:var(--brand-soft)}

/* ===== ตารางกรอกคะแนน ===== */
/* แถวสลับสีจาง ๆ ไล่ตาตามแถวได้ · แถวที่กำลังกรอกเน้นด้วยสีหลัก (ซ้อนบนพื้นสีหน่วยเดิม) */
#scGrid tbody tr:nth-child(even) td{background-image:linear-gradient(color-mix(in srgb,var(--text) 3.5%,transparent),color-mix(in srgb,var(--text) 3.5%,transparent))}
#scGrid tbody tr:focus-within td{background-image:linear-gradient(color-mix(in srgb,var(--brand) 9%,transparent),color-mix(in srgb,var(--brand) 9%,transparent))}
#scGrid tbody tr:focus-within td.k2{box-shadow:inset 3px 0 0 var(--brand),2px 0 0 var(--line)}
#scGrid td.k1{color:var(--muted);font-size:.85rem}
#scGrid td.r-tot{font-size:1.02rem}
/* ช่องกรอกคะแนน: มุมมน 6px (เดิมมุมตรงใน book.js) · ขอบจางลง · กรอบโฟกัสมนตามช่อง */
#scGrid input.in{border-radius:6px;border-color:color-mix(in srgb,var(--text) 13%,transparent);transition:border-color .12s,box-shadow .12s}
#scGrid input.in:hover:not(:focus):not(.locked){border-color:color-mix(in srgb,var(--text) 26%,transparent)}
#scGrid input.in:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 22%,transparent)}
#scGrid input.low{border-color:color-mix(in srgb,var(--bad) 50%,transparent)}
#scGrid input.low:focus{border-color:var(--bad);box-shadow:0 0 0 3px color-mix(in srgb,var(--bad) 20%,transparent)}
#scGrid .btn.low,#scGrid .rt-add,#scGrid .sbtn{border-radius:6px}
/* ป้ายผ่าน/ไม่ผ่านอยู่บรรทัดเดียวกับช่องคะแนน (เดิมขึ้นบรรทัดใต้ช่อง) · เฉพาะจอคอม/แท็บเล็ต */
@media (min-width:641px){   /* มือถือคงไว้ใต้ช่อง: จอแคบป้ายข้างช่องเบียดคอลัมน์ชื่อ */
  #scGrid td:has(> [data-uchip]){white-space:nowrap}
  #scGrid [data-uchip]{display:inline-block;margin-left:6px;vertical-align:middle}
  #scGrid [data-uchip] .chip{padding:1px 7px}
}

/* ตัวเลขกว้างเท่ากัน */
table,.kpi .v,.tb-bell .bn,.nav .dot,.chip{font-variant-numeric:tabular-nums}

/* การ์ดติดต่อแอดมิน: จอแคบให้ข้อความเต็มแถว ปุ่มลงบรรทัดใหม่ */
@media (max-width:600px){
  .ct-help .row{row-gap:12px}
  .ct-help .row > .grow{flex:1 1 calc(100% - 56px)}
  .ct-help .row > .btn{flex:1 1 0}
}

/* มือถือ: ทางลัด 2 ช่อง กะทัดรัด */
@media (max-width:420px){
  .actions{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .action{min-height:0;padding:12px;gap:8px}
  .action .ico{width:36px;height:36px;border-radius:10px}
  .action .muted,.action .small{font-size:.8rem;line-height:1.4}
}
`;
document.head.appendChild(css);

/* --brand-rgb (ใช้ใน rgba() ของเงาปุ่มหลัก กรอบโฟกัส ปุ่มเม็ดยา) ตามสีหลักจริง — เดิมค้างเป็นเลือดหมูเมื่อเลือกสีอื่น */
const root = document.documentElement;
function syncBrandRgb() {
  root.style.removeProperty('--brand-rgb');
  const t = document.createElement('i'); t.style.cssText = 'position:absolute;visibility:hidden;color:var(--brand)';
  document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove();
  let v = (c.match(/rgba?\(([^)]+)\)/) || [])[1];
  if (v) v = v.split(/[ ,\/]+/).slice(0, 3).join(',');
  else { const m = c.match(/srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (m) v = [m[1], m[2], m[3]].map(x => Math.round(x * 255)).join(','); }
  if (v && root.dataset.accent && root.dataset.accent !== 'maroon') root.style.setProperty('--brand-rgb', v);
}
const run = () => document.body ? syncBrandRgb() : document.addEventListener('DOMContentLoaded', syncBrandRgb, { once: true });
run();
new MutationObserver(run).observe(root, { attributes: true, attributeFilter: ['data-accent', 'data-scheme', 'data-skin', 'data-theme'] });
})();

/* ===== ข้อความแจ้งเตือน (toast) — การ์ดมุมมนแทนแคปซูล: ข้อความยาวขึ้นบรรทัดใหม่สวย ไม่ล้นจอมือถือ · มีไอคอนตามชนิด · ค้างนานตามความยาว · แตะเพื่อปิด
   แทนที่ toast() เดิมใน index.html (ชื่อและวิธีเรียกเหมือนเดิม) · แสดงทีละอัน อันใหม่แทนอันเก่า ===== */
(() => {
const css = document.createElement('style'); css.id = 'ems-toast'; css.textContent = `
.ems-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));z-index:150;display:flex;align-items:flex-start;gap:10px;
  width:max-content;max-width:min(440px,calc(100vw - 32px));padding:12px 16px 12px 12px;border-radius:14px;
  background:color-mix(in srgb,var(--text) 92%,transparent);color:var(--bg);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  box-shadow:0 10px 30px rgba(0,0,0,.22),0 0 0 1px rgba(255,255,255,.06) inset;font-size:.92rem;font-weight:500;line-height:1.5;
  overflow-wrap:break-word;cursor:pointer;transform:translate(-50%,12px);opacity:0;transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s}
.ems-toast.in{transform:translate(-50%,0);opacity:1}
.ems-toast .ems-ti{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;margin-top:0;font-size:.72rem;font-weight:800;line-height:1}
.ems-toast .ems-ti svg{width:13px;height:13px}
.ems-toast.ok .ems-ti{background:#2f9e67;color:#fff}.ems-toast.bad .ems-ti{background:#d9493f;color:#fff}.ems-toast.info .ems-ti{background:color-mix(in srgb,var(--bg) 22%,transparent);color:var(--bg)}
.ems-toast .ems-tt{flex:1 1 auto;min-width:0;padding-top:1px}
@media (max-width:860px){.ems-toast{bottom:calc(76px + env(safe-area-inset-bottom))}}
@media (prefers-reduced-motion:reduce){.ems-toast{transition:opacity .15s}}`;
document.head.appendChild(css);
const IC = { ok: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>', bad: '!', info: 'i' };
const kind = t => /ไม่สำเร็จ|ผิดพลาด|ล้มเหลว|ไม่ได้|ไม่ถูกต้อง|ไม่พบ|หมดอายุ|ไม่มีสิทธิ์|error|fail/i.test(t) ? 'bad'
  : /แล้ว|สำเร็จ|เรียบร้อย|ยินดีต้อนรับ|บันทึก/.test(t) ? 'ok' : 'info';
let cur = null, timer = 0;
const hide = el => { if (!el) return; el.classList.remove('in'); setTimeout(() => el.remove(), 230); };
window.toast = function (t) {
  const s = String(t == null ? '' : t).trim(); if (!s) return;
  /* อีโมจินำหน้าข้อความ (🔒 ✅ ⚠️) ใช้เป็นไอคอนแทน */
  const m = s.match(/^(\p{Extended_Pictographic}️?)\s*/u), k = kind(s);
  clearTimeout(timer); hide(cur);
  const el = document.createElement('div'); el.className = 'ems-toast ' + k; el.setAttribute('role', k === 'bad' ? 'alert' : 'status');
  el.innerHTML = `<span class="ems-ti" aria-hidden="true"${m ? ' style="background:none;font-size:1.05rem"' : ''}></span><span class="ems-tt"></span>`;
  el.firstChild.innerHTML = m ? '' : IC[k]; if (m) el.firstChild.textContent = m[1];
  el.lastChild.textContent = m ? s.slice(m[0].length) : s;
  el.addEventListener('click', () => { clearTimeout(timer); hide(el); if (cur === el) cur = null; });
  document.body.appendChild(el); cur = el;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  timer = setTimeout(() => { hide(el); if (cur === el) cur = null; }, Math.min(6000, 2400 + s.length * 45));
};
})();
