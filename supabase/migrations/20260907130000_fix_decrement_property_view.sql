-- Hotfix: 修正 decrement_property_view 型別錯誤（v_deleted 是 boolean 不應塞 live_count integer）
-- 同時把回傳值改回實際的 live_count（行為更直觀）

CREATE OR REPLACE FUNCTION decrement_property_view(
    p_property_id uuid,
    p_session_token text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_was_deleted boolean := false;
    v_live_count integer := 0;
BEGIN
    DELETE FROM property_view_sessions
    WHERE property_id = p_property_id
      AND session_token = p_session_token
    RETURNING true INTO v_was_deleted;

    IF v_was_deleted THEN
        UPDATE property_views
        SET live_count = GREATEST(live_count - 1, 0),
            updated_at = now()
        WHERE property_id = p_property_id
        RETURNING live_count INTO v_live_count;
    END IF;

    RETURN COALESCE(v_live_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_property_view(uuid, text)
    TO anon, authenticated, service_role;
