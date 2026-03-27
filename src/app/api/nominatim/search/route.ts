import { NextRequest, NextResponse } from 'next/server';
import { isPlausibleGeocodeForQuery } from '@/lib/addressGeocodePlausibility';

/** 香港大致邊界（用於在無語意過濾時偏好本地結果） */
function inHongKongRough(lat: number, lng: number): boolean {
    return lat >= 22.05 && lat <= 22.65 && lng >= 113.65 && lng <= 114.52;
}

/**
 * 代理 Nominatim 搜尋（與 openstreetmap.org 搜尋列相同資料來源）。
 * 瀏覽器直接打 nominatim 易被 CORS／配額影響，故由伺服器轉發。
 */
export async function GET(request: NextRequest) {
    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q) {
        return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
    }

    try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('q', q);
        url.searchParams.set('limit', '15');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('accept-language', 'zh-HK,zh-TW,zh,en');
        // 與官網類似：以香港範圍作 viewbox 加分（bounded=0 不強制裁切）
        url.searchParams.set('viewbox', '113.8,22.57,114.42,22.13');
        url.searchParams.set('bounded', '0');

        const res = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'AntigravityPropertiesPMS/1.0 (property management; not bulk)',
                'Accept-Language': 'zh-HK,zh-TW,zh,en',
            },
            next: { revalidate: 0 },
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `Nominatim HTTP ${res.status}` },
                { status: 502 },
            );
        }

        const results = (await res.json()) as Array<{
            lat: string;
            lon: string;
            display_name?: string;
        }>;

        if (!Array.isArray(results) || results.length === 0) {
            return NextResponse.json({ best: null, results: [] });
        }

        const toPoint = (row: (typeof results)[0]) => {
            const lat = parseFloat(row.lat);
            const lng = parseFloat(row.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return {
                lat,
                lng,
                displayName: row.display_name || '',
            };
        };

        // 1) 語意合理（例如村名不應落到中環預設點）
        for (const row of results) {
            const p = toPoint(row);
            if (!p) continue;
            if (isPlausibleGeocodeForQuery(q, p.lat, p.lng)) {
                return NextResponse.json({ best: p, results });
            }
        }

        // 2) 香港範圍內第一筆
        for (const row of results) {
            const p = toPoint(row);
            if (!p) continue;
            if (inHongKongRough(p.lat, p.lng)) {
                return NextResponse.json({ best: p, results });
            }
        }

        // 3) 仍回傳第一筆（國際地址等）
        const fallback = toPoint(results[0]);
        return NextResponse.json({ best: fallback, results });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Nominatim proxy error';
        console.error('nominatim/search:', e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
