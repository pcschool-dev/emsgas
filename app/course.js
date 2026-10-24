/* EMS — โครงสร้างรายวิชา (หน้า course ของครู) + คำอธิบายรายวิชา + เอกสารสั่งพิมพ์
   - โครงสร้าง (หน่วยการเรียนรู้) เก็บในสมุดคะแนนของห้อง b.course = { units: [{ id, name, inds: [id ตัวชี้วัดใน b.indicators], essence, hours, weight }] }
     ซิงก์ไปกับสมุดคะแนน (คอลเลกชัน books) · ห้องอื่นที่สอนวิชาเดียวกันคัดลอกไปได้ (จับคู่ตัวชี้วัดด้วยรหัส)
     u.sec = 'before' | 'after' (ช่วงคะแนน) · b.course.plan = { mid, final } สัดส่วนสอบกลาง/ปลายภาคที่วางไว้ในโครงร่าง
   - วางโครงร่าง: กำหนดจำนวนหน่วยก่อน/หลังกลางภาคและสัดส่วน 4 ส่วน → แบ่งเวลาและน้ำหนักให้หน่วยเท่า ๆ กัน (แก้ต่อในตารางได้)
   - ส่งไปหัวข้อคะแนน: หน่วยละ 1 หัวข้อ (it.unitId ผูกกับหน่วย) ส่งซ้ำ = อัปเดตชื่อ/สัดส่วน/ช่วง ไม่ลบคะแนน ครูปรับเพิ่มลดที่หน้าหัวข้อคะแนนต่อ
   - คำอธิบายรายวิชา เก็บต่อรหัสวิชา ใช้ร่วมทั้งโรงเรียนและข้ามปีการศึกษา: courseDesc/{รหัสวิชา} = { code, name, text, prev, by, byName, at }
     อ่านครั้งเดียวตอนเปิดหน้า (get ไม่ฟังสด) · prev = ข้อความก่อนแก้ครั้งล่าสุด (กู้คืนได้)
   - พิมพ์: หัวเอกสาร + คำอธิบาย + ตัวชี้วัด + ตารางหน่วย + สัดส่วนคะแนน + ช่องลงนาม (ครูผู้สอน · หัวหน้ากลุ่มสาระ · รองผู้อำนวยการฝ่ายวิชาการ)
   โหมดตัวอย่าง (ไม่ LIVE): คำอธิบายเก็บที่ S.courseDescLocal */
