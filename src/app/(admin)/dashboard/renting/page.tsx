'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRentsWithRelationsQuery, useRents } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, DollarSign, User, Building2, Pencil, Trash2, ChevronRight, LayoutList } from 'lucide-react';
import type { Rent } from '@/lib/db';
import {
    formatDateDMY,
    formatDateRangeDMY,
    getRentCollectionPayListStatus,
    hasRentCollectionPaidAmount,
    isPeriodEndExpired,
    labelRentCollectionPaymentMethod,
    matchesRentPaymentMethodFilter,
    type RentCollectionPayListStatus,
    type RentPaymentMethodFilterValue,
} from '@/lib/rentPaymentDisplay';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentModal from '@/components/properties/RentModal';
import PropertyDetailModal from '@/components/properties/PropertyDetailModal';

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
    const { data: rents = [], isLoading } = useRentsWithRelationsQuery({ type: 'renting' });
    const [showModal, setShowModal] = useState(false);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);
    const [propertyDetailTarget, setPropertyDetailTarget] = useState<{ id?: string; name: string } | null>(null);
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<RentPaymentMethodFilterValue>('');
    const [filterRentingPayStatus, setFilterRentingPayStatus] = useState<RentingPayStatusFilter>('');
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

    const filteredRents = useMemo(() => {
        return rents.filter(r => {
            if (!matchesRentPaymentMethodFilter(r, filterPaymentMethod)) return false;
            if (filterRentingPayStatus && getRentCollectionPayListStatus(r) !== filterRentingPayStatus) return false;
            return true;
        });
    }, [rents, filterPaymentMethod, filterRentingPayStatus]);

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
                        <LayoutList className="w-6 h-6 text-purple-500 md:hidden" />
                        交租管理
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">管理需要支付的租金</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">Total Records</p>
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
                            <p className="text-zinc-500 dark:text-white/50 text-sm">已繳付（金額＋付款方式）</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {rents.filter(r => getRentCollectionPayListStatus(r) === 'paid').length}
                            </p>
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
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {rents.filter(r => getRentCollectionPayListStatus(r) === 'unpaid').length}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-500/20">
                            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                            <div className="flex-1 min-w-[160px]">
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
                            <div className="flex-1 min-w-[160px]">
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
                                <p className="text-sm mt-1">請調整「付款方式」或「狀態」篩選</p>
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
                                    {filteredRents.map((rent: any, index) => {
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
                                        const isExpiredRow = isPeriodEndExpired(periodEnd);
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
                                                <td className="p-4 text-zinc-900 dark:text-white font-medium">{property?.name || '-'}</td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70">{landlordDisplay}</td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">{lesseeDisplay}</td>
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
                                                        isExpiredRow
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-zinc-500 dark:text-white/50'
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
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {filteredRents.map((rent: any, index) => {
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
                                const isExpiredRow = isPeriodEndExpired(periodEnd);
                                const payMethod = labelRentCollectionPaymentMethod(rent.rentCollectionPaymentMethod);

                                return (
                                    <motion.div
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
                                        className="mobile-card p-4 space-y-4 relative overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-zinc-900 dark:text-white">{property?.name || 'Unknown Property'}</h3>
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                                            <p className="text-xs text-zinc-500 dark:text-white/50">
                                                                <span className="text-zinc-400 dark:text-white/35 mr-1">業主</span>
                                                                {landlordDisplay}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 pl-4">
                                                            <p className="text-xs text-zinc-500 dark:text-white/50">
                                                                <span className="text-zinc-400 dark:text-white/35 mr-1">承租人</span>
                                                                {lesseeDisplay}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${rentingPayStatusBadgeClass[rowPayStatus]}`}
                                            >
                                                {rentingPayStatusLabel[rowPayStatus]}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 py-3 border-y border-zinc-100 dark:border-white/5">
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <DollarSign className="w-3 h-3 text-emerald-500" />
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">繳付金額</p>
                                                </div>
                                                <p className="font-bold text-zinc-900 dark:text-white">
                                                    {payDone
                                                        ? `${rent.currency || 'HKD'} ${Number(rent.rentCollectionAmount).toLocaleString()}`
                                                        : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Calendar className="w-3 h-3 text-blue-500" />
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">付款方式</p>
                                                </div>
                                                <p className="font-bold text-zinc-900 dark:text-white text-sm">
                                                    {payMethod}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Calendar className="w-3 h-3 text-blue-500" />
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">付款日期</p>
                                                </div>
                                                <p className="font-bold text-zinc-900 dark:text-white text-sm tabular-nums">
                                                    {formatDateDMY(rent.rentCollectionPaymentDate) || '—'}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Calendar className="w-3 h-3 text-blue-500" />
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">交租期間</p>
                                                </div>
                                                <p
                                                    className={`font-bold text-sm ${
                                                        isExpiredRow
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-zinc-900 dark:text-white'
                                                    }`}
                                                >
                                                    {formatDateRangeDMY(periodStart, periodEnd)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end pt-1">
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => {
                                                        setSelectedRent(rent);
                                                        setShowModal(true);
                                                    }}
                                                    className="p-2 rounded-lg bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-white/50"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, rent.id)}
                                                    className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
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
