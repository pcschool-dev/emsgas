/* EMS — มือถือ/ไอแพด
   ① เปิดลิงก์จาก LINE → ส่งไปเปิดใน Safari/Chrome (Google ไม่ให้เข้าสู่ระบบในเบราว์เซอร์ของ LINE) · แอปอื่นที่มีเบราว์เซอร์ในตัว (Facebook/Messenger/IG) แสดงวิธีเปิดในเบราว์เซอร์
   ② เต็มจอ: Android/iPad ขอเต็มจอเมื่อแตะครั้งแรก (เบราว์เซอร์อนุญาตเฉพาะหลังผู้ใช้แตะ) · iPhone ไม่มีคำสั่งเต็มจอสำหรับเว็บ → แนะนำ “เพิ่มไปยังหน้าจอโฮม” ครั้งเดียว
      ปิดได้ที่ ปรับแต่งการแสดงผล (S.prefs.autoFull = false) · เปิดจากไอคอนบนหน้าจอโฮม/แอปที่ติดตั้งแล้วเต็มจออยู่แล้ว ไม่ต้องทำอะไร
   ③ หน้าเช็กชื่อบนจอแนวตั้ง (กว้าง ≤ 640px): คาบวันนี้เป็นรายการแนวตั้ง · นักเรียน 1 คน 1 แถว ปุ่มสถานะแตะวน มา→ขาด→ลา→สาย
      แตะชื่อเพื่อกางปุ่มครบ 5 สถานะ · แถบสรุป+บันทึกแถวเดียวติดล่าง — ทำงานบน DOM เดิมของ attend.js (กดปุ่มเดิมแทน) จึงไม่แตะตรรกะการบันทึก */
