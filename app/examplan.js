/* EMS — กำหนดการสอบ (กลางภาค / ปลายภาค)
   ครูกรอกต่อ “รายวิชา” (วิชาเดียวกันหลายครูใช้รายการเดียว ใครก็ได้ที่สอนวิชานั้นแก้ทับได้ · ครูที่ไม่ได้ออกข้อสอบไม่ต้องกรอก)
   - รอบ กลางภาค/ปลายภาค · รูปแบบ ในตาราง/นอกตาราง · เวลาสอบ 30/60/90/120 นาที และปรับทีละ 10 นาที
   - ปุ่มกรอกขึ้นเมื่อฝ่ายวัดผลปลดล็อกรอบนั้นของภาคเรียน (S.examEntry ในเอกสาร school/exam) · แอดมินเห็นเสมอ (ทดสอบระบบ)
   - หัวหน้ากลุ่มสาระตรวจความครบของกลุ่มสาระ แยก ม.ต้น / ม.ปลาย · ฝ่ายวัดผลดูทุกกลุ่มสาระ แล้วส่งออกเป็นชีต/Excel ไปดำเนินการต่อ
   ข้อมูลเก็บที่คอลเลกชัน examPlans (id = {ภาค}_{รอบ}_{รหัสวิชา}) แก้ทับได้ · ลบได้เฉพาะแอดมิน/วัดผล (หน้าตรวจ) */
