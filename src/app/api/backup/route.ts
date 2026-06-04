import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const BACKUP_BUCKET = 'backups';
const BACKUP_PASSWORD = '@tcjeff09';
const ALGORITHM = 'aes-256-gcm';

function deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

async function encryptData(data: Buffer, password: string): Promise<Buffer> {
    const salt = crypto.randomBytes(32);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, authTag, encrypted]);
}

async function decryptData(encryptedBuffer: Buffer, password: string): Promise<Buffer> {
    const salt = encryptedBuffer.subarray(0, 32);
    const iv = encryptedBuffer.subarray(32, 48);
    const authTag = encryptedBuffer.subarray(48, 64);
    const encrypted = encryptedBuffer.subarray(64);

    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchAllTableData(supabase: ReturnType<typeof createClient>) {
    const tables = [
        'properties',
        'proprietors',
        'rents',
        'sub_landlords',
        'current_tenants',
        'transactions',
    ];

    const data: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const table of tables) {
        try {
            const { data: rows, error } = await supabase
                .from(table)
                .select('*')
                .limit(50000);

            if (!error && rows) {
                data[table] = rows;
                totalRecords += rows.length;
            } else {
                data[table] = [];
            }
        } catch {
            data[table] = [];
        }
    }

    return { data, totalRecords };
}

