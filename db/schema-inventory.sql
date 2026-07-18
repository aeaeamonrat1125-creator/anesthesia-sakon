-- ============================================================
-- INVENTORY SCHEMA — วิสัญญีพยาบาล รพ.สกลนคร
-- คลังใหญ่โรงพยาบาล → คลังใหญ่วิสัญญี → คลังย่อย
-- ============================================================

-- 1. Master เวชภัณฑ์
CREATE TABLE IF NOT EXISTS supply_items (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barcode      text UNIQUE,
  name         text NOT NULL,
  generic_name text,
  unit         text NOT NULL DEFAULT 'ชิ้น',
  category     text,
  min_stock    int NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_items_barcode ON supply_items (barcode);
CREATE INDEX IF NOT EXISTS idx_supply_items_name    ON supply_items (name);

-- 2. คลังย่อย
CREATE TABLE IF NOT EXISTS sub_warehouses (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  location   text,
  active     boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. รับเข้าคลังใหญ่วิสัญญี
CREATE TABLE IF NOT EXISTS supply_receipts (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_date     date NOT NULL DEFAULT CURRENT_DATE,
  requisition_no   text,
  item_id          uuid REFERENCES supply_items(id) ON DELETE SET NULL,
  barcode_raw      text,
  item_name        text NOT NULL,
  quantity         int NOT NULL CHECK (quantity > 0),
  unit             text,
  lot              text,
  expiry_date      date,
  received_by      text,
  storage_location text,
  notes            text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_date    ON supply_receipts (receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_item    ON supply_receipts (item_id);
CREATE INDEX IF NOT EXISTS idx_receipts_barcode ON supply_receipts (barcode_raw);

-- 4. เบิกออกจากคลังใหญ่ไปคลังย่อย
CREATE TABLE IF NOT EXISTS supply_transfers (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_date      date NOT NULL DEFAULT CURRENT_DATE,
  item_id            uuid REFERENCES supply_items(id) ON DELETE SET NULL,
  barcode_raw        text,
  item_name          text NOT NULL,
  quantity           int NOT NULL CHECK (quantity > 0),
  unit               text,
  lot                text,
  sub_warehouse_id   uuid REFERENCES sub_warehouses(id) ON DELETE SET NULL,
  sub_warehouse_name text,
  requested_by       text,
  issued_by          text,
  notes              text,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_date      ON supply_transfers (transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_item      ON supply_transfers (item_id);
CREATE INDEX IF NOT EXISTS idx_transfers_warehouse ON supply_transfers (sub_warehouse_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE supply_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_warehouses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_receipts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_transfers ENABLE ROW LEVEL SECURITY;

-- supply_items: อ่านได้ทุกคน, แก้ไขได้เฉพาะ auth
CREATE POLICY "si_select" ON supply_items FOR SELECT USING (true);
CREATE POLICY "si_insert" ON supply_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "si_update" ON supply_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "si_delete" ON supply_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- sub_warehouses
CREATE POLICY "sw_select" ON sub_warehouses FOR SELECT USING (true);
CREATE POLICY "sw_insert" ON sub_warehouses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "sw_update" ON sub_warehouses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "sw_delete" ON sub_warehouses FOR DELETE USING (auth.uid() IS NOT NULL);

-- supply_receipts
CREATE POLICY "sr_select" ON supply_receipts FOR SELECT USING (true);
CREATE POLICY "sr_insert" ON supply_receipts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "sr_delete" ON supply_receipts FOR DELETE USING (auth.uid() IS NOT NULL);

-- supply_transfers
CREATE POLICY "st_select" ON supply_transfers FOR SELECT USING (true);
CREATE POLICY "st_insert" ON supply_transfers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "st_delete" ON supply_transfers FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- DEFAULT คลังย่อย
-- ============================================================

INSERT INTO sub_warehouses (name, location, sort_order) VALUES
  ('คลังย่อย OR 1',          'ห้องผ่าตัด 1',     1),
  ('คลังย่อย OR 2',          'ห้องผ่าตัด 2',     2),
  ('คลังย่อย OR 3',          'ห้องผ่าตัด 3',     3),
  ('คลังย่อยห้องพักฟื้น',     'ห้องพักฟื้น',      4),
  ('คลังย่อยห้องเตรียมยา',    'ห้องเตรียมยา',     5),
  ('คลังย่อยห้องคลอด',        'ห้องคลอด',         6),
  ('คลังย่อยฉุกเฉิน',         'ห้องฉุกเฉิน',      7),
  ('คลังย่อยสำรองเวรดึก',     'เวรดึก / on-call', 8)
ON CONFLICT (name) DO NOTHING;
