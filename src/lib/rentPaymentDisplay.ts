import type { CurrentTenant, Property, Proprietor, Rent } from '@/lib/db';
import { normalizeRentPropertyLotSelection, parseRentPropertyLotPartialFromRow } from '@/lib/formatters';

/**
 * 交／收租列表顯示：dd/mm/yyyy、期間字串、繳付金額是否已填（含 0）
 */

export function formatDateDMY(value: Date | string | undefined | null): string {
    if (value == null || value === '') return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/** 預設「日／月／年 至 日／月／年」；可傳入 sep 例如 ' - ' */
export function formatDateRangeDMY(
    start?: Date | string | null,
    end?: Date | string | null,
    sep = ' 至 ',
): string {
    const a = formatDateDMY(start);
    const b = formatDateDMY(end);
    return `${a || '—'}${sep}${b || '—'}`;
}

/** null／undefined 視為空白；已填 0 視為有填寫 */
export function hasRentCollectionPaidAmount(rent: { rentCollectionAmount?: number | null }): boolean {
    const v = rent.rentCollectionAmount;
    return v !== null && v !== undefined && !Number.isNaN(Number(v));
}

/**
 * 租務列表「編號」：收租記錄（rent_out）優先顯示收租記錄編號，無則退回出租合約號碼欄；
 * 合約記錄（contract）顯示出租合約號碼。兼容未經 toCamel 的 snake_case 欄位。
 */
export function getRentOutOrContractListNumber(rent: {
    type?: string;
    rentOutTenancyNumber?: string | null;
    rentCollectionContractNumber?: string | null;
    rent_out_tenancy_number?: string | null;
    rent_collection_contract_number?: string | null;
}): string {
    const raw = rent as Record<string, unknown>;
    const collection =
        rent.rentCollectionContractNumber ??
        (typeof raw.rent_collection_contract_number === 'string' ? raw.rent_collection_contract_number : null);
    const tenancy =
        rent.rentOutTenancyNumber ??
        (typeof raw.rent_out_tenancy_number === 'string' ? raw.rent_out_tenancy_number : null);
    if (rent.type === 'rent_out') {
        if (collection != null && String(collection).trim()) return String(collection).trim();
    }
    if (tenancy != null && String(tenancy).trim()) return String(tenancy).trim();
    return '-';
}

/**
 * 收租列表「現時租客／承租人」顯示文字；與編輯物業表單 renderRentTable（partyMode landlord）一致。
 * 優先：簡化表單 rentCollectionTenantName → rentOutTenants → 關聯 tenant（proprietors）
 */

/**
 * 收租記錄列表用「本期租期」：簡化表單寫入 start_date / end_date 與 rent_collection_date；
 * 勿用 rent_out_end_date（整份出租合約）覆蓋本期結束日。
 */
export function getRentOutCollectionDisplayPeriod(rent: {
    type?: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    rentOutStartDate?: Date | string | null;
    rentOutEndDate?: Date | string | null;
    rentCollectionDate?: Date | string | null;
}): { start: Date | null; end: Date | null } {
    if (rent.type !== 'rent_out') return { start: null, end: null };

    const toValid = (v: unknown): Date | null => {
        if (v == null || v === '') return null;
        const d = v instanceof Date ? v : new Date(v as string);
        return Number.isNaN(d.getTime()) ? null : d;
    };

    const start =
        toValid((rent as { rentCollectionDate?: unknown }).rentCollectionDate) ??
        toValid(rent.startDate) ??
        toValid(rent.rentOutStartDate);
    const end = toValid(rent.endDate) ?? toValid(rent.rentOutEndDate);
    return { start, end };
}

function coerceRentDateField(v: Date | string | null | undefined): Date | null {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** 與物業頁／表單收租列「租期」顯示一致，供排序用（避免只用 period 而漏掉列上仍顯示的後備日期） */
function getRentOutCollectionListEffectiveStart(rent: Rent): Date | null {
    const p = getRentOutCollectionDisplayPeriod(rent);
    return p.start ?? coerceRentDateField(rent.rentOutStartDate) ?? coerceRentDateField(rent.startDate);
}

function getRentOutCollectionListEffectiveEnd(rent: Rent): Date | null {
    const p = getRentOutCollectionDisplayPeriod(rent);
    return p.end ?? coerceRentDateField(rent.rentOutEndDate) ?? coerceRentDateField(rent.endDate);
}

/** 出租合約「合約性質」中文標籤（與 RentDetailsModal 一致） */
export function labelRentOutContractNatureZh(v: string | undefined | null): string {
    if (v == null || String(v).trim() === '') return '—';
    const map: Record<string, string> = {
        parking: '車位',
        temporary_parking: '臨時車位',
        rental_venue: '租用埸地',
    };
    const key = String(v).trim();
    return map[key] || key;
}

/** 收租列表排序：依租期起始日舊→新（例：一月在前、二月在後），無起始日排最後；同日起再依結束日、建立時間舊→新 */
export function compareRentOutForListNewestFirst(a: Rent, b: Rent): number {
    const msOr = (d: Date | null | undefined, fallback: number) => {
        if (d == null) return fallback;
        const t = d.getTime();
        return Number.isNaN(t) ? fallback : t;
    };
    const key = (r: Rent) => {
        const startT = msOr(getRentOutCollectionListEffectiveStart(r), Number.POSITIVE_INFINITY);
        const endT = msOr(getRentOutCollectionListEffectiveEnd(r), Number.POSITIVE_INFINITY);
        const created = new Date(r.createdAt || 0).getTime();
        return { startT, endT, created };
    };
    const ka = key(a);
    const kb = key(b);
    if (ka.startT !== kb.startT) return ka.startT - kb.startT;
    if (ka.endT !== kb.endT) return ka.endT - kb.endT;
    return ka.created - kb.created;
}

export function getRentOutLesseeDisplayLabel(rent: {
    rentCollectionTenantName?: string | null;
    rentOutTenants?: string[] | null;
    tenant?: { name?: string | null } | null;
}): string {
    const rcName = rent.rentCollectionTenantName;
    if (rcName != null && String(rcName).trim()) return String(rcName).trim();
    const rt = rent.rentOutTenants;
    if (Array.isArray(rt) && rt.length > 0) {
        const joined = rt.map((x: unknown) => String(x).trim()).filter(Boolean).join('、');
        if (joined) return joined;
    }
    const tn = rent.tenant?.name;
    return tn != null && String(tn).trim() ? String(tn).trim() : '';
}

/** 物業單頁「現時租客」：與收租列表一致，優先收租記錄欄位，再退回合約 FK、物業 tenant */
export type PropertyCurrentTenantDisplay =
    | { mode: 'label'; name: string; subtitle: string }
    | { mode: 'ct'; name: string; subtitle: string }
    | { mode: 'proprietor'; name: string; subtitle: string; proprietor: Proprietor };

/** 物业单页「现时租客」扩展显示：包含租客对象和关联地段信息 */
export type PropertyCurrentTenantWithLots = {
    tenant: CurrentTenant;
    /** 该租客关联的物业地段（来自 rentPropertyLot 或全部物业地段） */
    lots: string[];
    /** 部分地段模式的地段（来自 rentPropertyLotPartial） */
    partialLots: string[];
};

export function resolvePropertyCurrentTenantDisplay(
    property: Property | null | undefined,
    currentTenants: CurrentTenant[],
    activeRentOut: Rent | undefined | null,
): PropertyCurrentTenantDisplay | null {
    if (!property) return null;

    const rentOutsSorted = [...(property.rents || [])]
        .filter((r: Rent) => r.type === 'rent_out')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    for (const r of rentOutsSorted) {
        const lab = getRentOutLesseeDisplayLabel(r);
        if (lab) {
            const subtitle =
                (r.rentOutTenancyNumber && String(r.rentOutTenancyNumber).trim()) ||
                property.code?.trim() ||
                '';
            return { mode: 'label', name: lab, subtitle };
        }
    }

    const contracts = [...(property.rents || [])]
        .filter((r: Rent) => r.type === 'contract')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const latestContract = contracts[0];
    const ctId = latestContract?.rentOutTenantIds?.[0];
    if (ctId) {
        const ct = currentTenants.find((c) => c.id === ctId);
        if (ct) return { mode: 'ct', name: ct.name, subtitle: (ct.tenancyNumber || '').trim() };
    }

    const propT = property.tenant || activeRentOut?.tenant;
    if (propT?.name) {
        return {
            mode: 'proprietor',
            name: propT.name,
            subtitle: (propT.code || '').trim(),
            proprietor: propT,
        };
    }

    return null;
}

/**
 * 獲取物业的所有現時租客（包含关联地段信息）
 * 優先從 rentOutTenantIds 查找，再退回到名稱匹配
 */
export function getPropertyCurrentTenantsWithLots(
    property: Property | null | undefined,
    currentTenants: CurrentTenant[],
): PropertyCurrentTenantWithLots[] {
    if (!property) return [];

    const allRents = property.rents || [];
    const rentOuts = allRents.filter((r: Rent) => r.type === 'rent_out' || r.type === 'contract');
    const result: PropertyCurrentTenantWithLots[] = [];
    const seenIds = new Set<string>();

    for (const rent of rentOuts) {
        const tenantIds = rent.rentOutTenantIds || [];
        for (const tid of tenantIds) {
            if (!tid || seenIds.has(tid)) continue;
            const ct = currentTenants.find((c) => c.id === tid);
            if (ct) {
                seenIds.add(tid);
                // 獲取該租客關聯的地段
                const rawLot = rent.rentPropertyLot ?? (rent as Record<string, unknown>).rent_property_lot;
                const lots = normalizeRentPropertyLotSelection(rawLot);
                // 獲取部分地段標記
                const rawPartial = rent.rentPropertyLotPartial ?? (rent as Record<string, unknown>).rent_property_lot_partial;
                const partialMap = parseRentPropertyLotPartialFromRow(rawPartial);
                const partialLots = lots.filter((lot) => partialMap[lot] === true);
                // 如果沒有特定地段，使用物业全部地段
                const displayLots = lots.length > 0 ? lots : (property.lotIndex
                    ? property.lotIndex.split(/(?:新|舊):/).map((s) => s.trim()).filter(Boolean)
                    : []);
                result.push({ tenant: ct, lots: displayLots, partialLots });
            }
        }

        // 退回到 rentOutTenants 名稱匹配
        const rtNames = rent.rentOutTenants || [];
        for (const name of rtNames) {
            if (!name?.trim()) continue;
            const ct = currentTenants.find((c) => c.name?.trim() === name.trim());
            if (ct && !seenIds.has(ct.id || '')) {
                seenIds.add(ct.id || '');
                const lots = property.lotIndex
                    ? property.lotIndex.split(/(?:新|舊):/).map((s) => s.trim()).filter(Boolean)
                    : [];
                result.push({ tenant: ct, lots, partialLots: [] });
            }
        }
    }

    return result;
}

/** 收／交租表單之付款方式（含按金方式、出租合約按金方式） */
export function labelRentCollectionPaymentMethod(
    method?: 'cheque' | 'fps' | 'cash' | 'bank_in' | string | null,
): string {
    if (method == null || method === '') return '—';
    if (method === 'cheque') return '支票';
    if (method === 'fps') return 'FPS轉帳';
    if (method === 'cash') return '現金';
    if (method === 'bank_in') return '入數';
    return String(method);
}

/** 合約／二房東／現時租客之租務狀態（順序：放盤中 → 出租中 → 租入中 → 已完租） */
export const RENT_OUT_CONTRACT_STATUS_OPTIONS = [
    { value: 'listing' as const, label: '放盤中' },
    { value: 'renting' as const, label: '出租中' },
    { value: 'leasing_in' as const, label: '租入中' },
    { value: 'completed' as const, label: '已完租' },
];

/** 期間結束日是否早於「今天」（本地日曆 0 點比較）；無結束日不算過期 */
export function isPeriodEndExpired(end?: Date | string | null): boolean {
    if (end == null || end === '') return false;
    const d = end instanceof Date ? end : new Date(end);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDay = new Date(d);
    endDay.setHours(0, 0, 0, 0);
    return endDay < today;
}

/** 交租／收租列表「租務狀態」：已繳付 = 繳付金額有值且已選付款方式；否則未繳付 */
export type RentCollectionPayListStatus = 'paid' | 'unpaid';

export function getRentCollectionPayListStatus(rent: {
    rentCollectionAmount?: number | null;
    rentCollectionPaymentMethod?: string | null;
}): RentCollectionPayListStatus {
    if (!hasRentCollectionPaidAmount(rent)) return 'unpaid';
    const m = rent.rentCollectionPaymentMethod;
    if (m == null || String(m).trim() === '') return 'unpaid';
    return 'paid';
}

/** 與 getRentCollectionPayListStatus 相同（舊名保留供少數引用） */
export function getRentingListStatus(rent: Parameters<typeof getRentCollectionPayListStatus>[0]): RentCollectionPayListStatus {
    return getRentCollectionPayListStatus(rent);
}

export type RentPaymentMethodFilterValue = '' | 'none' | 'cheque' | 'fps' | 'cash' | 'bank_in';

export function getRentPaymentMethodKey(rent: {
    rentCollectionPaymentMethod?: 'cheque' | 'fps' | 'cash' | 'bank_in' | string | null;
}): 'none' | 'cheque' | 'fps' | 'cash' | 'bank_in' {
    const m = rent.rentCollectionPaymentMethod;
    if (m === 'cheque' || m === 'fps' || m === 'cash' || m === 'bank_in') return m;
    return 'none';
}

export function matchesRentPaymentMethodFilter(
    rent: Parameters<typeof getRentPaymentMethodKey>[0],
    filter: RentPaymentMethodFilterValue,
): boolean {
    if (filter === '') return true;
    const key = getRentPaymentMethodKey(rent);
    if (filter === 'none') return key === 'none';
    return key === filter;
}

/** 篩選用：YYYY-MM-DD → 本地日曆當日 */
function parseYmdLocal(ymd: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 收租管理「租約期間」篩選：記錄區間 [start,end]（含首尾當日）是否與篩選 [filterFrom, filterTo] 重疊；
 * filter 僅填一側則另一側視為無限；兩者皆空則通過；記錄無有效起訖則不通過。
 */
export function rentOutPeriodOverlapsDateFilter(
    periodStart: Date | string | null | undefined,
    periodEnd: Date | string | null | undefined,
    filterFrom: string,
    filterTo: string,
): boolean {
    const ff = (filterFrom || '').trim();
    const tt = (filterTo || '').trim();
    if (!ff && !tt) return true;

    const dayStartMs = (v: Date | string): number | null => {
        if (v == null || v === '') return null;
        const d = v instanceof Date ? new Date(v) : new Date(v as string);
        if (Number.isNaN(d.getTime())) return null;
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x.getTime();
    };
    const dayEndMs = (v: Date | string): number | null => {
        if (v == null || v === '') return null;
        const d = v instanceof Date ? new Date(v) : new Date(v as string);
        if (Number.isNaN(d.getTime())) return null;
        const x = new Date(d);
        x.setHours(23, 59, 59, 999);
        return x.getTime();
    };

    let lo: number;
    let hi: number;
    const sMs = periodStart != null && periodStart !== '' ? dayStartMs(periodStart as Date | string) : null;
    const eMs = periodEnd != null && periodEnd !== '' ? dayEndMs(periodEnd as Date | string) : null;
    if (sMs != null && eMs != null) {
        lo = sMs;
        hi = eMs;
        if (hi < lo) {
            const t = lo;
            lo = hi;
            hi = t;
        }
    } else if (sMs != null) {
        lo = sMs;
        hi = dayEndMs(periodStart as Date | string)!;
    } else if (eMs != null) {
        lo = dayStartMs(periodEnd as Date | string)!;
        hi = eMs;
    } else {
        return false;
    }

    let fLo = -Infinity;
    let fHi = Infinity;
    if (ff) {
        const fd = parseYmdLocal(ff);
        if (!fd) return false;
        fd.setHours(0, 0, 0, 0);
        fLo = fd.getTime();
    }
    if (tt) {
        const td = parseYmdLocal(tt);
        if (!td) return false;
        td.setHours(23, 59, 59, 999);
        fHi = td.getTime();
    }
    if (fLo > fHi) {
        const x = fLo;
        fLo = fHi;
        fHi = x;
    }
    return lo <= fHi && hi >= fLo;
}

export type RentOutListStatusKey = 'expired' | 'renting' | 'listing' | 'other';

/** 收租列表篩選用狀態：已過期優先，其餘看 rentOutStatus / status */
export function getRentOutListStatusKey(rent: {
    endDate?: Date | string | null;
    rentOutEndDate?: Date | string | null;
    rentOutStatus?: string | null;
    status?: string | null;
}): RentOutListStatusKey {
    const endDate = rent.endDate ?? rent.rentOutEndDate;
    if (isPeriodEndExpired(endDate)) return 'expired';
    const s = rent.rentOutStatus || rent.status || '';
    if (s === 'renting') return 'renting';
    if (s === 'listing') return 'listing';
    return 'other';
}

export type RentOutStatusFilterValue = '' | RentOutListStatusKey;

/** 收租列表「繳付狀態」篩選（與租務狀態欄一致） */
export type RentOutPayStatusFilterValue = '' | RentCollectionPayListStatus;
