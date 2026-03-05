import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fs from 'fs/promises';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function compressAndUpload() {
    console.log('Starting compression of existing images in Supabase Storage...');

    // List folders in 'properties' bucket
    const { data: rootFolders, error: lsError } = await supabase.storage.from('properties').list();

    if (lsError) {
        console.error('Error listing properties root:', lsError);
        return;
    }

    let totalProcessed = 0;

    // Function to process files in a folder path
    async function processFolder(folderPath) {
        const { data: files, error: filesError } = await supabase.storage.from('properties').list(folderPath);
        if (filesError) {
            console.error(`Error listing files in ${folderPath}:`, filesError);
            return;
        }

        for (const file of files) {
            // If it's a subfolder (usually doesn't have an id, or metadata is null)
            if (!file.id) {
                await processFolder(`${folderPath}/${file.name}`);
                continue;
            }

            const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;

            if (!file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
                console.log(`Skipping non-image file: ${filePath}`);
                continue;
            }

            console.log(`Downloading: ${filePath} (${Math.round(file.metadata.size / 1024)}KB)`);

            const { data: blob, error: dlError } = await supabase.storage.from('properties').download(filePath);
            if (dlError || !blob) {
                console.error(`Failed to download ${filePath}:`, dlError);
                continue;
            }

            const buffer = Buffer.from(await blob.arrayBuffer());

            try {
                console.log(`Compressing ${filePath}...`);
                const processedBuffer = await sharp(buffer)
                    .resize({ width: 1920, withoutEnlargement: true, fit: 'inside' })
                    .webp({ quality: 80 })
                    .toBuffer();

                // If the new size is smaller, re-upload it
                const originalSize = buffer.byteLength;
                const newSize = processedBuffer.byteLength;

                if (newSize < originalSize) {
                    console.log(`Uploading compressed ${filePath} (${Math.round(newSize / 1024)}KB) - Saved ${Math.round((originalSize - newSize) / 1024)}KB`);

                    const { error: upError } = await supabase.storage.from('properties').upload(filePath, processedBuffer, {
                        contentType: 'image/webp',
                        cacheControl: '3600',
                        upsert: true
                    });

                    if (upError) {
                        console.error(`Failed to re-upload ${filePath}:`, upError);
                    } else {
                        totalProcessed++;
                    }
                } else {
                    console.log(`Skipped ${filePath} (already optimized)`);
                }
            } catch (err) {
                console.error(`Error processing ${filePath}:`, err);
            }
        }
    }

    await processFolder('');

    console.log(`Finished! Processed and compressed ${totalProcessed} images.`);
}

compressAndUpload();
