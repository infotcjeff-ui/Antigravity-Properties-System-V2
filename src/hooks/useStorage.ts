'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db, generateId, type Property, type Proprietor, type Rent, type SubLandlord, type CurrentTenant } from '@/lib/db';
import { normalizePropertyLocation } from '@/lib/propertyLocation';
import { useAuth } from '@/contexts/AuthContext';

// Helper to convert snake_case to camelCase
const toCamel = (obj: any) => {
    if (!obj) return obj;
    const newObj: any = {};
    for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        newObj[camelKey] = obj[key];
    }
    return newObj;
};

// Helper to convert camelCase to snake_case
const toSnake = (obj: any) => {
    if (!obj) return obj;
    const newObj: any = {};
    for (const key in obj) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        newObj[snakeKey] = obj[key];
    }
    return newObj;
};

/**
 * RentModal 傳入的 rentPropertyLotPartial 為 JSON.stringify 後的字串或 Record；
 * updateRent 先前只接受 object，字串會被誤判為無效並寫入 null，導致「部分地方」更新後遺失。
 */
const parseRentPropertyLotPartialForSave = (input: unknown): Record<string, boolean> | null => {
    if (input == null) return null;
    if (typeof input === 'string') {
        const t = input.trim();
        if (!t) return null;
        try {
            const p = JSON.parse(t) as unknown;
            if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, boolean>;
        } catch {
            return null;
        }
        return null;
    }
    if (typeof input === 'object' && !Array.isArray(input)) {
        return input as Record<string, boolean>;
    }
    return null;
};

/** 統一正規化物業 location，避免 JSONB 內為 latitude/longitude 等格式時表單／地圖讀不到座標 */
const mapPropertyRow = (row: any): Property => {
    const p = toCamel(row) as Property;
    p.location = normalizePropertyLocation(p.location);
    return p;
};

/** rents.rent_out_tenant_ids 為 jsonb 陣列，無 FK 至 current_tenants，無法用 embed 查詢 */
const firstRentOutTenantIdFromRow = (row: { rent_out_tenant_ids?: unknown }): string | undefined => {
    const raw = row.rent_out_tenant_ids;
    if (Array.isArray(raw) && raw[0] != null && raw[0] !== '') return String(raw[0]);
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed) && parsed[0] != null && parsed[0] !== '') return String(parsed[0]);
        } catch {
            /* ignore */
        }
    }
    return undefined;
};

type SubLandlordTenancyRow = { id: string; name: string; tenancy_number: string | null };

/**
 * 二房東「出租號碼」單一段是否與物業編號關聯（與 removePropertyFromSubLandlordTenancyNumber 之保留邏輯對應：若會被視為該物業則為 true）
 */
function tenancyPartLinkedToPropertyCode(part: string, propertyCode: string): boolean {
    const normalizedPart = part.trim();
    const normalizedPropertyCode = propertyCode.trim();
    if (!normalizedPart || !normalizedPropertyCode) return false;

    if (normalizedPart === normalizedPropertyCode) return true;
    if (normalizedPart.startsWith(normalizedPropertyCode + '-')) return true;
    if (normalizedPropertyCode.startsWith(normalizedPart + '-')) return true;

    const firstDashIndex = normalizedPart.indexOf('-');
    const propertyFirstDash = normalizedPropertyCode.indexOf('-');

    if (firstDashIndex > 0) {
        const afterDash = normalizedPart.substring(firstDashIndex + 1);
        if (afterDash.match(/^[A-Z]{2,3}\d+$/)) {
            const partCode = normalizedPart.substring(0, firstDashIndex);
            if (propertyFirstDash === -1) {
                return partCode === normalizedPropertyCode;
            }
            const propertyPrefix = normalizedPropertyCode.substring(0, propertyFirstDash);
            return partCode === propertyPrefix;
        }
        if (propertyFirstDash > 0) {
            const propertyPrefix = normalizedPropertyCode.substring(0, propertyFirstDash);
            const partPrefix = normalizedPart.substring(0, firstDashIndex);
            if (partPrefix === propertyPrefix) {
                return true;
            }
        }
    }

    if (propertyFirstDash === -1 && firstDashIndex > 0) {
        const partPrefix = normalizedPart.substring(0, firstDashIndex);
        if (partPrefix === normalizedPropertyCode) {
            return true;
        }
    }

    return false;
}

/** 依物業 code 從二房東列表中找「出租號碼」含該物業者（多名時取名稱排序第一筆，輸出穩定） */
function findSubLandlordForPropertyCode(
    rows: SubLandlordTenancyRow[],
    propertyCode: string,
): { id: string; name: string } | undefined {
    const code = propertyCode.trim();
    if (!code || !rows.length) return undefined;
    const sorted = [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK'));
    for (const sl of sorted) {
        const tn = sl.tenancy_number;
        if (!tn?.trim()) continue;
        const parts = tn.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.some((p) => tenancyPartLinkedToPropertyCode(p, code))) {
            return { id: sl.id, name: sl.name ?? '' };
        }
    }
    return undefined;
}

/**
 * 從 Supabase／PostgREST／PostgreSQL 錯誤訊息擷取「不存在的欄位」snake_case 名稱，供略過寫入。
 */
const extractMissingColumnFromError = (err: unknown): string | null => {
    const message = (err as { message?: string } | null)?.message || '';
    if (!message) return null;
    const m1 = message.match(/Could not find the '([^']+)' column/i);
    if (m1) return m1[1];
    const m2 = message.match(/column\s+"([^"]+)"\s+of relation/i);
    if (m2) return m2[1];
    const m3 = message.match(/column\s+"([^"]+)"\s+does not exist/i);
    if (m3) return m3[1];
    const m4 = message.match(/column\s+(\w+)\s+does not exist/i);
    if (m4) return m4[1];
    return null;
};

const withSchemaFallbackInsert = async (
    table: string,
    payload: Record<string, unknown>,
    maxRetries = 64,
): Promise<{ data: unknown; error: unknown }> => {
    const attemptPayload = { ...payload };
    let result = await supabase.from(table).insert([attemptPayload]);
    let attempts = 0;
    const MAX = 64;
    while (result.error && attempts < MAX) {
        const missingColumn = extractMissingColumnFromError(result.error);
        if (!missingColumn || !(missingColumn in attemptPayload)) {
            return result as { data: unknown; error: unknown };
        }
        delete attemptPayload[missingColumn];
        attempts++;
        result = await supabase.from(table).insert([attemptPayload]);
    }
    if (!result.error) return result as { data: unknown; error: unknown };
    return { data: null, error: result.error ?? new Error('Insert failed after schema fallback retries') };
};

const withSchemaFallbackUpdate = async (
    table: string,
    id: string,
    payload: Record<string, unknown>,
    maxRetries = 64,
): Promise<{ data: unknown; error: unknown }> => {
    const attemptPayload = { ...payload };
    let result = await supabase.from(table).update(attemptPayload).eq('id', id);
    let attempts = 0;
    const MAX = maxRetries;
    while (result.error && attempts < MAX) {
        const missingColumn = extractMissingColumnFromError(result.error);
        if (!missingColumn || !(missingColumn in attemptPayload)) {
            return result as { data: unknown; error: unknown };
        }
        delete attemptPayload[missingColumn];
        attempts++;
        result = await supabase.from(table).update(attemptPayload).eq('id', id);
    }
    if (!result.error) return result as { data: unknown; error: unknown };
    return { data: null, error: result.error ?? new Error('Update failed after schema fallback retries') };
};

// ==================== PROPERTY HOOKS ====================

// ==================== FETCHERS ====================

export const fetchProperties = async (user?: any, options?: { query?: string; bypassIsolation?: boolean }): Promise<Property[]> => {
    try {
        // Select all fields needed for both list and edit views
        const fields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, proprietor_ids, tenant_id, parent_property_id, created_by, created_at, updated_at, images, geo_maps, notes';
        let queryBuilder = supabase.from('properties').select(fields);

        if (options?.query) {
            const q = options.query;
            queryBuilder = queryBuilder.or(`name.ilike.%${q}%,code.ilike.%${q}%,address.ilike.%${q}%`);
        }

        queryBuilder = queryBuilder.eq('is_deleted', false);

        if (user && user.role !== 'admin' && !options?.bypassIsolation) {
            queryBuilder = queryBuilder.eq('created_by', user.id);
        }

        const { data, error: sbError } = await queryBuilder
            .order('code', { ascending: true });

        if (sbError) throw sbError;
        return (data || []).map(row => {
            const prop = mapPropertyRow(row);
            // 如果資料庫沒有 proprietor_ids 欄位，保留既有值或空陣列
            if (prop.proprietorIds === undefined) {
                prop.proprietorIds = [];
            }
            return prop;
        });
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error('Failed to fetch properties:', err.message || err);
        }
        return [];
    }
};

export const fetchProperty = async (id: string): Promise<Property | undefined> => {
    try {
        const { data, error: sbError } = await supabase
            .from('properties')
            .select('*')
            .eq('id', id)
            .single();

        if (sbError) throw sbError;
        return mapPropertyRow(data);
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error('Failed to fetch property:', err);
        }
        return undefined;
    }
};

export const fetchProprietors = async (user?: any): Promise<Proprietor[]> => {
    try {
        let query = supabase.from('proprietors').select('*');

        if (user && user.role !== 'admin') {
            query = query.eq('created_by', user.id);
        }

        query = query.eq('is_deleted', false);

        const { data, error: sbError } = await query
            .order('name', { ascending: true });

        if (sbError) throw sbError;
        return (data || []).map(toCamel) as Proprietor[];
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error('Failed to fetch proprietors:', err);
        }
        return [];
    }
};

export const fetchProprietor = async (id: string): Promise<Proprietor | undefined> => {
    try {
        const { data, error: sbError } = await supabase
            .from('proprietors')
            .select('*')
            .eq('id', id)
            .single();

        if (sbError) throw sbError;
        return toCamel(data) as Proprietor;
    } catch (err) {
        console.error('Failed to fetch proprietor:', err);
        return undefined;
    }
};

