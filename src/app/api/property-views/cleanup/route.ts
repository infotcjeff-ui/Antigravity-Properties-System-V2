import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase config missing');
    }
    return createClient(supabaseUrl, supabaseKey);
}

/**
 * POST: 清理超過 timeout 秒數未心跳的 session。
 * 預期由排程（Vercel Cron / GitHub Actions / 外部 cron）每分鐘呼叫一次。
 *
 * Headers: { 'x-cron-secret': process.env.CRON_SECRET }
 * Body:    { timeoutSeconds?: number }  // 預設 120 秒
 */
export async function POST(request: NextRequest) {
    const secret = request.headers.get('x-cron-secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { timeoutSeconds = 120 } = (await request.json().catch(() => ({}))) as {
        timeoutSeconds?: number;
    };

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('cleanup_stale_property_view_sessions', {
            p_timeout_seconds: timeoutSeconds,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            affectedProperties: data ?? 0,
            timeoutSeconds,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * GET: 供 Vercel Cron 或外部 cron 以 query 方式觸發。
 *   GET /api/property-views/cleanup?timeoutSeconds=120
 *   Header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
    const secret = request.headers.get('x-cron-secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const timeoutSeconds = Number.parseInt(
        request.nextUrl.searchParams.get('timeoutSeconds') ?? '120',
        10,
    );

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('cleanup_stale_property_view_sessions', {
            p_timeout_seconds: Number.isFinite(timeoutSeconds) ? timeoutSeconds : 120,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            affectedProperties: data ?? 0,
            timeoutSeconds,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
