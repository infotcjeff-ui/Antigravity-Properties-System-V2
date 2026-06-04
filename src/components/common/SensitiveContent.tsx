'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/components/common/LanguageSwitcher';

interface SensitiveContentProps {
    children: React.ReactNode;
    fallbackClassName?: string;
}

export default function SensitiveContent({ children, fallbackClassName = '' }: SensitiveContentProps) {
    const { user } = useAuth();
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => (isZh ? zh : en);

    if (user?.role === 'client') {
        return (
            <div className={`relative ${fallbackClassName}`}>
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl overflow-hidden">
                    <div className="flex flex-col items-center gap-3 p-6">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center">
                            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-zinc-700 dark:text-white mb-1">
                                {t('Sensitive Information', '敏感資料')}
                            </p>
                            <p className="text-xs text-zinc-400 dark:text-white/40 max-w-[200px]">
                                {t('This section contains sensitive property information.', '此區域包含敏感物業資料。')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="blur-sm opacity-30 pointer-events-none select-none">
                    {children}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
