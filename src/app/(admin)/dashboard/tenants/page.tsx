'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProprietorsQuery, useProprietors, useSubLandlordsQuery, useSubLandlords, useCurrentTenantsQuery, useCurrentTenants, usePropertiesQuery } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Users, ChevronRight, Building2, Plus, Pencil, Trash2, X } from 'lucide-react';
import type { Proprietor, SubLandlord, CurrentTenant, Property } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import ProprietorModal from '@/components/properties/ProprietorModal';
import RentOutFormModal from '@/components/properties/RentOutFormModal';
import { useRouter } from 'next/navigation';

export default function TenantsPage() {
    const queryClient = useQueryClient();
    const router = useRouter();
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
    const [showSubLandlordDetail, setShowSubLandlordDetail] = useState<SubLandlord | null>(null);
    
    // For property count calculation
    const { data: allProperties } = usePropertiesQuery();

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

    // Calculate property count for each sub-landlord based on tenancy number
    const subLandlordPropertyCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (subLandlords && allProperties) {
            subLandlords.forEach(sl => {
                if (sl.id && sl.tenancyNumber) {
                    // 从出租合约号码中提取所有物业编号（格式：物业编号-后缀 或 物业编号，如 C33-ER033, A01-P008）
                    const parts = sl.tenancyNumber.split(',').map(p => p.trim());
                    const propertyCodes = new Set<string>();
                    
                    parts.forEach(part => {
                        // 提取物业编号部分
                        const firstDashIndex = part.indexOf('-');
                        if (firstDashIndex > 0) {
                            const afterDash = part.substring(firstDashIndex + 1);
                            // 检查是否是后缀格式：2-3个大写字母+数字（如ER033, P001等）
                            if (afterDash.match(/^[A-Z]{2,3}\d+$/)) {
                                // 是后缀格式，只取前面部分
                                propertyCodes.add(part.substring(0, firstDashIndex));
                            } else {
                                // 不是后缀格式，整个part就是物业编号（如A01-P008）
                                propertyCodes.add(part);
                            }
                        } else {
                            propertyCodes.add(part);
                        }
                    });
                    
                    // 统计有多少个物业编号对应的物业存在
                    const count = Array.from(propertyCodes).filter(code => 
                        allProperties.some(p => {
                            if (!p.code) return false;
                            // 完全匹配，或者物业编号以该code开头（支持子物业）
                            return p.code === code || (code.length <= 4 && p.code.startsWith(code + '-'));
                        })
                    ).length;
                    
                    counts.set(sl.id, count);
                } else {
                    counts.set(sl.id || '', 0);
                }
            });
        }
        return counts;
    }, [subLandlords, allProperties]);

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
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
                    <Users className="w-6 h-6 text-blue-500 shrink-0" />
                    管理承租人
                </h1>
                <p className="text-sm text-zinc-500 dark:text-white/55 mt-1">管理租客及承租方信息</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm font-medium">{stats.label}</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">{stats.count}</p>
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
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                    />
                </div>
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
                <div className="flex gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-zinc-100/90 dark:bg-white/10 ring-1 ring-zinc-200/80 dark:ring-white/10 ml-auto w-full sm:w-auto justify-stretch sm:justify-start">
                    {(['tenants', 'sub_landlords', 'current_tenants'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-2 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-all min-h-9 sm:min-h-10 ${activeTab === tab
                                ? 'bg-white dark:bg-white/20 text-purple-700 dark:text-purple-300 shadow-md ring-1 ring-purple-500/20'
                                : 'text-zinc-600 dark:text-white/65 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            {tab === 'tenants' ? '承租人' : tab === 'sub_landlords' ? '二房東' : '現時租客'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'tenants' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                                className="mobile-card md:glass-card group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full p-4 sm:p-5 rounded-2xl"
                            >
                                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                                    <div className={`shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg ${tenant.type === 'company'
                                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20'
                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
                                        }`}>
                                        {tenant.type === 'company' ? '公司' : '個人'}
                                    </div>
                                </div>
                                <div className="flex items-start pr-[4.5rem] sm:pr-24 md:pr-20">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex flex-col items-center justify-center text-white font-bold leading-tight shrink-0 shadow-md shadow-blue-500/25 ring-1 ring-white/20 dark:ring-white/10">
                                            <span className="text-[7px] sm:text-[9px] opacity-80 mb-0.5 font-mono tracking-tight max-w-[2.5rem] sm:max-w-14 truncate px-0.5">{tenant.code}</span>
                                            <span className="text-base sm:text-lg md:text-xl">{tenant.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <h3 
                                                onClick={() => {
                                                    setSelectedTenant(tenant);
                                                    setTenantEditMode(false);
                                                    setShowTenantModal(true);
                                                }}
                                                className="text-zinc-900 dark:text-white font-bold text-sm sm:text-base md:text-lg leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer"
                                            >
                                                {tenant.shortName || tenant.name}
                                            </h3>
                                            <p className="text-zinc-600 dark:text-white/55 text-xs sm:text-sm truncate font-medium mt-1 tracking-wide">
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
                                            className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex flex-col items-center justify-center text-white font-bold leading-tight shrink-0 shadow-md shadow-blue-500/25 ring-1 ring-white/20 dark:ring-white/10 cursor-pointer hover:scale-[1.02] transition-transform"
                                        >
                                            <span className="text-[6px] sm:text-[8px] opacity-80 mb-0.5 font-mono tracking-tight max-w-[2.25rem] sm:max-w-14 truncate px-0.5 leading-tight text-center">{item.tenancyNumber || '—'}</span>
                                            <span className="text-base sm:text-lg md:text-xl">{item.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <h3 
                                                onClick={() => setShowSubLandlordDetail(item)}
                                                className="text-zinc-900 dark:text-white font-bold text-sm sm:text-base md:text-lg leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer"
                                            >
                                                {item.name}
                                            </h3>
                                            <p className="text-zinc-600 dark:text-white/55 text-xs sm:text-sm font-medium mt-1 line-clamp-2">
                                                <span className="font-mono">{item.tenancyNumber || '—'}</span>
                                                {subLandlordPropertyCounts.get(item.id || '') !== undefined && (
                                                    <span className="ml-1.5 sm:ml-2 text-blue-600 dark:text-blue-400 font-semibold">
                                                        ({subLandlordPropertyCounts.get(item.id || '')} 物業)
                                                    </span>
                                                )}
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
                                            setShowSubLandlordDetail(item);
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
                                className="mobile-card md:glass-card group hover:ring-2 hover:ring-blue-500/30 transition-all relative overflow-hidden h-full p-4 sm:p-5 rounded-2xl"
                            >
                                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                                    <div className="shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                                        現時租客
                                    </div>
                                </div>
                                <div className="flex items-start pr-[4.5rem] sm:pr-24 md:pr-20">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex flex-col items-center justify-center text-white font-bold leading-tight shrink-0 shadow-md shadow-emerald-500/25 ring-1 ring-white/20 dark:ring-white/10">
                                            <span className="text-[6px] sm:text-[8px] opacity-80 mb-0.5 font-mono tracking-tight max-w-[2.25rem] sm:max-w-14 truncate px-0.5 text-center leading-tight">{item.tenancyNumber || '—'}</span>
                                            <span className="text-base sm:text-lg md:text-xl">{item.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <h3 className="text-zinc-900 dark:text-white font-bold text-sm sm:text-base md:text-lg leading-snug line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                {item.name}
                                            </h3>
                                            <p className="text-zinc-600 dark:text-white/55 text-xs sm:text-sm font-medium mt-1 font-mono truncate">
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
                {showSubLandlordDetail && (
                    <SubLandlordDetailModal
                        subLandlord={showSubLandlordDetail}
                        allProperties={allProperties || []}
                        onClose={() => setShowSubLandlordDetail(null)}
                        onEdit={() => {}}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Sub-landlord Detail Modal Component
function SubLandlordDetailModal({ 
    subLandlord: initialSubLandlord, 
    allProperties,
    onClose,
    onEdit 
}: { 
    subLandlord: SubLandlord; 
    allProperties: Property[];
    onClose: () => void;
    onEdit: () => void;
}) {
    const [subLandlord, setSubLandlord] = useState(initialSubLandlord);
    const queryClient = useQueryClient();
    const router = useRouter();
    const { updateSubLandlord } = useSubLandlords();
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(initialSubLandlord.name);
    const [saving, setSaving] = useState(false);
    
    // 当传入的subLandlord变化时更新本地状态
    useEffect(() => {
        setSubLandlord(initialSubLandlord);
        setEditedName(initialSubLandlord.name);
        setIsEditingName(false);
    }, [initialSubLandlord]);
    
    const handleSaveName = async () => {
        if (!editedName.trim() || editedName.trim() === subLandlord.name) {
            setIsEditingName(false);
            return;
        }
        setSaving(true);
        try {
            const success = await updateSubLandlord(subLandlord.id!, { ...subLandlord, name: editedName.trim() });
            if (success) {
                setSubLandlord(prev => ({ ...prev, name: editedName.trim() }));
                await queryClient.invalidateQueries({ queryKey: ['sub_landlords'] });
                setIsEditingName(false);
            }
        } finally {
            setSaving(false);
        }
    };
    // 从出租合约号码中提取物业编号（格式：物业编号-后缀 或 物业编号，如 C33-ER033, A01-P008）
    const relatedProperties = useMemo(() => {
        if (!subLandlord.tenancyNumber) return [];
        
        // 如果包含逗号，说明有多个物业
        const parts = subLandlord.tenancyNumber.split(',').map(p => p.trim());
        const propertyCodes = new Set<string>();
        
        parts.forEach(part => {
            // 提取物业编号部分
            // 格式可能是：C33-ER033（物业编号-后缀）或 A01-P008（完整物业编号，可能是主物业-子物业）
            // 判断规则：如果后面部分匹配后缀模式（如ER开头+数字），则只取前面部分
            // 否则，整个part就是物业编号
            
            const firstDashIndex = part.indexOf('-');
            if (firstDashIndex > 0) {
                const afterDash = part.substring(firstDashIndex + 1);
                // 检查是否是后缀格式：2-3个大写字母+数字（如ER033, P001等）
                if (afterDash.match(/^[A-Z]{2,3}\d+$/)) {
                    // 是后缀格式，只取前面部分作为物业编号
                    propertyCodes.add(part.substring(0, firstDashIndex));
                } else {
                    // 不是后缀格式，整个part就是物业编号（如A01-P008）
                    propertyCodes.add(part);
                }
            } else {
                // 没有"-"，整个part就是物业编号
                propertyCodes.add(part);
            }
        });
        
        // 根据物业编号查找对应的物业
        return allProperties.filter(p => {
            if (!p.code) return false;
            // 完全匹配，或者物业编号以该code开头（支持子物业，如A01匹配A01-P008）
            return propertyCodes.has(p.code) || 
                   Array.from(propertyCodes).some(code => {
                       // 如果code是短格式（如C33），匹配完整格式（如C33-P001）
                       // 如果code是完整格式（如A01-P008），只匹配完全相同的
                       return p.code === code || (code.length <= 4 && p.code.startsWith(code + '-'));
                   });
        });
    }, [subLandlord.tenancyNumber, allProperties]);


    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-[70] flex flex-col"
            >
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">二房東詳細資料</h2>
                        <p className="text-sm text-zinc-500 dark:text-white/50 mt-1">{subLandlord.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="p-5 space-y-6 overflow-y-auto flex-1">
                    {/* Basic Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-white/80 mb-3">基本資料</h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">名稱</p>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={editedName}
                                            onChange={(e) => setEditedName(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveName();
                                                if (e.key === 'Escape') {
                                                    setEditedName(subLandlord.name);
                                                    setIsEditingName(false);
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={handleSaveName}
                                            disabled={saving}
                                            className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium transition-all disabled:opacity-50"
                                        >
                                            {saving ? '保存中...' : '保存'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditedName(subLandlord.name);
                                                setIsEditingName(false);
                                            }}
                                            className="px-3 py-2 bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white/70 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/20 text-sm font-medium transition-all"
                                        >
                                            取消
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white flex-1">{subLandlord.name}</p>
                                        <button
                                            onClick={() => setIsEditingName(true)}
                                            className="p-1.5 text-zinc-400 hover:text-purple-500 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                                            title="編輯名稱"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租號碼</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{subLandlord.tenancyNumber || '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Related Properties */}
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-white/80 mb-3">
                            關聯物業 ({relatedProperties.length})
                        </h3>
                        {relatedProperties.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-white/50">暫無關聯物業</p>
                        ) : (
                            <div className="space-y-2">
                                {relatedProperties.map(property => (
                                    <div
                                        key={property.id}
                                        onClick={() => {
                                            if (property.id) {
                                                router.push(`/dashboard/properties/${property.id}`);
                                                onClose();
                                            }
                                        }}
                                        className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                                    {property.name}
                                                </p>
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mt-1">
                                                    {property.code} • {property.address}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-white/40 ml-2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </>
    );
}
