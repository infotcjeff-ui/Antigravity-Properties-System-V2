'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePropertyWithRelationsQuery } from '@/hooks/useStorage';
import {
    formatLotArea,
    parseLotEntries,
    proprietorCategoryLabelZh,
    LotStatus,
    LotEntry,
} from '@/lib/formatters';
import {
    ArrowLeft,
    Building2,
    MapPin,
    ChevronLeft,
    ChevronRight,
    X,
    Map,
    Image as ImageIcon,
    ExternalLink,
    FileText,
    Eye,
    Users,
    User as UserIcon,
    Ruler,
    Home,
    CheckCircle,
    Droplets,
    Zap,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import SinglePropertyMapDynamic from '@/components/properties/SinglePropertyMapDynamic';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip } from '@heroui/react';

const statusColors: Record<string, string> = {
    holding: 'bg-emerald-600/80 text-white border-emerald-500/50',
    renting: 'bg-blue-600/80 text-white border-blue-500/50',
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
    agent_management: '代理管理',
};

const landUseLabels: Record<string, string> = {
    agr: 'AGR 農業',
    ca: 'CA 自然保育區',
    os: 'OS 露天貯物',
    v: 'V 鄉村式發展',
    ou: 'OU 其他指定用途',
    r_d: 'R(D) 住宅(丁類)',
    r_a5: 'R(A)5 住宅(甲類)5',
};

function StatusBadge({ status }: { status?: string | null }) {
    if (!status) return null;
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean).filter(s => s === 'renting');
    if (statuses.length === 0) return null;
    return (
        <>
            {statuses.map(s => (
                <span
                    key={s}
                    className={`relative ml-2 sm:ml-3 inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold border shadow-sm whitespace-nowrap align-middle overflow-hidden ${statusColors[s] || 'bg-zinc-500/20 text-zinc-400'}`}
                >
                    <span className="absolute inset-0 shimmer-overlay opacity-40" />
                    <span className="relative z-10">{statusLabels[s] || s}</span>
                </span>
            ))}
        </>
    );
}

