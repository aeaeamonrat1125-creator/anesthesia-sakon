/**
 * satisfaction-backend.gs
 * Backend สำหรับแบบประเมินความพึงพอใจ — วิสัญญีพยาบาล รพ.สกลนคร
 *
 * วิธี deploy:
 *   1. เปิด Google Apps Script ของโปรเจกต์ satisfaction ผู้ป่วย
 *   2. วางโค้ดนี้แทนที่ Code.gs (หรือสร้างไฟล์ใหม่ชื่อ Backend.gs)
 *   3. ตั้งค่า SUPABASE_URL และ SUPABASE_KEY ด้านล่าง
 *   4. Deploy → New deployment → Web App → Execute as: Me, Anyone: Anyone
 *   5. Copy deployment URL → ใส่ใน satisfaction.html (WEBAPP_URL)
 */

// ── CONFIG ────────────────────────────────────────────────
const SUPABASE_URL = 'https://ldwupcvtthufvksjmcpi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkd3VwY3Z0dGh1ZnZrc2ptY3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzMyNTMsImV4cCI6MjA5NTU0OTI1M30.-fCUylreV5vXDhD7DXOAk-RtoknhUmWbzm2EluKOdFM';

// ── HELPERS ───────────────────────────────────────────────
function getFiscalYear(date) {
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return m >= 10 ? y + 544 : y + 543;
}

function saveToSupabase(record) {
  try {
    const res = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/sat_responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(record),
      muteHttpExceptions: true
    });
    Logger.log('Supabase: ' + res.getResponseCode());
  } catch (e) {
    Logger.log('Supabase error: ' + e.message);
  }
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#7c3aed').setFontColor('#fff');
  }
  return sheet;
}

