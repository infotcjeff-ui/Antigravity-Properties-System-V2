-- 新增 phone 欄位至 app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN app_users.phone IS '電話號碼（非必要）';
