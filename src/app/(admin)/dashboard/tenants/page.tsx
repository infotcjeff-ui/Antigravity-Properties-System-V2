'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProprietorsQuery, useProprietors, useSubLandlordsQuery, useSubLandlords, useCurrentTenantsQuery, useCurrentTenants, usePropertiesQuery, useRentsWithRelationsQuery } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Users, ChevronRight, ChevronUp, ChevronLeft, Building2, Plus, Pencil, Trash2, X, FileText, MapPin, Hash, Calendar } from 'lucide-react';
import type { Proprietor, SubLandlord, CurrentTenant, Property } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import ProprietorModal from '@/components/properties/ProprietorModal';
import OwnerPropertyListModal from '@/components/properties/OwnerPropertyListModal';
import LesseeDetailModal from '@/components/properties/LesseeDetailModal';
import RentOutFormModal from '@/components/properties/RentOutFormModal';
import CurrentTenantDetailModal from '@/components/properties/CurrentTenantDetailModal';
import { dedupeRecordsByDisplayName, proprietorCategoryLabelZh, proprietorCategoryBadgeClassName, formatLotIndexPlainJoined, formatRentHistoryLotCellText } from '@/lib/formatters';
import { getRentOutLesseeDisplayLabel } from '@/lib/rentPaymentDisplay';

type ProprietorManageTab = 'owners' | 'lessees' | 'sub_landlords' | 'current_tenants';

const PROPRIETOR_TAB_ORDER: ProprietorManageTab[] = ['owners', 'lessees', 'sub_landlords', 'current_tenants'];

const PROPRIETOR_TAB_LABEL: Record<ProprietorManageTab, string> = {
    owners: '業主',
    lessees: '承租人',
    sub_landlords: '二房東',
    current_tenants: '現時租客',
};

