-- 收租/交租記錄：新增付款日期欄位（入數時填寫）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_payment_date timestamptz;
