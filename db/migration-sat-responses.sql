-- ตาราง sat_responses: เก็บข้อมูลแบบประเมินความพึงพอใจ (หน่วยงาน + ผู้ป่วย)
-- รัน query นี้ใน Supabase SQL Editor ครั้งเดียว

CREATE TABLE IF NOT EXISTS sat_responses (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  form_type    TEXT        NOT NULL DEFAULT 'staff', -- 'staff' | 'patient'
  fiscal_year  INTEGER,                               -- ปีงบประมาณ (พ.ศ.)

  -- ข้อมูลผู้ตอบ
  dept         TEXT,   -- หน่วยงาน (staff form)
  type         TEXT,   -- ประเภทผู้ตอบ / ประเภทผู้ป่วย
  gender       TEXT,
  age          TEXT,
  eval         TEXT,   -- ประเมินโดยรวม (patient form)

  -- คะแนนรายข้อ (1-5)
  s1  NUMERIC(4,2), s2  NUMERIC(4,2), s3  NUMERIC(4,2),
  s4  NUMERIC(4,2), s5  NUMERIC(4,2), s6  NUMERIC(4,2),
  s7  NUMERIC(4,2), s8  NUMERIC(4,2), s9  NUMERIC(4,2),
  s10 NUMERIC(4,2),

  -- สรุปคะแนน
  score_avg    NUMERIC(5,2),  -- คะแนนเฉลี่ย
  sat_pct      NUMERIC(5,1),  -- % ความพึงพอใจ

  -- ความคิดเห็น
  comment      TEXT,

  -- ข้อมูลเฉพาะแบบผู้ป่วย (ความไม่พึงพอใจ)
  dis0     TEXT,
  dis1     TEXT, dis1text TEXT,
  dis2     TEXT, dis2text TEXT,
  dis3     TEXT, dis3text TEXT
);

-- Index สำหรับ query ตาม fiscal_year และ form_type
CREATE INDEX IF NOT EXISTS idx_sat_fiscal   ON sat_responses(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_sat_type     ON sat_responses(form_type);
CREATE INDEX IF NOT EXISTS idx_sat_created  ON sat_responses(created_at DESC);

-- Row Level Security: อ่านได้ทุกคน (public dashboard), เขียนได้ทุกคน (จาก form)
ALTER TABLE sat_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sat_responses"
  ON sat_responses FOR SELECT USING (true);

CREATE POLICY "Anyone insert sat_responses"
  ON sat_responses FOR INSERT WITH CHECK (true);

-- View: สรุปรายปีงบประมาณ (ใช้ใน dashboard)
CREATE OR REPLACE VIEW sat_summary AS
SELECT
  fiscal_year,
  form_type,
  COUNT(*)                        AS n,
  ROUND(AVG(score_avg)::NUMERIC, 2) AS avg_score,
  ROUND(AVG(sat_pct)::NUMERIC, 1)   AS avg_pct,
  ROUND(AVG(CASE WHEN form_type='staff' THEN sat_pct END)::NUMERIC,1) AS staff_pct,
  ROUND(AVG(CASE WHEN form_type='patient' THEN sat_pct END)::NUMERIC,1) AS patient_pct
FROM sat_responses
GROUP BY fiscal_year, form_type
ORDER BY fiscal_year DESC, form_type;
