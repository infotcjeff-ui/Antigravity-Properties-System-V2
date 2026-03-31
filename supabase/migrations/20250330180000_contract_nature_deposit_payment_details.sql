-- 合約記錄：合約性質、按金付款明細（與收／交租付款方式區塊一致）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_contract_nature TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_contract_nature TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_bank TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_number TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_cheque_image TEXT;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_payment_date TIMESTAMPTZ;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_deposit_bank_in_image TEXT;
