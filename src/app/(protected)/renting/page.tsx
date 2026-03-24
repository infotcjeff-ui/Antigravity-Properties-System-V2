'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRentsQuery, usePropertiesQuery, useProprietorsQuery } from '@/hooks/useStorage';
import {
    formatDateRangeDMY,
    getRentingListStatus,
    hasRentCollectionPaidAmount,
    labelRentCollectionPaymentMethod,
    matchesRentPaymentMethodFilter,
    type RentPaymentMethodFilterValue,
} from '@/lib/rentPaymentDisplay';
import { BentoCard } from '@/components/layout/BentoGrid';
import { useAuth } from '@/contexts/AuthContext';

type RentingStatusFilter = '' | 'expired' | 'completed' | 'processing';

const rentingStatusBadgeClass: Record<Exclude<RentingStatusFilter, ''>, string> = {
    expired:
        'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30',
    completed:
        'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30',
    processing:
        'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25',
};

const rentingStatusLabel: Record<Exclude<RentingStatusFilter, ''>, string> = {
    expired: '已過期',
    completed: '已完成',
    processing: '處理中',
};

const filterSelectClass =
    'mt-1 block w-full min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e] px-3 py-2 text-sm text-zinc-900 dark:text-white';

export default function RentingPage() {
    const { data: allRents, isLoading: rentsLoading } = useRentsQuery();
    const { data: qProperties, isLoading: propsLoading } = usePropertiesQuery();
    const { data: qProprietors, isLoading: ownersLoading } = useProprietorsQuery();
    const { isAuthenticated } = useAuth();
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<RentPaymentMethodFilterValue>('');
    const [filterRentingStatus, setFilterRentingStatus] = useState<RentingStatusFilter>('');

    const rents = useMemo(() => (allRents || []).filter(r => r.type === 'renting'), [allRents]);
    const properties = useMemo(() => new Map((qProperties || []).map(p => [p.id!, p])), [qProperties]);
    const proprietors = useMemo(() => new Map((qProprietors || []).map(o => [o.id!, o])), [qProprietors]);

    const loading = rentsLoading || propsLoading || ownersLoading;

    const filteredRents = useMemo(() => {
        return rents.filter(r => {
            if (!matchesRentPaymentMethodFilter(r, filterPaymentMethod)) return false;
            if (filterRentingStatus && getRentingListStatus(r) !== filterRentingStatus) return false;
            return true;
        });
    }, [rents, filterPaymentMethod, filterRentingStatus]);

    if (loading) {
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
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">交租管理</h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">管理您需要支付的租金支出與記錄</p>
                </div>
                {isAuthenticated && (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-shadow flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        新增交租記錄
                    </motion.button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">記錄總數</p>
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
                            <p className="text-zinc-500 dark:text-white/50 text-sm">已完成（已填繳付金額）</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {rents.filter(r => getRentingListStatus(r) === 'completed').length}
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
                            <p className="text-zinc-500 dark:text-white/50 text-sm">處理中（未過期且繳付空白）</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {rents.filter(r => getRentingListStatus(r) === 'processing').length}
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
                    <div className="glass-card overflow-hidden flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-white/40">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-lg">暫無交租記錄</p>
                        <p className="text-sm mt-1">新增您的第一筆交租記錄以開始管理</p>
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
                                </select>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                                <label className="text-xs font-medium text-zinc-500 dark:text-white/50">狀態</label>
                                <select
                                    value={filterRentingStatus}
                                    onChange={e => setFilterRentingStatus(e.target.value as RentingStatusFilter)}
                                    className={filterSelectClass}
                                >
                                    <option value="">全部</option>
                                    <option value="processing">處理中</option>
                                    <option value="completed">已完成</option>
                                    <option value="expired">已過期</option>
                                </select>
                            </div>
                        </div>

                        {filteredRents.length === 0 ? (
                            <div className="glass-card flex flex-col items-center justify-center py-16 text-zinc-500 dark:text-white/45">
                                <p className="text-lg font-medium">沒有符合篩選條件的記錄</p>
                                <p className="text-sm mt-1">請調整「付款方式」或「狀態」篩選</p>
                            </div>
                        ) : (
                    <div className="glass-card overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-zinc-100 dark:border-white/5">
                                <th className="p-4 font-medium">物業</th>
                                <th className="p-4 font-medium">租客</th>
                                <th className="p-4 font-medium">繳付金額</th>
                                <th className="p-4 font-medium">付款方式</th>
                                <th className="p-4 font-medium">交租期間</th>
                                <th className="p-4 font-medium">租務狀態</th>
                                <th className="p-4 font-medium">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRents.map((rent, index) => {
                                const property = properties.get(rent.propertyId);
                                const proprietor = rent.proprietorId ? proprietors.get(rent.proprietorId) : null;
                                const tenant = rent.tenantId ? proprietors.get(rent.tenantId) : null;

                                const periodStart = rent.rentCollectionDate || rent.rentingStartDate || rent.startDate;
                                const periodEnd = rent.endDate || rent.rentingEndDate;
                                const payDone = hasRentCollectionPaidAmount(rent);
                                const rowStatus = getRentingListStatus(rent);
                                const isExpiredRow = rowStatus === 'expired';
                                const payMethod = labelRentCollectionPaymentMethod(rent.rentCollectionPaymentMethod);

                                return (
                                    <motion.tr
                                        key={rent.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <td className="p-4 text-zinc-900 dark:text-white font-medium">{property?.name || '-'}</td>
                                        <td className="p-4 text-zinc-600 dark:text-white/70">{tenantDisplay}</td>
                                        <td className="p-4 text-zinc-900 dark:text-white font-medium">
                                            {payDone
                                                ? `${rent.currency || 'HKD'} ${Number(rent.rentCollectionAmount).toLocaleString()}`
                                                : '—'}
                                        </td>
                                        <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">
                                            {payMethod}
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
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium ${rentingStatusBadgeClass[rowStatus]}`}
                                            >
                                                {rentingStatusLabel[rowStatus]}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {isAuthenticated && (
                                                <div className="flex items-center gap-2">
                                                    <button className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
