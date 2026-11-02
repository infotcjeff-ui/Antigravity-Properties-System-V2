'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Check if already logged in (using effect logic if needed, but useAuth already handles it)
    useEffect(() => {
        try {
            const authData = localStorage.getItem('pms_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                if (parsed.isAuthenticated) {
                    const role = parsed.user?.role;
                    if (role === 'client') {
                        router.push('/dashboard/users');
                    } else {
                        router.push('/dashboard');
                    }
                }
            }
        } catch {
            // Ignore errors
        }
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(username, password, rememberMe);

        if (result.success) {
            try {
                const authData = localStorage.getItem('pms_auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    if (parsed.user?.role === 'client') {
                        router.push('/dashboard/users');
                    } else {
                        router.push('/dashboard');
                    }
                } else {
                    router.push('/dashboard');
                }
            } catch {
                router.push('/dashboard');
            }
        } else {
            setError(result.error || '用戶名或密碼錯誤');
            setIsLoading(false);
        }
    };

    const handleGuestEnter = () => {
        router.push('/');
    };

    return (
        <div className="relative h-[100dvh] overflow-hidden flex items-center justify-center px-4">
            {/* Background - 淡色圓圈漸變 blur 流動動畫 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* 底色 */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-[#0f0f1a] dark:via-[#141422] dark:to-[#0f0f1a]" />

                {/* 飄流圓圈 1 - 紫 (左上大範圍緩漂) */}
                <motion.div
                    animate={{
                        x: [0, 90, 40, -40, 0],
                        y: [0, 60, 110, 40, 0],
                        scale: [1, 1.2, 1.05, 1.15, 1],
                        opacity: [0.7, 1, 0.85, 1, 0.7],
                        rotate: [0, 12, -8, 6, 0],
                    }}
                    transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-purple-200/50 to-fuchsia-200/30 dark:from-purple-500/20 dark:to-fuchsia-500/10 blur-3xl"
                />
                {/* 飄流圓圈 2 - 藍 (右側上下迴游) */}
                <motion.div
                    animate={{
                        x: [0, -70, -120, -40, 0],
                        y: [0, 80, -20, -70, 0],
                        scale: [1, 0.9, 1.12, 1, 1],
                        opacity: [0.7, 1, 0.8, 0.95, 0.7],
                        rotate: [0, -10, 8, -6, 0],
                    }}
                    transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-gradient-to-br from-blue-200/50 to-cyan-100/30 dark:from-blue-500/20 dark:to-cyan-500/10 blur-3xl"
                />
                {/* 飄流圓圈 3 - 粉 (底部左右漂移) */}
                <motion.div
                    animate={{
                        x: [0, 110, -60, 50, 0],
                        y: [0, -50, -90, -30, 0],
                        scale: [1, 1.12, 0.95, 1.08, 1],
                        opacity: [0.6, 0.95, 0.75, 1, 0.6],
                        rotate: [0, 8, -12, 5, 0],
                    }}
                    transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                    className="absolute -bottom-32 left-1/4 w-[26rem] h-[26rem] rounded-full bg-gradient-to-br from-pink-200/40 to-rose-100/20 dark:from-pink-500/15 dark:to-rose-500/5 blur-3xl"
                />
                {/* 飄流圓圈 4 - 青 (中央緩慢環繞) */}
                <motion.div
                    animate={{
                        x: [0, -60, 60, -30, 0],
                        y: [0, -60, 40, 70, 0],
                        scale: [1, 1.18, 0.92, 1.1, 1],
                        opacity: [0.5, 0.85, 0.6, 0.9, 0.5],
                        rotate: [0, -14, 10, -5, 0],
                    }}
                    transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full bg-gradient-to-br from-violet-100/30 to-sky-100/20 dark:from-violet-500/10 dark:to-sky-500/5 blur-3xl"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative w-full max-w-md shrink-0"
            >
                {/* Card */}
                <div className="backdrop-blur-xl bg-white/70 dark:bg-white/10 border border-zinc-200 dark:border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-6">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/sitelogo/EasyParking - 橫.png"
                            alt="EasyParking"
                            className="w-36 h-auto mb-3"
                            style={{ objectFit: 'contain' }}
                        />
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">泊車易管理系統</h1>
                        <p className="text-zinc-500 dark:text-white/50 text-sm mt-1">EasyParking Management System</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/70 mb-2">
                                用戶名
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                placeholder="請輸入用戶名"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/70 mb-2">
                                密碼
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all pr-12"
                                    placeholder="請輸入密碼"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember me */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-zinc-200 dark:border-white/20 bg-zinc-100 dark:bg-white/5 text-purple-500 focus:ring-purple-500/50"
                                />
                                <span className="text-sm text-zinc-500 dark:text-white/60">記住我</span>
                            </label>
                        </div>

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm text-center"
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Submit */}
                        <motion.button
                            type="submit"
                            disabled={isLoading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-semibold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <motion.div
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                        className="w-5 h-5 rounded-full bg-white"
                                    />
                                    <span>登入中...</span>
                                </>
                            ) : (
                                <span>登入</span>
                            )}
                        </motion.button>
                    </form>

                    {/* 以訪客進入網站 */}
                    <div className="mt-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 h-px bg-zinc-200 dark:bg-white/10" />
                            <span className="text-xs text-zinc-400 dark:text-white/40">或</span>
                            <div className="flex-1 h-px bg-zinc-200 dark:bg-white/10" />
                        </div>
                        <button
                            type="button"
                            onClick={handleGuestEnter}
                            className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-white/15 bg-white/60 dark:bg-white/5 text-zinc-600 dark:text-white/80 text-sm font-medium hover:bg-white dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white hover:border-purple-300 dark:hover:border-purple-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <UserRound className="w-4 h-4" />
                            以訪客進入網站
                        </button>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}
