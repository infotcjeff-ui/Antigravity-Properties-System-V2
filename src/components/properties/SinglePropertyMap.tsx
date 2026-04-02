'use client';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Property } from '@/lib/db';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';

interface SinglePropertyMapProps {
    property: Property;
    onLocationChange?: (lat: number, lng: number) => void;
    interactive?: boolean;
}

const statusColors: Record<string, string> = {
    holding: '#10b981',
    renting: '#3b82f6',
    sold: '#6b7280',
    suspended: '#ef4444',
};

const createIcon = (color: string) => {
    return L.divIcon({
        className: 'custom-pin',
        html: `
            <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" style="width: 32px; height: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            </svg>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};

/** 點擊地圖設定座標（當 interactive=true 時啟用） */
function MapClickHandler({ onLocationChange }: { onLocationChange?: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            if (onLocationChange) {
                onLocationChange(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

export default function SinglePropertyMap({ property, onLocationChange, interactive = false }: SinglePropertyMapProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function determineLocation() {
            if (property.location?.lat && property.location?.lng) {
                if (isMounted) {
                    setCenter({ lat: property.location.lat, lng: property.location.lng });
                    setLoading(false);
                }
                return;
            }

            if (property.address) {
                // 1) 先試 Nominatim（適用於市區）
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(property.address + ', Hong Kong')}&limit=1`,
                        {
                            headers: {
                                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                                'User-Agent': 'AntigravityPropSystem/1.0'
                            }
                        }
                    );
                    const data = await res.json();
                    if (data && data.length > 0 && isMounted) {
                        const lat = parseFloat(data[0].lat);
                        const lng = parseFloat(data[0].lon);
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                            setCenter({ lat, lng });
                            setLoading(false);
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('Nominatim geocoding failed:', error);
                }

                // 2) Fallback：政府 ALS API（適用於新界鄉郊）
                try {
                    const alsRes = await fetch(`/api/geocode?q=${encodeURIComponent(property.address)}`);
                    const alsData = await alsRes.json();
                    if (alsData?.lat != null && alsData?.lng != null && isMounted) {
                        setCenter({ lat: alsData.lat, lng: alsData.lng });
                        setLoading(false);
                        return;
                    }
                } catch (error) {
                    console.warn('ALS geocoding failed:', error);
                }
            }

            if (isMounted) setLoading(false);
        }

        determineLocation();

        return () => { isMounted = false; };
    }, [property]);

    const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/50">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!center) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800/50">
                <svg className="w-16 h-16 text-zinc-300 dark:text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-zinc-400 dark:text-white/30 text-sm">暫無位置訊息。</p>
                {interactive && onLocationChange && (
                    <p className="text-zinc-400 dark:text-white/30 text-xs">點擊地圖以設定位置</p>
                )}
            </div>
        );
    }

    const markerColor = statusColors[property.status] || '#8b5cf6';

    return (
        <div className="w-full h-full relative z-0">
            <MapContainer
                center={center}
                zoom={16}
                scrollWheelZoom={interactive}
                dragging={interactive}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
                {interactive && <MapClickHandler onLocationChange={onLocationChange} />}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url={tileUrl}
                />
                <Marker
                    position={[center.lat, center.lng]}
                    icon={createIcon(markerColor)}
                >
                    <Popup>
                        <div className="p-1 min-w-[200px]">
                            <h3 className="font-semibold text-base text-zinc-900">{property.name}</h3>
                            <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{property.address}</p>
                            {interactive && (
                                <p className="text-[10px] text-zinc-400 mt-1">點擊地圖可移動標記</p>
                            )}
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>
            <style jsx global>{`
                .leaflet-container {
                    z-index: 0 !important;
                }
                .custom-pin {
                    background: none;
                    border: none;
                }
            `}</style>
        </div>
    );
}
