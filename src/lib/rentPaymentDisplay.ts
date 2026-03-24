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

/** 收／交租表單之付款方式 */
export function labelRentCollectionPaymentMethod(
    method?: 'cheque' | 'fps' | 'cash' | string | null,
): string {
    if (method == null || method === '') return '—';
    if (method === 'cheque') return '支票';
    if (method === 'fps') return 'FPS轉帳';
    if (method === 'cash') return '現金';
    return String(method);
}

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

/** 交租列表狀態：已過期優先，否則依繳付金額 */
export function getRentingListStatus(rent: {
    endDate?: Date | string | null;
    rentingEndDate?: Date | string | null;
    rentCollectionAmount?: number | null;
}): 'expired' | 'completed' | 'processing' {
    const periodEnd = rent.endDate ?? rent.rentingEndDate;
    if (isPeriodEndExpired(periodEnd)) return 'expired';
    if (hasRentCollectionPaidAmount(rent)) return 'completed';
    return 'processing';
}

export type RentPaymentMethodFilterValue = '' | 'none' | 'cheque' | 'fps' | 'cash';

export function getRentPaymentMethodKey(rent: {
    rentCollectionPaymentMethod?: 'cheque' | 'fps' | 'cash' | string | null;
}): 'none' | 'cheque' | 'fps' | 'cash' {
    const m = rent.rentCollectionPaymentMethod;
    if (m === 'cheque' || m === 'fps' || m === 'cash') return m;
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
