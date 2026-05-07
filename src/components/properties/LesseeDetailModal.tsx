'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Building2, ChevronRight, ChevronUp, ChevronLeft, MapPin, FileText, Calendar, Hash } from 'lucide-react';
import type { Proprietor, Property } from '@/lib/db';
import { useRentsWithRelationsQuery } from '@/hooks/useStorage';
import { proprietorCategoryLabelZh } from '@/lib/formatters';

type LesseeDetailTab = 'contracts' | 'basic';

const LESSEE_TAB_ORDER: LesseeDetailTab[] = ['contracts', 'basic'];

const LESSEE_TAB_LABEL: Record<LesseeDetailTab, string> = {
    contracts: '關聯合約',
    basic: '基本資料',
};

interface LesseeDetailModalProps {
    lessee: Proprietor;
    onClose: () => void;
    /** 從 TenantsPage 打開時可編輯 */
    onEdit?: () => void;
}

function formatDate(date: any): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('zh-HK');
}

function formatNumber(num: any): string {
    if (num == null) return '—';
    return new Intl.NumberFormat('zh-HK').format(num);
}

/** 承租人合約狀態標籤 */
const statusLabels: Record<string, string> = {
    listing: '放盤中',
    renting: '出租中',
    leasing_in: '租入中',
    completed: '已完租',
    active: '活躍',
    pending: '待定',
    cancelled: '已取消',
};

const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-blue-500/20 text-blue-400',
    cancelled: 'bg-red-500/20 text-red-400',
    listing: 'bg-purple-500/20 text-purple-400',
    renting: 'bg-emerald-100 text-emerald-900 border border-emerald-400/70 dark:bg-emerald-950/55 dark:text-emerald-100 dark:border-emerald-500/55',
    leasing_in: 'bg-violet-100 text-violet-900 border border-violet-400/70 dark:bg-violet-950/55 dark:text-violet-100 dark:border-violet-500/55',
};

/** 計算兩個日期之間的完整月份數 */
const calcFullMonths = (startDate: Date, endDate: Date): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    let months = (endYear - startYear) * 12 + (endMonth - startMonth);
    const lastDayOfEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
    if (end.getDate() === lastDayOfEndMonth) months += 1;
    return months;
};

/** 格式化租期顯示 */
const formatDuration = (months: number): string => {
    if (months <= 0) return '0 個月';
    const y = Math.floor(months / 12);
    const r = months % 12;
    if (y === 0) return `${r} 個月`;
    if (r === 0) return `${y} 年`;
    return `${y} 年 ${r} 個月`;
};

