/* EMS — ภาษาและฟอนต์ (อยู่ใต้ปุ่มสลับโหมดมืด/สว่าง)
   - ภาษา: ไทย (ต้นฉบับ) · English · 中文 — แปลด้วยพจนานุกรมวลี แปลเฉพาะข้อความเมนู/ปุ่ม/หัวข้อ/สถานะที่รู้จัก
     ข้อความที่ยังไม่มีในพจนานุกรมและข้อมูลของผู้ใช้ (ชื่อ ห้อง รายวิชา) จะแสดงตามเดิม
     เพิ่มภาษาใหม่ได้โดยเพิ่มคอลัมน์ในตาราง DICT และรายการใน LANGS
   - ฟอนต์: Sarabun · Times New Roman · TH Sarabun New · IBM Plex Sans Thai · Noto Sans Thai · Kanit · Prompt · Tahoma · ฟอนต์ระบบ
     Times New Roman ไม่มีตัวอักษรไทย ตัวไทยจะใช้ Sarabun แทนโดยอัตโนมัติ */
(() => {
/* ---------- ฟอนต์ ---------- */
const FONTS = {
  plex: ['IBM Plex Sans Thai', '"IBM Plex Sans Thai",system-ui,"Segoe UI",sans-serif', 'IBM+Plex+Sans+Thai:wght@400;500;600;700'],
  sarabun: ['Sarabun (สารบรรณ)', '"Sarabun","TH Sarabun New",system-ui,"Segoe UI",sans-serif', 'Sarabun:wght@400;500;600;700'],
  times: ['Times New Roman', '"Times New Roman",Times,"Sarabun","TH Sarabun New",serif', 'Sarabun:wght@400;500;600;700'],
  thsarabun: ['TH Sarabun New', '"TH Sarabun New","THSarabunNew","Sarabun",sans-serif', 'Sarabun:wght@400;500;600;700'],
  notothai: ['Noto Sans Thai', '"Noto Sans Thai","Sarabun",system-ui,sans-serif', 'Noto+Sans+Thai:wght@400;500;600;700'],
  kanit: ['Kanit', '"Kanit","Sarabun",system-ui,sans-serif', 'Kanit:wght@400;500;600;700'],
  prompt: ['Prompt', '"Prompt","Sarabun",system-ui,sans-serif', 'Prompt:wght@400;500;600;700'],
  tahoma: ['Tahoma', 'Tahoma,"Segoe UI","Sarabun",sans-serif', ''],
  system: ['ฟอนต์ของระบบ', 'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Sarabun",sans-serif', '']
};
const LANGS = { th: ['ไทย', 'th-TH', 0], en: ['English', 'en-GB', 1], zh: ['中文', 'zh-CN', 2] };   // [ชื่อ, locale, คอลัมน์ใน DICT]

const st = document.createElement('style');
st.textContent = `:root body,:root button,:root input,:root select,:root textarea{font-family:var(--ef,"IBM Plex Sans Thai",system-ui,sans-serif)}
:root[data-font="thsarabun"] body{font-size:1.14rem}:root[data-font="times"] body{font-size:1.04rem}
.typo select{width:100%}`;
document.head.appendChild(st);
const loaded = new Set(['plex']);
function applyFont() {
  const k = FONTS[S.prefs.font] ? S.prefs.font : 'plex', f = FONTS[k];
  if (f[2] && !loaded.has(f[2])) { loaded.add(f[2]); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + f[2] + '&display=swap'; document.head.appendChild(l); }
  document.documentElement.style.setProperty('--ef', f[1]);
  document.documentElement.dataset.font = k;
}

/* ---------- พจนานุกรม [ไทย, English, 中文] ---------- */
const DICT = [
/* เมนู */
['หน้าหลัก', 'Home', '首页'], ['ตารางสอน', 'Timetable', '课表'], ['เช็กชื่อ', 'Attendance', '点名'], ['สมุดคะแนน', 'Gradebook', '成绩册'],
['กรอกคะแนน', 'Enter scores', '录入成绩'], ['หัวข้อคะแนน', 'Score items', '成绩项目'], ['คะแนนกลุ่ม', 'Group scores', '小组成绩'],
['ตัวชี้วัด / ผลการเรียนรู้', 'Indicators / Learning outcomes', '指标 / 学习成果'], ['คุณลักษณะ / อ่านคิดวิเคราะห์', 'Traits / Reading & analysis', '品质 / 阅读分析'],
['สรุป / ส่งออก ปพ.5', 'Summary / Export (Por Por 5)', '总结 / 导出 ปพ.5'], ['งานของฉัน', 'My work', '我的工作'], ['ใบลา', 'Leave', '请假'], ['แลกคาบ', 'Swap periods', '换课'],
['แจ้งซ่อม / ขอใช้สถานที่', 'Repairs / Venue requests', '报修 / 场地申请'], ['บันทึกพฤติกรรมนักเรียน', 'Student conduct', '学生品行记录'], ['กิจกรรมนักเรียน', 'Student activities', '学生活动'],
['โครงสร้างรายวิชา', 'Course structure', '课程结构'], ['เอกสาร', 'Documents', '文档'], ['ไฟล์บน Drive', 'Files on Drive', 'Drive 文件'], ['ปฏิทินวิชาการ', 'Academic calendar', '学术日历'],
['บัญชี', 'Account', '账户'], ['ข้อมูลของฉัน', 'My profile', '我的资料'], ['ประวัติส่วนตัว', 'Personal record', '个人档案'], ['ภาพรวม', 'Overview', '概览'],
['รออนุมัติ', 'Pending approval', '待审批'], ['ฝ่ายงาน', 'Departments', '部门'], ['ฝ่ายวัดผล', 'Assessment office', '评估处'], ['ตรวจรายวิชา', 'Review courses', '课程审核'],
['ฝ่ายบุคคล', 'Personnel', '人事处'], ['การลาและการอนุมัติ', 'Leave & approvals', '请假与审批'], ['กิจการนักเรียน', 'Student affairs', '学生事务'], ['ฝ่ายกิจการนักเรียน', 'Student affairs office', '学生事务处'],
['บริหารทั่วไป', 'General administration', '总务'], ['ฝ่ายบริหารทั่วไป', 'General administration office', '总务处'], ['สรุปผู้บริหาร', 'Executive summary', '管理层摘要'],
['ข้อมูลหลัก', 'Master data', '基础数据'], ['นักเรียน', 'Students', '学生'], ['ฐานนักเรียน', 'Student database', '学生库'], ['ผู้ใช้และสิทธิ์', 'Users & roles', '用户与权限'],
['ห้องและรายวิชา', 'Classes & subjects', '班级与科目'], ['นำเข้าข้อมูล', 'Import data', '导入数据'], ['ระบบ', 'System', '系统'], ['Drive และสำรองข้อมูล', 'Drive & backup', 'Drive 与备份'],
['ตั้งค่าโรงเรียน', 'School settings', '学校设置'], ['ปรับแต่งการแสดงผล', 'Display settings', '显示设置'], ['สลับโหมดมืด/สว่าง', 'Toggle dark / light mode', '切换深色 / 浅色'],
['ออกจากระบบ', 'Sign out', '退出登录'], ['มุมมอง (โหมดตัวอย่าง)', 'View (demo mode)', '视图（演示模式）'], ['ครู', 'Teacher', '教师'], ['ผู้ดูแลระบบ / ฝ่ายงาน', 'Admin / Departments', '管理员 / 部门'],
['เมนูทั้งหมด', 'All menus', '全部菜单'], ['เมนูเพิ่มเติม', 'More menus', '更多菜单'], ['เพิ่มเติม', 'More', '更多'], ['คะแนน', 'Scores', '成绩'], ['ผู้ใช้', 'Users', '用户'], ['อนุมัติ', 'Approve', '批准'], ['วัดผล', 'Assessment', '评估'],
['อื่น ๆ', 'Others', '其他'], ['จัดการระบบ', 'Administration', '系统管理'], ['ภาษา / Language', 'Language', '语言'], ['ฟอนต์ / Font', 'Font', '字体'], ['ภาษา', 'Language', '语言'], ['ฟอนต์', 'Font', '字体'],
/* คำทั่วไป */
['บันทึก', 'Save', '保存'], ['ยกเลิก', 'Cancel', '取消'], ['ลบ', 'Delete', '删除'], ['เพิ่ม', 'Add', '添加'], ['แก้ไข', 'Edit', '编辑'], ['พิมพ์', 'Print', '打印'], ['ค้นหา', 'Search', '搜索'],
['ส่งออก', 'Export', '导出'], ['นำเข้า', 'Import', '导入'], ['ปิด', 'Close', '关闭'], ['ตกลง', 'OK', '确定'], ['ย้อนกลับ', 'Back', '返回'], ['ถัดไป', 'Next', '下一步'], ['ตั้งค่า', 'Settings', '设置'],
['ล้าง', 'Clear', '清除'], ['ส่ง', 'Send', '发送'], ['ทั้งหมด', 'All', '全部'], ['ไม่มี', 'None', '无'], ['ชื่อ-สกุล', 'Full name', '姓名'], ['ที่', 'No.', '序号'], ['เลขที่', 'No.', '学号'],
['ห้อง', 'Class', '班级'], ['วิชา', 'Subject', '科目'], ['วันที่', 'Date', '日期'], ['เวลา', 'Time', '时间'], ['สถานะ', 'Status', '状态'], ['หมายเหตุ', 'Note', '备注'], ['รวม', 'Total', '合计'],
['เกรด', 'Grade', '等级'], ['ผ่าน', 'Pass', '通过'], ['ไม่ผ่าน', 'Fail', '不通过'], ['ตั้งแต่', 'From', '从'], ['ถึง', 'To', '至'], ['คน', 'people', '人'], ['วัน', 'days', '天'], ['คาบ', 'Period', '节'],
['รายวิชา', 'Subject', '科目'], ['ระดับ', 'Level', '级别'], ['คะแนนเต็ม', 'Full score', '满分'], ['ค้นหาชื่อ', 'Search name', '搜索姓名'], ['ยังไม่มีข้อมูล', 'No data yet', '暂无数据'],
['เปิด', 'Open', '打开'], ['ดู', 'View', '查看'], ['ตั้งค่า', 'Settings', '设置'], ['เสร็จสิ้น', 'Done', '完成'], ['ตรวจสอบ', 'Review', '检查'], ['เลือกไฟล์', 'Choose file', '选择文件'],
['คืนค่ามาตรฐาน', 'Reset to default', '恢复默认'], ['ตัวอย่าง', 'Preview', '示例'], ['รออนุมัติ', 'Pending approval', '待审批'],
/* วัน/คาบ/เวลา */
['จันทร์', 'Mon', '周一'], ['อังคาร', 'Tue', '周二'], ['พุธ', 'Wed', '周三'], ['พฤหัสบดี', 'Thu', '周四'], ['ศุกร์', 'Fri', '周五'],
['สวัสดีตอนเช้า', 'Good morning', '早上好'], ['สวัสดีตอนบ่าย', 'Good afternoon', '下午好'], ['สวัสดีตอนเย็น', 'Good evening', '晚上好'],
['คาบถัดไป', 'Next period', '下一节'], ['ตารางสอนวันนี้', "Today's timetable", '今日课表'], ['ต้องทำ', 'To do', '待办'], ['ทางลัด', 'Shortcuts', '快捷方式'], ['วันนี้', 'Today', '今天'],
['เช็กชื่อวันนี้', "Today's attendance", '今日点名'], ['เช็กชื่อคาบนี้', 'Take attendance', '本节点名'], ['เช็กชื่อแล้ว', 'Checked', '已点名'], ['คำร้องของฉัน', 'My requests', '我的申请'],
/* เช็กชื่อ */
['มา', 'Present', '到'], ['สาย', 'Late', '迟到'], ['ลา', 'Leave', '请假'], ['กิจกรรม', 'Activity', '活动'], ['ขาด', 'Absent', '缺席'], ['ยังไม่เช็ก', 'Not checked', '未点名'],
['ที่', 'No.', '序号'], ['บันทึกการเช็กชื่อ', 'Save attendance', '保存点名'], ['บันทึกแล้ว', 'Saved', '已保存'], ['รายชื่อตามสถานะ', 'Names by status', '按状态名单'], ['ไม่มี', 'None', '无'],
['เลือกห้อง', 'Select class', '选择班级'], ['แตะเลือกสถานะรายคน หรือแตะ “หัวคอลัมน์” เพื่อเลือกทั้งห้อง (แตะซ้ำเพื่อล้าง)', 'Tap a status per student, or tap a column header to set the whole class (tap again to clear)', '点击每位学生的状态，或点击列标题设置全班（再次点击清除）'],
/* คะแนน */
['ก่อนกลางภาค', 'Before midterm', '期中前'], ['กลางภาค', 'Midterm', '期中'], ['หลังกลางภาค', 'After midterm', '期中后'], ['ปลายภาค', 'Final', '期末'], ['ซ่อมกลางภาค', 'Midterm retake', '期中补考'],
['ซ่อม', 'Retake', '补考'], ['กรอกครบ', 'Completed', '已录完'], ['รวม 100', 'Total 100', '合计 100'], ['เกณฑ์ผ่านรายส่วน', 'Pass threshold per part', '分项及格线'], ['เกณฑ์ตัดเกรด', 'Grade scale', '等级标准'],
['สัดส่วนคะแนนรวม 100', 'Score weights (total 100)', '成绩权重（共100）'], ['เพิ่มหัวข้อ', 'Add item', '添加项目'], ['เพิ่มหลายหัวข้อ', 'Add many items', '批量添加'], ['ใช้รูปแบบของห้องอื่น', 'Use another class setup', '使用其他班级设置'],
['คะแนนสอบกลางภาค / ปลายภาค', 'Midterm / final exam scores', '期中 / 期末考试成绩'], ['หัวข้อที่ให้คะแนน', 'Scored items', '计分项目'], ['ชื่อหัวข้อ', 'Item name', '项目名称'], ['ช่วง', 'Period', '阶段'],
['ประเภท', 'Type', '类型'], ['รายบุคคล', 'Individual', '个人'], ['กลุ่ม', 'Group', '小组'], ['สอบวัดผลรายหน่วย', 'Unit test', '单元测验'], ['ตั้งค่า', 'Settings', '设置'], ['กรอกด้วยเสียง', 'Voice entry', '语音录入'],
['🎤 กรอกด้วยเสียง', '🎤 Voice entry', '🎤 语音录入'], ['⏹ หยุดกรอกด้วยเสียง', '⏹ Stop voice entry', '⏹ 停止语音录入'], ['ส่งออกไปชีตของฉัน', 'Export to my Sheet', '导出到我的表格'], ['ส่งไปชีตของฉัน', 'Send to my Sheet', '发送到我的表格'],
['ดาวน์โหลด Excel', 'Download Excel', '下载 Excel'], ['ผ่าน', 'Pass', '通过'], ['ไม่ผ่าน', 'Fail', '不通过'], ['ข้อมูลหน้าปก', 'Cover info', '封面信息'], ['พิมพ์ปก', 'Print cover', '打印封面'],
['การกระจายเกรด', 'Grade distribution', '等级分布'], ['ตารางสรุปรายคน', 'Summary by student', '学生汇总表'], ['คะแนนเฉลี่ย (เต็ม 100)', 'Average (out of 100)', '平均分（满分100）'], ['สูงสุด', 'Highest', '最高'], ['ต่ำสุด', 'Lowest', '最低'],
['ให้นักเรียนดูผลจากมือถือตัวเอง', 'Let students view results on their phones', '让学生用手机查看成绩'], ['เผยแพร่ผลวิชานี้', 'Publish this subject', '发布本科目成绩'], ['ยกเลิกการเผยแพร่', 'Unpublish', '取消发布'],
['เผยแพร่แล้ว', 'Published', '已发布'], ['ยังไม่เผยแพร่', 'Not published', '未发布'], ['ประกาศผล', 'Publish results', '发布成绩'], ['ยกเลิกประกาศ', 'Unpublish', '取消发布'],
/* ชุดกลุ่ม / ตัวชี้วัด */
['สร้างชุดกลุ่ม', 'New group set', '新建分组'], ['คัดลอกจากชุดเดิม', 'Copy from existing set', '从已有分组复制'], ['แบ่งอัตโนมัติ', 'Auto split', '自动分组'], ['ทำสำเนา', 'Duplicate', '复制'],
['ลบชุดนี้', 'Delete this set', '删除此组'], ['เพิ่มกลุ่ม', 'Add group', '添加小组'], ['ผู้นำเสนอ', 'Presenters', '汇报人'], ['ทั้งกลุ่ม', 'Whole group', '全组'], ['เลือกจากหลักสูตร', 'Pick from curriculum', '从课程选择'],
['ผลการเรียนรู้ สสวท.', 'IPST learning outcomes', 'IPST 学习成果'], ['พิมพ์เอง / วางจาก Excel', 'Type / paste from Excel', '手动输入 / 从 Excel 粘贴'], ['คัดลอกไปห้องอื่น', 'Copy to other classes', '复制到其他班级'],
['ชุดตัวชี้วัดของวิชานี้', 'Indicators for this subject', '本科目指标'], ['ล้างทั้งหมด', 'Clear all', '全部清除'], ['กลางทาง', 'Mid-stage', '过程性'], ['ปลายทาง', 'End-stage', '终结性'],
/* ประเมิน */
['ประเมินคุณภาพผู้เรียน', 'Learner quality assessment', '学习质量评价'], ['คุณลักษณะอันพึงประสงค์', 'Desirable characteristics', '期望品质'], ['การอ่าน คิดวิเคราะห์ และเขียน', 'Reading, analytical thinking and writing', '阅读、分析与写作'],
['ดีเยี่ยม', 'Excellent', '优秀'], ['ดี', 'Good', '良好'], ['ผ่าน', 'Pass', '通过'], ['ไม่ผ่าน', 'Fail', '不通过'], ['ยังไม่ครบ', 'Incomplete', '未完成'], ['ล้างส่วนนี้', 'Clear this part', '清除此部分'],
/* ใบลา / อนุมัติ */
['ขอลา', 'Request leave', '申请请假'], ['ส่งใบลา', 'Submit leave', '提交请假单'], ['ยืนยัน', 'Confirm', '确认'], ['ลาป่วย', 'Sick leave', '病假'], ['ลากิจส่วนตัว', 'Personal leave', '事假'], ['ลาพักผ่อน', 'Annual leave', '年假'],
['ลาคลอดบุตร', 'Maternity leave', '产假'], ['ไปราชการ', 'Official trip', '公务出差'], ['ลาอื่น ๆ', 'Other leave', '其他假'], ['ยังไม่ส่ง', 'Draft', '草稿'], ['รอผู้บริหารอนุมัติ', 'Awaiting director approval', '等待校长批准'],
['อนุมัติแล้ว', 'Approved', '已批准'], ['ไม่อนุมัติ', 'Not approved', '未批准'], ['เห็นควรอนุญาต', 'Recommend approval', '建议批准'], ['ไม่เห็นชอบ', 'Not endorsed', '不同意'], ['ใบลาของฉัน', 'My leave requests', '我的请假单'],
['ใบลารออนุมัติ', 'Leave requests pending', '待批请假单'], ['รอหัวหน้ากลุ่มสาระ', 'Awaiting head of department', '等待教研组长'], ['สรุปการลารายครู', 'Leave summary by teacher', '教师请假汇总'],
['ประวัติใบลาทั้งหมด', 'All leave history', '全部请假记录'], ['ใบลารออนุมัติ', 'Pending leave requests', '待批请假单'], ['รับแลกคาบ', 'Swaps accepted', '接受换课'],
['รอเพื่อนครูตอบรับ', 'Awaiting colleague', '等待同事回复'], ['รอฝ่ายวิชาการอนุมัติ', 'Awaiting academic approval', '等待教务批准'], ['เรียบร้อย', 'Completed', '已完成'], ['ตอบรับ', 'Accept', '接受'], ['ปฏิเสธ', 'Decline', '拒绝'],
['ขอแลกคาบ', 'Request swap', '申请换课'], ['คาบของฉัน', 'My period', '我的课'], ['เหตุผล', 'Reason', '原因'],
/* ฝ่ายงาน */
['ทำเครื่องหมาย', 'Mark', '标记'], ['การลา', 'Leave', '请假'], ['เวลามาทำงาน', 'Work attendance', '上班考勤'], ['มาทันเวลา', 'On time', '准时'], ['มาสาย', 'Late', '迟到'], ['ไม่พบการสแกน', 'No scan found', '未找到打卡'],
['ลา / ไปราชการ', 'Leave / official trip', '请假 / 公务'], ['เพิ่มบรรทัดว่าง', 'Add blank row', '添加空行'], ['บันทึกพฤติกรรม', 'Record conduct', '记录品行'], ['วันนี้', 'Today', '今天'],
['บันทึกมาสายที่ประตู', 'Gate late arrivals', '校门迟到登记'], ['คะแนนพฤติกรรม', 'Conduct scores', '品行分'], ['ตั้งค่าเกณฑ์', 'Rule settings', '规则设置'], ['เกณฑ์คะแนน', 'Score rules', '分数规则'], ['รายการพฤติกรรม', 'Conduct items', '品行项目'],
['แจ้งซ่อม', 'Report repair', '报修'], ['ขอใช้สถานที่', 'Request venue', '申请场地'], ['คิวพิจารณา', 'Review queue', '审批队列'], ['ตารางใช้สถานที่', 'Venue schedule', '场地使用表'], ['ตั้งค่าฝ่าย', 'Department settings', '部门设置'],
['ค้างดำเนินการ', 'Open', '待处理'], ['ปิดงานแล้ว', 'Closed', '已结案'], ['มอบงาน / อัปเดต', 'Assign / update', '分配 / 更新'], ['ผู้ปฏิบัติงาน / ช่าง', 'Workers / technicians', '维修人员'],
['รออนุมัติ', 'Pending approval', '待审批'], ['อนุมัติแล้ว', 'Approved', '已批准'], ['ส่งแจ้งซ่อม', 'Submit repair', '提交报修'], ['ส่งคำขอ', 'Submit request', '提交申请'],
/* ตั้งค่า / ข้อมูล */
['ปีการศึกษา', 'Academic year', '学年'], ['ภาคเรียน', 'Semester', '学期'], ['เวลาคาบเรียน', 'Period times', '课时时间'], ['ปรับเวลาคาบเรียน', 'Adjust period times', '调整课时时间'], ['แก้ตารางสอน', 'Edit timetable', '编辑课表'],
['เสร็จสิ้นการแก้', 'Finish editing', '完成编辑'], ['พิมพ์ตาราง', 'Print timetable', '打印课表'], ['เพิ่มผู้ใช้', 'Add user', '添加用户'], ['บทบาท', 'Role', '角色'], ['อีเมล', 'Email', '电子邮件'],
['ครูผู้สอน', 'Teacher', '任课教师'], ['หัวหน้ากลุ่มสาระ', 'Head of department', '教研组长'], ['ฝ่ายวิชาการ', 'Academic affairs', '教务'], ['ผู้บริหาร', 'Executive', '管理层'],
['เปิดใน Drive', 'Open in Drive', '在 Drive 中打开'], ['อัปโหลด', 'Upload', '上传'], ['สำรองข้อมูลตอนนี้', 'Back up now', '立即备份'], ['การเชื่อมต่อ', 'Connections', '连接'], ['การสำรองข้อมูล', 'Backup', '备份'],
['ครูและบุคลากร', 'Teachers & staff', '教师和员工'], ['รายชื่อนักเรียนทุกห้อง', 'All class lists', '全部班级名单'],
/* การแสดงผล */
['สไตล์สำเร็จรูป', 'Presets', '预设样式'], ['ลักษณะทั่วไป', 'General', '通用'], ['ธีม', 'Theme', '主题'], ['ตามอุปกรณ์', 'Follow device', '跟随设备'], ['สว่าง', 'Light', '浅色'], ['มืด', 'Dark', '深色'],
['ขนาดตัวอักษร', 'Font size', '字号'], ['เล็ก', 'Small', '小'], ['ปกติ', 'Normal', '正常'], ['ใหญ่', 'Large', '大'], ['ใหญ่มาก', 'Extra large', '特大'], ['ความหนาแน่นของหน้า', 'Page density', '页面密度'],
['แน่น', 'Compact', '紧凑'], ['โปร่ง', 'Spacious', '宽松'], ['มุมของการ์ดและปุ่ม', 'Corner style', '圆角样式'], ['เหลี่ยม', 'Sharp', '直角'], ['มน', 'Round', '圆角'], ['สีหลัก', 'Accent colour', '主色'],
['มาตรฐาน', 'Standard', '标准'], ['กะทัดรัด (กรอกคะแนน)', 'Compact (score entry)', '紧凑（录入成绩）'], ['ตัวใหญ่ อ่านง่าย', 'Large & readable', '大字易读'], ['โหมดกลางคืน', 'Night mode', '夜间模式'], ['สดใส', 'Fresh', '清新'],
['การกรอกคะแนน', 'Score entry', '成绩录入'], ['เมนูเต็ม', 'Full menu', '完整菜单'], ['เมนูไอคอน', 'Icon menu', '图标菜单'],
/* หน้าแรก / เข้าสู่ระบบ */
['เข้าสู่ระบบ', 'Sign in', '登录'], ['เข้าสู่ระบบด้วย Google', 'Sign in with Google', '使用 Google 登录'], ['ใช้บัญชี Google ของโรงเรียนเพื่อเข้าใช้งาน', 'Use your school Google account to sign in', '请使用学校 Google 账号登录'],
['หรือทดลองดูระบบ (ข้อมูลสมมติ)', 'Or try the demo (sample data)', '或体验演示（示例数据）'], ['ครูผู้สอน', 'Teacher', '任课教师'], ['ฝ่ายงาน / ผู้ดูแลระบบ', 'Departments / Admin', '部门 / 管理员'],
['โรงเรียนปากช่อง · นครราชสีมา', 'Pakchong School · Nakhon Ratchasima', '巴冲学校 · 呵叻府'], ['โรงเรียนปากช่อง', 'Pakchong School', '巴冲学校'],
['เช็กชื่อและกรอกคะแนนได้ในไม่กี่แตะ ใช้ได้ทั้งมือถือและคอม', 'Take attendance and enter scores in a few taps — on phone or computer', '几下点击即可点名和录入成绩，手机电脑通用'],
['เอกสารและไฟล์สำรองทั้งหมดเก็บไว้ที่ Google Drive ของโรงเรียน', "All documents and backups are kept in the school's Google Drive", '所有文件和备份保存在学校的 Google Drive'],
['เห็นเฉพาะเมนูตามบทบาทของตนเอง ข้อมูลนักเรียนปลอดภัย', 'Each person sees only the menus for their role — student data stays safe', '每个人只看到自己角色的菜单，学生数据安全'],
['โหมดตัวอย่าง', 'Demo mode', '演示模式'], ['ข้อมูลทั้งหมดเป็นข้อมูลสมมติและเก็บในเครื่องนี้เท่านั้น ยังไม่เชื่อม Firebase / Google Drive', 'All data is sample data stored on this device only. Firebase / Google Drive are not connected yet.', '所有数据均为示例数据，仅保存在本设备，尚未连接 Firebase / Google Drive'],
/* วลียาว (ใช้แทนที่ในข้อความ) */
['ภาคเรียนที่', 'Semester', '学期'], ['คาบ/สัปดาห์', 'periods/week', '节/周'], ['รวม', 'Total', '共'], ['ทดลองดูระบบ', 'Try the demo', '体验演示'],
['ยังไม่มีรายชื่อนักเรียน', 'No students yet', '暂无学生名单'], ['ไม่มีรายการ', 'No items', '无项目'], ['ยังไม่มีข้อมูล', 'No data yet', '暂无数据']
,
/* ชุดที่ 2: ประโยค/วลีที่พบบนหน้าจอ */
['คะแนนของฉัน', 'My scores', '我的成绩'], ['เวลาเรียน', 'Attendance rate', '出勤'], ['สอบ', 'Exam', '考试'], ['วันหยุด', 'Holiday', '假日'], ['ประชุม', 'Meeting', '会议'], ['พักผ่อน', 'Vacation', '休假'],
['สำเร็จ', 'Success', '成功'], ['เบอร์โทร', 'Phone', '电话'], ['ผล', 'Result', '结果'], ['ข้อ', 'item', '项'], ['เต็ม', 'Max', '满'], ['ก่อนกลาง', 'Pre-mid', '期中前'], ['หลังกลาง', 'Post-mid', '期中后'],
['สอบหน่วย', 'Unit test', '单元测验'], ['รายการ', 'items', '项'], ['ค้าง', 'pending', '待办'], ['คำร้อง', 'Requests', '申请'], ['วันลารวม', 'Total leave days', '请假总天数'], ['ภาระสอน', 'Teaching load', '教学负担'],
['เลือกทั้งห้อง', 'Select whole class', '选择全班'], ['ให้ระดับคนที่ติ๊ก', 'Apply level to ticked students', '给已勾选学生评级'], ['เติม 3 ในช่องว่าง', 'Fill blanks with 3', '空白处填3'], ['เติม 2 ในช่องว่าง', 'Fill blanks with 2', '空白处填2'],
['⚡ คำนวณจากเวลาเรียน/ส่งงาน', '⚡ Auto-calculate from attendance / submissions', '⚡ 按出勤/作业自动计算'], ['⚡ คำนวณจากเกรด', '⚡ Auto-calculate from grade', '⚡ 按成绩自动计算'],
['รักชาติ ศาสน์ กษัตริย์', 'Loves nation, religion and monarchy', '热爱国家宗教君主'], ['ซื่อสัตย์สุจริต', 'Honesty and integrity', '诚实正直'], ['มีวินัย', 'Disciplined', '有纪律'], ['ใฝ่เรียนรู้', 'Eager to learn', '好学'],
['อยู่อย่างพอเพียง', 'Lives sufficiently', '适度生活'], ['มุ่งมั่นในการทำงาน', 'Dedicated to work', '专注工作'], ['รักความเป็นไทย', 'Loves Thai identity', '热爱泰国文化'], ['มีจิตสาธารณะ', 'Public-minded', '有公益心'],
['คัดสรรสื่อและอ่านเพื่อหาข้อมูลตามวัตถุประสงค์', 'Selects media and reads for information as needed', '按目的选择媒体并阅读获取信息'], ['จับประเด็นสำคัญ ประเด็นสนับสนุน และประเด็นโต้แย้ง', 'Identifies main, supporting and opposing points', '把握主要、支持与反对观点'],
['วิเคราะห์วิจารณ์ความสมเหตุสมผลและความน่าเชื่อถือ', 'Analyses reasoning and credibility', '分析合理性与可信度'], ['สรุปคุณค่า แนวคิด และแง่คิดจากเรื่องที่อ่าน', 'Summarises value, ideas and insights from reading', '总结阅读的价值与思想'],
['สรุป อภิปราย แสดงความคิดเห็น และถ่ายทอดด้วยการเขียน', 'Summarises, discusses, gives opinions and writes', '总结、讨论、表达观点并书面表达'],
['สรุปด้วยการนับจำนวนระดับ 0–3 ไม่ใช้ค่าเฉลี่ย', 'Summarised by counting levels 0–3, not averages', '按0–3级数量汇总，不用平均值'], ['ต้องได้ระดับ 3 อย่างน้อย', 'needs level 3 on at least', '至少需3级'], ['และไม่มีข้อใดต่ำกว่าระดับ 2', 'and no item below level 2', '且无项低于2级'],
['ดูคะแนนและเวลาเรียนของตนเอง', 'View your own scores and attendance', '查看自己的成绩和出勤'], ['เช็กชื่อ คะแนน คำร้อง แลกคาบ', 'Attendance, scores, requests, swaps', '点名、成绩、申请、换课'],
['อนุมัติ วัดผล บุคคล ผู้ใช้และสิทธิ์', 'Approvals, assessment, personnel, users & roles', '审批、评估、人事、用户与权限'],
['ติดปัญหาเข้าสู่ระบบ? แจ้งงานพัฒนาและบริการระบบดิจิทัลโรงเรียน', 'Trouble signing in? Contact Digital System Development and Services in School (DSDS)', '登录有问题？请联系学校数字系统开发与服务组'],
['ขณะนี้เป็นโหมดตัวอย่าง ยังไม่เชื่อมฐานข้อมูลจริง — ปุ่ม Google จะใช้งานได้เมื่อตั้งค่า Firebase เรียบร้อย', 'Demo mode — the real database is not connected yet. The Google button works once Firebase is configured.', '当前为演示模式，尚未连接真实数据库；配置 Firebase 后 Google 按钮方可使用'],
['© โรงเรียนปากช่อง · งานพัฒนาและบริการระบบดิจิทัลโรงเรียน', '© Pakchong School · Digital System Development and Services in School (DSDS)', '© 巴冲学校 · 学校数字系统开发与服务组'],
['งานพัฒนาและบริการระบบดิจิทัลโรงเรียน', 'Digital System Development and Services in School (DSDS)', '学校数字系统开发与服务组'],
['กลุ่มสาระฯ วิทยาศาสตร์', 'Science department', '科学教研组'], ['วิทยาศาสตร์', 'Science', '科学'], ['คณิตศาสตร์', 'Mathematics', '数学'], ['ภาษาไทย', 'Thai language', '泰语'], ['ภาษาต่างประเทศ', 'Foreign languages', '外语'], ['สังคมศึกษา', 'Social studies', '社会'],
['เจ้าหน้าที่ระบบ', 'System officer', '系统管理员'],
['วันคล้ายวันสวรรคต ร.9 (หยุด)', 'Anniversary of King Rama IX’s passing (holiday)', '拉玛九世逝世纪念日（假日）'], ['สอบกลางภาค วันแรก', 'Midterm exams – first day', '期中考试首日'], ['วันปิยมหาราช (หยุด)', 'Chulalongkorn Day (holiday)', '朱拉隆功日（假日）'],
['ประชุมผู้ปกครอง ม.3 และ ม.6', 'Parents’ meeting – M.3 and M.6', '家长会 – 初三与高三'], ['กิจกรรมวันลอยกระทง', 'Loy Krathong activity', '水灯节活动'], ['สอบปลายภาค วันแรก', 'Final exams – first day', '期末考试首日'],
['วันสอบ วันหยุด กิจกรรม และการประชุมของโรงเรียน', 'Exam days, holidays, activities and school meetings', '考试日、假日、活动与学校会议'],
['เลือกสไตล์สำเร็จรูป หรือปรับเองทีละอย่าง · เปลี่ยนแล้วเห็นผลทันที และจำค่าไว้ในเครื่องนี้', 'Pick a preset or adjust each option · changes apply instantly and are remembered on this device', '选择预设或逐项调整 · 立即生效并保存在本设备'],
['สมดุล อ่านสบาย', 'Balanced and easy to read', '均衡易读'], ['เห็นข้อมูลต่อหน้ามากที่สุด เมนูเป็นไอคอน', 'Most data per screen, icon menu', '单屏显示最多数据，图标菜单'],
['ตัวอักษรใหญ่ ปุ่มโต เหมาะกับจอเล็กหรือสายตา', 'Large text and buttons — for small screens or vision needs', '大字大按钮，适合小屏或视力不佳'], ['พื้นหลังมืด ถนอมสายตา', 'Dark background, easy on the eyes', '深色背景，护眼'],
['โทนเขียวน้ำทะเล มุมโค้งมน', 'Teal tone with rounded corners', '青绿色调，圆角'], ['รูปแบบเมนูด้านข้าง (คอม/แท็บเล็ต)', 'Side menu style (computer / tablet)', '侧边菜单样式（电脑/平板）'],
['แสดงสถานะ ผ่าน / ไม่ผ่าน รายส่วนและรายหน่วย', 'Show pass / fail status per part and per unit', '显示分项与单元的通过/不通过'], ['ก่อนกลางภาค กลางภาค หลังกลางภาค ปลายภาค และหัวข้อสอบวัดผลรายหน่วย — ปิดได้ถ้าไม่ต้องการ', 'Before midterm, midterm, after midterm, final and unit-test items — can be turned off', '期中前、期中、期中后、期末及单元测验 — 可关闭'],
['แสดงคะแนนที่ต่ำกว่าเกณฑ์ผ่านเป็นสีแดง', 'Show scores below the pass threshold in red', '低于及格线的成绩显示为红色'], ['ใช้เกณฑ์ผ่านรายส่วนของวิชา (ค่าเริ่มต้น 60%) ตั้งได้ที่หน้า “หัวข้อคะแนน”', 'Uses the subject’s pass threshold (default 60%), set on the “Score items” page', '使用科目的及格线（默认60%），可在“成绩项目”页设置'],
['แสดงปุ่มกรอกคะแนนด้วยเสียง', 'Show the voice score-entry button', '显示语音录入按钮'], ['ใช้ได้กับ Chrome / Edge (ต้องอนุญาตไมโครโฟนและต่ออินเทอร์เน็ต)', 'Works in Chrome / Edge (microphone permission and internet required)', '适用于 Chrome / Edge（需麦克风权限与网络）'],
['ปุ่มหลัก', 'Primary button', '主按钮'], ['ปุ่มรอง', 'Secondary button', '次按钮'], ['ช่องกรอก', 'Input', '输入框'],
['วันหยุด ไม่มีคาบสอน', 'Holiday — no classes', '假日，无课'], ['ไม่มีคาบสอนวันนี้', 'No classes today', '今天没有课'], ['สอนครบแล้ว พักผ่อนได้', 'All classes done — time to rest', '课已上完，可以休息'], ['เรียบร้อยทุกคาบ', 'All periods done', '全部完成'],
['บันทึกการมาเรียน', 'Record attendance', '记录出勤'], ['เก็บ/กลางภาค/ปลายภาค', 'Coursework / midterm / final', '平时/期中/期末'], ['ส่งใบลาออนไลน์', 'Submit leave online', '在线提交请假'], ['ไฟล์งานบน Drive', 'Work files on Drive', 'Drive 上的工作文件'],
['ไม่มีรายการค้าง', 'Nothing pending', '没有待办'], ['แตะที่คาบเพื่อเช็กชื่อ', 'Tap a period to take attendance', '点击课节点名'], ['กรอบทองคือคาบปัจจุบัน', 'gold frame = current period', '金色框为当前节次'],
['กรอกแล้วระบบรวมคะแนนและตัดเกรดให้ทันที', 'Totals and grades update instantly', '录入后立即汇总并评级'], ['วางจาก Excel ได้ทั้งคอลัมน์', 'paste whole columns from Excel', '可整列粘贴 Excel'], ['คะแนนต่ำกว่า', 'scores below', '低于'],
['แสดงเป็นสีแดง', 'are shown in red', '显示为红色'], ['แตะช่องแล้ววางข้อมูลจาก Excel ได้', 'tap a cell then paste from Excel', '点击单元格后可粘贴 Excel'], ['ลูกศร/Enter/Tab เลื่อนช่อง', 'arrows / Enter / Tab move between cells', '方向键/Enter/Tab 切换单元格'],
['ช่อง “ซ่อม” จะปรากฏเมื่อนักเรียนได้ต่ำกว่าเกณฑ์ผ่าน', 'The “Retake” box appears when a student is below the pass threshold', '学生低于及格线时会出现“补考”栏'], ['กรอกเกินคะแนนเต็มระบบจะปรับให้เท่าคะแนนเต็ม', 'values above the maximum are set to the maximum', '超过满分将自动调整为满分'],
['หัวหน้างานอาคารฯ', 'Building affairs head', '建筑事务负责人'], ['ผู้ช่วยรองฯ', 'Assistant deputy', '副校长助理'], ['รอง ผอ.', 'Deputy director', '副校长'], ['แจ้งโดย', 'Reported by', '报修人'], ['โปรเจกเตอร์', 'Projector', '投影仪'],
['ภาพเบลอ ปรับโฟกัสไม่ได้', 'Blurry image, cannot focus', '画面模糊，无法对焦'], ['คอมพิวเตอร์ / โปรเจกเตอร์ / เครื่องเสียง', 'Computers / projectors / audio', '电脑 / 投影仪 / 音响'],
['อาคาร / ห้องเรียน / ประตู หน้าต่าง', 'Building / classroom / doors & windows', '建筑 / 教室 / 门窗'], ['ไฟฟ้า / หลอดไฟ / ปลั๊ก', 'Electrical / lights / sockets', '电气 / 灯 / 插座'], ['ประปา / ห้องน้ำ', 'Plumbing / toilets', '水管 / 厕所'],
['โต๊ะ เก้าอี้ / ครุภัณฑ์', 'Desks & chairs / equipment', '桌椅 / 设备'], ['เครื่องปรับอากาศ / พัดลม', 'Air conditioners / fans', '空调 / 风扇'], ['บริเวณโรงเรียน / สนาม / ต้นไม้', 'Grounds / field / trees', '校园 / 操场 / 树木'],
['คะแนนพฤติกรรม · แถวเช้า · มาสาย', 'Conduct scores · Morning assembly · Late arrivals', '品行分 · 晨会 · 迟到'], ['ห้องที่เช็กแถวแล้ว', 'Rooms checked', '已点名班级'], ['ขาดแถว', 'Absent from assembly', '缺席晨会'],
['ต่ำกว่าเกณฑ์ทั้งปี', 'Below yearly threshold', '低于全年标准'], ['แถวเช้ารายห้อง', 'Morning assembly by room', '各班晨会'], ['นักเรียนมาสาย', 'Late students', '迟到学生'], ['ยังไม่มีนักเรียนมาสาย', 'No late students yet', '暂无迟到学生'],
['ข้อมูลแถวเช้ามาจากครูที่ปรึกษากดบันทึกเช็กชื่อคาบเข้าแถว', 'Morning assembly data comes from homeroom teachers saving assembly attendance', '晨会数据来自班主任保存的点名'],
['รอหัวหน้าตรวจ', 'Awaiting head review', '等待组长审核'], ['ส่งกลับแก้ไข', 'Returned for revision', '退回修改'], ['รอความเห็นหัวหน้ากลุ่มสาระ', 'Awaiting head of department’s opinion', '等待教研组长意见'],
['จัดครูสอนแทนเอง', 'Arrange a substitute myself', '自行安排代课'], ['ให้หัวหน้ากลุ่มสาระจัดครูสอนแทน', 'Head of department arranges a substitute', '由教研组长安排代课'], ['ขอแลกคาบกับเพื่อนครู', 'Swap periods with a colleague', '与同事换课'],
['ไม่มีคาบสอนในช่วงที่ลา', 'No classes during the leave', '请假期间无课'], ['ตุลาคม', 'October', '十月'], ['พฤศจิกายน', 'November', '十一月'], ['ธันวาคม', 'December', '十二月'],
['การทดลอง', 'Experiment', '实验'], ['โครงงานกลุ่ม', 'Group project', '小组项目'], ['สมุดบันทึก', 'Notebook', '笔记本'], ['งาน', 'Work', '作业'], ['ใบงาน', 'Worksheet', '练习单'], ['สอบย่อยหน่วย', 'Unit quiz', '单元小测'],
['อ่านออกเสียง', 'Read aloud', '朗读'], ['ภาระงาน', 'Task type', '任务类型'], ['ผลการเรียน', 'Results', '学习成绩'], ['วิชาที่ประกาศผลแล้ว', 'Subjects published', '已发布科目'], ['ประกาศ', 'Announcements', '公告'],
['เปิดตารางทั้งหมด', 'Open full table', '打开完整表'], ['คาบ 9', 'Period 9', '第9节'], ['ฝ่ายบริหาร', 'Administration', '管理'], ['ภาคเรียนนี้', 'this semester', '本学期'], ['สถานะการเผยแพร่', 'Publication status', '发布状态']
];
const ZH = LANGS.zh[2], EN = LANGS.en[2];
const maps = {};
Object.keys(LANGS).forEach(k => {
  if (k === 'th') return;
  const col = k === 'en' ? 1 : 2, exact = new Map(), sub = [];
  const tok = [];
  DICT.concat(window.EMS_I18N_EXTRA || []).forEach(r => { const out = r[col]; if (!out) return; exact.set(r[0], out);
    if (r[0].length >= 7) sub.push([r[0], out]);
    /* ไม่ใช้ lookbehind (?<!…) — Safari บน iOS 16.3 ลงไปไม่รองรับ ไฟล์นี้จึงพังตั้งแต่เปิดแอป · จับอักษรก่อนหน้าไว้ในกลุ่ม 1 แล้วใส่คืน */
    else tok.push([new RegExp('(^|[^ก-๙])' + r[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![ก-๙])', 'g'), out, r[0].length]); });
  sub.sort((a, b) => b[0].length - a[0].length);
  tok.sort((a, b) => b[2] - a[2]);
  maps[k] = { exact, sub, tok };
});

/* ---------- ตัวแปลบน DOM ---------- */
const origText = new WeakMap(), written = new WeakMap(), origAttr = new WeakMap();
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
let lang = 'th', busy = false;
function tr(s) {
  if (lang === 'th') return s;
  const m = maps[lang], t = s.trim();
  if (!t || !/[ก-๙]/.test(t)) return s;
  const hit = m.exact.get(t);
  if (hit !== undefined) return s.replace(t, hit);
  let out = s;
  for (const [k, v] of m.sub) if (out.indexOf(k) >= 0) out = out.split(k).join(v);
  if (/[ก-๙]/.test(out)) for (const [re, v] of m.tok) { re.lastIndex = 0; if (re.test(out)) { re.lastIndex = 0; out = out.replace(re, (all, pre) => pre + v); } }
  return out;
}
function doText(node) {
  const cur = node.nodeValue;
  if (written.has(node) && written.get(node) === cur) return;          // เป็นข้อความที่เราแปลไว้แล้ว
  if (!/[ก-๙]/.test(cur)) return;
  const out = tr(cur);
  if (out === cur) return;
  origText.set(node, cur); written.set(node, out); node.nodeValue = out;
}
function doAttrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const v = el.getAttribute(a), rec = origAttr.get(el) || {};
    if (rec[a] && rec[a].out === v) continue;
    if (!/[ก-๙]/.test(v)) continue;
    const out = tr(v); if (out === v) continue;
    rec[a] = { orig: v, out }; origAttr.set(el, rec); el.setAttribute(a, out);
  }
}
function walk(root) {
  if (!root || lang === 'th') return;
  busy = true;
  try {
    if (root.nodeType === 3) { if (root.parentNode && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(root.parentNode.nodeName)) doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n = root.nodeType === 1 ? root : tw.nextNode();
    if (root.nodeType === 1) doAttrs(root);
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) { if (!/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) doText(n); }
      else doAttrs(n);
    }
  } finally { busy = false; obs.takeRecords(); }
}
function restoreAll() {
  busy = true;
  try {
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) { if (origText.has(n) && written.get(n) === n.nodeValue) { n.nodeValue = origText.get(n); } origText.delete(n); written.delete(n); }
      else { const rec = origAttr.get(n); if (rec) { Object.keys(rec).forEach(a => { if (n.getAttribute(a) === rec[a].out) n.setAttribute(a, rec[a].orig); }); origAttr.delete(n); } }
    }
  } finally { busy = false; }
}
let pending = new Set(), raf = 0;
const obs = new MutationObserver(muts => {
  if (busy || lang === 'th') return;
  muts.forEach(m => { if (m.type === 'childList') m.addedNodes.forEach(n => pending.add(n)); else if (m.type === 'characterData') pending.add(m.target); else if (m.type === 'attributes') pending.add(m.target); });
  if (!raf) raf = setTimeout(() => { raf = 0; const list = [...pending]; pending.clear(); list.forEach(n => { if (document.body.contains(n)) walk(n); }); }, 0);
});
obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

/* ---------- ภาษา ---------- */
function applyLang() {
  const next = LANGS[S.prefs.lang] ? S.prefs.lang : 'th';
  if (next !== lang) { if (lang !== 'th') restoreAll(); lang = next; }
  document.documentElement.lang = lang === 'th' ? 'th' : lang === 'en' ? 'en' : 'zh-CN';
  if (lang !== 'th') walk(document.body);
}
const typo = () => `<label class="field typo" style="display:block;margin:10px 0 0"><span class="f small muted">ภาษา / Language</span>
    <select class="in" style="min-height:40px" data-pfsel="lang" aria-label="ภาษา">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${S.prefs.lang === k || (!S.prefs.lang && k === 'th') ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
  <label class="field typo" style="display:block;margin:8px 0 0"><span class="f small muted">ฟอนต์ / Font</span>
    <select class="in" style="min-height:40px;font-family:var(--ef)" data-pfsel="font" aria-label="ฟอนต์">${Object.entries(FONTS).map(([k, v]) => `<option value="${k}" ${(S.prefs.font || 'plex') === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>`;

document.addEventListener('change', e => {
  const t = e.target.closest('[data-pfsel]'); if (!t) return;
  EMSPrefs.set(t.dataset.pfsel, t.value);
  if (t.dataset.pfsel === 'font') applyFont();
  if (t.dataset.pfsel === 'lang') { applyLang(); closeModal(); }
  const y = scrollY; render(); scrollTo(0, y);
  if (lang !== 'th') walk(document.body);
});

window.EMSType = {
  html: typo,
  printStack: () => (S.prefs.font && S.prefs.font !== 'plex' ? FONTS[S.prefs.font][1] : '"TH Sarabun New","Sarabun",system-ui,sans-serif'),
  fonts: () => FONTS
};
window.EMSLang = {
  locale: () => (LANGS[S.prefs.lang] || LANGS.th)[1],
  code: () => lang,
  translate: tr,
  untranslated() {                                          // ไว้ตรวจว่ายังมีข้อความไทยค้างอยู่ตรงไหนบ้าง
    const out = {}, tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) { const t = n.nodeValue.trim(); if (/[ก-๙]/.test(t) && !/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) out[t] = (out[t] || 0) + 1; }
    return out;
  }
};
applyFont(); applyLang();
})();
