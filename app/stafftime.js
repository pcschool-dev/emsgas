/* EMS — ลงเวลาทำงานของครูและบุคลากร
   แหล่งเวลา (รวมไว้ที่คอลเลกชันเดียว staffEvents/{วันที่_อีเมล_วิธี_เข้า/ออก}):
   - face   = แอปสแกนหน้าที่ประตู (D:\2.ระบบเช็คชื่อผ่านกล้อง ลงทะเบียนครูในห้อง "บุคลากร" รหัส = อีเมล) เขียนด้วยบัญชีเครื่องสแกน
   - gps    = ครูกด "ลงเวลาด้วยมือถือ" ในเขตโรงเรียน (ไม่เก็บพิกัด เก็บแค่ระยะห่างและความแม่นยำ) · เวลาตรวจกับนาฬิกาเซิร์ฟเวอร์ในกฎ
   - finger = เครื่องสแกนนิ้ว — ตอนนี้นำเข้าไฟล์ในหน้าฝ่ายบุคคล · ตัวเชื่อมเครื่องโดยตรงในอนาคตเขียนรูปเดียวกัน (รหัสในเครื่อง → อีเมล ด้วย hrCfg.fingerMap)
   - S.scanTimes (ไฟล์สแกนนิ้วที่นำเข้าแบบเดิม เก็บในเครื่อง) ยังอ่านได้ เพื่อไม่ให้ข้อมูลเก่าหาย
   เวลาเข้า = เวลาแรกของวันจากทุกแหล่ง · เวลาออก = เวลาสุดท้ายที่เป็น "ออก"
   ฝั่งฟัง (cloud.js): S.staffEv.mine = ของฉันเดือนที่ดู · S.staffEv.day = ทั้งโรงเรียนวันเดียว (ฝ่ายบุคคล/ผู้บริหาร/แอดมิน)
   โหมดตัวอย่าง (ไม่ LIVE): เก็บใน S.staffEv.local ของเครื่องนี้ */
