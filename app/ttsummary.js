/* EMS — สรุปรายวิชาใต้ตารางสอนของครู + แจ้งวิชาการเมื่อรหัสวิชา/ชื่อวิชาไม่ตรง
   สรุป: รหัสวิชา · ชื่อวิชา · ชั้น (ไม่บอกเลขห้อง) · คาบ/สัปดาห์ ของครูคนนั้น
   ตรวจ: รหัสเดียวกันในตารางสอนทั้งโรงเรียนมีหลายชื่อ / รหัสไม่มีในหลักสูตร / ชื่อไม่ตรงหลักสูตร (curriculum.js) / ไม่มีชื่อวิชา
   แจ้งวิชาการ: ttFlags/{id} = { term, code, names, reason, teacher, by, byName, at, status: 'open' | 'done', doneBy, doneAt }
     (cloud.js slice ttFlags ฟังเฉพาะภาคปัจจุบัน · rules ใช้กลุ่มคำขอทั่วไป {coll}/{id}) · วิชาการปิดเรื่องที่หน้า "แจ้งแก้รหัส/ชื่อวิชา" */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const top = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${right}</div></div>`;
  const rr = () => { const y = scrollY; render(); scrollTo(0, y); };
  const sortTh = (a, b) => String(a).localeCompare(String(b), 'th', { numeric: true });
  const isLive = () => typeof LIVE !== 'undefined' && !!LIVE;
  const roles = () => [].concat((S.me && S.me.roles) || [], (S.me && S.me.role) || []);
  const bootAdm = () => ((window.EMS_CONFIG || {}).adminEmails || []).map(x => String(x).toLowerCase()).indexOf(String((S.me && S.me.email) || '').toLowerCase()) >= 0;
  const isAcad = () => !isLive() || bootAdm() || roles().some(r => r === 'admin' || r === 'academic');
  const termKey = () => (S.term && S.term.year ? S.term.year + '-' + (S.term.sem || '1') : '');
  const flags = () => (S.ttFlags = Array.isArray(S.ttFlags) ? S.ttFlags : []);
  const uid = () => 'tf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  /** "ว32274 ชีววิทยาเพิ่มเติม 4" → { code, name } */
  const splitSub = s => { const t = norm(s), m = t.match(/^(\S*\d\S*)\s+(.+)$/); return m ? { code: m[1], name: m[2] } : /\d/.test(t) ? { code: t, name: '' } : { code: '', name: t }; };
  const roomName = id => ((S.rooms || []).find(r => r.id === id) || {}).name || ((typeof cls === 'function' && cls(id)) || {}).name || id;
  const lvOf = n => { const m = /ม\.?\s*(\d)/.exec(String(n || '')); return m ? 'ม.' + m[1] : ''; };
  const allEntries = () => (window.EMSExchange ? EMSExchange.allEntries() : []);

  /* ---------- ตรวจความถูกต้องของรหัส/ชื่อวิชา ---------- */
  function schoolNames() { const m = {}; allEntries().forEach(e => { const s = splitSub(e.subject); if (s.code) (m[s.code] = m[s.code] || new Set()).add(s.name); }); return m; }
  function problems(code, name, names) {
    const out = [], cs = ((S.curDocs || {}).subjects || {}).subjects;
    if (!code) return ['ไม่มีรหัสวิชา'];
    const ns = Array.from(names[code] || []).filter(Boolean);
    if (ns.length > 1) out.push('รหัสเดียวกันในตารางสอนมีหลายชื่อ: ' + ns.join(' / '));
    if (!name) out.push('ไม่มีชื่อวิชา');
    if (cs && Object.keys(cs).length) { const c = cs[code]; if (!c) out.push('รหัสนี้ไม่มีในหลักสูตร'); else if (name && norm(c.n) !== norm(name)) out.push('ชื่อในหลักสูตรคือ “' + c.n + '”'); }
    return out;
  }
  const openFlag = code => flags().find(f => f.term === termKey() && f.code === code && f.status !== 'done');

  /** ตารางสรุปใต้ตารางสอน · entries = [{ subject, classId }] ของครูคนนั้น */
  function summaryHTML(entries, teacher) {
    const g = {};
    (entries || []).forEach(e => { const s = splitSub(e.subject), k = s.code || '·' + s.name; const o = g[k] = g[k] || { code: s.code, name: s.name, lv: new Set(), n: 0 };
      if (!o.name && s.name) o.name = s.name; const lv = lvOf(roomName(e.classId)); if (lv) o.lv.add(lv); o.n++; });
    const rows = Object.values(g).sort((a, b) => sortTh(a.code, b.code));
    if (!rows.length) return '';
    const names = schoolNames(); let bad = 0;
    const body = rows.map(o => { const pr = problems(o.code, o.name, names), f = pr.length && openFlag(o.code); if (pr.length) bad++;
      return `<tr><td><b>${esc(o.code || '–')}</b></td><td>${esc(o.name || '–')}</td><td>${Array.from(o.lv).sort(sortTh).map(esc).join(', ') || '–'}</td><td style="text-align:right">${o.n}</td>
        <td>${!pr.length ? chip('ตรง', 'ok') : `<div class="small" style="color:var(--warn,#b7791f)">${pr.map(esc).join('<br>')}</div>
          ${f ? chip('แจ้งวิชาการแล้ว', 'info') : `<button class="btn sm" style="margin-top:4px" data-ttf="flag" data-code="${esc(o.code)}" data-name="${esc(o.name)}" data-reason="${esc(pr.join(' · '))}" data-teacher="${esc(teacher || '')}">แจ้งวิชาการ</button>`}`}</td></tr>`; }).join('');
    return `<div class="card"><h2>วิชาที่สอน ${chip(rows.length + ' วิชา')} ${bad ? chip('ตรวจ ' + bad, 'warn') : ''}</h2>
      <div class="muted small" style="margin-bottom:8px">สรุปจากตารางสอนภาคนี้ · ถ้ารหัสหรือชื่อวิชาไม่ตรง กด “แจ้งวิชาการ” ให้ฝ่ายวิชาการแก้ไข</div>
      <div class="scroll"><table class="tbl"><thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ชั้น</th><th style="text-align:right">คาบ/สัปดาห์</th><th>ตรวจ</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
  }

  /* ---------- หน้า วิชาการ: เรื่องที่ครูแจ้ง ---------- */
  P['a-ttflags'] = () => {
    const title = 'แจ้งแก้รหัส/ชื่อวิชา';
    if (!isAcad()) return top(title, '') + '<div class="card"><div class="empty">หน้านี้สำหรับฝ่ายวิชาการและผู้ดูแลระบบ</div></div>';
    if (isLive() && !(window.EMSCloud && EMSCloud.ready && EMSCloud.ready.ttFlags)) return top(title, '') + '<div class="card"><div class="empty">กำลังโหลด…</div></div>';
    const tk = termKey(), list = flags().filter(f => f.term === tk).sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(b.at).localeCompare(String(a.at)));
    const open = list.filter(f => f.status !== 'done');
    return top(title, `ภาคเรียน ${esc(tk)} · ครูแจ้งจากสรุปวิชาใต้ตารางสอน · แก้ในตารางสอน (นำเข้าใหม่) หรือหลักสูตรแล้วกด “แก้แล้ว”`) +
      `<div class="card">${list.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>รหัสวิชา</th><th>ปัญหา</th><th>ครู / ผู้แจ้ง</th><th>สถานะ</th><th></th></tr></thead><tbody>
        ${list.map(f => `<tr><td><b>${esc(f.code || '–')}</b><div class="small">${esc(f.name || '')}</div></td><td class="small">${esc(f.reason || '')}</td>
          <td class="small">${esc(f.teacher || '')}${f.byName && f.byName !== f.teacher ? `<div class="muted">แจ้งโดย ${esc(f.byName)}</div>` : ''}<div class="muted">${esc(String(f.at || '').slice(0, 10))}</div></td>
          <td>${f.status === 'done' ? chip('แก้แล้ว', 'ok') + `<div class="muted small">${esc(f.doneBy || '')}</div>` : chip('รอแก้', 'warn')}</td>
          <td>${f.status === 'done' ? '' : `<button class="btn sm pri" data-ttf="done" data-id="${esc(f.id)}">แก้แล้ว</button>`}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">ยังไม่มีครูแจ้ง</div>'}<div class="muted small" style="margin-top:8px">รอแก้ ${open.length} เรื่อง</div></div>`;
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ttf]'); if (!b) return; const d = b.dataset;
    if (d.ttf === 'flag') {
      if (openFlag(d.code)) { toast('วิชานี้แจ้งวิชาการไว้แล้ว'); return rr(); }
      flags().push({ id: uid(), term: termKey(), code: d.code, name: d.name, reason: d.reason, teacher: d.teacher, byName: S.me.name, at: new Date().toISOString(), status: 'open' });
      save(); toast('แจ้งฝ่ายวิชาการแล้ว'); return rr();
    }
    if (d.ttf === 'done') { if (!isAcad()) return; const f = flags().find(x => x.id === d.id); if (!f) return;
      f.status = 'done'; f.doneBy = S.me.name; f.doneAt = new Date().toISOString(); save(); toast('ปิดเรื่องแล้ว'); return rr(); }
  });

  /* ---------- เมนู + แจ้งเตือน (วิชาการ) ---------- */
  const N = window.EMSNav;
  if (N) {
    const grp = (N.NAVG.admin || []).find(x => x[0] === 'ฝ่ายงาน'); if (grp && !grp[1].some(x => x[0] === 'a-ttflags')) grp[1].push(['a-ttflags', 'แจ้งแก้รหัส/ชื่อวิชา', 'book']);
    const hideFor = fn => function () { const g = (N.NAVG.admin || []).find(x => x[0] === 'ฝ่ายงาน'), i = g ? g[1].findIndex(x => x[0] === 'a-ttflags') : -1;
      let it = null; try { if (i >= 0 && !isAcad()) it = g[1].splice(i, 1)[0]; } catch (x) {}
      try { return fn.apply(this, arguments); } finally { if (it) g[1].splice(i, 0, it); } };
    if (window.renderChrome) window.renderChrome = hideFor(window.renderChrome);
    if (window.openMore) window.openMore = hideFor(window.openMore);
    (window.EMSNavHidden = window.EMSNavHidden || {})['a-ttflags'] = () => !isAcad();
  }
  /* notify.js โหลดหลังไฟล์นี้ — ลงทะเบียนกระดิ่งเมื่อหน้าโหลดครบ */
  const regNotify = () => window.EMSNotify && EMSNotify.register(() => { if (!isAcad()) return []; const n = flags().filter(f => f.term === termKey() && f.status !== 'done').length;
    return n ? [{ id: 'ttflags', level: 'todo', title: 'ครูแจ้งรหัส/ชื่อวิชาไม่ตรง', sub: n + ' เรื่องรอแก้', n, page: 'a-ttflags', view: 'admin' }] : []; });
  if (window.EMSNotify) regNotify(); else window.addEventListener('load', regNotify, { once: true });

  window.EMSTTSum = { summaryHTML, splitSub };
})();