(() => {
  'use strict';
  const chip = (t, k = '') => `<span class="chip ${k}">${t}</span>`;
  const low = s => String(s || '').trim().toLowerCase();
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const uid = p => p + '_' + Math.random().toString(36).slice(2, 9);
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const fmt = n => (Math.round(n * 100) / 100).toString();
  const AREA = { 'ท': 'ภาษาไทย', 'ค': 'คณิตศาสตร์', 'ว': 'วิทยาศาสตร์และเทคโนโลยี', 'ส': 'สังคมศึกษา ศาสนา และวัฒนธรรม', 'พ': 'สุขศึกษาและพลศึกษา', 'ศ': 'ศิลปะ', 'ง': 'การงานอาชีพ', 'อ': 'ภาษาต่างประเทศ', 'จ': 'ภาษาต่างประเทศ', 'ญ': 'ภาษาต่างประเทศ', 'ก': 'ภาษาต่างประเทศ', 'ฝ': 'ภาษาต่างประเทศ', 'ร': 'ภาษาต่างประเทศ', 'ซ': 'ภาษาต่างประเทศ', 'ย': 'ภาษาต่างประเทศ' };
  const docKey = code => String(code).replace(/[^A-Za-z0-9ก-๙_-]/g, '_');
  const by = () => low((LIVE && window.EMSCloud && EMSCloud.email && EMSCloud.email()) || S.me.email);
  const locked = () => !!(window.EMSAdmin && EMSAdmin.lockedNow && EMSAdmin.lockedNow());       // ภาคที่กำลังดูปิดแล้ว (admin.js ครอบหน้านี้ไม่ได้ เพราะโหลดก่อน)
  const bookOk = c => !LIVE || !window.EMSCloud || !EMSCloud.bookReady || EMSCloud.bookReady(c.id);      // สมุดของห้องโหลดจากระบบแล้ว (ยังไม่โหลด = ที่แก้จะถูกข้อมูลระบบทับ)

  /* ---------- ข้อมูลวิชาของห้อง ---------- */
  const myClasses = () => (S.classes || []).filter(c => c.subject && c.subject !== 'ห้องที่ปรึกษา');
  const codeOf = c => String(c.subject || '').trim().split(/\s+/)[0] || '';
  const nameOf = c => String(c.subject || '').trim().split(/\s+/).slice(1).join(' ');
  function info(c) {
    const code = codeOf(c), cur = (window.EMSCur && EMSCur.subj && EMSCur.subj(code)) || null, meta = (S.bookMeta || {})[c.id] || {};
    const hpw = Object.entries(S.tt || {}).filter(([, cid]) => cid === c.id).length;
    const lv = (String(c.name).match(/ม\.\s*(\d)/) || [])[1];
    const t = cur && cur.t ? cur.t : (code.charAt(3) === '1' ? 'B' : code.charAt(3) === '2' ? 'A' : '');
    return {
      code, name: (cur && cur.n) || nameOf(c), area: meta.learningArea || (cur && cur.a && EMSCur.areaName && EMSCur.areaName(cur.a)) || AREA[code.charAt(0)] || '',      // cur.a = รหัสกลุ่มสาระ (TH, SC …)
      level: lv ? 'มัธยมศึกษาปีที่ ' + lv : c.name, type: t === 'B' ? 'รายวิชาพื้นฐาน' : t === 'A' ? 'รายวิชาเพิ่มเติม' : '',
      hpw: meta.hoursPerWeek || hpw || '', hours: meta.totalHours || (hpw ? hpw * 20 : ''), credits: meta.credits || (cur && cur.cr) || (hpw ? hpw * 0.5 : ''),
      teacher: meta.teacherName || S.me.name, term: (S.viewTerm && S.viewTerm.year ? S.viewTerm : S.term) || {}      // ภาคที่กำลังดู (ตรงกับสมุดที่แสดง)
    };
  }
  const bookOf = c => (window.EMSBook ? EMSBook.book(c.id) : null);
  const courseOf = b => { b.course = b.course && typeof b.course === 'object' ? b.course : {}; if (!Array.isArray(b.course.units)) b.course.units = []; return b.course; };

  /* ---------- คำอธิบายรายวิชา (ต่อรหัสวิชา) ---------- */
  const desc = {};            // รหัส → { text, prev, byName, at } | null (ไม่มี) · ยังไม่โหลด = undefined
  const descErr = {};         // รหัส → ข้อความเมื่ออ่านไม่สำเร็จ (ห้ามถือว่า "ไม่มีคำอธิบาย" ไม่งั้นบันทึกทับของจริง)
  const loading = {};
  async function fetchDesc(code) {
    if (!LIVE) return ((S.courseDescLocal || {})[code]) || null;
    const d = await EMSCloud.db().collection('courseDesc').doc(docKey(code)).get(); return d.exists ? d.data() : null;
  }
  async function loadDesc(code) {
    if (!code || loading[code] || desc[code] !== undefined || descErr[code]) return;
    loading[code] = true;
    try { desc[code] = await fetchDesc(code); }
    catch (e) { descErr[code] = e.code === 'permission-denied' ? 'อ่านคำอธิบายรายวิชาไม่ได้ — ตรวจว่าวาง firestore.rules รุ่นใหม่แล้ว' : 'อ่านคำอธิบายรายวิชาไม่สำเร็จ (' + (e.code || e.message) + ')'; }
    loading[code] = false; if (page === 'course') redraw();
  }
  /* prev = ข้อความที่โหลดมา · rules รับเฉพาะเมื่อ prev ตรงกับข้อความล่าสุดในระบบ → มีคนแก้ก่อนจะถูกปฏิเสธ (er.conflict) แล้วโหลดของล่าสุดมาให้ */
  async function saveDesc(c, text) {
    const code = codeOf(c), old = desc[code], now = new Date(); if (old === undefined) throw new Error('ยังโหลดคำอธิบายเดิมไม่สำเร็จ');
    const d = { code, name: info(c).name.slice(0, 200), text, prev: String((old && old.text) || ''), by: by(), byName: String(S.me.name || ''), at: now.toISOString() };
    if (!LIVE) { (S.courseDescLocal = S.courseDescLocal || {})[code] = d; save(); desc[code] = d; delete ui.draft[code]; return; }
    try { await EMSCloud.db().collection('courseDesc').doc(docKey(code)).set(d); }
    catch (e) {
      if (e.code === 'permission-denied') { let x; try { x = await fetchDesc(code); } catch (er) { throw e; }
        if (String((x && x.text) || '') !== d.prev) { desc[code] = x; ui.conflict[code] = true; e.conflict = true; } }
      throw e;
    }
    desc[code] = d; delete ui.draft[code]; delete ui.conflict[code];
  }

  /* ---------- หน้าโครงสร้างรายวิชา ---------- */
  const ui = { cid: '', draft: {}, conflict: {} };      // draft: รหัส → ข้อความที่พิมพ์ไว้แต่ยังไม่บันทึก (วาดใหม่แล้วไม่หาย) · conflict: บันทึกชนกับคนอื่น
  const hasDraft = code => ui.draft[code] !== undefined && ui.draft[code] !== String((desc[code] && desc[code].text) || '');
  const cur = () => { const L = myClasses(); return L.find(c => c.id === ui.cid) || L[0] || null; };
  const fmtAt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const indLabel = x => (x.code ? x.code + ' ' : '') + (x.text || '');

  function unitsTable(b, co, ro) {      // ro = ภาคปิดแล้ว ดูได้อย่างเดียว
    const dis = ro ? ' disabled' : '';
    const inds = b.indicators || [], U = co.units;
    const sumH = U.reduce((a, u) => a + num(u.hours), 0), sumW = U.reduce((a, u) => a + num(u.weight), 0);
    return `<div class="scroll"><table class="tbl cs-tbl"><thead><tr><th style="width:44px">หน่วย</th><th style="min-width:180px">ชื่อหน่วยการเรียนรู้</th><th style="min-width:160px">ตัวชี้วัด / ผลการเรียนรู้</th><th style="min-width:220px">สาระสำคัญ</th><th style="width:120px">ช่วงคะแนน</th><th style="width:80px">เวลา (ชม.)</th><th style="width:90px">น้ำหนักคะแนน</th><th style="width:96px"></th></tr></thead><tbody>
      ${U.map((u, i) => { const sel = (u.inds || []).map(id => inds.find(x => x.id === id)).filter(Boolean);
        return `<tr data-u="${esc(u.id)}"><td style="text-align:center"><b>${i + 1}</b></td>
          <td><input class="in" data-cs="uname"${dis} value="${esc(u.name || '')}" placeholder="ชื่อหน่วย"></td>
          <td><div class="small">${sel.map(x => esc(x.code || x.text)).join(', ') || '<span class="muted">ยังไม่เลือก</span>'}</div>${inds.length ? `<button class="btn sm ghost" data-cs="uinds"${dis} style="margin-top:4px">เลือกตัวชี้วัด</button>` : ''}</td>
          <td><textarea class="in" rows="2" data-cs="uess"${dis} placeholder="สาระสำคัญ / ความคิดรวบยอด">${esc(u.essence || '')}</textarea></td>
          <td><select class="in" data-cs="usec"${dis} style="min-width:110px"><option value="before"${u.sec === 'after' ? '' : ' selected'}>ก่อนกลางภาค</option><option value="after"${u.sec === 'after' ? ' selected' : ''}>หลังกลางภาค</option></select></td>
          <td><input class="in" inputmode="decimal" data-cs="uhrs"${dis} value="${esc(u.hours ?? '')}" style="width:70px"></td>
          <td><input class="in" inputmode="decimal" data-cs="uwt"${dis} value="${esc(u.weight ?? '')}" style="width:80px"></td>
          <td style="white-space:nowrap"><button class="btn sm ghost" data-cs="up" ${i && !ro ? '' : 'disabled'} aria-label="เลื่อนขึ้น">↑</button><button class="btn sm ghost" data-cs="down" ${i < U.length - 1 && !ro ? '' : 'disabled'} aria-label="เลื่อนลง">↓</button><button class="btn sm ghost" style="color:var(--bad)" data-cs="del"${dis} aria-label="ลบหน่วย">ลบ</button></td></tr>`; }).join('') || `<tr><td colspan="8" class="muted" style="text-align:center">ยังไม่มีหน่วยการเรียนรู้ — กด “วางโครงร่าง” หรือ “เพิ่มหน่วย”</td></tr>`}
      </tbody>${U.length ? `<tfoot><tr><td colspan="5" style="text-align:right"><b>รวม</b></td><td><b id="cs-sumh">${fmt(sumH)}</b></td><td><b id="cs-sumw">${fmt(sumW)}</b></td><td></td></tr></tfoot>` : ''}</table></div>`;
  }
  function weightBar(b) {
    const w = b.weights || {}, parts = [['ก่อนกลางภาค', num(w.before), 'var(--brand)'], ['กลางภาค', num(w.mid), 'var(--gold)'], ['หลังกลางภาค', num(w.after), 'var(--info)'], ['ปลายภาค', num(w.final), 'var(--ok)']].filter(p => p[1] > 0);
    return `<div class="ems-wbar" style="display:flex;height:32px;border-radius:8px;overflow:hidden;font-size:.8rem;font-weight:600;color:#fff">${parts.map(([l, v, c]) => `<div style="flex:${v};background:${c};display:grid;place-items:center;white-space:nowrap;padding:0 4px">${esc(l)} ${fmt(v)}</div>`).join('')}</div>
      <p class="muted small" style="margin-top:6px">ดึงจาก “หัวข้อคะแนน” ของสมุดคะแนน · ระหว่างภาค ${fmt(num(w.before) + num(w.mid) + num(w.after))} : ปลายภาค ${fmt(num(w.final))}</p>`;
  }

  P.course = () => {
    const L = myClasses();
    const head = `<div class="top"><div><h1>โครงสร้างรายวิชา</h1><p>คำอธิบายรายวิชา หน่วยการเรียนรู้ และสัดส่วนคะแนน — พิมพ์เป็นเอกสารได้</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${L.length ? `<button class="btn pri" data-cs="print">${ic('print')}พิมพ์โครงสร้างรายวิชา</button>` : ''}</div></div>`;
    if (!L.length) return head + `<div class="card"><div class="empty">ยังไม่มีรายวิชาที่สอนในภาคนี้ (ดึงจากตารางสอน)</div></div>`;
    const c = cur(); ui.cid = c.id;
    const pills = `<div class="pills" role="group" aria-label="เลือกรายวิชา/ห้อง">${L.map(x => `<button class="pill" aria-pressed="${x.id === c.id}" data-cs="cls" data-c="${esc(x.id)}">${esc(codeOf(x))} · ${esc(x.name)}</button>`).join('')}</div>`;
    const b = bookOk(c) && bookOf(c); if (!b) return head + pills + `<div class="card"><div class="empty">กำลังโหลดสมุดคะแนน…</div></div>`;
    const co = courseOf(b), I = info(c), code = I.code, D = desc[code], ro = locked();
    if (D === undefined) setTimeout(() => loadDesc(code), 0);
    const same = L.filter(x => x.id !== c.id && codeOf(x) === code);
    const mine = (S.courseSub || []).filter(x => x.by === S.me.name), CSL = { draft: ['ร่าง', ''], submitted: ['รอตรวจ', 'warn'], approved: ['ผ่าน', 'ok'], revise: ['แก้ไข', 'bad'] };
    return head + (ro ? `<div class="notice bad"><b>ภาคเรียนนี้ปิดแล้ว</b> — หน่วยการเรียนรู้ดูได้อย่างเดียว (คำอธิบายรายวิชาไม่ผูกภาค แก้ได้ตามเดิม)</div>` : '') + pills + `
      <div class="card"><div class="grid g2 cs-info">
        <div><span class="muted small">รหัสวิชา</span><div class="t">${esc(I.code)}</div></div><div><span class="muted small">รายวิชา</span><div class="t">${esc(I.name)}${I.type ? ` <span class="muted small">(${esc(I.type)})</span>` : ''}</div></div>
        <div><span class="muted small">กลุ่มสาระการเรียนรู้</span><div class="t">${esc(I.area || '—')}</div></div><div><span class="muted small">ระดับชั้น · ภาคเรียน</span><div class="t">${esc(I.level)} · ${esc(I.term.sem || '')}/${esc(I.term.year || '')}</div></div>
        <div><span class="muted small">เวลาเรียน</span><div class="t">${I.hours ? esc(I.hours) + ' ชั่วโมง' : '—'}${I.hpw ? ` <span class="muted small">(${esc(I.hpw)} ชม./สัปดาห์)</span>` : ''}</div></div><div><span class="muted small">หน่วยกิต</span><div class="t">${I.credits !== '' ? esc(fmt(num(I.credits))) : '—'}</div></div>
      </div><p class="muted small" style="margin-top:8px">แก้ชื่อครู เวลาเรียน หน่วยกิต และกลุ่มสาระได้ที่ “สรุป / ส่งออก ปพ.5 › ข้อมูลหน้าปก” ของห้องนี้</p></div>

      <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><h2 style="margin:0">คำอธิบายรายวิชา</h2><span class="grow"></span>
          <button class="btn sm" data-cs="paste">วางจากคลิปบอร์ด</button><button class="btn sm" data-cs="insInd" ${(b.indicators || []).length ? '' : 'disabled'}>แทรกรหัสตัวชี้วัด</button><button class="btn sm" data-cs="copy">คัดลอก</button></div>
        ${descErr[code] ? `<div class="notice" style="background:var(--warn-soft)">${esc(descErr[code])} — ยังแก้/บันทึกไม่ได้ เพื่อไม่ให้เขียนทับคำอธิบายเดิม <button class="btn sm" data-cs="reloadDesc">ลองโหลดใหม่</button></div>`
        : D === undefined ? '<div class="empty">กำลังโหลด…</div>' : `${ui.conflict[code] ? `<div class="notice" style="background:var(--warn-soft)"><b>มีคนแก้คำอธิบายนี้ก่อนคุณ</b> — ในช่องคือร่างของคุณ ด้านล่างคือข้อความล่าสุดในระบบ${D && D.at ? ` (โดย ${esc(D.byName || D.by || '')} · ${esc(fmtAt(D.at))})` : ''} ตรวจ/รวมแล้วกดบันทึกอีกครั้ง</div>` : ''}<textarea id="cs-desc" data-code="${esc(code)}" class="in" rows="8" style="width:100%;line-height:1.7" placeholder="วางหรือพิมพ์คำอธิบายรายวิชา ${esc(code)} — ใช้ร่วมกับครูทุกคนที่สอนวิชานี้ และใช้ต่อในปีการศึกษาถัดไปโดยอัตโนมัติ">${esc(ui.draft[code] ?? ((D && D.text) || ''))}</textarea>
        ${ui.conflict[code] ? `<div class="muted small" style="margin-top:8px">ข้อความล่าสุดในระบบ (คัดลอกได้)</div><textarea class="in" rows="5" readonly style="width:100%;line-height:1.7">${esc((D && D.text) || '')}</textarea>` : ''}
        <div class="row" style="border:0;padding:8px 0 0;flex-wrap:wrap;gap:8px"><div class="muted small grow">${D && D.at ? `แก้ล่าสุดโดย ${esc(D.byName || D.by || '')} · ${esc(fmtAt(D.at))}` : 'ยังไม่มีคำอธิบายของรหัสวิชานี้'} · ใช้ร่วมทุกห้อง/ทุกปีของรหัส ${esc(code)}</div>
          ${D && D.prev ? `<button class="btn sm ghost" data-cs="undoDesc">ใช้ข้อความก่อนแก้ครั้งล่าสุด</button>` : ''}<button class="btn sm pri" data-cs="saveDesc">บันทึกคำอธิบาย</button></div>`}</div>

      <div class="card"><h2>ตัวชี้วัด / ผลการเรียนรู้</h2>${(b.indicators || []).length ? `<div class="list">${b.indicators.map(x => `<div class="row" style="padding:6px 0"><div class="grow small"><b>${esc(x.code || '')}</b> ${esc(x.text || '')}</div>${chip(x.kind === 'S' ? 'ปลายทาง' : 'ระหว่างทาง')}</div>`).join('')}</div>` : `<div class="empty">ยังไม่มีตัวชี้วัดในสมุดคะแนนของห้องนี้ <button class="btn sm" data-act="go" data-p="indicators">เพิ่มที่หน้าตัวชี้วัด</button></div>`}</div>

      <div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><h2 style="margin:0">หน่วยการเรียนรู้</h2><span class="grow"></span>
          ${same.length ? `<button class="btn sm" data-cs="copyTo"${ro ? ' disabled' : ''}>ใช้กับห้องอื่นที่สอนวิชานี้ (${same.length})</button>` : ''}<button class="btn sm" data-cs="plan"${ro ? ' disabled' : ''}>วางโครงร่าง</button><button class="btn sm pri" data-cs="add"${ro ? ' disabled' : ''}>${ic('plus')}เพิ่มหน่วย</button></div>
        ${planNote(b, co)}${unitsTable(b, co, ro)}
        <div class="row" style="border:0;flex-wrap:wrap;gap:8px;padding-bottom:0"><p class="muted small grow" style="margin:0">พิมพ์แล้วบันทึกอัตโนมัติไปกับสมุดคะแนนของห้องนี้ · น้ำหนักคะแนนของหน่วย = สัดส่วน (%) ของหัวข้อคะแนน</p>
          ${co.units.length ? `<button class="btn sm pri" data-cs="toItems"${ro ? ' disabled' : ''}>ส่งไปหัวข้อคะแนน</button>` : ''}</div></div>

      <div class="card"><h2>สัดส่วนคะแนน</h2>${weightBar(b)}</div>
      ${mine.length ? `<div class="card"><h2>ส่งให้หัวหน้ากลุ่มสาระตรวจ</h2><div class="list">${mine.map(x => { const [l, k] = CSL[x.status] || [x.status, ''];
        return `<div class="row" style="flex-wrap:wrap"><div class="ico">${ic('book')}</div><div class="grow"><div class="t">${esc(x.label)}</div>${x.note ? `<div class="small" style="color:var(--bad)">หัวหน้าแจ้ง: ${esc(x.note)}</div>` : ''}</div>${chip(esc(l), k)}${x.status === 'draft' || x.status === 'revise' ? `<button class="btn sm pri" data-act="crsSend" data-id="${esc(x.id)}">ส่งตรวจ</button>` : ''}</div>`; }).join('')}</div></div>` : ''}`;
  };

  /* ---------- วางโครงร่าง ---------- */
  const r2 = n => Math.round(n * 100) / 100;
  const split = (tot, n, step) => { if (n <= 0) return []; const each = Math.floor(tot / n / step) * step, out = Array(n).fill(r2(each));      // หารเท่า ๆ กัน เศษแจกหน่วยแรก ๆ ทีละขั้น (รวมตรงเสมอ)
    let rem = r2(tot - each * n); for (let i = 0; rem >= step - 1e-9 && i < n; i++) { out[i] = r2(out[i] + step); rem = r2(rem - step); } if (rem) out[n - 1] = r2(out[n - 1] + rem); return out; };
  const planSums = (b, co) => { const U = co.units, p = co.plan || {}, w = b.weights || {};
    const sb = U.filter(u => u.sec !== 'after').reduce((a, u) => a + num(u.weight), 0), sa = U.filter(u => u.sec === 'after').reduce((a, u) => a + num(u.weight), 0);
    const mid = p.mid !== undefined ? num(p.mid) : num(w.mid), fin = p.final !== undefined ? num(p.final) : num(w.final);
    return { sb, sa, mid, fin, tot: r2(sb + sa + mid + fin) }; };
  function planNote(b, co) {
    if (!co.units.length) return '';
    const P = planSums(b, co), ok = Math.abs(P.tot - 100) < 0.005;
    return `<div class="notice"${ok ? ' style="background:var(--ok-soft)"' : ''}>โครงร่าง: ก่อนกลางภาค <b>${fmt(P.sb)}</b> · สอบกลางภาค <b>${fmt(P.mid)}</b> · หลังกลางภาค <b>${fmt(P.sa)}</b> · สอบปลายภาค <b>${fmt(P.fin)}</b> = <b>${fmt(P.tot)}</b>%${ok ? '' : ' — ยังไม่ครบ 100 (ปรับน้ำหนักหน่วย หรือกด “วางโครงร่าง”)'}</div>`;
  }
  function planModal(b, co, I) {
    const U = co.units, w = b.weights || {}, P = planSums(b, co);
    const nb = U.filter(u => u.sec !== 'after').length, na = U.filter(u => u.sec === 'after').length;
    const v = (k, d) => `value="${esc(d)}" data-pl="${k}"`;
    modal(`<h2 style="margin-bottom:4px">วางโครงร่างรายวิชา</h2><p class="muted small" style="margin-bottom:12px">กำหนดจำนวนหน่วยและสัดส่วนคะแนน ระบบแบ่งเวลาและน้ำหนักให้แต่ละหน่วยเท่า ๆ กัน แล้วค่อยแก้รายหน่วยในตาราง — ชื่อหน่วย สาระสำคัญ และตัวชี้วัดที่กรอกไว้ยังอยู่</p>
      <div class="grid g2" style="gap:10px">
        <label class="small">จำนวนหน่วยก่อนกลางภาค<input class="in" type="number" min="0" max="20" ${v('nb', U.length ? nb : 2)}></label>
        <label class="small">จำนวนหน่วยหลังกลางภาค<input class="in" type="number" min="0" max="20" ${v('na', U.length ? na : 2)}></label>
        <label class="small">คะแนนเก็บก่อนกลางภาค (%)<input class="in" inputmode="decimal" ${v('wb', U.length ? P.sb : num(w.before) || 30)}></label>
        <label class="small">สอบกลางภาค (%)<input class="in" inputmode="decimal" ${v('wm', P.mid)}></label>
        <label class="small">คะแนนเก็บหลังกลางภาค (%)<input class="in" inputmode="decimal" ${v('wa', U.length ? P.sa : num(w.after) || 30)}></label>
        <label class="small">สอบปลายภาค (%)<input class="in" inputmode="decimal" ${v('wf', P.fin)}></label>
        <label class="small">เวลาเรียนที่แบ่งให้หน่วย (ชม.)<input class="in" inputmode="decimal" ${v('hrs', I.hours || '')}></label>
        <label class="small">ปัดน้ำหนักต่อหน่วยทีละ<select class="in" data-pl="step"><option value="1">1 คะแนน</option><option value="0.5">0.5 คะแนน</option></select></label>
      </div>
      <div id="pl-sum" class="small" style="margin-top:10px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" data-cs="planDo">วางโครงร่าง</button></div>`, true);
    planCheck();
  }
  const plVal = k => { const el = document.querySelector('[data-pl="' + k + '"]'); return el ? el.value : ''; };
  function planCheck() {
    const el = $('#pl-sum'); if (!el) return;
    const tot = r2(num(plVal('wb')) + num(plVal('wm')) + num(plVal('wa')) + num(plVal('wf'))), ok = Math.abs(tot - 100) < 0.005;
    el.innerHTML = `รวม <b style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${fmt(tot)}</b> / 100%${ok ? '' : ' — ควรรวมเป็น 100'}`;
  }
  function planApply(co) {
    const nb = Math.max(0, Math.min(20, Math.round(num(plVal('nb'))))), na = Math.max(0, Math.min(20, Math.round(num(plVal('na')))));
    const wb = Math.max(0, num(plVal('wb'))), wa = Math.max(0, num(plVal('wa'))), step = num(plVal('step')) || 1, H = Math.max(0, num(plVal('hrs')));
    if (!nb && !na) { toast('ใส่จำนวนหน่วยอย่างน้อย 1 หน่วย'); return false; }
    if (wb > 0 && !nb || wa > 0 && !na) { toast('มีคะแนนเก็บแต่ไม่มีหน่วยในช่วงนั้น — ใส่จำนวนหน่วย หรือใส่คะแนนเป็น 0'); return false; }
    const old = co.units.slice(), oB = old.filter(u => u.sec !== 'after'), oA = old.filter(u => u.sec === 'after');
    const lost = old.filter(u => (u.sec === 'after' ? oA.indexOf(u) >= na : oB.indexOf(u) >= nb) && (u.name || u.essence || (u.inds || []).length));
    if (lost.length && !confirm('หน่วยที่เกินจำนวนใหม่จะถูกลบ ' + lost.length + ' หน่วย (' + lost.map(u => u.name || 'ไม่มีชื่อ').join(', ') + ') — ทำต่อหรือไม่?')) return false;
    const mk = (src, sec) => Object.assign({ id: uid('u'), name: '', inds: [], essence: '' }, src || {}, { sec });
    const U = [].concat(Array.from({ length: nb }, (_, i) => mk(oB[i], 'before')), Array.from({ length: na }, (_, i) => mk(oA[i], 'after')));
    const WB = split(wb, nb, step), WA = split(wa, na, step);
    U.forEach((u, i) => { u.weight = i < nb ? WB[i] : WA[i - nb]; });
    if (H > 0) { const base = Math.floor(H / U.length), extra = Math.round(H - base * U.length);      // ชั่วโมงเต็มหน่วยละเท่ากัน ที่เหลือไล่ให้หน่วยแรก ๆ
      U.forEach((u, i) => { u.hours = base + (i < extra ? 1 : 0); }); const left = r2(H - U.reduce((a, u) => a + u.hours, 0)); if (left) U[U.length - 1].hours = r2(U[U.length - 1].hours + left); }
    co.units = U; co.plan = { mid: Math.max(0, num(plVal('wm'))), final: Math.max(0, num(plVal('wf'))) };
    return true;
  }

  /* ---------- ส่งหน่วยไปเป็นหัวข้อคะแนน ---------- */
  const hasScore = (b, it) => [b.scores, b.componentScores, b.itemRetakes].some(m => m && Object.keys(m).some(s => m[s] && m[s][it.id] !== undefined && m[s][it.id] !== '')) || !!(b.gscores && b.gscores[it.id] && Object.keys(b.gscores[it.id]).length);
  const strayItems = (b, co) => (b.items || []).filter(it => !it.unitId || !co.units.some(u => u.id === it.unitId));      // หัวข้อที่ไม่ได้มาจากหน่วยปัจจุบัน
  function toItems(b, co) {
    const U = co.units, items = b.items || [], add = U.filter(u => !items.some(it => it.unitId === u.id)).length, upd = U.length - add;
    const extra = strayItems(b, co), extraFree = extra.filter(it => !hasScore(b, it)), P = planSums(b, co);
    modal(`<h2 style="margin-bottom:6px">ส่งไปหัวข้อคะแนน</h2>
      <p class="small" style="margin-bottom:8px">สร้างหัวข้อคะแนนหน่วยละ 1 หัวข้อ ใช้น้ำหนักของหน่วยเป็นสัดส่วน (%) และช่วงก่อน/หลังกลางภาคตามโครงร่าง</p>
      <ul class="small" style="margin:0 0 8px 18px"><li>เพิ่มหัวข้อใหม่ <b>${add}</b> หัวข้อ${upd ? ` · อัปเดตหัวข้อที่เคยส่งไปแล้ว <b>${upd}</b> หัวข้อ (ชื่อ สัดส่วน ช่วง — คะแนนที่กรอกไว้ไม่หาย)` : ''}</li>
        <li>สอบกลางภาค <b>${fmt(P.mid)}</b>% · สอบปลายภาค <b>${fmt(P.fin)}</b>% · รวมทั้งหมด <b>${fmt(P.tot)}</b>%</li></ul>
      ${extra.length ? `<label class="row small" style="border:0;gap:8px;align-items:flex-start"><input type="checkbox" id="ti-del" ${extraFree.length ? 'checked' : 'disabled'}><span>ลบหัวข้อคะแนนเดิมที่ไม่ได้มาจากโครงสร้าง ${extraFree.length} หัวข้อที่ยังไม่มีคะแนน${extra.length > extraFree.length ? ` (อีก ${extra.length - extraFree.length} หัวข้อมีคะแนนแล้ว จะเก็บไว้)` : ''}<br><span class="muted">${extra.map(it => esc(it.name)).join(', ')}</span></span></label>` : ''}
      ${extra.length > extraFree.length ? `<div class="notice" style="margin-top:8px">หัวข้อที่มีคะแนนแล้วยังอยู่ สัดส่วนรวมจึงอาจเกิน 100% — ไปปรับที่หน้าหัวข้อคะแนน (มีปุ่ม “ปรับให้ครบ 100%”)</div>` : ''}
      <p class="muted small" style="margin-top:8px">ส่งแล้วไปปรับเพิ่ม/ลด แบ่งช่องย่อย หรือเปลี่ยนประเภท (เช่น สอบ มีช่องซ่อม) ได้ที่หน้าหัวข้อคะแนน</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" data-cs="toItemsDo">ส่งไปหัวข้อคะแนน</button></div>`, true);
  }
  function toItemsDo(b, co) {
    const B = window.EMSBook || {};
    if (($('#ti-del') || {}).checked) { const drop = strayItems(b, co).filter(it => !hasScore(b, it)).map(it => it.id);
      b.items = b.items.filter(it => drop.indexOf(it.id) < 0);
      drop.forEach(id => { ['scores', 'componentScores', 'itemRetakes'].forEach(m => b[m] && Object.keys(b[m]).forEach(s => b[m][s] && Object.keys(b[m][s]).forEach(k => { if (k === id || k.indexOf(id + '~') === 0) delete b[m][s][k]; })));      // รวมซ่อมรายช่อง (หน่วย~ช่อง)
        if (b.gscores) delete b.gscores[id]; if (b.presenters) delete b.presenters[id]; }); }
    co.units.forEach((u, i) => {
      const nm = 'หน่วยที่ ' + (i + 1) + (u.name ? ' ' + u.name : ''), sec = u.sec === 'after' ? 'after' : 'before', mx = Math.max(0, num(u.weight)), it = b.items.find(x => x.unitId === u.id);
      if (!it) { b.items.push({ id: uid('it'), name: nm, max: mx, kind: 'individual', groupSetId: '', components: [], scoreSection: sec, unitId: u.id }); return; }
      it.name = nm; it.scoreSection = sec;
      if (num(it.max) !== mx) { it.max = mx; if ((it.components || []).length && B.rescaleComps) { B.rescaleComps(it); if (B.resyncUnit) B.resyncUnit(b, it); } }
    });
    const ord = id => { const k = co.units.findIndex(u => u.id === id); return k < 0 ? 1e3 : k; };      // เรียงหัวข้อตามลำดับหน่วย หัวข้ออื่นต่อท้ายตามเดิม
    b.items = b.items.map((it, i) => [it, i]).sort((x, y) => ord(x[0].unitId) - ord(y[0].unitId) || x[1] - y[1]).map(x => x[0]);
    const P = planSums(b, co); b.weights.mid = P.mid; b.weights.final = P.fin;
    if (B.book) B.book(cur().id);      // คำนวณสัดส่วนก่อน/หลังกลางภาคใหม่จากหัวข้อ
    save();
  }

  /* ---------- เลือกตัวชี้วัดของหน่วย ---------- */
  function indModal(b, u) {
    const inds = b.indicators || [], on = new Set(u.inds || []);
    modal(`<h2 style="margin-bottom:4px">ตัวชี้วัดของหน่วย</h2><p class="muted small" style="margin-bottom:10px">${esc(u.name || 'หน่วยที่ยังไม่มีชื่อ')}</p>
      <div style="max-height:55vh;overflow:auto;display:grid;gap:6px">${inds.map(x => `<label class="row" style="border:0;padding:4px 0;gap:8px;align-items:flex-start"><input type="checkbox" data-csi="${esc(x.id)}" ${on.has(x.id) ? 'checked' : ''}><span class="small">${esc(indLabel(x))}</span></label>`).join('')}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">ยกเลิก</button><button class="btn pri" data-cs="indSave" data-u="${esc(u.id)}">ใช้ตัวชี้วัดที่เลือก</button></div>`, true);
  }

  /* ---------- เอกสารสั่งพิมพ์ ---------- */
  /* หัวหน้ากลุ่มสาระ: ฝ่ายจากหลักสูตร (EMSCur.deptOf เทียบชื่อฝ่ายจริง) · ไม่มีหลักสูตร = เทียบชื่อกลุ่มสาระกับชื่อฝ่ายทั้งสองทาง */
  function headOf(code, area) {
    const dept = (window.EMSCur && EMSCur.deptOf && EMSCur.deptOf(code)) || '', a = String(area || '').split(' ')[0];
    const h = (S.staff || []).find(u => { const d = String(u.dept || '').trim(); return [].concat(u.roles || [], u.role || []).indexOf('head') >= 0 && d && (dept ? d === dept : !!a && (d.indexOf(a) >= 0 || a.indexOf(d) >= 0)); });
    return h ? h.name : '';
  }
  function docHtml(c) {
    const b = bookOf(c), co = courseOf(b), I = info(c), D = desc[I.code], inds = b.indicators || [], st = S.settings || {}, w = b.weights || {};
    const U = co.units, sumH = U.reduce((a, u) => a + num(u.hours), 0), sumW = U.reduce((a, u) => a + num(u.weight), 0);
    const sig = (role, name) => `<div class="cp-sig"><div>ลงชื่อ ........................................................</div><div>( ${esc(name || '........................................................')} )</div><div>${esc(role)}</div></div>`;
    return `<div class="cp-page">
      <div class="cp-head"><img src="${esc(new URL(window.EMSLogo ? EMSLogo() : 'icons/school-logo.png', location.href).href)}" alt=""><div><div class="cp-title">โครงสร้างรายวิชา</div><div>${esc(st.schoolName || 'โรงเรียนปากช่อง')}</div></div></div>
      <table class="cp-info"><tr><td><b>รหัสวิชา</b> ${esc(I.code)}</td><td><b>รายวิชา</b> ${esc(I.name)}${I.type ? ` (${esc(I.type)})` : ''}</td></tr>
        <tr><td><b>กลุ่มสาระการเรียนรู้</b> ${esc(I.area)}</td><td><b>ระดับชั้น</b> ${esc(I.level)} &nbsp; <b>ภาคเรียนที่</b> ${esc(I.term.sem || '')} &nbsp; <b>ปีการศึกษา</b> ${esc(I.term.year || '')}</td></tr>
        <tr><td><b>เวลาเรียน</b> ${esc(I.hours || '……')} ชั่วโมง${I.hpw ? ` (${esc(I.hpw)} ชั่วโมง/สัปดาห์)` : ''}</td><td><b>จำนวน</b> ${I.credits !== '' ? esc(fmt(num(I.credits))) : '……'} หน่วยกิต &nbsp; <b>ครูผู้สอน</b> ${esc(I.teacher)}</td></tr></table>
      <h3>คำอธิบายรายวิชา</h3><div class="cp-desc">${String(ui.draft[I.code] ?? ((D && D.text) || '')).split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('') || '<span style="color:#888">(ยังไม่มีคำอธิบายรายวิชา)</span>'}</div>
      ${inds.length ? `<h3>ตัวชี้วัด / ผลการเรียนรู้</h3><div class="cp-inds">${inds.map(x => `<div>${esc(indLabel(x))}</div>`).join('')}</div><div>รวมทั้งหมด ${inds.length} ${inds.some(x => /ผล/.test(x.code || '')) ? 'ผลการเรียนรู้' : 'ตัวชี้วัด'}</div>` : ''}
      <h3>หน่วยการเรียนรู้</h3>
      <table class="cp-tbl"><thead><tr><th style="width:7%">หน่วยที่</th><th style="width:23%">ชื่อหน่วยการเรียนรู้</th><th style="width:18%">ตัวชี้วัด / ผลการเรียนรู้</th><th>สาระสำคัญ</th><th style="width:9%">เวลา (ชั่วโมง)</th><th style="width:9%">น้ำหนักคะแนน</th></tr></thead><tbody>
        ${U.map((u, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(u.name || '')}</td><td>${(u.inds || []).map(id => inds.find(x => x.id === id)).filter(Boolean).map(x => esc(x.code || x.text)).join('<br>')}</td><td>${esc(u.essence || '').replace(/\n/g, '<br>')}</td><td style="text-align:center">${esc(u.hours ?? '')}</td><td style="text-align:center">${esc(u.weight ?? '')}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#888">(ยังไม่มีหน่วยการเรียนรู้)</td></tr>'}
        <tr><td colspan="4" style="text-align:right"><b>รวมตลอดภาคเรียน</b></td><td style="text-align:center"><b>${fmt(sumH)}</b></td><td style="text-align:center"><b>${fmt(sumW)}</b></td></tr></tbody></table>
      <h3>สัดส่วนคะแนน</h3>
      <table class="cp-tbl cp-w"><tr><th>ก่อนกลางภาค</th><th>กลางภาค</th><th>หลังกลางภาค</th><th>ปลายภาค</th><th>รวม</th></tr>
        <tr><td>${fmt(num(w.before))}</td><td>${fmt(num(w.mid))}</td><td>${fmt(num(w.after))}</td><td>${fmt(num(w.final))}</td><td><b>${fmt(num(w.before) + num(w.mid) + num(w.after) + num(w.final))}</b></td></tr></table>
      <div>อัตราส่วนคะแนนระหว่างภาค : ปลายภาค = ${fmt(num(w.before) + num(w.mid) + num(w.after))} : ${fmt(num(w.final))}</div>
      <div class="cp-sigs">${sig('ครูผู้สอน', I.teacher)}${sig('หัวหน้ากลุ่มสาระการเรียนรู้' + (I.area ? ' ' + I.area : ''), headOf(I.code, I.area))}${sig('รองผู้อำนวยการฝ่ายวิชาการ', st.deputyName || '')}</div></div>`;
  }
  /* พิมพ์ผ่าน iframe แบบ printDoc ของ attend.js — ไม่ยุ่งคลาส/โหมดมืดของหน้าแอป · ใช้ฟอนต์พิมพ์ที่ผู้ใช้ตั้ง (EMSType.printStack) */
  const DCSS = `.cp-page{font-size:14pt;line-height:1.55;color:#000;background:#fff}
.cp-head{display:flex;gap:12px;align-items:center;justify-content:center;margin-bottom:10px;text-align:center}
.cp-head img{width:58px;height:auto}
.cp-title{font-size:18pt;font-weight:700}
h3{font-size:15pt;margin:14px 0 6px;font-weight:700}
.cp-info{width:100%;border-collapse:collapse;margin-bottom:6px}
.cp-info td{padding:2px 4px;vertical-align:top}
.cp-desc p{text-indent:2.5em;text-align:justify;margin:0 0 4px}
.cp-inds div{padding-left:1.5em}
.cp-tbl{width:100%;border-collapse:collapse;margin:4px 0 8px;page-break-inside:auto}
.cp-tbl th,.cp-tbl td{border:1px solid #000;padding:4px 6px;vertical-align:top;font-size:13pt}
.cp-tbl tr{page-break-inside:avoid}
.cp-w th,.cp-w td{text-align:center}
.cp-sigs{display:grid;grid-template-columns:1fr 1fr;gap:28px 24px;margin-top:36px;page-break-inside:avoid}
.cp-sig{text-align:center;line-height:1.9}`;
  const PCSS = `.cs-info .t{font-weight:600}
.cs-tbl td{vertical-align:top}
.cs-tbl textarea{min-width:200px;resize:vertical}
.cs-tbl input.in[data-cs="uname"]{width:100%;min-width:170px;text-align:left}`;      // .tbl input.in ทั่วไปกว้าง 76px — ชื่อหน่วยต้องเต็มช่อง
  { const s = document.createElement('style'); s.textContent = PCSS; document.head.appendChild(s); }
  function printDoc(c) {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const font = window.EMSType ? EMSType.printStack() : '"TH Sarabun New","Sarabun",sans-serif', d = f.contentWindow.document;
    try { d.open();
    d.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>โครงสร้างรายวิชา ${esc(codeOf(c))}</title><style>@page{size:A4;margin:16mm 14mm}html,body{background:#fff;color:#000}body{font-family:${font};margin:0}${window.EMSPrintCss ? EMSPrintCss() : ''}${DCSS}</style></head><body>${docHtml(c)}</body></html>`);
    d.close();
    } catch (err) { f.remove(); console.error(err); return toast('เตรียมเอกสารพิมพ์ไม่สำเร็จ: ' + (err && err.message || err)); }      // ล้มกลางทาง → ไม่ทิ้ง iframe ค้าง
    const imgs = [...d.images].filter(im => !im.complete).map(im => new Promise(r => { im.onload = im.onerror = r; }));      // รอโลโก้โหลดก่อนพิมพ์ (ไม่เกิน 3 วินาที)
    Promise.race([Promise.all(imgs), new Promise(r => setTimeout(r, 3000))]).then(() => setTimeout(() => {
      f.contentWindow.addEventListener('afterprint', () => f.remove()); f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 300));
  }

  /* ---------- คัดลอกโครงสร้างไปห้องอื่นที่สอนวิชาเดียวกัน (จับคู่ตัวชี้วัดด้วยรหัส) ---------- */
  function copyTo(c) {
    const src = bookOf(c), co = courseOf(src), code = codeOf(c), targets = myClasses().filter(x => x.id !== c.id && codeOf(x) === code); let n = 0, skip = 0;
    targets.forEach(x => { const tb = bookOk(x) && bookOf(x); if (!tb) { skip++; return; } const tInds = tb.indicators || [];
      courseOf(tb).units = co.units.map(u => Object.assign({}, u, { id: uid('u'), inds: (u.inds || []).map(id => { const si = (src.indicators || []).find(i => i.id === id); const ti = si && tInds.find(i => (i.code || i.text) === (si.code || si.text)); return ti ? ti.id : null; }).filter(Boolean) }));
      n++; });
    save(); toast('ใช้โครงสร้างกับ ' + n + ' ห้องแล้ว (ตัวชี้วัดจับคู่ด้วยรหัส)' + (skip ? ' · ข้าม ' + skip + ' ห้องที่สมุดคะแนนยังโหลดไม่เสร็จ' : ''));
  }
  const insertAt = (ta, txt) => { const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s; ta.value = ta.value.slice(0, s) + txt + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = s + txt.length; ta.dispatchEvent(new Event('input', { bubbles: true })); };      // input = เก็บร่าง

  /* ---------- เหตุการณ์ ---------- */
  const unitOf = (b, el) => { const tr = el.closest('tr[data-u]'); return tr ? courseOf(b).units.find(u => u.id === tr.dataset.u) : null; };
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-cs]'); if (!t || page !== 'course' && t.dataset.cs !== 'indSave') return;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    const k = t.dataset.cs, c = cur(); if (!c) return;
    if (k === 'cls') { const to = myClasses().find(x => x.id === t.dataset.c), cd = codeOf(c);
      if (to && codeOf(to) !== cd && hasDraft(cd) && !confirm('คำอธิบายรายวิชา ' + cd + ' ที่พิมพ์ไว้ยังไม่ได้บันทึก — เปลี่ยนห้องต่อหรือไม่? (ร่างยังเก็บไว้จนกว่าจะปิดแอป)')) return;
      ui.cid = t.dataset.c; return redraw(); }
    if (k === 'reloadDesc') { const cd = codeOf(c); delete desc[cd]; delete descErr[cd]; redraw(); return loadDesc(cd); }
    if (!bookOk(c)) return; const b = bookOf(c); if (!b) return; const co = courseOf(b);
    if (locked() && ['add', 'copyTo', 'indSave', 'uinds', 'del', 'up', 'down', 'plan', 'planDo', 'toItems', 'toItemsDo'].indexOf(k) >= 0) return toast('ภาคเรียนนี้ปิดแล้ว — ดูได้อย่างเดียว');
    if (k === 'print') return printDoc(c);
    if (k === 'add') { co.units.push({ id: uid('u'), name: '', inds: [], essence: '', hours: '', weight: '', sec: (co.units[co.units.length - 1] || {}).sec === 'after' ? 'after' : 'before' }); save(); return redraw(); }
    if (k === 'plan') return planModal(b, co, info(c));
    if (k === 'planDo') { if (!planApply(co)) return; save(); closeModal(); toast('วางโครงร่าง ' + co.units.length + ' หน่วยแล้ว — แก้ชื่อหน่วย เวลา และน้ำหนักต่อในตารางได้'); return redraw(); }
    if (k === 'toItems') return toItems(b, co);
    if (k === 'toItemsDo') { toItemsDo(b, co); closeModal(); toast('ส่งไปหัวข้อคะแนนแล้ว — ปรับเพิ่มลดต่อได้ที่หน้าหัวข้อคะแนน'); return redraw(); }
    if (k === 'copyTo') { if (confirm('คัดลอกหน่วยการเรียนรู้ของห้องนี้ไปแทนที่ของห้องอื่นที่สอนวิชาเดียวกัน?')) { copyTo(c); redraw(); } return; }
    if (k === 'copy') { const v = ($('#cs-desc') || {}).value || ''; try { await navigator.clipboard.writeText(v); toast('คัดลอกคำอธิบายแล้ว'); } catch (er) { toast('คัดลอกไม่ได้ — เลือกข้อความแล้วกด Ctrl+C'); } return; }
    if (k === 'paste') { const ta = $('#cs-desc'); if (!ta) return; try { const v = await navigator.clipboard.readText(); insertAt(ta, v); } catch (er) { ta.focus(); toast('เบราว์เซอร์ไม่ให้อ่านคลิปบอร์ด — คลิกในช่องแล้วกด Ctrl+V'); } return; }
    if (k === 'insInd') { const ta = $('#cs-desc'); if (!ta) return; const codes = (b.indicators || []).map(x => x.code).filter(Boolean);
      insertAt(ta, (ta.value && !/\n$/.test(ta.value.slice(0, ta.selectionStart)) ? '\n' : '') + 'รหัสตัวชี้วัด\n' + codes.join(', ') + '\nรวมทั้งหมด ' + codes.length + ' ตัวชี้วัด'); return; }
    if (k === 'saveDesc' || k === 'undoDesc') {
      const cd = codeOf(c), D = desc[cd], v = (k === 'undoDesc' ? String((D && D.prev) || '') : (($('#cs-desc') || {}).value || '')).trim();
      if (k === 'undoDesc' && !confirm('ใช้ข้อความก่อนแก้ครั้งล่าสุดแทนข้อความปัจจุบัน?')) return;
      if (v.length > 10000) return toast('คำอธิบายยาว ' + v.length.toLocaleString() + ' ตัวอักษร เกิน 10,000 — ตัดให้สั้นลงก่อนบันทึก');
      t.disabled = true;
      try { await saveDesc(c, v); toast('บันทึกคำอธิบายรายวิชาแล้ว'); }
      catch (er) { if (er.conflict) { if (k === 'saveDesc') ui.draft[cd] = v; toast('มีคนแก้คำอธิบายนี้ก่อน — โหลดข้อความล่าสุดแล้ว ร่างของคุณยังอยู่ในช่อง ตรวจแล้วกดบันทึกอีกครั้ง'); }
        else toast('บันทึกไม่สำเร็จ: ' + (er.code === 'permission-denied' ? 'ไม่มีสิทธิ์ (ตรวจว่าวาง firestore.rules รุ่นใหม่แล้ว)' : (er.code || er.message))); }
      return redraw(); }
    if (k === 'indSave') { const u = co.units.find(x => x.id === t.dataset.u); if (!u) return closeModal();
      u.inds = [...document.querySelectorAll('[data-csi]')].filter(x => x.checked).map(x => x.dataset.csi); save(); closeModal(); return redraw(); }
    const u = unitOf(b, t); if (!u) return; const i = co.units.indexOf(u);
    if (k === 'uinds') return indModal(b, u);
    if (k === 'del') { if (!confirm('ลบหน่วยที่ ' + (i + 1) + (u.name ? ' “' + u.name + '”' : '') + '?')) return; co.units.splice(i, 1); save(); return redraw(); }
    if (k === 'up' && i > 0) { co.units.splice(i - 1, 0, co.units.splice(i, 1)[0]); save(); return redraw(); }
    if (k === 'down' && i < co.units.length - 1) { co.units.splice(i + 1, 0, co.units.splice(i, 1)[0]); save(); return redraw(); }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (page !== 'course' || !t.dataset || !t.dataset.cs) return;
    const c = cur(); if (!c || locked() || !bookOk(c)) return; const b = bookOf(c); if (!b) return; const u = unitOf(b, t); if (!u) return;
    const k = t.dataset.cs, v = t.value;
    if (k === 'uname') u.name = v.trim(); else if (k === 'uess') u.essence = v.trim(); else if (k === 'uhrs') u.hours = v.trim() === '' ? '' : num(v); else if (k === 'uwt') u.weight = v.trim() === '' ? '' : num(v); else if (k === 'usec') u.sec = v === 'after' ? 'after' : 'before'; else return;
    save(); if (k === 'usec') return redraw(); if (k !== 'uhrs' && k !== 'uwt') return;
    t.value = k === 'uhrs' ? u.hours : u.weight;      // อัปเดตแถวรวมตรง ๆ ไม่วาดทั้งหน้า (ปุ่มที่กำลังคลิกจะได้ไม่หายจาก DOM)
    const U = courseOf(b).units, sh = $('#cs-sumh'), sw = $('#cs-sumw');
    if (sh) sh.textContent = fmt(U.reduce((a, x) => a + num(x.hours), 0)); if (sw) sw.textContent = fmt(U.reduce((a, x) => a + num(x.weight), 0));
  });
  document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.pl) planCheck(); });
  document.addEventListener('input', e => { const t = e.target; if (t.id === 'cs-desc' && t.dataset.code) ui.draft[t.dataset.code] = t.value; });

  window.EMSCourse = { docHtml, loadDesc, info };
})();
