'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import TopBar from '@/components/layout/TopBar';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { useLanguage } from '@/components/common/LanguageSwitcher';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userRole, setUserRole] = useState<string>('client');

    useEffect(() => {
        // Check authentication from LocalStorage
        const checkAuth = () => {
            try {
                const authData = localStorage.getItem('pms_auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    if (parsed.isAuthenticated) {
                        const role = parsed.user?.role || 'client';
                        setUserRole(role);

                        // Check for admin-only routes
                        const adminOnlyRoutes = ['/dashboard/users', '/dashboard/settings', '/dashboard/settings/trash'];
                        if (adminOnlyRoutes.some(route => pathname.startsWith(route)) && role !== 'admin') {
                            router.push('/dashboard');
                            return;
                        }

                        setIsAuthenticated(true);
                    } else {
                        router.push('/login');
                    }
                } else {
                    router.push('/login');
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                router.push('/login');
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f1a]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-12 h-12 rounded-full bg-purple-500"
                    />
                    <p className="text-zinc-500 dark:text-white/70 text-sm">
                        {t('Loading…', '載入中…')}
                    </p>
                </motion.div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f0f1a]">
            {/* Dashboard Sidebar - Hidden on mobile, fixed on desktop */}
            <div className="hidden md:block">
                <DashboardSidebar userRole={userRole} />
            </div>

            {/* Main Content - No margin on mobile, fixed margin on desktop */}
            <div className="flex-1 md:ml-[280px] min-h-screen flex flex-col transition-all duration-300">
                <TopBar
                    isAuthenticated={isAuthenticated}
                    isAdmin={true}
                    placeholder="搜尋物業..."
                />

                {/* Content */}
                <AnimatePresence mode="wait">
                    <motion.main
                        key={pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="p-6"
                    >
                        {children}
                    </motion.main>
                </AnimatePresence>
            </div>
        </div>
    );
}
