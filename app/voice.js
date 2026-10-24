/* EMS — กรอกคะแนนด้วยเสียง (ย้ายจาก KruSpace: app/index.html หมวด "8ก) กรอกคะแนนด้วยเสียง")
   พูดคะแนนลงช่องที่เลือกไว้ พอเว้นจังหวะระบบเติมแล้วเลื่อนไปช่องถัดไปเอง
   - ใช้ได้เฉพาะเอนจิน Chromium (Chrome / Edge / Samsung Internet) ผ่าน https หรือ localhost
   - ภาษาไทยคืนตัวเลขได้ทั้ง "7" และ "เจ็ด" จึงอ่านได้ทั้งสองแบบ
   - ค่าที่เกินคะแนนเต็มจะไม่เติม (ฟัง 7 ผิดเป็น 70 เสียหายกว่าให้พูดซ้ำ)
   ช่องที่ใช้เสียงได้คือ input.cell ในตาราง #scGrid ของหน้า "กรอกคะแนน" */
(() => {
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmt = (x, d) => { if (!isFinite(x)) return '–'; const s = Number(x).toFixed(d === undefined ? 2 : d); return (s.indexOf('.') < 0 ? s : s.replace(/\.?0+$/, '')) || '0'; };      // ไม่มีทศนิยม (d = 0) ห้ามตัดศูนย์ท้าย — 100 ต้องไม่กลายเป็น 1
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const VOICE_OK = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

const THAI_NUM_WORD = { 'ศูนย์': 0, 'สูญ': 0, 'หนึ่ง': 1, 'เอ็ด': 1, 'สอง': 2, 'ยี่': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5, 'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9 };
/** อ่านเลขไทยแบบมีหลัก เช่น "สามสิบห้า" = 35 • คืน null ถ้าเจอคำที่ไม่ใช่ตัวเลข */
function thaiWordsToInt(s) {
  let total = 0, cur = 0, seen = false, i = 0, lastWasDigit = false;      // "เจ็ดแปด" ไม่รับ เพราะจะกลายเป็น 15 แบบเงียบ ๆ
  while (i < s.length) {
    if (s.startsWith('ร้อย', i)) { total += (cur || 1) * 100; cur = 0; seen = true; lastWasDigit = false; i += 4; continue; }
    if (s.startsWith('พัน', i)) { total += (cur || 1) * 1000; cur = 0; seen = true; lastWasDigit = false; i += 3; continue; }
    if (s.startsWith('สิบ', i)) { cur = (cur || 1) * 10; seen = true; lastWasDigit = false; i += 3; continue; }
    let hit = null;
    for (const w in THAI_NUM_WORD) if (s.startsWith(w, i) && (!hit || w.length > hit.length)) hit = w;
    if (!hit || lastWasDigit) return null;
    cur += THAI_NUM_WORD[hit]; seen = true; lastWasDigit = true; i += hit.length;
  }
  return seen ? total + cur : null;
}
function thaiWordsToDigits(s) {                       // "สองห้า" = "25" ใช้กับเลขหลังจุดทศนิยม
  let out = '', i = 0;
  while (i < s.length) {
    let hit = null;
    for (const w in THAI_NUM_WORD) if (s.startsWith(w, i) && (!hit || w.length > hit.length)) hit = w;
    if (!hit) return null;
    out += THAI_NUM_WORD[hit]; i += hit.length;
  }
  return out || null;
}
/** แปลงสิ่งที่ได้ยินเป็นตัวเลข รองรับ "7.5" "เจ็ดจุดห้า" "เจ็ดครึ่ง" และเลขไทย ๗ */
function parseSpokenNumber(text) {
  let t = String(text == null ? '' : text).trim();
  if (!t) return null;
  t = t.replace(/[๐-๙]/g, d => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
  t = t.replace(/คะแนน|แต้ม|เท่ากับ|ค่ะ|คะ|ครับ/g, '');
  if (/\d\s+\d/.test(t)) return null;                 // "7 8" คือพูดสองเลขรวดเดียว ไม่ใช่ 78
  t = t.replace(/[\s,]/g, '');
  let half = false;
  if (/ครึ่ง$/.test(t)) { half = true; t = t.replace(/ครึ่ง$/, ''); }
  if (!t) return half ? 0.5 : null;
  const parts = t.split(/จุด|\./);
  if (parts.length > 2) return null;
  const whole = parts[0] === '' ? 0 : (/^\d+$/.test(parts[0]) ? parseInt(parts[0], 10) : thaiWordsToInt(parts[0]));
  if (whole === null || !isFinite(whole)) return null;
  let frac = 0;
  if (parts.length === 2 && parts[1] !== '') {
    const w = parts[1];
    let digits = /^\d+$/.test(w) ? w : thaiWordsToDigits(w);
    if (digits === null) { const n = thaiWordsToInt(w); digits = n === null ? null : String(n); }
    if (digits === null) return null;
    frac = Number('0.' + digits);
  }
  const value = whole + frac + (half ? 0.5 : 0);
  return isFinite(value) ? value : null;
}

const VOICE_SPEEDS = [[350, 'ไว'], [220, 'ไวมาก'], [0, 'รอจบประโยค']];   // รอเงียบกี่ ms หลังได้ยินตัวเลขครบ

const css = document.createElement('style');
css.textContent = `
.vhud{position:fixed;left:50%;transform:translateX(-50%);bottom:88px;z-index:60;width:min(660px,calc(100vw - 20px));background:var(--surface);border:2px solid var(--brand);border-radius:16px;padding:12px 14px;box-shadow:0 12px 34px rgba(0,0,0,.3)}
.vhud-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.vhud-row .spacer{flex:1}
.vhud button{border:1px solid var(--line);background:var(--surface2);border-radius:8px;min-height:34px;padding:0 10px;font-size:.82rem;font-weight:600}
.vhud button.on{background:var(--brand-soft);border-color:var(--brand);color:var(--brand)}
.vhud [data-vstop]{background:var(--bad);border-color:var(--bad);color:#fff}
.vdot{width:12px;height:12px;border-radius:50%;background:var(--bad);animation:vpulse 1.2s infinite}
.vdot.off{background:var(--muted);animation:none}
@keyframes vpulse{50%{opacity:.35}}
.vhud-cell{margin-top:8px;font-size:1.02rem;line-height:1.5}
.vhud-col{color:var(--muted);font-size:.9rem}
.vhud-heard{min-height:1.8em;margin-top:6px;padding:6px 10px;border-radius:8px;background:var(--surface2);font-size:.92rem}
.vhud-heard.ok{background:var(--ok-soft);color:var(--ok)} .vhud-heard.warn{background:var(--warn-soft);color:var(--warn)} .vhud-heard.bad{background:var(--bad-soft);color:var(--bad)}
.vhud-tip{font-size:.76rem;color:var(--muted);margin-top:6px;line-height:1.5}
@media(max-width:860px){.vhud{bottom:76px}}
`;
document.head.appendChild(css);

const ScoreVoice = {
  rec: null, on: false, dir: 'down', readName: false, busy: false, restart: null, pos: null,
  settleTimer: null, seg: null, painted: null, hushTimer: null, listening: false,

  grid() { return document.querySelector('#scGrid'); },
  at(r, c) { const g = this.grid(); return g ? g.querySelector('input.cell:not(:disabled)[data-r="' + r + '"][data-c="' + c + '"]') : null; },
  firstCell() { const g = this.grid(); return g ? g.querySelector('input.cell:not(:disabled)') : null; },
  /** ช่องที่กำลังทำงานอยู่ — ถือตามช่องที่โฟกัสก่อน แล้วค่อยถือตามช่องที่ทำเครื่องหมายไว้ */
  cell() {
    const g = this.grid(); if (!g) return null;
    const a = document.activeElement;
    if (a && a.classList && a.classList.contains('cell') && !a.disabled && g.contains(a)) return a;
    return g.querySelector('input.cell.voice-here:not(:disabled)');
  },
  bounds() {
    const g = this.grid(); let r = -1, c = -1;
    if (g) g.querySelectorAll('input.cell').forEach(el => { r = Math.max(r, +el.dataset.r); c = Math.max(c, +el.dataset.c); });
    return { rows: r + 1, cols: c + 1 };
  },
  mark(cell) {
    const g = this.grid(); if (!g || !cell) return;
    $$('input.cell.voice-here', g).forEach(el => el.classList.remove('voice-here'));
    cell.classList.add('voice-here');
    this.pos = { r: +cell.dataset.r, c: +cell.dataset.c };
    this.paint();
  },
  focusCell(cell) {
    if (!cell) return;
    cell.focus({ preventScroll: true });
    try { cell.select(); } catch (e) {}
    this.mark(cell);
    const box = cell.getBoundingClientRect();           // เลื่อนจอเฉพาะตอนที่ช่องหลุดออกนอกสายตาจริง ๆ
    if (box.top < 96 || box.bottom > window.innerHeight - 230) cell.scrollIntoView({ block: 'center', inline: 'nearest' });
  },
  step(delta) {
    const cur = this.cell(); if (!cur) return false;
    const r = +cur.dataset.r, c = +cur.dataset.c, bd = this.bounds();
    let found = null;
    if (this.dir === 'right') { for (let i = c + delta; i >= 0 && i < bd.cols; i += delta) { found = this.at(r, i); if (found) break; } }
    else { for (let i = r + delta; i >= 0 && i < bd.rows; i += delta) { found = this.at(i, c); if (found) break; } }
    if (!found) return false;
    this.focusCell(found);
    if (delta > 0) this.sayName(found);
    return true;
  },
  /* อ่านชื่อคนถัดไป ระหว่างแอปพูดต้องปิดหูตัวเอง ไม่งั้นไมค์จะรับเสียงแอปไปเป็นคะแนน */
  sayName(cell) {
    if (!this.readName || !window.speechSynthesis) return;
    const tr = cell.closest('tr'); if (!tr) return;
    const no = (tr.cells[0] || {}).textContent || '';
    const name = ((tr.cells[1] || {}).textContent || '').replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง)\s*/, '');
    const words = 'เลขที่ ' + no + ' ' + name;
    this.hush(Math.min(4000, Math.max(900, words.length * 90)));
    try {
      const u = new SpeechSynthesisUtterance(words);
      u.lang = 'th-TH'; u.rate = 1.35; u.onend = u.onerror = () => this.hush(250);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { this.hush(0); }
  },
  hush(ms) {
    clearTimeout(this.hushTimer);
    if (!(ms > 0)) { this.busy = false; return; }
    this.busy = true;
    this.hushTimer = setTimeout(() => { this.busy = false; }, ms);
  },
  /* ข้อความช่วงที่แอปพูดเอง ต้องทิ้ง และจำว่าทิ้งถึงตรงไหน ไม่งั้นจะย้อนกลับมาถูกกรอกทีหลัง */
  skip(text) {
    this.settle(null);
    let seg = this.seg; if (!seg) seg = this.seg = { consumed: '', numText: '', cell: null, value: null };
    seg.consumed = String(text || '');
  },
  where(cell) {
    const tr = cell.closest('tr');
    const no = tr ? ((tr.cells[0] || {}).textContent || '') : '', name = tr ? ((tr.cells[1] || {}).textContent || '') : '';
    const max = cell.dataset.max || '';
    return '<b>เลขที่ ' + esc(no) + ' ' + esc(name) + '</b><br><span class="vhud-col">' + esc(cell.dataset.label || '') + (max ? ' • เต็ม ' + esc(max) : '') + '</span>';
  },
  hud() {
    let el = document.querySelector('#voiceHud'); if (el) return el;
    el = document.createElement('div'); el.id = 'voiceHud'; el.className = 'vhud';
    el.innerHTML =
      '<div class="vhud-row"><span class="vdot"></span><b>กรอกคะแนนด้วยเสียง</b><span class="spacer"></span>' +
        '<button type="button" data-vspeed title="เร็วขึ้น = เติมทันทีที่ได้ยินตัวเลขครบ ไม่รอให้เอนจินประกาศจบประโยค"></button>' +
        '<button type="button" data-vdir title="ทิศที่จะเลื่อนไปหลังกรอกเสร็จ"></button>' +
        '<button type="button" data-vread title="ให้แอปอ่านชื่อคนถัดไปให้ฟัง"></button>' +
        '<button type="button" data-vstop>หยุด</button></div>' +
      '<div class="vhud-cell" data-vcell></div><div class="vhud-heard" data-vheard></div>' +
      '<div class="vhud-tip">พูดตัวเลขได้เลย เช่น “เจ็ด” “เจ็ดจุดห้า” “สิบห้า” • “ข้าม” เว้นช่องนี้ • “ผิด” ย้อนกลับแล้วล้างให้ • “ลบ” ล้างช่องนี้ • “เต็ม” ให้คะแนนเต็ม • “หยุด” ปิดไมค์</div>';
    document.body.appendChild(el);
    el.querySelector('[data-vspeed]').addEventListener('click', () => {
      const i = VOICE_SPEEDS.findIndex(sp => sp[0] === this.settleMs());
      S.prefs.voiceSettle = VOICE_SPEEDS[(i + 1) % VOICE_SPEEDS.length][0]; save();
      this.painted = null; this.paint();
    });
    el.querySelector('[data-vdir]').addEventListener('click', () => { this.dir = this.dir === 'down' ? 'right' : 'down'; this.paint(); });
    el.querySelector('[data-vread]').addEventListener('click', () => { this.readName = !this.readName; this.paint(); });
    el.querySelector('[data-vstop]').addEventListener('click', () => this.stop());
    return el;
  },
  settleMs() { const v = Number(S.prefs.voiceSettle); return VOICE_SPEEDS.some(sp => sp[0] === v) ? v : VOICE_SPEEDS[0][0]; },
  paint(heard, kind) {
    const el = document.querySelector('#voiceHud'); if (!el) return;
    const ms = this.settleMs(), speed = (VOICE_SPEEDS.find(sp => sp[0] === ms) || VOICE_SPEEDS[0])[1];
    const set = (sel, text) => { const b = el.querySelector(sel); if (b.textContent !== text) b.textContent = text; };
    set('[data-vspeed]', 'ความไว: ' + speed);
    set('[data-vdir]', this.dir === 'down' ? 'ลงคนถัดไป ↓' : 'ไปช่องขวา →');
    set('[data-vread]', 'อ่านชื่อ: ' + (this.readName ? 'เปิด' : 'ปิด'));
    el.querySelector('[data-vread]').classList.toggle('on', this.readName);
    el.querySelector('.vdot').classList.toggle('off', !this.listening);
    const cur = this.cell();
    if (cur !== this.painted) { el.querySelector('[data-vcell]').innerHTML = cur ? this.where(cur) : 'แตะช่องที่จะเริ่มกรอกก่อน'; this.painted = cur; }
    if (heard !== undefined) { const h = el.querySelector('[data-vheard]'); h.textContent = heard; h.className = 'vhud-heard' + (kind ? ' ' + kind : ''); }
  },
  write(cell, value) {
    if (cell.readOnly) return;                                        // คะแนนสอบที่ฝ่ายวัดผลล็อกไว้
    cell.value = value === '' ? '' : String(value);
    cell.dispatchEvent(new Event('change', { bubbles: true }));     // ส่งต่อให้ตัวรับเดิมของตาราง (บันทึก + คิดคะแนนรวม)
  },
  settle(fn, ms) { clearTimeout(this.settleTimer); this.settleTimer = fn ? setTimeout(fn, ms == null ? this.settleMs() : ms) : null; },
  /* จำเลขที่เพิ่งกรอก 2.5 วินาทีล่าสุด แล้วตัดหัวก้อนที่ซ้ำ ยอมพลาดเป็น "ไม่กรอก" ดีกว่า "กรอกเกิน" */
  dedupe(values) {
    const now = Date.now();
    this.recent = (this.recent || []).filter(r => now - r.at < 2500);
    const tail = this.recent.map(r => r.v);
    for (let n = Math.min(tail.length, values.length); n > 0; n--) {
      let same = true;
      for (let i = 0; i < n; i++) if (tail[tail.length - n + i] !== values[i]) { same = false; break; }
      if (same) return n;
    }
    return 0;
  },
  /* อ่านเฉพาะส่วนที่งอกใหม่ของข้อความที่เอนจินส่งมา เป็นเลขทีละตัว */
  ingest(text, isFinal) {
    const t = String(text || '');
    if (!isFinal && !this.settleMs()) return;               // โหมดรอจบประโยค ไม่เดาจากคำระหว่างทาง
    let seg = this.seg; if (!seg) seg = this.seg = { consumed: '', numText: '', cell: null, value: null };
    const now = Date.now(), quiet = now - (seg.at || 0) > 1200;
    seg.at = now;
    let rest, fresh = false;
    if (!seg.consumed) { rest = t; fresh = true; }
    else if (t.startsWith(seg.consumed)) rest = t.slice(seg.consumed.length);
    else if (seg.consumed.startsWith(t) && !quiet) return;    // ข้อความเดิมถูกส่งกลับมาซ้ำ
    else { rest = t; fresh = true; seg.consumed = ''; seg.cell = null; seg.value = null; }

    const lead = rest.length - rest.replace(/^\s+/, '').length, head = rest.trim();
    if (!head) { if (isFinal) this.settle(null); return; }
    const base = t.length - rest.length + lead;
    if (seg.cell && /^(จุด|\.)/.test(head)) { this.refine(seg, seg.numText + head, t); return; }
    if (isFinal && this.command(head, seg)) { seg.consumed = t; this.settle(null); return; }

    const parts = []; let m; const re = /\S+/g;
    while ((m = re.exec(head))) {
      const last = parts.length - 1;
      if (last >= 0 && (/^(จุด|\.)/.test(m[0]) || /(จุด|\.)$/.test(parts[last].w))) parts[last].w += m[0];
      else parts.push({ w: m[0], at: m.index });
    }
    if (!parts.length) return;
    if (fresh) {
      const values = parts.map(p => parseSpokenNumber(p.w)), cut = this.dedupe(values);
      if (cut) {
        parts.splice(0, cut);
        seg.consumed = cut < values.length ? t.slice(0, base + parts[0].at) : t;
        if (!parts.length) { this.settle(null); return; }
      }
    }
    if (parts.length > 3) {                                    // เกินสามตัวรวดเดียว = เสียงรบกวน ไม่เติมเอง
      seg.consumed = t; this.settle(null);
      this.paint('ได้ยินตัวเลขรวดเดียว ' + parts.length + ' ตัว — ไม่เติมเพราะน่าจะเป็นเสียงรบกวน พูดใหม่ทีละคน', 'bad');
      return;
    }
    for (let i = 0; i < parts.length - 1; i++) this.take(seg, parts[i].w, isFinal);
    const tail = parts[parts.length - 1];
    if (isFinal) { this.take(seg, tail.w, true); seg.consumed = t; this.settle(null); return; }
    const took = this.arm(seg, tail.w, t);
    seg.consumed = took ? t : t.slice(0, base + tail.at);
  },
  /** คำสั่งเสียง — ทำเฉพาะตอนได้ยินครบประโยค เพราะ "ข้าม" ที่เดาผิดแก้คืนไม่ได้ */
  command(head, seg) {
    const flat = head.replace(/[\s.]/g, ''), said = w => flat.indexOf(w) >= 0;
    if (said('หยุด') || said('ปิดไมค์') || said('เลิก')) { this.stop(); return true; }
    if (said('ผิด') || said('แก้')) {
      if (this.step(-1)) { const back = this.cell(); if (back) this.write(back, ''); this.paint('ย้อนกลับแล้วล้างช่องนั้นให้', 'ok'); }
      return true;
    }
    const cur = this.cell();
    if (said('ย้อน') || said('ถอย')) { this.paint('ย้อนกลับ', 'ok'); this.step(-1); return true; }
    if (!cur) return false;
    if (said('ข้าม') || said('ถัดไป') || said('ต่อไป') || said('ผ่าน')) {
      this.paint('ข้ามช่องนี้', 'ok');
      if (!this.step(1)) this.paint('หมดคอลัมน์แล้ว แตะช่องใหม่เพื่อกรอกต่อ', 'warn');
      return true;
    }
    if (said('ลบ') || said('ล้าง') || said('เคลียร์')) { this.write(cur, ''); this.paint('ล้างช่องนี้แล้ว', 'ok'); return true; }
    if (said('ว่าง') || said('ไม่มี') || said('ขาด')) {
      this.write(cur, ''); this.paint('เว้นว่างไว้', 'ok');
      if (!this.step(1)) this.paint('หมดคอลัมน์แล้ว แตะช่องใหม่เพื่อกรอกต่อ', 'warn');
      return true;
    }
    const max = num(cur.dataset.max || 0);
    if (said('เต็ม') && max > 0) { this.take(seg, String(max), true); return true; }
    return false;
  },
  refine(seg, numText, consumed) {                 // พูดทศนิยมตามมาทีหลัง → ย้อนไปแก้ช่องเดิม
    seg.consumed = consumed;
    if (!seg.cell || !seg.cell.isConnected) return;
    const max = num(seg.cell.dataset.max || 0), v = parseSpokenNumber(numText);
    if (v === null || (max > 0 && v > max)) return;
    seg.numText = numText;
    if (v === seg.value) return;
    seg.value = v; this.write(seg.cell, v); this.paint('ฟังต่อแล้วแก้เป็น ' + fmt(v) + ' ✓', 'warn');
  },
  arm(seg, word, full) {
    const cur = this.cell(); if (!cur) return false;
    const max = num(cur.dataset.max || 0), v = parseSpokenNumber(word);
    if (v === null || (max > 0 && v > max)) { this.settle(null); return false; }
    const canGrow = !(max > 0) || v * 10 <= max;     // โตต่อไม่ได้แล้ว = เติมทันที ไม่ต้องรอเงียบ
    if (!canGrow) { this.settle(null); this.take(seg, word, false); return true; }
    this.settle(() => { this.take(seg, word, false); seg.consumed = full; });
    return false;
  },
  take(seg, word, loud) {
    const cur = this.cell();
    if (!cur) { if (loud) this.paint('ยังไม่ได้เลือกช่อง — แตะช่องที่จะกรอกก่อน', 'warn'); return; }
    const max = num(cur.dataset.max || 0), v = parseSpokenNumber(word);
    if (v === null || (max > 0 && v > max)) {
      if (!loud) return;
      if (v !== null) this.paint('ได้ยินเป็น ' + fmt(v) + ' ซึ่งเกินคะแนนเต็ม ' + fmt(max) + ' — ยังไม่เติม พูดใหม่อีกครั้ง', 'bad');
      else this.paint('ไม่เข้าใจ “' + word + '” — พูดใหม่อีกครั้ง', 'bad');
      return;
    }
    this.write(cur, v);
    const now = Date.now();
    this.recent = (this.recent || []).filter(r => now - r.at < 2500);
    this.recent.push({ v, at: now });
    const note = '“' + word + '” → ' + fmt(v) + ' ✓';
    this.paint(note, 'ok');
    seg.cell = cur; seg.value = v; seg.numText = word;
    if (!this.step(1)) this.paint(note + ' • หมดคอลัมน์แล้ว แตะช่องใหม่เพื่อกรอกต่อ', 'warn');
  },
  lockKeyboard(lock) { const g = this.grid(); if (g) g.querySelectorAll('input.cell').forEach(el => { el.inputMode = lock ? 'none' : 'decimal'; }); },
  syncButton() {
    const btn = document.querySelector('#voiceBtn'); if (!btn) return;
    btn.classList.toggle('pri', this.on);
    btn.innerHTML = this.on ? '⏹<span class="lbl">หยุดกรอกด้วยเสียง</span>' : '🎤<span class="lbl">กรอกด้วยเสียง</span>';   // ป้ายซ่อนบนจอเล็ก เหลือไอคอน
    btn.title = this.on ? 'หยุดกรอกด้วยเสียง' : 'กรอกด้วยเสียง';
  },
  toggle() { if (this.on) this.stop(); else this.start(); },
  relisten(delay) {                                 // Chrome ปิดการฟังเองเป็นระยะ ต้องเริ่มใหม่และลองซ้ำถ้าพลาด
    clearTimeout(this.restart);
    this.restart = setTimeout(() => {
      if (!this.on || !this.rec) return;
      try { this.rec.start(); this.alive = Date.now(); }
      catch (e) { this.relisten(Math.min(2000, Math.max(120, (delay || 60) * 2))); }
    }, delay);
  },
  start() {
    if (this.on) return;
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { toast('เบราว์เซอร์นี้ยังไม่รองรับการกรอกด้วยเสียง — ใช้ Chrome หรือ Edge แทน'); return; }
    if (!this.grid()) { toast('เปิดหน้ากรอกคะแนนก่อน'); return; }
    const rec = new Rec();
    rec.lang = 'th-TH'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = ev => {
      this.alive = Date.now();
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) { if (this.busy) this.skip(res[0].transcript); else this.ingest(res[0].transcript, true); }
        else interim += res[0].transcript;
      }
      if (!interim.trim()) return;
      if (this.busy) { this.skip(interim); this.paint('กำลังอ่านชื่อ… รอให้อ่านจบก่อนค่อยพูด', 'warn'); return; }
      this.paint('กำลังฟัง… ' + interim.trim(), '');
      this.ingest(interim, false);
    };
    rec.onerror = ev => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { this.stop(); toast('เบราว์เซอร์ไม่อนุญาตให้ใช้ไมโครโฟน — กดไอคอนหน้าช่องที่อยู่เว็บแล้วเลือกอนุญาตไมโครโฟน'); }
      else if (ev.error === 'network') this.paint('ต่ออินเทอร์เน็ตไม่ได้ — การถอดเสียงต้องใช้เน็ต', 'bad');
    };
    rec.onstart = () => { this.listening = true; this.alive = Date.now(); this.paint(); };
    rec.onend = () => { this.listening = false; if (!this.on) return; this.seg = null; this.relisten(60); };
    this.rec = rec; this.on = true;
    this.seg = null; this.painted = null; this.recent = [];
    this.alive = Date.now(); this.listening = false;
    this.relisten(0);
    clearInterval(this.watch);
    this.watch = setInterval(() => {                 // รอบการฟังตายเงียบ ๆ → ตัดแล้วต่อใหม่
      if (!this.on || Date.now() - (this.alive || 0) < 15000) return;
      this.alive = Date.now();
      try { this.rec.abort(); } catch (e) {}
      this.relisten(200);
      this.paint('ไมค์เงียบผิดปกติ — ต่อใหม่ให้แล้ว พูดต่อได้เลย', 'warn');
    }, 5000);
    document.body.classList.add('voice-on');
    this.hud(); this.lockKeyboard(true);
    this.focusCell(this.cell() || this.firstCell());
    this.paint('พูดคะแนนได้เลย', '');
    this.syncButton();
  },
  stop() {
    this.on = false; this.listening = false;
    clearInterval(this.watch); clearTimeout(this.restart); clearTimeout(this.settleTimer); clearTimeout(this.hushTimer);
    this.seg = null; this.painted = null; this.recent = [];
    if (this.rec) { try { this.rec.stop(); } catch (e) {} this.rec = null; }
    if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
    this.busy = false; save();
    document.body.classList.remove('voice-on');
    const el = document.querySelector('#voiceHud'); if (el) el.remove();
    const g = this.grid(); if (g) $$('input.cell.voice-here', g).forEach(c => c.classList.remove('voice-here'));
    this.lockKeyboard(false); this.syncButton();
  },
  /* ตารางถูกวาดใหม่ (เปลี่ยนห้อง/สถานะซ่อมเปลี่ยน) → พากลับไปยืนที่ช่องเดิม */
  rebind() {
    if (!this.on) return;
    if (!this.grid()) { this.stop(); return; }
    this.hud(); this.lockKeyboard(true);
    this.seg = null; this.painted = null;
    const p = this.pos || { r: 0, c: 0 };
    this.focusCell(this.at(p.r, p.c) || this.firstCell());
    this.syncButton();
  }
};
window.ScoreVoice = ScoreVoice;

/* ตารางถูกวาดใหม่ทุกครั้งที่เรนเดอร์: ถ้ายังเปิดเสียงอยู่ให้ผูกกลับ ถ้าออกจากหน้าแล้วให้ปิดไมค์ */
const baseRender = window.render;
window.render = function () {
  baseRender.apply(this, arguments);
  if (ScoreVoice.on) setTimeout(() => ScoreVoice.rebind(), 0);
  else ScoreVoice.syncButton();
};
/* แตะช่องเองระหว่างใช้เสียง → ทำเครื่องหมายช่องนั้นเป็นจุดเริ่มต่อ */
document.addEventListener('focusin', e => { if (ScoreVoice.on && e.target.classList && e.target.classList.contains('cell') && e.target.closest('#scGrid')) ScoreVoice.mark(e.target); });
})();
