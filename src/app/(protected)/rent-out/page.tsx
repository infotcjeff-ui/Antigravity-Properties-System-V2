'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRentsQuery, usePropertiesQuery, useProprietorsQuery } from '@/hooks/useStorage';
import type { Rent } from '@/lib/db';
import {
    formatDateRangeDMY,
    getRentOutListStatusKey,
    hasRentCollectionPaidAmount,
    isPeriodEndExpired,
    labelRentCollectionPaymentMethod,
    matchesRentPaymentMethodFilter,
    type RentPaymentMethodFilterValue,
    type RentOutStatusFilterValue,
} from '@/lib/rentPaymentDisplay';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentModal from '@/components/properties/RentModal';

const filterSelectClass =
    'mt-1 block w-full min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e] px-3 py-2 text-sm text-zinc-900 dark:text-white';

const contractStatusColors: Record<string, string> = {
    listing: 'bg-purple-500/20 text-purple-400',
    renting: 'bg-green-500/20 text-green-400',
    completed: 'bg-blue-500/20 text-blue-400',
};

export default function RentOutPage() {
    const { data: allRents, isLoading: rentsLoading } = useRentsQuery();
    const { data: qProperties, isLoading: propsLoading } = usePropertiesQuery();
    const { data: qProprietors, isLoading: ownersLoading } = useProprietorsQuery();

    const rents = useMemo(() => (allRents || []).filter(r => r.type === 'rent_out'), [allRents]);
    const contracts = useMemo(() => (allRents || []).filter(r => r.type === 'contract'), [allRents]);
    const properties = useMemo(() => new Map((qProperties || []).map(p => [p.id!, p])), [qProperties]);
    const proprietors = useMemo(() => new Map((qProprietors || []).map(o => [o.id!, o])), [qProprietors]);

    const loading = rentsLoading || propsLoading || ownersLoading;

    const [showRentModal, setShowRentModal] = useState(false);
    const [showContractModal, setShowContractModal] = useState(false);
    const [editingContract, setEditingContract] = useState<Rent | null>(null);
    const [editingRentOut, setEditingRentOut] = useState<Rent | null>(null);
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<RentPaymentMethodFilterValue>('');
    const [filterRentOutStatus, setFilterRentOutStatus] = useState<RentOutStatusFilterValue>('');

    const filteredRents = useMemo(() => {
        return rents.filter(r => {
            if (!matchesRentPaymentMethodFilter(r, filterPaymentMethod)) return false;
            if (filterRentOutStatus && getRentOutListStatusKey(r) !== filterRentOutStatus) return false;
            return true;
        });
    }, [rents, filterPaymentMethod, filterRentOutStatus]);

    const totalIncome = rents
        .filter(r => r.status === 'active' || r.status === 'completed' || r.rentOutStatus === 'renting')
        .reduce((sum, r) => sum + ((r as any).rentCollectionAmount ?? r.rentOutMonthlyRental ?? r.amount ?? 0), 0);

    const totalContractValue = contracts
        .filter(c => c.rentOutStatus === 'renting' || c.rentOutStatus === 'listing')
        .reduce((sum, c) => sum + (c.rentOutTotalAmount || (c.rentOutMonthlyRental || 0) * (c.rentOutPeriods || 0)), 0);

    const handleSuccess = () => {
        // useRentsQuery will auto-refetch
    };

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
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">收租管理</h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">管理物业的租金收入与合约记录</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Contract Button - Amber/Orange */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowContractModal(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl text-white font-medium shadow-lg shadow-amber-500/20 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        新增合約記錄
                    </motion.button>
                    {/* Rent Button - Purple */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowRentModal(true)}
                        className="btn-primary"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        新增交/收租記錄
                    </motion.button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">總收入</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                                HKD {totalIncome.toLocaleString()}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/20">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </BentoCard>
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
                            <p className="text-zinc-500 dark:text-white/50 text-sm">活躍租約</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {rents.filter(r => r.status === 'active').length}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/20">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </BentoCard>
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">待處理</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {rents.filter(r => r.status === 'pending').length}
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
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-white/5">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            收租記錄
                        </h2>
                    </div>
                {rents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-white/40">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-lg">暫無收租記錄</p>
                        <p className="text-sm mt-1">新增您的第一筆收租記錄以開始管理</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 flex flex-col sm:flex-row flex-wrap gap-4 sm:items-end border-b border-zinc-100 dark:border-white/5">
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
                                    value={filterRentOutStatus}
                                    onChange={e => setFilterRentOutStatus(e.target.value as RentOutStatusFilterValue)}
                                    className={filterSelectClass}
                                >
                                    <option value="">全部</option>
                                    <option value="expired">已過期</option>
                                    <option value="renting">出租中</option>
                                    <option value="listing">放租中</option>
                                    <option value="other">其他</option>
                                </select>
                            </div>
                        </div>
                        {filteredRents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 dark:text-white/45">
                                <p className="text-lg font-medium">沒有符合篩選條件的記錄</p>
                                <p className="text-sm mt-1">請調整「付款方式」或「狀態」篩選</p>
                            </div>
                        ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-zinc-100 dark:border-white/5">
                                <th className="p-4 font-medium">物業</th>
                                <th className="p-4 font-medium">租客名稱</th>
                                <th className="p-4 font-medium">繳付金額</th>
                                <th className="p-4 font-medium">收租期間</th>
                                <th className="p-4 font-medium">付款方式</th>
                                <th className="p-4 font-medium">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRents.map((rent, index) => {
                                const property = properties.get(rent.propertyId);
                                const proprietor = rent.proprietorId ? proprietors.get(rent.proprietorId) : null;
                                const tenant = rent.tenantId ? proprietors.get(rent.tenantId) : null;
                                const payStart = rent.rentCollectionDate || rent.startDate;
                                const payEnd = rent.endDate || rent.rentOutEndDate;
                                const periodExpired = isPeriodEndExpired(payEnd);
                                const payFilled = hasRentCollectionPaidAmount(rent);
                                const tenantDisplay = (rent as any).rentCollectionTenantName || tenant?.name || proprietor?.name || '-';
                                const payLabel = labelRentCollectionPaymentMethod(rent.rentCollectionPaymentMethod);

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
                                        <td className="p-4 text-green-600 dark:text-green-400 font-medium">
                                            {payFilled ? (
                                                <>+ {rent.currency || 'HKD'} {Number(rent.rentCollectionAmount).toLocaleString()}</>
                                            ) : (
                                                <span className="text-zinc-400 dark:text-white/40">—</span>
                                            )}
                                        </td>
                                        <td
                                            className={`p-4 text-sm font-medium ${
                                                periodExpired
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-zinc-500 dark:text-white/50'
                                            }`}
                                        >
                                            {formatDateRangeDMY(payStart, payEnd)}
                                        </td>
                                        <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">{payLabel}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingRentOut(rent)}
                                                    className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                                    title="編輯"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                        )}
                    </>
                )}
                </div>
            </div>

            {/* Contract Records Section */}
            <div className="glass-card overflow-hidden border-amber-200 dark:border-amber-500/30">
                <div className="p-4 border-b border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        合約記錄
                    </h2>
                </div>
                {contracts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-white/40">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg">暫無合約記錄</p>
                        <p className="text-sm mt-1">點擊上方「新增合約記錄」按鈕以開始管理</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-amber-200 dark:border-amber-500/20">
                                <th className="p-4 font-medium">物業</th>
                                <th className="p-4 font-medium">出租合約號碼</th>
                                <th className="p-4 font-medium">出租人</th>
                                <th className="p-4 font-medium">月租</th>
                                <th className="p-4 font-medium">租約期間</th>
                                <th className="p-4 font-medium">狀態</th>
                                <th className="p-4 font-medium">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contracts.map((contract, index) => {
                                const property = properties.get(contract.propertyId);
                                const startDate = contract.rentOutStartDate;
                                const endDate = contract.rentOutEndDate;
                                const monthlyRent = contract.rentOutMonthlyRental || 0;
                                const status = contract.rentOutStatus || 'listing';

                                return (
                                    <motion.tr
                                        key={contract.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="border-b border-amber-200/50 dark:border-amber-500/10 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors"
                                    >
                                        <td className="p-4 text-zinc-900 dark:text-white font-medium">{property?.name || '-'}</td>
                                        <td className="p-4">
                                            <span className="text-amber-600 dark:text-amber-400 font-medium">{contract.rentOutTenancyNumber || '-'}</span>
                                        </td>
                                        <td className="p-4 text-zinc-600 dark:text-white/70">{contract.rentOutLessor || '-'}</td>
                                        <td className="p-4 text-amber-600 dark:text-amber-400 font-medium">
                                            {contract.currency || 'HKD'} {monthlyRent.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-zinc-500 dark:text-white/50 text-sm">
                                            {startDate ? new Date(startDate).toLocaleDateString() : '-'} - {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${contractStatusColors[status] || contractStatusColors.listing}`}>
                                                {status === 'renting' ? '出租中' : status === 'listing' ? '放盤中' : status === 'completed' ? '已完租' : '放盤中'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingContract(contract)}
                                                    className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                                    title="編輯"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showRentModal && (
                    <RentModal
                        allowedTypes={['rent_out', 'renting']}
                        onClose={() => setShowRentModal(false)}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {showContractModal && (
                    <RentModal
                        defaultType="contract"
                        allowedTypes={['contract']}
                        onClose={() => setShowContractModal(false)}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {editingContract && (
                    <RentModal
                        defaultType="contract"
                        allowedTypes={['contract']}
                        rent={editingContract}
                        propertyId={editingContract.propertyId}
                        defaultLocation={editingContract.rentOutAddressDetail}
                        onClose={() => setEditingContract(null)}
                        onSuccess={() => {
                            setEditingContract(null);
                            handleSuccess();
                        }}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {editingRentOut && (
                    <RentModal
                        defaultType="rent_out"
                        allowedTypes={['rent_out']}
                        rent={editingRentOut}
                        propertyId={editingRentOut.propertyId}
                        onClose={() => setEditingRentOut(null)}
                        onSuccess={() => {
                            setEditingRentOut(null);
                            handleSuccess();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
