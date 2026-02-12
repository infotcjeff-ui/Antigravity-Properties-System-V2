'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db, generateId, type Property, type Proprietor, type Rent } from '@/lib/db';
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

export const fetchProperties = async (user?: any, options?: { query?: string }): Promise<Property[]> => {
    try {
        // Select all fields needed for both list and edit views
        const fields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, created_by, created_at, updated_at, images, geo_maps, notes';
        let queryBuilder = supabase.from('properties').select(fields);

        if (options?.query) {
            const q = options.query;
            queryBuilder = queryBuilder.or(`name.ilike.%${q}%,code.ilike.%${q}%,address.ilike.%${q}%`);
        }

        const { data, error: sbError } = await queryBuilder
            .order('name', { ascending: true });

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

        // All users can see all proprietors

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

        // All users can see all rents

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

export const fetchRentsWithRelations = async (options?: { type?: 'renting' | 'rent_out' }): Promise<any[]> => {
    try {
        // EXCLUDE heavy fields from property join
        const propFields = 'id, name, code, address, type, status, land_use, lot_index, lot_area, location, google_drive_plan_url, has_planning_permission, proprietor_id, tenant_id, created_by, created_at, updated_at, images';
        let query = supabase.from('rents').select(`*, property:properties(${propFields}), proprietor:proprietors!proprietor_id(*), tenant:proprietors!tenant_id(*)`);

        if (options?.type) {
            query = query.eq('type', options.type);
        }

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

        const [
            { data: properties },
            { data: proprietors },
            { data: rentsData }
        ] = await Promise.all([
            pQuery,
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
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('created_by', userId),
            supabase.from('proprietors').select('*', { count: 'exact', head: true }).eq('created_by', userId),
            supabase.from('rents').select('*', { count: 'exact', head: true }).eq('created_by', userId)
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

export const fetchDashboardStats = async () => {
    try {
        // Fetch counts in parallel
        const [
            { count: totalProperties },
            { count: totalProprietors },
            { count: totalRents },
            { data: rentsData }
        ] = await Promise.all([
            supabase.from('properties').select('*', { count: 'exact', head: true }),
            supabase.from('proprietors').select('*', { count: 'exact', head: true }),
            supabase.from('rents').select('*', { count: 'exact', head: true }),
            supabase.from('rents').select('type, status, renting_end_date, rent_out_end_date, rent_out_status, renting_monthly_rental, rent_out_monthly_rental, amount, renting_periods, rent_out_periods')
        ]);

        // Get property status breakdown
        const [
            { count: holdingCount },
            { count: rentingCount },
            { count: soldCount },
            { count: suspendedCount }
        ] = await Promise.all([
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'holding'),
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'renting'),
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'suspended')
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
                'proprietor_id', 'tenant_id'
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
                .delete()
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            setError('Failed to delete property from cloud');
            console.error(err);
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
        deleteProperty,
        searchProperties
    };
}

export function usePropertiesQuery() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['properties', user?.id],
        queryFn: () => fetchProperties(user),
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
                .delete()
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            setError('Failed to delete proprietor from cloud');
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
            if (rent.rentOutDepositReceiveDate) rentData.rent_out_deposit_receive_date = rent.rentOutDepositReceiveDate;
            if (rent.rentOutDepositReturnDate) rentData.rent_out_deposit_return_date = rent.rentOutDepositReturnDate;
            if (rent.rentOutDepositReturnAmount) rentData.rent_out_deposit_return_amount = rent.rentOutDepositReturnAmount;
            if (rent.rentOutLessor) rentData.rent_out_lessor = rent.rentOutLessor;
            if (rent.rentOutAddressDetail) rentData.rent_out_address_detail = rent.rentOutAddressDetail;
            if (rent.rentOutStatus) rentData.rent_out_status = rent.rentOutStatus;
            if (rent.rentOutDescription) rentData.rent_out_description = rent.rentOutDescription;

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
            if (updates.propertyId) rentData.property_id = updates.propertyId;
            if (updates.proprietorId !== undefined) rentData.proprietor_id = updates.proprietorId;
            if (updates.tenantId !== undefined) rentData.tenant_id = updates.tenantId;
            if (updates.type) rentData.type = updates.type;
            if (updates.status) rentData.status = updates.status;
            if (updates.currency) rentData.currency = updates.currency;
            if (updates.location) rentData.location = updates.location;
            if (updates.notes) rentData.notes = updates.notes;

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
            if (updates.rentOutDepositReceiveDate) rentData.rent_out_deposit_receive_date = updates.rentOutDepositReceiveDate;
            if (updates.rentOutDepositReturnDate) rentData.rent_out_deposit_return_date = updates.rentOutDepositReturnDate;
            if (updates.rentOutDepositReturnAmount !== undefined) rentData.rent_out_deposit_return_amount = updates.rentOutDepositReturnAmount;
            if (updates.rentOutLessor) rentData.rent_out_lessor = updates.rentOutLessor;
            if (updates.rentOutAddressDetail) rentData.rent_out_address_detail = updates.rentOutAddressDetail;
            if (updates.rentOutStatus) rentData.rent_out_status = updates.rentOutStatus;
            if (updates.rentOutDescription) rentData.rent_out_description = updates.rentOutDescription;

            // RENTING fields
            if (updates.rentingNumber) rentData.renting_number = updates.rentingNumber;
            if (updates.rentingReferenceNumber) rentData.renting_reference_number = updates.rentingReferenceNumber;
            if (updates.rentingMonthlyRental !== undefined) rentData.renting_monthly_rental = updates.rentingMonthlyRental;
            if (updates.rentingPeriods !== undefined) rentData.renting_periods = updates.rentingPeriods;
            if (updates.rentingStartDate) rentData.renting_start_date = updates.rentingStartDate;
            if (updates.rentingEndDate) rentData.renting_end_date = updates.rentingEndDate;
            if (updates.rentingDeposit !== undefined) rentData.renting_deposit = updates.rentingDeposit;

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
                .delete()
                .eq('id', id);

            if (sbError) throw sbError;
            return true;
        } catch (err) {
            setError('Failed to delete rent from cloud');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const getRentsWithRelations = useCallback(async (type?: 'renting' | 'rent_out'): Promise<any[]> => {
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
            const { data: property, error: pError } = await supabase
                .from('properties')
                .select('*')
                .eq('id', propertyId)
                .single();

            if (pError || !property) return null;

            const camelProperty = toCamel(property) as Property;

            const [
                { data: proprietor },
                { data: tenant },
                { data: rentsData }
            ] = await Promise.all([
                camelProperty.proprietorId ? supabase.from('proprietors').select('*').eq('id', camelProperty.proprietorId).single() : { data: null },
                camelProperty.tenantId ? supabase.from('proprietors').select('*').eq('id', camelProperty.tenantId).single() : { data: null },
                supabase.from('rents').select('*').eq('property_id', propertyId)
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

    return {
        loading,
        error,
        getPropertiesWithRelations,
        getPropertyWithRelations
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
export function useRentsQuery() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['rents', user?.id],
        queryFn: () => fetchRents(user),
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

export function useRentsWithRelationsQuery(options?: { type?: 'renting' | 'rent_out' }) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['rents-with-relations', user?.id, options?.type],
        queryFn: () => fetchRentsWithRelations(options),
        staleTime: 2 * 60 * 1000,
    });
}

export function useDashboardStatsQuery() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['dashboard-stats', user?.id],
        queryFn: fetchDashboardStats,
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
    const { getPropertyWithRelations } = useRelations();
    return useQuery({
        queryKey: ['property-with-relations', id],
        queryFn: () => getPropertyWithRelations(id),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}
