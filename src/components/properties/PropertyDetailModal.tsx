'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    X,
    Building2,
    MapPin,
    User,
    Calendar,
    ExternalLink,
    FileText,
    ChevronLeft,
    ChevronRight,
    Map,
    Image as ImageIcon
} from 'lucide-react';
import type { Property, Rent } from '@/lib/db';
import { formatLotArea, proprietorCategoryLabelZh } from '@/lib/formatters';
import LotIndexDisplay from '@/components/properties/LotIndexDisplay';
import { usePropertyWithRelationsByNameQuery, usePropertyWithRelationsQuery } from '@/hooks/useStorage';
import DOMPurify from 'dompurify';
import { BentoCard } from '@/components/layout/BentoGrid';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import RentDetailsModal from '@/components/properties/RentDetailsModal';
import { Tooltip } from '@heroui/react';
import SinglePropertyMapDynamic from '@/components/properties/SinglePropertyMapDynamic';
import { getRentCollectionPayListStatus } from '@/lib/rentPaymentDisplay';

interface PropertyDetailModalProps {
    /** 顯示用／無 ID 時後備查詢 */
    propertyName: string;
    /** 有則優先：與列表租約的 property_id 一致，避免同名物業取錯筆導致租約列表為空 */
    propertyId?: string;
    onClose: () => void;
}

