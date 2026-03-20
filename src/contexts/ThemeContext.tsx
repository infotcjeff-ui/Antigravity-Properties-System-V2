'use client';

// Re-export useTheme from next-themes for consistent usage
import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
    const { theme, setTheme, resolvedTheme } = useNextTheme();

    const toggleTheme = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    return {
        theme: (resolvedTheme || 'light') as 'light' | 'dark',
        setTheme,
        toggleTheme,
    };
}

// Keep ThemeProvider export for compatibility (actual provider is in providers.tsx)
export { ThemeProvider } from 'next-themes';
