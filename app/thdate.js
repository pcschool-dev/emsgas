/* EMS — ช่องวันที่แบบ พ.ศ. ทั้งแอป
   ช่อง <input type="date"> ของเบราว์เซอร์แสดงปี ค.ศ. เสมอ (ตั้งเป็น พ.ศ. ไม่ได้) → เปลี่ยนทุกช่องเป็นช่องพิมพ์ วว/ดด/ปปปป (พ.ศ.) + ปฏิทินเลือกวัน
   โค้ดส่วนอื่นไม่ต้องแก้: .value ของช่องยังคืนค่า ISO ค.ศ. (2026-10-12) เหมือนเดิม และตั้ง .value ด้วย ISO ได้ · เหตุการณ์ input/change ยิงตามปกติ
   ทำงานกับช่องที่สร้างใหม่ทุกครั้ง (หน้าเว็บ/หน้าต่าง) ผ่าน MutationObserver · โหลดก่อนไฟล์อื่น เพื่อให้แปลงข้อความเป็นวันที่ก่อนตัวจัดการอื่นอ่านค่า */
(() => {
  const NATIVE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const pad = n => String(n).padStart(2, '0');
  const MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T00:00:00'));
  const show = iso => isoOk(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + (+iso.slice(0, 4) + 543) : '';
  /* รับ วว/ดด/ปปปป (พ.ศ. หรือ ค.ศ.) · วว-ดด-ปป · ISO */
  function parse(t) {
    t = String(t || '').trim(); if (!t) return '';
    if (isoOk(t)) return t;
    const m = t.match(/^(\d{1,2})[\/.\-\s](\d{1,2})[\/.\-\s](\d{2,4})$/); if (!m) return null;
    let d = +m[1], mo = +m[2], y = +m[3];
    if (y < 100) y += 2500;                                    // 69 → 2569
    if (y > 2400) y -= 543;                                    // พ.ศ. → ค.ศ.
    const iso = y + '-' + pad(mo) + '-' + pad(d), dt = new Date(iso + 'T00:00:00');
    return dt.getMonth() + 1 === mo && dt.getDate() === d ? iso : null;
  }
  function enhance(el) {
    if (el.dataset.thd) return; el.dataset.thd = '1';
    let cur = NATIVE.get.call(el) || el.getAttribute('value') || '';
    const mn = el.getAttribute('min') || '', mx = el.getAttribute('max') || '';
    el.type = 'text'; el.setAttribute('inputmode', 'numeric'); el.setAttribute('autocomplete', 'off');
    if (!el.placeholder) el.placeholder = 'วว/ดด/ปปปป'; el.classList.add('thd-in');
    el.title = (el.title ? el.title + ' · ' : '') + 'วันที่ พ.ศ. เช่น 12/10/2569';
    Object.defineProperty(el, 'value', { configurable: true, get: () => cur, set: v => { const p = parse(v); cur = p == null ? '' : p; NATIVE.set.call(el, show(cur)); } });
    el.__thd = { min: mn, max: mx, set: iso => { cur = iso; NATIVE.set.call(el, show(cur)); } };
    NATIVE.set.call(el, show(cur));
  }
  const scan = root => { if (root.matches && root.matches('input[type="date"]')) enhance(root); if (root.querySelectorAll) root.querySelectorAll('input[type="date"]').forEach(enhance); };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); }))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document.body));

  /* พิมพ์เองแล้วออกจากช่อง → แปลงเป็นวันที่ก่อนตัวจัดการอื่นอ่าน (capture) */
  document.addEventListener('change', e => { const el = e.target; if (!el.__thd || el.__thdFire) return;
    const p = parse(NATIVE.get.call(el)); if (p == null) { e.stopImmediatePropagation(); toast('รูปแบบวันที่ไม่ถูกต้อง — พิมพ์ วว/ดด/ปปปป เช่น 12/10/2569'); NATIVE.set.call(el, show(el.value)); return; }
    el.__thd.set(p); }, true);

  /* ---------- ปฏิทินเลือกวัน ---------- */
  let pop = null, tgt = null, vy = 0, vm = 0;
  const close = () => { if (pop) pop.remove(); pop = null; tgt = null; };
  function open(el) {
    tgt = el; const base = isoOk(el.value) ? el.value : (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
    vy = +base.slice(0, 4); vm = +base.slice(5, 7) - 1; draw();
  }
  function draw() {
    if (!tgt) return; if (!pop) { pop = document.createElement('div'); pop.className = 'thd-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'เลือกวันที่'); document.body.appendChild(pop); }
    const first = new Date(vy, vm, 1), days = new Date(vy, vm + 1, 0).getDate(), sel = tgt.value, today = typeof todayISO === 'function' ? todayISO() : '';
    const ny = new Date().getFullYear(), years = []; for (let y = ny + 6; y >= ny - 80; y--) years.push(y);
    const { min, max } = tgt.__thd || {};
    let g = ''; for (let i = 0; i < first.getDay(); i++) g += '<span></span>';
    for (let d = 1; d <= days; d++) { const iso = vy + '-' + pad(vm + 1) + '-' + pad(d), off = (min && iso < min) || (max && iso > max);
      g += `<button type="button" data-thd="${iso}" class="${iso === sel ? 'sel' : ''} ${iso === today ? 'td' : ''}" ${off ? 'disabled' : ''}>${d}</button>`; }
    pop.innerHTML = `<div class="thd-h"><button type="button" data-thdm="-1" aria-label="เดือนก่อน">‹</button>
        <select data-thdsel="m" aria-label="เดือน">${MON.map((m, i) => `<option value="${i}" ${i === vm ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <select data-thdsel="y" aria-label="ปี พ.ศ.">${years.map(y => `<option value="${y}" ${y === vy ? 'selected' : ''}>${y + 543}</option>`).join('')}</select>
        <button type="button" data-thdm="1" aria-label="เดือนถัดไป">›</button></div>
      <div class="thd-w">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(x => `<span>${x}</span>`).join('')}</div><div class="thd-g">${g}</div>
      <div class="thd-f"><button type="button" data-thd="${today}">วันนี้</button><button type="button" data-thd="">ล้าง</button><button type="button" data-thdx>ปิด</button></div>`;
    const r = tgt.getBoundingClientRect(), w = 280, h = pop.offsetHeight || 320;
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    pop.style.top = (r.bottom + h + 8 > innerHeight && r.top > h ? r.top - h - 4 : r.bottom + 4) + 'px';
  }
  function pick(iso) {
    const el = tgt; if (!el) return; el.__thd.set(iso); close();
    el.__thdFire = true; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.__thdFire = false; el.focus();
  }
  document.addEventListener('focusin', e => { if (e.target.__thd && tgt !== e.target) open(e.target); });
  document.addEventListener('mousedown', e => {
    if (e.target.__thd) { if (tgt !== e.target) open(e.target); return; }
    if (pop && !pop.contains(e.target)) close();
  });
  document.addEventListener('click', e => { if (!pop || !pop.contains(e.target)) return; const b = e.target.closest('button'); if (!b) return; e.preventDefault();
    if (b.dataset.thdm) { vm += +b.dataset.thdm; if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; } return draw(); }
    if (b.hasAttribute('data-thdx')) return close();
    if (b.dataset.thd !== undefined) return pick(b.dataset.thd); });
  document.addEventListener('change', e => { if (!pop || !pop.contains(e.target)) return; e.stopPropagation(); const t = e.target;
    if (t.dataset.thdsel === 'm') vm = +t.value; else vy = +t.value; draw(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) close(); if (e.key === 'Tab' && pop) close(); });
  window.addEventListener('scroll', e => { if (pop && !pop.contains(e.target)) close(); }, true);

  const css = document.createElement('style');
  css.textContent = `.thd-in{font-variant-numeric:tabular-nums}
.thd-pop{position:fixed;z-index:1000;width:280px;background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.2);padding:10px}
.thd-h{display:flex;gap:4px;align-items:center;margin-bottom:6px}.thd-h select{flex:1;min-height:32px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text);padding:0 4px;font:inherit}
.thd-h button,.thd-f button{min-height:32px;min-width:32px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer;font:inherit}
.thd-w,.thd-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}.thd-w span{font-size:.75rem;color:var(--muted);padding:2px 0}
.thd-g button{min-height:32px;border:0;border-radius:6px;background:none;color:var(--text);cursor:pointer;font:inherit}.thd-g button:hover{background:var(--surface2)}
.thd-g button.td{outline:1px solid var(--brand)}.thd-g button.sel{background:var(--brand);color:var(--brand-ink)}.thd-g button:disabled{opacity:.3;cursor:default}
.thd-f{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}.thd-f button{padding:0 10px}`;
  document.head.appendChild(css);
  window.EMSThaiDate = { parse, show };
})();
