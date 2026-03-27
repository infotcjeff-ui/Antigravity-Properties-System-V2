/**
 * Format lot area with comma separators and square feet unit.
 * e.g. 39840 -> "39,840平方英呎"
 */
export function formatLotArea(value: string | number | null | undefined): string {
    if (value == null || value === '' || value === '-') return '-';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return String(value);
    return `${num.toLocaleString()}平方英呎`;
}

/** Format for input display (number with commas only). e.g. 39840 -> "39,840" */
export function formatLotAreaForInput(value: string | number | null | undefined): string {
    if (value == null || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return String(value);
    return num.toLocaleString();
}

/** Parse input to raw number string. e.g. "39,840" or "39840" -> "39840" */
export function parseLotAreaInput(value: string): string {
    const cleaned = value.replace(/,/g, '').replace(/\s/g, '');
    if (cleaned === '') return '';
    const num = parseFloat(cleaned);
    return isNaN(num) ? value : String(Math.floor(num));
}

/** Format number with commas for display. e.g. 50000 -> "50,000" */
export function formatNumberWithCommas(value: string | number | null | undefined): string {
    if (value == null || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(String(value).replace(/,/g, '')) : value;
    if (isNaN(num)) return String(value);
    return num.toLocaleString();
}

/** Parse price/number input preserving decimals. "50,000" or "50000.5" -> "50000.5" */
export function parsePriceInput(value: string): string {
    const cleaned = String(value).replace(/,/g, '').replace(/\s/g, '');
    if (cleaned === '') return '';
    const num = parseFloat(cleaned);
    return isNaN(num) ? value : String(num);
}

/** Parse lotIndex string into entries with 新/舊 type. Handles legacy format. */
export function parseLotEntries(lotIndex: string | null | undefined): { type: 'new' | 'old'; value: string }[] {
    if (!lotIndex?.trim()) return [];
    return lotIndex.split(/\n|\s*\|\s*/).filter(Boolean).map(part => {
        const t = part.trim();
        if (t.startsWith('新:')) return { type: 'new' as const, value: t.slice(2).trim() };
        if (t.startsWith('舊:')) return { type: 'old' as const, value: t.slice(2).trim() };
        return { type: 'new' as const, value: t }; // legacy: treat as 新
    }).filter(e => e.value);
}

/** 比對名稱是否重複：去頭尾空白、合併連續空白、英文不分大小寫 */
export function normalizeDuplicateName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 依顯示名稱去重（與管理業主列表一致，避免下拉出現同名多筆）。
 * 保留排序較前的一筆：名稱 → 代碼 → id。
 */
/**
 * 合併業主與承租人（proprietors 表兩類代碼）：業主列在前，同名只保留第一筆（業主優先），最後依名稱排序。
 */
export function mergeOwnerAndTenantProprietors<
    T extends { name?: string | null; code?: string | null; id?: string | null },
>(owners: T[], tenants: T[]): T[] {
    const combined = [...owners, ...tenants];
    const seen = new Set<string>();
    const out: T[] = [];
    for (const p of combined) {
        const k = normalizeDuplicateName(p.name || '');
        if (!k) {
            out.push(p);
            continue;
        }
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(p);
    }
    return out.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK'));
}

/** 擁有人類別顯示文案（表單／卡片／彈窗／列表徽章） */
export type ProprietorCategoryDisplayVariant = 'form' | 'card' | 'modal' | 'badge';

export function proprietorCategoryLabelZh(
    category: string | undefined,
    variant: ProprietorCategoryDisplayVariant = 'form'
): string {
    if (!category) return '—';
    switch (category) {
        case 'group_company':
            return variant === 'modal' ? '集團旗下公司' : variant === 'badge' ? '集團' : '集團公司';
        case 'joint_venture':
            return variant === 'badge' ? '合資' : '合資公司';
        case 'private_company':
            return variant === 'badge' ? '私人' : '私人公司';
        case 'private_individual':
            return '個人';
        case 'managed_individual':
            return variant === 'modal' ? '代管理的個體' : variant === 'badge' ? '代管' : '代管個體';
        case 'external_landlord':
            return variant === 'modal' || variant === 'form' ? '出租的業主' : variant === 'badge' ? '外部' : '外部業主';
        case 'tenant':
            return '承租人';
        case 'external_customer':
            return '街外客';
        default:
            return '—';
    }
}

/** 擁有人類別列表徽章樣式（與業主／租客列表一致） */
export function proprietorCategoryBadgeClassName(category: string | undefined): string {
    switch (category) {
        case 'group_company':
            return 'bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20';
        case 'joint_venture':
            return 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20';
        case 'private_company':
            return 'bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20';
        case 'private_individual':
            return 'bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20';
        case 'managed_individual':
            return 'bg-zinc-500/10 text-zinc-500 ring-1 ring-zinc-500/20';
        default:
            return 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20';
    }
}

export function dedupeRecordsByDisplayName<
    T extends { name?: string | null; code?: string | null; id?: string | null },
>(records: T[]): T[] {
    const sorted = [...records].sort((a, b) => {
        const n = (a.name || '').localeCompare(b.name || '', 'zh-HK');
        if (n !== 0) return n;
        const c = (a.code || '').localeCompare(b.code || '', 'zh-HK');
        if (c !== 0) return c;
        return String(a.id || '').localeCompare(String(b.id || ''));
    });
    const seen = new Set<string>();
    return sorted.filter(p => {
        const k = normalizeDuplicateName(p.name || '');
        if (!k) return true;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}
