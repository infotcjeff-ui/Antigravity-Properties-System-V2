'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useProperties, useProprietors, useRents, usePropertyWithRelationsQuery, useProprietorsQuery } from '@/hooks/useStorage';
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
} from 'lucide-react';

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

export default function PropertyDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { data: property, isLoading: loading } = usePropertyWithRelationsQuery(params.id as string);
    const { data: allProprietors = [] } = useProprietorsQuery();

    const proprietor = property?.proprietor || null;
    const rents = property?.rents || [];
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
                <h2 className="text-xl font-semibold text-white">Property Not Found</h2>
                <p className="mt-2">The property you are looking for does not exist.</p>
                <Link href="/dashboard/properties" className="mt-4 text-purple-400 hover:text-purple-300">
                    ← Back to Properties
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
                    <span>Back to Properties / 返回物業列表</span>
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
                    <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-24 h-24 text-white/20" />
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

                        {property.address && (
                            <div className="flex items-start gap-2 mt-4 text-zinc-600 dark:text-white/70">
                                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{property.address}</span>
                            </div>
                        )}

                        {/* Key Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                <p className="text-zinc-400 dark:text-white/40 text-sm">Type / 類型</p>
                                <p className="text-zinc-900 dark:text-white font-medium mt-1">{typeLabels[property.type]}</p>
                            </div>
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                <p className="text-zinc-400 dark:text-white/40 text-sm">Land Use / 土地用途</p>
                                <p className="text-zinc-900 dark:text-white font-medium mt-1">{landUseLabels[property.landUse]}</p>
                            </div>
                            {property.lotIndex && (
                                <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                    <p className="text-zinc-400 dark:text-white/40 text-sm">Lot Index / 物業地段</p>
                                    <p className="text-zinc-900 dark:text-white font-medium mt-1">{property.lotIndex}</p>
                                </div>
                            )}
                            {property.lotArea && (
                                <div className="bg-zinc-50 dark:bg-white/5 rounded-xl p-4 border border-zinc-100 dark:border-none">
                                    <p className="text-zinc-400 dark:text-white/40 text-sm">Lot Area / 地段面積</p>
                                    <p className="text-zinc-900 dark:text-white font-medium mt-1">{property.lotArea}</p>
                                </div>
                            )}
                        </div>

                        {/* Planning Permission */}
                        {property.hasPlanningPermission && (
                            <div className="mt-6 p-[15px] border-l-[3px] border-amber-500 bg-amber-500/5 rounded-r-xl">
                                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">最新規劃許可申請 / Property Application Permission</p>
                                <p className="text-zinc-700 dark:text-white/80 text-sm font-medium">{property.hasPlanningPermission}</p>
                            </div>
                        )}
                    </div>

                    {/* Proprietor */}
                    {proprietor && (
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Proprietor / 資產擁有方
                            </h2>
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
                        </div>
                    )}

                    {/* Rent History */}
                    {rents.length > 0 && (
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Rent History / 租務記錄
                            </h2>
                            <div className="space-y-3">
                                {rents.map((rent) => {
                                    // Handle both new and legacy rent data formats
                                    const startDate = rent.type === 'rent_out'
                                        ? (rent.rentOutStartDate || rent.startDate)
                                        : (rent.rentingStartDate || rent.startDate);
                                    const endDate = rent.type === 'rent_out'
                                        ? (rent.rentOutEndDate || rent.endDate)
                                        : (rent.rentingEndDate || rent.endDate);

                                    // Fix: Ensure proper date comparison
                                    const isExpired = endDate ? new Date(endDate).getTime() < new Date().getTime() : false;

                                    const monthlyRent = rent.type === 'rent_out'
                                        ? (rent.rentOutMonthlyRental || rent.amount || 0)
                                        : (rent.rentingMonthlyRental || rent.amount || 0);

                                    return (
                                        <div
                                            key={rent.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isExpired
                                                ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'
                                                : 'bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20'
                                                }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${rent.type === 'rent_out' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                        {rent.type === 'rent_out' ? '收租' : '交租'}
                                                    </span>
                                                    {isExpired && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                                                            已過期
                                                        </span>
                                                    )}
                                                    {/* Display Other Party Name */}
                                                    {(() => {
                                                        const otherParty = rent.tenant || rent.proprietor;
                                                        return otherParty ? (
                                                            <span className="text-zinc-700 dark:text-white/80 text-xs font-medium bg-zinc-100 dark:bg-white/10 px-2 py-0.5 rounded">
                                                                {otherParty.name}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                                <p className="text-zinc-500 dark:text-white/50 text-sm mt-1">
                                                    {startDate ? new Date(startDate).toLocaleDateString() : '-'} - {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                                                </p>
                                            </div>
                                            <p className="text-zinc-900 dark:text-white font-semibold">${(monthlyRent as any).toLocaleString()} /月</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Right Column - Map & Documents */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-6"
                >
                    {/* Map */}
                    {property.location && (
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                Location / 位置
                            </h2>
                            <div className="aspect-square rounded-xl overflow-hidden bg-white/5">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    style={{ border: 0 }}
                                    src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${property.location.lat},${property.location.lng}&zoom=15`}
                                    allowFullScreen
                                />
                            </div>
                            <p className="text-zinc-400 dark:text-white/40 text-xs mt-2">
                                📍 {property.location.lat.toFixed(6)}, {property.location.lng.toFixed(6)}
                            </p>
                        </div>
                    )}

                    {/* Geo Maps */}
                    {property.geoMaps && property.geoMaps.length > 0 && (
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Geo Maps / 地圖</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {property.geoMaps.map((map, idx) => (
                                    <img key={idx} src={map} alt={`Geo Map ${idx + 1}`} className="rounded-lg" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    {property.googleDrivePlanUrl && (
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 shadow-sm dark:shadow-none">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Documents / 文件
                            </h2>
                            <a
                                href={property.googleDrivePlanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-white/5 rounded-xl text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors border border-zinc-200 dark:border-none"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>View Plan on Google Drive</span>
                            </a>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
