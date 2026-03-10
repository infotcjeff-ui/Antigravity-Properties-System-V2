'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Auth types
export type UserRole = 'admin' | 'user';

export interface User {
    id: string;
    username: string;
    displayName?: string;
    role: UserRole;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    registerUser: (username: string, password: string, role: UserRole, displayName?: string) => Promise<{ success: boolean; error?: string }>;
    getUsers: () => Promise<{ success: boolean; users?: User[]; error?: string }>;
    updateUser: (userId: string, updates: { password?: string; role?: UserRole; displayName?: string }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { supabase } from '@/lib/supabase';

const AUTH_STORAGE_KEY = 'pms_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    // Check for existing auth on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
                if (storedAuth) {
                    const parsed = JSON.parse(storedAuth);
                    if (parsed.isAuthenticated && parsed.user) {
                        setUser(parsed.user);
                    }
                }
            } catch (error) {
                console.error('Error checking auth:', error);
                localStorage.removeItem(AUTH_STORAGE_KEY);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    const login = useCallback(async (
        username: string,
        password: string,
        rememberMe: boolean = false
    ): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) {
                return { success: false, error: '用戶不存在' };
            }

            if (data.password !== password) {
                return { success: false, error: '密碼錯誤' };
            }

            const userData: User = {
                id: data.id,
                username: data.username,
                displayName: data.display_name,
                role: data.role as UserRole,
            };

            setUser(userData);

            // Store in localStorage
            const authData = {
                isAuthenticated: true,
                user: userData,
                rememberMe,
            };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));

            return { success: true };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, error: '登入失敗' };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const registerUser = useCallback(async (
        username: string,
        password: string,
        role: UserRole = 'user',
        displayName?: string
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .insert([{ username, password, role, display_name: displayName || username }])
                .select()
                .single();

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('Register error:', err);
            return { success: false, error: err.message || '創建用戶失敗' };
        }
    }, []);

    const getUsers = useCallback(async (): Promise<{ success: boolean; users?: User[]; error?: string }> => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('id, username, role, display_name')
                .order('username', { ascending: true });

            if (error) throw error;
            const users = (data || []).map(u => ({
                id: u.id,
                username: u.username,
                role: u.role as UserRole,
                displayName: u.display_name
            }));
            return { success: true, users };
        } catch (err: any) {
            console.error('Fetch users error:', err);
            return { success: false, error: err.message || '獲取用戶失敗' };
        }
    }, []);

    const updateUser = useCallback(async (
        userId: string,
        updates: { password?: string; role?: UserRole; displayName?: string }
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const dbUpdates: any = { ...updates };
            if (updates.displayName) {
                dbUpdates.display_name = updates.displayName;
                delete dbUpdates.displayName;
            }

            const { error } = await supabase
                .from('app_users')
                .update(dbUpdates)
                .eq('id', userId);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('Update user error:', err);
            return { success: false, error: err.message || '更新用戶失敗' };
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        router.push('/login');
    }, [router]);

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        registerUser,
        getUsers,
        updateUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
