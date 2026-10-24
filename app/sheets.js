/* EMS — ส่งออกไป Google Sheets ของ "เจ้าของอีเมลที่ล็อกอิน"
   ไฟล์ชีตถูกสร้างในไดรฟ์ของบัญชีนั้นเอง (ไม่ใช่โฟลเดอร์กลาง) ครั้งแรกสร้างไฟล์ใหม่ ครั้งต่อไปเขียนทับแท็บเดิม
   ขอสิทธิ์เฉพาะไฟล์ที่แอปสร้างเอง (drive.file) — ไม่เห็นไฟล์อื่นในไดรฟ์ของครู
   ต้องตั้งค่า EMS_CONFIG.drive.googleClientId (OAuth Web client + เปิด Google Sheets API ในโปรเจกต์ Google Cloud)
   ถ้ายังไม่ตั้งค่า จะดาวน์โหลดเป็นไฟล์ .xlsx ให้แทน */
(() => {
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const cfg = () => (window.EMS_CONFIG || {}).drive || {};
const ownerEmail = () => ((S.staff || []).find(u => u.name === S.me.name) || {}).email || S.me.email || '';
let cache = { token: '', exp: 0 };

const loadGis = () => new Promise((ok, no) => {
  if (window.google && google.accounts && google.accounts.oauth2) return ok();
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = ok; s.onerror = () => no(new Error('โหลดบริการ Google ไม่สำเร็จ (ตรวจอินเทอร์เน็ต)'));
  document.head.appendChild(s);
});
async function token() {
  if (cache.token && Date.now() < cache.exp) return cache.token;
  const clientId = cfg().googleClientId;
  if (!clientId) { const e = new Error('ยังไม่ได้ตั้งค่า Google OAuth Client ID ใน config.js'); e.code = 'noClient'; throw e; }
  await loadGis();
  return new Promise((res, rej) => {
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: cfg().scope || 'https://www.googleapis.com/auth/drive.file', hint: ownerEmail() || undefined,
      callback: r => { if (r && r.access_token) { cache = { token: r.access_token, exp: Date.now() + ((r.expires_in || 3300) - 60) * 1000 }; res(r.access_token); } else rej(new Error((r && r.error_description) || 'Google ไม่อนุญาตการเข้าถึง')); },
      error_callback: e => rej(new Error((e && e.message) || 'เปิดหน้าลงชื่อเข้าใช้ Google ไม่สำเร็จ'))
    });
    tc.requestAccessToken({ prompt: cache.token ? '' : 'select_account' });
  });
}
async function api(url, method, body) {
  const t = await token();
  const r = await fetch(url, { method: method || 'GET', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) cache = { token: '', exp: 0 };
  if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch (e) {} const err = new Error(m || 'Google API ' + r.status); err.status = r.status; throw err; }
  return r.json();
}
const tabTitle = t => String(t).replace(/[\[\]*?:\\\/]/g, '-').slice(0, 90) || 'Sheet1';

/** เขียนหลายแท็บลงชีตของผู้ใช้ คืน URL ของชีต */
async function writeTabs(tabs) {
  const email = ownerEmail() || 'me';
  S.userSheets = S.userSheets || {};
  let id = S.userSheets[email], meta = null;
  const titles = tabs.map(t => tabTitle(t.title));
  if (id) {
    try { meta = await api(SHEETS + '/' + id + '?fields=sheets.properties.title'); }
    catch (e) { if (e.status === 404 || e.status === 403) id = ''; else throw e; }   // ครูลบไฟล์ทิ้ง → สร้างใหม่
  }
  if (!id) {
    const made = await api(SHEETS, 'POST', { properties: { title: 'EMS ผลการเรียน • ' + (S.me.name || email), locale: 'th_TH' }, sheets: [{ properties: { title: titles[0] } }] });
    id = made.spreadsheetId; S.userSheets[email] = id; save();
    meta = { sheets: [{ properties: { title: titles[0] } }] };
  }
  const have = new Set((meta.sheets || []).map(x => x.properties.title));
  const add = titles.filter((t, i) => !have.has(t) && titles.indexOf(t) === i).map(t => ({ addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1 } } } }));
  if (add.length) await api(SHEETS + '/' + id + ':batchUpdate', 'POST', { requests: add });
  await api(SHEETS + '/' + id + '/values:batchClear', 'POST', { ranges: titles.map(t => "'" + t + "'") });
  await api(SHEETS + '/' + id + '/values:batchUpdate', 'POST', { valueInputOption: 'RAW', data: tabs.map((t, i) => ({ range: "'" + titles[i] + "'!A1", values: t.rows.map(r => r.map(v => v === null || v === undefined ? '' : v)) })) });
  return 'https://docs.google.com/spreadsheets/d/' + id;
}

/** ส่งออก: ถ้าตั้งค่า Google ไว้ → เข้าชีตของเจ้าของอีเมล ไม่งั้นเรียก fallback (ดาวน์โหลดไฟล์) */
async function send({ tabs, fallback, fallbackName }) {
  if (!cfg().googleClientId) {
    toast('ยังไม่ได้ตั้งค่า Google (Client ID) — ดาวน์โหลดเป็นไฟล์ ' + (fallbackName || 'Excel') + ' แทน');      // fallbackName = ชนิดไฟล์ที่ fallback ให้จริง (ไม่ระบุ = Excel)
    return fallback && fallback();
  }
  toast('กำลังส่งเข้าชีตของ ' + (ownerEmail() || 'คุณ') + '…');
  try {
    const url = await writeTabs(tabs);
    modal(`<h2 style="margin-bottom:8px">ส่งเข้าชีตแล้ว</h2><p style="margin-bottom:12px">ไฟล์อยู่ในไดรฟ์ของ <b>${esc(ownerEmail() || 'บัญชีที่ล็อกอิน')}</b> · ครั้งต่อไปจะเขียนทับแท็บเดิม</p>
      <a class="btn pri" style="width:100%" target="_blank" rel="noopener" href="${esc(url)}">เปิดชีต</a>`, true);
  } catch (e) {
    toast('ส่งเข้าชีตไม่สำเร็จ: ' + (e.message || e));
    if (fallback) fallback();
  }
}
window.EMSSheets = { send, writeTabs, ownerEmail };
})();