const statusColors: Record<string, string> = {
    holding: 'bg-emerald-600/80 text-white border-emerald-500/50',
    /** 物業「出租中」：與「持有中」綠色區隔，採琥珀色系 */
    renting: 'bg-amber-500/90 text-amber-950 border-amber-400/80 dark:bg-amber-500/25 dark:text-amber-100 dark:border-amber-400/50',
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

function DetailRow({ label, value }: { label: string; value: any }) {
    if (value == null || value === '' || value === '-') return null;
    return (
        <div className="flex justify-between items-start gap-4 py-2 border-b border-zinc-50 dark:border-white/5 last:border-none">
            <span className="text-sm text-zinc-500 dark:text-white/50 whitespace-nowrap">{label}</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-white text-right">{String(value)}</span>
        </div>
    );
}

export default function PropertyDetailModal({ propertyName, propertyId, onClose }: PropertyDetailModalProps) {
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => isZh ? zh : en;
    const { data: propertyById, isLoading: loadingById } = usePropertyWithRelationsQuery(propertyId ?? '');
    const { data: propertyByName, isLoading: loadingByName } = usePropertyWithRelationsByNameQuery(
        propertyId ? '' : propertyName
    );
    const property = propertyId ? propertyById : propertyByName;
    const isLoading = propertyId ? loadingById : loadingByName;
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);

    const rentOutRents = useMemo(() =>
        (property?.rents || []).filter(r => r.type === 'rent_out'),
        [property?.rents]
    );

    const rentingRents = useMemo(() =>
        (property?.rents || []).filter(r => r.type === 'renting'),
        [property?.rents]
    );

    const contractRents = useMemo(
        () => (property?.rents || []).filter(r => r.type === 'contract'),
        [property?.rents]
    );

    const renderRentTable = (records: Rent[]) => {
        if (records.length === 0) {
            return (
                <div className="p-8 text-center bg-zinc-50 dark:bg-white/5 rounded-3xl text-zinc-400 dark:text-white/30 italic text-sm border-2 border-dashed border-zinc-200 dark:border-white/5">
                    尚未有相關記錄
                </div>
            );
        }

        return (
            <div className="overflow-x-auto">
                <div className="min-w-[780px]">
                    <div className="grid grid-cols-[1fr_2fr_1.5fr_2fr_0.9fr_1fr] gap-0 pb-3 border-b border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-900 dark:text-white">
                        <div className="pr-4">{t('Number', '編號')}</div>
                        <div className="px-4">{t('Property', '物業')}</div>
                        <div className="px-4">{t('Tenant', '承租人')}</div>
                        <div className="px-4">{t('Lease Term & Location', '租期及地點')}</div>
                        <div className="px-4">{t('Payment status', '繳付狀態')}</div>
                        <div className="pl-4">{t('Rent', '租金')}</div>
                    </div>
                    <div className="divide-y divide-zinc-200 dark:divide-white/10">
                        {records.map((rent: any) => {
                            /** 收租：承租人為 tenant；交租：業主存 tenant_id（與 RentModal 一致） */
                            const otherParty =
                                rent.type === 'rent_out'
                                    ? rent.tenant
                                    : rent.type === 'renting'
                                      ? rent.tenant
                                      : rent.proprietor;
                            const rentNumber =
                                rent.type === 'rent_out'
                                    ? (rent.rentOutTenancyNumber || '-')
                                    : (property?.code?.trim() || '-');

                            const startDate = rent.type === 'rent_out'
                                ? (rent.rentOutStartDate || rent.startDate)
                                : (rent.rentingStartDate || rent.startDate);
                            const endDate = rent.type === 'rent_out'
                                ? (rent.rentOutEndDate || rent.endDate)
                                : (rent.rentingEndDate || rent.endDate);

                            const formatEnDate = (d: any) => {
                                if (!d) return '';
                                const date = new Date(d);
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            };
                            const periods = rent.type === 'rent_out' ? rent.rentOutPeriods : rent.rentingPeriods;

                            const monthlyRent = rent.type === 'rent_out'
                                ? (rent.rentOutMonthlyRental || rent.amount || 0)
                                : (rent.rentingMonthlyRental || rent.amount || 0);

                            const isExpired = endDate ? new Date(endDate) < new Date(new Date().setHours(0, 0, 0, 0)) : false;

                            const payListStatus = getRentCollectionPayListStatus(rent);

                            return (
                                <div
                                    key={rent.id}
                                    className="grid grid-cols-[1fr_2fr_1.5fr_2fr_0.9fr_1fr] gap-0 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors group items-stretch cursor-pointer"
                                    onClick={() => setSelectedRent(rent)}
                                >
                                    <div className="py-4 pr-4 flex flex-col justify-center">
                                        <div className="text-zinc-700 dark:text-white/80 text-sm">{rentNumber}</div>
                                        <div className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs mt-1 flex items-center transition-colors w-fit">
                                            <ChevronRight className="w-3 h-3 mr-0.5" /> {t('View', '查看')}
                                        </div>
                                    </div>
                                    <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center">
                                        <div className="text-zinc-600 dark:text-white/70 text-sm whitespace-pre-wrap">{property?.code} {property?.name}</div>
                                        <div className="text-zinc-900 dark:text-white font-bold text-sm mt-1">{property?.lotIndex || '-'}</div>
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
                                                        <div className="text-xs text-zinc-500 dark:text-white/60">
                                                            英文名稱: <span className="text-zinc-900 dark:text-white text-[10px]">{otherParty.englishName || '-'}</span>
                                                        </div>
                                                        <div className="text-xs text-zinc-500 dark:text-white/60 flex items-center justify-between">
                                                            <span>類型: <span className="text-zinc-900 dark:text-white">{otherParty.type === 'company' ? '公司' : '個人'}</span></span>
                                                            <span className="bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 dark:text-white/70">
                                                                {proprietorCategoryLabelZh(otherParty.category, 'card')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                }
                                                placement="top"
                                                className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 max-w-xs"
                                            >
                                                <div className="text-sm font-medium text-purple-600 dark:text-purple-400 border-b border-dashed border-purple-300 dark:border-purple-600/50 cursor-pointer w-fit inline-block">
                                                    {otherParty.name}
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <div className="text-zinc-600 dark:text-white/70 text-sm">{rent.type === 'renting' ? '(暫缺)' : '-'}</div>
                                        )}
                                    </div>
                                    <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center">
                                        <div className={`text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-zinc-600 dark:text-white/70'}`}>
                                            {formatEnDate(startDate)}{startDate && endDate && ' ~ '}{formatEnDate(endDate)}{periods ? `(${periods}個月)` : ''}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {isExpired && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded font-medium">已過期</span>}
                                            <span className="text-xs text-zinc-500 dark:text-white/40 truncate">
                                                {rent.type === 'rent_out' ? (rent.location || rent.rentOutAddressDetail) : rent.location}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="py-4 px-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center">
                                        {payListStatus === 'paid' ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold w-fit bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-500/35">
                                                已繳付
                                            </span>
                                        ) : (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold w-fit bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/15">
                                                未繳付
                                            </span>
                                        )}
                                    </div>
                                    <div className="py-4 pl-4 border-l border-dashed border-zinc-200 dark:border-white/10 flex flex-col justify-center text-left">
                                        <div className="text-zinc-800 dark:text-white text-sm whitespace-nowrap">${(monthlyRent as any).toLocaleString()}/月</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const nextImage = () => {
        if (property?.images && property.images.length > 0) {
            setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
        }
    };

    const prevImage = () => {
        if (property?.images && property.images.length > 0) {
            setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-[#1a1a2e] w-full max-w-5xl lg:max-w-6xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">物業詳情</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/50">{property?.name ?? propertyName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center py-24">
                        <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            className="w-12 h-12 rounded-full bg-purple-500"
                        />
                    </div>
                ) : property ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Gallery and Basic Info */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Gallery */}
                            <div className="relative h-64 md:h-80 bg-zinc-100 dark:bg-white/5 rounded-3xl overflow-hidden border border-zinc-200 dark:border-white/10">
                                {property.images && property.images.length > 0 ? (
                                    <>
                                        <img
                                            src={property.images[currentImageIndex]}
                                            alt={`${property.name} - Image ${currentImageIndex + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        {property.images.length > 1 && (
                                            <>
                                                <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors">
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors">
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-300 dark:text-white/15">
                                        <ImageIcon className="w-12 h-12" />
                                        <p className="text-sm">暫無圖片</p>
                                    </div>
                                )}
                                <div className="absolute top-4 right-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${statusColors[property.status]}`}>
                                        {statusLabels[property.status]}
                                    </span>
                                </div>
                            </div>

                            {/* Basic Details */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{property.name}</h3>
                                    <p className="text-zinc-500 dark:text-white/50">Code: {property.code}</p>
                                    <div className="flex items-start gap-2 mt-4 text-zinc-600 dark:text-white/70">
                                        <MapPin className="w-5 h-5 flex-shrink-0 text-purple-500" />
                                        <span className="text-sm">{property.address || '尚未填寫地址'}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-none">
                                        <p className="text-zinc-400 dark:text-white/40 text-xs">類型</p>
                                        <p className="text-zinc-900 dark:text-white font-medium text-sm mt-1">{typeLabels[property.type]}</p>
                                    </div>
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-none">
                                        <p className="text-zinc-400 dark:text-white/40 text-xs">土地用途</p>
                                        <p className="text-zinc-900 dark:text-white font-medium text-sm mt-1">
                                            {property.landUse ? property.landUse.split(',').map(u => landUseLabels[u.trim()] || u.trim()).join(', ') : '未知'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-none">
                                        <p className="text-zinc-400 dark:text-white/40 text-xs">物業地段</p>
                                        <div className="mt-1">
                                            <LotIndexDisplay lotIndex={property.lotIndex} />
                                        </div>
                                    </div>
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-none">
                                        <p className="text-zinc-400 dark:text-white/40 text-xs">地段面積</p>
                                        <p className="text-zinc-900 dark:text-white font-medium text-sm mt-1">{formatLotArea(property.lotArea)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Extra Sections */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Notes and Planning */}
                            <div className="space-y-6">
                                <div className="p-5 border-l-4 border-purple-500 bg-purple-500/5 rounded-r-2xl">
                                    <h4 className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-2">備註</h4>
                                    {property.notes ? (
                                        <div
                                            className="text-zinc-700 dark:text-white/80 text-sm prose dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(property.notes) }}
                                        />
                                    ) : (
                                        <p className="text-zinc-400 text-sm">暫無備註</p>
                                    )}
                                </div>

                                <div className="p-5 border-l-4 border-amber-500 bg-amber-500/5 rounded-r-2xl">
                                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">最新規劃許可申請</h4>
                                    <p className="text-zinc-700 dark:text-white/80 text-sm">
                                        {property.hasPlanningPermission || '暫無規劃許可申請記錄'}
                                    </p>
                                </div>
                            </div>

                            {/* Map and Documents */}
                            <div className="space-y-6">
                                <div className="bg-zinc-50 dark:bg-white/5 rounded-3xl p-5 border border-zinc-100 dark:border-white/5">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white mb-4">
                                        <Map className="w-4 h-4 text-emerald-500" />
                                        位置資訊
                                    </h4>
                                    {property.location?.lat && property.location?.lng ? (
                                        <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-white/5">
                                            <SinglePropertyMapDynamic property={property} />
                                        </div>
                                    ) : (
                                        <div className="h-32 flex items-center justify-center text-zinc-400 text-sm italic">尚未提供地址以顯示地圖</div>
                                    )}
                                </div>

                                {property.googleDrivePlanUrl && (
                                    <a
                                        href={property.googleDrivePlanUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-white/5 rounded-2xl text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors border border-zinc-200 dark:border-none"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-blue-500" />
                                            <span className="text-sm font-medium">查看 Google Drive 文件</span>
                                        </div>
                                        <ExternalLink className="w-4 h-4 text-zinc-400" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Rent Records */}
                        <div className="space-y-10">
                            <div>
                                <h4 className="flex items-center gap-2 text-lg font-bold text-amber-600 dark:text-amber-400 mb-4 px-1">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                                    合約記錄 (Contract Records)
                                </h4>
                                {contractRents.length === 0 ? (
                                    <div className="p-8 text-center bg-zinc-50 dark:bg-white/5 rounded-3xl text-zinc-400 dark:text-white/30 italic text-sm border-2 border-dashed border-zinc-200 dark:border-white/5">
                                        尚未有相關記錄
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {contractRents.map((c) => {
                                            const st = c.rentOutStatus || 'listing';
                                            const stLabel =
                                                st === 'renting' ? '出租中' :
                                                    st === 'listing' ? '放盤中' :
                                                        st === 'leasing_in' ? '租入中' :
                                                        st === 'completed' ? '已完租' : String(st);
                                            const contractStatusBadgeClass =
                                                st === 'leasing_in'
                                                    ? 'bg-violet-100 dark:bg-violet-500/25 text-violet-900 dark:text-violet-100 border border-violet-300/70 dark:border-violet-500/45'
                                                    : st === 'renting'
                                                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-300/70 dark:border-emerald-500/40'
                                                      : st === 'listing'
                                                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-500/35'
                                                        : st === 'completed'
                                                          ? 'bg-zinc-200/80 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-300/60 dark:border-white/15'
                                                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25';
                                            const cardShellClass =
                                                st === 'leasing_in'
                                                    ? 'border-violet-200/80 dark:border-violet-500/30 bg-violet-50/40 dark:bg-violet-500/5 hover:bg-violet-50/70 dark:hover:bg-violet-500/10'
                                                    : st === 'renting'
                                                      ? 'border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/5 hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10'
                                                      : 'border-amber-200/80 dark:border-amber-500/25 bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-50 dark:hover:bg-amber-500/10';
                                            const sd = c.rentOutStartDate ? new Date(c.rentOutStartDate).toLocaleDateString() : '-';
                                            const ed = c.rentOutEndDate ? new Date(c.rentOutEndDate).toLocaleDateString() : '-';
                                            const ownerLine =
                                                (c as any).tenant?.name?.trim?.() ||
                                                (c as any).proprietor?.name?.trim?.() ||
                                                (c as any).rentOutLessor?.trim?.() ||
                                                '';
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setSelectedRent(c)}
                                                    className={`text-left p-4 rounded-2xl border transition-colors ${cardShellClass}`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="font-mono font-semibold text-zinc-900 dark:text-white text-sm">
                                                            {c.rentOutTenancyNumber || '—'}
                                                        </span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${contractStatusBadgeClass}`}>
                                                            {stLabel}
                                                        </span>
                                                    </div>
                                                    {ownerLine ? (
                                                        <p className="text-xs text-zinc-500 dark:text-white/50 mt-1 truncate" title={ownerLine}>
                                                            業主：{ownerLine}
                                                        </p>
                                                    ) : null}
                                                    <p className="text-xs text-zinc-400 dark:text-white/40 mt-2">
                                                        {sd} — {ed}
                                                        {c.rentOutMonthlyRental != null
                                                            ? ` · ${c.currency || 'HKD'} ${Number(c.rentOutMonthlyRental).toLocaleString()}/月`
                                                            : ''}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="flex items-center gap-2 text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-4 px-1">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                    收租記錄 (Rent Out Records)
                                </h4>
                                {renderRentTable(rentOutRents)}
                            </div>

                            <div>
                                <h4 className="flex items-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-4 px-1">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                                    交租記錄 (Renting Records)
                                </h4>
                                {renderRentTable(rentingRents)}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-24 text-zinc-400">
                        <Building2 className="w-16 h-16 mb-4 opacity-20" />
                        <p>找不到該物業資料</p>
                    </div>
                )}

                {/* Footer Action */}
                <div className="p-6 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                        關閉
                    </button>
                </div>
            </motion.div>

            {selectedRent && (
                <RentDetailsModal
                    rent={selectedRent}
                    property={property ?? undefined}
                    onClose={() => setSelectedRent(null)}
                />
            )}
        </div>
    );
}
