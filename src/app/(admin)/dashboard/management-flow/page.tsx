'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye,
    Download,
    FileText,
    Table,
    Search,
    Building2,
    ChevronDown,
    ChevronUp,
    BarChart3,
    RefreshCw,
    X,
    CheckSquare,
    Square,
    TrendingUp,
    Monitor,
    Home,
} from 'lucide-react';
import { usePropertiesQuery } from '@/hooks/useStorage';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import type { Property } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────

type ViewTab = 'property' | 'rental';

interface PropertyViewRow {
    property_id: string;
    view_count: number;
    live_count: number;
}

interface MonthlyViewRow {
    property_id: string;
    year: number;
    month: number;
    year_month: string;
    view_count: number;
}

interface PropertyViewStat {
    propertyId: string;
    propertyName: string;
    propertyCode: string;
    totalViews: number;
    liveCount: number;
    monthly: Record<string, number>;
}

type ExportFormat = 'csv' | 'pdf';

// ─── Helpers ──────────────────────────────────────────────

const MONTH_NAMES_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function getMonthsInRange(start: string, end: string): string[] {
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    const months: string[] = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return months;
}

function formatMonthLabel(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    return `${y}年${MONTH_NAMES_ZH[m - 1]}`;
}

function csvEscape(v: string | number): string {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
}

// ─── Export Functions ─────────────────────────────────────

