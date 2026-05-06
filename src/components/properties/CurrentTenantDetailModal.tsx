'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Building2, MapPin, Users, FileText, ChevronRight, ChevronUp, Hash, ChevronLeft, Calendar } from 'lucide-react';
import type { CurrentTenant, Property } from '@/lib/db';
import { useRentsWithRelationsQuery } from '@/hooks/useStorage';
import { proprietorCategoryLabelZh, formatLotIndexPlainJoined, formatRentHistoryLotCellText } from '@/lib/formatters';
import { getRentOutLesseeDisplayLabel } from '@/lib/rentPaymentDisplay';

type CurrentTenantDetailTab = 'basic' | 'contracts';

const CURRENT_TENANT_TAB_ORDER: CurrentTenantDetailTab[] = ['contracts', 'basic'];

const CURRENT_TENANT_TAB_LABEL: Record<CurrentTenantDetailTab, string> = {
    contracts: '關聯合約',
    basic: '基本資料',
};

interface CurrentTenantDetailModalProps {
    currentTenant: CurrentTenant;
    onClose: () => void;
    onEdit?: () => void;
}

function formatNumber(num: any): string {
    if (num == null) return '—';
    return new Intl.NumberFormat('zh-HK').format(num);
}

const statusLabels: Record<string, string> = {
    listing: '放盤中',
    renting: '出租中',
    leasing_in: '租入中',
    completed: '已完租',
};

