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
            className="w-full h-full"
        >
            <div
                onClick={handleClick}
                className={cn(
                    "relative w-full h-full group/file flex flex-col items-center justify-center p-4 sm:p-6 border-2 border-dashed border-zinc-200 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/30 rounded-2xl cursor-pointer bg-zinc-50 dark:bg-white/5 transition-all duration-200",
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

                <div className="flex flex-col items-center justify-center w-full h-full">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200",
                        isDragActive
                            ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20 scale-110"
                            : "bg-zinc-100 dark:bg-white/10 text-zinc-400 group-hover/file:bg-purple-500 group-hover/file:text-white group-hover/file:shadow-md"
                    )}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};
