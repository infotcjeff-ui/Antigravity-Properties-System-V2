'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
    value: string;
    label: string;
}

interface AnimatedSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    name?: string;
}

/** 高於 RentOutFormModal 等 overlay（z-70） */
const MENU_Z = 100;

export default function AnimatedSelect({
    value,
    onChange,
    options,
    placeholder = 'Select an option',
    className = '',
    disabled = false,
    name,
}: AnimatedSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 });
    const selectRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    const updateMenuPosition = useCallback(() => {
        const el = selectRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setMenuRect({
            top: rect.bottom + 8,
            left: rect.left,
            width: rect.width,
        });
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 開啟當幀即對齊觸發按鈕，避免首幀出現在 (0,0)
    useLayoutEffect(() => {
        if (!isOpen) return;
        updateMenuPosition();
    }, [isOpen, updateMenuPosition]);

    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener('scroll', updateMenuPosition, true);
        window.addEventListener('resize', updateMenuPosition);
        return () => {
            window.removeEventListener('scroll', updateMenuPosition, true);
            window.removeEventListener('resize', updateMenuPosition);
        };
    }, [isOpen, updateMenuPosition]);

    // Close dropdown when clicking outside（觸發區與 portal 內選單皆視為內部）
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const t = event.target as Node;
            if (selectRef.current?.contains(t)) return;
            if (menuRef.current?.contains(t)) return;
            setIsOpen(false);
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const menuContent =
        isOpen && mounted ? (
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{
                    duration: 0.15,
                    ease: [0.4, 0.0, 0.2, 1],
                }}
                style={{
                    position: 'fixed',
                    top: menuRect.top,
                    left: menuRect.left,
                    width: menuRect.width,
                    zIndex: MENU_Z,
                }}
                className="origin-top"
            >
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 overflow-hidden max-h-60 overflow-y-auto">
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <motion.div
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                                    isSelected
                                        ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                        : 'text-zinc-700 dark:text-white/80 hover:bg-zinc-50 dark:hover:bg-white/5'
                                }`}
                                whileHover={{
                                    backgroundColor: isSelected ? undefined : 'rgba(139, 92, 246, 0.05)',
                                }}
                            >
                                <span>{option.label}</span>
                                {isSelected && <Check className="w-4 h-4" />}
                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>
        ) : null;

    return (
        <div ref={selectRef} className={`relative ${className}`}>
            <input type="hidden" name={name} value={value} />

            <motion.button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full min-h-12 px-4 py-3.5 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-left text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center justify-between ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-500/30'
                }`}
                whileTap={!disabled ? { scale: 0.995 } : {}}
            >
                <span className={selectedOption ? '' : 'text-zinc-400 dark:text-white/40'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-white/40" />
                </motion.div>
            </motion.button>

            {mounted && menuContent ? createPortal(menuContent, document.body) : null}
        </div>
    );
}