(() => {
  'use strict';
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const pad = n => String(n).padStart(2, '0');
  const low = s => String(s || '').trim().toLowerCase();
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const M = { face: 'สแกนหน้า', finger: 'สแกนนิ้ว', gps: 'มือถือ (GPS)', manual: 'ฝ่ายบุคคลบันทึก', file: 'ไฟล์เดิม' };
  S.staffEv = S.staffEv && typeof S.staffEv === 'object' ? S.staffEv : {};
  ['mine', 'day', 'local'].forEach(k => { if (!S.staffEv[k] || typeof S.staffEv[k] !== 'object') S.staffEv[k] = {}; });
  const cfg = () => {        // สำเนารวมค่าตั้งต้น — ไม่เขียนกลับ S.hrCfg (เขียนเฉพาะตอนกดบันทึก ไม่งั้นทุกคนเผลอแก้ config)
    const c = Object.assign({ lateTime: '08:00', outTime: '16:30', remindAt: '08:30', gpsOn: false, since: '', fingerMap: {} }, S.hrCfg || {});      // since = วันแรกที่เริ่มนับ (ก่อนนั้นไม่ขึ้น “ไม่พบการลงเวลา”)
    c.geo = Object.assign({ lat: '', lng: '', radius: 300 }, c.geo || {});
    if (!c.fingerMap || typeof c.fingerMap !== 'object') c.fingerMap = {};
    return c;
  };
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  const has = (...r) => roles().some(x => r.indexOf(x) >= 0);
  const bootAdm = () => ((window.EMS_CONFIG || {}).adminEmails || []).map(low).indexOf(low(S.me.email)) >= 0;
  const boss = () => has('admin', 'personnel', 'exec') || bootAdm();
  const hrAdm = () => has('admin', 'personnel') || bootAdm();      // ตั้งค่า/นำเข้าไฟล์สแกนนิ้ว = แอดมิน/ฝ่ายบุคคล (ตรงกับกฎ finger)
  const staffBy = name => (S.staff || []).find(u => u.name === name) || {};
  const myEmail = () => low((LIVE && window.EMSCloud && EMSCloud.email && EMSCloud.email()) || staffBy(S.me.name).email || S.me.email);
  const emailOf = name => (name === S.me.name ? myEmail() : low(staffBy(name).email));
  const docKey = em => String(em).replace(/[^A-Za-z0-9ก-๙_-]/g, '_');
  const evId = (date, em, method, kind) => `${date}_${docKey(em)}_${method}_${kind}`;
  const isoLocal = d => { const o = -d.getTimezoneOffset(), a = Math.abs(o);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${o >= 0 ? '+' : '-'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`; };
  const hm = at => { const d = new Date(at); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const nowHM = () => hm(new Date());
  const curMon = () => todayISO().slice(0, 7);
  const holiday = d => (S.events || []).some(e => e && e.cat === 'holiday' && e.date <= d && (e.to || e.date) >= d);
  /* วันลงเวลา: ฝ่ายบุคคลติ๊กเองในแท็บ “วันลงเวลา” (hrCfg.workDays = { 'YYYY-MM-DD': 1 ลงเวลา | 0 เว้น })
     วันที่ไม่ได้ติ๊ก = ค่าเริ่มต้น: จันทร์–ศุกร์ ไม่ใช่วันหยุด และอยู่ระหว่างเปิด–ปิดภาคเรียน (ยังไม่กรอกวันเปิด-ปิดภาคเลย = ทุกวันจันทร์–ศุกร์ แบบเดิม) */
  const wdMap = () => (S.hrCfg && S.hrCfg.workDays && typeof S.hrCfg.workDays === 'object') ? S.hrCfg.workDays : {};
  const termsOk = () => (S.terms || []).filter(t => t && t.open && t.close);
  const inTerm = d => { const T = termsOk(); return !T.length || T.some(t => t.open <= d && t.close >= d); };
  const weekend = d => { const w = new Date(d + 'T00:00:00').getDay(); return w === 0 || w === 6; };
  const autoWork = d => !weekend(d) && !holiday(d) && inTerm(d);
  const workday = d => { const v = wdMap()[d]; return v === 1 || v === 0 ? v === 1 : autoWork(d); };
  const offWhy = d => { const v = wdMap()[d]; if (v === 0) return 'เว้นลงเวลา'; if (weekend(d)) return 'วันหยุด';
    const h = (S.events || []).find(e => e && e.cat === 'holiday' && e.date <= d && (e.to || e.date) >= d); if (h) return h.title || 'วันหยุด';
    return inTerm(d) ? 'วันหยุด' : 'ปิดภาคเรียน'; };
  const ready = id => !LIVE || !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready[id] === true);      // 'err' = ฟังไม่ได้ (เช่น ยังไม่วางกฎ) ไม่นับว่ามีข้อมูล
  const failed = id => LIVE && !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready[id] === 'err');
  const LOADERR = 'โหลดข้อมูลเวลาทำงานไม่ได้ — ลองเปิดใหม่ หรือแจ้งฝ่ายบุคคล';

  const ui = { mon: curMon(), busy: '' };
  /* วันที่/เดือนที่ cloud.js ฟัง — ฝ่ายบุคคลเปิดดูวันอื่นในแท็บ "เวลามาทำงาน" */
  const day = () => (typeof page !== 'undefined' && page === 'a-hr' && window.EMSHR && EMSHR.view() === 'time' && EMSHR.date()) || todayISO();
  const mon = () => (typeof page !== 'undefined' && page === 'my-time' ? ui.mon : curMon());

  /* ---------- รวมเวลาของแต่ละคนต่อวัน ---------- */
  const allEv = () => Object.assign({}, S.staffEv.local, S.staffEv.day, S.staffEv.mine);
  function daySum(name, date) {
    const em = emailOf(name), ev = em ? Object.values(allEv()).filter(e => e && e.email === em && e.date === date) : [];
    const legacy = ((S.scanTimes || {})[date] || {})[name];
    if (legacy) ev.push({ kind: 'in', method: 'file', at: date + 'T' + legacy + ':00' });
    const t = e => hm(e.method === 'gps' && e.ms ? +e.ms : e.at), byT = (a, b) => t(a).localeCompare(t(b));      // gps ใช้ ms (กฎตรวจกับนาฬิกาเซิร์ฟเวอร์) ไม่ใช่ at ที่มือถือส่งมา
    const ins = ev.filter(e => e.kind === 'in').sort(byT), outs = ev.filter(e => e.kind === 'out').sort(byT);
    const man = k => ev.find(e => e.method === 'manual' && e.kind === k);      // ฝ่ายบุคคลแก้พร้อมเหตุผล = ใช้ค่านี้แทนเวลาจากเครื่อง
    const i = man('in') || ins[0], o = man('out') || outs[outs.length - 1];
    return { inT: i ? t(i) : '', inM: i ? i.method : '', inAt: i ? i.at : '', outT: o ? t(o) : '', outM: o ? o.method : '', n: ev.length, gpsOut: outs.some(e => e.method === 'gps') };
  }
  /* LIVE: มีข้อมูลทั้งโรงเรียนเฉพาะวันที่ staffDay ฟังอยู่ (เหตุการณ์ของตัวเองจาก staffMine ไม่นับ ไม่งั้นคนอื่นขึ้นขาดหมด) */
  const dayHasData = date => (LIVE ? day() === date && ready('staffDay') : true);
  /* สถานะหนึ่งคนหนึ่งวัน — ใช้ทั้งหน้าฝ่ายบุคคล (dayStatus ใน modules2.js) และหน้าของครูเอง */
  function status(name, date, mineOnly) {
    const lv = (S.leaves || []).find(l => l.by === name && l.status === 'approved' && l.from <= date && (l.to || l.from) >= date);
    const s = daySum(name, date), base = { time: s.inT, out: s.outT, inM: s.inM, outM: s.outM, at: s.inAt };
    if (s.inT) return Object.assign(base, s.inT > cfg().lateTime ? { code: 'late', label: 'มาสาย' } : { code: 'ok', label: 'ทันเวลา' }, lv ? { lv } : {});
    if (lv) { const trip = lv.type === 'trip'; return Object.assign(base, { code: trip ? 'trip' : 'leave', label: trip ? 'ไปราชการ' : 'ลา', lv }); }
    if (!workday(date)) return Object.assign(base, { code: 'off', label: wdMap()[date] === 0 ? 'เว้นลงเวลา' : !weekend(date) && !holiday(date) && !inTerm(date) ? 'ปิดภาคเรียน' : 'วันหยุด' });
    if (date > todayISO()) return Object.assign(base, { code: 'future', label: '' });
    if (!cfg().since || date < cfg().since) return Object.assign(base, { code: 'nodata', label: 'ยังไม่เริ่มนับ' });
    if (!(mineOnly ? ready('staffMine') : dayHasData(date))) return Object.assign(base, { code: 'nodata', label: failed(mineOnly ? 'staffMine' : 'staffDay') ? 'โหลดไม่ได้' : 'ยังไม่มีข้อมูล' });
    if (date === todayISO() && nowHM() < cfg().remindAt) return Object.assign(base, { code: 'wait', label: 'ยังไม่ลงเวลา' });
    return Object.assign(base, { code: 'absent', label: 'ไม่พบการลงเวลา' });
  }
  const KIND = { ok: 'ok', late: 'warn', leave: 'info', trip: 'info', absent: 'bad', wait: '', off: '', nodata: '' };
  const stChip = s => s.label ? chip(s.label, KIND[s.code] || '') : '';

  /* ---------- เขียนเหตุการณ์ ---------- */
  async function put(list) {        // list = [{ id, data }]
    if (!list.length) return 0;
    if (!LIVE) { list.forEach(x => { S.staffEv.local[x.id] = x.data; }); save(); return list.length; }
    const db = window.EMSCloud && EMSCloud.db && EMSCloud.db(); if (!db) throw new Error('ยังไม่ได้เชื่อมระบบ');
    for (let i = 0; i < list.length; i += 400) {
      const b = db.batch(); list.slice(i, i + 400).forEach(x => b.set(db.collection('staffEvents').doc(x.id), x.data)); await b.commit();
    }
    list.forEach(x => { if (x.data.email === myEmail() && x.data.mon === mon()) S.staffEv.mine[x.id] = x.data; if (x.data.date === day() && boss()) S.staffEv.day[x.id] = x.data; });
    return list.length;
  }
  const by = () => low((LIVE && window.EMSCloud && EMSCloud.email && EMSCloud.email()) || S.me.email);

  /* ---------- ลงเวลาด้วยมือถือ + GPS ---------- */
  const dist = (a, b, c, d) => { const R = 6371000, r = x => x * Math.PI / 180, dl = r(c - a), dn = r(d - b);
    const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const where = () => new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง'));
    navigator.geolocation.getCurrentPosition(res, e => rej(new Error(e.code === 1 ? 'ไม่ได้อนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่งของเบราว์เซอร์แล้วลองใหม่' : e.code === 3 ? 'หาตำแหน่งไม่ทันเวลา — ลองใหม่ในที่โล่ง' : 'หาตำแหน่งไม่ได้ — เปิด GPS แล้วลองใหม่')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
  async function gps(kind) {
    const c = cfg(), lat = parseFloat(c.geo.lat), lng = parseFloat(c.geo.lng), rad = Math.max(50, +c.geo.radius || 300);
    if (!c.gpsOn) return toast('ฝ่ายบุคคลยังไม่เปิดให้ลงเวลาด้วยมือถือ');
    if (!isFinite(lat) || !isFinite(lng)) return toast('ฝ่ายบุคคลยังไม่ได้ตั้งพิกัดโรงเรียน');
    if (kind === 'out' && nowHM() < c.outTime && !confirm(`ยังไม่ถึงเวลาเลิกงาน (${c.outTime} น.) — ลงเวลาออกตอนนี้เลยไหม?`)) return;
    ui.busy = kind; redraw();
    try {
      const p = await where(), acc = Math.round(p.coords.accuracy || 9999), d = Math.round(dist(lat, lng, p.coords.latitude, p.coords.longitude));
      if (acc > 150) throw new Error(`ตำแหน่งยังไม่แม่นพอ (คลาดได้ ±${acc} ม.) — เปิด GPS แล้วลองใหม่ในที่โล่ง`);
      if (d - Math.min(acc, 50) > rad) throw new Error(`อยู่นอกเขตโรงเรียน (ห่างประมาณ ${d.toLocaleString()} ม.) — ลงเวลาด้วยมือถือได้เฉพาะในเขตโรงเรียน`);
      const now = new Date(), date = todayISO(), em = myEmail();
      await put([{ id: evId(date, em, 'gps', kind), data: { email: em, name: S.me.name, date, mon: date.slice(0, 7), at: isoLocal(now), ms: now.getTime(), kind, method: 'gps', deviceId: 'mobile', acc, dist: d, by: by() } }]);
      toast((kind === 'in' ? 'ลงเวลาเข้า ' : 'ลงเวลาออก ') + hm(now) + ' น. แล้ว');
    } catch (e) { toast(e.code === 'permission-denied' ? 'ระบบไม่รับการลงเวลา — เวลาเครื่องอาจไม่ตรง หรือยังไม่ได้วางกฎ firestore.rules ใหม่' : (e.message || String(e))); }
    ui.busy = ''; redraw();
  }

  /* ---------- การ์ดหน้าหลัก + หน้าเวลาทำงานของฉัน ---------- */
  const isTeacherUser = () => !!S.me && !has('student') && !!S.me.name;
  function gpsBtns(s) {
    const c = cfg(); if (!c.gpsOn || !workday(todayISO())) return '';
    const b = (k, l) => `<button class="btn sm${k === 'in' ? ' pri' : ''}" data-st="gps" data-k="${k}" ${ui.busy ? 'disabled' : ''}>${ui.busy === k ? 'กำลังหาตำแหน่ง…' : l}</button>`;
    return !s.time ? b('in', 'ลงเวลาเข้าด้วยมือถือ') : b('out', s.out && s.outM === 'gps' ? 'ลงเวลาออกใหม่' : 'ลงเวลาออกด้วยมือถือ');
  }
  function card() {
    if (!isTeacherUser()) return '';
    const t = todayISO(), s = status(S.me.name, t, true);
    if (s.code === 'off' && !s.time) return '';
    const ico = { ok: 'ok', late: 'gold', absent: 'bad', leave: 'info', trip: 'info' }[s.code] || '';
    const line = s.time ? `เข้า <b>${esc(s.time)}</b> น. · ${esc(M[s.inM] || '')}${s.out ? ` · ออก <b>${esc(s.out)}</b> น. · ${esc(M[s.outM] || '')}` : ''}`
      : s.code === 'leave' || s.code === 'trip' ? esc((s.lv && s.lv.reason) || s.label) : s.code === 'nodata' ? (s.label === 'ยังไม่เริ่มนับ' ? 'ฝ่ายบุคคลยังไม่เริ่มนับการลงเวลา' : s.label === 'โหลดไม่ได้' ? LOADERR : 'กำลังโหลด…') : `ยังไม่มีเวลาเข้า · มาสายหลัง ${esc(cfg().lateTime)} น.`;
    return `<div class="card st-card" style="margin-bottom:14px"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:10px">
      <div class="ico ${ico}">${ic('check')}</div><div class="grow" style="min-width:180px"><div class="t">เวลาทำงานวันนี้ ${stChip(s)}</div><div class="muted small">${line}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${gpsBtns(s)}<button class="btn sm" data-act="go" data-p="my-time">ดูย้อนหลัง</button></div></div></div>`;
  }
  const baseHome = P.home;
  if (baseHome) P.home = () => { const h = baseHome(), c = card(); if (!c) return h; const at = h.indexOf('<div class="grid split">'); return at >= 0 ? h.slice(0, at) + c + h.slice(at) : c + h; };

  function monthDays(m) {
    const [y, mo] = m.split('-').map(Number), n = new Date(y, mo, 0).getDate(), t = todayISO(), out = [];
    for (let d = 1; d <= n; d++) { const iso = `${m}-${pad(d)}`; if (iso > t) break; out.push(iso); }
    return out.reverse();
  }
  P['my-time'] = () => {
    const m = ui.mon, days = monthDays(m), rows = days.map(d => ({ d, s: status(S.me.name, d, true) })).filter(r => r.s.time || (r.s.code !== 'off' && r.s.label !== 'ยังไม่เริ่มนับ'));
    const n = c => rows.filter(r => r.s.code === c).length, c = cfg();
    const mons = []; { const d = new Date(); for (let i = 0; i < 6; i++) { mons.push(d.getFullYear() + '-' + pad(d.getMonth() + 1)); d.setDate(1); d.setMonth(d.getMonth() - 1); } }
    const mName = x => new Date(x + '-01T00:00:00').toLocaleDateString((window.EMSLang && EMSLang.locale()) || 'th-TH', { month: 'long', year: 'numeric' });
    return `<div class="top"><div><h1>เวลาทำงานของฉัน</h1><p>รวมเวลาจากสแกนหน้า สแกนนิ้ว และมือถือ · มาสายหลัง ${esc(c.lateTime)} น. · เลิกงาน ${esc(c.outTime)} น.</p></div></div>
      ${m === curMon() ? card() : ''}
      <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><div class="field" style="margin:0"><label class="f" for="st-mon">เดือน</label>
        <select id="st-mon" class="in" data-st="mon">${mons.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${esc(mName(x))}</option>`).join('')}</select></div></div>
      <div class="grid g4" style="margin-top:6px">${kpiB('มาทันเวลา', n('ok'), 'var(--ok)')}${kpiB('มาสาย', n('late'), 'var(--warn)')}${kpiB('ลา / ไปราชการ', n('leave') + n('trip'))}${kpiB('ไม่พบการลงเวลา', n('absent'), 'var(--bad)')}</div></div>
      <div class="card"><h2>รายวัน · ${esc(mName(m))}</h2>${!ready('staffMine') ? `<div class="empty">${failed('staffMine') ? LOADERR : 'กำลังโหลด…'}</div>` : rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>วันที่</th><th>เข้า</th><th>ออก</th><th>สถานะ</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td style="white-space:nowrap">${esc(thDate(r.d))}</td><td>${r.s.time ? `<b>${esc(r.s.time)}</b> <span class="muted small">${esc(M[r.s.inM] || '')}</span>` : ''}</td><td>${r.s.out ? `${esc(r.s.out)} <span class="muted small">${esc(M[r.s.outM] || '')}</span>` : ''}</td><td style="white-space:nowrap">${stChip(r.s)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีวันทำงานในเดือนนี้</div>'}
        <p class="muted small" style="margin-top:8px">ถ้าสแกนแล้วแต่ไม่ขึ้น หรือลืมสแกน แจ้งฝ่ายบุคคลเพื่อตรวจสอบ${c.gpsOn ? ' · ลงเวลาด้วยมือถือได้เฉพาะในเขตโรงเรียน ระบบเก็บแค่ระยะห่างจากโรงเรียน ไม่เก็บตำแหน่งของคุณ' : ''}</p></div>`;
  };
  const kpiB = (l, v, color) => `<div class="card kpi" style="margin:0"><div class="l">${l}</div><div class="v"${color ? ` style="color:${color}"` : ''}>${v}</div></div>`;
  if (window.EMSNav) { const g = (EMSNav.NAVG.teacher || []).find(x => x[0] === 'งานของฉัน'); if (g && !g[1].some(x => x[0] === 'my-time')) g[1].unshift(['my-time', 'เวลาทำงานของฉัน', 'check']); }

  /* ---------- หน้าฝ่ายบุคคล: แท็บเวลามาทำงาน + ตั้งค่า (modules2.js เรียก) ---------- */
  const ORD = { absent: 0, late: 1, wait: 2, leave: 3, trip: 4, ok: 5, nodata: 6, off: 7, future: 8 };
  const onlyFor = t => `<div class="card empty">${t}</div>`;
  function hrTime(date, list) {
    if (!boss()) return onlyFor('เวลามาทำงานของบุคลากรทั้งโรงเรียน ดูได้เฉพาะฝ่ายบุคคล/ผู้บริหาร');      // คนอื่นไม่ได้ฟัง staffDay → จะขึ้นขาดหมด
    const rows = list.map(u => ({ u, s: status(u.name, date) })).sort((a, b) => ORD[a.s.code] - ORD[b.s.code] || String(a.u.name).localeCompare(b.u.name, 'th'));
    const n = c => rows.filter(r => r.s.code === c).length, noMail = list.filter(u => !u.email).length;
    return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><div class="field" style="margin:0"><label class="f" for="hr-d">วันที่</label><input id="hr-d" class="in" type="date" value="${esc(date)}"></div><span class="grow"></span>
        ${hrAdm() ? `<label class="btn" for="st-f">${ic('up')}นำเข้าไฟล์สแกนนิ้ว (.csv)</label><input id="st-f" class="sr" type="file" accept=".csv,.txt,.tsv" data-st="file">` : ''}</div>
        <div class="grid g4" style="margin-top:6px">${kpiB('มาทันเวลา', n('ok'), 'var(--ok)')}${kpiB('มาสาย', n('late'), 'var(--warn)')}${kpiB('ลา / ไปราชการ', n('leave') + n('trip'))}${kpiB(date === todayISO() && nowHM() < cfg().remindAt ? 'ยังไม่ลงเวลา' : 'ไม่พบการลงเวลา', n('absent') + n('wait'), 'var(--bad)')}</div></div>
      <div class="card" style="margin-top:16px"><h2>รายวัน · ${esc(thDate(date))}${workday(date) ? '' : ' · ไม่ต้องลงเวลา (' + esc(offWhy(date)) + ')'}</h2><div class="scroll"><table class="tbl"><thead><tr><th>ครู</th><th>กลุ่มสาระ</th><th>เข้า</th><th>ออก</th><th>สถานะ</th>${hrAdm() ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${esc(r.u.name)}</b>${r.u.email ? '' : ' <span class="muted small">(ไม่มีอีเมล)</span>'}</td><td>${esc(r.u.dept || '')}</td><td>${r.s.time ? `${esc(r.s.time)} <span class="muted small">${esc(M[r.s.inM] || '')}</span>` : ''}</td><td>${r.s.out ? `${esc(r.s.out)} <span class="muted small">${esc(M[r.s.outM] || '')}</span>` : ''}</td><td style="white-space:nowrap">${r.s.code === 'nodata' ? `<span class="muted small">${esc(r.s.label)}</span>` : stChip(r.s)}</td>${hrAdm() ? `<td>${r.u.email ? `<button class="btn sm" data-st="edit" data-em="${esc(low(r.u.email))}" data-n="${esc(r.u.name)}" data-d="${esc(date)}" data-i="${esc(r.s.time || '')}" data-o="${esc(r.s.out || '')}">แก้เวลา</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      ${failed('staffDay') && day() === date ? `<p class="muted small" style="margin-top:8px">${LOADERR}</p>` : ''}
      <p class="muted small" style="margin-top:8px">“ไม่พบการลงเวลา” คือไม่มีเวลาจากเครื่องใดเลยและไม่มีใบลา — ตรวจสอบกับครูก่อนบันทึกเป็นขาดราชการ${noMail ? ` · บุคลากร ${noMail} คนยังไม่มีอีเมลในทะเบียน จึงจับคู่เวลาจากเครื่องสแกนไม่ได้` : ''}</p></div>`;
  }
  function hrSetup(list) {
    if (!hrAdm()) return onlyFor('การตั้งค่าลงเวลาทำงาน แก้ได้เฉพาะฝ่ายบุคคล/แอดมิน');
    const c = cfg(), g = c.geo, fm = c.fingerMap, idOf = em => Object.keys(fm).find(k => fm[k] === em) || '';
    return `<div class="card"><h2>เกณฑ์เวลา</h2><div class="grid g2">
        <div class="field"><label class="f" for="st-late">มาสายเมื่อลงเวลาหลัง</label><input id="st-late" class="in" type="time" value="${esc(c.lateTime)}"></div>
        <div class="field"><label class="f" for="st-outt">เวลาเลิกงาน</label><input id="st-outt" class="in" type="time" value="${esc(c.outTime)}"></div>
        <div class="field"><label class="f" for="st-rem">แจ้งเตือนครูที่ยังไม่ลงเวลาตั้งแต่</label><input id="st-rem" class="in" type="time" value="${esc(c.remindAt)}"></div>
        <div class="field"><label class="f" for="st-since">เริ่มนับการลงเวลาตั้งแต่วันที่</label><input id="st-since" class="in" type="date" value="${esc(c.since || todayISO())}"></div></div>
        <p class="muted small" style="margin-top:6px">วันก่อนวันที่เริ่มนับจะไม่ขึ้นว่า “ไม่พบการลงเวลา” และไม่แจ้งเตือน</p></div>
      <div class="card"><h2>ลงเวลาด้วยมือถือ (GPS)</h2>
        <label class="row" style="border:0;padding:0 0 8px;gap:8px"><input type="checkbox" id="st-gps" ${c.gpsOn ? 'checked' : ''}> <span>เปิดให้ครูกดลงเวลาด้วยมือถือเมื่ออยู่ในเขตโรงเรียน</span></label>
        <div class="grid g2">
          <div class="field"><label class="f" for="st-lat">ละติจูดโรงเรียน</label><input id="st-lat" class="in" inputmode="decimal" value="${esc(g.lat)}" placeholder="เช่น 14.70xxx"></div>
          <div class="field"><label class="f" for="st-lng">ลองจิจูดโรงเรียน</label><input id="st-lng" class="in" inputmode="decimal" value="${esc(g.lng)}" placeholder="เช่น 101.41xxx"></div>
          <div class="field"><label class="f" for="st-rad">รัศมีเขตโรงเรียน (เมตร)</label><input id="st-rad" class="in" type="number" min="50" step="10" value="${esc(g.radius)}"></div>
          <div class="field" style="align-self:end"><button class="btn" data-st="here">ใช้ตำแหน่งที่ยืนอยู่ตอนนี้</button></div></div>
        <p class="muted small" style="margin-top:6px">ยืนกลางโรงเรียนแล้วกด “ใช้ตำแหน่งที่ยืนอยู่ตอนนี้” · ตั้งรัศมีให้ครอบคลุมทั้งโรงเรียน (โดยทั่วไป 200–400 ม.) · ระบบเก็บแค่ระยะห่างและความแม่นยำของ GPS ไม่เก็บพิกัดของครู · ตำแหน่งบนมือถือปลอมได้ ฝ่ายบุคคลจึงควรใช้คู่กับสแกนหน้า/สแกนนิ้ว</p></div>
      <div class="card"><h2>เครื่องสแกนนิ้ว — รหัสในเครื่องของแต่ละคน</h2>
        <p class="muted small" style="margin-bottom:10px">เครื่องสแกนนิ้วเก็บแค่รหัสผู้ใช้ (User ID / AC-No.) ใส่รหัสของแต่ละคนให้ตรงกับในเครื่อง ระบบจะรู้ว่าเวลานั้นเป็นของใคร · ถ้าไฟล์มีชื่อ-สกุลที่ตรงกับทะเบียนทุกตัวอักษร ก็จับคู่ด้วยชื่อได้โดยไม่ต้องใส่รหัส</p>
        <div class="scroll"><table class="tbl"><thead><tr><th>บุคลากร</th><th>อีเมล</th><th style="width:140px">รหัสในเครื่องสแกนนิ้ว</th></tr></thead><tbody>
        ${list.map(u => `<tr><td>${esc(u.name)}</td><td class="small">${u.email ? esc(u.email) : '<span class="muted">ยังไม่มีอีเมล</span>'}</td><td>${u.email ? `<input class="in" style="min-height:34px" data-st-fid="${esc(low(u.email))}" value="${esc(idOf(low(u.email)))}" inputmode="numeric">` : ''}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted small" style="margin-top:8px">ไฟล์ที่นำเข้าได้ (.csv): <b>รหัสหรือชื่อ-สกุล, วันที่, เวลา</b> หรือ <b>รหัสหรือชื่อ-สกุล, วันที่ เวลา</b> — วันที่แบบ 2026-10-17, 2026/10/17 หรือ 17/10/2569 (วัน/เดือน/ปี) ก็ได้ · เวลา 13:30 หรือ 1:30 PM · เวลาแรกของวัน = เข้า เวลาสุดท้าย (ห่างจากเวลาแรก 1 ชั่วโมงขึ้นไป) = ออก</p></div>
      <button class="btn pri" data-st="save">บันทึกการตั้งค่า</button>`;
  }

  /* ---------- แท็บ “วันลงเวลา”: ปฏิทินติ๊กวันที่ต้อง/ไม่ต้องลงเวลา ---------- */
  ui.calMon = curMon(); ui.brush = 'on';
  const wdCss = document.createElement('style');
  wdCss.textContent = `.wd-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.wd-h{font-size:.78rem;font-weight:700;text-align:center;color:var(--muted);padding:2px 0}
.wd-c{min-height:64px;border-radius:10px;border:1px solid var(--line);background:var(--surface2,var(--surface));color:var(--text);font:inherit;text-align:left;padding:6px 7px;cursor:pointer;display:flex;flex-direction:column;gap:2px;overflow:hidden}
.wd-c b{font-size:1rem}.wd-c small{font-size:.7rem;line-height:1.25;color:var(--text);opacity:.85;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wd-c.on{background:color-mix(in srgb,var(--ok) 14%,var(--surface));border-color:color-mix(in srgb,var(--ok) 40%,var(--line))}
.wd-c.off{background:color-mix(in srgb,var(--bad) 10%,var(--surface));border-color:color-mix(in srgb,var(--bad) 30%,var(--line))}
.wd-c.man.on{background:color-mix(in srgb,var(--ok) 34%,var(--surface));border:2px solid var(--ok)}
.wd-c.man.off{background:color-mix(in srgb,var(--bad) 30%,var(--surface));border:2px solid var(--bad)}
.wd-c.today{box-shadow:0 0 0 2px var(--text) inset}
.wd-c:hover{filter:brightness(1.08)}
.wd-c.blank{visibility:hidden}
.wd-br{display:flex;gap:6px;flex-wrap:wrap}
.wd-br .btn.on-b{border-color:var(--ok)}.wd-br .btn.off-b{border-color:var(--bad)}
.wd-br .btn.sel{box-shadow:0 0 0 2px currentColor inset;font-weight:700}
.wd-br .btn.on-b.sel{background:color-mix(in srgb,var(--ok) 25%,var(--surface));color:var(--text)}
.wd-br .btn.off-b.sel{background:color-mix(in srgb,var(--bad) 25%,var(--surface));color:var(--text)}
.wd-dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}`;
  document.head.appendChild(wdCss);
  const DOW = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const daysIn = (a, b) => { const out = []; const d = new Date(a + 'T00:00:00'), e = new Date(b + 'T00:00:00'); let i = 0;
    while (d <= e && i++ < 400) { out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); d.setDate(d.getDate() + 1); } return out; };
  function setDays(list, k) {
    const w = Object.assign({}, wdMap());
    list.forEach(d => { if (k === 'auto') delete w[d]; else w[d] = k === 'on' ? 1 : 0; });
    S.hrCfg = Object.assign({}, S.hrCfg || {}, { workDays: w }); save(); redraw();
  }
  function hrDays() {
    if (!hrAdm()) return onlyFor('กำหนดวันลงเวลา แก้ได้เฉพาะฝ่ายบุคคล/แอดมิน');
    const m = ui.calMon, [y, mo] = m.split('-').map(Number), n = new Date(y, mo, 0).getDate(), lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7;
    const map = wdMap(), t = todayISO(), mName = new Date(m + '-01T00:00:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    let cnt = 0; const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="wd-c blank"></div>');
    for (let d = 1; d <= n; d++) {
      const iso = `${m}-${pad(d)}`, on = workday(iso), man = map[iso] === 1 || map[iso] === 0; if (on) cnt++;
      const txt = man ? (on ? '✓ ลงเวลาทำงาน' : '✕ เว้นการลงเวลา') : (on ? 'ลงเวลา' : offWhy(iso));
      cells.push(`<button class="wd-c ${on ? 'on' : 'off'}${man ? ' man' : ''}${iso === t ? ' today' : ''}" data-st="wd" data-d="${iso}" title="${esc(thDate(iso) + ' · ' + txt + (man ? ' (ติ๊กเอง)' : ' (ค่าเริ่มต้น)'))}"><b>${d}</b><small>${esc(txt)}</small></button>`);
    }
    const T = termsOk().slice().sort((a, b) => a.open.localeCompare(b.open));
    const termTxt = T.length ? T.map(x => `ภาค ${esc(x.sem)}/${esc(x.year)}: ${esc(thDate(x.open))} – ${esc(thDate(x.close))}`).join(' · ') : 'ยังไม่ได้กรอกวันเปิด-ปิดภาคเรียน (ค่าเริ่มต้น = ทุกวันจันทร์–ศุกร์ที่ไม่ใช่วันหยุด)';
    const br = (k, cls, l) => `<button class="btn ${cls}${ui.brush === k ? ' sel' : ''}" data-st="brush" data-k="${k}">${l}</button>`;
    return `<div class="card"><h2>กำหนดวันลงเวลาทำงาน</h2>
        <p class="muted small" style="margin-bottom:10px">วันที่ <b>ไม่ต้องลงเวลา</b> จะไม่ขึ้น “ไม่พบการลงเวลา” และไม่แจ้งเตือนครู/ฝ่ายบุคคล · ค่าเริ่มต้นตามปฏิทินภาคเรียน (จันทร์–ศุกร์ ระหว่างเปิด–ปิดภาค ไม่รวมวันหยุด) — ครูมักเปิดก่อน/ปิดหลังนักเรียน ติ๊กเพิ่มเองได้</p>
        <p class="small" style="margin-bottom:10px">${termTxt}</p>
        <div class="wd-br" style="margin-bottom:6px">${br('on', 'on-b', '<span class="wd-dot" style="background:var(--ok)"></span>1. ลงเวลาทำงานวันนี้')}${br('off', 'off-b', '<span class="wd-dot" style="background:var(--bad)"></span>2. เว้นการลงเวลาทำงาน')}${br('auto', '', 'ล้าง (กลับเป็นค่าเริ่มต้น)')}</div>
        <p class="muted small">เลือกแบบด้านบน แล้วแตะวันที่ในปฏิทิน · แตะซ้ำวันที่ติ๊กไว้แล้ว = ล้างกลับเป็นค่าเริ่มต้น · กรอบหนา = ติ๊กเอง · สีอ่อน = ค่าเริ่มต้น</p></div>
      <div class="card"><div class="row" style="border:0;padding:0 0 10px;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn sm" data-st="calm" data-k="-1" aria-label="เดือนก่อน">‹</button><b style="min-width:150px;text-align:center">${esc(mName)}</b><button class="btn sm" data-st="calm" data-k="1" aria-label="เดือนถัดไป">›</button>
          <button class="btn sm ghost" data-st="calm" data-k="0">เดือนนี้</button><span class="grow"></span><span class="chip ok">ลงเวลา ${cnt} วัน</span></div>
        <div class="wd-cal">${DOW.map(x => `<div class="wd-h">${x}</div>`).join('')}${cells.join('')}</div></div>
      <div class="card"><h2>ติ๊กเป็นช่วง</h2><div class="grid g4">
          <div class="field"><label class="f" for="wd-from">ตั้งแต่วันที่</label><input id="wd-from" class="in" type="date" value="${esc(m + '-01')}"></div>
          <div class="field"><label class="f" for="wd-to">ถึงวันที่</label><input id="wd-to" class="in" type="date" value="${esc(m + '-' + pad(n))}"></div>
          <div class="field" style="align-self:end"><label class="row" style="border:0;padding:0;gap:6px"><input type="checkbox" id="wd-we"> <span>รวมเสาร์–อาทิตย์</span></label></div>
          <div class="field" style="align-self:end"><button class="btn pri" style="width:100%" data-st="wdRange">ใช้แบบที่เลือกกับช่วงนี้</button></div></div>
        <p class="muted small" style="margin-top:6px">เช่น ครูเปิดก่อนนักเรียน 2 สัปดาห์: เลือก “1. ลงเวลาทำงานวันนี้” แล้วใส่ช่วงวันนั้น · ปกติจะข้ามเสาร์–อาทิตย์</p></div>`;
  }

  /* ---------- ฝ่ายบุคคล/แอดมินแก้เวลาเข้า-ออกแทนครู (ลืมสแกน ฯลฯ) — ต้องมีเหตุผล เก็บเป็น method manual + ประวัติการแก้ไข ---------- */
  function editTime(d) {
    modal(`<h2 style="margin-bottom:4px">แก้เวลาลงเวลา</h2><p class="muted small" style="margin-bottom:10px">${esc(d.n)} · ${esc(thDate(d.d))}</p>
      <div class="grid g2"><div class="field"><label class="f" for="et-i">เวลาเข้า</label><input id="et-i" class="in" type="time" value="${esc(d.i)}"></div>
        <div class="field"><label class="f" for="et-o">เวลาออก</label><input id="et-o" class="in" type="time" value="${esc(d.o)}"></div></div>
      <p class="muted small" style="margin:4px 0 10px">เว้นว่าง = ไม่แก้ช่องนั้น · เวลาที่แก้จะใช้แทนเวลาจากเครื่องสแกน และถามเหตุผลในขั้นถัดไป</p>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" data-st="editSave" data-em="${esc(d.em)}" data-n="${esc(d.n)}" data-d="${esc(d.d)}" data-i="${esc(d.i)}" data-o="${esc(d.o)}">ถัดไป</button></div>`, true);
  }
  async function editSave(d) {
    const ni = ($('#et-i') || {}).value || '', no = ($('#et-o') || {}).value || '';
    const ch = []; if (ni && ni !== d.i) ch.push(['in', d.i, ni]); if (no && no !== d.o) ch.push(['out', d.o, no]);
    if (!ch.length) { closeModal(); return toast('ไม่มีเวลาที่เปลี่ยน'); }
    if (ch.some(x => x[0] === 'out') && (ni || d.i) && no <= (ni || d.i)) return toast('เวลาออกต้องหลังเวลาเข้า');
    closeModal();
    const txt = ch.map(x => (x[0] === 'in' ? 'เข้า ' : 'ออก ') + (x[1] || '—') + ' → ' + x[2]).join(', ');
    const reason = window.EMSAudit ? await EMSAudit.ask('แก้เวลาลงเวลาของ ' + d.n, thDate(d.d) + ' · ' + txt) : 'แก้โดยฝ่ายบุคคล';
    if (!reason) return;
    const list = ch.map(([kind, , t]) => ({ id: evId(d.d, d.em, 'manual', kind), data: { email: d.em, name: d.n, date: d.d, mon: d.d.slice(0, 7), at: `${d.d}T${t}:00+07:00`, kind, method: 'manual', deviceId: 'hr', note: reason.slice(0, 300), by: by() } }));
    try { await put(list); if (window.EMSAudit) EMSAudit.log('staffTime', d.n + ' · ' + d.d, ch.map(x => x[1] || '—').join(' / '), ch.map(x => x[2]).join(' / '), reason); toast('แก้เวลาแล้ว'); }
    catch (e) { toast('แก้ไม่สำเร็จ: ' + (e.code || e.message)); }
    redraw();
  }

  /* ---------- นำเข้าไฟล์จากเครื่องสแกนนิ้ว ---------- */
  const DATE_RE = /^(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})/;
  function parseDate(s) {          // YYYY-MM-DD · YYYY/MM/DD · DD/MM/YYYY (พ.ศ. ก็ได้) — เดือน/วันผิดช่วง (เช่น MM/DD) = ''
    const m = String(s || '').trim().match(DATE_RE); if (!m) return '';
    let y, mo, d; if (m[1].length === 4) [y, mo, d] = [+m[1], +m[2], +m[3]]; else if (m[3].length === 4) [y, mo, d] = [+m[3], +m[2], +m[1]]; else return '';
    if (y > 2400) y -= 543;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || new Date(y, mo - 1, d).getDate() !== d) return '';
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const parseTime = s => { const m = String(s || '').match(/(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([AaPp])\.?[Mm]\b)?/); if (!m || +m[2] > 59) return '';
    let h = +m[1]; if (m[3]) { if (h < 1 || h > 12) return ''; h = h % 12 + (/p/i.test(m[3]) ? 12 : 0); }      // 1:30 PM = 13:30 · 12:05 AM = 00:05
    return h < 24 ? pad(h) + ':' + m[2] : ''; };
  const timeAfter = s => parseTime(String(s).trim().replace(DATE_RE, ''));      // "วันที่ เวลา" ในช่องเดียว
  /* old = เอกสาร finger เดิม {id: data} → รวมกับเวลาในไฟล์ (เข้า = ต่ำสุด ออก = สูงสุด) นำเข้าซ้ำ/ไฟล์ครึ่งวันไม่ทับเวลาเข้าที่เช้ากว่า · ส่งเฉพาะที่เปลี่ยน */
  function parseScan(text, old) {
    const c = cfg(), byName = {}, hits = {}, miss = {}; let bad = 0; old = old || {};
    (S.staff || []).forEach(u => { if (u.email) byName[String(u.name).trim()] = low(u.email); });
    String(text).replace(/^\uFEFF/, '').split(/\r?\n/).forEach(line => {
      const p = line.split(/[,\t;]/).map(x => x.trim().replace(/^"|"$/g, '')); if (p.length < 2) return;
      let who = p[0], date = parseDate(p[1]), tm = parseTime(p[2] || '') || timeAfter(p[1]);
      if (!date) { for (let i = 1; i < p.length && !date; i++) { date = parseDate(p[i]); if (date) tm = parseTime(p[i + 1] || '') || timeAfter(p[i]); } }   // มีคอลัมน์ชื่อคั่นกลาง
      if (!date) { if (p.slice(1).some(x => DATE_RE.test(x))) bad++; return; }      // ดูเหมือนวันที่แต่เดือน/วันผิดช่วง → ข้ามและนับ
      if (!tm) return;
      const em = c.fingerMap[who] || byName[who] || (p[1] && !parseDate(p[1]) ? c.fingerMap[p[1]] || byName[p[1]] : '');
      if (!em) { miss[who] = 1; return; }
      const k = em + '|' + date; (hits[k] = hits[k] || []).push(tm);
    });
    const out = [], ids = [], sample = [], mins = t => +t.slice(0, 2) * 60 + +t.slice(3);
    Object.keys(hits).forEach(k => { const [em, date] = k.split('|'), nm = (S.staff.find(u => low(u.email) === em) || {}).name || em;
      const mk = (kind, t) => ({ id: evId(date, em, 'finger', kind), data: { email: em, name: nm, date, mon: date.slice(0, 7), at: `${date}T${t}:00+07:00`, kind, method: 'finger', deviceId: 'finger-file', note: 'นำเข้าไฟล์', by: by() } });
      const oi = old[evId(date, em, 'finger', 'in')], oo = old[evId(date, em, 'finger', 'out')], ot = d => d && String(d.at || '').slice(11, 16);
      const ts = hits[k].concat([ot(oi), ot(oo)].filter(Boolean)).sort(), first = ts[0], last = ts[ts.length - 1], hasOut = mins(last) - mins(first) >= 60;
      ids.push(mk('in', first).id, mk('out', last).id);
      if (sample.length < 3) sample.push(`${nm} · ${date} · เข้า ${first}${hasOut ? ' ออก ' + last : ''}`);
      if (ot(oi) !== first) out.push(mk('in', first));
      if (hasOut && ot(oo) !== last) out.push(mk('out', last)); });
    return { list: out, ids, sample, bad, miss: Object.keys(miss).filter(Boolean) };
  }
  async function oldFinger(ids) {        // เอกสาร finger ที่มีอยู่แล้ว (อ่านทีละเอกสาร = จ่ายเท่าจำนวนที่นำเข้า)
    const o = {}; if (!LIVE) { ids.forEach(id => { if (S.staffEv.local[id]) o[id] = S.staffEv.local[id]; }); return o; }
    const db = window.EMSCloud && EMSCloud.db && EMSCloud.db(); if (!db) throw new Error('ยังไม่ได้เชื่อมระบบ');
    for (let i = 0; i < ids.length; i += 50) await Promise.all(ids.slice(i, i + 50).map(id => db.collection('staffEvents').doc(id).get().then(d => { if (d.exists) o[id] = d.data(); })));
    return o;
  }

  /* ---------- แจ้งเตือน ---------- */
  if (window.EMSNotify) EMSNotify.register(() => {
    if (!isTeacherUser()) return [];
    const out = [], t = todayISO(), c = cfg();
    if (workday(t) && mon() === curMon() && ready('staffMine')) {
      const s = status(S.me.name, t, true);
      if (s.time) out.push({ id: 'st-in-' + t, level: 'info', title: s.code === 'late' ? `ลงเวลาเข้า ${s.time} น. (มาสาย)` : `ลงเวลาเข้าแล้ว ${s.time} น.`, sub: (M[s.inM] || '') + (s.out ? ` · ออก ${s.out} น.` : ''), page: 'my-time', view: 'teacher', at: s.at });
      else if (s.code === 'absent') out.push({ id: 'st-miss-' + t, level: 'todo', title: 'ยังไม่พบการลงเวลาเข้าวันนี้', sub: c.gpsOn ? 'สแกนหน้าที่ประตู หรือกด “ลงเวลาเข้าด้วยมือถือ” ในเขตโรงเรียน' : 'สแกนหน้าที่ประตู · ถ้าลืมสแกนให้แจ้งฝ่ายบุคคล', page: 'my-time', view: 'teacher' });
    }
    if (boss() && workday(t) && nowHM() >= c.remindAt && day() === t && ready('staffDay') && typeof window.EMSStaffList === 'function') {
      const n = EMSStaffList().filter(u => status(u.name, t).code === 'absent').length;
      if (n) out.push({ id: 'st-hr-' + t, level: 'todo', title: 'บุคลากรยังไม่ลงเวลาวันนี้', sub: 'ไม่มีเวลาจากเครื่องใดและไม่มีใบลา', n, page: 'a-hr', view: 'admin' });
    }
    return out;
  });

  /* ---------- ปุ่ม ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-st]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
    const k = b.dataset.st;
    if (k === 'gps') return void gps(b.dataset.k);
    if (k === 'edit') return void editTime(b.dataset);
    if (k === 'brush') { ui.brush = b.dataset.k; return redraw(); }
    if (k === 'calm') { const s = +b.dataset.k; if (!s) ui.calMon = curMon(); else { const d = new Date(ui.calMon + '-01T00:00:00'); d.setMonth(d.getMonth() + s); ui.calMon = d.getFullYear() + '-' + pad(d.getMonth() + 1); } return redraw(); }
    if (k === 'wd') { if (!hrAdm()) return; const d = b.dataset.d, v = wdMap()[d], cur = v === 1 ? 'on' : v === 0 ? 'off' : 'auto';
      return setDays([d], cur === ui.brush ? 'auto' : ui.brush); }
    if (k === 'wdRange') { if (!hrAdm()) return; const a = ($('#wd-from') || {}).value, z = ($('#wd-to') || {}).value, we = !!($('#wd-we') || {}).checked;
      if (!a || !z || z < a) return toast('เลือกช่วงวันที่ให้ถูกต้อง');
      const list = daysIn(a, z).filter(d => we || !weekend(d)); if (!list.length) return toast('ไม่มีวันในช่วงนี้');
      const lbl = ui.brush === 'on' ? 'ลงเวลาทำงาน' : ui.brush === 'off' ? 'เว้นการลงเวลา' : 'กลับเป็นค่าเริ่มต้น';
      if (!confirm(`ตั้ง ${list.length} วัน (${thDate(a)} – ${thDate(z)}) เป็น “${lbl}”?`)) return;
      setDays(list, ui.brush); return toast('ตั้งแล้ว ' + list.length + ' วัน'); }
    if (k === 'editSave') return void editSave(b.dataset);
    if (k === 'here') { b.disabled = true; b.textContent = 'กำลังหาตำแหน่ง…';
      where().then(p => { $('#st-lat').value = p.coords.latitude.toFixed(6); $('#st-lng').value = p.coords.longitude.toFixed(6); toast(`ได้ตำแหน่งแล้ว (คลาดได้ ±${Math.round(p.coords.accuracy)} ม.) — กดบันทึกการตั้งค่า`); })
        .catch(er => toast(er.message)).finally(() => { b.disabled = false; b.textContent = 'ใช้ตำแหน่งที่ยืนอยู่ตอนนี้'; }); return; }
    if (k === 'save') {
      const c = cfg(), v = id => ($('#' + id) || {}).value || '';
      c.lateTime = v('st-late') || '08:00'; c.outTime = v('st-outt') || '16:30'; c.remindAt = v('st-rem') || '08:30'; c.since = v('st-since') || todayISO();
      c.gpsOn = !!($('#st-gps') || {}).checked; c.geo = { lat: v('st-lat').trim(), lng: v('st-lng').trim(), radius: Math.max(50, +v('st-rad') || 300) };
      if (c.gpsOn && (!isFinite(parseFloat(c.geo.lat)) || !isFinite(parseFloat(c.geo.lng)))) return toast('ใส่พิกัดโรงเรียนก่อนเปิดลงเวลาด้วยมือถือ');
      const fm = {}, dup = [];
      document.querySelectorAll('[data-st-fid]').forEach(i => { const id = i.value.trim(); if (!id) return; if (fm[id]) dup.push(id); fm[id] = i.dataset.stFid; });
      if (dup.length) return toast('รหัสสแกนนิ้วซ้ำกัน: ' + dup.join(', '));
      c.fingerMap = fm; S.hrCfg = c; save(); toast('บันทึกการตั้งค่าแล้ว'); return redraw();
    }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!t.dataset || !t.dataset.st) return;
    if (t.dataset.st === 'mon') { ui.mon = t.value || curMon(); return redraw(); }
    if (t.dataset.st === 'file') { const f = t.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = async () => { let r = parseScan(rd.result); t.value = '';
        const badTxt = r.bad ? ` · วันที่ผิดรูปแบบ/เดือนวันผิดช่วง ${r.bad} แถว (ข้าม)` : '';
        if (!r.list.length) return toast('ไม่พบเวลาที่จับคู่กับบุคลากรได้' + (r.miss.length ? ' — ตรวจรหัสในหน้าตั้งค่า (' + r.miss.slice(0, 3).join(', ') + ')' : '') + badTxt);
        try { r = parseScan(rd.result, await oldFinger(r.ids)); } catch (er) { return toast('อ่านเวลาสแกนนิ้วเดิมไม่ได้: ' + (er.code || er.message)); }      // รวมกับที่นำเข้าไว้แล้ว
        if (!r.list.length) return toast('เวลาในไฟล์นี้มีอยู่ในระบบครบแล้ว' + badTxt);
        if (!confirm(`นำเข้าเวลาสแกนนิ้ว ${r.list.length} รายการ\nตัวอย่าง:\n${r.sample.join('\n')}${r.bad ? `\nวันที่ผิดรูปแบบ/เดือนวันผิดช่วง ${r.bad} แถว (ข้าม)` : ''}${r.miss.length ? `\nจับคู่ไม่ได้ ${r.miss.length} รหัส/ชื่อ: ${r.miss.slice(0, 8).join(', ')}${r.miss.length > 8 ? ' …' : ''}` : ''}\nยืนยัน?`)) return;
        try { const n = await put(r.list); toast('นำเข้าเวลาสแกนนิ้ว ' + n + ' รายการแล้ว'); } catch (er) { toast('นำเข้าไม่สำเร็จ: ' + (er.code || er.message)); }
        redraw(); };
      rd.readAsText(f, 'utf-8'); }
  });

  window.EMSStaffTime = { day, mon, status, daySum, card, hrTime, hrSetup, hrDays, parseScan, evId, workday, M };
})();
