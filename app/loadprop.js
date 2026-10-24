/* EMS — การเสนอภาระงานสอน (วก)
   ครูคนไหนสอนวิชาอะไร (รหัส/ชื่อวิชา) ชั้นไหน ห้องไหน กี่คาบ — เสนอเป็นรายกลุ่มสาระ เฉพาะภาคเรียนที่แอดมินเปิดเสนอ (S.loadTerm ค่าเริ่ม 2569-2)
   - หัวหน้ากลุ่มสาระมอบหมาย "ผู้เสนอ" (เจ้าหน้าที่กลุ่มสาระ) เบื้องต้น 1–5 คน เพิ่มได้ภายหลัง ; หัวหน้าเพิ่ม/แก้/ลบเองได้เสมอ (ไม่นับเป็นผู้เสนอ)
   - ผู้เสนอ/หัวหน้าเลือกครูในกลุ่มสาระ + รายวิชา + ชั้น + ห้อง → ครบแล้วกด "ส่ง" ไปงานวัดผลและงานจัดตารางสอน
   - งานวัดผล/งานจัดตาราง (บทบาท measure / academic / แอดมิน) รับเรื่อง ส่งกลับแก้ ดาวน์โหลด หรือส่งเข้าแอปจัดตารางสอน (/timetable/)
   ข้อมูล: S.loadProps (Firestore คอลเลกชัน loadProps หนึ่งเอกสารต่อรายการ · cloud.js ค้นเฉพาะภาคที่เปิด ด้วยฟิลด์ term/area ข้าง j และฟังเมื่อเปิดหน้านี้)
     { kind:'pack', id:'lp_<ภาค>_<กลุ่มสาระ>', term:'2569-2', area, status:'draft'|'sent'|'returned', sentAt, sentBy, note }
     { kind:'prop', id:<pack>_p_<hash>, term, area, name }        ผู้เสนอ 1 คน = 1 เอกสาร (มอบหมาย/ส่งพร้อมกันไม่ทับกัน)
     { kind:'recv', id:<pack>_r_<measure|academic>, term, area, k, by, at, sentAt }   รับเรื่องรายฝ่าย นับเฉพาะที่ sentAt ตรงกับการส่งครั้งล่าสุด
     { kind:'row',  id, term, area, teacher, code, name, level, rooms:[ชื่อห้อง], per, dbl, note, by, at, del? }
   รูปแบบเดิม pack.proposers / pack.recv ยังอ่านได้
   แถวลบแบบติดธง del เมื่อผู้ลบไม่ใช่ฝ่ายงาน (rules ให้ลบเอกสารได้เฉพาะคนเขียนล่าสุด/ฝ่ายงาน) — หัวหน้า/ฝ่ายงานลบจริงตอนลบ/ส่ง/รับเรื่อง */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const top = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${right}</div></div>`;
  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const rr = () => { const y = scrollY; render(); scrollTo(0, y); };
  const sortTh = (a, b) => String(a).localeCompare(String(b), 'th', { numeric: true });
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h.toString(36); };
  if (!Array.isArray(S.loadProps)) S.loadProps = [];
  const isLive = () => typeof LIVE !== 'undefined' && !!LIVE;
  /* บันทึกแล้วส่งขึ้นระบบทันที (ไม่รอหน่วง 700 ms) ลดช่วงที่คนอื่นแก้ชนกัน */
  const saveNow = () => { save(); if (isLive() && window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); };
  const loadingLP = () => isLive() && window.EMSCloud && EMSCloud.ready && !EMSCloud.ready.loadProps;

  /* ---------- บุคลากร/บทบาท ---------- */
  const rolesU = u => (u ? (u.roles && u.roles.length ? u.roles : [u.role || 'teacher']) : []);
  const meU = () => (S.staff || []).find(u => u.name === S.me.name) || { name: S.me.name, roles: [S.me.role], dept: S.me.dept };
  const myRoles = () => Array.from(new Set(rolesU(meU()).concat(S.me.roles || [], [S.me.role])));
  const isVac = u => rolesU(u).indexOf('vacant') >= 0;
  const areaOf = u => String((u && u.dept) || '').trim();
  const teacherish = u => !isVac(u) && rolesU(u).some(r => r !== 'support');
  const areas = () => Array.from(new Set((S.staff || []).filter(u => !isVac(u) && rolesU(u).some(r => r === 'teacher' || r === 'head')).map(areaOf).filter(Boolean))).sort(sortTh);
  const headsOf = a => (S.staff || []).filter(u => areaOf(u) === a && !isVac(u) && rolesU(u).indexOf('head') >= 0).map(u => u.name);
  const teachersOf = a => (S.staff || []).filter(u => areaOf(u) === a && teacherish(u)).map(u => u.name).sort(sortTh);
  const bootAdm = () => ((window.EMS_CONFIG || {}).adminEmails || []).map(x => String(x).toLowerCase()).indexOf(String(S.me.email || '').toLowerCase()) >= 0;
  const isAdm = () => myRoles().indexOf('admin') >= 0 || !!S.demoAdmin || (isLive() && bootAdm());       // เฉพาะผู้ดูแลระบบ (ไม่รวมผู้บริหาร/วิชาการ)
  const recvRoles = () => (isAdm() ? ['measure', 'academic'] : myRoles().filter(r => r === 'measure' || r === 'academic')).filter((r, i, a) => a.indexOf(r) === i);
  const canSetTerm = () => isAdm() || myRoles().indexOf('academic') >= 0;
  /* ลบเอกสารจริงได้ตาม rules = ฝ่ายงาน (office) — คนอื่นติดธง del */
  const OFFICE_R = ['admin', 'exec', 'academic', 'measure', 'personnel', 'general', 'affairs', 'head'];
  const canPurge = () => !isLive() || bootAdm() || myRoles().some(r => OFFICE_R.indexOf(r) >= 0);
  const RECV = { measure: 'งานวัดผล', academic: 'งานจัดตารางสอน' };

  /* ---------- ภาคเรียน: เริ่ม 2/69 · ภาคที่เปิดเสนอ = S.loadTerm (school/config) ---------- */
  const DEF_TERM = '2569-2';
  const openTerm = () => /^\d{4}-[12]$/.test(String(S.loadTerm || '')) ? S.loadTerm : DEF_TERM;
  const termList = () => { const y = Math.max(2570, (+((S.term || {}).year) || 2569) + 1), out = []; for (let yy = 2569; yy <= y; yy++) [1, 2].forEach(s => { if (!(yy === 2569 && s === 1)) out.push(yy + '-' + s); });
    if (out.indexOf(openTerm()) < 0) out.push(openTerm()); return out; };
  const termLabel = k => { const [y, s] = String(k).split('-'); return 'ภาค ' + s + '/' + String(y).slice(-2); };
  const ui = { area: '', open: '', mode: 'teacher' };
  const curTerm = openTerm;
  /** ขอบเขตที่ cloud.js ค้น: ฝ่ายรับเรื่อง/แอดมิน = ทั้งภาค · หัวหน้า/ผู้เสนอ = เฉพาะกลุ่มสาระของตัวเอง (ผู้เสนอต้องเป็นครูในกลุ่มสาระนั้น) */
  const scope = () => ({ term: openTerm(), area: isAdm() || recvRoles().length ? '' : areaOf(meU()) });
  const termHead = t => `ภาคเรียนที่เปิดเสนอ ${chip(termLabel(t), 'info')}`;
  const termCtl = t => canSetTerm() ? `<label class="muted small" for="lp-term">ภาคที่เปิดเสนอ (ทุกคนเห็นเฉพาะภาคนี้)</label><select class="in" id="lp-term" style="width:auto;min-height:38px">${termList().map(k => `<option value="${k}" ${k === t ? 'selected' : ''}>${termLabel(k)}</option>`).join('')}</select>` : '';

  /* ---------- ข้อมูล ---------- */
  const packId = (t, a) => 'lp_' + t + '_' + a.replace(/[\/\s.#$\[\]]+/g, '_');
  const packOf = (t, a) => S.loadProps.find(x => x.kind === 'pack' && x.term === t && x.area === a);
  const ensurePack = (t, a) => packOf(t, a) || (S.loadProps.push({ id: packId(t, a), kind: 'pack', term: t, area: a, status: 'draft' }), packOf(t, a));
  const rowsOf = (t, a) => S.loadProps.filter(x => x.kind === 'row' && !x.del && x.term === t && x.area === a);
  /** ผู้เสนอ = เอกสาร prop + รายชื่อแบบเดิมใน pack (ไม่รวมหัวหน้ากลุ่มสาระ) */
  const propsOf = (t, a) => { const p = packOf(t, a), hs = headsOf(a);
    return Array.from(new Set(((p && p.proposers) || []).concat(S.loadProps.filter(x => x.kind === 'prop' && x.term === t && x.area === a).map(x => x.name)))).filter(n => n && hs.indexOf(n) < 0); };
  /** การรับเรื่องของการส่งครั้งล่าสุด (รับเรื่องของการส่งครั้งก่อน/หลังส่งกลับไม่นับ) */
  const recvOf = (t, a) => { const p = packOf(t, a), o = {}; if (!p || p.status !== 'sent') return o;
    Object.keys(p.recv || {}).forEach(k => { if (RECV[k] && p.recv[k]) o[k] = p.recv[k]; });
    S.loadProps.forEach(x => { if (x.kind === 'recv' && x.term === t && x.area === a && RECV[x.k] && x.sentAt === p.sentAt) o[x.k] = { by: x.by, at: x.at }; });
    return o; };
  const purge = (t, a) => { if (!canPurge()) return; for (let i = S.loadProps.length - 1; i >= 0; i--) { const x = S.loadProps[i]; if (x.kind === 'row' && x.del && x.term === t && x.area === a) S.loadProps.splice(i, 1); } };
  const isHead = a => headsOf(a).indexOf(S.me.name) >= 0;
  const isProp = (t, a) => propsOf(t, a).indexOf(S.me.name) >= 0;
  const canEdit = (t, a) => { const p = packOf(t, a); return !(p && p.status === 'sent') && (isHead(a) || isProp(t, a) || isAdm()); };
  const myAreas = t => areas().filter(a => isHead(a) || isProp(t, a));
  const STATUS = { draft: ['กำลังเสนอ', 'warn'], sent: ['ส่งแล้ว', 'ok'], returned: ['ส่งกลับให้แก้', 'bad'] };
  const when = s => s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const areaTitle = a => /^กลุ่มสาระ/.test(a) ? a : 'กลุ่มสาระการเรียนรู้' + a;

  /* รายวิชาที่รู้จัก (จากตารางสอนในระบบ) ไว้เติมชื่อวิชาจากรหัส */
  const knownSubjects = () => { const m = {};
    const add = s => { const x = String(s || '').trim().match(/^(\S*\d\S*)\s+(.+)$/); if (x && !m[x[1]]) m[x[1]] = x[2]; };
    (S.ttOthers || []).forEach(e => add(e.subject)); (S.classes || []).forEach(c => add(c.subject));
    S.loadProps.forEach(r => { if (r.kind === 'row' && r.code && r.name && !m[r.code]) m[r.code] = r.name; });
    /* รายวิชาในหลักสูตร (curriculum.js) — ชื่อตามหลักสูตรมาก่อนชื่อที่พิมพ์ในตารางสอน */
    const cs = ((S.curDocs || {}).subjects || {}).subjects || {}; Object.keys(cs).forEach(c => { if (c[0] !== '*' && cs[c].n) m[c] = cs[c].n; });
    return m; };
  const roomNames = () => Array.from(new Set((S.rooms || []).map(r => r.name).filter(Boolean))).sort(sortTh);
  const levelOfRoom = n => { const x = String(n).match(/ม\.?\s?(\d)/); return x ? +x[1] : 0; };
  /** ม.4/9ญ → ห้องแม่ ม.4/9 (ห้องหลักคืน '') */
  const parentRoom = n => { const x = String(n).trim().match(/^(ม\.?\s*\d\s*\/\s*\d+)\s*(\S.*)?$/); return x && x[2] ? x[1] : ''; };
  const isBasic = code => /^\D*\d\d1\d\d/.test(String(code || ''));      // หลักที่ 3 ของตัวเลข = 1 → วิชาพื้นฐาน

  /* ---------- ภาพรวมรายชั้น → รายวิชา → ครู (หน้าจอ + พิมพ์) ---------- */
  const tot = r => (+r.per || 0) * Math.max(1, (r.rooms || []).length);
  const sumR = rs => rs.reduce((s, r) => s + tot(r), 0);
  function overview(t, a, pr) {
    const rows = rowsOf(t, a), all = roomNames();
    const T = pr ? '<table>' : '<div class="scroll"><table class="tbl">', TE = pr ? '</table>' : '</table></div>', R = ' style="text-align:right"';
    const note = s => pr ? `<p style="margin:4px 0">${s}</p>` : `<div class="muted small" style="margin:6px 0">${s}</div>`;
    const h3 = s => `<h3 style="margin:${pr ? '14px 0 2px' : '14px 0 6px'}">${s}</h3>`;
    const levels = [1, 2, 3, 4, 5, 6].filter(l => rows.some(r => +r.level === l) || all.some(n => levelOfRoom(n) === l))
      .concat(Array.from(new Set(rows.map(r => +r.level).filter(l => !(l >= 1 && l <= 6)))));
    let h = '';
    levels.forEach(l => {
      const lr = rows.filter(r => +r.level === l), by = {};
      lr.forEach(r => { const k = r.code + '\u0001' + r.name; (by[k] = by[k] || []).push(r); });
      const keys = Object.keys(by).sort(sortTh), used = new Set(lr.flatMap(r => (r.rooms || []).map(n => parentRoom(n) || n)));
      const miss = all.filter(n => levelOfRoom(n) === l && !parentRoom(n) && !used.has(n));
      h += h3(`${l >= 1 && l <= 6 ? 'มัธยมศึกษาปีที่ ' + l : 'ไม่ระบุชั้น'} · ${keys.length} วิชา · ${sumR(lr)} คาบ/สัปดาห์`);
      if (keys.length) h += T + `<thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ครูผู้สอน</th><th>ห้องเรียน</th><th${R}>คาบ/ห้อง</th><th${R}>ห้อง</th><th${R}>คาบรวม</th><th${R}>รวมรายวิชา</th></tr></thead><tbody>` +
        keys.map(k => { const rs = by[k].slice().sort((x, y) => sortTh(x.teacher, y.teacher)), n = rs.length;
          return rs.map((r, i) => `<tr>${i ? '' : `<td rowspan="${n}">${esc(r.code)}</td><td rowspan="${n}">${esc(r.name)}</td>`}<td>${esc(r.teacher)}${+r.dbl ? ` <span style="font-size:.85em">(คาบคู่ ${esc(r.dbl)} ชุด)</span>` : ''}</td><td>${(r.rooms || []).map(esc).join(', ')}</td>
            <td${R}>${esc(r.per)}</td><td${R}>${(r.rooms || []).length}</td><td${R}>${tot(r)}</td>${i ? '' : `<td rowspan="${n}"${R}><b>${sumR(rs)}</b></td>`}</tr>`).join(''); }).join('') +
        `<tr><td colspan="7"${R}><b>รวม ${l >= 1 && l <= 6 ? 'ม.' + l : 'ไม่ระบุชั้น'}</b></td><td${R}><b>${sumR(lr)}</b></td></tr></tbody>` + TE;
      else h += note('ยังไม่มีรายวิชาของกลุ่มสาระในชั้นนี้');
      if (miss.length && keys.length) h += note(`ห้อง ม.${l} ที่ยังไม่มีวิชาใดของกลุ่มสาระ (${miss.length} ห้อง): ${miss.map(esc).join(', ')}`);
    });
    const byT = {}; rows.forEach(r => { (byT[r.teacher] = byT[r.teacher] || []).push(r); });
    const names = Array.from(new Set(teachersOf(a).concat(Object.keys(byT)))).sort(sortTh);
    h += h3('สรุปภาระงานสอนรายครู') + T + `<thead><tr><th>ที่</th><th>ครูผู้สอน</th><th>รายวิชา</th><th>ชั้น</th><th${R}>จำนวนห้อง</th><th${R}>รวมคาบ/สัปดาห์</th></tr></thead><tbody>` +
      names.map((n, i) => { const rs = byT[n] || [];
        return `<tr><td>${i + 1}</td><td>${esc(n)}</td><td>${Array.from(new Set(rs.map(r => r.code))).sort(sortTh).map(esc).join(', ') || '-'}</td><td>${Array.from(new Set(rs.map(r => 'ม.' + r.level))).sort(sortTh).map(esc).join(', ') || '-'}</td>
          <td${R}>${rs.reduce((s, r) => s + (r.rooms || []).length, 0) || '-'}</td><td${R}>${rs.length ? sumR(rs) : '-'}</td></tr>`; }).join('') +
      `<tr><td colspan="5"${R}><b>รวมทั้งกลุ่มสาระ</b></td><td${R}><b>${sumR(rows)}</b></td></tr></tbody>` + TE;
    return h;
  }
  function printArea(t, a) {
    if (typeof printDoc !== 'function') return toast('หน้านี้ยังพิมพ์ไม่ได้ — รีเฟรชแล้วลองใหม่');
    const [y, s] = String(t).split('-'), heads = headsOf(a), p = packOf(t, a), st = STATUS[(p && p.status) || 'draft'], title = 'สรุปภาระงานสอน ' + areaTitle(a);
    const logo = new URL(window.EMSLogo ? EMSLogo() : 'icons/school-logo.png', location.href).href;
    const head = `<div style="text-align:center"><img src="${esc(logo)}" style="height:1.6cm"><h1 style="margin:4px 0 0">${esc(title)}</h1><div>${esc((S.settings || {}).schoolName || 'โรงเรียนปากช่อง')} · ภาคเรียนที่ ${esc(s)}/${esc(y)}</div></div>`;
    const sign = `<table style="width:100%;margin-top:28px;border:0"><tr><td style="border:0;width:50%"></td><td style="border:0;text-align:center">ลงชื่อ ....................................<br>( ${heads.length ? heads.map(esc).join(' / ') : '....................................'} )<br>หัวหน้า${esc(areaTitle(a))}<br>วันที่ ........ / ........ / ........</td></tr></table>`;
    printDoc(title, head + `<p class="c" style="margin:6px 0">สถานะ: ${esc(st[0])}${p && p.sentAt ? ' · ส่งเมื่อ ' + esc(when(p.sentAt)) : ''} · ${rowsOf(t, a).length} รายการ · พิมพ์เมื่อ ${esc(when(new Date().toISOString()))}</p>` + overview(t, a, true) + sign);
  }

  /* ---------- ครู/ผู้เสนอ ---------- */
  P.loadprop = () => {
    const t = curTerm(), title = 'เสนอภาระงานสอน (วก)';
    if (loadingLP()) return top(title, termHead(t), termCtl(t)) + `<div class="card"><div class="empty">กำลังโหลดภาระงานสอน ${termLabel(t)}…</div></div>`;
    const mine = myAreas(t), all = isAdm() ? areas() : mine;
    const rcv = recvRoles().length;
    if (!all.length) return top(title, termHead(t) + ' · หัวหน้ากลุ่มสาระและครูที่ได้รับมอบหมายเสนอว่าครูคนไหนสอนวิชาอะไร ห้องไหน', termCtl(t)) +
      `<div class="card"><div class="empty">หน้านี้สำหรับหัวหน้ากลุ่มสาระและครูที่หัวหน้ามอบหมายให้เสนอภาระงานสอน${rcv ? ' · งานวัดผล/งานจัดตารางดูที่หน้า “ภาระงานสอนที่เสนอ (วก)” ในมุมมองฝ่ายงาน' : ''}</div></div>`;
    if (all.indexOf(ui.area) < 0) ui.area = mine[0] || all[0];
    const a = ui.area, p = packOf(t, a), rows = rowsOf(t, a), ed = canEdit(t, a), head = isHead(a) || isAdm();
    const st = STATUS[(p && p.status) || 'draft'], tAll = teachersOf(a), heads = headsOf(a);
    const sel = (id, opts, cur) => `<select class="in" id="${id}" style="width:auto;min-height:38px">${opts.map(o => `<option value="${esc(o[0])}" ${o[0] === cur ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    let h = top(title, termHead(t) + ' · เลือกครูในกลุ่มสาระ รายวิชา ชั้น และห้องที่สอน ครบแล้วกดส่งไปงานวัดผลและงานจัดตารางสอน',
      termCtl(t) + (all.length > 1 ? sel('lp-area', all.map(x => [x, x]), a) : ''));
    // สถานะ + ส่ง
    const recv = recvOf(t, a);
    h += `<div class="card"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:8px"><div style="flex:1 1 240px;min-width:0"><b>${esc(a)}</b> · ${chip(termLabel(t), 'info')} ${chip(st[0], st[1])}
        <div class="muted small">หัวหน้ากลุ่มสาระ: ${heads.length ? heads.map(esc).join(', ') : 'ยังไม่กำหนด (ตั้งบทบาท “หัวหน้ากลุ่มสาระ” ที่หน้าผู้ใช้และสิทธิ์)'}
        ${p && p.sentAt && p.status === 'sent' ? ` · ส่งเมื่อ ${esc(when(p.sentAt))} โดย ${esc(p.sentBy || '')}` : ''}
        ${Object.keys(RECV).map(k => recv[k] ? ` · ${RECV[k]}รับแล้ว (${esc(recv[k].by)})` : '').join('')}</div>
        ${p && p.status === 'returned' && p.note ? `<div class="small" style="color:var(--bad)">ส่งกลับ: ${esc(p.note)}</div>` : ''}</div>
      ${ed && rows.length ? `<button class="btn pri" data-lp="send">${ic('up')}ส่งไปงานวัดผล / งานจัดตารางสอน</button>` : ''}
      ${p && p.status === 'sent' && (isHead(a) || isAdm()) && !Object.keys(recv).length ? `<button class="btn" data-lp="unsend">ดึงกลับมาแก้</button>` : ''}</div></div>`;
    // ตรวจกับหลักสูตร (curriculum.js): วิชาตามแผนการเรียนของห้องที่ยังไม่มีครู + ปุ่มมอบหมาย
    if (window.EMSCur) h += EMSCur.coverageCard(t, a, rows, ed);
    // ผู้เสนอ (หัวหน้ามอบหมาย)
    const props = propsOf(t, a);
    h += `<div class="card"><h2>ผู้เสนอภาระงาน (เจ้าหน้าที่กลุ่มสาระ) ${chip(props.length + ' คน', props.length ? 'ok' : 'warn')}</h2>
      <div class="muted small" style="margin-bottom:8px">หัวหน้ากลุ่มสาระเพิ่ม/แก้/ลบภาระงานได้เองทุกเมื่อ โดยไม่ต้องอยู่ในรายชื่อนี้ และไม่นับรวมในจำนวนผู้เสนอ · มอบหมายผู้เสนอเบื้องต้น 1–5 คน (ไม่ครบก็ได้ และเพิ่มภายหลังได้)</div>
      ${isHead(a) ? `<div class="notice" style="margin-bottom:8px">คุณเป็นหัวหน้ากลุ่มสาระนี้ — ${ed ? 'กด “เพิ่มภาระงาน” ด้านล่างได้เลย' : 'ส่งแล้ว ดึงกลับมาแก้ได้ถ้ายังไม่มีหน่วยงานรับเรื่อง'}</div>` : ''}
      <div class="list">${props.map(n => `<div class="row"><div class="grow">${esc(n)}</div>${head && ed ? `<button class="btn sm" data-lp="rmProp" data-n="${esc(n)}">นำออก</button>` : ''}</div>`).join('') || '<div class="empty">ยังไม่ได้มอบหมาย</div>'}</div>
      ${head && ed ? `<div class="row" style="border:0;gap:8px;flex-wrap:wrap;margin-top:8px">${sel('lp-addprop', [['', '— เลือกครูในกลุ่มสาระ —']].concat(tAll.filter(n => props.indexOf(n) < 0 && heads.indexOf(n) < 0).map(n => [n, n])), '')}
        <button class="btn" data-lp="addProp">${ic('plus')}มอบหมาย</button>${props.length >= 5 ? '<span class="muted small">เกิน 5 คนแล้ว — เพิ่มได้ตามจำเป็น</span>' : ''}</div>` : ''}</div>`;
    // ภาระงาน รายครู / ภาพรวมรายชั้น-รายวิชา
    const byT = {}; rows.forEach(r => { (byT[r.teacher] = byT[r.teacher] || []).push(r); });
    const total = sumR(rows), names = Object.keys(byT).sort(sortTh), none = tAll.filter(n => !byT[n]), lvMode = ui.mode === 'level';
    h += `<div class="card"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:8px"><h2 class="grow" style="margin:0">ภาระงานสอน ${chip(rows.length + ' รายการ')} ${chip(total + ' คาบ/สัปดาห์', 'info')}</h2>
        <button class="btn sm ${lvMode ? '' : 'pri'}" data-lp="mode" data-m="teacher">รายครู</button><button class="btn sm ${lvMode ? 'pri' : ''}" data-lp="mode" data-m="level">ภาพรวมรายชั้น / รายวิชา</button>
        ${rows.length ? `<button class="btn sm" data-lp="print">${ic('print')}พิมพ์ / บันทึก PDF</button>` : ''}
        ${ed ? `<button class="btn pri" data-lp="add">${ic('plus')}เพิ่มภาระงาน</button>` : ''}</div>
      ${lvMode ? (rows.length ? `<div class="muted small" style="margin-top:6px">ตรวจก่อนส่งงานวัดผล: แต่ละชั้นมีวิชาอะไร ครูคนไหนสอนห้องไหน และห้องที่ยังไม่มีวิชาของกลุ่มสาระ</div>` + overview(t, a) : '<div class="empty">ยังไม่มีภาระงาน — กด “เพิ่มภาระงาน”</div>')
      : names.length ? `<div class="scroll" style="margin-top:10px"><table class="tbl"><thead><tr><th>ครู</th><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ชั้น</th><th>ห้องที่สอน</th><th style="text-align:right">คาบ/สัปดาห์</th><th>คาบคู่</th><th></th></tr></thead><tbody>
        ${names.map(n => byT[n].map((r, i) => `<tr><td>${i ? '' : `<b>${esc(n)}</b><div class="muted small">รวม ${sumR(byT[n])} คาบ</div>`}</td><td>${esc(r.code)}</td><td>${esc(r.name)}${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ''}</td><td>ม.${esc(r.level)}</td>
          <td>${(r.rooms || []).map(esc).join(', ')}</td><td style="text-align:right">${esc(r.per)}${(r.rooms || []).length > 1 ? ` × ${r.rooms.length}` : ''}</td><td>${+r.dbl ? esc(r.dbl) + ' ชุด' : '-'}</td>
          <td style="white-space:nowrap">${ed ? `<button class="btn sm" data-lp="edit" data-id="${esc(r.id)}">แก้</button><button class="btn sm" data-lp="del" data-id="${esc(r.id)}">ลบ</button>` : ''}</td></tr>`).join('')).join('')}
        </tbody></table></div>` : '<div class="empty">ยังไม่มีภาระงาน — กด “เพิ่มภาระงาน”</div>'}
      ${none.length && !lvMode ? `<div class="muted small" style="margin-top:8px">ครูในกลุ่มสาระที่ยังไม่มีภาระงาน: ${none.map(esc).join(', ')}</div>` : ''}</div>`;
    return h;
  };

  /* ---------- ฟอร์มเพิ่ม/แก้ภาระงาน ---------- */
  let form = null;
  function openForm(id) {
    const t = curTerm(), a = ui.area, r = id ? S.loadProps.find(x => x.id === id) : null;
    if (!canEdit(t, a)) return toast('กลุ่มสาระนี้ส่งแล้ว แก้ไม่ได้');
    form = r ? Object.assign({}, r, { rooms: (r.rooms || []).slice() }) : { teacher: '', code: '', name: '', level: 1, rooms: [], per: 2, dbl: 0, note: '' };
    drawForm(t, a);
  }
  /** จากการ์ดตรวจกับหลักสูตร: เติมรหัส ชื่อ ชั้น ห้องที่ยังขาด และคาบตามหน่วยกิต เหลือเลือกครู (ช่องวิชาเลือก *xxx = ให้กรอกรหัสจริง) */
  function openFromCur(code, level, rooms) {
    const t = curTerm(), a = ui.area, C = window.EMSCur;
    if (!canEdit(t, a)) return toast('กลุ่มสาระนี้ส่งแล้ว แก้ไม่ได้');
    const slot = /^\*/.test(code) ? code : '';
    form = { teacher: '', code: slot ? '' : code, name: slot ? '' : C.label(code), level: +level || 1, rooms: rooms.slice(), per: C.per(code) || 2, dbl: 0, note: '', slot };
    drawForm(t, a);
  }
  function drawForm(t, a) {
    const f = form, rooms = roomNames().filter(n => levelOfRoom(n) === +f.level), subj = knownSubjects();
    modal(`<h2 style="margin-bottom:6px">${f.id ? 'แก้ภาระงาน' : 'เพิ่มภาระงาน'} · ${esc(a)}</h2><p class="muted small">${termLabel(t)} · หนึ่งรายการ = ครู 1 คน สอนวิชา 1 วิชา (เลือกได้หลายห้อง)</p>
      ${f.slot ? `<div class="notice" style="margin-bottom:8px">ช่องวิชาเลือกตามหลักสูตร <b>${esc((window.EMSCur && EMSCur.label(f.slot)) || f.slot)}</b> — กรอกรหัสและชื่อวิชาที่เปิดสอนจริง</div>` : ''}
      <div class="grid g2">
        <div class="field"><label class="f" for="lpf-t">ครูผู้สอน</label><select class="in" id="lpf-t" data-lpf="teacher"><option value="">— เลือกครู —</option>${teachersOf(a).map(n => `<option ${n === f.teacher ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <div class="field"><label class="f" for="lpf-l">ชั้น</label><select class="in" id="lpf-l" data-lpf="level">${[1, 2, 3, 4, 5, 6].map(l => `<option value="${l}" ${+f.level === l ? 'selected' : ''}>ม.${l}</option>`).join('')}</select></div>
        <div class="field"><label class="f" for="lpf-c">รหัสวิชา</label><input class="in" id="lpf-c" data-lpf="code" list="lpf-codes" value="${esc(f.code)}" placeholder="เช่น ค21102"><datalist id="lpf-codes">${Object.keys(subj).sort(sortTh).map(c => `<option value="${esc(c)}">${esc(subj[c])}</option>`).join('')}</datalist></div>
        <div class="field"><label class="f" for="lpf-n">ชื่อวิชา</label><input class="in" id="lpf-n" data-lpf="name" value="${esc(f.name)}"></div>
        <div class="field"><label class="f" for="lpf-p">คาบ/สัปดาห์ (ต่อห้อง)</label><input class="in" id="lpf-p" data-lpf="per" type="number" min="1" max="20" value="${esc(f.per)}"></div>
        <div class="field"><label class="f" for="lpf-d">คาบคู่ (ชุด) — ไม่มีใส่ 0</label><input class="in" id="lpf-d" data-lpf="dbl" type="number" min="0" max="10" value="${esc(f.dbl)}"></div>
      </div>
      <div class="field"><label class="f">ห้องเรียนที่สอน (ม.${esc(f.level)}) ${chip(f.rooms.length + ' ห้อง')}</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${rooms.map(n => `<label class="chip" style="cursor:pointer;gap:4px"><input type="checkbox" data-lpr="${esc(n)}" ${f.rooms.indexOf(n) >= 0 ? 'checked' : ''}> ${esc(n)}</label>`).join('') || '<span class="muted small">ยังไม่มีห้องของชั้นนี้ในระบบ (ตั้งที่ ตั้งค่าโรงเรียน › ห้องเรียน)</span>'}</div>
        <div class="muted small" style="margin-top:4px">ห้องกลุ่มย่อย (เช่น ม.4/9ญ) ใช้กับวิชาเพิ่มเติมเท่านั้น — วิชาพื้นฐานให้เลือกห้องแม่ (ม.4/9)</div></div>
      <div class="field"><label class="f" for="lpf-o">หมายเหตุ (ถ้ามี)</label><input class="in" id="lpf-o" data-lpf="note" value="${esc(f.note)}" placeholder="เช่น สอนในห้อง Lab"></div>
      <div class="row" style="border:0;gap:8px;justify-content:flex-end"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" data-lp="saveRow">บันทึก</button></div>`, true);
  }
  function saveRow() {
    const f = form, t = curTerm(), a = ui.area;
    if (!f) return closeModal();
    if (!canEdit(t, a)) { closeModal(); rr(); return toast('กลุ่มสาระนี้ส่งแล้ว แก้ไม่ได้'); }
    f.code = String(f.code || '').replace(/\s+/g, '').trim(); f.name = String(f.name || '').trim();
    if (!f.teacher) return toast('กรุณาเลือกครูผู้สอน');
    if (!/^[ก-ฮA-Za-z]{1,3}\d{5}$/.test(f.code)) return toast('รหัสวิชาไม่ถูกรูปแบบ (เช่น ค21102)');
    if (!f.name) return toast('กรุณากรอกชื่อวิชา');
    if (!f.rooms.length) return toast('กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง');
    const wrongLv = f.rooms.filter(n => levelOfRoom(n) !== +f.level);
    if (wrongLv.length) return toast('ห้อง ' + wrongLv.join(', ') + ' ไม่ใช่ชั้น ม.' + f.level + ' — เลือกห้องใหม่');
    const per = +f.per, dbl = +f.dbl || 0;
    if (!(per >= 1 && per <= 20)) return toast('คาบ/สัปดาห์ต้องเป็น 1–20');
    if (dbl < 0 || dbl * 2 > per) return toast('คาบคู่เกินจำนวนคาบ/สัปดาห์');
    // วิชาพื้นฐานในห้องกลุ่มย่อย (มีห้องแม่ในระบบ) — แอปจัดตารางไม่รับ ต้องเรียนรวมที่ห้องแม่
    const all = roomNames(), sub = isBasic(f.code) ? f.rooms.filter(n => { const pr = parentRoom(n); return pr && all.indexOf(pr) >= 0; }) : [];
    if (sub.length && !confirm(f.code + ' เป็นวิชาพื้นฐาน แต่เลือกห้องกลุ่มย่อย ' + sub.join(', ') + '\nวิชาพื้นฐานต้องเรียนรวมที่ห้องแม่ (' + Array.from(new Set(sub.map(parentRoom))).join(', ') + ') — แอปจัดตารางสอนจะไม่รับห้องกลุ่มย่อยของวิชานี้\n\nบันทึกต่อหรือไม่? (แนะนำให้กดยกเลิกแล้วเลือกห้องแม่)')) return;
    // ห้องเดียวกัน วิชาเดียวกัน ครูคนอื่นเสนอไว้แล้ว → เตือน (อาจเป็นครูสอนคู่)
    const dup = rowsOf(t, a).filter(r => r.id !== f.id && r.code === f.code && r.teacher !== f.teacher && (r.rooms || []).some(x => f.rooms.indexOf(x) >= 0));
    ensurePack(t, a);
    const rec = { kind: 'row', term: t, area: a, teacher: f.teacher, code: f.code, name: f.name, level: +f.level, rooms: f.rooms.slice().sort(sortTh), per: per, dbl: dbl, note: String(f.note || '').trim(), by: S.me.name, at: new Date().toISOString() };
    if (f.slot) rec.slot = f.slot;      // ใช้แทนช่องวิชาเลือกของหลักสูตร (curriculum.js นับว่าครบ)
    const o = f.id && S.loadProps.find(x => x.id === f.id);
    if (o) Object.assign(o, rec); else S.loadProps.push(Object.assign({ id: uid('lpr') }, rec));
    const p = packOf(t, a); if (p.status === 'returned') p.status = 'draft';
    saveNow(); closeModal(); form = null; rr();
    toast(dup.length ? 'บันทึกแล้ว · ' + f.code + ' ห้องเดียวกันมีครูอื่นเสนอไว้แล้ว (' + dup.map(r => r.teacher).join(', ') + ') ตรวจว่าเป็นครูสอนคู่หรือซ้ำ' : 'บันทึกแล้ว');
  }

  /* ---------- งานวัดผล / งานจัดตารางสอน ---------- */
  const LOAD_HEAD = ['กลุ่มสาระ', 'ชื่อครู', 'อีเมลครู', 'รหัสวิชา', 'ชื่อวิชา', 'ห้องเรียน', 'คาบ/สัปดาห์', 'คาบคู่ (ชุด)', 'สถานที่', 'หมายเหตุ'];
  const emailOf = n => ((S.staff || []).find(u => u.name === n) || {}).email || '';
  /** แถวรูปแบบแม่แบบภาระงานของแอปจัดตารางสอน (หนึ่งแถวต่อห้อง) */
  const loadRows = (t, areasSel) => [LOAD_HEAD].concat([].concat(...areasSel.map(a => rowsOf(t, a).sort((x, y) => sortTh(x.teacher, y.teacher) || sortTh(x.code, y.code))
    .map(r => (r.rooms || []).map(rm => [a, r.teacher, emailOf(r.teacher), r.code, r.name, rm, r.per, r.dbl || 0, '', r.note || ''])))).reduce((x, y) => x.concat(y), []));
  const csv = rows => '﻿' + rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

  /** ช่องสรุปความครบตามหลักสูตรของกลุ่มสาระ (curriculum.js) */
  const covCell = (t, a, rows) => { const c = window.EMSCur ? EMSCur.coverage(t, a, rows) : null; if (!c || c.off || !c.total) return '-';
    return chip(c.done + '/' + c.total, c.done === c.total ? 'ok' : 'warn') + (c.extra.length + c.perBad.length + c.loose.length ? ' ' + chip('ตรวจ ' + (c.extra.length + c.perBad.length + c.loose.length), 'warn') : ''); };
  P['a-loadprop'] = () => {
    const t = curTerm(), rr2 = recvRoles(), title = 'ภาระงานสอนที่เสนอ (วก)';
    if (!rr2.length && !isAdm()) return top(title, '') + '<div class="card"><div class="empty">หน้านี้สำหรับงานวัดผลและงานจัดตารางสอน</div></div>';
    if (loadingLP()) return top(title, termHead(t), termCtl(t)) + `<div class="card"><div class="empty">กำลังโหลดภาระงานสอน ${termLabel(t)}…</div></div>`;
    const list = areas().map(a => ({ a, p: packOf(t, a), rows: rowsOf(t, a), rc: recvOf(t, a) }));
    const sent = list.filter(x => x.p && x.p.status === 'sent');
    let h = top(title, termHead(t) + ' · กลุ่มสาระส่งมาแล้วรับเรื่อง ตรวจ แล้วส่งเข้าแอปจัดตารางสอนเพื่อจัดตารางสอนและตารางเรียนต่อ', termCtl(t));
    h += `<div class="card"><div class="row" style="border:0;padding:0;flex-wrap:wrap;gap:8px"><div class="grow">ส่งแล้ว <b>${sent.length}</b> จาก ${list.length} กลุ่มสาระ · ${sent.reduce((s, x) => s + x.rows.length, 0)} รายการ · ${sent.reduce((s, x) => s + sumR(x.rows), 0)} คาบ/สัปดาห์</div>
        ${sent.length ? `<button class="btn" data-lp="csvAll">${ic('down')}ดาวน์โหลด (.csv)</button><button class="btn pri" data-lp="toStudio">${ic('cal')}ส่งเข้าแอปจัดตารางสอน</button>` : ''}</div>
      <div class="muted small" style="margin-top:6px">ส่งเข้าแอปจัดตารางสอน = เฉพาะกลุ่มสาระที่ส่งแล้ว ไปเป็น “ภาระงานสอน” ในแอปจัดตาราง (แท็บตั้งค่าและไฟล์ › รับภาระงานจาก EMS) แล้วจัดอัตโนมัติต่อ · แอปจัดตารางแทนคาบสอนทั้งหมดด้วยชุดที่ส่ง — ควรรอให้ส่งครบทุกกลุ่มสาระ</div></div>`;
    h += `<div class="card"><div class="scroll"><table class="tbl"><thead><tr><th>กลุ่มสาระ</th><th>สถานะ</th><th>ผู้เสนอ</th><th style="text-align:right">รายการ</th><th style="text-align:right">คาบ/สัปดาห์</th><th>ตามหลักสูตร</th><th>ส่งเมื่อ</th><th>รับเรื่อง</th><th></th></tr></thead><tbody>
      ${list.map(({ a, p, rows, rc }) => { const st = STATUS[(p && p.status) || 'draft'];
        return `<tr><td><b>${esc(a)}</b></td><td style="white-space:nowrap">${p ? chip(st[0], st[1]) : chip('ยังไม่เริ่ม')}</td><td class="small">${propsOf(t, a).map(esc).join(', ') || '-'}</td><td style="text-align:right">${rows.length}</td><td style="text-align:right">${sumR(rows)}</td><td class="small" style="white-space:nowrap">${covCell(t, a, rows)}</td>
          <td class="small">${p && p.sentAt && p.status === 'sent' ? esc(when(p.sentAt)) : '-'}</td><td class="small" style="white-space:nowrap">${Object.keys(RECV).map(k => rc[k] ? chip(RECV[k] + ' ✓', 'ok') : '').join(' ') || '-'}</td>
          <td style="white-space:nowrap">${rows.length ? `<button class="btn sm" data-lp="view" data-a="${esc(a)}">${ui.open === a ? 'ปิด' : 'ดู'}</button>` : ''}
            ${p && p.status === 'sent' ? rr2.filter(k => !rc[k]).map(k => `<button class="btn sm pri" data-lp="recv" data-a="${esc(a)}" data-k="${k}">รับเรื่อง (${RECV[k]})</button>`).join('') + `<button class="btn sm" data-lp="return" data-a="${esc(a)}">ส่งกลับแก้</button>` : ''}</td></tr>
          ${ui.open === a ? `<tr><td colspan="9"><div class="row" style="border:0;padding:0;gap:8px"><div class="grow muted small">ภาพรวม ${esc(a)} รายชั้น / รายวิชา</div><button class="btn sm" data-lp="print" data-a="${esc(a)}">${ic('print')}พิมพ์ / บันทึก PDF</button></div>${overview(t, a)}</td></tr>` : ''}`; }).join('')}
      </tbody></table></div></div>`;
    return h;
  };

  /* ---------- เหตุการณ์ ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lp]'); if (!b) return; const d = b.dataset, t = curTerm(), now = new Date().toISOString();
    switch (d.lp) {
      case 'add': return openForm('');
      case 'fromCur': { let rs = []; try { rs = JSON.parse(d.rooms || '[]'); } catch (er) {} return window.EMSCur ? openFromCur(d.code, d.level, rs) : null; }
      case 'edit': return openForm(d.id);
      case 'saveRow': return saveRow();
      case 'mode': ui.mode = d.m === 'level' ? 'level' : 'teacher'; return rr();
      case 'print': return printArea(t, d.a || ui.area);
      case 'del': { const r = S.loadProps.find(x => x.id === d.id); if (!r || !canEdit(r.term, r.area)) return toast('กลุ่มสาระนี้ส่งแล้ว แก้ไม่ได้');
        if (!confirm('ลบภาระงาน ' + r.code + ' ของ ' + r.teacher + '?')) return;
        if (canPurge()) S.loadProps.splice(S.loadProps.indexOf(r), 1); else { r.del = true; r.by = S.me.name; r.at = now; }
        saveNow(); toast('ลบแล้ว'); return rr(); }
      case 'addProp': { const n = ($('#lp-addprop') || {}).value, a = ui.area; if (!n) return toast('เลือกครูก่อน');
        if (!(isHead(a) || isAdm()) || !canEdit(t, a)) return toast('เฉพาะหัวหน้ากลุ่มสาระ และยังไม่ได้ส่ง');
        if (propsOf(t, a).indexOf(n) < 0 && !S.loadProps.some(x => x.kind === 'prop' && x.term === t && x.area === a && x.name === n))
          S.loadProps.push({ id: packId(t, a) + '_p_' + hash(n), kind: 'prop', term: t, area: a, name: n, by: S.me.name, at: now });
        saveNow(); toast('มอบหมาย ' + n + ' แล้ว'); return rr(); }
      case 'rmProp': { const a = ui.area, p = packOf(t, a); if (!(isHead(a) || isAdm())) return;
        for (let i = S.loadProps.length - 1; i >= 0; i--) { const x = S.loadProps[i]; if (x.kind === 'prop' && x.term === t && x.area === a && x.name === d.n) S.loadProps.splice(i, 1); }
        if (p && Array.isArray(p.proposers) && p.proposers.indexOf(d.n) >= 0) p.proposers = p.proposers.filter(x => x !== d.n);
        saveNow(); return rr(); }
      case 'send': { const a = ui.area, rows = rowsOf(t, a); if (!rows.length) return toast('ยังไม่มีภาระงาน');
        if (!canEdit(t, a)) { toast('กลุ่มสาระนี้ส่งแล้ว'); return rr(); }
        const tAll = teachersOf(a), miss = tAll.filter(n => !rows.some(r => r.teacher === n));
        if (!confirm('ส่งภาระงานสอน ' + a + ' ' + termLabel(t) + ' ' + rows.length + ' รายการ ไปงานวัดผลและงานจัดตารางสอน?' + (miss.length ? '\n\nครูที่ยังไม่มีภาระงาน ' + miss.length + ' คน: ' + miss.join(', ') : '') + '\n\nส่งแล้วแก้ไม่ได้จนกว่าจะดึงกลับหรือถูกส่งกลับ')) return;
        const p = ensurePack(t, a); Object.assign(p, { status: 'sent', sentAt: now, sentBy: S.me.name, note: '' }); if (p.recv) p.recv = {};
        purge(t, a); saveNow(); toast('ส่งแล้ว'); return rr(); }
      case 'unsend': { const p = packOf(t, ui.area); if (!p || p.status !== 'sent') { toast('สถานะเปลี่ยนแล้ว — แสดงข้อมูลล่าสุดให้แล้ว'); return rr(); }
        if (Object.keys(recvOf(t, ui.area)).length) { toast('มีหน่วยงานรับเรื่องแล้ว ดึงกลับไม่ได้ — ขอให้ส่งกลับแก้'); return rr(); }
        p.status = 'draft'; saveNow(); toast('ดึงกลับมาแก้แล้ว'); return rr(); }
      case 'view': ui.open = ui.open === d.a ? '' : d.a; return rr();
      case 'recv': { const p = packOf(t, d.a); if (recvRoles().indexOf(d.k) < 0) return;
        if (!p || p.status !== 'sent') { toast('กลุ่มสาระนี้ถูกดึงกลับหรือส่งกลับแล้ว — แสดงข้อมูลล่าสุดให้แล้ว'); return rr(); }
        const id = packId(t, d.a) + '_r_' + d.k, rec = { kind: 'recv', term: t, area: d.a, k: d.k, by: S.me.name, at: now, sentAt: p.sentAt }, o = S.loadProps.find(x => x.id === id);
        if (o) Object.assign(o, rec); else S.loadProps.push(Object.assign({ id }, rec));
        purge(t, d.a); saveNow(); toast(RECV[d.k] + 'รับเรื่องแล้ว'); return rr(); }
      case 'return': { const p = packOf(t, d.a); if (!p || p.status !== 'sent') { toast('กลุ่มสาระนี้ถูกดึงกลับหรือส่งกลับแล้ว'); return rr(); }
        const note = prompt('เหตุผลที่ส่งกลับให้ ' + d.a + ' แก้ไข'); if (note === null) return;
        if (p.status !== 'sent') { toast('กลุ่มสาระนี้ถูกดึงกลับหรือส่งกลับแล้ว'); return rr(); }
        Object.assign(p, { status: 'returned', note: note.trim() || 'กรุณาตรวจสอบและแก้ไข' }); if (p.recv) p.recv = {}; saveNow(); toast('ส่งกลับแล้ว'); return rr(); }
      case 'csvAll': { const sel = areas().filter(a => (packOf(t, a) || {}).status === 'sent'); return download('ภาระงานสอน-' + t + '.csv', csv(loadRows(t, sel))); }
      case 'toStudio': { const all = areas(), sel = all.filter(a => (packOf(t, a) || {}).status === 'sent'), miss = all.filter(a => sel.indexOf(a) < 0), rows = loadRows(t, sel);
        if (miss.length && !confirm('ส่งแล้ว ' + sel.length + '/' + all.length + ' กลุ่มสาระ\nยังไม่ส่ง: ' + miss.join(', ') + '\n\nแอปจัดตารางสอนจะแทนคาบสอนทั้งหมดด้วยภาระงานชุดนี้ — ถ้ารับเข้าตอนนี้แล้วรับใหม่ตอนส่งครบ คาบที่จัดไว้จะหาย\nส่งต่อหรือไม่?')) return;
        try { localStorage.setItem('ems-load-to-studio', JSON.stringify({ at: now, term: t, areas: sel, areasMissing: miss, rows: rows })); } catch (er) { return toast('ส่งไม่ได้: พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม'); }
        toast('ส่ง ' + (rows.length - 1) + ' แถวแล้ว — ในแอปจัดตารางกด “รับภาระงานจาก EMS”'); window.open('timetable/index.html', 'ems-timetable'); return; }
    }
  });
  document.addEventListener('change', e => {
    const x = e.target;
    if (x.id === 'lp-term') { if (!canSetTerm() || x.value === openTerm()) return rr();
      if (!confirm('เปิดเสนอภาระงานสอน ' + termLabel(x.value) + ' แทน ' + termLabel(openTerm()) + '?\nทุกคนจะเห็นและเสนอได้เฉพาะภาคนี้')) return rr();
      S.loadTerm = x.value; ui.open = ''; save(); toast('เปิดเสนอ ' + termLabel(x.value) + ' แล้ว'); return rr(); }
    if (x.id === 'lp-area') { ui.area = x.value; return rr(); }
    if (form && x.dataset && x.dataset.lpf) { const k = x.dataset.lpf; form[k] = x.value;
      if (k === 'code') { const s = knownSubjects()[String(x.value).replace(/\s+/g, '')]; if (s && !form.name) form.name = s; const cp = window.EMSCur && EMSCur.per(String(x.value).replace(/\s+/g, '')); if (cp && !form.slot) form.per = cp;      /* ช่องวิชาเลือก: คงคาบตามหลักสูตรของช่อง */ const lv = String(x.value).match(/^\D*(\d)(\d)/); if (lv && +lv[1] === 2 && +lv[2] >= 1) form.level = +lv[2]; else if (lv && +lv[1] === 3 && +lv[2] >= 1) form.level = 3 + +lv[2]; }
      if (k === 'level' || k === 'code') form.rooms = form.rooms.filter(n => levelOfRoom(n) === +form.level);      // เปลี่ยนชั้น (เลือกเองหรือเดาจากรหัส) → ห้องชั้นเดิมไม่ค้าง
      if (k === 'code' || k === 'level') drawForm(curTerm(), ui.area); return; }
    if (form && x.dataset && x.dataset.lpr !== undefined) { const n = x.dataset.lpr; form.rooms = x.checked ? form.rooms.concat([n]) : form.rooms.filter(y => y !== n); const c = x.closest('.field').querySelector('.chip'); if (c) c.textContent = form.rooms.length + ' ห้อง'; }
  });

  /* ---------- เมนู ---------- */
  const N = window.EMSNav;
  if (N) {
    const add = (v, g, item) => { const grp = (N.NAVG[v] || []).find(x => x[0] === g); if (grp && !grp[1].some(x => x[0] === item[0])) grp[1].push(item); };
    add('teacher', 'งานของฉัน', ['loadprop', 'เสนอภาระงานสอน (วก)', 'users']);
    add('admin', 'ฝ่ายงาน', ['a-loadprop', 'ภาระงานสอนที่เสนอ (วก)', 'inbox']);
    /* ซ่อนเมนูฝ่ายรับเรื่องจากผู้ที่ไม่ใช่งานวัดผล/งานจัดตาราง/แอดมิน (เช่น ผู้บริหาร) */
    const hideFor = fn => function () { const grp = (N.NAVG.admin || []).find(x => x[0] === 'ฝ่ายงาน'), i = grp ? grp[1].findIndex(x => x[0] === 'a-loadprop') : -1;
      let it = null; try { if (i >= 0 && !recvRoles().length && !isAdm()) it = grp[1].splice(i, 1)[0]; } catch (e) {}
      try { return fn.apply(this, arguments); } finally { if (it) grp[1].splice(i, 0, it); } };
    if (window.renderChrome) window.renderChrome = hideFor(window.renderChrome);
    if (window.openMore) window.openMore = hideFor(window.openMore);
    (window.EMSNavHidden = window.EMSNavHidden || {})['a-loadprop'] = () => !recvRoles().length && !isAdm();      // ค้นหาเมนู (Ctrl K)
  }
  window.EMSLoadProp = { loadRows, termList, termLabel, openTerm, scope };
})();
