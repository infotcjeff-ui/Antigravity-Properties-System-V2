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
