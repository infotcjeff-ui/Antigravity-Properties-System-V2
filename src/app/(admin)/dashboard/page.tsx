'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    useDashboardStatsQuery,
    useRentsWithRelationsQuery,
    usePropertiesQuery,
    useProprietorsQuery,
} from '@/hooks/useStorage';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import {
    Building2,
    Users,
    FileText,
    ArrowUpCircle,
    ArrowDownCircle,
    ChevronRight,
    Clock,
    CheckCircle2,
    XCircle,
    TrendingUp,
    Home,
    CircleDot,
    Ban,
    Package,
    RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRentOutCollectionDisplayPeriod } from '@/lib/rentPaymentDisplay';

/* ================================================
   2026 趨勢總覽頁面
   五大區塊：物業 · 業主 · 合約 · 收租 · 交租
   ================================================ */

type LeaseTab = 'leasing' | 'terminated';
type RentOutTab = 'paid' | 'unpaid';
type ContractTab = 'contract' | 'rent_out';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.05 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

function formatDate(d: unknown): string {
    if (d == null || d === '') return '—';
    const t = new Date(d as string | number | Date);
    if (Number.isNaN(t.getTime())) return '—';
    return t.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatMoney(n: number): string {
    if (!n && n !== 0) return '—';
    return `$${Number(n).toLocaleString()}`;
}

function hasPaymentMethod(r: Record<string, unknown>): boolean {
    const m = r.rentCollectionPaymentMethod;
    return m != null && String(m).trim() !== '';
}

function getEndDate(r: Record<string, unknown>): unknown {
    if (r.type === 'rent_out') {
        const { end } = getRentOutCollectionDisplayPeriod(r as Parameters<typeof getRentOutCollectionDisplayPeriod>[0]);
        return end ?? r.endDate ?? (r as any).rentOutEndDate;
    }
    if (r.type === 'renting') {
        return (r as any).rentingEndDate ?? r.endDate;
    }
    if (r.type === 'contract') {
        return (r as any).rentOutEndDate ?? r.endDate;
    }
    return null;
}

function getMonthlyAmount(r: Record<string, unknown>): string {
    if (r.type === 'rent_out') {
        const n = Number((r as any).rentOutMonthlyRental ?? (r as any).amount ?? 0);
        return n ? formatMoney(n) : '—';
    }
    const n = Number((r as any).rentingMonthlyRental ?? (r as any).amount ?? 0);
    return n ? formatMoney(n) : '—';
}

function getRefNo(r: Record<string, unknown>): string {
    return String(
        (r as any).rentOutTenancyNumber ??
        (r as any).rentCollectionContractNumber ??
        (r as any).rentingNumber ??
        (r as any).contractNumber ??
        ''
    ).trim() || '—';
}

function getPropertyLabel(r: Record<string, unknown>): string {
    const prop = r.property as { name?: string; code?: string } | undefined;
    return String(prop?.name || prop?.code || '—').trim() || '—';
}

function getContractAmount(r: Record<string, unknown>): string {
    const n = Number((r as any).rentOutMonthlyRental ?? 0);
    return n ? formatMoney(n) : '—';
}

function getContractPeriod(r: Record<string, unknown>): string {
    const start = (r as any).rentOutStartDate;
    const end = (r as any).rentOutEndDate;
    const s = start ? formatDate(start) : '—';
    const e = end ? formatDate(end) : '—';
    return `${s} ~ ${e}`;
}

/* ---------- Section Header ---------- */
interface SectionHeaderProps {
    icon: React.ReactNode;
    title: string;
    count: number;
    accentColor: string;
    href?: string;
}

function SectionHeader({ icon, title, count, accentColor, href }: SectionHeaderProps) {
    const content = (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                    accentColor
                )}>
                    {icon}
                </div>
                <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">{title}</h2>
                    <p className="text-sm text-zinc-400 dark:text-white/40">{count} 筆</p>
                </div>
            </div>
            {href && (
                <span className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-white/70 transition-colors group cursor-pointer">
                    <span className="hidden sm:inline">詳情</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
            )}
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
            >
                {content}
            </Link>
        );
    }
    return content;
}

