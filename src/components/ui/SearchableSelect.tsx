'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Search, X } from 'lucide-react';

interface Select2Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Select2Option[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    name?: string;
    allowClear?: boolean;
}

const MENU_Z = 200;

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = '搜尋...',
    className = '',
    disabled = false,
    name,
    allowClear = true,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 });
    const [highlightedIdx, setHighlightedIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;
        const lower = search.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lower));
    }, [options, search]);

    const updateMenuPosition = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const menuHeight = Math.min(280, filteredOptions.length * 44 + 48);

        const top = spaceBelow < menuHeight && spaceAbove > spaceBelow
            ? rect.top - menuHeight - 8
            : rect.bottom + 8;

        setMenuRect({
            top,
            left: rect.left,
            width: rect.width,
        });
    }, [filteredOptions.length]);

    useEffect(() => {
        if (isOpen) {
            updateMenuPosition();
            setTimeout(() => searchInputRef.current?.focus(), 50);
        } else {
            setSearch('');
            setHighlightedIdx(0);
        }
    }, [isOpen, updateMenuPosition]);

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('scroll', updateMenuPosition, true);
            window.addEventListener('resize', updateMenuPosition);
            return () => {
                window.removeEventListener('scroll', updateMenuPosition, true);
                window.removeEventListener('resize', updateMenuPosition);
            };
        }
    }, [isOpen, updateMenuPosition]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (containerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setIsOpen(false);
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIdx(i => Math.min(i + 1, filteredOptions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIdx(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredOptions[highlightedIdx]) {
                    onChange(filteredOptions[highlightedIdx].value);
                    setIsOpen(false);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
    };

    const menuContent = (
        <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
                position: 'fixed',
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
                zIndex: MENU_Z,
            }}
            className="origin-top"
        >
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-white/20 overflow-hidden">
                <div className="p-2 border-b border-zinc-100 dark:border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-white/40 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setHighlightedIdx(0); }}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className="w-full pl-9 pr-8 py-2 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-white/10 rounded"
                            >
                                <X className="w-3 h-3 text-zinc-400" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-h-60 overflow-y-auto">
                    {filteredOptions.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-white/50">
                            no matching options
                        </div>
                    ) : (
                        filteredOptions.map((option, idx) => {
                            const isSelected = option.value === value;
                            const isHighlighted = idx === highlightedIdx;
                            return (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setHighlightedIdx(idx)}
                                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                                        isHighlighted
                                            ? 'bg-purple-50 dark:bg-purple-500/15'
                                            : isSelected
                                                ? 'bg-purple-50/50 dark:bg-purple-500/10'
                                                : 'hover:bg-zinc-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <span className={isSelected ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-zinc-700 dark:text-white/80'}>
                                        {option.label}
                                    </span>
                                    {isSelected && (
                                        <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </motion.div>
    );

    return (
        <div
            ref={containerRef}
            className={`relative ${className}`}
            onKeyDown={handleKeyDown}
        >
            <input type="hidden" name={name} value={value} />

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full min-h-12 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/20 rounded-xl text-left text-sm transition-all flex items-center justify-between gap-2 ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-400 dark:hover:border-purple-500'
                } ${isOpen ? 'border-purple-500 ring-2 ring-purple-500/20' : ''}`}
            >
                <span className={selectedOption ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-white/50'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <div className="flex items-center gap-1">
                    {allowClear && value && !disabled && (
                        <span
                            onClick={handleClear}
                            className="p-0.5 hover:bg-zinc-100 dark:hover:bg-white/10 rounded"
                        >
                            <X className="w-3.5 h-3.5 text-zinc-400" />
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && menuContent && createPortal(menuContent, document.body)}
        </div>
    );
}
