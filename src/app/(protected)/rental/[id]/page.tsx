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
    unknown: '未知',
    open_storage: '露天倉儲',
    residential_a: '住宅(甲)',
    open_space: '開放空間',
    village_dev: '鄉村式發展',
    conservation_area: '保育區',
    residential_c: '住宅(丙類)',
    recreation_use: '休憩用地',
};

function StatusBadge({ status }: { status?: string | null }) {
    if (!status) return null;
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean).filter(s => s === 'renting');
    if (statuses.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {statuses.map(s => (
                <span
                    key={s}
                    className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${statusColors[s] || 'bg-zinc-500/20 text-zinc-400'}`}
                >
                    {statusLabels[s] || s}
                </span>
            ))}
        </div>
    );
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
            >
                <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="max-w-full max-h-full object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </motion.div>
    );
}

function LotDetailModal({
    entry,
    onClose,
    onImageClick,
}: {
    entry: { type: 'new' | 'old'; value: string; media?: { u: string; s: number }[]; note?: string };
    onClose: () => void;
    onImageClick: (src: string) => void;
}) {
    const [currentIdx, setCurrentIdx] = useState(0);
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <span className={`shrink-0 px-3 py-1 rounded-lg text-sm font-semibold ${entry.type === 'new' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-white/70'}`}>
                            {entry.type === 'new' ? '新地段' : '舊地段'}
                        </span>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{entry.value}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto notes-scroll">
                    {entry.media && entry.media.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-zinc-500 dark:text-white/50">圖片</p>
                            {entry.media.length === 1 ? (
                                <img
                                    src={entry.media[0].u}
                                    alt={entry.value}
                                    className="w-full rounded-xl object-contain cursor-pointer hover:opacity-80 transition-opacity bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10"
                                    style={{ maxHeight: '60vh' }}
                                    onClick={() => onImageClick(entry.media[0].u)}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="relative select-none">
                                    <div className="relative overflow-hidden rounded-xl bg-zinc-50 dark:bg-white/5" style={{ height: '45vh' }}>
                                        {entry.media.map((m, idx) => (
                                            <img
                                                key={idx}
                                                src={m.u}
                                                alt={`圖片 ${idx + 1}`}
                                                className="absolute inset-0 w-full h-full object-contain cursor-pointer transition-opacity duration-300"
                                                style={{ opacity: idx === currentIdx ? 1 : 0, pointerEvents: idx === currentIdx ? 'auto' : 'none' }}
                                                onClick={() => onImageClick(m.u)}
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setCurrentIdx(i => (i - 1 + entry.media!.length) % entry.media!.length)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentIdx(i => (i + 1) % entry.media!.length)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors cursor-pointer"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <div className="flex justify-center gap-1.5 mt-2">
                                        {entry.media.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentIdx(idx)}
                                                className={`rounded-full transition-all cursor-pointer ${idx === currentIdx ? 'w-4 h-2 bg-purple-500' : 'w-2 h-2 bg-zinc-300 dark:bg-white/30 hover:bg-zinc-400 dark:hover:bg-white/50'}`}
                                                style={{ padding: 0, border: 'none' }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-center text-xs text-zinc-400 dark:text-white/40 mt-1">{currentIdx + 1} / {entry.media.length}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-6 bg-zinc-50 dark:bg-white/5 rounded-xl border border-dashed border-zinc-200 dark:border-white/10">
                            <Map className="w-8 h-8 text-zinc-300 dark:text-white/20 mx-auto mb-2" />
                            <p className="text-sm text-zinc-400 dark:text-white/40">暫無圖片</p>
                        </div>
                    )}

                    {entry.note && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-zinc-500 dark:text-white/50">備註</p>
                            <div className="bg-purple-500/5 dark:bg-purple-500/10 rounded-xl p-4 border-l-4 border-purple-500">
                                <p className="text-sm text-zinc-700 dark:text-white/80 whitespace-pre-wrap">{entry.note}</p>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
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
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [galleryOffset, setGalleryOffset] = useState(0);
    const [showGeoMaps, setShowGeoMaps] = useState(false);
    const [detailTab, setDetailTab] = useState<'overview' | 'location' | 'geo'>('overview');
    const galleryRef = useRef<HTMLDivElement>(null);
    const GALLERY_VISIBLE = 5;

    const lotEntries = useMemo(() => parseLotEntries(property?.lotIndex ?? null), [property?.lotIndex]);
    const [viewLotEntry, setViewLotEntry] = useState<{ type: 'new' | 'old'; value: string; media?: { u: string; s: number }[]; note?: string } | null>(null);

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
        ? property.landUse.split(',').map(s => landUseLabels[s.trim()] || s.trim()).filter(Boolean)
        : [];
    const proprietor = property.proprietor || null;

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <Link
                    href="/rental"
                    className="inline-flex items-center gap-2 text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>返回出租列表</span>
                </Link>
            </motion.div>

            {/* 主版型：左側（圖片）| 右側（資訊） */}
            <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-6 lg:gap-10 lg:items-stretch">
                {/* 左欄：圖片 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4 w-full lg:h-[calc(100dvh-10rem)] lg:min-h-0 lg:max-h-[calc(100dvh-10rem)] rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5"
                >
                    {property.images && property.images.length > 0 && !imageError ? (
                        <>
                            {/* 主圖 */}
                            <div className="relative w-full flex-1 min-h-80 lg:min-h-0 overflow-hidden">
                                <img
                                    src={property.images[currentImageIndex]}
                                    alt={`${property.name} - ${currentImageIndex + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                                    onClick={() => setLightboxImage(property.images[currentImageIndex])}
                                    onError={() => setImageError(true)}
                                />
                            </div>
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
                                                className={`relative shrink-0 w-[calc(20%-0.4rem)] aspect-square rounded-lg overflow-hidden border-2 transition-all ${idx === currentImageIndex ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-900/20 dark:ring-white/20' : 'border-zinc-200 dark:border-white/15 opacity-70 hover:opacity-100'}`}
                                            >
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* 備註 */}
                            <div className="shrink-0 mx-2 mb-2 p-3 border-l-[3px] border-purple-500 bg-purple-500/5 rounded-r-xl max-h-40 overflow-y-auto notes-scroll">
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
                            <style jsx global>{`
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
                        </>
                    ) : (
                        <>
                            <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-48">
                                <ImageIcon className="w-16 h-16 text-zinc-300 dark:text-white/15" />
                                <p className="text-zinc-400 dark:text-white/30 text-sm">暫無。</p>
                            </div>
                            {/* 備註 */}
                            <div className="shrink-0 mx-2 mb-2 p-3 border-l-[3px] border-purple-500 bg-purple-500/5 rounded-r-xl max-h-40 overflow-y-auto notes-scroll">
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
                            <style jsx global>{`
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
                        </>
                    )}
                </motion.div>

                {/* 右欄：資訊 + Tabs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-5"
                >
                    {/* 名稱與狀態 */}
                    <div>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <h1 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white">
                                    {property.name || t('Unnamed Property', '未命名物業')}
                                </h1>
                            </div>
                            <StatusBadge status={property.status} />
                        </div>
                        {property.type && (
                            <p className="text-sm text-zinc-500 dark:text-white/50 mt-2">
                                {typeLabels[property.type] || property.type}
                            </p>
                        )}
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
                                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    detailTab === tab
                                        ? 'bg-white dark:bg-white/15 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-white/10'
                                        : 'text-zinc-500 dark:text-white/55 hover:text-zinc-800 dark:hover:text-white'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-0 flex-1">
                        {detailTab === 'overview' && (
                            <div className="space-y-4">
                                {/* 業主 */}
                                {proprietor && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10">
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/80 mb-2">{t('Proprietor', '業主')}</p>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                                                {proprietor.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{proprietor.name}</p>
                                                {proprietor.code && (
                                                    <p className="text-xs text-zinc-500">{proprietor.code} · {proprietorCategoryLabelZh(proprietor.category, 'card')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 面積 + 土地用途（同一行） */}
                                {(property.lotArea || landUseList.length > 0) && (
                                    <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10 flex flex-wrap gap-6">
                                        {property.lotArea && (
                                            <div className="flex-1 min-w-32">
                                                <p className="text-sm font-medium text-zinc-700 dark:text-white/80">{t('Area', '面積')}</p>
                                                <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{formatLotArea(property.lotArea)}</p>
                                            </div>
                                        )}
                                        {landUseList.length > 0 && (
                                            <div className="flex-1 min-w-32">
                                                <p className="text-sm font-medium text-zinc-700 dark:text-white/80 mb-1">{t('Land Use', '土地用途')}</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {landUseList.map((use, idx) => (
                                                        <span key={idx} className="px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-sm border border-purple-500/20">
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
                                        <p className="text-sm font-medium text-zinc-700 dark:text-white/80 mb-3">{t('Lot Index', '地段')}</p>
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
                                                                src={entry.media[0].u}
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
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold ${entry.type === 'new' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-white/60'}`}>
                                                                {entry.type === 'new' ? '新' : '舊'}
                                                            </span>
                                                            <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{entry.value}</span>
                                                        </div>
                                                        {entry.note && (
                                                            <p className="text-xs text-zinc-500 dark:text-white/40 line-clamp-1">{entry.note}</p>
                                                        )}
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
                                        <span>{property.address}</span>
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
                                            <User className="w-4 h-4" />
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
                                                        className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
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

            {/* 地圖（全寬，在版型外） */}
            {property.location?.lat && property.location?.lng && (
                    <SinglePropertyMapDynamic
                        property={property}
                        className="w-full h-96"
                    />
            )}

            {/* 燈箱 */}
            <AnimatePresence>
                {lightboxImage && (
                    <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {viewLotEntry && (
                    <LotDetailModal
                        entry={viewLotEntry}
                        onClose={() => setViewLotEntry(null)}
                        onImageClick={(src) => setLightboxImage(src)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
