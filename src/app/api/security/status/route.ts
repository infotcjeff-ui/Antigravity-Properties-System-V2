import { NextResponse } from 'next/server';

export async function GET() {
    const isArcjetConfigured = !!process.env.ARCJET_KEY;

    return NextResponse.json({
        enabled: isArcjetConfigured,
        provider: 'Arcjet',
        layer: 'API Route (Serverless)',
        features: ['Shield', 'Bot Detection (API layer)'],
        status: isArcjetConfigured ? 'active' : 'inactive'
    });
}
