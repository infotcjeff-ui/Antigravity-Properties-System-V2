'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useProprietors, useProprietorsQuery } from '@/hooks/useStorage';
import type { Proprietor } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import ProprietorModal from '@/components/properties/ProprietorModal';
import { useAuth } from '@/contexts/AuthContext';

export default function ProprietorsPage() {
    const queryClient = useQueryClient();
    const { data: qProprietors, isLoading: qLoading } = useProprietorsQuery();
    const { deleteProprietor } = useProprietors();
    const { isAuthenticated } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const proprietors = useMemo(() => (qProprietors || []).filter(p => !p.code?.startsWith('T')), [qProprietors]);

    const filteredProprietors = useMemo(() => {
        if (!searchQuery) return proprietors;

        const query = searchQuery.toLowerCase();
        return proprietors.filter(
            p =>
                p.name.toLowerCase().includes(query) ||
                p.code.toLowerCase().includes(query) ||
                (p.englishName && p.englishName.toLowerCase().includes(query)) ||
                (p.shortName && p.shortName.toLowerCase().includes(query))
        );
    }, [proprietors, searchQuery]);

    const handleDelete = async (id: string) => {
        if (confirm('您確定要刪除此業主嗎？')) {
            await deleteProprietor(id);
            queryClient.invalidateQueries({ queryKey: ['proprietors'] });
        }
    };

    const handleSuccess = () => {
        setShowModal(false);
        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
    };

    if (qLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">管理業主</h1>
                    <p className="text-sm text-zinc-500 dark:text-white/50 mt-1">管理物業業主與業主資料</p>
                </div>
                {isAuthenticated && (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowModal(true)}
                        className="btn-primary"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        新增業主
                    </motion.button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">業主總數</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{proprietors.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/20">
                            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    placeholder="搜尋業主..."
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                />
            </div>

            {/* Proprietors List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProprietors.length === 0 ? (
                    <div className="col-span-full glass-card flex flex-col items-center justify-center py-16 text-white/40">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-lg">未找到任何業主</p>
                        <p className="text-sm mt-1">點擊上方按鈕新增業主以開始使用</p>
                    </div>
                ) : (
                    filteredProprietors.map((proprietor, index) => (
                        <motion.div
                            key={proprietor.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <BentoCard className="h-full relative overflow-hidden group">
                                {/* Type Badges — 同一行 */}
                                <div className="absolute top-3 right-3 z-10 flex flex-row flex-nowrap items-center gap-2">
                                    <div className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-lg ${proprietor.type === 'company'
                                        ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20'
                                        : 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20'
                                        }`}>
                                        {proprietor.type === 'company' ? '公司' : '個人'}
                                    </div>
                                    <div className={`px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-lg ${proprietor.category === 'group_company'
                                        ? 'bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20'
                                        : proprietor.category === 'joint_venture'
                                            ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
                                            : proprietor.category === 'managed_individual'
                                                ? 'bg-zinc-500/10 text-zinc-500 ring-1 ring-zinc-500/20'
                                                : 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20'
                                        }`}>
                                        {proprietor.category === 'group_company' ? '集團' : proprietor.category === 'joint_venture' ? '合資' : proprietor.category === 'managed_individual' ? '代管' : '外部'}
                                    </div>
                                </div>

                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex flex-col items-center justify-center text-white font-bold leading-tight">
                                            <span className="text-[8px] sm:text-[10px] opacity-70 truncate max-w-[2.5rem]">{proprietor.code}</span>
                                            <span className="text-sm sm:text-base">{proprietor.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm text-zinc-900 dark:text-white font-semibold truncate group-hover:text-purple-500 transition-colors">
                                                {proprietor.shortName || proprietor.name}
                                            </h3>
                                            <p className="text-zinc-500 dark:text-white/50 text-xs truncate">
                                                {proprietor.englishName || proprietor.name}
                                            </p>
                                        </div>
                                    </div>
                                    {isAuthenticated && (
                                        <button
                                            onClick={() => proprietor.id && handleDelete(proprietor.id)}
                                            className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
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
                        onClose={() => setShowModal(false)}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
