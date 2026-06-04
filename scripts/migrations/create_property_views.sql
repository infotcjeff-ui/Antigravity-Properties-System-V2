-- =============================================
-- 建立 property_views 資料表（瀏覽次數統計）
-- 在 Supabase SQL Editor 中執行此腳本
-- =============================================

-- 1. 建立資料表
CREATE TABLE IF NOT EXISTS property_views (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    property_id TEXT NOT NULL UNIQUE,
    view_count INTEGER NOT NULL DEFAULT 0,
    live_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_property_views_property_id ON property_views (property_id);

-- 3. 重建 RLS 政策（允許所有操作）
DROP POLICY IF EXISTS "property_views_all_anon" ON property_views;
CREATE POLICY "property_views_all_anon" ON property_views
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. 啟用 RLS（如尚未啟用）
ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;

-- 5. 如有需要，可建立 RPC 函式（加速遞增）
-- 此函式使用 upsert 確保 atomic increment
CREATE OR REPLACE FUNCTION increment_property_views(p_property_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO property_views (property_id, view_count, live_count)
    VALUES (p_property_id, 1, 1)
    ON CONFLICT (property_id) DO UPDATE SET
        view_count = property_views.view_count + 1,
        live_count = property_views.live_count + 1,
        updated_at = NOW();
END;
$$;
