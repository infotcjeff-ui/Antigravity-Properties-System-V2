-- 新增出租合約按金支票收據號碼欄位
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_receipt_number text;
