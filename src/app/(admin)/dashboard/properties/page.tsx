'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePropertiesQuery, useProperties } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import type { Property } from '@/lib/db';
import PropertyForm from '@/components/properties/PropertyForm';
import { Building2, Plus, Pencil, Trash2, Search, Eye } from 'lucide-react';
import Link from 'next/link';

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
    const { data: propertiesData, isLoading } = usePropertiesQuery();
    const { deleteProperty } = useProperties();

    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingProperty, setEditingProperty] = useState<Property | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Filter properties based on search query (client-side for instant feedback)
    const filteredProperties = useMemo(() => {
        const properties = propertiesData || [];
        if (!searchQuery) return properties;

        const query = searchQuery.toLowerCase();
        return properties.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.code.toLowerCase().includes(query) ||
            p.address.toLowerCase().includes(query)
        );
    }, [propertiesData, searchQuery]);

    const sortedProperties = useMemo(() => {
        return [...filteredProperties].sort((a, b) => a.code.localeCompare(b.code));
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">物業概覽</h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">管理所有物業資產</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowForm(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-shadow flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    新增物業
                </motion.button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋物業..."
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                />
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
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-zinc-100 dark:border-white/5">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">名稱</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">編號</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">類型</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-white/40 uppercase tracking-wider">狀態</th>
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
                                        className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                    >
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
                                        <td className="p-4 text-zinc-600 dark:text-white/70">{property.code}</td>
                                        <td className="p-4 text-zinc-600 dark:text-white/70">{typeLabels[property.type]}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[property.status]}`}>
                                                {statusLabels[property.status]}
                                            </span>
                                        </td>
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
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Delete Property?</h3>
                            <p className="text-zinc-500 dark:text-white/50 mt-2">
                                Are you sure you want to delete this property? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-4 py-2 rounded-xl text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="px-4 py-2 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
