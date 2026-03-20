'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db, generateId, type Property, type Proprietor, type Rent, type SubLandlord, type CurrentTenant } from '@/lib/db';
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

// ==================== PROPERTY HOOKS ====================

// ==================== FETCHERS ====================

export const fetchProperties = async (user?: any, options?: { query?: string; bypassIsolation?: boolean }): Promise<Property[]> => {
    try {
        // Select all fields needed for both list and edit views
        const fields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, parent_property_id, created_by, created_at, updated_at, images, geo_maps, notes';
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
        return (data || []).map(toCamel) as Property[];
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
        return toCamel(data) as Property;
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
            console.error('Supabase query error:', error);
            throw error;
        }

        return (data || []).map(r => ({
            ...toCamel(r),
            property: toCamel(r.property),
            proprietor: toCamel(r.proprietor),
            tenant: toCamel(r.tenant)
        }));
    } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error('Network Error: Unable to reach Supabase. Check your URL and internet connection.');
        } else {
            console.error('Failed to fetch rents with relations:', err);
        }
        return [];
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
        const fields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, created_by, created_at, updated_at, images';
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
            const camelProperty = toCamel(property) as Property;
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

export const fetchDashboardStats = async (user?: any) => {
    try {
        // Base queries
        let propertiesQuery = supabase.from('properties').select('*', { count: 'exact', head: true });
        let proprietorsQuery = supabase.from('proprietors').select('*', { count: 'exact', head: true });
        let rentsQuery = supabase.from('rents').select('*', { count: 'exact', head: true });
        let rentsDataQuery = supabase.from('rents').select('type, status, renting_end_date, rent_out_end_date, rent_out_status, renting_monthly_rental, rent_out_monthly_rental, amount, renting_periods, rent_out_periods');

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

        const rentingLeases = rents.filter(r => {
            if (r.type !== 'rent_out') return false;
            if (r.status !== 'active' && r.rentOutStatus !== 'renting') return false;
            const endDate = r.rentOutEndDate || r.endDate;
            return !endDate || new Date(endDate) >= now;
        }).length;

        const expiredLeases = rents.filter(r => {
            if (r.type !== 'rent_out') return false;
            const endDate = r.rentOutEndDate || r.endDate;
            return endDate && new Date(endDate) < now;
        }).length;

        const totalIncome = rents
            .filter(r => r.type === 'rent_out')
            .reduce((sum, r) => sum + ((r.rentOutMonthlyRental || r.amount || 0) * (r.rentOutPeriods || 1)), 0);

        const totalExpenses = rents
            .filter(r => r.type === 'renting')
            .reduce((sum, r) => sum + ((r.rentingMonthlyRental || r.amount || 0) * (r.rentingPeriods || 1)), 0);

        return {
            totalProperties: totalProperties || 0,
            totalProprietors: totalProprietors || 0,
            totalRents: totalRents || 0,
            rentingLeases,
            expiredLeases,
            totalIncome,
            totalExpenses,
            netProfit: totalIncome - totalExpenses,
            statusBreakdown: {
                holding: holdingCount || 0,
                renting: rentingCount || 0,
                sold: soldCount || 0,
                suspended: suspendedCount || 0
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
            rentingLeases: 0,
            expiredLeases: 0,
            totalIncome: 0,
            totalExpenses: 0,
            netProfit: 0,
            statusBreakdown: {
                holding: 0,
                renting: 0,
                sold: 0,
                suspended: 0
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
            // Full set of allowed fields for safety
            const allowed = [
                'name', 'type', 'status', 'address', 'code',
                'lot_index', 'lot_area', 'land_use',
                'images', 'geo_maps', 'location',
                'google_drive_plan_url', 'has_planning_permission', 'notes',
                'proprietor_id', 'tenant_id', 'parent_property_id', 'created_by'
            ];
            const filtered: any = {};
            Object.keys(updateData).forEach(k => { if (allowed.includes(k)) filtered[k] = updateData[k]; });

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
            return (data || []).map(toCamel) as Property[];
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

            // Only add description if provided (column may not exist in database)
            if ((proprietor as any).description) {
                data.description = (proprietor as any).description;
            }

            const { error: sbError } = await supabase
                .from('proprietors')
                .insert([data]);

            if (sbError) throw sbError;
            return id;
        } catch (err: any) {
            // If error is about missing column, retry without description
            if (err.message?.includes('description')) {
                try {
                    const id = generateId();
                    const fallbackData = {
                        id,
                        name: proprietor.name,
                        code: proprietor.code,
                        type: proprietor.type,
                        category: proprietor.category,
                        english_name: proprietor.englishName,
                        short_name: proprietor.shortName,
                        created_by: user?.id,
                    };
                    const { error: retryError } = await supabase
                        .from('proprietors')
                        .insert([fallbackData]);
                    if (!retryError) return id;
                } catch (retryErr) {
                    console.error('Retry failed:', retryErr);
                }
            }
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
            const updateData = {
                name: updates.name,
                code: updates.code,
                type: updates.type,
                category: updates.category,
                english_name: updates.englishName,
                short_name: updates.shortName
            };
            // Remove undefined
            Object.keys(updateData).forEach(key => (updateData as any)[key] === undefined && delete (updateData as any)[key]);

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
            if (rent.rentOutDepositReceived) rentData.rent_out_deposit_received = rent.rentOutDepositReceived;
            if ((rent as any).rentOutDepositReceiptNumber) rentData.rent_out_deposit_receipt_number = (rent as any).rentOutDepositReceiptNumber;
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

            const { error: sbError } = await supabase
                .from('rents')
                .insert([cleanRentData]);

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

    const updateRent = useCallback(async (id: string, updates: Partial<Rent>): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
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

            // RENT OUT fields
            if (updates.rentOutTenancyNumber) rentData.rent_out_tenancy_number = updates.rentOutTenancyNumber;
            if (updates.rentOutPricing !== undefined) rentData.rent_out_pricing = updates.rentOutPricing;
            if (updates.rentOutMonthlyRental !== undefined) rentData.rent_out_monthly_rental = updates.rentOutMonthlyRental;
            if (updates.rentOutPeriods !== undefined) rentData.rent_out_periods = updates.rentOutPeriods;
            if (updates.rentOutTotalAmount !== undefined) rentData.rent_out_total_amount = updates.rentOutTotalAmount;
            if (updates.rentOutStartDate) rentData.rent_out_start_date = updates.rentOutStartDate;
            if (updates.rentOutEndDate) rentData.rent_out_end_date = updates.rentOutEndDate;
            if (updates.rentOutActualEndDate) rentData.rent_out_actual_end_date = updates.rentOutActualEndDate;
            if (updates.rentOutDepositReceived !== undefined) rentData.rent_out_deposit_received = updates.rentOutDepositReceived;
            if ((updates as any).rentOutDepositReceiptNumber !== undefined) rentData.rent_out_deposit_receipt_number = (updates as any).rentOutDepositReceiptNumber;
            if (updates.rentOutDepositReceiveDate) rentData.rent_out_deposit_receive_date = updates.rentOutDepositReceiveDate;
            if (updates.rentOutDepositReturnDate) rentData.rent_out_deposit_return_date = updates.rentOutDepositReturnDate;
            if (updates.rentOutDepositReturnAmount !== undefined) rentData.rent_out_deposit_return_amount = updates.rentOutDepositReturnAmount;
            if (updates.rentOutLessor) rentData.rent_out_lessor = updates.rentOutLessor;
            if (updates.rentOutAddressDetail) rentData.rent_out_address_detail = updates.rentOutAddressDetail;
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

            const { error: sbError } = await supabase
                .from('rents')
                .update(rentData)
                .eq('id', id);

            if (sbError) throw sbError;
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
            const { error: sbError } = await supabase
                .from('rents')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (sbError) throw sbError;
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
            const queryFields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, created_by, created_at, updated_at, images, geo_maps, notes';

            const { data: records, error: pError } = await supabase
                .from('properties')
                .select(queryFields)
                .eq('id', propertyId)
                .eq('is_deleted', false)
                .limit(1);
            const property = (records && records.length > 0) ? records[0] : null;

            if (pError || !property) return null;

            const camelProperty = toCamel(property) as Property;

            const [
                { data: proprietor },
                { data: tenant },
                { data: rentsData }
            ] = await Promise.all([
                camelProperty.proprietorId ? supabase.from('proprietors').select('*').eq('id', camelProperty.proprietorId).single() : { data: null },
                camelProperty.tenantId ? supabase.from('proprietors').select('*').eq('id', camelProperty.tenantId).single() : { data: null },
                supabase.from('rents').select('*, proprietor:proprietors!proprietor_id(*), tenant:proprietors!tenant_id(*)').eq('property_id', propertyId)
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
            const queryFields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, created_by, created_at, updated_at, images, geo_maps, notes';

            const { data: records, error: pError } = await supabase
                .from('properties')
                .select(queryFields)
                .eq('name', name)
                .eq('is_deleted', false)
                .limit(1);
            const property = (records && records.length > 0) ? records[0] : null;

            if (pError || !property) return null;

            const camelProperty = toCamel(property) as Property;

            const [
                { data: proprietor },
                { data: tenant },
                { data: rentsData }
            ] = await Promise.all([
                camelProperty.proprietorId ? supabase.from('proprietors').select('*').eq('id', camelProperty.proprietorId).single() : { data: null },
                camelProperty.tenantId ? supabase.from('proprietors').select('*').eq('id', camelProperty.tenantId).single() : { data: null },
                supabase.from('rents').select('*, proprietor:proprietors!proprietor_id(*), tenant:proprietors!tenant_id(*)').eq('property_id', property.id)
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
                    short_name: p.shortName || ''
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

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            console.error(`Failed to restore item ${id} from ${table}:`, err);
            setError(`Failed to restore item`);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const permanentlyDeleteItem = useCallback(async (table: 'properties' | 'proprietors' | 'rents', id: string) => {
        setLoading(true);
        setError(null);
        try {
            const { error: sbError } = await supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            console.error(`Failed to permanently delete item ${id} from ${table}:`, err);
            setError(`Failed to permanently delete item`);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const emptyTrash = useCallback(async (table: 'properties' | 'proprietors' | 'rents') => {
        setLoading(true);
        setError(null);
        try {
            const { error: sbError } = await supabase
                .from(table)
                .delete()
                .eq('is_deleted', true);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            console.error(`Failed to empty trash for ${table}:`, err);
            setError(`Failed to empty trash`);
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

export function useRentsWithRelationsQuery(options?: { type?: 'renting' | 'rent_out' | 'contract' }) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['rents-with-relations', user?.id, options?.type],
        queryFn: () => fetchRentsWithRelations(user, options),
        staleTime: 2 * 60 * 1000,
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
