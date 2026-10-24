/* EMS — ส่งคะแนนเข้า SGS (เลียนแบบ KruSpace)
   ขั้นตอนเหมือนของเดิม: ลากปุ่มบุ๊กมาร์กเล็ตไปวางบนแถบบุ๊กมาร์ก → คัดลอกคะแนน → เปิด SGS → กดปุ่ม → วาง → ตรวจตารางเปรียบเทียบ → กรอก
   รหัสแพ็กเก็ต KRUSPACE-SGS:v1 เหมือนเดิม จึงใช้ปุ่มของ KruSpace กับข้อมูลจาก EMS (และกลับกัน) ได้
   ตัวกรองบนหน้า SGS คือ sgsFillerMain (sgs-filler.js) คัดลอกจาก KruSpace ทั้งก้อน */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const has = v => v !== undefined && v !== null && v !== '' && !Number.isNaN(v);
const sidOf = s => String(s.sid || s.id || '').trim();
const MODES = [['half', 'ปัดทีละ 0.5 (เช่น 15.5)'], ['one', 'ทศนิยม 1 ตำแหน่ง (เช่น 15.6)'], ['int', 'จำนวนเต็ม (เช่น 16)']];
const bookmarkletHref = () => 'javascript:' + encodeURIComponent('(' + sgsFillerMain.toString() + ')();void 0');

/** ข้อมูลที่คัดลอกให้ปุ่มฝั่ง SGS — คะแนนรายส่วนแบบยังไม่ปัดเศษ ส่วนที่ยังไม่มีคะแนนส่งเป็นค่าว่าง (ปุ่มจะไม่แตะช่องนั้น) */
function payload(cid) {
  const c = S.classes.find(x => x.id === cid), b = EMSBook.book(cid), W = b.weights, M = window.EMSModules;
  b.assessments = b.assessments || { traits: {}, reading: {} };
  const real = Object.assign({}, b, { partialMode: false });
  const part = (v, on, w) => on && w > 0 ? Math.round(v * 10000) / 10000 : null;
  const sts = c.students.filter(s => sidOf(s)).slice().sort((a, z) => a.no - z.no);
  const rc = M.cfgOf('reading'), tc = M.cfgOf('traits');
  const data = {
    v: 1, app: 'EMS', at: new Date().toISOString(), roundMode: b.sgsRoundMode || 'half',
    subject: (String(c.subject).split(' ')[0]) || '', subjectName: c.subject || '', cls: c.name || '', period: 'ภาคเรียนที่ ' + S.term.sem + ' ปีการศึกษา ' + S.term.year,
    weights: { before: num(W.before), mid: num(W.mid), after: num(W.after), final: num(W.final) },
    students: sts.map(s => {
      const r = EMSBook.calcRow(real, s), ex = b.exam[s.id] || {};
      const rv = (b.assessments.reading || {})[s.id] || [], tv = (b.assessments.traits || {})[s.id] || [];
      return {
        sid: sidOf(s), no: s.no, name: s.name || '',
        before: part(r.exact[0], r.filledBefore > 0, W.before), mid: part(r.exact[1], has(ex.mid) || has(window.EMSBook.rtBest(ex.retake)), W.mid),
        after: part(r.exact[2], r.filledAfter > 0, W.after), final: part(r.exact[3], has(ex.final), W.final),
        total: r.total, grade: r.grade,
        reading: rv, readingLevel: M.resultOf(rv, rc).level, traits: tv, traitsLevel: M.resultOf(tv, tc).level
      };
    })
  };
  return { text: 'KRUSPACE-SGS:v1:' + JSON.stringify(data), count: data.students.length, data };
}

