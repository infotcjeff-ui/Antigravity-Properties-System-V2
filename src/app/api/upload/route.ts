import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { verifyRequest } from '@/lib/security';

export async function POST(request: NextRequest) {
    try {
        // Security: verify request with Arcjet at route level to stay within Vercel Middleware size limits
        await verifyRequest(request);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const folder = (formData.get('folder') as string) || 'general';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.' }, { status: 400 });
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size too large. Maximum limit is 10MB.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${uuidv4()}.webp`;
        const storagePath = `${folder}/${filename}`;

        // Process image with sharp
        const processedImageBuffer = await sharp(buffer)
            .resize({
                width: 1920,
                withoutEnlargement: true,
                fit: 'inside'
            })
            .webp({ quality: 80 })
            .toBuffer();

        // Initialize Supabase Client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Upload to Supabase Storage 'properties' bucket
        const { data, error } = await supabase.storage
            .from('properties')
            .upload(storagePath, processedImageBuffer, {
                contentType: 'image/webp',
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Supabase Storage Upload Error:', error);
            throw new Error(`Storage error: ${error.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('properties')
            .getPublicUrl(storagePath);

        return NextResponse.json({
            url: publicUrl,
            filename
        });

    } catch (err: any) {
        if (err.message === "Potential attack detected" || err.message === "Bot access denied" || err.message === "Too many requests" || err.message === "Access denied") {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }
        console.error('Upload API Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error during upload.' }, { status: 500 });
    }
}
