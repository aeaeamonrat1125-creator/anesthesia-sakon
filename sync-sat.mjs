// sync-sat.mjs — Sync satisfaction data from Google Sheets → Supabase
// รัน: node sync-sat.mjs

const SHEET_PATIENT      = '1co7dJtww1gGgSpA9VgxWFjjxPk6SEYE9uUiHvqzcoho';
const SHEET_STAFF        = '1KY98rWXg2ASJCcyhkbHZUE5QXQOmkAVLTOJjvarfOQc';
const SHEET_STAFF_TAB    = 'Form Responses 1';
const SB_URL = 'https://ldwupcvtthufvksjmcpi.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkd3VwY3Z0dGh1ZnZrc2ptY3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzMyNTMsImV4cCI6MjA5NTU0OTI1M30.-fCUylreV5vXDhD7DXOAk-RtoknhUmWbzm2EluKOdFM';

// ── แปลงคะแนน "มากที่สุด (5)" → 5 ──────────────────────
function parseScore(text) {
  if (!text) return null;
  const m = String(text).match(/\((\d+)\)/);
  if (m) return parseInt(m[1]);
  const n = parseFloat(text);
  return isNaN(n) ? null : n;
}

// ── แปลงวันที่ (mode: 'ddmm' บังคับ DD/MM/YYYY | 'auto' ตามปกติ) ──
function parseDate(ts, mode='auto') {
  if (!ts) return null;
  // DD/MM/YYYY, HH:MM:SS — parse เอง
  const m = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) {
    const [,d1,d2,year,hh,mm,ss] = m;
    let day, month;
    if (mode === 'ddmm') {
      day = d1; month = d2; // บังคับ DD/MM
    } else {
      // ถ้า d1 > 12 ต้องเป็น DD แน่ๆ (ไม่มีเดือน 13+)
      day   = parseInt(d1) > 12 ? d1 : d2;
      month = parseInt(d1) > 12 ? d2 : d1;
    }
    return new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${hh.padStart(2,'0')}:${mm}:${ss}`);
  }
  // MM/DD/YYYY HH:MM:SS (no comma)
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}

// ── คำนวณปีงบประมาณ ──────────────────────────────────────
function fiscalYear(dateStr) {
  const d = parseDate(dateStr);
  if (!d || isNaN(d)) return null;
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 10 ? y + 543 : y + 542;
}

// ── ดึง CSV จาก Google Sheets (ใช้ gviz ซึ่งทำงานกับ public sheets) ──
async function fetchCSV(sheetId, sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  const url  = sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : `${base}&gid=0`;
  const res  = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Parse CSV (รองรับ quoted fields) ─────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0];
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const fields = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  });
}

// ── Insert batch ไป Supabase ──────────────────────────────
async function insertBatch(rows) {
  const res = await fetch(`${SB_URL}/rest/v1/sat_responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  return rows.length;
}

// ── Parse แบบผู้ป่วย ──────────────────────────────────────
// col: 0=Timestamp, 1=ผู้ตอบ(type), 2=ประเภทผู้ป่วย(eval), 3=เพศ, 4=อายุ
//      5-11=Q1-Q7, 12=dis1, 13=dis1text, 14=dis2, 15=dis2text, 16=dis3, 17=dis3text, 18=comment
function parsePatientRow(r) {
  const ts = r[0];
  const d  = parseDate(ts);
  if (!d || isNaN(d)) return null;
  const scores = [r[5],r[6],r[7],r[8],r[9],r[10],r[11]].map(parseScore);
  const valid  = scores.filter(s => s !== null);
  const avg    = valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : 0;
  return {
    form_type:   'patient',
    created_at:  d.toISOString(),
    type:        r[1]||'',
    eval:        r[2]||'',
    gender:      r[3]||'',
    age:         String(r[4]||''),
    s1:scores[0],s2:scores[1],s3:scores[2],s4:scores[3],
    s5:scores[4],s6:scores[5],s7:scores[6],
    score_avg:   +avg.toFixed(2),
    sat_pct:     +(avg/5*100).toFixed(1),
    dis1:        r[12]||'', dis1text: r[13]||'',
    dis2:        r[14]||'', dis2text: r[15]||'',
    dis3:        r[16]||'', dis3text: r[17]||'',
    comment:     r[18]||'',
    fiscal_year: fiscalYear(ts)
  };
}

// ── Parse แบบหน่วยงาน ─────────────────────────────────────
// col: 0=Timestamp, 1=หน่วยงาน(dept), 2=ประเภท(type), 3=เพศ, 4=อายุ
//      5=Q1text, 6=Q1score, 7=Q2text, 8=Q2score, ... (score ที่ col คู่)
//      25=comment
function parseStaffRow(r) {
  const ts = r[0];
  const d  = parseDate(ts, 'ddmm'); // Google Form Thai locale → DD/MM/YYYY
  if (!d || isNaN(d)) return null;
  // scores อยู่ที่ col 6,8,10,12,14,16,18,20,22,24
  const scores = [6,8,10,12,14,16,18,20,22,24].map(i => {
    const v = parseFloat(r[i]);
    return isNaN(v) ? parseScore(r[i-1]) : v; // ใช้ col แปลงค่า ถ้าไม่มีให้ parse text
  });
  const valid  = scores.filter(s => s !== null && s > 0);
  if (!valid.length) return null;
  const avg    = valid.reduce((a,b)=>a+b,0)/valid.length;
  return {
    form_type:   'staff',
    created_at:  d.toISOString(),
    dept:        r[1]||'',
    type:        r[2]||'',
    gender:      r[3]||'',
    age:         String(r[4]||''),
    s1:scores[0],s2:scores[1],s3:scores[2],s4:scores[3],s5:scores[4],
    s6:scores[5],s7:scores[6],s8:scores[7],s9:scores[8],s10:scores[9],
    score_avg:   +avg.toFixed(2),
    sat_pct:     +(avg/5*100).toFixed(1),
    comment:     r[25]||'',
    fiscal_year: fiscalYear(ts)
  };
}

// ── MAIN ──────────────────────────────────────────────────
async function sync(sheetId, parser, label, sheetName) {
  console.log(`\n📥 ดึงข้อมูล ${label}...`);
  let csv;
  try { csv = await fetchCSV(sheetId, sheetName); }
  catch(e) { console.log(`  ⚠️  ไม่สามารถดึง ${label}: ${e.message}`); return 0; }

  const rows    = parseCSV(csv);
  const records = rows.map(parser).filter(Boolean);
  console.log(`  ✅ ได้ ${records.length} rows`);

  let total = 0;
  const BATCH = 50;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i+BATCH);
    const n = await insertBatch(batch);
    total += n;
    process.stdout.write(`  → inserted ${total}/${records.length}\r`);
  }
  console.log(`\n  🎉 sync ${label} สำเร็จ: ${total} rows`);
  return total;
}

async function main() {
  const mode = process.argv[2]; // 'patient' | 'staff' | ไม่ระบุ = ทั้งคู่
  console.log('🔄 Sync Google Sheets → Supabase sat_responses\n');
  let total = 0;
  if (!mode || mode === 'patient')
    total += await sync(SHEET_PATIENT, parsePatientRow, 'แบบประเมินผู้ป่วย');
  if (!mode || mode === 'staff')
    total += await sync(SHEET_STAFF, parseStaffRow, 'แบบประเมินหน่วยงาน', SHEET_STAFF_TAB);
  console.log(`\n✅ เสร็จสิ้น: รวม ${total} rows`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
