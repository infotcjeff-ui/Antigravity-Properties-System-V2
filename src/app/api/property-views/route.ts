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

/** POST: 遞增瀏覽次數（打開頁面時）；也支援遞增 live_count（實時在線） */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { propertyId, action } = body as { propertyId?: string; action?: string };

        if (!propertyId) {
            return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
        }

        const supabase = getSupabase();

        if (action === 'enter') {
            // 頁面進入：增加 view_count + live_count
            const { error: upsertError } = await supabase.rpc('increment_property_views', {
                p_property_id: propertyId,
            });

            if (upsertError) {
                // Fallback: upsert raw
                const { data: existing } = await supabase
                    .from('property_views')
                    .select('*')
                    .eq('property_id', propertyId)
                    .single();

                if (existing) {
                    await supabase
                        .from('property_views')
                        .update({
                            view_count: (existing.view_count || 0) + 1,
                            live_count: (existing.live_count || 0) + 1,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('property_id', propertyId);
                } else {
                    await supabase.from('property_views').insert({
                        property_id: propertyId,
                        view_count: 1,
                        live_count: 1,
                    });
                }
            }

            const { data } = await supabase
                .from('property_views')
                .select('view_count, live_count')
                .eq('property_id', propertyId)
                .single();

            return NextResponse.json({
                viewCount: data?.view_count || 0,
                liveCount: data?.live_count || 0,
            });
        }

        if (action === 'leave') {
            // 頁面離開：遞減 live_count
            const { data: existing } = await supabase
                .from('property_views')
                .select('*')
                .eq('property_id', propertyId)
                .single();

            if (existing && existing.live_count > 0) {
                await supabase
                    .from('property_views')
                    .update({
                        live_count: existing.live_count - 1,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('property_id', propertyId);
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { error: 'Invalid action. Use "enter" or "leave".' },
            { status: 400 },
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