(() => {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const iphone = /iphone|ipod/i.test(ua);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const narrow = () => matchMedia('(max-width: 640px)').matches;
  const touch = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

  /* ---------- ① LINE / เบราว์เซอร์ในแอป ---------- */
  if (/\bLine\//i.test(ua) && !/[?&]openExternalBrowser=1/.test(location.search)) {
    location.replace(location.pathname + (location.search ? location.search + '&' : '?') + 'openExternalBrowser=1' + location.hash);
    return;
  }
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|TikTok|Twitter/i.test(ua);
  if (inApp) document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div'); b.className = 'm-inapp';
    b.innerHTML = `<b>เปิดในเบราว์เซอร์ก่อนเข้าสู่ระบบ</b><br>แตะ ⋯ มุมขวาบน แล้วเลือก “เปิดใน${ios ? ' Safari' : ' Chrome / เบราว์เซอร์'}” — แอปนี้ไม่อนุญาตให้เข้าสู่ระบบ Google`;
    document.body.appendChild(b); });

  /* ---------- ② เต็มจอ ---------- */
  const root = document.documentElement;
  const fsApi = root.requestFullscreen || root.webkitRequestFullscreen;
  const auto = () => !(window.S && S.prefs && S.prefs.autoFull === false);
  let tried = false;
  function tryFull() {
    if (tried || !touch() || standalone() || !auto() || document.fullscreenElement || document.webkitFullscreenElement) return;
    tried = true;
    if (fsApi && !iphone) { try { const r = fsApi.call(root, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* บางเครื่องไม่อนุญาต */ } return; }
    if (iphone) iosTip();
  }
  function iosTip() {
    try { if (localStorage.getItem('ems-ios-tip')) return; localStorage.setItem('ems-ios-tip', '1'); } catch (e) { return; }
    setTimeout(() => { if (document.querySelector('#layer .sheet')) return;
      modal(`<h2 style="margin-bottom:8px">ใช้ EMS แบบเต็มจอบน iPhone</h2>
        <p>iPhone ไม่อนุญาตให้เว็บเปิดเต็มจอเอง — เพิ่ม EMS ไว้ที่หน้าจอโฮม แล้วเปิดจากไอคอน จะได้หน้าจอเต็มแบบแอป</p>
        <ol style="margin:0 0 12px 20px;line-height:2"><li>แตะปุ่ม <b>แชร์</b> <span style="display:inline-block;border:1px solid var(--line);border-radius:6px;padding:0 6px">⬆︎</span> ที่แถบล่างของ Safari</li><li>เลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b> แล้วแตะ <b>เพิ่ม</b></li></ol>
        <button class="btn pri" style="width:100%" data-act="close">เข้าใจแล้ว</button>`, true); }, 600);
  }
  document.addEventListener('pointerup', tryFull, { capture: true });

  /* ---------- ③ หน้าเช็กชื่อบนจอแนวตั้ง ---------- */
  const NEXT = { '': 'p', p: 'a', a: 'l', l: 's', s: 'p', c: 'p' };
  const LAB = { '': 'ยังไม่เช็ก', p: 'มา', a: 'ขาด', l: 'ลา', s: 'สาย', c: 'กิจกรรม' };
  const open = new Set();
  function sessList() {
    const grid = document.querySelector('#view .att-grid'); if (!grid || grid.dataset.m) return;
    grid.dataset.m = '1';
    const kids = [...grid.children], heads = kids.filter(x => x.classList.contains('h')), cells = kids.filter(x => !x.classList.contains('h'));
    const items = [], empties = [];
    cells.forEach((cell, i) => { const h = heads[i]; const label = h ? h.innerText.replace(/\s+/g, ' ').trim() : '';
      cell.querySelectorAll('.tt-sess').forEach(b => { if (b.classList.contains('empty')) empties.push({ b, label }); else items.push({ b, label }); }); });
    const box = document.createElement('div'); box.className = 'm-sess';
    box.innerHTML = (items.length ? '' : '<div class="muted small" style="padding:8px 0">วันนี้ไม่มีคาบสอน</div>');
    /* คาบคู่: แถวเดียว “คาบ 1–2” (ช่องคาบที่ 2 ชี้ไปคาบแรก data-k เดียวกัน) */
    const byKey = {};
    items.forEach(({ b, label }) => { const k = b.dataset.k, lab = label.replace(/(\d{2}:\d{2})–(\d{2}:\d{2})/, '$1');
      if (byKey[k]) { const m = lab.match(/คาบ (\d+)/); if (m) byKey[k].textContent = byKey[k].textContent.replace(/คาบ (\d+)(–\d+)?/, (x, a) => 'คาบ ' + a + '–' + m[1]); return; }
      const row = document.createElement('div'); row.className = 'm-sr'; row.innerHTML = `<span class="m-lab">${esc(lab)}</span>`; row.appendChild(b); box.appendChild(row); byKey[k] = row.firstChild; });
    if (empties.length) { const sel = document.createElement('select'); sel.className = 'in m-sp'; sel.setAttribute('aria-label', 'เพิ่มคาบพิเศษ');
      sel.innerHTML = '<option value="">+ เพิ่มคาบพิเศษ (สอนแทน · ชดเชย)</option>' + empties.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('');
      sel.onchange = () => { const x = empties[+sel.value]; if (x) x.b.click(); sel.value = ''; }; box.appendChild(sel); }
    const scroll = grid.closest('.scroll') || grid; scroll.style.display = 'none'; scroll.parentNode.insertBefore(box, scroll);
  }
  function rows() {
    const panel = document.getElementById('att-panel'); if (!panel || panel.dataset.m) return; panel.dataset.m = '1';
    panel.classList.add('m-att');
    panel.querySelectorAll('.att-row').forEach(r => {
      const any = r.querySelector('.ab'); if (!any) return; const sid = any.dataset.s, st = r.dataset.st || '';
      if (open.has(sid)) r.classList.add('m-open');
      const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'm-pill st-' + (st || 'n'); pill.textContent = LAB[st] || st;
      pill.setAttribute('aria-label', 'สถานะ ' + (LAB[st] || '') + ' แตะเพื่อเปลี่ยน'); pill.dataset.msid = sid;
      r.appendChild(pill);
      const nm = r.querySelector('.nm'); if (nm) { nm.setAttribute('role', 'button'); nm.tabIndex = 0; nm.dataset.mexp = sid; }
    });
    /* แถบสรุป + บันทึก: ย่อเป็นแถวเดียว ติดเหนือแถบเมนูล่าง */
    const save = panel.querySelector('[data-at="save"]'); const bar = save && save.parentElement;
    if (bar) { bar.classList.add('m-bar'); bar.querySelectorAll('.chip').forEach(c => { if (/\s0$/.test(c.textContent.trim())) c.style.display = 'none'; }); save.textContent = 'บันทึก'; }
  }
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-msid]');
    if (p) { const row = p.closest('.att-row'), st = row.dataset.st || '', nx = NEXT[st] || 'p';
      const b = row.querySelector(`.ab[data-v="${nx}"]`); if (b) b.click(); return; }
    const n = e.target.closest('[data-mexp]');
    if (n) { const id = n.dataset.mexp; if (open.has(id)) open.delete(id); else open.add(id); n.closest('.att-row').classList.toggle('m-open'); }
  });
  /* ตารางของหน้านักเรียน (คะแนน/เวลาเรียน) → การ์ดรายวิชาบนจอแคบ: ใส่ป้ายหัวคอลัมน์ให้แต่ละช่อง แล้วจัดด้วย CSS */
  function stack() {
    document.querySelectorAll('#view table.tbl').forEach(t => { if (t.dataset.m) return; t.dataset.m = '1'; t.classList.add('m-stack');
      const hs = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
      t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (i > 0 && hs[i]) if (!td.hasAttribute('colspan')) td.setAttribute('data-l', hs[i]); })); });
  }
  const STACK = ['s-scores', 's-att'];
  const baseRender = window.render;
  window.render = function () { const r = baseRender.apply(this, arguments);
    if (narrow() && page === 'attendance') { sessList(); rows(); }
    if (narrow() && STACK.indexOf(page) >= 0) stack();
    return r; };

  const css = document.createElement('style');
  css.textContent = `
.m-inapp{position:fixed;left:10px;right:10px;top:10px;z-index:2000;background:var(--brand,#9a2f3f);color:#fff;border-radius:14px;padding:12px 16px;font-size:.92rem;line-height:1.5;box-shadow:0 8px 28px rgba(0,0,0,.35)}
@media (max-width:640px){
  .m-sess{display:grid;gap:10px}
  .m-sr{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:stretch}
  .m-sr .m-lab{font-size:.8rem;color:var(--muted);font-weight:600;align-self:center;line-height:1.3}
  .m-sr .tt-sess{width:100%;min-height:56px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;text-align:left;padding:10px 14px;border-radius:14px;box-shadow:var(--shadow-sm);border:1px solid var(--line)}
  .m-sr .tt-sess b{font-size:1.05rem}
  .m-sp{margin-top:6px;min-height:48px;border-radius:12px}
  .m-att .att-head{grid-template-columns:1fr!important}
  .m-att .att-head > span:not(.att-btns){display:none}
  .m-att .att-row{display:flex!important;flex-wrap:wrap;align-items:center;padding:8px 6px;gap:8px;min-height:54px;border-radius:12px;transition:background .15s}
  .m-att .att-row:active{background:var(--surface2)}
  .m-att .att-row > :first-child{width:24px;text-align:right;flex:none;font-weight:600}
  .m-att .att-row .ph-btn{flex:none}.m-att .att-row .ph,.m-att .att-row .ph-i{width:36px;height:36px;font-size:.85rem;border-radius:50%}
  .m-att .att-row .nm{flex:1;min-width:0;cursor:pointer;line-height:1.35;font-weight:600}
  .m-att .att-row .m-pill{flex:none}
  .m-att .att-row .att-btns{display:none}
  .m-att .att-row.m-open .att-btns{display:grid;flex-basis:100%;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding-top:6px}
  .m-pill{min-width:82px;min-height:44px;border-radius:999px;border:1.5px solid var(--line);background:var(--surface);color:var(--text);font-weight:700;font-size:1rem;font-family:inherit;transition:transform .12s,box-shadow .15s}
  .m-pill:active{transform:scale(.95)}
  .m-pill.st-n{color:var(--muted);font-weight:500;font-size:.88rem}
  .m-pill.st-p{background:var(--ok-soft);border-color:var(--ok);color:var(--ok);box-shadow:0 2px 8px rgba(31,122,77,.22)}
  .m-pill.st-a{background:var(--bad-soft);border-color:var(--bad);color:var(--bad);box-shadow:0 2px 8px rgba(179,38,30,.22)}
  .m-pill.st-l{background:var(--info-soft);border-color:var(--info);color:var(--info);box-shadow:0 2px 8px rgba(35,90,159,.22)}
  .m-pill.st-s{background:var(--warn-soft);border-color:var(--warn);color:var(--warn);box-shadow:0 2px 8px rgba(169,100,0,.22)}
  .m-pill.st-c{background:var(--act-soft);border-color:var(--act);color:var(--act);box-shadow:0 2px 8px rgba(107,63,160,.22)}
  .m-att .m-bar{position:sticky!important;bottom:calc(58px + env(safe-area-inset-bottom))!important;flex-wrap:nowrap!important;gap:6px!important;overflow-x:auto;margin:8px -14px -14px!important;padding:10px 14px!important;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;border-top:1px solid rgba(230,233,238,.9)!important;box-shadow:0 -4px 20px rgba(38,50,63,.08)!important;z-index:25}
  [data-theme="dark"] .m-att .m-bar,[data-scheme="dark"] .m-att .m-bar{background:rgba(27,31,38,.94)!important;border-top-color:rgba(44,51,63,.9)!important;box-shadow:0 -4px 20px rgba(0,0,0,.35)!important}
  .m-att .m-bar .chip{font-size:.78rem;padding:3px 9px;white-space:nowrap;border-radius:999px}
  table.m-stack,table.m-stack tbody{display:block;width:100%}
  table.m-stack thead{display:none}
  table.m-stack tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;padding:14px;border:1px solid var(--line);border-radius:14px;margin-bottom:10px;background:var(--surface);box-shadow:var(--shadow-sm)}
  table.m-stack td{display:block;border:0!important;padding:0!important;text-align:left!important}
  table.m-stack td:first-child{grid-column:1/-1;font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:4px}
  table.m-stack td[colspan]{grid-column:1/-1}
  table.m-stack td[data-l]::before{content:attr(data-l);display:block;font-size:.75rem;color:var(--muted);font-weight:600;margin-bottom:2px}
  .m-att .m-bar{overflow:visible!important}.m-att .m-bar .grow{display:none}
  .m-att .m-bar .btn{flex:none;min-height:46px;padding:0 24px;margin-left:auto;background:var(--grad)!important;color:#fff!important;border:0!important;border-radius:12px!important;box-shadow:0 4px 14px rgba(var(--brand-rgb,154,47,63),.28)!important;font-weight:700!important}
}`;
  document.head.appendChild(css);
})();
