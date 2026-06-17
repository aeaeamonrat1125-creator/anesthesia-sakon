/**
 * Dashboard ความพึงพอใจ — หน่วยงานวิสัญญีพยาบาล โรงพยาบาลสกลนคร
 *
 * วิธีใช้:
 *   1. เปิด Google Sheet → Extensions > Apps Script
 *   2. วางโค้ดนี้ทั้งหมดแทนที่โค้ดเดิม → Save
 *   3. เลือกฟังก์ชันที่ต้องการ แล้วกด Run:
 *      - สร้าง_Dashboard          → ภาพรวมทุกปี + เปรียบเทียบรายปีงบฯ
 *      - สร้าง_Dashboard_รายปี    → สร้าง Sheet แยกต่างหากสำหรับแต่ละปีงบฯ
 *   4. อนุญาต permission ครั้งแรก
 *
 * ปีงบประมาณไทย: ต.ค. – ก.ย.
 *   เดือน ต.ค.–ธ.ค. → ปีงบฯ = ปี ค.ศ. + 543
 *   เดือน ม.ค.–ก.ย. → ปีงบฯ = ปี ค.ศ. + 542
 */

// ===== CONFIG =====
const DATA_SHEET_NAME = null;  // null = ใช้ Sheet แรกอัตโนมัติ
const SCORE_COLS      = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24]; // 0-indexed

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

// ===== FISCAL YEAR HELPER =====
function getFiscalYear(dateVal) {
  try {
    const d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    return m >= 10 ? y + 543 : y + 542;
  } catch(e) { return null; }
}

function getFiscalYearLabel(fy) {
  return 'ปีงบประมาณ ' + fy;
}

// ===== STATS CALCULATOR =====
function calcStats(rows) {
  const n = rows.length;
  if (n === 0) return { n:0, qAvg:SCORE_COLS.map(()=>0), overallAvg:0, satPct:0, dist:[0,0,0,0,0], typeMap:{} };

  const qAvg = SCORE_COLS.map(col => {
    const vals = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
  });

  let totalSum=0, totalCnt=0;
  SCORE_COLS.forEach(col => rows.forEach(r => {
    const v=parseFloat(r[col]); if(!isNaN(v)&&v>0){totalSum+=v;totalCnt++;}
  }));
  const overallAvg = totalCnt ? totalSum/totalCnt : 0;
  const satPct     = (overallAvg/5)*100;

  const dist = [0,0,0,0,0];
  SCORE_COLS.forEach(col => rows.forEach(r => {
    const v=parseInt(r[col]); if(v>=1&&v<=5) dist[v-1]++;
  }));

  const typeMap = {};
  rows.forEach(r => {
    const t=(r[2]||'ไม่ระบุ').toString().trim();
    if(!typeMap[t]) typeMap[t]={sum:0,cnt:0,n:0};
    typeMap[t].n++;
    SCORE_COLS.forEach(col=>{const v=parseFloat(r[col]);if(!isNaN(v)&&v>0){typeMap[t].sum+=v;typeMap[t].cnt++;}});
  });

  return { n, qAvg, overallAvg, satPct, dist, typeMap };
}

