'use client';

import React, { useState, ChangeEvent } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react';
import { FileUpload } from './file-upload';

interface ImageUploadProps {
    onUploadSuccess?: (url: string) => void;
    label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
    onUploadSuccess,
    label = "Upload Image"
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [successUrl, setSuccessUrl] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setSuccessUrl(null);
            // Create a local preview
            const objectUrl = URL.createObjectURL(selectedFile);
            setPreviewUrl(objectUrl);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a file first.");
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setSuccessUrl(data.url);
            if (onUploadSuccess) {
                onUploadSuccess(data.url);
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || "An unexpected error occurred during upload.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {label}
            </h3>

            <div className="relative group">
                {!previewUrl ? (
                    <FileUpload onChange={(files) => {
                        if (files.length > 0) {
                            handleFileChange({ target: { files } } as any);
                        }
                    }} />
                ) : (
                    <div className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all border-purple-400 bg-purple-50/30 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <div className="relative w-full h-full p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full object-contain rounded-lg"
                            />
                            <div
                                onClick={() => setPreviewUrl(null)}
                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg cursor-pointer"
                            >
                                <p className="text-white text-sm font-medium">Clear & Change Image</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm transition-all animate-in fade-in slide-in-from-top-1">
                    <XCircle className="w-4 h-4" />
                    <p>{error}</p>
                </div>
            )}

            {successUrl && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm transition-all animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <p>Compression successful! Image is ready.</p>
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all transform active:scale-[0.98]
                    ${!file || uploading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                    }
                    flex items-center justify-center gap-2
                `}
            >
                {uploading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing with Sharp...
                    </>
                ) : (
                    <>
                        <Upload className="w-5 h-5" />
                        {successUrl ? 'Compress Again' : 'Optimize & Upload'}
                    </>
                )}
            </button>

            {successUrl && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Optimized URL:</p>
                    <code className="text-[10px] break-all p-2 bg-gray-50 dark:bg-gray-900 rounded block border border-gray-200 dark:border-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
                        {successUrl}
                    </code>
                </div>
            )}
        </div>
    );
};
