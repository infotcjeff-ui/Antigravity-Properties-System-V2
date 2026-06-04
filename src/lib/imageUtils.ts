import Compressor from 'compressorjs';

/**
 * Image Utilities for Base64 conversion and validation
 */

const MAX_IMAGES = 8;
const MAX_GEO_MAPS = 2;
const MAX_TOTAL_SIZE_MB = 10; // Increased limit slightly since we compress now
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

/**
 * Convert a File or Blob to Base64 string
 */
export const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Convert multiple files to Base64 strings
 */
export const filesToBase64 = async (files: (File | Blob)[]): Promise<string[]> => {
    const promises = files.map(file => fileToBase64(file));
    return Promise.all(promises);
};

/**
 * Calculate the size of a Base64 string in bytes
 */
export const getBase64Size = (base64: string): number => {
    // Remove the data URL prefix if present
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    // Calculate the actual byte size
    const padding = (base64Data.match(/=/g) || []).length;
    return (base64Data.length * 3) / 4 - padding;
};

/**
 * Calculate total size of Base64 array in bytes
 */
export const getTotalBase64Size = (base64Array: string[]): number => {
    return base64Array.reduce((total, base64) => total + getBase64Size(base64), 0);
};

/**
 * Validate image upload constraints
 */
export const validateImageUpload = (
    existingImages: string[],
    newFiles: File[],
    type: 'property' | 'geomap' = 'property'
): { valid: boolean; error?: string } => {
    const maxImages = type === 'property' ? MAX_IMAGES : MAX_GEO_MAPS;
    const totalCount = existingImages.length + newFiles.length;

    if (totalCount > maxImages) {
        return {
            valid: false,
            error: `最多只能上傳 ${maxImages} 張${type === 'property' ? '物業圖片' : '地圖'}。您已有 ${existingImages.length} 張，且正在嘗試添加 ${newFiles.length} 張。`
        };
    }

    // Check total file size of new files (this is a pre-compression check)
    // We allow larger files initially because they will be compressed
    const newFilesSize = newFiles.reduce((total, file) => total + file.size, 0);
    const existingSize = getTotalBase64Size(existingImages);
    const totalSize = existingSize + newFilesSize;

    // If total size is still over 20MB pre-compression, we should warn/block
    if (totalSize > 20 * 1024 * 1024) {
        return {
            valid: false,
            error: `上傳文件總量過大。請分批上傳或在上傳前縮小圖片。`
        };
    }

    return { valid: true };
};

/**
 * Check if a string is a valid Base64 image
 */
export const isValidBase64Image = (str: string): boolean => {
    return str.startsWith('data:image/') && str.includes('base64,');
};

/**
 * Compress image using compressorjs
 * 接受 File | Blob，並自動將非標準 File-like 物件轉為 Blob 以確保跨框架相容性。
 * 傳入 null / undefined 時會 reject 並附帶明確錯誤訊息。
 */
export const compressImage = async (
    file: File | Blob | null | undefined,
    options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<Blob> => {
    const savedSettings = (() => {
        try {
            const stored = localStorage.getItem('compression-settings');
            if (stored) return JSON.parse(stored);
        } catch {}
        return null;
    })();

    // 健壯性：確保傳入的是真正的 File 或 Blob。
    // 某些框架（如 React Dropzone + 跨框架包裝）傳入的物件有 .name / .size / .type，
    // 但並非標準 File 實例，Compressor 會報 "first argument must be a File or Blob"。
    // 同時過濾 null/undefined 等無效輸入，避免後續存取屬性時拋錯。
    if (file == null) {
        return Promise.reject(new Error('compressImage: 傳入無效的檔案（null / undefined）'));
    }

    if (file instanceof Blob) {
        return new Promise((resolve, reject) => {
            new Compressor(file, {
                quality: options.quality ?? (savedSettings ? savedSettings.quality / 100 : 0.7),
                maxWidth: options.maxWidth ?? (savedSettings ? savedSettings.maxWidth : 1920),
                maxHeight: options.maxHeight ?? (savedSettings ? savedSettings.maxHeight : 1920),
                convertSize: 500000,
                success(result) { resolve(result); },
                error(err) { console.error('Compression error:', err.message); reject(err); },
            });
        });
    }

    // File-like object（非標準 File 實例，如跨框架包裝物件）
    const mimeType = (file as File).type || 'image/jpeg';
    const fileBlob = new Blob([file as unknown as BlobPart], { type: mimeType });
    return new Promise((resolve, reject) => {
        new Compressor(fileBlob, {
            quality: options.quality ?? (savedSettings ? savedSettings.quality / 100 : 0.7),
            maxWidth: options.maxWidth ?? (savedSettings ? savedSettings.maxWidth : 1920),
            maxHeight: options.maxHeight ?? (savedSettings ? savedSettings.maxHeight : 1920),
            convertSize: 500000,
            success(result) { resolve(result); },
            error(err) { console.error('Compression error:', err.message); reject(err); },
        });
    });
};
