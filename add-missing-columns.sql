-- ========================================
-- 在 Supabase Dashboard > SQL Editor 中執行
-- ========================================

-- 添加缺失的列到 rents 表

-- 1. 添加 rent_property_lot 列（地段，用於存儲選中的地段列表）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot TEXT;

-- 2. 添加 rent_property_lot_standalone 列（獨立地段標記）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot_standalone BOOLEAN;

-- 3. 驗證列已添加成功
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'rents'
AND column_name IN ('rent_property_lot', 'rent_property_lot_partial', 'rent_property_lot_standalone')
ORDER BY column_name;