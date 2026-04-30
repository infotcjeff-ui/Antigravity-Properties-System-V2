'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Building2, MapPin, Calendar, DollarSign, ExternalLink, Users, FileText, ChevronRight, ChevronUp } from 'lucide-react';
import type { CurrentTenant, Property, Rent } from '@/lib/db';
import { useRentsWithRelationsQuery } from '@/hooks/useStorage';
import { proprietorCategoryLabelZh } from '@/lib/formatters';

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

function formatDate(date: any): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('zh-HK');
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

    const { data: allRentOutRents = [], isLoading: loadingRentOut } = useRentsWithRelationsQuery({ type: 'rent_out' });
    const { data: allContractRents = [], isLoading: loadingContract } = useRentsWithRelationsQuery({ type: 'contract' });
    const { data: allRentingRents = [], isLoading: loadingRenting } = useRentsWithRelationsQuery({ type: 'renting' });

    const relatedRents = useMemo(() => {
        const combined = [...allRentOutRents, ...allContractRents, ...allRentingRents];
        return combined.filter((r: any) => {
            const ids = r.rentOutTenantIds || r.rentingTenantIds || [];
            return ids.includes(currentTenant.id);
        });
    }, [allRentOutRents, allContractRents, allRentingRents, currentTenant.id]);

    const groupedContracts = useMemo(() => {
        const groups = new Map<string, typeof relatedRents>();
        relatedRents.forEach(rent => {
            const key = rent.rentOutTenancyNumber || rent.rentingTenancyNumber || '__none__';
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

    const isLoading = loadingRentOut || loadingContract || loadingRenting;
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
                                        <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : relatedRents.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="w-12 h-12 text-zinc-200 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-zinc-500 dark:text-white/40 font-medium">暫無關聯合約</p>
                                    <p className="text-zinc-400 dark:text-white/25 text-xs mt-1">此現時租客尚未關聯任何合約記錄</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        {paginatedGroups.map(group => {
                                            const isCollapsed = collapsedGroups.has(group.tenancyNumber);
                                            const firstContract = group.firstContract as any;
                                            const firstProperty = firstContract?.property as Property | null;
                                            return (
                                                <div key={group.tenancyNumber} className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                                                    {/* Group Header */}
                                                    <div
                                                        className="flex items-center gap-3 px-4 py-3 bg-zinc-50 dark:bg-white/5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors group"
                                                        onClick={() => toggleGroup(group.tenancyNumber)}
                                                    >
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                                                            <span className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                                {group.tenancyNumber === '__none__' ? '—' : group.tenancyNumber}
                                                            </span>
                                                            {group.totalCount > 1 && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-medium shrink-0">
                                                                    {group.totalCount}個
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {firstProperty && (
                                                                <div className="flex items-center gap-1 text-zinc-400 dark:text-white/40">
                                                                    <MapPin className="w-3 h-3 shrink-0" />
                                                                    <span className="text-[10px] truncate max-w-24">{firstProperty.name || '—'}</span>
                                                                </div>
                                                            )}
                                                            {isCollapsed ? (
                                                                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-white/30 shrink-0" />
                                                            ) : (
                                                                <ChevronUp className="w-4 h-4 text-zinc-400 dark:text-white/30 shrink-0" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Group Items */}
                                                    {!isCollapsed && (
                                                        <div className="divide-y divide-zinc-100 dark:divide-white/5">
                                                            {group.contracts.map(rent => {
                                                                const rentProperty = rent.property as Property | null;
                                                                const rentType = rent.type || 'rent_out';
                                                                const tenancyNum = rent.rentOutTenancyNumber || rent.rentingTenancyNumber;
                                                                const monthlyRental = rent.rentOutMonthlyRental ?? rent.rentingMonthlyRental;
                                                                const startDate = rent.rentOutStartDate || rent.rentingStartDate;
                                                                const endDate = rent.rentOutEndDate || rent.rentingEndDate;
                                                                const contractStatus = rent.rentOutStatus || rent.rentingStatus || 'listing';
                                                                const statusLabel = statusLabels[contractStatus] || contractStatus;
                                                                return (
                                                                    <div
                                                                        key={rent.id}
                                                                        className="px-4 py-3 pl-10 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer group/item transition-colors"
                                                                        onClick={() => {
                                                                            if (rentProperty?.id) {
                                                                                window.location.href = `/properties/${rentProperty.id}`;
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                                    {rentType === 'rent_out' ? (
                                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-medium">出租</span>
                                                                                    ) : rentType === 'contract' ? (
                                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-medium">合約</span>
                                                                                    ) : (
                                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-medium">交租</span>
                                                                                    )}
                                                                                    {rentProperty && (
                                                                                        <div className="flex items-center gap-1 text-zinc-500 dark:text-white/40">
                                                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                                                            <span className="text-xs truncate">{rentProperty.name || '—'}</span>
                                                                                            <span className="text-[10px] text-zinc-400 dark:text-white/25 font-mono shrink-0">
                                                                                                ({rentProperty.code})
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
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
                                                                                <div className="flex items-center gap-4 flex-wrap">
                                                                                    {monthlyRental != null && (
                                                                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                                                            ${new Intl.NumberFormat('zh-HK').format(monthlyRental)}/月
                                                                                        </span>
                                                                                    )}
                                                                                    {startDate && (
                                                                                        <span className="text-[10px] text-zinc-400 dark:text-white/30">
                                                                                            {formatDate(startDate)}
                                                                                            {endDate && ` — ${formatDate(endDate)}`}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                {rentProperty?.address && (
                                                                                    <a
                                                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rentProperty.address)}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        onClick={e => e.stopPropagation()}
                                                                                        className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-500/20 text-zinc-400 dark:text-white/30 hover:text-purple-500 dark:hover:text-purple-400 transition-colors opacity-0 group-hover/item:opacity-100"
                                                                                        title="在 Google Maps 開啟"
                                                                                    >
                                                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                                                    </a>
                                                                                )}
                                                                                <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-white/20" />
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
                                        <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                                            <button
                                                onClick={() => setContractsPage(p => Math.max(1, p - 1))}
                                                disabled={contractsPage === 1}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                上一頁
                                            </button>
                                            <span className="text-xs text-zinc-400 dark:text-white/40 font-mono">
                                                {contractsPage} / {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setContractsPage(p => Math.min(totalPages, p + 1))}
                                                disabled={contractsPage === totalPages}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                下一頁
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'basic' && (
                        <div className="p-5 space-y-6">
                            {/* 基本資料 */}
                            <section>
                                <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">基本資料</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">名稱</p>
                                        <p className="text-sm font-bold text-zinc-900 dark:text-white wrap-break-word">{currentTenant.name}</p>
                                    </div>
                                    {currentTenant.code && (
                                        <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                            <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">現時租客編號</p>
                                            <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">{currentTenant.code}</p>
                                        </div>
                                    )}
                                    {currentTenant.englishName && (
                                        <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 md:col-span-2">
                                            <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">公司／英文名稱</p>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white wrap-break-word">{currentTenant.englishName}</p>
                                        </div>
                                    )}
                                    {currentTenant.type && (
                                        <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                            <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">性質</p>
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                {partyTypeLabel}
                                            </span>
                                        </div>
                                    )}
                                    {currentTenant.category && (
                                        <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                            <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">類別</p>
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                {proprietorCategoryLabelZh(currentTenant.category, 'modal')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* 按金資料 */}
                            {(currentTenant.depositReceived != null || currentTenant.depositReceiptNumber) && (
                                <section>
                                    <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">按金資料</h3>
                                    <div className="bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 divide-y divide-zinc-100 dark:divide-white/5">
                                        <div className="flex items-center gap-3 px-4 py-3">
                                            <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">按金</span>
                                            <span className="text-sm font-medium text-zinc-800 dark:text-white">
                                                {currentTenant.depositReceived != null ? `$${formatNumber(currentTenant.depositReceived)}` : '—'}
                                            </span>
                                        </div>
                                        {currentTenant.depositReceiptNumber && (
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0 ml-7">收據號碼</span>
                                                <span className="text-sm font-mono font-medium text-zinc-800 dark:text-white">{currentTenant.depositReceiptNumber}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 px-4 py-3">
                                            <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">收取日期</span>
                                            <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(currentTenant.depositReceiveDate)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 px-4 py-3">
                                            <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                                            <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">退回日期</span>
                                            <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(currentTenant.depositReturnDate)}</span>
                                        </div>
                                        {currentTenant.depositReturnAmount != null && (
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                <DollarSign className="w-4 h-4 text-amber-500 shrink-0" />
                                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">退回金額</span>
                                                <span className="text-sm font-medium text-zinc-800 dark:text-white">${formatNumber(currentTenant.depositReturnAmount)}</span>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* 地址資料 */}
                            {currentTenant.addressDetail && (
                                <section>
                                    <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">地址資料</h3>
                                    <div className="flex items-start gap-2 p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <MapPin className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                                        <span className="text-sm text-zinc-800 dark:text-white">{currentTenant.addressDetail}</span>
                                    </div>
                                </section>
                            )}

                            {/* 描述 */}
                            {currentTenant.description && (
                                <section>
                                    <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">描述</h3>
                                    <div
                                        className="text-sm text-zinc-700 dark:text-white/80 prose dark:prose-invert max-w-none p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5"
                                        dangerouslySetInnerHTML={{ __html: currentTenant.description }}
                                    />
                                </section>
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
