'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useProperties, usePropertiesQuery } from '@/hooks/useStorage';
import type { Property } from '@/lib/db';
import PropertyCard from '@/components/properties/PropertyCard';
import PropertyMap from '@/components/properties/PropertyMap';
import PropertyForm from '@/components/properties/PropertyForm';
import { Building2, Grid3X3, Map, Search, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'grid' | 'map';

export default function PropertiesPage() {
    const queryClient = useQueryClient();
    const { data: qProperties, isLoading: qLoading } = usePropertiesQuery();
    const { isAuthenticated } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [showPropertyForm, setShowPropertyForm] = useState(false);

    const properties = useMemo(() => {
        if (!qProperties) return [];
        return [...qProperties].sort((a, b) => a.code.localeCompare(b.code));
    }, [qProperties]);

    const filteredProperties = useMemo(() => {
        let filtered = properties;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                p =>
                    p.name.toLowerCase().includes(query) ||
                    p.code.toLowerCase().includes(query) ||
                    p.address.toLowerCase().includes(query)
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(p => p.status === statusFilter);
        }

        if (typeFilter !== 'all') {
            filtered = filtered.filter(p => p.type === typeFilter);
        }

        return filtered;
    }, [properties, searchQuery, statusFilter, typeFilter]);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">物業管理</h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">瀏覽並管理您的物業資產</p>
                </div>
                {isAuthenticated && (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowPropertyForm(true)}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-shadow flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        新增物業
                    </motion.button>
                )}
            </div>

            {/* Filters and View Toggle */}
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜尋物業..."
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                >
                    <option value="all">所有狀態</option>
                    <option value="holding">持有中</option>
                    <option value="renting">出租中</option>
                    <option value="sold">已售出</option>
                    <option value="suspended">已暫停</option>
                </select>

                {/* Type Filter */}
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                >
                    <option value="all">所有類型</option>
                    <option value="group_asset">集團資產</option>
                    <option value="co_investment">合資物業</option>
                    <option value="external_lease">外部租賃</option>
                    <option value="managed_asset">代管資產</option>
                </select>

                {/* View Toggle */}
                <div className="flex items-center bg-zinc-100 dark:bg-white/5 rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'grid'
                            ? 'bg-purple-500 text-white'
                            : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <Grid3X3 className="w-4 h-4" />
                        <span className="text-sm">網格</span>
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'map'
                            ? 'bg-purple-500 text-white'
                            : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <Map className="w-4 h-4" />
                        <span className="text-sm">地圖</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            {qLoading ? (
                <div className="flex items-center justify-center min-h-[40vh]">
                    <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-10 h-10 rounded-full bg-purple-500"
                    />
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProperties.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 dark:text-white/20">
                            <Building2 className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-xl font-medium text-zinc-500 dark:text-white/40">未找到物業</p>
                            <p className="text-sm mt-2 opacity-70">點擊上方按鈕新增物業以開始使用</p>
                        </div>
                    ) : (
                        filteredProperties.map((property, index) => (
                            <PropertyCard
                                key={property.id}
                                property={property}
                                index={index}
                            />
                        ))
                    )}
                </div>
            ) : (
                <PropertyMap properties={filteredProperties} />
            )}

            {/* Property Form Modal */}
            <AnimatePresence>
                {showPropertyForm && (
                    <PropertyForm
                        onClose={() => setShowPropertyForm(false)}
                        onSuccess={async () => {
                            setShowPropertyForm(false);
                            // Explicitly refetch to ensure the list is updated
                            await queryClient.invalidateQueries({ queryKey: ['properties'] });
                            await queryClient.refetchQueries({ queryKey: ['properties'] });
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
