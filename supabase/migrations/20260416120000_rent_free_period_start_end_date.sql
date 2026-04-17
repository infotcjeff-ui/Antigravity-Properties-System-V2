-- 免租期：改為「開始日期」和「結束日期」兩個欄位（替換原有單一日期欄位）
-- 新增
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_free_period_start_date timestamptz;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_free_period_end_date timestamptz;
-- 將原有單一日期遷移到結束日期（新記錄的結束日期等於原日期，方便遷移歷史數據）
UPDATE rents
SET rent_free_period_end_date = rent_free_period_date
WHERE rent_free_period_date IS NOT NULL
  AND rent_free_period_end_date IS NULL;
-- 原有欄位保留（原代碼可能仍在引用），日後可 ALTER TABLE rents DROP COLUMN IF EXISTS rent_free_period_date;
