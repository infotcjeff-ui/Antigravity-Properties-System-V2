import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { unlink } from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
    try {
        const { url: fileUrl } = await request.json();

        if (!fileUrl || typeof fileUrl !== 'string') {
            return NextResponse.json({ error: 'Missing file URL' }, { status: 400 });
        }

        // Security: ensure the path stays within public/uploads
        const sanitized = fileUrl.replace(/^\/uploads\//, '');
        if (sanitized.includes('..') || sanitized.startsWith('/')) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'public', 'uploads', sanitized);

        // Check which properties reference this image
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

        // Delete the file
        await unlink(filePath);

        return NextResponse.json({
            success: true,
            affectedProperties,
        });
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        console.error('Delete upload error:', err);
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }
}
