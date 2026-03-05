'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
    value: string;
    label: string;
}

interface AnimatedMultiSelectProps {
    values: string[];
    onChange: (values: string[]) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    name?: string;
}

export default function AnimatedMultiSelect({
    values = [],
    onChange,
    options,
    placeholder = 'Select options',
    className = '',
    disabled = false,
    name
}: AnimatedMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        if (values.includes(optionValue)) {
            onChange(values.filter(v => v !== optionValue));
        } else {
            onChange([...values, optionValue]);
        }
    };

    const displayLabels = values
        .map(val => options.find(opt => opt.value === val)?.label)
        .filter(Boolean);

    return (
        <div ref={selectRef} className={`relative ${className}`}>
            {/* Hidden input for forms */}
            <input type="hidden" name={name} value={values.join(',')} />

            {/* Trigger Button */}
            <motion.button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-left text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-500/30'
                    }`}
                whileTap={!disabled ? { scale: 0.995 } : {}}
            >
                <div className="flex flex-wrap gap-1 items-center flex-1 pr-2 truncate">
                    {displayLabels.length > 0 ? (
                        displayLabels.join(', ')
                    ) : (
                        <span className="text-zinc-400 dark:text-white/40">{placeholder}</span>
                    )}
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-white/40 flex-shrink-0" />
                </motion.div>
            </motion.button>

            {/* Dropdown Options */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{
                            duration: 0.15,
                            ease: [0.4, 0.0, 0.2, 1]
                        }}
                        className="absolute z-50 w-full mt-2 origin-top"
                    >
                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 overflow-hidden max-h-60 overflow-y-auto">
                            {options.map((option) => {
                                const isSelected = values.includes(option.value);
                                return (
                                    <motion.div
                                        key={option.value}
                                        onClick={() => handleSelect(option.value)}
                                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${isSelected
                                            ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                            : 'text-zinc-700 dark:text-white/80 hover:bg-zinc-50 dark:hover:bg-white/5'
                                            }`}
                                        whileHover={{ backgroundColor: isSelected ? undefined : 'rgba(139, 92, 246, 0.05)' }}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && <Check className="w-4 h-4" />}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
