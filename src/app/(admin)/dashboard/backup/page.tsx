'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database, Image as ImageIcon, Download, RefreshCw,
    Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
    HardDrive, Archive, Eye, Trash2, Lock, Loader2,
    FileJson, FileImage, Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface BackupRecord {
    id: string;
    filename: string;
    size: number;
    sizeFormatted: string;
    created_at: string;
    recordCount: number;
}

export default function BackupPage() {
    const [language, setLanguage] = useState<'zh-TW' | 'en'>('zh-TW');
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState<'success' | 'error' | 'warning'>('success');
    const { user } = useAuth();
    const router = useRouter();

    const [backups, setBackups] = useState<BackupRecord[]>([]);
    const [backupsLoading, setBackupsLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [progress, setProgress] = useState('');
    const [previewData, setPreviewData] = useState<any>(null);

    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        const saved = localStorage.getItem('app-language') as 'zh-TW' | 'en' | null;
        if (saved) setLanguage(saved);
    }, [user, router]);

    const loadBackups = useCallback(async () => {
        setBackupsLoading(true);
        try {
            const res = await fetch('/api/backup');
            if (res.ok) {
                const data = await res.json();
                setBackups(data.backups || []);
            }
        } catch (err) {
            console.error('Failed to load backups:', err);
        } finally {
            setBackupsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBackups();
    }, [loadBackups]);

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setAlertMessage(message);
        setAlertType(type);
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 4000);
    };

    const handleCreateBackup = async () => {
        if (!window.confirm(
            language === 'zh-TW'
                ? '確定要建立備份嗎？\n此操作會滙出所有最新資料並上載到 Storage。\n請注意：下載時需使用密碼 @tcjeff09 解壓。'
                : 'Create backup now?\nThis will export all latest data to Storage.\nNote: Use password @tcjeff09 to extract.'
        )) return;

        setCreating(true);
        setProgress(language === 'zh-TW' ? '正在準備備份...' : 'Preparing backup...');

        try {
            const res = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: '@tcjeff09' }),
            });

            const data = await res.json();

            if (res.ok) {
                showToast(
                    language === 'zh-TW'
                        ? `備份成功！共 ${data.recordCount} 筆記錄`
                        : `Backup created! ${data.recordCount} records exported`,
                    'success'
                );
                loadBackups();
            } else {
                showToast(data.error || (language === 'zh-TW' ? '備份失敗' : 'Backup failed'), 'error');
            }
        } catch {
            showToast(language === 'zh-TW' ? '備份失敗' : 'Backup failed', 'error');
        } finally {
            setCreating(false);
            setProgress('');
        }
    };

    const handlePreview = async (backup: BackupRecord) => {
        try {
            const res = await fetch(`/api/backup?preview=${backup.id}`);
            if (res.ok) {
                const data = await res.json();
                setPreviewData(data);
            }
        } catch {
            showToast(language === 'zh-TW' ? '無法預覽' : 'Preview failed', 'error');
        }
    };

    const handleDelete = async (backup: BackupRecord) => {
        if (!window.confirm(
            language === 'zh-TW'
                ? `確定要刪除備份「${backup.filename}」嗎？`
                : `Delete backup "${backup.filename}"?`
        )) return;

        try {
            const res = await fetch(`/api/backup?id=${backup.id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast(language === 'zh-TW' ? '已刪除備份' : 'Backup deleted');
                loadBackups();
            } else {
                showToast(language === 'zh-TW' ? '刪除失敗' : 'Delete failed', 'error');
            }
        } catch {
            showToast(language === 'zh-TW' ? '刪除失敗' : 'Delete failed', 'error');
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
            <AnimatePresence>
                {showAlert && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 w-[90%] max-w-sm ${toastColors[alertType]} text-white rounded-xl shadow-lg shadow-black/20 flex items-center gap-3 backdrop-blur-sm bg-opacity-90`}
                    >
                        <RefreshCw className="w-5 h-5 shrink-0" />
                        <span className="font-medium text-sm sm:text-base leading-tight">{alertMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {previewData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => setPreviewData(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 max-w-2xl w-full border border-zinc-200 dark:border-white/10 max-h-[80vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Eye className="w-5 h-5" />
                                    {t('備份預覽', 'Backup Preview')}
                                </h3>
                                <button
                                    onClick={() => setPreviewData(null)}
                                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    <XCircle className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {Object.entries(previewData).map(([key, value]) => {
                                    const val = value as any;
                                    if (Array.isArray(val)) {
                                        return (
                                            <div key={key} className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl">
                                                <p className="text-sm font-medium text-zinc-700 dark:text-white/70 flex items-center gap-2 mb-2">
                                                    <Database className="w-4 h-4" />
                                                    {key} ({val.length} {t('筆記錄', 'records')})
                                                </p>
                                                {val.length > 0 && (
                                                    <pre className="text-xs text-zinc-500 dark:text-white/40 overflow-x-auto max-h-40 bg-zinc-100 dark:bg-black/20 rounded p-2">
                                                        {JSON.stringify(val.slice(0, 2), null, 2)}
                                                        {val.length > 2 && `\n... ${val.length - 2} more`}
                                                    </pre>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Archive className="w-6 h-6 text-purple-500" />
                    {t('資料備份', 'Data Backup')}
                </h1>
                <p className="text-zinc-500 dark:text-white/50 mt-1">
                    {t('滙出並加密所有最新資料', 'Export and encrypt all latest data')}
                </p>
            </div>

            {/* Info Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 rounded-2xl border border-purple-200 dark:border-purple-500/20"
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            {t('加密備份', 'Encrypted Backup')}
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-medium">
                                <Lock className="w-3 h-3" />
                                AES-256-GCM
                            </span>
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-white/60 mt-1 leading-relaxed">
                            {t(
                                '所有備份均使用 AES-256-GCM 加密保護。下載後需使用密碼 @tcjeff09 解壓縮。此密碼僅供內部使用，請勿對外分享。',
                                'All backups are protected with AES-256-GCM encryption. Extract using password @tcjeff09 after download. This password is for internal use only — do not share.'
                            )}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Create Backup Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <Database className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {t('建立新備份', 'Create New Backup')}
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-white/40">
                                {t('滙出 properties, proprietors, rents, sub_landlords, current_tenants 等所有資料', 'Export all data: properties, proprietors, rents, sub_landlords, current_tenants')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCreateBackup}
                        disabled={creating}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>{progress || (language === 'zh-TW' ? '建立中...' : 'Creating...')}</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                <span>{t('建立備份', 'Create Backup')}</span>
                            </>
                        )}
                    </button>
                </div>

                {creating && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                        <p className="text-sm text-blue-600 dark:text-blue-300 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            {progress}
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Backup History */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Archive className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {t('備份記錄', 'Backup History')}
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-white/40">
                                {t('已加密的備份檔案列表', 'Encrypted backup file list')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadBackups}
                        disabled={backupsLoading}
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${backupsLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {backupsLoading && backups.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
                    </div>
                ) : backups.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl">
                        <Archive className="w-10 h-10 text-zinc-300 dark:text-white/20 mx-auto mb-3" />
                        <p className="text-zinc-500 dark:text-white/40 text-sm">
                            {t('尚無備份記錄', 'No backup records yet')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {backups.map((backup) => (
                            <div
                                key={backup.id}
                                className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-500/20 transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-900 dark:text-white text-sm">
                                            {backup.filename}
                                        </p>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-xs text-zinc-500 dark:text-white/40 flex items-center gap-1">
                                                <HardDrive className="w-3 h-3" />
                                                {backup.sizeFormatted}
                                            </span>
                                            <span className="text-xs text-zinc-500 dark:text-white/40 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(backup.created_at).toLocaleString('zh-TW')}
                                            </span>
                                            <span className="text-xs text-zinc-500 dark:text-white/40 flex items-center gap-1">
                                                <FileJson className="w-3 h-3" />
                                                {backup.recordCount} {t('筆記錄', 'records')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePreview(backup)}
                                        className="p-2 rounded-lg text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                                        title={t('預覽', 'Preview')}
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <a
                                        href={`/api/backup?download=${backup.id}`}
                                        className="p-2 rounded-lg text-zinc-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-all"
                                        title={t('下載', 'Download')}
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                    <button
                                        onClick={() => handleDelete(backup)}
                                        className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                        title={t('刪除', 'Delete')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Data Scope */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10"
            >
                <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-zinc-500" />
                    {t('備份範圍', 'Backup Scope')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { name: 'Properties', zh: '物業', icon: <FileJson className="w-4 h-4" /> },
                        { name: 'Proprietors', zh: '業主', icon: <FileJson className="w-4 h-4" /> },
                        { name: 'Rents', zh: '租務', icon: <FileJson className="w-4 h-4" /> },
                        { name: 'Sub-landlords', zh: '二房東', icon: <FileJson className="w-4 h-4" /> },
                        { name: 'Current Tenants', zh: '現時租客', icon: <FileJson className="w-4 h-4" /> },
                        { name: 'Storage Images', zh: '圖片檔案', icon: <FileImage className="w-4 h-4" /> },
                    ].map(item => (
                        <div key={item.name} className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-white/5">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                                {item.icon}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{item.zh}</p>
                                <p className="text-xs text-zinc-500 dark:text-white/40">{item.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
