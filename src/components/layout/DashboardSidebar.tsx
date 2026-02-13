'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    ArrowDownToLine,
    ArrowUpFromLine,
    Network,
    LogOut,
    ArrowLeft,
    Settings,
    Building2,
    Sun,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface DashboardNavItem {
    label: string;
    labelZh: string;
    href: string;
    icon: React.ReactNode;
}

const dashboardNavItems: DashboardNavItem[] = [
    {
        label: 'Overview',
        labelZh: '總覽',
        href: '/dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
        label: 'Manage Properties',
        labelZh: '管理物業',
        href: '/dashboard/properties',
        icon: <Building2 className="w-5 h-5" />,
    },
    {
        label: 'Manage Proprietors',
        labelZh: '管理擁有方',
        href: '/dashboard/proprietors',
        icon: <Users className="w-5 h-5" />,
    },
    {
        label: 'Manage Tenants',
        labelZh: '管理承租人',
        href: '/dashboard/tenants',
        icon: <Users className="w-5 h-5" />,
    },
    {
        label: 'Manage Rent Out',
        labelZh: '管理收租',
        href: '/dashboard/rent-out',
        icon: <ArrowUpFromLine className="w-5 h-5" />,
    },
    {
        label: 'Manage Renting',
        labelZh: '管理交租',
        href: '/dashboard/renting',
        icon: <ArrowDownToLine className="w-5 h-5" />,
    },
    {
        label: 'Manage Relations',
        labelZh: '管理關聯',
        href: '/dashboard/relations',
        icon: <Network className="w-5 h-5" />,
    },
];

interface DashboardSidebarProps {
    userRole?: string;
}

export default function DashboardSidebar({ userRole = 'client' }: DashboardSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (href: string) => {
        return pathname === href || pathname.startsWith(href + '/');
    };

    const handleLogout = () => {
        localStorage.removeItem('pms_auth');
        router.push('/login');
    };

    // Get user info
    const getUserInfo = () => {
        try {
            const authData = localStorage.getItem('pms_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                return parsed.user || { username: 'Admin', role: 'admin' };
            }
        } catch {
            return { username: 'Admin', role: 'admin' };
        }
        return { username: 'Admin', role: 'admin' };
    };

    const user = getUserInfo();

    return (
        <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            className="fixed left-0 top-0 h-screen w-[280px] bg-white dark:bg-[#0f0f1a]/95 backdrop-blur-xl border-r border-zinc-200 dark:border-white/5 flex flex-col z-50 transition-colors duration-300"
        >
            {/* Logo and Back Button */}
            <div className="p-6 border-b border-zinc-200 dark:border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-zinc-900 dark:text-white text-lg">Backend</h1>
                        <p className="text-zinc-500 dark:text-white/40 text-xs font-medium">管理控制台</p>
                    </div>
                </div>

                {/* Back to Frontend */}
                <Link
                    href="/"
                    className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm">返回應用</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <p className="px-4 text-xs text-zinc-400 dark:text-white/40 uppercase tracking-wider mb-3">
                    管理
                </p>
                <ul className="space-y-1">
                    {dashboardNavItems.map((item) => (
                        <li key={item.label}>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive(item.href)
                                    ? 'bg-purple-500/20 text-purple-700 dark:text-white'
                                    : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                {item.icon}
                                <span className="font-medium">{item.labelZh}</span>
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Admin-only Settings Section */}
                {userRole === 'admin' && (
                    <>
                        <p className="px-4 text-xs text-zinc-400 dark:text-white/40 uppercase tracking-wider mb-3 mt-6 font-medium">
                            設定
                        </p>
                        <ul className="space-y-1">
                            <li>
                                <Link
                                    href="/dashboard/users"
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive('/dashboard/users')
                                        ? 'bg-purple-500/20 text-purple-700 dark:text-white'
                                        : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <Users className="w-5 h-5" />
                                    <span className="font-medium">帳號管理</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/dashboard/settings"
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive('/dashboard/settings')
                                        ? 'bg-purple-500/20 text-purple-700 dark:text-white'
                                        : 'text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <Settings className="w-5 h-5" />
                                    <span className="font-medium">系統設定</span>
                                </Link>
                            </li>
                        </ul>
                    </>
                )}
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-zinc-200 dark:border-white/5 space-y-3">
                <ThemeToggle className="w-full justify-start px-4 h-11" showLabel />

                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                            {user.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-zinc-900 dark:text-white text-sm font-medium">{user.username}</p>
                            <p className="text-zinc-500 dark:text-white/40 text-xs capitalize">
                                {user.role === 'admin' ? '🔐 Admin' : '👤 Client'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg text-zinc-400 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Copyright */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-white/5">
                <p className="text-[10px] text-zinc-400 dark:text-white/30 text-center leading-relaxed">
                    © 版權所有 | {new Date().getFullYear()} | 只供集團內部使用
                </p>
            </div>
        </motion.aside>
    );
}
