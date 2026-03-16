'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubLandlordsQuery, useSubLandlords } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import type { SubLandlord } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentOutFormModal from '@/components/properties/RentOutFormModal';

export default function SubLandlordsPage() {
    const queryClient = useQueryClient();
    const { data: items, isLoading } = useSubLandlordsQuery();
    const { deleteSubLandlord } = useSubLandlords();
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState<SubLandlord | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = useMemo(() => {
        if (!searchQuery) return items || [];
        const q = searchQuery.toLowerCase();
        return (items || []).filter(x => (x.name || '').toLowerCase().includes(q) || (x.tenancyNumber || '').toLowerCase().includes(q));
    }, [items, searchQuery]);

    const handleDelete = async (id: string) => {
        if (confirm('確定要刪除此二房東嗎?')) {
            const ok = await deleteSubLandlord(id);
            if (ok) queryClient.invalidateQueries({ queryKey: ['sub_landlords'] });
        }
    };

    const handleSuccess = () => {
        setShowModal(false);
        setEditItem(null);
        queryClient.invalidateQueries({ queryKey: ['sub_landlords'] });
    };

    const handleOpenAdd = () => {
        setEditItem(null);
        setShowModal(true);
    };

    const handleOpenEdit = (item: SubLandlord) => {
        setEditItem(item);
        setShowModal(true);
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
                        <Building2 className="w-6 h-6 text-purple-500" />
                        管理二房東
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">管理二房東資料（與出租合約結構相同）</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    + 新增
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">二房東數量</p>
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
                    placeholder="搜尋二房東..."
                    className="w-full px-4 py-3 pl-10 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.length === 0 ? (
                    <div className="col-span-full glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                        <p className="text-xl font-medium">暫無二房東資料。請按「+ 新增」新增。</p>
                    </div>
                ) : (
                    filtered.map((item, i) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="mobile-card md:glass-card p-4 group"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-white">{item.name}</h3>
                                    <p className="text-sm text-zinc-500 dark:text-white/50">{item.tenancyNumber || '—'}</p>
                                    {item.monthlyRental != null && (
                                        <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">月租: {item.monthlyRental.toLocaleString()}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        mode="sub_landlord"
                        editItem={editItem}
                        onClose={() => { setShowModal(false); setEditItem(null); }}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
