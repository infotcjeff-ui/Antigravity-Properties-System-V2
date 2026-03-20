'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useRents, useProprietors, useProperties, useSubLandlordsQuery, useCurrentTenantsQuery } from '@/hooks/useStorage';
import { fileToBase64, compressImage, validateImageUpload } from '@/lib/imageUtils';
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
    const { getProperties, addProperty } = useProperties();
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
    const [showChildPropertyModal, setShowChildPropertyModal] = useState(false);
    const [childPropertySaving, setChildPropertySaving] = useState(false);
    const [childPropertyForm, setChildPropertyForm] = useState({ parentId: '', name: '', code: '' });
    const [childPropertyError, setChildPropertyError] = useState('');
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
                rentOutTenantId: (() => {
                    const ids = (rent as any).rentOutTenantIds;
                    if (Array.isArray(ids) && ids.length > 0) return ids[0];
                    return '';
                })(),
                rentingNumber: rent.rentingNumber || '',
                rentingReferenceNumber: rent.rentingReferenceNumber || '',
                rentingMonthlyRental: rent.rentingMonthlyRental?.toString() || '',
                rentingPeriods: rent.rentingPeriods?.toString() || '',
                rentingStartDate: formatDate(rent.rentingStartDate),
                rentingEndDate: formatDate(rent.rentingEndDate),
                rentingDeposit: rent.rentingDeposit?.toString() || '',
                rentCollectionTenantName: (rent as any).rentCollectionTenantName || '',
                rentCollectionDate: formatDate((rent as any).rentCollectionDate),
                rentCollectionAmount: (rent as any).rentCollectionAmount != null ? String((rent as any).rentCollectionAmount) : '',
                rentCollectionPaymentMethod: ((rent as any).rentCollectionPaymentMethod || '') as '' | 'cheque' | 'fps' | 'cash',
                rentCollectionChequeBank: (rent as any).rentCollectionChequeBank || '',
                rentCollectionChequeNumber: (rent as any).rentCollectionChequeNumber || '',
                rentCollectionChequeImage: (rent as any).rentCollectionChequeImage || '',
                rentCollectionNotes: rent.notes || '',
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
            rentOutTenantId: '',
            rentingNumber: '',
            rentingReferenceNumber: '',
            rentingMonthlyRental: '',
            rentingPeriods: '',
            rentingStartDate: '',
            rentingEndDate: '',
            rentingDeposit: '',
            rentCollectionTenantName: '',
            rentCollectionDate: '',
            rentCollectionAmount: '',
            rentCollectionPaymentMethod: '' as '' | 'cheque' | 'fps' | 'cash',
            rentCollectionChequeBank: '',
            rentCollectionChequeNumber: '',
            rentCollectionChequeImage: '',
            rentCollectionNotes: '',
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

    const lesseeIndividuals = useMemo(
        () =>
            proprietors
                .filter(p => p.type === 'individual')
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK')),
        [proprietors]
    );
    const lesseeCompanies = useMemo(
        () =>
            proprietors
                .filter(p => p.type === 'company')
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK')),
        [proprietors]
    );

    const propertiesRoot = useMemo(
        () =>
            properties
                .filter(p => !p.parentPropertyId)
                .slice()
                .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'zh-HK')),
        [properties]
    );
    const propertiesChildren = useMemo(
        () =>
            properties
                .filter(p => !!p.parentPropertyId)
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK')),
        [properties]
    );

    const openChildPropertyModal = () => {
        const focusId = propertyId || formData.propertyId;
        const p = focusId ? properties.find(x => x.id === focusId) : undefined;
        const defaultParent = p ? (p.parentPropertyId || p.id || '') : '';
        setChildPropertyError('');
        setChildPropertyForm({ parentId: defaultParent, name: '', code: '' });
        setShowChildPropertyModal(true);
    };

    const submitChildProperty = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!childPropertyForm.parentId) {
            setChildPropertyError('請選擇主物業');
            return;
        }
        if (!childPropertyForm.name.trim() || !childPropertyForm.code.trim()) {
            setChildPropertyError('請填寫子物業名稱及編號');
            return;
        }
        const parent = properties.find(p => p.id === childPropertyForm.parentId);
        if (!parent) {
            setChildPropertyError('找不到主物業');
            return;
        }
        setChildPropertySaving(true);
        setChildPropertyError('');
        try {
            const newId = await addProperty({
                name: childPropertyForm.name.trim(),
                code: childPropertyForm.code.trim(),
                address: parent.address || '',
                lotIndex: parent.lotIndex || '',
                lotArea: parent.lotArea || '',
                type: parent.type,
                status: parent.status || 'renting',
                landUse: parent.landUse || '',
                images: [],
                geoMaps: [],
                location: parent.location,
                googleDrivePlanUrl: parent.googleDrivePlanUrl || '',
                hasPlanningPermission: parent.hasPlanningPermission || '',
                parentPropertyId: childPropertyForm.parentId,
                proprietorId: parent.proprietorId,
                tenantId: parent.tenantId,
            });
            if (newId) {
                await loadData();
                await queryClient.invalidateQueries({ queryKey: ['properties'] });
                setFormData(prev => ({ ...prev, propertyId: newId }));
                setShowChildPropertyModal(false);
                setChildPropertyForm({ parentId: '', name: '', code: '' });
            } else {
                setChildPropertyError('子物業建立失敗');
            }
        } finally {
            setChildPropertySaving(false);
        }
    };

    const onChequeImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        const check = validateImageUpload(formData.rentCollectionChequeImage ? [formData.rentCollectionChequeImage] : [], [file], 'property');
        if (!check.valid) {
            setError(check.error || '圖片無效');
            return;
        }
        try {
            const blob = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.75 });
            const b64 = await fileToBase64(blob);
            setFormData(prev => ({ ...prev, rentCollectionChequeImage: b64 }));
        } catch {
            setError('圖片處理失敗');
        }
    };

    // Auto-calculate rentOutTotalAmount（僅合約記錄）
    useEffect(() => {
        if (formData.type !== 'contract') return;
        const monthly = parseFloat(formData.rentOutMonthlyRental);
        const periods = parseInt(formData.rentOutPeriods);
        const newTotal = (!isNaN(monthly) && !isNaN(periods)) ? (monthly * periods).toString() : '';

        if (formData.rentOutTotalAmount !== newTotal) {
            setFormData(prev => ({ ...prev, rentOutTotalAmount: newTotal }));
        }
    }, [formData.rentOutMonthlyRental, formData.rentOutPeriods, formData.type, formData.rentOutTotalAmount]);

    useEffect(() => {
        if (formData.type !== 'rent_out' || !formData.tenantId) return;
        const name = proprietors.find(p => p.id === formData.tenantId)?.name?.trim();
        if (!name) return;
        setFormData(prev => {
            if ((prev.rentCollectionTenantName || '').trim()) return prev;
            return { ...prev, rentCollectionTenantName: name };
        });
    }, [formData.type, formData.tenantId, proprietors]);

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
        if (formData.type === 'rent_out') {
            if (!formData.propertyId) {
                setError('請選擇物業');
                return;
            }
            if (!formData.tenantId) {
                setError('請選擇承租人');
                return;
            }
            if (!formData.rentCollectionTenantName?.trim()) {
                setError('請填寫租客名稱');
                return;
            }
            if (!formData.rentCollectionDate) {
                setError('請選擇交租日期');
                return;
            }
            const paid = parseFloat(formData.rentCollectionAmount);
            if (Number.isNaN(paid) || paid <= 0) {
                setError('請填寫繳付金額');
                return;
            }
            if (!formData.rentCollectionPaymentMethod) {
                setError('請選擇付款方式');
                return;
            }
            if (formData.rentCollectionPaymentMethod === 'cheque') {
                if (!formData.rentCollectionChequeBank?.trim()) {
                    setError('請填寫支票銀行');
                    return;
                }
                if (!formData.rentCollectionChequeNumber?.trim()) {
                    setError('請填寫支票號碼');
                    return;
                }
            }
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
                const paidAmt = parseFloat(formData.rentCollectionAmount);
                rentData = {
                    ...rentData,
                    status: 'completed' as const,
                    amount: !Number.isNaN(paidAmt) ? paidAmt : undefined,
                    startDate: formData.rentCollectionDate ? new Date(formData.rentCollectionDate) : undefined,
                    notes: formData.rentCollectionNotes.trim(),
                    location: formData.rentOutAddressDetail || defaultLocation,
                    rentOutSubLandlord: subLandlords.find(s => s.id === formData.rentOutSubLandlordId)?.name || formData.rentOutSubLandlord || undefined,
                    rentOutSubLandlordId: formData.rentOutSubLandlordId || undefined,
                    rentOutTenants: formData.rentOutTenantId
                        ? [currentTenants.find(ct => ct.id === formData.rentOutTenantId)?.name || formData.rentOutTenantId]
                        : (formData.rentOutTenants || []).filter(Boolean).length > 0 ? formData.rentOutTenants : undefined,
                    rentOutTenantIds: formData.rentOutTenantId ? [formData.rentOutTenantId] : undefined,
                    rentCollectionTenantName: formData.rentCollectionTenantName.trim(),
                    rentCollectionDate: formData.rentCollectionDate ? new Date(formData.rentCollectionDate) : undefined,
                    rentCollectionAmount: paidAmt,
                    rentCollectionPaymentMethod: formData.rentCollectionPaymentMethod,
                    rentCollectionChequeBank: formData.rentCollectionPaymentMethod === 'cheque' ? formData.rentCollectionChequeBank.trim() : undefined,
                    rentCollectionChequeNumber: formData.rentCollectionPaymentMethod === 'cheque' ? formData.rentCollectionChequeNumber.trim() : undefined,
                    rentCollectionChequeImage:
                        (formData.rentCollectionPaymentMethod === 'cheque' || formData.rentCollectionPaymentMethod === 'fps') &&
                        formData.rentCollectionChequeImage
                            ? formData.rentCollectionChequeImage
                            : undefined,
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
                    rentOutTenants: formData.rentOutTenantId
                        ? [currentTenants.find(ct => ct.id === formData.rentOutTenantId)?.name || formData.rentOutTenantId]
                        : (formData.rentOutTenants || []).filter(Boolean).length > 0 ? formData.rentOutTenants : undefined,
                    rentOutTenantIds: formData.rentOutTenantId ? [formData.rentOutTenantId] : undefined,
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
                                <div className="flex gap-2 items-center">
                                    <div className={`${inputClass} flex-1 opacity-80 bg-zinc-100 dark:bg-white/10 flex items-center min-h-[44px]`}>
                                        <span className="text-zinc-500 dark:text-white/40 mr-2">📍</span>
                                        {properties.find(p => p.id === formData.propertyId)?.name || 'Loading...'}
                                    </div>
                                    {formData.type === 'rent_out' && (
                                        <button
                                            type="button"
                                            onClick={openChildPropertyModal}
                                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all h-11 whitespace-nowrap shrink-0"
                                        >
                                            + 子物業
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2 items-center">
                                    <select
                                        name="propertyId"
                                        value={formData.propertyId}
                                        onChange={handleChange}
                                        required
                                        className={`${inputClass} flex-1 min-h-[44px]`}
                                    >
                                        <option value="" className="bg-white dark:bg-[#1a1a2e]">選擇物業...</option>
                                        {propertiesRoot.length > 0 && (
                                            <optgroup label="主物業">
                                                {propertiesRoot.map(p => (
                                                    <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">
                                                        {p.name} ({p.code})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {propertiesChildren.length > 0 && (
                                            <optgroup label="子物業">
                                                {propertiesChildren.map(p => {
                                                    const par = properties.find(x => x.id === p.parentPropertyId);
                                                    return (
                                                        <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">
                                                            {par ? `${par.name} › ` : ''}{p.name} ({p.code})
                                                        </option>
                                                    );
                                                })}
                                            </optgroup>
                                        )}
                                    </select>
                                    {formData.type === 'rent_out' && (
                                        <button
                                            type="button"
                                            onClick={openChildPropertyModal}
                                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all h-11 whitespace-nowrap shrink-0"
                                        >
                                            + 子物業
                                        </button>
                                    )}
                                </div>
                            )}
                            {formData.type === 'rent_out' && (
                                <p className="text-xs text-zinc-400 dark:text-white/40">「+ 子物業」會在主物業下新增一筆子物業，並可立即選用</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>承租人</label>
                            <div className="flex gap-2 items-center">
                                {(formData.type === 'rent_out' || formData.type === 'renting' || formData.type === 'contract') ? (
                                    <>
                                        <select
                                            name="tenantId"
                                            value={formData.tenantId}
                                            onChange={handleChange}
                                            className={`${inputClass} flex-1`}
                                        >
                                            <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇承租人</option>
                                            {lesseeIndividuals.length > 0 && (
                                                <optgroup label="個人">
                                                    {lesseeIndividuals.map(p => (
                                                        <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">
                                                            {p.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            {lesseeCompanies.length > 0 && (
                                                <optgroup label="公司">
                                                    {lesseeCompanies.map(p => (
                                                        <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">
                                                            {p.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                        {formData.tenantId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const p = proprietors.find(pt => pt.id === formData.tenantId);
                                                    if (p) setShowProprietorModal(true);
                                                }}
                                                className="p-2 text-zinc-400 hover:text-purple-500 rounded-lg shrink-0"
                                                title="編輯"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                        )}
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
                            <p className="text-xs text-zinc-400 dark:text-white/40">請按「+ 新增」以新增承租人</p>
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
                                        <select
                                            name="rentOutTenantId"
                                            value={formData.rentOutTenantId}
                                            onChange={handleChange}
                                            className={`${inputClass} flex-1`}
                                        >
                                            <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇現時租客</option>
                                            {currentTenants.map(ct => (
                                                <option key={ct.id} value={ct.id} className="bg-white dark:bg-[#1a1a2e]">{ct.name}</option>
                                            ))}
                                        </select>
                                        {formData.rentOutTenantId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const ct = currentTenants.find(t => t.id === formData.rentOutTenantId);
                                                    if (ct) setEditCurrentTenant(ct);
                                                    setShowCurrentTenantModal(true);
                                                }}
                                                className="p-2 text-zinc-400 hover:text-purple-500 rounded-lg shrink-0"
                                                title="編輯"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => { setEditCurrentTenant(null); setShowCurrentTenantModal(true); }}
                                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-[44px] whitespace-nowrap"
                                        >
                                            + 新增
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-400 dark:text-white/40">請按「+ 新增」以新增現時租客</p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===== RENT OUT FORM (收租) — 收租記錄 ===== */}
                    {formData.type === 'rent_out' && (
                        <>
                            <div className="border-t border-zinc-200 dark:border-white/10 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-4">收租記錄</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>租客名稱 *</label>
                                    <input
                                        type="text"
                                        name="rentCollectionTenantName"
                                        value={formData.rentCollectionTenantName}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                        placeholder="與收據一致之名稱"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>交租日期 *</label>
                                    <input type="date" name="rentCollectionDate" value={formData.rentCollectionDate} onChange={handleChange} required className={inputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>繳付金額 *</label>
                                    <input
                                        type="text"
                                        name="rentCollectionAmount"
                                        value={formatNumberWithCommas(formData.rentCollectionAmount)}
                                        onChange={(e) => handlePriceChange('rentCollectionAmount', e.target.value)}
                                        required
                                        className={inputClass}
                                        placeholder="50,000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>付款方式 *</label>
                                    <select
                                        name="rentCollectionPaymentMethod"
                                        value={formData.rentCollectionPaymentMethod}
                                        onChange={(e) => {
                                            const v = e.target.value as '' | 'cheque' | 'fps' | 'cash';
                                            setFormData(prev => ({
                                                ...prev,
                                                rentCollectionPaymentMethod: v,
                                                ...(v === 'cheque'
                                                    ? {}
                                                    : v === 'fps'
                                                        ? { rentCollectionChequeBank: '', rentCollectionChequeNumber: '' }
                                                        : { rentCollectionChequeBank: '', rentCollectionChequeNumber: '', rentCollectionChequeImage: '' }),
                                            }));
                                        }}
                                        required
                                        className={inputClass}
                                    >
                                        <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇</option>
                                        <option value="cheque" className="bg-white dark:bg-[#1a1a2e]">支票</option>
                                        <option value="fps" className="bg-white dark:bg-[#1a1a2e]">FPS轉帳</option>
                                        <option value="cash" className="bg-white dark:bg-[#1a1a2e]">現金</option>
                                    </select>
                                </div>
                            </div>

                            {formData.rentCollectionPaymentMethod === 'cheque' && (
                                <div className="rounded-xl border border-purple-100 dark:border-purple-500/25 bg-purple-50/40 dark:bg-purple-500/10 p-4 space-y-4">
                                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">支票資料</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className={labelClass}>銀行 *</label>
                                            <input
                                                type="text"
                                                name="rentCollectionChequeBank"
                                                value={formData.rentCollectionChequeBank}
                                                onChange={handleChange}
                                                className={inputClass}
                                                placeholder="例如：匯豐銀行"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>支票號碼 *</label>
                                            <input
                                                type="text"
                                                name="rentCollectionChequeNumber"
                                                value={formData.rentCollectionChequeNumber}
                                                onChange={handleChange}
                                                className={inputClass}
                                                placeholder="支票號碼"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>支票影像（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-purple-600 dark:text-purple-400 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors">
                                                上載圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={onChequeImageChange} />
                                            </label>
                                            {formData.rentCollectionChequeImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, rentCollectionChequeImage: '' }))}
                                                        className="text-sm text-red-500 hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                    <img src={formData.rentCollectionChequeImage} alt="支票預覽" className="h-20 rounded-lg border border-zinc-200 dark:border-white/10 object-contain" />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.rentCollectionPaymentMethod === 'fps' && (
                                <div className="rounded-xl border border-purple-100 dark:border-purple-500/25 bg-purple-50/40 dark:bg-purple-500/10 p-4 space-y-4">
                                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">FPS 轉帳</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>轉帳證明／截圖（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-purple-600 dark:text-purple-400 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors">
                                                上載圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={onChequeImageChange} />
                                            </label>
                                            {formData.rentCollectionChequeImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, rentCollectionChequeImage: '' }))}
                                                        className="text-sm text-red-500 hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                    <img src={formData.rentCollectionChequeImage} alt="轉帳證明預覽" className="h-20 rounded-lg border border-zinc-200 dark:border-white/10 object-contain" />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className={labelClass}>備註</label>
                                <textarea
                                    name="rentCollectionNotes"
                                    value={formData.rentCollectionNotes}
                                    onChange={handleChange}
                                    rows={3}
                                    className={inputClass}
                                    placeholder="其他說明…"
                                />
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

            {showChildPropertyModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1a2e] border border-zinc-200 dark:border-white/10 shadow-xl overflow-hidden"
                    >
                        <div className="p-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">新增子物業</h3>
                            <button
                                type="button"
                                onClick={() => { setShowChildPropertyModal(false); setChildPropertyError(''); }}
                                className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={submitChildProperty} className="p-5 space-y-4">
                            {childPropertyError && (
                                <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-600 dark:text-red-200 text-sm">{childPropertyError}</div>
                            )}
                            <div className="space-y-2">
                                <label className={labelClass}>主物業 *</label>
                                <select
                                    value={childPropertyForm.parentId}
                                    onChange={(e) => setChildPropertyForm(prev => ({ ...prev, parentId: e.target.value }))}
                                    className={inputClass}
                                    required
                                >
                                    <option value="">請選擇主物業…</option>
                                    {propertiesRoot.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>子物業名稱 *</label>
                                <input
                                    value={childPropertyForm.name}
                                    onChange={(e) => setChildPropertyForm(prev => ({ ...prev, name: e.target.value }))}
                                    className={inputClass}
                                    placeholder="例如：B座 12 樓"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>子物業編號 *</label>
                                <input
                                    value={childPropertyForm.code}
                                    onChange={(e) => setChildPropertyForm(prev => ({ ...prev, code: e.target.value }))}
                                    className={inputClass}
                                    placeholder="例如：A01-C01"
                                    required
                                />
                            </div>
                            <p className="text-xs text-zinc-400 dark:text-white/40">會複製主物業的地址、地段及業主關聯；建立後會自動選取此子物業。</p>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowChildPropertyModal(false); setChildPropertyError(''); }}
                                    className="px-4 py-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={childPropertySaving}
                                    className="px-5 py-2 rounded-xl bg-purple-600 text-white font-medium disabled:opacity-50"
                                >
                                    {childPropertySaving ? '建立中…' : '建立子物業'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

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
                        setFormData(prev => ({ ...prev, rentOutTenantId: id }));
                        setShowCurrentTenantModal(false);
                        setEditCurrentTenant(null);
                    }}
                />
            )}
        </>
    );
}