// ── รับข้อมูลจาก satisfaction.html (แบบหน่วยงาน) ────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const now  = new Date();
    const scores = data.scores || Array(10).fill(0);
    const validScores = scores.filter(s => s > 0);
    const avg = validScores.length ? validScores.reduce((a,b)=>a+b,0)/validScores.length : 0;
    const fy  = getFiscalYear(now);

    // บันทึกลง Google Sheets
    const sheet = getOrCreateSheet('แบบหน่วยงาน', [
      'วันที่','หน่วยงาน','ประเภท','เพศ','อายุ',
      'ข้อ1','ข้อ2','ข้อ3','ข้อ4','ข้อ5',
      'ข้อ6','ข้อ7','ข้อ8','ข้อ9','ข้อ10',
      'ความคิดเห็น','คะแนนเฉลี่ย','%พึงพอใจ','ปีงบประมาณ'
    ]);
    sheet.appendRow([
      now, data.dept||'', data.type||'', data.gender||'', data.age||'',
      ...scores,
      data.comment||'', +avg.toFixed(2), +(avg/5*100).toFixed(1), fy
    ]);

    // บันทึกลง Supabase
    saveToSupabase({
      form_type:'staff', dept:data.dept||'', type:data.type||'',
      gender:data.gender||'', age:String(data.age||''),
      s1:scores[0],s2:scores[1],s3:scores[2],s4:scores[3],s5:scores[4],
      s6:scores[5],s7:scores[6],s8:scores[7],s9:scores[8],s10:scores[9],
      score_avg:+avg.toFixed(2), sat_pct:+(avg/5*100).toFixed(1),
      comment:data.comment||'', fiscal_year:fy
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok:true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok:false, error:err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── รับข้อมูลจาก satisfaction-patient.html (ผู้ป่วย) ─────
function submitPatientForm(payload) {
  const now    = new Date();
  const scores = payload.scores || Array(7).fill(0);
  const validScores = scores.filter(s => s > 0);
  const avg  = validScores.length ? validScores.reduce((a,b)=>a+b,0)/validScores.length : 0;
  const fy   = getFiscalYear(now);

  // บันทึกลง Google Sheets
  const sheet = getOrCreateSheet('แบบผู้ป่วย', [
    'วันที่','ประเภทผู้ป่วย','เพศ','อายุ','ประเมินโดยรวม',
    'ข้อ1','ข้อ2','ข้อ3','ข้อ4','ข้อ5','ข้อ6','ข้อ7',
    'ไม่พึงพอใจ1','ข้อ1text','ไม่พึงพอใจ2','ข้อ2text','ไม่พึงพอใจ3','ข้อ3text',
    'ความคิดเห็น','คะแนนเฉลี่ย','%พึงพอใจ','ปีงบประมาณ'
  ]);
  sheet.appendRow([
    now, payload.ptype||'', payload.gender||'', payload.age||'', payload.eval||'',
    ...scores,
    payload.dis1||'', payload.dis1text||'',
    payload.dis2||'', payload.dis2text||'',
    payload.dis3||'', payload.dis3text||'',
    payload.comment||'', +avg.toFixed(2), +(avg/5*100).toFixed(1), fy
  ]);

  // บันทึกลง Supabase
  saveToSupabase({
    form_type:'patient', type:payload.ptype||'', eval:payload.eval||'',
    gender:payload.gender||'', age:String(payload.age||''),
    s1:scores[0],s2:scores[1],s3:scores[2],s4:scores[3],
    s5:scores[4],s6:scores[5],s7:scores[6],
    score_avg:+avg.toFixed(2), sat_pct:+(avg/5*100).toFixed(1),
    dis0:payload.dis0||'',
    dis1:payload.dis1||'', dis1text:payload.dis1text||'',
    dis2:payload.dis2||'', dis2text:payload.dis2text||'',
    dis3:payload.dis3||'', dis3text:payload.dis3text||'',
    comment:payload.comment||'', fiscal_year:fy
  });
}

// ── Sync ข้อมูลเก่าจาก Sheet ไป Supabase (รันครั้งเดียว) ──
function syncHistoryToSupabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Sync แบบหน่วยงาน
  const staffSheet = ss.getSheetByName('แบบหน่วยงาน');
  if (staffSheet) {
    const rows = staffSheet.getDataRange().getValues().slice(1); // skip header
    rows.forEach(r => {
      if (!r[0]) return;
      const scores = r.slice(5,15).map(Number);
      const avg = scores.filter(v=>v>0).reduce((a,b)=>a+b,0) / (scores.filter(v=>v>0).length||1);
      const date = new Date(r[0]);
      saveToSupabase({
        form_type:'staff', dept:r[1]||'', type:r[2]||'',
        gender:r[3]||'', age:String(r[4]||''),
        s1:scores[0],s2:scores[1],s3:scores[2],s4:scores[3],s5:scores[4],
        s6:scores[5],s7:scores[6],s8:scores[7],s9:scores[8],s10:scores[9],
        score_avg:+avg.toFixed(2), sat_pct:+(avg/5*100).toFixed(1),
        comment:r[15]||'', fiscal_year:getFiscalYear(date),
        created_at: date.toISOString()
      });
      Utilities.sleep(100); // ป้องกัน rate limit
    });
    Logger.log('Synced staff: ' + rows.length + ' rows');
  }

  // Sync แบบผู้ป่วย
  const patientSheet = ss.getSheetByName('แบบผู้ป่วย');
  if (patientSheet) {
    const rows = patientSheet.getDataRange().getValues().slice(1);
    rows.forEach(r => {
      if (!r[0]) return;
      const scores = r.slice(5,12).map(Number);
      const avg = scores.filter(v=>v>0).reduce((a,b)=>a+b,0) / (scores.filter(v=>v>0).length||1);
      const date = new Date(r[0]);
      saveToSupabase({
        form_type:'patient', type:r[1]||'', gender:r[2]||'', age:String(r[3]||''),
        eval:r[4]||'',
        s1:scores[0],s2:scores[1],s3:scores[2],s4:scores[3],
        s5:scores[4],s6:scores[5],s7:scores[6],
        score_avg:+avg.toFixed(2), sat_pct:+(avg/5*100).toFixed(1),
        dis1:r[12]||'', dis1text:r[13]||'',
        dis2:r[14]||'', dis2text:r[15]||'',
        dis3:r[16]||'', dis3text:r[17]||'',
        comment:r[18]||'', fiscal_year:getFiscalYear(date),
        created_at: date.toISOString()
      });
      Utilities.sleep(100);
    });
    Logger.log('Synced patient: ' + rows.length + ' rows');
  }
}
