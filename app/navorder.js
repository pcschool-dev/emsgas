/* EMS — เรียงเมนูซ้ายให้งานเรื่องเดียวกันอยู่ติดกัน (คงกลุ่มเดิม ไม่ย้ายข้ามกลุ่ม)
   หลายโมดูลเพิ่มเมนูต่อท้ายกลุ่มเอง (add/push) ลำดับจึงตามลำดับโหลดไฟล์ — ที่นี่จัดใหม่ทุกครั้งก่อนวาดเมนู
   เมนูที่ไม่อยู่ในรายการ = ต่อท้ายกลุ่มตามลำดับเดิม (โมดูลใหม่ไม่หาย) · โหลดเป็นไฟล์สุดท้าย */
(() => {
  const ORDER = {
    teacher: {
      'งานของฉัน': [
        'my-time', 'leaves', 'swap', 'meetings',                  // งานบุคคลของฉัน
        'exam-plan', 'exam-check', 'loadprop',                   // การสอบ ภาระงานสอน (โครงสร้างรายวิชาอยู่กลุ่มสมุดคะแนน ใต้ตัวชี้วัด)
        'affairs', 'activities',                                 // ดูแลนักเรียน
        'general', 'dpa'                                         // ขอใช้บริการ
      ]
    },
    admin: {
      'ฝ่ายงาน': [
        'a-academic', 'a-cur', 'tt-studio', 'a-loadprop', 'a-ttflags',      // วิชาการ
        'a-measure', 'exam-check', 'score-sum',                             // วัดผล
        'a-hr', 'a-staffinfo', 'a-leaves', 'dpa',                           // บุคคล
        'a-affairs',                                                        // กิจการนักเรียน
        'a-general', 'meetings',                                            // บริหารทั่วไป
        'a-exec'                                                            // ผู้บริหาร
      ],
      'ข้อมูลหลัก': ['a-students', 'a-roomsort', 'a-newyear', 'a-courses', 'a-users', 'a-import'],
      'ระบบ': ['a-settings', 'a-maint', 'a-drive', 'a-usage']
    }
  };
  function sortNav() {
    const N = window.EMSNav; if (!N) return;
    Object.entries(ORDER).forEach(([v, groups]) => (N.NAVG[v] || []).forEach(g => {
      const want = groups[g[0]]; if (!want) return;
      const pos = id => { const i = want.indexOf(id); return i < 0 ? 1e3 : i; };
      const items = g[1].map((x, i) => [x, i]);
      items.sort((a, b) => pos(a[0][0]) - pos(b[0][0]) || a[1] - b[1]);
      items.forEach(([x], i) => { g[1][i] = x; });          // เรียงในอาร์เรย์เดิม (โมดูลอื่นถืออ้างอิงกลุ่มนี้อยู่)
    }));
  }
  sortNav();
  const base = window.renderChrome;
  if (base) window.renderChrome = function () { sortNav(); return base.apply(this, arguments); };
})();
