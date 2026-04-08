'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/** 後台租務／合約列表每頁筆數 */
export const ADMIN_LIST_PAGE_SIZE = 8;

type AdminListPaginationProps = {
    listPage: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    /** 當前頁碼按鈕樣式（合約頁可依分頁籤調色） */
    activeButtonClassName?: string;
};

export function AdminListPagination({
    listPage,
    totalPages,
    totalItems,
    onPageChange,
    activeButtonClassName = 'bg-purple-600 text-white shadow-md',
}: AdminListPaginationProps) {
    if (totalPages <= 1) return null;

    const go = (page: number) => {
        onPageChange(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 glass-card p-4">
            <p className="text-sm text-zinc-500 dark:text-white/50 tabular-nums">
                第 {listPage} / {totalPages} 頁，共 {totalItems} 筆（每頁 {ADMIN_LIST_PAGE_SIZE} 筆）
            </p>
            <div className="flex items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={() => go(Math.max(1, listPage - 1))}
                    disabled={listPage <= 1}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="上一頁"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1 flex-wrap justify-center">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                        if (
                            totalPages > 7 &&
                            pageNum !== 1 &&
                            pageNum !== totalPages &&
                            Math.abs(pageNum - listPage) > 2
                        ) {
                            if (Math.abs(pageNum - listPage) === 3) {
                                return (
                                    <span key={`ellipsis-${pageNum}`} className="px-1 text-zinc-400 text-sm">
                                        …
                                    </span>
                                );
                            }
                            return null;
                        }
                        return (
                            <button
                                key={pageNum}
                                type="button"
                                onClick={() => go(pageNum)}
                                className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
                                    listPage === pageNum
                                        ? activeButtonClassName
                                        : 'text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/5'
                                }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => go(Math.min(totalPages, listPage + 1))}
                    disabled={listPage >= totalPages}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="下一頁"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