/** การ์ด "ส่งคะแนนเข้า SGS" (วางบนสุดของหน้าสรุป/ส่งออก) */
function card(cid) {
  const c = S.classes.find(x => x.id === cid), b = EMSBook.book(cid);
  const n = c.students.filter(s => sidOf(s)).length;
  return `<div class="card"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap"><h2 style="margin:0">ส่งคะแนนเข้า SGS</h2><span class="grow"></span>
      <button class="btn" data-sgs="xlsx">${ic('down')}ส่งออกไฟล์ Excel สำหรับ SGS</button></div>
    <p class="muted small" style="margin:6px 0 10px">กรอกคะแนนรายส่วน (ก่อนกลางภาค กลางภาค หลังกลางภาค ปลายภาค) ลงหน้า “บันทึกผลการเรียน ตลอดภาคเรียน” ของ SGS ให้เอง จับคู่นักเรียนด้วยเลขประจำตัว · ครูล็อกอิน SGS เอง รหัสผ่านไม่ผ่าน EMS</p>
    <div class="field" style="max-width:340px"><label class="f" for="sgsRound">การปัดเศษคะแนนรายส่วนที่ส่ง</label>
      <select id="sgsRound" class="in" data-sgs="round">${MODES.map(([k, l]) => `<option value="${k}" ${(b.sgsRoundMode || 'half') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <ol class="sgs-steps" style="margin:0 0 10px 20px;line-height:1.9">
      <li><b>ครั้งแรกครั้งเดียว</b> ลากปุ่มนี้ไปวางบนแถบบุ๊กมาร์กของ Chrome <a class="btn sm pri" data-sgs-bookmarklet href="#" style="margin-left:6px" draggable="true">📥 กรอกคะแนนจาก EMS</a>
        <div class="muted small">ถ้าไม่เห็นแถบบุ๊กมาร์ก กด Ctrl+Shift+B</div></li>
      <li>คัดลอกคะแนนของวิชานี้ <button class="btn sm pri" data-sgs="copy" ${n ? '' : 'disabled'}>คัดลอกคะแนน · ${esc(c.subject.split(' ')[0])} · ${esc(c.name)}</button>
        ${n ? '' : '<div class="muted small">ห้องนี้ยังไม่มีเลขประจำตัวนักเรียน จึงจับคู่กับ SGS ไม่ได้ — ใส่ได้ที่ ฐานนักเรียน</div>'}</li>
      <li>เปิด SGS เลือก<b>รายวิชา</b>และ<b>กลุ่ม</b>ให้ตรง แล้วตั้งช่อง <b>/หน้า</b> เท่ากับจำนวนนักเรียนในห้อง (ไม่เกิน 40) ให้เห็นครบทุกคน</li>
      <li>ติ๊ก ☐ ที่หัวคอลัมน์ที่เปิดรอบให้กรอก (ก่อนกลางภาค+กลางภาค หรือ หลังกลางภาค+ปลายภาค)</li>
      <li>กดปุ่มบนแถบบุ๊กมาร์ก → วาง (Ctrl+V) → <b>ตรวจตารางเปรียบเทียบ</b> → กด “กรอกลง SGS”</li>
      <li>กด <b>F5</b> รีเฟรชหน้า SGS เพื่อยืนยันว่าบันทึกจริง</li>
    </ol>
    <div class="notice">ปุ่มเดียวกันนี้ใช้กับหน้า <b>บันทึกการอ่าน คิดวิเคราะห์ และเขียน</b> (5 ข้อ) และ <b>บันทึกคุณลักษณะอันพึงประสงค์</b> (8 ข้อ) ของ SGS ได้ด้วย — คัดลอกชุดเดิมแล้วกดปุ่มบนหน้านั้นได้เลย ปุ่มกรอกให้เฉพาะช่องรายข้อ ช่อง “รวม” กับ “ผลการประเมิน” SGS คำนวณเอง</div>
    <div class="notice bad">หน้านี้ของ SGS <b>บันทึกทันทีที่ช่องเปลี่ยน</b> ไม่มีปุ่มยกเลิก ปุ่มจะกรอกเฉพาะคอลัมน์ที่ติ๊กเปิดและอยู่ในรอบที่ SGS เปิดให้ ตรวจตารางเปรียบเทียบก่อนกดทุกครั้ง ช่องสีส้มคือช่องที่จะเขียนทับค่าเดิมใน SGS</div></div>`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove(); return ok;
}

/** ส่งออก Excel สำหรับ SGS: คะแนนรายส่วน · อ่านคิดวิเคราะห์ 5 ข้อ · คุณลักษณะ 8 ข้อ · รวมทุกส่วน · ข้อมูลรายวิชา */
async function workbook(cid) {
  const c = S.classes.find(x => x.id === cid), b = EMSBook.book(cid), M = window.EMSModules, W = b.weights;
  b.assessments = b.assessments || { traits: {}, reading: {} };
  const sts = c.students.slice().sort((a, z) => a.no - z.no);
  if (!sts.length) return toast('ยังไม่มีรายชื่อนักเรียนในชั้นนี้');
  const rows = sts.map(s => ({ s, r: EMSBook.calcRow(b, s) }));
  const parts = [['ก่อนกลางภาค', W.before, r => r.wBefore], ['กลางภาค', W.mid, r => r.wM], ['หลังกลางภาค', W.after, r => r.wAfter], ['ปลายภาค', W.final, r => r.wF]];
  const v = x => has(x) ? x : '';
  const f2 = x => isFinite(x) ? Number(Number(x).toFixed(2)) : '';
  const rc = M.cfgOf('reading'), tc = M.cfgOf('traits');
  const sheet1 = [['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล', ...parts.map(p => p[0] + ' (เต็ม ' + p[1] + ')'), 'รวม (เต็ม 100)', 'เกรด']]
    .concat(rows.map(({ s, r }) => [s.no, sidOf(s), s.name, ...parts.map(p => f2(p[2](r))), f2(r.total), String(r.grade)]));
  const sheet2 = [['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล', 'ข้อ 1 (คัดสรรสื่อ)', 'ข้อ 2 (จับประเด็น)', 'ข้อ 3 (วิเคราะห์)', 'ข้อ 4 (สรุปคุณค่า)', 'ข้อ 5 (สรุปเขียน)', 'ผลการประเมิน']]
    .concat(sts.map(s => { const a = (b.assessments.reading || {})[s.id] || [], res = M.resultOf(a, rc); return [s.no, sidOf(s), s.name, v(a[0]), v(a[1]), v(a[2]), v(a[3]), v(a[4]), res.level === null ? '' : res.level]; }));
  const sheet3 = [['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล', 'ข้อ 1 (รักชาติ)', 'ข้อ 2 (ซื่อสัตย์)', 'ข้อ 3 (มีวินัย)', 'ข้อ 4 (ใฝ่เรียนรู้)', 'ข้อ 5 (พอเพียง)', 'ข้อ 6 (มุ่งมั่น)', 'ข้อ 7 (รักความเป็นไทย)', 'ข้อ 8 (จิตสาธารณะ)', 'ผลการประเมิน']]
    .concat(sts.map(s => { const a = (b.assessments.traits || {})[s.id] || [], res = M.resultOf(a, tc); return [s.no, sidOf(s), s.name, ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => v(a[i])), res.level === null ? '' : res.level]; }));
  const sheet4 = [['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล', ...parts.map(p => p[0]), 'รวม 100', 'เกรด', 'อ่าน 1', 'อ่าน 2', 'อ่าน 3', 'อ่าน 4', 'อ่าน 5', 'สรุปอ่าน', 'คุณลักษณะ 1', 'คุณลักษณะ 2', 'คุณลักษณะ 3', 'คุณลักษณะ 4', 'คุณลักษณะ 5', 'คุณลักษณะ 6', 'คุณลักษณะ 7', 'คุณลักษณะ 8', 'สรุปคุณลักษณะ']]
    .concat(rows.map(({ s, r }) => { const ra = (b.assessments.reading || {})[s.id] || [], ta = (b.assessments.traits || {})[s.id] || [], rr = M.resultOf(ra, rc), tr = M.resultOf(ta, tc);
      return [s.no, sidOf(s), s.name, ...parts.map(p => f2(p[2](r))), f2(r.total), String(r.grade), ...[0, 1, 2, 3, 4].map(i => v(ra[i])), rr.level === null ? '' : rr.level, ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => v(ta[i])), tr.level === null ? '' : tr.level]; }));
  const meta = (S.bookMeta || {})[cid] || {};
  const sheet5 = [['ข้อมูลรายวิชาและการส่งออก SGS', ''], ['สถานศึกษา', (S.settings || {}).schoolName || ''], ['ปีการศึกษา', S.term.year], ['ภาคเรียน', S.term.sem], ['รายวิชา', c.subject], ['ชั้น/ห้อง', c.name],
    ['ครูผู้สอน', meta.teacherName || S.me.name], ['จำนวนนักเรียน', rows.length], ['วันที่ส่งออก', new Date().toLocaleDateString('th-TH')]];
  const tabs = [['คะแนน SGS', sheet1], ['อ่านคิดวิเคราะห์ 5 ข้อ', sheet2], ['คุณลักษณะ 8 ข้อ', sheet3], ['รวมทุกส่วน SGS', sheet4], ['ข้อมูลรายวิชา', sheet5]];
  const name = 'SGS_' + String(c.subject.split(' ')[0]).replace(/[\\/:*?"<>|]/g, '_') + '_' + c.name.replace(/[\\/:*?"<>|]/g, '_') + '_ปี' + S.term.year + '_ภาค' + S.term.sem;
  try {
    if (!window.XLSX) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    const wb = XLSX.utils.book_new(); tabs.forEach(([t, d]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), t)); XLSX.writeFile(wb, name + '.xlsx');
    toast('ส่งออก Excel SGS ครบทุกส่วนแล้ว');
  } catch (e) {
    const csv = '﻿' + tabs[0][1].map(r => r.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; a.click();
    toast('ออฟไลน์ — ส่งออกเฉพาะคะแนนรายส่วนเป็น CSV แทน');
  }
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-sgs]'); if (!t || t.tagName === 'SELECT') return;
  const cid = (window.EMSSgs && EMSSgs.cur()) || S.classes[0].id;
  if (t.dataset.sgs === 'copy') {
    const p = payload(cid);
    if (!p.count) return toast('ห้องนี้ยังไม่มีเลขประจำตัวนักเรียน');
    toast(await copyText(p.text) ? 'คัดลอกคะแนน ' + p.count + ' คนแล้ว — ไปที่ SGS แล้วกดปุ่มบนแถบบุ๊กมาร์ก' : 'คัดลอกไม่สำเร็จ — ลองอีกครั้ง');
  } else if (t.dataset.sgs === 'xlsx') workbook(cid);
});
document.addEventListener('change', e => {
  const t = e.target.closest('select[data-sgs="round"]'); if (!t) return;
  const b = EMSBook.book(window.EMSSgs.cur()); b.sgsRoundMode = t.value; save(); const y = scrollY; render(); scrollTo(0, y);
});
document.addEventListener('dragstart', e => { const a = e.target.closest && e.target.closest('[data-sgs-bookmarklet]'); if (a) a.href = bookmarkletHref(); });
document.addEventListener('click', e => { const a = e.target.closest('[data-sgs-bookmarklet]'); if (a) { e.preventDefault(); toast('ลากปุ่มนี้ไปวางบนแถบบุ๊กมาร์กของเบราว์เซอร์ (กด Ctrl+Shift+B ถ้าไม่เห็นแถบ)'); } });

/* ตั้ง href ของบุ๊กมาร์กเล็ตหลังเรนเดอร์ (ไม่ฝังในเทมเพลตเพราะยาวมาก) */
const baseRender = window.render;
window.render = function () { baseRender.apply(this, arguments); document.querySelectorAll('[data-sgs-bookmarklet]').forEach(a => { a.href = bookmarkletHref(); }); };

window.EMSSgs = { card, payload, workbook, bookmarkletHref, cur: () => (window.EMSCurSummaryClass ? window.EMSCurSummaryClass() : S.classes[0].id) };
})();
