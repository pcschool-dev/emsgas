/* EMS — จองคิว DPA / วิทยฐานะ (ย้ายจากแอปแยก D:\KruSpace\dpa-booking: src/core.js ตรรกะเดิมทั้งก้อน + src/app.js หน้าจอ)
   โหลดเมื่อเปิดหน้าครั้งแรกผ่าน lazy.js — ครูที่ไม่ได้ใช้ไม่ต้องโหลดไฟล์นี้
   เชื่อมกับ EMS: รายชื่อ/เบอร์จากทะเบียนบุคลากร S.staff, วันหยุดจากปฏิทินโรงเรียน S.events (cat holiday) รวมกับวันหยุดพิเศษของงานนี้,
   ตัวตน = อีเมลของบุคลากร (EMSLazy.me) ตรงกับรหัสเอกสาร staff ของ KruSpace เดิม
   ข้อมูล S.dpa = { cfg, slots:{ รหัสช่อง: {...} } } รูปแบบเดียวกับคอลเลกชัน dpaConfig/main + dpaSlots/{id} ของแอปเดิม
   ตอนต่อ Firebase (ข้อ 5) เปลี่ยนเฉพาะ store ด้านล่างเป็น Firestore — ส่วนหน้าจอไม่ต้องแก้ */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  /* ================= ตรรกะล้วน (คัดลอกจาก dpa-booking/src/core.js) ================= */
  const D = (function () {
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const parse = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
    const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
    const addMonths = (s, n) => {
      const d = parse(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return fmt(d);
    };
    const dow = s => parse(s).getDay();
    const mondayOf = s => addDays(s, -((dow(s) + 6) % 7));
    const todayStr = () => fmt(new Date());
    const toMin = t => { const p = t.split(':').map(Number); return p[0] * 60 + p[1]; };
    const fromMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
    const stdId = email => String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    const DEFAULT_CONFIG = { officers: [], officerEmails: [], slotMinutes: 60, dayStart: '08:30', dayEnd: '16:30', maxMonths: 6, minLeadDays: 1, maxActive: 2, holidays: [],
      topics: ['ลงข้อมูล DPA', 'ขอมีวิทยฐานะ', 'ขอเลื่อนวิทยฐานะ'] };
    const withDefaults = c => Object.assign({}, DEFAULT_CONFIG, c || {});
    const slotStarts = cfg => { const out = [], end = toMin(cfg.dayEnd); for (let m = toMin(cfg.dayStart); m + cfg.slotMinutes <= end; m += cfg.slotMinutes) out.push(fromMin(m)); return out; };
    const slotEnd = (start, cfg) => fromMin(toMin(start) + cfg.slotMinutes);
    const slotId = (officer, date, start) => stdId(officer) + '_' + date + '_' + start.replace(':', '');
    const officerDateProblem = (date, today, cfg) => {
      if (date < today) return 'เป็นวันที่ผ่านมาแล้ว';
      const w = dow(date); if (w === 0 || w === 6) return 'ไม่ใช่วันทำการ';
      if ((cfg.holidays || []).indexOf(date) >= 0) return 'เป็นวันหยุด';
      if (date > addMonths(today, cfg.maxMonths)) return 'เกิน ' + cfg.maxMonths + ' เดือนล่วงหน้า';
      return '';
    };
    const bookDateProblem = (date, today, cfg, admin) => {
      const p = officerDateProblem(date, today, cfg); if (p) return p;
      if (!admin && date < addDays(today, cfg.minLeadDays)) return 'ต้องจองล่วงหน้าอย่างน้อย ' + cfg.minLeadDays + ' วัน';
      return '';
    };
    const ACTIVE = { requested: 1, confirmed: 1 };
    const activeOf = (slots, email, today) => slots.filter(s => s.teacherEmail === email && ACTIVE[s.status] && s.date >= today);
    const bookProblem = (slot, slots, me, cfg, today, admin) => {
      if (!slot || slot.status !== 'open') return 'ช่องนี้ไม่ว่างแล้ว';
      if (slot.officer === me) return 'จองคิวของตัวเองไม่ได้';
      const dp = bookDateProblem(slot.date, today, cfg, admin); if (dp) return dp;
      const mine = activeOf(slots, me, today);
      if (mine.some(s => s.date === slot.date && s.start === slot.start)) return 'คุณมีคิวเวลานี้กับเจ้าหน้าที่อีกคนแล้ว';
      if (mine.length >= cfg.maxActive) return 'มีคิวที่ยังใช้งานอยู่ครบ ' + cfg.maxActive + ' คิวแล้ว ยกเลิกหรือรอให้เสร็จก่อน';
      return '';
    };
    const repeatPlan = (weekSlots, n, slots, officer, today, cfg) => {
      const have = {}; slots.forEach(s => { if (s.officer === officer) have[s.date + '|' + s.start] = 1; });
      const out = [];
      for (let w = 1; w <= n; w++) weekSlots.forEach(s => { const date = addDays(s.date, 7 * w); if (officerDateProblem(date, today, cfg) || have[date + '|' + s.start]) return; out.push({ date, start: s.start }); });
      return out;
    };
    const STATUS = { open: 'ว่าง', requested: 'รอรับ', confirmed: 'รับแล้ว', declined: 'ปฏิเสธ', cancelled: 'ยกเลิก' };
    const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thaiDate = s => { const d = parse(s); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON_S[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
    const thaiMonth = s => { const d = parse(s); return MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
    const csvCell = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const toCsv = (slots, cfg) => {
      const head = ['วันที่', 'เวลา', 'เจ้าหน้าที่', 'ครูผู้จอง', 'เบอร์ครู', 'เรื่อง', 'สถานะ', 'หมายเหตุ'];
      const rows = slots.filter(s => s.status !== 'open').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .map(s => [s.date, s.start + '-' + slotEnd(s.start, cfg), s.officerName || s.officer, s.teacherName, s.teacherPhone, s.topic, STATUS[s.status] || s.status, s.note]);
      return '\ufeff' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n');
    };
    return { pad, parse, addDays, addMonths, dow, mondayOf, todayStr, stdId, withDefaults, slotStarts, slotEnd, slotId,
      officerDateProblem, bookDateProblem, activeOf, bookProblem, repeatPlan, STATUS, DOW, thaiDate, thaiMonth, toCsv };
  })();

  /* ================= ที่เก็บข้อมูล (ตอนนี้ = S ในเครื่อง · ข้อ 5 เปลี่ยนเป็น Firestore dpaConfig/dpaSlots) ================= */
  const iso = () => new Date().toISOString();
  const CLEAR = ['teacherEmail', 'teacherName', 'teacherPhone', 'topic', 'note', 'requestedAt', 'decidedAt', 'officerNote', 'cancelledAt'];
  const db = () => { if (!S.dpa) S.dpa = seed(); return S.dpa; };
  function seed() {
    /* ค่าเริ่มต้นตัวอย่าง: เจ้าหน้าที่ 2 คนจากทะเบียนบุคลากร (ไม่ใช่ตัวเอง) พร้อมช่วงว่าง 3 สัปดาห์ */
    const meK = EMSLazy.me(), off = (S.staff || []).filter(u => u.email && D.stdId(u.email) !== meK && u.role !== 'admin').slice(0, 2)
      .map(u => ({ email: D.stdId(u.email), name: u.name, phone: u.phone || '' }));
    const cfg = { officers: off, officerEmails: off.map(o => o.email) }, slots = {}, t = D.todayStr(), full = D.withDefaults(cfg);
    for (let n = 1; n < 21; n++) {
      const date = D.addDays(t, n); if (D.officerDateProblem(date, t, full)) continue;
      off.forEach((o, i) => ['09:30', '10:30', '13:30', '14:30'].forEach((st, j) => { if ((i + j + n) % 3 === 0) return; slots[D.slotId(o.email, date, st)] = { officer: o.email, officerName: o.name, date, start: st, status: 'open' }; }));
    }
    return { cfg, slots };
  }
  const store = {
    saveConfig(cfg) { db().cfg = cfg; save(); },
    putOpen(list) { const d = db(); list.forEach(x => { const id = D.slotId(x.officer, x.date, x.start); if (!d.slots[id]) d.slots[id] = Object.assign({ status: 'open', createdAt: iso() }, x); }); save(); },
    remove(id) { const d = db(); if (d.slots[id] && d.slots[id].status === 'requested') throw new Error('มีครูขอคิวนี้อยู่ ตอบรับหรือปฏิเสธก่อน'); delete d.slots[id]; save(); },
    book(id, t) { const s = db().slots[id]; if (!s || s.status !== 'open') throw new Error('ช่องนี้ถูกจองไปแล้ว'); Object.assign(s, { status: 'requested', requestedAt: iso() }, t); save(); },
    setStatus(id, status, extra) { const s = db().slots[id]; if (!s) throw new Error('ไม่พบคิวนี้'); Object.assign(s, { status }, extra || {}); save(); },
    reopen(id) { const s = db().slots[id]; if (!s) return; CLEAR.forEach(k => delete s[k]); s.status = 'open'; save(); },
    /* ล้างช่องที่ผ่านไปแล้วเกิน 60 วัน ให้ข้อมูลไม่โตไปเรื่อย ๆ */
    prune() { const d = db(), lim = D.addDays(D.todayStr(), -60); let n = 0; Object.keys(d.slots).forEach(k => { if (d.slots[k].date < lim) { delete d.slots[k]; n++; } }); if (n) save(); }
  };
  const run = (fn, ok) => { try { fn(); if (ok) toast(ok); } catch (e) { toast(e.message || String(e)); } render(); };

  /* ================= สถานะหน้าจอ ================= */
  const U = { tab: 'book', officer: 'all', date: '', month: '', week: '', draft: null };
  const today = () => D.todayStr();
  /* วันหยุดของโรงเรียน (ปฏิทินกลาง) + วันหยุดพิเศษของงานนี้ */
  const cfgOf = () => { const c = D.withDefaults(db().cfg); c.holidays = [...new Set((c.holidays || []).concat((S.events || []).filter(e => e.cat === 'holiday').map(e => e.date)))]; return c; };
  const slotsArr = () => Object.keys(db().slots).map(k => Object.assign({ id: k }, db().slots[k])).filter(s => s.date >= today());
  const meKey = () => EMSLazy.me();
  const meStaff = () => (S.staff || []).find(u => u.name === S.me.name) || {};
  const isAdmin = () => (window.EMSNav && EMSNav.view() === 'admin') || (meStaff().roles || [meStaff().role]).indexOf('admin') >= 0;
  const isOfficer = () => cfgOf().officerEmails.indexOf(meKey()) >= 0;
  const short = n => { const p = String(n).replace(/^(นาย|นางสาว|นาง|ครู)\s*/, '').split(/\s+/); return p[0]; };
  const offName = e => { const o = cfgOf().officers.find(x => x.email === e); return o ? o.name : e; };
  const when = s => D.thaiDate(s.date) + ' · ' + s.start + '–' + D.slotEnd(s.start, cfgOf()) + ' น.';
  const tel = p => p ? `<a class="btn sm" href="tel:${esc(String(p).replace(/[^0-9+]/g, ''))}">โทร ${esc(p)}</a>` : '<span class="muted small">ยังไม่มีเบอร์</span>';
  const K = { open: 'ok', requested: 'warn', confirmed: 'ok', declined: 'bad', cancelled: '' };
  const badge = st => chip(D.STATUS[st], K[st]);
  const mySlots = () => slotsArr().filter(s => s.teacherEmail === meKey() && (s.status === 'requested' || s.status === 'confirmed'));
  const pending = () => slotsArr().filter(s => s.officer === meKey() && s.status === 'requested').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const hd = (h, p) => `<div class="top"><div><h1>${h}</h1><p>${p}</p></div></div>`;
  const act = (a, extra = '') => `data-dpa="${a}" ${extra}`;

  /* ================= จองคิว (ครู) ================= */
  function vBook() {
    const cfg = cfgOf(), officers = cfg.officers, admin = isAdmin(), t = today(), map = db().slots;
    if (!officers.length) return `<div class="card empty">ยังไม่ได้ตั้งเจ้าหน้าที่${admin ? ' — ไปที่แท็บ “ตั้งค่า” เพื่อเลือกจากทะเบียนบุคลากร' : ' — รอแอดมินตั้งค่า'}</div>`;
    const shown = U.officer === 'all' ? officers : officers.filter(o => o.email === U.officer), sset = new Set(shown.map(o => o.email));
    const offs = `<div class="dp-offs"><button class="dp-of" aria-pressed="${U.officer === 'all'}" ${act('off', 'data-e="all"')}><b>ทุกคน</b><span class="muted small">${officers.length} คน</span></button>` +
      officers.map(o => `<button class="dp-of" aria-pressed="${U.officer === o.email}" ${act('off', `data-e="${esc(o.email)}"`)}><b>${esc(o.name)}</b><span class="muted small">${o.phone ? 'โทร ' + esc(o.phone) : 'ยังไม่มีเบอร์'}</span></button>`).join('') + '</div>';
    if (!U.month) U.month = D.addDays(t, 1).slice(0, 8) + '01';
    const first = D.parse(U.month), last = D.addMonths(t.slice(0, 8) + '01', cfg.maxMonths), canPrev = U.month > t.slice(0, 8) + '01', canNext = D.addMonths(U.month, 1) <= last;
    const cnt = {}; slotsArr().forEach(s => { if (s.status === 'open' && sset.has(s.officer)) cnt[s.date] = (cnt[s.date] || 0) + 1; });
    let cal = `<div class="dp-calh"><button class="btn sm" ${act('mon', 'data-d="-1"')} ${canPrev ? '' : 'disabled'} aria-label="เดือนก่อน">‹</button><b>${D.thaiMonth(U.month)}</b><button class="btn sm" ${act('mon', 'data-d="1"')} ${canNext ? '' : 'disabled'} aria-label="เดือนถัดไป">›</button></div><div class="dp-cal">` +
      D.DOW.map(d => `<div class="dw">${d}</div>`).join('') + '<div></div>'.repeat(first.getDay());
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const ds = U.month.slice(0, 8) + D.pad(d), bad = D.bookDateProblem(ds, t, cfg, admin), n = cnt[ds] || 0;
      cal += `<button ${act('day', `data-d="${ds}"`)} class="${n && !bad ? 'has ' : ''}${U.date === ds ? 'sel ' : ''}${ds === t ? 'today' : ''}" ${bad ? `disabled title="${esc(bad)}"` : ''}>${d}${n && !bad ? `<i>${n}</i>` : ''}</button>`;
    }
    cal += `</div><p class="muted small" style="margin:8px 0 0">ตัวเลขเล็ก = คิวว่าง · จองล่วงหน้าได้ถึง ${D.thaiDate(D.addMonths(t, cfg.maxMonths))}</p>`;
    let r;
    if (U.date) {
      r = `<h2 style="margin:0 0 8px">${D.thaiDate(U.date)}</h2><div class="scroll"><table class="dp-g"><thead><tr><th></th>${shown.map(o => `<th>${esc(short(o.name))}</th>`).join('')}</tr></thead><tbody>` +
        D.slotStarts(cfg).map(st => `<tr><td class="t">${st}</td>${shown.map(o => {
          const id = D.slotId(o.email, U.date, st), s = map[id];
          if (!s) return '<td><button class="c" disabled>–</button></td>';
          if (s.status === 'open') return `<td><button class="c free" ${act('book', `data-id="${esc(id)}"`)}>ว่าง</button></td>`;
          if (s.teacherEmail === meKey() && (s.status === 'requested' || s.status === 'confirmed')) return `<td><button class="c mine" disabled>คิวคุณ<br>${D.STATUS[s.status]}</button></td>`;
          return `<td><button class="c" disabled>ไม่ว่าง${(isOfficer() || admin) && s.teacherName ? '<br>' + esc(short(s.teacherName)) : ''}</button></td>`;
        }).join('')}</tr>`).join('') + '</tbody></table></div>';
    } else r = '<p class="muted" style="text-align:center;padding:30px 0">เลือกวันที่ในปฏิทินเพื่อดูเวลาว่างของเจ้าหน้าที่</p>';
    return offs + `<div class="dp-split"><div class="card">${cal}</div><div class="card">${r}</div></div>`;
  }
  function bookModal(id) {
    const s = Object.assign({ id }, db().slots[id]), cfg = cfgOf();
    const prob = D.bookProblem(db().slots[id], slotsArr(), meKey(), cfg, today(), isAdmin()); if (prob) return toast(prob);
    const o = cfg.officers.find(x => x.email === s.officer) || {};
    modal(`<h2 style="margin:0 0 6px">จองคิว</h2><p><b>${esc(offName(s.officer))}</b><br>${esc(when(s))}${o.phone ? `<br><span class="muted small">เบอร์เจ้าหน้าที่ ${esc(o.phone)}</span>` : ''}</p>
      <div class="field"><label class="f" for="dpTopic">เรื่องที่ต้องการทำ</label><select id="dpTopic" class="in">${cfg.topics.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label class="f" for="dpPhone">เบอร์ติดต่อของคุณ</label><input id="dpPhone" class="in" inputmode="tel" value="${esc(meStaff().phone || '')}"></div>
      <div class="field"><label class="f" for="dpNote">หมายเหตุ (ถ้ามี)</label><textarea id="dpNote" class="in" rows="2" maxlength="300"></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" ${act('bookOk', `data-id="${esc(id)}"`)}>ส่งคำขอจอง</button></div>`, true);
  }

  /* ================= คิวของฉัน ================= */
  function vMine() {
    const list = slotsArr().filter(s => s.teacherEmail === meKey() && s.status !== 'open').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    if (!list.length) return `<div class="card empty">ยังไม่มีคิวที่จองไว้<br><button class="btn pri" style="margin-top:10px" ${act('tab', 'data-t="book"')}>ไปจองคิว</button></div>`;
    return `<div class="card"><div class="list">${list.map(s => { const o = cfgOf().officers.find(x => x.email === s.officer) || {};
      return `<div class="row"><div class="grow"><div class="t">${esc(when(s))}</div><div class="muted small">${esc(s.topic || '')} · เจ้าหน้าที่ ${esc(offName(s.officer))}${s.note ? ' · ' + esc(s.note) : ''}</div>${s.officerNote ? `<div class="small">ข้อความจากเจ้าหน้าที่: ${esc(s.officerNote)}</div>` : ''}</div>
        <div class="dp-acts">${badge(s.status)}${tel(o.phone)}${s.status === 'requested' || s.status === 'confirmed' ? `<button class="btn sm" ${act('cancel', `data-id="${esc(s.id)}"`)}>ยกเลิกคิว</button>` : ''}</div></div>`; }).join('')}</div></div>`;
  }

  /* ================= งานเจ้าหน้าที่ ================= */
  function vWork() {
    const me = meKey(), t = today(), cfg = cfgOf(), pend = pending(), map = db().slots;
    const left = `<div class="card"><h2 style="margin:0 0 8px">คำขอที่รอรับ${pend.length ? ` (${pend.length})` : ''}</h2><div class="list">` +
      (pend.length ? pend.map(s => `<div class="row"><div class="grow"><div class="t">${esc(when(s))}</div><div class="muted small">${esc(s.teacherName)} · ${esc(s.topic || '')}${s.note ? ' · ' + esc(s.note) : ''}</div></div>
        <div class="dp-acts">${tel(s.teacherPhone)}<button class="btn sm pri" ${act('decide', `data-id="${esc(s.id)}"`)}>รับ / ปฏิเสธ</button></div></div>`).join('') : '<p class="muted">ไม่มีคำขอค้างอยู่</p>') + '</div></div>';
    /* เสาร์–อาทิตย์ สัปดาห์นี้ผ่านไปหมดแล้ว เริ่มที่สัปดาห์หน้า */
    const w0 = D.mondayOf(D.addDays(t, D.dow(t) === 6 || D.dow(t) === 0 ? 2 : 0));
    if (!U.week || U.week < w0) U.week = w0;
    const wk = U.week, days = [0, 1, 2, 3, 4].map(i => D.addDays(wk, i)), maxD = D.addMonths(t, cfg.maxMonths);
    const canPrev = wk > w0, canNext = D.addDays(wk, 7) <= maxD;
    const cls = { open: 'free', requested: 'req', confirmed: 'conf', declined: 'rej', cancelled: 'rej' };
    const right = `<div class="card"><div class="dp-calh"><button class="btn sm" ${act('wk', 'data-d="-7"')} ${canPrev ? '' : 'disabled'} aria-label="สัปดาห์ก่อน">‹</button><b>${D.thaiDate(days[0]).slice(3)} – ${D.thaiDate(days[4]).slice(3)}</b><button class="btn sm" ${act('wk', 'data-d="7"')} ${canNext ? '' : 'disabled'} aria-label="สัปดาห์ถัดไป">›</button></div>
      <p class="muted small">แตะ “+” เพื่อเปิดเวลาว่าง แตะ “ว่าง” อีกครั้งเพื่อปิด · แตะช่องที่มีครูจองเพื่อดูรายละเอียด</p>
      <div class="scroll"><table class="dp-g"><thead><tr><th></th>${days.map(d => `<th>${D.DOW[D.dow(d)]} ${D.parse(d).getDate()}${D.officerDateProblem(d, t, cfg) ? '' : `<br><button class="btn sm dp-day" ${act('wday', `data-d="${d}"`)}>ทั้งวัน</button>`}</th>`).join('')}</tr></thead><tbody>` +
      D.slotStarts(cfg).map(st => `<tr><td class="t">${st}</td>${days.map(d => {
        if (D.officerDateProblem(d, t, cfg)) return '<td><button class="c" disabled>–</button></td>';
        const s = map[D.slotId(me, d, st)], a = act('cell', `data-d="${d}" data-s="${st}"`);
        if (!s) return `<td><button class="c" ${a}>+</button></td>`;
        return `<td><button class="c ${cls[s.status]}" ${a}>${s.status === 'open' ? 'ว่าง' : D.STATUS[s.status] + '<br>' + esc(short(s.teacherName || ''))}</button></td>`;
      }).join('')}</tr>`).join('') + `</tbody></table></div>
      <div class="dp-rep"><span>คัดลอกช่วงว่างของสัปดาห์นี้ไปอีก</span><input type="number" id="dpRep" class="in" value="4" min="1" max="26"><span>สัปดาห์</span><button class="btn sm" ${act('repeat')}>คัดลอก</button></div></div>`;
    return `<div class="dp-split">${left}${right}</div>`;
  }
  function cellAct(date, st) {
    const id = D.slotId(meKey(), date, st), s = db().slots[id], base = { officer: meKey(), officerName: S.me.name, date, start: st };
    if (!s) return run(() => store.putOpen([base]));
    if (s.status === 'open') return run(() => store.remove(id));
    if (s.status === 'requested') return decideModal(id);
    const x = Object.assign({ id }, s);
    const info = `<p><b>${esc(when(x))}</b><br>${badge(s.status)} ${esc(s.teacherName || '')}<br>${esc(s.topic || '')}${s.note ? `<br><span class="muted small">หมายเหตุ: ${esc(s.note)}</span>` : ''}</p><p>${tel(s.teacherPhone)}</p>`;
    if (s.status === 'confirmed') return modal(`<h2 style="margin:0 0 6px">คิวที่รับแล้ว</h2>${info}<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="close">ปิด</button><button class="btn" ${act('offCancel', `data-id="${esc(id)}"`)}>ยกเลิกคิวนี้</button></div>`, true);
    modal(`<h2 style="margin:0 0 6px">คิวที่สิ้นสุดแล้ว</h2>${info}<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn" data-act="close">ปิด</button><button class="btn" ${act('drop', `data-id="${esc(id)}"`)}>ลบช่องนี้</button><button class="btn pri" ${act('reopen', `data-id="${esc(id)}"`)}>เปิดว่างอีกครั้ง</button></div>`, true);
  }
  function decideModal(id) {
    const s = Object.assign({ id }, db().slots[id]);
    modal(`<h2 style="margin:0 0 6px">คำขอจองคิว</h2><p><b>${esc(when(s))}</b><br>${esc(s.teacherName)} · ${esc(s.topic || '')}${s.note ? `<br><span class="muted small">หมายเหตุ: ${esc(s.note)}</span>` : ''}</p><p>${tel(s.teacherPhone)}</p>
      <div class="field"><label class="f" for="dpONote">ข้อความถึงครู (ไม่บังคับ)</label><input id="dpONote" class="in" maxlength="200"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">ปิด</button><button class="btn" ${act('decline', `data-id="${esc(id)}"`)}>ปฏิเสธ</button><button class="btn pri" ${act('accept', `data-id="${esc(id)}"`)}>รับคิว</button></div>`, true);
  }

  /* ================= ตั้งค่า (แอดมิน) ================= */
  const draft = () => { if (!U.draft) { const c = D.withDefaults(db().cfg); U.draft = { officers: c.officers.map(o => Object.assign({}, o)), holidays: c.holidays.slice(), topics: c.topics.slice(), maxActive: c.maxActive, minLeadDays: c.minLeadDays }; } return U.draft; };
  function vAdmin() {
    const d = draft(), cfg = cfgOf(), all = slotsArr().filter(s => s.status !== 'open').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const school = (S.events || []).filter(e => e.cat === 'holiday' && e.date >= today()).length;
    const offCard = `<div class="card"><h2 style="margin:0 0 4px">เจ้าหน้าที่ (สูงสุด 4 คน)</h2><p class="muted small">เลือกจากทะเบียนบุคลากร · เบอร์โทรดึงจากทะเบียน แก้ทับได้ที่นี่</p><div class="list">` +
      (d.officers.length ? d.officers.map((o, i) => `<div class="row"><div class="grow"><div class="t">${esc(o.name)}</div><div class="muted small">${esc(o.email)}</div></div><input class="in dp-ph" inputmode="tel" data-dpaf="phone" data-i="${i}" value="${esc(o.phone)}" placeholder="เบอร์โทร" aria-label="เบอร์โทร ${esc(o.name)}"><button class="btn sm" ${act('rmOff', `data-i="${i}"`)}>เอาออก</button></div>`).join('') : '<p class="muted">ยังไม่ได้เลือก</p>') +
      `</div><button class="btn" style="margin-top:8px" ${act('pickOff')}>เลือกจากทะเบียนบุคลากร</button></div>`;
    const ruleCard = `<div class="card"><h2 style="margin:0 0 8px">กติกาการจอง</h2><div class="grid g2"><div class="field"><label class="f" for="dpMx">คิวที่ครูมีพร้อมกันได้</label><input id="dpMx" class="in" type="number" min="1" max="10" data-dpaf="maxActive" value="${d.maxActive}"></div><div class="field"><label class="f" for="dpMl">จองล่วงหน้าอย่างน้อย (วัน)</label><input id="dpMl" class="in" type="number" min="0" max="30" data-dpaf="minLeadDays" value="${d.minLeadDays}"></div></div>
      <div class="field"><label class="f" for="dpTp">เรื่องที่จอง (บรรทัดละเรื่อง)</label><textarea id="dpTp" class="in" rows="3" data-dpaf="topics">${esc(d.topics.join('\n'))}</textarea></div>
      <div class="field"><label class="f" for="dpHd">วันหยุดพิเศษของงานนี้</label><div style="display:flex;gap:8px"><input id="dpHd" class="in" type="date" style="width:auto"><button class="btn sm" ${act('addHol')}>เพิ่ม</button></div>
      <div class="dp-acts" style="margin-top:8px;justify-content:flex-start">${d.holidays.slice().sort().map(h => `<button class="btn sm" ${act('rmHol', `data-d="${h}"`)} title="แตะเพื่อลบ">${D.thaiDate(h)} ✕</button>`).join('')}</div>
      <p class="muted small">วันหยุดโรงเรียนจากปฏิทินกลางปิดการจองให้อัตโนมัติ (ข้างหน้า ${school} วัน) ไม่ต้องเพิ่มซ้ำ</p></div>
      <p class="muted small">เวลาราชการ ${cfg.dayStart}–${cfg.dayEnd} น. คิวละ ${cfg.slotMinutes} นาที จันทร์–ศุกร์ ล่วงหน้าไม่เกิน ${cfg.maxMonths} เดือน</p>
      <button class="btn pri" ${act('saveCfg')}>บันทึกการตั้งค่า</button></div>`;
    const listCard = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">คิวที่จองแล้ว (${all.length})</h2><button class="btn sm" ${act('csv')} ${all.length ? '' : 'disabled'}>${ic('up')}CSV</button></div><div class="list" style="margin-top:8px">` +
      (all.length ? all.map(s => `<div class="row"><div class="grow"><div class="t">${esc(when(s))}</div><div class="muted small">${esc(s.teacherName)} → ${esc(offName(s.officer))} · ${esc(s.topic || '')}</div></div>${badge(s.status)}</div>`).join('') : '<p class="muted">ยังไม่มีการจอง</p>') + '</div></div>';
    return `<div class="dp-tri">${offCard}${ruleCard}${listCard}</div>`;
  }
  function pickOfficers() {
    const d = draft(), sel = new Set(d.officers.map(o => o.email));
    const list = (S.staff || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'th'));
    const rows = q => list.filter(u => !q || u.name.indexOf(q) >= 0).map(u => u.email
      ? `<label class="dp-pk"><input type="checkbox" data-dpaf="pick" value="${esc(D.stdId(u.email))}" ${sel.has(D.stdId(u.email)) ? 'checked' : ''}><span>${esc(u.name)} <small class="muted">${esc(u.dept || '')}</small></span></label>`
      : `<label class="dp-pk off" title="เพิ่มอีเมลในหน้าผู้ใช้และสิทธิ์ก่อน"><input type="checkbox" disabled><span>${esc(u.name)} <small>· ยังไม่มีอีเมล</small></span></label>`).join('') || '<p class="muted">ไม่พบชื่อ</p>';
    U.pick = sel; U.pickRows = rows;
    modal(`<h2 style="margin:0 0 8px">เลือกเจ้าหน้าที่ (${list.length} คน)</h2><input id="dpPq" class="in" placeholder="ค้นชื่อ" data-dpaf="pq"><div class="dp-pick" id="dpPlist">${rows('')}</div><p class="muted small" id="dpPcnt">เลือกแล้ว ${sel.size} / 4 คน</p>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" ${act('pickOk')}>ตกลง</button></div>`, true);
  }

  /* ================= หน้า ================= */
  P.dpa = () => {
    store.prune();
    const tabs = [['book', 'จองคิว'], ['mine', 'คิวของฉัน', mySlots().length]];
    if (isOfficer()) tabs.push(['work', 'งานเจ้าหน้าที่', pending().length]);
    if (isAdmin()) tabs.push(['admin', 'ตั้งค่า']);
    const tab = tabs.some(t => t[0] === U.tab) ? U.tab : 'book';
    return hd('จองคิว DPA / วิทยฐานะ', 'นัดเจ้าหน้าที่ช่วยลงข้อมูล DPA และยื่นขอมี/เลื่อนวิทยฐานะ' + (isOfficer() ? ' · คุณเป็นเจ้าหน้าที่' : '')) +
      `<div class="pills" role="tablist" style="margin-bottom:14px">${tabs.map(([k, l, n]) => `<button class="pill" role="tab" aria-pressed="${k === tab}" ${act('tab', `data-t="${k}"`)}>${l}${n ? ` <span class="dp-n">${n}</span>` : ''}</button>`).join('')}</div>` +
      ({ book: vBook, mine: vMine, work: vWork, admin: vAdmin })[tab]();
  };

  /* ================= เหตุการณ์ ================= */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-dpa]'); if (!el) return;
    const a = el.dataset.dpa, id = el.dataset.id, $v = s => document.querySelector(s);
    switch (a) {
      case 'tab': U.tab = el.dataset.t; U.draft = null; return render();
      case 'off': U.officer = el.dataset.e; return render();
      case 'mon': U.month = D.addMonths(U.month, +el.dataset.d); return render();
      case 'day': U.date = el.dataset.d; return render();
      case 'book': return bookModal(id);
      case 'bookOk': {
        const phone = $v('#dpPhone').value.trim(); if (phone.replace(/\D/g, '').length < 9) return toast('กรอกเบอร์ติดต่อให้ครบ');
        const p = D.bookProblem(db().slots[id], slotsArr(), meKey(), cfgOf(), today(), isAdmin()); if (p) return toast(p);
        const t = { teacherEmail: meKey(), teacherName: S.me.name, teacherPhone: phone, topic: $v('#dpTopic').value, note: $v('#dpNote').value.trim() };
        closeModal(); return run(() => store.book(id, t), 'ส่งคำขอแล้ว รอเจ้าหน้าที่กดรับ');
      }
      case 'cancel': { const s = Object.assign({ id }, db().slots[id]);
        return modal(`<h2 style="margin:0 0 6px">ยกเลิกคิวนี้?</h2><p>${esc(when(s))}<br>เจ้าหน้าที่ ${esc(offName(s.officer))}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="close">ไม่ยกเลิก</button><button class="btn pri" style="background:var(--bad);border-color:var(--bad)" ${act('cancelOk', `data-id="${esc(id)}"`)}>ยกเลิกคิว</button></div>`, true); }
      case 'cancelOk': closeModal(); return run(() => store.setStatus(id, 'cancelled', { cancelledAt: iso() }), 'ยกเลิกคิวแล้ว');
      case 'decide': return decideModal(id);
      case 'accept': case 'decline': { const note = ($v('#dpONote') || {}).value || ''; closeModal();
        return run(() => store.setStatus(id, a === 'accept' ? 'confirmed' : 'declined', { decidedAt: iso(), officerNote: note.trim() }), a === 'accept' ? 'รับคิวแล้ว' : 'ปฏิเสธแล้ว'); }
      case 'offCancel': closeModal(); return run(() => store.setStatus(id, 'cancelled', { decidedAt: iso(), officerNote: 'เจ้าหน้าที่ยกเลิกคิว' }), 'ยกเลิกแล้ว');
      case 'drop': closeModal(); return run(() => { store.reopen(id); store.remove(id); });
      case 'reopen': closeModal(); return run(() => store.reopen(id), 'เปิดช่องว่างแล้ว');
      case 'wk': U.week = D.addDays(U.week, +el.dataset.d); return render();
      case 'cell': return cellAct(el.dataset.d, el.dataset.s);
      case 'wday': {
        const d = el.dataset.d, me = meKey(), list = D.slotStarts(cfgOf()).map(st => ({ officer: me, officerName: S.me.name, date: d, start: st })), missing = list.filter(x => !db().slots[D.slotId(me, d, x.start)]);
        if (missing.length) return run(() => store.putOpen(missing));
        return run(() => list.forEach(x => { const k = D.slotId(me, d, x.start), s = db().slots[k]; if (s && s.status === 'open') store.remove(k); }));
      }
      case 'repeat': {
        const n = Math.min(26, Math.max(1, +$v('#dpRep').value || 1)), me = meKey(), all = slotsArr();
        const wk = all.filter(s => s.officer === me && s.status === 'open' && s.date >= U.week && s.date <= D.addDays(U.week, 4));
        if (!wk.length) return toast('สัปดาห์นี้ยังไม่มีช่วงว่างให้คัดลอก');
        const plan = D.repeatPlan(wk, n, all, me, today(), cfgOf()).map(x => ({ officer: me, officerName: S.me.name, date: x.date, start: x.start }));
        if (!plan.length) return toast('ไม่มีช่องใหม่ให้เพิ่ม (มีอยู่แล้ว วันหยุด หรือเกินขอบเขต)');
        return run(() => store.putOpen(plan), 'เพิ่มช่วงว่างอีก ' + plan.length + ' ช่อง');
      }
      case 'pickOff': return pickOfficers();
      case 'pickOk': {
        if (U.pick.size > 4) return toast('เลือกได้ไม่เกิน 4 คน');
        const d = draft(), keep = d.officers.filter(o => U.pick.has(o.email));
        U.pick.forEach(em => { if (!keep.some(o => o.email === em)) { const u = S.staff.find(x => x.email && D.stdId(x.email) === em); if (u) keep.push({ email: em, name: u.name, phone: u.phone || '' }); } });
        d.officers = keep; closeModal(); return render();
      }
      case 'rmOff': draft().officers.splice(+el.dataset.i, 1); return render();
      case 'addHol': { const v = $v('#dpHd').value, d = draft(); if (v && d.holidays.indexOf(v) < 0) d.holidays.push(v); return render(); }
      case 'rmHol': draft().holidays = draft().holidays.filter(h => h !== el.dataset.d); return render();
      case 'saveCfg': {
        const d = draft(); if (d.officers.length > 4) return toast('เจ้าหน้าที่ได้ไม่เกิน 4 คน');
        const topics = d.topics.filter(Boolean);
        const cfg = Object.assign({}, db().cfg, { officers: d.officers, officerEmails: d.officers.map(o => o.email), holidays: d.holidays, topics: topics.length ? topics : D.withDefaults().topics,
          maxActive: Math.max(1, +d.maxActive || 2), minLeadDays: Math.max(0, +d.minLeadDays || 0) });
        /* ช่องว่างของคนที่ถูกเอาออกจากเจ้าหน้าที่ ลบทิ้ง (คิวที่มีครูจองแล้วเก็บไว้ให้เห็นประวัติ) */
        Object.keys(db().slots).forEach(k => { const s = db().slots[k]; if (s.status === 'open' && cfg.officerEmails.indexOf(s.officer) < 0) delete db().slots[k]; });
        U.draft = null; return run(() => store.saveConfig(cfg), 'บันทึกแล้ว');
      }
      case 'csv': { const b = new Blob([D.toCsv(slotsArr(), cfgOf())], { type: 'text/csv;charset=utf-8' }), u = URL.createObjectURL(b), x = document.createElement('a'); x.href = u; x.download = 'คิว-DPA-' + today() + '.csv'; x.click(); return setTimeout(() => URL.revokeObjectURL(u), 2000); }
    }
  });
  document.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.dpaf; if (!k) return;
    if (k === 'pq') { document.getElementById('dpPlist').innerHTML = U.pickRows(e.target.value.trim()); return; }
    if (k === 'pick') return;
    const d = draft();
    if (k === 'phone') d.officers[+e.target.dataset.i].phone = e.target.value.trim();
    else if (k === 'topics') d.topics = e.target.value.split('\n').map(x => x.trim());
    else d[k] = e.target.value;
  });
  document.addEventListener('change', e => {
    if (!(e.target.dataset && e.target.dataset.dpaf === 'pick')) return;
    if (e.target.checked) U.pick.add(e.target.value); else U.pick.delete(e.target.value);
    const c = document.getElementById('dpPcnt'); if (c) c.textContent = 'เลือกแล้ว ' + U.pick.size + ' / 4 คน';
  });

  const css = document.createElement('style');
  css.textContent = `
.dp-offs{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px}
.dp-of{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:150px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}
.dp-of[aria-pressed="true"]{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset;background:color-mix(in srgb,var(--brand) 8%,var(--surface))}
.dp-split{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:14px;align-items:start}
.dp-tri{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start}
@media(max-width:860px){.dp-split{grid-template-columns:1fr}}
.dp-calh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.dp-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:440px;margin:0 auto}
.dp-cal .dw{text-align:center;font-size:.78rem;color:var(--muted)}
.dp-cal button{position:relative;height:40px;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-weight:600;cursor:pointer;min-height:36px}
.dp-cal button:disabled{background:none;border-color:transparent;color:var(--muted);opacity:.55;cursor:default}
.dp-cal button.has{background:color-mix(in srgb,var(--ok) 12%,var(--surface));border-color:color-mix(in srgb,var(--ok) 45%,var(--line))}
.dp-cal button.today{outline:2px solid var(--brand);outline-offset:-2px}
.dp-cal button.sel{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.dp-cal i{position:absolute;right:3px;bottom:1px;font-style:normal;font-size:.66rem;font-weight:700}
.dp-g{border-collapse:separate;border-spacing:3px;width:100%}
.dp-g th{font-size:.8rem;font-weight:600;color:var(--muted);text-align:center;padding:2px}
.dp-g td.t{font-size:.8rem;color:var(--muted);white-space:nowrap;padding-right:4px}
.dp-g .c{width:100%;min-width:64px;min-height:40px;border:1px solid var(--line);border-radius:6px;background:var(--surface2);color:var(--muted);font-size:.78rem;line-height:1.2;cursor:pointer}
.dp-g .c:disabled{cursor:default}
.dp-g .c.free{background:color-mix(in srgb,var(--ok) 14%,var(--surface));border-color:color-mix(in srgb,var(--ok) 50%,var(--line));color:var(--text);font-weight:600}
.dp-g .c.mine,.dp-g .c.conf{background:color-mix(in srgb,var(--brand) 14%,var(--surface));border-color:var(--brand);color:var(--text)}
.dp-g .c.req{background:color-mix(in srgb,var(--warn) 18%,var(--surface));border-color:var(--warn);color:var(--text)}
.dp-g .c.rej{background:color-mix(in srgb,var(--bad) 10%,var(--surface));color:var(--text)}
.dp-day{min-height:24px!important;padding:0 6px!important;font-size:.72rem!important;margin-top:2px}
.dp-rep{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;font-size:.88rem}.dp-rep .in{width:70px}
.dp-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.dp-ph{width:130px}
.dp-n{display:inline-block;min-width:18px;padding:0 5px;border-radius:9px;background:var(--bad);color:#fff;font-size:.72rem;line-height:18px;text-align:center}
.dp-pick{max-height:46vh;overflow:auto;margin:8px 0;border:1px solid var(--line);border-radius:8px}
.dp-pk{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line);cursor:pointer}
.dp-pk.off{color:var(--muted);cursor:not-allowed}`;
  document.head.appendChild(css);
})();
