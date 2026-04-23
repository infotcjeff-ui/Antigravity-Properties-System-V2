'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, ExternalLink, RefreshCw, Github, Cloud, Database, Layers, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Language = 'zh-TW' | 'en';

export default function SettingsPage() {
    const [language, setLanguage] = useState<Language>('zh-TW');
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState<'success' | 'error' | 'warning'>('success');
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const router = useRouter();

    const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [arcjetStatus, setArcjetStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
    const [tanstackInfo, setTanstackInfo] = useState({ queries: 0, stale: 0 });

    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        const saved = localStorage.getItem('app-language') as Language | null;
        if (saved) setLanguage(saved);
    }, [user, router]);

    const checkServices = useCallback(async () => {
        setSupabaseStatus('checking');
        try {
            const { error } = await supabase.from('app_users').select('id').limit(1);
            setSupabaseStatus(error ? 'offline' : 'online');
        } catch {
            setSupabaseStatus('offline');
        }

        const cache = queryClient.getQueryCache();
        const allQueries = cache.getAll();
        const staleQueries = allQueries.filter(q => q.isStale());
        setTanstackInfo({ queries: allQueries.length, stale: staleQueries.length });

        setArcjetStatus('checking');
        try {
            const res = await fetch('/api/security/status');
            if (res.ok) {
                const data = await res.json();
                setArcjetStatus(data.status);
            } else {
                setArcjetStatus('inactive');
            }
        } catch {
            setArcjetStatus('inactive');
        }
    }, [queryClient]);

    useEffect(() => {
        checkServices();
    }, [checkServices]);

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
                        <Check className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium text-sm sm:text-base leading-tight">{alertMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Globe className="w-6 h-6 text-purple-500 md:hidden" />
                    {t('系統設定', 'System Settings')}
                </h1>
                <p className="text-zinc-500 dark:text-white/50 mt-1">
                    {t('管理系統偏好設定和配置', 'Manage system preferences and configurations')}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    </div>
                </motion.div>

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

                        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-zinc-900 dark:text-white">Arcjet Security</span>
                                    <p className="text-xs text-zinc-500 dark:text-white/40">{t('安全性增強功能', 'Security enhancement')}</p>
                                </div>
                            </div>
                            {arcjetStatus === 'checking' ? (
                                <span className="px-2 py-1 rounded-md bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-white/40 text-xs font-medium flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    {t('檢查中', 'Checking')}
                                </span>
                            ) : arcjetStatus === 'active' ? (
                                <span className="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    {t('已啟動', 'Active')}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-md bg-zinc-500/10 text-zinc-500 text-xs font-medium flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                    {t('未配置', 'Inactive')}
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
