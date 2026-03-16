'use client';

import { parseLotEntries } from '@/lib/formatters';

interface LotIndexDisplayProps {
    lotIndex: string | null | undefined;
    variant?: 'default' | 'compact';
    className?: string;
}

export default function LotIndexDisplay({ lotIndex, variant = 'default', className = '' }: LotIndexDisplayProps) {
    const entries = parseLotEntries(lotIndex);
    if (entries.length === 0) return <span className={className}>-</span>;

    if (variant === 'compact') {
        const first = entries[0];
        const more = entries.length > 1 ? ` 等${entries.length}項` : '';
        return (
            <span className={className}>
                <span className={first.type === 'new' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-white/70'}>
                    [{first.type === 'new' ? '新' : '舊'}]
                </span>
                {' '}{first.value}{more}
            </span>
        );
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {entries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${entry.type === 'new' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-white/70'}`}>
                        {entry.type === 'new' ? '新' : '舊'}
                    </span>
                    <span className="text-sm text-zinc-900 dark:text-white break-all">{entry.value}</span>
                </div>
            ))}
        </div>
    );
}
