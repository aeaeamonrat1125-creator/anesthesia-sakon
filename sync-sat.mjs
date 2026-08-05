// sync-sat.mjs — Sync satisfaction data from Google Sheets → Supabase
// รัน: node sync-sat.mjs

const SHEET_PATIENT = '1co7dJtww1gGgSpA9VgxWFjjxPk6SEYE9uUiHvqzcoho';
const SHEET_STAFF   = '1KY98rWXg2ASJCcyhkbHZUE5QXQOmkAVLTOJjvarfOQc';
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

// ── คำนวณปีงบประมาณ ──────────────────────────────────────
function fiscalYear(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 10 ? y + 543 : y + 542;
}

// ── ดึง CSV จาก Google Sheets ────────────────────────────
async function fetchCSV(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for sheet ${sheetId}`);
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
  const d  = new Date(ts);
  if (isNaN(d)) return null;
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
//      5-14=Q1-Q10, 15=comment
function parseStaffRow(r) {
  const ts = r[0];
  const d  = new Date(ts);
  if (isNaN(d)) return null;
  const scores = [r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14]].map(parseScore);
  const valid  = scores.filter(s => s !== null);
  const avg    = valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : 0;
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
    comment:     r[15]||'',
    fiscal_year: fiscalYear(ts)
  };
}

// ── MAIN ──────────────────────────────────────────────────
async function sync(sheetId, parser, label) {
  console.log(`\n📥 ดึงข้อมูล ${label}...`);
  let csv;
  try { csv = await fetchCSV(sheetId); }
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
  console.log('🔄 Sync Google Sheets → Supabase sat_responses\n');
  const p = await sync(SHEET_PATIENT, parsePatientRow, 'แบบประเมินผู้ป่วย');
  const s = await sync(SHEET_STAFF,   parseStaffRow,   'แบบประเมินหน่วยงาน');
  console.log(`\n✅ เสร็จสิ้น: รวม ${p+s} rows`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
