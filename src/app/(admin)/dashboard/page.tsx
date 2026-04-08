'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useDashboardStatsQuery, useRentsWithRelationsQuery } from '@/hooks/useStorage';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import { Building2, Users, TrendingUp, TrendingDown, Activity, PieChart } from 'lucide-react';
import { BentoCard, StatCard } from '@/components/layout/BentoGrid';
import { getRentOutCollectionDisplayPeriod, getRentOutOrContractListNumber } from '@/lib/rentPaymentDisplay';
import { cn } from '@/lib/utils';

/** 暫時隱藏「租務概覽」區塊；改為 true 可恢復顯示 */
const SHOW_LEASE_OVERVIEW = false;

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

type LeaseTab = 'leasing' | 'rented_out' | 'unpaid';

function formatListDate(d: unknown): string {
    if (d == null || d === '') return '—';
    const t = new Date(d as string | number | Date);
    if (Number.isNaN(t.getTime())) return '—';
    return t.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * 收／交租記錄是否已選付款方式（與 rentPaymentDisplay 列表「已繳付」之付款方式判斷一致）
 */
function hasRentCollectionPaymentMethodSelected(r: { rentCollectionPaymentMethod?: string | null }): boolean {
    const m = r.rentCollectionPaymentMethod;
    return m != null && String(m).trim() !== '';
}

/** 列表「月租」欄：與收租／交租主檔一致；無設定則顯示 — */
function formatListMonthlyAmount(r: Record<string, unknown>): string {
    if (r.type === 'rent_out') {
        const m = (r as { rentOutMonthlyRental?: number | null; amount?: number | null }).rentOutMonthlyRental;
        const a = (r as { amount?: number | null }).amount;
        if (m == null && a == null) return '—';
        const n = Number(m ?? a ?? 0);
        return `$${n.toLocaleString()}`;
    }
    const m = (r as { rentingMonthlyRental?: number | null; amount?: number | null }).rentingMonthlyRental;
    const a = (r as { amount?: number | null }).amount;
    if (m == null && a == null) return '—';
    const n = Number(m ?? a ?? 0);
    return `$${n.toLocaleString()}`;
}

function leasePeriodEndForDisplay(r: Record<string, unknown>): unknown {
    if (r.type === 'rent_out') {
        const { end } = getRentOutCollectionDisplayPeriod(r as Parameters<typeof getRentOutCollectionDisplayPeriod>[0]);
        return end ?? r.endDate ?? r.rentOutEndDate;
    }
    if (r.type === 'renting') {
        return r.rentingEndDate ?? r.endDate;
    }
    return null;
}

export default function DashboardPage() {
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);

    const { data: stats, isLoading: statsLoading } = useDashboardStatsQuery();
    const { data: rents = [], isLoading: rentsLoading } = useRentsWithRelationsQuery({
        enabled: SHOW_LEASE_OVERVIEW,
    });

    const [userRole, setUserRole] = useState<string>('client');
    const [leaseTab, setLeaseTab] = useState<LeaseTab>('leasing');

    useEffect(() => {
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

    const { leasingRows, rentedOutRows, unpaidRows } = useMemo(() => {
        const list = rents as Record<string, unknown>[];
        /** 租賃中：交租（renting）且已選付款方式 */
        const leasingRows = list.filter(
            (r) => r.type === 'renting' && hasRentCollectionPaymentMethodSelected(r as { rentCollectionPaymentMethod?: string | null }),
        );
        /** 出租中：收租（rent_out）且已選付款方式 */
        const rentedOutRows = list.filter(
            (r) => r.type === 'rent_out' && hasRentCollectionPaymentMethodSelected(r as { rentCollectionPaymentMethod?: string | null }),
        );
        /** 未繳付：收租或交租，且尚未選付款方式 */
        const unpaidRows = list.filter((r) => {
            if (r.type !== 'rent_out' && r.type !== 'renting') return false;
            return !hasRentCollectionPaymentMethodSelected(r as { rentCollectionPaymentMethod?: string | null });
        });
        return { leasingRows, rentedOutRows, unpaidRows };
    }, [rents]);

    const activeRows =
        leaseTab === 'leasing' ? leasingRows : leaseTab === 'rented_out' ? rentedOutRows : unpaidRows;

    const totalProperties = stats?.totalProperties || 0;
    const totalProprietors = stats?.totalProprietors || 0;
    const monthlyRentCollected = stats?.monthlyRentCollected ?? 0;
    const monthlyRentPaid = stats?.monthlyRentPaid ?? 0;

    if (statsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-12 h-12 rounded-full bg-violet-500"
                />
            </div>
        );
    }

    const pageTitle =
        userRole === 'admin' ? t('Overview', '總覽') : t('My overview', '我的總覽');
    const pageSubtitle =
        userRole === 'admin'
            ? t('Full system snapshot and key metrics.', '即時掌握營運數據與物業概況。')
            : t('Your properties and leasing at a glance.', '您的物業與租賃概覽。');

    const tabActiveLeasing =
        'bg-violet-500/15 text-violet-900 ring-1 ring-violet-500/30 dark:bg-violet-500/12 dark:text-violet-200 dark:ring-violet-400/25';
    const tabActiveRentedOut =
        'bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20';
    const tabActiveUnpaid =
        'bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/25';

    return (
        <motion.div
            className="space-y-8 max-w-[1600px] mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            <motion.section
                variants={itemVariants}
                className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/90 bg-white/90 p-8 shadow-sm ring-1 ring-zinc-900/[0.04] dark:border-white/[0.08] dark:bg-zinc-900/40 dark:ring-white/[0.06] md:p-10"
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-40"
                    style={{
                        background: `
              radial-gradient(ellipse 90% 55% at 10% -10%, rgba(139, 92, 246, 0.18), transparent 55%),
              radial-gradient(ellipse 70% 45% at 90% 0%, rgba(59, 130, 246, 0.12), transparent 50%),
              radial-gradient(ellipse 50% 35% at 50% 100%, rgba(16, 185, 129, 0.06), transparent 45%)
            `,
                    }}
                />
                <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0 space-y-3">
                        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white md:text-4xl">
                            {pageTitle}
                        </h1>
                        <p className="max-w-xl text-base leading-relaxed text-zinc-600 dark:text-white/55">{pageSubtitle}</p>
                    </div>
                </div>
            </motion.section>

            <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label={t('Properties', '物業總數')}
                    value={totalProperties}
                    icon={<Building2 className="h-6 w-6 text-white" />}
                    gradient="purple"
                    href="/dashboard/properties"
                />
                <StatCard
                    label={t('Owners', '業主')}
                    value={totalProprietors}
                    icon={<Users className="h-6 w-6 text-white" />}
                    gradient="blue"
                    href="/dashboard/tenants"
                />
                <StatCard
                    label={t('Monthly rent collected', '每月收租')}
                    value={`$${monthlyRentCollected.toLocaleString()}`}
                    icon={<TrendingUp className="h-6 w-6 text-white" />}
                    gradient="green"
                    href="/dashboard/rent-out"
                />
                <StatCard
                    label={t('Monthly rent paid', '每月交租')}
                    value={`$${monthlyRentPaid.toLocaleString()}`}
                    icon={<TrendingDown className="h-6 w-6 text-white" />}
                    gradient="orange"
                    href="/dashboard/renting"
                />
            </motion.div>

            <motion.div variants={itemVariants}>
                {SHOW_LEASE_OVERVIEW && (
                    <BentoCard
                        title={t('Lease activity', '租務概覽')}
                        subtitle={t(
                            'Rent payment with method, rent collection with method, or payment method not yet selected.',
                            '租賃中：交租已選付款方式；出租中：收租已選付款方式；未繳付：尚未選擇付款方式。',
                        )}
                        icon={<Activity className="h-5 w-5" />}
                        size="wide"
                        gradient="green"
                    >
                        <div className="flex flex-wrap gap-2 border-b border-zinc-200/80 pb-3 dark:border-white/10">
                            <button
                                type="button"
                                onClick={() => setLeaseTab('leasing')}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                    leaseTab === 'leasing' ? tabActiveLeasing : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5',
                                )}
                            >
                                {t('Leasing', '租賃中')}
                                <span className="ml-1.5 tabular-nums text-zinc-400">({leasingRows.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeaseTab('rented_out')}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                    leaseTab === 'rented_out' ? tabActiveRentedOut : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5',
                                )}
                            >
                                {t('Rented out', '出租中')}
                                <span className="ml-1.5 tabular-nums text-zinc-400">({rentedOutRows.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeaseTab('unpaid')}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                    leaseTab === 'unpaid' ? tabActiveUnpaid : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5',
                                )}
                            >
                                {t('Unpaid', '未繳付')}
                                <span className="ml-1.5 tabular-nums text-zinc-400">({unpaidRows.length})</span>
                            </button>
                        </div>

                        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-white/10">
                            {rentsLoading ? (
                                <div className="flex items-center justify-center py-16 text-sm text-zinc-500 dark:text-white/45">
                                    {t('Loading…', '載入中…')}
                                </div>
                            ) : activeRows.length === 0 ? (
                                <div className="flex items-center justify-center py-16 text-sm text-zinc-500 dark:text-white/45">
                                    {t('No records', '暫無資料')}
                                </div>
                            ) : (
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45">
                                            <th className="px-4 py-3">{t('Property', '物業')}</th>
                                            <th className="px-4 py-3">{t('Ref. no.', '編號')}</th>
                                            <th className="px-4 py-3">{t('Monthly / amount', '月租／金額')}</th>
                                            <th className="px-4 py-3">{t('Lease until', '租期至')}</th>
                                            {leaseTab === 'unpaid' && (
                                                <th className="px-4 py-3">{t('Type', '類型')}</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                                        {activeRows.map((r) => {
                                            const prop = r.property as { id?: string; name?: string; code?: string } | undefined;
                                            const propLabel = String(prop?.name || prop?.code || '—').trim() || '—';
                                            const propId = prop?.id;
                                            const refNo = getRentOutOrContractListNumber(
                                                r as Parameters<typeof getRentOutOrContractListNumber>[0],
                                            );
                                            const isOut = r.type === 'rent_out';
                                            const amountLabel = formatListMonthlyAmount(r);
                                            const endRaw = leasePeriodEndForDisplay(r);
                                            return (
                                                <tr
                                                    key={String(r.id)}
                                                    className="bg-white/40 hover:bg-zinc-50/90 dark:bg-transparent dark:hover:bg-white/[0.04]"
                                                >
                                                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                                                        {propId ? (
                                                            <Link
                                                                href={`/dashboard/properties/${propId}`}
                                                                className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                                                            >
                                                                {propLabel}
                                                            </Link>
                                                        ) : (
                                                            propLabel
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-white/70">
                                                        {refNo || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 tabular-nums text-zinc-800 dark:text-white/85">
                                                        {amountLabel}
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-600 dark:text-white/65">
                                                        {formatListDate(endRaw)}
                                                    </td>
                                                    {leaseTab === 'unpaid' && (
                                                        <td className="px-4 py-3 text-zinc-600 dark:text-white/65">
                                                            {isOut ? t('Rent collection', '收租') : t('Rent payment', '交租')}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </BentoCard>
                )}

                {userRole !== 'admin' && (
                    <div className="mt-5">
                        <BentoCard
                            title={t('My snapshot', '我的概覽')}
                            subtitle={t('Your personal figures', '您的個人數據統計')}
                            icon={<PieChart className="h-5 w-5" />}
                            size="wide"
                            gradient="purple"
                        >
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{totalProperties}</p>
                                    <p className="text-sm text-zinc-500 dark:text-white/50">{t('My properties', '我的物業')}</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                                        ${monthlyRentCollected.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-zinc-500 dark:text-white/50">
                                        {t('Monthly rent collected', '每月收租')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
                                        ${monthlyRentPaid.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-zinc-500 dark:text-white/50">
                                        {t('Monthly rent paid', '每月交租')}
                                    </p>
                                </div>
                            </div>
                        </BentoCard>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
