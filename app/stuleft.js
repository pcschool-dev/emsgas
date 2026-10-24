/* EMS — นักเรียนลาออก / จำหน่าย (แทนการลบชื่อถาวร)
   รายชื่อนักเรียน (rooms) ใช้ร่วมกันทุกภาคเรียน → ลบชื่อออกจากห้องแล้วเก็บประวัติไว้ในคอลเลกชัน stuLeft (หนึ่งเอกสารต่อคน)
   { id, sid, sk, name, no, room, roomName, date (วันที่ออก ย้อนหลังได้), reason, detail, who (ผู้บันทึก), at, term, student (ข้อมูลเดิมทั้งก้อน),
     status: 'left' | 'restored', restoredWho, restoredAt }
   ไม่ลบเอกสารเลย (rules ห้ามลบ) — คืนสถานะ = ใส่ชื่อกลับห้องเดิม (ออกในปีการศึกษาก่อน = เลือกห้องเอง) + status 'restored' · คะแนนและการเช็กชื่อเดิมไม่ถูกลบ ผูกกับเลขประจำตัวเดิม */
(function () {
  'use strict';
  const REASONS = ['ลาออก', 'ย้ายสถานศึกษา', 'พ้นสภาพ / ขาดเรียนนาน', 'พักการเรียน', 'เสียชีวิต', 'เพิ่มชื่อผิด / ข้อมูลซ้ำ', 'อื่น ๆ'];
  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const th = iso => { if (!iso) return '-'; try { return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { return iso; } };
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const list = () => (S.stuLeft = Array.isArray(S.stuLeft) ? S.stuLeft : []);
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  /* ตรงกับ rules: แอดมิน (รวมแอดมินตั้งต้นใน config) หรือฝ่ายวิชาการ · โหมดตัวอย่าง = ทำได้ */
  const canEdit = () => !LIVE || roles().some(r => r === 'admin' || r === 'academic') || ((window.EMS_CONFIG || {}).adminEmails || []).indexOf(String(S.me.email || '').toLowerCase()) >= 0;
  const ready = () => !LIVE || !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready.stuLeft);
  const termKey = () => (S.term ? S.term.year + '-' + S.term.sem : '');
  const roomCls = id => S.classes.find(c => c.id === id);
  /* ห้องย่อยตามแผน = รายชื่อคำนวณจากห้องหลัก (ไม่ได้เก็บแยก) → บันทึกออก/คืนสถานะที่ห้องหลักเสมอ */
  const isSub = id => !!(window.EMSPlans && EMSPlans.isSub && EMSPlans.isSub(id));
  const mainOf = id => isSub(id) ? EMSPlans.parentOf(id) : id;
  const yearOfTerm = t => String(t || '').split('-')[0];
  /* ดูภาคของปีก่อน (หลังขึ้นปีใหม่) = รายชื่อปีเก่า อ่านอย่างเดียว */
  const pastY = () => { const v = S.viewTerm, c = S.term || {}; return v && v.year && c.year && +v.year < +c.year ? String(v.year) : ''; };
  let ui = { year: '', q: '' };

  /* ---------- บันทึกลาออก ---------- */
  function openLeave(roomId, stId) {
    roomId = mainOf(roomId);
    const c = roomCls(roomId), s = c && c.students.find(x => x.id === stId); if (!s) return toast('ไม่พบนักเรียนคนนี้ในห้องหลัก — รีเฟรชแล้วลองใหม่');
    if (!canEdit()) return toast('เฉพาะแอดมินหรือฝ่ายวิชาการ');
    if (pastY()) return toast('กำลังดูรายชื่อปี ' + pastY() + ' — กลับภาคปัจจุบันก่อน');
    if (!ready()) return toast('กำลังโหลดประวัตินักเรียนที่ออก รอสักครู่แล้วลองใหม่');
    modal(`<h2 style="margin-bottom:4px">บันทึกนักเรียนออก</h2>
      <p class="muted small" style="margin:0 0 12px"><b>${esc(s.name)}</b> · เลขประจำตัว ${esc(s.sid || '-')} · ${esc(c.name)} เลขที่ ${esc(s.no)}</p>
      <div class="field"><label class="f" for="sl-d">วันที่ออก (ย้อนหลังได้)</label><input id="sl-d" class="in" type="date" value="${today()}" max="${today()}"></div>
      <div class="field"><label class="f" for="sl-r">สาเหตุ</label><select id="sl-r" class="in">${REASONS.map(r => `<option>${esc(r)}</option>`).join('')}</select></div>
      <div class="field"><label class="f" for="sl-t">รายละเอียด / เลขที่หนังสือ</label><textarea id="sl-t" class="in" rows="2" placeholder="เช่น ย้ายไปโรงเรียน… ตามหนังสือที่…"></textarea></div>
      <div class="notice" style="margin:8px 0 12px">ชื่อจะออกจากห้องเรียนทุกภาคเรียน (เช็กชื่อ คะแนน ปพ.5) แต่คะแนนและการเช็กชื่อเดิมยังเก็บไว้ · ผู้บันทึก: <b>${esc(S.me.name)}</b> · คืนสถานะได้ภายหลัง</div>
      <button class="btn pri" style="width:100%" data-sl="leaveOk" data-c="${esc(roomId)}" data-s="${esc(stId)}">บันทึกนักเรียนออก</button>`);
  }
  function saveLeave(roomId, stId) {
    roomId = mainOf(roomId);
    if (pastY()) return toast('กำลังดูรายชื่อปี ' + pastY() + ' — กลับภาคปัจจุบันก่อน');
    const c = roomCls(roomId), s = c && c.students.find(x => x.id === stId); if (!s) return closeModal();
    const date = ($('#sl-d') || {}).value || today(), reason = ($('#sl-r') || {}).value || REASONS[0], detail = (($('#sl-t') || {}).value || '').trim();
    if (date > today()) return toast('วันที่ออกต้องไม่เกินวันนี้');
    if (reason === 'อื่น ๆ' && !detail) return toast('กรุณาระบุรายละเอียดสาเหตุ');
    if (!ready()) return toast('กำลังโหลดประวัตินักเรียนที่ออก รอสักครู่แล้วลองใหม่');
    const pk = String(s.sid || s.id), rp = (S.roomPlans || {})[c.id], plan = rp && rp[pk] ? rp[pk] : '';
    list().unshift(Object.assign({ id: uid('sl'), sid: String(s.sid || ''), sk: s.id, name: s.name, no: s.no, room: c.id, roomName: c.name, date, reason, detail,
      who: S.me.name, at: new Date().toISOString(), term: termKey(), student: Object.assign({}, s), status: 'left' }, plan ? { plan } : {}));
    if (plan) { const np = Object.assign({}, rp); delete np[pk]; S.roomPlans[c.id] = np; }      /* แผนรายคนของคนที่ออก ไม่ให้ค้างไปห้องปลายทางตอนขึ้นปี */
    c.students = c.students.filter(x => x.id !== s.id);
    const room = (S.rooms || []).find(r => r.id === c.id); if (room) room.count = c.students.length;
    save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush();
    if (window.EMSPlans && EMSPlans.apply) EMSPlans.apply();          // ห้องย่อยของห้องนี้อัปเดตตามทันที
    closeModal(); toast('บันทึก ' + s.name + ' ออกแล้ว · ' + reason); redraw();
  }
  async function restore(id) {
    const r = list().find(x => x.id === id); if (!r || r.status !== 'left') return;
    if (!canEdit()) return toast('เฉพาะแอดมินหรือฝ่ายวิชาการ');
    if (pastY()) return toast('กำลังดูรายชื่อปี ' + pastY() + ' — กลับภาคปัจจุบันก่อน');
    /* มีชื่ออยู่ห้องใดห้องหนึ่งแล้ว (เช่น นำเข้ารายชื่อใหม่) — ตรวจทุกห้อง ไม่ใช่แค่ห้องเดิม */
    const dup = S.classes.find(k => !isSub(k.id) && k.students.some(x => x.id === r.sk || (r.sid && String(x.sid) === r.sid)));
    if (dup) return toast('นักเรียนคนนี้อยู่ในห้อง ' + dup.name + ' แล้ว');
    /* ออกในปีการศึกษาก่อน → ห้องเดิม (id เดิม) ตอนนี้เป็นรุ่นใหม่ ให้เลือกห้องปลายทางเอง */
    const ry = yearOfTerm(r.term), cy = String((S.term || {}).year || '');
    if (!ry || ry !== cy) return pickRoom(r);
    const c = roomCls(r.room); if (!c) return pickRoom(r);
    if (!confirm('คืนสถานะ ' + r.name + ' กลับเข้า ' + (r.roomName || r.room) + ' ?')) return;
    putBack(r, c);
  }
  function pickRoom(r) {
    const rooms = S.classes.filter(k => !isSub(k.id)).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'th', { numeric: true }));
    modal(`<h2 style="margin-bottom:4px">คืนสถานะนักเรียน</h2>
      <p class="muted small" style="margin:0 0 12px"><b>${esc(r.name)}</b> · เลขประจำตัว ${esc(r.sid || '-')} · ออกจาก ${esc(r.roomName || r.room)} เมื่อ ${esc(th(r.date))}${r.term ? ' (ภาค ' + esc(r.term) + ')' : ''}</p>
      <div class="notice" style="margin:0 0 10px">บันทึกออกในปีการศึกษาก่อน — ห้องเดิมตอนนี้เป็นนักเรียนรุ่นใหม่ เลือกห้องที่จะใส่ชื่อกลับ</div>
      <div class="field"><label class="f" for="sl-room">ห้องปลายทาง</label><select id="sl-room" class="in"><option value="">— เลือกห้อง —</option>${rooms.map(k => `<option value="${esc(k.id)}">${esc(k.name)} · ${k.students.length} คน</option>`).join('')}</select></div>
      <button class="btn pri" style="width:100%" data-sl="restoreOk" data-id="${esc(r.id)}">คืนสถานะเข้าห้องที่เลือก</button>`);
  }
  function restoreTo(id) {
    const r = list().find(x => x.id === id); if (!r || r.status !== 'left') return closeModal();
    const c = roomCls(($('#sl-room') || {}).value || ''); if (!c || isSub(c.id)) return toast('เลือกห้องปลายทางก่อน');
    if (S.classes.some(k => !isSub(k.id) && k.students.some(x => x.id === r.sk || (r.sid && String(x.sid) === r.sid)))) return toast('นักเรียนคนนี้อยู่ในห้องแล้ว');
    closeModal(); putBack(r, c);
  }
  function putBack(r, c) {
    const st = Object.assign({}, r.student || { id: r.sk, sid: r.sid, no: r.no, name: r.name });
    if (c.id !== r.room || c.students.some(x => x.no === st.no)) st.no = c.students.reduce((m, x) => Math.max(m, x.no || 0), 0) + 1;      // ห้องอื่น/เลขที่ซ้ำ = ต่อท้าย
    c.students = c.students.concat([st]).sort((a, b) => (a.no || 999) - (b.no || 999));
    if (r.plan && c.id === r.room) { S.roomPlans = S.roomPlans || {}; S.roomPlans[c.id] = Object.assign({}, S.roomPlans[c.id], { [String(st.sid || st.id)]: r.plan }); }   /* คืนแผนเดิมเมื่อกลับห้องเดิม */
    const room = (S.rooms || []).find(x => x.id === c.id); if (room) room.count = c.students.length;
    Object.assign(r, { status: 'restored', restoredWho: S.me.name, restoredAt: new Date().toISOString() }, c.id !== r.room ? { restoredRoom: c.id, restoredRoomName: c.name } : {});
    save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); if (window.EMSPlans && EMSPlans.apply) EMSPlans.apply();
    toast('คืนสถานะ ' + r.name + ' เข้า ' + c.name + ' แล้ว'); redraw();
  }
  function csv() {
    const rows = [['วันที่ออก', 'เลขประจำตัว', 'ชื่อ-สกุล', 'ห้อง', 'เลขที่', 'สาเหตุ', 'รายละเอียด', 'ผู้บันทึก', 'บันทึกเมื่อ', 'ภาคเรียน', 'สถานะ']]
      .concat(view().map(r => [r.date, r.sid, r.name, r.roomName, r.no, r.reason, r.detail, r.who, (r.at || '').slice(0, 16).replace('T', ' '), r.term, r.status === 'left' ? 'ออกแล้ว' : 'คืนสถานะโดย ' + (r.restoredWho || '')]));
    const text = '﻿' + rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = 'นักเรียนออก_EMS.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- หน้าฐานนักเรียน: ปุ่ม “ออก” แทน “ลบ” + ส่วนประวัตินักเรียนที่ออก ---------- */
  /* ปีการศึกษา (พ.ศ.) ของวันที่ออก: ม.ค.–เม.ย. = ปลายปีการศึกษาก่อนหน้า */
  const yearOf = r => { const d = String(r.date || ''), y = +d.slice(0, 4), m = +d.slice(5, 7); return y ? String(y + 543 - (m && m <= 4 ? 1 : 0)) : ''; };
  const view = () => list().filter(r => (!ui.year || yearOf(r) === ui.year) && (!ui.q || (r.name + ' ' + r.sid + ' ' + r.roomName).indexOf(ui.q) >= 0)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  function section() {
    if (!canEdit()) return '';                                 // อ่านประวัติได้เฉพาะแอดมิน/วิชาการ (บทบาทอื่นไม่โหลด จะค้าง “กำลังโหลด…”)
    if (LIVE && !ready()) return `<div class="card" id="sl-sec"><h2>นักเรียนที่ออกแล้ว</h2><div class="empty">กำลังโหลด…</div></div>`;
    const all = list(), years = [...new Set(all.map(yearOf).filter(Boolean))].sort().reverse(), rows = view(), left = all.filter(r => r.status === 'left').length;
    return `<div class="card" id="sl-sec"><div class="row" style="border:0;padding-top:0;flex-wrap:wrap;gap:8px"><div class="grow"><h2 style="margin:0">นักเรียนที่ออกแล้ว <span class="muted small">${left} คน</span></h2>
        <div class="muted small">ลาออก ย้ายสถานศึกษา จำหน่าย — บันทึกผู้บันทึก วันที่ และสาเหตุไว้ทุกครั้ง ข้อมูลไม่ถูกลบ</div></div>
        <select class="in" style="width:auto" data-slf="year" aria-label="ปีการศึกษา"><option value="">ทุกปีการศึกษา</option>${years.map(y => `<option value="${esc(y)}" ${ui.year === y ? 'selected' : ''}>ปีการศึกษา ${esc(y)}</option>`).join('')}</select>
        <input class="in" style="width:200px" placeholder="ค้นหาชื่อ / เลขประจำตัว" value="${esc(ui.q)}" data-slf="q" aria-label="ค้นหานักเรียนที่ออก">
        ${all.length ? `<button class="btn sm" data-sl="csv">${ic('down')}ดาวน์โหลด CSV</button>` : ''}</div>
      ${rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>วันที่ออก</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>ห้อง</th><th>สาเหตุ</th><th>ผู้บันทึก</th><th>สถานะ</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr><td style="white-space:nowrap">${esc(th(r.date))}</td><td>${esc(r.sid || '-')}</td><td style="white-space:nowrap"><b>${esc(r.name)}</b></td><td style="white-space:nowrap">${esc(r.roomName || r.room)} · ${esc(r.no)}</td>
          <td>${esc(r.reason)}${r.detail ? `<div class="muted small">${esc(r.detail)}</div>` : ''}</td><td class="small" style="white-space:nowrap">${esc(r.who || '')}<div class="muted">${esc(th((r.at || '').slice(0, 10)))}</div></td>
          <td style="white-space:nowrap">${r.status === 'left' ? '<span class="chip bad">ออกแล้ว</span>' : `<span class="chip ok">คืนสถานะ</span><div class="muted small">${esc(r.restoredWho || '')}</div>`}</td>
          <td>${r.status === 'left' && canEdit() ? `<button class="btn sm" data-sl="restore" data-id="${esc(r.id)}">คืนสถานะ</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${all.length ? 'ไม่พบตามที่ค้นหา' : 'ยังไม่มีนักเรียนที่ออก'}</div>`}</div>`;
  }
  const base = P['a-students'];
  /* ดูปีเก่า: ปิดช่องแก้เลขที่/เลขประจำตัว/ชื่อ/ย้ายห้อง และซ่อนปุ่มเรียงเลขที่/เพิ่มนักเรียน (modules.js ก็ปฏิเสธซ้ำอีกชั้น) */
  const readOnly = h => h.replace('แก้ไขได้ในตาราง บันทึกอัตโนมัติ', 'รายชื่อตอนสิ้นปี อ่านอย่างเดียว').replace(/<button class="btn sm ghost" style="color:var\(--bad\)" data-md="stDel">ลบ<\/button>/g, '')
    .replace(/ data-md="(stNo|stId|stName|stMove)"/g, ' data-md="$1" disabled').replace(/<button class="btn sm" data-md="sort"[^>]*>[^<]*<\/button>/g, '')
    .replace(/<button class="btn pri" data-act="stAdd">[\s\S]*?<\/button>/, '');
  if (base) P['a-students'] = () => pastY() ? `<div class="notice" style="background:var(--warn-soft)"><b>กำลังดูรายชื่อปีการศึกษา ${esc(pastY())}</b> (รายชื่อตอนสิ้นปี อ่านอย่างเดียว) — แก้รายชื่อไม่ได้ กลับภาคปัจจุบันเพื่อแก้รายชื่อ${S.__rosterMissing ? `<div style="margin-top:6px"><b>ไม่มีรายชื่อปี ${esc(pastY())} ในระบบ</b> — ปีนี้ยังไม่ได้เก็บรายชื่อตอนขึ้นปีใหม่ หรือโหลดไม่สำเร็จ (ลองรีเฟรช)</div>` : ''}</div>` + readOnly(base()) : base()
    .replace(/<button class="btn sm ghost" style="color:var\(--bad\)" data-md="stDel">ลบ<\/button>/g, '<button class="btn sm ghost" style="color:var(--bad)" data-sl="leave">ออก / จำหน่าย</button>') + section();

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-sl]'); if (!t) return;
    const a = t.dataset.sl, tr = t.closest('tr');
    if (a === 'leave') return openLeave(tr.dataset.c, tr.dataset.sid);
    if (a === 'leaveOk') return saveLeave(t.dataset.c, t.dataset.s);
    if (a === 'restore') return restore(t.dataset.id);
    if (a === 'restoreOk') return restoreTo(t.dataset.id);
    if (a === 'csv') return csv();
  });
  document.addEventListener('change', e => { const t = e.target.closest('[data-slf]'); if (!t) return; ui[t.dataset.slf] = t.value.trim(); redraw(); });
  window.EMSStuLeft = { list, REASONS };
})();