function LotDetailModal({
    entry,
    onClose,
    parentLocation,
    parentAddress,
}: {
    entry: LotEntry;
    onClose: () => void;
    parentLocation?: { lat: number; lng: number } | null;
    parentAddress?: string | null;
}) {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [activeTab, setActiveTab] = useState<'info' | 'video' | 'plan' | 'map'>('info');
    const [mapLoaded, setMapLoaded] = useState(false);
    const [thumbOffset, setThumbOffset] = useState(0);
    const THUMB_VISIBLE = 5;

    const photoCount = entry.media?.length ?? 0;
    const videoCount = 0; // 預留：視頻功能
    const planCount = 0;   // 預留：規劃圖功能

    const tabs = [
        { key: 'info' as const, label: '地段資料', count: photoCount },
        { key: 'video' as const, label: '影片', count: videoCount },
        { key: 'plan' as const, label: '規劃圖', count: planCount },
        { key: 'map' as const, label: '地圖', count: null },
    ];

    const hasAnyMedia = photoCount > 0 || videoCount > 0 || planCount > 0;

    // 當切換 tab 時重置 currentIdx
    const handleTabChange = (tab: typeof activeTab) => {
        setActiveTab(tab);
        setCurrentIdx(0);
    };

    const prevThumb = () => {
        if (!entry.media?.length) return;
        if (currentIdx === 0) {
            setThumbOffset(Math.max(0, entry.media.length - THUMB_VISIBLE));
        } else if (currentIdx <= thumbOffset) {
            setThumbOffset(i => Math.max(0, i - 1));
        }
        setCurrentIdx(i => (i - 1 + entry.media!.length) % entry.media!.length);
    };

    const nextThumb = () => {
        if (!entry.media?.length) return;
        if (currentIdx === entry.media.length - 1) {
            setThumbOffset(0);
        } else if (currentIdx >= thumbOffset + THUMB_VISIBLE - 1) {
            setThumbOffset(i => Math.min(entry.media!.length - THUMB_VISIBLE, i + 1));
        }
        setCurrentIdx(i => (i + 1) % entry.media!.length);
    };

    return (
        <>
            <style jsx global>{`
                .lot-modal-scroll::-webkit-scrollbar {
                    display: none;
                }
                .lot-modal-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
                onClick={onClose}
            >
            {/* 關閉按鈕 - 右上角 */}
            <div className="absolute top-3 right-[70px] z-20">
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer backdrop-blur-sm"
                >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
            </div>

            {/* 頂部狀態欄 */}
            <div className="shrink-0 px-[70px] py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-black/60 backdrop-blur-sm border-b border-white/10">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className={`shrink-0 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-xs sm:text-base font-semibold ${
                        entry.lotStatus === 'rented'
                            ? 'bg-amber-500/20 text-amber-400'
                            : entry.lotStatus === 'renting'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-white/10 text-white/70'
                    }`}>
                        {entry.lotStatus === 'rented' ? '已出租' : entry.lotStatus === 'renting' ? '出租中' : '未出租'}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white">{entry.value}</h3>
                </div>
            </div>

            {/* 主要內容區域 */}
            <div className="flex-1 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Tab 導航 - 橫向滾動 */}
                <div className="shrink-0 px-[70px] py-2 bg-black/40 backdrop-blur-sm border-b border-white/10">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => handleTabChange(tab.key)}
                                className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                                    activeTab === tab.key
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {tab.label}
                                {tab.count !== null && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${
                                        activeTab === tab.key ? 'bg-white/20' : 'bg-white/10'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab 內容區 */}
                <div className="flex-1 overflow-hidden relative">
                    {/* 地段資料 Tab */}
                    {activeTab === 'info' && (
                        <div className="absolute inset-0 flex flex-col lg:flex-row">
                            {/* 左側：圖片區 */}
                            <div className="w-full lg:w-1/2 flex flex-col p-4 border-b lg:border-b-0 lg:border-r border-white/10">
                                {entry.media && entry.media.length > 0 ? (
                                    <>
                                        {/* 主圖 */}
                                        <div className="relative rounded-xl overflow-hidden bg-white/5" style={{ height: 'clamp(200px, 35vw, 700px)' }}>
                                            <img
                                                src={entry.media[currentIdx].u}
                                                alt={entry.value}
                                                className="w-full h-full object-contain"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            {/* 左右箭頭 */}
                                            {entry.media.length > 1 && (
                                                <>
                                                    <button
                                                        onClick={prevThumb}
                                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer backdrop-blur-sm z-10"
                                                    >
                                                        <ChevronLeft className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={nextThumb}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer backdrop-blur-sm z-10"
                                                    >
                                                        <ChevronRight className="w-5 h-5" />
                                                    </button>
                                                </>
                                            )}
                                            {/* 計數 */}
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                                                {currentIdx + 1} / {entry.media.length}
                                            </div>
                                        </div>
                                        {/* 縮圖列 */}
                                        {entry.media.length > 1 && (
                                            <div className="shrink-0 mt-3 relative">
                                                <button
                                                    onClick={prevThumb}
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 p-1 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer z-10"
                                                    disabled={currentIdx === 0}
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={nextThumb}
                                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer z-10"
                                                    disabled={currentIdx === entry.media.length - 1}
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                                <div className="overflow-hidden mx-6">
                                                    <div
                                                        className="flex gap-2 transition-transform duration-300 ease-out"
                                                        style={{ transform: `translateX(-${thumbOffset * (100 / THUMB_VISIBLE + 0.5)}%)` }}
                                                    >
                                                        {entry.media.map((m, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setCurrentIdx(idx)}
                                                                className={`shrink-0 w-[calc(20%-0.4rem)] aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                                                    idx === currentIdx ? 'border-white ring-2 ring-white/40' : 'border-white/20 opacity-60 hover:opacity-100'
                                                                }`}
                                                            >
                                                                <img src={m.u} alt="" className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/40 rounded-xl bg-white/5 min-h-48">
                                        <Map className="w-16 h-16" />
                                        <p className="text-lg">暫無相片</p>
                                    </div>
                                )}
                            </div>

                            {/* 右側：地段資料區 */}
                            <div className="w-full lg:w-1/2 p-4 overflow-y-auto lot-modal-scroll">
                                <div className="space-y-4">
                                    {/* 名稱 */}
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Home className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs text-white/50 uppercase tracking-wider">地段名稱</span>
                                        </div>
                                        <p className="text-lg font-bold text-white">{entry.value}</p>
                                    </div>

                                    {/* 地址 */}
                                    {parentAddress && (
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <MapPin className="w-4 h-4 text-purple-400" />
                                                <span className="text-xs text-white/50 uppercase tracking-wider">地址</span>
                                            </div>
                                            <p className="text-sm text-white/80">{parentAddress}</p>
                                        </div>
                                    )}

                                    {/* 地段面積 */}
                                    {entry.lotArea && (
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Ruler className="w-4 h-4 text-purple-400" />
                                                <span className="text-xs text-white/50 uppercase tracking-wider">地段面積</span>
                                            </div>
                                            <p className="text-lg font-semibold text-white">{entry.lotArea}</p>
                                        </div>
                                    )}

                                    {/* 出租狀態 */}
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CheckCircle className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs text-white/50 uppercase tracking-wider">出租狀態</span>
                                        </div>
                                        <span className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold ${
                                            entry.lotStatus === 'rented'
                                                ? 'bg-amber-500/20 text-amber-400'
                                                : entry.lotStatus === 'renting'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-white/10 text-white/70'
                                        }`}>
                                            {entry.lotStatus === 'rented' ? '已出租' : entry.lotStatus === 'renting' ? '出租中' : '未出租'}
                                        </span>
                                    </div>

                                    {/* 設施 */}
                                    {(entry.waterMeter || entry.electricMeter) ? (
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Building2 className="w-4 h-4 text-purple-400" />
                                                <span className="text-xs text-white/50 uppercase tracking-wider">設施</span>
                                            </div>
                                            <div className="flex flex-wrap gap-3">
                                                {entry.waterMeter && (
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                                        <Droplets className="w-4 h-4 text-blue-400" />
                                                        <span className="text-sm font-medium text-blue-300">水錶</span>
                                                    </div>
                                                )}
                                                {entry.electricMeter && (
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                                        <Zap className="w-4 h-4 text-yellow-400" />
                                                        <span className="text-sm font-medium text-yellow-300">電錶</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Building2 className="w-4 h-4 text-purple-400" />
                                                <span className="text-xs text-white/50 uppercase tracking-wider">設施</span>
                                            </div>
                                            <p className="text-sm text-white/40 italic">暫無設施資料</p>
                                        </div>
                                    )}

                                    {/* 備註 */}
                                    {entry.note && (
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="w-4 h-4 text-purple-400" />
                                                <span className="text-xs text-white/50 uppercase tracking-wider">備註</span>
                                            </div>
                                            <p className="text-sm text-white/80 whitespace-pre-wrap">{entry.note}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 影片 Tab */}
                    {activeTab === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center px-[70px]">
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 text-white/40">
                                <svg className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <p className="text-base sm:text-lg">暫無影片</p>
                            </div>
                        </div>
                    )}

                    {/* 規劃圖 Tab */}
                    {activeTab === 'plan' && (
                        <div className="absolute inset-0 flex items-center justify-center px-[70px]">
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 text-white/40">
                                <FileText className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16" />
                                <p className="text-base sm:text-lg">暫無規劃圖</p>
                            </div>
                        </div>
                    )}

                    {/* 地圖 Tab */}
                    {activeTab === 'map' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-[70px] py-4 gap-4">
                            {parentLocation ? (
                                <>
                                    <div className="flex-1 w-full max-w-[57vw] rounded-lg sm:rounded-xl overflow-hidden bg-zinc-800">
                                        <iframe
                                            src={`https://www.google.com/maps?q=${parentLocation.lat},${parentLocation.lng}&z=17&output=embed`}
                                            className="w-full h-full border-0"
                                            allowFullScreen
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            title="地段位置"
                                            onLoad={() => setMapLoaded(true)}
                                        />
                                    </div>
                                    {parentAddress && (
                                        <div className="shrink-0 w-full max-w-[57vw] p-3 bg-black/60 backdrop-blur-sm rounded-xl border border-white/10">
                                            <p className="text-sm sm:text-base text-white/90 text-center font-medium flex items-center justify-center gap-2">
                                                <MapPin className="w-4 h-4 shrink-0" />
                                                <span className="truncate">{parentAddress}</span>
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full max-w-[57vw] h-[68vh] flex flex-col items-center justify-center gap-2 sm:gap-3 text-white/40 rounded-lg sm:rounded-xl bg-white/5 border border-white/10">
                                    <Map className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16" />
                                    <p className="text-base sm:text-lg">暫無地段位置</p>
                                    <p className="text-xs sm:text-sm text-white/30">使用父物業位置顯示</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
        </>
    );
}

interface ViewCounts {
    viewCount: number;
    liveCount: number;
}

export default function RentalPropertyPage() {
    const { user } = useAuth();
    const params = useParams();
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => isZh ? zh : en;
    const propertyId = params.id as string;
    const { data: property, isLoading: loading } = usePropertyWithRelationsQuery(propertyId);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageError, setImageError] = useState(false);
    const [galleryOffset, setGalleryOffset] = useState(0);
    const [showGeoMaps, setShowGeoMaps] = useState(false);
    const [detailTab, setDetailTab] = useState<'overview' | 'location' | 'geo'>('overview');
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const galleryRef = useRef<HTMLDivElement>(null);
    const GALLERY_VISIBLE = 5;

    const lotEntries = useMemo(() => parseLotEntries(property?.lotIndex ?? null) as LotEntry[], [property?.lotIndex]);
    const [viewLotEntry, setViewLotEntry] = useState<LotEntry | null>(null);

    // 瀏覽次數
    const [viewCounts, setViewCounts] = useState<ViewCounts>({ viewCount: 0, liveCount: 0 });

    const fetchViewCounts = useCallback(async () => {
        try {
            const res = await fetch(`/api/property-views?propertyId=${propertyId}`);
            if (res.ok) {
                const data = await res.json();
                setViewCounts({ viewCount: data.viewCount || 0, liveCount: data.liveCount || 0 });
            }
        } catch {
            // ignore
        }
    }, [propertyId]);

    useEffect(() => {
        if (!propertyId) return;

        // 頁面進入：增加瀏覽次數
        const reportEnter = async () => {
            try {
                const res = await fetch('/api/property-views', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ propertyId, action: 'enter' }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setViewCounts({ viewCount: data.viewCount || 0, liveCount: data.liveCount || 0 });
                }
            } catch {
                // ignore
            }
        };

        reportEnter();
        fetchViewCounts();

        // 每 30 秒刷新 live_count（保持心跳）
        const interval = setInterval(fetchViewCounts, 30000);

        return () => {
            clearInterval(interval);
            // 頁面離開：遞減 live_count
            fetch('/api/property-views', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ propertyId, action: 'leave' }),
            }).catch(() => {});
        };
    }, [propertyId, fetchViewCounts]);

    // Lightbox 鍵盤控制：Esc 關閉、左右方向鍵切換
    useEffect(() => {
        if (!lightboxOpen || !property?.images?.length) return;
        const total = property.images.length;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setLightboxOpen(false);
            } else if (e.key === 'ArrowLeft' && total > 1) {
                setCurrentImageIndex(i => (i - 1 + total) % total);
                setImageError(false);
            } else if (e.key === 'ArrowRight' && total > 1) {
                setCurrentImageIndex(i => (i + 1) % total);
                setImageError(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxOpen, property?.images?.length]);

    const isRenting = useMemo(() => {
        if (!property) return false;
        const status = property.status || '';
        return status.split(',').map(s => s.trim()).includes('renting');
    }, [property]);

    const prevImage = () => {
        if (!property?.images?.length) return;
        setCurrentImageIndex(i => (i - 1 + property.images.length) % property.images.length);
        setImageError(false);
        if (currentImageIndex === 0) {
            setGalleryOffset(Math.max(0, property.images.length - GALLERY_VISIBLE));
        } else if (currentImageIndex <= galleryOffset) {
            setGalleryOffset(i => Math.max(0, i - 1));
        }
    };

    const nextImage = () => {
        if (!property?.images?.length) return;
        setCurrentImageIndex(i => (i + 1) % property.images.length);
        setImageError(false);
        if (currentImageIndex === property.images.length - 1) {
            setGalleryOffset(0);
        } else if (currentImageIndex >= galleryOffset + GALLERY_VISIBLE - 1) {
            setGalleryOffset(i => Math.min(property.images.length - GALLERY_VISIBLE, i + 1));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-10 h-10 rounded-full bg-purple-500"
                />
            </div>
        );
    }

    if (!property) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <Building2 className="w-16 h-16 text-white/20 mb-4" />
                <h2 className="text-xl text-white/60">找不到此物業</h2>
                <Link href="/rental" className="mt-4 text-purple-400 hover:text-purple-300 transition-colors">
                    返回出租列表
                </Link>
            </div>
        );
    }

    if (!isRenting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <Building2 className="w-16 h-16 text-white/20" />
                <h2 className="text-xl text-white/60">此物業目前不在出租狀態</h2>
                <Link href="/rental" className="text-purple-400 hover:text-purple-300 transition-colors">
                    返回出租列表
                </Link>
            </div>
        );
    }

    const landUseList = property.landUse
        ? property.landUse.split(',').map(s => landUseLabels[s.trim()]).filter(Boolean)
        : [];
    const proprietor = property.proprietor || null;

    return (
        <>
            <style jsx global>{`
                body {
                    overflow: hidden;
                }
                .rental-page-container {
                    height: calc(100vh - 4rem - 1rem);
                    overflow: hidden;
                    padding: 0;
                }
                @media (min-width: 1024px) {
                    .rental-page-container {
                        height: 90vh;
                    }
                }
                .rental-page-scroll::-webkit-scrollbar {
                    display: none;
                }
                .rental-page-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .notes-scroll::-webkit-scrollbar {
                    display: none;
                }
                .notes-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .safe-area-bottom {
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
                .safe-area-top {
                    padding-top: env(safe-area-inset-top, 0px);
                }
                .shimmer-overlay {
                    background: linear-gradient(
                        110deg,
                        transparent 20%,
                        rgba(255, 255, 255, 0.5) 45%,
                        rgba(255, 255, 255, 0.8) 50%,
                        rgba(255, 255, 255, 0.5) 55%,
                        transparent 80%
                    );
                    background-size: 200% 100%;
                    animation: shimmer-slide 3s ease-in-out infinite;
                }
                @keyframes shimmer-slide {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .rich-text-content ul {
                    list-style-type: disc;
                    margin-left: 1.5rem;
                    margin-top: 0.25rem;
                    margin-bottom: 0.25rem;
                }
                .rich-text-content ol {
                    list-style-type: decimal;
                    margin-left: 1.5rem;
                    margin-top: 0.25rem;
                    margin-bottom: 0.25rem;
                }
                .rich-text-content p {
                    margin-bottom: 0.25rem;
                }
                .rich-text-content a {
                    color: #a855f7;
                    text-decoration: underline;
                }
                .rich-text-content h1, .rich-text-content h2, .rich-text-content h3 {
                    font-weight: bold;
                    margin-top: 0.5rem;
                    margin-bottom: 0.25rem;
                }
                .rich-text-content h1 { font-size: 1.125rem; }
                .rich-text-content h2 { font-size: 1rem; }
                .rich-text-content h3 { font-size: 0.875rem; }
            `}</style>

            <div className="rental-page-container overflow-hidden">
            <div className="h-full flex flex-col overflow-y-auto rental-page-scroll safe-area-bottom pt-20 sm:pt-0">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>

                <Link
                    href="/rental"
                    className="inline-flex items-center gap-2 text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>返回出租列表</span>
                </Link>
            </motion.div>

            {/* 主版型：響應式佈局 - 移動端垂直，桌面端左右 */}
            <div className="grid grid-cols-1 xl:grid-cols-[38%_1fr] gap-4 lg:gap-6 mt-4 sm:mt-6 pb-8 sm:pb-4 px-2 sm:px-0 pt-2 sm:pt-0 lg:min-h-0 lg:h-full">
                {/* 左欄：圖片 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2 sm:gap-3 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5"
                >
                    {property.images && property.images.length > 0 && !imageError ? (
                        <>
                            {/* 主圖 - 點擊開啟 lightbox */}
                            <button
                                type="button"
                                onClick={() => setLightboxOpen(true)}
                                className="relative w-full overflow-hidden group cursor-zoom-in lg:!h-[550px]"
                                style={{ height: 'clamp(200px, 35vh, 350px)' }}
                                aria-label="放大圖片"
                            >
                                <img
                                    src={property.images[currentImageIndex]}
                                    alt={`${property.name} - ${currentImageIndex + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    onError={() => setImageError(true)}
                                />
                                <span className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {currentImageIndex + 1} / {property.images.length}
                                </span>
                            </button>
                            {/* 縮圖 gallery */}
                            <div className="relative shrink-0">
                                {property.images.length > GALLERY_VISIBLE && (
                                    <>
                                        <button type="button" onClick={prevImage} className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-black/80 transition-colors z-10 cursor-pointer disabled:opacity-30" disabled={currentImageIndex === 0}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={nextImage} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-black/80 transition-colors z-10 cursor-pointer disabled:opacity-30" disabled={currentImageIndex === property.images.length - 1}>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                <div ref={galleryRef} className="overflow-hidden px-2">
                                    <div
                                        className="flex gap-2 transition-transform duration-300 ease-out"
                                        style={{ transform: `translateX(-${galleryOffset * (100 / GALLERY_VISIBLE + 0.5)}%)` }}
                                    >
                                        {property.images.map((url, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setCurrentImageIndex(idx);
                                                    setImageError(false);
                                                    if (idx >= galleryOffset + GALLERY_VISIBLE) {
                                                        setGalleryOffset(Math.min(idx - GALLERY_VISIBLE + 1, property.images.length - GALLERY_VISIBLE));
                                                    } else if (idx < galleryOffset) {
                                                        setGalleryOffset(idx);
                                                    }
                                                }}
                                                onDoubleClick={() => {
                                                    setCurrentImageIndex(idx);
                                                    setImageError(false);
                                                    setLightboxOpen(true);
                                                }}
                                                className={`relative shrink-0 w-[calc(20%-0.4rem)] aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${idx === currentImageIndex ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-900/20 dark:ring-white/20' : 'border-zinc-200 dark:border-white/15 opacity-70 hover:opacity-100'}`}
                                                aria-label={`第 ${idx + 1} 張圖，雙擊放大檢視`}
                                            >
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* 備註 */}
                            <div className="shrink-0 mx-2 mb-2 p-3 border-l-[3px] border-purple-500 bg-purple-500/5 rounded-r-xl max-h-40 lg:max-h-32 overflow-y-auto notes-scroll">
                                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1.5">備註</p>
                                {property.notes ? (
                                    <div
                                        className="text-zinc-700 dark:text-white/80 text-sm rich-text-content"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(property.notes) }}
                                    />
                                ) : (
                                    <p className="text-zinc-400 dark:text-white/30 text-xs">暫無。</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-48">
                                <ImageIcon className="w-16 h-16 text-zinc-300 dark:text-white/15" />
                                <p className="text-zinc-400 dark:text-white/30 text-sm">暫無。</p>
                            </div>
                            {/* 備註 */}
                            <div className="shrink-0 mx-2 mb-2 p-3 border-l-[3px] border-purple-500 bg-purple-500/5 rounded-r-xl max-h-40 lg:max-h-32 overflow-y-auto notes-scroll">
                                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1.5">備註</p>
                                {property.notes ? (
                                    <div
                                        className="text-zinc-700 dark:text-white/80 text-sm rich-text-content"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(property.notes) }}
                                    />
                                ) : (
                                    <p className="text-zinc-400 dark:text-white/30 text-xs">暫無。</p>
                                )}
                            </div>
                        </>
                    )}
                </motion.div>

                {/* 右欄：資訊 + Tabs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col min-h-0 h-full gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5"
                >
                    {/* 名稱與狀態 */}
                    <div className="shrink-0">
                        <h1 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white leading-tight">
                            {property.name || t('Unnamed Property', '未命名物業')}
                            <StatusBadge status={property.status} />
                        </h1>
                    </div>

                    {/* 瀏覽次數 */}
                    <div className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-white/60">
                            <Users className="w-4 h-4 text-purple-500" />
                            <span>現時觀看</span>
                            <span className="font-semibold text-purple-600 dark:text-purple-400">{viewCounts.liveCount}</span>
                            <span className="text-zinc-400">人</span>
                        </div>
                        <div className="w-px h-4 bg-zinc-200 dark:bg-white/10" />
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-white/60">
                            <Eye className="w-4 h-4 text-purple-500" />
                            <span>總瀏覽</span>
                            <span className="font-semibold text-purple-600 dark:text-purple-400">{viewCounts.viewCount}</span>
                            <span className="text-zinc-400">次</span>
                        </div>
                    </div>

                    {/* Button Tabs：概覽 | 位置 | 地理資訊圖 */}
                    <div className="rounded-xl border border-zinc-200 dark:border-white/15 p-1 flex flex-wrap justify-center sm:justify-start gap-1 bg-zinc-50/80 dark:bg-white/4">
                        {(
                            [
                                ['overview', t('Overview', '概覽')] as const,
                                ['location', t('Location', '位置')] as const,
                                ['geo', t('Geographic map', '地理資訊圖')] as const,
                            ]
                        ).map(([tab, label]) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setDetailTab(tab)}
                                className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                                    detailTab === tab
                                        ? 'bg-white dark:bg-white/15 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-white/10'
                                        : 'text-zinc-500 dark:text-white/55 hover:text-zinc-800 dark:hover:text-white'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto rental-page-scroll">
                        {detailTab === 'overview' && (
                            <div className="space-y-4">
                                {/* 業主 */}
                                {proprietor && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10">
                                        <p className="text-base font-medium text-zinc-700 dark:text-white/80 mb-3">{t('Proprietor', '業主')}</p>
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-linear-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
                                                {proprietor.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-base font-medium text-zinc-900 dark:text-white">{proprietor.name}</p>
                                                <p className="text-sm text-zinc-500">{proprietorCategoryLabelZh(proprietor.category, 'card')}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 面積 + 土地用途（同一行） */}
                                {(property.lotArea || landUseList.length > 0) && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10 flex flex-wrap gap-6">
                                        {property.lotArea && (
                                            <div className="flex-1 min-w-32">
                                                <p className="text-base font-medium text-zinc-700 dark:text-white/80">{t('Area', '總面積')}</p>
                                                <p className="text-xl font-bold text-zinc-900 dark:text-white mt-0.5">{formatLotArea(property.lotArea)}</p>
                                            </div>
                                        )}
                                        {landUseList.length > 0 && (
                                            <div className="flex-1 min-w-32">
                                                <p className="text-base font-medium text-zinc-700 dark:text-white/80 mb-2">{t('Land Use', '土地用途')}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {landUseList.map((use, idx) => (
                                                        <span key={idx} className="px-3 py-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-base border border-purple-500/20">
                                                            {use}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 地段（listing 顯示：圖片 + 名稱 + 備註） */}
                                {lotEntries.length > 0 && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10">
                                        <p className="text-base font-medium text-zinc-700 dark:text-white/80 mb-3">{t('Lot Index', '所有地段')}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {lotEntries.map((entry, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-3 p-3 bg-white dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/40 transition-colors cursor-pointer group"
                                                    onClick={() => setViewLotEntry(entry)}
                                                >
                                                    {entry.media?.[0]?.u ? (
                                                        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-white/5">
                                                            <img
                                                                src={entry.media![0].u}
                                                                alt={entry.value}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg bg-zinc-100 dark:bg-white/5 border-2 border-dashed border-zinc-200 dark:border-white/10 flex items-center justify-center shrink-0">
                                                            <Map className="w-6 h-6 text-zinc-300 dark:text-white/20" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-1.5 ${
                                                            entry.lotStatus === 'rented'
                                                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                                                : entry.lotStatus === 'renting'
                                                                ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                                                                : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-white/60'
                                                        }`}>
                                                            {entry.lotStatus === 'rented' ? '已出租' : entry.lotStatus === 'renting' ? '出租中' : '未出租'}
                                                        </span>
                                                        <p className="text-base font-semibold text-zinc-900 dark:text-white truncate">{entry.value}</p>
                                                    </div>
                                                    {entry.media && entry.media.length > 0 && (
                                                        <div className="shrink-0 flex items-center gap-1 text-zinc-400 dark:text-white/30 group-hover:text-purple-500 transition-colors">
                                                            <ImageIcon className="w-4 h-4" />
                                                            <span className="text-xs font-medium">{entry.media.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}

                        {detailTab === 'location' && (
                            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden bg-zinc-50 dark:bg-white/5">
                                <div className="h-70 sm:h-80 lg:h-96 relative">
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
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                        >
                                            {property.address}
                                            <span className="text-xs text-zinc-400 dark:text-white/40 ml-1.5">
                                                {t('(Click to open Google Maps)', '（點擊打開 Google Map）')}
                                            </span>
                                        </a>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {detailTab === 'geo' && (
                            <div className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-4 sm:p-6 shadow-sm dark:shadow-none flex flex-col h-full min-h-0">
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 shrink-0">
                                    <Map className="w-5 h-5" />
                                    {t('Geographic Maps & Documents', '地理資訊圖及文件')}
                                </h2>

                                {!user ? (
                                    <div className="flex-1 flex flex-col items-center justify-center bg-zinc-100 dark:bg-white/5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-white/10 p-6 text-center">
                                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                                            <Map className="w-6 h-6 text-red-500" />
                                        </div>
                                        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                                            {t('Please log in first', '請先登入')}
                                        </h3>
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-4 max-w-62">
                                            {t('This section contains sensitive geographic information and documents. Please log in to view.', '此內容包含敏感地理資訊及相關文件，需登入後方可查看。')}
                                        </p>
                                        <Link
                                            href="/login"
                                            className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
                                        >
                                            <UserIcon className="w-4 h-4" />
                                            {t('Log In', '前往登入')}
                                        </Link>
                                    </div>
                                ) : !showGeoMaps ? (
                                    <div className="flex-1 flex flex-col items-center justify-center bg-zinc-100 dark:bg-white/5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-white/10 p-6 text-center">
                                        <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
                                            <X className="w-6 h-6 text-yellow-500" />
                                        </div>
                                        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                                            {t('Sensitive Information', '敏感地理資料')}
                                        </h3>
                                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-4 max-w-48">
                                            {t('This section contains sensitive geographic information and documents. Click to reveal.', '由於資料包含敏感地理訊息及相關文件，需手動點擊後方可查看。')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowGeoMaps(true)}
                                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 mx-auto"
                                        >
                                            <ImageIcon className="w-3.5 h-3.5" />
                                            {t('Show Content', '點擊查看內容')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
                                        {property.geoMaps && property.geoMaps.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-hidden">
                                                {property.geoMaps.map((map, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={map}
                                                        alt={`Geo Map ${idx + 1}`}
                                                        className="w-full h-full object-cover rounded-lg hover:opacity-80 transition-opacity"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 bg-zinc-50 dark:bg-white/5 rounded-lg border border-dashed border-zinc-200 dark:border-white/10">
                                                <p className="text-zinc-400 dark:text-white/30 text-xs">暫無地理資訊圖</p>
                                            </div>
                                        )}

                                        <div className="shrink-0 pt-4 border-t border-zinc-100 dark:border-white/10">
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
                        )}
                    </div>
                </motion.div>
            </div>

            <AnimatePresence>
                {viewLotEntry && (
                    <LotDetailModal
                        entry={viewLotEntry}
                        onClose={() => setViewLotEntry(null)}
                        parentLocation={property.location}
                        parentAddress={property.address}
                    />
                )}
            </AnimatePresence>

            {/* 圖片 Lightbox */}
            <AnimatePresence>
                {lightboxOpen && property.images && property.images.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col"
                        onClick={() => setLightboxOpen(false)}
                    >
                        {/* 頂部列：名稱、計數、關閉 */}
                        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-black/40 backdrop-blur-sm border-b border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 shrink-0" />
                                <h3 className="text-sm sm:text-base font-medium text-white truncate">
                                    {property.name || t('Unnamed Property', '未命名物業')}
                                </h3>
                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-xs font-medium">
                                    {currentImageIndex + 1} / {property.images.length}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLightboxOpen(false)}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer backdrop-blur-sm"
                                aria-label="關閉"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        {/* 主圖區 */}
                        <div className="flex-1 flex items-center justify-center px-2 sm:px-4 py-2 sm:py-4 overflow-hidden relative" onClick={e => e.stopPropagation()}>
                            {property.images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCurrentImageIndex(i => (i - 1 + property.images.length) % property.images.length);
                                            setImageError(false);
                                        }}
                                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer backdrop-blur-sm z-10"
                                        aria-label="上一張"
                                    >
                                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCurrentImageIndex(i => (i + 1) % property.images.length);
                                            setImageError(false);
                                        }}
                                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer backdrop-blur-sm z-10"
                                        aria-label="下一張"
                                    >
                                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                                    </button>
                                </>
                            )}
                            <motion.img
                                key={currentImageIndex}
                                src={property.images[currentImageIndex]}
                                alt={`${property.name} - ${currentImageIndex + 1}`}
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.25 }}
                                className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg select-none"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        </div>

                        {/* 底部縮圖列 */}
                        {property.images.length > 1 && (
                            <div className="shrink-0 px-3 sm:px-6 py-2 sm:py-3 bg-black/40 backdrop-blur-sm border-t border-white/10" onClick={e => e.stopPropagation()}>
                                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide justify-start sm:justify-center">
                                    {property.images.map((url, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setCurrentImageIndex(idx);
                                                setImageError(false);
                                            }}
                                            className={`relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-md sm:rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                                idx === currentImageIndex
                                                    ? 'border-white ring-2 ring-white/40 scale-105'
                                                    : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'
                                            }`}
                                            aria-label={`跳到第 ${idx + 1} 張圖`}
                                        >
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
            </div>
        </>
    );
}
