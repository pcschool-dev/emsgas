/* EMS — ฝ่ายวัดผลนำเข้าคะแนนสอบกลางภาค/ปลายภาคให้ครูทุกคน
   - ไฟล์เดียวทั้งโรงเรียนได้: คอลัมน์ รหัสวิชา · เลขประจำตัว · คะแนน (หรือเลือกรหัสวิชาก่อน แล้ววางแค่ เลขประจำตัว · คะแนน)
   - วางจาก Excel ตรง ๆ ก็ได้ หรือเลือกไฟล์ .xlsx/.csv
   - ตรวจก่อนบันทึก: ไม่พบนักเรียน คะแนนเกินเต็ม ไม่ใช่ตัวเลข ช่องที่ครูกรอกไว้แล้วต่างจากไฟล์
   - บันทึกแล้วช่องนั้นในสมุดคะแนนของครูถูกล็อก (แก้ได้ที่ฝ่ายวัดผล) และย้อนกลับการนำเข้าได้ทั้งชุด
   ระบบจริง: เขียน 1 เอกสารต่อรายวิชาต่อการสอบ ที่ examScores/{ภาค}_{รหัสวิชา}_{mid|final} → เครื่องครูอ่านเอกสารนั้นมารวมกับสมุดคะแนน
   (ต้นแบบนี้มีสมุดคะแนนเฉพาะของครูในเครื่องนี้ ห้องของครูท่านอื่นจะแจ้งว่า “ส่งให้ครูเจ้าของวิชาเมื่อเชื่อมระบบ”) */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : NaN; };
const fmt = v => { const s = Number(v).toFixed(2); return s.replace(/\.?0+$/, ''); };
const uid = p => p + '_' + Math.random().toString(36).slice(2, 9);
const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
const code = s => String(s || '').trim().split(/\s+/)[0].toUpperCase();
const keyOf = s => String(s.sid || s.id || '');
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const KN = { mid: 'กลางภาค', final: 'ปลายภาค' };
S.examImports = S.examImports || [];
S.eim = Object.assign({ kind: 'mid', code: '', max: '', mode: 'fill', text: '' }, S.eim || {});
let DRAFT = null;
const B = () => window.EMSBook;
const allCodes = () => [...new Set(((window.EMSDepts && EMSDepts.courses()) || []).map(c => code(c.subject)).concat(S.classes.map(c => code(c.subject))))].filter(Boolean).sort();
const myRoomsOf = cd => S.classes.filter(c => code(c.subject) === cd);
const otherRoomsOf = cd => ((window.EMSDepts && EMSDepts.courses()) || []).filter(c => code(c.subject) === cd && !c.mine);

/* ---------- อ่านข้อมูล ---------- */
function csvRows(text) {
  text = String(text || '').replace(/^﻿/, '');
  return text.split(/\r?\n/).filter(l => l.trim()).map(l => (l.indexOf('\t') >= 0 ? l.split('\t') : l.split(',')).map(x => x.replace(/^"|"$/g, '').trim()));
}
async function fileRows(f) {
  if (/\.xlsx?$/i.test(f.name)) {
    if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).map(r => r.map(v => String(v).trim())).filter(r => r.some(Boolean));
  }
  return csvRows(await f.text());
}
const isCode = v => /^[ก-ฮA-Za-z]{1,2}\d{4,5}$/.test(String(v || '').trim());
function readRows(rows) {
  const low = r => r.map(x => String(x).replace(/\s/g, '').toLowerCase());
  const hi = rows.findIndex(r => low(r).some(x => /เลขประจำตัว|รหัสนักเรียน|studentid|^id$/.test(x)));
  let ci = { code: -1, sid: 0, score: 1, name: -1 }, body = rows;
  if (hi >= 0) { const h = low(rows[hi]), f = re => h.findIndex(x => re.test(x));
    ci = { code: f(/รหัสวิชา|วิชา|subject|code/), sid: f(/เลขประจำตัว|รหัสนักเรียน|studentid|^id$/), score: f(/คะแนน|score|mark/), name: f(/ชื่อ|name/) }; body = rows.slice(hi + 1); }
  else if (rows[0] && rows[0].length >= 3 && isCode(rows[0][0])) ci = { code: 0, sid: 1, score: 2, name: -1 };
  return body.map((r, i) => ({ line: (hi >= 0 ? hi + 2 : 1) + i, fileCode: ci.code >= 0 ? code(r[ci.code]) : '', sid: String(r[ci.sid] || '').replace(/\D/g, ''), raw: String(r[ci.score] == null ? '' : r[ci.score]).trim(), name: ci.name >= 0 ? r[ci.name] : '' }))
    .filter(x => x.sid || x.raw);
}

