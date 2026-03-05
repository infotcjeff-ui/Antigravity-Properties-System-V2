'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L, { LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Property } from '@/lib/db';
import { useTheme } from '@/contexts/ThemeContext';

interface PropertyMapProps {
    properties: Property[];
    onPropertyClick?: (property: Property) => void;
}

const defaultCenter = { lat: 22.3193, lng: 114.1694 };

// Component to handle bounds
function MapBounds({ properties }: { properties: Property[] }) {
    const map = useMap();
    useEffect(() => {
        const locations = properties.filter(p => p.location?.lat && p.location?.lng);
        if (locations.length > 0) {
            const bounds = new LatLngBounds(locations.map(p => [p.location!.lat, p.location!.lng]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } else {
            map.setView(defaultCenter, 12);
        }
    }, [properties, map]);
    return null;
}

const statusColors: Record<string, string> = {
    holding: '#10b981',
    renting: '#3b82f6',
    sold: '#6b7280',
    suspended: '#ef4444',
};

// Custom Marker Icon 
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

export default function PropertyMap({ properties, onPropertyClick }: PropertyMapProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

    const propertiesWithLocation = useMemo(() => {
        return properties.filter(p => p.location?.lat && p.location?.lng);
    }, [properties]);

    // Mock Hotspots: For this implementation, we will artificially add a hotspot circle around each property to show "density/interest"
    const hotspots = useMemo(() => {
        return propertiesWithLocation.map(p => ({
            id: `hotspot-${p.id}`,
            lat: p.location!.lat,
            lng: p.location!.lng,
            radius: 200,
            color: statusColors[p.status] || '#8b5cf6'
        }));
    }, [propertiesWithLocation]);

    // CartoDB dark matter for dark mode, OpenStreetMap standard for light mode
    const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    return (
        <div className="glass-card overflow-hidden bg-white dark:bg-white/5 flex flex-col" style={{ height: '600px', borderRadius: '16px' }}>
            {propertiesWithLocation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-white/40 h-full flex-1">
                    <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-lg font-medium">暫無包含位置數據的物業</p>
                    <p className="text-sm mt-1">請為您的物業添加經緯度，以便在地圖上顯示</p>
                </div>
            ) : (
                <div className="w-full h-full relative z-0 flex-1">
                    <MapContainer
                        center={defaultCenter}
                        zoom={12}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%', zIndex: 0 }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url={tileUrl}
                        />

                        <MapBounds properties={propertiesWithLocation} />

                        {hotspots.map(spot => (
                            <Circle
                                key={spot.id}
                                center={[spot.lat, spot.lng]}
                                radius={spot.radius}
                                pathOptions={{
                                    color: spot.color,
                                    fillColor: spot.color,
                                    fillOpacity: 0.2,
                                    weight: 1
                                }}
                            />
                        ))}

                        {propertiesWithLocation.map((property) => (
                            <Marker
                                key={property.id}
                                position={[property.location!.lat, property.location!.lng]}
                                icon={createIcon(statusColors[property.status] || '#8b5cf6')}
                                eventHandlers={{
                                    click: () => {
                                        setSelectedProperty(property);
                                    },
                                }}
                            >
                                <Popup>
                                    <div className="p-1 min-w-[200px]">
                                        <h3 className="font-semibold text-base text-zinc-900">{property.name}</h3>
                                        <p className="text-xs text-zinc-500 mt-0.5">{property.code}</p>
                                        <p className="text-sm text-zinc-600 mt-2 line-clamp-2">{property.address}</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <span
                                                className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider"
                                                style={{ backgroundColor: statusColors[property.status] }}
                                            >
                                                {property.status === 'holding' ? '持有中' : property.status === 'renting' ? '出租中' : property.status === 'sold' ? '已售出' : '已暫停'}
                                            </span>
                                        </div>
                                        {onPropertyClick && (
                                            <button
                                                onClick={() => onPropertyClick(property)}
                                                className="mt-4 w-full px-3 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                                            >
                                                查看詳情
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            )}

            {/* Legend */}
            <div className="p-4 border-t border-zinc-100 dark:border-white/5 flex items-center gap-4 flex-wrap bg-white dark:bg-zinc-900 relative z-10 shrink-0 rounded-b-2xl">
                <span className="text-zinc-500 dark:text-white/50 text-xs font-medium uppercase tracking-wider">狀態:</span>
                {Object.entries(statusColors).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                        <span className="text-zinc-700 dark:text-white/70 text-sm capitalize font-medium">
                            {status === 'holding' ? '持有中' : status === 'renting' ? '出租中' : status === 'sold' ? '已售出' : '已暫停'}
                        </span>
                    </div>
                ))}
            </div>
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
