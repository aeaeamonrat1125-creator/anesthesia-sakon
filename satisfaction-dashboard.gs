/**
 * สร้าง Dashboard ความพึงพอใจใน Google Sheets
 * วิธีใช้:
 *   1. เปิด Google Sheet ที่มีข้อมูลแบบสำรวจ
 *   2. ไปที่ Extensions > Apps Script
 *   3. วางโค้ดนี้ทั้งหมดแทนที่โค้ดเดิม
 *   4. กดปุ่ม Run ฟังก์ชัน สร้าง_Dashboard
 *   5. อนุญาต permission ครั้งแรก
 */

// ชื่อ Sheet ที่มีข้อมูลดิบ (Sheet แรก)
const DATA_SHEET_NAME = null; // null = ใช้ Sheet แรกอัตโนมัติ

// columns ของคะแนน (0-indexed): G,I,K,M,O,Q,S,U,W,Y = index 6,8,10,12,14,16,18,20,22,24
const SCORE_COLS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

const Q_LABELS = [
  '1. เจ้าหน้าที่พูดจาสุภาพ',
  '2. เจ้าหน้าที่เอาใจใส่',
  '3. เจ้าหน้าที่มีความเชี่ยวชาญ',
  '4. ความสะอาดของสถานที่',
  '5. ความเพียงพอของอุปกรณ์',
  '6. จำนวนพยาบาลเพียงพอ',
  '7. การจัดสถานที่',
  '8. ป้ายข้อความชัดเจน',
  '9. การติดต่อประสานงาน',
  '10. ให้บริการรวดเร็ว'
];

