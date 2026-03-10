'use client';

import React from 'react';
import { motion, useMotionValue } from 'framer-motion';

interface BentoGridProps {
    children: React.ReactNode;
    className?: string;
}

export function BentoGrid({ children, className = '' }: BentoGridProps) {
    return (
        <div className={`bento-grid ${className}`}>
            {children}
        </div>
    );
}

interface BentoCardProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    className?: string;
    size?: 'default' | 'lg' | 'tall' | 'wide';
    gradient?: 'purple' | 'blue' | 'green' | 'orange' | 'none';
    onClick?: () => void;
}

export function BentoCard({
    children,
    title,
    subtitle,
    icon,
    className = '',
    size = 'default',
    gradient = 'none',
    onClick
}: BentoCardProps) {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
        let { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);

        // Update CSS variables for the spotlight effect in globals.css
        const element = currentTarget as HTMLElement;
        element.style.setProperty("--mouse-x", `${clientX - left}px`);
        element.style.setProperty("--mouse-y", `${clientY - top}px`);
    }

    const sizeClasses = {
        default: '',
        lg: 'bento-item-lg bento-item-tall',
        tall: 'bento-item-tall',
        wide: 'bento-item-lg',
    };

    const gradientClasses = {
        none: '',
        purple: 'hover:bg-purple-500/10 dark:hover:bg-purple-500/10',
        blue: 'hover:bg-blue-500/10 dark:hover:bg-blue-500/10',
        green: 'hover:bg-green-500/10 dark:hover:bg-green-500/10',
        orange: 'hover:bg-orange-500/10 dark:hover:bg-orange-500/10',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            whileHover={{
                y: -5,
                transition: { duration: 0.2 }
            }}
            onMouseMove={handleMouseMove}
            onClick={onClick}
            className={`
        bento-item 
        group
        ${sizeClasses[size]} 
        ${gradientClasses[gradient]}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
        >
            {(icon || title || subtitle) && (
                <div className="flex items-start gap-3 mb-4 relative z-10">
                    {icon && (
                        <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/80 border border-zinc-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
                            {icon}
                        </div>
                    )}
                    <div>
                        {title && (
                            <h3 className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight">{title}</h3>
                        )}
                        {subtitle && (
                            <p className="text-zinc-500 dark:text-white/40 text-sm mt-0.5">{subtitle}</p>
                        )}
                    </div>
                </div>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    );
}

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    gradient?: 'purple' | 'blue' | 'green' | 'orange';
}

export function StatCard({ label, value, icon, trend, gradient = 'purple' }: StatCardProps) {
    const gradientIconClasses = {
        purple: 'from-purple-500 to-purple-600 shadow-purple-500/20',
        blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
        green: 'from-green-500 to-green-600 shadow-green-500/20',
        orange: 'from-orange-500 to-orange-600 shadow-orange-500/20',
    };

    return (
        <BentoCard gradient={gradient} className="bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-zinc-500 dark:text-white/50 text-sm font-medium mb-1 uppercase tracking-wider">{label}</p>
                    <motion.p
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter"
                    >
                        {value}
                    </motion.p>
                    {trend && (
                        <div className={`flex items-center gap-1 mt-2 text-sm font-semibold ${trend.isPositive ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                            <svg
                                className={`w-4 h-4 ${trend.isPositive ? '' : 'rotate-180'}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </svg>
                            <span>{trend.value}%</span>
                        </div>
                    )}
                </div>
                <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${gradientIconClasses[gradient]} shadow-xl group-hover:rotate-6 transition-transform duration-300`}>
                    {icon}
                </div>
            </div>
        </BentoCard>
    );
}