export const fetchRents = async (user?: any): Promise<Rent[]> => {
    try {
        let query = supabase.from('rents').select('*');

        if (user && user.role !== 'admin') {
            query = query.eq('created_by', user.id);
        }

        query = query.eq('is_deleted', false);

        const { data, error: sbError } = await query
            .order('created_at', { ascending: false });

        if (sbError) {
            console.error('Fetch rents error:', sbError);
            return [];
        }
        return (data || []).map(d => toCamel(d)) as Rent[];
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error('Failed to fetch rents:', err);
        }
        return [];
    }
};

export const fetchRentsWithRelations = async (user?: any, options?: { type?: 'renting' | 'rent_out' | 'contract' }): Promise<any[]> => {
    try {
        // EXCLUDE heavy fields from property join
        const propFields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, created_by, created_at, updated_at, images';
        let query = supabase.from('rents').select(`*, property:properties(${propFields}), proprietor:proprietors!proprietor_id(*), tenant:proprietors!tenant_id(*)`);

        if (options?.type) {
            query = query.eq('type', options.type);
        }

        if (user && user.role !== 'admin') {
            query = query.eq('created_by', user.id);
        }

        query = query.eq('is_deleted', false);

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            const e = error as { message?: string; details?: string; hint?: string; code?: string };
            console.error('Supabase query error:', e.message, e.details, e.hint, e.code);
            throw error;
        }

        const rows = data || [];
        const tenantIds = new Set<string>();
        for (const r of rows) {
            const id = firstRentOutTenantIdFromRow(r);
            if (id) tenantIds.add(id);
        }

        const tenantMap = new Map<string, { id: string; name: string }>();
        if (tenantIds.size > 0) {
            const { data: ctRows, error: ctError } = await supabase
                .from('current_tenants')
                .select('id,name')
                .in('id', [...tenantIds]);

            if (ctError) {
                const ce = ctError as { message?: string; details?: string; code?: string };
                console.error('current_tenants batch error:', ce.message, ce.details, ce.code);
            } else {
                for (const ct of ctRows || []) {
                    if (ct?.id) tenantMap.set(ct.id, { id: ct.id, name: ct.name ?? '' });
                }
            }
        }

        let subLandlordsWithTenancy: SubLandlordTenancyRow[] = [];
        const { data: slAllRows, error: slAllError } = await supabase
            .from('sub_landlords')
            .select('id,name,tenancy_number')
            .eq('is_deleted', false);

        if (slAllError) {
            const se = slAllError as { message?: string; details?: string; code?: string };
            console.error('sub_landlords fetch error:', se.message, se.details, se.code);
        } else {
            subLandlordsWithTenancy = (slAllRows || []).filter((x): x is SubLandlordTenancyRow => Boolean(x?.id));
        }

        const subLandlordMap = new Map<string, { id: string; name: string }>();
        for (const sl of subLandlordsWithTenancy) {
            subLandlordMap.set(sl.id, { id: sl.id, name: sl.name ?? '' });
        }

        return rows.map(r => {
            const tid = firstRentOutTenantIdFromRow(r);
            const currentTenant = tid ? tenantMap.get(tid) : undefined;
            const slIdRaw = (r as any).rent_out_sub_landlord_id as string | undefined;
            let subLandlord = slIdRaw ? subLandlordMap.get(slIdRaw) : undefined;

            const legacySlName = String((r as any).rent_out_sub_landlord ?? '').trim();
            if (!subLandlord && legacySlName) {
                subLandlord = { id: '', name: legacySlName };
            }

            const propCode = String((r.property as { code?: string } | null)?.code ?? '').trim();
            if (!subLandlord && propCode) {
                const byTenancy = findSubLandlordForPropertyCode(subLandlordsWithTenancy, propCode);
                if (byTenancy) subLandlord = byTenancy;
            }

            const camelRent = toCamel(r) as Record<string, unknown>;
            const { rentOutSubLandlordOrdId: _badCamelSubLandlordId, ...camelRentClean } = camelRent as Record<string, unknown> & {
                rentOutSubLandlordOrdId?: unknown;
            };
            void _badCamelSubLandlordId;
            return {
                ...camelRentClean,
                // toCamel 會把 rent_out_sub_landlord_id 錯誤轉成 rentOutSubLandlordOrdId，需以原始 snake_case 覆寫
                rentOutSubLandlordId: slIdRaw ?? camelRentClean.rentOutSubLandlordId,
                rentOutSubLandlord: (r as any).rent_out_sub_landlord ?? camelRentClean.rentOutSubLandlord,
                property: toCamel(r.property),
                proprietor: toCamel(r.proprietor),
                tenant: toCamel(r.tenant),
                currentTenant: currentTenant ? toCamel(currentTenant) : undefined,
                subLandlord: subLandlord ? toCamel(subLandlord) : undefined,
            };
        });
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            const e = err as { message?: string; details?: string; code?: string };
            console.error('Failed to fetch rents with relations:', e.message, e.details, e.code, err);
        }
        return [];
    }
};

/**
 * 同步合約的地段（rentPropertyLot）到所有關聯的收租記錄。
 * 當合約的地段發生變化時，自動更新所有引用該合約號碼的收租記錄。
 *
 * @param contractId 合約記錄的 ID
 * @param newLots 新的地段陣列（如 ["地段A", "地段B"]）
 * @param newPartial 各地段是否為「部分地方」
 */
export const syncContractLotsToRentOutRecords = async (
    contractId: string,
    newLots: string[],
    newPartial: Record<string, boolean> | null
): Promise<void> => {
    try {
        const contractTenancyNumber = (() => {
            // 從 rents 表直接查合約的 rentOutTenancyNumber
            // 不通過 fetchRentsWithRelations 以避免不必要的 joined data
            return null as string | null;
        })();

        // 查詢所有關聯的收租記錄（type='rent_out'）
        // 匹配條件：rent_collection_contract_number === 合約的 rentOutTenancyNumber
        // 由於 contractId 已確認，可直接以 id 查合約以取得 tenancyNumber
        const { data: contractRow, error: contractErr } = await supabase
            .from('rents')
            .select('id, rent_out_tenancy_number')
            .eq('id', contractId)
            .single();

        if (contractErr || !contractRow) {
            console.warn('[syncContractLotsToRentOutRecords] 無法取得合約記錄:', contractErr);
            return;
        }

        const tenancyNumber = (contractRow as any).rent_out_tenancy_number as string | null;
        if (!tenancyNumber) return;

        // 查詢所有引用該合約號碼的收租記錄
        const { data: rentOutRows, error: rentOutErr } = await supabase
            .from('rents')
            .select('id, rent_collection_contract_number')
            .eq('type', 'rent_out')
            .eq('rent_collection_contract_number', tenancyNumber)
            .eq('is_deleted', false);

        if (rentOutErr) {
            console.error('[syncContractLotsToRentOutRecords] 查詢收租記錄失敗:', rentOutErr);
            return;
        }

        if (!rentOutRows || rentOutRows.length === 0) return;

        // 準備同步數據
        const lotsValue = newLots.length > 0 ? JSON.stringify(newLots) : null;
        const partialValue = (() => {
            const obj = newPartial || {};
            const hasAny = Object.values(obj).some(Boolean);
            return hasAny ? JSON.stringify(obj) : null;
        })();

        const updates = {
            rent_property_lot: lotsValue,
            rent_property_lot_partial: partialValue,
            updated_at: new Date().toISOString(),
        };

        // 批量更新所有關聯的收租記錄
        const idsToUpdate = rentOutRows.map((r: any) => r.id);

        const { error: updateErr } = await supabase
            .from('rents')
            .update(updates)
            .in('id', idsToUpdate);

        if (updateErr) {
            console.error('[syncContractLotsToRentOutRecords] 批量更新失敗:', updateErr);
        } else {
            console.log(`[syncContractLotsToRentOutRecords] 已同步 ${idsToUpdate.length} 條收租記錄的地段資料`);
        }
    } catch (err) {
        console.error('[syncContractLotsToRentOutRecords] 同步失敗:', err);
    }
};

// Admin-only: 二房東 (Sub-landlords)
export const fetchSubLandlords = async (): Promise<SubLandlord[]> => {
    try {
        const { data, error } = await supabase
            .from('sub_landlords')
            .select('*')
            .eq('is_deleted', false)
            .order('name', { ascending: true });
        if (error) throw error;
        return (data || []).map(toCamel) as SubLandlord[];
    } catch (err: any) {
        console.error('Failed to fetch sub_landlords:', err);
        return [];
    }
};

export const fetchSubLandlord = async (id: string): Promise<SubLandlord | undefined> => {
    try {
        const { data, error } = await supabase.from('sub_landlords').select('*').eq('id', id).single();
        if (error) throw error;
        return toCamel(data) as SubLandlord;
    } catch {
        return undefined;
    }
};

// Admin-only: 現時租客 (Current tenants)
export const fetchCurrentTenants = async (): Promise<CurrentTenant[]> => {
    try {
        const { data, error } = await supabase
            .from('current_tenants')
            .select('*')
            .eq('is_deleted', false)
            .order('name', { ascending: true });
        if (error) throw error;
        return (data || []).map(toCamel) as CurrentTenant[];
    } catch (err: any) {
        console.error('Failed to fetch current_tenants:', err);
        return [];
    }
};

export const fetchCurrentTenant = async (id: string): Promise<CurrentTenant | undefined> => {
    try {
        const { data, error } = await supabase.from('current_tenants').select('*').eq('id', id).single();
        if (error) throw error;
        return toCamel(data) as CurrentTenant;
    } catch {
        return undefined;
    }
};