function สร้าง_Dashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = DATA_SHEET_NAME ? ss.getSheetByName(DATA_SHEET_NAME) : ss.getSheets()[0];

  if (!dataSheet) {
    SpreadsheetApp.getUi().alert('ไม่พบ Sheet ข้อมูล');
    return;
  }

  // ดึงข้อมูลทั้งหมด
  const allData = dataSheet.getDataRange().getValues();
  const rows    = allData.slice(1).filter(r => r[0]); // ข้ามหัวตาราง, ข้ามแถวว่าง
  const n       = rows.length;

  // คำนวณคะแนนรายข้อ
  const qStats = SCORE_COLS.map(col => {
    const vals = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v) && v > 0);
    const sum  = vals.reduce((a, b) => a + b, 0);
    return { avg: vals.length ? sum / vals.length : 0, cnt: vals.length };
  });

  // คะแนนรวมทุกข้อ
  let totalSum = 0, totalCnt = 0;
  SCORE_COLS.forEach(col => rows.forEach(r => {
    const v = parseFloat(r[col]);
    if (!isNaN(v) && v > 0) { totalSum += v; totalCnt++; }
  }));
  const overallAvg = totalCnt ? totalSum / totalCnt : 0;
  const satPct     = (overallAvg / 5) * 100;

  // การกระจายคะแนน (1-5)
  const dist = [0, 0, 0, 0, 0];
  SCORE_COLS.forEach(col => rows.forEach(r => {
    const v = parseInt(r[col]);
    if (v >= 1 && v <= 5) dist[v - 1]++;
  }));

  // แยกตามประเภทผู้ประเมิน (col 2 = ผู้ประเมิน)
  const typeMap = {};
  rows.forEach(r => {
    const t = (r[2] || 'ไม่ระบุ').toString().trim();
    if (!typeMap[t]) typeMap[t] = { sum: 0, cnt: 0, n: 0 };
    typeMap[t].n++;
    SCORE_COLS.forEach(col => {
      const v = parseFloat(r[col]);
      if (!isNaN(v) && v > 0) { typeMap[t].sum += v; typeMap[t].cnt++; }
    });
  });

  // สร้าง/ล้าง Dashboard sheet
  let dash = ss.getSheetByName('📊 Dashboard');
  if (dash) {
    dash.clear();
    dash.clearFormats();
  } else {
    dash = ss.insertSheet('📊 Dashboard', 0);
  }
  dash.setTabColor('#7c3aed');
  ss.setActiveSheet(dash);

  // กำหนดความกว้างคอลัมน์
  dash.setColumnWidth(1, 280);
  dash.setColumnWidth(2, 130);
  dash.setColumnWidth(3, 130);
  dash.setColumnWidth(4, 130);
  dash.setColumnWidth(5, 130);

  let row = 1;

  // ===== TITLE =====
  setRow(dash, row, 1, 5,
    [['📊 Dashboard ความพึงพอใจ — หน่วยงานวิสัญญีพยาบาล โรงพยาบาลสกลนคร']],
    { bg:'#6d28d9', color:'#ffffff', size:14, bold:true, align:'center', height:44, merge:true });
  row++;

  setRow(dash, row, 1, 5,
    [['อัปเดต: ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm น.')]],
    { bg:'#ede9fe', color:'#5b21b6', size:10, align:'center', height:24, merge:true });
  row += 2;

  // ===== SUMMARY =====
  sectionHeader(dash, row, '📋 สรุปภาพรวม'); row++;

  setRow(dash, row, 1, 5,
    [['จำนวนผู้ตอบ', 'คะแนนเฉลี่ยรวม', '% ความพึงพอใจ', 'เป้าหมาย', 'ผลการประเมิน']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;

  const statusText = satPct >= 90 ? '✅ บรรลุเป้าหมาย' : '❌ ต่ำกว่าเป้า';
  const kpiRange = dash.getRange(row, 1, 1, 5);
  kpiRange.setValues([[
    n + ' คน',
    overallAvg.toFixed(2) + '/5.00',
    satPct.toFixed(1) + '%',
    '90%',
    statusText
  ]]);
  kpiRange.setHorizontalAlignment('center').setFontWeight('bold').setFontSize(13);
  kpiRange.getCell(1, 5).setFontColor(satPct >= 90 ? '#059669' : '#dc2626');
  dash.setRowHeight(row, 36);
  row += 2;

  // ===== PER QUESTION =====
  sectionHeader(dash, row, '📊 คะแนนเฉลี่ยแต่ละหัวข้อ (คะแนนเต็ม 5.00)'); row++;

  setRow(dash, row, 1, 4,
    [['หัวข้อ', 'คะแนนเฉลี่ย', 'ระดับ', 'กราฟ (ภาพรวม)']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;

  qStats.forEach((s, i) => {
    const avg   = s.avg;
    const level = avg >= 4.5 ? 'ดีเยี่ยม' : avg >= 3.5 ? 'ดี' : avg >= 2.5 ? 'ปานกลาง' : 'พอใช้';
    const bars  = '■'.repeat(Math.round(avg / 5 * 10)) + '□'.repeat(10 - Math.round(avg / 5 * 10));
    const r     = dash.getRange(row, 1, 1, 4);
    r.setValues([[Q_LABELS[i], avg.toFixed(2), level, bars]]);
    r.getCell(1, 2).setHorizontalAlignment('center').setFontWeight('bold');
    r.getCell(1, 3).setHorizontalAlignment('center');
    const c = avg >= 4.5 ? '#059669' : avg >= 3.5 ? '#2563eb' : '#d97706';
    r.getCell(1, 3).setFontColor(c);
    r.getCell(1, 4).setFontColor(c).setFontFamily('Courier New');
    if (i % 2 === 0) r.setBackground('#f9fafb');
    dash.setRowHeight(row, 26);
    row++;
  });
  row++;

  // ===== DISTRIBUTION =====
  sectionHeader(dash, row, '🎯 การกระจายตัวของคะแนนทั้งหมด'); row++;

  const distLabels = ['ควรปรับปรุง (1)', 'พอใช้ (2)', 'ปานกลาง (3)', 'ดี (4)', 'ดีเยี่ยม (5)'];
  const totalDist  = dist.reduce((a, b) => a + b, 0);

  setRow(dash, row, 1, 3,
    [['ระดับ', 'จำนวน (ครั้ง)', 'สัดส่วน (%)']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;

  const distColors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#10b981'];
  distLabels.forEach((label, i) => {
    const pct = totalDist ? (dist[i] / totalDist * 100).toFixed(1) : '0';
    const dr  = dash.getRange(row, 1, 1, 3);
    dr.setValues([[label, dist[i], pct + '%']]);
    dr.getCell(1, 1).setFontColor(distColors[i]).setFontWeight('bold');
    dr.getCell(1, 2).setHorizontalAlignment('center');
    dr.getCell(1, 3).setHorizontalAlignment('center');
    if (i % 2 === 0) dr.setBackground('#f9fafb');
    dash.setRowHeight(row, 26);
    row++;
  });
  row++;

  // ===== BY TYPE =====
  sectionHeader(dash, row, '👥 คะแนนแยกตามประเภทผู้ประเมิน'); row++;

  setRow(dash, row, 1, 3,
    [['ประเภทผู้ประเมิน', 'จำนวน', 'คะแนนเฉลี่ย']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;

  Object.entries(typeMap)
    .sort((a, b) => b[1].n - a[1].n)
    .forEach(([type, s], i) => {
      const avg = s.cnt ? (s.sum / s.cnt).toFixed(2) : '-';
      const tr  = dash.getRange(row, 1, 1, 3);
      tr.setValues([[type, s.n + ' คน', avg + '/5.00']]);
      tr.getCell(1, 2).setHorizontalAlignment('center');
      tr.getCell(1, 3).setHorizontalAlignment('center').setFontWeight('bold');
      if (i % 2 === 0) tr.setBackground('#f9fafb');
      dash.setRowHeight(row, 26);
      row++;
    });
  row++;

  // ===== COMMENTS =====
  sectionHeader(dash, row, '💬 ความคิดเห็น / ข้อเสนอแนะ'); row++;

  setRow(dash, row, 1, 3,
    [['วันที่', 'ประเภท', 'ความคิดเห็น']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;

  const comments = rows.filter(r => r[25] && r[25].toString().trim());
  comments.slice(-30).reverse().forEach((r, i) => {
    let dateStr = '';
    try { dateStr = Utilities.formatDate(new Date(r[0]), 'Asia/Bangkok', 'dd/MM/yyyy'); } catch(e) {}
    const cr = dash.getRange(row, 1, 1, 3);
    cr.setValues([[dateStr, r[2] || '-', r[25] || '']]);
    cr.getCell(1, 3).setWrap(true);
    if (i % 2 === 0) cr.setBackground('#f9fafb');
    dash.setRowHeight(row, 30);
    row++;
  });

  // Freeze header area
  dash.setFrozenRows(0);

  SpreadsheetApp.getUi().alert(
    '✅ สร้าง Dashboard เสร็จแล้ว!\n\n' +
    '📊 ข้อมูล: ' + n + ' ผู้ตอบ\n' +
    '⭐ คะแนนเฉลี่ย: ' + overallAvg.toFixed(2) + '/5.00\n' +
    '😊 ความพึงพอใจ: ' + satPct.toFixed(1) + '%\n\n' +
    'ดูได้ที่ sheet "📊 Dashboard"'
  );
}

// ===== Helper functions =====
function setRow(sheet, row, col, span, values, opts) {
  const range = sheet.getRange(row, col, 1, span);
  if (opts.merge && span > 1) range.merge();
  range.setValues(values);
  if (opts.bg)     range.setBackground(opts.bg);
  if (opts.color)  range.setFontColor(opts.color);
  if (opts.size)   range.setFontSize(opts.size);
  if (opts.bold)   range.setFontWeight(opts.bold ? 'bold' : 'normal');
  if (opts.align)  range.setHorizontalAlignment(opts.align);
  if (opts.height) sheet.setRowHeight(row, opts.height);
  range.setVerticalAlignment('middle');
}

function sectionHeader(sheet, row, title) {
  const r = sheet.getRange(row, 1, 1, 5);
  r.merge().setValue(title)
    .setBackground('#7c3aed').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(11)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(row, 32);
}