async function fetchStorageImages(supabase: ReturnType<typeof createClient>) {
    try {
        const { data, error } = await supabase.storage
            .from('properties')
            .list('', { limit: 10000 });

        if (error || !data) return [];

        return data
            .filter(f => f.name && /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(f.name))
            .map(f => ({
                name: f.name,
                created_at: f.created_at,
                url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/properties/${f.name}`,
            }));
    } catch {
        return [];
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const downloadId = searchParams.get('download');
        const previewId = searchParams.get('preview');

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabaseAdmin = createClient(supabaseUrl, serviceKey || anonKey);

        if (downloadId) {
            const { data: files, error: listError } = await supabaseAdmin.storage
                .from(BACKUP_BUCKET)
                .list('', { limit: 1000 });

            if (listError || !files) {
                return NextResponse.json({ error: 'Cannot list backups' }, { status: 500 });
            }

            const targetFile = files.find(f => f.id === downloadId || f.name === downloadId);
            if (!targetFile) {
                return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
            }

            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                .from(BACKUP_BUCKET)
                .download(targetFile.name);

            if (downloadError || !fileData) {
                return NextResponse.json({ error: 'Download failed' }, { status: 500 });
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const encryptedBuffer = Buffer.from(arrayBuffer);

            let decryptedBuffer: Buffer;
            try {
                decryptedBuffer = await decryptData(encryptedBuffer, BACKUP_PASSWORD);
            } catch {
                return NextResponse.json({ error: 'Decryption failed. Check password.' }, { status: 400 });
            }

            const timestamp = new Date().toISOString().slice(0, 10);

            return new NextResponse(new Uint8Array(decryptedBuffer), {
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${timestamp}_backup.zip"`,
                    'Content-Length': String(decryptedBuffer.length),
                },
            });
        }

        if (previewId) {
            const { data: files } = await supabaseAdmin.storage.from(BACKUP_BUCKET).list('', { limit: 1000 });
            if (!files) return NextResponse.json({ error: 'Cannot list backups' }, { status: 500 });

            const targetFile = files.find(f => f.id === previewId || f.name === previewId);
            if (!targetFile) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });

            const { data: fileData } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(targetFile.name);
            if (!fileData) return NextResponse.json({ error: 'Download failed' }, { status: 500 });

            const arrayBuffer = await fileData.arrayBuffer();
            const encryptedBuffer = Buffer.from(arrayBuffer);

            try {
                const decryptedBuffer = await decryptData(encryptedBuffer, BACKUP_PASSWORD);
                const AdmZip = (await import('adm-zip')).default;
                const os = await import('os');
                const pathMod = await import('path');
                const fs = await import('fs');

                const tmpFile = pathMod.join(os.tmpdir(), `preview_${Date.now()}.zip`);
                fs.writeFileSync(tmpFile, decryptedBuffer);

                const zip = new AdmZip(tmpFile);
                const zipEntries = zip.getEntries();

                const preview: Record<string, any[]> = {};
                for (const entry of zipEntries) {
                    if (entry.entryName.endsWith('.json')) {
                        const tableName = entry.entryName.replace('.json', '');
                        const content = zip.readAsText(entry);
                        try {
                            preview[tableName] = JSON.parse(content);
                        } catch {
                            preview[tableName] = [];
                        }
                    }
                }

                fs.unlinkSync(tmpFile);
                return NextResponse.json(preview);
            } catch {
                return NextResponse.json({ error: 'Preview decryption failed' }, { status: 400 });
            }
        }

        const { data: files } = await supabaseAdmin.storage.from(BACKUP_BUCKET).list('', { limit: 1000 });

        const backups = (files || [])
            .filter(f => f.name.endsWith('.enc'))
            .map(f => {
                const nameParts = f.name.replace('.enc', '').split('_');
                const recordCount = parseInt(nameParts[nameParts.length - 1]) || 0;
                return {
                    id: f.id,
                    filename: f.name,
                    size: f.metadata?.size || 0,
                    sizeFormatted: formatBytes(f.metadata?.size || 0),
                    created_at: f.created_at || new Date().toISOString(),
                    recordCount,
                };
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json({ backups });
    } catch (err: any) {
        console.error('Backup GET error:', err);
        return NextResponse.json({ error: err.message || 'Backup failed' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, anonKey);
        const uploadClient = createClient(supabaseUrl, serviceKey || anonKey);

        const { password } = await request.json();
        if (password !== BACKUP_PASSWORD) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 檢查並建立 bucket
        const { data: existing, error: listErr } = await supabase.storage.from(BACKUP_BUCKET).list('', { limit: 1 });
        if (listErr || existing === null) {
            const { error: createErr } = await uploadClient.storage.createBucket(BACKUP_BUCKET, { public: false });
            if (createErr && createErr.message !== 'Bucket already exists') {
                console.error('Bucket creation error:', createErr);
            }
        }

        const tableData = await fetchAllTableData(supabase);
        const imageUrls = await fetchStorageImages(supabase);

        // 使用 Node.js 原生 ZIP（不依賴 adm-zip）
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip();

        for (const [tableName, rows] of Object.entries(tableData.data)) {
            zip.addFile(`${tableName}.json`, Buffer.from(JSON.stringify(rows, null, 2)));
        }

        if (imageUrls.length > 0) {
            zip.addFile('storage_images.json', Buffer.from(JSON.stringify(imageUrls, null, 2)));
        }

        const metadata = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            tables: Object.keys(tableData.data).map(name => ({
                name,
                recordCount: tableData.data[name].length,
            })),
            totalRecords: tableData.totalRecords,
            imageCount: imageUrls.length,
        };
        zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2)));

        const zipBuffer = zip.toBuffer();

        // 驗證 ZIP 是否有效
        if (zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4B) {
            throw new Error('ZIP buffer invalid');
        }

        // 加密
        const encryptedBuffer = await encryptData(zipBuffer, BACKUP_PASSWORD);

        // 驗證加密是否成功（頭 4 bytes 應該不是 ZIP magic）
        if (encryptedBuffer[0] === 0x50 && encryptedBuffer[1] === 0x4B) {
            throw new Error('Encryption failed - still ZIP format');
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${timestamp}_backup_${tableData.totalRecords}.enc`;

        const { error: uploadError } = await uploadClient.storage
            .from(BACKUP_BUCKET)
            .upload(filename, encryptedBuffer, {
                contentType: 'application/octet-stream',
                upsert: true,
            });

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        return NextResponse.json({
            success: true,
            filename,
            recordCount: tableData.totalRecords,
            tables: Object.keys(tableData.data).length,
        });
    } catch (err: any) {
        console.error('Backup POST error:', err);
        return NextResponse.json({ error: err.message || 'Backup creation failed' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing backup ID' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabaseAdmin = createClient(supabaseUrl, serviceKey || anonKey);

        const { data: files } = await supabaseAdmin.storage.from(BACKUP_BUCKET).list('', { limit: 1000 });
        if (!files) return NextResponse.json({ error: 'Cannot list backups' }, { status: 500 });

        const targetFile = files.find(f => f.id === id || f.name === id);
        if (!targetFile) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });

        const { error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([targetFile.name]);
        if (error) throw new Error(`Delete failed: ${error.message}`);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Backup DELETE error:', err);
        return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
    }
}
