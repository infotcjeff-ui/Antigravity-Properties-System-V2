-- 免租期（交租／收租／合約記錄表單）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_free_period_date timestamptz;
