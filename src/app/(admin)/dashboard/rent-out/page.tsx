'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRentsWithRelationsQuery, useRents } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import type { Rent } from '@/lib/db';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentModal from '@/components/properties/RentModal';
import PropertyDetailModal from '@/components/properties/PropertyDetailModal';

export default function RentOutPage() {
    const queryClient = useQueryClient();
    const { data: rents = [], isLoading } = useRentsWithRelationsQuery({ type: 'rent_out' });

    const [showModal, setShowModal] = useState(false);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
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
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">收租管理</h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">管理物業的租金收入與記錄</p>
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
            <div className="glass-card overflow-hidden">
                {rents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-white/40">
                        <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xl font-medium">暫無收租資料。</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-zinc-100 dark:border-white/5">
                                <th className="p-4 font-medium">物業</th>
                                <th className="p-4 font-medium">租客</th>
                                <th className="p-4 font-medium">金額</th>
                                <th className="p-4 font-medium">租約期間</th>
                                <th className="p-4 font-medium">租務狀態</th>
                                <th className="p-4 font-medium">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rents.map((rent: any, index) => {
                                const property = rent.property;
                                const proprietor = rent.proprietor;
                                const tenant = rent.tenant;

                                // Handle both new and legacy rent data formats
                                const startDate = rent.rentOutStartDate || rent.startDate;
                                const endDate = rent.rentOutEndDate || rent.endDate;
                                const monthlyRent = rent.rentOutMonthlyRental || rent.amount || 0;
                                const status = rent.rentOutStatus || rent.status || 'active';

                                return (
                                    <motion.tr
                                        key={rent.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => {
                                            if (property?.name) {
                                                setSelectedProperty(property.name);
                                                setShowPropertyModal(true);
                                            }
                                        }}
                                        className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4 text-zinc-900 dark:text-white font-medium">{property?.name || '-'}</td>
                                        <td className="p-4 text-zinc-600 dark:text-white/70">{tenant?.name || proprietor?.name || '-'}</td>
                                        <td className="p-4 text-green-600 dark:text-green-400 font-medium">
                                            + {rent.currency || 'HKD'} {((rent.rentOutMonthlyRental || 0) * (rent.rentOutPeriods || 1)).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-zinc-500 dark:text-white/50 text-sm">
                                            {startDate ? new Date(startDate).toLocaleDateString() : '-'} - {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-4">
                                            {(() => {
                                                const isExpired = endDate ? new Date(endDate).getTime() < new Date().getTime() : false;
                                                return (
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isExpired
                                                        ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                                                        : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                                                        }`}>
                                                        {isExpired ? '已過期' : status === 'renting' ? '出租中' : status === 'listing' ? '放租中' : status}
                                                    </span>
                                                );
                                            })()}
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
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, rent.id)}
                                                    className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                {showPropertyModal && selectedProperty && (
                    <PropertyDetailModal
                        propertyName={selectedProperty}
                        onClose={() => {
                            setShowPropertyModal(false);
                            setSelectedProperty(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
