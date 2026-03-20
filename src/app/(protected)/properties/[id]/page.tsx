'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePropertyWithRelationsQuery } from '@/hooks/useStorage';
import { formatLotArea } from '@/lib/formatters';
import type { Property, Proprietor, Rent } from '@/lib/db';
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
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useRef } from 'react';
import DOMPurify from 'dompurify';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import RentDetailsModal from '@/components/properties/RentDetailsModal';
import SinglePropertyMapDynamic from '@/components/properties/SinglePropertyMapDynamic';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip } from '@heroui/react';

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
    const { user } = useAuth();
    const params = useParams();
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => isZh ? zh : en;
    const propertyId = params.id as string;
    const { data: property, isLoading: loading } = usePropertyWithRelationsQuery(propertyId);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);
    const [showGeoMaps, setShowGeoMaps] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    const [rentHistoryTab, setRentHistoryTab] = useState<'rent_out' | 'renting' | 'contract'>('rent_out');
    const [showNotesToggle, setShowNotesToggle] = useState(false);
    const notesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (notesRef.current) {
            // Check if height exceeds ~2 lines (approx 40-48px depending on font/lineheight)
            const isOverflowing = notesRef.current.scrollHeight > 48;
            setShowNotesToggle(isOverflowing);
        }
    }, [property?.notes]);

    const activeRentOut = property?.rents?.find((r: Rent) => r.type === 'rent_out' && ['listing', 'renting'].includes(r.rentOutStatus || ''));
    const activeRenting = property?.rents?.find((r: Rent) => r.type === 'renting');

    const proprietor = property?.proprietor || activeRenting?.proprietor || null;
    const tenant = property?.tenant || activeRentOut?.tenant || null;
    const rents = property?.rents || [];
    const contractRents = rents.filter((r: Rent) => r.type === 'contract');
    const rentOutRents = rents.filter((r: Rent) => r.type === 'rent_out');
    const rentingRents = rents.filter((r: Rent) => r.type === 'renting');

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
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <Building2 className="w-16 h-16 text-white/20 mb-4" />
                <h2 className="text-xl text-white/60">Property not found</h2>
                <Link href="/" className="mt-4 text-purple-400 hover:text-purple-300 transition-colors">
                    Go back to properties
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t('Back to Properties', '返回物業列表')}</span>
                </Link>
            </motion.div>

            {/* Location Map Banner */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative h-[300px] bg-zinc-100 dark:bg-white/5 rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10"
            >
                {property.location?.lat && property.location?.lng ? (
                    <SinglePropertyMapDynamic property={property} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <MapPin className="w-16 h-16 text-zinc-300 dark:text-white/15" />
                        <p className="text-zinc-400 dark:text-white/30 text-sm">暫無位置訊息。</p>
                    </div>
                )}

            </motion.div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* Left Column - Details */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 flex flex-col gap-6"
                >
                    {/* Title and Basic Info */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{property.name}</h1>
                                <p className="text-zinc-500 dark:text-white/50 mt-1">Code: {property.code}</p>
                            </div>
                            <span className={`px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm shadow-lg whitespace-nowrap ${statusColors[property.status]}`}>
                                {statusLabels[property.status]}
                            </span>
                        </div>

                        {property.address ? (
                            <div className="flex items-start gap-2 mt-4 text-zinc-600 dark:text-white/70">
                                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{property.address}</span>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 mt-4 text-zinc-400 dark:text-white/30">
                                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span className="italic">暫無。</span>
                            </div>
                        )}

                        {/* Key Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
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
                                <p className={`font-medium mt-1 ${property.lotIndex ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-white/30'}`}>
                                    {property.lotIndex || '暫無。'}
                                </p>
                            </div>
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                <p className="text-zinc-400 dark:text-white/40 text-sm">{t('Lot Area', '地段面積')}</p>
                                <p className={`font-medium mt-1 ${property.lotArea ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-white/30'}`}>
                                    {property.lotArea ? formatLotArea(property.lotArea) : '暫無。'}
                                </p>
                            </div>
                        </div>

                        {/* Notes Section - always show */}
                        <div className="mt-6 mb-4 p-[10px] border-l-[3px] border-purple-500 bg-purple-500/5 rounded-r-xl relative">
                            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">{t('Notes', '備註')}</p>
                            {property.notes ? (
                                <div className="relative">
                                    <div
                                        ref={notesRef}
                                        className={`text-zinc-700 dark:text-white/80 text-sm rich-text-content transition-all duration-300 ease-in-out overflow-hidden ${!isNotesExpanded && showNotesToggle ? 'max-h-[48px]' : 'max-h-[2000px]'}`}
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(property.notes) }}
                                    />
                                    {showNotesToggle && (
                                        <button
                                            onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                                            className="mt-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                            {isNotesExpanded ? (
                                                <><ChevronUp className="w-3 h-3" /> {t('Show Less', '收起')}</>
                                            ) : (
                                                <><ChevronDown className="w-3 h-3" /> {t('Show More', '顯示更多')}</>
                                            )}
                                        </button>
                                    )}
                                    {!isNotesExpanded && showNotesToggle && (
                                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-purple-500/[0.03] to-transparent pointer-events-none" />
                                    )}
                                </div>
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

                        {/* Planning Permission - always show */}
                        <div className="mt-6 p-[15px] border-l-[3px] border-amber-500 bg-amber-500/5 rounded-r-xl">
                            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">{t('Planning Permission', '最新規劃許可申請')}</p>
                            {property.hasPlanningPermission ? (
                                <p className="text-zinc-700 dark:text-white/80 text-sm font-medium">{property.hasPlanningPermission}</p>
                            ) : (
                                <p className="text-zinc-400 dark:text-white/30 text-sm text-center py-2">暫無。</p>
                            )}
                        </div>
                    </div>

                    {/* Proprietor & Tenant - always show */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Proprietor */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-purple-500" />
                                {t('Proprietor', '業主')}
                            </h2>
                            {proprietor ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                                        {proprietor.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-zinc-900 dark:text-white font-medium">{proprietor.name}</p>
                                        <p className="text-zinc-500 dark:text-white/50 text-sm">
                                            {proprietor.code} {proprietor.englishName ? `• ${proprietor.englishName}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <EmptyPlaceholder />
                            )}
                        </div>

                        {/* Tenant */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-500" />
                                {t('Tenant', '目前承租人')}
                            </h2>
                            {tenant ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                                        {tenant.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-zinc-900 dark:text-white font-medium">{tenant.name}</p>
                                        <p className="text-zinc-500 dark:text-white/50 text-sm">
                                            {tenant.code} {tenant.englishName ? `• ${tenant.englishName}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <EmptyPlaceholder />
                            )}
                        </div>
                    </div>

                    {/* Rent History - Tab: 收租 | 交租 | 合約 */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none flex-grow">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                {t('Rent History', '租務記錄')}
                            </h2>
                            <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/10 w-fit">
                            {(['rent_out', 'renting', 'contract'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setRentHistoryTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${rentHistoryTab === tab
                                        ? 'bg-white dark:bg-white/15 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'}`}
                                >
                                    {tab === 'rent_out' ? t('Rent Collection', '收租') : tab === 'renting' ? t('Rent Payment', '交租') : t('Contract Records', '合約')}
                                </button>
                            ))}
                            </div>
                        </div>

                        {(() => {
                            const list = rentHistoryTab === 'rent_out' ? rentOutRents : rentHistoryTab === 'renting' ? rentingRents : contractRents;
                            if (list.length === 0) return <EmptyPlaceholder />;
                            return (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[800px]">
                                        <div className="grid grid-cols-[1fr_2fr_1.5fr_2fr_1fr] gap-0 pb-3 border-b border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-900 dark:text-white">
                                            <div className="pr-4">{t('Number', '編號')}</div>
                                            <div className="px-4">{t('Property', '物業')}</div>
                                            <div className="px-4">{t('Tenant', '承租人')}</div>
                                            <div className="px-4">{t('Lease Term & Location', '租期及地點')}</div>
                                            <div className="pl-4">{t('Rent', '租金')}</div>
                                        </div>
                                        <div className="divide-y divide-zinc-200 dark:divide-white/10">
                                            {list.map((rent: Rent) => {
                                                const isRentOutOrContract = rent.type === 'rent_out' || rent.type === 'contract';
                                                const otherParty = isRentOutOrContract ? rent.tenant : rent.proprietor;
                                                const rentNumber = isRentOutOrContract ? (rent.rentOutTenancyNumber || '-') : (rent.rentingNumber || '-');
                                                const startDate = isRentOutOrContract ? (rent.rentOutStartDate || rent.startDate) : (rent.rentingStartDate || rent.startDate);
                                                const endDate = isRentOutOrContract ? (rent.rentOutEndDate || rent.endDate) : (rent.rentingEndDate || rent.endDate);
                                                const formatEnDate = (d: any) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                                                const periods = isRentOutOrContract ? rent.rentOutPeriods : rent.rentingPeriods;
                                                const monthlyRent = isRentOutOrContract ? (rent.rentOutMonthlyRental || rent.amount || 0) : (rent.rentingMonthlyRental || rent.amount || 0);
                                                const isExpired = endDate ? new Date(endDate) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
                                                const locationStr = isRentOutOrContract ? (rent.location || (rent as any).rentOutAddressDetail) : rent.location;
                                                return (
                                                    <div
                                                        key={rent.id}
                                                        className="grid grid-cols-[1fr_2fr_1.5fr_2fr_1fr] gap-0 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors items-stretch cursor-pointer"
                                                        onClick={() => setSelectedRent(rent)}
                                                    >
                                                        <div className="py-4 pr-4 flex flex-col justify-center">
                                                            <div className="text-zinc-700 dark:text-white/80 text-sm">{rentNumber}</div>
                                                            <div className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs mt-1 flex items-center w-fit" onClick={(e) => { e.stopPropagation(); setSelectedRent(rent); }}>
                                                                <ChevronRight className="w-3 h-3 mr-0.5" /> {t('View', '查看')}
                                                            </div>
                                                        </div>
                                                        <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center">
                                                            <div className="text-zinc-600 dark:text-white/70 text-sm whitespace-pre-wrap">{property.code} {property.name}</div>
                                                            <div className="text-zinc-900 dark:text-white font-bold text-sm mt-1">{property.lotIndex || '-'}</div>
                                                        </div>
                                                        <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center">
                                                            {otherParty ? (
                                                                <Tooltip
                                                                    content={
                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <User className="w-4 h-4 text-blue-500" />
                                                                                <span className="font-bold">{otherParty.name}</span>
                                                                                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">{otherParty.code}</span>
                                                                            </div>
                                                                            <div className="text-xs text-zinc-500 dark:text-white/60">英文名稱: <span className="text-zinc-900 dark:text-white text-[10px]">{otherParty.englishName || '-'}</span></div>
                                                                            <div className="text-xs text-zinc-500 dark:text-white/60 flex items-center justify-between">
                                                                                <span>類型: <span className="text-zinc-900 dark:text-white">{otherParty.type === 'company' ? '公司' : '個人'}</span></span>
                                                                                <span className="bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 dark:text-white/70">
                                                                                    {otherParty.category === 'group_company' ? '集團公司' : otherParty.category === 'joint_venture' ? '合資公司' : otherParty.category === 'managed_individual' ? '代管個體' : otherParty.category === 'external_landlord' ? '外部業主' : '承租人'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    }
                                                                    placement="top"
                                                                    className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 max-w-xs"
                                                                >
                                                                    <div className="text-sm font-medium text-purple-600 dark:text-purple-400 border-b border-dashed border-purple-300 dark:border-purple-600/50 cursor-pointer w-fit inline-block">{otherParty.name}</div>
                                                                </Tooltip>
                                                            ) : (
                                                                <div className="text-zinc-600 dark:text-white/70 text-sm">-</div>
                                                            )}
                                                        </div>
                                                        <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center">
                                                            <div className={`text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-zinc-600 dark:text-white/70'}`}>
                                                                {formatEnDate(startDate)}{startDate && endDate && ' ~ '}{formatEnDate(endDate)}{periods ? `(${periods}個月)` : ''}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {isExpired && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded font-medium">已過期</span>}
                                                                <span className="text-xs text-zinc-500 dark:text-white/40 truncate">{locationStr}</span>
                                                            </div>
                                                        </div>
                                                        <div className="py-4 pl-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center text-left">
                                                            <div className="text-zinc-800 dark:text-white text-sm whitespace-nowrap">${Number(monthlyRent).toLocaleString()}/月</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </motion.div>

                {/* Right Column - Gallery and Sensitive Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col gap-6"
                >
                    {/* Image Gallery Sidebar */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none flex-grow">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" />
                            {t('Gallery', '物業相簿')}
                        </h2>
                        <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-white/5 rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10">
                            {property.images && property.images.length > 0 && !imageError ? (
                                <>
                                    <img
                                        src={property.images[currentImageIndex]}
                                        alt={`${property.name} - Image ${currentImageIndex + 1}`}
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setLightboxImage(property.images[currentImageIndex])}
                                        onError={() => setImageError(true)}
                                    />

                                    {/* Image Navigation */}
                                    {property.images.length > 1 && (
                                        <>
                                            <button
                                                onClick={prevImage}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={nextImage}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                    <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-white/15" />
                                    <p className="text-zinc-400 dark:text-white/30 text-xs">暫無。</p>
                                </div>
                            )}
                        </div>
                        {property.images && property.images.length > 1 && (
                            <div className="flex justify-center gap-1.5 mt-3">
                                {property.images.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-white/20'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sensitive Info & Documents */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none flex-grow">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Map className="w-5 h-5" />
                            {t('Geographic Maps & Documents', '地理資訊圖及文件')}
                        </h2>

                        {!user ? (
                            <div className="aspect-video bg-zinc-100 dark:bg-white/5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-white/10 flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                                    <Map className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                                    {t('Please log in first', '請先登入')}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-white/40 mb-4 max-w-[250px]">
                                    {t('This section contains sensitive geographic information and documents. Please log in to view.', '此內容包含敏感地理資訊及相關文件，需登入後方可查看。')}
                                </p>
                                <Link
                                    href="/login"
                                    className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
                                >
                                    <User className="w-4 h-4" />
                                    {t('Log In', '前往登入')}
                                </Link>
                            </div>
                        ) : !showGeoMaps ? (
                            <div className="aspect-video bg-zinc-100 dark:bg-white/5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-white/10 flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
                                    <X className="w-6 h-6 text-yellow-500" />
                                </div>
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                                    {t('Sensitive Information', '敏感地理資料')}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-white/40 mb-4 max-w-[200px]">
                                    {t('This section contains sensitive geographic information and documents. Click to reveal.', '由於資料包含敏感地理訊息及相關文件，需手動點擊後方可查看。')}
                                </p>
                                <button
                                    onClick={() => setShowGeoMaps(true)}
                                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    {t('Show Content', '點擊查看內容')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Geo Maps */}
                                {property.geoMaps && property.geoMaps.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {property.geoMaps.map((map, idx) => (
                                            <img
                                                key={idx}
                                                src={map}
                                                alt={`Geo Map ${idx + 1}`}
                                                className="rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => setLightboxImage(map)}
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-zinc-50 dark:bg-white/5 rounded-lg border border-dashed border-zinc-200 dark:border-white/10">
                                        <p className="text-zinc-400 dark:text-white/30 text-xs">暫無地理資訊圖</p>
                                    </div>
                                )}

                                {/* Documents */}
                                <div className="pt-6 border-t border-zinc-100 dark:border-white/10">
                                    <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        {t('Documents', '相關文件')}
                                    </h3>
                                    {property.googleDrivePlanUrl ? (
                                        <a
                                            href={property.googleDrivePlanUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-white/5 rounded-lg text-xs text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors border border-zinc-200 dark:border-none"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span>{t('View Plan on Google Drive', '在 Google Drive 查看')}</span>
                                        </a>
                                    ) : (
                                        <div className="text-center py-4 bg-zinc-50 dark:bg-white/5 rounded-lg border border-dashed border-zinc-200 dark:border-white/10">
                                            <p className="text-zinc-400 dark:text-white/30 text-xs">{t('No documents available', '暫無文件')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {selectedRent && (
                <RentDetailsModal
                    rent={selectedRent}
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
