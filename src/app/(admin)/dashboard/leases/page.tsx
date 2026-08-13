'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    useRentsWithRelationsQuery,
} from '@/hooks/useStorage';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import {
    FileText,
    ArrowUpCircle,
    ArrowDownCircle,
    ChevronRight,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RentOutTab = 'paid' | 'unpaid';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
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

function getContractPeriod(r: Record<string, unknown>): string {
    const start = (r as any).rentOutStartDate;
    const end = (r as any).rentOutEndDate;
    const s = start ? formatDate(start) : '—';
    const e = end ? formatDate(end) : '—';
    return `${s} ~ ${e}`;
}

function getPropertyLabel(r: Record<string, unknown>): string {
    const prop = r.property as { name?: string; code?: string } | undefined;
    return String(prop?.name || prop?.code || '—').trim() || '—';
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

function getContractAmount(r: Record<string, unknown>): string {
    const n = Number((r as any).rentOutMonthlyRental ?? 0);
    return n ? formatMoney(n) : '—';
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
function SkeletonRows({ rows = 3, px = 'px-5' }: { rows?: number; px?: string }) {
    return (
        <div className={cn('space-y-2 py-4', px)}>
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
export default function LeasesPage() {
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);

    const { data: allRents = [], isLoading: rentsLoading } = useRentsWithRelationsQuery({ enabled: true });
    const { data: contractContract = [], isLoading: contractLoading } = useRentsWithRelationsQuery({ type: 'contract' });

    const [rentOutTab, setRentOutTab] = useState<RentOutTab>('paid');

    const { paidRents, unpaidRents } = useMemo(() => {
        const list = allRents as Record<string, unknown>[];
        const paidRents = list.filter(
            (r) => r.type === 'rent_out' && hasPaymentMethod(r)
        );
        const unpaidRents = list.filter(
            (r) => r.type === 'rent_out' && !hasPaymentMethod(r)
        );
        return { paidRents, unpaidRents };
    }, [allRents]);

    /** 租賃合約：type=contract 且 status=leasing_in */
    const contractContractCount = (contractContract as Record<string, unknown>[]).filter(
        (r) => (r.rentOutStatus || r.status) === 'leasing_in'
    ).length;
    /** 出租合約：type=contract 且非 leasing_in */
    const contractRentOutCount = (contractContract as Record<string, unknown>[]).filter(
        (r) => (r.rentOutStatus || r.status) !== 'leasing_in'
    ).length;

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
                            {t('Lease Management', '租約管理')}
                        </h1>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-white/45">
                            {t('Manage contracts, rent collection and rent payment', '管理合約、收租及交租')}
                        </p>
                    </div>
                </div>
            </motion.section>

            {/* ===== 三大區塊 ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ---- 1. 合約 ---- */}
                <SectionCard>
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/contracts" className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">{t('Contracts', '合約')}</h2>
                                    <p className="text-sm text-zinc-400 dark:text-white/40">
                                        {contractContractCount + contractRentOutCount} {t('items', '項')}
                                    </p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1 text-sm text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white/70 transition-colors">
                                <span className="hidden sm:inline">{t('View', '詳情')}</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </Link>
                    </div>

                    {/* 快捷資訊 */}
                    <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500 dark:text-white/50">{t('Lease Contracts', '租賃合約')}</span>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{contractContractCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500 dark:text-white/50">{t('Rent-out Contracts', '出租合約')}</span>
                            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">{contractRentOutCount}</span>
                        </div>
                    </div>

                    <div className="px-5 py-3 border-t border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/contracts" className="flex items-center justify-center gap-2 text-sm font-medium text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                            {t('Go to Contracts', '前往合約')} <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </SectionCard>

                {/* ---- 2. 收租 ---- */}
                <SectionCard>
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/rent-out" className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                                    <ArrowUpCircle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">{t('Rent Collection', '收租')}</h2>
                                    <p className="text-sm text-zinc-400 dark:text-white/40">
                                        {paidRents.length + unpaidRents.length} {t('items', '項')}
                                    </p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1 text-sm text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white/70 transition-colors">
                                <span className="hidden sm:inline">{t('View', '詳情')}</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </Link>
                    </div>

                    {/* 快捷資訊 */}
                    <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500 dark:text-white/50">{t('Paid', '已繳付')}</span>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{paidRents.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500 dark:text-white/50">{t('Unpaid', '未繳付')}</span>
                            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">{unpaidRents.length}</span>
                        </div>
                    </div>

                    <div className="px-5 py-3 border-t border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/rent-out" className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                            {t('Go to Rent Collection', '前往收租')} <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </SectionCard>

                {/* ---- 3. 交租 ---- */}
                <SectionCard>
                    <div className="p-5 border-b border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/renting" className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600">
                                    <ArrowDownCircle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">{t('Rent Payment', '交租')}</h2>
                                    <p className="text-sm text-zinc-400 dark:text-white/40">
                                        {allRents.filter((r: any) => r.type === 'renting').length} {t('items', '項')}
                                    </p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1 text-sm text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white/70 transition-colors">
                                <span className="hidden sm:inline">{t('View', '詳情')}</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </Link>
                    </div>

                    {/* 快捷資訊 */}
                    <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500 dark:text-white/50">{t('Paid', '已繳付')}</span>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {allRents.filter((r: any) => r.type === 'renting' && r.rentCollectionPaymentMethod).length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500 dark:text-white/50">{t('Unpaid', '未繳付')}</span>
                            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                                {allRents.filter((r: any) => r.type === 'renting' && !r.rentCollectionPaymentMethod).length}
                            </span>
                        </div>
                    </div>

                    <div className="px-5 py-3 border-t border-zinc-100 dark:border-white/[0.06]">
                        <Link href="/dashboard/renting" className="flex items-center justify-center gap-2 text-sm font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                            {t('Go to Rent Payment', '前往交租')} <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </SectionCard>

            </div>
        </motion.div>
    );
}
