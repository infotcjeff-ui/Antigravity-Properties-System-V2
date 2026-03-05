'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    UserPlus,
    LayoutList,
    ChevronRight,
    ChevronDown,
    RefreshCw,
    Eye,
    EyeOff,
    Check,
    Search
} from 'lucide-react';
import { useAuth, type User, type UserRole } from '@/contexts/AuthContext';
import { fetchUserStats } from '@/hooks/useStorage';
import { supabase } from '@/lib/supabase';
import type { Property, Proprietor, Rent } from '@/lib/db';
import Link from 'next/link';

const propertyStatusColors: Record<string, string> = {
    holding: 'bg-emerald-600 dark:bg-emerald-500/80 text-white',
    renting: 'bg-blue-500/20 text-blue-400',
    sold: 'bg-gray-500/20 text-gray-400',
    suspended: 'bg-red-500/20 text-red-400',
};

const propertyStatusLabels: Record<string, string> = {
    holding: '持有中',
    renting: '出租中',
    sold: '已售出',
    suspended: '已暫停',
};

export default function UsersPage() {
    const { user, registerUser, getUsers, updateUser } = useAuth();

    // UI State
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [language, setLanguage] = useState<'zh-TW' | 'en'>('zh-TW');

    // Register User State
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
    const [showPassword, setShowPassword] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    // User list and data state
    const [systemUsers, setSystemUsers] = useState<User[]>([]);
    const [userDataStats, setUserDataStats] = useState<Record<string, { propertyCount: number, proprietorCount: number, rentCount: number }>>({});
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [expandedUserTab, setExpandedUserTab] = useState<{ userId: string, tab: 'properties' | 'proprietors' | 'rents' } | null>(null);
    const [expandedTabData, setExpandedTabData] = useState<any[]>([]);
    const [isLoadingTabData, setIsLoadingTabData] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const activeTabRef = useRef<{ userId: string, tab: string } | null>(null);

    const loadUserData = async (userId: string, tab: 'properties' | 'proprietors' | 'rents') => {
        activeTabRef.current = { userId, tab };
        setIsLoadingTabData(true);
        setExpandedTabData([]);
        try {
            const { data, error } = await supabase.from(tab).select('*').eq('created_by', userId).order('created_at', { ascending: false });

            // Prevent race condition: only update state if this response matches the currently active tab
            if (activeTabRef.current?.userId === userId && activeTabRef.current?.tab === tab) {
                if (data) {
                    setExpandedTabData(data);
                }
                setIsLoadingTabData(false);
            }
        } catch (err) {
            console.error('Failed to load tab data:', err);
            if (activeTabRef.current?.userId === userId && activeTabRef.current?.tab === tab) {
                setIsLoadingTabData(false);
            }
        }
    };

    const handleTabClick = (e: React.MouseEvent, u: User, tab: 'properties' | 'proprietors' | 'rents') => {
        e.stopPropagation();
        if (expandedUserTab?.userId === u.id && expandedUserTab?.tab === tab) {
            setExpandedUserTab(null);
            setExpandedUser(null);
        } else {
            setExpandedUserTab({ userId: u.id, tab });
            setExpandedUser(u.id);
            loadUserData(u.id, tab);
        }
    };

    const handleRowClick = (u: User) => {
        if (expandedUser === u.id) {
            setExpandedUser(null);
            setExpandedUserTab(null);
        } else {
            setExpandedUser(u.id);
            const stats = userDataStats[u.id];
            let defaultTab: 'properties' | 'proprietors' | 'rents' = 'properties';
            if (stats) {
                if (stats.propertyCount > 0) defaultTab = 'properties';
                else if (stats.proprietorCount > 0) defaultTab = 'proprietors';
                else if (stats.rentCount > 0) defaultTab = 'rents';
            }
            setExpandedUserTab({ userId: u.id, tab: defaultTab });
            loadUserData(u.id, defaultTab);
        }
    };

    // Edit User State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editPassword, setEditPassword] = useState('');
    const [editRole, setEditRole] = useState<UserRole>('user');
    const [isUpdating, setIsUpdating] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    useEffect(() => {
        const savedLang = localStorage.getItem('app-language') as 'zh-TW' | 'en' | null;
        if (savedLang) setLanguage(savedLang);

        if (user?.role === 'admin') {
            loadSystemUsersData();
        }
    }, [user]);

    const loadSystemUsersData = async () => {
        setIsLoadingUsers(true);
        try {
            const { success, users } = await getUsers();
            if (success && users) {
                setSystemUsers(users);

                // Fetch stats for all users in parallel
                const statsArray = await Promise.all(
                    users.map(async (u: User) => {
                        const stats = await fetchUserStats(u.id);
                        return { userId: u.id, stats };
                    })
                );

                const statsMap: typeof userDataStats = {};
                statsArray.forEach(({ userId, stats }) => {
                    statsMap[userId] = stats;
                });
                setUserDataStats(statsMap);
            }
        } catch (err) {
            console.error('Failed to load system users data:', err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername || !newPassword) {
            setAlertMessage(t('請輸入用戶名和密碼', 'Please enter username and password'));
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 3000);
            return;
        }

        setIsRegistering(true);
        const result = await registerUser(newUsername, newPassword, newUserRole);
        setIsRegistering(false);

        if (result.success) {
            setAlertMessage(t('用戶創建成功', 'User created successfully'));
            setShowAlert(true);
            setNewUsername('');
            setNewPassword('');
            loadSystemUsersData(); // Refresh list
            setTimeout(() => setShowAlert(false), 3000);
        } else {
            setAlertMessage(result.error || t('創建用戶失敗', 'Failed to create user'));
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 5000);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setIsUpdating(true);
        const updates: any = { role: editRole };
        if (editPassword) {
            updates.password = editPassword;
        }

        const result = await updateUser(editingUser.id, updates);
        setIsUpdating(false);

        if (result.success) {
            setAlertMessage(t('用戶更新成功', 'User updated successfully'));
            setShowAlert(true);
            setEditingUser(null);
            setEditPassword('');
            loadSystemUsersData();
            setTimeout(() => setShowAlert(false), 3000);
        } else {
            setAlertMessage(result.error || t('更新用戶失敗', 'Failed to update user'));
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 5000);
        }
    };

    const t = (zhTW: string, en: string) => language === 'zh-TW' ? zhTW : en;

    const filteredUsers = systemUsers.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Alert Toast */}
            <AnimatePresence>
                {showAlert && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        className="fixed top-6 left-1/2 z-50 px-6 py-3 bg-green-500 text-white rounded-xl shadow-lg flex items-center gap-3"
                    >
                        <Check className="w-5 h-5" />
                        <span className="font-medium">{alertMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                    <Users className="w-8 h-8 text-indigo-500" />
                    {t('帳號管理', 'Account Management')}
                </h1>
                <p className="text-zinc-500 dark:text-white/50 mt-1">
                    {t('管理系統用戶權限及查看用戶創建的資料', 'Manage user permissions and view user-created data')}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Create New User Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {t('新增帳號', 'Create New Account')}
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-white/40">
                                {t('為系統新增新的管理員或普通用戶', 'Add a new administrator or standard user')}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                {t('用戶名稱', 'Username')}
                            </label>
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder={t('輸入用戶名', 'Enter username')}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                {t('密碼', 'Password')}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder={t('輸入密碼', 'Enter password')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white/80"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                {t('權限角色', 'Role')}
                            </label>
                            <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setNewUserRole('user')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${newUserRole === 'user'
                                        ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-zinc-500'
                                        }`}
                                >
                                    {t('普通用戶', 'Standard User')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewUserRole('admin')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${newUserRole === 'admin'
                                        ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-zinc-500'
                                        }`}
                                >
                                    {t('管理員', 'Admin')}
                                </button>
                            </div>
                        </div>
                        <div className="md:col-span-3 flex justify-end">
                            <button
                                type="submit"
                                disabled={isRegistering}
                                className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                            >
                                {isRegistering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                {t('創建帳號', 'Create Account')}
                            </button>
                        </div>
                    </form>
                </motion.div>

                {/* User List Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-4"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <LayoutList className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {t('現有用戶', 'Existing Users')}
                            </h3>
                        </div>

                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('搜尋用戶...', 'Search users...')}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                        </div>
                    </div>

                    {isLoadingUsers ? (
                        <div className="flex justify-center py-12">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredUsers.map(u => (
                                <div key={u.id} className="overflow-hidden bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10">
                                    <div
                                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.08] transition-colors"
                                        onClick={() => handleRowClick(u)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
                                                {u.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-zinc-900 dark:text-white text-lg">{u.username}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin'
                                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                        : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                                                        }`}>
                                                        {u.role}
                                                    </span>
                                                    <span className="text-zinc-400 dark:text-white/20 text-xs">•</span>
                                                    <span className="text-zinc-500 dark:text-white/40 text-xs">ID: {u.id.slice(0, 8)}...</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 md:gap-8">
                                            <div className="hidden sm:flex gap-2">
                                                <button
                                                    onClick={(e) => handleTabClick(e, u, 'properties')}
                                                    className={`px-3 py-2 text-center group rounded-xl transition-all border border-transparent ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'properties' ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' : 'hover:bg-zinc-100 dark:hover:bg-white/5'}`}
                                                >
                                                    <p className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'properties' ? 'text-indigo-500' : 'text-zinc-400 dark:text-white/30'}`}>{t('物業', 'Properties')}</p>
                                                    <p className={`text-xl font-bold transition-colors ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'properties' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-white group-hover:text-indigo-500'}`}>
                                                        {userDataStats[u.id]?.propertyCount || 0}
                                                    </p>
                                                </button>
                                                <button
                                                    onClick={(e) => handleTabClick(e, u, 'proprietors')}
                                                    className={`px-3 py-2 text-center group rounded-xl transition-all border border-transparent ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'proprietors' ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' : 'hover:bg-zinc-100 dark:hover:bg-white/5'}`}
                                                >
                                                    <p className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'proprietors' ? 'text-indigo-500' : 'text-zinc-400 dark:text-white/30'}`}>{t('業主/租客', 'Owners')}</p>
                                                    <p className={`text-xl font-bold transition-colors ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'proprietors' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-white group-hover:text-indigo-500'}`}>
                                                        {userDataStats[u.id]?.proprietorCount || 0}
                                                    </p>
                                                </button>
                                                <button
                                                    onClick={(e) => handleTabClick(e, u, 'rents')}
                                                    className={`px-3 py-2 text-center group rounded-xl transition-all border border-transparent ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'rents' ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' : 'hover:bg-zinc-100 dark:hover:bg-white/5'}`}
                                                >
                                                    <p className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'rents' ? 'text-indigo-500' : 'text-zinc-400 dark:text-white/30'}`}>{t('租務資料', 'Rents')}</p>
                                                    <p className={`text-xl font-bold transition-colors ${expandedUserTab?.userId === u.id && expandedUserTab?.tab === 'rents' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-white group-hover:text-indigo-500'}`}>
                                                        {userDataStats[u.id]?.rentCount || 0}
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingUser(u);
                                                        setEditRole(u.role);
                                                        setEditPassword('');
                                                    }}
                                                    className="p-2 sm:px-4 sm:py-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-white/70 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                                                    title={t('修改資料', 'Edit Info')}
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    <span className="hidden sm:inline">{t('修改', 'Edit')}</span>
                                                </button>
                                                <div className="p-2 text-zinc-400">
                                                    {expandedUser === u.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {expandedUser === u.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 overflow-hidden"
                                            >
                                                <div className="p-6">
                                                    {isLoadingTabData ? (
                                                        <div className="flex justify-center py-8">
                                                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                                                        </div>
                                                    ) : expandedTabData.length === 0 ? (
                                                        <div className="text-center py-8">
                                                            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
                                                                <LayoutList className="w-5 h-5 text-zinc-400" />
                                                            </div>
                                                            <p className="text-zinc-500 dark:text-white/40">{t('沒有記錄', 'No records found')}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                            {expandedUserTab?.tab === 'properties' && expandedTabData.map(item => (
                                                                <Link key={item.id} href={`/properties/${encodeURIComponent(item.name)}`}>
                                                                    <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-indigo-500/50 transition-all cursor-pointer h-full">
                                                                        <p className="font-bold text-zinc-900 dark:text-white truncate" title={item.name}>{item.name}</p>
                                                                        <p className="text-sm text-zinc-500 dark:text-white/50">{item.code || t('無編號', 'No code')}</p>
                                                                        <div className="mt-3">
                                                                            <span className={`text-[10px] px-2.5 py-1 font-medium rounded-full ${propertyStatusColors[item.status] || 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/60'}`}>
                                                                                {propertyStatusLabels[item.status] || item.status || 'Active'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </Link>
                                                            ))}

                                                            {expandedUserTab?.tab === 'proprietors' && expandedTabData.map(item => (
                                                                <div key={item.id} className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow">
                                                                    <p className="font-bold text-zinc-900 dark:text-white truncate" title={item.name}>{item.name}</p>
                                                                    {item.english_name && <p className="text-sm text-zinc-500 dark:text-white/50 truncate" title={item.english_name}>{item.english_name}</p>}
                                                                    <div className="mt-3 flex gap-2">
                                                                        <span className="text-[10px] px-2 py-1 bg-amber-50 dark:bg-amber-500/10 font-medium rounded-md text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                                                            {item.type || 'Individual'}
                                                                        </span>
                                                                        {item.category && (
                                                                            <span className="text-[10px] px-2 py-1 bg-blue-50 dark:bg-blue-500/10 font-medium rounded-md text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                                                                                {item.category}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {expandedUserTab?.tab === 'rents' && expandedTabData.map(item => (
                                                                <div key={item.id} className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${item.type === 'rent_out'
                                                                            ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                                                                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                                            }`}>
                                                                            {item.type === 'rent_out' ? t('收租', 'Rent Out') : t('交租', 'Renting')}
                                                                        </span>
                                                                        <span className="text-xs text-zinc-400">
                                                                            {new Date(item.created_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xl font-bold text-zinc-900 dark:text-white my-1 truncate">
                                                                        ${(item.type === 'rent_out' ? item.rent_out_monthly_rental : item.renting_monthly_rental) || 0}
                                                                    </p>
                                                                    {(item.rent_out_tenancy_number || item.renting_number) && (
                                                                        <p className="text-[11px] text-zinc-500 dark:text-white/40 truncate">
                                                                            {t('單號: ', 'No: ')}{item.type === 'rent_out' ? item.rent_out_tenancy_number : item.renting_number}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="text-center py-20 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-dashed border-zinc-200 dark:border-white/10">
                                    <Users className="w-12 h-12 text-zinc-300 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-zinc-500 dark:text-white/40">{t('找不到匹配的用戶', 'No matching users found')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Edit User Modal */}
            <AnimatePresence>
                {editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden"
                        >
                            <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50 dark:bg-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                        <RefreshCw className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                        {t('修改用戶資料', 'Edit User Info')}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleUpdateUser} className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                        {t('用戶名稱', 'Username')}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingUser.username}
                                        disabled
                                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5 text-zinc-500 cursor-not-allowed"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                        {t('新密碼 (留空則不修改)', 'New Password (Leave blank to keep current)')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showEditPassword ? 'text' : 'password'}
                                            value={editPassword}
                                            onChange={(e) => setEditPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            placeholder={t('輸入新密碼', 'Enter new password')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEditPassword(!showEditPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white/80"
                                        >
                                            {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-700 dark:text-white/70">
                                        {t('權限角色', 'Role')}
                                    </label>
                                    <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setEditRole('user')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${editRole === 'user'
                                                ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-zinc-500'
                                                }`}
                                        >
                                            {t('普通用戶', 'Standard User')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditRole('admin')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${editRole === 'admin'
                                                ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-zinc-500'
                                                }`}
                                        >
                                            {t('管理員', 'Admin')}
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-white rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                                    >
                                        {t('取消', 'Cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUpdating}
                                        className="flex-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]"
                                    >
                                        {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        {t('儲存變更', 'Save Changes')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