/* ---------- ตรวจก่อนบันทึก ---------- */
function check(items) {
  const kind = S.eim.kind, out = [], perCode = {};
  items.forEach(x => {
    const cd = x.fileCode || code(S.eim.code); const row = { line: x.line, fileCode: x.fileCode, sid: x.sid, raw: x.raw, name: x.name, code: cd };
    const g = perCode[cd] = perCode[cd] || { code: cd, rows: [], mine: myRoomsOf(cd), others: otherRoomsOf(cd) };
    const max = num(S.eim.max) || (g.mine[0] ? num(B().book(g.mine[0].id).exams[kind + 'Max']) : NaN);
    const v = num(x.raw.replace(/,/g, ''));
    let found = null; g.mine.forEach(c => { const s = c.students.find(s => keyOf(s) === x.sid); if (s) found = { c, s }; });
    if (!cd) row.st = 'nocode';
    else if (!x.sid) row.st = 'nosid';
    else if (x.raw === '' || !isFinite(v) || v < 0) row.st = 'bad';
    else if (isFinite(max) && max > 0 && v > max) row.st = 'over';
    else if (!found) row.st = g.others.length ? 'other' : 'notfound';
    else { const prev = ((B().book(found.c.id).exam || {})[found.s.id] || {})[kind];
      row.c = found.c; row.s = found.s; row.v = v; row.prev = prev;
      row.st = prev === undefined || prev === '' || prev === null ? 'new' : num(prev) === v ? 'same' : 'diff'; }
    row.max = max; g.rows.push(row); out.push(row);
  });
  return { rows: out, groups: Object.values(perCode).sort((a, b) => a.code.localeCompare(b.code)) };
}
const ST = { new: ['ลงคะแนนใหม่', 'ok'], diff: ['ต่างจากที่ครูกรอก', 'warn'], same: ['ตรงกับที่มีอยู่', ''], over: ['เกินคะแนนเต็ม', 'bad'], bad: ['ไม่ใช่ตัวเลข', 'bad'],
  notfound: ['ไม่พบนักเรียนในรายวิชานี้', 'bad'], other: ['ห้องของครูท่านอื่น', 'info'], nocode: ['ไม่ระบุรหัสวิชา', 'bad'], nosid: ['ไม่มีเลขประจำตัว', 'bad'] };
const willWrite = r => r.st === 'new' || (r.st === 'diff' && S.eim.mode === 'replace');

