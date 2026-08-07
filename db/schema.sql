-- =====================================================================
-- Anesthesia Sakon Nakhon Hospital — Database Schema V2
-- รันใน: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- =====================================================================

-- เปิด extension ที่ต้องใช้
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1) PROFILES — ขยายจาก auth.users
-- =====================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique,
  full_name     text,
  nickname      text,
  position      text,                       -- ตำแหน่ง
  phone         text,
  line_id       text,
  photo_url     text,
  role          text not null default 'staff' check (role in ('admin','staff','viewer')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- เมื่อสร้าง user ใน auth.users → สร้าง row ใน profiles อัตโนมัติ
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 2) KPIS — รายการ KPI 15 ตัว
-- =====================================================================
create table if not exists public.kpis (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,        -- เช่น "KPI-01"
  name        text not null,
  description text,
  target      numeric,                      -- ค่าเป้าหมาย
  unit        text default '%',             -- %, ครั้ง, ราย, ต่อพัน
  direction   text default 'higher' check (direction in ('higher','lower')),
  -- higher = ค่ามากกว่ายิ่งดี, lower = ค่าน้อยกว่ายิ่งดี
  year        int default extract(year from current_date)::int,
  sort_order  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- =====================================================================
-- 3) KPI_HISTORY — ค่าจริงย้อนหลัง 5 ปี
-- =====================================================================
create table if not exists public.kpi_history (
  id          uuid primary key default uuid_generate_v4(),
  kpi_id      uuid references public.kpis(id) on delete cascade,
  fiscal_year int not null,
  value       numeric,
  target      numeric,
  notes       text,
  created_at  timestamptz default now(),
  unique (kpi_id, fiscal_year)
);

-- =====================================================================
-- 4) EQUIPMENT — เครื่องมือ
-- =====================================================================
create table if not exists public.equipment (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  brand         text,
  model         text,
  serial        text,
  location      text,
  status        text default 'ใช้งานได้' check (status in ('ใช้งานได้','รอซ่อม','ซ่อมแล้ว','จำหน่าย')),
  received_date date,
  repair_date   date,
  owner         text,
  notes         text,
  image_url     text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- =====================================================================
-- 5) DAILY_INSPECTIONS — ตรวจสอบเครื่องมือประจำวัน
-- =====================================================================
create table if not exists public.daily_inspections (
  id            uuid primary key default uuid_generate_v4(),
  date          date not null default current_date,
  room          text,                       -- ห้องผ่าตัด เช่น OR1, OR2
  inspector_id  uuid references public.profiles(id),
  items         jsonb default '[]'::jsonb,  -- รายการเครื่อง + สถานะ
  notes         text,
  created_at    timestamptz default now()
);

-- =====================================================================
-- 6) SERVICE_LOGS — บันทึกบริการประจำวัน
-- =====================================================================
create table if not exists public.service_logs (
  id            uuid primary key default uuid_generate_v4(),
  date          date not null default current_date,
  type          text,                       -- ในเวลา/นอกเวลา
  shift         text,                       -- เช้า/บ่าย/ดึก
  location      text,
  recorder_id   uuid references public.profiles(id),
  metrics       jsonb default '{}'::jsonb,  -- จำนวนผู้ป่วย แยกประเภท
  asa           jsonb default '[]'::jsonb,  -- ASA classification
  complications jsonb default '{}'::jsonb,
  drug_box      jsonb default '{}'::jsonb,
  issues        jsonb default '{}'::jsonb,
  photo_url     text,
  notes         text,
  created_at    timestamptz default now()
);

