'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
    label: string;
    labelZh: string;
    href: string;
    icon: React.ReactNode;
    children?: NavItem[];
}

const navItems: NavItem[] = [
    {
        label: 'Dashboard',
        labelZh: '儀表板',
        href: '/admin/dashboard',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
        ),
    },
    {
        label: 'Properties',
        labelZh: '物業',
        href: '/admin/properties',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
        children: [
            {
                label: 'Renting',
                labelZh: '交租',
                href: '/admin/renting',
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                ),
            },
            {
                label: 'Rent Out',
                labelZh: '收租',
                href: '/admin/rent-out',
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                label: 'Proprietors',
                labelZh: '資產擁有方',
                href: '/admin/proprietors',
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                ),
            },
        ],
    },
    {
        label: 'Show All',
        labelZh: '關聯表',
        href: '/admin/relations',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
        ),
    },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [expandedItems, setExpandedItems] = useState<string[]>(['Properties']);

    const toggleExpand = (label: string) => {
        setExpandedItems(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const isActive = (href: string) => {
        return pathname === href || pathname.startsWith(href + '/');
    };
    const isParentActive = (item: NavItem) => {
        if (isActive(item.href)) return true;
        return item.children?.some(child => isActive(child.href));
    };

    return (
        <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            className="fixed left-0 top-0 h-screen w-[280px] bg-[#0f0f1a]/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-50"
        >
            {/* Logo */}
            <div className="p-6 border-b border-white/5">
                <Link href="/admin/dashboard" className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-white text-lg">PMS</h1>
                        <p className="text-white/40 text-xs">物業管理系統</p>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <ul className="space-y-1">
                    {navItems.map((item) => (
                        <li key={item.label}>
                            {item.children ? (
                                <div>
                                    <button
                                        onClick={() => toggleExpand(item.label)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isParentActive(item)
                                            ? 'bg-purple-500/20 text-white'
                                            : 'text-white/60 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {item.icon}
                                            <span className="font-medium">{item.labelZh}</span>
                                        </div>
                                        <motion.svg
                                            animate={{ rotate: expandedItems.includes(item.label) ? 180 : 0 }}
                                            className="w-4 h-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </motion.svg>
                                    </button>
                                    <AnimatePresence>
                                        {expandedItems.includes(item.label) && (
                                            <motion.ul
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="ml-4 mt-1 space-y-1 overflow-hidden"
                                            >
                                                <li>
                                                    <Link
                                                        href={item.href}
                                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${isActive(item.href)
                                                            ? 'bg-purple-500/20 text-white'
                                                            : 'text-white/50 hover:text-white hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isActive(item.href) ? 'bg-purple-500' : 'bg-white/30'}`} />
                                                        <span className="text-sm">All Properties</span>
                                                    </Link>
                                                </li>
                                                {item.children.map((child) => (
                                                    <li key={child.label}>
                                                        <Link
                                                            href={child.href}
                                                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${isActive(child.href)
                                                                ? 'bg-purple-500/20 text-white'
                                                                : 'text-white/50 hover:text-white hover:bg-white/5'
                                                                }`}
                                                        >
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isActive(child.href) ? 'bg-purple-500' : 'bg-white/30'}`} />
                                                            <span className="text-sm">{child.labelZh}</span>
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
                                        ? 'bg-purple-500/20 text-white'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {item.icon}
                                    <span className="font-medium">{item.labelZh}</span>
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-white text-sm font-medium">{user?.username}</p>
                            <p className="text-white/40 text-xs capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                        title="Logout"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </motion.aside>
    );
}
