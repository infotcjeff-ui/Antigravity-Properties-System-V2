'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Building2, ExternalLink, ChevronRight, MapPin, FileText, Calendar } from 'lucide-react';
import type { Proprietor, Property, Rent } from '@/lib/db';
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

export default function LesseeDetailModal({
    lessee,
    onClose,
    onEdit,
}: LesseeDetailModalProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<LesseeDetailTab>('contracts');

    // 找出所有與此承租人關聯的交租記錄（type=renting, tenant_id === lessee.id）
    const { data: rentingRents = [], isLoading: loadingRenting } = useRentsWithRelationsQuery({ type: 'renting' });
    // 找出所有與此承租人關聯的出租記錄（type=rent_out, proprietor_id === lessee.id）
    const { data: rentOutRents = [], isLoading: loadingRentOut } = useRentsWithRelationsQuery({ type: 'rent_out' });
    // 合約記錄中也可能有承租人
    const { data: contractRents = [], isLoading: loadingContract } = useRentsWithRelationsQuery({ type: 'contract' });

    const relatedContracts = useMemo(() => {
        if (!lessee.id) return [];
        const all = [...rentingRents, ...rentOutRents, ...contractRents];
        const seen = new Set<string>();
        return all.filter((r: any) => {
            // renting: tenant_id === lessee.id
            if (r.tenantId === lessee.id || r.tenant?.id === lessee.id) {
                if (!r.id || seen.has(r.id)) return false;
                seen.add(r.id);
                return true;
            }
            return false;
        });
    }, [rentingRents, rentOutRents, contractRents, lessee.id]);

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
                                <span className="ml-1.5 text-xs font-mono opacity-70">({relatedContracts.length})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'contracts' && (
                        <div className="p-5">
                            {loadingRenting || loadingRentOut || loadingContract ? (
                                <div className="space-y-3">
                                    {[1, 2].map(i => (
                                        <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : relatedContracts.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="w-12 h-12 text-zinc-200 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-zinc-500 dark:text-white/40 font-medium">暫無關聯合約</p>
                                    <p className="text-zinc-400 dark:text-white/25 text-xs mt-1">此承租人尚未關聯任何合約記錄</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {relatedContracts.map((rent: any) => {
                                        const contractProperty = rent.property as Property | null;
                                        const contractType = rent.type;

                                        return (
                                            <div
                                                key={rent.id}
                                                onClick={() => {
                                                    if (contractProperty?.id) {
                                                        router.push(`/properties/${contractProperty.id}`);
                                                        onClose();
                                                    }
                                                }}
                                                className="p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all group"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                                            <span className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                {contractType === 'renting'
                                                                    ? (rent.rentingNumber || '—')
                                                                    : (rent.rentOutTenancyNumber || '—')}
                                                            </span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                                                contractType === 'renting'
                                                                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                                                            }`}>
                                                                {contractType === 'renting' ? '交租合約' : contractType === 'rent_out' ? '出租合約' : '其他合約'}
                                                            </span>
                                                        </div>
                                                        {contractProperty && (
                                                            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-white/40 mb-1">
                                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                                <span className="text-xs truncate">{contractProperty.name || '—'}</span>
                                                                <span className="text-[10px] text-zinc-400 dark:text-white/25 font-mono shrink-0">
                                                                    ({contractProperty.code})
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                                                            {contractType === 'renting' ? (
                                                                rent.rentingMonthlyRental != null && (
                                                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                                                        月租: ${formatNumber(rent.rentingMonthlyRental)}
                                                                    </span>
                                                                )
                                                            ) : (
                                                                rent.rentOutMonthlyRental != null && (
                                                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                                        月租: ${formatNumber(rent.rentOutMonthlyRental)}
                                                                    </span>
                                                                )
                                                            )}
                                                            {contractType === 'renting' ? (
                                                                rent.rentingStartDate && (
                                                                    <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-white/30">
                                                                        <Calendar className="w-3 h-3 shrink-0" />
                                                                        {formatDate(rent.rentingStartDate)}
                                                                        {rent.rentingEndDate && ` — ${formatDate(rent.rentingEndDate)}`}
                                                                    </span>
                                                                )
                                                            ) : (
                                                                rent.rentOutStartDate && (
                                                                    <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-white/30">
                                                                        <Calendar className="w-3 h-3 shrink-0" />
                                                                        {formatDate(rent.rentOutStartDate)}
                                                                        {rent.rentOutEndDate && ` — ${formatDate(rent.rentOutEndDate)}`}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 mt-1">
                                                        {contractProperty?.address && (
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contractProperty.address)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 text-zinc-400 dark:text-white/30 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                                                title="在 Google Maps 開啟"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                        <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-white/20 group-hover:text-blue-400 dark:group-hover:text-blue-400 transition-colors" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'basic' && (
                        <div className="p-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">名稱</p>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{lessee.name}</p>
                                </div>
                                {lessee.englishName && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">英文名稱</p>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{lessee.englishName}</p>
                                    </div>
                                )}
                                {lessee.shortName && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">簡稱</p>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{lessee.shortName}</p>
                                    </div>
                                )}
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">代碼</p>
                                    <p className="text-sm font-mono font-bold text-zinc-900 dark:text-white">{lessee.code}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">性質</p>
                                    <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{partyTypeLabel}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">擁有類別</p>
                                    <p className="text-sm font-medium text-zinc-700 dark:text-white/70 capitalize">
                                        {proprietorCategoryLabelZh(lessee.category, 'modal')}
                                    </p>
                                </div>
                                {lessee.brNumber && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 sm:col-span-2">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">商業登記號碼</p>
                                        <p className="text-sm font-mono font-medium text-zinc-700 dark:text-white/70">{lessee.brNumber}</p>
                                    </div>
                                )}
                                {lessee.createdAt && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 sm:col-span-2">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">建立日期</p>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/70">
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
