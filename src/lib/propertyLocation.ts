import type { Property } from '@/lib/db';

/** 將資料庫／API 回傳的 location 正規化為 { lat, lng, address? } */
export function normalizePropertyLocation(raw: unknown): Property['location'] {
    if (raw == null) return null;
    let o: Record<string, unknown>;
    if (typeof raw === 'string') {
        try {
            o = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            return null;
        }
    } else if (typeof raw === 'object' && raw !== null) {
        o = raw as Record<string, unknown>;
    } else {
        return null;
    }

    const num = (v: unknown): number | null => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    };

    const lat = num(o.lat) ?? num(o.latitude);
    const lng = num(o.lng) ?? num(o.longitude);
    if (lat == null || lng == null) return null;

    const address = typeof o.address === 'string' ? o.address : '';
    return { lat, lng, address };
}