/* ---------- บันทึก / ย้อนกลับ ---------- */
function apply() {
  if (!DRAFT) return;
  const kind = S.eim.kind, imp = { id: uid('ei'), ref: 'EX-' + String(Date.now()).slice(-5), kind, term: S.term.year + '/' + S.term.sem, at: new Date().toISOString(), by: S.me.name,
    mode: S.eim.mode, codes: DRAFT.groups.map(g => g.code), changes: [], books: {}, others: 0, skipped: 0 };
  DRAFT.rows.forEach(r => {
    if (r.st === 'other') { imp.others++; return; }
    if (!willWrite(r)) { if (r.st !== 'same') imp.skipped++; return; }
    const b = B().book(r.c.id);
    if (!imp.books[r.c.id]) imp.books[r.c.id] = { max: b.exams[kind + 'Max'], src: b.examSrc && b.examSrc[kind] ? JSON.parse(JSON.stringify(b.examSrc[kind])) : null };
    if (isFinite(r.max) && r.max > 0 && num(b.exams[kind + 'Max']) !== r.max) b.exams[kind + 'Max'] = r.max;
    const ex = (b.exam[r.s.id] = b.exam[r.s.id] || {}); imp.changes.push({ cid: r.c.id, sid: r.s.id, prev: ex[kind] });
    ex[kind] = r.v;
    b.examSrc = b.examSrc || {}; const src = b.examSrc[kind] = b.examSrc[kind] || { sids: [] };
    Object.assign(src, { at: imp.at, by: imp.by, ref: imp.ref }); if (src.sids.indexOf(r.s.id) < 0) src.sids.push(r.s.id);
  });
  S.examImports.unshift(imp); DRAFT = null; save();
  toast(`นำเข้าคะแนน${KN[kind]} ${imp.changes.length} คนแล้ว` + (imp.others ? ` · ห้องของครูท่านอื่น ${imp.others} คน (ส่งให้เมื่อเชื่อมระบบ)` : '')); redraw();
}
function undo(id) {
  const imp = S.examImports.find(x => x.id === id); if (!imp || imp.undone) return;
  imp.changes.slice().reverse().forEach(ch => { const b = B().book(ch.cid), ex = (b.exam[ch.sid] = b.exam[ch.sid] || {});
    if (ch.prev === undefined) delete ex[imp.kind]; else ex[imp.kind] = ch.prev; });
  Object.entries(imp.books).forEach(([cid, o]) => { const b = B().book(cid); b.exams[imp.kind + 'Max'] = o.max; b.examSrc = b.examSrc || {}; if (o.src) b.examSrc[imp.kind] = o.src; else delete b.examSrc[imp.kind]; });
  imp.undone = new Date().toISOString(); save(); toast('ย้อนกลับการนำเข้า ' + imp.ref + ' แล้ว'); redraw();
}

