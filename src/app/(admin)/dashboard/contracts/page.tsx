'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Trash2, Building2, Search, X, Calendar, Users, SlidersHorizontal } from 'lucide-react';
import { useRentsWithRelationsQuery, useRents } from '@/hooks/useStorage';
import type { Rent } from '@/lib/db';
import { labelRentOutContractNatureZh } from '@/lib/rentPaymentDisplay';
import {
    normalizeRentPropertyLotSelection,
    parseRentPropertyLotPartialFromRow,
} from '@/lib/formatters';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentModal from '@/components/properties/RentModal';
import PropertyDetailModal from '@/components/properties/PropertyDetailModal';
import { AdminListPagination, ADMIN_LIST_PAGE_SIZE } from '@/components/admin/AdminListPagination';

export default function ContractsPage() {
    const queryClient = useQueryClient();
    const { data: contracts = [], isLoading } = useRentsWithRelationsQuery({ type: 'contract' });
    const { deleteRent } = useRents();

    const [showModal, setShowModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Rent | null>(null);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [propertyDetailTarget, setPropertyDetailTarget] = useState<{ id?: string; name: string } | null>(null);
    /** 租賃合約（租入中）優先，其次出租合約 */
    const [contractListTab, setContractListTab] = useState<'lease_out' | 'lease_in'>('lease_in');
    /** 刪除前確認（頁內對話框，避免僅依賴瀏覽器 confirm） */
    const [deleteConfirm, setDeleteConfirm] = useState<{
        id: string;
        tenancyNumber?: string;
        propertyName?: string;
    } | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deletePortalReady, setDeletePortalReady] = useState(false);
    const [listPage, setListPage] = useState(1);
    useEffect(() => {
        setDeletePortalReady(true);
    }, []);

    /** 清除所有 filter 並重置頁碼 */
    const clearAllFilters = () => {
        setSearchQuery('');
        setFilterTenant('');
        setFilterStatus('');
        setFilterDateStart('');
        setFilterDateEnd('');
        setListPage(1);
    };

    const handleTabChange = (tab: 'lease_out' | 'lease_in') => {
        clearAllFilters();
        setContractListTab(tab);
    };

    /** Filter states */
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTenant, setFilterTenant] = useState(''); // 承租人篩選
    const [filterDateStart, setFilterDateStart] = useState(''); // 租約日期 - 開始
    const [filterDateEnd, setFilterDateEnd] = useState(''); // 租約日期 - 結束
    const [filterStatus, setFilterStatus] = useState(''); // 狀態篩選
    const [showFilters, setShowFilters] = useState(true); // 收合/展開 filter

    const sortByStartDateOldestFirst = (arr: any[]) =>
        [...arr].sort((a, b) => {
            const startA = a.rentOutStartDate ? new Date(a.rentOutStartDate).getTime() : 0;
            const startB = b.rentOutStartDate ? new Date(b.rentOutStartDate).getTime() : 0;
            return startA - startB;
        });

    const sortByEndDateNearestFirst = (arr: any[]) =>
        [...arr].sort((a, b) => {
            const endA = a.rentOutEndDate ? new Date(a.rentOutEndDate).getTime() : Number.MAX_SAFE_INTEGER;
            const endB = b.rentOutEndDate ? new Date(b.rentOutEndDate).getTime() : Number.MAX_SAFE_INTEGER;
            return endA - endB;
        });

    const leaseOutContracts = useMemo(
        () =>
            sortByEndDateNearestFirst(
                (contracts as any[]).filter((c) => (c.rentOutStatus || c.status) !== 'leasing_in')
            ),
        [contracts]
    );
    const leaseInContracts = useMemo(
        () =>
            sortByStartDateOldestFirst(
                (contracts as any[]).filter((c) => (c.rentOutStatus || c.status) === 'leasing_in')
            ),
        [contracts]
    );
    const activeContracts = contractListTab === 'lease_out' ? leaseOutContracts : leaseInContracts;
    const isLeaseInTab = contractListTab === 'lease_in';

    /** 合約表單：業主存 tenant_id（join 為 tenant）、現時租客存 rent_out_tenant_ids（API 附 currentTenant） */
    const contractOwnerDisplayName = (c: any) =>
        (c.tenant?.name && String(c.tenant.name).trim()) ||
        (c.proprietor?.name && String(c.proprietor.name).trim()) ||
        '';
    const contractLesseeDisplayName = (c: any) => {
        const fromCt = c.currentTenant?.name && String(c.currentTenant.name).trim();
        if (fromCt) return fromCt;
        const rt = c.rentOutTenants;
        if (Array.isArray(rt) && rt[0] != null && String(rt[0]).trim()) return String(rt[0]).trim();
        return '';
    };

    /** 套用所有 Filter 條件 */
    const filteredContracts = useMemo(() => {
        let result = activeContracts as any[];

        // 1. 搜尋過濾（合約號碼 + 物業名稱 + 承租人 + 業主）
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((c) => {
                const lessee = contractLesseeDisplayName(c).toLowerCase();
                const owner = contractOwnerDisplayName(c).toLowerCase();
                const propertyName = (c.property?.name || '').toLowerCase();
                const tenancyNumber = (c.rentOutTenancyNumber || '').toLowerCase();
                return (
                    lessee.includes(q) ||
                    owner.includes(q) ||
                    propertyName.includes(q) ||
                    tenancyNumber.includes(q)
                );
            });
        }

        // 2. 承租人篩選
        if (filterTenant) {
            result = result.filter((c) => {
                const lessee = contractLesseeDisplayName(c);
                const owner = contractOwnerDisplayName(c);
                return lessee === filterTenant || owner === filterTenant;
            });
        }

        // 3. 租約日期範圍篩選
        if (filterDateStart) {
            const start = new Date(filterDateStart);
            result = result.filter((c) => {
                const contractStart = c.rentOutStartDate ? new Date(c.rentOutStartDate) : null;
                return contractStart && contractStart >= start;
            });
        }
        if (filterDateEnd) {
            const end = new Date(filterDateEnd);
            end.setHours(23, 59, 59, 999); // 包含結束日當天
            result = result.filter((c) => {
                const contractEnd = c.rentOutEndDate ? new Date(c.rentOutEndDate) : null;
                return contractEnd && contractEnd <= end;
            });
        }

        // 4. 狀態篩選
        if (filterStatus) {
            result = result.filter((c) => (c.rentOutStatus || c.status) === filterStatus);
        }

        return result;
    }, [activeContracts, searchQuery, filterTenant, filterDateStart, filterDateEnd, filterStatus]);

    const totalListPages = Math.max(1, Math.ceil((filteredContracts as any[]).length / ADMIN_LIST_PAGE_SIZE));
    const effectiveListPage = Math.min(listPage, totalListPages);
    const pagedActiveContracts = useMemo(() => {
        const arr = filteredContracts as any[];
        const start = (effectiveListPage - 1) * ADMIN_LIST_PAGE_SIZE;
        return arr.slice(start, start + ADMIN_LIST_PAGE_SIZE);
    }, [filteredContracts, effectiveListPage]);

    const formatContractDepositPaid = (c: any) => {
        const v = c.rentOutDepositReceived;
        if (v == null || v === '') return '—';
        const n = Number(v);
        if (Number.isNaN(n)) return '—';
        return `${c.currency || 'HKD'} ${n.toLocaleString()}`;
    };

    const statusColors: Record<string, string> = {
        active: 'bg-green-500/20 text-green-400',
        pending: 'bg-yellow-500/20 text-yellow-400',
        completed: 'bg-blue-500/20 text-blue-400',
        cancelled: 'bg-red-500/20 text-red-400',
        listing: 'bg-purple-500/20 text-purple-400',
        /** 出租中：深字 + 較實底色 + 邊框，提升可讀性 */
        renting:
            'bg-emerald-100 text-emerald-900 border border-emerald-400/70 dark:bg-emerald-950/55 dark:text-emerald-100 dark:border-emerald-500/55',
        /** 租入中：與出租中區隔且同樣提高對比 */
        leasing_in:
            'bg-violet-100 text-violet-900 border border-violet-400/70 dark:bg-violet-950/55 dark:text-violet-100 dark:border-violet-500/55',
    };

    const openDeleteConfirm = (e: React.MouseEvent, contract: any) => {
        e.stopPropagation();
        setDeleteConfirm({
            id: contract.id,
            tenancyNumber: contract.rentOutTenancyNumber,
            propertyName: contract.property?.name,
        });
    };

    const executeDelete = async () => {
        if (!deleteConfirm) return;
        setDeleteBusy(true);
        const ok = await deleteRent(deleteConfirm.id);
        setDeleteBusy(false);
        setDeleteConfirm(null);
        if (ok) {
            queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
            queryClient.invalidateQueries({ queryKey: ['rents'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        } else {
            window.alert('刪除失敗，請稍後再試。');
        }
    };

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
        queryClient.invalidateQueries({ queryKey: ['rents'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-12 h-12 rounded-full bg-amber-500"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-7 h-7 text-amber-500 md:hidden" />
                        管理合約
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">
                        查看與管理物業合約記錄（放盤／出租合約等）
                    </p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                        setSelectedContract(null);
                        setShowModal(true);
                    }}
                    className="px-4 py-2.5 bg-linear-to-r from-amber-500 to-orange-500 rounded-xl text-white font-medium shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                    <FileText className="w-5 h-5" />
                    新增合約記錄
                </motion.button>
            </div>

            {/* 統計卡片順序：合約總數 → 租賃中 → 出租中 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">合約總數</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{contracts.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/20">
                            <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                </BentoCard>
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">租賃中</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{leaseInContracts.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-500/20">
                            <FileText className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                        </div>
                    </div>
                </BentoCard>
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">出租中</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {contracts.filter((c: any) => (c.rentOutStatus || c.status) === 'renting').length}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/20">
                            <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </BentoCard>
            </div>

            {/* Filter Bar */}
            <div className="glass-card overflow-hidden">
                {/* Filter Toggle Bar */}
                <div className="flex flex-wrap items-center gap-3 p-3 border-b border-zinc-100 dark:border-white/10">
                    {/* 搜尋框 */}
                        <div className="relative flex-1 min-w-50">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜尋合約..."
                            className="w-full pl-10 pr-9 py-2.5 text-sm bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter 按鈕 */}
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            showFilters || filterTenant || filterStatus || filterDateStart || filterDateEnd
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-500/30'
                                : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-white/10'
                        }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span>篩選</span>
                        {(filterTenant || filterStatus || filterDateStart || filterDateEnd) && (
                            <span className="w-5 h-5 flex items-center justify-center bg-amber-500 text-white rounded-full text-[10px] font-bold">
                                {(!!filterTenant ? 1 : 0) + (!!filterStatus ? 1 : 0) + (!!filterDateStart ? 1 : 0) + (!!filterDateEnd ? 1 : 0)}
                            </span>
                        )}
                    </button>

                    {/* 快速清除全部 */}
                    {(searchQuery || filterTenant || filterStatus || filterDateStart || filterDateEnd) && (
                        <button
                            type="button"
                            onClick={() => clearAllFilters()}
                            className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-500 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            清除全部
                        </button>
                    )}
                </div>

                {/* 展開的 Filter 內容 */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* 承租人 */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-white/50 pl-0.5">
                                        <Users className="w-4 h-4" />
                                        承租人
                                    </label>
                                    <select
                                        value={filterTenant}
                                        onChange={(e) => setFilterTenant(e.target.value)}
                                        className="w-full px-4 py-3 text-sm bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                                    >
                                        <option value="">全部</option>
                                        {(() => {
                                            const tenantSet = new Set<string>();
                                            const uniqueTenants: { name: string; code?: string }[] = [];
                                            (activeContracts as any[]).forEach((c) => {
                                                const name = contractLesseeDisplayName(c);
                                                if (name && !tenantSet.has(name)) {
                                                    tenantSet.add(name);
                                                    uniqueTenants.push({ name, code: (c as any).tenant?.code || (c as any).proprietor?.code });
                                                }
                                            });
                                            return uniqueTenants
                                                .sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'))
                                                .map((t) => (
                                                    <option key={t.name} value={t.name}>
                                                        {t.code ? `[${t.code}] ${t.name}` : t.name}
                                                    </option>
                                                ));
                                        })()}
                                    </select>
                                </div>

                                {/* 租約日期 - 開始 */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-white/50 pl-0.5">
                                        <Calendar className="w-4 h-4" />
                                        租約開始日期
                                    </label>
                                    <input
                                        type="date"
                                        value={filterDateStart}
                                        onChange={(e) => setFilterDateStart(e.target.value)}
                                        className="w-full px-4 py-3 text-sm bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                                    />
                                </div>

                                {/* 租約日期 - 結束 */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-white/50 pl-0.5">
                                        <Calendar className="w-4 h-4" />
                                        租約結束日期
                                    </label>
                                    <input
                                        type="date"
                                        value={filterDateEnd}
                                        onChange={(e) => setFilterDateEnd(e.target.value)}
                                        className="w-full px-4 py-3 text-sm bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                                    />
                                </div>

                                {/* 狀態 */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-white/50 pl-0.5">
                                        <SlidersHorizontal className="w-4 h-4" />
                                        狀態
                                    </label>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="w-full px-4 py-3 text-sm bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                                    >
                                        <option value="">全部</option>
                                        <option value="listing">放盤中</option>
                                        <option value="renting">出租中</option>
                                        <option value="leasing_in">租入中</option>
                                        <option value="completed">已完租</option>
                                    </select>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div
                className={`glass-card overflow-hidden transition-colors ${
                    isLeaseInTab
                        ? 'border-violet-200 dark:border-violet-500/35'
                        : 'border-amber-200 dark:border-amber-500/30'
                }`}
            >
                <div
                    className={`p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                        isLeaseInTab
                            ? 'border-violet-200 dark:border-violet-500/25 bg-violet-50/60 dark:bg-violet-500/10'
                            : 'border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10'
                    }`}
                >
                    <h2
                        className={`text-lg font-semibold shrink-0 ${
                            isLeaseInTab
                                ? 'text-violet-900 dark:text-violet-100'
                                : 'text-amber-900 dark:text-amber-100'
                        }`}
                    >
                        {contractListTab === 'lease_out' ? '出租合約記錄列表' : '租賃合約記錄列表'}
                        <span className="ml-2 text-base font-bold tabular-nums opacity-90">
                            (總合約({filteredContracts.length}))
                        </span>
                    </h2>
                    <div className="flex gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-zinc-100/90 dark:bg-white/10 ring-1 ring-zinc-200/80 dark:ring-white/10 w-full sm:w-auto justify-stretch sm:justify-end">
                        <button
                            type="button"
                            onClick={() => handleTabChange('lease_in')}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                contractListTab === 'lease_in'
                                    ? 'bg-white dark:bg-violet-950/50 text-violet-900 dark:text-violet-100 shadow-md ring-2 ring-violet-400/50'
                                    : 'bg-violet-50/70 dark:bg-violet-500/12 text-violet-800/85 dark:text-violet-200/80 ring-1 ring-violet-300/40 dark:ring-violet-500/25 hover:bg-violet-100/90 dark:hover:bg-violet-500/20'
                            }`}
                        >
                            租賃合約
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('lease_out')}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                contractListTab === 'lease_out'
                                    ? 'bg-white dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 shadow-md ring-1 ring-amber-400/35'
                                    : 'text-zinc-500 dark:text-white/50 hover:text-amber-700 dark:hover:text-amber-300/90'
                            }`}
                        >
                            出租合約
                        </button>
                    </div>
                </div>
                {contracts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400 dark:text-white/40">
                        <FileText className="w-16 h-16 mb-4 opacity-40" />
                        <p className="text-lg">暫無合約記錄</p>
                        <p className="text-sm mt-1">點擊「新增合約記錄」開始建立</p>
                    </div>
                ) : filteredContracts.length === 0 ? (
                    <div
                        className={`flex flex-col items-center justify-center py-20 ${
                            isLeaseInTab
                                ? 'text-violet-600/70 dark:text-violet-300/50'
                                : 'text-amber-700/60 dark:text-amber-300/45'
                        }`}
                    >
                        <Search className={`w-16 h-16 mb-4 ${isLeaseInTab ? 'opacity-50 text-violet-500' : 'opacity-40 text-amber-500'}`} />
                        <p className="text-lg text-zinc-600 dark:text-white/55">
                            找不到符合條件的合約
                        </p>
                        <p className="text-sm mt-1 text-zinc-500 dark:text-white/40">請調整篩選條件後再試</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-225">
                                <thead>
                                    <tr
                                        className={`text-left text-zinc-500 dark:text-white/50 text-xs border-b ${
                                            isLeaseInTab
                                                ? 'border-violet-200 dark:border-violet-500/25'
                                                : 'border-amber-200 dark:border-amber-500/20'
                                        }`}
                                    >
                                        <th className="p-3 font-medium">物業</th>
                                        <th className="p-3 font-medium">
                                            {contractListTab === 'lease_out' ? '出租合約號碼' : '租賃合約號碼'}
                                        </th>
                                        <th className="p-3 font-medium">業主</th>
                                        <th className="p-3 font-medium">承租人</th>
                                        <th className="p-3 font-medium">月租</th>
                                        <th className="p-3 font-medium">租約期間 / 完結日</th>
                                        <th className="p-3 font-medium">{isLeaseInTab ? '已付按金' : '已收按金'}</th>
                                        <th className="p-3 font-medium">租賃性質</th>
                                        <th className="p-3 font-medium">合約描述</th>
                                        <th className="p-3 font-medium">狀態</th>
                                        <th className="p-3 font-medium">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedActiveContracts.map((contract, index) => {
                                        const property = contract.property;
                                        const startDate = contract.rentOutStartDate;
                                        const endDate = contract.rentOutEndDate;
                                        const monthlyRent = contract.rentOutMonthlyRental || 0;
                                        const status = contract.rentOutStatus || 'listing';
                                        const ownerName = contractOwnerDisplayName(contract);
                                        const lesseeName = contractLesseeDisplayName(contract);

                                        return (
                                            <motion.tr
                                                key={contract.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.04 }}
                                                onClick={() => {
                                                    const pid = contract.propertyId || property?.id;
                                                    if (pid || property?.name) {
                                                        setPropertyDetailTarget({
                                                            id: pid || undefined,
                                                            name: property?.name || '物業',
                                                        });
                                                        setShowPropertyModal(true);
                                                    }
                                                }}
                                                className={`border-b transition-colors cursor-pointer ${
                                                    isLeaseInTab
                                                        ? 'border-violet-200/50 dark:border-violet-500/15 hover:bg-violet-50/50 dark:hover:bg-violet-500/8'
                                                        : 'border-amber-200/50 dark:border-amber-500/10 hover:bg-amber-50/50 dark:hover:bg-amber-500/5'
                                                }`}
                                            >
                                                <td className="p-3">
                                                    <div className="text-zinc-900 dark:text-white text-sm font-medium max-w-32 truncate" title={property?.name || '-'}>
                                                        {property?.name || '-'}
                                                    </div>
                                                    <div className="text-xs text-zinc-400 dark:text-white/40 mt-0.5 line-clamp-1 max-w-32">
                                                        {(() => {
                                                            const selected = normalizeRentPropertyLotSelection(contract.rentPropertyLot ?? (contract as any).rent_property_lot);
                                                            const partial = parseRentPropertyLotPartialFromRow(contract.rentPropertyLotPartial ?? (contract as any).rent_property_lot_partial);
                                                            if (!selected.length) return <span>—</span>;
                                                            const lots = selected.map(lot => partial[lot] ? `${lot}（部分地方）` : lot);
                                                            if (lots.length > 1) {
                                                                return <span title={lots.join('、')}>{lots[0]}...</span>;
                                                            }
                                                            return <span>{lots[0]}</span>;
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`font-semibold text-sm ${
                                                            isLeaseInTab
                                                                ? 'text-violet-700 dark:text-violet-300'
                                                                : 'text-amber-600 dark:text-amber-400'
                                                        }`}
                                                    >
                                                        {contract.rentOutTenancyNumber || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-zinc-600 dark:text-white/70 text-sm max-w-28">
                                                    <div className="truncate" title={ownerName || '-'}>
                                                        {ownerName || '-'}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-zinc-600 dark:text-white/70 text-sm max-w-28">
                                                    <div className="truncate" title={lesseeName || '-'}>
                                                        {lesseeName || '-'}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`font-semibold text-base ${
                                                            isLeaseInTab
                                                                ? 'text-violet-700 dark:text-violet-300'
                                                                : 'text-amber-600 dark:text-amber-400'
                                                        }`}
                                                    >
                                                        {contract.currency || 'HKD'} {monthlyRent.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-zinc-500 dark:text-white/50 text-sm leading-relaxed">
                                                    <div className="whitespace-nowrap">{startDate ? new Date(startDate).toLocaleDateString() : '-'}</div>
                                                    <div className="whitespace-nowrap">
                                                        ~ {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                                        {startDate && endDate
                                                            ? ` (${
                                                                  (() => {
                                                                      const m = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
                                                                      const y = Math.floor(m / 12);
                                                                      const r = m % 12;
                                                                      if (y === 0) return `${r} 個月`;
                                                                      if (r === 0) return `${y} 年`;
                                                                      return `${y} 年 ${r} 個月`;
                                                                  })()
                                                              })`
                                                            : ''}
                                                    </div>
                                                    {endDate ? (
                                                        (() => {
                                                            const now = new Date();
                                                            const end = new Date(endDate);
                                                            const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                            if (diff < 0) {
                                                                return (
                                                                    <div className="mt-1 text-zinc-400 dark:text-zinc-500 line-through text-xs">
                                                                        已完結
                                                                    </div>
                                                                );
                                                            }
                                                            if (diff === 0) {
                                                                return (
                                                                    <div className="mt-1 text-red-600 dark:text-red-400 font-bold animate-pulse text-sm">
                                                                        今日完結
                                                                    </div>
                                                                );
                                                            }
                                                            const y = Math.floor(diff / 365);
                                                            const m = Math.floor((diff % 365) / 30);
                                                            const d = diff % 30;
                                                            let parts = [];
                                                            if (y > 0) parts.push(`${y} 年`);
                                                            if (m > 0) parts.push(`${m} 個月`);
                                                            if (d > 0 || parts.length === 0) parts.push(`${d} 日`);
                                                            return (
                                                                <span className={`mt-1 inline-block text-sm font-bold px-1.5 py-0.5 rounded-md ${
                                                                    diff <= 30
                                                                        ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300'
                                                                        : diff <= 90
                                                                        ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                                                                        : 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                                                                }`}>
                                                                    剩 {parts.join(' ')}
                                                                </span>
                                                            );
                                                        })()
                                                    ) : null}
                                                </td>
                                                <td className="p-3 text-zinc-600 dark:text-white/70 text-sm">
                                                    {formatContractDepositPaid(contract)}
                                                </td>
                                                <td className="p-3 text-zinc-600 dark:text-white/70 text-sm">
                                                    {labelRentOutContractNatureZh(contract.rentOutContractNature)}
                                                </td>
                                                <td className="p-3 text-zinc-500 dark:text-white/50 text-sm max-w-24">
                                                    {(() => {
                                                        const raw = contract.rentOutDescription || '';
                                                        const plain = raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                                                        if (!plain) return <span className="text-zinc-300 dark:text-white/20">—</span>;
                                                        return (
                                                            <span
                                                                className="line-clamp-2 cursor-default"
                                                                title={plain}
                                                            >
                                                                {plain}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.listing}`}
                                                    >
                                                        {status === 'renting'
                                                            ? '出租中'
                                                            : status === 'listing'
                                                              ? '放盤中'
                                                              : status === 'leasing_in'
                                                                ? '租入中'
                                                              : status === 'completed'
                                                                ? '已完租'
                                                                : '放盤中'}
                                                    </span>
                                                </td>
                                                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedContract(contract);
                                                                setShowModal(true);
                                                            }}
                                                            className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                                            title="編輯"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => openDeleteConfirm(e, contract)}
                                                            className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                                            title="刪除"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden p-4 space-y-3">
                            {pagedActiveContracts.map((contract, index) => {
                                const property = contract.property;
                                const startDate = contract.rentOutStartDate;
                                const endDate = contract.rentOutEndDate;
                                const monthlyRent = contract.rentOutMonthlyRental || 0;
                                const status = contract.rentOutStatus || 'listing';
                                const ownerName = contractOwnerDisplayName(contract);
                                const lesseeName = contractLesseeDisplayName(contract);

                                return (
                                    <motion.div
                                        key={contract.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        onClick={() => {
                                            const pid = contract.propertyId || property?.id;
                                            if (pid || property?.name) {
                                                setPropertyDetailTarget({
                                                    id: pid || undefined,
                                                    name: property?.name || '物業',
                                                });
                                                setShowPropertyModal(true);
                                            }
                                        }}
                                        className={`mobile-card p-4 space-y-3 border ${
                                            isLeaseInTab
                                                ? 'border-violet-200/60 dark:border-violet-500/25'
                                                : 'border-amber-200/50 dark:border-amber-500/20'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-bold text-zinc-900 dark:text-white">{property?.name || '-'}</h3>
                                                <p className="text-xs text-zinc-400 dark:text-white/40 mt-0.5 line-clamp-1">
                                                    {(() => {
                                                        const selected = normalizeRentPropertyLotSelection(contract.rentPropertyLot ?? (contract as any).rent_property_lot);
                                                        const partial = parseRentPropertyLotPartialFromRow(contract.rentPropertyLotPartial ?? (contract as any).rent_property_lot_partial);
                                                        if (!selected.length) return '—';
                                                        const lots = selected.map(lot => partial[lot] ? `${lot}（部分地方）` : lot);
                                                        if (lots.length > 1) {
                                                            return <span title={lots.join('、')}>{lots[0]}...</span>;
                                                        }
                                                        return lots[0];
                                                    })()}
                                                </p>
                                                <p
                                                    className={`text-xs mt-0.5 ${
                                                        isLeaseInTab
                                                            ? 'text-violet-700 dark:text-violet-300'
                                                            : 'text-amber-600 dark:text-amber-400'
                                                    }`}
                                                >
                                                    {contractListTab === 'lease_out' ? '出租合約號碼' : '租賃合約號碼'}：
                                                    {contract.rentOutTenancyNumber || '—'}
                                                </p>
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mt-2">業主</p>
                                                <p className="text-sm font-medium text-zinc-800 dark:text-white/90">
                                                    {ownerName || '—'}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusColors[status] || statusColors.listing}`}
                                            >
                                                {status === 'renting' ? '出租中' : status === 'listing' ? '放盤中' : status === 'leasing_in' ? '租入中' : status === 'completed' ? '已完租' : '其他'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-600 dark:text-white/70">承租人：{lesseeName || '-'}</p>
                                        <p
                                            className={`text-base font-semibold ${
                                                isLeaseInTab
                                                    ? 'text-violet-700 dark:text-violet-300'
                                                    : 'text-amber-600 dark:text-amber-400'
                                            }`}
                                        >
                                            {contract.currency || 'HKD'} {monthlyRent.toLocaleString()} / 月
                                        </p>
                                        <div className="text-sm text-zinc-500 dark:text-white/50 leading-relaxed">
                                            <div>{startDate ? new Date(startDate).toLocaleDateString() : '-'}</div>
                                            <div>
                                                ~ {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                                {startDate && endDate
                                                    ? ` (${
                                                          (() => {
                                                              const m = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
                                                              const y = Math.floor(m / 12);
                                                              const r = m % 12;
                                                              if (y === 0) return `${r} 個月`;
                                                              if (r === 0) return `${y} 年`;
                                                              return `${y} 年 ${r} 個月`;
                                                          })()
                                                      })`
                                                    : ''}
                                            </div>
                                        </div>
                                        <div className="text-sm text-zinc-500 dark:text-white/50">
                                            <span className="text-zinc-700 dark:text-white/80 font-medium">完結日：</span>
                                            {endDate ? (
                                                (() => {
                                                    const now = new Date();
                                                    const end = new Date(endDate);
                                                    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                    if (diff < 0) {
                                                        return (
                                                            <span className="text-zinc-400 dark:text-zinc-500 line-through">
                                                                已完結
                                                            </span>
                                                        );
                                                    }
                                                    if (diff === 0) {
                                                        return (
                                                            <span className="text-red-600 dark:text-red-400 font-bold animate-pulse">
                                                                今日完結
                                                            </span>
                                                        );
                                                    }
                                                    const y = Math.floor(diff / 365);
                                                    const m = Math.floor((diff % 365) / 30);
                                                    const d = diff % 30;
                                                    let parts = [];
                                                    if (y > 0) parts.push(`${y} 年`);
                                                    if (m > 0) parts.push(`${m} 個月`);
                                                    if (d > 0 || parts.length === 0) parts.push(`${d} 日`);
                                                    return (
                                                        <span className={`inline-block text-sm font-bold px-1.5 py-0.5 rounded-md ${
                                                            diff <= 30
                                                                ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300'
                                                                : diff <= 90
                                                                ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                                                                : 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                                                        }`}>
                                                            剩 {parts.join(' ')}
                                                        </span>
                                                    );
                                                })()
                                            ) : (
                                                <span className="text-zinc-300 dark:text-white/20">—</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-500 dark:text-white/50">
                                            <span className="text-zinc-700 dark:text-white/80 font-medium">{isLeaseInTab ? '已付按金' : '已收按金'}：</span><span className="text-zinc-800 dark:text-white/90">{formatContractDepositPaid(contract)}</span>
                                        </p>
                                        <p className="text-sm text-zinc-500 dark:text-white/50">
                                            <span className="text-zinc-700 dark:text-white/80 font-medium">租賃性質：</span><span className="text-zinc-800 dark:text-white/90">
                                                {labelRentOutContractNatureZh(contract.rentOutContractNature)}
                                            </span>
                                        </p>
                                        {(() => {
                                            const raw = contract.rentOutDescription || '';
                                            const plain = raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                                            if (!plain) return null;
                                            return (
                                                <p className="text-sm text-zinc-500 dark:text-white/50 line-clamp-2">
                                                    <span className="text-zinc-700 dark:text-white/80 font-medium">合約描述：</span><span className="text-zinc-700 dark:text-white/70">{plain}</span>
                                                </p>
                                            );
                                        })()}
                                        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedContract(contract);
                                                    setShowModal(true);
                                                }}
                                                className="p-2 rounded-lg bg-zinc-100 dark:bg-white/5"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => openDeleteConfirm(e, contract)}
                                                className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        <AdminListPagination
                            listPage={effectiveListPage}
                            totalPages={totalListPages}
                            totalItems={(filteredContracts as any[]).length}
                            onPageChange={setListPage}
                            activeButtonClassName={
                                isLeaseInTab
                                    ? 'bg-violet-600 text-white shadow-md'
                                    : 'bg-amber-600 text-white shadow-md'
                            }
                        />
                    </>
                )}
            </div>

            <AnimatePresence>
                {showModal && (
                    <RentModal
                        key={selectedContract?.id ?? 'contract-modal'}
                        defaultType="contract"
                        allowedTypes={['contract']}
                        rent={selectedContract || undefined}
                        propertyId={selectedContract?.propertyId}
                        defaultLocation={selectedContract?.rentOutAddressDetail}
                        onClose={() => {
                            setShowModal(false);
                            setSelectedContract(null);
                        }}
                        onSuccess={() => {
                            invalidate();
                            setShowModal(false);
                            setSelectedContract(null);
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showPropertyModal && propertyDetailTarget && (
                    <PropertyDetailModal
                        propertyId={propertyDetailTarget.id}
                        propertyName={propertyDetailTarget.name}
                        onClose={() => {
                            setShowPropertyModal(false);
                            setPropertyDetailTarget(null);
                        }}
                    />
                )}
            </AnimatePresence>

            {deletePortalReady &&
                createPortal(
                    <AnimatePresence>
                        {deleteConfirm && (
                            <motion.div
                                key="contract-delete-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-100 flex min-h-dvh w-screen items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                                onClick={() => !deleteBusy && setDeleteConfirm(null)}
                            >
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-2xl"
                                    role="alertdialog"
                                    aria-modal="true"
                                    aria-labelledby="contract-delete-title"
                                    aria-describedby="contract-delete-desc"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <h3 id="contract-delete-title" className="text-xl font-bold text-zinc-900 dark:text-white">
                                        確認刪除合約記錄
                                    </h3>
                                    <p id="contract-delete-desc" className="text-zinc-600 dark:text-white/60 mt-3 text-sm leading-relaxed">
                                        確定要刪除此合約記錄嗎？此操作無法復原。
                                        {(deleteConfirm.propertyName || deleteConfirm.tenancyNumber) && (
                                            <span className="mt-2 block text-zinc-800 dark:text-white/80">
                                                {deleteConfirm.propertyName && (
                                                    <>
                                                        物業：<span className="font-medium">{deleteConfirm.propertyName}</span>
                                                        {deleteConfirm.tenancyNumber ? '　' : ''}
                                                    </>
                                                )}
                                                {deleteConfirm.tenancyNumber && (
                                                    <>
                                                        合約號碼：<span className="font-medium">{deleteConfirm.tenancyNumber}</span>
                                                    </>
                                                )}
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            type="button"
                                            disabled={deleteBusy}
                                            onClick={() => setDeleteConfirm(null)}
                                            className="px-4 py-2 rounded-xl text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all disabled:opacity-50"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="button"
                                            disabled={deleteBusy}
                                            onClick={() => void executeDelete()}
                                            className="px-4 py-2 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
                                        >
                                            {deleteBusy ? '刪除中…' : '確認刪除'}
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
        </div>
    );
}
