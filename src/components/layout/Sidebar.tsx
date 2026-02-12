'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2,
    Users,
    Network,
    ArrowDownToLine,
    ArrowUpFromLine,
    LogOut,
    ChevronDown,
    Sun,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    requiresAuth?: boolean;
    children?: NavItem[];
}

// All navigation items - some require auth
const navItems: NavItem[] = [
    {
        label: '物業',
        href: '/',
        icon: <Building2 className="w-5 h-5" />,
        requiresAuth: false,
    },
    {
        label: '關聯表',
        href: '/relations',
        icon: <Network className="w-5 h-5" />,
        requiresAuth: true,
    },
];

interface SidebarProps {
    isAuthenticated?: boolean;
}

export default function Sidebar({ isAuthenticated = false }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const toggleExpand = (label: string) => {
        setExpandedItems(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const isActive = (href: string) => pathname === href;
    const isParentActive = (item: NavItem) => {
        if (isActive(item.href)) return true;
        return item.children?.some(child => isActive(child.href));
    };

    const handleLogout = () => {
        localStorage.removeItem('pms_auth');
        router.push('/login');
    };

    // Get user info from localStorage
    const getUserInfo = () => {
        try {
            const authData = localStorage.getItem('pms_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                return parsed.user || { username: 'Guest', role: 'guest' };
            }
        } catch {
            return { username: 'Guest', role: 'guest' };
        }
        return { username: 'Guest', role: 'guest' };
    };

    const user = getUserInfo();

    // Filter nav items based on auth status
    const visibleNavItems = navItems.filter(
        item => !item.requiresAuth || isAuthenticated
    );

    return (
        <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            className="fixed left-0 top-0 h-screen w-[280px] bg-white dark:bg-[#0f0f1a]/95 backdrop-blur-xl border-r border-zinc-200 dark:border-white/5 flex flex-col z-50 transition-colors duration-300"
        >
            <div className="p-6 border-b border-zinc-200 dark:border-white/5">
                <Link href="/" className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-zinc-900 dark:text-white text-lg">PMS</h1>
                        <p className="text-zinc-500 dark:text-white/40 text-xs">物業管理系統</p>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <ul className="space-y-1">
                    {visibleNavItems.map((item) => (
                        <li key={item.label}>
                            {item.children ? (
                                <div>
                                    <button
                                        onClick={() => toggleExpand(item.label)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isParentActive(item)
                                            ? 'bg-purple-500/20 text-purple-700 dark:text-white'
                                            : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {item.icon}
                                            <span className="font-medium">{item.label}</span>
                                        </div>
                                        <motion.div
                                            animate={{ rotate: expandedItems.includes(item.label) ? 180 : 0 }}
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </motion.div>
                                    </button>
                                    <AnimatePresence>
                                        {expandedItems.includes(item.label) && (
                                            <motion.ul
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="ml-4 mt-1 space-y-1 overflow-hidden"
                                            >
                                                {item.children.map((child) => (
                                                    <li key={child.label}>
                                                        <Link
                                                            href={child.href}
                                                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${isActive(child.href)
                                                                ? 'bg-purple-500/20 text-purple-700 dark:text-white'
                                                                : 'text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                                                                }`}
                                                        >
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isActive(child.href) ? 'bg-purple-500' : 'bg-zinc-400 dark:bg-white/30'}`} />
                                                            <span className="text-sm">{child.label}</span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </motion.ul>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive(item.href)
                                        ? 'bg-purple-500/20 text-purple-700 dark:text-white'
                                        : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    {item.icon}
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>

                {/* Auth hint for guests */}
                {!isAuthenticated && (
                    <div className="mt-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-3">
                        <ThemeToggle className="w-full justify-start px-4 h-11" showLabel />
                        <div>
                            <p className="text-zinc-600 dark:text-white/70 text-sm">
                                🔒 登入以訪問更多功能
                            </p>
                            <Link
                                href="/login"
                                className="mt-2 inline-block text-purple-400 text-sm hover:text-purple-300 transition-colors"
                            >
                                登入 →
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* User section - only show when authenticated */}
            {isAuthenticated && (
                <div className="p-4 border-t border-zinc-200 dark:border-white/5 space-y-3">
                    <ThemeToggle className="w-full justify-start px-4 h-11" showLabel />

                    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                                {user.username?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-zinc-900 dark:text-white text-sm font-medium">{user.username}</p>
                                <p className="text-zinc-500 dark:text-white/40 text-xs capitalize">{user.role}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Copyright */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-white/5">
                <p className="text-[10px] text-zinc-400 dark:text-white/30 text-center leading-relaxed">
                    © 版權所有 | {new Date().getFullYear()} | 只供集團內部使用
                </p>
            </div>
        </motion.aside>
    );
}
