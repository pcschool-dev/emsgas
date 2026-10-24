/* EMS — นัดหมายการประชุม
   ผู้สร้างนัด: ผู้บริหาร · หัวหน้ากลุ่มสาระ · ฝ่ายวิชาการ · ฝ่ายวัดผล · แอดมิน (ไม่ต้องขออนุมัติ)
   - เชิญ: ทั้งโรงเรียน / ตามกลุ่มสาระ-กลุ่มงาน / ตามบทบาท / รายคน → รายชื่อผู้เข้าประชุมคำนวณตอนบันทึก (invitees)
   - เช็กชนคาบสอนของผู้ถูกเชิญจากตารางสอน และบอกคาบที่ทุกคนว่างในวันนั้น
   - ผู้ถูกเชิญกด “รับทราบ” หรือ “ขอลา (เหตุผล)” · เลยเวลาสิ้นสุดของนัดแล้วแจ้งเตือนหายเอง · ผู้นัด/ผู้บริหารเห็นว่าใครรับทราบ เมื่อไร → แจ้งเตือนที่กระดิ่ง (notify.js) · ผู้นัดเห็นสรุป เช็กชื่อวันประชุม บันทึกการประชุม ยกเลิกนัด
   ข้อมูล: meetings/{id} (ผู้นัดเขียน) · meetingRsvp/{นัด}_{ผู้ตอบ} (เจ้าของคำตอบเขียน) — ไม่ลบ ยกเลิกนัด = status 'cancelled'
   LINE (เตรียมไว้): ตั้ง EMS_CONFIG.line.endpoint = URL บริการกลางของโรงเรียน (เช่น Apps Script / Cloud Function ที่ถือ LINE Messaging API token)
     EMS ส่ง POST (text/plain) { kind: 'meeting.created'|'meeting.updated'|'meeting.cancelled', idToken, meeting: {...}, to: [อีเมลผู้ถูกเชิญ] }
     บริการปลายทางต้องตรวจ idToken และจับคู่อีเมล → LINE userId เอง (EMS ไม่เก็บ token ของ LINE) */
