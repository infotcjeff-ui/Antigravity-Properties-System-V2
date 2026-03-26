-- 收租「入數」憑證／截圖（與支票、FPS 影像分欄）
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_collection_bank_in_image text;
