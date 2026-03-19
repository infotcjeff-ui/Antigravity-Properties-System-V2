'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useRents, useProprietors, useProperties, useSubLandlordsQuery, useCurrentTenantsQuery } from '@/hooks/useStorage';
import type { Proprietor, Property, Rent, SubLandlord, CurrentTenant } from '@/lib/db';
import ProprietorModal from '@/components/properties/ProprietorModal';
import RentOutFormModal from '@/components/properties/RentOutFormModal';
import { formatNumberWithCommas, parsePriceInput } from '@/lib/formatters';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[150px] w-full bg-zinc-100 dark:bg-white/5 animate-pulse rounded-xl" />
});

type RentTypeValue = 'rent_out' | 'renting' | 'contract';

interface RentModalProps {
    propertyId?: string;
    defaultLocation?: string;
    /** 預設類型；建立時若傳入 allowedTypes 會受其限制 */
    defaultType?: RentTypeValue;
    /** 僅顯示這些類型選項；不傳則顯示全部（收租、交租、合約記錄） */
    allowedTypes?: RentTypeValue[];
    rent?: Rent | null;
    initialProprietorId?: string;
    onClose: () => void;
    onSuccess: (rentId: string) => void;
}

const allRentTypes = [
    { value: 'rent_out' as const, label: '收租' },
    { value: 'renting' as const, label: '交租' },
    { value: 'contract' as const, label: '合約記錄' },
];

const rentOutStatuses = [
    { value: 'listing', label: '放盤中' },
    { value: 'renting', label: '出租中' },
    { value: 'completed', label: '已完租' },
];

