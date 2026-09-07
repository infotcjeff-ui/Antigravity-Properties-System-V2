-- Hotfix: cleanup_stale_property_view_sessions 在 CTE chain 中 property_id 失去型別推斷，
-- 變成 text = uuid 比較錯誤。加上 ::uuid 顯式 cast 解決。

CREATE OR REPLACE FUNCTION cleanup_stale_property_view_sessions(
    p_timeout_seconds integer DEFAULT 120
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_threshold timestamptz := now() - make_interval(secs => p_timeout_seconds);
    v_affected integer;
BEGIN
    WITH stale AS (
        DELETE FROM property_view_sessions
        WHERE last_seen_at < v_threshold
        RETURNING property_id
    ),
    grouped AS (
        SELECT property_id::uuid AS property_id, COUNT(*)::integer AS cnt
        FROM stale
        GROUP BY property_id
    ),
    updated AS (
        UPDATE property_views pv
        SET live_count = GREATEST(pv.live_count - g.cnt, 0),
            updated_at = now()
        FROM grouped g
        WHERE pv.property_id = g.property_id
        RETURNING pv.property_id
    )
    SELECT COUNT(*) INTO v_affected FROM updated;

    RETURN COALESCE(v_affected, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_property_view_sessions(integer)
    TO service_role;
