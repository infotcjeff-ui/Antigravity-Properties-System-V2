-- 用 Supabase pg_cron 排程清理過期的 property_view_sessions
-- 每分鐘刪除超過 120 秒沒心跳的 session，並同步 property_views.live_count
-- 注意：需先在 Supabase Dashboard 啟用 pg_cron extension

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 排程：每分鐘執行
SELECT cron.schedule(
    'cleanup-stale-property-view-sessions',
    '* * * * *',
    $$SELECT cleanup_stale_property_view_sessions(120);$$
);

-- 若要移除排程：
-- SELECT cron.unschedule('cleanup-stale-property-view-sessions');
