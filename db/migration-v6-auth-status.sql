-- ============================================================
-- MIGRATION V6 — ระบบ Admin อนุมัติผู้ใช้งาน
-- รัน SQL Editor ใน Supabase ครั้งเดียว
-- ============================================================

-- 1. เพิ่ม column ใน profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status   text    NOT NULL DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. ผู้ใช้ที่มีอยู่เดิม → approve อัตโนมัติ (ไม่ต้องรออนุมัติย้อนหลัง)
UPDATE profiles SET status = 'approved' WHERE status = 'pending';

-- 3. ตั้ง Admin คนแรก — เปลี่ยน email ให้ตรงกับบัญชีหัวหน้า
UPDATE profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'aeae.amonrat1125@gmail.com' LIMIT 1
);

-- ============================================================
-- 4. RLS — อ่านได้เฉพาะตัวเอง หรือ Admin อ่านได้ทุกคน
-- ============================================================

-- ลบ policy เดิมถ้ามี
DROP POLICY IF EXISTS "profiles_select"       ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Policy ใหม่
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- ============================================================
-- 5. RPC — Admin เปลี่ยน status ผู้ใช้ (SECURITY DEFINER = bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION admin_set_user_status(target_id uuid, new_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_row json;
BEGIN
  -- ตรวจสอบ caller เป็น admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: ต้องเป็น Admin';
  END IF;

  -- ตรวจสอบค่า status ที่อนุญาต
  IF new_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE profiles SET status = new_status WHERE id = target_id;
  SELECT row_to_json(p) INTO result_row FROM profiles p WHERE p.id = target_id;
  RETURN result_row;
END;
$$;

-- ============================================================
-- 6. RPC — Admin ดูรายชื่อผู้ใช้ทั้งหมด (bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id            uuid,
  full_name     text,
  nickname      text,
  user_position text,
  phone         text,
  email         text,
  status        text,
  is_admin      boolean,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.full_name, p.nickname, p.position, p.phone,
    u.email,
    p.status, p.is_admin, p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY
    CASE p.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
    p.created_at DESC;
END;
$$;

-- ============================================================
-- หมายเหตุ: ตั้ง Admin เพิ่มเติมได้ด้วย:
--   UPDATE profiles SET is_admin = true
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'xxx@xxx.com');
-- ============================================================
