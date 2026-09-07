-- 出租頁瀏覽統計：sessions 表 + 清理 RPC
-- 此 migration 假設 property_views 表已存在（dashboard 手動建立），
-- 若尚未建立請先建立：
--   CREATE TABLE property_views (
--     property_id uuid PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
--     view_count integer NOT NULL DEFAULT 0,
--     live_count integer NOT NULL DEFAULT 0,
--     updated_at timestamptz NOT NULL DEFAULT now()
--   );

-- 1) 新增 property_view_sessions 表：每個瀏覽分頁/分頁一個 session
CREATE TABLE IF NOT EXISTS property_view_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    session_token text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (property_id, session_token)
);

CREATE INDEX IF NOT EXISTS idx_property_view_sessions_property
    ON property_view_sessions (property_id);

CREATE INDEX IF NOT EXISTS idx_property_view_sessions_last_seen
    ON property_view_sessions (last_seen_at);

-- 2) enter 動作的 RPC：原子化遞增 view_count + live_count + 寫入 session
CREATE OR REPLACE FUNCTION increment_property_views(
    p_property_id uuid,
    p_session_token text,
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (view_count integer, live_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_view_count integer;
    v_live_count integer;
    v_is_new_session boolean := false;
BEGIN
    -- upsert property_views
    INSERT INTO property_views (property_id, view_count, live_count, updated_at)
    VALUES (p_property_id, 1, 1, now())
    ON CONFLICT (property_id) DO UPDATE
        SET view_count = property_views.view_count + 1,
            live_count = property_views.live_count + 1,
            updated_at = now()
    RETURNING property_views.view_count, property_views.live_count
        INTO v_view_count, v_live_count;

    -- upsert session（同一 session_token 同物業只算一次 live_count）
    BEGIN
        INSERT INTO property_view_sessions (property_id, session_token, user_id, last_seen_at)
        VALUES (p_property_id, p_session_token, p_user_id, now());
        v_is_new_session := true;
    EXCEPTION WHEN unique_violation THEN
        UPDATE property_view_sessions
        SET last_seen_at = now(),
            user_id = COALESCE(p_user_id, user_id)
        WHERE property_id = p_property_id
          AND session_token = p_session_token;
    END;

    -- 如果 session 已存在，剛才 property_views 多 +1 的 live_count 要回退
    IF NOT v_is_new_session THEN
        UPDATE property_views
        SET live_count = GREATEST(live_count - 1, 0),
            updated_at = now()
        WHERE property_id = p_property_id
        RETURNING property_views.view_count, property_views.live_count
            INTO v_view_count, v_live_count;
    END IF;

    RETURN QUERY SELECT v_view_count, v_live_count;
END;
$$;

-- 3) heartbeat RPC：刷新 session 的 last_seen_at，回傳當前 live_count
CREATE OR REPLACE FUNCTION heartbeat_property_view(
    p_property_id uuid,
    p_session_token text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_live_count integer;
BEGIN
    UPDATE property_view_sessions
    SET last_seen_at = now()
    WHERE property_id = p_property_id
      AND session_token = p_session_token;

    SELECT live_count INTO v_live_count
    FROM property_views
    WHERE property_id = p_property_id;

    RETURN COALESCE(v_live_count, 0);
END;
$$;

-- 4) leave 動作的 RPC：用 session_token 精確遞減
CREATE OR REPLACE FUNCTION decrement_property_view(
    p_property_id uuid,
    p_session_token text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted boolean;
BEGIN
    DELETE FROM property_view_sessions
    WHERE property_id = p_property_id
      AND session_token = p_session_token
    RETURNING true INTO v_deleted;

    IF v_deleted THEN
        UPDATE property_views
        SET live_count = GREATEST(live_count - 1, 0),
            updated_at = now()
        WHERE property_id = p_property_id
        RETURNING live_count INTO v_deleted;
    END IF;

    RETURN COALESCE(v_deleted::integer, 0);
END;
$$;

-- 5) 清理過期 session 的 RPC：刪除 last_seen_at 超過指定秒數的 session，
--    並重新同步 property_views.live_count
--    建議用 pg_cron 或外部排程呼叫，例如每分鐘：
--    SELECT cleanup_stale_property_view_sessions(120);
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
    -- 先撈出受影響的 property_id
    WITH stale AS (
        DELETE FROM property_view_sessions
        WHERE last_seen_at < v_threshold
        RETURNING property_id
    ),
    grouped AS (
        SELECT property_id, COUNT(*) AS cnt
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

    RETURN v_affected;
END;
$$;

-- 6) RLS：sessions 表只允許 service role 寫入（前端只透過 RPC）
ALTER TABLE property_view_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on property_view_sessions"
    ON property_view_sessions;
CREATE POLICY "Service role full access on property_view_sessions"
    ON property_view_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 7) 授權 anon / authenticated 可呼叫 RPC（前端透過 API route 呼叫）
GRANT EXECUTE ON FUNCTION increment_property_views(uuid, text, uuid)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION heartbeat_property_view(uuid, text)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION decrement_property_view(uuid, text)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_stale_property_view_sessions(integer)
    TO service_role;
