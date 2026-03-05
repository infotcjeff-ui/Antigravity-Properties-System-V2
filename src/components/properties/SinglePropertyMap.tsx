'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Property } from '@/lib/db';
import { useTheme } from '@/contexts/ThemeContext';

interface SinglePropertyMapProps {
    property: Property;
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

export default function SinglePropertyMap({ property }: SinglePropertyMapProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    if (!property.location?.lat || !property.location?.lng) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800/50">
                <svg className="w-16 h-16 text-zinc-300 dark:text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-zinc-400 dark:text-white/30 text-sm">暫無位置訊息。</p>
            </div>
        );
    }

    const center = { lat: property.location.lat, lng: property.location.lng };
    const markerColor = statusColors[property.status] || '#8b5cf6';

    return (
        <div className="w-full h-full relative z-0">
            <MapContainer
                center={center}
                zoom={16}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
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
