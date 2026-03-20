'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { HeroUIProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <NextThemesProvider
                attribute="class"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange={false}
            >
                <HeroUIProvider>
                    <NotificationProvider>
                        <AuthProvider>
                            {children}
                        </AuthProvider>
                    </NotificationProvider>
                </HeroUIProvider>
            </NextThemesProvider>
        </QueryClientProvider>
    );
}
