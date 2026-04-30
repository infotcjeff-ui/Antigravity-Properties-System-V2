'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRentsWithRelationsQuery, useRents } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { User, Building2, Pencil, Trash2, LayoutList, X, Calendar } from 'lucide-react';
import type { Rent } from '@/lib/db';
import {
    formatDateDMY,
    formatDateRangeDMY,
    getRentCollectionPayListStatus,
    hasRentCollectionPaidAmount,
    labelRentCollectionPaymentMethod,
    matchesRentPaymentMethodFilter,
    type RentCollectionPayListStatus,
    type RentPaymentMethodFilterValue,
} from '@/lib/rentPaymentDisplay';
import {
    normalizeRentPropertyLotSelection,
    parseRentPropertyLotPartialFromRow,
} from '@/lib/formatters';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentModal from '@/components/properties/RentModal';
import PropertyDetailModal from '@/components/properties/PropertyDetailModal';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import { AdminListPagination, ADMIN_LIST_PAGE_SIZE } from '@/components/admin/AdminListPagination';

type RentingPayStatusFilter = '' | RentCollectionPayListStatus;

const rentingPayStatusBadgeClass: Record<RentCollectionPayListStatus, string> = {
    paid: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30',
    unpaid: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25',
};

const rentingPayStatusLabel: Record<RentCollectionPayListStatus, string> = {
    paid: '已繳付',
    unpaid: '未繳付',
};

const filterSelectClass =
    'mt-1 block w-full min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e] px-3 py-2 text-sm text-zinc-900 dark:text-white';

