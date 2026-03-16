import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Ensure Node.js runtime (sharp requires it; Edge would fail)
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        // Validate Supabase env vars early (common cause of failure on Vercel)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            console.error('Upload API: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
            return NextResponse.json(
                { error: 'Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.' },
                { status: 503 }
            );
        }

        // Security: verify with Arcjet when configured (optional - skip if not set to avoid module load issues)
        if (process.env.ARCJET_KEY) {
            const { verifyRequest } = await import('@/lib/security');
            await verifyRequest(request);
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const folder = (formData.get('folder') as string) || 'general';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Validate file type (allow empty type from compressed Blob - sharp will validate)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
        const type = file.type?.toLowerCase() || '';
        const name = (file as File).name?.toLowerCase() || '';
        const validType = allowedTypes.some(t => type.includes(t.replace('image/', '')));
        const validExt = /\.(jpe?g|png|webp|gif)$/i.test(name);
        if (!validType && !validExt) {
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

        // Initialize Supabase Client (env vars already validated above)
        const supabase = createClient(supabaseUrl!, supabaseKey!);

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
        if (err?.message === "Potential attack detected" || err?.message === "Bot access denied" || err?.message === "Too many requests" || err?.message === "Access denied") {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }
        const msg = err?.message || String(err) || 'Internal server error during upload.';
        console.error('Upload API Error:', err);
        // Always return JSON (never HTML) so client can parse
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// Fallback: if handler throws before returning, Vercel may serve HTML 500. This shouldn't happen.
