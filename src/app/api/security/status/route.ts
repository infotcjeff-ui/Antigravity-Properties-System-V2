import { NextResponse } from 'next/server';

export async function GET() {
    const isArcjetConfigured = !!process.env.ARCJET_KEY;

    return NextResponse.json({
        enabled: isArcjetConfigured,
        provider: 'Arcjet',
        features: ['Shield', 'Bot Detection', 'Rate Limiting'],
        status: isArcjetConfigured ? 'active' : 'inactive'
    });
}
