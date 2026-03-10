'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProprietorsQuery, useProprietors } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Users, ChevronRight } from 'lucide-react';
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
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-blue-500 md:hidden" />
                        管理承租人
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">管理租客及承租方信息</p>
                </div>
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
            <div className="relative w-full md:max-w-md">
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
                    className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-sm md:shadow-none"
                />
            </div>

            {/* Tenants List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTenants.length === 0 ? (
                    <div className="col-span-full glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                        <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-xl font-medium">暫無承租人資料。</p>
                    </div>
                ) : (
                    filteredTenants.map((tenant, index) => (
                        <motion.div
                            key={tenant.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleOpenModal(tenant)}
                            className="mobile-card md:glass-card cursor-pointer group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full"
                        >
                            <div className="absolute top-0 right-0 z-10">
                                <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl ${tenant.type === 'company'
                                    ? 'bg-blue-500/10 text-blue-500 border-l border-b border-blue-500/10'
                                    : 'bg-amber-500/10 text-amber-500 border-l border-b border-amber-500/10'
                                    }`}>
                                    {tenant.type === 'company' ? '公司' : '個人'}
                                </div>
                            </div>

                            <div className="flex items-start pr-12 md:pr-16">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex flex-col items-center justify-center text-white font-bold leading-tight flex-shrink-0 shadow-lg shadow-blue-500/20">
                                        <span className="text-[10px] opacity-70 mb-0.5">{tenant.code}</span>
                                        <span className="text-xl">{tenant.name.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-zinc-900 dark:text-white font-bold text-lg truncate group-hover:text-blue-500 transition-colors">
                                            {tenant.shortName || tenant.name}
                                        </h3>
                                        <p className="text-zinc-500 dark:text-white/50 text-[11px] truncate uppercase tracking-wider font-medium">
                                            {tenant.englishName || tenant.name}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile visual indicator */}
                            <div className="absolute bottom-3 right-3 md:hidden">
                                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-white/10" />
                            </div>

                            {/* Delete Button - Desktop Only hover */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    tenant.id && handleDelete(tenant.id);
                                }}
                                className="absolute bottom-3 right-3 p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 hidden md:block"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
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
