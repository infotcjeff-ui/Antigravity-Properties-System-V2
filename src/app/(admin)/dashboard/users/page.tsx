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
    Search,
    Pencil,
    Trash2,
    Building2,
    ArrowUpFromLine,
    ArrowDownToLine,
    Network,
    Settings
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

    const [newUsername, setNewUsername] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
    const [showPassword, setShowPassword] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
    const [editDisplayName, setEditDisplayName] = useState('');
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
        const result = await registerUser(newUsername, newPassword, newUserRole, newDisplayName);
        setIsRegistering(false);

        if (result.success) {
            setAlertMessage(t('用戶創建成功', 'User created successfully'));
            setShowAlert(true);
            setNewUsername('');
            setNewDisplayName('');
            setNewPassword('');
            setIsAddModalOpen(false);
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
        if (editDisplayName) {
            updates.displayName = editDisplayName;
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

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('確定要刪除此帳號嗎？', 'Are you sure you want to delete this account?'))) return;

        try {
            const { error } = await supabase.from('app_users').delete().eq('id', id);
            if (error) throw error;
            setAlertMessage(t('用戶已刪除', 'User deleted successfully'));
            setShowAlert(true);
            loadSystemUsersData();
            setTimeout(() => setShowAlert(false), 3000);
        } catch (err) {
            console.error('Delete error:', err);
            setAlertMessage(t('刪除失敗', 'Delete failed'));
            setShowAlert(true);
        }
    }

    const t = (zhTW: string, en: string) => language === 'zh-TW' ? zhTW : en;

    const filteredUsers = systemUsers.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <AnimatePresence>
                {showAlert && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        className="fixed top-6 left-1/2 z-50 px-6 py-3 bg-emerald-500 text-white rounded-xl shadow-lg flex items-center gap-3"
                    >
                        <Check className="w-5 h-5" />
                        <span className="font-medium">{alertMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-indigo-500" />
                        {t('帳號管理', 'Account Management')}
                    </h1>
                    <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">
                        {t('管理系統用戶權限及查看用戶創建的資料', 'Manage user permissions and view user-created data')}
                    </p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                    <UserPlus className="w-5 h-5" />
                    <span className="hidden sm:inline">{t('新增帳號', 'Create New Account')}</span>
                </button>
            </div>

            <div className="space-y-4">
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
                        {/* Desktop Table View */}
                        <div className="hidden md:block bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5">
                                    <tr className="text-left text-zinc-500 dark:text-white/50 text-xs font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4">{t('用戶', 'User')}</th>
                                        <th className="px-6 py-4">{t('權限', 'Role')}</th>
                                        <th className="px-6 py-4 text-center">{t('數據統計', 'Stats')}</th>
                                        <th className="px-6 py-4 text-right">{t('操作', 'Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                        {(u.displayName || u.username).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-zinc-900 dark:text-white">{u.displayName || u.username}</p>
                                                        {u.displayName && <p className="text-[10px] text-zinc-400">@{u.username}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin'
                                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                    : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                                                    }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-4">
                                                    <div className="text-center">
                                                        <p className="text-[10px] text-zinc-400 uppercase font-bold">{t('物業', 'Props')}</p>
                                                        <p className="font-bold dark:text-white">{userDataStats[u.id]?.propertyCount || 0}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] text-zinc-400 uppercase font-bold">{t('業主', 'Own')}</p>
                                                        <p className="font-bold dark:text-white">{userDataStats[u.id]?.proprietorCount || 0}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] text-zinc-400 uppercase font-bold">{t('租務', 'Rent')}</p>
                                                        <p className="font-bold dark:text-white">{userDataStats[u.id]?.rentCount || 0}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingUser(u);
                                                            setEditRole(u.role);
                                                            setEditDisplayName(u.displayName || '');
                                                            setEditPassword('');
                                                        }}
                                                        className="p-2 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-white/70 transition-all"
                                                        title={t('編輯', 'Edit')}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(u.id)}
                                                        className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all"
                                                        title={t('刪除', 'Delete')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {filteredUsers.map((u, index) => (
                                <motion.div
                                    key={u.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-4 space-y-4 shadow-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                {(u.displayName || u.username).charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-zinc-900 dark:text-white">{u.displayName || u.username}</h3>
                                                {u.displayName && <p className="text-[10px] text-zinc-400">@{u.username}</p>}
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin'
                                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                            : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                                            }`}>
                                            {u.role}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 py-3 border-y border-zinc-100 dark:border-white/5 text-center">
                                        <div>
                                            <p className="text-[10px] text-zinc-400 uppercase font-bold mb-1">{t('物業', 'Props')}</p>
                                            <p className="font-bold dark:text-white">{userDataStats[u.id]?.propertyCount || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-zinc-400 uppercase font-bold mb-1">{t('業主', 'Own')}</p>
                                            <p className="font-bold dark:text-white">{userDataStats[u.id]?.proprietorCount || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-zinc-400 uppercase font-bold mb-1">{t('租務', 'Rent')}</p>
                                            <p className="font-bold dark:text-white">{userDataStats[u.id]?.rentCount || 0}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            onClick={() => {
                                                setEditingUser(u);
                                                setEditRole(u.role);
                                                setEditDisplayName(u.displayName || '');
                                                setEditPassword('');
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 active:bg-indigo-100 dark:active:bg-indigo-500/20 transition-all text-sm font-semibold"
                                        >
                                            <Pencil className="w-4 h-4" />
                                            {t('編輯資料', 'Edit Info')}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 active:bg-red-100 dark:active:bg-red-500/20 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Add User Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
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
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                        {t('新增帳號', 'Create New Account')}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
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
                                        {t('顯示名稱 (簡稱)', 'Display Name (Short)')}
                                    </label>
                                    <input
                                        type="text"
                                        value={newDisplayName}
                                        onChange={(e) => setNewDisplayName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        placeholder={t('輸入顯示名稱', 'Enter display name')}
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

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-white rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                                    >
                                        {t('取消', 'Cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isRegistering}
                                        className="flex-[2] px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]"
                                    >
                                        {isRegistering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        {t('創建帳號', 'Create Account')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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
                                        {t('顯示名稱 (簡稱)', 'Display Name (Short)')}
                                    </label>
                                    <input
                                        type="text"
                                        value={editDisplayName}
                                        onChange={(e) => setEditDisplayName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        placeholder={t('輸入顯示名稱', 'Enter display name')}
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

                                {editingUser.role !== 'admin' && (
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
                                )}

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
                                        className="flex-[2] px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]"
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
