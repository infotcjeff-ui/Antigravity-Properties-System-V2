import { NextResponse } from 'next/server';
import path from 'path';
import { readdir, stat } from 'fs/promises';

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
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        const files: UploadedFile[] = [];

        // Read all subfolders
        let folders: string[] = [];
        try {
            const entries = await readdir(uploadsDir, { withFileTypes: true });
            folders = entries.filter(e => e.isDirectory()).map(e => e.name);

            // Also check for files directly in uploads/
            const rootFiles = entries.filter(e => e.isFile() && /\.(webp|jpg|jpeg|png|gif)$/i.test(e.name));
            for (const file of rootFiles) {
                const filePath = path.join(uploadsDir, file.name);
                const fileStat = await stat(filePath);
                files.push({
                    filename: file.name,
                    folder: '',
                    url: `/uploads/${file.name}`,
                    size: fileStat.size,
                    sizeFormatted: formatFileSize(fileStat.size),
                    lastModified: fileStat.mtime.toISOString(),
                });
            }
        } catch {
            // uploads directory doesn't exist yet
            return NextResponse.json({ files: [], totalSize: 0, totalSizeFormatted: '0 B' });
        }

        // Read files in each subfolder
        for (const folder of folders) {
            const folderPath = path.join(uploadsDir, folder);
            try {
                const folderEntries = await readdir(folderPath, { withFileTypes: true });
                const imageFiles = folderEntries.filter(e => e.isFile() && /\.(webp|jpg|jpeg|png|gif)$/i.test(e.name));

                for (const file of imageFiles) {
                    const filePath = path.join(folderPath, file.name);
                    const fileStat = await stat(filePath);
                    files.push({
                        filename: file.name,
                        folder,
                        url: `/uploads/${folder}/${file.name}`,
                        size: fileStat.size,
                        sizeFormatted: formatFileSize(fileStat.size),
                        lastModified: fileStat.mtime.toISOString(),
                    });
                }
            } catch {
                continue;
            }
        }

        // Sort by last modified (newest first)
        files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

        const totalSize = files.reduce((sum, f) => sum + f.size, 0);

        return NextResponse.json({
            files,
            totalSize,
            totalSizeFormatted: formatFileSize(totalSize),
        });
    } catch (err: any) {
        console.error('List uploads error:', err);
        return NextResponse.json({ error: 'Failed to list uploads' }, { status: 500 });
    }
}
