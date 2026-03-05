'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/contexts/ThemeContext';

interface LocationPickerMapProps {
    location: { lat: number; lng: number } | null;
    onChange: (location: { lat: number; lng: number }) => void;
}

const defaultCenter = { lat: 22.3193, lng: 114.1694 };

// Custom pin icon constructor
const createIcon = () => {
    return L.divIcon({
        className: 'custom-pin',
        html: `
            <svg viewBox="0 0 24 24" fill="#a855f7" stroke="white" stroke-width="2" style="width: 32px; height: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            </svg>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
    });
};

function MapClickHandler({ onChange }: { onChange: (loc: { lat: number; lng: number }) => void }) {
    useMapEvents({
        click(e) {
            onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
        },
    });
    return null;
}

export default function LocationPickerMap({ location, onChange }: LocationPickerMapProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const center = location || defaultCenter;
    const [map, setMap] = useState<L.Map | null>(null);

    // Using useMemo so icon obj doesn't constantly recreate, avoiding slight performance issues
    const markerIcon = useMemo(() => createIcon(), []);

    useEffect(() => {
        if (map && location) {
            map.flyTo([location.lat, location.lng], map.getZoom() < 14 ? 14 : map.getZoom());
        }
    }, [location, map]);

    const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    return (
        <div className="w-full h-64 rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 relative z-0 mt-3 group">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-medium text-zinc-600 dark:text-zinc-300 shadow-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                在地圖上點擊或拖動物件以更改精確位置
            </div>

            <MapContainer
                center={[center.lat, center.lng]}
                zoom={14}
                ref={setMap as any}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
                <TileLayer url={tileUrl} />
                <MapClickHandler onChange={onChange} />

                {location && (
                    <Marker
                        position={[location.lat, location.lng]}
                        icon={markerIcon}
                        draggable={true}
                        eventHandlers={{
                            dragend: (e) => {
                                const marker = e.target;
                                const pos = marker.getLatLng();
                                onChange({ lat: pos.lat, lng: pos.lng });
                            },
                        }}
                    />
                )}
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
