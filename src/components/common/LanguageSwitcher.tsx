'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

type Language = 'zh-TW' | 'en';

interface LanguageSwitcherProps {
    isAdmin?: boolean;
}

export default function LanguageSwitcher({ isAdmin = false }: LanguageSwitcherProps) {
    const [language, setLanguage] = useState<Language>('zh-TW');

    useEffect(() => {
        // Load saved language preference
        const saved = localStorage.getItem('app-language') as Language | null;
        if (saved) {
            setLanguage(saved);
            document.documentElement.lang = saved;
        }
    }, []);

    const toggleLanguage = () => {
        const newLang: Language = language === 'zh-TW' ? 'en' : 'zh-TW';
        setLanguage(newLang);
        localStorage.setItem('app-language', newLang);
        document.documentElement.lang = newLang;
        // Trigger a custom event for other components to react
        window.dispatchEvent(new CustomEvent('language-change', { detail: newLang }));
    };

    // Only render if user is admin
    if (!isAdmin) return null;

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-white/80 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all text-sm"
            title={language === 'zh-TW' ? 'Switch to English' : '切換至中文'}
        >
            <Globe className="w-4 h-4" />
            <span className="font-medium">
                {language === 'zh-TW' ? '繁中' : 'EN'}
            </span>
        </motion.button>
    );
}

// Export a hook for other components to use
export function useLanguage() {
    const [language, setLanguage] = useState<Language>(() => {
        if (typeof window === 'undefined') return 'zh-TW';
        const saved = localStorage.getItem('app-language') as Language | null;
        return saved === 'en' ? 'en' : 'zh-TW';
    });

    useEffect(() => {
        const handleChange = (e: CustomEvent<Language>) => {
            setLanguage(e.detail);
        };

        window.addEventListener('language-change', handleChange as EventListener);
        return () => window.removeEventListener('language-change', handleChange as EventListener);
    }, []);

    return language;
}