export const fetchPropertiesWithRelations = async (user?: any): Promise<PropertyWithRelations[]> => {
    try {
        const fields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, proprietor_ids, tenant_id, created_by, created_at, updated_at, images, parent_property_id';
        let pQuery = supabase.from('properties').select(fields);
        let oQuery = supabase.from('proprietors').select('*');
        let rQuery = supabase.from('rents').select('*');

        if (user && user.role !== 'admin') {
            pQuery = pQuery.eq('created_by', user.id);
            oQuery = oQuery.eq('created_by', user.id);
            rQuery = rQuery.eq('created_by', user.id);
        }

        pQuery = pQuery.eq('is_deleted', false);
        oQuery = oQuery.eq('is_deleted', false);
        rQuery = rQuery.eq('is_deleted', false);

        const [
            { data: properties },
            { data: proprietors },
            { data: rentsData }
        ] = await Promise.all([
            pQuery.order('code', { ascending: true }),
            oQuery,
            rQuery
        ]);

        const proprietorMap = new Map((proprietors || []).map(p => [p.id, toCamel(p)]));
        const camelRents = (rentsData || []).map(r => toCamel(r)) as Rent[];

        return (properties || []).map(property => {
            const camelProperty = mapPropertyRow(property);
            return {
                ...camelProperty,
                proprietor: camelProperty.proprietorId ? proprietorMap.get(camelProperty.proprietorId) : undefined,
                tenant: camelProperty.tenantId ? proprietorMap.get(camelProperty.tenantId) : undefined,
                rents: camelRents.filter(r => r.propertyId === camelProperty.id)
            } as PropertyWithRelations;
        });
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error('Failed to fetch properties with relations:', err);
        }
        return [];
    }
};

export const fetchUserStats = async (userId: string) => {
    try {
        const [
            { count: propertyCount },
            { count: proprietorCount },
            { count: rentCount }
        ] = await Promise.all([
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('created_by', userId).eq('is_deleted', false),
            supabase.from('proprietors').select('*', { count: 'exact', head: true }).eq('created_by', userId).eq('is_deleted', false),
            supabase.from('rents').select('*', { count: 'exact', head: true }).eq('created_by', userId).eq('is_deleted', false)
        ]);

        return {
            propertyCount: propertyCount || 0,
            proprietorCount: proprietorCount || 0,
            rentCount: rentCount || 0
        };
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error(`Failed to fetch stats for user ${userId}:`, err);
        }
        return { propertyCount: 0, proprietorCount: 0, rentCount: 0 };
    }
};

/** 單一日期是否落在 ref 的同一曆月（用於本月實際收／交租加總） */
function dateInCalendarMonth(d: unknown, ref: Date): boolean {
    if (d == null) return false;
    const t = new Date(d as string | number | Date);
    if (Number.isNaN(t.getTime())) return false;
    return t.getFullYear() === ref.getFullYear() && t.getMonth() === ref.getMonth();
}

/** 本月實際收／交租入帳日：繳付日優先，否則記帳日 */
function rentMonthTransactionAnchor(r: Record<string, unknown>): unknown {
    return r.rentCollectionPaymentDate ?? r.rentCollectionDate ?? null;
}

export const fetchDashboardStats = async (user?: any) => {
    try {
        // Base queries
        let propertiesQuery = supabase.from('properties').select('*', { count: 'exact', head: true });
        let proprietorsQuery = supabase.from('proprietors').select('*', { count: 'exact', head: true });
        let rentsQuery = supabase.from('rents').select('*', { count: 'exact', head: true });
        let rentsDataQuery = supabase
            .from('rents')
            .select(
                'type, status, renting_end_date, rent_out_end_date, rent_out_status, renting_monthly_rental, rent_out_monthly_rental, amount, renting_periods, rent_out_periods, rent_collection_date, rent_collection_amount, rent_collection_payment_date, rent_collection_payment_method, start_date, end_date, rent_out_start_date, renting_start_date, renting_end_date, rent_out_start_date',
            );

        let holdingQuery = supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'holding');
        let rentingQuery = supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'renting');
        let soldQuery = supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'sold');
        let suspendedQuery = supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'suspended');

        if (user && user.role !== 'admin') {
            propertiesQuery = propertiesQuery.eq('created_by', user.id);
            proprietorsQuery = proprietorsQuery.eq('created_by', user.id);
            rentsQuery = rentsQuery.eq('created_by', user.id);
            rentsDataQuery = rentsDataQuery.eq('created_by', user.id);

            holdingQuery = holdingQuery.eq('created_by', user.id);
            rentingQuery = rentingQuery.eq('created_by', user.id);
            soldQuery = soldQuery.eq('created_by', user.id);
            suspendedQuery = suspendedQuery.eq('created_by', user.id);
        }

        propertiesQuery = propertiesQuery.eq('is_deleted', false);
        proprietorsQuery = proprietorsQuery.eq('is_deleted', false);
        rentsQuery = rentsQuery.eq('is_deleted', false);
        rentsDataQuery = rentsDataQuery.eq('is_deleted', false);

        holdingQuery = holdingQuery.eq('is_deleted', false);
        rentingQuery = rentingQuery.eq('is_deleted', false);
        soldQuery = soldQuery.eq('is_deleted', false);
        suspendedQuery = suspendedQuery.eq('is_deleted', false);

        // Fetch counts in parallel
        const [
            { count: totalProperties },
            { count: totalProprietors },
            { count: totalRents },
            { data: rentsData }
        ] = await Promise.all([
            propertiesQuery,
            proprietorsQuery,
            rentsQuery,
            rentsDataQuery
        ]);

        // Get property status breakdown
        const [
            { count: holdingCount },
            { count: rentingCount },
            { count: soldCount },
            { count: suspendedCount }
        ] = await Promise.all([
            holdingQuery,
            rentingQuery,
            soldQuery,
            suspendedQuery
        ]);

        // Calculate rent statistics from the fetched rent data
        const rents = (rentsData || []).map(r => toCamel(r));
        const now = new Date();

        /** 本月份實際收租金額（$）：繳付日或記帳日落於本月之 rent_collection_amount 加總 */
        const monthlyRentCollected = rents
            .filter((r) => r.type === 'rent_out')
            .filter((r) => dateInCalendarMonth(rentMonthTransactionAnchor(r as Record<string, unknown>), now))
            .reduce((sum, r) => sum + Number((r as any).rentCollectionAmount ?? 0), 0);

        /** 本月份實際交租金額（$）：同上，租入（renting）記錄 */
        const monthlyRentPaid = rents
            .filter((r) => r.type === 'renting')
            .filter((r) => dateInCalendarMonth(rentMonthTransactionAnchor(r as Record<string, unknown>), now))
            .reduce((sum, r) => sum + Number((r as any).rentCollectionAmount ?? 0), 0);

        // ===== 合約統計：期內 / 期滿 =====
        const contractRows = rents.filter((r) => r.type === 'contract' || r.type === 'rent_out');
        const todayStr = now.toISOString().split('T')[0];

        const contractActiveCount = contractRows.filter((r) => {
            const end = (r as any).rentOutEndDate ?? (r as any).endDate ?? null;
            if (!end) return true; // 無結束日視為期內
            return String(end) >= todayStr;
        }).length;

        const contractExpiredCount = contractRows.filter((r) => {
            const end = (r as any).rentOutEndDate ?? (r as any).endDate ?? null;
            if (!end) return false;
            return String(end) < todayStr;
        }).length;

        return {
            totalProperties: totalProperties || 0,
            totalProprietors: totalProprietors || 0,
            totalRents: totalRents || 0,
            monthlyRentCollected,
            monthlyRentPaid,
            statusBreakdown: {
                holding: holdingCount || 0,
                renting: rentingCount || 0,
                sold: soldCount || 0,
                suspended: suspendedCount || 0
            },
            contractBreakdown: {
                active: contractActiveCount,
                expired: contractExpiredCount
            }
        };
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error('Failed to fetch dashboard stats:', err);
        }
        return {
            totalProperties: 0,
            totalProprietors: 0,
            totalRents: 0,
            monthlyRentCollected: 0,
            monthlyRentPaid: 0,
            statusBreakdown: {
                holding: 0,
                renting: 0,
                sold: 0,
                suspended: 0
            },
            contractBreakdown: {
                active: 0,
                expired: 0
            }
        };
    }
};

// ==================== PROPERTY HOOKS ====================

