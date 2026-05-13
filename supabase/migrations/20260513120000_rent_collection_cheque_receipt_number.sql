-- 收／交租記錄：支票資料新增收據號碼欄位
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_cheque_receipt_number text;
