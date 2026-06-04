'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Check } from 'lucide-react';

export interface CompressionSettingsState {
    quality: number;
    maxWidth: number;
    maxHeight: number;
}

const STORAGE_KEY = 'compression-settings';

interface CompressionSettingsProps {
    value: CompressionSettingsState;
    onChange: (settings: CompressionSettingsState) => void;
    language?: 'zh-TW' | 'en';
}

export const CompressionSettings: React.FC<CompressionSettingsProps> = ({
    value,
    onChange,
    language = 'zh-TW',
}) => {
    const [localSettings, setLocalSettings] = useState<CompressionSettingsState>(value);
    const [saved, setSaved] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as CompressionSettingsState;
                setLocalSettings(parsed);
                onChange(parsed);
            } catch {}
        }
    }, []);

    const handleChange = useCallback((key: keyof CompressionSettingsState, newValue: number) => {
        const updated = { ...localSettings, [key]: newValue };
        setLocalSettings(updated);
        onChange(updated);
    }, [localSettings, onChange]);

    const handleSave = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localSettings));
        onChange(localSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    }, [localSettings, onChange]);

    const t = (zh: string, en: string) => language === 'zh-TW' ? zh : en;

    if (!isMounted) return null;

    return (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            {/* Header */}
            <div className="bg-linear-to-r from-slate-800 via-slate-700 to-zinc-800 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <Settings className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">{t('壓縮設定', 'Compression Settings')}</h2>
                        <p className="text-[10px] text-white/40">{t('調整圖片上傳時的壓縮參數', 'Adjust compression parameters for image uploads')}</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="p-5 space-y-5">
                {/* Image Quality */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-600 dark:text-white/70">
                            {t('圖片質量', 'Image Quality')}
                        </label>
                        <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                            {localSettings.quality}%
                        </span>
                    </div>
                    <div className="relative">
                        <div className="h-1.5 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-linear-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-200"
                                style={{ width: `${localSettings.quality}%` }}
                            />
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={localSettings.quality}
                            onChange={(e) => handleChange('quality', parseInt(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                </div>

                {/* Max Width */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-600 dark:text-white/70">
                            {t('最大寬度', 'Max Width')}
                        </label>
                        <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                            {localSettings.maxWidth}px
                        </span>
                    </div>
                    <div className="relative">
                        <div className="h-1.5 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-linear-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-200"
                                style={{ width: `${(localSettings.maxWidth / 4000) * 100}%` }}
                            />
                        </div>
                        <input
                            type="range"
                            min="200"
                            max="4000"
                            step="100"
                            value={localSettings.maxWidth}
                            onChange={(e) => handleChange('maxWidth', parseInt(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                </div>

                {/* Max Height */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-600 dark:text-white/70">
                            {t('最大高度', 'Max Height')}
                        </label>
                        <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                            {localSettings.maxHeight}px
                        </span>
                    </div>
                    <div className="relative">
                        <div className="h-1.5 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-linear-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-200"
                                style={{ width: `${(localSettings.maxHeight / 4000) * 100}%` }}
                            />
                        </div>
                        <input
                            type="range"
                            min="200"
                            max="4000"
                            step="100"
                            value={localSettings.maxHeight}
                            onChange={(e) => handleChange('maxHeight', parseInt(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                </div>

                {/* 保存設定按鈕 */}
                <button
                    onClick={handleSave}
                    className={`
                        relative w-full py-2.5 px-4 rounded-xl overflow-hidden font-bold text-sm text-white shadow-lg transition-all duration-300
                        ${saved
                            ? 'bg-green-500 hover:bg-green-500'
                            : 'bg-linear-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-600 hover:via-blue-600 hover:to-indigo-600'
                        }
                        active:scale-[0.98]
                    `}
                >
                    <span className="relative flex items-center justify-center gap-2">
                        {saved ? (
                            <>
                                <Check className="w-4 h-4" />
                                {t('已保存', 'Saved')}
                            </>
                        ) : (
                            <>
                                <Settings className="w-4 h-4" />
                                {t('保存設定', 'Save Settings')}
                            </>
                        )}
                    </span>
                </button>

                {/* 說明文字 */}
                <p className="text-[10px] text-zinc-400 dark:text-white/30 text-center leading-relaxed">
                    {t('此設定會套用到所有圖片上傳流程', 'This setting applies to all image upload processes')}
                </p>
            </div>
        </div>
    );
};
