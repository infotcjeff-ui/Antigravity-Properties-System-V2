-- Hotfix: cleanup_stale_property_view_sessions 改用 TEMP TABLE + LOOP，
-- 徹底繞過 CTE chain property_id 型別推斷丟失問題（text = uuid）

CREATE OR REPLACE FUNCTION cleanup_stale_property_view_sessions(
    p_timeout_seconds integer DEFAULT 120
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_threshold timestamptz := now() - make_interval(secs => p_timeout_seconds);
    v_total integer := 0;
    r record;
BEGIN
    -- 1) 用 TEMP TABLE 彙整受影響的 sessions（明確型別：property_id 繼承自原表 = uuid）
    CREATE TEMP TABLE _stale_sessions ON COMMIT DROP AS
        SELECT property_id, COUNT(*)::integer AS cnt
        FROM property_view_sessions
        WHERE last_seen_at < v_threshold
        GROUP BY property_id;

    -- 2) 刪除所有過期 sessions
    DELETE FROM property_view_sessions WHERE last_seen_at < v_threshold;

    -- 3) 逐筆更新 live_count（明確型別比對，繞過 CTE 推斷）
    FOR r IN SELECT property_id, cnt FROM _stale_sessions LOOP
        UPDATE property_views
        SET live_count = GREATEST(live_count - r.cnt, 0),
            updated_at = now()
        WHERE property_id = r.property_id;
        v_total := v_total + 1;
    END LOOP;

    RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_property_view_sessions(integer)
    TO service_role;
