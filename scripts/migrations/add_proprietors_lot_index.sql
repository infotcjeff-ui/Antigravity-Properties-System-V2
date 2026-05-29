-- =============================================
-- 新增 proprietors.lot_index 及 id_number 欄位
-- 在 Supabase SQL Editor 中執行此腳本
-- =============================================

-- 1. 新增地段欄位
ALTER TABLE proprietors ADD COLUMN IF NOT EXISTS lot_index TEXT;

-- 2. 新增身份證號碼欄位
ALTER TABLE proprietors ADD COLUMN IF NOT EXISTS id_number TEXT;

-- 3. 重建 RLS 政策
DROP POLICY IF EXISTS "proprietors_all_anon" ON proprietors;
CREATE POLICY "proprietors_all_anon" ON proprietors
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. 測試查詢
SELECT id, name, code, lot_index, id_number FROM proprietors LIMIT 5;
