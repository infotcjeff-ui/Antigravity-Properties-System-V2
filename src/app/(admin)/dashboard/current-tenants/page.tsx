'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentTenantsQuery, useCurrentTenants } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import type { CurrentTenant } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentOutFormModal from '@/components/properties/RentOutFormModal';
import CurrentTenantDetailModal from '@/components/properties/CurrentTenantDetailModal';

export default function CurrentTenantsPage() {
    const queryClient = useQueryClient();
    const { data: items, isLoading } = useCurrentTenantsQuery();
    const { deleteCurrentTenant } = useCurrentTenants();
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState<CurrentTenant | null>(null);
    const [detailItem, setDetailItem] = useState<CurrentTenant | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = useMemo(() => {
        if (!searchQuery) return items || [];
        const q = searchQuery.toLowerCase();
        return (items || []).filter(x => (x.name || '').toLowerCase().includes(q) || (x.tenancyNumber || '').toLowerCase().includes(q));
    }, [items, searchQuery]);

    const handleDelete = async (id: string) => {
        if (confirm('確定要刪除此現時租客嗎?')) {
            const ok = await deleteCurrentTenant(id);
            if (ok) queryClient.invalidateQueries({ queryKey: ['current_tenants'] });
        }
    };

    const handleSuccess = () => {
        setShowModal(false);
        setEditItem(null);
        queryClient.invalidateQueries({ queryKey: ['current_tenants'] });
    };

    const handleOpenAdd = () => {
        setEditItem(null);
        setShowModal(true);
    };

    const handleOpenEdit = (item: CurrentTenant) => {
        setDetailItem(null);
        setEditItem(item);
        setShowModal(true);
    };

    const handleOpenDetail = (item: CurrentTenant) => {
        setEditItem(null);
        setDetailItem(item);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} className="w-12 h-12 rounded-full bg-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-purple-500" />
                        管理現時租客
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">管理現時租客資料（與出租合約結構相同）</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    + 新增租客
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">現時租客數量</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{items?.length || 0}</p>
                        </div>
                    </div>
                </BentoCard>
            </div>

            <div className="relative w-full md:max-w-md">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜尋現時租客..."
                    className="w-full px-4 py-3 pl-10 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.length === 0 ? (
                    <div className="col-span-full glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                        <p className="text-xl font-medium">暫無現時租客資料。請按「+ 新增租客」新增。</p>
                    </div>
                ) : (
                    filtered.map((item, i) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => handleOpenDetail(item)}
                            className="mobile-card md:glass-card p-4 group cursor-pointer"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-white">{item.name}</h3>
                                    <p className="text-sm text-zinc-500 dark:text-white/50">{item.tenancyNumber || '—'}</p>
                                    {item.monthlyRental != null && (
                                        <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">月租: {item.monthlyRental.toLocaleString()}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => handleOpenEdit(item)} className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => item.id && handleDelete(item.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-red-600 dark:text-red-400">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            <AnimatePresence>
                {showModal && (
                    <RentOutFormModal
                        mode="current_tenant"
                        editItem={editItem}
                        onClose={() => { setShowModal(false); setEditItem(null); }}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {detailItem && (
                    <CurrentTenantDetailModal
                        currentTenant={detailItem}
                        onClose={() => setDetailItem(null)}
                        onEdit={() => {
                            setEditItem(detailItem);
                            setDetailItem(null);
                            setShowModal(true);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