export function useProperties() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getProperties = useCallback(async (query?: string): Promise<Property[]> => {
        setLoading(true);
        setError(null);
        const data = await fetchProperties(user, { query });
        setLoading(false);
        return data;
    }, [user]);

    const getProperty = useCallback(async (id: string): Promise<Property | undefined> => {
        setLoading(true);
        setError(null);
        const data = await fetchProperty(id);
        setLoading(false);
        return data;
    }, []);

    const addProperty = useCallback(async (property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
        setLoading(true);
        setError(null);
        try {
            const id = generateId();
            const propertyData = {
                id,
                name: property.name,
                type: property.type,
                status: property.status,
                address: property.address,
                code: property.code,
                lot_index: property.lotIndex,
                lot_area: property.lotArea,
                land_use: property.landUse,
                images: property.images,
                geo_maps: property.geoMaps,
                location: property.location,
                google_drive_plan_url: property.googleDrivePlanUrl,
                has_planning_permission: property.hasPlanningPermission,
                notes: property.notes,
                proprietor_id: property.proprietorId,
                // proprietor_ids 需要資料庫遷移後才能使用
                tenant_id: property.tenantId,
                parent_property_id: property.parentPropertyId,
                created_by: property.createdBy || user?.id,
            };

            // Remove undefined/null values so Supabase doesn't try to insert them
            const cleanData = Object.fromEntries(
                Object.entries(propertyData).filter(([_, v]) => v !== undefined && v !== null)
            );

            const { error: sbError } = await supabase
                .from('properties')
                .insert([cleanData]);

            if (sbError) throw sbError;
            return id;
        } catch (err: any) {
            setError('Failed to add property to cloud');
            console.error('Add Property Error:', err);
            // Better error reporting for Supabase errors
            if (err.message) console.error('Error Message:', err.message);
            if (err.code) console.error('Error Code:', err.code);
            if (err.details) console.error('Error Details:', err.details);
            if (err.hint) console.error('Error Hint:', err.hint);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProperty = useCallback(async (id: string, updates: Partial<Property>): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const updateData = toSnake(updates);
            // Base allowed fields (always exist in DB)
            const baseAllowed = [
                'name', 'type', 'status', 'address', 'code',
                'lot_index', 'lot_area', 'land_use',
                'images', 'geo_maps', 'location',
                'google_drive_plan_url', 'has_planning_permission', 'notes',
                'proprietor_id', 'tenant_id', 'parent_property_id', 'created_by'
            ];
            // Extended fields (may not exist in older DB schemas)
            const extendedAllowed = [
                'proprietor_ids'
            ];
            const allAllowed = [...baseAllowed, ...extendedAllowed];
            const filtered: any = {};
            Object.keys(updateData).forEach(k => {
                if (allAllowed.includes(k)) filtered[k] = updateData[k];
            });

            const { error: sbError } = await supabase
                .from('properties')
                .update(filtered)
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err: any) {
            setError('Failed to update property in cloud');
            console.error('Update Property Error:', err);
            if (err.message) console.error('Error Message:', err.message);
            if (err.code) console.error('Error Code:', err.code);
            if (err.details) console.error('Error Details:', err.details);
            if (err.hint) console.error('Error Hint:', err.hint);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteProperty = useCallback(async (id: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const { error: sbError } = await supabase
                .from('properties')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            setError('Failed to soft delete property from cloud');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const bulkUpdateProperties = useCallback(async (ids: string[], updates: Partial<Property>): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const updateData = toSnake(updates);
            const allowed = ['status', 'type', 'created_by', 'proprietor_id', 'tenant_id', 'land_use'];
            const filtered: any = {};
            Object.keys(updateData).forEach(k => { if (allowed.includes(k)) filtered[k] = updateData[k]; });

            const { error: sbError } = await supabase
                .from('properties')
                .update(filtered)
                .in('id', ids);

            if (sbError) throw sbError;
            return true;
        } catch (err: any) {
            setError('Failed to bulk update properties in cloud');
            console.error('Bulk Update Properties Error:', err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const searchProperties = useCallback(async (query: string): Promise<Property[]> => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('properties')
                .select('*')
                .or(`name.ilike.%${query}%,code.ilike.%${query}%,address.ilike.%${query}%`);

            if (sbError) throw sbError;
            return (data || []).map(mapPropertyRow);
        } catch (err) {
            setError('Failed to search properties in cloud');
            console.error(err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        getProperties,
        getProperty,
        addProperty,
        updateProperty,
        bulkUpdateProperties,
        deleteProperty,
        searchProperties
    };
}

export function usePropertiesQuery(options?: { query?: string; bypassIsolation?: boolean }) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['properties', user?.id, options?.bypassIsolation],
        queryFn: () => fetchProperties(user, options),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

// ==================== PROPRIETOR HOOKS ====================

export function useProprietors() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getProprietors = useCallback(async (): Promise<Proprietor[]> => {
        setLoading(true);
        setError(null);
        const data = await fetchProprietors(user);
        setLoading(false);
        return data;
    }, [user]);

    const getProprietor = useCallback(async (id: string): Promise<Proprietor | undefined> => {
        setLoading(true);
        setError(null);
        const data = await fetchProprietor(id);
        setLoading(false);
        return data;
    }, []);

    const addProprietor = useCallback(async (proprietor: Omit<Proprietor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
        setLoading(true);
        setError(null);
        try {
            const id = generateId();
            const data: Record<string, any> = {
                id,
                name: proprietor.name,
                code: proprietor.code,
                type: proprietor.type,
                category: proprietor.category,
                english_name: proprietor.englishName,
                short_name: proprietor.shortName,
                created_by: user?.id,
            };

            if (proprietor.brNumber !== undefined) {
                data.br_number = proprietor.brNumber === '' ? null : proprietor.brNumber;
            }

            const { error: sbError } = await supabase
                .from('proprietors')
                .insert([data]);

            if (sbError) throw sbError;
            return id;
        } catch (err: any) {
            setError('Failed to add proprietor to cloud');
            console.error(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProprietor = useCallback(async (id: string, updates: Partial<Proprietor>): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const updateData: Record<string, any> = {
                name: updates.name,
                code: updates.code,
                type: updates.type,
                category: updates.category,
                english_name: updates.englishName,
                short_name: updates.shortName,
            };
            if (updates.brNumber !== undefined) {
                updateData.br_number = updates.brNumber === '' ? null : updates.brNumber;
            }
            // Remove undefined
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            const { error: sbError } = await supabase
                .from('proprietors')
                .update(updateData)
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            setError('Failed to update proprietor in cloud');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteProprietor = useCallback(async (id: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const { error: sbError } = await supabase
                .from('proprietors')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            setError('Failed to soft delete proprietor from cloud');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        getProprietors,
        getProprietor,
        addProprietor,
        updateProprietor,
        deleteProprietor
    };
}

export function useProprietorsQuery() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['proprietors', user?.id],
        queryFn: () => fetchProprietors(user),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

// ==================== SUB-LANDLORD & CURRENT-TENANT HOOKS (Admin) ====================

const rentOutContractToRow = (obj: any): Record<string, any> => {
    const m: Record<string, any> = {};
    const map: [string, string][] = [
        ['code', 'code'],
        ['englishName', 'english_name'],
        ['shortName', 'short_name'],
        ['type', 'type'],
        ['category', 'category'],
        ['brNumber', 'br_number'],
        ['tenancyNumber', 'tenancy_number'],
        ['pricing', 'pricing'],
        ['monthlyRental', 'monthly_rental'],
        ['periods', 'periods'],
        ['totalAmount', 'total_amount'],
        ['startDate', 'start_date'],
        ['endDate', 'end_date'],
        ['actualEndDate', 'actual_end_date'],
        ['depositReceived', 'deposit_received'],
        ['depositReceiptNumber', 'deposit_receipt_number'],
        ['depositReceiveDate', 'deposit_receive_date'],
        ['depositReturnDate', 'deposit_return_date'],
        ['depositReturnAmount', 'deposit_return_amount'],
        ['lessor', 'lessor'],
        ['addressDetail', 'address_detail'],
        ['status', 'status'],
        ['description', 'description'],
    ];
    const toDateStr = (v: any) => (v instanceof Date ? v.toISOString().split('T')[0] : v);
    map.forEach(([k, col]) => {
        if (obj[k] !== undefined && obj[k] !== '') {
            const v = obj[k];
            m[col] = ['startDate', 'endDate', 'actualEndDate', 'depositReceiveDate', 'depositReturnDate'].includes(k) ? toDateStr(v) : v;
        }
    });
    return m;
};

export function useSubLandlords() {
    const { user } = useAuth();
    const addSubLandlord = useCallback(async (item: Omit<SubLandlord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
        try {
            const id = generateId();
            const row: Record<string, any> = {
                id,
                name: item.name,
                created_by: user?.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...rentOutContractToRow(item),
            };
            const { error } = await supabase.from('sub_landlords').insert([row]);
            if (error) throw error;
            return id;
        } catch (err) {
            console.error(err);
            return null;
        }
    }, [user]);
    const updateSubLandlord = useCallback(async (id: string, updates: Partial<SubLandlord>): Promise<boolean> => {
        try {
            const row: Record<string, any> = { updated_at: new Date().toISOString(), ...rentOutContractToRow(updates) };
            if (updates.name !== undefined) row.name = updates.name;
            const { error } = await supabase.from('sub_landlords').update(row).eq('id', id);
            if (error) throw error;
            return true;
        } catch {
            return false;
        }
    }, []);
    const deleteSubLandlord = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { error } = await supabase.from('sub_landlords').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            return true;
        } catch {
            return false;
        }
    }, []);
    return { addSubLandlord, updateSubLandlord, deleteSubLandlord };
}

export function useCurrentTenants() {
    const { user } = useAuth();
    const addCurrentTenant = useCallback(async (item: Omit<CurrentTenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
        try {
            const id = generateId();
            const row: Record<string, any> = {
                id,
                name: item.name,
                created_by: user?.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...rentOutContractToRow(item),
            };
            const { error } = await supabase.from('current_tenants').insert([row]);
            if (error) throw error;
            return id;
        } catch (err) {
            console.error(err);
            return null;
        }
    }, [user]);
    const updateCurrentTenant = useCallback(async (id: string, updates: Partial<CurrentTenant>): Promise<boolean> => {
        try {
            const row: Record<string, any> = { updated_at: new Date().toISOString(), ...rentOutContractToRow(updates) };
            if (updates.name !== undefined) row.name = updates.name;
            if (updates.code !== undefined) row.code = updates.code;
            const { error } = await supabase.from('current_tenants').update(row).eq('id', id);
            if (error) throw error;
            return true;
        } catch {
            return false;
        }
    }, []);
    const deleteCurrentTenant = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { error } = await supabase.from('current_tenants').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            return true;
        } catch {
            return false;
        }
    }, []);
    return { addCurrentTenant, updateCurrentTenant, deleteCurrentTenant };
}

export function useSubLandlordsQuery() {
    return useQuery({
        queryKey: ['sub_landlords'],
        queryFn: fetchSubLandlords,
        staleTime: 2 * 60 * 1000,
    });
}

export function useCurrentTenantsQuery() {
    return useQuery({
        queryKey: ['current_tenants'],
        queryFn: fetchCurrentTenants,
        staleTime: 2 * 60 * 1000,
    });
}

// ==================== RENT HOOKS ====================

export function useRents() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getRents = useCallback(async (): Promise<Rent[]> => {
        setLoading(true);
        setError(null);
        const data = await fetchRents(user);
        setLoading(false);
        return data;
    }, [user]);

    const getRentsByType = useCallback(async (type: 'renting' | 'rent_out'): Promise<Rent[]> => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('rents')
                .select('*')
                .eq('type', type)
                .order('created_at', { ascending: false });

            if (sbError) throw sbError;
            return (data || []).map(d => toCamel(d)) as Rent[];
        } catch (err) {
            console.error(err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const addRent = useCallback(async (rent: Omit<Rent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
        setLoading(true);
        setError(null);
        try {
            const id = generateId();
            const now = new Date().toISOString();

            // Build rent data with all new fields
            const rentData: Record<string, any> = {
                id,
                property_id: rent.propertyId,
                proprietor_id: rent.proprietorId || null,
                tenant_id: rent.tenantId || null,
                type: rent.type,
                created_at: now,
                updated_at: now,
                created_by: user?.id,
            };

            // Add legacy fields if present
            if (rent.location) rentData.location = rent.location;
            if (rent.amount) rentData.amount = rent.amount;
            if (rent.currency) rentData.currency = rent.currency;
            if (rent.startDate) rentData.start_date = rent.startDate;
            if (rent.endDate) rentData.end_date = rent.endDate;
            if (rent.status) rentData.status = rent.status;
            if (rent.notes) rentData.notes = rent.notes;

            // Add Rent Out (收租) fields
            if (rent.rentOutTenancyNumber) rentData.rent_out_tenancy_number = rent.rentOutTenancyNumber;
            if (rent.rentOutPricing) rentData.rent_out_pricing = rent.rentOutPricing;
            if (rent.rentOutMonthlyRental) rentData.rent_out_monthly_rental = rent.rentOutMonthlyRental;
            if (rent.rentOutPeriods) rentData.rent_out_periods = rent.rentOutPeriods;
            if (rent.rentOutTotalAmount) rentData.rent_out_total_amount = rent.rentOutTotalAmount;
            if (rent.rentOutStartDate) rentData.rent_out_start_date = rent.rentOutStartDate;
            if (rent.rentOutEndDate) rentData.rent_out_end_date = rent.rentOutEndDate;
            if (rent.rentOutActualEndDate) rentData.rent_out_actual_end_date = rent.rentOutActualEndDate;
            const rod = rent as any;
            if (rod.rentOutContractNature) rentData.rent_out_contract_nature = rod.rentOutContractNature;
            if (rent.rentOutDepositReceived != null && !Number.isNaN(Number(rent.rentOutDepositReceived))) {
                rentData.rent_out_deposit_received = Number(rent.rentOutDepositReceived);
            }
            if (rod.rentOutDepositPaymentMethod) rentData.rent_out_deposit_payment_method = rod.rentOutDepositPaymentMethod;
            if (rod.rentOutDepositReceiptNumber !== undefined && rod.rentOutDepositReceiptNumber !== null && rod.rentOutDepositReceiptNumber !== '') {
                rentData.rent_out_deposit_receipt_number = rod.rentOutDepositReceiptNumber;
            }
            if (rod.rentOutDepositChequeBank) rentData.rent_out_deposit_cheque_bank = rod.rentOutDepositChequeBank;
            if (rod.rentOutDepositChequeNumber) rentData.rent_out_deposit_cheque_number = rod.rentOutDepositChequeNumber;
            if (rod.rentOutDepositChequeImage) rentData.rent_out_deposit_cheque_image = rod.rentOutDepositChequeImage;
            if (rod.rentOutDepositPaymentDate) rentData.rent_out_deposit_payment_date = rod.rentOutDepositPaymentDate;
            if (rod.rentOutDepositBankInImage) rentData.rent_out_deposit_bank_in_image = rod.rentOutDepositBankInImage;
            if (rent.rentOutDepositReceiveDate) rentData.rent_out_deposit_receive_date = rent.rentOutDepositReceiveDate;
            if (rent.rentOutDepositReturnDate) rentData.rent_out_deposit_return_date = rent.rentOutDepositReturnDate;
            if (rent.rentOutDepositReturnAmount) rentData.rent_out_deposit_return_amount = rent.rentOutDepositReturnAmount;
            if (rent.rentOutLessor) rentData.rent_out_lessor = rent.rentOutLessor;
            if (rent.rentOutAddressDetail) rentData.rent_out_address_detail = rent.rentOutAddressDetail;
            if (rent.rentOutStatus) rentData.rent_out_status = rent.rentOutStatus;
            if (rent.rentOutDescription) rentData.rent_out_description = rent.rentOutDescription;
            if ((rent as any).rentOutSubLandlord) rentData.rent_out_sub_landlord = (rent as any).rentOutSubLandlord;
            if ((rent as any).rentOutSubLandlordId) rentData.rent_out_sub_landlord_id = (rent as any).rentOutSubLandlordId;
            if ((rent as any).rentOutTenants?.length) rentData.rent_out_tenants = JSON.stringify((rent as any).rentOutTenants);
            if ((rent as any).rentOutTenantIds?.length) rentData.rent_out_tenant_ids = (rent as any).rentOutTenantIds;

            const rc = rent as any;
            if (rc.rentCollectionTenantName) rentData.rent_collection_tenant_name = rc.rentCollectionTenantName;
            if (rc.rentCollectionDate) rentData.rent_collection_date = rc.rentCollectionDate;
            if (rc.rentCollectionAmount != null && rc.rentCollectionAmount !== '' && !Number.isNaN(Number(rc.rentCollectionAmount))) {
                rentData.rent_collection_amount = Number(rc.rentCollectionAmount);
            }
            if (rc.rentCollectionPaymentMethod) rentData.rent_collection_payment_method = rc.rentCollectionPaymentMethod;
            if (rc.rentCollectionChequeBank) rentData.rent_collection_cheque_bank = rc.rentCollectionChequeBank;
            if (rc.rentCollectionChequeNumber) rentData.rent_collection_cheque_number = rc.rentCollectionChequeNumber;
            if (rc.rentCollectionChequeImage) rentData.rent_collection_cheque_image = rc.rentCollectionChequeImage;
            if (rc.rentCollectionPaymentDate) rentData.rent_collection_payment_date = rc.rentCollectionPaymentDate;
            if (rc.rentCollectionBankInImage !== undefined) {
                rentData.rent_collection_bank_in_image = rc.rentCollectionBankInImage;
            }
            if (rc.rentCollectionContractNumber !== undefined) {
                rentData.rent_collection_contract_number = rc.rentCollectionContractNumber || null;
            }
            if (rc.rentCollectionReceiptNumber !== undefined) {
                rentData.rent_collection_receipt_number = rc.rentCollectionReceiptNumber || null;
            }
            if (rc.rentCollectionContractNature !== undefined) {
                rentData.rent_collection_contract_nature = rc.rentCollectionContractNature || null;
            }
            if (rc.rentFreePeriodStartDate !== undefined || rc.rentFreePeriodEndDate !== undefined) {
                rentData.rent_free_period_start_date = rc.rentFreePeriodStartDate || null;
                rentData.rent_free_period_end_date = rc.rentFreePeriodEndDate || null;
            } else if ((rent as any).rentFreePeriodDate) {
                rentData.rent_free_period_date = (rent as any).rentFreePeriodDate;
            }
            if (rc.rentPropertyLot !== undefined) {
                const v = rc.rentPropertyLot;
                if (Array.isArray(v)) {
                    rentData.rent_property_lot = v.map(String).join(',') || null;
                } else if (typeof v === 'string') {
                    rentData.rent_property_lot = v.trim() || null;
                } else {
                    rentData.rent_property_lot = null;
                }
            }
            if (rc.rentPropertyLotStandalone !== undefined) {
                rentData.rent_property_lot_standalone = rc.rentPropertyLotStandalone ? true : null;
            }
            if (rc.rentPropertyLotPartial !== undefined) {
                const obj = parseRentPropertyLotPartialForSave(rc.rentPropertyLotPartial);
                if (obj && Object.values(obj).some(Boolean)) {
                    rentData.rent_property_lot_partial = JSON.stringify(obj);
                } else {
                    rentData.rent_property_lot_partial = null;
                }
            }

            // Add Renting (交租) fields
            if (rent.rentingNumber) rentData.renting_number = rent.rentingNumber;
            if (rent.rentingReferenceNumber) rentData.renting_reference_number = rent.rentingReferenceNumber;
            if (rent.rentingMonthlyRental) rentData.renting_monthly_rental = rent.rentingMonthlyRental;
            if (rent.rentingPeriods) rentData.renting_periods = rent.rentingPeriods;
            if (rent.rentingStartDate) rentData.renting_start_date = rent.rentingStartDate;
            if (rent.rentingEndDate) rentData.renting_end_date = rent.rentingEndDate;
            if (rent.rentingDeposit) rentData.renting_deposit = rent.rentingDeposit;

            // Convert Date objects to ISO strings for Supabase
            for (const key of Object.keys(rentData)) {
                if (rentData[key] instanceof Date) {
                    rentData[key] = rentData[key].toISOString();
                }
            }

            // Remove undefined/null optional fields
            const cleanRentData = Object.fromEntries(
                Object.entries(rentData).filter(([_, v]) => v !== undefined)
            );

            const { error: sbError } = await withSchemaFallbackInsert('rents', cleanRentData);

            if (sbError) throw sbError;
            return id;
        } catch (err: any) {
            setError('Failed to add rent to cloud');
            console.error('Add Rent Error:', err);
            if (err.message) console.error('Error Message:', err.message);
            if (err.details) console.error('Error Details:', err.details);
            if (err.hint) console.error('Error Hint:', err.hint);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // 辅助函数：从二房东的tenancyNumber中移除指定物业编号
    const removePropertyFromSubLandlordTenancyNumber = useCallback(async (
        subLandlordId: string,
        propertyCode: string
    ): Promise<void> => {
        try {
            const subLandlord = await fetchSubLandlord(subLandlordId);
            if (!subLandlord || !subLandlord.tenancyNumber) return;
            
            // 从tenancyNumber中移除该物业编号
            const parts = subLandlord.tenancyNumber.split(',').map(p => p.trim());
            const filteredParts = parts.filter(part => {
                // 标准化比较：去除空格并转换为统一格式
                const normalizedPart = part.trim();
                const normalizedPropertyCode = propertyCode.trim();
                
                // 1. 首先检查是否完全匹配（如 A01-P001 === A01-P001）
                if (normalizedPart === normalizedPropertyCode) {
                    return false; // 完全匹配，需要移除
                }
                
                // 2. 检查propertyCode是否是part的前缀（如 A01-P001 匹配 A01-P001-xxx）
                if (normalizedPart.startsWith(normalizedPropertyCode + '-')) {
                    return false; // propertyCode是前缀，需要移除
                }
                
                // 3. 检查part是否是propertyCode的前缀（如 A01 匹配 A01-P001）
                if (normalizedPropertyCode.startsWith(normalizedPart + '-')) {
                    return false; // part是propertyCode的前缀，需要移除
                }
                
                // 4. 检查是否是后缀格式（如 C33-ER033），如果是，只比较前缀部分
                const firstDashIndex = normalizedPart.indexOf('-');
                const propertyFirstDash = normalizedPropertyCode.indexOf('-');
                
                if (firstDashIndex > 0) {
                    const afterDash = normalizedPart.substring(firstDashIndex + 1);
                    // 如果是后缀格式（2-3个大写字母+数字，如ER033）
                    if (afterDash.match(/^[A-Z]{2,3}\d+$/)) {
                        const partCode = normalizedPart.substring(0, firstDashIndex);
                        // 如果propertyCode也是短格式（如C33），直接比较
                        if (propertyFirstDash === -1) {
                            return partCode !== normalizedPropertyCode;
                        }
                        // 如果propertyCode是完整格式（如A01-P001），检查前缀
                        const propertyPrefix = normalizedPropertyCode.substring(0, propertyFirstDash);
                        return partCode !== propertyPrefix;
                    } else {
                        // 不是后缀格式，可能是完整物业编号（如A01-P001）
                        // 检查propertyCode是否是part的前缀，或part是否是propertyCode的前缀
                        if (propertyFirstDash > 0) {
                            const propertyPrefix = normalizedPropertyCode.substring(0, propertyFirstDash);
                            const partPrefix = normalizedPart.substring(0, firstDashIndex);
                            // 如果前缀相同，说明是同一个物业的不同子物业，需要移除
                            if (partPrefix === propertyPrefix) {
                                return false;
                            }
                        }
                    }
                }
                
                // 5. 如果propertyCode没有"-"，检查part的前缀是否匹配
                if (propertyFirstDash === -1 && firstDashIndex > 0) {
                    const partPrefix = normalizedPart.substring(0, firstDashIndex);
                    if (partPrefix === normalizedPropertyCode) {
                        return false; // 前缀匹配，需要移除
                    }
                }
                
                // 6. 其他情况，保留该部分
                return true;
            });
            
            // 更新二房东的tenancyNumber
            const newTenancyNumber = filteredParts.join(', ').trim();
            if (newTenancyNumber !== subLandlord.tenancyNumber && newTenancyNumber !== '') {
                const { error } = await supabase
                    .from('sub_landlords')
                    .update({ 
                        tenancy_number: newTenancyNumber || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', subLandlordId);
                if (error) throw error;
            } else if (newTenancyNumber === '') {
                // 如果所有物业都被移除，清空tenancyNumber
                const { error } = await supabase
                    .from('sub_landlords')
                    .update({ 
                        tenancy_number: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', subLandlordId);
                if (error) throw error;
            }
        } catch (err) {
            console.error('Failed to update sub-landlord tenancy number:', err);
        }
    }, []);

    const updateRent = useCallback(async (id: string, updates: Partial<Rent>): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            // 如果需要移除propertyId或rentOutSubLandlordId，先获取原始记录信息
            let originalRent: Rent | null = null;
            if (updates.propertyId === null || updates.propertyId === undefined || 
                (updates as any).rentOutSubLandlordId === null || (updates as any).rentOutSubLandlordId === '') {
                const allRents = await fetchRents();
                originalRent = allRents.find(r => r.id === id) || null;
            }
            
            const rentData: any = {
                updated_at: new Date().toISOString(),
            };

            // Mapping Rent fields to DB columns
            if (updates.propertyId !== undefined) rentData.property_id = updates.propertyId || null;
            if (updates.proprietorId !== undefined) rentData.proprietor_id = updates.proprietorId || null;
            if (updates.tenantId !== undefined) rentData.tenant_id = updates.tenantId || null;
            if (updates.type) rentData.type = updates.type;
            if (updates.status !== undefined) rentData.status = updates.status;
            if (updates.currency) rentData.currency = updates.currency;
            if (updates.location) rentData.location = updates.location;
            if (updates.notes !== undefined) rentData.notes = updates.notes;
            if (updates.amount !== undefined) rentData.amount = updates.amount;
            if (updates.startDate !== undefined) rentData.start_date = updates.startDate;
            if (updates.endDate !== undefined) rentData.end_date = updates.endDate;

            // RENT OUT fields（含清空：收租記錄編號同步寫入時可能為 null）
            if (updates.rentOutTenancyNumber !== undefined) {
                rentData.rent_out_tenancy_number = updates.rentOutTenancyNumber || null;
            }
            if (updates.rentOutPricing !== undefined) rentData.rent_out_pricing = updates.rentOutPricing;
            if (updates.rentOutMonthlyRental !== undefined) rentData.rent_out_monthly_rental = updates.rentOutMonthlyRental;
            if (updates.rentOutPeriods !== undefined) rentData.rent_out_periods = updates.rentOutPeriods;
            if (updates.rentOutTotalAmount !== undefined) rentData.rent_out_total_amount = updates.rentOutTotalAmount;
            if (updates.rentOutStartDate) rentData.rent_out_start_date = updates.rentOutStartDate;
            if (updates.rentOutEndDate) rentData.rent_out_end_date = updates.rentOutEndDate;
            if (updates.rentOutActualEndDate !== undefined) rentData.rent_out_actual_end_date = updates.rentOutActualEndDate;
            if (updates.rentOutDepositReceived !== undefined) rentData.rent_out_deposit_received = updates.rentOutDepositReceived;
            if ((updates as any).rentOutDepositPaymentMethod !== undefined) {
                rentData.rent_out_deposit_payment_method = (updates as any).rentOutDepositPaymentMethod || null;
            }
            if ((updates as any).rentOutDepositReceiptNumber !== undefined) rentData.rent_out_deposit_receipt_number = (updates as any).rentOutDepositReceiptNumber;
            const udep = updates as any;
            // 合約性質：trim 後寫入；空字串寫 null（與表單「請選擇」一致）
            if (Object.prototype.hasOwnProperty.call(updates, 'rentOutContractNature')) {
                const raw = (updates as { rentOutContractNature?: string | null }).rentOutContractNature;
                if (raw == null || raw === '') {
                    rentData.rent_out_contract_nature = null;
                } else {
                    rentData.rent_out_contract_nature = String(raw).trim() || null;
                }
            }
            if (udep.rentOutDepositChequeBank !== undefined) {
                rentData.rent_out_deposit_cheque_bank = udep.rentOutDepositChequeBank || null;
            }
            if (udep.rentOutDepositChequeNumber !== undefined) {
                rentData.rent_out_deposit_cheque_number = udep.rentOutDepositChequeNumber || null;
            }
            if (udep.rentOutDepositChequeImage !== undefined) {
                rentData.rent_out_deposit_cheque_image = udep.rentOutDepositChequeImage || null;
            }
            if (udep.rentOutDepositPaymentDate !== undefined) {
                rentData.rent_out_deposit_payment_date = udep.rentOutDepositPaymentDate || null;
            }
            if (udep.rentOutDepositBankInImage !== undefined) {
                rentData.rent_out_deposit_bank_in_image = udep.rentOutDepositBankInImage || null;
            }
            if (updates.rentOutDepositReceiveDate) rentData.rent_out_deposit_receive_date = updates.rentOutDepositReceiveDate;
            if (updates.rentOutDepositReturnDate) rentData.rent_out_deposit_return_date = updates.rentOutDepositReturnDate;
            if (updates.rentOutDepositReturnAmount !== undefined) rentData.rent_out_deposit_return_amount = updates.rentOutDepositReturnAmount;
            if (updates.rentOutLessor !== undefined) rentData.rent_out_lessor = updates.rentOutLessor || null;
            if (updates.rentOutAddressDetail !== undefined) rentData.rent_out_address_detail = updates.rentOutAddressDetail || null;
            if (updates.rentOutStatus) rentData.rent_out_status = updates.rentOutStatus;
            if (updates.rentOutDescription) rentData.rent_out_description = updates.rentOutDescription;
            if ((updates as any).rentOutSubLandlord !== undefined) rentData.rent_out_sub_landlord = (updates as any).rentOutSubLandlord;
            if ((updates as any).rentOutSubLandlordId !== undefined) rentData.rent_out_sub_landlord_id = (updates as any).rentOutSubLandlordId;
            if ((updates as any).rentOutTenants !== undefined) rentData.rent_out_tenants = JSON.stringify((updates as any).rentOutTenants);
            if ((updates as any).rentOutTenantIds !== undefined) rentData.rent_out_tenant_ids = (updates as any).rentOutTenantIds;

            const urc = updates as any;
            if (urc.rentCollectionTenantName !== undefined) rentData.rent_collection_tenant_name = urc.rentCollectionTenantName || null;
            if (urc.rentCollectionDate !== undefined) rentData.rent_collection_date = urc.rentCollectionDate || null;
            if (urc.rentCollectionAmount !== undefined) rentData.rent_collection_amount = urc.rentCollectionAmount;
            if (urc.rentCollectionPaymentMethod !== undefined) rentData.rent_collection_payment_method = urc.rentCollectionPaymentMethod || null;
            if (urc.rentCollectionChequeBank !== undefined) rentData.rent_collection_cheque_bank = urc.rentCollectionChequeBank || null;
            if (urc.rentCollectionChequeNumber !== undefined) rentData.rent_collection_cheque_number = urc.rentCollectionChequeNumber || null;
            if (urc.rentCollectionChequeImage !== undefined) rentData.rent_collection_cheque_image = urc.rentCollectionChequeImage || null;
            if (urc.rentCollectionPaymentDate !== undefined) rentData.rent_collection_payment_date = urc.rentCollectionPaymentDate || null;
            if ((urc as any).rentCollectionBankInImage !== undefined) {
                rentData.rent_collection_bank_in_image = (urc as any).rentCollectionBankInImage || null;
            }
            if (urc.rentCollectionContractNumber !== undefined) {
                rentData.rent_collection_contract_number = urc.rentCollectionContractNumber || null;
            }
            if (urc.rentCollectionReceiptNumber !== undefined) {
                rentData.rent_collection_receipt_number = urc.rentCollectionReceiptNumber || null;
            }
            if (urc.rentCollectionContractNature !== undefined) {
                rentData.rent_collection_contract_nature = urc.rentCollectionContractNature || null;
            }
            if (urc.rentFreePeriodStartDate !== undefined || urc.rentFreePeriodEndDate !== undefined) {
                rentData.rent_free_period_start_date = urc.rentFreePeriodStartDate || null;
                rentData.rent_free_period_end_date = urc.rentFreePeriodEndDate || null;
            } else if (Object.prototype.hasOwnProperty.call(updates, 'rentFreePeriodDate')) {
                rentData.rent_free_period_date = (updates as any).rentFreePeriodDate || null;
            }
            if (urc.rentPropertyLot !== undefined) {
                const v = urc.rentPropertyLot;
                if (Array.isArray(v)) {
                    rentData.rent_property_lot = v.map(String).join(',') || null;
                } else if (typeof v === 'string') {
                    rentData.rent_property_lot = v.trim() || null;
                } else {
                    rentData.rent_property_lot = null;
                }
            }
            if (urc.rentPropertyLotStandalone !== undefined) {
                rentData.rent_property_lot_standalone = urc.rentPropertyLotStandalone ? true : null;
            }
            if (urc.rentPropertyLotPartial !== undefined) {
                const obj = parseRentPropertyLotPartialForSave(urc.rentPropertyLotPartial);
                if (obj && Object.values(obj).some(Boolean)) {
                    rentData.rent_property_lot_partial = JSON.stringify(obj);
                } else {
                    rentData.rent_property_lot_partial = null;
                }
            }

            // RENTING fields
            if (updates.rentingNumber) rentData.renting_number = updates.rentingNumber;
            if (updates.rentingReferenceNumber) rentData.renting_reference_number = updates.rentingReferenceNumber;
            if (updates.rentingMonthlyRental !== undefined) rentData.renting_monthly_rental = updates.rentingMonthlyRental;
            if (updates.rentingPeriods !== undefined) rentData.renting_periods = updates.rentingPeriods;
            if (updates.rentingStartDate) rentData.renting_start_date = updates.rentingStartDate;
            if (updates.rentingEndDate) rentData.renting_end_date = updates.rentingEndDate;
            if (updates.rentingDeposit !== undefined) rentData.renting_deposit = updates.rentingDeposit;

            // Convert Date objects to ISO strings for Supabase
            for (const key of Object.keys(rentData)) {
                if (rentData[key] instanceof Date) {
                    rentData[key] = rentData[key].toISOString();
                }
            }

            const { error: sbError } = await withSchemaFallbackUpdate('rents', id, rentData);

            if (sbError) throw sbError;
            
            // 如果移除了propertyId或rentOutSubLandlordId，需要同步更新二房东的tenancyNumber
            if (originalRent && originalRent.propertyId && (originalRent as any).rentOutSubLandlordId) {
                const propertyIdRemoved = updates.propertyId === null || updates.propertyId === undefined || updates.propertyId === '';
                const subLandlordIdRemoved = (updates as any).rentOutSubLandlordId === null || 
                                            (updates as any).rentOutSubLandlordId === '' || 
                                            (updates as any).rentOutSubLandlordId === undefined;
                
                if (propertyIdRemoved || subLandlordIdRemoved) {
                    // 获取物业编号
                    const property = await fetchProperty(originalRent.propertyId);
                    if (property?.code) {
                        // 从二房东的tenancyNumber中移除该物业编号
                        await removePropertyFromSubLandlordTenancyNumber(
                            (originalRent as any).rentOutSubLandlordId,
                            property.code
                        );
                    }
                }
            }
            
            return true;
        } catch (err) {
            setError('Failed to update rent in cloud');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteRent = useCallback(async (id: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            // 删除前获取租金记录信息，以便更新二房东的tenancyNumber
            const allRents = await fetchRents();
            const rentToDelete = allRents.find(r => r.id === id);
            
            const { error: sbError } = await supabase
                .from('rents')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (sbError) throw sbError;
            
            // 如果删除的租金记录关联了二房东和物业，需要从二房东的tenancyNumber中移除该物业编号
            if (rentToDelete && rentToDelete.propertyId && (rentToDelete as any).rentOutSubLandlordId) {
                const property = await fetchProperty(rentToDelete.propertyId);
                if (property?.code) {
                    await removePropertyFromSubLandlordTenancyNumber(
                        (rentToDelete as any).rentOutSubLandlordId,
                        property.code
                    );
                }
            }
            
            return true;
        } catch (err) {
            setError('Failed to soft delete rent from cloud');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const getRentsWithRelations = useCallback(async (type?: 'renting' | 'rent_out' | 'contract'): Promise<any[]> => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchRentsWithRelations({ type });
            return data;
        } catch (err) {
            console.error(err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        getRents,
        getRentsByType,
        getRentsWithRelations,
        addRent,
        updateRent,
        deleteRent
    };
}

// ==================== RELATION HELPERS ====================

export interface PropertyWithRelations extends Property {
    proprietor?: Proprietor;
    tenant?: Proprietor;
    rents: Rent[];
}

export function useRelations() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getPropertiesWithRelations = useCallback(async (): Promise<PropertyWithRelations[]> => {
        setLoading(true);
        setError(null);
        const data = await fetchPropertiesWithRelations();
        setLoading(false);
        return data;
    }, []);

    const getPropertyWithRelations = useCallback(async (propertyId: string): Promise<PropertyWithRelations | null> => {
        setLoading(true);
        setError(null);
        try {
            const queryFields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, proprietor_ids, tenant_id, created_by, created_at, updated_at, images, geo_maps, notes';

            const { data: records, error: pError } = await supabase
                .from('properties')
                .select(queryFields)
                .eq('id', propertyId)
                .eq('is_deleted', false)
                .limit(1);
            const property = (records && records.length > 0) ? records[0] : null;

            if (pError || !property) return null;

            const camelProperty = mapPropertyRow(property);

            const [
                { data: proprietor },
                { data: tenant },
                { data: rentsData }
            ] = await Promise.all([
                camelProperty.proprietorId ? supabase.from('proprietors').select('*').eq('id', camelProperty.proprietorId).single() : { data: null },
                camelProperty.tenantId ? supabase.from('proprietors').select('*').eq('id', camelProperty.tenantId).single() : { data: null },
                supabase
                    .from('rents')
                    .select('*, proprietor:proprietors!proprietor_id(*), tenant:proprietors!tenant_id(*)')
                    .eq('property_id', propertyId)
                    .eq('is_deleted', false)
            ]);

            return {
                ...camelProperty,
                proprietor: proprietor ? toCamel(proprietor) : undefined,
                tenant: tenant ? toCamel(tenant) : undefined,
                rents: (rentsData || []).map(r => toCamel(r)) as Rent[]
            } as PropertyWithRelations;
        } catch (err) {
            console.error('Failed to fetch property with relations:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getPropertyWithRelationsByName = useCallback(async (name: string): Promise<PropertyWithRelations | null> => {
        setLoading(true);
        setError(null);
        try {
            const trimmedName = name.trim();
            if (!trimmedName) return null;

            const queryFields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, created_by, created_at, updated_at, images, geo_maps, notes';

            const { data: records, error: pError } = await supabase
                .from('properties')
                .select(queryFields)
                .eq('name', trimmedName)
                .eq('is_deleted', false)
                .limit(1);
            const property = (records && records.length > 0) ? records[0] : null;

            if (pError || !property) return null;

            const camelProperty = mapPropertyRow(property);

            const [
                { data: proprietor },
                { data: tenant },
                { data: rentsData }
            ] = await Promise.all([
                camelProperty.proprietorId ? supabase.from('proprietors').select('*').eq('id', camelProperty.proprietorId).single() : { data: null },
                camelProperty.tenantId ? supabase.from('proprietors').select('*').eq('id', camelProperty.tenantId).single() : { data: null },
                supabase
                    .from('rents')
                    .select('*, proprietor:proprietors!proprietor_id(*), tenant:proprietors!tenant_id(*)')
                    .eq('property_id', property.id)
                    .eq('is_deleted', false)
            ]);

            return {
                ...camelProperty,
                proprietor: proprietor ? toCamel(proprietor) : undefined,
                tenant: tenant ? toCamel(tenant) : undefined,
                rents: (rentsData || []).map(r => toCamel(r)) as Rent[]
            } as PropertyWithRelations;
        } catch (err) {
            console.error('Failed to fetch property with relations by name:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        getPropertiesWithRelations,
        getPropertyWithRelations,
        getPropertyWithRelationsByName
    };
}

// ==================== DATABASE GLOBAL HOOKS ====================

export function useDatabase() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearDatabase = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.allSettled([
                supabase.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('proprietors').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            ]);
            await db.properties.clear();
            await db.proprietors.clear();
            await db.rents.clear();
            return true;
        } catch (err) {
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const seedData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const proprietorId = generateId();
            const propertyId = generateId();

            await supabase.from('proprietors').insert([{ id: proprietorId, name: 'Antigravity Group / 萬有引力集團' }]);
            await supabase.from('properties').insert([{
                id: propertyId,
                name: 'Main Office / 總部辦公室',
                code: 'P001',
                address: '12Tech Road, HK',
                type: 'Group Asset',
                status: 'Holding',
                proprietor_id: proprietorId
            }]);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const syncLocalToCloud = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [localProps, localProprietors, localRents] = await Promise.all([
                db.properties.toArray(),
                db.proprietors.toArray(),
                db.rents.toArray()
            ]);

            if (localProps.length === 0 && localProprietors.length === 0 && localRents.length === 0) {
                return { success: true, message: 'No local data to sync / 沒有本地資料需要同步' };
            }

            // 1. Sync Proprietors (Complete)
            if (localProprietors.length > 0) {
                const mapped = localProprietors.map(p => ({
                    id: p.id,
                    name: p.name,
                    code: p.code || '',
                    type: p.type || 'company',
                    category: p.category || 'group_company',
                    english_name: p.englishName || '',
                    short_name: p.shortName || '',
                    ...(p.brNumber !== undefined && p.brNumber !== '' ? { br_number: p.brNumber } : {}),
                }));
                const { error: prError } = await supabase.from('proprietors').upsert(mapped);
                if (prError) throw new Error(`業主同步失敗: ${prError.message}`);
            }

            // 2. Sync Properties (Complete)
            if (localProps.length > 0) {
                const mapped = localProps.map(p => ({
                    id: p.id,
                    name: p.name,
                    proprietor_id: p.proprietorId || null,
                    tenant_id: p.tenantId || null,
                    type: p.type || 'group_asset',
                    status: p.status || 'holding',
                    address: p.address || '',
                    code: p.code || '',
                    lot_index: p.lotIndex || '',
                    lot_area: p.lotArea || '',
                    land_use: p.landUse || 'unknown',
                    images: p.images || [],
                    geo_maps: p.geoMaps || [],
                    location: p.location || null,
                    google_drive_plan_url: p.googleDrivePlanUrl || '',
                    has_planning_permission: p.hasPlanningPermission || false
                }));

                const { error: pError } = await supabase.from('properties').upsert(mapped);
                if (pError) throw new Error(`物業同步失敗: ${pError.message}`);
            }

            // 3. Sync Rents (Complete)
            if (localRents.length > 0) {
                // Try 'rents' table first
                const mappedRents = localRents.map(r => ({
                    id: r.id,
                    property_id: r.propertyId,
                    proprietor_id: r.proprietorId || null,
                    tenant_id: r.tenantId || null,
                    type: r.type,
                    location: r.location || '',
                    amount: r.amount,
                    currency: r.currency || 'HKD',
                    start_date: r.startDate ? new Date(r.startDate).toISOString() : null,
                    end_date: r.endDate ? new Date(r.endDate).toISOString() : null,
                    status: r.status || 'active',
                    notes: r.notes || ''
                }));
                const { error: rError } = await supabase.from('rents').upsert(mappedRents);

                if (rError) {
                    console.warn('Rents table failed, trying transactions fallback:', rError.message);
                    const mappedTrans = localRents.map(r => ({
                        id: r.id,
                        property_id: r.propertyId,
                        amount: r.amount,
                        type: r.type === 'rent_out' ? 'income' : 'expense',
                        description: r.notes || ''
                    }));
                    const { error: tError } = await supabase.from('transactions').upsert(mappedTrans);
                    if (tError) throw new Error(`租金記錄同步失敗: ${tError.message}`);
                }
            }

            return {
                success: true,
                message: `✅ 同步成功！\n- 物業: ${localProps.length} 個\n- 業主: ${localProprietors.length} 個\n- 記錄: ${localRents.length} 條`
            };
        } catch (err) {
            setError('Data sync failed');
            console.error(err);
            return { success: false, message: '❌ 同步失敗: ' + (err as Error).message };
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        clearDatabase,
        seedData,
        syncLocalToCloud
    };
}

// ==================== TRASH HOOKS ====================

export function useTrash() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTrash = useCallback(async (table: 'properties' | 'proprietors' | 'rents') => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from(table)
                .select('*')
                .eq('is_deleted', true)
                .order('deleted_at', { ascending: false });

            if (sbError) throw sbError;
            return (data || []).map(toCamel);
        } catch (err: any) {
            console.error(`Supabase error fetching trash for ${table}:`, err);
            const detailedError = err?.message || err?.details || JSON.stringify(err);
            setError(`Failed to fetch trash for ${table}: ${detailedError}`);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const restoreItem = useCallback(async (table: 'properties' | 'proprietors' | 'rents', id: string) => {
        setLoading(true);
        setError(null);
        try {
            const { error: sbError } = await supabase
                .from(table)
                .update({ is_deleted: false, deleted_at: null })
                .eq('id', id);

            if (sbError) {
                console.error(`Failed to restore item ${id} from ${table}:`, sbError);
                setError(`還原失敗: ${sbError.message || JSON.stringify(sbError)}`);
                return false;
            }
            return true;
        } catch (err: any) {
            console.error(`Exception restoring item ${id} from ${table}:`, err);
            setError(`還原失敗: ${err?.message || JSON.stringify(err)}`);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const permanentlyDeleteItem = useCallback(async (table: 'properties' | 'proprietors' | 'rents', id: string) => {
        setLoading(true);
        setError(null);
        try {
            // Step 1: Clear FK references before deleting
            if (table === 'proprietors') {
                await supabase.from('rents').update({ proprietor_id: null }).eq('proprietor_id', id);
                await supabase.from('rents').update({ tenant_id: null }).eq('tenant_id', id);
            }
            if (table === 'properties') {
                await supabase.from('rents').update({ property_id: null }).eq('property_id', id);
            }

            // Step 2: Delete the record
            const { error: sbError } = await supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (sbError) {
                console.error(`Failed to permanently delete item ${id} from ${table}:`, sbError);
                setError(`永久刪除失敗: ${sbError.message || JSON.stringify(sbError)}`);
                return false;
            }
            return true;
        } catch (err: any) {
            console.error(`Exception permanently deleting item ${id} from ${table}:`, err);
            setError(`永久刪除失敗: ${err?.message || JSON.stringify(err)}`);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const emptyTrash = useCallback(async (table: 'properties' | 'proprietors' | 'rents') => {
        setLoading(true);
        setError(null);
        try {
            // Step 1: For proprietors, clear ALL FK references in rents before deleting
            if (table === 'proprietors') {
                const { data: deletedProprietors } = await supabase
                    .from('proprietors')
                    .select('id')
                    .eq('is_deleted', true);

                if (deletedProprietors && deletedProprietors.length > 0) {
                    const ids = deletedProprietors.map((p: any) => p.id);
                    // Clear proprietor_id FK
                    await supabase.from('rents').update({ proprietor_id: null }).in('proprietor_id', ids);
                    // Clear tenant_id FK (tenant also references proprietors)
                    await supabase.from('rents').update({ tenant_id: null }).in('tenant_id', ids);
                }
            }

            // Step 2: For properties, clear FK references in rents before deleting
            if (table === 'properties') {
                const { data: deletedProperties } = await supabase
                    .from('properties')
                    .select('id')
                    .eq('is_deleted', true);

                if (deletedProperties && deletedProperties.length > 0) {
                    const { error: clearErr } = await supabase
                        .from('rents')
                        .update({ property_id: null })
                        .in('property_id', deletedProperties.map((p: any) => p.id));
                    if (clearErr) {
                        console.error('Failed to clear property FK in rents:', clearErr);
                    }
                }
            }

            // Step 3: Delete the soft-deleted records
            const { error: sbError } = await supabase
                .from(table)
                .delete()
                .eq('is_deleted', true);

            if (sbError) {
                console.error(`Failed to empty trash for ${table}:`, sbError);
                setError(`清空垃圾桶失敗: ${sbError.message || JSON.stringify(sbError)}`);
                return false;
            }
            return true;
        } catch (err: any) {
            console.error(`Exception emptying trash for ${table}:`, err);
            setError(`清空垃圾桶失敗: ${err?.message || JSON.stringify(err)}`);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        fetchTrash,
        restoreItem,
        permanentlyDeleteItem,
        emptyTrash
    };
}

export function useRentsQuery() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['rents', user?.id],
        queryFn: () => fetchRents(user),
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

export function useRentsWithRelationsQuery(options?: {
    type?: 'renting' | 'rent_out' | 'contract';
    /** 設為 false 時不發請求（例如總覽暫時隱藏租務區塊） */
    enabled?: boolean;
}) {
    const { user } = useAuth();
    const { enabled: enabledOpt, ...fetchOpts } = options ?? {};
    return useQuery({
        queryKey: ['rents-with-relations', user?.id, fetchOpts?.type],
        queryFn: () => fetchRentsWithRelations(user, fetchOpts),
        staleTime: 2 * 60 * 1000,
        enabled: enabledOpt !== false,
    });
}

export function useDashboardStatsQuery() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['dashboard-stats', user?.id],
        queryFn: () => fetchDashboardStats(user),
        staleTime: 30 * 1000, // 30 seconds
    });
}

export function usePropertiesWithRelationsQuery() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['properties-with-relations', user?.id],
        queryFn: () => fetchPropertiesWithRelations(user),
        staleTime: 5 * 60 * 1000,
    });
}

export function usePropertyWithRelationsQuery(id: string) {
    const { user } = useAuth();
    const { getPropertyWithRelations } = useRelations();
    return useQuery({
        queryKey: ['property-with-relations', id, user?.id],
        queryFn: () => getPropertyWithRelations(id),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function usePropertyWithRelationsByNameQuery(name: string) {
    const { user } = useAuth();
    const { getPropertyWithRelationsByName } = useRelations();
    return useQuery({
        queryKey: ['property-with-relations-by-name', name, user?.id],
        queryFn: () => getPropertyWithRelationsByName(name),
        enabled: !!name,
        staleTime: 5 * 60 * 1000,
    });
}

export function useUsersQuery() {
    const { getUsers } = useAuth();
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const { success, users } = await getUsers();
            if (!success) throw new Error('Failed to fetch users');
            return users || [];
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}
