'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRentsWithRelationsQuery, useRents } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, DollarSign, User, Building2, Pencil, Trash2, ChevronRight, LayoutList, TrendingUp } from 'lucide-react';
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
import PropertyDetailModal from '@/components/properties/PropertyDetailModal';

const filterSelectClass =
    'mt-1 block w-full min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e] px-3 py-2 text-sm text-zinc-900 dark:text-white';

export default function RentOutPage() {
    const queryClient = useQueryClient();
    const { data: rents = [], isLoading } = useRentsWithRelationsQuery({ type: 'rent_out' });

    const [showModal, setShowModal] = useState(false);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);
    const [propertyDetailTarget, setPropertyDetailTarget] = useState<{ id?: string; name: string } | null>(null);
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<RentPaymentMethodFilterValue>('');
    const [filterRentOutStatus, setFilterRentOutStatus] = useState<RentOutStatusFilterValue>('');
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

    // Calculate total income - use (monthly rental * periods)
    const totalIncome = rents
        .filter(r => r.status === 'active' || r.status === 'completed' || r.rentOutStatus === 'renting')
        .reduce((sum, r) => sum + ((r.rentOutMonthlyRental || r.amount || 0) * (r.rentOutPeriods || 1)), 0);

    const filteredRents = useMemo(() => {
        return rents.filter(r => {
            if (!matchesRentPaymentMethodFilter(r, filterPaymentMethod)) return false;
            if (filterRentOutStatus && getRentOutListStatusKey(r) !== filterRentOutStatus) return false;
            return true;
        });
    }, [rents, filterPaymentMethod, filterRentOutStatus]);

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
                        <TrendingUp className="w-6 h-6 text-emerald-500 md:hidden" />
                        收租管理
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">管理物業的租金收入與記錄</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">Total Income</p>
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
                            <p className="text-zinc-500 dark:text-white/50 text-sm">Active Leases</p>
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
                            <p className="text-zinc-500 dark:text-white/50 text-sm">Pending</p>
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
                {rents.length === 0 ? (
                    <div className="glass-card flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                        <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xl font-medium">暫無收租資料。</p>
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
                                        <th className="p-4 font-medium">租客</th>
                                        <th className="p-4 font-medium">繳付金額</th>
                                        <th className="p-4 font-medium">付款方式</th>
                                        <th className="p-4 font-medium">租約期間</th>
                                        <th className="p-4 font-medium">租務狀態</th>
                                        <th className="p-4 font-medium">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRents.map((rent: any, index) => {
                                        const property = rent.property;
                                        const proprietor = rent.proprietor;
                                        const tenant = rent.tenant;
                                        const startDate = rent.rentCollectionDate || rent.rentOutStartDate || rent.startDate;
                                        const endDate = rent.endDate || rent.rentOutEndDate;
                                        const status = rent.rentOutStatus || rent.status || 'active';
                                        const isExpired = isPeriodEndExpired(endDate);
                                        const payFilled = hasRentCollectionPaidAmount(rent);
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
                                                <td className="p-4 text-zinc-600 dark:text-white/70">{tenant?.name || proprietor?.name || '-'}</td>
                                                <td className="p-4 text-green-600 dark:text-green-400 font-medium">
                                                    {payFilled ? (
                                                        <>+ {rent.currency || 'HKD'} {Number(rent.rentCollectionAmount).toLocaleString()}</>
                                                    ) : (
                                                        <span className="text-zinc-400 dark:text-white/40">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">
                                                    {payMethod}
                                                </td>
                                                <td className={`p-4 text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-zinc-500 dark:text-white/50'}`}>
                                                    {formatDateRangeDMY(startDate, endDate)}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isExpired
                                                        ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                                                        : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                                                        }`}>
                                                        {isExpired ? '已過期' : status === 'renting' ? '出租中' : status === 'listing' ? '放租中' : status}
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
                                const proprietor = rent.proprietor;
                                const tenant = rent.tenant;
                                const startDate = rent.rentCollectionDate || rent.rentOutStartDate || rent.startDate;
                                const endDate = rent.endDate || rent.rentOutEndDate;
                                const status = rent.rentOutStatus || rent.status || 'active';
                                const isExpired = isPeriodEndExpired(endDate);
                                const payFilled = hasRentCollectionPaidAmount(rent);
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
                                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-zinc-900 dark:text-white">{property?.name || 'Unknown Property'}</h3>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <User className="w-3 h-3 text-zinc-400" />
                                                        <p className="text-xs text-zinc-500 dark:text-white/50">{tenant?.name || proprietor?.name || '-'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${
                                                    isExpired
                                                        ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30'
                                                        : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/30'
                                                }`}
                                            >
                                                {isExpired ? '已過期' : status === 'renting' ? '出租中' : '放租中'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 py-3 border-y border-zinc-100 dark:border-white/5">
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <DollarSign className="w-3 h-3 text-emerald-500" />
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">繳付金額</p>
                                                </div>
                                                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    {payFilled ? (
                                                        <>+ {rent.currency || 'HKD'} {Number(rent.rentCollectionAmount).toLocaleString()}</>
                                                    ) : (
                                                        <span className="text-zinc-400 dark:text-white/40">—</span>
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Calendar className="w-3 h-3 text-blue-500" />
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">付款方式</p>
                                                </div>
                                                <p className="font-bold text-sm text-zinc-900 dark:text-white">
                                                    {payMethod}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Calendar className="w-3 h-3 text-blue-500" />
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">租約期間</p>
                                                </div>
                                                <p className={`font-bold text-sm ${isExpired ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                                                    {formatDateRangeDMY(startDate, endDate)}
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