// ===== MAIN: สร้าง Dashboard ภาพรวม + เปรียบเทียบรายปี =====
function สร้าง_Dashboard() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = DATA_SHEET_NAME ? ss.getSheetByName(DATA_SHEET_NAME) : ss.getSheets().find(s=>s.getName()!=='📊 Dashboard'&&!s.getName().startsWith('📅'));

  if (!dataSheet) { SpreadsheetApp.getUi().alert('ไม่พบ Sheet ข้อมูล'); return; }

  const allData = dataSheet.getDataRange().getValues();
  const rows    = allData.slice(1).filter(r => r[0]);

  // จัดกลุ่มตามปีงบประมาณ
  const fyGroups = {};
  rows.forEach(r => {
    const fy = getFiscalYear(r[0]);
    if (!fy) return;
    if (!fyGroups[fy]) fyGroups[fy] = [];
    fyGroups[fy].push(r);
  });
  const fyList = Object.keys(fyGroups).map(Number).sort((a,b)=>b-a);

  // สถิติรวม
  const overall = calcStats(rows);

  // สร้าง/ล้าง sheet
  let dash = ss.getSheetByName('📊 Dashboard');
  if (dash) { dash.clear(); dash.clearFormats(); }
  else       { dash = ss.insertSheet('📊 Dashboard', 0); }
  dash.setTabColor('#7c3aed');
  ss.setActiveSheet(dash);

  dash.setColumnWidth(1, 280);
  [2,3,4,5].forEach(c => dash.setColumnWidth(c, 130));

  let row = 1;

  // ── TITLE ──
  setRow(dash, row, 1, 5,
    [['📊 Dashboard ความพึงพอใจ — หน่วยงานวิสัญญีพยาบาล โรงพยาบาลสกลนคร']],
    { bg:'#6d28d9', color:'#ffffff', size:14, bold:true, align:'center', height:44, merge:true });
  row++;
  setRow(dash, row, 1, 5,
    [['อัปเดต: ' + Utilities.formatDate(new Date(),'Asia/Bangkok','dd/MM/yyyy HH:mm น.') +
      '  |  ข้อมูล: ' + rows.length + ' ผู้ตอบ  |  ช่วง: ' + fyList.slice(-1)[0] + ' – ' + fyList[0]]],
    { bg:'#ede9fe', color:'#5b21b6', size:10, align:'center', height:22, merge:true });
  row += 2;

  // ── ภาพรวมทั้งหมด ──
  writeStatsBlock(dash, row, overall, '📋 สรุปภาพรวม (ทุกปีงบประมาณ)');
  row += blockHeight(overall) + 1;

  // ── เปรียบเทียบรายปีงบประมาณ ──
  sectionHeader(dash, row, '📅 เปรียบเทียบรายปีงบประมาณ'); row++;

  // หัว column
  const fyHeaders = ['หัวข้อ / KPI', ...fyList.map(fy=>'ปีงบฯ '+fy)];
  const hdr = dash.getRange(row, 1, 1, Math.min(fyList.length+1, 5));
  hdr.setValues([fyHeaders.slice(0, Math.min(fyList.length+1, 5))])
     .setBackground('#f3f4f6').setFontWeight('bold').setHorizontalAlignment('center');
  dash.setRowHeight(row, 28); row++;

  // แถวข้อมูลเปรียบเทียบ
  const compareRows = [
    ['จำนวนผู้ตอบ (คน)', ...fyList.map(fy=>fyGroups[fy].length)],
    ['คะแนนเฉลี่ยรวม (/5)', ...fyList.map(fy=>calcStats(fyGroups[fy]).overallAvg.toFixed(2))],
    ['% ความพึงพอใจ', ...fyList.map(fy=>calcStats(fyGroups[fy]).satPct.toFixed(1)+'%')],
    ['ผลเทียบเป้า (≥90%)', ...fyList.map(fy=>calcStats(fyGroups[fy]).satPct>=90?'✅ บรรลุ':'❌ ไม่บรรลุ')],
    ['', '', '', '', ''],
    ...Q_LABELS.map((label, i) => [
      label,
      ...fyList.map(fy => calcStats(fyGroups[fy]).qAvg[i].toFixed(2))
    ])
  ];

  compareRows.forEach((cr, idx) => {
    const cols = Math.min(cr.length, 5);
    const r    = dash.getRange(row, 1, 1, cols);
    r.setValues([cr.slice(0, cols)]);
    if (idx < 4) r.setFontWeight('bold');
    if (idx === 4) { dash.setRowHeight(row, 8); row++; return; }
    if (idx % 2 === 0) r.setBackground('#f9fafb');
    // สีผล บรรลุ/ไม่บรรลุ
    if (idx === 3) {
      fyList.forEach((fy, fi) => {
        if (fi+1 < cols) {
          const cell = r.getCell(1, fi+2);
          cell.setFontColor(calcStats(fyGroups[fy]).satPct >= 90 ? '#059669' : '#dc2626');
        }
      });
    }
    dash.setRowHeight(row, 26);
    row++;
  });
  row += 2;

  // ── สรุปรายปีงบประมาณ (แต่ละปีแบบละเอียด) ──
  fyList.forEach(fy => {
    const s = calcStats(fyGroups[fy]);
    writeStatsBlock(dash, row, s, `📅 ${getFiscalYearLabel(fy)} (${fyGroups[fy].length} ผู้ตอบ)`);
    row += blockHeight(s) + 2;
  });

  // ── ความคิดเห็นทั้งหมด ──
  sectionHeader(dash, row, '💬 ความคิดเห็น / ข้อเสนอแนะ (ล่าสุด 30 รายการ)'); row++;
  setRow(dash, row, 1, 4,
    [['วันที่', 'ปีงบฯ', 'ประเภท', 'ความคิดเห็น']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;
  rows.filter(r=>r[25]&&r[25].toString().trim()).slice(-30).reverse().forEach((r, i) => {
    let ds=''; try{ ds=Utilities.formatDate(new Date(r[0]),'Asia/Bangkok','dd/MM/yyyy'); }catch(e){}
    const fy = getFiscalYear(r[0]) || '-';
    const cr = dash.getRange(row, 1, 1, 4);
    cr.setValues([[ds, fy, r[2]||'-', r[25]||'']]);
    cr.getCell(1,4).setWrap(true);
    if (i%2===0) cr.setBackground('#f9fafb');
    dash.setRowHeight(row, 30);
    row++;
  });

  SpreadsheetApp.getUi().alert(
    '✅ สร้าง Dashboard เสร็จแล้ว!\n\n' +
    '📊 รวม: ' + rows.length + ' ผู้ตอบ\n' +
    '📅 ปีงบฯ ที่พบ: ' + fyList.join(', ') + '\n' +
    '⭐ คะแนนเฉลี่ยรวม: ' + overall.overallAvg.toFixed(2) + '/5.00\n' +
    '😊 ความพึงพอใจ: ' + overall.satPct.toFixed(1) + '%\n\n' +
    'ดูได้ที่ sheet "📊 Dashboard"'
  );
}

// ===== สร้าง Sheet แยกรายปีงบประมาณ =====
function สร้าง_Dashboard_รายปี() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = DATA_SHEET_NAME ? ss.getSheetByName(DATA_SHEET_NAME) : ss.getSheets().find(s=>!s.getName().startsWith('📅')&&s.getName()!=='📊 Dashboard');

  if (!dataSheet) { SpreadsheetApp.getUi().alert('ไม่พบ Sheet ข้อมูล'); return; }

  const allData = dataSheet.getDataRange().getValues();
  const rows    = allData.slice(1).filter(r => r[0]);

  // จัดกลุ่มตามปีงบประมาณ
  const fyGroups = {};
  rows.forEach(r => {
    const fy = getFiscalYear(r[0]);
    if (!fy) return;
    if (!fyGroups[fy]) fyGroups[fy] = [];
    fyGroups[fy].push(r);
  });
  const fyList = Object.keys(fyGroups).map(Number).sort((a,b)=>b-a);

  if (fyList.length === 0) {
    SpreadsheetApp.getUi().alert('ไม่พบข้อมูลที่มี Timestamp ถูกต้อง');
    return;
  }

  let created = [];
  fyList.forEach(fy => {
    const sheetName = '📅 ' + fy;
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) { sheet.clear(); sheet.clearFormats(); }
    else        { sheet = ss.insertSheet(sheetName); }
    sheet.setTabColor('#059669');

    sheet.setColumnWidth(1, 280);
    [2,3,4,5].forEach(c => sheet.setColumnWidth(c, 130));

    let row = 1;

    // Title
    setRow(sheet, row, 1, 5,
      [['📅 Dashboard ความพึงพอใจ — ' + getFiscalYearLabel(fy)]],
      { bg:'#047857', color:'#ffffff', size:14, bold:true, align:'center', height:44, merge:true });
    row++;
    setRow(sheet, row, 1, 5,
      [['หน่วยงานวิสัญญีพยาบาล โรงพยาบาลสกลนคร  |  อัปเดต: ' +
        Utilities.formatDate(new Date(),'Asia/Bangkok','dd/MM/yyyy HH:mm น.')]],
      { bg:'#d1fae5', color:'#065f46', size:10, align:'center', height:22, merge:true });
    row += 2;

    const s = calcStats(fyGroups[fy]);
    writeStatsBlock(sheet, row, s, '📋 สรุปภาพรวม ' + getFiscalYearLabel(fy));
    row += blockHeight(s) + 2;

    // ความคิดเห็นรายปีงบฯ
    sectionHeader(sheet, row, '💬 ความคิดเห็น / ข้อเสนอแนะ'); row++;
    setRow(sheet, row, 1, 3,
      [['วันที่', 'ประเภท', 'ความคิดเห็น']],
      { bg:'#f3f4f6', bold:true, align:'center', height:28 });
    row++;
    const fyComments = fyGroups[fy].filter(r=>r[25]&&r[25].toString().trim());
    fyComments.reverse().forEach((r, i) => {
      let ds=''; try{ ds=Utilities.formatDate(new Date(r[0]),'Asia/Bangkok','dd/MM/yyyy'); }catch(e){}
      const cr = sheet.getRange(row, 1, 1, 3);
      cr.setValues([[ds, r[2]||'-', r[25]||'']]);
      cr.getCell(1,3).setWrap(true);
      if (i%2===0) cr.setBackground('#f0fdf4');
      sheet.setRowHeight(row, 30);
      row++;
    });
    if (fyComments.length === 0) {
      sheet.getRange(row,1).setValue('ไม่มีความคิดเห็นในปีนี้').setFontColor('#94a3b8');
    }

    created.push(sheetName + ' (' + fyGroups[fy].length + ' ผู้ตอบ, ' + s.satPct.toFixed(1) + '%)');
  });

  ss.setActiveSheet(ss.getSheetByName('📅 ' + fyList[0]));
  SpreadsheetApp.getUi().alert(
    '✅ สร้าง Sheet รายปีงบประมาณเสร็จแล้ว!\n\n' +
    created.map(s=>'  • '+s).join('\n')
  );
}