(function () {
  'use strict';
  const CREATOR = ['admin', 'exec', 'head', 'academic', 'measure'];
  const ROLE_PICK = [['head', 'หัวหน้ากลุ่มสาระ'], ['academic', 'ฝ่ายวิชาการ'], ['measure', 'ฝ่ายวัดผล'], ['personnel', 'ฝ่ายบุคคล'], ['affairs', 'กิจการนักเรียน'], ['general', 'บริหารทั่วไป'], ['exec', 'ผู้บริหาร'], ['teacher', 'ครูผู้สอน'], ['support', 'บุคลากรสนับสนุน']];
  const redraw = () => { const y = scrollY; render(); scrollTo(0, y); };
  const roles = () => [].concat(S.me.roles || [], S.me.role || []);
  const has = r => roles().indexOf(r) >= 0;
  const bootAdmin = () => ((window.EMS_CONFIG || {}).adminEmails || []).indexOf(String(S.me.email || '').toLowerCase()) >= 0;
  const canCreate = () => !LIVE || bootAdmin() || roles().some(r => CREATOR.indexOf(r) >= 0);
  const isAdm = () => !LIVE ? S.view === 'admin' : (has('admin') || bootAdmin());
  const myEmail = () => String(S.me.email || ((S.staff || []).find(u => u.name === S.me.name) || {}).email || '').trim().toLowerCase();     /* ต้องตรงกับอีเมลที่ล็อกอิน (rules ตรวจ who == email) */
  const today = () => (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const thDate = iso => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { return iso; } };
  const fmtAt = iso => { try { return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const hash = s => { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  const uid = () => 'mt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const list = () => (S.meetings = Array.isArray(S.meetings) ? S.meetings : []);
  const mine = () => (S.mtRsvpMine = Array.isArray(S.mtRsvpMine) ? S.mtRsvpMine : []);
  const ofMeet = () => (Array.isArray(S.mtRsvpOf) ? S.mtRsvpOf : []);
  const staff = () => (S.staff || []).filter(u => u && u.name && u.active !== false && [].concat(u.roles || [], u.role || []).indexOf('vacant') < 0);
  const rolesOfU = u => [].concat(u.roles || [], u.role || []);
  const ready = k => !LIVE || !!(window.EMSCloud && EMSCloud.ready && EMSCloud.ready[k]);
  const myResp = id => mine().find(r => r.mid === id);
  /* คำตอบของผู้ถูกเชิญแต่ละชื่อ — จับคู่ด้วยอีเมล (who) ก่อน เพราะเปลี่ยนชื่อแล้วคำตอบเดิมยังเก็บชื่อเก่า แล้วค่อยใช้ชื่อ */
  const rsvpBy = m => { const by = {}, byWho = {}; ofMeet().filter(x => x.mid === m.id).forEach(x => { by[x.name] = x; if (x.who) byWho[String(x.who).toLowerCase()] = x; });
    (m.invitees || []).forEach(n => { const em = String(((S.staff || []).find(u => u.name === n) || {}).email || '').toLowerCase(); if (em && byWho[em]) by[n] = byWho[em]; }); return by; };
  const invited = m => (m.invitees || []).indexOf(S.me.name) >= 0;
  const isOwner = m => m.by === S.me.name || isAdm();
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const ended = m => m.date < today() || (m.date === today() && String(m.to || '23:59') <= nowHM());
  const upcoming = m => m.status !== 'cancelled' && !ended(m);          /* เลยเวลาประชุมแล้ว = หายจากรายการและแจ้งเตือนเอง */
  const canSee = m => isOwner(m) || has('exec');                         /* ผู้นัด แอดมิน ผู้บริหาร เห็นว่าใครรับทราบ */

  /* ---------- ผู้ถูกเชิญ / ชนคาบสอน ---------- */
  function resolve(inv) {
    const out = new Set(), st = staff();
    if (inv.all) st.forEach(u => out.add(u.name));
    (inv.depts || []).forEach(d => st.filter(u => String(u.dept || '') === d).forEach(u => out.add(u.name)));
    (inv.roles || []).forEach(r => st.filter(u => rolesOfU(u).indexOf(r) >= 0).forEach(u => out.add(u.name)));
    (inv.people || []).forEach(n => { if (st.some(u => u.name === n)) out.add(n); });
    return [...out].sort((a, b) => a.localeCompare(b, 'th'));
  }
  const weekday = iso => { const g = new Date(iso + 'T00:00:00').getDay(); return g >= 1 && g <= 5 ? g - 1 : -1; };
  const PER = () => (typeof PERIODS !== 'undefined' ? PERIODS : []);
  function conflicts(names, date, from, to) {
    const d = weekday(date), set = new Set(names), busy = {}, perBusy = {};
    if (d < 0 || !from || !to) return { busy, free: [], weekend: d < 0 };
    (S.__ttAll || []).forEach(e => { if (e.day !== d || !set.has(e.teacher)) return; const pr = PER()[e.p] || []; (perBusy[e.p] = perBusy[e.p] || new Set()).add(e.teacher);
      if (pr[0] && pr[1] && pr[0] < to && pr[1] > from) (busy[e.teacher] = busy[e.teacher] || []).push('คาบ ' + (e.p + 1)); });
    const free = PER().map((pr, p) => ({ p, pr })).filter(x => x.pr[0] && !perBusy[x.p]).map(x => 'คาบ ' + (x.p + 1) + ' (' + x.pr[0] + '–' + x.pr[1] + ')');
    Object.keys(busy).forEach(k => { busy[k] = [...new Set(busy[k])]; });
    return { busy, free, weekend: false };
  }

  /* ---------- LINE (เตรียมไว้ ยังไม่ส่งถ้าไม่ได้ตั้งค่า) ---------- */
  const lineOn = () => !!(((window.EMS_CONFIG || {}).line || {}).endpoint);
  async function sendLine(kind, m) {
    if (!lineOn() || !m.line) return;
    try {
      const tok = window.EMSCloud && EMSCloud.idToken ? await EMSCloud.idToken() : '';
      const to = (m.invitees || []).map(n => String(((S.staff || []).find(u => u.name === n) || {}).email || '').toLowerCase()).filter(Boolean);
      await fetch(EMS_CONFIG.line.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ kind, idToken: tok, to,
        meeting: { id: m.id, title: m.title, date: m.date, from: m.from, to: m.to, place: m.place, agenda: m.agenda, by: m.by, url: location.origin + location.pathname } }) });
      toast('ส่งแจ้งเตือนทาง LINE แล้ว');
    } catch (e) { toast('ส่ง LINE ไม่สำเร็จ (แจ้งใน EMS แล้ว): ' + (e.message || e)); }
  }

  /* ---------- หน้า ---------- */
  const ui = { tab: 'inv', open: '', form: null, q: '' };
  const blank = () => ({ id: '', title: '', date: addDays(today(), 1), from: '13:30', to: '15:30', place: '', agenda: '', link: '', inv: { all: false, depts: [], roles: [], people: [] }, line: lineOn() });
  const respChip = r => !r ? '<span class="chip warn">ยังไม่ตอบ</span>' : r.resp === 'yes' ? '<span class="chip ok">รับทราบแล้ว</span>' : '<span class="chip bad">ขอลา</span>';
  function row(m) {
    const r = myResp(m.id), cancelled = m.status === 'cancelled';
    return `<div class="row" style="flex-wrap:wrap;gap:8px;${cancelled ? 'opacity:.6' : ''}"><div class="ico">${ic('cal')}</div><div class="grow" style="min-width:200px">
      <div class="t">${esc(m.title)}${cancelled ? ' <span class="chip bad">ยกเลิก</span>' : m.date === today() ? ' <span class="chip bad">วันนี้</span>' : m.date === addDays(today(), 1) ? ' <span class="chip warn">พรุ่งนี้</span>' : ''}</div>
      <div class="muted small">${esc(thDate(m.date))} · ${esc(m.from)}–${esc(m.to)} น.${m.place ? ' · ' + esc(m.place) : ''} · นัดโดย ${esc(m.by)} · ${(m.invitees || []).length} คน</div></div>
      ${invited(m) && !cancelled ? (m.by === S.me.name ? '<span class="chip info">ผู้นัด</span>' : respChip(r)) : ''}<button class="btn sm" data-mt="open" data-id="${esc(m.id)}">ดู</button></div>`;
  }
  P.meetings = () => {
    const head = `<div class="top"><div><h1>นัดหมายการประชุม</h1><p>นัดประชุมจากผู้บริหารและกลุ่มงาน · ตอบรับหรือขอลาได้ที่นี่</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${canCreate() ? `<button class="btn pri" data-mt="new">${ic('plus')}นัดประชุม</button>` : ''}</div></div>`;
    if (!ready('meetings')) return head + '<div class="card"><div class="empty">กำลังโหลด…</div></div>';
    if (ui.form) return head + formHtml();
    if (ui.open) { const m = list().find(x => x.id === ui.open); if (m) return head + detailHtml(m); ui.open = ''; }
    const all = list().slice().sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));
    const inv = all.filter(m => invited(m) && upcoming(m)), own = all.filter(m => m.by === S.me.name && m.date >= addDays(today(), -60)), past = all.filter(m => (invited(m) || m.by === S.me.name) && (m.date < today() || m.status === 'cancelled')).reverse();
    const allUp = isAdm() || has('exec') ? all.filter(upcoming) : [];
    const tabs = [['inv', 'ที่ได้รับเชิญ', inv], ...(canCreate() ? [['own', 'ที่ฉันนัด', own]] : []), ...(allUp.length ? [['all', 'ทั้งโรงเรียน', allUp]] : []), ['past', 'ผ่านมาแล้ว / ยกเลิก', past]];
    if (!tabs.some(t => t[0] === ui.tab)) ui.tab = 'inv';
    const cur = (tabs.find(t => t[0] === ui.tab) || tabs[0])[2], pend = inv.filter(m => !myResp(m.id) && m.by !== S.me.name).length;
    return head + `<div class="pills">${tabs.map(([k, l, arr]) => `<button class="pill" aria-pressed="${k === ui.tab}" data-mt="tab" data-k="${k}">${l} <span class="muted">${arr.length}</span></button>`).join('')}</div>
      ${ui.tab === 'inv' && pend ? `<div class="notice" style="background:var(--warn-soft)">ยังไม่ได้กดรับทราบ ${pend} นัด — กด “ดู” แล้วเลือก รับทราบ หรือ ขอลา</div>` : ''}
      <div class="card"><div class="list">${cur.map(row).join('') || '<div class="empty">ไม่มีนัดประชุม</div>'}</div></div>`;
  };

  function detailHtml(m) {
    const r = myResp(m.id), own = isOwner(m), see = canSee(m), cancelled = m.status === 'cancelled', byName = rsvpBy(m);
    const yes = (m.invitees || []).filter(n => (byName[n] || {}).resp === 'yes' || n === m.by), no = (m.invitees || []).filter(n => (byName[n] || {}).resp === 'no'), none = (m.invitees || []).filter(n => !byName[n] && n !== m.by);
    const present = new Set(m.present || []), cf = see && !cancelled ? conflicts(m.invitees || [], m.date, m.from, m.to) : null;
    let h = `<div class="card"><button class="btn sm ghost" data-mt="back">‹ กลับ</button>
      <h2 style="margin:8px 0 4px">${esc(m.title)} ${cancelled ? '<span class="chip bad">ยกเลิกแล้ว</span>' : ''}</h2>
      <div class="muted">${esc(thDate(m.date))} · ${esc(m.from)}–${esc(m.to)} น.${m.place ? ' · ' + esc(m.place) : ''}</div>
      <div class="muted small" style="margin-top:4px">นัดโดย ${esc(m.by)} · ผู้เข้าประชุม ${(m.invitees || []).length} คน${m.updatedAt ? ' · แก้ไขล่าสุด ' + esc(fmtAt(m.updatedAt)) : ''}</div>
      ${m.agenda ? `<div style="margin-top:10px;white-space:pre-wrap;line-height:1.7">${esc(m.agenda)}</div>` : ''}
      ${m.link && /^https?:\/\//.test(m.link) ? `<p style="margin-top:8px"><a href="${esc(m.link)}" target="_blank" rel="noopener">${ic('folder')} เอกสารประกอบการประชุม</a></p>` : ''}
      ${m.minutes ? `<div class="notice" style="margin-top:10px"><b>บันทึกการประชุม</b><div style="white-space:pre-wrap;margin-top:4px">${esc(m.minutes)}</div></div>` : ''}</div>`;
    if (invited(m) && m.by !== S.me.name && !cancelled && m.date >= today()) h += `<div class="card"><h2>คำตอบของคุณ</h2><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${respChip(r)}
        <button class="btn ${r && r.resp === 'yes' ? 'pri' : ''}" data-mt="rsvp" data-id="${esc(m.id)}" data-v="yes">รับทราบ</button><button class="btn ${r && r.resp === 'no' ? 'pri' : ''}" data-mt="rsvp" data-id="${esc(m.id)}" data-v="no">ขอลา</button>
        ${r && r.resp === 'no' && r.reason ? `<span class="muted small">เหตุผล: ${esc(r.reason)}</span>` : ''}</div></div>`;
    if (see) {
      h += `<div class="card"><div class="row" style="border:0;padding:0 0 6px;flex-wrap:wrap;gap:8px"><h2 style="margin:0" class="grow">ผู้เข้าประชุม</h2>
          <span class="chip ok">รับทราบ ${yes.length}</span><span class="chip bad">ขอลา ${no.length}</span><span class="chip warn">ยังไม่ตอบ ${none.length}</span>
          ${!ready('mtRsvpOf') ? '<span class="muted small">กำลังโหลดคำตอบ…</span>' : ''}<button class="btn sm" data-mt="csv" data-id="${esc(m.id)}">${ic('down')}CSV</button></div>
        ${cf && !cf.weekend && Object.keys(cf.busy).length ? `<div class="notice" style="background:var(--warn-soft)"><b>ติดสอนช่วงประชุม ${Object.keys(cf.busy).length} คน:</b> ${Object.entries(cf.busy).map(([n, p]) => esc(n) + ' (' + esc(p.join(', ')) + ')').join(' · ')}</div>` : ''}
        <div class="muted small" style="margin-bottom:6px">${cancelled || !own ? '' : m.date <= today() ? 'วันประชุม: ติ๊กเช็กชื่อผู้มาประชุม' : 'เช็กชื่อได้ในวันประชุม'}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:4px">${(m.invitees || []).map(n => { const x = byName[n];
          return `<label style="display:flex;gap:8px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--line)">${own && m.date <= today() && !cancelled ? `<input type="checkbox" data-mt="present" data-id="${esc(m.id)}" data-n="${esc(n)}" ${present.has(n) ? 'checked' : ''}>` : ''}
            <span class="grow">${esc(n)}</span>${n === m.by ? '<span class="chip info">ผู้นัด</span>' : x ? (x.resp === 'yes' ? `<span class="chip ok" title="${esc(fmtAt(x.at))}">รับทราบ</span>` : `<span class="chip bad" title="${esc(x.reason || '')}">ขอลา</span>`) : '<span class="chip">ยังไม่ตอบ</span>'}</label>`; }).join('')}</div>
        ${m.date <= today() && !cancelled ? `<p class="small" style="margin-top:8px">มาประชุม ${present.size}/${(m.invitees || []).length} คน</p>` : ''}
        ${no.some(n => (byName[n] || {}).reason) ? `<details style="margin-top:8px"><summary class="small">เหตุผลการขอลา</summary>${no.map(n => `<div class="small">${esc(n)}: ${esc((byName[n] || {}).reason || '-')}</div>`).join('')}</details>` : ''}</div>`;
    }
    if (own) {
      h += `<div class="card"><h2>บันทึกการประชุม</h2><textarea class="in" rows="5" id="mt-min" placeholder="สรุปมติ / สิ่งที่ต้องดำเนินการ">${esc(m.minutes || '')}</textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn pri" data-mt="minutes" data-id="${esc(m.id)}">บันทึก</button><span class="grow"></span>
        ${!cancelled ? `<button class="btn" data-mt="edit" data-id="${esc(m.id)}">แก้ไขนัด</button><button class="btn" style="color:var(--bad)" data-mt="cancel" data-id="${esc(m.id)}">ยกเลิกนัด</button>` : ''}</div></div>`;
    }
    return h;
  }

  function formHtml() {
    const f = ui.form, names = resolve(f.inv), cf = conflicts(names, f.date, f.from, f.to), depts = [...new Set(staff().map(u => String(u.dept || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    const q = ui.q, cand = q ? staff().filter(u => u.name.indexOf(q) >= 0 && f.inv.people.indexOf(u.name) < 0).slice(0, 8) : [];
    const places = ((S.gen || {}).places || []);
    const pill = (on, attrs, label) => `<button class="pill" aria-pressed="${on}" ${attrs}>${label}</button>`;
    return `<div class="card"><h2>${f.id ? 'แก้ไขนัดประชุม' : 'นัดประชุมใหม่'}</h2>
      <div class="field"><label class="f" for="mt-t">หัวข้อการประชุม *</label><input id="mt-t" class="in" value="${esc(f.title)}" data-mtf="title" placeholder="เช่น ประชุมกลุ่มสาระคณิตศาสตร์ ครั้งที่ 3/2569"></div>
      <div class="grid g3"><div class="field"><label class="f" for="mt-d">วันที่ *</label><input id="mt-d" class="in" type="date" value="${esc(f.date)}" min="${today()}" data-mtf="date"></div>
        <div class="field"><label class="f" for="mt-f">เริ่ม *</label><input id="mt-f" class="in" type="time" value="${esc(f.from)}" data-mtf="from"></div>
        <div class="field"><label class="f" for="mt-e">สิ้นสุด *</label><input id="mt-e" class="in" type="time" value="${esc(f.to)}" data-mtf="to"></div></div>
      <div class="field"><label class="f" for="mt-p">สถานที่</label><input id="mt-p" class="in" list="mt-pl" value="${esc(f.place)}" data-mtf="place" placeholder="เช่น ห้องประชุม"><datalist id="mt-pl">${places.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="field"><label class="f" for="mt-a">วาระ / รายละเอียด</label><textarea id="mt-a" class="in" rows="4" data-mtf="agenda" placeholder="วาระที่ 1 …">${esc(f.agenda)}</textarea></div>
      <div class="field"><label class="f" for="mt-l">ลิงก์เอกสารประกอบ (Google Drive ฯลฯ)</label><input id="mt-l" class="in" value="${esc(f.link)}" data-mtf="link" placeholder="https://"></div></div>
    <div class="card"><h2>ผู้เข้าประชุม <span class="chip info">${names.length} คน</span></h2>
      <div class="pills">${pill(f.inv.all, 'data-mt="all"', 'ทั้งโรงเรียน')}</div>
      <div class="muted small" style="margin:8px 0 4px">ตามกลุ่มสาระ / กลุ่มงาน</div><div class="pills">${depts.map(d => pill(f.inv.depts.indexOf(d) >= 0, `data-mt="dept" data-v="${esc(d)}"`, esc(d))).join('')}</div>
      <div class="muted small" style="margin:8px 0 4px">ตามบทบาท</div><div class="pills">${ROLE_PICK.map(([k, l]) => pill(f.inv.roles.indexOf(k) >= 0, `data-mt="role" data-v="${k}"`, l)).join('')}</div>
      <div class="muted small" style="margin:8px 0 4px">เพิ่มรายคน</div>
      <input class="in" style="max-width:300px" placeholder="พิมพ์ชื่อครู" value="${esc(q)}" data-mtf="q" aria-label="ค้นหาครู">
      ${cand.length ? `<div class="pills" style="margin-top:6px">${cand.map(u => `<button class="pill" data-mt="addp" data-v="${esc(u.name)}">+ ${esc(u.name)}</button>`).join('')}</div>` : ''}
      ${f.inv.people.length ? `<div class="pills" style="margin-top:6px">${f.inv.people.map(n => `<button class="pill" aria-pressed="true" data-mt="rmp" data-v="${esc(n)}">${esc(n)} ✕</button>`).join('')}</div>` : ''}
      ${names.length ? `<details style="margin-top:10px"><summary class="small">รายชื่อทั้งหมด ${names.length} คน</summary><div class="small" style="margin-top:4px;line-height:1.8">${names.map(esc).join(', ')}</div></details>` : ''}</div>
    <div class="card"><h2>ตรวจชนคาบสอน</h2>
      ${cf.weekend ? '<div class="muted">วันที่เลือกเป็นวันหยุดสุดสัปดาห์ ไม่มีคาบสอน</div>'
        : !names.length ? '<div class="muted">เลือกผู้เข้าประชุมก่อน</div>'
        : `${Object.keys(cf.busy).length ? `<div class="notice" style="background:var(--warn-soft)"><b>ติดสอน ${Object.keys(cf.busy).length} คน</b> ในช่วง ${esc(f.from)}–${esc(f.to)} น.: ${Object.entries(cf.busy).map(([n, p]) => esc(n) + ' (' + esc(p.join(', ')) + ')').join(' · ')}</div>` : '<div class="notice" style="background:var(--ok-soft)">ไม่มีผู้เข้าประชุมติดสอนในช่วงเวลานี้</div>'}
          <div class="small" style="margin-top:6px">${cf.free.length ? '<b>คาบที่ทุกคนว่างวันนั้น:</b> ' + cf.free.map(esc).join(' · ') : 'ไม่มีคาบที่ทุกคนว่างพร้อมกันในวันนั้น'}</div>`}
      <p class="muted small" style="margin:8px 0 0">ตรวจจากตารางสอนภาคเรียนปัจจุบัน (ไม่รวมคาบแลก/สอนแทนรายวัน)</p></div>
    <div class="card"><label class="row" style="border:0;padding:0;gap:8px;${lineOn() ? 'cursor:pointer' : 'opacity:.6'}"><input type="checkbox" data-mt="line" ${f.line && lineOn() ? 'checked' : ''} ${lineOn() ? '' : 'disabled'} style="width:20px;height:20px">
        <span>ส่งแจ้งเตือนทาง LINE ด้วย${lineOn() ? '' : ' <span class="muted small">(ยังไม่ได้ตั้งค่าบริการ LINE ของโรงเรียน — แจ้งในกระดิ่ง EMS อย่างเดียว)</span>'}</span></label>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" data-mt="cancelForm">ยกเลิก</button><span class="grow"></span><button class="btn pri" data-mt="save">${f.id ? 'บันทึกการแก้ไข' : 'ส่งนัดประชุม'}</button></div></div>`;
  }

  function saveForm() {
    const f = ui.form; if (!f) return;
    if (!canCreate()) return toast('เฉพาะผู้บริหาร หัวหน้ากลุ่มสาระ ฝ่ายวิชาการ และฝ่ายวัดผล');
    if (!f.title.trim()) return toast('กรอกหัวข้อการประชุม');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !f.from || !f.to) return toast('กรอกวันและเวลาให้ครบ');
    if (f.to <= f.from) return toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
    if (!f.id && f.date < today()) return toast('วันที่ต้องไม่ย้อนหลัง');
    if (f.link && !/^https?:\/\//.test(f.link)) return toast('ลิงก์ต้องขึ้นต้นด้วย https://');
    const names = resolve(f.inv); if (!names.length) return toast('เลือกผู้เข้าประชุมอย่างน้อย 1 คน');
    const arr = list(), now = new Date().toISOString(), old = f.id && arr.find(x => x.id === f.id);
    if (old && !isOwner(old)) return toast('แก้ได้เฉพาะผู้นัดหรือแอดมิน');
    const m = Object.assign({}, old || {}, { id: f.id || uid(), title: f.title.trim(), date: f.date, from: f.from, to: f.to, place: f.place.trim(), agenda: f.agenda.trim(), link: f.link.trim(),
      inv: JSON.parse(JSON.stringify(f.inv)), invitees: names, status: 'scheduled', line: !!(f.line && lineOn()) }, old ? { updatedAt: now } : { by: S.me.name, byEmail: myEmail(), at: now, present: [] });
    if (old) arr[arr.indexOf(old)] = m; else arr.push(m);
    save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush();
    sendLine(old ? 'meeting.updated' : 'meeting.created', m);
    ui.form = null; ui.open = m.id; ui.q = ''; toast(old ? 'บันทึกการแก้ไขนัดแล้ว' : 'ส่งนัดประชุมถึง ' + names.length + ' คนแล้ว'); redraw();
  }
  function rsvp(id, v) {
    const m = list().find(x => x.id === id); if (!m || !invited(m)) return;
    if (m.status === 'cancelled') return toast('นัดนี้ถูกยกเลิกแล้ว');
    if (!ready('mtRsvpMine')) return toast('กำลังโหลด รอสักครู่แล้วลองใหม่');
    let reason = '';
    if (v === 'no') { reason = (prompt('เหตุผลที่ขอลา (เช่น ติดสอน ไปราชการ)', (myResp(id) || {}).reason || '') || '').trim(); if (!reason) return toast('กรุณาระบุเหตุผลการขอลา'); }
    const em = myEmail(), rid = id + '_' + hash(em || S.me.name), arr = mine(), x = { id: rid, mid: id, date: m.date, who: em, name: S.me.name, resp: v, reason: reason.slice(0, 300), at: new Date().toISOString() };
    const i = arr.findIndex(r => r.id === rid); if (i >= 0) arr[i] = x; else arr.push(x);
    save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); toast(v === 'yes' ? 'รับทราบนัดประชุมแล้ว' : 'แจ้งขอลาแล้ว'); redraw();
  }
  function csvOf(m) {
    const by = rsvpBy(m), pres = new Set(m.present || []);
    const rows = [['หัวข้อ', 'วันที่', 'เวลา', 'ชื่อ', 'กลุ่มสาระ/กลุ่มงาน', 'คำตอบ', 'เหตุผล', 'ตอบเมื่อ', 'มาประชุม']].concat((m.invitees || []).map(n => [m.title, m.date, m.from + '–' + m.to, n,
      ((S.staff || []).find(u => u.name === n) || {}).dept || '', by[n] ? (by[n].resp === 'yes' ? 'รับทราบ' : 'ขอลา') : 'ยังไม่ตอบ', (by[n] || {}).reason || '', by[n] ? fmtAt(by[n].at) : '', pres.has(n) ? 'มา' : '']));
    const text = '﻿' + rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = 'ผู้เข้าประชุม_' + m.date + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-mt]'); if (!t) return; const a = t.dataset.mt, f = ui.form;
    if (a === 'tab') { ui.tab = t.dataset.k; return redraw(); }
    if (a === 'open') { ui.open = t.dataset.id; ui.form = null; return render(); }
    if (a === 'back') { ui.open = ''; return render(); }
    if (a === 'new') { if (!canCreate()) return; ui.form = blank(); ui.open = ''; ui.q = ''; return render(); }
    if (a === 'edit') { const m = list().find(x => x.id === t.dataset.id); if (!m || !isOwner(m)) return; ui.form = { id: m.id, title: m.title, date: m.date, from: m.from, to: m.to, place: m.place || '', agenda: m.agenda || '', link: m.link || '', inv: JSON.parse(JSON.stringify(m.inv || { all: false, depts: [], roles: [], people: m.invitees || [] })), line: !!m.line }; return render(); }
    if (a === 'cancelForm') { ui.form = null; return render(); }
    if (f && a === 'all') { f.inv.all = !f.inv.all; return redraw(); }
    if (f && (a === 'dept' || a === 'role')) { const k = a === 'dept' ? 'depts' : 'roles', i = f.inv[k].indexOf(t.dataset.v); if (i >= 0) f.inv[k].splice(i, 1); else f.inv[k].push(t.dataset.v); return redraw(); }
    if (f && a === 'addp') { f.inv.people.push(t.dataset.v); ui.q = ''; return redraw(); }
    if (f && a === 'rmp') { f.inv.people = f.inv.people.filter(n => n !== t.dataset.v); return redraw(); }
    if (f && a === 'line') { f.line = t.checked; return; }
    if (a === 'save') return saveForm();
    if (a === 'rsvp') return rsvp(t.dataset.id, t.dataset.v);
    if (a === 'present') { const m = list().find(x => x.id === t.dataset.id); if (!m || !isOwner(m)) return; const s = new Set(m.present || []); if (t.checked) s.add(t.dataset.n); else s.delete(t.dataset.n);
      m.present = [...s]; save(); if (window.EMSCloud && EMSCloud.dirty) EMSCloud.dirty(); return; }
    if (a === 'minutes') { const m = list().find(x => x.id === t.dataset.id); if (!m || !isOwner(m)) return; m.minutes = ($('#mt-min') || {}).value || ''; m.minutesAt = new Date().toISOString(); save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); toast('บันทึกการประชุมแล้ว'); return redraw(); }
    if (a === 'cancel') { const m = list().find(x => x.id === t.dataset.id); if (!m || !isOwner(m)) return; if (!confirm('ยกเลิกนัด “' + m.title + '” ? ผู้ถูกเชิญจะได้รับแจ้งที่กระดิ่ง')) return;
      m.status = 'cancelled'; m.updatedAt = new Date().toISOString(); save(); if (window.EMSCloud && EMSCloud.flush) EMSCloud.flush(); sendLine('meeting.cancelled', m); toast('ยกเลิกนัดแล้ว'); return redraw(); }
    if (a === 'csv') { const m = list().find(x => x.id === t.dataset.id); if (m) csvOf(m); }
  });
  document.addEventListener('input', e => { const t = e.target.closest('[data-mtf]'); if (!t || !ui.form) return; const k = t.dataset.mtf;
    if (k === 'q') { ui.q = t.value.trim(); return; } ui.form[k] = t.value; });
  document.addEventListener('change', e => { const t = e.target.closest('[data-mtf]'); if (!t || !ui.form) return; const k = t.dataset.mtf;
    if (k === 'q') { ui.q = t.value.trim(); return redraw(); } ui.form[k] = t.value; if (k === 'date' || k === 'from' || k === 'to') redraw(); });

  /* ---------- แจ้งเตือน ---------- */
  if (window.EMSNotify) EMSNotify.register(() => {
    const out = [], t = today(), tm = addDays(t, 1), inv = list().filter(m => invited(m) && upcoming(m));
    const pendingAck = m => !myResp(m.id) && m.by !== S.me.name, soonAll = inv.filter(m => m.date === t || m.date === tm), soon = soonAll.filter(pendingAck);
    soonAll.filter(m => !pendingAck(m)).forEach(m => out.push({ id: 'mt-remind-' + m.id + '-' + m.date, level: 'info', title: 'ประชุม' + (m.date === t ? 'วันนี้' : 'พรุ่งนี้') + ' ' + m.from + ' น.: ' + m.title, sub: m.place || '', page: 'meetings', at: m.at }));
    if (soon.length) out.push({ id: 'mt-soon', level: 'urgent', title: soon.length === 1 ? 'ยังไม่รับทราบ · ประชุม' + (soon[0].date === t ? 'วันนี้' : 'พรุ่งนี้') + ': ' + soon[0].title : 'ยังไม่รับทราบนัดประชุมวันนี้/พรุ่งนี้', sub: soon.length === 1 ? soon[0].from + ' น.' + (soon[0].place ? ' · ' + soon[0].place : '') : soon.map(m => m.title).join(', '), n: soon.length, page: 'meetings' });
    const noAns = inv.filter(m => pendingAck(m) && soon.indexOf(m) < 0);      /* ผู้นัดไม่ต้องรับทราบนัดของตัวเอง · วันนี้/พรุ่งนี้นับอยู่ในด่วนแล้ว */
    if (noAns.length) out.push({ id: 'mt-rsvp', level: 'todo', title: 'นัดประชุมที่ยังไม่ได้กดรับทราบ', sub: noAns.slice(0, 2).map(m => m.title).join(', '), n: noAns.length, page: 'meetings' });
    list().filter(m => invited(m) && m.status === 'cancelled' && m.date >= addDays(t, -7)).forEach(m => out.push({ id: 'mt-cancel-' + m.id, level: 'info', title: 'ยกเลิกนัด: ' + m.title, sub: thDate(m.date), page: 'meetings', at: m.updatedAt }));
    list().filter(m => invited(m) && upcoming(m) && m.updatedAt && m.by !== S.me.name).forEach(m => out.push({ id: 'mt-upd-' + m.id + '-' + m.updatedAt, level: 'info', title: 'แก้ไขนัดประชุม: ' + m.title, sub: thDate(m.date) + ' ' + m.from + ' น.', page: 'meetings', at: m.updatedAt }));
    return out;
  });

  /* ---------- เมนู ---------- */
  const N = window.EMSNav;
  if (N) {
    const add = (v, g, item) => { const grp = (N.NAVG[v] || []).find(x => x[0] === g); if (grp && !grp[1].some(x => x[0] === item[0])) grp[1].push(item); };
    add('teacher', 'งานของฉัน', ['meetings', 'นัดประชุม', 'cal']);
    add('admin', 'ฝ่ายงาน', ['meetings', 'นัดประชุม', 'cal']);
  }
  window.EMSMeetings = { canSeeOpen: () => { const m = list().find(x => x.id === ui.open); return !!m && canSee(m); }, list, resolve, conflicts, ui, rsvp: (id, v) => rsvp(id, v) };
})();
