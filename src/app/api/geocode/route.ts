import { NextRequest, NextResponse } from 'next/server';
import { isPlausibleGeocodeForQuery } from '@/lib/addressGeocodePlausibility';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
    }

    try {
        // 多筆建議：首筆常誤配至市區；依查詢語意過濾不合理座標
        const response = await fetch(`https://www.als.ogcio.gov.hk/lookup?q=${encodeURIComponent(q)}&n=15`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`ALS API responded with status ${response.status}`);
        }

        const data = await response.json();
        const suggested = data?.SuggestedAddress;
        if (Array.isArray(suggested)) {
            for (const item of suggested) {
                const addr = item?.Address;
                if (!addr) continue;
                const geo = addr.PremisesAddress?.GeospatialInformation || addr.BuildingAddress?.GeospatialInformation;
                const lat = geo?.Latitude;
                const lng = geo?.Longitude;
                if (lat == null || lng == null) continue;
                const latN = typeof lat === 'number' ? lat : parseFloat(String(lat));
                const lngN = typeof lng === 'number' ? lng : parseFloat(String(lng));
                if (!Number.isFinite(latN) || !Number.isFinite(lngN)) continue;
                if (!isPlausibleGeocodeForQuery(q, latN, lngN)) continue;
                return NextResponse.json({
                    lat: latN,
                    lng: lngN,
                    source: 'als'
                });
            }
        }

        return NextResponse.json({ location: null, message: 'No location found' });
    } catch (error: any) {
        console.error('Geocoding proxy error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
