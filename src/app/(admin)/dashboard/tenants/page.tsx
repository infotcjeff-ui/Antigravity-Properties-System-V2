'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProprietorsQuery, useProprietors } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import type { Proprietor } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import ProprietorModal from '@/components/properties/ProprietorModal';

export default function TenantsPage() {
    const queryClient = useQueryClient();
    const { data: allProprietors, isLoading } = useProprietorsQuery();
    const { deleteProprietor } = useProprietors();

    const [showModal, setShowModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Proprietor | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter for tenants only and apply search
    const tenants = useMemo(() => {
        const filtered = (allProprietors || []).filter(p => p.code?.startsWith('T'));
        return filtered;
    }, [allProprietors]);

    const filteredTenants = useMemo(() => {
        if (!searchQuery) return tenants;

        const query = searchQuery.toLowerCase();
        return tenants.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.code.toLowerCase().includes(query) ||
            (p.englishName && p.englishName.toLowerCase().includes(query)) ||
            (p.shortName && p.shortName.toLowerCase().includes(query))
        );
    }, [tenants, searchQuery]);

    const handleDelete = async (id: string) => {
        if (confirm('確定要刪除此承租人嗎?\n請注意：如果此承租人已關聯到任何租約，刪除將會失敗。')) {
            const success = await deleteProprietor(id);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ['proprietors'] });
            } else {
                alert('刪除失敗。該承租人可能已被租金記錄引用，請先刪除相關記錄後再試。');
            }
        }
    };

    const handleSuccess = () => {
        setShowModal(false);
        setSelectedTenant(null);
        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
    };

    const handleOpenModal = (tenant?: Proprietor) => {
        setSelectedTenant(tenant || null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedTenant(null);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-12 h-12 rounded-full bg-purple-500"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">承租人</h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">管理租客及承租方信息</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOpenModal()}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl text-white font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新增承租人
                </motion.button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">總承租人數量</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{tenants.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/20">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                </BentoCard>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋承租人..."
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
            </div>

            {/* Tenants List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTenants.length === 0 ? (
                    <div className="col-span-full glass-card flex flex-col items-center justify-center py-16 text-white/40">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-lg">找不到承租人</p>
                        <p className="text-sm mt-1">請新增您的第一位承租人</p>
                    </div>
                ) : (
                    filteredTenants.map((tenant, index) => (
                        <motion.div
                            key={tenant.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleOpenModal(tenant)}
                            className="cursor-pointer"
                        >
                            <BentoCard className="h-full relative overflow-hidden group hover:ring-2 hover:ring-blue-500/30 transition-all">
                                <div className="absolute top-0 right-0">
                                    <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl ${tenant.type === 'company'
                                        ? 'bg-blue-500/10 text-blue-500'
                                        : 'bg-amber-500/10 text-amber-500'
                                        }`}>
                                        {tenant.type === 'company' ? '公司' : '個人'}
                                    </div>
                                </div>

                                <button
                                    onClick={() => tenant.id && handleDelete(tenant.id)}
                                    className="absolute bottom-3 right-3 p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>

                                <div className="flex items-start pr-16">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex flex-col items-center justify-center text-white font-bold leading-tight flex-shrink-0">
                                            <span className="text-xs opacity-70">{tenant.code}</span>
                                            <span className="text-lg">{tenant.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-zinc-900 dark:text-white font-semibold truncate group-hover:text-blue-500 transition-colors">
                                                {tenant.shortName || tenant.name}
                                            </h3>
                                            <p className="text-zinc-500 dark:text-white/50 text-xs truncate">
                                                {tenant.englishName || tenant.name}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </BentoCard>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <ProprietorModal
                        mode="tenant"
                        initialData={selectedTenant}
                        onClose={handleCloseModal}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
