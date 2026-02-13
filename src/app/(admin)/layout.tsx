'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import ThemeToggle from '@/components/layout/ThemeToggle';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
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
                        setIsAuthenticated(true);
                        setUserRole(parsed.user?.role || 'client');
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
                    <p className="text-zinc-500 dark:text-white/70 text-sm">Loading Dashboard...</p>
                </motion.div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f0f1a]">
            {/* Dashboard Sidebar */}
            <DashboardSidebar userRole={userRole} />

            {/* Main Content */}
            <div className="ml-[280px]">

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
