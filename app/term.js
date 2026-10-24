/* EMS — ดูภาคเรียนเก่า + ซ่อมคะแนนภาคที่ผ่านมา
   - S.viewTerm (เก็บในหน้าจอเท่านั้น ไม่บันทึก) = ภาคที่ครู “กำลังดู” — cloud.js โหลดตารางสอน/สมุดคะแนน/เช็กชื่อของภาคนั้นมาแทน
     ไม่เปลี่ยนภาคเรียนของโรงเรียน (S.term) ซึ่งแอดมินเป็นผู้กำหนด
   - ภาคที่แอดมินปิดแล้ว (ปิดทันที หรืออัตโนมัติหลังวันปิดภาค): ดูได้อย่างเดียว — หน้าจอล็อก และ cloud.js คืนค่าถ้ามีการแก้
   - ยกเว้นคะแนนซ่อม: หน้า “ซ่อมคะแนนภาคที่ผ่านมา” (เปิดจากหน้าภาพรวมครู) กรอกและบันทึกได้ เฉพาะนักเรียนที่ต้องซ่อม */
(() => {
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const has = v => v !== undefined && v !== null && v !== '';
  const same = (a, b) => !!a && !!b && String(a.year) === String(b.year) && String(a.sem) === String(b.sem);
  const cur = () => S.viewTerm && !same(S.viewTerm, S.term) ? S.viewTerm : S.term;
  const label = t => 'ภาคเรียนที่ ' + esc(t.sem) + '/' + esc(t.year);
  const lockedOf = t => window.EMSAdmin && EMSAdmin.termLocked ? EMSAdmin.termLocked((S.terms || []).find(x => same(x, t))) : false;
  const terms = () => (S.terms || []).slice().sort((a, b) => (String(b.year) + b.sem).localeCompare(String(a.year) + a.sem));
  const pastLocked = () => terms().filter(t => !same(t, S.term) && lockedOf(t));
  function setView(t) { S.viewTerm = t && !same(t, S.term) ? { year: String(t.year), sem: String(t.sem) } : null; closeModal(); render(); scrollTo(0, 0); }
  const picker = (id, act) => `<select class="in" id="${id}" data-tm="${act}" style="width:auto;min-width:200px" aria-label="เลือกภาคเรียน">${terms().map(t => `<option value="${esc(t.year)}|${esc(t.sem)}" ${same(t, cur()) ? 'selected' : ''}>${label(t)}${same(t, S.term) ? ' (ปัจจุบัน)' : lockedOf(t) ? ' (ปิดแล้ว)' : ''}</option>`).join('')}</select>`;

  /* ---------- แถบบอกว่ากำลังดูภาคอื่น ---------- */
  const TEACH = ['home', 'scores', 'items', 'groups', 'indicators', 'assess', 'summary', 'attendance', 'schedule', 'retake', 'course'];
  function banner() {
    if (!S.viewTerm || same(S.viewTerm, S.term) || TEACH.indexOf(page) < 0) return;
    const v = document.getElementById('view'); if (!v || v.querySelector('.tm-bar')) return;
    v.insertAdjacentHTML('afterbegin', `<div class="notice tm-bar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><div class="grow">กำลังดู <b>${label(S.viewTerm)}</b>${lockedOf(S.viewTerm) ? ' · ปิดแล้ว ดูได้อย่างเดียว (ซ่อมคะแนนได้ที่หน้าซ่อม)' : ''}${S.__rosterMissing ? ` · <b>ไม่มีรายชื่อนักเรียนปี ${esc(S.__rosterMissing)} ในระบบ</b>` : ''}</div>
      ${page !== 'retake' && lockedOf(S.viewTerm) ? '<button class="btn sm" data-act="go" data-p="retake">ซ่อมคะแนน</button>' : ''}<button class="btn sm pri" data-tm="back">กลับภาคปัจจุบัน</button></div>`);
  }

  /* ---------- หน้าภาพรวมครู: การ์ดภาคเรียนที่ผ่านมา ---------- */
  const baseHome = P.home;
  if (baseHome) P.home = () => { const h = baseHome(); if (terms().length < 2) return h; const pl = pastLocked();
    return h + `<div class="card" style="margin-top:14px"><h2 style="margin:0 0 6px">ภาคเรียนที่ผ่านมา</h2>
      <div class="muted small" style="margin-bottom:10px">เปิดดูคะแนน การเช็กชื่อ และตารางสอนของภาคก่อนได้ · ภาคที่ปิดแล้วแก้ไม่ได้ ยกเว้นคะแนนซ่อม</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${picker('tm-home', 'pick')}
        ${pl.length ? `<button class="btn pri" data-tm="retake">${ic('score')}ซ่อมคะแนนภาคที่ผ่านมา</button>` : ''}</div></div>`; };

  /* ---------- หน้าซ่อมคะแนนภาคที่ผ่านมา ---------- */
  const fmt = v => has(v) ? Math.round(num(v) * 10) / 10 : '–';
  P.retake = () => {
    const pl = pastLocked(), t = cur();
    const head = `<div class="top"><div><h1>ซ่อมคะแนนภาคที่ผ่านมา</h1><p>แสดงเฉพาะนักเรียนที่ต้องซ่อม · ภาคที่ปิดแล้วบันทึกได้เฉพาะคะแนนซ่อม</p></div><div>${picker('tm-rt', 'pick')}</div></div>`;
    if (!pl.length && !lockedOf(t)) return head + '<div class="card empty">ยังไม่มีภาคเรียนที่ปิดแล้ว</div>';
    if (same(t, S.term) && !lockedOf(t)) return head + `<div class="card empty">เลือกภาคเรียนที่ผ่านมาจากช่องด้านบน${pl[0] ? `<br><button class="btn pri" style="margin-top:10px" data-tm="to" data-v="${esc(pl[0].year)}|${esc(pl[0].sem)}">เปิด${label(pl[0])}</button>` : ''}</div>`;
    const B = window.EMSBook, out = [];
    S.classes.filter(c => c.subject && S.books[c.id]).forEach(c => {
      const b = B.book(c.id), rtOn = !!b.exams.retakeEnabled, rows = [];
      c.students.slice().sort((a, z) => (a.no || 0) - (z.no || 0)).forEach(st => { const r = B.calcRow(b, st);
        const units = b.items.filter(it => r.unitFailed && r.unitFailed[it.id]);
        const cfs = b.items.flatMap(it => B.examComps(it).filter(c => r.compFail && r.compFail[B.compRtKey(it, c)]).map(c => ({ it, c })));      // ช่องสอบที่ตก = ซ่อมรายช่อง
        if (!units.length && !cfs.length && !(rtOn && r.midFailed)) return;
        const box = (val, attrs, max) => { const list = B.rtList(val), shown = list.length ? list : [''];
          return `<span class="tm-rt">${shown.map((v, i) => `<input class="in" inputmode="decimal" ${attrs} data-i="${i}" value="${has(v) ? esc(v) : ''}" placeholder="ซ่อม${shown.length > 1 ? ' ' + (i + 1) : ''}" title="ซ่อมครั้งที่ ${i + 1} (เต็ม ${max})">`).join('')}<button class="btn sm" ${attrs.replace('data-rt=', 'data-rta=')} title="เพิ่มการซ่อมอีกครั้ง">+</button><span class="muted small">/${max}</span></span>`; };
        const cells = units.map(it => `<div class="tm-u"><span class="small"><b>${esc(it.name)}</b> ได้ ${fmt((b.scores[st.id] || {})[it.id])}</span>${box(((b.itemRetakes || {})[st.id] || {})[it.id], `data-rt="it" data-c="${esc(c.id)}" data-s="${esc(st.id)}" data-it="${esc(it.id)}"`, B.retakeMax(it))}</div>`)
          .concat(cfs.map(({ it, c: x }) => `<div class="tm-u"><span class="small"><b>${esc(it.name)} · ${esc(B.subName(x, b))}</b> ได้ ${fmt((((b.componentScores || {})[st.id] || {})[it.id] || {})[x.key])}</span>${box(((b.itemRetakes || {})[st.id] || {})[B.compRtKey(it, x)], `data-rt="it" data-c="${esc(c.id)}" data-s="${esc(st.id)}" data-it="${esc(it.id)}" data-ck="${esc(x.key)}"`, num(x.rawMax))}</div>`))
          .concat(rtOn && r.midFailed ? [`<div class="tm-u"><span class="small"><b>กลางภาค</b> ได้ ${fmt(((b.exam || {})[st.id] || {}).mid)}</span>${box(((b.exam || {})[st.id] || {}).retake, `data-rt="mid" data-c="${esc(c.id)}" data-s="${esc(st.id)}"`, num(b.exams.midMax))}</div>`] : []);
        rows.push(`<tr><td>${st.no || ''}</td><td>${esc(st.name)}<div class="muted small">${esc(st.sid || st.id)}</div></td><td>${cells.join('')}</td><td style="text-align:right"><b>${r.any ? fmt(r.total) : '–'}</b></td><td>${r.any ? chip(esc(r.grade), r.passed ? 'ok' : 'bad') : '–'}</td></tr>`); });
      out.push(`<div class="card"><h2 style="margin:0 0 8px">${esc(c.name)} · ${esc(c.subject)} ${rows.length ? chip(rows.length + ' คน', 'warn') : chip('ไม่มีคนต้องซ่อม', 'ok')}</h2>
        ${rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th><th>ส่วนที่ต้องซ่อม</th><th style="text-align:right">รวม</th><th>เกรด</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : ''}</div>`);
    });
    return head + (out.length ? out.join('') : `<div class="card empty">ยังไม่พบสมุดคะแนนของ${label(t)} — ${S.classes.some(c => c.subject) ? 'กำลังโหลด…' : 'ไม่มีวิชาที่สอนในภาคนี้'}</div>`);
  };

  /* ---------- บันทึกคะแนนซ่อม ---------- */
  function setRetake(d, value, addNew) {
    const B = window.EMSBook, b = S.books[d.c]; if (!b) return;
    const it = d.rt === 'it' ? b.items.find(x => x.id === d.it) : null, cmp = it && d.ck ? B.comps(it).find(x => x.key === d.ck) : null;      // d.ck = ซ่อมรายช่อง (หน่วย~ช่อง) เขียนเฉพาะ itemRetakes
    if (d.ck && !cmp) return; const max = cmp ? num(cmp.rawMax) : it ? B.retakeMax(it) : num(b.exams.midMax);
    let v = String(value == null ? '' : value).trim(); if (v !== '') { v = Math.max(0, Math.min(max, num(v))); if (num(value) > max) toast('เกินคะแนนเต็ม ' + max + ' — ปรับเป็น ' + max); v = String(v); }
    const host = d.rt === 'it' ? ((b.itemRetakes = b.itemRetakes || {})[d.s] = b.itemRetakes[d.s] || {}) : ((b.exam = b.exam || {})[d.s] = b.exam[d.s] || {}), key = d.rt === 'it' ? (cmp ? B.compRtKey(it, cmp) : d.it) : 'retake';
    if (addNew) { const a = B.rtList(host[key]); if (!a.length || !has(a[a.length - 1])) return toast('กรอกคะแนนซ่อมครั้งนี้ก่อน แล้วค่อยเพิ่มครั้งถัดไป'); host[key] = a.concat(['']); return render(); }
    B.rtSet(host, key, num(d.i) || 0, v); save(); render();
  }
  document.addEventListener('change', e => { const t = e.target;
    if (t.dataset && t.dataset.tm === 'pick') { const [y, s] = t.value.split('|'); return setView({ year: y, sem: s }); }
    if (t.dataset && t.dataset.rt) return setRetake(t.dataset, t.value); });
  document.addEventListener('click', e => { const t = e.target.closest('[data-tm],[data-rta]'); if (!t) return;
    if (t.dataset.rta) return setRetake(Object.assign({}, t.dataset, { rt: t.dataset.rta }), '', true);
    if (t.dataset.tm === 'back') return setView(null);
    if (t.dataset.tm === 'to') { const [y, s] = t.dataset.v.split('|'); return setView({ year: y, sem: s }); }
    if (t.dataset.tm === 'retake') { const pl = pastLocked(); if (!S.viewTerm && pl[0]) S.viewTerm = { year: String(pl[0].year), sem: String(pl[0].sem) }; return go('retake'); } });
  const baseRender = window.render;
  window.render = function () { const r = baseRender.apply(this, arguments); banner(); return r; };
  const css = document.createElement('style');
  css.textContent = `.tm-u{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:3px 0}.tm-rt{display:inline-flex;gap:3px;align-items:center}.tm-rt .in{width:58px;min-height:34px;padding:2px 6px}.tm-rt .btn{min-height:34px}`;
  document.head.appendChild(css);
  window.EMSTerm = { setView, cur };
})();
