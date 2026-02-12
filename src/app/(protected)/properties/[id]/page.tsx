'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePropertyWithRelationsQuery } from '@/hooks/useStorage';
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
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useLanguage } from '@/components/common/LanguageSwitcher';

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
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => isZh ? zh : en;
    const { data: property, isLoading: loading } = usePropertyWithRelationsQuery(params.id as string);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [selectedRent, setSelectedRent] = useState<Rent | null>(null);

    const proprietor = property?.proprietor || null;
    const tenant = property?.tenant || null;
    const rents = property?.rents || [];

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

            {/* Image Gallery */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative h-[300px] bg-zinc-100 dark:bg-white/5 rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10"
            >
                {property.images && property.images.length > 0 ? (
                    <>
                        <img
                            src={property.images[currentImageIndex]}
                            alt={`${property.name} - Image ${currentImageIndex + 1}`}
                            className="w-full h-full object-contain"
                        />

                        {/* Image Navigation */}
                        {property.images.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>

                                {/* Image Indicators */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                    {property.images.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentImageIndex(idx)}
                                            className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/40'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <ImageIcon className="w-16 h-16 text-zinc-300 dark:text-white/15" />
                        <p className="text-zinc-400 dark:text-white/30 text-sm">暫無。</p>
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                    <span className={`px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm ${statusColors[property.status]}`}>
                        {statusLabels[property.status]}
                    </span>
                </div>
            </motion.div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Details */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 space-y-6"
                >
                    {/* Title and Basic Info */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{property.name}</h1>
                        <p className="text-zinc-500 dark:text-white/50 mt-1">Code: {property.code}</p>

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
                                <p className="text-zinc-900 dark:text-white font-medium mt-1">{landUseLabels[property.landUse] || '暫無。'}</p>
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
                                    {property.lotArea || '暫無。'}
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

                    {/* Proprietor and Tenant - always show */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Proprietor */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-purple-500" />
                                {t('Proprietor', '資產擁有方')}
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

                    {/* Rent History - always show */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            {t('Rent History', '租務記錄')}
                        </h2>
                        {rents.length > 0 ? (
                            <div className="space-y-3">
                                {rents.map((rent) => {
                                    const otherParty = rent.type === 'rent_out' ? rent.tenant : rent.proprietor;
                                    const rentNumber = rent.type === 'rent_out' ? (rent.rentOutTenancyNumber || '-') : (rent.rentingNumber || '-');

                                    const startDate = rent.type === 'rent_out'
                                        ? (rent.rentOutStartDate || rent.startDate)
                                        : (rent.rentingStartDate || rent.startDate);
                                    const endDate = rent.type === 'rent_out'
                                        ? (rent.rentOutEndDate || rent.endDate)
                                        : (rent.rentingEndDate || rent.endDate);
                                    const monthlyRent = rent.type === 'rent_out'
                                        ? (rent.rentOutMonthlyRental || rent.amount || 0)
                                        : (rent.rentingMonthlyRental || rent.amount || 0);
                                    const isExpired = endDate ? new Date(endDate) < new Date() : false;

                                    return (
                                        <div
                                            key={rent.id}
                                            onClick={() => setSelectedRent(rent)}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] ${isExpired
                                                ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 hover:border-red-300 dark:hover:border-red-500/40'
                                                : 'bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20 hover:border-green-300 dark:hover:border-green-500/40'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="px-2.5 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30">
                                                    <span className="text-sm font-bold font-mono text-purple-700 dark:text-purple-300">
                                                        {rentNumber}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded text-xs ${rent.type === 'rent_out' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                                            }`}>
                                                            {rent.type === 'rent_out' ? '收租' : '交租'}
                                                        </span>
                                                        {isExpired && (
                                                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-500/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 animate-pulse">
                                                                {t('Expired', '已過期')}
                                                            </span>
                                                        )}
                                                        <span className="text-sm font-medium text-zinc-700 dark:text-white/80">
                                                            {otherParty?.name || '-'}
                                                        </span>
                                                    </div>
                                                    <p className="text-zinc-500 dark:text-white/50 text-xs mt-1">
                                                        {startDate ? new Date(startDate).toLocaleDateString() : '-'} - {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-zinc-900 dark:text-white font-semibold">${(monthlyRent as any).toLocaleString()} /月</p>
                                                <p className="text-zinc-400 dark:text-white/30 text-[10px]">{rent.location || rent.rentOutAddressDetail || '-'}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyPlaceholder />
                        )}
                    </div>
                </motion.div>

                {/* Right Column - Map & Documents */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-6"
                >
                    {/* Map - always show, uses address */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            {t('Location', '位置')}
                        </h2>
                        {property.address ? (
                            <>
                                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white/5">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        style={{ border: 0 }}
                                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(property.address)}&zoom=15`}
                                        allowFullScreen
                                    />
                                </div>
                                <p className="text-zinc-400 dark:text-white/40 text-xs mt-2">
                                    📍 {property.address}
                                </p>
                            </>
                        ) : (
                            <EmptyPlaceholder />
                        )}
                    </div>

                    {/* Geo Maps - always show */}
                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Map className="w-5 h-5" />
                            地理資訊圖
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

                    {/* Documents - always show */}
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
                </motion.div>
            </div>

            {/* Rent Detail Popup */}
            {selectedRent && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedRent(null)}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 w-full max-w-lg max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="px-3 py-2 rounded-xl bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30">
                                    <span className="text-base font-bold font-mono text-purple-700 dark:text-purple-300">
                                        {selectedRent.type === 'rent_out' ? (selectedRent.rentOutTenancyNumber || '-') : (selectedRent.rentingNumber || '-')}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                                        {t('Rent Details', '租約詳情')}
                                    </h3>
                                    <span className={`px-2 py-0.5 rounded text-xs ${selectedRent.type === 'rent_out' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                                        {selectedRent.type === 'rent_out' ? '收租' : '交租'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedRent(null)}
                                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-1">
                            {selectedRent.type === 'rent_out' ? (
                                <>
                                    <DetailRow label={t('Tenancy Number', '合約號碼')} value={selectedRent.rentOutTenancyNumber} />
                                    <DetailRow label={t('Monthly Rent', '月租')} value={formatCurrency(selectedRent.rentOutMonthlyRental)} />
                                    <DetailRow label={t('Listing Price', '放盤價')} value={formatCurrency(selectedRent.rentOutPricing)} />
                                    <DetailRow label={t('Periods', '期數')} value={selectedRent.rentOutPeriods} />
                                    <DetailRow label={t('Total Amount', '總額')} value={formatCurrency(selectedRent.rentOutTotalAmount)} />
                                    <DetailRow label={t('Start Date', '開始日期')} value={formatDate(selectedRent.rentOutStartDate)} />
                                    <DetailRow label={t('End Date', '結束日期')} value={formatDate(selectedRent.rentOutEndDate)} />
                                    <DetailRow label={t('Actual End Date', '實際結束日期')} value={formatDate(selectedRent.rentOutActualEndDate)} />
                                    <DetailRow label={t('Deposit Received', '按金')} value={formatCurrency(selectedRent.rentOutDepositReceived)} />
                                    <DetailRow label={t('Deposit Receive Date', '按金收取日期')} value={formatDate(selectedRent.rentOutDepositReceiveDate)} />
                                    <DetailRow label={t('Deposit Return Date', '按金退回日期')} value={formatDate(selectedRent.rentOutDepositReturnDate)} />
                                    <DetailRow label={t('Deposit Return Amount', '按金退回金額')} value={formatCurrency(selectedRent.rentOutDepositReturnAmount)} />
                                    <DetailRow label={t('Lessor', '出租人')} value={selectedRent.rentOutLessor} />
                                    <DetailRow label={t('Address Detail', '地址資料')} value={selectedRent.rentOutAddressDetail} />
                                    <DetailRow label={t('Status', '狀態')} value={selectedRent.rentOutStatus === 'listing' ? '放盤中' : selectedRent.rentOutStatus === 'renting' ? '出租中' : selectedRent.rentOutStatus === 'completed' ? '已完租' : selectedRent.rentOutStatus} />
                                    {selectedRent.tenant && <DetailRow label={t('Tenant', '承租人')} value={selectedRent.tenant.name} />}
                                    {selectedRent.rentOutDescription && (
                                        <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-white/10">
                                            <p className="text-xs text-zinc-400 dark:text-white/40 mb-1">{t('Description', '描述')}</p>
                                            <div className="text-sm text-zinc-700 dark:text-white/80 rich-text-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedRent.rentOutDescription) }} />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <DetailRow label={t('Rent Number', '租約號碼')} value={selectedRent.rentingNumber} />
                                    <DetailRow label={t('Reference Number', '對方租約號碼')} value={selectedRent.rentingReferenceNumber} />
                                    <DetailRow label={t('Monthly Rent', '月租')} value={formatCurrency(selectedRent.rentingMonthlyRental)} />
                                    <DetailRow label={t('Periods', '期數')} value={selectedRent.rentingPeriods} />
                                    <DetailRow label={t('Start Date', '開始日期')} value={formatDate(selectedRent.rentingStartDate)} />
                                    <DetailRow label={t('End Date', '結束日期')} value={formatDate(selectedRent.rentingEndDate)} />
                                    <DetailRow label={t('Deposit', '押金')} value={formatCurrency(selectedRent.rentingDeposit)} />
                                    {selectedRent.proprietor && <DetailRow label={t('Proprietor', '擁有方')} value={selectedRent.proprietor.name} />}
                                </>
                            )}
                            {selectedRent.notes && (
                                <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-white/10">
                                    <p className="text-xs text-zinc-400 dark:text-white/40 mb-1">{t('Notes', '備註')}</p>
                                    <p className="text-sm text-zinc-700 dark:text-white/80">{selectedRent.notes}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
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
