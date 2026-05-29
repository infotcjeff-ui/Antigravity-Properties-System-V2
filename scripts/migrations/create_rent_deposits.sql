-- =============================================
-- 建立 rent_deposits 表（支援多個按金資料）
-- 在 Supabase SQL Editor 中執行此腳本
-- =============================================

-- 0. 先確保 rents 表所有按金欄位都存在
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_received NUMERIC;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_receive_date TIMESTAMPTZ;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_return_date TIMESTAMPTZ;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_return_amount NUMERIC;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_payment_method TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_receipt_number TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_bank TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_number TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_image TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_payment_date TIMESTAMPTZ;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_cheque_actual_payment_date TIMESTAMPTZ;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_receipt_number TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_payment_date TIMESTAMPTZ;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_bank_in_image TEXT;

-- 1. 建立資料表
CREATE TABLE IF NOT EXISTS rent_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_id UUID NOT NULL REFERENCES rents(id) ON DELETE CASCADE,
  deposit_amount NUMERIC,
  payment_method TEXT,
  receipt_number TEXT,
  cheque_bank TEXT,
  cheque_number TEXT,
  cheque_image TEXT,
  cheque_payment_date TIMESTAMPTZ,
  cheque_receipt_number TEXT,
  payment_date TIMESTAMPTZ,
  bank_in_image TEXT,
  receive_date DATE,
  return_date DATE,
  return_amount NUMERIC,
  deposit_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_rent_deposits_rent_id ON rent_deposits(rent_id);

-- 3. 啟用 RLS
ALTER TABLE rent_deposits ENABLE ROW LEVEL SECURITY;

-- 4. 建立 RLS 政策（允許 anon + authenticated 讀寫）
DROP POLICY IF EXISTS "Allow authenticated read/write" ON rent_deposits;
CREATE POLICY "Allow anon read/write" ON rent_deposits
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. 遷移現有按金資料
INSERT INTO rent_deposits (
  rent_id,
  deposit_amount,
  payment_method,
  receipt_number,
  cheque_bank,
  cheque_number,
  cheque_image,
  cheque_payment_date,
  cheque_receipt_number,
  payment_date,
  bank_in_image,
  receive_date,
  return_date,
  return_amount,
  deposit_index
)
SELECT
  id,
  rent_out_deposit_received,
  rent_out_deposit_payment_method,
  rent_out_deposit_receipt_number,
  rent_out_deposit_cheque_bank,
  rent_out_deposit_cheque_number,
  rent_out_deposit_cheque_image,
  rent_out_deposit_cheque_payment_date,
  rent_out_deposit_cheque_receipt_number,
  rent_out_deposit_payment_date,
  rent_out_deposit_bank_in_image,
  rent_out_deposit_receive_date::DATE,
  rent_out_deposit_return_date::DATE,
  rent_out_deposit_return_amount,
  0
FROM rents
WHERE type = 'contract'
  AND (
    rent_out_deposit_received IS NOT NULL
    OR rent_out_deposit_receive_date IS NOT NULL
  )
ON CONFLICT DO NOTHING;

-- 6. 測試查詢
SELECT COUNT(*) as deposit_count FROM rent_deposits;
SELECT COUNT(*) as contract_count FROM rents WHERE type = 'contract';
