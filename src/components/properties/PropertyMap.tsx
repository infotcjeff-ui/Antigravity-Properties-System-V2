'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, MapPin, AlertTriangle } from 'lucide-react';
import type { Property } from '@/lib/db';
import { useTheme } from '@/contexts/ThemeContext';
import { countListingLots } from '@/lib/formatters';

interface PropertyMapProps {
    properties: Property[];
    /**
     * 點擊 pin 時觸發（用於切換頁面 / 選取物業）。
     * Popup 仍會正常開啟；此回呼為額外動作。
     */
    onPropertyClick?: (property: Property) => void;
    /**
     * 只顯示「出租中」(status 含 renting) 的物業。
     * 出租頁（/rental）地圖模式使用；物業總覽頁則不傳，顯示全部。
     */
    onlyRenting?: boolean;
    /**
     * 地圖高度模式：
     *   - 'fill'（預設）：填滿父容器高度（父容器需有高度）
     *   - 'viewport'：以視窗高度計算（父容器高度未定時使用）
     */
    heightMode?: 'fill' | 'viewport';
    /** 詳情頁路由前綴（'/rental' 或 '/properties'） */
    basePath?: string;
}

const defaultCenter = { lat: 22.3193, lng: 114.1694 };

/** 座標是否可用（避免 lat/lng 為 0 或 NaN 時被誤判為「無座標」） */
function hasValidLocation(property: Property): boolean {
    const loc = property.location;
    if (!loc) return false;
    return Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
}

/** status 是否含「出租中」(renting) */
function isRentingStatus(property: Property): boolean {
    return String(property.status || '')
        .split(',')
        .map(s => s.trim())
        .includes('renting');
}

// Component to handle bounds
function MapBounds({ properties }: { properties: Property[] }) {
    const map = useMap();
    useEffect(() => {
        const locations = properties.filter(hasValidLocation);
        if (locations.length > 0) {
            // 行動裝置使用較小的 padding，避免 pin 被推到地圖邊界外
            const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;
            const bounds = new LatLngBounds(locations.map(p => [p.location!.lat, p.location!.lng]));
            map.fitBounds(bounds, {
                padding: isNarrow ? [24, 24] : [50, 50],
                maxZoom: 16,
            });
        } else {
            map.setView(defaultCenter, 12);
        }
    }, [properties, map]);
    return null;
}

