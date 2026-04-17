'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check authentication from LocalStorage
        const checkAuth = () => {
            try {
                const authData = localStorage.getItem('pms_auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    setIsAuthenticated(parsed.isAuthenticated === true);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Global restrictions for unauthenticated guests
    useEffect(() => {
        if (isLoading || isAuthenticated) return;

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Block F12
            if (e.key === 'F12') {
                e.preventDefault();
            }
            // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
                e.preventDefault();
            }
            // Block Ctrl+U (View Source)
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
            }
        };

        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isLoading, isAuthenticated]);

    // Public routes that don't require authentication
    const publicRoutes = ['/'];
    const isPublicRoute = publicRoutes.includes(pathname);

    // Protected routes require authentication
    const protectedRoutes = ['/proprietors', '/rent-out', '/renting', '/relations'];
    const isProtectedRoute = protectedRoutes.includes(pathname);

    // If on a protected route and not authenticated, redirect to login
    useEffect(() => {
        if (!isLoading && isProtectedRoute && !isAuthenticated) {
            window.location.href = '/login';
        }
    }, [isLoading, isProtectedRoute, isAuthenticated]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
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
                    <p className="text-white/70 text-sm">Loading...</p>
                </motion.div>
            </div>
        );
    }

    // If protected route and not authenticated, show nothing (will redirect)
    if (isProtectedRoute && !isAuthenticated) {
        return null;
    }

    return (
        <ThemeProvider>
            <NotificationProvider>
                <div className="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col md:flex-row">
                    {/* Sidebar - Hidden on mobile, fixed on desktop */}
                    <div className="hidden md:block">
                        <Sidebar isAuthenticated={isAuthenticated} />
                    </div>

                    <div className="flex-1 md:ml-[280px] transition-all duration-300">
                        <TopBar
                            isAuthenticated={isAuthenticated}
                            placeholder="搜尋物業..."
                        />
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
            </NotificationProvider>
        </ThemeProvider>
    );
}
