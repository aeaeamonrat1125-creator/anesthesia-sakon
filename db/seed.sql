-- =====================================================================
-- SEED DATA V2 — ข้อมูลเริ่มต้น
-- รันหลัง schema.sql + policies.sql
-- =====================================================================

-- ---------- KPI 15 ตัว ----------
insert into public.kpis (code, name, description, target, unit, direction, sort_order) values
  ('KPI-01', 'อัตราความครอบคลุมการเยี่ยมก่อนรับบริการวิสัญญี', 'Pre-anesthesia visit coverage', 100, '%', 'higher', 1),
  ('KPI-02', 'อัตราการเยี่ยมหลังรับบริการวิสัญญี', 'Post-anesthesia visit coverage', 80, '%', 'higher', 2),
  ('KPI-03', 'อัตราการเลื่อนผ่าตัดจากความไม่พร้อม', 'Surgery postponement rate', 1, '%', 'lower', 3),
  ('KPI-04', 'อุบัติการณ์การเกิด Aspiration', 'Aspiration incidence', 0, 'ครั้ง', 'lower', 4),
  ('KPI-05', 'อุบัติการณ์การให้ยาระงับความรู้สึกผิดคน', 'Wrong-patient anesthesia incidence', 0, 'ครั้ง', 'lower', 5),
  ('KPI-06', 'อัตราภาวะแทรกซ้อนจากการใส่ท่อช่วยหายใจ', 'Intubation complication rate', 1, '%', 'lower', 6),
  ('KPI-07', 'อุบัติการณ์ผิดพลาดในการให้ยา Anesthetic agent', 'Anesthetic agent error', 0, 'ครั้ง', 'lower', 7),
  ('KPI-08', 'อัตราผู้ป่วยเสียชีวิตในห้องผ่าตัด DOT', 'Death on Table rate', 1, 'ต่อพัน', 'lower', 8),
  ('KPI-09', 'อัตราความครบถ้วน PACU monitoring', 'PACU monitoring completeness', 80, '%', 'higher', 9),
  ('KPI-10', 'อัตราผู้ป่วยย้ายออก PACU ตามเกณฑ์', 'PACU discharge criteria', 95, '%', 'higher', 10),
  ('KPI-11', 'อัตราการเกิด Peripheral neurologic deficit', 'Peripheral neurologic deficit', 0, 'ครั้ง', 'lower', 11),
  ('KPI-12', 'อัตราผู้ป่วยเสียชีวิตใน 48 ชั่วโมง', '48-hr mortality', 0, '%', 'lower', 12),
  ('KPI-13', 'อัตราผู้ป่วยย้ายเข้า ICU โดยไม่ได้วางแผน', 'Unplanned ICU admission', 0, '%', 'lower', 13),
  ('KPI-14', 'อัตราความครบถ้วนเวชระเบียน', 'Medical record completeness', 90, '%', 'higher', 14),
  ('KPI-15', 'ร้อยละความพึงพอใจของผู้รับบริการ', 'Patient satisfaction (เน้นพิเศษ)', 90, '%', 'higher', 15)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  target = excluded.target,
  unit = excluded.unit,
  direction = excluded.direction,
  sort_order = excluded.sort_order;

-- ---------- KPI HISTORY ตัวอย่าง 5 ปี (2564-2568) ----------
-- สำหรับ KPI-15 (ความพึงพอใจ)
insert into public.kpi_history (kpi_id, fiscal_year, value, target, notes)
select id, 2564, 92.30, 90, 'ผ่านเกณฑ์'      from public.kpis where code='KPI-15' union all
select id, 2565, 93.15, 90, 'ผ่านเกณฑ์'      from public.kpis where code='KPI-15' union all
select id, 2566, 94.20, 90, 'ผ่านเกณฑ์'      from public.kpis where code='KPI-15' union all
select id, 2567, 94.85, 90, 'ผ่านเกณฑ์'      from public.kpis where code='KPI-15' union all
select id, 2568, 95.70, 90, 'ผ่านเกณฑ์ ดีขึ้น' from public.kpis where code='KPI-15'
on conflict (kpi_id, fiscal_year) do update set value = excluded.value, notes = excluded.notes;

