'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, MapPin, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Property } from '@/lib/db';

interface PropertyCardProps {
    property: Property;
    index?: number;
}

const statusColors: Record<string, string> = {
    holding: 'bg-emerald-600/80 text-white border-emerald-500/50',
    renting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
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
};

export default function PropertyCard({ property, index = 0 }: PropertyCardProps) {
    const { isAuthenticated } = useAuth();
    const [imageError, setImageError] = useState(false);

    const cardContent = (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            whileHover={isAuthenticated ? { y: -4, scale: 1.02 } : {}}
            onContextMenu={isAuthenticated ? undefined : (e) => e.preventDefault()}
            className={`group relative bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all h-full ${!isAuthenticated ? 'cursor-default select-none' : 'cursor-pointer'}`}
        >
            {/* Image Cover */}
            <div className="relative h-48 overflow-hidden bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                {property.images?.[0] && !imageError ? (
                    <img
                        src={property.images[0]}
                        alt={property.name}
                        onError={() => setImageError(true)}
                        className={`w-full h-full object-cover transition-transform duration-500 ${isAuthenticated ? 'group-hover:scale-110' : ''}`}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-16 h-16 text-white/20" />
                    </div>
                )}

                {/* Status Badge - Top Right */}
                <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${statusColors[property.status]} ${!isAuthenticated ? 'blur-sm' : ''}`}>
                        {statusLabels[property.status]}
                    </span>
                </div>

                {/* Type Badge - Top Left */}
                <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium bg-black/50 backdrop-blur-sm text-white/80 border border-white/10 ${!isAuthenticated ? 'blur-sm' : ''}`}>
                        {typeLabels[property.type] || property.type}
                    </span>
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent" />

                {/* View Details Overlay */}
                {isAuthenticated && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl text-white">
                            <Eye className="w-4 h-4" />
                            <span className="text-sm font-medium">查看詳情</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Name and Code */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-white font-semibold text-lg truncate transition-colors ${isAuthenticated ? 'group-hover:text-purple-400' : 'blur-sm'}`}>
                            {property.name}
                        </h3>
                        <p className={`text-white/40 text-sm mt-0.5 ${!isAuthenticated ? 'blur-sm' : ''}`}>
                            {property.code}
                        </p>
                    </div>
                </div>

                {/* Address */}
                {property.address && (
                    <div className={`flex items-start gap-2 mt-3 text-white/50 text-sm ${!isAuthenticated ? 'blur-[3px]' : ''}`}>
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{property.address}</span>
                    </div>
                )}

                {/* Footer with Lot Info */}
                {(property.lotIndex || property.lotArea) && (
                    <div className="mt-3 pt-3 border-t border-white/5 flex gap-4 text-xs text-white/40">
                        {property.lotIndex && (
                            <span className={!isAuthenticated ? 'blur-sm' : ''}>地段: <span className="text-white/70">{property.lotIndex}</span></span>
                        )}
                        {property.lotArea && (
                            <span className={!isAuthenticated ? 'blur-sm' : ''}>面積: <span className="text-white/70">{property.lotArea}</span></span>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );

    if (!isAuthenticated) return cardContent;

    return (
        <Link href={`/properties/${encodeURIComponent(property.name)}`}>
            {cardContent}
        </Link>
    );
}
