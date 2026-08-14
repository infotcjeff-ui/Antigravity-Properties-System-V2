'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePropertiesQuery } from '@/hooks/useStorage';
import type { Property } from '@/lib/db';
import PropertyCard from '@/components/properties/PropertyCard';
import PropertyMapDynamic from '@/components/properties/PropertyMapDynamic';
import Link from 'next/link';
import { Building2, Grid3X3, Map, List, Search, ChevronLeft, ChevronRight, ArrowUpFromLine, MapPin, Maximize2, Ruler, Tag, ArrowRight, X, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'grid' | 'list' | 'map';

const landUseLabels: Record<string, string> = {
    agr: '農業',
    ca: '自然保育區',
    os: '露天貯物',
    v: '鄉村式發展',
    ou: '其他指定用途',
    unknown: '未知',
    open_storage: '露天倉儲',
    residential_a: '住宅(甲)',
    open_space: '開放空間',
    village_dev: '鄉村式發展',
    conservation_area: '保育區',
    residential_c: '住宅(丙類)',
    recreation_use: '休憩用地',
};

function getLandUseDisplay(landUse?: string | null) {
    if (!landUse) return '未設定';
    const parts = landUse.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return '未設定';
    return parts.map(p => landUseLabels[p] || p).join('、');
}

function parseLotValues(lotIndex: string | null | undefined): string {
    if (!lotIndex?.trim()) return '';
    return lotIndex
        .split(/\n/)
        .map(part => {
            const t = part.trim();
            if (t.startsWith('{')) {
                try {
                    const obj = JSON.parse(t) as { v?: string };
                    return obj.v || '';
                } catch {
                    return t;
                }
            }
            return t;
        })
        .filter(value => value.startsWith('DD'))
        .join('、');
}

export default function RentalPage() {
    const { data: qProperties, isLoading: qLoading } = usePropertiesQuery({ bypassIsolation: true });
    const { isAuthenticated, user } = useAuth();
    const userDisplayName = user?.displayName || user?.username || '';
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [sortOption, setSortOption] = useState<'newest' | 'area_asc' | 'area_desc'>('newest');
    const ITEMS_PER_PAGE = 12;

    const getPropertyCreatedAtTime = (property: Property) => {
        const createdAt = property.createdAt;
        if (!createdAt) return 0;

        if (createdAt instanceof Date) {
            const time = createdAt.getTime();
            return Number.isNaN(time) ? 0 : time;
        }

        const time = new Date(createdAt).getTime();
        return Number.isNaN(time) ? 0 : time;
    };

    const properties = useMemo(() => {
        if (!qProperties) return [];
        const filtered = [...qProperties].filter(p => {
            const status = p.status || '';
            return status.split(',').map(s => s.trim()).includes('renting');
        });
        switch (sortOption) {
            case 'area_asc':
                return filtered.sort((a, b) => Number(a.lotArea || 0) - Number(b.lotArea || 0));
            case 'area_desc':
                return filtered.sort((a, b) => Number(b.lotArea || 0) - Number(a.lotArea || 0));
            default: // 'newest'
                return filtered.sort((a, b) => getPropertyCreatedAtTime(a) - getPropertyCreatedAtTime(b));
        }
    }, [qProperties, sortOption]);

    const filteredProperties = useMemo(() => {
        if (!searchQuery) return properties;
        const query = searchQuery.toLowerCase();
        return properties.filter(
            p =>
                p.name.toLowerCase().includes(query) ||
                p.code.toLowerCase().includes(query) ||
                p.address.toLowerCase().includes(query)
        );
    }, [properties, searchQuery]);

    useEffect(() => {
        setCurrentPage(1);
        if (viewMode === 'list') {
            setSelectedPropertyId(null);
        }
    }, [searchQuery]);

    useEffect(() => {
        if (viewMode === 'list' && filteredProperties.length > 0 && !selectedPropertyId) {
            setSelectedPropertyId(filteredProperties[0]?.id ?? null);
        }
    }, [viewMode, filteredProperties, selectedPropertyId]);

    const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
    const paginatedProperties = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProperties.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredProperties, currentPage]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="flex flex-col h-[calc(100dvh-7rem)] space-y-3 pb-1">
            <style jsx global>{`
                .rental-page-scroll::-webkit-scrollbar {
                    display: none;
                }
                .rental-page-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        <ArrowUpFromLine className="w-8 h-8" />
                        出租
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">
                        {userDisplayName ? `${userDisplayName}，` : ''}查看出租中的物業。
                    </p>
                </div>

                {/* Search */}
                <div className="relative" style={{ minWidth: '280px' }}>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isAuthenticated ? "搜尋出租物業..." : "登入以使用搜尋"}
                        disabled={!isAuthenticated}
                        className={`w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>

                {/* View Toggle */}
                <div className="flex items-center bg-zinc-100 dark:bg-white/5 rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${viewMode === 'grid'
                            ? 'bg-purple-500 text-white'
                            : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <Grid3X3 className="w-4 h-4" />
                        <span className="text-sm">網格</span>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${viewMode === 'list'
                            ? 'bg-purple-500 text-white'
                            : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <List className="w-4 h-4" />
                        <span className="text-sm">列表</span>
                    </button>
                    <button
                        onClick={() => isAuthenticated && setViewMode('map')}
                        className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'map'
                            ? 'bg-purple-500 text-white'
                            : isAuthenticated
                                ? 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white cursor-pointer'
                                : 'text-zinc-300 dark:text-white/20 cursor-not-allowed'
                            }`}
                        title={!isAuthenticated ? '請先登入以使用地圖模式' : ''}
                    >
                        <Map className="w-4 h-4" />
                        <span className="text-sm">地圖</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
            {qLoading ? (
                <div className="flex items-center justify-center" style={{ height: '100%' }}>
                    <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-10 h-10 rounded-full bg-purple-500"
                    />
                </div>
            ) : viewMode === 'grid' ? (
                <div className="flex-1 min-h-0 overflow-y-auto rental-page-scroll space-y-6 pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 content-start">
                        {paginatedProperties.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 dark:text-white/20 col-span-full">
                                <Building2 className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-xl font-medium text-zinc-500 dark:text-white/40">未有出租中的物業</p>
                                <p className="text-sm mt-2 opacity-70">狀態為「出租中」的物業將會顯示在這裡</p>
                            </div>
                        ) : (
                            paginatedProperties.map((property, index) => (
                                <PropertyCard
                                    key={property.id}
                                    property={property}
                                    index={index}
                                    basePath="/rental"
                                    showOnlyStatus="renting"
                                />
                            ))
                        )}
                    </div>

                    {/* Pagination UI */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4 pb-2 border-t border-zinc-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-zinc-900">
                            <button
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-1.5 mx-2">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    if (
                                        totalPages > 7 &&
                                        pageNum !== 1 &&
                                        pageNum !== totalPages &&
                                        Math.abs(pageNum - currentPage) > 2
                                    ) {
                                        if (Math.abs(pageNum - currentPage) === 3) {
                                            return <span key={pageNum} className="px-1 text-zinc-400">...</span>;
                                        }
                                        return null;
                                    }

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`min-w-10 h-10 rounded-xl font-medium cursor-pointer transition-all ${
                                                currentPage === pageNum
                                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                                    : 'text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            ) : viewMode === 'list' ? (
                    <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-0 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden h-full">
                    {/* Left: scrollable property list */}
                    <div className="w-full lg:w-2/5 xl:w-2/5 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-white/10 overflow-y-auto lg:h-auto max-h-[35vh] lg:max-h-none">
                        <div className="px-3 py-2 bg-zinc-50 dark:bg-white/5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-zinc-600 dark:text-white/60">
                                    {filteredProperties.length} 項出租
                                </p>
                                <div className="relative">
                                    <select
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                                        className="appearance-none pl-2 pr-7 py-1 text-xs bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                    >
                                        <option value="newest">最近新增</option>
                                        <option value="area_asc">面積 (小 &gt; 大)</option>
                                        <option value="area_desc">面積 (大 &gt; 小)</option>
                                    </select>
                                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-white/40 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        <div>
                            {filteredProperties.map((property, index) => (
                                <button
                                    key={property.id}
                                    onClick={() => setSelectedPropertyId(property.id ?? null)}
                                    className={`w-full text-left px-3 py-3 transition-all cursor-pointer ${
                                        selectedPropertyId === property.id
                                            ? 'bg-purple-500/5 dark:bg-purple-500/10 border-l-2 border-purple-500'
                                            : 'hover:bg-zinc-50 dark:hover:bg-white/5 border-l-2 border-transparent'
                                    }`}
                                >
                                    <div className="flex gap-3">
                                        {/* Thumbnail */}
                                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/5 shrink-0 flex items-center justify-center">
                                            {property.images && property.images.length > 0 ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={property.images[0]}
                                                    alt={property.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Building2 className="w-7 h-7 text-zinc-300 dark:text-white/20" />
                                            )}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-base font-semibold text-zinc-900 dark:text-white truncate">
                                                        {property.name}
                                                    </p>
                                                </div>
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 font-medium shrink-0">
                                                    出租中
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-2 text-sm text-zinc-500 dark:text-white/50">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">{property.address || '未設定地址'}</span>
                                            </div>
                                            {property.lotArea && (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-zinc-400 dark:text-white/40">
                                                    <Maximize2 className="w-3 h-3 shrink-0" />
                                                    <span>{property.lotArea} 平方呎</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: property detail panel */}
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                        {selectedPropertyId ? (
                            (() => {
                                const selected = filteredProperties.find(p => p.id === selectedPropertyId) ?? filteredProperties[0] ?? null;
                                if (!selected) return null;
                                const nextIndex = filteredProperties.findIndex(p => p.id === selected.id);
                                const hasImages = selected.images && selected.images.length > 0;
                                const nextProperty = filteredProperties[nextIndex + 1];
                                const prevProperty = filteredProperties[nextIndex - 1];
                                return (
                                    <>
                                        {/* Image Gallery - responsive height */}
                                        {hasImages ? (
                                            <div className="px-3 sm:px-4 pt-3 sm:pt-4 shrink-0">
                                                <div className="flex flex-col sm:flex-row gap-2 h-auto sm:h-[28vh] lg:h-[32vh]">
                                                    {/* Main image */}
                                                    <div
                                                        className="flex-1 relative rounded-xl overflow-hidden cursor-pointer group"
                                                        onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
                                                    >
                                                        <img
                                                            src={selected.images[0]}
                                                            alt={selected.name}
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                    </div>
                                                    {/* Side thumbnails */}
                                                    {selected.images.length > 1 && (
                                                        <div className="hidden sm:flex flex-col gap-2 w-20 sm:w-24 md:w-28 lg:w-32">
                                                            {selected.images.slice(1, 4).map((img, i) => {
                                                                const isLast = i === Math.min(selected.images!.length - 2, 2);
                                                                const remaining = selected.images!.length - 4;
                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="relative flex-1 rounded-xl overflow-hidden cursor-pointer group"
                                                                        onClick={() => { setGalleryIndex(i + 1); setGalleryOpen(true); }}
                                                                    >
                                                                        <img
                                                                            src={img}
                                                                            alt={`${selected.name} ${i + 2}`}
                                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                        />
                                                                        {isLast && remaining > 0 && (
                                                                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                                                                                <div className="text-white font-semibold text-base">+{remaining}</div>
                                                                                <div className="text-white/90 text-sm font-medium">查看所有</div>
                                                                            </div>
                                                                        )}
                                                                        <div className="absolute inset-0 group-hover:bg-black/10 transition-colors" />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="px-3 sm:px-4 pt-3 sm:pt-4 shrink-0">
                                                <div className="w-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center rounded-xl h-32 sm:h-40 lg:h-[32vh]">
                                                    <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-zinc-300 dark:text-white/10" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Property Details - scrollable */}
                                        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 flex flex-col gap-2.5 rental-page-scroll">
                                            {/* Address */}
                                            <div className="shrink-0">
                                                <p className="text-base text-zinc-600 dark:text-white/80 leading-snug">
                                                    地址 :{' '}
                                                    {selected.address ? (
                                                        <a
                                                            href={`https://www.google.com/maps/search/${encodeURIComponent(selected.address)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-purple-600 dark:text-purple-400 hover:underline"
                                                        >
                                                            {selected.address}
                                                        </a>
                                                    ) : (
                                                        '未設定'
                                                    )}
                                                </p>
                                            </div>

                                            {/* Lot Index - Rental Area Count */}
                                            {selected.lotIndex && (
                                                <div className="shrink-0">
                                                    <p className="text-base text-zinc-600 dark:text-white/80 leading-snug">
                                                        出租地段 : {parseLotValues(selected.lotIndex).split('、').filter(Boolean).length} 個
                                                    </p>
                                                </div>
                                            )}

                                            {/* Attributes row: Land Use | Area */}
                                            <div className="grid grid-cols-2 gap-2 shrink-0">
                                                <div className="flex items-center gap-2 px-3 py-3 bg-zinc-50 dark:bg-white/5 rounded-xl">
                                                    <Tag className="w-5 h-5 text-emerald-500 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-zinc-400 dark:text-white/40">土地用途</p>
                                                        <p className="text-base font-semibold text-zinc-700 dark:text-white/85 truncate">
                                                            {getLandUseDisplay(selected.landUse)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 px-3 py-3 bg-zinc-50 dark:bg-white/5 rounded-xl">
                                                    <Maximize2 className="w-5 h-5 text-amber-500 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-zinc-400 dark:text-white/40">場地總面積</p>
                                                        <p className="text-base font-semibold text-zinc-700 dark:text-white/85 truncate">
                                                            {selected.lotArea ? `${selected.lotArea}呎` : '未設定'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notes - constrained to remaining space */}
                                            {selected.notes && (
                                                <div className="flex-1 min-h-0 px-3 py-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl overflow-hidden">
                                                    <div className="min-w-0 flex-1 h-full">
                                                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">備註</p>
                                                        <p className="text-base text-amber-700 dark:text-amber-300/85 wrap-break-word mt-1 leading-relaxed overflow-hidden line-clamp-2">
                                                            {selected.notes.replace(/<[^>]*>/g, '')}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* If no notes, push button to bottom */}
                                            {!selected.notes && <div className="flex-1 min-h-0" />}

                                            {/* View Detail Button */}
                                            <Link
                                                href={`/rental/${selected.id}`}
                                                className="flex items-center justify-center gap-2 w-full py-3.5 bg-purple-500 hover:bg-purple-600 text-white text-base font-semibold rounded-xl transition-colors shrink-0"
                                            >
                                                查看詳情
                                                <ArrowRight className="w-5 h-5" />
                                            </Link>
                                        </div>

                                        {/* Navigation Footer */}
                                        <div className="px-3 py-2.5 border-t border-zinc-100 dark:border-white/5 bg-white dark:bg-zinc-900 shrink-0 flex items-center justify-between">
                                            <button
                                                onClick={() => prevProperty?.id && setSelectedPropertyId(prevProperty.id)}
                                                disabled={nextIndex === 0}
                                                className="flex items-center gap-1 px-3 py-2 text-base text-zinc-500 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                                上一項
                                            </button>
                                            <span className="text-base text-zinc-400 dark:text-white/30">
                                                {nextIndex + 1} / {filteredProperties.length}
                                            </span>
                                            <button
                                                onClick={() => nextProperty?.id && setSelectedPropertyId(nextProperty.id)}
                                                disabled={nextIndex === filteredProperties.length - 1}
                                                className="flex items-center gap-1 px-3 py-2 text-base text-zinc-500 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                            >
                                                下一項
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </>
                                );
                            })()
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-400 dark:text-white/20">
                                <Building2 className="w-20 h-20 mb-4 opacity-30" />
                                <p className="text-xl font-medium">選擇左側物业查看詳情</p>
                                <p className="text-base mt-2 opacity-60">點擊列表中的項目以預覽詳情</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : isAuthenticated ? (
                <PropertyMapDynamic
                            properties={filteredProperties}
                            onPropertyClick={(property) => {
                                setViewMode('list');
                                setSelectedPropertyId(property.id ?? null);
                            }}
                        />
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-zinc-400 dark:text-white/20">
                    <Map className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">請先登入以使用地圖模式</p>
                </div>
            )}
            </div>

            {/* Gallery Popup */}
            {galleryOpen && selectedPropertyId && (() => {
                const selected = filteredProperties.find(p => p.id === selectedPropertyId);
                if (!selected || !selected.images?.length) return null;
                return (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
                        onClick={(e) => { if (e.target === e.currentTarget) setGalleryOpen(false); }}
                    >
                        <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4 px-2">
                                <p className="text-white/60 text-sm font-medium">
                                    {galleryIndex + 1} / {selected.images.length}
                                </p>
                                <button
                                    onClick={() => setGalleryOpen(false)}
                                    className="p-2 text-white/60 hover:text-white transition-colors cursor-pointer"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            {/* Main image */}
                            <div className="relative flex-1 flex items-center justify-center">
                                <img
                                    src={selected.images[galleryIndex]}
                                    alt={`${selected.name} ${galleryIndex + 1}`}
                                    className="max-h-[75vh] max-w-full object-contain rounded-xl"
                                />
                                {selected.images.length > 1 && (
                                    <>
                                        <button
                                            onClick={() => setGalleryIndex(prev => prev === 0 ? selected.images!.length - 1 : prev - 1)}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors cursor-pointer"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setGalleryIndex(prev => prev === selected.images!.length - 1 ? 0 : prev + 1)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors cursor-pointer"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                            {/* Thumbnails strip */}
                            <div className="flex gap-2 mt-4 overflow-x-auto pb-2 px-2 justify-center">
                                {selected.images.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setGalleryIndex(i)}
                                        className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                            i === galleryIndex
                                                ? 'border-purple-500 opacity-100'
                                                : 'border-transparent opacity-50 hover:opacity-80'
                                        }`}
                                    >
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
