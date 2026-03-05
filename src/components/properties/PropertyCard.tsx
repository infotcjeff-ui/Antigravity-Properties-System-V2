'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, MapPin, Eye } from 'lucide-react';
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
    const [imageError, setImageError] = useState(false);

    return (
        <Link href={`/properties/${encodeURIComponent(property.name)}`}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="group relative bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all cursor-pointer h-full"
            >
                {/* Image Cover */}
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                    {property.images?.[0] && !imageError ? (
                        <img
                            src={property.images[0]}
                            alt={property.name}
                            onError={() => setImageError(true)}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-16 h-16 text-white/20" />
                        </div>
                    )}

                    {/* Status Badge - Top Right */}
                    <div className="absolute top-3 right-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${statusColors[property.status]}`}>
                            {statusLabels[property.status]}
                        </span>
                    </div>

                    {/* Type Badge - Top Left */}
                    <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/50 backdrop-blur-sm text-white/80 border border-white/10">
                            {typeLabels[property.type] || property.type}
                        </span>
                    </div>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent" />

                    {/* View Details Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl text-white">
                            <Eye className="w-4 h-4" />
                            <span className="text-sm font-medium">查看詳情</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* Name and Code */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-lg truncate group-hover:text-purple-400 transition-colors">
                                {property.name}
                            </h3>
                            <p className="text-white/40 text-sm mt-0.5">
                                {property.code}
                            </p>
                        </div>
                    </div>

                    {/* Address */}
                    {property.address && (
                        <div className="flex items-start gap-2 mt-3 text-white/50 text-sm">
                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{property.address}</span>
                        </div>
                    )}

                    {/* Footer with Lot Info */}
                    {(property.lotIndex || property.lotArea) && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex gap-4 text-xs text-white/40">
                            {property.lotIndex && (
                                <span>地段: <span className="text-white/70">{property.lotIndex}</span></span>
                            )}
                            {property.lotArea && (
                                <span>面積: <span className="text-white/70">{property.lotArea}</span></span>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </Link>
    );
}
