-- 出租合約按金改為與付款方式一致的下拉儲存
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_payment_method TEXT;
