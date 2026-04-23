'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import type { Property } from '@/lib/db';
import Link from 'next/link';
import { useProperties, usePropertiesQuery, useUsersQuery } from '@/hooks/useStorage';
import PropertyForm from '@/components/properties/PropertyForm';
import { Building2, Plus, Search, Pencil, Trash2, Eye, CheckSquare, Square, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedSelect from '@/components/ui/AnimatedSelect';
import { formatLotArea, formatLotIndexPlainJoined } from '@/lib/formatters';
import { useLanguage } from '@/components/common/LanguageSwitcher';

const statusColors: Record<string, string> = {
    holding: 'bg-emerald-600 dark:bg-emerald-500/80 text-white',
    renting: 'bg-blue-500/20 text-blue-400',
    sold: 'bg-gray-500/20 text-gray-400',
    suspended: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    holding: '持有中',
    renting: '出租中',
    sold: '已售出',
    suspended: '已暫停',
};

const typeLabels: Record<string, string> = {
    group_asset: '集團資產',
    co_investment: '合作投資',
    external_lease: '外租物業',
    managed_asset: '代管資產',
};

export default function ManagePropertiesPage() {
    const queryClient = useQueryClient();
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);
    const { data: qProperties, isLoading: propertiesLoading } = usePropertiesQuery();
    const { data: users, isLoading: usersLoading } = useUsersQuery();
    const isLoading = propertiesLoading || usersLoading;

    // Create user lookup map
    const userMap = useMemo(() => {
        const map: Record<string, string> = {};
        users?.forEach(u => {
            map[u.id] = u.displayName || u.username;
        });
        return map;
    }, [users]);
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    const { deleteProperty } = useProperties();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingProperty, setEditingProperty] = useState<Property | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkUploaderModal, setShowBulkUploaderModal] = useState(false);
    const [selectedBulkUploader, setSelectedBulkUploader] = useState('');
    const { bulkUpdateProperties } = useProperties();

    // Filter properties based on search query, type, and status (client-side for instant feedback)
    const filteredProperties = useMemo(() => {
        let properties = qProperties || [];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            properties = properties.filter((p: Property) =>
                p.name.toLowerCase().includes(query) ||
                p.code.toLowerCase().includes(query) ||
                p.address.toLowerCase().includes(query)
            );
        }

        if (filterType) {
            properties = properties.filter((p: Property) => p.type === filterType);
        }

        if (filterStatus) {
            properties = properties.filter((p: Property) => p.status === filterStatus);
        }

        return properties;
    }, [qProperties, searchQuery, filterType, filterStatus]);

    const sortedProperties = useMemo(() => {
        return [...filteredProperties].sort((a, b) =>
            (a.code || '').trim().localeCompare((b.code || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [filteredProperties]);

    const handleEdit = (property: Property) => {
        setEditingProperty(property);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        await deleteProperty(id);
        setDeleteConfirm(null);
        // Invalidate query to refetch
        queryClient.invalidateQueries({ queryKey: ['properties'] });
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingProperty(null);
    };

    const handleFormSuccess = () => {
        handleFormClose();
        // Invalidate query to refetch
        queryClient.invalidateQueries({ queryKey: ['properties'] });
        // Force a page refresh as requested by the user
        window.location.reload();
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === sortedProperties.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(sortedProperties.map(p => p.id!));
        }
    };

    const handleBulkUploaderUpdate = async () => {
        if (!selectedBulkUploader || selectedIds.length === 0) return;

        const success = await bulkUpdateProperties(selectedIds, { createdBy: selectedBulkUploader });
        if (success) {
            setShowBulkUploaderModal(false);
            setSelectedIds([]);
            setSelectedBulkUploader('');
            queryClient.invalidateQueries({ queryKey: ['properties'] });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">物業概覽</h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">管理所有物業資產</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 min-w-0 max-w-md">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜尋物業名稱 / 編號..."
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all cursor-pointer min-w-[140px]"
                >
                    <option value="">全部類型</option>
                    <option value="group_asset">集團資產</option>
                    <option value="co_investment">合作投資</option>
                    <option value="external_lease">外租物業</option>
                    <option value="managed_asset">代管資產</option>
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all cursor-pointer min-w-[140px]"
                >
                    <option value="">全部狀態</option>
                    <option value="holding">持有中</option>
                    <option value="renting">出租中</option>
                    <option value="sold">已售出</option>
                    <option value="suspended">已暫停</option>
                </select>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center min-h-[40vh]">
                    <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-10 h-10 rounded-full bg-purple-500"
                    />
                </div>
            ) : (
                <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none">
                    {sortedProperties.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 dark:text-white/20">
                            <Building2 className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-xl font-medium text-zinc-500 dark:text-white/40">找不到物業</p>
                            <p className="text-sm mt-2 opacity-70">新增物業以開始管理</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <table className="w-full hidden md:table">
                                <thead>
                                    <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-zinc-100 dark:border-white/5">
                                        {isAdmin && (
                                            <th className="px-4 py-3">
                                                <button
                                                    onClick={toggleSelectAll}
                                                    className="text-zinc-400 hover:text-purple-500 transition-colors"
                                                >
                                                    {selectedIds.length === sortedProperties.length && sortedProperties.length > 0 ? (
                                                        <CheckSquare className="w-5 h-5 text-purple-500" />
                                                    ) : (
                                                        <Square className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </th>
                                        )}
                                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">編號</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">名稱</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">地段</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">地段面積</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">類型</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">狀態</th>
                                        {isAdmin && (
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">上載者</th>
                                        )}
                                        <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedProperties.map((property, index) => (
                                        <motion.tr
                                            key={property.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className={`border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors ${selectedIds.includes(property.id!) ? 'bg-purple-50/50 dark:bg-purple-500/5' : ''}`}
                                        >
                                            {isAdmin && (
                                                <td className="px-4 py-4">
                                                    <button
                                                        onClick={() => toggleSelect(property.id!)}
                                                        className="text-zinc-400 hover:text-purple-500 transition-colors"
                                                    >
                                                        {selectedIds.includes(property.id!) ? (
                                                            <CheckSquare className="w-5 h-5 text-purple-500" />
                                                        ) : (
                                                            <Square className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="p-4 text-zinc-600 dark:text-white/70">{property.code}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    {property.images?.[0] ? (
                                                        <img
                                                            src={property.images[0]}
                                                            alt={property.name}
                                                            className="w-10 h-10 rounded-lg object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                                                            <Building2 className="w-5 h-5 text-zinc-400 dark:text-white/30" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-zinc-900 dark:text-white font-medium">{property.name}</p>
                                                        {property.address && (
                                                            <p className="text-zinc-500 dark:text-white/40 text-xs truncate max-w-[200px]">{property.address}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {(() => {
                                                    const text = formatLotIndexPlainJoined(property.lotIndex);
                                                    if (!text) return <span className="text-zinc-600 dark:text-white/70 text-sm">-</span>;
                                                    return <span className="text-zinc-600 dark:text-white/70 text-sm">{text}</span>;
                                                })()}
                                            </td>
                                            <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">{formatLotArea(property.lotArea)}</td>
                                            <td className="p-4 text-zinc-600 dark:text-white/70">{typeLabels[property.type]}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[property.status]}`}>
                                                    {statusLabels[property.status]}
                                                </span>
                                            </td>
                                            {isAdmin && (
                                                <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">
                                                    {property.createdBy ? (userMap[property.createdBy] || 'Unknown') : '-'}
                                                </td>
                                            )}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* View */}
                                                    <Link href={`/properties/${property.id}`}>
                                                        <motion.button
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                                            title="查看"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </motion.button>
                                                    </Link>
                                                    {/* Edit */}
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        onClick={() => handleEdit(property)}
                                                        className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                                                        title="編輯"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </motion.button>
                                                    {/* Delete */}
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        onClick={() => setDeleteConfirm(property.id!)}
                                                        className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                                        title="刪除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </motion.button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Mobile Card View */}
                            <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                                {sortedProperties.map((property, index) => (
                                    <motion.div
                                        key={property.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="mobile-card space-y-4"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                {property.images?.[0] ? (
                                                    <img
                                                        src={property.images[0]}
                                                        alt={property.name}
                                                        className="w-12 h-12 rounded-xl object-cover shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center border border-zinc-200 dark:border-white/10">
                                                        <Building2 className="w-6 h-6 text-zinc-400 dark:text-white/30" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-zinc-900 dark:text-white truncate">{property.name}</h3>
                                                    <p className="text-xs text-zinc-500 dark:text-white/40 font-mono tracking-tight">{property.code}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[property.status]}`}>
                                                    {statusLabels[property.status]}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-4 py-3 border-y border-zinc-100 dark:border-white/5`}>
                                            <div>
                                                <p className="text-[10px] text-zinc-400 dark:text-white/30 uppercase font-medium">類型</p>
                                                <p className="text-sm text-zinc-900 dark:text-white font-medium">{typeLabels[property.type]}</p>
                                            </div>
                                            {isAdmin && (
                                                <div>
                                                    <p className="text-[10px] text-zinc-400 dark:text-white/30 uppercase font-medium">上載者</p>
                                                    <p className="text-sm text-zinc-900 dark:text-white font-medium">{property.createdBy ? (userMap[property.createdBy] || 'Unknown') : '-'}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/properties/${property.id}`} className="p-2.5 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-white/40 active:bg-zinc-200 dark:active:bg-white/10 transition-colors">
                                                    <Eye className="w-5 h-5" />
                                                </Link>
                                                <button onClick={() => handleEdit(property)} className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 active:bg-purple-100 dark:active:bg-purple-500/20 transition-colors">
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <button onClick={() => setDeleteConfirm(property.id!)} className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 active:bg-red-100 dark:active:bg-red-500/20 transition-colors">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

            )}

            {/* Property Form Modal */}
            <AnimatePresence>
                {showForm && (
                    <PropertyForm
                        property={editingProperty}
                        onClose={handleFormClose}
                        onSuccess={handleFormSuccess}
                    />
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirm(null)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 z-50 shadow-2xl"
                        >
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                {t('Delete this property?', '刪除此物業？')}
                            </h3>
                            <p className="text-zinc-500 dark:text-white/50 mt-2">
                                {t(
                                    'This cannot be undone.',
                                    '確定要刪除嗎？此操作無法復原。',
                                )}
                            </p>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-4 py-2 rounded-xl text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                >
                                    {t('Cancel', '取消')}
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="px-4 py-2 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors"
                                >
                                    {t('Delete', '刪除')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bulk Actions Bar */}
            <AnimatePresence>
                {isAdmin && selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-4 rounded-2xl shadow-2xl z-[50] flex items-center gap-8 border border-white/10 dark:border-zinc-200"
                    >
                        <div className="flex items-center gap-3 pr-6 border-r border-white/10 dark:border-zinc-200">
                            <CheckSquare className="w-5 h-5 text-purple-400 dark:text-purple-600" />
                            <span className="font-bold whitespace-nowrap">
                                已選擇 {selectedIds.length} 個物業
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowBulkUploaderModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 dark:bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="text-sm font-medium">更改上載者</span>
                            </motion.button>

                            <button
                                onClick={() => setSelectedIds([])}
                                className="p-2 hover:bg-white/10 dark:hover:bg-zinc-100 rounded-lg transition-colors"
                                title="取消選擇"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Uploader Update Modal */}
            <AnimatePresence>
                {showBulkUploaderModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowBulkUploaderModal(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/10 p-6 z-[70] shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">批量更改上載者</h3>
                                <button onClick={() => setShowBulkUploaderModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-zinc-400" />
                                </button>
                            </div>

                            <p className="text-zinc-500 dark:text-white/60 text-sm mb-6 bg-purple-50 dark:bg-purple-500/5 p-4 rounded-2xl border border-purple-100 dark:border-purple-500/10">
                                您正在為 <span className="font-bold text-purple-600 dark:text-purple-400">{selectedIds.length}</span> 個物業更改上載者。請選擇新的上載者：
                            </p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">選擇上載者</label>
                                    <AnimatedSelect
                                        name="bulkUploader"
                                        value={selectedBulkUploader}
                                        onChange={(value: string) => setSelectedBulkUploader(value)}
                                        options={[
                                            { value: '', label: '選擇用戶...' },
                                            ...(users || []).map(u => ({
                                                value: u.id,
                                                label: u.displayName || u.username
                                            }))
                                        ]}
                                        placeholder="選擇新的上載者"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setShowBulkUploaderModal(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all font-medium"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleBulkUploaderUpdate}
                                        disabled={!selectedBulkUploader}
                                        className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                                    >
                                        確認更改
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