export default function RentingPage() {
    const queryClient = useQueryClient();
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);
    const { data: rents = [], isLoading } = useRentsWithRelationsQuery({ type: 'renting' });
    const [showModal, setShowModal] = useState(false);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);
    const [propertyDetailTarget, setPropertyDetailTarget] = useState<{ id?: string; name: string } | null>(null);
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<RentPaymentMethodFilterValue>('');
    const [filterRentingPayStatus, setFilterRentingPayStatus] = useState<RentingPayStatusFilter>('');
    const [filterOwner, setFilterOwner] = useState(''); // 業主篩選
    const [filterLessee, setFilterLessee] = useState(''); // 承租人篩選
    const [expenseDateStart, setExpenseDateStart] = useState(''); // 總支出日期篩選 - 開始
    const [expenseDateEnd, setExpenseDateEnd] = useState(''); // 總支出日期篩選 - 結束
    const [listPage, setListPage] = useState(1);
    const { deleteRent } = useRents();

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('確定要刪除這條記錄嗎？')) {
            const success = await deleteRent(id);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            }
        }
    };

    // Calculate total expense with date filter
    const totalExpense = useMemo(() => {
        return rents
            .filter(r => {
                const active = r.status === 'active' || r.status === 'completed' || r.rentOutStatus === 'renting';
                if (!active) return false;
                const startDate = r.rentCollectionDate || r.rentingStartDate || r.startDate;
                if (!startDate) return true;
                const d = new Date(startDate);
                if (expenseDateStart && d < new Date(expenseDateStart)) return false;
                if (expenseDateEnd && d > new Date(expenseDateEnd + 'T23:59:59')) return false;
                return true;
            })
            .reduce((sum, r) => sum + ((r.rentCollectionAmount || r.amount || 0)), 0);
    }, [rents, expenseDateStart, expenseDateEnd]);

    /** 業主名稱（租賃合約中：tenant 是承租人，proprietor 是業主） */
    const landlordDisplayName = (r: any) =>
        (r.proprietor?.name && String(r.proprietor.name).trim()) || '';
    /** 承租人名稱 */
    const lesseeDisplayName = (r: any) =>
        (r.rentCollectionTenantName && String(r.rentCollectionTenantName).trim()) ||
        (r.tenant?.name && String(r.tenant.name).trim()) ||
        '';

    const ownerFilterOptions = useMemo(() => {
        const set = new Set<string>();
        for (const r of rents) {
            const name = landlordDisplayName(r);
            if (name) set.add(name);
        }
        return [...set].sort((a, b) => a.localeCompare(b, 'zh-HK'));
    }, [rents]);

    const lesseeFilterOptions = useMemo(() => {
        const set = new Set<string>();
        for (const r of rents) {
            const name = lesseeDisplayName(r);
            if (name) set.add(name);
        }
        return [...set].sort((a, b) => a.localeCompare(b, 'zh-HK'));
    }, [rents]);

    const paidCount = rents.filter(r => getRentCollectionPayListStatus(r) === 'paid').length;
    const unpaidCount = rents.filter(r => getRentCollectionPayListStatus(r) === 'unpaid').length;

    const filteredRents = useMemo(() => {
        return [...rents].sort((a, b) => {
            const dateA = new Date(a.rentingStartDate || a.startDate || 0).getTime();
            const dateB = new Date(b.rentingStartDate || b.startDate || 0).getTime();
            return dateB - dateA;
        }).filter(r => {
            if (!matchesRentPaymentMethodFilter(r, filterPaymentMethod)) return false;
            if (filterRentingPayStatus && getRentCollectionPayListStatus(r) !== filterRentingPayStatus) return false;
            if (filterOwner && landlordDisplayName(r) !== filterOwner) return false;
            if (filterLessee && lesseeDisplayName(r) !== filterLessee) return false;
            return true;
        });
    }, [rents, filterPaymentMethod, filterRentingPayStatus, filterOwner, filterLessee]);

    const totalListPages = Math.max(1, Math.ceil(filteredRents.length / ADMIN_LIST_PAGE_SIZE));
    const effectiveListPage = Math.min(listPage, totalListPages);
    const pagedRents = useMemo(() => {
        const start = (effectiveListPage - 1) * ADMIN_LIST_PAGE_SIZE;
        return filteredRents.slice(start, start + ADMIN_LIST_PAGE_SIZE);
    }, [filteredRents, effectiveListPage]);

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
                        <LayoutList className="w-6 h-6 text-purple-500 md:hidden" aria-hidden />
                        {t('Rent payment', '交租管理')}
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">
                        {t('Manage rent payments due.', '管理需要支付的租金')}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <BentoCard>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-zinc-500 dark:text-white/50 text-sm">總支出</p>
                                <p className="text-2xl font-bold text-[var(--color-green-600)] mt-1 tabular-nums">
                                    HKD {totalExpense.toLocaleString()}
                                </p>
                                {(expenseDateStart || expenseDateEnd) && (
                                    <p className="text-xs text-zinc-400 dark:text-white/50 mt-0.5">
                                        {expenseDateStart ? new Date(expenseDateStart).toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '…'} ~ {expenseDateEnd ? new Date(expenseDateEnd).toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '…'}
                                    </p>
                                )}
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--color-green-600)]/10 shrink-0">
                                <svg className="w-6 h-6 text-[var(--color-green-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-zinc-400 dark:text-white/30 shrink-0" />
                            <input
                                type="date"
                                value={expenseDateStart}
                                onChange={(e) => setExpenseDateStart(e.target.value)}
                                max={expenseDateEnd || undefined}
                                className="px-2 py-1 text-xs bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-600 dark:text-white/60 focus:outline-none focus:ring-1 focus:ring-red-500/30 cursor-pointer w-28"
                            />
                            <span className="text-zinc-400 dark:text-white/30 text-xs shrink-0">~</span>
                            <input
                                type="date"
                                value={expenseDateEnd}
                                onChange={(e) => setExpenseDateEnd(e.target.value)}
                                min={expenseDateStart || undefined}
                                className="px-2 py-1 text-xs bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-600 dark:text-white/60 focus:outline-none focus:ring-1 focus:ring-red-500/30 cursor-pointer w-28"
                            />
                            {(expenseDateStart || expenseDateEnd) && (
                                <button
                                    type="button"
                                    onClick={() => { setExpenseDateStart(''); setExpenseDateEnd(''); }}
                                    className="p-1 rounded text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                    title="清除日期篩選"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </BentoCard>
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">{t('Total records', '總筆數')}</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{rents.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/20">
                            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                </BentoCard>
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">已繳付</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{paidCount}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/20">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </BentoCard>
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">未繳付</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{unpaidCount}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/20">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </BentoCard>
            </div>

            {/* Rent List */}
            <div className="space-y-4">
                {rents.length === 0 ? (
                    <div className="glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                        <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-xl font-medium">暫無交租資料。</p>
                    </div>
                ) : (
                    <>
                        <div className="glass-card p-4 flex flex-col sm:flex-row flex-wrap gap-4 sm:items-end">
                            <div className="flex-1 min-w-40">
                                <label className="text-xs font-medium text-zinc-500 dark:text-white/50">業主</label>
                                <select
                                    value={filterOwner}
                                    onChange={e => setFilterOwner(e.target.value)}
                                    className={filterSelectClass}
                                >
                                    <option value="">全部</option>
                                    {ownerFilterOptions.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-40">
                                <label className="text-xs font-medium text-zinc-500 dark:text-white/50">承租人</label>
                                <select
                                    value={filterLessee}
                                    onChange={e => setFilterLessee(e.target.value)}
                                    className={filterSelectClass}
                                >
                                    <option value="">全部</option>
                                    {lesseeFilterOptions.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-40">
                                <label className="text-xs font-medium text-zinc-500 dark:text-white/50">付款方式</label>
                                <select
                                    value={filterPaymentMethod}
                                    onChange={e => setFilterPaymentMethod(e.target.value as RentPaymentMethodFilterValue)}
                                    className={filterSelectClass}
                                >
                                    <option value="">全部</option>
                                    <option value="none">未選擇</option>
                                    <option value="cheque">支票</option>
                                    <option value="fps">FPS轉帳</option>
                                    <option value="cash">現金</option>
                                    <option value="bank_in">入數</option>
                                </select>
                            </div>
                            <div className="flex-1 min-w-40">
                                <label className="text-xs font-medium text-zinc-500 dark:text-white/50">繳付狀態</label>
                                <select
                                    value={filterRentingPayStatus}
                                    onChange={e => setFilterRentingPayStatus(e.target.value as RentingPayStatusFilter)}
                                    className={filterSelectClass}
                                >
                                    <option value="">全部</option>
                                    <option value="paid">已繳付</option>
                                    <option value="unpaid">未繳付</option>
                                </select>
                            </div>
                        </div>

                        {filteredRents.length === 0 ? (
                            <div className="glass-card flex flex-col items-center justify-center py-16 text-zinc-500 dark:text-white/45">
                                <p className="text-lg font-medium">沒有符合篩選條件的記錄</p>
                                <p className="text-sm mt-1">請調整上方篩選條件</p>
                            </div>
                        ) : (
                            <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block glass-card overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-zinc-100 dark:border-white/5">
                                        <th className="p-4 font-medium">物業</th>
                                        <th className="p-4 font-medium">業主</th>
                                        <th className="p-4 font-medium">承租人</th>
                                        <th className="p-4 font-medium">繳付金額</th>
                                        <th className="p-4 font-medium">付款方式</th>
                                        <th className="p-4 font-medium">付款日期</th>
                                        <th className="p-4 font-medium">交租期間</th>
                                        <th className="p-4 font-medium">租務狀態</th>
                                        <th className="p-4 font-medium">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRents.map((rent: any, index) => {
                                        const property = rent.property;
                                        const tenant = rent.tenant;
                                        const proprietor = rent.proprietor;
                                        const landlordDisplay =
                                            (rent.rentCollectionTenantName && String(rent.rentCollectionTenantName).trim()) ||
                                            tenant?.name ||
                                            '—';
                                        const lesseeDisplay = (proprietor?.name && String(proprietor.name).trim()) || '—';
                                        const periodStart = rent.rentCollectionDate || rent.rentingStartDate || rent.startDate;
                                        const periodEnd = rent.endDate || rent.rentingEndDate;
                                        const payDone = hasRentCollectionPaidAmount(rent);
                                        const rowPayStatus = getRentCollectionPayListStatus(rent);
                                        const payMethod = labelRentCollectionPaymentMethod(rent.rentCollectionPaymentMethod);

                                        return (
                                            <motion.tr
                                                key={rent.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                onClick={() => {
                                                    const pid = rent.propertyId || rent.property?.id;
                                                    if (pid || property?.name) {
                                                        setPropertyDetailTarget({
                                                            id: pid || undefined,
                                                            name: property?.name || '物業',
                                                        });
                                                        setShowPropertyModal(true);
                                                    }
                                                }}
                                                className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                            >
                                                <td className="p-4">
                                                    <div className="text-zinc-900 dark:text-white font-medium">{property?.name || '-'}</div>
                                                    <div className="text-xs text-zinc-400 dark:text-white/40 mt-0.5 line-clamp-1">
                                                        {(() => {
                                                            const selected = normalizeRentPropertyLotSelection(rent.rentPropertyLot ?? (rent as any).rent_property_lot);
                                                            const partial = parseRentPropertyLotPartialFromRow(rent.rentPropertyLotPartial ?? (rent as any).rent_property_lot_partial);
                                                            if (!selected.length) return <span className="text-zinc-300 dark:text-white/20">—</span>;
                                                            const lots = selected.map(lot => partial[lot] ? `${lot}（部分地方）` : lot);
                                                            if (lots.length > 1) {
                                                                return <span className="truncate block" title={lots.join('、')}>{lots[0]}...</span>;
                                                            }
                                                            return <span className="truncate block">{lots[0]}</span>;
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70">
                                                    <span className="truncate block max-w-28" title={landlordDisplay}>
                                                        {landlordDisplay}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">
                                                    <span className="truncate block max-w-28" title={lesseeDisplay}>
                                                        {lesseeDisplay}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-zinc-900 dark:text-white font-medium">
                                                    {payDone
                                                        ? `${rent.currency || 'HKD'} ${Number(rent.rentCollectionAmount).toLocaleString()}`
                                                        : '—'}
                                                </td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">
                                                    {payMethod}
                                                </td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70 text-sm tabular-nums">
                                                    {formatDateDMY(rent.rentCollectionPaymentDate) || '—'}
                                                </td>
                                                <td
                                                    className={`p-4 text-sm font-medium ${
                                                        rowPayStatus === 'paid'
                                                            ? 'text-zinc-400 dark:text-white/40'
                                                            : 'text-red-600 dark:text-red-400'
                                                    }`}
                                                >
                                                    {formatDateRangeDMY(periodStart, periodEnd)}
                                                </td>
                                                <td className="p-4">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${rentingPayStatusBadgeClass[rowPayStatus]}`}
                                                    >
                                                        {rentingPayStatusLabel[rowPayStatus]}
                                                    </span>
                                                </td>
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedRent(rent);
                                                                setShowModal(true);
                                                            }}
                                                            className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(e, rent.id)}
                                                            className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
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

                        {/* Mobile Card View */}
                        <div className="flex flex-col gap-3 md:hidden">
                            {pagedRents.map((rent: any, index) => {
                                const property = rent.property;
                                const landlordDisplay =
                                    (rent.rentCollectionTenantName && String(rent.rentCollectionTenantName).trim()) ||
                                    rent.tenant?.name ||
                                    '—';
                                const lesseeDisplay = (rent.proprietor?.name && String(rent.proprietor.name).trim()) || '—';
                                const periodStart = rent.rentingStartDate || rent.startDate;
                                const periodEnd = rent.rentingEndDate || rent.endDate;
                                const payDone = hasRentCollectionPaidAmount(rent);
                                const rowPayStatus = getRentCollectionPayListStatus(rent);
                                const payMethod = labelRentCollectionPaymentMethod(rent.rentCollectionPaymentMethod);

                                return (
                                    <motion.div
                                        key={rent.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => {
                                            const pid = rent.propertyId || property?.id;
                                            if (pid || property?.name) {
                                                setPropertyDetailTarget({ id: pid || undefined, name: property?.name || '物業' });
                                                setShowPropertyModal(true);
                                            }
                                        }}
                                        className="mobile-card px-4 py-3 flex items-center gap-3 relative overflow-hidden cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                                            <Building2 className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="font-semibold text-zinc-900 dark:text-white text-sm truncate">{property?.name || '—'}</span>
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${rentingPayStatusBadgeClass[rowPayStatus]}`}>
                                                    {rentingPayStatusLabel[rowPayStatus]}
                                                </span>
                                            </div>
                                            {(() => {
                                                const selected = normalizeRentPropertyLotSelection(rent.rentPropertyLot ?? (rent as any).rent_property_lot);
                                                const partial = parseRentPropertyLotPartialFromRow(rent.rentPropertyLotPartial ?? (rent as any).rent_property_lot_partial);
                                                if (selected.length) {
                                                    const lots = selected.map(lot => partial[lot] ? `${lot}（部分地方）` : lot);
                                                    const display = lots.length > 1 ? `${lots[0]}...` : lots[0];
                                                    return (
                                                        <p className="text-[10px] text-zinc-400 dark:text-white/40 mb-1 line-clamp-1">
                                                            {display}
                                                        </p>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500 dark:text-white/50">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    <span className="truncate max-w-20" title={landlordDisplay}>{landlordDisplay}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="text-zinc-300 dark:text-white/20">承租</span>
                                                    <span className="truncate max-w-20" title={lesseeDisplay}>{lesseeDisplay}</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-semibold text-zinc-900 dark:text-white text-sm">
                                                {payDone ? `${Number(rent.rentCollectionAmount).toLocaleString()}` : '—'}
                                            </p>
                                            <p className="text-[10px] text-zinc-400 dark:text-white/35">{payMethod}</p>
                                            <p className={`text-[10px] font-medium tabular-nums ${rowPayStatus === 'paid' ? 'text-zinc-400 dark:text-white/40' : 'text-red-500 dark:text-red-400'}`}>
                                                {formatDateRangeDMY(periodStart, periodEnd)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => { setSelectedRent(rent); setShowModal(true); }}
                                                className="p-1.5 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={e => handleDelete(e, rent.id)}
                                                className="p-1.5 rounded-lg text-zinc-400 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        <AdminListPagination
                            listPage={effectiveListPage}
                            totalPages={totalListPages}
                            totalItems={filteredRents.length}
                            onPageChange={setListPage}
                        />
                            </>
                        )}
                    </>
                )}
            </div>

            <AnimatePresence>
                {showModal && (
                    <RentModal
                        rent={selectedRent}
                        onClose={() => {
                            setShowModal(false);
                            setSelectedRent(null);
                        }}
                        onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
                            setShowModal(false);
                            setSelectedRent(null);
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
        </div>
    );
}
