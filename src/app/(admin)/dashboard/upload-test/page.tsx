'use client';

import React, { useState } from 'react';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { Home, User, Info, Code } from 'lucide-react';

export default function ReusableUploadDemo() {
    const [propertyUrl, setPropertyUrl] = useState<string>('');
    const [avatarUrl, setAvatarUrl] = useState<string>('');

    const integrationCode = `
// Example Usage in a Form
import { ImageUploader } from '@/components/ui/ImageUploader';

const PropertyForm = () => {
    const [photoUrl, setPhotoUrl] = useState("");

    return (
        <ImageUploader 
            label="Property Photo"
            folder="properties" // Dynamic subdirectory
            aspectRatio="aspect-video" 
            onUploadComplete={(url) => setPhotoUrl(url)}
        />
    );
};
    `;

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-black p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <span className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-lg">
                            <Upload className="w-6 h-6 text-white" />
                        </span>
                        Global Image Uploader System
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                        Centrally managed image compression pipeline with Sharp & WebP.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Component Playground */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Property Example */}
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2 mb-6">
                                    <Home className="w-4 h-4 text-indigo-500" />
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Property Photo</h2>
                                </div>
                                <ImageUploader
                                    label="Upload Listing Image"
                                    folder="properties"
                                    onUploadComplete={setPropertyUrl}
                                />
                                {propertyUrl && (
                                    <div className="mt-4 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/50">
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono break-all">{propertyUrl}</p>
                                    </div>
                                )}
                            </div>

                            {/* Avatar Example */}
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2 mb-6">
                                    <User className="w-4 h-4 text-purple-500" />
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">User Avatar</h2>
                                </div>
                                <div className="max-w-[200px] mx-auto">
                                    <ImageUploader
                                        label="Profile Picture"
                                        folder="avatars"
                                        aspectRatio="aspect-square"
                                        onUploadComplete={setAvatarUrl}
                                    />
                                </div>
                                {avatarUrl && (
                                    <div className="mt-4 p-3 bg-purple-50/50 dark:bg-purple-900/20 rounded-xl border border-purple-100/50 dark:border-purple-800/50">
                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-mono break-all">{avatarUrl}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Integration Guide */}
                        <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group border border-white/5">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                                <Code className="w-32 h-32" />
                            </div>
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Code className="w-5 h-5 text-purple-400" />
                                Integration Guide
                            </h3>
                            <pre className="text-sm font-mono text-purple-200 bg-black/40 p-6 rounded-2xl border border-white/5 backdrop-blur-md overflow-x-auto">
                                {integrationCode}
                            </pre>
                        </div>
                    </div>

                    {/* Features & Architecture */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-indigo-500" />
                                System Core
                            </h3>
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-indigo-600">01</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">WebP Compression</p>
                                        <p className="text-xs text-gray-500">Industry standard for Next.js web performance.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-purple-600">02</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Dynamic Routing</p>
                                        <p className="text-xs text-gray-500">Auto-organizes files into category subfolders.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-pink-50 dark:bg-pink-900/20 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-pink-600">03</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Smart Resizing</p>
                                        <p className="text-xs text-gray-500">Maintains aspect ratio while capping width at 1920px.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[2.5rem] text-white shadow-xl">
                            <h4 className="font-bold mb-2">Architect's Note</h4>
                            <p className="text-sm text-indigo-100 leading-relaxed">
                                This implementation ensures that even if a user uploads a 20MB RAW image from a phone, it enters the server and is saved as a ~200KB WebP instantly.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Re-importing missing icon for local use
import { Upload } from 'lucide-react';
