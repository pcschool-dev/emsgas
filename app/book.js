/* EMS — สมุดคะแนน: หัวข้อคะแนน · กรอกคะแนน · คะแนนกลุ่ม · ตัวชี้วัด/ผลการเรียนรู้
   ย้ายแบบจำลองข้อมูลและสูตรคำนวณจาก KruSpace (app/index.html: defaultBook, calcRow,
   renderItems, renderGroups, renderIndicators) มาไว้ที่นี่ ใช้ข้อมูลโครงสร้างเดียวกัน
   จึงนำเข้า/ส่งออกกับ KruSpace ได้ภายหลัง
   โหลดหลัง features.js เพื่อทับหน้า scores และ indicators แบบย่อเดิม */
(() => {
/* ---------- ตัวช่วย ---------- */
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const has = v => v !== undefined && v !== null && v !== '' && !Number.isNaN(v);
const rnd = x => Math.round(x + 1e-9);
const fmt = (x, d) => { if (!isFinite(x)) return '–'; const s = Number(x).toFixed(d === undefined ? 2 : d); return (s.indexOf('.') < 0 ? s : s.replace(/\.?0+$/, '')) || '0'; };      // ไม่มีทศนิยม (d = 0) ห้ามตัดศูนย์ท้าย — 100 ต้องไม่กลายเป็น 1
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const roundBy = (v, mode) => { const n = Number(v); if (!isFinite(n)) return 0; return mode === 'int' ? Math.round(n + 1e-9) : mode === 'one' ? Math.round(n * 10 + 1e-9) / 10 : Math.round(n * 2 + 1e-9) / 2; };
const KSA = [{ key: 'K', label: 'K · ความรู้' }, { key: 'S', label: 'S · ทักษะ' }, { key: 'A', label: 'A · เจตคติ' }];
const KINDS = { individual: 'รายบุคคล', group: 'กลุ่ม', unit: 'สอบ (มีช่องซ่อม)' };      // unit = สอบวัดผลรายหน่วย: มีคอลัมน์ซ่อม ซ่อมได้หลายครั้ง
const IKIND = { F: 'กลางทาง', S: 'ปลายทาง' };

/* ---------- แบบจำลองสมุดคะแนน ---------- */
const defaultBook = () => ({
  items: [], exams: { midMax: 40, retakeEnabled: true, finalMax: 40 },
  weights: { before: 30, after: 30, mid: 20, final: 20 }, passPercent: 60,
  gradeScale: [[80, '4'], [75, '3.5'], [70, '3'], [65, '2.5'], [60, '2'], [55, '1.5'], [50, '1'], [0, '0']],
  indicators: [], scores: {}, componentScores: {}, itemRetakes: {}, exam: {}, groupSets: [], gscores: {}, presenters: {}, partialMode: false
});
function seedBook(c, ci) {
  const b = defaultBook(), st = c.students;
  const gs = { id: uid('gs'), name: 'กลุ่มโครงงาน', groups: [] };
  for (let g = 0; g < 3; g++) gs.groups.push({ id: uid('g'), name: 'กลุ่มที่ ' + (g + 1), members: st.slice(g * 4, g * 4 + 4).map(s => s.no) });
  b.groupSets = [gs];
  const mk = (name, max, o) => Object.assign({ id: uid('it'), name, max, kind: 'individual', groupSetId: '', components: [], scoreSection: 'before' }, o || {});
  const i1 = mk('งาน 1 ใบงาน', 10, { work: 'ใบงาน' });
  const i2 = mk('สอบย่อยหน่วย 1', 10, { kind: 'unit', rawMax: 20, retakeMax: 20, work: 'สอบ' });
  const i3 = mk('การทดลอง', 10, { work: 'การทดลอง', components: [{ key: 'K', label: 'K · ความรู้', rawMax: 10, max: 4 }, { key: 'S', label: 'S · ทักษะ', rawMax: 10, max: 4 }, { key: 'A', label: 'A · เจตคติ', rawMax: 5, max: 2 }] });
  const i4 = mk('โครงงานกลุ่ม', 20, { kind: 'group', groupSetId: gs.id, scoreSection: 'after', work: 'โครงงาน' });
  const i5 = mk('สมุดบันทึก', 10, { scoreSection: 'after' });
  b.items = [i1, i2, i3, i4, i5];
  b.gscores[i4.id] = {}; gs.groups.forEach((g, i) => { b.gscores[i4.id][g.id] = [17, 19, 14][i]; });
  st.forEach((s, i) => {
    const sc = b.scores[s.id] = {};
    sc[i1.id] = 5 + (i * 3) % 6;
    sc[i2.id] = 8 + (i * 7) % 13;
    if (sc[i2.id] < 12 && i % 2 === 0) (b.itemRetakes[s.id] = b.itemRetakes[s.id] || {})[i2.id] = 12 + i % 6;
    if (ci === 0) return;                       // ม.1/3 กรอกยังไม่ครบ ไว้ให้เห็นสถานะ "ค้าง"
    const comp = { K: 5 + (i * 3) % 6, S: 4 + (i * 5) % 7, A: 1 + (i * 2) % 5 };
    (b.componentScores[s.id] = {})[i3.id] = comp;
    sc[i3.id] = comp.K * 4 / 10 + comp.S * 4 / 10 + comp.A * 2 / 5;
    const g = gs.groups.find(x => x.members.indexOf(s.no) >= 0);
    if (g) sc[i4.id] = b.gscores[i4.id][g.id];
    sc[i5.id] = 6 + (i * 5) % 5;
    const mid = 14 + (i * 5) % 25;
    b.exam[s.id] = { mid, final: 18 + (i * 11) % 22 };
    if (mid < 24 && i % 2 === 0) b.exam[s.id].retake = 24 + i % 10;
  });
  return b;
}
S.books = S.books || {};
S.classes.forEach((c, ci) => { if (!S.books[c.id]) S.books[c.id] = seedBook(c, ci); });
const book = cid => {
  const b = S.books[cid] = S.books[cid] || defaultBook(), d = defaultBook();
  for (const k in d) if (b[k] === undefined) b[k] = d[k];
  b.weights = Object.assign({}, d.weights, b.weights);
  /* หัวข้อคะแนนแต่ละหน่วยมี "สัดส่วน" เป็นเปอร์เซ็นต์จาก 100 — ก่อนกลาง/หลังกลางจึงเท่ากับผลรวมของหน่วยในช่วงนั้นเสมอ
     (หน่วยทั้งหมด + กลางภาค + ปลายภาค = 100) */
  let wb = 0, wa = 0;
  b.items.forEach(it => { if (it.scoreSection === 'after') wa += num(it.max); else wb += num(it.max); });
  b.weights.before = Math.round(wb * 100) / 100; b.weights.after = Math.round(wa * 100) / 100;
  return b;
};
/* ช่องคะแนนย่อยของหน่วย: ครูกำหนดคะแนนเต็มของแต่ละช่องเอง ระบบแปลงเป็นสัดส่วนของหน่วย (it.max %) ให้ */
const rescaleComps = it => {
  const cs = (it.components || []).filter(c => c && num(c.rawMax) > 0), sum = cs.reduce((a, c) => a + num(c.rawMax), 0), tot = num(it.max);
  cs.forEach(c => { c.max = sum > 0 ? Math.round(tot * num(c.rawMax) / sum * 10000) / 10000 : 0; });
};
/* ช่องที่ผูกตัวชี้วัด: ชื่อคิดจากรหัสตัวชี้วัดปัจจุบันตอนแสดง (ส่ง b มาด้วย) · ครูตั้งชื่อเองผ่าน ✎ (c.custom) = ใช้ชื่อที่ตั้ง */
const subName = (c, b) => { const x = b && c.ind && !c.custom && indOf(b, c.ind); return x ? indLabel(x) + ' ' + (c.ksa || 'รวม') : c.label || (KSA.find(k => k.key === c.key) || {}).label || c.key; };
function resyncUnit(b, it) {                      // คำนวณคะแนนรวมของหน่วยที่มีช่องย่อยใหม่ให้ทุกคน
  Object.keys(b.scores).concat(Object.keys(b.componentScores || {})).forEach(sid => {
    if (!comps(it).length) return;
    const total = itemValue(b, sid, it); b.scores[sid] = b.scores[sid] || {};
    if (total === '') delete b.scores[sid][it.id]; else b.scores[sid][it.id] = total;
  });
}

/* ---------- สูตรคำนวณ (ตรงกับ KruSpace) ---------- */
const comps = it => Array.isArray(it && it.components) ? it.components.filter(c => c && c.key && num(c.rawMax) > 0 && num(c.max) >= 0) : [];
const section = it => it && it.scoreSection === 'after' ? 'after' : 'before';
const entryMax = it => { if (comps(it).length) return num(it.max); const r = num(it && it.rawMax); return r > 0 ? r : num(it && it.max); };
const retakeMax = it => { const r = num(it && it.retakeMax); return r > 0 ? r : entryMax(it); };
/* ซ่อมได้หลายครั้ง: เก็บเป็น [ครั้งที่ 1, ครั้งที่ 2, …] คิดผลด้วยคะแนนที่สูงสุดระหว่างครั้งแรกกับทุกครั้งที่ซ่อม (ข้อมูลเดิมที่เป็นค่าเดียวยังอ่านได้) */
const rtList = v => Array.isArray(v) ? v : (has(v) ? [v] : []);
const rtLast = v => { const a = rtList(v); for (let i = a.length - 1; i >= 0; i--) if (has(a[i])) return a[i]; return undefined; };
const rtBest = v => { let m; rtList(v).forEach(x => { if (has(x) && (m === undefined || num(x) > num(m))) m = x; }); return m; };   // เทียบเป็นตัวเลข
const rtSet = (obj, key, i, v) => { const a = rtList(obj[key]).slice(); a[i] = v; while (a.length && !has(a[a.length - 1])) a.pop();
  for (let k = 0; k < a.length; k++) if (a[k] === undefined) a[k] = ''; if (a.length) obj[key] = a; else delete obj[key]; };
const itemComplete = (b, sid, it) => {
  const cs = comps(it); if (!cs.length) return has((b.scores[sid] || {})[it.id]);
  const v = ((b.componentScores || {})[sid] || {})[it.id] || {};
  return cs.every(c => has(v[c.key]));
};
/* โครงคะแนนตามตัวชี้วัด: ช่องย่อยผูกตัวชี้วัดได้ (c.ind) แยก K/S/A (c.ksa · '' = คะแนนรวมของตัวชี้วัด) และเป็นสอบหรือใบงาน (c.exam)
   ช่องสอบที่ได้ต่ำกว่าเกณฑ์ซ่อมได้รายช่อง เก็บใน itemRetakes[sid][หน่วย~ช่อง] (ภาคปิดแล้วยังกรอกซ่อมได้) ใช้คะแนนที่สูงกว่า
   หน่วยที่มีช่องสอบ = ซ่อมรายช่องแทนซ่อมทั้งหน่วย */
const examComps = it => comps(it).filter(c => c.exam);
const compRtKey = (it, c) => it.id + '~' + c.key;
const compRaw = (b, sid, it, c) => ((((b.componentScores || {})[sid] || {})[it.id]) || {})[c.key];
const compFailed = (b, sid, it, c) => { const v = compRaw(b, sid, it, c); return !!c.exam && has(v) && num(c.rawMax) > 0 && num(v) * 100 / num(c.rawMax) < num(b.passPercent); };
const compVal = (b, sid, it, c) => { const v = compRaw(b, sid, it, c); if (!compFailed(b, sid, it, c)) return v;
  const best = rtBest(((b.itemRetakes || {})[sid] || {})[compRtKey(it, c)]); return has(best) && num(best) > num(v) ? best : v; };
const itemValue = (b, sid, it) => {
  const cs = comps(it); if (!cs.length) return (b.scores[sid] || {})[it.id];
  const v = ((b.componentScores || {})[sid] || {})[it.id] || {};
  if (!cs.some(c => has(v[c.key]))) return '';
  return cs.reduce((a, c) => a + (has(v[c.key]) ? num(compVal(b, sid, it, c)) * num(c.max) / num(c.rawMax) : 0), 0);
};
const secMax = (b, sec) => b.items.filter(it => section(it) === sec).reduce((a, it) => a + num(it.max), 0);
function calcRow(b, st) {
  const sid = st.id, partial = !!b.partialMode, passPct = num(b.passPercent);
  const rt = (b.itemRetakes || {})[sid] || {};
  const stats = { before: { raw: 0, max: 0, filled: 0 }, after: { raw: 0, max: 0, filled: 0 } };
  const unitFailed = {}, compFail = {};
  for (const it of b.items) {
    const original = itemValue(b, sid, it), g = itemComplete(b, sid, it), em = entryMax(it), ex = examComps(it);
    ex.forEach(c => { compFail[compRtKey(it, c)] = compFailed(b, sid, it, c); });
    const failed = it.kind === 'unit' && !ex.length && g && em > 0 && num(original) * 100 / em < passPct;
    unitFailed[it.id] = failed;
    const best = rtBest(rt[it.id]), rm = retakeMax(it);      // ซ่อมได้น้อยกว่าครั้งแรก = ใช้ครั้งแรก (เทียบเป็นสัดส่วนเพราะเต็มอาจไม่เท่ากัน)
    const useRt = failed && has(best) && rm > 0 && num(best) / rm > num(original) / em;
    const v = useRt ? rtBest(rt[it.id]) : original, denom = useRt ? retakeMax(it) : em, s = stats[section(it)];
    if (g) { s.raw += denom > 0 ? num(v) * num(it.max) / denom : 0; s.filled++; }
    if (!partial || g) s.max += num(it.max);
  }
  const ex = b.exam[sid] || {}, midMax = num(b.exams.midMax), finMax = num(b.exams.finalMax);
  const midFailed = has(ex.mid) && midMax > 0 && num(ex.mid) * 100 / midMax < passPct;
  const exRt = rtBest(ex.retake);
  const retakeUsed = !!b.exams.retakeEnabled && midFailed && has(exRt) && num(exRt) > num(ex.mid);      // ซ่อมได้น้อยกว่า = ใช้คะแนนเดิม
  const midRaw = retakeUsed ? num(exRt) : num(ex.mid), finRaw = num(ex.final), W = b.weights;
  const parts = [
    { raw: stats.before.raw, max: stats.before.max, w: num(W.before), active: stats.before.max > 0 && (!partial || stats.before.filled > 0) },
    { raw: midRaw, max: midMax, w: num(W.mid), active: midMax > 0 && (!partial || has(ex.mid) || has(exRt)) },
    { raw: stats.after.raw, max: stats.after.max, w: num(W.after), active: stats.after.max > 0 && (!partial || stats.after.filled > 0) },
    { raw: finRaw, max: finMax, w: num(W.final), active: finMax > 0 && (!partial || has(ex.final)) }
  ];
  const exact = parts.map(p => p.max > 0 ? p.raw * p.w / p.max : 0), wv = exact.map(v => roundBy(v, b.sgsRoundMode || 'half'));
  let sum = 0, actW = 0; parts.forEach((p, i) => { if (p.active) { sum += exact[i]; actW += p.w; } });
  const total = rnd(actW > 0 ? sum * 100 / actW : 0);
  let grade = '–'; for (const g of b.gradeScale) if (total >= num(g[0])) { grade = g[1]; break; }
  const complete = (b.items.length > 0 || midMax > 0 || finMax > 0) && b.items.every(it => itemComplete(b, sid, it)) && (midMax <= 0 || has(ex.mid)) && (finMax <= 0 || has(ex.final));
  const filled = stats.before.filled + stats.after.filled;
  const pf = (p, on) => (on && p.max > 0) ? p.raw * 100 / p.max >= passPct : null;   // null = ยังไม่มีข้อมูลส่วนนี้
  const passBefore = pf(parts[0], stats.before.filled > 0), passM = pf(parts[1], has(ex.mid) || has(exRt)),
        passAfter = pf(parts[2], stats.after.filled > 0), passF = pf(parts[3], has(ex.final));
  return { exact, filledBefore: stats.before.filled, filledAfter: stats.after.filled, passBefore, passM, passAfter, passF, unitFailed, compFail, midFailed, retakeUsed, wBefore: wv[0], wM: wv[1], wAfter: wv[2], wF: wv[3], total, grade, complete,
    any: filled > 0 || has(ex.mid) || has(ex.final), passed: grade !== '0' && grade !== '–' };
}
window.EMSBook = { book, calcRow, rtList, rtLast, rtBest, rtSet, retakeMax, entryMax, rescaleComps, resyncUnit, comps, examComps, compRtKey, subName, itemValue };

/* ---------- สถานะหน้าจอ ---------- */
/** ห้องที่กรอกคะแนนได้ = มีวิชาจากตารางสอน · ห้องที่ปรึกษาที่ไม่มีคาบสอนของตัวเองไม่ต้องมีสมุดคะแนน */
const tCls = () => S.classes.filter(c => c.subject && c.subject !== 'ห้องที่ปรึกษา');
let curId = (tCls()[0] || {}).id;
const cur = () => { const L = tCls(), c = L.find(c => c.id === curId) || L[0]; if (c) curId = c.id; return c; };      // ถอยไปห้องแรก → ซิงก์ curId ด้วย (ห้องจริงมาถึงหลังโหลดสคริปต์)
const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
const isMobile = () => !!(window.matchMedia && matchMedia('(max-width: 640px)').matches);
/** ตัวเลือกหน่วยสำหรับกรอกทีละหน่วยบนมือถือ: [รหัส, ชื่อ, ส่วน] ตามลำดับก่อนกลาง → กลางภาค → หลังกลาง → ปลายภาค */
const unitOpts = (b, hasMid, hasFin) => {
  const its = sec2 => b.items.filter(it => section(it) === sec2).flatMap(it => { const cs = comps(it);
    return cs.length ? cs.map(x => [it.id + '::' + x.key, (it.name || 'หน่วย') + ' › ' + subName(x, b), sec2])
      .concat(it.kind === 'unit' && !examComps(it).length ? [[it.id + '::__rt', (it.name || 'หน่วย') + ' › ซ่อม', sec2]] : []) : [[it.id, it.name || 'หน่วย', sec2]]; });   // หัวข้อสอบที่แบ่งช่องย่อย: มีตัวเลือก "› ซ่อม" (รวมหน่วย + ช่องซ่อม)
  return its('before').concat(hasMid ? [['mid', 'สอบกลางภาค', 'mid']] : [], its('after'), hasFin ? [['final', 'สอบปลายภาค', 'final']] : []);
};
const unitBar = (b, hasMid, hasFin) => { const o = unitOpts(b, hasMid, hasFin); if (!isMobile() || S.bkView === 'sum' || !o.length) return '';
  const cur = o.some(x => x[0] === S.bkUnit) ? S.bkUnit : o[0][0], i = o.findIndex(x => x[0] === cur), SL = { before: 'ก่อนกลางภาค', mid: 'กลางภาค', after: 'หลังกลางภาค', final: 'ปลายภาค' };
  return `<div class="sc-unit"><button class="btn sm" data-bku="-1" ${i <= 0 ? 'disabled' : ''} aria-label="หน่วยก่อนหน้า">‹</button>
    <select class="in" data-bkusel aria-label="เลือกหน่วยที่จะกรอก">${o.map(x => `<option value="${esc(x[0])}" ${x[0] === cur ? 'selected' : ''}>${esc(x[1])} · ${SL[x[2]]}</option>`).join('')}</select>
    <button class="btn sm" data-bku="1" ${i >= o.length - 1 ? 'disabled' : ''} aria-label="หน่วยถัดไป">›</button><span class="muted small">${i + 1}/${o.length}</span></div>`; };
const head2 = (h, p, right = '') => `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
const clsPills = () => `<div class="pills" role="group" aria-label="เลือกห้อง">${tCls().map(c => `<button class="pill" aria-pressed="${c.id === cur().id}" data-bk="cls" data-k="${c.id}">${esc(c.name)}</button>`).join('')}</div>` +
  `<div class="muted small" style="margin:-6px 0 14px">${esc(cur().subject)}</div>`;
const confirmBox = (title, msg, ok) => new Promise(res => {
  modal(`<h2 style="margin-bottom:8px">${title}</h2><p style="margin-bottom:16px">${msg}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-bkc="0">ยกเลิก</button><button class="btn pri" data-bkc="1">${ok}</button></div>`, true);
  const L = $('#layer'), h = e => { const t = e.target.closest('[data-bkc]'); if (!t) return; L.removeEventListener('click', h, true); closeModal(); res(t.dataset.bkc === '1'); };
  L.addEventListener('click', h, true);
});
const wide = () => { const s = $('#layer .sheet'); if (s) s.style.maxWidth = '780px'; };
const noRoom = (what) => `<div class="card empty">ยังไม่มี${what}<br><span class="small">เริ่มจากเมนู “หัวข้อคะแนน”</span></div>`;

const style = document.createElement('style');
style.textContent = `
.bk-bar{display:flex;height:34px;border-radius:10px;overflow:hidden;font-size:.82rem;font-weight:600;color:#fff;margin:6px 0 10px}
.bk-bar div{display:grid;place-items:center;white-space:nowrap;overflow:hidden;padding:0 6px;min-width:0}
.bk-chip{display:inline-grid;place-items:center;min-width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-weight:600;cursor:pointer;padding:0 4px}
.bk-chip.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.bk-chip.taken{opacity:.4}
.bk-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.bk-grp{border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-top:12px;background:var(--surface2)}
.bk-grp .gh{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sc-tbl th,.sc-tbl td{white-space:nowrap}
.sc-tbl .k1,.sc-tbl .k2{position:sticky;background:var(--surface);z-index:1}
.sc-tbl .k1{left:0;min-width:44px}
.sc-tbl .k2{left:44px;min-width:150px;box-shadow:2px 0 0 var(--line)}
.sc-tbl thead th{vertical-align:bottom}
.sc-tbl .unit-h{text-align:left}
.sc-unit{display:flex;gap:6px;align-items:center;margin:0 0 6px}
@media(max-width:640px){.sc-unit ~ .sc-views{display:none}
  #scGrid .k1{width:26px;min-width:26px;max-width:26px;padding-left:2px;padding-right:2px}
  #scGrid .k2{min-width:104px;max-width:118px;white-space:normal;font-size:.88rem;line-height:1.25}
  #scGrid thead th{white-space:normal}
  #scGrid .unit-h,#scGrid .sec-h,#scGrid .exam-h{max-width:130px}
  #scGrid .k2{left:26px}
  #scGrid :is(td,th).r-gr,#scGrid :is(td,th).r-tot{position:static}      /* จอแคบ: ตรึงซ้าย+ขวาพร้อมกันเหลือที่กรอกไม่พอ (ช่องซ่อมถูกบัง) → รวม/เกรดเลื่อนตามตาราง */
  #scGrid td input.in.cell{width:50px;padding-left:4px;padding-right:4px}
  #scGrid thead th:not(.k1):not(.k2){padding-left:4px;padding-right:4px;font-size:.78rem}
  #scGrid td:not(.k1):not(.k2){padding-left:3px;padding-right:3px}}.sc-unit select{flex:1;min-width:0;min-height:40px}.sc-unit .btn{min-width:40px;min-height:40px;font-size:1.1rem}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* หน้ากรอกคะแนนบนจอคอม: ใช้ความกว้างเต็มพื้นที่ (หน้าอื่นยังจำกัดความกว้างให้อ่านสบาย) */
:root[data-page="scores"] main{max-width:none;padding-left:clamp(12px,1.6vw,28px);padding-right:clamp(12px,1.6vw,28px)}
.sc-toolbar{position:sticky;top:var(--topbar-h,0px);z-index:16;background:var(--bg);margin:-12px 0 8px;padding:8px 0 6px;border-bottom:1px solid var(--line)}
.sc-tb1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.sc-cls{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}
.sc-c{border:0;border-left:1px solid var(--line);background:none;padding:4px 12px;min-height:32px;font-weight:600;font-size:.88rem;color:var(--text)}
.sc-c:first-child{border-left:0}.sc-c[aria-pressed="true"]{background:var(--brand);color:var(--brand-ink)}
.sc-subj{font-size:.85rem;color:var(--muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-stat{font-size:.82rem;color:var(--muted);white-space:nowrap}.sc-stat b{color:var(--text)}
.sc-tb1 .grow{flex:1}
.sc-tb1 .btn.sm{min-height:32px;padding:3px 10px;gap:6px}.sc-tb1 .btn svg{width:16px;height:16px}
.sc-help{position:relative}.sc-help summary{list-style:none;font-weight:700;min-width:32px}.sc-help summary::-webkit-details-marker{display:none}
.sc-help-pop{position:absolute;right:0;top:calc(100% + 6px);width:330px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:.82rem;line-height:1.7;box-shadow:0 10px 30px rgba(0,0,0,.15);z-index:20}
.sc-card{padding:0;overflow:hidden}
.sc-scroll{margin:0;padding:0;max-height:calc(100vh - var(--topbar-h,0px) - var(--sctool-h,90px) - 26px);overflow:auto}
#scGrid thead{position:sticky;top:0;z-index:4}
:where(#scGrid thead th){background:var(--surface)}
#scGrid thead th.k1,#scGrid thead th.k2{z-index:5}
#scGrid .r-gr,#scGrid .r-tot{position:sticky;box-sizing:border-box;text-align:center;z-index:2}
#scGrid .r-gr{right:0;width:56px;min-width:56px;max-width:56px;background:var(--surface)}
#scGrid .r-tot{right:56px;width:60px;min-width:60px;max-width:60px;background:var(--surface2);box-shadow:-6px 0 8px -6px rgba(0,0,0,.25),inset 1px 0 0 var(--line)}
#scGrid thead .r-gr,#scGrid thead .r-tot{z-index:5}
#scGrid tbody tr:hover td.r-gr,#scGrid tbody tr:hover td.r-tot{background:var(--surface2)}
.sc-views{display:flex;gap:5px;flex-wrap:wrap;margin:0}
.sc-view{flex-direction:row!important;align-items:baseline!important;gap:6px!important;padding:3px 10px!important;font-size:.84rem!important;border-top-width:2px!important}
.sc-view[aria-pressed="true"]{background:color-mix(in srgb,var(--sc,var(--brand)) 14%,var(--surface));border-color:var(--sc,var(--brand));box-shadow:0 0 0 1px var(--sc,var(--brand)) inset}
@media(max-width:860px){.sc-tb1 .lbl{display:none}.sc-subj{display:none}.sc-help-pop{width:min(300px,86vw)}.sc-tb1{gap:6px;margin-bottom:4px}.sc-views{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.sc-views::-webkit-scrollbar{display:none}.sc-view{flex:none;white-space:nowrap}.sc-view small{display:none}.sc-toolbar{margin-top:-6px}}
.sc-view{display:flex;flex-direction:column;align-items:flex-start;gap:0;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:10px;padding:6px 12px;font-weight:600;font-size:.9rem;line-height:1.3;border-top:3px solid var(--sc,var(--line))}
.sc-view small{font-weight:400;color:var(--muted);font-size:.74rem}
.sc-view[aria-selected="true"]{background:color-mix(in srgb,var(--sc,var(--brand)) 14%,var(--surface));border-color:var(--sc,var(--brand));box-shadow:0 0 0 1px var(--sc,var(--brand)) inset}
.sc-view.s-all{--sc:var(--brand)}.sc-view.s-sum{--sc:var(--text)}
.s-before{--sc:#2563eb}.s-mid{--sc:#b45309}.s-after{--sc:#059669}.s-final{--sc:#7c3aed}
:root[data-scheme="dark"] .s-before{--sc:#7db4f5}:root[data-scheme="dark"] .s-mid{--sc:#f0b54f}:root[data-scheme="dark"] .s-after{--sc:#5fd09a}:root[data-scheme="dark"] .s-final{--sc:#c3a4f0}
.sc-tbl .sec-h{text-align:center;font-size:.82rem;font-weight:700;color:var(--sc);background:color-mix(in srgb,var(--sc) 12%,var(--surface));border-bottom:2px solid color-mix(in srgb,var(--sc) 35%,transparent);border-left:2px solid var(--surface)}
.sc-tbl .sec-h.s-sum{--sc:var(--text)}
.sc-tbl .exam-h,.sc-tbl .sec-tot-h{background:color-mix(in srgb,var(--sc) 8%,var(--surface));border-left:1px solid color-mix(in srgb,var(--sc) 22%,transparent)}
.sc-tbl td.exam{background:color-mix(in srgb,var(--sc) 4%,transparent);border-left:1px solid color-mix(in srgb,var(--sc) 22%,transparent)}
.sc-tbl td.sec-tot{background:color-mix(in srgb,var(--sc) 9%,transparent);border-left:1px solid color-mix(in srgb,var(--sc) 25%,transparent);text-align:center}
.uc0{--uc:#2563eb}.uc1{--uc:#d97706}.uc2{--uc:#059669}.uc3{--uc:#db2777}.uc4{--uc:#0891b2}.uc5{--uc:#7c3aed}
:root[data-scheme="dark"] .uc0{--uc:#7db4f5}:root[data-scheme="dark"] .uc1{--uc:#f0b54f}:root[data-scheme="dark"] .uc2{--uc:#5fd09a}:root[data-scheme="dark"] .uc3{--uc:#f59ac0}:root[data-scheme="dark"] .uc4{--uc:#5ad1e0}:root[data-scheme="dark"] .uc5{--uc:#c3a4f0}
.sc-tbl th.unit-h{background:color-mix(in srgb,var(--uc) 13%,var(--surface));border-top:2px solid color-mix(in srgb,var(--uc) 40%,transparent);border-bottom:1px solid color-mix(in srgb,var(--uc) 18%,transparent)}
.sc-tbl th.unit-h .u-name{font-weight:700;color:color-mix(in srgb,var(--uc) 70%,var(--text))}
.sc-tbl th.sub-h[class*="uc"]{background:color-mix(in srgb,var(--uc) 8%,var(--surface))}
.sc-tbl td[class*="uc"]{background:color-mix(in srgb,var(--uc) 4%,transparent)}
.sc-tbl .u-start{border-left:1px solid color-mix(in srgb,var(--uc) 25%,transparent)}
.sc-tbl td.ut[class*="uc"],.sc-tbl th.ut-h{background:color-mix(in srgb,var(--uc) 13%,var(--surface));text-align:center}
.sc-tbl .tot-h,.sc-tbl td.tot{border-left:1px solid var(--line);background:var(--surface2);text-align:center}
.sc-tbl tbody tr:hover td{box-shadow:inset 0 1px 0 var(--line),inset 0 -1px 0 var(--line)}
.sc-tbl tbody tr:hover td.k1,.sc-tbl tbody tr:hover td.k2{background:var(--surface2)}
.sc-tbl .sub-h{background:var(--surface2);font-weight:500;min-width:76px}
.sc-tbl .ut{background:var(--surface2);font-weight:700}
.sc-tbl .ut.low{color:var(--bad)}
.sbtn{border:1px solid var(--line);background:var(--surface);border-radius:6px;min-height:26px;padding:0 7px;font-size:.78rem;font-weight:600;cursor:pointer;color:var(--text)}
.sc-tbl .sbtn{min-height:22px;min-width:22px;padding:0 5px;border-radius:4px;font-size:.85rem;line-height:1;vertical-align:middle;background:transparent;border-color:color-mix(in srgb,var(--text) 18%,transparent)}
.sbtn:hover{border-color:var(--brand)}
.sbtn.del{color:var(--bad)}
.sb-row{display:grid;grid-template-columns:minmax(0,1fr) 90px auto auto;gap:8px;align-items:center;margin-bottom:8px}
.kx-tbl td,.kx-tbl th{padding:6px;vertical-align:top}.kx-tbl .kx-m{width:64px;text-align:center}.kx-t{max-width:180px}.kx-sum{text-align:center;font-weight:600;padding-top:12px!important}
.kx-ex{display:flex;align-items:center;gap:4px;font-size:.78rem;color:var(--muted);margin-top:4px;white-space:nowrap}.kx-ex input{width:16px;height:16px;accent-color:var(--brand)}
.kx-tools,.kx-fill{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.kx-tools select{max-width:320px}.kx-fill .in{width:60px;text-align:center}.kx-fill .kx-ex{margin:0}
@media (max-width:860px){.grid.bk-g2{grid-template-columns:minmax(0,1fr)}}   /* หน้าหัวข้อคะแนน: การ์ดสอบ/เกณฑ์เกรดเรียงลงบนจอแคบ (ตารางเกณฑ์เกรดไม่ดันหน้าล้นจอ) */
.sc-tbl input.in{width:68px}
.sc-tbl input.in.rt{width:68px;margin-top:4px;border-style:dashed}
/* ช่องคะแนน: กล่องสี่เหลี่ยมมุมตรง กะทัดรัด (ใช้ #scGrid ให้ชนะสไตล์มุมมนของทุกธีม) */
#scGrid th{padding:6px 8px;line-height:1.35}
#scGrid td{padding:3px 6px}
#scGrid input.in{border-radius:0;width:54px;min-height:30px;height:30px;padding:0 4px;text-align:center;font-variant-numeric:tabular-nums;background:var(--surface);border-color:color-mix(in srgb,var(--text) 16%,transparent);box-shadow:none}
#scGrid input.in:focus{border-color:var(--brand);outline:2px solid color-mix(in srgb,var(--brand) 35%,transparent);outline-offset:0}
#scGrid input.in.rt{width:42px;margin-top:0;padding:0 2px}
#scGrid .rt-row{display:flex;gap:2px;align-items:center;margin-top:3px}
#scGrid .rt-add{min-height:30px;min-width:22px;padding:0 4px}
#scGrid .rt-td .rt-row{margin-top:0;justify-content:center}
#scGrid .rt-prog{white-space:nowrap;margin-top:2px;font-size:.72rem}
#scGrid input.locked{background:var(--surface2);color:var(--text);cursor:default;border-style:dotted}
#scGrid input.low{background:var(--bad-soft);border-color:color-mix(in srgb,var(--bad) 55%,transparent)}
#scGrid .chip{border-radius:3px;padding:0 6px;font-size:.72rem}
#scGrid .k2{line-height:1.3}
.sc-tbl .over{border-color:var(--bad)}
.sc-tbl input.low,.sc-tbl .btn.low{color:var(--bad);border-color:var(--bad);font-weight:700;background:var(--bad-soft)}
.low-t{color:var(--bad)}
.voice-here{outline:3px solid var(--gold);outline-offset:1px}
.pk-item{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line);cursor:pointer}
.pk-item.used{opacity:.55}
.pk-item input{width:20px;height:20px;margin-top:4px;accent-color:var(--brand);flex:none}
.pk-grp{font-weight:700;margin-top:14px}
.notice{padding:10px 12px;border-radius:10px;background:var(--warn-soft);color:var(--text);font-size:.9rem;margin-bottom:10px}
.notice.bad{background:var(--bad-soft)}
.stat-row{display:flex;gap:16px;flex-wrap:wrap;margin:6px 0 12px}
.stat-row span{color:var(--muted)} .stat-row b{color:var(--text)}
`;
document.head.appendChild(style);

/* ============================================================
   หัวข้อคะแนน
   ============================================================ */
P.items = () => {
  const c = cur(), b = book(c.id), W = b.weights;
  const bt = secMax(b, 'before'), at = secMax(b, 'after'), wsum = bt + at + num(W.mid) + num(W.final), ok100 = Math.abs(wsum - 100) < 0.005;
  const gsOpts = sel => '<option value="">— เลือกชุดกลุ่ม —</option>' + b.groupSets.map(g => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  const bar = [['หน่วยก่อนกลางภาค', bt, '#7a1f2b'], ['กลางภาค', W.mid, '#8f6a1c'], ['หน่วยหลังกลางภาค', at, '#235a9f'], ['ปลายภาค', W.final, '#1f7a4d']];
  const rows = b.items.map((it, i) => {
    const cs = comps(it);
    return `<tr data-it="${it.id}"><td class="muted">${i + 1}</td>
      <td><input class="in" style="min-width:170px" data-bk="itName" data-it="${it.id}" value="${esc(it.name)}" aria-label="ชื่อหน่วย ${i + 1}">
        ${it.work ? `<div class="muted small">${esc(it.work)}</div>` : ''}</td>
      <td><select class="in" style="min-width:140px" data-bk="itSection" data-it="${it.id}" aria-label="ช่วงคะแนน"><option value="before" ${section(it) === 'before' ? 'selected' : ''}>ก่อนกลางภาค</option><option value="after" ${section(it) === 'after' ? 'selected' : ''}>หลังกลางภาค</option></select></td>
      <td><select class="in" style="min-width:160px" data-bk="itKind" data-it="${it.id}" aria-label="ประเภท">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${(it.kind || 'individual') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${it.kind === 'group' ? `<select class="in" style="margin-top:6px;min-width:160px" data-bk="itGs" data-it="${it.id}" aria-label="ชุดกลุ่ม">${gsOpts(it.groupSetId)}</select>` : ''}</td>
      <td><div style="display:flex;align-items:center;gap:4px"><input class="in" style="width:80px;text-align:center" inputmode="decimal" data-bk="itMax" data-it="${it.id}" value="${esc(it.max)}" aria-label="สัดส่วนของหน่วย (%)"><span class="muted">%</span></div></td>
      <td>${cs.length ? cs.map(x => `<span class="chip">${esc(subName(x, b))} /${fmt(x.rawMax)}</span>`).join(' ') : '<span class="muted small">ช่องเดียว</span>'}${it.rawMax && !cs.length ? ` <span class="chip gold">ดิบเต็ม ${fmt(it.rawMax)}</span>` : ''}</td>
      <td style="white-space:nowrap;text-align:right">
        <button class="btn sm" data-bk="subEditor" data-it="${it.id}" ${it.kind === 'group' ? 'disabled title="หัวข้อกลุ่มใช้คะแนนรวม"' : 'title="แบ่งคะแนนตามตัวชี้วัด K S A หรือช่องย่อย"'}>โครงคะแนน${cs.length ? ' (' + cs.length + ')' : ''}</button>
        <button class="btn sm" data-bk="itEdit" data-it="${it.id}">ตั้งค่า</button>
        <button class="btn sm ghost" data-bk="itUp" data-it="${it.id}" aria-label="เลื่อนขึ้น">↑</button>
        <button class="btn sm ghost" data-bk="itDown" data-it="${it.id}" aria-label="เลื่อนลง">↓</button>
        <button class="btn sm ghost" style="color:var(--bad)" data-bk="itDel" data-it="${it.id}">ลบ</button></td></tr>`;
  }).join('');
  return head2('หัวข้อคะแนน', 'แต่ละหน่วยมีสัดส่วนเป็น % จาก 100 (รวมกลางภาคและปลายภาคแล้วต้องเป็น 100%) และเพิ่มช่องคะแนนย่อยของแต่ละหน่วยได้',
      `<button class="btn" data-bk="itReuse">ใช้รูปแบบของห้องอื่น</button><button class="btn" data-bk="itMany">เพิ่มหลายหน่วย</button><button class="btn pri" data-bk="itAdd">${ic('plus')}เพิ่มหน่วย</button>`) +
    clsPills() +
    `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><h2 style="margin:0">สัดส่วนคะแนนรวม 100%</h2><span class="grow"></span>
        <span class="chip ${ok100 ? 'ok' : 'bad'}">รวม ${fmt(wsum)} / 100 %</span>${ok100 ? '' : '<button class="btn sm pri" data-bk="fix100">ปรับให้ครบ 100%</button>'}</div>
      <div class="bk-bar" role="img" aria-label="สัดส่วน หน่วยก่อนกลางภาค ${bt} กลางภาค ${W.mid} หน่วยหลังกลางภาค ${at} ปลายภาค ${W.final}">${bar.map(([l, v, col]) => `<div style="flex:${Math.max(num(v), 0.0001)};background:${col}" title="${l} ${v}%">${num(v) > 0 ? l + ' ' + fmt(v) + '%' : ''}</div>`).join('')}</div>
      ${ok100 ? '' : `<div class="notice bad">สัดส่วนรวมเป็น ${fmt(wsum)}% ไม่ใช่ 100% — ${wsum > 100 ? 'เกิน' : 'ขาด'} ${fmt(Math.abs(100 - wsum))}% กด “ปรับให้ครบ 100%” เพื่อปรับสัดส่วนของหน่วยให้อัตโนมัติ หรือแก้ตัวเลขเอง</div>`}
      <div class="grid g4">
        <div><div class="f">หน่วยก่อนกลางภาครวม</div><div class="in" style="display:flex;align-items:center;background:var(--surface2)">${fmt(bt)} %</div></div>
        <div><label class="f" for="wMid">กลางภาค (%)</label><input id="wMid" class="in" inputmode="decimal" data-bk="wMid" value="${esc(W.mid)}"></div>
        <div><div class="f">หน่วยหลังกลางภาครวม</div><div class="in" style="display:flex;align-items:center;background:var(--surface2)">${fmt(at)} %</div></div>
        <div><label class="f" for="wFinal">ปลายภาค (%)</label><input id="wFinal" class="in" inputmode="decimal" data-bk="wFinal" value="${esc(W.final)}"></div>
      </div></div>
    <div class="card"><h2>หน่วยที่ให้คะแนน</h2>
      ${b.items.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>ที่</th><th>ชื่อหน่วย</th><th>ช่วง</th><th>ประเภท</th><th>สัดส่วน (% จาก 100)</th><th>ช่องคะแนนย่อย</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="muted small" style="margin-top:10px"><b>ช่องย่อย</b> = แบ่งหน่วยเป็นหลายช่องคะแนน (เช่น งาน 1, งาน 2, ทดสอบย่อย) กำหนดคะแนนเต็มของแต่ละช่องเองได้ ระบบรวมเป็นสัดส่วน % ของหน่วยให้ · <b>สอบ (มีช่องซ่อม)</b> = มีคอลัมน์ซ่อมต่อท้าย ซ่อมได้หลายครั้ง ใช้ครั้งที่ได้สูงสุดคิดคะแนน · <b>กลุ่ม</b> = ลงคะแนนที่เมนู “คะแนนกลุ่ม” แล้วระบบกระจายให้สมาชิก</div>`
        : '<div class="empty">ยังไม่มีหน่วยคะแนน<br><span class="small">กด “เพิ่มหน่วย” เช่น หน่วยที่ 1, หน่วยที่ 2, ใบงาน, การทดลอง</span></div>'}</div>
    <div class="grid g2 bk-g2" style="margin-top:16px;align-items:start">
      <div class="card" style="margin-top:0"><h2>คะแนนสอบกลางภาค / ปลายภาค</h2>
        <p class="muted small" style="margin-bottom:8px">“เต็ม” คือคะแนนเต็มของข้อสอบที่ตรวจจริง ส่วนสัดส่วน % อยู่ด้านบน</p>
        <div class="grid g2"><div><label class="f" for="exMid">ข้อสอบกลางภาคเต็ม</label><input id="exMid" class="in" inputmode="decimal" data-bk="exMid" value="${esc(b.exams.midMax)}"></div>
        <div><label class="f" for="exFin">ข้อสอบปลายภาคเต็ม</label><input id="exFin" class="in" inputmode="decimal" data-bk="exFin" value="${esc(b.exams.finalMax)}"></div></div>
        <label class="row" style="border:0;cursor:pointer"><input type="checkbox" style="width:20px;height:20px;accent-color:var(--brand)" data-bk="exRetake" ${b.exams.retakeEnabled ? 'checked' : ''}><span>เปิดสอบซ่อมกลางภาค เฉพาะผู้ได้ต่ำกว่าเกณฑ์ผ่าน</span></label>
        <div class="field" style="margin-top:6px"><label class="f" for="passP">เกณฑ์ผ่านรายส่วน (%)</label><input id="passP" class="in" style="max-width:120px" inputmode="decimal" data-bk="passP" value="${esc(b.passPercent)}"></div></div>
      <div class="card" style="margin-top:0"><h2>เกณฑ์ตัดเกรด <span class="muted small">จากคะแนนรวมเต็ม 100</span></h2>
        <table class="tbl"><thead><tr><th>ตั้งแต่คะแนน</th><th>ได้เกรด</th><th></th></tr></thead><tbody>
        ${b.gradeScale.map((g, i) => `<tr><td><input class="in" style="width:90px" inputmode="decimal" data-bk="gMin" data-i="${i}" value="${esc(g[0])}" aria-label="ตั้งแต่คะแนน"></td><td><input class="in" style="width:90px" data-bk="gVal" data-i="${i}" value="${esc(g[1])}" aria-label="เกรด"></td><td><button class="btn sm ghost" data-bk="gDel" data-i="${i}">ลบ</button></td></tr>`).join('')}
        </tbody></table>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm" data-bk="gAdd">+ เพิ่มขั้น</button><button class="btn sm" data-bk="gReset">คืนค่ามาตรฐาน</button></div></div>
    </div>`;
};

/* ตัวแก้ไขช่องคะแนนย่อยของหน่วย (เพิ่ม/ลบ/ตั้งคะแนนเต็ม) */
/* โครงคะแนนของหน่วย: ตารางตัวชี้วัด × K S A / คะแนนรวม (เว้นว่าง = ไม่มีช่องนั้น · ติ๊ก “สอบ” = ต่ำกว่าเกณฑ์ซ่อมได้)
   + ช่องอื่นที่ไม่ผูกตัวชี้วัด (ช่องย่อยแบบเดิม) · คีย์ช่องเดิมคงไว้ คะแนนที่กรอกแล้วไม่หาย */
const KQ = [['K', 'K ความรู้'], ['S', 'S ทักษะ'], ['A', 'A เจตคติ'], ['', 'คะแนนรวม']];
const indOf = (b, id) => (b.indicators || []).find(x => x.id === id);
const indLabel = x => x ? (x.code || String(x.text || '').slice(0, 24) || 'ตัวชี้วัด') : 'ตัวชี้วัด';
function openSubsEditor(id) {
  const b = book(cur().id), it = b.items.find(x => x.id === id); if (!it) return;
  const cs = comps(it), inds = b.indicators || [], byInd = {}, order = [];
  cs.filter(c => c.ind && indOf(b, c.ind)).forEach(c => { if (!byInd[c.ind]) { byInd[c.ind] = {}; order.push(c.ind); } byInd[c.ind][c.ksa || ''] = c; });
  const cell = (q, c) => `<td><input class="in kx-m" data-q="${q}" inputmode="decimal" value="${c ? esc(c.rawMax) : ''}" placeholder="–" aria-label="คะแนนเต็ม ${q || 'รวม'}"><label class="kx-ex"><input type="checkbox" data-q="${q}"${c && c.exam ? ' checked' : ''}> สอบ</label></td>`;
  const indRow = iid => { const x = indOf(b, iid), m = byInd[iid] || {};
    return `<tr class="kx-row" data-ind="${esc(iid)}"><td><b>${esc(indLabel(x))}</b><div class="muted small kx-t">${esc(String((x && x.text) || '').slice(0, 60))}</div></td>${KQ.map(([q]) => cell(q, m[q])).join('')}<td class="kx-sum"></td><td><button class="sbtn del" data-kxrm aria-label="เอาตัวชี้วัดนี้ออก">ลบ</button></td></tr>`; };
  const freeRow = (k, name, raw, ex) => `<div class="sb-row" data-k="${esc(k)}"><input class="in sb-n" value="${esc(name)}" placeholder="ชื่อช่อง เช่น งาน 1" aria-label="ชื่อช่อง"><input class="in sb-m" inputmode="decimal" value="${esc(raw)}" placeholder="เต็ม" aria-label="คะแนนเต็ม"><label class="kx-ex"><input type="checkbox" class="sb-x"${ex ? ' checked' : ''}> สอบ</label><button class="sbtn del" data-sbrm aria-label="ลบช่องนี้">ลบ</button></div>`;
  const cu = it.unitId && ((b.course || {}).units || []).find(u => u.id === it.unitId), cuInds = cu ? (cu.inds || []).filter(i => indOf(b, i)) : [];
  modal(`<h2 style="margin-bottom:4px">โครงคะแนน · ${esc(it.name)}</h2>
    <p class="muted small" style="margin-bottom:10px">หน่วยนี้คิดเป็น <b>${fmt(it.max)}%</b> — ใส่คะแนนเต็มของแต่ละช่อง เว้นว่าง = ไม่มีช่องนั้น ตัวชี้วัดใช้ K S A หรือคะแนนรวมช่องเดียวก็ได้ · ติ๊ก <b>สอบ</b> = ได้ต่ำกว่าเกณฑ์แล้วซ่อมได้ (ใบงาน/ชิ้นงานไม่ต้องติ๊ก) ระบบรวมคะแนนดิบเป็นสัดส่วนของหน่วยให้</p>
    <div class="scroll"><table class="tbl kx-tbl"><thead><tr><th style="min-width:130px">ตัวชี้วัด</th>${KQ.map(([, l]) => `<th>${l}</th>`).join('')}<th>รวม</th><th></th></tr></thead>
      <tbody id="kxBody">${order.map(indRow).join('')}</tbody></table></div>
    <div id="kxEmpty" class="muted small" style="margin:6px 0">${order.length ? '' : 'ยังไม่ได้เลือกตัวชี้วัด — เพิ่มด้านล่าง หรือใช้เฉพาะช่องอื่น'}</div>
    <div class="kx-tools">${inds.length ? `<select class="in" id="kxSel" aria-label="เลือกตัวชี้วัด"><option value="">+ เพิ่มตัวชี้วัด…</option><option value="*">ทุกตัวชี้วัดที่ยังไม่มี</option>${inds.map(x => `<option value="${esc(x.id)}">${esc(indLabel(x) + ' ' + String(x.text || '').slice(0, 40))}</option>`).join('')}</select>` : '<span class="muted small">ยังไม่มีตัวชี้วัดในห้องนี้ — เพิ่มที่หน้า “ตัวชี้วัด / ผลการเรียนรู้”</span>'}
      ${cuInds.length ? `<button class="btn sm" id="kxCourse" title="ตัวชี้วัดที่เลือกไว้ในหน่วยนี้ของโครงสร้างรายวิชา">ดึงจากโครงสร้างรายวิชา (${cuInds.length})</button>` : ''}</div>
    <div class="kx-fill"><span class="small">ใส่ทุกแถวพร้อมกัน</span> K <input class="in" id="kxK" inputmode="decimal" placeholder="–"> <label class="kx-ex"><input type="checkbox" id="kxKx"> สอบ</label> S <input class="in" id="kxS" inputmode="decimal" placeholder="–"> A <input class="in" id="kxA" inputmode="decimal" placeholder="–"> <button class="btn sm" id="kxFill">ใส่</button></div>
    <h3 class="small" style="margin:14px 0 6px">ช่องอื่น (ไม่ผูกตัวชี้วัด)</h3>
    <div id="sbList">${cs.filter(c => !(c.ind && indOf(b, c.ind))).map(c => freeRow(c.key, subName(c, b), c.rawMax, c.exam)).join('')}</div>
    <button class="btn sm" id="sbAdd" style="margin:4px 0 10px">+ เพิ่มช่องอื่น</button>
    <div class="row" style="border:0;padding:6px 0"><span class="grow small" id="kxTot"></span><button class="btn pri" data-bk="subsSave" data-it="${it.id}">บันทึก</button></div>`, true); wide();      // ตารางตัวชี้วัด×K S A กว้าง: ขยายกล่องให้เห็นคอลัมน์รวม/ลบบนจอคอม
  const body = $('#kxBody'), list = $('#sbList');
  const tot = () => { let all = 0; body.querySelectorAll('.kx-row').forEach(tr => { let s = 0; tr.querySelectorAll('.kx-m').forEach(i => { s += num(i.value); }); tr.querySelector('.kx-sum').textContent = s ? fmt(s) : '–'; all += s; });
    list.querySelectorAll('.sb-m').forEach(i => { all += num(i.value); }); $('#kxTot').textContent = 'คะแนนดิบรวม ' + fmt(all) + ' → คิดเป็น ' + fmt(it.max) + '%'; $('#kxEmpty').textContent = body.children.length ? '' : 'ยังไม่ได้เลือกตัวชี้วัด — เพิ่มด้านล่าง หรือใช้เฉพาะช่องอื่น'; };
  const addInd = iid => { if (!iid || body.querySelector(`[data-ind="${CSS.escape(iid)}"]`)) return; body.insertAdjacentHTML('beforeend', indRow(iid)); };
  const sel = $('#kxSel'); if (sel) sel.onchange = () => { if (sel.value === '*') inds.forEach(x => addInd(x.id)); else addInd(sel.value); sel.value = ''; tot(); };
  const cb = $('#kxCourse'); if (cb) cb.onclick = () => { cuInds.forEach(addInd); tot(); };
  $('#kxFill').onclick = () => { const v = { K: $('#kxK').value.trim(), S: $('#kxS').value.trim(), A: $('#kxA').value.trim() };
    if (!body.children.length) return toast('เพิ่มตัวชี้วัดก่อน');
    body.querySelectorAll('.kx-row').forEach(tr => { ['K', 'S', 'A'].forEach(q => { if (v[q] !== '') tr.querySelector(`.kx-m[data-q="${q}"]`).value = v[q]; });
      if (v.K !== '') tr.querySelector('input[type=checkbox][data-q="K"]').checked = $('#kxKx').checked; if (v.K !== '' || v.S !== '' || v.A !== '') tr.querySelector('.kx-m[data-q=""]').value = ''; });
    tot(); };
  body.addEventListener('click', e => { const r = e.target.closest('[data-kxrm]'); if (r) { r.closest('tr').remove(); tot(); } });
  body.addEventListener('input', tot); list.addEventListener('input', tot);
  list.addEventListener('click', e => { const r = e.target.closest('[data-sbrm]'); if (r) { r.closest('.sb-row').remove(); tot(); } });
  $('#sbAdd').onclick = () => { list.insertAdjacentHTML('beforeend', freeRow('', 'ช่อง ' + (list.children.length + 1), 10, false)); list.lastElementChild.querySelector('.sb-n').select(); tot(); };
  tot();
}
function subOne(itId, key) {                      // ป๊อปอัปแก้ไข/ลบ ช่องย่อยเดียว หรือเพิ่มช่องใหม่
  const b = book(cur().id), it = b.items.find(x => x.id === itId); if (!it) return;
  const c0 = key ? comps(it).find(x => x.key === key) : null;
  modal(`<h2 style="margin-bottom:12px">${c0 ? 'แก้ไขช่องย่อย' : 'เพิ่มช่องย่อย'} · ${esc(it.name)}</h2>
    <div class="field"><label class="f" for="so-n">ชื่อช่อง</label><input id="so-n" class="in" value="${esc(c0 ? subName(c0, b) : 'ช่อง ' + (comps(it).length + 1))}"></div>
    <div class="field"><label class="f" for="so-m">คะแนนเต็ม</label><input id="so-m" class="in" inputmode="decimal" value="${esc(c0 ? c0.rawMax : 10)}"></div>
    <label class="row small" style="border:0;gap:8px;padding:0 0 12px"><input type="checkbox" id="so-x"${c0 && c0.exam ? ' checked' : ''}> เป็นการสอบ (ได้ต่ำกว่าเกณฑ์แล้วซ่อมได้)</label>
    <div style="display:flex;gap:8px"><button class="btn pri" style="flex:1" data-bk="subOneSave" data-it="${it.id}" data-k="${esc(key || '')}">บันทึก</button>
      ${c0 ? `<button class="btn" style="color:var(--bad)" data-bk="subOneDel" data-it="${it.id}" data-k="${esc(key)}">ลบช่องนี้</button>` : ''}</div>`, true);
}
function openItemEdit(id) {
  const b = book(cur().id), it = b.items.find(x => x.id === id); if (!it) return;
  const kind = it.kind || 'individual', hasSubs = comps(it).length > 0;
  modal(`<h2 style="margin-bottom:12px">ตั้งค่าหน่วย</h2>
    <div class="field"><label class="f" for="ie-n">ชื่อหน่วย</label><input id="ie-n" class="in" value="${esc(it.name)}"></div>
    <div class="field"><label class="f" for="ie-w">ภาระงาน (นักเรียนเห็น)</label><input id="ie-w" class="in" list="bk-works" value="${esc(it.work || '')}" placeholder="เช่น ใบงาน">
      <datalist id="bk-works">${['ใบงาน', 'แบบฝึกหัด', 'สอบเก็บคะแนน', 'สอบย่อย', 'การทดลอง', 'รายงานการทดลอง', 'นำเสนอกลุ่ม', 'ชิ้นงาน', 'โครงงาน', 'รายงาน', 'สมุดจดบันทึก', 'การมีส่วนร่วมในชั้นเรียน'].map(w => `<option value="${w}">`).join('')}</datalist></div>
    ${kind === 'group' || hasSubs ? '' : `
    <div class="notice" style="background:var(--info-soft)"><b>คะแนนดิบเต็ม</b> คือเต็มของตัวเลขที่ครูกรอกจริง เช่น ตรวจใบงานเต็ม 25 แต่หน่วยนี้คิดเป็น ${fmt(it.max)}% ใส่ 25 ที่ดิบเต็ม ระบบหารให้เอง · อยากแบ่งเป็นหลายช่อง ใช้ปุ่ม “ช่องย่อย”</div>
    <div class="grid g2">
      <div class="field"><label class="f" for="ie-r">คะแนนดิบเต็ม</label><input id="ie-r" class="in" inputmode="decimal" value="${esc(it.rawMax == null ? '' : it.rawMax)}" placeholder="${esc(it.max)}"></div>
      ${kind === 'unit' ? `<div class="field"><label class="f" for="ie-t">ดิบเต็มช่องซ่อม</label><input id="ie-t" class="in" inputmode="decimal" value="${esc(it.retakeMax == null ? '' : it.retakeMax)}" placeholder="เท่ากับช่องปกติ"></div>` : ''}
    </div>`}
    ${hasSubs && kind === 'unit' ? `<div class="field"><label class="f" for="ie-t">ดิบเต็มช่องซ่อม</label><input id="ie-t" class="in" inputmode="decimal" value="${esc(it.retakeMax == null ? '' : it.retakeMax)}" placeholder="เท่ากับสัดส่วนของหน่วย"></div>` : ''}
    <button class="btn pri" style="width:100%;margin-top:16px" data-bk="itEditSave" data-it="${it.id}">บันทึก</button>`);
}

/* ============================================================
   กรอกคะแนน
   ============================================================ */
const P_ = () => window.EMSPrefs;
const isLow = (v, max, b) => P_().get('redLow') && has(v) && v !== '' && max > 0 && num(v) * 100 / max < num(b.passPercent);
const sChip = ok => ok === null ? '<span class="muted small">–</span>' : `<span class="chip ${ok ? 'ok' : 'bad'}" style="font-size:.74rem">${ok ? 'ผ่าน' : 'ไม่ผ่าน'}</span>`;
/* ผ่าน/ไม่ผ่านของหัวข้อสอบ: ต่ำกว่าเกณฑ์แล้วซ่อม → ใช้ครั้งที่ได้สูงสุด · ป้ายมี data-uchip ให้อัปเดตได้โดยไม่วาดตารางใหม่ */
const unitPass = (b, r, sid, it) => { const rt = (b.itemRetakes || {})[sid] || {}, ex = examComps(it);
  if (ex.length) return ex.every(c => { const k = compRtKey(it, c), v = rtBest(rt[k]); return !r.compFail[k] || (has(v) && num(v) * 100 / num(c.rawMax) >= num(b.passPercent)); });   // มีช่องสอบ = ผ่านเมื่อทุกช่องสอบผ่าน (ครั้งแรกหรือซ่อม)
  const v = rtBest(rt[it.id]);
  return r.unitFailed[it.id] && has(v) ? num(v) * 100 / retakeMax(it) >= num(b.passPercent) : !r.unitFailed[it.id]; };
const unitChip = (b, r, sid, it) => P_().get('showUnitStatus') && (it.kind === 'unit' || examComps(it).length) && itemComplete(b, sid, it) ?`<div data-uchip="${sid}|${it.id}">${sChip(unitPass(b, r, sid, it))}</div>` : '';
const setUChip = (b, r, sid, it, host) => { if (!host) return; const old = host.querySelector('[data-uchip]'); if (old) old.remove(); host.insertAdjacentHTML('beforeend', unitChip(b, r, sid, it)); };   // ป้ายขึ้น/หายตามการกรอกครบ โดยไม่วาดตารางใหม่
/* บรรทัดพัฒนาการใต้ช่องซ่อม: ครั้งแรก → ซ่อม 1 → ซ่อม 2 … */
const rtProg = (b, sid, it) => { const done = rtList(((b.itemRetakes || {})[sid] || {})[it.id]).filter(has); if (!done.length) return '';
  return `<div class="muted small rt-prog" title="พัฒนาการ: ครั้งแรก → ซ่อมแต่ละครั้ง">${[fmt(num(itemValue(b, sid, it)), 1) + '/' + fmt(entryMax(it))].concat(done.map(v => fmt(num(v), 1) + '/' + fmt(retakeMax(it)))).join(' → ')}</div>`; };
const compProg = (b, sid, it, c) => { const done = rtList(((b.itemRetakes || {})[sid] || {})[compRtKey(it, c)]).filter(has); if (!done.length) return '';
  return `<div class="muted small rt-prog" title="พัฒนาการ: ครั้งแรก → ซ่อมแต่ละครั้ง">${[fmt(num(compRaw(b, sid, it, c)), 1)].concat(done.map(v => fmt(num(v), 1))).join(' → ')} /${fmt(c.rawMax)}</div>`; };
/* มุมมองตาราง: ทั้งหมด หรือกรองทีละส่วน (ก่อนกลาง กลาง หลังกลาง ปลายภาค) หรือดูคะแนนรวมแต่ละส่วน
   ตารางสร้างเฉพาะคอลัมน์ที่เห็น เลขคอลัมน์ (data-c) จึงต่อเนื่องเสมอ — วางจาก Excel / กรอกด้วยเสียง / ลูกศร ทำงานตามที่เห็นบนจอ
   (ช่องซ่อมไม่นับเป็นคอลัมน์: วางจาก Excel หลายคอลัมน์จะข้ามคอลัมน์ซ่อม · ช่องซ่อมใช้ ↑ ↓ / Enter เลื่อนแถวของตัวเอง) */
const SECS = [['before', 'ก่อนกลางภาค', 'wBefore', 'passBefore'], ['mid', 'กลางภาค', 'wM', 'passM'], ['after', 'หลังกลางภาค', 'wAfter', 'passAfter'], ['final', 'ปลายภาค', 'wF', 'passF']];
const secMaxOf = (b, k) => num(k === 'before' ? b.weights.before : k === 'mid' ? b.weights.mid : k === 'after' ? b.weights.after : b.weights.final);
function secCell(b, r, k, sid) {
  const ex = (b.exam || {})[sid] || {}, filled = k === 'before' ? r.filledBefore : k === 'after' ? r.filledAfter : k === 'mid' ? has(ex.mid) && ex.mid !== '' : has(ex.final) && ex.final !== '';
  const sec = SECS.find(x => x[0] === k), v = r[sec[2]], mx = secMaxOf(b, k), shown = r.any && !!filled && isFinite(v);
  const low = shown && P_().get('redLow') && mx > 0 && v * 100 / mx < num(b.passPercent);
  return `<b class="${low ? 'low-t' : ''}">${shown ? fmt(v, 1) : '–'}</b>${P_().get('showUnitStatus') && shown && r[sec[3]] !== null && r[sec[3]] !== undefined ? '<div>' + sChip(r[sec[3]]) + '</div>' : ''}`;
}
/* คะแนนสอบที่ฝ่ายวัดผลนำเข้า (b.examSrc[kind] = { at, by, ref, sids:[...] }) — ล็อกเฉพาะคนที่นำเข้า */
const lockedExam = (b, k, sid) => !!(b.examSrc && b.examSrc[k] && (b.examSrc[k].sids || []).indexOf(sid) >= 0);
const srcTag = (b, k) => b.examSrc && b.examSrc[k] ? `<br><span class="chip info" style="font-size:.68rem;border-radius:3px" title="นำเข้าโดย ${esc(b.examSrc[k].by || '')}">🔒 ฝ่ายวัดผล ${thDate(new Date(b.examSrc[k].at).toLocaleDateString('sv-SE'))}</span>` : '';
P.scores = () => {
  const c = cur(), b = book(c.id), st = c.students, pf = P_();
  const showStatus = pf.get('showUnitStatus'), passP = num(b.passPercent);
  const voiceOK = pf.get('voice') && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const rows = st.map(s => ({ s, r: calcRow(b, s) }));
  const done = rows.filter(x => x.r.complete).length, passed = rows.filter(x => x.r.passed).length, failed = rows.filter(x => x.r.any && !x.r.passed).length;
  const nU = (UNDO[c.id] || []).length;
  const tools = `<button class="btn sm" id="scUndo" data-undo title="ย้อนกลับการแก้คะแนนล่าสุด (Ctrl+Z)" style="${nU ? '' : 'opacity:.55'}">↶<span class="lbl">ย้อนกลับ</span><span class="un-n">${nU ? ' ' + nU : ''}</span></button>${voiceOK ? `<button class="btn sm" id="voiceBtn" data-bk="voice" title="กรอกด้วยเสียง">🎤<span class="lbl">กรอกด้วยเสียง</span></button>` : ''}<button class="btn sm" data-bk="goItems" title="หัวข้อคะแนน">${ic('gear')}<span class="lbl">หัวข้อคะแนน</span></button><button class="btn sm" data-bk="exportScores" title="ส่งออกไปชีตของฉัน">${ic('up')}<span class="lbl">ส่งออก</span></button>
    <details class="sc-help"><summary class="btn sm" title="วิธีใช้">?</summary><div class="sc-help-pop">• ↑ ↓ ← → / Enter เลื่อนช่องแบบ Excel · Shift+Enter ขึ้นแถว<br>• คัดลอกจาก Excel แล้ววางที่ช่องแรก วางได้หลายแถวหลายคอลัมน์ (ข้ามคอลัมน์ซ่อม)<br>• ช่องซ่อม: ↑ ↓ / Enter เลื่อนไปช่องซ่อมแถวถัดไป<br>• “+” ที่หัวหน่วย = เพิ่มช่องคะแนนย่อย · ✎ = แก้/ลบช่อง<br>• กดหลายส่วนพร้อมกันได้ เช่น ก่อนกลาง + กลางภาค<br>• คะแนนต่ำกว่า ${fmt(passP)}% เป็นสีแดง</div></details>`;
  const pre = `<h1 class="sr">กรอกคะแนน</h1><div class="sc-toolbar" id="scTool"><div class="sc-tb1">
      <div class="sc-cls" role="group" aria-label="เลือกห้อง">${tCls().map(k => `<button class="sc-c" aria-pressed="${k.id === curId}" data-bk="cls" data-k="${k.id}">${esc(k.name)}</button>`).join('')}</div>
      <span class="sc-subj" title="${esc(c.subject)}">${esc(c.subject)}</span>
      <span class="sc-stat">ครบ <b>${done}/${st.length}</b> · ผ่าน <b style="color:var(--ok)">${passed}</b> · ไม่ผ่าน <b style="color:var(--bad)">${failed}</b></span>
      <span class="grow"></span>${tools}</div>`;
  if (!b.items.length && !(num(b.exams.midMax) > 0 || num(b.exams.finalMax) > 0)) return pre + '</div>' + noRoom('หัวข้อคะแนน');
  const showRt = !!b.exams.retakeEnabled, hasMid = num(b.exams.midMax) > 0, hasFin = num(b.exams.finalMax) > 0;
  /* S.bkSecs = ส่วนที่เลือก (ว่าง = ทั้งหมด) · S.bkView === 'sum' = ดูคะแนนรวมแต่ละส่วน */
  if (['before', 'mid', 'after', 'final'].indexOf(S.bkView) >= 0) { S.bkSecs = [S.bkView]; S.bkView = 'all'; }
  const SEL = (S.bkSecs || []).filter(k => ['before', 'mid', 'after', 'final'].indexOf(k) >= 0);
  const V = S.bkView === 'sum' ? 'sum' : SEL.length ? 'some' : 'all';
  /* จอมือถือ: กรอกทีละหน่วย (S.bkUnit = รหัสหน่วย / 'mid' / 'final') ไม่ให้ตารางล้นจอ */
  const UOPT = unitOpts(b, hasMid, hasFin), UN = isMobile() && V !== 'sum' && UOPT.length ? (UOPT.some(o => o[0] === S.bkUnit) ? S.bkUnit : UOPT[0][0]) : '';
  const [UNI, UCOMP] = UN.split('::'), UIT = UN && UN !== 'mid' && UN !== 'final' ? b.items.find(it => it.id === UNI) : null;
  const itemsOf = k => b.items.filter(it => section(it) === k && (!UN || it.id === UNI));
  const want = k => UN ? (UN === k || (UIT && section(UIT) === k)) : V === 'all' || SEL.indexOf(k) >= 0;
  const lowCls = (v, max) => isLow(v, max, b) ? ' low' : '';
  const rtBox = (val, attrs, mx, label) => { const a = rtList(val), list = a.length ? a : [''];
    return `<div class="rt-row">${list.map((v, i) => `<input class="in rt${lowCls(v, mx)}" inputmode="decimal" ${attrs} data-i="${i}" value="${has(v) ? esc(v) : ''}" placeholder="ซ่อม${list.length > 1 ? ' ' + (i + 1) : ''}" title="ซ่อมครั้งที่ ${i + 1}" aria-label="${label} ครั้งที่ ${i + 1}">`).join('')}` +
      `<button class="sbtn rt-add" data-bk="rtAdd" ${attrs} title="เพิ่มการซ่อมอีกครั้ง" aria-label="เพิ่มการซ่อม ${label}">+</button></div>`; };
  /* ----- โครงคอลัมน์ ----- */
  let col = 0; const band = [], rowB = [], rowC = [], cells = [];
  let ui = 0;
  /* คอลัมน์ซ่อมของหัวข้อประเภทสอบ: กรอกได้เมื่อต่ำกว่าเกณฑ์ · + = ซ่อมครั้งถัดไป · ใต้ช่องแสดงพัฒนาการ ครั้งแรก → ซ่อม 1 → ซ่อม 2 … */
  const rtCol = (it, u, sub) => {
    const mx = retakeMax(it);
    if (sub) rowC.push(`<th class="sub-h rt-h ${u}">ซ่อม<br><span class="muted small">/${fmt(mx)}</span></th>`);
    else rowB.push(`<th class="unit-h rt-h ${u}" rowspan="2">ซ่อม<br><span class="muted small">เต็ม ${fmt(mx)}</span></th>`);
    cells.push(({ s, r }) => { if (!r.unitFailed[it.id]) return `<td class="${u} rt-td"><span class="muted">–</span></td>`;
      const rt = ((b.itemRetakes[s.id] || {})[it.id]);
      return `<td class="${u} rt-td" data-rtp="${s.id}|${it.id}">${rtBox(rt, `data-bk="itRetake" data-sid="${s.id}" data-it="${it.id}"`, mx, 'ซ่อม ' + esc(it.name) + ' ' + esc(s.name))}${rtProg(b, s.id, it)}</td>`; });
    return 1;
  };
  const unitCols = it => {
    const cs0 = comps(it), one = !!(UCOMP && UIT === it), cs = one ? cs0.filter(x => x.key === UCOMP) : cs0, u = 'uc' + (ui++ % 6), kindTag = it.kind === 'group' ? ' · กลุ่ม' : it.kind === 'unit' ? ' · สอบ' : '';
    const rtOnly = one && UCOMP === '__rt', hasRt = it.kind === 'unit' && !examComps(it).length && (!one || rtOnly);   // rtOnly = มือถือเลือก "› ซ่อม": รวมหน่วย + ช่องซ่อม · มีช่องสอบ = ซ่อมรายช่องแทน
    const utTd = (s, r) => { const tv = itemValue(b, s.id, it); return `<td class="ut ${u}${lowCls(tv, num(it.max))}${rtOnly ? ' u-start' : ''}" data-ut="${s.id}|${it.id}"><b>${has(tv) && tv !== '' ? fmt(tv, 1) : '–'}</b>${showStatus ? unitChip(b, r, s.id, it) : ''}</td>`; };
    if (rtOnly && cs0.length) {
      rowB.push(`<th class="unit-h ${u} u-start" colspan="2"><span class="u-name">${esc(it.name)}</span> <span class="muted small">${fmt(it.max)}%${kindTag}</span></th>`);
      rowC.push(`<th class="sub-h ut-h ${u} u-start">รวมหน่วย<br><span class="muted small">/${fmt(it.max)}%</span></th>`);
      cells.push(({ s, r }) => utTd(s, r));
      return 1 + rtCol(it, u, true);
    }
    if (cs.length) {
      const idx = {}; cs.forEach(x => { idx[x.key] = col++; });
      const nEx = cs.filter(x => x.exam).length;
      rowB.push(`<th class="unit-h ${u} u-start" colspan="${cs.length + nEx + (one ? 0 : 1) + (hasRt ? 1 : 0)}"><span class="u-name">${esc(it.name)}</span> <span class="muted small">${fmt(it.max)}%${kindTag}</span> <button class="sbtn" data-bk="subAdd" data-it="${it.id}" title="เพิ่มช่องคะแนนย่อยในหน่วยนี้" aria-label="เพิ่มช่องคะแนนย่อยใน ${esc(it.name)}">+</button></th>`);
      cs.forEach((x, i) => { rowC.push(`<th class="sub-h ${u}${i === 0 ? ' u-start' : ''}">${esc(subName(x, b))}<br><span class="muted small">/${fmt(x.rawMax)}${x.exam ? ' · สอบ' : ''}</span> <button class="sbtn" data-bk="subEdit" data-it="${it.id}" data-k="${esc(x.key)}" title="แก้ไข/ลบช่องนี้" aria-label="แก้ไข ${esc(subName(x, b))}">✎</button></th>`);
        if (x.exam) rowC.push(`<th class="sub-h rt-h ${u}">ซ่อม<br><span class="muted small">/${fmt(x.rawMax)}</span></th>`); });
      if (!one) rowC.push(`<th class="sub-h ut-h ${u}">รวมหน่วย<br><span class="muted small">/${fmt(it.max)}%</span></th>`);
      /* ช่องซ่อมของช่องสอบ: กรอกได้เมื่อช่องนั้นต่ำกว่าเกณฑ์ · ไม่นับเป็นคอลัมน์ (วางจาก Excel ข้ามไป) */
      const rtTd = (s, r, x) => { const k = compRtKey(it, x); if (!r.compFail[k]) return `<td class="${u} rt-td"><span class="muted">–</span></td>`;
        return `<td class="${u} rt-td" data-rtp="${s.id}|${k}">${rtBox(((b.itemRetakes[s.id] || {})[k]), `data-bk="itRetake" data-sid="${s.id}" data-it="${it.id}" data-ck="${esc(x.key)}"`, num(x.rawMax), 'ซ่อม ' + esc(subName(x, b)) + ' ' + esc(s.name))}${compProg(b, s.id, it, x)}</td>`; };
      cells.push(({ s, r, ri }) => { const cv = ((b.componentScores[s.id] || {})[it.id]) || {};
        return cs.map((x, i) => `<td class="${u}${i === 0 ? ' u-start' : ''}"><input class="in cell${lowCls(cv[x.key], num(x.rawMax))}" inputmode="decimal" data-r="${ri}" data-c="${idx[x.key]}" data-max="${num(x.rawMax)}" data-label="${esc(it.name + ' · ' + subName(x, b))}" data-bk="sub" data-sid="${s.id}" data-it="${it.id}" data-k="${esc(x.key)}" value="${has(cv[x.key]) ? esc(cv[x.key]) : ''}" aria-label="${esc(it.name + ' ' + subName(x, b) + ' ' + s.name)}"></td>` + (x.exam ? rtTd(s, r, x) : '')).join('') + (one ? '' : utTd(s, r)); });
      return cs.length + nEx + (one ? 0 : 1) + (hasRt ? rtCol(it, u, true) : 0);
    }
    const ci = col++, em = entryMax(it);
    rowB.push(`<th class="unit-h ${u} u-start" rowspan="2"><span class="u-name">${esc(it.name)}</span><br><span class="muted small">เต็ม ${fmt(em)} · ${fmt(it.max)}%${kindTag}</span>${it.kind === 'group' ? '' : `<br><button class="sbtn" data-bk="subAdd" data-it="${it.id}" title="แบ่งหน่วยนี้เป็นหลายช่องคะแนน" aria-label="แบ่ง ${esc(it.name)} เป็นหลายช่องคะแนน">+</button>`}</th>`);
    cells.push(({ s, r, ri }) => { const v = (b.scores[s.id] || {})[it.id];
      return `<td class="${u} u-start"><input class="in cell${lowCls(v, em)}" inputmode="decimal" data-r="${ri}" data-c="${ci}" data-max="${em}" data-label="${esc(it.name)}" data-bk="score" data-sid="${s.id}" data-it="${it.id}" value="${has(v) ? esc(v) : ''}" aria-label="${esc(it.name)} ${esc(s.name)}">` +
        (showStatus ? unitChip(b, r, s.id, it) : '') + '</td>'; });
    return 1 + (hasRt ? rtCol(it, u, false) : 0);
  };
  const totCol = (k, short) => { const sec = SECS.find(x => x[0] === k);
    rowB.push(`<th class="sec-tot-h s-${k}" rowspan="2">${short ? sec[1] : 'รวม' + sec[1]}<br><span class="muted small">/${fmt(secMaxOf(b, k))}</span></th>`);
    cells.push(({ s, r }) => `<td class="sec-tot s-${k}" data-st="${s.id}|${k}">${secCell(b, r, k, s.id)}</td>`); return 1; };
  const addBand = (k, n) => { if (n > 0) { const sec = SECS.find(x => x[0] === k) || [k, 'คะแนนรวมแต่ละส่วน'];
    band.push(`<th class="sec-h s-${k}" colspan="${n}">${sec[1]}${k !== 'sum' ? ` <span class="muted small">${fmt(secMaxOf(b, k))}%</span>` : ''}</th>`); } };
  if (V === 'sum') { let n = 0; SECS.forEach(([k]) => { n += totCol(k, true); }); addBand('sum', n); }
  else {
    if (want('before')) { let n = 0; itemsOf('before').forEach(it => { n += unitCols(it); }); if (V === 'some' && n) n += totCol('before'); addBand('before', n); }
    if (want('mid') && hasMid) { const ci = col++; let n = 1;
      rowB.push(`<th class="exam-h s-mid" rowspan="2">สอบกลางภาค<br><span class="muted small">เต็ม ${fmt(b.exams.midMax)} · ${fmt(b.weights.mid)}%</span>${srcTag(b, 'mid')}</th>`);
      cells.push(({ s, ri }) => { const ex = b.exam[s.id] || {}, lk = lockedExam(b, 'mid', s.id); return `<td class="exam s-mid"><input class="in cell${lowCls(ex.mid, num(b.exams.midMax))}${lk ? ' locked' : ''}" ${lk ? 'readonly title="คะแนนจากฝ่ายวัดผล — แก้ได้ที่ฝ่ายวัดผล"' : ''} inputmode="decimal" data-r="${ri}" data-c="${ci}" data-max="${num(b.exams.midMax)}" data-label="กลางภาค" data-bk="exam" data-f="mid" data-sid="${s.id}" value="${has(ex.mid) ? esc(ex.mid) : ''}" aria-label="กลางภาค ${esc(s.name)}"></td>`; });
      if (showRt) { n++; rowB.push('<th class="exam-h s-mid" rowspan="2">ซ่อมกลางภาค</th>');
        cells.push(({ s, r }) => { const ex = b.exam[s.id] || {}; return `<td class="exam s-mid">${r.midFailed ? rtBox(ex.retake, `data-bk="exam" data-f="retake" data-sid="${s.id}"`, num(b.exams.midMax), 'ซ่อมกลางภาค ' + esc(s.name)) : '<span class="muted">–</span>'}</td>`; }); }
      if (V === 'some') n += totCol('mid'); addBand('mid', n); }
    if (want('after')) { let n = 0; itemsOf('after').forEach(it => { n += unitCols(it); }); if (V === 'some' && n) n += totCol('after'); addBand('after', n); }
    if (want('final') && hasFin) { const ci = col++; let n = 1;
      rowB.push(`<th class="exam-h s-final" rowspan="2">สอบปลายภาค<br><span class="muted small">เต็ม ${fmt(b.exams.finalMax)} · ${fmt(b.weights.final)}%</span>${srcTag(b, 'final')}</th>`);
      cells.push(({ s, ri }) => { const ex = b.exam[s.id] || {}, lk = lockedExam(b, 'final', s.id); return `<td class="exam s-final"><input class="in cell${lowCls(ex.final, num(b.exams.finalMax))}${lk ? ' locked' : ''}" ${lk ? 'readonly title="คะแนนจากฝ่ายวัดผล — แก้ได้ที่ฝ่ายวัดผล"' : ''} inputmode="decimal" data-r="${ri}" data-c="${ci}" data-max="${num(b.exams.finalMax)}" data-label="ปลายภาค" data-bk="exam" data-f="final" data-sid="${s.id}" value="${has(ex.final) ? esc(ex.final) : ''}" aria-label="ปลายภาค ${esc(s.name)}"></td>`; });
      if (V === 'some') n += totCol('final'); addBand('final', n); }
  }
  const tailStatus = showStatus && V === 'all' && !UN;
  const on = k => k === 'all' ? V === 'all' : k === 'sum' ? V === 'sum' : V === 'some' && SEL.indexOf(k) >= 0;
  const nB = itemsOf('before').length, nA = itemsOf('after').length;
  const views = [['all', 'ทั้งหมด', ''], ['before', 'ก่อนกลางภาค', nB + ' หน่วย · ' + fmt(b.weights.before) + '%'], ['mid', 'กลางภาค', hasMid ? fmt(b.weights.mid) + '%' : 'ไม่มีสอบ'],
    ['after', 'หลังกลางภาค', nA + ' หน่วย · ' + fmt(b.weights.after) + '%'], ['final', 'ปลายภาค', hasFin ? fmt(b.weights.final) + '%' : 'ไม่มีสอบ'], ['sum', 'คะแนนรวมแต่ละส่วน', '']];
  const empty = !cells.length ? `<div class="empty">ส่วนนี้ยังไม่มีหัวข้อคะแนน — เพิ่มได้ที่ “หัวข้อคะแนน”</div>` : '';
  return pre +
    `${unitBar(b, hasMid, hasFin)}<div class="sc-views" role="group" aria-label="เลือกส่วนของคะแนน (เลือกได้หลายส่วน)">${views.map(([k, l, sub]) => `<button class="sc-view s-${k}" aria-pressed="${on(k)}" data-bkv="${k}">${on(k) && k !== 'all' && k !== 'sum' ? '✓ ' : ''}${l}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div></div>
    <div class="card sc-card">${empty || `<div class="scroll sc-scroll" id="scScroll"><table class="tbl sc-tbl" id="scGrid" data-view="${V}"><thead>
      <tr><th class="k1" rowspan="3">ที่</th><th class="k2" rowspan="3">ชื่อ-สกุล</th>${band.join('')}${tailStatus ? SECS.map(([k, l]) => `<th rowspan="3" class="st-h">${l.replace('ภาค', '')}</th>`).join('') : ''}
        <th rowspan="3" class="tot-h r-tot">รวม<br><span class="muted small">/100</span></th><th rowspan="3" class="r-gr">เกรด</th></tr>
      <tr>${rowB.join('')}</tr><tr>${rowC.join('')}</tr></thead><tbody>
    ${rows.map(({ s, r }, ri) => `<tr data-sid="${s.id}"><td class="muted k1">${s.no}</td><td class="k2">${esc(s.name)}</td>${cells.map(f => f({ s, r, ri })).join('')}
      ${tailStatus ? ['passBefore', 'passM', 'passAfter', 'passF'].map(k => `<td data-ps="${s.id}|${k}">${sChip(r[k])}</td>`).join('') : ''}
      <td class="tot r-tot"><b data-tot="${s.id}" class="${r.any && P_().get('redLow') && r.total < passP ? 'low-t' : ''}">${r.any ? r.total : '–'}</b></td>
      <td class="r-gr"><span class="chip ${r.any ? (r.passed ? 'ok' : 'bad') : ''}" data-gr="${s.id}">${r.any ? esc(r.grade) : '–'}</span></td></tr>`).join('')}
    </tbody></table></div>`}</div>
    <div class="muted small" style="margin-top:8px">หัวข้อประเภท “สอบ” มีคอลัมน์ซ่อม กรอกได้เมื่อนักเรียนได้ต่ำกว่าเกณฑ์ผ่าน ${fmt(passP)}% · กด + เพื่อซ่อมครั้งถัดไป ระบบเก็บทุกครั้งไว้ดูพัฒนาการ และใช้ครั้งที่ได้สูงสุดคิดคะแนน · กรอกเกินคะแนนเต็มระบบจะปรับให้เท่าคะแนนเต็ม · เปิด/ปิดการแสดงผ่าน-ไม่ผ่านและสีแดงได้ที่ “ปรับแต่งการแสดงผล”</div>`;
};
function ksaModal(sid, itId) {
  const c = cur(), b = book(c.id), it = b.items.find(x => x.id === itId), s = c.students.find(x => x.id === sid); if (!it || !s) return;
  const v = ((b.componentScores[sid] || {})[itId]) || {};
  modal(`<h2 style="margin-bottom:4px">${esc(it.name)}</h2><div class="muted" style="margin-bottom:12px">${esc(s.name)}</div>
    ${comps(it).map(k => `<div class="field"><label class="f" for="ks-${k.key}">${esc(subName(k, b))} <span class="muted">(เต็ม ${fmt(k.rawMax)} → ให้ ${fmt(k.max)})</span></label>
      <input id="ks-${k.key}" class="in" inputmode="decimal" data-ks="${k.key}" data-max="${k.rawMax}" value="${has(v[k.key]) ? esc(v[k.key]) : ''}"></div>`).join('')}
    <button class="btn pri" style="width:100%" data-bk="ksaSave" data-sid="${sid}" data-it="${itId}">บันทึก</button>`, true);
}

/* ============================================================
   คะแนนกลุ่ม
   ============================================================ */
const parseNos = (text, maxNo) => {
  const out = new Set();
  String(text).split(/[,\s]+/).forEach(p => { if (!p) return; const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { for (let i = +m[1]; i <= +m[2]; i++) if (i >= 1 && i <= maxNo) out.add(i); } else { const n = parseInt(p, 10); if (n >= 1 && n <= maxNo) out.add(n); } });
  return [...out].sort((a, b) => a - b);
};
const byNoOf = c => { const m = {}; c.students.forEach(s => m[s.no] = s); return m; };
function reapply(b, gs, g, byNo) {
  b.items.filter(it => it.kind === 'group' && it.groupSetId === gs.id).forEach(it => {
    const v = (b.gscores[it.id] || {})[g.id]; if (!has(v)) return;
    g.members.forEach(n => { const s = byNo[n]; if (s) (b.scores[s.id] = b.scores[s.id] || {})[it.id] = num(v); });
  });
}
P.groups = () => {
  const c = cur(), b = book(c.id), st = c.students.slice().sort((a, z) => a.no - z.no), byNo = byNoOf(c);
  const pre = head2('คะแนนกลุ่ม', 'จัดกลุ่มนักเรียน ลงคะแนนครั้งเดียว ระบบกระจายให้สมาชิกทุกคน',
    `<button class="btn" data-bk="gsCopy">คัดลอกจากชุดเดิม</button><button class="btn pri" data-bk="gsAdd">${ic('plus')}สร้างชุดกลุ่ม</button>`) + clsPills();
  if (!st.length) return pre + '<div class="card empty">ยังไม่มีรายชื่อนักเรียน — นำเข้าที่เมนู “นำเข้าข้อมูล”</div>';
  const pc = {}; Object.values(b.presenters || {}).forEach(o => Object.values(o || {}).forEach(a => (a || []).forEach(id => { pc[id] = (pc[id] || 0) + 1; })));
  const sets = b.groupSets.map(gs => {
    const used = {}; gs.groups.forEach(g => g.members.forEach(n => { used[n] = (used[n] || 0) + 1; }));
    const missing = st.filter(s => !used[s.no]).map(s => s.no), dup = Object.keys(used).filter(n => used[n] > 1);
    const gitems = b.items.filter(it => it.kind === 'group' && it.groupSetId === gs.id);
    return `<div class="card" data-gs="${gs.id}">
      <div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><input class="in" style="max-width:260px;font-weight:700" data-bk="gsName" data-gs="${gs.id}" value="${esc(gs.name)}" aria-label="ชื่อชุดกลุ่ม">
        <span class="chip info">${gs.groups.length} กลุ่ม</span>${gitems.length ? `<span class="chip">ใช้กับ ${gitems.length} หัวข้อ</span>` : '<span class="chip warn">ยังไม่มีหัวข้อที่ใช้ชุดนี้</span>'}
        <span class="grow"></span>
        <button class="btn sm" data-bk="gAddGrp" data-gs="${gs.id}">+ เพิ่มกลุ่ม</button><button class="btn sm" data-bk="gAuto" data-gs="${gs.id}">แบ่งอัตโนมัติ</button>
        <button class="btn sm" data-bk="gClone" data-gs="${gs.id}">ทำสำเนา</button><button class="btn sm ghost" style="color:var(--bad)" data-bk="gsDel" data-gs="${gs.id}">ลบชุดนี้</button></div>
      ${missing.length ? `<div class="notice">ยังไม่ได้จัดกลุ่ม: เลขที่ ${missing.join(', ')}</div>` : ''}${dup.length ? `<div class="notice bad">เลขที่อยู่หลายกลุ่ม: ${dup.join(', ')}</div>` : ''}
      ${gs.groups.length ? gs.groups.map(g => `<div class="bk-grp" data-g="${g.id}"><div class="gh">
          <input class="in" style="max-width:180px" data-bk="gName" data-gs="${gs.id}" data-g="${g.id}" value="${esc(g.name)}" aria-label="ชื่อกลุ่ม">
          <span class="chip">${g.members.length} คน</span>
          <input class="in" style="flex:1;min-width:160px" placeholder="พิมพ์เลขที่ เช่น 1-5, 8" data-bk="gRange" data-gs="${gs.id}" data-g="${g.id}" value="${esc(g.members.join(', '))}" aria-label="เลขที่สมาชิก">
          <button class="btn sm ghost" style="color:var(--bad)" data-bk="gDelGrp" data-gs="${gs.id}" data-g="${g.id}">ลบกลุ่ม</button></div>
        <div class="bk-chips">${st.map(s => { const on = g.members.indexOf(s.no) >= 0, taken = !on && used[s.no];
          return `<button class="bk-chip${on ? ' on' : ''}${taken ? ' taken' : ''}" data-bk="gChip" data-gs="${gs.id}" data-g="${g.id}" data-no="${s.no}" title="${esc(s.no + ' ' + s.name)}" aria-pressed="${on}">${s.no}</button>`; }).join('')}</div>
        <div class="muted small">${g.members.length ? g.members.map(n => byNo[n] ? esc(byNo[n].name) : 'เลขที่ ' + n).join(' · ') : 'ยังไม่มีสมาชิก'}</div>
        ${gitems.map(it => { const v = (b.gscores[it.id] || {})[g.id], sel = (b.presenters[it.id] || {})[g.id] || [];
          const mem = g.members.map(n => byNo[n]).filter(Boolean), all = mem.length && mem.every(s => sel.indexOf(s.id) >= 0);
          return `<div class="row" style="flex-wrap:wrap;margin-top:6px"><div><label class="f" for="gs-${it.id}-${g.id}">${esc(it.name)} <span class="muted">(เต็ม ${fmt(entryMax(it))})</span></label>
            <input id="gs-${it.id}-${g.id}" class="in" style="width:90px;text-align:center" inputmode="decimal" data-bk="gScore" data-gs="${gs.id}" data-g="${g.id}" data-it="${it.id}" value="${has(v) ? esc(v) : ''}"></div>
            <div class="grow"><div class="muted small">ผู้นำเสนอ</div><div class="bk-chips" style="margin:4px 0 0">
            <button class="btn sm ${all ? 'pri' : ''}" data-bk="gAllPres" data-gs="${gs.id}" data-g="${g.id}" data-it="${it.id}">ทั้งกลุ่ม${all ? ' ✓' : ''}</button>
            ${mem.map(s => `<button class="bk-chip${sel.indexOf(s.id) >= 0 ? ' on' : ''}" style="min-width:32px;height:32px" data-bk="gPres" data-g="${g.id}" data-it="${it.id}" data-sid="${s.id}" title="${esc(s.name)}" aria-pressed="${sel.indexOf(s.id) >= 0}">${s.no}</button>`).join('')}</div></div></div>`; }).join('')}
        ${gitems.length ? `<div class="muted small" style="margin-top:8px">นำเสนอสะสม: ${g.members.map(n => byNo[n]).filter(Boolean).map(s => `${esc(s.name.split(' ')[0])} <span class="chip ${pc[s.id] ? 'ok' : 'warn'}">${pc[s.id] || 0}</span>`).join(' ')}</div>` : ''}
      </div>`).join('') : '<div class="empty">ยังไม่มีกลุ่มในชุดนี้ — กด “+ เพิ่มกลุ่ม” หรือ “แบ่งอัตโนมัติ”</div>'}
    </div>`;
  }).join('');
  return pre + (b.groupSets.length ? sets : '<div class="card empty">ยังไม่มีชุดกลุ่ม<br><span class="small">กด “สร้างชุดกลุ่ม” แล้วไปตั้งหัวข้อคะแนนประเภท “กลุ่ม” ที่เมนูหัวข้อคะแนน</span></div>');
};
function cloneSet(b, src, c, name) {
  const valid = new Set(c.students.map(s => s.no)), taken = new Set();
  const groups = (src.groups || []).map((g, i) => { const m = []; (g.members || []).forEach(n => { n = num(n); if (valid.has(n) && !taken.has(n)) { taken.add(n); m.push(n); } });
    return { id: uid('g'), name: g.name || 'กลุ่มที่ ' + (i + 1), members: m.sort((a, z) => a - z) }; });
  const copy = { id: uid('gs'), name: name || src.name + ' (สำเนา)', groups }; b.groupSets.push(copy); return copy;
}

/* ============================================================
   ตัวชี้วัด / ผลการเรียนรู้
   ============================================================ */
let DB1 = null, DB2 = null;
const loadJSON = (url, setter, cache) => cache ? Promise.resolve(cache) : fetch(url).then(r => { if (!r.ok) throw new Error('โหลดไม่สำเร็จ (' + r.status + ')'); return r.json(); }).then(d => { setter(d); return d; });
const loadCore = () => loadJSON('data/indicators.json', d => { DB1 = d; }, DB1);
const loadExtra = () => loadJSON('data/indicators-extra.json', d => { DB2 = d; }, DB2);
const levelOf = name => { const m = String(name).replace(/\s+/g, '').match(/ม\.?([1-6])/); return m ? 'ม.' + m[1] : ''; };
const levelMatch = (il, cl) => !cl || il === cl || (il === 'ม.4-6' && ['ม.4', 'ม.5', 'ม.6'].indexOf(cl) >= 0);
const guessArea = subj => ({ 'ว': 'SC', 'ค': 'MA', 'ท': 'TH', 'ส': 'SO', 'พ': 'HP', 'ศ': 'AR', 'ง': 'OT', 'อ': 'FL', 'จ': 'FL' })[String(subj).trim().charAt(0)] || 'SC';
const newInd = x => ({ id: uid('ind'), code: x.code || '', text: x.text || '', kind: x.kind === 'S' ? 'S' : 'F', hours: x.hours == null ? '' : x.hours, score: x.score == null ? '' : x.score, src: x.src || 'own', std: x.std || '', strand: x.strand || '' });
const addInds = (b, list) => { const have = new Set(b.indicators.map(r => (r.code || '') + '|' + (r.text || ''))); let n = 0;
  list.forEach(x => { const k = (x.code || '') + '|' + (x.text || ''); if (have.has(k)) return; have.add(k); b.indicators.push(newInd(x)); n++; }); return n; };

P.indicators = () => {
  const c = cur(), b = book(c.id), rows = b.indicators = Array.isArray(b.indicators) ? b.indicators : [];
  const core = rows.filter(r => r.src === 'core').length, ipst = rows.filter(r => r.src === 'ipst').length;
  const sum = k => rows.reduce((a, r) => a + num(r[k]), 0);
  return head2('ตัวชี้วัด / ผลการเรียนรู้', 'ตัวชี้วัดที่วิชานี้ใช้วัดผล ใช้ต่อในแผนการสอนและรายงาน') + clsPills() +
    `<div class="card"><h2>เพิ่มตัวชี้วัดเข้าวิชานี้</h2><div class="grid g4">
      ${[['indCore', 'เลือกจากหลักสูตร', 'วิชาพื้นฐาน ฐานตัวชี้วัดของโรงเรียน', 'book'], ['indExtra', 'ผลการเรียนรู้ สสวท.', 'วิชาเพิ่มเติม ม.ปลาย ฟิสิกส์ เคมี ชีววิทยา', 'target'],
         ['indPaste', 'พิมพ์เอง / วางจาก Excel', 'วางทีเดียวได้ทั้งตาราง', 'form'], ['indCopy', 'คัดลอกไปห้องอื่น', 'ใช้ชุดเดียวกันกับห้องอื่น', 'swap']]
        .map(([k, t, s, i]) => `<button class="action" data-bk="${k}"><span class="ico">${ic(i)}</span><b>${t}</b><span class="muted small">${s}</span></button>`).join('')}
    </div></div>
    <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><h2 style="margin:0">ชุดตัวชี้วัดของวิชานี้</h2><span class="grow"></span>
      <span class="chip">หลักสูตร ${core}${ipst ? ' · สสวท. ' + ipst : ''} · เขียนเอง ${rows.length - core - ipst}</span>
      ${rows.length ? '<button class="btn sm ghost" style="color:var(--bad)" data-bk="indClear">ล้างทั้งหมด</button>' : ''}</div>
      ${rows.length ? `<div class="stat-row"><span>รวม <b>${rows.length}</b> ข้อ</span><span>กลางทาง <b>${rows.filter(r => r.kind !== 'S').length}</b></span><span>ปลายทาง <b>${rows.filter(r => r.kind === 'S').length}</b></span><span>เวลารวม <b>${fmt(sum('hours'), 1)}</b> ชม.</span><span>คะแนนรวม <b>${fmt(sum('score'), 1)}</b></span></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>ที่</th><th>รหัส</th><th>ตัวชี้วัด / ผลการเรียนรู้</th><th>ประเภท</th><th>เวลา</th><th>คะแนน</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr data-ind="${r.id}"><td class="muted">${i + 1}</td>
        <td><input class="in" style="width:120px" data-bk="indCode" data-id="${r.id}" value="${esc(r.code)}" aria-label="รหัส"></td>
        <td><textarea class="in" style="min-width:260px;min-height:64px" data-bk="indText" data-id="${r.id}" aria-label="ข้อความตัวชี้วัด">${esc(r.text)}</textarea>${r.std ? `<div class="muted small">${esc(r.std + (r.strand ? ' · ' + r.strand : ''))}</div>` : ''}</td>
        <td><select class="in" style="width:110px" data-bk="indKind" data-id="${r.id}"><option value="F" ${r.kind !== 'S' ? 'selected' : ''}>กลางทาง</option><option value="S" ${r.kind === 'S' ? 'selected' : ''}>ปลายทาง</option></select></td>
        <td><input class="in" style="width:70px;text-align:center" inputmode="decimal" data-bk="indHours" data-id="${r.id}" value="${esc(r.hours)}" aria-label="เวลา"></td>
        <td><input class="in" style="width:70px;text-align:center" inputmode="decimal" data-bk="indScore" data-id="${r.id}" value="${esc(r.score)}" aria-label="คะแนน"></td>
        <td style="white-space:nowrap"><button class="btn sm ghost" data-bk="indUp" data-id="${r.id}" aria-label="เลื่อนขึ้น">↑</button><button class="btn sm ghost" data-bk="indDown" data-id="${r.id}" aria-label="เลื่อนลง">↓</button><button class="btn sm ghost" style="color:var(--bad)" data-bk="indDel" data-id="${r.id}">ลบ</button></td></tr>`).join('')}
      </tbody></table></div><div style="margin-top:10px"><button class="btn sm" data-bk="indAdd">+ เพิ่มบรรทัดว่าง</button> <span class="muted small">แก้ในตารางได้เลย บันทึกให้อัตโนมัติ</span></div>`
      : '<div class="empty">ยังไม่มีตัวชี้วัดในวิชานี้<br><span class="small">เลือกจากหลักสูตรถ้าเป็นวิชาพื้นฐาน หรือพิมพ์/วางเองถ้าเป็นวิชาเพิ่มเติม</span></div>'}</div>`;
};

/* ---------- ตัวเลือกจากหลักสูตร ---------- */
async function openCorePicker() {
  let db; try { db = await loadCore(); } catch (e) { return toast('โหลดฐานตัวชี้วัดไม่สำเร็จ — เปิดผ่านเว็บเซิร์ฟเวอร์เท่านั้น'); }
  const c = cur(), b = book(c.id), have = new Set(b.indicators.map(r => r.code));
  const st = { area: guessArea(c.subject), level: levelOf(c.name) || 'ม.1', q: '' };
  modal(`<h2 style="margin-bottom:10px">เลือกตัวชี้วัดจากหลักสูตร</h2>
    <div class="grid g3" style="margin-bottom:8px"><select id="pk-a" class="in" aria-label="กลุ่มสาระ">${db.areas.map(a => `<option value="${a.code}" ${a.code === st.area ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
    <select id="pk-l" class="in" aria-label="ระดับชั้น">${['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].map(l => `<option ${l === st.level ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input id="pk-q" class="in" type="search" placeholder="ค้นหารหัสหรือข้อความ" aria-label="ค้นหา"></div>
    <div style="display:flex;gap:8px;align-items:center"><button class="btn sm" id="pk-all">เลือกทั้งหมดที่เห็น</button><span class="grow"></span><span class="muted small" id="pk-n"></span></div>
    <div id="pk-list" style="max-height:52vh;overflow:auto;margin-top:6px"></div>
    <button class="btn pri" style="width:100%;margin-top:12px" id="pk-ok">เพิ่มที่เลือก</button>`, true); wide();
  const list = () => {
    const q = st.q.toLowerCase(), items = db.items.filter(x => x.a === st.area && levelMatch(x.l, st.level) && (!q || (x.c + ' ' + x.t + ' ' + x.sd).toLowerCase().includes(q)));
    const groups = []; items.forEach(x => { const k = x.sd + '::' + x.st; let g = groups.find(y => y.k === k); if (!g) groups.push(g = { k, sd: x.sd, st: x.st, items: [] }); g.items.push(x); });
    $('#pk-n').textContent = items.length + ' ข้อ';
    $('#pk-list').innerHTML = groups.map(g => `<div class="pk-grp">${esc(g.sd || 'ไม่ระบุสาระ')} <span class="muted small">${esc(g.st)} · ${g.items.length} ข้อ</span></div>` +
      g.items.map(x => `<label class="pk-item${have.has(x.c) ? ' used' : ''}"><input type="checkbox" class="pk-c" value="${esc(x.c)}" ${have.has(x.c) ? 'disabled' : ''}><div><b>${esc(x.c)}</b> <span class="chip ${x.k === 'S' ? 'gold' : 'info'}">${IKIND[x.k]}</span><div>${esc(x.t)}</div>${have.has(x.c) ? '<div class="small" style="color:var(--ok)">เพิ่มไว้แล้ว</div>' : ''}</div></label>`).join('')).join('') || '<div class="empty">ไม่พบตัวชี้วัดตามเงื่อนไขที่เลือก</div>';
  };
  list();
  $('#pk-a').onchange = e => { st.area = e.target.value; list(); }; $('#pk-l').onchange = e => { st.level = e.target.value; list(); };
  $('#pk-q').oninput = e => { st.q = e.target.value; list(); };
  $('#pk-all').onclick = () => document.querySelectorAll('.pk-c').forEach(x => { if (!x.disabled) x.checked = true; });
  $('#pk-ok').onclick = () => {
    const picked = [...document.querySelectorAll('.pk-c')].filter(x => x.checked).map(x => x.value);
    if (!picked.length) return toast('ยังไม่ได้เลือกตัวชี้วัด');
    const by = new Map(db.items.map(x => [x.c, x]));
    const n = addInds(b, picked.map(code => { const x = by.get(code) || {}; return { code, text: x.t, kind: x.k, score: x.w, src: 'core', std: x.st, strand: x.sd }; }));
    save(); closeModal(); toast('เพิ่มตัวชี้วัดจากหลักสูตร ' + n + ' ข้อ'); redraw();
  };
}
async function openExtraPicker() {
  let db; try { db = await loadExtra(); } catch (e) { return toast('โหลดฐานผลการเรียนรู้ไม่สำเร็จ — เปิดผ่านเว็บเซิร์ฟเวอร์เท่านั้น'); }
  const c = cur(), b = book(c.id), have = new Set(b.indicators.map(r => r.code)), upper = ['ม.4', 'ม.5', 'ม.6'];
  const subj = String(c.subject);
  const guess = (db.courses.find(x => subj.includes(x.name)) || db.courses[0]).code;
  const st = { course: guess, level: upper.indexOf(levelOf(c.name)) >= 0 ? levelOf(c.name) : 'ม.4', q: '' };
  const courseOf = code => db.courses.find(x => x.code === code) || {};
  modal(`<h2 style="margin-bottom:10px">ผลการเรียนรู้ สสวท. (วิชาเพิ่มเติม ม.ปลาย)</h2>
    <div class="grid g3" style="margin-bottom:8px"><select id="px-c" class="in" aria-label="รายวิชา">${db.courses.map(x => `<option value="${x.code}" ${x.code === st.course ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <select id="px-l" class="in" aria-label="ระดับชั้น">${upper.map(l => `<option ${l === st.level ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input id="px-q" class="in" type="search" placeholder="ค้นหา" aria-label="ค้นหา"></div>
    <div class="muted small">ตามหลักสูตรแกนกลางฯ ฉบับปรับปรุง พ.ศ. 2560 ของ สสวท. มีเฉพาะ ม.4–ม.6 เป็นข้อเสนอแนะ เลือกใช้เท่าที่สอนจริง</div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="btn sm" id="px-all">เลือกทั้งหมดที่เห็น</button><span class="grow"></span><span class="muted small" id="px-n"></span></div>
    <div id="px-list" style="max-height:48vh;overflow:auto;margin-top:6px"></div>
    <button class="btn pri" style="width:100%;margin-top:12px" id="px-ok">เพิ่มที่เลือก</button>`, true); wide();
  const codeOf = (course, x) => (course.pf || '') + x.g + '/' + x.n;
  const list = () => {
    const course = courseOf(st.course), q = st.q.toLowerCase();
    const items = db.items.filter(x => x.c === st.course && x.l === st.level && (!q || (codeOf(course, x) + ' ' + x.t).toLowerCase().includes(q)));
    const groups = []; items.forEach(x => { let g = groups.find(y => y.g === x.g); if (!g) groups.push(g = { g: x.g, h: (db.groups.find(z => z.c === x.c && z.g === x.g) || {}).h || '', items: [] }); g.items.push(x); });
    $('#px-n').textContent = items.length + ' ข้อ';
    $('#px-list').innerHTML = groups.map(g => `<div class="pk-grp">${esc(String(g.h).split(' — ')[0])}</div><div class="muted small">${esc(String(g.h).split(' — ').slice(1).join(' — '))}</div>` +
      g.items.map(x => { const code = codeOf(course, x); return `<label class="pk-item${have.has(code) ? ' used' : ''}"><input type="checkbox" class="px-c" value="${x.g}.${x.n}" ${have.has(code) ? 'disabled' : ''}><div><b>${esc(code)}</b> <span class="chip info">ผลการเรียนรู้ที่ ${x.n}</span><div>${esc(x.t)}</div></div></label>`; }).join('')).join('') || '<div class="empty">ไม่พบผลการเรียนรู้ตามเงื่อนไข</div>';
  };
  list();
  $('#px-c').onchange = e => { st.course = e.target.value; list(); }; $('#px-l').onchange = e => { st.level = e.target.value; list(); };
  $('#px-q').oninput = e => { st.q = e.target.value; list(); };
  $('#px-all').onclick = () => document.querySelectorAll('.px-c').forEach(x => { if (!x.disabled) x.checked = true; });
  $('#px-ok').onclick = () => {
    const picked = [...document.querySelectorAll('.px-c')].filter(x => x.checked).map(x => x.value);
    if (!picked.length) return toast('ยังไม่ได้เลือกผลการเรียนรู้');
    const course = courseOf(st.course);
    const n = addInds(b, picked.map(v => { const [g, nn] = v.split('.').map(Number); const x = db.items.find(i => i.c === st.course && i.l === st.level && i.g === g && i.n === nn) || {};
      return { code: codeOf(course, { g, n: nn }), text: x.t, kind: 'F', src: 'ipst', std: course.name, strand: 'สาระ' + course.name + ' ข้อ ' + g }; }));
    save(); closeModal(); toast('เพิ่มผลการเรียนรู้ ' + n + ' ข้อ'); redraw();
  };
}

/* ============================================================
   เหตุการณ์
   ============================================================ */
const clamp = (el, max) => {
  let raw = el.value.trim().replace(/[^\d.]/g, ''), v = raw === '' ? '' : num(raw);
  if (v !== '' && max > 0 && v > max) { v = max; el.value = String(max); toast('คะแนนเต็มของช่องนี้คือ ' + fmt(max) + ' (ปรับให้อัตโนมัติ)'); }
  else if (raw !== el.value) el.value = raw;
  return v;
};
let bulk = false;      // กำลังวางหลายช่อง: ห้ามวาดตารางใหม่กลางทาง
const markLow = (el, v, max, b) => el.classList.toggle('low', isLow(v, max, b));
const refreshRow = (b, c, sid) => {
  const s = c.students.find(x => x.id === sid), r = calcRow(b, s);
  const t = document.querySelector(`[data-tot="${sid}"]`), g = document.querySelector(`[data-gr="${sid}"]`);
  if (t) { t.textContent = r.any ? r.total : '–'; t.classList.toggle('low-t', !!(r.any && P_().get('redLow') && r.total < num(b.passPercent))); }
  if (g) { g.textContent = r.any ? r.grade : '–'; g.className = 'chip ' + (r.any ? (r.passed ? 'ok' : 'bad') : ''); }
  ['passBefore', 'passM', 'passAfter', 'passF'].forEach(k => { const cell = document.querySelector(`[data-ps="${sid}|${k}"]`); if (cell) cell.innerHTML = sChip(r[k]); });
  SECS.forEach(([k]) => { const cell = document.querySelector(`[data-st="${sid}|${k}"]`); if (cell) cell.innerHTML = secCell(b, r, k, sid); });
  return r;
};

document.addEventListener('click', async e => {
  const t = e.target.closest('button[data-bk]'); if (!t) return;
  const a = t.dataset.bk, d = t.dataset, c = cur(), b = book(c.id);
  const item = () => b.items.find(x => x.id === d.it);
  const gset = () => b.groupSets.find(x => x.id === d.gs);
  const grp = () => (gset() || { groups: [] }).groups.find(x => x.id === d.g);
  switch (a) {
    case 'cls': curId = d.k; return redraw();
    case 'goItems': return go('items');
    case 'exportScores': return window.EMSExport ? window.EMSExport.sheet(c.id) : toast('ยังไม่พร้อมส่งออก');
    case 'voice': return window.ScoreVoice ? ScoreVoice.toggle() : toast('ฟังก์ชันเสียงยังไม่พร้อม');
    /* หัวข้อคะแนน */
    case 'itAdd': b.items.push({ id: uid('it'), name: 'หน่วยที่ ' + (b.items.length + 1), max: 10, kind: 'individual', groupSetId: '', components: [], scoreSection: 'before' }); save(); return redraw();
    case 'itMany': return modal(`<h2 style="margin-bottom:8px">เพิ่มหลายหัวข้อ</h2><p class="muted small" style="margin-bottom:8px">พิมพ์ชื่อหัวข้อบรรทัดละ 1 ชื่อ ใส่คะแนนเต็มต่อท้ายด้วย , เช่น <code>งาน 1, 10</code></p>
      <textarea id="mm" class="in" rows="8" placeholder="งาน 1, 10&#10;สอบหน่วย 1, 10&#10;ใบงานที่ 2, 5"></textarea><button class="btn pri" style="width:100%;margin-top:12px" data-bk="itManySave">เพิ่ม</button>`, true);
    case 'itManySave': { const lines = $('#mm').value.split('\n').map(s => s.trim()).filter(Boolean);
      lines.forEach(l => { const p = l.split(','), nm = p[0].trim(); if (nm) b.items.push({ id: uid('it'), name: nm, max: num(p[1]) || 10, kind: 'individual', groupSetId: '', components: [], scoreSection: 'before' }); });
      save(); closeModal(); toast('เพิ่ม ' + lines.length + ' หัวข้อ'); return redraw(); }
    case 'itReuse': { const src = tCls().filter(x => x.id !== c.id && book(x.id).items.length);
      return modal(`<h2 style="margin-bottom:8px">ใช้รูปแบบของห้องอื่น</h2><p class="muted small" style="margin-bottom:10px">คัดลอกหัวข้อ น้ำหนัก และเกณฑ์เกรด (ไม่คัดลอกคะแนนนักเรียน) มาแทนที่ของ ${esc(c.name)}</p>
        ${src.length ? src.map(x => `<button class="nav" data-bk="itReuseDo" data-k="${x.id}"><span>${esc(x.name)} · ${esc(x.subject)} <span class="muted small">(${book(x.id).items.length} หัวข้อ)</span></span></button>`).join('') : '<div class="empty">ยังไม่มีห้องอื่นที่ตั้งหัวข้อไว้</div>'}`, true); }
    case 'itReuseDo': { const s = book(d.k); if (!await confirmBox('ใช้รูปแบบนี้', 'หัวข้อคะแนนเดิมของ <b>' + esc(c.name) + '</b> จะถูกแทนที่ และคะแนนที่กรอกไว้จะถูกล้าง', 'ใช้รูปแบบนี้')) return;
      const b = book(c.id);      // หยิบสมุดฉบับล่าสุดหลังรอยืนยัน (ระหว่างรอ ข้อมูลจากระบบอาจแทนสมุดในเครื่อง การแก้ฉบับเก่าจะหายเงียบ)
      b.items = s.items.map(i => Object.assign(JSON.parse(JSON.stringify(i)), { id: uid('it'), groupSetId: '', kind: i.kind === 'group' ? 'individual' : i.kind }));
      b.exams = JSON.parse(JSON.stringify(s.exams)); b.weights = JSON.parse(JSON.stringify(s.weights)); b.gradeScale = JSON.parse(JSON.stringify(s.gradeScale)); b.passPercent = s.passPercent;
      b.scores = {}; b.componentScores = {}; b.itemRetakes = {}; b.exam = {}; b.gscores = {}; b.presenters = {};
      save(); closeModal(); toast('คัดลอกรูปแบบแล้ว'); return redraw(); }
    case 'itUp': case 'itDown': { const i = b.items.findIndex(x => x.id === d.it), j = a === 'itUp' ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= b.items.length) return;
      [b.items[i], b.items[j]] = [b.items[j], b.items[i]]; save(); return redraw(); }
    case 'itDel': { const it = item(); if (!it || !await confirmBox('ลบหัวข้อ', 'ลบ <b>' + esc(it.name) + '</b> พร้อมคะแนนของนักเรียนทุกคนในหัวข้อนี้?', 'ลบ')) return;
      const b = book(c.id);      // หยิบสมุดฉบับล่าสุดหลังรอยืนยัน (ระหว่างรอ ข้อมูลจากระบบอาจแทนสมุดในเครื่อง การแก้ฉบับเก่าจะหายเงียบ)
      b.items = b.items.filter(x => x.id !== it.id);
      Object.keys(b.scores).forEach(s => delete b.scores[s][it.id]); Object.keys(b.itemRetakes).forEach(s => { const m = b.itemRetakes[s]; if (m) Object.keys(m).forEach(k => { if (k === it.id || k.indexOf(it.id + '~') === 0) delete m[k]; }); });      // รวมซ่อมรายช่อง (หน่วย~ช่อง)
      Object.keys(b.componentScores).forEach(s => b.componentScores[s] && delete b.componentScores[s][it.id]); delete b.gscores[it.id]; delete b.presenters[it.id];
      save(); return redraw(); }
    case 'itEdit': return openItemEdit(d.it);
    case 'itEditSave': { const it = item(); if (!it) return;
      it.name = $('#ie-n').value.trim() || it.name; const w = $('#ie-w').value.trim().slice(0, 60); if (w) it.work = w; else delete it.work;
      if ($('#ie-r')) { const r = num($('#ie-r').value); if (r > 0) it.rawMax = r; else delete it.rawMax; }
      if ($('#ie-t')) { const r = num($('#ie-t').value); if (r > 0) it.retakeMax = r; else delete it.retakeMax; }
      save(); closeModal(); toast('บันทึกแล้ว'); return redraw(); }
    case 'fix100': {                                   // ปรับสัดส่วนของหน่วยให้รวมกับกลางภาค+ปลายภาคเป็น 100
      const fixed = num(b.weights.mid) + num(b.weights.final), units = b.items.reduce((a, it) => a + num(it.max), 0), target = Math.max(0, 100 - fixed);
      if (!b.items.length || units <= 0) return toast('ยังไม่มีหน่วยให้ปรับ');
      let acc = 0; b.items.forEach((it, i) => { const v = i === b.items.length - 1 ? Math.round((target - acc) * 100) / 100 : Math.round(num(it.max) * target / units * 2) / 2; it.max = Math.max(0, v); acc += it.max; if (comps(it).length) { rescaleComps(it); resyncUnit(b, it); } });
      save(); toast('ปรับสัดส่วนให้รวมเป็น 100% แล้ว'); return redraw(); }
    case 'subEditor': return openSubsEditor(d.it);
    case 'subsSave': { const it = item(); if (!it) return;
      const old = comps(it), used = new Set(), next = [], rk = () => 's' + Math.random().toString(36).slice(2, 7);
      let bad = '';
      document.querySelectorAll('#kxBody .kx-row').forEach(tr => {      // ตัวชี้วัด × K S A / รวม (คีย์เดิมของช่องเดียวกันคงไว้)
        const iid = tr.dataset.ind, x = indOf(b, iid), val = q => num(tr.querySelector(`.kx-m[data-q="${q}"]`).value);
        if (val('') > 0 && ['K', 'S', 'A'].some(q => val(q) > 0)) bad = indLabel(x);
        KQ.forEach(([q]) => { const raw = val(q); if (!(raw > 0)) return;
          const prev = old.find(c => c.ind === iid && (c.ksa || '') === q), key = prev && !used.has(prev.key) ? prev.key : rk();
          used.add(key); next.push(Object.assign({ key, label: indLabel(x) + ' ' + (q || 'รวม'), rawMax: raw, max: 0, ind: iid, ksa: q, exam: tr.querySelector(`input[type=checkbox][data-q="${q}"]`).checked },
            prev && prev.custom && prev.key === key ? { label: prev.label, custom: true } : {})); });      // ชื่อที่ครูตั้งเองผ่าน ✎ ไม่ถูกทับ
      });
      if (bad) return toast(bad + ': ใช้ K S A หรือคะแนนรวมอย่างใดอย่างหนึ่ง');
      document.querySelectorAll('#sbList .sb-row').forEach((row, i) => {
        const raw = num(row.querySelector('.sb-m').value); if (!(raw > 0)) return;
        let key = row.dataset.k && !used.has(row.dataset.k) ? row.dataset.k : rk();
        used.add(key); next.push({ key, label: row.querySelector('.sb-n').value.trim() || 'ช่อง ' + (i + 1), rawMax: raw, max: 0, exam: row.querySelector('.sb-x').checked });
      });
      /* หน่วยช่องเดียวที่มีคะแนนแล้ว → ถามก่อน แล้วย้ายเข้าช่องแรก (แปลงสัดส่วนตามคะแนนเต็ม) · ช่องที่หาย/ไม่เป็นสอบแล้ว → บอกจำนวนค่าที่จะลบก่อน */
      const em0 = entryMax(it), rm0 = retakeMax(it), moveIds = !old.length && next.length ? Object.keys(b.scores).filter(sid => has((b.scores[sid] || {})[it.id]) && !((b.componentScores || {})[sid] || {})[it.id]) : [];
      const isDropRt = k => { const p = k.split('~'); return p.length === 2 && p[0] === it.id && !next.some(c => c.key === p[1] && c.exam); };
      let nDelS = 0, nDelR = 0;
      Object.keys(b.componentScores || {}).forEach(sid => { const m = (b.componentScores[sid] || {})[it.id]; if (m) Object.keys(m).forEach(k => { if (!used.has(k) && has(m[k])) nDelS++; }); });
      Object.keys(b.itemRetakes || {}).forEach(sid => { const m = b.itemRetakes[sid] || {}; Object.keys(m).forEach(k => { if (isDropRt(k) && rtList(m[k]).some(has)) nDelR++; }); });
      if (moveIds.length && !await confirmBox('ย้ายคะแนนเดิม', `หน่วยนี้มีคะแนนแล้ว <b>${moveIds.length}</b> คน (เต็ม ${fmt(em0)}) — จะย้ายเข้าช่องแรก <b>${esc(subName(next[0], b))}</b> (เต็ม ${fmt(next[0].rawMax)}) โดยแปลงตามสัดส่วนคะแนนเต็ม`, 'ย้ายเข้าช่องแรก')) return;
      if ((nDelS || nDelR) && !await confirmBox('ลบคะแนนของช่องที่เอาออก', `ช่องที่เอาออกหรือไม่เป็นสอบแล้วจะลบ${nDelS ? ` คะแนน <b>${nDelS}</b> ค่า` : ''}${nDelR ? ` คะแนนซ่อม <b>${nDelR}</b> ค่า` : ''} ย้อนกลับไม่ได้`, 'ลบและบันทึก')) return;
      { const b = book(c.id), it = b.items.find(x => x.id === d.it); if (!it) return;      // ระหว่างรอยืนยัน สมุดอาจถูกแทนด้วยข้อมูลจากระบบ → ใช้ฉบับล่าสุด
      it.components = next; if (next.length) { delete it.rawMax; rescaleComps(it); }
      const r2 = v => Math.round(num(v) * 10000) / 10000, k0 = next[0] && next[0].key;
      moveIds.forEach(sid => { if (!has((b.scores[sid] || {})[it.id])) return; (b.componentScores[sid] = b.componentScores[sid] || {})[it.id] = { [k0]: r2(num(b.scores[sid][it.id]) * num(next[0].rawMax) / em0) };
        const rt = ((b.itemRetakes || {})[sid] || {})[it.id];      // ซ่อมทั้งหน่วยเดิม → ซ่อมของช่องแรก (ถ้าช่องแรกเป็นสอบ) เก็บของเดิมไว้ด้วย
        if (next[0].exam && rtList(rt).some(has)) b.itemRetakes[sid][compRtKey(it, next[0])] = rtList(rt).map(v => has(v) ? r2(num(v) * num(next[0].rawMax) / rm0) : ''); });
      Object.keys(b.componentScores || {}).forEach(sid => { const m = (b.componentScores[sid] || {})[it.id]; if (m) Object.keys(m).forEach(k => { if (!used.has(k)) delete m[k]; }); });
      Object.keys(b.itemRetakes || {}).forEach(sid => { const m = b.itemRetakes[sid] || {}; Object.keys(m).forEach(k => { if (isDropRt(k)) delete m[k]; }); });      // ซ่อมของช่องที่ลบ/ไม่เป็นสอบแล้ว
      resyncUnit(b, it); save(); closeModal(); toast(next.length ? 'บันทึกช่องย่อย ' + next.length + ' ช่อง' : 'ใช้ช่องคะแนนเดียว'); return redraw(); } }
    case 'rtAdd': { const isMid = d.f === 'retake', host = isMid ? (b.exam[d.sid] = b.exam[d.sid] || {}) : (b.itemRetakes[d.sid] = b.itemRetakes[d.sid] || {}), key = isMid ? 'retake' : d.ck ? d.it + '~' + d.ck : d.it;
      const a = rtList(host[key]).slice();
      const sel = isMid ? `#scGrid input.rt[data-f="retake"][data-sid="${d.sid}"]` : `#scGrid input.rt[data-it="${d.it}"][data-sid="${d.sid}"]` + (d.ck ? `[data-ck="${CSS.escape(d.ck)}"]` : ':not([data-ck])');
      if (!a.length || !has(a[a.length - 1])) { const ins = document.querySelectorAll(sel); const last = ins[ins.length - 1]; if (last) { last.focus(); toast('กรอกคะแนนซ่อมครั้งนี้ก่อน แล้วค่อยเพิ่มครั้งถัดไป'); } return; }
      a.push(''); host[key] = a; save(); redraw();
      setTimeout(() => { const ins = document.querySelectorAll(sel), n = ins[ins.length - 1]; if (n) n.focus(); }, 0); return; }
    case 'subAdd': case 'subEdit': { const it = item(); if (!it) return;
      if (a === 'subAdd' && !comps(it).length) {      // แปลงหน่วยช่องเดียวเป็นหลายช่อง: ช่องแรกรับคะแนนเดิมไว้
        const key = 's' + Math.random().toString(36).slice(2, 7), em = entryMax(it);
        it.components = [{ key, label: 'ช่อง 1', rawMax: em, max: 0 }]; delete it.rawMax; rescaleComps(it);
        c.students.forEach(s => { const old = (b.scores[s.id] || {})[it.id]; if (has(old)) { (b.componentScores[s.id] = b.componentScores[s.id] || {})[it.id] = { [key]: old }; } });
        resyncUnit(b, it); save();
      }
      return subOne(it.id, a === 'subEdit' ? d.k : ''); }
    case 'subOneSave': { const it0 = item(); if (!it0) return; const raw = num($('#so-m').value); if (!(raw > 0)) return toast('คะแนนเต็มต้องมากกว่า 0');
      const nm = $('#so-n').value.trim() || 'ช่อง ' + (comps(it0).length + 1);
      const ex = !!($('#so-x') || {}).checked, rt0 = book(c.id).itemRetakes || {};
      const nR = d.k && !ex ? Object.keys(rt0).filter(sid => rtList((rt0[sid] || {})[it0.id + '~' + d.k]).some(has)).length : 0;      // เอาติ๊กสอบออก = ลบคะแนนซ่อมของช่องนี้
      if (nR && !await confirmBox('ลบคะแนนซ่อมของช่องนี้', `ช่องที่ไม่เป็นสอบแล้วจะลบคะแนนซ่อม <b>${nR}</b> ค่า ย้อนกลับไม่ได้`, 'ลบและบันทึก')) return;
      const b = book(c.id), it = b.items.find(x => x.id === it0.id); if (!it) return;      // หยิบสมุดฉบับล่าสุดหลังรอยืนยัน
      if (d.k) { const x = (it.components || []).find(y => y.key === d.k); if (x) { if (nm !== subName(x, b)) { x.label = nm; if (x.ind) x.custom = true; } x.rawMax = raw; x.exam = ex;      // ช่องตัวชี้วัดที่ครูเปลี่ยนชื่อเอง = ไม่ใช้ชื่อจากรหัสอีก
        if (!ex) Object.keys(b.itemRetakes || {}).forEach(sid => { if (b.itemRetakes[sid]) delete b.itemRetakes[sid][it.id + '~' + x.key]; }); } }
      else (it.components = it.components || []).push({ key: 's' + Math.random().toString(36).slice(2, 7), label: nm, rawMax: raw, max: 0, exam: ex });
      rescaleComps(it); resyncUnit(b, it); save(); closeModal(); return redraw(); }
    case 'subOneDel': { const it0 = item(); if (!it0) return;
      const last = comps(it0).length <= 1, x0 = comps(it0).find(x => x.key === d.k), cs0 = book(c.id).componentScores || {}, rt0 = book(c.id).itemRetakes || {};
      const nS = Object.keys(cs0).filter(sid => has(((cs0[sid] || {})[it0.id] || {})[d.k])).length, nR = Object.keys(rt0).filter(sid => rtList((rt0[sid] || {})[it0.id + '~' + d.k]).some(has)).length;
      const lost = nS || nR ? ` — มี${nS ? `คะแนน <b>${nS}</b> ค่า` : ''}${nS && nR ? ' และ' : ''}${nR ? `คะแนนซ่อม <b>${nR}</b> ค่า` : ''} จะหายไป ย้อนกลับไม่ได้` : '';      // ช่องว่างไม่ต้องถาม
      if ((last || lost) && !await confirmBox(last ? 'ลบช่องสุดท้าย' : 'ลบช่องนี้', (last ? 'หน่วยนี้จะกลับไปใช้ช่องคะแนนช่องเดียว และคะแนนในช่องย่อยจะหายไป' : 'ลบช่อง <b>' + esc(x0 ? subName(x0, book(c.id)) : '') + '</b>') + lost, 'ลบ')) return;
      const b = book(c.id), it = b.items.find(x => x.id === it0.id); if (!it) return;      // หยิบสมุดฉบับล่าสุดหลังรอยืนยัน (ระหว่างรอ ข้อมูลจากระบบอาจแทนสมุดในเครื่อง การแก้ฉบับเก่าจะหายเงียบ)
      it.components = (it.components || []).filter(x => x.key !== d.k);
      Object.keys(b.componentScores || {}).forEach(sid => { const m = (b.componentScores[sid] || {})[it.id]; if (m) delete m[d.k]; });
      Object.keys(b.itemRetakes || {}).forEach(sid => { if (b.itemRetakes[sid]) delete b.itemRetakes[sid][it.id + '~' + d.k]; });
      if (it.components.length) rescaleComps(it); resyncUnit(b, it);
      if (!it.components.length) Object.keys(b.scores).forEach(sid => { delete b.scores[sid][it.id]; });
      save(); closeModal(); return redraw(); }
    case 'gAdd': b.gradeScale.push([0, '0']); b.gradeScale.sort((x, z) => num(z[0]) - num(x[0])); save(); return redraw();
    case 'gDel': b.gradeScale.splice(+d.i, 1); save(); return redraw();
    case 'gReset': b.gradeScale = defaultBook().gradeScale; save(); return redraw();
    /* กรอกคะแนน (K/S/A) */
    case 'ksa': return ksaModal(d.sid, d.it);
    case 'ksaSave': { const it = item(); if (!it) return; const cs = (b.componentScores[d.sid] = b.componentScores[d.sid] || {}), v = cs[it.id] = cs[it.id] || {};
      document.querySelectorAll('[data-ks]').forEach(el => { const val = clamp(el, num(el.dataset.max)); if (val === '') delete v[el.dataset.ks]; else v[el.dataset.ks] = val; });
      const total = itemValue(b, d.sid, it); (b.scores[d.sid] = b.scores[d.sid] || {});
      if (total === '') delete b.scores[d.sid][it.id]; else b.scores[d.sid][it.id] = total;
      save(); closeModal(); return redraw(); }
    /* คะแนนกลุ่ม */
    case 'gsAdd': b.groupSets.push({ id: uid('gs'), name: 'ชุดกลุ่มที่ ' + (b.groupSets.length + 1), groups: [] }); save(); return redraw();
    case 'gsCopy': { const src = []; tCls().forEach(x => book(x.id).groupSets.forEach(g => src.push({ cls: x, g })));
      return modal(`<h2 style="margin-bottom:8px">คัดลอกจากชุดกลุ่มเดิม</h2><p class="muted small" style="margin-bottom:10px">คัดลอกเฉพาะชื่อกลุ่มและสมาชิก (ไม่คัดลอกคะแนน)</p>
        ${src.length ? src.map((x, i) => `<button class="nav" data-bk="gsCopyDo" data-c="${x.cls.id}" data-gs="${x.g.id}"><span>${esc(x.g.name)} <span class="muted small">· ${esc(x.cls.name)} · ${x.g.groups.length} กลุ่ม</span></span></button>`).join('') : '<div class="empty">ยังไม่มีชุดกลุ่มให้คัดลอก</div>'}`, true); }
    case 'gsCopyDo': { const src = book(d.c).groupSets.find(x => x.id === d.gs); if (src) { const n = cloneSet(b, src, c); save(); closeModal(); toast('ทำสำเนาเป็น “' + n.name + '” แล้ว'); redraw(); } return; }
    case 'gClone': { const n = cloneSet(b, gset(), c); save(); toast('ทำสำเนาเป็น “' + n.name + '” แล้ว'); return redraw(); }
    case 'gsDel': { const gs = gset(); if (!gs || !await confirmBox('ลบชุดกลุ่ม', 'ลบ <b>' + esc(gs.name) + '</b> และการจัดกลุ่มทั้งหมดในชุดนี้? คะแนนที่ลงให้นักเรียนไปแล้วจะยังอยู่', 'ลบ')) return;
      const b2 = book(c.id);      // หยิบสมุดฉบับล่าสุดหลังรอยืนยัน (ระหว่างรอ ข้อมูลจากระบบอาจแทนสมุดในเครื่อง การแก้ฉบับเก่าจะหายเงียบ)
      b2.groupSets = b2.groupSets.filter(x => x.id !== gs.id); b2.items.forEach(it => { if (it.groupSetId === gs.id) { it.groupSetId = ''; it.kind = 'individual'; } }); save(); return redraw(); }
    case 'gAddGrp': { const gs = gset(); gs.groups.push({ id: uid('g'), name: 'กลุ่มที่ ' + (gs.groups.length + 1), members: [] }); save(); return redraw(); }
    case 'gDelGrp': { const gs = gset(); gs.groups = gs.groups.filter(x => x.id !== d.g); save(); return redraw(); }
    case 'gChip': { const gs = gset(), g = grp(), n = +d.no, i = g.members.indexOf(n);
      if (i >= 0) g.members.splice(i, 1); else { gs.groups.forEach(o => { if (o !== g) o.members = o.members.filter(m => m !== n); }); g.members.push(n); g.members.sort((x, z) => x - z); }
      reapply(b, gs, g, byNoOf(c)); save(); return redraw(); }
    case 'gPres': { const m = (b.presenters[d.it] = b.presenters[d.it] || {}), sel = m[d.g] = (m[d.g] || []).slice(), i = sel.indexOf(d.sid); if (i >= 0) sel.splice(i, 1); else sel.push(d.sid); save(); return redraw(); }
    case 'gAllPres': { const g = grp(), ids = g.members.map(n => (byNoOf(c)[n] || {}).id).filter(Boolean), m = (b.presenters[d.it] = b.presenters[d.it] || {}), old = m[d.g] || [];
      m[d.g] = ids.length && ids.every(x => old.indexOf(x) >= 0) ? [] : ids; save(); return redraw(); }
    case 'gAuto': { const gs = gset(); return modal(`<h2 style="margin-bottom:10px">แบ่งกลุ่มอัตโนมัติ — ${esc(gs.name)}</h2>
      <div class="row" style="border:0"><label><input type="radio" name="am" value="count" checked> กำหนดจำนวนกลุ่ม</label><input id="as-n" class="in" style="width:80px" value="4" inputmode="numeric"></div>
      <div class="row" style="border:0"><label><input type="radio" name="am" value="size"> กำหนดจำนวนคนต่อกลุ่ม</label><input id="as-s" class="in" style="width:80px" value="5" inputmode="numeric"></div>
      <div class="row" style="border:0"><label><input type="radio" name="ao" value="no" checked> เรียงตามเลขที่</label><label><input type="radio" name="ao" value="rand"> สุ่ม</label></div>
      <div class="notice">การแบ่งใหม่จะแทนที่กลุ่มเดิมทั้งหมดในชุดนี้ (${c.students.length} คน)</div>
      <button class="btn pri" style="width:100%" data-bk="gAutoDo" data-gs="${gs.id}">แบ่งกลุ่ม</button>`, true); }
    case 'gAutoDo': { const gs = gset(), mode = document.querySelector('[name=am]:checked').value, order = document.querySelector('[name=ao]:checked').value;
      const nos = c.students.map(s => s.no).sort((x, z) => x - z);
      if (order === 'rand') for (let i = nos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nos[i], nos[j]] = [nos[j], nos[i]]; }
      const k = mode === 'count' ? Math.max(1, Math.round(num($('#as-n').value))) : Math.max(1, Math.ceil(nos.length / Math.max(1, Math.round(num($('#as-s').value)))));
      const base = Math.floor(nos.length / k), rem = nos.length % k; let p = 0;
      gs.groups = Array.from({ length: k }, (_, i) => { const sz = base + (i < rem ? 1 : 0), m = nos.slice(p, p + sz).sort((x, z) => x - z); p += sz; return { id: uid('g'), name: 'กลุ่มที่ ' + (i + 1), members: m }; });
      b.items.filter(it => it.groupSetId === gs.id).forEach(it => { delete b.gscores[it.id]; });
      save(); closeModal(); toast('แบ่งเป็น ' + k + ' กลุ่มแล้ว'); return redraw(); }
    /* ตัวชี้วัด */
    case 'indCore': return openCorePicker();
    case 'indExtra': return openExtraPicker();
    case 'indPaste': return modal(`<h2 style="margin-bottom:8px">พิมพ์เอง / วางจาก Excel</h2><p class="muted small" style="margin-bottom:8px">วางตารางจาก Excel ได้เลย คอลัมน์: <b>รหัส · ตัวชี้วัด · เวลา · คะแนน</b> (แถวละ 1 ข้อ)</p>
      <textarea id="pp" class="in" rows="9" placeholder="ว 2.1 ม.1/1&#9;อธิบายสมบัติของสาร&#9;4&#9;5"></textarea><button class="btn pri" style="width:100%;margin-top:12px" data-bk="indPasteDo">เพิ่ม</button>`, true);
    case 'indPasteDo': { const list = $('#pp').value.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim()).map(l => { const p = l.includes('\t') ? l.split('\t') : l.split(',');
        return p.length === 1 ? { text: p[0].trim() } : { code: p[0].trim(), text: (p[1] || '').trim(), hours: p[2] ? num(p[2]) : '', score: p[3] ? num(p[3]) : '' }; });
      const n = addInds(b, list); save(); closeModal(); toast('เพิ่ม ' + n + ' ข้อ'); return redraw(); }
    case 'indCopy': { const others = tCls().filter(x => x.id !== c.id);
      return modal(`<h2 style="margin-bottom:8px">คัดลอกตัวชี้วัดไปห้องอื่น</h2><p class="muted small" style="margin-bottom:8px">ข้อที่ซ้ำกันจะถูกข้ามให้เอง</p>
        ${others.map(x => `<label class="row" style="cursor:pointer"><input type="checkbox" class="ic-c" value="${x.id}" style="width:20px;height:20px;accent-color:var(--brand)"><span>${esc(x.name)} · ${esc(x.subject)}</span></label>`).join('')}
        <button class="btn pri" style="width:100%;margin-top:12px" data-bk="indCopyDo">คัดลอก ${b.indicators.length} ข้อ</button>`, true); }
    case 'indCopyDo': { const ids = [...document.querySelectorAll('.ic-c')].filter(x => x.checked).map(x => x.value); if (!ids.length) return toast('ยังไม่ได้เลือกห้อง');
      ids.forEach(id => addInds(book(id), b.indicators)); save(); closeModal(); return toast('คัดลอกไป ' + ids.length + ' ห้องแล้ว'); }
    case 'indAdd': b.indicators.push(newInd({})); save(); return redraw();
    case 'indUp': case 'indDown': { const i = b.indicators.findIndex(x => x.id === d.id), j = a === 'indUp' ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= b.indicators.length) return;
      [b.indicators[i], b.indicators[j]] = [b.indicators[j], b.indicators[i]]; save(); return redraw(); }
    case 'indDel': b.indicators = b.indicators.filter(x => x.id !== d.id); save(); return redraw();
    case 'indClear': if (await confirmBox('ล้างตัวชี้วัดทั้งหมด', 'ลบตัวชี้วัดทั้ง ' + b.indicators.length + ' ข้อของวิชานี้ ย้อนกลับไม่ได้', 'ล้างทั้งหมด')) { book(c.id).indicators = []; save(); redraw(); } return;      // ฉบับล่าสุดหลังรอยืนยัน
  }
});

document.addEventListener('change', e => {
  const t = e.target.closest('input[data-bk],select[data-bk],textarea[data-bk]'); if (!t) return;
  const a = t.dataset.bk, d = t.dataset, c = cur(), b = book(c.id);
  const it = d.it && b.items.find(x => x.id === d.it), gs = d.gs && b.groupSets.find(x => x.id === d.gs), g = gs && d.g && gs.groups.find(x => x.id === d.g);
  const ind = d.id && b.indicators.find(x => x.id === d.id);
  switch (a) {
    case 'itName': if (it) it.name = t.value.trim() || it.name; return save();
    case 'itSection': if (it) { it.scoreSection = t.value === 'after' ? 'after' : 'before'; save(); redraw(); } return;
    case 'itKind': if (it) { it.kind = t.value; if (it.kind === 'group') { it.components = []; if (!it.groupSetId && b.groupSets[0]) it.groupSetId = b.groupSets[0].id; else if (!b.groupSets.length) toast('ยังไม่มีชุดกลุ่ม — ไปสร้างที่เมนู “คะแนนกลุ่ม”'); } save(); redraw(); } return;
    case 'itGs': if (it) { it.groupSetId = t.value; save(); redraw(); } return;
    case 'itMax': if (it) { it.max = Math.max(0, num(t.value)); if (comps(it).length) { rescaleComps(it); resyncUnit(b, it); } save(); redraw(); } return;
    case 'exMid': b.exams.midMax = Math.max(0, num(t.value)); save(); return redraw();
    case 'exFin': b.exams.finalMax = Math.max(0, num(t.value)); save(); return redraw();
    case 'exRetake': b.exams.retakeEnabled = t.checked; save(); return redraw();
    case 'wMid': case 'wFinal': b.weights[a === 'wMid' ? 'mid' : 'final'] = Math.max(0, num(t.value)); save(); return redraw();
    case 'passP': b.passPercent = Math.min(100, Math.max(0, num(t.value))); b.items.filter(x => comps(x).length).forEach(x => resyncUnit(b, x)); save(); return redraw();      // เกณฑ์เปลี่ยน = ช่องสอบที่ใช้คะแนนซ่อมเปลี่ยน → คิดรวมหน่วยใหม่
    case 'gMin': b.gradeScale[+d.i][0] = num(t.value); b.gradeScale.sort((x, z) => num(z[0]) - num(x[0])); save(); return redraw();
    case 'gVal': b.gradeScale[+d.i][1] = t.value.trim(); save(); return;
    case 'score': { const s = c.students.find(x => x.id === d.sid), before = calcRow(b, s).unitFailed[d.it], mx = entryMax(it), v = clamp(t, mx);
      b.scores[d.sid] = b.scores[d.sid] || {}; if (v === '') delete b.scores[d.sid][d.it]; else b.scores[d.sid][d.it] = v; save();
      markLow(t, v, mx, b);
      const r = refreshRow(b, c, d.sid); setUChip(b, r, d.sid, it, t.closest('td'));
      if (r.unitFailed[d.it] !== before && !bulk) { redraw(); if (window.ScoreVoice && ScoreVoice.on) setTimeout(() => ScoreVoice.rebind(), 0); } return; }
    case 'sub': { const cmp = comps(it).find(x => x.key === d.k); if (!cmp) return;
      const s = c.students.find(x => x.id === d.sid), r0 = calcRow(b, s), before = r0.unitFailed[d.it], cfk = compRtKey(it, cmp), cBefore = !!r0.compFail[cfk], mx = num(cmp.rawMax), v = clamp(t, mx);
      const m = ((b.componentScores[d.sid] = b.componentScores[d.sid] || {})[d.it] = (b.componentScores[d.sid] || {})[d.it] || {});
      if (v === '') delete m[d.k]; else m[d.k] = v;
      const total = itemValue(b, d.sid, it); (b.scores[d.sid] = b.scores[d.sid] || {});
      if (total === '') delete b.scores[d.sid][d.it]; else b.scores[d.sid][d.it] = total;
      save(); markLow(t, v, mx, b);
      const ut = document.querySelector(`[data-ut="${d.sid}|${d.it}"]`);
      if (ut) { const bb = ut.querySelector('b'); if (bb) bb.textContent = total === '' ? '–' : fmt(total, 1); ut.classList.toggle('low', isLow(total, num(it.max), b)); }
      const r = refreshRow(b, c, d.sid); setUChip(b, r, d.sid, it, ut);
      if ((r.unitFailed[d.it] !== before || !!r.compFail[cfk] !== cBefore) && !bulk) { redraw(); if (window.ScoreVoice && ScoreVoice.on) setTimeout(() => ScoreVoice.rebind(), 0); } return; }
    case 'itRetake': if (it && d.ck) { const cmp = comps(it).find(x => x.key === d.ck); if (!cmp) return;      // ซ่อมรายช่อง (ช่องสอบ)
      const mx = num(cmp.rawMax), v = clamp(t, mx), k = compRtKey(it, cmp), m = (b.itemRetakes[d.sid] = b.itemRetakes[d.sid] || {});
      rtSet(m, k, num(d.i) || 0, v); const total = itemValue(b, d.sid, it);
      if (!(window.EMSAdmin && EMSAdmin.lockedNow && EMSAdmin.lockedNow())) { (b.scores[d.sid] = b.scores[d.sid] || {});      // ภาคปิดแล้ว: บันทึกได้เฉพาะคะแนนซ่อม (ผู้ใช้อ่านรวมหน่วยผ่าน itemValue)
        if (total === '') delete b.scores[d.sid][it.id]; else b.scores[d.sid][it.id] = total; }
      save(); markLow(t, v, mx, b); const r = refreshRow(b, c, d.sid);
      const utd = document.querySelector(`[data-ut="${d.sid}|${it.id}"]`), ut = utd && utd.querySelector('b'); if (ut) ut.textContent = total === '' ? '–' : fmt(total, 1);
      if (utd) utd.classList.toggle('low', isLow(total, num(it.max), b));
      document.querySelectorAll(`[data-uchip="${d.sid}|${it.id}"]`).forEach(x => { x.innerHTML = sChip(unitPass(b, r, d.sid, it)); });
      const td = document.querySelector(`[data-rtp="${d.sid}|${k}"]`); if (td) { const old = td.querySelector('.rt-prog'); if (old) old.remove(); td.insertAdjacentHTML('beforeend', compProg(b, d.sid, it, cmp)); }
      return; }
    { const mx = retakeMax(it), v = clamp(t, mx); const m = (b.itemRetakes[d.sid] = b.itemRetakes[d.sid] || {});
      rtSet(m, d.it, num(d.i) || 0, v); save(); markLow(t, v, mx, b); const r = refreshRow(b, c, d.sid);
      /* อัปเดตบรรทัดพัฒนาการและป้ายผ่าน/ไม่ผ่านของหัวข้อนี้ทันที โดยไม่วาดตารางใหม่ (โฟกัสไม่หาย) */
      const td = document.querySelector(`[data-rtp="${d.sid}|${d.it}"]`); if (td) { const old = td.querySelector('.rt-prog'); if (old) old.remove(); td.insertAdjacentHTML('beforeend', rtProg(b, d.sid, it)); }
      document.querySelectorAll(`[data-uchip="${d.sid}|${d.it}"]`).forEach(x => { x.innerHTML = sChip(unitPass(b, r, d.sid, it)); }); return; }
    case 'exam': { const mx = d.f === 'final' ? num(b.exams.finalMax) : num(b.exams.midMax);
      const s = c.students.find(x => x.id === d.sid), before = calcRow(b, s).midFailed, v = clamp(t, mx), ex = (b.exam[d.sid] = b.exam[d.sid] || {});
      if (d.f === 'retake') rtSet(ex, 'retake', num(d.i) || 0, v); else if (v === '') delete ex[d.f]; else ex[d.f] = v; save(); markLow(t, v, mx, b);
      const r = refreshRow(b, c, d.sid); if (r.midFailed !== before && !bulk) { redraw(); if (window.ScoreVoice && ScoreVoice.on) setTimeout(() => ScoreVoice.rebind(), 0); } return; }
    case 'gsName': if (gs) { gs.name = t.value.trim() || gs.name; save(); redraw(); } return;
    case 'gName': if (g) { g.name = t.value.trim() || g.name; save(); } return;
    case 'gRange': if (g) { const byNo = byNoOf(c); g.members = parseNos(t.value, Math.max(50, ...c.students.map(s => s.no))).filter(n => byNo[n]);
      gs.groups.forEach(o => { if (o !== g) o.members = o.members.filter(m => g.members.indexOf(m) < 0); }); reapply(b, gs, g, byNo); save(); redraw(); } return;
    case 'gScore': { const it2 = b.items.find(x => x.id === d.it), v = clamp(t, entryMax(it2)); (b.gscores[d.it] = b.gscores[d.it] || {});
      if (v === '') delete b.gscores[d.it][d.g]; else b.gscores[d.it][d.g] = v;
      g.members.forEach(n => { const s = byNoOf(c)[n]; if (!s) return; (b.scores[s.id] = b.scores[s.id] || {}); if (v === '') delete b.scores[s.id][d.it]; else b.scores[s.id][d.it] = v; });
      save(); toast(v === '' ? 'ล้างคะแนน ' + g.name : 'ลง ' + v + ' คะแนนให้ ' + g.name + ' ' + g.members.length + ' คน'); return; }
    case 'indCode': if (ind) ind.code = t.value; return save();
    case 'indText': if (ind) ind.text = t.value; return save();
    case 'indKind': if (ind) ind.kind = t.value === 'S' ? 'S' : 'F'; save(); return redraw();
    case 'indHours': if (ind) ind.hours = t.value.trim() === '' ? '' : num(t.value); save(); return redraw();
    case 'indScore': if (ind) ind.score = t.value.trim() === '' ? '' : num(t.value); save(); return redraw();
  }
});


/* มือถือ: เลือกหน่วย / เลื่อนหน่วยก่อน-ถัดไป */
document.addEventListener('change', e => { if (!e.target.matches('[data-bkusel]')) return; S.bkUnit = e.target.value; save(); redraw(); });
document.addEventListener('click', e => { const t = e.target.closest('[data-bku]'); if (!t) return; const sel = document.querySelector('[data-bkusel]'); if (!sel) return;
  const i = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + +t.dataset.bku)); S.bkUnit = sel.options[i].value; save(); redraw(); });
document.addEventListener('click', e => { const t = e.target.closest('[data-bkv]'); if (!t) return; const k = t.dataset.bkv;
  if (k === 'all') { S.bkSecs = []; S.bkView = 'all'; }
  else if (k === 'sum') S.bkView = S.bkView === 'sum' ? 'all' : 'sum';
  else { const sel = (S.bkSecs || []).filter(x => x !== k); if (sel.length === (S.bkSecs || []).length) sel.push(k); S.bkSecs = ['before', 'mid', 'after', 'final'].filter(x => sel.indexOf(x) >= 0); S.bkView = 'all'; }
  save(); redraw(); });
/* วัดความสูงแถบเครื่องมือ ให้ตารางเลื่อนในกรอบของตัวเองและหัวตารางตรึงอยู่ใต้แถบเสมอ (รวมตอนเต็มจอ) */
['items', 'scores', 'groups', 'indicators'].forEach(k => { const f = P[k]; P[k] = () => cur() ? f() : head2('สมุดคะแนน') + '<div class="card empty">ยังไม่มีห้องที่สอนในภาคนี้<br><span class="small">ห้องที่ปรึกษาที่ไม่มีคาบสอนของตัวเองไม่ต้องกรอกคะแนน</span></div>'; });
const fitGrid = () => { const t = document.getElementById('scTool'); if (t) document.documentElement.style.setProperty('--sctool-h', t.offsetHeight + 'px'); };
const baseRenderBk = window.render;
window.render = function () { const r = baseRenderBk.apply(this, arguments); fitGrid(); return r; };
window.addEventListener('resize', fitGrid);
document.addEventListener('fullscreenchange', () => setTimeout(fitGrid, 50));
document.addEventListener('keydown', e => {
  const inp = e.target; if (!inp.classList || !inp.classList.contains('cell') || !inp.closest('#scGrid')) return;
  let m = { ArrowDown: [1, 0], Enter: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }[e.key]; if (!m) return;
  if (e.key === 'Enter' && e.shiftKey) m = [-1, 0];
  const r = num(inp.dataset.r) + m[0], c = num(inp.dataset.c) + m[1];
  const find = () => document.querySelector(`#scGrid input.cell[data-r="${r}"][data-c="${c}"]`);
  if (!find()) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } return; }
  e.preventDefault();
  const focus = () => { const n = find(); if (n && document.activeElement !== n) { n.focus(); n.select(); } };
  focus(); setTimeout(focus, 0); setTimeout(focus, 80);
});
/* ช่องซ่อม (.rt): ↑ ↓ / Enter ไปช่องซ่อมของหัวข้อเดียวกันในแถวถัดไปที่มีช่องซ่อม (ข้ามแถวที่ไม่ต้องซ่อม) */
document.addEventListener('keydown', e => {
  const inp = e.target; if (!inp.classList || !inp.classList.contains('rt') || !inp.closest('#scGrid')) return;
  let m = { ArrowDown: 1, Enter: 1, ArrowUp: -1 }[e.key]; if (!m) return;
  if (e.key === 'Enter' && e.shiftKey) m = -1;
  const d = inp.dataset, sel = d.f === 'retake' ? 'input.rt[data-f="retake"]' : `input.rt[data-it="${d.it}"]` + (d.ck ? `[data-ck="${CSS.escape(d.ck)}"]` : ':not([data-ck])');
  const trs = [...inp.closest('#scGrid').querySelectorAll('tbody tr')];
  let n = null; for (let i = trs.indexOf(inp.closest('tr')) + m; !n && i >= 0 && i < trs.length; i += m) { const list = trs[i].querySelectorAll(sel); if (list.length) n = trs[i].querySelector(`${sel}[data-i="${d.i}"]`) || list[list.length - 1]; }
  if (!n) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } return; }
  e.preventDefault(); n.focus(); n.select();
});
/* เข้าช่องแล้วเลือกตัวเลขทั้งช่อง พิมพ์ทับได้เลยเหมือน Excel */
document.addEventListener('focusin', e => { const t = e.target; if (t.classList && t.classList.contains('cell') && t.closest('#scGrid')) setTimeout(() => { if (document.activeElement === t) t.select(); }, 0); });
/* วางคะแนนจาก Excel ทั้งคอลัมน์/หลายคอลัมน์ — ยึด "แถวที่เท่าไร" ตามลำดับ ไม่ใช่ช่องว่างถัดไป
   เหมือน KruSpace เพื่อไม่ให้คะแนนตกผิดคน */
document.addEventListener('paste', e => {
  const inp = e.target; if (!inp || !inp.classList || !inp.classList.contains('cell') || !inp.closest('#scGrid')) return;
  const text = (e.clipboardData || window.clipboardData || { getData: () => '' }).getData('text');
  if (!text) return;
  const block = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
  if (block.length === 1 && block[0].length === 1) return;          // ค่าเดียว ปล่อยให้วางตามปกติ
  e.preventDefault();
  const grid = inp.closest('#scGrid'), r0 = num(inp.dataset.r), c0 = num(inp.dataset.c);
  let filled = 0, outside = 0, clamped = 0, locked = 0;
  bulk = true;
  try {
    block.forEach((line, i) => line.forEach((raw, j) => {
      const cell = grid.querySelector(`input.cell[data-r="${r0 + i}"][data-c="${c0 + j}"]`);
      let value = String(raw == null ? '' : raw).trim().replace(/,/g, '');
      if (!cell) { if (value !== '') outside++; return; }
      if (cell.readOnly) { if (value !== '') locked++; return; }
      if (value !== '') {
        value = value.replace(/[^\d.]/g, ''); const p = value.split('.'); if (p.length > 2) value = p[0] + '.' + p.slice(1).join('');
        const mx = num(cell.dataset.max); if (mx > 0 && num(value) > mx) { value = String(mx); clamped++; }
      }
      cell.value = value; cell.dispatchEvent(new Event('change', { bubbles: true })); filled++;
    }));
  } finally { bulk = false; }
  let msg = 'วางคะแนนแล้ว ' + filled + ' ช่อง';
  if (clamped) msg += ' · ปรับค่าที่เกินเป็นคะแนนเต็ม ' + clamped + ' ช่อง';
  if (outside) msg += ' · เลยขอบตาราง ' + outside + ' ค่า';
  if (locked) msg += ' · ข้ามคะแนนสอบที่ฝ่ายวัดผลนำเข้า ' + locked + ' ช่อง';
  toast(msg); redraw();
});

/* ---------- ย้อนกลับ (undo) ในหน้ากรอกคะแนน ----------
   จำ "ก่อน–หลัง" ของคะแนนทุกครั้งที่แก้ (พิมพ์ · วางจาก Excel · กรอกด้วยเสียง · คะแนนกลุ่ม/ช่องย่อย/ซ่อม)
   หนึ่งเหตุการณ์ = หนึ่งขั้น (วางทั้งคอลัมน์ ย้อนทีเดียวทั้งก้อน) · เก็บแยกห้อง ห้องละไม่เกิน 50 ขั้น
   ตอนย้อนเขียนค่าเดิมคืนเฉพาะช่องที่ยังเป็นค่าที่เราแก้ไว้ — ถ้ามีคนอื่น/ฝ่ายวัดผลแก้ช่องนั้นต่อแล้วจะไม่ทับ */
const UNDO = {}, UNDO_MAX = 50, UKEYS = ['scores', 'componentScores', 'itemRetakes', 'exam', 'gscores'];
const uPick = b => JSON.parse(JSON.stringify(UKEYS.reduce((o, k) => (o[k] = b[k] || {}, o), {})));
const uFlat = (o, pre = [], out = {}) => { Object.keys(o || {}).forEach(k => { const v = o[k], p = pre.concat(k);
  if (v && typeof v === 'object' && !Array.isArray(v)) uFlat(v, p, out); else out[JSON.stringify(p)] = JSON.stringify(v); }); return out; };
const uSet = (root, path, json) => { let o = root; path.slice(0, -1).forEach(k => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
  const last = path[path.length - 1]; if (json === undefined) delete o[last]; else o[last] = JSON.parse(json); };
let uPend = null;
function uBegin(e) {
  if (page !== 'scores' || uPend || (e.target.closest && e.target.closest('[data-undo]'))) return;
  const cid = cur().id; uPend = { cid, before: uFlat(uPick(book(cid))) };
  setTimeout(uCommit, 0);
}
/* ปิดขั้นที่ค้าง — เรียกตอนเหตุการณ์จบ หรือก่อนย้อนกลับ (พิมพ์แล้วกดปุ่มทันที: change ตอนออกจากช่องเกิดก่อน click) */
function uCommit() { const p = uPend; uPend = null; if (!p || !S.books[p.cid]) return;
    const after = uFlat(uPick(book(p.cid))), diff = [];
    new Set(Object.keys(p.before).concat(Object.keys(after))).forEach(k => { if (p.before[k] !== after[k]) diff.push([JSON.parse(k), p.before[k], after[k]]); });
    if (!diff.length) return;
    const st = UNDO[p.cid] = UNDO[p.cid] || []; st.push(diff); if (st.length > UNDO_MAX) st.shift(); uBtn();
}
['change', 'paste', 'click'].forEach(t => document.addEventListener(t, uBegin, true));
function uBtn() { const btn = document.getElementById('scUndo'); if (!btn) return; const n = (UNDO[cur().id] || []).length;
  btn.style.opacity = n ? '' : '.55'; const c = btn.querySelector('.un-n'); if (c) c.textContent = n ? ' ' + n : ''; }
function undoScores() {
  uCommit();
  const st = UNDO[cur().id] || []; if (!st.length) return toast('ยังไม่มีการแก้คะแนนให้ย้อนกลับ');
  if (window.EMSTermLocked && EMSTermLocked()) return toast('ภาคเรียนนี้ปิดการกรอกคะแนนแล้ว ย้อนกลับไม่ได้');
  const b = book(curId), now = uFlat(uPick(b)), diff = st.pop(); let n = 0, skip = 0;
  diff.forEach(([path, before, after]) => { if (now[JSON.stringify(path)] !== after) { skip++; return; } uSet(b, path, before); n++; });
  save(); redraw(); if (window.ScoreVoice && ScoreVoice.on) setTimeout(() => ScoreVoice.rebind(), 0);
  toast(n ? `ย้อนกลับแล้ว ${n} ช่อง${skip ? ` · ข้าม ${skip} ช่องที่มีการแก้ต่อแล้ว` : ''}` : 'ช่องเหล่านี้ถูกแก้ต่อแล้ว ไม่ได้ย้อนกลับ');
}
document.addEventListener('click', e => { if (e.target.closest('[data-undo]')) undoScores(); });
/* Ctrl+Z / ⌘Z นอกช่องที่กำลังพิมพ์ = ย้อนกลับ (ในช่องปล่อยให้เบราว์เซอร์ย้อนตัวอักษรตามปกติ) */
document.addEventListener('keydown', e => {
  if (page !== 'scores' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
  const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  e.preventDefault(); undoScores();
});

/* หน้ากรอกคะแนนบนมือถือ (กว้าง ≤ 640px): คอลัมน์ชื่อแคบบรรทัดเดียว · ช่องกรอกใหญ่ แป้นตัวเลข ตัวอักษร 17px (iPhone ไม่ซูมเอง)
   แป้นตัวเลขของ iPhone ไม่มีปุ่ม Enter → แถบลอยเหนือแป้นพิมพ์ บอกชื่อ/หัวข้อที่กำลังกรอก + ปุ่ม ▲ ▼ ไปคนก่อน/คนถัดไป + เสร็จ */
(() => {
  const css = document.createElement('style');
  css.textContent = `@media(max-width:640px){
  #scGrid .k1{width:24px;min-width:24px;max-width:24px;font-size:.75rem}
  #scGrid .k2{left:24px;width:92px;min-width:92px;max-width:92px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.8rem;line-height:1.2;padding-left:4px;padding-right:4px}
  #scGrid thead th.k2{white-space:normal}
  #scGrid td input.in.cell,#scGrid td input.rt{width:54px;min-height:42px;font-size:17px;text-align:center;padding:4px 2px;border-radius:8px}
  #scGrid tbody tr.sc-cur td.k1,#scGrid tbody tr.sc-cur td.k2{background:color-mix(in srgb,var(--brand) 14%,var(--surface));font-weight:700}}
.sc-kb{position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;align-items:center;gap:6px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid var(--line);box-shadow:0 -4px 14px rgba(0,0,0,.12)}
.sc-kb.on{display:flex}
.sc-kb .who{flex:1;min-width:0;font-size:.85rem;line-height:1.25;overflow:hidden}
.sc-kb .who b,.sc-kb .who span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-kb .who span{color:var(--muted);font-size:.76rem}
.sc-kb button{min-width:46px;min-height:40px;border:1px solid var(--line);border-radius:10px;background:var(--surface2);color:var(--text);font-size:1.05rem;font-weight:700}
.sc-kb button.ok{background:var(--brand);border-color:var(--brand);color:var(--brand-ink);font-size:.9rem;padding:0 12px}`;
  document.head.appendChild(css);
  const narrow = () => matchMedia('(max-width:640px)').matches;
  const isCell = t => t && t.classList && (t.classList.contains('cell') || t.classList.contains('rt')) && t.closest('#scGrid');
  let bar = null;
  const mkBar = () => {
    bar = document.createElement('div'); bar.className = 'sc-kb'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'ไปช่องคะแนน');
    bar.innerHTML = '<div class="who"><b></b><span></span></div><button type="button" data-kb="ArrowUp" aria-label="คนก่อนหน้า">▲</button><button type="button" data-kb="Enter" aria-label="คนถัดไป">▼</button><button type="button" class="ok" data-kb="done">เสร็จ</button>';
    bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });   // ไม่ให้ปุ่มแย่งโฟกัส แป้นพิมพ์จะได้ไม่หุบ
    bar.addEventListener('click', e => {
      const k = (e.target.closest('[data-kb]') || {}).dataset; const inp = document.activeElement; if (!k || !isCell(inp)) return;
      if (k.kb === 'done') return inp.blur();
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: k.kb, bubbles: true, cancelable: true }));
    });
    document.body.appendChild(bar);
  };
  const place = () => { const v = window.visualViewport; if (!bar || !v) return; bar.style.bottom = Math.max(0, innerHeight - v.height - v.offsetTop) + 'px'; };
  if (window.visualViewport) { visualViewport.addEventListener('resize', place); visualViewport.addEventListener('scroll', place); }
  const show = inp => {
    if (!narrow()) return; if (!bar) mkBar();
    document.querySelectorAll('#scGrid tr.sc-cur').forEach(x => x.classList.remove('sc-cur'));
    const tr = inp.closest('tr'); if (tr) tr.classList.add('sc-cur');
    const nm = tr && tr.querySelector('.k2'), no = tr && tr.querySelector('.k1'), mx = inp.dataset.max;
    bar.querySelector('b').textContent = (no ? no.textContent + '. ' : '') + (nm ? [...nm.childNodes].map(x => x.textContent.trim()).filter(Boolean).join(' · ') : '');
    bar.querySelector('span').textContent = (inp.dataset.label || inp.getAttribute('aria-label') || '') + (mx ? ' · เต็ม ' + mx : '');
    bar.classList.add('on'); place();
    const sc = inp.closest('.sc-scroll'); if (sc) setTimeout(() => { const r = inp.getBoundingClientRect(), v = window.visualViewport, lim = (v ? v.height + v.offsetTop : innerHeight) - 70; if (r.bottom > lim) sc.scrollTop += r.bottom - lim + 8; }, 250);
  };
  document.addEventListener('focusin', e => { if (isCell(e.target)) { e.target.setAttribute('enterkeyhint', 'next'); show(e.target); } });
  document.addEventListener('focusout', () => setTimeout(() => { if (bar && !isCell(document.activeElement)) { bar.classList.remove('on'); document.querySelectorAll('#scGrid tr.sc-cur').forEach(x => x.classList.remove('sc-cur')); } }, 120));
})();

save(); render();
})();