export default function LesseeDetailModal({
    lessee,
    onClose,
    onEdit,
}: LesseeDetailModalProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<LesseeDetailTab>('contracts');
    const [contractsPage, setContractsPage] = useState(1);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const hasInitializedRef = useRef(false);

    // 只顯示合約記錄（contract），不顯示出租合約（rent_out）的 listing
    const { data: allContractRents = [], isLoading: loadingContract } = useRentsWithRelationsQuery({ type: 'contract' });

    // 找出所有與此承租人關聯的合約記錄
    const relatedContracts = useMemo(() => {
        if (!lessee.id && !lessee.name) return [];
        const seen = new Set<string>();
        const lesseeName = lessee.name.trim().toLowerCase();

        return allContractRents.filter((r: any) => {
            if (r.id && seen.has(r.id)) return false;

            // 優先精確匹配 tenantId
            if (r.tenantId === lessee.id || r.tenant?.id === lessee.id) {
                seen.add(r.id);
                return true;
            }

            // 承租人名稱匹配（來自 currentTenant、rentOutTenants、tenant.name、proprietor.name）
            const matchName = (name: string) =>
                name && name.trim().toLowerCase() === lesseeName;

            if (r.currentTenant?.name && matchName(r.currentTenant.name)) {
                seen.add(r.id);
                return true;
            }
            if (r.tenant?.name && matchName(r.tenant.name)) {
                seen.add(r.id);
                return true;
            }
            if (r.proprietor?.name && matchName(r.proprietor.name)) {
                seen.add(r.id);
                return true;
            }

            return false;
        });
    }, [allContractRents, lessee.id, lessee.name]);

    // 按 tenancyNumber 分組
    const groupedContracts = useMemo(() => {
        const groups = new Map<string, typeof relatedContracts>();
        relatedContracts.forEach(rent => {
            const key = rent.rentOutTenancyNumber || '__none__';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(rent);
        });
        return Array.from(groups.entries()).map(([key, contracts]) => ({
            tenancyNumber: key,
            contracts,
            totalCount: contracts.length,
            firstContract: contracts[0],
        }));
    }, [relatedContracts]);

    // 只在 modal 首次開啟且資料載入完成後初始化收起狀態
    useEffect(() => {
        if (groupedContracts.length > 0 && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            setCollapsedGroups(new Set(groupedContracts.map(g => g.tenancyNumber)));
            setContractsPage(1);
        }
    }, [groupedContracts]);

    const PAGE_SIZE = 5;
    const totalPages = Math.ceil(groupedContracts.length / PAGE_SIZE);
    const paginatedGroups = groupedContracts.slice(
        (contractsPage - 1) * PAGE_SIZE,
        contractsPage * PAGE_SIZE
    );

    const toggleGroup = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const isLoading = loadingContract;

    const partyTypeLabel =
        lessee.type === 'individual' ? '個人' : lessee.type === 'company' ? '公司' : '—';

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 min-h-screen bg-black/60 backdrop-blur-sm z-80"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 m-auto h-fit max-h-[90vh] overflow-hidden w-full max-w-2xl flex flex-col bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-80"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">承租人詳細資料</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/50 truncate max-w-48">
                                {lessee.shortName || lessee.name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 text-sm font-medium transition-all"
                            >
                                編輯
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1 p-3 border-b border-zinc-100 dark:border-white/5 shrink-0 bg-zinc-50/50 dark:bg-white/2">
                    {LESSEE_TAB_ORDER.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all ${
                                activeTab === tab
                                    ? 'bg-white dark:bg-white/15 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
                                    : 'text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                        >
                            {LESSEE_TAB_LABEL[tab]}
                            {tab === 'contracts' && (
                                <span className="ml-1.5 text-xs font-mono opacity-70">({groupedContracts.length})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'contracts' && (
                        <div className="p-5">
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[1, 2].map(i => (
                                        <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : relatedContracts.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="w-12 h-12 text-zinc-200 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-zinc-500 dark:text-white/40 font-medium">暫無關聯合約</p>
                                    <p className="text-zinc-400 dark:text-white/25 text-sm mt-1">此承租人尚未關聯任何合約記錄</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {paginatedGroups.map(group => {
                                            const isCollapsed = collapsedGroups.has(group.tenancyNumber);
                                            const firstContract = group.firstContract as any;
                                            const firstProperty = firstContract?.property as Property | null;

                                            return (
                                                <div key={group.tenancyNumber} className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                                                    {/* Group Header */}
                                                    <div
                                                        className="flex items-center gap-3 px-5 py-4 bg-zinc-50 dark:bg-white/5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors group"
                                                        onClick={() => toggleGroup(group.tenancyNumber)}
                                                    >
                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                                            <span className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                                                {group.tenancyNumber !== '__none__' ? group.tenancyNumber : '未分類'}
                                                            </span>
                                                            {group.totalCount > 1 && (
                                                                <span className="text-xs text-zinc-400 dark:text-white/30 shrink-0">
                                                                    ({group.totalCount} 份合約)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {firstProperty && (
                                                                <span className="hidden sm:inline-flex items-center gap-1 text-sm text-zinc-500 dark:text-white/40">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {firstProperty.name}
                                                                </span>
                                                            )}
                                                            {isCollapsed ? (
                                                                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-white/30" />
                                                            ) : (
                                                                <ChevronUp className="w-4 h-4 text-zinc-400 dark:text-white/30" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Group Content */}
                                                    {!isCollapsed && (
                                                        <div className="divide-y divide-zinc-100 dark:divide-white/5">
                                                            {group.contracts.map((contract: any) => {
                                                                const contractProperty = contract.property as Property | null;
                                                                const contractType = contract.type;
                                                                const startDate = contract.rentOutStartDate || contract.rentingStartDate || contract.contractStartDate;
                                                                const endDate = contract.rentOutEndDate || contract.rentingEndDate || contract.contractEndDate;
                                                                const monthlyRent = contract.rentOutMonthlyRental || contract.rentingMonthlyRental || 0;
                                                                const status = contract.rentOutStatus || contract.status || 'listing';
                                                                const deposit = contract.rentOutDepositReceived || contract.rentingDeposit || 0;
                                                                const contractNature = contract.rentOutContractNature;

                                                                return (
                                                                    <div
                                                                        key={contract.id}
                                                                        onClick={() => {
                                                                            if (contractProperty?.id) {
                                                                                router.push(`/properties/${contractProperty.id}`);
                                                                                onClose();
                                                                            }
                                                                        }}
                                                                        className="px-5 py-4 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-colors group/item"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                                                        contractType === 'rent_out'
                                                                                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                                                                            : contractType === 'renting'
                                                                                            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                                                                                            : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                                                                    }`}>
                                                                                        {contractType === 'rent_out' ? '出租合約' : contractType === 'renting' ? '交租合約' : '合約記錄'}
                                                                                    </span>
                                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || statusColors.listing}`}>
                                                                                        {statusLabels[status] || status}
                                                                                    </span>
                                                                                </div>
                                                                                {contractProperty && (
                                                                                    <div className="flex items-center gap-1.5 text-zinc-500 dark:text-white/40 mb-1.5">
                                                                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                                                        <span className="text-sm text-zinc-600 dark:text-white/60 truncate">{contractProperty.name || '—'}</span>
                                                                                        <span className="text-xs text-zinc-400 dark:text-white/25 font-mono shrink-0">
                                                                                            ({contractProperty.code})
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                <div className="flex items-center gap-4 mt-2 flex-wrap">
                                                                                    {monthlyRent > 0 && (
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className="text-[20px] font-bold text-blue-600 dark:text-blue-400">
                                                                                            ${formatNumber(monthlyRent)}
                                                                                        </span>
                                                                                        <span className="text-[14px] text-zinc-400 dark:text-white/40 font-light">
                                                                                            /月
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                    {startDate && (
                                                                                        <span className="flex items-center gap-1 text-sm text-zinc-400 dark:text-white/30">
                                                                                            <Calendar className="w-3 h-3 shrink-0" />
                                                                                            {formatDate(startDate)}
                                                                                            {endDate && ` — ${formatDate(endDate)}`}
                                                                                            {startDate && endDate && (
                                                                                                <span className="ml-1 text-xs bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md">
                                                                                                    {formatDuration(calcFullMonths(new Date(startDate), new Date(endDate)))}
                                                                                                </span>
                                                                                            )}
                                                                                        </span>
                                                                                    )}
                                                                                    {deposit > 0 && (
                                                                                        <span className="flex items-center gap-1 text-sm text-zinc-400 dark:text-white/30">
                                                                                            <Hash className="w-3 h-3 shrink-0" />
                                                                                            按金: ${formatNumber(deposit)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-white/20 group-hover/item:text-blue-400 dark:group-hover/item:text-blue-400 transition-colors shrink-0 mt-1" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* 分頁 */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-5">
                                            <button
                                                onClick={() => setContractsPage(p => Math.max(1, p - 1))}
                                                disabled={contractsPage === 1}
                                                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-sm text-zinc-500 dark:text-white/50">
                                                {contractsPage} / {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setContractsPage(p => Math.min(totalPages, p + 1))}
                                                disabled={contractsPage === totalPages}
                                                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'basic' && (
                        <div className="p-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">名稱</p>
                                    <p className="text-base font-bold text-zinc-900 dark:text-white">{lessee.name}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">代碼</p>
                                    <p className="text-base font-medium text-zinc-900 dark:text-white">
                                        {lessee.code || '—'}
                                    </p>
                                </div>
                                {lessee.shortName && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">簡稱</p>
                                        <p className="text-base font-medium text-zinc-900 dark:text-white">{lessee.shortName}</p>
                                    </div>
                                )}
                                {lessee.englishName && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">英文名稱</p>
                                        <p className="text-base font-medium text-zinc-900 dark:text-white">{lessee.englishName}</p>
                                    </div>
                                )}
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">性質</p>
                                    <p className="text-base font-medium text-zinc-900 dark:text-white">{partyTypeLabel}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">類別</p>
                                    <p className="text-base font-medium text-zinc-900 dark:text-white capitalize">
                                        {proprietorCategoryLabelZh(lessee.category, 'modal')}
                                    </p>
                                </div>
                                {lessee.brNumber && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">商業登記號碼</p>
                                        <p className="text-base font-medium text-zinc-900 dark:text-white">{lessee.brNumber}</p>
                                    </div>
                                )}
                                {lessee.createdAt && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">建立日期</p>
                                        <p className="text-base font-medium text-zinc-900 dark:text-white">
                                            {new Date(lessee.createdAt).toLocaleDateString('zh-HK', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-zinc-100 dark:border-white/5 shrink-0 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl hover:bg-zinc-200 dark:hover:bg-white/20 text-sm font-medium transition-all"
                    >
                        關閉
                    </button>
                </div>
            </motion.div>
        </>
    );
}
