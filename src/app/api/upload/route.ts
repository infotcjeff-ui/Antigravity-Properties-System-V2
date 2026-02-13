import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
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

        // Dynamic path resolution
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);

        // Process image with sharp
        const processedImageBuffer = await sharp(buffer)
            .resize({
                width: 1920,
                withoutEnlargement: true,
                fit: 'inside'
            })
            .webp({ quality: 80 })
            .toBuffer();

        // Save to public/uploads/[folder]
        await writeFile(filePath, processedImageBuffer);

        return NextResponse.json({
            url: `/uploads/${folder}/${filename}`,
            filename
        });

    } catch (err: any) {
        if (err.message === "Potential attack detected" || err.message === "Bot access denied" || err.message === "Too many requests" || err.message === "Access denied") {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }
        console.error('Upload API Error:', err);
        return NextResponse.json({ error: 'Internal server error during upload.' }, { status: 500 });
    }
}
