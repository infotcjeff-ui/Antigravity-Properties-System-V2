'use client';

import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, Marker, useLoadScript, InfoWindow } from '@react-google-maps/api';
import { motion } from 'framer-motion';
import type { Property } from '@/lib/db';
import { useTheme } from '@/contexts/ThemeContext';

interface PropertyMapProps {
    properties: Property[];
    onPropertyClick?: (property: Property) => void;
}

const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '16px',
};

const defaultCenter = {
    lat: 22.3193,  // Hong Kong default
    lng: 114.1694,
};

const getMapOptions = (isDark: boolean) => ({
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: true,
    styles: isDark ? [
        { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
        { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
        { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
        { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
        { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
        { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
    ] : [],
});

export default function PropertyMap({ properties, onPropertyClick }: PropertyMapProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: ['places'],
    });

    const propertiesWithLocation = useMemo(() => {
        const filtered = properties.filter(p => p.location?.lat && p.location?.lng);
        console.log('Map Debug: properties loaded:', properties.length);
        console.log('Map Debug: properties with location:', filtered.length, filtered);
        return filtered;
    }, [properties]);

    const center = useMemo(() => {
        if (propertiesWithLocation.length > 0 && propertiesWithLocation[0].location) {
            const newCenter = {
                lat: propertiesWithLocation[0].location.lat,
                lng: propertiesWithLocation[0].location.lng,
            };
            console.log('Map Debug: targeting first property:', newCenter);
            return newCenter;
        }
        console.log('Map Debug: using default center (HK):', defaultCenter);
        return defaultCenter;
    }, [propertiesWithLocation]);

    const statusColors: Record<string, string> = {
        holding: '#10b981',
        renting: '#3b82f6',
        sold: '#6b7280',
        suspended: '#ef4444',
    };

    if (loadError) {
        return (
            <div className="glass-card p-8 text-center bg-white dark:bg-white/5">
                <p className="text-red-500 dark:text-red-400 font-medium">載入地圖時出錯。請檢查您的 API 金鑰。</p>
                <p className="text-xs text-zinc-400 dark:text-white/30 mt-2">{loadError.message}</p>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="glass-card p-8 flex items-center justify-center h-[600px] bg-white dark:bg-white/5">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-10 h-10 rounded-full bg-purple-500"
                />
            </div>
        );
    }

    return (
        <div className="glass-card overflow-hidden bg-white dark:bg-white/5">
            {propertiesWithLocation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-white/40">
                    <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-lg font-medium">暫無包含位置數據的物業</p>
                    <p className="text-sm mt-1">請為您的物業添加經緯度，以便在地圖上顯示</p>
                </div>
            ) : (
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={center}
                    zoom={12}
                    options={getMapOptions(isDark)}
                >
                    {propertiesWithLocation.map((property) => (
                        <Marker
                            key={property.id}
                            position={{
                                lat: property.location!.lat,
                                lng: property.location!.lng,
                            }}
                            title={property.name}
                            onClick={() => setSelectedProperty(property)}
                            icon={{
                                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
                                fillColor: statusColors[property.status] || '#8b5cf6',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2,
                                scale: 1.5,
                                anchor: new google.maps.Point(12, 22),
                            }}
                        />
                    ))}

                    {selectedProperty && selectedProperty.location && (
                        <InfoWindow
                            position={{
                                lat: selectedProperty.location.lat,
                                lng: selectedProperty.location.lng,
                            }}
                            onCloseClick={() => setSelectedProperty(null)}
                        >
                            <div className="p-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 min-w-[200px] rounded-lg">
                                <h3 className="font-semibold text-base">{selectedProperty.name}</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{selectedProperty.code}</p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 line-clamp-2">{selectedProperty.address}</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <span
                                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider"
                                        style={{ backgroundColor: statusColors[selectedProperty.status] }}
                                    >
                                        {selectedProperty.status === 'holding' ? '持有中' : selectedProperty.status === 'renting' ? '出租中' : selectedProperty.status === 'sold' ? '已售出' : '已暫停'}
                                    </span>
                                </div>
                                {onPropertyClick && (
                                    <button
                                        onClick={() => onPropertyClick(selectedProperty)}
                                        className="mt-4 w-full px-3 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                                    >
                                        查看詳情
                                    </button>
                                )}
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
            )}

            {/* Legend */}
            <div className="p-4 border-t border-zinc-100 dark:border-white/5 flex items-center gap-4 flex-wrap">
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
        </div>

    );
}