/* ---------- Status Badge ---------- */
interface BadgeProps {
    label: string;
    variant: 'green' | 'amber' | 'red' | 'blue' | 'zinc';
    dot?: boolean;
}

function Badge({ label, variant, dot }: BadgeProps) {
    const variants: Record<string, string> = {
        green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
        amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
        red: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
        blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20',
        zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-white/5 dark:text-white/60 dark:ring-white/10',
    };
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
            variants[variant]
        )}>
            {dot && (
                <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    variant === 'green' && 'bg-emerald-500',
                    variant === 'amber' && 'bg-amber-500',
                    variant === 'red' && 'bg-rose-500',
                    variant === 'blue' && 'bg-blue-500',
                    variant === 'zinc' && 'bg-zinc-400',
                )} />
            )}
            {label}
        </span>
    );
}

/* ---------- List Row ---------- */
interface ListRowProps {
    cells: { label: string; sub?: string }[];
    badge?: React.ReactNode;
    href?: string;
    hrefLabel?: string;
    hoverColor?: 'violet' | 'blue' | 'amber' | 'emerald' | 'rose';
}

const HOVER_COLORS = {
    violet: 'hover:bg-violet-50/70 dark:hover:bg-violet-500/10 hover:shadow-sm hover:shadow-violet-200/60 dark:hover:shadow-violet-900/30',
    blue: 'hover:bg-blue-50/70 dark:hover:bg-blue-500/10 hover:shadow-sm hover:shadow-blue-200/60 dark:hover:shadow-blue-900/30',
    amber: 'hover:bg-amber-50/70 dark:hover:bg-amber-500/10 hover:shadow-sm hover:shadow-amber-200/60 dark:hover:shadow-amber-900/30',
    emerald: 'hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10 hover:shadow-sm hover:shadow-emerald-200/60 dark:hover:shadow-emerald-900/30',
    rose: 'hover:bg-rose-50/70 dark:hover:bg-rose-500/10 hover:shadow-sm hover:shadow-rose-200/60 dark:hover:shadow-rose-900/30',
} as const;

function ListRow({ cells, badge, href, hrefLabel, hoverColor = 'violet' }: ListRowProps) {
    const content = (
        <div className={cn('flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-150 group cursor-pointer', HOVER_COLORS[hoverColor])}>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-white/90 truncate">
                    {cells[0]?.label}
                    {cells[0]?.sub && <span className="font-normal text-zinc-400 dark:text-white/40 ml-1.5">{cells[0].sub}</span>}
                </p>
            </div>
            {cells.length > 1 && (
                <div className="hidden sm:flex items-center gap-6 text-xs text-zinc-500 dark:text-white/50 shrink-0">
                    {cells.slice(1).map((c, i) => (
                        <div key={i} className="text-right min-w-[80px]">
                            <p className="font-medium text-zinc-700 dark:text-white/70">{c.label}</p>
                            {c.sub && <p className="text-zinc-400 dark:text-white/35">{c.sub}</p>}
                        </div>
                    ))}
                </div>
            )}
            {badge && <div className="shrink-0">{badge}</div>}
            {href && (
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 dark:group-hover:text-white/40 transition-colors shrink-0" />
            )}
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40">
                {content}
            </Link>
        );
    }
    return <div className="rounded-xl">{content}</div>;
}

/* ---------- Section Card ---------- */
interface SectionCardProps {
    children: React.ReactNode;
    className?: string;
}

function SectionCard({ children, className }: SectionCardProps) {
    return (
        <motion.div
            variants={itemVariants}
            className={cn(
                'rounded-2xl border border-zinc-200/80 bg-white/90 dark:border-white/[0.08] dark:bg-zinc-900/50',
                'ring-1 ring-zinc-900/[0.04] dark:ring-white/[0.04]',
                'overflow-hidden',
                className
            )}
        >
            {children}
        </motion.div>
    );
}

/* ---------- Empty State ---------- */
function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-center py-10 text-sm text-zinc-400 dark:text-white/35">
            {message}
        </div>
    );
}

