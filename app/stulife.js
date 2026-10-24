/* EMS — หน้าของนักเรียน: พฤติกรรม/ความดี · ชั่วโมงจิตอาสา · แถวเช้าและวันที่ขาด/สาย
   โหมดจริง: ข้อมูลมาจาก EMSStu (cloud.js) — นักเรียนอ่านได้เฉพาะของตัวเองตาม rules (conduct/volunteer where sid ==, stu/{sid})
   โหมดตัวอย่าง: อ่านจาก S.affairs ในเครื่อง
   คะแนนพฤติกรรมคิดสูตรเดียวกับหน้ากิจการนักเรียน (modules2.js conduct()) */
(() => {
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const fmt = (v, d = 1) => { const n = Math.round(num(v) * 10 ** d) / 10 ** d; return String(n); };
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const sk = s => String(s.sid || s.id);
  const live = () => !!(window.EMSStu && EMSStu.on());
  const top = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
  const kpi = (l, v, sub = '', color = '') => `<div class="card kpi"><div class="l">${l}</div><div class="v"${color ? ` style="color:${color}"` : ''}>${v}</div>${sub ? `<div class="s muted">${sub}</div>` : ''}</div>`;
  const ATT = { p: ['มา', 'ok'], s: ['สาย', 'warn'], l: ['ลา', 'info'], c: ['กิจกรรม', 'act'], a: ['ขาด', 'bad'] };

  /* ---------- ข้อมูลของนักเรียนที่เข้าสู่ระบบ ---------- */
  function who() {
    if (live()) { const u = EMSStu.stu(); return { sid: String(u.sid), name: u.name, room: u.room || '', classId: '' }; }
    const c = S.classes.find(x => x.id === (S.student || {}).classId) || S.classes[0] || { students: [] }, s = c.students.find(x => x.id === (S.student || {}).id) || c.students[0] || {};
    return { sid: sk(s), name: s.name || '', room: c.name || '', classId: c.id, id: s.id };
  }
  const cfgOf = () => live() ? EMSStu.x().cfg : (S.affairs || {}).cfg;
  const recsOf = sid => live() ? EMSStu.x().conduct : ((S.affairs || {}).records || []).filter(r => r.sid === sid);
  const volsOf = sid => live() ? EMSStu.x().vol : ((S.affairs || {}).vol || []).filter(v => v.sid === sid);
  function conductOf(sid) {
    const cfg = cfgOf() || { startScore: 100, threshold: 60, lateDeduct: 2, capAtStart: true }, o = { good: 0, bad: 0, late: 0, goodPts: 0, badPts: 0, recs: [] }, seen = {};
    recsOf(sid).filter(r => r && !r.voided && r.type !== 'volunteer').forEach(r => {
      if (r.type === 'late' && r.source !== 'class') { const k = r.date; if (seen[k]) return; seen[k] = 1; }
      o.recs.push(r);
      if (r.type === 'late') { const p = r.points !== undefined && r.points !== '' ? num(r.points) : num(cfg.lateDeduct); o.late++; o.badPts += p; r.__p = -p; }
      else if (r.kind === 'good') { o.good++; o.goodPts += num(r.points); r.__p = num(r.points); }
      else { o.bad++; o.badPts += num(r.points); r.__p = -num(r.points); } });
    let sc = num(cfg.startScore) - o.badPts + o.goodPts; if (cfg.capAtStart) sc = Math.min(sc, num(cfg.startScore));
    return Object.assign(o, { score: sc, cfg });
  }
  const volSum = sid => { const L = volsOf(sid); return { L, h: L.filter(v => v.st === 'ok').reduce((a, v) => a + num(v.hours), 0), pend: L.filter(v => v.st === 'pending').length }; };
  const shown = () => { const c = cfgOf(); return !c || c.stuShow !== false; };
  const scoreColor = (v, cfg) => v < num(cfg.threshold) ? 'var(--bad)' : v < num(cfg.threshold) + 10 ? 'var(--warn)' : 'var(--ok)';
  const errNote = () => live() && EMSStu.x().err ? `<div class="notice">บางส่วนยังเปิดดูไม่ได้ (${esc(EMSStu.x().err)}) — แจ้งครูที่ปรึกษาหรือฝ่ายกิจการนักเรียน</div>` : '';

  /* แถวเช้า: โหมดจริงจาก stu.hr[ภาค] (ครูที่ปรึกษาส่ง) · โหมดตัวอย่างคิดจาก S.att ของห้อง */
  function hrOf() {
    if (live()) { const u = EMSStu.stu(); return ((u.hr || {})[EMSStu.term()]) || null; }
    const w = who(), o = { p: 0, s: 0, l: 0, c: 0, a: 0, n: 0, x: [] };
    Object.keys(S.att || {}).forEach(k => { const [c, dt, p] = k.split('|'); if (c !== w.classId || p !== 'hr') return; const v = (S.att[k] || {})[w.id]; if (!v || o[v] === undefined) return; o[v]++; o.n++; if ('sla'.includes(v)) o.x.push([dt, 'hr', v]); });
    o.x.sort((a, b) => String(b[0]).localeCompare(a[0])); return o.n ? o : null;
  }
  const pct = a => a && a.n ? Math.round((a.p + a.s + a.c) * 100 / a.n) : null;

  /* ---------- หน้าหลัก: เพิ่มการ์ดพฤติกรรม/จิตอาสา/แถวเช้า ---------- */
  const baseHome = P['s-home'];
  P['s-home'] = () => {
    const w = who(), cd = conductOf(w.sid), v = volSum(w.sid), hr = hrOf(), hp = pct(hr);
    const cards = `<div class="grid g3" style="margin-top:14px">
      ${shown() ? kpi('คะแนนพฤติกรรม', fmt(cd.score, 0), `เริ่มต้น ${fmt(cd.cfg.startScore, 0)} · ความดี ${cd.good} ครั้ง`, scoreColor(cd.score, cd.cfg)) : kpi('คะแนนพฤติกรรม', '–', 'ยังไม่เปิดให้ดู')}
      ${kpi('ชั่วโมงจิตอาสา', fmt(v.h) + ' ชม.', v.pend ? `รอตรวจ ${v.pend} รายการ` : 'อนุมัติแล้ว')}
      ${kpi('เข้าแถวตอนเช้า', hp == null ? '–' : hp + '%', hr ? `สาย ${hr.s} · ขาด ${hr.a} · ลา ${hr.l}` : 'ครูที่ปรึกษายังไม่ได้เช็ก', hp == null ? '' : hp >= 80 ? 'var(--ok)' : 'var(--bad)')}</div>
      <div class="card" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="go" data-p="s-conduct">พฤติกรรม / ความดี</button><button class="btn" data-act="go" data-p="s-vol">จิตอาสา</button><button class="btn" data-act="go" data-p="s-att">เวลาเรียน</button></div>`;
    const h = baseHome();
    const i = h.indexOf('<div class="card" style="margin-top:14px"><button class="btn pri" data-act="go" data-p="s-scores">');
    return (i > 0 ? h.slice(0, i) : h) + cards + (i > 0 ? h.slice(i).replace(' <button class="btn" data-act="go" data-p="s-att">ดูเวลาเรียน</button>', '') : '');
  };

  /* ---------- เวลาเรียน: เพิ่มแถวเช้า + วันที่ขาด/สาย/ลาล่าสุด ---------- */
  const baseAtt = P['s-att'];
  P['s-att'] = () => {
    const hr = hrOf(), hp = pct(hr);
    const subj = live() ? Object.values(((EMSStu.stu().terms || {})[EMSStu.term()]) || {}) : [];
    const recent = [].concat(hr ? hr.x.map(x => [x[0], 'เข้าแถวตอนเช้า', x[2]]) : [], ...subj.filter(s => s.att && s.att.x).map(s => s.att.x.map(x => [x[0], `${s.code} ${s.name} · คาบ ${num(x[1]) + 1}`, x[2]])))
      .sort((a, b) => String(b[0]).localeCompare(a[0])).slice(0, 20);
    const hrCard = `<div class="card"><h2>เข้าแถวตอนเช้า</h2>${hr ? `<div class="grid g4" style="margin-top:6px">${['p', 's', 'l', 'a'].map(k => `<div><div class="muted small">${ATT[k][0]}</div><div style="font-size:1.4rem;font-weight:700">${hr[k] + (k === 'p' ? hr.c : 0)}</div></div>`).join('')}</div>
      <div class="muted small" style="margin-top:6px">มาเข้าแถว ${chip(hp + '%', hp >= 80 ? 'ok' : 'bad')} จาก ${hr.n} วันที่ครูที่ปรึกษาเช็กชื่อ</div>` : '<p class="muted small">ครูที่ปรึกษายังไม่ได้ส่งข้อมูลการเข้าแถว</p>'}</div>`;
    const recentCard = live() ? `<div class="card"><h2>วันที่สาย / ลา / ขาด ล่าสุด</h2>${recent.length ? `<div class="list">${recent.map(([d, what, st]) => `<div class="row"><div class="grow"><div class="t">${thDate(d)}</div><div class="muted small">${esc(what)}</div></div>${chip(ATT[st][0], ATT[st][1])}</div>`).join('')}</div>` : '<p class="muted small">ไม่มี — มาเรียนครบทุกคาบที่ครูเช็กชื่อ</p>'}</div>` : '';
    const h = baseAtt(), cut = h.indexOf('</div></div>') + 12;      // หลังหัวเรื่อง
    return cut > 12 ? h.slice(0, cut) + hrCard + h.slice(cut) + recentCard : h + hrCard + recentCard;
  };

  /* ---------- พฤติกรรม / ความดี ---------- */
  P['s-conduct'] = () => {
    const w = who(), head = top('พฤติกรรมและความดี', `${esc(w.name)} · ${esc(w.room)} · คะแนนนับรายปีการศึกษา`, live() ? `<button class="btn sm" data-sl="refresh">โหลดใหม่</button>` : '');
    if (!shown()) return head + '<div class="card"><div class="empty">ฝ่ายกิจการนักเรียนยังไม่เปิดให้ดูคะแนนพฤติกรรม</div></div>';
    const cd = conductOf(w.sid), cfg = cd.cfg, list = cd.recs.slice().sort((a, b) => String(b.date).localeCompare(a.date) || String(b.time || '').localeCompare(a.time || ''));
    return head + errNote() + `<div class="grid g4">${kpi('คะแนนพฤติกรรม', fmt(cd.score, 0), `เริ่มต้น ${fmt(cfg.startScore, 0)} · เกณฑ์ ${fmt(cfg.threshold, 0)}`, scoreColor(cd.score, cfg))}
      ${kpi('ความดี', cd.good + ' ครั้ง', '+' + fmt(cd.goodPts) + ' คะแนน', 'var(--ok)')}${kpi('ผิดระเบียบ', cd.bad + ' ครั้ง', '', cd.bad ? 'var(--bad)' : '')}${kpi('มาสาย', cd.late + ' ครั้ง', '', cd.late ? 'var(--warn)' : '')}</div>
      ${cd.score < num(cfg.threshold) ? `<div class="notice bad" style="margin-top:14px">คะแนนต่ำกว่าเกณฑ์ ${fmt(cfg.threshold, 0)} — ติดต่อครูที่ปรึกษาเพื่อทำกิจกรรมเพิ่มคะแนน</div>` : ''}
      <div class="card" style="margin-top:14px"><h2>รายการทั้งหมด ${list.length}</h2>${list.length ? `<div class="list">${list.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.type === 'late' ? (r.title || 'มาสาย') : r.title)}</div>
        <div class="muted small">${thDate(r.date)}${r.time ? ' · ' + esc(r.time) + ' น.' : ''}${r.note ? ' · ' + esc(r.note) : ''}</div></div>${chip((r.__p > 0 ? '+' : '−') + fmt(Math.abs(r.__p)), r.__p > 0 ? 'ok' : 'bad')}</div>`).join('')}</div>` : '<div class="empty">ยังไม่มีรายการ — รักษาคะแนนไว้ได้ดีมาก</div>'}</div>`;
  };

  /* ---------- จิตอาสา ---------- */
  const ST = { ok: ['อนุมัติแล้ว', 'ok'], pending: ['รอตรวจ', 'warn'], no: ['ไม่อนุมัติ', 'bad'] };
  P['s-vol'] = () => {
    const w = who(), v = volSum(w.sid), list = v.L.slice().sort((a, b) => String(b.date).localeCompare(a.date));
    return top('ชั่วโมงจิตอาสา', `${esc(w.name)} · ${esc(w.room)} · นับเฉพาะรายการที่ครูอนุมัติแล้ว`, live() ? `<button class="btn sm" data-sl="refresh">โหลดใหม่</button>` : '') + errNote() +
      `<div class="grid g3">${kpi('ชั่วโมงสะสม', fmt(v.h) + ' ชม.', '', 'var(--ok)')}${kpi('รอตรวจ', v.pend + ' รายการ')}${kpi('ทั้งหมด', list.length + ' รายการ')}</div>
      <div class="card" style="margin-top:14px"><h2>ส่งคำขอบันทึกชั่วโมง</h2><p class="muted small" style="margin-bottom:8px">ครูที่ปรึกษาหรือฝ่ายกิจการนักเรียนจะตรวจและอนุมัติ</p>
        <div class="field"><label class="f" for="sv-t">กิจกรรม</label><input id="sv-t" class="in" maxlength="120" placeholder="เช่น ช่วยงานห้องสมุด"></div>
        <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:10px"><div class="field"><label class="f" for="sv-d">วันที่</label><input id="sv-d" class="in" type="date" value="${todayISO()}" max="${todayISO()}"></div>
          <div class="field"><label class="f" for="sv-h">ชั่วโมง</label><input id="sv-h" class="in" inputmode="decimal" placeholder="เช่น 2"></div></div>
        <div class="field"><label class="f" for="sv-n">รายละเอียด / ผู้รับรอง</label><input id="sv-n" class="in" maxlength="200" placeholder="เช่น ครูผู้ดูแล สถานที่"></div>
        <button class="btn pri" style="width:100%" data-sl="send">ส่งคำขอ</button></div>
      <div class="card" style="margin-top:14px"><h2>รายการของฉัน</h2>${list.length ? `<div class="list">${list.map(x => `<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="t">${esc(x.title)} · ${fmt(x.hours)} ชม.</div>
        <div class="muted small">${thDate(x.date)}${x.src === 'student' ? ' · ส่งคำขอเอง' : x.by ? ' · บันทึกโดย ' + esc(x.by) : ''}${x.note ? ' · ' + esc(x.note) : ''}</div></div>${chip(...(ST[x.st] || ST.ok))}
        ${x.st === 'pending' ? `<button class="btn sm ghost" style="color:var(--bad)" data-sl="cancel" data-id="${esc(x._doc || x.id)}">ยกเลิก</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">ยังไม่มีชั่วโมงจิตอาสา</div>'}</div>`;
  };

  let busy = false;
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-sl]'); if (!t || busy) return; const a = t.dataset.sl;
    if (a === 'refresh') { busy = true; try { await EMSStu.refresh(); toast('อัปเดตแล้ว'); } finally { busy = false; } return; }
    if (a === 'send') {
      const title = $('#sv-t').value.trim(), date = $('#sv-d').value, hours = num($('#sv-h').value), note = $('#sv-n').value.trim();
      if (!title) return toast('กรุณาใส่ชื่อกิจกรรม'); if (!date || date > todayISO()) return toast('กรุณาเลือกวันที่ (ไม่เกินวันนี้)');
      if (!(hours > 0) || hours > 24) return toast('จำนวนชั่วโมงต้องมากกว่า 0 และไม่เกิน 24');
      const r = { title, date, hours, note };
      busy = true; t.disabled = true;
      try {
        if (live()) await EMSStu.submitVol(r);
        else { const w = who(); S.affairs.vol.push(Object.assign({ id: 'vo_' + Date.now().toString(36), sid: w.sid, name: w.name, className: w.room, st: 'pending', src: 'student', by: w.name, at: new Date().toISOString() }, r)); save(); }
        toast('ส่งคำขอแล้ว รอครูตรวจ'); render();
      } catch (x) { toast('ส่งไม่สำเร็จ (' + (x.code || x.message) + ')'); t.disabled = false; } finally { busy = false; }
      return;
    }
    if (a === 'cancel') {
      busy = true;
      try { if (live()) await EMSStu.cancelVol(t.dataset.id); else { S.affairs.vol = S.affairs.vol.filter(x => x.id !== t.dataset.id); save(); } toast('ยกเลิกคำขอแล้ว'); render(); }
      catch (x) { toast('ยกเลิกไม่สำเร็จ (' + (x.code || x.message) + ')'); } finally { busy = false; }
    }
  });
})();
