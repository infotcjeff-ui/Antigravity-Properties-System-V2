'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Building2, ExternalLink, ChevronRight, ChevronLeft, MapPin, Hash } from 'lucide-react';
import type { Proprietor, Property } from '@/lib/db';
import { formatLotIndexPlainJoined } from '@/lib/formatters';

type OwnerDetailTab = 'properties' | 'basic';

const OWNER_TAB_ORDER: OwnerDetailTab[] = ['properties', 'basic'];

const OWNER_TAB_LABEL: Record<OwnerDetailTab, string> = {
    properties: '關聯物業',
    basic: '基本資料',
};

interface OwnerPropertyListModalProps {
    proprietor: Proprietor;
    allProperties: Property[];
    onClose: () => void;
    onEdit?: () => void;
}

export default function OwnerPropertyListModal({
    proprietor,
    allProperties,
    onClose,
    onEdit,
}: OwnerPropertyListModalProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<OwnerDetailTab>('properties');
    const [propertyPage, setPropertyPage] = useState(1);
    const PROPERTY_PAGE_SIZE = 5;

    const relatedProperties = useMemo(() => {
        if (!proprietor.id) return [];
        return allProperties.filter(p =>
            p.proprietorId === proprietor.id ||
            (p.proprietorIds && p.proprietorIds.includes(proprietor.id!))
        );
    }, [proprietor.id, allProperties]);

    const paginatedProperties = useMemo(() => {
        const totalPages = Math.max(1, Math.ceil(relatedProperties.length / PROPERTY_PAGE_SIZE));
        const safePage = Math.min(Math.max(1, propertyPage), totalPages);
        return {
            list: relatedProperties.slice((safePage - 1) * PROPERTY_PAGE_SIZE, safePage * PROPERTY_PAGE_SIZE),
            totalPages,
            safePage,
        };
    }, [relatedProperties, propertyPage]);

    const statusBadge = (status?: string) => {
        switch (status) {
            case 'holding':
                return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
            case 'renting':
                return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400';
            case 'sold':
                return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
            case 'suspended':
                return 'bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-white/50';
            default:
                return 'bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-white/50';
        }
    };

    const statusLabel = (status?: string) => {
        switch (status) {
            case 'holding': return '持有';
            case 'renting': return '出租';
            case 'sold': return '已售';
            case 'suspended': return '暫停';
            default: return '—';
        }
    };

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
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">業主詳細資料</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/50 truncate max-w-48">
                                {proprietor.shortName || proprietor.name}
                            </p>
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
                    {OWNER_TAB_ORDER.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => {
                                setActiveTab(tab);
                                if (tab === 'properties') setPropertyPage(1);
                            }}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all ${
                                activeTab === tab
                                    ? 'bg-white dark:bg-white/15 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-purple-500/20'
                                    : 'text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                        >
                            {OWNER_TAB_LABEL[tab]}
                            {tab === 'properties' && (
                                <span className="ml-1.5 text-xs font-mono opacity-70">({relatedProperties.length})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'properties' && (
                        <div className="p-5">
                            {relatedProperties.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Building2 className="w-12 h-12 text-zinc-200 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-zinc-500 dark:text-white/40 font-medium">暫無關聯物業</p>
                                    <p className="text-zinc-400 dark:text-white/25 text-xs mt-1">此業主尚未關聯任何物業</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {paginatedProperties.list.map((property) => (
                                            <div
                                                key={property.id}
                                                onClick={() => {
                                                    if (property.id) {
                                                        router.push(`/properties/${property.id}`);
                                                        onClose();
                                                    }
                                                }}
                                                className="p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all group"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                            <span className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                                {property.name}
                                                            </span>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-mono font-medium">
                                                                {property.code}
                                                            </span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(property.status)}`}>
                                                                {statusLabel(property.status)}
                                                            </span>
                                                        </div>
                                                        {property.address && (
                                                            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-white/40 mb-1">
                                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                                <span className="text-xs truncate">{property.address}</span>
                                                            </div>
                                                        )}
                                                        {property.lotIndex && (
                                                            <div className="flex items-center gap-1.5 text-zinc-400 dark:text-white/30">
                                                                <Hash className="w-3 h-3 shrink-0" />
                                                                <span className="text-xs font-mono">{formatLotIndexPlainJoined(property.lotIndex)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 mt-1">
                                                        {property.address && (
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 text-zinc-400 dark:text-white/30 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                                                                title="在 Google Maps 開啟"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                        <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-white/20 group-hover:text-purple-400 dark:group-hover:text-purple-400 transition-colors" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {paginatedProperties.totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-3 pt-4 mt-2 text-sm text-zinc-500 dark:text-white/50 border-t border-zinc-100 dark:border-white/5">
                                            <button
                                                type="button"
                                                onClick={() => setPropertyPage((p) => Math.max(1, p - 1))}
                                                disabled={paginatedProperties.safePage <= 1}
                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-white" />
                                            </button>
                                            <span className="font-medium min-w-[3rem] text-center">
                                                {paginatedProperties.safePage} / {paginatedProperties.totalPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setPropertyPage((p) => Math.min(paginatedProperties.totalPages, p + 1))}
                                                disabled={paginatedProperties.safePage >= paginatedProperties.totalPages}
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">名稱</p>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{proprietor.name}</p>
                                </div>
                                {proprietor.englishName && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">英文名稱</p>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{proprietor.englishName}</p>
                                    </div>
                                )}
                                {proprietor.shortName && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">簡稱</p>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{proprietor.shortName}</p>
                                    </div>
                                )}
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">代碼</p>
                                    <p className="text-sm font-mono font-bold text-zinc-900 dark:text-white">{proprietor.code}</p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">性質</p>
                                    <p className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                        {proprietor.type === 'company' ? '公司' : '個人'}
                                    </p>
                                </div>
                                {proprietor.brNumber && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 sm:col-span-2">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">商業登記號碼</p>
                                        <p className="text-sm font-mono font-medium text-zinc-700 dark:text-white/70">{proprietor.brNumber}</p>
                                    </div>
                                )}
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 sm:col-span-2">
                                    <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">擁有類別</p>
                                    <p className="text-sm font-medium text-zinc-700 dark:text-white/70 capitalize">
                                        {proprietor.category.replace(/_/g, ' ')}
                                    </p>
                                </div>
                                {proprietor.createdAt && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 sm:col-span-2">
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">建立日期</p>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                            {new Date(proprietor.createdAt).toLocaleDateString('zh-HK', {
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
