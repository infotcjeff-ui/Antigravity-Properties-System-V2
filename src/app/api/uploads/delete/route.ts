import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyRequest } from '@/lib/security';

export async function DELETE(request: NextRequest) {
    try {
        // Security: verify request with Arcjet at route level to stay within Vercel Middleware size limits
        await verifyRequest(request);

        const { url: fileUrl } = await request.json();

        if (!fileUrl || typeof fileUrl !== 'string') {
            return NextResponse.json({ error: 'Missing file URL' }, { status: 400 });
        }

        // Initialize Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Search for properties that reference this URL in images or geo_maps
        const { data: properties } = await supabase
            .from('properties')
            .select('id, name, images, geo_maps');

        const affectedProperties: { id: string; name: string; field: string }[] = [];
        if (properties) {
            for (const prop of properties) {
                const images = prop.images || [];
                const geoMaps = prop.geo_maps || [];

                // Check if any image URL contains our file URL
                if (images.some((img: string) => img.includes(fileUrl))) {
                    affectedProperties.push({ id: prop.id, name: prop.name, field: 'images' });
                }
                if (geoMaps.some((img: string) => img.includes(fileUrl))) {
                    affectedProperties.push({ id: prop.id, name: prop.name, field: 'geo_maps' });
                }
            }
        }

        // Extract storage path from the URL
        // Example: https://project.supabase.co/storage/v1/object/public/properties/folder/uuid.webp -> folder/uuid.webp
        let storagePath = '';
        if (fileUrl.includes('/public/properties/')) {
            storagePath = fileUrl.split('/public/properties/')[1];
        } else if (fileUrl.startsWith('/uploads/')) {
            // Legacy local files (will just ignore deletion since Vercel drops them anyway)
            return NextResponse.json({
                success: true,
                affectedProperties,
                note: 'Legacy local file, skipped storage deletion'
            });
        }

        if (storagePath) {
            const { error } = await supabase.storage
                .from('properties')
                .remove([storagePath]);

            if (error) {
                console.error('Supabase Storage Delete Error:', error);
                // We still return success for UI so it doesn't get stuck, 
                // but log the error. Or standard error handling:
                return NextResponse.json({ error: `Storage delete failed: ${error.message}` }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            affectedProperties,
        });
    } catch (err: any) {
        if (err.message === "Potential attack detected" || err.message === "Bot access denied" || err.message === "Too many requests" || err.message === "Access denied") {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }
        console.error('Delete upload error:', err);
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }
}
