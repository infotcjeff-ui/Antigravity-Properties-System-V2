-- 收租／交租記錄：所選物業地段（對應 properties.lot_index 中之一段）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot text;