export default function TenantsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<ProprietorManageTab>('owners');
    const [searchQuery, setSearchQuery] = useState('');

    // Tenants (承租人)
    const { data: allProprietors, isLoading: tenantsLoading } = useProprietorsQuery();
    const { deleteProprietor } = useProprietors();
    const [showTenantModal, setShowTenantModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Proprietor | null>(null);
    const [tenantEditMode, setTenantEditMode] = useState(false);
    /** 第一分頁內可編輯業主或承租人 */
    const [proprietorModalMode, setProprietorModalMode] = useState<'proprietor' | 'tenant'>('tenant');

    // Owner detail popup (Tab Listing)
    const [showOwnerDetail, setShowOwnerDetail] = useState<Proprietor | null>(null);

    // Lessee detail popup (Tab Listing)
    const [showLesseeDetail, setShowLesseeDetail] = useState<Proprietor | null>(null);

    // Sub-landlords (二房東)
    const { data: subLandlords, isLoading: subLandlordsLoading } = useSubLandlordsQuery();
    const { deleteSubLandlord } = useSubLandlords();
    const [showSubLandlordModal, setShowSubLandlordModal] = useState(false);
    const [editSubLandlord, setEditSubLandlord] = useState<SubLandlord | null>(null);
    const [showSubLandlordDetail, setShowSubLandlordDetail] = useState<SubLandlord | null>(null);
    const [editingFromDetailSubLandlord, setEditingFromDetailSubLandlord] = useState<SubLandlord | null>(null);
    
    // For property count calculation
    const { data: allProperties } = usePropertiesQuery();

    // Rent-out contracts (出租合約) for sub-landlord detail
    const { data: allRentOutContracts } = useRentsWithRelationsQuery({ type: 'rent_out' });

    // Current tenants (現時租客)
    const { data: currentTenants, isLoading: currentTenantsLoading } = useCurrentTenantsQuery();
    const { deleteCurrentTenant } = useCurrentTenants();
    const [showCurrentTenantModal, setShowCurrentTenantModal] = useState(false);
    const [editCurrentTenant, setEditCurrentTenant] = useState<CurrentTenant | null>(null);
    const [detailCurrentTenant, setDetailCurrentTenant] = useState<CurrentTenant | null>(null);

    const isLoading = tenantsLoading || subLandlordsLoading || currentTenantsLoading;

    const ownerProprietors = useMemo(
        () => (allProprietors || []).filter(p => !p.code?.startsWith('T')),
        [allProprietors]
    );
    const tenantProprietors = useMemo(
        () => (allProprietors || []).filter(p => p.code?.startsWith('T')),
        [allProprietors]
    );
    /** 各分頁內依顯示名稱去重（與下拉／列表一致） */
    const dedupedOwners = useMemo(() => dedupeRecordsByDisplayName(ownerProprietors), [ownerProprietors]);
    const dedupedLessees = useMemo(() => dedupeRecordsByDisplayName(tenantProprietors), [tenantProprietors]);

    const filterProprietorList = (list: Proprietor[]) => {
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(
            p =>
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q) ||
                (p.englishName && p.englishName.toLowerCase().includes(q)) ||
                (p.shortName && p.shortName.toLowerCase().includes(q))
        );
    };

    const filteredOwners = useMemo(() => filterProprietorList(dedupedOwners), [dedupedOwners, searchQuery]);
    const filteredLessees = useMemo(() => filterProprietorList(dedupedLessees), [dedupedLessees, searchQuery]);

    // Filter sub-landlords
    const filteredSubLandlords = useMemo(() => {
        if (!searchQuery) return subLandlords || [];
        const q = searchQuery.toLowerCase();
        return (subLandlords || []).filter(x =>
            (x.name || '').toLowerCase().includes(q)
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

    const handleDeleteMergedProprietor = async (p: Proprietor) => {
        const isLessee = !!p.code?.startsWith('T');
        const msg = isLessee
            ? '確定要刪除此承租人嗎?\n請注意：如果此承租人已關聯到任何租約，刪除將會失敗。'
            : '確定要刪除此業主嗎?\n請注意：如果此業主已關聯到任何物業或租約，刪除將會失敗。';
        if (!confirm(msg)) return;
        if (!p.id) return;
        const success = await deleteProprietor(p.id);
        if (success) {
            queryClient.invalidateQueries({ queryKey: ['proprietors'] });
        } else {
            alert(
                isLessee
                    ? '刪除失敗。該承租人可能已被租金記錄引用，請先刪除相關記錄後再試。'
                    : '刪除失敗。該業主可能已被物業或租金記錄引用，請先解除關聯後再試。'
            );
        }
    };

    const handleTenantSuccess = () => {
        setShowTenantModal(false);
        setSelectedTenant(null);
        setTenantEditMode(false);
        setProprietorModalMode('tenant');
        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
    };

    const openMergedModal = (p: Proprietor | null, editing: boolean) => {
        if (p) {
            setProprietorModalMode(p.code?.startsWith('T') ? 'tenant' : 'proprietor');
        }
        setSelectedTenant(p);
        setTenantEditMode(editing);
        setShowTenantModal(true);
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
        if (editingFromDetailSubLandlord) {
            setShowSubLandlordDetail(editingFromDetailSubLandlord);
            setEditingFromDetailSubLandlord(null);
        }
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
            case 'owners':
                return { count: dedupedOwners.length, label: '業主' };
            case 'lessees':
                return { count: dedupedLessees.length, label: '承租人' };
            case 'sub_landlords':
                return { count: subLandlords?.length || 0, label: '二房東數量' };
            case 'current_tenants':
                return { count: currentTenants?.length || 0, label: '現時租客數量' };
        }
    };

    const getPlaceholder = () => {
        switch (activeTab) {
            case 'owners':
                return '搜尋業主...';
            case 'lessees':
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
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
                    <Users className="w-6 h-6 text-purple-500 shrink-0" />
                    管理業主
                </h1>
                <p className="text-sm text-zinc-500 dark:text-white/55 mt-1">管理業主、承租人、二房東與現時租客</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm font-medium">{stats.label}</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">{stats.count}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/20">
                            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                    />
                </div>
                {activeTab === 'owners' && (
                    <button
                        type="button"
                        onClick={() => {
                            setProprietorModalMode('proprietor');
                            setSelectedTenant(null);
                            setTenantEditMode(true);
                            setShowTenantModal(true);
                        }}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-500 text-white rounded-lg sm:rounded-xl hover:bg-purple-600 text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1.5 sm:gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        新增業主
                    </button>
                )}
                {activeTab === 'lessees' && (
                    <button
                        type="button"
                        onClick={() => {
                            setProprietorModalMode('tenant');
                            setSelectedTenant(null);
                            setTenantEditMode(true);
                            setShowTenantModal(true);
                        }}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-500 text-white rounded-lg sm:rounded-xl hover:bg-purple-600 text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1.5 sm:gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        新增承租人
                    </button>
                )}
                {activeTab === 'sub_landlords' && (
                    <button
                        onClick={() => { setEditSubLandlord(null); setShowSubLandlordModal(true); }}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-500 text-white rounded-lg sm:rounded-xl hover:bg-purple-600 text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1.5 sm:gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        新增
                    </button>
                )}
                {activeTab === 'current_tenants' && (
                    <button
                        onClick={() => { setEditCurrentTenant(null); setShowCurrentTenantModal(true); }}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-500 text-white rounded-lg sm:rounded-xl hover:bg-purple-600 text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1.5 sm:gap-2 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        新增租客
                    </button>
                )}
                <div className="flex gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-zinc-100/90 dark:bg-white/10 ring-1 ring-zinc-200/80 dark:ring-white/10 ml-auto w-full sm:w-auto justify-stretch sm:justify-start flex-wrap sm:flex-nowrap">
                    {PROPRIETOR_TAB_ORDER.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 sm:flex-none px-2 sm:px-3 py-2 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-all min-h-9 sm:min-h-10 ${activeTab === tab
                                ? 'bg-white dark:bg-white/20 text-purple-700 dark:text-purple-300 shadow-md ring-1 ring-purple-500/20'
                                : 'text-zinc-600 dark:text-white/65 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            {PROPRIETOR_TAB_LABEL[tab]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content based on active tab */}
            {(activeTab === 'owners' || activeTab === 'lessees') && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {(activeTab === 'owners' ? filteredOwners : filteredLessees).length === 0 ? (
                        <div className="col-span-full glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                            <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-xl font-medium">
                                {activeTab === 'owners'
                                    ? '暫無業主資料。請按「+ 新增業主」新增。'
                                    : '暫無承租人資料。請按「+ 新增承租人」新增。'}
                            </p>
                        </div>
                    ) : (
                        (activeTab === 'owners' ? filteredOwners : filteredLessees).map((p, index) => {
                            const isLessee = activeTab === 'lessees';
                            const ringHover = isLessee ? 'hover:ring-blue-500/30' : 'hover:ring-purple-500/30';
                            const titleHover = isLessee
                                ? 'group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                : 'group-hover:text-purple-600 dark:group-hover:text-purple-400';
                            const avatarGrad = isLessee
                                ? 'from-blue-500 via-indigo-600 to-violet-700 shadow-blue-500/25'
                                : 'from-purple-500 via-violet-600 to-indigo-700 shadow-purple-500/25';
                            return (
                                <motion.div
                                    key={p.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`mobile-card md:glass-card group hover:ring-2 ${ringHover} transition-all relative overflow-hidden h-full p-4 sm:p-5 rounded-2xl`}
                                >
                                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex flex-row flex-wrap items-center justify-end gap-1 sm:gap-2 max-w-[min(100%,14rem)] sm:max-w-none">
                                        <div
                                            className={`shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg ${
                                                p.type === 'company'
                                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20'
                                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
                                            }`}
                                        >
                                            {p.type === 'company' ? '公司' : '個人'}
                                        </div>
                                        <div
                                            className={`shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg ${
                                                isLessee
                                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400 ring-1 ring-sky-500/20'
                                                    : 'bg-purple-500/15 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500/20'
                                            }`}
                                        >
                                            {isLessee ? '承租人' : '業主'}
                                        </div>
                                        {!isLessee && (
                                            <div
                                                className={`shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-md sm:rounded-lg ${proprietorCategoryBadgeClassName(p.category)}`}
                                            >
                                                {proprietorCategoryLabelZh(p.category, 'badge')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-start pr-[5.5rem] sm:pr-36 md:pr-32 lg:pr-36">
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
                                            <div
                                                className={`w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${avatarGrad} flex flex-col items-center justify-center text-white font-bold leading-tight shrink-0 shadow-md ring-1 ring-white/20 dark:ring-white/10 ${
                                                    !isLessee ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''
                                                }`}
                                            >
                                                <span className="text-[7px] sm:text-[9px] opacity-80 mb-0.5 font-mono tracking-tight max-w-[2.5rem] sm:max-w-14 truncate px-0.5">
                                                    {p.code}
                                                </span>
                                                <span className="text-base sm:text-lg md:text-xl">{p.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 py-0.5">
                                                <h3
                                                    onClick={() => {
                                                        if (!isLessee) {
                                                            setShowOwnerDetail(p);
                                                        } else {
                                                            setShowLesseeDetail(p);
                                                        }
                                                    }}
                                                    className={`text-zinc-900 dark:text-white font-bold text-sm sm:text-base md:text-lg leading-snug line-clamp-2 ${titleHover} transition-colors ${!isLessee ? 'cursor-pointer' : 'group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer'}`}
                                                >
                                                    {p.shortName || p.name}
                                                </h3>
                                                <p className="text-zinc-600 dark:text-white/55 text-xs sm:text-sm truncate font-medium mt-1 tracking-wide">
                                                    {p.englishName || p.name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-3 right-3 md:hidden">
                                        <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-white/10" />
                                    </div>
                                    <div className="absolute bottom-3 right-3 gap-2 opacity-0 group-hover:opacity-100 hidden md:flex">
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation();
                                                openMergedModal(p, true);
                                            }}
                                            className="p-2 rounded-lg text-zinc-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation();
                                                handleDeleteMergedProprietor(p);
                                            }}
                                            className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            )}

            {activeTab === 'sub_landlords' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                                className="mobile-card md:glass-card group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full p-4 sm:p-5 rounded-2xl"
                            >
                                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                                    <div className="shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
                                        二房東
                                    </div>
                                </div>
                                <div className="flex items-start pr-[4.5rem] sm:pr-24 md:pr-20">
                                    <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
                                        <div 
                                            onClick={() => setShowSubLandlordDetail(item)}
                                            className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex items-center justify-center text-white font-bold leading-tight shrink-0 shadow-md shadow-blue-500/25 ring-1 ring-white/20 dark:ring-white/10 cursor-pointer hover:scale-[1.02] transition-transform"
                                        >
                                            <span className="text-base sm:text-lg md:text-xl">{item.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <h3 
                                                onClick={() => setShowSubLandlordDetail(item)}
                                                className="text-zinc-900 dark:text-white font-bold text-sm sm:text-base md:text-lg leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer"
                                            >
                                                {item.name}
                                            </h3>
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
                                        title="編輯二房東"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                                onClick={() => setDetailCurrentTenant(item)}
                                className="mobile-card md:glass-card group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full p-4 sm:p-5 rounded-2xl cursor-pointer"
                            >
                                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                                    <div className="shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                                        現時租客
                                    </div>
                                </div>
                                        <div className="flex items-start pr-[4.5rem] sm:pr-24 md:pr-20">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex flex-col items-center justify-center text-white font-bold leading-tight shrink-0 shadow-md shadow-emerald-500/25 ring-1 ring-white/20 dark:ring-white/10">
                                            <span className="text-[6px] sm:text-[8px] opacity-80 mb-0.5 font-mono tracking-tight max-w-[2.25rem] sm:max-w-14 truncate px-0.5 text-center leading-tight">{item.englishName || item.name.charAt(0).toUpperCase()}</span>
                                            <span className="text-base sm:text-lg md:text-xl">{item.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <h3 className="text-zinc-900 dark:text-white font-bold text-sm sm:text-base md:text-lg leading-snug line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                {item.name}
                                            </h3>
                                            <p className="text-zinc-600 dark:text-white/55 text-xs sm:text-sm font-medium mt-1 truncate">
                                                {item.englishName || '—'}
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
                        mode={proprietorModalMode}
                        initialData={selectedTenant}
                        initialEditing={tenantEditMode}
                        onClose={() => {
                            setShowTenantModal(false);
                            setSelectedTenant(null);
                            setTenantEditMode(false);
                            setProprietorModalMode('tenant');
                        }}
                        onSuccess={handleTenantSuccess}
                        onCancel={() => {
                            setShowTenantModal(false);
                            setTenantEditMode(false);
                            if (selectedTenant) {
                                if (selectedTenant.code?.startsWith('T')) {
                                    setShowLesseeDetail(selectedTenant);
                                } else {
                                    setShowOwnerDetail(selectedTenant);
                                }
                            }
                            setSelectedTenant(null);
                        }}
                    />
                )}
                {showSubLandlordModal && (
                    <RentOutFormModal
                        mode="sub_landlord"
                        editItem={editSubLandlord}
                        onClose={() => {
                            setShowSubLandlordModal(false);
                            setEditSubLandlord(null);
                            if (editingFromDetailSubLandlord) {
                                setShowSubLandlordDetail(editingFromDetailSubLandlord);
                                setEditingFromDetailSubLandlord(null);
                            }
                        }}
                        onCancel={() => {
                            setShowSubLandlordModal(false);
                            setEditSubLandlord(null);
                            if (editingFromDetailSubLandlord) {
                                setShowSubLandlordDetail(editingFromDetailSubLandlord);
                                setEditingFromDetailSubLandlord(null);
                            }
                        }}
                        onSuccess={handleSubLandlordSuccess}
                    />
                )}
                {showCurrentTenantModal && (
                    <RentOutFormModal
                        mode="current_tenant"
                        editItem={editCurrentTenant}
                        onClose={() => { setShowCurrentTenantModal(false); setEditCurrentTenant(null); }}
                        onCancel={() => {
                            setShowCurrentTenantModal(false);
                            setEditCurrentTenant(null);
                            // 從詳情進入編輯時，取消回到詳情 popup
                            if (detailCurrentTenant) {
                                setDetailCurrentTenant(detailCurrentTenant);
                            }
                        }}
                        onSuccess={handleCurrentTenantSuccess}
                    />
                )}
                {detailCurrentTenant && (
                    <CurrentTenantDetailModal
                        currentTenant={detailCurrentTenant}
                        onClose={() => setDetailCurrentTenant(null)}
                        onEdit={() => {
                            setEditCurrentTenant(detailCurrentTenant);
                            setDetailCurrentTenant(null);
                            setShowCurrentTenantModal(true);
                        }}
                    />
                )}
                {showSubLandlordDetail && (
                    <SubLandlordDetailModal
                        subLandlord={showSubLandlordDetail}
                        allRentOutContracts={allRentOutContracts || []}
                        onClose={() => setShowSubLandlordDetail(null)}
                        onEdit={() => {
                            setEditingFromDetailSubLandlord(showSubLandlordDetail);
                            setEditSubLandlord(showSubLandlordDetail);
                            setShowSubLandlordDetail(null);
                            setShowSubLandlordModal(true);
                        }}
                    />
                )}
                {showOwnerDetail && (
                    <OwnerPropertyListModal
                        proprietor={showOwnerDetail}
                        allProperties={allProperties || []}
                        onClose={() => setShowOwnerDetail(null)}
                        onEdit={() => {
                            openMergedModal(showOwnerDetail, true);
                            setShowOwnerDetail(null);
                        }}
                    />
                )}
                {showLesseeDetail && (
                    <LesseeDetailModal
                        lessee={showLesseeDetail}
                        onClose={() => setShowLesseeDetail(null)}
                        onEdit={() => {
                            setSelectedTenant(showLesseeDetail);
                            setTenantEditMode(true);
                            setProprietorModalMode('tenant');
                            setShowTenantModal(true);
                            setShowLesseeDetail(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// SubLandlordDetailModal Props
interface SubLandlordDetailModalProps {
    subLandlord: SubLandlord;
    allRentOutContracts: any[];
    onClose: () => void;
    onEdit: () => void;
}

type SubLandlordDetailTab = 'contracts' | 'basic';

const SUBLANDLORD_TAB_ORDER: SubLandlordDetailTab[] = ['contracts', 'basic'];

const SUBLANDLORD_TAB_LABEL: Record<SubLandlordDetailTab, string> = {
    contracts: '關聯合約',
    basic: '基本資料',
};

function SubLandlordDetailModal({
    subLandlord: initialSubLandlord,
    allRentOutContracts,
    onClose,
    onEdit,
}: SubLandlordDetailModalProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<SubLandlordDetailTab>('contracts');
    const [contractsPage, setContractsPage] = useState(1);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const hasInitializedRef = useRef(false);

    // 過濾關聯的出租合約（直接關聯）
    const relatedRentOutContracts = useMemo(() => {
        if (!allRentOutContracts || !initialSubLandlord.id) return [];
        return allRentOutContracts.filter(rent => rent.rentOutSubLandlordId === initialSubLandlord.id);
    }, [allRentOutContracts, initialSubLandlord.id]);

    // 按 tenancyNumber 分組（重複合約折疊在一起）
    const groupedContracts = useMemo(() => {
        const groups = new Map<string, typeof relatedRentOutContracts>();
        relatedRentOutContracts.forEach(rent => {
            const key = rent.rentOutTenancyNumber || '__none__';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(rent);
        });
        return Array.from(groups.entries()).map(([key, contracts]) => ({
            tenancyNumber: key,
            contracts,
            totalCount: contracts.length,
            firstContract: contracts[0],
        }));
    }, [relatedRentOutContracts]);

    // 只在 modal 首次開啟且資料載入完成後初始化收起狀態
    useEffect(() => {
        if (groupedContracts.length > 0 && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            setCollapsedGroups(new Set(groupedContracts.map(g => g.tenancyNumber)));
        }
    }, [groupedContracts]);

    const PAGE_SIZE = 5;
    const totalPages = Math.ceil(groupedContracts.length / PAGE_SIZE);
    const paginatedGroups = groupedContracts.slice(
        (contractsPage - 1) * PAGE_SIZE,
        contractsPage * PAGE_SIZE
    );

    const toggleGroup = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 min-h-screen bg-black/60 backdrop-blur-sm z-80"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 m-auto h-fit max-h-[90vh] overflow-hidden w-full max-w-2xl flex flex-col bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-80"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">二房東詳細資料</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/50 truncate max-w-48">
                                {initialSubLandlord.name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 text-sm font-medium transition-all"
                            >
                                編輯
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1 p-3 border-b border-zinc-100 dark:border-white/5 shrink-0 bg-zinc-50/50 dark:bg-white/2">
                    {SUBLANDLORD_TAB_ORDER.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all ${
                                activeTab === tab
                                    ? 'bg-white dark:bg-white/15 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
                                    : 'text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                        >
                            {SUBLANDLORD_TAB_LABEL[tab]}
                            {tab === 'contracts' && (
                                <span className="ml-1.5 text-xs font-mono opacity-70">({relatedRentOutContracts.length})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'contracts' && (
                        <div className="p-5">
                            {relatedRentOutContracts.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="w-12 h-12 text-zinc-200 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-zinc-500 dark:text-white/40 font-medium">暫無關聯合約</p>
                                    <p className="text-zinc-400 dark:text-white/25 text-sm mt-1">此二房東尚未關聯任何合約記錄</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {paginatedGroups.map(group => {
                                            const isCollapsed = collapsedGroups.has(group.tenancyNumber);
                                            const firstContract = group.firstContract;
                                            const firstProperty = firstContract?.property as Property | null;
                                            return (
                                                <div key={group.tenancyNumber} className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                                                    {/* Group Header */}
                                                    <div
                                                        className="flex items-center gap-3 px-5 py-4 bg-zinc-50 dark:bg-white/5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors group"
                                                        onClick={() => toggleGroup(group.tenancyNumber)}
                                                    >
                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                            <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                                                            <span className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                {group.tenancyNumber === '__none__' ? '—' : group.tenancyNumber}
                                                            </span>
                                                            {group.totalCount > 1 && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-semibold shrink-0">
                                                                    {group.totalCount}個
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {firstProperty && (
                                                                <div className="flex items-center gap-1 text-zinc-500 dark:text-white/50">
                                                                    <MapPin className="w-4 h-4 shrink-0" />
                                                                    <span className="text-sm truncate max-w-32">{firstProperty.name || '—'}</span>
                                                                </div>
                                                            )}
                                                            {isCollapsed ? (
                                                                <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-white/30 shrink-0" />
                                                            ) : (
                                                                <ChevronUp className="w-5 h-5 text-zinc-400 dark:text-white/30 shrink-0" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Group Items */}
                                                    {!isCollapsed && (
                                                        <div className="divide-y divide-zinc-100 dark:divide-white/5">
                                                            {group.contracts.map(rent => {
                                                                const rentProperty = rent.property as Property | null;
                                                                return (
                                                                    <div
                                                                        key={rent.id}
                                                                        className="px-5 py-4 pl-14 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer group/item transition-colors"
                                                                        onClick={() => {
                                                                            if (rentProperty?.id) {
                                                                                router.push(`/properties/${rentProperty.id}`);
                                                                                onClose();
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div className="flex-1 min-w-0 space-y-2">
                                                                                {/* 物業名稱 */}
                                                                                {rentProperty && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                                                                                        <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{rentProperty.name || '—'}</span>
                                                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-mono font-medium shrink-0">
                                                                                            {rentProperty.code}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {/* 租客名稱（現時租客） */}
                                                                                {(() => {
                                                                                    const lesseeName = getRentOutLesseeDisplayLabel(rent);
                                                                                    return lesseeName ? (
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Users className="w-4 h-4 text-purple-500 shrink-0" />
                                                                                            <span className="text-sm text-zinc-700 dark:text-white/80 truncate">{lesseeName}</span>
                                                                                            <span className="text-xs text-zinc-400 dark:text-white/40 shrink-0">（現時租客）</span>
                                                                                        </div>
                                                                                    ) : null;
                                                                                })()}
                                                                                {/* 地址 */}
                                                                                {rentProperty?.address && (
                                                                                    <div className="flex items-start gap-2">
                                                                                        <MapPin className="w-4 h-4 text-zinc-400 dark:text-white/40 shrink-0 mt-0.5" />
                                                                                        <span className="text-sm text-zinc-600 dark:text-white/60">{rentProperty.address}</span>
                                                                                    </div>
                                                                                )}
                                                                                {/* 地段：優先顯示該合約所選地段，否則顯示物业全部地段 */}
                                                                                {rentProperty?.lotIndex && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Hash className="w-4 h-4 text-zinc-400 dark:text-white/40 shrink-0" />
                                                                                        <span className="text-sm font-mono text-zinc-600 dark:text-white/60">
                                                                                            {formatRentHistoryLotCellText(rentProperty.lotIndex, rent)}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {/* 租期 + 出租金額（同一行） */}
                                                                                {(rent.rentOutStartDate || rent.startDate || rent.rentOutEndDate || rent.endDate || rent.rentOutMonthlyRental != null || rent.amount != null) && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Calendar className="w-4 h-4 text-zinc-400 dark:text-white/40 shrink-0" />
                                                                                        <span className="text-sm text-zinc-600 dark:text-white/60">
                                                                                            {rent.rentOutStartDate
                                                                                                ? new Date(rent.rentOutStartDate).toLocaleDateString('zh-HK')
                                                                                                : rent.startDate
                                                                                                ? new Date(rent.startDate).toLocaleDateString('zh-HK')
                                                                                                : '—'}
                                                                                            {rent.rentOutEndDate
                                                                                                ? ` — ${new Date(rent.rentOutEndDate).toLocaleDateString('zh-HK')}`
                                                                                                : rent.endDate
                                                                                                ? ` — ${new Date(rent.endDate).toLocaleDateString('zh-HK')}`
                                                                                                : ''}
                                                                                            {rent.rentOutPeriods != null && (
                                                                                                <span className="ml-2 text-xs text-blue-500 dark:text-blue-400 font-medium">
                                                                                                    （{rent.rentOutPeriods}期）
                                                                                                </span>
                                                                                            )}
                                                                                        </span>
                                                                                        {(rent.rentOutMonthlyRental != null || rent.amount != null) && (
                                                                                            <span className="ml-auto flex items-baseline gap-0.5 shrink-0">
                                                                                                <span className="text-[20px] font-bold" style={{ color: 'var(--color-emerald-600)' }}>
                                                                                                    ${new Intl.NumberFormat('zh-HK').format(rent.rentOutMonthlyRental ?? rent.amount ?? 0)}
                                                                                                </span>
                                                                                                <span className="text-[14px] font-light" style={{ color: 'var(--color-zinc-400)' }}>/月</span>
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-3 pt-4 mt-2 text-sm text-zinc-500 dark:text-white/50 border-t border-zinc-100 dark:border-white/5">
                                            <button
                                                type="button"
                                                onClick={() => setContractsPage((p) => Math.max(1, p - 1))}
                                                disabled={contractsPage <= 1}
                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-white" />
                                            </button>
                                            <span className="font-medium min-w-[3rem] text-center">
                                                {contractsPage} / {totalPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setContractsPage((p) => Math.min(totalPages, p + 1))}
                                                disabled={contractsPage >= totalPages}
                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-white" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'basic' && (
                        <div className="p-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">名稱</p>
                                    <p className="text-base font-bold text-zinc-900 dark:text-white">{initialSubLandlord.name}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">二房東編號</p>
                                    <p className="text-base font-medium text-zinc-900 dark:text-white">
                                        {initialSubLandlord.code || '暫無'}
                                    </p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">商業登記號碼</p>
                                    <p className="text-base font-medium text-zinc-900 dark:text-white">
                                        {initialSubLandlord.brNumber || '暫無'}
                                    </p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">建立日期</p>
                                    <p className="text-base font-medium text-zinc-900 dark:text-white">
                                        {initialSubLandlord.createdAt
                                            ? new Date(initialSubLandlord.createdAt).toLocaleDateString('zh-HK', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })
                                            : '暫無'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-zinc-100 dark:border-white/5 shrink-0 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl hover:bg-zinc-200 dark:hover:bg-white/20 text-sm font-medium transition-all"
                    >
                        關閉
                    </button>
                </div>
            </motion.div>
        </>
    );
}
