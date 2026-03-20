'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProprietorsQuery, useProprietors } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Users, ChevronRight, LayoutList, RefreshCw } from 'lucide-react';
import type { Proprietor } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import ProprietorModal from '@/components/properties/ProprietorModal';

export default function ProprietorsPage() {
    const queryClient = useQueryClient();
    const { data: allProprietors, isLoading } = useProprietorsQuery();
    const { deleteProprietor } = useProprietors();

    const [showModal, setShowModal] = useState(false);
    const [selectedProprietor, setSelectedProprietor] = useState<Proprietor | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter out tenants and apply search
    const proprietors = useMemo(() => {
        const filtered = (allProprietors || []).filter(p => !p.code?.startsWith('T'));
        return filtered;
    }, [allProprietors]);

    const filteredProprietors = useMemo(() => {
        if (!searchQuery) return proprietors;

        const query = searchQuery.toLowerCase();
        return proprietors.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.code.toLowerCase().includes(query) ||
            (p.englishName && p.englishName.toLowerCase().includes(query)) ||
            (p.shortName && p.shortName.toLowerCase().includes(query))
        );
    }, [proprietors, searchQuery]);

    const handleDelete = async (id: string) => {
        if (confirm('確定要刪除此業主嗎?\n請注意：如果此業主已關聯到任何物業或租約，刪除將會失敗。')) {
            const success = await deleteProprietor(id);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ['proprietors'] });
            } else {
                alert('刪除失敗。該業主可能已被物業或租金記錄引用，請先解除關聯後再試。');
            }
        }
    };

    const handleSuccess = () => {
        setShowModal(false);
        setSelectedProprietor(null);
        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
    };

    const handleOpenModal = (proprietor?: Proprietor, isEditing: boolean = false) => {
        setSelectedProprietor(proprietor || null);
        setShowModal(true);
        setEditMode(isEditing);
    };

    const [editMode, setEditMode] = useState(false);

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedProprietor(null);
        setEditMode(false);
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
                        <Users className="w-6 h-6 text-purple-500 md:hidden" />
                        管理業主
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">管理業主及資產擁有者</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">總業主數量</p>
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
                    placeholder="搜尋業主..."
                    className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all shadow-sm md:shadow-none"
                />
            </div>

            {/* Proprietors List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProprietors.length === 0 ? (
                    <div className="col-span-full glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                        <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-xl font-medium">暫無業主資料。</p>
                    </div>
                ) : (
                    filteredProprietors.map((proprietor, index) => (
                        <motion.div
                            key={proprietor.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="mobile-card md:glass-card group hover:ring-2 hover:ring-purple-500/30 transition-all relative overflow-hidden h-full"
                        >
                            {/* Type Badges */}
                            <div className="absolute top-0 right-0 flex flex-col items-end z-10">
                                <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl ${proprietor.type === 'company'
                                    ? 'bg-blue-500/10 text-blue-500 border-l border-b border-blue-500/10'
                                    : 'bg-amber-500/10 text-amber-500 border-l border-b border-amber-500/10'
                                    }`}>
                                    {proprietor.type === 'company' ? '公司' : '個人'}
                                </div>
                                <div className={`px-3 py-0.5 text-[9px] font-medium uppercase tracking-tighter rounded-bl-lg border-l border-b border-black/5 dark:border-white/5 ${proprietor.category === 'group_company'
                                    ? 'bg-purple-500/5 text-purple-500'
                                    : proprietor.category === 'joint_venture'
                                        ? 'bg-emerald-500/5 text-emerald-500'
                                        : proprietor.category === 'managed_individual'
                                            ? 'bg-zinc-500/5 text-zinc-500'
                                            : 'bg-amber-500/5 text-amber-500'
                                    }`}>
                                    {proprietor.category === 'group_company' ? '集團' : proprietor.category === 'joint_venture' ? '合資' : proprietor.category === 'managed_individual' ? '代管' : '外部'}
                                </div>
                            </div>

                            <div className="flex items-start pr-12 md:pr-16">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex flex-col items-center justify-center text-white font-bold leading-tight flex-shrink-0 shadow-lg shadow-purple-500/20">
                                        <span className="text-[10px] opacity-70 mb-0.5">{proprietor.code}</span>
                                        <span className="text-xl">{proprietor.name.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 
                                            onClick={() => handleOpenModal(proprietor, false)}
                                            className="text-zinc-900 dark:text-white font-bold text-lg truncate group-hover:text-purple-500 transition-colors cursor-pointer"
                                        >
                                            {proprietor.shortName || proprietor.name}
                                        </h3>
                                        <div className="flex flex-col space-y-0.5">
                                            <p className="text-zinc-500 dark:text-white/50 text-[11px] truncate uppercase tracking-wider font-medium">
                                                {proprietor.englishName || proprietor.name}
                                            </p>
                                            <p className="text-[10px] text-purple-500 dark:text-purple-400 font-bold opacity-80">
                                                {proprietor.category === 'group_company' ? '集團旗下公司' : proprietor.category === 'joint_venture' ? '合資公司' : proprietor.category === 'managed_individual' ? '代管理的個體' : '出租的業主'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile visual indicator for expand/click */}
                            <div className="absolute bottom-3 right-3 md:hidden">
                                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-white/10" />
                            </div>

                            {/* Action Buttons - Desktop Only hover */}
                            <div className="absolute bottom-3 right-3 gap-2 opacity-0 group-hover:opacity-100 hidden md:flex">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenModal(proprietor, true);
                                    }}
                                    className="p-2 rounded-lg text-zinc-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        proprietor.id && handleDelete(proprietor.id);
                                    }}
                                    className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <ProprietorModal
                        initialData={selectedProprietor}
                        initialEditing={editMode}
                        onClose={handleCloseModal}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