export default function RentModal({
    propertyId,
    defaultLocation,
    defaultType,
    allowedTypes,
    rent,
    initialProprietorId,
    onClose,
    onSuccess,
}: RentModalProps) {
    const queryClient = useQueryClient();
    const { addRent, updateRent } = useRents();
    const { getProprietors } = useProprietors();
    const { getProperties } = useProperties();
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState('');
    const [proprietors, setProprietors] = useState<Proprietor[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [showProprietorModal, setShowProprietorModal] = useState(false);
    const [showSubLandlordModal, setShowSubLandlordModal] = useState(false);
    const [showCurrentTenantModal, setShowCurrentTenantModal] = useState(false);
    const [editSubLandlord, setEditSubLandlord] = useState<SubLandlord | null>(null);
    const [editCurrentTenant, setEditCurrentTenant] = useState<CurrentTenant | null>(null);
    const { data: subLandlords = [] } = useSubLandlordsQuery();
    const { data: currentTenants = [] } = useCurrentTenantsQuery();

    // Determine effective types for the type selector
    const effectiveTypes = allowedTypes && allowedTypes.length > 0
        ? allRentTypes.filter(t => allowedTypes.includes(t.value))
        : allRentTypes;

    const [formData, setFormData] = useState(() => {
        const formatDate = (date: any) => {
            if (!date) return '';
            const d = new Date(date);
            return d.toISOString().split('T')[0];
        };

        if (rent) {
            return {
                type: rent.type as RentTypeValue,
                propertyId: rent.propertyId || propertyId || '',
                tenantId: rent.tenantId || '',
                proprietorId: rent.proprietorId || '',
                rentOutTenancyNumber: rent.rentOutTenancyNumber || '',
                rentOutPricing: rent.rentOutPricing?.toString() || '',
                rentOutMonthlyRental: rent.rentOutMonthlyRental?.toString() || '',
                rentOutPeriods: rent.rentOutPeriods?.toString() || '',
                rentOutTotalAmount: rent.rentOutTotalAmount?.toString() || '',
                rentOutStartDate: formatDate(rent.rentOutStartDate),
                rentOutEndDate: formatDate(rent.rentOutEndDate),
                rentOutActualEndDate: formatDate(rent.rentOutActualEndDate),
                rentOutDepositReceived: rent.rentOutDepositReceived?.toString() || '',
                rentOutDepositReceiptNumber: (rent as any).rentOutDepositReceiptNumber || '',
                rentOutDepositReceiveDate: formatDate(rent.rentOutDepositReceiveDate),
                rentOutDepositReturnDate: formatDate(rent.rentOutDepositReturnDate),
                rentOutDepositReturnAmount: rent.rentOutDepositReturnAmount?.toString() || '',
                rentOutLessor: rent.rentOutLessor || '',
                rentOutAddressDetail: rent.rentOutAddressDetail || defaultLocation || '',
                location: rent.location || rent.rentOutAddressDetail || defaultLocation || '',
                rentOutStatus: rent.rentOutStatus || 'listing' as 'listing' | 'renting' | 'completed',
                rentOutDescription: rent.rentOutDescription || '',
                rentOutSubLandlord: (rent as any).rentOutSubLandlord || '',
                rentOutSubLandlordId: (rent as any).rentOutSubLandlordId || '',
                rentOutTenants: (() => {
                    const t = (rent as any).rentOutTenants;
                    if (Array.isArray(t)) return t;
                    if (typeof t === 'string') try { return JSON.parse(t); } catch { return []; }
                    return [];
                })(),
                rentOutTenantIds: (() => {
                    const ids = (rent as any).rentOutTenantIds;
                    if (Array.isArray(ids)) return ids;
                    return [];
                })(),
                rentingNumber: rent.rentingNumber || '',
                rentingReferenceNumber: rent.rentingReferenceNumber || '',
                rentingMonthlyRental: rent.rentingMonthlyRental?.toString() || '',
                rentingPeriods: rent.rentingPeriods?.toString() || '',
                rentingStartDate: formatDate(rent.rentingStartDate),
                rentingEndDate: formatDate(rent.rentingEndDate),
                rentingDeposit: rent.rentingDeposit?.toString() || '',
            };
        }

        // Create mode
        const allowed = allowedTypes && allowedTypes.length > 0;
        const initialType = (allowed && defaultType && allowedTypes!.includes(defaultType))
            ? defaultType
            : (allowed ? allowedTypes![0] : (defaultType || 'rent_out'));

        return {
            type: initialType as RentTypeValue,
            propertyId: propertyId || '',
            tenantId: '',
            proprietorId: initialProprietorId || '',
            rentOutTenancyNumber: '',
            rentOutPricing: '',
            rentOutMonthlyRental: '',
            rentOutPeriods: '',
            rentOutTotalAmount: '',
            rentOutStartDate: '',
            rentOutEndDate: '',
            rentOutActualEndDate: '',
            rentOutDepositReceived: '',
            rentOutDepositReceiptNumber: '',
            rentOutDepositReceiveDate: '',
            rentOutDepositReturnDate: '',
            rentOutDepositReturnAmount: '',
            rentOutLessor: '',
            rentOutAddressDetail: defaultLocation || '',
            location: defaultLocation || '',
            rentOutStatus: 'listing' as 'listing' | 'renting' | 'completed',
            rentOutDescription: '',
            rentOutSubLandlord: '',
            rentOutSubLandlordId: '',
            rentOutTenants: [] as string[],
            rentOutTenantIds: [] as string[],
            rentingNumber: '',
            rentingReferenceNumber: '',
            rentingMonthlyRental: '',
            rentingPeriods: '',
            rentingStartDate: '',
            rentingEndDate: '',
            rentingDeposit: '',
        };
    });

    const loadData = async () => {
        setLoadingData(true);
        const [propsData, propertiesData] = await Promise.all([
            getProprietors(),
            getProperties()
        ]);
        setProprietors(propsData);
        setProperties(propertiesData);
        setLoadingData(false);
    };

    useEffect(() => {
        loadData();
    }, [getProprietors, getProperties]);

    // Auto-calculate rentOutTotalAmount（收租 + 合約記錄 共用）
    useEffect(() => {
        if (formData.type === 'rent_out' || formData.type === 'contract') {
            const monthly = parseFloat(formData.rentOutMonthlyRental);
            const periods = parseInt(formData.rentOutPeriods);
            const newTotal = (!isNaN(monthly) && !isNaN(periods)) ? (monthly * periods).toString() : '';

            if (formData.rentOutTotalAmount !== newTotal) {
                setFormData(prev => ({ ...prev, rentOutTotalAmount: newTotal }));
            }
        }
    }, [formData.rentOutMonthlyRental, formData.rentOutPeriods, formData.type, formData.rentOutTotalAmount]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePriceChange = (name: string, value: string) => {
        const parsed = parsePriceInput(value);
        setFormData(prev => ({ ...prev, [name]: parsed }));
    };

    const handleProprietorCreated = async (id: string) => {
        await loadData();
        if (formData.type === 'rent_out') {
            setFormData(prev => ({ ...prev, tenantId: id }));
        } else {
            setFormData(prev => ({ ...prev, proprietorId: id }));
        }
        setShowProprietorModal(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.type === 'rent_out' && !formData.tenantId) {
            setError('請按「+ 新增」以新增承租人');
            return;
        }
        if (formData.type === 'contract' && !formData.propertyId) {
            setError('請選擇關聯的物業');
            return;
        }
        setSaving(true);
        setError('');

        try {
            const baseData = {
                propertyId: formData.propertyId,
                tenantId: formData.tenantId,
                proprietorId: formData.proprietorId,
                type: formData.type,
            };

            let rentData: any = { ...baseData };

            if (formData.type === 'rent_out') {
                rentData = {
                    ...rentData,
                    rentOutTenancyNumber: formData.rentOutTenancyNumber,
                    rentOutPricing: parseFloat(formData.rentOutPricing) || undefined,
                    rentOutMonthlyRental: parseFloat(formData.rentOutMonthlyRental) || undefined,
                    rentOutPeriods: parseInt(formData.rentOutPeriods) || undefined,
                    rentOutTotalAmount: parseFloat(formData.rentOutTotalAmount) || undefined,
                    rentOutStartDate: formData.rentOutStartDate ? new Date(formData.rentOutStartDate) : undefined,
                    rentOutEndDate: formData.rentOutEndDate ? new Date(formData.rentOutEndDate) : undefined,
                    rentOutActualEndDate: formData.rentOutActualEndDate ? new Date(formData.rentOutActualEndDate) : undefined,
                    rentOutDepositReceived: parseFloat(formData.rentOutDepositReceived) || undefined,
                    rentOutDepositReceiptNumber: formData.rentOutDepositReceiptNumber || undefined,
                    rentOutDepositReceiveDate: formData.rentOutDepositReceiveDate ? new Date(formData.rentOutDepositReceiveDate) : undefined,
                    rentOutDepositReturnDate: formData.rentOutDepositReturnDate ? new Date(formData.rentOutDepositReturnDate) : undefined,
                    rentOutDepositReturnAmount: parseFloat(formData.rentOutDepositReturnAmount) || undefined,
                    rentOutAddressDetail: formData.rentOutAddressDetail || defaultLocation,
                    location: formData.rentOutAddressDetail || defaultLocation,
                    rentOutStatus: formData.rentOutStatus,
                    rentOutDescription: formData.rentOutDescription,
                    rentOutSubLandlord: subLandlords.find(s => s.id === formData.rentOutSubLandlordId)?.name || formData.rentOutSubLandlord || undefined,
                    rentOutSubLandlordId: formData.rentOutSubLandlordId || undefined,
                    rentOutTenants: (formData.rentOutTenantIds || []).length > 0
                        ? (formData.rentOutTenantIds || []).map(id => currentTenants.find(ct => ct.id === id)?.name || id)
                        : (formData.rentOutTenants || []).filter(Boolean).length > 0 ? formData.rentOutTenants : undefined,
                    rentOutTenantIds: (formData.rentOutTenantIds || []).length > 0 ? formData.rentOutTenantIds : undefined,
                };
            } else if (formData.type === 'renting') {
                rentData = {
                    ...rentData,
                    location: formData.location || defaultLocation,
                    rentingNumber: formData.rentingNumber,
                    rentingReferenceNumber: formData.rentingReferenceNumber,
                    rentingMonthlyRental: parseFloat(formData.rentingMonthlyRental) || undefined,
                    rentingPeriods: parseInt(formData.rentingPeriods) || undefined,
                    rentingStartDate: formData.rentingStartDate ? new Date(formData.rentingStartDate) : undefined,
                    rentingEndDate: formData.rentingEndDate ? new Date(formData.rentingEndDate) : undefined,
                    rentingDeposit: parseFloat(formData.rentingDeposit) || undefined,
                };
            } else if (formData.type === 'contract') {
                // 合約記錄：以 rentOut* 欄位儲存
                rentData = {
                    ...rentData,
                    rentOutTenancyNumber: formData.rentOutTenancyNumber,
                    rentOutPricing: parseFloat(formData.rentOutPricing) || undefined,
                    rentOutMonthlyRental: parseFloat(formData.rentOutMonthlyRental) || undefined,
                    rentOutPeriods: parseInt(formData.rentOutPeriods) || undefined,
                    rentOutTotalAmount: parseFloat(formData.rentOutTotalAmount) || undefined,
                    rentOutStartDate: formData.rentOutStartDate ? new Date(formData.rentOutStartDate) : undefined,
                    rentOutEndDate: formData.rentOutEndDate ? new Date(formData.rentOutEndDate) : undefined,
                    rentOutActualEndDate: formData.rentOutActualEndDate ? new Date(formData.rentOutActualEndDate) : undefined,
                    rentOutDepositReceived: parseFloat(formData.rentOutDepositReceived) || undefined,
                    rentOutDepositReceiptNumber: formData.rentOutDepositReceiptNumber || undefined,
                    rentOutDepositReceiveDate: formData.rentOutDepositReceiveDate ? new Date(formData.rentOutDepositReceiveDate) : undefined,
                    rentOutDepositReturnDate: formData.rentOutDepositReturnDate ? new Date(formData.rentOutDepositReturnDate) : undefined,
                    rentOutDepositReturnAmount: parseFloat(formData.rentOutDepositReturnAmount) || undefined,
                    rentOutAddressDetail: formData.rentOutAddressDetail || defaultLocation,
                    location: formData.rentOutAddressDetail || defaultLocation,
                    rentOutStatus: formData.rentOutStatus,
                    rentOutDescription: formData.rentOutDescription,
                    rentOutLessor: formData.rentOutLessor || undefined,
                    rentOutSubLandlord: subLandlords.find(s => s.id === formData.rentOutSubLandlordId)?.name || formData.rentOutSubLandlord || undefined,
                    rentOutSubLandlordId: formData.rentOutSubLandlordId || undefined,
                    rentOutTenants: (formData.rentOutTenantIds || []).length > 0
                        ? (formData.rentOutTenantIds || []).map(id => currentTenants.find(ct => ct.id === id)?.name || id)
                        : (formData.rentOutTenants || []).filter(Boolean).length > 0 ? formData.rentOutTenants : undefined,
                    rentOutTenantIds: (formData.rentOutTenantIds || []).length > 0 ? formData.rentOutTenantIds : undefined,
                };
            }

            if (rent?.id) {
                const success = await updateRent(rent.id, rentData);
                if (success) {
                    onSuccess(rent.id);
                    onClose();
                } else {
                    setError('更新失敗');
                }
            } else {
                const id = await addRent(rentData);
                if (id) {
                    onSuccess(id);
                    onClose();
                } else {
                    setError('創建失敗');
                }
            }
        } catch (err) {
            setError(rent?.id ? '更新失敗' : '創建失敗');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = "w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all";
    const labelClass = "block text-sm font-medium text-zinc-700 dark:text-white/80 mb-1";

    const getTitle = () => {
        if (rent) {
            if (formData.type === 'rent_out') return '編輯出租記錄 (收租)';
            if (formData.type === 'renting') return '編輯租賃記錄 (交租)';
            return '編輯合約記錄';
        }
        if (formData.type === 'rent_out') return '新增出租記錄 (收租)';
        if (formData.type === 'renting') return '新增租賃記錄 (交租)';
        return '新增合約記錄';
    };

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed top-0 left-0 w-screen h-screen bg-black/60 backdrop-blur-sm z-[60]"
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-[60] overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{getTitle()}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    {error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-600 dark:text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Type Selector */}
                    {effectiveTypes.length > 1 && (
                        <div className="space-y-2">
                            <label className={labelClass}>類型 *</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                required
                                className={inputClass}
                            >
                                {effectiveTypes.map(t => (
                                    <option key={t.value} value={t.value} className="bg-white dark:bg-[#1a1a2e]">{t.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {effectiveTypes.length === 1 && (
                        <input type="hidden" name="type" value={formData.type} />
                    )}

                    {/* Property and Tenant Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={labelClass}>物業 *</label>
                            {propertyId ? (
                                <div className={`${inputClass} opacity-80 bg-zinc-100 dark:bg-white/10 flex items-center`}>
                                    <span className="text-zinc-500 dark:text-white/40 mr-2">📍</span>
                                    {properties.find(p => p.id === formData.propertyId)?.name || 'Loading...'}
                                </div>
                            ) : (
                                <select
                                    name="propertyId"
                                    value={formData.propertyId}
                                    onChange={handleChange}
                                    required
                                    className={inputClass}
                                >
                                    <option value="" className="bg-white dark:bg-[#1a1a2e]">選擇物業...</option>
                                    {properties
                                        .slice()
                                        .sort((a, b) => ((a.name || '').length) - ((b.name || '').length))
                                        .map(p => (
                                            <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">{p.name} ({p.code})</option>
                                        ))}
                                </select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>承租人</label>
                            <div className="flex gap-2 items-center">
                                {(formData.type === 'rent_out' || formData.type === 'renting' || formData.type === 'contract') ? (
                                    <>
                                        <div className={`flex-1 px-4 py-3 rounded-xl border min-h-[44px] flex items-center justify-between gap-2 bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10`}>
                                            {formData.tenantId ? (
                                                <>
                                                    <span className="text-zinc-900 dark:text-white font-medium">
                                                        {proprietors.find(p => p.id === formData.tenantId)?.name || '已選擇'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, tenantId: '' }))}
                                                        className="p-1 text-zinc-400 hover:text-red-500 text-xs"
                                                        title="清除"
                                                    >
                                                        ✕
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-zinc-400 dark:text-white/40">請按「+ 新增」以新增承租人</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowProprietorModal(true)}
                                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-[44px] whitespace-nowrap"
                                        >
                                            + 新增
                                        </button>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* ===== 承租人 / 二房東 / 現時租客 — 收租、交租、合約記錄 共用 ===== */}
                    {(formData.type === 'rent_out' || formData.type === 'renting' || formData.type === 'contract') && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>二房東</label>
                                    <div className="flex gap-2 items-center">
                                        <select
                                            name="rentOutSubLandlordId"
                                            value={formData.rentOutSubLandlordId}
                                            onChange={handleChange}
                                            className={`${inputClass} flex-1`}
                                        >
                                            <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇二房東</option>
                                            {subLandlords.map(sl => (
                                                <option key={sl.id} value={sl.id} className="bg-white dark:bg-[#1a1a2e]">{sl.name}</option>
                                            ))}
                                        </select>
                                        {formData.rentOutSubLandlordId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const sl = subLandlords.find(s => s.id === formData.rentOutSubLandlordId);
                                                    if (sl) setEditSubLandlord(sl);
                                                    setShowSubLandlordModal(true);
                                                }}
                                                className="p-2 text-zinc-400 hover:text-purple-500 rounded-lg shrink-0"
                                                title="編輯"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => { setEditSubLandlord(null); setShowSubLandlordModal(true); }}
                                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-[44px] whitespace-nowrap"
                                        >
                                            + 新增
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-400 dark:text-white/40">請按「+ 新增」以新增二房東</p>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>現時租客</label>
                                    <div className="flex gap-2 items-center">
                                        <div className={`${inputClass} flex-1 min-h-[44px] flex flex-wrap items-center gap-2`}>
                                            {(formData.rentOutTenantIds || []).length > 0 ? (
                                                <>
                                                    {(formData.rentOutTenantIds || []).map(id => {
                                                        const t = currentTenants.find(ct => ct.id === id);
                                                        return (
                                                            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-500/20 rounded-lg text-sm">
                                                                {t?.name || id}
                                                                <button type="button" onClick={() => { setEditCurrentTenant(t ? { ...t, id } : { id, name: String(id), createdAt: new Date(), updatedAt: new Date() }); setShowCurrentTenantModal(true); }} className="p-0.5 hover:text-purple-500" title="編輯">✎</button>
                                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, rentOutTenantIds: (prev.rentOutTenantIds || []).filter(x => x !== id) }))} className="p-0.5 hover:text-red-500">×</button>
                                                            </span>
                                                        );
                                                    })}
                                                </>
                                            ) : (
                                                <span className="text-zinc-400 dark:text-white/40 text-sm">請按「+ 新增租客」以新增</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setEditCurrentTenant(null); setShowCurrentTenantModal(true); }}
                                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-[44px] whitespace-nowrap"
                                        >
                                            + 新增租客
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-400 dark:text-white/40">請按「+ 新增租客」以新增</p>
                                    {currentTenants.filter(ct => !(formData.rentOutTenantIds || []).includes(ct.id!)).length > 0 && (
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v) setFormData(prev => ({ ...prev, rentOutTenantIds: [...(prev.rentOutTenantIds || []), v] }));
                                            }}
                                            className={`${inputClass} mt-1 text-sm`}
                                        >
                                            <option value="">從現有租客中加入...</option>
                                            {currentTenants.filter(ct => !(formData.rentOutTenantIds || []).includes(ct.id!)).map(ct => (
                                                <option key={ct.id} value={ct.id} className="bg-white dark:bg-[#1a1a2e]">{ct.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===== RENT OUT FORM (收租) ===== */}
                    {formData.type === 'rent_out' && (
                        <>
                            <div className="border-t border-zinc-200 dark:border-white/10 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-4">出租合約資料</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約號碼 *</label>
                                    <input type="text" name="rentOutTenancyNumber" value={formData.rentOutTenancyNumber} onChange={handleChange} required className={inputClass} placeholder="RO-001" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約放盤價</label>
                                    <input type="text" name="rentOutPricing" value={formatNumberWithCommas(formData.rentOutPricing)} onChange={(e) => handlePriceChange('rentOutPricing', e.target.value)} className={inputClass} placeholder="0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約月租 *</label>
                                    <input type="text" name="rentOutMonthlyRental" value={formatNumberWithCommas(formData.rentOutMonthlyRental)} onChange={(e) => handlePriceChange('rentOutMonthlyRental', e.target.value)} required className={inputClass} placeholder="50,000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約期數 (月)</label>
                                    <input type="number" name="rentOutPeriods" value={formData.rentOutPeriods} onChange={handleChange} className={inputClass} placeholder="12" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約總額</label>
                                <input
                                    type="text"
                                    name="rentOutTotalAmount"
                                    value={formatNumberWithCommas(formData.rentOutTotalAmount)}
                                    readOnly
                                    className={`${inputClass} bg-zinc-100 dark:bg-white/5 cursor-not-allowed opacity-80`}
                                    placeholder="自動計算"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約開始日期</label>
                                    <input type="date" name="rentOutStartDate" value={formData.rentOutStartDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約結束日期</label>
                                    <input type="date" name="rentOutEndDate" value={formData.rentOutEndDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約實際結束日期</label>
                                <input type="date" name="rentOutActualEndDate" value={formData.rentOutActualEndDate} onChange={handleChange} className={inputClass} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約按金</label>
                                    <input type="text" name="rentOutDepositReceived" value={formatNumberWithCommas(formData.rentOutDepositReceived)} onChange={(e) => handlePriceChange('rentOutDepositReceived', e.target.value)} className={inputClass} placeholder="100,000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>按金收據號碼</label>
                                    <input type="text" name="rentOutDepositReceiptNumber" value={formData.rentOutDepositReceiptNumber} onChange={handleChange} className={inputClass} placeholder="請輸入按金收據號碼" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>按金收取日期</label>
                                    <input type="date" name="rentOutDepositReceiveDate" value={formData.rentOutDepositReceiveDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>按金退回日期</label>
                                    <input type="date" name="rentOutDepositReturnDate" value={formData.rentOutDepositReturnDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>按金退回金額</label>
                                <input type="text" name="rentOutDepositReturnAmount" value={formatNumberWithCommas(formData.rentOutDepositReturnAmount)} onChange={(e) => handlePriceChange('rentOutDepositReturnAmount', e.target.value)} className={inputClass} placeholder="100,000" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約出租人</label>
                                    <input type="text" name="rentOutLessor" value={formData.rentOutLessor} onChange={handleChange} className={inputClass} placeholder="公司名稱 / 個人名稱" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>租借位置 / 地址</label>
                                    <input type="text" name="rentOutAddressDetail" value={formData.rentOutAddressDetail} onChange={handleChange} className={inputClass} placeholder="詳細地址" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約租務狀態</label>
                                <select name="rentOutStatus" value={formData.rentOutStatus} onChange={handleChange} className={inputClass}>
                                    {rentOutStatuses.map(s => (
                                        <option key={s.value} value={s.value} className="bg-white dark:bg-[#1a1a2e]">{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約描述</label>
                                <div className="rich-text-editor">
                                    <style jsx global>{`
                                        .rich-text-editor .ql-toolbar { border-radius: 12px 12px 0 0; border-color: var(--border-color); background: var(--bg-color); }
                                        .rich-text-editor .ql-container { border-radius: 0 0 12px 12px; border-color: var(--border-color); background: var(--bg-color); min-height: 120px; }
                                        .rich-text-editor .ql-editor { color: inherit; min-height: 100px; }
                                        :root { --border-color: #e5e7eb; --bg-color: #f9fafb; }
                                        .dark { --border-color: rgba(255,255,255,0.1); --bg-color: rgba(255,255,255,0.05); }
                                    `}</style>
                                    <ReactQuill
                                        theme="snow"
                                        value={formData.rentOutDescription}
                                        onChange={(content) => setFormData(prev => ({ ...prev, rentOutDescription: content }))}
                                        placeholder="合約描述或備註..."
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===== RENTING FORM (交租) ===== */}
                    {formData.type === 'renting' && (
                        <>
                            <div className="border-t border-zinc-200 dark:border-white/10 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-4">租賃合約資料</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>我方租約號碼</label>
                                    <input type="text" name="rentingNumber" value={formData.rentingNumber} onChange={handleChange} className={inputClass} placeholder="RT-001" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>對方租約號碼</label>
                                    <input type="text" name="rentingReferenceNumber" value={formData.rentingReferenceNumber} onChange={handleChange} className={inputClass} placeholder="LL-001" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>每月租金金額</label>
                                    <input type="text" name="rentingMonthlyRental" value={formatNumberWithCommas(formData.rentingMonthlyRental)} onChange={(e) => handlePriceChange('rentingMonthlyRental', e.target.value)} className={inputClass} placeholder="30,000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>租賃期限 (月)</label>
                                    <input type="number" name="rentingPeriods" value={formData.rentingPeriods} onChange={handleChange} className={inputClass} placeholder="24" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>租期開始日期</label>
                                    <input type="date" name="rentingStartDate" value={formData.rentingStartDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>租期結束日期</label>
                                    <input type="date" name="rentingEndDate" value={formData.rentingEndDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>押金</label>
                                    <input type="text" name="rentingDeposit" value={formatNumberWithCommas(formData.rentingDeposit)} onChange={(e) => handlePriceChange('rentingDeposit', e.target.value)} className={inputClass} placeholder="60,000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>租借位置 / 地址</label>
                                    <input type="text" name="location" value={formData.location} onChange={handleChange} className={inputClass} placeholder="詳細地址" />
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===== CONTRACT FORM (合約記錄) — 使用出租資料欄位 ===== */}
                    {formData.type === 'contract' && (
                        <>
                            <div className="border-t border-zinc-200 dark:border-white/10 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-4">出租合約資料</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約號碼 *</label>
                                    <input type="text" name="rentOutTenancyNumber" value={formData.rentOutTenancyNumber} onChange={handleChange} required className={inputClass} placeholder="RO-001" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約放盤價</label>
                                    <input type="text" name="rentOutPricing" value={formatNumberWithCommas(formData.rentOutPricing)} onChange={(e) => handlePriceChange('rentOutPricing', e.target.value)} className={inputClass} placeholder="0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約月租 *</label>
                                    <input type="text" name="rentOutMonthlyRental" value={formatNumberWithCommas(formData.rentOutMonthlyRental)} onChange={(e) => handlePriceChange('rentOutMonthlyRental', e.target.value)} required className={inputClass} placeholder="50,000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約期數 (月)</label>
                                    <input type="number" name="rentOutPeriods" value={formData.rentOutPeriods} onChange={handleChange} className={inputClass} placeholder="12" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約總額</label>
                                <input
                                    type="text"
                                    name="rentOutTotalAmount"
                                    value={formatNumberWithCommas(formData.rentOutTotalAmount)}
                                    readOnly
                                    className={`${inputClass} bg-zinc-100 dark:bg-white/5 cursor-not-allowed opacity-80`}
                                    placeholder="自動計算"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約開始日期</label>
                                    <input type="date" name="rentOutStartDate" value={formData.rentOutStartDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約結束日期</label>
                                    <input type="date" name="rentOutEndDate" value={formData.rentOutEndDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約實際結束日期</label>
                                <input type="date" name="rentOutActualEndDate" value={formData.rentOutActualEndDate} onChange={handleChange} className={inputClass} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約按金</label>
                                    <input type="text" name="rentOutDepositReceived" value={formatNumberWithCommas(formData.rentOutDepositReceived)} onChange={(e) => handlePriceChange('rentOutDepositReceived', e.target.value)} className={inputClass} placeholder="100,000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>按金收據號碼</label>
                                    <input type="text" name="rentOutDepositReceiptNumber" value={formData.rentOutDepositReceiptNumber} onChange={handleChange} className={inputClass} placeholder="請輸入按金收據號碼" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>按金收取日期</label>
                                    <input type="date" name="rentOutDepositReceiveDate" value={formData.rentOutDepositReceiveDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>按金退回日期</label>
                                    <input type="date" name="rentOutDepositReturnDate" value={formData.rentOutDepositReturnDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>按金退回金額</label>
                                <input type="text" name="rentOutDepositReturnAmount" value={formatNumberWithCommas(formData.rentOutDepositReturnAmount)} onChange={(e) => handlePriceChange('rentOutDepositReturnAmount', e.target.value)} className={inputClass} placeholder="100,000" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約出租人</label>
                                    <input type="text" name="rentOutLessor" value={formData.rentOutLessor} onChange={handleChange} className={inputClass} placeholder="公司名稱 / 個人名稱" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>租借位置 / 地址</label>
                                    <input type="text" name="rentOutAddressDetail" value={formData.rentOutAddressDetail} onChange={handleChange} className={inputClass} placeholder="詳細地址" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約租務狀態</label>
                                <select name="rentOutStatus" value={formData.rentOutStatus} onChange={handleChange} className={inputClass}>
                                    {rentOutStatuses.map(s => (
                                        <option key={s.value} value={s.value} className="bg-white dark:bg-[#1a1a2e]">{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約描述</label>
                                <div className="rich-text-editor">
                                    <style jsx global>{`
                                        .rich-text-editor .ql-toolbar { border-radius: 12px 12px 0 0; border-color: var(--border-color); background: var(--bg-color); }
                                        .rich-text-editor .ql-container { border-radius: 0 0 12px 12px; border-color: var(--border-color); background: var(--bg-color); min-height: 120px; }
                                        .rich-text-editor .ql-editor { color: inherit; min-height: 100px; }
                                        :root { --border-color: #e5e7eb; --bg-color: #f9fafb; }
                                        .dark { --border-color: rgba(255,255,255,0.1); --bg-color: rgba(255,255,255,0.05); }
                                    `}</style>
                                    <ReactQuill
                                        theme="snow"
                                        value={formData.rentOutDescription}
                                        onChange={(content) => setFormData(prev => ({ ...prev, rentOutDescription: content }))}
                                        placeholder="合約描述或備註..."
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                        >
                            取消
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                    className="flex items-center gap-2"
                                >
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{rent ? '更新中...' : '創建中...'}</span>
                                </motion.div>
                            ) : (
                                rent ? '更新記錄' : '創建記錄'
                            )}
                        </motion.button>
                    </div>
                </form>
            </motion.div>

            {/* Proprietor Modal for creating new tenant or landlord */}
            {showProprietorModal && (
                <ProprietorModal
                    mode={formData.type === 'rent_out' ? 'tenant' : 'proprietor'}
                    onClose={() => setShowProprietorModal(false)}
                    onSuccess={handleProprietorCreated}
                />
            )}
            {/* RentOutFormModal for 二房東 */}
            {showSubLandlordModal && (
                <RentOutFormModal
                    mode="sub_landlord"
                    editItem={editSubLandlord}
                    onClose={() => { setShowSubLandlordModal(false); setEditSubLandlord(null); }}
                    onSuccess={async (id) => {
                        await queryClient.invalidateQueries({ queryKey: ['sub_landlords'] });
                        setFormData(prev => ({ ...prev, rentOutSubLandlordId: id }));
                        setShowSubLandlordModal(false);
                        setEditSubLandlord(null);
                    }}
                />
            )}
            {/* RentOutFormModal for 現時租客 */}
            {showCurrentTenantModal && (
                <RentOutFormModal
                    mode="current_tenant"
                    editItem={editCurrentTenant}
                    onClose={() => { setShowCurrentTenantModal(false); setEditCurrentTenant(null); }}
                    onSuccess={async (id) => {
                        await queryClient.invalidateQueries({ queryKey: ['current_tenants'] });
                        setFormData(prev => ({ ...prev, rentOutTenantIds: [...(prev.rentOutTenantIds || []), id] }));
                        setShowCurrentTenantModal(false);
                        setEditCurrentTenant(null);
                    }}
                />
            )}
        </>
    );
}