(function () {
  'use strict';
  const ROUND = { mid: 'กลางภาค', final: 'ปลายภาค' };
  const PRESET = [30, 60, 90, 120], MIN_M = 30, MAX_M = 240;
  /* กลุ่มสาระจากอักษรนำของรหัสวิชา (หลักสูตรแกนกลาง 2551) · ภาษาต่างประเทศ: อ อังกฤษ จ จีน ญ ญี่ปุ่น ฝ ฝรั่งเศส ย เยอรมัน ก เกาหลี ร รัสเซีย ข เขมร ม มลายู
     อักษรอื่น/รหัสอังกฤษ (I, IS ฯลฯ) → ดูจากชื่อวิชา ไม่เข้ากลุ่มใด = อื่น ๆ */
  const AREAS = [['ท', 'ภาษาไทย', /ไทย/], ['ค', 'คณิตศาสตร์', /คณิต/], ['ว', 'วิทยาศาสตร์และเทคโนโลยี', /วิทย/], ['ส', 'สังคมศึกษา ศาสนา และวัฒนธรรม', /สังคม/],
    ['พ', 'สุขศึกษาและพลศึกษา', /สุขศึกษา|พลศึกษา/], ['ศ', 'ศิลปะ', /ศิลป/], ['ง', 'การงานอาชีพ', /การงาน|อาชีพ/], ['อจญฝยกรขม', 'ภาษาต่างประเทศ', /ต่างประเทศ|อังกฤษ|จีน|ญี่ปุ่น|เกาหลี|ฝรั่งเศส|เยอรมัน|English|Chinese|Japanese|Korean|French|German/i]];
  const OTHER = 'อื่น ๆ';
  /* กิจกรรมพัฒนาผู้เรียน (ไม่มีสอบ): รหัส ก + เลขหลักที่ 3 เป็น 9 (เช่น ก21901) หรือชื่อขึ้นต้นด้วยชื่อกิจกรรม — วิชาเพิ่มเติมที่ชื่อมีคำว่า “กิจกรรม” (ว20291 กิจกรรมวิทยาศาสตร์) ยังสอบ */
  const NOEXAM_CODE = /^ก\d\d9/;
  const NOEXAM = /^(กิจกรรม\s*)?(แนะแนว|ลูกเสือ|เนตรนารี|ยุวกาชาด|ชุมนุม|เพื่อสังคม|พัฒนาผู้เรียน|โฮมรูม|เข้าแถว|รักษาดินแดน|นักศึกษาวิชาทหาร|(ผู้)?บำเพ็ญ)/;
  const noExam = p => NOEXAM_CODE.test(p.code) || NOEXAM.test(p.name);
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  const has = r => roles().indexOf(r) >= 0;
  const isAdmin = () => !LIVE ? (S.view === 'admin') : (has('admin') || ((window.EMS_CONFIG || {}).adminEmails || []).indexOf(String(S.me.email || '').toLowerCase()) >= 0);
  const isMeasure = () => has('measure') || isAdmin();
  const isHead = () => has('head');
  const tk = () => (S.term ? S.term.year + '-' + S.term.sem : '');
  const termTxt = () => S.term ? S.term.sem + '/' + S.term.year : '';
  /* อ่านอย่างเดียว — ห้ามสร้าง S.examEntry ที่นี่ (เรียกทุกครั้งที่วาดเมนู ถ้าสร้างจะกลายเป็น “แก้ข้อมูลกลาง” ของทุกคน) */
  const entryCfg = () => { const e = S.examEntry && typeof S.examEntry === 'object' ? S.examEntry : {}; return e[tk()] || {}; };
  const isOpen = r => !!(entryCfg()[r] || {}).open;
  const anyOpen = () => Object.keys(ROUND).some(isOpen);
  /* พร้อม = ได้กำหนดการสอบรอบแรกแล้ว และตารางสอนที่โหลดอยู่เป็นของภาคปัจจุบัน (เพิ่งกลับจากดูภาคอื่น ตารางยังเป็นภาคเก่าชั่วขณะ) */
  const ready = () => !LIVE || !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready.examPlans && EMSCloud.ready.tt && (!EMSCloud.ttKey || EMSCloud.ttKey() === tk()));
  const plans = () => (S.examPlans = Array.isArray(S.examPlans) ? S.examPlans : []);
  const keyOf = (round, code) => (tk() + '_' + round + '_' + code).replace(/[\/.#$\[\]\s]/g, '-');
  const entryOf = (round, code) => plans().find(x => x.id === keyOf(round, code));
  /* รหัสวิชา = อักษรนำ 1–2 ตัว (ไทยหรืออังกฤษ) เว้นวรรคได้ + เลข 5 หลัก (+ อักษร/เลขต่อท้าย) · ตัด /เลข ท้ายรหัส (ว21101/1) · รวมเป็นรหัสไม่มีช่องว่าง */
  const parseSub = s => { const m = /^\s*([ก-ฮ]{1,2}|[A-Za-z]{1,2})\s?(\d{5}[ก-ฮA-Za-z0-9]*)(?:\/\d+)?\s*(.*)$/.exec(String(s || '')); return m ? { code: (m[1] + m[2]).toUpperCase(), name: m[3].trim() } : null; };
  const areaOf = (code, name) => { const c = String(code).charAt(0), a = /[ก-ฮ]/.test(c) ? AREAS.find(x => x[0].indexOf(c) >= 0) : null;
    const b = a || AREAS.find(x => x[2].test(String(name || ''))); return b ? b[1] : OTHER; };
  const levelOf = (code, roomNames) => { const d = (/\d/.exec(String(code)) || [''])[0]; if (d === '2') return 'ม.ต้น'; if (d === '3') return 'ม.ปลาย';
    const g = (roomNames.map(n => +((/ม\.(\d)/.exec(n) || [])[1])).filter(Boolean)[0]) || 0; return g >= 4 ? 'ม.ปลาย' : g ? 'ม.ต้น' : 'อื่น ๆ'; };
  const roomName = id => ((S.rooms || []).find(r => r.id === id) || (S.classes || []).find(c => c.id === id) || {}).name || id;
  const sortRooms = arr => arr.slice().sort((a, b) => String(a).localeCompare(String(b), 'th', { numeric: true }));
  const fmtAt = iso => { try { return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  /* รายวิชาจากตารางสอนทั้งโรงเรียน (ภาคปัจจุบัน) → { code: { code, name, rooms, teachers, area, level } } */
  function subjects(onlyMine) {
    const out = {};
    (S.__ttAll || []).forEach(e => { if (onlyMine && e.teacher !== S.me.name) return; const p = parseSub(e.subject); if (!p || noExam(p)) return;
      const o = out[p.code] = out[p.code] || { code: p.code, name: p.name, rooms: new Set(), teachers: new Set() };
      if (!o.name && p.name) o.name = p.name; o.rooms.add(roomName(e.classId)); if (e.teacher) o.teachers.add(e.teacher); });
    Object.values(out).forEach(o => { o.rooms = sortRooms([...o.rooms]); o.teachers = [...o.teachers].sort((a, b) => a.localeCompare(b, 'th')); o.area = areaOf(o.code, o.name); o.level = levelOf(o.code, o.rooms); });
    return out;
  }
  const headArea = () => { const d = String(((S.staff || []).find(u => u.name === S.me.name) || {}).dept || S.me.dept || ''); const a = AREAS.find(x => x[2].test(d)); return a ? a[1] : ''; };

  const ui = { round: '', draft: {}, area: '', round2: 'mid' };
  const viewing = () => !!(S.viewTerm && S.term && (String(S.viewTerm.year) !== String(S.term.year) || String(S.viewTerm.sem) !== String(S.term.sem)));
  /* กลุ่มสาระที่หน้าตรวจแสดง: วัดผล = ทุกกลุ่ม ('*') · หัวหน้า = กลุ่มของตัวเองจากข้อมูลบุคลากร ไม่พบ = '' (ให้เลือกเอง ไม่เดาไปกลุ่มอื่น) */
  const areaPick = areas => { if (ui.area === '*' ? isMeasure() : ui.area && (areas.indexOf(ui.area) >= 0 || ui.area === headArea())) return ui.area;
    return (ui.area = isMeasure() ? '*' : headArea()); };
  /* ขอบเขตที่ cloud.js ฟัง (ลดการอ่าน): วัดผล/แอดมิน = ทั้งภาค · หัวหน้าในหน้าตรวจ = กลุ่มสาระที่เลือก · ครู = id เอกสารของวิชาตัวเอง (เกิน 30 = ทั้งภาค) */
  const scope = () => { const term = tk() || 'na';
    if (isMeasure()) return { term };
    if (page === 'exam-check' && isHead()) { const a = areaPick([...new Set(Object.values(subjects(false)).map(o => o.area))]); return a ? { term, area: a } : { term, none: true }; }
    const ids = []; Object.keys(subjects(true)).sort().forEach(c => Object.keys(ROUND).forEach(r => ids.push(keyOf(r, c))));
    return ids.length <= 30 ? { term, ids } : { term }; };

  /* ร่างของแต่ละวิชา: base = เวลาส่ง (e.at) ของรายการที่ร่างอ้างอิง · ยังไม่แตะ (touched) แล้วมีคนส่งใหม่ = ตั้งตามรายการใหม่ */
  function draftOf(k, e) { const at = e ? e.at : ''; let d = ui.draft[k];
    if (!d || (!d.touched && d.base !== at)) d = ui.draft[k] = { mode: e ? e.mode : 'in', minutes: e ? e.minutes : 60, base: at, touched: false };
    return d; }

  /* ---------- ครู: กรอกกำหนดการสอบ ---------- */
  P['exam-plan'] = () => {
    const head = `<div class="top"><div><h1>กำหนดการสอบ</h1><p>ภาคเรียนที่ ${esc(termTxt())} · กรอกเฉพาะวิชาที่คุณเป็นผู้ออกข้อสอบ วิชาเดียวกันหลายครูใช้รายการเดียว แก้ทับได้</p></div></div>`;
    if (viewing()) return head + '<div class="card"><div class="empty">กำลังดูภาคเรียนอื่น — กลับภาคปัจจุบันก่อน <button class="btn sm pri" data-tm="back">กลับภาคปัจจุบัน</button></div></div>';
    const rounds = Object.keys(ROUND).filter(r => isOpen(r) || isAdmin());
    if (!rounds.length) return head + '<div class="card"><div class="empty">ฝ่ายวัดผลยังไม่เปิดให้กรอกกำหนดการสอบ</div></div>';
    if (!ready()) return head + '<div class="card"><div class="empty">กำลังโหลด…</div></div>';
    if (rounds.indexOf(ui.round) < 0) ui.round = rounds.find(isOpen) || rounds[0];
    const mine = Object.values(subjects(true)).sort((a, b) => a.code.localeCompare(b.code, 'th'));
    let h = head + `<div class="pills">${rounds.map(r => `<button class="pill" aria-pressed="${r === ui.round}" data-ep="round" data-r="${r}">${ROUND[r]}${isOpen(r) ? '' : ' · ยังไม่เปิด (แอดมิน)'}</button>`).join('')}</div>`;
    if (!isOpen(ui.round)) h += `<div class="notice" style="background:var(--warn-soft)">รอบ${ROUND[ui.round]}ยังไม่เปิดให้ครูกรอก — คุณเห็นปุ่มเพราะเป็นแอดมิน · ที่ส่งจากหน้านี้เป็นข้อมูลจริง ลบได้ที่หน้าตรวจกำหนดการสอบ</div>`;
    if (!mine.length) return h + '<div class="card"><div class="empty">ไม่พบรายวิชาของคุณในตารางสอนภาคนี้</div></div>';
    h += mine.map(o => { const e = entryOf(ui.round, o.code), k = ui.round + '|' + o.code, d = draftOf(k, e);
      const moved = d.touched && e && e.at !== d.base && e.who !== S.me.name;      // มีครูคนอื่นส่งทับหลังจากเริ่มแก้
      return `<div class="card"><div class="row" style="border:0;padding:0 0 8px;flex-wrap:wrap;gap:8px"><div class="grow"><h2 style="margin:0">${esc(o.code)} ${esc(o.name)}</h2>
          <div class="muted small">${esc(o.level)} · ${esc(o.area)} · ${o.rooms.map(esc).join(', ')}${o.teachers.length > 1 ? ' · ครูผู้สอน ' + o.teachers.map(esc).join(', ') : ''}</div></div>
          ${e ? `<span class="chip ok" style="white-space:nowrap">ส่งแล้ว · ${esc(e.mode === 'out' ? 'นอกตาราง' : 'ในตาราง')} ${esc(e.minutes)} นาที</span>` : '<span class="chip warn">ยังไม่ได้ส่ง</span>'}</div>
        ${e ? `<div class="muted small" style="margin-bottom:8px">ส่งโดย ${esc(e.who)} เมื่อ ${esc(fmtAt(e.at))} — ส่งใหม่จะแก้ทับ</div>` : ''}
        ${moved ? `<div class="notice" style="background:var(--warn-soft);margin-bottom:8px">${esc(e.who)} เพิ่งส่ง ${esc(e.mode === 'out' ? 'นอกตาราง' : 'ในตาราง')} ${esc(e.minutes)} นาที หลังจากคุณเริ่มแก้ — ค่าที่เลือกด้านล่างยังเป็นของคุณ <button class="btn sm" data-ep="reload" data-k="${esc(k)}">ใช้ค่าล่าสุด</button></div>` : ''}
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
          <div><div class="muted small" style="margin-bottom:4px">การสอบ</div><div class="pills" style="margin:0">
            <button class="pill" aria-pressed="${d.mode === 'in'}" data-ep="mode" data-k="${esc(k)}" data-v="in">ในตาราง</button><button class="pill" aria-pressed="${d.mode === 'out'}" data-ep="mode" data-k="${esc(k)}" data-v="out">นอกตาราง</button></div></div>
          <div><div class="muted small" style="margin-bottom:4px">เวลาสอบ (นาที)</div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${PRESET.map(m => `<button class="pill" aria-pressed="${d.minutes === m}" data-ep="min" data-k="${esc(k)}" data-v="${m}">${m}</button>`).join('')}
            <button class="btn sm" data-ep="step" data-k="${esc(k)}" data-v="-10" aria-label="ลด 10 นาที">−10</button><b style="min-width:64px;text-align:center">${esc(d.minutes)} นาที</b><button class="btn sm" data-ep="step" data-k="${esc(k)}" data-v="10" aria-label="เพิ่ม 10 นาที">+10</button></div></div>
          <span class="grow"></span><button class="btn pri" data-ep="save" data-k="${esc(k)}">${e ? 'ส่งแก้ทับ' : 'ส่งกำหนดการสอบ'}</button></div></div>`; }).join('');
    return h;
  };

  function saveOne(k) {
    const [round, code] = k.split('|'), d = ui.draft[k];
    if (!isOpen(round) && !isAdmin()) return toast('ฝ่ายวัดผลยังไม่เปิดให้กรอกรอบนี้');
    if (!ready()) return toast('กำลังโหลด รอสักครู่แล้วลองใหม่');
    const o = subjects(false)[code] || subjects(true)[code]; if (!o || !d) return;
    if (!(d.minutes >= MIN_M && d.minutes <= MAX_M)) return toast('เวลาสอบต้องอยู่ระหว่าง ' + MIN_M + '–' + MAX_M + ' นาที');
    const cur = entryOf(round, code);
    if (cur && cur.at !== (d.base || '') && cur.who !== S.me.name
      && !confirm(cur.who + ' ส่งกำหนดการสอบ ' + code + ' (' + (cur.mode === 'out' ? 'นอกตาราง' : 'ในตาราง') + ' ' + cur.minutes + ' นาที) เมื่อ ' + fmtAt(cur.at) + ' หลังจากคุณเริ่มแก้\nส่งทับด้วยค่าของคุณ (' + (d.mode === 'out' ? 'นอกตาราง' : 'ในตาราง') + ' ' + d.minutes + ' นาที) หรือไม่?')) return;
    const id = keyOf(round, code), arr = plans(), v = { id, term: tk(), round, code, name: o.name, level: o.level, area: o.area, rooms: o.rooms, teachers: o.teachers,
      mode: d.mode === 'out' ? 'out' : 'in', minutes: d.minutes, who: S.me.name, at: new Date().toISOString() };
    const i = arr.findIndex(x => x.id === id); if (i >= 0) arr[i] = v; else arr.push(v);
    d.base = v.at; d.touched = false;
    save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); toast('ส่งกำหนดการสอบ ' + code + ' (' + ROUND[round] + ') แล้ว'); redraw();
  }

  /* ---------- หัวหน้ากลุ่มสาระ / ฝ่ายวัดผล: ตรวจความครบ + ปลดล็อก + ส่งออก ---------- */
  P['exam-check'] = () => {
    const meas = isMeasure(), hd = isHead();
    const head = `<div class="top"><div><h1>ตรวจกำหนดการสอบ</h1><p>ภาคเรียนที่ ${esc(termTxt())} · ${meas ? 'ฝ่ายวัดผลเปิด/ปิดการกรอก ตรวจทุกกลุ่มสาระ และส่งออกเป็นชีต' : 'ตรวจว่ารายวิชาของกลุ่มสาระส่งครบแล้วหรือยัง'}</p></div></div>`;
    if (!meas && !hd) return head + '<div class="card"><div class="empty">เฉพาะหัวหน้ากลุ่มสาระและฝ่ายวัดผล</div></div>';
    if (viewing()) return head + '<div class="card"><div class="empty">กำลังดูภาคเรียนอื่น — กลับภาคปัจจุบันก่อน <button class="btn sm pri" data-tm="back">กลับภาคปัจจุบัน</button></div></div>';
    if (!ready()) return head + '<div class="card"><div class="empty">กำลังโหลด…</div></div>';
    let h = head;
    if (meas) h += `<div class="card"><h2>เปิดให้ครูกรอก (ภาค ${esc(termTxt())})</h2><div style="display:flex;gap:10px;flex-wrap:wrap">${Object.keys(ROUND).map(r => { const c = entryCfg()[r] || {};
        return `<div class="row" style="border:1px solid var(--line);border-radius:12px;padding:10px 14px;gap:10px;flex:1;min-width:260px"><div class="grow"><b>${ROUND[r]}</b><div class="muted small">${c.open ? 'เปิดอยู่' : 'ปิดอยู่'}${c.by ? ' · ' + esc(c.by) + ' ' + esc(fmtAt(c.at)) : ''}</div></div>
          <button class="btn ${c.open ? '' : 'pri'}" data-ep="toggle" data-r="${r}">${c.open ? 'ปิดการกรอก' : 'ปลดล็อกให้กรอก'}</button></div>`; }).join('')}</div>
        <p class="muted small" style="margin:8px 0 0">ปิดอยู่ ครูไม่เห็นปุ่มกรอก · แอดมินเห็นเสมอเพื่อทดสอบระบบ · ข้อมูลที่ส่งแล้วไม่หายเมื่อปิด</p></div>`;
    const map = subjects(false), all = Object.values(map), areas = [...new Set(all.map(o => o.area))].sort((a, b) => a.localeCompare(b, 'th'));
    const sel = areaPick(areas), noArea = !meas && !sel, opts = sel && sel !== '*' && areas.indexOf(sel) < 0 ? [sel].concat(areas) : areas;
    const list = noArea ? [] : all.filter(o => sel === '*' || o.area === sel).sort((a, b) => a.code.localeCompare(b.code, 'th'));
    const r = ui.round2, done = list.filter(o => entryOf(r, o.code)).length, canDel = meas;
    /* ส่งแล้วแต่วิชาไม่อยู่ในตารางสอนภาคนี้แล้ว (ย้าย/ยุบวิชา) — แสดงต่อท้ายให้ตรวจ/ลบได้ */
    const extra = noArea ? [] : plans().filter(x => x && x.term === tk() && x.round === r && !map[x.code] && (sel === '*' || x.area === sel)).sort((a, b) => String(a.code).localeCompare(String(b.code), 'th'));
    h += `<div class="card"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:8px">
        <div class="pills" style="margin:0">${Object.keys(ROUND).map(x => `<button class="pill" aria-pressed="${x === r}" data-ep="round2" data-r="${x}">${ROUND[x]}</button>`).join('')}</div>
        <select class="in" style="width:auto" data-epf="area" aria-label="กลุ่มสาระ">${meas ? `<option value="*" ${sel === '*' ? 'selected' : ''}>ทุกกลุ่มสาระ</option>` : ''}${noArea ? '<option value="" selected>— เลือกกลุ่มสาระ —</option>' : ''}${opts.map(a => `<option ${a === sel ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
        <span class="chip ${done === list.length && list.length ? 'ok' : 'warn'}">ส่งแล้ว ${done}/${list.length} วิชา</span><span class="grow"></span>
        ${meas ? `<button class="btn" data-ep="csv">${ic('down')}ดาวน์โหลด CSV</button><button class="btn pri" data-ep="sheet">${ic('up')}ส่งออกชีต</button>` : ''}</div>
        ${noArea ? '<div class="notice" style="background:var(--warn-soft);margin-top:10px">ไม่พบกลุ่มสาระในข้อมูลบุคลากร — แจ้งฝ่ายบุคคล · ระหว่างนี้เลือกกลุ่มสาระที่จะตรวจเองด้านบน</div>' : ''}</div>`;
    const delBtn = e => canDel && e ? `<button class="btn sm" data-ep="del" data-id="${esc(e.id)}" aria-label="ลบรายการ ${esc(e.code)}">ลบ</button>` : '';
    ['ม.ต้น', 'ม.ปลาย', 'อื่น ๆ'].forEach(lv => { const rows = list.filter(o => o.level === lv); if (!rows.length) return; const ok = rows.filter(o => entryOf(r, o.code)).length;
      h += `<div class="card"><div class="row" style="border:0;padding:0 0 6px"><h2 style="margin:0" class="grow">${lv}</h2><span class="chip ${ok === rows.length ? 'ok' : 'warn'}">ครบ ${ok}/${rows.length}${ok === rows.length ? ' ✓' : ''}</span></div>
        <div class="scroll"><table class="tbl"><thead><tr><th>รหัส</th><th>รายวิชา</th>${sel === '*' ? '<th>กลุ่มสาระ</th>' : ''}<th>ห้อง</th><th>ครูผู้สอน</th><th>สถานะ</th><th>การสอบ</th><th style="text-align:right">นาที</th><th>ผู้ส่ง</th>${canDel ? '<th></th>' : ''}</tr></thead><tbody>
        ${rows.map(o => { const e = entryOf(r, o.code); return `<tr><td style="white-space:nowrap"><b>${esc(o.code)}</b></td><td>${esc(o.name)}</td>${sel === '*' ? `<td class="small">${esc(o.area)}</td>` : ''}<td class="small">${o.rooms.map(esc).join(', ')}</td><td class="small">${o.teachers.map(esc).join(', ')}</td>
          <td>${e ? '<span class="chip ok">ส่งแล้ว</span>' : '<span class="chip warn">ยังไม่ส่ง</span>'}</td><td>${e ? (e.mode === 'out' ? 'นอกตาราง' : 'ในตาราง') : '-'}</td><td style="text-align:right">${e ? esc(e.minutes) : '-'}</td><td class="small">${e ? esc(e.who) + '<div class="muted">' + esc(fmtAt(e.at)) + '</div>' : ''}</td>${canDel ? `<td>${delBtn(e)}</td>` : ''}</tr>`; }).join('')}</tbody></table></div></div>`; });
    if (extra.length) h += `<div class="card"><div class="row" style="border:0;padding:0 0 6px"><h2 style="margin:0" class="grow">ส่งแล้วแต่ไม่พบในตารางสอน</h2><span class="chip warn">${extra.length} รายการ</span></div>
        <div class="scroll"><table class="tbl"><thead><tr><th>รหัส</th><th>รายวิชา</th>${sel === '*' ? '<th>กลุ่มสาระ</th>' : ''}<th>ระดับ</th><th>สถานะ</th><th>การสอบ</th><th style="text-align:right">นาที</th><th>ผู้ส่ง</th>${canDel ? '<th></th>' : ''}</tr></thead><tbody>
        ${extra.map(e => `<tr><td style="white-space:nowrap"><b>${esc(e.code)}</b></td><td>${esc(e.name)}</td>${sel === '*' ? `<td class="small">${esc(e.area)}</td>` : ''}<td class="small">${esc(e.level)}</td><td><span class="chip warn">ไม่พบในตารางสอน</span></td>
          <td>${e.mode === 'out' ? 'นอกตาราง' : 'ในตาราง'}</td><td style="text-align:right">${esc(e.minutes)}</td><td class="small">${esc(e.who)}<div class="muted">${esc(fmtAt(e.at))}</div></td>${canDel ? `<td>${delBtn(e)}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
    if (noArea) h += '<div class="card"><div class="empty">เลือกกลุ่มสาระที่จะตรวจ</div></div>';
    else if (!list.length) h += '<div class="card"><div class="empty">ไม่พบรายวิชาในตารางสอนภาคนี้</div></div>';
    return h;
  };

  /* ลบรายการ (แอดมิน/วัดผล): ลบเอกสารตรง — ส่วนซิงก์ examPlans ไม่สั่งลบเอง (noDelete) กันรายการหายจากเครื่องใดเครื่องหนึ่งแล้วลบของจริง */
  async function delOne(id) {
    if (!isMeasure()) return; const e = plans().find(x => x.id === id); if (!e) return;
    if (!confirm('ลบกำหนดการสอบ ' + e.code + ' ' + (e.name || '') + ' (' + (ROUND[e.round] || e.round) + ') ที่ ' + e.who + ' ส่งไว้?\nครูต้องส่งใหม่ถ้ายังต้องใช้')) return;
    if (LIVE) { const db = window.EMSCloud && EMSCloud.db && EMSCloud.db(); if (!db) return toast('ยังไม่ได้เชื่อมระบบ');
      try { await db.collection('examPlans').doc(id).delete(); } catch (x) { return toast(x && x.code === 'permission-denied' ? 'ลบไม่ได้: บัญชีนี้ไม่มีสิทธิ์ลบ' : 'ลบไม่สำเร็จ — ลองใหม่'); } }
    S.examPlans = plans().filter(x => x.id !== id); if (!LIVE) save(); toast('ลบกำหนดการสอบ ' + e.code + ' แล้ว'); redraw();
  }

  function exportRows() {
    const head = ['ภาคเรียน', 'รอบ', 'ระดับ', 'กลุ่มสาระ', 'รหัสวิชา', 'ชื่อวิชา', 'ห้อง', 'ครูผู้สอน', 'สถานะ', 'การสอบ', 'เวลาสอบ (นาที)', 'ผู้ส่ง', 'ส่งเมื่อ'];
    const map = subjects(false), all = Object.values(map).sort((a, b) => (a.level + a.area + a.code).localeCompare(b.level + b.area + b.code, 'th'));
    const rows = [];
    Object.keys(ROUND).forEach(r => all.forEach(o => { const e = entryOf(r, o.code);
      rows.push([termTxt(), ROUND[r], o.level, o.area, o.code, o.name, o.rooms.join(', '), o.teachers.join(', '), e ? 'ส่งแล้ว' : 'ยังไม่ส่ง', e ? (e.mode === 'out' ? 'นอกตาราง' : 'ในตาราง') : '', e ? e.minutes : '', e ? e.who : '', e ? fmtAt(e.at) : '']); }));
    Object.keys(ROUND).forEach(r => plans().filter(e => e && e.term === tk() && e.round === r && !map[e.code]).forEach(e =>       // ส่งแล้วแต่ไม่พบในตารางสอน
      rows.push([termTxt(), ROUND[r], e.level || '', e.area || '', e.code, e.name || '', [].concat(e.rooms || []).join(', '), [].concat(e.teachers || []).join(', '), 'ส่งแล้ว (ไม่พบในตารางสอน)', e.mode === 'out' ? 'นอกตาราง' : 'ในตาราง', e.minutes, e.who || '', fmtAt(e.at)])));
    return [head].concat(rows);
  }
  function csv() {
    const text = '﻿' + exportRows().map(r => r.map(v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = 'กำหนดการสอบ_' + tk() + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  document.addEventListener('click', e => { const t = e.target.closest('[data-ep]'); if (!t) return; const a = t.dataset.ep, d = ui.draft[t.dataset.k];
    if (a === 'round') { ui.round = t.dataset.r; return redraw(); }
    if (a === 'round2') { ui.round2 = t.dataset.r; return redraw(); }
    if (a === 'mode' && d) { d.mode = t.dataset.v; d.touched = true; return redraw(); }
    if (a === 'min' && d) { d.minutes = +t.dataset.v; d.touched = true; return redraw(); }
    if (a === 'step' && d) { d.minutes = Math.min(MAX_M, Math.max(MIN_M, (+d.minutes || 60) + +t.dataset.v)); d.touched = true; return redraw(); }
    if (a === 'reload') { delete ui.draft[t.dataset.k]; return redraw(); }
    if (a === 'save') return saveOne(t.dataset.k);
    if (a === 'del') return delOne(t.dataset.id);
    if (a === 'toggle') { if (!isMeasure()) return; const all = S.examEntry = S.examEntry && typeof S.examEntry === 'object' ? S.examEntry : {}, cur = all[tk()] = Object.assign({}, all[tk()]);
      const was = !!(cur[t.dataset.r] || {}).open; cur[t.dataset.r] = { open: !was, by: S.me.name, at: new Date().toISOString() };
      save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); toast((was ? 'ปิด' : 'เปิด') + 'การกรอกกำหนดการสอบ' + ROUND[t.dataset.r] + 'แล้ว'); return redraw(); }
    if (a === 'csv') return csv();
    if (a === 'sheet') { const rows = exportRows(); if (window.EMSSheets && EMSSheets.send) return EMSSheets.send({ tabs: [{ title: 'กำหนดการสอบ ' + termTxt().replace('/', '-'), rows }], fallback: csv, fallbackName: 'CSV' }); return csv(); }
  });
  document.addEventListener('change', e => { const t = e.target.closest('[data-epf]'); if (!t) return; ui[t.dataset.epf] = t.value; redraw(); });

  /* ---------- เมนู ---------- */
  const N = window.EMSNav;
  if (N) {
    const add = (v, g, item) => { const grp = (N.NAVG[v] || []).find(x => x[0] === g); if (grp && !grp[1].some(x => x[0] === item[0])) grp[1].push(item); };
    add('teacher', 'งานของฉัน', ['exam-plan', 'กำหนดการสอบ', 'cal']);
    add('teacher', 'งานของฉัน', ['exam-check', 'ตรวจกำหนดการสอบ', 'check']);
    add('admin', 'ฝ่ายงาน', ['exam-check', 'กำหนดการสอบ (วัดผล)', 'cal']);
    const show = { 'exam-plan': () => anyOpen() || isAdmin(), 'exam-check': () => isHead() || isMeasure() };
    const hideFor = fn => function () { const cut = [];
      try { Object.keys(N.NAVG).forEach(v => (N.NAVG[v] || []).forEach(g => { for (let i = g[1].length - 1; i >= 0; i--) { const k = g[1][i][0]; if (show[k] && !show[k]()) cut.push([g[1], i, g[1].splice(i, 1)[0]]); } })); } catch (x) {}
      try { return fn.apply(this, arguments); } finally { cut.reverse().forEach(([arr, i, it]) => arr.splice(i, 0, it)); } };
    if (window.renderChrome) window.renderChrome = hideFor(window.renderChrome);
    if (window.openMore) window.openMore = hideFor(window.openMore);
    const hid = window.EMSNavHidden = window.EMSNavHidden || {};      // ค้นหาเมนู (Ctrl K) ซ่อนตามเงื่อนไขเดียวกัน (skins.js)
    Object.keys(show).forEach(k => { hid[k] = () => !show[k](); });
  }
  if (window.EMSNotify) EMSNotify.register(() => { if (viewing()) return [];
    const mine = Object.keys(subjects(true)); if (!mine.length) return [];
    return Object.keys(ROUND).filter(isOpen).map(r => { const c = entryCfg()[r] || {};
      return { id: 'exam-open-' + tk() + '-' + r + '-' + (c.at || ''), level: 'info', title: 'เปิดให้กรอกกำหนดการสอบ' + ROUND[r], sub: 'วิชาของคุณ ' + mine.length + ' วิชา (กรอกเฉพาะวิชาที่ออกข้อสอบ)', page: 'exam-plan', view: 'teacher', at: c.at }; }); });
  window.EMSExamPlan = { subjects, entryOf, keyOf, ui, scope, parseSub, areaOf, noExam };
})();
