'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRelations, usePropertiesWithRelationsQuery, type PropertyWithRelations } from '@/hooks/useStorage';

export default function RelationsPage() {
    const { data: qRelations, isLoading } = usePropertiesWithRelationsQuery();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const data = useMemo(() => {
        if (!qRelations) return [];
        return [...qRelations].sort((a, b) => a.code.localeCompare(b.code));
    }, [qRelations]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const statusColors: Record<string, string> = {
        holding: 'bg-emerald-600/80 text-white border-emerald-500/50',
        renting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        sold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const typeLabels: Record<string, string> = {
        group_asset: '集團資產',
        co_investment: '合作投資',
        external_lease: '外租物業',
        managed_asset: '代管資產',
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

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">資料總覽</h1>
                <p className="text-zinc-500 dark:text-white/50 mt-1">查看物業、擁有方及租金記錄的完整關聯樹狀圖</p>
            </div>

            {/* Relation Tree */}
            <div className="space-y-4">
                {data.length === 0 ? (
                    <div className="glass-card flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-white/40">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <p className="text-lg">暫無數據可顯示</p>
                        <p className="text-sm mt-1">新增物業以查看關聯樹狀圖</p>
                    </div>
                ) : (
                    data.map((property: PropertyWithRelations, index: number) => (
                        <motion.div
                            key={property.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="glass-card overflow-hidden"
                        >
                            {/* Property Row */}
                            <div
                                onClick={() => toggleExpand(property.id!)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <motion.div
                                        animate={{ rotate: expandedIds.has(property.id!) ? 90 : 0 }}
                                        className="text-zinc-400 dark:text-white/50"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </motion.div>

                                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/20">
                                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>

                                    <div>
                                        <h3 className="text-zinc-900 dark:text-white font-semibold flex items-center gap-2">
                                            {property.name}
                                            <span className="text-zinc-400 dark:text-white/40 text-sm font-normal">({property.code})</span>
                                        </h3>
                                        <p className="text-zinc-500 dark:text-white/50 text-sm">{typeLabels[property.type]}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[property.status]}`}>
                                        {property.status === 'holding' ? '持有中' : property.status === 'renting' ? '出租中' : property.status === 'sold' ? '已售出' : '已暫停'}
                                    </span>
                                    <div className="flex items-center gap-1 text-zinc-400 dark:text-white/40 text-sm">
                                        {property.proprietor && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 dark:bg-white/5 rounded" title="業主">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                業主
                                            </span>
                                        )}
                                        {property.tenant && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 dark:bg-white/5 rounded" title="承租人">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                租客
                                            </span>
                                        )}
                                        {property.rents.length > 0 && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 dark:bg-white/5 rounded">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                {property.rents.length}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedIds.has(property.id!) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-zinc-100 dark:border-white/5"
                                >
                                    <div className="p-4 pl-16 space-y-4">
                                        {/* Property Details */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-zinc-400 dark:text-white/40">地址</p>
                                                <p className="text-zinc-700 dark:text-white/80">{property.address || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-400 dark:text-white/40">地段面積</p>
                                                <p className="text-zinc-700 dark:text-white/80">{property.lotArea || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-400 dark:text-white/40">土地用途</p>
                                                <p className="text-zinc-700 dark:text-white/80 capitalize">{
                                                    property.landUse === 'open_storage' ? '露天倉儲' :
                                                        property.landUse === 'residential_a' ? '住宅(甲)' :
                                                            property.landUse === 'residential_c' ? '住宅(丙類)' :
                                                                property.landUse === 'open_space' ? '開放空間' :
                                                                    property.landUse === 'recreation_use' ? '休憩用地' :
                                                                        property.landUse === 'village_dev' ? '鄉村式發展' :
                                                                            property.landUse === 'conservation_area' ? '保育區' :
                                                                                property.landUse === 'unknown' ? '未知' : '-'
                                                }</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-400 dark:text-white/40">規劃許可</p>
                                                <p className="text-zinc-700 dark:text-white/80">{property.hasPlanningPermission || '-'}</p>
                                            </div>
                                        </div>

                                        {/* Parties (Proprietor & Tenant) */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-4">
                                            {property.proprietor && (
                                                <div className="pl-4 border-l-2 border-orange-500/30">
                                                    <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl h-full">
                                                        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20">
                                                            <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-orange-600 dark:text-orange-400/70 uppercase">業主 / 資產擁有方</p>
                                                            <p className="text-zinc-900 dark:text-white font-medium">{property.proprietor.name}</p>
                                                            <div className="flex items-center gap-3 text-zinc-500 dark:text-white/50 text-xs mt-1">
                                                                <span>{property.proprietor.code}</span>
                                                                {property.proprietor.englishName && <span className="truncate max-w-[150px]">• {property.proprietor.englishName}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {property.tenant && (
                                                <div className="pl-4 border-l-2 border-blue-500/30">
                                                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl h-full">
                                                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                                                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-blue-600 dark:text-blue-400/70 uppercase">承租人 / 租客</p>
                                                            <p className="text-zinc-900 dark:text-white font-medium">{property.tenant.name}</p>
                                                            <div className="flex items-center gap-3 text-zinc-500 dark:text-white/50 text-xs mt-1">
                                                                <span>{property.tenant.code}</span>
                                                                {property.tenant.englishName && <span className="truncate max-w-[150px]">• {property.tenant.englishName}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Rents */}
                                        {property.rents.length > 0 && (
                                            <div className="ml-4 pl-4 border-l-2 border-green-500/30 space-y-2">
                                                <p className="text-xs text-green-600 dark:text-green-400/70 uppercase">租金記錄</p>
                                                {property.rents.map((rent: any) => {
                                                    const startDate = rent.type === 'rent_out'
                                                        ? (rent.rentOutStartDate || rent.startDate)
                                                        : (rent.rentingStartDate || rent.startDate);
                                                    const endDate = rent.type === 'rent_out'
                                                        ? (rent.rentOutEndDate || rent.endDate)
                                                        : (rent.rentingEndDate || rent.endDate);

                                                    const isExpired = endDate ? new Date(endDate) < new Date() : false;

                                                    return (
                                                        <div key={rent.id} className={`flex items-center justify-between p-3 rounded-xl transition-colors ${isExpired
                                                            ? 'bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20'
                                                            : 'bg-green-50 dark:bg-green-500/10'
                                                            }`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/20">
                                                                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <p className="text-zinc-900 dark:text-white font-medium">
                                                                        {rent.currency || 'HKD'} {((rent.type === 'rent_out' ? (rent.rentOutMonthlyRental || rent.amount) : (rent.rentingMonthlyRental || rent.amount)) || 0).toLocaleString()} /月
                                                                        <span className="text-zinc-400 dark:text-white/40 text-sm ml-2">/ {rent.type === 'renting' ? '交租' : '收租'}</span>
                                                                    </p>
                                                                    <p className="text-zinc-500 dark:text-white/50 text-sm">
                                                                        {startDate ? new Date(startDate).toLocaleDateString() : '-'} - {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${isExpired
                                                                ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                                                : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                                                                }`}>
                                                                {isExpired ? '已過期' : '租賃中'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
