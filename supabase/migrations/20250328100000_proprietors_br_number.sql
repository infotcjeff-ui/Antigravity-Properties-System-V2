-- 業主 BR Number（商業登記等）持久化欄位
ALTER TABLE proprietors ADD COLUMN IF NOT EXISTS br_number TEXT;

COMMENT ON COLUMN proprietors.br_number IS 'BR Number / 商業登記號碼';