-- สำหรับ KPI-01 (Pre-anesthesia)
insert into public.kpi_history (kpi_id, fiscal_year, value, target)
select id, 2564, 96.5, 100 from public.kpis where code='KPI-01' union all
select id, 2565, 97.8, 100 from public.kpis where code='KPI-01' union all
select id, 2566, 98.6, 100 from public.kpis where code='KPI-01' union all
select id, 2567, 99.1, 100 from public.kpis where code='KPI-01' union all
select id, 2568, 99.6, 100 from public.kpis where code='KPI-01'
on conflict (kpi_id, fiscal_year) do update set value = excluded.value;

-- สำหรับ KPI-02 (Post-anesthesia)
insert into public.kpi_history (kpi_id, fiscal_year, value, target)
select id, 2564, 94.0, 100 from public.kpis where code='KPI-02' union all
select id, 2565, 95.3, 100 from public.kpis where code='KPI-02' union all
select id, 2566, 96.7, 100 from public.kpis where code='KPI-02' union all
select id, 2567, 98.1, 100 from public.kpis where code='KPI-02' union all
select id, 2568, 99.2, 100 from public.kpis where code='KPI-02'
on conflict (kpi_id, fiscal_year) do update set value = excluded.value;

-- KPI-03 Postponement
insert into public.kpi_history (kpi_id, fiscal_year, value, target)
select id, 2564, 1.20, 1 from public.kpis where code='KPI-03' union all
select id, 2565, 0.95, 1 from public.kpis where code='KPI-03' union all
select id, 2566, 0.80, 1 from public.kpis where code='KPI-03' union all
select id, 2567, 0.75, 1 from public.kpis where code='KPI-03' union all
select id, 2568, 0.60, 1 from public.kpis where code='KPI-03'
on conflict (kpi_id, fiscal_year) do update set value = excluded.value;

-- KPI-04..14 ตัวเลขโดยประมาณ (รอผู้ใช้แก้ค่าจริง)
insert into public.kpi_history (kpi_id, fiscal_year, value, target)
select k.id, y, case when k.direction='higher' then 96+random()*4 else random()*0.8 end, k.target
from public.kpis k cross join generate_series(2564, 2568) as y
where k.code in ('KPI-04','KPI-05','KPI-06','KPI-07','KPI-08','KPI-09','KPI-10','KPI-11','KPI-12','KPI-13','KPI-14')
on conflict (kpi_id, fiscal_year) do nothing;

-- ---------- DOCUMENT TYPES ----------
insert into public.document_types (name, sort_order) values
  ('แนวปฏิบัติ', 1),
  ('คู่มือ', 2),
  ('R2R', 3),
  ('CQI', 4),
  ('งานวิจัย', 5),
  ('CME', 6),
  ('ประกาศ', 7),
  ('อื่นๆ', 99)
on conflict (name) do nothing;

