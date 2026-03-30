-- 現時租客檔案欄位與 proprietors / 新增業主表單對齊

ALTER TABLE current_tenants ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE current_tenants ADD COLUMN IF NOT EXISTS english_name text;
ALTER TABLE current_tenants ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE current_tenants ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE current_tenants ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE current_tenants ADD COLUMN IF NOT EXISTS br_number text;

COMMENT ON COLUMN current_tenants.code IS '業主代碼格式之識別碼（與新增業主表單一致）';
COMMENT ON COLUMN current_tenants.english_name IS '公司英文名稱';
COMMENT ON COLUMN current_tenants.short_name IS '簡稱';
COMMENT ON COLUMN current_tenants.type IS '業主性質：company | individual';
COMMENT ON COLUMN current_tenants.category IS '擁有人類別（與 proprietors.category 相同枚舉）';
COMMENT ON COLUMN current_tenants.br_number IS 'BR Number / 商業登記號碼';
