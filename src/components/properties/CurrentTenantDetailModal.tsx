'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Building2, MapPin, Calendar, DollarSign, ExternalLink } from 'lucide-react';
import type { CurrentTenant, Property, Rent } from '@/lib/db';
import { useRentsWithRelationsQuery } from '@/hooks/useStorage';
import { proprietorCategoryLabelZh } from '@/lib/formatters';

interface CurrentTenantDetailModalProps {
    currentTenant: CurrentTenant;
    onClose: () => void;
    /** 從 RentOutFormModal 打開時可編輯 */
    onEdit?: () => void;
}

const statusLabels: Record<string, string> = {
    listing: '放盤中',
    renting: '出租中',
    leasing_in: '租入中',
    completed: '已完租',
};

function DetailCard({ label, value }: { label: string; value: React.ReactNode }) {
    if (value == null || value === '' || value === '—') return null;
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400 dark:text-white/40 uppercase tracking-wider font-semibold">{label}</span>
            <span className="text-sm font-medium text-zinc-800 dark:text-white">{value}</span>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
    if (value == null || value === '' || value === '—') return null;
    return (
        <div className="flex items-start gap-2 py-2 border-b border-zinc-100 dark:border-white/5 last:border-0">
            <Icon className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
            <span className="text-xs text-zinc-500 dark:text-white/50 w-24 shrink-0">{label}</span>
            <span className="text-sm font-medium text-zinc-800 dark:text-white">{value}</span>
        </div>
    );
}

function formatDate(date: any): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('zh-HK');
}

function formatNumber(num: any): string {
    if (num == null) return '—';
    return new Intl.NumberFormat('zh-HK').format(num);
}

