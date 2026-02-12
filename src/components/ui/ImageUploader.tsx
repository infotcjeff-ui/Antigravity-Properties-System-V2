'use client';

import React, { useState, ChangeEvent, useEffect } from 'react';
import { Upload, Loader2, X, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImageUploaderProps {
    onUploadComplete: (url: string) => void;
    defaultValue?: string;
    label?: string;
    folder?: string;
    aspectRatio?: string; // e.g., 'aspect-video', 'aspect-square'
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
    onUploadComplete,
    defaultValue = '',
    label = 'Upload Image',
    folder = 'general',
    aspectRatio = 'aspect-video'
}) => {
    const [previewUrl, setPreviewUrl] = useState<string>(defaultValue);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Sync preview with defaultValue for edit modes
    useEffect(() => {
        if (defaultValue) setPreviewUrl(defaultValue);
    }, [defaultValue]);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset states
        setError(null);
        setSuccess(false);
        setUploading(true);

        // Local preview for immediate feedback
        const localPreview = URL.createObjectURL(file);
        setPreviewUrl(localPreview);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setPreviewUrl(data.url);
            setSuccess(true);
            onUploadComplete(data.url);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || 'Error processing image');
            // If upload failed, revert preview if we don't have a backup
            if (!defaultValue) setPreviewUrl('');
        } finally {
            setUploading(false);
        }
    };

    const clearImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setPreviewUrl('');
        setSuccess(false);
        onUploadComplete('');
    };

    return (
        <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
                {success && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-green-500">
                        <CheckCircle2 className="w-3 h-3" /> Optimized & Saved
                    </span>
                )}
            </div>

            <div className={`relative group w-full ${aspectRatio} rounded-2xl overflow-hidden border-2 border-dashed transition-all duration-300
                ${previewUrl
                    ? 'border-purple-500/50 bg-gray-50 dark:bg-gray-900'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-purple-400'
                }
            `}>
                <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading}
                />

                {previewUrl ? (
                    <div className="relative w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <p className="text-white text-sm font-medium drop-shadow-md">Click to Replace</p>
                        </div>

                        {!uploading && (
                            <button
                                onClick={clearImage}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors z-20 backdrop-blur-md"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full p-4 text-center">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Click to upload photo</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            Optimized as WebP (Max 1920px)
                        </p>
                    </div>
                )}

                {uploading && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-2" />
                        <p className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
                            Compressing with Sharp...
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs animate-in slide-in-from-top-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <p className="font-medium">{error}</p>
                </div>
            )}
        </div>
    );
};