// 自訂 Pin：白色圓角 pill，左側物業名稱，右側紅色 count badge（該物業放租中地段數）
const createPropertyIcon = (propertyName: string, lotCount: number) => {
    return L.divIcon({
        className: 'custom-property-pin',
        html: `
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: #ffffff;
                color: #1f2937;
                padding: 6px 10px 6px 12px;
                border-radius: 9999px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
                font-family: inherit;
                font-size: 12px;
                font-weight: 600;
                line-height: 1;
                white-space: nowrap;
                border: 1px solid rgba(0,0,0,0.05);
            ">
                <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(propertyName)}</span>
                <span style="
                    background: linear-gradient(135deg, #ef4444, #f97316);
                    color: #ffffff;
                    padding: 3px 8px;
                    border-radius: 9999px;
                    font-size: 11px;
                    font-weight: 700;
                    min-width: 24px;
                    text-align: center;
                ">${lotCount}</span>
            </div>
            <div style="
                width: 0;
                height: 0;
                margin: 0 auto;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 8px solid #ffffff;
                margin-top: -2px;
                filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
            "></div>
        `,
        iconSize: [120, 40],
        iconAnchor: [60, 40],
        popupAnchor: [0, -40],
    });
};

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export default function PropertyMap({ properties, onPropertyClick, onlyRenting = false, heightMode = 'fill', basePath = '/rental' }: PropertyMapProps) {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // 只顯示「出租中」物業（出租頁地圖模式）
    const rentingProperties = useMemo(() => {
        if (!onlyRenting) return properties;
        return properties.filter(isRentingStatus);
    }, [properties, onlyRenting]);

    const propertiesWithLocation = useMemo(() => {
        return rentingProperties.filter(hasValidLocation);
    }, [rentingProperties]);

    // 有地址但未設定座標的物業（無法在地圖顯示 pin）
    const propertiesMissingLocation = useMemo(() => {
        return rentingProperties.filter(p => !hasValidLocation(p));
    }, [rentingProperties]);

    // CartoDB dark matter for dark mode, OpenStreetMap standard for light mode
    const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    // 容器高度：fill 填滿父容器；viewport 以視窗高度計算（響應式）
    const containerStyle: React.CSSProperties = heightMode === 'viewport'
        ? { height: 'clamp(320px, calc(100dvh - 16rem), 720px)' }
        : { height: '100%', minHeight: '320px' };

    return (
        <div
            className="overflow-hidden bg-white dark:bg-white/5 flex flex-col rounded-2xl w-full"
            style={containerStyle}
        >
            {propertiesWithLocation.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 sm:py-16 text-zinc-400 dark:text-white/40 flex-1">
                    <svg className="w-14 h-14 sm:w-16 sm:h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-base sm:text-lg font-medium text-center">暫無包含位置數據的物業</p>
                    <p className="text-xs sm:text-sm mt-1 text-center max-w-sm">
                        請為您的物業添加經緯度，以便在地圖上顯示
                    </p>
                </div>
            ) : (
                <div className="w-full h-full relative z-0 flex-1 min-h-0">
                    <MapContainer
                        center={defaultCenter}
                        zoom={12}
                        scrollWheelZoom={true}
                        className="h-full! w-full!"
                        style={{ height: '100%', width: '100%', zIndex: 0 }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url={tileUrl}
                        />

                        <MapBounds properties={propertiesWithLocation} />

                        {propertiesWithLocation.map((property) => {
                            const lotCount = countListingLots(property);
                            return (
                                <Marker
                                    key={property.id}
                                    position={[property.location!.lat, property.location!.lng]}
                                    icon={createPropertyIcon(property.name, lotCount)}
                                    eventHandlers={{
                                        click: () => {
                                            if (onPropertyClick) onPropertyClick(property);
                                        },
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2 min-w-55">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold truncate max-w-50">
                                                    {property.name}
                                                </span>
                                                <span className="text-xs text-zinc-500 shrink-0">
                                                    {lotCount} 個地段放租中
                                                </span>
                                            </div>
                                            <div
                                                className="rounded-lg border border-zinc-200 dark:border-white/10 overflow-hidden bg-white dark:bg-zinc-800"
                                            >
                                                {property.images && property.images.length > 0 ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={property.images[0]}
                                                        alt={property.name}
                                                        className="w-full h-24 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => router.push(`${basePath}/${property.id}`)}
                                                    />
                                                ) : (
                                                    <div className="w-full h-24 bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                                                        <Building2 className="w-6 h-6 text-zinc-300 dark:text-white/20" />
                                                    </div>
                                                )}
                                                <div className="p-2">
                                                    <p className="text-xs text-zinc-500 dark:text-white/40 truncate mt-0.5">
                                                        {property.address}
                                                    </p>
                                                    <div
                                                        className="mt-2 px-2 py-1 bg-purple-600 text-white text-xs text-center rounded-md font-medium cursor-pointer"
                                                        onClick={(e) => { e.stopPropagation(); router.push(`${basePath}/${property.id}`); }}
                                                    >
                                                        前往詳情
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>
            )}

            {/* 提示：部分物業未設定座標，未能於地圖顯示 */}
            {propertiesMissingLocation.length > 0 && (
                <div className="px-3 sm:px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 border-t border-amber-200 dark:border-amber-500/20 flex items-start gap-2 shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300">
                            {propertiesMissingLocation.length} 個物業未設定位置，未在地圖顯示
                        </p>
                        <p className="text-xs text-amber-600/90 dark:text-amber-400/70 mt-0.5 break-words">
                            {propertiesMissingLocation.map(p => p.name).join('、')}
                        </p>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-zinc-100 dark:border-white/5 flex items-center gap-3 sm:gap-4 flex-wrap bg-white dark:bg-zinc-900 relative z-10 shrink-0 rounded-b-2xl">
                <span className="text-zinc-500 dark:text-white/50 text-[11px] sm:text-xs font-medium uppercase tracking-wider">圖例:</span>
                <div className="flex items-center gap-2">
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ffffff',
                            color: '#1f2937',
                            padding: '4px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: '1px solid rgba(0,0,0,0.05)',
                        }}
                    >
                        <span>物業名稱</span>
                        <span
                            style={{
                                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: '9999px',
                                fontSize: '10px',
                                fontWeight: 700,
                            }}
                        >
                            放租地段數
                        </span>
                    </span>
                </div>
                <span className="hidden sm:inline text-xs text-zinc-500 dark:text-white/40 ml-auto">
                    點擊 pin 查看該物業詳情
                </span>
                <span className="sm:hidden inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-white/40 ml-auto">
                    <MapPin className="w-3.5 h-3.5" />
                    點擊 pin 查看詳情
                </span>
            </div>
            <style jsx global>{`
                .leaflet-container {
                    z-index: 0 !important;
                }
                .custom-property-pin {
                    background: none !important;
                    border: none !important;
                }
                .custom-property-pin > div {
                    pointer-events: auto;
                }
                /* 行動裝置：縮小 pin 名稱最大寬度，避免遮擋地圖 */
                @media (max-width: 640px) {
                    .custom-property-pin span:first-child {
                        max-width: 88px !important;
                    }
                }
            `}</style>
        </div>
    );
}
