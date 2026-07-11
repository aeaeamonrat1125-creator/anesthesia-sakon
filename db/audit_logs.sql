-- ================================================================
-- AUDIT LOG SYSTEM
-- รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. สร้างตาราง audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL   PRIMARY KEY,
  table_name  TEXT        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  record_id   TEXT,                        -- id ของ record ที่เปลี่ยน
  old_data    JSONB,                       -- ข้อมูลเดิม (NULL ถ้า INSERT)
  new_data    JSONB,                       -- ข้อมูลใหม่ (NULL ถ้า DELETE)
  changed_by  UUID,                        -- user_id จาก auth.uid()
  user_email  TEXT,                        -- email (snapshot ณ เวลานั้น)
  ip_address  TEXT,                        -- จาก request headers (ถ้ามี)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index เพื่อ query เร็ว
CREATE INDEX IF NOT EXISTS idx_audit_table    ON audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_logs (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs (created_at DESC);

-- RLS: อ่านได้เฉพาะ authenticated users, ไม่ให้แก้ไข/ลบ
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users can read audit" ON audit_logs FOR SELECT TO authenticated USING (true);

-- ================================================================
-- 2. Trigger Function
-- ================================================================
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old   JSONB;
  v_new   JSONB;
  v_id    TEXT;
  v_email TEXT;
BEGIN
  -- ดึง record id
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_id  := OLD.id::TEXT;
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_id  := NEW.id::TEXT;
    v_old := NULL;
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id  := NEW.id::TEXT;
    -- เก็บเฉพาะ field ที่เปลี่ยน
    SELECT jsonb_object_agg(key, value)
    INTO v_old
    FROM jsonb_each(to_jsonb(OLD))
    WHERE to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;

    SELECT jsonb_object_agg(key, value)
    INTO v_new
    FROM jsonb_each(to_jsonb(NEW))
    WHERE to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
  END IF;

  -- ดึง email จาก profiles (ถ้ามี)
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid() LIMIT 1;

  INSERT INTO audit_logs (table_name, action, record_id, old_data, new_data, changed_by, user_email)
  VALUES (TG_TABLE_NAME, TG_OP, v_id, v_old, v_new, auth.uid(), v_email);

  RETURN NULL; -- AFTER trigger ไม่ต้อง return row
END;
$$;

-- ================================================================
-- 3. ติด Trigger กับตารางที่ต้องการ track
-- ================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'equipment',
    'kpi_history',
    'kpis',
    'service_logs',
    'daily_inspections',
    'nurses',
    'announcements',
    'org_chart',
    'profiles',
    'meetings',
    'activities',
    'documents',
    'operation_stats',
    'line_notify_tokens'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_audit_%1$s ON %1$s;
      CREATE TRIGGER trg_audit_%1$s
      AFTER INSERT OR UPDATE OR DELETE ON %1$s
      FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
    ', t);
  END LOOP;
END;
$$;

-- ================================================================
-- 4. View สำหรับ query ง่าย (optional)
-- ================================================================
CREATE OR REPLACE VIEW audit_logs_view AS
SELECT
  a.id,
  a.table_name,
  a.action,
  a.record_id,
  a.old_data,
  a.new_data,
  a.changed_by,
  COALESCE(a.user_email, p.email, 'ไม่ระบุ') AS display_email,
  COALESCE(p.full_name, p.nickname, a.user_email, 'ไม่ระบุ') AS display_name,
  a.created_at
FROM audit_logs a
LEFT JOIN profiles p ON p.id = a.changed_by
ORDER BY a.created_at DESC;
