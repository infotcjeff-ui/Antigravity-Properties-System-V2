-- 收／交租記錄：連結合約編號、非支票付款之收據號碼
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_contract_number text;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_receipt_number text;
