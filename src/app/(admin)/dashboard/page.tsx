'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDashboardStatsQuery, useDatabase } from '@/hooks/useStorage';
import {
    Building2,
    Users,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    BarChart3,
    PieChart,
    Shield,
    Settings,
    Database,
} from 'lucide-react';
import { BentoCard, BentoGrid, StatCard } from '@/components/layout/BentoGrid';
import type { Property, Proprietor, Rent } from '@/lib/db';

export default function DashboardPage() {
    const queryClient = useQueryClient();
    const { data: stats, isLoading } = useDashboardStatsQuery();

    const { seedData, clearDatabase, syncLocalToCloud, loading: dbLoading } = useDatabase();

    const [userRole, setUserRole] = useState<string>('client');

    useEffect(() => {
        // Get user role
        try {
            const authData = localStorage.getItem('pms_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                setUserRole(parsed.user?.role || 'client');
            }
        } catch {
            setUserRole('client');
        }
    }, []);

    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['properties'] });
        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
        queryClient.invalidateQueries({ queryKey: ['rents'] });
    }, [queryClient]);

    const handleResetDatabase = async () => {
        if (window.confirm('您確定要清除所有雲端和本地數據嗎？此操作無法撤銷。')) {
            await clearDatabase();
            invalidateAll();
        }
    };

    const handleSeedData = async () => {
        await seedData();
        invalidateAll();
    };

    const handleSyncData = async () => {
        const result = await syncLocalToCloud();
        alert(result.message);
        invalidateAll();
    };

    // Use stats from the query
    const totalProperties = stats?.totalProperties || 0;
    const totalProprietors = stats?.totalProprietors || 0;
    const totalRents = stats?.totalRents || 0;
    const rentingLeases = stats?.rentingLeases || 0;
    const expiredLeases = stats?.expiredLeases || 0;
    const totalIncome = stats?.totalIncome || 0;
    const totalExpenses = stats?.totalExpenses || 0;
    const netProfit = stats?.netProfit || 0;
    const statusBreakdown = stats?.statusBreakdown || { holding: 0, renting: 0, sold: 0, suspended: 0 };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-12 h-12 rounded-full bg-purple-500"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                    {userRole === 'admin' ? '管理儀表板' : '我的儀表板'}
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20">
                        雲端同步已啟動
                    </span>
                </h1>
                <p className="text-zinc-500 dark:text-white/50 mt-1">
                    {userRole === 'admin'
                        ? '完整的系統概覽與管理'
                        : '您的物業與租賃概覽'}
                </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="物業總數"
                    value={totalProperties}
                    icon={<Building2 className="w-6 h-6 text-white" />}
                    gradient="purple"
                />
                <StatCard
                    label="資產擁有方"
                    value={totalProprietors}
                    icon={<Users className="w-6 h-6 text-white" />}
                    gradient="blue"
                />
                <StatCard
                    label="總收入"
                    value={`$${totalIncome.toLocaleString()}`}
                    icon={<TrendingUp className="w-6 h-6 text-white" />}
                    gradient="green"
                />
                <StatCard
                    label="總支出"
                    value={`$${totalExpenses.toLocaleString()}`}
                    icon={<TrendingDown className="w-6 h-6 text-white" />}
                    gradient="orange"
                />
            </div>

            {/* Bento Grid */}
            <BentoGrid>
                {/* Net Profit */}
                <BentoCard
                    title="淨利潤"
                    subtitle="收入減去支出"
                    icon={<DollarSign className="w-5 h-5" />}
                    size="wide"
                    gradient={netProfit >= 0 ? 'green' : 'orange'}
                >
                    <div className="flex items-end gap-2">
                        <span className={`text-4xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${Math.abs(netProfit).toLocaleString()}
                        </span>
                        <span className={`mb-1 ${netProfit >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                            {netProfit >= 0 ? '盈餘' : '虧損'}
                        </span>
                    </div>
                </BentoCard>

                {/* Renting Leases */}
                <BentoCard
                    title="租賃中"
                    subtitle="當前活躍租約"
                    icon={<Activity className="w-5 h-5" />}
                    gradient="green"
                >
                    <span className="text-3xl font-bold text-emerald-400">{rentingLeases}</span>
                </BentoCard>

                {/* Expired Leases */}
                <BentoCard
                    title="已過期"
                    subtitle="需續約或處理"
                    icon={<Activity className="w-5 h-5" />}
                    gradient="orange"
                >
                    <span className="text-3xl font-bold text-red-400">{expiredLeases}</span>
                </BentoCard>

                {/* Property Status Breakdown */}
                <BentoCard
                    title="狀態分佈"
                    subtitle="物業狀態佔比"
                    icon={<PieChart className="w-5 h-5" />}
                    size="tall"
                >
                    <div className="space-y-3 mt-2">
                        {[
                            { label: '持有中', value: statusBreakdown.holding, color: 'bg-blue-500', textColor: 'text-blue-400' },
                            { label: '出租中', value: statusBreakdown.renting, color: 'bg-green-500', textColor: 'text-green-400' },
                            { label: '已售出', value: statusBreakdown.sold, color: 'bg-gray-500', textColor: 'text-gray-400' },
                            { label: '已暫停', value: statusBreakdown.suspended, color: 'bg-red-500', textColor: 'text-red-400' },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                                <span className="text-zinc-600 dark:text-white/70 text-sm flex-1">{item.label}</span>
                                <span className={`font-semibold ${item.textColor}`}>{item.value}</span>
                                <div className="w-16 h-2 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${totalProperties > 0 ? (item.value / totalProperties) * 100 : 0}%` }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className={`h-full ${item.color}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </BentoCard>

                {/* Admin-Only Widgets */}
                {userRole === 'admin' && (
                    <>
                        {/* System Health */}
                        <BentoCard
                            title="系統狀態"
                            subtitle="所有系統運行正常"
                            icon={<Shield className="w-5 h-5" />}
                            gradient="green"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-emerald-400 font-medium">良好</span>
                            </div>
                        </BentoCard>

                        {/* Database Stats */}
                        <BentoCard
                            title="資料庫"
                            subtitle="本地儲存統計"
                            icon={<Database className="w-5 h-5" />}
                            size="wide"
                            gradient="blue"
                        >
                            <div className="flex gap-6 text-sm">
                                <div>
                                    <p className="text-zinc-500 dark:text-white/50">物業</p>
                                    <p className="text-zinc-900 dark:text-white font-semibold">{totalProperties} 筆記錄</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 dark:text-white/50">資產擁有方</p>
                                    <p className="text-zinc-900 dark:text-white font-semibold">{totalProprietors} 筆記錄</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 dark:text-white/50">出租記錄</p>
                                    <p className="text-zinc-900 dark:text-white font-semibold">{totalRents} 筆記錄</p>
                                </div>
                            </div>
                        </BentoCard>

                    </>
                )}

                {/* Client-Only Summary */}
                {userRole !== 'admin' && (
                    <BentoCard
                        title="我的概覽"
                        subtitle="您的個人數據統計"
                        icon={<BarChart3 className="w-5 h-5" />}
                        size="wide"
                        gradient="purple"
                    >
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalProperties}</p>
                                <p className="text-zinc-500 dark:text-white/50 text-sm">我的物業</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalIncome.toLocaleString()}</p>
                                <p className="text-zinc-500 dark:text-white/50 text-sm">我的收入</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">${totalExpenses.toLocaleString()}</p>
                                <p className="text-zinc-500 dark:text-white/50 text-sm">我的支出</p>
                            </div>
                        </div>
                    </BentoCard>
                )}
            </BentoGrid>
        </div>
    );
}