// ===== เขียนบล็อกสถิติลง sheet =====
function writeStatsBlock(sheet, startRow, s, title) {
  let row = startRow;

  sectionHeader(sheet, row, title); row++;

  // KPI summary
  setRow(sheet, row, 1, 5,
    [['จำนวนผู้ตอบ', 'คะแนนเฉลี่ยรวม', '% ความพึงพอใจ', 'เป้าหมาย', 'ผลการประเมิน']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;

  const kpi = sheet.getRange(row, 1, 1, 5);
  kpi.setValues([[
    s.n + ' คน',
    s.overallAvg.toFixed(2) + '/5.00',
    s.satPct.toFixed(1) + '%',
    '90%',
    s.satPct >= 90 ? '✅ บรรลุเป้าหมาย' : '❌ ต่ำกว่าเป้า'
  ]]);
  kpi.setHorizontalAlignment('center').setFontWeight('bold').setFontSize(13);
  kpi.getCell(1,5).setFontColor(s.satPct>=90?'#059669':'#dc2626');
  sheet.setRowHeight(row, 36); row += 2;

  // คะแนนรายข้อ
  sectionHeader(sheet, row, '📊 คะแนนเฉลี่ยแต่ละหัวข้อ (คะแนนเต็ม 5.00)'); row++;
  setRow(sheet, row, 1, 4,
    [['หัวข้อ', 'คะแนนเฉลี่ย', 'ระดับ', 'กราฟ']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;

  s.qAvg.forEach((avg, i) => {
    const level = avg>=4.5?'ดีเยี่ยม':avg>=3.5?'ดี':avg>=2.5?'ปานกลาง':'พอใช้';
    const bars  = '■'.repeat(Math.round(avg/5*10))+'□'.repeat(10-Math.round(avg/5*10));
    const c     = avg>=4.5?'#059669':avg>=3.5?'#2563eb':'#d97706';
    const r     = sheet.getRange(row, 1, 1, 4);
    r.setValues([[Q_LABELS[i], avg.toFixed(2), level, bars]]);
    r.getCell(1,2).setHorizontalAlignment('center').setFontWeight('bold');
    r.getCell(1,3).setHorizontalAlignment('center').setFontColor(c);
    r.getCell(1,4).setFontColor(c).setFontFamily('Courier New');
    if (i%2===0) r.setBackground('#f9fafb');
    sheet.setRowHeight(row, 26); row++;
  });
  row++;

  // การกระจายคะแนน
  sectionHeader(sheet, row, '🎯 การกระจายตัวของคะแนน'); row++;
  setRow(sheet, row, 1, 3,
    [['ระดับ', 'จำนวน (ครั้ง)', 'สัดส่วน (%)']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;
  const distLabels = ['ควรปรับปรุง (1)','พอใช้ (2)','ปานกลาง (3)','ดี (4)','ดีเยี่ยม (5)'];
  const distColors = ['#ef4444','#f97316','#f59e0b','#3b82f6','#10b981'];
  const totalDist  = s.dist.reduce((a,b)=>a+b,0);
  distLabels.forEach((label, i) => {
    const pct = totalDist ? (s.dist[i]/totalDist*100).toFixed(1) : '0';
    const dr  = sheet.getRange(row, 1, 1, 3);
    dr.setValues([[label, s.dist[i], pct+'%']]);
    dr.getCell(1,1).setFontColor(distColors[i]).setFontWeight('bold');
    dr.getCell(1,2).setHorizontalAlignment('center');
    dr.getCell(1,3).setHorizontalAlignment('center');
    if (i%2===0) dr.setBackground('#f9fafb');
    sheet.setRowHeight(row, 26); row++;
  });
  row++;

  // แยกตามประเภทผู้ประเมิน
  sectionHeader(sheet, row, '👥 คะแนนแยกตามประเภทผู้ประเมิน'); row++;
  setRow(sheet, row, 1, 3,
    [['ประเภทผู้ประเมิน', 'จำนวน (คน)', 'คะแนนเฉลี่ย']],
    { bg:'#f3f4f6', bold:true, align:'center', height:28 });
  row++;
  Object.entries(s.typeMap).sort((a,b)=>b[1].n-a[1].n).forEach(([type, tm], i) => {
    const avg = tm.cnt ? (tm.sum/tm.cnt).toFixed(2) : '-';
    const tr  = sheet.getRange(row, 1, 1, 3);
    tr.setValues([[type, tm.n+' คน', avg+'/5.00']]);
    tr.getCell(1,2).setHorizontalAlignment('center');
    tr.getCell(1,3).setHorizontalAlignment('center').setFontWeight('bold');
    if (i%2===0) tr.setBackground('#f9fafb');
    sheet.setRowHeight(row, 26); row++;
  });
}

function blockHeight(s) {
  return 3                    // section header + kpi header + kpi values
    + 2                       // gap
    + 1 + 1 + Q_LABELS.length + 1  // per-question section
    + 1 + 1 + 5 + 1          // distribution
    + 1 + 1 + Object.keys(s.typeMap).length; // by type
}

// ===== HELPERS =====
function setRow(sheet, row, col, span, values, opts) {
  const range = sheet.getRange(row, col, 1, span);
  if (opts.merge && span > 1) {
    range.merge();
    range.setValue(values[0][0]); // merged range ต้องใช้ setValue ไม่ใช่ setValues
  } else {
    range.setValues(values);
  }
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
