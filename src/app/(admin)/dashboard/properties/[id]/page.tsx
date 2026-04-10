'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    usePropertyWithRelationsQuery,
    useSubLandlordsQuery,
    useCurrentTenantsQuery,
} from '@/hooks/useStorage';
import {
    formatLotArea,
    formatLotIndexPlainJoined,
    formatRentHistoryLotCellText,
    proprietorCategoryLabelZh,
} from '@/lib/formatters';
import type { CurrentTenant, Property, Proprietor, Rent } from '@/lib/db';
import {
    compareRentOutForListNewestFirst,
    getRentOutCollectionDisplayPeriod,
    getRentOutLesseeDisplayLabel,
    getRentOutOrContractListNumber,
    resolvePropertyCurrentTenantDisplay,
} from '@/lib/rentPaymentDisplay';
import {
    ArrowLeft,
    Building2,
    MapPin,
    User,
    Calendar,
    ExternalLink,
    FileText,
    ChevronLeft,
    ChevronRight,
    X,
    Map,
    Image as ImageIcon,
    Users,
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import DOMPurify from 'dompurify';
import RentDetailsModal from '@/components/properties/RentDetailsModal';
import { Tooltip } from '@heroui/react';
import SinglePropertyMapDynamic from '@/components/properties/SinglePropertyMapDynamic';

/** 租務記錄表：業主／承租人（交租：tenant_id＝業主、proprietor_id＝承租人） */
function RentHistoryProprietorCell({ party }: { party?: Proprietor | null }) {
    if (!party?.name) {
        return <div className="text-zinc-600 dark:text-white/70 text-sm">-</div>;
    }
    return (
        <Tooltip
            content={
                <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-blue-500" />
                        <span className="font-bold">{party.name}</span>
                        <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">
                            {party.code}
                        </span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-white/60">
                        英文名稱:{' '}
                        <span className="text-zinc-900 dark:text-white text-[10px]">{party.englishName || '-'}</span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-white/60 flex items-center justify-between">
                        <span>
                            類型:{' '}
                            <span className="text-zinc-900 dark:text-white">{party.type === 'company' ? '公司' : '個人'}</span>
                        </span>
                        <span className="bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 dark:text-white/70">
                            {proprietorCategoryLabelZh(party.category, 'card')}
                        </span>
                    </div>
                </div>
            }
            placement="top"
            className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 max-w-xs"
        >
            <div
                className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-2 min-w-0 max-w-full block"
                title={party.name}
            >
                {party.name}
            </div>
        </Tooltip>
    );
}

/** 出租合約分頁：承租人與物業「現時租客」摘要一致（收租記錄優先於合約 FK） */
function RentHistoryLeaseOutContractLesseeCell({
    displayName,
    currentTenants,
    proprietorFromRent,
}: {
    displayName: string;
    currentTenants: CurrentTenant[];
    proprietorFromRent?: Proprietor | null;
}) {
    if (!displayName || displayName === '-') {
        return <div className="text-zinc-600 dark:text-white/70 text-sm">-</div>;
    }
    const dn = displayName.trim();
    if (proprietorFromRent?.name?.trim() === dn) {
        return <RentHistoryProprietorCell party={proprietorFromRent} />;
    }
    const ct = currentTenants.find((c) => c.name?.trim() === dn);
    const nameClass = 'text-sm font-medium text-zinc-900 dark:text-white line-clamp-2 min-w-0 max-w-full block';
    if (ct) {
        return (
            <Tooltip
                content={
                    <div className="flex flex-col gap-1.5 w-full">
                        <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-blue-500" />
                            <span className="font-bold">{ct.name}</span>
                            {ct.code ? (
                                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">
                                    {ct.code}
                                </span>
                            ) : null}
                        </div>
                        {ct.englishName ? (
                            <div className="text-xs text-zinc-500 dark:text-white/60">
                                公司名稱:{' '}
                                <span className="text-zinc-900 dark:text-white text-[10px]">{ct.englishName}</span>
                            </div>
                        ) : null}
                        {ct.tenancyNumber ? (
                            <div className="text-xs text-zinc-500 dark:text-white/60">出租號碼: {ct.tenancyNumber}</div>
                        ) : null}
                    </div>
                }
                placement="top"
                className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 max-w-xs"
            >
                <div className={nameClass} title={displayName}>
                    {displayName}
                </div>
            </Tooltip>
        );
    }
    return (
        <div className={nameClass} title={displayName}>
            {displayName}
        </div>
    );
}

const statusColors: Record<string, string> = {
    holding: 'bg-emerald-600/80 text-white border-emerald-500/50',
    renting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    sold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusLabels: Record<string, string> = {
    holding: '持有中',
    renting: '出租中',
    sold: '已售出',
    suspended: '已暫停',
};

const typeLabels: Record<string, string> = {
    group_asset: '集團資產',
    co_investment: '合作投資',
    external_lease: '外租物業',
    managed_asset: '代管資產',
};

type RentHistoryTabKey = 'rent_out' | 'renting' | 'contract_lease_in' | 'contract_lease_out';

const RENT_HISTORY_TAB_BUTTON: Record<
    RentHistoryTabKey,
    { active: string; inactive: string }
> = {
    rent_out: {
        active:
            'bg-white dark:bg-white/15 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200/70 dark:ring-emerald-500/30',
        inactive: 'text-zinc-600 dark:text-white/60 hover:text-emerald-800 dark:hover:text-emerald-300',
    },
    renting: {
        active:
            'bg-white dark:bg-white/15 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200/70 dark:ring-indigo-500/30',
        inactive: 'text-zinc-600 dark:text-white/60 hover:text-indigo-800 dark:hover:text-indigo-300',
    },
    contract_lease_in: {
        active:
            'bg-white dark:bg-white/15 text-violet-800 dark:text-violet-300 shadow-sm ring-1 ring-violet-200/80 dark:ring-violet-500/35',
        inactive: 'text-zinc-600 dark:text-white/60 hover:text-violet-900 dark:hover:text-violet-200',
    },
    contract_lease_out: {
        active:
            'bg-white dark:bg-white/15 text-amber-800 dark:text-amber-400 shadow-sm ring-1 ring-amber-200/80 dark:ring-amber-500/35',
        inactive: 'text-zinc-600 dark:text-white/60 hover:text-amber-900 dark:hover:text-amber-300',
    },
};

const landUseLabels: Record<string, string> = {
    agr: 'AGR 農業',
    ca: 'CA 自然保育區',
    os: 'OS 露天貯物',
    v: 'V 鄉村式發展',
    ou: 'OU 其他指定用途',
    unknown: '未知',
    open_storage: '露天倉儲',
    residential_a: '住宅(甲)',
    open_space: '開放空間',
    village_dev: '鄉村式發展',
    conservation_area: '保育區',
    residential_c: '住宅(丙類)',
    recreation_use: '休憩用地',
};

function EmptyPlaceholder() {
    return (
        <div className="flex items-center justify-center py-8">
            <p className="text-zinc-400 dark:text-white/30 text-sm">暫無。</p>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: any }) {
    if (value == null || value === '' || value === '-') return null;
    return (
        <div className="flex justify-between items-start gap-4 py-2 border-b border-zinc-50 dark:border-white/5 last:border-none">
            <span className="text-sm text-zinc-500 dark:text-white/50 whitespace-nowrap">{label}</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-white text-right">{String(value)}</span>
        </div>
    );
}

export default function PropertyDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => isZh ? zh : en;
    const propertyId = params.id as string;
    const { data: property, isLoading: loading } = usePropertyWithRelationsQuery(propertyId);
    const { data: subLandlords = [] } = useSubLandlordsQuery();
    const { data: currentTenants = [] } = useCurrentTenantsQuery();

    const activeRentOut = property?.rents?.find((r: Rent) => r.type === 'rent_out' && ['listing', 'renting'].includes(r.rentOutStatus || ''));
    const activeRenting = property?.rents?.find((r: Rent) => r.type === 'renting');

    const proprietor = property?.proprietor || activeRenting?.proprietor || null;
    const rents = property?.rents || [];
    const contractRents = rents.filter((r: Rent) => r.type === 'contract');
    const allRentOutRents = useMemo(
        () => [...rents.filter((r: Rent) => r.type === 'rent_out')].sort(compareRentOutForListNewestFirst).reverse(),
        [rents],
    );
    const allRentingRents = rents.filter((r: Rent) => r.type === 'renting');
    const allLeaseInContractRents = useMemo(
        () => contractRents.filter((c: Rent) => (c.rentOutStatus || c.status) === 'leasing_in'),
        [contractRents],
    );
    const allLeaseOutContractRents = useMemo(
        () => contractRents.filter((c: Rent) => (c.rentOutStatus || c.status) !== 'leasing_in'),
        [contractRents],
    );

    const rentOutRents = allRentOutRents;
    const rentingRents = allRentingRents;
    const leaseInContractRents = allLeaseInContractRents;
    const leaseOutContractRents = allLeaseOutContractRents;

    const rentHistoryAllLists: Record<RentHistoryTabKey, Rent[]> = {
        rent_out: allRentOutRents,
        renting: allRentingRents,
        contract_lease_in: allLeaseInContractRents,
        contract_lease_out: allLeaseOutContractRents,
    };

    const paginatedRentList = useMemo(() => {
        const all = rentHistoryAllLists[rentHistoryTab];
        const totalPages = Math.max(1, Math.ceil(all.length / RENT_HISTORY_PAGE_SIZE));
        const safePage = Math.min(Math.max(1, rentPage), totalPages);
        return {
            list: all.slice((safePage - 1) * RENT_HISTORY_PAGE_SIZE, safePage * RENT_HISTORY_PAGE_SIZE),
            totalPages,
            safePage,
        };
    }, [rentHistoryAllLists, rentHistoryTab, rentPage]);

    const subLandlordCard = useMemo(() => {
        if (!property) return null;
        const pool = [...(property.rents || [])]
            .filter((r) => r.type === 'contract' || r.type === 'rent_out')
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        for (const r of pool) {
            if (r.rentOutSubLandlordId) {
                const sl = subLandlords.find((s) => s.id === r.rentOutSubLandlordId);
                if (sl) return { name: sl.name, subtitle: sl.tenancyNumber?.trim() || '' };
            }
            if (r.rentOutSubLandlord?.trim()) {
                return { name: r.rentOutSubLandlord.trim(), subtitle: '' };
            }
        }
        return null;
    }, [property, subLandlords]);

    const propertyCurrentTenantDisplay = useMemo(
        () => resolvePropertyCurrentTenantDisplay(property, currentTenants, activeRentOut),
        [property, currentTenants, activeRentOut],
    );
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);
    const [imageError, setImageError] = useState(false);
    const [rentHistoryTab, setRentHistoryTab] = useState<RentHistoryTabKey>('rent_out');
    const [rentPage, setRentPage] = useState(1);
    const RENT_HISTORY_PAGE_SIZE = 5;
    const [mainTab, setMainTab] = useState<'overview' | 'location' | 'policy' | 'booking'>('overview');

    const mainTabs = [
        { id: 'overview' as const, en: 'Overview', zh: '概覽' },
        { id: 'location' as const, en: 'Location', zh: '位置' },
        { id: 'policy' as const, en: 'Planning', zh: '規劃' },
        { id: 'booking' as const, en: 'Geographic map', zh: '地理資訊圖' },
    ];

    const nextImage = () => {
        if (property?.images && property.images.length > 0) {
            setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
            setImageError(false);
        }
    };

    const prevImage = () => {
        if (property?.images && property.images.length > 0) {
            setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
            setImageError(false);
        }
    };

    const formatDate = (d: any) => d ? new Date(d).toLocaleDateString() : '-';
    const formatCurrency = (v: any) => v != null ? `$${Number(v).toLocaleString()}` : '-';

    if (loading) {
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

    if (!property) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/50">
                <Building2 className="w-16 h-16 mb-4" />
                <h2 className="text-xl font-semibold text-white">{t('Property not found', '找不到物業')}</h2>
                <p className="mt-2">{t('This property does not exist or was removed.', '查無此物業或已被移除。')}</p>
                <Link href="/dashboard/properties" className="mt-4 text-purple-400 hover:text-purple-300">
                    ← {t('Back to properties', '返回物業列表')}
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <Link
                    href="/dashboard/properties"
                    className="inline-flex items-center gap-2 text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t('Back to Properties', '返回物業列表')}</span>
                </Link>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-6 lg:gap-10 lg:items-stretch">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 w-full lg:h-[calc(100dvh-11rem)] lg:min-h-0 lg:max-h-[calc(100dvh-11rem)] rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5"
                >
                    {property.images && property.images.length > 0 && !imageError ? (
                        <>
                            <div className="relative w-full flex-1 min-h-[200px] lg:min-h-0 overflow-hidden">
                                <img
                                    src={property.images[currentImageIndex]}
                                    alt={`${property.name} - ${currentImageIndex + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                                    onClick={() => setLightboxImage(property.images[currentImageIndex])}
                                    onError={() => setImageError(true)}
                                />
                                {property.images.length > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={prevImage}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-10"
                                            aria-label="Previous"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={nextImage}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-10"
                                            aria-label="Next"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="shrink-0 flex gap-2 overflow-x-auto pb-2 px-2">
                                {property.images.map((url, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setCurrentImageIndex(idx);
                                            setImageError(false);
                                        }}
                                        className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${idx === currentImageIndex ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-900/20 dark:ring-white/20' : 'border-zinc-200 dark:border-white/15 opacity-70 hover:opacity-100'}`}
                                    >
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[200px]">
                            <ImageIcon className="w-16 h-16 text-zinc-300 dark:text-white/15" />
                            <p className="text-zinc-400 dark:text-white/30 text-sm">暫無。</p>
                        </div>
                    )}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="flex min-h-0 flex-col gap-5 min-w-0 lg:h-[calc(100dvh-11rem)] lg:max-h-[calc(100dvh-11rem)] lg:overflow-hidden"
                >
                    <div className="shrink-0 flex flex-col gap-5">
                    <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white leading-tight">{property.name}</h1>
                            <p className="text-sm text-zinc-500 dark:text-white/50 mt-1">
                                {t('Code', '編號')}: {property.code}
                            </p>
                        </div>
                        <span className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border shadow-sm whitespace-nowrap ${statusColors[property.status]}`}>
                            {statusLabels[property.status]}
                        </span>
                    </div>

                    {property.address ? (
                        <div className="flex items-start gap-2 text-zinc-600 dark:text-white/65 text-sm">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{property.address}</span>
                        </div>
                    ) : (
                        <div className="flex items-start gap-2 text-zinc-400 dark:text-white/35 text-sm">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="italic">暫無。</span>
                        </div>
                    )}

                    <div className="rounded-xl border border-zinc-200 dark:border-white/15 p-1 flex flex-wrap justify-center sm:justify-start gap-1 bg-zinc-50/80 dark:bg-white/[0.04]">
                        {mainTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setMainTab(tab.id)}
                                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${mainTab === tab.id
                                    ? 'bg-white dark:bg-white/15 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-white/10'
                                    : 'text-zinc-500 dark:text-white/55 hover:text-zinc-800 dark:hover:text-white'}`}
                            >
                                {t(tab.en, tab.zh)}
                            </button>
                        ))}
                    </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 -mr-0.5 [scrollbar-gutter:stable]">
                    <div className="flex flex-col gap-6 pb-4">
                        {mainTab === 'overview' && (
                            <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                <p className="text-zinc-400 dark:text-white/40 text-sm">{t('Type', '類型')}</p>
                                <p className="text-zinc-900 dark:text-white font-medium mt-1">{typeLabels[property.type] || '暫無。'}</p>
                            </div>
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                <p className="text-zinc-400 dark:text-white/40 text-sm">{t('Land Use', '土地用途')}</p>
                                <p className="text-zinc-900 dark:text-white font-medium mt-1">
                                    {property.landUse ? (() => { const parts = property.landUse.split(',').map(u => u.trim()).filter(Boolean); const last = parts[parts.length - 1]; return last ? (landUseLabels[last] || last) : '暫無。'; })() : '暫無。'}
                                </p>
                            </div>
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                <p className="text-zinc-400 dark:text-white/40 text-sm">{t('Lot Index', '物業地段')}</p>
                                <p className="font-medium mt-1 text-zinc-900 dark:text-white">
                                    {property.lotIndex
                                        ? formatLotIndexPlainJoined(property.lotIndex) || '暫無。'
                                        : '暫無。'}
                                </p>
                            </div>
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                <p className="text-zinc-400 dark:text-white/40 text-sm">{t('Lot Area', '地段面積')}</p>
                                <p className="font-medium mt-1 text-zinc-900 dark:text-white">
                                    {property.lotArea ? formatLotArea(property.lotArea) : '暫無。'}
                                </p>
                            </div>
                        </div>

                        {/* Notes Section - always show */}
                        <div className="mt-6 mb-4 p-[10px] border-l-[3px] border-purple-500 bg-purple-500/5 rounded-r-xl">
                            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">{t('Notes', '備註')}</p>
                            {property.notes ? (
                                <div
                                    className="text-zinc-700 dark:text-white/80 text-sm rich-text-content"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(property.notes) }}
                                />
                            ) : (
                                <p className="text-zinc-400 dark:text-white/30 text-sm text-center py-2">暫無。</p>
                            )}
                            <style jsx global>{`
                                .rich-text-content ul {
                                    list-style-type: disc;
                                    margin-left: 1.5rem;
                                    margin-top: 0.5rem;
                                    margin-bottom: 0.5rem;
                                }
                                .rich-text-content ol {
                                    list-style-type: decimal;
                                    margin-left: 1.5rem;
                                    margin-top: 0.5rem;
                                    margin-bottom: 0.5rem;
                                }
                                .rich-text-content p {
                                    margin-bottom: 0.5rem;
                                }
                                .rich-text-content a {
                                    color: #a855f7;
                                    text-decoration: underline;
                                }
                                .rich-text-content h1, .rich-text-content h2, .rich-text-content h3 {
                                    font-weight: bold;
                                    margin-top: 1rem;
                                    margin-bottom: 0.5rem;
                                }
                                .rich-text-content h1 { font-size: 1.25rem; }
                                .rich-text-content h2 { font-size: 1.125rem; }
                                .rich-text-content h3 { font-size: 1rem; }
                            `}</style>
                        </div>

                    {/* 業主、二房東、現時租客 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none min-w-0 overflow-hidden">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-purple-500" />
                                {t('Proprietor', '業主')}
                            </h2>
                            {proprietor ? (
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                                        {proprietor.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <p
                                            className="text-zinc-900 dark:text-white font-medium truncate"
                                            title={proprietor.name}
                                        >
                                            {proprietor.name}
                                        </p>
                                        {proprietor.code ? (
                                            <p
                                                className="text-zinc-500 dark:text-white/50 text-sm font-mono truncate"
                                                title={proprietor.code}
                                            >
                                                {proprietor.code}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <EmptyPlaceholder />
                            )}
                        </div>

                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none min-w-0 overflow-hidden">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                {t('Sub-landlord', '二房東')}
                            </h2>
                            {subLandlordCard ? (
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-semibold">
                                        {subLandlordCard.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <p
                                            className="text-zinc-900 dark:text-white font-medium truncate"
                                            title={subLandlordCard.name}
                                        >
                                            {subLandlordCard.name}
                                        </p>
                                        {subLandlordCard.subtitle ? (
                                            <p
                                                className="text-zinc-500 dark:text-white/50 text-sm font-mono truncate"
                                                title={subLandlordCard.subtitle}
                                            >
                                                {subLandlordCard.subtitle}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <EmptyPlaceholder />
                            )}
                        </div>

                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none min-w-0 overflow-hidden sm:col-span-2 lg:col-span-1">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-500" />
                                {t('Current tenant', '現時租客')}
                            </h2>
                            {propertyCurrentTenantDisplay ? (
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                                        {(propertyCurrentTenantDisplay.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <p
                                            className="text-zinc-900 dark:text-white font-medium truncate"
                                            title={propertyCurrentTenantDisplay.name || undefined}
                                        >
                                            {propertyCurrentTenantDisplay.name}
                                        </p>
                                        {propertyCurrentTenantDisplay.subtitle ? (
                                            <p
                                                className="text-zinc-500 dark:text-white/50 text-sm font-mono truncate"
                                                title={propertyCurrentTenantDisplay.subtitle}
                                            >
                                                {propertyCurrentTenantDisplay.subtitle}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <EmptyPlaceholder />
                            )}
                        </div>
                    </div>

                    {/* Rent History - Tab: 收租 | 交租 | 合約 */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                {t('Rent History', '租務記錄')}
                            </h2>
                            <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/10 w-fit max-w-full">
                                {(
                                    [
                                        ['rent_out', t('Rent Collection', '收租')] as const,
                                        ['renting', t('Rent Payment', '交租')] as const,
                                        ['contract_lease_in', t('Lease-in contract', '租賃合約')] as const,
                                        ['contract_lease_out', t('Lease-out contract', '出租合約')] as const,
                                    ] as const
                                ).map(([tab, label]) => {
                                    const styles = RENT_HISTORY_TAB_BUTTON[tab];
                                    const isActive = rentHistoryTab === tab;
                                    return (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => { setRentHistoryTab(tab); setRentPage(1); }}
                                            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                isActive ? styles.active : styles.inactive
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {(() => {
                            const { list: pageList, totalPages, safePage } = paginatedRentList;
                            if (pageList.length === 0) return <EmptyPlaceholder />;
                            const isRentingTab = rentHistoryTab === 'renting';
                            const partyHeader =
                                rentHistoryTab === 'rent_out'
                                    ? t('Current tenant', '現時租客')
                                    : rentHistoryTab === 'contract_lease_in'
                                      ? t('Proprietor', '業主')
                                      : t('Tenant', '承租人');
                            const historyRowGrid = isRentingTab
                                ? 'grid-cols-[2fr_4fr_2fr_4fr_2fr]'
                                : 'grid-cols-[1fr_2fr_1fr_2fr_1fr]';
                            return (
                                <div className="overflow-x-auto">
                                    <div className={isRentingTab ? 'min-w-[700px]' : 'min-w-[640px]'}>
                                        <div
                                            className={`grid ${historyRowGrid} gap-0 pb-3 border-b border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-900 dark:text-white`}
                                        >
                                            <div className="pr-4">{t('Number', '編號')}</div>
                                            <div className="px-4">{t('Property', '物業')}</div>
                                            {isRentingTab ? (
                                                <div className="px-4">{t('Proprietor', '業主')}</div>
                                            ) : (
                                                <div className="px-4">{partyHeader}</div>
                                            )}
                                            <div className="px-4">{t('Lease Term', '租期')}</div>
                                            <div className="pl-4">{t('Rent', '租金')}</div>
                                        </div>
                                        <div className="divide-y divide-zinc-200 dark:divide-white/10">
                                            {pageList.map((rent: Rent) => {
                                                const isRentOutOrContract = rent.type === 'rent_out' || rent.type === 'contract';
                                                const otherParty = isRentOutOrContract ? rent.tenant : rent.proprietor || rent.tenant;
                                                const rentOutLesseeLabel =
                                                    rent.type === 'rent_out' ? getRentOutLesseeDisplayLabel(rent) : '';
                                                const rentNumber =
                                                    rent.type === 'renting'
                                                        ? property.code?.trim() || '-'
                                                        : getRentOutOrContractListNumber(rent as Rent);
                                                const rentOutListPeriod =
                                                    rent.type === 'rent_out' ? getRentOutCollectionDisplayPeriod(rent) : null;
                                                const startDate =
                                                    rent.type === 'rent_out'
                                                        ? rentOutListPeriod?.start || rent.rentOutStartDate || rent.startDate
                                                        : isRentOutOrContract
                                                          ? rent.rentOutStartDate || rent.startDate
                                                          : rent.rentingStartDate || rent.startDate;
                                                const endDate =
                                                    rent.type === 'rent_out'
                                                        ? rentOutListPeriod?.end || rent.rentOutEndDate || rent.endDate
                                                        : isRentOutOrContract
                                                          ? rent.rentOutEndDate || rent.endDate
                                                          : rent.rentingEndDate || rent.endDate;
                                                const formatEnDate = (d: any) =>
                                                    d
                                                        ? new Date(d).toLocaleDateString('en-US', {
                                                              month: 'short',
                                                              day: 'numeric',
                                                              year: 'numeric',
                                                          })
                                                        : '';
                                                const periods = isRentOutOrContract ? rent.rentOutPeriods : rent.rentingPeriods;
                                                const periodsDisplay =
                                                    rent.type === 'rent_out' && startDate && endDate
                                                        ? Math.max(
                                                              1,
                                                              Math.round(
                                                                  (new Date(endDate as any).getTime() -
                                                                      new Date(startDate as any).getTime()) /
                                                                      (1000 * 60 * 60 * 24 * 30),
                                                              ),
                                                          )
                                                        : periods;
                                                const fmtYears = (m: number | null | undefined) => {
                                                    if (!m) return null;
                                                    const y = Math.floor(m / 12);
                                                    const r = m % 12;
                                                    if (y === 0) return `${r} 個月`;
                                                    if (r === 0) return `${y} 年`;
                                                    return `${y} 年 ${r} 個月`;
                                                };
                                                const monthlyRent = isRentOutOrContract
                                                    ? rent.rentOutMonthlyRental || rent.amount || 0
                                                    : rent.rentingMonthlyRental || rent.amount || 0;
                                                const partyForRentOut =
                                                    rent.type === 'rent_out'
                                                        ? rentOutLesseeLabel || otherParty?.name || '-'
                                                        : null;
                                                const rentLotRowText = formatRentHistoryLotCellText(property.lotIndex, rent);
                                                return (
                                                    <div
                                                        key={rent.id}
                                                        className={`grid ${historyRowGrid} gap-0 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors items-stretch cursor-pointer`}
                                                        onClick={() => setSelectedRent(rent)}
                                                    >
                                                        <div className="py-4 pr-4 flex flex-col justify-center">
                                                            <div className="text-zinc-700 dark:text-white/80 text-sm">{rentNumber}</div>
                                                            <div
                                                                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs mt-1 flex items-center w-fit"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedRent(rent);
                                                                }}
                                                            >
                                                                <ChevronRight className="w-3 h-3 mr-0.5" /> {t('View', '查看')}
                                                            </div>
                                                        </div>
                                                        <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center min-w-0 overflow-hidden">
                                                            <div
                                                                className="text-zinc-600 dark:text-white/70 text-sm truncate"
                                                                title={`${property.code} ${property.name}`.trim()}
                                                            >
                                                                {property.code} {property.name}
                                                            </div>
                                                            <div
                                                                className="text-zinc-900 dark:text-white font-bold text-sm mt-1 min-w-0 max-w-full truncate"
                                                                title={rentLotRowText || undefined}
                                                            >
                                                                {rentLotRowText || '-'}
                                                            </div>
                                                        </div>
                                                        {isRentingTab ? (
                                                            <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center min-w-0 overflow-hidden">
                                                                <RentHistoryProprietorCell party={rent.tenant ?? null} />
                                                            </div>
                                                        ) : (
                                                            <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center min-w-0 overflow-hidden">
                                                                {rent.type === 'rent_out' ? (
                                                                    partyForRentOut && partyForRentOut !== '-' ? (
                                                                        <RentHistoryLeaseOutContractLesseeCell
                                                                            displayName={partyForRentOut}
                                                                            currentTenants={currentTenants}
                                                                            proprietorFromRent={
                                                                                otherParty &&
                                                                                rentOutLesseeLabel === otherParty.name
                                                                                    ? otherParty
                                                                                    : null
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <div className="text-zinc-600 dark:text-white/70 text-sm">-</div>
                                                                    )
                                                                ) : rent.type === 'contract' &&
                                                                  rentHistoryTab === 'contract_lease_out' ? (
                                                                    <RentHistoryLeaseOutContractLesseeCell
                                                                        displayName={
                                                                            propertyCurrentTenantDisplay?.name ||
                                                                            otherParty?.name ||
                                                                            '-'
                                                                        }
                                                                        currentTenants={currentTenants}
                                                                        proprietorFromRent={otherParty ?? null}
                                                                    />
                                                                ) : otherParty ? (
                                                                    <Tooltip
                                                                        content={
                                                                            <div className="flex flex-col gap-1.5 w-full">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <User className="w-4 h-4 text-blue-500" />
                                                                                    <span className="font-bold">{otherParty.name}</span>
                                                                                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">
                                                                                        {otherParty.code}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-xs text-zinc-500 dark:text-white/60">
                                                                                    英文名稱:{' '}
                                                                                    <span className="text-zinc-900 dark:text-white text-[10px]">
                                                                                        {otherParty.englishName || '-'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-xs text-zinc-500 dark:text-white/60 flex items-center justify-between">
                                                                                    <span>
                                                                                        類型:{' '}
                                                                                        <span className="text-zinc-900 dark:text-white">
                                                                                            {otherParty.type === 'company' ? '公司' : '個人'}
                                                                                        </span>
                                                                                    </span>
                                                                                    <span className="bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 dark:text-white/70">
                                                                                        {proprietorCategoryLabelZh(otherParty.category, 'card')}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        }
                                                                        placement="top"
                                                                        className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 max-w-xs"
                                                                    >
                                                                        <div
                                                                            className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-2 min-w-0 max-w-full block"
                                                                            title={otherParty.name}
                                                                        >
                                                                            {otherParty.name}
                                                                        </div>
                                                                    </Tooltip>
                                                                ) : (
                                                                    <div className="text-zinc-600 dark:text-white/70 text-sm">-</div>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center min-w-0 overflow-hidden">
                                                            <div
                                                                className="text-sm text-zinc-600 dark:text-white/70"
                                                                title={
                                                                    `${formatEnDate(startDate)}${startDate && endDate ? ' ~ ' : ''}${formatEnDate(endDate)}${periodsDisplay ? ` (${periodsDisplay}個月)` : ''}` ||
                                                                    undefined
                                                                }
                                                            >
                                                                {formatEnDate(startDate)}
                                                                {startDate && endDate && ' ~ '}
                                                                {formatEnDate(endDate)}
                                                                {periodsDisplay ? ` (${fmtYears(periodsDisplay)})` : ''}
                                                            </div>
                                                        </div>
                                                        <div className="py-4 pl-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center text-left">
                                                            <div className="text-zinc-800 dark:text-white text-sm whitespace-nowrap">
                                                                ${Number(monthlyRent).toLocaleString()}/月
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-center gap-3 pt-3 text-sm text-zinc-500 dark:text-white/50">
                                                <button
                                                    type="button"
                                                    onClick={() => setRentPage((p) => Math.max(1, p - 1))}
                                                    disabled={safePage <= 1}
                                                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-white/5"
                                                >
                                                    ‹
                                                </button>
                                                <span>
                                                    {safePage} / {totalPages}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setRentPage((p) => Math.min(totalPages, p + 1))}
                                                    disabled={safePage >= totalPages}
                                                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-white/5"
                                                >
                                                    ›
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                            </>
                        )}

                        {mainTab === 'location' && (
                            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden bg-zinc-50 dark:bg-white/5">
                                <div className="h-[280px] sm:h-[320px] lg:h-[380px] relative">
                                    {property.location?.lat && property.location?.lng ? (
                                        <SinglePropertyMapDynamic property={property} />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                            <MapPin className="w-12 h-12 text-zinc-300 dark:text-white/15" />
                                            <p className="text-zinc-400 dark:text-white/30 text-sm">暫無位置訊息。</p>
                                        </div>
                                    )}
                                </div>
                                {property.address ? (
                                    <div className="p-4 text-sm text-zinc-600 dark:text-white/70 flex items-start gap-2 border-t border-zinc-200 dark:border-white/10">
                                        <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{property.address}</span>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {mainTab === 'policy' && (
                            <div className="p-4 border border-zinc-200 dark:border-white/10 border-l-[3px] border-l-amber-500 bg-amber-500/5 rounded-r-xl">
                                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">{t('Planning Permission', '最新規劃許可申請')}</p>
                                {property.hasPlanningPermission ? (
                                    <p className="text-zinc-700 dark:text-white/80 text-sm font-medium">{property.hasPlanningPermission}</p>
                                ) : (
                                    <p className="text-zinc-400 dark:text-white/30 text-sm text-center py-2">暫無。</p>
                                )}
                            </div>
                        )}

                        {mainTab === 'booking' && (
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Map className="w-5 h-5" />
                                        {t('Geographic maps', '地理資訊圖')}
                                    </h2>
                                    {property.geoMaps && property.geoMaps.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {property.geoMaps.map((map, idx) => (
                                                <img
                                                    key={idx}
                                                    src={map}
                                                    alt={`Geo Map ${idx + 1}`}
                                                    className="rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => setLightboxImage(map)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyPlaceholder />
                                    )}
                                </div>
                                <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5" />
                                        {t('Documents', '文件')}
                                    </h2>
                                    {property.googleDrivePlanUrl ? (
                                        <a
                                            href={property.googleDrivePlanUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-white/5 rounded-xl text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors border border-zinc-200 dark:border-none"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            <span>{t('View Plan on Google Drive', '在 Google Drive 查看')}</span>
                                        </a>
                                    ) : (
                                        <EmptyPlaceholder />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                </motion.div>
            </div>

            {selectedRent && (
                <RentDetailsModal
                    rent={selectedRent}
                    property={property}
                    onClose={() => setSelectedRent(null)}
                />
            )}

            {/* Lightbox Overlay */}
            {lightboxImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                        onClick={() => setLightboxImage(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={lightboxImage}
                        alt="Geo Map Fullscreen"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </motion.div>
            )}
        </div>
    );
}
