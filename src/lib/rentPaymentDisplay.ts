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
