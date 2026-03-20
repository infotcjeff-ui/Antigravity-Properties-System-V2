'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Trash2, Building2 } from 'lucide-react';
import { useRentsWithRelationsQuery, useRents } from '@/hooks/useStorage';
import type { Rent } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentModal from '@/components/properties/RentModal';
import PropertyDetailModal from '@/components/properties/PropertyDetailModal';

export default function ContractsPage() {
    const queryClient = useQueryClient();
    const { data: contracts = [], isLoading } = useRentsWithRelationsQuery({ type: 'contract' });
    const { deleteRent } = useRents();

    const [showModal, setShowModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Rent | null>(null);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [selectedPropertyName, setSelectedPropertyName] = useState<string | null>(null);

    const statusColors: Record<string, string> = {
        active: 'bg-green-500/20 text-green-400',
        pending: 'bg-yellow-500/20 text-yellow-400',
        completed: 'bg-blue-500/20 text-blue-400',
        cancelled: 'bg-red-500/20 text-red-400',
        listing: 'bg-purple-500/20 text-purple-400',
        renting: 'bg-green-500/20 text-green-400',
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm('確定要刪除此合約記錄嗎？')) return;
        const ok = await deleteRent(id);
        if (ok) {
            queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
            queryClient.invalidateQueries({ queryKey: ['rents'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl text-white font-medium shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                    <FileText className="w-5 h-5" />
                    新增合約記錄
                </motion.button>
            </div>

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
                <BentoCard>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 dark:text-white/50 text-sm">放盤中</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                                {contracts.filter((c: any) => (c.rentOutStatus || c.status) === 'listing').length}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/20">
                            <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                    </div>
                </BentoCard>
            </div>

            <div className="glass-card overflow-hidden border-amber-200 dark:border-amber-500/30">
                <div className="p-4 border-b border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">合約記錄列表</h2>
                </div>
                {contracts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400 dark:text-white/40">
                        <FileText className="w-16 h-16 mb-4 opacity-40" />
                        <p className="text-lg">暫無合約記錄</p>
                        <p className="text-sm mt-1">點擊「新增合約記錄」開始建立</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-[720px]">
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
                                    {(contracts as any[]).map((contract, index) => {
                                        const property = contract.property;
                                        const startDate = contract.rentOutStartDate;
                                        const endDate = contract.rentOutEndDate;
                                        const monthlyRent = contract.rentOutMonthlyRental || 0;
                                        const status = contract.rentOutStatus || 'listing';

                                        return (
                                            <motion.tr
                                                key={contract.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.04 }}
                                                onClick={() => {
                                                    if (property?.name) {
                                                        setSelectedPropertyName(property.name);
                                                        setShowPropertyModal(true);
                                                    }
                                                }}
                                                className="border-b border-amber-200/50 dark:border-amber-500/10 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors cursor-pointer"
                                            >
                                                <td className="p-4 text-zinc-900 dark:text-white font-medium">
                                                    {property?.name || '-'}
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                        {contract.rentOutTenancyNumber || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-zinc-600 dark:text-white/70">{contract.rentOutLessor || '-'}</td>
                                                <td className="p-4 text-amber-600 dark:text-amber-400 font-medium">
                                                    {contract.currency || 'HKD'} {monthlyRent.toLocaleString()}
                                                </td>
                                                <td className="p-4 text-zinc-500 dark:text-white/50 text-sm">
                                                    {startDate ? new Date(startDate).toLocaleDateString() : '-'} —{' '}
                                                    {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="p-4">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.listing}`}
                                                    >
                                                        {status === 'renting'
                                                            ? '出租中'
                                                            : status === 'listing'
                                                              ? '放盤中'
                                                              : status === 'completed'
                                                                ? '已完租'
                                                                : '放盤中'}
                                                    </span>
                                                </td>
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
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
                                                            onClick={(e) => handleDelete(e, contract.id)}
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
                            {(contracts as any[]).map((contract, index) => {
                                const property = contract.property;
                                const startDate = contract.rentOutStartDate;
                                const endDate = contract.rentOutEndDate;
                                const monthlyRent = contract.rentOutMonthlyRental || 0;
                                const status = contract.rentOutStatus || 'listing';

                                return (
                                    <motion.div
                                        key={contract.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        onClick={() => {
                                            if (property?.name) {
                                                setSelectedPropertyName(property.name);
                                                setShowPropertyModal(true);
                                            }
                                        }}
                                        className="mobile-card p-4 space-y-3 border border-amber-200/50 dark:border-amber-500/20"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-bold text-zinc-900 dark:text-white">{property?.name || '-'}</h3>
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                                    {contract.rentOutTenancyNumber || '—'}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusColors[status] || statusColors.listing}`}
                                            >
                                                {status === 'renting' ? '出租中' : status === 'listing' ? '放盤中' : '其他'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-600 dark:text-white/70">出租人：{contract.rentOutLessor || '-'}</p>
                                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                            {contract.currency || 'HKD'} {monthlyRent.toLocaleString()} / 月
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-white/50">
                                            {startDate ? new Date(startDate).toLocaleDateString() : '-'} —{' '}
                                            {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                        </p>
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
                                                onClick={(e) => handleDelete(e, contract.id)}
                                                className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <AnimatePresence>
                {showModal && (
                    <RentModal
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
                {showPropertyModal && selectedPropertyName && (
                    <PropertyDetailModal
                        propertyName={selectedPropertyName}
                        onClose={() => {
                            setShowPropertyModal(false);
                            setSelectedPropertyName(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
