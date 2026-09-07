import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase config missing');
    }
    return createClient(supabaseUrl, supabaseKey);
}

/** GET: 取得指定物業的瀏覽次數統計 */
export async function GET(request: NextRequest) {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
        return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('property_views')
            .select('*')
            .eq('property_id', propertyId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ viewCount: 0, liveCount: 0 });
        }

        return NextResponse.json({
            viewCount: data.view_count || 0,
            liveCount: data.live_count || 0,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** POST: 進入 / 心跳 / 離開 動作 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { propertyId, action, sessionToken, userId } = body as {
            propertyId?: string;
            action?: string;
            sessionToken?: string;
            userId?: string;
        };

        if (!propertyId) {
            return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
        }
        if (!sessionToken) {
            return NextResponse.json({ error: 'sessionToken is required' }, { status: 400 });
        }

        const supabase = getSupabase();

        if (action === 'enter') {
            // 原子化：view_count + live_count + 寫入 session（同 session 重複 enter 只算一次 live）
            const { data, error } = await supabase.rpc('increment_property_views', {
                p_property_id: propertyId,
                p_session_token: sessionToken,
                p_user_id: userId ?? null,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            // RPC 回傳 SETOF (view_count, live_count)，取第一列
            const row = Array.isArray(data) ? data[0] : data;
            return NextResponse.json({
                viewCount: row?.view_count ?? 0,
                liveCount: row?.live_count ?? 0,
            });
        }

        if (action === 'heartbeat') {
            // 刷新 session 的 last_seen_at，並回傳當前 live_count
            const { data, error } = await supabase.rpc('heartbeat_property_view', {
                p_property_id: propertyId,
                p_session_token: sessionToken,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ liveCount: data ?? 0 });
        }

        if (action === 'leave') {
            // 精確遞減：依 session_token 刪除 session 後遞減 live_count
            const { data, error } = await supabase.rpc('decrement_property_view', {
                p_property_id: propertyId,
                p_session_token: sessionToken,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, liveCount: data ?? 0 });
        }

        return NextResponse.json(
            { error: 'Invalid action. Use "enter", "heartbeat", or "leave".' },
            { status: 400 },
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
