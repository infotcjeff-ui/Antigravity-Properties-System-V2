-- 收租／交租記錄：各選中地段是否為「部分地方」（JSON 物件，key 為地段名，value 為 true 表示該地段是部分地方）
-- 例：{ "地段A": true, "地段B": false } 表示地段A有後綴，地段B沒有
-- 注意：原有的 rent_property_lot_standalone 欄位保留不變（新舊相容）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot_partial jsonb;

COMMENT ON COLUMN rents.rent_property_lot_partial IS '各選中地段是否為「部分地方」。格式：JSON 物件（key 為地段名，value 為 true/false）。例：{ "地段A": true, "地段B": false }';
