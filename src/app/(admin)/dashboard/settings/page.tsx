'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe, Check, Sun, Moon, Image as ImageIcon, Trash2, Eye, X,
    ExternalLink, RefreshCw, AlertTriangle, HardDrive, FolderOpen,
    Github, Cloud, Database, Layers, CheckSquare, Square, XCircle
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Language = 'zh-TW' | 'en';

interface UploadedFile {
    filename: string;
    folder: string;
    url: string;
    size: number;
    sizeFormatted: string;
    lastModified: string;
}

interface UploadListResponse {
    files: UploadedFile[];
    totalSize: number;
    totalSizeFormatted: string;
}

export default function SettingsPage() {
    const [language, setLanguage] = useState<Language>('zh-TW');
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState<'success' | 'error' | 'warning'>('success');
    const { theme, setTheme } = useTheme();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const router = useRouter();

    // Uploaded files state
    const [uploads, setUploads] = useState<UploadedFile[]>([]);
    const [uploadsLoading, setUploadsLoading] = useState(false);
    const [totalSize, setTotalSize] = useState('0 B');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ files: UploadedFile[] } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Multi-select state
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [selectMode, setSelectMode] = useState(false);

    // Service status state
    const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [tanstackInfo, setTanstackInfo] = useState({ queries: 0, stale: 0 });

    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        const saved = localStorage.getItem('app-language') as Language | null;
        if (saved) setLanguage(saved);
    }, [user]);

    // Load uploads
    const loadUploads = useCallback(async () => {
        setUploadsLoading(true);
        try {
            const res = await fetch('/api/uploads/list');
            if (res.ok) {
                const data: UploadListResponse = await res.json();
                setUploads(data.files);
                setTotalSize(data.totalSizeFormatted);
            }
        } catch (err) {
            console.error('Failed to load uploads:', err);
        } finally {
            setUploadsLoading(false);
        }
    }, []);

    // Check service statuses
    const checkServices = useCallback(async () => {
        // Supabase
        setSupabaseStatus('checking');
        try {
            const { error } = await supabase.from('app_users').select('id').limit(1);
            setSupabaseStatus(error ? 'offline' : 'online');
        } catch {
            setSupabaseStatus('offline');
        }

        // TanStack Query
        const cache = queryClient.getQueryCache();
        const allQueries = cache.getAll();
        const staleQueries = allQueries.filter(q => q.isStale());
        setTanstackInfo({ queries: allQueries.length, stale: staleQueries.length });
    }, [queryClient]);

    useEffect(() => {
        loadUploads();
        checkServices();
    }, [loadUploads, checkServices]);

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setAlertMessage(message);
        setAlertType(type);
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 4000);
    };

    const changeLanguage = (newLang: Language) => {
        if (newLang === language) return;
        setLanguage(newLang);
        localStorage.setItem('app-language', newLang);
        document.documentElement.lang = newLang;
        window.dispatchEvent(new CustomEvent('language-change', { detail: newLang }));
        showToast(newLang === 'zh-TW' ? '語言已切換為繁體中文' : 'Language changed to English');
    };

    // Multi-select helpers
    const toggleFileSelect = (url: string) => {
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(url)) {
                next.delete(url);
            } else {
                next.add(url);
            }
            return next;
        });
    };

    const selectAll = () => {
        setSelectedFiles(new Set(uploads.map(f => f.url)));
    };

    const deselectAll = () => {
        setSelectedFiles(new Set());
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedFiles(new Set());
    };

    const handleDeleteSelected = () => {
        const filesToDelete = uploads.filter(f => selectedFiles.has(f.url));
        if (filesToDelete.length === 0) return;
        setDeleteConfirm({ files: filesToDelete });
    };

    const handleDeleteSingle = (file: UploadedFile) => {
        setDeleteConfirm({ files: [file] });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            let deletedCount = 0;
            let allAffected: string[] = [];

            for (const file of deleteConfirm.files) {
                const res = await fetch('/api/uploads/delete', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: file.url }),
                });
                const data = await res.json();
                if (res.ok) {
                    deletedCount++;
                    const affected = data.affectedProperties || [];
                    allAffected.push(...affected.map((p: any) => p.name));
                }
            }

            if (deletedCount > 0) {
                const uniqueAffected = [...new Set(allAffected)];
                if (uniqueAffected.length > 0) {
                    showToast(`已刪除 ${deletedCount} 個檔案。影響的物業: ${uniqueAffected.join(', ')}`, 'warning');
                } else {
                    showToast(`已成功刪除 ${deletedCount} 個檔案`);
                }
                setSelectedFiles(new Set());
                loadUploads();
            } else {
                showToast('刪除失敗', 'error');
            }
        } catch {
            showToast('刪除失敗', 'error');
        } finally {
            setDeleting(false);
            setDeleteConfirm(null);
        }
    };

    const t = (zhTW: string, en: string) => language === 'zh-TW' ? zhTW : en;

    const toastColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
    };

    return (
        <div className="space-y-6">
            {/* Toast */}
            <AnimatePresence>
                {showAlert && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        className={`fixed top-6 left-1/2 z-50 px-6 py-3 ${toastColors[alertType]} text-white rounded-xl shadow-lg flex items-center gap-3`}
                    >
                        <Check className="w-5 h-5" />
                        <span className="font-medium">{alertMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Preview Modal */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
                        onClick={() => setPreviewImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.8 }}
                            className="relative max-w-4xl max-h-[85vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center z-10 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                            >
                                <X className="w-4 h-4 text-zinc-600 dark:text-white" />
                            </button>
                            <img
                                src={previewImage}
                                alt="Preview"
                                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => !deleting && setDeleteConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-white">確認刪除</h3>
                                    <p className="text-sm text-zinc-500 dark:text-white/50">此操作無法復原</p>
                                </div>
                            </div>

                            <div className="mb-4 p-3 bg-zinc-50 dark:bg-white/5 rounded-xl max-h-32 overflow-y-auto">
                                {deleteConfirm.files.length === 1 ? (
                                    <>
                                        <p className="text-sm text-zinc-700 dark:text-white/70 break-all">
                                            <span className="font-medium">檔案: </span>{deleteConfirm.files[0].filename}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mt-1">
                                            路徑: {deleteConfirm.files[0].url}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/70 mb-2">
                                            即將刪除 {deleteConfirm.files.length} 個檔案:
                                        </p>
                                        {deleteConfirm.files.map(f => (
                                            <p key={f.url} className="text-xs text-zinc-500 dark:text-white/50 truncate">
                                                • {f.filename}
                                            </p>
                                        ))}
                                    </>
                                )}
                            </div>

                            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl mb-5 border border-amber-200 dark:border-amber-500/20">
                                <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        刪除圖片可能會影響使用這些圖片的物業頁面顯示。受影響的圖片將無法再顯示。
                                    </span>
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    disabled={deleting}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-white/70 font-medium hover:bg-zinc-50 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={deleting}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    {deleteConfirm.files.length > 1 ? `刪除 ${deleteConfirm.files.length} 個` : '確認刪除'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('系統設定', 'System Settings')}
                </h1>
                <p className="text-zinc-500 dark:text-white/50 mt-1">
                    {t('管理系統偏好設定和配置', 'Manage system preferences and configurations')}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Settings - Language & Theme */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {t('一般設定', 'General')}
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-white/40">
                                {t('語言與地區設定', 'Language and region settings')}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-zinc-700 dark:text-white/70">
                                    {t('顯示語言', 'Display Language')}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => changeLanguage('zh-TW')}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${language === 'zh-TW'
                                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    繁體中文
                                </button>
                                <button
                                    onClick={() => changeLanguage('en')}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${language === 'en'
                                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    English
                                </button>
                            </div>
                        </div>

                        {/* Theme Toggle */}
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-zinc-700 dark:text-white/70">
                                    {t('顯示模式', 'Display Mode')}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${theme === 'light'
                                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    <Sun className="w-4 h-4" />
                                    {t('淺色模式', 'Light')}
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${theme === 'dark'
                                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    <Moon className="w-4 h-4" />
                                    {t('深色模式', 'Dark')}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Service Status */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Cloud className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                    {t('服務狀態', 'Service Status')}
                                </h2>
                                <p className="text-sm text-zinc-500 dark:text-white/40">
                                    {t('外部服務連線狀態', 'External service connections')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={checkServices}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {/* GitHub */}
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
                                    <Github className="w-4 h-4 text-white dark:text-zinc-900" />
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-zinc-900 dark:text-white">GitHub</span>
                                    <p className="text-xs text-zinc-500 dark:text-white/40">{t('源碼儲存庫', 'Source repository')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                    {t('已連結', 'Linked')}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </a>

                        {/* Vercel */}
                        <a
                            href="https://vercel.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white dark:text-zinc-900" viewBox="0 0 76 65" fill="currentColor">
                                        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                                    </svg>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-zinc-900 dark:text-white">Vercel</span>
                                    <p className="text-xs text-zinc-500 dark:text-white/40">{t('部署平台', 'Deployment platform')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                    {t('已部署', 'Deployed')}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </a>

                        {/* Supabase */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                    <Database className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-zinc-900 dark:text-white">Supabase</span>
                                    <p className="text-xs text-zinc-500 dark:text-white/40">{t('資料庫服務', 'Database service')}</p>
                                </div>
                            </div>
                            {supabaseStatus === 'checking' ? (
                                <span className="px-2 py-1 rounded-md bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-white/40 text-xs font-medium flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    {t('檢查中', 'Checking')}
                                </span>
                            ) : supabaseStatus === 'online' ? (
                                <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {t('連線中', 'Online')}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs font-medium flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    {t('離線', 'Offline')}
                                </span>
                            )}
                        </div>

                        {/* TanStack Query */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                                    <Layers className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-zinc-900 dark:text-white">TanStack Query</span>
                                    <p className="text-xs text-zinc-500 dark:text-white/40">{t('查詢快取管理', 'Query cache management')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                                    {tanstackInfo.queries} {t('查詢', 'queries')}
                                </span>
                                {tanstackInfo.stale > 0 && (
                                    <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                                        {tanstackInfo.stale} {t('過期', 'stale')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Uploaded Images Section - Full Width */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {t('已上載', 'Uploaded Files')}
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-white/40">
                                {t('管理所有已上載的圖片檔案', 'Manage all uploaded image files')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-500 dark:text-white/50" />
                            <span className="text-xs font-medium text-zinc-600 dark:text-white/60">
                                {uploads.length} {t('個檔案', 'files')} · {totalSize}
                            </span>
                        </div>
                        <button
                            onClick={loadUploads}
                            disabled={uploadsLoading}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${uploadsLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Multi-select toolbar */}
                {uploads.length > 0 && (
                    <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                        {selectMode ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={exitSelectMode}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        {t('取消選擇', 'Cancel')}
                                    </button>
                                    <span className="text-sm text-zinc-500 dark:text-white/40">
                                        {t(`已選 ${selectedFiles.size} 個`, `${selectedFiles.size} selected`)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={selectedFiles.size === uploads.length ? deselectAll : selectAll}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                        {selectedFiles.size === uploads.length ? t('取消全選', 'Deselect All') : t('全選', 'Select All')}
                                    </button>
                                    <button
                                        onClick={handleDeleteSelected}
                                        disabled={selectedFiles.size === 0}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {t(`刪除 (${selectedFiles.size})`, `Delete (${selectedFiles.size})`)}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-between w-full">
                                <span className="text-sm text-zinc-500 dark:text-white/40">
                                    {t('點擊圖片可預覽，懸停可刪除', 'Click to preview, hover to delete')}
                                </span>
                                <button
                                    onClick={() => setSelectMode(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 transition-all"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    {t('多選模式', 'Multi-Select')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {uploadsLoading && uploads.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
                    </div>
                ) : uploads.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl">
                        <ImageIcon className="w-10 h-10 text-zinc-300 dark:text-white/20 mx-auto mb-3" />
                        <p className="text-zinc-500 dark:text-white/40 text-sm">
                            {t('尚未上載任何圖片', 'No files uploaded yet')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {uploads.map((file) => {
                            const isSelected = selectedFiles.has(file.url);
                            return (
                                <motion.div
                                    key={file.url}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`group relative bg-zinc-50 dark:bg-white/5 rounded-xl border overflow-hidden transition-all hover:shadow-lg ${isSelected
                                            ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-purple-500/10'
                                            : 'border-zinc-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30'
                                        }`}
                                >
                                    {/* Selection checkbox overlay */}
                                    {selectMode && (
                                        <button
                                            onClick={() => toggleFileSelect(file.url)}
                                            className="absolute top-2 left-2 z-10"
                                        >
                                            {isSelected ? (
                                                <div className="w-6 h-6 rounded-md bg-purple-500 flex items-center justify-center shadow-lg">
                                                    <Check className="w-4 h-4 text-white" />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-md bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-300 dark:border-white/20 flex items-center justify-center shadow-sm hover:border-purple-400 transition-colors">
                                                    <Square className="w-3.5 h-3.5 text-zinc-400" />
                                                </div>
                                            )}
                                        </button>
                                    )}

                                    {/* Image Thumbnail */}
                                    <div
                                        className="aspect-square relative cursor-pointer overflow-hidden"
                                        onClick={() => {
                                            if (selectMode) {
                                                toggleFileSelect(file.url);
                                            } else {
                                                setPreviewImage(file.url);
                                            }
                                        }}
                                    >
                                        <img
                                            src={file.url}
                                            alt={file.filename}
                                            className={`w-full h-full object-cover transition-transform duration-300 ${selectMode ? '' : 'group-hover:scale-105'
                                                } ${isSelected ? 'opacity-80' : ''}`}
                                            loading="lazy"
                                        />
                                        {/* Hover overlay (only in non-select mode) */}
                                        {!selectMode && (
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                                <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100" />
                                            </div>
                                        )}
                                    </div>

                                    {/* File Info */}
                                    <div className="p-2.5">
                                        <p className="text-xs font-medium text-zinc-700 dark:text-white/70 truncate" title={file.filename}>
                                            {file.filename}
                                        </p>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <div className="flex items-center gap-1.5">
                                                {file.folder && (
                                                    <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 dark:text-white/40 bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                                        <FolderOpen className="w-2.5 h-2.5" />
                                                        {file.folder}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-zinc-500 dark:text-white/40">
                                                    {file.sizeFormatted}
                                                </span>
                                            </div>
                                            {!selectMode && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSingle(file);
                                                    }}
                                                    className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                    title={t('刪除', 'Delete')}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
