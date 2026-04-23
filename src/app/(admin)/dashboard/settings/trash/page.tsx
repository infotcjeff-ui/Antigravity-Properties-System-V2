'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trash2,
    RotateCcw,
    Trash,
    Building2,
    Users,
    Receipt,
    AlertTriangle,
    Search,
    RefreshCw,
    XCircle,
    CheckCircle2,
    Calendar,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { useTrash } from '@/hooks/useStorage';
import Link from 'next/link';
import { format } from 'date-fns';

type TabType = 'properties' | 'proprietors' | 'rents';

export default function TrashPage() {
    const [activeTab, setActiveTab] = useState<TabType>('properties');
    const [searchQuery, setSearchQuery] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const { fetchTrash, restoreItem, permanentlyDeleteItem, emptyTrash, loading, error: trashError } = useTrash();

    const loadItems = useCallback(async () => {
        const data = await fetchTrash(activeTab);
        setItems(data);
        setSelectedItems([]);
    }, [activeTab, fetchTrash]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleRestore = async (id: string) => {
        setIsActionLoading(true);
        const success = await restoreItem(activeTab, id);
        if (success) {
            showFeedback('已成功還原項目');
            loadItems();
        } else {
            showFeedback('還原失敗', 'error');
        }
        setIsActionLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要永久刪除此項目嗎？此操作無法撤銷。')) return;

        setIsActionLoading(true);
        const success = await permanentlyDeleteItem(activeTab, id);
        if (success) {
            showFeedback('項目已永久刪除');
            loadItems();
        } else {
            showFeedback('刪除失敗', 'error');
        }
        setIsActionLoading(false);
    };

    const handleEmptyTrash = async () => {
        if (!confirm(`確定要清空所有已刪除的${getTabLabel(activeTab)}嗎？此操作無法撤銷。`)) return;

        setIsActionLoading(true);
        const success = await emptyTrash(activeTab);
        if (success) {
            showFeedback('垃圾桶已清空');
            loadItems();
        } else {
            showFeedback('清空失敗', 'error');
        }
        setIsActionLoading(false);
    };

    const getTabLabel = (tab: TabType) => {
        switch (tab) {
            case 'properties': return '物業';
            case 'proprietors': return '業主/承租人';
            case 'rents': return '租務記錄';
        }
    };

    const filteredItems = items.filter(item => {
        const search = searchQuery.toLowerCase();
        if (activeTab === 'properties') {
            return item.name?.toLowerCase().includes(search) || item.code?.toLowerCase().includes(search);
        }
        if (activeTab === 'proprietors') {
            return item.name?.toLowerCase().includes(search) || item.code?.toLowerCase().includes(search);
        }
        if (activeTab === 'rents') {
            return item.location?.toLowerCase().includes(search) || item.rentOutTenancyNumber?.toLowerCase().includes(search);
        }
        return true;
    });

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return '未知時間';
        try {
            return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
        } catch {
            return dateString;
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Warning Section */}
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">關於垃圾桶功能</h4>
                    <p className="text-xs mt-1 leading-relaxed opacity-80">
                        刪除的項目將在此處保留。還原項目後，它們將重新出現在各自的主列表中。永久刪除將不可恢復。
                        注意：如果您永久刪除一個物業，關聯到該物業的租務記錄可能也會受到影響。
                    </p>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-white/40 mb-1">
                        <Link href="/dashboard/settings" className="hover:text-purple-500 transition-colors text-sm">系統設定</Link>
                        <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-white/10" />
                        <span className="text-zinc-900 dark:text-white text-sm">垃圾桶</span>
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-500" />
                        </div>
                        垃圾桶管理
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadItems}
                        className="p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all"
                        title="刷新"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleEmptyTrash}
                        disabled={items.length === 0 || isActionLoading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        <Trash className="w-4 h-4" />
                        清空垃圾桶
                    </button>
                </div>
            </div>

            {/* Feedback Alert */}
            <AnimatePresence>
                {(feedback || trashError) && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`p-4 rounded-xl flex items-center gap-3 border ${(feedback?.type === 'success')
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                            }`}
                    >
                        {(feedback?.type === 'success') ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        <span className="font-medium text-sm">{feedback?.message || trashError}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex p-1 bg-zinc-100 dark:bg-white/5 rounded-xl w-full md:w-auto">
                    {(['properties', 'proprietors', 'rents'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                                ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-white shadow-sm'
                                : 'text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                        >
                            {tab === 'properties' && <Building2 className="w-4 h-4" />}
                            {tab === 'proprietors' && <Users className="w-4 h-4" />}
                            {tab === 'rents' && <Receipt className="w-4 h-4" />}
                            {getTabLabel(tab)}
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder={`搜尋${getTabLabel(activeTab)}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                </div>
            </div>

            {/* Content List */}
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-sm">
                {loading && items.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
                        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                        <p>載入中...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
                        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-4">
                            <Trash2 className="w-8 h-8 opacity-20" />
                        </div>
                        <p className="text-zinc-500 dark:text-white/40 font-medium">沒有找到已刪除的{getTabLabel(activeTab)}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-100 dark:border-white/5">
                                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">名稱 / 代碼</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">類型 / 狀態</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">刪除日期</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                {filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                                                    {activeTab === 'properties' && (item.images?.[0] ? (
                                                        <img src={item.images[0]} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <Building2 className="w-5 h-5 text-zinc-400" />
                                                    ))}
                                                    {activeTab === 'proprietors' && <Users className="w-5 h-5 text-zinc-400" />}
                                                    {activeTab === 'rents' && <Receipt className="w-5 h-5 text-zinc-400" />}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-zinc-900 dark:text-white">
                                                        {activeTab === 'rents' ? (item.location || '租務記錄') : item.name}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 dark:text-white/40 font-medium">
                                                        {activeTab === 'rents' ? (item.rentOutTenancyNumber || item.id?.slice(0, 8)) : item.code}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm text-zinc-900 dark:text-white capitalize">
                                                    {item.type?.replace('_', ' ') || 'N/A'}
                                                </span>
                                                <span className="text-xs text-zinc-500 dark:text-white/40">
                                                    {item.status || 'N/A'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-zinc-600 dark:text-white/60">
                                                <Calendar className="w-4 h-4 text-zinc-400" />
                                                <span className="text-sm">{formatDate(item.deletedAt)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleRestore(item.id)}
                                                    disabled={isActionLoading}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                    還原
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={isActionLoading}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                    永久刪除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