-- =====================================================================
-- 7) SCHEDULE_ENTRIES — ตารางเวร
-- =====================================================================
create table if not exists public.schedule_entries (
  id          uuid primary key default uuid_generate_v4(),
  year_month  text not null,                -- "2569-01"
  team        text,                          -- ทีม 1, ทีม 2, CVT, Vascular, ERCP
  day         int not null,                  -- 1-31
  position    text,                          -- ตำแหน่ง/หน้าที่ในวันนั้น
  nickname    text,                          -- ชื่อเล่นบุคลากร
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists schedule_idx on public.schedule_entries (year_month, team);

-- =====================================================================
-- 8) MEETINGS — คิวประชุมวิชาการ
-- =====================================================================
create table if not exists public.meetings (
  id          uuid primary key default uuid_generate_v4(),
  date        date,
  time        text,
  topic       text not null,
  speaker     text,
  hours       numeric,
  location    text,
  link        text,
  type        text,                          -- ใน รพ./นอก รพ./online
  notes       text,
  created_at  timestamptz default now()
);

-- =====================================================================
-- 9) ACTIVITIES — คิวกิจกรรม
-- =====================================================================
create table if not exists public.activities (
  id          uuid primary key default uuid_generate_v4(),
  date        date,
  name        text not null,
  location    text,
  organizer   text,
  link        text,
  notes       text,
  created_at  timestamptz default now()
);

-- =====================================================================
-- 10) REFERS — คิว Refer ผู้ป่วย
-- =====================================================================
create table if not exists public.refers (
  id            uuid primary key default uuid_generate_v4(),
  date          date,
  patient_code  text,                       -- ไม่เก็บชื่อจริง — รหัส
  from_dept     text,
  to_dept       text,
  reason        text,
  status        text default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- =====================================================================
-- 11) DOCUMENT_TYPES — ประเภทเอกสาร (เพิ่มได้)
-- =====================================================================
create table if not exists public.document_types (
  id        uuid primary key default uuid_generate_v4(),
  name      text unique not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- =====================================================================
-- 12) DOCUMENTS — เอกสารวิชาการ
-- =====================================================================
create table if not exists public.documents (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  type        text,                          -- อ้างอิง document_types.name (free text)
  category    text,
  link        text,
  date        date,
  is_public   boolean not null default false, -- true = แสดงในหน้าหลัก, false = ภายในเท่านั้น
  owner_id    uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- =====================================================================
-- 13) OPERATION_STATS — สถิติการผ่าตัดรายปีงบฯ
-- =====================================================================
create table if not exists public.operation_stats (
  id              uuid primary key default uuid_generate_v4(),
  fiscal_year     int unique not null,
  total_patients  int default 0,
  asa             jsonb default '{}'::jsonb,
  choice          jsonb default '{}'::jsonb,
  cvt             jsonb default '{}'::jsonb,
  comorbidities   jsonb default '{}'::jsonb,
  death_causes    jsonb default '{}'::jsonb,
  satisfaction    numeric,
  notes           text,
  updated_at      timestamptz default now()
);

-- =====================================================================
-- 14) ANNOUNCEMENTS — ประกาศ
-- =====================================================================
create table if not exists public.announcements (
  id        uuid primary key default uuid_generate_v4(),
  title     text not null,
  content   text,
  level     text default 'info' check (level in ('info','warn','urgent')),
  date      date default current_date,
  created_at timestamptz default now()
);

-- =====================================================================
-- 15) CONFIG — key-value singleton
-- =====================================================================
create table if not exists public.config (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

-- =====================================================================
-- updated_at auto trigger (ใช้กับหลายตาราง)
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','kpis','equipment','schedule_entries','refers','operation_stats','config'
  ]) loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end$$;

-- =====================================================================
-- ENABLE REALTIME (Supabase Realtime Channels)
-- ทุกตารางที่ต้อง broadcast event
-- =====================================================================
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.kpis;
alter publication supabase_realtime add table public.kpi_history;
alter publication supabase_realtime add table public.equipment;
alter publication supabase_realtime add table public.daily_inspections;
alter publication supabase_realtime add table public.service_logs;
alter publication supabase_realtime add table public.schedule_entries;
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.refers;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.document_types;
alter publication supabase_realtime add table public.operation_stats;
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.config;

-- =====================================================================
-- DONE — ต่อไปรัน policies.sql แล้วตามด้วย seed.sql
-- =====================================================================
