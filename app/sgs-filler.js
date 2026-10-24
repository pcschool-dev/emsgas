/* EMS — ตัวกรองคะแนนบนหน้า SGS (บุ๊กมาร์กเล็ต)
   คัดลอกจาก KruSpace (app/index.html: sgsFillerMain) ทั้งก้อน ไม่แก้ตรรกะ
   ฟังก์ชันนี้ถูกแปลงเป็นลิงก์ javascript: แล้วไปทำงานบนหน้า "บันทึกผลการเรียน ตลอดภาคเรียน" ของ SGS ที่ครูล็อกอินไว้เอง
   จึงต้องพึ่งตัวเองทั้งหมด ห้ามอ้างถึงตัวแปรอื่นของแอป
   กติกาความปลอดภัย: ไม่ล็อกอิน ไม่ส่งข้อมูลออกนอกหน้า ไม่แตะรหัสผ่าน · อ่านโครงตารางไม่ออกให้หยุด ·
   แสดงตารางเปรียบเทียบค่าเดิม/ค่าใหม่ก่อนกรอกเสมอ · จับคู่ด้วยเลขประจำตัวเท่านั้น · แตะเฉพาะช่องคะแนน 4 ส่วนกับช่องประเมิน */
function sgsFillerMain() {
  var BOX_ID = 'kruspace-sgs-filler';
  var old = document.getElementById(BOX_ID);
  if (old) old.remove();

  var txt = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var SECTIONS = [
    { key: 'before', label: 'ก่อนกลางภาค', slots: ['1', '2', '3'] },
    { key: 'mid', label: 'กลางภาค', slots: ['กลางภาค'] },
    { key: 'after', label: 'หลังกลางภาค', slots: ['10', '11', '12'] },
    { key: 'final', label: 'ปลายภาค', slots: ['ปลายภาค'] }
  ];

  /* หน้าคะแนนของ SGS เรียกคอลัมน์นี้ว่า 'เลขประจำตัว' แต่หน้าการอ่าน คิดวิเคราะห์ฯ
     เรียกว่า 'รหัสนักเรียน' ถ้าจับแค่คำเดียวจะหาตารางของอีกหน้าไม่เจอเลย */
  var SID_HEAD = /เลขประจำตัว|รหัสนักเรียน/;

  /* ---- สองหน้าประเมินของ SGS ----------------------------------------------
     ทั้งสองหน้าเป็นตารางให้คะแนนรายข้อ 0–3 แล้วมีช่อง 'รวม' กับ 'ผลการประเมิน' ต่อท้าย
     EMS เก็บค่ารายข้อไว้ในชุดเดียวกัน ลำดับข้อตรงกับหลักสูตรแกนกลาง คือ
     ข้อที่ i ของ EMS = คอลัมน์เลข i ของ SGS จึงจับคู่ด้วยเลขคอลัมน์ตรง ๆ
     ไม่จับคู่ด้วยลำดับที่เจอ เพราะบางโรงเรียนเปิดใช้ข้อ 9–10 เพิ่มด้วย */
  var ASSESS_KINDS = [
    { type: 'reading', title: 'การอ่าน คิดวิเคราะห์ และเขียน', count: 5,
      valKey: 'reading', lvKey: 'readingLevel' },
    { type: 'traits', title: 'คุณลักษณะอันพึงประสงค์', count: 8,
      valKey: 'traits', lvKey: 'traitsLevel' }
  ];

  /** หน้านี้เป็นหน้าอะไร — ดูจาก *โครงตาราง* ไม่ใช่ข้อความบนหน้า เพราะเมนูซ้ายของ SGS
      มีคำว่า 'คุณลักษณะอันพึงประสงค์' กับ 'การอ่าน คิดวิเคราะห์ฯ' อยู่ทุกหน้า
      ดูจากคำจึงทายผิดเป็นหน้าประเมินได้แม้กำลังเปิดหน้าคะแนนอยู่
      มีคอลัมน์กลางภาค/ปลายภาค = หน้าคะแนน • มีคอลัมน์ผลการประเมิน = หน้าประเมิน
      แยกการอ่านฯ (5 ข้อ) กับคุณลักษณะฯ (10 ข้อ) ด้วยจำนวนคอลัมน์เลขข้อที่หน้านั้นมี
      คืน null = ให้ไปทางหน้าคะแนนแบบเดิม ซึ่งเป็นทางที่ใช้ได้อยู่แล้ว */
  function detectKind() {
    var probe = readAssess(null);
    if (probe.error || probe.hasExam || probe.levelCol < 0) return null;
    var nums = Object.keys(probe.itemCol).map(Number);
    if (!nums.length) return null;
    return Math.max.apply(null, nums) <= 5 ? ASSESS_KINDS[0] : ASSESS_KINDS[1];
  }

  /* ---- อ่านตารางหน้าประเมิน ------------------------------------------------
     ใช้วิธีเดียวกับตารางคะแนน แต่คอลัมน์ที่สนใจคือหัวคอลัมน์ที่เป็นตัวเลขล้วน ('1'..'10')
     กับช่อง 'ผลการประเมิน' ส่วนช่อง 'รวม' อ่านไว้โชว์อย่างเดียว ไม่เขียนทับ
     เพราะบางหน้า SGS คำนวณให้เอง การเขียนลงไปเองจึงเสี่ยงทับค่าที่ระบบคิดไว้ */
  function readAssess(kind) {
    var isHead = function (c, re) { var t = txt(c.textContent); return re.test(t) && t.length <= 24; };
    var tables = Array.prototype.slice.call(document.querySelectorAll('table')).filter(function (t) {
      return Array.prototype.some.call(t.rows, function (tr) {
        return Array.prototype.some.call(tr.cells, function (c) { return isHead(c, SID_HEAD); });
      });
    });
    tables.sort(function (a, b) { return b.rows.length - a.rows.length; });
    var table = tables[0];
    if (!table) return { error: 'ไม่พบตารางในหน้านี้ — เลือกรายวิชาและกลุ่มของ SGS ก่อน' };

    var rows = Array.prototype.slice.call(table.rows);
    var grid = expand(rows);
    var headRow = rows.findIndex(function (tr) {
      return Array.prototype.some.call(tr.cells, function (c) { return isHead(c, SID_HEAD); });
    });
    var sidCol = -1, nameCol = -1, subjCol = -1;
    (grid[headRow] || []).forEach(function (cell, c) {
      if (sidCol < 0 && isHead(cell, SID_HEAD)) sidCol = c;
      if (nameCol < 0 && isHead(cell, /ชื่อ/) && !SID_HEAD.test(cell.textContent)) nameCol = c;
      if (subjCol < 0 && isHead(cell, /^วิชา$/)) subjCol = c;
    });
    if (sidCol < 0) return { error: 'หาคอลัมน์เลขประจำตัวไม่เจอ' };

    var dataStart = -1;
    for (var r = headRow + 1; r < rows.length; r++) {
      var cell = (grid[r] || [])[sidCol];
      if (cell && /^\d{3,}$/.test(txt(cell.textContent))) { dataStart = r; break; }
    }
    if (dataStart < 0) return { error: 'ไม่พบแถวนักเรียนในตาราง — เลือกรายวิชาและกลุ่มให้ครบก่อน' };

    var width = Math.max.apply(null, grid.slice(headRow, dataStart + 1).map(function (g) { return (g || []).length; }));
    var itemCol = {}, levelCol = -1, sumCol = -1, examCount = 0;
    for (var c2 = 0; c2 < width; c2++) {
      var seen = [], parts = [];
      for (var hr = headRow; hr < dataStart; hr++) {
        var hc = (grid[hr] || [])[c2];
        if (hc && seen.indexOf(hc) < 0) { seen.push(hc); parts.push(txt(hc.innerText != null ? hc.innerText : hc.textContent)); }
      }
      /* ดูทีละชิ้น ไม่ใช่ทั้งก้อนที่ต่อกัน เพราะเลขข้ออาจมีแถบครอบอยู่ข้างบน
         เช่น 'ผลการประเมินรายข้อ' ทำให้ก้อนรวมกลายเป็น 'ผลการประเมินรายข้อ 1' */
      var itemNo = null, isLevel = false, isSum = false;
      parts.forEach(function (t2) {
        if (/^\d{1,2}$/.test(t2)) itemNo = Number(t2);
        else if (/^ผลการประเมิน$/.test(t2)) isLevel = true;
        else if (/^รวม$/.test(t2)) isSum = true;
        else if (/^(กลางภาค|ปลายภาค)$/.test(t2)) examCount++;
      });
      if (itemNo != null) { if (itemCol[itemNo] == null) itemCol[itemNo] = c2; }
      else if (isLevel && levelCol < 0) levelCol = c2;
      else if (isSum && sumCol < 0) sumCol = c2;
    }
    if (levelCol < 0 && !Object.keys(itemCol).length) return { error: 'หน้านี้ไม่มีคอลัมน์ให้กรอกผลการประเมิน — เปิดหน้า "' + (kind ? kind.title : 'ประเมิน') + '" ของ SGS ก่อน' };

    var pick = function (holder) { return holder ? holder.querySelector('input[type=text], input:not([type]), select, textarea') : null; };
    var students = [], subjects = [];
    for (var dr = dataStart; dr < rows.length; dr++) {
      var sc = (grid[dr] || [])[sidCol];
      var sid = sc ? txt(sc.textContent) : '';
      if (!/^\d{3,}$/.test(sid)) continue;
      var st = { sid: sid, name: nameCol >= 0 && grid[dr][nameCol] ? txt(grid[dr][nameCol].textContent) : '', inputs: {}, sumText: '' };
      for (var k = 1; k <= 12; k++) {
        if (itemCol[k] == null) continue;
        st.inputs[String(k)] = pick(grid[dr][itemCol[k]]);
      }
      st.inputs.level = levelCol >= 0 ? pick(grid[dr][levelCol]) : null;
      if (sumCol >= 0 && grid[dr][sumCol]) {
        var si = pick(grid[dr][sumCol]);
        st.sumText = si ? txt(si.value) : txt(grid[dr][sumCol].textContent);
      }
      if (subjCol >= 0 && grid[dr][subjCol]) { var sj = txt(grid[dr][subjCol].textContent); if (sj && subjects.indexOf(sj) < 0) subjects.push(sj); }
      students.push(st);
    }

    /* คอลัมน์ไหนกรอกได้จริงบ้าง — SGS ปิดข้อที่โรงเรียนไม่ได้เปิดใช้ไว้
       ดูจากช่องของนักเรียนจริง ไม่ดูจากช่องติ๊ก 'หัวข้อ' ด้านบน เพราะนั่นเป็นการตั้งค่า
       ของงานวัดผล ปุ่มนี้ไม่ควรไปเปลี่ยนให้ */
    var editable = function (inp) { return !!inp && !inp.disabled && !inp.readOnly; };
    var openItems = [], lockedItems = [], extraItems = [], missingItems = [];
    /* ตอนยังไม่รู้ว่าเป็นหน้าไหน (เรียกมาเพื่อตรวจชนิดหน้า) ยังแยกข้อที่ต้องใช้ไม่ได้
       จึงข้ามส่วนนี้ไปก่อน ผู้เรียกที่ส่ง kind มาเท่านั้นที่ได้รายการนี้ */
    if (kind) {
      Object.keys(itemCol).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
        var any = students.some(function (st2) { return editable(st2.inputs[String(n)]); });
        if (n > kind.count) { if (any) extraItems.push(n); return; }
        (any ? openItems : lockedItems).push(n);
      });
      for (var q = 1; q <= kind.count; q++) if (itemCol[q] == null) missingItems.push(q);
    }
    return { kind: kind, students: students, itemCol: itemCol, levelCol: levelCol, sumCol: sumCol, hasExam: examCount > 0,
      openItems: openItems, lockedItems: lockedItems, extraItems: extraItems, missingItems: missingItems,
      levelOpen: levelCol >= 0 && students.some(function (st3) { return editable(st3.inputs.level); }),
      subjectText: subjects.join(' | ') };
  }

  /* ---- อ่านตารางกรอกคะแนนของ SGS -------------------------------------------
     ตารางของ ASP.NET มักซ้อนตารางจัดหน้าไว้หลายชั้น จึงเลือกตารางที่ "แถวของตัวเอง"
     มีหัวคอลัมน์เลขประจำตัว และขยาย rowspan/colspan ให้เป็นตารางช่องจริงก่อนอ่าน
     หัวตารางจะอยู่ในแถวเดียวหรือแยกสองแถวก็อ่านได้เหมือนกัน */
  function expand(rows) {
    var grid = [];
    rows.forEach(function (tr, r) {
      grid[r] = grid[r] || [];
      var c = 0;
      Array.prototype.forEach.call(tr.cells, function (cell) {
        while (grid[r][c]) c++;
        var rs = Math.max(1, cell.rowSpan || 1), cs = Math.max(1, cell.colSpan || 1);
        for (var i = 0; i < rs; i++) {
          grid[r + i] = grid[r + i] || [];
          for (var j = 0; j < cs; j++) grid[r + i][c + j] = cell;
        }
        c += cs;
      });
    });
    return grid;
  }

  function readSgs() {
    /* หัวคอลัมน์ต้องเป็นช่องที่มีแค่คำว่าเลขประจำตัว ไม่ใช่ช่องที่บังเอิญครอบตารางทั้งก้อนไว้
       ตารางจัดหน้าชั้นนอกของ ASP.NET ก็มีคำนี้อยู่ข้างในผ่านตารางซ้อน ถ้าไม่เช็กความยาว
       จะหยิบตารางผิดตัว */
    var isHead = function (c, re) { var t = txt(c.textContent); return re.test(t) && t.length <= 24; };
    var tables = Array.prototype.slice.call(document.querySelectorAll('table')).filter(function (t) {
      return Array.prototype.some.call(t.rows, function (tr) {
        return Array.prototype.some.call(tr.cells, function (c) { return isHead(c, SID_HEAD); });
      });
    });
    tables.sort(function (a, b) { return b.rows.length - a.rows.length; });
    var table = tables[0];
    if (!table) return { error: 'ไม่พบตารางกรอกคะแนนในหน้านี้ — เปิดหน้า "บันทึกผลการเรียน ตลอดภาคเรียน" และเลือกรายวิชาก่อน' };

    var rows = Array.prototype.slice.call(table.rows);
    var grid = expand(rows);
    var headRow = rows.findIndex(function (tr) {
      return Array.prototype.some.call(tr.cells, function (c) { return isHead(c, SID_HEAD); });
    });
    var sidCol = -1, nameCol = -1;
    (grid[headRow] || []).forEach(function (cell, c) {
      if (sidCol < 0 && isHead(cell, SID_HEAD)) sidCol = c;
      if (nameCol < 0 && isHead(cell, /ชื่อ/) && !SID_HEAD.test(cell.textContent)) nameCol = c;
    });
    if (sidCol < 0) return { error: 'หาคอลัมน์เลขประจำตัวไม่เจอ' };

    var dataStart = -1;
    for (var r = headRow + 1; r < rows.length; r++) {
      var cell = (grid[r] || [])[sidCol];
      if (cell && /^\d{3,}$/.test(txt(cell.textContent))) { dataStart = r; break; }
    }
    if (dataStart < 0) return { error: 'ไม่พบแถวนักเรียนในตาราง — เลือกรายวิชาและกลุ่มให้ครบก่อน' };

    /* อ่านหัวคอลัมน์: รวมข้อความทุกแถวหัวตารางในคอลัมน์เดียวกัน เช่น "1" กับ "30"
       กลายเป็น "1 30" แล้วแยกเป็นชื่อช่องกับคะแนนเต็ม */
    var width = Math.max.apply(null, grid.slice(headRow, dataStart + 1).map(function (g) { return (g || []).length; }));
    var cols = [];
    for (var c = 0; c < width; c++) {
      var seen = [], parts = [];
      for (var hr = headRow; hr < dataStart; hr++) {
        var hc = (grid[hr] || [])[c];
        /* ต้องใช้ innerText ไม่ใช่ textContent เพราะหัวคอลัมน์ของ SGS เขียนชื่อช่องกับคะแนนเต็ม
           คนละบรรทัดด้วย <br> ซึ่ง textContent จะเอามาต่อกันเป็น "130" แทนที่จะเป็น "1 30"
           แล้วระบบจะหาช่องคะแนนไม่เจอเลย */
        if (hc && seen.indexOf(hc) < 0) { seen.push(hc); parts.push(txt(hc.innerText != null ? hc.innerText : hc.textContent)); }
      }
      var head = txt(parts.join(' '));
      var m = head.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      cols.push({ index: c, head: head, label: m ? txt(m[1]) : head, max: m ? parseFloat(m[2]) : null });
    }

    var map = {}, problems = [];
    SECTIONS.forEach(function (sec) {
      var hits = cols.filter(function (col) { return sec.slots.indexOf(col.label) >= 0 && col.max != null; });
      var used = hits.filter(function (col) { return col.max > 0; });
      if (!hits.length) { problems.push('ไม่พบช่อง' + sec.label + 'ในหน้านี้'); return; }
      if (used.length > 1) {
        problems.push(sec.label + ' ใน SGS แบ่งไว้ ' + used.length + ' ช่อง (' + used.map(function (x) { return x.label; }).join(', ') +
          ') แต่ EMS มีคะแนนรวมส่วนนี้ช่องเดียว จึงข้ามส่วนนี้');
        return;
      }
      if (!used.length) { problems.push(sec.label + ' ใน SGS ตั้งคะแนนเต็มไว้ 0 จึงข้ามส่วนนี้'); return; }
      map[sec.key] = used[0];
    });

    var students = [];
    for (var dr = dataStart; dr < rows.length; dr++) {
      var sc = (grid[dr] || [])[sidCol];
      var sid = sc ? txt(sc.textContent) : '';
      if (!/^\d{3,}$/.test(sid)) continue;
      var st = { sid: sid, name: nameCol >= 0 && grid[dr][nameCol] ? txt(grid[dr][nameCol].textContent) : '', inputs: {} };
      Object.keys(map).forEach(function (k) {
        var holder = grid[dr][map[k].index];
        st.inputs[k] = holder ? holder.querySelector('input[type=text], input:not([type])') : null;
      });
      students.push(st);
    }

    /* SGS เปิดให้กรอกทีละรอบ (ก่อนกลาง+กลางภาค หรือ หลังกลาง+ปลายภาค) และต้องติ๊ก ☐
       ที่หัวคอลัมน์ก่อน ช่องในคอลัมน์นั้นถึงจะกรอกได้ ถ้าไม่เช็กตรงนี้ โค้ดจะเขียนค่าลงช่อง
       ที่ถูกล็อกได้ เพราะการตั้งค่าด้วยสคริปต์ไม่ถูกกันเหมือนการพิมพ์ของคน ซึ่งเท่ากับ
       ข้ามการเปิดปิดรอบของ SGS ไป จึงต้องรู้สถานะของแต่ละคอลัมน์ก่อนทุกครั้ง
       open    = มีช่องที่กรอกได้อยู่แล้ว
       tick    = ยังล็อก แต่ช่องติ๊กที่หัวคอลัมน์กดได้ (ครูหรือปุ่มนี้ติ๊กเปิดได้)
       closed  = ช่องติ๊กกดไม่ได้ แปลว่า SGS ยังไม่เปิดรอบนี้
       stuck   = ติ๊กไว้แล้วแต่ช่องยังล็อก ไม่รู้สาเหตุ จึงไม่แตะ */
    var editable = function (inp) { return !!inp && !inp.disabled && !inp.readOnly; };
    Object.keys(map).forEach(function (k) {
      var col = map[k], tickBox = null;
      for (var hr2 = headRow; hr2 < dataStart && !tickBox; hr2++) {
        var hcell = (grid[hr2] || [])[col.index];
        if (hcell) tickBox = hcell.querySelector('input[type=checkbox]');
      }
      col.checkbox = tickBox;
      col.open = students.some(function (st) { return editable(st.inputs[k]); });
      col.gate = col.open ? 'open' : !tickBox ? 'stuck' : tickBox.disabled ? 'closed' : tickBox.checked ? 'stuck' : 'tick';
    });
    var subjectText = Array.prototype.slice.call(document.querySelectorAll('select')).map(function (s) {
      return s.selectedIndex >= 0 ? txt(s.options[s.selectedIndex].text) : '';
    }).join(' | ');
    return { map: map, problems: problems, students: students, subjectText: subjectText };
  }

  /* ---- ตัวเลข ------------------------------------------------------------ */
  function roundBy(v, mode) {
    if (v == null || !isFinite(v)) return null;
    if (mode === 'int') return Math.round(v + 1e-9);
    if (mode === 'one') return Math.round(v * 10 + 1e-9) / 10;
    return Math.round(v * 2 + 1e-9) / 2;
  }
  function readNum(inp) {
    if (!inp) return null;
    var s = String(inp.value || '').trim();
    if (!s) return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  /* ---- หน้าต่าง ----------------------------------------------------------- */
  var box = document.createElement('div');
  box.id = BOX_ID;
  box.setAttribute('style', 'all:initial;position:fixed;z-index:2147483000;top:12px;right:12px;bottom:12px;' +
    'width:min(760px,calc(100vw - 24px));background:#fff;color:#16202e;border:2px solid #1f6feb;border-radius:14px;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.25);font:14px/1.5 Tahoma,Sarabun,sans-serif;display:flex;flex-direction:column;overflow:hidden');
  document.body.appendChild(box);

  var CSS = '<style>' +
    '#' + BOX_ID + ' *{box-sizing:border-box;font-family:inherit}' +
    '#' + BOX_ID + ' .h{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#1f6feb;color:#fff;font-weight:700}' +
    '#' + BOX_ID + ' .b{padding:12px 14px;overflow:auto;flex:1}' +
    '#' + BOX_ID + ' .f{padding:10px 14px;border-top:1px solid #dde3ec;display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
    '#' + BOX_ID + ' button{font:inherit;padding:7px 14px;border-radius:8px;border:1px solid #c9d3e0;background:#f4f6fa;color:#16202e;cursor:pointer}' +
    '#' + BOX_ID + ' button.p{background:#1f6feb;border-color:#1f6feb;color:#fff;font-weight:700}' +
    '#' + BOX_ID + ' button:disabled{opacity:.45;cursor:not-allowed}' +
    '#' + BOX_ID + ' textarea{width:100%;height:120px;font:12px monospace;border:1px solid #c9d3e0;border-radius:8px;padding:8px}' +
    '#' + BOX_ID + ' .n{padding:8px 11px;border-radius:8px;margin:0 0 10px;background:#fff5e2;color:#7a4700}' +
    '#' + BOX_ID + ' .n.bad{background:#fdecec;color:#a61b1b}' +
    '#' + BOX_ID + ' .n.ok{background:#e6f6ee;color:#0b6b41}' +
    '#' + BOX_ID + ' table{border-collapse:collapse;width:100%;font-size:13px}' +
    '#' + BOX_ID + ' th,#' + BOX_ID + ' td{border:1px solid #e3e8ef;padding:4px 6px;text-align:center;white-space:nowrap}' +
    '#' + BOX_ID + ' th{background:#f4f6fa;position:sticky;top:0}' +
    '#' + BOX_ID + ' td.nm{text-align:left;max-width:170px;overflow:hidden;text-overflow:ellipsis}' +
    '#' + BOX_ID + ' td.chg{background:#e6f6ee;font-weight:700}' +
    '#' + BOX_ID + ' td.ovr{background:#fff0d6;font-weight:700}' +
    '#' + BOX_ID + ' td.bad{background:#fdecec;color:#a61b1b;font-weight:700}' +
    '#' + BOX_ID + ' .opt{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:0 0 10px}' +
    '#' + BOX_ID + ' label{display:inline-flex;gap:5px;align-items:center;cursor:pointer}' +
    '#' + BOX_ID + ' select{font:inherit;padding:3px 6px}' +
    '#' + BOX_ID + ' .x{margin-left:auto;background:transparent;border:none;color:#fff;font-size:20px;padding:0 6px}' +
    '</style>';

  var state = { payload: null, sgs: null, assess: null, kind: detectKind(), fillLevel: false,
    mode: 'half', keep: false, scale: {}, subjectOk: false, busy: false };

  function shell(body, foot) {
    box.innerHTML = CSS + '<div class="h">📥 EMS → SGS' + (state.kind ? ' • ' + esc(state.kind.title) : ' • คะแนนรายภาค') +
      '<button class="x" data-close title="ปิด">×</button></div>' +
      '<div class="b">' + body + '</div><div class="f">' + (foot || '') + '</div>';
    box.querySelector('[data-close]').onclick = function () { if (!state.busy) box.remove(); };
  }

  function stepPaste(msg) {
    shell(
      (msg ? '<div class="n bad">' + esc(msg) + '</div>' : '') +
      '<div class="n">หน้านี้ของ SGS <b>บันทึกทันทีที่ช่องเปลี่ยน</b> ระบบจะให้ตรวจตารางเปรียบเทียบก่อนทุกครั้ง ยังไม่มีอะไรถูกกรอกจนกว่าจะกดยืนยัน</div>' +
      '<ol style="margin:0 0 10px 18px;padding:0">' +
        '<li>เลือก<b>รายวิชา</b>และ<b>กลุ่ม</b>ของ SGS ให้ตรงกับที่คัดลอกมา</li>' +
        '<li>ตั้งช่อง <b>/หน้า</b> ของ SGS เท่ากับจำนวนนักเรียนในห้อง (ไม่เกิน 40) ให้เห็นครบทุกคน ระบบกรอกได้เฉพาะแถวที่อยู่บนหน้าจอ</li>' +
        (state.kind
          ? '<li>ติ๊ก <b>หัวข้อ</b> ด้านบนให้ครบข้อ 1–' + state.kind.count + ' (ปุ่มนี้ไม่ติ๊กให้ เพราะเป็นการตั้งค่าของงานวัดผล)</li>'
          : '<li>ติ๊ก ☐ ที่หัวคอลัมน์ที่จะกรอกให้เรียบร้อย หรือให้ปุ่มนี้ติ๊กให้ในขั้นถัดไปก็ได้</li>') +
        '<li>ใน EMS กดปุ่ม "คัดลอกคะแนน" แล้วกลับมาวางในช่องนี้ (Ctrl+V)</li>' +
      '</ol>' +
      '<textarea data-paste placeholder="วางข้อความที่คัดลอกจาก EMS ที่นี่"></textarea>',
      '<button class="p" data-next>ตรวจสอบ</button><span style="color:#67748a">ยังไม่กรอกอะไรลง SGS</span>');
    var ta = box.querySelector('[data-paste]');
    ta.focus();
    box.querySelector('[data-next]').onclick = function () {
      var raw = String(ta.value || '').trim();
      var m = raw.match(/KRUSPACE-SGS:(?:v\d+:)?([\s\S]+)$/);
      if (m) {
        try { state.payload = JSON.parse(m[1]); } catch (e) { return stepPaste('อ่านข้อมูลไม่ได้ อาจคัดลอกมาไม่ครบ — ลองคัดลอกใหม่'); }
      } else if (raw.charAt(0) === '{' && raw.indexOf('"students"') >= 0) {
        try { state.payload = JSON.parse(raw); } catch (e) { return stepPaste('อ่านข้อมูล JSON ไม่ได้ — ลองคัดลอกใหม่'); }
      } else if (raw.indexOf('\t') >= 0 || raw.indexOf('\n') >= 0) {
        var lines = raw.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        if (lines.length >= 2) {
          var header = lines[0].split('\t').map(function (h) { return h.trim(); });
          var sidIdx = -1, nameIdx = -1, noIdx = -1, bIdx = -1, mIdx = -1, aIdx = -1, fIdx = -1, tIdx = -1;
          header.forEach(function (h, idx) {
            if (/^(เลขประจำตัว|รหัสนักเรียน|sid|id)$/i.test(h)) sidIdx = idx;
            else if (/^(ชื่อ-นามสกุล|ชื่อ|name)$/i.test(h)) nameIdx = idx;
            else if (/^(เลขที่|no)$/i.test(h)) noIdx = idx;
            else if (/^(ก่อนกลาง|ก่อนกลางภาค|before)$/i.test(h)) bIdx = idx;
            else if (/^(กลางภาค|กลาง|mid)$/i.test(h)) mIdx = idx;
            else if (/^(หลังกลาง|หลังกลางภาค|after)$/i.test(h)) aIdx = idx;
            else if (/^(ปลายภาค|ปลาย|final)$/i.test(h)) fIdx = idx;
            else if (/^(รวม|total)$/i.test(h)) tIdx = idx;
          });
          if (sidIdx >= 0) {
            var students = [];
            for (var i = 1; i < lines.length; i++) {
              var cols = lines[i].split('\t');
              var sid = (cols[sidIdx] || '').trim();
              if (!/^\d{3,}$/.test(sid)) continue;
              var cellNum = function (cIdx) {
                if (cIdx < 0 || cols[cIdx] == null) return null;
                var val = String(cols[cIdx]).trim();
                return val === '' || isNaN(Number(val)) ? null : Number(val);
              };
              students.push({
                sid: sid,
                no: noIdx >= 0 ? Number(cols[noIdx]) || i : i,
                name: nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '',
                before: cellNum(bIdx),
                mid: cellNum(mIdx),
                after: cellNum(aIdx),
                final: cellNum(fIdx),
                total: cellNum(tIdx)
              });
            }
            if (students.length > 0) {
              state.payload = { v: 1, app: 'EMS', weights: {}, students: students };
            }
          }
        }
      }
      if (!state.payload) return stepPaste('ข้อความนี้ไม่ใช่คะแนนที่คัดลอกจาก EMS — กดปุ่ม "คัดลอกคะแนน" ใน EMS ใหม่อีกครั้ง');
      if (state.payload && state.payload.roundMode) state.mode = state.payload.roundMode;
      /* ตรวจชนิดหน้าอีกครั้งตรงนี้ ตอนเปิดกล่องครูอาจยังไม่ได้เลือกรายวิชา
         ตารางจึงยังว่างจนดูไม่ออกว่าเป็นหน้าไหน */
      state.kind = detectKind();
      /* หน้าประเมินกับหน้าคะแนนใช้ข้อมูลชุดเดียวกันที่คัดลอกมา แยกกันแค่ตอนอ่านตารางกับตอนวาด */
      if (state.kind) {
        state.assess = readAssess(state.kind);
        if (state.assess.error) return stepPaste(state.assess.error);
        return stepAssessPreview();
      }
      state.sgs = readSgs();
      if (state.sgs.error) return stepPaste(state.sgs.error);
      stepPreview();
    };
  }

  /* คำนวณสิ่งที่จะเกิดขึ้นทั้งหมดจากตัวเลือกปัจจุบัน ใช้ทั้งตอนแสดงตารางและตอนกรอกจริง
     ให้สองอย่างนี้มาจากที่เดียวกัน จะได้ไม่มีทางกรอกต่างจากที่ครูเห็นในตาราง */
  function plan() {
    var p = state.payload, g = state.sgs, W = p.weights || {};
    var bySid = {};
    (p.students || []).forEach(function (s) { bySid[String(s.sid)] = s; });
    var cols = {}, blocked = [];
    SECTIONS.forEach(function (sec) {
      var col = g.map[sec.key];
      if (!col) return;
      var w = Number(W[sec.key]) || 0;
      if (!w && (!W.before && !W.mid && !W.after && !W.final)) w = col.max;
      var same = Math.abs(w - col.max) < 1e-6;
      var hasData = (p.students || []).some(function (s) { return s[sec.key] != null; });
      cols[sec.key] = { sgsMax: col.max, weight: w, same: same, gate: col.gate, hasData: hasData,
        usable: col.gate === 'open' && w > 0 && (same || !!state.scale[sec.key]) };
      if (w > 0 && !same && !state.scale[sec.key]) blocked.push(sec.key);
    });
    var rows = [], changes = [], overwrite = 0, matched = 0;
    g.students.forEach(function (st) {
      var src = bySid[st.sid];
      var row = { sid: st.sid, name: st.name, found: !!src, cells: {}, sgsTotal: 0, kTotal: src ? src.total : null };
      if (src) matched++;
      SECTIONS.forEach(function (sec) {
        var inp = st.inputs[sec.key], oldV = readNum(inp), cell = { old: oldV, next: oldV, state: '' };
        var cfg = cols[sec.key];
        if (src && cfg && cfg.usable && inp && src[sec.key] != null) {
          var v = cfg.same ? src[sec.key] : src[sec.key] * cfg.sgsMax / cfg.weight;
          var nv = roundBy(v, state.mode);
          if (nv > cfg.sgsMax + 1e-9) cell.state = 'bad';
          else if (oldV != null && Math.abs(oldV - nv) < 1e-6) cell.state = 'same';
          else if (oldV != null && state.keep) cell.state = 'kept';
          else {
            cell.next = nv;
            cell.state = oldV == null ? 'chg' : 'ovr';
            if (oldV != null) overwrite++;
            var txt = (state.mode === 'int' || nv % 1 === 0) ? String(nv) : nv.toFixed(1);
            changes.push({ sid: st.sid, key: sec.key, text: txt, value: nv });
          }
        }
        if (cell.next != null) row.sgsTotal += cell.next;
        row.cells[sec.key] = cell;
      });
      rows.push(row);
    });
    var pageSids = {};
    g.students.forEach(function (st) { pageSids[st.sid] = 1; });
    var missing = (p.students || []).filter(function (s) { return !pageSids[String(s.sid)]; });
    return { cols: cols, blocked: blocked, rows: rows, changes: changes, overwrite: overwrite, matched: matched, missing: missing };
  }

  /* ---- ตรวจและกรอกหน้าประเมิน ---------------------------------------------
     ค่าที่กรอกคือ 0–3 รายข้อ ไม่ต้องปัดเศษและไม่ต้องแปลงสัดส่วน จึงไม่ใช้ตัวเลือกเดียวกับ
     หน้าคะแนน ส่วนช่อง 'รวม' ไม่แตะเลย และช่อง 'ผลการประเมิน' ต้องติ๊กเปิดเองก่อน
     เพราะยังไม่ยืนยันว่า SGS คำนวณช่องนี้ให้เองหรือไม่ — เดาแล้วผิดคือเขียนผิดลงทะเบียนจริง */
  function assessPlan() {
    var p = state.payload, a = state.assess, kind = state.kind;
    var bySid = {};
    (p.students || []).forEach(function (s) { bySid[String(s.sid)] = s; });
    /* อ่านค่าเดิมเป็นข้อความดิบ ไม่แปลงเป็นตัวเลขก่อน เพราะช่องผลการประเมินของ SGS
       บางแบบเก็บเป็นคำ ถ้าแปลงแล้วได้ null ตารางเปรียบเทียบจะบอกว่าช่องว่าง
       ครูจะกดยืนยันโดยไม่รู้ว่ากำลังเขียนทับของเดิม */
    var rawVal = function (inp) { return inp ? String(inp.value == null ? '' : inp.value).trim() : ''; };
    var rows = [], changes = [], overwrite = 0, matched = 0;
    a.students.forEach(function (st) {
      var src = bySid[st.sid];
      var row = { sid: st.sid, name: st.name, found: !!src, cells: {}, sumText: st.sumText };
      if (src) matched++;
      var vals = src ? (src[kind.valKey] || []) : [];
      for (var i = 1; i <= kind.count; i++) {
        var key = String(i), inp = st.inputs[key], oldT = rawVal(inp);
        var cell = { old: oldT, next: oldT, state: '' };
        var v = vals[i - 1];
        var usable = !!inp && !inp.disabled && !inp.readOnly;
        if (src && usable && (v === 0 || v === 1 || v === 2 || v === 3)) {
          if (oldT !== '' && Number(oldT) === v) cell.state = 'same';
          else if (oldT !== '' && state.keep) cell.state = 'kept';
          else {
            cell.next = String(v); cell.state = oldT === '' ? 'chg' : 'ovr';
            if (oldT !== '') overwrite++;
            changes.push({ sid: st.sid, key: key, text: String(v), value: v });
          }
        }
        row.cells[key] = cell;
      }
      var lvInp = st.inputs.level, lvOldT = rawVal(lvInp);
      var lvCell = { old: lvOldT, next: lvOldT, state: '' };
      var lvNew = src ? src[kind.lvKey] : null;
      if (state.fillLevel && src && lvInp && !lvInp.disabled && !lvInp.readOnly &&
          (lvNew === 0 || lvNew === 1 || lvNew === 2 || lvNew === 3)) {
        if (lvOldT !== '' && lvOldT === String(lvNew)) lvCell.state = 'same';
        else if (lvOldT !== '' && state.keep) lvCell.state = 'kept';
        else {
          lvCell.next = String(lvNew); lvCell.state = lvOldT === '' ? 'chg' : 'ovr';
          if (lvOldT !== '') overwrite++;
          changes.push({ sid: st.sid, key: 'level', text: String(lvNew), value: lvNew });
        }
      }
      row.cells.level = lvCell;
      row.kLevel = lvNew;
      rows.push(row);
    });
    var pageSids = {};
    a.students.forEach(function (st) { pageSids[st.sid] = 1; });
    var missing = (p.students || []).filter(function (s) { return !pageSids[String(s.sid)]; });
    return { rows: rows, changes: changes, overwrite: overwrite, matched: matched, missing: missing };
  }

  function stepAssessPreview() {
    var p = state.payload, a = state.assess, kind = state.kind, pl = assessPlan();
    var subjectFound = !p.subject || !a.subjectText || a.subjectText.indexOf(p.subject) >= 0;
    var ratio = a.students.length ? pl.matched / a.students.length : 0;
    var stop = ratio < 0.5;
    var needSubject = !subjectFound && !state.subjectOk;

    var notes = '<div class="n">ข้อมูลจาก EMS: <b>' + esc((p.subject ? p.subject + ' ' : '') + (p.subjectName || '')) + '</b> • ' +
      esc(p.cls || '') + ' • ' + esc(p.period || '') + ' • ' + (p.students || []).length + ' คน</div>';
    if (stop) notes += '<div class="n bad"><b>หยุดไว้ก่อน</b> นักเรียนบนหน้านี้ตรงกับข้อมูลที่คัดลอกมาเพียง ' + pl.matched + ' จาก ' +
      a.students.length + ' คน น่าจะเลือกรายวิชาหรือกลุ่มใน SGS ไม่ตรงกับที่คัดลอกมา</div>';
    if (!subjectFound) notes += '<div class="n bad">รายวิชาในตารางของ SGS ไม่มีรหัส <b>' + esc(p.subject) + '</b> ' +
      '<label><input type="checkbox" data-subject-ok' + (state.subjectOk ? ' checked' : '') + '> ตรวจแล้ว เป็นวิชาเดียวกันจริง</label></div>';
    if (a.missingItems.length) notes += '<div class="n bad">หน้านี้ไม่มีคอลัมน์ข้อ ' + a.missingItems.join(', ') +
      ' ซึ่ง EMS มีผลอยู่ จึงข้ามข้อนั้นไป</div>';
    if (a.lockedItems.length) notes += '<div class="n bad">ข้อ ' + a.lockedItems.join(', ') + ' ยังกรอกไม่ได้ — ไปติ๊ก <b>หัวข้อ</b> ' +
      'ด้านบนของหน้า SGS ให้ครบข้อ 1–' + kind.count + ' แล้วกด "ตรวจใหม่"</div>';
    if (a.extraItems.length) notes += '<div class="n">หน้านี้เปิดข้อ ' + a.extraItems.join(', ') + ' ไว้ด้วย แต่ EMS ประเมินเฉพาะข้อ 1–' +
      kind.count + ' ตามหลักสูตรแกนกลาง จึงไม่แตะข้อเหล่านั้น</div>';
    if (pl.missing.length) notes += '<div class="n">ไม่พบบนหน้านี้ ' + pl.missing.length + ' คน (' +
      esc(pl.missing.slice(0, 6).map(function (s) { return s.sid; }).join(', ')) + (pl.missing.length > 6 ? ' …' : '') +
      ') — ถ้าอยู่หน้าถัดไป ให้ตั้ง /หน้า ของ SGS ให้มากขึ้นแล้วเปิดใหม่</div>';
    notes += '<div class="n">ช่อง <b>รวม</b> <b>ผลการประเมิน</b> และ <b>หมายเหตุ</b> ปุ่มนี้ไม่แตะเลย — ' +
      'SGS คำนวณสองช่องแรกให้เองหลังกรอกครบทุกข้อ กรอกเสร็จให้กด F5 แล้วดูได้' +
      (a.levelCol < 0 ? ' • หน้านี้ไม่มีคอลัมน์ผลการประเมิน' : '') + '</div>';

    /* ช่องติ๊กนี้เหลือไว้เป็นทางออกสุดท้ายเท่านั้น ไม่ใช่ทางปกติ จึงซ่อนไว้ใน <details>
       ถ้าเปิดค้างไว้ให้เห็นง่าย จะมีคนติ๊กโดยไม่ได้อ่านว่าเกณฑ์สองฝั่งคิดคนละแบบ */
    var opts = '<div class="opt">' +
      '<label><input type="checkbox" data-keep' + (state.keep ? ' checked' : '') + '> ไม่แตะช่องที่ SGS มีค่าอยู่แล้ว</label></div>' +
      (a.levelOpen ? '<details' + (state.fillLevel ? ' open' : '') + ' style="margin:0 0 10px">' +
        '<summary style="cursor:pointer;color:#67748a;font-size:12px">ช่องผลการประเมินยังว่างหลังกด F5?</summary>' +
        '<div class="n bad" style="margin-top:6px"><label><input type="checkbox" data-fill-level' + (state.fillLevel ? ' checked' : '') + '> ' +
        'กรอกช่อง <b>ผลการประเมิน</b> ด้วยค่าของ EMS</label>' +
        '<div style="font-size:12px;margin-top:4px">ปกติ <b>ไม่ต้องติ๊ก</b> เพราะ SGS คำนวณช่องนี้ให้เองหลังกรอกครบทุกข้อ<br>' +
        'และเกณฑ์สองฝั่งคิดคนละแบบ — EMS นับจำนวนระดับ (ไม่ผ่านข้อเดียวก็ไม่ผ่านทั้งชุด) ' +
        'ส่วน SGS คิดจากคะแนนรวม ตัวเลขจึงต่างกันได้โดยไม่มีฝั่งไหนผิด ' +
        'ติ๊กแล้วเท่ากับเขียนทับผลที่ SGS คิดด้วยเกณฑ์ของตัวเอง</div></div></details>' : '');

    var head = '<tr><th>เลขประจำตัว</th><th>ชื่อ</th>';
    for (var h = 1; h <= kind.count; h++) head += '<th>' + h + '</th>';
    head += '<th>รวมใน SGS</th><th>ผลการประเมิน<br><small>SGS • EMS</small></th></tr>';

    var cellHtml = function (c) {
      if (!c) return '<td>—</td>';
      var show = esc(c.old == null ? '' : String(c.old)), next = esc(c.next == null ? '' : String(c.next));
      if (c.state === 'chg') return '<td class="chg">' + next + '</td>';
      if (c.state === 'ovr') return '<td class="ovr">' + show + ' → ' + next + '</td>';
      return '<td>' + (show || '—') + '</td>';
    };
    var body = pl.rows.map(function (r) {
      if (!r.found) return '<tr><td>' + esc(r.sid) + '</td><td class="nm">' + esc(r.name) + '</td><td colspan="' + (kind.count + 2) +
        '" style="color:#a61b1b">ไม่มีในข้อมูลที่คัดลอกมา — ไม่แตะแถวนี้</td></tr>';
      var tds = '';
      for (var i = 1; i <= kind.count; i++) tds += cellHtml(r.cells[String(i)]);
      /* โชว์ผลของ SGS คู่กับของ EMS เสมอ ถึงจะไม่กรอกช่องนี้ก็ตาม
         ครูจะได้เห็นเองว่าสองฝั่งตรงกันไหม โดยไม่ต้องเปิดสองหน้าเทียบ */
      var lvCell = state.fillLevel ? cellHtml(r.cells.level) : (function () {
        var sgsLv = r.cells.level ? String(r.cells.level.old || '') : '';
        var kLv = r.kLevel == null ? '' : String(r.kLevel);
        var differ = sgsLv !== '' && kLv !== '' && sgsLv !== kLv;
        return '<td' + (differ ? ' class="ovr" title="เกณฑ์สองฝั่งคิดคนละแบบ ต่างกันได้"' : '') + '>' +
          esc(sgsLv || '—') + ' • ' + esc(kLv || '—') + '</td>';
      })();
      return '<tr><td>' + esc(r.sid) + '</td><td class="nm" title="' + esc(r.name) + '">' + esc(r.name) + '</td>' + tds +
        '<td>' + esc(r.sumText || '—') + '</td>' + lvCell + '</tr>';
    }).join('');

    var canFill = !stop && !needSubject && pl.changes.length > 0;
    shell(notes + opts +
      '<div style="margin:0 0 8px;color:#67748a;font-size:12px">' +
        '<span style="background:#e6f6ee;padding:1px 6px;border-radius:4px">เขียว</span> = ช่องว่างที่จะกรอกใหม่ • ' +
        '<span style="background:#fff0d6;padding:1px 6px;border-radius:4px">ส้ม</span> = จะเขียนทับค่าเดิม • 0=ไม่ผ่าน 1=ผ่าน 2=ดี 3=ดีเยี่ยม</div>' +
      '<div style="overflow:auto;max-height:52vh"><table>' + head + body + '</table></div>',
      '<button class="p" data-fill' + (canFill ? '' : ' disabled') + '>กรอกลง SGS ' + pl.changes.length + ' ช่อง</button>' +
      (pl.overwrite ? '<span style="color:#7a4700">ในนั้นเขียนทับค่าเดิม ' + pl.overwrite + ' ช่อง</span>' : '') +
      (pl.changes.length ? '' : '<span style="color:#67748a">ไม่มีช่องที่ต้องเปลี่ยน</span>') +
      '<button data-recheck style="margin-left:auto">ตรวจใหม่</button><button data-back>วางข้อมูลใหม่</button>');

    var q = function (sel) { return box.querySelector(sel); };
    q('[data-keep]').onchange = function (e) { state.keep = e.target.checked; stepAssessPreview(); };
    if (q('[data-fill-level]')) q('[data-fill-level]').onchange = function (e) { state.fillLevel = e.target.checked; stepAssessPreview(); };
    if (q('[data-subject-ok]')) q('[data-subject-ok]').onchange = function (e) { state.subjectOk = e.target.checked; stepAssessPreview(); };
    q('[data-back]').onclick = function () { stepPaste(''); };
    q('[data-recheck]').onclick = function () {
      state.assess = readAssess(state.kind);
      if (state.assess.error) return stepPaste(state.assess.error);
      stepAssessPreview();
    };
    q('[data-fill]').onclick = function () { if (canFill) fill(pl.changes); };
  }

  function stepPreview() {
    var p = state.payload, g = state.sgs, pl = plan();
    var subjectFound = !p.subject || g.subjectText.indexOf(p.subject) >= 0;
    var ratio = g.students.length ? pl.matched / g.students.length : 0;
    var stop = ratio < 0.5;
    var needSubject = !subjectFound && !state.subjectOk;

    var notes = '';
    notes += '<div class="n">ข้อมูลจาก EMS: <b>' + esc((p.subject ? p.subject + ' ' : '') + (p.subjectName || '')) + '</b> • ' + esc(p.cls || '') +
      ' • ' + esc(p.period || '') + ' • ' + (p.students || []).length + ' คน</div>';
    if (stop) notes += '<div class="n bad"><b>หยุดไว้ก่อน</b> นักเรียนบนหน้านี้ตรงกับข้อมูลที่คัดลอกมาเพียง ' + pl.matched + ' จาก ' + g.students.length +
      ' คน น่าจะเลือกรายวิชาหรือกลุ่มใน SGS ไม่ตรงกับที่คัดลอกมา</div>';
    if (!subjectFound) notes += '<div class="n bad">รายวิชาที่เลือกใน SGS ไม่มีรหัส <b>' + esc(p.subject) + '</b> ' +
      '<label><input type="checkbox" data-subject-ok' + (state.subjectOk ? ' checked' : '') + '> ตรวจแล้ว เป็นวิชาเดียวกันจริง</label></div>';
    g.problems.forEach(function (t) { notes += '<div class="n">' + esc(t) + '</div>'; });
    var toTick = [];
    SECTIONS.forEach(function (sec) {
      var c = pl.cols[sec.key];
      if (!c || !c.hasData) return;      /* ส่วนที่ไม่มีคะแนนจะส่ง ไม่ต้องเตือนให้รก */
      if (c.gate === 'tick') toTick.push(sec);
      else if (c.gate === 'closed') notes += '<div class="n">SGS ยังไม่เปิดรอบให้กรอก<b>' + sec.label + '</b> (ช่องติ๊กที่หัวคอลัมน์กดไม่ได้) จึงข้ามส่วนนี้</div>';
      else if (c.gate === 'stuck') notes += '<div class="n bad">คอลัมน์<b>' + sec.label + '</b> ติ๊กไว้แล้วแต่ยังกรอกไม่ได้ จึงข้ามส่วนนี้ — ลองรีเฟรชหน้า SGS แล้วเปิดปุ่มนี้ใหม่</div>';
    });
    if (toTick.length) notes += '<div class="n bad"><b>ยังกรอกไม่ได้:</b> SGS ต้องติ๊ก ☐ ที่หัวคอลัมน์ ' +
      toTick.map(function (x) { return '<b>' + x.label + '</b>'; }).join(' และ ') + ' ก่อน ' +
      '<button data-open="' + toTick.map(function (x) { return x.key; }).join(',') + '" style="margin-left:6px">ติ๊กเปิดให้เลย</button>' +
      '<div style="font-size:12px;margin-top:4px">หรือติ๊กเองในหน้า SGS แล้วกด "ตรวจใหม่"</div></div>';
    Object.keys(pl.cols).forEach(function (k) {
      var c = pl.cols[k], sec = SECTIONS.filter(function (s) { return s.key === k; })[0];
      if (!c.same && c.weight > 0) notes += '<div class="n bad">' + sec.label + ': EMS เต็ม <b>' + c.weight + '</b> แต่ SGS เต็ม <b>' + c.sgsMax + '</b> ' +
        '<label><input type="checkbox" data-scale="' + k + '"' + (state.scale[k] ? ' checked' : '') + '> แปลงสัดส่วนให้ (× ' + c.sgsMax + ' ÷ ' + c.weight + ')</label></div>';
    });
    if (pl.missing.length) notes += '<div class="n">ไม่พบบนหน้านี้ ' + pl.missing.length + ' คน (' +
      esc(pl.missing.slice(0, 6).map(function (s) { return s.sid; }).join(', ')) + (pl.missing.length > 6 ? ' …' : '') +
      ') — ถ้าอยู่หน้าถัดไป ให้ตั้ง /หน้า ของ SGS ให้มากขึ้นแล้วเปิดใหม่</div>';

    var opts = '<div class="opt"><label>ปัดเศษ <select data-mode>' +
      '<option value="half"' + (state.mode === 'half' ? ' selected' : '') + '>ทีละ 0.5</option>' +
      '<option value="one"' + (state.mode === 'one' ? ' selected' : '') + '>ทศนิยม 1 ตำแหน่ง</option>' +
      '<option value="int"' + (state.mode === 'int' ? ' selected' : '') + '>จำนวนเต็ม</option></select></label>' +
      '<label><input type="checkbox" data-keep' + (state.keep ? ' checked' : '') + '> ไม่แตะช่องที่ SGS มีคะแนนอยู่แล้ว</label></div>';

    var head = '<tr><th>เลขประจำตัว</th><th>ชื่อ</th>' + SECTIONS.map(function (s) {
      var c = pl.cols[s.key];
      var tag = !c ? 'ข้าม' : c.gate === 'open' ? 'เต็ม ' + c.sgsMax : c.gate === 'tick' ? 'ยังไม่ติ๊ก' : c.gate === 'closed' ? 'ปิดรอบ' : 'ล็อก';
      return '<th>' + s.label + '<br><small>' + tag + '</small></th>';
    }).join('') + '<th>รวมใน SGS</th><th>รวม EMS</th></tr>';
    var fmtN = function (v) {
      if (v == null || !isFinite(v)) return '';
      return (state.mode === 'int' || v % 1 === 0) ? String(Math.round(v)) : (Math.round(v * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '');
    };
    var body = pl.rows.map(function (r) {
      if (!r.found) return '<tr><td>' + esc(r.sid) + '</td><td class="nm">' + esc(r.name) + '</td><td colspan="6" style="color:#a61b1b">ไม่มีในข้อมูลที่คัดลอกมา — ไม่แตะแถวนี้</td></tr>';
      var diff = r.kTotal != null && Math.abs(r.sgsTotal - r.kTotal) >= 0.5;
      return '<tr><td>' + esc(r.sid) + '</td><td class="nm" title="' + esc(r.name) + '">' + esc(r.name) + '</td>' +
        SECTIONS.map(function (s) {
          var c = r.cells[s.key];
          if (!c) return '<td>—</td>';
          var show = fmtN(c.old);
          var nextShow = fmtN(c.next);
          if (c.state === 'chg') return '<td class="chg">' + nextShow + '</td>';
          if (c.state === 'ovr') return '<td class="ovr">' + show + ' → ' + nextShow + '</td>';
          if (c.state === 'bad') return '<td class="bad">เกินเต็ม</td>';
          return '<td>' + (show || '—') + '</td>';
        }).join('') +
        '<td' + (diff ? ' class="ovr" title="ต่างจาก EMS เพราะปัดเศษทีละส่วน"' : '') + '>' + fmtN(r.sgsTotal) + '</td>' +
        '<td>' + (r.kTotal == null ? '—' : r.kTotal) + '</td></tr>';
    }).join('');

    var canFill = !stop && !needSubject && pl.changes.length > 0;
    shell(notes + opts +
      '<div style="margin:0 0 8px;color:#67748a;font-size:12px">' +
        '<span style="background:#e6f6ee;padding:1px 6px;border-radius:4px">เขียว</span> = ช่องว่างที่จะกรอกใหม่ • ' +
        '<span style="background:#fff0d6;padding:1px 6px;border-radius:4px">ส้ม</span> = จะเขียนทับค่าเดิม • ช่องไม่มีสี = ไม่เปลี่ยน</div>' +
      '<div style="overflow:auto;max-height:52vh"><table>' + head + body + '</table></div>',
      '<button class="p" data-fill' + (canFill ? '' : ' disabled') + '>กรอกลง SGS ' + pl.changes.length + ' ช่อง</button>' +
      (pl.overwrite ? '<span style="color:#7a4700">ในนั้นเขียนทับค่าเดิม ' + pl.overwrite + ' ช่อง</span>' : '') +
      (pl.changes.length ? '' : '<span style="color:#67748a">ไม่มีช่องที่ต้องเปลี่ยน</span>') +
      '<button data-recheck style="margin-left:auto">ตรวจใหม่</button><button data-back>วางข้อมูลใหม่</button>');

    var q = function (s) { return box.querySelector(s); };
    q('[data-mode]').onchange = function (e) { state.mode = e.target.value; stepPreview(); };
    q('[data-keep]').onchange = function (e) { state.keep = e.target.checked; stepPreview(); };
    Array.prototype.forEach.call(box.querySelectorAll('[data-scale]'), function (el) {
      el.onchange = function () { state.scale[el.dataset.scale] = el.checked; stepPreview(); };
    });
    if (q('[data-subject-ok]')) q('[data-subject-ok]').onchange = function (e) { state.subjectOk = e.target.checked; stepPreview(); };
    q('[data-back]').onclick = function () { stepPaste(''); };
    q('[data-recheck]').onclick = function () {
      state.sgs = readSgs();
      if (state.sgs.error) return stepPaste(state.sgs.error);
      stepPreview();
    };
    if (q('[data-open]')) q('[data-open]').onclick = function () { openColumns(q('[data-open]').dataset.open.split(',')); };
    q('[data-fill]').onclick = function () { if (canFill) fill(pl.changes); };
  }

  /* ---- กรอกจริง -----------------------------------------------------------
     ของเดิมเดินช้าคงที่ทุกช่อง: อ่านตารางทั้งใบใหม่ + หน่วง 200 ms ก่อนกรอกทุกช่อง
     ห้องละ 40 คน 8 ข้อ = อ่านตาราง 320 รอบและหน่วงรวมกว่านาที ทั้งที่หน้าประเมิน
     ไม่ได้บันทึกทีละช่องด้วยซ้ำ ที่นี่จึงวัดเอาจากหน้าจริงแทนการเหมาว่าทุกหน้าเหมือนกัน

     - หาช่องจากดัชนีที่อ่านไว้ แล้วเช็ก isConnected ถ้าช่องยังอยู่ในหน้าแปลว่าตารางยัง
       ไม่ถูกวาดใหม่ ใช้ช่องเดิมได้เลย อ่านตารางใหม่เฉพาะตอนช่องหลุดจริง
     - เริ่มเดินแบบระวังเสมอ (รอการบันทึกให้จบก่อนทุกช่อง) ถ้ากรอกครบ CALIBRATE ช่องแล้ว
       ยังไม่เจอการบันทึกเลยและค่าติดครบทุกช่อง จึงเร่งเป็นแบบไม่หน่วง
     - เจอการบันทึก หรือค่าไม่ติด หรือช่องหลุด เมื่อไร กลับไปเดินแบบระวังทันที
       และไม่เร่งอีกเลยในรอบนั้น เพราะแปลว่าหน้านี้คุยกับเซิร์ฟเวอร์ทีละช่องจริง

     ตาข่ายกันพลาดยังครบเหมือนเดิม: ไม่เขียนลงช่องที่ล็อก อ่านค่ากลับทุกช่องทันทีที่เขียน
     และตอนจบอ่านตารางใหม่ทั้งใบอีกครั้งเพื่อตรวจทุกช่องที่กรอกไป */
  /* นับคำขอที่หน้าเว็บยิงออกไปเอง ทั้ง XHR และ fetch
     จำเป็นเพราะการตัดสินใจ 'เร่งได้' ตั้งอยู่บนว่าหน้านี้ไม่ได้บันทึกทีละช่อง
     ถ้าหน้าไหนบันทึกด้วย XHR ตรง ๆ โดยไม่ผ่าน PageRequestManager แล้วเรามองไม่เห็น
     เราจะเร่งใส่จนคำขอซ้อนกัน ของบางช่องหายที่เซิร์ฟเวอร์ แต่หน้าจอยังครบ
     (เพราะเราเป็นคนใส่ค่าเอง) การตรวจตอนจบซึ่งอ่านจากหน้าจอจึงจับไม่ได้
     ดักไว้เฉพาะช่วงที่กำลังกรอก แล้วคืนของเดิมให้หน้าเว็บทันทีที่เสร็จ */
  var netPending = 0, netRestore = null;
  function watchNetwork() {
    if (netRestore) return;
    var oldSend = XMLHttpRequest.prototype.send, oldFetch = window.fetch;
    XMLHttpRequest.prototype.send = function () {
      netPending++;
      var done = function () { netPending = Math.max(0, netPending - 1); };
      this.addEventListener('loadend', done);
      try { return oldSend.apply(this, arguments); } catch (e) { done(); throw e; }
    };
    if (typeof oldFetch === 'function') window.fetch = function () {
      netPending++;
      var done = function () { netPending = Math.max(0, netPending - 1); };
      return oldFetch.apply(this, arguments).then(function (r) { done(); return r; },
        function (e) { done(); throw e; });
    };
    netRestore = function () {
      XMLHttpRequest.prototype.send = oldSend;
      if (typeof oldFetch === 'function') window.fetch = oldFetch;
      netRestore = null; netPending = 0;
    };
  }
  /** หน้ากำลังส่งข้อมูลกลับเซิร์ฟเวอร์อยู่ไหม — ทั้ง ASP.NET AJAX และคำขออื่น */
  function isPageBusy() {
    if (netPending > 0) return true;
    try {
      var prm = window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager && Sys.WebForms.PageRequestManager.getInstance();
      return !!(prm && prm.get_isInAsyncPostBack());
    } catch (e) { return false; }
  }
  function waitIdle() {
    return new Promise(function (resolve) {
      var start = Date.now();
      (function poll() {
        if (!isPageBusy() || Date.now() - start > 10000) return resolve();
        setTimeout(poll, 120);
      })();
    });
  }
  /** เฝ้าดูตลอดช่วงเวลาที่กำหนดว่าการกรอกช่องที่เพิ่งทำไป ทำให้หน้าส่งข้อมูล
      กลับเซิร์ฟเวอร์หรือไม่ — ต้องเฝ้าทันทีหลังกรอก ไม่ใช่ไปดูทีหลัง เพราะการบันทึก
      อาจจบไปแล้วก่อนเราดู แล้วจะสรุปผิดว่าหน้านี้ไม่ได้บันทึกทีละช่อง
      และต้องเฝ้าจนครบเวลาเสมอ ไม่หยุดกลางคัน เพราะช่วงนี้ทำหน้าที่เป็นจังหวะหน่วงไปด้วย
      การบันทึกของหน้าเว็บจึงเดินคู่ขนานไปกับการหน่วง ไม่ใช่ต่อคิวกันจนช้าเป็นสองเท่า */
  async function watchBusy(ms) {
    var seen = false, start = Date.now();
    while (Date.now() - start < ms) {
      if (isPageBusy()) seen = true;
      await sleep(10);
    }
    return seen;
  }
  /** อ่านตารางทั้งใบครั้งเดียว แล้วทำดัชนี เลขประจำตัว -> ช่องกรอก
      ใช้ร่วมกันทั้งหน้าคะแนนและหน้าประเมิน ตัวกรอกจริงจึงเป็นชุดเดียว */
  function readIndex() {
    var g = state.kind ? readAssess(state.kind) : readSgs();
    if (g.error) return null;
    var m = {};
    g.students.forEach(function (st) { m[st.sid] = st.inputs; });
    return m;
  }
  function setValue(inp, text) {
    inp.focus();
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc.set.call(inp, text);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.blur();
  }

  /* ติ๊กด้วยการคลิกช่องติ๊กของ SGS เอง ให้ตัวจัดการของ SGS ทำงานเหมือนครูกดเอง
     ติ๊กเฉพาะช่องที่ยังไม่ได้ติ๊กและกดได้ ไม่ติ๊กออกเด็ดขาด เพราะการติ๊กออกอาจล็อกคอลัมน์
     ที่ครูเปิดไว้ หรือทำอย่างอื่นที่เรามองไม่เห็นจากหน้าจอ */
  function openColumns(keys) {
    state.busy = true;
    shell('<div class="n">กำลังติ๊กเปิดคอลัมน์ใน SGS…</div>', '');
    (async function () {
      for (var i = 0; i < keys.length; i++) {
        await waitIdle();
        var g = readSgs();
        var col = g.map && g.map[keys[i]];
        if (!col || col.open || !col.checkbox || col.checkbox.disabled || col.checkbox.checked) continue;
        col.checkbox.click();
        await sleep(300);
        await waitIdle();
        await sleep(300);
      }
      state.busy = false;
      state.sgs = readSgs();
      if (state.sgs.error) return stepPaste(state.sgs.error);
      stepPreview();
    })();
  }

  function fill(changes) {
    state.busy = true;
    shell('<div class="n">กำลังกรอก… อย่าปิดหรือเปลี่ยนหน้า SGS จนกว่าจะเสร็จ</div>' +
      '<div data-prog style="font-size:16px;font-weight:700">0 / ' + changes.length + '</div>' +
      '<div data-pace style="font-size:12px;color:#67748a;margin-top:4px"></div>', '');
    var prog = box.querySelector('[data-prog]');
    var pace = box.querySelector('[data-pace]');
    watchNetwork();
    (async function () {
      var lost = [], locked = [], idx = null;
      var careful = true, clean = 0, sawSave = false;
      var CALIBRATE = 6;
      var showPace = function () {
        if (!pace) return;
        pace.textContent = careful
          ? 'เดินแบบระวัง — หน้านี้บันทึกทีละช่อง ต้องรอให้แต่ละช่องบันทึกจบก่อน'
          : 'เร่งได้ — ตรวจแล้วว่าหน้านี้ไม่ได้บันทึกทีละช่อง';
      };
      var inputFor = function (sid, key) {
        if (idx) {
          var cached = (idx[sid] || {})[key];
          if (cached && cached.isConnected) return cached;
        }
        idx = readIndex();
        return idx ? (idx[sid] || {})[key] : null;
      };
      showPace();
      for (var i = 0; i < changes.length; i++) {
        var ch = changes[i];
        var inp = inputFor(ch.sid, ch.key);
        if (!inp) { lost.push(ch); continue; }
        /* ครูอาจติ๊กคอลัมน์ออกระหว่างนั้น หรือ SGS ปิดรอบไปแล้ว ห้ามเขียนลงช่องที่ล็อก */
        if (inp.disabled || inp.readOnly) { locked.push(ch); continue; }
        setValue(inp, ch.text);
        /* อ่านค่ากลับทันทีจากช่องเดิม ไม่ต้องสแกนตาราง ถ้าค่าไม่ติดหรือช่องหลุดออกจากหน้า
           แปลว่าหน้ากำลังทำอะไรของมันอยู่ ต้องกลับไปเดินแบบระวัง */
        var stuck = inp.isConnected && String(inp.value || '').trim() === ch.text;
        if (!stuck) { sawSave = true; careful = true; clean = 0; }
        if (careful) {
          /* หน่วง 200 ms พร้อมกับเฝ้าดูว่ามีการบันทึกโผล่มาไหม สองอย่างนี้ทับกันได้
             เสร็จแล้วถ้ายังบันทึกไม่จบก็รอต่อ จะได้ไม่เขียนช่องถัดไปทับคิวเดิม */
          if (await watchBusy(200)) { sawSave = true; clean = 0; await waitIdle(); }
          else if (stuck && !sawSave && ++clean >= CALIBRATE) careful = false;
        } else if (i % 25 === 24) {
          /* เร่งอยู่ก็ยังต้องคืนจังหวะให้เบราว์เซอร์ได้วาดหน้าและให้หน้าเว็บได้ทำงานของตัวเอง
             พร้อมกับสอดส่องว่ามีการบันทึกโผล่มาทีหลังหรือเปล่า */
          await sleep(0);
          if (isPageBusy()) { sawSave = true; careful = true; clean = 0; await waitIdle(); }
        }
        prog.textContent = (i + 1) + ' / ' + changes.length;
        showPace();
      }
      await waitIdle();
      await sleep(600);
      /* ตรวจตอนจบด้วยการอ่านตารางใหม่ทั้งใบ *ครั้งเดียว* แทนที่จะอ่านใหม่ทีละช่อง
         ได้ผลเท่ากันเป๊ะ เพราะทุกอย่างนิ่งแล้ว แต่เร็วกว่ากันหลายสิบเท่า */
      var after = readIndex() || {};
      var wrong = [];
      changes.forEach(function (ch) {
        if (lost.indexOf(ch) >= 0 || locked.indexOf(ch) >= 0) return;
        var v = readNum((after[ch.sid] || {})[ch.key]);
        if (v == null || Math.abs(v - ch.value) > 1e-6) wrong.push(ch);
      });
      if (netRestore) netRestore();      // คืน XHR/fetch ของหน้าเว็บให้เหมือนเดิม
      state.busy = false;
      var ok = changes.length - lost.length - locked.length - wrong.length;
      shell(
        '<div class="n ' + (lost.length || locked.length || wrong.length ? 'bad' : 'ok') + '"><b>กรอกแล้ว ' + ok + ' จาก ' + changes.length + ' ช่อง</b>' +
          (locked.length ? '<br>ข้ามช่องที่ถูกล็อก ' + locked.length + ' ช่อง (คอลัมน์ไม่ได้ติ๊กเปิด หรือ SGS ปิดรอบ)' : '') +
          (lost.length ? '<br>หาช่องไม่เจอ ' + lost.length + ' ช่อง (' + esc(lost.slice(0, 8).map(function (x) { return x.sid; }).join(', ')) + ')' : '') +
          (wrong.length ? '<br>ค่าในช่องไม่ตรงกับที่กรอก ' + wrong.length + ' ช่อง (' + esc(wrong.slice(0, 8).map(function (x) { return x.sid; }).join(', ')) + ')' : '') +
        '</div>' +
        '<div class="n"><b>ขั้นสุดท้ายที่ต้องทำ:</b> ' +
          'ถ้าหน้านี้มีปุ่ม <b>บันทึก</b> (รูปแผ่นดิสก์เหนือตาราง) <b>ให้กดบันทึกก่อน</b> ' +
          'แล้วค่อยกด <b>F5</b> รีเฟรชดูว่าตัวเลขยังอยู่ครบ<br>' +
          'ถ้ากด F5 ก่อนกดบันทึก ตัวเลขที่เพิ่งกรอกจะหายทั้งหมด<br>' +
          'ถ้าตัวเลขหายไปทั้งที่กดบันทึกแล้ว แปลว่า SGS ไม่รับการกรอกด้วยวิธีนี้ — แจ้งผู้ดูแล EMS และกรอกเองไปก่อน</div>',
        '<button class="p" data-close2>ปิด</button>');
      box.querySelector('[data-close2]').onclick = function () { box.remove(); };
    })();
  }

  stepPaste('');
}
