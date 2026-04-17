-- 收租／交租記錄：所選之物業地段（可多選，格式為 JSON 陣列如 ["地段A","地段B"]）
-- 相容原有 text 欄位：自動解析 JSON 陣列或逗號分隔字串
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot_standalone boolean;

COMMENT ON COLUMN rents.rent_property_lot IS '收租／交租記錄所選之物業地段。格式：JSON 陣列（如 ["地段A","地段B"]）';
COMMENT ON COLUMN rents.rent_property_lot_standalone IS '選中地段是否為「單獨」模式（顯示 "(單獨)" 後綴）';