/* ---------- Loading Skeleton ---------- */
function SkeletonRows({ rows = 3 }: { rows?: number }) {
    return (
        <div className="space-y-2 px-4 py-4">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                    <div className="h-4 w-24 rounded-lg bg-zinc-100 dark:bg-white/5 animate-pulse" />
                    <div className="h-4 w-16 rounded-lg bg-zinc-100 dark:bg-white/5 animate-pulse ml-auto" />
                    <div className="h-4 w-12 rounded-lg bg-zinc-100 dark:bg-white/5 animate-pulse" />
                </div>
            ))}
        </div>
    );
}

/* ================================================
   主元件
   ================================================ */
export default function DashboardPage() {
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);
    const { user } = useAuth();
    const userDisplayName = user?.displayName || user?.username || '';

    const { data: stats, isLoading: statsLoading } = useDashboardStatsQuery();
    const { data: rents = [], isLoading: rentsLoading } = useRentsWithRelationsQuery({ enabled: true });
    const { data: contractContract = [], isLoading: contractLoading } = useRentsWithRelationsQuery({ type: 'contract' });
    const { data: properties = [], isLoading: propsLoading } = usePropertiesQuery();
    const { data: proprietors = [], isLoading: propsrLoading } = useProprietorsQuery();

    const [userRole, setUserRole] = useState<string>('client');
    const [contractTab, setContractTab] = useState<ContractTab>('contract');
    const [rentOutTab, setRentOutTab] = useState<RentOutTab>('paid');
    const [rentingTab, setRentingTab] = useState<LeaseTab>('leasing');

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

    const isInitialLoading = statsLoading && !stats;

    /* ---- 資料分類 ---- */
    const { paidRents, unpaidRents, leasingRows, terminatedRows } = useMemo(() => {
        const list = rents as Record<string, unknown>[];

        const paidRents = list.filter(
            (r) => r.type === 'rent_out' && hasPaymentMethod(r)
        );
        const unpaidRents = list.filter(
            (r) => r.type === 'rent_out' && !hasPaymentMethod(r)
        );

        const leasingRows = list.filter(
            (r) => r.type === 'renting' && hasPaymentMethod(r)
        );
        const terminatedRows = list.filter(
            (r) => r.type === 'renting' && !hasPaymentMethod(r)
        );

        return { paidRents, unpaidRents, leasingRows, terminatedRows };
    }, [rents]);

    const isAnyLoading = statsLoading || rentsLoading || contractLoading || propsLoading || propsrLoading;

    /* ---- 租賃合約 / 出租合約 ---- */
    const totalProperties = stats?.totalProperties ?? 0;
    const totalProprietors = stats?.totalProprietors ?? 0;
    /** 租賃合約：type=contract 且 status=leasing_in（與 contracts page 一致） */
    const contractContractCount = (contractContract as Record<string, unknown>[]).filter(
        (r) => (r.rentOutStatus || r.status) === 'leasing_in'
    ).length;
    /** 出租合約：type=contract 且非 leasing_in（與 contracts page 一致） */
    const contractRentOutCount = (contractContract as Record<string, unknown>[]).filter(
        (r) => (r.rentOutStatus || r.status) !== 'leasing_in'
    ).length;

    /** 過濾後的租賃合約列表（與 contracts page 排序一致：最早優先） */
    const contractContractFiltered = useMemo(() => {
        return [...(contractContract as Record<string, unknown>[])]
            .filter((r) => (r.rentOutStatus || r.status) === 'leasing_in')
            .sort((a, b) => {
                const startA = a.rentOutStartDate ? new Date(a.rentOutStartDate as string).getTime() : 0;
                const startB = b.rentOutStartDate ? new Date(b.rentOutStartDate as string).getTime() : 0;
                return startA - startB;
            });
    }, [contractContract]);

    /** 過濾後的出租合約列表（與 contracts page 排序一致：最近完結優先） */
    const contractRentOutFiltered = useMemo(() => {
        return [...(contractContract as Record<string, unknown>[])]
            .filter((r) => (r.rentOutStatus || r.status) !== 'leasing_in')
            .sort((a, b) => {
                const endA = a.rentOutEndDate ? new Date(a.rentOutEndDate as string).getTime() : Number.MAX_SAFE_INTEGER;
                const endB = b.rentOutEndDate ? new Date(b.rentOutEndDate as string).getTime() : Number.MAX_SAFE_INTEGER;
                return endA - endB;
            });
    }, [contractContract]);

    if (isInitialLoading) {
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

    return (
        <motion.div
            className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 pb-12"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* ===== 頁面標題 ===== */}
            <motion.section variants={itemVariants}>
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 p-6 dark:border-white/[0.08] dark:bg-zinc-900/40 ring-1 ring-zinc-900/[0.04] dark:ring-white/[0.04]">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
                        style={{
                            background: `
                                radial-gradient(ellipse 80% 60% at 0% -10%, rgba(139, 92, 246, 0.2), transparent 55%),
                                radial-gradient(ellipse 60% 40% at 100% 0%, rgba(59, 130, 246, 0.15), transparent 50%)
                            `,
                        }}
                    />
                    <div className="relative">
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                            {userRole === 'admin' ? t('Overview', '總覽') : t('My Overview', '我的總覽')}
                        </h1>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-white/45">
                            {userDisplayName}{userDisplayName ? '，' : ''}歡迎回來。以下是目前的的物業概況。
                        </p>
                    </div>
                </div>
            </motion.section>

            {/* ===== 五大區塊 ===== */}
            {/* 第一行：物業 + 業主（full width） */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ---- 1. 物業 ---- */}
                <SectionCard className="lg:col-span-6">
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <SectionHeader
                            icon={<Building2 className="w-5 h-5 text-white" />}
                            title={t('Properties', '物業')}
                            count={totalProperties}
                            accentColor="bg-gradient-to-br from-violet-500 to-purple-600"
                            href="/dashboard/properties"
                        />
                    </div>

                    {/* 物業列表 */}
                    <div className="px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/30">
                            {t('Properties', '物業')}
                        </span>
                    </div>
                    {propsLoading ? (
                        <SkeletonRows rows={3} />
                    ) : properties.length === 0 ? (
                        <EmptyState message={t('No properties yet', '暫無物業')} />
                    ) : (
                        <div className="px-2 pb-3 space-y-0.5">
                                {properties.slice(0, 5).map((p: any) => (
                                    <ListRow
                                        key={p.id}
                                        href={`/dashboard/properties/${p.id}`}
                                        cells={[
                                            { label: p.name || '—', sub: p.code },
                                        ]}
                                        badge={
                                            <Badge
                                                label={
                                                    p.status === 'holding' ? t('Holding', '持有') :
                                                    p.status === 'renting' ? t('Renting', '出租中') :
                                                    p.status === 'sold' ? t('Sold', '已售') :
                                                    p.status === 'suspended' ? t('Suspended', '暫停') : '—'
                                                }
                                                variant={
                                                    p.status === 'holding' ? 'blue' :
                                                    p.status === 'renting' ? 'green' :
                                                    p.status === 'sold' ? 'amber' : 'zinc'
                                                }
                                                dot
                                            />
                                        }
                                        hoverColor="violet"
                                    />
                                ))}
                        </div>
                    )}
                        {/* 查看全部 */}
                        <div className="flex justify-center pb-3">
                            <Link href="/dashboard/properties" className="text-xs text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                                {t('View all', '查看全部')}
                            </Link>
                        </div>
                </SectionCard>

                {/* ---- 2. 業主 ---- */}
                <SectionCard className="lg:col-span-6">
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <SectionHeader
                            icon={<Users className="w-5 h-5 text-white" />}
                            title={t('Proprietors', '業主')}
                            count={totalProprietors}
                            accentColor="bg-gradient-to-br from-blue-500 to-cyan-600"
                            href="/dashboard/proprietors"
                        />
                    </div>

                    <div className="border-t border-zinc-100 dark:border-white/[0.06]">
                        <div className="px-4 py-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/30">
                                {t('Proprietors', '業主')}
                            </span>
                        </div>
                        {propsrLoading ? (
                            <SkeletonRows rows={3} />
                        ) : proprietors.length === 0 ? (
                            <EmptyState message={t('No proprietors yet', '暫無業主')} />
                        ) : (
                            <div className="px-2 pb-3 space-y-0.5">
                                {proprietors.slice(0, 5).map((p: any) => (
                                    <ListRow
                                        key={p.id}
                                        href={`/dashboard/proprietors?id=${p.id}`}
                                        cells={[
                                            { label: p.name || '—', sub: p.code },
                                        ]}
                                        badge={
                                            <Badge
                                                label={p.type === 'company' ? t('Company', '公司') : t('Individual', '個人')}
                                                variant="zinc"
                                            />
                                        }
                                        hoverColor="blue"
                                    />
                                ))}
                            </div>
                        )}
                        {/* 查看全部 */}
                        <div className="flex justify-center pb-3">
                            <Link href="/dashboard/proprietors" className="text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                {t('View all', '查看全部')}
                            </Link>
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* 第二行：合約 + 收租 + 交租（full width） */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ---- 3. 合約（跨欄） ---- */}
                <SectionCard className="lg:col-span-4">
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <SectionHeader
                            icon={<FileText className="w-5 h-5 text-white" />}
                            title={t('Contracts', '合約')}
                            count={contractContractCount + contractRentOutCount}
                            accentColor="bg-gradient-to-br from-amber-500 to-orange-600"
                            href="/dashboard/contracts"
                        />
                    </div>

                    {/* Tab: 租賃合約 / 出租合約 */}
                    <div className="px-5 py-3 flex gap-2 border-b border-zinc-100 dark:border-white/[0.06]">
                        <button
                            onClick={() => setContractTab('contract')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                                contractTab === 'contract'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                    : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                            )}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('Lease Contract', '租賃合約')} <span className="tabular-nums opacity-60">({contractContractCount})</span>
                        </button>
                        <button
                            onClick={() => setContractTab('rent_out')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                                contractTab === 'rent_out'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                                    : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                            )}
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            {t('Rent-out Contract', '出租合約')} <span className="tabular-nums opacity-60">({contractRentOutCount})</span>
                        </button>
                    </div>

                    {/* 合約列表 */}
                    <div>
                        <div className="px-4 py-2 grid grid-cols-5 gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/30">
                            <span>{t('Property', '物業')}</span>
                            <span className="text-left">
                                {t('Contract No.', '合約號碼')}
                            </span>
                            <span className="text-left">
                                {contractTab === 'contract'
                                    ? t('Lease Amount', '租賃金額')
                                    : t('Rent Amount', '出租金額')}
                            </span>
                            <span className="text-left">{t('Period', '租期')}</span>
                            <span className="text-left">{t('Status', '狀態')}</span>
                        </div>
                        {rentsLoading || contractLoading ? (
                            <SkeletonRows rows={3} />
                        ) : (contractTab === 'contract' ? contractContractFiltered : contractRentOutFiltered).length === 0 ? (
                            <EmptyState message={t('No contracts yet', '暫無合約')} />
                        ) : (
                            <div className="px-2 pb-3 space-y-0.5">
                                {(contractTab === 'contract' ? contractContractFiltered : contractRentOutFiltered).slice(0, 5).map((r: any) => {
                                    const propLabel = getPropertyLabel(r);
                                    const refNo = getRefNo(r);
                                    const period = getContractPeriod(r);
                                    const status = r.rentOutStatus || r.status;
                                    return (
                                        <Link
                                            key={String(r.id)}
                                            href="/dashboard/contracts"
                                            className="grid grid-cols-5 gap-2 py-3 px-4 rounded-xl hover:bg-amber-50/70 dark:hover:bg-amber-500/10 hover:shadow-sm hover:shadow-amber-200/60 dark:hover:shadow-amber-900/30 transition-all duration-150 group cursor-pointer"
                                        >
                                            <span className="text-sm font-medium text-zinc-800 dark:text-white/90 truncate">{propLabel}</span>
                                            <span className="text-xs text-zinc-700 dark:text-white/70 truncate" title={refNo}>{refNo}</span>
                                            <span className="text-xs text-zinc-700 dark:text-white/70 truncate" title={getContractAmount(r)}>{getContractAmount(r)}</span>
                                            <span className="text-xs text-zinc-500 dark:text-white/50 truncate" title={period}>{period}</span>
                                            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                                                <Badge
                                                    label={
                                                        status === 'listing' ? t('Listing', '放盤中') :
                                                        status === 'renting' ? t('Renting', '出租中') :
                                                        status === 'leasing_in' ? t('Leasing In', '租入中') :
                                                        status === 'completed' ? t('Completed', '已完結') : '—'
                                                    }
                                                    variant={
                                                        status === 'listing' ? 'zinc' :
                                                        status === 'renting' ? 'green' :
                                                        status === 'leasing_in' ? 'blue' :
                                                        status === 'completed' ? 'amber' : 'zinc'
                                                    }
                                                    dot
                                                />
                                                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {/* 查看全部 */}
                    <div className="flex justify-center py-3 border-t border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/contracts" className="text-xs text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                            {t('View all', '查看全部')}
                        </Link>
                    </div>
                </SectionCard>

                {/* ---- 4. 收租（跨欄） ---- */}
                <SectionCard className="lg:col-span-4">
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <SectionHeader
                            icon={<ArrowUpCircle className="w-5 h-5 text-white" />}
                            title={t('Rent Collection', '收租')}
                            count={paidRents.length + unpaidRents.length}
                            accentColor="bg-gradient-to-br from-emerald-500 to-teal-600"
                            href="/dashboard/rent-out"
                        />
                    </div>

                    {/* Tab: 已繳 / 未繳 */}
                    <div className="px-5 py-3 flex gap-2 border-b border-zinc-100 dark:border-white/[0.06]">
                        <button
                            onClick={() => setRentOutTab('paid')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                                rentOutTab === 'paid'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                    : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                            )}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('Paid', '已繳付')} <span className="tabular-nums opacity-60">({paidRents.length})</span>
                        </button>
                        <button
                            onClick={() => setRentOutTab('unpaid')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                                rentOutTab === 'unpaid'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                                    : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                            )}
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            {t('Unpaid', '未繳付')} <span className="tabular-nums opacity-60">({unpaidRents.length})</span>
                        </button>
                    </div>

                    {/* 收租列表 */}
                    <div>
                        <div className="px-4 py-2 grid grid-cols-5 gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/30">
                            <span>{t('Property', '物業')}</span>
                            <span className="text-left">{t('Ref. No.', '編號')}</span>
                            <span className="text-left">{t('Current Tenant', '現時租客')}</span>
                            <span className="text-left">{t('Payment Date', '付款日期')}</span>
                            <span className="text-left">{t('Status', '狀態')}</span>
                        </div>
                        {rentsLoading ? (
                            <SkeletonRows rows={3} />
                        ) : (rentOutTab === 'paid' ? paidRents : unpaidRents).length === 0 ? (
                            <EmptyState message={t('No records', '暫無記錄')} />
                        ) : (
                            <div className="px-2 pb-3 space-y-0.5">
                                {(rentOutTab === 'paid' ? paidRents : unpaidRents).slice(0, 5).map((r: any) => {
                                    const propLabel = getPropertyLabel(r);
                                    const refNo = getRefNo(r);
                                    const currentTenantName = r.currentTenant?.name || r.tenant?.name || '—';
                                    const paymentDate = r.rentCollectionPaymentDate ? formatDate(r.rentCollectionPaymentDate) : '—';
                                    return (
                                        <Link
                                            key={String(r.id)}
                                            href="/dashboard/rent-out"
                                            className="grid grid-cols-5 gap-2 py-3 px-4 rounded-xl hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10 hover:shadow-sm hover:shadow-emerald-200/60 dark:hover:shadow-emerald-900/30 transition-all duration-150 group cursor-pointer"
                                        >
                                            <span className="text-sm font-medium text-zinc-800 dark:text-white/90 truncate">{propLabel}</span>
                                            <span className="text-xs text-zinc-700 dark:text-white/70 truncate" title={refNo}>{refNo}</span>
                                            <span className="text-xs text-zinc-700 dark:text-white/70 truncate" title={currentTenantName}>{currentTenantName}</span>
                                            <span className="text-xs text-zinc-500 dark:text-white/50 truncate" title={paymentDate}>{paymentDate}</span>
                                            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                                                <Badge
                                                    label={rentOutTab === 'paid' ? t('Paid', '已繳') : t('Unpaid', '未繳')}
                                                    variant={rentOutTab === 'paid' ? 'green' : 'red'}
                                                    dot
                                                />
                                                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {/* 查看全部 */}
                    <div className="flex justify-center py-3 border-t border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/rent-out" className="text-xs text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                            {t('View all', '查看全部')}
                        </Link>
                    </div>
                </SectionCard>

                {/* ---- 5. 交租 ---- */}
                <SectionCard className="lg:col-span-4">
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <SectionHeader
                            icon={<ArrowDownCircle className="w-5 h-5 text-white" />}
                            title={t('Rent Payment', '交租')}
                            count={leasingRows.length + terminatedRows.length}
                            accentColor="bg-gradient-to-br from-rose-500 to-pink-600"
                            href="/dashboard/renting"
                        />
                    </div>

                    {/* Tab: 租賃中 / 已終止 */}
                    <div className="px-5 py-3 flex gap-2 border-b border-zinc-100 dark:border-white/[0.06]">
                        <button
                            onClick={() => setRentingTab('leasing')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                                rentingTab === 'leasing'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                                    : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                            )}
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {t('Active', '租賃中')} <span className="tabular-nums opacity-60">({leasingRows.length})</span>
                        </button>
                        <button
                            onClick={() => setRentingTab('terminated')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                                rentingTab === 'terminated'
                                    ? 'bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-white/60'
                                    : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                            )}
                        >
                            <Ban className="w-3.5 h-3.5" />
                            {t('Terminated', '已終止')} <span className="tabular-nums opacity-60">({terminatedRows.length})</span>
                        </button>
                    </div>

                    {/* 交租列表 */}
                    <div>
                        <div className="px-4 py-2 grid grid-cols-5 gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/30">
                            <span>{t('Property', '物業')}</span>
                            <span className="text-left">{t('Owner', '業主')}</span>
                            <span className="text-left">{t('Tenant', '承租人')}</span>
                            <span className="text-left">{t('Payment Date', '付款日期')}</span>
                            <span className="text-left">{t('Status', '狀態')}</span>
                        </div>
                        {rentsLoading ? (
                            <SkeletonRows rows={3} />
                        ) : (rentingTab === 'leasing' ? leasingRows : terminatedRows).length === 0 ? (
                            <EmptyState message={t('No records', '暫無記錄')} />
                        ) : (
                            <div className="px-2 pb-3 space-y-0.5">
                                {(rentingTab === 'leasing' ? leasingRows : terminatedRows).slice(0, 5).map((r: any) => {
                                    const propLabel = getPropertyLabel(r);
                                    const ownerName = r.proprietor?.name || '—';
                                    const tenantName = r.rentCollectionTenantName || r.tenant?.name || '—';
                                    const paymentDate = r.rentCollectionPaymentDate ? formatDate(r.rentCollectionPaymentDate) : '—';
                                    return (
                                        <Link
                                            key={String(r.id)}
                                            href="/dashboard/renting"
                                            className="grid grid-cols-5 gap-2 py-3 px-4 rounded-xl hover:bg-rose-50/70 dark:hover:bg-rose-500/10 hover:shadow-sm hover:shadow-rose-200/60 dark:hover:shadow-rose-900/30 transition-all duration-150 group cursor-pointer"
                                        >
                                            <span className="text-sm font-medium text-zinc-800 dark:text-white/90 truncate">{propLabel}</span>
                                            <span className="text-xs text-zinc-700 dark:text-white/70 truncate" title={ownerName}>{ownerName}</span>
                                            <span className="text-xs text-zinc-700 dark:text-white/70 truncate" title={tenantName}>{tenantName}</span>
                                            <span className="text-xs text-zinc-500 dark:text-white/50 truncate" title={paymentDate}>{paymentDate}</span>
                                            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                                                <Badge
                                                    label={rentingTab === 'leasing' ? t('Active', '租賃中') : t('Ended', '已終止')}
                                                    variant={rentingTab === 'leasing' ? 'blue' : 'zinc'}
                                                    dot
                                                />
                                                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {/* 查看全部 */}
                    <div className="flex justify-center py-3 border-t border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/renting" className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                            {t('View all', '查看全部')}
                        </Link>
                    </div>
                </SectionCard>

            </div>
        </motion.div>
    );
}