export default function CurrentTenantDetailModal({
    currentTenant,
    onClose,
    onEdit,
}: CurrentTenantDetailModalProps) {
    const [activeTab, setActiveTab] = useState<CurrentTenantDetailTab>('contracts');
    const [contractsPage, setContractsPage] = useState(1);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // 只在 modal 首次開啟時初始化 collapsedGroups，之後由用戶操作控制
    const hasInitializedRef = useRef(false);

    // 只顯示合約類型（contract）的記錄，不顯示租賃（rent_out）和交租（renting）的 listing
    const { data: allContractRents = [], isLoading: loadingContract } = useRentsWithRelationsQuery({ type: 'contract' });

    const relatedRents = useMemo(() => {
        return allContractRents.filter((r: any) => {
            const ids = r.rentOutTenantIds || [];
            return ids.includes(currentTenant.id);
        });
    }, [allContractRents, currentTenant.id]);

    const groupedContracts = useMemo(() => {
        const groups = new Map<string, typeof relatedRents>();
        relatedRents.forEach(rent => {
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
    }, [relatedRents]);

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
        currentTenant.type === 'individual' ? '個人' : currentTenant.type === 'company' ? '公司' : '—';

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 min-h-screen bg-black/60 backdrop-blur-sm z-70"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 m-auto h-fit max-h-[90vh] overflow-hidden w-full max-w-2xl flex flex-col bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-70"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">現時租客詳細資料</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/50 truncate">{currentTenant.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                    {CURRENT_TENANT_TAB_ORDER.map(tab => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all ${
                                activeTab === tab
                                    ? 'bg-white dark:bg-white/15 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-purple-500/20'
                                    : 'text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                        >
                            {CURRENT_TENANT_TAB_LABEL[tab]}
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
                            ) : relatedRents.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="w-12 h-12 text-zinc-200 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-zinc-500 dark:text-white/40 font-medium">暫無關聯合約</p>
                                    <p className="text-zinc-400 dark:text-white/25 text-sm mt-1">此現時租客尚未關聯任何合約記錄</p>
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
                                                            <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                                                            <span className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                                {group.tenancyNumber === '__none__' ? '—' : group.tenancyNumber}
                                                            </span>
                                                            {group.totalCount > 1 && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-semibold shrink-0">
                                                                    {group.totalCount}個
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {firstProperty && (
                                                                <div className="flex items-center gap-1 text-zinc-500 dark:text-white/50">
                                                                    <MapPin className="w-4 h-4 shrink-0" />
                                                                    <span className="text-sm truncate max-w-32">{firstProperty.name || '—'}</span>
                                                                </div>
                                                            )}
                                                            {isCollapsed ? (
                                                                <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-white/30 shrink-0" />
                                                            ) : (
                                                                <ChevronUp className="w-5 h-5 text-zinc-400 dark:text-white/30 shrink-0" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Group Items */}
                                                    {!isCollapsed && (
                                                        <div className="divide-y divide-zinc-100 dark:divide-white/5">
                                                            {group.contracts.map(rent => {
                                                                const rentProperty = rent.property as Property | null;
                                                                const contractStatus = rent.rentOutStatus || 'listing';
                                                                const statusLabel = statusLabels[contractStatus] || contractStatus;
                                                                return (
                                                                    <div
                                                                        key={rent.id}
                                                                        className="px-5 py-4 pl-14 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer group/item transition-colors"
                                                                        onClick={() => {
                                                                            if (rentProperty?.id) {
                                                                                window.location.href = `/properties/${rentProperty.id}`;
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div className="flex-1 min-w-0 space-y-2">
                                                                                {/* 物業名稱 */}
                                                                                {rentProperty && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Building2 className="w-4 h-4 text-purple-500 shrink-0" />
                                                                                        <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{rentProperty.name || '—'}</span>
                                                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-mono font-medium shrink-0">
                                                                                            {rentProperty.code}
                                                                                        </span>
                                                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                                                            contractStatus === 'renting'
                                                                                                ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                                                                                                : contractStatus === 'listing'
                                                                                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                                                                                : contractStatus === 'leasing_in'
                                                                                                ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                                                                                                : 'bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-white/50'
                                                                                        }`}>
                                                                                            {statusLabel}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {/* 租客名稱 */}
                                                                                {(() => {
                                                                                    const lesseeName = getRentOutLesseeDisplayLabel(rent);
                                                                                    return lesseeName ? (
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Users className="w-4 h-4 text-purple-500 shrink-0" />
                                                                                            <span className="text-sm text-zinc-700 dark:text-white/80 truncate">{lesseeName}</span>
                                                                                        </div>
                                                                                    ) : null;
                                                                                })()}
                                                                                {/* 地址 */}
                                                                                {rentProperty?.address && (
                                                                                    <div className="flex items-start gap-2">
                                                                                        <MapPin className="w-4 h-4 text-zinc-400 dark:text-white/40 shrink-0 mt-0.5" />
                                                                                        <span className="text-sm text-zinc-600 dark:text-white/60">{rentProperty.address}</span>
                                                                                    </div>
                                                                                )}
                                                                                {/* 地段：優先顯示該合約所選地段，否則顯示物业全部地段 */}
                                                                                {rentProperty?.lotIndex && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Hash className="w-4 h-4 text-zinc-400 dark:text-white/40 shrink-0" />
                                                                                        <span className="text-sm text-zinc-600 dark:text-white/60">
                                                                                            {formatRentHistoryLotCellText(rentProperty.lotIndex, rent)}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {/* 租期 + 租金同行，右側顯示租金 */}
                                                                                {(rent.rentOutStartDate || rent.startDate || rent.rentOutEndDate || rent.endDate || rent.rentOutMonthlyRental != null) && (
                                                                                    <div className="flex items-center justify-between gap-3">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Calendar className="w-4 h-4 text-zinc-400 dark:text-white/40 shrink-0" />
                                                                                            <span className="text-sm text-zinc-600 dark:text-white/60">
                                                                                                {rent.rentOutStartDate
                                                                                                    ? new Date(rent.rentOutStartDate).toLocaleDateString('zh-HK')
                                                                                                    : rent.startDate
                                                                                                    ? new Date(rent.startDate).toLocaleDateString('zh-HK')
                                                                                                    : '—'}
                                                                                                {rent.rentOutEndDate
                                                                                                    ? ` — ${new Date(rent.rentOutEndDate).toLocaleDateString('zh-HK')}`
                                                                                                    : rent.endDate
                                                                                                    ? ` — ${new Date(rent.endDate).toLocaleDateString('zh-HK')}`
                                                                                                    : ''}
                                                                                            </span>
                                                                                        </div>
                                                                                        {rent.rentOutMonthlyRental != null && (
                                                                                            <div className="flex items-baseline gap-1 shrink-0">
                                                                                                <span className="text-[20px] font-bold" style={{ color: 'var(--color-emerald-600)' }}>
                                                                                                    ${new Intl.NumberFormat('zh-HK').format(rent.rentOutMonthlyRental)}
                                                                                                </span>
                                                                                                <span className="text-sm" style={{ color: 'var(--color-zinc-400)', fontWeight: 400 }}>
                                                                                                    /月
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
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
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-3 pt-4 mt-2 text-sm text-zinc-500 dark:text-white/50 border-t border-zinc-100 dark:border-white/5">
                                            <button
                                                onClick={() => setContractsPage(p => Math.max(1, p - 1))}
                                                disabled={contractsPage <= 1}
                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-white" />
                                            </button>
                                            <span className="font-medium min-w-12 text-center">
                                                {contractsPage} / {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setContractsPage(p => Math.min(totalPages, p + 1))}
                                                disabled={contractsPage >= totalPages}
                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-white" />
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
                                    <p className="text-base font-bold text-zinc-900 dark:text-white wrap-break-word">{currentTenant.name}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">現時租客編號</p>
                                    <p className="text-base font-medium text-zinc-900 dark:text-white">
                                        {currentTenant.code || '—'}
                                    </p>
                                </div>
                                {currentTenant.englishName && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 col-span-2">
                                        <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">公司／英文名稱</p>
                                        <p className="text-base font-medium text-zinc-900 dark:text-white wrap-break-word">{currentTenant.englishName}</p>
                                    </div>
                                )}
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">性質</p>
                                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        {partyTypeLabel}
                                    </span>
                                </div>
                                {currentTenant.category && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">類別</p>
                                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            {proprietorCategoryLabelZh(currentTenant.category, 'modal')}
                                        </span>
                                    </div>
                                )}
                                {(currentTenant.depositReceived != null || currentTenant.depositReceiptNumber) && (
                                    <>
                                        <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                            <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">按金</p>
                                            <p className="text-base font-medium text-zinc-900 dark:text-white">
                                                {currentTenant.depositReceived != null ? `$${formatNumber(currentTenant.depositReceived)}` : '—'}
                                            </p>
                                        </div>
                                        {currentTenant.depositReceiptNumber && (
                                            <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">按金收據號碼</p>
                                                <p className="text-base font-mono font-medium text-zinc-900 dark:text-white">{currentTenant.depositReceiptNumber}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                                {currentTenant.addressDetail && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 col-span-2">
                                        <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">地址</p>
                                        <p className="text-base text-zinc-900 dark:text-white">{currentTenant.addressDetail}</p>
                                    </div>
                                )}
                            </div>
                            {currentTenant.description && (
                                <div className="mt-4">
                                    <p className="text-sm text-zinc-500 dark:text-white/40 mb-1">描述</p>
                                    <div
                                        className="text-sm text-zinc-700 dark:text-white/80 prose dark:prose-invert max-w-none p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5"
                                        dangerouslySetInnerHTML={{ __html: currentTenant.description }}
                                    />
                                </div>
                            )}
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