async function exportCSV(stats: PropertyViewStat[], months: string[], tab: ViewTab) {
    const tabLabel = tab === 'property' ? '物業' : '出租';
    const header = ['物業編號', '物業名稱', '現時觀看', ...months.map(formatMonthLabel), '總瀏覽'];
    const rows = stats.map(s => [
        csvEscape(s.propertyCode),
        csvEscape(s.propertyName),
        csvEscape(s.liveCount),
        ...months.map(m => csvEscape(s.monthly[m] || 0)),
        csvEscape(s.totalViews),
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    downloadFile(csv, 'text/csv', `${tabLabel}瀏覽報告_${new Date().toISOString().split('T')[0]}.csv`);
}

async function exportPDF(stats: PropertyViewStat[], months: string[], dateRange: string, tab: ViewTab, tableRef: React.RefObject<HTMLTableElement | null>) {
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const tabLabel = tab === 'property' ? '物業' : '出租';

    if (tableRef?.current) {
        try {
            const canvas = await html2canvas(tableRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pdfW = pdf.internal.pageSize.getWidth();
            const pdfH = pdf.internal.pageSize.getHeight();
            const ratio = Math.min((pdfW - 20) / canvas.width, (pdfH - 40) / canvas.height);
            const imgW = canvas.width * ratio;
            const imgH = canvas.height * ratio;
            const x = (pdfW - imgW) / 2;
            pdf.addImage(imgData, 'PNG', x, 30, imgW, imgH);
            pdf.save(`${tabLabel}瀏覽報告_${new Date().toISOString().split('T')[0]}.pdf`);
            return;
        } catch {
            // Fallback to text-based PDF
        }
    }

    // Fallback: text-based PDF (Chinese may be garbled)
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`${tabLabel}瀏覽報告`, 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${dateRange}  Export: ${new Date().toLocaleString()}`, 14, 24);

    const colW = [50, ...months.map(() => 22), 25];
    const colX = colW.reduce<number[]>((acc, w, i) => [...acc, (acc[i - 1] || 14) + (colW[i - 1] || 0)], []);

    const headers = ['Property', ...months.map(formatMonthLabel), 'Total'];
    doc.setFillColor(100, 60, 200);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    headers.forEach((h, i) => doc.text(h, colX[i] + 1, 34));
    doc.rect(14, 28, colW.reduce((a, b) => a + b, 0), 10, 'F');

    doc.setTextColor(40, 40, 40);
    stats.forEach((s, rowIdx) => {
        const y = 42 + rowIdx * 8;
        if (rowIdx % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(14, y - 4, colW.reduce((a, b) => a + b, 0), 8, 'F');
        }
        const label = `${s.propertyCode} ${s.propertyName}`;
        doc.text(label.substring(0, 22), colX[0] + 1, y);
        months.forEach((m, mi) => {
            doc.text(String(s.monthly[m] || 0), colX[mi + 1] + 1, y);
        });
        doc.setFont('helvetica', 'bold');
        doc.text(String(s.totalViews), colX[months.length + 1] + 1, y);
        doc.setFont('helvetica', 'normal');
    });

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('For internal use only', 14, pageH - 6);
    doc.save(`${tabLabel}Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

function downloadFile(content: string, mime: string, filename: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// ─── Tab Content ──────────────────────────────────────────

interface TabContentProps {
    tab: ViewTab;
    stats: PropertyViewStat[];
    months: string[];
    totalRow: { totalViews: number; totalLive: number; monthly: Record<string, number> };
    loading: boolean;
    propertiesLoading: boolean;
    sortField: 'totalViews' | 'propertyCode' | 'propertyName';
    sortDir: 'asc' | 'desc';
    selectedIds: string[];
    displayedStats: PropertyViewStat[];
    t: (en: string, zh: string) => string;
    onSort: (field: 'totalViews' | 'propertyCode' | 'propertyName') => void;
    onSelect: (id: string) => void;
    onSelectAll: () => void;
    onExport: (format: ExportFormat) => void;
    exportLoading: ExportFormat | null;
    tableRef: RefObject<HTMLTableElement | null>;
}

function TabContent({
    tab, stats, months, totalRow, loading, propertiesLoading,
    sortField, sortDir, selectedIds, displayedStats,
    t, onSort, onSelect, onSelectAll, onExport, exportLoading, tableRef,
}: TabContentProps) {
    const tabLabel = tab === 'property' ? '物業列表' : '出租中的物業';

    const SortIcon = ({ field }: { field: 'totalViews' | 'propertyCode' | 'propertyName' }) => {
        if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
        return sortDir === 'asc'
            ? <ChevronUp className="w-3 h-3 text-purple-500" />
            : <ChevronDown className="w-3 h-3 text-purple-500" />;
    };

    return (
        <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="relative overflow-hidden rounded-2xl border border-purple-200/50 dark:border-purple-500/20 bg-linear-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-zinc-900 p-4"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-purple-500/15 dark:bg-purple-500/20 shrink-0">
                            <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">{tabLabel} {t('Total views', '總瀏覽')}</p>
                            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 tabular-nums mt-0.5">
                                {totalRow.totalViews.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative overflow-hidden rounded-2xl border border-emerald-200/50 dark:border-emerald-500/20 bg-linear-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-zinc-900 p-4"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 shrink-0">
                            <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('Total properties', '物業總數')}</p>
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                                {stats.length}
                            </p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="relative overflow-hidden rounded-2xl border border-amber-200/50 dark:border-amber-500/20 bg-linear-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-zinc-900 p-4"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 shrink-0">
                            <Monitor className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{tabLabel} {t('Live', '現時觀看')}</p>
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                                {totalRow.totalLive}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                {loading && propertiesLoading ? (
                    <div className="flex items-center justify-center min-h-[30vh]">
                        <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-8 h-8 rounded-full bg-purple-500"
                        />
                    </div>
                ) : stats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-white/40">
                        <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-base font-medium">{t('No view data yet', '暫無瀏覽數據')}</p>
                        <p className="text-xs mt-1 opacity-70">{t('No records found in date range', '在日期範圍內沒有找到記錄')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table ref={tableRef} className="w-full min-w-150">
                            <thead>
                                <tr className="text-left text-zinc-500 dark:text-white/50 text-xs border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/2">
                                    <th className="p-3 w-10">
                                        <button onClick={onSelectAll} className="text-zinc-400 hover:text-purple-500 transition-colors">
                                            {selectedIds.length === stats.length && stats.length > 0
                                                ? <CheckSquare className="w-4 h-4 text-purple-500" />
                                                : <Square className="w-4 h-4" />}
                                        </button>
                                    </th>
                                    <th className="p-3">
                                        <button
                                            onClick={() => onSort('propertyCode')}
                                            className="flex items-center gap-1 hover:text-purple-500 transition-colors font-medium uppercase tracking-wider"
                                        >
                                            編號<SortIcon field="propertyCode" />
                                        </button>
                                    </th>
                                    <th className="p-3">
                                        <button
                                            onClick={() => onSort('propertyName')}
                                            className="flex items-center gap-1 hover:text-purple-500 transition-colors font-medium uppercase tracking-wider"
                                        >
                                            物業名稱<SortIcon field="propertyName" />
                                        </button>
                                    </th>
                                    {months.map(m => (
                                        <th key={m} className="p-3 text-center font-medium uppercase tracking-wider whitespace-nowrap text-xs">
                                            {formatMonthLabel(m)}
                                        </th>
                                    ))}
                                    <th className="p-3 text-center font-medium uppercase tracking-wider whitespace-nowrap text-xs">
                                        現時
                                    </th>
                                    <th className="p-3 text-right">
                                        <button
                                            onClick={() => onSort('totalViews')}
                                            className="flex items-center gap-1 ml-auto hover:text-purple-500 transition-colors font-medium uppercase tracking-wider"
                                        >
                                            總瀏覽<SortIcon field="totalViews" />
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedStats.map((s, i) => (
                                    <motion.tr
                                        key={s.propertyId}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.012 }}
                                        className={`border-b border-zinc-100 dark:border-white/5 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-colors ${selectedIds.includes(s.propertyId) ? 'bg-purple-50/50 dark:bg-purple-500/5' : ''}`}
                                    >
                                        <td className="p-3">
                                            <button
                                                onClick={() => onSelect(s.propertyId)}
                                                className="text-zinc-400 hover:text-purple-500 transition-colors"
                                            >
                                                {selectedIds.includes(s.propertyId)
                                                    ? <CheckSquare className="w-4 h-4 text-purple-500" />
                                                    : <Square className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="p-3 font-mono text-sm text-zinc-600 dark:text-white/70">{s.propertyCode}</td>
                                        <td className="p-3 font-medium text-zinc-900 dark:text-white max-w-50 truncate">{s.propertyName}</td>
                                        {months.map(m => (
                                            <td key={m} className="p-3 text-center text-sm text-zinc-600 dark:text-white/60 tabular-nums">
                                                {s.monthly[m] || 0}
                                            </td>
                                        ))}
                                        <td className="p-3 text-center">
                                            {s.liveCount > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    {s.liveCount}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-300 dark:text-white/20 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-sm font-semibold tabular-nums">
                                                <Eye className="w-3.5 h-3.5" />
                                                {s.totalViews.toLocaleString()}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}

                                {/* 總計行 */}
                                <tr className="border-t-2 border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5">
                                    <td className="p-3" />
                                    <td className="p-3 font-bold text-zinc-700 dark:text-white/80 text-sm" colSpan={2}>總計</td>
                                    {months.map(m => (
                                        <td key={m} className="p-3 text-center font-semibold text-purple-700 dark:text-purple-300 tabular-nums text-sm">
                                            {totalRow.monthly[m] || 0}
                                        </td>
                                    ))}
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            {totalRow.totalLive}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 dark:bg-purple-500 text-white text-base font-bold tabular-nums">
                                            {totalRow.totalViews.toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────

export default function ManagementFlowPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);

    const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();

    const [activeTab, setActiveTab] = useState<ViewTab>('property');

    const [allViews, setAllViews] = useState<PropertyViewRow[]>([]);
    const [monthlyViews, setMonthlyViews] = useState<MonthlyViewRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter & sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterProperty, setFilterProperty] = useState('');
    const [dateStart, setDateStart] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 5);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dateEnd, setDateEnd] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [sortField, setSortField] = useState<'totalViews' | 'propertyCode' | 'propertyName'>('totalViews');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [exportLoading, setExportLoading] = useState<ExportFormat | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    // ── Load data ──────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [y1, m1] = dateStart.split('-');
            const [y2, m2] = dateEnd.split('-');
            const startParam = `${y1}-${m1}`;
            const endParam = `${y2}-${m2}`;

            const [allRes, monthlyRes] = await Promise.all([
                fetch('/api/property-views-stats?all=1'),
                fetch(`/api/property-views-stats?startDate=${startParam}&endDate=${endParam}`),
            ]);

            if (allRes.ok) {
                const allData = await allRes.json();
                setAllViews(allData.data || []);
            }
            if (monthlyRes.ok) {
                const mData = await monthlyRes.json();
                setMonthlyViews(mData.data || []);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : '載入失敗');
        } finally {
            setLoading(false);
        }
    }, [dateStart, dateEnd]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Build stats ─────────────────────────────────────────
    const months = useMemo(() => getMonthsInRange(
        `${dateStart.substring(0, 7)}-01`,
        `${dateEnd.substring(0, 7)}-31`,
    ), [dateStart, dateEnd]);

    const stats = useMemo<PropertyViewStat[]>(() => {
        const propMap: Record<string, PropertyViewStat> = {};

        let relevantProperties = (properties as Property[]);

        if (activeTab === 'rental') {
            relevantProperties = (properties as Property[]).filter((p: Property) => {
                const status = p.status || '';
                return status.split(',').map(s => s.trim()).includes('renting');
            });
        } else if (filterProperty) {
            relevantProperties = (properties as Property[]).filter((p: Property) => p.id === filterProperty);
        }

        relevantProperties.forEach((p: Property) => {
            if (!p.id) return;
            const views = allViews.find(v => v.property_id === p.id);
            propMap[p.id] = {
                propertyId: p.id,
                propertyName: p.name,
                propertyCode: p.code || p.id,
                totalViews: views?.view_count || 0,
                liveCount: views?.live_count || 0,
                monthly: {},
            };
        });

        monthlyViews.forEach(row => {
            if (!propMap[row.property_id]) return;
            const ym = `${row.year}-${String(row.month).padStart(2, '0')}`;
            if (!propMap[row.property_id].monthly[ym]) {
                propMap[row.property_id].monthly[ym] = 0;
            }
            propMap[row.property_id].monthly[ym] += row.view_count;
        });

        let list = Object.values(propMap);

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(s =>
                s.propertyName.toLowerCase().includes(q) ||
                s.propertyCode.toLowerCase().includes(q),
            );
        }

        list.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'totalViews') cmp = a.totalViews - b.totalViews;
            else if (sortField === 'propertyCode') cmp = a.propertyCode.localeCompare(b.propertyCode);
            else cmp = a.propertyName.localeCompare(b.propertyName, 'zh-HK');
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return list;
    }, [properties, allViews, monthlyViews, activeTab, filterProperty, searchQuery, sortField, sortDir, dateStart, dateEnd]);

    const totalRow = useMemo(() => ({
        totalViews: stats.reduce((s, r) => s + r.totalViews, 0),
        totalLive: stats.reduce((s, r) => s + r.liveCount, 0),
        monthly: months.reduce<Record<string, number>>((acc, m) => {
            acc[m] = stats.reduce((s, r) => s + (r.monthly[m] || 0), 0);
            return acc;
        }, {}),
    }), [stats, months]);

    // ── Toggle sort ─────────────────────────────────────────
    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    // ── Selection ────────────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    const toggleSelectAll = () => {
        if (selectedIds.length === stats.length) setSelectedIds([]);
        else setSelectedIds(stats.map(s => s.propertyId));
    };
    const displayedStats = selectedIds.length > 0
        ? stats.filter(s => selectedIds.includes(s.propertyId))
        : stats;

    // ── Export ──────────────────────────────────────────────
    const handleExport = async (format: ExportFormat) => {
        setExportLoading(format);
        setShowExportMenu(false);
        try {
            if (format === 'csv') await exportCSV(displayedStats, months, activeTab);
            else if (format === 'pdf') await exportPDF(displayedStats, months, `${dateStart} ~ ${dateEnd}`, activeTab, tableRef);
        } catch (e) { console.error(e); }
        finally { setExportLoading(null); }
    };

    // ── Render ──────────────────────────────────────────────
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-400 dark:text-white/40">
                <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xl font-medium">僅限管理員訪問</p>
                <p className="text-sm mt-2">此頁面需要管理員權限。</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-purple-500" />
                        {t('Management Flow', '管理流程')}
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1">
                        {t('Property view statistics & reporting', '物業瀏覽統計及匯報')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={fetchData}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/70 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all flex items-center gap-2 text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </motion.button>

                    <div className="relative">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowExportMenu(v => !v)}
                            disabled={loading || exportLoading !== null}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50"
                        >
                            {exportLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {t('Export', '匯出')}
                            <ChevronDown className="w-3 h-3" />
                        </motion.button>

                        <AnimatePresence>
                            {showExportMenu && (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowExportMenu(false)}
                                        className="fixed inset-0 z-40"
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-12 w-48 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
                                    >
                                        {[
                                            { fmt: 'csv' as ExportFormat, icon: <Table className="w-4 h-4" />, label: '匯出 CSV' },
                                            { fmt: 'pdf' as ExportFormat, icon: <FileText className="w-4 h-4" />, label: '匯出 PDF' },
                                        ].map(({ fmt, icon, label }) => (
                                            <button
                                                key={fmt}
                                                onClick={() => handleExport(fmt)}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-white/80 hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                            >
                                                {icon}
                                                {label}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10 w-fit">
                <button
                    onClick={() => setActiveTab('property')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        activeTab === 'property'
                            ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                            : 'text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white'
                    }`}
                >
                    <Home className="w-4 h-4" />
                    {t('Property pages', '物業頁面')}
                </button>
                <button
                    onClick={() => setActiveTab('rental')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        activeTab === 'rental'
                            ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                            : 'text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white'
                    }`}
                >
                    <Building2 className="w-4 h-4" />
                    {t('Rental pages', '出租頁面')}
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-white/10 p-4 flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-end">
                {/* 關鍵字搜尋 */}
                <div className="flex-1 min-w-0 max-w-sm">
                    <label className="block text-xs font-medium text-zinc-500 dark:text-white/50 mb-1.5">關鍵字</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-white/30" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="搜尋物業名稱 / 編號..."
                            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white/60"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 選擇物业 */}
                <div className="min-w-0 max-w-xs">
                    <label className="block text-xs font-medium text-zinc-500 dark:text-white/50 mb-1.5">選擇物業</label>
                    <select
                        value={filterProperty}
                        onChange={e => setFilterProperty(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
                    >
                        <option value="">全部物業</option>
                        {(properties as Property[]).map((p: Property) => (
                            <option key={p.id} value={p.id}>
                                {p.code || p.id} — {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 日期範圍 */}
                <div className="flex items-end gap-2">
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-white/50 mb-1.5">開始月份</label>
                        <input
                            type="month"
                            value={dateStart.substring(0, 7)}
                            onChange={e => setDateStart(`${e.target.value}-01`)}
                            className="px-3 py-2 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
                        />
                    </div>
                    <span className="text-zinc-400 dark:text-white/40 pb-2 shrink-0">至</span>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-white/50 mb-1.5">結束月份</label>
                        <input
                            type="month"
                            value={dateEnd.substring(0, 7)}
                            onChange={e => setDateEnd(`${e.target.value}-31`)}
                            max={new Date().toISOString().substring(0, 7)}
                            className="px-3 py-2 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
                        />
                    </div>
                </div>

                <div className="text-xs text-zinc-400 dark:text-white/40 pb-2.5">
                    {months.length} 個月
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    <TabContent
                        tab={activeTab}
                        stats={stats}
                        months={months}
                        totalRow={totalRow}
                        loading={loading}
                        propertiesLoading={propertiesLoading}
                        sortField={sortField}
                        sortDir={sortDir}
                        selectedIds={selectedIds}
                        displayedStats={displayedStats}
                        t={t}
                        onSort={toggleSort}
                        onSelect={toggleSelect}
                        onSelectAll={toggleSelectAll}
                        onExport={handleExport}
                        exportLoading={exportLoading}
                        tableRef={tableRef}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Selection hint */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-4 border border-white/10 dark:border-zinc-200"
                    >
                        <span className="font-semibold text-sm whitespace-nowrap">
                            已選擇 {selectedIds.length} 個物業
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedIds([])}
                                className="px-3 py-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-zinc-100 transition-colors text-sm"
                            >
                                取消選擇
                            </button>
                            <button
                                onClick={() => setShowExportMenu(true)}
                                className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-1.5"
                            >
                                <Download className="w-3.5 h-3.5" />
                                匯出所選
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