-- ---------- OPERATION STATS 2565-2568 ----------
insert into public.operation_stats (fiscal_year, total_patients, asa, choice, cvt, comorbidities, death_causes, satisfaction)
values
  (2565, 9420,
    '{"ASA1":1820,"ASA2":4350,"ASA3":2410,"ASA4":650,"ASA5":150,"ASA6":40}'::jsonb,
    '{"GA":5230,"RA":2310,"MAC":1480,"Combined":400}'::jsonb,
    '{"Thymectomy":8,"OpenHeart":42,"Pericardial":11,"TEVAR":6,"AAA":9,"EVAR":12}'::jsonb,
    '{"HT":3200,"DM":1450,"Pregnant":520,"RenalInsuff":210,"HeartDisease":880,"Asthma_COPD":640}'::jsonb,
    '{"Cardiac":4,"Bleeding":3,"Sepsis":2,"Respiratory":1,"Other":1}'::jsonb,
    93.15),
  (2566, 9870,
    '{"ASA1":1880,"ASA2":4520,"ASA3":2520,"ASA4":690,"ASA5":160,"ASA6":100}'::jsonb,
    '{"GA":5510,"RA":2390,"MAC":1530,"Combined":440}'::jsonb,
    '{"Thymectomy":10,"OpenHeart":48,"Pericardial":13,"TEVAR":8,"AAA":10,"EVAR":14}'::jsonb,
    '{"HT":3380,"DM":1520,"Pregnant":540,"RenalInsuff":230,"HeartDisease":910,"Asthma_COPD":660}'::jsonb,
    '{"Cardiac":3,"Bleeding":3,"Sepsis":2,"Respiratory":1,"Other":2}'::jsonb,
    94.20),
  (2567, 10410,
    '{"ASA1":1970,"ASA2":4810,"ASA3":2640,"ASA4":720,"ASA5":170,"ASA6":100}'::jsonb,
    '{"GA":5810,"RA":2510,"MAC":1620,"Combined":470}'::jsonb,
    '{"Thymectomy":12,"OpenHeart":55,"Pericardial":15,"TEVAR":10,"AAA":12,"EVAR":17}'::jsonb,
    '{"HT":3520,"DM":1610,"Pregnant":570,"RenalInsuff":250,"HeartDisease":940,"Asthma_COPD":680}'::jsonb,
    '{"Cardiac":3,"Bleeding":2,"Sepsis":2,"Respiratory":1,"Other":2}'::jsonb,
    94.85),
  (2568, 10933,
    '{"ASA1":2050,"ASA2":5060,"ASA3":2730,"ASA4":740,"ASA5":180,"ASA6":173}'::jsonb,
    '{"GA":6100,"RA":2620,"MAC":1700,"Combined":513}'::jsonb,
    '{"Thymectomy":14,"OpenHeart":61,"Pericardial":17,"TEVAR":12,"AAA":13,"EVAR":19}'::jsonb,
    '{"HT":3680,"DM":1690,"Pregnant":600,"RenalInsuff":270,"HeartDisease":970,"Asthma_COPD":700}'::jsonb,
    '{"Cardiac":2,"Bleeding":2,"Sepsis":1,"Respiratory":1,"Other":2}'::jsonb,
    95.70)
on conflict (fiscal_year) do update set
  total_patients = excluded.total_patients,
  asa = excluded.asa,
  choice = excluded.choice,
  cvt = excluded.cvt,
  comorbidities = excluded.comorbidities,
  death_causes = excluded.death_causes,
  satisfaction = excluded.satisfaction;

-- ---------- CONFIG ----------
insert into public.config (key, value) values
  ('org', '{"name":"วิสัญญีพยาบาล โรงพยาบาลสกลนคร","short":"Anesthesia Sakon","staff_count":48}'::jsonb),
  ('current_fy', '2568'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------- ตัวอย่าง EQUIPMENT 3 รายการ ----------
insert into public.equipment (name, brand, model, serial, location, status, received_date, owner) values
  ('Anesthesia Machine', 'Dräger', 'Fabius Plus', 'AM-001', 'OR1', 'ใช้งานได้', '2022-05-01', 'หน่วยงานวิสัญญี'),
  ('Patient Monitor',   'Philips', 'IntelliVue MX450', 'PM-101', 'OR2', 'ใช้งานได้', '2023-01-15', 'หน่วยงานวิสัญญี'),
  ('Defibrillator',     'Mindray', 'BeneHeart D6',     'DF-202', 'PACU', 'ใช้งานได้', '2024-03-10', 'หน่วยงานวิสัญญี')
on conflict do nothing;

-- ---------- ตัวอย่าง ประกาศ ----------
insert into public.announcements (title, content, level) values
  ('เปิดใช้งานระบบใหม่ V2', 'ระบบ Sync ทุกเครื่องแบบ real-time ผ่าน Supabase', 'info')
on conflict do nothing;

-- =====================================================================
-- DONE
-- =====================================================================
