-- 收租記錄欄位（rent_out 表單）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_tenant_name text;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_date timestamptz;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_amount numeric;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_payment_method text;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_cheque_bank text;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_cheque_number text;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_cheque_image text;

-- 子物業（掛於主物業下）
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parent_property_id uuid REFERENCES properties(id);

CREATE INDEX IF NOT EXISTS idx_properties_parent_property_id ON properties(parent_property_id);
