-- =====================================================================
-- LIFF Login — เพิ่ม line_user_id ใน profiles
-- รัน 1 ครั้งใน Supabase SQL Editor
-- =====================================================================

-- 1. เพิ่มคอลัมน์ (ไม่ duplicate ถ้ารันซ้ำ)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS line_user_id text;

-- 2. Unique constraint (1 LINE account ต่อ 1 staff เท่านั้น)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_line_user_id_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_line_user_id_key UNIQUE (line_user_id);
  END IF;
END $$;

-- 3. Index สำหรับ lookup เร็ว
CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id
  ON public.profiles(line_user_id)
  WHERE line_user_id IS NOT NULL;

-- ตรวจสอบ
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'line_user_id';
