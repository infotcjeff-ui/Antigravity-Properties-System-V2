import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface UploadedFile {
    filename: string;
    folder: string;
    url: string;
    size: number;
    sizeFormatted: string;
    lastModified: string;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const files: UploadedFile[] = [];
        let totalBytes = 0;

        // Function recursively fetch files from folders (max depth 2 for safety)
        async function fetchFiles(folderPath: string, depth = 0) {
            if (depth > 2) return;

            const { data: folderItems, error } = await supabase.storage.from('properties').list(folderPath, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' },
            });

            if (error) {
                console.error(`Error listing folder ${folderPath}:`, error);
                return;
            }

            for (const item of folderItems) {
                // Determine if it's a folder (no id, usually means folder in Supabase storage API)
                if (!item.id) {
                    await fetchFiles(folderPath ? `${folderPath}/${item.name}` : item.name, depth + 1);
                } else if (/\.(webp|jpg|jpeg|png|gif)$/i.test(item.name)) {
                    // It's a file
                    const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
                    const { data: { publicUrl } } = supabase.storage.from('properties').getPublicUrl(fullPath);

                    const fileSize = item.metadata?.size || 0;
                    totalBytes += fileSize;

                    files.push({
                        filename: item.name,
                        folder: folderPath || 'general', // default to general if root
                        url: publicUrl,
                        size: fileSize,
                        sizeFormatted: formatFileSize(fileSize),
                        lastModified: item.updated_at || item.created_at,
                    });
                }
            }
        }

        await fetchFiles(''); // start at root

        // Sort by last modified (newest first)
        files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

        return NextResponse.json({
            files,
            totalSize: totalBytes,
            totalSizeFormatted: formatFileSize(totalBytes),
        });
    } catch (err: any) {
        console.error('List uploads error:', err);
        return NextResponse.json({ error: 'Failed to list uploads' }, { status: 500 });
    }
}
