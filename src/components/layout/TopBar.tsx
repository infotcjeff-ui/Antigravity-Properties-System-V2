'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Check, Trash2, LayoutDashboard, LogIn, LogOut, Database, Cloud } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import ThemeToggle from './ThemeToggle';

interface TopBarProps {
    onSearch?: (query: string) => void;
    placeholder?: string;
    isAuthenticated?: boolean;
}

export default function TopBar({ onSearch, placeholder = '搜尋...', isAuthenticated = false }: TopBarProps) {
    const router = useRouter();
    const [searchValue, setSearchValue] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    // Only use notifications if authenticated
    const notificationContext = useNotifications();
    const notifications = isAuthenticated ? notificationContext.notifications : [];
    const unreadCount = isAuthenticated ? notificationContext.unreadCount : 0;
    const markAsRead = notificationContext.markAsRead;
    const markAllAsRead = notificationContext.markAllAsRead;
    const clearAll = notificationContext.clearAll;

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);
        onSearch?.(value);
    };


    const handleLogout = () => {
        localStorage.removeItem('pms_auth');
        router.push('/login');
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '剛剛';
        if (minutes < 60) return `${minutes}分鐘前`;
        if (hours < 24) return `${hours}小時前`;
        return `${days}天前`;
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'create':
                return <span className="text-green-400">+</span>;
            case 'update':
                return <span className="text-blue-400">↻</span>;
            case 'delete':
                return <span className="text-red-400">×</span>;
            default:
                return <span className="text-gray-400">•</span>;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-40 h-16 px-6 flex items-center justify-between bg-white/90 dark:bg-[#0f0f1a]/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 transition-colors duration-300"
        >
            {/* Search - Hidden for now */}
            <div className="relative flex-1 max-w-md hidden">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    value={searchValue}
                    onChange={handleSearch}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                />
            </div>
            {/* Spacer for when search is hidden to keep flex layout intact if needed, or flex-1 handles it */}
            <div className="flex-1" />

            {/* Right side actions */}
            <div className="flex items-center gap-3">
                {/* Theme Toggle */}
                <ThemeToggle />

                {isAuthenticated ? (
                    <>
                        {/* Notification Bell - Only for authenticated users */}
                        <div className="relative" ref={notificationRef}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2.5 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                                    >
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </motion.span>
                                )}
                            </motion.button>

                            {/* Notification Dropdown */}
                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-full mt-2 w-80 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                                            <h3 className="font-semibold text-white">通知中心</h3>
                                            <div className="flex items-center gap-2">
                                                {unreadCount > 0 && (
                                                    <button
                                                        onClick={markAllAsRead}
                                                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                                        title="全部標記為已讀"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {notifications.length > 0 && (
                                                    <button
                                                        onClick={clearAll}
                                                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                        title="清除全部"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-white/40">
                                                    <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">暫無通知</p>
                                                </div>
                                            ) : (
                                                notifications.slice(0, 20).map((notification) => (
                                                    <motion.div
                                                        key={notification.id}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        onClick={() => markAsRead(notification.id)}
                                                        className={`p-4 border-b border-white/5 cursor-pointer transition-colors ${notification.read ? 'bg-transparent' : 'bg-purple-500/5'
                                                            } hover:bg-white/5`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="text-lg">{getTypeIcon(notification.type)}</div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm ${notification.read ? 'text-white/60' : 'text-white'}`}>
                                                                    {notification.message}
                                                                </p>
                                                                <p className="text-xs text-white/40 mt-1">{formatTime(notification.timestamp)}</p>
                                                            </div>
                                                            {!notification.read && (
                                                                <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>


                        {/* Dashboard Button */}
                        <Link href="/dashboard">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-shadow"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                <span className="text-sm">後台管理</span>
                            </motion.button>
                        </Link>

                        {/* Logout Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/70 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            title="登出"
                        >
                            <LogOut className="w-5 h-5" />
                        </motion.button>
                    </>
                ) : (
                    /* Login Button - For guests */
                    <Link href="/login">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-shadow"
                        >
                            <LogIn className="w-4 h-4" />
                            <span className="text-sm">登入</span>
                        </motion.button>
                    </Link>
                )}
            </div>
        </motion.div>
    );
}
