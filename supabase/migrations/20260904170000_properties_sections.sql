-- 新增物業「所有地段」欄位
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sections text;
