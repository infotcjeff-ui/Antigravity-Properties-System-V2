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

interface ViewStats {
    property_id: string;
    view_count: number;
    live_count: number;
}

/** GET: 取得所有物業的瀏覽統計
 * ?all=1                         → 取得所有物业当前 view_count / live_count
 * ?startDate=YYYY-MM&endDate=YYYY-MM → 取得月度浏览数汇总
 * ?monthly=1&startDate=...&endDate=... → 同样，取得月度浏览数
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const getAll = searchParams.get('all');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        const supabase = getSupabase();

        // 1. 全部物业当前 view_count / live_count
        if (getAll === '1') {
            const { data, error } = await supabase
                .from('property_views')
                .select('property_id, view_count, live_count');

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ data: data ?? [] });
        }

        // 2. 月度浏览数汇总
        if (startDate && endDate) {
            const [y1, m1] = startDate.split('-');
            const [y2, m2] = endDate.split('-');

            const startTs = new Date(`${y1}-${m1}-01T00:00:00+08:00`).toISOString();
            const endTs = new Date(`${y2}-${m2}-31T23:59:59+08:00`).toISOString();

            const { data, error } = await supabase
                .from('property_views')
                .select('property_id, view_count, live_count, updated_at')
                .lte('updated_at', endTs);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            // 从 property_views_history 表取月度明细
            const { data: historyData, error: historyError } = await supabase
                .from('property_views_history')
                .select('property_id, view_count, year, month')
                .gte('year_month', `${y1}-${m1}`)
                .lte('year_month', `${y2}-${m2}`)
                .order('year_month', { ascending: true });

            if (historyError) {
                // 表不存在或查询失败，返回 0
                return NextResponse.json({ data: [] });
            }

            return NextResponse.json({ data: historyData ?? [] });
        }

        return NextResponse.json({ error: 'Invalid params. Use ?all=1 or ?startDate=&endDate=' }, { status: 400 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
