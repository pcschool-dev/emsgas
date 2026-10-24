/* EMS — สรุปคะแนนทั้งโรงเรียน (ฝ่ายวัดผล / วิชาการ / ผู้บริหาร)
   โหลดเมื่อเปิดหน้า (lazy.js) · อ่านสมุดคะแนนทุกวิชาของภาคที่กำลังใช้ครั้งเดียวต่อการกด “โหลดข้อมูล” (ไม่ฟังสด เพื่อประหยัดการอ่าน)
   คิดคะแนนด้วยสูตรเดียวกับหน้า ปพ.5 (EMSModules.summaryRows / gradeCounts) · มุมมอง: ภาพรวม / กลุ่มสาระ / รายครู / รายวิชา
   กรองได้ตามกลุ่มสาระ ครู ระดับชั้น · ส่งออก CSV ของตารางที่เห็น
   หมายเหตุ: มส. (เวลาเรียนไม่ถึง 80%) นับได้เฉพาะห้องที่ข้อมูลเช็กชื่อโหลดอยู่ในเครื่อง — ภาพรวมทั้งโรงเรียนนับจากคะแนนเป็นหลัก */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const r1 = v => Math.round(v * 10) / 10;
  const sortTh = (a, b) => String(a || '').localeCompare(String(b || ''), 'th', { numeric: true });
  const AREA_BY_CODE = { 'ท': 'ภาษาไทย', 'ค': 'คณิตศาสตร์', 'ว': 'วิทยาศาสตร์และเทคโนโลยี', 'ส': 'สังคมศึกษา ศาสนาและวัฒนธรรม', 'พ': 'สุขศึกษาและพลศึกษา', 'ศ': 'ศิลปะ', 'ง': 'การงานอาชีพ', 'อ': 'ภาษาต่างประเทศ', 'จ': 'ภาษาต่างประเทศ', 'ญ': 'ภาษาต่างประเทศ', 'ก': 'ภาษาต่างประเทศ', 'I': 'การศึกษาค้นคว้าด้วยตนเอง (IS)' };
  const shortArea = a => /กลุ่มสาระ/.test(a || '') ? String(a).replace(/^กลุ่มสาระการเรียนรู้/, '').trim() : '';      /* กลุ่มอื่น (บริหาร/สนับสนุน) ใช้รหัสวิชาแทน */
  const U = { view: 'overall', area: '', teacher: '', level: '', data: null, loading: false, at: '' };
  const codeOf = subj => String(subj || '').trim().split(/\s+/)[0] || '';
  const sanitize = c => String(c).replace(/[\/.#\[\]]/g, '_');
  const staffOf = n => (S.staff || []).find(u => u.name === n) || {};

  /* ---------- รวบรวมรายวิชา-ห้อง + คิดคะแนน ---------- */
  async function load() {
    U.loading = true; render();
    try {
      const all = LIVE ? (S.__ttAll || []) : (window.EMSExchange ? EMSExchange.allEntries() : []);
      const who = {}; all.forEach(e => { const k = e.classId + '|' + sanitize(codeOf(e.subject)); (who[k] = who[k] || { teachers: new Set(), subject: e.subject }).teachers.add(e.teacher); });
      let books = [];
      if (LIVE && window.EMSCloud && EMSCloud.fetchBooks) books = await EMSCloud.fetchBooks();
      else books = S.classes.filter(c => c.subject && S.books[c.id]).map(c => ({ room: c.id, code: sanitize(codeOf(c.subject)), data: S.books[c.id] }));
      const rosterOf = id => { const r = (S.__rosterView || S.__roster || {})[id]; if (r && r.students) return { id, name: r.name || id, students: r.students }; const c = cls(id); return c ? { id, name: c.name, students: c.students } : { id, name: id, students: [] }; };
      const roomName = id => ((S.rooms || []).find(r => r.id === id) || rosterOf(id)).name || id;
      const rows = [];
      books.forEach(bk => {
        const c = rosterOf(bk.room); if (!c.students.length) return;
        const w = who[bk.room + '|' + bk.code] || {}, teachers = w.teachers ? [...w.teachers] : (bk.by ? [((S.staff || []).find(u => String(u.email || '').toLowerCase() === bk.by) || {}).name || bk.by] : ['ไม่ทราบผู้สอน']);
        const subject = w.subject || bk.code, t0 = teachers[0], area = shortArea(staffOf(t0).dept) || AREA_BY_CODE[String(bk.code).charAt(0)] || 'อื่น ๆ';
        S.books.__sum = JSON.parse(JSON.stringify(bk.data || {}));
        const b = EMSBook.book('__sum'), sr = EMSModules.summaryRows(c, b), gc = EMSModules.gradeCounts(sr); delete S.books.__sum;
        const any = sr.filter(x => x.r.any), done = sr.filter(x => x.r.complete), avg = k => any.length ? r1(any.reduce((a, x) => a + num(x.r[k]), 0) / any.length) : null;
        rows.push({ room: bk.room, roomName: c.name || roomName(bk.room), level: (String(c.name || '').match(/ม\.(\d)/) || [])[1] || '', code: bk.code, subject, teachers, teacher: t0, area,
          n: sr.length, any: any.length, done: done.length, pass: done.filter(x => x.passed && !x.isMS).length,
          aB: avg('wBefore'), aM: avg('wM'), aA: avg('wAfter'), aF: avg('wF'), aT: avg('total'), gc, zero: gc['0'] || 0, r: gc['ร'] || 0, ms: gc['มส'] || 0 });
      });
      /* วิชาในตารางสอนที่ยังไม่มีสมุดคะแนนเลย */
      const have = new Set(rows.map(x => x.room + '|' + x.code));
      Object.keys(who).forEach(k => { if (have.has(k)) return; const [room, code] = k.split('|'), c = rosterOf(room), t0 = [...who[k].teachers][0];
        rows.push({ room, roomName: c.name || room, level: (String(c.name || '').match(/ม\.(\d)/) || [])[1] || '', code, subject: who[k].subject, teachers: [...who[k].teachers], teacher: t0,
          area: shortArea(staffOf(t0).dept) || AREA_BY_CODE[String(code).charAt(0)] || 'อื่น ๆ', n: c.students.length, any: 0, done: 0, pass: 0, aB: null, aM: null, aA: null, aF: null, aT: null, gc: {}, zero: 0, r: 0, ms: 0, none: true }); });
      U.data = rows; U.at = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { toast('โหลดข้อมูลไม่สำเร็จ: ' + (e.code || e.message)); console.warn(e); }
    U.loading = false; render();
  }

  /* ---------- รวมกลุ่ม ---------- */
  const filtered = () => (U.data || []).filter(x => (!U.area || x.area === U.area) && (!U.teacher || x.teachers.indexOf(U.teacher) >= 0) && (!U.level || x.level === U.level));
  function agg(list) {
    const o = { courses: list.length, started: list.filter(x => x.any).length, n: 0, any: 0, done: 0, pass: 0, zero: 0, r: 0, ms: 0, gc: {} }, sums = { aB: [0, 0], aM: [0, 0], aA: [0, 0], aF: [0, 0], aT: [0, 0] };
    list.forEach(x => { o.n += x.n; o.any += x.any; o.done += x.done; o.pass += x.pass; o.zero += x.zero; o.r += x.r; o.ms += x.ms;
      Object.keys(x.gc).forEach(g => { o.gc[g] = (o.gc[g] || 0) + x.gc[g]; });
      Object.keys(sums).forEach(k => { if (x[k] != null && x.any) { sums[k][0] += x[k] * x.any; sums[k][1] += x.any; } }); });
    Object.keys(sums).forEach(k => { o[k] = sums[k][1] ? r1(sums[k][0] / sums[k][1]) : null; });
    o.donePct = o.n ? Math.round(o.done * 100 / o.n) : 0; o.passPct = o.done ? Math.round(o.pass * 100 / o.done) : 0; return o;
  }
  const groupBy = (list, key) => { const m = {}; list.forEach(x => { [].concat(key(x)).forEach(k => { (m[k] = m[k] || []).push(x); }); }); return Object.keys(m).sort(sortTh).map(k => ({ k, list: m[k], a: agg(m[k]) })); };

  /* ---------- หน้าจอ ---------- */
  const v = x => x == null ? '<span class="muted">–</span>' : x;
  const pctBar = p => `<div class="ss-bar"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div><span class="small">${p}%</span>`;
  const HEAD = `<th style="text-align:right">นักเรียน</th><th>กรอกครบ</th><th style="text-align:right">ก่อนกลาง</th><th style="text-align:right">กลางภาค</th><th style="text-align:right">หลังกลาง</th><th style="text-align:right">ปลายภาค</th><th style="text-align:right">รวม</th><th>ผ่าน</th><th style="text-align:right">0</th><th style="text-align:right">ร</th><th style="text-align:right">มส</th>`;
  const cells = a => `<td style="text-align:right">${a.n}</td><td class="ss-p">${pctBar(a.donePct)}</td><td style="text-align:right">${v(a.aB)}</td><td style="text-align:right">${v(a.aM)}</td><td style="text-align:right">${v(a.aA)}</td><td style="text-align:right">${v(a.aF)}</td><td style="text-align:right"><b>${v(a.aT)}</b></td>
    <td>${a.done ? chip(a.passPct + '%', a.passPct >= 80 ? 'ok' : a.passPct >= 60 ? 'warn' : 'bad') : '<span class="muted">–</span>'}</td><td style="text-align:right">${a.zero ? chip(a.zero, 'bad') : 0}</td><td style="text-align:right">${a.r ? chip(a.r, 'warn') : 0}</td><td style="text-align:right">${a.ms ? chip(a.ms, 'bad') : 0}</td>`;
  const GRADES = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส'];
  function gradeDist(a) {
    const tot = GRADES.reduce((s, g) => s + (a.gc[g] || 0), 0) || 1;
    return `<div class="ss-gd">${GRADES.map(g => { const n = a.gc[g] || 0, h = Math.round(n * 100 / tot); return `<div class="ss-g"><div class="ss-gb" title="${g}: ${n} คน"><i style="height:${Math.max(n ? 3 : 0, h)}%" class="${g === '0' || g === 'มส' ? 'bad' : g === 'ร' ? 'warn' : ''}"></i></div><b>${n}</b><span>${g}</span></div>`; }).join('')}</div>`;
  }
  function table(groups, label, onclick) {
    return `<div class="scroll"><table class="tbl ss-t"><thead><tr><th>${label}</th><th style="text-align:right">วิชา-ห้อง</th>${HEAD}</tr></thead><tbody>${groups.map(g => `<tr>${onclick ? `<td><button class="btn sm ghost" data-ss="${onclick}" data-v="${esc(g.k)}">${esc(g.k)}</button></td>` : `<td>${esc(g.k)}</td>`}<td style="text-align:right">${g.a.started}/${g.a.courses}</td>${cells(g.a)}</tr>`).join('')}</tbody></table></div>`;
  }
  let CSV = [];
  function body() {
    const L = filtered(), all = agg(L);
    if (U.view === 'overall') { const g = groupBy(L, x => x.area); CSV = [['กลุ่มสาระ', 'วิชา-ห้อง', 'นักเรียน', 'กรอกครบ%', 'ก่อนกลาง', 'กลางภาค', 'หลังกลาง', 'ปลายภาค', 'รวม', 'ผ่าน%', '0', 'ร', 'มส']].concat(g.map(x => [x.k, x.a.courses, x.a.n, x.a.donePct, x.a.aB, x.a.aM, x.a.aA, x.a.aF, x.a.aT, x.a.passPct, x.a.zero, x.a.r, x.a.ms]));
      return `<div class="grid g4 ss-k"><div class="card kpi"><div class="l">วิชา-ห้องที่เริ่มกรอก</div><div class="v">${all.started}/${all.courses}</div></div>
          <div class="card kpi"><div class="l">กรอกคะแนนครบ</div><div class="v">${all.donePct}%</div><div class="s muted">${all.done}/${all.n} รายการ</div></div>
          <div class="card kpi"><div class="l">คะแนนรวมเฉลี่ย</div><div class="v">${v(all.aT)}</div><div class="s muted">ก่อน ${v(all.aB)} · กลาง ${v(all.aM)} · หลัง ${v(all.aA)} · ปลาย ${v(all.aF)}</div></div>
          <div class="card kpi"><div class="l">ติด 0 / ร / มส</div><div class="v" style="color:var(--bad)">${all.zero} / ${all.r} / ${all.ms}</div><div class="s muted">ผ่าน ${all.passPct}% ของที่กรอกครบ</div></div></div>
        <div class="card"><h2 style="margin:0 0 8px">การกระจายเกรด</h2>${gradeDist(all)}</div>
        <div class="card"><h2 style="margin:0 0 8px">แยกตามกลุ่มสาระ</h2>${table(g, 'กลุ่มสาระ', 'area')}</div>`; }
    if (U.view === 'area') { const g = groupBy(L, x => x.area); CSV = csvOf(g, 'กลุ่มสาระ'); return `<div class="card">${table(g, 'กลุ่มสาระ', 'area')}</div>${U.area ? `<div class="card"><h2 style="margin:0 0 8px">การกระจายเกรด · ${esc(U.area)}</h2>${gradeDist(all)}</div>` : ''}`; }
    if (U.view === 'teacher') { const g = groupBy(L, x => x.teachers); CSV = csvOf(g, 'ครู'); return `<div class="card">${table(g, 'ครูผู้สอน', 'teacher')}</div>`; }
    const list = L.slice().sort((a, b) => sortTh(a.area, b.area) || sortTh(a.teacher, b.teacher) || sortTh(a.code, b.code) || sortTh(a.roomName, b.roomName));
    CSV = [['กลุ่มสาระ', 'ครู', 'รหัสวิชา', 'วิชา', 'ห้อง', 'นักเรียน', 'กรอกครบ', 'ก่อนกลาง', 'กลางภาค', 'หลังกลาง', 'ปลายภาค', 'รวม', 'ผ่าน', '0', 'ร', 'มส']].concat(list.map(x => [x.area, x.teachers.join(' / '), x.code, String(x.subject).replace(/^\S+\s*/, ''), x.roomName, x.n, x.done, x.aB, x.aM, x.aA, x.aF, x.aT, x.pass, x.zero, x.r, x.ms]));
    return `<div class="card"><div class="scroll"><table class="tbl ss-t"><thead><tr><th>วิชา</th><th>ห้อง</th><th>ครู</th>${HEAD}</tr></thead><tbody>${list.map(x => { const a = agg([x]);
      return `<tr><td><b>${esc(x.code)}</b> <span class="small">${esc(String(x.subject).replace(/^\S+\s*/, ''))}</span>${x.none ? ' ' + chip('ยังไม่เปิดสมุด', 'bad') : ''}</td><td>${esc(x.roomName)}</td><td class="small">${esc(x.teachers.join(' / '))}</td>${cells(a)}</tr>`; }).join('')}</tbody></table></div></div>`;
  }
  const csvOf = (g, lab) => [[lab, 'วิชา-ห้อง', 'นักเรียน', 'กรอกครบ%', 'ก่อนกลาง', 'กลางภาค', 'หลังกลาง', 'ปลายภาค', 'รวม', 'ผ่าน%', '0', 'ร', 'มส']].concat(g.map(x => [x.k, x.a.courses, x.a.n, x.a.donePct, x.a.aB, x.a.aM, x.a.aA, x.a.aF, x.a.aT, x.a.passPct, x.a.zero, x.a.r, x.a.ms]));

  P['score-sum'] = () => {
    const D = U.data, areas = D ? [...new Set(D.map(x => x.area))].sort(sortTh) : [], teachers = D ? [...new Set(D.flatMap(x => x.teachers))].filter(t => !U.area || D.some(x => x.area === U.area && x.teachers.indexOf(t) >= 0)).sort(sortTh) : [];
    const V = [['overall', 'ภาพรวมโรงเรียน'], ['area', 'กลุ่มสาระฯ'], ['teacher', 'รายครู'], ['course', 'รายวิชา']];
    return `<div class="top"><div><h1>สรุปคะแนน</h1><p>ภาคเรียนที่ ${esc(S.term.sem)}/${esc(S.term.year)} · คะแนนเฉลี่ยคิดจากนักเรียนที่มีคะแนนแล้ว · ${U.at ? 'โหลดเมื่อ ' + U.at + ' น.' : 'ยังไม่ได้โหลด'}</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ${D ? '' : 'pri'}" data-ss="load" ${U.loading ? 'disabled' : ''}>${ic('down')}${U.loading ? 'กำลังโหลด…' : D ? 'โหลดใหม่' : 'โหลดข้อมูล'}</button>${D ? `<button class="btn" data-ss="csv">${ic('up')}CSV</button>` : ''}</div></div>
      ${D ? `<div class="pills" role="tablist" style="margin-bottom:10px">${V.map(([k, l]) => `<button class="pill" role="tab" aria-pressed="${U.view === k}" data-ss="view" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="ss-f"><select class="in" data-ssf="area" aria-label="กลุ่มสาระ"><option value="">ทุกกลุ่มสาระ</option>${areas.map(a => `<option ${a === U.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
        <select class="in" data-ssf="teacher" aria-label="ครู"><option value="">ครูทุกคน</option>${teachers.map(t => `<option ${t === U.teacher ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <select class="in" data-ssf="level" aria-label="ระดับชั้น"><option value="">ทุกระดับ</option>${[1, 2, 3, 4, 5, 6].map(l => `<option value="${l}" ${String(l) === U.level ? 'selected' : ''}>ม.${l}</option>`).join('')}</select>
        ${U.area || U.teacher || U.level ? '<button class="btn sm ghost" data-ss="clear">ล้างตัวกรอง</button>' : ''}</div>
      ${D.length ? body() : '<div class="card empty">ยังไม่มีสมุดคะแนนของภาคนี้ — ครูต้องมีตารางสอนและเริ่มกรอกคะแนนก่อน</div>'}`
      : `<div class="card empty">${U.loading ? 'กำลังอ่านสมุดคะแนนทุกวิชา…' : 'กด “โหลดข้อมูล” เพื่ออ่านสมุดคะแนนทุกวิชาของภาคนี้ (อ่านครั้งเดียว ไม่ฟังสด)'}</div>`}`;
  };
  document.addEventListener('click', e => { const t = e.target.closest('[data-ss]'); if (!t) return; const a = t.dataset.ss;
    if (a === 'load') return load();
    if (a === 'view') { U.view = t.dataset.v; return render(); }
    if (a === 'area') { U.area = t.dataset.v; U.teacher = ''; U.view = 'teacher'; return render(); }
    if (a === 'teacher') { U.teacher = t.dataset.v; U.view = 'course'; return render(); }
    if (a === 'clear') { U.area = U.teacher = U.level = ''; return render(); }
    if (a === 'csv') { const s = '﻿' + CSV.map(r => r.map(x => { x = x == null ? '' : String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(',')).join('\r\n');
      const u = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })), l = document.createElement('a'); l.href = u; l.download = 'สรุปคะแนน-' + S.term.sem + '-' + S.term.year + '.csv'; document.body.appendChild(l); l.click(); setTimeout(() => { URL.revokeObjectURL(u); l.remove(); }, 800); }
  });
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.ssf; if (!k) return; U[k] = e.target.value; if (k === 'area') U.teacher = ''; render(); });
  const css = document.createElement('style');
  css.textContent = `.ss-f{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.ss-f .in{width:auto;min-width:160px}
.ss-k{margin-bottom:14px}.ss-t td,.ss-t th{white-space:nowrap}.ss-p{min-width:110px}
.ss-bar{display:inline-block;width:60px;height:6px;border-radius:3px;background:var(--surface2);vertical-align:middle;margin-right:6px;overflow:hidden}.ss-bar i{display:block;height:100%;background:var(--ok)}
.ss-gd{display:grid;grid-template-columns:repeat(10,1fr);gap:6px;align-items:end}.ss-g{text-align:center;font-size:.78rem}.ss-g span{display:block;color:var(--muted)}
.ss-gb{height:110px;display:flex;align-items:flex-end;background:var(--surface2);border-radius:6px;overflow:hidden}.ss-gb i{display:block;width:100%;background:var(--brand)}.ss-gb i.bad{background:var(--bad)}.ss-gb i.warn{background:var(--warn)}
@media(max-width:860px){.ss-gb{height:70px}}`;
  document.head.appendChild(css);
})();
