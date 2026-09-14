'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePropertiesQuery } from '@/hooks/useStorage';
import type { Property } from '@/lib/db';
import { parsePropertyLotSegments, parseLotEntries } from '@/lib/formatters';
import PropertyCard from '@/components/properties/PropertyCard';
import PropertyMapDynamic from '@/components/properties/PropertyMapDynamic';
import Link from 'next/link';
import { Building2, Grid3X3, Map, List, Search, ChevronLeft, ChevronRight, MapPin, Maximize2, Ruler, Tag, ArrowRight, X, ChevronDown, Hash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'grid' | 'list' | 'map';

function getLandUseDisplay(_landUse?: string | null) {
    // 前端顯示需求: 無論資料庫 landUse 是何值, 統一顯示「OS 露天貯物」。
    // 不影響 database 與原始 landUse 欄位。
    return 'OS 露天貯物';
}

/**
 * 取得物業的所有地段清單（與其他頁面地段顯示邏輯一致）。
 */
function getPropertyLots(property: Property): string[] {
    return parsePropertyLotSegments(property.lotIndex);
}

/**
 * 計算單一物業的「已出租地段數」。
 * 直接從 lotIndex 的 lotStatus 欄位計算：
 *   - lotStatus === 'rented' → 已出租（計入）
 *   - lotStatus === 'renting' / 'available' → 不計入
 * 與屬性頁面地塊狀態標籤邏輯一致。
 * 已出租地段以 set 去重。
 */
function countRentedLotsForProperty(property: Property): number {
    if (!property.lotIndex) return 0;
    const entries = parseLotEntries(property.lotIndex);
    const rentedLotSet = new Set<string>();
    for (const entry of entries) {
        if (entry.lotStatus === 'rented') {
            const stripped = entry.value.replace(/^(?:A01-|B01-|C01-|C04-|C21-|C33-|A02-|A01-P|B01-P|C01-E|C04-E|C21-E|C33-E|A02-P)-/i, '').trim();
            rentedLotSet.add(stripped);
        }
    }
    return rentedLotSet.size;
}

/**
 * 計算單一物業的「放租中地段數」。
 * 直接從 lotIndex 的 lotStatus 欄位計算：
 *   - lotStatus === 'listing' → 放租中（計入）
 *   - 其他狀態 → 不計入
 * 與屬性頁面地塊狀態標籤邏輯一致。
 * 放租中地段以 set 去重。
 */
function countListingLotsForProperty(property: Property): number {
    if (!property.lotIndex) return 0;
    const entries = parseLotEntries(property.lotIndex);
    const listingLotSet = new Set<string>();
    for (const entry of entries) {
        if (entry.lotStatus === 'listing') {
            const stripped = entry.value.replace(/^(?:A01-|B01-|C01-|C04-|C21-|C33-|A02-|A01-P|B01-P|C01-E|C04-E|C21-E|C33-E|A02-P)-/i, '').trim();
            listingLotSet.add(stripped);
        }
    }
    return listingLotSet.size;
}

export default function RentalPage() {
    const { data: qProperties, isLoading: qLoading } = usePropertiesQuery({ bypassIsolation: true });
    const { isAuthenticated } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSelected, setSearchSelected] = useState<Property | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [sortOption, setSortOption] = useState<'default' | 'newest' | 'area_asc' | 'area_desc'>('default');
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

    const sortOptions: { value: typeof sortOption; label: string }[] = [
        { value: 'default', label: '預設排序' },
        { value: 'newest', label: '最近新增' },
        { value: 'area_asc', label: '面積 (小 > 大)' },
        { value: 'area_desc', label: '面積 (大 > 小)' },
    ];
    const ITEMS_PER_PAGE = 12;
    // 偵測是否為桌面版面（≥lg, 1024px）以決定列表點擊行為：
    //   - 桌面：點擊列表只更新右側 Property Detail Panel 選中狀態
    //   - 行動裝置：右側 Property Detail Panel 隱藏，點擊列表直接導向 `/rental/{id}` 頁面
    const [isDesktop, setIsDesktop] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(min-width: 1024px)').matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia('(min-width: 1024px)');
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

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
            case 'newest':
                return filtered.sort((a, b) => getPropertyCreatedAtTime(a) - getPropertyCreatedAtTime(b));
            case 'area_asc':
                return filtered.sort((a, b) => Number(a.lotArea || 0) - Number(b.lotArea || 0));
            case 'area_desc':
                return filtered.sort((a, b) => Number(b.lotArea || 0) - Number(a.lotArea || 0));
            default: // 'default' - 保持原始順序
                return filtered;
        }
    }, [qProperties, sortOption]);

    const filteredProperties = useMemo(() => {
        if (!searchSelected) return properties;
        return properties.filter(p => p.id === searchSelected.id);
    }, [properties, searchSelected]);

    // 搜尋匹配（至少 2 個字才開始匹配）
    const searchMatches = useMemo(() => {
        if (searchQuery.length < 2) return [];
        const query = searchQuery.toLowerCase();
        return properties
            .filter(
                p =>
                    p.name.toLowerCase().includes(query) ||
                    p.code.toLowerCase().includes(query) ||
                    (p.address || '').toLowerCase().includes(query)
            )
            .slice(0, 8);
    }, [searchQuery, properties]);

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
        <div className="flex flex-col h-[calc(100dvh-7rem)] space-y-3 pb-1 safe-area-bottom">
            <style jsx global>{`
                .rental-page-scroll::-webkit-scrollbar {
                    display: none;
                }
                .rental-page-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .safe-area-bottom {
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
            `}</style>

            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4 w-[60%]">
                    {/* 搜尋欄：輸入 ≥2 個字才顯示下拉選單，選擇後才篩選 listing（即時不過濾） */}
                    <div className="relative flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-white/40 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    // 重新輸入時清空先前的選中狀態（避免舊篩選殘留）
                                    if (searchSelected) setSearchSelected(null);
                                }}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => {
                                    // 延遲關閉，讓點擊 dropdown 項目能正確觸發
                                    setTimeout(() => setSearchFocused(false), 150);
                                }}
                                placeholder="搜尋物業名稱 / 編號 / 地址（至少 2 個字）"
                                className="w-full pl-10 pr-10 py-2.5 text-base bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSearchSelected(null);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 dark:text-white/40 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
                                    aria-label="清除搜尋"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {/* 下拉選單：≥2 個字且 focus 時顯示 */}
                        {searchFocused && searchQuery.length >= 2 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-lg overflow-hidden z-50">
                                {searchMatches.length > 0 ? (
                                    <ul className="max-h-64 overflow-y-auto py-1">
                                        {searchMatches.map((p) => (
                                            <li key={p.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setSearchSelected(p);
                                                        setSearchQuery(p.name);
                                                        setSearchFocused(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer"
                                                >
                                                    <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                                                        {p.name}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 dark:text-white/40 truncate">
                                                        {p.code} · {p.address || '未設定地址'}
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="px-3 py-3 text-sm text-zinc-500 dark:text-white/40 text-center">
                                        沒有符合的物業
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 以地圖搜尋按鈕 */}
                    <button
                        type="button"
                        onClick={() => setViewMode('map')}
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-base font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors cursor-pointer"
                    >
                        <Map className="w-4 h-4" />
                        以地圖搜尋
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden">
                {/* Common header（所有 view 模式共用） */}
                <div className="px-3 py-2 bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-600 dark:text-white/60 flex items-baseline">
                            <span className="text-base font-bold text-purple-600 dark:text-purple-400 mr-1">{filteredProperties.length}</span>
                            <span className="font-normal">個出租地段</span>
                        </p>
                        <div className="flex items-center gap-3">
                            {/* 排序 */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm text-zinc-500 dark:text-white/50">排序</span>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setSortDropdownOpen((v) => !v)}
                                        onBlur={() => setTimeout(() => setSortDropdownOpen(false), 150)}
                                        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-sm bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                    >
                                        <span>{sortOptions.find((o) => o.value === sortOption)?.label}</span>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                    {sortDropdownOpen && (
                                        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-lg overflow-hidden z-50 min-w-full whitespace-nowrap">
                                            <ul className="py-1">
                                                {sortOptions.map((o) => (
                                                    <li key={o.value}>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                setSortOption(o.value);
                                                                setSortDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/10 ${sortOption === o.value
                                                                ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 font-medium'
                                                                : 'text-zinc-700 dark:text-white/70'
                                                                }`}
                                                        >
                                                            {o.label}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* 排列（icon-only tabs） */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm text-zinc-500 dark:text-white/50">排列</span>
                                <div className="flex items-center bg-zinc-100 dark:bg-white/5 rounded-lg p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        title="網格"
                                        className={`p-1.5 rounded-md transition-all cursor-pointer ${(viewMode as ViewMode) === 'grid'
                                            ? 'bg-purple-500 text-white'
                                            : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                                            }`}
                                    >
                                        <Grid3X3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        title="列表"
                                        className={`p-1.5 rounded-md transition-all cursor-pointer ${(viewMode as ViewMode) === 'list'
                                            ? 'bg-purple-500 text-white'
                                            : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                                            }`}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => isAuthenticated && setViewMode('map')}
                                        title={!isAuthenticated ? '請先登入以使用地圖模式' : '地圖'}
                                        className={`p-1.5 rounded-md transition-all ${(viewMode as ViewMode) === 'map'
                                            ? 'bg-purple-500 text-white'
                                            : isAuthenticated
                                                ? 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white cursor-pointer'
                                                : 'text-zinc-300 dark:text-white/20 cursor-not-allowed'
                                            }`}
                                    >
                                        <Map className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* View-specific container */}
                <div className="flex-1 min-h-0 lg:overflow-hidden">
                {qLoading ? (
                    <div className="flex items-center justify-center h-full">
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
                        <div className="flex items-center justify-center gap-2 pt-4 pb-6 border-t border-zinc-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-zinc-900 z-10">
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
                    <div className="flex flex-col lg:flex-row flex-1 min-h-0 lg:overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                    {/* Left: scrollable property list */}
                    <div className="w-full lg:w-3/5 xl:w-3/5 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-white/10 overflow-y-auto lg:max-h-none max-h-[60vh]">
                        <div>
                            {filteredProperties.map((property, index) => (
                                <Link
                                    key={property.id}
                                    href={`/rental/${property.id}`}
                                    onClick={(e) => {
                                        // 桌面：攔截點擊，改為更新右側 Property Detail Panel 的選中狀態
                                        // 行動裝置：右側 Property Detail Panel 隱藏，允許 Link 正常導向 `/rental/{id}` 頁面
                                        if (isDesktop) {
                                            e.preventDefault();
                                            setSelectedPropertyId(property.id ?? null);
                                        }
                                    }}
                                    className={`block w-full text-left px-3 py-3 transition-all cursor-pointer border-l-2 border-transparent ${
                                        index % 2 === 1
                                            ? 'bg-zinc-100/60 dark:bg-white/[0.04]'
                                            : ''
                                    } hover:bg-zinc-200/70 dark:hover:bg-white/10`}
                                >
                                    <div className="flex gap-5 items-center">
                                        {/* Thumbnail */}
                                        <div className="w-[192px] h-[108px] rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/5 shrink-0 flex items-center justify-center">
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
                                            <div className="min-w-0">
                                                <p className="text-xl font-semibold text-zinc-900 dark:text-white truncate">
                                                    {property.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 mt-2 text-base text-zinc-500 dark:text-white/50">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">{property.address || '未設定地址'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-2 text-sm text-zinc-400 dark:text-white/40">
                                                <Hash className="w-3 h-3 shrink-0" />
                                                <span>{countListingLotsForProperty(property)} 個地段放租中</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right: property detail panel (僅桌面 ≥lg 顯示；行動裝置點擊列表會直接導向 `/rental/{id}` 頁面) */}
                    <div className="hidden lg:flex flex-1 flex-col min-h-0 overflow-y-auto rental-page-scroll">
                        {selectedPropertyId ? (
                            (() => {
                                const selected = filteredProperties.find(p => p.id === selectedPropertyId) ?? filteredProperties[0] ?? null;
                                if (!selected) return null;
                                const nextIndex = filteredProperties.findIndex(p => p.id === selected.id);
                                const hasImages = selected.images && selected.images.length > 0;
                                const nextProperty = filteredProperties[nextIndex + 1];
                                const prevProperty = filteredProperties[nextIndex - 1];
                                return (
                                    <div className="flex flex-col h-full">
                                        {/* Image Gallery - compact height for mobile */}
                                        {hasImages ? (
                                            <div className="px-3 sm:px-4 pt-3 shrink-0">
                                                <div className="flex flex-col sm:flex-row gap-2 h-auto sm:h-[28vh] lg:h-[38vh]">
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
                                                        <div className="flex flex-col gap-2 w-20 sm:w-24 md:w-28 lg:w-32">
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
                                            <div className="px-3 sm:px-4 pt-3 shrink-0">
                                                <div className="w-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center rounded-xl" style={{ height: 'clamp(100px, 15vh, 150px)' }}>
                                                    <Building2 className="w-10 h-10 sm:w-14 sm:h-14 text-zinc-300 dark:text-white/10" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Property Details */}
                                        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 flex flex-col gap-2.5 rental-page-scroll">
                                            {/* Address */}
                                            <div className="shrink-0">
                                                {selected.name && (
                                                    <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
                                                        {selected.name}
                                                    </h2>
                                                )}
                                                <p className="text-sm sm:text-base text-zinc-600 dark:text-white/80 leading-snug">
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
                                            {(() => {
                                                const allLots = getPropertyLots(selected);
                                                const totalCount = allLots.length;
                                                const rentedCount = countRentedLotsForProperty(selected);
                                                return (
                                                    <div className="shrink-0">
                                                        <p className="text-sm sm:text-base text-zinc-600 dark:text-white/80 leading-snug">
                                                            出租地段 : {totalCount} 個 ({rentedCount}個已出租)
                                                        </p>
                                                    </div>
                                                );
                                            })()}

                                            {/* Land Use & Area Cards */}
                                            <div className="grid grid-cols-2 gap-2 shrink-0">
                                                {/* Land Use */}
                                                <div className="flex items-center gap-2 px-3 py-3 bg-zinc-50 dark:bg-white/5 rounded-xl">
                                                    <Tag className="w-5 h-5 text-emerald-500 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-zinc-400 dark:text-white/40">土地用途</p>
                                                        <p className="text-base font-semibold text-zinc-700 dark:text-white/85 truncate">
                                                            {getLandUseDisplay(selected.landUse)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* Area */}
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

                                            {/* Notes */}
                                            {selected.notes && (
                                                <div className="shrink-0 px-3 py-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl overflow-hidden max-h-24 lg:max-h-20 overflow-y-auto">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">備註</p>
                                                        <p className="text-sm text-amber-700 dark:text-amber-300/85 wrap-break-word mt-1 leading-relaxed line-clamp-2">
                                                            {/* 去除 HTML 標籤，只顯示純文字內容 */}
                                                            {selected.notes.replace(/<[^>]*>/g, '').trim()}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* View Detail Button */}
                                            <Link
                                                href={`/rental/${selected.id}`}
                                                className="flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 bg-purple-500 hover:bg-purple-600 text-white text-sm sm:text-base font-semibold rounded-xl transition-colors shrink-0"
                                            >
                                                查看詳情
                                                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
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
                                    </div>
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