/* ---------- หน้า ---------- */
function page() {
  const E = S.eim, codes = allCodes();
  const preview = DRAFT ? (() => { const n = k => DRAFT.rows.filter(r => r.st === k).length, w = DRAFT.rows.filter(willWrite).length;
    return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">ตรวจก่อนบันทึก · คะแนน${KN[E.kind]}</h2><div class="muted small">${DRAFT.rows.length} แถว · ${DRAFT.groups.length} รายวิชา</div></div>
        <button class="btn" data-ei="cancel">ยกเลิก</button><button class="btn pri" data-ei="apply" ${w ? '' : 'disabled'}>${ic('check')}บันทึกลงสมุดคะแนน ${w} คน</button></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${Object.keys(ST).filter(k => n(k)).map(k => chip(ST[k][0] + ' ' + n(k), ST[k][1])).join('')}</div>
      ${n('diff') ? `<div class="notice">${n('diff')} คนครูกรอกไว้แล้วแต่ไม่ตรงกับไฟล์ — ตอนนี้ตั้งเป็น <b>${E.mode === 'replace' ? 'แทนที่ด้วยคะแนนจากไฟล์' : 'เก็บของครูไว้ (เติมเฉพาะช่องว่าง)'}</b> เปลี่ยนได้ด้านบน</div>` : ''}
      <div class="scroll"><table class="tbl"><thead><tr><th>รหัสวิชา</th><th>ห้องในเครื่องนี้</th><th>ห้องของครูท่านอื่น</th><th>จะลง</th><th>ต่างจากครู</th><th>มีปัญหา</th><th>เต็ม</th></tr></thead><tbody>
      ${DRAFT.groups.map(g => { const c = k => g.rows.filter(r => r.st === k).length; return `<tr><td><b>${esc(g.code || '—')}</b></td><td class="small">${g.mine.map(c => esc(c.name)).join(', ') || '—'}</td><td class="small">${g.others.map(c => esc(c.className) + ' (' + esc(c.teacher) + ')').join(', ') || '—'}</td>
        <td>${g.rows.filter(willWrite).length}</td><td>${c('diff')}</td><td style="color:${c('over') + c('bad') + c('notfound') + c('nocode') + c('nosid') ? 'var(--bad)' : 'inherit'}">${c('over') + c('bad') + c('notfound') + c('nocode') + c('nosid')}</td><td>${isFinite(g.rows[0] && g.rows[0].max) ? fmt(g.rows[0].max) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
      ${DRAFT.rows.some(r => r.st !== 'new' && r.st !== 'same') ? `<details style="margin-top:10px"><summary class="small" style="cursor:pointer">ดูรายการที่ต้องตรวจ (${DRAFT.rows.filter(r => r.st !== 'new' && r.st !== 'same').length})</summary>
        <div class="scroll" style="max-height:320px;margin-top:6px"><table class="tbl"><thead><tr><th>แถว</th><th>รหัสวิชา</th><th>เลขประจำตัว</th><th>นักเรียน</th><th>คะแนนในไฟล์</th><th>ที่ครูกรอก</th><th>ผล</th></tr></thead><tbody>
        ${DRAFT.rows.filter(r => r.st !== 'new' && r.st !== 'same').slice(0, 300).map(r => `<tr><td>${r.line}</td><td>${esc(r.code)}</td><td>${esc(r.sid)}</td><td>${r.s ? esc(r.s.name) + ' <span class="muted small">' + esc(r.c.name) + '</span>' : esc(r.name || '')}</td><td>${esc(r.raw)}</td><td>${r.prev !== undefined && r.prev !== '' ? esc(r.prev) : '–'}</td><td>${chip(ST[r.st][0], ST[r.st][1])}</td></tr>`).join('')}</tbody></table></div></details>` : ''}</div>`; })() : '';
  return `<div class="card"><h2>นำเข้าคะแนนสอบให้ครูทุกคน</h2>
      <p class="muted small" style="margin:-6px 0 12px">ใช้เมื่อฝ่ายวัดผลตรวจข้อสอบรวม (เช่น ตรวจด้วยเครื่อง) — นำเข้าครั้งเดียวลงสมุดคะแนนของทุกห้องที่เรียนรหัสวิชานั้น ช่องที่นำเข้าจะล็อกในหน้าครู ย้อนกลับได้</p>
      <div class="grid g4"><div class="field"><span class="f">การสอบ</span><div class="seg" role="group" aria-label="การสอบ">${Object.entries(KN).map(([k, l]) => `<button data-ei="kind" data-k="${k}" aria-pressed="${E.kind === k}">${l}</button>`).join('')}</div></div>
        <div class="field"><label class="f" for="ei-c">รหัสวิชา</label><select id="ei-c" class="in" data-eif="code"><option value="">ใช้คอลัมน์ “รหัสวิชา” ในไฟล์</option>${codes.map(c => `<option ${c === code(E.code) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label class="f" for="ei-m">คะแนนเต็ม</label><input id="ei-m" class="in" inputmode="decimal" value="${esc(E.max)}" placeholder="ใช้ค่าเดิมของแต่ละวิชา" data-eif="max"></div>
        <div class="field"><span class="f">ถ้าครูกรอกไว้แล้ว</span><div class="seg" role="group" aria-label="ถ้าครูกรอกไว้แล้ว"><button data-ei="mode" data-k="fill" aria-pressed="${E.mode === 'fill'}">เก็บของครู</button><button data-ei="mode" data-k="replace" aria-pressed="${E.mode === 'replace'}">แทนที่</button></div></div></div>
      <div class="field"><label class="f" for="ei-t">วางจาก Excel <span class="muted small">— ${E.code ? 'เลขประจำตัว ⇥ คะแนน' : 'รหัสวิชา ⇥ เลขประจำตัว ⇥ คะแนน'} (มีแถวหัวตารางหรือไม่ก็ได้)</span></label>
        <textarea id="ei-t" class="in" rows="5" placeholder="${E.code ? '12345\t18\n12346\t15' : 'ว21101\t12345\t18\nว21101\t12346\t15'}" data-eif="text" style="font-family:ui-monospace,monospace">${esc(E.text)}</textarea></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-ei="checkText">${ic('check')}ตรวจข้อมูลที่วาง</button><button class="btn" data-ei="pick">${ic('up')}เลือกไฟล์ .xlsx / .csv</button><button class="btn ghost" data-ei="tpl">${ic('down')}แม่แบบ</button></div></div>
    ${preview}
    <div class="card"><h2>ประวัติการนำเข้า</h2>${S.examImports.length ? `<div class="list">${S.examImports.slice(0, 30).map(x => `<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="t">${x.ref} · คะแนน${KN[x.kind]} · ${x.codes.map(esc).join(', ')}</div>
      <div class="muted small">${thDate(new Date(x.at).toLocaleDateString('sv-SE'))} ${new Date(x.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. · ${esc(x.by)} · ลงคะแนน ${x.changes.length} คน${x.others ? ' · ห้องครูท่านอื่น ' + x.others : ''}${x.skipped ? ' · ข้าม ' + x.skipped : ''}${x.undone ? ' · <b>ย้อนกลับแล้ว</b>' : ''}</div></div>
      ${x.undone ? chip('ย้อนกลับแล้ว') : `<button class="btn sm" data-ei="undo" data-id="${x.id}">ย้อนกลับ</button>`}</div>`).join('')}</div>` : '<div class="empty">ยังไม่เคยนำเข้า</div>'}</div>`;
}
const base = P['a-measure'];
P['a-measure'] = () => {
  const mine = S.dui && S.dui.ms === 'examimp';
  if (mine) S.dui.ms = 'scores';
  let h = base();
  if (mine) S.dui.ms = 'examimp';
  h = h.replace(/(<div class="pills" role="tablist"[^>]*>)([\s\S]*?)(<\/div>)/, (m, a, inner, c) =>
    a + (mine ? inner.replace(/aria-pressed="true"/g, 'aria-pressed="false"') : inner) + `<button class="pill" role="tab" aria-pressed="${mine}" data-dp="view" data-key="ms" data-k="examimp">นำเข้าคะแนนสอบ</button>` + c);
  if (!mine) return h;
  const cut = h.indexOf('</div>', h.indexOf('role="tablist"')) + 6;
  return h.slice(0, cut) + page();
};

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-ei]'); if (!t || t.disabled) return;
  const d = t.dataset;
  switch (d.ei) {
    case 'kind': S.eim.kind = d.k; DRAFT = DRAFT && check(DRAFT.rows); save(); return redraw();
    case 'mode': S.eim.mode = d.k; save(); return redraw();
    case 'checkText': { const rows = readRows(csvRows(($('#ei-t') || {}).value || S.eim.text)); if (!rows.length) return toast('ยังไม่มีข้อมูล — วางจาก Excel ก่อน');
      DRAFT = check(rows); return redraw(); }
    case 'pick': { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv,.txt';
      i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const rows = readRows(await fileRows(f)); if (!rows.length) return toast('ไม่พบข้อมูลคะแนนในไฟล์'); DRAFT = check(rows); redraw(); } catch (er) { toast('อ่านไฟล์ไม่สำเร็จ'); } };
      return i.click(); }
    case 'tpl': { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿รหัสวิชา,เลขประจำตัว,ชื่อ-สกุล,คะแนน\nว21101,12345,ตัวอย่าง นักเรียน,18\n'], { type: 'text/csv;charset=utf-8' })); a.download = 'แม่แบบคะแนนสอบ_EMS.csv'; a.click(); return; }
    case 'cancel': DRAFT = null; return redraw();
    case 'apply': return apply();
    case 'undo': return undo(d.id);
  }
});
document.addEventListener('change', e => { const t = e.target, k = t.dataset.eif; if (!k) return; S.eim[k] = t.value; save(); if (k !== 'text') { if (DRAFT) DRAFT = check(DRAFT.rows); redraw(); } });
window.EMSExamImport = { readRows, check };
})();
