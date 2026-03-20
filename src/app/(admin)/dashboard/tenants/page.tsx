'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProprietorsQuery, useProprietors, useSubLandlordsQuery, useSubLandlords, useCurrentTenantsQuery, useCurrentTenants } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Users, ChevronRight, Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import type { Proprietor, SubLandlord, CurrentTenant } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import ProprietorModal from '@/components/properties/ProprietorModal';
import RentOutFormModal from '@/components/properties/RentOutFormModal';

export default function TenantsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'tenants' | 'sub_landlords' | 'current_tenants'>('tenants');
    const [searchQuery, setSearchQuery] = useState('');

    // Tenants (承租人)
    const { data: allProprietors, isLoading: tenantsLoading } = useProprietorsQuery();
    const { deleteProprietor } = useProprietors();
    const [showTenantModal, setShowTenantModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Proprietor | null>(null);
    const [tenantEditMode, setTenantEditMode] = useState(false);

    // Sub-landlords (二房東)
    const { data: subLandlords, isLoading: subLandlordsLoading } = useSubLandlordsQuery();
    const { deleteSubLandlord } = useSubLandlords();
    const [showSubLandlordModal, setShowSubLandlordModal] = useState(false);
    const [editSubLandlord, setEditSubLandlord] = useState<SubLandlord | null>(null);

    // Current tenants (現時租客)
    const { data: currentTenants, isLoading: currentTenantsLoading } = useCurrentTenantsQuery();
    const { deleteCurrentTenant } = useCurrentTenants();
    const [showCurrentTenantModal, setShowCurrentTenantModal] = useState(false);
    const [editCurrentTenant, setEditCurrentTenant] = useState<CurrentTenant | null>(null);

    const isLoading = tenantsLoading || subLandlordsLoading || currentTenantsLoading;

    // Filter tenants
    const tenants = useMemo(() => {
        return (allProprietors || []).filter(p => p.code?.startsWith('T'));
    }, [allProprietors]);

    const filteredTenants = useMemo(() => {
        if (!searchQuery) return tenants;
        const q = searchQuery.toLowerCase();
        return tenants.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.englishName && p.englishName.toLowerCase().includes(q)) ||
            (p.shortName && p.shortName.toLowerCase().includes(q))
        );
    }, [tenants, searchQuery]);

    // Filter sub-landlords
    const filteredSubLandlords = useMemo(() => {
        if (!searchQuery) return subLandlords || [];
        const q = searchQuery.toLowerCase();
        return (subLandlords || []).filter(x => 
            (x.name || '').toLowerCase().includes(q) || 
            (x.tenancyNumber || '').toLowerCase().includes(q)
        );
    }, [subLandlords, searchQuery]);

    // Filter current tenants
    const filteredCurrentTenants = useMemo(() => {
        if (!searchQuery) return currentTenants || [];
        const q = searchQuery.toLowerCase();
        return (currentTenants || []).filter(x => 
            (x.name || '').toLowerCase().includes(q) || 
            (x.tenancyNumber || '').toLowerCase().includes(q)
        );
    }, [currentTenants, searchQuery]);

    // Handlers for tenants
    const handleDeleteTenant = async (id: string) => {
        if (confirm('確定要刪除此承租人嗎?\n請注意：如果此承租人已關聯到任何租約，刪除將會失敗。')) {
            const success = await deleteProprietor(id);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ['proprietors'] });
            } else {
                alert('刪除失敗。該承租人可能已被租金記錄引用，請先刪除相關記錄後再試。');
            }
        }
    };

    const handleTenantSuccess = () => {
        setShowTenantModal(false);
        setSelectedTenant(null);
        setTenantEditMode(false);
        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
    };

    // Handlers for sub-landlords
    const handleDeleteSubLandlord = async (id: string) => {
        if (confirm('確定要刪除此二房東嗎?')) {
            const ok = await deleteSubLandlord(id);
            if (ok) queryClient.invalidateQueries({ queryKey: ['sub_landlords'] });
        }
    };

    const handleSubLandlordSuccess = () => {
        setShowSubLandlordModal(false);
        setEditSubLandlord(null);
        queryClient.invalidateQueries({ queryKey: ['sub_landlords'] });
    };

    // Handlers for current tenants
    const handleDeleteCurrentTenant = async (id: string) => {
        if (confirm('確定要刪除此現時租客嗎?')) {
            const ok = await deleteCurrentTenant(id);
            if (ok) queryClient.invalidateQueries({ queryKey: ['current_tenants'] });
        }
    };

    const handleCurrentTenantSuccess = () => {
        setShowCurrentTenantModal(false);
        setEditCurrentTenant(null);
        queryClient.invalidateQueries({ queryKey: ['current_tenants'] });
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

    const getStats = () => {
        switch (activeTab) {
            case 'tenants':
                return { count: tenants.length, label: '總承租人數量' };
            case 'sub_landlords':
                return { count: subLandlords?.length || 0, label: '二房東數量' };
            case 'current_tenants':
                return { count: currentTenants?.length || 0, label: '現時租客數量' };
        }
    };

    const getPlaceholder = () => {
        switch (activeTab) {
            case 'tenants':
                return '搜尋承租人...';
            case 'sub_landlords':
                return '搜尋二房東...';
            case 'current_tenants':
                return '搜尋現時租客...';
        }
    };

    const stats = getStats();

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-500" />
                    管理承租人
                </h1>
                <p className="text-zinc-500 dark:text-white/50 mt-1 text-sm">管理租客及承租方信息</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">{stats.label}</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{stats.count}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/20">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                </BentoCard>
            </div>

            {/* Search, Add Button, and Tabs */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 md:max-w-md min-w-[200px]">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={getPlaceholder()}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                    />
                </div>
                {activeTab === 'sub_landlords' && (
                    <button
                        onClick={() => { setEditSubLandlord(null); setShowSubLandlordModal(true); }}
                        className="px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 text-sm font-medium transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        新增
                    </button>
                )}
                {activeTab === 'current_tenants' && (
                    <button
                        onClick={() => { setEditCurrentTenant(null); setShowCurrentTenantModal(true); }}
                        className="px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 text-sm font-medium transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        新增租客
                    </button>
                )}
                <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/10 ml-auto">
                    {(['tenants', 'sub_landlords', 'current_tenants'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                                ? 'bg-white dark:bg-white/15 text-purple-600 dark:text-purple-400 shadow-sm'
                                : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            {tab === 'tenants' ? '承租人' : tab === 'sub_landlords' ? '二房東' : '現時租客'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'tenants' && (
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
                                className="mobile-card md:glass-card group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full"
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
                                            <h3 
                                                onClick={() => {
                                                    setSelectedTenant(tenant);
                                                    setTenantEditMode(false);
                                                    setShowTenantModal(true);
                                                }}
                                                className="text-zinc-900 dark:text-white font-bold text-lg truncate group-hover:text-blue-500 transition-colors cursor-pointer"
                                            >
                                                {tenant.shortName || tenant.name}
                                            </h3>
                                            <p className="text-zinc-500 dark:text-white/50 text-[11px] truncate uppercase tracking-wider font-medium">
                                                {tenant.englishName || tenant.name}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-3 right-3 md:hidden">
                                    <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-white/10" />
                                </div>
                                <div className="absolute bottom-3 right-3 gap-2 opacity-0 group-hover:opacity-100 hidden md:flex">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTenant(tenant);
                                            setTenantEditMode(true);
                                            setShowTenantModal(true);
                                        }}
                                        className="p-2 rounded-lg text-zinc-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            tenant.id && handleDeleteTenant(tenant.id);
                                        }}
                                        className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'sub_landlords' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSubLandlords.length === 0 ? (
                        <div className="col-span-full glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                            <p className="text-xl font-medium">暫無二房東資料。請按「+ 新增」新增。</p>
                        </div>
                    ) : (
                        filteredSubLandlords.map((item, i) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="mobile-card md:glass-card group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full"
                            >
                                <div className="absolute top-0 right-0 z-10">
                                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl bg-blue-500/10 text-blue-500 border-l border-b border-blue-500/10">
                                        二房東
                                    </div>
                                </div>
                                <div className="flex items-start pr-12 md:pr-16">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex flex-col items-center justify-center text-white font-bold leading-tight flex-shrink-0 shadow-lg shadow-blue-500/20">
                                            <span className="text-[10px] opacity-70 mb-0.5">{item.tenancyNumber || '—'}</span>
                                            <span className="text-xl">{item.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-zinc-900 dark:text-white font-bold text-lg truncate group-hover:text-blue-500 transition-colors">
                                                {item.name}
                                            </h3>
                                            <p className="text-zinc-500 dark:text-white/50 text-[11px] truncate uppercase tracking-wider font-medium">
                                                {item.tenancyNumber || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-3 right-3 md:hidden">
                                    <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-white/10" />
                                </div>
                                <div className="absolute bottom-3 right-3 gap-2 opacity-0 group-hover:opacity-100 hidden md:flex">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditSubLandlord(item);
                                            setShowSubLandlordModal(true);
                                        }}
                                        className="p-2 rounded-lg text-zinc-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            item.id && handleDeleteSubLandlord(item.id);
                                        }}
                                        className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'current_tenants' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCurrentTenants.length === 0 ? (
                        <div className="col-span-full glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                            <p className="text-xl font-medium">暫無現時租客資料。請按「+ 新增租客」新增。</p>
                        </div>
                    ) : (
                        filteredCurrentTenants.map((item, i) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="mobile-card md:glass-card group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full"
                            >
                                <div className="absolute top-0 right-0 z-10">
                                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl bg-blue-500/10 text-blue-500 border-l border-b border-blue-500/10">
                                        現時租客
                                    </div>
                                </div>
                                <div className="flex items-start pr-12 md:pr-16">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex flex-col items-center justify-center text-white font-bold leading-tight flex-shrink-0 shadow-lg shadow-blue-500/20">
                                            <span className="text-[10px] opacity-70 mb-0.5">{item.tenancyNumber || '—'}</span>
                                            <span className="text-xl">{item.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-zinc-900 dark:text-white font-bold text-lg truncate group-hover:text-blue-500 transition-colors">
                                                {item.name}
                                            </h3>
                                            <p className="text-zinc-500 dark:text-white/50 text-[11px] truncate uppercase tracking-wider font-medium">
                                                {item.tenancyNumber || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-3 right-3 md:hidden">
                                    <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-white/10" />
                                </div>
                                <div className="absolute bottom-3 right-3 gap-2 opacity-0 group-hover:opacity-100 hidden md:flex">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditCurrentTenant(item);
                                            setShowCurrentTenantModal(true);
                                        }}
                                        className="p-2 rounded-lg text-zinc-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            item.id && handleDeleteCurrentTenant(item.id);
                                        }}
                                        className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {/* Modals */}
            <AnimatePresence>
                {showTenantModal && (
                    <ProprietorModal
                        mode="tenant"
                        initialData={selectedTenant}
                        initialEditing={tenantEditMode}
                        onClose={() => { setShowTenantModal(false); setSelectedTenant(null); setTenantEditMode(false); }}
                        onSuccess={handleTenantSuccess}
                    />
                )}
                {showSubLandlordModal && (
                    <RentOutFormModal
                        mode="sub_landlord"
                        editItem={editSubLandlord}
                        onClose={() => { setShowSubLandlordModal(false); setEditSubLandlord(null); }}
                        onSuccess={handleSubLandlordSuccess}
                    />
                )}
                {showCurrentTenantModal && (
                    <RentOutFormModal
                        mode="current_tenant"
                        editItem={editCurrentTenant}
                        onClose={() => { setShowCurrentTenantModal(false); setEditCurrentTenant(null); }}
                        onSuccess={handleCurrentTenantSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