export default function CurrentTenantDetailModal({
    currentTenant,
    onClose,
    onEdit,
}: CurrentTenantDetailModalProps) {
    // 找出所有與此現時租客關聯的收租記錄（rent_out / contract）
    const { data: allRents = [], isLoading: loadingRents } = useRentsWithRelationsQuery();
    const { data: allContractRents = [], isLoading: loadingContracts } = useRentsWithRelationsQuery({ type: 'contract' });

    const relatedRents = useMemo(() => {
        const combined = [...allRents, ...allContractRents];
        return combined.filter((r: any) => {
            const ids = r.rentOutTenantIds || [];
            return ids.includes(currentTenant.id);
        });
    }, [allRents, allContractRents, currentTenant.id]);

    // 從關聯記錄中抽出不同物业
    const relatedProperties = useMemo(() => {
        const map = new Map<string, Property & { rent?: Rent }>();
        relatedRents.forEach((r: any) => {
            if (r.property && !map.has(r.property.id)) {
                map.set(r.property.id, { ...r.property, rent: r });
            }
        });
        return Array.from(map.values());
    }, [relatedRents]);

    const statusLabel = statusLabels[currentTenant.status || ''] || '—';
    const isExpired = currentTenant.endDate ? new Date(currentTenant.endDate) < new Date() : false;
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
                className="fixed inset-0 m-auto h-fit max-h-[90vh] overflow-y-auto w-full max-w-3xl flex flex-col bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-70"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">現時租客詳細資料</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/50">{currentTenant.name}</p>
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

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* 基本資料 */}
                    <section>
                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">基本資料</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">個人名稱</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-white">{currentTenant.name}</p>
                            </div>
                            {currentTenant.code && (
                                <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">業主代碼</p>
                                    <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">{currentTenant.code}</p>
                                </div>
                            )}
                            {currentTenant.englishName && (
                                <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">公司名稱</p>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{currentTenant.englishName}</p>
                                </div>
                            )}
                            {currentTenant.type && (
                                <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">業主性質</p>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{partyTypeLabel}</p>
                                </div>
                            )}
                            {currentTenant.category && (
                                <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">擁有人類別</p>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        {proprietorCategoryLabelZh(currentTenant.category, 'modal')}
                                    </p>
                                </div>
                            )}
                            {currentTenant.brNumber && (
                                <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">BR Number</p>
                                    <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">{currentTenant.brNumber}</p>
                                </div>
                            )}
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">合約號碼</p>
                                <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">{currentTenant.tenancyNumber || '—'}</p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">狀態</p>
                                <p className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                                    {isExpired ? '已過期' : statusLabel}
                                </p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租人</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{currentTenant.lessor || '—'}</p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">每月租金</p>
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                    {currentTenant.monthlyRental != null ? `$${formatNumber(currentTenant.monthlyRental)}` : '—'}
                                </p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">期數</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {currentTenant.periods ? `${currentTenant.periods} 個月` : '—'}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 日期資料 */}
                    <section>
                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">日期資料</h3>
                        <div className="bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 divide-y divide-zinc-100 dark:divide-white/5">
                            <div className="flex items-center gap-3 px-4 py-3">
                                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">開始日期</span>
                                <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(currentTenant.startDate)}</span>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-3">
                                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">結束日期</span>
                                <span className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-zinc-800 dark:text-white'}`}>
                                    {formatDate(currentTenant.endDate)}
                                    {isExpired && <span className="ml-2 text-xs font-medium">(已過期)</span>}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-3">
                                <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">實際結束</span>
                                <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(currentTenant.actualEndDate)}</span>
                            </div>
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

                    {/* 關聯物業 */}
                    <section>
                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">
                            關聯物業 ({relatedProperties.length})
                        </h3>
                        {(loadingRents || loadingContracts) ? (
                            <div className="space-y-3">
                                {[1, 2].map(i => (
                                    <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-white/5 animate-pulse" />
                                ))}
                            </div>
                        ) : relatedProperties.length === 0 ? (
                            <div className="p-6 text-center bg-zinc-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-white/10">
                                <Building2 className="w-8 h-8 text-zinc-300 dark:text-white/10 mx-auto mb-2" />
                                <p className="text-sm text-zinc-500 dark:text-white/40">暫無關聯的收租記錄</p>
                                <p className="text-xs text-zinc-400 dark:text-white/30 mt-1">在收租記錄的「現時租客」欄位選取此人，即可關聯到此物業</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {relatedProperties.map(prop => {
                                    const rent = prop.rent as any;
                                    const rentStatus = rent?.rentOutStatus || 'listing';
                                    const rentStatusLabel = statusLabels[rentStatus] || rentStatus;
                                    return (
                                        <div
                                            key={prop.id}
                                            className="p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{prop.name}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-mono font-medium">
                                                            {prop.code}
                                                        </span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                                            rentStatus === 'renting'
                                                                ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                                                                : rentStatus === 'listing'
                                                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                                                : rentStatus === 'leasing_in'
                                                                ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                                                                : 'bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-white/50'
                                                        }`}>
                                                            {rentStatus === 'renting' ? '出租中' : rentStatus === 'listing' ? '放盤中' : rentStatus === 'leasing_in' ? '租入中' : rentStatusLabel}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                                                        <span className="text-xs text-zinc-500 dark:text-white/50 truncate">{prop.address || '—'}</span>
                                                    </div>
                                                    {rent && (
                                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                ${formatNumber(rent.rentOutMonthlyRental || rent.rentingMonthlyRental)}/月
                                                            </span>
                                                            <span className="text-xs text-zinc-400 dark:text-white/40">
                                                                {formatDate(rent.rentOutStartDate || rent.rentingStartDate)} — {formatDate(rent.rentOutEndDate || rent.rentingEndDate)}
                                                            </span>
                                                            {rent.rentOutTenancyNumber && (
                                                                <span className="text-xs text-zinc-500 dark:text-white/50 font-mono">
                                                                    #{rent.rentOutTenancyNumber}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {prop.address && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.address)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 text-zinc-400 dark:text-white/40 hover:text-purple-500 dark:hover:text-purple-400 transition-colors shrink-0"
                                                        title="在 Google Maps 開啟"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

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
