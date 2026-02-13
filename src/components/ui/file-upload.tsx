"use client";

import { cn } from "@/lib/utils";
import React, { useRef, useState } from "react";
import { IconUpload } from "@tabler/icons-react";
import { useDropzone } from "react-dropzone";

export const FileUpload = ({
    onChange,
}: {
    onChange?: (files: File[]) => void;
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (newFiles: File[]) => {
        onChange && onChange(newFiles);
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const { getRootProps, isDragActive } = useDropzone({
        multiple: true, // Allow multiple as per PropertyForm usage
        noClick: true,
        onDrop: handleFileChange,
    });

    return (
        <div
            {...getRootProps()}
            className="w-full"
        >
            <div
                onClick={handleClick}
                className={cn(
                    "relative group/file flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200",
                    isDragActive
                        ? "border-purple-500 bg-purple-50/50 dark:bg-purple-500/5"
                        : "border-zinc-200 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/30 bg-zinc-50 dark:bg-white/5"
                )}
            >
                <input
                    ref={fileInputRef}
                    id="file-upload-handle"
                    type="file"
                    onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
                    className="hidden"
                    multiple
                />

                <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
                        isDragActive
                            ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                            : "bg-white dark:bg-zinc-800 text-zinc-400 group-hover/file:text-purple-500 shadow-sm"
                    )}>
                        <IconUpload className="w-6 h-6" />
                    </div>

                    <div className="text-center">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                            {isDragActive ? "Drop files here" : "Upload file"}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Drag or drop your files here or click to browse
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
