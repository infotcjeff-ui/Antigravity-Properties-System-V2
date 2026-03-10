import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://www.als.ogcio.gov.hk/lookup?q=${encodeURIComponent(q)}&n=1`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`ALS API responded with status ${response.status}`);
        }

        const data = await response.json();
        const addr = data?.SuggestedAddress?.[0]?.Address;

        if (addr) {
            const geo = addr.PremisesAddress?.GeospatialInformation || addr.BuildingAddress?.GeospatialInformation;
            if (geo?.Latitude && geo?.Longitude) {
                return NextResponse.json({
                    lat: geo.Latitude,
                    lng: geo.Longitude,
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
